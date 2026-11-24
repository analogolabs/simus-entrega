using SIMUS.Infrastructure.Correo;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>La plantilla HTML de los correos del SIMUS: contenido, escapado e imágenes incrustadas.</summary>
public sealed class PlantillaDeCorreoSimusTests
{
    private const string Cuerpo = "Hola.\n\nAbre este enlace:\n\nhttp://127.0.0.1:4300/ecosistema/confirmar-boletin?testigo=abc123\n\nFin.";

    [Fact]
    public void La_confirmacion_del_boletin_dice_SIMUS_y_conserva_el_enlace_con_el_testigo()
    {
        var html = PlantillaDeCorreoSimus.HtmlPara("ConfirmacionDeBoletin", Cuerpo);

        Assert.NotNull(html);
        Assert.Contains("boletín del Sistema de Información de la Música (SIMUS)", html, StringComparison.Ordinal);
        Assert.Contains("administrado por el Plan Nacional de Música para la Convivencia · Ministerio de las Culturas, las Artes y los Saberes", html, StringComparison.Ordinal);
        Assert.DoesNotContain("boletín del PNMC", html, StringComparison.Ordinal);
        Assert.Contains("href=\"http://127.0.0.1:4300/ecosistema/confirmar-boletin?testigo=abc123\"", html, StringComparison.Ordinal);
        html = System.Net.WebUtility.HtmlDecode(html);
        Assert.Contains("Noticias", html, StringComparison.Ordinal);
        Assert.Contains("Agenda de eventos", html, StringComparison.Ordinal);
        Assert.Contains("Convocatorias", html, StringComparison.Ordinal);
        Assert.Contains("Crónicas de los territorios", html, StringComparison.Ordinal);
    }

    [Fact]
    public void El_enlace_se_escapa_en_el_HTML()
    {
        var html = PlantillaDeCorreoSimus.ConfirmacionDeBoletin("http://x/?a=1&b=\"><script>alert(1)</script>");

        Assert.DoesNotContain("<script>", html, StringComparison.Ordinal);
        Assert.Contains("&amp;b=&quot;&gt;&lt;script&gt;", html, StringComparison.Ordinal);
    }

    [Fact]
    public void Otros_tipos_de_correo_tambien_llevan_la_plantilla_comun()
    {
        var html = PlantillaDeCorreoSimus.HtmlPara("ConfirmacionDeCorreo", Cuerpo, "Asunto de prueba");
        Assert.NotNull(html);
        Assert.Contains("#4C2C54", html, StringComparison.Ordinal);
        Assert.Contains("<title>Asunto de prueba</title>", html, StringComparison.Ordinal);
    }

    [Fact]
    public void Las_imagenes_citadas_existen_incrustadas_y_son_PNG()
    {
        var html = PlantillaDeCorreoSimus.ConfirmacionDeBoletin("http://x/y");
        var citadas = PlantillaDeCorreoSimus.ImagenesCitadas(html).ToList();

        Assert.Equal(PlantillaDeCorreoSimus.Imagenes.Count, citadas.Count);
        foreach (var imagen in citadas)
        {
            var bytes = PlantillaDeCorreoSimus.LeerImagen(imagen.Imagen);
            Assert.True(bytes.Length > 8 && bytes[1] == (byte)'P' && bytes[2] == (byte)'N' && bytes[3] == (byte)'G', imagen.Imagen.Recurso);
        }
    }

    [Fact]
    public void Cada_mensaje_lleva_identificadores_de_imagen_propios()
    {
        var a = PlantillaDeCorreoSimus.ImagenesCitadas(PlantillaDeCorreoSimus.ConfirmacionDeBoletin("http://x/y")).Select(i => i.Cid);
        var b = PlantillaDeCorreoSimus.ImagenesCitadas(PlantillaDeCorreoSimus.ConfirmacionDeBoletin("http://x/y")).Select(i => i.Cid);
        Assert.Empty(a.Intersect(b));
    }

    [Fact]
    public void Es_adaptable_y_usa_la_paleta_y_la_tipografia_del_sitio()
    {
        var html = PlantillaDeCorreoSimus.ConfirmacionDeBoletin("http://x/y");
        Assert.Contains("name=\"viewport\"", html, StringComparison.Ordinal);
        Assert.Contains("width:100%;max-width:640px", html, StringComparison.Ordinal);
        Assert.Contains("@media only screen and (max-width:600px)", html, StringComparison.Ordinal);
        Assert.Contains("#4C2C54", html, StringComparison.Ordinal);
        Assert.Contains("#FFC93C", html, StringComparison.Ordinal);
        Assert.Contains("'Nunito Sans',Arial", html, StringComparison.Ordinal);
    }
}
