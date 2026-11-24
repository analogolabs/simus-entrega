namespace SIMUS.Contracts;

/// <summary>Una edición de Celebra la música, tal como la lista el selector de ediciones.</summary>
/// <remarks>
/// La programación y las noticias de la edición no viajan aquí: son la agenda y las noticias
/// generales filtradas por <see cref="ProyectoCodigo"/>.
/// </remarks>
public sealed record CelebraEdicionResumenDto(
    int Anio,
    string Nombre,
    string? Hashtag,
    string ProyectoCodigo,
    bool Actual,
    bool Publicada,
    string ColorPrincipal,
    string ColorSecundario,
    string? ImagenPortadaUrl,
    string? Resumen);

public sealed record CelebraCategoriaDto(string Nombre, string? Descripcion, int Orden);

public sealed record CelebraRecursoDto(int Id, string Grupo, string Titulo, string? Descripcion, int? ArchivoId, string? Url, int Orden);

public sealed record CelebraPreguntaDto(string Pregunta, string Respuesta, int Orden);

public sealed record CelebraImagenDto(int ArchivoId, string Url, string TextoAlternativo, string? Credito, int Orden);

public sealed record CelebraEdicionDto(
    int Anio,
    string Nombre,
    string? Hashtag,
    string ProyectoCodigo,
    bool Actual,
    bool Publicada,
    string ColorPrincipal,
    string ColorSecundario,
    string? ImagenPortadaUrl,
    int? ImagenPortadaArchivoId,
    DateOnly? FechaInicio,
    DateOnly? FechaFin,
    string? Resumen,
    string? Presentacion,
    string? Aliados,
    int? Actividades,
    int? Municipios,
    int? Departamentos,
    int? Organizaciones,
    int? Musicos,
    string? Fuente,
    bool PendienteDeValidar,
    DateTime? FechaActualizacion,
    IReadOnlyList<CelebraCategoriaDto> Categorias,
    IReadOnlyList<CelebraRecursoDto> Recursos,
    IReadOnlyList<CelebraPreguntaDto> Preguntas,
    IReadOnlyList<CelebraImagenDto> Galeria);

/// <summary>Un cambio de una edición, tal como lo cuenta la bitácora de la consola.</summary>
public sealed record CelebraCambioDto(DateTime Fecha, string? Usuario, string Accion, string Resumen);

public sealed class GuardarCelebraEdicionSolicitud
{
    public string Nombre { get; set; } = string.Empty;
    public string? Hashtag { get; set; }
    public bool Actual { get; set; }
    public bool Publicada { get; set; }
    public string? ColorPrincipal { get; set; }
    public string? ColorSecundario { get; set; }
    public int? ImagenPortadaArchivoId { get; set; }
    public DateOnly? FechaInicio { get; set; }
    public DateOnly? FechaFin { get; set; }
    public string? Resumen { get; set; }
    public string? Presentacion { get; set; }
    public string? Aliados { get; set; }
    public int? Actividades { get; set; }
    public int? Municipios { get; set; }
    public int? Departamentos { get; set; }
    public int? Organizaciones { get; set; }
    public int? Musicos { get; set; }
    public string? Fuente { get; set; }
    public bool PendienteDeValidar { get; set; }
    public List<CelebraCategoriaDto>? Categorias { get; set; }
    public List<GuardarCelebraRecursoSolicitud>? Recursos { get; set; }
    public List<CelebraPreguntaDto>? Preguntas { get; set; }
    public List<GuardarCelebraImagenSolicitud>? Galeria { get; set; }
}

public sealed class GuardarCelebraRecursoSolicitud
{
    public string Grupo { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public int? ArchivoId { get; set; }
    public string? Url { get; set; }
}

public sealed class GuardarCelebraImagenSolicitud
{
    public int ArchivoId { get; set; }
    public string TextoAlternativo { get; set; } = string.Empty;
    public string? Credito { get; set; }
}
