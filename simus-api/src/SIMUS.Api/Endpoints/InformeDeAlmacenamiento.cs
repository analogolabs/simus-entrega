using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El informe de almacenamiento del Banco de archivos (<c>docs/operacion/28-tabla-de-retencion-documental.md</c> §28.14 pieza 1).
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ EXISTE.</b> Los bytes viven en la base (<c>varbinary(max)</c>) y hasta ahora nada decía cuánto
/// pesaban ni avisaba de que se acercaran al tope de la oferta gratuita de Azure SQL (32 GB). Es la primera
/// pieza de <c>docs/operacion/28-tabla-de-retencion-documental.md</c> y la que permite decidir con números si hace falta archivar en frío.
/// </para>
/// <para>
/// <b>SOLO LEE Y NO ENTREGA CONTENIDO.</b> Cuenta bytes por procedencia, tipo, antigüedad y mes, los archivos sin
/// usar, los repetidos y las organizaciones que más pesan. No borra, no mueve y no archiva nada; no lleva nombres de
/// archivo ni de personas, solo el nombre de la organización. No es un dato personal, así que no escribe bitácora.
/// </para>
/// <para>
/// <b>LO QUE MIDE Y LO QUE NO.</b> Mide el Banco (<c>dbo.Archivos</c>). No mide los medios del sitio
/// (<c>dbo.MediosWeb</c>) ni el resto de las tablas: el porcentaje del tope es un MÍNIMO, y el informe lo dice.
/// El tope y los umbrales (80 % de atención, 90 % de alarma) son parámetros de configuración
/// (<c>Almacenamiento:TopeDeLaBaseBytes</c>, <c>:UmbralDeAtencion</c>, <c>:UmbralDeAlarma</c>), no valores fijos.
/// </para>
/// <para>
/// <b>EL ESTÁNDAR (<c>docs/operacion/29-gestion-de-archivos.md</c> §29.24).</b> El tope es POR ENTORNO: la demo lo fija en 32 GiB y, si un
/// entorno no lo trae, el informe da solo la cifra, sin porcentaje ni nivel (no inventa un tope que no existe).
/// Por debajo del 80 % solo hay cifra; del 80 % al 90 %, «atención»; desde el 90 %, «alarma». La proyección toma los
/// últimos doce meses y avisa si se llegaría al umbral de alarma en menos de seis meses. Solo la ve la consola con
/// el módulo Auditoría; ni las organizaciones ni el público.
/// </para>
/// </remarks>
public static class InformeDeAlmacenamiento
{
    internal const double UmbralDeAtencionPorOmision = 0.8;
    internal const double UmbralDeAlarmaPorOmision = 0.9;

    /// <summary>Los meses de margen por debajo de los cuales la proyección avisa.</summary>
    internal const double MesesDeAvisoDeLaProyeccion = 6;

    public readonly record struct Proyeccion(double? MesesHastaElUmbral, bool AvisaDeLlegadaPronta, long BytesPorMes);

    /// <summary>El nivel de la alarma según la fracción usada del tope. Es lo único que decide la pantalla.</summary>
    public static string NivelDe(double fraccion, double atencion, double alarma) =>
        fraccion >= alarma ? "alarma" : fraccion >= atencion ? "atencion" : "normal";

    /// <summary>
    /// Cuándo se llegaría al umbral si el crecimiento sigue como en los últimos doce meses.
    /// </summary>
    /// <param name="bytesPorMes">Los bytes subidos en cada uno de los últimos doce meses, del más antiguo al actual.</param>
    /// <param name="usados">Lo que pesa hoy el banco.</param>
    /// <param name="tope">El tope del entorno.</param>
    /// <param name="umbral">La fracción del tope que se quiere vigilar (la de alarma).</param>
    /// <returns>
    /// <c>MesesHastaElUmbral</c> es <c>0</c> si ya se pasó, <c>null</c> si no hay crecimiento con el que proyectar;
    /// <c>AvisaDeLlegadaPronta</c> es verdadero si se pasó o se llegaría en menos de seis meses.
    /// </returns>
    public static Proyeccion Proyectar(
        IReadOnlyList<long> bytesPorMes, long usados, long tope, double umbral)
    {
        // El promedio cuenta desde el primer mes con datos: un banco de tres meses no se promedia entre doce.
        var primero = -1;
        for (var i = 0; i < bytesPorMes.Count; i++) { if (bytesPorMes[i] > 0) { primero = i; break; } }
        var promedio = primero < 0 ? 0L : bytesPorMes.Skip(primero).Sum() / (bytesPorMes.Count - primero);

        var limite = tope * umbral;
        if (usados >= limite) { return new Proyeccion(0, true, promedio); }
        if (promedio <= 0) { return new Proyeccion(null, false, promedio); }
        var meses = (limite - usados) / promedio;
        return new Proyeccion(Math.Round(meses, 1), meses < MesesDeAvisoDeLaProyeccion, promedio);
    }

    internal static async Task<IResult> LeerAsync(
        SimusDbContext db, IConfiguration configuracion, System.Security.Claims.ClaimsPrincipal usuario, CancellationToken ct)
    {
        // SOLO CON AUDITORÍA: el Banco no basta. Quien gestiona archivos no tiene por qué ver el peso de la base.
        if (!await PermisosDeModulo.PuedeAsync(db, usuario, "auditoria", ct))
        {
            return Results.Problem(
                detail: "El informe de almacenamiento es del módulo Auditoría.",
                statusCode: StatusCodes.Status403Forbidden,
                title: "Sin permiso");
        }

        // SIN TOPE CONFIGURADO NO HAY PORCENTAJE: el tope es del entorno y no se inventa uno.
        var topeConfigurado = configuracion.GetValue<long?>("Almacenamiento:TopeDeLaBaseBytes");
        long? tope = topeConfigurado is > 0 ? topeConfigurado : null;
        var atencionConfigurada = configuracion.GetValue<double?>("Almacenamiento:UmbralDeAtencion");
        var atencion = atencionConfigurada is > 0 and <= 1 ? atencionConfigurada.Value : UmbralDeAtencionPorOmision;
        var alarmaConfigurada = configuracion.GetValue<double?>("Almacenamiento:UmbralDeAlarma");
        var alarma = alarmaConfigurada is > 0 and <= 1 ? alarmaConfigurada.Value : UmbralDeAlarmaPorOmision;
        if (alarma < atencion) { alarma = atencion; }

        // LAS MISMAS FILAS QUE OFRECE EL BANCO: sin bytes no es un archivo (ver `ListarAsync`).
        var archivos = db.Files.AsNoTracking()
            .Where(x => x.Content != null && (x.FileSizeBytes == null || x.FileSizeBytes > 0));
        var cuentasExternas = db.Users.AsNoTracking()
            .Where(u => u.AccessChannel == BancoDeArchivosEndpoints.CanalExterno).Select(u => u.Id);

        var total = await archivos.CountAsync(ct);
        var bytes = total == 0 ? 0L : await archivos.SumAsync(x => (long?)x.FileSizeBytes ?? 0L, ct);

        async Task<object> ParteAsync(string clave, string etiqueta, IQueryable<FileRow> consulta)
        {
            var n = await consulta.CountAsync(ct);
            return new { clave, etiqueta, archivos = n, bytes = n == 0 ? 0L : await consulta.SumAsync(x => (long?)x.FileSizeBytes ?? 0L, ct) };
        }

        var porProcedencia = new List<object>
        {
            await ParteAsync("institucional", "Del PNMC", archivos.Where(x => x.OrganizacionId == null && !cuentasExternas.Contains(x.UploadedByUserId))),
            await ParteAsync("organizaciones", "De organizaciones", archivos.Where(x => x.OrganizacionId != null)),
            await ParteAsync("personas", "De personas", archivos.Where(x => x.OrganizacionId == null && cuentasExternas.Contains(x.UploadedByUserId))),
        };

        var porTipo = (await archivos.GroupBy(x => x.MimeType)
                .Select(g => new { tipo = g.Key, archivos = g.Count(), bytes = g.Sum(x => (long?)x.FileSizeBytes ?? 0L) })
                .ToListAsync(ct))
            .OrderByDescending(x => x.bytes).ToList();

        var ahora = DateTime.UtcNow;
        var hace30 = ahora.AddDays(-30);
        var hace90 = ahora.AddDays(-90);
        var hace365 = ahora.AddDays(-365);
        var porAntiguedad = new List<object>
        {
            await ParteAsync("hasta_30", "Hasta 30 días", archivos.Where(x => x.CreatedAt >= hace30)),
            await ParteAsync("de_30_a_90", "De 30 a 90 días", archivos.Where(x => x.CreatedAt < hace30 && x.CreatedAt >= hace90)),
            await ParteAsync("de_90_a_365", "De 90 días a un año", archivos.Where(x => x.CreatedAt < hace90 && x.CreatedAt >= hace365)),
            await ParteAsync("mas_de_un_ano", "Más de un año", archivos.Where(x => x.CreatedAt < hace365)),
        };

        // SIN USAR: la misma regla del Banco, para que el informe y la lista no se separen.
        var sinUsar = BancoDeArchivosEndpoints.SoloSinUso(db, archivos);
        var sinUsarTotal = await sinUsar.CountAsync(ct);
        var sinUsarBytes = sinUsarTotal == 0 ? 0L : await sinUsar.SumAsync(x => (long?)x.FileSizeBytes ?? 0L, ct);

        // REPETIDOS: el mismo contenido (misma huella) guardado más de una vez. Entre dueños no se
        // deduplica hoy (docs/operacion/28-tabla-de-retencion-documental.md §28.14 pieza 3); aquí se mide cuánto se ganaría.
        var repetidos = await archivos.Where(x => x.Fingerprint != null)
            .GroupBy(x => x.Fingerprint)
            .Where(g => g.Count() > 1)
            .Select(g => new { copias = g.Count(), peso = g.Max(x => (long?)x.FileSizeBytes ?? 0L) })
            .ToListAsync(ct);
        var repetidosSobrantes = repetidos.Sum(x => x.copias - 1);
        var repetidosBytes = repetidos.Sum(x => (x.copias - 1) * x.peso);

        // LAS ORGANIZACIONES QUE MÁS PESAN, contra su cuota de 50 MiB.
        var mayores = await archivos.Where(x => x.OrganizacionId != null)
            .GroupBy(x => x.OrganizacionId!.Value)
            .Select(g => new { id = g.Key, archivos = g.Count(), bytes = g.Sum(x => (long?)x.FileSizeBytes ?? 0L) })
            .OrderByDescending(x => x.bytes).Take(10)
            .ToListAsync(ct);
        var ids = mayores.Select(x => x.id).ToList();
        var nombres = await db.EntityProfiles.AsNoTracking().Where(e => ids.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.Name, ct);
        var organizaciones = mayores.Select(x => new
        {
            organizacionId = x.id,
            nombre = nombres.TryGetValue(x.id, out var n) ? n : null,
            x.archivos,
            x.bytes,
            cuotaBytes = BancoDeArchivosEndpoints.CuotaPorOrganizacion,
            fraccionDeLaCuota = Math.Round(x.bytes / (double)BancoDeArchivosEndpoints.CuotaPorOrganizacion, 4),
        }).ToList();

        // EL CRECIMIENTO, MES A MES, de los últimos doce meses calendario.
        var desde = new DateTime(ahora.Year, ahora.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-11);
        var meses = await archivos.Where(x => x.CreatedAt >= desde)
            .GroupBy(x => new { x.CreatedAt.Year, x.CreatedAt.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, archivos = g.Count(), bytes = g.Sum(x => (long?)x.FileSizeBytes ?? 0L) })
            .ToListAsync(ct);
        var crecimiento = Enumerable.Range(0, 12).Select(i =>
        {
            var mes = desde.AddMonths(i);
            var fila = meses.FirstOrDefault(x => x.Year == mes.Year && x.Month == mes.Month);
            return new { mes = $"{mes.Year:0000}-{mes.Month:00}", archivos = fila?.archivos ?? 0, bytes = fila?.bytes ?? 0L };
        }).ToList();

        // LOS MEDIOS DEL SITIO (`dbo.MediosWeb`), APARTE: son bytes de la misma base, pero no del Banco. Se informan sin
        // sumarlos al total ni al nivel, para que la cifra del Banco siga siendo la de siempre; el aviso los nombra.
        var medios = await db.ImagenesWeb.AsNoTracking()
            .Select(x => (long)(x.DraftContent != null ? x.DraftContent.Length : 0)
                + (x.DraftThumbnail != null ? x.DraftThumbnail.Length : 0)
                + (x.PublishedContent != null ? x.PublishedContent.Length : 0)
                + (x.PublishedThumbnail != null ? x.PublishedThumbnail.Length : 0))
            .ToListAsync(ct);

        double? fraccion = tope is null ? null : bytes / (double)tope.Value;
        var proyeccion = tope is null ? (Proyeccion?)null : Proyectar(crecimiento.Select(x => x.bytes).ToList(), bytes, tope.Value, alarma);
        return Results.Ok(new
        {
            generadoEn = ahora,
            total = new { archivos = total, bytes },
            tope = new
            {
                bytes = tope,
                fraccionUsada = fraccion is null ? (double?)null : Math.Round(fraccion.Value, 6),
                umbralDeAtencion = atencion,
                umbralDeAlarma = alarma,
                nivel = fraccion is null ? "sinTope" : NivelDe(fraccion.Value, atencion, alarma),
                // El porcentaje cuenta solo el Banco: es un mínimo del uso real de la base.
                soloMideElBanco = true,
            },
            mediosDelSitio = new { medios = medios.Count, bytes = medios.Sum() },
            proyeccion = proyeccion is null ? null : new
            {
                bytesPorMes = proyeccion.Value.BytesPorMes,
                mesesHastaElUmbral = proyeccion.Value.MesesHastaElUmbral,
                avisaDeLlegadaPronta = proyeccion.Value.AvisaDeLlegadaPronta,
            },
            porProcedencia,
            porTipo,
            porAntiguedad,
            sinUsar = new { archivos = sinUsarTotal, bytes = sinUsarBytes },
            repetidos = new { copiasSobrantes = repetidosSobrantes, bytes = repetidosBytes },
            organizacionesQueMasPesan = organizaciones,
            crecimientoMensual = crecimiento,
        });
    }
}
