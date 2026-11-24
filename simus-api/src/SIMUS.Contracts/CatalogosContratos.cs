namespace SIMUS.Contracts;

/// <summary>
/// Un elemento de los catálogos «Territorios sonoros» o «Prácticas musicales» con su ficha conceptual completa,
/// tal como lo ve la sección «Catálogos» de la consola.
/// </summary>
/// <remarks>
/// El mismo registro sirve a los dos catálogos. <c>PadreId</c> solo aplica a las prácticas (jerarquía opcional de un
/// nivel) y <c>RelacionTerritorial</c> solo a los territorios. Los textos de la ficha son texto plano: los párrafos se
/// separan con una línea en blanco y el portal los escribe con el escape del navegador, sin interpretar marcado.
/// </remarks>
public sealed record ElementoDeCatalogoDto(
    int Id,
    string Nombre,
    string Slug,
    int Orden,
    bool Activo,
    int? PadreId,
    string? PadreNombre,
    string? Sinonimos,
    string? Observaciones,
    string? DefinicionBreve,
    string? DefinicionAmpliada,
    string? Caracteristicas,
    string? RelacionTerritorial,
    string? Contextos,
    string? Ejemplos,
    string? Fuentes,
    bool EsPreliminar,
    int? ImagenArchivoId,
    string? ImagenUrl,
    string? TextoAlternativoRecurso,
    DateTime? FechaActualizacion,
    /// <summary>Cuántos registros, contenidos y perfiles lo usan hoy (suma de <c>Usos</c>).</summary>
    int TotalDeUsos,
    IReadOnlyList<UsoDeCatalogoDto> Usos,
    /// <summary>Cuántas prácticas lo tienen como principal (siempre 0 en territorios).</summary>
    int Subelementos,
    /// <summary>«completa», «preliminar» o «pendiente»: lo que el portal mostrará de la ficha.</summary>
    string EstadoDeFicha);

/// <summary>Dónde se usa un elemento: la etiqueta legible de la fuente y cuántas veces.</summary>
public sealed record UsoDeCatalogoDto(string Fuente, int Total);

/// <summary>Los campos que la consola puede guardar de un elemento y su ficha.</summary>
public sealed class GuardarElementoDeCatalogoSolicitud
{
    public string Nombre { get; set; } = string.Empty;
    /// <summary>Opcional: si no viene, se calcula del nombre. No se cambia una vez publicado sin pedirlo expresamente.</summary>
    public string? Slug { get; set; }
    /// <summary>Opcional: si no viene, va al final.</summary>
    public int? Orden { get; set; }
    public bool Activo { get; set; } = true;
    public int? PadreId { get; set; }
    public string? Sinonimos { get; set; }
    public string? Observaciones { get; set; }
    public string? DefinicionBreve { get; set; }
    public string? DefinicionAmpliada { get; set; }
    public string? Caracteristicas { get; set; }
    public string? RelacionTerritorial { get; set; }
    public string? Contextos { get; set; }
    public string? Ejemplos { get; set; }
    public string? Fuentes { get; set; }
    public bool EsPreliminar { get; set; }
    public int? ImagenArchivoId { get; set; }
    public string? TextoAlternativoRecurso { get; set; }
}

public sealed class CambiarActivoDeCatalogoSolicitud
{
    public bool Activo { get; set; }
}

/// <summary>El orden completo del catálogo: todos los identificadores, en el orden en que deben quedar.</summary>
public sealed class OrdenarCatalogoSolicitud
{
    public List<int> Ids { get; set; } = [];
}

/// <summary>Una fila de la hoja de cálculo que el área misional importa. Las llaves son los rótulos de las columnas.</summary>
public sealed class ImportarCatalogoSolicitud
{
    public List<Dictionary<string, string?>> Filas { get; set; } = [];
    /// <summary>Falso: solo se valida y se devuelve la vista previa. Verdadero: se aplica todo o nada.</summary>
    public bool Aplicar { get; set; }
}

public sealed record FilaDeImportacionDeCatalogoDto(int Numero, string Nombre, string Accion, IReadOnlyList<string> Cambios, IReadOnlyList<string> Errores);

public sealed record ResultadoDeImportacionDeCatalogoDto(
    bool Aplicada, int Crea, int Actualiza, int SinCambios, int ConErrores, IReadOnlyList<FilaDeImportacionDeCatalogoDto> Filas);

public sealed record EntradaDeHistorialDeCatalogoDto(long Id, DateTime Fecha, string Accion, string? Autor, string Resumen);
