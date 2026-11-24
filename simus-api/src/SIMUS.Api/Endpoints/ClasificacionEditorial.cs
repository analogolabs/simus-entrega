using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
namespace SIMUS.Api.Endpoints;

internal static class ClasificacionEditorial
{
    private static readonly string[] CategoriaRaiz = ["Seleccione una categoría principal de editorial."];
    private static readonly string[] SubcategoriaInvalida = ["La subcategoría debe pertenecer a la categoría editorial seleccionada."];
    public static async Task<IResult?> ValidarAsync(SimusDbContext db, int? categoriaId, int? subcategoriaId, CancellationToken ct)
    {
        if (categoriaId is null)
            return subcategoriaId is null ? null : Results.BadRequest(new { subcategoriaEditorialId = SubcategoriaInvalida });
        var categoria = await db.Categorias.AsNoTracking().FirstOrDefaultAsync(c => c.Id == categoriaId, ct);
        if (categoria is null || categoria.CodigoModulo != "editorial" || categoria.CategoriaPadreId is not null)
            return Results.BadRequest(new { categoriaId = CategoriaRaiz });
        if (subcategoriaId is not null && !await db.Categorias.AsNoTracking()
            .AnyAsync(c => c.Id == subcategoriaId && c.CodigoModulo == "editorial" && c.CategoriaPadreId == categoriaId, ct))
            return Results.BadRequest(new { subcategoriaEditorialId = SubcategoriaInvalida });
        return null;
    }

    // Los textos históricos se leen como referencia, nunca se recalculan al normalizar.
    public sealed record Lectura(string? Categoria, string? Subcategoria, string? Ruta, string? Practicas);
    public static async Task<Lectura> LeerAsync(SimusDbContext db, PublicacionEditorialRow fila, CancellationToken ct)
    {
        var categoria = fila.CategoriaId is null ? null : await db.Categorias.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == fila.CategoriaId, ct);
        var subcategoria = fila.SubcategoriaEditorialId is null ? null : await db.Categorias.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == fila.SubcategoriaEditorialId, ct);
        var practicas = await db.PublicacionesEditorialesPracticasMusicales.AsNoTracking()
            .Where(p => p.PublicacionEditorialId == fila.Id)
            .Join(db.PracticasMusicales.AsNoTracking(), p => p.PracticaMusicalId, m => m.Id, (p,m) => m.Nombre)
            .OrderBy(n => n).ToListAsync(ct);
        var nombre = categoria?.NombreCategoria;
        var sub = subcategoria?.NombreCategoria;
        return new Lectura(nombre, sub, nombre is null ? null : sub is null ? nombre : nombre + " > " + sub,
            practicas.Count == 0 ? null : string.Join(" · ", practicas));
    }
}
