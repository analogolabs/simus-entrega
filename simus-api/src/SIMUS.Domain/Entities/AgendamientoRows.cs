namespace SIMUS.Domain.Entities;

/// <summary>
/// La agenda de citas de una edición de Mercado: la primera herramienta del apartado «Herramientas»
/// (docs/referencia/26-agenda-de-citas-y-mercados.md). Cuelga de la EDICION, no del Mercado.
/// </summary>
/// <remarks>
/// <para>
/// <b>DOS MODOS.</b> <c>compradores_rotan</c>: los artistas son fijos y los compradores los visitan;
/// <c>compradores_fijos</c>: los compradores están en una mesa y los artistas rotan. En los dos la pareja
/// es ANFITRION (el fijo, quien confirma) y VISITANTE (quien rota, quien pide). El modo solo decide quién
/// ocupa cada lugar.
/// </para>
/// <para>
/// <b>LA DOBLE RESERVA LA IMPIDE LA BASE</b>, con índices únicos filtrados sobre las citas vivas
/// (<c>solicitada</c> o <c>confirmada</c>). Una solicitud pendiente reserva la franja y vence.
/// </para>
/// </remarks>
public sealed class AgendaDeCitasRow
{
    public int Id { get; set; }
    public int EdicionMercadoId { get; set; }

    /// <summary>Cómo se distingue la agenda dentro de su edición (única por edición).</summary>
    public string Nombre { get; set; } = "Agenda de citas";

    /// <summary>borrador · abierta · en_curso · cerrada, atado por CHECK.</summary>
    public string Estado { get; set; } = "borrador";

    /// <summary>compradores_rotan · compradores_fijos, atado por CHECK.</summary>
    public string Modo { get; set; } = "compradores_rotan";

    /// <summary>
    /// Cómo entran los artistas, según la metodología del Mercado: <c>automatica</c> (por orden de ingreso
    /// hasta el cupo, y lista de espera después) o <c>aceptacion</c> (la organización aprueba o rechaza a
    /// cada uno). Atado por CHECK.
    /// </summary>
    public string AprobacionDeArtistas { get; set; } = "automatica";

    public int DuracionMinutos { get; set; } = 20;
    public int PausaMinutos { get; set; } = 5;
    public int TopeSolicitudesPendientes { get; set; } = 5;
    public int VencimientoSolicitudHoras { get; set; } = 72;

    /// <summary>Cupo de artistas; <c>null</c> es sin cupo.</summary>
    public int? CupoArtistas { get; set; }

    /// <summary>
    /// Cuántas citas vivas (solicitadas o confirmadas) puede tener quien ROTA: cuántos artistas visita cada
    /// comprador (compradores_rotan) o a cuántos compradores o bookers visita cada artista (compradores_fijos).
    /// <c>null</c> es sin límite.
    /// </summary>
    public int? CitasMaximasPorVisitante { get; set; }

    /// <summary>Complemento del nombre del Mercado: la edición o el nombre específico. Vacío si no lo hay.</summary>
    public string Subtitulo { get; set; } = string.Empty;

    public DateTime? AperturaInscripcionUtc { get; set; }
    public DateTime? CierreInscripcionUtc { get; set; }
    public int? IdUsuarioCreador { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaActualizacion { get; set; }
    public DateTime? FechaCierre { get; set; }
}

/// <summary>Una franja de la rejilla de horarios de la edición (UTC).</summary>
public sealed class FranjaDeCitasRow
{
    public int Id { get; set; }
    public int AgendaId { get; set; }
    public DateTime InicioUtc { get; set; }
    public DateTime FinUtc { get; set; }
}

/// <summary>
/// Quien participa en la agenda: un artista (o su representante) que se inscribe, o un comprador o
/// booker que el Mercado carga.
/// </summary>
public sealed class ParticipanteDeCitasRow
{
    /// <summary>La foto de quien participa (Banco de archivos), si la subió. Nula = se pintan sus iniciales.</summary>
    public int? FotoArchivoId { get; set; }

    public int Id { get; set; }
    public int AgendaId { get; set; }

    /// <summary>artista · comprador, atado por CHECK.</summary>
    public string Rol { get; set; } = "artista";

    public int? UsuarioId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Entidad { get; set; }
    public string? TipoDeComprador { get; set; }
    public string? CorreoInvitacion { get; set; }
    public string? Presentacion { get; set; }
    public string? Enlaces { get; set; }
    public string? RepresentaA { get; set; }

    /// <summary>Contacto: lo ve la otra parte solo con la cita confirmada.</summary>
    public string? ContactoCorreo { get; set; }
    public string? ContactoTelefono { get; set; }

    /// <summary>La mesa, el stand o el espacio donde recibe.</summary>
    public string? Espacio { get; set; }

    /// <summary>pendiente (solo artistas, esperan la aprobación) · aprobado · lista_de_espera · rechazado · retirado, atado por CHECK.</summary>
    public string Estado { get; set; } = "aprobado";

    public string? MotivoDeLaDecision { get; set; }

    /// <summary>El orden de ingreso: decide quién entra primero y quién sale primero de la lista de espera.</summary>
    public DateTime FechaInscripcion { get; set; }

    public int? IdUsuarioCreador { get; set; }
    public DateTime? FechaActualizacion { get; set; }
}

/// <summary>Una cita entre un anfitrión (el fijo) y un visitante (el que rota) en una franja.</summary>
public sealed class CitaDeAgendaRow
{
    public int Id { get; set; }
    public int AgendaId { get; set; }
    public int FranjaId { get; set; }
    public int AnfitrionId { get; set; }
    public int VisitanteId { get; set; }

    /// <summary>solicitada · confirmada · rechazada · cancelada · vencida, atado por CHECK.</summary>
    public string Estado { get; set; } = "solicitada";

    public string? MensajeInicial { get; set; }
    public string? MotivoDeLaDecision { get; set; }
    public int? CanceladaPorId { get; set; }

    /// <summary>Cuándo se libera la franja si el anfitrión no responde.</summary>
    public DateTime? VenceUtc { get; set; }

    public DateTime FechaSolicitud { get; set; }
    public DateTime? FechaDecision { get; set; }
    public DateTime? FechaActualizacion { get; set; }
}

/// <summary>
/// Invitación a un comprador de la agenda que todavía no tiene cuenta: enlace de un solo uso, como las
/// invitaciones de organización. Solo guarda el resumen SHA-256 del testigo.
/// </summary>
public sealed class InvitacionDeAgendaRow
{
    public int Id { get; set; }
    public int ParticipanteId { get; set; }
    public string CorreoInvitado { get; set; } = string.Empty;
    public string HashTestigo { get; set; } = string.Empty;

    /// <summary>pendiente · aceptada · revocada · vencida, atado por CHECK.</summary>
    public string Estado { get; set; } = "pendiente";

    public int IdUsuarioInvita { get; set; }
    public DateTime FechaEmision { get; set; }
    public DateTime FechaExpiracion { get; set; }
    public int? IdUsuarioAcepta { get; set; }
    public DateTime? FechaCierre { get; set; }
}
