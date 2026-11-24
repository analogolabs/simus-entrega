using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Una solicitud, un trámite o un asunto abierto de una persona o de una organización: lo que espera su acción,
/// lo que espera al Programa y lo ya resuelto (SOL).
/// </summary>
/// <param name="Espera"><c>tu_accion</c>, <c>en_espera</c> o <c>resuelta</c>.</param>
/// <param name="Tipo">Clave estable del tipo, para filtrar: <c>festival</c>, <c>propuesta</c>, <c>retiro</c>, <c>mercado</c>, <c>evento</c>, <c>proceso</c>, <c>acceso</c>, <c>cita</c>, <c>invitacion</c>.</param>
/// <param name="Ruta">Dirección del sitio donde se atiende; la arma el servidor para que la plantilla no la deduzca.</param>
public sealed record SolicitudDeLaCuentaDto(
    string Clave, string Tipo, string TipoEtiqueta, string Titulo, string Espera, string EstadoEtiqueta,
    string? Detalle, int? OrganizacionId, string? OrganizacionNombre, DateTime Fecha, string Ruta);

/// <summary>Cuántos asuntos hay de cada clase; es lo que pinta la insignia del menú del panel.</summary>
public sealed record ConteoDeSolicitudesDto(int EsperanTuAccion, int EsperanRespuesta, int Resueltas);

/// <summary>
/// «Mi actividad y solicitudes» de la cuenta y la insignia de Solicitudes de una organización.
/// </summary>
/// <remarks>
/// <para>
/// <b>NO HAY TABLA NUEVA.</b> Todo sale de lo que ya guarda cada circuito: Festivales, propuestas de cambio,
/// retiros, Mercados, eventos, procesos de lutería, espacios y redes, solicitudes de administración, citas e
/// invitaciones. Esta clase solo los lee y los ordena con un vocabulario común. Nada se escribe, nada se borra.
/// </para>
/// <para>
/// <b>SIEMPRE LA PROPIA CUENTA.</b> La persona sale de la sesión; una organización solo se lee si la persona la
/// edita. Los datos personales de otras personas no viajan: de una cita se dice el estado y la agenda, no el
/// contacto del otro lado.
/// </para>
/// </remarks>
public static class SolicitudesDeLaCuentaEndpoints
{
    /// <summary>Hasta cuándo una solicitud resuelta sigue a la vista; después sigue guardada, solo deja de listarse.</summary>
    internal const int DiasDeLasResueltas = 90;

    public static RouteGroupBuilder MapSolicitudesDeLaCuentaEndpoints(this RouteGroupBuilder api)
    {
        var externo = api.MapGroup("/externo").WithTags("solicitudes-de-la-cuenta");
        externo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        externo.MapGet("/cuenta/solicitudes", ListarDeLaCuentaAsync).WithName("MisSolicitudes");
        externo.MapGet("/organizaciones/{organizacionId:int}/solicitudes", ListarDeLaOrganizacionAsync).WithName("SolicitudesDeLaOrganizacion");
        externo.MapGet("/organizaciones/{organizacionId:int}/solicitudes/conteo", ConteoDeLaOrganizacionAsync).WithName("ConteoDeSolicitudesDeLaOrganizacion");
        return api;
    }

    private static async Task<IResult> ListarDeLaCuentaAsync(ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct, bool archivadas = false)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        var organizaciones = await db.UserEntities.AsNoTracking()
            .Where(v => v.UserId == persona && RolesDeEntidad.Miembros.Contains(v.EntityRole) && v.IsActive)
            .Join(db.EntityProfiles.AsNoTracking().Where(e => e.IsActive), v => v.EntityId, e => e.Id, (_, e) => new { e.Id, e.Name })
            .ToListAsync(ct);

        var items = new List<SolicitudDeLaCuentaDto>();
        foreach (var organizacion in organizaciones.OrderBy(o => o.Name))
            items.AddRange(await DeLaOrganizacionAsync(db, persona.Value, organizacion.Id, organizacion.Name, ct));
        items.AddRange(await ProcesosPropiosAsync(db, persona.Value, ct));
        items.AddRange(await EventosPropiosAsync(db, persona.Value, ct));
        items.AddRange(await CitasAsync(db, persona.Value, ct));
        items.AddRange(await InvitacionesAsync(db, persona.Value, ct));
        return Results.Ok(Ordenar(items, archivadas));
    }

    private static async Task<IResult> ListarDeLaOrganizacionAsync(
        int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct, bool archivadas = false)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        var nombre = await db.EntityProfiles.AsNoTracking().Where(e => e.Id == organizacionId).Select(e => e.Name).FirstOrDefaultAsync(ct);
        return Results.Ok(Ordenar(await DeLaOrganizacionAsync(db, persona.Value, organizacionId, nombre ?? string.Empty, ct), archivadas));
    }

    /// <summary>
    /// LA INSIGNIA DEL MENÚ. Cuenta lo mismo que lista, no una consulta aparte: así el número del menú y el de la
    /// pantalla no pueden contradecirse. Cuenta solo lo que está abierto (lo resuelto no es pendiente).
    /// </summary>
    private static async Task<IResult> ConteoDeLaOrganizacionAsync(
        int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        var items = await DeLaOrganizacionAsync(db, persona.Value, organizacionId, string.Empty, ct);
        return Results.Ok(Contar(items));
    }

    internal static ConteoDeSolicitudesDto Contar(IEnumerable<SolicitudDeLaCuentaDto> items)
    {
        var lista = items.ToList();
        return new ConteoDeSolicitudesDto(
            lista.Count(i => i.Espera == "tu_accion"), lista.Count(i => i.Espera == "en_espera"), lista.Count(i => i.Espera == "resuelta"));
    }

    /// <summary>
    /// Por omisión, lo pendiente y lo resuelto hace menos de <see cref="DiasDeLasResueltas"/> días. Con
    /// <paramref name="archivadas"/> (<c>?archivadas=true</c>), SOLO las resueltas hace más de ese plazo, las más
    /// recientes primero. Nada se borra: es la misma lectura con el corte al revés. Los conteos y la insignia no cambian.
    /// </summary>
    private static List<SolicitudDeLaCuentaDto> Ordenar(IEnumerable<SolicitudDeLaCuentaDto> items, bool archivadas = false)
    {
        var limite = DateTime.UtcNow.AddDays(-DiasDeLasResueltas);
        if (archivadas)
            return items.Where(i => i.Espera == "resuelta" && i.Fecha < limite).OrderByDescending(i => i.Fecha).ToList();
        return items
            .Where(i => i.Espera != "resuelta" || i.Fecha >= limite)
            .OrderBy(i => i.Espera == "tu_accion" ? 0 : i.Espera == "en_espera" ? 1 : 2)
            .ThenByDescending(i => i.Fecha)
            .ToList();
    }

    private static string Id(long valor) => valor.ToString(CultureInfo.InvariantCulture);

    private static SolicitudDeLaCuentaDto Item(
        string clave, string tipo, string tipoEtiqueta, string titulo, string espera, string estado, string? detalle,
        int? organizacionId, string? organizacionNombre, DateTime fecha, string ruta) =>
        new(clave, tipo, tipoEtiqueta, titulo, espera, estado, detalle, organizacionId,
            string.IsNullOrEmpty(organizacionNombre) ? null : organizacionNombre, fecha, ruta);

    /// <summary>De un estado de registro (Festival, Mercado, proceso) a quién espera. <c>null</c>: no es una solicitud.</summary>
    private static (string Espera, string Etiqueta)? DeEstado(string? estado, bool conBorrador = false)
    {
        var normal = (estado ?? string.Empty).Replace("_", string.Empty).Replace("-", string.Empty).Replace(" ", string.Empty).ToLowerInvariant();
        return normal switch
        {
            "enrevision" => ("en_espera", "En revisión"),
            "ajustessolicitados" => ("tu_accion", "Ajustes pedidos"),
            "rechazado" or "rechazada" => ("resuelta", "Rechazado"),
            "borrador" when conBorrador => ("tu_accion", "Borrador sin enviar"),
            _ => null,
        };
    }

    // ───────────────────────────── Lo de una organización ─────────────────────────────

    private static async Task<List<SolicitudDeLaCuentaDto>> DeLaOrganizacionAsync(
        SimusDbContext db, int persona, int organizacionId, string organizacion, CancellationToken ct)
    {
        var raiz = $"/gestion/o/{organizacionId}";
        var items = new List<SolicitudDeLaCuentaDto>();

        var festivales = await db.FestivalRecords.AsNoTracking()
            .Where(f => f.OrganizacionPrincipalId == organizacionId && f.StatusCode != EstadosFestival.Archivado && f.StatusCode != "Archivado")
            .Select(f => new { f.Id, f.Name, f.StatusCode, Fecha = f.UpdatedAt ?? f.CreatedAt })
            .ToListAsync(ct);
        foreach (var f in festivales)
            if (DeEstado(f.StatusCode) is { } e)
                items.Add(Item($"festival-{f.Id}", "festival", "Festival", f.Name, e.Espera, e.Etiqueta,
                    e.Espera == "en_espera" ? "El PNMC lo está revisando." : e.Espera == "tu_accion" ? "El PNMC pidió ajustes." : null,
                    organizacionId, organizacion, f.Fecha,
                    // Los ajustes pedidos se atienden en la pestaña de la información, con los campos señalados.
                    $"{raiz}/procesos/festivales/{f.Id}" + (e.Espera == "tu_accion" ? "?seccion=informacion&ajustes=1" : string.Empty)));

        var idsFestival = festivales.Select(f => f.Id.ToString(CultureInfo.InvariantCulture)).ToList();
        var nombresFestival = festivales.ToDictionary(f => f.Id.ToString(CultureInfo.InvariantCulture), f => f.Name);

        var mercados = await db.Mercados.AsNoTracking()
            .Where(m => m.OrganizacionPrincipalId == organizacionId && m.Activo)
            .Select(m => new { m.Id, m.Nombre, m.EstadoRegistro, Fecha = m.FechaActualizacion ?? m.FechaCreacion })
            .ToListAsync(ct);
        foreach (var m in mercados)
            if (DeEstado(m.EstadoRegistro) is { } e)
                items.Add(Item($"mercado-{m.Id}", "mercado", "Mercado", m.Nombre, e.Espera, e.Etiqueta,
                    e.Espera == "en_espera" ? "El PNMC lo está revisando." : e.Espera == "tu_accion" ? "El PNMC pidió ajustes." : null,
                    organizacionId, organizacion, m.Fecha, $"{raiz}/procesos/mercados/{m.Id}"));
        var nombresMercado = mercados.ToDictionary(m => m.Id.ToString(CultureInfo.InvariantCulture), m => m.Nombre);

        // Propuestas de cambio vivas: lo ya publicado se corrige con una propuesta, no editando. Son las de Festival, Mercado,
        // Taller, Espacio y Red (PROP, decisión 122).
        var propuestas = await db.PropuestasDeCambio.AsNoTracking()
            .Where(p => p.IdOrganizacion == organizacionId
                && (p.Estado == EstadosDePropuesta.EnRevision || p.Estado == EstadosDePropuesta.AjustesSolicitados))
            .Select(p => new { p.Id, p.ModuloId, p.RegistroId, p.Estado, Fecha = p.FechaActualizacion ?? p.FechaCreacion })
            .ToListAsync(ct);
        var nombresDePropuestas = await NombresDeLasPropuestasAsync(db, propuestas.Select(p => (p.ModuloId, p.RegistroId)), ct);
        foreach (var p in propuestas)
        {
            var titulo = nombresDePropuestas.GetValueOrDefault((p.ModuloId, p.RegistroId))
                ?? nombresFestival.GetValueOrDefault(p.RegistroId) ?? "Proceso";
            items.Add(Propuesta(p.Id, p.ModuloId, p.RegistroId, p.Estado, titulo, p.Fecha, organizacionId, organizacion, raiz));
        }

        // Retiros de un Festival.
        var retiros = idsFestival.Count == 0 ? [] : await db.RecordLinkRequests.AsNoTracking()
            .Where(r => r.ModuloId == "festivales_retiro" && idsFestival.Contains(r.RecordId)
                && (r.Status == "pendiente" || r.Status == "en_revision" || r.Status == "ajustes_solicitados"))
            .Select(r => new { r.Id, r.RecordId, r.Status, Fecha = r.UpdatedAt })
            .ToListAsync(ct);
        foreach (var r in retiros)
        {
            var porAtender = r.Status == "ajustes_solicitados";
            items.Add(Item($"retiro-{r.Id}", "retiro", "Solicitud de retiro", nombresFestival.GetValueOrDefault(r.RecordId) ?? "Festival",
                porAtender ? "tu_accion" : "en_espera", porAtender ? "Ajustes pedidos" : "En revisión",
                "Pediste retirarlo; el PNMC decide.", organizacionId, organizacion, r.Fecha, $"{raiz}/procesos/festivales/{r.RecordId}"));
        }

        // Solicitudes de administración de un proceso histórico (Festival o Mercado, decisión 129).
        var reclamaciones = await db.AdministrationClaims.AsNoTracking()
            .Where(c => c.RequestingOrganizationId == organizacionId && c.Status != "borrador")
            .ToListAsync(ct);
        var nombresDeProcesos = await ReclamacionesAdministracionEndpoints.NombresDeProcesoAsync(db, reclamaciones, ct);
        foreach (var c in reclamaciones)
        {
            var tipo = TiposDeProcesoHistorico.De(c.ModuloId);
            var queEs = tipo is null || c.ModuloId == Modulos.Festivales ? "el Festival" : $"el proceso ({tipo.Etiqueta.ToLowerInvariant()})";
            var (espera, etiqueta, detalle) = c.Status switch
            {
                "requiere_aclaracion" => ("tu_accion", "Requiere aclaración", "El PNMC pregunta algo; respóndelo para continuar."),
                "aprobada" => ("tu_accion", "Aprobada: falta elegir datos", "Elige qué datos conservar para terminar."),
                "enviada" or "en_revision" or "aclaracion_enviada" => ("en_espera", c.Status == "aclaracion_enviada" ? "Aclaración enviada" : "En revisión", $"El PNMC revisa tu solicitud para administrar {queEs}."),
                "rechazada" => ("resuelta", "Rechazada", c.DecisionReason),
                "cancelada" => ("resuelta", "Cancelada", "La organización la canceló."),
                "transferencia_ejecutada" => ("resuelta", "Administración transferida", $"La organización ya administra {queEs}."),
                _ => ("resuelta", "Cerrada", (string?)null),
            };
            var nombre = ReclamacionesAdministracionEndpoints.NombreDe(nombresDeProcesos, c)
                ?? $"{tipo?.Etiqueta ?? "Festival"} #{c.CanonicalRecordId}";
            items.Add(Item($"acceso-{c.Id}", "acceso", "Acceso a un proceso histórico", nombre,
                espera, etiqueta, detalle, organizacionId, organizacion, c.UpdatedAt, $"{raiz}/solicitudes?solicitud={c.Id}"));
        }

        // Procesos de lutería, espacios y redes de la organización.
        items.AddRange((await db.Talleres.AsNoTracking().Where(t => t.OrganizacionPrincipalId == organizacionId && t.Activo)
            .Select(t => new { t.Id, t.Nombre, t.EstadoRegistro, Fecha = t.FechaActualizacion ?? t.FechaCreacion }).ToListAsync(ct))
            .Select(t => Proceso("taller", "Taller de lutería", t.Id, t.Nombre, t.EstadoRegistro, t.Fecha, organizacionId, organizacion, $"{raiz}/procesos/luteria/{t.Id}"))
            .OfType<SolicitudDeLaCuentaDto>());
        items.AddRange((await db.Espacios.AsNoTracking().Where(t => t.OrganizacionPrincipalId == organizacionId && t.Activo)
            .Select(t => new { t.Id, t.Nombre, t.EstadoRegistro, Fecha = t.FechaActualizacion ?? t.FechaCreacion }).ToListAsync(ct))
            .Select(t => Proceso("espacio", "Espacio para música en vivo", t.Id, t.Nombre, t.EstadoRegistro, t.Fecha, organizacionId, organizacion, $"{raiz}/procesos/espacios/{t.Id}"))
            .OfType<SolicitudDeLaCuentaDto>());
        items.AddRange((await db.Redes.AsNoTracking().Where(t => t.OrganizacionPrincipalId == organizacionId && t.Activo)
            .Select(t => new { t.Id, t.Nombre, t.EstadoRegistro, Fecha = t.FechaActualizacion ?? t.FechaCreacion }).ToListAsync(ct))
            .Select(t => Proceso("red", "Red o documentación", t.Id, t.Nombre, t.EstadoRegistro, t.Fecha, organizacionId, organizacion, $"{raiz}/procesos/redes/{t.Id}"))
            .OfType<SolicitudDeLaCuentaDto>());

        // Eventos de sus procesos.
        var eventos = await ProcesoDelEvento.DelAlcance(db, new AlcanceDeEventos(organizacionId, persona), rastrear: false)
            .Select(e => new { e.Id, e.Titulo, e.Estado, e.Cancelado, Fecha = e.FechaActualizacion })
            .ToListAsync(ct);
        items.AddRange(eventos.Where(e => !e.Cancelado).Select(e => DeEvento(e.Id, e.Titulo, e.Estado, e.Fecha, organizacionId, organizacion, $"{raiz}/eventos"))
            .OfType<SolicitudDeLaCuentaDto>());

        return items;
    }

    /// <summary>Una propuesta de cambio viva, con la ruta de la ficha donde se atiende (la misma que la del proceso).</summary>
    private static SolicitudDeLaCuentaDto Propuesta(
        long id, string modulo, string registroId, string estado, string titulo, DateTime fecha,
        int? organizacionId, string? organizacion, string raiz)
    {
        var porAtender = estado == EstadosDePropuesta.AjustesSolicitados;
        var ruta = organizacionId is null
            ? modulo switch
            {
                Modulos.Talleres => $"{raiz}/talleres/{registroId}",
                Modulos.Espacios => $"{raiz}/espacios/{registroId}",
                Modulos.Redes => $"{raiz}/redes/{registroId}",
                _ => raiz,
            }
            : modulo switch
            {
                Modulos.Mercados => $"{raiz}/procesos/mercados/{registroId}",
                Modulos.Talleres => $"{raiz}/procesos/luteria/{registroId}",
                Modulos.Espacios => $"{raiz}/procesos/espacios/{registroId}",
                Modulos.Redes => $"{raiz}/procesos/redes/{registroId}",
                _ => $"{raiz}/procesos/festivales/{registroId}",
            };
        return Item($"propuesta-{id}", "propuesta", "Propuesta de cambios", titulo,
            porAtender ? "tu_accion" : "en_espera", porAtender ? "Ajustes pedidos" : "En revisión",
            porAtender ? "El PNMC devolvió la propuesta con cambios pedidos." : "La propuesta de cambios está en revisión.",
            organizacionId, organizacion, fecha, ruta);
    }

    /// <summary>Los nombres de los procesos sobre los que hay propuestas, por (módulo, registro).</summary>
    private static async Task<Dictionary<(string Modulo, string Registro), string>> NombresDeLasPropuestasAsync(
        SimusDbContext db, IEnumerable<(string Modulo, string Registro)> propuestas, CancellationToken ct)
    {
        var nombres = new Dictionary<(string, string), string>();
        foreach (var grupo in propuestas.GroupBy(p => p.Modulo))
        {
            if (PropuestasDeCambioDeProcesoEndpoints.DelModulo(grupo.Key) is not { } proceso) continue;
            var ids = grupo.Select(g => int.TryParse(g.Registro, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : 0)
                .Where(id => id > 0).Distinct().ToList();
            foreach (var (id, nombre) in await proceso.NombresAsync(db, ids, ct))
                nombres[(grupo.Key, id.ToString(CultureInfo.InvariantCulture))] = nombre;
        }
        return nombres;
    }

    private static SolicitudDeLaCuentaDto? Proceso(
        string tipo, string etiqueta, int id, string nombre, string estado, DateTime fecha,
        int? organizacionId, string? organizacion, string ruta)
    {
        if (DeEstado(estado) is not { } e) return null;
        return Item($"{tipo}-{id}", tipo == "taller" || tipo == "espacio" || tipo == "red" ? "proceso" : tipo, etiqueta, nombre, e.Espera, e.Etiqueta,
            e.Espera == "en_espera" ? "El PNMC lo está revisando." : e.Espera == "tu_accion" ? "El PNMC pidió ajustes." : null,
            organizacionId, organizacion, fecha, ruta);
    }

    private static SolicitudDeLaCuentaDto? DeEvento(
        long id, string titulo, string estado, DateTime fecha, int? organizacionId, string? organizacion, string ruta)
    {
        if (DeEstado(estado) is not { } e) return null;
        return Item($"evento-{id}", "evento", "Evento de la Agenda", titulo, e.Espera, e.Etiqueta,
            e.Espera == "en_espera" ? "El PNMC lo está revisando." : e.Espera == "tu_accion" ? "El PNMC pidió ajustes." : null,
            organizacionId, organizacion, fecha, ruta);
    }

    // ───────────────────────────── Lo propio de la persona ─────────────────────────────

    private static async Task<List<SolicitudDeLaCuentaDto>> ProcesosPropiosAsync(SimusDbContext db, int persona, CancellationToken ct)
    {
        const string raiz = "/gestion/cuenta";
        var items = new List<SolicitudDeLaCuentaDto>();
        items.AddRange((await db.Talleres.AsNoTracking().Where(t => t.OrganizacionPrincipalId == null && t.UsuarioResponsableId == persona && t.Activo)
            .Select(t => new { t.Id, t.Nombre, t.EstadoRegistro, Fecha = t.FechaActualizacion ?? t.FechaCreacion }).ToListAsync(ct))
            .Select(t => Proceso("taller", "Taller de lutería", t.Id, t.Nombre, t.EstadoRegistro, t.Fecha, null, null, $"{raiz}/talleres/{t.Id}"))
            .OfType<SolicitudDeLaCuentaDto>());
        items.AddRange((await db.Espacios.AsNoTracking().Where(t => t.OrganizacionPrincipalId == null && t.UsuarioResponsableId == persona && t.Activo)
            .Select(t => new { t.Id, t.Nombre, t.EstadoRegistro, Fecha = t.FechaActualizacion ?? t.FechaCreacion }).ToListAsync(ct))
            .Select(t => Proceso("espacio", "Espacio para música en vivo", t.Id, t.Nombre, t.EstadoRegistro, t.Fecha, null, null, $"{raiz}/espacios/{t.Id}"))
            .OfType<SolicitudDeLaCuentaDto>());
        items.AddRange((await db.Redes.AsNoTracking().Where(t => t.OrganizacionPrincipalId == null && t.UsuarioResponsableId == persona && t.Activo)
            .Select(t => new { t.Id, t.Nombre, t.EstadoRegistro, Fecha = t.FechaActualizacion ?? t.FechaCreacion }).ToListAsync(ct))
            .Select(t => Proceso("red", "Red o documentación", t.Id, t.Nombre, t.EstadoRegistro, t.Fecha, null, null, $"{raiz}/redes/{t.Id}"))
            .OfType<SolicitudDeLaCuentaDto>());
        // Sus propuestas de cambio sobre lo ya publicado.
        var propias = await db.PropuestasDeCambio.AsNoTracking()
            .Where(p => p.IdUsuarioResponsable == persona
                && (p.Estado == EstadosDePropuesta.EnRevision || p.Estado == EstadosDePropuesta.AjustesSolicitados))
            .Select(p => new { p.Id, p.ModuloId, p.RegistroId, p.Estado, Fecha = p.FechaActualizacion ?? p.FechaCreacion })
            .ToListAsync(ct);
        var nombresPropios = await NombresDeLasPropuestasAsync(db, propias.Select(p => (p.ModuloId, p.RegistroId)), ct);
        items.AddRange(propias.Select(p => Propuesta(
            p.Id, p.ModuloId, p.RegistroId, p.Estado, nombresPropios.GetValueOrDefault((p.ModuloId, p.RegistroId)) ?? "Proceso",
            p.Fecha, null, null, raiz)));
        return items;
    }

    private static async Task<List<SolicitudDeLaCuentaDto>> EventosPropiosAsync(SimusDbContext db, int persona, CancellationToken ct)
    {
        var eventos = await ProcesoDelEvento.DelAlcance(db, new AlcanceDeEventos(null, persona), rastrear: false)
            .Select(e => new { e.Id, e.Titulo, e.Estado, e.Cancelado, Fecha = e.FechaActualizacion })
            .ToListAsync(ct);
        return eventos.Where(e => !e.Cancelado)
            .Select(e => DeEvento(e.Id, e.Titulo, e.Estado, e.Fecha, null, null, "/gestion/cuenta/eventos"))
            .OfType<SolicitudDeLaCuentaDto>().ToList();
    }

    /// <summary>
    /// Las citas del agendamiento de la persona. Quien recibe la solicitud es quien debe responder; el otro lado
    /// espera. De la otra persona solo se dice que existe una cita, no su nombre ni su contacto.
    /// </summary>
    private static async Task<List<SolicitudDeLaCuentaDto>> CitasAsync(SimusDbContext db, int persona, CancellationToken ct)
    {
        var yo = await db.ParticipantesDeCitas.AsNoTracking().Where(p => p.UsuarioId == persona).Select(p => p.Id).ToListAsync(ct);
        if (yo.Count == 0) return [];

        var citas = await db.CitasDeAgenda.AsNoTracking()
            .Where(c => yo.Contains(c.AnfitrionId) || yo.Contains(c.VisitanteId))
            .Select(c => new { c.Id, c.AgendaId, c.AnfitrionId, c.Estado, c.VenceUtc, Fecha = c.FechaActualizacion ?? c.FechaSolicitud })
            .ToListAsync(ct);
        // UNA SOLICITUD VENCIDA YA NO ES TRABAJO DE NADIE. El vencimiento real corre perezoso al abrir la agenda
        // (`ExpirarVencidasAsync`); aquí se lee con el mismo criterio sin escribir, para que la lista, el conteo y
        // la insignia no pidan responder una cita cuyo plazo ya pasó.
        var ahora = DateTime.UtcNow;
        var agendas = citas.Select(c => c.AgendaId).Distinct().ToList();
        var mercados = await db.AgendasDeCitas.AsNoTracking().Where(a => agendas.Contains(a.Id))
            .Join(db.EdicionesMercado.AsNoTracking(), a => a.EdicionMercadoId, e => e.Id, (a, e) => new { a.Id, e.MercadoId })
            .Join(db.Mercados.AsNoTracking(), x => x.MercadoId, m => m.Id, (x, m) => new { x.Id, m.Nombre })
            .ToDictionaryAsync(x => x.Id, x => x.Nombre, ct);

        return citas.Select(c =>
        {
            var recibe = yo.Contains(c.AnfitrionId);
            var estado = c.Estado == "solicitada" && c.VenceUtc is DateTime vence && vence <= ahora ? "vencida" : c.Estado;
            var (espera, etiqueta, detalle) = estado switch
            {
                "solicitada" when recibe => ("tu_accion", "Por responder", "Alguien pidió una cita contigo; confírmala o recházala."),
                "solicitada" => ("en_espera", "Esperando respuesta", "Pediste la cita; quien la recibe debe confirmarla."),
                "confirmada" => ("resuelta", "Confirmada", "La cita está confirmada."),
                "rechazada" => ("resuelta", "Rechazada", null),
                "cancelada" => ("resuelta", "Cancelada", null),
                "vencida" => ("resuelta", "Vencida", "No hubo respuesta a tiempo."),
                _ => ("resuelta", estado, (string?)null),
            };
            return Item($"cita-{c.Id}", "cita", "Cita del agendamiento", mercados.GetValueOrDefault(c.AgendaId) ?? "Agenda de citas",
                espera, etiqueta, detalle, null, null, estado == "vencida" && c.Estado == "solicitada" ? c.VenceUtc!.Value : c.Fecha, "/gestion/cuenta/agenda-de-citas");
        }).ToList();
    }

    /// <summary>Las invitaciones a una organización que esperan la respuesta de esta cuenta (solicitudes de acceso).</summary>
    private static async Task<List<SolicitudDeLaCuentaDto>> InvitacionesAsync(SimusDbContext db, int persona, CancellationToken ct)
    {
        var cuenta = await db.Users.AsNoTracking().Where(u => u.Id == persona && u.IsActive).Select(u => u.Email).FirstOrDefaultAsync(ct);
        var correo = CorreoElectronico.Normalizar(cuenta);
        if (correo is null) return [];
        var ahora = DateTime.UtcNow;
        var propias = await db.UserEntities.AsNoTracking().Where(v => v.UserId == persona && v.IsActive).Select(v => v.EntityId).ToListAsync(ct);
        var filas = await db.InvitacionesDeOrganizacion.AsNoTracking()
            .Where(i => i.CorreoInvitado == correo && i.Estado == EstadosDeInvitacion.Pendiente && i.FechaExpiracion > ahora && !propias.Contains(i.IdEntidad))
            .Join(db.EntityProfiles.AsNoTracking().Where(e => e.IsActive), i => i.IdEntidad, e => e.Id, (i, e) => new { i.Id, e.Name, i.FechaEmision })
            .ToListAsync(ct);
        return filas.Select(f => Item($"invitacion-{f.Id}", "invitacion", "Invitación a una organización", f.Name, "tu_accion", "Por aceptar",
            "Te invitaron a participar; se acepta con el enlace del correo.", null, null, f.FechaEmision, "/gestion/cuenta/organizaciones")).ToList();
    }
}
