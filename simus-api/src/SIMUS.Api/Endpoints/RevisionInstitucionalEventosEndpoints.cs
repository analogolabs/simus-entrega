using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Los eventos que una organización envió a la agenda y esperan decisión del Programa.
/// </summary>
/// <remarks>
/// <para>
/// <b>VIVE FUERA DEL MODULO «AGENDA», Y ESO ES DELIBERADO.</b> Revisar lo que una organización
/// entrega es trabajo de «Solicitudes y revisiones», que toda cuenta de consola tiene activado.
/// Colgarlo del módulo Agenda dejaría los eventos esperando en una bandeja que media plantilla no
/// puede abrir, exactamente como el circuito de revisión de ediciones de Festival, que por la misma
/// razón tampoco está detrás de un módulo.
/// </para>
/// <para>
/// <b>PUBLICAR COMPRUEBA LO QUE LA BASE EXIGE, ANTES DE INTENTARLO.</b>
/// <c>CK_EventosAgenda_DatosDeModalidad</c> solo aprieta cuando el estado es «publicado»: un
/// presencial necesita lugar, un virtual enlace, un mixto los dos. Sin comprobarlo aquí, publicar un
/// evento al que le falta el dato saldría como un 500 sin explicación —es el mismo defecto que se
/// corrigió en el alta externa— en vez de decir qué falta.
/// </para>
/// </remarks>
public static class RevisionInstitucionalEventosEndpoints
{
    private static readonly string[] DecisionDesconocida = ["La decisión debe ser publicar o devolver."];
    private static readonly string[] MotivoObligatorio = ["Di qué hay que corregir: sin motivo, el evento vuelve igual."];
    private static readonly string[] SoloEnRevision = ["Solo se decide sobre un evento que esté en revisión."];

    public static RouteGroupBuilder MapRevisionInstitucionalEventosEndpoints(this RouteGroupBuilder group)
    {
        var institucional = group.MapGroup("/institucional/revision-de-eventos")
            .WithTags("supervision-institucional-eventos");
        institucional.RequireAuthorization(Permisos.PoliticaFuncionario)
            // publicar o devolver un evento es trabajo de Agenda. Sin el módulo, ni la cola
            // ni la decisión: la bandeja no puede ser la puerta trasera de un apartado no concedido.
            .ExigeModulo("agenda");

        institucional.MapGet(string.Empty, ColaAsync).WithName("ColaDeEventosEnRevision");
        // PUBLICAR UN EVENTO DESDE LA BANDEJA VACÍA LA CACHÉ PÚBLICA (D3-16).
        institucional.MapPost("/{id:long}/decision", DecidirAsync).WithName("DecidirSobreEventoEnRevision")
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir);
        institucional.MapGet("/{id:long}/historial", HistorialAsync).WithName("HistorialDeEventoEnRevision")
            .Produces<List<EntradaDeHistorialDeEstadosDto>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        return group;
    }

    /// <summary>Lo que espera decisión, lo más antiguo primero.</summary>
    /// <remarks>
    /// EL ORDEN ES EL DE LA ESPERA y no el de creación: una bandeja de trabajo se atiende por
    /// antigüedad, y lo que lleva más tiempo esperando es lo que más urge.
    /// </remarks>
    private static async Task<IResult> ColaAsync(SimusDbContext db, CancellationToken ct)
    {
        var filas = await db.EventosAgenda.AsNoTracking()
            .Where(e => e.Estado == "en_revision")
            .OrderBy(e => e.FechaCreacion)
            .ToListAsync(ct);

        if (filas.Count == 0) return Results.Ok(Array.Empty<EventoEnRevisionDto>());

        var idsDeFestival = filas.Where(e => e.FestivalId != null).Select(e => e.FestivalId!.Value).Distinct().ToList();
        var festivales = await db.FestivalRecords.AsNoTracking()
            .Where(f => idsDeFestival.Contains(f.Id))
            .Select(f => new { f.Id, f.Name, f.OrganizacionPrincipalId })
            .ToListAsync(ct);

        // LOS EVENTOS DE MERCADO TAMBIEN LLEGAN AQUI.
        var idsDeMercado = filas.Where(e => e.MercadoId != null).Select(e => e.MercadoId!.Value).Distinct().ToList();
        var mercados = await db.Mercados.AsNoTracking()
            .Where(m => idsDeMercado.Contains(m.Id))
            .Select(m => new { m.Id, m.Nombre, m.OrganizacionPrincipalId })
            .ToListAsync(ct);

        // LOS EVENTOS DE TALLERES, ESPACIOS Y REDES TAMBIÉN LLEGAN AQUÍ (LUT-01).
        var idsDeTaller = filas.Where(e => e.TallerId != null).Select(e => e.TallerId!.Value).Distinct().ToList();
        var talleres = await db.Talleres.AsNoTracking()
            .Where(t => idsDeTaller.Contains(t.Id))
            .Select(t => new { t.Id, t.Nombre, t.OrganizacionPrincipalId, t.UsuarioResponsableId })
            .ToListAsync(ct);
        var idsDeEspacio = filas.Where(e => e.EspacioId != null).Select(e => e.EspacioId!.Value).Distinct().ToList();
        var espacios = await db.Espacios.AsNoTracking()
            .Where(t => idsDeEspacio.Contains(t.Id))
            .Select(t => new { t.Id, t.Nombre, t.OrganizacionPrincipalId, t.UsuarioResponsableId })
            .ToListAsync(ct);
        var idsDeRed = filas.Where(e => e.RedId != null).Select(e => e.RedId!.Value).Distinct().ToList();
        var redes = await db.Redes.AsNoTracking()
            .Where(t => idsDeRed.Contains(t.Id))
            .Select(t => new { t.Id, t.Nombre, t.OrganizacionPrincipalId, t.UsuarioResponsableId })
            .ToListAsync(ct);

        var idsDeOrganizacion = festivales.Where(f => f.OrganizacionPrincipalId != null)
            .Select(f => f.OrganizacionPrincipalId!.Value)
            .Concat(mercados.Select(m => m.OrganizacionPrincipalId))
            .Concat(talleres.Where(t => t.OrganizacionPrincipalId != null).Select(t => t.OrganizacionPrincipalId!.Value))
            .Concat(espacios.Where(t => t.OrganizacionPrincipalId != null).Select(t => t.OrganizacionPrincipalId!.Value))
            .Concat(redes.Where(t => t.OrganizacionPrincipalId != null).Select(t => t.OrganizacionPrincipalId!.Value))
            .Distinct().ToList();
        var idsDePersona = talleres.Where(t => t.UsuarioResponsableId != null).Select(t => t.UsuarioResponsableId!.Value)
            .Concat(espacios.Where(t => t.UsuarioResponsableId != null).Select(t => t.UsuarioResponsableId!.Value))
            .Concat(redes.Where(t => t.UsuarioResponsableId != null).Select(t => t.UsuarioResponsableId!.Value))
            .Distinct().ToList();
        var personas = idsDePersona.Count == 0
            ? new Dictionary<int, string>()
            : await db.Users.AsNoTracking().Where(u => idsDePersona.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        var organizaciones = await db.EntityProfiles.AsNoTracking()
            .Where(e => idsDeOrganizacion.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.Name, ct);

        var lista = filas.Select(e =>
        {
            var festival = e.FestivalId is null ? null : festivales.Find(f => f.Id == e.FestivalId.Value);
            var mercado = e.MercadoId is null ? null : mercados.Find(m => m.Id == e.MercadoId.Value);
            var taller = e.TallerId is null ? null : talleres.Find(t => t.Id == e.TallerId.Value);
            var espacio = e.EspacioId is null ? null : espacios.Find(t => t.Id == e.EspacioId.Value);
            var red = e.RedId is null ? null : redes.Find(t => t.Id == e.RedId.Value);
            var (procesoNombre, duenaOrganizacion, duenaPersona) =
                festival is not null ? (festival.Name, festival.OrganizacionPrincipalId, (int?)null)
                : mercado is not null ? (mercado.Nombre, mercado.OrganizacionPrincipalId, null)
                : taller is not null ? (taller.Nombre, taller.OrganizacionPrincipalId, taller.UsuarioResponsableId)
                : espacio is not null ? (espacio.Nombre, espacio.OrganizacionPrincipalId, espacio.UsuarioResponsableId)
                : red is not null ? (red.Nombre, red.OrganizacionPrincipalId, red.UsuarioResponsableId)
                : ((string?)null, (int?)null, (int?)null);
            var duenaId = duenaOrganizacion;
            var organizacion = duenaId is { } id && organizaciones.TryGetValue(id, out var nombre)
                ? nombre
                : null;
            return new EventoEnRevisionDto(
                e.Id.ToString(CultureInfo.InvariantCulture),
                e.Titulo,
                e.Descripcion,
                e.FechaInicio,
                e.FechaFin,
                e.Modalidad,
                e.Lugar,
                e.Url,
                e.NivelCobertura,
                e.FestivalId,
                festival?.Name,
                organizacion,
                e.FechaCreacion,
                LoQueFaltaParaPublicar(e),
                e.MercadoId,
                mercado?.Nombre,
                ProcesoDelEvento.TipoDe(e),
                procesoNombre,
                duenaOrganizacion is null && duenaPersona is int persona && personas.TryGetValue(persona, out var responsable)
                    ? responsable
                    : null);
        }).ToList();

        return Results.Ok(lista);
    }

    /// <summary>
    /// Qué le falta al evento para poder publicarse, dicho antes de intentarlo.
    /// </summary>
    /// <remarks>
    /// <b>VIAJA EN LA COLA Y NO SOLO AL DECIDIR.</b> Quien revisa tiene que poder ver, al abrir la
    /// lista, cuáles puede publicar y cuáles hay que devolver: enterarse al pulsar «publicar» es lo
    /// que convierte una bandeja en una sucesión de intentos.
    /// </remarks>
    private static string? LoQueFaltaParaPublicar(EventoAgendaRow evento)
    {
        var sinLugar = string.IsNullOrWhiteSpace(evento.Lugar);
        var sinEnlace = string.IsNullOrWhiteSpace(evento.Url);

        return evento.Modalidad switch
        {
            "presencial" when sinLugar => "Falta el lugar: un evento presencial no se publica sin decir dónde ocurre.",
            "virtual" when sinEnlace => "Falta el enlace: un evento virtual no se publica sin decir dónde conectarse.",
            "mixta" when sinLugar && sinEnlace => "Faltan el lugar y el enlace: un evento mixto necesita los dos.",
            "mixta" when sinLugar => "Falta el lugar: un evento mixto necesita el lugar y el enlace.",
            "mixta" when sinEnlace => "Falta el enlace: un evento mixto necesita el lugar y el enlace.",
            _ => null,
        };
    }

    /// <summary>
    /// El hilo de revisión del evento: quién lo envió, quién lo devolvió y por qué.
    /// </summary>
    /// <remarks>
    /// EN LA CONSOLA SE NOMBRA A TODOS, también a quien decidió: es la misma trazabilidad que la
    /// bitácora ya da a quien revisa.
    /// </remarks>
    private static async Task<IResult> HistorialAsync(long id, SimusDbContext db, CancellationToken ct)
    {
        if (!await db.EventosAgenda.AsNoTracking().AnyAsync(e => e.Id == id, ct)) return Results.NotFound();
        return Results.Ok(await HistorialDeEstados.LeerAsync(
            db, Modulos.Agenda, id.ToString(CultureInfo.InvariantCulture), vistoPorOrganizacion: null, ct));
    }

    private static async Task<IResult> DecidirAsync(
        long id,
        DecisionSobreEvento decision,
        ClaimsPrincipal principal,
        SimusDbContext db,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(decision);

        var evento = await db.EventosAgenda.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (evento is null) return Results.NotFound();

        if (!string.Equals(evento.Estado, "en_revision", StringComparison.Ordinal))
        {
            return Results.Conflict(new { message = SoloEnRevision[0], estado = evento.Estado });
        }

        var pedida = (decision.Decision ?? string.Empty).Trim().ToLowerInvariant();
        var motivo = string.IsNullOrWhiteSpace(decision.Motivo) ? null : decision.Motivo.Trim();

        if (pedida == "devolver" && motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = MotivoObligatorio,
            });
        }

        var ahora = DateTime.UtcNow;
        var estadoAnterior = evento.Estado;

        switch (pedida)
        {
            case "publicar":
                // LO QUE LA BASE EXIGE, COMPROBADO ANTES DE INTENTARLO.
                if (LoQueFaltaParaPublicar(evento) is { } falta)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
                    {
                        ["modalidad"] = [falta],
                    });
                }
                evento.Estado = "publicado";
                break;
            case "devolver":
                // VUELVE A BORRADOR, que es el único estado desde el que su organización puede
                // seguir trabajándolo. La agenda no tiene «ajustes solicitados»; el motivo viaja en
                // el aviso, que es donde la organización lo lee.
                evento.Estado = "borrador";
                break;
            default:
                return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
                {
                    ["decision"] = DecisionDesconocida,
                });
        }

        evento.FechaActualizacion = ahora;
        evento.Version += 1;

        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = Actor(principal),
            TableName = "EventosAgenda",
            RecordId = evento.Id.ToString(CultureInfo.InvariantCulture),
            Action = pedida == "publicar" ? AccionesAuditoria.Publicar : AccionesAuditoria.Rechazar,
            PreviousValuesJson = JsonSerializer.Serialize(new { estado = estadoAnterior }),
            NewValuesJson = JsonSerializer.Serialize(new { estado = evento.Estado, motivo }),
            CreatedAt = ahora,
        });

        // EL HILO DE REVISION, como Festivales y Mercados: quién decidió, de qué a qué y por qué.
        await HistorialDeEventosDeOrganizacion.AnotarAsync(
            db, evento, estadoAnterior,
            pedida == "publicar" ? HistorialDeEventosDeOrganizacion.Publicado : HistorialDeEventosDeOrganizacion.Devuelto,
            motivo, Actor(principal), ahora, ct);

        await AvisosDeEventosDeOrganizacion.AvisarAsync(db, evento, estadoAnterior, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new { id = evento.Id.ToString(CultureInfo.InvariantCulture), estado = evento.Estado });
    }

    private static int Actor(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), CultureInfo.InvariantCulture, out var id) ? id : 0;
}
