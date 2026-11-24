using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El hilo de revisión de los eventos que anuncian las organizaciones.
/// </summary>
/// <remarks>
/// <para>
/// <b>ES EL MISMO HILO QUE FESTIVALES Y MERCADOS</b> (decisión del 5 de noviembre de 2026):
/// cada cambio de estado de un evento de organización deja una fila en
/// <c>dbo.RegistrosRevisionHistorial</c> con quién, cuándo, de qué estado a cuál y el motivo, y la
/// instantánea de la organización se toma con <see cref="InstantaneaDelHistorial"/>, igual que en el
/// circuito de Festivales.
/// </para>
/// <para>
/// <b>LOS ESTADOS NO SE TRADUCEN.</b> La agenda usa <c>borrador</c>, <c>en_revision</c> y
/// <c>publicado</c>, que ya están entre los admitidos por
/// <c>CK_RegistrosRevisionHistorial_EstadoNuevo</c>.
/// </para>
/// </remarks>
internal static class HistorialDeEventosDeOrganizacion
{
    public const string Creado = "EventoCreado";
    public const string EnviadoARevision = "EventoEnviadoARevision";
    public const string EditadoTrasPublicar = "EventoEditadoTrasPublicar";
    public const string Publicado = "EventoPublicado";
    public const string Devuelto = "EventoDevuelto";

    /// <summary>La organización retiró su evento publicado, con motivo (D3-13). Queda «archivado».</summary>
    public const string Retirado = "EventoRetiradoPorOrganizacion";

    /// <summary>La organización canceló su evento publicado, con motivo (D3-13). Sigue «publicado».</summary>
    public const string Cancelado = "EventoCancelado";

    /// <summary>La organización dueña del evento, por el proceso que lo enmarca (nula si responde una persona).</summary>
    public static Task<int?> OrganizacionAsync(SimusDbContext db, EventoAgendaRow evento, CancellationToken ct) =>
        ProcesoDelEvento.OrganizacionDeAsync(db, evento, ct);

    /// <summary>Añade la fila al contexto; la guarda quien llama, en su misma transacción.</summary>
    public static async Task AnotarAsync(
        SimusDbContext db,
        EventoAgendaRow evento,
        string? estadoAnterior,
        string accion,
        string? motivo,
        int? actor,
        DateTime ahora,
        CancellationToken ct,
        IReadOnlyList<string>? camposDeFondo = null)
    {
        var organizacionId = await OrganizacionAsync(db, evento, ct);
        var limpio = string.IsNullOrWhiteSpace(motivo) ? null : motivo.Trim();
        var fila = new HistorialRevisionRegistroRow
        {
            ModuloId = Modulos.Agenda,
            RegistroId = evento.Id.ToString(CultureInfo.InvariantCulture),
            EstadoAnterior = estadoAnterior,
            EstadoNuevo = evento.Estado,
            Accion = accion,
            Comentario = limpio,
            // EL MOTIVO DE UNA DEVOLUCION va además donde el resto de módulos guarda el rechazo.
            MotivoRechazo = accion == Devuelto ? limpio : null,
            UsuarioId = actor is > 0 ? actor : null,
            Fecha = ahora,
            MetadataJson = JsonSerializer.Serialize(new
            {
                festivalId = evento.FestivalId,
                mercadoId = evento.MercadoId,
                tallerId = evento.TallerId,
                espacioId = evento.EspacioId,
                redId = evento.RedId,
                version = evento.Version,
                // QUÉ CAMBIÓ DE FONDO, cuando un evento publicado vuelve a revisión (D3-12): la persona
                // que revisa lee qué mirar, y el historial dice por qué no fue una errata.
                camposDeFondo,
            }),
        };
        await InstantaneaDelHistorial.TomarAsync(db, fila, organizacionId, fila.UsuarioId, ct);
        db.HistorialesRevisionRegistros.Add(fila);
    }

    /// <summary>
    /// El motivo de la última devolución o rechazo de cada evento, para que la organización lo lea.
    /// </summary>
    /// <remarks>
    /// <b>LAS DOS FORMAS DE DECIDIR DEJAN LA FILA CON NOMBRE DISTINTO (D3-16).</b> La bandeja anota
    /// «EventoDevuelto»; «Agenda y eventos» anota «DevueltoParaCorregir» y «RechazadoEnRevision»
    /// (<see cref="HistorialDeEstados"/>). Leer solo la primera dejaba a la organización sin el
    /// motivo de lo que se devolvió o rechazó desde el panel de la Agenda.
    /// </remarks>
    public static async Task<Dictionary<string, string?>> UltimosMotivosAsync(
        SimusDbContext db, IReadOnlyCollection<string> registros, CancellationToken ct)
    {
        if (registros.Count == 0) return new Dictionary<string, string?>(StringComparer.Ordinal);

        var filas = await db.HistorialesRevisionRegistros.AsNoTracking()
            .Where(h => h.ModuloId == Modulos.Agenda
                && (h.Accion == Devuelto || h.Accion == HistorialDeEstados.AccionDevuelto || h.Accion == HistorialDeEstados.AccionRechazado)
                && registros.Contains(h.RegistroId))
            .Select(h => new { h.RegistroId, h.Fecha, h.Id, h.MotivoRechazo })
            .ToListAsync(ct);

        return filas
            .GroupBy(h => h.RegistroId, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(h => h.Fecha).ThenByDescending(h => h.Id).First().MotivoRechazo,
                StringComparer.Ordinal);
    }
}
