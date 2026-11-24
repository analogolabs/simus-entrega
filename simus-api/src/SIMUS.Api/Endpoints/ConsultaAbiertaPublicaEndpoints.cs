#pragma warning disable CA1873 // Los argumentos del registro son locales ya calculados.
using System.Diagnostics;
using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using SIMUS.Api.ConsultaAbierta;
using SIMUS.Api.ConsultaGuiada;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La CONSULTA ABIERTA del portal: preguntar lo que sea sobre los datos públicos, con un modelo pequeño que solo interpreta.
/// </summary>
/// <remarks>
/// <para>
/// <b>ANONIMA A PROPOSITO</b> (declarada en <c>AutorizacionPorDefectoTests</c> y en el testigo de escrituras): se usa desde el
/// portal sin sesión, igual que la consulta guiada. No tiene cookies ni estado propio, por eso no lleva antiforgery: un POST de
/// otro sitio solo puede pedir una lectura pública. Lleva cupo de 10 por minuto y origen, tope de 200 caracteres y de dos
/// interpretaciones simultáneas.
/// </para>
/// <para>
/// <b>EL ÁMBITO LO FIJA ESTE ENDPOINT:</b> solo entidades del catálogo semántico público, solo registros publicados. Ni el texto
/// ni el modelo pueden pedir otra cosa: el modelo produce una consulta estructurada, el <see cref="ValidadorDeConsulta"/> la
/// contrasta con listas blancas y catálogos, y el <see cref="EjecutorDeConsulta"/> la evalúa sin SQL dinámico.
/// </para>
/// <para>
/// <b>NO SE REGISTRA LO QUE SE PREGUNTA.</b> Solo se anotan el estado, la vía y la latencia.
/// </para>
/// </remarks>
public static class ConsultaAbiertaPublicaEndpoints
{
    public const int MaximoDePregunta = 200;

    private static readonly string[] Ejemplos =
    [
        "festivales en Nariño por municipio", "cuántos talleres hay por departamento", "eventos próximos en Bogotá",
        "prácticas musicales con más festivales", "organizaciones con más de 3 procesos", "noticias de 2026 por mes",
    ];

    public static RouteGroupBuilder MapConsultaAbiertaPublicaEndpoints(this RouteGroupBuilder group)
    {
        var abierta = group.MapGroup("/publico/consulta-abierta")
            .WithTags("consulta-abierta-publica")
            .AllowAnonymous();

        abierta.MapGet("/estado", EstadoAsync)
            .RequireRateLimiting(new LimiteDeTasaConsultaAbiertaPublica())
            .WithName("EstadoDeConsultaAbiertaPublica")
            .Produces<EstadoDeConsultaAbiertaDto>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status429TooManyRequests);

        abierta.MapPost("/consultar", ConsultarAsync)
            .RequireRateLimiting(new LimiteDeTasaConsultaAbiertaPublica())
            .WithName("ConsultarAbiertaPublica")
            .Produces<RespuestaDeConsultaAbiertaDto>(StatusCodes.Status200OK)
            .ProducesValidationProblem(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status429TooManyRequests);

        return group;
    }

    private static async Task<IResult> EstadoAsync(IInterpreteDeConsultas interprete, CancellationToken ct)
    {
        var modelo = await interprete.DisponibleAsync(ct);
        return Results.Ok(new EstadoDeConsultaAbiertaDto(
            true, modelo,
            modelo
                ? "Pregunta al Asistente sobre lo publicado en el portal. Un modelo pequeño solo interpreta tu pregunta; las cifras salen siempre de los datos."
                : "La consulta abierta no está activa en este momento: puedes usar las preguntas de la lista, que siguen funcionando.",
            MaximoDePregunta, CatalogoSemantico.Describir(), Ejemplos));
    }

    private static async Task<IResult> ConsultarAsync(
        ConsultaAbiertaSolicitudDto solicitud,
        SimusDbContext db,
        CacheDivipola divipola,
        IInterpreteDeConsultas interprete,
        CacheDeInterpretaciones cache,
        LimitadorDeModelo limitador,
        ILogger<ConsultaAbiertaLog> registro,
        CancellationToken ct)
    {
        var reloj = Stopwatch.StartNew();
        var pregunta = (solicitud?.Pregunta ?? string.Empty).Trim();
        if (solicitud?.Consulta is null && (pregunta.Length == 0 || pregunta.Length > MaximoDePregunta))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["pregunta"] = [pregunta.Length == 0 ? "Escribe tu pregunta." : $"La pregunta admite hasta {MaximoDePregunta} caracteres."],
            });
        }
        if (pregunta.Length > MaximoDePregunta)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["pregunta"] = [$"La pregunta admite hasta {MaximoDePregunta} caracteres."] });

        var ahora = DateTime.UtcNow;
        var hoy = DateOnly.FromDateTime(ahora);
        RespuestaDeConsultaAbiertaDto Resp(string estado, string mensaje, string via, IEnumerable<string>? sugerencias = null) =>
            new(estado, mensaje, via, null, null, [], null, null, (sugerencias ?? []).ToList(), reloj.ElapsedMilliseconds);

        // 1) VIA RAPIDA: una pregunta idéntica a una plantilla sin parámetros no llama al modelo.
        if (solicitud!.Consulta is null)
        {
            var clave = CacheDeInterpretaciones.Clave(pregunta);
            var plantilla = BancoDePreguntasPublicas.Preguntas.FirstOrDefault(p => p.Parametros.Count == 0
                && (CacheDeInterpretaciones.Clave(p.Rotulo) == clave || p.Ejemplos.Any(e => CacheDeInterpretaciones.Clave(e) == clave)));
            if (plantilla is not null)
            {
                var resultado = await BancoDePreguntasPublicas.ResponderAsync(plantilla.Id, db, divipola, ahora, ct);
                var ms1 = reloj.ElapsedMilliseconds;
                registro.LogInformation("Consulta abierta: vía plantilla en {Ms} ms", ms1);
                return Results.Ok(new RespuestaDeConsultaAbiertaDto(
                    "ok", "Es una de las preguntas verificadas del portal.", "plantilla", resultado.Resumen, null,
                    ["Pregunta verificada: " + plantilla.Rotulo], resultado.Tabla, null, [], reloj.ElapsedMilliseconds, plantilla.Id));
            }
        }

        var catalogos = await CatalogosSemanticos.CargarAsync(db, divipola, ct);
        ConsultaEstructuradaDto? interpretada = solicitud.Consulta;
        var via = "consulta_editada";

        if (interpretada is null)
        {
            via = "modelo";
            var clave = CacheDeInterpretaciones.Clave(pregunta);
            if (!cache.TryGet(clave, out interpretada))
            {
                if (!await interprete.DisponibleAsync(ct))
                {
                    return Results.Ok(Resp("sin_modelo",
                        "La consulta abierta no está disponible ahora. Elige una de las preguntas de la lista: esas siguen funcionando.", via, Cercanas(pregunta)));
                }

                if (!await limitador.EntrarAsync(ct))
                {
                    return Results.Ok(Resp("ocupado", "Hay muchas consultas en este momento. Intenta de nuevo en unos segundos.", via));
                }

                ResultadoDeInterpretacion interpretacion;
                try { interpretacion = await interprete.InterpretarAsync(pregunta, hoy, ct); }
                finally { limitador.Salir(); }

                var ms2 = reloj.ElapsedMilliseconds;

                registro.LogInformation("Consulta abierta: interpretación {Estado} en {Ms} ms", interpretacion.Estado, ms2);
                switch (interpretacion.Estado)
                {
                    case EstadoDeInterpretacion.SinModelo or EstadoDeInterpretacion.Timeout or EstadoDeInterpretacion.Error:
                        return Results.Ok(Resp("sin_modelo",
                            interpretacion.Estado == EstadoDeInterpretacion.Timeout
                                ? "El modelo tardó demasiado en responder (puede estar preparándose). Vuelve a intentarlo en un momento o elige una de la lista."
                                : "El modelo no respondió. Elige una de las preguntas de la lista: esas siguen funcionando.", via, Cercanas(pregunta)));
                    case EstadoDeInterpretacion.JsonInvalido:
                        return Results.Ok(Resp("no_entendida", "No logré entender la pregunta. Intenta decirla con otras palabras o elige una de la lista.", via, Cercanas(pregunta)));
                }
                interpretada = interpretacion.Consulta;
                if (interpretada is null || string.Equals(interpretada.Entidad, "ninguna", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(interpretada.Entidad))
                {
                    return Results.Ok(Resp("no_entendida",
                        "Esa pregunta no se puede responder con los datos públicos del portal (procesos, festivales, eventos, noticias, organizaciones, prácticas y territorios).", via, Cercanas(pregunta)));
                }
                var previa = ValidadorDeConsulta.Validar(interpretada, catalogos, hoy);
                if (previa.Valida) cache.Guardar(clave, interpretada);
            }
        }

        var validacion = ValidadorDeConsulta.Validar(interpretada, catalogos, hoy);
        if (!validacion.Valida)
        {
            return Results.Ok(Resp("fuera_de_catalogo",
                "No pude responder eso con los datos públicos: " + string.Join(" ", validacion.Errores.Take(3)), via, Cercanas(pregunta)));
        }

        var consulta = validacion.Consulta!;
        var filas = await CargadorDeEntidades.CargarAsync(consulta.Entidad, catalogos, db, hoy, ct);
        var ejecucion = EjecutorDeConsulta.Ejecutar(consulta, filas, catalogos);
        var ms3 = reloj.ElapsedMilliseconds;
        registro.LogInformation("Consulta abierta: vía {Via}, entidad {Entidad}, {Ms} ms", via, consulta.Entidad.Id, ms3);
        return Results.Ok(new RespuestaDeConsultaAbiertaDto(
            "ok", "Esto es lo que entendí de tu pregunta; puedes quitar o cambiar los filtros.", via, ejecucion.Resumen, consulta.Canonica,
            ejecucion.ComoEntendi, ejecucion.Tabla, ejecucion.Grafico, [], reloj.ElapsedMilliseconds));
    }

    /// <summary>Las tres preguntas verificadas más cercanas por palabras compartidas.</summary>
    internal static IReadOnlyList<string> Cercanas(string pregunta)
    {
        var palabras = CatalogoDeConsultas.PalabrasDe(CatalogoDeConsultas.Normalizar(pregunta)).Where(p => p.Length > 3).ToHashSet();
        return BancoDePreguntasPublicas.Preguntas
            .Select(p => (p.Rotulo, Puntos: CatalogoDeConsultas.PalabrasDe(CatalogoDeConsultas.Normalizar(p.Rotulo + " " + string.Join(' ', p.Ejemplos))).Count(w => palabras.Contains(w))))
            .Where(par => par.Puntos > 0).OrderByDescending(par => par.Puntos).ThenBy(par => par.Rotulo, StringComparer.Ordinal)
            .Take(3).Select(par => par.Rotulo).ToList();
    }
}

public sealed class ConsultaAbiertaLog;

/// <summary>Cuántas interpretaciones del modelo pueden correr a la vez; el resto espera unos segundos o recibe «ocupado».</summary>
public sealed class LimitadorDeModelo(IOptions<OpcionesDelModelo> opciones)
{
    private readonly SemaphoreSlim _cupo = new(Math.Max(1, opciones.Value.MaximoSimultaneas));
    public Task<bool> EntrarAsync(CancellationToken ct) => _cupo.WaitAsync(TimeSpan.FromSeconds(3), ct);
    public void Salir() => _cupo.Release();
}

/// <summary>Diez consultas por minuto y por origen: cada una puede costar segundos de CPU del modelo.</summary>
internal sealed class LimiteDeTasaConsultaAbiertaPublica : IRateLimiterPolicy<string>
{
    internal const int CupoPorMinutoYPorOrigen = 10;

    public Func<OnRejectedContext, CancellationToken, ValueTask>? OnRejected => (contexto, _) =>
    {
        contexto.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (contexto.Lease.TryGetMetadata(MetadataName.RetryAfter, out var espera))
            contexto.HttpContext.Response.Headers.RetryAfter = ((int)espera.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        return ValueTask.CompletedTask;
    };

    public RateLimitPartition<string> GetPartition(HttpContext httpContext) =>
        RateLimitPartition.GetFixedWindowLimiter(
            "consulta-abierta:" + (httpContext.Connection.RemoteIpAddress?.ToString() ?? "desconocido"),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = CupoPorMinutoYPorOrigen, Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst, QueueLimit = 0, AutoReplenishment = true,
            });
}
