using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>Cuántos eventos de la Agenda se archivarían al retirar un proceso (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 113).</summary>
/// <param name="Total">Eventos vivos del proceso (todo menos archivado y rechazado).</param>
/// <param name="Publicados">De ellos, los que hoy se ven en el portal.</param>
public sealed record EventosQueSeArchivanDto(string Tipo, int ProcesoId, int Total, int Publicados);

/// <summary>
/// Antes de confirmar el retiro de un proceso, la interfaz pregunta aquí cuántos eventos de la Agenda
/// se archivarán con él. Lo CALCULA EL SERVIDOR con la misma consulta que luego archiva
/// (<see cref="ArchivoDeEventosDelProceso"/>), para que el aviso y el hecho no puedan diferir.
/// </summary>
/// <remarks>
/// Solo cuenta: no cambia nada. Una ruta para la organización (sesión externa) y otra para la consola.
/// </remarks>
public static class EventosQueSeArchivanAlRetirar
{
    public static RouteGroupBuilder MapEventosQueSeArchivanAlRetirarEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/externo/procesos/{tipo}/{procesoId:int}/eventos-que-se-archivan", ContarDeLaOrganizacion)
            .RequireAuthorization(SimusAuthentication.ExternalPolicy)
            .WithTags("eventos-que-se-archivan")
            .WithName("EventosQueSeArchivanAlRetirarDeLaOrganizacion");
        api.MapGet("/institucional/procesos/{tipo}/{procesoId:int}/eventos-que-se-archivan", Contar)
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .AddEndpointFilter(ExigeElModuloDelProceso)
            .WithTags("eventos-que-se-archivan")
            .WithName("EventosQueSeArchivanAlRetirarDeLaConsola");
        return api;
    }

    /// <summary>El módulo de la consola que hay que tener para ver los eventos de un proceso de ese tipo.</summary>
    private static string? ModuloDeConsolaDe(string tipo) => tipo switch
    {
        ProcesoDelEvento.Festival => ModuloDeUnTramite.ConsolaDe(Modulos.Festivales),
        ProcesoDelEvento.Mercado => ModuloDeUnTramite.ConsolaDe(Modulos.Mercados),
        ProcesoDelEvento.Taller => ModuloDeUnTramite.ConsolaDe(Modulos.Talleres),
        ProcesoDelEvento.Espacio => ModuloDeUnTramite.ConsolaDe(Modulos.Espacios),
        ProcesoDelEvento.Red => ModuloDeUnTramite.ConsolaDe(Modulos.Redes),
        _ => null,
    };

    /// <summary>
    /// LA CONSOLA TAMBIÉN NECESITA EL MÓDULO DEL PROCESO (el grupo solo pide ser funcionario): quien no tiene
    /// «Mercados» no cuenta los eventos de un Mercado. Se hace como filtro porque el tipo viene en la ruta.
    /// </summary>
    private static async ValueTask<object?> ExigeElModuloDelProceso(
        EndpointFilterInvocationContext contexto, EndpointFilterDelegate siguiente)
    {
        var tipo = contexto.HttpContext.Request.RouteValues["tipo"] as string ?? string.Empty;
        var modulo = ModuloDeConsolaDe(tipo);
        if (modulo is null) return Results.NotFound();
        var db = contexto.HttpContext.RequestServices.GetRequiredService<SimusDbContext>();
        if (!await PermisosDeModulo.PuedeAsync(db, contexto.HttpContext.User, modulo, contexto.HttpContext.RequestAborted))
        {
            return ModuloDeUnTramite.SinModulo();
        }

        return await siguiente(contexto);
    }

    /// <summary>
    /// Si esa persona administra el proceso: es de la organización que lo administra (rol que responde) o
    /// es la persona responsable de un proceso sin organización. 404 para quien no, igual que el resto de
    /// las rutas del responsable: no se confirma que el proceso exista.
    /// </summary>
    private static async Task<bool> AdministraAsync(
        SimusDbContext db, ClaimsPrincipal principal, string tipo, int id, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return false;

        int? organizacion;
        int? responsable = null;
        switch (tipo)
        {
            case ProcesoDelEvento.Festival:
                organizacion = await db.FestivalRecords.AsNoTracking().Where(x => x.Id == id)
                    .Select(x => x.OrganizacionPrincipalId).FirstOrDefaultAsync(ct);
                break;
            case ProcesoDelEvento.Mercado:
                organizacion = await db.Mercados.AsNoTracking().Where(x => x.Id == id)
                    .Select(x => (int?)x.OrganizacionPrincipalId).FirstOrDefaultAsync(ct);
                break;
            case ProcesoDelEvento.Taller:
            {
                var f = await db.Talleres.AsNoTracking().Where(x => x.Id == id)
                    .Select(x => new { x.OrganizacionPrincipalId, x.UsuarioResponsableId }).FirstOrDefaultAsync(ct);
                organizacion = f?.OrganizacionPrincipalId; responsable = f?.UsuarioResponsableId;
                break;
            }
            case ProcesoDelEvento.Espacio:
            {
                var f = await db.Espacios.AsNoTracking().Where(x => x.Id == id)
                    .Select(x => new { x.OrganizacionPrincipalId, x.UsuarioResponsableId }).FirstOrDefaultAsync(ct);
                organizacion = f?.OrganizacionPrincipalId; responsable = f?.UsuarioResponsableId;
                break;
            }
            case ProcesoDelEvento.Red:
            {
                var f = await db.Redes.AsNoTracking().Where(x => x.Id == id)
                    .Select(x => new { x.OrganizacionPrincipalId, x.UsuarioResponsableId }).FirstOrDefaultAsync(ct);
                organizacion = f?.OrganizacionPrincipalId; responsable = f?.UsuarioResponsableId;
                break;
            }
            default: return false;
        }

        if (organizacion is int org) return await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, org, ct);
        return responsable == persona.Value;
    }

    private static async Task<IResult> ContarDeLaOrganizacion(
        string tipo, int procesoId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        if (!ProcesoDelEvento.Tipos.Contains(tipo)) return Results.NotFound();
        if (!await AdministraAsync(db, principal, tipo, procesoId, ct)) return Results.NotFound();
        return await Contar(tipo, procesoId, db, ct);
    }

    private static async Task<IResult> Contar(string tipo, int procesoId, SimusDbContext db, CancellationToken ct)
    {
        if (!ProcesoDelEvento.Tipos.Contains(tipo)) return Results.NotFound();
        var vivos = await ArchivoDeEventosDelProceso.VivosDelProceso(db, tipo, procesoId, rastrear: false)
            .Select(e => e.Estado).ToListAsync(ct);
        return Results.Ok(new EventosQueSeArchivanDto(tipo, procesoId, vivos.Count, vivos.Count(e => e == "publicado")));
    }
}
