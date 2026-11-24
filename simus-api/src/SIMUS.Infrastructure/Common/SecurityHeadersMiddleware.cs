using Microsoft.AspNetCore.Http;

namespace SIMUS.Infrastructure.Common;

public sealed class SecurityHeadersMiddleware
{
    /// <summary>
    /// Política propuesta por la auditoría de seguridad (S-04), servida SOLO en modo observación
    /// (<c>Content-Security-Policy-Report-Only</c>): el navegador anota en consola lo que bloquearía
    /// sin bloquear nada, para medir antes de promoverla a bloqueante en un cambio aparte.
    /// </summary>
    /// <remarks>
    /// <c>style-src 'unsafe-inline'</c> porque Angular inserta estilos; <c>worker-src blob:</c> porque
    /// MapLibre crea su trabajador desde un blob. <c>upgrade-insecure-requests</c> no va: en
    /// Report-Only se ignora y en local (http) estorbaría. Cuando se aloje la tipografía y se retire
    /// el <c>onload</c> en línea de <c>index.html</c>, la política deja de reportar esas dos cosas.
    /// </remarks>
    public const string PoliticaDeContenidoEnObservacion =
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https://tile.openstreetmap.org https://tiles.openfreemap.org; " +
        "font-src 'self'; " +
        "connect-src 'self' https://tiles.openfreemap.org https://tile.openstreetmap.org; " +
        "worker-src 'self' blob:; " +
        "frame-src https://www.youtube-nocookie.com; " +
        "frame-ancestors 'self'; " +
        "object-src 'none'; base-uri 'self'; form-action 'self'";

    private const string PrefijoDeArchivosPublicos = "/api/v1/publico/archivos";

    /// <summary>
    /// Las superficies con sesión (S-13): lo que devuelven es de una persona y no debe quedar en la caché de un navegador
    /// compartido ni de un intermediario. Las lecturas públicas quedan fuera: ellas deciden su propia caché (ETag, no-cache).
    /// </summary>
    private static readonly string[] PrefijosSinCache =
    [
        "/api/v1/externo", "/api/v1/institucional", "/api/v1/admin", "/api/v1/notificaciones", "/api/v1/csrf",
    ];

    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task Invoke(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            // X-Frame-Options es SAMEORIGIN y no DENY: el panel enmarca páginas propias (vistas
            // previas del listado y de los textos web) y DENY impide incluso el encuadre del mismo origen.

            headers.TryAdd("X-Content-Type-Options", "nosniff");
            headers.TryAdd("X-Frame-Options", "SAMEORIGIN");
            headers.TryAdd("Content-Security-Policy-Report-Only", PoliticaDeContenidoEnObservacion);
            headers.TryAdd("Cross-Origin-Opener-Policy", "same-origin");
            // Los archivos públicos pueden incrustarse desde fuera; el resto del sitio no.
            var esArchivoPublico = context.Request.Path.StartsWithSegments(PrefijoDeArchivosPublicos);
            headers.TryAdd("Cross-Origin-Resource-Policy", esArchivoPublico ? "cross-origin" : "same-origin");
            headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
            headers.TryAdd("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
            headers.TryAdd("X-Permitted-Cross-Domain-Policies", "none");

            // `no-store` en lo que lleva sesión, SALVO que la ruta ya haya fijado su propia política (TryAdd).
            if (PrefijosSinCache.Any(prefijo => context.Request.Path.StartsWithSegments(prefijo)))
            {
                headers.TryAdd("Cache-Control", "no-store");
                headers.TryAdd("Pragma", "no-cache");
            }

            return Task.CompletedTask;
        });

        return _next(context);
    }
}
