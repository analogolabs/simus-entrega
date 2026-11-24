using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Observability;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// «¿Olvidaste tu contraseña?» para las cuentas EXTERNAS (<c>docs/desarrollo/19-cuentas-y-organizaciones.md</c> §19.9).
/// </summary>
/// <remarks>
/// <para>
/// <b>LAS CUENTAS INTERNAS DE LA CONSOLA NO ENTRAN POR AQUÍ.</b> A quien tiene un rol interno no se le
/// manda ningún enlace —se contesta igual que a una cuenta que no existe—: su contraseña la restablece
/// el webmaster desde Usuarios. Un enlace por correo sería una segunda puerta a la consola, y la consola
/// tiene una sola.
/// </para>
/// <para>
/// <b>LA SOLICITUD NO DICE SI LA CUENTA EXISTE.</b> Contesta lo mismo, con el mismo código y en un
/// tiempo parecido, exista la cuenta, esté desactivada o sea interna. El motivo real queda solo en el
/// registro del servidor, con el correo seudonimizado, como en el inicio de sesión.
/// </para>
/// <para>
/// <b>RESTABLECER CIERRA LAS DEMÁS SESIONES.</b> Cambia el hash de la contraseña y, con él, el sello
/// <c>simus:sello</c> que lleva toda cookie externa; <see cref="RevalidacionDeSesion.Invalidar"/> hace
/// que el cambio valga desde la siguiente petición y no dentro de la ventana de la caché. No inicia
/// sesión: la persona entra con la contraseña nueva, como cualquier otra vez.
/// </para>
/// <para>
/// <b>NI EL TESTIGO NI LA CONTRASEÑA SE REGISTRAN</b> en logs ni en bitácora. La bitácora guarda que
/// hubo una solicitud y que hubo un restablecimiento, sin datos sensibles.
/// </para>
/// </remarks>
public static partial class RecuperacionDeContrasenaEndpoints
{
    private static readonly PasswordHasher<UserRow> Hasher = new();

    private static readonly string[] TestigoInvalido =
        ["Este enlace no es válido. Pide uno nuevo desde «¿Olvidaste tu contraseña?»."];
    private static readonly string[] TestigoVencido =
        ["Este enlace ya venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?»."];
    private static readonly string[] TestigoUsado =
        ["Este enlace ya se usó. Si necesitas restablecer la contraseña otra vez, pide uno nuevo."];
    private static readonly string[] TestigoReemplazado =
        ["Pediste un enlace más reciente y este ya no sirve. Usa el último correo que recibiste."];

    public static RouteGroupBuilder MapRecuperacionDeContrasenaEndpoints(this RouteGroupBuilder group)
    {
        var externo = group.MapGroup("/externo/auth").WithTags("externo-auth");
        // NADA DE ESTAS RESPUESTAS SE GUARDA EN CACHÉS: el estado de un enlace y el testigo antiforgery
        // son de quien los pidió.
        externo.AddEndpointFilter(async (contexto, siguiente) =>
        {
            contexto.HttpContext.Response.Headers.CacheControl = "no-store";
            return await siguiente(contexto);
        });

        // ANONIMA A PROPOSITO: quien olvidó su contraseña no tiene sesión, por definición. Entrega el
        // testigo antiforgery de las dos escrituras de abajo. Sin sesión no hay identidad a la que
        // atarlo, pero sigue haciendo su trabajo: la petición tiene que salir de nuestra página, que
        // es la única que lo pide, y no de un formulario ajeno. SIN LIMITADOR A PROPÓSITO: no cuesta
        // nada ni escribe nada, y contarlo gastaría el cupo de las tres operaciones que sí lo
        // necesitan (cada una pide primero su testigo).
        externo.MapGet("/csrf", (IAntiforgery antiforgery, HttpContext contexto) =>
        {
            var testigos = antiforgery.GetAndStoreTokens(contexto);
            return Results.Ok(new ExternalCsrfTokenResponse(testigos.RequestToken ?? string.Empty));
        }).AllowAnonymous().WithName("TestigoDeRecuperacionDeContrasena");

        // ANONIMA A PROPOSITO: ver arriba. Lleva el limitador por origen y, dentro, el de la cuenta.
        externo.MapPost("/olvide-contrasena", SolicitarAsync)
            .AllowAnonymous().RequireRateLimiting("external-recuperacion").WithName("SolicitarRecuperacionDeContrasena");

        // ANONIMA A PROPOSITO: el enlace se abre desde el correo. Solo dice si sirve, para no hacer
        // escribir una contraseña nueva para descubrir después que el enlace venció.
        externo.MapPost("/restablecer-contrasena/comprobar", ComprobarAsync)
            .AllowAnonymous().RequireRateLimiting("external-recuperacion").WithName("ComprobarEnlaceDeRecuperacion");

        // ANONIMA A PROPOSITO: el testigo del enlace ES la credencial.
        externo.MapPost("/restablecer-contrasena", RestablecerAsync)
            .AllowAnonymous().RequireRateLimiting("external-recuperacion").WithName("RestablecerContrasenaConEnlace");

        return group;
    }

    // ── Solicitar ──────────────────────────────────────────────────────────────────────────────

    private static async Task<IResult> SolicitarAsync(
        SolicitudDeRecuperacionDeContrasena solicitud,
        SimusDbContext db,
        IEnviadorDeCorreo correo,
        OpcionesDeCorreo opcionesDeCorreo,
        IAntiforgery antiforgery,
        HttpContext contexto,
        ILoggerFactory registros,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, contexto))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var email = CorreoElectronico.Normalizar(solicitud?.Correo);
        // El formato se valida y se dice: no depende de que la cuenta exista.
        if (email is null || !esCorreo(email))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["correo"] = ["Escribe un correo electrónico válido."] });

        var reloj = Stopwatch.StartNew();
        var registro = registros.CreateLogger("SIMUS.Autenticacion.Externa");
        var seudonimo = RedaccionDatosPersonales.Correo(email);
        try
        {
            await AtenderAsync(email, db, correo, opcionesDeCorreo, registro, ct);
        }
        catch (Exception fallo) when (fallo is not OperationCanceledException)
        {
            // UN FALLO NO SE CONTESTA DISTINTO. Si solo la cuenta real pudiera dar un 500 (la base no
            // escribió, la cola no aceptó el mensaje, dos solicitudes simultáneas chocaron con el índice
            // de un solo enlace vivo), el código de respuesta revelaría que existe. Se registra —con el
            // correo seudonimizado— y se contesta lo mismo; quien no reciba el correo puede pedirlo otra vez.
            Registros.Fallo(registro, fallo, seudonimo);
            db.ChangeTracker.Clear();
        }

        // TIEMPO PARECIDO ATIENDA O NO A UNA CUENTA REAL (ver DuracionMinima).
        var falta = RecuperacionDeContrasena.DuracionMinima - reloj.Elapsed;
        if (falta > TimeSpan.Zero) await Task.Delay(falta, ct);

        return Results.Accepted(value: new { message = RecuperacionDeContrasena.MensajeNeutro });

        static bool esCorreo(string valor) => SIMUS.Infrastructure.Common.ValidationHelpers.IsValidEmail(valor);
    }

    private static async Task AtenderAsync(
        string email, SimusDbContext db, IEnviadorDeCorreo correo, OpcionesDeCorreo opcionesDeCorreo,
        ILogger registro, CancellationToken ct)
    {
        var seudonimo = RedaccionDatosPersonales.Correo(email);
        var cuenta = await db.Users.FirstOrDefaultAsync(item => item.Email == email, ct);
        if (cuenta is null)
        {
            Registros.SinEnlace(registro, "cuenta_inexistente", seudonimo);
            return;
        }

        // SOLO CUENTAS ACTIVAS Y EXTERNAS. Una desactivada no recibe nada: quien la desactivó decidió que
        // esa persona no entra, y un enlace por correo lo desharía sin que nadie lo decidiera. Una
        // interna tampoco: su contraseña la restablece el webmaster.
        var roles = await RolesDeUsuario.ObtenerAsync(db, cuenta.Id, ct);
        var motivoSinEnlace = !cuenta.IsActive ? "cuenta_desactivada"
            : !roles.Contains(Permisos.Externo, StringComparer.Ordinal) || roles.Any(rol => rol != Permisos.Externo) ? "cuenta_no_externa"
            : null;
        if (motivoSinEnlace is not null)
        {
            Registros.SinEnlace(registro, motivoSinEnlace, seudonimo);
            return;
        }

        var ahora = DateTime.UtcNow;
        var recientes = await db.RestablecimientosDeContrasena.AsNoTracking()
            .Where(fila => fila.IdUsuario == cuenta.Id && fila.FechaEmision > ahora.AddHours(-1))
            .Select(fila => fila.FechaEmision)
            .ToListAsync(ct);
        if (recientes.Count >= RecuperacionDeContrasena.MaximoPorHora
            || recientes.Any(fecha => fecha > ahora - RecuperacionDeContrasena.EsperaEntreSolicitudes))
        {
            Registros.LimitePorCuenta(registro, seudonimo);
            return;
        }

        var estrategia = db.Database.CreateExecutionStrategy();
        await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);

            // PRIMERO SE INVALIDA EL ENLACE VIVO Y SE GUARDA, y solo después se añade el nuevo: el índice
            // único filtrado admite un solo enlace vivo por cuenta y el motor no ordena los cambios.
            var vivos = await db.RestablecimientosDeContrasena
                .Where(fila => fila.IdUsuario == cuenta.Id && fila.FechaUso == null && fila.FechaInvalidacion == null)
                .ToListAsync(ct);
            foreach (var anterior in vivos) anterior.FechaInvalidacion = ahora;
            await db.SaveChangesAsync(ct);

            var testigo = RecuperacionDeContrasena.NuevoTestigo();
            var fila = new RestablecimientoDeContrasenaRow
            {
                IdUsuario = cuenta.Id,
                HashTestigo = RecuperacionDeContrasena.Resumir(testigo),
                FechaEmision = ahora,
                FechaExpiracion = ahora.Add(RecuperacionDeContrasena.Vigencia),
            };
            db.RestablecimientosDeContrasena.Add(fila);
            await db.SaveChangesAsync(ct);

            // SIN EL NOMBRE DE LA CUENTA: quien registra una cuenta con un correo ajeno escribe el
            // nombre que quiera, y puesto en este mensaje —que llega al buzón del dueño— sería un
            // texto de suplantación dentro de un correo legítimo. El catálogo no lo admite.
            var redactado = CorreosDelSistema.RestablecerContrasena(
                RecuperacionDeContrasena.EnlaceDe(testigo, opcionesDeCorreo.UrlPublica),
                (int)RecuperacionDeContrasena.Vigencia.TotalMinutes);
            await correo.EncolarAsync(
                new CorreoSaliente(cuenta.Email, redactado.Asunto, redactado.Cuerpo, RecuperacionDeContrasena.TipoDeEventoDelEnlace, cuenta.Id),
                ct);

            Auditar(db, cuenta.Id, AccionesAuditoria.Actualizar, new { evento = "restablecimiento_solicitado", vigenciaMinutos = (int)RecuperacionDeContrasena.Vigencia.TotalMinutes }, ahora);
            await db.SaveChangesAsync(ct);
            await transaccion.CommitAsync(ct);
        });
    }

    // ── Comprobar el enlace ────────────────────────────────────────────────────────────────────

    private static async Task<IResult> ComprobarAsync(
        ComprobacionDeEnlaceDeRecuperacion solicitud, SimusDbContext db, CancellationToken ct)
    {
        var (motivo, fila, cuenta) = await ResolverAsync(db, solicitud?.Testigo, DateTime.UtcNow, ct);
        return motivo is null
            ? Results.Ok(new EstadoDelEnlaceDeRecuperacion(true, null, CorreoElectronico.Enmascarar(cuenta!.Email)))
            : Results.Ok(new EstadoDelEnlaceDeRecuperacion(false, motivo, null));
    }

    // ── Restablecer ────────────────────────────────────────────────────────────────────────────

    private static async Task<IResult> RestablecerAsync(
        RestablecimientoDeContrasenaSolicitud solicitud,
        SimusDbContext db,
        IEnviadorDeCorreo correo,
        IAntiforgery antiforgery,
        HttpContext contexto,
        RevalidacionDeSesion revalidacion,
        BloqueoDeIngresoPorCuenta bloqueo,
        ILoggerFactory registros,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, contexto))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var registro = registros.CreateLogger("SIMUS.Autenticacion.Externa");
        var ahora = DateTime.UtcNow;
        var (motivo, fila, cuenta) = await ResolverAsync(db, solicitud?.Testigo, ahora, ct);
        if (motivo is not null)
        {
            Registros.Rechazado(registro, motivo);
            return Results.BadRequest(new { motivo, testigo = MensajeDe(motivo) });
        }

        // LA POLÍTICA DE CONTRASEÑAS ES LA DEL ALTA Y LA DEL CAMBIO. Se valida ANTES de gastar el
        // enlace: una contraseña débil no debe obligar a pedir otro correo.
        var nueva = solicitud!.Nueva ?? string.Empty;
        var error = PoliticaDeContrasena.Error(nueva, cuenta!.Email,
            [cuenta.PrimerNombre, cuenta.SegundoNombre, cuenta.PrimerApellido, cuenta.SegundoApellido, cuenta.FullName]);
        if (error is null && Hasher.VerifyHashedPassword(cuenta, cuenta.PasswordHash, nueva) != PasswordVerificationResult.Failed)
            error = "La contraseña nueva tiene que ser distinta de la actual.";
        if (error is not null)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["nueva"] = [error] });

        var estrategia = db.Database.CreateExecutionStrategy();
        var usado = await estrategia.ExecuteAsync(async () =>
        {
            await using var transaccion = await db.Database.BeginTransactionAsync(ct);

            // UN SOLO USO, TAMBIÉN BAJO CONCURRENCIA: el UPDATE condicionado lo gana una sola petición.
            var id = fila!.Id;
            var marcadas = await db.RestablecimientosDeContrasena
                .Where(item => item.Id == id && item.FechaUso == null && item.FechaInvalidacion == null && item.FechaExpiracion > ahora)
                .ExecuteUpdateAsync(valores => valores.SetProperty(item => item.FechaUso, ahora), ct);
            if (marcadas != 1) return false;

            cuenta.PasswordHash = Hasher.HashPassword(cuenta, nueva);
            cuenta.UpdatedAt = ahora;
            Auditar(db, cuenta.Id, AccionesAuditoria.Actualizar, new { evento = "contrasena_restablecida", sesionesCerradas = true }, ahora);
            var aviso = CorreosDelSistema.ContrasenaCambiada();
            await correo.EncolarAsync(
                new CorreoSaliente(cuenta.Email, aviso.Asunto, aviso.Cuerpo, RecuperacionDeContrasena.TipoDeEventoDelAviso, cuenta.Id),
                ct);
            await db.SaveChangesAsync(ct);
            await transaccion.CommitAsync(ct);
            return true;
        });

        if (!usado)
        {
            Registros.Rechazado(registro, "enlace_usado");
            return Results.BadRequest(new { motivo = "enlace_usado", testigo = TestigoUsado });
        }

        // EL CAMBIO VALE YA: sin esto, una sesión abierta con la contraseña anterior seguiría dentro
        // hasta que caducara la caché de revalidación.
        revalidacion.Invalidar(cuenta.Id);
        // QUIEN RECUPERA SU CLAVE ENTRA DE INMEDIATO: se borran los fallos de ingreso de la cuenta (S-07).
        await bloqueo.LimpiarAsync(BloqueoDeIngresoPorCuenta.CanalExterno, CorreoElectronico.Normalizar(cuenta.Email), ct);
        Registros.Restablecida(registro, cuenta.Id);
        return Results.NoContent();
    }

    /// <summary>
    /// Lo que queda en el registro del servidor. NUNCA el testigo ni la contraseña; el correo, solo
    /// seudonimizado, como en el inicio de sesión.
    /// </summary>
    private static partial class Registros
    {
        [LoggerMessage(EventId = 7101, Level = LogLevel.Information,
            Message = "Recuperación de contraseña sin enlace. Motivo {Motivo}, correo {Correo}")]
        internal static partial void SinEnlace(ILogger registro, string motivo, string? correo);

        [LoggerMessage(EventId = 7102, Level = LogLevel.Warning,
            Message = "Recuperación de contraseña sin enlace. Motivo limite_por_cuenta, correo {Correo}")]
        internal static partial void LimitePorCuenta(ILogger registro, string? correo);

        [LoggerMessage(EventId = 7103, Level = LogLevel.Error,
            Message = "Recuperación de contraseña: falló la solicitud y se contestó igual. Correo {Correo}")]
        internal static partial void Fallo(ILogger registro, Exception excepcion, string? correo);

        [LoggerMessage(EventId = 7104, Level = LogLevel.Warning,
            Message = "Restablecimiento de contraseña rechazado. Motivo {Motivo}")]
        internal static partial void Rechazado(ILogger registro, string motivo);

        [LoggerMessage(EventId = 7105, Level = LogLevel.Information,
            Message = "Contraseña restablecida con enlace. Cuenta {Cuenta}")]
        internal static partial void Restablecida(ILogger registro, int cuenta);
    }

    // ── Compartido ─────────────────────────────────────────────────────────────────────────────

    /// <summary>El motivo por el que el enlace no sirve, o <c>null</c> si sirve (con su fila y su cuenta).</summary>
    private static async Task<(string? Motivo, RestablecimientoDeContrasenaRow? Fila, UserRow? Cuenta)> ResolverAsync(
        SimusDbContext db, string? testigo, DateTime ahora, CancellationToken ct)
    {
        var limpio = testigo?.Trim();
        // Un testigo legítimo son 64 hexadecimales; lo demás ni llega a la base.
        if (string.IsNullOrEmpty(limpio) || limpio.Length != 64) return ("enlace_no_valido", null, null);

        var fila = await db.RestablecimientosDeContrasena.FirstOrDefaultAsync(
            item => item.HashTestigo == RecuperacionDeContrasena.Resumir(limpio), ct);
        if (fila is null) return ("enlace_no_valido", null, null);
        if (fila.FechaUso is not null) return ("enlace_usado", null, null);
        if (fila.FechaInvalidacion is not null) return ("enlace_reemplazado", null, null);
        if (fila.FechaExpiracion <= ahora) return ("enlace_vencido", null, null);

        // La cuenta pudo desactivarse, o cambiar de roles, desde que se emitió el enlace.
        var cuenta = await db.Users.FirstOrDefaultAsync(item => item.Id == fila.IdUsuario, ct);
        if (cuenta is null || !cuenta.IsActive) return ("enlace_no_valido", null, null);
        var roles = await RolesDeUsuario.ObtenerAsync(db, cuenta.Id, ct);
        if (!roles.Contains(Permisos.Externo, StringComparer.Ordinal) || roles.Any(rol => rol != Permisos.Externo))
            return ("enlace_no_valido", null, null);

        return (null, fila, cuenta);
    }

    private static string[] MensajeDe(string motivo) => motivo switch
    {
        "enlace_vencido" => TestigoVencido,
        "enlace_usado" => TestigoUsado,
        "enlace_reemplazado" => TestigoReemplazado,
        _ => TestigoInvalido,
    };

    private static void Auditar(SimusDbContext db, int cuentaId, string accion, object valores, DateTime fecha) =>
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = cuentaId,
            TableName = "Usuarios",
            RecordId = cuentaId.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            NewValuesJson = JsonSerializer.Serialize(valores),
            CreatedAt = fecha,
        });
}
