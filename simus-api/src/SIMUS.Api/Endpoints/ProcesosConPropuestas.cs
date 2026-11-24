using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Un tipo de proceso cuyo registro es UNA FILA con columnas y listas de vocabulario: lo que tienen en común
/// Mercado, Taller, Espacio y Red para que el circuito de propuestas los trate igual.
/// </summary>
/// <remarks>
/// Cada tipo declara sus columnas proponibles (con cómo se leen y se escriben), cómo se leen y se escriben sus
/// listas de catálogo, y cómo se compara en el registro de cambios. Lo demás —guardar, enviar, decidir, avisar— es
/// del circuito común (<see cref="PropuestasDeCambioDeProcesoEndpoints"/>).
/// </remarks>
internal abstract class ProcesoDeFilaConPropuestas<TRow> : ProcesoConPropuestas where TRow : class
{
    /// <summary>Un campo que es una columna de la fila (<c>Escribir</c> nulo: es una lista de catálogo, que se trata aparte).</summary>
    protected sealed record Columna(CampoProponible Campo, Func<TRow, string?> Leer, Action<TRow, string?>? Escribir);

    private IReadOnlyDictionary<string, CampoProponible>? _campos;

    protected abstract IReadOnlyDictionary<string, Columna> Columnas { get; }

    public sealed override IReadOnlyDictionary<string, CampoProponible> Campos =>
        _campos ??= Columnas.ToDictionary(c => c.Key, c => c.Value.Campo, StringComparer.Ordinal);

    protected abstract Task<TRow?> CargarAsync(SimusDbContext db, int id, bool conSeguimiento, CancellationToken ct);

    protected abstract RegistroProponible ARegistro(TRow fila);

    protected abstract int? OrganizacionDe(TRow fila);

    protected abstract void ActualizadoEn(TRow fila, DateTime ahora);

    /// <summary>Los identificadores actuales de una lista de catálogo, como «3,5,9».</summary>
    protected abstract Task<string?> LeerListaAsync(SimusDbContext db, int id, string campoId, CancellationToken ct);

    /// <summary>
    /// Sustituye la lista por la que dice el valor propuesto. SE REEMPLAZA ENTERA, no se añade: una propuesta sobre los
    /// servicios dice cuáles quedan, y sumar los nuevos a los viejos haría imposible quitar uno.
    /// </summary>
    protected abstract Task EscribirListaAsync(SimusDbContext db, int id, string campoId, string? valor, DateTime ahora, CancellationToken ct);

    protected abstract Task<FotoDeCampos> FotoAsync(SimusDbContext db, TRow fila, CancellationToken ct);

    protected abstract Task RegistrarCambioAsync(
        SimusDbContext db, TRow fila, FotoDeCampos antes, ContextoDeCambio contexto, CancellationToken ct);

    /// <summary>
    /// La foto de lo que no son columnas de la fila (las listas de catálogo), tomada ANTES de escribir. Los tipos cuyas
    /// listas también quedan en el registro de cambios la sobrescriben (Festival); los demás no registran listas aquí.
    /// </summary>
    protected virtual Task<object?> TomarListasAsync(SimusDbContext db, int id, CancellationToken ct) =>
        Task.FromResult<object?>(null);

    /// <summary>Deja en el registro de cambios las listas que cambiaron, con el MISMO grupo que los campos.</summary>
    protected virtual Task RegistrarListasAsync(
        SimusDbContext db, int id, object? antes, ContextoDeCambio contexto, CancellationToken ct) =>
        Task.CompletedTask;

    public sealed override async Task<RegistroProponible?> BuscarAsync(SimusDbContext db, int id, CancellationToken ct)
    {
        var fila = await CargarAsync(db, id, conSeguimiento: false, ct);
        return fila is null ? null : ARegistro(fila);
    }

    public sealed override async Task<string?> ValorActualAsync(SimusDbContext db, int id, string campoId, CancellationToken ct)
    {
        if (!Columnas.TryGetValue(campoId, out var columna)) return null;
        if (columna.Escribir is null) return await LeerListaAsync(db, id, campoId, ct);

        var fila = await CargarAsync(db, id, conSeguimiento: false, ct);
        return fila is null ? null : columna.Leer(fila);
    }

    /// <remarks>
    /// <b>NO SE APLICA LO QUE NO ESTA EN EL CATALOGO.</b> Un campo que no reconozca <see cref="Columnas"/> no se escribe:
    /// es la misma lista cerrada que impidió guardarlo, y comprobarla otra vez aquí es lo que hace que una fila metida
    /// por otra vía no llegue nunca a la ficha publicada.
    /// </remarks>
    public sealed override async Task<IResult?> AplicarAsync(
        SimusDbContext db, int id, IReadOnlyList<PropuestaDeCambioCampoRow> campos, AplicacionDePropuesta contexto, CancellationToken ct)
    {
        var fila = await CargarAsync(db, id, conSeguimiento: true, ct);
        if (fila is null) return Results.NotFound();

        // LA FOTO ANTES DE APLICAR: aprobar una propuesta es un cambio de datos, y queda campo por campo en el sistema
        // común (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md): qué valía, qué vale, quién lo aprobó y de qué propuesta viene.
        var antes = await FotoAsync(db, fila, ct);
        var listasAntes = await TomarListasAsync(db, id, ct);

        foreach (var campo in campos)
        {
            if (!Columnas.TryGetValue(campo.CampoId, out var columna)) continue;

            if (columna.Escribir is null)
            {
                await EscribirListaAsync(db, id, campo.CampoId, campo.ValorPropuesto, contexto.Ahora, ct);
                continue;
            }

            columna.Escribir(fila, campo.ValorPropuesto);
        }

        ActualizadoEn(fila, contexto.Ahora);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // LA COHERENCIA ENTRE NIVEL Y TERRITORIO, Y LA DE LOS VOCABULARIOS, LA GUARDA LA BASE, y es lo que salta aquí:
            // una propuesta que deja «municipal» sin municipio no puede aplicarse. Se contesta como lo que es —un
            // conflicto explicado— y no como un 500.
            return ConflictoDeTerritorio($"{(Femenino ? "la" : "el")} {Etiqueta.ToLowerInvariant()}");
        }

        // UN GUARDADO, UN GRUPO: los campos y las listas se leen juntos («cambió 3 campos»).
        var cambio = new ContextoDeCambio(
            Modulo, id.ToString(CultureInfo.InvariantCulture), OrganizacionDe(fila),
            contexto.Actor == 0 ? null : contexto.Actor, "Consola",
            Origen: OrigenDelCambio.Propuesta, Motivo: contexto.Motivo, PropuestaId: contexto.PropuestaId, Fecha: contexto.Ahora,
            Grupo: Guid.NewGuid());
        await RegistrarCambioAsync(db, fila, antes, cambio, ct);
        await RegistrarListasAsync(db, id, listasAntes, cambio, ct);
        return null;
    }

    protected static Columna Texto(string seccion, string etiqueta, Func<TRow, string?> leer, Action<TRow, string?> escribir,
        Func<SimusDbContext, string?, CancellationToken, Task<string?>>? legible = null) =>
        new(new CampoProponible(seccion, etiqueta, legible), leer, escribir);

    /// <summary>Una lista de catálogo: no es una columna de la fila, se lee y se escribe aparte.</summary>
    protected static Columna ListaDeCatalogo(string seccion, string etiqueta,
        Func<SimusDbContext, List<int>, CancellationToken, Task<Dictionary<int, string>>> nombres) =>
        new(new CampoProponible(seccion, etiqueta, NombresDe(nombres)), _ => null, null);
}
