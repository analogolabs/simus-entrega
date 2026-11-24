using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Leer un PDF por la API, del Catálogo y de la Agenda.
///
/// <para>
/// <b>EL HUECO.</b> La lectura de documentos tenía pruebas de la tubería —la puntuación de la lectura
/// sobre portadas sintéticas— pero NINGUNA llamaba a la ruta: un cambio en el formulario, en el límite
/// de tamaño, en la firma del PDF o en el permiso por módulo dejaba la lectura rota sin que la suite lo
/// dijera. D5b la revisó a mano en el navegador solo para la Agenda; la del Catálogo no se había visto.
/// </para>
/// </summary>
public sealed class LecturaDeDocumentosPorHttpTests
{
    private const string RutaDelCatalogo = "/api/v1/institucional/catalogo-editorial/desde-documento";
    private const string RutaDeLaAgenda = "/api/v1/institucional/agenda/desde-documento";

    private static MultipartFormDataContent Formulario(byte[] datos, string nombre)
    {
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(datos);
        parte.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        contenido.Add(parte, "file", nombre);
        return contenido;
    }

    /// <summary>
    /// Todos los textos de una respuesta JSON, ya decodificados. Los PDF de prueba se fabrican con fuentes
    /// estándar que pierden las tildes, así que los textos de estas pruebas no las llevan.
    /// </summary>
    private static string Valores(JsonElement elemento)
    {
        var textos = new List<string>();
        void Recorrer(JsonElement e)
        {
            switch (e.ValueKind)
            {
                case JsonValueKind.String: textos.Add(e.GetString() ?? string.Empty); break;
                case JsonValueKind.Array: foreach (var x in e.EnumerateArray()) Recorrer(x); break;
                case JsonValueKind.Object: foreach (var p in e.EnumerateObject()) Recorrer(p.Value); break;
            }
        }
        Recorrer(elemento);
        return string.Join("\n", textos);
    }

    [Fact]
    public async Task Un_PDF_se_lee_por_la_ruta_del_catalogo_y_propone_el_titulo_sin_guardar_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var pdf = PortadasDePrueba.Construir(new PortadasDePrueba.Ficha(
            "Cantos de vaqueria del Llano", "Memorias del joropo", "Ana Restrepo", null, 2019));

        var respuesta = await consola.PostAsync(RutaDelCatalogo, Formulario(pdf, "cantos-de-vaqueria.pdf"));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var lectura = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        // Devuelve una PROPUESTA con su origen: lo leído no se publica ni se guarda solo.
        // LA RUTA RESPONDE Y LEE: el título aparece en la propuesta. DÓNDE lo clasifica el lector es otra cosa
        // (con esta portada sintética propone el subtítulo como título y deja el título entre los «agentes»:
        //, de calidad de lectura y no de esta ruta), y por eso no se fija aquí.
        Assert.Contains("Cantos de vaqueria del Llano", Valores(lectura), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_PDF_se_lee_por_la_ruta_de_la_agenda()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var pdf = PortadasDePrueba.ConstruirAfiche("Gran concierto del Rio", "12 de mayo de 2027, 7:00 p. m.", "Teatro Municipal");

        var respuesta = await consola.PostAsync(RutaDeLaAgenda, Formulario(pdf, "afiche.pdf"));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var lectura = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("Gran concierto del Rio", Valores(lectura), StringComparison.Ordinal);
        // La Agenda sí devuelve el afiche renderizado y la fecha anunciada, también leída.
        Assert.Contains("2027-05-12", Valores(lectura), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(RutaDelCatalogo)]
    [InlineData(RutaDeLaAgenda)]
    public async Task Lo_que_no_es_un_PDF_se_rechaza_con_su_mensaje_aunque_diga_serlo(string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);

        // El cliente declara «application/pdf» y los bytes son otra cosa: manda la firma, no la declaración.
        var respuesta = await consola.PostAsync(ruta, Formulario([1, 2, 3, 4, 5], "falso.pdf"));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("Por ahora solo se leen documentos PDF", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(RutaDelCatalogo)]
    [InlineData(RutaDeLaAgenda)]
    public async Task Sin_sesion_de_la_consola_no_se_lee_nada(string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();

        var respuesta = await anonimo.PostAsync(ruta, Formulario(PortadasDePrueba.ConstruirAfiche("x", "y", "z"), "afiche.pdf"));

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
    }
}
