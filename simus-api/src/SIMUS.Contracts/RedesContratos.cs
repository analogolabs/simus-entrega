namespace SIMUS.Contracts;

/// <summary>Un valor de un vocabulario de la red (formaDeAcceso o formato de instrumentos).</summary>
/// <param name="Id">Identificador del catálogo.</param>
/// <param name="Nombre">Lo que lee la persona.</param>
/// <param name="Slug">Clave estable, sin tildes.</param>
/// <param name="PadreId">La formato de primer nivel, cuando es un subnivel (cordófonos frotados y pulsados).</param>
/// <param name="EstadoAprobacion">«propuesto» hasta que el Plan Nacional de Música lo apruebe, o «aprobado».</param>
public sealed record OpcionDeRedDto(int Id, string Nombre, string Slug, int? PadreId, string EstadoAprobacion);

/// <summary>Los vocabularios que necesita el formulario de una red.</summary>
public sealed record CatalogosDeRedDto(
    IReadOnlyList<OpcionDeRedDto> FormasDeAcceso,
    IReadOnlyList<OpcionDeRedDto> Formatos,
    IReadOnlyList<CatalogoDeMercadoDto> PracticasMusicales
);

/// <summary>
/// Una red o centro de documentación tal como lo ven quienes lo gestionan: su responsable, su estado y lo que
/// dijo el Programa. Nunca sale por una ruta pública.
/// </summary>
public sealed record RedDto(
    int Id,
    string Nombre,
    string? Descripcion,
    string TipoDeNodo,
    bool AccesoAbierto,
    string? AcervosYColecciones,
    string? CorreoRed,
    string? TelefonoRed,
    string? SitioWebRed,
    string? InstagramRed,
    string? FacebookRed,
    string? OtroEnlaceRed,
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
    IReadOnlyList<OpcionDeRedDto> FormasDeAcceso,
    IReadOnlyList<OpcionDeRedDto> Formatos,
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
/// Lo que el portal enseña de una red publicada: la lista expresa de campos permitidos.
/// </summary>
/// <remarks>
/// <b>NO LLEVA EL NOMBRE DE UNA PERSONA.</b> Una persona responsable publica su red, no su
/// identidad: el contacto es el que escribió para la red. Si el responsable es una organización,
/// se enseña su nombre y, solo si tiene ficha pública, el enlace a ella.
/// </remarks>
public sealed record RedPublicaDto(
    int Id,
    string Nombre,
    string? Descripcion,
    string TipoDeNodo,
    bool AccesoAbierto,
    string? AcervosYColecciones,
    string? CorreoRed,
    string? TelefonoRed,
    string? SitioWebRed,
    string? InstagramRed,
    string? FacebookRed,
    string? OtroEnlaceRed,
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
    IReadOnlyList<OpcionDeRedDto> FormasDeAcceso,
    IReadOnlyList<OpcionDeRedDto> Formatos,
    IReadOnlyList<CatalogoDeMercadoDto> PracticasMusicales,
    string? FotoUrl = null,
    string? FotoAlt = null,
    SedeDto? Sede = null,
    // UN PROCESO HISTÓRICO SIN ORGANIZACIÓN se dice como tal y se ofrece reclamarlo (decisión 131).
    bool EsRegistroHistorico = false
);

/// <summary>Lo que la organización, la persona o la consola mandan para crear o guardar una red.</summary>
public sealed class RedUpsertRequest
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }

    /// <summary>red, centro_de_documentacion, archivo, coleccion o grupo_de_investigacion.</summary>
    public string TipoDeNodo { get; set; } = "red";
    public bool AccesoAbierto { get; set; }

    /// <summary>Texto libre: no hay una fuente oficial de acervos y técnicas.</summary>
    public string? AcervosYColecciones { get; set; }
    public string? CorreoRed { get; set; }
    public string? TelefonoRed { get; set; }
    public string? SitioWebRed { get; set; }
    public string? InstagramRed { get; set; }
    public string? FacebookRed { get; set; }
    public string? OtroEnlaceRed { get; set; }
    public string NivelCobertura { get; set; } = string.Empty;
    public string? CodigoDepartamento { get; set; }
    public string? CodigoMunicipio { get; set; }

    /// <summary>Sede principal del proceso (DIVIPOLA), aparte de la cobertura. Si no llega y la cobertura es municipal, sale del territorio.</summary>
    public string? SedeCodigoDepartamento { get; set; }
    public string? SedeCodigoMunicipio { get; set; }

    public string? LugarEspecifico { get; set; }

    /// <summary>La foto, ya subida al Banco de archivos; <c>null</c> la quita (se desvincula, no se borra).</summary>
    public int? ArchivoFotoId { get; set; }
    public List<int> FormasDeAccesoIds { get; set; } = [];
    public List<int> FormatosIds { get; set; } = [];
    public List<int> PracticasMusicalesIds { get; set; } = [];
}

/// <summary>La decisión del Programa: «publicar», «ajustes» o «rechazar».</summary>
public sealed class DecisionSobreRed
{
    public string Decision { get; set; } = string.Empty;
    public string? Motivo { get; set; }
}

/// <summary>El motivo con el que se retira una red publicada.</summary>
public sealed class RetiroDeRed
{
    public string? Motivo { get; set; }
}
