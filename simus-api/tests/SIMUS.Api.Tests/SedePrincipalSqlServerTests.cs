using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Runtime.CompilerServices;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La sede principal de todo proceso <b>contra SQL Server</b> (decisión 119): la migración
/// <c>V20261117_10</c> deja las columnas, la restricción de coherencia y la foránea al catálogo DIVIPOLA
/// en las cinco tablas, no toca el CHECK de cobertura y rellena la sede desde el territorio.
/// </summary>
/// <remarks>
/// SQLite no tiene los CHECK ni las foráneas del esquema real: por eso esto solo se mide en este carril.
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class SedePrincipalSqlServerTests
{
    private static readonly string[] Tablas = ["Festivales", "Mercados", "Talleres", "Espacios", "Redes"];

    private readonly SqlServerFixture _base;

    public SedePrincipalSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    private async Task<int> ContarAsync(string sql) =>
        Convert.ToInt32(await _base.EscalarAsync(sql), CultureInfo.InvariantCulture);

    private async Task TerritoriosAsync()
    {
        await _base.EscalarAsync("""
            IF NOT EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '05001')
                INSERT INTO dbo.Divipola (CodigoDepartamento, NombreDepartamento, CodigoMunicipio, NombreMunicipio) VALUES ('05', N'Antioquia', '05001', N'Medellín');
            IF NOT EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '76001')
                INSERT INTO dbo.Divipola (CodigoDepartamento, NombreDepartamento, CodigoMunicipio, NombreMunicipio) VALUES ('76', N'Valle del Cauca', '76001', N'Cali');
            IF NOT EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '11001')
                INSERT INTO dbo.Divipola (CodigoDepartamento, NombreDepartamento, CodigoMunicipio, NombreMunicipio) VALUES ('11', N'Bogotá, D. C.', '11001', N'Bogotá, D. C.');
            SELECT 1;
            """);
    }

    private async Task<int> PersonaAsync()
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var usuario = new UserRow { FullName = "Responsable de sede", Email = $"sede.{Guid.NewGuid():N}@correo.test", IsActive = true, CreatedAt = DateTime.UtcNow, PasswordHash = "x" };
        db.Users.Add(usuario);
        await db.SaveChangesAsync();
        return usuario.Id;
    }

    [HechoSqlServer]
    public async Task La_migracion_deja_las_columnas_la_coherencia_y_la_foranea_en_las_cinco_tablas()
    {
        foreach (var tabla in Tablas)
        {
            Assert.Equal(2, await ContarAsync(
                $"SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.{tabla}') AND name IN (N'SedeCodigoDepartamento', N'SedeCodigoMunicipio');"));
            Assert.Equal(1, await ContarAsync($"SELECT COUNT(*) FROM sys.check_constraints WHERE name = N'CK_{tabla}_SedeCoherente';"));
            Assert.Equal(1, await ContarAsync($"SELECT COUNT(*) FROM sys.foreign_keys WHERE name = N'FK_{tabla}_SedeDivipola';"));
            // La cobertura sigue teniendo su propio CHECK, sin tocar.
            Assert.Equal(1, await ContarAsync($"SELECT COUNT(*) FROM sys.check_constraints WHERE name = N'CK_{tabla}_NivelCobertura';"));
        }
    }

    [HechoSqlServer]
    public async Task Un_proceso_nacional_lleva_sede_y_la_base_rechaza_una_sede_incoherente()
    {
        await TerritoriosAsync();
        var persona = await PersonaAsync();
        const string Columnas = "NombreRed, TipoDeNodo, NivelCobertura, UsuarioResponsableId, SedeCodigoDepartamento, SedeCodigoMunicipio";

        // NACIONAL Y CON SEDE: la cobertura sigue sin territorio y la sede es otro dato.
        await _base.EscalarAsync(
            $"INSERT INTO dbo.Redes ({Columnas}) VALUES (N'Nacional con sede', N'red', N'nacional', {persona}, '76', '76001');");
        Assert.Equal(1, await ContarAsync(
            "SELECT COUNT(*) FROM dbo.Redes WHERE NombreRed = N'Nacional con sede' AND CodigoDepartamento IS NULL AND SedeCodigoMunicipio = '76001';"));

        // MUNICIPIO SIN DEPARTAMENTO, MUNICIPIO DE OTRO DEPARTAMENTO Y MUNICIPIO QUE NO EXISTE.
        await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"INSERT INTO dbo.Redes ({Columnas}) VALUES (N'Sin departamento', N'red', N'nacional', {persona}, NULL, '76001');"));
        await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"INSERT INTO dbo.Redes ({Columnas}) VALUES (N'Otro departamento', N'red', N'nacional', {persona}, '05', '76001');"));
        await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"INSERT INTO dbo.Redes ({Columnas}) VALUES (N'No existe', N'red', N'nacional', {persona}, '98', '98001');"));

        // SIN SEDE TAMBIÉN ENTRA: lo que ya existía queda «pendiente de completar» y se lee igual.
        await _base.EscalarAsync(
            $"INSERT INTO dbo.Redes (NombreRed, TipoDeNodo, NivelCobertura, UsuarioResponsableId) VALUES (N'Sin sede', N'red', N'nacional', {persona});");
    }

    [HechoSqlServer]
    public async Task El_relleno_de_la_migracion_toma_el_territorio_y_se_puede_repetir()
    {
        await TerritoriosAsync();
        var persona = await PersonaAsync();
        await _base.EscalarAsync($"""
            INSERT INTO dbo.Redes (NombreRed, TipoDeNodo, NivelCobertura, CodigoDepartamento, CodigoMunicipio, UsuarioResponsableId)
            VALUES (N'Relleno municipal', N'red', N'municipal', '05', '05001', {persona});
            INSERT INTO dbo.Redes (NombreRed, TipoDeNodo, NivelCobertura, CodigoDepartamento, UsuarioResponsableId)
            VALUES (N'Relleno departamental', N'red', N'departamental', '76', {persona});
            INSERT INTO dbo.Redes (NombreRed, TipoDeNodo, NivelCobertura, UsuarioResponsableId)
            VALUES (N'Relleno nacional', N'red', N'nacional', {persona});
            SELECT 1;
            """);

        for (var vez = 0; vez < 2; vez++)
        {
            await EjecutarRellenoDeRedesAsync();

            Assert.Equal(1, await ContarAsync(
                "SELECT COUNT(*) FROM dbo.Redes WHERE NombreRed = N'Relleno municipal' AND SedeCodigoDepartamento = '05' AND SedeCodigoMunicipio = '05001';"));
            // Departamental: el departamento y el municipio queda pendiente de completar.
            Assert.Equal(1, await ContarAsync(
                "SELECT COUNT(*) FROM dbo.Redes WHERE NombreRed = N'Relleno departamental' AND SedeCodigoDepartamento = '76' AND SedeCodigoMunicipio IS NULL;"));
            // Nacional: nada que inferir, pendiente.
            Assert.Equal(1, await ContarAsync(
                "SELECT COUNT(*) FROM dbo.Redes WHERE NombreRed = N'Relleno nacional' AND SedeCodigoDepartamento IS NULL;"));
        }
    }

    [SuppressMessage("Security", "CA2100", Justification = "SQL versionado del repositorio sobre una base desechable de pruebas.")]
    private async Task EjecutarRellenoDeRedesAsync([CallerFilePath] string origen = "")
    {
        var ruta = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(origen)!, "..", "..", "..", "simus-database", "schema", "V20261117_10__sede_principal_de_los_procesos.sql"));
        var lote = (await File.ReadAllTextAsync(ruta)).Split("\nGO", StringSplitOptions.RemoveEmptyEntries)
            .Single(parte => parte.Contains("UPDATE dbo.Redes", StringComparison.Ordinal));
        await _base.EscalarAsync(lote + "\nSELECT 1;");
    }
}
