using System.Net;
using System.Net.Mail;
using System.Text;

namespace SIMUS.Infrastructure.Correo;

/// <summary>Un mensaje listo para entregarse, con los enlaces ya completos.</summary>
/// <param name="EnlaceDeBaja">
/// Enlace absoluto que da de baja con un solo POST (RFC 8058). Solo lo llevan los correos del boletín; con él, el
/// transporte añade <c>List-Unsubscribe</c> y, si es https, <c>List-Unsubscribe-Post</c>.
/// </param>
public sealed record MensajeDeCorreo(string Destinatario, string Asunto, string Cuerpo, string? CuerpoHtml = null, string? EnlaceDeBaja = null);

/// <summary>
/// Entrega un mensaje a un proveedor externo. Si falla, lanza: quien llama decide el reintento.
/// </summary>
public interface ITransporteDeCorreo
{
    Task EnviarAsync(MensajeDeCorreo mensaje, CancellationToken cancellationToken);
}

/// <summary>
/// Entrega por SMTP: sirve con cualquier proveedor que lo ofrezca.
/// </summary>
/// <remarks>
/// Usa <see cref="SmtpClient"/> de la biblioteca estándar para no añadir dependencias. Admite el
/// puerto 587 con STARTTLS (<c>UsarTls = true</c>), que es lo que ofrecen Microsoft 365, Google
/// Workspace, SendGrid, Azure Communication Services y Brevo. No admite TLS implícito (puerto 465).
/// </remarks>
public sealed class TransporteSmtp(OpcionesDeCorreo opciones) : ITransporteDeCorreo
{
    public async Task EnviarAsync(MensajeDeCorreo mensaje, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(mensaje);

        using var correo = new MailMessage(
            new MailAddress(opciones.Remitente!, opciones.NombreRemitente),
            new MailAddress(mensaje.Destinatario))
        {
            Subject = mensaje.Asunto,
            Body = mensaje.Cuerpo,
            IsBodyHtml = false,
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8,
        };

        AgregarCabecerasDeBaja(correo, mensaje.EnlaceDeBaja);

        if (!string.IsNullOrWhiteSpace(mensaje.CuerpoHtml))
        {
            // Texto plano y HTML en la misma carta; los logotipos viajan incrustados por CID.
            correo.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(mensaje.Cuerpo, Encoding.UTF8, "text/plain"));
            var vista = AlternateView.CreateAlternateViewFromString(mensaje.CuerpoHtml, Encoding.UTF8, "text/html");
            foreach (var imagen in PlantillaDeCorreoSimus.ImagenesCitadas(mensaje.CuerpoHtml))
                vista.LinkedResources.Add(new LinkedResource(new MemoryStream(PlantillaDeCorreoSimus.LeerImagen(imagen.Imagen)), "image/png") { ContentId = imagen.Cid });
            correo.AlternateViews.Add(vista);
        }

        using var cliente = new SmtpClient(opciones.Smtp.Servidor, opciones.Smtp.Puerto)
        {
            EnableSsl = opciones.Smtp.UsarTls,
            DeliveryMethod = SmtpDeliveryMethod.Network,
        };
        if (!string.IsNullOrWhiteSpace(opciones.Smtp.Usuario))
            cliente.Credentials = new NetworkCredential(opciones.Smtp.Usuario, opciones.Smtp.Clave);

        await cliente.SendMailAsync(correo, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// <c>List-Unsubscribe</c> y <c>List-Unsubscribe-Post</c> (RFC 8058): el botón «Cancelar suscripción» del cliente de
    /// correo. La segunda cabecera solo se envía con https, que es lo que exige el RFC para el «un clic».
    /// </summary>
    internal static void AgregarCabecerasDeBaja(MailMessage correo, string? enlaceDeBaja)
    {
        if (!Uri.TryCreate(enlaceDeBaja, UriKind.Absolute, out var url)
            || (url.Scheme != Uri.UriSchemeHttps && url.Scheme != Uri.UriSchemeHttp)) return;

        correo.Headers.Add("List-Unsubscribe", $"<{url.AbsoluteUri}>");
        if (url.Scheme == Uri.UriSchemeHttps) correo.Headers.Add("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
    }
}
