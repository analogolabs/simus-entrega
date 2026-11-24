using System.Data;
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

/// <summary>
/// Los eventos que una organización anuncia sobre sus propios procesos.
/// </summary>
/// <remarks>
/// <para>
/// <b>LA REGLA ENTERA ES: NINGÚN EVENTO SIN PROCESO.</b> Una organización no publica eventos
/// sueltos en la agenda del Programa; publica eventos <b>de sus procesos</b> —su festival, su
/// mercado—. Si no tiene ninguno aprobado, no tiene qué anunciar aquí. Sin esa regla, la agenda
/// pública se convertiría en un tablón abierto donde cualquiera con cuenta escribe.
/// </para>
/// <para>
/// <b>FESTIVAL O MERCADO, PUBLICADO Y SUYO</b> (decisión del 5 de noviembre de 2026). Un
/// proceso en borrador o en revisión todavía no existe para el público: colgarle un evento
/// anunciaría en la agenda algo cuyo marco nadie ha aprobado.
/// </para>
/// <para>
/// <b>BORRADOR → EN REVISIÓN → PUBLICADO.</b> Quien escribe puede guardar un borrador, que solo ve su
/// organización, y enviarlo después. No decide si se publica: eso es del Programa. Cada cambio de
/// estado deja su fila en <c>RegistrosRevisionHistorial</c>, como Festivales y Mercados.
/// </para>
/// <para>
/// <b>UN EVENTO PUBLICADO SE CORRIGE, SE RETIRA O SE CANCELA</b> (D3-12 y D3-13, docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 24).
/// Una errata se corrige al instante y el evento sigue en la agenda; un cambio de fondo lo devuelve
/// a revisión (<see cref="ReglasDeErrataDeEventos"/>). La organización puede retirarlo —sale de la
/// agenda— o marcarlo como cancelado —sigue en la agenda, con su aviso y su motivo—, siempre con
/// motivo: lo que se retira o se cancela ya lo vio el público.
/// </para>
/// <para>
/// <b>TALLERES, ESPACIOS Y REDES, TAMBIÉN SIN ORGANIZACIÓN</b> (LUT-01 y LUT-02, decisión 104 de docs/referencia/20-decisiones-y-flujos-por-modulo.md). Los
/// procesos de lutería, de música en vivo y de redes y documentación no tienen una Agenda aparte: se
/// anuncian como eventos de esta, con la misma regla de errata, retiro y cancelación. Un taller, un
/// espacio o una red de una <b>persona sin organización</b> también enmarca eventos: las mismas operaciones
/// viven bajo <c>/externo/mis-eventos</c> (Mi espacio) con un <see cref="AlcanceDeEventos"/> de persona.
/// </para>
/// <para>
/// <b>NO ES UN SEGUNDO MODELO DE AGENDA.</b> Escribe la misma fila de <c>dbo.EventosAgenda</c> que
/// la consola, con las mismas reglas de <c>ReglasDeAgenda</c> y el mismo circuito de estados. Lo
/// único propio es de dónde viene y que exige proceso.
/// </para>
/// </remarks>
public static class EventosDeOrganizacionEndpoints
{
    private static readonly string[] ProcesoObligatorio =
        ["Elige el proceso en el que se enmarca el evento. Un evento sin proceso no se puede anunciar."];
    private static readonly string[] UnSoloProceso =
        ["Un evento se enmarca en un solo proceso: elige uno, no varios."];
    private static readonly string[] ProcesoAjeno =
        ["Ese proceso no pertenece a tu organización o todavía no está publicado."];
    private static readonly string[] TituloObligatorio = ["El título del evento es obligatorio."];
    private static readonly string[] DescripcionObligatoria = ["La descripción del evento es obligatoria."];
    private static readonly string[] FinAntesDelInicio = ["El evento no puede terminar antes de empezar."];
    private static readonly string[] HoraFinSinInicio = ["No puede haber hora de fin sin hora de inicio."];
    private static readonly string[] TestigoInvalido = ["La solicitud no pudo validarse. Actualiza la página e inténtalo nuevamente."];
    private static readonly string[] MunicipioSinDepartamento =
        ["Elige también el departamento: un municipio sin su departamento no ubica el evento."];
    private const string NoEditable = "Un evento archivado o rechazado ya no se puede editar.";
    private const string SoloBorradorSeEnvia = "Solo se envía a revisión un evento en borrador.";
    private const string SoloPublicadoSeRetira = "Solo se retira un evento publicado.";
    private const string SoloPublicadoSeCancela = "Solo se cancela un evento publicado.";
    private const string YaCancelado = "Este evento ya está cancelado.";
    private const string CanceladoNoSeEdita = "Un evento cancelado ya no se puede editar.";
    private const int MaximoDelMotivo = 500;
    private static readonly string[] MotivoObligatorio =
        ["Escribe el motivo: lo que se retira o se cancela ya lo vio el público, y quien lo lea necesita saber qué pasó."];
    private static readonly string[] MotivoDemasiadoLargo =
        [$"El motivo admite hasta {MaximoDelMotivo} caracteres."];

    public static RouteGroupBuilder MapEventosDeOrganizacionEndpoints(this RouteGroupBuilder group)
    {
        var externo = group.MapGroup("/externo/organizaciones/{organizacionId:int}")
            .WithTags("eventos-de-organizacion");
        externo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        MapearOperaciones(externo, "/eventos", "Organizacion");

        // LA PERSONA SIN ORGANIZACIÓN (LUT-01): sus talleres, espacios y redes enmarcan eventos de la
        // Agenda con las MISMAS operaciones y las mismas reglas; solo cambia de quién es el proceso.
        var propio = group.MapGroup("/externo/mis-eventos").WithTags("eventos-de-persona");
        propio.RequireAuthorization(SimusAuthentication.ExternalPolicy);
        MapearOperaciones(propio, string.Empty, "Persona");

        return group;
    }

    private static void MapearOperaciones(RouteGroupBuilder externo, string eventos, string quien)
    {
        externo.MapGet("/procesos-que-enmarcan", ProcesosAsync).WithName("ProcesosQueEnmarcanEventos" + (quien == "Organizacion" ? string.Empty : "De" + quien));
        externo.MapGet(eventos, ListarAsync).WithName("ListarEventosDe" + quien);
        externo.MapGet(eventos + "/{eventoId:long}", ObtenerAsync).WithName("ObtenerEventoDe" + quien);
        externo.MapPost(eventos, CrearAsync).WithName("CrearEventoDe" + quien);
        // EDITAR, RETIRAR Y CANCELAR VACÍAN LA CACHÉ PÚBLICA (D3-16): un evento retirado o cancelado
        // no puede seguir apareciendo sin aviso hasta un minuto después.
        externo.MapPut(eventos + "/{eventoId:long}", EditarAsync).WithName("EditarEventoDe" + quien)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir);
        externo.MapPost(eventos + "/{eventoId:long}/enviar", EnviarARevisionAsync).WithName("EnviarEventoDe" + quien + "ARevision");
        externo.MapPost(eventos + "/{eventoId:long}/retirar", RetirarAsync).WithName("RetirarEventoDe" + quien)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir);
        externo.MapPost(eventos + "/{eventoId:long}/cancelar", CancelarAsync).WithName("CancelarEventoDe" + quien)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir);
        // EL HISTORIAL LO LEE TAMBIEN EL EDITOR: leer es de quien prepara, como la lista.
        externo.MapGet(eventos + "/{eventoId:long}/historial", HistorialAsync).WithName("HistorialDeEventoDe" + quien)
            .Produces<List<EntradaDeHistorialDeEstadosDto>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);
    }

    /// <summary>
    /// Los procesos de la organización que pueden enmarcar un evento.
    /// </summary>
    /// <remarks>
    /// SI ESTA LISTA VIENE VACIA, LA PANTALLA NO OFRECE EL FORMULARIO. Es más honesto que dejar
    /// escribir un evento entero para rechazarlo al guardar por algo que se sabía desde el
    /// principio.
    /// </remarks>
    private static async Task<IResult> ProcesosAsync(AlcanceDeEventos alcance, SimusDbContext db, CancellationToken ct)
    {
        if (alcance.Persona <= 0) return Results.Unauthorized();
        if (!await Edita(db, alcance, ct)) return Results.Forbid();

        return Results.Ok(await ProcesoDelEvento.PublicadosAsync(db, alcance, ct));
    }

    /// <summary>Los eventos que esta organización ha anunciado, con el proceso que los enmarca.</summary>
    private static async Task<IResult> ListarAsync(AlcanceDeEventos alcance, SimusDbContext db, CancellationToken ct)
    {
        if (alcance.Persona <= 0) return Results.Unauthorized();
        if (!await Edita(db, alcance, ct)) return Results.Forbid();

        // SUS EVENTOS SON LOS DE SUS PROCESOS. No hay columna de «organización» en la agenda, y no
        // hace falta: el proceso que los enmarca ya dice de quién son, y esa es justo la relación
        // que este circuito obliga a declarar.
        var nombres = await ProcesoDelEvento.NombresAsync(db, alcance, ct);
        if (nombres.Count == 0) return Results.Ok(Array.Empty<EventoDeOrganizacionDto>());

        var eventos = await ProcesoDelEvento.DelAlcance(db, alcance, rastrear: false)
            .OrderByDescending(e => e.FechaInicio)
            .ToListAsync(ct);

        var motivos = await HistorialDeEventosDeOrganizacion.UltimosMotivosAsync(
            db, eventos.Select(e => e.Id.ToString(CultureInfo.InvariantCulture)).ToList(), ct);

        return Results.Ok(eventos.Select(e =>
        {
            var id = e.Id.ToString(CultureInfo.InvariantCulture);
            var proceso = ProcesoDelEvento.De(e);
            var nombre = proceso is { } p ? nombres.GetValueOrDefault(ProcesoDelEvento.Clave(p.Tipo, p.Id)) : null;
            return new EventoDeOrganizacionDto(
                id,
                e.Titulo,
                e.FechaInicio,
                e.FechaFin,
                e.Modalidad,
                e.Lugar,
                e.Estado,
                EtiquetaDeEstado(e.Estado, e.Cancelado),
                nombre,
                e.FechaActualizacion,
                proceso?.Tipo,
                e.Estado is "borrador" or "rechazado" ? motivos.GetValueOrDefault(id) : null,
                e.Cancelado,
                e.Cancelado ? e.MotivoCancelacion : null);
        }).ToList());
    }

    /// <summary>Un evento de la organización, completo, para volver a editarlo.</summary>
    private static async Task<IResult> ObtenerAsync(
        AlcanceDeEventos alcance, long eventoId, SimusDbContext db, CancellationToken ct)
    {
        var persona = alcance.Persona;
        if (persona <= 0) return Results.Unauthorized();
        if (!await Administra(db, alcance, ct)) return Results.Forbid();

        var evento = await EventoDelAlcanceAsync(db, alcance, eventoId, rastrear: false, ct);
        if (evento is null) return Results.NotFound();

        var id = evento.Id.ToString(CultureInfo.InvariantCulture);
        var motivos = await HistorialDeEventosDeOrganizacion.UltimosMotivosAsync(db, [id], ct);

        return Results.Ok(new EventoDeOrganizacionDetalleDto(
            id,
            evento.Titulo,
            evento.Descripcion,
            evento.DescripcionLarga,
            evento.FechaInicio,
            evento.FechaFin,
            evento.HoraInicio,
            evento.HoraFin,
            evento.Modalidad,
            evento.Lugar,
            evento.CodigoDepartamento,
            evento.CodigoMunicipio,
            evento.Url,
            evento.FestivalId,
            evento.MercadoId,
            evento.Estado,
            EtiquetaDeEstado(evento.Estado, evento.Cancelado),
            evento.Estado is "borrador" or "rechazado" ? motivos.GetValueOrDefault(id) : null,
            evento.Cancelado,
            evento.Cancelado ? evento.MotivoCancelacion : null,
            evento.TallerId,
            evento.EspacioId,
            evento.RedId));
    }

    private static async Task<IResult> CrearAsync(
        AlcanceDeEventos alcance,
        CrearEventoDeOrganizacionSolicitud solicitud,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext http,
        PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest(new { message = TestigoInvalido[0] });

        var persona = alcance.Persona;
        if (persona <= 0) return Results.Unauthorized();
        if (!await Administra(db, alcance, ct)) return Results.Forbid();

        // ANUNCIAR UN EVENTO ES REPRESENTAR A LA ORGANIZACION EN PUBLICO, así que pide la misma
        // dirección comprobada que registrar un proceso.
        if (await ExigirCorreoAsync(db, politicaDeConfirmacion, alcance, "anunciar eventos", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        if (await ValidarAsync(db, alcance, solicitud, ct) is { } invalido) return invalido;

        var titulo = Limpiar(solicitud.Titulo)!;
        var slug = ReglasDeAgenda.SlugDesde(titulo);
        if (slug.Length == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["titulo"] = TituloObligatorio });
        slug = await SlugLibreAsync(db, slug, ct);

        var ahora = DateTime.UtcNow;
        var evento = new EventoAgendaRow
        {
            Slug = slug,
            // SOLO ELIGE SI LO ENVÍA YA. Quien lo escribe nunca decide si se publica.
            Estado = solicitud.Borrador ? "borrador" : "en_revision",
            Version = 1,
            FechaCreacion = ahora,
        };
        Aplicar(evento, solicitud, ahora);

        var estrategia = db.Database.CreateExecutionStrategy();
        await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            db.EventosAgenda.Add(evento);
            await db.SaveChangesAsync(ct);

            // DE DONDE VIENE: lo anunció la organización desde su espacio, así que la procedencia
            // es ella y el ejecutor la persona que lo escribió.
            await ProcedenciaDeRegistro.AnotarAsync(
                db,
                Modulos.Agenda,
                evento.Id.ToString(CultureInfo.InvariantCulture),
                ProcedenciaDeRegistro.Externo,
                alcance.OrganizacionId,
                persona,
                ct);

            await HistorialDeEventosDeOrganizacion.AnotarAsync(
                db, evento, null,
                evento.Estado == "borrador" ? HistorialDeEventosDeOrganizacion.Creado : HistorialDeEventosDeOrganizacion.EnviadoARevision,
                null, persona, ahora, ct);

            db.AuditLogs.Add(new AuditLogRow
            {
                UserId = persona,
                TableName = "EventosAgenda",
                RecordId = evento.Id.ToString(CultureInfo.InvariantCulture),
                Action = AccionesAuditoria.Crear,
                NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new
                {
                    evento = alcance.EsDePersona ? "EventoAnunciadoPorPersona" : "EventoAnunciadoPorOrganizacion",
                    organizacionId = alcance.OrganizacionId,
                    procesoId = ProcesoDelEvento.De(solicitud)?.Id,
                    procesoTipo = ProcesoDelEvento.De(solicitud)?.Tipo,
                    estado = evento.Estado,
                }),
                CreatedAt = ahora,
            });

            await db.SaveChangesAsync(ct);
            await transaccion.CommitAsync(ct);
        });

        return Results.Created(
            alcance.OrganizacionId is int organizacion
                ? $"/api/v1/externo/organizaciones/{organizacion}/eventos/{evento.Id}"
                : $"/api/v1/externo/mis-eventos/{evento.Id}",
            new { id = evento.Id.ToString(CultureInfo.InvariantCulture), estado = evento.Estado });
    }

    /// <summary>
    /// Cambia un evento de la organización.
    /// </summary>
    /// <remarks>
    /// <b>UN EVENTO PUBLICADO ADMITE ERRATAS AL INSTANTE; UN CAMBIO DE FONDO VUELVE A REVISIÓN</b>
    /// (D3-12). Lo que la agenda pública enseña lo aprobó el Programa: si la organización cambia qué,
    /// cuándo, dónde o por quién se anuncia, lo nuevo todavía no está aprobado. Si solo corrige
    /// ortografía o redacción, el evento sigue en la agenda. Lo decide el servidor comparando lo que
    /// hay con lo que llega, no quien edita (<see cref="ReglasDeErrataDeEventos"/>). Un borrador sigue
    /// en borrador si así se pide; uno enviado no vuelve a borrador por editarlo. Un evento cancelado
    /// ya no se edita.
    /// </remarks>
    /// <summary>Los campos de un evento cuyo cambio queda en el registro de cambios (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).</summary>
    public static readonly IReadOnlyList<CampoVigilado<EventoAgendaRow>> CamposVigilados =
    [
        new("titulo", "Título", ClaseDeDato.Publico, x => x.Titulo),
        new("descripcion", "Descripción corta", ClaseDeDato.Publico, x => x.Descripcion),
        new("descripcionLarga", "Descripción", ClaseDeDato.Publico, x => x.DescripcionLarga),
        new("fechaInicio", "Fecha de inicio", ClaseDeDato.Publico, x => x.FechaInicio),
        new("fechaFin", "Fecha de fin", ClaseDeDato.Publico, x => x.FechaFin),
        new("horaInicio", "Hora de inicio", ClaseDeDato.Publico, x => x.HoraInicio),
        new("horaFin", "Hora de fin", ClaseDeDato.Publico, x => x.HoraFin),
        new("modalidad", "Modalidad", ClaseDeDato.Publico, x => x.Modalidad),
        new("lugar", "Lugar", ClaseDeDato.Publico, x => x.Lugar),
        new("codigoDepartamento", "Departamento", ClaseDeDato.Publico, x => x.CodigoDepartamento, CatalogoDeCampo.Departamento),
        new("codigoMunicipio", "Municipio", ClaseDeDato.Publico, x => x.CodigoMunicipio, CatalogoDeCampo.Municipio),
        new("url", "Enlace", ClaseDeDato.Publico, x => x.Url),
        new("festivalId", "Festival", ClaseDeDato.Publico, x => x.FestivalId, CatalogoDeCampo.Festival),
        new("mercadoId", "Mercado", ClaseDeDato.Publico, x => x.MercadoId, CatalogoDeCampo.Mercado),
        new("cancelado", "Cancelado", ClaseDeDato.Publico, x => x.Cancelado),
        new("motivoCancelacion", "Motivo de la cancelación", ClaseDeDato.Publico, x => x.MotivoCancelacion),
    ];

    private static async Task<IResult> EditarAsync(
        AlcanceDeEventos alcance,
        long eventoId,
        CrearEventoDeOrganizacionSolicitud solicitud,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext http,
        PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest(new { message = TestigoInvalido[0] });

        var persona = alcance.Persona;
        if (persona <= 0) return Results.Unauthorized();
        if (!await Administra(db, alcance, ct)) return Results.Forbid();
        if (await ExigirCorreoAsync(db, politicaDeConfirmacion, alcance, "anunciar eventos", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        var evento = await EventoDelAlcanceAsync(db, alcance, eventoId, rastrear: true, ct);
        if (evento is null) return Results.NotFound();
        if (evento.Estado is "archivado" or "rechazado") return Results.Conflict(new { message = NoEditable, estado = evento.Estado });
        if (evento.Cancelado) return Results.Conflict(new { message = CanceladoNoSeEdita, estado = evento.Estado });

        if (await ValidarAsync(db, alcance, solicitud, ct) is { } invalido) return invalido;

        var ahora = DateTime.UtcNow;
        var anterior = evento.Estado;

        // ERRATA O CAMBIO DE FONDO, ANTES DE TOCAR LA FILA: se compara lo que hay con lo que llega.
        IReadOnlyList<string> deFondo = [];
        string nuevo;
        if (anterior == "publicado")
        {
            deFondo = ReglasDeErrataDeEventos.CambiosDeFondo(evento, solicitud);
            nuevo = deFondo.Count == 0 ? "publicado" : "en_revision";
        }
        else
        {
            nuevo = solicitud.Borrador && anterior == "borrador" ? "borrador" : "en_revision";
        }

        var esErrata = anterior == "publicado" && nuevo == "publicado";

        var fotoDeLosCampos = RegistradorDeCambios.Tomar(evento, CamposVigilados);
        Aplicar(evento, solicitud, ahora);
        evento.Estado = nuevo;
        evento.Version += 1;

        // LA BITÁCORA DE ABAJO YA ESCRIBE SU LÍNEA DE ESTE GUARDADO; aquí solo los valores.
        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(
                Modulos.Agenda, evento.Id.ToString(CultureInfo.InvariantCulture), alcance.OrganizacionId, persona,
                alcance.EsDePersona ? "Persona" : "Organización", Fecha: ahora),
            CamposVigilados, fotoDeLosCampos, evento, ct, conBitacora: false);

        if (esErrata)
        {
            // LA ERRATA NO MUEVE EL ESTADO, pero queda dicha: quien revise el historial lee que lo
            // publicado se corrigió sin pasar por revisión, y qué cambió está en el registro de cambios.
            await HistorialDeEventosDeOrganizacion.AnotarAsync(
                db, evento, anterior, HistorialDeEstados.AccionErrata,
                "Errata corregida en lo publicado.", persona, ahora, ct);
        }
        else if (anterior != nuevo)
        {
            await HistorialDeEventosDeOrganizacion.AnotarAsync(
                db, evento, anterior,
                anterior == "publicado" ? HistorialDeEventosDeOrganizacion.EditadoTrasPublicar : HistorialDeEventosDeOrganizacion.EnviadoARevision,
                anterior == "publicado"
                    ? $"Cambio de fondo en lo publicado ({ReglasDeErrataDeEventos.EnProsa(deFondo)}): vuelve a revisión."
                    : null,
                persona, ahora, ct, deFondo);
        }

        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = persona,
            TableName = "EventosAgenda",
            RecordId = evento.Id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Actualizar,
            PreviousValuesJson = System.Text.Json.JsonSerializer.Serialize(new { estado = anterior }),
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                evento = "EventoEditadoPorOrganizacion",
                organizacionId = alcance.OrganizacionId,
                estado = nuevo,
                esErrata,
                camposDeFondo = deFondo,
            }),
            CreatedAt = ahora,
        });

        await db.SaveChangesAsync(ct);
        return Results.Ok(new
        {
            id = evento.Id.ToString(CultureInfo.InvariantCulture),
            estado = evento.Estado,
            // LA PANTALLA DICE QUÉ PASÓ: «se corrigió y sigue en la agenda» o «vuelve a revisión
            // porque cambió la fecha y el lugar».
            esErrata,
            cambiosDeFondo = deFondo,
        });
    }

    /// <summary>
    /// Retira de la agenda un evento publicado, con motivo (D3-13).
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>RETIRAR ES DEJAR DE ANUNCIAR.</b> El evento queda «archivado»: ya no se ve en el portal y no
    /// se edita más. Se hace con el mismo estado que usa la consola al retirar, de modo que las dos
    /// puertas dejan el mismo resultado.
    /// </para>
    /// <para>
    /// <b>NO EXIGE CORREO CONFIRMADO.</b> Anunciar y cancelar hablan en nombre de la organización ante
    /// el público; quitar de la agenda algo propio no puede depender de esa comprobación.
    /// </para>
    /// </remarks>
    private static async Task<IResult> RetirarAsync(
        AlcanceDeEventos alcance,
        long eventoId,
        MotivoSobreEventoSolicitud solicitud,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext http,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest(new { message = TestigoInvalido[0] });

        var persona = alcance.Persona;
        if (persona <= 0) return Results.Unauthorized();
        if (!await Administra(db, alcance, ct)) return Results.Forbid();
        if (ValidarMotivo(solicitud) is { } sinMotivo) return sinMotivo;

        var evento = await EventoDelAlcanceAsync(db, alcance, eventoId, rastrear: true, ct);
        if (evento is null) return Results.NotFound();
        if (evento.Estado != "publicado") return Results.Conflict(new { message = SoloPublicadoSeRetira, estado = evento.Estado });

        var motivo = Limpiar(solicitud.Motivo)!;
        var ahora = DateTime.UtcNow;
        evento.Estado = "archivado";
        evento.Version += 1;
        evento.FechaActualizacion = ahora;

        await HistorialDeEventosDeOrganizacion.AnotarAsync(
            db, evento, "publicado", HistorialDeEventosDeOrganizacion.Retirado, motivo, persona, ahora, ct);
        // EL AVISO ES EL MISMO QUE RECIBE QUIEN ADMINISTRA CUANDO LO RETIRA LA CONSOLA: «salió de la
        // agenda», con el motivo. Así nadie de la organización se entera por casualidad.
        await AvisosDeEventosDeOrganizacion.AvisarAsync(db, evento, "publicado", motivo, ahora, ct);
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = persona,
            TableName = "EventosAgenda",
            RecordId = evento.Id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Archivar,
            PreviousValuesJson = System.Text.Json.JsonSerializer.Serialize(new { estado = "publicado" }),
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                evento = "EventoRetiradoPorOrganizacion",
                organizacionId = alcance.OrganizacionId,
                estado = evento.Estado,
            }),
            CreatedAt = ahora,
        });

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { id = evento.Id.ToString(CultureInfo.InvariantCulture), estado = evento.Estado });
    }

    /// <summary>
    /// Marca como cancelado un evento publicado, con motivo (D3-13).
    /// </summary>
    /// <remarks>
    /// <b>CANCELAR NO ES RETIRAR.</b> Un evento cancelado sigue en la agenda, con su estado
    /// «cancelado» y el motivo a la vista: quien ya lo tenía anotado necesita saber que no ocurre, y
    /// quitarlo en silencio lo dejaría esperándolo. No es un estado nuevo del circuito: el Programa
    /// aprobó el evento, y sigue «publicado»; lo que cambia es que no se realiza. Un evento cancelado
    /// ya no se edita, y puede retirarse después.
    /// </remarks>
    private static async Task<IResult> CancelarAsync(
        AlcanceDeEventos alcance,
        long eventoId,
        MotivoSobreEventoSolicitud solicitud,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext http,
        PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest(new { message = TestigoInvalido[0] });

        var persona = alcance.Persona;
        if (persona <= 0) return Results.Unauthorized();
        if (!await Administra(db, alcance, ct)) return Results.Forbid();
        if (await ExigirCorreoAsync(db, politicaDeConfirmacion, alcance, "cancelar eventos", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        if (ValidarMotivo(solicitud) is { } sinMotivo) return sinMotivo;

        var evento = await EventoDelAlcanceAsync(db, alcance, eventoId, rastrear: true, ct);
        if (evento is null) return Results.NotFound();
        if (evento.Estado != "publicado") return Results.Conflict(new { message = SoloPublicadoSeCancela, estado = evento.Estado });
        if (evento.Cancelado) return Results.Conflict(new { message = YaCancelado, estado = evento.Estado });

        var motivo = Limpiar(solicitud.Motivo)!;
        var ahora = DateTime.UtcNow;

        var fotoDeLosCampos = RegistradorDeCambios.Tomar(evento, CamposVigilados);
        evento.Cancelado = true;
        evento.MotivoCancelacion = motivo;
        evento.FechaCancelacion = ahora;
        evento.Version += 1;
        evento.FechaActualizacion = ahora;

        await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(
                Modulos.Agenda, evento.Id.ToString(CultureInfo.InvariantCulture), alcance.OrganizacionId, persona,
                alcance.EsDePersona ? "Persona" : "Organización", Motivo: motivo, Fecha: ahora),
            CamposVigilados, fotoDeLosCampos, evento, ct, conBitacora: false);

        // EL ESTADO NO SE MUEVE: sigue «publicado». El historial dice que se canceló y por qué.
        await HistorialDeEventosDeOrganizacion.AnotarAsync(
            db, evento, "publicado", HistorialDeEventosDeOrganizacion.Cancelado, motivo, persona, ahora, ct);
        await AvisosDeEventosDeOrganizacion.AvisarCancelacionAsync(db, evento, motivo, ahora, ct);
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = persona,
            TableName = "EventosAgenda",
            RecordId = evento.Id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Actualizar,
            PreviousValuesJson = System.Text.Json.JsonSerializer.Serialize(new { cancelado = false }),
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                evento = "EventoCanceladoPorOrganizacion",
                organizacionId = alcance.OrganizacionId,
                estado = evento.Estado,
                cancelado = true,
            }),
            CreatedAt = ahora,
        });

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { id = evento.Id.ToString(CultureInfo.InvariantCulture), estado = evento.Estado, cancelado = true });
    }

    /// <summary>El 400 si el motivo falta o no cabe: retirar y cancelar lo piden siempre.</summary>
    private static IResult? ValidarMotivo(MotivoSobreEventoSolicitud solicitud)
    {
        var motivo = Limpiar(solicitud.Motivo);
        if (motivo is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["motivo"] = MotivoObligatorio });
        if (motivo.Length > MaximoDelMotivo) return Results.ValidationProblem(new Dictionary<string, string[]> { ["motivo"] = MotivoDemasiadoLargo });
        return null;
    }

    /// <summary>
    /// El historial de estados de un evento de la organización.
    /// </summary>
    /// <remarks>
    /// LO QUE DECIDIÓ EL PROGRAMA SE FIRMA «EQUIPO DEL PROGRAMA»: la organización ve el motivo y la
    /// fecha, no el nombre de la persona funcionaria.
    /// </remarks>
    private static async Task<IResult> HistorialAsync(
        AlcanceDeEventos alcance, long eventoId, SimusDbContext db, CancellationToken ct)
    {
        var persona = alcance.Persona;
        if (persona <= 0) return Results.Unauthorized();
        if (!await Edita(db, alcance, ct)) return Results.Forbid();

        var evento = await EventoDelAlcanceAsync(db, alcance, eventoId, rastrear: false, ct);
        if (evento is null) return Results.NotFound();

        // UNA PERSONA SIN ORGANIZACIÓN LEE SU PROPIA HISTORIA: lo que hizo ella lleva su nombre y lo que decidió
        // la consola, «Equipo del Programa» (igual que lo lee una organización).
        return Results.Ok(await HistorialDeEstados.LeerAsync(
            db, Modulos.Agenda, evento.Id.ToString(CultureInfo.InvariantCulture), alcance.OrganizacionId,
            ct, vistoPorPersona: alcance.EsDePersona ? alcance.Persona : null));
    }

    /// <summary>Envía a revisión un evento que estaba en borrador, sin cambiarlo.</summary>
    private static async Task<IResult> EnviarARevisionAsync(
        AlcanceDeEventos alcance,
        long eventoId,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext http,
        PoliticaDeConfirmacionDeCorreo politicaDeConfirmacion,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, http)) return Results.BadRequest(new { message = TestigoInvalido[0] });

        var persona = alcance.Persona;
        if (persona <= 0) return Results.Unauthorized();
        if (!await Administra(db, alcance, ct)) return Results.Forbid();
        if (await ExigirCorreoAsync(db, politicaDeConfirmacion, alcance, "anunciar eventos", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        var evento = await EventoDelAlcanceAsync(db, alcance, eventoId, rastrear: true, ct);
        if (evento is null) return Results.NotFound();
        if (evento.Estado != "borrador") return Results.Conflict(new { message = SoloBorradorSeEnvia, estado = evento.Estado });

        // EL PROCESO TIENE QUE SEGUIR PUBLICADO al enviarlo: pudo archivarse mientras era borrador.
        if (!await ProcesoDelEvento.PublicadoYDelAlcanceAsync(db, alcance, ProcesoDelEvento.De(evento), ct))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                [CampoDelProceso(ProcesoDelEvento.TipoDe(evento))] = ProcesoAjeno,
            });
        }

        var ahora = DateTime.UtcNow;
        evento.Estado = "en_revision";
        evento.Version += 1;
        evento.FechaActualizacion = ahora;

        await HistorialDeEventosDeOrganizacion.AnotarAsync(
            db, evento, "borrador", HistorialDeEventosDeOrganizacion.EnviadoARevision, null, persona, ahora, ct);
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = persona,
            TableName = "EventosAgenda",
            RecordId = evento.Id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Actualizar,
            PreviousValuesJson = System.Text.Json.JsonSerializer.Serialize(new { estado = "borrador" }),
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new { evento = "EventoEnviadoARevision", organizacionId = alcance.OrganizacionId, estado = evento.Estado }),
            CreatedAt = ahora,
        });

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { id = evento.Id.ToString(CultureInfo.InvariantCulture), estado = evento.Estado });
    }

    // ---------- Apoyos --------------------------------------------------------------------

    /// <summary>Las reglas del formulario y del proceso, iguales al crear y al editar.</summary>
    private static async Task<IResult?> ValidarAsync(
        SimusDbContext db, AlcanceDeEventos alcance, CrearEventoDeOrganizacionSolicitud solicitud, CancellationToken ct)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        if (Limpiar(solicitud.Titulo) is null) errores["titulo"] = TituloObligatorio;
        if (Limpiar(solicitud.Descripcion) is null) errores["descripcion"] = DescripcionObligatoria;
        if (solicitud.FechaFin is { } fin && fin < solicitud.FechaInicio) errores["fechaFin"] = FinAntesDelInicio;
        if (solicitud.HoraFin is not null && solicitud.HoraInicio is null) errores["horaFin"] = HoraFinSinInicio;

        var proceso = ProcesoDelEvento.De(solicitud);
        var cuantos = ProcesoDelEvento.Cantidad(solicitud);
        if (cuantos == 0) errores["festivalId"] = ProcesoObligatorio;
        else if (cuantos > 1) errores["festivalId"] = UnSoloProceso;

        // UN MUNICIPIO SIN SU DEPARTAMENTO NO ES UN TERRITORIO. El formulario no deja llegar a esa
        // combinación —el municipio solo se ofrece tras elegir departamento—, pero esta ruta está
        // abierta a cualquiera con sesión externa, y sin esta comprobación el CHECK de la base la
        // rechazaría como un 500 sin explicación en vez de como un 400 sobre el campo.
        if (Limpiar(solicitud.CodigoDepartamento) is null && Limpiar(solicitud.CodigoMunicipio) is not null)
        {
            errores["codigoDepartamento"] = MunicipioSinDepartamento;
        }

        if (errores.Count > 0) return Results.ValidationProblem(errores);

        if (!await ProcesoDelEvento.PublicadoYDelAlcanceAsync(db, alcance, proceso, ct))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                [CampoDelProceso(proceso?.Tipo)] = ProcesoAjeno,
            });
        }

        return null;
    }

    /// <summary>El campo de la solicitud que lleva cada tipo de proceso, para dar el error sobre el campo.</summary>
    private static string CampoDelProceso(string? tipo) => tipo switch
    {
        ProcesoDelEvento.Mercado => "mercadoId",
        ProcesoDelEvento.Taller => "tallerId",
        ProcesoDelEvento.Espacio => "espacioId",
        ProcesoDelEvento.Red => "redId",
        _ => "festivalId",
    };

    /// <summary>
    /// La dirección del correo comprobada de quien anuncia: la de la organización o, si no hay, la de la persona.
    /// </summary>
    private static Task<IResult?> ExigirCorreoAsync(
        SimusDbContext db, PoliticaDeConfirmacionDeCorreo politica, AlcanceDeEventos alcance, string loQueSeIntenta, CancellationToken ct) =>
        alcance.OrganizacionId is int organizacion
            ? AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(db, politica, organizacion, loQueSeIntenta, ct)
            : TalleresEndpoints.ExigirCorreoDeLaPersonaAsync(db, politica, alcance.Persona, loQueSeIntenta, ct);

    private static void Aplicar(EventoAgendaRow evento, CrearEventoDeOrganizacionSolicitud solicitud, DateTime ahora)
    {
        var departamento = Limpiar(solicitud.CodigoDepartamento);
        var municipio = Limpiar(solicitud.CodigoMunicipio);

        evento.Titulo = Limpiar(solicitud.Titulo)!;
        evento.Descripcion = Limpiar(solicitud.Descripcion)!;
        evento.DescripcionLarga = Limpiar(solicitud.DescripcionLarga);
        evento.FechaInicio = solicitud.FechaInicio;
        evento.FechaFin = solicitud.FechaFin;
        evento.HoraInicio = solicitud.HoraInicio;
        evento.HoraFin = solicitud.HoraFin;
        evento.Modalidad = solicitud.Modalidad;
        evento.Lugar = Limpiar(solicitud.Lugar);
        evento.CodigoDepartamento = departamento;
        evento.CodigoMunicipio = municipio;
        // EL NIVEL DE COBERTURA SE DERIVA DEL TERRITORIO, NO SE PIDE. Es la misma llamada que hace
        // `AgendaEndpoints`: `CK_EventosAgenda_NivelCobertura` exige coherencia entre nivel y
        // códigos, y un canal que no la derivara chocaría con el CHECK al elegir departamento.
        evento.NivelCobertura = ReglasDeAgenda.NivelQueCorresponde(departamento, municipio);
        evento.Url = Limpiar(solicitud.Url);
        ProcesoDelEvento.Aplicar(evento, solicitud);
        evento.FechaActualizacion = ahora;
    }

    /// <summary>
    /// El evento, solo si es de un proceso de este alcance.
    /// </summary>
    /// <remarks>
    /// UN EVENTO AJENO RESPONDE COMO UNO QUE NO EXISTE: decir «no es tuyo» confirmaría que existe.
    /// </remarks>
    private static Task<EventoAgendaRow?> EventoDelAlcanceAsync(
        SimusDbContext db, AlcanceDeEventos alcance, long eventoId, bool rastrear, CancellationToken ct) =>
        ProcesoDelEvento.DelAlcance(db, alcance, rastrear).FirstOrDefaultAsync(e => e.Id == eventoId, ct);

    /// <summary>
    /// Una dirección libre para el evento.
    /// </summary>
    /// <remarks>
    /// DOS EVENTOS PUEDEN LLAMARSE IGUAL —«Concierto de clausura» ocurre todos los años— y el
    /// índice único de la agenda rechazaría el segundo con un error que no explica nada. Se numera
    /// aquí en vez de pedirle a quien escribe que invente un título distinto.
    /// </remarks>
    private static async Task<string> SlugLibreAsync(SimusDbContext db, string propuesto, CancellationToken ct)
    {
        var candidato = propuesto;
        var sufijo = 2;
        while (await db.EventosAgenda.AnyAsync(e => e.Slug == candidato, ct))
        {
            candidato = $"{propuesto}-{sufijo.ToString(CultureInfo.InvariantCulture)}";
            sufijo++;
        }
        return candidato;
    }

    private static string EtiquetaDeEstado(string estado, bool cancelado = false) => estado switch
    {
        "borrador" => "Borrador",
        "en_revision" => "En revisión",
        "publicado" when cancelado => "Cancelado",
        "publicado" => "Publicado",
        "rechazado" => "Rechazado",
        "archivado" => "Archivado",
        _ => estado,
    };

    private static string? Limpiar(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    // LA REGLA VIVE EN `AdministracionDeOrganizacion`. Una organización dada de baja no anuncia eventos.
    // Una PERSONA sin organización no tiene roles que comprobar: lo suyo es lo que figura a su nombre
    // como responsable (`ProcesoDelEvento.DelAlcance`), y todo lo demás responde como inexistente.
    private static Task<bool> Administra(SimusDbContext db, AlcanceDeEventos alcance, CancellationToken ct) =>
        alcance.OrganizacionId is int organizacion
            ? AdministracionDeOrganizacion.PuedeAdministrarAsync(db, alcance.Persona, organizacion, ct)
            : Task.FromResult(true);

    // Leer procesos y eventos lo puede un editor. Crear un evento lo deja «en_revision», es decir,
    // lo entrega al Programa: eso sigue pidiendo administrar (docs/desarrollo/19-cuentas-y-organizaciones.md §19.3).
    private static Task<bool> Edita(SimusDbContext db, AlcanceDeEventos alcance, CancellationToken ct) =>
        alcance.OrganizacionId is int organizacion
            ? AdministracionDeOrganizacion.PuedeEditarAsync(db, alcance.Persona, organizacion, ct)
            : Task.FromResult(true);
}
