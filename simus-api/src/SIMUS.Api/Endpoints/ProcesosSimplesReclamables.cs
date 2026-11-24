using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Un proceso reclamable que NO es un Festival, visto por lo que la reclamación necesita (decisión 131).
/// </summary>
/// <remarks>
/// <b>UN HISTÓRICO ES UN PROCESO A NOMBRE DE LA ORGANIZACIÓN INSTITUCIONAL, EN LOS CINCO TIPOS.</b>
/// Mercados, Lutería (talleres), Espacios y Redes tienen <c>OrganizacionPrincipalId</c>; la importación
/// asistida deja a nombre de la institucional los que llegan sin organización (custodia del Programa), y
/// ese es el «histórico». No hace falta relajar <c>CK_*_UnSoloResponsable</c>: un histórico cumple «una
/// organización y ninguna persona». Reclamar cambia la organización; la persona responsable sigue vacía.
/// </remarks>
internal sealed record ProcesoSimple(
    string Modulo, int Id, string Nombre, string? Descripcion, string Estado, string Cobertura, string? Departamento, string? Municipio,
    int? Organizacion, bool Activo, string? Periodicidad, string? Correo, string? Web, string? Instagram, string? Facebook,
    Action<int, DateTime> AsignarOrganizacion)
{
    public bool EsReclamable(int? institucional) =>
        institucional is not null && Organizacion == institucional && Activo && Estado == "publicado";
}

public static partial class ReclamacionesAdministracionEndpoints
{
    /// <summary>Carga UN proceso de los cuatro tipos simples, con seguimiento si se va a transferir.</summary>
    internal static async Task<ProcesoSimple?> CargarSimpleAsync(SimusDbContext db, string modulo, int id, bool conSeguimiento, CancellationToken ct)
    {
        switch (modulo)
        {
            case Modulos.Mercados:
            {
                var q = conSeguimiento ? db.Mercados.AsQueryable() : db.Mercados.AsNoTracking();
                var m = await q.FirstOrDefaultAsync(x => x.Id == id, ct);
                return m is null ? null : DeMercado(m);
            }
            case Modulos.Talleres:
            {
                var q = conSeguimiento ? db.Talleres.AsQueryable() : db.Talleres.AsNoTracking();
                var t = await q.FirstOrDefaultAsync(x => x.Id == id, ct);
                return t is null ? null : DeTaller(t);
            }
            case Modulos.Espacios:
            {
                var q = conSeguimiento ? db.Espacios.AsQueryable() : db.Espacios.AsNoTracking();
                var e = await q.FirstOrDefaultAsync(x => x.Id == id, ct);
                return e is null ? null : DeEspacio(e);
            }
            case Modulos.Redes:
            {
                var q = conSeguimiento ? db.Redes.AsQueryable() : db.Redes.AsNoTracking();
                var r = await q.FirstOrDefaultAsync(x => x.Id == id, ct);
                return r is null ? null : DeRed(r);
            }
            default: return null;
        }
    }

    /// <summary>Los procesos simples publicados y a nombre de la institucional (los históricos), de los tipos pedidos.</summary>
    internal static async Task<List<ProcesoSimple>> HistoricosSimplesAsync(SimusDbContext db, int institucional, string? modulo, CancellationToken ct)
    {
        var lista = new List<ProcesoSimple>();
        if (modulo is null or Modulos.Mercados)
            lista.AddRange((await db.Mercados.AsNoTracking().Where(x => x.OrganizacionPrincipalId == institucional && x.Activo && x.EstadoRegistro == "publicado").ToListAsync(ct)).Select(DeMercado));
        if (modulo is null or Modulos.Redes)
            lista.AddRange((await db.Redes.AsNoTracking().Where(x => x.OrganizacionPrincipalId == institucional && x.Activo && x.EstadoRegistro == "publicado").ToListAsync(ct)).Select(DeRed));
        if (modulo is null or Modulos.Talleres)
            lista.AddRange((await db.Talleres.AsNoTracking().Where(x => x.OrganizacionPrincipalId == institucional && x.Activo && x.EstadoRegistro == "publicado").ToListAsync(ct)).Select(DeTaller));
        if (modulo is null or Modulos.Espacios)
            lista.AddRange((await db.Espacios.AsNoTracking().Where(x => x.OrganizacionPrincipalId == institucional && x.Activo && x.EstadoRegistro == "publicado").ToListAsync(ct)).Select(DeEspacio));
        return lista;
    }

    private static ProcesoSimple DeMercado(MercadoRow m) => new(Modulos.Mercados, m.Id, m.Nombre, m.Descripcion, m.EstadoRegistro, m.NivelCobertura, m.CodigoDepartamento, m.CodigoMunicipio,
        m.OrganizacionPrincipalId, m.Activo, m.Periodicidad, m.CorreoMercado, m.SitioWebMercado, m.InstagramMercado, m.FacebookMercado,
        (org, ahora) => { m.OrganizacionPrincipalId = org; m.FechaActualizacion = ahora; });

    private static ProcesoSimple DeTaller(TallerRow t) => new(Modulos.Talleres, t.Id, t.Nombre, t.Descripcion, t.EstadoRegistro, t.NivelCobertura, t.CodigoDepartamento, t.CodigoMunicipio,
        t.OrganizacionPrincipalId, t.Activo, null, t.CorreoTaller, t.SitioWebTaller, t.InstagramTaller, t.FacebookTaller,
        (org, ahora) => { t.OrganizacionPrincipalId = org; t.UsuarioResponsableId = null; t.FechaActualizacion = ahora; });

    private static ProcesoSimple DeEspacio(EspacioRow e) => new(Modulos.Espacios, e.Id, e.Nombre, e.Descripcion, e.EstadoRegistro, e.NivelCobertura, e.CodigoDepartamento, e.CodigoMunicipio,
        e.OrganizacionPrincipalId, e.Activo, null, e.CorreoEspacio, e.SitioWebEspacio, e.InstagramEspacio, e.FacebookEspacio,
        (org, ahora) => { e.OrganizacionPrincipalId = org; e.UsuarioResponsableId = null; e.FechaActualizacion = ahora; });

    private static ProcesoSimple DeRed(RedRow r) => new(Modulos.Redes, r.Id, r.Nombre, r.Descripcion, r.EstadoRegistro, r.NivelCobertura, r.CodigoDepartamento, r.CodigoMunicipio,
        r.OrganizacionPrincipalId, r.Activo, null, r.CorreoRed, r.SitioWebRed, r.InstagramRed, r.FacebookRed,
        (org, ahora) => { r.OrganizacionPrincipalId = org; r.UsuarioResponsableId = null; r.FechaActualizacion = ahora; });

    /// <summary>Las ediciones de un Mercado, con su año (los demás procesos no tienen ediciones).</summary>
    internal static async Task<List<int>> AniosDeEdicionesAsync(SimusDbContext db, string modulo, int id, CancellationToken ct) =>
        modulo == Modulos.Mercados
            ? await db.EdicionesMercado.AsNoTracking().Where(x => x.MercadoId == id).Select(x => x.Anio).Distinct().OrderByDescending(x => x).ToListAsync(ct)
            : [];

    /// <summary>La organización pasa a administrar un proceso simple; sus ediciones y su historia lo siguen solas.</summary>
    private static void TransferirSimple(SimusDbContext db, AdministrationClaimRow claim, ProcesoSimple proceso, int actor)
    {
        var anterior = proceso.Organizacion ?? 0;
        var ahora = DateTime.UtcNow;
        proceso.AsignarOrganizacion(claim.RequestingOrganizationId, ahora);
        claim.Status = "transferencia_ejecutada"; claim.UpdatedAt = ahora; claim.Version++;
        db.AdministrationTransfers.Add(new AdministrationTransferRow { ModuloId = proceso.Modulo, CanonicalRecordId = claim.CanonicalRecordId, PreviousOrganizationId = anterior, NewOrganizationId = claim.RequestingOrganizationId, ClaimId = claim.Id, DeciderId = claim.DeciderId ?? actor, Reason = claim.DecisionReason, PreviousStatus = proceso.Estado, NewStatus = proceso.Estado, ExecutedAt = ahora });
        Auditar(db, actor, claim.CanonicalRecordId, "TransferenciaAdministracionEjecutada", anterior.ToString(CultureInfo.InvariantCulture), claim.RequestingOrganizationId.ToString(CultureInfo.InvariantCulture));
        var tipo = TiposDeProcesoHistorico.De(proceso.Modulo)!;
        Notificar(db, claim.RequestingPersonId, "TransferenciaAdministracionEjecutada", $"Ya administras un proceso: {tipo.Etiqueta.ToLowerInvariant()}",
            $"«{proceso.Nombre}» ya es de tu organización. Puedes completarlo desde {tipo.EtiquetaPlural}.", claim.Id);
    }
}
