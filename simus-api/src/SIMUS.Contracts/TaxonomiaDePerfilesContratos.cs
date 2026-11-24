namespace SIMUS.Contracts;

/// <summary>
/// Un valor de la taxonomía de perfiles como lo ve la consola: con su código, su estado y cuántas personas lo tienen.
/// </summary>
/// <param name="Personas">Cuántos perfiles lo tienen guardado (publicados o no). Dice qué consecuencias tiene desactivarlo.</param>
public sealed record ValorDeTaxonomiaAdministradoDto(
    int Id,
    string Dimension,
    string Codigo,
    string Nombre,
    string? GrupoSoyCultura,
    string? Fuente,
    bool Activo,
    int OrdenVisualizacion,
    int Personas,
    int? IdPadre = null,
    string? CodigoDePadre = null,
    int Subcategorias = 0);

public sealed class GuardarValorDeTaxonomiaSolicitud
{
    /// <summary>Solo al crear: <c>rol</c>, <c>servicio</c> o <c>instrumento</c>. No cambia después.</summary>
    public string? Dimension { get; set; }
    public string Nombre { get; set; } = string.Empty;
    /// <summary><c>creador</c>, <c>gestor</c> u <c>otro</c>; solo para roles.</summary>
    public string? GrupoSoyCultura { get; set; }
    public string? Fuente { get; set; }
    public bool Activo { get; set; } = true;
    /// <summary>Solo al crear, y solo roles: la categoría de la que será subcategoría. Nulo: es una categoría (decisión 135). Dos niveles.</summary>
    public int? IdPadre { get; set; }
}

public sealed class CambiarDeCategoriaSolicitud
{
    /// <summary>La categoría destino; nulo lo vuelve categoría. Solo roles.</summary>
    public int? IdPadre { get; set; }
}

public sealed class MoverValorDeTaxonomiaSolicitud
{
    /// <summary>-1 lo sube un puesto; 1 lo baja.</summary>
    public int Sentido { get; set; }
}
