using System.Security.Claims;
using System.Data;
using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Reclamar la administración de un Festival histórico sin organización.
/// </summary>
/// <remarks>
/// <para>
/// <b>EL RECORRIDO.</b> Los administradores del sistema cargan los Festivales históricos mapeados
/// sin organización (responde la entidad institucional). Una organización los encuentra —en el
/// asistente de alta o en «¿Tu Festival ya está en SIMUS?»— y pide administrarlos; la consola
/// aprueba, rechaza o pide una aclaración; si lo que la organización propone cambia datos del
/// histórico, la organización elige qué conservar y entonces se transfiere. Si no cambia nada, la
/// aprobación transfiere de inmediato.
/// </para>
/// <para>
/// No modifica versiones ni el circuito de revisión del Festival: solo quién lo administra y, al
/// conciliar, los campos de contacto y descripción que la consola vio antes de aprobar.
/// </para>
/// </remarks>
public static partial class ReclamacionesAdministracionEndpoints
{
    private const string Festival = Modulos.Festivales;
    internal static readonly string[] Activas = ["borrador", "enviada", "en_revision", "requiere_aclaracion", "aclaracion_enviada", "aprobada"];
    private static readonly string[] Decidibles = ["enviada", "en_revision", "aclaracion_enviada"];
    private const int MaximoDeCoincidencias = 10;
    private const int MaximoDeHistoricos = 60;

    /// <summary>Cuántos soportes admite una solicitud, sumando los de las aclaraciones (REC-16).</summary>
    internal const int MaximoDeSoportes = 5;

    /// <summary>El rol con el que un soporte cuelga de la solicitud en <c>dbo.ArchivosDeRegistro</c>.</summary>
    private const string RolSoporte = "soporte";

    /// <summary>Los campos que se concilian: clave del histórico, clave del borrador y rótulo.</summary>
    private static readonly (string Historico, string Borrador, string Etiqueta)[] Campos =
    [
        ("Name", "nombre", "Nombre"),
        ("Description", "descripcion", "Descripción"),
        ("ContactEmail", "correoContacto", "Correo de contacto"),
        ("ContactPhone", "telefonoCelular", "Teléfono"),
        ("InstagramUrl", "instagram", "Instagram"),
        ("FacebookUrl", "facebook", "Facebook"),
        ("WebsiteUrl", "paginaWeb", "Página web"),
        ("OtherUrl", "otroEnlace", "Otro enlace"),
        ("Periodicidad", "periodicidad", "Periodicidad"),
    ];

    public static RouteGroupBuilder MapReclamacionesAdministracionEndpoints(this RouteGroupBuilder api)
    {
        var externo = api.MapGroup("/externo").WithTags("reclamaciones-administracion").RequireAuthorization(SimusAuthentication.ExternalPolicy);
        externo.MapGet("/organizaciones/{organizacionId:int}/festivales/borrador", ObtenerOCrearBorrador);
        // EL MERCADO TAMBIÉN AUTOGUARDA, en la misma tabla y con el mismo PUT por
        // identificador. Lo que cambia es el módulo del borrador.
        externo.MapGet("/organizaciones/{organizacionId:int}/mercados/borrador", ObtenerOCrearBorradorDeMercado);
        // LOS REGISTROS SIN TERMINAR, A LA VISTA: la lista y el resumen los ofrecen con
        // «Continuar» y «Descartar» en lugar de dejarlos invisibles.
        externo.MapGet("/organizaciones/{organizacionId:int}/borradores-pendientes", ListarBorradoresPendientes);
        externo.MapDelete("/borradores-proceso/{id:long}", DescartarBorrador);
        externo.MapGet("/organizaciones/{organizacionId:int}/festivales/coincidencias-historicas", BuscarCoincidencias);
        externo.MapGet("/organizaciones/{organizacionId:int}/festivales/historicos", ListarHistoricos);
        // PROCESOS HISTÓRICOS (decisión 129): Festivales y Mercados sin organización, sin lista por defecto.
        externo.MapGet("/organizaciones/{organizacionId:int}/procesos-historicos", BuscarProcesosHistoricos);
        externo.MapPut("/borradores-proceso/{id:long}", GuardarBorrador);
        externo.MapPost("/organizaciones/{organizacionId:int}/reclamaciones-administracion", Crear);
        externo.MapGet("/organizaciones/{organizacionId:int}/reclamaciones-administracion", ListarPropias);
        externo.MapPost("/reclamaciones-administracion/{id:long}/aclaraciones/responder", ResponderAclaracion);
        externo.MapPost("/reclamaciones-administracion/{id:long}/cancelar", Cancelar);
        externo.MapGet("/reclamaciones-administracion/{id:long}/conciliacion", ObtenerConciliacion);
        externo.MapPost("/reclamaciones-administracion/{id:long}/conciliacion/resolver", ResolverConciliacion);

        var institucional = api.MapGroup("/institucional/reclamaciones-administracion").WithTags("reclamaciones-administracion").RequireAuthorization(Permisos.PoliticaFuncionario)
            // una reclamación decide quién administra un Festival: es trabajo del Ecosistema.
            .ExigeModulo("ecosistema");
        institucional.MapGet(string.Empty, ListarInstitucional);
        institucional.MapGet("/{id:long}", Detalle);
        institucional.MapPost("/{id:long}/aclaraciones", PedirAclaracion);
        institucional.MapPost("/{id:long}/decision", Decidir);
        return api;
    }

    // ---------- Descubrir --------------------------------------------------------------------

    /// <summary>
    /// Los Festivales que ya existen y se parecen al que se está registrando.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>DOS PREGUNTAS DISTINTAS</b>, y la distinción viaja en <c>TipoCoincidencia</c>: ¿existe
    /// como registro histórico sin dueño? (se puede RECLAMAR) y ¿ya lo registró alguien? (no se
    /// registra dos veces). De los ajenos solo se enseñan los PUBLICADOS: el borrador de otra
    /// organización no es público. De los propios, todos.
    /// </para>
    /// <para>
    /// <b>EL MUNICIPIO ORDENA, NO FILTRA.</b> Antes un Festival registrado en otro
    /// municipio del mismo departamento no aparecía nunca, y con alcance departamental o nacional el
    /// asistente ni preguntaba. El parecido se mide por palabras (<see cref="ParecidoDeNombres"/>).
    /// </para>
    /// <para>NO BLOQUEA. Avisar no es impedir: quien registra es quien sabe.</para>
    /// </remarks>
    private static async Task<IResult> BuscarCoincidencias(int organizacionId, string? nombre, string? codigoDepartamento, string? codigoMunicipio, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        if (!await Edita(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        if (string.IsNullOrWhiteSpace(nombre) || string.IsNullOrWhiteSpace(codigoDepartamento)) return Results.Ok(Array.Empty<CoincidenciaFestivalHistoricoDto>());
        if (ParecidoDeNombres.Normalizar(nombre).Length < 3) return Results.Ok(Array.Empty<CoincidenciaFestivalHistoricoDto>());

        var institucional = await IdInstitucionalAsync(db, ct);
        // SOLO LO QUE HACE FALTA PARA PUNTUAR. Antes se traía la descripción de todos los Festivales
        // publicados del departamento y el nombre de su organización, para quedarse con diez. Ahora
        // se puntúa con lo mínimo y el resto se pide solo para los que se enseñan.
        // Los registrados SIN departamento (alcance nacional) también cuentan: el territorio ordena,
        // no filtra (REC-06), y antes quedaban fuera aunque fueran el mismo Festival.
        var candidatos = await db.FestivalRecords.AsNoTracking()
            .Where(x => x.FusionadoEnId == null)
            // EL TERRITORIO DE UN FESTIVAL ES SU COBERTURA Y, SI NO TIENE, SU SEDE (D-06). Los generados para el
            // mapa solo traen la sede: mirar solo `DepartmentCode` los trataba como «sin departamento» y los
            // dejaba pasar aunque estuvieran en otro, y el aviso decía «en este territorio» sin haberlo
            // comprobado. Solo pasan los del departamento pedido y los que no tienen territorio alguno
            // (alcance nacional sin sede), que el territorio ordena y no filtra (REC-06).
            .Where(x => (x.DepartmentCode ?? x.SedeCodigoDepartamento) == codigoDepartamento
                || (x.DepartmentCode == null && x.SedeCodigoDepartamento == null))
            .Where(x => x.OrganizacionPrincipalId == organizacionId
                || x.StatusCode == EstadosFestival.Publicado
                || x.StatusCode == "Publicado")
            .Select(x => new
            {
                x.Id, x.Name,
                DepartmentCode = x.DepartmentCode ?? x.SedeCodigoDepartamento,
                MunicipalityCode = x.DepartmentCode != null ? x.MunicipalityCode : x.SedeCodigoMunicipio,
                x.OrganizacionPrincipalId,
            })
            .ToListAsync(ct);

        // EL TERRITORIO RESPALDA LAS SIGLAS (COI2): «FIMC» solo avisa de un Festival del mismo
        // departamento (o municipio), no de uno nacional ni de otro departamento; y una sigla que
        // corresponde a varios Festivales distintos es ambigua y no avisa de ninguno.
        var parecidos = ParecidoDeNombres.Puntuar(nombre, candidatos, x => x.Name,
                x => ParecidoDeNombres.RespaldoDe(codigoDepartamento, codigoMunicipio, x.DepartmentCode, x.MunicipalityCode))
            .Select(x => (Fila: x.Item, x.Puntaje, x.Razon))
            // LOS RECLAMABLES PRIMERO —son los únicos sobre los que hay algo que hacer aquí—, luego
            // los del mismo municipio y luego los más parecidos.
            .OrderBy(x => institucional is not null && x.Fila.OrganizacionPrincipalId == institucional ? 0 : 1)
            .ThenBy(x => string.IsNullOrWhiteSpace(codigoMunicipio) || x.Fila.MunicipalityCode == codigoMunicipio ? 0 : 1)
            .ThenByDescending(x => x.Puntaje)
            .ThenBy(x => x.Fila.Name, StringComparer.OrdinalIgnoreCase)
            .Take(MaximoDeCoincidencias)
            .ToList();

        var idsNumericos = parecidos.Select(x => x.Fila.Id).ToArray();
        var ids = idsNumericos.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray();
        var descripciones = idsNumericos.Length == 0 ? new Dictionary<int, string?>()
            : await db.FestivalRecords.AsNoTracking().Where(x => idsNumericos.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => (string?)x.Description, ct);
        var idsOrganizacion = parecidos.Select(x => x.Fila.OrganizacionPrincipalId).Where(x => x != null).Select(x => x!.Value).Distinct().ToArray();
        var organizaciones = idsOrganizacion.Length == 0 ? new Dictionary<int, string>()
            : await db.EntityProfiles.AsNoTracking().Where(x => idsOrganizacion.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var enCurso = ids.Length == 0 ? [] : (await db.AdministrationClaims.AsNoTracking()
            .Where(x => x.ModuloId == Festival && ids.Contains(x.CanonicalRecordId) && Activas.Contains(x.Status))
            .Select(x => new { x.CanonicalRecordId, x.RequestingOrganizationId }).ToListAsync(ct))
            .GroupBy(x => x.CanonicalRecordId).ToDictionary(g => g.Key, g => g.First().RequestingOrganizationId);
        var lugares = await LugaresAsync(db, parecidos.Select(x => x.Fila.DepartmentCode), ct);

        var resultado = parecidos
            .Select(x =>
            {
                var fila = x.Fila;
                var id = fila.Id.ToString(CultureInfo.InvariantCulture);
                var organizacion = fila.OrganizacionPrincipalId is int org ? organizaciones.GetValueOrDefault(org) : null;
                var esInstitucional = institucional is not null && fila.OrganizacionPrincipalId == institucional;
                var esPropio = fila.OrganizacionPrincipalId == organizacionId;
                var reclamado = esInstitucional && enCurso.ContainsKey(id);
                var reclamadoPorEsta = reclamado && enCurso[id] == organizacionId;
                var (departamento, municipio) = Lugar(lugares, fila.DepartmentCode, fila.MunicipalityCode);
                // «EN ESTE TERRITORIO» SOLO SI SE COMPROBÓ (D-06): el departamento del Festival es el pedido.
                // Sin territorio registrado se dice tal cual, para que la persona decida con lo que sí se sabe.
                var dondeEsta = fila.DepartmentCode is null
                    ? "(sin territorio registrado: alcance nacional)"
                    : "en este territorio";
                var evidencias = new List<string>
                {
                    esInstitucional
                        ? reclamadoPorEsta
                            ? "Tu organización ya pidió administrar este Festival del registro histórico. Sigue la solicitud en Solicitudes."
                        : reclamado
                            ? "Es un Festival del registro histórico y ya hay una solicitud para administrarlo en revisión. Si también es tuyo, espera a que se resuelva o escríbele al PNMC."
                            : "Coincide con un Festival del registro histórico, que todavía no tiene organización administradora. Si es el tuyo, puedes solicitar su administración."
                        : esPropio
                            ? $"Tu organización ya tiene registrado un Festival con un nombre parecido {dondeEsta}. Revísalo antes de crear otro."
                            : $"Ya hay un Festival registrado con un nombre parecido {dondeEsta}, administrado por {organizacion ?? "otra organización"}. Si es el mismo, no lo registres de nuevo.",
                };
                if (x.Razon is { } razon) evidencias.Add(razon);
                if (!string.IsNullOrWhiteSpace(codigoMunicipio) && fila.MunicipalityCode != codigoMunicipio)
                    evidencias.Add(municipio is null ? "Está registrado sin municipio, con alcance más amplio." : $"Está registrado en otro municipio: {municipio}.");
                return new CoincidenciaFestivalHistoricoDto(
                    id, fila.Name, descripciones.GetValueOrDefault(fila.Id),
                    fila.DepartmentCode, departamento, fila.MunicipalityCode, municipio,
                    esInstitucional ? null : organizacion,
                    esInstitucional ? "HistoricoReclamable" : esPropio ? "YaRegistradoPorTuOrganizacion" : "YaRegistradoPorOtraOrganizacion",
                    evidencias, reclamado);
            })
            .ToList();
        return Results.Ok(resultado);
    }

    /// <summary>
    /// «¿Tu Festival ya está en SIMUS?»: los históricos sin organización de un departamento.
    /// </summary>
    /// <remarks>
    /// <b>EL DESCUBRIMIENTO NO PUEDE DEPENDER DE ESCRIBIR EL NOMBRE EXACTO.</b> Antes,
    /// el histórico solo aparecía al final del paso 3 del asistente y si el nombre coincidía casi
    /// letra a letra. Esta lista se ofrece en Festivales: por defecto, el departamento de la sede de
    /// la organización; con <c>buscar</c>, los que se parecen; con <c>codigoDepartamento=todos</c>,
    /// el país entero.
    /// </remarks>
    private static async Task<IResult> ListarHistoricos(int organizacionId, string? buscar, string? codigoDepartamento, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        if (!await Edita(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var institucional = await IdInstitucionalAsync(db, ct);
        string? departamento = string.Equals(codigoDepartamento, "todos", StringComparison.OrdinalIgnoreCase) ? null
            : !string.IsNullOrWhiteSpace(codigoDepartamento) ? codigoDepartamento.Trim()
            : await db.EntityProfiles.AsNoTracking().Where(x => x.Id == organizacionId).Select(x => x.HeadquartersDepartmentCode).FirstOrDefaultAsync(ct);
        var nombreDepartamento = departamento is null ? null
            : await db.DivipolaLocations.AsNoTracking().Where(x => x.DepartmentCode == departamento).Select(x => x.DepartmentName).FirstOrDefaultAsync(ct);
        if (institucional is null) return Results.Ok(new HistoricosReclamablesDto(departamento, nombreDepartamento, []));

        var consulta = db.FestivalRecords.AsNoTracking()
            .Where(x => x.OrganizacionPrincipalId == institucional && (x.StatusCode == EstadosFestival.Publicado || x.StatusCode == "Publicado"));
        if (departamento is not null) consulta = consulta.Where(x => x.DepartmentCode == departamento);
        // SIN LA DESCRIPCIÓN, QUE PUEDE SER LARGA: se pide solo para los que se enseñan.
        var filas = await consulta
            .Select(x => new { x.Id, x.Name, x.CoverageLevel, x.DepartmentCode, x.MunicipalityCode, x.Periodicidad })
            .ToListAsync(ct);

        var texto = ParecidoDeNombres.Normalizar(buscar);
        // SI LA LISTA SE LIMITA A UN DEPARTAMENTO, ESE DEPARTAMENTO RESPALDA LAS SIGLAS (COI2); con
        // «todos» (el país entero) no hay respaldo y «FIMC» no avisa de nadie.
        var puntajes = texto.Length == 0 ? new Dictionary<int, int>()
            : ParecidoDeNombres.Puntuar(buscar, filas, x => x.Name,
                    x => ParecidoDeNombres.RespaldoDe(departamento, null, x.DepartmentCode, x.MunicipalityCode))
                .ToDictionary(x => x.Item.Id, x => x.Puntaje);
        var elegidos = filas
            .Select(x => (Fila: x, Puntaje: texto.Length == 0 ? 1
                : Math.Max(puntajes.GetValueOrDefault(x.Id),
                    ParecidoDeNombres.Normalizar(x.Name).Contains(texto, StringComparison.Ordinal) ? 2 : 0)))
            .Where(x => x.Puntaje > 0)
            .OrderByDescending(x => x.Puntaje)
            .ThenBy(x => x.Fila.Name, StringComparer.OrdinalIgnoreCase)
            .Take(MaximoDeHistoricos)
            .Select(x => x.Fila)
            .ToList();

        var ids = elegidos.Select(x => x.Id).ToArray();
        var textos = ids.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray();
        var descripciones = ids.Length == 0 ? new Dictionary<int, string?>()
            : await db.FestivalRecords.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => (string?)x.Description, ct);
        var anios = ids.Length == 0 ? new Dictionary<int, List<int>>()
            : (await db.EdicionesFestival.AsNoTracking().Where(x => ids.Contains(x.FestivalId) && x.Anio != null)
                .Select(x => new { x.FestivalId, Anio = x.Anio!.Value }).ToListAsync(ct))
                .GroupBy(x => x.FestivalId).ToDictionary(g => g.Key, g => g.Select(x => x.Anio).Distinct().OrderByDescending(x => x).ToList());
        var reclamaciones = textos.Length == 0 ? []
            : await db.AdministrationClaims.AsNoTracking()
                .Where(x => x.ModuloId == Festival && textos.Contains(x.CanonicalRecordId) && Activas.Contains(x.Status))
                .Select(x => new { x.Id, x.CanonicalRecordId, x.RequestingOrganizationId, x.Status }).ToListAsync(ct);
        var lugares = await LugaresAsync(db, elegidos.Select(x => x.DepartmentCode), ct);

        return Results.Ok(new HistoricosReclamablesDto(departamento, nombreDepartamento, elegidos.Select(x =>
        {
            var id = x.Id.ToString(CultureInfo.InvariantCulture);
            var activa = reclamaciones.FirstOrDefault(r => r.CanonicalRecordId == id);
            var propia = activa is not null && activa.RequestingOrganizationId == organizacionId ? activa : null;
            var (dep, mun) = Lugar(lugares, x.DepartmentCode, x.MunicipalityCode);
            return new FestivalHistoricoReclamableDto(
                id, x.Name, descripciones.GetValueOrDefault(x.Id), x.CoverageLevel ?? "municipal", x.DepartmentCode, dep, x.MunicipalityCode, mun, x.Periodicidad,
                anios.TryGetValue(x.Id, out var lista) ? lista : [],
                activa is not null && propia is null,
                propia?.Id.ToString(CultureInfo.InvariantCulture), propia?.Status);
        }).ToList()));
    }

    // ---------- Borrador del asistente -------------------------------------------------------

    private static async Task<IResult> ObtenerOCrearBorrador(int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        if (!await Edita(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        var draft = await db.BorradoresDeProceso.FirstOrDefaultAsync(x => x.ModuloId == Festival && x.OrganizacionId == organizacionId && x.PersonaId == persona && x.Estado == "borrador", ct);
        if (draft is null) { var now = DateTime.UtcNow; draft = new BorradorDeProcesoRow { ModuloId = Festival, OrganizacionId = organizacionId, PersonaId = persona.Value, FechaCreacion = now, FechaActualizacion = now, Version = 1 }; db.BorradoresDeProceso.Add(draft); await db.SaveChangesAsync(ct); }
        return Results.Ok(Dto(draft));
    }

    private static Task<IResult> ObtenerOCrearBorradorDeMercado(int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct) =>
        ObtenerOCrearBorradorDe(Modulos.Mercados, organizacionId, principal, db, ct);

    private static async Task<IResult> ObtenerOCrearBorradorDe(string modulo, int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        if (!await Edita(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        var draft = await db.BorradoresDeProceso.FirstOrDefaultAsync(x => x.ModuloId == modulo && x.OrganizacionId == organizacionId && x.PersonaId == persona && x.Estado == "borrador", ct);
        if (draft is null) { var now = DateTime.UtcNow; draft = new BorradorDeProcesoRow { ModuloId = modulo, OrganizacionId = organizacionId, PersonaId = persona.Value, FechaCreacion = now, FechaActualizacion = now, Version = 1 }; db.BorradoresDeProceso.Add(draft); await db.SaveChangesAsync(ct); }
        return Results.Ok(Dto(draft));
    }

    /// <summary>
    /// Los borradores abiertos de esta persona en esta organización que tienen algo escrito. Un
    /// borrador en blanco (se abrió el asistente y no se tecleó nada) no es «un registro sin terminar».
    /// </summary>
    private static async Task<IResult> ListarBorradoresPendientes(int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        if (!await Edita(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        var filas = await db.BorradoresDeProceso.AsNoTracking()
            .Where(x => x.OrganizacionId == organizacionId && x.PersonaId == persona && x.Estado == "borrador"
                && (x.ModuloId == Festival || x.ModuloId == Modulos.Mercados))
            .OrderByDescending(x => x.FechaActualizacion)
            .ToListAsync(ct);
        var pendientes = filas
            .Select(x => (Fila: x, Contenido: ContenidoDelBorrador(x.DatosJson)))
            .Where(x => x.Contenido.TieneAlgo)
            .Select(x => new BorradorPendienteDto(x.Fila.Id.ToString(CultureInfo.InvariantCulture), x.Fila.ModuloId, x.Contenido.Nombre, x.Fila.Version, x.Fila.FechaActualizacion))
            .ToList();
        return Results.Ok(pendientes);
    }

    /// <summary>Si el JSON de un borrador tiene algo escrito, y el nombre, si lo hay.</summary>
    internal static (bool TieneAlgo, string? Nombre) ContenidoDelBorrador(string? datosJson)
    {
        if (string.IsNullOrWhiteSpace(datosJson)) return (false, null);
        try
        {
            using var documento = JsonDocument.Parse(datosJson);
            if (documento.RootElement.ValueKind != JsonValueKind.Object) return (false, null);
            string? nombre = null;
            var algo = false;
            foreach (var propiedad in documento.RootElement.EnumerateObject())
            {
                if (propiedad.Name == "nombre" && propiedad.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(propiedad.Value.GetString()))
                {
                    nombre = propiedad.Value.GetString()!.Trim();
                    algo = true;
                    continue;
                }
                // El nivel de cobertura nace con un valor por omisión: no cuenta como «escrito».
                if (propiedad.Name == "nivelCobertura") continue;
                algo |= propiedad.Value.ValueKind switch
                {
                    JsonValueKind.String => !string.IsNullOrWhiteSpace(propiedad.Value.GetString()),
                    JsonValueKind.Array => propiedad.Value.GetArrayLength() > 0,
                    JsonValueKind.Number => true,
                    JsonValueKind.True => true,
                    _ => false,
                };
            }
            return (algo, nombre);
        }
        catch (JsonException)
        {
            return (false, null);
        }
    }

    /// <summary>«Descartar» un registro sin terminar: el borrador pasa a <c>cancelado</c> y deja de ofrecerse.</summary>
    private static async Task<IResult> DescartarBorrador(long id, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest(new { message = "El testigo de seguridad no es válido." });
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        var draft = await db.BorradoresDeProceso.FirstOrDefaultAsync(x => x.Id == id && x.Estado == "borrador", ct);
        if (draft is null) return Results.NotFound();
        if (draft.PersonaId != persona || draft.OrganizacionId is null || !await Edita(db, persona.Value, draft.OrganizacionId.Value, ct)) return Results.Forbid();
        draft.Estado = "cancelado"; draft.FechaActualizacion = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> GuardarBorrador(long id, GuardarBorradorProcesoSolicitud request, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest(new { message = "El testigo de seguridad no es válido." });
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        var draft = await db.BorradoresDeProceso.FirstOrDefaultAsync(x => x.Id == id && x.Estado == "borrador", ct);
        if (draft is null) return Results.NotFound();
        if (draft.PersonaId != persona || draft.OrganizacionId is null || !await Edita(db, persona.Value, draft.OrganizacionId.Value, ct)) return Results.Forbid();
        if (request.Version is int version && version != draft.Version) return Results.Conflict(new { message = "El borrador cambió en otra sesión. Recarga antes de guardar." });
        var datos = string.IsNullOrWhiteSpace(request.DatosJson) ? "{}" : request.DatosJson;
        try { using var _ = JsonDocument.Parse(datos); } catch (JsonException) { return Results.ValidationProblem(new Dictionary<string, string[]> { ["datosJson"] = ["El borrador debe contener JSON válido."] }); }
        draft.DatosJson = datos; draft.Version++; draft.FechaActualizacion = DateTime.UtcNow;
        await db.SaveChangesAsync(ct); return Results.Ok(Dto(draft));
    }

    // ---------- La organización --------------------------------------------------------------

    private static async Task<IResult> Crear(int organizacionId, CrearReclamacionAdministracionSolicitud request, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest(new { message = "El testigo de seguridad no es válido." });
        var persona = Persona(principal); if (persona is null) return Results.Unauthorized();
        if (!await Administra(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        // Reclamar la administración de un proceso es afirmar ante el Programa que es de esta
        // organización. Es representación activa, así que exige la misma dirección comprobada.
        if (await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(
                db, politicaDeConfirmacion, organizacionId, "reclamar la administración de un proceso", ct) is { } sinConfirmar) return sinConfirmar;
        // EL TIPO DEL PROCESO (decisión 129): Festivales por omisión, para que la solicitud de antes siga valiendo.
        var tipo = TiposDeProcesoHistorico.De(string.IsNullOrWhiteSpace(request.Modulo) ? Festival : request.Modulo);
        if (tipo is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["modulo"] = ["Elige un tipo de proceso de la lista."] });
        if (!tipo.Reclamable) return Results.Conflict(new { codigo = "tipo_no_reclamable", message = $"{tipo.EtiquetaPlural}: {tipo.MotivoNoReclamable}" });
        var modulo = tipo.Modulo;
        var objetivo = string.IsNullOrWhiteSpace(request.RegistroId) ? request.FestivalId : request.RegistroId;
        if (!int.TryParse(objetivo, out var festivalId) || string.IsNullOrWhiteSpace(request.Justificacion)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["justificacion"] = [$"Indica un proceso y explica por qué corresponde a tu organización."] });
        var (registroNombre, reclamable) = await RegistroReclamableAsync(db, modulo, festivalId, ct);
        if (!reclamable) return Results.Conflict(new { codigo = "no_reclamable", message = $"Este proceso ya no se puede reclamar: otra organización lo administra o dejó de estar publicado." });
        var (soportes, soportesInvalidos) = await SoportesDeLaOrganizacionAsync(db, organizacionId, request.Soportes, 0, ct);
        if (soportesInvalidos is not null) return soportesInvalidos;
        var id = festivalId.ToString(CultureInfo.InvariantCulture);
        long? borrador = long.TryParse(request.BorradorId, out var borradorId) ? borradorId : null;

        // DENTRO DE LA ESTRATEGIA DE EJECUCIÓN. `EnableRetryOnFailure` prohíbe abrir
        // una transacción a mano fuera de ella: en SQL Server cada reclamación respondía 500. Las
        // pruebas del carril rápido no lo veían.
        var estrategia = db.Database.CreateExecutionStrategy();
        return await estrategia.ExecuteAsync<IResult>(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (await db.AdministrationClaims.AnyAsync(x => x.ModuloId == modulo && x.CanonicalRecordId == id && Activas.Contains(x.Status), ct))
                return Results.Conflict(new { codigo = "reclamacion_activa", message = "Ya hay una solicitud para administrar este proceso en revisión. Si también es tuyo, espera a que se resuelva o escríbele al PNMC." });
            BorradorDeProcesoRow? fila = null;
            if (borrador is not null)
            {
                fila = await db.BorradoresDeProceso.FirstOrDefaultAsync(x => x.Id == borrador && x.OrganizacionId == organizacionId && x.PersonaId == persona, ct);
                if (fila is null) return Results.Forbid();
            }
            var now = DateTime.UtcNow;
            var claim = new AdministrationClaimRow { ModuloId = modulo, CanonicalRecordId = id, RequestingOrganizationId = organizacionId, RequestingPersonId = persona.Value, ProcessDraftId = borrador, Status = "enviada", Justification = ValidationHelpers.SanitizeText(request.Justificacion, 2400), EvidenceJson = request.EvidenciasJson, SignalsJson = string.IsNullOrWhiteSpace(request.SenalesJson) ? "[]" : request.SenalesJson, CreatedAt = now, SubmittedAt = now, UpdatedAt = now, Version = 1 };
            // EL BORRADOR QUEDA CONGELADO EN LA RECLAMACIÓN. Abierto, el asistente lo
            // recuperaba en la siguiente alta y el autoguardado escribía otro Festival encima de los
            // datos que se iban a conciliar; y «Guardar borrador» creaba un duplicado del histórico.
            if (fila is not null && fila.Estado == "borrador") { fila.Estado = "cerrado"; fila.FechaActualizacion = now; }
            db.AdministrationClaims.Add(claim);
            await db.SaveChangesAsync(ct);
            await AdjuntarSoportesAsync(db, claim.Id, soportes, now, ct);
            Auditar(db, persona.Value, claim.Id.ToString(CultureInfo.InvariantCulture), "ReclamacionEnviada", null, "enviada", soportes.Count);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            var adjuntos = await SoportesDeAsync(db, [claim.Id], ct);
            return Results.Created($"/api/v1/externo/reclamaciones-administracion/{claim.Id}", ClaimDto(claim) with { RegistroNombre = registroNombre, Soportes = adjuntos.GetValueOrDefault(claim.Id, []) });
        });
    }

    private static async Task<IResult> ListarPropias(int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = Persona(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await Edita(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var reclamaciones = await db.AdministrationClaims.AsNoTracking()
            .Where(x => x.RequestingOrganizationId == organizacionId)
            .OrderByDescending(x => x.UpdatedAt)
            .ToListAsync(ct);
        var nombres = await NombresDeProcesoAsync(db, reclamaciones, ct);
        // LOS SOPORTES LOS VE LA ORGANIZACIÓN QUE LOS ADJUNTÓ, con su enlace al banco.
        var soportes = await SoportesDeAsync(db, reclamaciones.Select(x => x.Id), ct);
        // LA PREGUNTA DEL PROGRAMA, A LA VISTA (D3-02). Antes la organización leía «necesita una
        // aclaración» sin saber cuál: tenía que adivinar qué responder.
        var preguntas = await AclaracionesPendientesAsync(db, reclamaciones.Where(x => x.Status == "requiere_aclaracion").Select(x => x.Id), ct);
        return Results.Ok(reclamaciones.Select(reclamacion => ClaimDto(reclamacion) with
        {
            RegistroNombre = NombreDe(nombres, reclamacion),
            Soportes = soportes.GetValueOrDefault(reclamacion.Id, []),
            AclaracionPendiente = preguntas.GetValueOrDefault(reclamacion.Id),
        }));
    }

    /// <summary>Lo que el Programa preguntó y la organización todavía no respondió, por solicitud.</summary>
    private static async Task<Dictionary<long, string>> AclaracionesPendientesAsync(SimusDbContext db, IEnumerable<long> reclamaciones, CancellationToken ct)
    {
        var ids = reclamaciones.ToArray();
        if (ids.Length == 0) return [];
        var filas = await db.AdministrationClaimClarifications.AsNoTracking()
            .Where(x => ids.Contains(x.ClaimId) && x.Response == null)
            .Select(x => new { x.ClaimId, x.Comment, x.RequestedAt })
            .ToListAsync(ct);
        return filas.GroupBy(x => x.ClaimId).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.RequestedAt).First().Comment);
    }

    private static async Task<IResult> ResponderAclaracion(long id, ResponderAclaracionSolicitud request, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest();
        var actor = Persona(principal); if (actor is null) return Results.Unauthorized();
        var claim = await db.AdministrationClaims.FirstOrDefaultAsync(x => x.Id == id, ct); if (claim is null) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(request.Respuesta)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["respuesta"] = ["Escribe la respuesta a la aclaración."] });
        if (!await Administra(db, actor.Value, claim.RequestingOrganizationId, ct)) return Results.Forbid();
        if (claim.Status != "requiere_aclaracion") return Results.Conflict(new { message = "Esta solicitud no espera ninguna aclaración." });
        var clarification = await db.AdministrationClaimClarifications.OrderByDescending(x => x.RequestedAt).FirstOrDefaultAsync(x => x.ClaimId == id && x.Response == null, ct);
        if (clarification is null) return Results.Conflict(new { message = "Esta solicitud no espera ninguna aclaración." });
        // UNA ACLARACIÓN SUELE PEDIR UN DOCUMENTO (REC-16): «adjunta el acta». Se puede responder con él.
        var registro = id.ToString(CultureInfo.InvariantCulture);
        var yaAdjuntos = await db.ArchivosDeRegistro.AsNoTracking()
            .CountAsync(x => x.ModuloId == Modulos.ReclamacionesDeAdministracion && x.RegistroId == registro, ct);
        var (soportes, soportesInvalidos) = await SoportesDeLaOrganizacionAsync(db, claim.RequestingOrganizationId, request.Soportes, yaAdjuntos, ct);
        if (soportesInvalidos is not null) return soportesInvalidos;
        var now = DateTime.UtcNow;
        clarification.Response = ValidationHelpers.SanitizeText(request.Respuesta, 2400); clarification.RespondedById = actor; clarification.RespondedAt = now;
        claim.Status = "aclaracion_enviada"; claim.UpdatedAt = now; claim.Version++;
        await AdjuntarSoportesAsync(db, id, soportes, now, ct);
        Auditar(db, actor.Value, registro, "AclaracionRespondida", "requiere_aclaracion", claim.Status, soportes.Count);
        await db.SaveChangesAsync(ct);
        var adjuntos = await SoportesDeAsync(db, [id], ct);
        return Results.Ok(ClaimDto(claim) with { Soportes = adjuntos.GetValueOrDefault(id, []) });
    }

    private static async Task<IResult> Cancelar(long id, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest();
        var actor = Persona(principal); if (actor is null) return Results.Unauthorized();
        var claim = await db.AdministrationClaims.FirstOrDefaultAsync(x => x.Id == id, ct); if (claim is null) return Results.NotFound();
        if (!await Administra(db, actor.Value, claim.RequestingOrganizationId, ct)) return Results.Forbid();
        if (!Activas.Contains(claim.Status)) return Results.Conflict(new { message = "Esta solicitud ya está cerrada." });
        claim.Status = "cancelada"; claim.UpdatedAt = DateTime.UtcNow; claim.Version++;
        Auditar(db, actor.Value, id.ToString(CultureInfo.InvariantCulture), "ReclamacionCancelada", null, claim.Status);
        await db.SaveChangesAsync(ct);
        return Results.Ok(ClaimDto(claim));
    }

    private static async Task<IResult> ObtenerConciliacion(long id, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var actor = Persona(principal); if (actor is null) return Results.Unauthorized();
        var claim = await db.AdministrationClaims.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct); if (claim is null) return Results.NotFound();
        if (!await Administra(db, actor.Value, claim.RequestingOrganizationId, ct)) return Results.Forbid();
        var row = await db.AdministrationReconciliations.AsNoTracking().FirstOrDefaultAsync(x => x.ClaimId == id, ct);
        return row is null ? Results.NotFound() : Results.Ok(new ConciliacionAdministracionDto(id.ToString(CultureInfo.InvariantCulture), row.HistoricalValuesJson, row.DraftValuesJson, row.SelectionsJson, row.ResolvedAt is not null));
    }

    /// <summary>La organización elige qué conservar y la administración se transfiere.</summary>
    /// <remarks>
    /// <b>LO QUE NO SE ELIGE, SE CONSERVA DEL HISTÓRICO.</b> Antes había que mandar los nueve campos
    /// y un valor vacío del borrador borraba el dato histórico. Ahora una casilla ausente, o un
    /// valor vacío, deja el histórico.
    /// </remarks>
    private static async Task<IResult> ResolverConciliacion(long id, ResolverConciliacionAdministracionSolicitud request, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest();
        var actor = Persona(principal); if (actor is null) return Results.Unauthorized();
        var claimLeida = await db.AdministrationClaims.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && x.Status == "aprobada", ct);
        if (claimLeida is null) return Results.Conflict(new { message = "La solicitud no está pendiente de conciliación." });
        if (!await Administra(db, actor.Value, claimLeida.RequestingOrganizationId, ct)) return Results.Forbid();
        var invalidas = request.Selecciones.Where(x => x.Value is not ("historico" or "borrador")).Select(x => x.Key).ToArray();
        if (invalidas.Length > 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["selecciones"] = [$"Elige el histórico o tu registro para: {string.Join(", ", invalidas)}."] });

        // DENTRO DE LA ESTRATEGIA DE EJECUCIÓN: mismo fallo que al reclamar.
        var estrategia = db.Database.CreateExecutionStrategy();
        var resultado = await estrategia.ExecuteAsync<IResult>(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var claim = await db.AdministrationClaims.FirstOrDefaultAsync(x => x.Id == id && x.Status == "aprobada" && x.ModuloId == Festival, ct);
            if (claim is null) return Results.Conflict(new { message = "La solicitud no está pendiente de conciliación." });
            var conciliacion = await db.AdministrationReconciliations.FirstOrDefaultAsync(x => x.ClaimId == id && x.ResolvedAt == null, ct);
            if (conciliacion is null || !int.TryParse(claim.CanonicalRecordId, out var festivalId)) return Results.NotFound();
            var festival = await db.FestivalRecords.FirstOrDefaultAsync(x => x.Id == festivalId, ct);
            if (festival is null || !await EsReclamable(db, festival, ct)) return Results.Conflict(new { message = "El Festival ya no está disponible para transferir." });

            var propuestos = ValoresDelBorrador(conciliacion.DraftValuesJson);
            var aplicar = Campos
                .Where(c => request.Selecciones.TryGetValue(c.Historico, out var eleccion) && eleccion == "borrador" && propuestos.GetValueOrDefault(c.Historico) is not null)
                .ToDictionary(c => c.Historico, c => propuestos[c.Historico]);
            conciliacion.SelectionsJson = JsonSerializer.Serialize(request.Selecciones); conciliacion.ResolvedAt = DateTime.UtcNow;
            Transferir(db, claim, festival, actor.Value, aplicar);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            return Results.Ok(ClaimDto(claim) with { RegistroNombre = festival.Name });
        });
        await InvalidarCacheAsync(http, ct);
        return resultado;
    }

    // ---------- La consola -------------------------------------------------------------------

    private static async Task<IResult> ListarInstitucional(string? estado, SimusDbContext db, CancellationToken ct)
    {
        var q = db.AdministrationClaims.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(estado)) q = q.Where(x => x.Status == estado);
        var claims = await q.OrderByDescending(x => x.UpdatedAt).ToListAsync(ct);

        // LOS NOMBRES, EN LOTE: la bandeja decidía sobre «Registro » y «Organización ».
        var nombresDeFestival = await NombresDeProcesoAsync(db, claims, ct);
        var idsDeOrganizacion = claims.Select(x => x.RequestingOrganizationId).Distinct().ToArray();
        var nombresDeOrganizacion = idsDeOrganizacion.Length == 0 ? new Dictionary<int, string>()
            : await db.EntityProfiles.AsNoTracking().Where(x => idsDeOrganizacion.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        return Results.Ok(claims.Select(claim => ClaimDto(claim) with
        {
            RegistroNombre = NombreDe(nombresDeFestival, claim),
            OrganizacionSolicitanteNombre = nombresDeOrganizacion.TryGetValue(claim.RequestingOrganizationId, out var nombreOrg) ? nombreOrg : null,
        }));
    }

    /// <summary>
    /// Todo lo que la consola necesita para decidir, en una lectura.
    /// </summary>
    /// <remarks>
    /// Antes el detalle solo traía organización, fecha y justificación: se aprobaba sin ver el
    /// histórico, sin saber quién es la organización, sin ver lo que iba a cambiar en la ficha
    /// publicada y sin saber que otra organización reclamaba un duplicado del mismo Festival.
    /// </remarks>
    private static async Task<IResult> Detalle(long id, SimusDbContext db, CancellationToken ct)
    {
        var claim = await db.AdministrationClaims.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (claim is null || !int.TryParse(claim.CanonicalRecordId, out var festivalId)) return Results.NotFound();
        if (claim.ModuloId != Festival) return await DetalleDeProcesoSimpleAsync(claim, festivalId, db, ct);
        var festival = await db.FestivalRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == festivalId, ct);
        if (festival is null) return Results.NotFound();
        var organizacion = await db.EntityProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == claim.RequestingOrganizationId, ct);
        if (organizacion is null) return Results.NotFound();
        var institucional = await IdInstitucionalAsync(db, ct);

        var lugares = await LugaresAsync(db, [festival.DepartmentCode, organizacion.HeadquartersDepartmentCode], ct);
        var (depFestival, munFestival) = Lugar(lugares, festival.DepartmentCode, festival.MunicipalityCode);
        var (depSede, munSede) = Lugar(lugares, organizacion.HeadquartersDepartmentCode, organizacion.HeadquartersMunicipalityCode);
        var anios = await db.EdicionesFestival.AsNoTracking().Where(x => x.FestivalId == festivalId && x.Anio != null)
            .Select(x => x.Anio!.Value).Distinct().OrderByDescending(x => x).ToListAsync(ct);
        var procedencia = await ProcedenciaDeRegistro.LeerAsync(db, Festival, claim.CanonicalRecordId, ct);
        var administradores = await db.UserEntities.AsNoTracking()
            .CountAsync(x => x.EntityId == organizacion.Id && x.IsActive && x.EntityRole == "administrador", ct);
        var solicitante = await db.Users.AsNoTracking().Where(x => x.Id == claim.RequestingPersonId).Select(x => x.FullName).FirstOrDefaultAsync(ct);

        // LO QUE CAMBIARÍA EN LA FICHA: lo que la organización escribió en su borrador y difiere
        // del histórico. Si la conciliación ya existe, se compara contra lo que se guardó entonces.
        var conciliacion = await db.AdministrationReconciliations.AsNoTracking().FirstOrDefaultAsync(x => x.ClaimId == id, ct);
        var borradorJson = conciliacion?.DraftValuesJson
            ?? (claim.ProcessDraftId is long b ? await db.BorradoresDeProceso.AsNoTracking().Where(x => x.Id == b).Select(x => x.DatosJson).FirstOrDefaultAsync(ct) : null);
        var historicos = conciliacion is null ? ValoresHistoricos(festival) : ValoresDelHistoricoGuardado(conciliacion.HistoricalValuesJson);
        var comparacion = Diferencias(historicos, ValoresDelBorrador(borradorJson))
            .Select(c => new CampoComparadoDeReclamacionDto(c.Historico, c.Etiqueta, historicos.GetValueOrDefault(c.Historico), ValoresDelBorrador(borradorJson).GetValueOrDefault(c.Historico)))
            .ToList();

        var aclaraciones = await db.AdministrationClaimClarifications.AsNoTracking().Where(x => x.ClaimId == id).OrderBy(x => x.RequestedAt)
            .Select(x => new AclaracionDeReclamacionDto(x.Comment, x.RequestedAt, x.Response, x.RespondedAt)).ToListAsync(ct);

        // RELACIONADAS: otras solicitudes sobre el mismo Festival, históricos parecidos del mismo
        // departamento (posibles duplicados, con su solicitud si la tienen) y un Festival parecido
        // que la propia organización ya registró.
        var relacionadas = new List<RelacionadaConLaReclamacionDto>();
        var otras = await db.AdministrationClaims.AsNoTracking()
            .Where(x => x.ModuloId == Festival && x.CanonicalRecordId == claim.CanonicalRecordId && x.Id != id)
            .OrderByDescending(x => x.UpdatedAt).Take(10).ToListAsync(ct);
        var parecidos = await db.FestivalRecords.AsNoTracking()
            // LOS ABSORBIDOS POR UNA FUSIÓN NO SON UN POSIBLE DUPLICADO: ya se resolvió (M2). Antes
            // quedaban archivados, con el mismo nombre, y la consola seguía proponiendo fusionarlos.
            .Where(x => x.Id != festivalId && x.FusionadoEnId == null && x.DepartmentCode == festival.DepartmentCode
                && (x.OrganizacionPrincipalId == institucional || x.OrganizacionPrincipalId == organizacion.Id))
            .Select(x => new { x.Id, x.Name, x.MunicipalityCode, x.OrganizacionPrincipalId })
            .ToListAsync(ct);
        var comparadorDelFestival = new ParecidoDeNombres.Consulta(festival.Name);
        var duplicados = parecidos.Where(x => comparadorDelFestival.Puntaje(x.Name) >= 2).Take(10).ToList();
        var idsDuplicados = duplicados.Select(x => x.Id.ToString(CultureInfo.InvariantCulture)).ToArray();
        var reclamosDeDuplicados = idsDuplicados.Length == 0 ? [] : await db.AdministrationClaims.AsNoTracking()
            .Where(x => x.ModuloId == Festival && idsDuplicados.Contains(x.CanonicalRecordId) && Activas.Contains(x.Status)).ToListAsync(ct);
        var idsOrg = otras.Select(x => x.RequestingOrganizationId).Concat(reclamosDeDuplicados.Select(x => x.RequestingOrganizationId)).Distinct().ToArray();
        var nombresOrg = idsOrg.Length == 0 ? new Dictionary<int, string>()
            : await db.EntityProfiles.AsNoTracking().Where(x => idsOrg.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        foreach (var otra in otras)
            relacionadas.Add(new RelacionadaConLaReclamacionDto(claim.CanonicalRecordId, festival.Name, munFestival, "Otra solicitud sobre este Festival",
                otra.Id.ToString(CultureInfo.InvariantCulture), otra.Status, nombresOrg.GetValueOrDefault(otra.RequestingOrganizationId)));
        foreach (var dup in duplicados)
        {
            var idDup = dup.Id.ToString(CultureInfo.InvariantCulture);
            var (_, munDup) = Lugar(lugares, festival.DepartmentCode, dup.MunicipalityCode);
            var reclamo = reclamosDeDuplicados.FirstOrDefault(x => x.CanonicalRecordId == idDup);
            var relacion = dup.OrganizacionPrincipalId == organizacion.Id
                ? "La organización ya registró un Festival parecido"
                : "Posible duplicado en el registro histórico";
            relacionadas.Add(new RelacionadaConLaReclamacionDto(idDup, dup.Name, munDup, relacion,
                reclamo?.Id.ToString(CultureInfo.InvariantCulture), reclamo?.Status, reclamo is null ? null : nombresOrg.GetValueOrDefault(reclamo.RequestingOrganizationId),
                comparadorDelFestival.Razon(dup.Name)));
        }

        var soportes = await SoportesDeAsync(db, [id], ct);

        return Results.Ok(new DetalleReclamacionAdministracionDto(
            ClaimDto(claim) with { RegistroNombre = festival.Name, OrganizacionSolicitanteNombre = organizacion.Name, Soportes = soportes.GetValueOrDefault(id, []) },
            new FestivalDeLaReclamacionDto(festival.Id.ToString(CultureInfo.InvariantCulture), festival.Name, festival.Description, festival.StatusCode,
                festival.CoverageLevel ?? "municipal", depFestival, munFestival, festival.Periodicidad,
                institucional is not null && festival.OrganizacionPrincipalId == institucional, procedencia?.ContextoEtiqueta, anios),
            new OrganizacionDeLaReclamacionDto(organizacion.Id.ToString(CultureInfo.InvariantCulture), organizacion.Name, depSede, munSede,
                organizacion.StatusCode, organizacion.IsActive, organizacion.CreatedAt, administradores, solicitante),
            comparacion, aclaraciones, relacionadas));
    }

    private static async Task<IResult> PedirAclaracion(long id, ResponderAclaracionSolicitud request, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest();
        var actor = Persona(principal); if (actor is null) return Results.Unauthorized();
        var claim = await db.AdministrationClaims.FirstOrDefaultAsync(x => x.Id == id, ct); if (claim is null) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(request.Respuesta)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["respuesta"] = ["Escribe la aclaración que necesitas."] });
        if (claim.Status == "requiere_aclaracion") return Results.Conflict(new { message = "La organización todavía no ha respondido la aclaración anterior." });
        if (!Decidibles.Contains(claim.Status)) return Results.Conflict(new { message = "Esta solicitud ya está decidida." });
        var now = DateTime.UtcNow; var antes = claim.Status;
        claim.Status = "requiere_aclaracion"; claim.UpdatedAt = now; claim.Version++;
        db.AdministrationClaimClarifications.Add(new AdministrationClaimClarificationRow { ClaimId = id, RequestedById = actor.Value, Comment = ValidationHelpers.SanitizeText(request.Respuesta, 2400), RequestedAt = now });
        var nombre = await NombreDelFestivalAsync(db, claim, ct);
        // EL AVISO DICE QUÉ SE PREGUNTA (D3-02): sin la pregunta, «respóndela» no dice qué responder.
        Notificar(db, claim.RequestingPersonId, "ReclamacionRequiereAclaracion", "El PNMC necesita una aclaración",
            $"Sobre tu solicitud para administrar «{nombre}»: {Recortar(request.Respuesta)} Respóndela desde Solicitudes.", id);
        Auditar(db, actor.Value, id.ToString(CultureInfo.InvariantCulture), "AclaracionSolicitada", antes, claim.Status);
        await db.SaveChangesAsync(ct);
        return Results.Ok(ClaimDto(claim));
    }

    /// <summary>Aprueba o rechaza.</summary>
    /// <remarks>
    /// <para>
    /// <b>APROBAR TRANSFIERE DE INMEDIATO SI NO HAY NADA QUE CONCILIAR.</b> Si la organización
    /// no propuso datos distintos de los del histórico —o reclamó desde la lista, sin borrador—, la
    /// conciliación no tenía nada que preguntar y solo añadía un paso. Si los hay, la consola ya los
    /// vio en el detalle y la organización elige cuáles conservar.
    /// </para>
    /// <para>Rechazar exige motivo: es lo que lee la organización (REC-15).</para>
    /// </remarks>
    private static async Task<IResult> Decidir(long id, DecidirReclamacionAdministracionSolicitud request, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest();
        var actor = Persona(principal); if (actor is null) return Results.Unauthorized();
        var claim = await db.AdministrationClaims.FirstOrDefaultAsync(x => x.Id == id, ct); if (claim is null) return Results.NotFound();
        var accion = (request.Accion ?? string.Empty).Trim().ToLowerInvariant();
        var nombre = await NombreDelFestivalAsync(db, claim, ct);
        var idTexto = id.ToString(CultureInfo.InvariantCulture);

        if (accion == "rechazar")
        {
            if (string.IsNullOrWhiteSpace(request.Motivo)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["motivo"] = ["Escribe por qué se rechaza: es lo que leerá la organización."] });
            if (!Activas.Contains(claim.Status) || claim.Status == "aprobada") return Results.Conflict(new { message = "Esta solicitud ya está decidida." });
            claim.Status = "rechazada"; claim.Decision = accion; claim.DecisionReason = ValidationHelpers.SanitizeText(request.Motivo, 2400); claim.DeciderId = actor; claim.DecidedAt = claim.UpdatedAt = DateTime.UtcNow;
            Auditar(db, actor.Value, idTexto, "ReclamacionRechazada", null, claim.Status);
            Notificar(db, claim.RequestingPersonId, "ReclamacionRechazada", "Solicitud de administración rechazada", $"«{nombre}»: {Recortar(claim.DecisionReason)}", id);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ClaimDto(claim));
        }

        if (accion != "aprobar") return Results.ValidationProblem(new Dictionary<string, string[]> { ["accion"] = ["La decisión es aprobar o rechazar."] });
        if (claim.Status == "requiere_aclaracion") return Results.Conflict(new { message = "La organización todavía no ha respondido la aclaración." });
        if (!Decidibles.Contains(claim.Status)) return Results.Conflict(new { message = "Esta solicitud ya está decidida." });
        if (!int.TryParse(claim.CanonicalRecordId, out var festivalId)) return Results.Conflict();
        // UN PROCESO QUE NO ES UN FESTIVAL NO TIENE BORRADOR NI CONCILIACIÓN: se reclama desde la lista, así que aprobar transfiere de inmediato.
        if (claim.ModuloId != Festival)
        {
            var proceso = await CargarSimpleAsync(db, claim.ModuloId, festivalId, true, ct);
            if (proceso is null || !proceso.EsReclamable(await IdInstitucionalAsync(db, ct))) return Results.Conflict(new { message = "Este proceso ya no se puede transferir: otra organización lo administra o dejó de estar publicado." });
            claim.Status = "aprobada"; claim.Decision = "aprobar"; claim.DecisionReason = ValidationHelpers.SanitizeText(request.Motivo, 2400); claim.DeciderId = actor; claim.DecidedAt = claim.UpdatedAt = DateTime.UtcNow;
            Auditar(db, actor.Value, idTexto, "ReclamacionAprobadaPendienteConciliacion", null, "aprobada");
            TransferirSimple(db, claim, proceso, actor.Value);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ClaimDto(claim) with { RegistroNombre = proceso.Nombre });
        }
        var festival = await db.FestivalRecords.FirstOrDefaultAsync(x => x.Id == festivalId, ct);
        if (festival is null || !await EsReclamable(db, festival, ct)) return Results.Conflict(new { message = "Este Festival ya no se puede transferir: otra organización lo administra o dejó de estar publicado." });

        var borradorJson = claim.ProcessDraftId is long b ? await db.BorradoresDeProceso.AsNoTracking().Where(x => x.Id == b).Select(x => x.DatosJson).FirstOrDefaultAsync(ct) : null;
        var historicos = ValoresHistoricos(festival);
        var diferencias = Diferencias(historicos, ValoresDelBorrador(borradorJson));
        claim.Status = "aprobada"; claim.Decision = "aprobar"; claim.DecisionReason = ValidationHelpers.SanitizeText(request.Motivo, 2400); claim.DeciderId = actor; claim.DecidedAt = claim.UpdatedAt = DateTime.UtcNow;
        Auditar(db, actor.Value, idTexto, "ReclamacionAprobadaPendienteConciliacion", null, "aprobada");
        if (diferencias.Count == 0)
        {
            Transferir(db, claim, festival, actor.Value, null);
        }
        else
        {
            db.AdministrationReconciliations.Add(new AdministrationReconciliationRow { ClaimId = claim.Id, HistoricalValuesJson = JsonSerializer.Serialize(historicos), DraftValuesJson = borradorJson ?? "{}", CreatedAt = DateTime.UtcNow });
            Notificar(db, claim.RequestingPersonId, "ReclamacionAprobadaPendienteConciliacion", "Solicitud aprobada: falta un paso",
                $"Elige qué datos de «{nombre}» conservar para terminar la transferencia.", id);
        }
        await db.SaveChangesAsync(ct);
        if (claim.Status == "transferencia_ejecutada") await InvalidarCacheAsync(http, ct);
        return Results.Ok(ClaimDto(claim) with { RegistroNombre = nombre });
    }

    // ---------- Soportes (REC-16) -------------------------------------------------------------

    /// <summary>
    /// Los archivos del banco que la organización quiere adjuntar, comprobados.
    /// </summary>
    /// <remarks>
    /// <b>SOLO LOS DE LA PROPIA ORGANIZACIÓN.</b> El identificador viaja desde el navegador: sin
    /// esta comprobación, una organización podría adjuntar —y así volver legible para sí— un
    /// archivo de otra. Un identificador ajeno o inexistente responde lo mismo, para no confirmar
    /// que existe.
    /// </remarks>
    private static async Task<(List<FileRow> Archivos, IResult? Error)> SoportesDeLaOrganizacionAsync(
        SimusDbContext db, int organizacionId, List<string>? pedidos, int yaAdjuntos, CancellationToken ct)
    {
        var textos = (pedidos ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).Distinct().ToList();
        if (textos.Count == 0) return ([], null);
        if (textos.Count + yaAdjuntos > MaximoDeSoportes)
            return ([], Results.ValidationProblem(new Dictionary<string, string[]> { ["soportes"] = [$"Una solicitud admite hasta {MaximoDeSoportes} soportes."] }));
        var ids = new List<int>();
        foreach (var texto in textos)
        {
            if (!int.TryParse(texto, NumberStyles.Integer, CultureInfo.InvariantCulture, out var archivoId))
                return ([], Results.ValidationProblem(new Dictionary<string, string[]> { ["soportes"] = ["Uno de los soportes no es un archivo válido."] }));
            ids.Add(archivoId);
        }
        var archivos = await db.Files.AsNoTracking()
            .Where(x => ids.Contains(x.Id) && x.OrganizacionId == organizacionId)
            .Select(x => new FileRow { Id = x.Id, OriginalName = x.OriginalName, MimeType = x.MimeType, FileSizeBytes = x.FileSizeBytes, CreatedAt = x.CreatedAt })
            .ToListAsync(ct);
        if (archivos.Count != ids.Count)
            return ([], Results.ValidationProblem(new Dictionary<string, string[]> { ["soportes"] = ["Adjunta archivos que tu organización haya subido al Banco de archivos."] }));
        return (ids.Select(x => archivos.First(a => a.Id == x)).ToList(), null);
    }

    /// <summary>Cuelga los soportes de la solicitud, después de los que ya tenga.</summary>
    private static async Task AdjuntarSoportesAsync(SimusDbContext db, long reclamacionId, List<FileRow> archivos, DateTime ahora, CancellationToken ct)
    {
        if (archivos.Count == 0) return;
        var registro = reclamacionId.ToString(CultureInfo.InvariantCulture);
        var existentes = await db.ArchivosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == Modulos.ReclamacionesDeAdministracion && x.RegistroId == registro)
            .Select(x => new { x.ArchivoId, x.OrdenVisualizacion }).ToListAsync(ct);
        var orden = existentes.Count == 0 ? 0 : existentes.Max(x => x.OrdenVisualizacion);
        foreach (var archivo in archivos.Where(a => existentes.All(e => e.ArchivoId != a.Id)))
        {
            db.ArchivosDeRegistro.Add(new ArchivoDeRegistroRow
            {
                ModuloId = Modulos.ReclamacionesDeAdministracion,
                RegistroId = registro,
                ArchivoId = archivo.Id,
                RolArchivo = RolSoporte,
                DescripcionArchivo = archivo.OriginalName.Length > 1000 ? archivo.OriginalName[..1000] : archivo.OriginalName,
                OrdenVisualizacion = ++orden,
                FechaCreacion = ahora,
            });
        }
    }

    /// <summary>Los soportes de varias solicitudes, en una consulta y sin los bytes.</summary>
    internal static async Task<Dictionary<long, IReadOnlyList<SoporteDeReclamacionDto>>> SoportesDeAsync(SimusDbContext db, IEnumerable<long> reclamaciones, CancellationToken ct)
    {
        var registros = reclamaciones.Select(x => x.ToString(CultureInfo.InvariantCulture)).Distinct().ToArray();
        if (registros.Length == 0) return [];
        var filas = await db.ArchivosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == Modulos.ReclamacionesDeAdministracion && registros.Contains(x.RegistroId) && x.ArchivoId != null)
            .Join(db.Files.AsNoTracking(), v => v.ArchivoId, a => a.Id,
                (v, a) => new { v.RegistroId, v.OrdenVisualizacion, v.FechaCreacion, a.Id, a.OriginalName, a.MimeType, a.FileSizeBytes })
            .ToListAsync(ct);
        return filas
            .GroupBy(x => long.Parse(x.RegistroId, CultureInfo.InvariantCulture))
            .ToDictionary(g => g.Key, g => (IReadOnlyList<SoporteDeReclamacionDto>)g.OrderBy(x => x.OrdenVisualizacion)
                .Select(x => new SoporteDeReclamacionDto(x.Id.ToString(CultureInfo.InvariantCulture), x.OriginalName, x.MimeType, x.FileSizeBytes,
                    "/api/v1/publico/archivos/" + x.Id.ToString(CultureInfo.InvariantCulture), x.FechaCreacion))
                .ToList());
    }

    // ---------- Piezas -----------------------------------------------------------------------

    /// <summary>La organización pasa a administrar el Festival; las ediciones lo siguen solas.</summary>
    private static void Transferir(SimusDbContext db, AdministrationClaimRow claim, FestivalRow festival, int actor, IReadOnlyDictionary<string, string?>? valores)
    {
        var anterior = festival.OrganizacionPrincipalId ?? 0;
        if (valores is not null)
        {
            foreach (var (campo, valor) in valores)
            {
                switch (campo)
                {
                    case "Name": festival.Name = valor ?? festival.Name; break;
                    case "Description": festival.Description = valor; break;
                    case "ContactEmail": festival.ContactEmail = valor; break;
                    case "ContactPhone": festival.ContactPhone = valor; break;
                    case "InstagramUrl": festival.InstagramUrl = valor; break;
                    case "FacebookUrl": festival.FacebookUrl = valor; break;
                    case "WebsiteUrl": festival.WebsiteUrl = valor; break;
                    case "OtherUrl": festival.OtherUrl = valor; break;
                    case "Periodicidad": festival.Periodicidad = valor; break;
                }
            }
        }
        var ahora = DateTime.UtcNow;
        festival.OrganizacionPrincipalId = claim.RequestingOrganizationId; festival.UpdatedAt = ahora;
        claim.Status = "transferencia_ejecutada"; claim.UpdatedAt = ahora; claim.Version++;
        db.AdministrationTransfers.Add(new AdministrationTransferRow { ModuloId = Festival, CanonicalRecordId = claim.CanonicalRecordId, PreviousOrganizationId = anterior, NewOrganizationId = claim.RequestingOrganizationId, ClaimId = claim.Id, DeciderId = claim.DeciderId ?? actor, Reason = claim.DecisionReason, PreviousStatus = festival.StatusCode, NewStatus = festival.StatusCode, ExecutedAt = ahora });
        Auditar(db, actor, claim.CanonicalRecordId, "TransferenciaAdministracionEjecutada", anterior.ToString(CultureInfo.InvariantCulture), claim.RequestingOrganizationId.ToString(CultureInfo.InvariantCulture));
        Notificar(db, claim.RequestingPersonId, "TransferenciaAdministracionEjecutada", "Ya administras un Festival",
            $"«{festival.Name}» ya es de tu organización, con sus ediciones. Puedes completarlo desde Festivales.", claim.Id);
    }

    private static Dictionary<string, string?> ValoresHistoricos(FestivalRow f) => new()
    {
        ["Name"] = f.Name, ["Description"] = f.Description, ["ContactEmail"] = f.ContactEmail, ["ContactPhone"] = f.ContactPhone,
        ["InstagramUrl"] = f.InstagramUrl, ["FacebookUrl"] = f.FacebookUrl, ["WebsiteUrl"] = f.WebsiteUrl, ["OtherUrl"] = f.OtherUrl,
        ["Periodicidad"] = f.Periodicidad,
    };

    private static Dictionary<string, string?> ValoresDelHistoricoGuardado(string? json) => LeerTextos(json, Campos.Select(c => (c.Historico, c.Historico)));

    /// <summary>Lo que escribió la organización, con las claves del histórico. Vacío es «sin dato».</summary>
    private static Dictionary<string, string?> ValoresDelBorrador(string? json) => LeerTextos(json, Campos.Select(c => (c.Historico, c.Borrador)));

    private static Dictionary<string, string?> LeerTextos(string? json, IEnumerable<(string Clave, string Propiedad)> mapa)
    {
        var resultado = new Dictionary<string, string?>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(json)) return resultado;
        try
        {
            using var documento = JsonDocument.Parse(json);
            if (documento.RootElement.ValueKind != JsonValueKind.Object) return resultado;
            foreach (var (clave, propiedad) in mapa)
                if (documento.RootElement.TryGetProperty(propiedad, out var valor) && valor.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(valor.GetString()))
                    resultado[clave] = valor.GetString()!.Trim();
        }
        catch (JsonException) { }
        return resultado;
    }

    private static List<(string Historico, string Borrador, string Etiqueta)> Diferencias(IReadOnlyDictionary<string, string?> historicos, IReadOnlyDictionary<string, string?> propuestos) =>
        Campos.Where(c => propuestos.GetValueOrDefault(c.Historico) is { } propuesto
                && !string.Equals(propuesto, historicos.GetValueOrDefault(c.Historico)?.Trim(), StringComparison.Ordinal))
            .ToList();

    private static async Task<Dictionary<string, (string Departamento, Dictionary<string, string> Municipios)>> LugaresAsync(SimusDbContext db, IEnumerable<string?> departamentos, CancellationToken ct)
    {
        var codigos = departamentos.Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!).Distinct().ToArray();
        if (codigos.Length == 0) return [];
        var filas = await db.DivipolaLocations.AsNoTracking().Where(x => codigos.Contains(x.DepartmentCode))
            .Select(x => new { x.DepartmentCode, x.DepartmentName, x.MunicipalityCode, x.MunicipalityName }).ToListAsync(ct);
        return filas.GroupBy(x => x.DepartmentCode).ToDictionary(
            g => g.Key,
            g => (g.First().DepartmentName, g.GroupBy(x => x.MunicipalityCode).ToDictionary(m => m.Key, m => m.First().MunicipalityName)));
    }

    private static (string? Departamento, string? Municipio) Lugar(Dictionary<string, (string Departamento, Dictionary<string, string> Municipios)> lugares, string? departamento, string? municipio)
    {
        if (departamento is null || !lugares.TryGetValue(departamento, out var lugar)) return (null, null);
        return (lugar.Departamento, municipio is not null && lugar.Municipios.TryGetValue(municipio, out var nombre) ? nombre : null);
    }

    /// <summary>Los nombres de los procesos reclamados, por módulo e identificador (los cinco tipos).</summary>
    internal static async Task<Dictionary<(string Modulo, int Id), string>> NombresDeProcesoAsync(SimusDbContext db, IEnumerable<AdministrationClaimRow> claims, CancellationToken ct)
    {
        var lista = claims.Where(x => int.TryParse(x.CanonicalRecordId, out _)).ToList();
        var resultado = new Dictionary<(string, int), string>();
        int[] Ids(string modulo) => lista.Where(x => x.ModuloId == modulo).Select(x => int.Parse(x.CanonicalRecordId, CultureInfo.InvariantCulture)).Distinct().ToArray();
        var festivales = Ids(Festival); var mercados = Ids(Modulos.Mercados); var talleres = Ids(Modulos.Talleres); var espacios = Ids(Modulos.Espacios); var redes = Ids(Modulos.Redes);
        if (festivales.Length > 0)
            foreach (var f in await db.FestivalRecords.AsNoTracking().Where(x => festivales.Contains(x.Id)).Select(x => new { x.Id, x.Name }).ToListAsync(ct)) resultado[(Festival, f.Id)] = f.Name;
        if (mercados.Length > 0)
            foreach (var m in await db.Mercados.AsNoTracking().Where(x => mercados.Contains(x.Id)).Select(x => new { x.Id, x.Nombre }).ToListAsync(ct)) resultado[(Modulos.Mercados, m.Id)] = m.Nombre;
        if (talleres.Length > 0)
            foreach (var m in await db.Talleres.AsNoTracking().Where(x => talleres.Contains(x.Id)).Select(x => new { x.Id, x.Nombre }).ToListAsync(ct)) resultado[(Modulos.Talleres, m.Id)] = m.Nombre;
        if (espacios.Length > 0)
            foreach (var m in await db.Espacios.AsNoTracking().Where(x => espacios.Contains(x.Id)).Select(x => new { x.Id, x.Nombre }).ToListAsync(ct)) resultado[(Modulos.Espacios, m.Id)] = m.Nombre;
        if (redes.Length > 0)
            foreach (var m in await db.Redes.AsNoTracking().Where(x => redes.Contains(x.Id)).Select(x => new { x.Id, x.Nombre }).ToListAsync(ct)) resultado[(Modulos.Redes, m.Id)] = m.Nombre;
        return resultado;
    }

    internal static string? NombreDe(Dictionary<(string Modulo, int Id), string> nombres, AdministrationClaimRow claim) =>
        int.TryParse(claim.CanonicalRecordId, out var id) && nombres.TryGetValue((claim.ModuloId, id), out var nombre) ? nombre : null;

    private static async Task<string> NombreDelFestivalAsync(SimusDbContext db, AdministrationClaimRow claim, CancellationToken ct) =>
        NombreDe(await NombresDeProcesoAsync(db, [claim], ct), claim) ?? "el proceso";

    /// <summary>El nombre del proceso y si se puede reclamar: publicado y a nombre de la organización institucional.</summary>
    private static async Task<(string? Nombre, bool Reclamable)> RegistroReclamableAsync(SimusDbContext db, string modulo, int id, CancellationToken ct)
    {
        if (modulo != Festival)
        {
            var proceso = await CargarSimpleAsync(db, modulo, id, false, ct);
            return proceso is null ? (null, false) : (proceso.Nombre, proceso.EsReclamable(await IdInstitucionalAsync(db, ct)));
        }
        var festival = await db.FestivalRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return festival is null ? (null, false) : (festival.Name, await EsReclamable(db, festival, ct));
    }

    /// <summary>La consola decide sobre un proceso que no es un Festival con lo esencial: el proceso, la organización y las aclaraciones. Sin conciliación ni duplicados.</summary>
    private static async Task<IResult> DetalleDeProcesoSimpleAsync(AdministrationClaimRow claim, int procesoId, SimusDbContext db, CancellationToken ct)
    {
        var mercado = await CargarSimpleAsync(db, claim.ModuloId, procesoId, false, ct);
        if (mercado is null) return Results.NotFound();
        var organizacion = await db.EntityProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == claim.RequestingOrganizationId, ct);
        if (organizacion is null) return Results.NotFound();
        var institucional = await IdInstitucionalAsync(db, ct);
        var lugares = await LugaresAsync(db, [mercado.Departamento, organizacion.HeadquartersDepartmentCode], ct);
        var (depMercado, munMercado) = Lugar(lugares, mercado.Departamento, mercado.Municipio);
        var (depSede, munSede) = Lugar(lugares, organizacion.HeadquartersDepartmentCode, organizacion.HeadquartersMunicipalityCode);
        var anios = await AniosDeEdicionesAsync(db, claim.ModuloId, procesoId, ct);
        var procedencia = await ProcedenciaDeRegistro.LeerAsync(db, claim.ModuloId, claim.CanonicalRecordId, ct);
        var administradores = await db.UserEntities.AsNoTracking().CountAsync(x => x.EntityId == organizacion.Id && x.IsActive && x.EntityRole == "administrador", ct);
        var solicitante = await db.Users.AsNoTracking().Where(x => x.Id == claim.RequestingPersonId).Select(x => x.FullName).FirstOrDefaultAsync(ct);
        var aclaraciones = await db.AdministrationClaimClarifications.AsNoTracking().Where(x => x.ClaimId == claim.Id).OrderBy(x => x.RequestedAt)
            .Select(x => new AclaracionDeReclamacionDto(x.Comment, x.RequestedAt, x.Response, x.RespondedAt)).ToListAsync(ct);
        var otras = await db.AdministrationClaims.AsNoTracking()
            .Where(x => x.ModuloId == claim.ModuloId && x.CanonicalRecordId == claim.CanonicalRecordId && x.Id != claim.Id)
            .OrderByDescending(x => x.UpdatedAt).Take(10).ToListAsync(ct);
        var idsOrg = otras.Select(x => x.RequestingOrganizationId).Distinct().ToArray();
        var nombresOrg = idsOrg.Length == 0 ? new Dictionary<int, string>()
            : await db.EntityProfiles.AsNoTracking().Where(x => idsOrg.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var relacionadas = otras.Select(otra => new RelacionadaConLaReclamacionDto(claim.CanonicalRecordId, mercado.Nombre, munMercado, "Otra solicitud sobre este proceso",
            otra.Id.ToString(CultureInfo.InvariantCulture), otra.Status, nombresOrg.GetValueOrDefault(otra.RequestingOrganizationId))).ToList();
        var soportes = await SoportesDeAsync(db, [claim.Id], ct);
        return Results.Ok(new DetalleReclamacionAdministracionDto(
            ClaimDto(claim) with { RegistroNombre = mercado.Nombre, OrganizacionSolicitanteNombre = organizacion.Name, Soportes = soportes.GetValueOrDefault(claim.Id, []) },
            new FestivalDeLaReclamacionDto(mercado.Id.ToString(CultureInfo.InvariantCulture), mercado.Nombre, mercado.Descripcion, mercado.Estado,
                mercado.Cobertura, depMercado, munMercado, mercado.Periodicidad,
                institucional is not null && mercado.Organizacion == institucional, procedencia?.ContextoEtiqueta, anios),
            new OrganizacionDeLaReclamacionDto(organizacion.Id.ToString(CultureInfo.InvariantCulture), organizacion.Name, depSede, munSede,
                organizacion.StatusCode, organizacion.IsActive, organizacion.CreatedAt, administradores, solicitante),
            [], aclaraciones, relacionadas));
    }

    /// <summary>La ficha pública cambia de organización responsable: la caché no puede seguir diciendo la anterior.</summary>
    private static async Task InvalidarCacheAsync(HttpContext http, CancellationToken ct)
    {
        if (http.RequestServices.GetService(typeof(IOutputCacheStore)) is IOutputCacheStore cache)
            await CachePublicaFestivales.InvalidarAsync(cache, ct);
    }

    internal static Task<int?> IdInstitucionalAsync(SimusDbContext db, CancellationToken ct) =>
        db.EntityProfiles.AsNoTracking().Where(x => x.IsInstitutional).Select(x => (int?)x.Id).FirstOrDefaultAsync(ct);

    private static async Task<bool> EsReclamable(SimusDbContext db, FestivalRow festival, CancellationToken ct)
    {
        var institutional = await IdInstitucionalAsync(db, ct);
        return institutional is not null && festival.OrganizacionPrincipalId == institutional
            && (festival.StatusCode == EstadosFestival.Publicado || festival.StatusCode == "Publicado");
    }

    private static int? Persona(ClaimsPrincipal principal) => int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    // LA REGLA VIVE EN `AdministracionDeOrganizacion` (comprueba también que la organización siga
    // activa). El borrador y la lista los ve también un editor; presentar, responder, cancelar y
    // conciliar piden administrar (docs/desarrollo/19-cuentas-y-organizaciones.md §19.3).
    private static Task<bool> Edita(SimusDbContext db, int user, int organization, CancellationToken ct) =>
        AdministracionDeOrganizacion.PuedeEditarAsync(db, user, organization, ct);

    private static Task<bool> Administra(SimusDbContext db, int user, int organization, CancellationToken ct) =>
        AdministracionDeOrganizacion.PuedeAdministrarAsync(db, user, organization, ct);

    private static BorradorProcesoDto Dto(BorradorDeProcesoRow x) => new(x.Id.ToString(CultureInfo.InvariantCulture), x.ModuloId, x.OrganizacionId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty, x.Estado, x.DatosJson, x.Version, x.FechaActualizacion);

    private static ReclamacionAdministracionDto ClaimDto(AdministrationClaimRow x) => new(x.Id.ToString(CultureInfo.InvariantCulture), x.ModuloId, x.CanonicalRecordId, x.RequestingOrganizationId.ToString(CultureInfo.InvariantCulture), x.Status, x.Justification, x.SignalsJson, x.DecisionReason, x.CreatedAt, x.SubmittedAt, x.DecidedAt);

    /// <summary>
    /// Deja la acción en la bitácora con uno de los trece verbos que admite.
    /// </summary>
    /// <remarks>
    /// <b>CADA ACCIÓN DE ESTE FICHERO FALLABA EN SQL SERVER.</b> Escribía el nombre del
    /// evento («ReclamacionEnviada») en <c>Accion</c>, que <c>CK_BitacoraAuditoria_Accion</c> cierra a
    /// trece verbos, y el estado suelto («enviada») en columnas que exigen JSON. Mismo criterio que
    /// <see cref="AccionesAuditoria"/>: el verbo técnico va en la columna y el evento, en el cuerpo.
    /// </remarks>
    private static void Auditar(SimusDbContext db, int actor, string record, string evento, string? before, string? after, int soportes = 0) => db.AuditLogs.Add(new AuditLogRow
    {
        UserId = actor,
        TableName = "ReclamacionesAdministracion",
        RecordId = record,
        Action = VerboDeAuditoria(evento),
        PreviousValuesJson = before is null ? null : JsonSerializer.Serialize(new { estado = before }),
        NewValuesJson = soportes > 0
            ? JsonSerializer.Serialize(new { evento, estado = after, soportes })
            : JsonSerializer.Serialize(new { evento, estado = after }),
        CreatedAt = DateTime.UtcNow,
    });

    /// <summary>El verbo de <c>CK_BitacoraAuditoria_Accion</c> que corresponde a cada evento.</summary>
    public static string VerboDeAuditoria(string evento) => evento switch
    {
        "ReclamacionEnviada" => AccionesAuditoria.Crear,
        "ReclamacionRechazada" => AccionesAuditoria.Rechazar,
        "ReclamacionAprobadaPendienteConciliacion" => AccionesAuditoria.Aprobar,
        _ => AccionesAuditoria.Actualizar,
    };

    /// <summary>
    /// El texto de una persona dentro de un aviso, acotado: <c>Notificaciones.Cuerpo</c> admite 2000
    /// caracteres y el motivo o la pregunta pueden llegar a 2400. Sin esto, SQL Server rechazaba el
    /// aviso (y con él la decisión) cuando alguien escribía un texto largo.
    /// </summary>
    private static string Recortar(string? texto)
    {
        var limpio = (texto ?? string.Empty).Trim();
        return limpio.Length <= MaximoDeTextoEnAviso ? limpio : limpio[..(MaximoDeTextoEnAviso - 1)].TrimEnd() + "…";
    }

    private const int MaximoDeTextoEnAviso = 1500;

    private static void Notificar(SimusDbContext db, int recipient, string type, string title, string body, long record) => db.Notifications.Add(new NotificationRow { RecipientUserId = recipient, EventType = type, Channel = "internal", Title = title, Body = body, Status = "enviada", ModuloId = "reclamaciones-administracion", RecordId = record.ToString(CultureInfo.InvariantCulture), CreatedAt = DateTime.UtcNow, SentAt = DateTime.UtcNow });
}
