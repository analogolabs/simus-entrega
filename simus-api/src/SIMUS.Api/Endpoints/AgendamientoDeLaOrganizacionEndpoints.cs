using System.Globalization;
using System.Net.Mail;
using System.Security.Claims;
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
/// La agenda de citas vista por la organización responsable del Mercado, y su resumen en la consola (docs/referencia/26-agenda-de-citas-y-mercados.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>QUIEN LA LLEVA ES LA ORGANIZACION DEL MERCADO.</b> Habilita la agenda sobre una edición, fija el modo,
/// la duración y las franjas, carga a los compradores o bookers que invita y decide sobre las inscripciones.
/// Un editor prepara (configura, genera franjas, carga compradores); abrir, iniciar, cerrar, rechazar y
/// cancelar siguen con el administrador, como el resto de los procesos (docs/desarrollo/19-cuentas-y-organizaciones.md §19.3).
/// </para>
/// <para>
/// <b>NO NECESITA REVISION INSTITUCIONAL.</b> Las ediciones de un Mercado no pasan por revisión: quien tiene
/// el Mercado publicado ya demostró su proceso, y habilitar una herramienta sobre una de sus ediciones no
/// publica nada nuevo.
/// </para>
/// <para>
/// <b>CADA RUTA COMPRUEBA QUE LA AGENDA ES DE ESA ORGANIZACION.</b> El identificador de la agenda llega en
/// la URL y la organización también; si no coinciden, se contesta «no encontrada» y no «prohibido», para no
/// confirmar que existe una agenda de otro.
/// </para>
/// </remarks>
public static class AgendamientoDeLaOrganizacionEndpoints
{
    private const int MaximoDeFranjasPorSolicitud = 200;

    public static RouteGroupBuilder MapAgendamientoDeLaOrganizacionEndpoints(this RouteGroupBuilder api)
    {
        var externo = api.MapGroup("/externo/organizaciones/{organizacionId:int}")
            .WithTags("agendamiento-organizacion");
        externo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        externo.MapGet("/agendas-de-citas", ListarEdiciones).WithName("ListarEdicionesConAgendaDeCitas");
        // Una edición puede tener varias agendas. `/agenda` (en singular) sigue sirviendo a quien la usaba: crea la
        // primera o actualiza la única, y responde 409 si ya hay varias.
        externo.MapPut("/ediciones-de-mercado/{edicionId:int}/agenda", Configurar).WithName("ConfigurarAgendaDeCitas");
        externo.MapPost("/ediciones-de-mercado/{edicionId:int}/agendas", CrearAgenda).WithName("CrearAgendaDeCitas");
        externo.MapPut("/ediciones-de-mercado/{edicionId:int}/agendas/{agendaId:int}", ActualizarAgenda).WithName("ActualizarAgendaDeCitas");
        externo.MapGet("/agendas-de-citas/{agendaId:int}", Obtener).WithName("ObtenerAgendaDeCitasDelOrganizador");
        externo.MapPost("/agendas-de-citas/{agendaId:int}/estado", CambiarEstado).WithName("CambiarEstadoDeAgendaDeCitas");
        externo.MapPost("/agendas-de-citas/{agendaId:int}/franjas", GenerarFranjas).WithName("GenerarFranjasDeCitas");
        externo.MapDelete("/agendas-de-citas/{agendaId:int}/franjas/{franjaId:int}", RetirarFranja).WithName("RetirarFranjaDeCitas");
        externo.MapPost("/agendas-de-citas/{agendaId:int}/compradores", AgregarComprador).WithName("InvitarCompradorALaAgenda");
        externo.MapPut("/agendas-de-citas/{agendaId:int}/participantes/{participanteId:int}/espacio", AsignarEspacio)
            .WithName("AsignarEspacioDeCitas");
        externo.MapPost("/agendas-de-citas/{agendaId:int}/participantes/{participanteId:int}/decision", DecidirParticipante)
            .WithName("DecidirSobreParticipanteDeCitas");
        externo.MapPost("/agendas-de-citas/{agendaId:int}/citas/{citaId:int}/cancelar", CancelarCita)
            .WithName("CancelarCitaComoOrganizador");
        externo.MapGet("/agendas-de-citas/{agendaId:int}/exportar.csv", Exportar).WithName("ExportarAgendaDeCitas");
        externo.MapGet("/agendas-de-citas/{agendaId:int}/exportar.ics", ExportarCalendario).WithName("ExportarCalendarioDeLaAgendaDeCitas");

        // ─────────────────────────────── Lo que ve el Programa (consola) ───────────────────────────────
        var consola = api.MapGroup("/institucional/agendas-de-citas")
            .WithTags("agendamiento-consola")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("mercados");
        consola.MapGet(string.Empty, ListarParaLaConsola).WithName("ListarAgendasDeCitasParaLaConsola");

        return api;
    }

    // ═════════════════════════════════════════ Guardas ═════════════════════════════════════════

    internal static async Task<IResult?> ExigirTestigoAsync(IAntiforgery antiforgery, HttpContext contexto) =>
        await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto)
            ? null
            : Results.BadRequest(new { message = "La acción no pudo validarse. Actualiza la página e inténtalo nuevamente." });

    internal sealed record Contexto(
        AgendaDeCitasRow Agenda, EdicionMercadoRow Edicion, MercadoRow Mercado, int Actor);

    /// <summary>La agenda, su edición y su Mercado, si la persona puede trabajarlos para esa organización.</summary>
    internal static async Task<(Contexto? Contexto, IResult? Fallo)> OrganizadorAsync(
        ClaimsPrincipal principal, SimusDbContext db, int organizacionId, int agendaId, bool administrar,
        CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return (null, Results.Unauthorized());

        var permitido = administrar
            ? await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacionId, ct)
            : await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct);
        if (!permitido) return (null, Results.Forbid());

        var agenda = await db.AgendasDeCitas.FirstOrDefaultAsync(a => a.Id == agendaId, ct);
        var edicion = agenda is null ? null
            : await db.EdicionesMercado.AsNoTracking().FirstOrDefaultAsync(e => e.Id == agenda.EdicionMercadoId, ct);
        var mercado = edicion is null ? null
            : await db.Mercados.AsNoTracking().FirstOrDefaultAsync(m => m.Id == edicion.MercadoId, ct);
        if (agenda is null || edicion is null || mercado is null || mercado.OrganizacionPrincipalId != organizacionId)
        {
            return (null, Results.NotFound());
        }

        return (new Contexto(agenda, edicion, mercado, persona.Value), null);
    }

    private static async Task EnTransaccionAsync(SimusDbContext db, Func<Task> trabajo, CancellationToken ct)
    {
        // La estrategia de ejecución es la de SQL Server (reintento): abrir la transacción sin ella
        // funciona en SQLite y el motor real la rechaza.
        var estrategia = db.Database.CreateExecutionStrategy();
        await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);
            await trabajo();
            await transaccion.CommitAsync(ct);
        });
    }

    // ══════════════════════════════════════ Lectura ══════════════════════════════════════

    private static async Task<IResult> ListarEdiciones(
        int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var mercados = await db.Mercados.AsNoTracking()
            .Where(m => m.OrganizacionPrincipalId == organizacionId && m.Activo)
            .ToListAsync(ct);
        var ids = mercados.Select(m => m.Id).ToList();
        var ediciones = await db.EdicionesMercado.AsNoTracking()
            .Where(e => ids.Contains(e.MercadoId))
            .OrderByDescending(e => e.Anio)
            .ToListAsync(ct);
        var edicionIds = ediciones.Select(e => e.Id).ToList();
        var agendas = (await db.AgendasDeCitas.AsNoTracking()
            .Where(a => edicionIds.Contains(a.EdicionMercadoId))
            // La que queda a la vista por omisión: primero las abiertas y, entre ellas, la modalidad más común (compradores con mesa fija).
            .OrderBy(a => a.Estado == "abierta" ? 0 : 1).ThenBy(a => a.Modo == "compradores_fijos" ? 0 : 1).ThenBy(a => a.Id)
            .ToListAsync(ct))
            .GroupBy(a => a.EdicionMercadoId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var filas = ediciones.Select(e =>
        {
            var mercado = mercados.First(m => m.Id == e.MercadoId);
            var deLaEdicion = agendas.TryGetValue(e.Id, out var lista) ? lista : [];
            var primera = deLaEdicion.FirstOrDefault();
            return new EdicionConAgendaDto(
                e.Id, mercado.Id, mercado.Nombre, e.Anio, e.Nombre, e.Estado, AgendamientoDeCitas.Dia(e.FechaInicio), AgendamientoDeCitas.Dia(e.FechaFin),
                primera?.Id, primera?.Estado,
                deLaEdicion.Select(a => new AgendaDeEdicionDto(a.Id, a.Nombre, a.Estado)).ToList());
        }).OrderBy(f => f.MercadoNombre).ThenByDescending(f => f.Anio).ToList();
        return Results.Ok(filas);
    }

    private static async Task<IResult> Obtener(
        int organizacionId, int agendaId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;

        await AgendamientoDeCitas.ExpirarVencidasAsync(db, agendaId, DateTime.UtcNow, ct);
        return Results.Ok(await ArmarAsync(db, contexto!.Agenda, ct));
    }

    private static async Task<AgendaDelOrganizadorDto> ArmarAsync(
        SimusDbContext db, AgendaDeCitasRow agenda, CancellationToken ct)
    {
        var resumen = await AgendamientoDeCitas.ResumenAsync(db, agenda, ct);
        var franjas = await db.FranjasDeCitas.AsNoTracking().Where(f => f.AgendaId == agenda.Id)
            .OrderBy(f => f.InicioUtc).Select(f => new FranjaDto(f.Id, f.InicioUtc, f.FinUtc)).ToListAsync(ct);
        var filas = await db.ParticipantesDeCitas.AsNoTracking().Where(p => p.AgendaId == agenda.Id)
            .OrderBy(p => p.Rol).ThenBy(p => p.FechaInscripcion).ThenBy(p => p.Id).ToListAsync(ct);

        var posiciones = filas.Where(p => p.Estado == "lista_de_espera")
            .Select((p, indice) => (p.Id, Posicion: indice + 1)).ToDictionary(x => x.Id, x => x.Posicion);
        var ahora = DateTime.UtcNow;
        var ids = filas.Select(p => p.Id).ToList();
        var conInvitacion = (await db.InvitacionesDeAgenda.AsNoTracking()
            .Where(i => ids.Contains(i.ParticipanteId) && i.Estado == "pendiente" && i.FechaExpiracion > ahora)
            .Select(i => i.ParticipanteId).ToListAsync(ct)).ToHashSet();
        var participantes = filas
            .Select(p => AgendamientoDeCitas.Participante(
                p, verContacto: true, verCorreoDeInvitacion: true,
                posicion: posiciones.TryGetValue(p.Id, out var pos) ? pos : null) with
            {
                InvitacionPendiente = conInvitacion.Contains(p.Id),
            })
            .ToList();
        var citas = await AgendamientoDeCitas.CitasAsync(db, agenda.Id, quienPregunta: null, ct);
        var fotos = await AgendamientoDeCitas.FotosAsync(db, participantes.Select(p => p.Id), ct);
        participantes = participantes.Select(p => fotos.TryGetValue(p.Id, out var foto) ? p with { FotoUrl = foto } : p).ToList();
        return new AgendaDelOrganizadorDto(resumen, franjas, participantes, citas);
    }

    // ═══════════════════════════════════ Configurar la agenda ═══════════════════════════════════

    private static Task<IResult> Configurar(
        int organizacionId, int edicionId, AgendaConfiguracionRequest solicitud, ClaimsPrincipal principal,
        SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct) =>
        ConfigurarAsync(organizacionId, edicionId, agendaId: null, crear: false, solicitud, principal, db, antiforgery, http, ct);

    private static Task<IResult> CrearAgenda(
        int organizacionId, int edicionId, AgendaConfiguracionRequest solicitud, ClaimsPrincipal principal,
        SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct) =>
        ConfigurarAsync(organizacionId, edicionId, agendaId: null, crear: true, solicitud, principal, db, antiforgery, http, ct);

    private static Task<IResult> ActualizarAgenda(
        int organizacionId, int edicionId, int agendaId, AgendaConfiguracionRequest solicitud, ClaimsPrincipal principal,
        SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct) =>
        ConfigurarAsync(organizacionId, edicionId, agendaId, crear: false, solicitud, principal, db, antiforgery, http, ct);

    private static async Task<IResult> ConfigurarAsync(
        int organizacionId, int edicionId, int? agendaId, bool crear, AgendaConfiguracionRequest solicitud,
        ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var edicion = await db.EdicionesMercado.AsNoTracking().FirstOrDefaultAsync(e => e.Id == edicionId, ct);
        var mercado = edicion is null ? null
            : await db.Mercados.AsNoTracking().FirstOrDefaultAsync(m => m.Id == edicion.MercadoId, ct);
        if (edicion is null || mercado is null || mercado.OrganizacionPrincipalId != organizacionId || !mercado.Activo)
        {
            return Results.NotFound();
        }

        var errores = Validar(solicitud);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;
        var modo = solicitud.Modo.Trim().ToLowerInvariant();
        AgendaDeCitasRow? agenda = null;
        var deLaEdicion = await db.AgendasDeCitas.Where(a => a.EdicionMercadoId == edicionId).OrderBy(a => a.Id).ToListAsync(ct);
        if (agendaId is not null)
        {
            agenda = deLaEdicion.FirstOrDefault(a => a.Id == agendaId);
            if (agenda is null) return Results.NotFound();
        }
        else if (!crear)
        {
            if (deLaEdicion.Count > 1)
            {
                return Results.Conflict(new { message = "Esta edición tiene varias agendas de citas: indica cuál se configura." });
            }
            agenda = deLaEdicion.FirstOrDefault();
        }
        var nombre = solicitud.Nombre?.Trim();
        // EL NOMBRE PARTE DEL DEL MERCADO, y el subtítulo distingue la agenda (la edición, la ronda, la sala).
        var subtitulo = solicitud.Subtitulo?.Trim();
        if (agenda is null && string.IsNullOrEmpty(nombre))
        {
            nombre = mercado.Nombre.Length > 120 ? mercado.Nombre[..120] : mercado.Nombre;
            if (string.IsNullOrEmpty(subtitulo) && deLaEdicion.Count > 0) subtitulo = $"Agenda {deLaEdicion.Count + 1}";
        }
        if (deLaEdicion.Any(a => a.Id != agenda?.Id
                && string.Equals(a.Nombre, nombre ?? agenda?.Nombre, StringComparison.OrdinalIgnoreCase)
                && string.Equals(a.Subtitulo, subtitulo ?? agenda?.Subtitulo ?? string.Empty, StringComparison.OrdinalIgnoreCase)))
        {
            return Results.Conflict(new { message = "Ya hay una agenda con ese nombre en esta edición." });
        }
        // Sin el campo se conserva lo que había (o «automática» en una agenda nueva): un cliente anterior no lo pisa.
        var aprobacion = string.IsNullOrWhiteSpace(solicitud.AprobacionDeArtistas)
            ? agenda?.AprobacionDeArtistas ?? AgendamientoDeCitas.AprobacionAutomatica
            : solicitud.AprobacionDeArtistas.Trim().ToLowerInvariant();

        if (agenda is null)
        {
            if (edicion.Estado is not ("en_preparacion" or "programada"))
            {
                return Results.Conflict(new
                {
                    message = "Solo se puede habilitar la agenda de citas en una edición en preparación o programada.",
                    estado = edicion.Estado,
                });
            }

            agenda = new AgendaDeCitasRow
            {
                EdicionMercadoId = edicionId,
                Nombre = nombre!,
                Subtitulo = subtitulo ?? string.Empty,
                CitasMaximasPorVisitante = solicitud.CitasMaximasPorVisitante,
                Estado = "borrador",
                Modo = modo,
                AprobacionDeArtistas = aprobacion,
                DuracionMinutos = solicitud.DuracionMinutos,
                PausaMinutos = solicitud.PausaMinutos,
                TopeSolicitudesPendientes = solicitud.TopeSolicitudesPendientes,
                VencimientoSolicitudHoras = solicitud.VencimientoSolicitudHoras,
                CupoArtistas = solicitud.CupoArtistas,
                AperturaInscripcionUtc = solicitud.AperturaInscripcionUtc,
                CierreInscripcionUtc = solicitud.CierreInscripcionUtc,
                IdUsuarioCreador = persona.Value,
                FechaCreacion = ahora,
            };
            db.AgendasDeCitas.Add(agenda);
            try
            {
                await db.SaveChangesAsync(ct);
                db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                    AccionesAuditoria.Crear, "AgendaDeCitasCreada", persona.Value, "AgendasDeCitas",
                    agenda.Id.ToString(CultureInfo.InvariantCulture),
                    antes: null, despues: new { nombre = agenda.Nombre, estado = agenda.Estado, modo = agenda.Modo, aprobacion = agenda.AprobacionDeArtistas },
                    motivo: null, OrigenDelCambio.Directo, ahora));
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException error) when (AgendamientoDeCitas.EsChoqueDeUnicidad(error))
            {
                return Results.Conflict(new { message = "Ya hay una agenda con ese nombre en esta edición." });
            }

            return Results.Created($"/api/v1/externo/organizaciones/{organizacionId}/agendas-de-citas/{agenda.Id}",
                await AgendamientoDeCitas.ResumenAsync(db, agenda, ct));
        }

        if (agenda.Estado == "cerrada")
        {
            return Results.Conflict(new { message = "La agenda ya está cerrada: no se puede cambiar su configuración." });
        }

        var hayCitas = await db.CitasDeAgenda.AnyAsync(c => c.AgendaId == agenda.Id, ct);
        if (modo != agenda.Modo && hayCitas)
        {
            return Results.Conflict(new { message = "No se puede cambiar el modo cuando ya hay citas pedidas." });
        }
        var hayFranjas = await db.FranjasDeCitas.AnyAsync(f => f.AgendaId == agenda.Id, ct);
        if ((solicitud.DuracionMinutos != agenda.DuracionMinutos || solicitud.PausaMinutos != agenda.PausaMinutos) && hayFranjas)
        {
            return Results.Conflict(new
            {
                message = "No se puede cambiar la duración ni la pausa cuando ya hay franjas. Retira las franjas y vuelve a generarlas.",
            });
        }

        var cambios = new List<ValorCambiado>();
        void Cambio(string id, string etiqueta, object? antes, object? despues)
        {
            var a = antes?.ToString();
            var d = despues?.ToString();
            if (a != d) cambios.Add(new ValorCambiado(id, etiqueta, ClaseDeDato.Publico, a, d));
        }
        if (!string.IsNullOrEmpty(nombre)) Cambio("nombre", "Nombre de la agenda", agenda.Nombre, nombre);
        Cambio("modo", "Modo", agenda.Modo, modo);
        Cambio("aprobacionDeArtistas", "Aprobación de artistas", agenda.AprobacionDeArtistas, aprobacion);
        Cambio("duracionMinutos", "Duración de la cita", agenda.DuracionMinutos, solicitud.DuracionMinutos);
        Cambio("pausaMinutos", "Pausa entre citas", agenda.PausaMinutos, solicitud.PausaMinutos);
        Cambio("topeSolicitudesPendientes", "Tope de solicitudes pendientes", agenda.TopeSolicitudesPendientes, solicitud.TopeSolicitudesPendientes);
        Cambio("vencimientoSolicitudHoras", "Vencimiento de la solicitud (horas)", agenda.VencimientoSolicitudHoras, solicitud.VencimientoSolicitudHoras);
        if (subtitulo is not null) Cambio("subtitulo", "Subtítulo de la agenda", agenda.Subtitulo, subtitulo);
        Cambio("cupoArtistas", "Cupo de artistas", agenda.CupoArtistas, solicitud.CupoArtistas);
        Cambio("citasMaximasPorVisitante", "Cupo de citas por quien rota", agenda.CitasMaximasPorVisitante, solicitud.CitasMaximasPorVisitante);
        Cambio("aperturaInscripcionUtc", "Apertura de la inscripción", agenda.AperturaInscripcionUtc?.ToString("O", CultureInfo.InvariantCulture), solicitud.AperturaInscripcionUtc?.ToString("O", CultureInfo.InvariantCulture));
        Cambio("cierreInscripcionUtc", "Cierre de la inscripción", agenda.CierreInscripcionUtc?.ToString("O", CultureInfo.InvariantCulture), solicitud.CierreInscripcionUtc?.ToString("O", CultureInfo.InvariantCulture));

        await EnTransaccionAsync(db, async () =>
        {
            if (!string.IsNullOrEmpty(nombre)) agenda.Nombre = nombre;
            agenda.Modo = modo;
            agenda.AprobacionDeArtistas = aprobacion;
            agenda.DuracionMinutos = solicitud.DuracionMinutos;
            agenda.PausaMinutos = solicitud.PausaMinutos;
            agenda.TopeSolicitudesPendientes = solicitud.TopeSolicitudesPendientes;
            agenda.VencimientoSolicitudHoras = solicitud.VencimientoSolicitudHoras;
            agenda.CupoArtistas = solicitud.CupoArtistas;
            agenda.CitasMaximasPorVisitante = solicitud.CitasMaximasPorVisitante;
            if (subtitulo is not null) agenda.Subtitulo = subtitulo;
            agenda.AperturaInscripcionUtc = solicitud.AperturaInscripcionUtc;
            agenda.CierreInscripcionUtc = solicitud.CierreInscripcionUtc;
            agenda.FechaActualizacion = ahora;

            if (cambios.Count > 0)
            {
                await RegistradorDeCambios.RegistrarValoresAsync(
                    db,
                    new ContextoDeCambio(Modulos.AgendasDeCitas, agenda.Id.ToString(CultureInfo.InvariantCulture),
                        organizacionId, persona.Value, "Organización", Fecha: ahora),
                    cambios, ct, conBitacora: false);
                db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                    AccionesAuditoria.Actualizar, "AgendaDeCitasConfigurada", persona.Value, "AgendasDeCitas",
                    agenda.Id.ToString(CultureInfo.InvariantCulture),
                    antes: null, despues: new { campos = cambios.Select(c => c.Id).ToArray() },
                    motivo: null, OrigenDelCambio.Directo, ahora));
            }
            await db.SaveChangesAsync(ct);

            // Si subió el cupo, entran los que esperaban, por orden de ingreso.
            await AgendamientoDeCitas.PromoverDeLaListaDeEsperaAsync(db, agenda, mercado.Nombre, ahora, ct);
        }, ct);

        return Results.Ok(await AgendamientoDeCitas.ResumenAsync(db, agenda, ct));
    }

    private static Dictionary<string, string[]> Validar(AgendaConfiguracionRequest s)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (!Array.Exists(AgendamientoDeCitas.Modos, m => string.Equals(m, (s.Modo ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            errores["modo"] = ["Elige si los compradores rotan o están fijos en una mesa."];
        }
        if (!string.IsNullOrWhiteSpace(s.AprobacionDeArtistas)
            && !Array.Exists(AgendamientoDeCitas.Aprobaciones, a => string.Equals(a, s.AprobacionDeArtistas.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            errores["aprobacionDeArtistas"] = ["Elige si los artistas entran por orden de ingreso o si la organización los aprueba."];
        }
        if (s.Nombre is { } n && (n.Trim().Length > 120 || (n.Length > 0 && n.Trim().Length == 0)))
        {
            errores["nombre"] = ["El nombre de la agenda tiene hasta 120 caracteres."];
        }
        if (s.DuracionMinutos is < 10 or > 60) errores["duracionMinutos"] = ["La cita dura entre 10 y 60 minutos."];
        if (s.PausaMinutos is < 0 or > 30) errores["pausaMinutos"] = ["La pausa entre citas va de 0 a 30 minutos."];
        if (s.TopeSolicitudesPendientes is < 1 or > 50)
        {
            errores["topeSolicitudesPendientes"] = ["El tope de solicitudes pendientes va de 1 a 50."];
        }
        if (s.VencimientoSolicitudHoras is < 1 or > 720)
        {
            errores["vencimientoSolicitudHoras"] = ["La solicitud vence entre 1 y 720 horas."];
        }
        if (s.Subtitulo is { } sub && sub.Trim().Length > 120) errores["subtitulo"] = ["El subtítulo de la agenda tiene hasta 120 caracteres."];
        if (s.CitasMaximasPorVisitante is <= 0 or > 200)
        {
            errores["citasMaximasPorVisitante"] = ["El cupo de citas es un número de 1 a 200, o déjalo vacío para no limitarlo."];
        }
        if (s.CupoArtistas is <= 0 or > 10000) errores["cupoArtistas"] = ["El cupo es un número mayor que cero, o déjalo vacío para no limitarlo."];
        if (s.AperturaInscripcionUtc is { } a && s.CierreInscripcionUtc is { } c && c <= a)
        {
            errores["cierreInscripcionUtc"] = ["El cierre de la inscripción debe ser posterior a su apertura."];
        }
        return errores;
    }

    // ═══════════════════════════════════════ Estado ═══════════════════════════════════════

    private static async Task<IResult> CambiarEstado(
        int organizacionId, int agendaId, CambiarEstadoDeAgendaRequest solicitud, ClaimsPrincipal principal,
        SimusDbContext db, IAntiforgery antiforgery, HttpContext http, PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        if (await ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);

        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: true, ct);
        if (fallo is not null) return fallo;
        var agenda = contexto!.Agenda;
        var accion = (solicitud.Accion ?? string.Empty).Trim().ToLowerInvariant();
        var ahora = DateTime.UtcNow;

        var (desde, hacia, evento) = accion switch
        {
            "abrir" => ("borrador", "abierta", "AgendaDeCitasAbierta"),
            "iniciar" => ("abierta", "en_curso", "AgendaDeCitasIniciada"),
            "cerrar" => (agenda.Estado, "cerrada", "AgendaDeCitasCerrada"),
            _ => (string.Empty, string.Empty, string.Empty),
        };
        if (hacia.Length == 0) return Results.BadRequest(new { message = "La acción no existe. Usa abrir, iniciar o cerrar." });
        if (agenda.Estado == "cerrada" || agenda.Estado != desde)
        {
            return Results.Conflict(new
            {
                message = accion switch
                {
                    "abrir" => "Solo una agenda en borrador puede abrirse.",
                    "iniciar" => "Solo una agenda abierta puede iniciarse.",
                    _ => "La agenda ya está cerrada.",
                },
                estado = agenda.Estado,
            });
        }

        if (accion == "abrir")
        {
            if (!await db.FranjasDeCitas.AnyAsync(f => f.AgendaId == agendaId, ct))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["franjas"] = ["Genera al menos una franja antes de abrir la inscripción."],
                });
            }
            if (await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(
                    db, politica, organizacionId, "abrir la inscripción a la agenda de citas", ct) is { } sinConfirmar)
            {
                return sinConfirmar;
            }
        }

        await EnTransaccionAsync(db, async () =>
        {
            agenda.Estado = hacia;
            agenda.FechaActualizacion = ahora;
            if (accion == "iniciar" && (agenda.CierreInscripcionUtc is null || agenda.CierreInscripcionUtc > ahora))
            {
                // Iniciar cierra la inscripción: ya no entra nadie más.
                agenda.CierreInscripcionUtc = ahora;
            }

            if (accion == "cerrar")
            {
                agenda.FechaCierre = ahora;
                // Lo que quedó sin responder se libera; lo confirmado queda como registro de lo ocurrido.
                var pendientes = await db.CitasDeAgenda
                    .Where(c => c.AgendaId == agendaId && c.Estado == "solicitada").ToListAsync(ct);
                foreach (var cita in pendientes)
                {
                    cita.Estado = "cancelada";
                    cita.MotivoDeLaDecision = "La agenda se cerró.";
                    cita.FechaDecision = ahora;
                    cita.FechaActualizacion = ahora;
                    db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                        AccionesAuditoria.Actualizar, "CitaCancelada", contexto.Actor, "CitasDeAgenda",
                        cita.Id.ToString(CultureInfo.InvariantCulture),
                        antes: new { estado = "solicitada" }, despues: new { estado = "cancelada" },
                        motivo: "La agenda se cerró.", OrigenDelCambio.Directo, ahora));
                }
            }

            await AgendamientoDeCitas.RegistrarEstadoAsync(
                db, Modulos.AgendasDeCitas, agenda.Id.ToString(CultureInfo.InvariantCulture), organizacionId, contexto.Actor, "Organización",
                desde, hacia, motivo: null, ahora, ct);
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Actualizar, evento, contexto.Actor, "AgendasDeCitas",
                agenda.Id.ToString(CultureInfo.InvariantCulture),
                antes: new { estado = desde }, despues: new { estado = hacia },
                motivo: null, OrigenDelCambio.Directo, ahora));
            await db.SaveChangesAsync(ct);
        }, ct);

        return Results.Ok(await AgendamientoDeCitas.ResumenAsync(db, agenda, ct));
    }

    // ═══════════════════════════════════════ Franjas ═══════════════════════════════════════

    private static async Task<IResult> GenerarFranjas(
        int organizacionId, int agendaId, GenerarFranjasRequest solicitud, ClaimsPrincipal principal,
        SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);

        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;
        var agenda = contexto!.Agenda;
        if (agenda.Estado == "cerrada") return Results.Conflict(new { message = "La agenda ya está cerrada." });

        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (!DateOnly.TryParseExact(solicitud.Fecha, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fecha))
        {
            errores["fecha"] = ["Escribe el día con el formato aaaa-mm-dd."];
        }
        if (!TimeOnly.TryParseExact(solicitud.Desde, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var desde))
        {
            errores["desde"] = ["Escribe la hora de inicio como hh:mm."];
        }
        if (!TimeOnly.TryParseExact(solicitud.Hasta, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var hasta))
        {
            errores["hasta"] = ["Escribe la hora de cierre como hh:mm."];
        }
        if (errores.Count == 0 && hasta <= desde) errores["hasta"] = ["La hora de cierre debe ser posterior a la de inicio."];
        if (errores.Count == 0 && contexto.Edicion.FechaInicio is { } inicio && contexto.Edicion.FechaFin is { } fin
            && (fecha < DateOnly.FromDateTime(inicio) || fecha > DateOnly.FromDateTime(fin)))
        {
            errores["fecha"] = ["El día debe estar dentro de las fechas de la edición."];
        }
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var duracion = TimeSpan.FromMinutes(agenda.DuracionMinutos);
        var paso = TimeSpan.FromMinutes(agenda.DuracionMinutos + agenda.PausaMinutos);
        var nuevas = new List<FranjaDeCitasRow>();
        for (var inicioLocal = desde.ToTimeSpan(); inicioLocal + duracion <= hasta.ToTimeSpan(); inicioLocal += paso)
        {
            var inicioUtc = AgendamientoDeCitas.LocalDeBogotaAUtc(fecha, TimeOnly.FromTimeSpan(inicioLocal));
            nuevas.Add(new FranjaDeCitasRow { AgendaId = agendaId, InicioUtc = inicioUtc, FinUtc = inicioUtc + duracion });
        }
        if (nuevas.Count == 0)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["hasta"] = [$"Entre esas horas no cabe una cita de {agenda.DuracionMinutos} minutos."],
            });
        }
        if (nuevas.Count > MaximoDeFranjasPorSolicitud)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["hasta"] = [$"Se generarían {nuevas.Count} franjas; el máximo por solicitud es {MaximoDeFranjasPorSolicitud}."],
            });
        }

        var ahora = DateTime.UtcNow;
        var existentes = await db.FranjasDeCitas.AsNoTracking().Where(f => f.AgendaId == agendaId)
            .Select(f => f.InicioUtc).ToListAsync(ct);
        var sinRepetir = nuevas.Where(f => !existentes.Contains(f.InicioUtc)).ToList();
        db.FranjasDeCitas.AddRange(sinRepetir);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Crear, "FranjasDeCitasGeneradas", contexto.Actor, "AgendasDeCitas",
            agendaId.ToString(CultureInfo.InvariantCulture),
            antes: null, despues: new { dia = solicitud.Fecha, franjas = sinRepetir.Count },
            motivo: null, OrigenDelCambio.Directo, ahora));
        await db.SaveChangesAsync(ct);

        return Results.Ok(new
        {
            generadas = sinRepetir.Count,
            yaExistian = nuevas.Count - sinRepetir.Count,
            franjas = await db.FranjasDeCitas.AsNoTracking().Where(f => f.AgendaId == agendaId)
                .OrderBy(f => f.InicioUtc).Select(f => new FranjaDto(f.Id, f.InicioUtc, f.FinUtc)).ToListAsync(ct),
        });
    }

    private static async Task<IResult> RetirarFranja(
        int organizacionId, int agendaId, int franjaId, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;
        if (contexto!.Agenda.Estado == "cerrada") return Results.Conflict(new { message = "La agenda ya está cerrada." });

        var franja = await db.FranjasDeCitas.FirstOrDefaultAsync(f => f.Id == franjaId && f.AgendaId == agendaId, ct);
        if (franja is null) return Results.NotFound();
        if (await db.CitasDeAgenda.AnyAsync(c => c.FranjaId == franjaId, ct))
        {
            return Results.Conflict(new { message = "La franja ya tiene citas, vivas o pasadas: no se puede retirar." });
        }

        db.FranjasDeCitas.Remove(franja);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Eliminar, "FranjaDeCitasRetirada", contexto.Actor, "FranjasDeCitas",
            franjaId.ToString(CultureInfo.InvariantCulture),
            antes: new { inicioUtc = franja.InicioUtc }, despues: null,
            motivo: null, OrigenDelCambio.Directo, DateTime.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    // ═════════════════════════════════ Participantes ═════════════════════════════════

    private static async Task<IResult> AgregarComprador(
        int organizacionId, int agendaId, AgregarCompradorRequest solicitud, ClaimsPrincipal principal,
        SimusDbContext db, IAntiforgery antiforgery, HttpContext http, PoliticaDeConfirmacionDeCorreo politica,
        IEnviadorDeCorreo enviador, CancellationToken ct)
    {
        if (await ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);

        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;
        var agenda = contexto!.Agenda;
        if (agenda.Estado == "cerrada") return Results.Conflict(new { message = "La agenda ya está cerrada." });

        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var nombre = AgendamientoDeCitas.Opcional(solicitud.Nombre, 240);
        if (nombre is null) errores["nombre"] = ["Escribe el nombre de la persona o de la empresa."];
        var tipo = (solicitud.TipoDeComprador ?? string.Empty).Trim().ToLowerInvariant();
        if (!Array.Exists(AgendamientoDeCitas.TiposDeComprador, t => t == tipo))
        {
            errores["tipoDeComprador"] = ["Elige qué tipo de comprador es: festival, sala, agencia, sello, editorial, medio, institución u otro."];
        }
        var correo = CorreoElectronico.Normalizar(solicitud.Correo) ?? string.Empty;
        if (!MailAddress.TryCreate(correo, out var direccion) || direccion.Address != correo)
        {
            errores["correo"] = ["Escribe un correo válido: con él se enlaza su cuenta."];
        }
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;
        // Si ya hay una cuenta con ese correo, queda enlazada desde el primer momento.
        var candidata = await db.Users.AsNoTracking()
            .Where(u => u.Email == correo && u.IsActive)
            .Select(u => new { u.Id, u.CorreoConfirmado })
            .FirstOrDefaultAsync(ct);
        // Solo se enlaza una cuenta cuyo correo está confirmado (o el entorno lo dispensa): una sin
        // confirmar podría haber escrito el correo de otra persona.
        var cuenta = candidata is not null && (!politica.ConfirmacionObligatoria || candidata.CorreoConfirmado)
            ? candidata
            : null;

        var comprador = new ParticipanteDeCitasRow
        {
            AgendaId = agendaId,
            Rol = AgendamientoDeCitas.RolComprador,
            UsuarioId = cuenta?.Id,
            Nombre = nombre!,
            Entidad = AgendamientoDeCitas.Opcional(solicitud.Entidad, 240),
            TipoDeComprador = tipo,
            CorreoInvitacion = correo,
            Presentacion = AgendamientoDeCitas.Opcional(solicitud.Presentacion, 1200),
            Enlaces = AgendamientoDeCitas.Opcional(solicitud.Enlaces, 1500),
            Espacio = AgendamientoDeCitas.Opcional(solicitud.Espacio, 120),
            Estado = "aprobado",
            FechaInscripcion = ahora,
            IdUsuarioCreador = contexto.Actor,
        };
        db.ParticipantesDeCitas.Add(comprador);
        try
        {
            await db.SaveChangesAsync(ct);
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Crear, "CompradorInvitadoALaAgenda", contexto.Actor, "ParticipantesDeCitas",
                comprador.Id.ToString(CultureInfo.InvariantCulture),
                antes: null, despues: new { rol = comprador.Rol, tipo },
                motivo: null, OrigenDelCambio.Directo, ahora));
            await AgendamientoDeCitas.AvisarAsync(
                db, [cuenta?.Id], "InvitacionALaAgendaDeCitas", "Te invitaron a una agenda de citas",
                $"«{contexto.Mercado.Nombre}» te invitó a su agenda de citas como comprador o booker. Entra a «Mi agenda de citas» para ver a los artistas.",
                agendaId, ahora, ct);
            // SIN CUENTA TODAVIA: se le manda por correo el enlace para aceptar entrando con ese mismo
            // correo o creando la cuenta. En la demostración el correo queda en la cola (dbo.Notificaciones).
            if (cuenta is null)
            {
                await InvitacionesDeAgendaEndpoints.EmitirAsync(
                    db, enviador, comprador, contexto.Mercado.Nombre, contexto.Edicion.Anio, contexto.Actor, ahora, ct);
            }
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException error) when (AgendamientoDeCitas.EsChoqueDeUnicidad(error))
        {
            return Results.Conflict(new { message = "Ese correo ya está invitado a la agenda." });
        }

        return Results.Created(
            $"/api/v1/externo/organizaciones/{organizacionId}/agendas-de-citas/{agendaId}",
            AgendamientoDeCitas.Participante(comprador, verContacto: true, verCorreoDeInvitacion: true) with
            {
                InvitacionPendiente = cuenta is null,
            });
    }

    private static async Task<IResult> AsignarEspacio(
        int organizacionId, int agendaId, int participanteId, AsignarEspacioRequest solicitud,
        ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;

        var participante = await db.ParticipantesDeCitas.FirstOrDefaultAsync(p => p.Id == participanteId && p.AgendaId == agendaId, ct);
        if (participante is null) return Results.NotFound();

        var ahora = DateTime.UtcNow;
        var anterior = participante.Espacio;
        participante.Espacio = AgendamientoDeCitas.Opcional(solicitud.Espacio, 120);
        participante.FechaActualizacion = ahora;
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Actualizar, "EspacioDeCitasAsignado", contexto!.Actor, "ParticipantesDeCitas",
            participanteId.ToString(CultureInfo.InvariantCulture),
            antes: new { espacio = anterior }, despues: new { espacio = participante.Espacio },
            motivo: null, OrigenDelCambio.Directo, ahora));
        await db.SaveChangesAsync(ct);
        return Results.Ok(AgendamientoDeCitas.Participante(participante, verContacto: true, verCorreoDeInvitacion: true));
    }

    private static async Task<IResult> DecidirParticipante(
        int organizacionId, int agendaId, int participanteId, DecisionSobreParticipanteRequest solicitud,
        ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: true, ct);
        if (fallo is not null) return fallo;

        var accion = (solicitud.Accion ?? string.Empty).Trim().ToLowerInvariant();
        var motivo = AgendamientoDeCitas.Opcional(solicitud.Motivo, 600);
        if (accion is not ("aprobar" or "rechazar" or "retirar"))
        {
            return Results.BadRequest(new { message = "La acción no existe. Usa aprobar, rechazar o retirar." });
        }
        if (motivo is null && accion != "aprobar")
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["motivo"] = ["Escribe el motivo: la persona lo va a leer."],
            });
        }

        var participante = await db.ParticipantesDeCitas.FirstOrDefaultAsync(p => p.Id == participanteId && p.AgendaId == agendaId, ct);
        if (participante is null) return Results.NotFound();
        if (participante.Estado is not ("pendiente" or "aprobado" or "lista_de_espera"))
        {
            return Results.Conflict(new { message = "Esa persona ya no está en la agenda.", estado = participante.Estado });
        }
        if (accion == "aprobar" && participante.Estado != "pendiente")
        {
            return Results.Conflict(new { message = "Solo se aprueba a un artista que espera la aprobación.", estado = participante.Estado });
        }
        if (accion == "rechazar" && participante.Rol != AgendamientoDeCitas.RolArtista)
        {
            return Results.Conflict(new { message = "Solo se rechaza una inscripción de artista. A un comprador se le retira." });
        }

        var agenda = contexto!.Agenda;
        var ahora = DateTime.UtcNow;
        var estadoAnterior = participante.Estado;
        var nuevoEstado = accion == "rechazar" ? "rechazado" : accion == "retirar" ? "retirado" : "aprobado";

        await EnTransaccionAsync(db, async () =>
        {
            if (accion == "aprobar")
            {
                // Dos aprobaciones a la vez no pueden pasarse del cupo: mismo candado de fila que la inscripción.
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE AgendasDeCitas SET FechaActualizacion = FechaActualizacion WHERE IdAgenda = {agendaId}", ct);
                var aprobados = await db.ParticipantesDeCitas.CountAsync(
                    p => p.AgendaId == agendaId && p.Rol == AgendamientoDeCitas.RolArtista && p.Estado == "aprobado", ct);
                // Aprobado sin cupo no entra de golpe: espera su turno en la lista, por orden de ingreso.
                if (agenda.CupoArtistas is int cupo && aprobados >= cupo) nuevoEstado = "lista_de_espera";
            }
            participante.Estado = nuevoEstado;
            participante.MotivoDeLaDecision = motivo;
            participante.FechaActualizacion = ahora;
            await AgendamientoDeCitas.RegistrarEstadoAsync(
                db, Modulos.ParticipantesDeCitas, participanteId.ToString(CultureInfo.InvariantCulture), organizacionId, contexto.Actor, "Organización",
                estadoAnterior, nuevoEstado, motivo, ahora, ct);
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Actualizar,
                accion == "rechazar" ? "ParticipanteDeCitasRechazado"
                    : accion == "retirar" ? "ParticipanteDeCitasRetirado"
                    : nuevoEstado == "aprobado" ? "ParticipanteDeCitasAprobado" : "ParticipanteDeCitasEnListaDeEspera",
                contexto.Actor, "ParticipantesDeCitas", participanteId.ToString(CultureInfo.InvariantCulture),
                antes: new { estado = estadoAnterior }, despues: new { estado = nuevoEstado },
                motivo, OrigenDelCambio.Directo, ahora));
            if (accion == "aprobar")
            {
                var entro = nuevoEstado == "aprobado";
                await AgendamientoDeCitas.AvisarAsync(
                    db, [participante.UsuarioId],
                    entro ? "InscripcionEnAgendaConfirmada" : "InscripcionEnListaDeEspera",
                    entro ? "Aprobaron tu inscripción en la agenda de citas" : "Aprobaron tu inscripción: quedaste en la lista de espera",
                    entro
                        ? $"«{contexto.Mercado.Nombre}» aprobó tu inscripción. Ya puedes pedir citas."
                        : $"«{contexto.Mercado.Nombre}» aprobó tu inscripción, pero el cupo está lleno. Entrarás por orden de ingreso si se libera un lugar.",
                    agendaId, ahora, ct);
            }
            else
            {
                await AgendamientoDeCitas.AvisarAsync(
                    db, [participante.UsuarioId],
                    accion == "rechazar" ? "InscripcionEnAgendaRechazada" : "RetiradoDeLaAgendaDeCitas",
                    accion == "rechazar" ? "Tu inscripción no fue aceptada" : "Te retiraron de la agenda de citas",
                    $"«{contexto.Mercado.Nombre}»: {motivo}",
                    agendaId, ahora, ct);
            }
            if (accion != "aprobar")
            {
                await AgendamientoDeCitas.CancelarLasCitasVivasDeAsync(
                    db, agenda, participante, motivo!, contexto.Actor, contexto.Mercado.Nombre, ahora, ct);
            }
            await db.SaveChangesAsync(ct);

            // Si salió un artista que ocupaba un lugar, entra el siguiente de la lista de espera.
            if (participante.Rol == AgendamientoDeCitas.RolArtista && estadoAnterior == "aprobado")
            {
                await AgendamientoDeCitas.PromoverDeLaListaDeEsperaAsync(db, agenda, contexto.Mercado.Nombre, ahora, ct);
            }
        }, ct);

        return Results.Ok(AgendamientoDeCitas.Participante(participante, verContacto: true, verCorreoDeInvitacion: true));
    }

    private static async Task<IResult> CancelarCita(
        int organizacionId, int agendaId, int citaId, MotivoRequest solicitud, ClaimsPrincipal principal,
        SimusDbContext db, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        ArgumentNullException.ThrowIfNull(solicitud);
        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: true, ct);
        if (fallo is not null) return fallo;

        var motivo = AgendamientoDeCitas.Opcional(solicitud.Motivo, 600);
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["motivo"] = ["Escribe el motivo de la cancelación: las dos personas lo van a leer."],
            });
        }

        var cita = await db.CitasDeAgenda.FirstOrDefaultAsync(c => c.Id == citaId && c.AgendaId == agendaId, ct);
        if (cita is null) return Results.NotFound();
        if (!AgendamientoDeCitas.EstaVivo(cita.Estado))
        {
            return Results.Conflict(new { message = "Esa cita ya no está viva.", estado = cita.Estado });
        }

        var ahora = DateTime.UtcNow;
        var estadoAnterior = cita.Estado;
        await EnTransaccionAsync(db, async () =>
        {
            cita.Estado = "cancelada";
            cita.MotivoDeLaDecision = motivo;
            cita.FechaDecision = ahora;
            cita.FechaActualizacion = ahora;
            await AgendamientoDeCitas.RegistrarEstadoAsync(
                db, Modulos.CitasDeAgenda, citaId.ToString(CultureInfo.InvariantCulture), organizacionId, contexto!.Actor, "Organización",
                estadoAnterior, "cancelada", motivo, ahora, ct);
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Actualizar, "CitaCancelada", contexto.Actor, "CitasDeAgenda",
                citaId.ToString(CultureInfo.InvariantCulture),
                antes: new { estado = estadoAnterior }, despues: new { estado = "cancelada" },
                motivo, OrigenDelCambio.Directo, ahora));
            var cuentas = await db.ParticipantesDeCitas.AsNoTracking()
                .Where(p => p.Id == cita.AnfitrionId || p.Id == cita.VisitanteId)
                .Select(p => p.UsuarioId).ToListAsync(ct);
            await AgendamientoDeCitas.AvisarAsync(
                db, cuentas, "CitaCancelada", "La organización canceló una cita",
                $"«{contexto.Mercado.Nombre}» canceló tu cita. Motivo: {motivo}", agendaId, ahora, ct);
            await db.SaveChangesAsync(ct);
        }, ct);

        return Results.NoContent();
    }

    private static async Task<IResult> Exportar(
        int organizacionId, int agendaId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;

        await AgendamientoDeCitas.ExpirarVencidasAsync(db, agendaId, DateTime.UtcNow, ct);
        var citas = await AgendamientoDeCitas.CitasAsync(db, agendaId, quienPregunta: null, ct);
        var personas = await db.ParticipantesDeCitas.AsNoTracking().Where(p => p.AgendaId == agendaId)
            .ToDictionaryAsync(p => p.Id, ct);
        var nombre = $"agenda-de-citas-{contexto!.Mercado.Id}-{contexto.Edicion.Anio}.csv";
        return Results.File(AgendamientoDeCitas.Csv(citas, personas), "text/csv; charset=utf-8", nombre);
    }

    /// <summary>
    /// Un .ics con TODAS las citas confirmadas de la agenda, para la organización (el de cada persona es el suyo:
    /// <c>mi-agenda.ics</c>). El lugar de cada evento es la mesa o el espacio del comprador.
    /// </summary>
    private static async Task<IResult> ExportarCalendario(
        int organizacionId, int agendaId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var (contexto, fallo) = await OrganizadorAsync(principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;

        await AgendamientoDeCitas.ExpirarVencidasAsync(db, agendaId, DateTime.UtcNow, ct);
        var citas = (await AgendamientoDeCitas.CitasAsync(db, agendaId, quienPregunta: null, ct))
            .Where(c => c.Estado == "confirmada")
            .Select(c => (Cita: c, Resumen: $"{c.VisitanteNombre} con {c.AnfitrionNombre}"))
            .ToList();
        var titulo = $"{contexto!.Agenda.Nombre} · {contexto.Mercado.Nombre} {contexto.Edicion.Anio}";
        var ics = AgendamientoDeCitas.Calendario(titulo, citas, DateTime.UtcNow);
        return Results.File(System.Text.Encoding.UTF8.GetBytes(ics), "text/calendar; charset=utf-8",
            $"agenda-de-citas-{contexto.Mercado.Id}-{contexto.Edicion.Anio}.ics");
    }

    // ═════════════════════════════════════ Consola ═════════════════════════════════════

    private static async Task<IResult> ListarParaLaConsola(SimusDbContext db, CancellationToken ct)
    {
        var agendas = await db.AgendasDeCitas.AsNoTracking().OrderByDescending(a => a.FechaCreacion).Take(200).ToListAsync(ct);
        var resultado = new List<AgendaParaLaConsolaDto>(agendas.Count);
        foreach (var agenda in agendas)
        {
            var resumen = await AgendamientoDeCitas.ResumenAsync(db, agenda, ct);
            var canceladas = await db.CitasDeAgenda.CountAsync(c => c.AgendaId == agenda.Id && c.Estado == "cancelada", ct);
            resultado.Add(new AgendaParaLaConsolaDto(
                agenda.Id, resumen.MercadoId, resumen.MercadoNombre, resumen.Anio, resumen.EdicionNombre,
                agenda.Estado, agenda.Modo, resumen.ArtistasAprobados, resumen.ArtistasEnEspera, resumen.Compradores,
                resumen.CitasSolicitadas, resumen.CitasConfirmadas, canceladas, agenda.AprobacionDeArtistas,
                resumen.ArtistasPendientes));
        }
        return Results.Ok(resultado);
    }
}
