using System.Security.Cryptography;
using System.Text;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Las reglas de la recuperación de contraseña de las cuentas externas (
/// <c>docs/desarrollo/19-cuentas-y-organizaciones.md</c> §19.9).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL ENLACE ES LA CREDENCIAL.</b> Un testigo de 256 bits aleatorios (32 bytes del generador
/// criptográfico del sistema); en la base solo queda su resumen SHA-256, de modo que leer la tabla no
/// permite restablecer la contraseña de nadie. Vale una sola vez, vive una hora y solo hay uno vivo
/// por cuenta: pedir otro invalida el anterior.
/// </para>
/// <para>
/// <b>LOS LÍMITES ESTÁN HECHOS PARA NO REGALAR UNA DENEGACIÓN DE SERVICIO.</b> Por origen, el mismo
/// limitador de las puertas externas (<c>external-recuperacion</c>). Por cuenta, tres solicitudes por
/// hora y dos minutos entre una y otra, contadas sobre la propia tabla, así que valen aunque haya
/// varias instancias del API. Pasado el tope no se contesta distinto ni se bloquea nada: simplemente
/// no se emite otro enlace, y el último que llegó al buzón sigue sirviendo. Un tercero que conozca el
/// correo no puede dejar a su dueño sin recuperar la cuenta ni llenarle el buzón.
/// </para>
/// </remarks>
internal static class RecuperacionDeContrasena
{
    /// <summary>Cuánto vive un enlace. Corto a propósito: una hora basta para abrir el correo.</summary>
    internal static readonly TimeSpan Vigencia = TimeSpan.FromMinutes(60);

    /// <summary>Solicitudes que se atienden por cuenta en una hora.</summary>
    internal const int MaximoPorHora = 3;

    /// <summary>Tiempo mínimo entre dos solicitudes de la misma cuenta.</summary>
    internal static readonly TimeSpan EsperaEntreSolicitudes = TimeSpan.FromMinutes(2);

    /// <summary>
    /// Duración mínima de la respuesta a la solicitud. Hace que atender una cuenta real (consultas,
    /// escritura y cola de correo) no se distinga por el tiempo de una inexistente (una consulta).
    /// </summary>
    internal static readonly TimeSpan DuracionMinima = TimeSpan.FromMilliseconds(450);

    internal const string TipoDeEventoDelEnlace = "RecuperacionDeContrasena";
    internal const string TipoDeEventoDelAviso = "ContrasenaRestablecida";

    internal const string Ruta = "/ecosistema/restablecer-contrasena";

    /// <summary>Lo único que contesta la solicitud: no dice si la cuenta existe.</summary>
    internal const string MensajeNeutro =
        "Si existe una cuenta externa con ese correo, te enviamos un enlace para restablecer la contraseña. "
        + "Vale 60 minutos y una sola vez. Revisa tu bandeja de entrada y la carpeta de correo no deseado.";

    internal static string NuevoTestigo() =>
        Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    internal static string Resumir(string testigo) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(testigo))).ToLowerInvariant();

    /// <summary>
    /// El enlace que va en el correo, armado con la dirección pública configurada
    /// (<c>Correo:UrlPublica</c>) y NUNCA con el encabezado <c>Host</c> de la petición: ese lo
    /// controla quien llama, y un enlace construido con él llevaría a quien lo abra a un sitio ajeno
    /// con su testigo. Si no hay dirección configurada (modo demo) queda la ruta relativa, que el
    /// despachador completa con la misma configuración al enviar.
    /// </summary>
    internal static string EnlaceDe(string testigo, string? urlPublica)
    {
        var ruta = $"{Ruta}?testigo={testigo}";
        return string.IsNullOrWhiteSpace(urlPublica) ? ruta : urlPublica.Trim().TrimEnd('/') + ruta;
    }
}
