using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// La cuenta personal del canal externo (docs/desarrollo/19-cuentas-y-organizaciones.md): datos personales y contraseña.
/// </summary>
/// <remarks>
/// <b>SIEMPRE LA PROPIA CUENTA.</b> Ninguna ruta recibe un id: la cuenta sale de la cookie. Así no
/// hay forma de leer ni cambiar los datos de otra persona.
///
/// <b>LOS DATOS SON PRIVADOS.</b> Nombres, documento y teléfono no salen en ninguna ficha pública.
/// El perfil público, con su consentimiento, va aparte.
/// </remarks>
public static class CuentaExternaEndpoints
{
    private static readonly PasswordHasher<UserRow> Hasher = new();

    public static RouteGroupBuilder MapCuentaExternaEndpoints(this RouteGroupBuilder group)
    {
        var cuenta = group.MapGroup("/externo/cuenta").WithTags("externo-cuenta")
            .RequireAuthorization(SimusAuthentication.ExternalPolicy);

        cuenta.MapGet("/perfil", ObtenerPerfilAsync).WithName("PerfilDeCuentaExterna");
        cuenta.MapPut("/perfil", ActualizarPerfilAsync).WithName("ActualizarPerfilDeCuentaExterna");
        // «MIS ORGANIZACIONES» DEL ESPACIO PERSONA: las invitaciones que esperan a esta
        // cuenta. Solo lectura: se aceptan con el enlace, que es el secreto.
        cuenta.MapGet("/invitaciones", InvitacionesPendientesAsync).WithName("InvitacionesPendientesDeLaCuenta");
        // CON LIMITE DE INTENTOS: pide la contraseña actual, y sin límite serviría para adivinarla.
        cuenta.MapPost("/contrasena", CambiarContrasenaAsync)
            .WithName("CambiarContrasenaDeCuentaExterna")
            .RequireRateLimiting("external-login");
        return group;
    }

    private static async Task<IResult> ObtenerPerfilAsync(ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();
        return Results.Ok(await PerfilAsync(usuario, db, ct));
    }

    private static async Task<IResult> ActualizarPerfilAsync(
        PerfilDeCuentaExternaSolicitud solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, httpContext))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();

        var errores = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var primerNombre = Limpio(solicitud.PrimerNombre, 80);
        var primerApellido = Limpio(solicitud.PrimerApellido, 80);
        var tipo = (solicitud.TipoDocumento ?? string.Empty).Trim().ToLowerInvariant();
        var numero = AltaDeOrganizacion.NormalizarDocumento(solicitud.NumeroDocumento ?? string.Empty);
        var telefono = Limpio(solicitud.Telefono, 80);

        if (primerNombre is null) errores["primerNombre"] = ["Escribe el primer nombre."];
        if (primerApellido is null) errores["primerApellido"] = ["Escribe el primer apellido."];
        if (!ExternalOrganizationEndpoints.TiposDeDocumento.ContainsKey(tipo)) errores["tipoDocumento"] = ["Elige un tipo de documento del catálogo."];
        if (numero.Length is < 6 or > 15) errores["numeroDocumento"] = ["El número de documento debe tener entre 6 y 15 dígitos."];
        if (telefono is not null && !ValidationHelpers.IsValidPhone(telefono))
            errores["telefono"] = [ValidationHelpers.MensajeDeTelefono];
        // RESIDENCIA Y CANAL (docs/desarrollo/19-cuentas-y-organizaciones.md §19.14): opcionales, privados y del catálogo; vacío los borra.
        var residenciaDepartamento = Limpio(solicitud.ResidenciaCodigoDepartamento, 2);
        var residenciaMunicipio = Limpio(solicitud.ResidenciaCodigoMunicipio, 5);
        var canal = Limpio(solicitud.CanalDeContactoPreferido, 10)?.ToLowerInvariant();
        if (residenciaMunicipio is not null && residenciaDepartamento is null)
            errores["residenciaCodigoDepartamento"] = ["Elige el departamento de residencia."];
        else if (residenciaDepartamento is not null
            && !await db.DivipolaLocations.AsNoTracking().AnyAsync(d => d.DepartmentCode == residenciaDepartamento, ct))
            errores["residenciaCodigoDepartamento"] = ["Ese departamento no existe en el catálogo oficial."];
        else if (residenciaMunicipio is not null
            && !await db.DivipolaLocations.AsNoTracking().AnyAsync(d => d.DepartmentCode == residenciaDepartamento && d.MunicipalityCode == residenciaMunicipio, ct))
            errores["residenciaCodigoMunicipio"] = ["Ese municipio no existe en el catálogo oficial o no pertenece al departamento elegido."];
        if (canal is not null && canal is not ("correo" or "telefono"))
            errores["canalDeContactoPreferido"] = ["Elige correo o teléfono."];
        if (canal == "telefono" && telefono is null)
            errores["canalDeContactoPreferido"] = ["Para preferir el teléfono, escribe tu número."];
        if (errores.Count == 0 && await ExternalAuthEndpoints.DocumentoEnUsoAsync(db, tipo, numero, usuario.Id, ct))
            errores["numeroDocumento"] = ["Ese documento ya está registrado en otra cuenta."];
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        usuario.PrimerNombre = primerNombre;
        usuario.SegundoNombre = Limpio(solicitud.SegundoNombre, 80);
        usuario.PrimerApellido = primerApellido;
        usuario.SegundoApellido = Limpio(solicitud.SegundoApellido, 80);
        usuario.CodigoTipoDocumento = tipo;
        usuario.Identificacion = numero;
        usuario.Telefono = telefono;
        usuario.ResidenciaCodigoDepartamento = residenciaDepartamento;
        usuario.ResidenciaCodigoMunicipio = residenciaMunicipio;
        usuario.CanalDeContactoPreferido = canal;
        usuario.FullName = ValidationHelpers.SanitizeText(string.Join(' ',
            new[] { usuario.PrimerNombre, usuario.SegundoNombre, usuario.PrimerApellido, usuario.SegundoApellido }
                .Where(parte => !string.IsNullOrWhiteSpace(parte))), 180);
        usuario.UpdatedAt = DateTime.UtcNow;
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = usuario.Id,
            TableName = "Usuarios",
            RecordId = usuario.Id.ToString(CultureInfo.InvariantCulture),
            Action = AccionesAuditoria.Actualizar,
            CreatedAt = usuario.UpdatedAt ?? DateTime.UtcNow,
        });
        await db.SaveChangesAsync(ct);

        return Results.Ok(await PerfilAsync(usuario, db, ct));
    }

    private static async Task<IResult> CambiarContrasenaAsync(
        CambioDeContrasenaExternaSolicitud solicitud,
        ClaimsPrincipal principal,
        SimusDbContext db,
        IAntiforgery antiforgery,
        HttpContext httpContext,
        RevalidacionDeSesion revalidacion,
        CancellationToken ct)
    {
        if (!await TestigoDePeticion.ValidoAsync(antiforgery, httpContext))
            return Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo de nuevo." });

        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();

        // LA ACTUAL SE COMPRUEBA AUNQUE HAYA SESION: una sesión abierta en un equipo prestado no
        // basta para cambiar la contraseña.
        if (Hasher.VerifyHashedPassword(usuario, usuario.PasswordHash, solicitud.Actual ?? string.Empty) == PasswordVerificationResult.Failed)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["actual"] = ["La contraseña actual no es la correcta."] });

        var nueva = solicitud.Nueva ?? string.Empty;
        var error = PoliticaDeContrasena.Error(nueva, usuario.Email,
            [usuario.PrimerNombre, usuario.SegundoNombre, usuario.PrimerApellido, usuario.SegundoApellido, usuario.FullName]);
        if (error is null && Hasher.VerifyHashedPassword(usuario, usuario.PasswordHash, nueva) != PasswordVerificationResult.Failed)
            error = "La contraseña nueva tiene que ser distinta de la actual.";
        if (error is not null)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["nueva"] = [error] });

        var ahora = DateTime.UtcNow;
        usuario.PasswordHash = Hasher.HashPassword(usuario, nueva);
        usuario.UpdatedAt = ahora;
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = usuario.Id,
            TableName = "Usuarios",
            RecordId = usuario.Id.ToString(CultureInfo.InvariantCulture),
            // «actualizar» y no «cambiar_contrasena»: CK_BitacoraAuditoria_Accion admite trece verbos y
            // ese no es uno (SQL Server lo rechazaba; SQLite no lo ve). El evento viaja en el JSON.
            Action = AccionesAuditoria.Actualizar,
            NewValuesJson = System.Text.Json.JsonSerializer.Serialize(new { evento = "contrasena_cambiada", sesionesCerradas = true }),
            CreatedAt = ahora,
        });
        await db.SaveChangesAsync(ct);

        // LAS DEMAS SESIONES SE CIERRAN: llevan el sello de la contraseña anterior y dejan de
        // coincidir en cuanto se borra lo que la revalidación tenía guardado. Esta se vuelve a
        // firmar con el sello nuevo para que quien la cambió siga dentro.
        revalidacion.Invalidar(usuario.Id);
        // CONSERVA EL INICIO DE LA SESION: re-firmar no regala otro tope absoluto (S-11).
        var sesionActual = await httpContext.AuthenticateAsync(SimusAuthentication.ExternalScheme);
        await httpContext.SignInAsync(
            SimusAuthentication.ExternalScheme,
            ExternalAuthEndpoints.BuildExternalPrincipal(usuario),
            VidaDeLaSesion.Propiedades(persistente: true, VidaDeLaSesion.InicioDe(sesionActual.Properties)));

        return Results.NoContent();
    }

    /// <summary>
    /// Las invitaciones pendientes y vigentes dirigidas al correo de la cuenta.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>SIN EL TESTIGO.</b> Esta lista dice que alguien te espera, no deja entrar: la invitación se
    /// sigue aceptando con su enlace, que es lo único que demuestra que se recibió (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4).
    /// </para>
    /// <para>
    /// <b>CON EL CORREO SIN CONFIRMAR NO SE ENTREGA</b> cuando la política lo exige: cualquiera puede
    /// registrar una cuenta con un correo ajeno, y así no sabría a qué organizaciones se invitó a su
    /// dueño. En modo demo la confirmación está dispensada y la lista sí sale.
    /// </para>
    /// </remarks>
    private static async Task<IResult> InvitacionesPendientesAsync(
        ClaimsPrincipal principal, SimusDbContext db, PoliticaDeConfirmacionDeCorreo politica, CancellationToken ct)
    {
        var usuario = await CuentaAsync(principal, db, ct);
        if (usuario is null) return Results.Unauthorized();
        if (politica.ConfirmacionObligatoria && !usuario.CorreoConfirmado)
            return Results.Ok(new InvitacionesDeLaCuentaDto(true, []));

        var correo = CorreoElectronico.Normalizar(usuario.Email);
        if (correo is null) return Results.Ok(new InvitacionesDeLaCuentaDto(false, []));

        var ahora = DateTime.UtcNow;
        var filas = await db.InvitacionesDeOrganizacion.AsNoTracking()
            .Where(i => i.CorreoInvitado == correo && i.Estado == EstadosDeInvitacion.Pendiente && i.FechaExpiracion > ahora)
            .Join(db.EntityProfiles.AsNoTracking().Where(e => e.IsActive && e.EntityType == AdministracionDeOrganizacion.TipoOrganizacion),
                i => i.IdEntidad, e => e.Id,
                (i, e) => new { i.Id, i.IdEntidad, e.Name, i.RolEntidad, i.FechaExpiracion })
            .OrderBy(f => f.FechaExpiracion)
            .ToListAsync(ct);

        // Las organizaciones de las que ya es miembro no se ofrecen: aceptar ahí no cambia nada.
        var propias = await db.UserEntities.AsNoTracking()
            .Where(v => v.UserId == usuario.Id && v.IsActive)
            .Select(v => v.EntityId)
            .ToListAsync(ct);

        return Results.Ok(new InvitacionesDeLaCuentaDto(false, filas
            .Where(f => !propias.Contains(f.IdEntidad))
            .Select(f => new InvitacionPendienteDeLaCuentaDto(
                f.Id.ToString(CultureInfo.InvariantCulture), f.IdEntidad.ToString(CultureInfo.InvariantCulture),
                f.Name, f.RolEntidad, f.FechaExpiracion))
            .ToList()));
    }

    private static async Task<UserRow?> CuentaAsync(ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            return null;
        return await db.Users.FirstOrDefaultAsync(usuario => usuario.Id == id && usuario.IsActive, ct);
    }

    /// <summary>
    /// Los datos de la cuenta. Una cuenta de organización registrada antes de los tiene solo
    /// como persona responsable de su organización: se proponen desde ahí hasta que los guarde.
    /// </summary>
    private static async Task<PerfilDeCuentaExternaDto> PerfilAsync(UserRow usuario, SimusDbContext db, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(usuario.PrimerNombre) && string.IsNullOrWhiteSpace(usuario.Identificacion))
        {
            var responsable = await db.EntidadesResponsable.AsNoTracking()
                .Where(fila => db.UserEntities.Any(vinculo => vinculo.UserId == usuario.Id && vinculo.EntityId == fila.IdEntidad && vinculo.IsActive))
                .OrderBy(fila => fila.IdEntidad)
                .FirstOrDefaultAsync(ct);
            if (responsable is not null)
                return new PerfilDeCuentaExternaDto(
                    usuario.Email, usuario.ProfileType ?? "organizacion",
                    responsable.ResponsablePrimerNombre ?? string.Empty, responsable.ResponsableSegundoNombre,
                    responsable.ResponsablePrimerApellido ?? string.Empty, responsable.ResponsableSegundoApellido,
                    (responsable.ResponsableTipoDocumento ?? string.Empty).Trim().ToLowerInvariant(), responsable.ResponsableNumeroDocumento ?? string.Empty,
                    responsable.ResponsableTelefono,
                    usuario.ResidenciaCodigoDepartamento?.Trim(), usuario.ResidenciaCodigoMunicipio?.Trim(), usuario.CanalDeContactoPreferido);
        }

        return new PerfilDeCuentaExternaDto(
            usuario.Email, usuario.ProfileType ?? "organizacion",
            usuario.PrimerNombre ?? string.Empty, usuario.SegundoNombre,
            usuario.PrimerApellido ?? string.Empty, usuario.SegundoApellido,
            // EN MINÚSCULA: el alta heredada guardó «CC» y el desplegable solo conoce «cc»;
            // sin esto «Cuenta y seguridad» mostraba el tipo de documento vacío.
            (usuario.CodigoTipoDocumento ?? string.Empty).Trim().ToLowerInvariant(), usuario.Identificacion ?? string.Empty,
            usuario.Telefono,
            usuario.ResidenciaCodigoDepartamento?.Trim(), usuario.ResidenciaCodigoMunicipio?.Trim(), usuario.CanalDeContactoPreferido);
    }

    private static string? Limpio(string? valor, int largo) =>
        string.IsNullOrWhiteSpace(valor) ? null : ValidationHelpers.SanitizeText(valor.Trim(), largo);
}
