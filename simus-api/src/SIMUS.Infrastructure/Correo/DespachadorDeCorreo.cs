using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Infrastructure.Correo;

/// <summary>Lo que pasó en una revisión de la cola.</summary>
public sealed record ResultadoDeDespacho(int Enviados, int Reintentos, int Fallidos);

/// <summary>
/// Vacía la cola de salida: envía los correos <c>pendiente</c> de <c>dbo.Notificaciones</c>.
/// </summary>
/// <remarks>
/// <para>
/// <b>LA COLA YA EXISTIA.</b> <see cref="EnviadorDeCorreoPendienteDeProveedor"/> deja cada mensaje
/// en la tabla dentro de la misma transacción que lo origina; este despachador solo los recoge. Así
/// un registro que se deshace no manda un correo de algo que no existe.
/// </para>
/// <para>
/// <b>GUARDA DESPUES DE CADA MENSAJE.</b> Si el proceso se cae a mitad de lote, lo ya enviado queda
/// marcado <c>enviada</c> y no se repite.
/// </para>
/// <para>
/// <b>UNA SOLA INSTANCIA.</b> No reserva filas entre procesos: con varias réplicas del API un
/// mensaje podría salir dos veces. La demo y el despliegue previsto usan una.
/// </para>
/// </remarks>
public sealed partial class DespachadorDeCorreo(
    SimusDbContext db,
    ITransporteDeCorreo transporte,
    OpcionesDeCorreo opciones,
    TimeProvider reloj)
{
    public const string EstadoEnviada = "enviada";
    public const string EstadoFallida = "fallida";
    private const int LongitudMaximaDelError = 1200;

    public async Task<ResultadoDeDespacho> DespacharLoteAsync(CancellationToken cancellationToken)
    {
        var pendientes = await db.Notifications
            .Where(n => n.Channel == EnviadorDeCorreoPendienteDeProveedor.Canal
                && n.Status == EnviadorDeCorreoPendienteDeProveedor.EstadoPendiente
                && n.RecipientEmail != null
                && n.Attempts < opciones.MaximoIntentos)
            .OrderBy(n => n.CreatedAt)
            .ThenBy(n => n.Id)
            .Take(opciones.TamanoDeLote)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        int enviados = 0, reintentos = 0, fallidos = 0;
        foreach (var notificacion in pendientes)
        {
            notificacion.Attempts++;
            try
            {
                var cuerpo = CompletarEnlaces(notificacion.Body, opciones.UrlPublica);
                await transporte.EnviarAsync(
                    new MensajeDeCorreo(
                        notificacion.RecipientEmail!,
                        notificacion.Title,
                        cuerpo,
                        PlantillaDeCorreoSimus.HtmlPara(notificacion.EventType, cuerpo, notificacion.Title),
                        PlantillaDeCorreoSimus.EnlaceDeUnClicDeBaja(cuerpo)),
                    cancellationToken).ConfigureAwait(false);
                notificacion.Status = EstadoEnviada;
                notificacion.SentAt = reloj.GetUtcNow().UtcDateTime;
                notificacion.Error = null;
                enviados++;
            }
            catch (Exception excepcion) when (excepcion is not OperationCanceledException)
            {
                notificacion.Error = Recortar(excepcion.Message);
                if (notificacion.Attempts >= opciones.MaximoIntentos)
                {
                    notificacion.Status = EstadoFallida;
                    fallidos++;
                }
                else
                {
                    reintentos++;
                }
            }

            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return new ResultadoDeDespacho(enviados, reintentos, fallidos);
    }

    /// <summary>
    /// Antepone la dirección pública a los enlaces relativos que ocupan una línea propia.
    /// </summary>
    /// <remarks>
    /// El API escribe los enlaces sin dominio (<c>/ecosistema/confirmar-correo?testigo=…</c>) porque
    /// el dominio depende del despliegue. Solo se completan las líneas que son únicamente una ruta:
    /// el resto del texto no se toca.
    /// </remarks>
    public static string CompletarEnlaces(string cuerpo, string? urlPublica)
    {
        ArgumentNullException.ThrowIfNull(cuerpo);
        if (string.IsNullOrWhiteSpace(urlPublica)) return cuerpo;
        var baseUrl = urlPublica.TrimEnd('/');
        return LineaConRutaRelativa().Replace(cuerpo, coincidencia => baseUrl + coincidencia.Value);
    }

    private static string Recortar(string texto) =>
        texto.Length <= LongitudMaximaDelError ? texto : texto[..LongitudMaximaDelError];

    [GeneratedRegex(@"(?m)^/[^\s/][^\s]*(?=\r?$)")]
    private static partial Regex LineaConRutaRelativa();
}
