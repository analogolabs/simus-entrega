using System.Net;
using System.Net.Http.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// S-05. Las claves de la consola siguen la política de la cuenta externa, y cambiar la propia por el
/// perfil exige la actual.
/// </summary>
public sealed class AutenticacionDeLaConsolaTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Perfil = "/api/v1/admin/auth/profile";
    private const string MiContrasena = "/api/v1/admin/auth/mi-contrasena";
    private const string Usuarios = "/api/v1/admin/auth/users";
    private const string ClaveValida = "una-frase-de-paso-larga-1";

    private readonly TestWebApplicationFactory _factory;

    public AutenticacionDeLaConsolaTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static UpdateProfileRequest CuerpoDePerfil(string? nueva, string? actual) => new()
    {
        FullName = "Usuario Prueba",
        Email = CmsTestClient.WebmasterEmail,
        Password = nueva,
        PasswordActual = actual,
    };

    private static async Task<string> CuerpoAsync(HttpResponseMessage r) => await r.Content.ReadAsStringAsync();

    [Fact]
    public async Task El_perfil_no_cambia_la_clave_sin_la_actual()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PutAsJsonAsync(Perfil, CuerpoDePerfil(ClaveValida, null));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("passwordActual", await CuerpoAsync(respuesta), StringComparison.Ordinal);
        // La clave no cambió: la de siempre sigue entrando.
        var entra = await fabrica.CreateClient().PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CmsTestClient.WebmasterEmail, Password = CmsTestClient.WebmasterPassword });
        Assert.Equal(HttpStatusCode.OK, entra.StatusCode);
    }

    [Fact]
    public async Task El_perfil_no_cambia_la_clave_con_una_actual_equivocada()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PutAsJsonAsync(Perfil, CuerpoDePerfil(ClaveValida, "no-es-la-actual"));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("passwordActual", await CuerpoAsync(respuesta), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_perfil_aplica_la_politica_de_la_cuenta_externa_a_la_clave_nueva()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PutAsJsonAsync(Perfil, CuerpoDePerfil("1234567890", CmsTestClient.WebmasterPassword));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("al menos 12 caracteres", await CuerpoAsync(respuesta), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_perfil_cambia_la_clave_con_la_actual_y_una_clave_que_cumple()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PutAsJsonAsync(Perfil, CuerpoDePerfil(ClaveValida, CmsTestClient.WebmasterPassword));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var entra = await fabrica.CreateClient().PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CmsTestClient.WebmasterEmail, Password = ClaveValida });
        Assert.Equal(HttpStatusCode.OK, entra.StatusCode);
    }

    [Fact]
    public async Task El_perfil_sin_clave_nueva_no_pide_la_actual()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PutAsJsonAsync(Perfil, CuerpoDePerfil(null, null));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
    }

    [Theory]
    [InlineData("1234567890")]
    [InlineData("password1234")]
    [InlineData("aaaaaaaaaaaaaa")]
    [InlineData("corta-11-ch")]
    public async Task Mi_contrasena_rechaza_claves_que_la_politica_no_admite(string nueva)
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PostAsJsonAsync(MiContrasena,
            new CambioDeContrasenaPropia { Actual = CmsTestClient.WebmasterPassword, Nueva = nueva });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("nueva", await CuerpoAsync(respuesta), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Crear_una_cuenta_con_una_clave_de_diez_caracteres_se_rechaza()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PostAsJsonAsync(Usuarios, new AdminUserUpsertRequest
        {
            FullName = "Persona Nueva",
            Email = "nueva.persona@pnmc.local",
            Role = "gestor_interno",
            Password = "1234567890",
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("password", await CuerpoAsync(respuesta), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Crear_una_cuenta_con_una_clave_que_cumple_se_acepta()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PostAsJsonAsync(Usuarios, new AdminUserUpsertRequest
        {
            FullName = "Persona Nueva",
            Email = "nueva.persona@pnmc.local",
            Role = "gestor_interno",
            Password = ClaveValida,
        });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
    }

    [Fact]
    public async Task Cambiar_la_clave_de_otra_cuenta_con_una_clave_debil_se_rechaza()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica);

        var respuesta = await cliente.PostAsJsonAsync(Usuarios, new AdminUserUpsertRequest
        {
            Id = "2",
            FullName = "Gestor Interno Prueba",
            Email = "gestor@simus.test",
            Role = "gestor_interno",
            Password = "1234567890",
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("password", await CuerpoAsync(respuesta), StringComparison.Ordinal);
    }
}
