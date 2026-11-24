using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// / REC-17: la API escribe los instantes en UTC inequívoco («Z») y las fechas de calendario
/// sin hora ni zona.
/// </summary>
/// <remarks>
/// La web lee una fecha sin zona como hora LOCAL del navegador. Con los instantes saliendo sin
/// sufijo, la consola pintaba «Enviado 23:23» y el historial «18:23» en la misma ficha. Ver
/// <see cref="InstanteUtcConverter"/>.
/// </remarks>
public sealed partial class InstantesEnUtcTests
{
    private const string Noticias = "/api/v1/institucional/noticias";

    /// <summary>«2026-11-05T23:23:00» o «2026-11-05T23:23:00.123» sin «Z» ni desfase.</summary>
    [GeneratedRegex(@"""(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?)""")]
    private static partial Regex InstanteSinZona();

    [Fact]
    public async Task Lo_que_se_lee_de_la_base_sale_marcado_como_UTC_tambien_en_una_proyeccion()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        (await client.PostAsJsonAsync(Noticias, new { titulo = "Con fecha", resumen = "Resumen.", cuerpo = "Cuerpo." }))
            .EnsureSuccessStatusCode();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();

        var entidad = await db.Noticias.AsNoTracking().FirstAsync();
        var proyectada = await db.Noticias.AsNoTracking().Select(n => new { n.FechaCreacion }).FirstAsync();

        Assert.Equal(DateTimeKind.Utc, entidad.FechaCreacion.Kind);
        Assert.Equal(DateTimeKind.Utc, proyectada.FechaCreacion.Kind);
    }

    [Fact]
    public async Task Una_noticia_lleva_sus_instantes_con_Z_y_su_fecha_de_publicacion_sin_hora()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var creada = await (await client.PostAsJsonAsync(Noticias, new
        {
            titulo = "Noticia con fechas",
            resumen = "Resumen.",
            cuerpo = "Cuerpo.",
            fechaPublicacion = new DateOnly(2026, 11, 5),
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creada.GetProperty("id").GetInt64();

        // SE LEE DE NUEVO, y no la respuesta del alta: el alta devuelve lo que acaba de escribir en
        // memoria, con `DateTime.UtcNow` todavía marcado; lo que fallaba era lo LEIDO de la base.
        var crudo = await client.GetStringAsync($"{Noticias}/{id}");
        using var json = JsonDocument.Parse(crudo);

        var actualizada = json.RootElement.GetProperty("fechaActualizacion").GetString()!;
        Assert.EndsWith("Z", actualizada, StringComparison.Ordinal);
        Assert.Equal(DateTimeKind.Utc, DateTime.Parse(actualizada, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.RoundtripKind).Kind);

        // LA FECHA DE CALENDARIO NO TIENE ZONA: el 5 de noviembre es el 5 en Bogotá y en cualquier
        // parte. Si llevara hora, la web la correría al 4 a las 19:00.
        Assert.Equal("2026-11-05", json.RootElement.GetProperty("fechaPublicacion").GetString());
    }

    [Theory]
    [InlineData(Noticias)]
    [InlineData("/api/v1/institucional/agenda")]
    [InlineData("/api/v1/admin/organizaciones")]
    [InlineData("/api/v1/admin/auth/users")]
    [InlineData("/api/v1/admin/solicitudes-de-vinculacion")]
    [InlineData("/api/v1/admin/data/monitor")]
    [InlineData("/api/v1/institucional/mercados")]
    [InlineData("/api/v1/institucional/festivales/en-revision")]
    public async Task Ningun_listado_de_la_consola_devuelve_un_instante_sin_zona(string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        // Algo que leer en cada listado que dependa de lo escrito.
        (await client.PostAsJsonAsync(Noticias, new { titulo = "Para el barrido", resumen = "Resumen.", cuerpo = "Cuerpo." }))
            .EnsureSuccessStatusCode();

        var respuesta = await client.GetAsync(ruta);
        respuesta.EnsureSuccessStatusCode();
        var crudo = await respuesta.Content.ReadAsStringAsync();

        var sinZona = InstanteSinZona().Matches(crudo).Select(m => m.Groups[1].Value).Distinct().ToList();
        Assert.True(sinZona.Count == 0, $"{ruta} devuelve instantes sin zona: {string.Join(", ", sinZona.Take(5))}");
    }
}
