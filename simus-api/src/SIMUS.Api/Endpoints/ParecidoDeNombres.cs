using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Cuánto se parecen dos nombres de Festival, para avisar de un posible duplicado o de un histórico.
/// </summary>
/// <remarks>
/// <para>
/// <b>ANTES ERA «UNO CONTIENE AL OTRO».</b> Con esa regla, «Festival Nacional del
/// Bambuco» no encontraba «Festival del Bambuco» ni «Festival de la Chirimía» encontraba «Festival
/// Folclórico de la Chirimía»: bastaba una palabra añadida o quitada en medio. Ahora se comparan las
/// PALABRAS QUE DISTINGUEN, sin artículos ni la palabra genérica del evento («festival»,
/// «encuentro»…): si las del nombre más corto están todas en el otro, se parecen.
/// </para>
/// <para>
/// <b>QUÉ NO DISTINGUE UN NOMBRE (M2).</b> Tampoco cuentan el año («2019»), el número de la
/// edición («XXV», «25.º», «edición»), el alcance («nacional», «regional», «internacional»…), la
/// nacionalidad («colombiano») ni lo que todo Festival de este Programa es («música», «cultural»):
/// son lo que cambia entre dos copias del mismo Festival o lo que comparten cientos de Festivales
/// distintos. Con ellos, «Festival Nacional» se parecía a todos los
/// festivales nacionales y «XXV Festival del Bambuco 2019» no encontraba «Festival del Bambuco».
/// </para>
/// <para>
/// <b>LAS FALTAS DE ORTOGRAFÍA COMUNES NO DEBEN ESCONDER UN DUPLICADO.</b> Las fuentes históricas
/// escriben «Bambuko», «Zipaquirá» con «S», «Villa» con «Y» o «Huila» con «H». Cada palabra se
/// reduce a una clave fonética (b/v, s/z/c suave, k/c/qu, ll/y, h muda) y se comparan las claves.
/// Es un aviso para una persona, no una unión automática, así que la clave puede ser tosca.
/// </para>
/// <para>
/// <b>ES UN AVISO, NO UN BLOQUEO.</b> Un falso positivo cuesta mirar una tarjeta de más; un falso
/// negativo cuesta un Festival duplicado o un histórico que nadie reclama. Por eso se prefiere
/// avisar de más, con un límite de filas en quien lo use.
/// </para>
/// <para>
/// <b>ERRATAS DE TECLEO Y SIGLAS (COI2, decisión 48).</b> Dos parecidos más, con más cuidado
/// porque son los que más fácil dan falsos avisos. Valen <b>1</b> («posible coincidencia») y por eso
/// no entran donde el umbral es 2 (candidatos de fusión, «Relacionadas»): proponer unir dos
/// registros por una errata o una sigla sería demasiado. Se enseñan donde una persona decide
/// —el asistente, la lista de históricos y la importación— con su razón visible, y nunca bloquean.
/// </para>
/// <list type="bullet">
/// <item><b>Errata:</b> una palabra que distingue se escribió con una letra de más, de menos,
/// cambiada o dos intercambiadas («Festibal»). Solo desde seis letras, con la misma inicial y sin
/// confundir el género («Llanero» no es una errata de «Llanera»): ver <see cref="Criterios"/>.
/// También cuenta un nombre entero que difiere de otro en una sola letra aunque no le quede ninguna
/// palabra que distinga («Festibal de la Música»).</item>
/// <item><b>Sigla:</b> «FIMC» como las iniciales de «Festival Internacional de Música Clásica».
/// Solo se avisa con <b>respaldo territorial</b>: el mismo departamento (siglas de cuatro o más
/// letras) o el mismo municipio (de tres), porque dos Festivales distintos de dos departamentos
/// pueden compartir sigla sin ser el mismo.</item>
/// </list>
/// <para>
/// Los umbrales viven en un solo lugar, <see cref="Criterios"/>, y la medición de falsos avisos está
/// en <c>MedicionDeParecidoTests</c> (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.7).
/// </para>
/// </remarks>
public static partial class ParecidoDeNombres
{
    /// <summary>Hasta dónde llega el respaldo de territorio con el que se compara un nombre.</summary>
    public enum RespaldoTerritorial
    {
        /// <summary>No se sabe, o son territorios distintos: las siglas no avisan.</summary>
        Ninguno = 0,

        /// <summary>El mismo departamento (o el nombre buscado se limita a él).</summary>
        MismoDepartamento = 1,

        /// <summary>El mismo municipio.</summary>
        MismoMunicipio = 2,
    }

    /// <summary>
    /// <b>EL CRITERIO, EN UN SOLO LUGAR (COI2).</b> Subir un umbral da menos avisos y más duplicados
    /// sin ver; bajarlo, al revés. Cada cambio se mide con <c>MedicionDeParecidoTests</c>.
    /// </summary>
    public static class Criterios
    {
        /// <summary>Palabras más cortas que esto solo se parecen si son iguales: «Pasto» y «Pasco» son pueblos distintos.</summary>
        public const int LongitudMinimaDeUnaErrata = 6;

        /// <summary>Desde esta longitud se toleran dos errores y no uno.</summary>
        public const int LongitudParaDosErrores = 12;

        /// <summary>Como mucho esta cantidad de palabras con errata si el nombre más corto tiene una o dos palabras…</summary>
        public const int ErratasConPocasPalabras = 1;

        /// <summary>…y esta si tiene más.</summary>
        public const int ErratasConMuchasPalabras = 2;

        /// <summary>Un nombre entero (sin año ni edición) que difiere en una letra es una errata si es al menos así de largo.</summary>
        public const int LongitudMinimaDelNombreEntero = 10;

        /// <summary>Una sigla tiene entre tantas y tantas letras.</summary>
        public const int SiglaMinima = 3;

        /// <summary>Ver <see cref="SiglaMinima"/>.</summary>
        public const int SiglaMaxima = 8;

        /// <summary>Con solo el departamento de respaldo, la sigla debe tener al menos tantas letras (menos letras chocan demasiado).</summary>
        public const int SiglaMinimaConSoloDepartamento = 4;
    }

    private static readonly HashSet<string> Vacias = new(StringComparer.Ordinal)
    {
        "de", "del", "la", "las", "el", "los", "y", "e", "en", "a", "al", "por", "para", "con",
        "festival", "festivales", "fest", "encuentro", "encuentros", "muestra", "concurso",
        "jornada", "jornadas", "circuito", "feria", "semana", "temporada",
        // «Mercado» abre los nombres de los Mercados como «Festival» los de los Festivales (CON-01).
        "mercado", "mercados",
        // «Taller» abre los nombres de los talleres de lutería (LUT-02).
        "taller", "talleres", "luteria",
        // El número de la edición.
        "edicion", "version", "numero", "nro", "no",
        // El alcance y la nacionalidad no distinguen un Festival de otro.
        "nacional", "internacional", "regional", "departamental", "municipal", "distrital", "local",
        "colombia", "colombiano", "colombiana",
        // LO QUE TODOS LOS FESTIVALES DE UN PROGRAMA DE MÚSICA TIENEN EN COMÚN (D3-01). «Festival de la
        // Música» a secas encontraba cada Festival cuyo nombre trajera la palabra —diez «Festival de
        // Músicas Urbanas… MUAI de» de otros municipios— y tapaba el que sí era.
        "musica", "musicas", "musical", "musicales", "cultural", "culturales",
    };

    /// <summary>Minúsculas, sin tildes ni signos y con un solo espacio entre palabras.</summary>
    public static string Normalizar(string? valor)
    {
        var descompuesto = (valor ?? string.Empty).Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var resultado = new StringBuilder();
        foreach (var c in descompuesto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            resultado.Append(char.IsLetterOrDigit(c) ? c : ' ');
        }
        return string.Join(' ', resultado.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>Las palabras que distinguen un nombre, reducidas a su clave.</summary>
    public static HashSet<string> Palabras(string? valor) =>
        PalabrasConOriginal(valor).Select(x => x.Clave).ToHashSet(StringComparer.Ordinal);

    /// <summary>Cada palabra que distingue, con la forma en que se escribió y su clave.</summary>
    private static List<(string Original, string Clave)> PalabrasConOriginal(string? valor)
    {
        // «25.º», «25º» y «25°» son el ordinal de la edición: se quitan antes de normalizar, que
        // convertiría «º» en una letra suelta.
        var sinOrdinales = OrdinalConNumero().Replace(valor ?? string.Empty, " ");
        var resultado = new List<(string, string)>();
        var vistas = new HashSet<string>(StringComparer.Ordinal);
        foreach (var palabra in Normalizar(sinOrdinales).Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (Vacias.Contains(palabra) || EsAnio(palabra) || EsRomano(palabra)) continue;
            if (palabra.Length == 1 && !char.IsDigit(palabra[0])) continue;
            var clave = Clave(palabra);
            if (clave.Length > 0 && vistas.Add(clave)) resultado.Add((palabra, clave));
        }
        return resultado;
    }

    /// <summary>Singular aproximado y pronunciación aproximada de una palabra ya normalizada.</summary>
    private static string Clave(string palabra)
    {
        var singular = palabra.Length > 5 && palabra.EndsWith("es", StringComparison.Ordinal) ? palabra[..^2]
            : palabra.Length > 4 && palabra.EndsWith('s') ? palabra[..^1]
            : palabra;
        // El orden importa: «ce/ci» antes que «c», y «qu» antes que «u» suelta.
        var clave = singular
            .Replace("ce", "se", StringComparison.Ordinal).Replace("ci", "si", StringComparison.Ordinal)
            .Replace("qu", "k", StringComparison.Ordinal).Replace('c', 'k')
            .Replace('z', 's').Replace('v', 'b')
            .Replace("ll", "y", StringComparison.Ordinal)
            .Replace("h", string.Empty, StringComparison.Ordinal);
        return clave;
    }

    private static bool EsAnio(string palabra) =>
        palabra.Length == 4 && palabra.All(char.IsDigit) && (palabra.StartsWith("19", StringComparison.Ordinal) || palabra.StartsWith("20", StringComparison.Ordinal));

    private static bool EsRomano(string palabra) => palabra.Length <= 8 && NumeroRomano().IsMatch(palabra);

    // «25º», «25.º», «25 º» y «25°»: el ordinal de la edición.
    [GeneratedRegex(@"\d+\s*\.?\s*[º°ª]\.?", RegexOptions.CultureInvariant)]
    private static partial Regex OrdinalConNumero();

    [GeneratedRegex(@"^(?=[mdclxvi])m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$", RegexOptions.CultureInvariant)]
    private static partial Regex NumeroRomano();

    // ---------- Erratas de tecleo (COI2) -----------------------------------------------------------

    /// <summary>
    /// Distancia de edición con intercambio de letras contiguas (Damerau, «distancia de cadena
    /// óptima»): una letra de más, de menos, cambiada, o dos intercambiadas valen 1.
    /// </summary>
    public static int DistanciaDeEdicion(string a, string b)
    {
        if (a.Length == 0) return b.Length;
        if (b.Length == 0) return a.Length;
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
        {
            for (var j = 1; j <= b.Length; j++)
            {
                var costo = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + costo);
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1])
                    d[i, j] = Math.Min(d[i, j], d[i - 2, j - 2] + 1);
            }
        }
        return d[a.Length, b.Length];
    }

    /// <summary>«Llanero» y «Llanera» son palabras distintas, no una errata: difieren solo en el género.</summary>
    private static bool SoloCambiaElGenero(string a, string b) =>
        a.Length == b.Length && a.Length > 1 && a[..^1] == b[..^1]
        && ((a[^1] == 'a' && b[^1] == 'o') || (a[^1] == 'o' && b[^1] == 'a'));

    /// <summary>¿Una palabra es una errata de otra? Ver <see cref="Criterios"/>.</summary>
    public static bool EsErrata(string a, string b)
    {
        if (a == b) return false;
        if (a.Length < Criterios.LongitudMinimaDeUnaErrata || b.Length < Criterios.LongitudMinimaDeUnaErrata) return false;
        if (a.Any(char.IsDigit) || b.Any(char.IsDigit)) return false;
        if (a[0] != b[0]) return false;
        var maximo = Math.Max(a.Length, b.Length) >= Criterios.LongitudParaDosErrores ? 2 : 1;
        if (Math.Abs(a.Length - b.Length) > maximo) return false;
        if (SoloCambiaElGenero(a, b)) return false;
        return DistanciaDeEdicion(a, b) <= maximo;
    }

    /// <summary>El nombre sin año, edición ni ordinales, pero con las palabras genéricas («festival»): para comparar nombres enteros.</summary>
    private static string FormaCompleta(string? valor)
    {
        var sinOrdinales = OrdinalConNumero().Replace(valor ?? string.Empty, " ");
        var palabras = Normalizar(sinOrdinales).Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(x => !EsAnio(x) && !EsRomano(x) && !(x.Length == 1 && !char.IsDigit(x[0])));
        return string.Join(' ', palabras);
    }

    // ---------- Siglas (COI2) ----------------------------------------------------------------------

    /// <summary>Artículos, preposiciones y conectores: no cuentan para la sigla («Festival de la Música» → F M).</summary>
    private static readonly HashSet<string> Conectores = new(StringComparer.Ordinal)
    {
        "de", "del", "la", "las", "el", "los", "un", "una", "y", "e", "o", "u", "en", "a", "al",
        "por", "para", "con", "sin", "sobre", "entre", "edicion", "version", "numero", "nro", "no",
    };

    /// <summary>La palabra del evento que abre muchos nombres y que a veces se deja fuera de la sigla.</summary>
    private static readonly HashSet<string> GenericasDeApertura = new(StringComparer.Ordinal)
    {
        "festival", "festivales", "fest", "encuentro", "encuentros", "muestra", "concurso",
        "jornada", "jornadas", "circuito", "feria", "semana", "temporada", "mercado", "mercados",
    };

    private static readonly char[] SeparadoresDeSigla = [' ', '-', '–'];

    /// <summary>
    /// Si lo escrito parece una sigla («FIMC», «F.I.M.C.»), sus letras en minúscula; si no, <c>null</c>.
    /// </summary>
    /// <remarks>
    /// Se mira lo escrito y no lo normalizado, porque la mayúscula es lo que distingue «FIMC» de
    /// «Fimc». Una palabra común en mayúsculas («JAZZ») también lo parece: por eso la sigla solo avisa
    /// cuando alguien tiene exactamente esas iniciales y hay respaldo de territorio.
    /// </remarks>
    public static string? SiglaEscrita(string? valor)
    {
        var sinOrdinales = OrdinalConNumero().Replace((valor ?? string.Empty).Trim(), " ");
        var piezas = sinOrdinales.Split(SeparadoresDeSigla, StringSplitOptions.RemoveEmptyEntries)
            // El año y cualquier pieza con números («2019», «25») son la edición, no la sigla.
            .Where(x => !x.Any(char.IsDigit))
            .ToList();
        // «XXV FIMC»: el número de la edición en romanos acompaña a la sigla y no es parte de ella.
        if (piezas.Count > 1 && !piezas.All(x => x.Replace(".", string.Empty, StringComparison.Ordinal).Length == 1))
            piezas = piezas.Where(x => !EsRomano(Normalizar(x))).ToList();
        if (piezas.Count == 0) return null;
        // «F I M C» o «F.I.M.C.»: letras sueltas; «FIMC»: una sola pieza.
        if (piezas.Count > 1 && !piezas.All(x => x.Replace(".", string.Empty, StringComparison.Ordinal).Length == 1)) return null;
        var unido = string.Concat(piezas).Replace(".", string.Empty, StringComparison.Ordinal);
        if (unido.Length < Criterios.SiglaMinima || unido.Length > Criterios.SiglaMaxima) return null;
        if (!unido.All(c => char.IsLetter(c) && char.IsUpper(c))) return null;
        return Normalizar(unido).Replace(" ", string.Empty, StringComparison.Ordinal);
    }

    /// <summary>Las siglas que puede tener un nombre: con todas las palabras y sin la que abre («Festival»).</summary>
    public static HashSet<string> SiglasDe(string? nombre)
    {
        var sinOrdinales = OrdinalConNumero().Replace(nombre ?? string.Empty, " ");
        var palabras = Normalizar(sinOrdinales).Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(x => x.Length > 1 && !Conectores.Contains(x) && !EsAnio(x) && !EsRomano(x) && !x.Any(char.IsDigit))
            .ToList();
        var resultado = new HashSet<string>(StringComparer.Ordinal);
        void Agregar(IReadOnlyList<string> lista)
        {
            if (lista.Count < Criterios.SiglaMinima || lista.Count > Criterios.SiglaMaxima) return;
            resultado.Add(new string(lista.Select(x => x[0]).ToArray()));
        }
        Agregar(palabras);
        if (palabras.Count > 0 && GenericasDeApertura.Contains(palabras[0])) Agregar(palabras.Skip(1).ToList());
        return resultado;
    }

    /// <summary>¿La sigla corresponde a las iniciales del nombre y hay respaldo de territorio suficiente?</summary>
    private static bool SiglaCorresponde(string sigla, string? nombre, RespaldoTerritorial respaldo) =>
        RespaldoSuficiente(sigla.Length, respaldo) && SiglasDe(nombre).Contains(sigla);

    /// <summary>Con el mismo municipio basta; con solo el departamento hace falta una sigla de cuatro o más letras.</summary>
    private static bool RespaldoSuficiente(int letrasDeLaSigla, RespaldoTerritorial respaldo) => respaldo switch
    {
        RespaldoTerritorial.MismoMunicipio => true,
        RespaldoTerritorial.MismoDepartamento => letrasDeLaSigla >= Criterios.SiglaMinimaConSoloDepartamento,
        _ => false,
    };

    /// <summary>
    /// El nombre que se busca, preparado una sola vez para compararlo con muchos candidatos.
    /// </summary>
    /// <remarks>
    /// Comparar miles de Festivales con el mismo nombre normalizaba y troceaba ese nombre en cada
    /// comparación. Aquí se hace una vez.
    /// </remarks>
    public sealed class Consulta
    {
        private readonly string _buscado;
        private readonly string _normalizado;
        private readonly string _completa;
        private readonly List<(string Original, string Clave)> _palabras;
        private readonly HashSet<string> _claves;
        private readonly string? _sigla;
        private readonly HashSet<string> _siglas;

        public Consulta(string? buscado)
        {
            _buscado = (buscado ?? string.Empty).Trim();
            _normalizado = Normalizar(buscado);
            _completa = FormaCompleta(buscado);
            _palabras = PalabrasConOriginal(buscado);
            _claves = _palabras.Select(x => x.Clave).ToHashSet(StringComparer.Ordinal);
            _sigla = SiglaEscrita(buscado);
            _siglas = SiglasDe(buscado);
        }

        /// <summary>
        /// 0 si no se parecen; 3 si son el mismo nombre; 2 si las palabras de uno están en el otro;
        /// 1 si comparten la mayoría o si es una posible errata o una sigla con respaldo de territorio.
        /// </summary>
        /// <param name="candidato">El nombre con el que se compara.</param>
        /// <param name="respaldo">
        /// El territorio que comparten los dos Festivales. Sin él (<see cref="RespaldoTerritorial.Ninguno"/>)
        /// las siglas no avisan: dos Festivales de departamentos distintos pueden compartirla.
        /// </param>
        public int Puntaje(string? candidato, RespaldoTerritorial respaldo = RespaldoTerritorial.Ninguno) =>
            Comparar(candidato, respaldo).Puntaje;

        /// <summary>Lo mismo, con la explicación para quien decide, o <c>null</c> si no se parecen.</summary>
        public string? Razon(string? candidato, RespaldoTerritorial respaldo = RespaldoTerritorial.Ninguno) =>
            Comparar(candidato, respaldo).Razon;

        /// <summary>El puntaje y la razón de una sola vez.</summary>
        public (int Puntaje, string? Razon) Evaluar(string? candidato, RespaldoTerritorial respaldo = RespaldoTerritorial.Ninguno) =>
            Comparar(candidato, respaldo);

        private (int Puntaje, string? Razon) Comparar(string? candidato, RespaldoTerritorial respaldo)
        {
            var porPalabras = CompararPorPalabras(candidato);
            if (porPalabras.Puntaje > 0) return porPalabras;
            // LO QUE SIGUE VALE 1 Y NUNCA MÁS: es una posible coincidencia, no una unión.
            return PorErrataEnElNombreEntero(candidato)
                ?? PorPalabraConErrata(candidato)
                ?? PorSigla(candidato, respaldo)
                ?? (0, null);
        }

        private (int Puntaje, string? Razon) CompararPorPalabras(string? candidato)
        {
            var a = Normalizar(candidato);
            if (a.Length == 0 || _normalizado.Length == 0) return (0, null);
            if (a == _normalizado) return (3, "Es el mismo nombre.");

            var propias = PalabrasConOriginal(candidato);
            // SIN PALABRAS QUE DISTINGAN NO HAY AVISO: «Festival» a secas se parecería a todos.
            if (propias.Count == 0 || _palabras.Count == 0) return (0, null);
            var clavesPropias = propias.Select(x => x.Clave).ToHashSet(StringComparer.Ordinal);
            var comunes = propias.Where(x => _claves.Contains(x.Clave)).Select(x => x.Original).ToList();
            var lista = string.Join(", ", comunes);
            if (clavesPropias.SetEquals(_claves))
                return (3, $"Tienen las mismas palabras que distinguen el nombre: {lista}.");
            var menor = Math.Min(clavesPropias.Count, _claves.Count);
            if (comunes.Count == menor)
                return (2, $"Todas las palabras del nombre más corto están en el otro: {lista}.");
            if (comunes.Count * 3 >= Math.Max(clavesPropias.Count, _claves.Count) * 2)
                return (1, $"Comparten la mayoría de las palabras: {lista}.");
            return (0, null);
        }

        /// <summary>
        /// Dos nombres que difieren en una sola letra («Festibal de la Música» y «Festival de la
        /// Música») cuando uno no tiene ninguna palabra que distinga: por palabras no se parecerían a
        /// nada. Si los dos tienen palabras que distinguen, actúa la regla por palabra, que exige seis
        /// letras: «Cuerdas de Neiva» y «Cuerdas de Leiva» son municipios distintos, no una errata.
        /// </summary>
        private (int, string?)? PorErrataEnElNombreEntero(string? candidato)
        {
            if (_palabras.Count > 0 && PalabrasConOriginal(candidato).Count > 0) return null;
            var otra = FormaCompleta(candidato);
            if (_completa.Length < Criterios.LongitudMinimaDelNombreEntero || otra.Length < Criterios.LongitudMinimaDelNombreEntero) return null;
            // Un número suelto («Jazz 1» y «Jazz 2») no es una errata sino otra edición u otro Festival.
            if (_completa.Any(char.IsDigit) || otra.Any(char.IsDigit)) return null;
            if (_completa[0] != otra[0] || Math.Abs(_completa.Length - otra.Length) > 1) return null;
            if (SoloCambiaElGenero(_completa, otra)) return null;
            return DistanciaDeEdicion(_completa, otra) == 1
                ? (1, $"Posible errata de tecleo: «{otra}» se escribe casi igual que «{_completa}».")
                : null;
        }

        /// <summary>
        /// Todas las palabras del nombre más corto están en el otro, salvo una o dos con una errata
        /// («Festival Currulao de Guapi» y «Festival Currulo de Guapi»): ver <see cref="Criterios"/>.
        /// </summary>
        private (int, string?)? PorPalabraConErrata(string? candidato)
        {
            var propias = PalabrasConOriginal(candidato);
            if (propias.Count == 0 || _palabras.Count == 0) return null;
            var (menor, mayor) = propias.Count <= _palabras.Count ? (propias, _palabras) : (_palabras, propias);
            var clavesDelMayor = mayor.Select(x => x.Clave).ToHashSet(StringComparer.Ordinal);
            var usadas = new HashSet<int>();
            var erratas = new List<(string Escrita, string Esperada)>();
            foreach (var palabra in menor)
            {
                if (clavesDelMayor.Contains(palabra.Clave)) continue;
                var indice = -1;
                for (var i = 0; i < mayor.Count; i++)
                {
                    if (usadas.Contains(i) || !EsErrata(palabra.Original, mayor[i].Original)) continue;
                    indice = i;
                    break;
                }
                // UNA SOLA PALABRA SIN PAREJA Y NO HAY AVISO: la errata no puede esconder un nombre distinto.
                if (indice < 0) return null;
                usadas.Add(indice);
                erratas.Add((palabra.Original, mayor[indice].Original));
            }
            var tope = menor.Count <= 2 ? Criterios.ErratasConPocasPalabras : Criterios.ErratasConMuchasPalabras;
            if (erratas.Count == 0 || erratas.Count > tope) return null;
            var detalle = string.Join(", ", erratas.Select(x => $"«{x.Escrita}» y «{x.Esperada}»"));
            return (1, $"Posible errata de tecleo: {detalle} se escriben casi igual.");
        }

        /// <summary>
        /// «FIMC» y las iniciales de «Festival Internacional de Música Clásica», con respaldo de territorio.
        /// </summary>
        private (int, string?)? PorSigla(string? candidato, RespaldoTerritorial respaldo)
        {
            if (respaldo == RespaldoTerritorial.Ninguno) return null;
            // Lo buscado es la sigla y el candidato tiene esas iniciales…
            if (_sigla is not null && SiglaCorresponde(_sigla, candidato, respaldo))
                return (1, $"Posible coincidencia por sigla: «{_sigla.ToUpperInvariant()}» son las iniciales de «{(candidato ?? string.Empty).Trim()}».");
            // …o el candidato guardado es la sigla y lo buscado tiene esas iniciales.
            var guardada = SiglaEscrita(candidato);
            if (guardada is not null && _siglas.Contains(guardada) && RespaldoSuficiente(guardada.Length, respaldo))
                return (1, $"Posible coincidencia por sigla: «{guardada.ToUpperInvariant()}» son las iniciales de «{_buscado}».");
            return null;
        }
    }

    /// <summary>¿La razón es la de un aviso por sigla?</summary>
    public static bool EsAvisoDeSigla(string? razon) =>
        razon is not null && razon.StartsWith("Posible coincidencia por sigla", StringComparison.Ordinal);

    /// <summary>¿La razón es la de un aviso por errata de tecleo?</summary>
    public static bool EsAvisoDeErrata(string? razon) =>
        razon is not null && razon.StartsWith("Posible errata de tecleo", StringComparison.Ordinal);

    /// <summary>
    /// Puntúa un nombre contra una lista de candidatos y devuelve los que se parecen, con su razón.
    /// ES LA ÚNICA PUERTA que usan el asistente, la lista de históricos y la importación.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>UNA SIGLA QUE CORRESPONDE A MÁS DE UN FESTIVAL ES AMBIGUA Y NO AVISA (COI2).</b> La medición
    /// con los Festivales de la demostración lo encontró: las series con la misma plantilla
    /// («Festival de Canta y Torbellino de Anorí», «… de Anzá», «… de Arboletes») comparten la sigla
    /// «FCTA». Escribirla avisaría de quince Festivales a la vez, y eso no le sirve a nadie: no dice
    /// cuál es el suyo. Si varios Festivales DISTINTOS (de nombre distinto) corresponden a la sigla,
    /// ninguno avisa por ella; si solo uno, avisa. Dos filas con el mismo nombre —el mismo Festival
    /// cargado de dos fuentes— cuentan como uno.
    /// </para>
    /// <para>Las demás razones (palabras, erratas) no cambian.</para>
    /// </remarks>
    public static List<(T Item, int Puntaje, string? Razon)> Puntuar<T>(
        string? buscado, IEnumerable<T> candidatos, Func<T, string?> nombre, Func<T, RespaldoTerritorial> respaldo)
    {
        var consulta = new Consulta(buscado);
        var resultado = new List<(T Item, int Puntaje, string? Razon)>();
        foreach (var candidato in candidatos)
        {
            var (puntaje, razon) = consulta.Evaluar(nombre(candidato), respaldo(candidato));
            if (puntaje > 0) resultado.Add((candidato, puntaje, razon));
        }
        var festivalesPorSigla = resultado
            .Where(x => EsAvisoDeSigla(x.Razon))
            .Select(x => Normalizar(nombre(x.Item)))
            .Distinct(StringComparer.Ordinal)
            .Count();
        return festivalesPorSigla > 1 ? resultado.Where(x => !EsAvisoDeSigla(x.Razon)).ToList() : resultado;
    }

    /// <summary>
    /// El respaldo de territorio entre lo que se busca y un candidato: el mismo municipio, el mismo
    /// departamento o ninguno (otro departamento, o el candidato sin departamento, de alcance nacional).
    /// </summary>
    public static RespaldoTerritorial RespaldoDe(string? departamentoBuscado, string? municipioBuscado, string? departamentoCandidato, string? municipioCandidato)
    {
        if (string.IsNullOrWhiteSpace(departamentoBuscado) || string.IsNullOrWhiteSpace(departamentoCandidato)) return RespaldoTerritorial.Ninguno;
        if (!string.Equals(departamentoBuscado.Trim(), departamentoCandidato.Trim(), StringComparison.Ordinal)) return RespaldoTerritorial.Ninguno;
        return !string.IsNullOrWhiteSpace(municipioBuscado) && string.Equals(municipioBuscado.Trim(), municipioCandidato?.Trim(), StringComparison.Ordinal)
            ? RespaldoTerritorial.MismoMunicipio
            : RespaldoTerritorial.MismoDepartamento;
    }

    /// <summary>
    /// 0 si no se parecen; 3 si son el mismo nombre; 2 si las palabras de uno están en el otro;
    /// 1 si comparten la mayoría o si es una posible errata o una sigla con respaldo de territorio.
    /// </summary>
    public static int Puntaje(string? candidato, string? buscado, RespaldoTerritorial respaldo = RespaldoTerritorial.Ninguno) =>
        new Consulta(buscado).Puntaje(candidato, respaldo);

    /// <summary>Por qué se parecen dos nombres, dicho para una persona; <c>null</c> si no se parecen.</summary>
    public static string? Razon(string? candidato, string? buscado, RespaldoTerritorial respaldo = RespaldoTerritorial.Ninguno) =>
        new Consulta(buscado).Razon(candidato, respaldo);

    public static bool SeParecen(string? candidato, string? buscado, RespaldoTerritorial respaldo = RespaldoTerritorial.Ninguno) =>
        Puntaje(candidato, buscado, respaldo) > 0;
}
