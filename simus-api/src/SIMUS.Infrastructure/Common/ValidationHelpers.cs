using System.Net.Mail;
using System.Text;

namespace SIMUS.Infrastructure.Common;

public static class ValidationHelpers
{
    public static bool IsMissing(string? value) => string.IsNullOrWhiteSpace(value);

    /// <summary>
    /// ¿Es un correo que esta base va a aceptar?
    /// </summary>
    /// <remarks>
    /// <para>
    /// EL PUNTO DESPUES DE LA ARROBA NO ES UN CAPRICHO: lo exige la base.
    /// <c>dbo.Usuarios</c> lleva <c>CK_Usuarios_CorreoElectronico_Formato CHECK (CorreoElectronico
    /// LIKE '%_@_%._%')</c>. <see cref="MailAddress"/> por su cuenta acepta <c>juan@gmail</c> y
    /// <c>juan@alcaldia</c> sin rechistar, asi que la errata mas comun del mundo —escribir el correo
    /// y comerse el «.com»— pasaba el navegador, pasaba el API, y la tumbaba la base al guardar: un
    /// 500 en vez de «el correo no es valido».
    /// </para>
    /// <para>
    /// Se comprueba aqui, en la funcion que ya usan todas las rutas, y no en cada manejador: un
    /// limite de la base que solo conoce la mitad de quienes escriben en ella es el mismo defecto
    /// contado otra vez.
    /// </para>
    /// </remarks>
    public static bool IsValidEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;

        try
        {
            var recortado = value.Trim();
            var parsed = new MailAddress(recortado);
            if (!string.Equals(parsed.Address, recortado, StringComparison.OrdinalIgnoreCase)) return false;

            // El dominio tiene que tener al menos dos etiquetas, y la ultima no puede ir vacia.
            var dominio = parsed.Host;
            var punto = dominio.IndexOf('.', StringComparison.Ordinal);
            return punto > 0 && punto < dominio.Length - 1;
        }
        catch
        {
            return false;
        }
    }

    public static bool IsValidHttpUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        var trimmed = value.Trim();
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            return false;
        }

        return string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
            || string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// LA REGLA ÚNICA DE DIRECCIONES WEB. Misma que <c>core/formularios/url.ts</c> en la
    /// interfaz: se acepta sin esquema y se completa con <c>https://</c>, <c>http://</c> se guarda
    /// como <c>https://</c> y solo se admite https, con un anfitrión de al menos dos etiquetas.
    /// Devuelve la dirección lista para guardar, o <c>null</c> si está en blanco.
    /// </summary>
    /// <remarks>
    /// <b>ANTES CADA FORMULARIO TENÍA LA SUYA.</b> El alta y la edición del Festival guardaban lo que
    /// se escribiera —incluso «festival.ejemplo.org», sin esquema— y «Editar contacto» lo rechazaba
    /// después con «paginaWeb: Ingresa una URL válida», sobre un campo que ni se había tocado.
    /// </remarks>
    public static string? NormalizeHttpsUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        {
            return "https://" + trimmed["http://".Length..];
        }

        return trimmed.Contains("://", StringComparison.Ordinal) ? trimmed : "https://" + trimmed;
    }

    /// <summary>¿Es una dirección web aceptable? En blanco es válido (el dato es opcional).</summary>
    public static bool IsValidHttpsUrl(string? value)
    {
        var normal = NormalizeHttpsUrl(value);
        if (normal is null)
        {
            return true;
        }

        if (normal.Any(char.IsWhiteSpace) || !Uri.TryCreate(normal, UriKind.Absolute, out var uri))
        {
            return false;
        }

        return string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrEmpty(uri.UserInfo)
            && System.Text.RegularExpressions.Regex.IsMatch(uri.Host, @"^[^\s.@:/]+(\.[^\s.@:/]+)+$");
    }

    /// <summary>
    /// Una red social: un usuario («@festival», «festival.co») o una dirección. Los datos históricos
    /// del Programa traen usuarios sueltos, y exigir una URL completa los dejaba sin poder editarse
    ///. Un usuario se guarda tal cual; una dirección sigue la regla única.
    /// </summary>
    public static bool IsValidSocialLink(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        return EsUsuarioDeRed(value.Trim()) || IsValidHttpsUrl(value);
    }

    /// <summary>La red social lista para guardar: el usuario tal cual, la dirección con <c>https://</c>.</summary>
    public static string? NormalizeSocialLink(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return EsUsuarioDeRed(trimmed) ? trimmed : NormalizeHttpsUrl(trimmed);
    }

    // «@usuario» o «usuario»: sin barras ni esquema. Un nombre con un punto y sin «@» puede ser un
    // dominio («festival.co»): ese se trata como dirección.
    private static bool EsUsuarioDeRed(string valor) =>
        System.Text.RegularExpressions.Regex.IsMatch(valor, @"^@[A-Za-z0-9._]{2,60}$")
        || System.Text.RegularExpressions.Regex.IsMatch(valor, @"^[A-Za-z0-9_]{2,60}$");

    public const string MensajeDeRedSocial =
        "Escribe el usuario (por ejemplo @mifestival) o la dirección completa de la red social.";

    public const string MensajeDeUrl =
        "Escribe una dirección web completa, por ejemplo www.miorganizacion.org o https://miorganizacion.org.";

    /// <summary>
    /// Valida y normaliza varias direcciones a la vez. Cada una que falle deja su error en
    /// <paramref name="errores"/> bajo su clave; las válidas se devuelven normalizadas.
    /// </summary>
    public static Dictionary<string, string?> NormalizeHttpsUrls(
        IReadOnlyDictionary<string, string?> enlaces, IDictionary<string, string[]> errores)
    {
        var resultado = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var (clave, valor) in enlaces)
        {
            if (!IsValidHttpsUrl(valor))
            {
                errores[clave] = [MensajeDeUrl];
                continue;
            }

            resultado[clave] = NormalizeHttpsUrl(valor);
        }

        return resultado;
    }

    /// <summary>
    /// La regla única del teléfono: dígitos, espacios y <c>+  -</c>, con al menos siete
    /// dígitos. Misma que <c>core/formularios/telefono.ts</c>. En blanco es válido.
    /// </summary>
    public static bool IsValidPhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        var trimmed = value.Trim();
        return System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"^[+()\-\s\d]{7,80}$")
            && trimmed.Count(char.IsDigit) >= 7;
    }

    public const string MensajeDeTelefono = "Escribe un teléfono válido: solo números (mínimo 7), espacios y + ( ) -.";

    public static string SanitizeText(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim();
        var builder = new StringBuilder(trimmed.Length);
        foreach (var ch in trimmed)
        {
            if (!char.IsControl(ch) || ch is '\n' or '\r' or '\t')
            {
                builder.Append(ch);
            }
        }

        var sanitized = builder.ToString().Trim();
        if (sanitized.Length <= maxLength)
        {
            return sanitized;
        }

        return sanitized[..maxLength].TrimEnd();
    }
}
