using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// Los talleres de lutería: lectura pública, registro por su responsable y decisión del Programa.
/// </summary>
/// <remarks>
/// <para>
/// <b>ES EL RECORRIDO DE UN MERCADO, MAS CORTO.</b> Borrador, se completa, se envía a revisión, el
/// Programa decide, se publica. No hay ediciones ni propuestas de cambio sobre lo publicado: los
/// procesos del taller son eventos de la Agenda, y un cambio de contacto no necesita expediente.
/// </para>
/// <para>
/// <b>EL RESPONSABLE ES UNA ORGANIZACION O UNA PERSONA.</b> Un lutier independiente registra su
/// taller con su cuenta individual (<c>/externo/mis-talleres</c>); una organización lo hace desde
/// <c>/externo/organizaciones/{id}/talleres</c>. Cada ruta de un taller existente comprueba quién
/// escribe contra el responsable de ESE taller, no contra lo que diga el cuerpo.
/// </para>
/// <para>
/// <b>ERRATA AL INSTANTE, CAMBIO DE FONDO VUELVE A REVISION.</b> Corregir la descripción o el
/// contacto de un taller publicado se aplica en el acto; cambiar su nombre, su territorio, su
/// modalidad, sus servicios o sus familias lo devuelve a revisión (mismo criterio que Noticias).
/// Todo cambio queda en el registro de cambios por campo.
/// </para>
/// </remarks>
public static class TalleresEndpoints
{
    private static readonly string[] Modalidades = ["fijo", "itinerante", "colectivo"];
    private static readonly string[] NivelesDeCobertura = ["nacional", "departamental", "municipal"];
    private static readonly string[] EditablePorElResponsable = ["borrador", "ajustes_solicitados", "publicado"];

    private const int TamanoPorOmision = 25;
    private const int TamanoMaximo = 200;

    public static RouteGroupBuilder MapTalleresEndpoints(this RouteGroupBuilder api)
    {
        // ───────────────────────── Lectura pública: solo lo publicado ─────────────────────────
        var publico = api.MapGroup("/publico/talleres").WithTags("talleres-publico").AllowAnonymous();
        publico.MapGet(string.Empty, ListarPublicos).WithName("ListarTalleresPublicos").CacheaLecturaPublica();
        publico.MapGet("/catalogos", CatalogosPublicos).WithName("CatalogosDeTalleresPublicos").CacheaLecturaPublica();
        publico.MapGet("/{id:int}", ObtenerPublico).WithName("ObtenerTallerPublico").CacheaLecturaPublica();

        // ─────────────── Lo que hace quien responde por el taller (organización o persona) ───────────────
        var externo = api.MapGroup("/externo").WithTags("talleres-externos");
        externo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        externo.MapGet("/catalogos/taller", CatalogosExternos).WithName("CatalogosDeTallerExternos");
        externo.MapGet("/organizaciones/{organizacionId:int}/talleres", ListarDeLaOrganizacion)
            .WithName("ListarTalleresDeLaOrganizacion");
        externo.MapPost("/organizaciones/{organizacionId:int}/talleres", CrearDeLaOrganizacion)
            .WithName("CrearTallerDeLaOrganizacion");
        // LA FOTO DE UN LUTIER INDEPENDIENTE ENTRA POR EL BANCO con la cuota personal: /externo/archivos exige una
        // organización. La de una organización sube por /externo/archivos, como el resto de sus procesos.
        externo.MapPost("/mis-talleres/foto", SubirFotoDeLutier).WithName("SubirFotoDeTallerPersonal").DisableAntiforgery().ConTopeDeImagen()
            .AddEndpointFilter(ExigeTestigoDeLaConsola.ExigirDelCanalExterno);
        externo.MapGet("/mis-talleres", ListarMios).WithName("ListarMisTalleres");
        externo.MapPost("/mis-talleres", CrearMio).WithName("CrearMiTaller");
        externo.MapGet("/talleres/{tallerId:int}", ObtenerDelResponsable).WithName("ObtenerTallerDelResponsable");
        externo.MapPut("/talleres/{tallerId:int}", GuardarDelResponsable).WithName("GuardarTallerDelResponsable");
        externo.MapPost("/talleres/{tallerId:int}/enviar-a-revision", EnviarARevision).WithName("EnviarTallerARevision");
        externo.MapDelete("/talleres/{tallerId:int}", RetirarOAbandonar).WithName("RetirarTallerDeRevisionOAbandonar");
        externo.MapPost("/talleres/{tallerId:int}/retirar", RetirarPublicado)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir).WithName("RetirarTallerPublicado");

        // ───────────────────────────── Decisión del Programa (consola) ─────────────────────────────
        var consola = api.MapGroup("/institucional/talleres")
            .WithTags("talleres")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("talleres");

        consola.MapGet(string.Empty, ListarDeLaConsola).WithName("ListarTalleres");
        consola.MapGet("/catalogos", CatalogosDeLaConsola).WithName("CatalogosDeTallerConsola");
        consola.MapGet("/{id:int}", ObtenerDeLaConsola).WithName("ObtenerTaller");
        consola.MapPost("/{id:int}/decision", Decidir)
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir)
            .WithName("DecidirSobreTaller");
        consola.MapPost("/{id:int}/archivar", Archivar)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir)
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir)
            .WithName("ArchivarTaller");

        return api;
    }

    // ═══════════════════════════════════ Lectura pública ═══════════════════════════════════

    private static async Task<IResult> ListarPublicos(
        SimusDbContext db, string? q, string? departamento, string? municipio, int? servicio, int? familia,
        int? limit, int? offset, CancellationToken ct)
    {
        var consulta = db.Talleres.AsNoTracking().Where(t => t.Activo && t.EstadoRegistro == "publicado");

        if (!string.IsNullOrWhiteSpace(q))
        {
            var texto = q.Trim();
            consulta = consulta.Where(t => t.Nombre.Contains(texto) || (t.Descripcion != null && t.Descripcion.Contains(texto)));
        }
        if (!string.IsNullOrWhiteSpace(departamento))
        {
            var codigo = departamento.Trim();
            consulta = consulta.Where(t => t.CodigoDepartamento == codigo);
        }
        if (!string.IsNullOrWhiteSpace(municipio))
        {
            var codigo = municipio.Trim();
            consulta = consulta.Where(t => t.CodigoMunicipio == codigo);
        }
        if (servicio is > 0)
        {
            var id = servicio.Value;
            consulta = consulta.Where(t => db.TalleresServicios.Any(x => x.TallerId == t.Id && x.ServicioTallerId == id));
        }
        if (familia is > 0)
        {
            var id = familia.Value;
            consulta = consulta.Where(t => db.TalleresFamiliasDeInstrumentos.Any(x => x.TallerId == t.Id && x.FamiliaInstrumentoId == id));
        }

        consulta = consulta.OrderBy(t => t.Nombre).ThenBy(t => t.Id);

        var total = await consulta.CountAsync(ct);
        var porPagina = Math.Clamp(limit ?? 500, 1, 500);
        var desde = Math.Max(offset ?? 0, 0);
        var filas = await consulta.Skip(desde).Take(porPagina).ToListAsync(ct);

        var lista = await APublicosAsync(db, await ATarjetasAsync(db, filas, ct), ct);
        return Results.Ok(new PagedResponse<TallerPublicoDto>(lista, porPagina, desde, total));
    }

    private static async Task<IResult> ObtenerPublico(int id, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.Talleres.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.Activo && t.EstadoRegistro == "publicado", ct);
        if (fila is null) return Results.NotFound();

        var lista = await APublicosAsync(db, await ATarjetasAsync(db, [fila], ct), ct);
        return Results.Ok(lista[0]);
    }

    private static async Task<IResult> CatalogosPublicos(SimusDbContext db, CancellationToken ct) =>
        Results.Ok(await CatalogosAsync(db, ct));

    private static async Task<IResult> CatalogosExternos(SimusDbContext db, CancellationToken ct) =>
        Results.Ok(await CatalogosAsync(db, ct));

    private static async Task<IResult> CatalogosDeLaConsola(SimusDbContext db, CancellationToken ct) =>
        Results.Ok(await CatalogosAsync(db, ct));

    /// <summary>Los vocabularios del formulario: los mismos para el portal, el panel y la consola.</summary>
    internal static async Task<CatalogosDeTallerDto> CatalogosAsync(SimusDbContext db, CancellationToken ct)
    {
        var servicios = await db.ServiciosDeTaller.AsNoTracking()
            .Where(s => s.Activo)
            .OrderBy(s => s.OrdenVisualizacion).ThenBy(s => s.Nombre)
            .Select(s => new OpcionDeTallerDto(s.Id, s.Nombre, s.Slug, null, s.EstadoAprobacion))
            .ToListAsync(ct);
        var familias = await db.FamiliasDeInstrumentos.AsNoTracking()
            .Where(f => f.Activo)
            .OrderBy(f => f.OrdenVisualizacion).ThenBy(f => f.Nombre)
            .Select(f => new OpcionDeTallerDto(f.Id, f.Nombre, f.Slug, f.FamiliaPadreId, f.EstadoAprobacion))
            .ToListAsync(ct);
        // LAS PRACTICAS SON LAS DEL ECOSISTEMA, el mismo catálogo que llena un Festival o un Mercado.
        var practicas = await db.PracticasMusicales.AsNoTracking()
            .OrderBy(x => x.Orden).ThenBy(x => x.Nombre)
            .Select(x => new CatalogoDeMercadoDto(x.Id, x.Nombre))
            .ToListAsync(ct);
        return new CatalogosDeTallerDto(servicios, familias, practicas);
    }

    // ═══════════════════════════ Lo que hace el responsable del taller ═══════════════════════════

    private static async Task<IResult> ListarDeLaOrganizacion(
        int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var filas = await db.Talleres.AsNoTracking()
            .Where(t => t.OrganizacionPrincipalId == organizacionId && t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync(ct);
        return Results.Ok(await ATarjetasAsync(db, filas, ct));
    }

    private static async Task<IResult> SubirFotoDeLutier(
        HttpRequest peticion, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        return await BancoDeArchivosEndpoints.SubirFotoPersonalAsync(peticion, db, principal, persona.Value, ct);
    }

    private static async Task<IResult> ListarMios(ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        var filas = await db.Talleres.AsNoTracking()
            .Where(t => t.UsuarioResponsableId == persona.Value && t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync(ct);
        return Results.Ok(await ATarjetasAsync(db, filas, ct));
    }

    private static async Task<IResult> CrearDeLaOrganizacion(
        int organizacionId,
        TallerUpsertRequest solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El registro del taller no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        if (await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(
                db, politica, organizacionId, "registrar talleres de lutería", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        // LA ORGANIZACION LA DECIDE LA RUTA, NO EL CUERPO: el cuerpo ni siquiera la lleva.
        return await CrearAsync(db, solicitud, persona.Value, organizacionId, usuarioResponsableId: null, ct);
    }

    private static async Task<IResult> CrearMio(
        TallerUpsertRequest solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El registro del taller no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        if (await ExigirCorreoDeLaPersonaAsync(db, politica, persona.Value, "registrar tu taller de lutería", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        return await CrearAsync(db, solicitud, persona.Value, organizacionId: null, usuarioResponsableId: persona.Value, ct);
    }

    private static async Task<IResult> CrearAsync(
        SimusDbContext db, TallerUpsertRequest solicitud, int actor, int? organizacionId, int? usuarioResponsableId,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var errores = await ValidarAsync(solicitud, db, ct, null, organizacionId, usuarioResponsableId);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;

        // EL TALLER Y SU RASTRO SON UNA SOLA UNIDAD, y la estrategia de ejecución es la de SQL Server
        // (reintento): abrir la transacción sin ella funciona en SQLite y el motor real la rechaza.
        var estrategia = db.Database.CreateExecutionStrategy();
        var taller = await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);

            var fila = new TallerRow
            {
                EstadoRegistro = "borrador",
                Activo = true,
                IdUsuarioCreador = actor,
                OrganizacionPrincipalId = organizacionId,
                UsuarioResponsableId = usuarioResponsableId,
                FechaCreacion = ahora,
            };
            Volcar(solicitud, fila);
            db.Talleres.Add(fila);
            await db.SaveChangesAsync(ct);
            await SincronizarAsync(db, fila.Id, solicitud, ct);

            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Crear, "TallerCreado", actor, "Talleres",
                fila.Id.ToString(CultureInfo.InvariantCulture),
                antes: null, despues: new { estado = fila.EstadoRegistro }, motivo: null,
                OrigenDelCambio.Directo, ahora));
            // DE DONDE VINO EL REGISTRO: la organización que lo registró o, si es una persona, ella misma.
            await ProcedenciaDeRegistro.AnotarAsync(
                db, Modulos.Talleres, fila.Id.ToString(CultureInfo.InvariantCulture),
                ProcedenciaDeRegistro.Externo, organizacionId, actor, ct);
            await db.SaveChangesAsync(ct);

            await transaccion.CommitAsync(ct);
            return fila;
        });

        var tarjetas = await ATarjetasAsync(db, [taller], ct);
        return Results.Created($"/api/v1/externo/talleres/{taller.Id}", tarjetas[0]);
    }

    private static async Task<IResult> ObtenerDelResponsable(
        int tallerId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var (taller, fallo) = await MioAsync(tallerId, principal, db, ct, bastaConEditar: true);
        if (fallo is not null) return fallo;

        var tarjetas = await ATarjetasAsync(db, [taller!], ct);
        return Results.Ok(tarjetas[0]);
    }

    private static async Task<IResult> GuardarDelResponsable(
        int tallerId,
        TallerUpsertRequest solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El cambio no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var (taller, fallo) = await MioAsync(tallerId, principal, db, ct, bastaConEditar: true);
        if (fallo is not null) return fallo;

        if (!Array.Exists(EditablePorElResponsable, e => e == taller!.EstadoRegistro))
        {
            return Results.Conflict(new
            {
                message = taller!.EstadoRegistro == "en_revision"
                    ? "El taller está en revisión: no se edita hasta que el PNMC decida o lo retires de la revisión."
                    : "Este taller ya no se edita desde aquí.",
                estado = taller.EstadoRegistro,
            });
        }

        ArgumentNullException.ThrowIfNull(solicitud);
        var errores = await ValidarAsync(solicitud, db, ct, taller, taller!.OrganizacionPrincipalId, taller.UsuarioResponsableId);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        // LO PUBLICADO NO CAMBIA DE FONDO EN CALIENTE (PROP, decisión 122): la errata se corrige al instante y lo que
        // cambia qué es taller se PROPONE (`/propuesta`) y lo decide el Programa. Aquí no se escribe nada.
        if (taller!.EstadoRegistro == "publicado")
        {
            var deFondo = await CamposDeFondoQueCambianAsync(db, taller, solicitud, ct);
            if (deFondo.Count > 0)
            {
                return Results.Conflict(new
                {
                    motivo = "cambio_de_fondo",
                    message = "Ese cambio no se guarda en caliente sobre lo publicado: propónlo y el PNMC lo revisa.",
                    campos = deFondo,
                    estado = taller.EstadoRegistro,
                });
            }
        }

        var actor = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;

        var antes = RegistradorDeCambios.Tomar(await ParaElHistorialAsync(db, taller, ct), CamposDelTaller.Todos);
        Volcar(solicitud, taller);
        await SincronizarAsync(db, taller.Id, solicitud, ct);
        taller.FechaActualizacion = ahora;
        await db.SaveChangesAsync(ct);

        var despues = await ParaElHistorialAsync(db, taller, ct);
        var cambiados = await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(Modulos.Talleres, taller.Id.ToString(CultureInfo.InvariantCulture),
                taller.OrganizacionPrincipalId, actor, taller.OrganizacionPrincipalId is null ? "Persona" : "Organización", Fecha: ahora),
            CamposDelTaller.Todos, antes, despues, ct);

        if (cambiados > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        var tarjetas = await ATarjetasAsync(db, [taller], ct);
        return Results.Ok(tarjetas[0]);
    }

    private static async Task<IResult> EnviarARevision(
        int tallerId,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El envío a revisión no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var (taller, fallo) = await MioAsync(tallerId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        if (taller!.EstadoRegistro is not ("borrador" or "ajustes_solicitados"))
        {
            return Results.Conflict(new
            {
                message = "Solo un taller en borrador o con ajustes solicitados puede enviarse a revisión.",
                estado = taller.EstadoRegistro,
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var sinConfirmar = taller.OrganizacionPrincipalId is int organizacion
            ? await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(db, politica, organizacion, "enviar este taller a revisión", ct)
            : await ExigirCorreoDeLaPersonaAsync(db, politica, persona, "enviar tu taller a revisión", ct);
        if (sinConfirmar is not null) return sinConfirmar;

        var errores = await ValidarParaRevisionAsync(taller, db, ct);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;
        var estadoAnterior = taller.EstadoRegistro;
        taller.EstadoRegistro = "en_revision";
        taller.FechaEnvioARevision = ahora;
        taller.FechaActualizacion = ahora;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Actualizar, "TallerEnviadoARevision", persona, "Talleres",
            taller.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = taller.EstadoRegistro },
            motivo: null, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Talleres, taller.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, taller.EstadoRegistro, null);
        await AvisarAlProgramaAsync(db, taller, "lo envió a revisión", ahora, ct);
        await db.SaveChangesAsync(ct);

        var tarjetas = await ATarjetasAsync(db, [taller], ct);
        return Results.Ok(tarjetas[0]);
    }

    /// <summary>Deshacer un envío (vuelve a borrador) o abandonar un borrador (se archiva).</summary>
    private static async Task<IResult> RetirarOAbandonar(
        int tallerId,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "La acción no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var (taller, fallo) = await MioAsync(tallerId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        var estadoAnterior = taller!.EstadoRegistro;
        var enRevision = estadoAnterior == "en_revision";
        if (!enRevision && estadoAnterior is not ("borrador" or "ajustes_solicitados"))
        {
            return Results.Conflict(new
            {
                message = "Un taller publicado se retira del ecosistema con su motivo. Uno rechazado o archivado ya no se toca.",
                estado = estadoAnterior,
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;
        taller.EstadoRegistro = enRevision ? "borrador" : "archivado";
        taller.FechaActualizacion = ahora;
        if (!enRevision) taller.FechaArchivado = ahora;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            enRevision ? AccionesAuditoria.Actualizar : AccionesAuditoria.Archivar,
            enRevision ? "TallerRetiradoDeRevision" : "TallerArchivado", persona, "Talleres",
            taller.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = taller.EstadoRegistro },
            motivo: null, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Talleres, taller.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, taller.EstadoRegistro, null);
        if (enRevision)
        {
            await AvisosDeRevision.MarcarComoResueltosAsync(
                db, Modulos.Talleres, taller.Id.ToString(CultureInfo.InvariantCulture), "TallerRecibidoParaRevision", ahora, ct);
        }
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    /// <summary>Retirar del ecosistema un taller publicado: lo hace su responsable, con motivo.</summary>
    private static async Task<IResult> RetirarPublicado(
        int tallerId,
        RetiroDeTaller solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "La acción no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var (taller, fallo) = await MioAsync(tallerId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        if (taller!.EstadoRegistro != "publicado")
        {
            return Results.Conflict(new
            {
                message = "Solo un taller publicado se retira del ecosistema desde aquí.",
                estado = taller.EstadoRegistro,
            });
        }

        var motivo = Texto(solicitud.Motivo, 1200);
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = ["Explica por qué retiras este taller del ecosistema."],
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;
        var estadoAnterior = taller.EstadoRegistro;
        taller.EstadoRegistro = "archivado";
        taller.FechaArchivado = ahora;
        taller.FechaActualizacion = ahora;
        taller.MotivoDeLaDecision = motivo;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Archivar, "TallerRetirado", persona, "Talleres",
            taller.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = taller.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Talleres, taller.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, taller.EstadoRegistro, motivo);
        await ArchivoDeEventosDelProceso.ArchivarAsync(db, ProcesoDelEvento.Taller, taller.Id, persona, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var tarjetas = await ATarjetasAsync(db, [taller], ct);
        return Results.Ok(tarjetas[0]);
    }

    // ═══════════════════════════════ Decisión del Programa ═══════════════════════════════

    private static async Task<IResult> ListarDeLaConsola(
        SimusDbContext db, string? q, string? estado, string? responsable, string? orden, bool? descendente,
        int? pagina, int? tamano, string? sedeDepartamento, string? sedeMunicipio, bool? sedePendiente,
        CancellationToken ct)
    {
        var consulta = db.Talleres.AsNoTracking().Where(t => t.Activo);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var texto = q.Trim();
            consulta = consulta.Where(t => t.Nombre.Contains(texto) || (t.Descripcion != null && t.Descripcion.Contains(texto)));
        }
        if (!string.IsNullOrWhiteSpace(estado) && !string.Equals(estado, "todos", StringComparison.OrdinalIgnoreCase))
        {
            var pedido = EnMinuscula(estado);
            consulta = consulta.Where(t => t.EstadoRegistro == pedido);
        }
        if (string.Equals(responsable, "organizacion", StringComparison.OrdinalIgnoreCase))
        {
            consulta = consulta.Where(t => t.OrganizacionPrincipalId != null);
        }
        else if (string.Equals(responsable, "persona", StringComparison.OrdinalIgnoreCase))
        {
            consulta = consulta.Where(t => t.UsuarioResponsableId != null);
        }

        // LA SEDE, no la cobertura (decisión 124): un solo filtro para los cinco tipos.
        consulta = SedePrincipal.FiltrarPorSede(consulta, sedeDepartamento, sedeMunicipio, sedePendiente == true);

        var desc = descendente ?? false;
        consulta = EnMinuscula(orden ?? "nombre") switch
        {
            "estado" => desc
                ? consulta.OrderByDescending(t => t.EstadoRegistro).ThenBy(t => t.Nombre)
                : consulta.OrderBy(t => t.EstadoRegistro).ThenBy(t => t.Nombre),
            "creacion" => desc
                ? consulta.OrderByDescending(t => t.FechaCreacion).ThenBy(t => t.Id)
                : consulta.OrderBy(t => t.FechaCreacion).ThenBy(t => t.Id),
            _ => desc
                ? consulta.OrderByDescending(t => t.Nombre).ThenBy(t => t.Id)
                : consulta.OrderBy(t => t.Nombre).ThenBy(t => t.Id),
        };

        var total = await consulta.CountAsync(ct);
        var porPagina = Math.Clamp(tamano ?? TamanoPorOmision, 1, TamanoMaximo);
        var actual = Math.Max(pagina ?? 1, 1);
        var filas = await consulta.Skip((actual - 1) * porPagina).Take(porPagina).ToListAsync(ct);

        var lista = await ATarjetasAsync(db, filas, ct);
        return Results.Ok(new PagedResponse<TallerDto>(lista, porPagina, (actual - 1) * porPagina, total));
    }

    private static async Task<IResult> ObtenerDeLaConsola(int id, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.Talleres.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (fila is null) return Results.NotFound();

        var lista = await ATarjetasAsync(db, [fila], ct);
        return Results.Ok(lista[0]);
    }

    /// <summary>La decisión del Programa sobre un taller que llegó a revisión.</summary>
    /// <remarks>
    /// <b>SOLO DESDE «EN REVISION»</b>, salvo rechazar, que también cabe con ajustes pedidos (lo que
    /// nunca se publicó y no va a publicarse se cierra como «rechazado»). Pedir ajustes o rechazar sin
    /// decir por qué no es una decisión: el motivo es obligatorio y viaja al aviso del responsable.
    /// </remarks>
    private static async Task<IResult> Decidir(
        int id, DecisionSobreTaller decision, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(decision);
        var taller = await db.Talleres.FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (taller is null) return Results.NotFound();

        var pedida = EnMinuscula(decision.Decision);
        var motivo = Texto(decision.Motivo, 1200);

        var enRevision = taller.EstadoRegistro == "en_revision";
        var conAjustes = taller.EstadoRegistro == "ajustes_solicitados";
        if (!enRevision && !(pedida == "rechazar" && conAjustes))
        {
            return Results.Conflict(new
            {
                message = pedida == "rechazar"
                    ? "Solo se rechaza un taller en revisión o con ajustes solicitados."
                    : "Solo se decide sobre un taller que esté en revisión.",
                estado = taller.EstadoRegistro,
            });
        }

        if (pedida is "ajustes" or "rechazar" && motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = [pedida == "rechazar"
                    ? "Explica por qué se rechaza el taller: la persona o la organización necesita saberlo."
                    : "Di qué hay que corregir: sin eso el taller vuelve igual."],
            });
        }

        var ahora = DateTime.UtcNow;
        var estadoAnterior = taller.EstadoRegistro;
        string evento;
        string verbo;
        switch (pedida)
        {
            case "publicar":
                taller.EstadoRegistro = "publicado";
                taller.FechaPublicacion = ahora;
                taller.MotivoDeLaDecision = null;
                evento = "TallerPublicado";
                verbo = AccionesAuditoria.Publicar;
                break;
            case "ajustes":
                taller.EstadoRegistro = "ajustes_solicitados";
                taller.MotivoDeLaDecision = motivo;
                evento = "TallerConAjustesSolicitados";
                verbo = AccionesAuditoria.Actualizar;
                break;
            case "rechazar":
                taller.EstadoRegistro = "rechazado";
                taller.MotivoDeLaDecision = motivo;
                evento = "TallerRechazado";
                verbo = AccionesAuditoria.Rechazar;
                break;
            default:
                return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
                {
                    ["decision"] = ["La decisión debe ser «publicar», «ajustes» o «rechazar»."],
                });
        }

        taller.FechaActualizacion = ahora;
        var actor = ActorDeLaConsola(principal);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            verbo, evento, actor, "Talleres", taller.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = taller.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Talleres, taller.Id, actor ?? 0,
            HistorialDeEstados.AccionDelCambio(estadoAnterior, taller.EstadoRegistro),
            estadoAnterior, taller.EstadoRegistro, motivo);
        await AvisosDeRevision.MarcarComoResueltosAsync(
            db, Modulos.Talleres, taller.Id.ToString(CultureInfo.InvariantCulture), "TallerRecibidoParaRevision", ahora, ct);
        await AvisarAlResponsableAsync(db, taller, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var lista = await ATarjetasAsync(db, [taller], ct);
        return Results.Ok(lista[0]);
    }

    /// <summary>Retirar del ecosistema un taller ya publicado, con su motivo.</summary>
    private static async Task<IResult> Archivar(
        int id, RetiroDeTaller solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var taller = await db.Talleres.FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (taller is null) return Results.NotFound();

        if (taller.EstadoRegistro != "publicado")
        {
            return Results.Conflict(new
            {
                message = "Solo un taller publicado puede retirarse del ecosistema desde aquí.",
                estado = taller.EstadoRegistro,
            });
        }

        var motivo = Texto(solicitud.Motivo, 1200);
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = ["Explica por qué se retira este taller del ecosistema."],
            });
        }

        var ahora = DateTime.UtcNow;
        var estadoAnterior = taller.EstadoRegistro;
        taller.EstadoRegistro = "archivado";
        taller.FechaArchivado = ahora;
        taller.FechaActualizacion = ahora;
        taller.MotivoDeLaDecision = motivo;

        var actor = ActorDeLaConsola(principal);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Archivar, "TallerArchivado", actor, "Talleres",
            taller.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = taller.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Talleres, taller.Id, actor ?? 0,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, taller.EstadoRegistro, motivo);
        await AvisarAlResponsableAsync(db, taller, motivo, ahora, ct);
        await ArchivoDeEventosDelProceso.ArchivarAsync(db, ProcesoDelEvento.Taller, taller.Id, actor, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var lista = await ATarjetasAsync(db, [taller], ct);
        return Results.Ok(lista[0]);
    }

    // ═══════════════════════════════════ Guardas y reglas ═══════════════════════════════════

    /// <summary>
    /// El taller que esta persona puede tocar, o el resultado que lo impide.
    /// </summary>
    /// <remarks>
    /// <b>LA GUARDA ES DEL RESPONSABLE DE ESE TALLER.</b> Si es una organización, se comprueba el rol
    /// de la persona en ella (editar basta para preparar; enviar y retirar piden administrar). Si es
    /// una persona, solo ella. Un taller ajeno responde 404, no 403: no se confirma que exista.
    /// </remarks>
    private static async Task<(TallerRow? Taller, IResult? Fallo)> MioAsync(
        int tallerId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct,
        bool bastaConEditar = false, bool paraAdministrar = false)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return (null, Results.Unauthorized());

        var taller = await db.Talleres.FirstOrDefaultAsync(t => t.Id == tallerId && t.Activo, ct);
        if (taller is null) return (null, Results.NotFound());

        if (taller.OrganizacionPrincipalId is int organizacion)
        {
            var puede = bastaConEditar && !paraAdministrar
                ? await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacion, ct)
                : await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacion, ct);
            if (!puede)
            {
                // Quien solo edita ve la ficha pero no envía ni retira: 403. Quien no pertenece: 404.
                var pertenece = await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacion, ct);
                return (null, pertenece ? Results.Forbid() : Results.NotFound());
            }
        }
        else if (taller.UsuarioResponsableId != persona.Value)
        {
            return (null, Results.NotFound());
        }

        return (taller, null);
    }

    /// <summary>La puerta del correo confirmado, para quien responde por un taller sin organización.</summary>
    internal static async Task<IResult?> ExigirCorreoDeLaPersonaAsync(
        SimusDbContext db, PoliticaDeConfirmacionDeCorreo politica, int persona, string loQueSeIntenta, CancellationToken ct)
    {
        if (!politica.ConfirmacionObligatoria) return null;

        var cuenta = await db.Users.AsNoTracking()
            .Where(u => u.Id == persona)
            .Select(u => new { u.Email, u.CorreoConfirmado })
            .FirstOrDefaultAsync(ct);
        if (cuenta is null || cuenta.CorreoConfirmado) return null;

        return Results.Conflict(new
        {
            motivo = "correo_sin_confirmar",
            queFalta = "Falta confirmar el correo de tu cuenta.",
            porQue = "Es la dirección con la que el PNMC te escribirá y con la que recuperarías tu acceso.",
            queHacer = $"Abre el enlace que enviamos a {cuenta.Email}.",
            queSeHabilita = $"Al confirmarlo podrás {loQueSeIntenta}.",
            correoDestino = cuenta.Email,
        });
    }

    internal static async Task<Dictionary<string, string[]>> ValidarAsync(
        TallerUpsertRequest peticion, SimusDbContext db, CancellationToken ct,
        TallerRow? actual = null, int? organizacionId = null, int? personaId = null)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);

        // LA FOTO TIENE QUE SER DE QUIEN RESPONDE POR EL TALLER, o la que ya tenía. Si bastara con que
        // existiera en el banco, apuntar a un archivo ajeno todavía sin publicar lo volvería público a
        // través del taller (misma regla que la foto de un perfil, decisión 102).
        if (await FotoDeProceso.ValidarAsync(db, peticion.ArchivoFotoId, actual?.ArchivoFotoId, organizacionId, personaId, ct) is { } errorDeFoto)
        {
            errores["archivoFotoId"] = errorDeFoto;
        }

        if (string.IsNullOrWhiteSpace(peticion.Nombre)) errores["nombre"] = ["Escribe el nombre del taller."];

        var modalidad = EnMinuscula(peticion.Modalidad);
        if (!Array.Exists(Modalidades, m => m == modalidad))
        {
            errores["modalidad"] = ["Elige si el taller es fijo, itinerante o colectivo."];
        }

        // LA REGLA ÚNICA DE DIRECCIÓN Y DE TELÉFONO, la misma que el Festival y el Mercado.
        foreach (var (clave, valor) in new[] { ("sitioWebTaller", peticion.SitioWebTaller), ("otroEnlaceTaller", peticion.OtroEnlaceTaller) })
        {
            if (!ValidationHelpers.IsValidHttpsUrl(valor)) errores[clave] = [ValidationHelpers.MensajeDeUrl];
        }
        foreach (var (clave, valor) in new[] { ("instagramTaller", peticion.InstagramTaller), ("facebookTaller", peticion.FacebookTaller) })
        {
            if (!ValidationHelpers.IsValidSocialLink(valor)) errores[clave] = [ValidationHelpers.MensajeDeRedSocial];
        }
        if (!ValidationHelpers.IsValidPhone(peticion.TelefonoTaller)) errores["telefonoTaller"] = [ValidationHelpers.MensajeDeTelefono];
        if (!string.IsNullOrWhiteSpace(peticion.CorreoTaller) && !ValidationHelpers.IsValidEmail(peticion.CorreoTaller))
        {
            errores["correoTaller"] = ["Escribe un correo válido, por ejemplo taller@correo.co."];
        }

        var nivel = EnMinuscula(peticion.NivelCobertura);
        var departamento = Opcional(peticion.CodigoDepartamento);
        var municipio = Opcional(peticion.CodigoMunicipio);
        if (!Array.Exists(NivelesDeCobertura, n => n == nivel))
        {
            errores["nivelCobertura"] = ["Elige dónde trabaja el taller: en el país, un departamento o un municipio."];
        }
        else
        {
            // LA MISMA COHERENCIA QUE VIGILA EL CHECK DE LA BASE, comprobada antes de llegar a ella.
            var coherente = nivel switch
            {
                "nacional" => departamento is null && municipio is null,
                "departamental" => departamento is not null && municipio is null,
                _ => departamento is not null && municipio is not null,
            };
            if (!coherente)
            {
                errores["nivelCobertura"] = ["El territorio no corresponde al nivel elegido: revisa el departamento y el municipio."];
            }
            else if (departamento is not null && !await ExisteEnDivipolaAsync(db, departamento, municipio, ct))
            {
                errores["codigoDepartamento"] = ["Ese territorio no existe en el catálogo oficial."];
            }
        }

        var servicios = (peticion.ServiciosIds ?? []).Distinct().ToList();
        if (servicios.Count > 0
            && await db.ServiciosDeTaller.AsNoTracking().CountAsync(x => servicios.Contains(x.Id) && x.Activo, ct) != servicios.Count)
        {
            errores["serviciosIds"] = ["Algún servicio no existe en el catálogo."];
        }
        var familias = (peticion.FamiliasIds ?? []).Distinct().ToList();
        if (familias.Count > 0
            && await db.FamiliasDeInstrumentos.AsNoTracking().CountAsync(x => familias.Contains(x.Id) && x.Activo, ct) != familias.Count)
        {
            errores["familiasIds"] = ["Alguna familia de instrumentos no existe en el catálogo."];
        }
        var practicas = (peticion.PracticasMusicalesIds ?? []).Distinct().ToList();
        if (practicas.Count > 0
            && await db.PracticasMusicales.AsNoTracking().CountAsync(x => practicas.Contains(x.Id), ct) != practicas.Count)
        {
            errores["practicasMusicalesIds"] = ["Alguna práctica musical no existe en el catálogo."];
        }

        // LA SEDE PRINCIPAL, con el validador DIVIPOLA común (decisión 119): aparte de la cobertura.
        var sede = SedePrincipal.Resolver(
            peticion.SedeCodigoDepartamento, peticion.SedeCodigoMunicipio, nivel, departamento, municipio);
        await SedePrincipal.ValidarAsync(errores, db, sede.Departamento, sede.Municipio, ct);

        return errores;
    }

    /// <summary>Lo que hace falta para enviar un taller a revisión, en el idioma de quien lo diligencia.</summary>
    private static async Task<Dictionary<string, string[]>> ValidarParaRevisionAsync(
        TallerRow taller, SimusDbContext db, CancellationToken ct)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(taller.Descripcion))
        {
            errores["descripcion"] = ["Para enviarlo falta una descripción: cuenta qué hace el taller."];
        }
        if (!await db.TalleresServicios.AsNoTracking().AnyAsync(x => x.TallerId == taller.Id, ct))
        {
            errores["serviciosIds"] = ["Para enviarlo falta elegir al menos un servicio del taller."];
        }
        if (!await db.TalleresFamiliasDeInstrumentos.AsNoTracking().AnyAsync(x => x.TallerId == taller.Id, ct))
        {
            errores["familiasIds"] = ["Para enviarlo falta elegir al menos una familia de instrumentos."];
        }
        var tieneContacto = new[]
        {
            taller.CorreoTaller, taller.TelefonoTaller, taller.SitioWebTaller,
            taller.InstagramTaller, taller.FacebookTaller, taller.OtroEnlaceTaller,
        }.Any(valor => !string.IsNullOrWhiteSpace(valor));
        if (!tieneContacto)
        {
            errores["correoTaller"] = ["Para enviarlo falta una forma de contacto: un correo, un teléfono, un sitio o una red."];
        }

        await SedePrincipal.ValidarParaRevisionAsync(errores, db, taller, ct);

        return errores;
    }

    private static Task<bool> ExisteEnDivipolaAsync(
        SimusDbContext db, string departamento, string? municipio, CancellationToken ct) =>
        municipio is null
            ? db.DivipolaLocations.AsNoTracking().AnyAsync(d => d.DepartmentCode == departamento, ct)
            : db.DivipolaLocations.AsNoTracking()
                .AnyAsync(d => d.DepartmentCode == departamento && d.MunicipalityCode == municipio, ct);

    /// <summary>
    /// Los campos de fondo que la petición cambiaría frente a lo guardado. Es lo que, sobre lo publicado, pasa por una
    /// propuesta de cambio y no se escribe en caliente (<see cref="TallerConPropuestas"/>).
    /// </summary>
    internal static async Task<List<string>> CamposDeFondoQueCambianAsync(
        SimusDbContext db, TallerRow actual, TallerUpsertRequest solicitud, CancellationToken ct)
    {
        var nuevo = new TallerRow();
        Volcar(solicitud, nuevo);
        var cambian = new List<string>();
        if (ProcesoConPropuestas.Difiere(actual.Nombre, nuevo.Nombre)) cambian.Add("nombre");
        if (ProcesoConPropuestas.Difiere(actual.Modalidad, nuevo.Modalidad)) cambian.Add("modalidad");
        if (ProcesoConPropuestas.Difiere(actual.NivelCobertura, nuevo.NivelCobertura)) cambian.Add("nivelCobertura");
        if (ProcesoConPropuestas.Difiere(actual.CodigoDepartamento, nuevo.CodigoDepartamento)) cambian.Add("codigoDepartamento");
        if (ProcesoConPropuestas.Difiere(actual.CodigoMunicipio, nuevo.CodigoMunicipio)) cambian.Add("codigoMunicipio");
        if (!(await db.TalleresServicios.AsNoTracking().Where(x => x.TallerId == actual.Id).Select(x => x.ServicioTallerId).ToListAsync(ct)).ToHashSet().SetEquals(solicitud.ServiciosIds ?? []))
        {
            cambian.Add("servicios");
        }
        if (!(await db.TalleresFamiliasDeInstrumentos.AsNoTracking().Where(x => x.TallerId == actual.Id).Select(x => x.FamiliaInstrumentoId).ToListAsync(ct)).ToHashSet().SetEquals(solicitud.FamiliasIds ?? []))
        {
            cambian.Add("familias");
        }
        return cambian;
    }

    // ═══════════════════════════════════ Traducción ═══════════════════════════════════

    internal static void Volcar(TallerUpsertRequest solicitud, TallerRow fila)
    {
        fila.Nombre = Texto(solicitud.Nombre, 240) ?? string.Empty;
        fila.Descripcion = Texto(solicitud.Descripcion, 4000);
        fila.Modalidad = EnMinuscula(solicitud.Modalidad ?? "fijo");
        fila.RecibeAprendices = solicitud.RecibeAprendices;
        fila.SaberesYTecnicas = Texto(solicitud.SaberesYTecnicas, 2000);
        fila.CorreoTaller = Texto(solicitud.CorreoTaller, 180);
        fila.TelefonoTaller = Texto(solicitud.TelefonoTaller, 80);
        fila.SitioWebTaller = ValidationHelpers.NormalizeHttpsUrl(Opcional(solicitud.SitioWebTaller));
        fila.InstagramTaller = ValidationHelpers.NormalizeSocialLink(Opcional(solicitud.InstagramTaller));
        fila.FacebookTaller = ValidationHelpers.NormalizeSocialLink(Opcional(solicitud.FacebookTaller));
        fila.OtroEnlaceTaller = ValidationHelpers.NormalizeHttpsUrl(Opcional(solicitud.OtroEnlaceTaller));
        fila.NivelCobertura = EnMinuscula(solicitud.NivelCobertura);
        fila.CodigoDepartamento = Opcional(solicitud.CodigoDepartamento);
        fila.CodigoMunicipio = Opcional(solicitud.CodigoMunicipio);
        SedePrincipal.Aplicar(fila, solicitud.SedeCodigoDepartamento, solicitud.SedeCodigoMunicipio, fila.NivelCobertura, fila.CodigoDepartamento, fila.CodigoMunicipio);
        fila.LugarEspecifico = Texto(solicitud.LugarEspecifico, 300);
        fila.ArchivoFotoId = solicitud.ArchivoFotoId;
    }

    /// <summary>Deja los servicios, las familias y las prácticas del taller exactamente como los pide la petición.</summary>
    internal static async Task SincronizarAsync(
        SimusDbContext db, int tallerId, TallerUpsertRequest solicitud, CancellationToken ct)
    {
        var servicios = (solicitud.ServiciosIds ?? []).Distinct().ToHashSet();
        var actuales = await db.TalleresServicios.Where(x => x.TallerId == tallerId).ToListAsync(ct);
        db.TalleresServicios.RemoveRange(actuales.Where(x => !servicios.Contains(x.ServicioTallerId)));
        foreach (var id in servicios.Where(id => actuales.All(x => x.ServicioTallerId != id)))
        {
            db.TalleresServicios.Add(new TallerServicioRow { TallerId = tallerId, ServicioTallerId = id, FechaCreacion = DateTime.UtcNow });
        }

        var familias = (solicitud.FamiliasIds ?? []).Distinct().ToHashSet();
        var familiasActuales = await db.TalleresFamiliasDeInstrumentos.Where(x => x.TallerId == tallerId).ToListAsync(ct);
        db.TalleresFamiliasDeInstrumentos.RemoveRange(familiasActuales.Where(x => !familias.Contains(x.FamiliaInstrumentoId)));
        foreach (var id in familias.Where(id => familiasActuales.All(x => x.FamiliaInstrumentoId != id)))
        {
            db.TalleresFamiliasDeInstrumentos.Add(new TallerFamiliaInstrumentoRow { TallerId = tallerId, FamiliaInstrumentoId = id, FechaCreacion = DateTime.UtcNow });
        }

        var practicas = (solicitud.PracticasMusicalesIds ?? []).Distinct().ToHashSet();
        var practicasActuales = await db.TalleresPracticasMusicales.Where(x => x.TallerId == tallerId).ToListAsync(ct);
        db.TalleresPracticasMusicales.RemoveRange(practicasActuales.Where(x => !practicas.Contains(x.PracticaMusicalId)));
        foreach (var id in practicas.Where(id => practicasActuales.All(x => x.PracticaMusicalId != id)))
        {
            db.TalleresPracticasMusicales.Add(new TallerPracticaMusicalRow { TallerId = tallerId, PracticaMusicalId = id, FechaCreacion = DateTime.UtcNow });
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>El taller con sus dos listados como texto, para compararlo en el historial.</summary>
    internal static async Task<TallerParaElHistorial> ParaElHistorialAsync(
        SimusDbContext db, TallerRow taller, CancellationToken ct)
    {
        var servicios = await db.TalleresServicios.AsNoTracking()
            .Where(x => x.TallerId == taller.Id)
            .Join(db.ServiciosDeTaller.AsNoTracking(), x => x.ServicioTallerId, s => s.Id, (_, s) => s.Nombre)
            .ToListAsync(ct);
        var familias = await db.TalleresFamiliasDeInstrumentos.AsNoTracking()
            .Where(x => x.TallerId == taller.Id)
            .Join(db.FamiliasDeInstrumentos.AsNoTracking(), x => x.FamiliaInstrumentoId, f => f.Id, (_, f) => f.Nombre)
            .ToListAsync(ct);
        return new TallerParaElHistorial(
            taller,
            string.Join(", ", servicios.OrderBy(x => x, StringComparer.Ordinal)),
            string.Join(", ", familias.OrderBy(x => x, StringComparer.Ordinal)));
    }

    internal static async Task<List<TallerDto>> ATarjetasAsync(
        SimusDbContext db, List<TallerRow> filas, CancellationToken ct)
    {
        if (filas.Count == 0) return [];

        var ids = filas.Select(f => f.Id).ToList();
        var idsDeOrganizacion = filas.Where(f => f.OrganizacionPrincipalId is not null)
            .Select(f => f.OrganizacionPrincipalId!.Value).Distinct().ToList();
        var idsDePersona = filas.Where(f => f.UsuarioResponsableId is not null)
            .Select(f => f.UsuarioResponsableId!.Value).Distinct().ToList();

        var organizaciones = await db.EntityProfiles.AsNoTracking()
            .Where(e => idsDeOrganizacion.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.Name, ct);
        var personas = await db.Users.AsNoTracking()
            .Where(u => idsDePersona.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        var serviciosPorTaller = (await db.TalleresServicios.AsNoTracking()
                .Where(x => ids.Contains(x.TallerId))
                .Join(db.ServiciosDeTaller.AsNoTracking(), x => x.ServicioTallerId, s => s.Id,
                    (x, s) => new { x.TallerId, s.Id, s.Nombre, s.Slug, s.EstadoAprobacion, s.OrdenVisualizacion })
                .ToListAsync(ct))
            .GroupBy(x => x.TallerId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<OpcionDeTallerDto>)g
                .OrderBy(x => x.OrdenVisualizacion).ThenBy(x => x.Nombre)
                .Select(x => new OpcionDeTallerDto(x.Id, x.Nombre, x.Slug, null, x.EstadoAprobacion)).ToList());
        var familiasPorTaller = (await db.TalleresFamiliasDeInstrumentos.AsNoTracking()
                .Where(x => ids.Contains(x.TallerId))
                .Join(db.FamiliasDeInstrumentos.AsNoTracking(), x => x.FamiliaInstrumentoId, f => f.Id,
                    (x, f) => new { x.TallerId, f.Id, f.Nombre, f.Slug, f.FamiliaPadreId, f.EstadoAprobacion, f.OrdenVisualizacion })
                .ToListAsync(ct))
            .GroupBy(x => x.TallerId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<OpcionDeTallerDto>)g
                .OrderBy(x => x.OrdenVisualizacion).ThenBy(x => x.Nombre)
                .Select(x => new OpcionDeTallerDto(x.Id, x.Nombre, x.Slug, x.FamiliaPadreId, x.EstadoAprobacion)).ToList());
        var practicasPorTaller = (await db.TalleresPracticasMusicales.AsNoTracking()
                .Where(x => ids.Contains(x.TallerId))
                .Join(db.PracticasMusicales.AsNoTracking(), x => x.PracticaMusicalId, p => p.Id,
                    (x, p) => new { x.TallerId, p.Id, p.Nombre, p.Orden })
                .ToListAsync(ct))
            .GroupBy(x => x.TallerId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<CatalogoDeMercadoDto>)g
                .OrderBy(x => x.Orden).ThenBy(x => x.Nombre)
                .Select(x => new CatalogoDeMercadoDto(x.Id, x.Nombre)).ToList());

        var codigos = filas.Where(f => f.CodigoDepartamento is not null).Select(f => f.CodigoDepartamento!).Distinct().ToList();
        var territorios = await db.DivipolaLocations.AsNoTracking()
            .Where(d => codigos.Contains(d.DepartmentCode))
            .Select(d => new { d.DepartmentCode, d.DepartmentName, d.MunicipalityCode, d.MunicipalityName })
            .ToListAsync(ct);

        var textosDeFoto = await FotoDeProceso.TextosAsync(db, filas.Select(f => f.ArchivoFotoId), ct);

        var sedeDe = await SedePrincipal.ResolverNombresAsync(db, filas, ct);
        var tarjetas = new List<TallerDto>(filas.Count);
        foreach (var f in filas)
        {
            var departamento = f.CodigoDepartamento is null
                ? null
                : territorios.Find(t => t.DepartmentCode == f.CodigoDepartamento)?.DepartmentName;
            var municipio = f.CodigoMunicipio is null
                ? null
                : territorios.Find(t => t.DepartmentCode == f.CodigoDepartamento && t.MunicipalityCode == f.CodigoMunicipio)?.MunicipalityName;

            tarjetas.Add(new TallerDto(
                f.Id, f.Nombre, f.Descripcion, f.Modalidad, f.RecibeAprendices, f.SaberesYTecnicas,
                f.CorreoTaller, f.TelefonoTaller, f.SitioWebTaller, f.InstagramTaller, f.FacebookTaller, f.OtroEnlaceTaller,
                f.NivelCobertura, f.CodigoDepartamento, departamento, f.CodigoMunicipio, municipio, f.LugarEspecifico,
                f.OrganizacionPrincipalId,
                f.OrganizacionPrincipalId is int o && organizaciones.TryGetValue(o, out var nombreOrganizacion) ? nombreOrganizacion : null,
                f.UsuarioResponsableId,
                f.UsuarioResponsableId is int p && personas.TryGetValue(p, out var nombrePersona) ? nombrePersona : null,
                f.EstadoRegistro, f.MotivoDeLaDecision,
                serviciosPorTaller.GetValueOrDefault(f.Id) ?? [],
                familiasPorTaller.GetValueOrDefault(f.Id) ?? [],
                practicasPorTaller.GetValueOrDefault(f.Id) ?? [],
                f.FechaCreacion, f.FechaActualizacion, f.FechaEnvioARevision, f.FechaPublicacion,
                f.ArchivoFotoId,
                FotoDeProceso.Url(f.ArchivoFotoId),
                f.ArchivoFotoId is int fotoConTexto ? textosDeFoto.GetValueOrDefault(fotoConTexto) : null,
                sedeDe(f)));
        }
        return tarjetas;
    }

    /// <summary>Lo que el portal puede enseñar: la lista expresa de campos permitidos.</summary>
    internal static async Task<List<TallerPublicoDto>> APublicosAsync(
        SimusDbContext db, IReadOnlyList<TallerDto> talleres, CancellationToken ct)
    {
        var conFicha = await PerfilPublicoEndpoints.OrganizacionesConFichaAsync(
            db, talleres.Where(t => t.OrganizacionId is not null).Select(t => t.OrganizacionId!.Value), ct);
        var institucional = await ReclamacionesAdministracionEndpoints.IdInstitucionalAsync(db, ct);
        return talleres.Select(t =>
        {
            var lugar = SedePrincipal.ParaMostrar(t.Sede, t.CodigoDepartamento, t.NombreDepartamento, t.CodigoMunicipio, t.NombreMunicipio);
            return new TallerPublicoDto(
            t.Id, t.Nombre, t.Descripcion, t.Modalidad, t.RecibeAprendices, t.SaberesYTecnicas,
            t.CorreoTaller, t.TelefonoTaller, t.SitioWebTaller, t.InstagramTaller, t.FacebookTaller, t.OtroEnlaceTaller,
            t.NivelCobertura,
            lugar.CodigoDepartamento, lugar.NombreDepartamento, lugar.CodigoMunicipio, lugar.NombreMunicipio,
            t.LugarEspecifico,
            EsIndependiente: t.OrganizacionId is null,
            OrganizacionNombre: t.OrganizacionNombre,
            OrganizacionPublicaId: t.OrganizacionId is int o && conFicha.Contains(o) ? o : null,
            t.FechaPublicacion, t.Servicios, t.Familias, t.PracticasMusicales,
            t.FotoUrl, t.FotoAlt, t.Sede,
            EsRegistroHistorico: institucional is not null && t.OrganizacionId == institucional);
        }).ToList();
    }

    // ═══════════════════════════════════════ Avisos ═══════════════════════════════════════

    private static async Task AvisarAlProgramaAsync(
        SimusDbContext db, TallerRow taller, string queHizo, DateTime ahora, CancellationToken ct)
    {
        var responsable = taller.OrganizacionPrincipalId is int organizacion
            ? await db.EntityProfiles.AsNoTracking().Where(e => e.Id == organizacion).Select(e => e.Name).FirstOrDefaultAsync(ct)
            : await db.Users.AsNoTracking().Where(u => u.Id == taller.UsuarioResponsableId).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        responsable ??= "una organización";

        var destinatarios = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && db.UsuariosRoles.Any(ur => ur.UserId == u.Id
                && db.Roles.Any(r => r.Id == ur.RoleId && (r.Name == "webmaster" || r.Name == "gestor_interno"))))
            .Select(u => new { u.Id, u.Email })
            .ToListAsync(ct);

        foreach (var destinatario in destinatarios)
        {
            db.Notifications.Add(new NotificationRow
            {
                RecipientUserId = destinatario.Id,
                RecipientEmail = destinatario.Email,
                EventType = "TallerRecibidoParaRevision",
                AccessScope = SimusAuthentication.InstitutionalScope,
                Channel = "internal",
                Title = "Taller pendiente de revisión",
                Body = $"{responsable} {queHizo}: el taller de lutería «{taller.Nombre}».",
                Status = "enviada",
                ModuloId = Modulos.Talleres,
                RecordId = taller.Id.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });
        }
    }

    private static async Task AvisarAlResponsableAsync(
        SimusDbContext db, TallerRow taller, string? motivo, DateTime ahora, CancellationToken ct)
    {
        var (evento, titulo, cuerpo) = taller.EstadoRegistro switch
        {
            "publicado" => (
                "TallerPublicado",
                "Taller publicado",
                $"El taller de lutería «{taller.Nombre}» quedó publicado en el ecosistema."),
            "rechazado" => (
                "TallerRechazado",
                "Taller rechazado",
                $"El PNMC rechazó el taller de lutería «{taller.Nombre}». Motivo: {motivo}"),
            "archivado" => (
                "TallerArchivado",
                "Taller retirado del ecosistema",
                $"El taller de lutería «{taller.Nombre}» fue retirado del ecosistema. {motivo}"),
            _ => (
                "TallerConAjustesSolicitados",
                "Ajustes solicitados en tu taller",
                $"El PNMC pidió ajustes en el taller de lutería «{taller.Nombre}». {motivo}"),
        };

        var personas = taller.OrganizacionPrincipalId is int organizacion
            ? await db.UserEntities.AsNoTracking()
                .Where(ue => ue.EntityId == organizacion && ue.IsActive)
                .Join(db.Users.AsNoTracking().Where(u => u.IsActive),
                    relacion => relacion.UserId, usuario => usuario.Id,
                    (_, usuario) => new { usuario.Id, usuario.Email })
                .ToListAsync(ct)
            : await db.Users.AsNoTracking()
                .Where(u => u.Id == taller.UsuarioResponsableId && u.IsActive)
                .Select(u => new { u.Id, u.Email })
                .ToListAsync(ct);

        foreach (var persona in personas)
        {
            db.Notifications.Add(new NotificationRow
            {
                RecipientUserId = persona.Id,
                RecipientEmail = persona.Email,
                EventType = evento,
                AccessScope = SimusAuthentication.ExternalScope,
                Channel = "internal",
                Title = titulo,
                Body = cuerpo,
                Status = "enviada",
                ModuloId = Modulos.Talleres,
                RecordId = taller.Id.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });
        }
    }

    // ═══════════════════════════════════════ Utilidades ═══════════════════════════════════════

    private static string? Opcional(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    /// <summary>Un código de lista en minúsculas y sin espacios: modalidad, nivel, estado, decisión.</summary>
    private static string EnMinuscula(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? string.Empty : valor.ToLowerInvariant().Trim();

    private static string? Texto(string? valor, int maximo)
    {
        var limpio = ValidationHelpers.SanitizeText(valor, maximo);
        return string.IsNullOrWhiteSpace(limpio) ? null : limpio.Trim();
    }

    private static int? ActorDeLaConsola(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), NumberStyles.Integer,
            CultureInfo.InvariantCulture, out var id) && id > 0 ? id : null;
}
