using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La doble confirmación del boletín (hallazgo S-10 de la auditoría de seguridad).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL PROBLEMA.</b> Hasta ahora cualquiera escribía un correo ajeno en la portada y quedaba
/// «activa» con una autorización registrada a nombre de ese correo: acoso por correo, el PNMC usado
/// como relé de spam y un consentimiento que su titular nunca dio (Ley 1581: la prueba es del
/// responsable).
/// </para>
/// <para>
/// <b>EL ALTA ES UNA SOLICITUD.</b> Crea una fila <c>Confirmada = 0</c> y envía un enlace con un
/// testigo de 256 bits (32 bytes aleatorios) del que solo se guarda el hash, igual que la
/// confirmación de la cuenta y la recuperación de contraseña. La autorización de tratamiento se
/// escribe <b>al confirmar</b>, con el texto vigente en ese momento. Hasta entonces la fila no
/// recibe el boletín, no cuenta como autorización y la consola no la ve.
/// </para>
/// <para>
/// <b>NO SE ENVÍA UN CORREO CADA VEZ.</b> Un reenvío a la misma dirección espera
/// <see cref="EsperaEntreEnvios"/>: sin ese espacio, repetir el formulario con el correo de otra
/// persona sería una forma de llenarle el buzón (el límite por IP no basta con varias IP).
/// </para>
/// </remarks>
internal static class BoletinDobleConfirmacion
{
    /// <summary>Cuánto vive el enlace. Igual que la confirmación de la cuenta.</summary>
    internal static readonly TimeSpan Vigencia = TimeSpan.FromDays(3);

    /// <summary>Espacio mínimo entre dos correos de confirmación a la misma dirección.</summary>
    internal static readonly TimeSpan EsperaEntreEnvios = TimeSpan.FromMinutes(10);

    /// <summary>Cuánto se conserva una solicitud que nadie confirmó antes de borrarla.</summary>
    internal static readonly TimeSpan RetencionDeSolicitudes = TimeSpan.FromDays(30);

    internal const string TipoDeEvento = PlantillaDeCorreoSimus.TipoConfirmacionDeBoletin;

    /// <summary>La ruta pública del sitio que recibe el testigo.</summary>
    internal static string RutaDeConfirmacion(string testigo) => $"/ecosistema/confirmar-boletin?testigo={testigo}";

    /// <summary>
    /// Emite un enlace nuevo para la suscripción y deja el mensaje en la cola de salida. Devuelve
    /// falso, sin tocar nada, si ya se envió uno hace menos de <see cref="EsperaEntreEnvios"/>.
    /// No guarda: quien llama decide la transacción, pero la suscripción debe estar guardada (el enlace de baja
    /// lleva su identificador).
    /// </summary>
    internal static async Task<bool> EmitirAsync(
        IEnviadorDeCorreo correo, BajaDelBoletin baja, BoletinSuscripcionRow suscripcion, DateTime ahora, CancellationToken ct)
    {
        if (suscripcion.FechaEmisionTestigo is { } ultima && ahora - ultima < EsperaEntreEnvios) return false;

        var testigo = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        suscripcion.HashTestigo = Resumir(testigo);
        suscripcion.FechaEmisionTestigo = ahora;

        await correo.EncolarAsync(
            new CorreoSaliente(
                suscripcion.CorreoElectronico,
                "Confirma tu suscripción al boletín del SIMUS",
                "Hola.\n\n"
                + "Recibimos una solicitud para suscribir este correo al boletín del Sistema de Información de la Música (SIMUS), "
                + "administrado por el Plan Nacional de Música para la Convivencia · Ministerio de las Culturas, las Artes y los Saberes.\n\n"
                + "En el boletín recibirás noticias del ecosistema musical colombiano, la agenda de eventos del mes, "
                + "convocatorias abiertas y crónicas de los territorios.\n\n"
                + "Para activar la suscripción y dejar constancia de tu autorización de tratamiento de datos, abre este enlace:\n\n"
                + $"{RutaDeConfirmacion(testigo)}\n\n"
                + $"El enlace sirve una sola vez y vence en {Vigencia.TotalDays:0} días. "
                + "Si no lo pediste tú, ignora este mensaje: no se activará nada y no recibirás el boletín.\n\n"
                + PlantillaDeCorreoSimus.PieDeBajaTexto(BajaDelBoletin.RutaDeBaja(baja.TestigoDe(suscripcion))),
                TipoDeEvento),
            ct);
        return true;
    }

    /// <summary>La suscripción a la que pertenece el testigo, o por qué no hay ninguna.</summary>
    internal static async Task<(ResultadoDeConfirmacionDeBoletin Resultado, BoletinSuscripcionRow? Suscripcion)> BuscarAsync(
        SimusDbContext db, string? testigo, DateTime ahora, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(testigo) || testigo.Length > 128) return (ResultadoDeConfirmacionDeBoletin.NoValido, null);

        var hash = Resumir(testigo.Trim());
        var fila = await db.BoletinSuscripciones.FirstOrDefaultAsync(item => item.HashTestigo == hash, ct);
        if (fila is null || fila.FechaEmisionTestigo is null) return (ResultadoDeConfirmacionDeBoletin.NoValido, null);
        if (fila.FechaEmisionTestigo.Value.Add(Vigencia) <= ahora) return (ResultadoDeConfirmacionDeBoletin.Vencido, null);
        return (ResultadoDeConfirmacionDeBoletin.Confirmado, fila);
    }

    /// <summary>
    /// Borra las solicitudes que nadie confirmó y ya pasaron la retención. No tienen autorización
    /// escrita —nunca la hubo—, así que no queda constancia de nada que conservar.
    /// </summary>
    internal static Task<int> DepurarAsync(SimusDbContext db, DateTime ahora, CancellationToken ct)
    {
        var limite = ahora - RetencionDeSolicitudes;
        return db.BoletinSuscripciones
            .Where(item => !item.Confirmada && item.FechaAlta < limite)
            .ExecuteDeleteAsync(ct);
    }

    internal static string Resumir(string testigo) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(testigo))).ToLowerInvariant();
}

internal enum ResultadoDeConfirmacionDeBoletin
{
    Confirmado,
    NoValido,
    Vencido,
}
