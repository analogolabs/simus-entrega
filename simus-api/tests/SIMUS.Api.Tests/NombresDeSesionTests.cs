using System.Net;
using System.Net.Http.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Renombrado PNMC→SIMUS: las cookies de sesión llevan el nombre del sistema y las
/// antiguas ya no valen.
/// </summary>
/// <remarks>
/// No hay alias de compatibilidad: quien tenía una sesión abierta con <c>pnmc.admin</c> o
/// <c>pnmc.external</c> la pierde y vuelve a ingresar. Estas pruebas fijan las dos mitades de esa
/// decisión: lo nuevo se emite, y lo viejo no autentica.
/// </remarks>
public sealed class NombresDeSesionTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public NombresDeSesionTests(TestWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task El_ingreso_institucional_emite_la_cookie_simus_admin_y_ninguna_pnmc()
    {
        var cliente = _factory.CreateClient();

        var acceso = await cliente.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" });

        Assert.Equal(HttpStatusCode.OK, acceso.StatusCode);
        var cookies = acceso.Headers.GetValues("Set-Cookie").ToArray();
        Assert.Contains(cookies, c => c.StartsWith("simus.admin=", StringComparison.Ordinal));
        Assert.DoesNotContain(cookies, c => c.StartsWith("pnmc.", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task El_testigo_antiforgery_de_la_consola_viaja_en_la_cookie_simus()
    {
        var cliente = _factory.CreateClient();

        var respuesta = await cliente.GetAsync("/api/v1/externo/auth/csrf");

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var cookies = respuesta.Headers.GetValues("Set-Cookie").ToArray();
        Assert.Contains(cookies, c => c.StartsWith("simus.external.csrf=", StringComparison.Ordinal));
        Assert.DoesNotContain(cookies, c => c.StartsWith("pnmc.", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Una_cookie_pnmc_admin_ya_no_abre_sesion()
    {
        // Se obtiene un valor de cookie válido y se reenvía con el nombre antiguo: si el servidor
        // siguiera aceptando "pnmc.admin" sería un alias, y la decisión fue no tenerlo.
        var emisor = _factory.CreateClient();
        var acceso = await emisor.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" });
        var valor = acceso.Headers.GetValues("Set-Cookie")
            .First(c => c.StartsWith("simus.admin=", StringComparison.Ordinal))
            .Split(';')[0]["simus.admin=".Length..];

        var anonimo = _factory.CreateClient(new() { HandleCookies = false });
        var peticion = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/auth/me");
        peticion.Headers.Add("Cookie", $"pnmc.admin={valor}");
        var conNombreViejo = await anonimo.SendAsync(peticion);

        Assert.Equal(HttpStatusCode.Unauthorized, conNombreViejo.StatusCode);

        // Control: el mismo valor con el nombre nuevo sí autentica, así la prueba no pasa por un
        // valor roto.
        var control = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/auth/me");
        control.Headers.Add("Cookie", $"simus.admin={valor}");
        Assert.Equal(HttpStatusCode.OK, (await anonimo.SendAsync(control)).StatusCode);
    }
}
