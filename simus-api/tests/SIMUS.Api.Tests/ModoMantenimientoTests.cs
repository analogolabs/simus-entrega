using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Modo mantenimiento: apagado no cambia nada; encendido da 503 con Retry-After a las rutas del API,
/// y dejan pasar las sondas, el front y la consola de quien administra.
/// </summary>
public sealed class ModoMantenimientoTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _fabrica;

    public ModoMantenimientoTests(TestWebApplicationFactory fabrica) => _fabrica = fabrica;

    private HttpClient ClienteEnMantenimiento(string? mensaje = null, string? hasta = null)
        => _fabrica.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["Mantenimiento:Activo"] = "true",
                ["Mantenimiento:Mensaje"] = mensaje,
                ["Mantenimiento:HastaAprox"] = hasta,
            }))).CreateClient();

    [Fact]
    public async Task Apagado_por_omision_no_cambia_nada()
    {
        var cliente = _fabrica.CreateClient();
        var respuesta = await cliente.GetAsync("/api/v1/csrf");
        Assert.NotEqual(HttpStatusCode.ServiceUnavailable, respuesta.StatusCode);
        Assert.False(respuesta.Headers.Contains("X-Mantenimiento"));
        Assert.Equal(HttpStatusCode.OK, (await cliente.GetAsync("/health/live")).StatusCode);
    }

    [Fact]
    public async Task Encendido_responde_503_con_Retry_After_y_la_marca()
    {
        var cliente = ClienteEnMantenimiento("Volvemos pronto.");
        var respuesta = await cliente.GetAsync("/api/v1/contenido-web");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, respuesta.StatusCode);
        Assert.Equal("300", Assert.Single(respuesta.Headers.GetValues("Retry-After")));
        Assert.Equal("1", Assert.Single(respuesta.Headers.GetValues("X-Mantenimiento")));
        // La respuesta conserva las cabeceras de seguridad.
        Assert.True(respuesta.Headers.Contains("X-Content-Type-Options"));

        using var json = JsonDocument.Parse(await respuesta.Content.ReadAsStringAsync());
        Assert.Equal("mantenimiento", json.RootElement.GetProperty("codigo").GetString());
        Assert.Equal("Volvemos pronto.", json.RootElement.GetProperty("mensaje").GetString());
    }

    [Fact]
    public async Task Encendido_tambien_cubre_las_escrituras_y_las_rutas_publicas_con_sesion()
    {
        var cliente = ClienteEnMantenimiento();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await cliente.PostAsync("/api/v1/externo/auth/login", new StringContent("{}"))).StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await cliente.GetAsync("/api/v1/institucional/noticias")).StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await cliente.GetAsync("/api/v1/ruta-que-no-existe")).StatusCode);
    }

    [Fact]
    public async Task La_hora_estimada_ajusta_Retry_After_y_se_devuelve()
    {
        var hasta = DateTimeOffset.UtcNow.AddMinutes(10);
        var cliente = ClienteEnMantenimiento(hasta: hasta.ToString("O"));
        var respuesta = await cliente.GetAsync("/api/v1/contenido-web");

        var espera = int.Parse(Assert.Single(respuesta.Headers.GetValues("Retry-After")));
        Assert.InRange(espera, 500, 600);
        using var json = JsonDocument.Parse(await respuesta.Content.ReadAsStringAsync());
        Assert.NotEqual(JsonValueKind.Null, json.RootElement.GetProperty("hastaAprox").ValueKind);
    }

    [Fact]
    public async Task Un_mensaje_largo_se_recorta()
    {
        var cliente = ClienteEnMantenimiento(new string('a', 900));
        var respuesta = await cliente.GetAsync("/api/v1/contenido-web");
        using var json = JsonDocument.Parse(await respuesta.Content.ReadAsStringAsync());
        Assert.Equal(300, json.RootElement.GetProperty("mensaje").GetString()!.Length);
    }

    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")]
    public async Task La_salud_pasa_en_mantenimiento(string ruta)
    {
        var respuesta = await ClienteEnMantenimiento().GetAsync(ruta);
        Assert.False(respuesta.Headers.Contains("X-Mantenimiento"));
    }

    [Theory]
    [InlineData("/api/v1/admin/auth/me")]
    [InlineData("/api/v1/csrf")]
    public async Task La_consola_de_quien_administra_pasa_a_su_propia_autorizacion(string ruta)
    {
        // Sin sesión devuelve 401 (su política de siempre), nunca el 503 de mantenimiento.
        var respuesta = await ClienteEnMantenimiento().GetAsync(ruta);
        Assert.False(respuesta.Headers.Contains("X-Mantenimiento"), $"{ruta} no debe responder mantenimiento");
        Assert.NotEqual(HttpStatusCode.ServiceUnavailable, respuesta.StatusCode);
    }

    [Theory]
    [InlineData("/api/v1/contenido-web", true)]
    [InlineData("/API/v1/externo/x", true)]
    [InlineData("/api/v1/admin/x", false)]
    [InlineData("/api/v1/administracion-falsa", true)]
    [InlineData("/api/v1/csrf", false)]
    [InlineData("/health/live", false)]
    [InlineData("/mantenimiento", false)]
    [InlineData("/", false)]
    public void Que_rutas_se_cubren(string ruta, bool cubierta)
        => Assert.Equal(cubierta, SIMUS.Api.Mantenimiento.ModoMantenimientoMiddleware.EsRutaDelApiEnMantenimiento(ruta));
}
