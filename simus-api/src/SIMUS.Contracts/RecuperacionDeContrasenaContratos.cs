namespace SIMUS.Contracts;

/// <summary>
/// Quien dice haber olvidado su contraseña.
/// </summary>
/// <remarks>
/// SOLO EL CORREO. La respuesta es la misma exista o no la cuenta, así que esta petición no sirve
/// para averiguar quién está registrado.
/// </remarks>
public sealed class SolicitudDeRecuperacionDeContrasena
{
    public string? Correo { get; set; }
}

/// <summary>El testigo del enlace que llegó por correo. Viaja en el cuerpo, nunca en la ruta.</summary>
public sealed class ComprobacionDeEnlaceDeRecuperacion
{
    public string? Testigo { get; set; }
}

/// <summary>El testigo y la contraseña nueva. Ninguno de los dos se registra en bitácora ni en logs.</summary>
public sealed class RestablecimientoDeContrasenaSolicitud
{
    public string? Testigo { get; set; }
    public string? Nueva { get; set; }
}

/// <summary>
/// Si el enlace sirve, y si no, por qué. <c>CorreoEnmascarado</c> solo viaja con un enlace válido: lo
/// recibió quien tiene el secreto, y verlo parcialmente le dice a qué cuenta pertenece.
/// </summary>
public sealed record EstadoDelEnlaceDeRecuperacion(bool Valido, string? Motivo, string? CorreoEnmascarado);
