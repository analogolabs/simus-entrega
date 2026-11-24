using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Endpoints;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Historial;

/// <summary>
/// La línea de tiempo de un registro: sus transiciones de estado y sus cambios campo por campo
/// (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.5.7).
/// </summary>
/// <remarks>
/// <para>
/// <b>DOS PUERTAS, UNA SOLA LECTURA.</b> La consola (<c>/admin/historial/…</c>) y el panel de la
/// organización (<c>/externo/organizaciones/{id}/historial/…</c>) leen las mismas filas con
/// reglas distintas:
/// </para>
/// <list type="bullet">
/// <item><description>
/// <b>Consola.</b> Hace falta el módulo de la consola al que pertenece el registro. Los datos
/// personales (contacto, identificación) solo se entregan si la cuenta tiene además el módulo de
/// <c>auditoria</c>; sin él se cuentan en <c>camposOcultos</c> y no se entregan. <b>Leer un dato
/// personal queda en la bitácora</b> (verbo «consultar»), con el nombre de los campos y no sus
/// valores.
/// </description></item>
/// <item><description>
/// <b>Organización.</b> Solo quien administra o edita esa organización, y solo las filas de clase
/// «publico» cuyo dueño fue esa organización cuando se escribieron. Nunca ve datos personales ni
/// la identidad de quien trabaja en la consola: ahí se firma «Equipo del Programa».
/// </description></item>
/// </list>
/// <para>
/// <b>EL HISTORIAL EMPIEZA EL 10 DE NOVIEMBRE DE 2026</b> (decisión de la dirección): lo anterior no
/// se reconstruye, salvo la historia de las versiones de Festival, que la migración pasó a esta capa
/// con origen «migracion». La respuesta lo dice en <c>inicioDelRegistro</c> para que la pantalla no
/// parezca prometer más.
/// </para>
/// </remarks>
public static class HistorialDeCambiosEndpoints
{
    /// <summary>Tope de filas de cambios por lectura. Sobra para una ficha; evita volcar una tabla.</summary>
    private const int TopeDeCambios = 1000;

    /// <summary>
    /// Qué módulo de la consola abre el historial de cada módulo de datos.
    /// </summary>
    private static readonly Dictionary<string, string> ModuloDeConsolaPorModulo = new(StringComparer.Ordinal)
    {
        [Modulos.Festivales] = "ecosistema",
        [Modulos.EdicionesDeFestival] = "ecosistema",
        [Modulos.Mercados] = "mercados",
        [Modulos.EdicionesDeMercado] = "mercados",
        [Modulos.Talleres] = "talleres",
        [Modulos.Espacios] = "espacios",
        [Modulos.Redes] = "redes",
        [Modulos.Organizaciones] = "organizaciones",
        [Modulos.Noticias] = "noticias",
        [Modulos.Agenda] = "agenda",
        [Modulos.CatalogoEditorial] = "catalogo-editorial",
        [Modulos.Archivos] = "gestion-sitio",
        [Modulos.EquipoWeb] = "gestion-sitio",
        [Modulos.Usuarios] = "usuarios",
    };

    /// <summary>Los módulos cuyo historial puede leer una organización: los que ella misma administra.</summary>
    private static readonly HashSet<string> ModulosDeLaOrganizacion = new(StringComparer.Ordinal)
    {
        Modulos.Festivales,
        Modulos.EdicionesDeFestival,
        Modulos.Mercados,
        Modulos.EdicionesDeMercado,
        Modulos.Talleres,
        Modulos.Espacios,
        Modulos.Redes,
        Modulos.Organizaciones,
        Modulos.Agenda,
        Modulos.Archivos,
    };

    public static RouteGroupBuilder MapHistorialDeCambiosEndpoints(this RouteGroupBuilder group)
    {
        var consola = group.MapGroup("/admin/historial").WithTags("admin-historial");
        consola.RequireAuthorization(SimusAuthentication.InstitutionalPolicy);

        consola.MapGet("/{moduloId}/{registroId}", LeerDesdeLaConsolaAsync)
            .WithName("LineaDeTiempoDeUnRegistro");

        var externo = group.MapGroup("/externo/organizaciones").WithTags("historial-organizacion-externo");
        externo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        externo.MapGet("/{organizacionId:int}/historial/{moduloId}/{registroId}", LeerDesdeLaOrganizacionAsync)
            .WithName("LineaDeTiempoDeUnRegistroDeMiOrganizacion");

        // LA PERSONA SIN ORGANIZACIÓN (LUT-02): el mismo historial, para lo que ella responde.
        var propio = group.MapGroup("/externo/mis-registros").WithTags("historial-persona-externo");
        propio.RequireAuthorization(SimusAuthentication.ExternalPolicy);
        propio.MapGet("/historial/{moduloId}/{registroId}", LeerDesdeLaPersonaAsync)
            .WithName("LineaDeTiempoDeUnRegistroDeMiPersona");

        return group;
    }

    private static async Task<IResult> LeerDesdeLaConsolaAsync(
        string moduloId,
        string registroId,
        ClaimsPrincipal principal,
        SimusDbContext db,
        CancellationToken ct)
    {
        if (!ModuloDeConsolaPorModulo.TryGetValue(moduloId, out var moduloDeConsola))
        {
            return Results.NotFound();
        }
        if (!await PermisosDeModulo.PuedeAsync(db, principal, moduloDeConsola, ct))
        {
            return Results.Problem(
                detail: "Tu cuenta no tiene activado el módulo de este registro.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Sin permiso");
        }

        var puedeVerDatosPersonales = await PermisosDeModulo.PuedeAsync(db, principal, "auditoria", ct);

        var filas = await db.CambiosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == moduloId && x.RegistroId == registroId)
            .OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id)
            .Take(TopeDeCambios)
            .ToListAsync(ct);

        var visibles = puedeVerDatosPersonales
            ? filas
            : filas.Where(x => ClaseDeDatoExtensiones.LaLeeLaOrganizacion(x.ClaseDato)).ToList();
        var ocultos = filas.Count - visibles.Count;

        var estados = await HistorialDeEstados.LeerAsync(db, moduloId, registroId, vistoPorOrganizacion: null, ct);
        var linea = ArmarLinea(moduloId, registroId, visibles, estados, ocultos);

        // LEER UN DATO PERSONAL DEJA RASTRO, con los nombres de los campos y nunca los valores.
        var personales = visibles.Where(x => !ClaseDeDatoExtensiones.LaLeeLaOrganizacion(x.ClaseDato)).ToList();
        if (personales.Count > 0)
        {
            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Consultar,
                "ConsultaDeDatosPersonales",
                PermisosDeModulo.CuentaDe(principal),
                RegistradorDeCambios.TablaDeBitacora(moduloId),
                registroId,
                antes: null,
                despues: new Dictionary<string, object?>
                {
                    ["campos"] = personales.Select(x => x.CampoId).Distinct().ToArray(),
                    ["clases"] = personales.Select(x => x.ClaseDato).Distinct().ToArray(),
                    ["filas"] = personales.Count,
                },
                motivo: null,
                OrigenDelCambio.Sistema,
                DateTime.UtcNow));
            await db.SaveChangesAsync(ct);
        }

        return Results.Ok(linea);
    }

    private static async Task<IResult> LeerDesdeLaOrganizacionAsync(
        int organizacionId,
        string moduloId,
        string registroId,
        ClaimsPrincipal principal,
        SimusDbContext db,
        CancellationToken ct)
    {
        if (!ModulosDeLaOrganizacion.Contains(moduloId)) return Results.NotFound();

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        // QUIEN ADMINISTRA O EDITA LA ORGANIZACIÓN. La misma guarda que usa el panel para sus
        // lecturas: la organización sale de la ruta y se comprueba contra la cuenta, no se confía en ella.
        var esMiembro = await db.UserEntities.AsNoTracking().AnyAsync(
            x => x.UserId == persona.Value && x.EntityId == organizacionId
                && RolesDeEntidad.Miembros.Contains(x.EntityRole) && x.IsActive,
            ct);
        if (!esMiembro) return Results.Forbid();

        // LA HISTORIA SIGUE A LA ADMINISTRACIÓN (decisión de la dirección del 10 de noviembre de 2026):
        // la organización que administra el registro AHORA ve todo lo legible por una organización,
        // también lo escrito antes de que lo administrara. Si el registro no es suyo, la respuesta es la
        // misma que la de un registro sin historia: no se puede usar para averiguar qué existe.
        var duena = await PropietarioDelRegistro.OrganizacionDeAsync(db, moduloId, registroId, ct);
        if (duena != organizacionId)
        {
            return Results.Ok(ArmarLinea(moduloId, registroId, [], [], camposOcultos: 0, ocultarActoresDeLaConsola: true));
        }

        // LO QUE LEE UNA ORGANIZACIÓN: lo público y lo que es de la propia organización (su NIT). Nunca
        // datos personales.
        var filas = (await db.CambiosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == moduloId && x.RegistroId == registroId
                && (x.ClaseDato == "publico" || x.ClaseDato == "organizacion"))
            .OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id)
            .Take(TopeDeCambios)
            .ToListAsync(ct));

        // LAS TRANSICIONES, TAMBIÉN TODAS LAS DEL REGISTRO, y firmadas como «Equipo del Programa»
        // cuando las hizo la consola.
        var estados = await HistorialDeEstados.LeerAsync(
            db, moduloId, registroId, organizacionId, ct);

        // EN UN GUARDADO DE LA CONSOLA, QUIEN LO HIZO NO SE NOMBRA A LA ORGANIZACIÓN.
        var linea = ArmarLinea(moduloId, registroId, filas, estados, camposOcultos: 0, ocultarActoresDeLaConsola: true);
        return Results.Ok(linea);
    }

    /// <summary>Los módulos cuyo historial puede leer una persona sin organización: lo que registra a su nombre.</summary>
    private static readonly HashSet<string> ModulosDeLaPersona = new(StringComparer.Ordinal)
    {
        Modulos.Talleres,
        Modulos.Espacios,
        Modulos.Redes,
        Modulos.Agenda,
    };

    /// <summary>
    /// El historial de un taller, un espacio, una red o un evento que una persona sin organización
    /// responde (LUT-02): la misma línea de tiempo, para su responsable y solo para ella.
    /// </summary>
    /// <remarks>
    /// Un registro que no es suyo responde igual que uno sin historia: así la ruta no sirve para averiguar
    /// qué existe. Nunca ve datos personales ni la identidad de quien trabaja en la consola: ahí se firma
    /// «Equipo del Programa».
    /// </remarks>
    private static async Task<IResult> LeerDesdeLaPersonaAsync(
        string moduloId,
        string registroId,
        ClaimsPrincipal principal,
        SimusDbContext db,
        CancellationToken ct)
    {
        if (!ModulosDeLaPersona.Contains(moduloId)) return Results.NotFound();

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        var responsable = await PropietarioDelRegistro.PersonaResponsableDeAsync(db, moduloId, registroId, ct);
        if (responsable != persona.Value)
        {
            return Results.Ok(ArmarLinea(moduloId, registroId, [], [], camposOcultos: 0, ocultarActoresDeLaConsola: true));
        }

        var filas = await db.CambiosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == moduloId && x.RegistroId == registroId && x.ClaseDato == "publico")
            .OrderByDescending(x => x.Fecha).ThenByDescending(x => x.Id)
            .Take(TopeDeCambios)
            .ToListAsync(ct);

        var estados = await HistorialDeEstados.LeerAsync(db, moduloId, registroId, null, ct, vistoPorPersona: persona.Value);
        return Results.Ok(ArmarLinea(moduloId, registroId, filas, estados, camposOcultos: 0, ocultarActoresDeLaConsola: true));
    }

    private static LineaDeTiempoDelRegistroDto ArmarLinea(
        string moduloId,
        string registroId,
        IReadOnlyList<CambioDeRegistroRow> cambios,
        IReadOnlyList<EntradaDeHistorialDeEstadosDto> estados,
        int camposOcultos,
        bool ocultarActoresDeLaConsola = false)
    {
        var entradas = new List<EntradaDeLaLineaDeTiempoDto>();

        foreach (var guardado in cambios.GroupBy(x => x.IdGrupo))
        {
            var primera = guardado.First();
            var campos = guardado
                .Select(x => new CambioDeCampoDto(
                    x.CampoId, x.CampoEtiqueta, x.ClaseDato,
                    // Los instantes y los valores viajan tal cual; la pantalla decide cómo pintarlos.
                    x.ValorAnterior, x.ValorNuevo,
                    // Si el valor es un código de catálogo, la pantalla lee el nombre, no el código.
                    x.NombreAnterior, x.NombreNuevo))
                .ToList();

            var firma = ocultarActoresDeLaConsola && primera.ActorRol is { } rol
                && rol.StartsWith("Consola", StringComparison.Ordinal)
                    ? HistorialDeEstados.FirmaDelPrograma
                    : primera.ActorNombre;

            entradas.Add(new EntradaDeLaLineaDeTiempoDto(
                "cambios",
                DateTime.SpecifyKind(primera.Fecha, DateTimeKind.Utc),
                TituloDeLosCambios(primera.Origen, campos.Count),
                firma,
                primera.ActorRol,
                primera.Origen,
                primera.Motivo,
                null,
                null,
                campos));
        }

        foreach (var estado in estados)
        {
            entradas.Add(new EntradaDeLaLineaDeTiempoDto(
                "estado",
                estado.Fecha,
                estado.AccionEtiqueta,
                estado.Actor,
                null,
                null,
                estado.Motivo,
                estado.EstadoAnterior,
                estado.EstadoNuevo,
                []));
        }

        return new LineaDeTiempoDelRegistroDto(
            moduloId,
            registroId,
            RegistradorDeCambios.InicioDelRegistro.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            camposOcultos,
            entradas.OrderByDescending(x => x.Fecha).ToList());
    }

    private static string TituloDeLosCambios(string origen, int cuantos)
    {
        var campos = cuantos == 1 ? "1 campo" : $"{cuantos} campos";
        return origen switch
        {
            OrigenDelCambio.Propuesta => $"Se publicó una propuesta de cambio ({campos})",
            OrigenDelCambio.Migracion => $"Cambio entre publicaciones del perfil ({campos})",
            OrigenDelCambio.Importacion => $"Importación ({campos})",
            OrigenDelCambio.Fusion => $"Fusión de duplicados ({campos})",
            _ => $"Cambió {campos}",
        };
    }
}
