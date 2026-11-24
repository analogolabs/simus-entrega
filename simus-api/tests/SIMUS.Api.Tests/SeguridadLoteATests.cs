using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// auditoría de seguridad: S-02 (XSS almacenado en noticias), S-03 (EXIF/GPS en fotos
/// subidas) y S-08 (topes de petición antes de leer el formulario).
/// </summary>
public sealed class SeguridadLoteATests
{
    private const string Noticias = "/api/v1/institucional/noticias";
    private const string Banco = "/api/v1/institucional/archivos";

    private const string CuerpoHostil =
        "<p>Hola</p><script>alert(1)</script><img src=x onerror=alert(1)><a href=\"javascript:alert(1)\">clic</a>";

    private static void SinMarcadoActivo(string texto)
    {
        Assert.DoesNotContain("<script", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onerror", texto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("javascript:", texto, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Hola", texto, StringComparison.Ordinal);
    }

    private static readonly string[] Etiquetas = ["convivencia"];

    private static object Noticia(string titulo, string cuerpo) => new
    {
        titulo,
        resumen = "Resumen breve de la noticia.",
        cuerpo,
        autoriaNombre = "Comunicaciones",
        etiquetas = Etiquetas,
    };

    [Fact]
    public async Task Crear_una_noticia_sanea_el_cuerpo_antes_de_guardarlo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var creada = await client.PostAsJsonAsync(Noticias, Noticia("Noticia hostil", CuerpoHostil));

        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        var noticia = await creada.Content.ReadFromJsonAsync<JsonElement>();
        SinMarcadoActivo(noticia.GetProperty("cuerpo").GetString()!);

        // Y lo guardado en la base ya está limpio, no solo lo que se devuelve.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var fila = db.Noticias.Single(n => n.Id == noticia.GetProperty("id").GetInt64());
        SinMarcadoActivo(fila.Cuerpo!);
    }

    [Fact]
    public async Task Guardar_una_noticia_sanea_el_cuerpo_y_el_portal_publico_no_lo_devuelve_activo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var creada = await (await client.PostAsJsonAsync(Noticias, Noticia("Noticia editada", "Cuerpo limpio inicial."))).Content.ReadFromJsonAsync<JsonElement>();
        var id = creada.GetProperty("id").GetInt64();

        var guardada = await client.PutAsJsonAsync($"{Noticias}/{id}", new
        {
            titulo = "Noticia editada",
            resumen = "Resumen breve de la noticia.",
            cuerpo = CuerpoHostil,
            fechaPublicacion = DateOnly.FromDateTime(DateTime.UtcNow),
            autoriaNombre = "Comunicaciones",
            etiquetas = Etiquetas,
            version = creada.GetProperty("version").GetInt32(),
        });
        Assert.True(guardada.IsSuccessStatusCode, await guardada.Content.ReadAsStringAsync());
        SinMarcadoActivo((await guardada.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("cuerpo").GetString()!);

        await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "publicado" });
        var publica = await factory.CreateClient().GetAsync($"/api/v1/publico/noticias/noticia-editada");
        Assert.Equal(HttpStatusCode.OK, publica.StatusCode);
        SinMarcadoActivo(await publica.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Una_noticia_ya_guardada_con_marcado_activo_se_sanea_al_leerla()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var creada = await (await client.PostAsJsonAsync(Noticias, Noticia("Noticia antigua", "Cuerpo."))).Content.ReadFromJsonAsync<JsonElement>();
        var id = creada.GetProperty("id").GetInt64();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.Noticias.Single(n => n.Id == id).Cuerpo = CuerpoHostil; // como quedó antes del arreglo
            await db.SaveChangesAsync();
        }

        var leida = await client.GetAsync($"{Noticias}/{id}");

        Assert.Equal(HttpStatusCode.OK, leida.StatusCode);
        SinMarcadoActivo((await leida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("cuerpo").GetString()!);
    }

    // ── S-03 ──────────────────────────────────────────────────────────────────────────────

    private static readonly byte[] CargaExifConGps = Encoding.ASCII.GetBytes("Exif\0\0MM\0*GPSLatitude=4.7110N GPSLongitude=74.0721W");

    internal static byte[] JpegConExif()
    {
        using var ms = new MemoryStream();
        void Segmento(byte marcador, byte[] carga)
        {
            ms.WriteByte(0xFF);
            ms.WriteByte(marcador);
            var largo = carga.Length + 2;
            ms.WriteByte((byte)(largo >> 8));
            ms.WriteByte((byte)largo);
            ms.Write(carga);
        }

        ms.Write([0xFF, 0xD8]);
        Segmento(0xE0, Encoding.ASCII.GetBytes("JFIF\0\x01\x01\0\0\x01\0\x01\0\0"));
        Segmento(0xE1, CargaExifConGps);
        Segmento(0xE1, Encoding.ASCII.GetBytes("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta GPS/>"));
        Segmento(0xED, Encoding.ASCII.GetBytes("Photoshop 3.0\0IPTC"));
        Segmento(0xFE, Encoding.ASCII.GetBytes("comentario de la camara"));
        Segmento(0xE2, Encoding.ASCII.GetBytes("ICC_PROFILE\0perfil"));
        // SOF0: precisión 8, 16x8, 1 componente
        Segmento(0xC0, [8, 0, 8, 0, 16, 1, 1, 0x11, 0]);
        Segmento(0xDA, [1, 1, 0, 0, 63, 0]);
        ms.Write([0x12, 0xFF, 0x00, 0x34, 0xFF, 0xD0, 0x56]); // datos comprimidos con byte stuffing y RST
        ms.Write([0xFF, 0xD9]);
        return ms.ToArray();
    }

    private static bool Contiene(byte[] datos, string texto)
        => datos.AsSpan().IndexOf(Encoding.ASCII.GetBytes(texto)) >= 0;

    [Fact]
    public void La_limpieza_de_un_JPEG_quita_EXIF_XMP_IPTC_y_comentarios_y_conserva_ICC_y_la_imagen()
    {
        var original = JpegConExif();
        Assert.NotNull(MediosWebContrato.Reconocer(original));

        var limpio = LimpiezaDeMetadatosDeImagen.Limpiar(original, "image/jpeg")!;

        Assert.False(Contiene(limpio, "Exif"));
        Assert.False(Contiene(limpio, "GPS"));
        Assert.False(Contiene(limpio, "xmpmeta"));
        Assert.False(Contiene(limpio, "Photoshop"));
        Assert.False(Contiene(limpio, "comentario"));
        Assert.True(Contiene(limpio, "ICC_PROFILE"));
        Assert.True(Contiene(limpio, "JFIF"));
        var formato = MediosWebContrato.Reconocer(limpio);
        Assert.Equal(("image/jpeg", 16, 8), (formato!.Value.Mime, formato.Value.Width, formato.Value.Height));
        // Los datos comprimidos quedan intactos.
        Assert.Equal(original.AsSpan(original.Length - 9).ToArray(), limpio.AsSpan(limpio.Length - 9).ToArray());
    }

    [Fact]
    public void Un_JPEG_sin_metadatos_devuelve_los_mismos_bytes()
    {
        var limpio = LimpiezaDeMetadatosDeImagen.Limpiar(JpegConExif(), "image/jpeg")!;
        Assert.Same(limpio, LimpiezaDeMetadatosDeImagen.Limpiar(limpio, "image/jpeg"));
    }

    [Fact]
    public void La_limpieza_de_un_PNG_quita_eXIf_y_texto_y_conserva_los_chunks_de_imagen()
    {
        var png = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
        byte[] Chunk(string tipo, string carga)
        {
            var c = Encoding.ASCII.GetBytes(carga);
            var r = new byte[12 + c.Length];
            r[3] = (byte)c.Length;
            Encoding.ASCII.GetBytes(tipo).CopyTo(r, 4);
            c.CopyTo(r, 8);
            return r;
        }

        var conMeta = png[..33].Concat(Chunk("eXIf", "GPSLatitude")).Concat(Chunk("tEXt", "Comment\0hola"))
            .Concat(png[33..]).ToArray();
        Assert.NotNull(MediosWebContrato.Reconocer(conMeta));

        var limpio = LimpiezaDeMetadatosDeImagen.Limpiar(conMeta, "image/png")!;

        Assert.Equal(png, limpio);
    }

    [Fact]
    public void La_limpieza_de_un_WebP_quita_EXIF_y_XMP_y_corrige_longitud_y_banderas()
    {
        byte[] Chunk(string tipo, byte[] carga)
        {
            var r = new List<byte>(Encoding.ASCII.GetBytes(tipo));
            r.AddRange(BitConverter.GetBytes((uint)carga.Length));
            r.AddRange(carga);
            if (carga.Length % 2 == 1) r.Add(0);
            return r.ToArray();
        }

        var vp8x = Chunk("VP8X", [0x0C, 0, 0, 0, 15, 0, 0, 7, 0, 0]); // EXIF + XMP, 16x8
        var imagen = Chunk("VP8 ", new byte[20]);
        var cuerpo = Encoding.ASCII.GetBytes("WEBP").Concat(vp8x).Concat(Chunk("EXIF", Encoding.ASCII.GetBytes("GPS!!")))
            .Concat(imagen).Concat(Chunk("XMP ", Encoding.ASCII.GetBytes("<x:xmpmeta/>"))).ToArray();
        var webp = Encoding.ASCII.GetBytes("RIFF").Concat(BitConverter.GetBytes((uint)cuerpo.Length)).Concat(cuerpo).ToArray();
        Assert.NotNull(MediosWebContrato.Reconocer(webp));

        var limpio = LimpiezaDeMetadatosDeImagen.Limpiar(webp, "image/webp")!;

        Assert.False(Contiene(limpio, "GPS"));
        Assert.False(Contiene(limpio, "xmpmeta"));
        Assert.Equal((uint)(limpio.Length - 8), BitConverter.ToUInt32(limpio, 4));
        Assert.Equal(0, limpio[20] & 0x0C);
        Assert.NotNull(MediosWebContrato.Reconocer(limpio));
    }

    [Fact]
    public async Task Un_JPEG_con_EXIF_subido_al_banco_se_guarda_y_se_sirve_sin_EXIF()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(JpegConExif());
        parte.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        contenido.Add(parte, "file", "casa.jpg");
        contenido.Add(new StringContent("Foto de prueba"), "alt");

        var subida = await client.PostAsync(Banco, contenido);

        Assert.Equal(HttpStatusCode.Created, subida.StatusCode);
        var id = (await subida.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        var servida = await (await client.GetAsync($"/api/v1/publico/archivos/{id}")).Content.ReadAsByteArrayAsync();
        Assert.False(Contiene(servida, "Exif"));
        Assert.False(Contiene(servida, "GPS"));
        Assert.NotNull(MediosWebContrato.Reconocer(servida));
    }

    // ── S-08 ──────────────────────────────────────────────────────────────────────────────

    private static MultipartFormDataContent FormularioGrande(int bytes, string tipo)
    {
        var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(new byte[bytes]);
        parte.Headers.ContentType = new MediaTypeHeaderValue(tipo);
        contenido.Add(parte, "file", "grande.bin");
        contenido.Add(new StringContent("Texto"), "alt");
        return contenido;
    }

    [Fact]
    public async Task Una_imagen_de_3_MiB_en_el_banco_de_la_consola_responde_413_sin_guardar_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var respuesta = await client.PostAsync(Banco, FormularioGrande(3 * 1024 * 1024, "image/png"));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, respuesta.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(scope.ServiceProvider.GetRequiredService<SimusDbContext>().Files);
    }

    [Fact]
    public async Task Un_documento_por_encima_del_tope_responde_413()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);

        var respuesta = await client.PostAsync(Banco + "/documentos",
            FormularioGrande(MediosWebContrato.MaxBytesDocumento + 128 * 1024, "application/pdf"));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, respuesta.StatusCode);
    }

    public static TheoryData<string> RutasDeFotoPersonal => new()
    {
        "/api/v1/externo/cuenta/perfil-publico/foto",
        "/api/v1/externo/mis-talleres/foto",
        "/api/v1/externo/mis-espacios/foto",
        "/api/v1/externo/mis-redes/foto",
        "/api/v1/externo/archivos",
    };

    [Theory]
    [MemberData(nameof(RutasDeFotoPersonal))]
    public async Task Las_fotos_de_personas_y_organizaciones_responden_413_por_encima_del_tope(string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var (sesion, _, _) = await TalleresDeLuteriaTests.LutierAsync(factory);

        var respuesta = await TestigoDelCanalExterno.PostAsync(sesion, ruta, FormularioGrande(3 * 1024 * 1024, "image/png"));

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, respuesta.StatusCode);
    }
}
