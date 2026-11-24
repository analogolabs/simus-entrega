namespace SIMUS.Domain.Entities;

/// <summary>Un álbum de la Galería pública. <see cref="Tipo"/> es «fotos», «videos» o «mixto».</summary>
public sealed class GaleriaAlbumRow
{
    public int Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public string Tipo { get; set; } = "fotos";
    public string? Lugar { get; set; }
    public DateOnly? FechaReferencia { get; set; }
    public int? PortadaArchivoId { get; set; }
    public string? ListaOrigenUrl { get; set; }
    public int Orden { get; set; } = 1;
    public bool Publicado { get; set; }
    /// <summary>Marca del álbum para el carrusel «Destacados» del portal. Si ningún álbum publicado está marcado, el portal muestra los más recientes.</summary>
    public bool Destacado { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaActualizacion { get; set; }
}

/// <summary>Un ítem de un álbum: una foto (archivo del Banco) o un video (identificador de YouTube, nunca el archivo).</summary>
public sealed class GaleriaItemRow
{
    public int Id { get; set; }
    /// <summary>El álbum al que pertenece; <c>null</c> = ítem suelto («Sin álbum»), que se publica por sí mismo con <see cref="Publicado"/>.</summary>
    public int? GaleriaAlbumId { get; set; }
    public string TipoItem { get; set; } = "foto";
    public int Orden { get; set; } = 1;
    public string? Titulo { get; set; }
    public string? Descripcion { get; set; }
    public DateOnly? Fecha { get; set; }
    public string? Credito { get; set; }
    public string? TextoAlternativo { get; set; }
    public int? ArchivoId { get; set; }
    public string? VideoId { get; set; }
    public int? DuracionSegundos { get; set; }
    /// <summary>Solo de un video: la imagen propia (Banco de archivos) que se ve antes de pulsar «Reproducir»; así el navegador no pide nada a YouTube.</summary>
    public int? MiniaturaArchivoId { get; set; }
    /// <summary>El texto completo cuando <see cref="Descripcion"/> es un resumen editorial; el visor lo muestra aparte.</summary>
    public string? Detalle { get; set; }
    /// <summary>Solo cuenta en un ítem suelto: dentro de un álbum manda el <see cref="GaleriaAlbumRow.Publicado"/> del álbum.</summary>
    public bool Publicado { get; set; } = true;
}
