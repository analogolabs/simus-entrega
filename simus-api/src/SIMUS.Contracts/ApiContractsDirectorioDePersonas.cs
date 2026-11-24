namespace SIMUS.Contracts;

/// <summary>Un valor de la taxonomía de perfiles, con su correspondencia con Soy Cultura.</summary>
/// <remarks><paramref name="Activo"/> falso: el valor ya no se ofrece, pero los perfiles que lo tienen siguen mostrándolo.</remarks>
/// <remarks><paramref name="Padre"/>: solo roles; el código de su categoría. Nulo: es una categoría (decisión 135).</remarks>
public sealed record ValorDeTaxonomiaDto(string Codigo, string Nombre, string? GrupoSoyCultura, string? Fuente, bool Activo = true, string? Padre = null);

/// <summary>
/// Una categoría de roles con sus subcategorías (lectura jerárquica, decisión 135). Una categoría sin subcategorías se elige
/// a sí misma; con ellas, se eligen las subcategorías.
/// </summary>
public sealed record CategoriaDeRolesDto(
    string Codigo, string Nombre, string? GrupoSoyCultura, string? Fuente, bool Activo,
    IReadOnlyList<ValorDeTaxonomiaDto> Subcategorias);

public sealed record TaxonomiaDePerfilesDto(
    IReadOnlyList<ValorDeTaxonomiaDto> Roles,
    IReadOnlyList<ValorDeTaxonomiaDto> Servicios,
    IReadOnlyList<ValorDeTaxonomiaDto> Instrumentos,
    int MaximoDeRoles, int MaximoDeServicios, int MaximoDeInstrumentos, int MaximoDeTerritorios)
{
    /// <summary>Los mismos roles en árbol: categorías con sus subcategorías, en el orden del Catálogo.</summary>
    public IReadOnlyList<CategoriaDeRolesDto> RolesPorCategoria { get; init; } = [];
}

/// <summary>
/// Una persona en el directorio. Solo lo que el perfil público ya muestra: NUNCA correo, documento, teléfono, nombre
/// civil ni rol dentro de una organización.
/// </summary>
public sealed record PersonaDelDirectorioDto(
    Guid Clave,
    string NombreVisible,
    string? FotoUrl,
    string? BiografiaCorta,
    string? Municipio,
    string? Departamento,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Servicios,
    IReadOnlyList<string> Instrumentos,
    IReadOnlyList<string> Practicas,
    IReadOnlyList<string> Territorios,
    bool Completo);

/// <summary>Una opción de filtro del directorio con cuántas personas la tienen en la consulta actual.</summary>
public sealed record FacetaDelDirectorioDto(string Valor, string Nombre, int Total);

/// <summary>
/// Las opciones de cada filtro con su conteo. El conteo de una dimensión ignora su propia selección (así se ve cuánto
/// sumaría marcar otra opción) pero respeta el texto, el territorio y las demás dimensiones: nunca se ofrece una opción
/// que devolvería cero.
/// </summary>
public sealed record FacetasDelDirectorioDto(
    IReadOnlyList<FacetaDelDirectorioDto> Categorias,
    IReadOnlyList<FacetaDelDirectorioDto> Roles,
    IReadOnlyList<FacetaDelDirectorioDto> Servicios,
    IReadOnlyList<FacetaDelDirectorioDto> Instrumentos,
    IReadOnlyList<FacetaDelDirectorioDto> Practicas,
    IReadOnlyList<FacetaDelDirectorioDto> Territorios,
    IReadOnlyList<FacetaDelDirectorioDto> Departamentos,
    IReadOnlyList<FacetaDelDirectorioDto> Municipios);

/// <summary>
/// Una página del directorio de agentes y actores de la música. Solo personas con perfil público consentido:
/// nunca correo, documento, teléfono, nombre civil ni el municipio de residencia (que es privado).
/// </summary>
public sealed record PaginaDelDirectorioDePersonasDto(
    IReadOnlyList<PersonaDelDirectorioDto> Items,
    int Total,
    int TotalPublicadas,
    int Pagina,
    int PorPagina,
    int TotalPaginas,
    FacetasDelDirectorioDto Facetas);

public sealed record PersonaSimilarDto(PersonaDelDirectorioDto Persona, IReadOnlyList<string> Coincidencias);

/// <summary>Cómo se clasifica la persona y qué personas se le parecen, con el criterio dicho en palabras.</summary>
public sealed record PerfilesSimilaresDto(
    PersonaDelDirectorioDto Persona,
    string Criterio,
    IReadOnlyList<PersonaSimilarDto> Similares);

public sealed record MiClasificacionDto(
    bool Existe,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Servicios,
    IReadOnlyList<string> Instrumentos,
    IReadOnlyList<string> CodigosDeDepartamento,
    bool Pendiente);

public sealed class ClasificacionSolicitud
{
    public List<string>? Roles { get; set; }
    public List<string>? Servicios { get; set; }
    public List<string>? Instrumentos { get; set; }
    /// <summary>Códigos DANE de los departamentos donde actúa.</summary>
    public List<string>? CodigosDeDepartamento { get; set; }
}
