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
/// Catálogos propios por módulo, administrados en una misma tabla.
/// Noticias y agenda usan exclusivamente sus listas. Editorial mantiene el
/// soporte de categorías comunes durante la revisión de su acervo.
/// </summary>
public static class CategoriasDeContenidoEndpoints
{
    /// <summary>Los módulos que pueden tener categorías propias, más el compartido.</summary>
    public static readonly string[] ModulosValidos = ["agenda", "noticias", "editorial", "comun"];

    private static readonly string[] JerarquiaEnUso = ["No puede cambiarse de nivel una categoría en uso ni retirar una categoría con subcategorías."];
    private static readonly string[] PadreInvalido = ["Seleccione una categoría principal de editorial; solo se admiten dos niveles."];
    private const string ModuloComun = "comun";
    private static readonly string[] ModuloInexistente = ["El módulo solicitado no existe."];
    private static readonly string[] FusionIncompatible = ["La fusión debe conservar el módulo del catálogo."];
    private static readonly string[] UsoIncompatible = ["El cambio dejaría contenido con una categoría de otro módulo."];

    private static readonly string[] NombreObligatorio = ["El nombre de la categoría es obligatorio."];
    private static readonly string[] OrdenPositivo = ["El orden de visualización empieza en 1."];
    private static readonly string[] EnUso =
        ["Esta categoría está en uso y no se puede eliminar. Fusiónala con otra o deja de usarla primero."];
    private static readonly string[] MismaCategoria = ["Una categoría no se puede fusionar consigo misma."];
    private static readonly string[] DestinoDesconocido = ["La categoría que va a absorber el contenido no existe."];

    public static RouteGroupBuilder MapCategoriasDeContenidoEndpoints(this RouteGroupBuilder api)
    {
        // ANONIMA A PROPOSITO: el portal construye con ellas sus barras de filtro antes de que
        // exista sesión, y no expone más que el nombre de una categoría publicada.
        var publico = api.MapGroup("/publico/categorias-contenido").WithTags("categorias-publico").AllowAnonymous();
        publico.MapGet(string.Empty, Listar).WithName("ListarCategoriasPublicas");

        var consola = api.MapGroup("/institucional/categorias-contenido")
            .WithTags("categorias")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("categorias");
        consola.MapGet(string.Empty, Listar).WithName("ListarCategorias");
        consola.MapPost(string.Empty, Crear).WithName("CrearCategoria");
        consola.MapPut("/{id:int}", Guardar).WithName("GuardarCategoria");
        consola.MapDelete("/{id:int}", Eliminar).WithName("EliminarCategoria");
        consola.MapPost("/{id:int}/fusionar", Fusionar).WithName("FusionarCategoria");
        return api;
    }

    /// <summary>
    /// Las categorías de un módulo, o todas.
    /// </summary>
    private static async Task<IResult> Listar(SimusDbContext db, string? modulo, CancellationToken ct)
    {
        var consulta = db.Categorias.AsNoTracking();

        var pedido = (modulo ?? string.Empty).Trim().ToLowerInvariant();
        if (pedido.Length > 0 && pedido != "todos")
        {
            if (!ModulosValidos.Contains(pedido))
                return Results.BadRequest(new { modulo = ModuloInexistente });
            consulta = consulta.Where(c => c.CodigoModulo == pedido
                || (pedido == "editorial" && c.CodigoModulo == ModuloComun));
        }

        var filas = await consulta
            .OrderBy(c => c.CodigoModulo)
            .ThenBy(c => c.OrdenVisualizacion)
            .ToListAsync(ct);

        var usos = await ContarUsosAsync(db, ct);
        var items = filas.Select(c => new CategoriaDeContenidoDto(
            c.Id, c.CodigoModulo, c.NombreCategoria, c.Slug, c.Descripcion, c.OrdenVisualizacion,
            usos.GetValueOrDefault(c.Id)) { CategoriaPadreId = c.CategoriaPadreId }).ToList();

        return Results.Ok(new { items, total = items.Count });
    }

    private static async Task<IResult> Crear(
        SimusDbContext db, ClaimsPrincipal principal, GuardarCategoriaSolicitud solicitud, CancellationToken ct)
    {
        var validacion = Validar(solicitud, out var modulo, out var nombre, out var slug);
        if (validacion is not null) return validacion;
        var jerarquia = await ValidarJerarquiaAsync(db, solicitud.CategoriaPadreId, modulo, ct);
        if (jerarquia is not null) return jerarquia;

        if (await db.Categorias.AnyAsync(c => c.CodigoModulo == modulo && (c.NombreCategoria == nombre || c.Slug == slug), ct))
        {
            return Results.Conflict(new { nombre = new[] { $"«{nombre}» ya existe en {modulo}." } });
        }

        // EL ORDEN POR OMISION VA AL FINAL, que es donde espera aparecer algo recién creado. Pedirlo
        // a mano en el alta obligaría a saber cuántas hay antes de escribir la primera letra.
        var orden = solicitud.OrdenVisualizacion ?? await SiguienteOrdenAsync(db, modulo, ct);

        var fila = new CategoriaRow
        {
            CategoriaPadreId = solicitud.CategoriaPadreId,
            CodigoModulo = modulo,
            NombreCategoria = nombre,
            Slug = slug,
            Descripcion = Limpiar(solicitud.Descripcion),
            OrdenVisualizacion = orden,
        };

        db.Categorias.Add(fila);
        Auditar(db, Actor(principal), fila, "crear", null);
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/institucional/categorias-contenido/{fila.Id.ToString(CultureInfo.InvariantCulture)}", ADto(fila));
    }

    private static async Task<IResult> Guardar(
        SimusDbContext db, ClaimsPrincipal principal, int id, GuardarCategoriaSolicitud solicitud, CancellationToken ct)
    {
        if (solicitud.CategoriaPadreId == id) return Results.BadRequest(new { categoriaPadreId = PadreInvalido });
        var fila = await db.Categorias.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (fila is null) return Results.NotFound();

        var validacion = Validar(solicitud, out var modulo, out var nombre, out var slug);
        if (validacion is not null) return validacion;
        var jerarquia = await ValidarJerarquiaAsync(db, solicitud.CategoriaPadreId, modulo, ct);
        if (jerarquia is not null) return jerarquia;

        if (await db.Categorias.AnyAsync(c => c.Id != id && c.CodigoModulo == modulo && (c.NombreCategoria == nombre || c.Slug == slug), ct))
        {
            return Results.Conflict(new { nombre = new[] { $"«{nombre}» ya existe en {modulo}." } });
        }

        if (fila.CategoriaPadreId != solicitud.CategoriaPadreId
            && (await db.PublicacionesEditoriales.AnyAsync(p => p.CategoriaId == id || p.SubcategoriaEditorialId == id, ct)
                || await db.Categorias.AnyAsync(c => c.CategoriaPadreId == id, ct)))
            return Results.BadRequest(new { categoriaPadreId = JerarquiaEnUso });
        if (await db.Categorias.AnyAsync(c => c.CategoriaPadreId == id, ct) && modulo != "editorial")
            return Results.BadRequest(new { codigoModulo = JerarquiaEnUso });
        var incompatible = await ComprobarUsosAsync(db, id, modulo, ct);
        if (incompatible is not null) return incompatible;

        var antes = new { fila.CodigoModulo, fila.NombreCategoria, fila.OrdenVisualizacion };

        // RENOMBRAR ARRASTRA A TODO LO QUE LA USA, y es justamente para lo que existe este catálogo:
        // corregir un nombre mal escrito sin abrir una por una las fichas que lo llevaban.
        fila.CategoriaPadreId = solicitud.CategoriaPadreId;
        fila.CodigoModulo = modulo;
        fila.NombreCategoria = nombre;
        fila.Slug = slug;
        fila.Descripcion = Limpiar(solicitud.Descripcion);
        fila.OrdenVisualizacion = solicitud.OrdenVisualizacion ?? fila.OrdenVisualizacion;

        Auditar(db, Actor(principal), fila, "actualizar", antes);
        await db.SaveChangesAsync(ct);

        return Results.Ok(ADto(fila));
    }

    /// <summary>
    /// Elimina una categoría que no esté en uso.
    /// </summary>
    /// <remarks>
    /// NO SE BORRA LO QUE ALGUIEN ESTA USANDO. La foránea lo impediría igual, pero con un error de
    /// base de datos que no explica nada; aquí se dice qué hacer: renombrarla o dejar de usarla.
    /// </remarks>
    private static async Task<IResult> Eliminar(
        SimusDbContext db, ClaimsPrincipal principal, int id, CancellationToken ct)
    {
        var fila = await db.Categorias.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (fila is null) return Results.NotFound();

        var enUso = await db.Noticias.AnyAsync(x => x.CategoriaId == id, ct)
            || await db.EventosAgenda.AnyAsync(x => x.CategoriaId == id, ct)
            || await db.PublicacionesEditoriales.AnyAsync(x => x.CategoriaId == id || x.SubcategoriaEditorialId == id, ct)
            || await db.Categorias.AnyAsync(x => x.CategoriaPadreId == id, ct);

        if (enUso) return Results.BadRequest(new { categoria = EnUso });

        Auditar(db, Actor(principal), fila, "eliminar", new { fila.CodigoModulo, fila.NombreCategoria });
        db.Categorias.Remove(fila);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    // ─────────────────────────── Ayudas ───────────────────────────

    private static IResult? Validar(
        GuardarCategoriaSolicitud solicitud, out string modulo, out string nombre, out string slug)
    {
        modulo = (Limpiar(solicitud.CodigoModulo) ?? string.Empty).ToLowerInvariant();
        nombre = Limpiar(solicitud.NombreCategoria) ?? string.Empty;
        slug = ReglasDeNoticias.SlugDesde(Limpiar(solicitud.Slug) is { Length: > 0 } pedido ? pedido : nombre);

        if (nombre.Length == 0) return Results.BadRequest(new { nombreCategoria = NombreObligatorio });
        if (!ModulosValidos.Contains(modulo))
        {
            return Results.BadRequest(new
            {
                codigoModulo = new[] { $"«{modulo}» no es un módulo de categorías. Son: {string.Join(", ", ModulosValidos)}." },
            });
        }
        if (slug.Length == 0) return Results.BadRequest(new { nombreCategoria = NombreObligatorio });
        if (solicitud.OrdenVisualizacion is { } orden && orden <= 0) return Results.BadRequest(new { ordenVisualizacion = OrdenPositivo });

        return null;
    }

    private static async Task<int> SiguienteOrdenAsync(SimusDbContext db, string modulo, CancellationToken ct)
    {
        var maximo = await db.Categorias.Where(c => c.CodigoModulo == modulo)
            .Select(c => (int?)c.OrdenVisualizacion).MaxAsync(ct);
        return (maximo ?? 0) + 1;
    }

    private static CategoriaDeContenidoDto ADto(CategoriaRow fila, int usos = 0) => new(
        fila.Id, fila.CodigoModulo, fila.NombreCategoria, fila.Slug, fila.Descripcion, fila.OrdenVisualizacion, usos) { CategoriaPadreId = fila.CategoriaPadreId };

    /// <summary>
    /// Cuántos contenidos usa cada categoría, en tres consultas.
    /// </summary>
    /// <remarks>
    /// <para>
    /// ES LO QUE PERMITE DECIDIR entre categorías propias de cada módulo y categorías comunes. Sin
    /// la cifra, esa elección es una discusión sin datos; con ella se ve cuál se está usando en dos
    /// sitios y merece compartirse, y cuál está vacía y sobra.
    /// </para>
    /// <para>
    /// TRES CONSULTAS Y NO UNA POR CATEGORIA: la alternativa, con una docena de categorías, son una
    /// docena de viajes a la base para pintar una pantalla de administración.
    /// </para>
    /// </remarks>
    private static async Task<Dictionary<int, int>> ContarUsosAsync(SimusDbContext db, CancellationToken ct)
    {
        var conteos = new Dictionary<int, int>();

        void Sumar(IEnumerable<KeyValuePair<int, int>> parciales)
        {
            foreach (var (categoria, total) in parciales)
            {
                conteos[categoria] = conteos.GetValueOrDefault(categoria) + total;
            }
        }

        Sumar(await db.Noticias.AsNoTracking().Where(x => x.CategoriaId != null)
            .GroupBy(x => x.CategoriaId!.Value).Select(g => new { g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Total, ct));
        Sumar(await db.EventosAgenda.AsNoTracking().Where(x => x.CategoriaId != null)
            .GroupBy(x => x.CategoriaId!.Value).Select(g => new { g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Total, ct));
        Sumar(await db.PublicacionesEditoriales.AsNoTracking().Where(x => x.CategoriaId != null)
            .GroupBy(x => x.CategoriaId!.Value).Select(g => new { g.Key, Total = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Total, ct));

        Sumar(await db.PublicacionesEditoriales.AsNoTracking().Where(x => x.SubcategoriaEditorialId != null)
            .GroupBy(x => x.SubcategoriaEditorialId!.Value).Select(g => new { g.Key, Total = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Total, ct));
        return conteos;
    }

    /// <summary>
    /// Pasa todo el contenido de una categoría a otra y retira la que queda vacía.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>ES LO QUE HACE REVERSIBLE LA DECISION.</b> Hasta ahora una categoría en uso no se podía
    /// retirar —borrarla dejaría fichas apuntando a nada— y renombrarla no sirve cuando el problema
    /// es que hay dos que significan lo mismo. Sin fusionar, elegir mal entre categorías propias y
    /// comunes era una decisión definitiva: había que reasignar a mano ficha por ficha.
    /// </para>
    /// <para>
    /// TODO EN UNA TRANSACCION. Si la reasignación se hiciera a medias y el borrado sí, quedaría
    /// contenido apuntando a una categoría que ya no existe.
    /// </para>
    /// </remarks>
    private static async Task<IResult> Fusionar(
        SimusDbContext db, ClaimsPrincipal principal, int id, FusionarCategoriaSolicitud solicitud, CancellationToken ct)
    {
        var origen = await db.Categorias.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (origen is null) return Results.NotFound();

        if (solicitud.DestinoId == id)
        {
            return Results.BadRequest(new { destinoId = MismaCategoria });
        }

        var destino = await db.Categorias.FirstOrDefaultAsync(c => c.Id == solicitud.DestinoId, ct);
        if (destino is null) return Results.BadRequest(new { destinoId = DestinoDesconocido });

        if (origen.CategoriaPadreId != destino.CategoriaPadreId
            || await db.Categorias.AnyAsync(c => c.CategoriaPadreId == id, ct))
            return Results.BadRequest(new { destinoId = JerarquiaEnUso });
        // No reasignar contenido a una categoría que su formulario no puede elegir.
        if (origen.CodigoModulo != destino.CodigoModulo
            && !(origen.CodigoModulo == "editorial" && destino.CodigoModulo == ModuloComun)
            && !(origen.CodigoModulo == ModuloComun && destino.CodigoModulo == "editorial"))
            return Results.BadRequest(new { destinoId = FusionIncompatible });
        var incompatible = await ComprobarUsosAsync(db, id, destino.CodigoModulo, ct);
        if (incompatible is not null) return incompatible;

        var estrategia = db.Database.CreateExecutionStrategy();
        await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);

            foreach (var noticia in await db.Noticias.Where(x => x.CategoriaId == id).ToListAsync(ct))
            {
                noticia.CategoriaId = destino.Id;
            }
            foreach (var evento in await db.EventosAgenda.Where(x => x.CategoriaId == id).ToListAsync(ct))
            {
                evento.CategoriaId = destino.Id;
            }
            foreach (var publicacion in await db.PublicacionesEditoriales.Where(x => x.CategoriaId == id || x.SubcategoriaEditorialId == id).ToListAsync(ct))
            {
                if (publicacion.CategoriaId == id) publicacion.CategoriaId = destino.Id;
                if (publicacion.SubcategoriaEditorialId == id) publicacion.SubcategoriaEditorialId = destino.Id;
            }

            db.Categorias.Remove(origen);
            Auditar(db, Actor(principal), destino, "actualizar", new { fusionada = origen.NombreCategoria });
            await db.SaveChangesAsync(ct);
            await transaccion.CommitAsync(ct);
        });

        var usos = await ContarUsosAsync(db, ct);
        return Results.Ok(ADto(destino, usos.GetValueOrDefault(destino.Id)));
    }

    private static async Task<IResult?> ValidarJerarquiaAsync(SimusDbContext db, int? padreId, string modulo, CancellationToken ct)
    {
        if (padreId is null) return null;
        if (modulo != "editorial" || !await db.Categorias.AsNoTracking()
            .AnyAsync(c => c.Id == padreId && c.CodigoModulo == "editorial" && c.CategoriaPadreId == null, ct))
            return Results.BadRequest(new { categoriaPadreId = PadreInvalido });
        return null;
    }

    private static async Task<IResult?> ComprobarUsosAsync(
        SimusDbContext db, int id, string modulo, CancellationToken ct)
    {
        if ((modulo != "noticias" && await db.Noticias.AnyAsync(x => x.CategoriaId == id, ct))
            || (modulo != "agenda" && await db.EventosAgenda.AnyAsync(x => x.CategoriaId == id, ct))
            || (modulo != "editorial"
                && await db.PublicacionesEditoriales.AnyAsync(x => x.CategoriaId == id || x.SubcategoriaEditorialId == id, ct)))
            return Results.BadRequest(new { codigoModulo = UsoIncompatible });
        return null;
    }

    private static string? Limpiar(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static int Actor(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), CultureInfo.InvariantCulture, out var id) ? id : 0;

    private static void Auditar(SimusDbContext db, int actor, CategoriaRow fila, string accion, object? antes) =>
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = actor,
            TableName = "Categorias",
            RecordId = fila.Id.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            PreviousValuesJson = antes is null ? null : JsonSerializer.Serialize(antes),
            NewValuesJson = JsonSerializer.Serialize(new { fila.CodigoModulo, fila.NombreCategoria, fila.OrdenVisualizacion }),
            CreatedAt = DateTime.UtcNow,
        });
}
