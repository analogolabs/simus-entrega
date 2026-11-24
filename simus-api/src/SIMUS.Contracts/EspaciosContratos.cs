namespace SIMUS.Contracts;

/// <summary>Un valor de un vocabulario del espacio (equipamiento o tipo de espacio).</summary>
/// <param name="Id">Identificador del catálogo.</param>
/// <param name="Nombre">Lo que lee la persona.</param>
/// <param name="Slug">Clave estable, sin tildes.</param>
/// <param name="EstadoAprobacion">«propuesto» hasta que el Plan Nacional de Música lo apruebe, o «aprobado».</param>
public sealed record OpcionDeEspacioDto(int Id, string Nombre, string Slug, string EstadoAprobacion);

/// <summary>Los vocabularios que necesita el formulario de un espacio.</summary>
public sealed record CatalogosDeEspacioDto(
    IReadOnlyList<OpcionDeEspacioDto> Equipamiento,
    IReadOnlyList<OpcionDeEspacioDto> Tipos,
    IReadOnlyList<CatalogoDeMercadoDto> PracticasMusicales
);

/// <summary>
/// Un espacio para música en vivo tal como lo ven quienes lo gestionan: su responsable, su estado y lo que
/// dijo el Programa. Nunca sale por una ruta pública.
/// </summary>
public sealed record EspacioDto(
    int Id,
    string Nombre,
    string? Descripcion,
    string Ambiente,
    int? AforoMaximo,
    bool? EsAccesible,
    string? HorarioYProgramacion,
    string? CorreoEspacio,
    string? TelefonoEspacio,
    string? SitioWebEspacio,
    string? InstagramEspacio,
    string? FacebookEspacio,
    string? OtroEnlaceEspacio,
    string NivelCobertura,
    string? CodigoDepartamento,
    string? NombreDepartamento,
    string? CodigoMunicipio,
    string? NombreMunicipio,
    string? LugarEspecifico,
    int? OrganizacionId,
    string? OrganizacionNombre,
    int? UsuarioResponsableId,
    string? ResponsableNombre,
    string EstadoRegistro,
    string? MotivoDeLaDecision,
    IReadOnlyList<OpcionDeEspacioDto> Equipamiento,
    IReadOnlyList<OpcionDeEspacioDto> Tipos,
    IReadOnlyList<CatalogoDeMercadoDto> PracticasMusicales,
    DateTime FechaCreacion,
    DateTime? FechaActualizacion,
    DateTime? FechaEnvioARevision,
    DateTime? FechaPublicacion,
    int? ArchivoFotoId = null,
    string? FotoUrl = null,
    string? FotoAlt = null,
    SedeDto? Sede = null
);

/// <summary>
/// Lo que el portal enseña de un espacio publicado: la lista expresa de campos permitidos.
/// </summary>
/// <remarks>
/// <b>NO LLEVA EL NOMBRE DE UNA PERSONA.</b> Un responsable independiente publica su espacio, no su
/// identidad: el contacto es el que escribió para el espacio. Si el responsable es una organización,
/// se enseña su nombre y, solo si tiene ficha pública, el enlace a ella.
/// </remarks>
public sealed record EspacioPublicoDto(
    int Id,
    string Nombre,
    string? Descripcion,
    string Ambiente,
    int? AforoMaximo,
    bool? EsAccesible,
    string? HorarioYProgramacion,
    string? CorreoEspacio,
    string? TelefonoEspacio,
    string? SitioWebEspacio,
    string? InstagramEspacio,
    string? FacebookEspacio,
    string? OtroEnlaceEspacio,
    string NivelCobertura,
    string? CodigoDepartamento,
    string? NombreDepartamento,
    string? CodigoMunicipio,
    string? NombreMunicipio,
    string? LugarEspecifico,
    bool EsIndependiente,
    string? OrganizacionNombre,
    int? OrganizacionPublicaId,
    DateTime? FechaPublicacion,
    IReadOnlyList<OpcionDeEspacioDto> Equipamiento,
    IReadOnlyList<OpcionDeEspacioDto> Tipos,
    IReadOnlyList<CatalogoDeMercadoDto> PracticasMusicales,
    string? FotoUrl = null,
    string? FotoAlt = null,
    SedeDto? Sede = null,
    // UN PROCESO HISTÓRICO SIN ORGANIZACIÓN se dice como tal y se ofrece reclamarlo (decisión 131).
    bool EsRegistroHistorico = false
);

/// <summary>Lo que la organización, la persona o la consola mandan para crear o guardar un espacio.</summary>
public sealed class EspacioUpsertRequest
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }

    /// <summary>cerrado, abierto o mixto.</summary>
    public string Ambiente { get; set; } = "cerrado";

    /// <summary>Cuántas personas caben; opcional.</summary>
    public int? AforoMaximo { get; set; }

    /// <summary>Accesible para personas con movilidad reducida: sí, no o <c>null</c> cuando no consta.</summary>
    public bool? EsAccesible { get; set; }

    /// <summary>Texto libre: horarios, días de programación y condiciones de acceso.</summary>
    public string? HorarioYProgramacion { get; set; }
    public string? CorreoEspacio { get; set; }
    public string? TelefonoEspacio { get; set; }
    public string? SitioWebEspacio { get; set; }
    public string? InstagramEspacio { get; set; }
    public string? FacebookEspacio { get; set; }
    public string? OtroEnlaceEspacio { get; set; }
    public string NivelCobertura { get; set; } = string.Empty;
    public string? CodigoDepartamento { get; set; }
    public string? CodigoMunicipio { get; set; }

    /// <summary>Sede principal del proceso (DIVIPOLA), aparte de la cobertura. Si no llega y la cobertura es municipal, sale del territorio.</summary>
    public string? SedeCodigoDepartamento { get; set; }
    public string? SedeCodigoMunicipio { get; set; }

    public string? LugarEspecifico { get; set; }

    /// <summary>La foto, ya subida al Banco de archivos; <c>null</c> la quita (se desvincula, no se borra).</summary>
    public int? ArchivoFotoId { get; set; }
    public List<int> EquipamientoIds { get; set; } = [];
    public List<int> TiposIds { get; set; } = [];
    public List<int> PracticasMusicalesIds { get; set; } = [];
}

/// <summary>La decisión del Programa: «publicar», «ajustes» o «rechazar».</summary>
public sealed class DecisionSobreEspacio
{
    public string Decision { get; set; } = string.Empty;
    public string? Motivo { get; set; }
}

/// <summary>El motivo con el que se retira un espacio publicado.</summary>
public sealed class RetiroDeEspacio
{
    public string? Motivo { get; set; }
}
