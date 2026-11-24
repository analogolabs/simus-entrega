using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace SIMUS.Infrastructure.Common;

public sealed class RequestContextMiddleware
{
    public const string CorrelationIdHeader = "X-Correlation-ID";

    private readonly RequestDelegate _next;
    private readonly ILogger<RequestContextMiddleware> _logger;

    public RequestContextMiddleware(RequestDelegate next, ILogger<RequestContextMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    /// <summary>Letras, cifras y guiones, de 1 a 64 caracteres.</summary>
    public static bool EsUnIdentificadorAdmisible(string? valor)
    {
        if (string.IsNullOrEmpty(valor) || valor.Length > 64)
        {
            return false;
        }

        foreach (var caracter in valor)
        {
            if (!(caracter is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '-'))
            {
                return false;
            }
        }

        return true;
    }

    public async Task Invoke(HttpContext context)
    {
        // S-17: el identificador lo escribe quien llama y se devuelve y se registra. Solo se admite uno razonable (letras, cifras
        // y guiones, hasta 64): cualquier otra cosa —saltos de línea para falsear registros, texto larguísimo— se descarta
        // y se genera uno propio.
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault();
        if (!EsUnIdentificadorAdmisible(correlationId))
        {
            correlationId = Guid.NewGuid().ToString("N");
        }

        context.Response.Headers[CorrelationIdHeader] = correlationId;
        context.Items[CorrelationIdHeader] = correlationId;

        using (_logger.BeginScope(new Dictionary<string, object?>
        {
            ["CorrelationId"] = correlationId,
            ["Path"] = context.Request.Path.ToString(),
            ["Method"] = context.Request.Method
        }))
        {
            await _next(context);
        }
    }
}
