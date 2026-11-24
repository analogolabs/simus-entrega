using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El apartado «Módulos del gestor»: la vista de todas las cuentas y el interruptor de un módulo.
/// </summary>
/// <remarks>
/// Se prueba lo que el apartado promete y no su dibujo: quién puede cambiar módulos, que el cambio
/// llegue de inmediato a las rutas del gestor, que quede rastro con el antes y el después, y que un
/// interruptor no pise lo que otro dejó puesto.
/// </remarks>
public sealed class ModulosDelGestorTests
{
    private static string Ruta(int id, string codigo) =>
        string.Create(CultureInfo.InvariantCulture, $"/api/v1/admin/usuarios/{id}/modulos/{codigo}");

    private static Task<HttpResponseMessage> InterruptorAsync(HttpClient sesion, int id, string codigo, bool habilitado) =>
        sesion.PutAsJsonAsync(Ruta(id, codigo), new { habilitado });

    [Fact]
    public async Task El_resumen_lista_las_cuentas_de_consola_con_sus_modulos_y_solo_lo_ve_el_webmaster()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, correo) = await PermisosPorCuentaTests.GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        (await InterruptorAsync(webmaster, id, "agenda", true)).EnsureSuccessStatusCode();

        var resumen = await webmaster.GetFromJsonAsync<JsonElement>("/api/v1/admin/usuarios/modulos/resumen");
        var cuentas = resumen.GetProperty("cuentas").EnumerateArray().ToList();
        var suya = cuentas.Single(c => c.GetProperty("correo").GetString() == correo);
        var modulos = suya.GetProperty("modulos").EnumerateArray().Select(m => m.GetString()).ToList();

        Assert.Contains("agenda", modulos);
        Assert.Contains("monitor", modulos);
        Assert.DoesNotContain("noticias", modulos);
        Assert.False(suya.GetProperty("esWebmaster").GetBoolean());
        Assert.Contains(cuentas, c => c.GetProperty("esWebmaster").GetBoolean());

        Assert.Equal(HttpStatusCode.Forbidden,
            (await gestor.GetAsync("/api/v1/admin/usuarios/modulos/resumen")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().GetAsync("/api/v1/admin/usuarios/modulos/resumen")).StatusCode);
    }

    [Fact]
    public async Task Habilitar_y_deshabilitar_un_modulo_abre_y_cierra_la_ruta_de_inmediato()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync("/api/v1/institucional/agenda")).StatusCode);

        (await InterruptorAsync(webmaster, id, "agenda", true)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync("/api/v1/institucional/agenda")).StatusCode);
        var mios = await gestor.GetFromJsonAsync<JsonElement>("/api/v1/admin/mis-modulos");
        Assert.Contains("agenda", mios.GetProperty("modulos").EnumerateArray().Select(m => m.GetString()));

        (await InterruptorAsync(webmaster, id, "agenda", false)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync("/api/v1/institucional/agenda")).StatusCode);
    }

    [Fact]
    public async Task Un_interruptor_no_pisa_lo_que_otro_dejo_puesto()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, _, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        (await InterruptorAsync(webmaster, id, "agenda", true)).EnsureSuccessStatusCode();
        var segunda = await InterruptorAsync(webmaster, id, "noticias", true);
        segunda.EnsureSuccessStatusCode();

        var modulos = (await segunda.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("modulos")
            .EnumerateArray().Select(m => m.GetString()).ToList();
        Assert.Contains("agenda", modulos);
        Assert.Contains("noticias", modulos);
    }

    [Fact]
    public async Task Cada_cambio_queda_en_el_registro_con_el_antes_y_el_despues_y_quien_lo_hizo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, _, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        (await InterruptorAsync(webmaster, id, "agenda", true)).EnsureSuccessStatusCode();
        (await InterruptorAsync(webmaster, id, "noticias", true)).EnsureSuccessStatusCode();
        (await InterruptorAsync(webmaster, id, "agenda", false)).EnsureSuccessStatusCode();
        // Repetir el mismo estado no es un cambio.
        (await InterruptorAsync(webmaster, id, "agenda", false)).EnsureSuccessStatusCode();

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var registro = id.ToString(CultureInfo.InvariantCulture);
        var cambios = await db.CambiosDeRegistro
            .Where(x => x.ModuloId == "usuarios" && x.RegistroId == registro)
            .OrderBy(x => x.Id).ToListAsync();

        Assert.Equal(3, cambios.Count);
        Assert.Null(cambios[0].ValorAnterior);
        Assert.Equal("agenda", cambios[0].ValorNuevo);
        Assert.Equal("agenda", cambios[1].ValorAnterior);
        Assert.Equal("agenda,noticias", cambios[1].ValorNuevo);
        Assert.Equal("agenda,noticias", cambios[2].ValorAnterior);
        Assert.Equal("noticias", cambios[2].ValorNuevo);
        Assert.All(cambios, c => Assert.NotNull(c.ActorId));
        Assert.All(cambios, c => Assert.Equal("contacto", c.ClaseDato));

        var bitacora = await db.AuditLogs
            .Where(x => x.TableName == "ModulosPorCuenta" && x.RecordId == registro).ToListAsync();
        Assert.NotEmpty(bitacora);
        Assert.All(bitacora, b => Assert.True(b.UserId > 0));
    }

    [Theory]
    [InlineData("monitor")]
    [InlineData("usuarios")]
    [InlineData("sistema")]
    [InlineData("inventado")]
    public async Task Los_modulos_que_no_se_pueden_cambiar_se_rechazan_diciendo_por_que(string codigo)
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, _, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        var respuesta = await InterruptorAsync(webmaster, id, codigo, true);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("modulos", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_un_webmaster_no_se_le_quitan_modulos()
    {
        await using var factory = new TestWebApplicationFactory();
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var resumen = await webmaster.GetFromJsonAsync<JsonElement>("/api/v1/admin/usuarios/modulos/resumen");
        var idWebmaster = resumen.GetProperty("cuentas").EnumerateArray()
            .First(c => c.GetProperty("esWebmaster").GetBoolean()).GetProperty("id").GetInt32();

        var respuesta = await InterruptorAsync(webmaster, idWebmaster, "agenda", false);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task Un_gestor_no_puede_darse_modulos_ni_dar_a_otros()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var (otro, _, _) = await PermisosPorCuentaTests.GestorAsync(factory);

        Assert.Equal(HttpStatusCode.Forbidden, (await InterruptorAsync(gestor, id, "agenda", true)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await InterruptorAsync(gestor, otro, "agenda", true)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync("/api/v1/institucional/agenda")).StatusCode);
    }

    [Fact]
    public async Task Una_cuenta_que_no_existe_da_404()
    {
        await using var factory = new TestWebApplicationFactory();
        var webmaster = await CmsTestClient.LoginAsync(factory);

        Assert.Equal(HttpStatusCode.NotFound, (await InterruptorAsync(webmaster, 999_999, "agenda", true)).StatusCode);
    }
}
