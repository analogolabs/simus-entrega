using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;

namespace SIMUS.Infrastructure.Correo;

/// <summary>Una imagen que viaja dentro del correo y se cita con <c>cid:</c>.</summary>
/// <param name="Clave">Nombre corto; el identificador final lleva además un sufijo único por mensaje.</param>
public sealed record ImagenDeCorreo(string Clave, string Recurso, int Alto);

/// <summary>Una imagen ya citada en un HTML concreto, con su identificador único.</summary>
public sealed record ImagenCitada(string Cid, ImagenDeCorreo Imagen);

/// <summary>
/// La plantilla HTML de los correos del SIMUS: cabecera morada con el logotipo, franja amarilla,
/// el contenido y un pie morado con los logotipos institucionales.
/// </summary>
/// <remarks>
/// <b>HTML DE CORREO, NO DE PAGINA:</b> tablas fluidas (<c>width:100%;max-width:640px</c>), estilos en
/// línea, <c>@media</c> a 600 px para apilar y ensanchar el botón, y Nunito Sans con Arial de respaldo.
/// Todo texto variable pasa por <see cref="WebUtility.HtmlEncode(string?)"/>. Las imágenes se
/// incrustan por CID, con un identificador distinto en cada mensaje (los clientes de correo
/// confunden mensajes que comparten CID).
/// </remarks>
public static partial class PlantillaDeCorreoSimus
{
    public const string TipoConfirmacionDeBoletin = "ConfirmacionDeBoletin";

    private const string Morado = "#4C2C54";
    private const string Amarillo = "#FFC93C";
    private const string Tinta = "#1F2933";
    private const string TintaSuave = "#5B6670";
    private const string Fuente = "font-family:'Nunito Sans',Arial,Helvetica,sans-serif";

    public static readonly ImagenDeCorreo LogoSimus = new("logo-simus", "logo-simus-blanco.png", 44);
    public static readonly ImagenDeCorreo SelloGovCo = new("gov-co", "gov-co-footer.png", 40);
    public static readonly ImagenDeCorreo LogoCulturas = new("culturas", "Culturas-Blanco.png", 46);
    public static readonly ImagenDeCorreo LogoPnmc = new("pnmc", "pnmc-blanco.png", 46);

    public static IReadOnlyList<ImagenDeCorreo> Imagenes { get; } = [LogoSimus, LogoCulturas, LogoPnmc, SelloGovCo];

    /// <summary>Los bytes de una imagen incrustada en el ensamblado.</summary>
    public static byte[] LeerImagen(ImagenDeCorreo imagen)
    {
        var ensamblado = typeof(PlantillaDeCorreoSimus).Assembly;
        var nombre = ensamblado.GetManifestResourceNames()
            .Single(n => n.EndsWith("." + imagen.Recurso, StringComparison.Ordinal));
        using var flujo = ensamblado.GetManifestResourceStream(nombre)!;
        using var memoria = new MemoryStream();
        flujo.CopyTo(memoria);
        return memoria.ToArray();
    }

    /// <summary>Las imágenes que el HTML cita (con su CID único), para no adjuntar las que sobran.</summary>
    public static IReadOnlyList<ImagenCitada> ImagenesCitadas(string html) =>
        [.. CidCitado().Matches(html)
            .Select(m => (Cid: m.Groups[1].Value, Clave: m.Groups[2].Value))
            .DistinctBy(x => x.Cid)
            .Select(x => (x.Cid, Imagen: Imagenes.FirstOrDefault(i => i.Clave == x.Clave)))
            .Where(x => x.Imagen is not null)
            .Select(x => new ImagenCitada(x.Cid, x.Imagen!))];

    /// <summary>
    /// El HTML que corresponde a un mensaje de la cola, o <c>null</c> si ese tipo se envía en texto
    /// plano. <paramref name="cuerpoDeTexto"/> es el texto de la cola, con el enlace ya completo.
    /// </summary>
    public static string? HtmlPara(string tipoDeEvento, string cuerpoDeTexto, string? asunto = null)
    {
        if (tipoDeEvento == TipoConfirmacionDeBoletin)
        {
            var enlace = LineaConEnlace().Match(cuerpoDeTexto);
            if (enlace.Success) return ConfirmacionDeBoletin(enlace.Value.Trim(), EnlaceDeBaja(cuerpoDeTexto));
        }
        // TODOS LOS CORREOS DEL SISTEMA LLEVAN LA PLANTILLA COMUN: lo que no es el boletín se pinta
        // desde su contenido (título, párrafos, datos, botón), que es el mismo texto de la cola.
        return string.IsNullOrWhiteSpace(cuerpoDeTexto)
            ? null
            : Documento(ContenidoDeCorreo.Leer(cuerpoDeTexto, asunto), asunto);
    }

    /// <summary>La ruta de la página pública de baja del boletín (la abre quien recibe el correo).</summary>
    public const string RutaDeBajaDelBoletin = "/ecosistema/baja-boletin";

    /// <summary>La ruta del API que da de baja con un POST sin pantalla (RFC 8058).</summary>
    public const string RutaDeUnClicDeBaja = "/api/v1/publico/boletin/baja-un-clic";

    /// <summary>
    /// El enlace de la página de baja que lleva el texto del correo (la línea con solo la ruta), o nulo si no hay.
    /// </summary>
    public static string? EnlaceDeBaja(string cuerpoDeTexto)
    {
        var coincidencia = LineaDeBaja().Match(cuerpoDeTexto ?? string.Empty);
        return coincidencia.Success ? coincidencia.Value.Trim() : null;
    }

    /// <summary>
    /// El mismo testigo apuntado al API (<c>POST</c> de un clic, RFC 8058), para la cabecera List-Unsubscribe.
    /// </summary>
    public static string? EnlaceDeUnClicDeBaja(string cuerpoDeTexto) =>
        EnlaceDeBaja(cuerpoDeTexto)?.Replace(RutaDeBajaDelBoletin, RutaDeUnClicDeBaja, StringComparison.Ordinal);

    /// <summary>
    /// El pie de baja común a los correos del boletín (confirmación y ediciones): texto y enlace, ya escapados.
    /// </summary>
    public static string PieDeBajaHtml(string enlace)
    {
        var url = WebUtility.HtmlEncode(enlace);
        return $"<p style=\"{Fuente};font-size:13px;line-height:1.5;color:{TintaSuave};margin:12px 0 0\">¿No quieres recibir más el boletín? "
            + $"<a href=\"{url}\" style=\"color:{Morado};font-weight:bold\">Darme de baja</a>. Puedes hacerlo cuando quieras; retirar tu autorización no tiene costo.</p>";
    }

    /// <summary>El pie de baja en texto plano: una frase y el enlace en su propia línea (para completarlo al despachar).</summary>
    public static string PieDeBajaTexto(string rutaDeBaja) =>
        "¿No quieres recibir más el boletín? Puedes darte de baja cuando quieras con este enlace; retirar tu autorización no tiene costo:\n\n" + rutaDeBaja;

    private static readonly (string Titulo, string Texto)[] LoQueRecibira =
    [
        ("Noticias del ecosistema", "Crónicas, reportajes y novedades de la música en los territorios."),
        ("Agenda de eventos", "Los eventos del mes: festivales, mercados, encuentros y conciertos."),
        ("Convocatorias", "Aperturas y plazos para organizaciones, agentes y actores."),
        ("Crónicas de los territorios", "Historias de la música que se hace en las regiones."),
    ];

    /// <summary>El correo que pide confirmar la suscripción al boletín.</summary>
    public static string ConfirmacionDeBoletin(string enlace, string? enlaceDeBaja = null)
    {
        var url = WebUtility.HtmlEncode(enlace);
        var token = Guid.NewGuid().ToString("N");
        var lista = string.Concat(LoQueRecibira.Select(i =>
            $"<tr><td style=\"padding:10px 0;border-top:1px solid #E6E2D8;{Fuente};font-size:14px;line-height:1.5;color:{Tinta}\">"
            + $"<b style=\"color:{Morado}\">{WebUtility.HtmlEncode(i.Titulo)}</b><br>{WebUtility.HtmlEncode(i.Texto)}</td></tr>"));
        var filas =
            $"<tr><td style=\"background:{Morado};padding:24px 32px\" class=\"pad\">{Img(LogoSimus, token, "SIMUS", "display:block")}</td></tr>"
            + $"<tr><td style=\"background:{Amarillo};height:6px;font-size:0;line-height:0\">&nbsp;</td></tr>"
            + $"<tr><td class=\"pad\" style=\"padding:32px\"><h1 class=\"ttl\" style=\"{Fuente};margin:0 0 12px;font-size:26px;line-height:1.2;color:{Morado}\">Confirma tu suscripción al boletín del SIMUS</h1>"
            + $"<p style=\"{Fuente};font-size:15px;line-height:1.6;margin:0 0 18px;color:{Tinta}\">Recibimos una solicitud para suscribir este correo al <b>boletín del Sistema de Información de la Música (SIMUS)</b>. "
            + "Para activar la suscripción y dejar constancia de tu autorización de tratamiento de datos, confirma con el botón. Esto recibirás:</p>"
            + $"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-bottom:24px\">{lista}</table>"
            + $"<a class=\"btn\" href=\"{url}\" style=\"{Fuente};background:{Morado};color:#FFFFFF;text-decoration:none;padding:14px 26px;font-weight:bold;font-size:15px;display:inline-block;border-bottom:4px solid {Amarillo}\">Confirmar suscripción</a>"
            + $"<p style=\"{Fuente};font-size:13px;line-height:1.5;color:{TintaSuave};margin:20px 0 0\">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href=\"{url}\" style=\"color:{Morado};word-break:break-all\">{url}</a></p>"
            + $"<p style=\"{Fuente};font-size:13px;line-height:1.5;color:{TintaSuave};margin:12px 0 0\">El enlace sirve una sola vez y vence en 3 días. Si no fuiste tú, ignora este mensaje: no se activará nada y no recibirás el boletín.</p>"
            + (enlaceDeBaja is null ? string.Empty : PieDeBajaHtml(enlaceDeBaja))
            + "</td></tr>"
            + Pie(token);
        return Marco("Un paso más: confirma tu correo para recibir el boletín del SIMUS.", filas, "Confirma tu suscripción al boletín del SIMUS");
    }

    private static string Img(ImagenDeCorreo i, string token, string alt, string estilo) =>
        $"<img src=\"cid:{Cid(i, token)}\" alt=\"{WebUtility.HtmlEncode(alt)}\" height=\"{i.Alto}\" style=\"{estilo};height:{i.Alto}px;width:auto;max-width:100%;border:0\">";

    private static string Cid(ImagenDeCorreo i, string token) => $"{i.Clave}-{token}@simus.local";

    private static string Pie(string token)
    {
        string Logo(ImagenDeCorreo i, string alt) =>
            Img(i, token, alt, "display:inline-block;margin:6px 12px;vertical-align:middle");
        return $"<tr><td align=\"center\" class=\"pad\" style=\"background:{Morado};padding:24px 20px;text-align:center\"><div style=\"font-size:0;line-height:0\">"
            + Logo(LogoCulturas, "Ministerio de las Culturas, las Artes y los Saberes")
            + Logo(LogoPnmc, "Plan Nacional de Música para la Convivencia")
            + Logo(SelloGovCo, "GOV.CO")
            + $"</div><p style=\"{Fuente};margin:16px 0 0;font-size:12px;line-height:1.6;color:#E4D9EA\">Sistema de Información de la Música (SIMUS), administrado por el Plan Nacional de Música para la Convivencia · Ministerio de las Culturas, las Artes y los Saberes · República de Colombia.</p></td></tr>";
    }

    /// <summary>El marco fluido. <paramref name="filas"/> debe venir ya escapado.</summary>
    private static string Marco(string preencabezado, string filas, string titulo = "SIMUS") => $$"""
<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>{{WebUtility.HtmlEncode(titulo)}}</title>
<style>body{margin:0;padding:0;-webkit-text-size-adjust:100%}img{border:0;-ms-interpolation-mode:bicubic}
@media only screen and (max-width:600px){.cont{width:100%!important}.pad{padding-left:18px!important;padding-right:18px!important}.ttl{font-size:22px!important}.btn{display:block!important;text-align:center!important}
}</style></head>
<body style="margin:0;background:#F7F4F8"><div style="display:none;max-height:0;overflow:hidden;opacity:0">{{WebUtility.HtmlEncode(preencabezado)}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" class="cont" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#FFFFFF">{{filas}}</table>
</td></tr></table></body></html>
""";

    [GeneratedRegex(@"cid:(([a-z-]+?)-[0-9a-f]{32}@simus\.local)")]
    private static partial Regex CidCitado();

    [GeneratedRegex(@"(?m)^(https?://|/)[^\s]+(?=\r?$)")]
    private static partial Regex LineaConEnlace();

    [GeneratedRegex(@"(?m)^(?:https?://[^\s/]+)?/ecosistema/baja-boletin\?testigo=[0-9a-f.]+(?=\r?$)")]
    private static partial Regex LineaDeBaja();
}
