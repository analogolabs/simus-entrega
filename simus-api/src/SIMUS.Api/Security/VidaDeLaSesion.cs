using System.Globalization;
using Microsoft.AspNetCore.Authentication;

namespace SIMUS.Api.Security;

/// <summary>
/// Cuánto puede durar una sesión de principio a fin, y con qué propiedades se firma cada cookie (S-11).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL DEFECTO.</b> Las dos cookies eran persistentes y deslizantes de 8 horas: cada petición las renovaba, así que una
/// sesión con uso constante no vencía nunca, y una cookie copiada (equipo prestado, extensión maliciosa, respaldo de
/// navegador) seguía valiendo tras «Cerrar sesión», porque cerrar solo borraba la cookie del navegador.
/// </para>
/// <para>
/// <b>EL TOPE ABSOLUTO.</b> El momento del inicio viaja en las propiedades del tiquete (<see cref="ItemDeInicio"/>), que
/// la renovación deslizante conserva (lo que pisa es <c>IssuedUtc</c> y <c>ExpiresUtc</c>). Cada petición lo compara con
/// el tope de su puerta: 12 horas la consola, 7 días el portal. Al pasarse, la sesión se rechaza aunque la cookie siga viva.
/// Un tiquete sin esa marca (anterior a este cambio) se rechaza también: quien estaba dentro al desplegar vuelve a ingresar
/// una vez.
/// </para>
/// <para>
/// <b>LA CONSOLA YA NO ES PERSISTENTE.</b> La cookie de consola es de sesión del navegador: no sobrevive a cerrarlo. El portal
/// la conserva persistente (la gente espera seguir dentro de su organización de un día para otro) pero con el tope de 7 días.
/// </para>
/// </remarks>
public static class VidaDeLaSesion
{
    /// <summary>Clave, en las propiedades del tiquete, del instante (segundos Unix UTC) en que se abrió la sesión.</summary>
    public const string ItemDeInicio = "simus.inicio";

    /// <summary>Nombre del claim que lleva la generación de sesión de la cuenta al abrir la sesión.</summary>
    public const string ClaimDeGeneracion = "simus:generacion";

    /// <summary>Tope absoluto de una sesión de consola.</summary>
    public static readonly TimeSpan TopeDeLaConsola = TimeSpan.FromHours(12);

    /// <summary>Tope absoluto de una sesión del portal (cuentas externas).</summary>
    public static readonly TimeSpan TopeDelPortal = TimeSpan.FromDays(7);

    /// <summary>Ventana deslizante de ambas cookies.</summary>
    public static readonly TimeSpan Ventana = TimeSpan.FromHours(8);

    /// <summary>
    /// Las propiedades con las que se firma una cookie. <paramref name="inicio"/> es el inicio de una sesión que se está
    /// re-emitiendo (cambio de perfil o de clave): se conserva para que re-firmar no regale otro tope entero.
    /// </summary>
    public static AuthenticationProperties Propiedades(bool persistente, DateTimeOffset? inicio = null)
    {
        var ahora = DateTimeOffset.UtcNow;
        var propiedades = new AuthenticationProperties
        {
            IsPersistent = persistente,
            IssuedUtc = ahora,
            ExpiresUtc = ahora.Add(Ventana),
            AllowRefresh = true,
        };
        propiedades.Items[ItemDeInicio] = (inicio ?? ahora).ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        return propiedades;
    }

    /// <summary>El inicio de la sesión que dice el tiquete, o <c>null</c> si no lo trae.</summary>
    public static DateTimeOffset? InicioDe(AuthenticationProperties? propiedades) =>
        propiedades is not null
        && propiedades.Items.TryGetValue(ItemDeInicio, out var texto)
        && long.TryParse(texto, NumberStyles.Integer, CultureInfo.InvariantCulture, out var segundos)
            ? DateTimeOffset.FromUnixTimeSeconds(segundos)
            : null;

    /// <summary>¿Se pasó el tope? Un tiquete sin marca de inicio cuenta como pasado.</summary>
    public static bool SePaso(AuthenticationProperties? propiedades, TimeSpan tope, DateTimeOffset ahora) =>
        InicioDe(propiedades) is not { } inicio || ahora - inicio >= tope;
}
