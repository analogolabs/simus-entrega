using Microsoft.AspNetCore.OutputCaching;

namespace SIMUS.Api.Endpoints;

/// <summary>Identifica las respuestas anónimas que dependen de un Festival publicado.</summary>
public static class CachePublicaFestivales
{
    public const string Etiqueta = "festivales-publicos";

    public static ValueTask InvalidarAsync(IOutputCacheStore cache, CancellationToken cancellationToken) =>
        cache.EvictByTagAsync(Etiqueta, cancellationToken);

    /// <summary>
    /// Filtro de ruta: invalida la caché pública después de una escritura que respondió bien.
    /// </summary>
    /// <remarks>
    /// <b>EXISTE PARA NO TOCAR LA FIRMA DE LOS MANEJADORES.</b> Un parámetro más en un método
    /// mapeado tal cual cambia el contrato; el alta de un histórico, la confirmación de una
    /// importación y la fusión de duplicados publican o archivan Festivales y necesitan que el
    /// portal deje de servir lo de antes.
    /// </remarks>
    public static async ValueTask<object?> InvalidarTrasEscribir(EndpointFilterInvocationContext contexto, EndpointFilterDelegate siguiente)
    {
        ArgumentNullException.ThrowIfNull(contexto);
        ArgumentNullException.ThrowIfNull(siguiente);
        var resultado = await siguiente(contexto);
        var codigo = resultado is IStatusCodeHttpResult conCodigo ? conCodigo.StatusCode ?? StatusCodes.Status200OK : StatusCodes.Status200OK;
        if (codigo is >= 200 and < 300
            && contexto.HttpContext.RequestServices.GetService(typeof(IOutputCacheStore)) is IOutputCacheStore cache)
        {
            await InvalidarAsync(cache, contexto.HttpContext.RequestAborted);
        }
        return resultado;
    }
}
