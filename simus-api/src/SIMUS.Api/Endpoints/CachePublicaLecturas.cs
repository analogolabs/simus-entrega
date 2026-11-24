using Microsoft.AspNetCore.OutputCaching;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Caché de salida de las LECTURAS PÚBLICAS que aún no tenían (Mercados, Lutería, Espacios, Redes, Catálogo
/// editorial, Prácticas musicales y Territorios sonoros), con una invalidación que no depende de acordarse de cada
/// escritura.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ UNA INVALIDACIÓN GENERAL.</b> Hasta ahora solo cuatro grupos de lecturas se guardaban, y cada uno
/// vaciaba su caché desde los puntos de escritura que alguien recordó cablear (<see cref="CachePublicaAgenda"/>,
/// <see cref="CachePublicaFestivales"/>). Para estas lecturas hay decenas de rutas que las alteran (altas, ediciones,
/// revisiones, retiros, importaciones, reclamaciones…). En vez de cablear cada una y arriesgar que una se olvide,
/// CUALQUIER escritura del API que responda bien (POST, PUT, PATCH o DELETE) vacía esta etiqueta
/// (<see cref="InvalidarTrasEscribir"/>, un middleware). Sobra a veces —un inicio de sesión también vacía—, pero
/// nunca falta, y la lectura vuelve a llenarse en la petición siguiente.
/// </para>
/// <para>
/// <b>QUÉ NO CUBRE:</b> los cambios que no pasan por el API (siembras SQL, trabajos de fondo). Los acota la
/// expiración de 60 segundos, la misma que ya tienen Noticias, Agenda y Festivales.
/// </para>
/// <para>
/// <b>NO CACHEA LO QUE DEPENDE DE QUIEN PIDE.</b> La política por omisión de la caché de salida no guarda peticiones
/// autenticadas; además esta etiqueta solo se aplica a rutas anónimas cuyo resultado no cambia con la sesión
/// (revisado una a una). El directorio de personas —que suma perfiles «solo SIMUS» con sesión— no la usa.
/// </para>
/// </remarks>
public static class CachePublicaLecturas
{
    public const string Etiqueta = "lecturas-publicas";

    /// <summary>Guarda la respuesta 60 s, por ruta y por TODA la cadena de consulta, bajo la etiqueta común.</summary>
    public static TBuilder CacheaLecturaPublica<TBuilder>(this TBuilder ruta) where TBuilder : IEndpointConventionBuilder =>
        ruta.CacheOutput(politica => politica
            .Expire(TimeSpan.FromSeconds(60))
            .Tag(Etiqueta)
            .SetVaryByQuery("*"));

    /// <summary>Vacía las lecturas públicas guardadas cuando una escritura del API responde bien.</summary>
    public static IApplicationBuilder UseInvalidacionDeLecturasPublicas(this IApplicationBuilder app) =>
        app.Use(async (contexto, siguiente) =>
        {
            await siguiente();
            var metodo = contexto.Request.Method;
            if (HttpMethods.IsGet(metodo) || HttpMethods.IsHead(metodo) || HttpMethods.IsOptions(metodo)) return;
            if (contexto.Response.StatusCode is < 200 or >= 300) return;
            if (!contexto.Request.Path.StartsWithSegments("/api")) return;
            contexto.RequestServices.GetService<CacheDeArchivosPublicos>()?.Invalidar();
            if (contexto.RequestServices.GetService(typeof(IOutputCacheStore)) is IOutputCacheStore cache)
            {
                await cache.EvictByTagAsync(Etiqueta, CancellationToken.None);
            }
        });
}
