using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Al retirar un proceso (taller, festival, mercado, espacio o red) sus eventos de la Agenda se
/// archivan con él (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 113).
/// </summary>
/// <remarks>
/// <para>
/// <b>NADA SE BORRA.</b> El evento sigue en la base con su historial; solo deja de verse en el portal y
/// de editarse, que es lo que ya hace retirarlo a mano (D3-13). Un evento de un proceso retirado que
/// siguiera publicado anunciaría algo que ya no está en el ecosistema.
/// </para>
/// <para>
/// <b>UN SOLO PUNTO PARA TODOS LOS CAMINOS DE RETIRO</b> (la consola, la organización, la aprobación de
/// una solicitud, el cierre de la organización): quien archiva el proceso llama aquí en la misma
/// transacción y no guarda por su cuenta. Los eventos ya archivados o rechazados se dejan como están.
/// </para>
/// </remarks>
internal static class ArchivoDeEventosDelProceso
{
    public const string Accion = "EventoArchivadoConSuProceso";

    /// <summary>Los eventos vivos (no archivados ni rechazados) del proceso: la misma consulta cuenta y archiva.</summary>
    public static IQueryable<EventoAgendaRow> VivosDelProceso(SimusDbContext db, string tipo, int procesoId, bool rastrear)
    {
        IQueryable<EventoAgendaRow> consulta = rastrear ? db.EventosAgenda : db.EventosAgenda.AsNoTracking();
        consulta = tipo switch
        {
            ProcesoDelEvento.Festival => consulta.Where(e => e.FestivalId == procesoId),
            ProcesoDelEvento.Mercado => consulta.Where(e => e.MercadoId == procesoId),
            ProcesoDelEvento.Taller => consulta.Where(e => e.TallerId == procesoId),
            ProcesoDelEvento.Espacio => consulta.Where(e => e.EspacioId == procesoId),
            ProcesoDelEvento.Red => consulta.Where(e => e.RedId == procesoId),
            _ => throw new ArgumentOutOfRangeException(nameof(tipo), tipo, "Proceso desconocido."),
        };
        return consulta.Where(e => e.Estado != "archivado" && e.Estado != "rechazado");
    }

    /// <summary>Archiva los eventos vivos del proceso. No llama a <c>SaveChanges</c>. Devuelve cuántos.</summary>
    public static async Task<int> ArchivarAsync(
        SimusDbContext db, string tipo, int procesoId, int? actor, string? motivo, DateTime ahora, CancellationToken ct)
    {
        var eventos = await VivosDelProceso(db, tipo, procesoId, rastrear: true).ToListAsync(ct);

        var detalle = string.IsNullOrWhiteSpace(motivo)
            ? $"Se archivó porque se retiró el proceso ({ProcesoDelEvento.Etiqueta(tipo)})."
            : $"Se archivó porque se retiró el proceso ({ProcesoDelEvento.Etiqueta(tipo)}): {motivo.Trim()}";
        foreach (var evento in eventos)
        {
            var anterior = evento.Estado;
            evento.Estado = "archivado";
            evento.Version += 1;
            evento.FechaActualizacion = ahora;
            await HistorialDeEventosDeOrganizacion.AnotarAsync(db, evento, anterior, Accion, detalle, actor, ahora, ct);
            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = actor ?? 0,
                TableName = "EventosAgenda",
                RecordId = evento.Id.ToString(CultureInfo.InvariantCulture),
                Action = AccionesAuditoria.Archivar,
                PreviousValuesJson = System.Text.Json.JsonSerializer.Serialize(new { estado = anterior }),
                NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new
                {
                    evento = "EventoArchivadoConSuProceso", proceso = ProcesoDelEvento.Clave(tipo, procesoId), estado = "archivado",
                }),
                CreatedAt = ahora,
            });
        }
        return eventos.Count;
    }
}
