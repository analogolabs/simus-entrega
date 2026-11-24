using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using SIMUS.Api.Security;
using SIMUS.Infrastructure.Common;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// auditoría de seguridad, las piezas pequeñas: S-13 sin caché en lo que lleva sesión, S-16 igualar el tiempo
/// del ingreso sin cuenta y S-17 identificador de correlación validado. El bloqueo por cuenta (S-07) y la vida de la sesión (S-11)
/// tienen sus propios archivos; el retiro de <c>/participaciones</c> (S-09) lo vigila el barrido de rutas anónimas.
/// </summary>
public sealed class SeguridadLoteDTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public SeguridadLoteDTests(TestWebApplicationFactory factory) => _factory = factory;

    // ---------- S-17 -------------------------------------------------------------

    [Theory]
    [InlineData("abc-123-DEF", true)]
    [InlineData("0123456789abcdef0123456789abcdef", true)]
    [InlineData("", false)]
    [InlineData("con espacio", false)]
    [InlineData("con\r\nsalto", false)]
    [InlineData("<script>", false)]
    [InlineData("a_b", false)]
    public void Solo_se_admite_un_identificador_razonable(string valor, bool admisible)
    {
        Assert.Equal(admisible, RequestContextMiddleware.EsUnIdentificadorAdmisible(valor));
    }

    [Fact]
    public void Mas_de_sesenta_y_cuatro_caracteres_no_se_admite()
    {
        Assert.True(RequestContextMiddleware.EsUnIdentificadorAdmisible(new string('a', 64)));
        Assert.False(RequestContextMiddleware.EsUnIdentificadorAdmisible(new string('a', 65)));
    }

    [Fact]
    public async Task Un_identificador_valido_se_devuelve_y_uno_invalido_se_reemplaza()
    {
        var cliente = _factory.CreateClient();

        using var bueno = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        bueno.Headers.Add("X-Correlation-ID", "prueba-123");
        var conBueno = await cliente.SendAsync(bueno);
        Assert.Equal("prueba-123", conBueno.Headers.GetValues("X-Correlation-ID").Single());

        using var malo = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        malo.Headers.TryAddWithoutValidation("X-Correlation-ID", "con espacio <y> símbolos");
        var conMalo = await cliente.SendAsync(malo);
        var devuelto = conMalo.Headers.GetValues("X-Correlation-ID").Single();
        Assert.NotEqual("con espacio <y> símbolos", devuelto);
        Assert.True(RequestContextMiddleware.EsUnIdentificadorAdmisible(devuelto));

        using var largo = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        largo.Headers.Add("X-Correlation-ID", new string('x', 500));
        var conLargo = await cliente.SendAsync(largo);
        Assert.True(conLargo.Headers.GetValues("X-Correlation-ID").Single().Length <= 64);
    }

    // ---------- S-13 -------------------------------------------------------------

    [Theory]
    [InlineData("/api/v1/admin/contenido-web/csrf")]
    [InlineData("/api/v1/admin/auth/users")]
    public async Task Lo_que_lleva_sesion_de_consola_no_se_guarda_en_cache(string ruta)
    {
        var cliente = await CmsTestClient.LoginAsync(_factory);

        var respuesta = await cliente.GetAsync(ruta);

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Contains("no-store", respuesta.Headers.CacheControl?.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Lo_que_lleva_sesion_del_portal_no_se_guarda_en_cache_ni_siquiera_el_rechazo()
    {
        var respuesta = await _factory.CreateClient().GetAsync("/api/v1/externo/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        Assert.Contains("no-store", respuesta.Headers.CacheControl?.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Una_ruta_que_fija_su_propia_cache_la_conserva_y_lo_publico_no_se_toca()
    {
        var cliente = _factory.CreateClient();

        var textos = await cliente.GetAsync("/api/v1/contenido-web");
        var festivales = await cliente.GetAsync("/api/v1/publico/festivales?limit=1&offset=0");

        Assert.Equal("no-cache", textos.Headers.CacheControl?.ToString());
        Assert.DoesNotContain("no-store", festivales.Headers.CacheControl?.ToString() ?? string.Empty, StringComparison.Ordinal);
    }

    // ---------- S-16 -------------------------------------------------------------

    [Fact]
    public void La_verificacion_simulada_gasta_el_tiempo_de_un_hash_real()
    {
        VerificacionSimulada.Gastar("calienta"); // la primera vez calcula el hash ficticio
        var reloj = Stopwatch.StartNew();
        VerificacionSimulada.Gastar("otra");
        reloj.Stop();

        // PBKDF2 de Identity son decenas de milisegundos; una verificación que no hiciera nada tardaría microsegundos.
        Assert.True(reloj.ElapsedMilliseconds >= 3, $"La verificación simulada tardó {reloj.ElapsedMilliseconds} ms: no parece hacer el hash.");
    }

    [Fact]
    public async Task El_ingreso_sin_cuenta_responde_lo_mismo_que_con_clave_equivocada()
    {
        var cliente = _factory.CreateClient();

        var sinCuenta = await cliente.PostAsJsonAsync("/api/v1/admin/auth/login",
            new { email = $"nadie.{Guid.NewGuid():N}@pnmc.local", password = "cualquiera" });
        var claveMala = await cliente.PostAsJsonAsync("/api/v1/admin/auth/login",
            new { email = CmsTestClient.WebmasterEmail, password = "equivocada" });

        Assert.Equal(HttpStatusCode.Unauthorized, sinCuenta.StatusCode);
        Assert.Equal(claveMala.StatusCode, sinCuenta.StatusCode);
        Assert.Equal(await claveMala.Content.ReadAsStringAsync(), await sinCuenta.Content.ReadAsStringAsync());
    }
}
