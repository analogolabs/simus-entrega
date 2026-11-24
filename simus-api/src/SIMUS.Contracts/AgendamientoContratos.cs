namespace SIMUS.Contracts;

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Herramientas · agenda de citas de una edición de Mercado (docs/referencia/26-agenda-de-citas-y-mercados.md).
//
// Los instantes viajan en UTC y la web los pinta en hora de Bogotá. Las franjas se generan con una
// fecha y dos horas LOCALES de Bogotá (Colombia no tiene horario de verano: UTC−5 todo el año).
// ───────────────────────────────────────────────────────────────────────────────────────────────

/// <summary>Una edición de Mercado de la organización, con el estado de su agenda si la tiene.</summary>
public sealed record EdicionConAgendaDto(
    int EdicionId,
    int MercadoId,
    string MercadoNombre,
    int Anio,
    string? EdicionNombre,
    string EstadoEdicion,
    DateOnly? FechaInicio,
    DateOnly? FechaFin,
    int? AgendaId,
    string? AgendaEstado,
    IReadOnlyList<AgendaDeEdicionDto>? Agendas = null);

/// <summary>Una de las agendas de una edición (puede haber varias).</summary>
public sealed record AgendaDeEdicionDto(int Id, string Nombre, string Estado);

/// <summary>La configuración de la agenda. La crea o la actualiza la organización del Mercado.</summary>
public sealed record AgendaConfiguracionRequest(
    string Modo,
    int DuracionMinutos,
    int PausaMinutos,
    int TopeSolicitudesPendientes,
    int VencimientoSolicitudHoras,
    int? CupoArtistas,
    DateTime? AperturaInscripcionUtc,
    DateTime? CierreInscripcionUtc,
    string? AprobacionDeArtistas = null,
    string? Nombre = null,
    /// <summary>Citas vivas que puede tener quien rota; <c>null</c> es sin límite.</summary>
    int? CitasMaximasPorVisitante = null,
    string? Subtitulo = null);

/// <summary>La agenda con sus cifras (las que ve la organización y las que resume la consola).</summary>
public sealed record AgendaDto(
    int Id,
    int EdicionMercadoId,
    int MercadoId,
    string MercadoNombre,
    int Anio,
    string? EdicionNombre,
    DateOnly? FechaInicio,
    DateOnly? FechaFin,
    string Estado,
    string Modo,
    int DuracionMinutos,
    int PausaMinutos,
    int TopeSolicitudesPendientes,
    int VencimientoSolicitudHoras,
    int? CupoArtistas,
    DateTime? AperturaInscripcionUtc,
    DateTime? CierreInscripcionUtc,
    int Franjas,
    int ArtistasAprobados,
    int ArtistasEnEspera,
    int Compradores,
    int CitasSolicitadas,
    int CitasConfirmadas,
    string AprobacionDeArtistas = "automatica",
    int ArtistasPendientes = 0,
    string Nombre = "Agenda de citas",
    int? CitasMaximasPorVisitante = null,
    string Subtitulo = "");

public sealed record FranjaDto(int Id, DateTime InicioUtc, DateTime FinUtc);

/// <summary>Genera franjas de un día: <c>fecha</c> «aaaa-mm-dd» y <c>desde</c>/<c>hasta</c> «hh:mm», en hora de Bogotá.</summary>
public sealed record GenerarFranjasRequest(string Fecha, string Desde, string Hasta);

/// <summary><c>accion</c>: <c>abrir</c> · <c>iniciar</c> · <c>cerrar</c>.</summary>
public sealed record CambiarEstadoDeAgendaRequest(string Accion);

/// <summary>
/// Quien participa. El contacto y el correo de invitación solo salen para la organización del Mercado y,
/// en el contacto, para la otra parte de una cita CONFIRMADA.
/// </summary>
public sealed record ParticipanteDto(
    int Id,
    string Rol,
    string Nombre,
    string? Entidad,
    string? TipoDeComprador,
    string? Presentacion,
    string? Enlaces,
    string? RepresentaA,
    string? Espacio,
    string Estado,
    string? MotivoDeLaDecision,
    DateTime FechaInscripcion,
    bool TieneCuenta,
    int? PosicionEnLaLista,
    string? CorreoInvitacion,
    string? ContactoCorreo,
    string? ContactoTelefono,
    bool InvitacionPendiente = false,
    string? FotoUrl = null);

/// <summary>La foto de quien participa: el archivo que subió al Banco (o <c>null</c> para quitarla).</summary>
public sealed record MiFotoRequest(int? ArchivoId);

/// <summary>El Mercado carga a un comprador o booker invitado. Con su correo se enlaza su cuenta.</summary>
public sealed record AgregarCompradorRequest(
    string Nombre,
    string? Entidad,
    string TipoDeComprador,
    string Correo,
    string? Presentacion,
    string? Enlaces,
    string? Espacio);

public sealed record AsignarEspacioRequest(string? Espacio);

/// <summary>
/// <c>accion</c>: <c>aprobar</c> (un artista pendiente entra; el motivo es opcional), <c>rechazar</c> (un
/// artista, no entra) o <c>retirar</c> (sale de la agenda). Rechazar y retirar piden el motivo.
/// </summary>
public sealed record DecisionSobreParticipanteRequest(string Accion, string? Motivo);

/// <summary>Un artista, o su representante, se inscribe.</summary>
public sealed record InscripcionRequest(
    string? Nombre,
    string? Entidad,
    string? Presentacion,
    string? Enlaces,
    string? RepresentaA,
    string? ContactoCorreo,
    string? ContactoTelefono);

public sealed record SolicitarCitaRequest(int AnfitrionId, int FranjaId, string? Mensaje);

public sealed record MotivoRequest(string? Motivo);

/// <summary>Una cita. El contacto de la otra parte solo viene cuando la cita está confirmada.</summary>
public sealed record CitaDto(
    int Id,
    int FranjaId,
    DateTime InicioUtc,
    DateTime FinUtc,
    string Estado,
    int AnfitrionId,
    string AnfitrionNombre,
    string? AnfitrionEntidad,
    string? AnfitrionEspacio,
    int VisitanteId,
    string VisitanteNombre,
    string? VisitanteEntidad,
    string? MensajeInicial,
    string? MotivoDeLaDecision,
    DateTime? VenceUtc,
    DateTime FechaSolicitud,
    string? ContactoCorreo,
    string? ContactoTelefono,
    string? Espacio = null,
    PortafolioDto? OtraParte = null);

/// <summary>El portafolio con el que agenda una persona: su presentación y sus enlaces para ESTA agenda.</summary>
public sealed record PortafolioDto(string Nombre, string? Entidad, string? Presentacion, string? Enlaces, string? FotoUrl = null);

/// <summary>Lo que una persona ajusta de su portafolio en una agenda (no cambia su perfil público).</summary>
public sealed record MiPortafolioRequest(string? Presentacion, string? Enlaces, string? Entidad, string? RepresentaA);

/// <summary>Todo lo que la organización del Mercado necesita para llevar su agenda.</summary>
public sealed record AgendaDelOrganizadorDto(
    AgendaDto Agenda,
    IReadOnlyList<FranjaDto> Franjas,
    IReadOnlyList<ParticipanteDto> Participantes,
    IReadOnlyList<CitaDto> Citas);

/// <summary>Una agenda a la que la persona puede inscribirse o en la que participa.</summary>
public sealed record AgendaDisponibleDto(
    int AgendaId,
    int EdicionMercadoId,
    string MercadoNombre,
    int Anio,
    string? EdicionNombre,
    DateOnly? FechaInicio,
    DateOnly? FechaFin,
    string Estado,
    string Modo,
    int DuracionMinutos,
    int? CupoArtistas,
    int ArtistasAprobados,
    bool InscripcionAbierta,
    string? MiRol,
    string? MiEstado,
    string AprobacionDeArtistas = "automatica",
    string AgendaNombre = "Agenda de citas",
    int? CitasMaximasPorVisitante = null,
    string AgendaSubtitulo = "");

public sealed record AnfitrionConDisponibilidadDto(ParticipanteDto Anfitrion, IReadOnlyList<int> FranjasLibres);

/// <summary>La vista de quien participa: su situación, su agenda y a quién puede pedirle cita.</summary>
public sealed record MiAgendaDto(
    AgendaDisponibleDto Agenda,
    ParticipanteDto? MiParticipacion,
    int? PosicionEnLaLista,
    bool RotoYPidoCitas,
    bool PuedoInscribirme,
    bool PuedoPedirCitas,
    int SolicitudesPendientes,
    int TopeSolicitudesPendientes,
    int VencimientoSolicitudHoras,
    IReadOnlyList<FranjaDto> Franjas,
    IReadOnlyList<CitaDto> Citas,
    IReadOnlyList<AnfitrionConDisponibilidadDto> Anfitriones,
    /// <summary>Las citas vivas (solicitadas o confirmadas) de quien rota, para contarlas contra su cupo.</summary>
    int MisCitasVivas = 0);

/// <summary>
/// Lo único que el portal público dice de una agenda: que existe y si la inscripción está abierta. Ningún
/// dato de ninguna persona.
/// </summary>
public sealed record AgendaPublicaDto(
    int AgendaId,
    int MercadoId,
    string MercadoNombre,
    int Anio,
    string? EdicionNombre,
    DateOnly? FechaInicio,
    DateOnly? FechaFin,
    string Estado,
    bool InscripcionAbierta,
    int? CupoArtistas,
    int ArtistasAprobados,
    string AprobacionDeArtistas = "automatica",
    string AgendaNombre = "Agenda de citas",
    string AgendaSubtitulo = "");

/// <summary>El resumen de una agenda para la consola del Programa.</summary>
public sealed record AgendaParaLaConsolaDto(
    int Id,
    int MercadoId,
    string MercadoNombre,
    int Anio,
    string? EdicionNombre,
    string Estado,
    string Modo,
    int ArtistasAprobados,
    int ArtistasEnEspera,
    int Compradores,
    int CitasSolicitadas,
    int CitasConfirmadas,
    int CitasCanceladas,
    string AprobacionDeArtistas = "automatica",
    int ArtistasPendientes = 0,
    string Nombre = "Agenda de citas");

/// <summary>El enlace de una invitación a un comprador sin cuenta (lo ve quien la emite, como en las de organización).</summary>
public sealed record InvitacionDeAgendaEmitidaDto(int ParticipanteId, string Enlace, DateTime FechaExpiracion);

/// <summary>Lo que se ve al abrir el enlace, sin sesión: el correo va enmascarado.</summary>
public sealed record InvitacionDeAgendaAbiertaDto(
    string MercadoNombre, int Anio, string? EdicionNombre, string CorreoEnmascarado, string Estado, DateTime FechaExpiracion);

public sealed record InvitacionDeAgendaSolicitud(string? Testigo);
