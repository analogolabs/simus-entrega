using SIMUS.Contracts;
using SIMUS.Domain.Entities;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Qué es una errata y qué es un cambio de fondo en una ficha publicada del Catálogo editorial
/// (LIS-04; docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 36).
/// </summary>
/// <remarks>
/// <para>
/// <b>LA ERRATA SE CORRIGE AL INSTANTE Y LA FICHA SIGUE EN EL PORTAL.</b> Un cambio de fondo la
/// devuelve a revisión, porque lo que se catalogó y publicó ya no es lo que se va a mostrar. Es el
/// mismo criterio de Noticias y de los eventos, con la misma diferencia que los eventos: <b>no lo
/// declara quien edita, lo decide el servidor comparando lo publicado con lo que llega</b>. Hasta
/// hoy había una casilla «es una errata» que nadie sabía que existía: corregir una coma sin
/// marcarla despublicaba la ficha, y marcarla por costumbre dejaba pasar un cambio de fondo.
/// </para>
/// <para>
/// <b>ES DE FONDO</b> lo que cambia <i>qué obra es, de cuándo es, dónde se consulta o con qué
/// derechos</i>: el título o el subtítulo reescritos (se conserva menos del 70 % de los
/// caracteres), el resumen reescrito (menos del 60 %), el año o la fecha, el tipo de publicación,
/// la categoría y la subcategoría, la serie o colección, el volumen, el ámbito, los accesos (un
/// archivo o enlace que se agrega, se cambia o se quita: es lo que el público abre y lo que los
/// derechos amparan) y las fuentes que la sustentan.
/// </para>
/// <para>
/// <b>ES ERRATA</b> lo demás: ortografía, tildes, puntuación, redacción de un resumen que cambia
/// poco, palabras clave, créditos y descripciones del formato.
/// </para>
/// <para>
/// <b>EL UMBRAL ES CONSERVADOR A PROPÓSITO:</b> ante la duda, revisión. Una errata que sale como
/// cambio de fondo cuesta una espera; un cambio de fondo que sale como errata cuesta un portal que
/// muestra algo que nadie aprobó.
/// </para>
/// </remarks>
public static class ReglasDeErrataDelCatalogo
{
    /// <summary>Del título y del subtítulo debe conservarse al menos esta fracción para ser errata.</summary>
    public const double SimilitudMinimaDelTitulo = ReglasDeErrataDeEventos.SimilitudMinimaDelTitulo;

    /// <summary>Del resumen debe conservarse al menos esta fracción para ser errata.</summary>
    public const double SimilitudMinimaDelResumen = ReglasDeErrataDeEventos.SimilitudMinimaDeLaDescripcion;

    /// <summary>
    /// Lo que cambia «de fondo» entre la ficha publicada y lo que se pide guardar, dicho en una
    /// frase corta cada cosa. Vacío: todo es errata.
    /// </summary>
    /// <param name="actual">La ficha tal como está publicada, ANTES de aplicar los cambios.</param>
    /// <param name="nueva">Lo que se pide guardar.</param>
    /// <param name="accesosActuales">Los accesos de la ficha hoy: una firma por acceso.</param>
    /// <param name="fuentesActuales">Los identificadores de las fuentes de la ficha hoy.</param>
    public static IReadOnlyList<string> CambiosDeFondo(
        PublicacionEditorialRow actual,
        GuardarPublicacionEditorialSolicitud nueva,
        IReadOnlyCollection<string> accesosActuales,
        IReadOnlyCollection<long> fuentesActuales)
    {
        ArgumentNullException.ThrowIfNull(actual);
        ArgumentNullException.ThrowIfNull(nueva);
        ArgumentNullException.ThrowIfNull(accesosActuales);
        ArgumentNullException.ThrowIfNull(fuentesActuales);

        var de = new List<string>();

        if (Reescrito(actual.Titulo, nueva.Titulo, SimilitudMinimaDelTitulo, porCaracteres: true)) de.Add("el título");
        if (Reescrito(actual.Subtitulo, nueva.Subtitulo, SimilitudMinimaDelTitulo, porCaracteres: true)) de.Add("el subtítulo");
        if (Reescrito(actual.Resumen, nueva.Resumen, SimilitudMinimaDelResumen)) de.Add("el resumen");

        if (actual.AnioInicio != nueva.AnioInicio || actual.AnioFin != nueva.AnioFin
            || Distinto(actual.FechaEdtf, nueva.FechaEdtf))
        {
            de.Add("la fecha");
        }

        if (Distinto(actual.TipoPublicacion, nueva.TipoPublicacion)) de.Add("el tipo de publicación");
        if (actual.CategoriaId != nueva.CategoriaId || actual.SubcategoriaEditorialId != nueva.SubcategoriaEditorialId)
        {
            de.Add("la categoría");
        }

        if (Distinto(actual.SerieOColeccion, nueva.SerieOColeccion)) de.Add("la serie o colección");
        if (Distinto(actual.DesignacionVolumen, nueva.DesignacionVolumen)) de.Add("el volumen");
        if (Distinto(actual.Ambito, nueva.Ambito) || Distinto(actual.AmbitoTexto, nueva.AmbitoTexto)) de.Add("el ámbito");

        // Los accesos y las fuentes solo cuentan si el cambio las trae: sin lista, no se tocan.
        if (nueva.Accesos is not null
            && !FirmasDeAccesos(nueva.Accesos).ToHashSet(StringComparer.Ordinal).SetEquals(accesosActuales))
        {
            de.Add("los accesos");
        }

        if (nueva.FuenteIds is not null && !nueva.FuenteIds.Select(Convert.ToInt64).ToHashSet().SetEquals(fuentesActuales))
        {
            de.Add("las fuentes");
        }

        return de;
    }

    /// <summary>La firma de un acceso: lo que lo identifica ante quien lo consulta.</summary>
    public static string FirmaDeAcceso(string? tipo, string? url, string? ubicacionFisica, long? archivoId) =>
        string.Join('|', (tipo ?? string.Empty).Trim().ToLowerInvariant(), (url ?? string.Empty).Trim(),
            (ubicacionFisica ?? string.Empty).Trim(), archivoId?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty);

    private static IEnumerable<string> FirmasDeAccesos(IEnumerable<AccesoEditorialSolicitud> accesos) =>
        accesos.Where(CatalogoEditorialContrato.TieneDestinoValido)
            .Select(a => FirmaDeAcceso(a.Tipo, a.Url, a.UbicacionFisica, a.ArchivoId));

    private static bool Distinto(string? a, string? b) =>
        !string.Equals(ReglasDeErrataDeEventos.Normalizar(a), ReglasDeErrataDeEventos.Normalizar(b), StringComparison.Ordinal);

    /// <summary>Un texto «reescrito»: cambió y ya no se parece lo suficiente al que estaba.</summary>
    private static bool Reescrito(string? antes, string? despues, double minimo, bool porCaracteres = false)
    {
        var a = ReglasDeErrataDeEventos.Normalizar(antes);
        var b = ReglasDeErrataDeEventos.Normalizar(despues);
        if (string.Equals(a, b, StringComparison.Ordinal)) return false;
        if (a.Length == 0 || b.Length == 0) return true;
        var similitud = porCaracteres
            ? ReglasDeErrataDeEventos.SimilitudPorCaracteres(a, b)
            : ReglasDeErrataDeEventos.SimilitudDeDescripcion(antes, despues);
        return similitud < minimo;
    }
}
