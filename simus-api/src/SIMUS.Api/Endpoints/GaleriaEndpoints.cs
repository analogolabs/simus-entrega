using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La Galería pública: álbumes de fotos, de videos y mixtos.
/// </summary>
/// <remarks>
/// <para>
/// <b>EL VIDEO ES UN IDENTIFICADOR, NO UN ARCHIVO NI UNA IMAGEN DE TERCEROS.</b> El álbum guarda el id de
/// YouTube (11 caracteres); la dirección «Ver en YouTube» se compone aquí y la incrustación sin cookies
/// (<c>youtube-nocookie.com</c>) la monta el portal solo cuando la persona pulsa «Reproducir». Ninguna
/// miniatura se pide a YouTube cuando la persona navega: la portada de un video es una imagen PROPIA del Banco de
/// archivos (<c>MiniaturaArchivoId</c>), descargada una sola vez al sembrar. Una petición a un tercero antes del clic entrega la dirección IP.
/// </para>
/// <para>
/// <b>SIN ÁLBUM.</b> Un ítem (foto o video) puede no pertenecer a ningún álbum: es un ítem suelto, con su propia marca
/// <c>Publicado</c>. La pestaña «Sin álbum» de la Galería los lista.
/// </para>
/// <para>
/// <b>SOLO SE VE LO PUBLICADO.</b> Un álbum en borrador responde 404 al público y sus fotos tampoco se sirven
/// (vínculo en <c>VinculosAsync</c> del Banco de archivos). La gestión guarda el álbum completo de una vez,
/// con auditoría, como la edición de «Celebra la música».
/// </para>
/// </remarks>
public static partial class GaleriaEndpoints
{
    private static readonly string[] TiposDeAlbum = ["fotos", "videos", "mixto"];
    private static readonly string[] SlugInvalido = ["El identificador del álbum usa minúsculas, números y guiones (máximo 120 caracteres)."];
    private static readonly string[] TituloObligatorio = ["El título del álbum es obligatorio."];
    private static readonly string[] TipoInvalido = ["El tipo del álbum es «fotos», «videos» o «mixto»."];
    private static readonly string[] ListaInvalida = ["La lista de origen es un enlace https de YouTube."];
    private static readonly string[] ArchivoInexistente = ["Uno de los archivos no existe en el Banco de archivos."];
    private static readonly string[] ItemInvalido = ["Cada foto lleva archivo y texto alternativo; cada video, un id de YouTube de 11 caracteres y su título."];
    private static readonly string[] ItemIncoherente = ["Los ítems no corresponden al tipo del álbum (un álbum de fotos no lleva videos y uno de videos no lleva fotos)."];
    private static readonly string[] ItemRepetido = ["Una foto o un video aparece dos veces en el álbum."];
    private static readonly string[] PublicacionIncompleta = ["Para publicar, el álbum necesita ítems (y un álbum mixto, al menos una foto y un video)."];
    private static readonly string[] MiniaturaInvalida = ["Solo un video lleva miniatura y debe ser un archivo del Banco de archivos."];
    private static readonly string[] ClaseInvalida = ["La clase es «fotos», «videos», «sueltos» o «todos»."];
    private static readonly string[] LargoExcedido = ["Un texto supera el largo permitido (título del álbum 200, descripción 1000, lugar 200; en cada ítem: título 250, descripción 2000, detalle 4000, crédito 250 y texto alternativo 300)."];
    private static readonly string[] OrdenInvalido = ["El orden debe nombrar álbumes existentes, sin repetir ninguno."];
    private static readonly string[] EstadoVacio = ["Indique si cambia «publicado» o «destacado»."];
    private static readonly string[] DuracionInvalida = ["La duración de un video es un número positivo de segundos."];

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex SlugValido();

    [GeneratedRegex("^[A-Za-z0-9_-]{11}$")]
    private static partial Regex IdDeVideo();

    public static RouteGroupBuilder MapGaleriaEndpoints(this RouteGroupBuilder api)
    {
        // ANONIMA A PROPOSITO: es una página pública del portal. Solo se sirven los álbumes publicados.
        var publico = api.MapGroup("/publico/galeria").WithTags("galeria-publico").AllowAnonymous();
        publico.MapGet("/albumes", ListarPublicos).WithName("ListarAlbumesDeLaGaleria");
        publico.MapGet("/albumes/{slug}", LeerPublico).WithName("LeerAlbumDeLaGaleria");
        publico.MapGet("/items", ListarItems).WithName("ListarItemsDeLaGaleria");

        var consola = api.MapGroup("/institucional/galeria")
            .WithTags("galeria")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            // LAS FOTOS SALEN DEL BANCO DE ARCHIVOS: quien lo administra administra los álbumes. La sección «Galería» de la consola se abre con este mismo módulo
            // (como «Catálogos» con «categorias»): no hay un módulo de permiso nuevo y las cuentas existentes conservan exactamente lo que ya podían hacer.
            .ExigeModulo("banco-de-archivos");
        consola.MapGet("/albumes", ListarTodos).WithName("ListarAlbumesDeLaGaleriaEnConsola");
        consola.MapGet("/albumes/{slug}", LeerEnConsola).WithName("LeerAlbumDeLaGaleriaEnConsola");
        consola.MapPut("/albumes/{slug}", Guardar).WithName("GuardarAlbumDeLaGaleria");
        // EL ORDEN, EL ESTADO Y EL RETIRO SE HACEN DESDE LA LISTA, sin abrir cada álbum. El testigo de la consola lo exige el
        // filtro global de escrituras (TestigoGlobalDeEscrituras); cada acción deja su línea en la auditoría.
        consola.MapPut("/albumes-orden", Ordenar).WithName("OrdenarAlbumesDeLaGaleria");
        consola.MapPut("/albumes/{slug}/estado", CambiarEstado).WithName("CambiarEstadoDeAlbumDeLaGaleria");
        consola.MapDelete("/albumes/{slug}", Eliminar).WithName("EliminarAlbumDeLaGaleria");
        consola.MapGet("/sin-album", LeerSueltosEnConsola).WithName("LeerItemsSinAlbumDeLaGaleriaEnConsola");
        consola.MapPut("/sin-album", GuardarSueltos).WithName("GuardarItemsSinAlbumDeLaGaleria");
        return api;
    }

    private static string? UrlDeArchivo(int? id) =>
        id is { } v ? "/api/v1/publico/archivos/" + v.ToString(CultureInfo.InvariantCulture) : null;

    private static bool ExcedeLargo(string? valor, int maximo) => valor is not null && valor.Trim().Length > maximo;

    private static string? Recortar(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static bool EsListaDeYoutube(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return false;
        return uri.Host is "youtube.com" or "www.youtube.com" or "youtu.be";
    }

    private static async Task<IResult> ListarPublicos(SimusDbContext db, string? tipo, CancellationToken ct)
    {
        if (tipo is not null && !TiposDeAlbum.Contains(tipo)) return Results.BadRequest(new { tipo = TipoInvalido });
        var items = await ResumirAsync(db, soloPublicados: true, tipo, ct);
        // Los totales son de TODO lo publicado (álbumes y sueltos): son los contadores de las pestañas «Fotos», «Videos» y «Sin álbum».
        var publicados = db.GaleriaItems.AsNoTracking().Where(i =>
            (i.GaleriaAlbumId == null && i.Publicado) || db.GaleriaAlbumes.Any(a => a.Id == i.GaleriaAlbumId && a.Publicado));
        var fotos = await publicados.CountAsync(i => i.TipoItem == "foto", ct);
        var videos = await publicados.CountAsync(i => i.TipoItem == "video", ct);
        var sueltos = await publicados.CountAsync(i => i.GaleriaAlbumId == null, ct);
        return Results.Ok(new
        {
            items,
            totales = new { albumes = items.Count, fotos, videos, sueltos },
        });
    }

    private static async Task<IResult> ListarTodos(SimusDbContext db, CancellationToken ct) =>
        Results.Ok(new { items = await ResumirAsync(db, soloPublicados: false, null, ct) });

    private static async Task<List<GaleriaAlbumResumenDto>> ResumirAsync(SimusDbContext db, bool soloPublicados, string? tipo, CancellationToken ct)
    {
        var albumes = await db.GaleriaAlbumes.AsNoTracking()
            .Where(a => (!soloPublicados || a.Publicado) && (tipo == null || a.Tipo == tipo))
            .OrderBy(a => a.Orden).ThenByDescending(a => a.FechaReferencia).ThenBy(a => a.Id)
            .ToListAsync(ct);
        var ids = albumes.Select(a => a.Id).ToList();
        var conteos = await db.GaleriaItems.AsNoTracking().Where(i => i.GaleriaAlbumId != null && ids.Contains(i.GaleriaAlbumId.Value))
            .GroupBy(i => new { Album = i.GaleriaAlbumId!.Value, i.TipoItem })
            .Select(g => new { g.Key.Album, g.Key.TipoItem, N = g.Count() }).ToListAsync(ct);
        // La portada por omisión es la primera foto del álbum y, si no tiene fotos, la miniatura propia de su primer video.
        var primeras = await db.GaleriaItems.AsNoTracking()
            .Where(i => i.GaleriaAlbumId != null && ids.Contains(i.GaleriaAlbumId.Value) && (i.ArchivoId != null || i.MiniaturaArchivoId != null))
            .OrderBy(i => i.TipoItem == "foto" ? 0 : 1).ThenBy(i => i.Orden).ThenBy(i => i.Id)
            .Select(i => new { Album = i.GaleriaAlbumId!.Value, Archivo = i.ArchivoId ?? i.MiniaturaArchivoId }).ToListAsync(ct);
        return albumes.Select(a =>
        {
            var portada = a.PortadaArchivoId ?? primeras.FirstOrDefault(p => p.Album == a.Id)?.Archivo;
            return new GaleriaAlbumResumenDto(
                a.Slug, a.Titulo, a.Descripcion, a.Tipo, a.Lugar, a.FechaReferencia, UrlDeArchivo(portada),
                conteos.Where(c => c.Album == a.Id && c.TipoItem == "foto").Sum(c => c.N),
                conteos.Where(c => c.Album == a.Id && c.TipoItem == "video").Sum(c => c.N),
                a.ListaOrigenUrl, a.Publicado, a.Destacado, a.Orden);
        }).ToList();
    }

    private static readonly string[] Clases = ["fotos", "videos", "sueltos", "todos"];

    /// <summary>
    /// Los ítems de la Galería por clase, de a páginas: todas las fotos, todos los videos o los sueltos («Sin álbum»). Solo lo publicado:
    /// el ítem de un álbum publicado o el ítem suelto marcado como publicado.
    /// </summary>
    private static async Task<IResult> ListarItems(SimusDbContext db, string? clase, int? desde, int? cantidad, CancellationToken ct)
    {
        clase = string.IsNullOrWhiteSpace(clase) ? "todos" : clase.Trim();
        if (!Clases.Contains(clase)) return Results.BadRequest(new { clase = ClaseInvalida });
        var salto = Math.Max(desde ?? 0, 0);
        var tomar = Math.Clamp(cantidad ?? 60, 1, 200);

        var consulta = from i in db.GaleriaItems.AsNoTracking()
                       join a in db.GaleriaAlbumes.AsNoTracking() on i.GaleriaAlbumId equals a.Id into ja
                       from a in ja.DefaultIfEmpty()
                       where (i.GaleriaAlbumId != null && a != null && a.Publicado) || (i.GaleriaAlbumId == null && i.Publicado)
                       select new { i, a };
        consulta = clase switch
        {
            "fotos" => consulta.Where(x => x.i.TipoItem == "foto"),
            "videos" => consulta.Where(x => x.i.TipoItem == "video"),
            "sueltos" => consulta.Where(x => x.i.GaleriaAlbumId == null),
            _ => consulta,
        };
        var total = await consulta.CountAsync(ct);
        var pagina = await consulta
            .OrderBy(x => x.a == null ? 1 : 0).ThenBy(x => x.a!.Orden).ThenByDescending(x => x.a!.FechaReferencia).ThenBy(x => x.a!.Id)
            .ThenByDescending(x => x.a == null ? x.i.Fecha : null).ThenBy(x => x.i.Orden).ThenBy(x => x.i.Id)
            .Skip(salto).Take(tomar).ToListAsync(ct);
        var medidas = await MedidasAsync(db, pagina.Where(x => x.i.ArchivoId != null).Select(x => x.i.ArchivoId!.Value), ct);
        var items = pagina.Select(x => new GaleriaItemPublicoDto(
            x.i.Id, x.i.TipoItem, x.i.Titulo, x.i.Descripcion, x.i.Fecha, x.i.Credito, x.i.TextoAlternativo,
            UrlDeArchivo(x.i.ArchivoId), UrlDeArchivo(x.i.MiniaturaArchivoId), x.i.VideoId,
            x.i.VideoId is null ? null : "https://www.youtube.com/watch?v=" + x.i.VideoId, x.i.DuracionSegundos,
            x.i.ArchivoId is { } f && medidas.TryGetValue(f, out var m) ? m.Ancho : null,
            x.i.ArchivoId is { } g && medidas.TryGetValue(g, out var n) ? n.Alto : null,
            x.a?.Slug, x.a?.Titulo, x.a?.Lugar, x.a?.FechaReferencia, x.i.Detalle)).ToList();
        return Results.Ok(new GaleriaItemsPaginaDto(items, total));
    }

    private static async Task<Dictionary<int, (int? Ancho, int? Alto)>> MedidasAsync(SimusDbContext db, IEnumerable<int> archivos, CancellationToken ct)
    {
        var ids = archivos.Distinct().ToList();
        if (ids.Count == 0) return [];
        var filas = await db.Files.AsNoTracking().Where(f => ids.Contains(f.Id)).Select(f => new { f.Id, f.Width, f.Height }).ToListAsync(ct);
        return filas.ToDictionary(f => f.Id, f => (f.Width, f.Height));
    }

    private static async Task<IResult> LeerPublico(SimusDbContext db, string slug, CancellationToken ct)
    {
        var dto = await ComponerAsync(db, slug, soloPublicado: true, ct);
        return dto is null ? Results.NotFound() : Results.Ok(dto);
    }

    private static async Task<IResult> LeerEnConsola(SimusDbContext db, string slug, CancellationToken ct)
    {
        var dto = await ComponerAsync(db, slug, soloPublicado: false, ct);
        return dto is null ? Results.NotFound() : Results.Ok(dto);
    }

    private static async Task<GaleriaAlbumDto?> ComponerAsync(SimusDbContext db, string slug, bool soloPublicado, CancellationToken ct)
    {
        var a = await db.GaleriaAlbumes.AsNoTracking().FirstOrDefaultAsync(x => x.Slug == slug && (!soloPublicado || x.Publicado), ct);
        if (a is null) return null;
        var items = await db.GaleriaItems.AsNoTracking().Where(x => x.GaleriaAlbumId == a.Id)
            .OrderBy(x => x.Orden).ThenBy(x => x.Id).ToListAsync(ct);
        var primera = items.FirstOrDefault(i => i.TipoItem == "foto")?.ArchivoId ?? items.FirstOrDefault(i => i.MiniaturaArchivoId != null)?.MiniaturaArchivoId;
        return new GaleriaAlbumDto(
            a.Slug, a.Titulo, a.Descripcion, a.Tipo, a.Lugar, a.FechaReferencia,
            UrlDeArchivo(a.PortadaArchivoId ?? primera), a.PortadaArchivoId, a.ListaOrigenUrl, a.Orden, a.Publicado, a.FechaActualizacion,
            await ComoDtosAsync(db, items, ct), a.Destacado);
    }

    private static async Task<List<GaleriaItemDto>> ComoDtosAsync(SimusDbContext db, List<GaleriaItemRow> items, CancellationToken ct)
    {
        var medidas = await MedidasAsync(db, items.Where(i => i.ArchivoId != null).Select(i => i.ArchivoId!.Value), ct);
        return items.Select(i => new GaleriaItemDto(
            i.Id, i.TipoItem, i.Orden, i.Titulo, i.Descripcion, i.Fecha, i.Credito, i.TextoAlternativo, i.ArchivoId, UrlDeArchivo(i.ArchivoId),
            i.VideoId, i.VideoId is null ? null : "https://www.youtube.com/watch?v=" + i.VideoId, i.DuracionSegundos,
            i.MiniaturaArchivoId, UrlDeArchivo(i.MiniaturaArchivoId),
            i.ArchivoId is { } f && medidas.TryGetValue(f, out var m) ? m.Ancho : null,
            i.ArchivoId is { } g && medidas.TryGetValue(g, out var n) ? n.Alto : null,
            i.Publicado, i.Detalle)).ToList();
    }

    private static async Task<IResult> LeerSueltosEnConsola(SimusDbContext db, CancellationToken ct)
    {
        var items = await db.GaleriaItems.AsNoTracking().Where(x => x.GaleriaAlbumId == null).OrderBy(x => x.Orden).ThenBy(x => x.Id).ToListAsync(ct);
        return Results.Ok(new GaleriaSueltosDto(await ComoDtosAsync(db, items, ct)));
    }

    /// <summary>Valida los ítems de una solicitud. Con <paramref name="tipoDeAlbum"/> nulo (ítems sueltos) no hay coherencia de tipo que exigir.</summary>
    private static object? ErrorDeItems(List<GuardarGaleriaItemSolicitud> items, string? tipoDeAlbum)
    {
        foreach (var x in items)
        {
            var esFoto = x.TipoItem == "foto";
            var esVideo = x.TipoItem == "video";
            if (!esFoto && !esVideo) return new { items = ItemInvalido };
            if (ExcedeLargo(x.Titulo, 250) || ExcedeLargo(x.Descripcion, 2000) || ExcedeLargo(x.Detalle, 4000)
                || ExcedeLargo(x.Credito, 250) || ExcedeLargo(x.TextoAlternativo, 300))
            {
                return new { items = LargoExcedido };
            }
            if (esFoto && (x.ArchivoId is null || !string.IsNullOrWhiteSpace(x.VideoId) || string.IsNullOrWhiteSpace(x.TextoAlternativo)))
            {
                return new { items = ItemInvalido };
            }
            if (esVideo && (x.ArchivoId is not null || string.IsNullOrWhiteSpace(x.Titulo) || x.VideoId is null || !IdDeVideo().IsMatch(x.VideoId.Trim())))
            {
                return new { items = ItemInvalido };
            }
            if (esVideo && x.DuracionSegundos is <= 0) return new { items = DuracionInvalida };
            if (esFoto && x.MiniaturaArchivoId is not null) return new { items = MiniaturaInvalida };
            if (tipoDeAlbum is not null && ((tipoDeAlbum == "fotos" && esVideo) || (tipoDeAlbum == "videos" && esFoto))) return new { items = ItemIncoherente };
        }
        if (items.Where(x => x.TipoItem == "foto").Select(x => x.ArchivoId).Distinct().Count() != items.Count(x => x.TipoItem == "foto")
            || items.Where(x => x.TipoItem == "video").Select(x => x.VideoId!.Trim()).Distinct().Count() != items.Count(x => x.TipoItem == "video"))
        {
            return new { items = ItemRepetido };
        }
        return null;
    }

    private static List<int> ArchivosDe(IEnumerable<GuardarGaleriaItemSolicitud> items) =>
        items.SelectMany(x => new[] { x.ArchivoId, x.MiniaturaArchivoId }).Where(x => x is not null).Select(x => x!.Value).Distinct().ToList();

    private static GaleriaItemRow NuevaFila(int? albumId, GuardarGaleriaItemSolicitud x, int orden)
    {
        var esFoto = x.TipoItem == "foto";
        return new GaleriaItemRow
        {
            GaleriaAlbumId = albumId,
            TipoItem = x.TipoItem,
            Orden = orden,
            Titulo = Recortar(x.Titulo),
            Descripcion = Recortar(x.Descripcion),
            Detalle = Recortar(x.Detalle),
            Fecha = x.Fecha,
            Credito = Recortar(x.Credito),
            TextoAlternativo = esFoto ? Recortar(x.TextoAlternativo) : null,
            ArchivoId = esFoto ? x.ArchivoId : null,
            VideoId = esFoto ? null : x.VideoId!.Trim(),
            DuracionSegundos = esFoto ? null : x.DuracionSegundos,
            MiniaturaArchivoId = esFoto ? null : x.MiniaturaArchivoId,
            Publicado = albumId is not null || x.Publicado,
        };
    }

    /// <summary>Guarda de una vez TODOS los ítems sueltos («Sin álbum»): lo que no venga en la solicitud deja de existir, como en un álbum.</summary>
    private static async Task<IResult> GuardarSueltos(SimusDbContext db, ClaimsPrincipal principal, GuardarGaleriaSueltosSolicitud s, CancellationToken ct)
    {
        var items = s.Items ?? [];
        var error = ErrorDeItems(items, null);
        if (error is not null) return Results.BadRequest(error);
        var archivos = ArchivosDe(items);
        if (archivos.Count > 0 && await db.Files.CountAsync(x => archivos.Contains(x.Id), ct) != archivos.Count)
        {
            return Results.BadRequest(new { archivos = ArchivoInexistente });
        }
        db.GaleriaItems.RemoveRange(db.GaleriaItems.Where(x => x.GaleriaAlbumId == null));
        await db.SaveChangesAsync(ct);
        var n = 0;
        foreach (var x in items) db.GaleriaItems.Add(NuevaFila(null, x, ++n));
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : 0,
            TableName = "GaleriaItems",
            RecordId = "sin-album",
            Action = "actualizar",
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new { total = items.Count, resumen = "Actualizó los ítems sin álbum de la Galería." }),
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);
        return await LeerSueltosEnConsola(db, ct);
    }

    private static async Task<IResult> Guardar(
        SimusDbContext db, ClaimsPrincipal principal, string slug, GuardarGaleriaAlbumSolicitud s, CancellationToken ct)
    {
        if (slug.Length > 120 || !SlugValido().IsMatch(slug)) return Results.BadRequest(new { slug = SlugInvalido });
        var titulo = (s.Titulo ?? string.Empty).Trim();
        if (titulo.Length == 0) return Results.BadRequest(new { titulo = TituloObligatorio });
        var tipo = (s.Tipo ?? string.Empty).Trim();
        if (!TiposDeAlbum.Contains(tipo)) return Results.BadRequest(new { tipo = TipoInvalido });
        if (titulo.Length > 200 || ExcedeLargo(s.Descripcion, 1000) || ExcedeLargo(s.Lugar, 200)) return Results.BadRequest(new { titulo = LargoExcedido });
        var lista = Recortar(s.ListaOrigenUrl);
        if (lista is not null && !EsListaDeYoutube(lista)) return Results.BadRequest(new { listaOrigenUrl = ListaInvalida });

        var items = s.Items ?? [];
        var error = ErrorDeItems(items, tipo);
        if (error is not null) return Results.BadRequest(error);
        if (s.Publicado && (items.Count == 0 || (tipo == "mixto" && (!items.Any(x => x.TipoItem == "foto") || !items.Any(x => x.TipoItem == "video")))))
        {
            return Results.BadRequest(new { items = PublicacionIncompleta });
        }

        var archivos = ArchivosDe(items).Concat(s.PortadaArchivoId is { } p ? [p] : []).Distinct().ToList();
        if (archivos.Count > 0 && await db.Files.CountAsync(x => archivos.Contains(x.Id), ct) != archivos.Count)
        {
            return Results.BadRequest(new { archivos = ArchivoInexistente });
        }

        var fila = await db.GaleriaAlbumes.FirstOrDefaultAsync(x => x.Slug == slug, ct);
        var accion = "actualizar";
        if (fila is null)
        {
            accion = "crear";
            fila = new GaleriaAlbumRow { Slug = slug, FechaCreacion = DateTime.UtcNow };
            db.GaleriaAlbumes.Add(fila);
        }
        else
        {
            fila.FechaActualizacion = DateTime.UtcNow;
        }
        var estabaPublicado = fila.Publicado;
        fila.Titulo = titulo;
        fila.Descripcion = Recortar(s.Descripcion);
        fila.Tipo = tipo;
        fila.Lugar = Recortar(s.Lugar);
        fila.FechaReferencia = s.FechaReferencia;
        fila.PortadaArchivoId = s.PortadaArchivoId;
        fila.ListaOrigenUrl = lista;
        fila.Orden = s.Orden < 1 ? 1 : s.Orden;
        fila.Publicado = s.Publicado;
        var estabaDestacado = fila.Destacado;
        fila.Destacado = s.Destacado;
        await db.SaveChangesAsync(ct);

        // Lo hijo se reemplaza completo: la consola guarda el álbum de una vez, no ítem por ítem.
        db.GaleriaItems.RemoveRange(db.GaleriaItems.Where(x => x.GaleriaAlbumId == fila.Id));
        await db.SaveChangesAsync(ct);
        var n = 0;
        foreach (var x in items) db.GaleriaItems.Add(NuevaFila(fila.Id, x, ++n));

        var verbo = accion == "crear" ? "Creó el álbum" : "Actualizó el álbum";
        if (fila.Publicado && !estabaPublicado) verbo += " y lo publicó";
        if (!fila.Publicado && estabaPublicado) verbo += " y lo despublicó";
        if (fila.Destacado && !estabaDestacado) verbo += " y lo marcó como destacado";
        if (!fila.Destacado && estabaDestacado) verbo += " y le quitó la marca de destacado";
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : 0,
            TableName = "GaleriaAlbumes",
            RecordId = fila.Id.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            PreviousValuesJson = accion == "crear" ? null : System.Text.Json.JsonSerializer.Serialize(new { Publicado = estabaPublicado, Destacado = estabaDestacado }),
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new { fila.Slug, fila.Titulo, fila.Tipo, fila.Publicado, fila.Destacado, resumen = verbo + "." }),
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);

        var dto = await ComponerAsync(db, slug, soloPublicado: false, ct);
        return accion == "crear" ? Results.Created($"/api/v1/institucional/galeria/albumes/{slug}", dto) : Results.Ok(dto);
    }

    private static AuditLogRow Auditar(ClaimsPrincipal principal, string registro, string accion, string resumen, object? antes = null, object? despues = null) => new()
    {
        UserId = int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : 0,
        TableName = "GaleriaAlbumes",
        RecordId = registro,
        Action = accion,
        PreviousValuesJson = antes is null ? null : System.Text.Json.JsonSerializer.Serialize(antes),
        NewValuesJson = System.Text.Json.JsonSerializer.Serialize<object>(despues is null ? new { resumen } : new { resumen, valores = despues }),
        CreatedAt = DateTime.UtcNow,
    };

    /// <summary>Si publicar este álbum es coherente (con ítems y, en un mixto, al menos una foto y un video).</summary>
    private static async Task<bool> PuedePublicarseAsync(SimusDbContext db, GaleriaAlbumRow a, CancellationToken ct)
    {
        var tipos = await db.GaleriaItems.AsNoTracking().Where(x => x.GaleriaAlbumId == a.Id).Select(x => x.TipoItem).ToListAsync(ct);
        return tipos.Count > 0 && (a.Tipo != "mixto" || (tipos.Contains("foto") && tipos.Contains("video")));
    }

    /// <summary>Publica, despublica o destaca un álbum desde la lista, sin tocar sus ítems.</summary>
    private static async Task<IResult> CambiarEstado(
        SimusDbContext db, ClaimsPrincipal principal, string slug, CambiarEstadoDeAlbumSolicitud s, CancellationToken ct)
    {
        if (s.Publicado is null && s.Destacado is null) return Results.BadRequest(new { estado = EstadoVacio });
        var fila = await db.GaleriaAlbumes.FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (fila is null) return Results.NotFound();
        if (s.Publicado == true && !fila.Publicado && !await PuedePublicarseAsync(db, fila, ct))
        {
            return Results.BadRequest(new { items = PublicacionIncompleta });
        }
        var antes = new { fila.Publicado, fila.Destacado };
        var partes = new List<string>();
        if (s.Publicado is { } p && p != fila.Publicado) { fila.Publicado = p; partes.Add(p ? "lo publicó" : "lo despublicó"); }
        if (s.Destacado is { } d && d != fila.Destacado) { fila.Destacado = d; partes.Add(d ? "lo marcó como destacado" : "le quitó la marca de destacado"); }
        if (partes.Count > 0)
        {
            fila.FechaActualizacion = DateTime.UtcNow;
            db.AuditLogs.Add(Auditar(principal, fila.Id.ToString(CultureInfo.InvariantCulture), "actualizar",
                $"Del álbum «{fila.Titulo}»: {string.Join(" y ", partes)}.", antes, new { fila.Publicado, fila.Destacado }));
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok((await ResumirAsync(db, soloPublicados: false, null, ct)).First(x => x.Slug == slug));
    }

    /// <summary>Guarda el orden en que se ven los álbumes (1, 2, 3…). Los que no se nombren quedan después, en su orden actual.</summary>
    private static async Task<IResult> Ordenar(SimusDbContext db, ClaimsPrincipal principal, OrdenarAlbumesSolicitud s, CancellationToken ct)
    {
        var pedidos = (s.Slugs ?? []).Select(x => (x ?? string.Empty).Trim()).ToList();
        if (pedidos.Count == 0 || pedidos.Distinct().Count() != pedidos.Count) return Results.BadRequest(new { slugs = OrdenInvalido });
        var filas = await db.GaleriaAlbumes.OrderBy(a => a.Orden).ThenByDescending(a => a.FechaReferencia).ThenBy(a => a.Id).ToListAsync(ct);
        if (pedidos.Any(x => filas.All(f => f.Slug != x))) return Results.BadRequest(new { slugs = OrdenInvalido });

        var resto = filas.Where(f => !pedidos.Contains(f.Slug)).ToList();
        var final = pedidos.Select(x => filas.First(f => f.Slug == x)).Concat(resto).ToList();
        var n = 0;
        var ahora = DateTime.UtcNow;
        foreach (var f in final)
        {
            n++;
            if (f.Orden != n) { f.Orden = n; f.FechaActualizacion = ahora; }
        }
        db.AuditLogs.Add(Auditar(principal, "orden", "actualizar", "Cambió el orden de los álbumes de la Galería.", null, new { orden = final.Select(f => f.Slug) }));
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { items = await ResumirAsync(db, soloPublicados: false, null, ct) });
    }

    /// <summary>
    /// Retira un álbum y sus ítems. Las fotos NO se borran del Banco de archivos: dejan de verse en la Galería y quedan allí para otros usos
    /// (el Banco avisa de las que ya nadie usa). Un álbum publicado se retira igual, con confirmación en la consola.
    /// </summary>
    private static async Task<IResult> Eliminar(SimusDbContext db, ClaimsPrincipal principal, string slug, CancellationToken ct)
    {
        var fila = await db.GaleriaAlbumes.FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (fila is null) return Results.NotFound();
        var items = await db.GaleriaItems.Where(x => x.GaleriaAlbumId == fila.Id).ToListAsync(ct);
        db.GaleriaItems.RemoveRange(items);
        await db.SaveChangesAsync(ct);
        db.GaleriaAlbumes.Remove(fila);
        db.AuditLogs.Add(Auditar(principal, fila.Id.ToString(CultureInfo.InvariantCulture), "eliminar",
            $"Eliminó el álbum «{fila.Titulo}» y sus {items.Count} ítems.", new { fila.Slug, fila.Titulo, fila.Tipo, fila.Publicado, ItemsEliminados = items.Count }));
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }
}
