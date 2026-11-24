namespace SIMUS.Contracts;

/// <summary>
/// Un campo que cambió en un registro (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md): qué valía, qué vale, de qué clase de dato es.
/// </summary>
/// <param name="CampoId">Identificador estable del campo.</param>
/// <param name="Campo">El rótulo que se lee en pantalla.</param>
/// <param name="Clase">
/// publico, organizacion, contacto, identificacion o sensible. La organización solo recibe «publico»
/// y «organizacion».
/// </param>
/// <param name="ValorAnterior">El valor antes del cambio; <c>null</c> si estaba vacío.</param>
/// <param name="ValorNuevo">El valor después; <c>null</c> si quedó vacío.</param>
/// <param name="NombreAnterior">
/// Si el valor es un código de catálogo, el nombre que tenía ese día. La pantalla lee el nombre; el
/// código es interno.
/// </param>
/// <param name="NombreNuevo">Lo mismo para el valor nuevo.</param>
public sealed record CambioDeCampoDto(
    string CampoId,
    string Campo,
    string Clase,
    string? ValorAnterior,
    string? ValorNuevo,
    string? NombreAnterior = null,
    string? NombreNuevo = null);

/// <summary>
/// Una línea de la línea de tiempo de un registro: un guardado que cambió campos, o una transición de
/// estado.
/// </summary>
/// <param name="Tipo"><c>cambios</c> o <c>estado</c>.</param>
/// <param name="Titulo">Lo que pasó, en palabras («Cambió 3 campos», «Publicó»).</param>
/// <param name="Origen">directo, propuesta, importacion, fusion, sistema o migracion; vacío en un estado.</param>
/// <param name="Cambios">Los campos de un guardado; vacío en un estado.</param>
public sealed record EntradaDeLaLineaDeTiempoDto(
    string Tipo,
    DateTime Fecha,
    string Titulo,
    string? Actor,
    string? ActorRol,
    string? Origen,
    string? Motivo,
    string? EstadoAnterior,
    string? EstadoNuevo,
    IReadOnlyList<CambioDeCampoDto> Cambios);

/// <summary>La línea de tiempo de un registro: estados y cambios de datos, lo más reciente primero.</summary>
/// <param name="InicioDelRegistro">
/// El día desde el que existe el registro de cambios campo por campo (<c>aaaa-mm-dd</c>). Lo anterior
/// no se reconstruye: lo dice la pantalla.
/// </param>
/// <param name="CamposOcultos">
/// Cuántas filas de datos personales no se entregan porque la cuenta no tiene el módulo de Auditoría.
/// </param>
public sealed record LineaDeTiempoDelRegistroDto(
    string ModuloId,
    string RegistroId,
    string InicioDelRegistro,
    int CamposOcultos,
    IReadOnlyList<EntradaDeLaLineaDeTiempoDto> Entradas);
