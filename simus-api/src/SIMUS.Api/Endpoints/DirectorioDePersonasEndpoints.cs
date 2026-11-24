using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El directorio de personas como BÚSQUEDA (DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13): quién ofrece qué y dónde, y qué perfiles se parecen.
/// </summary>
/// <remarks>
/// <para>
/// <b>SOLO SE INDEXA LO CONSENTIDO.</b> Lee exclusivamente los perfiles que <see cref="PerfilPublicoEndpoints.Visibles"/>
/// (o <see cref="PerfilPublicoEndpoints.VisiblesParaSimus"/> con sesión) declara visibles: sin autorización vigente,
/// moderado o «solo SIMUS» sin sesión no aparece ni en la lista ni como similar. Retirar la autorización lo saca en el acto.
/// </para>
/// <para>
/// <b>PERFILES SIMILARES.</b> Comparten al menos un servicio, rol, instrumento o práctica; la zona solo desempata y suma.
/// Pesos: servicio 3, rol 2, instrumento 2, práctica 1, mismo municipio 2, mismo departamento 1. Nunca la misma persona.
/// </para>
/// </remarks>
public static class DirectorioDePersonasEndpoints
{
    public const int MaximoDeSimilares = 6;

    public const string CriterioDeSimilares =
        "Personas con perfil público que comparten con esta al menos un servicio, un rol, un instrumento o una práctica musical; "
        + "las del mismo municipio o departamento van primero.";

    public static RouteGroupBuilder MapDirectorioDePersonasEndpoints(this RouteGroupBuilder group)
    {
        var publico = group.MapGroup("/publico").WithTags("perfiles-publicos").AllowAnonymous();
        publico.MapGet("/taxonomia-de-perfiles", TaxonomiaAsync).WithName("TaxonomiaDePerfiles");
        publico.MapGet("/personas", ListarAsync).WithName("DirectorioDePersonas");
        publico.MapGet("/directorio-de-personas", PaginaAsync).WithName("PaginaDelDirectorioDePersonas");
        publico.MapGet("/personas/{clave:guid}/similares", SimilaresAsync).WithName("PerfilesSimilares");

        var mio = group.MapGroup("/externo/cuenta/perfil-publico/clasificacion").WithTags("externo-cuenta")
            .RequireAuthorization(SimusAuthentication.ExternalPolicy);
        mio.MapGet(string.Empty, LeerMiaAsync).WithName("MiClasificacionDePerfil");
        mio.MapPut(string.Empty, GuardarMiaAsync).WithName("GuardarMiClasificacionDePerfil");
        return group;
    }

    /// <summary>
    /// La taxonomía leída de la tabla (decisión 133). Trae TAMBIÉN los valores desactivados, con su marca: quien elige no
    /// los ofrece, pero la lista y la ficha los necesitan para decir el nombre de lo que un perfil ya tiene.
    /// </summary>
    private static async Task<IResult> TaxonomiaAsync(SimusDbContext db, CancellationToken ct)
    {
        var filas = await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking()
            .OrderBy(v => v.OrdenVisualizacion).ThenBy(v => v.Nombre).ToListAsync(ct);
        var codigoDe = filas.ToDictionary(v => v.Id, v => v.Codigo);
        List<ValorDeTaxonomiaDto> De(string dimension) => filas.Where(v => v.Dimension == dimension)
            .Select(v => new ValorDeTaxonomiaDto(v.Codigo, v.Nombre, v.GrupoSoyCultura, v.Fuente, v.Activo,
                v.IdPadre is int padre ? codigoDe.GetValueOrDefault(padre) : null)).ToList();
        var todosLosRoles = De(TaxonomiaDePerfiles.DimensionRol);
        var arbol = todosLosRoles.Where(r => r.Padre is null)
            .Select(c => new CategoriaDeRolesDto(c.Codigo, c.Nombre, c.GrupoSoyCultura, c.Fuente, c.Activo,
                todosLosRoles.Where(r => r.Padre == c.Codigo).ToList())).ToList();
        // PLANA EN ORDEN DE ÁRBOL (cada categoría seguida de sus subcategorías): quien lee la lista plana ve la misma jerarquía.
        var roles = arbol.SelectMany(c => new[] { todosLosRoles.First(r => r.Codigo == c.Codigo) }.Concat(c.Subcategorias)).ToList();
        return Results.Ok(new TaxonomiaDePerfilesDto(
            roles, De(TaxonomiaDePerfiles.DimensionServicio), De(TaxonomiaDePerfiles.DimensionInstrumento),
            TaxonomiaDePerfiles.MaximoDeRoles, TaxonomiaDePerfiles.MaximoDeServicios,
            TaxonomiaDePerfiles.MaximoDeInstrumentos, TaxonomiaDePerfiles.MaximoDeTerritorios)
        { RolesPorCategoria = arbol });
    }

    private static async Task<bool> HayCuentaDeSimusAsync(HttpContext http)
    {
        if ((await http.AuthenticateAsync(SimusAuthentication.ExternalScheme)).Succeeded) return true;
        return (await http.AuthenticateAsync(SimusAuthentication.InstitutionalScheme)).Succeeded;
    }

    private static IQueryable<PerfilPublicoRow> Alcance(SimusDbContext db, bool conCuenta) =>
        conCuenta ? PerfilPublicoEndpoints.VisiblesParaSimus(db) : PerfilPublicoEndpoints.Visibles(db);

    /// <summary>Carga las personas visibles con su clasificación, en pocas consultas.</summary>
    public static async Task<List<PersonaDelDirectorioDto>> CargarAsync(SimusDbContext db, IQueryable<PerfilPublicoRow> visibles, CancellationToken ct)
    {
        var perfiles = await visibles.OrderBy(p => p.NombreVisible).ToListAsync(ct);
        var ids = perfiles.Select(p => p.IdUsuario).ToList();
        var clasificaciones = await db.PerfilesPublicosClasificaciones.AsNoTracking()
            .Where(c => ids.Contains(c.IdUsuario)).ToListAsync(ct);
        var practicas = await db.PerfilesPublicosPracticas.AsNoTracking().Where(p => ids.Contains(p.IdUsuario))
            .Join(db.PracticasMusicales.AsNoTracking(), p => p.IdPracticaMusical, m => m.Id, (p, m) => new { p.IdUsuario, m.Nombre })
            .ToListAsync(ct);
        var municipios = perfiles.Select(p => p.CodigoMunicipio).Where(c => !string.IsNullOrEmpty(c)).Distinct().ToList();
        var lugares = await db.DivipolaLocations.AsNoTracking().Where(l => municipios.Contains(l.MunicipalityCode))
            .Select(l => new { l.MunicipalityCode, l.MunicipalityName, l.DepartmentName }).ToListAsync(ct);
        var departamentos = await db.DivipolaLocations.AsNoTracking()
            .Select(l => new { l.DepartmentCode, l.DepartmentName }).Distinct().ToListAsync(ct);
        var nombreDeDepartamento = departamentos.ToDictionary(d => d.DepartmentCode, d => d.DepartmentName);

        return perfiles.Select(perfil =>
        {
            var propias = clasificaciones.Where(c => c.IdUsuario == perfil.IdUsuario).ToList();
            List<string> De(string dimension) => propias.Where(c => c.Dimension == dimension).Select(c => c.Codigo).Order().ToList();
            var lugar = lugares.FirstOrDefault(l => l.MunicipalityCode == perfil.CodigoMunicipio);
            var roles = De(TaxonomiaDePerfiles.DimensionRol);
            var servicios = De(TaxonomiaDePerfiles.DimensionServicio);
            return new PersonaDelDirectorioDto(
                perfil.ClavePublica, perfil.NombreVisible,
                perfil.ArchivoFotoId is int foto ? "/api/v1/publico/archivos/" + foto.ToString(CultureInfo.InvariantCulture) : null,
                perfil.BiografiaCorta, lugar?.MunicipalityName, lugar?.DepartmentName,
                roles, servicios, De(TaxonomiaDePerfiles.DimensionInstrumento),
                practicas.Where(p => p.IdUsuario == perfil.IdUsuario).Select(p => p.Nombre).Order().ToList(),
                De(TaxonomiaDePerfiles.DimensionTerritorio).Select(c => nombreDeDepartamento.GetValueOrDefault(c) ?? c).Order().ToList(),
                // «PENDIENTE DE COMPLETAR»: sin roles ni servicios no hay por qué encontrarla.
                roles.Count > 0 || servicios.Count > 0);
        }).ToList();
    }

    private static async Task<IResult> ListarAsync(HttpContext http, SimusDbContext db, CancellationToken ct) =>
        Results.Ok(await CargarAsync(db, Alcance(db, await HayCuentaDeSimusAsync(http)), ct));

    /// <summary>
    /// El directorio de agentes y actores paginado, con filtros y conteo por opción. Las listas llegan separadas por comas
    /// (`rol=luthier,docente`). Mismo alcance que la lista completa: solo lo que cada persona publicó con su consentimiento.
    /// </summary>
    private static async Task<IResult> PaginaAsync(
        HttpContext http, SimusDbContext db, CancellationToken ct,
        string? q = null, string? categoria = null, string? rol = null, string? servicio = null,
        string? instrumento = null, string? practica = null, string? departamento = null, string? municipio = null,
        string? actua = null, string? orden = null, int? pagina = null, int? porPagina = null)
    {
        var todas = await CargarAsync(db, Alcance(db, await HayCuentaDeSimusAsync(http)), ct);
        var filas = await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking()
            .OrderBy(v => v.OrdenVisualizacion).ThenBy(v => v.Nombre).ToListAsync(ct);
        var codigoDe = filas.ToDictionary(v => v.Id, v => v.Codigo);
        var roles = filas.Where(v => v.Dimension == TaxonomiaDePerfiles.DimensionRol).ToList();
        var taxonomia = new TaxonomiaDeNombres(
            roles.ToDictionary(v => v.Codigo, v => v.Nombre),
            filas.Where(v => v.Dimension == TaxonomiaDePerfiles.DimensionServicio).ToDictionary(v => v.Codigo, v => v.Nombre),
            filas.Where(v => v.Dimension == TaxonomiaDePerfiles.DimensionInstrumento).ToDictionary(v => v.Codigo, v => v.Nombre),
            roles.ToDictionary(v => v.Codigo, v => v.IdPadre is int padre ? codigoDe.GetValueOrDefault(padre, v.Codigo) : v.Codigo),
            roles.Where(v => v.IdPadre is null).SelectMany(c => new[] { c.Codigo }
                .Concat(roles.Where(h => h.IdPadre == c.Id).Select(h => h.Codigo))).ToList());

        var parametros = new ParametrosDelDirectorioDePersonas(
            Recortar(q, 120), Lista(categoria), Lista(rol), Lista(servicio), Lista(instrumento), Lista(practica),
            Recortar(departamento, 120), Recortar(municipio, 120), Recortar(actua, 120),
            orden == ConsultaDelDirectorioDePersonas.OrdenPorTerritorio ? orden : ConsultaDelDirectorioDePersonas.OrdenPorNombre,
            pagina ?? 1, porPagina ?? ConsultaDelDirectorioDePersonas.PorPaginaPorOmision);
        return Results.Ok(ConsultaDelDirectorioDePersonas.Ejecutar(todas, parametros, taxonomia));
    }

    private static string? Recortar(string? valor, int largo) =>
        string.IsNullOrWhiteSpace(valor) ? null : valor.Trim()[..Math.Min(valor.Trim().Length, largo)];

    private static List<string> Lista(string? csv) =>
        (csv ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(v => v[..Math.Min(v.Length, 120)]).Distinct().Take(30).ToList();

    private static async Task<IResult> SimilaresAsync(Guid clave, HttpContext http, SimusDbContext db, CancellationToken ct)
    {
        var todas = await CargarAsync(db, Alcance(db, await HayCuentaDeSimusAsync(http)), ct);
        var base_ = todas.FirstOrDefault(p => p.Clave == clave);
        var filas = await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking().ToListAsync(ct);
        var nombres = filas.ToDictionary(v => (v.Dimension, v.Codigo), v => v.Nombre);
        // La categoría de cada rol: la de su padre; una categoría sin hijas (o un rol sin padre) es su propia categoría.
        var codigoDe = filas.ToDictionary(v => v.Id, v => v.Codigo);
        var categoriaDe = filas.Where(v => v.Dimension == TaxonomiaDePerfiles.DimensionRol)
            .ToDictionary(v => v.Codigo, v => v.IdPadre is int padre ? codigoDe.GetValueOrDefault(padre, v.Codigo) : v.Codigo);
        // 404 SIN CUERPO: igual que la ficha, no revela que haya un perfil oculto.
        if (base_ is null) return Results.NotFound();

        var similares = todas
            .Where(otra => otra.Clave != clave)
            .Select(otra => Comparar(base_, otra, nombres, categoriaDe))
            .Where(r => r.Coincidencias.Count > 0)
            .OrderByDescending(r => r.Puntos).ThenBy(r => r.Persona.NombreVisible, StringComparer.CurrentCultureIgnoreCase)
            .Take(MaximoDeSimilares)
            .Select(r => new PersonaSimilarDto(r.Persona, r.Coincidencias))
            .ToList();
        return Results.Ok(new PerfilesSimilaresDto(base_, CriterioDeSimilares, similares));
    }

    private static (PersonaDelDirectorioDto Persona, int Puntos, List<string> Coincidencias) Comparar(
        PersonaDelDirectorioDto a, PersonaDelDirectorioDto b, IReadOnlyDictionary<(string Dimension, string Codigo), string> nombres,
        IReadOnlyDictionary<string, string> categoriaDe)
    {
        var coincidencias = new List<string>();
        var puntos = 0;
        void Sumar(IEnumerable<string> propias, IEnumerable<string> ajenas, string dimension, int peso)
        {
            foreach (var codigo in propias.Intersect(ajenas))
            {
                coincidencias.Add(nombres.GetValueOrDefault((dimension, codigo)) ?? codigo);
                puntos += peso;
            }
        }
        Sumar(a.Servicios, b.Servicios, TaxonomiaDePerfiles.DimensionServicio, 3);
        Sumar(a.Roles, b.Roles, TaxonomiaDePerfiles.DimensionRol, 2);
        // MISMA CATEGORÍA, OTRA SUBCATEGORÍA (decisión 135): se parecen sin ser lo mismo; suma 1 y solo si no comparten ya el rol.
        var categoriasCompartidas = a.Roles.Select(r => categoriaDe.GetValueOrDefault(r, r)).Distinct()
            .Intersect(b.Roles.Select(r => categoriaDe.GetValueOrDefault(r, r)))
            .Where(c => !a.Roles.Intersect(b.Roles).Any(r => categoriaDe.GetValueOrDefault(r, r) == c));
        foreach (var categoria in categoriasCompartidas)
        {
            coincidencias.Add("Misma categoría: " + (nombres.GetValueOrDefault((TaxonomiaDePerfiles.DimensionRol, categoria)) ?? categoria));
            puntos += 1;
        }
        Sumar(a.Instrumentos, b.Instrumentos, TaxonomiaDePerfiles.DimensionInstrumento, 2);
        foreach (var practica in a.Practicas.Intersect(b.Practicas)) { coincidencias.Add(practica); puntos += 1; }
        // LA ZONA SOLO SUMA SI YA HAY ALGO EN COMÚN: dos personas del mismo municipio sin nada parecido no son similares.
        if (coincidencias.Count > 0)
        {
            if (a.Municipio is not null && a.Municipio == b.Municipio && a.Departamento == b.Departamento) puntos += 2;
            else if (a.Departamento is not null && a.Departamento == b.Departamento) puntos += 1;
        }
        return (b, puntos, coincidencias);
    }

    // ── La persona sobre su propia clasificación ─────────────────────────────────────────────

    private static int Actor(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : 0;

    private static async Task<MiClasificacionDto> MiaAsync(SimusDbContext db, int idUsuario, CancellationToken ct)
    {
        var existe = await db.PerfilesPublicos.AsNoTracking().AnyAsync(p => p.IdUsuario == idUsuario, ct);
        var filas = await db.PerfilesPublicosClasificaciones.AsNoTracking().Where(c => c.IdUsuario == idUsuario).ToListAsync(ct);
        List<string> De(string d) => filas.Where(c => c.Dimension == d).Select(c => c.Codigo).Order().ToList();
        var roles = De(TaxonomiaDePerfiles.DimensionRol);
        var servicios = De(TaxonomiaDePerfiles.DimensionServicio);
        return new MiClasificacionDto(existe, roles, servicios, De(TaxonomiaDePerfiles.DimensionInstrumento),
            De(TaxonomiaDePerfiles.DimensionTerritorio), roles.Count == 0 && servicios.Count == 0);
    }

    private static async Task<IResult> LeerMiaAsync(ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var id = Actor(principal);
        return id <= 0 ? Results.Unauthorized() : Results.Ok(await MiaAsync(db, id, ct));
    }

    private static async Task<IResult> GuardarMiaAsync(
        ClasificacionSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });
        var id = Actor(principal);
        if (id <= 0) return Results.Unauthorized();
        if (!await db.PerfilesPublicos.AnyAsync(p => p.IdUsuario == id, ct))
            return Results.Conflict(new { message = "Guarda primero tu perfil: la clasificación es parte de él." });

        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var valida = await ValidarAsync(db, solicitud, errores, ct, id);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        // SE REEMPLAZA LA SELECCIÓN DE LA PERSONA SOBRE SU PROPIO PERFIL; la bitácora general registra la actualización.
        db.PerfilesPublicosClasificaciones.RemoveRange(db.PerfilesPublicosClasificaciones.Where(c => c.IdUsuario == id));
        Poner(db, id, valida);
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = id, TableName = "PerfilesPublicosClasificaciones", RecordId = id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Actualizar,
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(valida),
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
        return Results.Ok(await MiaAsync(db, id, ct));
    }

    /// <summary>Lo que la persona eligió, ya normalizado y validado contra la taxonomía.</summary>
    public sealed record ClasificacionValida(List<string> Roles, List<string> Servicios, List<string> Instrumentos, List<string> Territorios)
    {
        public bool EstaVacia => Roles.Count + Servicios.Count + Instrumentos.Count + Territorios.Count == 0;
    }

    /// <summary>
    /// Valida una selección (la del perfil o la del registro); los errores se acumulan en <paramref name="errores"/>.
    /// </summary>
    /// <remarks>
    /// <b>SOLO SE ELIGE LO ACTIVO, PERO NADA SE LE QUITA A QUIEN YA LO TENÍA.</b> Un valor desactivado desde el Catálogo
    /// deja de ofrecerse; si la persona ya lo tenía guardado (<paramref name="idUsuario"/>), puede volver a guardar su
    /// perfil sin que la selección se rechace por un valor que ella no cambió.
    /// </remarks>
    public static async Task<ClasificacionValida> ValidarAsync(
        SimusDbContext db, ClasificacionSolicitud? solicitud, Dictionary<string, string[]> errores, CancellationToken ct, int? idUsuario = null)
    {
        solicitud ??= new ClasificacionSolicitud();
        var activos = (await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking().Where(v => v.Activo)
            .Select(v => new { v.Dimension, v.Codigo }).ToListAsync(ct))
            .Select(v => (v.Dimension, v.Codigo)).ToHashSet();
        var conservados = idUsuario is int usuario
            ? (await db.PerfilesPublicosClasificaciones.AsNoTracking().Where(c => c.IdUsuario == usuario)
                .Select(c => new { c.Dimension, c.Codigo }).ToListAsync(ct)).Select(c => (c.Dimension, c.Codigo)).ToHashSet()
            : [];
        // JERARQUÍA DE ROLES (decisión 135): una subcategoría se ofrece solo si ella y su categoría están activas, y una
        // categoría con subcategorías no se elige sola: se elige una de sus subcategorías.
        var roles_ = await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking().Where(v => v.Dimension == TaxonomiaDePerfiles.DimensionRol)
            .Select(v => new { v.Id, v.Codigo, v.Nombre, v.Activo, v.IdPadre }).ToListAsync(ct);
        var inactivasPorPadre = roles_.Where(h => h.IdPadre is not null && roles_.Any(p => p.Id == h.IdPadre && !p.Activo)).Select(h => h.Codigo).ToHashSet();
        activos.ExceptWith(inactivasPorPadre.Select(c => (TaxonomiaDePerfiles.DimensionRol, c)));
        var conSubcategorias = roles_.Where(c => roles_.Any(h => h.IdPadre == c.Id)).ToDictionary(c => c.Codigo, c => c.Nombre);
        List<string> Validar(List<string>? crudos, string dimension, string campo)
        {
            var lista = (crudos ?? []).Select(c => c.Trim()).Where(c => c.Length > 0).Distinct().ToList();
            var categoriaSola = dimension == TaxonomiaDePerfiles.DimensionRol
                ? lista.FirstOrDefault(c => conSubcategorias.ContainsKey(c) && !conservados.Contains((dimension, c))) : null;
            if (categoriaSola is not null) errores[campo] = [$"Elige una subcategoría de «{conSubcategorias[categoriaSola]}»."];
            else if (lista.Any(c => !activos.Contains((dimension, c)) && !conservados.Contains((dimension, c)))) errores[campo] = ["Elige solo valores de la lista."];
            else if (lista.Count > TaxonomiaDePerfiles.Maximo(dimension)) errores[campo] = [$"Elige como máximo {TaxonomiaDePerfiles.Maximo(dimension)}."];
            return lista;
        }
        var roles = Validar(solicitud.Roles, TaxonomiaDePerfiles.DimensionRol, "roles");
        var servicios = Validar(solicitud.Servicios, TaxonomiaDePerfiles.DimensionServicio, "servicios");
        var instrumentos = Validar(solicitud.Instrumentos, TaxonomiaDePerfiles.DimensionInstrumento, "instrumentos");
        var territorios = (solicitud.CodigosDeDepartamento ?? []).Select(c => c.Trim()).Where(c => c.Length > 0).Distinct().ToList();
        if (territorios.Count > TaxonomiaDePerfiles.MaximoDeTerritorios) errores["codigosDeDepartamento"] = [$"Elige como máximo {TaxonomiaDePerfiles.MaximoDeTerritorios} departamentos."];
        else if (territorios.Count > 0)
        {
            var conocidos = await db.DivipolaLocations.AsNoTracking().Where(l => territorios.Contains(l.DepartmentCode))
                .Select(l => l.DepartmentCode).Distinct().CountAsync(ct);
            if (conocidos != territorios.Count) errores["codigosDeDepartamento"] = ["Elige departamentos del catálogo."];
        }
        return new ClasificacionValida(roles, servicios, instrumentos, territorios);
    }

    /// <summary>Añade las filas de la selección; quien llama guarda.</summary>
    public static void Poner(SimusDbContext db, int idUsuario, ClasificacionValida valida)
    {
        void Una(string dimension, IEnumerable<string> codigos)
        {
            foreach (var codigo in codigos)
                db.PerfilesPublicosClasificaciones.Add(new PerfilPublicoClasificacionRow { IdUsuario = idUsuario, Dimension = dimension, Codigo = codigo });
        }
        Una(TaxonomiaDePerfiles.DimensionRol, valida.Roles);
        Una(TaxonomiaDePerfiles.DimensionServicio, valida.Servicios);
        Una(TaxonomiaDePerfiles.DimensionInstrumento, valida.Instrumentos);
        Una(TaxonomiaDePerfiles.DimensionTerritorio, valida.Territorios);
    }
}
