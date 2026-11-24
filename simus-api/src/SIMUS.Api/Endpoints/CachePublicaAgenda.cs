using Microsoft.AspNetCore.OutputCaching;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Identifica las respuestas anónimas de la lista pública de la Agenda, para vaciarlas cuando un
/// evento se publica, se retira, se cancela o se corrige.
/// </summary>
/// <remarks>
/// <b>POR QUÉ NO BASTA CON ESPERAR A QUE EXPIRE.</b> La lista se guarda 60 segundos. Un evento
/// retirado o cancelado por su organización seguía apareciendo, sin aviso, hasta un minuto después:
/// justo el tiempo en que alguien lo comparte. Quien escribe en la agenda vacía la caché; el resto
/// del tiempo sigue protegiendo la base de las lecturas anónimas.
/// </remarks>
public static class CachePublicaAgenda
{
    public const string Etiqueta = "agenda-publica";

    public static ValueTask InvalidarAsync(IOutputCacheStore cache, CancellationToken cancellationToken) =>
        cache.EvictByTagAsync(Etiqueta, cancellationToken);

    /// <summary>
    /// Filtro de ruta: vacía la caché pública después de una escritura que respondió bien.
    /// </summary>
    /// <remarks>
    /// <b>ES UN FILTRO Y NO UN PARÁMETRO</b> para no tocar la firma de los manejadores: un parámetro
    /// más en un método mapeado tal cual cambia el contrato (igual que en
    /// <see cref="CachePublicaFestivales.InvalidarTrasEscribir"/>).
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
