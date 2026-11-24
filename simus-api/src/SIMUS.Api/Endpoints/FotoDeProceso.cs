using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La foto de un proceso del ecosistema (taller, espacio o red): las reglas son UNA, no tres (LUT-02,
/// decisión 115 y 120 de docs/referencia/20-decisiones-y-flujos-por-modulo.md; docs/desarrollo/30-consola-y-acceso.md §30.17).
/// </summary>
/// <remarks>
/// La foto entra por el Banco de archivos y tiene que ser de quien responde por el proceso (de su
/// organización, o suya si no hay organización); si bastara con que existiera, apuntar a un archivo
/// ajeno todavía sin publicar lo volvería público a través del proceso. Es pública solo mientras el
/// proceso está publicado (lo decide el Banco al servirla).
/// </remarks>
internal static class FotoDeProceso
{
    internal const string MensajeDeFotoAjena = "La imagen elegida no está entre las que subiste para este registro.";

    /// <summary>El error de la foto pedida, o <c>null</c> si es válida (nula, la que ya tenía o una propia).</summary>
    internal static async Task<string[]?> ValidarAsync(
        SimusDbContext db, int? pedida, int? actual, int? organizacionId, int? personaId, CancellationToken ct)
    {
        if (pedida is not int foto || foto == actual) return null;
        var esSuya = await db.Files.AsNoTracking().AnyAsync(x => x.Id == foto
            && (organizacionId != null
                ? x.OrganizacionId == organizacionId
                : x.OrganizacionId == null && x.UploadedByUserId == personaId), ct);
        return esSuya ? null : [MensajeDeFotoAjena];
    }

    /// <summary>La dirección de lectura de una foto del banco.</summary>
    internal static string? Url(int? archivoId) =>
        archivoId is int id ? "/api/v1/publico/archivos/" + id.ToString(CultureInfo.InvariantCulture) : null;

    /// <summary>El texto alternativo de cada foto, para pintarla con su descripción.</summary>
    internal static async Task<Dictionary<int, string?>> TextosAsync(
        SimusDbContext db, IEnumerable<int?> archivoIds, CancellationToken ct)
    {
        var ids = archivoIds.Where(x => x is not null).Select(x => x!.Value).Distinct().ToList();
        return ids.Count == 0
            ? []
            : await db.Files.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.AltText, ct);
    }
}
