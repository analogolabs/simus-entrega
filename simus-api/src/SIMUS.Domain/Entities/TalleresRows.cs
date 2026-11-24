namespace SIMUS.Domain.Entities;

/// <summary>
/// Un taller de lutería: el lugar donde se construyen, reparan, restauran o enseñan a hacer
/// instrumentos musicales (docs/referencia/25-modulos-restantes.md, docs/referencia/27-fuentes-de-luteria.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>EL RESPONSABLE ES UNA ORGANIZACION O UNA PERSONA, NUNCA LAS DOS NI NINGUNA.</b> Un lutier
/// independiente registra su taller con su cuenta individual. Por eso
/// <see cref="OrganizacionPrincipalId"/> es anulable y existe <see cref="UsuarioResponsableId"/>; el
/// CHECK <c>CK_Talleres_UnSoloResponsable</c> las ata, y la guarda de acceso del servidor comprueba
/// que quien escribe administra esa organización o es esa persona.
/// </para>
/// <para>
/// <b>NO TIENE EDICIONES NI SUBREGISTROS.</b> Lo que ocurre dentro del taller —una jornada de
/// construcción, una clase, una venta— se anuncia como un evento de la Agenda.
/// </para>
/// <para>
/// <b>NO GUARDA EL ORIGEN DE LA MADERA NI UNA VALIDACION DE SABERES</b>, por decisión de la dirección:
/// no es un requisito, y los saberes son texto libre (<see cref="SaberesYTecnicas"/>).
/// </para>
/// </remarks>
public sealed class TallerRow : ISedeDeProceso
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }

    /// <summary>fijo · itinerante · colectivo, atado por CHECK.</summary>
    public string Modalidad { get; set; } = "fijo";
    public bool RecibeAprendices { get; set; }
    public string? SaberesYTecnicas { get; set; }

    public string? CorreoTaller { get; set; }
    public string? TelefonoTaller { get; set; }
    public string? SitioWebTaller { get; set; }
    public string? InstagramTaller { get; set; }
    public string? FacebookTaller { get; set; }
    public string? OtroEnlaceTaller { get; set; }

    /// <summary>
    /// La foto del taller, del Banco de archivos (LUT-02, decisión 115). Es pública solo mientras el taller está
    /// publicado; antes la ven quienes responden por él y la consola. Es una errata: no devuelve a revisión.
    /// </summary>
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

    /// <summary>La persona responsable (lutier independiente); <c>null</c> cuando lo es una organización.</summary>
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

/// <summary>Una familia de instrumentos (Hornbostel-Sachs, con subnivel opcional). Vocabulario controlado.</summary>
public sealed class FamiliaInstrumentoRow
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int? FamiliaPadreId { get; set; }

    /// <summary>propuesto · aprobado. La aprobación es del Plan Nacional de Música para la Convivencia.</summary>
    public string EstadoAprobacion { get; set; } = "propuesto";
    public string? Fuente { get; set; }
    public bool Activo { get; set; } = true;
    public int OrdenVisualizacion { get; set; }
}

/// <summary>Un servicio que ofrece un taller (construcción, reparación…). Vocabulario controlado.</summary>
public sealed class ServicioTallerRow
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string EstadoAprobacion { get; set; } = "propuesto";
    public string? Fuente { get; set; }
    public bool Activo { get; set; } = true;
    public int OrdenVisualizacion { get; set; }
}

/// <summary>Un servicio que ofrece un taller.</summary>
public sealed class TallerServicioRow
{
    public int Id { get; set; }
    public int TallerId { get; set; }
    public int ServicioTallerId { get; set; }
    public DateTime FechaCreacion { get; set; }
}

/// <summary>Una familia de instrumentos con la que trabaja un taller.</summary>
public sealed class TallerFamiliaInstrumentoRow
{
    public int Id { get; set; }
    public int TallerId { get; set; }
    public int FamiliaInstrumentoId { get; set; }
    public DateTime FechaCreacion { get; set; }
}

/// <summary>Una práctica musical con la que se relaciona un taller.</summary>
public sealed class TallerPracticaMusicalRow
{
    public int Id { get; set; }
    public int TallerId { get; set; }
    public int PracticaMusicalId { get; set; }
    public DateTime FechaCreacion { get; set; }
}
