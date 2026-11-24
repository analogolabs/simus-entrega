using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La administración de la taxonomía de perfiles de personas (roles, servicios, instrumentos) desde el Catálogo de la consola
/// (decisión 133, DIR). La lectura pública vive en <see cref="DirectorioDePersonasEndpoints"/>.
/// </summary>
/// <remarks>
/// <para>
/// <b>NO SE BORRA, SE DESACTIVA.</b> Un valor desactivado deja de ofrecerse al elegir, pero los perfiles que ya lo tienen
/// lo conservan y su nombre se sigue resolviendo. Por eso no hay <c>DELETE</c>: el código es estable y nunca se reutiliza.
/// </para>
/// <para>
/// <b>EL CÓDIGO SALE DEL NOMBRE Y NO CAMBIA AL RENOMBRAR.</b> Es lo que los perfiles guardan y lo que lleva la URL del
/// directorio; renombrar corrige el texto sin tocar a nadie.
/// </para>
/// </remarks>
public static class TaxonomiaDePerfilesEndpoints
{
    private static readonly string[] Grupos = ["creador", "gestor", "otro"];
    private static readonly string[] NombreObligatorio = ["El nombre es obligatorio."];
    private static readonly string[] NombreLargo = ["El nombre admite hasta 120 caracteres."];
    private static readonly string[] NombreRepetido = ["Ya existe un valor con ese nombre en esta lista."];
    private static readonly string[] CodigoRepetido = ["Ya existe un valor con un código equivalente en esta lista."];
    private static readonly string[] DimensionInvalida = ["Elige si es un rol, un servicio o un instrumento."];
    private static readonly string[] GrupoInvalido = ["El grupo debe ser creador, gestor u otro."];
    private static readonly string[] SentidoInvalido = ["El sentido es -1 (subir) o 1 (bajar)."];
    private static readonly string[] PadreInvalido = ["La categoría debe ser un rol que no sea subcategoría."];
    private static readonly string[] PadreFueraDeLaDimension = ["Solo los roles tienen categorías y subcategorías."];
    private static readonly string[] PadreEsHija = ["Una categoría con subcategorías no puede pasar a ser subcategoría."];
    private static readonly string[] FuenteLarga = ["La fuente admite hasta 200 caracteres."];

    public static RouteGroupBuilder MapTaxonomiaDePerfilesEndpoints(this RouteGroupBuilder api)
    {
        var consola = api.MapGroup("/institucional/taxonomia-de-perfiles")
            .WithTags("taxonomia-de-perfiles")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("categorias");
        consola.MapGet(string.Empty, Listar).WithName("ListarValoresDeTaxonomiaDePerfiles");
        consola.MapPost(string.Empty, Crear).WithName("CrearValorDeTaxonomiaDePerfiles");
        consola.MapPut("/{id:int}", Guardar).WithName("GuardarValorDeTaxonomiaDePerfiles");
        consola.MapPost("/{id:int}/categoria", CambiarDeCategoria).WithName("CambiarDeCategoriaValorDeTaxonomiaDePerfiles");
        consola.MapPost("/{id:int}/mover", Mover).WithName("MoverValorDeTaxonomiaDePerfiles");
        return api;
    }

    private static async Task<IResult> Listar(SimusDbContext db, CancellationToken ct)
    {
        var filas = await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking()
            .OrderBy(v => v.Dimension).ThenBy(v => v.OrdenVisualizacion).ThenBy(v => v.Nombre).ToListAsync(ct);
        var usos = (await db.PerfilesPublicosClasificaciones.AsNoTracking()
            .Where(c => c.Dimension != TaxonomiaDePerfiles.DimensionTerritorio)
            .GroupBy(c => new { c.Dimension, c.Codigo })
            .Select(g => new { g.Key.Dimension, g.Key.Codigo, Total = g.Count() })
            .ToListAsync(ct)).ToDictionary(g => (g.Dimension, g.Codigo), g => g.Total);
        var items = filas.Select(v => ADto(v, usos.GetValueOrDefault((v.Dimension, v.Codigo)), filas)).ToList();
        return Results.Ok(new
        {
            items,
            total = items.Count,
            maximos = new
            {
                rol = TaxonomiaDePerfiles.MaximoDeRoles,
                servicio = TaxonomiaDePerfiles.MaximoDeServicios,
                instrumento = TaxonomiaDePerfiles.MaximoDeInstrumentos,
            },
        });
    }

    private static async Task<IResult> Crear(
        SimusDbContext db, ClaimsPrincipal principal, GuardarValorDeTaxonomiaSolicitud solicitud, CancellationToken ct)
    {
        var dimension = (solicitud.Dimension ?? string.Empty).Trim().ToLowerInvariant();
        if (!TaxonomiaDePerfiles.DimensionesAdministrables.Contains(dimension)) return Results.BadRequest(new { dimension = DimensionInvalida });
        var errores = Validar(solicitud, dimension, out var nombre, out var grupo, out var fuente);
        if (errores is not null) return errores;

        if (await db.ValoresDeTaxonomiaDePerfiles.AnyAsync(v => v.Dimension == dimension && v.Nombre == nombre, ct))
            return Results.Conflict(new { nombre = NombreRepetido });
        var codigo = ReglasDeNoticias.SlugDesde(nombre);
        if (codigo.Length > 40) codigo = codigo[..40].TrimEnd('-');
        if (codigo.Length == 0) return Results.BadRequest(new { nombre = NombreObligatorio });
        if (await db.ValoresDeTaxonomiaDePerfiles.AnyAsync(v => v.Dimension == dimension && v.Codigo == codigo, ct))
            return Results.Conflict(new { nombre = CodigoRepetido });

        var errorDePadre = await ValidarPadreAsync(db, dimension, null, solicitud.IdPadre, ct);
        if (errorDePadre is not null) return errorDePadre;

        // EL ORDEN ES DENTRO DE LA HERMANDAD (las categorías entre sí; las subcategorías bajo su categoría).
        var siguiente = await db.ValoresDeTaxonomiaDePerfiles.Where(v => v.Dimension == dimension && v.IdPadre == solicitud.IdPadre)
            .Select(v => (int?)v.OrdenVisualizacion).MaxAsync(ct) ?? 0;
        var fila = new ValorDeTaxonomiaDePerfilesRow
        {
            Dimension = dimension, Codigo = codigo, Nombre = nombre, GrupoSoyCultura = grupo, Fuente = fuente,
            Activo = solicitud.Activo, OrdenVisualizacion = siguiente + 1, FechaCreacion = DateTime.UtcNow, IdPadre = solicitud.IdPadre,
        };
        db.ValoresDeTaxonomiaDePerfiles.Add(fila);
        await db.SaveChangesAsync(ct);
        Auditar(db, principal, fila, "crear");
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/institucional/taxonomia-de-perfiles/{fila.Id.ToString(CultureInfo.InvariantCulture)}", ADto(fila, 0, await Todas(db, ct)));
    }

    private static async Task<IResult> Guardar(
        SimusDbContext db, ClaimsPrincipal principal, int id, GuardarValorDeTaxonomiaSolicitud solicitud, CancellationToken ct)
    {
        var fila = await db.ValoresDeTaxonomiaDePerfiles.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (fila is null) return Results.NotFound();
        var errores = Validar(solicitud, fila.Dimension, out var nombre, out var grupo, out var fuente);
        if (errores is not null) return errores;
        if (await db.ValoresDeTaxonomiaDePerfiles.AnyAsync(v => v.Id != id && v.Dimension == fila.Dimension && v.Nombre == nombre, ct))
            return Results.Conflict(new { nombre = NombreRepetido });

        // LA DIMENSIÓN Y EL CÓDIGO NO CAMBIAN: los perfiles guardan el código.
        fila.Nombre = nombre;
        fila.GrupoSoyCultura = grupo;
        fila.Fuente = fuente;
        fila.Activo = solicitud.Activo;
        fila.FechaActualizacion = DateTime.UtcNow;
        Auditar(db, principal, fila, "actualizar");
        await db.SaveChangesAsync(ct);
        return Results.Ok(ADto(fila, await Usos(db, fila, ct), await Todas(db, ct)));
    }

    /// <summary>
    /// Cambia un rol de categoría (o lo vuelve categoría con <c>idPadre</c> nulo). Va aparte de <c>PUT</c> para que guardar el
    /// nombre no mueva el rol de lugar. El código no cambia: las personas que lo tienen siguen igual.
    /// </summary>
    private static async Task<IResult> CambiarDeCategoria(
        SimusDbContext db, ClaimsPrincipal principal, int id, CambiarDeCategoriaSolicitud solicitud, CancellationToken ct)
    {
        var fila = await db.ValoresDeTaxonomiaDePerfiles.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (fila is null) return Results.NotFound();
        var errorDePadre = await ValidarPadreAsync(db, fila.Dimension, fila.Id, solicitud.IdPadre, ct);
        if (errorDePadre is not null) return errorDePadre;
        if (fila.IdPadre != solicitud.IdPadre)
        {
            // Va al final de su hermandad nueva.
            fila.OrdenVisualizacion = (await db.ValoresDeTaxonomiaDePerfiles.Where(v => v.Dimension == fila.Dimension && v.IdPadre == solicitud.IdPadre)
                .Select(v => (int?)v.OrdenVisualizacion).MaxAsync(ct) ?? 0) + 1;
            fila.IdPadre = solicitud.IdPadre;
            fila.FechaActualizacion = DateTime.UtcNow;
            Auditar(db, principal, fila, "actualizar");
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok(ADto(fila, await Usos(db, fila, ct), await Todas(db, ct)));
    }

    /// <summary>Sube o baja un puesto dentro de su lista; el orden de la lista se renumera sin huecos.</summary>
    private static async Task<IResult> Mover(
        SimusDbContext db, ClaimsPrincipal principal, int id, MoverValorDeTaxonomiaSolicitud solicitud, CancellationToken ct)
    {
        var fila = await db.ValoresDeTaxonomiaDePerfiles.FirstOrDefaultAsync(v => v.Id == id, ct);
        if (fila is null) return Results.NotFound();
        if (solicitud.Sentido is not (-1 or 1)) return Results.BadRequest(new { sentido = SentidoInvalido });

        var lista = await db.ValoresDeTaxonomiaDePerfiles.Where(v => v.Dimension == fila.Dimension && v.IdPadre == fila.IdPadre)
            .OrderBy(v => v.OrdenVisualizacion).ThenBy(v => v.Nombre).ToListAsync(ct);
        var posicion = lista.FindIndex(v => v.Id == id);
        var destino = posicion + solicitud.Sentido;
        if (destino >= 0 && destino < lista.Count)
        {
            (lista[posicion], lista[destino]) = (lista[destino], lista[posicion]);
            for (var i = 0; i < lista.Count; i++)
            {
                if (lista[i].OrdenVisualizacion != i + 1)
                {
                    lista[i].OrdenVisualizacion = i + 1;
                    lista[i].FechaActualizacion = DateTime.UtcNow;
                }
            }
            Auditar(db, principal, fila, "actualizar");
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok(ADto(fila, await Usos(db, fila, ct), await Todas(db, ct)));
    }

    private static IResult? Validar(GuardarValorDeTaxonomiaSolicitud solicitud, string dimension, out string nombre, out string? grupo, out string? fuente)
    {
        nombre = (solicitud.Nombre ?? string.Empty).Trim();
        grupo = string.IsNullOrWhiteSpace(solicitud.GrupoSoyCultura) ? null : solicitud.GrupoSoyCultura.Trim().ToLowerInvariant();
        fuente = string.IsNullOrWhiteSpace(solicitud.Fuente) ? null : solicitud.Fuente.Trim();
        if (nombre.Length == 0) return Results.BadRequest(new { nombre = NombreObligatorio });
        if (nombre.Length > 120) return Results.BadRequest(new { nombre = NombreLargo });
        if (grupo is not null && (dimension != TaxonomiaDePerfiles.DimensionRol || !Grupos.Contains(grupo)))
            return Results.BadRequest(new { grupoSoyCultura = GrupoInvalido });
        if (fuente is { Length: > 200 }) return Results.BadRequest(new { fuente = FuenteLarga });
        return null;
    }

    private static async Task<List<ValorDeTaxonomiaDePerfilesRow>> Todas(SimusDbContext db, CancellationToken ct) =>
        await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking().ToListAsync(ct);

    /// <summary>
    /// Dos niveles y solo en roles: la categoría debe existir, ser de la misma dimensión y no ser ella misma subcategoría; y
    /// una categoría que ya tiene subcategorías no puede pasar a ser subcategoría.
    /// </summary>
    private static async Task<IResult?> ValidarPadreAsync(SimusDbContext db, string dimension, int? idPropio, int? idPadre, CancellationToken ct)
    {
        if (idPadre is not int padre) return null;
        if (dimension != TaxonomiaDePerfiles.DimensionRol) return Results.BadRequest(new { idPadre = PadreFueraDeLaDimension });
        var fila = await db.ValoresDeTaxonomiaDePerfiles.AsNoTracking().FirstOrDefaultAsync(v => v.Id == padre, ct);
        if (fila is null || fila.Dimension != dimension || fila.IdPadre is not null || fila.Id == idPropio)
            return Results.BadRequest(new { idPadre = PadreInvalido });
        if (idPropio is int propio && await db.ValoresDeTaxonomiaDePerfiles.AnyAsync(v => v.IdPadre == propio, ct))
            return Results.BadRequest(new { idPadre = PadreEsHija });
        return null;
    }

    private static async Task<int> Usos(SimusDbContext db, ValorDeTaxonomiaDePerfilesRow fila, CancellationToken ct) =>
        await db.PerfilesPublicosClasificaciones.CountAsync(c => c.Dimension == fila.Dimension && c.Codigo == fila.Codigo, ct);

    private static ValorDeTaxonomiaAdministradoDto ADto(ValorDeTaxonomiaDePerfilesRow v, int personas, IReadOnlyList<ValorDeTaxonomiaDePerfilesRow> todas) =>
        new(v.Id, v.Dimension, v.Codigo, v.Nombre, v.GrupoSoyCultura, v.Fuente, v.Activo, v.OrdenVisualizacion, personas,
            v.IdPadre, v.IdPadre is int p ? todas.FirstOrDefault(x => x.Id == p)?.Codigo : null, todas.Count(x => x.IdPadre == v.Id));

    private static void Auditar(SimusDbContext db, ClaimsPrincipal principal, ValorDeTaxonomiaDePerfilesRow fila, string accion) =>
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : 0,
            TableName = "ValoresDeTaxonomiaDePerfiles",
            RecordId = fila.Id.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new { fila.Dimension, fila.Codigo, fila.Nombre, fila.Activo, fila.OrdenVisualizacion, fila.IdPadre }),
            CreatedAt = DateTime.UtcNow,
        });
}
