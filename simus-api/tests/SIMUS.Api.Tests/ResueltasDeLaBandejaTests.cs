using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// «Resueltas (30 días)»: lo que ya se decidió, solo de los módulos que la cuenta tiene.
/// </summary>
/// <remarks>
/// <b>NUNCA CON EL WEBMASTER</b>, que tiene todos los módulos y con él nada se filtraría: cada prueba
/// crea un gestor y le concede, o no, el módulo, como en <see cref="RevisionInstitucionalPorModuloTests"/>.
/// </remarks>
public sealed class ResueltasDeLaBandejaTests
{
    private const string Ruta = "/api/v1/admin/resueltas";

    [Fact]
    public async Task Cada_cuenta_ve_solo_lo_resuelto_de_sus_modulos_y_dentro_de_los_30_dias()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        await Sembrar(factory, "Noticias", "publicar", DateTime.UtcNow.AddDays(-2));
        await Sembrar(factory, "Mercados", "aprobar", DateTime.UtcNow.AddDays(-2));
        await Sembrar(factory, "Noticias", "rechazar", DateTime.UtcNow.AddDays(-45));
        await Sembrar(factory, "Noticias", "crear", DateTime.UtcNow.AddDays(-1));

        Assert.Empty(await Items(gestor));

        await Conceder(factory, id, ["noticias"]);
        var conNoticias = await Items(gestor);

        // Solo la publicación reciente de Noticias: la de Mercados no es de su módulo, el rechazo es
        // de hace 45 días y «crear» no es una decisión.
        var unica = Assert.Single(conNoticias);
        Assert.Equal("noticias", unica.GetProperty("grupo").GetString());
        Assert.Equal("publicar", unica.GetProperty("accion").GetString());
    }

    [Fact]
    public async Task Una_devolucion_para_corregir_cuenta_como_resuelta()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        await Conceder(factory, id, ["mercados"]);
        await Sembrar(factory, "Mercados", "actualizar", DateTime.UtcNow.AddDays(-1), "{\"Evento\":\"MercadoConAjustesSolicitados\"}");
        await Sembrar(factory, "Mercados", "actualizar", DateTime.UtcNow.AddDays(-1), "{\"Evento\":\"MercadoCreado\"}");

        Assert.Single(await Items(gestor));
    }

    private static async Task<List<JsonElement>> Items(HttpClient sesion)
    {
        var respuesta = await sesion.GetFromJsonAsync<JsonElement>(Ruta);
        Assert.Equal(30, respuesta.GetProperty("dias").GetInt32());
        return [.. respuesta.GetProperty("items").EnumerateArray()];
    }

    private static async Task Conceder(TestWebApplicationFactory factory, int cuenta, string[] modulos)
    {
        var webmaster = await CmsTestClient.LoginAsync(factory);
        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{cuenta}/modulos", new { modulos })).EnsureSuccessStatusCode();
    }

    private static async Task Sembrar(TestWebApplicationFactory factory, string tabla, string accion, DateTime cuando, string? json = null)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        db.AuditLogs.Add(new AuditLogRow { TableName = tabla, RecordId = "1", Action = accion, NewValuesJson = json, CreatedAt = cuando });
        await db.SaveChangesAsync();
    }
}
