using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La propuesta de cambio sobre un proceso YA PUBLICADO: el mismo circuito para Mercado, Taller de lutería, Espacio
/// y Red (PROP, decisión 122 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUE NO SE EDITA Y YA.</b> Lo que ve el público no puede cambiar porque alguien abrió un formulario. Entre la
/// intención de quien responde por el proceso y la ficha publicada tiene que haber una decisión del Programa: eso es
/// todo lo que hace este circuito. La errata (la ortografía, un teléfono, una foto) sigue editándose directamente en
/// el propio proceso; lo que cambia <i>qué es</i> el proceso viaja por aquí.
/// </para>
/// <para>
/// <b>EL BORRADOR ES DE QUIEN RESPONDE.</b> Puede guardarlo tantas veces como quiera y abandonarlo; nadie del Programa
/// lo ve hasta que se envía.
/// </para>
/// <para>
/// <b>EL VALOR ANTERIOR SE COPIA AL ENVIAR</b>, no antes ni después: antes, el registro todavía podía cambiar por otra
/// vía; después, aplicar la propuesta haría que la comparación dijera que no cambió nada, porque el «antes» ya sería el
/// «después».
/// </para>
/// <para>
/// <b>QUIEN RESPONDE PUEDE SER UNA ORGANIZACION O UNA PERSONA</b> (un lutier independiente). Una organización se
/// comprueba por su rol en ella; una persona, por ser el responsable del registro. Quien no pertenece recibe 404 si es
/// una persona, y 403 si es una organización de la que no es parte, como en los demás procesos.
/// </para>
/// </remarks>
public static class PropuestasDeCambioDeProcesoEndpoints
{
    private const string Publicado = "publicado";

    /// <summary>Los tipos que admiten propuestas. Añadir uno es escribir su clase y listarlo aquí.</summary>
    internal static readonly IReadOnlyList<ProcesoConPropuestas> Procesos =
    [
        new MercadoConPropuestas(),
        new TallerConPropuestas(),
        new EspacioConPropuestas(),
        new RedConPropuestas(),
    ];

    /// <summary>
    /// El tipo de un módulo («talleres»…), o <c>null</c>. NO incluye el Festival: <see cref="FestivalConPropuestas"/> comparte el
    /// catálogo de campos y la escritura, pero sus rutas y sus textos son los suyos y no se mapean desde aquí.
    /// </summary>
    internal static ProcesoConPropuestas? DelModulo(string? modulo) =>
        Procesos.FirstOrDefault(p => string.Equals(p.Modulo, modulo, StringComparison.Ordinal));

    public static RouteGroupBuilder MapPropuestasDeCambioDeProcesoEndpoints(this RouteGroupBuilder group)
    {
        foreach (var proceso in Procesos)
        {
            MapearLoExterno(group, proceso);
            MapearLoInstitucional(group, proceso);
        }

        return group;
    }

    // ── Lo que quien responde propone ───────────────────────────────────────────────────────────
    private static void MapearLoExterno(RouteGroupBuilder group, ProcesoConPropuestas proceso)
    {
        var externo = group.MapGroup($"/externo/{proceso.Ruta}")
            .WithTags($"propuestas-de-cambio-de-{proceso.Ruta}")
            .RequireAuthorization(SimusAuthentication.ExternalPolicy);

        externo.MapGet("/{id:int}/propuesta", async (
            int id, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct) =>
        {
            var (registro, fallo) = await DelResponsableAsync(proceso, id, principal, db, ct, bastaConEditar: true);
            if (fallo is not null) return fallo;

            var propuesta = await PropuestaVivaAsync(proceso, db, id, seguimiento: false, ct);
            return Results.Ok(await ADtoAsync(proceso, db, registro!, propuesta, ct));
        }).WithName($"PropuestaDeCambioDeMi{proceso.Etiqueta}");

        externo.MapPut("/{id:int}/propuesta", async (
            int id,
            GuardarPropuestaDeCambioSolicitud solicitud,
            ClaimsPrincipal principal,
            SimusDbContext db,
            IAntiforgery antiforgery,
            HttpContext contexto,
            CancellationToken ct) =>
        {
            ArgumentNullException.ThrowIfNull(solicitud);
            if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
            {
                return Results.BadRequest(new { message = "La propuesta no pudo validarse. Actualiza la página e inténtalo nuevamente." });
            }

            var (registro, fallo) = await DelResponsableAsync(proceso, id, principal, db, ct);
            if (fallo is not null) return fallo;

            // SOLO SOBRE LO PUBLICADO. Lo que está en borrador o en revisión se edita directamente;
            // proponer un cambio sobre ello sería un circuito de más para llegar al mismo sitio.
            if (registro!.Estado != Publicado)
            {
                return Results.Conflict(new
                {
                    message = $"Solo se proponen cambios sobre {proceso.UnoPublicado}. {proceso.EsteGenero} todavía puedes editar{(proceso.Femenino ? "la" : "lo")} directamente.",
                    estado = registro.Estado,
                });
            }

            var (campos, errores) = Normalizar(proceso, solicitud.Campos);
            if (errores.Count > 0) return Results.ValidationProblem(errores);

            var ahora = DateTime.UtcNow;
            var propuesta = await PropuestaVivaAsync(proceso, db, id, seguimiento: true, ct);
            if (propuesta is null)
            {
                propuesta = await AbrirPropuestaAsync(proceso, db, registro, Actor(principal), ahora, ct);
            }
            else if (propuesta.Estado == EstadosDePropuesta.EnRevision)
            {
                // MIENTRAS EL PROGRAMA LA MIRA, NO SE TOCA. Cambiarla por debajo haría que la
                // decisión se tomara sobre algo distinto de lo que se leyó.
                return Results.Conflict(new { message = "La propuesta está en revisión: no puede modificarse hasta que el PNMC decida.", estado = propuesta.Estado });
            }

            propuesta.Motivo = LimpiarTexto(solicitud.Motivo, 2400);
            propuesta.FechaActualizacion = ahora;
            await ReemplazarCamposAsync(proceso, db, propuesta, campos, ahora, ct);
            await db.SaveChangesAsync(ct);

            return Results.Ok(await ADtoAsync(proceso, db, registro, propuesta, ct));
        }).WithName($"GuardarPropuestaDeCambioDeMi{proceso.Etiqueta}");

        externo.MapPost("/{id:int}/propuesta/enviar", async (
            int id,
            ClaimsPrincipal principal,
            SimusDbContext db,
            IAntiforgery antiforgery,
            HttpContext contexto,
            CancellationToken ct) =>
        {
            if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
            {
                return Results.BadRequest(new { message = "El envío no pudo validarse. Actualiza la página e inténtalo nuevamente." });
            }

            var (registro, fallo) = await DelResponsableAsync(proceso, id, principal, db, ct);
            if (fallo is not null) return fallo;

            var propuesta = await PropuestaVivaAsync(proceso, db, id, seguimiento: true, ct);
            if (propuesta is null) return Results.NotFound();
            if (propuesta.Estado == EstadosDePropuesta.EnRevision)
            {
                return Results.Conflict(new { message = "Esta propuesta ya está esperando una decisión del PNMC.", estado = propuesta.Estado });
            }

            var campos = await db.PropuestasDeCambioCampos
                .Where(c => c.IdPropuesta == propuesta.Id).ToListAsync(ct);
            if (campos.Count == 0)
            {
                return Results.Conflict(new { message = "La propuesta no cambia ningún campo. Indica al menos uno antes de enviarla." });
            }

            var ahora = DateTime.UtcNow;

            // AQUI SE CONGELA EL «ANTES». Es el momento en que el Programa se compromete a mirar
            // esto, y contra esto es contra lo que se compara.
            foreach (var campo in campos)
            {
                campo.ValorAnterior = await proceso.ValorActualAsync(db, id, campo.CampoId, ct);
                campo.FechaActualizacion = ahora;
            }

            propuesta.Estado = EstadosDePropuesta.EnRevision;
            propuesta.FechaEnvio = ahora;
            propuesta.FechaActualizacion = ahora;
            proceso.Auditar(db, Actor(principal), id, $"{proceso.Etiqueta}CambioPropuesto",
                antes: null, despues: new { propuesta = propuesta.Id, campos = campos.Count }, motivo: propuesta.Motivo);
            await db.SaveChangesAsync(ct);

            return Results.Ok(await ADtoAsync(proceso, db, registro!, propuesta, ct));
        }).WithName($"EnviarPropuestaDeCambioDeMi{proceso.Etiqueta}");

        externo.MapDelete("/{id:int}/propuesta", async (
            int id,
            ClaimsPrincipal principal,
            SimusDbContext db,
            IAntiforgery antiforgery,
            HttpContext contexto,
            CancellationToken ct) =>
        {
            if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto))
            {
                return Results.BadRequest(new { message = "La operación no pudo validarse. Actualiza la página e inténtalo nuevamente." });
            }

            var (_, fallo) = await DelResponsableAsync(proceso, id, principal, db, ct);
            if (fallo is not null) return fallo;

            var propuesta = await PropuestaVivaAsync(proceso, db, id, seguimiento: true, ct);
            if (propuesta is null) return Results.NoContent();
            // ABANDONAR UN BORRADOR SI; RETIRAR ALGO QUE EL PROGRAMA YA TIENE DELANTE, NO. Para eso
            // está la decisión, que deja constancia de qué se pidió y qué se contestó.
            if (propuesta.Estado == EstadosDePropuesta.EnRevision)
            {
                return Results.Conflict(new { message = "La propuesta está en revisión y ya no puede abandonarse.", estado = propuesta.Estado });
            }

            // LOS CAMPOS PRIMERO, PORQUE NO HAY CASCADA. La base no borra hijos por su cuenta en
            // ninguna tabla de SIMUS, así que el orden es parte de la operación y se ve aquí.
            var campos = await db.PropuestasDeCambioCampos.Where(c => c.IdPropuesta == propuesta.Id).ToListAsync(ct);
            db.PropuestasDeCambioCampos.RemoveRange(campos);
            db.PropuestasDeCambio.Remove(propuesta);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).WithName($"AbandonarPropuestaDeCambioDeMi{proceso.Etiqueta}");
    }

    // ── Lo que el Programa lee y decide ─────────────────────────────────────────────────────────
    private static void MapearLoInstitucional(RouteGroupBuilder group, ProcesoConPropuestas proceso)
    {
        var institucional = group.MapGroup($"/institucional/{proceso.Ruta}")
            .WithTags($"propuestas-de-cambio-de-{proceso.Ruta}")
            .RequireAuthorization(Permisos.PoliticaFuncionario)
            .ExigeModulo(proceso.Ruta);

        // EL TESTIGO, EN EL MISMO GRUPO QUE LA DECISION: quien va a decidir pide su testigo aquí y lo
        // manda en la cabecera.
        institucional.MapGet("/propuestas/csrf", (IAntiforgery antiforgery, HttpContext contexto) =>
        {
            var testigos = antiforgery.GetAndStoreTokens(contexto);
            return Results.Ok(new { requestToken = testigos.RequestToken ?? string.Empty });
        }).WithName($"TestigoDePropuestasDe{proceso.Etiqueta}");

        institucional.MapGet("/propuestas/en-revision", async (SimusDbContext db, CancellationToken ct) =>
        {
            var propuestas = await db.PropuestasDeCambio.AsNoTracking()
                .Where(p => p.ModuloId == proceso.Modulo && p.Estado == EstadosDePropuesta.EnRevision)
                .OrderBy(p => p.FechaEnvio)
                .ToListAsync(ct);

            var cuantos = await db.PropuestasDeCambioCampos.AsNoTracking()
                .Where(c => propuestas.Select(p => p.Id).Contains(c.IdPropuesta))
                .GroupBy(c => c.IdPropuesta)
                .Select(g => new { Id = g.Key, Total = g.Count() })
                .ToDictionaryAsync(x => x.Id, x => x.Total, ct);

            var ids = propuestas
                .Select(p => int.TryParse(p.RegistroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) ? id : 0)
                .Where(id => id > 0).Distinct().ToList();
            var nombres = await proceso.NombresAsync(db, ids, ct);

            return Results.Ok(propuestas.Select(p => new PropuestaEnRevisionDto(
                p.Id, p.ModuloId, p.RegistroId,
                int.TryParse(p.RegistroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) && nombres.TryGetValue(id, out var nombre)
                    ? nombre
                    : $"{proceso.SinNombre} {p.RegistroId}",
                p.OrganizacionNombre, p.ProponenteNombre, p.Motivo,
                cuantos.TryGetValue(p.Id, out var total) ? total : 0,
                p.FechaEnvio)).ToArray());
        }).WithName($"Propuestas{(proceso.Etiqueta == "Mercado" ? "DeMercado" : "De" + proceso.Etiqueta)}EnRevision");

        institucional.MapGet("/{id:int}/propuesta", async (int id, SimusDbContext db, CancellationToken ct) =>
        {
            var registro = await proceso.BuscarAsync(db, id, ct);
            if (registro is null) return Results.NotFound();

            var propuesta = await PropuestaVivaAsync(proceso, db, id, seguimiento: false, ct);
            // SOLO LO ENVIADO. El borrador es de quien responde mientras lo escribe: enseñarlo aquí
            // sería leer por encima del hombro algo que todavía nadie ha querido mandar. Se devuelve
            // la carcasa vacía y no un 404, por lo mismo que en la revisión por campos.
            if (propuesta is not null && propuesta.Estado == EstadosDePropuesta.Borrador)
            {
                propuesta = null;
            }

            return Results.Ok(await ADtoAsync(proceso, db, registro, propuesta, ct));
        }).WithName($"PropuestaDeCambioDe{proceso.Etiqueta}");

        institucional.MapPost("/propuestas/{propuestaId:long}/decision", async (
            long propuestaId,
            DecidirPropuestaDeCambioSolicitud solicitud,
            ClaimsPrincipal principal,
            SimusDbContext db,
            IAntiforgery antiforgery,
            HttpContext contexto,
            CancellationToken ct) =>
        {
            ArgumentNullException.ThrowIfNull(solicitud);
            if (!await TestigoDePeticion.ValidoAsync(antiforgery, contexto))
            {
                return Results.BadRequest(new { message = "La decisión no pudo validarse. Actualiza la página e inténtalo nuevamente." });
            }

            var propuesta = await db.PropuestasDeCambio
                .FirstOrDefaultAsync(p => p.Id == propuestaId && p.ModuloId == proceso.Modulo, ct);
            if (propuesta is null) return Results.NotFound();
            if (propuesta.Estado != EstadosDePropuesta.EnRevision)
            {
                return Results.Conflict(new { message = "Solo una propuesta en revisión puede recibir una decisión.", estado = propuesta.Estado });
            }

            var decision = (solicitud.Decision ?? string.Empty).Trim();
            var motivo = LimpiarTexto(solicitud.Motivo, 2400);
            if (decision is not ("aplicar" or "pedir_ajustes" or "rechazar"))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["decision"] = ["La decisión tiene que ser «aplicar», «pedir_ajustes» o «rechazar»."],
                });
            }

            // RECHAZAR O DEVOLVER SIN DECIR POR QUE NO ES UNA DECISION. Aplicar no necesita motivo:
            // el cambio aprobado habla por sí mismo, y la comparación queda guardada.
            if (decision is "rechazar" or "pedir_ajustes" && motivo is null)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["motivo"] = [decision == "rechazar"
                        ? "Escribe por qué se rechaza: es lo que leerá quien la propuso."
                        : "Escribe qué hay que ajustar: es lo que leerá quien la propuso."],
                });
            }

            if (!int.TryParse(propuesta.RegistroId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var registroId))
            {
                return Results.NotFound();
            }

            var registro = await proceso.BuscarAsync(db, registroId, ct);
            if (registro is null)
            {
                return Results.Conflict(new { message = $"{proceso.ElGenero} {proceso.Etiqueta.ToLowerInvariant()} de la propuesta ya no está disponible." });
            }

            var actor = Actor(principal);
            var ahora = DateTime.UtcNow;

            // BAJO LA ESTRATEGIA DE EJECUCION: con `EnableRetryOnFailure` una transacción abierta fuera de
            // la estrategia lanza en el primer SaveChangesAsync, y la decisión respondería 500 siempre
            // contra SQL Server.
            var estrategia = db.Database.CreateExecutionStrategy();
            return await estrategia.ExecuteAsync<IResult>(async () =>
            {
                await using var transaccion = await db.Database.BeginTransactionAsync(ct);

                if (decision == "aplicar")
                {
                    var campos = await db.PropuestasDeCambioCampos.AsNoTracking()
                        .Where(c => c.IdPropuesta == propuesta.Id).ToListAsync(ct);
                    var aplicado = await proceso.AplicarAsync(
                        db, registroId, campos, new AplicacionDePropuesta(propuesta.Id, motivo, actor, ahora), ct);
                    if (aplicado is not null) return aplicado;
                }

                propuesta.Estado = decision switch
                {
                    "aplicar" => EstadosDePropuesta.Aplicada,
                    "rechazar" => EstadosDePropuesta.Rechazada,
                    _ => EstadosDePropuesta.AjustesSolicitados,
                };
                propuesta.MotivoDeLaDecision = motivo;
                propuesta.IdUsuarioDecide = actor == 0 ? null : actor;
                propuesta.DecideNombre = actor == 0 ? null : await NombreDeUsuarioAsync(db, actor, ct);
                propuesta.FechaActualizacion = ahora;
                propuesta.FechaDecision = EstadosDePropuesta.EstaCerrada(propuesta.Estado) ? ahora : null;

                var evento = decision switch
                {
                    "aplicar" => $"{proceso.Etiqueta}PropuestaAplicada",
                    "rechazar" => $"{proceso.Etiqueta}PropuestaRechazada",
                    _ => $"{proceso.Etiqueta}PropuestaConAjustes",
                };
                proceso.Auditar(db, actor, registroId, evento, antes: null, despues: new { propuesta = propuesta.Id, motivo }, motivo);

                await AvisarAQuienRespondeAsync(proceso, db, registro, evento, propuesta.Estado, motivo, ahora, ct);
                await db.SaveChangesAsync(ct);
                await transaccion.CommitAsync(ct);

                return Results.Ok(await ADtoAsync(proceso, db, registro, propuesta, ct));
            });
        }).WithName($"DecidirPropuestaDeCambioDe{proceso.Etiqueta}");
    }

    // ───────────────────────────── Piezas del circuito ─────────────────────────────

    internal static async Task<PropuestaDeCambioRow?> PropuestaVivaAsync(
        ProcesoConPropuestas proceso, SimusDbContext db, int id, bool seguimiento, CancellationToken ct)
    {
        var registro = id.ToString(CultureInfo.InvariantCulture);
        var consulta = seguimiento ? db.PropuestasDeCambio : db.PropuestasDeCambio.AsNoTracking();
        return await consulta
            .Where(p => p.ModuloId == proceso.Modulo && p.RegistroId == registro
                        && p.Estado != EstadosDePropuesta.Aplicada
                        && p.Estado != EstadosDePropuesta.Rechazada)
            .OrderByDescending(p => p.Id)
            .FirstOrDefaultAsync(ct);
    }

    private static async Task<PropuestaDeCambioRow> AbrirPropuestaAsync(
        ProcesoConPropuestas proceso, SimusDbContext db, RegistroProponible registro, int proponenteId, DateTime ahora, CancellationToken ct)
    {
        var organizacion = registro.OrganizacionId is int idOrganizacion
            ? await db.EntityProfiles.AsNoTracking().Where(e => e.Id == idOrganizacion).Select(e => e.Name).FirstOrDefaultAsync(ct)
            : null;

        var fila = new PropuestaDeCambioRow
        {
            ModuloId = proceso.Modulo,
            RegistroId = registro.Id.ToString(CultureInfo.InvariantCulture),
            Estado = EstadosDePropuesta.Borrador,
            IdOrganizacion = registro.OrganizacionId,
            IdUsuarioResponsable = registro.OrganizacionId is null ? registro.PersonaId : null,
            OrganizacionNombre = organizacion,
            IdUsuarioProponente = proponenteId == 0 ? null : proponenteId,
            ProponenteNombre = proponenteId == 0 ? null : await NombreDeUsuarioAsync(db, proponenteId, ct),
            FechaCreacion = ahora,
        };
        db.PropuestasDeCambio.Add(fila);
        return fila;
    }

    /// <summary>Deja los campos de la propuesta EXACTAMENTE como llegaron: crea, actualiza y borra.</summary>
    private static async Task ReemplazarCamposAsync(
        ProcesoConPropuestas proceso, SimusDbContext db, PropuestaDeCambioRow propuesta,
        List<(string CampoId, string? Valor)> campos, DateTime ahora, CancellationToken ct)
    {
        var existentes = propuesta.Id == 0
            ? []
            : await db.PropuestasDeCambioCampos.Where(c => c.IdPropuesta == propuesta.Id).ToListAsync(ct);

        var pedidos = campos.ToDictionary(c => c.CampoId, c => c.Valor, StringComparer.Ordinal);

        foreach (var fila in existentes.Where(fila => !pedidos.ContainsKey(fila.CampoId)))
        {
            db.PropuestasDeCambioCampos.Remove(fila);
        }

        foreach (var (campoId, valor) in pedidos)
        {
            var definicion = proceso.Campos[campoId];
            var fila = existentes.Find(f => string.Equals(f.CampoId, campoId, StringComparison.Ordinal));
            if (fila is null)
            {
                db.PropuestasDeCambioCampos.Add(new PropuestaDeCambioCampoRow
                {
                    Propuesta = propuesta,
                    SeccionId = definicion.SeccionId,
                    CampoId = campoId,
                    CampoEtiqueta = definicion.Etiqueta,
                    ValorPropuesto = valor,
                    FechaCreacion = ahora,
                });
                continue;
            }

            fila.SeccionId = definicion.SeccionId;
            fila.CampoEtiqueta = definicion.Etiqueta;
            fila.ValorPropuesto = valor;
            fila.FechaActualizacion = ahora;
        }
    }

    /// <summary>Descarta lo que no se puede proponer y explica por qué, en vez de ignorarlo en silencio.</summary>
    private static (List<(string CampoId, string? Valor)> Campos, Dictionary<string, string[]> Errores) Normalizar(
        ProcesoConPropuestas proceso, List<CampoPropuestoSolicitud>? entrada)
    {
        var campos = new List<(string CampoId, string? Valor)>();
        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (entrada is null)
        {
            errores["campos"] = ["La propuesta tiene que traer la lista de campos, aunque esté vacía."];
            return (campos, errores);
        }

        var vistos = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < entrada.Count; i++)
        {
            var campoId = (entrada[i].CampoId ?? string.Empty).Trim();
            if (!proceso.Campos.ContainsKey(campoId))
            {
                errores[$"campos[{i}].campoId"] = [$"Ese campo de {proceso.Uno} no admite propuesta de cambio."];
                continue;
            }

            if (!vistos.Add(campoId))
            {
                errores[$"campos[{i}].campoId"] = ["Ese campo viene dos veces: solo puede proponerse un valor por campo."];
                continue;
            }

            campos.Add((campoId, LimpiarTexto(entrada[i].ValorPropuesto, 4000)));
        }

        return (campos, errores);
    }

    /// <summary>
    /// La propuesta como la lee la pantalla.
    /// </summary>
    /// <remarks>
    /// <b>SIN PROPUESTA SE DEVUELVE UNA CARCASA VACIA, NO UN NULO NI UN 404.</b> La pantalla se pinta igual en los dos
    /// casos, y un 404 la obligaría a distinguir «no hay» de «no existe».
    /// </remarks>
    private static async Task<PropuestaDeCambioDto> ADtoAsync(
        ProcesoConPropuestas proceso, SimusDbContext db, RegistroProponible registro, PropuestaDeCambioRow? propuesta, CancellationToken ct)
    {
        var registroId = registro.Id.ToString(CultureInfo.InvariantCulture);
        if (propuesta is null)
        {
            return new PropuestaDeCambioDto(
                0, proceso.Modulo, registroId, registro.Nombre,
                EstadosDePropuesta.Borrador, null, null, null, null, null, null, null, []);
        }

        var campos = propuesta.Id == 0
            ? []
            : await db.PropuestasDeCambioCampos.AsNoTracking()
                .Where(c => c.IdPropuesta == propuesta.Id)
                .OrderBy(c => c.SeccionId).ThenBy(c => c.Id)
                .ToListAsync(ct);

        var dtos = new List<CampoPropuestoDto>(campos.Count);
        foreach (var c in campos)
        {
            string? anterior = null, propuesto = null;
            if (proceso.Campos.TryGetValue(c.CampoId, out var definicion) && definicion.Legible is { } leer)
            {
                anterior = await leer(db, c.ValorAnterior, ct);
                propuesto = await leer(db, c.ValorPropuesto, ct);
            }

            dtos.Add(new CampoPropuestoDto(
                c.Id, c.SeccionId, c.CampoId, c.CampoEtiqueta, c.ValorAnterior, c.ValorPropuesto, anterior, propuesto));
        }

        return new PropuestaDeCambioDto(
            propuesta.Id, propuesta.ModuloId, propuesta.RegistroId, registro.Nombre,
            propuesta.Estado, propuesta.Motivo, propuesta.OrganizacionNombre, propuesta.ProponenteNombre,
            propuesta.DecideNombre, propuesta.MotivoDeLaDecision,
            propuesta.FechaEnvio, propuesta.FechaDecision, dtos);
    }

    private static async Task AvisarAQuienRespondeAsync(
        ProcesoConPropuestas proceso, SimusDbContext db, RegistroProponible registro, string evento, string estado,
        string? motivo, DateTime ahora, CancellationToken ct)
    {
        var (titulo, cuerpo) = estado switch
        {
            EstadosDePropuesta.Aplicada => (
                "Tu propuesta de cambio se aplicó",
                $"El PNMC aplicó los cambios que propusiste en {proceso.ParaElAviso} «{registro.Nombre}». Ya se ven en el sitio público."),
            EstadosDePropuesta.Rechazada => (
                "Tu propuesta de cambio no se aplicó",
                $"El PNMC no aplicó los cambios que propusiste en «{registro.Nombre}». Motivo: {motivo}"),
            _ => (
                "Tu propuesta de cambio necesita ajustes",
                $"El PNMC pidió ajustes en la propuesta de cambio de «{registro.Nombre}». {motivo}"),
        };

        var personas = registro.OrganizacionId is int organizacion
            ? await db.UserEntities.AsNoTracking()
                .Where(ue => ue.EntityId == organizacion && ue.IsActive)
                .Join(db.Users.AsNoTracking().Where(u => u.IsActive),
                    relacion => relacion.UserId, usuario => usuario.Id,
                    (_, usuario) => new { usuario.Id, usuario.Email })
                .ToListAsync(ct)
            : await db.Users.AsNoTracking()
                .Where(u => u.Id == registro.PersonaId && u.IsActive)
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
                ModuloId = proceso.Modulo,
                RecordId = registro.Id.ToString(CultureInfo.InvariantCulture),
                CreatedAt = ahora,
                SentAt = ahora,
                Attempts = 0,
            });
        }
    }

    /// <summary>
    /// El registro que esta persona puede tocar, o el resultado que lo impide.
    /// </summary>
    /// <remarks>
    /// Ver la propuesta lo puede un editor; redactarla, enviarla o retirarla pide administrar. Si responde una persona,
    /// solo ella; un registro ajeno responde 404, no 403: no se confirma que exista.
    /// </remarks>
    private static async Task<(RegistroProponible? Registro, IResult? Fallo)> DelResponsableAsync(
        ProcesoConPropuestas proceso, int id, ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct,
        bool bastaConEditar = false)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return (null, Results.Unauthorized());

        var registro = await proceso.BuscarAsync(db, id, ct);
        if (registro is null) return (null, Results.NotFound());

        if (registro.OrganizacionId is int organizacion)
        {
            var puede = await (bastaConEditar
                ? AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacion, ct)
                : AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacion, ct));
            return puede ? (registro, null) : (null, Results.Forbid());
        }

        return registro.PersonaId == persona.Value ? (registro, null) : (null, Results.NotFound());
    }

    private static async Task<string?> NombreDeUsuarioAsync(SimusDbContext db, int usuarioId, CancellationToken ct) =>
        await db.Users.AsNoTracking().Where(u => u.Id == usuarioId).Select(u => u.FullName).FirstOrDefaultAsync(ct);

    private static int Actor(ClaimsPrincipal principal) =>
        int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), CultureInfo.InvariantCulture, out var id) ? id : 0;

    private static string? LimpiarTexto(string? valor, int tope) =>
        string.IsNullOrWhiteSpace(valor) ? null : ValidationHelpers.SanitizeText(valor, tope);
}
