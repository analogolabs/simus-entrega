using System.Globalization;

namespace SIMUS.Api.Historial;

/// <summary>
/// De qué naturaleza es un dato, y por eso quién puede leer su historial (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.5).
/// </summary>
/// <remarks>
/// <para>
/// <b>LOS VALORES SE GUARDAN, TODOS.</b> Decisión de la dirección del 10 de noviembre de 2026: para
/// el gobierno del dato importa saber qué valía un correo o un documento. Lo que cambia entre clases
/// no es qué se guarda sino <b>quién lo lee</b>: el público y la organización ven las filas
/// <see cref="Publico"/>, y la organización además las <see cref="Organizacion"/> (sus propios datos
/// de entidad, como el NIT); las demás las lee únicamente la consola con el módulo de Auditoría, y
/// esa lectura queda registrada en la bitácora.
/// </para>
/// <para>
/// No es la misma lista que <c>RedaccionDatosPersonales.ClaseDato</c>, que decide cómo se
/// enmascara un valor en un registro técnico. Aquí la pregunta es otra: quién puede leer el pasado de
/// un campo.
/// </para>
/// </remarks>
public enum ClaseDeDato
{
    /// <summary>Lo que el público ve o podría ver en la ficha. Lo lee también la organización.</summary>
    Publico,

    /// <summary>
    /// Datos de la propia organización que no son públicos pero tampoco personales: su NIT. Los lee la
    /// organización y la consola con el módulo del registro, sin necesitar el de Auditoría
    /// (decisión de la dirección del 10 de noviembre de 2026).
    /// </summary>
    Organizacion,

    /// <summary>Datos personales de contacto: correo, teléfono, dirección, nombre de una persona.</summary>
    Contacto,

    /// <summary>Datos que identifican a una persona: tipo y número de documento.</summary>
    Identificacion,

    /// <summary>Datos sensibles o poblacionales. Hoy no hay ninguno; la clase existe para no improvisarla.</summary>
    Sensible,
}

/// <summary>Los códigos que viajan a la base y a la API.</summary>
public static class ClaseDeDatoExtensiones
{
    public static string Codigo(this ClaseDeDato clase) => clase switch
    {
        ClaseDeDato.Publico => "publico",
        ClaseDeDato.Organizacion => "organizacion",
        ClaseDeDato.Contacto => "contacto",
        ClaseDeDato.Identificacion => "identificacion",
        ClaseDeDato.Sensible => "sensible",
        _ => throw new ArgumentOutOfRangeException(nameof(clase)),
    };

    /// <summary>Si la clase la puede leer el público: solo lo que la ficha ya muestra.</summary>
    public static bool EsPublica(string? codigo) => string.Equals(codigo, "publico", StringComparison.Ordinal);

    /// <summary>
    /// Si la clase la puede leer la organización dueña del registro, y la consola sin el módulo de
    /// Auditoría: lo público y lo que es de la propia organización. Lo personal queda fuera.
    /// </summary>
    public static bool LaLeeLaOrganizacion(string? codigo) =>
        EsPublica(codigo) || string.Equals(codigo, "organizacion", StringComparison.Ordinal);
}

/// <summary>
/// Un campo de un registro que se vigila: qué identificador y rótulo lleva en el historial, de qué
/// clase es y cómo se lee de la fila.
/// </summary>
/// <remarks>
/// <b>CADA PROCESO DECLARA LOS SUYOS.</b> No hay un interceptor global ni disparadores: registrarían
/// campos que nadie decidió vigilar, datos personales incluidos. Una lista declarada se lee de
/// arriba abajo, y una prueba falla si dos campos repiten identificador.
/// </remarks>
/// <param name="ClaseSegunValor">
/// Si la clase depende del valor (el NIT que parece una cédula es identificación de una persona, no
/// dato de la organización), cómo se decide. Recibe cada valor, anterior y nuevo, y la fila queda con la
/// clase más restrictiva de las dos.
/// </param>
/// <param name="Catalogo">
/// Si el valor es un código interno de un catálogo (un municipio, una tipología…), cuál: el historial
/// guarda el código Y el nombre que tenía ese día, y es el nombre lo que se muestra.
/// </param>
public sealed record CampoVigilado<T>(
    string Id,
    string Etiqueta,
    ClaseDeDato Clase,
    Func<T, object?> Leer,
    CatalogoDeCampo Catalogo = CatalogoDeCampo.Ninguno,
    Func<string?, ClaseDeDato>? ClaseSegunValor = null)
{
    /// <summary>La clase con la que se escribe este cambio: la declarada, o la más restrictiva según los valores.</summary>
    public ClaseDeDato ClaseDelCambio(string? anterior, string? nuevo)
    {
        if (ClaseSegunValor is null) return Clase;
        var a = ClaseSegunValor(anterior);
        var n = ClaseSegunValor(nuevo);
        return (ClaseDeDato)Math.Max((int)a, (int)n);
    }
}

/// <summary>
/// El catálogo al que pertenece el código que guarda un campo. <see cref="Ninguno"/> es el valor
/// corriente: un texto, una fecha, un número que se muestra tal cual.
/// </summary>
public enum CatalogoDeCampo
{
    Ninguno,
    Departamento,
    Municipio,
    Archivo,
    TipologiaFestival,
    FuenteFinanciacion,
    TipoOrganizador,
    Festival,
    Mercado,
    CategoriaDeContenido,
}

/// <summary>Cómo se escribe un valor en el historial: texto legible y estable, nunca un tipo de .NET.</summary>
public static class ValorDeHistorial
{
    /// <summary>Texto del valor, o <c>null</c> si está vacío. Nulo y vacío son lo mismo para quien lee.</summary>
    public static string? Texto(object? valor) => valor switch
    {
        null => null,
        string s => string.IsNullOrWhiteSpace(s) ? null : s.Trim(),
        bool b => b ? "Sí" : "No",
        DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTime d => d.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => valor.ToString(),
    };
}
