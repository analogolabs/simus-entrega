using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Qué pasa con los procesos de una organización cuando la organización deja de operar.
/// </summary>
/// <remarks>
/// <para>
/// <b>EL AGUJERO QUE CIERRA.</b> Desde dar de baja una organización le
/// corta el acceso de verdad. Pero un Festival <b>publicado</b> cuya organización responsable acaba
/// de quedarse sin nadie dentro sigue en la página pública, con el nombre de esa organización
/// debajo, y ya no hay ser humano que pueda editarlo, proponerle un cambio ni registrarle una
/// edición. Tampoco se puede reclamar: <c>ReclamacionesAdministracionEndpoints</c> solo admite
/// reclamar lo que está en custodia del Programa. El proceso queda huérfano y nadie se entera hasta
/// que alguien pregunta por él.
/// </para>
/// <para>
/// <b>NO SE INVENTA MECANISMO.</b> El proyecto ya tiene el sitio donde devolver la custodia —la
/// entidad institucional— y ya tiene el acto que lo hace —liberar la administración, que escribe su
/// fila en <c>TransferenciasAdministracion</c> y deja el proceso reclamable—. Lo único que faltaba
/// era <b>obligar a usarlo</b> antes de cerrar la organización, y poder hacerlo para todos sus
/// procesos en un solo acto en vez de uno por uno.
/// </para>
/// <para>
/// <b>QUÉ CUENTA COMO DEPENDIENTE.</b> Un Festival cuya desaparición de su administradora deja algo
/// sin quién responda: los <b>publicados</b>, porque son públicos; los que están <b>en revisión</b>
/// o <b>aprobados</b>, porque la siguiente decisión institucional los publicaría sin administradora;
/// y los que tienen <b>ajustes solicitados</b>, porque se le pidieron a alguien que ya no está. Un
/// borrador no cuenta —no es público ni tiene nada pendiente del Programa— y un rechazado o
/// archivado tampoco, porque su ciclo terminó.
/// </para>
/// </remarks>
internal static class CustodiaDeProcesos
{
    /// <summary>
    /// Los estados de Festival en los que quedarse sin organización administradora deja algo sin
    /// quién responda.
    /// </summary>
    internal static readonly string[] EstadosQueDejanHuerfano =
        [EstadosFestival.Publicado, EstadosFestival.EnRevision, EstadosFestival.AjustesSolicitados];

    /// <summary>Un proceso que la organización administra, tal como lo ve la consola.</summary>
    /// <param name="Tipo">Uno de <see cref="ProcesoDelEvento"/>: el mismo identificador puede existir en dos tipos.</param>
    internal sealed record ProcesoAdministrado(int Id, string Nombre, string Estado, bool DejaHuerfano, string Tipo = ProcesoDelEvento.Festival);

    /// <summary>El módulo (y la tabla de la bitácora) de cada uno de los cuatro procesos simples.</summary>
    private static (string Modulo, string Tabla)? SimpleDe(string tipo) => tipo switch
    {
        ProcesoDelEvento.Mercado => (Modulos.Mercados, "Mercados"),
        ProcesoDelEvento.Taller => (Modulos.Talleres, "Talleres"),
        ProcesoDelEvento.Espacio => (Modulos.Espacios, "Espacios"),
        ProcesoDelEvento.Red => (Modulos.Redes, "Redes"),
        _ => null,
    };

    /// <summary>
    /// Los estados de un proceso simple en los que quedarse sin organización deja algo sin quién responda:
    /// la misma regla que los Festivales (publicado, en revisión y ajustes solicitados).
    /// </summary>
    private static readonly string[] EstadosSimplesQueDejanHuerfano = ["publicado", "en_revision", "ajustes_solicitados"];

    /// <summary>
    /// TODOS los procesos que administra la organización —Festivales, Mercados, Talleres, Espacios y Redes—,
    /// que es lo que mira el cierre de una organización (docs/desarrollo/30-consola-y-acceso.md §30.17: un solo modelo de procesos).
    /// </summary>
    /// <remarks>
    /// <see cref="DeLaOrganizacionAsync"/> sigue siendo solo de Festivales porque la ficha de la consola
    /// la usa para abrir esa ficha. Los procesos simples cuentan si están activos.
    /// </remarks>
    internal static async Task<List<ProcesoAdministrado>> TodosDeLaOrganizacionAsync(
        SimusDbContext db, int organizacionId, CancellationToken ct)
    {
        var todos = await DeLaOrganizacionAsync(db, organizacionId, ct);

        var mercados = await db.Mercados.AsNoTracking()
            .Where(x => x.OrganizacionPrincipalId == organizacionId && x.Activo)
            .Select(x => new { x.Id, x.Nombre, x.EstadoRegistro }).ToListAsync(ct);
        var talleres = await db.Talleres.AsNoTracking()
            .Where(x => x.OrganizacionPrincipalId == organizacionId && x.Activo)
            .Select(x => new { x.Id, x.Nombre, x.EstadoRegistro }).ToListAsync(ct);
        var espacios = await db.Espacios.AsNoTracking()
            .Where(x => x.OrganizacionPrincipalId == organizacionId && x.Activo)
            .Select(x => new { x.Id, x.Nombre, x.EstadoRegistro }).ToListAsync(ct);
        var redes = await db.Redes.AsNoTracking()
            .Where(x => x.OrganizacionPrincipalId == organizacionId && x.Activo)
            .Select(x => new { x.Id, x.Nombre, x.EstadoRegistro }).ToListAsync(ct);

        static ProcesoAdministrado Simple(string tipo, int id, string nombre, string estado) =>
            new(id, nombre, estado, Array.Exists(EstadosSimplesQueDejanHuerfano, e => e == estado), tipo);

        todos.AddRange(mercados.Select(x => Simple(ProcesoDelEvento.Mercado, x.Id, x.Nombre, x.EstadoRegistro)));
        todos.AddRange(talleres.Select(x => Simple(ProcesoDelEvento.Taller, x.Id, x.Nombre, x.EstadoRegistro)));
        todos.AddRange(espacios.Select(x => Simple(ProcesoDelEvento.Espacio, x.Id, x.Nombre, x.EstadoRegistro)));
        todos.AddRange(redes.Select(x => Simple(ProcesoDelEvento.Red, x.Id, x.Nombre, x.EstadoRegistro)));
        return todos;
    }

    /// <summary>
    /// Devuelve a la custodia del Programa un proceso que no es Festival, sin guardar. Es el mismo acto que
    /// <see cref="Liberar"/>: la fila de transferencia y la de la bitácora.
    /// </summary>
    internal static async Task LiberarSimpleAsync(
        SimusDbContext db, ProcesoAdministrado proceso, int institucionalId, int actorId, string motivo, DateTime ahora, CancellationToken ct)
    {
        var (modulo, tabla) = SimpleDe(proceso.Tipo) ?? throw new ArgumentException("Tipo de proceso no admitido.", nameof(proceso));
        var fila = await ReclamacionesAdministracionEndpoints.CargarSimpleAsync(db, modulo, proceso.Id, true, ct);
        if (fila is null) return;
        var anterior = fila.Organizacion ?? 0;
        fila.AsignarOrganizacion(institucionalId, ahora);
        var registro = proceso.Id.ToString(CultureInfo.InvariantCulture);

        db.AdministrationTransfers.Add(new AdministrationTransferRow
        {
            ModuloId = modulo,
            CanonicalRecordId = registro,
            PreviousOrganizationId = anterior,
            NewOrganizationId = institucionalId,
            ClaimId = null,
            DeciderId = actorId,
            Reason = ValidationHelpers.SanitizeText(motivo, 2400),
            PreviousStatus = fila.Estado,
            NewStatus = fila.Estado,
            ExecutedAt = ahora,
        });

        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = actorId,
            TableName = tabla,
            RecordId = registro,
            Action = AccionesAuditoria.Actualizar,
            PreviousValuesJson = JsonSerializer.Serialize(new { organizacionResponsableId = anterior }),
            NewValuesJson = JsonSerializer.Serialize(new
            {
                evento = "AdministracionLiberadaAlPrograma",
                organizacionResponsableId = institucionalId,
                motivo = ValidationHelpers.SanitizeText(motivo, 600),
            }),
            CreatedAt = ahora,
        });
    }

    /// <summary>
    /// Saca del sitio público un proceso que no es Festival conservando todo, y archiva sus eventos de la
    /// Agenda. NO BORRA NADA; sigue siendo de la organización que lo registró. No guarda.
    /// </summary>
    internal static async Task ArchivarSimpleAsync(
        SimusDbContext db, ProcesoAdministrado proceso, int actorId, string motivo, DateTime ahora, CancellationToken ct)
    {
        var (modulo, tabla) = SimpleDe(proceso.Tipo) ?? throw new ArgumentException("Tipo de proceso no admitido.", nameof(proceso));
        var limpio = ValidationHelpers.SanitizeText(motivo, 600);
        string anterior;
        switch (proceso.Tipo)
        {
            case ProcesoDelEvento.Mercado:
            {
                var m = await db.Mercados.FirstOrDefaultAsync(x => x.Id == proceso.Id, ct);
                if (m is null) return;
                anterior = m.EstadoRegistro; m.EstadoRegistro = "archivado"; m.FechaArchivado = ahora; m.FechaActualizacion = ahora;
                break;
            }
            case ProcesoDelEvento.Taller:
            {
                var t = await db.Talleres.FirstOrDefaultAsync(x => x.Id == proceso.Id, ct);
                if (t is null) return;
                anterior = t.EstadoRegistro; t.EstadoRegistro = "archivado"; t.FechaArchivado = ahora; t.FechaActualizacion = ahora; t.MotivoDeLaDecision = limpio;
                break;
            }
            case ProcesoDelEvento.Espacio:
            {
                var e = await db.Espacios.FirstOrDefaultAsync(x => x.Id == proceso.Id, ct);
                if (e is null) return;
                anterior = e.EstadoRegistro; e.EstadoRegistro = "archivado"; e.FechaArchivado = ahora; e.FechaActualizacion = ahora; e.MotivoDeLaDecision = limpio;
                break;
            }
            default:
            {
                var r = await db.Redes.FirstOrDefaultAsync(x => x.Id == proceso.Id, ct);
                if (r is null) return;
                anterior = r.EstadoRegistro; r.EstadoRegistro = "archivado"; r.FechaArchivado = ahora; r.FechaActualizacion = ahora; r.MotivoDeLaDecision = limpio;
                break;
            }
        }

        var registro = proceso.Id.ToString(CultureInfo.InvariantCulture);
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = actorId,
            TableName = tabla,
            RecordId = registro,
            Action = AccionesAuditoria.Archivar,
            PreviousValuesJson = JsonSerializer.Serialize(new { estado = anterior }),
            NewValuesJson = JsonSerializer.Serialize(new { evento = "ArchivadoAlCerrarLaOrganizacion", estado = "archivado", motivo = limpio }),
            CreatedAt = ahora,
        });
        HistorialDeEstados.Registrar(db, modulo, proceso.Id, actorId, HistorialDeEstados.AccionEstadoCambiado, anterior, "archivado", limpio);
        await ArchivoDeEventosDelProceso.ArchivarAsync(db, proceso.Tipo, proceso.Id, actorId, motivo, ahora, ct);
    }

    /// <summary>
    /// Los procesos que administra una organización, con su estado y si bloquean el cierre.
    /// </summary>
    /// <remarks>
    /// FESTIVAL ES EL UNICO PROCESO QUE ESTA CONSULTA CUBRE HOY. Cuando entren mercados, talleres y los demás,
    /// esta consulta crece aquí y no en cada pantalla que pregunte por los procesos de una
    /// organización.
    /// </remarks>
    internal static async Task<List<ProcesoAdministrado>> DeLaOrganizacionAsync(
        SimusDbContext db, int organizacionId, CancellationToken ct)
    {
        var filas = await db.FestivalRecords.AsNoTracking()
            .Where(festival => festival.OrganizacionPrincipalId == organizacionId)
            .OrderBy(festival => festival.Name)
            .Select(festival => new { festival.Id, festival.Name, festival.StatusCode })
            .ToListAsync(ct);

        return filas
            .Select(fila =>
            {
                // LA BASE GUARDA LAS DOS GRAFIAS. `publicado` y `Publicado` conviven desde la
                // importación del acervo; normalizar aquí evita que un festival publicado con la
                // grafía antigua se cuele como si no bloqueara nada.
                var estado = EstadosFestival.DesdeContrato(fila.StatusCode) ?? (fila.StatusCode ?? string.Empty);
                return new ProcesoAdministrado(
                    fila.Id,
                    fila.Name,
                    estado,
                    Array.Exists(EstadosQueDejanHuerfano, e => string.Equals(e, estado, StringComparison.OrdinalIgnoreCase)));
            })
            .ToList();
    }

    /// <summary>
    /// Devuelve un Festival a la custodia del Programa, sin guardar.
    /// </summary>
    /// <remarks>
    /// <para>
    /// NO LLAMA A <c>SaveChangesAsync</c> A PROPOSITO. Quien libera un proceso suelto lo hace en su
    /// propia transacción; quien cierra una organización libera todos los suyos y cambia el estado
    /// <b>en la misma</b>, porque liberar la mitad y fallar al cerrar deja un ecosistema peor que
    /// el de partida.
    /// </para>
    /// <para>
    /// DEJA DOS RASTROS Y HACEN FALTA LOS DOS: la fila de <c>TransferenciasAdministracion</c>, que
    /// es lo que cuenta la ficha del proceso cuando alguien pregunte cómo llegó a estar libre, y la
    /// de la bitácora, que es lo que cuenta la consola cuando alguien pregunte quién lo decidió.
    /// </para>
    /// </remarks>
    internal static void Liberar(
        SimusDbContext db,
        FestivalRow festival,
        int institucionalId,
        int actorId,
        string motivo,
        DateTime ahora)
    {
        var anterior = festival.OrganizacionPrincipalId!.Value;
        festival.OrganizacionPrincipalId = institucionalId;
        festival.UpdatedAt = ahora;

        db.AdministrationTransfers.Add(new AdministrationTransferRow
        {
            ModuloId = Modulos.Festivales,
            CanonicalRecordId = festival.Id.ToString(CultureInfo.InvariantCulture),
            PreviousOrganizationId = anterior,
            NewOrganizationId = institucionalId,
            // SIN RECLAMACION: no la pidió nadie, la decidió el Programa.
            ClaimId = null,
            DeciderId = actorId,
            Reason = ValidationHelpers.SanitizeText(motivo, 2400),
            PreviousStatus = festival.StatusCode,
            NewStatus = festival.StatusCode,
            ExecutedAt = ahora,
        });

        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = actorId,
            TableName = "Festivales",
            RecordId = festival.Id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Actualizar,
            PreviousValuesJson = JsonSerializer.Serialize(new { organizacionResponsableId = anterior }),
            NewValuesJson = JsonSerializer.Serialize(new
            {
                evento = "AdministracionLiberadaAlPrograma",
                organizacionResponsableId = institucionalId,
                motivo = ValidationHelpers.SanitizeText(motivo, 600),
            }),
            CreatedAt = ahora,
        });
    }

    /// <summary>Saca el proceso del sitio público conservando su historial y su auditoría.</summary>
    /// <remarks>
    /// <para>
    /// <b>ES LA OTRA SALIDA AL CIERRE DE UNA ORGANIZACION,</b> y significa algo distinto de liberar.
    /// Liberar dice «este proceso sigue vivo y ahora responde el Programa»; archivar dice «este
    /// proceso terminó con la organización». Un festival de una fundación disuelta que ya no se va a
    /// celebrar no debería quedarse publicado a nombre del Programa esperando a que alguien lo
    /// reclame. El criterio es este: «al eliminar una
    /// organización debe dar la opción de también eliminar los procesos registrados o liberarlos».
    /// </para>
    /// <para>
    /// <b>NO BORRA NADA.</b> Es el mismo acto que «Eliminar del ecosistema» sobre un Festival: el
    /// registro se queda con su ficha, su historial y su bitácora, y deja de verse en el portal.
    /// La custodia no cambia de manos: el proceso sigue siendo de la organización que lo registró,
    /// que es lo que hay que poder responder años después.
    /// </para>
    /// </remarks>
    internal static void Archivar(
        SimusDbContext db,
        FestivalRow festival,
        int actorId,
        string motivo,
        DateTime ahora)
    {
        var anterior = festival.StatusCode;
        festival.StatusCode = EstadosFestival.Archivado;
        festival.UpdatedAt = ahora;

        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = actorId,
            TableName = "Festivales",
            RecordId = festival.Id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Archivar,
            PreviousValuesJson = JsonSerializer.Serialize(new { estado = anterior }),
            NewValuesJson = JsonSerializer.Serialize(new
            {
                evento = "ArchivadoAlCerrarLaOrganizacion",
                estado = festival.StatusCode,
                motivo = ValidationHelpers.SanitizeText(motivo, 600),
            }),
            CreatedAt = ahora,
        });

        // EL HISTORIAL DE ESTADOS TAMBIÉN, con el motivo del cierre.
        HistorialDeFestival.Registrar(db, festival, actorId,
            HistorialDeFestival.ArchivadoAlCerrarLaOrganizacion, anterior, ValidationHelpers.SanitizeText(motivo, 600));
    }
}
