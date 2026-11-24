using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Lo que distingue a un catálogo de otro para el código común de <see cref="CatalogosEndpoints"/>: dónde viven sus filas
/// y su ficha, si admite jerarquía o relación territorial, y dónde se usa cada elemento.
/// </summary>
internal sealed class DescriptorDeCatalogo<TItem, TFicha>
    where TItem : class, IElementoDeCatalogo, new()
    where TFicha : class, IFichaDeCatalogo, new()
{
    public required string Ruta { get; init; }
    public required string TablaDeAuditoria { get; init; }
    public required Func<SimusDbContext, DbSet<TItem>> Items { get; init; }
    public required Func<SimusDbContext, DbSet<TFicha>> Fichas { get; init; }
    public required Func<TFicha, int> ClaveDeFicha { get; init; }
    public required Action<TFicha, int> FijarClave { get; init; }
    public Func<TItem, int?> Padre { get; init; } = _ => null;
    public Action<TItem, int?>? FijarPadre { get; init; }
    public Func<TFicha, string?>? Relacion { get; init; }
    public Action<TFicha, string?>? FijarRelacion { get; init; }
    public required Func<SimusDbContext, CancellationToken, Task<Dictionary<int, List<SIMUS.Contracts.UsoDeCatalogoDto>>>> Usos { get; init; }
}

internal static class Descriptores
{
    private static readonly Dictionary<string, string> EtiquetasDeModulo = new(StringComparer.Ordinal)
    {
        [Modulos.Festivales] = "Festivales",
        [Modulos.EdicionesDeFestival] = "Ediciones de festivales",
        [Modulos.Mercados] = "Mercados",
        [Modulos.EdicionesDeMercado] = "Ediciones de mercados",
        [Modulos.Talleres] = "Lutería",
        [Modulos.Espacios] = "Espacios",
        [Modulos.Redes] = "Redes",
        [Modulos.Organizaciones] = "Organizaciones",
        [Modulos.PerfilesPublicosDePersona] = "Perfiles de personas",
    };

    public static readonly DescriptorDeCatalogo<TerritorioSonoroRow, FichaConceptualTerritorioSonoroRow> Territorios = new()
    {
        Ruta = "territorios-sonoros",
        TablaDeAuditoria = "TerritoriosSonoros",
        Items = db => db.TerritoriosSonoros,
        Fichas = db => db.FichasConceptualesTerritoriosSonoros,
        ClaveDeFicha = f => f.TerritorioSonoroId,
        FijarClave = (f, id) => f.TerritorioSonoroId = id,
        Relacion = f => f.RelacionTerritorial,
        FijarRelacion = (f, v) => f.RelacionTerritorial = v,
        Usos = async (db, ct) =>
        {
            var acc = new Dictionary<int, List<SIMUS.Contracts.UsoDeCatalogoDto>>();
            await PorModulo(acc, db.TerritoriosSonorosDeRegistro.AsNoTracking().Select(x => new ValorYModulo { ValorId = x.ValorId, ModuloId = x.ModuloId }), ct);
            await Sumar(acc, "Noticias", db.NoticiasTerritoriosSonoros.AsNoTracking().Select(x => x.TerritorioSonoroId), ct);
            await Sumar(acc, "Agenda", db.EventosAgendaTerritoriosSonoros.AsNoTracking().Select(x => x.TerritorioSonoroId), ct);
            await Sumar(acc, "Catálogo editorial", db.PublicacionesEditorialesTerritoriosSonoros.AsNoTracking().Select(x => x.TerritorioSonoroId), ct);
            await Sumar(acc, "Mercados", db.MercadosTerritoriosSonoros.AsNoTracking().Select(x => x.TerritorioSonoroId), ct);
            return acc;
        },
    };

    public static readonly DescriptorDeCatalogo<PracticaMusicalRow, FichaConceptualPracticaMusicalRow> Practicas = new()
    {
        Ruta = "practicas-musicales",
        TablaDeAuditoria = "PracticasMusicales",
        Items = db => db.PracticasMusicales,
        Fichas = db => db.FichasConceptualesPracticasMusicales,
        ClaveDeFicha = f => f.PracticaMusicalId,
        FijarClave = (f, id) => f.PracticaMusicalId = id,
        Padre = x => x.PracticaPadreId,
        FijarPadre = (x, v) => x.PracticaPadreId = v,
        Usos = async (db, ct) =>
        {
            var acc = new Dictionary<int, List<SIMUS.Contracts.UsoDeCatalogoDto>>();
            await PorModulo(acc, db.PracticasMusicalesDeRegistro.AsNoTracking().Select(x => new ValorYModulo { ValorId = x.ValorId, ModuloId = x.ModuloId }), ct);
            await Sumar(acc, "Noticias", db.NoticiasPracticasMusicales.AsNoTracking().Select(x => x.PracticaMusicalId), ct);
            await Sumar(acc, "Agenda", db.EventosAgendaPracticasMusicales.AsNoTracking().Select(x => x.PracticaMusicalId), ct);
            await Sumar(acc, "Catálogo editorial", db.PublicacionesEditorialesPracticasMusicales.AsNoTracking().Select(x => x.PracticaMusicalId), ct);
            await Sumar(acc, "Mercados", db.MercadosPracticasMusicales.AsNoTracking().Select(x => x.PracticaMusicalId), ct);
            await Sumar(acc, "Lutería", db.TalleresPracticasMusicales.AsNoTracking().Select(x => x.PracticaMusicalId), ct);
            await Sumar(acc, "Espacios", db.EspaciosPracticasMusicales.AsNoTracking().Select(x => x.PracticaMusicalId), ct);
            await Sumar(acc, "Redes", db.RedesPracticasMusicales.AsNoTracking().Select(x => x.PracticaMusicalId), ct);
            await Sumar(acc, "Perfiles públicos", db.PerfilesPublicosPracticas.AsNoTracking().Select(x => x.IdPracticaMusical), ct);
            return acc;
        },
    };

    private static void Anotar(Dictionary<int, List<SIMUS.Contracts.UsoDeCatalogoDto>> acc, int id, string fuente, int total)
    {
        if (!acc.TryGetValue(id, out var lista)) acc[id] = lista = [];
        var previo = lista.FindIndex(u => u.Fuente == fuente);
        if (previo >= 0) lista[previo] = new SIMUS.Contracts.UsoDeCatalogoDto(fuente, lista[previo].Total + total);
        else lista.Add(new SIMUS.Contracts.UsoDeCatalogoDto(fuente, total));
    }

    private static async Task Sumar(Dictionary<int, List<SIMUS.Contracts.UsoDeCatalogoDto>> acc, string fuente, IQueryable<int> ids, CancellationToken ct)
    {
        foreach (var g in await ids.GroupBy(x => x).Select(g => new { Id = g.Key, Total = g.Count() }).ToListAsync(ct))
            Anotar(acc, g.Id, fuente, g.Total);
    }

    private static async Task PorModulo(Dictionary<int, List<SIMUS.Contracts.UsoDeCatalogoDto>> acc, IQueryable<ValorYModulo> filas, CancellationToken ct)
    {
        foreach (var g in await filas.GroupBy(x => new { x.ValorId, x.ModuloId }).Select(g => new { g.Key.ValorId, g.Key.ModuloId, Total = g.Count() }).ToListAsync(ct))
            Anotar(acc, g.ValorId, EtiquetasDeModulo.GetValueOrDefault(g.ModuloId, g.ModuloId), g.Total);
    }

    private sealed class ValorYModulo { public int ValorId { get; set; } public string ModuloId { get; set; } = string.Empty; }
}
