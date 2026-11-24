using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// EL CANDADO del retiro de <c>dbo.PerfilesPublicosFestival</c>: desde el PR-8 la tabla no existe y ningún código de
/// <c>simus-api/src</c> la nombra. Antes (PR-6) se permitían las dos declaraciones del modelo (<c>Rows.cs</c> y
/// <c>SimusDbContext.cs</c>); el PR-8 las borró y esta prueba ya no admite excepciones. Falla si alguien vuelve a nombrar la tabla
/// o su conjunto (<c>PerfilesPublicosFestival</c>), su fila (<c>PerfilPublicoFestivalRow</c>) o su módulo
/// (<c>PerfilesPublicosDeFestival</c>, <c>perfiles-publicos-festival</c>) en código de producción. Los comentarios no cuentan: la
/// historia del retiro se puede seguir contando. La referencia lógica <c>CambiosDeRegistro.PerfilPublicoFestivalId</c> (historia,
/// sin clave foránea) es otro identificador y no se confunde con la tabla.
/// </summary>
public sealed class CandadoPerfilesPublicosFestivalTests
{
    private static readonly string[] Prohibidos =
        ["PerfilesPublicosFestival", "PerfilPublicoFestivalRow", "PerfilesPublicosDeFestival", "perfiles-publicos-festival"];

    [Fact]
    public void Ningun_Codigo_De_Produccion_Toca_La_Tabla_Del_Perfil_Publico_De_Festival()
    {
        var src = Path.Combine(RaizDelRepositorio(), "simus-api", "src");
        var infracciones = new List<string>();
        foreach (var archivo in Directory.EnumerateFiles(src, "*.cs", SearchOption.AllDirectories))
        {
            var relativa = Path.GetRelativePath(src, archivo);
            if (relativa.Split(Path.DirectorySeparatorChar).Any(p => p is "obj" or "bin")) continue;
            var lineas = File.ReadAllLines(archivo);
            for (var i = 0; i < lineas.Length; i++)
            {
                var linea = lineas[i].TrimStart();
                if (linea.StartsWith("//", StringComparison.Ordinal)) continue;
                var codigo = linea.Contains("//", StringComparison.Ordinal) && !linea.Contains('"')
                    ? linea[..linea.IndexOf("//", StringComparison.Ordinal)]
                    : linea;
                if (Prohibidos.Any(p => codigo.Contains(p, StringComparison.Ordinal)))
                    infracciones.Add($"{relativa}:{i + 1}: {linea.Trim()}");
            }
        }

        Assert.True(infracciones.Count == 0,
            "PerfilesPublicosFestival ya no existe y nada en simus-api/src la nombra (PR-8 del retiro):\n"
            + string.Join('\n', infracciones));
    }

    private static string RaizDelRepositorio()
    {
        var directorio = new DirectoryInfo(AppContext.BaseDirectory);
        while (directorio is not null && !Directory.Exists(Path.Combine(directorio.FullName, "simus-api", "src")))
            directorio = directorio.Parent;
        return directorio?.FullName ?? throw new DirectoryNotFoundException("No se encontró la raíz del repositorio.");
    }
}
