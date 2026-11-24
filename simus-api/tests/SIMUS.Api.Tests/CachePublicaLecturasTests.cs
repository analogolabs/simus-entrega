using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La caché de las lecturas públicas (optimización, 20 nov 2026): guarda por ruta y por TODA la cadena de consulta,
/// y cualquier escritura del API que responda bien la vacía; una que falla, no.
/// </summary>
/// <remarks>
/// Se prueba con una aplicación mínima y no con el API entero: lo que importa es la pareja «política + middleware»,
/// que es lo que cada ruta pública adopta con `.CacheaLecturaPublica()`.
/// </remarks>
public sealed class CachePublicaLecturasTests
{
    private static async Task<(WebApplication App, HttpClient Cliente, Func<int> Lecturas)> ArrancarAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddOutputCache();
        var app = builder.Build();
        app.UseOutputCache();
        app.UseInvalidacionDeLecturasPublicas();
        var lecturas = 0;
        app.MapGet("/api/v1/publico/cosas", (string? q) => Results.Ok(new { n = ++lecturas, q })).CacheaLecturaPublica();
        app.MapPost("/api/v1/institucional/cosas", () => Results.Ok());
        app.MapPost("/api/v1/institucional/cosas-mal", () => Results.BadRequest());
        await app.StartAsync();
        return (app, app.GetTestClient(), () => lecturas);
    }

    [Fact]
    public async Task Una_lectura_repetida_sale_de_la_cache_y_cada_consulta_tiene_la_suya()
    {
        var (app, cliente, lecturas) = await ArrancarAsync();
        await using var _ = app;

        await cliente.GetAsync("/api/v1/publico/cosas?q=a");
        await cliente.GetAsync("/api/v1/publico/cosas?q=a");
        Assert.Equal(1, lecturas());

        // Otra cadena de consulta no puede recibir la respuesta de la primera.
        var otra = await cliente.GetStringAsync("/api/v1/publico/cosas?q=b");
        Assert.Equal(2, lecturas());
        Assert.Contains("\"q\":\"b\"", otra);
    }

    [Fact]
    public async Task Una_escritura_correcta_vacia_la_cache_y_una_fallida_no()
    {
        var (app, cliente, lecturas) = await ArrancarAsync();
        await using var _ = app;

        await cliente.GetAsync("/api/v1/publico/cosas");
        Assert.Equal(1, lecturas());

        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsync("/api/v1/institucional/cosas-mal", null)).StatusCode);
        await cliente.GetAsync("/api/v1/publico/cosas");
        Assert.Equal(1, lecturas());

        Assert.Equal(HttpStatusCode.OK, (await cliente.PostAsync("/api/v1/institucional/cosas", null)).StatusCode);
        await cliente.GetAsync("/api/v1/publico/cosas");
        Assert.Equal(2, lecturas());
    }

    [Fact]
    public void Lo_recordado_como_publico_deja_de_valer_con_una_escritura_y_no_se_anota_con_una_epoca_vieja()
    {
        var recordados = new CacheDeArchivosPublicos();
        Assert.False(recordados.EsPublico(7));

        recordados.AnotarPublico(7, recordados.Epoca);
        Assert.True(recordados.EsPublico(7));

        // Una escritura (retirar la noticia que lo hacía público) sube la época: hay que volver a comprobar.
        recordados.Invalidar();
        Assert.False(recordados.EsPublico(7));

        // Si la escritura ocurrió MIENTRAS se comprobaba, la anotación lleva la época vieja y nace invalidada.
        var alEmpezar = recordados.Epoca;
        recordados.Invalidar();
        recordados.AnotarPublico(8, alEmpezar);
        Assert.False(recordados.EsPublico(8));
    }

    [Fact]
    public async Task El_middleware_sube_la_epoca_de_los_archivos_publicos_solo_con_escrituras_correctas()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddOutputCache();
        builder.Services.AddSingleton<CacheDeArchivosPublicos>();
        await using var app = builder.Build();
        app.UseOutputCache();
        app.UseInvalidacionDeLecturasPublicas();
        app.MapPost("/api/v1/x", () => Results.Ok());
        app.MapPost("/api/v1/mal", () => Results.BadRequest());
        await app.StartAsync();
        var cliente = app.GetTestClient();
        var recordados = app.Services.GetRequiredService<CacheDeArchivosPublicos>();

        recordados.AnotarPublico(1, recordados.Epoca);
        await cliente.PostAsync("/api/v1/mal", null);
        Assert.True(recordados.EsPublico(1));
        await cliente.PostAsync("/api/v1/x", null);
        Assert.False(recordados.EsPublico(1));
    }
}
