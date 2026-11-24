using System.Collections.Concurrent;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Recuerda, por un minuto, qué archivos del banco ya se comprobó que son públicos, para que cada imagen del portal
/// no repita la comprobación de «¿lo usa algo que el público ve?» (hasta 12 consultas, una por tabla que vincula).
/// </summary>
/// <remarks>
/// <para>
/// <b>SOLO SE RECUERDA LO QUE SÍ ES PÚBLICO.</b> Un «no» nunca se guarda: no hay nada que ahorrar (lo piden pocos) y
/// guardarlo retrasaría que una imagen recién publicada se viera.
/// </para>
/// <para>
/// <b>INVALIDACIÓN: UNA ÉPOCA QUE SUBE CON CADA ESCRITURA.</b> Retirar una noticia, despublicar un evento o cambiar la
/// visibilidad de un perfil son escrituras del API; cualquiera que responda bien sube la época
/// (<see cref="CachePublicaLecturas.UseInvalidacionDeLecturasPublicas"/>) y lo anotado con una época anterior deja de
/// valer. Lo que cambie sin pasar por el API (siembras SQL) lo acota la expiración de 60 segundos.
/// </para>
/// <para>
/// Es un servicio singleton y no un estado estático: cada servidor (y cada fábrica de pruebas) tiene el suyo.
/// </para>
/// </remarks>
public sealed class CacheDeArchivosPublicos
{
    private const int Maximo = 20_000;
    private static readonly TimeSpan Vigencia = TimeSpan.FromSeconds(60);

    private readonly ConcurrentDictionary<int, (long Epoca, long Vence)> _publicos = new();
    private long _epoca;

    /// <summary>Anota que ahora mismo hay una escritura nueva: lo recordado hasta aquí deja de valer.</summary>
    public void Invalidar() => Interlocked.Increment(ref _epoca);

    /// <summary>Si el archivo se comprobó público en esta época y hace menos de un minuto.</summary>
    public bool EsPublico(int archivoId) =>
        _publicos.TryGetValue(archivoId, out var anotado)
        && anotado.Epoca == Interlocked.Read(ref _epoca)
        && anotado.Vence > Environment.TickCount64;

    /// <summary>Anota un archivo comprobado público, con la época que había ANTES de comprobarlo.</summary>
    public void AnotarPublico(int archivoId, long epocaAlComprobar)
    {
        if (_publicos.Count >= Maximo) _publicos.Clear();
        _publicos[archivoId] = (epocaAlComprobar, Environment.TickCount64 + (long)Vigencia.TotalMilliseconds);
    }

    /// <summary>La época actual: se lee ANTES de comprobar, para que una escritura concurrente invalide la anotación.</summary>
    public long Epoca => Interlocked.Read(ref _epoca);
}
