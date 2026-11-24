using Microsoft.EntityFrameworkCore;
using SIMUS.Api.ConsultaGuiada;
using SIMUS.Api.Endpoints;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.ConsultaAbierta;

/// <summary>Una fila de una entidad pública, ya reducida a los campos del catálogo semántico.</summary>
/// <param name="Valores">campo → texto, número (<see cref="decimal"/>), fecha (<see cref="DateOnly"/>) o lista de textos si el campo es múltiple.</param>
/// <param name="Codigos">Para los campos de lugar, el código DIVIPOLA con el que se compara.</param>
/// <param name="Ruta">La ficha pública de la fila, o nulo.</param>
public sealed record FilaSemantica(IReadOnlyDictionary<string, object?> Valores, IReadOnlyDictionary<string, string?> Codigos, string? Ruta);

/// <summary>Los catálogos contra los que se resuelve lo que dice el modelo. Todos públicos.</summary>
public sealed class CatalogosSemanticos
{
    public required VocabularioTerritorial Vocabulario { get; init; }
    public required IReadOnlyDictionary<string, string> Departamentos { get; init; }
    public required IReadOnlyDictionary<string, string> Municipios { get; init; }
    public required IReadOnlyList<string> Practicas { get; init; }
    public required IReadOnlyList<string> Territorios { get; init; }
    public required IReadOnlyList<(int Id, string Nombre)> Organizaciones { get; init; }

    public static async Task<CatalogosSemanticos> CargarAsync(SimusDbContext db, CacheDivipola divipola, CancellationToken ct)
    {
        var (departamentos, municipios) = await divipola.ObtenerAsync(db, ct);
        return new CatalogosSemanticos
        {
            Vocabulario = await divipola.ObtenerVocabularioAsync(db, ct),
            Departamentos = departamentos,
            Municipios = municipios,
            Practicas = await db.PracticasMusicales.AsNoTracking().OrderBy(i => i.Nombre).Select(i => i.Nombre).ToListAsync(ct),
            Territorios = await db.TerritoriosSonoros.AsNoTracking().OrderBy(i => i.Nombre).Select(i => i.Nombre).ToListAsync(ct),
            Organizaciones = (await PerfilPublicoEndpoints.OrganizacionesPublicas(db).Select(i => new { i.Id, i.Name }).ToListAsync(ct))
                .Select(i => (i.Id, i.Name)).ToList(),
        };
    }
}

/// <summary>
/// Lee cada entidad desde las MISMAS lecturas públicas que ya usan el portal y la consulta guiada: solo publicados, sin contacto.
/// </summary>
/// <remarks>
/// No hay SQL dinámico ni texto del modelo en ninguna consulta: la lectura es fija por entidad y el resto (filtrar, agrupar,
/// ordenar) ocurre en memoria sobre filas ya leídas. El volumen público es de cientos de filas, no de millones.
/// </remarks>
public static class CargadorDeEntidades
{
    private static string Mayuscula(string texto) => char.ToUpperInvariant(texto[0]) + texto[1..];

    public static async Task<List<FilaSemantica>> CargarAsync(
        EntidadSemantica entidad, CatalogosSemanticos catalogos, SimusDbContext db, DateOnly hoy, CancellationToken ct)
    {
        string? NombreDep(string? codigo) => BancoDePreguntasPublicas.Nombre(catalogos.Departamentos, codigo);
        string? NombreMun(string? codigo) => BancoDePreguntasPublicas.Nombre(catalogos.Municipios, codigo);
        var nombresDeOrganizacion = catalogos.Organizaciones.ToDictionary(o => o.Id, o => o.Nombre);

        FilaSemantica Fila(Dictionary<string, object?> valores, Dictionary<string, string?> codigos, string? ruta) => new(valores, codigos, ruta);

        switch (entidad.Id)
        {
            case "procesos":
            {
                var festivales = await LecturaFestivalesPublicados.ConsultarAsync(db, ct);
                var procesos = await PlantillasDeConsultaPublica.ProcesosAsync(db, festivales, ct);
                return procesos.Select(p => Fila(new()
                {
                    ["nombre"] = p.Nombre,
                    ["tipo"] = Mayuscula(p.Tipo.Singular),
                    ["departamento"] = NombreDep(p.Departamento),
                    ["municipio"] = NombreMun(p.Municipio),
                    ["organizacion"] = p.OrganizacionId is { } o ? nombresDeOrganizacion.GetValueOrDefault(o) : null,
                }, new() { ["departamento"] = p.Departamento, ["municipio"] = p.Municipio }, $"{p.Tipo.Ficha}/{p.Id}")).ToList();
            }
            case "festivales":
            {
                var festivales = await LecturaFestivalesPublicados.ConsultarAsync(db, ct);
                return festivales.Select(f => Fila(new()
                {
                    ["nombre"] = f.Nombre,
                    ["departamento"] = NombreDep(f.Sede.Departamento),
                    ["municipio"] = NombreMun(f.Sede.Municipio),
                    ["organizacion"] = f.Festival.OrganizacionPrincipalId is { } o ? nombresDeOrganizacion.GetValueOrDefault(o) : null,
                    ["practica"] = f.PracticasMusicales.Select(c => c.Nombre).ToList(),
                    ["territorio"] = f.TerritoriosSonoros.Select(c => c.Nombre).ToList(),
                    ["periodicidad"] = f.Periodicidad,
                }, new() { ["departamento"] = f.Sede.Departamento, ["municipio"] = f.Sede.Municipio }, $"/ecosistema/festivales/{f.Festival.Id}")).ToList();
            }
            case "eventos":
            {
                var eventos = await PlantillasDeConsultaPublica.Publicados(db)
                    .Select(e => new
                    {
                        e.Titulo, e.Slug, e.FechaInicio, e.Modalidad, e.CodigoDepartamento, e.CodigoMunicipio,
                        Festival = e.FestivalId != null, Mercado = e.MercadoId != null, Taller = e.TallerId != null, Espacio = e.EspacioId != null, Red = e.RedId != null,
                    }).ToListAsync(ct);
                return eventos.Select(e => Fila(new()
                {
                    ["titulo"] = e.Titulo,
                    ["fecha"] = e.FechaInicio,
                    ["mes"] = (decimal)e.FechaInicio.Month,
                    ["anio"] = (decimal)e.FechaInicio.Year,
                    ["departamento"] = NombreDep(e.CodigoDepartamento),
                    ["municipio"] = NombreMun(e.CodigoMunicipio),
                    ["modalidad"] = e.Modalidad,
                    ["marco"] = e.Festival ? "Festival" : e.Mercado ? "Mercado musical" : e.Taller ? "Taller de lutería" : e.Espacio ? "Espacio para música en vivo" : e.Red ? "Red o centro de documentación" : null,
                }, new() { ["departamento"] = e.CodigoDepartamento, ["municipio"] = e.CodigoMunicipio },
                    string.IsNullOrWhiteSpace(e.Slug) ? "/agenda" : $"/agenda/{Uri.EscapeDataString(e.Slug)}")).ToList();
            }
            case "noticias":
            {
                var noticias = await db.Noticias.AsNoTracking()
                    .Where(n => n.Estado == "publicado" && n.FechaPublicacion != null && n.FechaPublicacion <= hoy)
                    .Select(n => new { n.Titulo, n.Slug, Fecha = n.FechaPublicacion!.Value }).ToListAsync(ct);
                return noticias.Select(n => Fila(new()
                {
                    ["titulo"] = n.Titulo, ["fecha"] = n.Fecha, ["mes"] = (decimal)n.Fecha.Month, ["anio"] = (decimal)n.Fecha.Year,
                }, new(), string.IsNullOrWhiteSpace(n.Slug) ? "/noticias" : $"/noticias/{Uri.EscapeDataString(n.Slug)}")).ToList();
            }
            case "organizaciones":
            {
                var festivales = await LecturaFestivalesPublicados.ConsultarAsync(db, ct);
                var procesos = await PlantillasDeConsultaPublica.ProcesosAsync(db, festivales, ct);
                var cuenta = procesos.Where(p => p.OrganizacionId != null).GroupBy(p => p.OrganizacionId!.Value).ToDictionary(g => g.Key, g => g.Count());
                return catalogos.Organizaciones.Select(o => Fila(new()
                {
                    ["nombre"] = o.Nombre, ["procesos"] = (decimal)cuenta.GetValueOrDefault(o.Id),
                }, new(), $"/ecosistema/organizaciones/{o.Id}")).ToList();
            }
            case "practicas":
            case "territorios":
            {
                var esPractica = entidad.Id == "practicas";
                var festivales = await LecturaFestivalesPublicados.ConsultarAsync(db, ct);
                var cuenta = festivales.SelectMany(f => (esPractica ? f.PracticasMusicales : f.TerritoriosSonoros).Select(c => c.Nombre))
                    .GroupBy(n => n).ToDictionary(g => g.Key, g => g.Count());
                var catalogo = esPractica
                    ? await db.PracticasMusicales.AsNoTracking().Select(i => new { i.Nombre, i.Slug }).ToListAsync(ct)
                    : await db.TerritoriosSonoros.AsNoTracking().Select(i => new { i.Nombre, i.Slug }).ToListAsync(ct);
                return catalogo.Select(i => Fila(new()
                {
                    ["nombre"] = i.Nombre, ["festivales"] = (decimal)cuenta.GetValueOrDefault(i.Nombre),
                }, new(), esPractica && !string.IsNullOrWhiteSpace(i.Slug)
                    ? $"/ecosistema/practicas-musicales/{Uri.EscapeDataString(i.Slug)}"
                    : $"/ecosistema/festivales?territorio={Uri.EscapeDataString(i.Nombre)}")).ToList();
            }
        }

        throw new InvalidOperationException("Entidad fuera del catálogo semántico.");
    }
}
