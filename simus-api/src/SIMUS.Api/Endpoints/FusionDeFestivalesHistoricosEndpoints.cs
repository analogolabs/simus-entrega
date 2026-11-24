using System.Data;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Fusionar dos copias del mismo Festival histórico (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1, decisión 18).
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ HACE FALTA.</b> El registro histórico se cargó desde varias fuentes y el mismo
/// Festival quedó dos veces («Muestra Andina de Cuerdas» en Manizales, en la demo). Mientras las
/// dos copias existan, dos organizaciones pueden reclamar cada una la suya y el portal enseña el
/// Festival repetido (REC-09). La consola ya las relacionaba; faltaba poder unirlas.
/// </para>
/// <para>
/// <b>QUÉ HACE.</b> El webmaster elige cuál se conserva. Al que se conserva pasan las ediciones,
/// los mercados y eventos que lo citan, sus archivos, sus clasificaciones y las solicitudes de
/// administración; los datos que le falten se completan con los del absorbido. El absorbido no se
/// borra: queda archivado, con la referencia al que lo absorbió —su ficha pública redirige—, y
/// conserva su bitácora y su historial, que la ficha del que se conserva lee junto al suyo.
/// </para>
/// <para>
/// <b>QUÉ NO PERMITE, Y POR QUÉ.</b> Solo une registros históricos —los que custodia el Programa—:
/// si uno ya lo administra una organización, fusionar decidiría por ella qué pasa con su Festival.
/// Tampoco une dos copias con solicitudes abiertas a la vez —la fusión no elige entre
/// organizaciones— ni una con la conciliación de datos a medias. Cada bloqueo dice qué hacer.
/// </para>
/// </remarks>
public static class FusionDeFestivalesHistoricosEndpoints
{
    private const int MaximoDeCandidatos = 20;

    public static RouteGroupBuilder MapFusionDeFestivalesHistoricosEndpoints(this RouteGroupBuilder api)
    {
        var admin = api.MapGroup("/admin/festivales")
            .WithTags("fusion-de-festivales")
            .RequireAuthorization(Permisos.PoliticaFuncionario);

        admin.MapGet("/{id:int}/fusion/candidatos", CandidatosAsync).WithName("CandidatosDeFusionDeFestival");
        // LA COMPARACIÓN LADO A LADO (T2): de solo lectura, con los mismos criterios que la fusión.
        admin.MapGet("/{id:int}/fusion/comparar", CompararAsync).WithName("CompararCopiasDeFestival");
        admin.MapPost("/{id:int}/fusion", FusionarAsync).WithName("FusionarFestivalesHistoricos")
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir)
            .AddEndpointFilter(CachePublicaFestivales.InvalidarTrasEscribir);
        return api;
    }

    /// <summary>
    /// Las otras copias del mismo Festival histórico, con lo que impediría fusionarlas.
    /// </summary>
    /// <remarks>
    /// Se proponen las parecidas por nombre en el mismo departamento —las mismas que la consola ya
    /// relaciona al decidir una reclamación—. <c>con</c> añade una concreta por su número, para la
    /// copia que se llama distinto.
    /// </remarks>
    private static async Task<IResult> CandidatosAsync(int id, int? con, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        if (!Permisos.EsWebmaster(principal)) return SoloWebmaster();
        var festival = await db.FestivalRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (festival is null) return Results.NotFound();

        var institucional = await ProcedenciaDeRegistro.IdInstitucionalAsync(db, ct);
        var nombres = await NombresDeOrganizacionAsync(db, [festival.OrganizacionPrincipalId], ct);
        var bloqueoPropio = BloqueoPropio(festival, institucional, nombres, conservado: true);

        // SE PUNTÚA CON EL NOMBRE SOLO y se traen las filas completas únicamente de las que se
        // proponen (como mucho veinte): un departamento grande tiene miles de históricos.
        var nombresCandidatos = await db.FestivalRecords.AsNoTracking()
            .Where(x => x.Id != id && x.FusionadoEnId == null
                && ((x.DepartmentCode == festival.DepartmentCode && x.OrganizacionPrincipalId == institucional) || x.Id == con))
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        var comparador = new ParecidoDeNombres.Consulta(festival.Name);
        var puntajes = nombresCandidatos
            .Select(x => (x.Id, x.Name, Puntaje: comparador.Puntaje(x.Name)))
            .Where(x => x.Id == con || x.Puntaje >= 2)
            .OrderByDescending(x => x.Id == con).ThenByDescending(x => x.Puntaje).ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Take(MaximoDeCandidatos)
            .ToList();
        var idsElegidos = puntajes.Select(x => x.Id).ToArray();
        var filas = (await db.FestivalRecords.AsNoTracking().Where(x => idsElegidos.Contains(x.Id)).ToListAsync(ct)).ToDictionary(x => x.Id);
        var elegidos = puntajes.Select(x => (Fila: filas[x.Id], x.Puntaje)).ToList();

        var ids = elegidos.Select(x => x.Fila.Id).Append(id).ToArray();
        var reclamaciones = await ReclamacionesAbiertasAsync(db, ids, ct);
        var ediciones = (await db.EdicionesFestival.AsNoTracking().Where(x => ids.Contains(x.FestivalId))
                .Select(x => new { x.FestivalId, x.Anio }).ToListAsync(ct))
            .GroupBy(x => x.FestivalId).ToDictionary(g => g.Key, g => g.ToList());
        nombres = await NombresDeOrganizacionAsync(db,
            elegidos.Select(x => x.Fila.OrganizacionPrincipalId).Concat(reclamaciones.Values.Select(r => (int?)r.RequestingOrganizationId)).Append(festival.OrganizacionPrincipalId), ct);
        var departamentos = elegidos.Select(e => e.Fila.DepartmentCode).Where(d => d != null).Distinct().ToArray();
        var lugares = await db.DivipolaLocations.AsNoTracking()
            .Where(x => departamentos.Contains(x.DepartmentCode))
            .Select(x => new { x.DepartmentCode, x.DepartmentName, x.MunicipalityCode, x.MunicipalityName }).ToListAsync(ct);

        var resultado = elegidos.Select(x =>
        {
            var fila = x.Fila;
            var bloqueo = Bloqueo(festival, fila, institucional, reclamaciones, nombres);
            var reclamo = reclamaciones.GetValueOrDefault(fila.Id);
            var propias = ediciones.GetValueOrDefault(fila.Id) ?? [];
            return new CandidatoDeFusionDto(
                fila.Id.ToString(CultureInfo.InvariantCulture), fila.Name, fila.StatusCode,
                lugares.FirstOrDefault(l => l.MunicipalityCode == fila.MunicipalityCode)?.MunicipalityName,
                lugares.FirstOrDefault(l => l.DepartmentCode == fila.DepartmentCode)?.DepartmentName,
                propias.Where(e => e.Anio != null).Select(e => e.Anio!.Value).Distinct().OrderByDescending(a => a).ToList(),
                propias.Count,
                reclamo is null ? null : nombres.GetValueOrDefault(reclamo.RequestingOrganizationId) ?? "otra organización",
                reclamo?.Status,
                x.Puntaje >= 2,
                bloqueo?.Codigo, bloqueo?.Mensaje,
                comparador.Razon(fila.Name));
        }).ToList();

        return Results.Ok(new CandidatosDeFusionDto(id.ToString(CultureInfo.InvariantCulture), festival.Name, bloqueoPropio?.Codigo, bloqueoPropio?.Mensaje, resultado));
    }

    /// <summary>
    /// Las dos copias lado a lado, con lo que la fusión conservaría, completaría y trasladaría.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>ES LA VISTA PREVIA DE LA FUSIÓN, NO OTRA REGLA.</b> Los datos que se completan salen de la
    /// misma tabla que usa <see cref="Completar"/>; los conteos del traslado, de las mismas consultas;
    /// y el bloqueo, de las mismas funciones. Si la fusión cambia, la comparación cambia con ella:
    /// no puede prometer algo que la fusión no hace.
    /// </para>
    /// <para>
    /// No escribe nada: ni bitácora ni historial. Solo el webmaster, como los candidatos.
    /// </para>
    /// </remarks>
    private static async Task<IResult> CompararAsync(int id, int con, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        if (!Permisos.EsWebmaster(principal)) return SoloWebmaster();
        if (con == id)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["con"] = ["Un Festival no se compara consigo mismo: elige la otra copia."] });

        var conservado = await db.FestivalRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        var absorbido = await db.FestivalRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == con, ct);
        if (conservado is null || absorbido is null) return Results.NotFound();

        var institucional = await ProcedenciaDeRegistro.IdInstitucionalAsync(db, ct);
        var reclamaciones = await ReclamacionesAbiertasAsync(db, [id, con], ct);
        var nombres = await NombresDeOrganizacionAsync(db,
            reclamaciones.Values.Select(r => (int?)r.RequestingOrganizationId).Append(conservado.OrganizacionPrincipalId).Append(absorbido.OrganizacionPrincipalId), ct);
        var bloqueo = BloqueoPropio(conservado, institucional, nombres, conservado: true)
            ?? Bloqueo(conservado, absorbido, institucional, reclamaciones, nombres);

        var departamentos = new[] { conservado.DepartmentCode, absorbido.DepartmentCode }.Where(x => !string.IsNullOrEmpty(x)).Distinct().ToArray();
        var lugares = await db.DivipolaLocations.AsNoTracking()
            .Where(x => departamentos.Contains(x.DepartmentCode))
            .Select(x => new { x.DepartmentCode, x.DepartmentName, x.MunicipalityCode, x.MunicipalityName }).ToListAsync(ct);
        string? Departamento(FestivalRow f) => lugares.FirstOrDefault(l => l.DepartmentCode == f.DepartmentCode)?.DepartmentName;
        string? Municipio(FestivalRow f) => lugares.FirstOrDefault(l => l.DepartmentCode == f.DepartmentCode && l.MunicipalityCode == f.MunicipalityCode)?.MunicipalityName;

        var ediciones = (await db.EdicionesFestival.AsNoTracking().Where(x => x.FestivalId == id || x.FestivalId == con)
                .Select(x => new { x.FestivalId, x.Anio }).ToListAsync(ct))
            .GroupBy(x => x.FestivalId).ToDictionary(g => g.Key, g => g.ToList());
        var edicionesConservado = ediciones.GetValueOrDefault(id) ?? [];
        var edicionesAbsorbido = ediciones.GetValueOrDefault(con) ?? [];
        List<int> Anios(IEnumerable<int?> anios) => anios.Where(a => a != null).Select(a => a!.Value).Distinct().OrderByDescending(a => a).ToList();
        var aniosConservado = Anios(edicionesConservado.Select(x => x.Anio));
        var aniosAbsorbido = Anios(edicionesAbsorbido.Select(x => x.Anio));

        CopiaComparadaDto Copia(FestivalRow f, List<int> anios, int total) => new(
            f.Id.ToString(CultureInfo.InvariantCulture), f.Name, f.StatusCode, Municipio(f), Departamento(f), anios, total);

        var campos = new List<CampoComparadoDto>
        {
            // LO QUE SIEMPRE SE CONSERVA: la fusión no toca estos datos de quien se queda.
            Fijo("nombre", "Nombre", conservado.Name, absorbido.Name),
            Fijo("estado", "Estado", conservado.StatusCode, absorbido.StatusCode),
            Fijo("nivelCobertura", "Alcance territorial", Cobertura(conservado.CoverageLevel), Cobertura(absorbido.CoverageLevel)),
            Fijo("departamento", "Departamento", Departamento(conservado), Departamento(absorbido)),
            Fijo("municipio", "Municipio", Municipio(conservado), Municipio(absorbido)),
        };
        // LO QUE SE COMPLETA SI AL QUE SE CONSERVA LE FALTA: la misma tabla que usa la fusión.
        foreach (var dato in Completables)
        {
            var propio = Vacio(dato.Leer(conservado));
            var ajeno = Vacio(dato.Leer(absorbido));
            var resultado = propio is null && ajeno is null ? "vacio"
                : propio is null ? "completa"
                : string.Equals(propio, ajeno, StringComparison.Ordinal) ? "igual"
                : "conserva";
            campos.Add(new CampoComparadoDto(dato.Clave, dato.Etiqueta, propio, ajeno, resultado, propio ?? ajeno));
        }

        // LAS LISTAS SE UNEN: la fusión añade al que se conserva lo que solo tenía la copia.
        var practicas = await db.PracticasMusicales.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Nombre, ct);
        campos.Add(await ListaAsync<PracticaMusicalDeRegistroRow>(db, "practicasMusicales", "Prácticas musicales", id, con, practicas, ct));
        var territorios = await db.TerritoriosSonoros.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Nombre, ct);
        campos.Add(await ListaAsync<TerritorioSonoroDeRegistroRow>(db, "territoriosSonoros", "Territorios sonoros", id, con, territorios, ct));

        var idAbsorbido = con.ToString(CultureInfo.InvariantCulture);
        var traslado = new TrasladoDeFusionDto(
            edicionesAbsorbido.Count,
            await db.Mercados.AsNoTracking().CountAsync(x => x.FestivalId == con, ct),
            await db.EventosAgenda.AsNoTracking().CountAsync(x => x.FestivalId == con, ct),
            await db.ArchivosDeRegistro.AsNoTracking().CountAsync(x => x.ModuloId == Modulos.Festivales && x.RegistroId == idAbsorbido, ct),
            await NuevosAsync<PracticaMusicalDeRegistroRow>(db, con, id, ct)
                + await NuevosAsync<TerritorioSonoroDeRegistroRow>(db, con, id, ct)
                + await NuevosAsync<ExpresionArtisticaDeRegistroRow>(db, con, id, ct)
                + await NuevosAsync<ModalidadParticipacionDeRegistroRow>(db, con, id, ct)
                + await NuevosAsync<TipoIngresoDeRegistroRow>(db, con, id, ct),
            await db.AdministrationClaims.AsNoTracking().CountAsync(x => x.ModuloId == Modulos.Festivales && x.CanonicalRecordId == idAbsorbido, ct),
            aniosConservado.Intersect(aniosAbsorbido).OrderByDescending(a => a).ToList());

        return Results.Ok(new ComparacionDeCopiasDto(
            Copia(conservado, aniosConservado, edicionesConservado.Count),
            Copia(absorbido, aniosAbsorbido, edicionesAbsorbido.Count),
            campos, traslado, bloqueo?.Codigo, bloqueo?.Mensaje));
    }

    private static string? Vacio(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static string? Cobertura(string? nivel) => nivel switch
    {
        "municipal" => "Municipal",
        "departamental" => "Departamental",
        "nacional" => "Nacional",
        _ => Vacio(nivel),
    };

    /// <summary>Un dato que la fusión nunca modifica en el Festival que se conserva.</summary>
    private static CampoComparadoDto Fijo(string clave, string etiqueta, string? propio, string? ajeno)
    {
        propio = Vacio(propio);
        ajeno = Vacio(ajeno);
        var resultado = propio is null && ajeno is null ? "vacio"
            : string.Equals(propio, ajeno, StringComparison.Ordinal) ? "igual"
            : "conserva";
        return new CampoComparadoDto(clave, etiqueta, propio, ajeno, resultado, propio);
    }

    /// <summary>Una lista de clasificación de las dos copias, con su unión.</summary>
    private static async Task<CampoComparadoDto> ListaAsync<T>(
        SimusDbContext db, string clave, string etiqueta, int conservado, int absorbido,
        Dictionary<int, string> catalogo, CancellationToken ct)
        where T : class, IClasificacionDeRegistro, new()
    {
        var propios = await db.ValoresAsync<T>(Modulos.Festivales, conservado, ct);
        var ajenos = await db.ValoresAsync<T>(Modulos.Festivales, absorbido, ct);
        string? Nombres(IEnumerable<int> ids) => Vacio(string.Join(", ", ids
            .Select(v => catalogo.GetValueOrDefault(v)).Where(n => !string.IsNullOrEmpty(n)).OrderBy(n => n, StringComparer.CurrentCultureIgnoreCase)));
        var union = propios.Union(ajenos).ToList();
        var resultado = propios.Count == 0 && ajenos.Count == 0 ? "vacio"
            : ajenos.Except(propios).Any() ? "une"
            : propios.Count == ajenos.Count ? "igual" : "conserva";
        return new CampoComparadoDto(clave, etiqueta, Nombres(propios), Nombres(ajenos), resultado, Nombres(union));
    }

    /// <summary>Cuántos valores de un vocabulario solo tiene la copia y se sumarían al que se conserva.</summary>
    private static async Task<int> NuevosAsync<T>(SimusDbContext db, int desde, int hacia, CancellationToken ct)
        where T : class, IClasificacionDeRegistro, new()
    {
        var suyos = await db.ValoresAsync<T>(Modulos.Festivales, desde, ct);
        var propios = await db.ValoresAsync<T>(Modulos.Festivales, hacia, ct);
        return suyos.Except(propios).Count();
    }

    /// <summary>Fusiona la copia <c>AbsorbidoId</c> en el Festival <paramref name="id"/>, que se conserva.</summary>
    private static async Task<IResult> FusionarAsync(int id, FusionarFestivalesSolicitud solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        if (!Permisos.EsWebmaster(principal)) return SoloWebmaster();
        if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var actor)) return Results.Unauthorized();

        var motivo = (solicitud.Motivo ?? string.Empty).Trim();
        if (!int.TryParse(solicitud.AbsorbidoId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var absorbidoId))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["absorbidoId"] = ["Elige la copia que se va a fusionar en este Festival."] });
        if (absorbidoId == id)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["absorbidoId"] = ["Un Festival no se fusiona consigo mismo: elige la otra copia."] });
        if (motivo.Length == 0)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["motivo"] = ["Escribe por qué son el mismo Festival: queda en la bitácora y en el historial de los dos registros."] });
        if (motivo.Length > 1200) motivo = motivo[..1200];

        var estrategia = db.Database.CreateExecutionStrategy();
        return await estrategia.ExecuteAsync<IResult>(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var conservado = await db.FestivalRecords.FirstOrDefaultAsync(x => x.Id == id, ct);
            var absorbido = await db.FestivalRecords.FirstOrDefaultAsync(x => x.Id == absorbidoId, ct);
            if (conservado is null || absorbido is null) return Results.NotFound();

            var institucional = await ProcedenciaDeRegistro.IdInstitucionalAsync(db, ct);
            var reclamaciones = await ReclamacionesAbiertasAsync(db, [id, absorbidoId], ct);
            var nombres = await NombresDeOrganizacionAsync(db,
                reclamaciones.Values.Select(r => (int?)r.RequestingOrganizationId).Append(conservado.OrganizacionPrincipalId).Append(absorbido.OrganizacionPrincipalId), ct);
            var bloqueo = BloqueoPropio(conservado, institucional, nombres, conservado: true)
                ?? Bloqueo(conservado, absorbido, institucional, reclamaciones, nombres);
            if (bloqueo is not null) return Results.Conflict(new { codigo = bloqueo.Codigo, message = bloqueo.Mensaje });

            var ahora = DateTime.UtcNow;
            var idConservado = id.ToString(CultureInfo.InvariantCulture);
            var idAbsorbido = absorbidoId.ToString(CultureInfo.InvariantCulture);

            // 1. LO QUE CUELGA DEL ABSORBIDO PASA AL QUE SE CONSERVA.
            var ediciones = await db.EdicionesFestival.Where(x => x.FestivalId == absorbidoId).ToListAsync(ct);
            foreach (var edicion in ediciones) { edicion.FestivalId = id; edicion.FechaActualizacion = ahora; }
            var mercados = await db.Mercados.Where(x => x.FestivalId == absorbidoId).ToListAsync(ct);
            foreach (var mercado in mercados) { mercado.FestivalId = id; mercado.FechaActualizacion = ahora; }
            var eventos = await db.EventosAgenda.Where(x => x.FestivalId == absorbidoId).ToListAsync(ct);
            foreach (var evento in eventos) evento.FestivalId = id;

            var referencias = await db.ReferenciasHistoricasFestival.Where(x => x.FestivalId == absorbidoId).ToListAsync(ct);
            var yaReferidas = await db.ReferenciasHistoricasFestival.AsNoTracking().Where(x => x.FestivalId == id).Select(x => x.OrganizacionId).ToListAsync(ct);
            foreach (var referencia in referencias.Where(x => !yaReferidas.Contains(x.OrganizacionId))) referencia.FestivalId = id;

            var archivos = await MoverArchivosAsync(db, idAbsorbido, idConservado, ct);
            var clasificaciones =
                await UnirAsync<PracticaMusicalDeRegistroRow>(db, absorbidoId, id, ahora, ct)
                + await UnirAsync<TerritorioSonoroDeRegistroRow>(db, absorbidoId, id, ahora, ct)
                + await UnirAsync<ExpresionArtisticaDeRegistroRow>(db, absorbidoId, id, ahora, ct)
                + await UnirAsync<ModalidadParticipacionDeRegistroRow>(db, absorbidoId, id, ahora, ct)
                + await UnirAsync<TipoIngresoDeRegistroRow>(db, absorbidoId, id, ahora, ct);

            // 2. LAS SOLICITUDES DE ADMINISTRACIÓN, ABIERTAS O CERRADAS, SIGUEN AL FESTIVAL. Una abierta
            //    se decide después sobre el que se conserva; la organización recibe un aviso.
            var reclamos = await db.AdministrationClaims.Where(x => x.ModuloId == Modulos.Festivales && x.CanonicalRecordId == idAbsorbido).ToListAsync(ct);
            foreach (var reclamo in reclamos)
            {
                reclamo.CanonicalRecordId = idConservado; reclamo.UpdatedAt = ahora;
                db.AuditLogs.Add(new AuditLogRow
                {
                    UserId = actor, TableName = "ReclamacionesAdministracion", RecordId = reclamo.Id.ToString(CultureInfo.InvariantCulture),
                    Action = AccionesAuditoria.Actualizar,
                    PreviousValuesJson = JsonSerializer.Serialize(new { festivalId = idAbsorbido }),
                    NewValuesJson = JsonSerializer.Serialize(new { evento = "ReclamacionTrasladadaPorFusion", festivalId = idConservado, estado = reclamo.Status }),
                    CreatedAt = ahora,
                });
                if (ReclamacionesAdministracionEndpoints.Activas.Contains(reclamo.Status))
                {
                    db.Notifications.Add(new NotificationRow
                    {
                        RecipientUserId = reclamo.RequestingPersonId, EventType = "ReclamacionTrasladadaPorFusion", Channel = "internal",
                        Title = "Tu solicitud sigue en curso",
                        Body = $"El PNMC unió dos copias de «{conservado.Name}» del registro histórico. Tu solicitud sigue igual, ahora sobre el registro que se conserva.",
                        Status = "enviada", ModuloId = "reclamaciones-administracion", RecordId = reclamo.Id.ToString(CultureInfo.InvariantCulture),
                        CreatedAt = ahora, SentAt = ahora,
                    });
                }
            }
            var transferencias = await db.AdministrationTransfers.Where(x => x.ModuloId == Modulos.Festivales && x.CanonicalRecordId == idAbsorbido).ToListAsync(ct);
            foreach (var transferencia in transferencias) transferencia.CanonicalRecordId = idConservado;

            // 3. LOS DATOS QUE LE FALTEN AL QUE SE CONSERVA, DEL ABSORBIDO. Nada se sobrescribe.
            var completados = Completar(conservado, absorbido);
            conservado.UpdatedAt = ahora;

            // 4. EL ABSORBIDO QUEDA ARCHIVADO Y APUNTA AL QUE LO ABSORBIÓ.
            var estadoAnterior = absorbido.StatusCode;
            absorbido.StatusCode = EstadosFestival.Archivado;
            absorbido.FusionadoEnId = id;
            absorbido.FechaFusion = ahora;
            absorbido.UpdatedAt = ahora;

            var resumen = new ResultadoDeFusionDto(idConservado, idAbsorbido, ediciones.Count, mercados.Count, eventos.Count, archivos, clasificaciones, reclamos.Count, completados);
            HistorialDeFestival.Registrar(db, conservado, actor, HistorialDeFestival.AbsorbioUnDuplicado, conservado.StatusCode,
                $"Absorbió «{absorbido.Name}» (#{idAbsorbido}): {motivo}");
            HistorialDeFestival.Registrar(db, absorbido, actor, HistorialDeFestival.FusionadoEnOtro, estadoAnterior,
                $"Fusionado en «{conservado.Name}» (#{idConservado}): {motivo}");
            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = actor, TableName = "Festivales", RecordId = idConservado, Action = AccionesAuditoria.Actualizar,
                NewValuesJson = JsonSerializer.Serialize(new
                {
                    evento = "FestivalHistoricoFusionado", absorbidoId = idAbsorbido, motivo,
                    ediciones = resumen.Ediciones, mercados = resumen.Mercados, eventos = resumen.Eventos, archivos = resumen.Archivos,
                    clasificaciones = resumen.Clasificaciones, reclamaciones = resumen.Reclamaciones, datosCompletados = completados,
                }),
                CreatedAt = ahora,
            });
            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = actor, TableName = "Festivales", RecordId = idAbsorbido, Action = AccionesAuditoria.Archivar,
                PreviousValuesJson = JsonSerializer.Serialize(new { estado = estadoAnterior }),
                NewValuesJson = JsonSerializer.Serialize(new { evento = "FestivalHistoricoAbsorbido", fusionadoEnId = idConservado, estado = absorbido.StatusCode, motivo }),
                CreatedAt = ahora,
            });

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Results.Ok(resumen);
        });
    }

    // ---------- Reglas ---------------------------------------------------------------------------

    private sealed record BloqueoDeFusion(string Codigo, string Mensaje);

    /// <summary>Lo que impide usar este Festival en una fusión, mirado solo a él.</summary>
    private static BloqueoDeFusion? BloqueoPropio(FestivalRow festival, int? institucional, Dictionary<int, string> nombres, bool conservado)
    {
        var quien = conservado ? "Este Festival" : $"«{festival.Name}»";
        if (festival.FusionadoEnId is not null)
            return new("ya_fusionado", $"{quien} ya se fusionó en otro registro. Abre el que lo absorbió.");
        if (institucional is null || festival.OrganizacionPrincipalId != institucional)
        {
            var organizacion = festival.OrganizacionPrincipalId is int org ? nombres.GetValueOrDefault(org) ?? "una organización" : "una organización";
            return new("tiene_organizacion",
                $"{quien} ya lo administra {organizacion}. La fusión solo une copias del registro histórico que nadie administra: "
                + "si es el mismo Festival, archiva la copia histórica desde su ficha, o devuelve este al PNMC antes de fusionar.");
        }
        if (conservado && string.Equals(festival.StatusCode, EstadosFestival.Archivado, StringComparison.OrdinalIgnoreCase))
            return new("conservado_archivado", "Este Festival está archivado. Publícalo antes, o conserva la otra copia y fusiona esta en ella.");
        return null;
    }

    /// <summary>Lo que impide fusionar <paramref name="absorbido"/> en <paramref name="conservado"/>.</summary>
    private static BloqueoDeFusion? Bloqueo(FestivalRow conservado, FestivalRow absorbido, int? institucional,
        Dictionary<int, AdministrationClaimRow> reclamaciones, Dictionary<int, string> nombres)
    {
        if (BloqueoPropio(absorbido, institucional, nombres, conservado: false) is { } propio) return propio;

        var enConservado = reclamaciones.GetValueOrDefault(conservado.Id);
        var enAbsorbido = reclamaciones.GetValueOrDefault(absorbido.Id);
        foreach (var (reclamo, nombre) in new[] { (enConservado, conservado.Name), (enAbsorbido, absorbido.Name) })
        {
            if (reclamo?.Status == "aprobada")
                return new("conciliacion_pendiente",
                    $"La solicitud sobre «{nombre}» está aprobada y {nombres.GetValueOrDefault(reclamo.RequestingOrganizationId) ?? "la organización"} "
                    + "está eligiendo qué datos conservar. Espera a que termine: entonces ese Festival ya no será un registro histórico.");
        }
        if (enConservado is not null && enAbsorbido is not null)
            return new("dos_reclamaciones_abiertas",
                $"Las dos copias tienen solicitudes abiertas: {nombres.GetValueOrDefault(enConservado.RequestingOrganizationId) ?? "una organización"} pide «{conservado.Name}» "
                + $"y {nombres.GetValueOrDefault(enAbsorbido.RequestingOrganizationId) ?? "otra"} pide la otra copia. La fusión no elige entre organizaciones: "
                + "decide una de las solicitudes (o pide una aclaración y rechaza la que no corresponda) y vuelve a fusionar.");
        return null;
    }

    private static async Task<Dictionary<int, AdministrationClaimRow>> ReclamacionesAbiertasAsync(SimusDbContext db, IReadOnlyCollection<int> festivales, CancellationToken ct)
    {
        var textos = festivales.Select(x => x.ToString(CultureInfo.InvariantCulture)).ToArray();
        var filas = await db.AdministrationClaims.AsNoTracking()
            .Where(x => x.ModuloId == Modulos.Festivales && textos.Contains(x.CanonicalRecordId) && ReclamacionesAdministracionEndpoints.Activas.Contains(x.Status))
            .ToListAsync(ct);
        return filas.GroupBy(x => int.Parse(x.CanonicalRecordId, CultureInfo.InvariantCulture))
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedAt).First());
    }

    private static async Task<Dictionary<int, string>> NombresDeOrganizacionAsync(SimusDbContext db, IEnumerable<int?> ids, CancellationToken ct)
    {
        var lista = ids.Where(x => x is not null).Select(x => x!.Value).Distinct().ToArray();
        return lista.Length == 0 ? [] : await db.EntityProfiles.AsNoTracking().Where(x => lista.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
    }

    // ---------- Piezas ---------------------------------------------------------------------------

    /// <summary>
    /// Los datos que la fusión completa en el Festival que se conserva cuando le faltan.
    /// </summary>
    /// <remarks>
    /// UNA SOLA TABLA para la fusión y para la comparación lado a lado: si un dato se añade o se
    /// quita aquí, las dos cambian a la vez y la comparación no promete algo que la fusión no hace.
    /// </remarks>
    private static readonly (string Clave, string Etiqueta, Func<FestivalRow, string?> Leer, Action<FestivalRow, string> Poner)[] Completables =
    [
        ("descripcion", "Descripción", f => f.Description, (f, v) => f.Description = v),
        ("correoContacto", "Correo de contacto", f => f.ContactEmail, (f, v) => f.ContactEmail = v),
        ("telefonoCelular", "Teléfono", f => f.ContactPhone, (f, v) => f.ContactPhone = v),
        ("instagram", "Instagram", f => f.InstagramUrl, (f, v) => f.InstagramUrl = v),
        ("facebook", "Facebook", f => f.FacebookUrl, (f, v) => f.FacebookUrl = v),
        ("paginaWeb", "Página web", f => f.WebsiteUrl, (f, v) => f.WebsiteUrl = v),
        ("otroEnlace", "Otro enlace", f => f.OtherUrl, (f, v) => f.OtherUrl = v),
        ("periodicidad", "Periodicidad", f => f.Periodicidad, (f, v) => f.Periodicidad = v),
        ("periodicidadDetalle", "Detalle de la periodicidad", f => f.PeriodicidadDetalle, (f, v) => f.PeriodicidadDetalle = v),
    ];

    /// <summary>Completa los datos vacíos del que se conserva. Devuelve qué completó.</summary>
    private static List<string> Completar(FestivalRow conservado, FestivalRow absorbido)
    {
        var completados = new List<string>();
        foreach (var dato in Completables)
        {
            var otro = dato.Leer(absorbido);
            if (string.IsNullOrWhiteSpace(dato.Leer(conservado)) && !string.IsNullOrWhiteSpace(otro))
            {
                dato.Poner(conservado, otro);
                completados.Add(dato.Etiqueta);
            }
        }
        return completados;
    }

    /// <summary>Añade al que se conserva los valores de un vocabulario que solo tenía el absorbido.</summary>
    private static async Task<int> UnirAsync<T>(SimusDbContext db, int desde, int hacia, DateTime ahora, CancellationToken ct)
        where T : class, IClasificacionDeRegistro, new()
    {
        var suyos = await db.ValoresAsync<T>(Modulos.Festivales, desde, ct);
        var propios = await db.ValoresAsync<T>(Modulos.Festivales, hacia, ct);
        var nuevos = suyos.Except(propios).ToList();
        db.Agregar<T>(Modulos.Festivales, hacia, nuevos, ahora);
        return nuevos.Count;
    }

    /// <summary>Mueve los archivos del Festival, detrás de los que ya tenga el que se conserva.</summary>
    private static async Task<int> MoverArchivosAsync(SimusDbContext db, string desde, string hacia, CancellationToken ct)
    {
        var suyos = await db.ArchivosDeRegistro.Where(x => x.ModuloId == Modulos.Festivales && x.RegistroId == desde).OrderBy(x => x.OrdenVisualizacion).ToListAsync(ct);
        if (suyos.Count == 0) return 0;
        var propios = await db.ArchivosDeRegistro.AsNoTracking().Where(x => x.ModuloId == Modulos.Festivales && x.RegistroId == hacia)
            .Select(x => new { x.RolArchivo, x.OrdenVisualizacion }).ToListAsync(ct);
        foreach (var grupo in suyos.GroupBy(x => x.RolArchivo))
        {
            var orden = propios.Where(x => x.RolArchivo == grupo.Key).Select(x => x.OrdenVisualizacion).DefaultIfEmpty(0).Max();
            foreach (var archivo in grupo) { archivo.RegistroId = hacia; archivo.OrdenVisualizacion = ++orden; }
        }
        return suyos.Count;
    }

    private static IResult SoloWebmaster() => Results.Json(new
    {
        codigo = "fusion_solo_webmaster",
        message = "Solo el administrador del sistema fusiona registros históricos.",
    }, statusCode: StatusCodes.Status403Forbidden);
}
