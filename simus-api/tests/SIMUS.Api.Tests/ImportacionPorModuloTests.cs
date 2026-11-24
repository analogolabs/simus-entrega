using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Importar un archivo exige el módulo de la consola que trabaja ese dominio (D5-02).
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que una cuenta de consola sin Noticias, Agenda,
/// Organizaciones o Catálogo cree esos registros con un archivo. Hasta D5-02 solo Festivales
/// comprobaba el módulo: cualquier gestor, aunque no tuviera ninguno activado, previsualizaba y
/// confirmaba el resto de las importaciones.
/// </para>
/// <para>
/// <b>NO VALE PROBARLO CON EL WEBMASTER</b>, que tiene todos los módulos siempre: con él todo
/// responde 200. Todas las de aquí crean un gestor y le conceden los módulos uno a uno, igual que
/// <see cref="PermisosPorCuentaTests"/>.
/// </para>
/// </remarks>
public sealed class ImportacionPorModuloTests
{
    private static readonly string[] SoloAgenda = ["agenda"];

    private static readonly string[] LosOchoDominios =
        ["agenda", "catalogo-editorial", "espacios", "festivales", "mercados", "organizaciones", "redes", "talleres"];

    private static object Sobre(string dominio) => new
    {
        nombreArchivo = $"{dominio}.csv",
        formato = "csv",
        huellaArchivo = new string('d', 64),
        versionContrato = 1,
        filas = new[]
        {
            new
            {
                numeroFila = 2,
                valores = new Dictionary<string, string?> { ["titulo"] = $"Prueba D5 {Guid.NewGuid():N}" },
            },
        },
    };

    private static async Task<List<string>> DominiosOfrecidosAsync(HttpClient sesion)
    {
        var lista = await sesion.GetFromJsonAsync<JsonElement>("/api/v1/admin/importaciones");
        return lista.GetProperty("dominios").EnumerateArray()
            .Select(item => item.GetProperty("dominio").GetString()!)
            .Order(StringComparer.Ordinal)
            .ToList();
    }

    private static async Task<HttpResponseMessage> PrevisualizarAsync(HttpClient sesion, string dominio)
    {
        var testigo = await sesion.GetAsync($"/api/v1/admin/importaciones/{dominio}/csrf");
        if (!testigo.IsSuccessStatusCode) return testigo;

        var token = (await testigo.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        using var peticion = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/importaciones/{dominio}/previsualizar")
        {
            Content = JsonContent.Create(Sobre(dominio)),
        };
        peticion.Headers.Add("X-CSRF-TOKEN", token);
        return await sesion.SendAsync(peticion);
    }

    [Fact]
    public async Task Una_cuenta_sin_modulos_no_ve_ni_previsualiza_ningun_dominio()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, sesion, _) = await PermisosPorCuentaTests.GestorAsync(factory);

        Assert.Empty(await DominiosOfrecidosAsync(sesion));

        foreach (var dominio in LosOchoDominios)
        {
            var respuesta = await PrevisualizarAsync(sesion, dominio);
            Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
        }
    }

    [Fact]
    public async Task Con_un_modulo_solo_se_importa_lo_de_ese_modulo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, sesion, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        var concedido = await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloAgenda });
        concedido.EnsureSuccessStatusCode();

        Assert.Equal(["agenda"], await DominiosOfrecidosAsync(sesion));

        var propia = await PrevisualizarAsync(sesion, "agenda");
        Assert.Equal(HttpStatusCode.OK, propia.StatusCode);

        foreach (var ajeno in new[] { "organizaciones", "catalogo-editorial", "festivales", "mercados", "talleres", "espacios", "redes" })
        {
            var respuesta = await PrevisualizarAsync(sesion, ajeno);
            Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
        }
    }

    [Fact]
    public async Task El_webmaster_ve_todos_los_dominios()
    {
        await using var factory = new TestWebApplicationFactory();
        var webmaster = await CmsTestClient.LoginAsync(factory);

        Assert.Equal(LosOchoDominios, await DominiosOfrecidosAsync(webmaster));
    }
}
