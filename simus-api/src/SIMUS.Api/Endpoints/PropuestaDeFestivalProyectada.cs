using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Una propuesta de cambio de Festival, vista como la ficha completa que propondría: ADAPTADOR DE CONTRATO.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ SIGUE EXISTIENDO.</b> La tabla guarda SOLO LO QUE CAMBIA, pero el contrato del Festival —que sus dos pantallas ya
/// usan— habla de la propuesta como un objeto entero: nombre, territorio, contacto, prácticas. Esta clase reconstruye ese objeto
/// poniendo el diff ENCIMA de la cabecera del Festival. Lo que sabe del Festival (la lista de campos, cómo se lee y cómo se
/// escribe cada uno) ya no es suyo: es de <see cref="FestivalConPropuestas"/>, el mismo circuito que los demás procesos.
/// </para>
/// <para>
/// <b>EL «ANTES» YA NO ES UNA VERSIÓN, ES LA FILA DEL CAMPO.</b> La cabecera cambia cuando una propuesta se aprueba, así que una
/// propuesta que ya se aplicó no puede compararse con la cabecera de hoy: diría que no cambió nada. Por eso cada campo
/// propuesto lleva su <c>ValorAnterior</c> copiado (al guardar y, otra vez, al enviar), y <see cref="Anterior"/> lo prefiere a la
/// cabecera. Los campos que la propuesta no toca se leen de la cabecera, y valen lo mismo antes y después.
/// </para>
/// <para>
/// <b>Y EN EL SENTIDO CONTRARIO.</b> <see cref="GuardarDiferenciasAsync"/> toma un perfil completo —el que manda el formulario— y
/// guarda solo los campos en que se aparta de la cabecera: calcularlo en el servidor impide que quien propone decida contra qué
/// se le compara.
/// </para>
/// </remarks>
internal sealed class PropuestaDeFestivalProyectada
{
    private PropuestaDeFestivalProyectada(
        PropuestaDeCambioRow expediente,
        FestivalRow festival,
        IReadOnlyDictionary<string, string?> propuestos,
        IReadOnlyDictionary<string, string?> anteriores,
        List<int> practicas,
        List<int> territorios,
        List<int> practicasAntes,
        List<int> territoriosAntes)
    {
        Expediente = expediente;
        Festival = festival;
        Propuestos = propuestos;
        Anteriores = anteriores;
        PracticasMusicales = practicas;
        TerritoriosSonoros = territorios;
        PracticasAntes = practicasAntes;
        TerritoriosAntes = territoriosAntes;
    }

    internal PropuestaDeCambioRow Expediente { get; }

    /// <summary>La cabecera del Festival, tal como está ahora (sin seguimiento).</summary>
    internal FestivalRow Festival { get; }

    /// <summary>Lo que el expediente pide cambiar, por identificador de campo.</summary>
    internal IReadOnlyDictionary<string, string?> Propuestos { get; }

    /// <summary>El «antes» copiado en cada campo propuesto.</summary>
    internal IReadOnlyDictionary<string, string?> Anteriores { get; }

    internal List<int> PracticasMusicales { get; }
    internal List<int> TerritoriosSonoros { get; }
    internal List<int> PracticasAntes { get; }
    internal List<int> TerritoriosAntes { get; }

    /// <summary>El valor que tendría el campo si la propuesta se aplicara.</summary>
    internal string? Valor(string campoId) =>
        Propuestos.TryGetValue(campoId, out var propuesto) ? propuesto : FestivalConPropuestas.LeerColumna(Festival, campoId);

    /// <summary>El valor del campo ANTES de la propuesta: el que se copió al proponer, o el de la cabecera si no se toca.</summary>
    internal string? Anterior(string campoId) =>
        Anteriores.TryGetValue(campoId, out var anterior) ? anterior : FestivalConPropuestas.LeerColumna(Festival, campoId);

    internal string Nombre => Valor("nombre") ?? string.Empty;
    internal string? Descripcion => Valor("descripcion");
    internal string NivelCobertura => Valor("nivelCobertura") ?? string.Empty;
    internal string? CodigoDepartamento => Valor("codigoDepartamento");
    internal string? CodigoMunicipio => Valor("codigoMunicipio");
    internal string? Periodicidad => Valor("periodicidad");
    internal string? PeriodicidadDetalle => Valor("periodicidadDetalle");
    internal string? CorreoContacto => Valor("correoContacto");
    internal string? TelefonoContacto => Valor("telefonoContacto");
    internal string? Instagram => Valor("instagram");
    internal string? Facebook => Valor("facebook");
    internal string? SitioWeb => Valor("sitioWeb");
    internal string? OtroEnlace => Valor("otroEnlace");
    internal string? ObservacionesContacto => Valor("observacionesContacto");
    internal string? Director => Valor("director");

    /// <summary>Monta la proyección de un expediente: la cabecera más lo que pide cambiar.</summary>
    /// <returns><c>null</c> si el Festival ya no existe, que es un expediente sin suelo.</returns>
    internal static async Task<PropuestaDeFestivalProyectada?> DeAsync(
        SimusDbContext db, PropuestaDeCambioRow expediente, CancellationToken ct)
    {
        if (!int.TryParse(expediente.RegistroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var festivalId)) return null;

        var festival = await db.FestivalRecords.AsNoTracking().FirstOrDefaultAsync(f => f.Id == festivalId, ct);
        if (festival is null) return null;

        var campos = await db.PropuestasDeCambioCampos.AsNoTracking()
            .Where(c => c.IdPropuesta == expediente.Id)
            .ToListAsync(ct);
        var propuestos = campos.ToDictionary(c => c.CampoId, c => c.ValorPropuesto, StringComparer.Ordinal);
        var anteriores = campos.ToDictionary(c => c.CampoId, c => c.ValorAnterior, StringComparer.Ordinal);

        var practicasDeLaCabecera = await db.ValoresAsync<PracticaMusicalDeRegistroRow>(Modulos.Festivales, festivalId, ct);
        var territoriosDeLaCabecera = await db.ValoresAsync<TerritorioSonoroDeRegistroRow>(Modulos.Festivales, festivalId, ct);

        var practicas = propuestos.TryGetValue(FestivalConPropuestas.PracticasMusicales, out var pm)
            ? ProcesoConPropuestas.Identificadores(pm) : practicasDeLaCabecera;
        var territorios = propuestos.TryGetValue(FestivalConPropuestas.TerritoriosSonoros, out var ts)
            ? ProcesoConPropuestas.Identificadores(ts) : territoriosDeLaCabecera;
        var practicasAntes = anteriores.TryGetValue(FestivalConPropuestas.PracticasMusicales, out var pa)
            ? ProcesoConPropuestas.Identificadores(pa) : practicasDeLaCabecera;
        var territoriosAntes = anteriores.TryGetValue(FestivalConPropuestas.TerritoriosSonoros, out var ta)
            ? ProcesoConPropuestas.Identificadores(ta) : territoriosDeLaCabecera;

        return new PropuestaDeFestivalProyectada(
            expediente, festival, propuestos, anteriores, practicas, territorios, practicasAntes, territoriosAntes);
    }

    /// <summary>
    /// Deja los campos del expediente EXACTAMENTE como dice el perfil que llega: crea, actualiza y borra, guardando solo aquello
    /// en que se aparta de la cabecera.
    /// </summary>
    internal static async Task GuardarDiferenciasAsync(
        SimusDbContext db,
        PropuestaDeCambioRow expediente,
        FestivalRow festival,
        IReadOnlyDictionary<string, string?> perfilCompleto,
        List<int> practicas,
        List<int> territorios,
        DateTime ahora,
        CancellationToken ct)
    {
        var proceso = FestivalConPropuestas.Instancia;
        var diferencias = new Dictionary<string, string?>(StringComparer.Ordinal);

        foreach (var (campoId, propuesto) in perfilCompleto)
        {
            if (!FestivalConPropuestas.EsColumna(campoId)) continue;
            var antes = Vacio(FestivalConPropuestas.LeerColumna(festival, campoId));
            var ahoraValor = Vacio(propuesto);
            if (!string.Equals(antes, ahoraValor, StringComparison.Ordinal)) diferencias[campoId] = ahoraValor;
        }

        // LAS DOS LISTAS SE COMPARAN YA MONTADAS: identificadores separados por comas y en orden, que es la forma en que
        // las guardan las dos puertas. Así la comparación de texto basta.
        var practicasOrigen = ProcesoConPropuestas.Lista(await db.ValoresAsync<PracticaMusicalDeRegistroRow>(Modulos.Festivales, festival.Id, ct));
        var territoriosOrigen = ProcesoConPropuestas.Lista(await db.ValoresAsync<TerritorioSonoroDeRegistroRow>(Modulos.Festivales, festival.Id, ct));
        var practicasNuevas = ProcesoConPropuestas.Lista(practicas);
        var territoriosNuevos = ProcesoConPropuestas.Lista(territorios);
        if (!string.Equals(practicasOrigen, practicasNuevas, StringComparison.Ordinal))
            diferencias[FestivalConPropuestas.PracticasMusicales] = practicasNuevas;
        if (!string.Equals(territoriosOrigen, territoriosNuevos, StringComparison.Ordinal))
            diferencias[FestivalConPropuestas.TerritoriosSonoros] = territoriosNuevos;

        var existentes = expediente.Id == 0
            ? []
            : await db.PropuestasDeCambioCampos.Where(c => c.IdPropuesta == expediente.Id).ToListAsync(ct);

        foreach (var fila in existentes.Where(fila => !diferencias.ContainsKey(fila.CampoId)))
        {
            db.PropuestasDeCambioCampos.Remove(fila);
        }

        foreach (var (campoId, valor) in diferencias)
        {
            var definicion = proceso.Campos[campoId];
            var fila = existentes.Find(f => string.Equals(f.CampoId, campoId, StringComparison.Ordinal));
            // EL «ANTES» SE COPIA YA Y SE VUELVE A COPIAR AL ENVIAR: la cabecera puede cambiar entre un guardado y el envío
            // (otra propuesta aprobada), y lo que el Programa compara es lo que había cuando se comprometió a mirar.
            var anterior = campoId == FestivalConPropuestas.PracticasMusicales ? practicasOrigen
                : campoId == FestivalConPropuestas.TerritoriosSonoros ? territoriosOrigen
                : Vacio(FestivalConPropuestas.LeerColumna(festival, campoId));
            if (fila is null)
            {
                db.PropuestasDeCambioCampos.Add(new PropuestaDeCambioCampoRow
                {
                    Propuesta = expediente,
                    SeccionId = definicion.SeccionId,
                    CampoId = campoId,
                    CampoEtiqueta = definicion.Etiqueta,
                    ValorAnterior = anterior,
                    ValorPropuesto = valor,
                    FechaCreacion = ahora,
                });
                continue;
            }

            fila.SeccionId = definicion.SeccionId;
            fila.CampoEtiqueta = definicion.Etiqueta;
            fila.ValorAnterior = anterior;
            fila.ValorPropuesto = valor;
            fila.FechaActualizacion = ahora;
        }
    }

    /// <summary>
    /// Los campos propuestos cuyo valor en la cabecera YA NO ES el que la propuesta vio al copiar su «antes»: alguien más cambió ese
    /// dato mientras la propuesta esperaba. Es la comprobación de «sigue vigente» (CONCURRENCIA OPTIMISTA sobre la cabecera, por
    /// campo): reemplaza a «el perfil de origen ya no es el vigente». Aprobarla pisaría un cambio que quien decide no leyó.
    /// </summary>
    internal static async Task<List<string>> CamposDesactualizadosAsync(
        SimusDbContext db, int festivalId, IEnumerable<PropuestaDeCambioCampoRow> campos, CancellationToken ct)
    {
        var proceso = FestivalConPropuestas.Instancia;
        var desactualizados = new List<string>();
        foreach (var campo in campos)
        {
            if (!proceso.Campos.ContainsKey(campo.CampoId)) continue;
            var actual = await proceso.ValorActualAsync(db, festivalId, campo.CampoId, ct);
            if (ProcesoConPropuestas.Difiere(actual, campo.ValorAnterior)) desactualizados.Add(campo.CampoEtiqueta);
        }

        return desactualizados;
    }

    /// <summary>Trata la cadena vacía como ausencia, que es como la trata el resto del circuito.</summary>
    private static string? Vacio(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
}
