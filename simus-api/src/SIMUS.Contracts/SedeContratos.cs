namespace SIMUS.Contracts;

/// <summary>
/// La SEDE PRINCIPAL de un proceso (Festival, Mercado, Taller, Espacio o Red): dónde está, con sus
/// nombres oficiales (DIVIPOLA). Es aparte de la cobertura, que es dónde trabaja.
/// </summary>
/// <remarks>Un valor nulo en el DTO que la lleva significa «pendiente de completar».</remarks>
public sealed record SedeDto(
    string? CodigoDepartamento,
    string? NombreDepartamento,
    string? CodigoMunicipio,
    string? NombreMunicipio);
