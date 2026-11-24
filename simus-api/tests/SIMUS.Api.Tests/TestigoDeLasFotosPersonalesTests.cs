using System.Net;
using System.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Las cuatro subidas de foto personal (perfil público, talleres, espacios y redes) exigen el testigo
/// antiforgery, como las subidas hermanas del Banco de archivos. Antes llevaban
/// <c>DisableAntiforgery</c> sin el filtro que lo exige a mano: subir con solo la cookie pasaba.
/// </summary>
public sealed class TestigoDeLasFotosPersonalesTests
{
    public static TheoryData<string> Rutas => new()
    {
        "/api/v1/externo/cuenta/perfil-publico/foto",
        "/api/v1/externo/mis-talleres/foto",
        "/api/v1/externo/mis-espacios/foto",
        "/api/v1/externo/mis-redes/foto",
    };

    [Theory]
    [MemberData(nameof(Rutas))]
    public async Task Subir_una_foto_personal_sin_testigo_se_rechaza_y_no_guarda_nada(string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var (sesion, _, _) = await TalleresDeLuteriaTests.LutierAsync(factory);
        var antes = await ContarArchivosAsync(factory);

        var respuesta = await sesion.PostAsync(ruta, Formulario());

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Equal(antes, await ContarArchivosAsync(factory));
    }

    [Theory]
    [MemberData(nameof(Rutas))]
    public async Task Con_el_testigo_la_foto_personal_se_sube(string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var (sesion, _, _) = await TalleresDeLuteriaTests.LutierAsync(factory);

        var respuesta = await TestigoDelCanalExterno.PostAsync(sesion, ruta, Formulario());

        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
    }

    private static async Task<int> ContarArchivosAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        return await db.Files.AsNoTracking().CountAsync();
    }

    private static MultipartFormDataContent Formulario()
    {
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="));
        parte.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        contenido.Add(parte, "file", "foto.png");
        contenido.Add(new StringContent("Foto"), "alt");
        return contenido;
    }
}
