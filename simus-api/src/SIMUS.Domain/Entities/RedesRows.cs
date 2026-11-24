namespace SIMUS.Domain.Entities;

/// <summary>
/// Una red o un centro de documentación: un nodo de investigación, archivo y documentación musical
/// (docs/referencia/25-modulos-restantes.md §25.4).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL RESPONSABLE ES UNA ORGANIZACION O UNA PERSONA, NUNCA LAS DOS NI NINGUNA.</b> Una persona
/// que mantiene un archivo o una colección propios la registra con su cuenta individual. Por eso
/// <see cref="OrganizacionPrincipalId"/> es anulable y existe <see cref="UsuarioResponsableId"/>; el
/// CHECK <c>CK_Redes_UnSoloResponsable</c> las ata, y la guarda de acceso del servidor comprueba
/// que quien escribe administra esa organización o es esa persona.
/// </para>
/// <para>
/// <b>NO TIENE EDICIONES NI SUBREGISTROS.</b> Lo que ocurre alrededor de la red —una jornada de
/// consulta, un conversatorio, la presentación de un acervo— se anuncia como un evento de la Agenda.
/// </para>
/// <para>
/// <b>NO CATALOGA DOCUMENTOS</b>, por decisión de la dirección: una red dice qué acervos tiene
/// y cómo se consultan, y el detalle de cada pieza es del Catálogo Editorial. Los acervos son texto
/// libre (<see cref="AcervosYColecciones"/>).
/// </para>
/// </remarks>
public sealed class RedRow : ISedeDeProceso
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }

    /// <summary>red · centro_de_documentacion · archivo · coleccion · grupo_de_investigacion, atado por CHECK.</summary>
    public string TipoDeNodo { get; set; } = "red";

    /// <summary>Si cualquier persona puede consultar el acervo sin una gestión previa.</summary>
    public bool AccesoAbierto { get; set; }
    public string? AcervosYColecciones { get; set; }

    public string? CorreoRed { get; set; }
    public string? TelefonoRed { get; set; }
    public string? SitioWebRed { get; set; }
    public string? InstagramRed { get; set; }
    public string? FacebookRed { get; set; }
    public string? OtroEnlaceRed { get; set; }

    /// <summary>La foto del Banco de archivos (LUT-02, decisión 120): pública solo con el registro publicado.</summary>
    public int? ArchivoFotoId { get; set; }

    public string NivelCobertura { get; set; } = string.Empty;

    /// <summary>Código DIVIPOLA del departamento, o <c>null</c> en cobertura nacional.</summary>
    public string? CodigoDepartamento { get; set; }
    public string? CodigoMunicipio { get; set; }

    /// <summary>Departamento de la SEDE PRINCIPAL (DIVIPOLA), aparte de la cobertura. Nulo: pendiente de completar.</summary>
    public string? SedeCodigoDepartamento { get; set; }

    /// <summary>Municipio de la SEDE PRINCIPAL (DIVIPOLA). Nulo: pendiente de completar.</summary>
    public string? SedeCodigoMunicipio { get; set; }
    public string? LugarEspecifico { get; set; }

    /// <summary>La organización responsable; <c>null</c> cuando el responsable es una persona.</summary>
    public int? OrganizacionPrincipalId { get; set; }

    /// <summary>La persona responsable; <c>null</c> cuando lo es una organización.</summary>
    public int? UsuarioResponsableId { get; set; }

    public string EstadoRegistro { get; set; } = "borrador";

    /// <summary>Lo que dijo el Programa al pedir ajustes, rechazar o retirar.</summary>
    public string? MotivoDeLaDecision { get; set; }
    public bool Activo { get; set; } = true;
    public int? IdUsuarioCreador { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaActualizacion { get; set; }
    public DateTime? FechaEnvioARevision { get; set; }
    public DateTime? FechaPublicacion { get; set; }
    public DateTime? FechaArchivado { get; set; }
}

/// <summary>Un formato de documentación (sonoro, audiovisual, impreso…, con subnivel opcional). Vocabulario controlado.</summary>
public sealed class FormatoRow
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int? FormatoPadreId { get; set; }

    /// <summary>propuesto · aprobado. La aprobación es del Plan Nacional de Música para la Convivencia.</summary>
    public string EstadoAprobacion { get; set; } = "propuesto";
    public string? Fuente { get; set; }
    public bool Activo { get; set; } = true;
    public int OrdenVisualizacion { get; set; }
}

/// <summary>Una forma de acceso y consulta de una red (en sala, en línea, con cita…). Vocabulario controlado.</summary>
public sealed class FormaDeAccesoRow
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string EstadoAprobacion { get; set; } = "propuesto";
    public string? Fuente { get; set; }
    public bool Activo { get; set; } = true;
    public int OrdenVisualizacion { get; set; }
}

/// <summary>Una forma de acceso con la que se consulta una red.</summary>
public sealed class RedFormaDeAccesoRow
{
    public int Id { get; set; }
    public int RedId { get; set; }
    public int FormaDeAccesoId { get; set; }
    public DateTime FechaCreacion { get; set; }
}

/// <summary>Un formato de documentación que guarda una red.</summary>
public sealed class RedFormatoRow
{
    public int Id { get; set; }
    public int RedId { get; set; }
    public int FormatoId { get; set; }
    public DateTime FechaCreacion { get; set; }
}

/// <summary>Una práctica musical con la que se relaciona una red.</summary>
public sealed class RedPracticaMusicalRow
{
    public int Id { get; set; }
    public int RedId { get; set; }
    public int PracticaMusicalId { get; set; }
    public DateTime FechaCreacion { get; set; }
}
