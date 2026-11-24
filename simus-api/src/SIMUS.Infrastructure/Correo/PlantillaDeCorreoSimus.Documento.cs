using System.Net;

namespace SIMUS.Infrastructure.Correo;

public static partial class PlantillaDeCorreoSimus
{
    private const string AvisoAutomatico =
        "Recibes este mensaje porque tu correo se usó en el Sistema de Información de la Música (SIMUS). Es un envío automático: no respondas a esta dirección.";

    /// <summary>
    /// El correo de uso general: cabecera, título, el contenido (párrafos, datos, botón principal y
    /// notas) y el pie institucional. Es el mismo marco del boletín, de modo que todos los correos
    /// del sistema se reconocen como de SIMUS.
    /// </summary>
    /// <param name="contenido">El contenido; todo texto variable se escapa aquí.</param>
    /// <param name="asunto">El asunto, que también es el preencabezado de la bandeja.</param>
    public static string Documento(ContenidoDeCorreo contenido, string? asunto = null)
    {
        ArgumentNullException.ThrowIfNull(contenido);
        var token = Guid.NewGuid().ToString("N");
        var titulo = contenido.Titulo ?? asunto ?? "SIMUS";
        var cuerpo = new System.Text.StringBuilder();
        var tras = false;
        foreach (var bloque in contenido.Bloques)
        {
            switch (bloque)
            {
                case ContenidoDeCorreo.Parrafo p when !tras:
                    cuerpo.Append($"<p style=\"{Fuente};font-size:15px;line-height:1.6;margin:0 0 16px;color:{Tinta}\">{Texto(p.Texto)}</p>");
                    break;
                case ContenidoDeCorreo.Parrafo p:
                    cuerpo.Append($"<p style=\"{Fuente};font-size:13px;line-height:1.5;color:{TintaSuave};margin:12px 0 0\">{Texto(p.Texto)}</p>");
                    break;
                case ContenidoDeCorreo.Datos d:
                    cuerpo.Append($"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 20px;background:#F7F4F8;border-left:4px solid {Amarillo}\">");
                    foreach (var (etiqueta, valor) in d.Filas)
                        cuerpo.Append($"<tr><td style=\"padding:10px 14px;{Fuente};font-size:14px;line-height:1.5;color:{Tinta}\"><span style=\"color:{TintaSuave};font-size:12px;text-transform:none\">{Texto(etiqueta)}</span><br><b style=\"color:{Morado}\">{Texto(valor)}</b></td></tr>");
                    cuerpo.Append("</table>");
                    break;
                case ContenidoDeCorreo.Boton b:
                    var url = Texto(b.Enlace);
                    cuerpo.Append($"<a class=\"btn\" href=\"{url}\" style=\"{Fuente};background:{Morado};color:#FFFFFF;text-decoration:none;padding:14px 26px;font-weight:bold;font-size:15px;display:inline-block;border-bottom:4px solid {Amarillo}\">{Texto(b.Texto)}</a>");
                    cuerpo.Append($"<p style=\"{Fuente};font-size:13px;line-height:1.5;color:{TintaSuave};margin:20px 0 0\">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href=\"{url}\" style=\"color:{Morado};word-break:break-all\">{url}</a></p>");
                    tras = true;
                    break;
            }
        }
        cuerpo.Append($"<p style=\"{Fuente};font-size:12px;line-height:1.5;color:{TintaSuave};margin:20px 0 0;border-top:1px solid #E6E2D8;padding-top:12px\">{Texto(AvisoAutomatico)}</p>");

        var filas =
            $"<tr><td style=\"background:{Morado};padding:24px 32px\" class=\"pad\">{Img(LogoSimus, token, "SIMUS", "display:block")}</td></tr>"
            + $"<tr><td style=\"background:{Amarillo};height:6px;font-size:0;line-height:0\">&nbsp;</td></tr>"
            + $"<tr><td class=\"pad\" style=\"padding:32px\"><h1 class=\"ttl\" style=\"{Fuente};margin:0 0 16px;font-size:24px;line-height:1.25;color:{Morado}\">{Texto(titulo)}</h1>"
            + cuerpo + "</td></tr>"
            + Pie(token);
        return Marco(asunto ?? titulo, filas, titulo);
    }

    /// <summary>Escapa lo que el HTML interpreta y deja los acentos tal cual (el documento es UTF-8).</summary>
    private static string Texto(string valor) =>
        valor.Replace("&", "&amp;", StringComparison.Ordinal).Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal).Replace("\"", "&quot;", StringComparison.Ordinal)
            .Replace("'", "&#39;", StringComparison.Ordinal);
}
