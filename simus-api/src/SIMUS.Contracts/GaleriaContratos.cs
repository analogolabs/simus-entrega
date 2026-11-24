namespace SIMUS.Contracts;

/// <summary>Un álbum tal como lo lista la Galería pública.</summary>
public sealed record GaleriaAlbumResumenDto(
    string Slug,
    string Titulo,
    string? Descripcion,
    string Tipo,
    string? Lugar,
    DateOnly? FechaReferencia,
    string? PortadaUrl,
    int TotalFotos,
    int TotalVideos,
    string? ListaOrigenUrl,
    bool Publicado,
    bool Destacado = false,
    int Orden = 0);

/// <summary>Un ítem del álbum. Las fotos llevan <c>Url</c>; los videos, <c>VideoId</c> y la dirección de YouTube (solo para el enlace «Ver en YouTube»).</summary>
public sealed record GaleriaItemDto(
    int Id,
    string TipoItem,
    int Orden,
    string? Titulo,
    string? Descripcion,
    DateOnly? Fecha,
    string? Credito,
    string? TextoAlternativo,
    int? ArchivoId,
    string? Url,
    string? VideoId,
    string? UrlYoutube,
    int? DuracionSegundos,
    int? MiniaturaArchivoId = null,
    string? MiniaturaUrl = null,
    int? Ancho = null,
    int? Alto = null,
    bool Publicado = true,
    string? Detalle = null);

/// <summary>
/// Un ítem tal como lo pide la Galería por clase (todas las fotos, todos los videos o los sueltos): lleva su álbum (si lo tiene)
/// para rotularlo y enlazarlo. La foto trae sus medidas para armar el mosaico sin saltos.
/// </summary>
public sealed record GaleriaItemPublicoDto(
    int Id,
    string TipoItem,
    string? Titulo,
    string? Descripcion,
    DateOnly? Fecha,
    string? Credito,
    string? TextoAlternativo,
    string? Url,
    string? MiniaturaUrl,
    string? VideoId,
    string? UrlYoutube,
    int? DuracionSegundos,
    int? Ancho,
    int? Alto,
    string? AlbumSlug,
    string? AlbumTitulo,
    string? AlbumLugar,
    DateOnly? AlbumFecha,
    string? Detalle = null);

/// <summary>Una página de ítems de la Galería con el total de la clase pedida.</summary>
public sealed record GaleriaItemsPaginaDto(IReadOnlyList<GaleriaItemPublicoDto> Items, int Total);

/// <summary>Los ítems sueltos («Sin álbum») tal como los ve la consola.</summary>
public sealed record GaleriaSueltosDto(IReadOnlyList<GaleriaItemDto> Items);

public sealed class GuardarGaleriaSueltosSolicitud
{
    public List<GuardarGaleriaItemSolicitud>? Items { get; set; }
}

public sealed record GaleriaAlbumDto(
    string Slug,
    string Titulo,
    string? Descripcion,
    string Tipo,
    string? Lugar,
    DateOnly? FechaReferencia,
    string? PortadaUrl,
    int? PortadaArchivoId,
    string? ListaOrigenUrl,
    int Orden,
    bool Publicado,
    DateTime? FechaActualizacion,
    IReadOnlyList<GaleriaItemDto> Items,
    bool Destacado = false);

public sealed class GuardarGaleriaItemSolicitud
{
    public string TipoItem { get; set; } = string.Empty;
    public string? Titulo { get; set; }
    public string? Descripcion { get; set; }
    public DateOnly? Fecha { get; set; }
    public string? Credito { get; set; }
    public string? TextoAlternativo { get; set; }
    public int? ArchivoId { get; set; }
    public string? VideoId { get; set; }
    public int? DuracionSegundos { get; set; }
    /// <summary>Solo de un video: archivo del Banco con su imagen propia (nunca una dirección de YouTube).</summary>
    public int? MiniaturaArchivoId { get; set; }
    /// <summary>Texto completo; la descripción queda como resumen.</summary>
    public string? Detalle { get; set; }
    /// <summary>Solo de un ítem suelto: si se ve en el portal. Dentro de un álbum manda el álbum.</summary>
    public bool Publicado { get; set; } = true;
}

public sealed class GuardarGaleriaAlbumSolicitud
{
    public string Titulo { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string? Lugar { get; set; }
    public DateOnly? FechaReferencia { get; set; }
    public int? PortadaArchivoId { get; set; }
    public string? ListaOrigenUrl { get; set; }
    public int Orden { get; set; } = 1;
    public bool Publicado { get; set; }
    /// <summary>Si el álbum entra al carrusel «Destacados» del portal (solo se ve si está publicado).</summary>
    public bool Destacado { get; set; }
    public List<GuardarGaleriaItemSolicitud>? Items { get; set; }
}

/// <summary>Un cambio rápido del estado de un álbum desde la lista de la consola. Lo que no viene (nulo) no se toca.</summary>
public sealed class CambiarEstadoDeAlbumSolicitud
{
    public bool? Publicado { get; set; }
    public bool? Destacado { get; set; }
}

/// <summary>El nuevo orden de los álbumes: sus identificadores en el orden en que deben verse. Los que no se nombren quedan después, en su orden actual.</summary>
public sealed class OrdenarAlbumesSolicitud
{
    public List<string>? Slugs { get; set; }
}
