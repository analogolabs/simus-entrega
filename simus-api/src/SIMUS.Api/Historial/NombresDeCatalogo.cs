using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Historial;

/// <summary>
/// Resuelve el nombre que tiene HOY un código de catálogo, para guardarlo junto al código en el
/// registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.1, decisión de la dirección del 10 de noviembre de 2026).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL CÓDIGO ES INTERNO; LA PERSONA LEE EL NOMBRE.</b> El historial guarda las dos cosas: el código
/// (el dato verdadero, lo que usa el sistema) y el nombre que tenía ese día. Así la pantalla puede
/// decir «Medellín» y no «05001», y si mañana renombran la opción del catálogo, la historia sigue
/// diciendo lo que se leía el día del cambio.
/// </para>
/// <para>
/// <b>SI NO SE RESUELVE, QUEDA NULO Y SE MUESTRA EL CÓDIGO.</b> Un código que ya no existe en el
/// catálogo no rompe el guardado: la fila lleva el código y ningún nombre.
/// </para>
/// </remarks>
public static class NombresDeCatalogo
{
    /// <summary>
    /// Los nombres de <paramref name="codigos"/> en <paramref name="catalogo"/>. Los que no se
    /// encuentran no aparecen en el diccionario.
    /// </summary>
    public static async Task<IReadOnlyDictionary<string, string>> ResolverAsync(
        SimusDbContext db,
        CatalogoDeCampo catalogo,
        IReadOnlyCollection<string> codigos,
        CancellationToken cancellationToken)
    {
        var resultado = new Dictionary<string, string>(StringComparer.Ordinal);
        if (codigos.Count == 0 || catalogo == CatalogoDeCampo.Ninguno) return resultado;

        switch (catalogo)
        {
            case CatalogoDeCampo.Departamento:
                var departamentos = await db.DivipolaLocations.AsNoTracking()
                    .Where(x => codigos.Contains(x.DepartmentCode))
                    .Select(x => new { x.DepartmentCode, x.DepartmentName })
                    .Distinct()
                    .ToListAsync(cancellationToken);
                foreach (var d in departamentos) resultado[d.DepartmentCode] = d.DepartmentName;
                break;

            case CatalogoDeCampo.Municipio:
                var municipios = await db.DivipolaLocations.AsNoTracking()
                    .Where(x => codigos.Contains(x.MunicipalityCode))
                    .Select(x => new { x.MunicipalityCode, x.MunicipalityName, x.DepartmentName })
                    .ToListAsync(cancellationToken);
                // «Medellín (ANTIOQUIA)»: el nombre solo es ambiguo entre departamentos.
                foreach (var m in municipios) resultado[m.MunicipalityCode] = $"{m.MunicipalityName} ({m.DepartmentName})";
                break;

            case CatalogoDeCampo.Archivo:
                var ids = codigos.Select(c => int.TryParse(c, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) ? i : (int?)null)
                    .Where(i => i is not null).Select(i => i!.Value).ToList();
                var archivos = await db.Files.AsNoTracking()
                    .Where(x => ids.Contains(x.Id))
                    .Select(x => new { x.Id, x.OriginalName })
                    .ToListAsync(cancellationToken);
                foreach (var a in archivos) resultado[a.Id.ToString(CultureInfo.InvariantCulture)] = a.OriginalName;
                break;

            case CatalogoDeCampo.TipologiaFestival:
                var tipologias = await db.TipologiasFestival.AsNoTracking()
                    .Select(x => new { x.Id, x.Nombre }).ToListAsync(cancellationToken);
                foreach (var t in tipologias) resultado[t.Id.ToString(CultureInfo.InvariantCulture)] = t.Nombre;
                break;

            case CatalogoDeCampo.FuenteFinanciacion:
                var fuentes = await db.FuentesFinanciacion.AsNoTracking()
                    .Select(x => new { x.Id, x.Nombre }).ToListAsync(cancellationToken);
                foreach (var f in fuentes) resultado[f.Id.ToString(CultureInfo.InvariantCulture)] = f.Nombre;
                break;

            case CatalogoDeCampo.Festival:
                var festivalIds = Enteros(codigos);
                var festivales = await db.FestivalRecords.AsNoTracking()
                    .Where(x => festivalIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.Name }).ToListAsync(cancellationToken);
                foreach (var f in festivales) resultado[f.Id.ToString(CultureInfo.InvariantCulture)] = f.Name;
                break;

            case CatalogoDeCampo.Mercado:
                var mercadoIds = Enteros(codigos);
                var mercados = await db.Mercados.AsNoTracking()
                    .Where(x => mercadoIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.Nombre }).ToListAsync(cancellationToken);
                foreach (var m in mercados) resultado[m.Id.ToString(CultureInfo.InvariantCulture)] = m.Nombre;
                break;

            case CatalogoDeCampo.CategoriaDeContenido:
                var categoriaIds = Enteros(codigos);
                var categorias = await db.Categorias.AsNoTracking()
                    .Where(x => categoriaIds.Contains(x.Id))
                    .Select(x => new { x.Id, x.NombreCategoria }).ToListAsync(cancellationToken);
                foreach (var c in categorias) resultado[c.Id.ToString(CultureInfo.InvariantCulture)] = c.NombreCategoria;
                break;

            case CatalogoDeCampo.TipoOrganizador:
                var tipos = await db.TiposOrganizador.AsNoTracking()
                    .Select(x => new { x.Id, x.Nombre }).ToListAsync(cancellationToken);
                foreach (var t in tipos) resultado[t.Id.ToString(CultureInfo.InvariantCulture)] = t.Nombre;
                break;
        }

        return resultado;
    }

    private static List<int> Enteros(IReadOnlyCollection<string> codigos) =>
        codigos.Select(c => int.TryParse(c, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) ? i : (int?)null)
            .Where(i => i is not null).Select(i => i!.Value).ToList();
}
