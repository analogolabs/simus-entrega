using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// <c>Database:BootstrapExigirCambioDeClave</c>: en una instalación nueva el webmaster y el gestor de
/// arranque inician con «admin» y el primer ingreso exige cambiar la clave.
/// </summary>
public sealed class CuentasDeArranqueCambioDeClaveTests
{
    private const string ClaveInicial = "admin";
    private const string ClaveNueva = "FraseDePasoNueva-2026";

    private static async Task<JsonElement> YoAsync(HttpClient sesion) =>
        (await sesion.GetFromJsonAsync<JsonElement>("/api/v1/admin/auth/me")).GetProperty("user");

    [Fact]
    public async Task Con_la_opcion_encendida_el_primer_ingreso_exige_cambiar_la_clave_y_luego_no_la_vuelve_a_pedir()
    {
        const string correo = "webmaster@simus.test";
        await using var factory = new TestWebApplicationFactory { ExigirCambioDeClaveDeArranque = true };

        var sesion = await CmsTestClient.LoginAsync(factory, correo, ClaveInicial);
        Assert.True((await YoAsync(sesion)).GetProperty("debeCambiarContrasena").GetBoolean());

        // La política exige >= 12 caracteres: «admin» no se puede reutilizar ni acortar la nueva.
        var corta = await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-contrasena",
            new CambioDeContrasenaPropia { Actual = ClaveInicial, Nueva = ClaveInicial });
        Assert.Equal(HttpStatusCode.BadRequest, corta.StatusCode);
        Assert.Contains("12 caracteres", await corta.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var cambio = await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-contrasena",
            new CambioDeContrasenaPropia { Actual = ClaveInicial, Nueva = ClaveNueva });
        cambio.EnsureSuccessStatusCode();

        // Ingreso normal con la clave nueva; ya no lo pide. La clave inicial dejó de servir.
        var nueva = await CmsTestClient.LoginAsync(factory, correo, ClaveNueva);
        Assert.False((await YoAsync(nueva)).GetProperty("debeCambiarContrasena").GetBoolean());

        var vieja = await factory.CreateClient().PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = correo, Password = ClaveInicial });
        Assert.False(vieja.IsSuccessStatusCode);
    }

    [Fact]
    public async Task Con_la_opcion_encendida_una_cuenta_que_ya_existia_no_se_vuelve_a_marcar()
    {
        // El arnés ya trae a gestor@simus.test (clave «pnmc-gestor») antes del arranque: no es una
        // cuenta nueva, así que la opción no le exige el cambio ni le repone la clave por defecto.
        await using var factory = new TestWebApplicationFactory { ExigirCambioDeClaveDeArranque = true };

        var sesion = await CmsTestClient.LoginAsync(factory, "gestor@simus.test", "pnmc-gestor");

        Assert.False((await YoAsync(sesion)).GetProperty("debeCambiarContrasena").GetBoolean());
    }

    [Fact]
    public async Task Por_omision_las_cuentas_de_arranque_no_exigen_cambio()
    {
        await using var factory = new TestWebApplicationFactory();

        var sesion = await CmsTestClient.LoginAsync(factory, "webmaster@simus.test", ClaveInicial);

        Assert.False((await YoAsync(sesion)).GetProperty("debeCambiarContrasena").GetBoolean());
    }
}
