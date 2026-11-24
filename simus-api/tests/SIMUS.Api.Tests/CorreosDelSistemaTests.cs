using System.Net;
using SIMUS.Infrastructure.Correo;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Todos los correos del sistema: dicen quién actúa y sobre qué entidad, llevan botón y texto plano,
/// escapan lo variable y se pintan con la plantilla común.
/// </summary>
public sealed class CorreosDelSistemaTests
{
    private const string Enlace = "https://simus.ejemplo.org/ecosistema/invitacion?testigo=abc&x=1";

    public static TheoryData<string, CorreoRedactado> Todos() => new()
    {
        { "equipo", CorreosDelSistema.InvitacionAEquipo("Corporación Cantares", "editora o editor", "Ana Pérez", Enlace, 7) },
        { "agenda", CorreosDelSistema.InvitacionDeAgenda("Circulart", 2026, "Ana Pérez", Enlace, 7) },
        { "confirmar", CorreosDelSistema.ConfirmacionDeCorreo("Ana Pérez", Enlace, 3) },
        { "restablecer", CorreosDelSistema.RestablecerContrasena(Enlace, 30) },
        { "festival-enviado", CorreosDelSistema.FestivalEnviadoARevision("Ana Pérez", "Festival del Río", "Corporación Cantares", Enlace) },
        { "festival-pendiente", CorreosDelSistema.FestivalPendienteDeRevision("Festival del Río", "Corporación Cantares", "Ana Pérez", Enlace) },
        { "decision-publicado", CorreosDelSistema.DecisionDeFestival("Publicado", "Ana Pérez", "Festival del Río", "Corporación Cantares", null, Enlace) },
        { "decision-ajustes", CorreosDelSistema.DecisionDeFestival("AjustesSolicitados", "Ana Pérez", "Festival del Río", "Corporación Cantares", "Falta el aforo.", Enlace) },
        { "decision-rechazado", CorreosDelSistema.DecisionDeFestival("Rechazado", "Ana Pérez", "Festival del Río", "Corporación Cantares", "Duplicado.", Enlace) },
    };

    [Fact]
    public void La_invitacion_al_equipo_dice_quien_invita_a_que_organizacion_y_con_que_rol()
    {
        var c = CorreosDelSistema.InvitacionAEquipo("Corporación Cantares", "editora o editor", "Ana Pérez", Enlace, 7);

        Assert.Equal("Ana Pérez te invita a Corporación Cantares en SIMUS", c.Asunto);
        Assert.Contains("• Te invita: Ana Pérez", c.Cuerpo, StringComparison.Ordinal);
        Assert.Contains("• Organización: Corporación Cantares", c.Cuerpo, StringComparison.Ordinal);
        Assert.Contains("• Tu rol: Editora o editor", c.Cuerpo, StringComparison.Ordinal);
        Assert.Contains("vence en 7 días", c.Cuerpo, StringComparison.Ordinal);
        var html = PlantillaDeCorreoSimus.HtmlPara("InvitacionDeOrganizacion", c.Cuerpo, c.Asunto)!;
        Assert.Contains("Aceptar la invitación", html, StringComparison.Ordinal);
        Assert.Contains("Ana Pérez", html, StringComparison.Ordinal);
        Assert.Contains("Corporación Cantares", html, StringComparison.Ordinal);
    }

    [Fact]
    public void La_invitacion_a_la_agenda_nombra_el_mercado_y_a_quien_invita()
    {
        var c = CorreosDelSistema.InvitacionDeAgenda("Circulart", 2026, "Ana Pérez", Enlace, 7);
        Assert.Contains("Circulart", c.Asunto, StringComparison.Ordinal);
        Assert.Contains("• Te invita: Ana Pérez", c.Cuerpo, StringComparison.Ordinal);
        Assert.Contains("• Mercado: Circulart (2026)", c.Cuerpo, StringComparison.Ordinal);
    }

    [Fact]
    public void El_aviso_de_contrasena_cambiada_no_lleva_boton_porque_no_pide_nada()
    {
        var c = CorreosDelSistema.ContrasenaCambiada();
        var html = PlantillaDeCorreoSimus.HtmlPara("X", c.Cuerpo, c.Asunto)!;
        Assert.DoesNotContain("class=\"btn\"", html, StringComparison.Ordinal);
        Assert.Contains("escríbele al equipo del PNMC", html, StringComparison.Ordinal);
    }

    [Fact]
    public void Los_avisos_de_seguridad_no_llevan_el_nombre_de_la_cuenta()
    {
        Assert.StartsWith("Hola.", Cuerpo(CorreosDelSistema.RestablecerContrasena(Enlace, 30)).Split('\n', 3)[2], StringComparison.Ordinal);
        Assert.DoesNotContain("Pérez", CorreosDelSistema.ContrasenaCambiada().Cuerpo, StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(Todos))]
    public void Cada_correo_lleva_asunto_boton_texto_plano_y_plantilla_comun(string _, CorreoRedactado c)
    {
        Assert.False(string.IsNullOrWhiteSpace(c.Asunto));
        // Texto plano alternativo: legible, sin HTML, con el enlace del botón en su propia línea.
        Assert.DoesNotContain("<", c.Cuerpo, StringComparison.Ordinal);
        Assert.Contains("\n" + Enlace, c.Cuerpo, StringComparison.Ordinal);

        var html = PlantillaDeCorreoSimus.HtmlPara("Cualquiera", c.Cuerpo, c.Asunto)!;
        Assert.Contains("class=\"btn\"", html, StringComparison.Ordinal);
        Assert.Contains("href=\"" + WebUtility.HtmlEncode(Enlace) + "\"", html, StringComparison.Ordinal);
        Assert.Contains("#4C2C54", html, StringComparison.Ordinal);
        Assert.Contains("#FFC93C", html, StringComparison.Ordinal);
        Assert.Contains("@media only screen and (max-width:600px)", html, StringComparison.Ordinal);
        Assert.Contains("'Nunito Sans',Arial", html, StringComparison.Ordinal);
        Assert.Contains("Sistema de Información de la Música (SIMUS), administrado por el Plan Nacional de Música para la Convivencia · Ministerio de las Culturas, las Artes y los Saberes", html, StringComparison.Ordinal);
        Assert.Equal(1, Contar(html, "class=\"btn\""));
    }

    [Theory]
    [MemberData(nameof(Todos))]
    public void Cada_correo_incrusta_los_cuatro_logotipos_con_identificadores_propios(string _, CorreoRedactado c)
    {
        var a = PlantillaDeCorreoSimus.ImagenesCitadas(PlantillaDeCorreoSimus.HtmlPara("X", c.Cuerpo, c.Asunto)!).ToList();
        var b = PlantillaDeCorreoSimus.ImagenesCitadas(PlantillaDeCorreoSimus.HtmlPara("X", c.Cuerpo, c.Asunto)!).ToList();

        Assert.Equal(PlantillaDeCorreoSimus.Imagenes.Count, a.Count);
        Assert.Equal(a.Count, a.Select(i => i.Cid).Distinct().Count());
        Assert.Empty(a.Select(i => i.Cid).Intersect(b.Select(i => i.Cid)));
    }

    [Fact]
    public void Lo_variable_se_escapa_en_el_HTML()
    {
        var c = CorreosDelSistema.InvitacionAEquipo("<b>Mala</b> & \"Cía\"", "editor", "<script>alert(1)</script>", Enlace, 7);
        var html = PlantillaDeCorreoSimus.HtmlPara("X", c.Cuerpo, c.Asunto)!;

        Assert.DoesNotContain("<script>", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<b>Mala</b>", html, StringComparison.Ordinal);
        Assert.Contains("&lt;script&gt;alert(1)&lt;/script&gt;", html, StringComparison.Ordinal);
        Assert.Contains("&lt;b&gt;Mala&lt;/b&gt; &amp; &quot;Cía&quot;", html, StringComparison.Ordinal);
    }

    [Fact]
    public void Un_texto_de_persona_con_saltos_de_linea_no_puede_fabricar_un_boton_ajeno()
    {
        var observacion = "Falta el aforo.\n\nEntra aquí:\nhttps://phishing.example/robar";
        var c = CorreosDelSistema.DecisionDeFestival("AjustesSolicitados", "Ana", "Festival", "Org", observacion, Enlace);
        var html = PlantillaDeCorreoSimus.HtmlPara("X", c.Cuerpo, c.Asunto)!;

        Assert.Equal(1, Contar(html, "class=\"btn\""));
        Assert.Contains("href=\"" + WebUtility.HtmlEncode(Enlace) + "\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain("href=\"https://phishing.example", html, StringComparison.Ordinal);
    }

    [Fact]
    public void La_decision_de_un_festival_dice_proceso_organizacion_y_que_se_espera()
    {
        var c = CorreosDelSistema.DecisionDeFestival("AjustesSolicitados", "Ana Pérez", "Festival del Río", "Corporación Cantares", "Falta el aforo.", Enlace);

        Assert.Contains("Festival del Río", c.Asunto, StringComparison.Ordinal);
        Assert.Contains("• Proceso: Festival «Festival del Río»", c.Cuerpo, StringComparison.Ordinal);
        Assert.Contains("• Organización: Corporación Cantares", c.Cuerpo, StringComparison.Ordinal);
        Assert.Contains("• Observación: Falta el aforo.", c.Cuerpo, StringComparison.Ordinal);
        Assert.Contains("vuelvas a enviar", c.Cuerpo, StringComparison.Ordinal);
    }

    [Fact]
    public void El_texto_de_la_cola_de_un_correo_anterior_sin_formato_tambien_se_pinta()
    {
        var html = PlantillaDeCorreoSimus.HtmlPara("Viejo", "Hola.\n\nTexto libre de antes.", "Asunto viejo")!;
        Assert.Contains("Texto libre de antes.", html, StringComparison.Ordinal);
        Assert.Contains("Asunto viejo", html, StringComparison.Ordinal);
        Assert.DoesNotContain("class=\"btn\"", html, StringComparison.Ordinal);
    }

    [Fact]
    public void El_contenido_va_y_vuelve_por_el_texto_plano_sin_perder_nada()
    {
        var original = ContenidoDeCorreo.Nuevo("T").ConSaludo("Ana").ConParrafo("Uno.")
            .ConDatos(("A", "1"), ("B", "2")).ConBoton("Ir", "/x").ConParrafo("Nota.");
        var leido = ContenidoDeCorreo.Leer(original.ATextoPlano());
        Assert.Equal(original.ATextoPlano(), leido.ATextoPlano());
        Assert.Equal(original.Bloques.Count, leido.Bloques.Count);
    }

    [Fact]
    public void Los_datos_empiezan_con_mayuscula_inicial_salvo_correos_y_enlaces()
    {
        var texto = ContenidoDeCorreo.Nuevo("T")
            .ConDatos(("Tu rol", "editora"), ("Correo", "ana@ejemplo.org"), ("Enlace", "https://simus.example/x"), ("Mercado", "Mercado del Valle"))
            .ATextoPlano();
        Assert.Contains("Editora", texto, StringComparison.Ordinal);
        Assert.Contains("ana@ejemplo.org", texto, StringComparison.Ordinal);
        Assert.Contains("https://simus.example/x", texto, StringComparison.Ordinal);
        Assert.Contains("Mercado del Valle", texto, StringComparison.Ordinal);
    }

    private static string Cuerpo(CorreoRedactado c) => c.Cuerpo;

    private static int Contar(string texto, string parte) =>
        texto.Split(parte, StringSplitOptions.None).Length - 1;
}
