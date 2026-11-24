using System.Globalization;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Endpoints;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Security;

/// <summary>
/// LA POLÍTICA ÚNICA DE «ESTA ORGANIZACIÓN ES TUYA».
/// <para>
/// QUÉ HACE. Toda ruta cuyo patrón sea <c>/api/v1/externo/organizaciones/{x:int}/...</c> exige, ANTES
/// de entrar al manejador, que la persona autenticada sea miembro ACTIVO de esa organización
/// (administrador o editor, <see cref="RolesDeEntidad.Miembros"/>). Si no lo es, responde 404 sin
/// cuerpo.
/// </para>
/// <para>
/// POR QUÉ UN MIDDLEWARE Y NO UNA COMPROBACIÓN EN CADA MANEJADOR. Eran comprobaciones sueltas, una
/// por archivo, y la primera ruta nueva que olvidara llamarla nacía abierta. Aquí la regla se lee del
/// PATRÓN de la ruta, no de una anotación: una ruta nueva bajo ese prefijo queda cubierta sin que
/// nadie haga nada, y no hay manera de «olvidarla». La prueba
/// <c>PoliticaDeOrganizacionPropiaTests</c> recorre todas las rutas registradas y falla si aparece
/// una con parámetro de organización que este patrón no cubra.
/// </para>
/// <para>
/// POR QUÉ 404 Y NO 403. Con 403 para «existe pero no es tuya» y 404 para «no existe», la respuesta
/// era un buscador de organizaciones válidas (los identificadores son enteros consecutivos). Ahora
/// las dos situaciones producen exactamente la misma respuesta. El 403 sigue existiendo, pero solo
/// para quien SÍ es miembro y no tiene rol suficiente para la acción (un editor que intenta
/// administrar el equipo): a esa persona la existencia de su propia organización no se le oculta.
/// </para>
/// <para>
/// BITÁCORA. El intento se registra (acción «consultar», <c>NewValuesJson</c> con el evento
/// <c>acceso_organizacion_ajena_denegado</c>) con el identificador de la cuenta y el de la
/// organización pedida y nada más: ni correo, ni nombre, ni cuerpo de la petición.
/// </para>
/// <para>
/// LOS RECURSOS HIJOS. Los de las rutas <c>/externo/{festivales|mercados|redes|talleres|espacios|
/// ediciones|reclamaciones-administracion|borradores-proceso}/{id}/...</c> no llevan la organización
/// en la ruta: se resuelve la organización (o la persona responsable) DEL RECURSO y se aplica la misma
/// regla —miembro activo de esa organización, o la persona responsable del proceso—, con el mismo 404
/// si el recurso no existe y si no es de quien pregunta. Un identificador de otra organización no se
/// distingue de uno inexistente. Las demás rutas hijas (archivos, eventos propios, citas) comprueban
/// la pertenencia en su manejador y las vigila la prueba de IDOR.
/// </para>
/// </summary>
public sealed class PoliticaDeOrganizacionPropia
{
    public const string EventoDeBitacora = "acceso_organizacion_ajena_denegado";

    private static readonly string[] PrefijoDelPatron = ["api", "v1", "externo", "organizaciones"];

    private readonly RequestDelegate _siguiente;

    public PoliticaDeOrganizacionPropia(RequestDelegate siguiente) => _siguiente = siguiente;

    /// <summary>
    /// Nombre del parámetro de ruta que lleva la organización si el patrón cae bajo la política;
    /// <c>null</c> si no. Lo usa también la prueba de barrido, para decidir qué rutas debe recorrer.
    /// </summary>
    public static string? ParametroDeOrganizacion(RoutePattern patron)
    {
        var segmentos = patron.PathSegments;
        if (segmentos.Count <= PrefijoDelPatron.Length) return null;

        for (var i = 0; i < PrefijoDelPatron.Length; i++)
        {
            if (segmentos[i].Parts.Count != 1
                || segmentos[i].Parts[0] is not RoutePatternLiteralPart literal
                || !string.Equals(literal.Content, PrefijoDelPatron[i], StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }
        }

        var candidato = segmentos[PrefijoDelPatron.Length];
        return candidato.Parts.Count == 1 && candidato.Parts[0] is RoutePatternParameterPart parametro
            ? parametro.Name
            : null;
    }

    /// <summary>
    /// La familia de recursos hijos que cuelga de <c>/api/v1/externo/{familia}/{id}</c>, si el patrón
    /// es de esa forma y la familia está registrada; <c>null</c> si no.
    /// </summary>
    public static (string Familia, string Parametro)? RecursoHijo(RoutePattern patron)
    {
        var segmentos = patron.PathSegments;
        if (segmentos.Count < 5) return null;

        string?[] cabeza = ["api", "v1", "externo"];
        for (var i = 0; i < cabeza.Length; i++)
        {
            if (segmentos[i].Parts.Count != 1
                || segmentos[i].Parts[0] is not RoutePatternLiteralPart l
                || !string.Equals(l.Content, cabeza[i], StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }
        }

        if (segmentos[3].Parts.Count != 1 || segmentos[3].Parts[0] is not RoutePatternLiteralPart familia
            || !FamiliasDeRecursos.Contains(familia.Content))
        {
            return null;
        }

        return segmentos[4].Parts.Count == 1 && segmentos[4].Parts[0] is RoutePatternParameterPart parametro
            ? (familia.Content, parametro.Name)
            : null;
    }

    /// <summary>Familias de recursos hijos cubiertas por la política, por segmento de ruta.</summary>
    public static readonly IReadOnlySet<string> FamiliasDeRecursos = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "festivales", "mercados", "redes", "talleres", "espacios", "ediciones",
        "reclamaciones-administracion", "borradores-proceso",
    };

    public async Task InvokeAsync(HttpContext contexto)
    {
        if (contexto.GetEndpoint() is RouteEndpoint punto && contexto.User.Identity?.IsAuthenticated == true)
        {
            var persona = SesionExterna.PersonaDe(contexto.User);

            if (ParametroDeOrganizacion(punto.RoutePattern) is { } nombre)
            {
                var organizacion = LeerId(contexto, nombre);
                if (organizacion is null || persona is null
                    || !await EsMiembroAsync(contexto, persona.Value, (int)organizacion.Value))
                {
                    await RegistrarIntentoAsync(contexto, persona, "Entidades", organizacion);
                    contexto.Response.StatusCode = StatusCodes.Status404NotFound;
                    return;
                }
            }
            else if (RecursoHijo(punto.RoutePattern) is { } hijo)
            {
                var id = LeerId(contexto, hijo.Parametro);
                if (id is null || persona is null
                    || !await EsDeQuienPreguntaAsync(contexto, persona.Value, hijo.Familia, id.Value))
                {
                    await RegistrarIntentoAsync(contexto, persona, hijo.Familia, id);
                    contexto.Response.StatusCode = StatusCodes.Status404NotFound;
                    return;
                }
            }
        }

        await _siguiente(contexto);
    }

    private static long? LeerId(HttpContext contexto, string nombre) =>
        contexto.Request.RouteValues.TryGetValue(nombre, out var valor)
        && long.TryParse(Convert.ToString(valor, CultureInfo.InvariantCulture), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id)
            ? id
            : null;

    /// <summary>
    /// ¿El recurso existe y es de quien pregunta? Dueño = organización de la que la persona es miembro
    /// activo, o la persona responsable del proceso (redes, talleres y espacios independientes) o la
    /// autora del borrador. Existe-pero-ajeno y no-existe devuelven lo mismo: <c>false</c>.
    /// </summary>
    private static async Task<bool> EsDeQuienPreguntaAsync(HttpContext contexto, int persona, string familia, long id)
    {
        var db = contexto.RequestServices.GetRequiredService<SimusDbContext>();
        var ct = contexto.RequestAborted;
        int? organizacion;
        int? responsable = null;
        Duenios? duenios;

        switch (familia.ToLowerInvariant())
        {
            case "festivales":
                organizacion = await db.FestivalRecords.AsNoTracking().Where(f => f.Id == id)
                    .Select(f => f.OrganizacionPrincipalId).FirstOrDefaultAsync(ct);
                break;
            case "ediciones":
                organizacion = await (from e in db.EdicionesFestival.AsNoTracking()
                                      join f in db.FestivalRecords.AsNoTracking() on e.FestivalId equals f.Id
                                      where e.Id == id
                                      select f.OrganizacionPrincipalId).FirstOrDefaultAsync(ct);
                break;
            case "mercados":
                organizacion = await db.Mercados.AsNoTracking().Where(m => m.Id == id)
                    .Select(m => (int?)m.OrganizacionPrincipalId).FirstOrDefaultAsync(ct);
                break;
            case "redes":
                duenios = await db.Redes.AsNoTracking().Where(r => r.Id == id)
                    .Select(r => new Duenios(r.OrganizacionPrincipalId, r.UsuarioResponsableId)).FirstOrDefaultAsync(ct);
                organizacion = duenios?.Organizacion;
                responsable = duenios?.Responsable;
                break;
            case "talleres":
                duenios = await db.Talleres.AsNoTracking().Where(r => r.Id == id)
                    .Select(r => new Duenios(r.OrganizacionPrincipalId, r.UsuarioResponsableId)).FirstOrDefaultAsync(ct);
                organizacion = duenios?.Organizacion;
                responsable = duenios?.Responsable;
                break;
            case "espacios":
                duenios = await db.Espacios.AsNoTracking().Where(r => r.Id == id)
                    .Select(r => new Duenios(r.OrganizacionPrincipalId, r.UsuarioResponsableId)).FirstOrDefaultAsync(ct);
                organizacion = duenios?.Organizacion;
                responsable = duenios?.Responsable;
                break;
            case "reclamaciones-administracion":
                organizacion = await db.AdministrationClaims.AsNoTracking().Where(c => c.Id == id)
                    .Select(c => (int?)c.RequestingOrganizationId).FirstOrDefaultAsync(ct);
                break;
            case "borradores-proceso":
                var borrador = await db.BorradoresDeProceso.AsNoTracking().Where(b => b.Id == id)
                    .Select(b => new { b.PersonaId }).FirstOrDefaultAsync(ct);
                return borrador is not null && borrador.PersonaId == persona;
            default:
                return false;
        }

        if (responsable == persona) return true;
        return organizacion is int org && await EsMiembroAsync(contexto, persona, org);
    }

    private sealed record Duenios(int? Organizacion, int? Responsable);

    private static Task<bool> EsMiembroAsync(HttpContext contexto, int persona, int organizacion)
    {
        var db = contexto.RequestServices.GetRequiredService<SimusDbContext>();
        return db.UserEntities.AsNoTracking().AnyAsync(
            fila => fila.UserId == persona
                && fila.EntityId == organizacion
                && fila.IsActive
                && RolesDeEntidad.Miembros.Contains(fila.EntityRole),
            contexto.RequestAborted);
    }

    private static async Task RegistrarIntentoAsync(HttpContext contexto, int? persona, string tabla, long? recurso)
    {
        try
        {
            var db = contexto.RequestServices.GetRequiredService<SimusDbContext>();
            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = persona,
                TableName = tabla,
                RecordId = (recurso ?? 0).ToString(CultureInfo.InvariantCulture),
                Action = AccionesAuditoria.Consultar,
                NewValuesJson = $"{{\"evento\":\"{EventoDeBitacora}\"}}",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(contexto.RequestAborted);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // La bitácora no puede convertir un 404 en un 500, que sí diferenciaría la respuesta.
            contexto.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger<PoliticaDeOrganizacionPropia>()
                .LogWarning(ex, "No se pudo registrar el intento de acceso a una organización ajena.");
        }
    }
}
