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
/// Los espacios para música en vivo: lectura pública, registro por su responsable y decisión del Programa (docs/referencia/25-modulos-restantes.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>ES EL RECORRIDO DE UN MERCADO, MAS CORTO.</b> Borrador, se completa, se envía a revisión, el
/// Programa decide, se publica. No hay ediciones ni propuestas de cambio sobre lo publicado: los
/// procesos del espacio son eventos de la Agenda, y un cambio de contacto no necesita expediente.
/// </para>
/// <para>
/// <b>EL RESPONSABLE ES UNA ORGANIZACION O UNA PERSONA.</b> Un responsable independiente registra su
/// espacio con su cuenta individual (<c>/externo/mis-espacios</c>); una organización lo hace desde
/// <c>/externo/organizaciones/{id}/espacios</c>. Cada ruta de un espacio existente comprueba quién
/// escribe contra el responsable de ESE espacio, no contra lo que diga el cuerpo.
/// </para>
/// <para>
/// <b>ERRATA AL INSTANTE, CAMBIO DE FONDO VUELVE A REVISION.</b> Corregir la descripción o el
/// contacto de un espacio publicado se aplica en el acto; cambiar su nombre, su territorio, su
/// ambiente, sus equipamiento o sus tipos lo devuelve a revisión (mismo criterio que Noticias).
/// Todo cambio queda en el registro de cambios por campo.
/// </para>
/// </remarks>
public static class EspaciosEndpoints
{
    private static readonly string[] Ambientes = ["cerrado", "abierto", "mixto"];
    // UN ESPACIO ESTA EN UN MUNICIPIO: es un lugar, no una cobertura. La base admite los tres niveles
    // (el CHECK es el mismo de todo el ecosistema) y el servidor exige el municipal.
    private static readonly string[] NivelesDeCobertura = ["municipal"];
    private static readonly string[] EditablePorElResponsable = ["borrador", "ajustes_solicitados", "publicado"];

    private const int TamanoPorOmision = 25;
    private const int TamanoMaximo = 200;

    public static RouteGroupBuilder MapEspaciosEndpoints(this RouteGroupBuilder api)
    {
        // ───────────────────────── Lectura pública: solo lo publicado ─────────────────────────
        var publico = api.MapGroup("/publico/espacios").WithTags("espacios-publico").AllowAnonymous();
        publico.MapGet(string.Empty, ListarPublicos).WithName("ListarEspaciosPublicos").CacheaLecturaPublica();
        publico.MapGet("/catalogos", CatalogosPublicos).WithName("CatalogosDeEspaciosPublicos").CacheaLecturaPublica();
        publico.MapGet("/{id:int}", ObtenerPublico).WithName("ObtenerEspacioPublico").CacheaLecturaPublica();

        // ─────────────── Lo que hace quien responde por el espacio (organización o persona) ───────────────
        var externo = api.MapGroup("/externo").WithTags("espacios-externos");
        externo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        externo.MapGet("/catalogos/espacio", CatalogosExternos).WithName("CatalogosDeEspacioExternos");
        externo.MapGet("/organizaciones/{organizacionId:int}/espacios", ListarDeLaOrganizacion)
            .WithName("ListarEspaciosDeLaOrganizacion");
        externo.MapPost("/organizaciones/{organizacionId:int}/espacios", CrearDeLaOrganizacion)
            .WithName("CrearEspacioDeLaOrganizacion");
        // La foto de quien responde sin organización: /externo/archivos exige una (misma regla que los talleres).
        externo.MapPost("/mis-espacios/foto", SubirFotoDelResponsable).WithName("SubirFotoDeEspacioPersonal").DisableAntiforgery().ConTopeDeImagen()
            .AddEndpointFilter(ExigeTestigoDeLaConsola.ExigirDelCanalExterno);
        externo.MapGet("/mis-espacios", ListarMios).WithName("ListarMisEspacios");
        externo.MapPost("/mis-espacios", CrearMio).WithName("CrearMiEspacio");
        externo.MapGet("/espacios/{espacioId:int}", ObtenerDelResponsable).WithName("ObtenerEspacioDelResponsable");
        externo.MapPut("/espacios/{espacioId:int}", GuardarDelResponsable).WithName("GuardarEspacioDelResponsable");
        externo.MapPost("/espacios/{espacioId:int}/enviar-a-revision", EnviarARevision).WithName("EnviarEspacioARevision");
        externo.MapDelete("/espacios/{espacioId:int}", RetirarOAbandonar).WithName("RetirarEspacioDeRevisionOAbandonar");
        externo.MapPost("/espacios/{espacioId:int}/retirar", RetirarPublicado)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir).WithName("RetirarEspacioPublicado");

        // ───────────────────────────── Decisión del Programa (consola) ─────────────────────────────
        var consola = api.MapGroup("/institucional/espacios")
            .WithTags("espacios")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo("espacios");

        consola.MapGet(string.Empty, ListarDeLaConsola).WithName("ListarEspacios");
        consola.MapGet("/catalogos", CatalogosDeLaConsola).WithName("CatalogosDeEspacioConsola");
        consola.MapGet("/{id:int}", ObtenerDeLaConsola).WithName("ObtenerEspacio");
        consola.MapPost("/{id:int}/decision", Decidir)
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir)
            .WithName("DecidirSobreEspacio");
        consola.MapPost("/{id:int}/archivar", Archivar)
            .AddEndpointFilter(CachePublicaAgenda.InvalidarTrasEscribir)
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir)
            .WithName("ArchivarEspacio");

        return api;
    }

    // ═══════════════════════════════════ Lectura pública ═══════════════════════════════════

    private static async Task<IResult> ListarPublicos(
        SimusDbContext db, string? q, string? departamento, string? municipio, int? equipamiento, int? tipo,
        int? limit, int? offset, CancellationToken ct)
    {
        var consulta = db.Espacios.AsNoTracking().Where(t => t.Activo && t.EstadoRegistro == "publicado");

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
        if (equipamiento is > 0)
        {
            var id = equipamiento.Value;
            consulta = consulta.Where(t => db.EspaciosEquipamiento.Any(x => x.EspacioId == t.Id && x.EquipamientoEspacioId == id));
        }
        if (tipo is > 0)
        {
            var id = tipo.Value;
            consulta = consulta.Where(t => db.EspaciosTipos.Any(x => x.EspacioId == t.Id && x.TipoEspacioId == id));
        }

        consulta = consulta.OrderBy(t => t.Nombre).ThenBy(t => t.Id);

        var total = await consulta.CountAsync(ct);
        var porPagina = Math.Clamp(limit ?? 500, 1, 500);
        var desde = Math.Max(offset ?? 0, 0);
        var filas = await consulta.Skip(desde).Take(porPagina).ToListAsync(ct);

        var lista = await APublicosAsync(db, await ATarjetasAsync(db, filas, ct), ct);
        return Results.Ok(new PagedResponse<EspacioPublicoDto>(lista, porPagina, desde, total));
    }

    private static async Task<IResult> ObtenerPublico(int id, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.Espacios.AsNoTracking()
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
    internal static async Task<CatalogosDeEspacioDto> CatalogosAsync(SimusDbContext db, CancellationToken ct)
    {
        var equipamiento = await db.EquipamientoDeEspacio.AsNoTracking()
            .Where(s => s.Activo)
            .OrderBy(s => s.OrdenVisualizacion).ThenBy(s => s.Nombre)
            .Select(s => new OpcionDeEspacioDto(s.Id, s.Nombre, s.Slug, s.EstadoAprobacion))
            .ToListAsync(ct);
        var tipos = await db.TiposDeEspacio.AsNoTracking()
            .Where(f => f.Activo)
            .OrderBy(f => f.OrdenVisualizacion).ThenBy(f => f.Nombre)
            .Select(f => new OpcionDeEspacioDto(f.Id, f.Nombre, f.Slug, f.EstadoAprobacion))
            .ToListAsync(ct);
        // LAS PRACTICAS SON LAS DEL ECOSISTEMA, el mismo catálogo que llena un Festival o un Mercado.
        var practicas = await db.PracticasMusicales.AsNoTracking()
            .OrderBy(x => x.Orden).ThenBy(x => x.Nombre)
            .Select(x => new CatalogoDeMercadoDto(x.Id, x.Nombre))
            .ToListAsync(ct);
        return new CatalogosDeEspacioDto(equipamiento, tipos, practicas);
    }

    // ═══════════════════════════ Lo que hace el responsable del espacio ═══════════════════════════

    private static async Task<IResult> ListarDeLaOrganizacion(
        int organizacionId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var filas = await db.Espacios.AsNoTracking()
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

        var filas = await db.Espacios.AsNoTracking()
            .Where(t => t.UsuarioResponsableId == persona.Value && t.Activo)
            .OrderBy(t => t.Nombre)
            .ToListAsync(ct);
        return Results.Ok(await ATarjetasAsync(db, filas, ct));
    }

    private static async Task<IResult> CrearDeLaOrganizacion(
        int organizacionId,
        EspacioUpsertRequest solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El registro del espacio no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        if (await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(
                db, politica, organizacionId, "registrar espacios para música en vivo", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        // LA ORGANIZACION LA DECIDE LA RUTA, NO EL CUERPO: el cuerpo ni siquiera la lleva.
        return await CrearAsync(db, solicitud, persona.Value, organizacionId, usuarioResponsableId: null, ct);
    }

    private static async Task<IResult> CrearMio(
        EspacioUpsertRequest solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext contexto,
        PoliticaDeConfirmacionDeCorreo politica,
        CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
        {
            return Results.BadRequest(new { message = "El registro del espacio no pudo validarse. Actualiza la página e inténtalo nuevamente." });
        }

        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        if (await ExigirCorreoDeLaPersonaAsync(db, politica, persona.Value, "registrar tu espacio para música en vivo", ct) is { } sinConfirmar)
        {
            return sinConfirmar;
        }

        return await CrearAsync(db, solicitud, persona.Value, organizacionId: null, usuarioResponsableId: persona.Value, ct);
    }

    private static async Task<IResult> CrearAsync(
        SimusDbContext db, EspacioUpsertRequest solicitud, int actor, int? organizacionId, int? usuarioResponsableId,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var errores = await ValidarAsync(solicitud, db, ct, null, organizacionId, usuarioResponsableId);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;

        // EL TALLER Y SU RASTRO SON UNA SOLA UNIDAD, y la estrategia de ejecución es la de SQL Server
        // (reintento): abrir la transacción sin ella funciona en SQLite y el motor real la rechaza.
        var estrategia = db.Database.CreateExecutionStrategy();
        var espacio = await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);

            var fila = new EspacioRow
            {
                EstadoRegistro = "borrador",
                Activo = true,
                IdUsuarioCreador = actor,
                OrganizacionPrincipalId = organizacionId,
                UsuarioResponsableId = usuarioResponsableId,
                FechaCreacion = ahora,
            };
            Volcar(solicitud, fila);
            db.Espacios.Add(fila);
            await db.SaveChangesAsync(ct);
            await SincronizarAsync(db, fila.Id, solicitud, ct);

            db.AuditLogs.Add(ContratoDeBitacora.Nueva(
                AccionesAuditoria.Crear, "EspacioCreado", actor, "Espacios",
                fila.Id.ToString(CultureInfo.InvariantCulture),
                antes: null, despues: new { estado = fila.EstadoRegistro }, motivo: null,
                OrigenDelCambio.Directo, ahora));
            // DE DONDE VINO EL REGISTRO: la organización que lo registró o, si es una persona, ella misma.
            await ProcedenciaDeRegistro.AnotarAsync(
                db, Modulos.Espacios, fila.Id.ToString(CultureInfo.InvariantCulture),
                ProcedenciaDeRegistro.Externo, organizacionId, actor, ct);
            await db.SaveChangesAsync(ct);

            await transaccion.CommitAsync(ct);
            return fila;
        });

        var tarjetas = await ATarjetasAsync(db, [espacio], ct);
        return Results.Created($"/api/v1/externo/espacios/{espacio.Id}", tarjetas[0]);
    }

    private static async Task<IResult> ObtenerDelResponsable(
        int espacioId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var (espacio, fallo) = await MioAsync(espacioId, principal, db, ct, bastaConEditar: true);
        if (fallo is not null) return fallo;

        var tarjetas = await ATarjetasAsync(db, [espacio!], ct);
        return Results.Ok(tarjetas[0]);
    }

    private static async Task<IResult> GuardarDelResponsable(
        int espacioId,
        EspacioUpsertRequest solicitud,
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

        var (espacio, fallo) = await MioAsync(espacioId, principal, db, ct, bastaConEditar: true);
        if (fallo is not null) return fallo;

        if (!Array.Exists(EditablePorElResponsable, e => e == espacio!.EstadoRegistro))
        {
            return Results.Conflict(new
            {
                message = espacio!.EstadoRegistro == "en_revision"
                    ? "El espacio está en revisión: no se edita hasta que el PNMC decida o lo retires de la revisión."
                    : "Este espacio ya no se edita desde aquí.",
                estado = espacio.EstadoRegistro,
            });
        }

        ArgumentNullException.ThrowIfNull(solicitud);
        var errores = await ValidarAsync(solicitud, db, ct, espacio, espacio!.OrganizacionPrincipalId, espacio.UsuarioResponsableId);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        // LO PUBLICADO NO CAMBIA DE FONDO EN CALIENTE (PROP, decisión 122): la errata se corrige al instante y lo que
        // cambia qué es espacio se PROPONE (`/propuesta`) y lo decide el Programa. Aquí no se escribe nada.
        if (espacio!.EstadoRegistro == "publicado")
        {
            var deFondo = await CamposDeFondoQueCambianAsync(db, espacio, solicitud, ct);
            if (deFondo.Count > 0)
            {
                return Results.Conflict(new
                {
                    motivo = "cambio_de_fondo",
                    message = "Ese cambio no se guarda en caliente sobre lo publicado: propónlo y el PNMC lo revisa.",
                    campos = deFondo,
                    estado = espacio.EstadoRegistro,
                });
            }
        }

        var actor = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;

        var antes = RegistradorDeCambios.Tomar(await ParaElHistorialAsync(db, espacio, ct), CamposDelEspacio.Todos);
        Volcar(solicitud, espacio);
        await SincronizarAsync(db, espacio.Id, solicitud, ct);
        espacio.FechaActualizacion = ahora;
        await db.SaveChangesAsync(ct);

        var despues = await ParaElHistorialAsync(db, espacio, ct);
        var cambiados = await RegistradorDeCambios.RegistrarAsync(
            db,
            new ContextoDeCambio(Modulos.Espacios, espacio.Id.ToString(CultureInfo.InvariantCulture),
                espacio.OrganizacionPrincipalId, actor, espacio.OrganizacionPrincipalId is null ? "Persona" : "Organización", Fecha: ahora),
            CamposDelEspacio.Todos, antes, despues, ct);

        if (cambiados > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        var tarjetas = await ATarjetasAsync(db, [espacio], ct);
        return Results.Ok(tarjetas[0]);
    }

    private static async Task<IResult> EnviarARevision(
        int espacioId,
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

        var (espacio, fallo) = await MioAsync(espacioId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        if (espacio!.EstadoRegistro is not ("borrador" or "ajustes_solicitados"))
        {
            return Results.Conflict(new
            {
                message = "Solo un espacio en borrador o con ajustes solicitados puede enviarse a revisión.",
                estado = espacio.EstadoRegistro,
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var sinConfirmar = espacio.OrganizacionPrincipalId is int organizacion
            ? await AdministracionDeOrganizacion.ExigirCorreoConfirmadoAsync(db, politica, organizacion, "enviar este espacio a revisión", ct)
            : await ExigirCorreoDeLaPersonaAsync(db, politica, persona, "enviar tu espacio a revisión", ct);
        if (sinConfirmar is not null) return sinConfirmar;

        var errores = await ValidarParaRevisionAsync(espacio, db, ct);
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var ahora = DateTime.UtcNow;
        var estadoAnterior = espacio.EstadoRegistro;
        espacio.EstadoRegistro = "en_revision";
        espacio.FechaEnvioARevision = ahora;
        espacio.FechaActualizacion = ahora;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Actualizar, "EspacioEnviadoARevision", persona, "Espacios",
            espacio.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = espacio.EstadoRegistro },
            motivo: null, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Espacios, espacio.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, espacio.EstadoRegistro, null);
        await AvisarAlProgramaAsync(db, espacio, "lo envió a revisión", ahora, ct);
        await db.SaveChangesAsync(ct);

        var tarjetas = await ATarjetasAsync(db, [espacio], ct);
        return Results.Ok(tarjetas[0]);
    }

    /// <summary>Deshacer un envío (vuelve a borrador) o abandonar un borrador (se archiva).</summary>
    private static async Task<IResult> RetirarOAbandonar(
        int espacioId,
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

        var (espacio, fallo) = await MioAsync(espacioId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        var estadoAnterior = espacio!.EstadoRegistro;
        var enRevision = estadoAnterior == "en_revision";
        if (!enRevision && estadoAnterior is not ("borrador" or "ajustes_solicitados"))
        {
            return Results.Conflict(new
            {
                message = "Un espacio publicado se retira del ecosistema con su motivo. Uno rechazado o archivado ya no se toca.",
                estado = estadoAnterior,
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;
        espacio.EstadoRegistro = enRevision ? "borrador" : "archivado";
        espacio.FechaActualizacion = ahora;
        if (!enRevision) espacio.FechaArchivado = ahora;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            enRevision ? AccionesAuditoria.Actualizar : AccionesAuditoria.Archivar,
            enRevision ? "EspacioRetiradoDeRevision" : "EspacioArchivado", persona, "Espacios",
            espacio.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = espacio.EstadoRegistro },
            motivo: null, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Espacios, espacio.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, espacio.EstadoRegistro, null);
        if (enRevision)
        {
            await AvisosDeRevision.MarcarComoResueltosAsync(
                db, Modulos.Espacios, espacio.Id.ToString(CultureInfo.InvariantCulture), "EspacioRecibidoParaRevision", ahora, ct);
        }
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    /// <summary>Retirar del ecosistema un espacio publicado: lo hace su responsable, con motivo.</summary>
    private static async Task<IResult> RetirarPublicado(
        int espacioId,
        RetiroDeEspacio solicitud,
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

        var (espacio, fallo) = await MioAsync(espacioId, principal, db, ct, paraAdministrar: true);
        if (fallo is not null) return fallo;

        if (espacio!.EstadoRegistro != "publicado")
        {
            return Results.Conflict(new
            {
                message = "Solo un espacio publicado se retira del ecosistema desde aquí.",
                estado = espacio.EstadoRegistro,
            });
        }

        var motivo = Texto(solicitud.Motivo, 1200);
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = ["Explica por qué retiras este espacio del ecosistema."],
            });
        }

        var persona = SesionExterna.PersonaDe(principal) ?? 0;
        var ahora = DateTime.UtcNow;
        var estadoAnterior = espacio.EstadoRegistro;
        espacio.EstadoRegistro = "archivado";
        espacio.FechaArchivado = ahora;
        espacio.FechaActualizacion = ahora;
        espacio.MotivoDeLaDecision = motivo;

        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Archivar, "EspacioRetirado", persona, "Espacios",
            espacio.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = espacio.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Espacios, espacio.Id, persona,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, espacio.EstadoRegistro, motivo);
        await ArchivoDeEventosDelProceso.ArchivarAsync(db, ProcesoDelEvento.Espacio, espacio.Id, persona, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var tarjetas = await ATarjetasAsync(db, [espacio], ct);
        return Results.Ok(tarjetas[0]);
    }

    // ═══════════════════════════════ Decisión del Programa ═══════════════════════════════

    private static async Task<IResult> ListarDeLaConsola(
        SimusDbContext db, string? q, string? estado, string? responsable, string? orden, bool? descendente,
        int? pagina, int? tamano, string? sedeDepartamento, string? sedeMunicipio, bool? sedePendiente,
        CancellationToken ct)
    {
        var consulta = db.Espacios.AsNoTracking().Where(t => t.Activo);

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
        return Results.Ok(new PagedResponse<EspacioDto>(lista, porPagina, (actual - 1) * porPagina, total));
    }

    private static async Task<IResult> ObtenerDeLaConsola(int id, SimusDbContext db, CancellationToken ct)
    {
        var fila = await db.Espacios.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (fila is null) return Results.NotFound();

        var lista = await ATarjetasAsync(db, [fila], ct);
        return Results.Ok(lista[0]);
    }

    /// <summary>La decisión del Programa sobre un espacio que llegó a revisión.</summary>
    /// <remarks>
    /// <b>SOLO DESDE «EN REVISION»</b>, salvo rechazar, que también cabe con ajustes pedidos (lo que
    /// nunca se publicó y no va a publicarse se cierra como «rechazado»). Pedir ajustes o rechazar sin
    /// decir por qué no es una decisión: el motivo es obligatorio y viaja al aviso del responsable.
    /// </remarks>
    private static async Task<IResult> Decidir(
        int id, DecisionSobreEspacio decision, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(decision);
        var espacio = await db.Espacios.FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (espacio is null) return Results.NotFound();

        var pedida = EnMinuscula(decision.Decision);
        var motivo = Texto(decision.Motivo, 1200);

        var enRevision = espacio.EstadoRegistro == "en_revision";
        var conAjustes = espacio.EstadoRegistro == "ajustes_solicitados";
        if (!enRevision && !(pedida == "rechazar" && conAjustes))
        {
            return Results.Conflict(new
            {
                message = pedida == "rechazar"
                    ? "Solo se rechaza un espacio en revisión o con ajustes solicitados."
                    : "Solo se decide sobre un espacio que esté en revisión.",
                estado = espacio.EstadoRegistro,
            });
        }

        if (pedida is "ajustes" or "rechazar" && motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = [pedida == "rechazar"
                    ? "Explica por qué se rechaza el espacio: la persona o la organización necesita saberlo."
                    : "Di qué hay que corregir: sin eso el espacio vuelve igual."],
            });
        }

        var ahora = DateTime.UtcNow;
        var estadoAnterior = espacio.EstadoRegistro;
        string evento;
        string verbo;
        switch (pedida)
        {
            case "publicar":
                espacio.EstadoRegistro = "publicado";
                espacio.FechaPublicacion = ahora;
                espacio.MotivoDeLaDecision = null;
                evento = "EspacioPublicado";
                verbo = AccionesAuditoria.Publicar;
                break;
            case "ajustes":
                espacio.EstadoRegistro = "ajustes_solicitados";
                espacio.MotivoDeLaDecision = motivo;
                evento = "EspacioConAjustesSolicitados";
                verbo = AccionesAuditoria.Actualizar;
                break;
            case "rechazar":
                espacio.EstadoRegistro = "rechazado";
                espacio.MotivoDeLaDecision = motivo;
                evento = "EspacioRechazado";
                verbo = AccionesAuditoria.Rechazar;
                break;
            default:
                return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
                {
                    ["decision"] = ["La decisión debe ser «publicar», «ajustes» o «rechazar»."],
                });
        }

        espacio.FechaActualizacion = ahora;
        var actor = ActorDeLaConsola(principal);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            verbo, evento, actor, "Espacios", espacio.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = espacio.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Espacios, espacio.Id, actor ?? 0,
            HistorialDeEstados.AccionDelCambio(estadoAnterior, espacio.EstadoRegistro),
            estadoAnterior, espacio.EstadoRegistro, motivo);
        await AvisosDeRevision.MarcarComoResueltosAsync(
            db, Modulos.Espacios, espacio.Id.ToString(CultureInfo.InvariantCulture), "EspacioRecibidoParaRevision", ahora, ct);
        await AvisarAlResponsableAsync(db, espacio, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var lista = await ATarjetasAsync(db, [espacio], ct);
        return Results.Ok(lista[0]);
    }

    /// <summary>Retirar del ecosistema un espacio ya publicado, con su motivo.</summary>
    private static async Task<IResult> Archivar(
        int id, RetiroDeEspacio solicitud, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var espacio = await db.Espacios.FirstOrDefaultAsync(t => t.Id == id && t.Activo, ct);
        if (espacio is null) return Results.NotFound();

        if (espacio.EstadoRegistro != "publicado")
        {
            return Results.Conflict(new
            {
                message = "Solo un espacio publicado puede retirarse del ecosistema desde aquí.",
                estado = espacio.EstadoRegistro,
            });
        }

        var motivo = Texto(solicitud.Motivo, 1200);
        if (motivo is null)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["motivo"] = ["Explica por qué se retira este espacio del ecosistema."],
            });
        }

        var ahora = DateTime.UtcNow;
        var estadoAnterior = espacio.EstadoRegistro;
        espacio.EstadoRegistro = "archivado";
        espacio.FechaArchivado = ahora;
        espacio.FechaActualizacion = ahora;
        espacio.MotivoDeLaDecision = motivo;

        var actor = ActorDeLaConsola(principal);
        db.AuditLogs.Add(ContratoDeBitacora.Nueva(
            AccionesAuditoria.Archivar, "EspacioArchivado", actor, "Espacios",
            espacio.Id.ToString(CultureInfo.InvariantCulture),
            antes: new { estado = estadoAnterior }, despues: new { estado = espacio.EstadoRegistro },
            motivo, OrigenDelCambio.Directo, ahora));
        HistorialDeEstados.Registrar(db, Modulos.Espacios, espacio.Id, actor ?? 0,
            HistorialDeEstados.AccionEstadoCambiado, estadoAnterior, espacio.EstadoRegistro, motivo);
        await AvisarAlResponsableAsync(db, espacio, motivo, ahora, ct);
        await ArchivoDeEventosDelProceso.ArchivarAsync(db, ProcesoDelEvento.Espacio, espacio.Id, actor, motivo, ahora, ct);
        await db.SaveChangesAsync(ct);

        var lista = await ATarjetasAsync(db, [espacio], ct);
        return Results.Ok(lista[0]);
    }

    // ═══════════════════════════════════ Guardas y reglas ═══════════════════════════════════

    /// <summary>
    /// El espacio que esta persona puede tocar, o el resultado que lo impide.
    /// </summary>
    /// <remarks>
    /// <b>LA GUARDA ES DEL RESPONSABLE DE ESE TALLER.</b> Si es una organización, se comprueba el rol
    /// de la persona en ella (editar basta para preparar; enviar y retirar piden administrar). Si es
    /// una persona, solo ella. Un espacio ajeno responde 404, no 403: no se confirma que exista.
    /// </remarks>
    private static async Task<(EspacioRow? Espacio, IResult? Fallo)> MioAsync(
        int espacioId, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct,
        bool bastaConEditar = false, bool paraAdministrar = false)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return (null, Results.Unauthorized());

        var espacio = await db.Espacios.FirstOrDefaultAsync(t => t.Id == espacioId && t.Activo, ct);
        if (espacio is null) return (null, Results.NotFound());

        if (espacio.OrganizacionPrincipalId is int organizacion)
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
        else if (espacio.UsuarioResponsableId != persona.Value)
        {
            return (null, Results.NotFound());
        }

        return (espacio, null);
    }

    /// <summary>La puerta del correo confirmado, para quien responde por un espacio sin organización.</summary>
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
        EspacioUpsertRequest peticion, SimusDbContext db, CancellationToken ct,
        EspacioRow? actual = null, int? organizacionId = null, int? personaId = null)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (await FotoDeProceso.ValidarAsync(db, peticion.ArchivoFotoId, actual?.ArchivoFotoId, organizacionId, personaId, ct) is { } errorDeFoto)
        {
            errores["archivoFotoId"] = errorDeFoto;
        }

        if (string.IsNullOrWhiteSpace(peticion.Nombre)) errores["nombre"] = ["Escribe el nombre del espacio."];

        var ambiente = EnMinuscula(peticion.Ambiente);
        if (!Array.Exists(Ambientes, m => m == ambiente))
        {
            errores["ambiente"] = ["Elige si el espacio es cerrado, al aire libre o mixto."];
        }

        // LA REGLA ÚNICA DE DIRECCIÓN Y DE TELÉFONO, la misma que el Festival y el Mercado.
        foreach (var (clave, valor) in new[] { ("sitioWebEspacio", peticion.SitioWebEspacio), ("otroEnlaceEspacio", peticion.OtroEnlaceEspacio) })
        {
            if (!ValidationHelpers.IsValidHttpsUrl(valor)) errores[clave] = [ValidationHelpers.MensajeDeUrl];
        }
        foreach (var (clave, valor) in new[] { ("instagramEspacio", peticion.InstagramEspacio), ("facebookEspacio", peticion.FacebookEspacio) })
        {
            if (!ValidationHelpers.IsValidSocialLink(valor)) errores[clave] = [ValidationHelpers.MensajeDeRedSocial];
        }
        if (!ValidationHelpers.IsValidPhone(peticion.TelefonoEspacio)) errores["telefonoEspacio"] = [ValidationHelpers.MensajeDeTelefono];
        if (!string.IsNullOrWhiteSpace(peticion.CorreoEspacio) && !ValidationHelpers.IsValidEmail(peticion.CorreoEspacio))
        {
            errores["correoEspacio"] = ["Escribe un correo válido, por ejemplo espacio@correo.co."];
        }

        if (peticion.AforoMaximo is int aforo && (aforo < 1 || aforo > 200000))
        {
            errores["aforoMaximo"] = ["Escribe cuántas personas caben, entre 1 y 200.000, o deja el aforo en blanco."];
        }

        var nivel = EnMinuscula(peticion.NivelCobertura);
        var departamento = Opcional(peticion.CodigoDepartamento);
        var municipio = Opcional(peticion.CodigoMunicipio);
        if (!Array.Exists(NivelesDeCobertura, n => n == nivel))
        {
            errores["nivelCobertura"] = ["Elige el municipio donde está el espacio."];
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

        var equipamiento = (peticion.EquipamientoIds ?? []).Distinct().ToList();
        if (equipamiento.Count > 0
            && await db.EquipamientoDeEspacio.AsNoTracking().CountAsync(x => equipamiento.Contains(x.Id) && x.Activo, ct) != equipamiento.Count)
        {
            errores["equipamientoIds"] = ["Algún elemento de equipamiento no existe en el catálogo."];
        }
        var tipos = (peticion.TiposIds ?? []).Distinct().ToList();
        if (tipos.Count > 0
            && await db.TiposDeEspacio.AsNoTracking().CountAsync(x => tipos.Contains(x.Id) && x.Activo, ct) != tipos.Count)
        {
            errores["tiposIds"] = ["Algún tipo de espacio no existe en el catálogo."];
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

    /// <summary>Lo que hace falta para enviar un espacio a revisión, en el idioma de quien lo diligencia.</summary>
    private static async Task<Dictionary<string, string[]>> ValidarParaRevisionAsync(
        EspacioRow espacio, SimusDbContext db, CancellationToken ct)
    {
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(espacio.Descripcion))
        {
            errores["descripcion"] = ["Para enviarlo falta una descripción: cuenta cómo es el espacio y qué música se presenta."];
        }
        // EL EQUIPAMIENTO ES OPCIONAL: no todos los lugares lo tienen ni lo saben decir. El tipo no.
        if (!await db.EspaciosTipos.AsNoTracking().AnyAsync(x => x.EspacioId == espacio.Id, ct))
        {
            errores["tiposIds"] = ["Para enviarlo falta elegir al menos un tipo de espacio."];
        }
        if (string.IsNullOrWhiteSpace(espacio.LugarEspecifico))
        {
            errores["lugarEspecifico"] = ["Para enviarlo falta la dirección o una referencia del lugar."];
        }
        var tieneContacto = new[]
        {
            espacio.CorreoEspacio, espacio.TelefonoEspacio, espacio.SitioWebEspacio,
            espacio.InstagramEspacio, espacio.FacebookEspacio, espacio.OtroEnlaceEspacio,
        }.Any(valor => !string.IsNullOrWhiteSpace(valor));
        if (!tieneContacto)
        {
            errores["correoEspacio"] = ["Para enviarlo falta una forma de contacto: un correo, un teléfono, un sitio o una red."];
        }

        await SedePrincipal.ValidarParaRevisionAsync(errores, db, espacio, ct);

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
    /// propuesta de cambio y no se escribe en caliente (<see cref="EspacioConPropuestas"/>).
    /// </summary>
    internal static async Task<List<string>> CamposDeFondoQueCambianAsync(
        SimusDbContext db, EspacioRow actual, EspacioUpsertRequest solicitud, CancellationToken ct)
    {
        var nuevo = new EspacioRow();
        Volcar(solicitud, nuevo);
        var cambian = new List<string>();
        if (ProcesoConPropuestas.Difiere(actual.Nombre, nuevo.Nombre)) cambian.Add("nombre");
        if (ProcesoConPropuestas.Difiere(actual.Ambiente, nuevo.Ambiente)) cambian.Add("ambiente");
        if (ProcesoConPropuestas.Difiere(actual.NivelCobertura, nuevo.NivelCobertura)) cambian.Add("nivelCobertura");
        if (ProcesoConPropuestas.Difiere(actual.CodigoDepartamento, nuevo.CodigoDepartamento)) cambian.Add("codigoDepartamento");
        if (ProcesoConPropuestas.Difiere(actual.CodigoMunicipio, nuevo.CodigoMunicipio)) cambian.Add("codigoMunicipio");
        if (ProcesoConPropuestas.Difiere(actual.LugarEspecifico, nuevo.LugarEspecifico)) cambian.Add("lugarEspecifico");
        if (!(await db.EspaciosTipos.AsNoTracking().Where(x => x.EspacioId == actual.Id).Select(x => x.TipoEspacioId).ToListAsync(ct)).ToHashSet().SetEquals(solicitud.TiposIds ?? []))
        {
            cambian.Add("tipos");
        }
        return cambian;
    }

    // ═══════════════════════════════════ Traducción ═══════════════════════════════════

    internal static void Volcar(EspacioUpsertRequest solicitud, EspacioRow fila)
    {
        fila.Nombre = Texto(solicitud.Nombre, 240) ?? string.Empty;
        fila.Descripcion = Texto(solicitud.Descripcion, 4000);
        fila.Ambiente = EnMinuscula(solicitud.Ambiente ?? "cerrado");
        fila.AforoMaximo = solicitud.AforoMaximo;
        fila.EsAccesible = solicitud.EsAccesible;
        fila.HorarioYProgramacion = Texto(solicitud.HorarioYProgramacion, 2000);
        fila.CorreoEspacio = Texto(solicitud.CorreoEspacio, 180);
        fila.TelefonoEspacio = Texto(solicitud.TelefonoEspacio, 80);
        fila.SitioWebEspacio = ValidationHelpers.NormalizeHttpsUrl(Opcional(solicitud.SitioWebEspacio));
        fila.InstagramEspacio = ValidationHelpers.NormalizeSocialLink(Opcional(solicitud.InstagramEspacio));
        fila.FacebookEspacio = ValidationHelpers.NormalizeSocialLink(Opcional(solicitud.FacebookEspacio));
        fila.OtroEnlaceEspacio = ValidationHelpers.NormalizeHttpsUrl(Opcional(solicitud.OtroEnlaceEspacio));
        fila.NivelCobertura = EnMinuscula(solicitud.NivelCobertura);
        fila.CodigoDepartamento = Opcional(solicitud.CodigoDepartamento);
        fila.CodigoMunicipio = Opcional(solicitud.CodigoMunicipio);
        SedePrincipal.Aplicar(fila, solicitud.SedeCodigoDepartamento, solicitud.SedeCodigoMunicipio, fila.NivelCobertura, fila.CodigoDepartamento, fila.CodigoMunicipio);
        fila.LugarEspecifico = Texto(solicitud.LugarEspecifico, 300);
        fila.ArchivoFotoId = solicitud.ArchivoFotoId;
    }

    /// <summary>Deja los equipamiento, las tipos y las prácticas del espacio exactamente como los pide la petición.</summary>
    internal static async Task SincronizarAsync(
        SimusDbContext db, int espacioId, EspacioUpsertRequest solicitud, CancellationToken ct)
    {
        var equipamiento = (solicitud.EquipamientoIds ?? []).Distinct().ToHashSet();
        var actuales = await db.EspaciosEquipamiento.Where(x => x.EspacioId == espacioId).ToListAsync(ct);
        db.EspaciosEquipamiento.RemoveRange(actuales.Where(x => !equipamiento.Contains(x.EquipamientoEspacioId)));
        foreach (var id in equipamiento.Where(id => actuales.All(x => x.EquipamientoEspacioId != id)))
        {
            db.EspaciosEquipamiento.Add(new EspacioEquipamientoRow { EspacioId = espacioId, EquipamientoEspacioId = id, FechaCreacion = DateTime.UtcNow });
        }

        var tipos = (solicitud.TiposIds ?? []).Distinct().ToHashSet();
        var tiposActuales = await db.EspaciosTipos.Where(x => x.EspacioId == espacioId).ToListAsync(ct);
        db.EspaciosTipos.RemoveRange(tiposActuales.Where(x => !tipos.Contains(x.TipoEspacioId)));
        foreach (var id in tipos.Where(id => tiposActuales.All(x => x.TipoEspacioId != id)))
        {
            db.EspaciosTipos.Add(new EspacioTipoRow { EspacioId = espacioId, TipoEspacioId = id, FechaCreacion = DateTime.UtcNow });
        }

        var practicas = (solicitud.PracticasMusicalesIds ?? []).Distinct().ToHashSet();
        var practicasActuales = await db.EspaciosPracticasMusicales.Where(x => x.EspacioId == espacioId).ToListAsync(ct);
        db.EspaciosPracticasMusicales.RemoveRange(practicasActuales.Where(x => !practicas.Contains(x.PracticaMusicalId)));
        foreach (var id in practicas.Where(id => practicasActuales.All(x => x.PracticaMusicalId != id)))
        {
            db.EspaciosPracticasMusicales.Add(new EspacioPracticaMusicalRow { EspacioId = espacioId, PracticaMusicalId = id, FechaCreacion = DateTime.UtcNow });
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>El espacio con sus dos listados como texto, para compararlo en el historial.</summary>
    internal static async Task<EspacioParaElHistorial> ParaElHistorialAsync(
        SimusDbContext db, EspacioRow espacio, CancellationToken ct)
    {
        var equipamiento = await db.EspaciosEquipamiento.AsNoTracking()
            .Where(x => x.EspacioId == espacio.Id)
            .Join(db.EquipamientoDeEspacio.AsNoTracking(), x => x.EquipamientoEspacioId, s => s.Id, (_, s) => s.Nombre)
            .ToListAsync(ct);
        var tipos = await db.EspaciosTipos.AsNoTracking()
            .Where(x => x.EspacioId == espacio.Id)
            .Join(db.TiposDeEspacio.AsNoTracking(), x => x.TipoEspacioId, f => f.Id, (_, f) => f.Nombre)
            .ToListAsync(ct);
        return new EspacioParaElHistorial(
            espacio,
            string.Join(", ", equipamiento.OrderBy(x => x, StringComparer.Ordinal)),
            string.Join(", ", tipos.OrderBy(x => x, StringComparer.Ordinal)));
    }

    internal static async Task<List<EspacioDto>> ATarjetasAsync(
        SimusDbContext db, List<EspacioRow> filas, CancellationToken ct)
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

        var equipamientoPorEspacio = (await db.EspaciosEquipamiento.AsNoTracking()
                .Where(x => ids.Contains(x.EspacioId))
                .Join(db.EquipamientoDeEspacio.AsNoTracking(), x => x.EquipamientoEspacioId, s => s.Id,
                    (x, s) => new { x.EspacioId, s.Id, s.Nombre, s.Slug, s.EstadoAprobacion, s.OrdenVisualizacion })
                .ToListAsync(ct))
            .GroupBy(x => x.EspacioId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<OpcionDeEspacioDto>)g
                .OrderBy(x => x.OrdenVisualizacion).ThenBy(x => x.Nombre)
                .Select(x => new OpcionDeEspacioDto(x.Id, x.Nombre, x.Slug, x.EstadoAprobacion)).ToList());
        var tiposPorEspacio = (await db.EspaciosTipos.AsNoTracking()
                .Where(x => ids.Contains(x.EspacioId))
                .Join(db.TiposDeEspacio.AsNoTracking(), x => x.TipoEspacioId, f => f.Id,
                    (x, f) => new { x.EspacioId, f.Id, f.Nombre, f.Slug, f.EstadoAprobacion, f.OrdenVisualizacion })
                .ToListAsync(ct))
            .GroupBy(x => x.EspacioId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<OpcionDeEspacioDto>)g
                .OrderBy(x => x.OrdenVisualizacion).ThenBy(x => x.Nombre)
                .Select(x => new OpcionDeEspacioDto(x.Id, x.Nombre, x.Slug, x.EstadoAprobacion)).ToList());
        var practicasPorEspacio = (await db.EspaciosPracticasMusicales.AsNoTracking()
                .Where(x => ids.Contains(x.EspacioId))
                .Join(db.PracticasMusicales.AsNoTracking(), x => x.PracticaMusicalId, p => p.Id,
                    (x, p) => new { x.EspacioId, p.Id, p.Nombre, p.Orden })
                .ToListAsync(ct))
            .GroupBy(x => x.EspacioId)
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
        var tarjetas = new List<EspacioDto>(filas.Count);
        foreach (var f in filas)
        {
            var departamento = f.CodigoDepartamento is null
                ? null
                : territorios.Find(t => t.DepartmentCode == f.CodigoDepartamento)?.DepartmentName;
            var municipio = f.CodigoMunicipio is null
                ? null
                : territorios.Find(t => t.DepartmentCode == f.CodigoDepartamento && t.MunicipalityCode == f.CodigoMunicipio)?.MunicipalityName;

            tarjetas.Add(new EspacioDto(
                f.Id, f.Nombre, f.Descripcion, f.Ambiente, f.AforoMaximo, f.EsAccesible, f.HorarioYProgramacion,
                f.CorreoEspacio, f.TelefonoEspacio, f.SitioWebEspacio, f.InstagramEspacio, f.FacebookEspacio, f.OtroEnlaceEspacio,
                f.NivelCobertura, f.CodigoDepartamento, departamento, f.CodigoMunicipio, municipio, f.LugarEspecifico,
                f.OrganizacionPrincipalId,
                f.OrganizacionPrincipalId is int o && organizaciones.TryGetValue(o, out var nombreOrganizacion) ? nombreOrganizacion : null,
                f.UsuarioResponsableId,
                f.UsuarioResponsableId is int p && personas.TryGetValue(p, out var nombrePersona) ? nombrePersona : null,
                f.EstadoRegistro, f.MotivoDeLaDecision,
                equipamientoPorEspacio.GetValueOrDefault(f.Id) ?? [],
                tiposPorEspacio.GetValueOrDefault(f.Id) ?? [],
                practicasPorEspacio.GetValueOrDefault(f.Id) ?? [],
                f.FechaCreacion, f.FechaActualizacion, f.FechaEnvioARevision, f.FechaPublicacion,
                f.ArchivoFotoId, FotoDeProceso.Url(f.ArchivoFotoId),
                f.ArchivoFotoId is int fotoConTexto ? textosDeFoto.GetValueOrDefault(fotoConTexto) : null,
                sedeDe(f)));
        }
        return tarjetas;
    }

    /// <summary>Lo que el portal puede enseñar: la lista expresa de campos permitidos.</summary>
    internal static async Task<List<EspacioPublicoDto>> APublicosAsync(
        SimusDbContext db, IReadOnlyList<EspacioDto> espacios, CancellationToken ct)
    {
        var conFicha = await PerfilPublicoEndpoints.OrganizacionesConFichaAsync(
            db, espacios.Where(t => t.OrganizacionId is not null).Select(t => t.OrganizacionId!.Value), ct);
        var institucional = await ReclamacionesAdministracionEndpoints.IdInstitucionalAsync(db, ct);
        return espacios.Select(t =>
        {
            var lugar = SedePrincipal.ParaMostrar(t.Sede, t.CodigoDepartamento, t.NombreDepartamento, t.CodigoMunicipio, t.NombreMunicipio);
            return new EspacioPublicoDto(
            t.Id, t.Nombre, t.Descripcion, t.Ambiente, t.AforoMaximo, t.EsAccesible, t.HorarioYProgramacion,
            t.CorreoEspacio, t.TelefonoEspacio, t.SitioWebEspacio, t.InstagramEspacio, t.FacebookEspacio, t.OtroEnlaceEspacio,
            t.NivelCobertura,
            lugar.CodigoDepartamento, lugar.NombreDepartamento, lugar.CodigoMunicipio, lugar.NombreMunicipio,
            t.LugarEspecifico,
            EsIndependiente: t.OrganizacionId is null,
            OrganizacionNombre: t.OrganizacionNombre,
            OrganizacionPublicaId: t.OrganizacionId is int o && conFicha.Contains(o) ? o : null,
            t.FechaPublicacion, t.Equipamiento, t.Tipos, t.PracticasMusicales,
            t.FotoUrl, t.FotoAlt, t.Sede,
            EsRegistroHistorico: institucional is not null && t.OrganizacionId == institucional);
        }).ToList();
    }

    // ═══════════════════════════════════════ Avisos ═══════════════════════════════════════

    private static async Task AvisarAlProgramaAsync(
        SimusDbContext db, EspacioRow espacio, string queHizo, DateTime ahora, CancellationToken ct)
    {
        var responsable = espacio.OrganizacionPrincipalId is int organizacion
            ? await db.EntityProfiles.AsNoTracking().Where(e => e.Id == organizacion).Select(e => e.Name).FirstOrDefaultAsync(ct)
            : await db.Users.AsNoTracking().Where(u => u.Id == espacio.UsuarioResponsableId).Select(u => u.FullName).FirstOrDefaultAsync(ct);
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
                EventType = "EspacioRecibidoParaRevision",
                AccessScope = SimusAuthentication.InstitutionalScope,
                Channel = "internal",
                Title = "Espacio pendiente de revisión",
                Body = $"{responsable} {queHizo}: el espacio para música en vivo «{espacio.Nombre}».",
                Status = "enviada",
                ModuloId = Modulos.Espacios,
                RecordId = espacio.Id.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });
        }
    }

    private static async Task AvisarAlResponsableAsync(
        SimusDbContext db, EspacioRow espacio, string? motivo, DateTime ahora, CancellationToken ct)
    {
        var (evento, titulo, cuerpo) = espacio.EstadoRegistro switch
        {
            "publicado" => (
                "EspacioPublicado",
                "Espacio publicado",
                $"El espacio para música en vivo «{espacio.Nombre}» quedó publicado en el ecosistema."),
            "rechazado" => (
                "EspacioRechazado",
                "Espacio rechazado",
                $"El PNMC rechazó el espacio para música en vivo «{espacio.Nombre}». Motivo: {motivo}"),
            "archivado" => (
                "EspacioArchivado",
                "Espacio retirado del ecosistema",
                $"El espacio para música en vivo «{espacio.Nombre}» fue retirado del ecosistema. {motivo}"),
            _ => (
                "EspacioConAjustesSolicitados",
                "Ajustes solicitados en tu espacio",
                $"El PNMC pidió ajustes en el espacio para música en vivo «{espacio.Nombre}». {motivo}"),
        };

        var personas = espacio.OrganizacionPrincipalId is int organizacion
            ? await db.UserEntities.AsNoTracking()
                .Where(ue => ue.EntityId == organizacion && ue.IsActive)
                .Join(db.Users.AsNoTracking().Where(u => u.IsActive),
                    relacion => relacion.UserId, usuario => usuario.Id,
                    (_, usuario) => new { usuario.Id, usuario.Email })
                .ToListAsync(ct)
            : await db.Users.AsNoTracking()
                .Where(u => u.Id == espacio.UsuarioResponsableId && u.IsActive)
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
                ModuloId = Modulos.Espacios,
                RecordId = espacio.Id.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });
        }
    }

    // ═══════════════════════════════════════ Utilidades ═══════════════════════════════════════

    private static string? Opcional(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    /// <summary>Un código de lista en minúsculas y sin espacios: ambiente, nivel, estado, decisión.</summary>
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
