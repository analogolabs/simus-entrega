using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>Lo que se manda para completar o corregir la sede principal de un proceso ya creado.</summary>
public sealed class CorregirSedeSolicitud
{
    public string? SedeCodigoDepartamento { get; set; }
    public string? SedeCodigoMunicipio { get; set; }
}

/// <summary>
/// LA SEDE PRINCIPAL SE COMPLETA Y SE CORRIGE COMO ERRATA, también en lo publicado (decisión 119).
/// </summary>
/// <remarks>
/// Un Festival o un Mercado publicado no se edita directamente: sus cambios de fondo pasan por una
/// propuesta. La sede no es de fondo (no cambia lo que el proceso es), así que tiene su propia ruta, igual
/// que la regla de errata: se guarda al instante, no devuelve a revisión y queda en el registro de
/// cambios y en la bitácora. La organización la usa con el selector común; la consola puede hacer lo mismo.
/// Taller, Espacio y Red ya la editan con su formulario también publicados.
/// </remarks>
public static class SedeDeProcesoEndpoints
{
    private static readonly IReadOnlyList<CampoVigilado<ISedeDeProceso>> CamposDeLaSede =
    [
        new("sedeCodigoDepartamento", "Departamento de la sede", ClaseDeDato.Publico, x => x.SedeCodigoDepartamento, CatalogoDeCampo.Departamento),
        new("sedeCodigoMunicipio", "Municipio de la sede", ClaseDeDato.Publico, x => x.SedeCodigoMunicipio, CatalogoDeCampo.Municipio),
    ];

    public static RouteGroupBuilder MapSedeDeProcesoEndpoints(this RouteGroupBuilder group)
    {
        var externo = group.MapGroup("/externo").WithTags("sede-de-proceso").RequireAuthorization(SimusAuthentication.ExternalPolicy);
        externo.MapPut("/festivales/{id:int}/sede", (int id, CorregirSedeSolicitud solicitud, ClaimsPrincipal principal,
            SimusDbContext db, IAntiforgery antiforgery, HttpContext contexto, CancellationToken ct) =>
            DeLaOrganizacionAsync(Modulos.Festivales, id, solicitud, principal, db, antiforgery, contexto, ct))
            .WithName("CorregirSedeDeFestivalDeLaOrganizacion");
        externo.MapPut("/mercados/{id:int}/sede", (int id, CorregirSedeSolicitud solicitud, ClaimsPrincipal principal,
            SimusDbContext db, IAntiforgery antiforgery, HttpContext contexto, CancellationToken ct) =>
            DeLaOrganizacionAsync(Modulos.Mercados, id, solicitud, principal, db, antiforgery, contexto, ct))
            .WithName("CorregirSedeDeMercadoDeLaOrganizacion");

        group.MapGroup("/institucional/festivales").WithTags("sede-de-proceso")
            .RequireAuthorization(Permisos.PoliticaFuncionario).ExigeModulo("ecosistema")
            .MapPut("/{id:int}/sede", (int id, CorregirSedeSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct) =>
                DeLaConsolaAsync(Modulos.Festivales, id, solicitud, principal, db, ct))
            .WithName("CorregirSedeDeFestivalDeLaConsola");
        group.MapGroup("/institucional/mercados").WithTags("sede-de-proceso")
            .RequireAuthorization(Permisos.PoliticaFuncionario).ExigeModulo("mercados")
            .MapPut("/{id:int}/sede", (int id, CorregirSedeSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct) =>
                DeLaConsolaAsync(Modulos.Mercados, id, solicitud, principal, db, ct))
            .WithName("CorregirSedeDeMercadoDeLaConsola");
        return group;
    }

    private static async Task<(ISedeDeProceso? Fila, int? OrganizacionId)> BuscarAsync(string modulo, int id, SimusDbContext db, CancellationToken ct)
    {
        if (modulo == Modulos.Festivales)
        {
            var festival = await db.FestivalRecords.FirstOrDefaultAsync(f => f.Id == id, ct);
            return (festival, festival?.OrganizacionPrincipalId);
        }
        var mercado = await db.Mercados.FirstOrDefaultAsync(m => m.Id == id && m.Activo, ct);
        return (mercado, mercado?.OrganizacionPrincipalId);
    }

    private static async Task<IResult> DeLaOrganizacionAsync(
        string modulo, int id, CorregirSedeSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext contexto, CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El cambio no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        var (fila, organizacionId) = await BuscarAsync(modulo, id, db, ct);
        if (fila is null) return Results.NotFound();
        if (organizacionId is null || !await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId.Value, ct))
        {
            return Results.Forbid();
        }
        return await AplicarAsync(modulo, id, fila, organizacionId, solicitud, persona.Value, "Organización", db, ct);
    }

    private static async Task<IResult> DeLaConsolaAsync(
        string modulo, int id, CorregirSedeSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var (fila, organizacionId) = await BuscarAsync(modulo, id, db, ct);
        if (fila is null) return Results.NotFound();
        var actor = int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), CultureInfo.InvariantCulture, out var n) ? n : 0;
        return await AplicarAsync(modulo, id, fila, organizacionId, solicitud, actor, "Programa", db, ct);
    }

    private static async Task<IResult> AplicarAsync(
        string modulo, int id, ISedeDeProceso fila, int? organizacionId, CorregirSedeSolicitud solicitud, int actor,
        string rol, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var errores = await SedePrincipal.ErroresAsync(db, solicitud.SedeCodigoDepartamento, solicitud.SedeCodigoMunicipio, ct);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var antes = RegistradorDeCambios.Tomar(fila, CamposDeLaSede);
        SedePrincipal.Aplicar(fila, (solicitud.SedeCodigoDepartamento?.Trim(), solicitud.SedeCodigoMunicipio?.Trim()));
        var ahora = DateTime.UtcNow;
        if (fila is FestivalRow festival) festival.UpdatedAt = ahora;
        if (fila is MercadoRow mercado) mercado.FechaActualizacion = ahora;

        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(modulo, id.ToString(CultureInfo.InvariantCulture), organizacionId, actor, rol, Fecha: ahora,
                Motivo: "Sede principal completada o corregida (errata)"),
            CamposDeLaSede, antes, fila, ct);
        await db.SaveChangesAsync(ct);

        var nombres = await SedePrincipal.ResolverNombresAsync(db, [fila], ct);
        return Results.Ok(nombres(fila));
    }
}
