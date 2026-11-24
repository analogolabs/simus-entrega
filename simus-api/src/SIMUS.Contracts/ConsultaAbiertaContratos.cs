namespace SIMUS.Contracts;

/// <summary>Un filtro de la consulta estructurada: campo, operador de la lista blanca y valor (para «in», valores separados por «|»).</summary>
public sealed class FiltroDeConsultaDto
{
    public string? Campo { get; set; }

    /// <summary>eq · neq · in · contiene · gt · gte · lt · lte.</summary>
    public string? Operador { get; set; }

    public string? Valor { get; set; }
}

public sealed class MetricaDeConsultaDto
{
    /// <summary>count · sum · avg · min · max.</summary>
    public string? Funcion { get; set; }

    public string? Campo { get; set; }
}

public sealed class OrdenDeConsultaDto
{
    /// <summary>Un campo de la entidad o «metrica» (el valor agregado).</summary>
    public string? Campo { get; set; }

    /// <summary>asc · desc.</summary>
    public string? Direccion { get; set; }
}

/// <summary>
/// La CONSULTA ESTRUCTURADA: lo único que el modelo produce. Nunca es SQL ni texto que se ejecute; el validador la contrasta con
/// el catálogo semántico y el ejecutor la lee como datos.
/// </summary>
public sealed class ConsultaEstructuradaDto
{
    public string? Entidad { get; set; }

    public List<FiltroDeConsultaDto>? Filtros { get; set; }

    public List<string>? Agrupar { get; set; }

    public MetricaDeConsultaDto? Metrica { get; set; }

    public OrdenDeConsultaDto? Orden { get; set; }

    public int? Limite { get; set; }
}

public sealed record CampoSemanticoDto(string Nombre, string Rotulo, string Tipo, bool Agrupable, bool Agregable);

public sealed record EntidadSemanticaDto(string Id, string Rotulo, string Descripcion, IReadOnlyList<CampoSemanticoDto> Campos);

public sealed record EstadoDeConsultaAbiertaDto(
    bool Disponible,
    bool ModeloDisponible,
    string Mensaje,
    int MaximoDePregunta,
    IReadOnlyList<EntidadSemanticaDto> Entidades,
    IReadOnlyList<string> Ejemplos);

/// <summary>La pregunta escrita, o la consulta ya interpretada y corregida por quien pregunta (sin pasar por el modelo).</summary>
public sealed class ConsultaAbiertaSolicitudDto
{
    public string? Pregunta { get; set; }

    public ConsultaEstructuradaDto? Consulta { get; set; }
}

/// <summary>
/// Respuesta de la consulta abierta. <c>Estado</c>: ok · sin_modelo · no_entendida · fuera_de_catalogo · ocupado.
/// <c>Via</c>: plantilla · modelo · consulta_editada.
/// </summary>
public sealed record RespuestaDeConsultaAbiertaDto(
    string Estado,
    string Mensaje,
    string? Via,
    string? Resumen,
    ConsultaEstructuradaDto? ConsultaEntendida,
    IReadOnlyList<string> ComoEntendi,
    TablaDeConsultaDto? Tabla,
    string? Grafico,
    IReadOnlyList<string> Sugerencias,
    long LatenciaMs,
    string? PreguntaId = null);
