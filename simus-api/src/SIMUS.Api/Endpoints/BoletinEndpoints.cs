using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El boletin: quien pidio recibirlo, y como se consulta esa lista desde la consola.
/// </summary>
/// <remarks>
/// <para>
/// EL MODELO: NADA. El campo de correo de la portada no estaba conectado. El boton no tenia
/// manejador, asi que escribir el correo y pulsar no producia ni peticion, ni error, ni aviso:
/// quien lo usara se quedaba creyendo que se habia suscrito. Encontrado.
/// </para>
/// <para>
/// EL TEXTO DE LA AUTORIZACION LO SIRVE EL SERVIDOR, NO LO MANDA EL CLIENTE. Es la decision que
/// sostiene todo lo demas: el navegador pide el texto por <c>GET /publico/boletin/politica</c>, lo
/// enseña, y al aceptar el servidor guarda <b>el texto que el mismo sirvio</b>. Si el cliente
/// pudiera mandarlo, la evidencia de la autorizacion valdria exactamente lo que valga la palabra
/// de quien la envia, que para un dato personal es nada.
/// </para>
/// <para>
/// LA RESPUESTA ES LA MISMA PARA UN CORREO NUEVO Y PARA UNO YA APUNTADO. No por elegancia: si
/// distinguiera, esta ruta seria un comprobador de si una direccion esta en la lista, abierto y
/// sin sesion. Quien se suscribe dos veces ve el mismo mensaje que la primera.
/// </para>
/// </remarks>
public static class BoletinEndpoints
{
    /*
      EL TEXTO YA NO VIVE AQUI, Y ESE ERA EL PROBLEMA.

      Esta clase declaraba `TextoDeLaPolitica` y `VersionDeLaPolitica` como constantes de C#. El
      texto se copiaba bien en cada fila —eso estaba bien y es lo que se generalizo—, pero la
      version NO se persistia en ninguna parte: vivia solo en el codigo. Cambiar la redaccion
      dejaba filas antiguas diciendo una cosa y una constante diciendo otra, sin forma de saber
      desde cuando.

      Ahora los dos salen de `dbo.PoliticasDatos`, que es de donde salen los tres textos del
      sistema, y la autorizacion se escribe por `RegistroDeAutorizaciones` como todas las demas.
    */

    private const int LargoMaximoDelCorreo = 180;
    private const string OrigenPorOmision = "portada";

    /// <summary>
    /// De donde puede venir un alta. Lista blanca: lo que no esta nombrado, no entra.
    /// </summary>
    /// <remarks>
    /// «noticias» SE AÑADIO CON EL DISEÑO APROBADO DEL PORTAL, que sitúa el bloque de suscripción
    /// dentro de la parrilla de Noticias además de en la portada. Sin este valor, esas altas se
    /// habrían guardado como «portada» y la consola no habría podido distinguir qué pantalla
    /// convierte: la lista de suscripciones existe justamente para poder mirar eso.
    /// </remarks>
    private static readonly HashSet<string> OrigenesValidos = new(StringComparer.OrdinalIgnoreCase)
    {
        OrigenPorOmision,
        "noticias",
    };

    public static RouteGroupBuilder MapBoletinEndpoints(this RouteGroupBuilder group)
    {
        MapPublicas(group);
        MapDeConsola(group);
        return group;
    }

    // ---------------------------------------------------------------------------------------
    // Lo que ve el sitio publico
    // ---------------------------------------------------------------------------------------
    private static void MapPublicas(RouteGroupBuilder group)
    {
        var publico = group.MapGroup("/publico/boletin").WithTags("boletin");

        // SE CONSERVA PORQUE LA PORTADA YA LA LLAMA, y ahora lee de la base. `GET
        // /publico/politicas/boletin` devuelve lo mismo con mas campos; esta se queda como la
        // forma corta que el bloque de suscripcion necesita.
        publico.MapGet("/politica", async (SimusDbContext dbContext, CancellationToken cancellationToken) =>
        {
            var politica = await RegistroDeAutorizaciones.PoliticaVigenteAsync(
                dbContext, FinalidadesDeDatos.Boletin, cancellationToken);

            // SIN TEXTO NO SE PUEDE PEDIR AUTORIZACION. Devolver una cadena vacia dejaria la
            // casilla del boletin sin nada que aceptar y la suscripcion seguiria entrando: se
            // estaria recogiendo un correo sin haber informado de nada.
            return politica is null
                ? Results.NotFound(new { message = "El texto de autorización del boletín no está disponible." })
                : Results.Ok(new PoliticaDto(politica.Version, politica.Texto));
        }).AllowAnonymous();

        // EL ALTA ES UNA SOLICITUD, NO UNA SUSCRIPCION (S-10, decision 158). Crea una fila sin
        // confirmar y envia el enlace; la autorizacion se escribe al confirmar. Antes cualquiera
        // suscribia un correo ajeno y quedaba autorizado a su nombre.
        publico.MapPost("/suscripciones", async (
            SolicitudDeAltaDto solicitud,
            SimusDbContext dbContext,
            IEnviadorDeCorreo correo,
            BajaDelBoletin baja,
            CancellationToken cancellationToken) =>
        {
            var correoNormalizado = NormalizarCorreo(solicitud?.Correo);

            if (correoNormalizado is null)
            {
                return Results.BadRequest(new { message = "El correo electrónico no es válido." });
            }

            if (solicitud!.AutorizaTratamiento != true)
            {
                return Results.BadRequest(new
                {
                    message = "Hace falta aceptar la política de tratamiento de datos para recibir el boletín.",
                });
            }

            var origen = (solicitud.Origen ?? OrigenPorOmision).Trim();
            if (!OrigenesValidos.Contains(origen))
            {
                origen = OrigenPorOmision;
            }

            var ahora = DateTime.UtcNow;

            // SIN TEXTO VIGENTE NO SE PIDE NADA: el enlace pediria confirmar una autorizacion que no se
            // puede escribir despues.
            var politica = await RegistroDeAutorizaciones.PoliticaVigenteAsync(
                dbContext, FinalidadesDeDatos.Boletin, cancellationToken);
            if (politica is null)
            {
                return Results.Problem(
                    detail: "El texto de autorización del boletín no está disponible.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            // LAS SOLICITUDES VIEJAS SE BORRAN AL PASAR, ademas de en el ciclo programado.
            await BoletinDobleConfirmacion.DepurarAsync(dbContext, ahora, cancellationToken);

            var fila = await dbContext.BoletinSuscripciones
                .FirstOrDefaultAsync(item => item.CorreoElectronico == correoNormalizado, cancellationToken);

            if (fila is null)
            {
                fila = new BoletinSuscripcionRow
                {
                    CorreoElectronico = correoNormalizado,
                    Origen = origen,
                    Estado = "activa",
                    FechaAlta = ahora,
                    Confirmada = false,
                };
                dbContext.BoletinSuscripciones.Add(fila);
                // SE GUARDA ANTES DE EMITIR: el enlace de baja del correo lleva el identificador de la fila.
                await dbContext.SaveChangesAsync(cancellationToken);
                await BoletinDobleConfirmacion.EmitirAsync(correo, baja, fila, ahora, cancellationToken);
            }
            else if (!fila.Confirmada || fila.Estado == "baja")
            {
                // Una solicitud sin confirmar, o quien se dio de baja y vuelve: se pide confirmar de
                // nuevo (con espera entre envios). Una baja sigue siendo baja hasta que se confirme.
                if (!fila.Confirmada) fila.Origen = origen;
                await BoletinDobleConfirmacion.EmitirAsync(correo, baja, fila, ahora, cancellationToken);
            }
            // Ya confirmada y activa: no se escribe a nadie. Escribirle a quien ya esta suscrito
            // seria otra via para llenar un buzon ajeno.

            await dbContext.SaveChangesAsync(cancellationToken);

            // Mismo cuerpo en todos los caminos. Ver el comentario de la clase.
            return Results.Accepted(value: new
            {
                message = "Casi listo. Si el correo es válido, te enviamos un enlace para confirmar la suscripción; hasta que lo abras no recibirás el boletín.",
            });
        })
            .RequireRateLimiting("boletin-alta")
            .AllowAnonymous();

        // ANONIMA A PROPOSITO, y declarada en AutorizacionPorDefectoTests: el enlace se abre desde el
        // buzon, donde no hay sesion. Es POST y no GET para que un antivirus o la vista previa del
        // correo, que abren enlaces, no confirmen por la persona: confirma el boton de la pagina.
        publico.MapPost("/confirmar", async (
            SolicitudDeConfirmacionDto solicitud,
            SimusDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var ahora = DateTime.UtcNow;
            var (resultado, fila) = await BoletinDobleConfirmacion.BuscarAsync(
                dbContext, solicitud?.Testigo, ahora, cancellationToken);

            if (resultado == ResultadoDeConfirmacionDeBoletin.Vencido)
            {
                return Results.BadRequest(new { message = "Este enlace ya venció. Vuelve a suscribirte desde la portada para recibir uno nuevo." });
            }

            if (fila is null)
            {
                return Results.BadRequest(new { message = "Este enlace no es válido o ya se usó. Si ya confirmaste, no tienes que hacer nada más." });
            }

            // LA AUTORIZACION SE ESCRIBE AQUI y no antes, con el texto vigente de este momento.
            var autorizacion = await RegistroDeAutorizaciones.OtorgarAsync(
                dbContext, FinalidadesDeDatos.Boletin, fila.Origen, ahora,
                idUsuario: null, correoTitular: fila.CorreoElectronico, referenciaId: null, cancellationToken);
            if (autorizacion is null)
            {
                return Results.Problem(
                    detail: "El texto de autorización del boletín no está disponible.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            // QUIEN VUELVE DESPUES DE UNA BAJA entra con la fecha de ahora: la antigua es la de un
            // consentimiento que ya habia retirado.
            if (fila.Estado == "baja") fila.FechaAlta = ahora;
            fila.Confirmada = true;
            fila.FechaConfirmacion = ahora;
            fila.Estado = "activa";
            fila.FechaBaja = null;
            fila.OrigenBaja = null;
            // UN SOLO USO: el enlace deja de existir.
            fila.HashTestigo = null;
            fila.FechaEmisionTestigo = null;

            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(new { message = "Suscripción confirmada. Gracias: vas a recibir el boletín del SIMUS." });
        })
            .RequireRateLimiting("boletin-alta")
            .AllowAnonymous();

        // LA BAJA PUBLICA (revocacion de la autorizacion desde el enlace de cada correo). Anonimas a proposito: el enlace se
        // abre desde el buzon. Sin ruta que reciba un correo: solo se llega con un testigo firmado, y uno invalido responde
        // siempre lo mismo (no se puede usar para saber quien esta en la lista). Ver BajaDelBoletin.
        const string EnlaceNoValido = "Este enlace de baja no es válido. Ábrelo tal como llegó a tu correo o escríbenos por los canales del Ministerio.";

        // PRIMER TIEMPO: ABRIR EL ENLACE NO DA DE BAJA. Solo dice a que correo (enmascarado) se refiere y en que estado esta.
        publico.MapGet("/baja", async (
            string? testigo,
            SimusDbContext dbContext,
            BajaDelBoletin baja,
            CancellationToken cancellationToken) =>
        {
            var fila = await BuscarParaBajaAsync(dbContext, baja, testigo, cancellationToken);
            return fila is null
                ? Results.BadRequest(new { message = EnlaceNoValido })
                : Results.Ok(new { estado = fila.Estado, correo = BajaDelBoletin.Enmascarar(fila.CorreoElectronico) });
        })
            .RequireRateLimiting("boletin-alta")
            .AllowAnonymous();

        // SEGUNDO TIEMPO: LA PERSONA PULSA EL BOTON. Idempotente: repetirla responde igual y no cambia la fecha de baja.
        publico.MapPost("/baja", async (
            SolicitudDeConfirmacionDto solicitud,
            SimusDbContext dbContext,
            BajaDelBoletin baja,
            CancellationToken cancellationToken) =>
        {
            var fila = await BuscarParaBajaAsync(dbContext, baja, solicitud?.Testigo, cancellationToken);
            if (fila is null) return Results.BadRequest(new { message = EnlaceNoValido });

            await BajaDelBoletin.AplicarAsync(
                dbContext, fila, BajaDelBoletin.OrigenPersona, DateTime.UtcNow,
                "Baja de la suscripcion al boletin desde el enlace del correo.", cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok(new { estado = "baja", message = "Listo: te diste de baja del boletín del SIMUS y retiramos tu autorización." });
        })
            .RequireRateLimiting("boletin-alta")
            .AllowAnonymous();

        // EL «UN CLIC» DE LA CABECERA List-Unsubscribe-Post (RFC 8058): el cliente de correo hace POST a la URL de la cabecera
        // con `List-Unsubscribe=One-Click` cuando la persona pulsa «Cancelar suscripcion»; no hay pantalla donde confirmar,
        // asi que la confirmacion es ese acto. El testigo va en la consulta porque es lo que lleva la URL de la cabecera.
        publico.MapPost("/baja-un-clic", async (
            string? testigo,
            SimusDbContext dbContext,
            BajaDelBoletin baja,
            CancellationToken cancellationToken) =>
        {
            var fila = await BuscarParaBajaAsync(dbContext, baja, testigo, cancellationToken);
            if (fila is null) return Results.BadRequest(new { message = EnlaceNoValido });

            await BajaDelBoletin.AplicarAsync(
                dbContext, fila, BajaDelBoletin.OrigenPersona, DateTime.UtcNow,
                "Baja de la suscripcion al boletin desde el boton del cliente de correo.", cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.Ok();
        })
            .RequireRateLimiting("boletin-alta")
            .AllowAnonymous();
    }

    /// <summary>La suscripcion a la que pertenece un testigo de baja autentico, o nulo (sin decir por que).</summary>
    private static async Task<BoletinSuscripcionRow?> BuscarParaBajaAsync(
        SimusDbContext db, BajaDelBoletin baja, string? testigo, CancellationToken ct)
    {
        var id = BajaDelBoletin.IdDe(testigo);
        if (id is null) return null;
        var fila = await db.BoletinSuscripciones.FirstOrDefaultAsync(item => item.Id == id, ct);
        return fila is not null && baja.Coincide(fila, testigo!.Trim()) ? fila : null;
    }

    // ---------------------------------------------------------------------------------------
    // Lo que ve la consola, en Comunicaciones
    // ---------------------------------------------------------------------------------------
    private static void MapDeConsola(RouteGroupBuilder group)
    {
        var consola = group.MapGroup("/admin/comunicaciones/boletin").WithTags("boletin-consola");
        consola.RequireAuthorization(SimusAuthentication.InstitutionalPolicy);
        consola.ExigeModulo("boletin");

        consola.MapGet("/", async (
            SimusDbContext dbContext,
            string? q,
            string? estado,
            string? orden,
            string? direccion,
            int? limit,
            int? offset,
            CancellationToken cancellationToken) =>
        {
            var take = Math.Clamp(limit ?? 25, 1, 200);
            var skip = Math.Max(offset ?? 0, 0);

            var consulta = Filtrar(dbContext, q, estado);

            var total = await consulta.CountAsync(cancellationToken);
            var activas = await Filtrar(dbContext, q, "activa").CountAsync(cancellationToken);

            var suscripciones = await Ordenar(consulta, orden, direccion)
                .Skip(skip)
                .Take(take)
                .ToListAsync(cancellationToken);

            // EL TEXTO SE BUSCA EN EL REGISTRO, que es donde vive desde que dejo de haber tres
            // sitios donde vivia. Se trae la ULTIMA autorizacion de cada correo: si alguien se dio
            // de baja y volvio, la vigente es la de ahora y es la que hay que poder enseñar.
            var correos = suscripciones.Select(item => item.CorreoElectronico).ToList();
            var evidencias = await dbContext.AutorizacionesDeDatos.AsNoTracking()
                .Where(item => item.Finalidad == "boletin" && correos.Contains(item.CorreoTitular!))
                .OrderByDescending(item => item.FechaOtorgada)
                .Select(item => new { item.CorreoTitular, item.TextoAceptado, item.Version })
                .ToListAsync(cancellationToken);

            var porCorreo = evidencias
                .GroupBy(item => item.CorreoTitular!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(grupo => grupo.Key, grupo => grupo.First(), StringComparer.OrdinalIgnoreCase);

            var filas = suscripciones
                .Select(item =>
                {
                    porCorreo.TryGetValue(item.CorreoElectronico, out var evidencia);
                    return new SuscripcionDto(
                        item.Id,
                        item.CorreoElectronico,
                        item.Origen,
                        item.Estado,
                        item.FechaAlta,
                        item.FechaBaja,
                        item.OrigenBaja,
                        evidencia?.TextoAceptado ?? string.Empty,
                        evidencia?.Version ?? string.Empty);
                })
                .ToList();

            return Results.Ok(new
            {
                items = filas,
                total,
                activas,
                limit = take,
                offset = skip,
            });
        });

        consola.MapGet("/export.csv", async (
            SimusDbContext dbContext,
            string? q,
            string? estado,
            CancellationToken cancellationToken) =>
        {
            // ESTE ES EL PUENTE. No hay integracion con un proveedor de envios y no la habra
            // aqui: una lista que se puede descargar entra en cualquier herramienta —Mailchimp,
            // Brevo, la que use el Ministerio— sin credenciales guardadas, sin salida de datos a
            // un tercero que nadie aprobo, y sin un contrato mas que mantener.
            var filas = await Filtrar(dbContext, q, estado)
                .OrderByDescending(item => item.FechaAlta)
                .Select(item => new
                {
                    item.CorreoElectronico,
                    item.Origen,
                    item.Estado,
                    item.FechaAlta,
                    item.FechaBaja,
                    item.OrigenBaja,
                })
                .ToListAsync(cancellationToken);

            var csv = new StringBuilder();
            csv.Append('﻿'); // BOM: sin el, Excel en Windows abre las tildes rotas.
            csv.AppendLine("correo,origen,estado,fecha_alta,fecha_baja,origen_baja");
            foreach (var fila in filas)
            {
                csv.Append(Escapar(fila.CorreoElectronico)).Append(',')
                   .Append(Escapar(fila.Origen)).Append(',')
                   .Append(Escapar(fila.Estado)).Append(',')
                   .Append(fila.FechaAlta.ToString("O", CultureInfo.InvariantCulture)).Append(',')
                   .Append(fila.FechaBaja?.ToString("O", CultureInfo.InvariantCulture) ?? string.Empty).Append(',')
                   .Append(Escapar(fila.OrigenBaja))
                   .Append('\n');
            }

            return Results.File(
                Encoding.UTF8.GetBytes(csv.ToString()),
                "text/csv; charset=utf-8",
                "boletin-pnmc.csv");
        });

        consola.MapPost("/{id:int}/baja", async (
            int id,
            SimusDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            var fila = await dbContext.BoletinSuscripciones
                .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

            if (fila is null)
            {
                return Results.NotFound(new { message = "Esa suscripción no existe." });
            }

            if (fila.Estado == "baja")
            {
                return Results.Ok(new { message = "Ya estaba dada de baja." });
            }

            // NO SE BORRA LA FILA, Y SE RETIRA LA AUTORIZACION: ver BajaDelBoletin.AplicarAsync. El origen queda escrito.
            await BajaDelBoletin.AplicarAsync(
                dbContext, fila, BajaDelBoletin.OrigenAdministracion, DateTime.UtcNow,
                "Baja de la suscripcion al boletin.", cancellationToken);

            await dbContext.SaveChangesAsync(cancellationToken);

            return Results.Ok(new { message = "Suscripción dada de baja." });
        })
            .AddEndpointFilter(ExigeTestigoDeLaConsola.Exigir);
    }

    /// <summary>El orden de la tabla de suscripciones, resuelto en la base y no sobre la pagina.</summary>
    /// <remarks>
    /// <para>
    /// <b>ORDENA EL SERVIDOR PORQUE LA LISTA PAGINA</b> de veinticinco en veinticinco. Hasta el 15
    /// de septiembre de 2026 la tabla ordenaba las filas cargadas, y este mismo fichero lo decia:
    /// «ordena la pagina, no el listado entero». Eso no es una simplificacion, es afirmar algo
    /// falso sobre el resto de la lista. La direccion de producto lo fijo para toda la consola: «debe
    /// ser de todos, no solo de los de la pagina visible».
    /// </para>
    /// <para>
    /// <b>SIN COLUMNA PEDIDA, POR FECHA DE ALTA DESCENDENTE</b>: quien abre la lista busca quien
    /// entro, y es como respondia antes de existir este parametro.
    /// </para>
    /// <para>
    /// <b>LA FECHA DE BAJA QUE FALTA VA AL FINAL EN LOS DOS SENTIDOS.</b> Una suscripcion activa no
    /// tiene fecha de baja; colarla primera al ordenar por esa columna diria que se dio de baja
    /// antes que nadie.
    /// </para>
    /// </remarks>
    private static IQueryable<BoletinSuscripcionRow> Ordenar(
        IQueryable<BoletinSuscripcionRow> consulta, string? orden, string? direccion)
    {
        var ascendente = string.Equals((direccion ?? string.Empty).Trim(), "asc", StringComparison.OrdinalIgnoreCase);

        switch ((orden ?? string.Empty).Trim().ToLowerInvariant())
        {
            case "correo":
                return ascendente
                    ? consulta.OrderBy(item => item.CorreoElectronico).ThenBy(item => item.Id)
                    : consulta.OrderByDescending(item => item.CorreoElectronico).ThenBy(item => item.Id);

            case "estado":
                // «activa» ANTES QUE «baja», igual que los rotulos Activa y Baja.
                return ascendente
                    ? consulta.OrderBy(item => item.Estado).ThenBy(item => item.Id)
                    : consulta.OrderByDescending(item => item.Estado).ThenBy(item => item.Id);

            case "origen":
                return ascendente
                    ? consulta.OrderBy(item => item.Origen).ThenBy(item => item.Id)
                    : consulta.OrderByDescending(item => item.Origen).ThenBy(item => item.Id);

            case "alta":
                return ascendente
                    ? consulta.OrderBy(item => item.FechaAlta).ThenBy(item => item.Id)
                    : consulta.OrderByDescending(item => item.FechaAlta).ThenByDescending(item => item.Id);

            case "baja":
                return ascendente
                    ? consulta.OrderBy(item => item.FechaBaja == null).ThenBy(item => item.FechaBaja).ThenBy(item => item.Id)
                    : consulta.OrderBy(item => item.FechaBaja == null).ThenByDescending(item => item.FechaBaja).ThenBy(item => item.Id);

            default:
                return consulta.OrderByDescending(item => item.FechaAlta).ThenByDescending(item => item.Id);
        }
    }

    private static IQueryable<BoletinSuscripcionRow> Filtrar(SimusDbContext dbContext, string? q, string? estado)
    {
        // SOLO LAS CONFIRMADAS (S-10): una solicitud sin confirmar no es una suscripcion ni una
        // autorizacion, y exportarla a una herramienta de envios seria escribirle a quien no lo pidio.
        var consulta = dbContext.BoletinSuscripciones.AsNoTracking().Where(item => item.Confirmada);

        var estadoPedido = (estado ?? string.Empty).Trim().ToLowerInvariant();
        if (estadoPedido is "activa" or "baja")
        {
            consulta = consulta.Where(item => item.Estado == estadoPedido);
        }

        var texto = (q ?? string.Empty).Trim();
        if (texto.Length > 0)
        {
            consulta = consulta.Where(item => item.CorreoElectronico.Contains(texto));
        }

        return consulta;
    }

    /// <summary>
    /// Normaliza y valida el correo, o devuelve <c>null</c> si no sirve.
    /// </summary>
    /// <remarks>
    /// A MINUSCULAS ANTES DE GUARDAR, y no solo por orden: la unicidad la impone
    /// <c>UQ_BoletinSuscripciones_Correo</c>, y en una base con intercalacion sensible a
    /// mayusculas «Ana@x.co" y «ana@x.co» serian dos filas y dos correos a la misma persona.
    /// Normalizar aqui hace que la restriccion signifique lo que aparenta.
    /// </remarks>
    /// <summary>
    /// El correo, normalizado y comprobado, o nulo si no sirve para suscribir a nadie.
    /// </summary>
    /// <remarks>
    /// NO ES SOLO NORMALIZAR, Y POR ESO SIGUE AQUI. Además de dejar el correo en su forma canónica
    /// —eso lo hace <see cref="CorreoElectronico.Normalizar"/>, como en todo el proyecto—, comprueba
    /// que tenga forma de dirección y que quepa. El boletín escribe a quien se apunta, así que una
    /// dirección mal formada no es un dato incompleto sino un envío que va a rebotar.
    /// </remarks>
    private static string? NormalizarCorreo(string? valor)
    {
        var limpio = CorreoElectronico.Normalizar(valor) ?? string.Empty;

        if (limpio.Length == 0 || limpio.Length > LargoMaximoDelCorreo)
        {
            return null;
        }

        var arroba = limpio.IndexOf('@');
        if (arroba <= 0 || arroba != limpio.LastIndexOf('@') || arroba == limpio.Length - 1)
        {
            return null;
        }

        var dominio = limpio[(arroba + 1)..];
        var punto = dominio.IndexOf('.');
        if (punto <= 0 || punto == dominio.Length - 1)
        {
            return null;
        }

        if (limpio.Any(char.IsWhiteSpace))
        {
            return null;
        }

        return limpio.ToLowerInvariant();
    }

    /// <summary>
    /// Escapa un campo para CSV.
    /// </summary>
    /// <remarks>
    /// LAS COMILLAS Y LAS COMAS NO SON EL UNICO MOTIVO. Un valor que empieza por <c>=</c>,
    /// <c>+</c>, <c>-</c> o <c>@</c> lo interpreta Excel como formula al abrir el fichero, y un
    /// correo puede empezar por <c>@</c>. Se antepone una comilla simple para que se lea como
    /// texto: es la inyeccion de formulas en CSV, y aqui el dato lo escribe cualquiera desde un
    /// formulario publico.
    /// </remarks>
    private static string Escapar(string? valor)
    {
        var texto = valor ?? string.Empty;

        if (texto.Length > 0 && texto[0] is '=' or '+' or '-' or '@')
        {
            texto = "'" + texto;
        }

        if (texto.Contains('"') || texto.Contains(',') || texto.Contains('\n') || texto.Contains('\r'))
        {
            return "\"" + texto.Replace("\"", "\"\"") + "\"";
        }

        return texto;
    }

    private sealed record SolicitudDeConfirmacionDto(string? Testigo);

    private sealed record PoliticaDto(string Version, string Texto);

    private sealed record SolicitudDeAltaDto(string? Correo, bool? AutorizaTratamiento, string? Origen);

    private sealed record SuscripcionDto(
        int Id,
        string Correo,
        string Origen,
        string Estado,
        DateTime FechaAlta,
        DateTime? FechaBaja,
        string? OrigenBaja,
        string AutorizacionTexto,
        /// <summary>Con que redaccion se autorizo. Antes no se guardaba y no habia forma de saberlo.</summary>
        string VersionAutorizacion);
}
