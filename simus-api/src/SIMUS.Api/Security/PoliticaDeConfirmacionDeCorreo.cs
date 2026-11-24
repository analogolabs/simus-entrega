using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace SIMUS.Api.Security;

/// <summary>
/// Decide si el correo confirmado es requisito para operar como organización.
/// </summary>
/// <remarks>
/// La excepción sirve exclusivamente para una demostración controlada: no confirma correos,
/// no cambia cuentas ni organizaciones y no toca autenticación, CSRF o pertenencia. Producción
/// permanece cerrada aunque alguien copie la clave de configuración por error.
/// </remarks>
public sealed class PoliticaDeConfirmacionDeCorreo
{
    public const string ClavePermitirOperacionSinConfirmacion = "Demo:PermitirOperacionSinCorreoConfirmado";

    private PoliticaDeConfirmacionDeCorreo(bool confirmacionObligatoria) =>
        ConfirmacionObligatoria = confirmacionObligatoria;

    /// <summary>Si las operaciones externas deben exigir un correo realmente confirmado.</summary>
    public bool ConfirmacionObligatoria { get; }

    public static PoliticaDeConfirmacionDeCorreo Crear(IConfiguration configuracion, IHostEnvironment entorno)
    {
        var permitirExcepcion = configuracion.GetValue<bool>(ClavePermitirOperacionSinConfirmacion);
        if (permitirExcepcion && !EsEntornoPermitido(entorno))
        {
            throw new InvalidOperationException(
                $"{ClavePermitirOperacionSinConfirmacion} solo puede habilitarse en Development, Local, Demo o Test. "
                + $"El entorno actual es '{entorno.EnvironmentName}'.");
        }

        return new PoliticaDeConfirmacionDeCorreo(confirmacionObligatoria: !permitirExcepcion);
    }

    private static bool EsEntornoPermitido(IHostEnvironment entorno) =>
        entorno.IsDevelopment()
        || entorno.IsEnvironment("Local")
        || entorno.IsEnvironment("Demo")
        || entorno.IsEnvironment("Test");
}
