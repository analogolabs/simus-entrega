using Microsoft.EntityFrameworkCore;
using SIMUS.Infrastructure.Data;
namespace SIMUS.Api.Endpoints;

public static class PracticasMusicalesPublicasEndpoints
{
    public static RouteGroupBuilder MapPracticasMusicalesPublicasEndpoints(this RouteGroupBuilder group)
    {
        var publico = group.MapGroup("/publico/practicas-musicales").WithTags("practicas-musicales");
        publico.MapGet("", async (SimusDbContext db, CancellationToken ct) => Results.Ok(await Consulta(db).ToListAsync(ct))).AllowAnonymous().CacheaLecturaPublica();
        publico.MapGet("/{slug}", async (string slug, SimusDbContext db, CancellationToken ct) =>
        { var ficha = (await Consulta(db).ToListAsync(ct)).SingleOrDefault(x => x.Slug == slug); return ficha is null ? Results.NotFound() : Results.Ok(ficha); }).AllowAnonymous().CacheaLecturaPublica();
        return group;
    }
    /// <summary>
    /// Solo lo ACTIVO: un elemento desactivado desde «Catálogos» deja de ofrecerse en los formularios y en el portal
    /// (sigue en los registros que ya lo tenían). Sin ficha escrita se usa la descripción corta histórica del catálogo.
    /// </summary>
    private static IQueryable<FichaPracticaMusicalPublica> Consulta(SimusDbContext db) =>
        from practica in db.PracticasMusicales.AsNoTracking()
        where practica.Activo
        join ficha in db.FichasConceptualesPracticasMusicales.AsNoTracking() on practica.Id equals ficha.PracticaMusicalId into fichas
        from ficha in fichas.DefaultIfEmpty()
        orderby practica.Orden, practica.Nombre
        select new FichaPracticaMusicalPublica(practica.Id, practica.Nombre, practica.Slug, practica.Orden,
            ficha == null ? practica.Descripcion : (ficha.DefinicionBreve ?? practica.Descripcion), ficha == null ? null : ficha.DefinicionAmpliada,
            ficha == null ? null : ficha.DescripcionConceptual, ficha == null ? null : ficha.Caracteristicas,
            ficha == null ? null : ficha.Contextos, ficha == null ? null : ficha.Ejemplos, ficha == null ? null : ficha.Fuentes,
            ficha == null ? null : (ficha.ImagenArchivoId != null ? "/api/v1/publico/archivos/" + ficha.ImagenArchivoId : ficha.RecursoVisualUrl),
            ficha == null ? null : ficha.TextoAlternativoRecurso)
        {
            EsPreliminar = ficha != null && ficha.EsPreliminar,
            Sinonimos = practica.Sinonimos,
            PadreId = practica.PracticaPadreId,
        };
}
public sealed record FichaPracticaMusicalPublica(int Id, string Nombre, string Slug, int Orden, string? DefinicionBreve,
    string? DefinicionAmpliada, string? DescripcionConceptual, string? Caracteristicas, string? Contextos, string? Ejemplos,
    string? Fuentes, string? RecursoVisualUrl, string? TextoAlternativoRecurso)
{
    /// <summary>La definición es un borrador: el portal la rotula «Definición preliminar».</summary>
    public bool EsPreliminar { get; init; }
    /// <summary>Sinónimos separados por «;», para la búsqueda del portal.</summary>
    public string? Sinonimos { get; init; }
    /// <summary>La práctica principal de la que esta es subcategoría, si la tiene.</summary>
    public int? PadreId { get; init; }
}
