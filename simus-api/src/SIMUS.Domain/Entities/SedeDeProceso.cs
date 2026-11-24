namespace SIMUS.Domain.Entities;

/// <summary>
/// Lo que tienen en común los cinco procesos del ecosistema (Festival, Mercado, Taller, Espacio y
/// Red): una SEDE PRINCIPAL con departamento y municipio, para situarlos en el mapa.
/// </summary>
/// <remarks>
/// La sede es un dato APARTE de la cobertura: un proceso de cobertura nacional también tiene sede.
/// Nulos significan «pendiente de completar»: no bloquean ninguna lectura.
/// </remarks>
public interface ISedeDeProceso
{
    string? SedeCodigoDepartamento { get; set; }
    string? SedeCodigoMunicipio { get; set; }
}
