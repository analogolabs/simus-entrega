using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Historial;

/// <summary>
/// Las listas que cuelgan de una edición y NO son de catálogo (los lugares, las entidades aliadas y los
/// materiales) en el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10).
/// </summary>
/// <remarks>
/// <para>
/// <b>UNA LISTA ES UN CAMPO.</b> Igual que las listas de catálogo (<see cref="ListasDeLaEdicion"/>): cada
/// lista es un campo del registro y su valor es la lista entera, con una línea por fila y ordenada, de
/// modo que cambiar el orden en que se escribieron no es un cambio y agregar, quitar o corregir una fila
/// sí. El valor es lo que guarda la base («05|05001|1|») y el nombre es lo que lee la persona
/// («Medellín (ANTIOQUIA)»).
/// </para>
/// <para>
/// <b>SE TOMA LA FOTO ANTES DE REEMPLAZAR.</b> Estas tablas se reescriben enteras al guardar la edición
/// (se retiran y se vuelven a agregar), así que lo anterior solo se puede leer antes de tocar nada.
/// </para>
/// <para>
/// <b>QUÉ CLASE DE DATO ES CADA UNA.</b> Los lugares y los materiales son públicos (lo que la ficha
/// muestra). Las entidades aliadas llevan el <b>correo</b> de una entidad: es dato de contacto, así que
/// su historia solo la lee la consola con el módulo de Auditoría, y queda en la bitácora que se leyó.
/// </para>
/// </remarks>
public static class RelacionesDeLaEdicion
{
    public sealed record Lugar(string Departamento, string Municipio, int? Zona, int? Titulacion);

    public sealed record Aliada(string? Nombre, string? Correo, int? Naturaleza, int? EntidadId);

    public sealed record Material(string? Url, string? Descripcion);

    /// <summary>Lo que tiene la edición en las tres listas, tal como está ahora.</summary>
    public sealed class FotoDeRelaciones
    {
        internal FotoDeRelaciones(IReadOnlyList<Lugar> lugares, IReadOnlyList<Aliada> aliadas, IReadOnlyList<Material> materiales)
        {
            Lugares = lugares;
            Aliadas = aliadas;
            Materiales = materiales;
        }

        internal IReadOnlyList<Lugar> Lugares { get; }

        internal IReadOnlyList<Aliada> Aliadas { get; }

        internal IReadOnlyList<Material> Materiales { get; }
    }

    public static async Task<FotoDeRelaciones> TomarAsync(
        SimusDbContext db, string moduloId, int edicionId, CancellationToken cancellationToken)
    {
        var lugares = await db.Relacion<LocalizacionDeRegistroRow>(moduloId, edicionId)
            .AsNoTracking().ToListAsync(cancellationToken);
        var aliadas = await db.Relacion<EntidadAliadaDeRegistroRow>(moduloId, edicionId)
            .AsNoTracking().ToListAsync(cancellationToken);
        var materiales = await db.Relacion<ArchivoDeRegistroRow>(moduloId, edicionId)
            .AsNoTracking().OrderBy(x => x.OrdenVisualizacion).ToListAsync(cancellationToken);

        return new FotoDeRelaciones(
            lugares.Select(x => new Lugar(x.CodigoDepartamento, x.CodigoMunicipio, x.ZonaUrbanoRuralId, x.TitulacionColectivaId)).ToList(),
            aliadas.Select(x => new Aliada(Limpio(x.Nombre), Limpio(x.Correo), x.NaturalezaEntidadId, x.EntidadId)).ToList(),
            materiales.Select(x => new Material(Limpio(x.Url), Limpio(x.DescripcionArchivo))).ToList());
    }

    /// <summary>
    /// Agrega a la sesión una fila por cada lista que cambió. No llama a <c>SaveChanges</c>. Una lista que
    /// la solicitud no trae (<c>null</c>) no se toca: no se registra nada de ella.
    /// </summary>
    public static async Task<int> RegistrarAsync(
        SimusDbContext db,
        ContextoDeCambio contexto,
        FotoDeRelaciones antes,
        IReadOnlyCollection<Lugar>? lugares,
        IReadOnlyCollection<Aliada>? aliadas,
        IReadOnlyCollection<Material>? materiales,
        CancellationToken cancellationToken,
        bool conBitacora = true)
    {
        var cambios = new List<ValorCambiado>();

        // Los lugares: sin repetir el mismo municipio, como se escriben.
        if (lugares is not null)
        {
            var despues = lugares
                .GroupBy(x => (x.Departamento.Trim(), x.Municipio.Trim()))
                .Select(x => x.First())
                .Select(x => x with { Departamento = x.Departamento.Trim(), Municipio = x.Municipio.Trim() })
                .ToList();
            var anterior = Lineas(antes.Lugares, l => $"{l.Departamento}|{l.Municipio}|{Num(l.Zona)}|{Num(l.Titulacion)}");
            var nuevo = Lineas(despues, l => $"{l.Departamento}|{l.Municipio}|{Num(l.Zona)}|{Num(l.Titulacion)}");
            if (!anterior.SequenceEqual(nuevo, StringComparer.Ordinal))
            {
                var codigos = antes.Lugares.Select(x => x.Municipio).Concat(despues.Select(x => x.Municipio)).Distinct().ToList();
                var nombres = await NombresDeCatalogo.ResolverAsync(db, CatalogoDeCampo.Municipio, codigos, cancellationToken);
                string Legible(Lugar l) => nombres.TryGetValue(l.Municipio, out var n) ? n : l.Municipio;
                cambios.Add(new ValorCambiado(
                    "lugares", "Lugares", ClaseDeDato.Publico,
                    Unidas(anterior), Unidas(nuevo),
                    NombreAnterior: Unidas(Lineas(antes.Lugares, Legible)),
                    NombreNuevo: Unidas(Lineas(despues, Legible))));
            }
        }

        // Las entidades aliadas: llevan el correo, así que son dato de contacto.
        if (aliadas is not null)
        {
            var despues = aliadas.Select(x => new Aliada(Limpio(x.Nombre), Limpio(x.Correo), x.Naturaleza, x.EntidadId)).ToList();
            var anterior = Lineas(antes.Aliadas, a => $"{a.Nombre}|{a.Correo}|{Num(a.Naturaleza)}|{Num(a.EntidadId)}");
            var nuevo = Lineas(despues, a => $"{a.Nombre}|{a.Correo}|{Num(a.Naturaleza)}|{Num(a.EntidadId)}");
            if (!anterior.SequenceEqual(nuevo, StringComparer.Ordinal))
            {
                static string Legible(Aliada a) => string.IsNullOrEmpty(a.Correo) ? (a.Nombre ?? "(sin nombre)") : $"{a.Nombre ?? "(sin nombre)"} ({a.Correo})";
                cambios.Add(new ValorCambiado(
                    "entidadesAliadas", "Entidades aliadas", ClaseDeDato.Contacto,
                    Unidas(anterior), Unidas(nuevo),
                    NombreAnterior: Unidas(Lineas(antes.Aliadas, Legible)),
                    NombreNuevo: Unidas(Lineas(despues, Legible))));
            }
        }

        // Los materiales: solo los que tienen enlace, que es lo que se escribe.
        if (materiales is not null)
        {
            var despues = materiales
                .Select(x => new Material(Limpio(x.Url), Limpio(x.Descripcion)))
                .Where(x => !string.IsNullOrEmpty(x.Url))
                .ToList();
            var anterior = Lineas(antes.Materiales, m => $"{m.Url}|{m.Descripcion}");
            var nuevo = Lineas(despues, m => $"{m.Url}|{m.Descripcion}");
            if (!anterior.SequenceEqual(nuevo, StringComparer.Ordinal))
            {
                static string Legible(Material m) => string.IsNullOrEmpty(m.Descripcion) ? (m.Url ?? string.Empty) : $"{m.Descripcion}: {m.Url}";
                cambios.Add(new ValorCambiado(
                    "materiales", "Materiales", ClaseDeDato.Publico,
                    Unidas(anterior), Unidas(nuevo),
                    NombreAnterior: Unidas(Lineas(antes.Materiales, Legible)),
                    NombreNuevo: Unidas(Lineas(despues, Legible))));
            }
        }

        return await RegistradorDeCambios.RegistrarValoresAsync(db, contexto, cambios, cancellationToken, conBitacora);
    }

    private static List<string> Lineas<T>(IEnumerable<T> filas, Func<T, string> texto) =>
        filas.Select(texto).OrderBy(x => x, StringComparer.Ordinal).ToList();

    private static string? Unidas(List<string> lineas) =>
        lineas.Count == 0 ? null : string.Join("; ", lineas);

    private static string Num(int? valor) => valor?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;

    private static string? Limpio(string? texto) => string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
}
