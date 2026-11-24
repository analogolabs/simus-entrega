using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El historial de estados de un Festival y de sus Ediciones, con la lectura compartida de
/// <see cref="HistorialDeEstados"/>.
/// </summary>
/// <remarks>
/// <para>
/// <b>UNA SOLA LECTURA PARA LA ORGANIZACIÓN Y PARA LA CONSOLA.</b> Antes el panel de la organización
/// recibía una forma propia —sin motivo de rechazo y sin quién— y la consola no tenía ninguna.
/// Ahora las dos leen <see cref="EntradaDeHistorialDeEstadosDto"/>: de qué estado a cuál, cuándo,
/// quién y por qué. La organización lee «Equipo del Programa» donde decidió el Programa.
/// </para>
/// <para>
/// <b>«APROBADO» NO ES UN PASO DEL FESTIVAL.</b> Aprobar es publicar: de <c>en_revision</c> se sale
/// a <c>publicado</c>, <c>ajustes_solicitados</c> o <c>rechazado</c>. Ver
/// <see cref="EstadosFestival.Aprobado"/> y <c>docs/referencia/20-decisiones-y-flujos-por-modulo.md</c> §20.2.
/// </para>
/// </remarks>
internal static class HistorialDeFestival
{
    /// <summary>Retirado por la organización mientras esperaba decisión: vuelve a borrador.</summary>
    public const string RetiradoDeRevision = "FestivalRetiradoDeRevision";

    /// <summary>Un borrador que la organización elimina: queda archivado, no se borra.</summary>
    public const string BorradorArchivado = "FestivalBorradorArchivado";

    /// <summary>La consola aprueba la solicitud de retiro de un Festival publicado.</summary>
    public const string RetiroAprobado = "FestivalRetiroAprobado";

    /// <summary>Archivado al cerrarse la organización que lo administraba.</summary>
    public const string ArchivadoAlCerrarLaOrganizacion = "ArchivadoAlCerrarLaOrganizacion";

    /// <summary>Un registro histórico que nace publicado al cargarse o importarse (decisión 16).</summary>
    public const string HistoricoPublicadoAlCargarse = "RegistroHistoricoPublicadoAlCargarse";

    /// <summary>
    /// Las entradas del historial que SOLO INFORMAN (de dónde viene el registro) y que nunca son una observación
    /// de revisión. Sin excluirlas, la nota «se publica para que su organización pueda encontrarlo y reclamarlo»
    /// quedaba como «última observación» del Festival aun después de transferirlo a la organización (D-04).
    /// </summary>
    public static readonly string[] AccionesQueSoloInforman = [HistoricoPublicadoAlCargarse, AbsorbioUnDuplicado, FusionadoEnOtro];

    /// <summary>Un Festival rechazado vuelve a «en revisión» por decisión de la consola (T2).</summary>
    public const string RevisionReabierta = "FestivalRevisionReabierta";

    /// <summary>El Festival que se conserva al fusionar dos copias del mismo histórico.</summary>
    public const string AbsorbioUnDuplicado = "FestivalAbsorbioUnDuplicado";

    /// <summary>La copia absorbida: queda archivada y apunta a la que se conserva.</summary>
    public const string FusionadoEnOtro = "FestivalFusionadoEnOtro";

    /// <summary>
    /// Cómo se lee cada acción del circuito del Festival y de sus Ediciones.
    /// </summary>
    /// <remarks>
    /// Las de la Edición empiezan por «Edición»: el historial mezcla los dos módulos y la etiqueta
    /// es lo que los distingue.
    /// </remarks>
    public static readonly IReadOnlyDictionary<string, string> Etiquetas = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["FestivalEnviadoARevision"] = "Enviado a revisión",
        ["FestivalAjustesSolicitados"] = "Ajustes solicitados",
        ["FestivalCambiosPedidosPorCampo"] = "Ajustes solicitados campo por campo",
        ["FestivalPublicado"] = "Aprobado y publicado",
        ["FestivalRechazado"] = "Rechazado",
        [RevisionReabierta] = "Revisión reabierta: vuelve a revisión",
        ["FestivalArchivado"] = "Eliminado del ecosistema por el PNMC",
        [RetiradoDeRevision] = "Retirado de la revisión: vuelve a borrador",
        [BorradorArchivado] = "Borrador eliminado por la organización",
        [RetiroAprobado] = "Retiro aprobado: archivado",
        [ArchivadoAlCerrarLaOrganizacion] = "Archivado al cerrar la organización",
        [HistoricoPublicadoAlCargarse] = "Registro histórico publicado al cargarse",
        [AbsorbioUnDuplicado] = "Absorbió una copia duplicada del registro histórico",
        [FusionadoEnOtro] = "Fusionado en otro registro: archivado",
        ["FestivalPropuestaEnviadaARevision"] = "Propuesta de cambio enviada a revisión",
        ["EdicionEnviadaARevision"] = "Edición enviada a revisión",
        ["EdicionCambiosPedidosPorCampo"] = "Edición: ajustes solicitados",
        ["EdicionObservadaPorCampo"] = "Edición: ajustes solicitados campo por campo",
        ["EdicionObservada"] = "Edición observada por el PNMC",
        ["EdicionPublicada"] = "Edición publicada",
        ["EdicionPublicadaPorOrganizacion"] = "Edición publicada",
        ["EdicionRechazada"] = "Edición rechazada",
        ["EdicionDespublicada"] = "Edición retirada de lo público por el PNMC",
        ["EdicionDespublicadaPorOrganizacion"] = "Edición retirada de lo público",
        ["EdicionArchivada"] = "Edición archivada por el PNMC",
        ["EdicionArchivadaPorOrganizacion"] = "Edición archivada",
    };

    /// <summary>
    /// Deja en el historial un cambio de estado del Festival que no pasa por la bandeja de revisión
    /// (retirar, archivar, cerrar la organización).
    /// </summary>
    /// <remarks>
    /// El estado anterior se normaliza: los borradores antiguos guardan <c>Borrador</c> y
    /// <c>CK_RegistrosRevisionHistorial_EstadoNuevo</c> solo admite los códigos en minúscula.
    /// </remarks>
    public static void Registrar(
        SimusDbContext db, FestivalRow festival, int actor, string accion, string? estadoAnterior, string? comentario) =>
        HistorialDeEstados.Registrar(
            db, Modulos.Festivales, festival.Id, actor, accion,
            EstadosFestival.DesdeContrato(estadoAnterior) ?? estadoAnterior,
            EstadosFestival.DesdeContrato(festival.StatusCode) ?? festival.StatusCode ?? EstadosFestival.Borrador,
            comentario);

    /// <summary>
    /// El historial del Festival y de sus Ediciones, lo más reciente primero.
    /// </summary>
    /// <param name="db">El contexto.</param>
    /// <param name="festivalId">El Festival.</param>
    /// <param name="vistoPorOrganizacion">La organización que lo lee, o <c>null</c> desde la consola.</param>
    /// <param name="ct">Cancelación.</param>
    public static async Task<List<EntradaDeHistorialDeEstadosDto>> LeerAsync(
        SimusDbContext db, int festivalId, int? vistoPorOrganizacion, CancellationToken ct)
    {
        // LA HISTORIA DE LAS COPIAS QUE ABSORBIÓ VIAJA CON ÉL. La fusión no reescribe el
        // historial del absorbido —sigue siendo suyo, con su id—; se lee aquí junto al del Festival
        // que se conservó. Las ediciones ya se movieron, así que su historia llega sola.
        var festivales = new List<int> { festivalId };
        var frontera = new List<int> { festivalId };
        for (var nivel = 0; nivel < 5 && frontera.Count > 0; nivel++)
        {
            var actuales = frontera;
            frontera = await db.FestivalRecords.AsNoTracking()
                .Where(item => item.FusionadoEnId != null && actuales.Contains(item.FusionadoEnId.Value))
                .Select(item => item.Id)
                .ToListAsync(ct);
            frontera = frontera.Except(festivales).ToList();
            festivales.AddRange(frontera);
        }
        var registros = festivales.Select(item => item.ToString(CultureInfo.InvariantCulture)).ToList();
        var ediciones = await db.EdicionesFestival.AsNoTracking()
            .Where(item => item.FestivalId == festivalId)
            .Select(item => item.Id.ToString())
            .ToListAsync(ct);

        var entradas = await HistorialDeEstados.LeerAsync(
            db,
            h => (h.ModuloId == Modulos.Festivales && registros.Contains(h.RegistroId))
                || (h.ModuloId == Modulos.EdicionesDeFestival && ediciones.Contains(h.RegistroId)),
            vistoPorOrganizacion,
            ct);

        // LOS CÓDIGOS VIEJOS SE LEEN COMO LOS NUEVOS: una fila escrita antes de la corrección del
        // vocabulario puede decir «Borrador», y la pantalla traduce solo los códigos canónicos.
        return entradas.Select(e => e with
        {
            EstadoAnterior = EstadosFestival.DesdeContrato(e.EstadoAnterior) ?? e.EstadoAnterior,
            EstadoNuevo = EstadosFestival.DesdeContrato(e.EstadoNuevo) ?? e.EstadoNuevo,
        }).ToList();
    }
}
