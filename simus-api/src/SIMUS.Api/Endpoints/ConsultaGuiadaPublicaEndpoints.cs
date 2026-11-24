using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.ConsultaGuiada;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La Consulta Guiada del portal público: un banco cerrado de preguntas que solo leen lo que el portal ya publica.
/// </summary>
/// <remarks>
/// <para>
/// <b>ANONIMA A PROPOSITO</b> (declarada en <c>AutorizacionPorDefectoTests</c>): se usa desde el portal, sin sesión, igual
/// que <c>/publico/agenda</c> y <c>/publico/analitica/festivales/resumen</c>.
/// </para>
/// <para>
/// <b>NO REUTILIZA EL CATALOGO DE LA CONSOLA NI EL DE LA ORGANIZACION.</b> El banco público vive aparte
/// (<see cref="BancoDePreguntasPublicas"/>) y cada pregunta es una consulta propia. Las del Programa y las de una
/// organización miran estados de revisión, bandejas y registros de quien pregunta; ninguna de ellas se puede pedir desde
/// aquí, ni siquiera por error de configuración: el identificador se busca en este banco y en ningún otro.
/// </para>
/// <para>
/// <b>SOLO LO QUE EL PORTAL YA MUESTRA.</b> Procesos publicados (la misma lectura que el mapa y la analítica), agenda
/// y noticias publicadas, y el catálogo de prácticas musicales. Nunca contacto no público, estados de revisión,
/// organizaciones, citas, cuentas ni nombres de personas. Las respuestas son agregados (conteos por territorio, tipo o
/// práctica) y, para la agenda y las noticias, los mismos campos que ya salen en sus listados públicos (fecha, título,
/// lugar); <c>ConsultaGuiadaPublicaTests</c> lo comprueba pregunta por pregunta.
/// </para>
/// <para>
/// <b>SIN IA.</b> Es una consulta determinística: «Consulta verificada». La respuesta enseña su fuente, su alcance y la
/// tabla de la que sale la cifra.
/// </para>
/// </remarks>
public static class ConsultaGuiadaPublicaEndpoints
{
    public static RouteGroupBuilder MapConsultaGuiadaPublicaEndpoints(this RouteGroupBuilder group)
    {
        var consulta = group.MapGroup("/publico/consulta-guiada")
            .WithTags("consulta-guiada-publica")
            .AllowAnonymous();

        consulta.MapGet("/estado", Estado)
            .RequireRateLimiting(new LimiteDeTasaConsultaGuiadaPublica())
            .WithName("EstadoDeConsultaGuiadaPublica")
            .Produces<EstadoDeConsultaGuiadaPublicaDto>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status429TooManyRequests);

        consulta.MapPost("/consultar", ConsultarAsync)
            .RequireRateLimiting(new LimiteDeTasaConsultaGuiadaPublica())
            .WithName("ConsultarGuiadaPublica")
            .Produces<RespuestaDeConsultaGuiadaDto>(StatusCodes.Status200OK)
            .ProducesValidationProblem(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status429TooManyRequests);

        return group;
    }

    private static async Task<IResult> Estado(SimusDbContext db, CacheDivipola divipola, CancellationToken ct) =>
        Results.Ok(new EstadoDeConsultaGuiadaPublicaDto(
            true,
            "banco_publico",
            "Elige una pregunta o escribe, por ejemplo, «festivales en Nariño». Cada respuesta es una consulta verificada sobre lo que ya está publicado en el portal: te enseña la fuente, los filtros aplicados y la tabla de la que sale la cifra.",
            BancoDePreguntasPublicas.Preguntas.Select(item => new PreguntaPublicaDto(item.Id, item.Rotulo, item.Descripcion, item.Parametros, item.Ambito, item.Ejemplos)).ToList(),
            await PlantillasDeConsultaPublica.CatalogosAsync(db, divipola, ct)));

    private static async Task<IResult> ConsultarAsync(
        ConsultaPublicaSolicitudDto solicitud,
        SimusDbContext db,
        CacheDivipola divipola,
        CancellationToken ct)
    {
        var id = (solicitud?.PreguntaId ?? string.Empty).Trim();
        if (id.Length == 0 || id.Length > 64 || BancoDePreguntasPublicas.Buscar(id) is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["preguntaId"] = ["Elige una de las preguntas de la lista."],
            });
        }

        BancoDePreguntasPublicas.Resultado resultado;
        try
        {
            resultado = await BancoDePreguntasPublicas.ResponderAsync(id, db, divipola, DateTime.UtcNow, ct, solicitud!.Parametros);
        }
        catch (BancoDePreguntasPublicas.ParametrosInvalidosException invalidos)
        {
            return Results.ValidationProblem(invalidos.Errores);
        }

        return Results.Ok(new RespuestaDeConsultaGuiadaDto(
            resultado.Resumen,
            id,
            "banco_publico",
            DateTime.UtcNow,
            resultado.Tabla,
            "Lo publicado en el portal"));
    }
}

/// <summary>El cupo de la Consulta Guiada pública: 20 por minuto y por origen, más estricto que el de organización.</summary>
/// <remarks>
/// Cada consulta repite una agregación sobre lo publicado. Se reparte por <c>RemoteIpAddress</c>, como la analítica
/// pública; detrás de un proxy hay que configurar <c>UseForwardedHeaders</c> (ver la nota en
/// <c>LimiteDeTasaAnaliticaPublica</c>). Como esa política, no se exime en pruebas: la prueba de 429 mide el mecanismo.
/// </remarks>
internal sealed class LimiteDeTasaConsultaGuiadaPublica : IRateLimiterPolicy<string>
{
    internal const int CupoPorMinutoYPorOrigen = 20;

    public Func<OnRejectedContext, CancellationToken, ValueTask>? OnRejected => (contexto, _) =>
    {
        contexto.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (contexto.Lease.TryGetMetadata(MetadataName.RetryAfter, out var espera))
        {
            contexto.HttpContext.Response.Headers.RetryAfter =
                ((int)espera.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        }

        return ValueTask.CompletedTask;
    };

    public RateLimitPartition<string> GetPartition(HttpContext httpContext)
    {
        var origen = "consulta-publica:" + (httpContext.Connection.RemoteIpAddress?.ToString() ?? "desconocido");
        return RateLimitPartition.GetFixedWindowLimiter(origen, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = CupoPorMinutoYPorOrigen,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0,
            AutoReplenishment = true,
        });
    }
}
