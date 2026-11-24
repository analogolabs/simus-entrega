namespace SIMUS.Contracts;

/// <summary>
/// Un proceso del ecosistema que puede enmarcar un evento de la organización.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ UN EVENTO NECESITA UN PROCESO.</b> Lo decidió la dirección el 11 de septiembre de
/// 2026: una organización no publica eventos sueltos en la agenda del Programa. Publica eventos
/// <b>de sus procesos</b> —su festival, su mercado—, y si no tiene ninguno, no tiene qué anunciar
/// aquí. Sin esa regla, la agenda pública se convertiría en un tablón abierto.
/// </para>
/// <para>
/// <b>FESTIVALES Y MERCADOS.</b> Los dos primeros procesos con modelo en esta base.
/// </para>
/// <para>
/// <b>TALLERES, ESPACIOS Y REDES (LUT-01, decisión 104 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).</b> Los procesos de lutería, de música
/// en vivo y de redes y documentación NO tienen una agenda aparte: se anuncian como eventos de la
/// Agenda normal, y llegaron por <c>Tipo</c> sin cambiar la pantalla. Un taller, un espacio o una red
/// de una <b>persona sin organización</b> también enmarca eventos, desde «Mi espacio».
/// </para>
/// </remarks>
public sealed record ProcesoQueEnmarcaDto(
    string Id,
    /// <summary>`festival`, `mercado`, `taller`, `espacio` o `red`.</summary>
    string Tipo,
    string TipoEtiqueta,
    string Nombre,
    /// <summary>Su territorio, para distinguir dos procesos de nombre parecido.</summary>
    string? Territorio,
    /// <summary>
    /// El departamento del proceso. El formulario lo propone como territorio del evento (D3-14):
    /// el evento hereda el del proceso por omisión, y quien lo anuncia puede cambiarlo.
    /// </summary>
    string? CodigoDepartamento = null,
    /// <summary>El municipio del proceso; ver <see cref="CodigoDepartamento"/>.</summary>
    string? CodigoMunicipio = null);

/// <summary>Lo que una organización envía para anunciar —o seguir preparando— un evento de uno de sus procesos.</summary>
/// <remarks>
/// <para>
/// NO LLEVA ESTADO. Quien lo escribe no decide si se publica: dejar que el cliente enviara el estado
/// pondría la decisión institucional en manos del formulario.
/// </para>
/// <para>
/// LO QUE SÍ DECIDE ES SI LO ENVÍA YA (decisión del 5 de noviembre de 2026). Con
/// <see cref="Borrador"/> el evento se guarda como borrador, que solo ve su organización, y se envía
/// a revisión después. Sin él, nace en revisión como hasta ahora.
/// </para>
/// </remarks>
public sealed class CrearEventoDeOrganizacionSolicitud
{
    public string Titulo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string? DescripcionLarga { get; set; }
    public DateOnly FechaInicio { get; set; }
    public DateOnly? FechaFin { get; set; }
    public TimeOnly? HoraInicio { get; set; }
    public TimeOnly? HoraFin { get; set; }
    public string Modalidad { get; set; } = "presencial";
    public string? Lugar { get; set; }
    public string? CodigoDepartamento { get; set; }
    public string? CodigoMunicipio { get; set; }
    public string? Url { get; set; }

    /// <summary>
    /// El Festival de la organización en el que se enmarca el evento.
    /// </summary>
    /// <remarks>
    /// UN PROCESO ES OBLIGATORIO Y ES LA REGLA ENTERA: exactamente uno de los cinco —Festival,
    /// Mercado, Taller, Espacio o Red—, publicado y de quien escribe (de la organización, o de la
    /// persona si no hay organización).
    /// </remarks>
    public int? FestivalId { get; set; }

    /// <summary>El Mercado de la organización en el que se enmarca el evento.</summary>
    public int? MercadoId { get; set; }

    /// <summary>El Taller de lutería en el que se enmarca el evento (LUT-01).</summary>
    public int? TallerId { get; set; }

    /// <summary>El Espacio para música en vivo en el que se enmarca el evento (LUT-01).</summary>
    public int? EspacioId { get; set; }

    /// <summary>La Red o centro de documentación en el que se enmarca el evento (LUT-01).</summary>
    public int? RedId { get; set; }

    /// <summary>
    /// Guardar como borrador en vez de enviarlo a revisión.
    /// </summary>
    /// <remarks>
    /// Al editar, solo se respeta si el evento sigue en borrador: un evento enviado o publicado no
    /// vuelve a borrador por editarlo, vuelve a revisión.
    /// </remarks>
    public bool Borrador { get; set; }
}

/// <summary>Un evento de la organización completo, para volver a abrirlo y editarlo.</summary>
public sealed record EventoDeOrganizacionDetalleDto(
    string Id,
    string Titulo,
    string Descripcion,
    string? DescripcionLarga,
    DateOnly FechaInicio,
    DateOnly? FechaFin,
    TimeOnly? HoraInicio,
    TimeOnly? HoraFin,
    string Modalidad,
    string? Lugar,
    string? CodigoDepartamento,
    string? CodigoMunicipio,
    string? Url,
    int? FestivalId,
    int? MercadoId,
    string Estado,
    string EstadoEtiqueta,
    /// <summary>El motivo de la última devolución del Programa, si la hubo.</summary>
    string? UltimoMotivo,
    /// <summary>El evento publicado ya no se realiza (D3-13). Sigue en la agenda, con su aviso.</summary>
    bool Cancelado = false,
    /// <summary>Por qué se canceló, si se canceló.</summary>
    string? MotivoCancelacion = null,
    int? TallerId = null,
    int? EspacioId = null,
    int? RedId = null);

/// <summary>Un evento de la organización, con el proceso que lo enmarca y en qué estado va.</summary>
public sealed record EventoDeOrganizacionDto(
    string Id,
    string Titulo,
    DateOnly FechaInicio,
    DateOnly? FechaFin,
    string Modalidad,
    string? Lugar,
    string Estado,
    string EstadoEtiqueta,
    string? ProcesoNombre,
    DateTime FechaActualizacion,
    /// <summary>`festival`, `mercado`, `taller`, `espacio` o `red`.</summary>
    string? ProcesoTipo = null,
    /// <summary>El motivo de la última devolución del Programa, si la hubo.</summary>
    string? UltimoMotivo = null,
    /// <summary>El evento publicado ya no se realiza (D3-13). Sigue en la agenda, con su aviso.</summary>
    bool Cancelado = false,
    /// <summary>Por qué se canceló, si se canceló.</summary>
    string? MotivoCancelacion = null);

/// <summary>
/// El motivo con el que una organización retira o cancela un evento ya publicado (D3-13).
/// </summary>
/// <remarks>
/// <b>OBLIGATORIO.</b> Lo que se retira o se cancela ya lo vio el público: quien lo lee necesita
/// saber qué pasó, y el historial necesita decir por qué. Tope de 500 caracteres: es lo que cabe
/// en el aviso de la agenda pública y en la columna que lo guarda.
/// </remarks>
public sealed class MotivoSobreEventoSolicitud
{
    public string Motivo { get; set; } = string.Empty;
}
