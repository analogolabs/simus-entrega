using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La foto de un taller de lutería (LUT-02, decisión 115): entra por el Banco de archivos, es de quien
/// responde por el taller, y solo es pública mientras el taller está publicado.
/// </summary>
public sealed class TalleresConFotoTests
{
    private static byte[] PngDeUnPixel() => Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent Formulario(string alt = "Fachada del taller")
    {
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(PngDeUnPixel());
        parte.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        contenido.Add(parte, "file", "taller.png");
        contenido.Add(new StringContent(alt), "alt");
        return contenido;
    }

    private static async Task<int> SubirComoLutierAsync(HttpClient cliente)
    {
        var respuesta = await TestigoDelCanalExterno.PostAsync(cliente, "/api/v1/externo/mis-talleres/foto", Formulario());
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<ArchivoSubido>())!.Id;
    }

    private sealed record ArchivoSubido(int Id, string Url);

    private static async Task<HttpStatusCode> PedirFotoAsync(HttpClient cliente, int id) =>
        (await cliente.GetAsync($"/api/v1/publico/archivos/{id}")).StatusCode;

    [Fact]
    public async Task La_foto_de_un_taller_solo_es_publica_mientras_el_taller_esta_publicado()
    {
        await using var factory = new TestWebApplicationFactory();
        var (lutier, csrf, _) = await TalleresDeLuteriaTests.LutierAsync(factory);
        var (servicios, familias) = await TalleresDeLuteriaTests.CatalogosAsync(factory);
        var anonimo = factory.CreateClient();
        var foto = await SubirComoLutierAsync(lutier);

        var cuerpo = TalleresDeLuteriaTests.UnTallerCompleto(servicios, familias);
        cuerpo.ArchivoFotoId = foto;
        var taller = await TalleresDeLuteriaTests.CrearComoPersonaAsync(lutier, csrf, cuerpo);

        Assert.Equal(foto, taller.ArchivoFotoId);
        Assert.Equal($"/api/v1/publico/archivos/{foto}", taller.FotoUrl);
        Assert.Equal("Fachada del taller", taller.FotoAlt);

        // En borrador la ve quien responde y no la ve el público.
        Assert.Equal(HttpStatusCode.OK, await PedirFotoAsync(lutier, foto));
        Assert.Equal(HttpStatusCode.NotFound, await PedirFotoAsync(anonimo, foto));

        await TalleresDeLuteriaTests.EnviarARevisionAsync(lutier, csrf, taller.Id);
        Assert.Equal(HttpStatusCode.NotFound, await PedirFotoAsync(anonimo, foto));

        var consola = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.OK, (await TalleresDeLuteriaTests.DecidirAsync(consola, taller.Id, "publicar")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, await PedirFotoAsync(anonimo, foto));
        var publico = await anonimo.GetFromJsonAsync<TallerPublicoDto>($"/api/v1/publico/talleres/{taller.Id}");
        Assert.Equal($"/api/v1/publico/archivos/{foto}", publico!.FotoUrl);
        Assert.Equal("Fachada del taller", publico.FotoAlt);

        // Al retirarlo deja de servirse al público; la persona sigue viéndola.
        var retiro = await TalleresDeLuteriaTests.EnviarAsync(lutier, csrf, HttpMethod.Post,
            $"/api/v1/externo/talleres/{taller.Id}/retirar", new RetiroDeTaller { Motivo = "Cierro por viaje" });
        Assert.Equal(HttpStatusCode.OK, retiro.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, await PedirFotoAsync(anonimo, foto));
        Assert.Equal(HttpStatusCode.OK, await PedirFotoAsync(lutier, foto));
    }

    [Fact]
    public async Task Una_foto_ajena_no_se_puede_apuntar_desde_un_taller()
    {
        await using var factory = new TestWebApplicationFactory();
        var (duena, _, _) = await TalleresDeLuteriaTests.LutierAsync(factory, "Marta");
        var (otra, csrfOtra, _) = await TalleresDeLuteriaTests.LutierAsync(factory, "Elena");
        var (servicios, familias) = await TalleresDeLuteriaTests.CatalogosAsync(factory);
        var fotoAjena = await SubirComoLutierAsync(duena);

        var cuerpo = TalleresDeLuteriaTests.UnTallerCompleto(servicios, familias);
        cuerpo.ArchivoFotoId = fotoAjena;
        var respuesta = await TalleresDeLuteriaTests.EnviarAsync(otra, csrfOtra, HttpMethod.Post, "/api/v1/externo/mis-talleres", cuerpo);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("archivoFotoId", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        cuerpo.ArchivoFotoId = 987_654;
        respuesta = await TalleresDeLuteriaTests.EnviarAsync(otra, csrfOtra, HttpMethod.Post, "/api/v1/externo/mis-talleres", cuerpo);
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task Cambiar_o_quitar_la_foto_de_un_taller_publicado_es_una_errata_y_queda_en_el_historial()
    {
        await using var factory = new TestWebApplicationFactory();
        var (lutier, csrf, _) = await TalleresDeLuteriaTests.LutierAsync(factory);
        var (servicios, familias) = await TalleresDeLuteriaTests.CatalogosAsync(factory);
        var foto = await SubirComoLutierAsync(lutier);
        var taller = await TalleresDeLuteriaTests.CrearComoPersonaAsync(lutier, csrf, TalleresDeLuteriaTests.UnTallerCompleto(servicios, familias));
        await TalleresDeLuteriaTests.EnviarARevisionAsync(lutier, csrf, taller.Id);
        var consola = await CmsTestClient.LoginAsync(factory);
        await TalleresDeLuteriaTests.DecidirAsync(consola, taller.Id, "publicar");

        var cuerpo = TalleresDeLuteriaTests.UnTallerCompleto(servicios, familias);
        cuerpo.ArchivoFotoId = foto;
        var guardado = await TalleresDeLuteriaTests.EnviarAsync(lutier, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", cuerpo);
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        var conFoto = (await guardado.Content.ReadFromJsonAsync<TallerDto>())!;
        Assert.Equal("publicado", conFoto.EstadoRegistro);
        Assert.Equal(foto, conFoto.ArchivoFotoId);

        cuerpo.ArchivoFotoId = null;
        guardado = await TalleresDeLuteriaTests.EnviarAsync(lutier, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", cuerpo);
        var sinFoto = (await guardado.Content.ReadFromJsonAsync<TallerDto>())!;
        Assert.Equal("publicado", sinFoto.EstadoRegistro);
        Assert.Null(sinFoto.ArchivoFotoId);

        // El archivo no se borra: solo se desvinculó.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.True(await db.Files.AsNoTracking().AnyAsync(x => x.Id == foto));
        Assert.Equal(2, await db.CambiosDeRegistro.AsNoTracking()
            .CountAsync(x => x.ModuloId == Modulos.Talleres && x.RegistroId == taller.Id.ToString() && x.CampoId == "archivoFotoId"));
    }
}
