using System.Security.Cryptography;
using System.Text;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La baja pública del boletín: el enlace «Darme de baja» que acompaña a cada correo.
/// </summary>
/// <remarks>
/// <para>
/// <b>EL VACÍO QUE CIERRA.</b> La autorización del boletín promete que la persona puede revocar «desde el enlace que
/// acompaña a cada envío», y los correos prometen «darme de baja», pero solo existía la baja manual de la consola. Era
/// una brecha de cumplimiento del tratamiento de datos (Ley 1581, art. 8: revocar la autorización).
/// </para>
/// <para>
/// <b>EL ENLACE ES UNA FIRMA, NO UN SECRETO GUARDADO.</b> El testigo es <c>{id}.{HMAC-SHA256}</c> sobre el identificador y
/// el correo de la suscripción con la clave <c>Correo:ClaveDeBaja</c>. No es adivinable (256 bits), no hay nada que guardar
/// ni que cambie al reenviar, sirve para las suscripciones que ya existen y no vence: darse de baja es un derecho, y un
/// correo de hace un año tiene que seguir funcionando. A diferencia del enlace de confirmación NO es de un solo uso, sino
/// idempotente: abrirlo dos veces deja la misma baja.
/// </para>
/// <para>
/// <b>EN DOS TIEMPOS.</b> Abrir el enlace solo muestra la pantalla; la baja la hace el botón (POST). Los antivirus y las
/// vistas previas abren enlaces por quien los recibe. La excepción es el «un clic» de la cabecera
/// <c>List-Unsubscribe-Post</c> (RFC 8058), que el cliente de correo invoca por un acto explícito de la persona.
/// </para>
/// <para>
/// <b>NO REVELA SI UN CORREO EXISTE.</b> No hay ruta que reciba un correo: solo se llega con un testigo firmado, y uno
/// inválido responde siempre lo mismo.
/// </para>
/// </remarks>
internal sealed class BajaDelBoletin
{
    internal const string OrigenPersona = "persona";
    internal const string OrigenAdministracion = "administracion";

    private const string ClaveSoloLocal = "simus-baja-del-boletin-solo-para-desarrollo-local";

    private readonly byte[] _clave;

    internal BajaDelBoletin(byte[] clave) => _clave = clave;

    /// <summary>
    /// La clave que firma los enlaces: la configurada; en entornos locales, una fija de desarrollo; en cualquier otro
    /// sin configurar, una aleatoria del proceso (los enlaces dejan de servir al reiniciar, que es mejor que firmarlos
    /// con una clave que cualquiera puede leer en el repositorio). En Production la exige <c>OpcionesDeCorreo.Validar</c>.
    /// </summary>
    internal static BajaDelBoletin Crear(OpcionesDeCorreo opciones, bool esEntornoLocal)
    {
        if (!string.IsNullOrWhiteSpace(opciones.ClaveDeBaja)) return new(Encoding.UTF8.GetBytes(opciones.ClaveDeBaja));
        return new(esEntornoLocal ? Encoding.UTF8.GetBytes(ClaveSoloLocal) : RandomNumberGenerator.GetBytes(32));
    }

    internal static string RutaDeBaja(string testigo) => $"{PlantillaDeCorreoSimus.RutaDeBajaDelBoletin}?testigo={testigo}";

    /// <summary>El testigo firmado de una suscripción ya guardada (tiene identificador).</summary>
    internal string TestigoDe(BoletinSuscripcionRow suscripcion)
    {
        if (suscripcion.Id <= 0) throw new InvalidOperationException("La suscripción debe estar guardada para tener enlace de baja.");
        return $"{suscripcion.Id}.{Firmar(suscripcion)}";
    }

    /// <summary>Si el testigo es auténtico para esa fila. Tiempo constante.</summary>
    internal bool Coincide(BoletinSuscripcionRow suscripcion, string testigo)
    {
        var esperado = Encoding.ASCII.GetBytes(TestigoDe(suscripcion));
        var recibido = Encoding.UTF8.GetBytes(testigo);
        return CryptographicOperations.FixedTimeEquals(esperado, recibido);
    }

    /// <summary>El identificador que dice llevar el testigo, o nulo si no tiene la forma.</summary>
    internal static int? IdDe(string? testigo)
    {
        if (string.IsNullOrWhiteSpace(testigo) || testigo.Length > 128) return null;
        var punto = testigo.IndexOf('.');
        return punto > 0 && int.TryParse(testigo.AsSpan(0, punto), System.Globalization.NumberStyles.None, null, out var id) && id > 0
            ? id
            : null;
    }

    private string Firmar(BoletinSuscripcionRow suscripcion)
    {
        using var hmac = new HMACSHA256(_clave);
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"baja-boletin:{suscripcion.Id}:{suscripcion.CorreoElectronico}")))
            .ToLowerInvariant();
    }

    /// <summary>
    /// Pasa la suscripción a «baja» y retira la autorización. Idempotente: si ya estaba de baja no toca nada y devuelve
    /// falso. NO se borra la fila: si se borrara, reimportar una lista vieja volvería a escribirle a quien se fue.
    /// </summary>
    internal static async Task<bool> AplicarAsync(
        SimusDbContext db, BoletinSuscripcionRow fila, string origen, DateTime ahora, string motivo, CancellationToken ct)
    {
        if (fila.Estado == "baja") return false;

        fila.Estado = "baja";
        fila.FechaBaja = ahora;
        fila.OrigenBaja = origen;
        // Un enlace de confirmación pendiente ya no debe servir: quien se da de baja no quiere confirmar nada.
        fila.HashTestigo = null;
        fila.FechaEmisionTestigo = null;

        // La baja retira también la autorización: dejarla vigente diría que sigue autorizando un envío que ya no recibe.
        await RegistroDeAutorizaciones.RevocarAsync(
            db, FinalidadesDeDatos.Boletin, ahora, motivo, idUsuario: null, correoTitular: fila.CorreoElectronico, ct);
        return true;
    }

    /// <summary>«a***@d***.co»: lo justo para que la persona reconozca su correo sin enseñarlo entero.</summary>
    internal static string Enmascarar(string correo)
    {
        var arroba = correo.IndexOf('@');
        if (arroba <= 0) return "***";
        var local = correo[..arroba];
        var dominio = correo[(arroba + 1)..];
        var punto = dominio.IndexOf('.');
        var host = punto > 0 ? dominio[..punto] : dominio;
        var resto = punto > 0 ? dominio[punto..] : string.Empty;
        return $"{local[0]}***@{host[0]}***{resto}";
    }
}
