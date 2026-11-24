using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El idioma de un contenido, con UNA sola lógica.
/// </summary>
/// <remarks>
/// <para>
/// <b>UN CÓDIGO Y UN NOMBRE, EN TODAS PARTES.</b> El catálogo <c>Idiomas</c> tiene como clave el código ISO 639-3 (o un
/// código propio <c>qaa</c>–<c>qtz</c>) y el nombre en español. Eso es lo que se pide en un formulario, lo que se guarda
/// y lo que se devuelve: nunca una combinación escrita («es ; en») ni una etiqueta distinta según quién pregunte.
/// </para>
/// <para>
/// <b>UNA SOLA FUENTE DE VERDAD.</b> Los idiomas de una publicación están en <c>PublicacionesEditorialesIdiomas</c> y en
/// ningún otro sitio. Antes había además una columna de texto con la misma información, y dos copias acaban discrepando.
/// </para>
/// <para>
/// Todo lo que toca idiomas en lo editorial pasa por aquí: leer los de una ficha, validarlos al guardar, aplicarlos,
/// resolver el texto libre de una importación y armar el vocabulario del formulario.
/// </para>
/// </remarks>
public static class IdiomasDeContenido
{
    /// <summary>Los idiomas de una publicación, el principal primero.</summary>
    public static async Task<IReadOnlyList<IdiomaDeFichaDto>> DeLaPublicacionAsync(
        SimusDbContext db, long publicacionId, CancellationToken ct) =>
        await db.PublicacionesEditorialesIdiomas.AsNoTracking()
            .Where(x => x.PublicacionEditorialId == publicacionId)
            .Join(db.Idiomas.AsNoTracking(), x => x.CodigoIdioma, i => i.Codigo, (x, i) => new { x.Orden, i.Codigo, i.Nombre })
            .OrderBy(x => x.Orden)
            .Select(x => new IdiomaDeFichaDto(x.Codigo, x.Nombre))
            .ToListAsync(ct);

    /// <summary>Limpia una lista de códigos: minúsculas, sin vacíos y sin repetidos, conservando el orden.</summary>
    public static List<string> Normalizar(IEnumerable<string>? codigos) =>
        (codigos ?? [])
            .Select(c => (c ?? string.Empty).Trim().ToLowerInvariant())
            .Where(c => c.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// Comprueba que cada código exista en el catálogo y esté activo. Ausente (<c>null</c>) no es un error: no se toca.
    /// </summary>
    public static async Task<IResult?> ValidarAsync(SimusDbContext db, IReadOnlyList<string>? codigos, CancellationToken ct)
    {
        if (codigos is null) return null;
        var pedidos = Normalizar(codigos);
        if (pedidos.Count == 0) return null;

        var validos = await db.Idiomas.AsNoTracking()
            .Where(i => i.Activo && pedidos.Contains(i.Codigo))
            .Select(i => i.Codigo)
            .ToListAsync(ct);
        var desconocidos = pedidos.Where(c => !validos.Contains(c)).ToList();
        return desconocidos.Count == 0
            ? null
            : Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["idiomas"] = [$"Idioma desconocido o inactivo: {string.Join(", ", desconocidos)}."],
            });
    }

    /// <summary>
    /// Deja los idiomas de la publicación diciendo lo que pide la solicitud. <c>null</c> no toca nada; una lista vacía
    /// los quita todos. La posición en la lista es el orden: el primero es el idioma principal.
    /// </summary>
    public static async Task AplicarAsync(
        SimusDbContext db, long publicacionId, IReadOnlyList<string>? codigos, CancellationToken ct)
    {
        if (codigos is null) return;

        var nuevos = Normalizar(codigos);
        var actuales = await db.PublicacionesEditorialesIdiomas
            .Where(x => x.PublicacionEditorialId == publicacionId).ToListAsync(ct);
        db.PublicacionesEditorialesIdiomas.RemoveRange(actuales);

        for (var posicion = 0; posicion < nuevos.Count; posicion++)
        {
            db.PublicacionesEditorialesIdiomas.Add(new PublicacionEditorialIdiomaRow
            {
                PublicacionEditorialId = publicacionId,
                CodigoIdioma = nuevos[posicion],
                Orden = posicion + 1,
            });
        }
    }

    public sealed record ResolucionDeIdiomas(IReadOnlyList<string> Codigos, IReadOnlyList<string> NoReconocidos);

    /// <summary>Reconoce nombres y códigos; conserva los términos desconocidos para revisión.</summary>
    public static async Task<ResolucionDeIdiomas> ResolverConRevisionAsync(SimusDbContext db, string? texto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(texto)) return new([], []);
        var partes = texto.Split([';', ',', '/'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .SelectMany(p => p.Split(" y ", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        var catalogo = await db.Idiomas.AsNoTracking().Where(i => i.Activo).ToListAsync(ct);
        var encontrados = new List<string>();
        var desconocidos = new List<string>();
        foreach (var original in partes)
        {
            var parte = SinTildes(original);
            var hallado = catalogo.FirstOrDefault(i =>
                string.Equals(i.Codigo, parte, StringComparison.OrdinalIgnoreCase)
                || string.Equals(i.CodigoIso6391, parte, StringComparison.OrdinalIgnoreCase)
                || SinTildes(i.Nombre) == parte)?.Codigo;
            if (hallado is null) desconocidos.Add(original);
            else if (!encontrados.Contains(hallado)) encontrados.Add(hallado);
        }
        return new(encontrados, desconocidos);
    }

    public static async Task<IReadOnlyList<string>> ResolverTextoAsync(SimusDbContext db, string? texto, CancellationToken ct)
    {
        var resultado = await ResolverConRevisionAsync(db, texto, ct);
        if (resultado.NoReconocidos.Count > 0)
            throw new InvalidOperationException($"Idiomas pendientes de revisión: {string.Join(", ", resultado.NoReconocidos)}.");
        return resultado.Codigos;
    }

    public static async Task<List<IdiomaEditorialDto>> VocabularioAsync(SimusDbContext db, CancellationToken ct)
    {
        var usos = await db.PublicacionesEditorialesIdiomas.AsNoTracking()
            .GroupBy(x => x.CodigoIdioma)
            .Select(g => new { Codigo = g.Key, Cuantas = g.Count() })
            .ToDictionaryAsync(x => x.Codigo, x => x.Cuantas, ct);
        return (await db.Idiomas.AsNoTracking().Where(i => i.Activo).ToListAsync(ct))
            .Select(i => new IdiomaEditorialDto(i.Codigo, i.Nombre, usos.GetValueOrDefault(i.Codigo), i.Verificacion))
            .OrderByDescending(i => i.Usos).ThenBy(i => i.Nombre, StringComparer.Ordinal).ToList();
    }

    private static string SinTildes(string texto)
    {
        var descompuesto = (texto ?? string.Empty).Trim().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(descompuesto.Length);
        foreach (var c in descompuesto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }
}
