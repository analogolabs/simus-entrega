using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El aviso que recibe quien administra una organización cuando el Programa decide sobre uno de
/// sus eventos.
/// </summary>
/// <remarks>
/// <para>
/// <b>LA DECIDA QUIEN LA DECIDA, LA ORGANIZACIÓN SE ENTERA (D3-16).</b> Un evento se puede decidir
/// desde la bandeja «Solicitudes y revisiones» y desde «Agenda y eventos». Solo la bandeja avisaba:
/// un evento rechazado o retirado desde «Agenda y eventos» le aparecía a la organización como
/// «Rechazado» en la lista, sin aviso y sin saber por qué.
/// </para>
/// <para>
/// VA AL ÁMBITO EXTERNO, el buzón del panel de la organización. Si el evento no cuelga de un
/// Festival o Mercado con organización identificada no hay a quién avisar, y se deja así en vez
/// de inventar un destinatario.
/// </para>
/// </remarks>
internal static class AvisosDeEventosDeOrganizacion
{
    /// <summary>
    /// <c>Notificaciones.Cuerpo</c> admite 2000 caracteres; el motivo de una decisión puede ser más
    /// largo. Se acota para que escribir un motivo extenso no impida decidir.
    /// </summary>
    private const int MaximoDelMotivo = 1500;

    /// <summary>
    /// Deja el aviso que corresponde al estado en el que quedó el evento: publicado, devuelto para
    /// corregir (venía de revisión y vuelve a borrador), rechazado o retirado de la agenda.
    /// </summary>
    public static async Task AvisarAsync(
        SimusDbContext db, EventoAgendaRow evento, string? estadoAnterior, string? motivo, DateTime ahora, CancellationToken ct)
    {
        var aviso = evento.Estado switch
        {
            "publicado" => (Tipo: "EventoPublicado", Titulo: "Tu evento está publicado",
                Cuerpo: $"El evento «{evento.Titulo}» ya aparece en la agenda pública."),
            "borrador" when estadoAnterior == "en_revision" => (Tipo: "EventoDevuelto", Titulo: "Tu evento volvió para corregir",
                Cuerpo: $"El PNMC devolvió el evento «{evento.Titulo}» para que lo corrijas.{ConMotivo(motivo)}"),
            "rechazado" => (Tipo: "EventoRechazado", Titulo: "Tu evento fue rechazado",
                Cuerpo: $"El PNMC rechazó el evento «{evento.Titulo}».{ConMotivo(motivo)}"),
            "archivado" => (Tipo: "EventoRetirado", Titulo: "Tu evento salió de la agenda",
                Cuerpo: $"El evento «{evento.Titulo}» ya no aparece en la agenda pública.{ConMotivo(motivo)}"),
            _ => default,
        };
        if (aviso.Tipo is null) return;

        await EnviarAsync(db, evento, aviso.Tipo, aviso.Titulo, aviso.Cuerpo, ahora, ct);
    }

    /// <summary>
    /// El aviso de que el evento se canceló (D3-13): sigue en la agenda, con su motivo, y quien
    /// administra la organización lo recibe aunque lo haya cancelado otra persona de ella.
    /// </summary>
    public static Task AvisarCancelacionAsync(
        SimusDbContext db, EventoAgendaRow evento, string? motivo, DateTime ahora, CancellationToken ct) =>
        EnviarAsync(
            db, evento, "EventoCancelado", "Tu evento quedó cancelado",
            $"El evento «{evento.Titulo}» sigue en la agenda pública, marcado como cancelado.{ConMotivo(motivo)}",
            ahora, ct);

    private static async Task EnviarAsync(
        SimusDbContext db, EventoAgendaRow evento, string tipo, string titulo, string cuerpo, DateTime ahora, CancellationToken ct)
    {
        var organizacionId = await HistorialDeEventosDeOrganizacion.OrganizacionAsync(db, evento, ct);

        // SI NO HAY ORGANIZACIÓN, EL AVISO ES PARA LA PERSONA RESPONSABLE del taller, el espacio o la red
        // (LUT-01): es quien anunció el evento y la única que responde por su proceso.
        var personas = organizacionId is int organizacion
            ? (await db.UserEntities.AsNoTracking()
                .Where(ue => ue.EntityId == organizacion && ue.IsActive)
                .Join(db.Users.AsNoTracking().Where(u => u.IsActive),
                    relacion => relacion.UserId, usuario => usuario.Id,
                    (_, usuario) => new { usuario.Id, usuario.Email })
                .ToListAsync(ct)).Select(p => (p.Id, p.Email)).ToList()
            : await PersonaResponsableAsync(db, evento, ct);

        foreach (var persona in personas)
        {
            db.Notifications.Add(new NotificationRow
            {
                RecipientUserId = persona.Id,
                RecipientEmail = persona.Email,
                EventType = tipo,
                AccessScope = SimusAuthentication.ExternalScope,
                Channel = "internal",
                Title = titulo,
                Body = cuerpo,
                Status = "enviada",
                ModuloId = Modulos.Agenda,
                RecordId = evento.Id.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });
        }
    }

    private static async Task<List<(int Id, string Email)>> PersonaResponsableAsync(
        SimusDbContext db, EventoAgendaRow evento, CancellationToken ct)
    {
        var persona = await ProcesoDelEvento.PersonaResponsableDeAsync(db, evento, ct);
        if (persona is not int id) return [];

        var cuenta = await db.Users.AsNoTracking()
            .Where(u => u.Id == id && u.IsActive)
            .Select(u => new { u.Id, u.Email })
            .FirstOrDefaultAsync(ct);
        return cuenta is null ? [] : [(cuenta.Id, cuenta.Email)];
    }

    private static string ConMotivo(string? motivo)
    {
        var limpio = (motivo ?? string.Empty).Trim();
        if (limpio.Length == 0) return string.Empty;
        if (limpio.Length > MaximoDelMotivo) limpio = limpio[..(MaximoDelMotivo - 1)].TrimEnd() + "…";
        return " " + limpio;
    }
}
