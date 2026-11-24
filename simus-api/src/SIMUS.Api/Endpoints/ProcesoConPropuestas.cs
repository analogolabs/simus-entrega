using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Un campo que se puede proponer: dónde está en la ficha, cómo se rotula y, si apunta a un vocabulario, cómo
/// se lee para una persona.
/// </summary>
/// <param name="SeccionId">Dónde está en la ficha, para agrupar la comparación como se agrupa la pantalla.</param>
/// <param name="Etiqueta">Su rótulo, el mismo que enseña la ficha.</param>
/// <param name="Legible">
/// Cómo se lee el valor guardado. Los campos que viajan como identificadores de un catálogo (la modalidad, los
/// servicios) o como códigos (el departamento) se guardan tal cual; esta función los traduce al nombre al
/// enseñar la comparación. Nula en los campos que ya son texto.
/// </param>
internal sealed record CampoProponible(
    string SeccionId,
    string Etiqueta,
    Func<SimusDbContext, string?, CancellationToken, Task<string?>>? Legible = null);

/// <summary>El registro sobre el que se propone, con quién responde por él.</summary>
internal sealed record RegistroProponible(int Id, string Nombre, string Estado, int? OrganizacionId, int? PersonaId);

/// <summary>Lo que el servidor sabe al aplicar una propuesta aprobada, para dejarlo en el registro de cambios.</summary>
internal sealed record AplicacionDePropuesta(long PropuestaId, string? Motivo, int Actor, DateTime Ahora);

/// <summary>
/// Un tipo de proceso que admite propuestas de cambio sobre lo ya publicado (Mercado, Taller de lutería, Espacio,
/// Red). PROP, decisión 122 de docs/referencia/20-decisiones-y-flujos-por-modulo.md.
/// </summary>
/// <remarks>
/// <para>
/// <b>UN SOLO CIRCUITO PARA TODOS.</b> El borrador, el envío, el «antes» copiado al enviar, la decisión y los
/// avisos son los mismos para cualquier proceso (<see cref="PropuestasDeCambioDeProcesoEndpoints"/>); lo que el
/// tipo aporta es poco: su módulo y su ruta, la lista cerrada de campos que se pueden proponer, cómo se lee y
/// cómo se escribe cada uno, y cómo se consulta y se registra el cambio. Añadir un tipo es escribir una clase
/// de estas, no un circuito.
/// </para>
/// <para>
/// <b>LA LISTA DE CAMPOS VIVE EN EL SERVIDOR, Y ESA ES LA DEFENSA.</b> La tabla de propuestas es genérica y guarda
/// pares «campo, valor» como texto; si la correspondencia con las columnas la trajera el cliente, quien propone
/// elegiría qué columna escribir. Un campo que no esté en <see cref="Campos"/> no se guarda, no se compara y no
/// se aplica.
/// </para>
/// </remarks>
internal abstract class ProcesoConPropuestas
{
    /// <summary>El módulo con el que viajan las propuestas y el registro de cambios.</summary>
    public abstract string Modulo { get; }

    /// <summary>El segmento de la ruta: <c>mercados</c>, <c>talleres</c>, <c>espacios</c>, <c>redes</c>.</summary>
    public abstract string Ruta { get; }

    /// <summary>El nombre corto para las rutas con nombre y los eventos: «Mercado», «Taller», «Espacio», «Red».</summary>
    public abstract string Etiqueta { get; }

    /// <summary>La tabla que se escribe en la bitácora: «Mercados», «Talleres»…</summary>
    public abstract string TablaDeAuditoria { get; }

    /// <summary>Si el nombre del tipo es femenino («la red»): de ello depende la concordancia de los textos.</summary>
    public virtual bool Femenino => false;

    /// <summary>«un mercado», «una red».</summary>
    public string Uno => Femenino ? $"una {Etiqueta.ToLowerInvariant()}" : $"un {Etiqueta.ToLowerInvariant()}";

    /// <summary>«un mercado publicado», «una red publicada».</summary>
    public string UnoPublicado => $"{Uno} publicad{(Femenino ? 'a' : 'o')}";

    /// <summary>«Este», «Esta»: para decir que lo que no está publicado se edita directamente.</summary>
    public string EsteGenero => Femenino ? "Esta" : "Este";

    /// <summary>«El», «La».</summary>
    public string ElGenero => Femenino ? "La" : "El";

    /// <summary>«el mercado musical», «el taller de lutería», «el espacio», «la red»: para los avisos.</summary>
    public abstract string ParaElAviso { get; }

    /// <summary>El rótulo de las propuestas sin nombre: «Mercado 12».</summary>
    public virtual string SinNombre => Etiqueta;

    public abstract IReadOnlyDictionary<string, CampoProponible> Campos { get; }

    /// <summary>El registro activo, o <c>null</c>.</summary>
    public abstract Task<RegistroProponible?> BuscarAsync(SimusDbContext db, int id, CancellationToken ct);

    /// <summary>Los nombres de varios registros, para la bandeja.</summary>
    public abstract Task<Dictionary<int, string>> NombresAsync(SimusDbContext db, List<int> ids, CancellationToken ct);

    /// <summary>El valor actual de un campo del registro, como texto comparable.</summary>
    public abstract Task<string?> ValorActualAsync(SimusDbContext db, int id, string campoId, CancellationToken ct);

    /// <summary>
    /// Escribe en el registro lo que la propuesta pide, campo por campo, y deja el cambio en el registro de cambios.
    /// </summary>
    /// <returns>Un conflicto explicado si el resultado sería imposible; <c>null</c> si se aplicó.</returns>
    public abstract Task<IResult?> AplicarAsync(
        SimusDbContext db, int id, IReadOnlyList<PropuestaDeCambioCampoRow> campos, AplicacionDePropuesta contexto, CancellationToken ct);

    /// <summary>Una línea de bitácora del circuito. Los verbos son los trece que admite la base.</summary>
    public virtual void Auditar(SimusDbContext db, int actor, int id, string evento, object? antes, object? despues, string? motivo)
    {
        var verbo = evento.EndsWith("CambioPropuesto", StringComparison.Ordinal) ? AccionesAuditoria.Crear
            : evento.EndsWith("PropuestaAplicada", StringComparison.Ordinal) ? AccionesAuditoria.Aprobar
            : evento.EndsWith("PropuestaRechazada", StringComparison.Ordinal) ? AccionesAuditoria.Rechazar
            : AccionesAuditoria.Actualizar;
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            verbo, evento, actor == 0 ? null : actor, TablaDeAuditoria, id.ToString(CultureInfo.InvariantCulture),
            antes, despues, motivo, OrigenDelCambio.Propuesta, DateTime.UtcNow));
    }

    // ───────────────────────────── Ayudas que comparten los tipos ─────────────────────────────

    /// <summary>Los identificadores de una lista guardada como «3,5,9», sin repetidos y en orden.</summary>
    internal static List<int> Identificadores(string? valor) =>
        string.IsNullOrWhiteSpace(valor)
            ? []
            : valor.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(trozo => int.TryParse(trozo, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : 0)
                .Where(id => id > 0)
                .Distinct()
                .Order()
                .ToList();

    internal static string? Lista(IEnumerable<int> ids)
    {
        var lista = ids.Order().ToList();
        return lista.Count == 0 ? null : string.Join(',', lista);
    }

    /// <summary>Si dos textos dicen cosas distintas; vacío y nulo dicen lo mismo.</summary>
    internal static bool Difiere(string? a, string? b) =>
        !string.Equals(string.IsNullOrWhiteSpace(a) ? null : a.Trim(), string.IsNullOrWhiteSpace(b) ? null : b.Trim(), StringComparison.Ordinal);

    internal static string? Numero(int? valor) =>
        valor is null ? null : valor.Value.ToString(CultureInfo.InvariantCulture);

    internal static int? Entero(string? valor) =>
        int.TryParse(valor, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) && id > 0 ? id : null;

    /// <summary>Un campo cuyo valor es un identificador, o una lista de ellos, de un vocabulario: se lee por su nombre.</summary>
    internal static Func<SimusDbContext, string?, CancellationToken, Task<string?>> NombresDe(
        Func<SimusDbContext, List<int>, CancellationToken, Task<Dictionary<int, string>>> nombres) =>
        async (db, valor, ct) =>
        {
            var ids = Identificadores(valor);
            if (ids.Count == 0) return null;
            var porId = await nombres(db, ids, ct);
            return string.Join(", ", ids.Select(id => porId.TryGetValue(id, out var nombre) ? nombre : $"#{id}")
                .Order(StringComparer.CurrentCultureIgnoreCase));
        };

    /// <summary>El nombre del departamento a partir de su código DIVIPOLA.</summary>
    internal static readonly Func<SimusDbContext, string?, CancellationToken, Task<string?>> DepartamentoLegible =
        async (db, codigo, ct) => string.IsNullOrWhiteSpace(codigo)
            ? null
            : await db.DivipolaLocations.AsNoTracking().Where(d => d.DepartmentCode == codigo)
                .Select(d => d.DepartmentName).FirstOrDefaultAsync(ct) ?? codigo;

    /// <summary>El nombre del municipio a partir de su código DIVIPOLA.</summary>
    internal static readonly Func<SimusDbContext, string?, CancellationToken, Task<string?>> MunicipioLegible =
        async (db, codigo, ct) => string.IsNullOrWhiteSpace(codigo)
            ? null
            : await db.DivipolaLocations.AsNoTracking().Where(d => d.MunicipalityCode == codigo)
                .Select(d => d.MunicipalityName).FirstOrDefaultAsync(ct) ?? codigo;

    /// <summary>La coherencia entre nivel y territorio la guarda la base; si salta, se contesta con un conflicto explicado.</summary>
    internal static IResult ConflictoDeTerritorio(string loQueQuedaria) =>
        Results.Conflict(new
        {
            message = $"Los cambios propuestos dejarían {loQueQuedaria} en un estado imposible: revisa el nivel de cobertura y su territorio antes de aplicarlos.",
        });
}
