using Microsoft.EntityFrameworkCore;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>Consulta pública de la capa conceptual. No inventa contenido: expone los espacios ya creados.</summary>
public static class TerritoriosSonorosPublicosEndpoints
{
    public static RouteGroupBuilder MapTerritoriosSonorosPublicosEndpoints(this RouteGroupBuilder group)
    {
        var publico = group.MapGroup("/publico/territorios-sonoros").WithTags("territorios-sonoros");
        publico.MapGet("", async (SimusDbContext db, CancellationToken ct) =>
            Results.Ok(await Consulta(db).ToListAsync(ct))).AllowAnonymous().CacheaLecturaPublica();
        publico.MapGet("/{slug}", async (string slug, SimusDbContext db, CancellationToken ct) =>
        {
            var ficha = (await Consulta(db).ToListAsync(ct)).SingleOrDefault(x => x.Slug == slug);
            return ficha is null ? Results.NotFound() : Results.Ok(ficha);
        }).AllowAnonymous().CacheaLecturaPublica();
        return group;
    }

    /// <summary>Solo lo ACTIVO (ver «Catálogos» en la consola); sin ficha escrita usa la descripción corta histórica.</summary>
    private static IQueryable<FichaTerritorioSonoroPublica> Consulta(SimusDbContext db) =>
        from territorio in db.TerritoriosSonoros.AsNoTracking()
        where territorio.Activo
        join ficha in db.FichasConceptualesTerritoriosSonoros.AsNoTracking() on territorio.Id equals ficha.TerritorioSonoroId into fichas
        from ficha in fichas.DefaultIfEmpty()
        orderby territorio.Orden, territorio.Nombre
        select new FichaTerritorioSonoroPublica(territorio.Id, territorio.Nombre, territorio.Slug, territorio.Orden,
            ficha == null ? territorio.Descripcion : (ficha.DefinicionBreve ?? territorio.Descripcion), ficha == null ? null : ficha.DefinicionAmpliada,
            ficha == null ? null : ficha.DescripcionConceptual, ficha == null ? null : ficha.Caracteristicas,
            ficha == null ? null : ficha.RelacionTerritorial, ficha == null ? null : ficha.Contextos,
            ficha == null ? null : ficha.Ejemplos, ficha == null ? null : ficha.Fuentes,
            ficha == null ? null : (ficha.ImagenArchivoId != null ? "/api/v1/publico/archivos/" + ficha.ImagenArchivoId : ficha.RecursoVisualUrl),
            ficha == null ? null : ficha.TextoAlternativoRecurso)
        {
            EsPreliminar = ficha != null && ficha.EsPreliminar,
            Sinonimos = territorio.Sinonimos,
        };
}

public sealed record FichaTerritorioSonoroPublica(int Id, string Nombre, string Slug, int Orden,
    string? DefinicionBreve, string? DefinicionAmpliada, string? DescripcionConceptual,
    string? Caracteristicas, string? RelacionTerritorial, string? Contextos, string? Ejemplos,
    string? Fuentes, string? RecursoVisualUrl, string? TextoAlternativoRecurso)
{
    /// <summary>La definición es un borrador: el portal la rotula «Definición preliminar».</summary>
    public bool EsPreliminar { get; init; }
    /// <summary>Sinónimos separados por «;», para la búsqueda del portal.</summary>
    public string? Sinonimos { get; init; }
}
