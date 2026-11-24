using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El banco de archivos: subir una imagen de verdad.
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que entre al banco algo que no es una imagen, y que entre una
/// imagen sin texto alternativo. Las dos cosas se comprueban EN ESTE ORDEN a propósito: el orden
/// de las comprobaciones es el orden en que se le dicen los problemas a quien sube, y avisar del
/// formato antes que de la alternativa manda a alguien a reconvertir un fichero que estaba bien.
/// </para>
/// </summary>
public sealed class BancoDeArchivosTests
{
    private const string Ruta = "/api/v1/institucional/archivos";

    /// <summary>Un PNG de un píxel, con su firma y su CRC correctos. Los bytes son el dato.</summary>
    private static byte[] PngDeUnPixel() => Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent Formulario(
        byte[] datos, string nombre = "prueba.png", string? alt = "Una imagen de prueba", string? tipo = "image/png")
    {
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(datos);
        if (tipo is not null) parte.Headers.ContentType = new MediaTypeHeaderValue(tipo);
        contenido.Add(parte, "file", nombre);
        if (alt is not null) contenido.Add(new StringContent(alt), "alt");
        return contenido;
    }

    [Fact]
    public async Task Subir_exige_sesion_institucional()
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();

        var respuesta = await anonimo.PostAsync(Ruta, Formulario(PngDeUnPixel()));

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
    }

    [Fact]
    public async Task Una_imagen_valida_con_alternativa_entra_al_banco()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var respuesta = await client.PostAsync(Ruta, Formulario(PngDeUnPixel()));

        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        var archivo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(archivo.GetProperty("id").GetInt32() > 0);
        Assert.Equal("image/png", archivo.GetProperty("tipo").GetString());
        Assert.Equal("Una imagen de prueba", archivo.GetProperty("alt").GetString());
        // EL ANCHO Y EL ALTO SALEN DE LOS BYTES, no de lo que diga nadie.
        Assert.Equal(1, archivo.GetProperty("ancho").GetInt32());
    }

    [Fact]
    public async Task Sin_texto_alternativo_no_se_sube_aunque_la_imagen_sea_valida()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var respuesta = await client.PostAsync(Ruta, Formulario(PngDeUnPixel(), alt: null));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("texto alternativo", await respuesta.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Un_archivo_demasiado_grande_dice_cuanto_pesa_y_cuanto_se_admite_en_MB()
    {
        // EL DEFECTO (D5-12): «El archivo pesa 11534406 bytes y el máximo es 2097152.» Quien sube una
        // foto no sabe cuánto es eso ni cuánto tiene que reducir; ahora lo lee en MB.
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var grande = new byte[11 * 1024 * 1024 + 4096];
        PngDeUnPixel().CopyTo(grande, 0);

        var respuesta = await client.PostAsync(Ruta, Formulario(grande));

        // S-08: el tope de la petición se aplica antes de leer el formulario, y responde 413.
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, respuesta.StatusCode);
        var texto = await respuesta.Content.ReadAsStringAsync();
        Assert.Contains("pesa 11 MB", texto, StringComparison.Ordinal);
        Assert.Contains("máximo es 2 MB", texto, StringComparison.Ordinal);
        Assert.DoesNotContain("bytes", texto, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Lo_que_no_es_una_imagen_no_entra_aunque_se_llame_png()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        // NO BASTA CON LA EXTENSION: se reconoce por la firma de los bytes, que es lo que separa
        // una imagen de un ejecutable con la cabecera pegada delante.
        var basura = System.Text.Encoding.UTF8.GetBytes("MZ esto no es una imagen, es otra cosa");

        var respuesta = await client.PostAsync(Ruta, Formulario(basura, "trampa.png", tipo: null));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task El_alternativo_se_exige_ANTES_que_el_formato()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        // Un fichero que falla por las DOS cosas: ni es imagen ni trae alternativa.
        var basura = System.Text.Encoding.UTF8.GetBytes("tampoco es una imagen");

        var respuesta = await client.PostAsync(Ruta, Formulario(basura, "x.png", alt: null, tipo: null));
        var cuerpo = await respuesta.Content.ReadAsStringAsync();

        // AVISAR DEL FORMATO PRIMERO mandaría a alguien a reconvertir un fichero cuando lo que
        // falta es una línea de texto. El orden importa y por eso se fija.
        Assert.Contains("alt", cuerpo, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("WebP", cuerpo, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Un_tipo_declarado_que_no_coincide_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        // Mentir sobre el tipo es una señal, no un descuido que haya que corregir en silencio.
        var respuesta = await client.PostAsync(Ruta, Formulario(PngDeUnPixel(), tipo: "image/jpeg"));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task El_mismo_archivo_no_se_guarda_dos_veces()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var primera = await (await client.PostAsync(Ruta, Formulario(PngDeUnPixel()))).Content.ReadFromJsonAsync<JsonElement>();
        var segunda = await client.PostAsync(Ruta, Formulario(PngDeUnPixel(), "otro-nombre.png"));

        // REUTILIZAR LA PORTADA DE UN EVENTO EN OTRO no debe duplicar dos megas en la base.
        Assert.Equal(HttpStatusCode.OK, segunda.StatusCode);
        var repetida = await segunda.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(primera.GetProperty("id").GetInt32(), repetida.GetProperty("id").GetInt32());
    }

    /// <summary>
    /// El archivo se sirve con su ETag, para que el navegador no se lo vuelva a bajar.
    /// </summary>
    /// <remarks>
    /// ESTA PRUEBA SE LLAMABA «se sirve a cualquiera» Y NO MEDIA ESO. Su comentario decía «un
    /// archivo de un evento PUBLICADO tiene que poder verlo cualquiera», pero no publicaba nada:
    /// subía un archivo suelto y comprobaba que un anónimo lo bajaba, que es la enumeración del
    /// banco entero. Lo que de verdad fija es el ETag, y eso es lo que mide ahora. Quién puede
    /// verlo lo fijan `Un_archivo_sin_usar_no_se_sirve_a_quien_no_ha_entrado` y su gemela del canal
    /// externo, que sí vincula el archivo antes de esperar que se sirva.
    /// </remarks>
    [Fact]
    public async Task El_archivo_se_sirve_con_su_ETag()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var subida = await (await client.PostAsync(Ruta, Formulario(PngDeUnPixel()))).Content.ReadFromJsonAsync<JsonElement>();
        var id = subida.GetProperty("id").GetInt32();

        var respuesta = await client.GetAsync($"/api/v1/publico/archivos/{id}");

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Equal("image/png", respuesta.Content.Headers.ContentType?.MediaType);
        // SIN ETAG, CADA CARGA DEL PORTAL SE TRAE EL ACERVO ENTERO.
        Assert.NotNull(respuesta.Headers.ETag);
    }

    /// <summary>
    /// Revalidar con el ETag responde 304 sin cuerpo (y sin leer el contenido), con la misma política de caché
    /// que la respuesta completa; y un ETag acertado NO salta el permiso.
    /// </summary>
    /// <remarks>
    /// <b>OPTIMIZACIÓN, 20 NOV 2026.</b> `Servir` leía el BLOB entero antes de mirar `If-None-Match`; ahora decide
    /// permiso y ETag con una consulta de metadatos. Lo que hay que impedir es que, al reordenar, el 304 se
    /// responda ANTES de comprobar quién pide: quien conociera el ETag de un archivo sin publicar (la huella es
    /// el hash del contenido) se enteraría de que existe.
    /// </remarks>
    [Fact]
    public async Task Revalidar_con_el_ETag_responde_304_y_no_salta_el_permiso()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var subida = await (await client.PostAsync(Ruta, Formulario(PngDeUnPixel()))).Content.ReadFromJsonAsync<JsonElement>();
        var id = subida.GetProperty("id").GetInt32();
        var url = $"/api/v1/publico/archivos/{id}";

        var completa = await client.GetAsync(url);
        var etag = completa.Headers.ETag;
        Assert.NotNull(etag);
        // Con sesión nunca queda en una caché compartida.
        Assert.Contains("private", completa.Headers.CacheControl?.ToString() ?? string.Empty);

        var revalidada = new HttpRequestMessage(HttpMethod.Get, url);
        revalidada.Headers.IfNoneMatch.Add(etag!);
        var respuesta = await client.SendAsync(revalidada);
        Assert.Equal(HttpStatusCode.NotModified, respuesta.StatusCode);
        Assert.Equal(0, (await respuesta.Content.ReadAsByteArrayAsync()).Length);
        Assert.Equal(etag, respuesta.Headers.ETag);

        // Un ETag que ya no corresponde trae el contenido completo.
        var otra = new HttpRequestMessage(HttpMethod.Get, url);
        otra.Headers.IfNoneMatch.Add(new EntityTagHeaderValue("\"otra-huella\""));
        var distinta = await client.SendAsync(otra);
        Assert.Equal(HttpStatusCode.OK, distinta.StatusCode);
        Assert.True((await distinta.Content.ReadAsByteArrayAsync()).Length > 0);

        // El archivo no lo usa nadie: un anónimo con el ETag correcto sigue recibiendo 404, no 304.
        var anonimo = factory.CreateClient();
        var intento = new HttpRequestMessage(HttpMethod.Get, url);
        intento.Headers.IfNoneMatch.Add(etag!);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.SendAsync(intento)).StatusCode);
    }

    /// <summary>
    /// Un archivo que no usa nadie no se sirve a quien no ha entrado.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>LO QUE ESTO IMPIDE, MEDIDO EL 13 DE SEPTIEMBRE DE 2026.</b> La ruta de lectura era
    /// anónima para TODO el banco y los identificadores son enteros consecutivos, así que
    /// <c>GET /api/v1/publico/archivos/1..N</c> bajaba el acervo entero. Entre lo que devolvía
    /// estaba el afiche de una Edición que nunca se publicó, subido por una organización, y que
    /// además había quedado huérfano porque el formulario se abandonó sin guardar.
    /// </para>
    /// <para>
    /// LA REGLA ES LA VINCULACION Y NO UNA BANDERA: un archivo es público si está usado en algo que
    /// el público ya ve. Recién subido no lo usa nadie, así que no lo es.
    /// </para>
    /// </remarks>
    [Fact]
    public async Task Un_archivo_sin_usar_no_se_sirve_a_quien_no_ha_entrado()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var creado = await (await client.PostAsync(Ruta, Formulario(PngDeUnPixel()))).Content.ReadFromJsonAsync<JsonElement>();
        var id = creado.GetProperty("id").GetInt32();

        var anonimo = factory.CreateClient();
        var sinSesion = await anonimo.GetAsync($"/api/v1/publico/archivos/{id}");
        var conSesion = await client.GetAsync($"/api/v1/publico/archivos/{id}");

        // 404 Y NO 403: un 403 confirma que existe, que es justo lo que no hay que confirmarle a
        // quien está recorriendo identificadores.
        Assert.Equal(HttpStatusCode.NotFound, sinSesion.StatusCode);
        // Y EL EQUIPO DEL PNMC SI LO VE: responde por el banco.
        Assert.Equal(HttpStatusCode.OK, conSesion.StatusCode);
    }

    /// <summary>
    /// El banco se puede mirar, y dice qué hay dentro y qué no usa nadie.
    /// </summary>
    [Fact]
    public async Task El_banco_se_puede_listar_y_senala_lo_que_no_usa_nadie()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        await client.PostAsync(Ruta, Formulario(PngDeUnPixel()));

        var listado = await (await client.GetAsync(Ruta)).Content.ReadFromJsonAsync<JsonElement>();
        var primero = listado.GetProperty("items").EnumerateArray().First();

        Assert.True(listado.GetProperty("total").GetInt32() >= 1);
        // RECIEN SUBIDO NO LO USA NADIE, y esa es la cifra que de verdad hace falta: los que ocupan
        // espacio sin que nadie los eche de menos.
        Assert.True(primero.GetProperty("huerfano").GetBoolean());
        Assert.False(primero.GetProperty("visiblePublicamente").GetBoolean());
        // NULO ES INSTITUCIONAL: la procedencia no es lo mismo que quién lo subió.
        Assert.Equal("institucional", primero.GetProperty("procedencia").GetString());
    }

    /// <summary>
    /// Lo que no usa nadie se puede retirar; lo que usa alguien, no.
    /// </summary>
    /// <remarks>
    /// EL MENSAJE DE CUOTA PROMETIA ESTO Y NO EXISTIA. Cuando una organización llenaba su espacio
    /// se le decía «retira material que ya no uses», y no había ninguna forma de retirarlo.
    /// </remarks>
    [Fact]
    public async Task Un_archivo_que_no_usa_nadie_se_puede_retirar()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var creado = await (await client.PostAsync(Ruta, Formulario(PngDeUnPixel()))).Content.ReadFromJsonAsync<JsonElement>();
        var id = creado.GetProperty("id").GetInt32();

        var retirado = await client.DeleteAsync($"{Ruta}/{id}");
        Assert.Equal(HttpStatusCode.NoContent, retirado.StatusCode);

        // Y DEJA DE ESTAR: retirar es retirar, no esconder.
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{Ruta}/{id}")).StatusCode);
    }

    /// <summary>
    /// Los mismos bytes por dos dueños distintos son dos archivos, cada uno con su descripción.
    /// </summary>
    /// <remarks>
    /// <b>LA DEDUPLICACION ERA GLOBAL Y ESO CRUZABA ORGANIZACIONES.</b> Si una organización subía
    /// los mismos bytes que ya había subido otra, se le devolvía el archivo DE LA OTRA: con su
    /// texto alternativo, su crédito y su procedencia. Acababa enseñando en su ficha una
    /// descripción que no escribió y que no podía corregir, y la cuota se le seguía cobrando a la
    /// primera. Dentro de un mismo dueño sí se reutiliza, que es para lo que estaba pensado.
    /// </remarks>
    [Fact]
    public async Task El_mismo_archivo_se_reutiliza_dentro_de_su_dueno()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var primera = await (await client.PostAsync(Ruta, Formulario(PngDeUnPixel(), alt: "La primera descripción")))
            .Content.ReadFromJsonAsync<JsonElement>();
        var segunda = await (await client.PostAsync(Ruta, Formulario(PngDeUnPixel(), alt: "Otra descripción distinta")))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(primera.GetProperty("id").GetInt32(), segunda.GetProperty("id").GetInt32());
        // LA DESCRIPCION NUEVA SE APLICA Y SE AVISA (D5-06). Es el mismo archivo y quien lo sube es
        // su dueño: antes la nueva se descartaba en silencio y la persona creía haberla cambiado.
        Assert.Equal("Otra descripción distinta", segunda.GetProperty("alt").GetString());
        Assert.True(segunda.GetProperty("descripcionActualizada").GetBoolean());
        Assert.Equal("Ya tenías esta imagen; actualicé su descripción.", segunda.GetProperty("aviso").GetString());
    }

    [Fact]
    public async Task Subir_la_misma_imagen_con_la_misma_descripcion_no_avisa_ni_cambia_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        await client.PostAsync(Ruta, Formulario(PngDeUnPixel(), alt: "La misma descripción"));
        var segunda = await (await client.PostAsync(Ruta, Formulario(PngDeUnPixel(), alt: "La misma descripción")))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("La misma descripción", segunda.GetProperty("alt").GetString());
        Assert.False(segunda.TryGetProperty("descripcionActualizada", out _));
    }
}
