namespace SIMUS.Contracts;

/// <summary>
/// Una fila del historial de estados de un registro: de qué estado a cuál, cuándo, quién y
/// por qué.
/// </summary>
/// <remarks>
/// <para>
/// <b>ES LA LECTURA DE <c>dbo.RegistrosRevisionHistorial</c></b> para Noticias, Agenda y los eventos
/// de organización. La escriben <c>HistorialDeEstados</c> y <c>HistorialDeEventosDeOrganizacion</c>.
/// </para>
/// <para>
/// <b><c>Actor</c> ES UN NOMBRE, NO UN NÚMERO.</b> Para la organización, lo que decidió el Programa se
/// firma «Equipo del Programa»: el nombre de la persona funcionaria no se expone fuera de la consola.
/// </para>
/// </remarks>
public sealed record EntradaDeHistorialDeEstadosDto(
    string Id,
    string Accion,
    string AccionEtiqueta,
    string? EstadoAnterior,
    string EstadoNuevo,
    string? Motivo,
    string? Actor,
    DateTime Fecha);
