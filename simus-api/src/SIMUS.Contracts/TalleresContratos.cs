namespace SIMUS.Contracts;

/// <summary>Un valor de un vocabulario del taller (servicio o familia de instrumentos).</summary>
/// <param name="Id">Identificador del catálogo.</param>
/// <param name="Nombre">Lo que lee la persona.</param>
/// <param name="Slug">Clave estable, sin tildes.</param>
/// <param name="PadreId">La familia de primer nivel, cuando es un subnivel (cordófonos frotados y pulsados).</param>
/// <param name="EstadoAprobacion">«propuesto» hasta que el Plan Nacional de Música lo apruebe, o «aprobado».</param>
public sealed record OpcionDeTallerDto(int Id, string Nombre, string Slug, int? PadreId, string EstadoAprobacion);

/// <summary>Los vocabularios que necesita el formulario de un taller.</summary>
public sealed record CatalogosDeTallerDto(
    IReadOnlyList<OpcionDeTallerDto> Servicios,
    IReadOnlyList<OpcionDeTallerDto> Familias,
    IReadOnlyList<CatalogoDeMercadoDto> PracticasMusicales
);

/// <summary>
/// Un taller de lutería tal como lo ven quienes lo gestionan: su responsable, su estado y lo que
/// dijo el Programa. Nunca sale por una ruta pública.
/// </summary>
public sealed record TallerDto(
    int Id,
    string Nombre,
    string? Descripcion,
    string Modalidad,
    bool RecibeAprendices,
    string? SaberesYTecnicas,
    string? CorreoTaller,
    string? TelefonoTaller,
    string? SitioWebTaller,
    string? InstagramTaller,
    string? FacebookTaller,
    string? OtroEnlaceTaller,
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
    IReadOnlyList<OpcionDeTallerDto> Servicios,
    IReadOnlyList<OpcionDeTallerDto> Familias,
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
/// Lo que el portal enseña de un taller publicado: la lista expresa de campos permitidos.
/// </summary>
/// <remarks>
/// <b>NO LLEVA EL NOMBRE DE UNA PERSONA.</b> Un lutier independiente publica su taller, no su
/// identidad: el contacto es el que escribió para el taller. Si el responsable es una organización,
/// se enseña su nombre y, solo si tiene ficha pública, el enlace a ella.
/// </remarks>
public sealed record TallerPublicoDto(
    int Id,
    string Nombre,
    string? Descripcion,
    string Modalidad,
    bool RecibeAprendices,
    string? SaberesYTecnicas,
    string? CorreoTaller,
    string? TelefonoTaller,
    string? SitioWebTaller,
    string? InstagramTaller,
    string? FacebookTaller,
    string? OtroEnlaceTaller,
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
    IReadOnlyList<OpcionDeTallerDto> Servicios,
    IReadOnlyList<OpcionDeTallerDto> Familias,
    IReadOnlyList<CatalogoDeMercadoDto> PracticasMusicales,
    string? FotoUrl = null,
    string? FotoAlt = null,
    SedeDto? Sede = null,
    // UN PROCESO HISTÓRICO SIN ORGANIZACIÓN se dice como tal y se ofrece reclamarlo (decisión 131).
    bool EsRegistroHistorico = false
);

/// <summary>Lo que la organización, la persona o la consola mandan para crear o guardar un taller.</summary>
public sealed class TallerUpsertRequest
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }

    /// <summary>fijo, itinerante o colectivo.</summary>
    public string Modalidad { get; set; } = "fijo";
    public bool RecibeAprendices { get; set; }

    /// <summary>Texto libre: no hay una fuente oficial de saberes y técnicas.</summary>
    public string? SaberesYTecnicas { get; set; }
    public string? CorreoTaller { get; set; }
    public string? TelefonoTaller { get; set; }
    public string? SitioWebTaller { get; set; }
    public string? InstagramTaller { get; set; }
    public string? FacebookTaller { get; set; }
    public string? OtroEnlaceTaller { get; set; }
    public string NivelCobertura { get; set; } = string.Empty;
    public string? CodigoDepartamento { get; set; }
    public string? CodigoMunicipio { get; set; }

    /// <summary>Sede principal del proceso (DIVIPOLA), aparte de la cobertura. Si no llega y la cobertura es municipal, sale del territorio.</summary>
    public string? SedeCodigoDepartamento { get; set; }
    public string? SedeCodigoMunicipio { get; set; }

    public string? LugarEspecifico { get; set; }

    /// <summary>La foto del taller, ya subida al Banco de archivos; <c>null</c> la quita (se desvincula, no se borra).</summary>
    public int? ArchivoFotoId { get; set; }
    public List<int> ServiciosIds { get; set; } = [];
    public List<int> FamiliasIds { get; set; } = [];
    public List<int> PracticasMusicalesIds { get; set; } = [];
}

/// <summary>La decisión del Programa: «publicar», «ajustes» o «rechazar».</summary>
public sealed class DecisionSobreTaller
{
    public string Decision { get; set; } = string.Empty;
    public string? Motivo { get; set; }
}

/// <summary>El motivo con el que se retira un taller publicado.</summary>
public sealed class RetiroDeTaller
{
    public string? Motivo { get; set; }
}
