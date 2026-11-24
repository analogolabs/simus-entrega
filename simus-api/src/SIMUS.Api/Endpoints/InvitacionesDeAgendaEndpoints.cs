using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
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
/// La invitación a su agenda de un comprador o booker que el Mercado cargó y que todavía no tiene cuenta
/// (docs/referencia/26-agenda-de-citas-y-mercados.md §26.10, decisión del 12 de noviembre de 2026).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL MISMO FLUJO QUE LAS INVITACIONES DE ORGANIZACION</b> (<see cref="EquipoDeOrganizacionEndpoints"/>):
/// enlace de UN SOLO USO que vence a los 7 días; de él solo se guarda el resumen SHA-256 del testigo; la
/// consulta anónima enmascara el correo; y solo acepta la cuenta con ESE correo (quien no la tiene, la
/// crea con él). Al aceptar, la cuenta queda enlazada con el comprador de la agenda.
/// </para>
/// <para>
/// <b>EL CORREO VA A LA COLA DE SALIDA.</b> Mientras no haya proveedor real, el mensaje queda en
/// <c>dbo.Notificaciones</c> con estado «pendiente» (<see cref="IEnviadorDeCorreo"/>), y la organización
/// también ve el enlace para poder compartirlo por otro medio.
/// </para>
/// </remarks>
public static class InvitacionesDeAgendaEndpoints
{
    internal static readonly TimeSpan Vigencia = TimeSpan.FromDays(7);
    internal const string TipoDeEvento = "InvitacionALaAgendaDeCitas";

    public static RouteGroupBuilder MapInvitacionesDeAgendaEndpoints(this RouteGroupBuilder api)
    {
        var organizacion = api.MapGroup("/externo/organizaciones/{organizacionId:int}/agendas-de-citas/{agendaId:int}/participantes/{participanteId:int}/invitacion")
            .WithTags("agendamiento-organizacion");
        organizacion.RequireAuthorization(SimusAuthentication.ExternalPolicy);
        organizacion.MapPost(string.Empty, EmitirDesdeLaOrganizacion).WithName("EmitirInvitacionDeAgenda");
        organizacion.MapDelete(string.Empty, RevocarDesdeLaOrganizacion).WithName("RevocarInvitacionDeAgenda");

        // Se consulta sin sesión: quien abre el enlace puede no tener cuenta. El testigo viaja en el
        // cuerpo, no en la URL, y la respuesta enmascara el correo.
        var personas = api.MapGroup("/externo/agendas-de-citas/invitaciones").WithTags("agendamiento-personas");
        personas.MapPost("/consultar", Consultar).AllowAnonymous().WithName("ConsultarInvitacionDeAgenda");
        personas.MapPost("/aceptar", Aceptar)
            .RequireAuthorization(SimusAuthentication.ExternalPolicy)
            .WithName("AceptarInvitacionDeAgenda");
        return api;
    }

    internal static string RutaDeInvitacion(string testigo) => $"/ecosistema/invitacion-agenda?testigo={testigo}";

    private static string Resumir(string testigo) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(testigo))).ToLowerInvariant();

    /// <summary>
    /// Emite la invitación de un comprador sin cuenta, dejando sin efecto la pendiente si la había, y
    /// encola el correo. Guarda lo suyo; la bitácora de la emisión queda sin guardar para quien llama.
    /// </summary>
    internal static async Task<(InvitacionDeAgendaRow Fila, string Enlace)> EmitirAsync(
        SimusDbContext db, IEnviadorDeCorreo correo, ParticipanteDeCitasRow comprador, string mercado, int anio,
        int actor, DateTime ahora, CancellationToken ct)
    {
        var anteriores = await db.InvitacionesDeAgenda
            .Where(i => i.ParticipanteId == comprador.Id && i.Estado == "pendiente").ToListAsync(ct);
        foreach (var anterior in anteriores)
        {
            anterior.Estado = "revocada";
            anterior.FechaCierre = ahora;
        }
        if (anteriores.Count > 0) await db.SaveChangesAsync(ct);

        var testigo = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var fila = new InvitacionDeAgendaRow
        {
            ParticipanteId = comprador.Id,
            CorreoInvitado = comprador.CorreoInvitacion!,
            HashTestigo = Resumir(testigo),
            Estado = "pendiente",
            IdUsuarioInvita = actor,
            FechaEmision = ahora,
            FechaExpiracion = ahora.Add(Vigencia),
        };
        db.InvitacionesDeAgenda.Add(fila);
        await db.SaveChangesAsync(ct);

        var enlace = RutaDeInvitacion(testigo);
        var nombreDeQuienInvita = await db.Users.AsNoTracking().Where(u => u.Id == actor).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        var redactado = CorreosDelSistema.InvitacionDeAgenda(mercado, anio, nombreDeQuienInvita, enlace, (int)Vigencia.TotalDays);
        await correo.EncolarAsync(new CorreoSaliente(
            comprador.CorreoInvitacion!, redactado.Asunto, redactado.Cuerpo, TipoDeEvento), ct);

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Crear, "InvitacionDeAgendaEmitida", actor, "InvitacionesDeAgenda",
            fila.Id.ToString(CultureInfo.InvariantCulture),
            antes: null, despues: new { participanteId = comprador.Id }, motivo: null, OrigenDelCambio.Directo, ahora));
        return (fila, enlace);
    }

    private static async Task<IResult> EmitirDesdeLaOrganizacion(
        int organizacionId, int agendaId, int participanteId, ClaimsPrincipal principal, SimusDbContext db,
        IEnviadorDeCorreo correo, IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        var (contexto, fallo) = await AgendamientoDeLaOrganizacionEndpoints.OrganizadorAsync(
            principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;
        if (contexto!.Agenda.Estado == "cerrada") return Results.Conflict(new { message = "La agenda ya está cerrada." });

        var comprador = await db.ParticipantesDeCitas
            .FirstOrDefaultAsync(p => p.Id == participanteId && p.AgendaId == agendaId, ct);
        if (comprador is null) return Results.NotFound();
        if (comprador.Rol != AgendamientoDeCitas.RolComprador || comprador.Estado != "aprobado")
        {
            return Results.Conflict(new { message = "Solo se invita a un comprador que sigue en la agenda." });
        }
        if (comprador.UsuarioId is not null)
        {
            return Results.Conflict(new { message = "Ese comprador ya tiene su cuenta enlazada: no necesita invitación." });
        }

        var ahora = DateTime.UtcNow;
        var (fila, enlace) = await EmitirAsync(
            db, correo, comprador, contexto.Mercado.Nombre, contexto.Edicion.Anio, contexto.Actor, ahora, ct);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new InvitacionDeAgendaEmitidaDto(comprador.Id, enlace, fila.FechaExpiracion));
    }

    private static async Task<IResult> RevocarDesdeLaOrganizacion(
        int organizacionId, int agendaId, int participanteId, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext http, CancellationToken ct)
    {
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        var (contexto, fallo) = await AgendamientoDeLaOrganizacionEndpoints.OrganizadorAsync(
            principal, db, organizacionId, agendaId, administrar: false, ct);
        if (fallo is not null) return fallo;

        var pendiente = await db.InvitacionesDeAgenda
            .Join(db.ParticipantesDeCitas, i => i.ParticipanteId, p => p.Id, (i, p) => new { Invitacion = i, p.AgendaId })
            .Where(x => x.AgendaId == agendaId && x.Invitacion.ParticipanteId == participanteId && x.Invitacion.Estado == "pendiente")
            .Select(x => x.Invitacion)
            .FirstOrDefaultAsync(ct);
        if (pendiente is null) return Results.NotFound();

        var ahora = DateTime.UtcNow;
        pendiente.Estado = "revocada";
        pendiente.FechaCierre = ahora;
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Actualizar, "InvitacionDeAgendaRevocada", contexto!.Actor, "InvitacionesDeAgenda",
            pendiente.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = "pendiente" }, despues: new { estado = "revocada" }, motivo: null, OrigenDelCambio.Directo, ahora));
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    // ── Quien abre el enlace ───────────────────────────────────────────────────────────────────

    private sealed record Resuelta(
        InvitacionDeAgendaRow? Fila, ParticipanteDeCitasRow? Comprador, string Estado, string Mercado, int Anio, string? Edicion);

    private static async Task<Resuelta> ResolverAsync(SimusDbContext db, string? testigo, DateTime ahora, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(testigo)) return new Resuelta(null, null, "no_existe", string.Empty, 0, null);
        var resumen = Resumir(testigo.Trim());
        var fila = await db.InvitacionesDeAgenda.FirstOrDefaultAsync(i => i.HashTestigo == resumen, ct);
        if (fila is null) return new Resuelta(null, null, "no_existe", string.Empty, 0, null);

        var comprador = await db.ParticipantesDeCitas.FirstAsync(p => p.Id == fila.ParticipanteId, ct);
        var agenda = await db.AgendasDeCitas.AsNoTracking().FirstAsync(a => a.Id == comprador.AgendaId, ct);
        var edicion = await db.EdicionesMercado.AsNoTracking().FirstAsync(e => e.Id == agenda.EdicionMercadoId, ct);
        var mercado = await db.Mercados.AsNoTracking().FirstAsync(m => m.Id == edicion.MercadoId, ct);

        var estado = fila.Estado;
        // Si el comprador salió de la agenda o la agenda se cerró, la invitación ya no lleva a nada.
        if (estado == "pendiente" && (comprador.Estado != "aprobado" || agenda.Estado == "cerrada")) estado = "revocada";
        else if (estado == "pendiente" && fila.FechaExpiracion <= ahora) estado = "vencida";
        return new Resuelta(fila, comprador, estado, mercado.Nombre, edicion.Anio, edicion.Nombre);
    }

    private static async Task<IResult> Consultar(InvitacionDeAgendaSolicitud solicitud, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var r = await ResolverAsync(db, solicitud.Testigo, DateTime.UtcNow, ct);
        if (r.Fila is null) return Results.NotFound(new { estado = r.Estado });
        // ENMASCARADO: la consulta es anónima y basta tener el enlace; no se entrega el correo completo.
        return Results.Ok(new InvitacionDeAgendaAbiertaDto(
            r.Mercado, r.Anio, r.Edicion, CorreoElectronico.Enmascarar(r.Fila.CorreoInvitado), r.Estado, r.Fila.FechaExpiracion));
    }

    private static async Task<IResult> Aceptar(
        InvitacionDeAgendaSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery,
        HttpContext http, PoliticaDeConfirmacionDeCorreo politica, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        if (await AgendamientoDeLaOrganizacionEndpoints.ExigirTestigoAsync(antiforgery, http) is { } sinTestigo) return sinTestigo;
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        var ahora = DateTime.UtcNow;
        var r = await ResolverAsync(db, solicitud.Testigo, ahora, ct);
        if (r.Fila is null || r.Comprador is null) return Results.NotFound(new { estado = r.Estado, message = "El enlace de invitación no existe." });
        if (r.Estado != "pendiente")
        {
            if (r.Estado == "vencida" && r.Fila.Estado == "pendiente")
            {
                r.Fila.Estado = "vencida";
                r.Fila.FechaCierre = ahora;
                await db.SaveChangesAsync(ct);
            }
            return Results.Conflict(new { estado = r.Estado, message = MensajeDeEstado(r.Estado) });
        }

        var cuenta = await db.Users.AsNoTracking().FirstAsync(u => u.Id == persona.Value, ct);
        // SOLO LA CUENTA INVITADA, como en las invitaciones de organización: un enlace reenviado no da
        // acceso a otra persona.
        if (!string.Equals(CorreoElectronico.Normalizar(cuenta.Email), CorreoElectronico.Normalizar(r.Fila.CorreoInvitado), StringComparison.Ordinal))
        {
            var destino = CorreoElectronico.Enmascarar(r.Fila.CorreoInvitado);
            return Results.Conflict(new
            {
                estado = "correo_distinto",
                correoInvitado = destino,
                message = $"Esta invitación se envió a {destino} y solo puede aceptarla la cuenta con ese correo. "
                    + "Cierra la sesión y entra con esa cuenta, o créala con ese correo si todavía no la tienes.",
            });
        }
        if (politica.ConfirmacionObligatoria && !cuenta.CorreoConfirmado)
        {
            return Results.Conflict(new
            {
                estado = "correo_sin_confirmar",
                message = $"Falta confirmar el correo de tu cuenta: abre el enlace que enviamos a {cuenta.Email} y vuelve a este.",
            });
        }
        if (r.Comprador.UsuarioId is int otra && otra != persona.Value)
        {
            return Results.Conflict(new { estado = "ya_enlazada", message = "Este comprador ya quedó enlazado con otra cuenta." });
        }

        r.Comprador.UsuarioId = persona.Value;
        r.Comprador.FechaActualizacion = ahora;
        r.Fila.Estado = "aceptada";
        r.Fila.IdUsuarioAcepta = persona.Value;
        r.Fila.FechaCierre = ahora;
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Actualizar, "InvitacionDeAgendaAceptada", persona.Value, "InvitacionesDeAgenda",
            r.Fila.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = "pendiente" }, despues: new { estado = "aceptada", participanteId = r.Comprador.Id },
            motivo: null, OrigenDelCambio.Directo, ahora));
        await db.SaveChangesAsync(ct);

        return Results.Ok(new { agendaId = r.Comprador.AgendaId });
    }

    private static string MensajeDeEstado(string estado) => estado switch
    {
        "aceptada" => "Esta invitación ya se aceptó.",
        "revocada" => "La organización dejó sin efecto esta invitación.",
        "vencida" => "Esta invitación venció. Pide a la organización que te envíe otra.",
        _ => "El enlace de invitación no sirve.",
    };
}
