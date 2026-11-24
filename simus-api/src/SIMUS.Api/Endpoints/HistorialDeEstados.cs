using System.Globalization;
using System.Linq.Expressions;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Escribe en el hilo único de revisión (`dbo.RegistrosRevisionHistorial`) los cambios de estado de
/// los contenidos de la consola que no tienen circuito propio: Noticias y Agenda, y lo lee
/// para enseñarlo.
/// </summary>
/// <remarks>
/// LA BITACORA NO BASTA. `AuditLogs` dice que algo se tocó; el historial de revisión dice de qué
/// estado a cuál, quién, cuándo y por qué, que es lo que Festivales y Mercados ya dejan escrito.
/// Es la misma fila que escriben ellos, con el mismo significado de cada columna.
/// </remarks>
internal static class HistorialDeEstados
{
    /// <summary>Un cambio de estado pedido por la ruta `/estado`.</summary>
    public const string AccionEstadoCambiado = "EstadoCambiado";

    /// <summary>Una errata corregida en lo publicado: el estado no se mueve.</summary>
    public const string AccionErrata = "ErrataCorregida";

    /// <summary>Un cambio de fondo en lo publicado, que lo devuelve a revisión.</summary>
    public const string AccionVueltaARevision = "CambioDeFondoEnPublicado";

    /// <summary>Lo que estaba en revisión vuelve a borrador para corregirse.</summary>
    public const string AccionDevuelto = "DevueltoParaCorregir";

    /// <summary>Lo que estaba en revisión se rechaza y queda «rechazado» ( de L6).</summary>
    public const string AccionRechazado = "RechazadoEnRevision";

    /// <summary>Cómo se firma, ante la organización, lo que decidió alguien que no es de ella.</summary>
    public const string FirmaDelPrograma = "Equipo del PNMC";

    private static readonly string[] MotivoObligatorio =
        ["Escribe el motivo: quien lo envió necesita saber qué corregir o por qué no sigue."];

    /// <summary>
    /// La acción que corresponde a un cambio de estado de la consola.
    /// </summary>
    /// <remarks>
    /// <b>DEVOLVER Y RECHAZAR SON LAS DOS SALIDAS DE LA REVISIÓN QUE NO PUBLICAN</b>: de
    /// <c>en_revision</c> a <c>borrador</c> (devolver) o a <c>rechazado</c> (rechazar). Hasta L6
    /// el rechazo dejaba el registro «archivado» porque Noticias y Agenda no tenían estado
    /// <c>rechazado</c>. Cualquier otro cambio es un cambio de estado sin más.
    /// </remarks>
    public static string AccionDelCambio(string? anterior, string nuevo) => (anterior, nuevo) switch
    {
        ("en_revision", "borrador") => AccionDevuelto,
        ("en_revision", "rechazado") => AccionRechazado,
        _ => AccionEstadoCambiado,
    };

    /// <summary>Si el cambio pide motivo: devolver o rechazar sin decir por qué no se admite.</summary>
    public static bool PideMotivo(string? anterior, string nuevo) =>
        AccionDelCambio(anterior, nuevo) is AccionDevuelto or AccionRechazado;

    /// <summary>
    /// El 400 si el cambio no es posible: «rechazado» solo se alcanza desde «en revisión», que es lo
    /// que el rechazo significa (se decide sobre algo que se envió a revisar).
    /// </summary>
    public static IResult? ExigirTransicionValida(string? anterior, string nuevo) =>
        nuevo == "rechazado" && anterior is not ("en_revision" or "rechazado")
            ? Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["estado"] = ["Solo se puede rechazar lo que está en revisión."],
            })
            : null;

    /// <summary>El 400 que corresponde si el cambio pide motivo y no lo trae, o <c>null</c>.</summary>
    public static IResult? ExigirMotivo(string? anterior, string nuevo, string? motivo) =>
        PideMotivo(anterior, nuevo) && string.IsNullOrWhiteSpace(motivo)
            ? Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal) { ["motivo"] = MotivoObligatorio })
            : null;

    public static void Registrar(
        SimusDbContext db, string modulo, long registroId, int actor,
        string accion, string? estadoAnterior, string estadoNuevo, string? comentario, object? metadata = null)
    {
        var limpio = string.IsNullOrWhiteSpace(comentario) ? null : comentario.Trim();
        if (limpio is { Length: > 1200 }) limpio = limpio[..1200];

        db.HistorialesRevisionRegistros.Add(new HistorialRevisionRegistroRow
        {
            ModuloId = modulo,
            RegistroId = registroId.ToString(CultureInfo.InvariantCulture),
            EstadoAnterior = estadoAnterior,
            EstadoNuevo = estadoNuevo,
            Accion = accion,
            Comentario = limpio,
            // EL MOTIVO DE UNA DEVOLUCION O UN RECHAZO va además donde el resto de módulos lo guarda.
            MotivoRechazo = accion is AccionDevuelto or AccionRechazado ? limpio : null,
            UsuarioId = actor == 0 ? null : actor,
            Fecha = DateTime.UtcNow,
            MetadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata),
        });
    }

    /// <summary>Lo que se lee de cada acción, en vez de su código.</summary>
    public static string EtiquetaDe(string accion) => accion switch
    {
        AccionEstadoCambiado => "Cambio de estado",
        AccionErrata => "Errata corregida",
        AccionVueltaARevision => "Cambio de fondo: vuelve a revisión",
        AccionDevuelto => "Devuelto para corregir",
        AccionRechazado => "Rechazado",
        HistorialDeEventosDeOrganizacion.Creado => "Creado",
        HistorialDeEventosDeOrganizacion.EnviadoARevision => "Enviado a revisión",
        HistorialDeEventosDeOrganizacion.EditadoTrasPublicar => "Editado tras publicarse: vuelve a revisión",
        HistorialDeEventosDeOrganizacion.Publicado => "Publicado",
        HistorialDeEventosDeOrganizacion.Devuelto => "Devuelto para corregir",
        HistorialDeEventosDeOrganizacion.Retirado => "Retirado por la organización",
        HistorialDeEventosDeOrganizacion.Cancelado => "Evento cancelado",
        _ => HistorialDeFestival.Etiquetas.GetValueOrDefault(accion, accion),
    };

    /// <summary>
    /// El historial de estados de un registro, lo más reciente primero.
    /// </summary>
    /// <param name="db">El contexto.</param>
    /// <param name="modulo">El módulo, de <see cref="Modulos"/>.</param>
    /// <param name="registroId">El identificador del registro en su módulo.</param>
    /// <param name="vistoPorOrganizacion">
    /// Si lo lee una organización, cuál. <b>Solo se nombra a quien pertenece o perteneció a ella</b>;
    /// lo demás lo firma <see cref="FirmaDelPrograma"/>. Sin valor (consola), se nombra a todos.
    /// </param>
    /// <param name="ct">Cancelación.</param>
    /// <param name="vistoPorPersona">
    /// Si lo lee una persona sin organización (responsable independiente de un taller, un espacio o una red):
    /// se nombra a ella y lo demás lo firma <see cref="FirmaDelPrograma"/>.
    /// </param>
    public static Task<List<EntradaDeHistorialDeEstadosDto>> LeerAsync(
        SimusDbContext db, string modulo, string registroId, int? vistoPorOrganizacion, CancellationToken ct,
        int? vistoPorPersona = null) =>
        LeerAsync(db, h => h.ModuloId == modulo && h.RegistroId == registroId, vistoPorOrganizacion, ct, vistoPorPersona);

    /// <summary>
    /// El historial de las filas que cumplen <paramref name="filtro"/>, lo más reciente primero.
    /// </summary>
    /// <remarks>
    /// Existe para el Festival, cuyo historial reúne dos módulos —el Festival y sus
    /// Ediciones— con la misma lectura y la misma firma «Equipo del Programa».
    /// </remarks>
    public static async Task<List<EntradaDeHistorialDeEstadosDto>> LeerAsync(
        SimusDbContext db, Expression<Func<HistorialRevisionRegistroRow, bool>> filtro, int? vistoPorOrganizacion, CancellationToken ct,
        int? vistoPorPersona = null)
    {
        // QUIEN LEE DESDE FUERA DE LA CONSOLA (una organización o una persona) NO VE LOS NOMBRES DE LA CONSOLA.
        var desdeFuera = vistoPorOrganizacion is not null || vistoPorPersona is not null;
        var filas = await db.HistorialesRevisionRegistros.AsNoTracking()
            .Where(filtro)
            .OrderByDescending(h => h.Fecha).ThenByDescending(h => h.Id)
            .Take(200)
            .ToListAsync(ct);

        var ids = filas.Where(h => h.UsuarioId.HasValue).Select(h => h.UsuarioId!.Value).Distinct().ToList();
        var nombres = ids.Count == 0
            ? new Dictionary<int, string>()
            : await db.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        HashSet<int>? deLaOrganizacion = null;
        if (vistoPorOrganizacion is int organizacion && ids.Count > 0)
        {
            deLaOrganizacion = (await db.UserEntities.AsNoTracking()
                .Where(v => v.EntityId == organizacion && ids.Contains(v.UserId))
                .Select(v => v.UserId)
                .ToListAsync(ct)).ToHashSet();
        }
        else if (vistoPorPersona is int propia)
        {
            deLaOrganizacion = ids.Contains(propia) ? [propia] : [];
        }

        return filas.Select(h =>
        {
            string? actor = null;
            if (h.UsuarioId is int usuario)
            {
                var nombre = h.ActorNombre ?? nombres.GetValueOrDefault(usuario);
                actor = !desdeFuera || deLaOrganizacion?.Contains(usuario) == true
                    ? nombre
                    : FirmaDelPrograma;
            }
            else if (desdeFuera)
            {
                actor = FirmaDelPrograma;
            }

            return new EntradaDeHistorialDeEstadosDto(
                h.Id.ToString(CultureInfo.InvariantCulture),
                h.Accion,
                EtiquetaDe(h.Accion),
                h.EstadoAnterior,
                h.EstadoNuevo,
                h.MotivoRechazo ?? h.Comentario,
                actor,
                DateTime.SpecifyKind(h.Fecha, DateTimeKind.Utc));
        }).ToList();
    }
}
