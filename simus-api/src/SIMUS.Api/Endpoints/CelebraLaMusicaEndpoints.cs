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
/// El micrositio «Celebra la música» y sus ediciones históricas.
/// </summary>
/// <remarks>
/// <para>
/// <b>NO HAY NOTICIAS NI AGENDA PROPIAS.</b> Cada edición apunta a su proyecto transversal; la
/// programación y la sala de prensa del micrositio son la agenda y las noticias generales con el
/// filtro <c>proyecto=&lt;código&gt;</c> que ya existe. Aquí solo vive lo editorial: presentación,
/// cifras, categorías, caja de herramientas, preguntas frecuentes, galería y colores.
/// </para>
/// <para>
/// <b>UNA EDICIÓN NUEVA NO PIDE MIGRACIÓN.</b> Guardar el año que no existe crea la edición y su
/// proyecto transversal <c>celebra-la-musica-AAAA</c>, de modo que el contenido se etiqueta desde
/// la consola de Agenda y Noticias sin más pasos.
/// </para>
/// </remarks>
public static partial class CelebraLaMusicaEndpoints
{
    private static readonly string[] NombreObligatorio = ["El nombre de la edición es obligatorio."];
    private static readonly string[] AnioInvalido = ["El año de la edición debe estar entre 2011 y 2100."];
    private static readonly string[] ColorInvalido = ["El color debe ser un valor hexadecimal como #6B2A8C."];
    private static readonly string[] FechasInvertidas = ["La fecha de fin no puede ser anterior a la de inicio."];
    private static readonly string[] ArchivoInexistente = ["Uno de los archivos no existe en el Banco de archivos."];
    private static readonly string[] RecursoSinDestino = ["Cada recurso lleva un archivo del Banco o un enlace https, pero no ambos."];
    private static readonly string[] CifraNegativa = ["Las cifras no pueden ser negativas."];
    private static readonly string[] TextoObligatorio = ["Cada categoría, pregunta, recurso e imagen de la galería lleva su texto, y cada imagen de la galería su crédito."];

    [GeneratedRegex("^#[0-9A-Fa-f]{6}$")]
    private static partial Regex ColorHexadecimal();

    public static RouteGroupBuilder MapCelebraLaMusicaEndpoints(this RouteGroupBuilder api)
    {
        // ANONIMA A PROPOSITO: es una página pública del portal. Solo se sirven las ediciones publicadas.
        var publico = api.MapGroup("/publico/celebra-la-musica").WithTags("celebra-la-musica-publico").AllowAnonymous();
        publico.MapGet("/ediciones", ListarPublicas).WithName("ListarEdicionesDeCelebraLaMusica");
        publico.MapGet("/ediciones/{anio:int}", LeerPublica).WithName("LeerEdicionDeCelebraLaMusica");

        var consola = api.MapGroup("/institucional/celebra-la-musica")
            .WithTags("celebra-la-musica")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            // APARTADO PROPIO: el módulo «celebra» («Celebra la Música»). Ya no basta «categorias»; el webmaster
            // lo tiene siempre y a las demás cuentas se les concede en «Usuarios y roles».
            .ExigeModulo("celebra");
        consola.MapGet("/ediciones", ListarTodas).WithName("ListarEdicionesDeCelebraLaMusicaEnConsola");
        consola.MapGet("/ediciones/{anio:int}", LeerEnConsola).WithName("LeerEdicionDeCelebraLaMusicaEnConsola");
        consola.MapGet("/ediciones/{anio:int}/historial", Historial).WithName("HistorialDeEdicionDeCelebraLaMusica");
        // EDITAR Y PUBLICAR VAN JUNTOS: publicar es el campo «publicada» de este mismo PUT, y el sistema de permisos
        // solo distingue módulos (no acciones). Quien tiene «celebra» edita y publica; queda en el historial de la edición.
        consola.MapPut("/ediciones/{anio:int}", Guardar).WithName("GuardarEdicionDeCelebraLaMusica")
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir);
        return api;
    }

    private static string? UrlDeArchivo(int? id) =>
        id is { } v ? "/api/v1/publico/archivos/" + v.ToString(CultureInfo.InvariantCulture) : null;

    private static async Task<IResult> ListarPublicas(SimusDbContext db, CancellationToken ct) =>
        Results.Ok(new { items = await ResumirAsync(db, soloPublicadas: true, ct) });

    private static async Task<IResult> ListarTodas(SimusDbContext db, CancellationToken ct) =>
        Results.Ok(new { items = await ResumirAsync(db, soloPublicadas: false, ct) });

    private static async Task<List<CelebraEdicionResumenDto>> ResumirAsync(SimusDbContext db, bool soloPublicadas, CancellationToken ct)
    {
        var consulta = db.CelebraEdiciones.AsNoTracking().Where(x => !soloPublicadas || x.Publicada);
        var filas = await (
            from e in consulta
            join p in db.ProyectosTransversales.AsNoTracking() on e.ProyectoTransversalId equals p.Id
            orderby e.Anio descending
            select new { Edicion = e, Codigo = p.Codigo }).ToListAsync(ct);
        return filas.Select(x => new CelebraEdicionResumenDto(
            x.Edicion.Anio, x.Edicion.Nombre, x.Edicion.Hashtag, x.Codigo, x.Edicion.Actual, x.Edicion.Publicada,
            x.Edicion.ColorPrincipal, x.Edicion.ColorSecundario, UrlDeArchivo(x.Edicion.ImagenPortadaArchivoId), x.Edicion.Resumen)).ToList();
    }

    private static async Task<IResult> LeerPublica(SimusDbContext db, int anio, CancellationToken ct)
    {
        var dto = await ComponerAsync(db, anio, soloPublicada: true, ct);
        return dto is null ? Results.NotFound() : Results.Ok(dto);
    }

    private static async Task<IResult> LeerEnConsola(SimusDbContext db, int anio, CancellationToken ct)
    {
        var dto = await ComponerAsync(db, anio, soloPublicada: false, ct);
        return dto is null ? Results.NotFound() : Results.Ok(dto);
    }

    private static async Task<CelebraEdicionDto?> ComponerAsync(SimusDbContext db, int anio, bool soloPublicada, CancellationToken ct)
    {
        var e = await db.CelebraEdiciones.AsNoTracking().FirstOrDefaultAsync(x => x.Anio == anio && (!soloPublicada || x.Publicada), ct);
        if (e is null) return null;
        var codigo = await db.ProyectosTransversales.AsNoTracking().Where(p => p.Id == e.ProyectoTransversalId).Select(p => p.Codigo).FirstAsync(ct);

        var categorias = await db.CelebraCategorias.AsNoTracking().Where(x => x.CelebraEdicionId == e.Id)
            .OrderBy(x => x.Orden).ThenBy(x => x.Id).ToListAsync(ct);
        var recursos = await db.CelebraRecursos.AsNoTracking().Where(x => x.CelebraEdicionId == e.Id)
            .OrderBy(x => x.Orden).ThenBy(x => x.Id).ToListAsync(ct);
        var preguntas = await db.CelebraPreguntas.AsNoTracking().Where(x => x.CelebraEdicionId == e.Id)
            .OrderBy(x => x.Orden).ThenBy(x => x.Id).ToListAsync(ct);
        var galeria = await db.CelebraGaleria.AsNoTracking().Where(x => x.CelebraEdicionId == e.Id)
            .OrderBy(x => x.Orden).ThenBy(x => x.Id).ToListAsync(ct);

        return new CelebraEdicionDto(
            e.Anio, e.Nombre, e.Hashtag, codigo, e.Actual, e.Publicada, e.ColorPrincipal, e.ColorSecundario,
            UrlDeArchivo(e.ImagenPortadaArchivoId), e.ImagenPortadaArchivoId, e.FechaInicio, e.FechaFin, e.Resumen, e.Presentacion, e.Aliados,
            e.Actividades, e.Municipios, e.Departamentos, e.Organizaciones, e.Musicos, e.Fuente, e.PendienteDeValidar, e.FechaActualizacion,
            categorias.Select(x => new CelebraCategoriaDto(x.Nombre, x.Descripcion, x.Orden)).ToList(),
            recursos.Select(x => new CelebraRecursoDto(
                x.Id, x.Grupo, x.Titulo, x.Descripcion, x.ArchivoId, x.ArchivoId is null ? x.Url : UrlDeArchivo(x.ArchivoId), x.Orden)).ToList(),
            preguntas.Select(x => new CelebraPreguntaDto(x.Pregunta, x.Respuesta, x.Orden)).ToList(),
            galeria.Select(x => new CelebraImagenDto(x.ArchivoId, UrlDeArchivo(x.ArchivoId)!, x.TextoAlternativo, x.Credito, x.Orden)).ToList());
    }

    private static async Task<IResult> Historial(SimusDbContext db, int anio, CancellationToken ct)
    {
        var id = await db.CelebraEdiciones.AsNoTracking().Where(x => x.Anio == anio).Select(x => (int?)x.Id).FirstOrDefaultAsync(ct);
        if (id is null) return Results.NotFound();
        var clave = id.Value.ToString(CultureInfo.InvariantCulture);
        var filas = await (
            from a in db.AuditLogs.AsNoTracking()
            where a.TableName == "CelebraEdiciones" && a.RecordId == clave
            join u in db.Users.AsNoTracking() on a.UserId equals u.Id into usuarios
            from u in usuarios.DefaultIfEmpty()
            orderby a.CreatedAt descending, a.Id descending
            select new { a.CreatedAt, Usuario = u == null ? null : u.FullName, a.Action, a.NewValuesJson }).Take(50).ToListAsync(ct);
        return Results.Ok(new
        {
            items = filas.Select(f => new CelebraCambioDto(f.CreatedAt, f.Usuario, f.Action, ResumenDelCambio(f.NewValuesJson, f.Action))).ToList(),
        });
    }

    private static string ResumenDelCambio(string? json, string accion)
    {
        try
        {
            if (json is not null && System.Text.Json.JsonDocument.Parse(json).RootElement.TryGetProperty("resumen", out var r) && r.GetString() is { Length: > 0 } texto)
            {
                return texto;
            }
        }
        catch (System.Text.Json.JsonException) { /* un registro anterior sin resumen se cuenta por su verbo */ }
        return accion == "crear" ? "Creó la edición." : "Actualizó la edición.";
    }

    private static string ResumenAlGuardar(string accion, bool eraPublicada, bool eraActual, bool publicada, bool actual)
    {
        var partes = new List<string> { accion == "crear" ? "Creó la edición" : "Actualizó el contenido" };
        if (publicada && !eraPublicada) partes.Add("la publicó");
        if (!publicada && eraPublicada) partes.Add("la despublicó");
        if (actual && !eraActual) partes.Add("la marcó como vigente");
        if (!actual && eraActual) partes.Add("dejó de ser la vigente");
        return string.Join("; ", partes) + ".";
    }

    private static string? Recortar(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static async Task<IResult> Guardar(
        SimusDbContext db, ClaimsPrincipal principal, int anio, GuardarCelebraEdicionSolicitud s, CancellationToken ct)
    {
        if (anio is < 2011 or > 2100) return Results.BadRequest(new { anio = AnioInvalido });
        var nombre = (s.Nombre ?? string.Empty).Trim();
        if (nombre.Length == 0) return Results.BadRequest(new { nombre = NombreObligatorio });

        var principalColor = Recortar(s.ColorPrincipal) ?? "#6B2A8C";
        var secundarioColor = Recortar(s.ColorSecundario) ?? "#E5007E";
        if (!ColorHexadecimal().IsMatch(principalColor) || !ColorHexadecimal().IsMatch(secundarioColor))
        {
            return Results.BadRequest(new { color = ColorInvalido });
        }
        if (s.FechaInicio is { } ini && s.FechaFin is { } fin && fin < ini) return Results.BadRequest(new { fechas = FechasInvertidas });
        if (new[] { s.Actividades, s.Municipios, s.Departamentos, s.Organizaciones, s.Musicos }.Any(v => v is < 0))
        {
            return Results.BadRequest(new { cifras = CifraNegativa });
        }

        var categorias = s.Categorias ?? [];
        var recursos = s.Recursos ?? [];
        var preguntas = s.Preguntas ?? [];
        var galeria = s.Galeria ?? [];
        if (categorias.Any(x => string.IsNullOrWhiteSpace(x.Nombre))
            || recursos.Any(x => string.IsNullOrWhiteSpace(x.Titulo) || string.IsNullOrWhiteSpace(x.Grupo))
            || preguntas.Any(x => string.IsNullOrWhiteSpace(x.Pregunta) || string.IsNullOrWhiteSpace(x.Respuesta))
            || galeria.Any(x => string.IsNullOrWhiteSpace(x.TextoAlternativo) || string.IsNullOrWhiteSpace(x.Credito)))
        {
            return Results.BadRequest(new { contenido = TextoObligatorio });
        }
        if (recursos.Any(x => (x.ArchivoId is null) == string.IsNullOrWhiteSpace(x.Url)
                || (!string.IsNullOrWhiteSpace(x.Url) && !x.Url!.Trim().StartsWith("https://", StringComparison.OrdinalIgnoreCase))))
        {
            return Results.BadRequest(new { recursos = RecursoSinDestino });
        }
        if (categorias.Select(x => x.Nombre.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != categorias.Count
            || galeria.Select(x => x.ArchivoId).Distinct().Count() != galeria.Count)
        {
            return Results.BadRequest(new { contenido = TextoObligatorio });
        }

        var archivos = recursos.Where(x => x.ArchivoId is not null).Select(x => x.ArchivoId!.Value)
            .Concat(galeria.Select(x => x.ArchivoId))
            .Concat(s.ImagenPortadaArchivoId is { } p ? [p] : []).Distinct().ToList();
        if (archivos.Count > 0 && await db.Files.CountAsync(x => archivos.Contains(x.Id), ct) != archivos.Count)
        {
            return Results.BadRequest(new { archivos = ArchivoInexistente });
        }

        var fila = await db.CelebraEdiciones.FirstOrDefaultAsync(x => x.Anio == anio, ct);
        var accion = "actualizar";
        if (fila is null)
        {
            // UNA EDICION NUEVA CREA SU PROYECTO TRANSVERSAL: es lo que permite etiquetar eventos y
            // noticias desde la consola sin migración. El código sale del año y no cambia.
            accion = "crear";
            var codigo = $"celebra-la-musica-{anio.ToString(CultureInfo.InvariantCulture)}";
            var proyecto = await db.ProyectosTransversales.FirstOrDefaultAsync(x => x.Codigo == codigo, ct);
            if (proyecto is null)
            {
                var orden = await db.ProyectosTransversales.AnyAsync(ct) ? await db.ProyectosTransversales.MaxAsync(x => x.OrdenVisualizacion, ct) + 1 : 1;
                proyecto = new ProyectoTransversalRow
                {
                    Codigo = codigo,
                    Nombre = nombre,
                    Descripcion = $"Edición {anio.ToString(CultureInfo.InvariantCulture)} de Celebra la Música.",
                    Activo = true,
                    OrdenVisualizacion = orden,
                    FechaCreacion = DateTime.UtcNow,
                };
                if (await db.ProyectosTransversales.AnyAsync(x => x.Nombre == nombre, ct)) proyecto.Nombre = $"{nombre} ({anio.ToString(CultureInfo.InvariantCulture)})";
                db.ProyectosTransversales.Add(proyecto);
                await db.SaveChangesAsync(ct);
            }
            fila = new CelebraEdicionRow { Anio = anio, ProyectoTransversalId = proyecto.Id, FechaCreacion = DateTime.UtcNow };
            db.CelebraEdiciones.Add(fila);
        }
        else
        {
            fila.FechaActualizacion = DateTime.UtcNow;
        }

        var eraPublicada = fila.Publicada;
        var eraActual = fila.Actual;
        fila.Nombre = nombre;
        fila.Hashtag = Recortar(s.Hashtag);
        fila.ColorPrincipal = principalColor.ToUpperInvariant();
        fila.ColorSecundario = secundarioColor.ToUpperInvariant();
        fila.ImagenPortadaArchivoId = s.ImagenPortadaArchivoId;
        fila.FechaInicio = s.FechaInicio;
        fila.FechaFin = s.FechaFin;
        fila.Resumen = Recortar(s.Resumen);
        fila.Presentacion = Recortar(s.Presentacion);
        fila.Aliados = Recortar(s.Aliados);
        fila.Actividades = s.Actividades;
        fila.Municipios = s.Municipios;
        fila.Departamentos = s.Departamentos;
        fila.Organizaciones = s.Organizaciones;
        fila.Musicos = s.Musicos;
        fila.Fuente = Recortar(s.Fuente);
        fila.PendienteDeValidar = s.PendienteDeValidar;
        fila.Publicada = s.Publicada;

        // UNA SOLA EDICION VIGENTE: marcar esta desmarca a las demás (la base lo impone con un índice único filtrado).
        if (s.Actual)
        {
            var otras = await db.CelebraEdiciones.Where(x => x.Actual && x.Anio != anio).ToListAsync(ct);
            foreach (var otra in otras) otra.Actual = false;
            if (otras.Count > 0) await db.SaveChangesAsync(ct);
        }
        fila.Actual = s.Actual;
        await db.SaveChangesAsync(ct);

        // Lo hijo se reemplaza completo: la consola guarda la edición de una vez, no fila por fila.
        db.CelebraCategorias.RemoveRange(db.CelebraCategorias.Where(x => x.CelebraEdicionId == fila.Id));
        db.CelebraRecursos.RemoveRange(db.CelebraRecursos.Where(x => x.CelebraEdicionId == fila.Id));
        db.CelebraPreguntas.RemoveRange(db.CelebraPreguntas.Where(x => x.CelebraEdicionId == fila.Id));
        db.CelebraGaleria.RemoveRange(db.CelebraGaleria.Where(x => x.CelebraEdicionId == fila.Id));
        await db.SaveChangesAsync(ct);

        var n = 0;
        foreach (var x in categorias) db.CelebraCategorias.Add(new CelebraCategoriaRow { CelebraEdicionId = fila.Id, Nombre = x.Nombre.Trim(), Descripcion = Recortar(x.Descripcion), Orden = ++n });
        n = 0;
        foreach (var x in recursos)
            db.CelebraRecursos.Add(new CelebraRecursoRow
            {
                CelebraEdicionId = fila.Id, Grupo = x.Grupo.Trim(), Titulo = x.Titulo.Trim(), Descripcion = Recortar(x.Descripcion),
                ArchivoId = x.ArchivoId, Url = x.ArchivoId is null ? Recortar(x.Url) : null, Orden = ++n,
            });
        n = 0;
        foreach (var x in preguntas) db.CelebraPreguntas.Add(new CelebraPreguntaRow { CelebraEdicionId = fila.Id, Pregunta = x.Pregunta.Trim(), Respuesta = x.Respuesta.Trim(), Orden = ++n });
        n = 0;
        foreach (var x in galeria) db.CelebraGaleria.Add(new CelebraImagenRow { CelebraEdicionId = fila.Id, ArchivoId = x.ArchivoId, TextoAlternativo = x.TextoAlternativo.Trim(), Credito = Recortar(x.Credito), Orden = ++n });

        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : 0,
            TableName = "CelebraEdiciones",
            RecordId = fila.Id.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            PreviousValuesJson = accion == "crear" ? null : System.Text.Json.JsonSerializer.Serialize(new { Publicada = eraPublicada, Actual = eraActual }),
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new { fila.Anio, fila.Nombre, fila.Publicada, fila.Actual, resumen = ResumenAlGuardar(accion, eraPublicada, eraActual, fila.Publicada, fila.Actual) }),
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);

        var dto = await ComponerAsync(db, anio, soloPublicada: false, ct);
        return accion == "crear" ? Results.Created($"/api/v1/institucional/celebra-la-musica/ediciones/{anio}", dto) : Results.Ok(dto);
    }
}
