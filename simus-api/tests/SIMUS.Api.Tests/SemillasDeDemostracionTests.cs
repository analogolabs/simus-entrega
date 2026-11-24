using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Las semillas de demostración siguen el esquema vigente.
/// </summary>
/// <remarks>
/// <para>
/// La semilla no la aplica la migración ni ninguna prueba con SQL Server, así que nada avisaba
/// cuando el esquema cambiaba: se quedó escribiendo en <c>FestivalesTerritoriosSonoros</c>,
/// <c>ProcedenciaDeRegistros</c> y en columnas retiradas de <c>Festivales</c>, y dejó de cargar.
/// </para>
/// <para>
/// Esta prueba lee cada <c>INSERT INTO dbo.Tabla (columnas)</c> y <c>DELETE FROM dbo.Tabla</c> del
/// guion y comprueba que la tabla y sus columnas existen en el modelo del API, el mismo que
/// <c>ParidadEsquemaSinArranqueTests</c> contrasta con los guiones de <c>schema/</c>.
/// </para>
/// </remarks>
public sealed partial class SemillasDeDemostracionTests
{
    [Theory]
    [InlineData("V20260912_01__demostracion_mapa_ecosistemico.sql")]
    [InlineData("V20261104_01__demostracion_noticias.sql")]
    [InlineData("V20261106_11__demostracion_completa.sql")]
    public async Task Las_tablas_y_columnas_que_escribe_existen_en_el_modelo(string semilla)
    {
        var guion = await File.ReadAllTextAsync(
            Path.Combine(RutasDelRepositorio.Raiz(), "simus-database", "seed", semilla));
        var columnasPorTabla = await ColumnasDelModeloAsync();
        var faltantes = new List<string>();

        foreach (Match insercion in InsercionConColumnas().Matches(guion))
        {
            var tabla = insercion.Groups["tabla"].Value;
            if (!columnasPorTabla.TryGetValue(tabla, out var columnas))
            {
                faltantes.Add($"tabla {tabla}");
                continue;
            }

            faltantes.AddRange(insercion.Groups["columnas"].Value
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(columna => !columnas.Contains(columna))
                .Select(columna => $"{tabla}.{columna}"));
        }

        foreach (Match borrado in Borrado().Matches(guion))
        {
            if (!columnasPorTabla.ContainsKey(borrado.Groups["tabla"].Value))
                faltantes.Add($"tabla {borrado.Groups["tabla"].Value}");
        }

        Assert.True(InsercionConColumnas().Matches(guion).Count >= 4, "La prueba no encontró las inserciones del guion.");
        Assert.True(faltantes.Count == 0, "La semilla usa nombres que no existen: " + string.Join(", ", faltantes.Distinct()));
    }

    /// <summary>
    /// La retirada de la demostración completa solo borra: que cada tabla que nombra exista,
    /// y que nombre todas las que la siembra completa escribe, o la siguiente pasada chocaría con
    /// una clave ajena.
    /// </summary>
    [Fact]
    public async Task La_retirada_de_la_demostracion_completa_cubre_lo_que_siembra()
    {
        var semillas = Path.Combine(RutasDelRepositorio.Raiz(), "simus-database", "seed");
        var retirada = await File.ReadAllTextAsync(Path.Combine(semillas, "V20261106_10__demostracion_completa_retiro.sql"));
        var siembra = await File.ReadAllTextAsync(Path.Combine(semillas, "V20261106_11__demostracion_completa.sql"));
        var columnasPorTabla = await ColumnasDelModeloAsync();

        var borradas = BorradoConAlias().Matches(retirada).Select(m => m.Groups["tabla"].Value)
            .Concat(Borrado().Matches(retirada).Select(m => m.Groups["tabla"].Value))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        // `PerfilesPublicosFestival` se retiró del modelo (PR-8); el guion de retirada la nombra solo dentro de un
        // `IF OBJECT_ID(...) IS NOT NULL` para seguir valiendo en una base anterior al retiro.
        Assert.All(borradas.Where(tabla => !string.Equals(tabla, "PerfilesPublicosFestival", StringComparison.OrdinalIgnoreCase)),
            tabla => Assert.True(columnasPorTabla.ContainsKey(tabla), $"tabla {tabla}"));

        var sinRetirar = InsercionConColumnas().Matches(siembra).Select(m => m.Groups["tabla"].Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(tabla => !borradas.Contains(tabla))
            .ToList();
        Assert.True(sinRetirar.Count == 0, "La siembra completa escribe en tablas que su retirada no borra: " + string.Join(", ", sinRetirar));
    }

    [Fact]
    public async Task El_lanzador_pasa_el_guion_como_fichero_y_no_por_la_entrada_estandar()
    {
        // Desde la conexión vive en un solo sitio, que usan la siembra y la reconstrucción.
        var lanzador = await File.ReadAllTextAsync(
            Path.Combine(RutasDelRepositorio.Raiz(), "scripts", "local", "sql-local-comun.sh"));

        // Por la entrada estándar el sqlcmd de mssql-tools recibía el guion mutilado.
        Assert.DoesNotMatch(@"sqlcmd[^\n]*<\s*""\$", lanzador);
        Assert.Contains("-i /tmp/semilla-demo.sql", lanzador, StringComparison.Ordinal);
    }

    private static async Task<Dictionary<string, HashSet<string>>> ColumnasDelModeloAsync()
    {
        await using var factory = new TestWebApplicationFactory();
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var resultado = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);

        foreach (var entidad in db.Model.GetEntityTypes())
        {
            var tabla = entidad.GetTableName();
            if (tabla is null) continue;
            var identificador = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(tabla, entidad.GetSchema());
            if (!resultado.TryGetValue(tabla, out var columnas))
                resultado[tabla] = columnas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var propiedad in entidad.GetProperties())
            {
                var columna = propiedad.GetColumnName(identificador);
                if (columna is not null) columnas.Add(columna);
            }
        }

        return resultado;
    }

    [Fact]
    public async Task Cada_semilla_de_demostracion_esta_en_el_guion_que_las_aplica()
    {
        var raiz = RutasDelRepositorio.Raiz();
        var guion = await File.ReadAllTextAsync(Path.Combine(raiz, "scripts", "demo", "sembrar-demo.sh"));

        foreach (var semilla in Directory.GetFiles(Path.Combine(raiz, "simus-database", "seed"), "*__demostracion_*.sql"))
            Assert.Contains(Path.GetFileName(semilla), guion, StringComparison.Ordinal);
    }

    [GeneratedRegex(@"INSERT\s+INTO\s+dbo\.(?<tabla>\w+)\s*\((?<columnas>[^)]*)\)", RegexOptions.IgnoreCase)]
    private static partial Regex InsercionConColumnas();

    [GeneratedRegex(@"DELETE\s+FROM\s+dbo\.(?<tabla>\w+)", RegexOptions.IgnoreCase)]
    private static partial Regex Borrado();

    [GeneratedRegex(@"DELETE\s+\w+\s+FROM\s+dbo\.(?<tabla>\w+)", RegexOptions.IgnoreCase)]
    private static partial Regex BorradoConAlias();
}
