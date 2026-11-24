using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La cuenta técnica del sistema no se edita, desactiva ni elimina desde la consola.
/// </summary>
/// <remarks>
/// <c>sistema@pnmc.local</c> es la cuenta a la que se atribuyen las acciones automáticas. La crea la
/// semilla de administración con un rol webmaster y sin contraseña utilizable, y en «Usuarios»
/// aparecía como un webmaster más, editable y desactivable. La vía de SQLite no ejecuta esa semilla,
/// así que aquí se crea a mano con la misma forma.
/// </remarks>
public sealed class CuentaDelSistemaProtegidaTests
{
    [Fact]
    public async Task La_cuenta_del_sistema_se_lista_marcada_y_no_se_toca()
    {
        await using var factory = new TestWebApplicationFactory();
        var id = await CuentaDelSistemaAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        var lista = await webmaster.GetFromJsonAsync<JsonElement>("/api/v1/admin/auth/users");
        var suya = lista.EnumerateArray().Single(x => x.GetProperty("email").GetString() == "sistema@pnmc.local");
        Assert.True(suya.GetProperty("esCuentaDelSistema").GetBoolean());
        var otra = lista.EnumerateArray().First(x => x.GetProperty("email").GetString() == "webmaster@simus.test");
        Assert.False(otra.GetProperty("esCuentaDelSistema").GetBoolean());

        var editar = await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            Id = id.ToString(CultureInfo.InvariantCulture),
            FullName = "Sistema renombrado",
            Email = "sistema@pnmc.local",
            Roles = ["webmaster"],
            IsActive = false,
        });
        Assert.Equal(HttpStatusCode.Conflict, editar.StatusCode);

        Assert.Equal(HttpStatusCode.Conflict, (await webmaster.DeleteAsync($"/api/v1/admin/auth/users/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await webmaster.DeleteAsync($"/api/v1/admin/auth/users/{id}/definitiva")).StatusCode);

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var fila = db.Users.Single(x => x.Id == id);
        Assert.True(fila.IsActive);
        Assert.Equal("Sistema PNMC", fila.FullName);
    }

    private static async Task<int> CuentaDelSistemaAsync(TestWebApplicationFactory factory)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        // En el carril de SQL Server la semilla ya la creó: se usa esa.
        var existente = db.Users.FirstOrDefault(x => x.Email == "sistema@pnmc.local");
        if (existente is not null)
        {
            existente.FullName = "Sistema PNMC";
            existente.IsActive = true;
            await db.SaveChangesAsync();
            return existente.Id;
        }

        var ahora = DateTime.UtcNow;
        var cuenta = new UserRow
        {
            FullName = "Sistema PNMC",
            Email = "sistema@pnmc.local",
            AccessChannel = "interno",
            IsActive = true,
            PasswordHash = "pendiente_configurar_hash_seguro",
            CreatedAt = ahora,
            UpdatedAt = ahora,
        };
        db.Users.Add(cuenta);
        await db.SaveChangesAsync();
        await RolesEnPruebas.AsignarAsync(db, cuenta.Id, "webmaster");
        return cuenta.Id;
    }
}
