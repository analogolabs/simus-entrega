using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Endpoints;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Historial;

/// <summary>
/// Qué organización administra HOY un registro (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10).
/// </summary>
/// <remarks>
/// <para>
/// <b>LA HISTORIA SIGUE A LA ADMINISTRACIÓN, NO A QUIEN LA ESCRIBIÓ.</b> Decisión de la dirección del
/// 10 de noviembre de 2026: la organización que pasa a administrar un Festival (o un evento, o una
/// edición) ve también lo que pasó antes de que lo administrara. Por eso la pantalla de la
/// organización ya no filtra por la organización que quedó copiada en cada fila: pregunta de quién es
/// el registro ahora y entrega toda su historia legible por una organización.
/// </para>
/// <para>
/// <b>LA PREGUNTA ES LA GUARDA.</b> Un registro que no es de la organización no devuelve filas (una
/// respuesta vacía, no un 403: así no se puede usar para averiguar qué identificadores existen). Cada
/// módulo resuelve su dueña por donde ya la resuelven sus propios endpoints.
/// </para>
/// </remarks>
public static class PropietarioDelRegistro
{
    /// <summary>
    /// La organización que administra el registro, o <c>null</c> si el registro no existe o no pertenece
    /// a ninguna organización (lo administra la institución).
    /// </summary>
    public static async Task<int?> OrganizacionDeAsync(
        SimusDbContext db, string moduloId, string registroId, CancellationToken cancellationToken)
    {
        switch (moduloId)
        {
            case Modulos.Organizaciones:
                // El registro de una organización es ella misma.
                return int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var org)
                    && await db.EntityProfiles.AsNoTracking().AnyAsync(x => x.Id == org, cancellationToken)
                        ? org
                        : null;

            case Modulos.Festivales:
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var festivalId)) return null;
                return await db.FestivalRecords.AsNoTracking()
                    .Where(x => x.Id == festivalId)
                    .Select(x => x.OrganizacionPrincipalId)
                    .FirstOrDefaultAsync(cancellationToken);

            case Modulos.EdicionesDeFestival:
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var edicionId)) return null;
                return await (
                    from e in db.EdicionesFestival.AsNoTracking()
                    join f in db.FestivalRecords.AsNoTracking() on e.FestivalId equals f.Id
                    where e.Id == edicionId
                    select f.OrganizacionPrincipalId).FirstOrDefaultAsync(cancellationToken);

            case Modulos.EdicionesDeMercado:
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var edicionMercadoId)) return null;
                return await (
                    from e in db.EdicionesMercado.AsNoTracking()
                    join m in db.Mercados.AsNoTracking() on e.MercadoId equals m.Id
                    where e.Id == edicionMercadoId
                    select (int?)m.OrganizacionPrincipalId).FirstOrDefaultAsync(cancellationToken);

            case Modulos.Mercados:
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var mercadoId)) return null;
                return await db.Mercados.AsNoTracking()
                    .Where(x => x.Id == mercadoId)
                    .Select(x => (int?)x.OrganizacionPrincipalId)
                    .FirstOrDefaultAsync(cancellationToken);

            case Modulos.Talleres:
                // Un taller es de la organización que lo registra; el de un lutier independiente no
                // tiene organización (su responsable es una persona) y aquí devuelve nulo.
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var tallerId)) return null;
                return await db.Talleres.AsNoTracking()
                    .Where(x => x.Id == tallerId)
                    .Select(x => x.OrganizacionPrincipalId)
                    .FirstOrDefaultAsync(cancellationToken);

            case Modulos.Espacios:
                // Un espacio es de la organización que lo registra; el de un responsable independiente
                // no tiene organización (su responsable es una persona) y aquí devuelve nulo.
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var espacioId)) return null;
                return await db.Espacios.AsNoTracking()
                    .Where(x => x.Id == espacioId)
                    .Select(x => x.OrganizacionPrincipalId)
                    .FirstOrDefaultAsync(cancellationToken);

            case Modulos.Redes:
                // Una red es de la organización que la registra; la de una persona responsable no
                // tiene organización (su responsable es una persona) y aquí devuelve nulo.
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var redId)) return null;
                return await db.Redes.AsNoTracking()
                    .Where(x => x.Id == redId)
                    .Select(x => x.OrganizacionPrincipalId)
                    .FirstOrDefaultAsync(cancellationToken);

            case Modulos.Agenda:
                // Un evento es de la organización que administra el proceso que lo enmarca: Festival,
                // Mercado, Taller, Espacio o Red. Si el proceso es de una persona, devuelve nulo.
                if (!long.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var eventoId)) return null;
                var evento = await db.EventosAgenda.AsNoTracking()
                    .Where(x => x.Id == eventoId)
                    .FirstOrDefaultAsync(cancellationToken);
                return evento is null ? null : await ProcesoDelEvento.OrganizacionDeAsync(db, evento, cancellationToken);

            default:
                return null;
        }
    }

    /// <summary>
    /// La persona sin organización que responde por un registro, o <c>null</c> si no lo tiene (LUT-02).
    /// </summary>
    /// <remarks>
    /// <b>LA HISTORIA TAMBIÉN SIGUE A LA PERSONA.</b> Un taller, un espacio o una red de una persona
    /// independiente —y los eventos de la Agenda que enmarcan— no tienen organización a la que preguntar
    /// (<see cref="OrganizacionDeAsync"/> devuelve nulo): la persona lee su propia historia por aquí. Un
    /// registro que no es suyo no devuelve filas, igual que con una organización.
    /// </remarks>
    public static async Task<int?> PersonaResponsableDeAsync(
        SimusDbContext db, string moduloId, string registroId, CancellationToken cancellationToken)
    {
        switch (moduloId)
        {
            case Modulos.Talleres:
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var tallerId)) return null;
                return await db.Talleres.AsNoTracking()
                    .Where(x => x.Id == tallerId && x.OrganizacionPrincipalId == null)
                    .Select(x => x.UsuarioResponsableId).FirstOrDefaultAsync(cancellationToken);

            case Modulos.Espacios:
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var espacioId)) return null;
                return await db.Espacios.AsNoTracking()
                    .Where(x => x.Id == espacioId && x.OrganizacionPrincipalId == null)
                    .Select(x => x.UsuarioResponsableId).FirstOrDefaultAsync(cancellationToken);

            case Modulos.Redes:
                if (!int.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var redId)) return null;
                return await db.Redes.AsNoTracking()
                    .Where(x => x.Id == redId && x.OrganizacionPrincipalId == null)
                    .Select(x => x.UsuarioResponsableId).FirstOrDefaultAsync(cancellationToken);

            case Modulos.Agenda:
                if (!long.TryParse(registroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var eventoId)) return null;
                var evento = await db.EventosAgenda.AsNoTracking()
                    .Where(x => x.Id == eventoId)
                    .FirstOrDefaultAsync(cancellationToken);
                return evento is null ? null : await ProcesoDelEvento.PersonaResponsableDeAsync(db, evento, cancellationToken);

            default:
                return null;
        }
    }
}
