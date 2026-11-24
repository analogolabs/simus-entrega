using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Cierra los avisos de «pendiente de revisión» de un registro cuando ya se decidió.
/// </summary>
/// <remarks>
/// <b>UN AVISO DE TRABAJO PENDIENTE QUE SIGUE SIN LEER TRAS LA DECISIÓN ES UN AVISO QUE MIENTE.</b>
/// «Mercado pendiente de revisión» seguía en negrita después de publicar el Mercado: la campana
/// prometía trabajo que ya no existía. Al decidir, los avisos institucionales de ese registro se
/// marcan como leídos; no se borran, porque siguen siendo la huella de que el trabajo llegó.
/// </remarks>
internal static class AvisosDeRevision
{
    public static async Task MarcarComoResueltosAsync(
        SimusDbContext db,
        string moduloId,
        string registroId,
        string tipoDeEvento,
        DateTime ahora,
        CancellationToken ct)
    {
        var pendientes = await db.Notifications
            .Where(item => item.AccessScope == SimusAuthentication.InstitutionalScope
                && item.ModuloId == moduloId
                && item.RecordId == registroId
                && item.EventType == tipoDeEvento
                && item.ReadAt == null)
            .ToListAsync(ct);
        foreach (var aviso in pendientes)
        {
            aviso.ReadAt = ahora;
            aviso.Status = "leida";
        }
    }
}
