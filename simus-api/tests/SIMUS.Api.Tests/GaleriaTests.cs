using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La Galería pública: álbumes de fotos, de videos y mixtos.
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que un álbum en borrador (o sus fotos) se vea en el portal; que un álbum
/// de fotos acepte videos o al revés; que un video se guarde con un identificador que no es de YouTube
/// (se compone una dirección con él); que se publique un álbum vacío; y que escribir no exija sesión.
/// </para>
/// </summary>
public sealed class GaleriaTests
{
    private const string Publico = "/api/v1/publico/galeria/albumes";
    private const string Consola = "/api/v1/institucional/galeria/albumes";

    private static object Video(string id = "Rv5Oiq8UXi0", string titulo = "Voces y Saberes: Carlos Delgado") => new
    {
        tipoItem = "video", videoId = id, titulo, descripcion = "Músico campesino.", fecha = "2026-08-06", duracionSegundos = 377,
    };

    private static object Foto(int archivo) => new { tipoItem = "foto", archivoId = archivo, textoAlternativo = "Una foto", credito = "Archivo PNMC" };

    private static object Album(string tipo, bool publicado, object[] items, string? lista = null) => new
    {
        titulo = "Voces y Saberes", descripcion = "Serie de entrevistas.", tipo, publicado, listaOrigenUrl = lista, items,
    };

    /// <summary>Un PNG de 1×1 de un color dado: el Banco no guarda dos veces el mismo contenido (huella), así que cada foto de prueba lleva el suyo.</summary>
    private static byte[] Png(byte rojo, byte verde, byte azul)
    {
        static uint Crc(byte[] datos)
        {
            var c = 0xFFFFFFFFu;
            foreach (var b in datos)
            {
                c ^= b;
                for (var k = 0; k < 8; k++) c = (c & 1) != 0 ? (c >> 1) ^ 0xEDB88320u : c >> 1;
            }
            return ~c;
        }
        static void Trozo(MemoryStream s, string tipo, byte[] cuerpo)
        {
            var t = System.Text.Encoding.ASCII.GetBytes(tipo).Concat(cuerpo).ToArray();
            s.Write(BitConverter.GetBytes(System.Net.IPAddress.HostToNetworkOrder(cuerpo.Length)));
            s.Write(t);
            s.Write(BitConverter.GetBytes(System.Net.IPAddress.HostToNetworkOrder((int)Crc(t))));
        }
        using var salida = new MemoryStream();
        salida.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        Trozo(salida, "IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
        using var datos = new MemoryStream();
        using (var z = new System.IO.Compression.ZLibStream(datos, System.IO.Compression.CompressionLevel.Optimal, true)) z.Write([0, rojo, verde, azul]);
        Trozo(salida, "IDAT", datos.ToArray());
        Trozo(salida, "IEND", []);
        return salida.ToArray();
    }

    private static int _color;

    private static async Task<int> SubirImagenAsync(HttpClient client)
    {
        var png = Png((byte)(Interlocked.Increment(ref _color) % 250), 40, 90);
        using var formulario = new MultipartFormDataContent();
        var parte = new ByteArrayContent(png);
        parte.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        formulario.Add(parte, "file", "foto.png");
        formulario.Add(new StringContent("Foto de prueba"), "alt");
        var subida = await client.PostAsync("/api/v1/institucional/archivos", formulario);
        return (await subida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Un_album_en_borrador_no_se_ve_en_el_portal_pero_si_en_la_consola()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var anonimo = factory.CreateClient();

        var creado = await client.PutAsJsonAsync($"{Consola}/voces-y-saberes", Album("videos", false, [Video()]));
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"{Publico}/voces-y-saberes")).StatusCode);
        Assert.Equal(0, (await (await anonimo.GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").GetArrayLength());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"{Consola}/voces-y-saberes")).StatusCode);

        await client.PutAsJsonAsync($"{Consola}/voces-y-saberes", Album("videos", true, [Video()], "https://youtube.com/playlist?list=PLhJl63hJ1X-aOJwZE6rQrzeOutfDtu2C8"));
        var publico = await (await anonimo.GetAsync($"{Publico}/voces-y-saberes")).Content.ReadFromJsonAsync<JsonElement>();
        var item = publico.GetProperty("items")[0];
        Assert.Equal("Rv5Oiq8UXi0", item.GetProperty("videoId").GetString());
        Assert.Equal("https://www.youtube.com/watch?v=Rv5Oiq8UXi0", item.GetProperty("urlYoutube").GetString());
        Assert.Equal(377, item.GetProperty("duracionSegundos").GetInt32());
        Assert.Contains("playlist", publico.GetProperty("listaOrigenUrl").GetString());
    }

    [Fact]
    public async Task El_listado_publico_cuenta_fotos_y_videos_y_filtra_por_tipo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var foto = await SubirImagenAsync(client);
        await client.PutAsJsonAsync($"{Consola}/fotos", Album("fotos", true, [Foto(foto)]));
        await client.PutAsJsonAsync($"{Consola}/videos", Album("videos", true, [Video("Rv5Oiq8UXi0"), Video("FqTfFxwH8QA", "Voces y Saberes: Petrona Martínez")]));
        await client.PutAsJsonAsync($"{Consola}/mixto", Album("mixto", true, [Foto(foto), Video("MHIY0k8ZCmY", "Voces y Saberes: Beatriz Castaño")]));
        var anonimo = factory.CreateClient();

        var todos = await (await anonimo.GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, todos.GetProperty("totales").GetProperty("albumes").GetInt32());
        Assert.Equal(2, todos.GetProperty("totales").GetProperty("fotos").GetInt32());
        Assert.Equal(3, todos.GetProperty("totales").GetProperty("videos").GetInt32());

        var soloVideos = await (await anonimo.GetAsync($"{Publico}?tipo=videos")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, soloVideos.GetProperty("items").GetArrayLength());
        Assert.Equal("videos", soloVideos.GetProperty("items")[0].GetProperty("tipo").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await anonimo.GetAsync($"{Publico}?tipo=otro")).StatusCode);
    }

    [Fact]
    public async Task Las_fotos_de_un_album_se_sirven_al_publico_solo_con_el_album_publicado()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var foto = await SubirImagenAsync(client);
        var anonimo = factory.CreateClient();

        await client.PutAsJsonAsync($"{Consola}/fotos", Album("fotos", false, [Foto(foto)]));
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/archivos/{foto}")).StatusCode);

        await client.PutAsJsonAsync($"{Consola}/fotos", Album("fotos", true, [Foto(foto)]));
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/archivos/{foto}")).StatusCode);
        var publico = await (await anonimo.GetAsync($"{Publico}/fotos")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.EndsWith($"/publico/archivos/{foto}", publico.GetProperty("portadaUrl").GetString());
    }

    [Fact]
    public async Task Los_items_deben_corresponder_al_tipo_y_llevar_datos_validos()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var foto = await SubirImagenAsync(client);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("fotos", false, [Video()]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("videos", false, [Foto(foto)]))).StatusCode);
        // Un identificador que no es de YouTube (con un salto de ruta, por ejemplo) no se guarda.
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("videos", false, [Video("../../evil/x")]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("videos", false, [Video("corto")]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("videos", false, [Video("Rv5Oiq8UXi0"), Video("Rv5Oiq8UXi0")]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("fotos", false, [Foto(987654)]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("otro", false, []))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("videos", false, [Video()], "http://example.test/lista"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/Mala Clave", Album("videos", false, [Video()]))).StatusCode);
    }

    [Fact]
    public async Task No_se_publica_un_album_vacio_ni_un_mixto_con_una_sola_clase()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/vacio", Album("fotos", true, []))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/mixto", Album("mixto", true, [Video()]))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PutAsJsonAsync($"{Consola}/mixto", Album("mixto", false, [Video()]))).StatusCode);
    }

    [Fact]
    public async Task Escribir_exige_sesion_de_la_consola_y_leer_la_consola_tambien()
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();
        var escribir = await anonimo.PutAsJsonAsync($"{Consola}/voces", Album("videos", true, [Video()]));
        Assert.True(escribir.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
        var leer = await anonimo.GetAsync(Consola);
        Assert.True(leer.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
    }

    private const string Sueltos = "/api/v1/institucional/galeria/sin-album";

    private static object VideoConMiniatura(int miniatura, string id = "Rv5Oiq8UXi0") => new
    {
        tipoItem = "video", videoId = id, titulo = "Voces y Saberes: Carlos Delgado", descripcion = "Resumen.", detalle = "Texto completo de la descripción.", duracionSegundos = 377, miniaturaArchivoId = miniatura,
    };

    [Fact]
    public async Task La_miniatura_de_un_video_es_un_archivo_propio_publico_solo_con_el_album_publicado_y_sirve_de_portada()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var anonimo = factory.CreateClient();
        var miniatura = await SubirImagenAsync(client);

        await client.PutAsJsonAsync($"{Consola}/voces", Album("videos", false, [VideoConMiniatura(miniatura)]));
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/archivos/{miniatura}")).StatusCode);

        await client.PutAsJsonAsync($"{Consola}/voces", Album("videos", true, [VideoConMiniatura(miniatura)]));
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/archivos/{miniatura}")).StatusCode);
        var album = await (await anonimo.GetAsync($"{Publico}/voces")).Content.ReadFromJsonAsync<JsonElement>();
        var item = album.GetProperty("items")[0];
        Assert.EndsWith($"/publico/archivos/{miniatura}", item.GetProperty("miniaturaUrl").GetString());
        Assert.Equal("Texto completo de la descripción.", item.GetProperty("detalle").GetString());
        // Sin foto, la portada del álbum de videos es la miniatura de su primer video: nada de YouTube.
        Assert.EndsWith($"/publico/archivos/{miniatura}", album.GetProperty("portadaUrl").GetString());
        Assert.DoesNotContain("ytimg", album.ToString());
    }

    [Fact]
    public async Task Una_miniatura_solo_va_en_un_video_y_debe_existir_en_el_banco()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var foto = await SubirImagenAsync(client);
        var conMiniatura = new { tipoItem = "foto", archivoId = foto, textoAlternativo = "Una foto", miniaturaArchivoId = foto };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("fotos", false, [conMiniatura]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("videos", false, [VideoConMiniatura(987654)]))).StatusCode);
    }

    [Fact]
    public async Task Los_items_sin_album_se_guardan_aparte_y_se_ven_solo_si_estan_publicados()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var anonimo = factory.CreateClient();
        var visible = await SubirImagenAsync(client);
        var oculta = await SubirImagenAsync(client);
        object[] items =
        [
            new { tipoItem = "foto", archivoId = visible, textoAlternativo = "Suelta visible", publicado = true },
            new { tipoItem = "foto", archivoId = oculta, textoAlternativo = "Suelta oculta", publicado = false },
            new { tipoItem = "video", videoId = "ahrHwtptkoA", titulo = "Un video suelto", publicado = true },
        ];
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(Sueltos, new { items })).StatusCode);

        var lista = await (await anonimo.GetAsync("/api/v1/publico/galeria/items?clase=sueltos")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, lista.GetProperty("total").GetInt32());
        Assert.All(lista.GetProperty("items").EnumerateArray(), i => Assert.Equal(JsonValueKind.Null, i.GetProperty("albumSlug").ValueKind));
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/archivos/{visible}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/archivos/{oculta}")).StatusCode);

        var totales = (await (await anonimo.GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("totales");
        Assert.Equal(2, totales.GetProperty("sueltos").GetInt32());
        Assert.Equal(1, totales.GetProperty("fotos").GetInt32());
        Assert.Equal(1, totales.GetProperty("videos").GetInt32());
        // Un ítem suelto no inventa un álbum: el listado de álbumes sigue vacío.
        Assert.Equal(0, (await (await anonimo.GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task Los_items_por_clase_traen_su_album_las_medidas_y_se_paginan()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var anonimo = factory.CreateClient();
        var f1 = await SubirImagenAsync(client);
        var f2 = await SubirImagenAsync(client);
        await client.PutAsJsonAsync($"{Consola}/fotos", Album("fotos", true, [Foto(f1), Foto(f2)]));
        await client.PutAsJsonAsync($"{Consola}/borrador", Album("videos", false, [Video("FqTfFxwH8QA")]));
        await client.PutAsJsonAsync($"{Consola}/videos", Album("videos", true, [Video("Rv5Oiq8UXi0")]));

        var fotos = await (await anonimo.GetAsync("/api/v1/publico/galeria/items?clase=fotos")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, fotos.GetProperty("total").GetInt32());
        var primera = fotos.GetProperty("items")[0];
        Assert.Equal("fotos", primera.GetProperty("albumSlug").GetString());
        Assert.Equal(1, primera.GetProperty("ancho").GetInt32());

        var videos = await (await anonimo.GetAsync("/api/v1/publico/galeria/items?clase=videos")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, videos.GetProperty("total").GetInt32());   // el del álbum en borrador no cuenta
        Assert.Equal("Rv5Oiq8UXi0", videos.GetProperty("items")[0].GetProperty("videoId").GetString());

        var pagina = await (await anonimo.GetAsync("/api/v1/publico/galeria/items?clase=fotos&desde=1&cantidad=1")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, pagina.GetProperty("total").GetInt32());
        Assert.Equal(1, pagina.GetProperty("items").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, (await anonimo.GetAsync("/api/v1/publico/galeria/items?clase=otra")).StatusCode);
    }

    [Fact]
    public async Task Guardar_los_sin_album_exige_sesion_y_valida_los_items()
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();
        var r = await anonimo.PutAsJsonAsync(Sueltos, new { items = Array.Empty<object>() });
        Assert.True(r.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden);
        var client = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(Sueltos, new { items = new object[] { new { tipoItem = "video", videoId = "../../x", titulo = "x" } } })).StatusCode);
    }

    // ── La consola: estado rápido, orden, destacados y retiro (panel «Galería») ─────────────────────────────

    private static readonly string[] SoloBanco = ["banco-de-archivos"];
    private static readonly string[] CyA = ["c", "a"];
    private static readonly string[] CAB = ["c", "a", "b"];
    private static readonly string[] AA = ["a", "a"];
    private static readonly string[] Inexistente = ["no-existe"];
    private static readonly string[] Voces = ["voces"];
    private const string RutaOrden = "/api/v1/institucional/galeria/albumes-orden";

    [Fact]
    public async Task Se_puede_publicar_y_destacar_un_album_desde_la_lista_y_queda_en_la_auditoria()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var anonimo = factory.CreateClient();
        await client.PutAsJsonAsync($"{Consola}/voces", Album("videos", false, [Video()]));

        var publicado = await client.PutAsJsonAsync($"{Consola}/voces/estado", new { publicado = true, destacado = true });
        Assert.Equal(HttpStatusCode.OK, publicado.StatusCode);
        var resumen = await publicado.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(resumen.GetProperty("publicado").GetBoolean());
        Assert.True(resumen.GetProperty("destacado").GetBoolean());

        var publico = await (await anonimo.GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(publico.GetProperty("items")[0].GetProperty("destacado").GetBoolean());

        var despublicado = await client.PutAsJsonAsync($"{Consola}/voces/estado", new { publicado = false });
        Assert.Equal(HttpStatusCode.OK, despublicado.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"{Publico}/voces")).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var lineas = db.AuditLogs.Where(a => a.TableName == "GaleriaAlbumes" && a.Action == "actualizar").Select(a => a.NewValuesJson).ToList()
            .Select(l => JsonDocument.Parse(l!).RootElement.GetProperty("resumen").GetString()!).ToList();
        Assert.Contains(lineas, l => l.Contains("lo publicó y lo marcó como destacado", StringComparison.Ordinal));
        Assert.Contains(lineas, l => l.Contains("lo despublicó", StringComparison.Ordinal));
    }

    [Fact]
    public async Task El_estado_rapido_no_publica_un_album_vacio_ni_acepta_una_solicitud_sin_cambios_ni_un_album_inexistente()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        await client.PutAsJsonAsync($"{Consola}/vacio", Album("fotos", false, []));
        await client.PutAsJsonAsync($"{Consola}/mixto", Album("mixto", false, [Video()]));

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/vacio/estado", new { publicado = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/mixto/estado", new { publicado = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/mixto/estado", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"{Consola}/no-existe/estado", new { publicado = false })).StatusCode);
    }

    [Fact]
    public async Task El_orden_de_los_albumes_se_guarda_y_lo_no_nombrado_queda_despues()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var anonimo = factory.CreateClient();
        foreach (var slug in new[] { "a", "b", "c" }) await client.PutAsJsonAsync($"{Consola}/{slug}", Album("videos", true, [Video()]));

        var ordenado = await client.PutAsJsonAsync(RutaOrden, new { slugs = CyA });
        Assert.Equal(HttpStatusCode.OK, ordenado.StatusCode);
        var publico = await (await anonimo.GetAsync(Publico)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(CAB, publico.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("slug").GetString()!).ToArray());

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(RutaOrden, new { slugs = AA })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(RutaOrden, new { slugs = Inexistente })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync(RutaOrden, new { slugs = Array.Empty<string>() })).StatusCode);
    }

    [Fact]
    public async Task Eliminar_un_album_retira_sus_items_pero_no_borra_las_fotos_del_banco()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var anonimo = factory.CreateClient();
        var foto = await SubirImagenAsync(client);
        await client.PutAsJsonAsync($"{Consola}/fotos", Album("fotos", true, [Foto(foto)]));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Consola}/fotos")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{Consola}/fotos")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"{Consola}/fotos")).StatusCode);
        // La foto sigue en el Banco (ya no es pública porque nada publicado la usa).
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/v1/institucional/archivos/{foto}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/archivos/{foto}")).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Contains(db.AuditLogs, a => a.TableName == "GaleriaAlbumes" && a.Action == "eliminar");
        Assert.Empty(db.GaleriaItems.Where(i => i.GaleriaAlbumId != null));
    }

    [Fact]
    public async Task Los_textos_demasiado_largos_se_rechazan_con_400_y_no_con_un_error_de_la_base()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var largo = new string('x', 251);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/a", Album("videos", false, [Video(titulo: largo)]))).StatusCode);
        var album = new { titulo = new string('t', 201), tipo = "videos", publicado = false, items = new[] { Video() } };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Consola}/b", album)).StatusCode);
    }

    [Fact]
    public async Task Guardar_un_album_conserva_la_marca_de_destacado_y_las_rutas_nuevas_piden_el_modulo_del_banco()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var album = new { titulo = "Voces", tipo = "videos", publicado = true, destacado = true, items = new[] { Video() } };
        var creado = await client.PutAsJsonAsync($"{Consola}/voces", album);
        Assert.True((await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("destacado").GetBoolean());

        // Un gestor sin el módulo del Banco no entra a ninguna ruta de la consola de la Galería; con él, sí.
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync(Consola)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PutAsJsonAsync($"{Consola}/voces/estado", new { destacado = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.DeleteAsync($"{Consola}/voces")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PutAsJsonAsync(RutaOrden, new { slugs = Voces })).StatusCode);

        var webmaster = await CmsTestClient.LoginAsync(factory);
        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{id}/modulos", new { modulos = SoloBanco })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync(Consola)).StatusCode);
    }
}
