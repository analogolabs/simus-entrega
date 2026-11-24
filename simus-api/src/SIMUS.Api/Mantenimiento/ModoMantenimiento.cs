using Microsoft.Extensions.Options;

namespace SIMUS.Api.Mantenimiento;

/// <summary>
/// Configuración del modo mantenimiento (sección <c>Mantenimiento</c>). Apagado por omisión.
/// Se activa con la variable de entorno <c>Mantenimiento__Activo=true</c> (docs/operacion/11-operacion-y-mantenimiento.md §11.9).
/// </summary>
public sealed class OpcionesDeMantenimiento
{
    public const string Seccion = "Mantenimiento";

    /// <summary>Si es <c>true</c>, el API responde 503 a todo lo que no esté exento.</summary>
    public bool Activo { get; set; }

    /// <summary>Texto opcional para quien visita el sitio. Se recorta a 300 caracteres.</summary>
    public string? Mensaje { get; set; }

    /// <summary>Hora estimada de regreso (ISO 8601, p. ej. <c>2026-11-22T14:00:00-05:00</c>). Opcional.</summary>
    public DateTimeOffset? HastaAprox { get; set; }
}

/// <summary>
/// Modo mantenimiento: mientras está activo, las rutas del API (<c>/api/</c>) responden
/// <c>503 Service Unavailable</c> con <c>Retry-After</c> y la marca <c>X-Mantenimiento: 1</c>,
/// para que la web distinga «en mantenimiento» de cualquier otro 503 y muestre su pantalla.
///
/// <para><b>Qué NO toca.</b> Todo lo que no cuelga de <c>/api/</c> pasa: las sondas
/// <c>/health/live</c> y <c>/health/ready</c> (el orquestador no debe reiniciar el contenedor por
/// un mantenimiento), los ficheros del front y su <c>index.html</c> (de lo contrario no habría
/// pantalla que mostrar).</para>
///
/// <para><b>La excepción para quien administra</b> es por RUTA, no por una credencial nueva:
/// <c>/api/v1/admin/</c> (la consola, que sigue exigiendo su propia sesión y sus propios permisos
/// como siempre) y <c>/api/v1/csrf</c> (el testigo que esa consola necesita para escribir). No hay
/// cabecera secreta ni clave que filtrar, no se cambia ningún permiso y no hay endpoints nuevos.</para>
/// </summary>
public sealed class ModoMantenimientoMiddleware
{
    public const string CabeceraDeMarca = "X-Mantenimiento";
    private const int MaxMensaje = 300;
    private const int EsperaPorOmisionSegundos = 300;
    private const int EsperaMinimaSegundos = 30;
    private const int EsperaMaximaSegundos = 3600;

    private static readonly string[] PrefijosExentos = ["/api/v1/admin/", "/api/v1/csrf"];

    private readonly RequestDelegate _siguiente;
    private readonly IOptionsMonitor<OpcionesDeMantenimiento> _opciones;
    private readonly TimeProvider _reloj;

    public ModoMantenimientoMiddleware(
        RequestDelegate siguiente, IOptionsMonitor<OpcionesDeMantenimiento> opciones, TimeProvider reloj)
    {
        _siguiente = siguiente;
        _opciones = opciones;
        _reloj = reloj;
    }

    public Task InvokeAsync(HttpContext contexto)
    {
        var opciones = _opciones.CurrentValue;
        if (!opciones.Activo || !EsRutaDelApiEnMantenimiento(contexto.Request.Path))
        {
            return _siguiente(contexto);
        }
        return Responder503Async(contexto, opciones);
    }

    /// <summary>Es del API, y no es una de las rutas de quien administra.</summary>
    public static bool EsRutaDelApiEnMantenimiento(PathString ruta)
    {
        if (!ruta.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase)) return false;
        var texto = ruta.Value ?? string.Empty;
        foreach (var prefijo in PrefijosExentos)
        {
            if (texto.StartsWith(prefijo, StringComparison.OrdinalIgnoreCase)) return false;
        }
        return true;
    }

    private async Task Responder503Async(HttpContext contexto, OpcionesDeMantenimiento opciones)
    {
        var ahora = _reloj.GetUtcNow();
        var espera = EsperaPorOmisionSegundos;
        DateTimeOffset? hasta = null;
        if (opciones.HastaAprox is { } h && h > ahora)
        {
            hasta = h;
            espera = (int)Math.Clamp((h - ahora).TotalSeconds, EsperaMinimaSegundos, EsperaMaximaSegundos);
        }

        var mensaje = string.IsNullOrWhiteSpace(opciones.Mensaje) ? null : opciones.Mensaje.Trim();
        if (mensaje is { Length: > MaxMensaje }) mensaje = mensaje[..MaxMensaje];

        contexto.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        contexto.Response.Headers["Retry-After"] = espera.ToString(System.Globalization.CultureInfo.InvariantCulture);
        contexto.Response.Headers[CabeceraDeMarca] = "1";
        contexto.Response.Headers.CacheControl = "no-store";
        await contexto.Response.WriteAsJsonAsync(new
        {
            codigo = "mantenimiento",
            mensaje,
            hastaAprox = hasta,
        });
    }
}
