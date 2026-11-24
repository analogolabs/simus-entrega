using System.Net;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Cabeceras de seguridad de toda respuesta (hallazgo S-04). Una prueba por cabecera: si una se
/// pierde, la que falla dice cuál.
/// </summary>
public sealed class CabecerasDeSeguridadTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _cliente;

    public CabecerasDeSeguridadTests(TestWebApplicationFactory factory)
    {
        _cliente = factory.CreateClient();
    }

    private async Task<string> CabeceraAsync(string nombre, string ruta = "/health/live")
    {
        var respuesta = await _cliente.GetAsync(ruta);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.True(respuesta.Headers.TryGetValues(nombre, out var valores), $"Falta la cabecera {nombre}");
        return Assert.Single(valores);
    }

    [Fact]
    public async Task X_Frame_Options_es_SAMEORIGIN_para_que_el_panel_enmarque_sus_vistas_previas()
        => Assert.Equal("SAMEORIGIN", await CabeceraAsync("X-Frame-Options"));

    [Fact]
    public async Task La_politica_de_contenido_sale_solo_en_modo_observacion()
    {
        var respuesta = await _cliente.GetAsync("/health/live");
        Assert.False(respuesta.Headers.Contains("Content-Security-Policy"),
            "La CSP bloqueante no se activa en este cambio: primero se mide en Report-Only.");
        Assert.True(respuesta.Headers.Contains("Content-Security-Policy-Report-Only"));
    }

    [Theory]
    [InlineData("default-src 'self'")]
    [InlineData("script-src 'self'")]
    [InlineData("frame-ancestors 'self'")]
    [InlineData("object-src 'none'")]
    [InlineData("base-uri 'self'")]
    [InlineData("form-action 'self'")]
    [InlineData("worker-src 'self' blob:")]
    [InlineData("frame-src https://www.youtube-nocookie.com")]
    public async Task La_politica_de_contenido_lleva_la_directiva(string directiva)
        => Assert.Contains(directiva, await CabeceraAsync("Content-Security-Policy-Report-Only"));

    [Fact]
    public async Task Cross_Origin_Opener_Policy_es_same_origin()
        => Assert.Equal("same-origin", await CabeceraAsync("Cross-Origin-Opener-Policy"));

    [Fact]
    public async Task Cross_Origin_Resource_Policy_es_same_origin_fuera_de_los_archivos_publicos()
        => Assert.Equal("same-origin", await CabeceraAsync("Cross-Origin-Resource-Policy"));

    [Fact]
    public async Task X_Content_Type_Options_es_nosniff()
        => Assert.Equal("nosniff", await CabeceraAsync("X-Content-Type-Options"));

    [Fact]
    public async Task Referrer_Policy_es_strict_origin_when_cross_origin()
        => Assert.Equal("strict-origin-when-cross-origin", await CabeceraAsync("Referrer-Policy"));

    [Fact]
    public async Task Permissions_Policy_cierra_geolocalizacion_microfono_y_camara()
        => Assert.Equal("geolocation=(), microphone=(), camera=()", await CabeceraAsync("Permissions-Policy"));

    [Fact]
    public async Task Las_respuestas_del_API_tambien_llevan_las_cabeceras()
    {
        var respuesta = await _cliente.GetAsync("/api/v1/ruta-que-no-existe");
        Assert.Equal(HttpStatusCode.NotFound, respuesta.StatusCode);
        Assert.Equal("SAMEORIGIN", Assert.Single(respuesta.Headers.GetValues("X-Frame-Options")));
        Assert.True(respuesta.Headers.Contains("Content-Security-Policy-Report-Only"));
    }
}
