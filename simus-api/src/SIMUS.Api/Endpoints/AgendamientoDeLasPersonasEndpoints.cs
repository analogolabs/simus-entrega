using System.Globalization;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La agenda de citas vista por quien participa: el artista —o su representante— que se inscribe y el
/// comprador o booker que el Mercado invitó (docs/referencia/26-agenda-de-citas-y-mercados.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>SIEMPRE LA PROPIA CUENTA.</b> Ninguna ruta recibe «quién soy»: la persona sale de la cookie. Un
/// comprador invitado se reconoce porque su cuenta tiene el MISMO correo con el que el Mercado lo cargó, y
/// solo si ese correo está confirmado: una cuenta sin confirmar podría escribir el correo de otro y
/// reclamar su lugar.
/// </para>
/// <para>
/// <b>QUIEN ROTA PIDE; EL FIJO CONFIRMA.</b> En <c>compradores_rotan</c> los compradores piden y los
/// artistas confirman; en <c>compradores_fijos</c> es al revés. Una cita ocupa una franja de los dos y la
/// base impide que alguien tenga dos a la vez.
/// </para>
/// <para>
/// <b>LOS CONTACTOS SE VEN CON LA CITA CONFIRMADA</b>, no antes: el directorio de artistas y compradores de
/// una agenda no es una lista de contactos.
/// </para>
/// </remarks>
public static class AgendamientoDeLasPersonasEndpoints
{
    public static RouteGroupBuilder MapAgendamientoDeLasPersonasEndpoints(this RouteGroupBuilder api)
    {
        // Lo público: que la herramienta existe y si se puede uno inscribir. Nada de personas.
        api.MapGroup("/publico/agendas-de-citas").WithTags("agendamiento-publico").AllowAnonymous()
            .MapGet(string.Empty, ListarPublicas).WithName("ListarAgendasDeCitasPublicas");

        var externo = api.MapGroup("/externo/agendas-de-citas").WithTags("agendamiento-personas");
        externo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        externo.MapGet(string.Empty, ListarMias).WithName("ListarMisAgendasDeCitas");
        externo.MapGet("/{agendaId:int}", ObtenerMia).WithName("ObtenerMiAgendaDeCitas");
        externo.MapPost("/{agendaId:int}/inscripcion", Inscribirme).WithName("InscribirmeEnLaAgendaDeCitas");
        externo.MapPut("/{agendaId:int}/mi-foto", GuardarMiFoto).WithName("GuardarMiFotoEnLaAgendaDeCitas");
        externo.MapPut("/{agendaId:int}/mi-portafolio", GuardarMiPortafolio).WithName("GuardarMiPortafolioEnLaAgendaDeCitas");
        externo.MapPost("/{agendaId:int}/inscripcion/retirar", RetirarmeDeLaAgenda).WithName("RetirarmeDeLaAgendaDeCitas");
        externo.MapPost("/{agendaId:int}/citas", SolicitarCita).WithName("SolicitarCita");
        externo.MapPost("/{agendaId:int}/citas/{citaId:int}/confirmar", ConfirmarCita).WithName("ConfirmarCita");
        externo.MapPost("/{agendaId:int}/citas/{citaId:int}/rechazar", RechazarCita).WithName("RechazarCita");
        externo.MapPost("/{agendaId:int}/citas/{citaId:int}/cancelar", CancelarCita).WithName("CancelarCita");
        externo.MapGet("/{agendaId:int}/mi-agenda.ics", MiCalendario).WithName("CalendarioDeMiAgendaDeCitas");
        return api;
    }

    // ══════════════════════════════════════ Utilidades ══════════════════════════════════════

    private static bool InscripcionAbierta(AgendaDeCitasRow agenda, DateTime ahora) =>
        agenda.Estado == "abierta"
        && (agenda.AperturaInscripcionUtc is null || agenda.AperturaInscripcionUtc <= ahora)
        && (agenda.CierreInscripcionUtc is null || agenda.CierreInscripcionUtc > ahora);

    /// <summary>El correo de la cuenta puede reclamar una invitación: está confirmado, o el entorno lo dispensa.</summary>
    private static bool PuedeReclamar(PoliticaDeConfirmacionDeCorreo politica, bool correoConfirmado) =>
        !politica.ConfirmacionObligatoria || correoConfirmado;

    /// <summary>
    /// Enlaza con la cuenta a los compradores que el Mercado invitó con su correo. Se hace cada vez que la
    /// persona abre sus agendas: así la invitación aparece sola, sin pasos extra.
    /// </summary>
    private static async Task EnlazarInvitacionesAsync(
        SimusDbContext db, PoliticaDeConfirmacionDeCorreo politica, int persona, CancellationToken ct)
    {
        var cuenta = await db.Users.AsNoTracking().Where(u => u.Id == persona && u.IsActive)
            .Select(u => new { u.Email, u.CorreoConfirmado }).FirstOrDefaultAsync(ct);
        if (cuenta is null || !PuedeReclamar(politica, cuenta.CorreoConfirmado)) return;

        var correo = CorreoElectronico.Normalizar(cuenta.Email) ?? string.Empty;
        var pendientes = await db.ParticipantesDeCitas
            .Where(p => p.Rol == AgendamientoDeCitas.RolComprador && p.UsuarioId == null
                && p.CorreoInvitacion == correo && p.Estado == "aprobado")
            .ToListAsync(ct);
        if (pendientes.Count == 0) return;

        foreach (var p in pendientes) p.UsuarioId = persona;
        // Si ya entró por su cuenta, la invitación por enlace deja de hacer falta.
        var ids = pendientes.Select(p => p.Id).ToList();
        var ahora = DateTime.UtcNow;
        foreach (var invitacion in await db.InvitacionesDeAgenda
            .Where(i => ids.Contains(i.ParticipanteId) && i.Estado == "pendiente").ToListAsync(ct))
        {
            invitacion.Estado = "aceptada";
            invitacion.IdUsuarioAcepta = persona;
            invitacion.FechaCierre = ahora;
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task<IResult?> ExigirCorreoAsync(
        SimusDbContext db, PoliticaDeConfirmacionDeCorreo politica, int persona, string loQueSeIntenta, CancellationToken ct)
    {
        if (!politica.ConfirmacionObligatoria) return null;
        var cuenta = await db.Users.AsNoTracking().Where(u => u.Id == persona)
            .Select(u => new { u.Email, u.CorreoConfirmado }).FirstOrDefaultAsync(ct);
        if (cuenta is null || cuenta.CorreoConfirmado) return null;

        return Results.Conflict(new
        {
            motivo = "correo_sin_confirmar",
            queFalta = "Falta confirmar el correo de tu cuenta.",
            porQue = "Es la dirección con la que te avisaremos de tus citas.",
            queHacer = $"Abre el enlace que enviamos a {cuenta.Email}.",
            queSeHabilita = $"Al confirmarlo podrás {loQueSeIntenta}.",
            correoDestino = cuenta.Email,
        });
    }

    private sealed record Marco(AgendaDeCitasRow Agenda, EdicionMercadoRow Edicion, MercadoRow Mercado);

    private static async Task<Marco?> MarcoAsync(SimusDbContext db, int agendaId, CancellationToken ct)
    {
        var agenda = await db.AgendasDeCitas.FirstOrDefaultAsync(a => a.Id == agendaId, ct);
        if (agenda is null) return null;
        var edicion = await db.EdicionesMercado.AsNoTracking().FirstOrDefaultAsync(e => e.Id == agenda.EdicionMercadoId, ct);
        var mercado = edicion is null ? null
            : await db.Mercados.AsNoTracking().FirstOrDefaultAsync(m => m.Id == edicion.MercadoId, ct);
        return edicion is null || mercado is null ? null : new Marco(agenda, edicion, mercado);
    }

    /// <summary>La participación VIVA de la persona en una agenda; la de comprador, si tiene las dos.</summary>
    private static async Task<ParticipanteDeCitasRow?> MiParticipacionAsync(
        SimusDbContext db, int agendaId, int persona, CancellationToken ct)
    {
        var mias = await db.ParticipantesDeCitas
            .Where(p => p.AgendaId == agendaId && p.UsuarioId == persona
                && (p.Estado == "pendiente" || p.Estado == "aprobado" || p.Estado == "lista_de_espera"))
            .ToListAsync(ct);
        return mias.OrderBy(p => p.Rol == AgendamientoDeCitas.RolComprador ? 0 : 1).FirstOrDefault();
    }

    private static async Task<AgendaDisponibleDto> DisponibleAsync(
        SimusDbContext db, Marco marco, ParticipanteDeCitasRow? mi, DateTime ahora, CancellationToken ct)
    {
        var aprobados = await db.ParticipantesDeCitas.CountAsync(
            p => p.AgendaId == marco.Agenda.Id && p.Rol == AgendamientoDeCitas.RolArtista && p.Estado == "aprobado", ct);
        return new AgendaDisponibleDto(
            marco.Agenda.Id, marco.Edicion.Id, marco.Mercado.Nombre, marco.Edicion.Anio, marco.Edicion.Nombre,
            AgendamientoDeCitas.Dia(marco.Edicion.FechaInicio), AgendamientoDeCitas.Dia(marco.Edicion.FechaFin), marco.Agenda.Estado, marco.Agenda.Modo,
            marco.Agenda.DuracionMinutos, marco.Agenda.CupoArtistas, aprobados, InscripcionAbierta(marco.Agenda, ahora),
            mi?.Rol, mi?.Estado, marco.Agenda.AprobacionDeArtistas, marco.Agenda.Nombre,
            marco.Agenda.CitasMaximasPorVisitante, marco.Agenda.Subtitulo);
    }

    // ═════════════════════════════════════════ Lectura ═════════════════════════════════════════

    private static async Task<IResult> ListarPublicas(SimusDbContext db, CancellationToken ct)
    {
        var ahora = DateTime.UtcNow;
        var agendas = await db.AgendasDeCitas.AsNoTracking()
            .Where(a => a.Estado == "abierta" || a.Estado == "en_curso")
            .OrderBy(a => a.Id)
            .ToListAsync(ct);

        var resultado = new List<AgendaPublicaDto>();
        foreach (var agenda in agendas)
        {
            var marco = await MarcoAsync(db, agenda.Id, ct);
            if (marco is null || !marco.Mercado.Activo || marco.Mercado.EstadoRegistro != "publicado") continue;
            var aprobados = await db.ParticipantesDeCitas.CountAsync(
                p => p.AgendaId == agenda.Id && p.Rol == AgendamientoDeCitas.RolArtista && p.Estado == "aprobado", ct);
            resultado.Add(new AgendaPublicaDto(
                agenda.Id, marco.Mercado.Id, marco.Mercado.Nombre, marco.Edicion.Anio, marco.Edicion.Nombre,
                AgendamientoDeCitas.Dia(marco.Edicion.FechaInicio), AgendamientoDeCitas.Dia(marco.Edicion.FechaFin), agenda.Estado, InscripcionAbierta(agenda, ahora),
                agenda.CupoArtistas, aprobados, agenda.AprobacionDeArtistas, agenda.Nombre, agenda.Subtitulo));
        }
        return Results.Ok(resultado);
    }

    private static async Task<IResult> ListarMias(
        ClaimsPrincipal principal, SimusDbContext db, PoliticaDeConfirmacionDeCorreo politica, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        await EnlazarInvitacionesAsync(db, politica, persona.Value, ct);

        var ahora = DateTime.UtcNow;
        var mias = await db.ParticipantesDeCitas.AsNoTracking()
            .Where(p => p.UsuarioId == persona && (p.Estado == "pendiente" || p.Estado == "aprobado" || p.Estado == "lista_de_espera"))
            .ToListAsync(ct);
        var misAgendas = mias.Select(p => p.AgendaId).Distinct().ToList();

        var agendas = await db.AgendasDeCitas.AsNoTracking()
            .Where(a => a.Estado == "abierta" || a.Estado == "en_curso" || misAgendas.Contains(a.Id))
            .OrderByDescending(a => a.FechaCreacion)
            .ToListAsync(ct);

        var resultado = new List<AgendaDisponibleDto>();
        foreach (var agenda in agendas)
        {
            var marco = await MarcoAsync(db, agenda.Id, ct);
            if (marco is null) continue;
            var mi = mias.Where(p => p.AgendaId == agenda.Id)
                .OrderBy(p => p.Rol == AgendamientoDeCitas.RolComprador ? 0 : 1).FirstOrDefault();

            // A quien no participa solo se le muestra lo que está abierto y es de un Mercado publicado.
            if (mi is null && !(marco.Mercado.Activo && marco.Mercado.EstadoRegistro == "publicado")) continue;
            resultado.Add(await DisponibleAsync(db, marco, mi, ahora, ct));
        }
        return Results.Ok(resultado);
    }

    private static async Task<IResult> ObtenerMia(
        int agendaId, ClaimsPrincipal principal, SimusDbContext db, PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        await EnlazarInvitacionesAsync(db, politica, persona.Value, ct);

        var vista = await ArmarAsync(db, agendaId, persona.Value, ct);
        return vista is null ? Results.NotFound() : Results.Ok(vista);
    }

    private static async Task<MiAgendaDto?> ArmarAsync(SimusDbContext db, int agendaId, int persona, CancellationToken ct)
    {
        var marco = await MarcoAsync(db, agendaId, ct);
        if (marco is null) return null;

        var ahora = DateTime.UtcNow;
        await AgendamientoDeCitas.ExpirarVencidasAsync(db, agendaId, ahora, ct);
        var agenda = marco.Agenda;
        var mi = await MiParticipacionAsync(db, agendaId, persona, ct);

        var visibleParaTodos = marco.Mercado.Activo && marco.Mercado.EstadoRegistro == "publicado"
            && agenda.Estado is "abierta" or "en_curso";
        if (mi is null && !visibleParaTodos) return null;

        var franjas = await db.FranjasDeCitas.AsNoTracking().Where(f => f.AgendaId == agendaId)
            .OrderBy(f => f.InicioUtc).ToListAsync(ct);
        var citas = mi is null ? [] : await AgendamientoDeCitas.CitasAsync(db, agendaId, mi.Id, ct);

        int? posicion = null;
        if (mi is { Estado: "lista_de_espera" })
        {
            // SE EXCLUYE A QUIEN PREGUNTA, SIEMPRE. Justo después de inscribirse, la fila que está en memoria
            // conserva la hora con la precisión del reloj (siete dígitos) y la guardada en la base solo
            // llega a milésimas: comparada contra sí misma salía «menor» y la persona se contaba en la fila.
            var miId = mi.Id;
            var miHora = mi.FechaInscripcion;
            posicion = 1 + await db.ParticipantesDeCitas.CountAsync(
                p => p.AgendaId == agendaId && p.Rol == AgendamientoDeCitas.RolArtista && p.Estado == "lista_de_espera"
                    && p.Id != miId
                    && (p.FechaInscripcion < miHora || (p.FechaInscripcion == miHora && p.Id < miId)), ct);
        }

        var rolQueRota = AgendamientoDeCitas.RolQueRota(agenda.Modo);
        var roto = mi is { Estado: "aprobado" } && mi.Rol == rolQueRota;
        var pendientes = mi is null ? 0 : citas.Count(c => c.Estado == "solicitada" && c.VisitanteId == mi.Id);
        var citasVivas = mi is null ? 0 : citas.Count(c => AgendamientoDeCitas.EstaVivo(c.Estado) && c.VisitanteId == mi.Id);
        var puedoPedir = roto && agenda.Estado is "abierta" or "en_curso" && pendientes < agenda.TopeSolicitudesPendientes
            && (agenda.CitasMaximasPorVisitante is not int maximo || citasVivas < maximo);

        var anfitriones = new List<AnfitrionConDisponibilidadDto>();
        if (roto)
        {
            var vivas = await db.CitasDeAgenda.AsNoTracking()
                .Where(c => c.AgendaId == agendaId && (c.Estado == "solicitada" || c.Estado == "confirmada"))
                .Select(c => new { c.AnfitrionId, c.VisitanteId, c.FranjaId }).ToListAsync(ct);
            var misFranjasOcupadas = vivas.Where(c => c.VisitanteId == mi!.Id).Select(c => c.FranjaId).ToHashSet();
            var ocupadasPorAnfitrion = vivas.GroupBy(c => c.AnfitrionId)
                .ToDictionary(g => g.Key, g => g.Select(c => c.FranjaId).ToHashSet());

            var fijos = await db.ParticipantesDeCitas.AsNoTracking()
                .Where(p => p.AgendaId == agendaId && p.Rol == AgendamientoDeCitas.RolFijo(agenda.Modo) && p.Estado == "aprobado")
                .OrderBy(p => p.Nombre).ToListAsync(ct);
            foreach (var fijo in fijos)
            {
                ocupadasPorAnfitrion.TryGetValue(fijo.Id, out var ocupadas);
                var libres = franjas
                    .Where(f => f.InicioUtc > ahora && !misFranjasOcupadas.Contains(f.Id) && (ocupadas is null || !ocupadas.Contains(f.Id)))
                    .Select(f => f.Id).ToList();
                anfitriones.Add(new AnfitrionConDisponibilidadDto(
                    AgendamientoDeCitas.Participante(fijo, verContacto: false, verCorreoDeInvitacion: false), libres));
            }
        }

        var fotos = await AgendamientoDeCitas.FotosAsync(db, anfitriones.Select(a => a.Anfitrion.Id).Append(mi?.Id ?? 0), ct);
        anfitriones = anfitriones.Select(a => fotos.TryGetValue(a.Anfitrion.Id, out var foto) ? a with { Anfitrion = a.Anfitrion with { FotoUrl = foto } } : a).ToList();
        var miDto = mi is null ? null : AgendamientoDeCitas.Participante(mi, verContacto: true, verCorreoDeInvitacion: false, posicion);
        if (miDto is not null && fotos.TryGetValue(miDto.Id, out var miFoto)) miDto = miDto with { FotoUrl = miFoto };

        return new MiAgendaDto(
            await DisponibleAsync(db, marco, mi, ahora, ct),
            miDto,
            posicion,
            roto,
            PuedoInscribirme: mi is null && InscripcionAbierta(agenda, ahora) && marco.Mercado.Activo
                && marco.Mercado.EstadoRegistro == "publicado",
            puedoPedir,
            pendientes,
            agenda.TopeSolicitudesPendientes,
            agenda.VencimientoSolicitudHoras,
            franjas.Select(f => new FranjaDto(f.Id, f.InicioUtc, f.FinUtc)).ToList(),
            citas,
            anfitriones,
            citasVivas);
    }

    // ═══════════════════════════════════════ Inscripción ═══════════════════════════════════════

    private static async Task<IResult> Inscribirme(
        int agendaId, InscripcionRequest solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, PoliticaDeConfirmacionDeCorreo politica, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (await ExigirCorreoAsync(db, politica, persona.Value, "inscribirte en la agenda de citas", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        var marco = await MarcoAsync(db, agendaId, ct);
        if (marco is null || !marco.Mercado.Activo || marco.Mercado.EstadoRegistro != "publicado") return Results.NotFound();

        var ahora = DateTime.UtcNow;
        if (!InscripcionAbierta(marco.Agenda, ahora))
        {
            return Results.Conflict(new { message = "La inscripción a esta agenda no está abierta.", estado = marco.Agenda.Estado });
        }

        var cuenta = await db.Users.AsNoTracking().Where(u => u.Id == persona)
            .Select(u => new { u.FullName, u.Email, u.Telefono }).FirstAsync(ct);
        var nombre = AgendamientoDeCitas.Opcional(solicitud.Nombre, 240) ?? cuenta.FullName;
        var presentacion = AgendamientoDeCitas.Opcional(solicitud.Presentacion, 1200);
        if (presentacion is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["presentacion"] = ["Presenta tu proyecto en pocas líneas: es lo que verán quienes pueden citarte."],
            });
        }

        try
        {
            var estrategia = db.Database.CreateExecutionStrategy();
            await estrategia.ExecuteAsync(async () =>
            {
                // UN REINTENTO NO ARRASTRA LO DEL INTENTO ANTERIOR: si una inscripción quedó sin guardar,
                // se suelta antes de volver a empezar (si no, el reintento intentaría insertar las dos).
                foreach (var colgada in db.ChangeTracker.Entries<ParticipanteDeCitasRow>()
                    .Where(x => x.State == EntityState.Added).ToList())
                {
                    colgada.State = EntityState.Detached;
                }

                await using var transaccion = await db.Database.BeginTransactionAsync(ct);

                // DOS INSCRIPCIONES A LA VEZ NO PUEDEN PASARSE DEL CUPO. En vez de aislamiento serializable
                // —que bloquea rangos enteros y termina en interbloqueos entre inscripciones—, cada una toma
                // primero un candado sobre la fila de ESTA agenda: se atienden en fila, por orden de
                // llegada, y ninguna espera a otra agenda.
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE AgendasDeCitas SET FechaActualizacion = FechaActualizacion WHERE IdAgenda = {agendaId}", ct);

                if (await db.ParticipantesDeCitas.AnyAsync(
                        p => p.AgendaId == agendaId && p.UsuarioId == persona && p.Rol == AgendamientoDeCitas.RolArtista
                            && (p.Estado == "pendiente" || p.Estado == "aprobado" || p.Estado == "lista_de_espera"), ct))
                {
                    throw new InvalidOperationException("ya-inscrito");
                }

                var aprobados = await db.ParticipantesDeCitas.CountAsync(
                    p => p.AgendaId == agendaId && p.Rol == AgendamientoDeCitas.RolArtista && p.Estado == "aprobado", ct);
                // «Aceptación»: nadie entra solo; queda pendiente y la organización decide (el cupo se aplica al aprobar).
                var porAceptacion = marco.Agenda.AprobacionDeArtistas == AgendamientoDeCitas.AprobacionPorAceptacion;
                var hayCupo = marco.Agenda.CupoArtistas is null || aprobados < marco.Agenda.CupoArtistas;

                var creado = new ParticipanteDeCitasRow
                {
                    AgendaId = agendaId,
                    Rol = AgendamientoDeCitas.RolArtista,
                    UsuarioId = persona,
                    Nombre = nombre,
                    Entidad = AgendamientoDeCitas.Opcional(solicitud.Entidad, 240),
                    Presentacion = presentacion,
                    Enlaces = AgendamientoDeCitas.Opcional(solicitud.Enlaces, 1500),
                    RepresentaA = AgendamientoDeCitas.Opcional(solicitud.RepresentaA, 240),
                    ContactoCorreo = AgendamientoDeCitas.Opcional(solicitud.ContactoCorreo, 180) ?? cuenta.Email,
                    ContactoTelefono = AgendamientoDeCitas.Opcional(solicitud.ContactoTelefono, 80) ?? cuenta.Telefono,
                    Estado = porAceptacion ? "pendiente" : hayCupo ? "aprobado" : "lista_de_espera",
                    FechaInscripcion = ahora,
                    IdUsuarioCreador = persona,
                };
                db.ParticipantesDeCitas.Add(creado);
                await db.SaveChangesAsync(ct);

                var evento = porAceptacion ? "InscripcionPendienteDeAprobacion"
                    : hayCupo ? "InscripcionEnAgendaDeCitas" : "InscripcionEnListaDeEspera";
                await AgendamientoDeCitas.RegistrarEstadoAsync(
                    db, Modulos.ParticipantesDeCitas, creado.Id.ToString(CultureInfo.InvariantCulture), marco.Mercado.OrganizacionPrincipalId, persona.Value,
                    "Persona", anterior: null, creado.Estado, motivo: null, ahora, ct);
                db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                    AccionesAuditoria.Crear, evento, persona.Value, "ParticipantesDeCitas",
                    creado.Id.ToString(CultureInfo.InvariantCulture),
                    antes: null, despues: new { estado = creado.Estado, rol = creado.Rol },
                    motivo: null, OrigenDelCambio.Directo, ahora));
                await AgendamientoDeCitas.AvisarAsync(
                    db, [persona],
                    porAceptacion ? "InscripcionPendienteDeAprobacion"
                        : hayCupo ? "InscripcionEnAgendaConfirmada" : "InscripcionEnListaDeEspera",
                    porAceptacion ? "Tu inscripción espera la aprobación"
                        : hayCupo ? "Quedaste inscrito en la agenda de citas" : "Quedaste en la lista de espera",
                    porAceptacion
                        ? $"La organización de «{marco.Mercado.Nombre}» revisa cada inscripción. Te avisaremos cuando la apruebe o la rechace."
                        : hayCupo
                        ? $"Ya puedes pedir citas en «{marco.Mercado.Nombre}». Inscribirte no garantiza una cita: depende de quien confirme."
                        : $"El cupo de «{marco.Mercado.Nombre}» está lleno. Entrarás por orden de ingreso si se libera un lugar.",
                    agendaId, ahora, ct);
                await db.SaveChangesAsync(ct);
                await transaccion.CommitAsync(ct);
            });
        }
        catch (InvalidOperationException error) when (error.Message == "ya-inscrito")
        {
            return Results.Conflict(new { message = "Ya estás inscrito en esta agenda." });
        }
        catch (DbUpdateException error) when (AgendamientoDeCitas.EsChoqueDeUnicidad(error))
        {
            return Results.Conflict(new { message = "Ya estás inscrito en esta agenda." });
        }

        return Results.Ok(await ArmarAsync(db, agendaId, persona.Value, ct));
    }

    private static async Task<IResult> RetirarmeDeLaAgenda(
        int agendaId, MotivoRequest solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        var marco = await MarcoAsync(db, agendaId, ct);
        if (marco is null) return Results.NotFound();
        var mi = await MiParticipacionAsync(db, agendaId, persona.Value, ct);
        if (mi is null) return Results.NotFound();
        if (marco.Agenda.Estado == "cerrada") return Results.Conflict(new { message = "La agenda ya está cerrada." });

        var motivo = AgendamientoDeCitas.Opcional(solicitud.Motivo, 600) ?? "Salí de la agenda por decisión propia.";
        var ahora = DateTime.UtcNow;
        var estadoAnterior = mi.Estado;

        var estrategia = db.Database.CreateExecutionStrategy();
        await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);
            mi.Estado = "retirado";
            mi.MotivoDeLaDecision = motivo;
            mi.FechaActualizacion = ahora;
            await AgendamientoDeCitas.RegistrarEstadoAsync(
                db, Modulos.ParticipantesDeCitas, mi.Id.ToString(CultureInfo.InvariantCulture), marco.Mercado.OrganizacionPrincipalId, persona.Value,
                "Persona", estadoAnterior, "retirado", motivo, ahora, ct);
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Actualizar, "InscripcionEnAgendaRetirada", persona.Value, "ParticipantesDeCitas",
                mi.Id.ToString(CultureInfo.InvariantCulture),
                antes: new { estado = estadoAnterior }, despues: new { estado = "retirado" },
                motivo, OrigenDelCambio.Directo, ahora));
            await AgendamientoDeCitas.CancelarLasCitasVivasDeAsync(
                db, marco.Agenda, mi, motivo, persona.Value, marco.Mercado.Nombre, ahora, ct);
            await db.SaveChangesAsync(ct);

            if (mi.Rol == AgendamientoDeCitas.RolArtista && estadoAnterior == "aprobado")
            {
                await AgendamientoDeCitas.PromoverDeLaListaDeEsperaAsync(db, marco.Agenda, marco.Mercado.Nombre, ahora, ct);
            }
            await transaccion.CommitAsync(ct);
        });

        return Results.NoContent();
    }

    // ═════════════════════════════════════════ Citas ═════════════════════════════════════════

    private static async Task<IResult> SolicitarCita(
        int agendaId, SolicitarCitaRequest solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, PoliticaDeConfirmacionDeCorreo politica, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        await EnlazarInvitacionesAsync(db, politica, persona.Value, ct);

        var marco = await MarcoAsync(db, agendaId, ct);
        if (marco is null) return Results.NotFound();
        var agenda = marco.Agenda;
        var ahora = DateTime.UtcNow;
        await AgendamientoDeCitas.ExpirarVencidasAsync(db, agendaId, ahora, ct);

        if (agenda.Estado is not ("abierta" or "en_curso"))
        {
            return Results.Conflict(new { message = "La agenda no está recibiendo solicitudes de cita.", estado = agenda.Estado });
        }

        var mi = await MiParticipacionAsync(db, agendaId, persona.Value, ct);
        var rolQueRota = AgendamientoDeCitas.RolQueRota(agenda.Modo);
        if (mi is null || mi.Estado != "aprobado") return Results.Forbid();
        if (mi.Rol != rolQueRota)
        {
            return Results.Conflict(new
            {
                message = rolQueRota == AgendamientoDeCitas.RolComprador
                    ? "En esta agenda piden las citas los compradores; los artistas las confirman."
                    : "En esta agenda piden las citas los artistas; los compradores las confirman.",
            });
        }

        var anfitrion = await db.ParticipantesDeCitas.AsNoTracking().FirstOrDefaultAsync(
            p => p.Id == solicitud.AnfitrionId && p.AgendaId == agendaId
                && p.Rol == AgendamientoDeCitas.RolFijo(agenda.Modo) && p.Estado == "aprobado", ct);
        if (anfitrion is null) return Results.NotFound(new { message = "Esa persona no está en la agenda." });

        var franja = await db.FranjasDeCitas.AsNoTracking().FirstOrDefaultAsync(
            f => f.Id == solicitud.FranjaId && f.AgendaId == agendaId, ct);
        if (franja is null) return Results.NotFound(new { message = "Esa franja no existe." });
        if (franja.InicioUtc <= ahora) return Results.Conflict(new { message = "Esa franja ya pasó. Elige otra." });

        if (agenda.CitasMaximasPorVisitante is int maximoDeCitas)
        {
            var vivas = await db.CitasDeAgenda.CountAsync(
                c => c.AgendaId == agendaId && c.VisitanteId == mi.Id && (c.Estado == "solicitada" || c.Estado == "confirmada"), ct);
            if (vivas >= maximoDeCitas)
            {
                return Results.Conflict(new
                {
                    message = rolQueRota == AgendamientoDeCitas.RolComprador
                        ? $"Ya tienes {vivas} citas, que es el máximo de artistas que puedes visitar en esta agenda. Cancela una para pedir otra."
                        : $"Ya tienes {vivas} citas, que es el máximo de compradores o bookers que puedes visitar en esta agenda. Cancela una para pedir otra.",
                    maximo = maximoDeCitas,
                });
            }
        }
        var pendientes = await db.CitasDeAgenda.CountAsync(
            c => c.AgendaId == agendaId && c.VisitanteId == mi.Id && c.Estado == "solicitada", ct);
        if (pendientes >= agenda.TopeSolicitudesPendientes)
        {
            return Results.Conflict(new
            {
                message = $"Ya tienes {pendientes} solicitudes pendientes, que es el máximo. Espera una respuesta o cancela una.",
                tope = agenda.TopeSolicitudesPendientes,
            });
        }
        if (await db.CitasDeAgenda.AnyAsync(
                c => c.AnfitrionId == anfitrion.Id && c.FranjaId == franja.Id && (c.Estado == "solicitada" || c.Estado == "confirmada"), ct))
        {
            return Results.Conflict(new { message = "Ese horario ya está reservado. Elige otro." });
        }
        if (await db.CitasDeAgenda.AnyAsync(
                c => c.VisitanteId == mi.Id && c.FranjaId == franja.Id && (c.Estado == "solicitada" || c.Estado == "confirmada"), ct))
        {
            return Results.Conflict(new { message = "Ya tienes otra cita en ese horario." });
        }

        var vence = ahora.AddHours(agenda.VencimientoSolicitudHoras);
        if (vence > franja.InicioUtc) vence = franja.InicioUtc;

        var cita = new CitaDeAgendaRow
        {
            AgendaId = agendaId,
            FranjaId = franja.Id,
            AnfitrionId = anfitrion.Id,
            VisitanteId = mi.Id,
            Estado = "solicitada",
            MensajeInicial = AgendamientoDeCitas.Opcional(solicitud.Mensaje, 400),
            VenceUtc = vence,
            FechaSolicitud = ahora,
        };

        try
        {
            var estrategia = db.Database.CreateExecutionStrategy();
            await estrategia.ExecuteAsync(async () =>
            {
                await using var transaccion = await db.Database.BeginTransactionAsync(ct);
                db.CitasDeAgenda.Add(cita);
                await db.SaveChangesAsync(ct);

                await AgendamientoDeCitas.RegistrarEstadoAsync(
                    db, Modulos.CitasDeAgenda, cita.Id.ToString(CultureInfo.InvariantCulture), marco.Mercado.OrganizacionPrincipalId, persona.Value,
                    "Persona", anterior: null, "solicitada", motivo: null, ahora, ct);
                db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                    AccionesAuditoria.Crear, "CitaSolicitada", persona.Value, "CitasDeAgenda",
                    cita.Id.ToString(CultureInfo.InvariantCulture),
                    antes: null, despues: new { estado = "solicitada", franjaId = franja.Id },
                    motivo: null, OrigenDelCambio.Directo, ahora));
                await AgendamientoDeCitas.AvisarConPortafolioAsync(
                    db, [anfitrion.UsuarioId], "CitaSolicitada", "Tienes una solicitud de cita",
                    $"{mi.Nombre} pidió una cita contigo en «{marco.Mercado.Nombre}». Responde antes de que venza.",
                    agendaId, ahora, new PortafolioDeCorreo(mi.Nombre, mi.Entidad, mi.Presentacion, mi.Enlaces), ct);
                // Quien pide también recibe constancia: la solicitud queda registrada y sabe a quién espera.
                await AgendamientoDeCitas.AvisarAsync(
                    db, [persona], "CitaPedida", "Pediste una cita",
                    $"Tu solicitud de cita con {anfitrion.Nombre} en «{marco.Mercado.Nombre}» quedó registrada. Te avisaremos cuando la respondan; si no responden en {agenda.VencimientoSolicitudHoras} horas, la franja se libera.",
                    agendaId, ahora, ct);
                await db.SaveChangesAsync(ct);
                await transaccion.CommitAsync(ct);
            });
        }
        catch (DbUpdateException error) when (AgendamientoDeCitas.EsChoqueDeUnicidad(error))
        {
            // Dos personas pidieron la misma franja a la vez: la base dejó pasar a una.
            return Results.Conflict(new { message = "Ese horario acaba de reservarse. Elige otro." });
        }

        return Results.Ok(await ArmarAsync(db, agendaId, persona.Value, ct));
    }

    /// <summary>La cita y la participación de quien responde, comprobando que la cita es suya.</summary>
    private static async Task<(CitaDeAgendaRow? Cita, ParticipanteDeCitasRow? Yo, Marco? Marco, IResult? Fallo)> MiCitaAsync(
        int agendaId, int citaId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return (null, null, null, Results.Unauthorized());

        var marco = await MarcoAsync(db, agendaId, ct);
        if (marco is null) return (null, null, null, Results.NotFound());
        await AgendamientoDeCitas.ExpirarVencidasAsync(db, agendaId, DateTime.UtcNow, ct);

        var mi = await MiParticipacionAsync(db, agendaId, persona.Value, ct);
        var cita = await db.CitasDeAgenda.FirstOrDefaultAsync(c => c.Id == citaId && c.AgendaId == agendaId, ct);
        if (mi is null || cita is null || (cita.AnfitrionId != mi.Id && cita.VisitanteId != mi.Id))
        {
            return (null, null, null, Results.NotFound());
        }
        return (cita, mi, marco, null);
    }

    private static async Task<IResult> ConfirmarCita(
        int agendaId, int citaId, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery,
        HttpContext http, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        var (cita, yo, marco, fallo) = await MiCitaAsync(agendaId, citaId, principal, db, ct);
        if (fallo is not null) return fallo;
        if (marco!.Agenda.Estado == "cerrada") return Results.Conflict(new { message = "La agenda ya está cerrada." });

        if (cita!.AnfitrionId != yo!.Id)
        {
            return Results.Conflict(new { message = "Quien responde la solicitud es la otra persona." });
        }
        if (cita.Estado != "solicitada")
        {
            return Results.Conflict(new
            {
                message = cita.Estado == "vencida" ? "La solicitud venció." : "Esa solicitud ya no está pendiente.",
                estado = cita.Estado,
            });
        }

        return await DecidirAsync(db, marco, cita, yo, "confirmada", motivo: null, "CitaConfirmada",
            "Te confirmaron una cita", ct);
    }

    private static async Task<IResult> RechazarCita(
        int agendaId, int citaId, MotivoRequest solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var (cita, yo, marco, fallo) = await MiCitaAsync(agendaId, citaId, principal, db, ct);
        if (fallo is not null) return fallo;
        if (marco!.Agenda.Estado == "cerrada") return Results.Conflict(new { message = "La agenda ya está cerrada." });

        if (cita!.AnfitrionId != yo!.Id)
        {
            return Results.Conflict(new { message = "Quien responde la solicitud es la otra persona." });
        }
        if (cita.Estado != "solicitada") return Results.Conflict(new { message = "Esa solicitud ya no está pendiente.", estado = cita.Estado });

        var motivo = AgendamientoDeCitas.Opcional(solicitud.Motivo, 600);
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["motivo"] = ["Escribe un motivo breve: la otra persona lo va a leer."],
            });
        }
        return await DecidirAsync(db, marco, cita, yo, "rechazada", motivo, "CitaRechazada", "Rechazaron tu solicitud de cita", ct);
    }

    private static async Task<IResult> CancelarCita(
        int agendaId, int citaId, MotivoRequest solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var (cita, yo, marco, fallo) = await MiCitaAsync(agendaId, citaId, principal, db, ct);
        if (fallo is not null) return fallo;
        if (marco!.Agenda.Estado == "cerrada") return Results.Conflict(new { message = "La agenda ya está cerrada." });
        if (!AgendamientoDeCitas.EstaVivo(cita!.Estado))
        {
            return Results.Conflict(new { message = "Esa cita ya no está viva.", estado = cita.Estado });
        }

        var motivo = AgendamientoDeCitas.Opcional(solicitud.Motivo, 600);
        // Retirar una solicitud propia que aún no respondieron no necesita explicación; cancelar una cita confirmada, sí.
        if (motivo is null && cita.Estado == "solicitada" && cita.VisitanteId == yo!.Id) motivo = "Retiré la solicitud.";
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["motivo"] = ["Escribe el motivo de la cancelación: la otra persona lo va a leer."],
            });
        }
        return await DecidirAsync(db, marco, cita, yo!, "cancelada", motivo, "CitaCancelada", "Se canceló una cita", ct);
    }

    /// <summary>Cambia el estado de una cita, deja su rastro y avisa a la otra parte.</summary>
    private static async Task<IResult> DecidirAsync(
        SimusDbContext db, Marco marco, CitaDeAgendaRow cita, ParticipanteDeCitasRow yo, string nuevoEstado,
        string? motivo, string evento, string tituloDelAviso, CancellationToken ct)
    {
        var ahora = DateTime.UtcNow;
        var anterior = cita.Estado;
        var otraParteId = cita.AnfitrionId == yo.Id ? cita.VisitanteId : cita.AnfitrionId;

        try
        {
            var estrategia = db.Database.CreateExecutionStrategy();
            await estrategia.ExecuteAsync(async () =>
            {
                await using var transaccion = await db.Database.BeginTransactionAsync(ct);
                cita.Estado = nuevoEstado;
                cita.MotivoDeLaDecision = motivo;
                cita.FechaDecision = ahora;
                cita.FechaActualizacion = ahora;
                if (nuevoEstado == "cancelada") cita.CanceladaPorId = yo.Id;

                await AgendamientoDeCitas.RegistrarEstadoAsync(
                    db, Modulos.CitasDeAgenda, cita.Id.ToString(CultureInfo.InvariantCulture), marco.Mercado.OrganizacionPrincipalId, yo.UsuarioId,
                    "Persona", anterior, nuevoEstado, motivo, ahora, ct);
                db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                    AccionesAuditoria.Actualizar, evento, yo.UsuarioId, "CitasDeAgenda",
                    cita.Id.ToString(CultureInfo.InvariantCulture),
                    antes: new { estado = anterior }, despues: new { estado = nuevoEstado },
                    motivo, OrigenDelCambio.Directo, ahora));

                var cuentaDeLaOtraParte = await db.ParticipantesDeCitas.AsNoTracking()
                    .Where(p => p.Id == otraParteId).Select(p => p.UsuarioId).FirstOrDefaultAsync(ct);
                var cuerpo = nuevoEstado switch
                {
                    "confirmada" => $"{yo.Nombre} confirmó tu cita en «{marco.Mercado.Nombre}». Ya puedes ver su contacto en «Mi agenda de citas».",
                    "rechazada" => $"{yo.Nombre} no pudo atender tu solicitud en «{marco.Mercado.Nombre}». Motivo: {motivo}",
                    _ => $"{yo.Nombre} canceló la cita en «{marco.Mercado.Nombre}». Motivo: {motivo}",
                };
                await AgendamientoDeCitas.AvisarConPortafolioAsync(db, [cuentaDeLaOtraParte], evento, tituloDelAviso, cuerpo,
                    marco.Agenda.Id, ahora,
                    nuevoEstado == "confirmada" ? new PortafolioDeCorreo(yo.Nombre, yo.Entidad, yo.Presentacion, yo.Enlaces) : null, ct);
                if (nuevoEstado == "confirmada")
                {
                    // Quien confirma también guarda constancia de la cita que acaba de cerrar.
                    var otraParte = await db.ParticipantesDeCitas.AsNoTracking()
                        .Where(p => p.Id == otraParteId).Select(p => p.Nombre).FirstOrDefaultAsync(ct);
                    await AgendamientoDeCitas.AvisarAsync(db, [yo.UsuarioId], "CitaConfirmada", "Confirmaste una cita",
                        $"Confirmaste tu cita con {otraParte} en «{marco.Mercado.Nombre}». Verás su contacto en «Mi agenda de citas».",
                        marco.Agenda.Id, ahora, ct);
                }
                await db.SaveChangesAsync(ct);
                await transaccion.CommitAsync(ct);
            });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Conflict(new { message = "La cita cambió mientras la respondías. Vuelve a abrir tu agenda." });
        }

        return Results.Ok(await ArmarAsync(db, marco.Agenda.Id, yo.UsuarioId ?? 0, ct));
    }

    /// <summary>
    /// La foto de quien participa. La persona sube la imagen al Banco con la subida personal (la misma regla de las
    /// fotos de perfil) y aquí la vincula a su participación; solo puede vincular un archivo SUYO, y solo en una
    /// participación suya. <c>archivoId: null</c> la quita (se pintan las iniciales).
    /// </summary>
    private static async Task<IResult> GuardarMiFoto(
        int agendaId, MiFotoRequest solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        var mi = await MiParticipacionAsync(db, agendaId, persona.Value, ct);
        if (mi is null) return Results.NotFound();

        if (solicitud.ArchivoId is int archivoId)
        {
            var archivo = await db.Files.AsNoTracking().FirstOrDefaultAsync(f => f.Id == archivoId, ct);
            if (archivo is null || archivo.UploadedByUserId != persona.Value || archivo.OrganizacionId is not null
                || !archivo.MimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Conflict(new { message = "Esa imagen no es una foto que hayas subido tú." });
            }
        }

        mi.FotoArchivoId = solicitud.ArchivoId;
        await db.SaveChangesAsync(ct);
        var marco = await MarcoAsync(db, agendaId, ct);
        return marco is null ? Results.NotFound() : Results.Ok(await ArmarAsync(db, agendaId, persona.Value, ct));
    }

    /// <summary>
    /// El portafolio con el que la persona agenda EN ESTA AGENDA: su presentación, su agrupación o empresa, a quién
    /// representa y hasta cinco enlaces (uno por línea, con http o https). Es una copia propia por agenda: parte de lo
    /// que escribió al inscribirse o de lo que la organización cargó, y cambiarla no toca su perfil público. Lo recibe la
    /// otra parte con la cita (en pantalla y por correo).
    /// </summary>
    private static async Task<IResult> GuardarMiPortafolio(
        int agendaId, MiPortafolioRequest solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        var mi = await MiParticipacionAsync(db, agendaId, persona.Value, ct);
        if (mi is null) return Results.NotFound();

        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var presentacion = AgendamientoDeCitas.Opcional(solicitud.Presentacion, 1200);
        if (mi.Rol == AgendamientoDeCitas.RolArtista && presentacion is null)
        {
            errores["presentacion"] = ["Presenta tu proyecto en pocas líneas: es lo que verán quienes pueden citarte."];
        }
        var enlaces = (solicitud.Enlaces ?? string.Empty)
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        if (enlaces.Count > 5) errores["enlaces"] = ["Pon hasta cinco enlaces, uno por línea."];
        else if (enlaces.Any(e => !Uri.TryCreate(e, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)))
        {
            errores["enlaces"] = ["Cada enlace debe empezar por http:// o https://, uno por línea."];
        }
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        mi.Presentacion = presentacion;
        mi.Enlaces = enlaces.Count == 0 ? null : AgendamientoDeCitas.Opcional(string.Join('\n', enlaces), 1500);
        mi.Entidad = AgendamientoDeCitas.Opcional(solicitud.Entidad, 240);
        mi.RepresentaA = AgendamientoDeCitas.Opcional(solicitud.RepresentaA, 240);
        mi.FechaActualizacion = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.Ok(await ArmarAsync(db, agendaId, persona.Value, ct));
    }

    // ═══════════════════════════════════════ Calendario ═══════════════════════════════════════

    private static async Task<IResult> MiCalendario(
        int agendaId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        var marco = await MarcoAsync(db, agendaId, ct);
        if (marco is null) return Results.NotFound();
        var mi = await MiParticipacionAsync(db, agendaId, persona.Value, ct);
        if (mi is null) return Results.NotFound();

        await AgendamientoDeCitas.ExpirarVencidasAsync(db, agendaId, DateTime.UtcNow, ct);
        var citas = (await AgendamientoDeCitas.CitasAsync(db, agendaId, mi.Id, ct))
            .Where(c => c.Estado == "confirmada")
            .Select(c => (Cita: c, Resumen: $"Cita en {marco.Mercado.Nombre}: con {(c.AnfitrionId == mi.Id ? c.VisitanteNombre : c.AnfitrionNombre)}"))
            .ToList();
        var ics = AgendamientoDeCitas.Calendario($"Citas · {marco.Mercado.Nombre}", citas, DateTime.UtcNow);
        return Results.File(Encoding.UTF8.GetBytes(ics), "text/calendar; charset=utf-8", "mi-agenda-de-citas.ics");
    }
}
