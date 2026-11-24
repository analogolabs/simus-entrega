using System.Globalization;
using System.Text;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Qué es una errata y qué es un cambio de fondo en un evento publicado por una organización
/// (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 24).
/// </summary>
/// <remarks>
/// <para>
/// <b>LA ERRATA SE CORRIGE AL INSTANTE Y EL EVENTO SIGUE EN LA AGENDA.</b> Un cambio de fondo lo
/// devuelve a revisión, porque lo que el Programa aprobó ya no es lo que se va a anunciar. Es el
/// criterio de Noticias y del Catálogo («erratas al instante, cambio de fondo vuelve a revisión»),
/// con una diferencia: aquí <b>no lo declara quien edita, lo decide el servidor comparando lo que
/// hay con lo que llega</b>. Dejarle a la organización marcar «es una errata» sería dejarle decidir
/// si lo suyo necesita revisión: cambiar la fecha del concierto marcándolo como errata dejaría
/// publicado, sin que nadie lo viera, algo que el Programa nunca aprobó.
/// </para>
/// <para>
/// <b>ES DE FONDO</b> lo que cambia <i>qué se anuncia, cuándo, dónde o por quién</i>: la fecha de
/// inicio o de fin, la hora, la modalidad, el lugar, el territorio, el enlace, el proceso
/// (Festival o Mercado) que lo enmarca —y con él quién lo organiza— y un título o una descripción
/// reescritos de modo que ya no dicen lo mismo. Un evento no tiene precio en esta base; el día que
/// lo tenga, también será de fondo.
/// </para>
/// <para>
/// <b>ES ERRATA</b> lo demás: ortografía, tildes, puntuación, redacción y una descripción que crece o
/// cambia poco. «Poco» es medible: el título se compara por caracteres (se conserva al menos el
/// 70 %) y las descripciones por caracteres o por palabras, la medida que más se parezca (al menos
/// el 60 %). El lugar se
/// compara sin tildes, mayúsculas ni espacios de más: «teatro  municipal» y «Teatro Municipal» son el
/// mismo sitio; «Teatro Municipal» y «Parque de la Música» no.
/// </para>
/// <para>
/// <b>EL UMBRAL ES CONSERVADOR A PROPÓSITO:</b> ante la duda, revisión. Una errata que sale como
/// cambio de fondo cuesta una espera; un cambio de fondo que sale como errata cuesta una agenda
/// pública que miente.
/// </para>
/// </remarks>
public static class ReglasDeErrataDeEventos
{
    /// <summary>Del título debe conservarse al menos esta fracción de caracteres para ser errata.</summary>
    public const double SimilitudMinimaDelTitulo = 0.7;

    /// <summary>De cada descripción debe conservarse al menos esta fracción de palabras.</summary>
    public const double SimilitudMinimaDeLaDescripcion = 0.6;

    /// <summary>
    /// Por encima de este tamaño no se compara por caracteres (la distancia de edición es
    /// cuadrática): el título admite 300, así que en la práctica no se alcanza.
    /// </summary>
    private const int TopeDeComparacionPorCaracteres = 600;

    /// <summary>
    /// Lo que cambia «de fondo» entre el evento publicado y lo que se pide guardar, dicho en una
    /// frase corta cada cosa («la fecha», «el lugar»). Vacío: todo es errata.
    /// </summary>
    public static IReadOnlyList<string> CambiosDeFondo(EventoAgendaRow actual, CrearEventoDeOrganizacionSolicitud nueva)
    {
        ArgumentNullException.ThrowIfNull(actual);
        ArgumentNullException.ThrowIfNull(nueva);

        var de = new List<string>();

        if (actual.FechaInicio != nueva.FechaInicio || actual.FechaFin != nueva.FechaFin) de.Add("la fecha");
        if (actual.HoraInicio != nueva.HoraInicio || actual.HoraFin != nueva.HoraFin) de.Add("la hora");
        if (!string.Equals(actual.Modalidad, nueva.Modalidad, StringComparison.Ordinal)) de.Add("la modalidad");
        if (Normalizar(actual.Lugar) != Normalizar(nueva.Lugar)) de.Add("el lugar");

        if (Codigo(actual.CodigoDepartamento) != Codigo(nueva.CodigoDepartamento)
            || Codigo(actual.CodigoMunicipio) != Codigo(nueva.CodigoMunicipio))
        {
            de.Add("el territorio");
        }

        if (!string.Equals(Recortar(actual.Url), Recortar(nueva.Url), StringComparison.Ordinal)) de.Add("el enlace");

        // EL PROCESO ES UNO SOLO DE CINCO (Festival, Mercado, Taller, Espacio o Red): se compara el par
        // «tipo, id» que enmarca el evento antes y después, no cada columna por separado.
        if (ProcesoDelEvento.De(actual) != ProcesoDelEvento.De(nueva)) de.Add("el proceso que lo enmarca");

        if (SimilitudPorCaracteres(Normalizar(actual.Titulo), Normalizar(nueva.Titulo)) < SimilitudMinimaDelTitulo)
        {
            de.Add("el título");
        }

        if (SimilitudDeDescripcion(actual.Descripcion, nueva.Descripcion) < SimilitudMinimaDeLaDescripcion
            || SimilitudDeDescripcion(actual.DescripcionLarga, nueva.DescripcionLarga) < SimilitudMinimaDeLaDescripcion)
        {
            de.Add("la descripción");
        }

        return de;
    }

    /// <summary>
    /// Lo mismo para un evento que guarda la consola de Agenda (seguimiento de G1; decisión
    /// 97): la regla es una sola, la del evento de organización. El guardado de la consola no cambia
    /// de Mercado, así que el Mercado actual se conserva y solo cuenta el cambio de Festival.
    /// </summary>
    public static IReadOnlyList<string> CambiosDeFondo(EventoAgendaRow actual, GuardarEventoAgendaSolicitud nueva)
    {
        ArgumentNullException.ThrowIfNull(actual);
        ArgumentNullException.ThrowIfNull(nueva);

        return CambiosDeFondo(actual, new CrearEventoDeOrganizacionSolicitud
        {
            Titulo = nueva.Titulo,
            Descripcion = nueva.Descripcion,
            DescripcionLarga = nueva.DescripcionLarga,
            FechaInicio = nueva.FechaInicio,
            FechaFin = nueva.FechaFin,
            HoraInicio = nueva.HoraInicio,
            HoraFin = nueva.HoraFin,
            // El guardado de la consola pasa la modalidad a minúscula y completa el enlace con https.
            Modalidad = (nueva.Modalidad ?? string.Empty).Trim().ToLowerInvariant(),
            Lugar = nueva.Lugar,
            CodigoDepartamento = nueva.CodigoDepartamento,
            CodigoMunicipio = nueva.CodigoMunicipio,
            Url = SIMUS.Infrastructure.Common.ValidationHelpers.NormalizeHttpsUrl(
                string.IsNullOrWhiteSpace(nueva.Url) ? null : nueva.Url.Trim()),
            FestivalId = nueva.FestivalId,
            // El guardado de la consola no cambia el proceso del evento si es de un Mercado, un Taller,
            // un Espacio o una Red: se conserva y solo cuenta el cambio de Festival.
            MercadoId = actual.MercadoId,
            TallerId = actual.TallerId,
            EspacioId = actual.EspacioId,
            RedId = actual.RedId,
        });
    }

    /// <summary>«Es la fecha y el lugar», «el lugar»: la lista dicha en prosa.</summary>
    public static string EnProsa(IReadOnlyList<string> cambios) => cambios.Count switch
    {
        0 => string.Empty,
        1 => cambios[0],
        _ => string.Join(", ", cambios.Take(cambios.Count - 1)) + " y " + cambios[^1],
    };

    // ---------- Comparaciones ------------------------------------------------------------

    private static string? Recortar(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static string? Codigo(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    /// <summary>Minúsculas, sin tildes ni signos y con un solo espacio entre palabras.</summary>
    public static string Normalizar(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return string.Empty;

        var descompuesto = texto.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(descompuesto.Length);
        var espacioPendiente = false;
        foreach (var c in descompuesto)
        {
            var categoria = CharUnicodeInfo.GetUnicodeCategory(c);
            if (categoria == UnicodeCategory.NonSpacingMark) continue;

            if (char.IsLetterOrDigit(c))
            {
                if (espacioPendiente && sb.Length > 0) sb.Append(' ');
                espacioPendiente = false;
                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                espacioPendiente = true;
            }
        }

        return sb.ToString();
    }

    /// <summary>1 si son iguales, 0 si no comparten nada: 1 − distancia de edición / longitud mayor.</summary>
    public static double SimilitudPorCaracteres(string a, string b)
    {
        if (a == b) return 1;
        if (a.Length == 0 || b.Length == 0) return 0;
        var mayor = Math.Max(a.Length, b.Length);
        if (mayor > TopeDeComparacionPorCaracteres) return SimilitudPorPalabras(a, b);

        var anterior = new int[b.Length + 1];
        var actual = new int[b.Length + 1];
        for (var j = 0; j <= b.Length; j++) anterior[j] = j;

        for (var i = 1; i <= a.Length; i++)
        {
            actual[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                var costo = a[i - 1] == b[j - 1] ? 0 : 1;
                actual[j] = Math.Min(Math.Min(actual[j - 1] + 1, anterior[j] + 1), anterior[j - 1] + costo);
            }
            (anterior, actual) = (actual, anterior);
        }

        return 1d - (double)anterior[b.Length] / mayor;
    }

    /// <summary>
    /// La mayor de las dos medidas: por caracteres (una descripción corta con una errata de una
    /// letra casi no comparte palabras enteras, pero sí caracteres) y por palabras (un texto largo
    /// con una frase añadida casi no se parece por caracteres, pero sí por palabras).
    /// </summary>
    public static double SimilitudDeDescripcion(string? a, string? b) =>
        Math.Max(
            SimilitudPorCaracteres(Normalizar(a), Normalizar(b)),
            SimilitudPorPalabras(a, b));

    /// <summary>
    /// Palabras en común sobre palabras en total (índice de Jaccard). Dos textos vacíos son iguales;
    /// uno vacío y otro no, distintos.
    /// </summary>
    public static double SimilitudPorPalabras(string? a, string? b)
    {
        var palabrasA = Palabras(a);
        var palabrasB = Palabras(b);
        if (palabrasA.Count == 0 && palabrasB.Count == 0) return 1;
        if (palabrasA.Count == 0 || palabrasB.Count == 0) return 0;

        var comunes = palabrasA.Intersect(palabrasB).Count();
        var total = palabrasA.Union(palabrasB).Count();
        return (double)comunes / total;
    }

    private static HashSet<string> Palabras(string? texto) =>
        Normalizar(texto).Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
}
