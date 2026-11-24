using System.Net.Mail;

namespace SIMUS.Infrastructure.Correo;

/// <summary>
/// Cómo sale el correo de SIMUS: sección <c>Correo</c> de la configuración.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR DEFECTO NO SALE NADA.</b> Con <c>Proveedor = Ninguno</c> los mensajes se quedan en la cola
/// de <c>dbo.Notificaciones</c> con estado <c>pendiente</c>, que es el modo de pre-entrega. Con
/// <c>Proveedor = Smtp</c> un servicio en segundo plano los envía por cualquier servidor SMTP
/// (Microsoft 365, Google Workspace, SendGrid, Azure Communication Services, Brevo…).
/// </para>
/// <para>
/// <b>LA CLAVE NO VA EN NINGUN ARCHIVO DEL REPOSITORIO.</b> Se pasa como variable de entorno
/// (<c>Correo__Smtp__Clave</c>) o secreto del servidor. Ver
/// <c>docs/operacion/15-modos-de-ejecucion-y-paso-a-produccion.md</c>.
/// </para>
/// </remarks>
public sealed class OpcionesDeCorreo
{
    public const string Seccion = "Correo";
    public const string ProveedorNinguno = "Ninguno";
    public const string ProveedorSmtp = "Smtp";

    /// <summary><c>Ninguno</c> (no se envía) o <c>Smtp</c>.</summary>
    public string Proveedor { get; set; } = ProveedorNinguno;

    /// <summary>
    /// Dirección pública del sitio, por ejemplo <c>https://simus.gov.co</c>. Completa los enlaces
    /// relativos de los mensajes, que el API escribe sin dominio a propósito.
    /// </summary>
    public string? UrlPublica { get; set; }

    /// <summary>Dirección desde la que salen los mensajes, por ejemplo <c>no-responder@simus.gov.co</c>.</summary>
    public string? Remitente { get; set; }

    public string NombreRemitente { get; set; } = "SIMUS";

    /// <summary>
    /// Clave con la que se firman los enlaces «Darme de baja» del boletín (HMAC-SHA256). Va en secreto del servidor
    /// (<c>Correo__ClaveDeBaja</c>), nunca en el repositorio, y no debe cambiar: si cambia, los enlaces ya enviados dejan
    /// de servir. En Production es obligatoria (32 caracteres como mínimo).
    /// </summary>
    public string? ClaveDeBaja { get; set; }

    public OpcionesSmtp Smtp { get; set; } = new();

    /// <summary>Cada cuántos segundos se revisa la cola.</summary>
    public int IntervaloSegundos { get; set; } = 30;

    /// <summary>Intentos antes de marcar un mensaje como <c>fallida</c>.</summary>
    public int MaximoIntentos { get; set; } = 5;

    /// <summary>Cuántos mensajes se envían como máximo en cada revisión.</summary>
    public int TamanoDeLote { get; set; } = 20;

    public bool EnvioActivo => string.Equals(Proveedor, ProveedorSmtp, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Detiene el arranque si la configuración no permite cumplir lo que promete.
    /// </summary>
    /// <param name="exigirProveedor">
    /// Verdadero en <c>Production</c>: allí la confirmación de correo es obligatoria, y sin proveedor
    /// nadie podría completarla. Es la forma de que nadie entregue por error con el correo apagado.
    /// </param>
    public void Validar(bool exigirProveedor)
    {
        var errores = new List<string>();

        if (!EnvioActivo && !string.Equals(Proveedor, ProveedorNinguno, StringComparison.OrdinalIgnoreCase))
            errores.Add($"Correo:Proveedor tiene un valor desconocido ('{Proveedor}'). Use '{ProveedorNinguno}' o '{ProveedorSmtp}'.");
        else if (!EnvioActivo && exigirProveedor)
            errores.Add(
                $"Correo:Proveedor está en '{ProveedorNinguno}'. En Production SIMUS exige un proveedor de correo "
                + "para que las cuentas puedan confirmar su dirección. Configure Correo:Proveedor=Smtp o use el "
                + "entorno Demo mientras no haya proveedor.");

        if (EnvioActivo)
        {
            if (string.IsNullOrWhiteSpace(Smtp.Servidor))
                errores.Add("Correo:Smtp:Servidor es obligatorio con el proveedor Smtp.");
            if (Smtp.Puerto is < 1 or > 65535)
                errores.Add("Correo:Smtp:Puerto debe estar entre 1 y 65535.");
            if (string.IsNullOrWhiteSpace(Smtp.Usuario) != string.IsNullOrWhiteSpace(Smtp.Clave))
                errores.Add("Correo:Smtp:Usuario y Correo:Smtp:Clave van juntos: se definen los dos o ninguno.");
            if (!MailAddress.TryCreate(Remitente, out _))
                errores.Add("Correo:Remitente debe ser una dirección de correo válida.");
            if (!Uri.TryCreate(UrlPublica, UriKind.Absolute, out var url)
                || (url.Scheme != Uri.UriSchemeHttps && url.Scheme != Uri.UriSchemeHttp))
                errores.Add("Correo:UrlPublica debe ser la dirección completa del sitio, por ejemplo https://simus.gov.co.");
        }

        if (exigirProveedor && (ClaveDeBaja?.Trim().Length ?? 0) < 32)
            errores.Add("Correo:ClaveDeBaja es obligatoria en Production (32 caracteres como mínimo): firma el enlace «Darme de baja» del boletín.");

        if (IntervaloSegundos is < 5 or > 3600)
            errores.Add("Correo:IntervaloSegundos debe estar entre 5 y 3600.");
        if (MaximoIntentos is < 1 or > 20)
            errores.Add("Correo:MaximoIntentos debe estar entre 1 y 20.");
        if (TamanoDeLote is < 1 or > 200)
            errores.Add("Correo:TamanoDeLote debe estar entre 1 y 200.");

        if (errores.Count > 0)
            throw new InvalidOperationException(
                "Configuración de correo no válida: " + string.Join(" ", errores)
                + " Ver docs/operacion/15-modos-de-ejecucion-y-paso-a-produccion.md.");
    }
}

/// <summary>Datos del servidor SMTP. El puerto 587 con TLS es el habitual de los proveedores.</summary>
public sealed class OpcionesSmtp
{
    public string? Servidor { get; set; }
    public int Puerto { get; set; } = 587;
    public bool UsarTls { get; set; } = true;
    public string? Usuario { get; set; }
    public string? Clave { get; set; }
}
