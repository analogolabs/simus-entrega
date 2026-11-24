using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// carril rápido (SQLite): el estado <c>rechazado</c> de Noticias y Agenda
/// y el registro de fuentes del Catálogo Editorial.
/// </summary>
/// <remarks>
/// El mismo recorrido corre contra SQL Server en <see cref="AccionesPorEstadoSqlServerTests"/>,
/// que es donde se comprueban las restricciones CHECK y el JSON de la bitácora.
/// </remarks>
public sealed class RechazoYFuentesEditorialesTests
{
    private const string Noticias = "/api/v1/institucional/noticias";
    private const string Agenda = "/api/v1/institucional/agenda";
    private const string Catalogo = "/api/v1/institucional/catalogo-editorial";
    private static readonly DateOnly Hoy = DateOnly.FromDateTime(DateTime.UtcNow);

    private static async Task<long> NoticiaEnRevisionAsync(HttpClient client, string titulo)
    {
        var creada = await (await client.PostAsJsonAsync(Noticias, new
        {
            titulo,
            resumen = "Resumen de la noticia.",
            cuerpo = "Cuerpo de la noticia institucional.",
            fechaPublicacion = Hoy,
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creada.GetProperty("id").GetInt64();
        (await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "en_revision" })).EnsureSuccessStatusCode();
        return id;
    }

    private static async Task<long> EventoEnRevisionAsync(HttpClient client, string titulo)
    {
        var creado = await (await client.PostAsJsonAsync(Agenda, new
        {
            titulo,
            descripcion = "Evento de la consola.",
            fechaInicio = Hoy.AddDays(5),
            modalidad = "presencial",
            lugar = "Teatro Municipal",
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creado.GetProperty("id").GetInt64();
        (await client.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "en_revision" })).EnsureSuccessStatusCode();
        return id;
    }

    [Fact]
    public async Task Rechazar_una_noticia_la_deja_rechazada_y_no_archivada()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await NoticiaEnRevisionAsync(client, "Noticia que se rechaza");

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "rechazado" })).StatusCode);
        var rechazada = await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "rechazado", motivo = "No cumple la línea editorial." });
        rechazada.EnsureSuccessStatusCode();

        Assert.Equal("rechazado", (await rechazada.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());
        var historial = await client.GetFromJsonAsync<List<SIMUS.Contracts.EntradaDeHistorialDeEstadosDto>>($"{Noticias}/{id}/historial");
        Assert.Equal("Rechazado", historial![0].AccionEtiqueta);
        Assert.Equal("No cumple la línea editorial.", historial[0].Motivo);
    }

    [Fact]
    public async Task Rechazar_solo_se_puede_lo_que_esta_en_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var creada = await (await client.PostAsJsonAsync(Noticias, new
        {
            titulo = "Borrador que nadie envió",
            resumen = "Resumen.",
            cuerpo = "Cuerpo.",
            fechaPublicacion = Hoy,
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creada.GetProperty("id").GetInt64();

        var intento = await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "rechazado", motivo = "No." });

        Assert.Equal(HttpStatusCode.BadRequest, intento.StatusCode);
        Assert.Contains("en revisión", await intento.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Una_noticia_rechazada_puede_reabrirse_como_borrador()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await NoticiaEnRevisionAsync(client, "Noticia que vuelve");
        (await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "rechazado", motivo = "Falta una fuente." })).EnsureSuccessStatusCode();

        var reabierta = await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "borrador" });

        reabierta.EnsureSuccessStatusCode();
        Assert.Equal("borrador", (await reabierta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());
    }

    [Fact]
    public async Task Rechazar_un_evento_lo_deja_rechazado_con_su_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await EventoEnRevisionAsync(client, "Evento que se rechaza");

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "rechazado" })).StatusCode);
        (await client.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "rechazado", motivo = "Ya existe en la agenda." }))
            .EnsureSuccessStatusCode();

        Assert.Equal("rechazado", (await client.GetFromJsonAsync<JsonElement>($"{Agenda}/{id}")).GetProperty("estado").GetString());
        var historial = await client.GetFromJsonAsync<List<SIMUS.Contracts.EntradaDeHistorialDeEstadosDto>>($"{Agenda}/{id}/historial");
        Assert.Equal("Ya existe en la agenda.", historial![0].Motivo);
    }

    // ─────────────────────────── Fuentes del Catálogo Editorial ───────────────────────────

    private static async Task<(long Id, int Version)> FichaNuevaAsync(HttpClient client, string codigo)
    {
        var respuesta = await client.PostAsJsonAsync(Catalogo, new { codigo, titulo = "Ficha sin fuentes" });
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        var ficha = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        return (ficha.GetProperty("id").GetInt64(), ficha.GetProperty("version").GetInt32());
    }

    [Fact]
    public async Task Una_ficha_nueva_se_publica_tras_registrar_su_fuente_desde_la_consola()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var (id, version) = await FichaNuevaAsync(client, "ED-FUE-1");

        // SIN FUENTE, «publicar» dice qué falta (y ya no solo «no fue posible»).
        var sinFuente = await client.PostAsJsonAsync($"{Catalogo}/{id}/publicacion", new { estado = "publicado" });
        Assert.Equal(HttpStatusCode.BadRequest, sinFuente.StatusCode);
        Assert.Contains("ninguna fuente", await sinFuente.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var registrada = await client.PostAsJsonAsync($"{Catalogo}/{id}/fuentes", new
        {
            version,
            nombre = "Archivo Histórico del Cauca",
            referencia = "Caja 12, folio 4",
            url = "https://archivo.example.org/caja-12",
            fechaFuente = "2024-03-05",
        });
        registrada.EnsureSuccessStatusCode();
        var ficha = await registrada.Content.ReadFromJsonAsync<JsonElement>();
        var fuente = Assert.Single(ficha.GetProperty("fuentes").EnumerateArray());
        Assert.Equal("Archivo Histórico del Cauca", fuente.GetProperty("nombre").GetString());
        // QUIÉN LA VERIFICÓ LO PONE EL SERVIDOR.
        Assert.False(string.IsNullOrWhiteSpace(fuente.GetProperty("verificadaPor").GetString()));
        // LA FECHA DE CALENDARIO NO SE CORRE DE DÍA EN BOGOTÁ (mediodía UTC).
        Assert.StartsWith("2024-03-05T12:00:00", fuente.GetProperty("fechaFuente").GetString(), StringComparison.Ordinal);
        var versionNueva = ficha.GetProperty("version").GetInt32();
        Assert.True(versionNueva > version);

        (await client.PutAsJsonAsync($"{Catalogo}/{id}/derechos", new
        {
            version = versionNueva,
            ficha = new
            {
                estado = "verificado",
                permitePublicarFicha = true,
                permitePublicarArchivo = false,
                licenciaONota = "CC BY-NC 4.0",
                fuenteId = fuente.GetProperty("id").GetInt64(),
            },
        })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"{Catalogo}/{id}/catalogacion", new { estado = "validada" })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"{Catalogo}/{id}/publicacion", new { estado = "publicado" })).EnsureSuccessStatusCode();

        var historial = (await (await client.GetAsync($"{Catalogo}/{id}/historial")).Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Contains(historial, h => h.GetProperty("accion").GetString() == "FuenteRegistrada");
    }

    [Fact]
    public async Task La_fuente_se_corrige_con_historial_y_pide_la_version_vigente()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var (id, version) = await FichaNuevaAsync(client, "ED-FUE-2");
        var ficha = await (await client.PostAsJsonAsync($"{Catalogo}/{id}/fuentes", new { version, nombre = "Fuente inicial", referencia = "Ref. 1" }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var fuenteId = ficha.GetProperty("fuentes")[0].GetProperty("id").GetInt64();
        var perfilPublico = ficha.GetProperty("version").GetInt32();

        // CON LA VERSIÓN VIEJA, 409.
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"{Catalogo}/{id}/fuentes/{fuenteId}", new { version, nombre = "X", referencia = "Y" })).StatusCode);

        var corregida = await client.PutAsJsonAsync($"{Catalogo}/{id}/fuentes/{fuenteId}", new
        {
            version = perfilPublico,
            nombre = "Fuente corregida",
            referencia = "Ref. 2",
        });
        corregida.EnsureSuccessStatusCode();
        Assert.Equal("Fuente corregida",
            (await corregida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("fuentes")[0].GetProperty("nombre").GetString());
        var historial = (await (await client.GetAsync($"{Catalogo}/{id}/historial")).Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToList();
        Assert.Contains(historial, h => h.GetProperty("accion").GetString() == "FuenteCorregida");

        // UNA FUENTE QUE LA FICHA NO CITA NO SE TOCA DESDE ELLA.
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync($"{Catalogo}/{id}/fuentes/999999", new { version = perfilPublico + 1, nombre = "Z", referencia = "R" })).StatusCode);
    }

    [Theory]
    [InlineData("", "Ref.", null, "nombre")]
    [InlineData("Fuente", null, null, "referencia")]
    [InlineData("Fuente", "Ref.", "ftp://raro.example.org", "url")]
    public async Task Una_fuente_incompleta_se_rechaza_con_el_campo_que_falta(string nombre, string? referencia, string? url, string campo)
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var (id, version) = await FichaNuevaAsync(client, "ED-FUE-3");

        var respuesta = await client.PostAsJsonAsync($"{Catalogo}/{id}/fuentes", new { version, nombre, referencia, url });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        var errores = (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        Assert.True(errores.TryGetProperty(campo, out _), $"Debía señalar «{campo}»: {errores}");
    }
}
