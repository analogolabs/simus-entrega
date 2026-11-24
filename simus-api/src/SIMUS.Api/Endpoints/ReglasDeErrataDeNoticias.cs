using SIMUS.Contracts;
using SIMUS.Domain.Entities;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Qué es una errata y qué es un cambio de fondo en una noticia publicada (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 97). Es la misma regla que ya aplican el Catálogo (decisión 36) y los
/// eventos de organización (decisión 24).
/// </summary>
/// <remarks>
/// <para>
/// <b>LO DECIDE EL SERVIDOR, NO LA CASILLA.</b> Hasta hoy Noticias y Agenda tenían una casilla «es
/// una errata» que declaraba quien edita. Dejarle marcar su propio cambio como errata es dejarle
/// decidir si necesita revisión: cambiar el titular marcándolo así dejaba publicado, sin que nadie
/// lo viera, algo que no se aprobó. Y al revés: corregir una coma sin marcarla despublicaba la
/// noticia.
/// </para>
/// <para>
/// <b>ES DE FONDO</b> lo que cambia <i>qué se cuenta o de cuándo es</i>: el titular reescrito (se
/// conserva menos del 70 % de los caracteres), el resumen o el cuerpo reescritos (menos del 60 %),
/// la fecha de publicación y la categoría. <b>ES ERRATA</b> lo demás: ortografía, tildes,
/// puntuación, un texto que cambia poco, el pie y la imagen, la autoría y las etiquetas.
/// </para>
/// <para>
/// <b>EL UMBRAL ES CONSERVADOR A PROPÓSITO</b> (el mismo del Catálogo y los eventos): ante la duda,
/// revisión.
/// </para>
/// </remarks>
public static class ReglasDeErrataDeNoticias
{
    /// <summary>Del titular debe conservarse al menos esta fracción de caracteres para ser errata.</summary>
    public const double SimilitudMinimaDelTitular = ReglasDeErrataDeEventos.SimilitudMinimaDelTitulo;

    /// <summary>Del resumen y del cuerpo debe conservarse al menos esta fracción para ser errata.</summary>
    public const double SimilitudMinimaDelTexto = ReglasDeErrataDeEventos.SimilitudMinimaDeLaDescripcion;

    /// <summary>
    /// Lo que cambia «de fondo» entre la noticia publicada y lo que se pide guardar, dicho en una
    /// frase corta cada cosa. Vacío: todo es errata.
    /// </summary>
    /// <param name="actual">La noticia tal como está publicada, ANTES de aplicar los cambios.</param>
    /// <param name="nueva">Lo que se pide guardar.</param>
    public static IReadOnlyList<string> CambiosDeFondo(NoticiaRow actual, GuardarNoticiaSolicitud nueva)
    {
        ArgumentNullException.ThrowIfNull(actual);
        ArgumentNullException.ThrowIfNull(nueva);

        var de = new List<string>();

        if (Reescrito(actual.Titulo, nueva.Titulo, SimilitudMinimaDelTitular, porCaracteres: true)) de.Add("el titular");
        if (Reescrito(actual.Resumen, nueva.Resumen, SimilitudMinimaDelTexto)) de.Add("el resumen");
        if (Reescrito(actual.Cuerpo, nueva.Cuerpo, SimilitudMinimaDelTexto)) de.Add("el cuerpo");
        if (actual.FechaPublicacion != nueva.FechaPublicacion) de.Add("la fecha de publicación");
        if (actual.CategoriaId != nueva.CategoriaId) de.Add("la categoría");

        return de;
    }

    /// <summary>
    /// La imagen principal que quedará tras guardar: la que llega, ninguna si se pide retirarla, o la
    /// que ya había. Cambiarla o retirarla es siempre errata (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 113): nunca es «de
    /// fondo», así que <see cref="CambiosDeFondo"/> no la mira y esta regla la deja registrada.
    /// </summary>
    public static int? ImagenResultante(int? actual, GuardarNoticiaSolicitud nueva)
    {
        ArgumentNullException.ThrowIfNull(nueva);
        if (nueva.ImagenArchivoId is { } id && id > 0) return id;
        return nueva.RetirarImagen ? null : actual;
    }

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
