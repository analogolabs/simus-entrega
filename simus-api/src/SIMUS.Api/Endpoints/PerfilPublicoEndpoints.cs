using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El perfil público de la persona, activado por ella (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4-§19.5).
/// </summary>
/// <remarks>
/// <para>
/// <b>NO HAY BANDERA «PUBLICADO».</b> Un perfil se ve si, y solo si, (1) la persona tiene vigente la
/// autorización <c>perfil_publico</c>, (2) la consola no lo ocultó por moderación y (3) la cuenta
/// está activa. Publicar es otorgar esa autorización; retirarla —desde aquí o desde «Mis
/// autorizaciones»— lo oculta en el acto, porque no queda nada más que apagar.
/// </para>
/// <para>
/// <b>OCULTO Y AUSENTE RESPONDEN IGUAL.</b> La ruta pública contesta 404 sin cuerpo tanto si la
/// clave no existe como si el perfil está oculto: la respuesta no revela que hay una cuenta detrás.
/// </para>
/// <para>
/// <b>NUNCA CORREO, DOCUMENTO NI TELÉFONO.</b> El perfil tiene su propia tabla y no lee esas
/// columnas de <c>dbo.Usuarios</c>. El rol en cada organización tampoco sale (§19.5).
/// </para>
/// </remarks>
public static class PerfilPublicoEndpoints
{
    public const int MaximoDeEnlaces = 5;
    private const int LargoNombreVisible = 120;
    private const int LargoEnlace = 400;
    private const int LargoEtiquetaDeEnlace = 60;
    private const int LargoMotivo = 500;
    private const int MaximoDePracticas = 20;
    private const string Tabla = "PerfilesPublicos";

    // ── Perfil enriquecido (ME, docs/desarrollo/19-cuentas-y-organizaciones.md §19.12) ───────────────────────────────────────────────
    public const int LargoBiografiaCorta = 280;
    public const int LargoBiografiaLarga = 4000;
    public const int MaximoDeRoles = 8;
    private const int LargoRol = 60;
    public const int MaximoDePortafolio = 8;
    private const int LargoTituloDePortafolio = 120;
    /// <summary>Lo que cualquiera ve.</summary>
    public const string VisibilidadPublica = "publico";
    /// <summary>Lo que ve solo quien tiene una cuenta en SIMUS.</summary>
    public const string VisibilidadSoloSimus = "solo_simus";
    private static readonly string[] TiposDePortafolio = ["audio", "video", "texto", "imagen", "enlace"];
    private const int LargoDescripcionDePortafolio = 300;
    private const int PrimerAnioDePortafolio = 1900;
    private static readonly JsonSerializerOptions OpcionesJson = new(JsonSerializerDefaults.Web);

    public static RouteGroupBuilder MapPerfilPublicoEndpoints(this RouteGroupBuilder group)
    {
        var publico = group.MapGroup("/publico").WithTags("perfiles-publicos").AllowAnonymous();
        publico.MapGet("/personas/{clave:guid}", LeerPublicoAsync).WithName("PerfilPublicoDePersona");
        publico.MapGet("/organizaciones/{id:int}", LeerOrganizacionAsync).WithName("OrganizacionPublica");

        var mio = group.MapGroup("/externo/cuenta/perfil-publico").WithTags("externo-cuenta")
            .RequireAuthorization(SimusAuthentication.ExternalPolicy);
        mio.MapGet(string.Empty, LeerMioAsync).WithName("MiPerfilPublico");
        mio.MapPut(string.Empty, GuardarMioAsync).WithName("GuardarMiPerfilPublico");
        mio.MapPost("/publicar", PublicarAsync).WithName("PublicarMiPerfilPublico");
        mio.MapPost("/ocultar", OcultarAsync).WithName("OcultarMiPerfilPublico");
        mio.MapGet("/historial", LeerMiHistorialAsync).WithName("MiHistorialDePerfilPublico");
        // LA FOTO ENTRA POR EL BANCO, con la misma cadena de comprobaciones que el resto. Va aparte
        // de /externo/archivos porque esa puerta exige una organización y la foto es de la persona.
        mio.MapPost("/foto", SubirFotoAsync).WithName("SubirFotoDePerfilPublico").DisableAntiforgery().ConTopeDeImagen()
            .AddEndpointFilter(ExigeTestigoDeLaConsola.ExigirDelCanalExterno);

        var consola = group.MapGroup("/admin/perfiles-publicos").WithTags("admin-perfiles-publicos")
            .RequireAuthorization(SimusAuthentication.InstitutionalPolicy)
            .ExigeModulo("organizaciones");
        consola.MapGet(string.Empty, ListarEnConsolaAsync).WithName("ListarPerfilesPublicos");
        consola.MapPost("/{clave:guid}/ocultar", OcultarPorModeracionAsync).WithName("OcultarPerfilPublicoPorModeracion");
        consola.MapPost("/{clave:guid}/restablecer", RestablecerAsync).WithName("RestablecerPerfilPublico");
        return group;
    }

    // ── Reglas compartidas ────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Los perfiles que CUALQUIERA puede ver. Es la única definición de «visible para el público»: un perfil «solo
    /// SIMUS» no está aquí.
    /// </summary>
    public static IQueryable<PerfilPublicoRow> Visibles(SimusDbContext db) =>
        VisiblesParaSimus(db).Where(perfil => perfil.Visibilidad == VisibilidadPublica);

    /// <summary>
    /// Los perfiles que ve quien tiene una cuenta en SIMUS: los públicos y los «solo SIMUS». Con la autorización
    /// vigente, sin ocultar por moderación y con la cuenta activa, igual que <see cref="Visibles"/>.
    /// </summary>
    public static IQueryable<PerfilPublicoRow> VisiblesParaSimus(SimusDbContext db) =>
        db.PerfilesPublicos.AsNoTracking()
            .Where(perfil => !perfil.OcultoPorModeracion
                && db.Users.Any(usuario => usuario.Id == perfil.IdUsuario && usuario.IsActive)
                && db.AutorizacionesDeDatos.Any(autorizacion =>
                    autorizacion.IdUsuario == perfil.IdUsuario
                    && autorizacion.Finalidad == FinalidadesDeDatos.PerfilPublico
                    && autorizacion.FechaRevocacion == null));

    /// <summary>
    /// Las organizaciones que el público puede ver. Es la única definición de «organización pública».
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>ACTIVA Y REVISADA POR LA CONSOLA (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1 decisión 11).</b> Hasta el 5 nov
    /// 2026 bastaba con «activa», y en el modo demo una organización nace activa: cualquiera que
    /// creara una cuenta tenía una ficha en el portal oficial al instante. La dirección
    /// decidió que solo es pública la que el Programa ya revisó, y esa revisión es un acto explícito
    /// de la consola que deja fecha y autor (<see cref="EntityProfileRow.FechaRevisionConsola"/>).
    /// </para>
    /// <para>
    /// La ficha, los enlaces desde Festival y Mercado y las organizaciones de un perfil de persona
    /// leen esta misma consulta: un enlace nunca termina en «no disponible».
    /// </para>
    /// </remarks>
    public static IQueryable<EntityProfileRow> OrganizacionesPublicas(SimusDbContext db) =>
        db.EntityProfiles.AsNoTracking()
            .Where(entidad => entidad.IsActive
                && entidad.StatusCode == EstadosDeOrganizacion.Activa
                && entidad.FechaRevisionConsola != null);

    /// <summary>
    /// De esas organizaciones, las que tienen ficha pública en /ecosistema/organizaciones/:id.
    /// </summary>
    /// <remarks>
    /// Es <see cref="OrganizacionesPublicas"/>: una ficha de Festival o de Mercado solo enlaza a la
    /// organización si el enlace no va a terminar en «no disponible».
    /// </remarks>
    public static async Task<HashSet<int>> OrganizacionesConFichaAsync(SimusDbContext db, IEnumerable<int> ids, CancellationToken ct)
    {
        var buscadas = ids.Distinct().ToArray();
        if (buscadas.Length == 0) return [];
        var publicas = await OrganizacionesPublicas(db)
            .Where(entidad => buscadas.Contains(entidad.Id))
            .Select(entidad => entidad.Id)
            .ToListAsync(ct);
        return [.. publicas];
    }

    private static string UrlDeArchivo(int id) =>
        "/api/v1/publico/archivos/" + id.ToString(CultureInfo.InvariantCulture);

    private static List<string> LeerOficios(string? json) => LeerJson<List<string>>(json) ?? [];

    private static List<ItemDePortafolioDto> LeerPortafolio(string? json) => LeerJson<List<ItemDePortafolioDto>>(json) ?? [];

    private static List<int> LeerIdsDeOrganizaciones(string? json) => LeerJson<List<int>>(json) ?? [];

    private static T? LeerJson<T>(string? json) where T : class
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<T>(json, OpcionesJson); }
        catch (JsonException) { return null; }
    }

    /// <summary>El nombre civil de la cuenta: solo sale en la ficha si la persona consintió mostrarlo.</summary>
    private static async Task<string?> NombreCivilAsync(SimusDbContext db, int idUsuario, CancellationToken ct)
    {
        var usuario = await db.Users.AsNoTracking().Where(item => item.Id == idUsuario)
            .Select(item => new { item.PrimerNombre, item.SegundoNombre, item.PrimerApellido, item.SegundoApellido, item.FullName })
            .FirstOrDefaultAsync(ct);
        if (usuario is null) return null;
        var nombre = string.Join(' ', new[] { usuario.PrimerNombre, usuario.SegundoNombre, usuario.PrimerApellido, usuario.SegundoApellido }
            .Where(parte => !string.IsNullOrWhiteSpace(parte)));
        // LAS CUENTAS ANTERIORES AL NOMBRE PARTIDO SOLO TIENEN `FullName` (docs/desarrollo/19-cuentas-y-organizaciones.md §19.14). Sin este recurso, marcar
        // «mostrar mi nombre civil» no hacía nada para ellas: ni vista previa ni ficha.
        if (nombre.Length == 0) nombre = usuario.FullName?.Trim() ?? string.Empty;
        return nombre.Length == 0 ? null : nombre;
    }

    /// <summary>
    /// Si quien pide tiene una cuenta en SIMUS, externa o de la consola. Es lo que decide si ve un perfil «solo
    /// SIMUS»: la ruta pública no exige sesión, así que se pregunta por ella a mano.
    /// </summary>
    private static async Task<bool> HayCuentaDeSimusAsync(HttpContext http)
    {
        if ((await http.AuthenticateAsync(SimusAuthentication.ExternalScheme)).Succeeded) return true;
        return (await http.AuthenticateAsync(SimusAuthentication.InstitutionalScheme)).Succeeded;
    }

    /// <summary>
    /// Las organizaciones públicas donde la persona tiene una membresía activa: las que su perfil
    /// enlaza. Una sin revisar no aparece, porque su enlace llevaría a una ficha que no existe.
    /// </summary>
    private static Task<List<OrganizacionDePerfilPublicoDto>> OrganizacionesActivasAsync(SimusDbContext db, int idUsuario, CancellationToken ct) =>
        db.UserEntities.AsNoTracking()
            .Where(vinculo => vinculo.UserId == idUsuario && vinculo.IsActive)
            .Join(OrganizacionesPublicas(db),
                vinculo => vinculo.EntityId, entidad => entidad.Id,
                (vinculo, entidad) => new { entidad.Id, entidad.Name })
            .Distinct()
            .OrderBy(entidad => entidad.Name)
            .Select(entidad => new OrganizacionDePerfilPublicoDto(entidad.Id, entidad.Name))
            .ToListAsync(ct);

    private static async Task<(string? Municipio, string? Departamento)> MunicipioAsync(SimusDbContext db, string? codigo, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(codigo)) return (null, null);
        var lugar = await db.DivipolaLocations.AsNoTracking()
            .Where(item => item.MunicipalityCode == codigo)
            .Select(item => new { item.MunicipalityName, item.DepartmentName })
            .FirstOrDefaultAsync(ct);
        return lugar is null ? (null, null) : (lugar.MunicipalityName, lugar.DepartmentName);
    }

    private static int Actor(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : 0;

    private static async Task<UserRow?> CuentaAsync(ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var id = Actor(principal);
        if (id <= 0) return null;
        return await db.Users.AsNoTracking().FirstOrDefaultAsync(usuario => usuario.Id == id && usuario.IsActive, ct);
    }

    private static void Bitacora(SimusDbContext db, int idUsuario, int idPerfil, string accion, object? antes, object despues, DateTime cuando) =>
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = idUsuario,
            TableName = Tabla,
            RecordId = idPerfil.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            PreviousValuesJson = antes is null ? null : JsonSerializer.Serialize(antes),
            NewValuesJson = JsonSerializer.Serialize(despues),
            CreatedAt = cuando,
        });

    // ── Lo que ve cualquiera ──────────────────────────────────────────────────────────────────

    private static async Task<IResult> LeerPublicoAsync(Guid clave, HttpContext http, SimusDbContext db, CancellationToken ct)
    {
        var perfil = await VisiblesParaSimus(db).FirstOrDefaultAsync(item => item.ClavePublica == clave, ct);
        // 404 SIN CUERPO, el mismo para «no existe», para «oculto» y para «solo SIMUS» sin sesión: la respuesta no
        // dice que hay un perfil.
        if (perfil is null) return Results.NotFound();
        if (perfil.Visibilidad != VisibilidadPublica && !await HayCuentaDeSimusAsync(http)) return Results.NotFound();
        return Results.Ok(await ProyectarPublicoAsync(db, perfil, ct));
    }

    public static async Task<PerfilPublicoDto> ProyectarPublicoAsync(SimusDbContext db, PerfilPublicoRow perfil, CancellationToken ct)
    {
        var practicas = await db.PerfilesPublicosPracticas.AsNoTracking()
            .Where(item => item.IdUsuario == perfil.IdUsuario)
            .Join(db.PracticasMusicales.AsNoTracking(), item => item.IdPracticaMusical, practica => practica.Id,
                (item, practica) => practica)
            .OrderBy(practica => practica.Orden).ThenBy(practica => practica.Nombre)
            .Select(practica => new PracticaDePerfilPublicoDto(practica.Id, practica.Nombre, practica.Slug))
            .ToListAsync(ct);
        var filasDeEnlaces = await db.PerfilesPublicosEnlaces.AsNoTracking()
            .Where(item => item.IdUsuario == perfil.IdUsuario)
            .OrderBy(item => item.Orden)
            .Select(item => new { item.Url, item.Etiqueta })
            .ToListAsync(ct);
        var enlaces = filasDeEnlaces.Select(item => item.Url).ToList();
        var (municipio, departamento) = await MunicipioAsync(db, perfil.CodigoMunicipio, ct);
        string? alternativo = null;
        if (perfil.ArchivoFotoId is int foto)
        {
            alternativo = await db.Files.AsNoTracking().Where(item => item.Id == foto).Select(item => item.AltText).FirstOrDefaultAsync(ct);
        }

        return new PerfilPublicoDto(
            perfil.ClavePublica,
            perfil.NombreVisible,
            practicas,
            municipio,
            departamento,
            perfil.ArchivoFotoId is int id ? UrlDeArchivo(id) : null,
            alternativo,
            enlaces,
            await OrganizacionesElegidasAsync(db, perfil, ct),
            perfil.NombreCivilVisible ? await NombreCivilAsync(db, perfil.IdUsuario, ct) : null,
            perfil.BiografiaCorta,
            perfil.BiografiaLarga,
            LeerOficios(perfil.RolesJson),
            LeerPortafolio(perfil.PortafolioJson),
            filasDeEnlaces.Select(item => item.Etiqueta).ToList());
    }

    /// <summary>
    /// Las organizaciones que la persona ELIGIÓ mostrar y que son públicas con membresía activa. Mostrar una
    /// organización exige el consentimiento de la persona (ME): estar en ella no basta.
    /// </summary>
    private static async Task<List<OrganizacionDePerfilPublicoDto>> OrganizacionesElegidasAsync(SimusDbContext db, PerfilPublicoRow perfil, CancellationToken ct)
    {
        var elegidas = LeerIdsDeOrganizaciones(perfil.OrganizacionesVisiblesJson);
        if (elegidas.Count == 0) return [];
        var activas = await OrganizacionesActivasAsync(db, perfil.IdUsuario, ct);
        return activas.Where(organizacion => elegidas.Contains(organizacion.Id)).ToList();
    }

    /// <summary>
    /// La ficha pública mínima de una organización pública, con las personas que publicaron su perfil.
    /// </summary>
    /// <remarks>
    /// <b>SIN REVISAR Y AUSENTE RESPONDEN IGUAL</b>: 404 sin cuerpo. La respuesta no revela que existe
    /// una organización que todavía no se ha revisado.
    /// </remarks>
    private static async Task<IResult> LeerOrganizacionAsync(int id, SimusDbContext db, CancellationToken ct)
    {
        var organizacion = await OrganizacionesPublicas(db)
            .Where(entidad => entidad.Id == id)
            .Select(entidad => new
            {
                entidad.Id, entidad.Name, entidad.Description, entidad.ArchivoFotoId,
                Municipio = entidad.HeadquartersMunicipalityCode ?? entidad.MunicipalityCode,
            })
            .FirstOrDefaultAsync(ct);
        if (organizacion is null) return Results.NotFound();

        // SOLO LAS PERSONAS QUE ELIGIERON MOSTRAR ESTA ORGANIZACIÓN (ME): su consentimiento, no solo su membresía.
        var candidatas = await Visibles(db)
            .Where(perfil => db.UserEntities.Any(vinculo => vinculo.UserId == perfil.IdUsuario && vinculo.EntityId == id && vinculo.IsActive))
            .OrderBy(perfil => perfil.NombreVisible)
            .Select(perfil => new { perfil.ClavePublica, perfil.NombreVisible, perfil.ArchivoFotoId, perfil.OrganizacionesVisiblesJson })
            .ToListAsync(ct);
        var personas = candidatas.Where(persona => LeerIdsDeOrganizaciones(persona.OrganizacionesVisiblesJson).Contains(id)).ToList();
        var (municipio, departamento) = await MunicipioAsync(db, organizacion.Municipio, ct);

        return Results.Ok(new OrganizacionPublicaDto(
            organizacion.Id,
            organizacion.Name,
            organizacion.Description,
            organizacion.ArchivoFotoId is int foto ? UrlDeArchivo(foto) : null,
            municipio,
            departamento,
            personas.Select(persona => new PersonaDeOrganizacionPublicaDto(
                persona.ClavePublica, persona.NombreVisible,
                persona.ArchivoFotoId is int fotoPersona ? UrlDeArchivo(fotoPersona) : null)).ToList()));
    }

    // ── Lo que hace la persona sobre su perfil ────────────────────────────────────────────────

    private static async Task<IResult> LeerMioAsync(ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();
        return Results.Ok(await MiPerfilAsync(db, usuario, ct));
    }

    private static async Task<MiPerfilPublicoDto> MiPerfilAsync(SimusDbContext db, UserRow usuario, CancellationToken ct)
    {
        var perfil = await db.PerfilesPublicos.AsNoTracking().FirstOrDefaultAsync(item => item.IdUsuario == usuario.Id, ct);
        var autorizado = await RegistroDeAutorizaciones.EstaVigenteAsync(db, FinalidadesDeDatos.PerfilPublico, usuario.Id, null, ct);
        var organizaciones = await OrganizacionesActivasAsync(db, usuario.Id, ct);

        if (perfil is null)
        {
            // EL NOMBRE SE PROPONE, no se publica: es solo el valor inicial del formulario.
            var propuesto = string.Join(' ', new[] { usuario.PrimerNombre, usuario.PrimerApellido }
                .Where(parte => !string.IsNullOrWhiteSpace(parte)));
            return new MiPerfilPublicoDto(false, null, propuesto, [], null, null, null, [],
                autorizado, false, null, false, organizaciones,
                NombreCivilPropio: await NombreCivilAsync(db, usuario.Id, ct));
        }

        var practicas = await db.PerfilesPublicosPracticas.AsNoTracking()
            .Where(item => item.IdUsuario == usuario.Id).Select(item => item.IdPracticaMusical).ToListAsync(ct);
        var filasDeEnlaces = await db.PerfilesPublicosEnlaces.AsNoTracking()
            .Where(item => item.IdUsuario == usuario.Id).OrderBy(item => item.Orden).Select(item => new { item.Url, item.Etiqueta }).ToListAsync(ct);
        var enlaces = filasDeEnlaces.Select(item => item.Url).ToList();

        return new MiPerfilPublicoDto(
            true, perfil.ClavePublica, perfil.NombreVisible, practicas, perfil.CodigoMunicipio,
            perfil.ArchivoFotoId, perfil.ArchivoFotoId is int foto ? UrlDeArchivo(foto) : null, enlaces,
            autorizado, perfil.OcultoPorModeracion, perfil.MotivoModeracion,
            autorizado && !perfil.OcultoPorModeracion, organizaciones,
            NombreCivilPropio: await NombreCivilAsync(db, usuario.Id, ct),
            NombreCivilVisible: perfil.NombreCivilVisible,
            BiografiaCorta: perfil.BiografiaCorta,
            BiografiaLarga: perfil.BiografiaLarga,
            Oficios: LeerOficios(perfil.RolesJson),
            Portafolio: LeerPortafolio(perfil.PortafolioJson),
            IdsOrganizacionesVisibles: LeerIdsDeOrganizaciones(perfil.OrganizacionesVisiblesJson),
            Visibilidad: perfil.Visibilidad,
            EtiquetasDeEnlaces: filasDeEnlaces.Select(item => item.Etiqueta).ToList());
    }

    private static async Task<IResult> GuardarMioAsync(
        PerfilPublicoSolicitud solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, httpContext))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();

        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var nombre = string.IsNullOrWhiteSpace(solicitud.NombreVisible)
            ? null
            : ValidationHelpers.SanitizeText(solicitud.NombreVisible.Trim(), LargoNombreVisible);
        if (string.IsNullOrWhiteSpace(nombre)) errores["nombreVisible"] = ["Escribe el nombre con el que quieres aparecer."];

        var idsPracticas = (solicitud.IdsPracticas ?? []).Distinct().ToList();
        if (idsPracticas.Count > MaximoDePracticas)
            errores["idsPracticas"] = [$"Elige como máximo {MaximoDePracticas} prácticas."];
        else if (idsPracticas.Count > 0)
        {
            var conocidas = await db.PracticasMusicales.AsNoTracking().Where(item => idsPracticas.Contains(item.Id)).CountAsync(ct);
            if (conocidas != idsPracticas.Count) errores["idsPracticas"] = ["Elige las prácticas del catálogo."];
        }

        var municipio = string.IsNullOrWhiteSpace(solicitud.CodigoMunicipio) ? null : solicitud.CodigoMunicipio.Trim();
        if (municipio is not null && !await db.DivipolaLocations.AsNoTracking().AnyAsync(item => item.MunicipalityCode == municipio, ct))
            errores["codigoMunicipio"] = ["Elige un municipio del catálogo."];

        var enlaces = new List<string>();
        var etiquetas = new List<string?>();
        var etiquetasPedidas = solicitud.EtiquetasDeEnlaces ?? [];
        var posicion = -1;
        foreach (var crudo in solicitud.Enlaces ?? [])
        {
            posicion++;
            if (string.IsNullOrWhiteSpace(crudo)) continue;
            var etiquetaCruda = posicion < etiquetasPedidas.Count ? etiquetasPedidas[posicion] : null;
            if (etiquetaCruda is not null && etiquetaCruda.Trim().Length > LargoEtiquetaDeEnlace)
            {
                errores["enlaces"] = [$"El rótulo de un enlace admite hasta {LargoEtiquetaDeEnlace} caracteres."];
                break;
            }
            etiquetas.Add(string.IsNullOrWhiteSpace(etiquetaCruda) ? null : ValidationHelpers.SanitizeText(etiquetaCruda.Trim(), LargoEtiquetaDeEnlace));
            // LA REGLA ÚNICA DE DIRECCIÓN: sin esquema se acepta y se guarda con https://.
            var enlace = ValidationHelpers.NormalizeHttpsUrl(crudo) ?? string.Empty;
            if (enlace.Length > LargoEnlace || !ValidationHelpers.IsValidHttpsUrl(enlace))
            {
                errores["enlaces"] = [ValidationHelpers.MensajeDeUrl];
                break;
            }
            // SIN DUPLICADOS: la misma dirección dos veces no dice nada más; se avisa en lugar de callarla.
            if (enlaces.Contains(enlace, StringComparer.OrdinalIgnoreCase))
            {
                errores["enlaces"] = ["Esa dirección ya está en tu lista de enlaces."];
                break;
            }
            enlaces.Add(enlace);
        }
        if (enlaces.Count > MaximoDeEnlaces) errores["enlaces"] = [$"Puedes añadir hasta {MaximoDeEnlaces} enlaces."];

        // ── Lo enriquecido (ME) ───────────────────────────────────────────────────────────────
        var biografiaCorta = string.IsNullOrWhiteSpace(solicitud.BiografiaCorta)
            ? null : ValidationHelpers.SanitizeText(solicitud.BiografiaCorta.Trim(), LargoBiografiaCorta);
        if (solicitud.BiografiaCorta is { } cruda1 && cruda1.Trim().Length > LargoBiografiaCorta)
            errores["biografiaCorta"] = [$"La biografía corta admite hasta {LargoBiografiaCorta} caracteres."];
        var biografiaLarga = string.IsNullOrWhiteSpace(solicitud.BiografiaLarga)
            ? null : ValidationHelpers.SanitizeText(solicitud.BiografiaLarga.Trim(), LargoBiografiaLarga);
        if (solicitud.BiografiaLarga is { } cruda2 && cruda2.Trim().Length > LargoBiografiaLarga)
            errores["biografiaLarga"] = [$"La biografía admite hasta {LargoBiografiaLarga} caracteres."];

        var roles = new List<string>();
        foreach (var crudo in solicitud.Oficios ?? [])
        {
            if (string.IsNullOrWhiteSpace(crudo)) continue;
            var rol = ValidationHelpers.SanitizeText(crudo.Trim(), LargoRol);
            if (crudo.Trim().Length > LargoRol) { errores["oficios"] = [$"Cada rol admite hasta {LargoRol} caracteres."]; break; }
            if (!string.IsNullOrWhiteSpace(rol) && !roles.Contains(rol, StringComparer.OrdinalIgnoreCase)) roles.Add(rol);
        }
        if (roles.Count > MaximoDeRoles) errores["oficios"] = [$"Puedes añadir hasta {MaximoDeRoles} roles u oficios."];

        var portafolio = new List<ItemDePortafolioDto>();
        foreach (var item in solicitud.Portafolio ?? [])
        {
            if (string.IsNullOrWhiteSpace(item.Url) && string.IsNullOrWhiteSpace(item.Titulo)) continue;
            var tipo = (item.Tipo ?? string.Empty).Trim().ToLowerInvariant();
            var titulo = ValidationHelpers.SanitizeText((item.Titulo ?? string.Empty).Trim(), LargoTituloDePortafolio);
            var enlace = ValidationHelpers.NormalizeHttpsUrl(item.Url ?? string.Empty) ?? string.Empty;
            if (!TiposDePortafolio.Contains(tipo) || string.IsNullOrWhiteSpace(titulo)
                || enlace.Length > LargoEnlace || !ValidationHelpers.IsValidHttpsUrl(enlace))
            {
                errores["portafolio"] = ["Cada elemento del portafolio lleva un tipo (audio, video, texto, imagen u otro), un título y una dirección https válida."];
                break;
            }
            if (item.Descripcion is { } descripcionCruda && descripcionCruda.Trim().Length > LargoDescripcionDePortafolio)
            {
                errores["portafolio"] = [$"La descripción de un elemento admite hasta {LargoDescripcionDePortafolio} caracteres."];
                break;
            }
            if (item.Anio is { } anio && (anio < PrimerAnioDePortafolio || anio > DateTime.UtcNow.Year + 1))
            {
                errores["portafolio"] = [$"El año de un elemento va entre {PrimerAnioDePortafolio} y {DateTime.UtcNow.Year + 1}."];
                break;
            }
            var descripcion = string.IsNullOrWhiteSpace(item.Descripcion)
                ? null : ValidationHelpers.SanitizeText(item.Descripcion.Trim(), LargoDescripcionDePortafolio);
            portafolio.Add(new ItemDePortafolioDto(tipo, titulo, enlace, descripcion, item.Anio));
        }
        if (portafolio.Count > MaximoDePortafolio) errores["portafolio"] = [$"El portafolio admite hasta {MaximoDePortafolio} elementos."];

        // LAS ORGANIZACIONES QUE ELIGE MOSTRAR TIENEN QUE SER DE ELLA: con membresía activa.
        var idsOrganizaciones = (solicitud.IdsOrganizaciones ?? []).Distinct().ToList();
        if (idsOrganizaciones.Count > 0)
        {
            var propias = await db.UserEntities.AsNoTracking()
                .Where(vinculo => vinculo.UserId == usuario.Id && vinculo.IsActive && idsOrganizaciones.Contains(vinculo.EntityId))
                .Select(vinculo => vinculo.EntityId).Distinct().CountAsync(ct);
            if (propias != idsOrganizaciones.Count) errores["idsOrganizaciones"] = ["Solo puedes mostrar organizaciones en las que participas."];
        }

        var perfil = await db.PerfilesPublicos.FirstOrDefaultAsync(item => item.IdUsuario == usuario.Id, ct);

        var visibilidad = string.IsNullOrWhiteSpace(solicitud.Visibilidad)
            ? perfil?.Visibilidad ?? VisibilidadPublica
            : solicitud.Visibilidad.Trim().ToLowerInvariant();
        if (visibilidad != VisibilidadPublica && visibilidad != VisibilidadSoloSimus)
            errores["visibilidad"] = ["Elige quién ve tu perfil: cualquier persona o solo quien tiene cuenta en SIMUS."];

        // LA FOTO TIENE QUE SER SUYA. Si bastara con que existiera en el banco, apuntar a un archivo
        // ajeno todavía sin publicar lo volvería público a través de este perfil.
        if (solicitud.ArchivoFotoId is int fotoPedida && fotoPedida != perfil?.ArchivoFotoId
            && !await db.Files.AsNoTracking().AnyAsync(item => item.Id == fotoPedida && item.UploadedByUserId == usuario.Id, ct))
            errores["archivoFotoId"] = ["La imagen elegida no está entre las que subiste."];

        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;
        object? antes = null;
        var fotoAnterior = RegistradorDeCambios.Tomar(perfil ?? new PerfilPublicoRow(), CamposDelPerfilPublico.Vigilados);
        if (perfil is null)
        {
            perfil = new PerfilPublicoRow
            {
                IdUsuario = usuario.Id,
                ClavePublica = Guid.NewGuid(),
                FechaCreacion = ahora,
            };
            db.PerfilesPublicos.Add(perfil);
        }
        else
        {
            antes = new { perfil.NombreVisible, perfil.CodigoMunicipio, perfil.ArchivoFotoId };
            perfil.FechaActualizacion = ahora;
            db.PerfilesPublicosPracticas.RemoveRange(db.PerfilesPublicosPracticas.Where(item => item.IdUsuario == usuario.Id));
            db.PerfilesPublicosEnlaces.RemoveRange(db.PerfilesPublicosEnlaces.Where(item => item.IdUsuario == usuario.Id));
        }

        perfil.NombreVisible = nombre!;
        perfil.CodigoMunicipio = municipio;
        perfil.ArchivoFotoId = solicitud.ArchivoFotoId;
        perfil.BiografiaCorta = biografiaCorta;
        perfil.BiografiaLarga = biografiaLarga;
        perfil.Visibilidad = visibilidad;
        perfil.NombreCivilVisible = solicitud.NombreCivilVisible ?? perfil.NombreCivilVisible;
        perfil.RolesJson = roles.Count == 0 ? null : JsonSerializer.Serialize(roles, OpcionesJson);
        perfil.PortafolioJson = portafolio.Count == 0 ? null : JsonSerializer.Serialize(portafolio, OpcionesJson);
        perfil.OrganizacionesVisiblesJson = idsOrganizaciones.Count == 0 ? null : JsonSerializer.Serialize(idsOrganizaciones.Order().ToList(), OpcionesJson);
        foreach (var idPractica in idsPracticas)
            db.PerfilesPublicosPracticas.Add(new PerfilPublicoPracticaRow { IdUsuario = usuario.Id, IdPracticaMusical = idPractica });
        for (var i = 0; i < enlaces.Count; i++)
            db.PerfilesPublicosEnlaces.Add(new PerfilPublicoEnlaceRow { IdUsuario = usuario.Id, Orden = (byte)(i + 1), Url = enlaces[i], Etiqueta = etiquetas[i] });

        Bitacora(db, usuario.Id, usuario.Id, antes is null ? AccionesAuditoria.Crear : AccionesAuditoria.Actualizar, antes,
            new { perfil.NombreVisible, perfil.CodigoMunicipio, perfil.ArchivoFotoId, practicas = idsPracticas, enlaces, perfil.Visibilidad }, ahora);
        // LA BITÁCORA DE ARRIBA YA ESCRIBE SU LÍNEA; el registro de cambios guarda los valores campo por campo.
        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(Modulos.PerfilesPublicosDePersona, usuario.Id.ToString(CultureInfo.InvariantCulture), null, usuario.Id, "Persona", Fecha: ahora),
            CamposDelPerfilPublico.Vigilados, fotoAnterior, perfil, ct, conBitacora: false);
        await db.SaveChangesAsync(ct);

        return Results.Ok(await MiPerfilAsync(db, usuario, ct));
    }

    private static async Task<IResult> PublicarAsync(
        PublicarPerfilPublicoSolicitud solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, httpContext))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();

        if (!await db.PerfilesPublicos.AsNoTracking().AnyAsync(item => item.IdUsuario == usuario.Id, ct))
            return Results.Conflict(new { message = "Guarda primero tu perfil: no se puede publicar algo que todavía no existe." });

        var politica = await RegistroDeAutorizaciones.PoliticaVigenteAsync(db, FinalidadesDeDatos.PerfilPublico, ct);
        if (politica is null)
            return Results.Problem(detail: "El texto de autorización del perfil público no está disponible.", statusCode: StatusCodes.Status503ServiceUnavailable);

        // SE ACEPTA LO QUE SE LEYÓ. Si el texto cambió entre que se mostró y se pulsó, se vuelve a leer.
        if (!string.Equals(solicitud.VersionAceptada, politica.Version, StringComparison.Ordinal))
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["versionAceptada"] = ["El texto de autorización cambió. Léelo de nuevo antes de aceptarlo."],
            });

        if (!await RegistroDeAutorizaciones.EstaVigenteAsync(db, FinalidadesDeDatos.PerfilPublico, usuario.Id, null, ct))
        {
            var ahora = DateTime.UtcNow;
            await RegistroDeAutorizaciones.OtorgarAsync(db, FinalidadesDeDatos.PerfilPublico, "cuenta", ahora,
                usuario.Id, usuario.Email, referenciaId: null, ct);
            Bitacora(db, usuario.Id, usuario.Id, AccionesAuditoria.Publicar, null,
                new { evento = "perfil_publico_autorizado", version = politica.Version }, ahora);
            await db.SaveChangesAsync(ct);
        }

        return Results.Ok(await MiPerfilAsync(db, usuario, ct));
    }

    private static async Task<IResult> OcultarAsync(
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, httpContext))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();

        var ahora = DateTime.UtcNow;
        // OCULTAR ES RETIRAR LA AUTORIZACIÓN, lo mismo que hacerlo desde «Mis autorizaciones».
        var retiradas = await RegistroDeAutorizaciones.RevocarAsync(db, FinalidadesDeDatos.PerfilPublico, ahora,
            "Perfil ocultado por su titular.", usuario.Id, null, ct);
        if (retiradas > 0)
        {
            Bitacora(db, usuario.Id, usuario.Id, AccionesAuditoria.Actualizar, null,
                new { evento = "perfil_publico_retirado" }, ahora);
            await db.SaveChangesAsync(ct);
        }

        return Results.Ok(await MiPerfilAsync(db, usuario, ct));
    }

    /// <summary>
    /// El historial del perfil público, para su titular: qué cambió, cuándo y de qué a qué (ME). Lo lee solo la propia
    /// persona; es su dato.
    /// </summary>
    private static async Task<IResult> LeerMiHistorialAsync(ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();
        var registro = usuario.Id.ToString(CultureInfo.InvariantCulture);
        var filas = await db.CambiosDeRegistro.AsNoTracking()
            .Where(item => item.ModuloId == Modulos.PerfilesPublicosDePersona && item.RegistroId == registro)
            .OrderByDescending(item => item.Fecha).ThenByDescending(item => item.Id)
            .Take(100)
            .ToListAsync(ct);
        return Results.Ok(filas.Select(fila => new CambioDePerfilPublicoDto(
            fila.Fecha, fila.CampoEtiqueta, fila.NombreAnterior ?? fila.ValorAnterior, fila.NombreNuevo ?? fila.ValorNuevo)).ToList());
    }

    private static async Task<IResult> SubirFotoAsync(HttpRequest peticion, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();
        return await BancoDeArchivosEndpoints.SubirFotoPersonalAsync(peticion, db, principal, usuario.Id, ct);
    }

    // ── La consola: moderar sin editar ────────────────────────────────────────────────────────

    private static async Task<IResult> ListarEnConsolaAsync(string? q, SimusDbContext db, CancellationToken ct)
    {
        var consulta = db.PerfilesPublicos.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var texto = q.Trim();
            consulta = consulta.Where(perfil => perfil.NombreVisible.Contains(texto)
                || db.Users.Any(usuario => usuario.Id == perfil.IdUsuario && usuario.Email.Contains(texto)));
        }

        var filas = await consulta
            .OrderByDescending(perfil => perfil.FechaActualizacion ?? perfil.FechaCreacion)
            .Take(200)
            .Select(perfil => new
            {
                perfil.ClavePublica, perfil.NombreVisible, perfil.OcultoPorModeracion, perfil.MotivoModeracion,
                perfil.FechaModeracion, perfil.FechaActualizacion, perfil.FechaCreacion,
                Correo = db.Users.Where(usuario => usuario.Id == perfil.IdUsuario).Select(usuario => usuario.Email).FirstOrDefault(),
                Activa = db.Users.Any(usuario => usuario.Id == perfil.IdUsuario && usuario.IsActive),
                Autorizado = db.AutorizacionesDeDatos.Any(autorizacion => autorizacion.IdUsuario == perfil.IdUsuario
                    && autorizacion.Finalidad == FinalidadesDeDatos.PerfilPublico && autorizacion.FechaRevocacion == null),
            })
            .ToListAsync(ct);

        return Results.Ok(filas.Select(fila => new PerfilPublicoEnModeracionDto(
            fila.ClavePublica, fila.NombreVisible, fila.Correo ?? string.Empty, fila.Autorizado,
            fila.OcultoPorModeracion, fila.MotivoModeracion, fila.FechaModeracion,
            fila.Autorizado && fila.Activa && !fila.OcultoPorModeracion,
            fila.FechaActualizacion ?? fila.FechaCreacion)).ToList());
    }

    private static async Task<IResult> OcultarPorModeracionAsync(
        Guid clave,
        ModeracionDePerfilSolicitud solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, httpContext))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var motivo = string.IsNullOrWhiteSpace(solicitud.Motivo) ? null : ValidationHelpers.SanitizeText(solicitud.Motivo.Trim(), LargoMotivo);
        if (string.IsNullOrWhiteSpace(motivo))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["motivo"] = ["Escribe el motivo: la persona lo verá en su cuenta."] });

        var perfil = await db.PerfilesPublicos.FirstOrDefaultAsync(item => item.ClavePublica == clave, ct);
        if (perfil is null) return Results.NotFound();

        var ahora = DateTime.UtcNow;
        var antes = new { perfil.OcultoPorModeracion, perfil.MotivoModeracion };
        // SOLO SE TOCA EL ESTADO DE MODERACIÓN: la consola no edita el contenido del perfil.
        perfil.OcultoPorModeracion = true;
        perfil.MotivoModeracion = motivo;
        perfil.FechaModeracion = ahora;
        perfil.IdUsuarioModera = Actor(principal);
        Bitacora(db, Actor(principal), perfil.IdUsuario, AccionesAuditoria.Actualizar, antes,
            new { evento = "perfil_publico_ocultado_por_moderacion", motivo }, ahora);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> RestablecerAsync(
        Guid clave,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, httpContext))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var perfil = await db.PerfilesPublicos.FirstOrDefaultAsync(item => item.ClavePublica == clave, ct);
        if (perfil is null) return Results.NotFound();
        if (!perfil.OcultoPorModeracion) return Results.NoContent();

        var ahora = DateTime.UtcNow;
        var antes = new { perfil.OcultoPorModeracion, perfil.MotivoModeracion };
        perfil.OcultoPorModeracion = false;
        perfil.MotivoModeracion = null;
        perfil.FechaModeracion = ahora;
        perfil.IdUsuarioModera = Actor(principal);
        Bitacora(db, Actor(principal), perfil.IdUsuario, AccionesAuditoria.Actualizar, antes,
            new { evento = "perfil_publico_restablecido" }, ahora);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }
}
