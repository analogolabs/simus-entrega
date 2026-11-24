using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El micrositio «Celebra la música» y sus ediciones históricas.
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que una edición en borrador se vea en el portal; que una edición
/// nueva exija una migración o deje contenido sin poder etiquetarse; que la programación de una
/// edición se mezcle con la de otra; y que la caja de herramientas acepte un recurso sin destino.
/// </para>
/// </summary>
public sealed class CelebraLaMusicaTests
{
    private const string Publico = "/api/v1/publico/celebra-la-musica/ediciones";
    private const string Consola = "/api/v1/institucional/celebra-la-musica/ediciones";

    private static object Edicion(string nombre, bool publicada, bool actual = false, object? recursos = null) => new
    {
        nombre,
        hashtag = "#CelebraLaMúsica",
        publicada,
        actual,
        colorPrincipal = "#e5007e",
        resumen = "Noviembre es el mes de la música.",
        presentacion = "Presentación editable de la edición.",
        actividades = 190,
        categorias = new[] { new { nombre = "Circuitos sonoros", descripcion = "Mercados y música en vivo.", orden = 1 } },
        preguntas = new[] { new { pregunta = "¿Hay que pagar entrada?", respuesta = "La mayoría es gratuita.", orden = 1 } },
        recursos = recursos ?? new[] { new { grupo = "Guías", titulo = "Guía visual", url = "https://example.test/guia.pdf" } },
        fuente = "Fuente: sitio oficial de Celebra la música; PENDIENTE DE VALIDAR por el PNMC.",
        pendienteDeValidar = true,
    };

    [Fact]
    public async Task Una_edicion_en_borrador_no_se_ve_en_el_portal_pero_si_en_la_consola()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var creada = await client.PutAsJsonAsync($"{Consola}/2031", Edicion("Celebra la Música 2031", publicada: false));
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);

        var anonimo = factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"{Publico}/2031")).StatusCode);
        var lista = await (await anonimo.GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, lista.GetProperty("items").GetArrayLength());

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"{Consola}/2031")).StatusCode);

        await client.PutAsJsonAsync($"{Consola}/2031", Edicion("Celebra la Música 2031", publicada: true));
        var publica = await (await anonimo.GetAsync($"{Publico}/2031")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("#E5007E", publica.GetProperty("colorPrincipal").GetString());
        Assert.Equal(1, publica.GetProperty("categorias").GetArrayLength());
        Assert.Equal("https://example.test/guia.pdf", publica.GetProperty("recursos")[0].GetProperty("url").GetString());
    }

    [Fact]
    public async Task Una_edicion_nueva_crea_su_proyecto_y_filtra_solo_su_programacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        await client.PutAsJsonAsync($"{Consola}/2031", Edicion("Celebra la Música 2031", publicada: true));
        await client.PutAsJsonAsync($"{Consola}/2032", Edicion("Celebra la Música 2032", publicada: true));

        var d31 = await (await client.GetAsync($"{Consola}/2031")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("celebra-la-musica-2031", d31.GetProperty("proyectoCodigo").GetString());

        var proyectos = await (await client.GetAsync("/api/v1/institucional/proyectos-transversales")).Content.ReadFromJsonAsync<JsonElement>();
        var id31 = proyectos.GetProperty("items").EnumerateArray()
            .First(x => x.GetProperty("codigo").GetString() == "celebra-la-musica-2031").GetProperty("id").GetInt32();

        var evento = await (await client.PostAsJsonAsync("/api/v1/institucional/agenda", new
        {
            titulo = "Concierto de la edición 2031",
            descripcion = "Evento del PNMC.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Teatro Municipal de Paipa",
            proyectosTransversalesIds = new[] { id31 },
        })).Content.ReadFromJsonAsync<JsonElement>();
        await client.PostAsJsonAsync($"/api/v1/institucional/agenda/{evento.GetProperty("id").GetInt64()}/estado", new { estado = "publicado" });

        var anonimo = factory.CreateClient();
        var de31 = await (await anonimo.GetAsync("/api/v1/publico/agenda?proyecto=celebra-la-musica-2031")).Content.ReadFromJsonAsync<JsonElement>();
        var de32 = await (await anonimo.GetAsync("/api/v1/publico/agenda?proyecto=celebra-la-musica-2032")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, de31.GetProperty("items").GetArrayLength());
        Assert.Equal(0, de32.GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task Solo_hay_una_edicion_vigente()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        await client.PutAsJsonAsync($"{Consola}/2031", Edicion("Celebra la Música 2031", publicada: true, actual: true));
        await client.PutAsJsonAsync($"{Consola}/2032", Edicion("Celebra la Música 2032", publicada: true, actual: true));

        var lista = await (await factory.CreateClient().GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>();
        var vigentes = lista.GetProperty("items").EnumerateArray().Where(x => x.GetProperty("actual").GetBoolean()).ToList();
        Assert.Single(vigentes);
        Assert.Equal(2032, vigentes[0].GetProperty("anio").GetInt32());
    }

    [Fact]
    public async Task Un_recurso_sin_destino_o_con_enlace_inseguro_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var sinDestino = await client.PutAsJsonAsync($"{Consola}/2031",
            Edicion("Celebra la Música 2031", false, recursos: new[] { new { grupo = "Guías", titulo = "Vacío", url = (string?)null } }));
        Assert.Equal(HttpStatusCode.BadRequest, sinDestino.StatusCode);

        var inseguro = await client.PutAsJsonAsync($"{Consola}/2031",
            Edicion("Celebra la Música 2031", false, recursos: new[] { new { grupo = "Guías", titulo = "Inseguro", url = "http://example.test/a.pdf" } }));
        Assert.Equal(HttpStatusCode.BadRequest, inseguro.StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/1999", Edicion("Antigua", false))).StatusCode);
    }

    [Fact]
    public async Task Escribir_exige_sesion_de_la_consola()
    {
        await using var factory = new TestWebApplicationFactory();
        var respuesta = await factory.CreateClient().PutAsJsonAsync($"{Consola}/2031", Edicion("Celebra la Música 2031", true));
        Assert.True(respuesta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
    }

    private static async Task<int> SubirImagenAsync(HttpClient client)
    {
        var png = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
        using var formulario = new MultipartFormDataContent();
        var parte = new ByteArrayContent(png);
        parte.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        formulario.Add(parte, "file", "portada.png");
        formulario.Add(new StringContent("Portada de prueba"), "alt");
        var subida = await client.PostAsync("/api/v1/institucional/archivos", formulario);
        return (await subida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task La_portada_y_la_galeria_se_sirven_al_publico_solo_con_la_edicion_publicada()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var archivo = await SubirImagenAsync(client);
        var anonimo = factory.CreateClient();

        object Con(bool publicada) => new
        {
            nombre = "Celebra la Música 2031", publicada, imagenPortadaArchivoId = archivo,
            galeria = new[] { new { archivoId = archivo, textoAlternativo = "Una imagen", credito = "Fuente: prueba" } },
        };

        // SIN VÍNCULO PÚBLICO EL BANCO RESPONDE 404 A QUIEN NO TIENE SESIÓN: el micrositio mostraría imágenes rotas.
        await client.PutAsJsonAsync($"{Consola}/2031", Con(publicada: false));
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/archivos/{archivo}")).StatusCode);

        await client.PutAsJsonAsync($"{Consola}/2031", Con(publicada: true));
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/archivos/{archivo}")).StatusCode);

        var publica = await (await anonimo.GetAsync($"{Publico}/2031")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Fuente: prueba", publica.GetProperty("galeria")[0].GetProperty("credito").GetString());
    }

    [Fact]
    public async Task El_historial_cuenta_quien_creo_publico_y_dejo_de_marcar_como_vigente()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        await client.PutAsJsonAsync($"{Consola}/2031", Edicion("Celebra la Música 2031", publicada: false));
        await client.PutAsJsonAsync($"{Consola}/2031", Edicion("Celebra la Música 2031", publicada: true, actual: true));
        await client.PutAsJsonAsync($"{Consola}/2032", Edicion("Celebra la Música 2032", publicada: true, actual: true));

        var historial = await (await client.GetAsync($"{Consola}/2031/historial")).Content.ReadFromJsonAsync<JsonElement>();
        var resumenes = historial.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("resumen").GetString()).ToList();
        Assert.Contains("Creó la edición.", resumenes);
        Assert.Contains("Actualizó el contenido; la publicó; la marcó como vigente.", resumenes);
        Assert.NotNull(historial.GetProperty("items")[0].GetProperty("usuario").GetString());

        var detalle = await (await client.GetAsync($"{Consola}/2031")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(JsonValueKind.Null, detalle.GetProperty("fechaActualizacion").ValueKind);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{Consola}/2040/historial")).StatusCode);
    }

    [Fact]
    public async Task Una_imagen_de_la_galeria_sin_credito_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var archivo = await SubirImagenAsync(client);

        var respuesta = await client.PutAsJsonAsync($"{Consola}/2031", new
        {
            nombre = "Celebra la Música 2031", publicada = false,
            galeria = new[] { new { archivoId = archivo, textoAlternativo = "Una imagen", credito = " " } },
        });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("crédito", await respuesta.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }
}
