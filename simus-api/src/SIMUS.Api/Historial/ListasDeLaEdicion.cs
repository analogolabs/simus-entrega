using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Historial;

/// <summary>
/// Las listas de catálogo que cuelgan de una edición (prácticas musicales, territorios sonoros,
/// expresiones artísticas, modalidades de participación, tipos de ingreso) en el registro de cambios
/// (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10).
/// </summary>
/// <remarks>
/// <para>
/// <b>UNA LISTA ES UN CAMPO.</b> El valor es la lista de códigos ordenada («3,5,9»), que es el dato
/// verdadero, y el nombre es la lista de nombres que tenía ese día («Jazz; Rock; Salsa»): es lo que
/// lee la persona. Cambiar el orden en que se marcaron las casillas no es un cambio; agregar o quitar
/// una sí.
/// </para>
/// <para>
/// <b>SE TOMA LA FOTO ANTES DE REEMPLAZAR.</b> Las listas se reescriben enteras al guardar (se retiran
/// y se vuelven a agregar), así que lo anterior solo se puede leer antes. <see cref="TomarAsync"/> se
/// llama antes de tocar nada y <see cref="RegistrarAsync"/> con lo que queda.
/// </para>
/// </remarks>
public static class ListasDeLaEdicion
{
    /// <summary>La lista, tal como se declara: identificador estable, rótulo y cómo se lee.</summary>
    private sealed record Lista(string Id, string Etiqueta);

    private static readonly Lista[] Listas =
    [
        new("practicasMusicales", "Prácticas musicales"),
        new("territoriosSonoros", "Territorios sonoros"),
        new("expresionesArtisticas", "Expresiones artísticas"),
        new("modalidadesParticipacion", "Modalidades de participación"),
        new("tiposIngreso", "Tipos de ingreso"),
    ];

    /// <summary>Los códigos de cada lista de una edición, tal como están ahora.</summary>
    public sealed class FotoDeListas
    {
        internal FotoDeListas(IReadOnlyDictionary<string, IReadOnlyList<int>> codigos) => Codigos = codigos;

        internal IReadOnlyDictionary<string, IReadOnlyList<int>> Codigos { get; }
    }

    /// <summary>Lo que se guarda de la edición, en el mismo orden que <see cref="Listas"/>.</summary>
    public sealed record Marcado(
        IReadOnlyCollection<int>? Practicas,
        IReadOnlyCollection<int>? Territorios,
        IReadOnlyCollection<int>? Expresiones,
        IReadOnlyCollection<int>? Modalidades,
        IReadOnlyCollection<int>? TiposIngreso);

    public static async Task<FotoDeListas> TomarAsync(
        SimusDbContext db, string moduloId, int edicionId, CancellationToken cancellationToken)
    {
        var codigos = new Dictionary<string, IReadOnlyList<int>>(StringComparer.Ordinal)
        {
            ["practicasMusicales"] = Ordenados(await db.ValoresAsync<PracticaMusicalDeRegistroRow>(moduloId, edicionId, cancellationToken)),
            ["territoriosSonoros"] = Ordenados(await db.ValoresAsync<TerritorioSonoroDeRegistroRow>(moduloId, edicionId, cancellationToken)),
            ["expresionesArtisticas"] = Ordenados(await db.ValoresAsync<ExpresionArtisticaDeRegistroRow>(moduloId, edicionId, cancellationToken)),
            ["modalidadesParticipacion"] = Ordenados(await db.ValoresAsync<ModalidadParticipacionDeRegistroRow>(moduloId, edicionId, cancellationToken)),
            ["tiposIngreso"] = Ordenados(await db.ValoresAsync<TipoIngresoDeRegistroRow>(moduloId, edicionId, cancellationToken)),
        };
        return new FotoDeListas(codigos);
    }

    /// <summary>
    /// Agrega a la sesión una fila por cada lista que cambió. No llama a <c>SaveChanges</c>. Una lista
    /// que la solicitud no trae (<c>null</c>) no se toca: no se registra nada de ella.
    /// </summary>
    public static async Task<int> RegistrarAsync(
        SimusDbContext db,
        ContextoDeCambio contexto,
        FotoDeListas antes,
        Marcado despues,
        CancellationToken cancellationToken,
        bool conBitacora = true)
    {
        var nuevos = new Dictionary<string, IReadOnlyCollection<int>?>(StringComparer.Ordinal)
        {
            ["practicasMusicales"] = despues.Practicas,
            ["territoriosSonoros"] = despues.Territorios,
            ["expresionesArtisticas"] = despues.Expresiones,
            ["modalidadesParticipacion"] = despues.Modalidades,
            ["tiposIngreso"] = despues.TiposIngreso,
        };

        // Los nombres de lo que había y de lo que hay, una consulta por catálogo.
        var cambios = new List<ValorCambiado>();
        foreach (var lista in Listas)
        {
            var anterior = antes.Codigos[lista.Id];
            var nuevo = nuevos[lista.Id] is null ? anterior : Ordenados(nuevos[lista.Id]!);
            if (anterior.SequenceEqual(nuevo)) continue;

            var nombres = await NombresAsync(db, lista.Id, anterior.Concat(nuevo).Distinct().ToList(), cancellationToken);
            cambios.Add(new ValorCambiado(
                lista.Id,
                lista.Etiqueta,
                ClaseDeDato.Publico,
                Codigos(anterior),
                Codigos(nuevo),
                NombreAnterior: Texto(anterior, nombres),
                NombreNuevo: Texto(nuevo, nombres)));
        }

        return await RegistradorDeCambios.RegistrarValoresAsync(db, contexto, cambios, cancellationToken, conBitacora);
    }

    private static List<int> Ordenados(IEnumerable<int> codigos) =>
        codigos.Distinct().OrderBy(x => x).ToList();

    private static string? Codigos(IReadOnlyList<int> codigos) =>
        codigos.Count == 0 ? null : string.Join(',', codigos.Select(x => x.ToString(CultureInfo.InvariantCulture)));

    private static string? Texto(IReadOnlyList<int> codigos, IReadOnlyDictionary<int, string> nombres) =>
        codigos.Count == 0
            ? null
            : string.Join("; ", codigos.Select(c => nombres.TryGetValue(c, out var n) ? n : c.ToString(CultureInfo.InvariantCulture)));

    private static async Task<IReadOnlyDictionary<int, string>> NombresAsync(
        SimusDbContext db, string listaId, List<int> codigos, CancellationToken cancellationToken)
    {
        if (codigos.Count == 0) return new Dictionary<int, string>();
        return listaId switch
        {
            "practicasMusicales" => await db.PracticasMusicales.AsNoTracking()
                .Where(x => codigos.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Nombre, cancellationToken),
            "territoriosSonoros" => await db.TerritoriosSonoros.AsNoTracking()
                .Where(x => codigos.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Nombre, cancellationToken),
            "expresionesArtisticas" => await db.ExpresionesArtisticas.AsNoTracking()
                .Where(x => codigos.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Nombre, cancellationToken),
            "modalidadesParticipacion" => await db.ModalidadesParticipacion.AsNoTracking()
                .Where(x => codigos.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Nombre, cancellationToken),
            "tiposIngreso" => await db.TiposIngreso.AsNoTracking()
                .Where(x => codigos.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Nombre, cancellationToken),
            _ => new Dictionary<int, string>(),
        };
    }
}
