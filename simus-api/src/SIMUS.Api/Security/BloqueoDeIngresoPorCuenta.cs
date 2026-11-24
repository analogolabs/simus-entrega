using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Security;

/// <summary>
/// Límite de intentos fallidos POR CUENTA en las dos puertas de ingreso (S-07).
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ NO BASTABA EL LÍMITE POR IP.</b> Los cupos por minuto (20 la consola, 10 el canal externo) cuentan por origen, y
/// el origen sale de <c>X-Forwarded-For</c>, que depende de la topología del despliegue. Un rociado de contraseñas (una clave
/// común contra todas las cuentas) desde muchas direcciones, o rotando la cabecera si el contenedor es alcanzable sin pasar
/// por el proxy, no gasta ningún cupo. El cupo por cuenta no depende de desde dónde se pregunta.
/// </para>
/// <para>
/// <b>LA REGLA.</b> Con <see cref="MaximoDeFallos"/> fallos en los últimos <see cref="Ventana"/> la cuenta queda bloqueada hasta
/// que el más antiguo de esos fallos salga de la ventana: un bloqueo temporal, no definitivo (un bloqueo duro regalaría una
/// denegación de servicio a quien conozca un correo). Mientras dura, ni la clave correcta entra, y los intentos hechos durante
/// el bloqueo no se anotan (no lo alargan). Un ingreso exitoso borra los fallos de la cuenta.
/// </para>
/// <para>
/// <b>NO REVELA SI LA CUENTA EXISTE.</b> Se cuenta por la huella del correo escrito, exista o no la cuenta, y la respuesta del
/// bloqueo es la misma. Quien prueba un correo inventado llega al mismo 429 que quien prueba uno real.
/// </para>
/// <para>
/// <b>EL DESBLOQUEO.</b> La recuperación de contraseña (portal) y el restablecimiento que hace el webmaster de una clave de
/// consola llaman a <see cref="LimpiarAsync"/>: quien olvidó su clave y la restablece entra de inmediato. Pedir el enlace de
/// recuperación nunca está bloqueado.
/// </para>
/// <para>
/// <b>LÍMITE CONOCIDO.</b> Peticiones simultáneas pueden pasar la comprobación antes de que se anote el fallo anterior; el
/// exceso está acotado por la concurrencia de una sola dirección, que el cupo por IP ya limita.
/// </para>
/// </remarks>
public sealed class BloqueoDeIngresoPorCuenta
{
    public const string CanalConsola = "consola";
    public const string CanalExterno = "externo";

    /// <summary>Clave de configuración del número de fallos que bloquea.</summary>
    public const string ClaveDeFallos = "Seguridad:BloqueoPorCuenta:Fallos";

    /// <summary>Clave de configuración de la ventana, en minutos.</summary>
    public const string ClaveDeVentana = "Seguridad:BloqueoPorCuenta:VentanaMinutos";

    public const int FallosPorOmision = 5;
    public const int MinutosPorOmision = 15;

    private readonly SimusDbContext _db;
    private readonly TimeProvider _reloj;

    public BloqueoDeIngresoPorCuenta(SimusDbContext db, IConfiguration configuracion, TimeProvider? reloj = null)
    {
        _db = db;
        _reloj = reloj ?? TimeProvider.System;
        MaximoDeFallos = Math.Clamp(configuracion.GetValue<int?>(ClaveDeFallos) ?? FallosPorOmision, 2, 1_000_000);
        Ventana = TimeSpan.FromMinutes(Math.Clamp(configuracion.GetValue<int?>(ClaveDeVentana) ?? MinutosPorOmision, 1, 24 * 60));
    }

    public int MaximoDeFallos { get; }

    public TimeSpan Ventana { get; }

    /// <summary>La huella con la que se cuenta una cuenta: SHA-256 de <c>canal|correo</c> normalizado, en hexadecimal minúscula.</summary>
    public static string HuellaDe(string canal, string? correoNormalizado) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{canal}|{correoNormalizado ?? string.Empty}"))).ToLowerInvariant();

    private DateTime Ahora => _reloj.GetUtcNow().UtcDateTime;

    /// <summary>Cuánto falta para que la cuenta pueda volver a intentar, o <c>null</c> si no está bloqueada.</summary>
    public async Task<TimeSpan?> EsperaAsync(string canal, string? correoNormalizado, CancellationToken ct)
    {
        var huella = HuellaDe(canal, correoNormalizado);
        var ahora = Ahora;
        var desde = ahora - Ventana;

        var recientes = await _db.IntentosDeIngresoFallidos.AsNoTracking()
            .Where(item => item.Canal == canal && item.HuellaDeCuenta == huella && item.FechaIntento > desde)
            .OrderByDescending(item => item.FechaIntento)
            .Select(item => item.FechaIntento)
            .Take(MaximoDeFallos)
            .ToListAsync(ct);

        if (recientes.Count < MaximoDeFallos)
        {
            return null;
        }

        // Se libera cuando el fallo que completa el cupo (el N-ésimo más reciente) sale de la ventana.
        var libera = recientes[^1] + Ventana;
        return libera > ahora ? libera - ahora : null;
    }

    /// <summary>Anota un fallo y poda lo que ya salió de la ventana (de esa cuenta) o tiene más de un día (de todas).</summary>
    public async Task RegistrarFalloAsync(string canal, string? correoNormalizado, CancellationToken ct)
    {
        var huella = HuellaDe(canal, correoNormalizado);
        var ahora = Ahora;

        _db.IntentosDeIngresoFallidos.Add(new IntentoDeIngresoFallidoRow
        {
            Canal = canal,
            HuellaDeCuenta = huella,
            FechaIntento = ahora,
        });
        await _db.SaveChangesAsync(ct);

        var fuera = ahora - Ventana;
        var viejo = ahora.AddDays(-1);
        await _db.IntentosDeIngresoFallidos
            .Where(item => (item.Canal == canal && item.HuellaDeCuenta == huella && item.FechaIntento <= fuera)
                || item.FechaIntento <= viejo)
            .ExecuteDeleteAsync(ct);
    }

    /// <summary>Borra los fallos de la cuenta: ingreso exitoso, recuperación de la clave o restablecimiento por el webmaster.</summary>
    public async Task LimpiarAsync(string canal, string? correoNormalizado, CancellationToken ct)
    {
        var huella = HuellaDe(canal, correoNormalizado);
        await _db.IntentosDeIngresoFallidos
            .Where(item => item.Canal == canal && item.HuellaDeCuenta == huella)
            .ExecuteDeleteAsync(ct);
    }

    /// <summary>La respuesta del bloqueo: la misma para una cuenta que existe y para una que no.</summary>
    public static IResult Respuesta(string canal, TimeSpan espera)
    {
        var minutos = Math.Max(1, (int)Math.Ceiling(espera.TotalMinutes));
        var salida = canal == CanalExterno
            ? "Si olvidaste tu contraseña, puedes recuperarla desde «¿Olvidaste tu contraseña?»."
            : "Si olvidaste tu contraseña, pide a quien administra la consola que la restablezca.";

        return Results.Problem(
            title: "Demasiados intentos",
            detail: $"Hubo demasiados intentos de ingreso con estos datos. Espera {minutos} {(minutos == 1 ? "minuto" : "minutos")} y vuelve a intentarlo. {salida}",
            statusCode: StatusCodes.Status429TooManyRequests,
            extensions: new Dictionary<string, object?> { ["retryAfterSeconds"] = (int)Math.Ceiling(espera.TotalSeconds) });
    }
}
