using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Administración de los catálogos conceptuales «Territorios sonoros» y «Prácticas musicales» desde la consola.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ EXISTE.</b> Los dos catálogos eran tablas que solo se tocaban con una migración: el área misional no podía
/// agregar una práctica, ordenarlas ni completar su ficha, y el portal mostraba «Ficha conceptual en preparación» en todas.
/// Aquí se agregan, editan, ordenan, activan o desactivan, y se completa la ficha de cada una, también en producción.
/// </para>
/// <para>
/// <b>NO SE BORRA LO QUE ESTÁ EN USO.</b> Festivales, mercados, noticias, agenda, editorial, talleres, espacios, redes y
/// perfiles apuntan a estos catálogos. Un elemento en uso no se elimina: se desactiva (deja de ofrecerse en los formularios
/// y en el catálogo público, pero conserva todos sus vínculos). Solo se elimina uno sin ningún uso ni subelementos.
/// </para>
/// <para>
/// <b>MISMO PERMISO QUE «CATEGORÍAS».</b> Es el mismo trabajo editorial sobre vocabularios controlados, así que la ruta
/// exige el módulo <c>categorias</c> y no abre una puerta nueva en la lista de módulos de la cuenta. Toda la ruta pide
/// sesión de consola y CSRF por la política por defecto; los cambios quedan en la bitácora de auditoría.
/// </para>
/// <para>
/// <b>LA FICHA ES TEXTO PLANO.</b> Los párrafos se separan con una línea en blanco; el portal los escribe con el escape del
/// navegador y nunca interpreta marcado, de modo que una ficha no puede inyectar contenido.
/// </para>
/// </remarks>
public static partial class CatalogosEndpoints
{
    internal const int MaxNombre = 140;
    internal const int MaxDefinicionBreve = 800;
    internal const int MaxDefinicionAmpliada = 8000;
    internal const int MaxTextoDeFicha = 2000;
    internal const int MaxSinonimos = 500;
    internal const int MaxObservaciones = 1000;
    internal const int MaxTextoAlternativo = 500;
    internal const int MaxOrden = 100000;

    private static readonly string[] EnUso =
        ["Está en uso: no se puede eliminar. Desactívalo para que deje de ofrecerse sin perder los vínculos que ya existen."];

    private static readonly string[] NombreSinLetras = ["El nombre debe tener letras o números."];
    private static readonly string[] ConSubelementos = ["Tiene subelementos: muévelos a otro principal o elimínalos primero."];
    private static readonly string[] OrdenIncompleto = ["El orden debe incluir cada elemento exactamente una vez."];
    private static readonly string[] HojaVacia = ["La hoja no trae filas."];

    public static RouteGroupBuilder MapCatalogosEndpoints(this RouteGroupBuilder api)
    {
        var consola = api.MapGroup("/institucional/catalogos")
            .WithTags("catalogos")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("categorias");

        Mapear(consola, Descriptores.Territorios, "TerritoriosSonoros");
        Mapear(consola, Descriptores.Practicas, "PracticasMusicales");
        return api;
    }

    private static void Mapear<TItem, TFicha>(RouteGroupBuilder consola, DescriptorDeCatalogo<TItem, TFicha> d, string nombre)
        where TItem : class, IElementoDeCatalogo, new()
        where TFicha : class, IFichaDeCatalogo, new()
    {
        var g = consola.MapGroup("/" + d.Ruta);
        g.MapGet(string.Empty, (SimusDbContext db, CancellationToken ct) => Listar(db, d, ct)).WithName("Listar" + nombre);
        g.MapPost(string.Empty, (SimusDbContext db, ClaimsPrincipal quien, GuardarElementoDeCatalogoSolicitud s, CancellationToken ct) => Guardar(db, quien, d, null, s, ct)).WithName("Crear" + nombre);
        g.MapPut("/{id:int}", (SimusDbContext db, ClaimsPrincipal quien, int id, GuardarElementoDeCatalogoSolicitud s, CancellationToken ct) => Guardar(db, quien, d, id, s, ct)).WithName("Guardar" + nombre);
        g.MapPost("/{id:int}/activo", (SimusDbContext db, ClaimsPrincipal quien, int id, CambiarActivoDeCatalogoSolicitud s, CancellationToken ct) => CambiarActivo(db, quien, d, id, s, ct)).WithName("CambiarActivo" + nombre);
        g.MapDelete("/{id:int}", (SimusDbContext db, ClaimsPrincipal quien, int id, CancellationToken ct) => Eliminar(db, quien, d, id, ct)).WithName("Eliminar" + nombre);
        g.MapPost("/orden", (SimusDbContext db, ClaimsPrincipal quien, OrdenarCatalogoSolicitud s, CancellationToken ct) => Ordenar(db, quien, d, s, ct)).WithName("Ordenar" + nombre);
        g.MapPost("/importar", (SimusDbContext db, ClaimsPrincipal quien, ImportarCatalogoSolicitud s, CancellationToken ct) => Importar(db, quien, d, s, ct)).WithName("Importar" + nombre);
        g.MapGet("/{id:int}/historial", (SimusDbContext db, int id, CancellationToken ct) => Historial(db, d, id, ct)).WithName("Historial" + nombre);
    }

    // ─────────────────────────── Lectura ───────────────────────────

    private static async Task<IResult> Listar<TItem, TFicha>(SimusDbContext db, DescriptorDeCatalogo<TItem, TFicha> d, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var items = await ConstruirAsync(db, d, ct);
        return Results.Ok(new { items, total = items.Count });
    }

    internal static async Task<List<ElementoDeCatalogoDto>> ConstruirAsync<TItem, TFicha>(
        SimusDbContext db, DescriptorDeCatalogo<TItem, TFicha> d, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var filas = await d.Items(db).AsNoTracking().OrderBy(x => x.Orden).ThenBy(x => x.Nombre).ToListAsync(ct);
        var fichas = (await d.Fichas(db).AsNoTracking().ToListAsync(ct)).ToDictionary(d.ClaveDeFicha);
        var usos = await d.Usos(db, ct);
        var nombres = filas.ToDictionary(x => x.Id, x => x.Nombre);
        var hijos = filas.Where(x => d.Padre(x) is not null).GroupBy(x => d.Padre(x)!.Value).ToDictionary(g => g.Key, g => g.Count());
        return filas.Select(x =>
        {
            fichas.TryGetValue(x.Id, out var ficha);
            var u = usos.GetValueOrDefault(x.Id) ?? [];
            var padre = d.Padre(x);
            return Dto(x, ficha, d, padre, padre is { } p ? nombres.GetValueOrDefault(p) : null, u, hijos.GetValueOrDefault(x.Id));
        }).ToList();
    }

    internal static string EstadoDeFicha(string? breve, string? ampliada, bool preliminar) =>
        string.IsNullOrWhiteSpace(breve) && string.IsNullOrWhiteSpace(ampliada) ? "pendiente" : preliminar ? "preliminar" : "completa";

    private static ElementoDeCatalogoDto Dto<TItem, TFicha>(TItem x, TFicha? f, DescriptorDeCatalogo<TItem, TFicha> d,
        int? padreId, string? padreNombre, List<UsoDeCatalogoDto> usos, int subelementos)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var breve = f?.DefinicionBreve ?? x.Descripcion;
        return new ElementoDeCatalogoDto(x.Id, x.Nombre, x.Slug, x.Orden, x.Activo, padreId, padreNombre, x.Sinonimos, x.Observaciones,
            breve, f?.DefinicionAmpliada, f?.Caracteristicas, f is null ? null : d.Relacion?.Invoke(f), f?.Contextos, f?.Ejemplos, f?.Fuentes,
            f?.EsPreliminar ?? false, f?.ImagenArchivoId, UrlDeArchivo(f?.ImagenArchivoId), f?.TextoAlternativoRecurso,
            x.FechaActualizacion ?? f?.FechaActualizacion, usos.Sum(u => u.Total), usos, subelementos,
            EstadoDeFicha(breve, f?.DefinicionAmpliada, f?.EsPreliminar ?? false));
    }

    internal static string? UrlDeArchivo(int? id) =>
        id is { } v ? "/api/v1/publico/archivos/" + v.ToString(CultureInfo.InvariantCulture) : null;

    // ─────────────────────────── Escritura ───────────────────────────

    private static async Task<IResult> Guardar<TItem, TFicha>(SimusDbContext db, ClaimsPrincipal quien,
        DescriptorDeCatalogo<TItem, TFicha> d, int? id, GuardarElementoDeCatalogoSolicitud s, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var todos = await d.Items(db).ToListAsync(ct);
        var fila = id is null ? null : todos.FirstOrDefault(x => x.Id == id);
        if (id is not null && fila is null) return Results.NotFound();

        var errores = Validar(s, d, todos, fila);
        if (errores.Count > 0) return Results.BadRequest(errores);
        if (s.ImagenArchivoId is { } archivo && !await db.Files.AnyAsync(f => f.Id == archivo, ct))
            return Results.BadRequest(new Dictionary<string, string[]> { ["imagenArchivoId"] = ["La imagen elegida no está en el Banco de archivos."] });

        var nombre = Limpiar(s.Nombre)!;
        var slug = ReglasDeNoticias.SlugDesde(Limpiar(s.Slug) ?? (fila?.Slug ?? nombre));
        if (slug.Length == 0) return Results.BadRequest(new { nombre = NombreSinLetras });
        var choque = Choque(todos, fila?.Id, nombre, slug);
        if (choque is not null) return Results.Conflict(new { nombre = new[] { choque } });

        var nuevo = fila is null;
        fila ??= new TItem();
        var ficha = nuevo ? null : await d.Fichas(db).FindAsync([fila.Id], ct);
        var antes = nuevo ? null : Instantanea(fila, ficha, d);

        fila.Nombre = nombre;
        fila.Slug = slug;
        fila.Orden = s.Orden ?? (nuevo ? (todos.Count == 0 ? 1 : todos.Max(x => x.Orden) + 1) : fila.Orden);
        fila.Activo = s.Activo;
        fila.Sinonimos = LimpiarSinonimos(s.Sinonimos);
        fila.Observaciones = Limpiar(s.Observaciones);
        if (d.FijarPadre is not null) d.FijarPadre(fila, s.PadreId);
        var ahora = DateTime.UtcNow;
        fila.FechaActualizacion = ahora;
        if (nuevo) d.Items(db).Add(fila);
        // El identificador de un elemento nuevo solo existe tras guardar; la ficha se crea en el mismo guardado.
        await db.SaveChangesAsync(ct);

        if (ficha is null)
        {
            ficha = new TFicha();
            d.FijarClave(ficha, fila.Id);
            d.Fichas(db).Add(ficha);
        }
        ficha.DefinicionBreve = Limpiar(s.DefinicionBreve);
        ficha.DefinicionAmpliada = Limpiar(s.DefinicionAmpliada);
        ficha.Caracteristicas = Limpiar(s.Caracteristicas);
        d.FijarRelacion?.Invoke(ficha, Limpiar(s.RelacionTerritorial));
        ficha.Contextos = Limpiar(s.Contextos);
        ficha.Ejemplos = Limpiar(s.Ejemplos);
        ficha.Fuentes = Limpiar(s.Fuentes);
        ficha.EsPreliminar = s.EsPreliminar;
        ficha.ImagenArchivoId = s.ImagenArchivoId;
        ficha.RecursoVisualUrl = UrlDeArchivo(s.ImagenArchivoId) ?? ficha.RecursoVisualUrl;
        if (s.ImagenArchivoId is null && ficha.RecursoVisualUrl is { } u && u.StartsWith("/api/v1/publico/archivos/", StringComparison.Ordinal)) ficha.RecursoVisualUrl = null;
        ficha.TextoAlternativoRecurso = Limpiar(s.TextoAlternativoRecurso);
        ficha.FechaActualizacion = ahora;

        Auditar(db, quien, d, fila.Id, nuevo ? "crear" : "actualizar", antes, Instantanea(fila, ficha, d));
        await db.SaveChangesAsync(ct);

        var salida = (await ConstruirAsync(db, d, ct)).First(x => x.Id == fila.Id);
        return nuevo ? Results.Created($"/api/v1/institucional/catalogos/{d.Ruta}/{fila.Id}", salida) : Results.Ok(salida);
    }

    private static async Task<IResult> CambiarActivo<TItem, TFicha>(SimusDbContext db, ClaimsPrincipal quien,
        DescriptorDeCatalogo<TItem, TFicha> d, int id, CambiarActivoDeCatalogoSolicitud s, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var fila = await d.Items(db).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();
        if (fila.Activo != s.Activo)
        {
            Auditar(db, quien, d, id, "actualizar", new Dictionary<string, string?> { ["activo"] = fila.Activo ? "sí" : "no" },
                new Dictionary<string, string?> { ["activo"] = s.Activo ? "sí" : "no" });
            fila.Activo = s.Activo;
            fila.FechaActualizacion = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok((await ConstruirAsync(db, d, ct)).First(x => x.Id == id));
    }

    private static async Task<IResult> Eliminar<TItem, TFicha>(SimusDbContext db, ClaimsPrincipal quien,
        DescriptorDeCatalogo<TItem, TFicha> d, int id, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var fila = await d.Items(db).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (fila is null) return Results.NotFound();
        var dto = (await ConstruirAsync(db, d, ct)).First(x => x.Id == id);
        if (dto.TotalDeUsos > 0) return Results.BadRequest(new { catalogo = EnUso });
        if (dto.Subelementos > 0)
            return Results.BadRequest(new { catalogo = ConSubelementos });

        var ficha = await d.Fichas(db).FindAsync([id], ct);
        Auditar(db, quien, d, id, "eliminar", Instantanea(fila, ficha, d), null);
        // La base ya no borra la ficha en cascada (V20260910_02): se retira de forma explícita y a la vez que su elemento.
        if (ficha is not null) d.Fichas(db).Remove(ficha);
        d.Items(db).Remove(fila);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> Ordenar<TItem, TFicha>(SimusDbContext db, ClaimsPrincipal quien,
        DescriptorDeCatalogo<TItem, TFicha> d, OrdenarCatalogoSolicitud s, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var todos = await d.Items(db).ToListAsync(ct);
        var pedidos = s.Ids ?? [];
        if (pedidos.Distinct().Count() != pedidos.Count || pedidos.Count != todos.Count || !todos.All(x => pedidos.Contains(x.Id)))
            return Results.BadRequest(new { ids = OrdenIncompleto });

        var ahora = DateTime.UtcNow;
        var cambiados = 0;
        for (var i = 0; i < pedidos.Count; i++)
        {
            var fila = todos.First(x => x.Id == pedidos[i]);
            if (fila.Orden == i + 1) continue;
            Auditar(db, quien, d, fila.Id, "actualizar", new Dictionary<string, string?> { ["orden"] = fila.Orden.ToString(CultureInfo.InvariantCulture) },
                new Dictionary<string, string?> { ["orden"] = (i + 1).ToString(CultureInfo.InvariantCulture) });
            fila.Orden = i + 1;
            fila.FechaActualizacion = ahora;
            cambiados++;
        }
        if (cambiados > 0) await db.SaveChangesAsync(ct);
        var items = await ConstruirAsync(db, d, ct);
        return Results.Ok(new { items, total = items.Count });
    }

    private static async Task<IResult> Historial<TItem, TFicha>(SimusDbContext db, DescriptorDeCatalogo<TItem, TFicha> d, int id, CancellationToken ct)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var clave = id.ToString(CultureInfo.InvariantCulture);
        var filas = await db.AuditLogs.AsNoTracking()
            .Where(a => a.TableName == d.TablaDeAuditoria && a.RecordId == clave)
            .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id).Take(100).ToListAsync(ct);
        var ids = filas.Where(a => a.UserId != null).Select(a => a.UserId!.Value).Distinct().ToList();
        var autores = await db.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        var items = filas.Select(a => new EntradaDeHistorialDeCatalogoDto(a.Id, a.CreatedAt, a.Action,
            a.UserId is { } u ? autores.GetValueOrDefault(u) : null, ResumenDeCambio(a))).ToList();
        return Results.Ok(new { items });
    }

    private static string ResumenDeCambio(AuditLogRow a)
    {
        if (a.Action == "crear") return "Creó el elemento.";
        if (a.Action == "eliminar") return "Eliminó el elemento.";
        try
        {
            var antes = JsonSerializer.Deserialize<Dictionary<string, string?>>(a.PreviousValuesJson ?? "{}") ?? [];
            var despues = JsonSerializer.Deserialize<Dictionary<string, string?>>(a.NewValuesJson ?? "{}") ?? [];
            var campos = despues.Keys.Where(k => !string.Equals(antes.GetValueOrDefault(k), despues[k], StringComparison.Ordinal)).ToList();
            return campos.Count == 0 ? "Guardó sin cambios." : "Cambió: " + string.Join(", ", campos) + ".";
        }
        catch (JsonException)
        {
            return "Actualizó el elemento.";
        }
    }

    // ─────────────────────────── Validación ───────────────────────────

    internal static Dictionary<string, string[]> Validar<TItem, TFicha>(GuardarElementoDeCatalogoSolicitud s,
        DescriptorDeCatalogo<TItem, TFicha> d, List<TItem> todos, TItem? actual)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        var e = new Dictionary<string, string[]>();
        var nombre = Limpiar(s.Nombre);
        if (nombre is null) e["nombre"] = ["El nombre es obligatorio."];
        else if (nombre.Length > MaxNombre) e["nombre"] = [$"El nombre admite hasta {MaxNombre} caracteres."];
        if (s.Orden is { } o && (o < 1 || o > MaxOrden)) e["orden"] = [$"El orden va de 1 a {MaxOrden}."];
        Largo(e, "definicionBreve", s.DefinicionBreve, MaxDefinicionBreve, "La definición breve");
        Largo(e, "definicionAmpliada", s.DefinicionAmpliada, MaxDefinicionAmpliada, "La ficha ampliada");
        Largo(e, "caracteristicas", s.Caracteristicas, MaxTextoDeFicha, "Las características");
        Largo(e, "relacionTerritorial", s.RelacionTerritorial, MaxTextoDeFicha, "La relación territorial");
        Largo(e, "contextos", s.Contextos, MaxTextoDeFicha, "Los contextos");
        Largo(e, "ejemplos", s.Ejemplos, MaxTextoDeFicha, "Los ejemplos");
        Largo(e, "fuentes", s.Fuentes, MaxTextoDeFicha, "La fuente");
        Largo(e, "sinonimos", s.Sinonimos, MaxSinonimos, "Los sinónimos");
        Largo(e, "observaciones", s.Observaciones, MaxObservaciones, "Las observaciones");
        Largo(e, "textoAlternativoRecurso", s.TextoAlternativoRecurso, MaxTextoAlternativo, "El texto alternativo de la imagen");
        if (s.ImagenArchivoId is not null && string.IsNullOrWhiteSpace(s.TextoAlternativoRecurso))
            e["textoAlternativoRecurso"] = ["Una imagen necesita su texto alternativo."];

        if (s.PadreId is { } padre)
        {
            if (d.FijarPadre is null) e["padreId"] = ["Este catálogo no admite jerarquía."];
            else if (actual is not null && padre == actual.Id) e["padreId"] = ["Un elemento no puede ser su propio principal."];
            else
            {
                var principal = todos.FirstOrDefault(x => x.Id == padre);
                if (principal is null) e["padreId"] = ["El elemento principal no existe."];
                else if (d.Padre(principal) is not null) e["padreId"] = ["Solo se admiten dos niveles: el principal elegido ya es subelemento de otro."];
                else if (actual is not null && todos.Any(x => d.Padre(x) == actual.Id))
                    e["padreId"] = ["Tiene subelementos: no puede pasar a ser subelemento de otro."];
            }
        }
        return e;
    }

    private static void Largo(Dictionary<string, string[]> e, string campo, string? valor, int max, string rotulo)
    {
        if (valor is not null && valor.Trim().Length > max) e[campo] = [$"{rotulo} admite hasta {max} caracteres."];
    }

    /// <summary>Si otro elemento ya se llama igual (sin tildes ni mayúsculas) o tiene la misma dirección.</summary>
    internal static string? Choque<TItem>(List<TItem> todos, int? propio, string nombre, string slug) where TItem : IElementoDeCatalogo
    {
        var normal = ReglasDeNoticias.SlugDesde(nombre);
        foreach (var x in todos.Where(x => x.Id != propio))
        {
            if (string.Equals(x.Nombre, nombre, StringComparison.OrdinalIgnoreCase) || ReglasDeNoticias.SlugDesde(x.Nombre) == normal)
                return $"«{x.Nombre}» ya existe con un nombre equivalente.";
            if (x.Slug == slug) return $"La dirección «{slug}» ya la usa «{x.Nombre}».";
        }
        return null;
    }

    internal static string? Limpiar(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        var texto = valor.Replace("\r\n", "\n").Replace('\r', '\n').Trim();
        var limpio = new string(texto.Where(c => c == '\n' || c == '\t' || !char.IsControl(c)).ToArray());
        return limpio.Length == 0 ? null : limpio;
    }

    /// <summary>Los sinónimos se guardan separados por «;», sin vacíos ni repetidos.</summary>
    internal static string? LimpiarSinonimos(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        var partes = valor.Split([';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        return partes.Count == 0 ? null : string.Join("; ", partes);
    }

    // ─────────────────────────── Auditoría ───────────────────────────

    private static Dictionary<string, string?> Instantanea<TItem, TFicha>(TItem x, TFicha? f, DescriptorDeCatalogo<TItem, TFicha> d)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new()
    {
        static string? Corto(string? t) => t is null ? null : t.Length <= 200 ? t : t[..200] + "…";
        var v = new Dictionary<string, string?>
        {
            ["nombre"] = x.Nombre,
            ["orden"] = x.Orden.ToString(CultureInfo.InvariantCulture),
            ["activo"] = x.Activo ? "sí" : "no",
            ["sinonimos"] = x.Sinonimos,
            ["observaciones"] = Corto(x.Observaciones),
        };
        if (d.Padre(x) is { } p) v["principal"] = p.ToString(CultureInfo.InvariantCulture);
        if (f is not null)
        {
            v["definicionBreve"] = Corto(f.DefinicionBreve);
            v["fichaAmpliada"] = Corto(f.DefinicionAmpliada);
            v["caracteristicas"] = Corto(f.Caracteristicas);
            if (d.Relacion?.Invoke(f) is { } r) v["relacionTerritorial"] = Corto(r);
            v["contextos"] = Corto(f.Contextos);
            v["ejemplos"] = Corto(f.Ejemplos);
            v["fuentes"] = Corto(f.Fuentes);
            v["preliminar"] = f.EsPreliminar ? "sí" : "no";
            v["imagen"] = f.ImagenArchivoId?.ToString(CultureInfo.InvariantCulture);
        }
        return v;
    }

    private static int Actor(ClaimsPrincipal quien) =>
        int.TryParse(quien.FindFirstValue(ClaimTypes.NameIdentifier), CultureInfo.InvariantCulture, out var id) ? id : 0;

    private static void Auditar<TItem, TFicha>(SimusDbContext db, ClaimsPrincipal quien, DescriptorDeCatalogo<TItem, TFicha> d,
        int id, string accion, object? antes, object? despues)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new() =>
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = Actor(quien) is var a && a > 0 ? a : null,
            TableName = d.TablaDeAuditoria,
            RecordId = id.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            PreviousValuesJson = antes is null ? null : JsonSerializer.Serialize(antes),
            NewValuesJson = despues is null ? null : JsonSerializer.Serialize(despues),
            CreatedAt = DateTime.UtcNow,
        });

    internal static void AuditarDesdeImportacion<TItem, TFicha>(SimusDbContext db, ClaimsPrincipal quien,
        DescriptorDeCatalogo<TItem, TFicha> d, TItem fila, TFicha? ficha, string accion, object? antes)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new() =>
        Auditar(db, quien, d, fila.Id, accion, antes, Instantanea(fila, ficha, d));

    internal static Dictionary<string, string?> InstantaneaPublica<TItem, TFicha>(TItem x, TFicha? f, DescriptorDeCatalogo<TItem, TFicha> d)
        where TItem : class, IElementoDeCatalogo, new() where TFicha : class, IFichaDeCatalogo, new() => Instantanea(x, f, d);
}
