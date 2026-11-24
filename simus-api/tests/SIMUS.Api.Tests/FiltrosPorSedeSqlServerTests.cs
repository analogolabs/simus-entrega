using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El filtro por sede y el conteo de sedes pendientes <b>contra SQL Server</b> (decisión 124):
/// <c>SedePrincipal.FiltrarPorSede</c> usa <c>EF.Property</c> sobre las columnas de la sede y el conteo de
/// pendientes mira «nulo o vacío» en columnas <c>char(2)</c> y <c>char(5)</c>; SQLite no las trata igual.
/// </summary>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class FiltrosPorSedeSqlServerTests
{
    private readonly SqlServerFixture _base;

    public FiltrosPorSedeSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    private async Task<int> PersonaAsync()
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var usuario = new UserRow { FullName = "Responsable del filtro", Email = $"filtro.{Guid.NewGuid():N}@correo.test", IsActive = true, CreatedAt = DateTime.UtcNow, PasswordHash = "x" };
        db.Users.Add(usuario);
        await db.SaveChangesAsync();
        return usuario.Id;
    }

    [HechoSqlServer]
    public async Task El_filtro_por_sede_y_el_conteo_de_pendientes_se_traducen_en_SQL_Server()
    {
        await _base.EscalarAsync("""
            IF NOT EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '05001')
                INSERT INTO dbo.Divipola (CodigoDepartamento, NombreDepartamento, CodigoMunicipio, NombreMunicipio) VALUES ('05', N'Antioquia', '05001', N'Medellín');
            IF NOT EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '76001')
                INSERT INTO dbo.Divipola (CodigoDepartamento, NombreDepartamento, CodigoMunicipio, NombreMunicipio) VALUES ('76', N'Valle del Cauca', '76001', N'Cali');
            SELECT 1;
            """);
        var persona = await PersonaAsync();
        var sufijo = Guid.NewGuid().ToString("N")[..8];
        await _base.EscalarAsync($"""
            INSERT INTO dbo.Redes (NombreRed, TipoDeNodo, NivelCobertura, UsuarioResponsableId, SedeCodigoDepartamento, SedeCodigoMunicipio)
            VALUES (N'Red Medellín {sufijo}', N'red', N'nacional', {persona}, '05', '05001');
            INSERT INTO dbo.Redes (NombreRed, TipoDeNodo, NivelCobertura, UsuarioResponsableId, SedeCodigoDepartamento, SedeCodigoMunicipio)
            VALUES (N'Red Cali {sufijo}', N'red', N'nacional', {persona}, '76', '76001');
            INSERT INTO dbo.Redes (NombreRed, TipoDeNodo, NivelCobertura, UsuarioResponsableId)
            VALUES (N'Red pendiente {sufijo}', N'red', N'nacional', {persona});
            SELECT 1;
            """);

        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        async Task<List<string>> NombresAsync(string? departamento, string? municipio, bool pendiente) =>
            await SedePrincipal.FiltrarPorSede(db.Redes.AsNoTracking().Where(r => r.Nombre.EndsWith(sufijo)), departamento, municipio, pendiente)
                .Select(r => r.Nombre).ToListAsync();

        Assert.Equal([$"Red Medellín {sufijo}"], await NombresAsync("05", null, false));
        Assert.Equal([$"Red Cali {sufijo}"], await NombresAsync("76", "76001", false));
        Assert.Empty(await NombresAsync("76", "05001", false));
        Assert.Equal([$"Red pendiente {sufijo}"], await NombresAsync(null, null, true));
        Assert.Equal(3, (await NombresAsync(null, null, false)).Count);

        var pendientes = await SedePrincipal.ContarPendientesAsync(db, default);
        Assert.True(pendientes.Single(p => p.Tipo == "redes").Total >= 1);
        Assert.All(pendientes, p => Assert.True(p.Total >= 0, p.Tipo.ToString(CultureInfo.InvariantCulture)));
    }
}
