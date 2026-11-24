using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Las escrituras de Festivales de la consola exigen el testigo antiforgery.
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que el alta, la publicación, la liberación de la administración o
/// la fusión de duplicados de un Festival vuelvan a quedar sin testigo, que era lo único en el
/// grupo de <c>/admin</c> que no lo pedía. Todas usan una sesión real SIN cabecera de testigo: la
/// suite no puede pasar en verde sobre una puerta abierta.
/// </para>
/// </summary>
public sealed class TestigoDeLasEscriturasDeFestivalesTests
{
    private const string Festivales = "/api/v1/admin/festivales";

    [Fact]
    public async Task El_alta_sin_testigo_se_rechaza_y_no_escribe()
    {
        await using var factory = new TestWebApplicationFactory();
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var nombre = "Festival sin testigo " + Guid.NewGuid().ToString("N")[..8];

        var respuesta = await sinTestigo.PostAsJsonAsync(Festivales, CuerpoDeAlta(nombre));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.False(await db.FestivalRecords.AsNoTracking().AnyAsync(x => x.Name == nombre));
    }

    [Fact]
    public async Task La_publicacion_sin_testigo_se_rechaza_y_no_cambia_el_estado()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var id = await CrearFestivalAsync(consola);
        var estadoAntes = await EstadoAsync(factory, id);
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuesta = await sinTestigo.PostAsJsonAsync($"{Festivales}/{id}/publicacion", new { estado = "publicado" });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Equal(estadoAntes, await EstadoAsync(factory, id));
    }

    [Fact]
    public async Task Liberar_la_administracion_sin_testigo_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var id = await CrearFestivalAsync(consola);
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuesta = await sinTestigo.PostAsJsonAsync($"{Festivales}/{id}/liberar-administracion", new { motivo = "Sin testigo." });

        // 400 por el testigo, no por el motivo: el motivo es válido.
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Fusionar_sin_testigo_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var conservado = await CrearFestivalAsync(consola);
        var absorbido = await CrearFestivalAsync(consola);
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuesta = await sinTestigo.PostAsJsonAsync($"{Festivales}/{conservado}/fusion", new
        {
            absorbidoId = absorbido.ToString(System.Globalization.CultureInfo.InvariantCulture),
            motivo = "Sin testigo.",
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Null((await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == absorbido)).FusionadoEnId);
    }

    [Fact]
    public async Task Con_el_testigo_de_la_ruta_de_la_consola_la_escritura_se_acepta()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        // El testigo sale de la ruta neutra de la consola, la misma que usa la web.
        var token = await consola.GetFromJsonAsync<JsonElement>("/api/v1/admin/csrf");
        consola.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("requestToken").GetString());

        var respuesta = await consola.PostAsJsonAsync(Festivales, CuerpoDeAlta("Festival con testigo " + Guid.NewGuid().ToString("N")[..8]));

        Assert.True(respuesta.IsSuccessStatusCode, await respuesta.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Las_lecturas_no_piden_testigo()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var id = await CrearFestivalAsync(consola);
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        Assert.Equal(HttpStatusCode.OK, (await sinTestigo.GetAsync($"{Festivales}/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await sinTestigo.GetAsync($"{Festivales}/{id}/fusion/candidatos")).StatusCode);
    }

    // ---------- Andamio ----------------------------------------------------------

    private static object CuerpoDeAlta(string nombre) => new
    {
        festival = new
        {
            nombre,
            nivelCobertura = "nacional", sedeCodigoDepartamento = "05", sedeCodigoMunicipio = "05001",
            practicasMusicalesIds = Array.Empty<int>(),
            territoriosSonorosIds = Array.Empty<int>(),
        },
    };

    private static async Task<int> CrearFestivalAsync(HttpClient consola)
    {
        var respuesta = await consola.PostAsJsonAsync(Festivales, CuerpoDeAlta("Festival de prueba " + Guid.NewGuid().ToString("N")[..8]));
        respuesta.EnsureSuccessStatusCode();
        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        return int.Parse(cuerpo.GetProperty("id").GetString()!, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static async Task<string?> EstadoAsync(TestWebApplicationFactory factory, int id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        return (await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == id)).StatusCode;
    }
}
