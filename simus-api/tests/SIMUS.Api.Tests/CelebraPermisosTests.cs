using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// «Celebra la Música» es un apartado propio de la consola: solo lo gestiona quien tiene el módulo «celebra».
/// </summary>
/// <remarks>
/// Antes bastaba «categorias». Estas pruebas fijan la regla EN EL SERVIDOR (no solo en la barra): sin el módulo,
/// 403 en toda ruta de la consola de Celebra; con él, 200/201; y «categorias» ya no abre nada de aquí.
/// </remarks>
public sealed class CelebraPermisosTests
{
    private const string Consola = "/api/v1/institucional/celebra-la-musica/ediciones";
    private const string Archivos = "/api/v1/institucional/archivos";

    private static object Edicion(bool publicada) => new
    {
        nombre = "Celebra la Música 2041",
        hashtag = "#CelebraLaMúsica",
        publicada,
        actual = false,
        colorPrincipal = "#e5007e",
        resumen = "Resumen.",
        categorias = Array.Empty<object>(),
        preguntas = Array.Empty<object>(),
        recursos = Array.Empty<object>(),
    };

    private static async Task<HttpClient> GestorConAsync(TestWebApplicationFactory factory, params string[] modulos)
    {
        const string clave = "ClaveDePrueba123";
        const string definitiva = "ClaveElegida456";
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var correo = $"gestor.celebra.{Guid.NewGuid():N}@pnmc.local";
        var alta = await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            FullName = "Gestora de Celebra", Email = correo, Roles = ["gestor_interno"], Password = clave, IsActive = true,
        });
        alta.EnsureSuccessStatusCode();
        var creada = await alta.Content.ReadFromJsonAsync<JsonElement>();
        var id = int.Parse(creada.GetProperty("user").GetProperty("id").GetString()!, CultureInfo.InvariantCulture);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.ModulosPorCuenta.RemoveRange(db.ModulosPorCuenta.Where(x => x.IdUsuario == id));
            foreach (var modulo in modulos)
                db.ModulosPorCuenta.Add(new ModuloPorCuentaRow { IdUsuario = id, CodigoModulo = modulo, FechaOtorgado = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }
        var sesion = await CmsTestClient.LoginAsync(factory, correo, clave);
        (await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-contrasena", new CambioDeContrasenaPropia { Actual = clave, Nueva = definitiva })).EnsureSuccessStatusCode();
        (await sesion.PostAsJsonAsync("/api/v1/admin/auth/mi-perfil", new PerfilPropio
        {
            PrimerNombre = "Gestora", PrimerApellido = "De Celebra", TipoDocumento = "cc",
            Identificacion = "5" + id.ToString(CultureInfo.InvariantCulture).PadLeft(6, '0'),
        })).EnsureSuccessStatusCode();
        return sesion;
    }

    [Fact]
    public async Task Sin_el_modulo_celebra_toda_ruta_de_la_consola_responde_403_aunque_tenga_categorias()
    {
        await using var factory = new TestWebApplicationFactory();
        var gestor = await GestorConAsync(factory, "categorias", "banco-de-archivos");

        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync(Consola)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync($"{Consola}/2041")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync($"{Consola}/2041/historial")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PutAsJsonAsync($"{Consola}/2041", Edicion(publicada: true))).StatusCode);
    }

    [Fact]
    public async Task Con_el_modulo_celebra_edita_y_publica_y_queda_en_el_historial()
    {
        await using var factory = new TestWebApplicationFactory();
        var gestor = await GestorConAsync(factory, "celebra");

        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync(Consola)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await gestor.PutAsJsonAsync($"{Consola}/2041", Edicion(publicada: false))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await gestor.PutAsJsonAsync($"{Consola}/2041", Edicion(publicada: true))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync($"{Consola}/2041")).StatusCode);

        var historial = await (await gestor.GetAsync($"{Consola}/2041/historial")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(historial.GetProperty("items").GetArrayLength() >= 2);
        Assert.Contains("publicó", historial.GetProperty("items")[0].GetProperty("resumen").GetString(), StringComparison.Ordinal);

        // El portal público sigue abierto a todos.
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().GetAsync("/api/v1/publico/celebra-la-musica/ediciones/2041")).StatusCode);
    }

    [Fact]
    public async Task La_escritura_de_celebra_exige_el_testigo_antiforgery()
    {
        await using var factory = new TestWebApplicationFactory();
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        Assert.Equal(HttpStatusCode.BadRequest, (await sinTestigo.PutAsJsonAsync($"{Consola}/2042", Edicion(publicada: true))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync("/api/v1/publico/celebra-la-musica/ediciones/2042")).StatusCode);
    }

    [Fact]
    public async Task El_modulo_celebra_abre_el_banco_para_adjuntar_pero_no_para_retirar()
    {
        await using var factory = new TestWebApplicationFactory();
        var conCelebra = await GestorConAsync(factory, "celebra");
        var sinNada = await GestorConAsync(factory);

        Assert.Equal(HttpStatusCode.OK, (await conCelebra.GetAsync(Archivos)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await conCelebra.GetAsync($"{Archivos}/almacenamiento")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await conCelebra.DeleteAsync($"{Archivos}/999999")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await sinNada.GetAsync(Archivos)).StatusCode);
    }

    [Fact]
    public async Task Mis_modulos_incluye_celebra_solo_para_quien_lo_tiene_y_siempre_para_el_webmaster()
    {
        await using var factory = new TestWebApplicationFactory();
        var con = await GestorConAsync(factory, "celebra");
        var sin = await GestorConAsync(factory, "categorias");
        var webmaster = await CmsTestClient.LoginAsync(factory);

        static async Task<string[]> Mios(HttpClient c) =>
            (await (await c.GetAsync("/api/v1/admin/mis-modulos")).Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("modulos").EnumerateArray().Select(x => x.GetString()!).ToArray();

        Assert.Contains("celebra", await Mios(con));
        Assert.DoesNotContain("celebra", await Mios(sin));
        Assert.Contains("celebra", await Mios(webmaster));

        // Se ofrece en el catálogo de «Usuarios y roles» para concederlo.
        var catalogo = await (await webmaster.GetAsync("/api/v1/admin/usuarios/modulos-disponibles")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("celebra", catalogo.GetProperty("modulos").EnumerateArray().Select(x => x.GetString()));
        Assert.DoesNotContain("celebra", catalogo.GetProperty("soloWebmaster").EnumerateArray().Select(x => x.GetString()));
    }
}
