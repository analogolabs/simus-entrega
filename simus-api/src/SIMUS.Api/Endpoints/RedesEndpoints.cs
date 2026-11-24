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
/// Las redes y centros de documentación: lectura pública, registro por su responsable y decisión del Programa.
/// </summary>
/// <remarks>
/// <para>
/// <b>ES EL RECORRIDO DE UN MERCADO, MAS CORTO.</b> Borrador, se completa, se envía a revisión, el
/// Programa decide, se publica. No hay ediciones ni propuestas de cambio sobre lo publicado: los
/// procesos de la red son eventos de la Agenda, y un cambio de contacto no necesita expediente.
/// </para>
/// <para>
/// <b>EL RESPONSABLE ES UNA ORGANIZACION O UNA PERSONA.</b> Una persona responsable registra su
/// red con su cuenta individual (<c>/externo/mis-redes</c>); una organización lo hace desde
/// <c>/externo/organizaciones/{id}/redes</c>. Cada ruta de una red existente comprueba quién
/// escribe contra el responsable de ESA red, no contra lo que diga el cuerpo.
/// </para>
/// <para>
/// <b>ERRATA AL INSTANTE, CAMBIO DE FONDO VUELVE A REVISION.</b> Corregir la descripción o el
/// contacto de una red publicada se aplica en el acto; cambiar su nombre, su territorio, su
/// tipo de nodo, sus formas de acceso o sus formatos lo devuelve a revisión (mismo criterio que Noticias).
/// Todo cambio queda en el registro de cambios por campo.
/// </para>
/// </remarks>
public static class RedesEndpoints
{
    private static readonly string[] TiposDeNodo = ["red", "centro_de_documentacion", "archivo", "coleccion", "grupo_de_investigacion"];
    private static readonly string[] NivelesDeCobertura = ["nacional", "departamental", "municipal"];
    private static readonly string[] EditablePorElResponsable = ["borrador", "ajustes_solicitados", "publicado"];

    private const int TamanoPorOmision = 25;
    private const int TamanoMaximo = 200;

    public static RouteGroupBuilder MapRedesEndpoints(this RouteGroupBuilder api)
    {
        // ───────────────────────── Lectura pública: solo lo publicado ─────────────────────────
        var publico = api.MapGroup("/publico/redes").WithTags("redes-publico").AllowAnonymous();
        publico.MapGet(string.Empty, ListarPublicos).WithName("ListarRedesPublicas").CacheaLecturaPublica();
        publico.MapGet("/catalogos", CatalogosPublicos).WithName("CatalogosDeRedesPublicas").CacheaLecturaPublica();
        publico.MapGet("/{id:int}", ObtenerPublico).WithName("ObtenerRedPublica").CacheaLecturaPublica();

        // ─────────────── Lo que hace quien responde por la red (organización o persona) ───────────────
        var externo = api.MapGroup("/externo").WithTags("redes-externos");
        externo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        externo.MapGet("/catalogos/red", CatalogosExternos).WithName("CatalogosDeRedExternos");
        externo.MapGet("/organizaciones/{organizacionId:int}/redes", ListarDeLaOrganizacion)
            .WithName("ListarRedesDeLaOrganizacion");
        externo.MapPost("/organizaciones/{organizacionId:int}/redes", CrearDeLaOrganizacion)
            .WithName("CrearRedDeLaOrganizacion");
        // La foto de quien responde sin organización: /externo/archivos exige una (misma regla que los talleres).
        externo.MapPost("/mis-redes/foto", SubirFotoDelResponsable).WithName("SubirFotoDeRedPersonal").DisableAntiforgery().ConTopeDeImagen()
            .AddEndpointFilter(ExigeTestigoDeLaConsola.ExigirDelCanalExterno);
        externo.MapGet("/mis-redes", ListarMios).WithName("ListarMisRedes");
        externo.MapPost("/mis-redes", CrearMio).WithName("CrearMiRed");
        externo.MapGet("/redes/{redId:int}", ObtenerDelResponsable).WithName("ObtenerRedDelResponsable");
        externo.MapPut("/redes/{redId:int}", GuardarDelResponsable).WithName("GuardarRedDelResponsable");
        externo.MapPost("/redes/{redId:int}/enviar-a-revision", EnviarARevision).WithName("EnviarRedARevision");
        externo.MapDelete("/redes/{redId:int}", RetirarOAbandonar).WithName("RetirarRedDeRevisionOAbandonar");
        externo.MapPost("/redes/{redId:int}/retirar", RetirarPublicado)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir).WithName("RetirarRedPublicada");

        // ───────────────────────────── Decisión del Programa (consola) ─────────────────────────────
        var consola = api.MapGroup("/institucional/redes")
            .WithTags("redes")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("redes");

        consola.MapGet(string.Empty, ListarDeLaConsola).WithName("ListarRedes");
        consola.MapGet("/catalogos", CatalogosDeLaConsola).WithName("CatalogosDeRedConsola");
        consola.MapGet("/{id:int}", ObtenerDeLaConsola).WithName("ObtenerRed");
        consola.MapPost("/{id:int}/decision", Decidir)
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir)
            .WithName("DecidirSobreRed");
        consola.MapPost("/{id:int}/archivar", Archivar)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir)
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir)
            .WithName("ArchivarRed");

        return api;
    }

    // ═══════════════════════════════════ Lectura pública ═══════════════════════════════════

    private static async Task<IResult> ListarPublicos(
        SimusDbContext db, string? q, string? departamento, string? municipio, int? formaDeAcceso, int? formato,
        int? limit, int? offset, CancellationToken ct)
    {
        var consulta = db.Redes.AsNoTracking().Where(t => t.Activo && t.EstadoRegistro == "publicado");

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
        if (formaDeAcceso is > 0)
        {
            var id = formaDeAcceso.Value;
            consulta = consulta.Where(t => db.RedesFormasDeAcceso.Any(x => x.RedId == t.Id && x.FormaDeAccesoId == id));
        }
        if (formato is > 0)
        {
            var id = formato.Value;
            consulta = consulta.Where(t => db.RedesFormatos.Any(x => x.RedId == t.Id && x.FormatoId == id));
        }

        consulta = consulta.OrderBy(t => t.Nombre).ThenBy(t => t.Id);

        var total = await consulta.CountAsync(ct);
        var porPagina = Math.Clamp(limit ?? 500, 1, 500);
        var desde = Math.Max(offset ?? 0, 0);
        var filas = await consulta.Skip(desde).Take(porPagina).ToListAsync(ct);

        var lista = await APublicosAsync(db, await ATarjetasAsync(db, filas, ct), ct);
        return Results.Ok(new PagedResponse<RedPublicaDto>(lista, porPagina, desde, total));
    }

    private static async Task<IResult> ObtenerPublico(int id, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.Redes.AsNoTracking()
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
    internal static async Task<CatalogosDeRedDto> CatalogosAsync(SimusDbContext db, CancellationToken ct)
    {
        var formasDeAcceso = await db.FormasDeAccesoDeRed.AsNoTracking()
            .Where(s => s.Activo)
            .OrderBy(s => s.OrdenVisualizacion).ThenBy(s => s.Nombre)
            .Select(s => new OpcionDeRedDto(s.Id, s.Nombre, s.Slug, null, s.EstadoAprobacion))
            .ToListAsync(ct);
        var formatos = await db.FormatosDeDocumentacion.AsNoTracking()
            .Where(f => f.Activo)
            .OrderBy(f => f.OrdenVisualizacion).ThenBy(f => f.Nombre)
            .Select(f => new OpcionDeRedDto(f.Id, f.Nombre, f.Slug, f.FormatoPadreId, f.EstadoAprobacion))
            .ToListAsync(ct);
        // LAS PRACTICAS SON LAS DEL ECOSISTEMA, el mismo catálogo que llena un Festival o un Mercado.
        var practicas = await db.PracticasMusicales.AsNoTracking()
            .OrderBy(x => x.Orden).ThenBy(x => x.Nombre)
            .Select(x => new CatalogoDeMercadoDto(x.Id, x.Nombre))
            .ToListAsync(ct);
        return new CatalogosDeRedDto(formasDeAcceso, formatos, practicas);
    }

    // ═══════════════════════════ Lo que hace el responsable de la red ═══════════════════════════

    private static async Task<IResult> ListarDeLaOrganizacion(
        int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var filas = await db.Redes.AsNoTracking()
            .Where(t => t.OrganizacionPrincipalId == organizacionId && t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync(ct);
        return Results.Ok(await ATarjetasAsync(db, filas, ct));
    }

    private static async Task<IResult> SubirFotoDelResponsable(
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

        var filas = await db.Redes.AsNoTracking()
            .Where(t => t.UsuarioResponsableId == persona.Value && t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync(ct);
        return Results.Ok(await ATarjetasAsync(db, filas, ct));
    }

    private static async Task<IResult> CrearDeLaOrganizacion(
        int organizacionId,
        RedUpsertRequest solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El registro de la red no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        if (await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(
                db, politica, organizacionId, "registrar redes y documentación", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        // LA ORGANIZACION LA DECIDE LA RUTA, NO EL CUERPO: el cuerpo ni siquiera la lleva.
        return await CrearAsync(db, solicitud, persona.Value, organizacionId, usuarioResponsableId: null, ct);
    }

    private static async Task<IResult> CrearMio(
        RedUpsertRequest solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El registro de la red no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        if (await ExigirCorreoDeLaPersonaAsync(db, politica, persona.Value, "registrar tu red o centro de documentación", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        return await CrearAsync(db, solicitud, persona.Value, organizacionId: null, usuarioResponsableId: persona.Value, ct);
    }

    private static async Task<IResult> CrearAsync(
        SimusDbContext db, RedUpsertRequest solicitud, int actor, int? organizacionId, int? usuarioResponsableId,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var errores = await ValidarAsync(solicitud, db, ct, null, organizacionId, usuarioResponsableId);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;

        // LA RED Y SU RASTRO SON UNA SOLA UNIDAD, y la estrategia de ejecución es la de SQL Server
        // (reintento): abrir la transacción sin ella funciona en SQLite y el motor real la rechaza.
        var estrategia = db.Database.CreateExecutionStrategy();
        var red = await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);

            var fila = new RedRow
            {
                EstadoRegistro = "borrador",
                Activo = true,
                IdUsuarioCreador = actor,
                OrganizacionPrincipalId = organizacionId,
                UsuarioResponsableId = usuarioResponsableId,
                FechaCreacion = ahora,
            };
            Volcar(solicitud, fila);
            db.Redes.Add(fila);
            await db.SaveChangesAsync(ct);
            await SincronizarAsync(db, fila.Id, solicitud, ct);

            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Crear, "RedCreada", actor, "Redes",
                fila.Id.ToString(CultureInfo.InvariantCulture),
                antes: null, despues: new { estado = fila.EstadoRegistro }, motivo: null,
                OrigenDelCambio.Directo, ahora));
            // DE DONDE VINO EL REGISTRO: la organización que lo registró o, si es una persona, ella misma.
            await ProcedenciaDeRegistro.AnotarAsync(
                db, Modulos.Redes, fila.Id.ToString(CultureInfo.InvariantCulture),
                ProcedenciaDeRegistro.Externo, organizacionId, actor, ct);
            await db.SaveChangesAsync(ct);

            await transaccion.CommitAsync(ct);
            return fila;
        });

        var tarjetas = await ATarjetasAsync(db, [red], ct);
        return Results.Created($"/api/v1/externo/redes/{red.Id}", tarjetas[0]);
    }

    private static async Task<IResult> ObtenerDelResponsable(
        int redId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var (red, fallo) = await MioAsync(redId, principal, db, ct, bastaConEditar: true);
        if (fallo is not null) return fallo;

        var tarjetas = await ATarjetasAsync(db, [red!], ct);
        return Results.Ok(tarjetas[0]);
    }

    private static async Task<IResult> GuardarDelResponsable(
        int redId,
        RedUpsertRequest solicitud,
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

        var (red, fallo) = await MioAsync(redId, principal, db, ct, bastaConEditar: true);
        if (fallo is not null) return fallo;

        if (!Array.Exists(EditablePorElResponsable, e => e == red!.EstadoRegistro))
        {
            return Results.Conflict(new
            {
                message = red!.EstadoRegistro == "en_revision"
                    ? "La red está en revisión: no se edita hasta que el PNMC decida o lo retires de la revisión."
                    : "Esta red ya no se edita desde aquí.",
                estado = red.EstadoRegistro,
            });
        }

        ArgumentNullException.ThrowIfNull(solicitud);
        var errores = await ValidarAsync(solicitud, db, ct, red, red!.OrganizacionPrincipalId, red.UsuarioResponsableId);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        // LO PUBLICADO NO CAMBIA DE FONDO EN CALIENTE (PROP, decisión 122): la errata se corrige al instante y lo que
        // cambia qué es red se PROPONE (`/propuesta`) y lo decide el Programa. Aquí no se escribe nada.
        if (red!.EstadoRegistro == "publicado")
        {
            var deFondo = await CamposDeFondoQueCambianAsync(db, red, solicitud, ct);
            if (deFondo.Count > 0)
            {
                return Results.Conflict(new
                {
                    motivo = "cambio_de_fondo",
                    message = "Ese cambio no se guarda en caliente sobre lo publicado: propónlo y el PNMC lo revisa.",
                    campos = deFondo,
                    estado = red.EstadoRegistro,
                });
            }
        }

        var actor = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;

        var antes = RegistradorDeCambios.Tomar(await ParaElHistorialAsync(db, red, ct), CamposDeLaRed.Todos);
        Volcar(solicitud, red);
        await SincronizarAsync(db, red.Id, solicitud, ct);
        red.FechaActualizacion = ahora;
        await db.SaveChangesAsync(ct);

        var despues = await ParaElHistorialAsync(db, red, ct);
        var cambiados = await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(Modulos.Redes, red.Id.ToString(CultureInfo.InvariantCulture),
                red.OrganizacionPrincipalId, actor, red.OrganizacionPrincipalId is null ? "Persona" : "Organización", Fecha: ahora),
            CamposDeLaRed.Todos, antes, despues, ct);

        if (cambiados > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        var tarjetas = await ATarjetasAsync(db, [red], ct);
        return Results.Ok(tarjetas[0]);
    }

    private static async Task<IResult> EnviarARevision(
        int redId,
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

        var (red, fallo) = await MioAsync(redId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        if (red!.EstadoRegistro is not ("borrador" or "ajustes_solicitados"))
        {
            return Results.Conflict(new
            {
                message = "Solo una red en borrador o con ajustes solicitados puede enviarse a revisión.",
                estado = red.EstadoRegistro,
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var sinConfirmar = red.OrganizacionPrincipalId is int organizacion
            ? await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(db, politica, organizacion, "enviar esta red a revisión", ct)
            : await ExigirCorreoDeLaPersonaAsync(db, politica, persona, "enviar tu red a revisión", ct);
        if (sinConfirmar is not null) return sinConfirmar;

        var errores = await ValidarParaRevisionAsync(red, db, ct);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;
        var estadoAnterior = red.EstadoRegistro;
        red.EstadoRegistro = "en_revision";
        red.FechaEnvioARevision = ahora;
        red.FechaActualizacion = ahora;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Actualizar, "RedEnviadaARevision", persona, "Redes",
            red.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = red.EstadoRegistro },
            motivo: null, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Redes, red.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, red.EstadoRegistro, null);
        await AvisarAlProgramaAsync(db, red, "lo envió a revisión", ahora, ct);
        await db.SaveChangesAsync(ct);

        var tarjetas = await ATarjetasAsync(db, [red], ct);
        return Results.Ok(tarjetas[0]);
    }

    /// <summary>Deshacer un envío (vuelve a borrador) o abandonar un borrador (se archiva).</summary>
    private static async Task<IResult> RetirarOAbandonar(
        int redId,
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

        var (red, fallo) = await MioAsync(redId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        var estadoAnterior = red!.EstadoRegistro;
        var enRevision = estadoAnterior == "en_revision";
        if (!enRevision && estadoAnterior is not ("borrador" or "ajustes_solicitados"))
        {
            return Results.Conflict(new
            {
                message = "Una red publicada se retira del ecosistema con su motivo. Una red rechazada o archivada ya no se toca.",
                estado = estadoAnterior,
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;
        red.EstadoRegistro = enRevision ? "borrador" : "archivado";
        red.FechaActualizacion = ahora;
        if (!enRevision) red.FechaArchivado = ahora;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            enRevision ? AccionesAuditoria.Actualizar : AccionesAuditoria.Archivar,
            enRevision ? "RedRetiradaDeRevision" : "RedArchivada", persona, "Redes",
            red.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = red.EstadoRegistro },
            motivo: null, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Redes, red.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, red.EstadoRegistro, null);
        if (enRevision)
        {
            await AvisosDeRevision.MarcarComoResueltosAsync(
                db, Modulos.Redes, red.Id.ToString(CultureInfo.InvariantCulture), "RedRecibidaParaRevision", ahora, ct);
        }
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    /// <summary>Retirar del ecosistema una red publicada: lo hace su responsable, con motivo.</summary>
    private static async Task<IResult> RetirarPublicado(
        int redId,
        RetiroDeRed solicitud,
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

        var (red, fallo) = await MioAsync(redId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        if (red!.EstadoRegistro != "publicado")
        {
            return Results.Conflict(new
            {
                message = "Solo una red publicada se retira del ecosistema desde aquí.",
                estado = red.EstadoRegistro,
            });
        }

        var motivo = Texto(solicitud.Motivo, 1200);
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = ["Explica por qué retiras esta red del ecosistema."],
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;
        var estadoAnterior = red.EstadoRegistro;
        red.EstadoRegistro = "archivado";
        red.FechaArchivado = ahora;
        red.FechaActualizacion = ahora;
        red.MotivoDeLaDecision = motivo;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Archivar, "RedRetirada", persona, "Redes",
            red.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = red.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Redes, red.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, red.EstadoRegistro, motivo);
        await ArchivoDeEventosDelProceso.ArchivarAsync(db, ProcesoDelEvento.Red, red.Id, persona, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var tarjetas = await ATarjetasAsync(db, [red], ct);
        return Results.Ok(tarjetas[0]);
    }

    // ═══════════════════════════════ Decisión del Programa ═══════════════════════════════

    private static async Task<IResult> ListarDeLaConsola(
        SimusDbContext db, string? q, string? estado, string? responsable, string? orden, bool? descendente,
        int? pagina, int? tamano, string? sedeDepartamento, string? sedeMunicipio, bool? sedePendiente,
        CancellationToken ct)
    {
        var consulta = db.Redes.AsNoTracking().Where(t => t.Activo);

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
        return Results.Ok(new PagedResponse<RedDto>(lista, porPagina, (actual - 1) * porPagina, total));
    }

    private static async Task<IResult> ObtenerDeLaConsola(int id, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.Redes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (fila is null) return Results.NotFound();

        var lista = await ATarjetasAsync(db, [fila], ct);
        return Results.Ok(lista[0]);
    }

    /// <summary>La decisión del Programa sobre una red que llegó a revisión.</summary>
    /// <remarks>
    /// <b>SOLO DESDE «EN REVISION»</b>, salvo rechazar, que también cabe con ajustes pedidos (lo que
    /// nunca se publicó y no va a publicarse se cierra como «rechazado»). Pedir ajustes o rechazar sin
    /// decir por qué no es una decisión: el motivo es obligatorio y viaja al aviso del responsable.
    /// </remarks>
    private static async Task<IResult> Decidir(
        int id, DecisionSobreRed decision, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(decision);
        var red = await db.Redes.FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (red is null) return Results.NotFound();

        var pedida = EnMinuscula(decision.Decision);
        var motivo = Texto(decision.Motivo, 1200);

        var enRevision = red.EstadoRegistro == "en_revision";
        var conAjustes = red.EstadoRegistro == "ajustes_solicitados";
        if (!enRevision && !(pedida == "rechazar" && conAjustes))
        {
            return Results.Conflict(new
            {
                message = pedida == "rechazar"
                    ? "Solo se rechaza una red en revisión o con ajustes solicitados."
                    : "Solo se decide sobre una red que esté en revisión.",
                estado = red.EstadoRegistro,
            });
        }

        if (pedida is "ajustes" or "rechazar" && motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = [pedida == "rechazar"
                    ? "Explica por qué se rechaza la red: la persona o la organización necesita saberlo."
                    : "Di qué hay que corregir: sin eso la red vuelve igual."],
            });
        }

        var ahora = DateTime.UtcNow;
        var estadoAnterior = red.EstadoRegistro;
        string evento;
        string verbo;
        switch (pedida)
        {
            case "publicar":
                red.EstadoRegistro = "publicado";
                red.FechaPublicacion = ahora;
                red.MotivoDeLaDecision = null;
                evento = "RedPublicada";
                verbo = AccionesAuditoria.Publicar;
                break;
            case "ajustes":
                red.EstadoRegistro = "ajustes_solicitados";
                red.MotivoDeLaDecision = motivo;
                evento = "RedConAjustesSolicitados";
                verbo = AccionesAuditoria.Actualizar;
                break;
            case "rechazar":
                red.EstadoRegistro = "rechazado";
                red.MotivoDeLaDecision = motivo;
                evento = "RedRechazada";
                verbo = AccionesAuditoria.Rechazar;
                break;
            default:
                return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
                {
                    ["decision"] = ["La decisión debe ser «publicar», «ajustes» o «rechazar»."],
                });
        }

        red.FechaActualizacion = ahora;
        var actor = ActorDeLaConsola(principal);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            verbo, evento, actor, "Redes", red.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = red.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Redes, red.Id, actor ?? 0,
            HistorialDeEstados.AccionDelCambio(estadoAnterior, red.EstadoRegistro),
            estadoAnterior, red.EstadoRegistro, motivo);
        await AvisosDeRevision.MarcarComoResueltosAsync(
            db, Modulos.Redes, red.Id.ToString(CultureInfo.InvariantCulture), "RedRecibidaParaRevision", ahora, ct);
        await AvisarAlResponsableAsync(db, red, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var lista = await ATarjetasAsync(db, [red], ct);
        return Results.Ok(lista[0]);
    }

    /// <summary>Retirar del ecosistema una red ya publicado, con su motivo.</summary>
    private static async Task<IResult> Archivar(
        int id, RetiroDeRed solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var red = await db.Redes.FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (red is null) return Results.NotFound();

        if (red.EstadoRegistro != "publicado")
        {
            return Results.Conflict(new
            {
                message = "Solo una red publicada puede retirarse del ecosistema desde aquí.",
                estado = red.EstadoRegistro,
            });
        }

        var motivo = Texto(solicitud.Motivo, 1200);
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = ["Explica por qué se retira esta red del ecosistema."],
            });
        }

        var ahora = DateTime.UtcNow;
        var estadoAnterior = red.EstadoRegistro;
        red.EstadoRegistro = "archivado";
        red.FechaArchivado = ahora;
        red.FechaActualizacion = ahora;
        red.MotivoDeLaDecision = motivo;

        var actor = ActorDeLaConsola(principal);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Archivar, "RedArchivada", actor, "Redes",
            red.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = red.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Redes, red.Id, actor ?? 0,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, red.EstadoRegistro, motivo);
        await AvisarAlResponsableAsync(db, red, motivo, ahora, ct);
        await ArchivoDeEventosDelProceso.ArchivarAsync(db, ProcesoDelEvento.Red, red.Id, actor, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var lista = await ATarjetasAsync(db, [red], ct);
        return Results.Ok(lista[0]);
    }

    // ═══════════════════════════════════ Guardas y reglas ═══════════════════════════════════

    /// <summary>
    /// La red que esta persona puede tocar, o el resultado que lo impide.
    /// </summary>
    /// <remarks>
    /// <b>LA GUARDA ES DEL RESPONSABLE DE ESA RED.</b> Si es una organización, se comprueba el rol
    /// de la persona en ella (editar basta para preparar; enviar y retirar piden administrar). Si es
    /// una persona, solo ella. Una red ajeno responde 404, no 403: no se confirma que exista.
    /// </remarks>
    private static async Task<(RedRow? Red, IResult? Fallo)> MioAsync(
        int redId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct,
        bool bastaConEditar = false, bool paraAdministrar = false)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return (null, Results.Unauthorized());

        var red = await db.Redes.FirstOrDefaultAsync(t => t.Id == redId && t.Activo, ct);
        if (red is null) return (null, Results.NotFound());

        if (red.OrganizacionPrincipalId is int organizacion)
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
        else if (red.UsuarioResponsableId != persona.Value)
        {
            return (null, Results.NotFound());
        }

        return (red, null);
    }

    /// <summary>La puerta del correo confirmado, para quien responde por una red sin organización.</summary>
    private static async Task<IResult?> ExigirCorreoDeLaPersonaAsync(
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
        RedUpsertRequest peticion, SimusDbContext db, CancellationToken ct,
        RedRow? actual = null, int? organizacionId = null, int? personaId = null)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (await FotoDeProceso.ValidarAsync(db, peticion.ArchivoFotoId, actual?.ArchivoFotoId, organizacionId, personaId, ct) is { } errorDeFoto)
        {
            errores["archivoFotoId"] = errorDeFoto;
        }

        if (string.IsNullOrWhiteSpace(peticion.Nombre)) errores["nombre"] = ["Escribe el nombre de la red."];

        var tipoDeNodo = EnMinuscula(peticion.TipoDeNodo);
        if (!Array.Exists(TiposDeNodo, m => m == tipoDeNodo))
        {
            errores["tipoDeNodo"] = ["Elige qué tipo de nodo es: red, centro de documentación, archivo, colección o grupo de investigación."];
        }

        // LA REGLA ÚNICA DE DIRECCIÓN Y DE TELÉFONO, la misma que el Festival y el Mercado.
        foreach (var (clave, valor) in new[] { ("sitioWebRed", peticion.SitioWebRed), ("otroEnlaceRed", peticion.OtroEnlaceRed) })
        {
            if (!ValidationHelpers.IsValidHttpsUrl(valor)) errores[clave] = [ValidationHelpers.MensajeDeUrl];
        }
        foreach (var (clave, valor) in new[] { ("instagramRed", peticion.InstagramRed), ("facebookRed", peticion.FacebookRed) })
        {
            if (!ValidationHelpers.IsValidSocialLink(valor)) errores[clave] = [ValidationHelpers.MensajeDeRedSocial];
        }
        if (!ValidationHelpers.IsValidPhone(peticion.TelefonoRed)) errores["telefonoRed"] = [ValidationHelpers.MensajeDeTelefono];
        if (!string.IsNullOrWhiteSpace(peticion.CorreoRed) && !ValidationHelpers.IsValidEmail(peticion.CorreoRed))
        {
            errores["correoRed"] = ["Escribe un correo válido, por ejemplo red@correo.co."];
        }

        var nivel = EnMinuscula(peticion.NivelCobertura);
        var departamento = Opcional(peticion.CodigoDepartamento);
        var municipio = Opcional(peticion.CodigoMunicipio);
        if (!Array.Exists(NivelesDeCobertura, n => n == nivel))
        {
            errores["nivelCobertura"] = ["Elige dónde trabaja la red: en el país, un departamento o un municipio."];
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

        var formasDeAcceso = (peticion.FormasDeAccesoIds ?? []).Distinct().ToList();
        if (formasDeAcceso.Count > 0
            && await db.FormasDeAccesoDeRed.AsNoTracking().CountAsync(x => formasDeAcceso.Contains(x.Id) && x.Activo, ct) != formasDeAcceso.Count)
        {
            errores["formasDeAccesoIds"] = ["Alguna forma de acceso no existe en el catálogo."];
        }
        var formatos = (peticion.FormatosIds ?? []).Distinct().ToList();
        if (formatos.Count > 0
            && await db.FormatosDeDocumentacion.AsNoTracking().CountAsync(x => formatos.Contains(x.Id) && x.Activo, ct) != formatos.Count)
        {
            errores["formatosIds"] = ["Algún formato no existe en el catálogo."];
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

    /// <summary>Lo que hace falta para enviar una red a revisión, en el idioma de quien lo diligencia.</summary>
    private static async Task<Dictionary<string, string[]>> ValidarParaRevisionAsync(
        RedRow red, SimusDbContext db, CancellationToken ct)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(red.Descripcion))
        {
            errores["descripcion"] = ["Para enviarlo falta una descripción: cuenta qué hace la red."];
        }
        if (!await db.RedesFormasDeAcceso.AsNoTracking().AnyAsync(x => x.RedId == red.Id, ct))
        {
            errores["formasDeAccesoIds"] = ["Para enviarlo falta elegir al menos una forma de acceso a la red."];
        }
        if (!await db.RedesFormatos.AsNoTracking().AnyAsync(x => x.RedId == red.Id, ct))
        {
            errores["formatosIds"] = ["Para enviarlo falta elegir al menos un formato de documentación."];
        }
        var tieneContacto = new[]
        {
            red.CorreoRed, red.TelefonoRed, red.SitioWebRed,
            red.InstagramRed, red.FacebookRed, red.OtroEnlaceRed,
        }.Any(valor => !string.IsNullOrWhiteSpace(valor));
        if (!tieneContacto)
        {
            errores["correoRed"] = ["Para enviarlo falta una forma de contacto: un correo, un teléfono, un sitio o una red social."];
        }

        await SedePrincipal.ValidarParaRevisionAsync(errores, db, red, ct);

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
    /// propuesta de cambio y no se escribe en caliente (<see cref="RedConPropuestas"/>).
    /// </summary>
    internal static async Task<List<string>> CamposDeFondoQueCambianAsync(
        SimusDbContext db, RedRow actual, RedUpsertRequest solicitud, CancellationToken ct)
    {
        var nuevo = new RedRow();
        Volcar(solicitud, nuevo);
        var cambian = new List<string>();
        if (ProcesoConPropuestas.Difiere(actual.Nombre, nuevo.Nombre)) cambian.Add("nombre");
        if (ProcesoConPropuestas.Difiere(actual.TipoDeNodo, nuevo.TipoDeNodo)) cambian.Add("tipoDeNodo");
        if (ProcesoConPropuestas.Difiere(actual.NivelCobertura, nuevo.NivelCobertura)) cambian.Add("nivelCobertura");
        if (ProcesoConPropuestas.Difiere(actual.CodigoDepartamento, nuevo.CodigoDepartamento)) cambian.Add("codigoDepartamento");
        if (ProcesoConPropuestas.Difiere(actual.CodigoMunicipio, nuevo.CodigoMunicipio)) cambian.Add("codigoMunicipio");
        if (!(await db.RedesFormasDeAcceso.AsNoTracking().Where(x => x.RedId == actual.Id).Select(x => x.FormaDeAccesoId).ToListAsync(ct)).ToHashSet().SetEquals(solicitud.FormasDeAccesoIds ?? []))
        {
            cambian.Add("formasDeAcceso");
        }
        if (!(await db.RedesFormatos.AsNoTracking().Where(x => x.RedId == actual.Id).Select(x => x.FormatoId).ToListAsync(ct)).ToHashSet().SetEquals(solicitud.FormatosIds ?? []))
        {
            cambian.Add("formatos");
        }
        return cambian;
    }

    // ═══════════════════════════════════ Traducción ═══════════════════════════════════

    internal static void Volcar(RedUpsertRequest solicitud, RedRow fila)
    {
        fila.Nombre = Texto(solicitud.Nombre, 240) ?? string.Empty;
        fila.Descripcion = Texto(solicitud.Descripcion, 4000);
        fila.TipoDeNodo = EnMinuscula(solicitud.TipoDeNodo ?? "red");
        fila.AccesoAbierto = solicitud.AccesoAbierto;
        fila.AcervosYColecciones = Texto(solicitud.AcervosYColecciones, 2000);
        fila.CorreoRed = Texto(solicitud.CorreoRed, 180);
        fila.TelefonoRed = Texto(solicitud.TelefonoRed, 80);
        fila.SitioWebRed = ValidationHelpers.NormalizeHttpsUrl(Opcional(solicitud.SitioWebRed));
        fila.InstagramRed = ValidationHelpers.NormalizeSocialLink(Opcional(solicitud.InstagramRed));
        fila.FacebookRed = ValidationHelpers.NormalizeSocialLink(Opcional(solicitud.FacebookRed));
        fila.OtroEnlaceRed = ValidationHelpers.NormalizeHttpsUrl(Opcional(solicitud.OtroEnlaceRed));
        fila.NivelCobertura = EnMinuscula(solicitud.NivelCobertura);
        fila.CodigoDepartamento = Opcional(solicitud.CodigoDepartamento);
        fila.CodigoMunicipio = Opcional(solicitud.CodigoMunicipio);
        SedePrincipal.Aplicar(fila, solicitud.SedeCodigoDepartamento, solicitud.SedeCodigoMunicipio, fila.NivelCobertura, fila.CodigoDepartamento, fila.CodigoMunicipio);
        fila.LugarEspecifico = Texto(solicitud.LugarEspecifico, 300);
        fila.ArchivoFotoId = solicitud.ArchivoFotoId;
    }

    /// <summary>Deja las formas de acceso, los formatos y las prácticas de la red exactamente como los pide la petición.</summary>
    internal static async Task SincronizarAsync(
        SimusDbContext db, int redId, RedUpsertRequest solicitud, CancellationToken ct)
    {
        var formasDeAcceso = (solicitud.FormasDeAccesoIds ?? []).Distinct().ToHashSet();
        var actuales = await db.RedesFormasDeAcceso.Where(x => x.RedId == redId).ToListAsync(ct);
        db.RedesFormasDeAcceso.RemoveRange(actuales.Where(x => !formasDeAcceso.Contains(x.FormaDeAccesoId)));
        foreach (var id in formasDeAcceso.Where(id => actuales.All(x => x.FormaDeAccesoId != id)))
        {
            db.RedesFormasDeAcceso.Add(new RedFormaDeAccesoRow { RedId = redId, FormaDeAccesoId = id, FechaCreacion = DateTime.UtcNow });
        }

        var formatos = (solicitud.FormatosIds ?? []).Distinct().ToHashSet();
        var formatosActuales = await db.RedesFormatos.Where(x => x.RedId == redId).ToListAsync(ct);
        db.RedesFormatos.RemoveRange(formatosActuales.Where(x => !formatos.Contains(x.FormatoId)));
        foreach (var id in formatos.Where(id => formatosActuales.All(x => x.FormatoId != id)))
        {
            db.RedesFormatos.Add(new RedFormatoRow { RedId = redId, FormatoId = id, FechaCreacion = DateTime.UtcNow });
        }

        var practicas = (solicitud.PracticasMusicalesIds ?? []).Distinct().ToHashSet();
        var practicasActuales = await db.RedesPracticasMusicales.Where(x => x.RedId == redId).ToListAsync(ct);
        db.RedesPracticasMusicales.RemoveRange(practicasActuales.Where(x => !practicas.Contains(x.PracticaMusicalId)));
        foreach (var id in practicas.Where(id => practicasActuales.All(x => x.PracticaMusicalId != id)))
        {
            db.RedesPracticasMusicales.Add(new RedPracticaMusicalRow { RedId = redId, PracticaMusicalId = id, FechaCreacion = DateTime.UtcNow });
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>La red con sus dos listados como texto, para compararlo en el historial.</summary>
    internal static async Task<RedParaElHistorial> ParaElHistorialAsync(
        SimusDbContext db, RedRow red, CancellationToken ct)
    {
        var formasDeAcceso = await db.RedesFormasDeAcceso.AsNoTracking()
            .Where(x => x.RedId == red.Id)
            .Join(db.FormasDeAccesoDeRed.AsNoTracking(), x => x.FormaDeAccesoId, s => s.Id, (_, s) => s.Nombre)
            .ToListAsync(ct);
        var formatos = await db.RedesFormatos.AsNoTracking()
            .Where(x => x.RedId == red.Id)
            .Join(db.FormatosDeDocumentacion.AsNoTracking(), x => x.FormatoId, f => f.Id, (_, f) => f.Nombre)
            .ToListAsync(ct);
        return new RedParaElHistorial(
            red,
            string.Join(", ", formasDeAcceso.OrderBy(x => x, StringComparer.Ordinal)),
            string.Join(", ", formatos.OrderBy(x => x, StringComparer.Ordinal)));
    }

    internal static async Task<List<RedDto>> ATarjetasAsync(
        SimusDbContext db, List<RedRow> filas, CancellationToken ct)
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

        var formasDeAccesoPorRed = (await db.RedesFormasDeAcceso.AsNoTracking()
                .Where(x => ids.Contains(x.RedId))
                .Join(db.FormasDeAccesoDeRed.AsNoTracking(), x => x.FormaDeAccesoId, s => s.Id,
                    (x, s) => new { x.RedId, s.Id, s.Nombre, s.Slug, s.EstadoAprobacion, s.OrdenVisualizacion })
                .ToListAsync(ct))
            .GroupBy(x => x.RedId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<OpcionDeRedDto>)g
                .OrderBy(x => x.OrdenVisualizacion).ThenBy(x => x.Nombre)
                .Select(x => new OpcionDeRedDto(x.Id, x.Nombre, x.Slug, null, x.EstadoAprobacion)).ToList());
        var formatosPorRed = (await db.RedesFormatos.AsNoTracking()
                .Where(x => ids.Contains(x.RedId))
                .Join(db.FormatosDeDocumentacion.AsNoTracking(), x => x.FormatoId, f => f.Id,
                    (x, f) => new { x.RedId, f.Id, f.Nombre, f.Slug, f.FormatoPadreId, f.EstadoAprobacion, f.OrdenVisualizacion })
                .ToListAsync(ct))
            .GroupBy(x => x.RedId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<OpcionDeRedDto>)g
                .OrderBy(x => x.OrdenVisualizacion).ThenBy(x => x.Nombre)
                .Select(x => new OpcionDeRedDto(x.Id, x.Nombre, x.Slug, x.FormatoPadreId, x.EstadoAprobacion)).ToList());
        var practicasPorRed = (await db.RedesPracticasMusicales.AsNoTracking()
                .Where(x => ids.Contains(x.RedId))
                .Join(db.PracticasMusicales.AsNoTracking(), x => x.PracticaMusicalId, p => p.Id,
                    (x, p) => new { x.RedId, p.Id, p.Nombre, p.Orden })
                .ToListAsync(ct))
            .GroupBy(x => x.RedId)
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
        var tarjetas = new List<RedDto>(filas.Count);
        foreach (var f in filas)
        {
            var departamento = f.CodigoDepartamento is null
                ? null
                : territorios.Find(t => t.DepartmentCode == f.CodigoDepartamento)?.DepartmentName;
            var municipio = f.CodigoMunicipio is null
                ? null
                : territorios.Find(t => t.DepartmentCode == f.CodigoDepartamento && t.MunicipalityCode == f.CodigoMunicipio)?.MunicipalityName;

            tarjetas.Add(new RedDto(
                f.Id, f.Nombre, f.Descripcion, f.TipoDeNodo, f.AccesoAbierto, f.AcervosYColecciones,
                f.CorreoRed, f.TelefonoRed, f.SitioWebRed, f.InstagramRed, f.FacebookRed, f.OtroEnlaceRed,
                f.NivelCobertura, f.CodigoDepartamento, departamento, f.CodigoMunicipio, municipio, f.LugarEspecifico,
                f.OrganizacionPrincipalId,
                f.OrganizacionPrincipalId is int o && organizaciones.TryGetValue(o, out var nombreOrganizacion) ? nombreOrganizacion : null,
                f.UsuarioResponsableId,
                f.UsuarioResponsableId is int p && personas.TryGetValue(p, out var nombrePersona) ? nombrePersona : null,
                f.EstadoRegistro, f.MotivoDeLaDecision,
                formasDeAccesoPorRed.GetValueOrDefault(f.Id) ?? [],
                formatosPorRed.GetValueOrDefault(f.Id) ?? [],
                practicasPorRed.GetValueOrDefault(f.Id) ?? [],
                f.FechaCreacion, f.FechaActualizacion, f.FechaEnvioARevision, f.FechaPublicacion,
                f.ArchivoFotoId, FotoDeProceso.Url(f.ArchivoFotoId),
                f.ArchivoFotoId is int fotoConTexto ? textosDeFoto.GetValueOrDefault(fotoConTexto) : null,
                sedeDe(f)));
        }
        return tarjetas;
    }

    /// <summary>Lo que el portal puede enseñar: la lista expresa de campos permitidos.</summary>
    internal static async Task<List<RedPublicaDto>> APublicosAsync(
        SimusDbContext db, IReadOnlyList<RedDto> redes, CancellationToken ct)
    {
        var conFicha = await PerfilPublicoEndpoints.OrganizacionesConFichaAsync(
            db, redes.Where(t => t.OrganizacionId is not null).Select(t => t.OrganizacionId!.Value), ct);
        var institucional = await ReclamacionesAdministracionEndpoints.IdInstitucionalAsync(db, ct);
        return redes.Select(t =>
        {
            var lugar = SedePrincipal.ParaMostrar(t.Sede, t.CodigoDepartamento, t.NombreDepartamento, t.CodigoMunicipio, t.NombreMunicipio);
            return new RedPublicaDto(
            t.Id, t.Nombre, t.Descripcion, t.TipoDeNodo, t.AccesoAbierto, t.AcervosYColecciones,
            t.CorreoRed, t.TelefonoRed, t.SitioWebRed, t.InstagramRed, t.FacebookRed, t.OtroEnlaceRed,
            t.NivelCobertura,
            lugar.CodigoDepartamento, lugar.NombreDepartamento, lugar.CodigoMunicipio, lugar.NombreMunicipio,
            t.LugarEspecifico,
            EsIndependiente: t.OrganizacionId is null,
            OrganizacionNombre: t.OrganizacionNombre,
            OrganizacionPublicaId: t.OrganizacionId is int o && conFicha.Contains(o) ? o : null,
            t.FechaPublicacion, t.FormasDeAcceso, t.Formatos, t.PracticasMusicales,
            t.FotoUrl, t.FotoAlt, t.Sede,
            EsRegistroHistorico: institucional is not null && t.OrganizacionId == institucional);
        }).ToList();
    }

    // ═══════════════════════════════════════ Avisos ═══════════════════════════════════════

    private static async Task AvisarAlProgramaAsync(
        SimusDbContext db, RedRow red, string queHizo, DateTime ahora, CancellationToken ct)
    {
        var responsable = red.OrganizacionPrincipalId is int organizacion
            ? await db.EntityProfiles.AsNoTracking().Where(e => e.Id == organizacion).Select(e => e.Name).FirstOrDefaultAsync(ct)
            : await db.Users.AsNoTracking().Where(u => u.Id == red.UsuarioResponsableId).Select(u => u.FullName).FirstOrDefaultAsync(ct);
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
                EventType = "RedRecibidaParaRevision",
                AccessScope = SimusAuthentication.InstitutionalScope,
                Channel = "internal",
                Title = "Red pendiente de revisión",
                Body = $"{responsable} {queHizo}: la red o centro de documentación «{red.Nombre}».",
                Status = "enviada",
                ModuloId = Modulos.Redes,
                RecordId = red.Id.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });
        }
    }

    private static async Task AvisarAlResponsableAsync(
        SimusDbContext db, RedRow red, string? motivo, DateTime ahora, CancellationToken ct)
    {
        var (evento, titulo, cuerpo) = red.EstadoRegistro switch
        {
            "publicado" => (
                "RedPublicada",
                "Red publicada",
                $"La red o centro de documentación «{red.Nombre}» quedó publicada en el ecosistema."),
            "rechazado" => (
                "RedRechazada",
                "Red rechazada",
                $"El PNMC rechazó la red o centro de documentación «{red.Nombre}». Motivo: {motivo}"),
            "archivado" => (
                "RedArchivada",
                "Red retirada del ecosistema",
                $"La red o centro de documentación «{red.Nombre}» fue retirada del ecosistema. {motivo}"),
            _ => (
                "RedConAjustesSolicitados",
                "Ajustes solicitados en tu red",
                $"El PNMC pidió ajustes en la red o centro de documentación «{red.Nombre}». {motivo}"),
        };

        var personas = red.OrganizacionPrincipalId is int organizacion
            ? await db.UserEntities.AsNoTracking()
                .Where(ue => ue.EntityId == organizacion && ue.IsActive)
                .Join(db.Users.AsNoTracking().Where(u => u.IsActive),
                    relacion => relacion.UserId, usuario => usuario.Id,
                    (_, usuario) => new { usuario.Id, usuario.Email })
                .ToListAsync(ct)
            : await db.Users.AsNoTracking()
                .Where(u => u.Id == red.UsuarioResponsableId && u.IsActive)
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
                ModuloId = Modulos.Redes,
                RecordId = red.Id.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });
        }
    }

    // ═══════════════════════════════════════ Utilidades ═══════════════════════════════════════

    private static string? Opcional(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    /// <summary>Un código de lista en minúsculas y sin espacios: tipo de nodo, nivel, estado, decisión.</summary>
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
