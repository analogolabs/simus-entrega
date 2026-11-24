using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Las subidas y los retiros del Banco de archivos exigen el testigo antiforgery, por la consola y
/// por el portal de las organizaciones (hallazgo D5-09).
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que subir o retirar un archivo vuelva a depender solo de la
/// cookie <c>SameSite=Lax</c>. La subida «desactiva el antiforgery» de ASP.NET para poder leer el
/// formulario; sin el filtro que lo exige a mano, esa decisión dejaba las seis puertas abiertas.
/// Todas usan una sesión real SIN cabecera de testigo.
/// </para>
/// </summary>
public sealed class TestigoDelBancoDeArchivosTests
{
    private const string Consola = "/api/v1/institucional/archivos";
    private const string Portal = "/api/v1/externo/archivos";

    [Fact]
    public async Task Subir_una_imagen_por_la_consola_sin_testigo_se_rechaza_y_no_guarda_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var antes = await ContarArchivosAsync(factory);

        var respuesta = await sinTestigo.PostAsync(Consola, FormularioDeImagen());

        await EsperarRechazoPorTestigoAsync(respuesta);
        Assert.Equal(antes, await ContarArchivosAsync(factory));
    }

    [Fact]
    public async Task Subir_un_documento_por_la_consola_sin_testigo_se_rechaza_y_no_guarda_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var antes = await ContarArchivosAsync(factory);

        var respuesta = await sinTestigo.PostAsync($"{Consola}/documentos", FormularioDePdf());

        await EsperarRechazoPorTestigoAsync(respuesta);
        Assert.Equal(antes, await ContarArchivosAsync(factory));
    }

    [Fact]
    public async Task Retirar_un_archivo_por_la_consola_sin_testigo_se_rechaza_y_el_archivo_sigue()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var subido = await consola.PostAsync(Consola, FormularioDeImagen());
        subido.EnsureSuccessStatusCode();
        var id = (await subido.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuesta = await sinTestigo.DeleteAsync($"{Consola}/{id}");

        await EsperarRechazoPorTestigoAsync(respuesta);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.True(await db.Files.AsNoTracking().AnyAsync(f => f.Id == id));
    }

    [Fact]
    public async Task Con_el_testigo_la_consola_sube_y_retira()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);

        var subido = await consola.PostAsync(Consola, FormularioDeImagen());
        Assert.Equal(HttpStatusCode.Created, subido.StatusCode);
        var id = (await subido.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var retirado = await consola.DeleteAsync($"{Consola}/{id}");
        Assert.True(retirado.IsSuccessStatusCode, await retirado.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Las_tres_puertas_del_portal_piden_el_testigo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (organizacion, _) = await ReclamacionSeguimientoTests.OrganizacionAsync(factory, "testigo.banco@example.com");
        var antes = await ContarArchivosAsync(factory);

        // LAS TRES SIN TESTIGO: la imagen, el documento y el retiro. El filtro va antes de las
        // guardas del canal (correo confirmado, cuota) y antes de leer el archivo.
        await EsperarRechazoPorTestigoAsync(await organizacion.PostAsync(Portal, FormularioDeImagen()));
        await EsperarRechazoPorTestigoAsync(await organizacion.PostAsync($"{Portal}/documentos", FormularioDePdf()));
        await EsperarRechazoPorTestigoAsync(await organizacion.DeleteAsync($"{Portal}/1"));

        Assert.Equal(antes, await ContarArchivosAsync(factory));
    }

    [Fact]
    public async Task Con_el_testigo_el_portal_pasa_el_filtro_y_decide_por_sus_propias_guardas()
    {
        await using var factory = new TestWebApplicationFactory();
        var (organizacion, _) = await ReclamacionSeguimientoTests.OrganizacionAsync(factory, "testigo.banco.ok@example.com");

        var respuesta = await TestigoDelCanalExterno.PostAsync(organizacion, Portal, FormularioDeImagen());

        // Según la política de correo del entorno responde 201 o un 409 con lo que falta; lo que NO
        // puede decir es que el testigo no valió.
        Assert.DoesNotContain("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    // ---------- Andamio ----------------------------------------------------------

    private static async Task EsperarRechazoPorTestigoAsync(HttpResponseMessage respuesta)
    {
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    private static async Task<int> ContarArchivosAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        return await db.Files.AsNoTracking().CountAsync();
    }

    private static MultipartFormDataContent FormularioDeImagen()
    {
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="));
        parte.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        contenido.Add(parte, "file", "prueba.png");
        contenido.Add(new StringContent("Una imagen de prueba"), "alt");
        return contenido;
    }

    private static MultipartFormDataContent FormularioDePdf()
    {
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(Encoding.ASCII.GetBytes(
            "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"));
        parte.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        contenido.Add(parte, "file", "acta.pdf");
        return contenido;
    }
}
