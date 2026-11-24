namespace SIMUS.Domain.Entities;

/// <summary>
/// Un espacio para música en vivo: el lugar —bar, sala, teatro, casa de cultura, escenario al aire
/// libre— donde se presenta música en directo (docs/referencia/25-modulos-restantes.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL RESPONSABLE ES UNA ORGANIZACION O UNA PERSONA, NUNCA LAS DOS NI NINGUNA.</b> Un responsable
/// independiente registra su espacio con su cuenta individual. Por eso
/// <see cref="OrganizacionPrincipalId"/> es anulable y existe <see cref="UsuarioResponsableId"/>; el
/// CHECK <c>CK_Espacios_UnSoloResponsable</c> las ata, y la guarda de acceso del servidor comprueba
/// que quien escribe administra esa organización o es esa persona.
/// </para>
/// <para>
/// <b>NO TIENE EDICIONES NI SUBREGISTROS.</b> Lo que ocurre dentro del espacio —un concierto, un
/// ciclo, una jam— se anuncia como un evento de la Agenda.
/// </para>
/// </remarks>
public sealed class EspacioRow : ISedeDeProceso
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }

    /// <summary>cerrado · abierto · mixto, atado por CHECK.</summary>
    public string Ambiente { get; set; } = "cerrado";

    /// <summary>Cuántas personas caben; opcional.</summary>
    public int? AforoMaximo { get; set; }

    /// <summary>Accesible para personas con movilidad reducida: sí, no o <c>null</c> cuando no consta.</summary>
    public bool? EsAccesible { get; set; }

    /// <summary>Horarios, días de programación y condiciones de acceso, en texto libre.</summary>
    public string? HorarioYProgramacion { get; set; }

    public string? CorreoEspacio { get; set; }
    public string? TelefonoEspacio { get; set; }
    public string? SitioWebEspacio { get; set; }
    public string? InstagramEspacio { get; set; }
    public string? FacebookEspacio { get; set; }
    public string? OtroEnlaceEspacio { get; set; }

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

    /// <summary>La persona responsable (responsable independiente); <c>null</c> cuando lo es una organización.</summary>
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

/// <summary>Un tipo de espacio (bar, sala, teatro…). Vocabulario controlado.</summary>
public sealed class TipoDeEspacioRow
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    /// <summary>propuesto · aprobado. La aprobación es del Plan Nacional de Música para la Convivencia.</summary>
    public string EstadoAprobacion { get; set; } = "propuesto";
    public string? Fuente { get; set; }
    public bool Activo { get; set; } = true;
    public int OrdenVisualizacion { get; set; }
}

/// <summary>Un elemento de equipamiento del espacio (sonido, iluminación, tarima…). Vocabulario controlado.</summary>
public sealed class EquipamientoDeEspacioRow
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string EstadoAprobacion { get; set; } = "propuesto";
    public string? Fuente { get; set; }
    public bool Activo { get; set; } = true;
    public int OrdenVisualizacion { get; set; }
}

/// <summary>Un equipamiento con el que cuenta un espacio.</summary>
public sealed class EspacioEquipamientoRow
{
    public int Id { get; set; }
    public int EspacioId { get; set; }
    public int EquipamientoEspacioId { get; set; }
    public DateTime FechaCreacion { get; set; }
}

/// <summary>Un tipo con el que se clasifica un espacio.</summary>
public sealed class EspacioTipoRow
{
    public int Id { get; set; }
    public int EspacioId { get; set; }
    public int TipoEspacioId { get; set; }
    public DateTime FechaCreacion { get; set; }
}

/// <summary>Una práctica musical que se programa en un espacio.</summary>
public sealed class EspacioPracticaMusicalRow
{
    public int Id { get; set; }
    public int EspacioId { get; set; }
    public int PracticaMusicalId { get; set; }
    public DateTime FechaCreacion { get; set; }
}
