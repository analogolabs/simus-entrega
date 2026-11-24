using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
///: derechos desde la consola, motivo obligatorio al observar y al retirar, y erratas en lo
/// publicado.
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Hasta una ficha creada en la consola no podía
/// publicarse nunca, porque sus derechos solo los fijaban las semillas. Aquí se recorre el circuito
/// entero por el API, sin tocar la base: crear, citar fuente, registrar derechos, validar y publicar.
/// </para>
/// <para>
/// <b>Y QUE LAS DOS DECISIONES SIGAN SEPARADAS.</b> Registrar derechos es del catalogador; publicar,
/// del webmaster. Una cuenta con el módulo pero sin rol de webmaster hace lo primero y no lo segundo.
/// </para>
/// </remarks>
public sealed class CatalogoEditorialDerechosYMotivosTests
{
    private const string Consola = "/api/v1/institucional/catalogo-editorial";
    private const string Publico = "/api/v1/publico/catalogo-editorial";
    private static readonly string[] SoloCatalogo = ["catalogo-editorial"];

    private static async Task<JsonElement> CrearAsync(HttpClient client, string codigo, bool conAccesos = false)
    {
        object cuerpo = conAccesos
            ? new
            {
                codigo,
                titulo = "Ficha de derechos",
                accesos = new[]
                {
                    new { tipo = "enlace", url = "https://www.mincultura.gov.co/guia.pdf", ubicacionFisica = (string?)null, etiqueta = "Guía en PDF", nota = (string?)null, orden = 0 },
                },
            }
            : new { codigo, titulo = "Ficha de derechos" };
        var respuesta = await client.PostAsJsonAsync(Consola, cuerpo);
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return await respuesta.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<long> AgregarFuenteAsync(TestWebApplicationFactory factory, long publicacionId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var fuente = new FuenteEditorialRow
        {
            Nombre = "Catálogo institucional del Proyecto Editorial",
            FechaConsulta = DateTime.UtcNow,
            VerificadaPor = "Equipo editorial",
            FechaCreacion = DateTime.UtcNow,
        };
        db.FuentesEditoriales.Add(fuente);
        await db.SaveChangesAsync();
        db.PublicacionesEditorialesFuentes.Add(new PublicacionEditorialFuenteRow
        {
            PublicacionEditorialId = publicacionId,
            FuenteEditorialId = fuente.Id,
        });
        await db.SaveChangesAsync();
        return fuente.Id;
    }

    private static async Task<int> VersionAsync(HttpClient client, long id) =>
        (await (await client.GetAsync($"{Consola}/{id}")).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("version").GetInt32();

    private static async Task<List<JsonElement>> HistorialAsync(HttpClient client, long id) =>
        (await (await client.GetAsync($"{Consola}/{id}/historial")).Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();

    /// <summary>Una ficha publicada de principio a fin por el API, sin tocar la base.</summary>
    private static async Task<long> PublicadaAsync(TestWebApplicationFactory factory, HttpClient client, string codigo)
    {
        var id = (await CrearAsync(client, codigo)).GetProperty("id").GetInt64();
        var fuente = await AgregarFuenteAsync(factory, id);
        var derechos = await client.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = await VersionAsync(client, id),
            ficha = new { estado = "verificado", permitePublicarFicha = true, permitePublicarArchivo = false, licenciaONota = "CC BY-NC 4.0", fuenteId = fuente },
        });
        Assert.Equal(HttpStatusCode.OK, derechos.StatusCode);
        (await client.PostAsJsonAsync($"{Consola}/{id}/catalogacion", new { estado = "validada" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"{Consola}/{id}/publicacion", new { estado = "publicado" })).EnsureSuccessStatusCode();
        return id;
    }

    // ─────────────────────────── Derechos ───────────────────────────

    [Fact]
    public async Task Una_ficha_creada_en_la_consola_se_publica_registrando_sus_derechos_por_el_api()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var id = await PublicadaAsync(factory, client, "ED-DER-1");

        var ficha = await (await client.GetAsync($"{Consola}/{id}")).Content.ReadFromJsonAsync<JsonElement>();
        var derechos = ficha.GetProperty("derechos");
        Assert.Equal("verificado", derechos.GetProperty("estado").GetString());
        Assert.True(derechos.GetProperty("permitePublicarFicha").GetBoolean());
        Assert.Equal("CC BY-NC 4.0", derechos.GetProperty("licenciaONota").GetString());
        // QUIEN Y CUANDO LOS PONE EL SERVIDOR, no la petición.
        Assert.False(string.IsNullOrWhiteSpace(derechos.GetProperty("verificadoPor").GetString()));
        Assert.Equal(JsonValueKind.String, derechos.GetProperty("fechaVerificacion").ValueKind);

        var anonimo = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"{Publico}/ED-DER-1")).StatusCode);
    }

    [Fact]
    public async Task Registrar_derechos_queda_en_el_hilo_de_la_ficha()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-DER-2")).GetProperty("id").GetInt64();

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            ficha = new { estado = "restringido", permitePublicarFicha = true, permitePublicarArchivo = false },
        });
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        var entrada = Assert.Single(await HistorialAsync(client, id));
        Assert.Equal("DerechosCambiados", entrada.GetProperty("accion").GetString());
        // LOS DERECHOS NO SON NINGUNO DE LOS DOS EJES: el estado de catalogación se repite, como en
        // una anotación.
        Assert.Equal("pendiente_revision", entrada.GetProperty("estadoNuevo").GetString());
        Assert.Contains("restringido", entrada.GetProperty("comentario").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Los_derechos_de_cada_acceso_se_registran_por_separado()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var creada = await CrearAsync(client, "ED-DER-3", conAccesos: true);
        var id = creada.GetProperty("id").GetInt64();
        var accesoId = creada.GetProperty("accesos")[0].GetProperty("id").GetInt64();

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            accesos = new[] { new { accesoId, estado = "verificado", permitePublicarFicha = true, permitePublicarArchivo = true } },
        });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var ficha = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        var acceso = ficha.GetProperty("accesos")[0].GetProperty("derechos");
        Assert.Equal("verificado", acceso.GetProperty("estado").GetString());
        Assert.True(acceso.GetProperty("permitePublicarArchivo").GetBoolean());
        // LA FICHA NO SE TOCA SI NO SE NOMBRA.
        Assert.Equal("pendiente", ficha.GetProperty("derechos").GetProperty("estado").GetString());
        Assert.Contains("Guía en PDF", (await HistorialAsync(client, id))[0].GetProperty("comentario").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Con_los_derechos_pendientes_no_se_autoriza_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-DER-4")).GetProperty("id").GetInt64();

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            ficha = new { estado = "pendiente", permitePublicarFicha = true, permitePublicarArchivo = false },
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Empty(await HistorialAsync(client, id));
    }

    [Fact]
    public async Task Un_estado_de_derechos_inventado_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-DER-5")).GetProperty("id").GetInt64();

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            ficha = new { estado = "libre", permitePublicarFicha = true },
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task La_fuente_de_los_derechos_debe_ser_de_la_ficha()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var propia = (await CrearAsync(client, "ED-DER-6")).GetProperty("id").GetInt64();
        var ajena = (await CrearAsync(client, "ED-DER-7")).GetProperty("id").GetInt64();
        var fuenteAjena = await AgregarFuenteAsync(factory, ajena);

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{propia}/derechos", new
        {
            version = 1,
            ficha = new { estado = "verificado", permitePublicarFicha = true, fuenteId = fuenteAjena },
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task Un_acceso_de_otra_ficha_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var propia = (await CrearAsync(client, "ED-DER-8")).GetProperty("id").GetInt64();
        var ajena = await CrearAsync(client, "ED-DER-9", conAccesos: true);
        var accesoAjeno = ajena.GetProperty("accesos")[0].GetProperty("id").GetInt64();

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{propia}/derechos", new
        {
            version = 1,
            accesos = new[] { new { accesoId = accesoAjeno, estado = "verificado", permitePublicarFicha = true, permitePublicarArchivo = true } },
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task Registrar_derechos_con_una_version_vieja_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-DER-10")).GetProperty("id").GetInt64();
        (await client.PutAsJsonAsync($"{Consola}/{id}", new { titulo = "Otro título", version = 1 })).EnsureSuccessStatusCode();

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            ficha = new { estado = "verificado", permitePublicarFicha = true },
        });

        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
    }

    [Fact]
    public async Task Registrar_derechos_sin_token_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-DER-11")).GetProperty("id").GetInt64();
        var sinToken = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuesta = await sinToken.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            ficha = new { estado = "verificado", permitePublicarFicha = true },
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Empty(await HistorialAsync(client, id));
    }

    [Fact]
    public async Task El_testigo_del_catalogo_sirve_para_registrar_derechos()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-DER-14")).GetProperty("id").GetInt64();
        var consola = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var testigo = await (await consola.GetAsync($"{Consola}/csrf")).Content.ReadFromJsonAsync<JsonElement>();
        consola.DefaultRequestHeaders.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        var respuesta = await consola.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            ficha = new { estado = "verificado", permitePublicarFicha = true },
        });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
    }

    [Fact]
    public async Task El_catalogador_registra_derechos_pero_no_publica()
    {
        await using var factory = new TestWebApplicationFactory();
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var (gestorId, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{gestorId}/modulos", new { modulos = SoloCatalogo })).EnsureSuccessStatusCode();

        var id = (await CrearAsync(gestor, "ED-DER-12")).GetProperty("id").GetInt64();
        await AgregarFuenteAsync(factory, id);

        var derechos = await gestor.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            ficha = new { estado = "verificado", permitePublicarFicha = true },
        });
        Assert.Equal(HttpStatusCode.OK, derechos.StatusCode);
        (await gestor.PostAsJsonAsync($"{Consola}/{id}/catalogacion", new { estado = "validada" })).EnsureSuccessStatusCode();

        var publicar = await gestor.PostAsJsonAsync($"{Consola}/{id}/publicacion", new { estado = "publicado" });
        Assert.Equal(HttpStatusCode.Forbidden, publicar.StatusCode);
    }

    [Fact]
    public async Task Sin_el_modulo_no_se_registran_derechos()
    {
        await using var factory = new TestWebApplicationFactory();
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(webmaster, "ED-DER-13")).GetProperty("id").GetInt64();
        var (_, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);

        var respuesta = await gestor.PutAsJsonAsync($"{Consola}/{id}/derechos", new
        {
            version = 1,
            ficha = new { estado = "verificado", permitePublicarFicha = true },
        });

        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }

    // ─────────────────────────── Motivo obligatorio ───────────────────────────

    [Fact]
    public async Task Observar_sin_motivo_se_rechaza_y_con_motivo_queda_en_el_hilo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-MOT-1")).GetProperty("id").GetInt64();

        var sinMotivo = await client.PostAsJsonAsync($"{Consola}/{id}/catalogacion", new { estado = "observada", motivo = "  " });
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
        Assert.Contains("motivo", await sinMotivo.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Empty(await HistorialAsync(client, id));

        var conMotivo = await client.PostAsJsonAsync($"{Consola}/{id}/catalogacion", new { estado = "observada", motivo = "Falta el arreglista." });
        Assert.Equal(HttpStatusCode.OK, conMotivo.StatusCode);

        var entrada = Assert.Single(await HistorialAsync(client, id));
        Assert.Equal("observada", entrada.GetProperty("estadoNuevo").GetString());
        Assert.Equal("Falta el arreglista.", entrada.GetProperty("comentario").GetString());
    }

    [Fact]
    public async Task Retirar_sin_motivo_se_rechaza_y_la_ficha_sigue_en_el_portal()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await PublicadaAsync(factory, client, "ED-MOT-2");

        var sinMotivo = await client.PostAsJsonAsync($"{Consola}/{id}/publicacion", new { estado = "retirado" });

        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().GetAsync($"{Publico}/ED-MOT-2")).StatusCode);
    }

    [Fact]
    public async Task Validar_no_pide_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-MOT-3")).GetProperty("id").GetInt64();

        var respuesta = await client.PostAsJsonAsync($"{Consola}/{id}/catalogacion", new { estado = "validada" });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
    }

    // ─────────────────────────── Erratas ───────────────────────────

    [Fact]
    public async Task Una_errata_en_lo_publicado_se_aplica_sin_sacarla_del_portal()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await PublicadaAsync(factory, client, "ED-ERR-1");

        // UNA ERRATA REAL (LIS-04): una mayúscula y una letra de más. NO se manda ninguna
        // marca de errata: el servidor compara lo publicado con lo que llega y decide.
        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}", new
        {
            titulo = "Fichas de Derechos",
            version = await VersionAsync(client, id),
        });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var ficha = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("publicado", ficha.GetProperty("estadoPublicacion").GetString());
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().GetAsync($"{Publico}/ED-ERR-1")).StatusCode);

        var entrada = (await HistorialAsync(client, id))[0];
        Assert.Equal("ErrataCorregida", entrada.GetProperty("accion").GetString());
        Assert.Equal("publicado", entrada.GetProperty("estadoNuevo").GetString());
    }

    [Fact]
    public async Task La_marca_de_errata_ya_no_basta_para_colar_un_cambio_de_fondo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await PublicadaAsync(factory, client, "ED-ERR-4");

        // Quien edita DICE que es una errata; el servidor compara y ve otra obra.
        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}", new
        {
            titulo = "Otra obra distinta",
            anioInicio = 2001,
            version = await VersionAsync(client, id),
            esErrata = true,
        });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var ficha = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("en_revision", ficha.GetProperty("estadoPublicacion").GetString());
        var entrada = (await HistorialAsync(client, id))[0];
        Assert.Equal("CambioDeFondoEnPublicado", entrada.GetProperty("accion").GetString());
        // El historial dice QUÉ fue lo de fondo.
        Assert.Contains("el título", entrada.GetProperty("comentario").GetString());
    }

    [Fact]
    public async Task Un_cambio_de_fondo_en_lo_publicado_la_devuelve_a_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await PublicadaAsync(factory, client, "ED-ERR-2");

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}", new
        {
            titulo = "Otra obra",
            version = await VersionAsync(client, id),
        });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var ficha = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("en_revision", ficha.GetProperty("estadoPublicacion").GetString());
        // LA CATALOGACION NO SE TOCA: lo que cambia es si se ve, no si está bien hecha.
        Assert.Equal("validada", ficha.GetProperty("estadoCatalogacion").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync($"{Publico}/ED-ERR-2")).StatusCode);

        var entrada = (await HistorialAsync(client, id))[0];
        Assert.Equal("CambioDeFondoEnPublicado", entrada.GetProperty("accion").GetString());
        Assert.Equal("publicado", entrada.GetProperty("estadoAnterior").GetString());
        Assert.Equal("en_revision", entrada.GetProperty("estadoNuevo").GetString());
    }

    [Fact]
    public async Task Editar_un_borrador_no_escribe_errata_ni_cambio_de_fondo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await CrearAsync(client, "ED-ERR-3")).GetProperty("id").GetInt64();

        var respuesta = await client.PutAsJsonAsync($"{Consola}/{id}", new { titulo = "Cambio libre", version = 1 });

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Equal("borrador", (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estadoPublicacion").GetString());
        Assert.Empty(await HistorialAsync(client, id));
    }
}
