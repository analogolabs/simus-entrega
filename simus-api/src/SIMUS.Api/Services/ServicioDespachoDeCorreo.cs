using SIMUS.Infrastructure.Correo;

namespace SIMUS.Api.Services;

/// <summary>
/// Revisa la cola de correo cada <see cref="OpcionesDeCorreo.IntervaloSegundos"/> segundos.
/// </summary>
/// <remarks>
/// Solo se registra con <c>Correo:Proveedor = Smtp</c>. Un fallo no detiene el servicio: se anota y
/// se reintenta en la siguiente vuelta, igual que la retención de importaciones.
/// </remarks>
public sealed partial class ServicioDespachoDeCorreo(
    IServiceScopeFactory alcances,
    OpcionesDeCorreo opciones,
    TimeProvider reloj,
    ILogger<ServicioDespachoDeCorreo> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await EjecutarCicloAsync(stoppingToken);
        using var temporizador = new PeriodicTimer(TimeSpan.FromSeconds(opciones.IntervaloSegundos), reloj);
        while (await temporizador.WaitForNextTickAsync(stoppingToken))
            await EjecutarCicloAsync(stoppingToken);
    }

    private async Task EjecutarCicloAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var alcance = alcances.CreateAsyncScope();
            var despachador = alcance.ServiceProvider.GetRequiredService<DespachadorDeCorreo>();
            var resultado = await despachador.DespacharLoteAsync(cancellationToken);
            if (resultado.Enviados + resultado.Reintentos + resultado.Fallidos > 0)
                RegistrarResultado(logger, resultado.Enviados, resultado.Reintentos, resultado.Fallidos);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Cierre normal del proceso.
        }
        catch (Exception excepcion)
        {
            RegistrarFallo(logger, excepcion);
        }
    }

    [LoggerMessage(
        EventId = 9060,
        Level = LogLevel.Information,
        Message = "Correo: {Enviados} enviados, {Reintentos} para reintentar y {Fallidos} fallidos.")]
    private static partial void RegistrarResultado(ILogger logger, int enviados, int reintentos, int fallidos);

    [LoggerMessage(
        EventId = 90601,
        Level = LogLevel.Error,
        Message = "No fue posible revisar la cola de correo; se reintentará en la siguiente vuelta.")]
    private static partial void RegistrarFallo(ILogger logger, Exception excepcion);
}
