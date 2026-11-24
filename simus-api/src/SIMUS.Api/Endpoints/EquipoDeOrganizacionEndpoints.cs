using System.Globalization;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using SIMUS.Api.Historial;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;

namespace SIMUS.Api.Endpoints;

/// <summary>
/// El equipo de una organización: miembros, roles, invitaciones y salida (<c>docs/desarrollo/19-cuentas-y-organizaciones.md</c> §19.3–§19.4).
/// </summary>
/// <remarks>
/// <para>
/// <b>QUIÉN PUEDE QUÉ.</b> Ver el equipo, administrador o editor. Invitar, revocar, cambiar roles y
/// quitar, solo administrador. Salir (quitarse a uno mismo), cualquiera de los dos. Todo pasa por la
/// regla del último administrador: ninguna operación deja una organización activa sin administradores.
/// </para>
/// <para>
/// <b>LA INVITACIÓN ES UN ENLACE.</b> Testigo aleatorio de 32 bytes; en la base solo queda su resumen
/// SHA-256 (como <c>ConfirmacionesDeCorreo</c>). Un solo uso, siete días, una pendiente por correo y
/// organización. El panel recibe el enlace en la respuesta de la creación para copiarlo —en modo demo
/// el correo no sale—, y además se encola en <see cref="IEnviadorDeCorreo"/>, que es la cola de salida.
/// </para>
/// <para>
/// <b>CADA CAMBIO QUEDA EN LA BITÁCORA</b> con uno de los verbos que admite
/// <c>CK_BitacoraAuditoria_Accion</c>; el nombre del evento viaja en <c>ValoresNuevos</c>.
/// </para>
/// </remarks>
public static class EquipoDeOrganizacionEndpoints
{
    internal static readonly TimeSpan Vigencia = TimeSpan.FromDays(7);
    internal const string TipoDeEvento = "InvitacionAOrganizacion";

    public static RouteGroupBuilder MapEquipoDeOrganizacionEndpoints(this RouteGroupBuilder api)
    {
        var equipo = api.MapGroup("/externo/organizaciones/{organizacionId:int}/equipo")
            .WithTags("equipo-de-organizacion");
        equipo.RequireAuthorization(SimusAuthentication.ExternalPolicy);

        equipo.MapGet(string.Empty, VerAsync).WithName("EquipoDeLaOrganizacion");
        equipo.MapPost("/invitaciones", InvitarAsync).WithName("InvitarAOrganizacion");
        equipo.MapDelete("/invitaciones/{invitacionId:int}", RevocarAsync).WithName("RevocarInvitacionAOrganizacion");
        // «GENERAR UN ENLACE NUEVO». De la invitación solo se guarda el resumen del testigo,
        // así que el enlace de una pendiente no se puede volver a mostrar: se emite otro y el anterior
        // deja de servir.
        equipo.MapPost("/invitaciones/{invitacionId:int}/enlace-nuevo", NuevoEnlaceAsync).WithName("NuevoEnlaceDeInvitacion");
        equipo.MapPut("/miembros/{usuarioId:int}", CambiarRolAsync).WithName("CambiarRolEnOrganizacion");
        equipo.MapDelete("/miembros/{usuarioId:int}", QuitarAsync).WithName("QuitarDeOrganizacion");

        var invitaciones = api.MapGroup("/externo/invitaciones").WithTags("equipo-de-organizacion");
        // Se consulta sin sesión: quien abre el enlace todavía puede no tener cuenta. El testigo es el
        // secreto y viaja en el cuerpo, no en la URL (historial, Referer), como la confirmación de
        // correo; la respuesta no incluye nada que no diga ya la propia invitación.
        invitaciones.MapPost("/consultar", ConsultarInvitacionAsync).AllowAnonymous().WithName("ConsultarInvitacionAOrganizacion");
        invitaciones.MapPost("/aceptar", AceptarAsync)
            .RequireAuthorization(SimusAuthentication.ExternalPolicy)
            .WithName("AceptarInvitacionAOrganizacion");

        return api;
    }

    // ── Ver ─────────────────────────────────────────────────────────────────────────────────

    private static async Task<IResult> VerAsync(
        int organizacionId, System.Security.Claims.ClaimsPrincipal principal, SimusDbContext db, CancellationToken ct)
    {
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        var administra = await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacionId, ct);

        var miembros = await db.UserEntities.AsNoTracking()
            .Where(v => v.EntityId == organizacionId && v.IsActive && RolesDeEntidad.Miembros.Contains(v.EntityRole))
            .Join(db.Users.AsNoTracking(), v => v.UserId, u => u.Id,
                (v, u) => new { u.Id, u.FullName, u.Email, v.EntityRole, v.CreatedAt, u.IsActive })
            .OrderBy(f => f.FullName)
            .ToListAsync(ct);

        var invitaciones = new List<InvitacionDeOrganizacionDto>();
        if (administra)
        {
            var ahora = DateTime.UtcNow;
            var filas = await db.InvitacionesDeOrganizacion.AsNoTracking()
                .Where(i => i.IdEntidad == organizacionId && i.Estado == EstadosDeInvitacion.Pendiente)
                .OrderBy(i => i.FechaEmision)
                .ToListAsync(ct);
            invitaciones = filas.Select(i => ADto(i, ahora, enlace: null)).ToList();
        }

        return Results.Ok(new EquipoDeOrganizacionDto(
            organizacionId.ToString(CultureInfo.InvariantCulture),
            administra,
            miembros.Select(m => new MiembroDeOrganizacionDto(
                m.Id.ToString(CultureInfo.InvariantCulture), m.FullName, m.Email, m.EntityRole, m.CreatedAt,
                m.Id == persona.Value, m.IsActive)).ToList(),
            invitaciones));
    }

    // ── Invitar y revocar ───────────────────────────────────────────────────────────────────

    private static async Task<IResult> InvitarAsync(
        int organizacionId, InvitarAOrganizacionSolicitud solicitud, System.Security.Claims.ClaimsPrincipal principal,
        SimusDbContext db, IEnviadorDeCorreo correo, IAntiforgery antiforgery, HttpContext contexto, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto)) return Rechazo();
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        var errores = new Dictionary<string, string[]>();
        var direccion = CorreoElectronico.Normalizar(solicitud.Correo) ?? string.Empty;
        if (!EsCorreoValido(direccion)) errores["correo"] = ["Escribe un correo válido."];
        if (!RolesDeEntidad.EsValido(solicitud.Rol)) errores["rol"] = ["El rol tiene que ser «administrador» o «editor»."];
        if (errores.Count > 0) return Results.ValidationProblem(errores);

        var yaEsMiembro = await db.UserEntities.AsNoTracking()
            .Where(v => v.EntityId == organizacionId && v.IsActive && RolesDeEntidad.Miembros.Contains(v.EntityRole))
            .Join(db.Users.AsNoTracking(), v => v.UserId, u => u.Id, (_, u) => u.Email.ToLower())
            .AnyAsync(e => e == direccion, ct);
        if (yaEsMiembro)
            return Results.Conflict(new { motivo = "ya_es_miembro", message = "Esa persona ya forma parte del equipo." });

        var ahora = DateTime.UtcNow;
        var pendiente = await db.InvitacionesDeOrganizacion
            .FirstOrDefaultAsync(i => i.IdEntidad == organizacionId && i.CorreoInvitado == direccion
                && i.Estado == EstadosDeInvitacion.Pendiente, ct);
        if (pendiente is not null)
        {
            if (pendiente.FechaExpiracion > ahora)
                return Results.Conflict(new
                {
                    motivo = "invitacion_pendiente",
                    message = "Ya hay una invitación pendiente para ese correo. Revócala si quieres enviar otra.",
                });
            pendiente.Estado = EstadosDeInvitacion.Vencida;
            pendiente.FechaCierre = ahora;
            await db.SaveChangesAsync(ct);
        }

        var organizacion = await db.EntityProfiles.AsNoTracking()
            .Where(e => e.Id == organizacionId).Select(e => e.Name).FirstAsync(ct);
        var testigo = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var fila = new InvitacionDeOrganizacionRow
        {
            IdEntidad = organizacionId,
            CorreoInvitado = direccion,
            RolEntidad = solicitud.Rol!,
            HashTestigo = Resumir(testigo),
            Estado = EstadosDeInvitacion.Pendiente,
            IdUsuarioInvita = persona.Value,
            FechaEmision = ahora,
            FechaExpiracion = ahora.Add(Vigencia),
        };
        db.InvitacionesDeOrganizacion.Add(fila);
        await db.SaveChangesAsync(ct);

        var enlace = RutaDeInvitacion(testigo);
        var redactado = CorreosDelSistema.InvitacionAEquipo(
            organizacion, Etiqueta(fila.RolEntidad), await NombreDeAsync(db, persona.Value, ct), enlace, (int)Vigencia.TotalDays);
        await correo.EncolarAsync(new CorreoSaliente(direccion, redactado.Asunto, redactado.Cuerpo, TipoDeEvento), ct);

        Auditar(db, persona.Value, "InvitacionesDeOrganizacion", fila.Id, AccionesAuditoria.Crear, new
        {
            Evento = "invitacion_creada", OrganizacionId = organizacionId, Correo = direccion, Rol = fila.RolEntidad,
        }, ahora);
        await db.SaveChangesAsync(ct);

        return Results.Created(
            $"/api/v1/externo/organizaciones/{organizacionId}/equipo/invitaciones/{fila.Id}",
            ADto(fila, ahora, enlace));
    }

    private static async Task<IResult> RevocarAsync(
        int organizacionId, int invitacionId, System.Security.Claims.ClaimsPrincipal principal,
        SimusDbContext db, IAntiforgery antiforgery, HttpContext contexto, CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto)) return Rechazo();
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        // Se busca por organización Y por id: el id de otra organización responde 404, no la revoca.
        var fila = await db.InvitacionesDeOrganizacion
            .FirstOrDefaultAsync(i => i.Id == invitacionId && i.IdEntidad == organizacionId, ct);
        if (fila is null) return Results.NotFound();
        if (fila.Estado != EstadosDeInvitacion.Pendiente)
            return Results.Conflict(new { motivo = "invitacion_cerrada", message = "La invitación ya no está pendiente." });

        var ahora = DateTime.UtcNow;
        fila.Estado = EstadosDeInvitacion.Revocada;
        fila.FechaCierre = ahora;
        Auditar(db, persona.Value, "InvitacionesDeOrganizacion", fila.Id, AccionesAuditoria.Actualizar, new
        {
            Evento = "invitacion_revocada", OrganizacionId = organizacionId, Correo = fila.CorreoInvitado,
        }, ahora);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    /// <summary>
    /// Emite otro enlace para una invitación que sigue pendiente: el testigo se cambia en la misma fila,
    /// la vigencia vuelve a empezar y el enlace anterior deja de servir. Se encola otra vez el correo.
    /// </summary>
    private static async Task<IResult> NuevoEnlaceAsync(
        int organizacionId, int invitacionId, System.Security.Claims.ClaimsPrincipal principal,
        SimusDbContext db, IEnviadorDeCorreo correo, IAntiforgery antiforgery, HttpContext contexto, CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto)) return Rechazo();
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();

        // Por organización Y por id, como al revocar: el id de otra organización responde 404.
        var fila = await db.InvitacionesDeOrganizacion
            .FirstOrDefaultAsync(i => i.Id == invitacionId && i.IdEntidad == organizacionId, ct);
        if (fila is null) return Results.NotFound();
        if (fila.Estado != EstadosDeInvitacion.Pendiente)
            return Results.Conflict(new { motivo = "invitacion_cerrada", message = "La invitación ya no está pendiente." });

        var ahora = DateTime.UtcNow;
        var organizacion = await db.EntityProfiles.AsNoTracking()
            .Where(e => e.Id == organizacionId).Select(e => e.Name).FirstAsync(ct);
        var testigo = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        fila.HashTestigo = Resumir(testigo);
        fila.FechaEmision = ahora;
        fila.FechaExpiracion = ahora.Add(Vigencia);

        var enlace = RutaDeInvitacion(testigo);
        var redactado = CorreosDelSistema.InvitacionAEquipo(
            organizacion, Etiqueta(fila.RolEntidad), await NombreDeAsync(db, persona.Value, ct), enlace, (int)Vigencia.TotalDays);
        await correo.EncolarAsync(new CorreoSaliente(fila.CorreoInvitado, redactado.Asunto, redactado.Cuerpo, TipoDeEvento), ct);

        Auditar(db, persona.Value, "InvitacionesDeOrganizacion", fila.Id, AccionesAuditoria.Actualizar, new
        {
            Evento = "invitacion_enlace_nuevo", OrganizacionId = organizacionId, Correo = fila.CorreoInvitado,
        }, ahora);
        await db.SaveChangesAsync(ct);

        return Results.Ok(ADto(fila, ahora, enlace));
    }

    // ── Cambiar rol, quitar y salir ─────────────────────────────────────────────────────────

    private static async Task<IResult> CambiarRolAsync(
        int organizacionId, int usuarioId, CambiarRolEnOrganizacionSolicitud solicitud,
        System.Security.Claims.ClaimsPrincipal principal, SimusDbContext db, IAntiforgery antiforgery,
        HttpContext contexto, RevalidacionDeSesion revalidacion, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto)) return Rechazo();
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();
        if (!await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacionId, ct)) return Results.Forbid();
        if (!RolesDeEntidad.EsValido(solicitud.Rol))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["rol"] = ["El rol tiene que ser «administrador» o «editor»."] });

        var vinculo = await VinculoAsync(db, organizacionId, usuarioId, ct);
        if (vinculo is null) return Results.NotFound();
        if (vinculo.EntityRole == solicitud.Rol) return Results.NoContent();

        if (RolesDeEntidad.Responde(vinculo.EntityRole) && !RolesDeEntidad.Responde(solicitud.Rol)
            && await DejariaSinAdministradoresAsync(db, organizacionId, usuarioId, ct))
            return AdministracionDeOrganizacion.ConflictoDelUltimoAdministrador();

        var antes = vinculo.EntityRole;
        vinculo.EntityRole = solicitud.Rol!;
        var ahora = DateTime.UtcNow;
        Auditar(db, persona.Value, "UsuariosEntidades", vinculo.Id, AccionesAuditoria.Actualizar, new
        {
            Evento = "rol_cambiado", OrganizacionId = organizacionId, UsuarioId = usuarioId, Antes = antes, Despues = vinculo.EntityRole,
        }, ahora);
        await CambiosDeMembresia.RegistrarAsync(db, organizacionId, persona.Value, usuarioId, antes, vinculo.EntityRole, ct);
        await db.SaveChangesAsync(ct);
        revalidacion.Invalidar(usuarioId);
        return Results.NoContent();
    }

    private static async Task<IResult> QuitarAsync(
        int organizacionId, int usuarioId, System.Security.Claims.ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext contexto, RevalidacionDeSesion revalidacion, CancellationToken ct)
    {
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto)) return Rechazo();
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        var saliendo = persona.Value == usuarioId;
        // Salir lo puede cualquier miembro; quitar a otra persona, solo quien administra.
        var permitido = saliendo
            ? await AdministracionDeOrganizacion.PuedeEditarAsync(db, persona.Value, organizacionId, ct)
            : await AdministracionDeOrganizacion.PuedeAdministrarAsync(db, persona.Value, organizacionId, ct);
        if (!permitido) return Results.Forbid();

        var vinculo = await VinculoAsync(db, organizacionId, usuarioId, ct);
        if (vinculo is null) return Results.NotFound();

        if (RolesDeEntidad.Responde(vinculo.EntityRole)
            && await DejariaSinAdministradoresAsync(db, organizacionId, usuarioId, ct))
            return AdministracionDeOrganizacion.ConflictoDelUltimoAdministrador();

        // Se desactiva, no se borra: la bitácora y los registros nombran el vínculo.
        vinculo.IsActive = false;
        var ahora = DateTime.UtcNow;
        Auditar(db, persona.Value, "UsuariosEntidades", vinculo.Id, AccionesAuditoria.Eliminar, new
        {
            Evento = saliendo ? "miembro_salio" : "miembro_quitado", OrganizacionId = organizacionId, UsuarioId = usuarioId, Rol = vinculo.EntityRole,
        }, ahora);
        await CambiosDeMembresia.RegistrarAsync(db, organizacionId, persona.Value, usuarioId, vinculo.EntityRole, null, ct);
        await db.SaveChangesAsync(ct);
        revalidacion.Invalidar(usuarioId);
        return Results.NoContent();
    }

    // ── Aceptar ─────────────────────────────────────────────────────────────────────────────

    private static async Task<IResult> ConsultarInvitacionAsync(AceptarInvitacionSolicitud solicitud, SimusDbContext db, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        var (fila, estado) = await ResolverAsync(db, solicitud.Testigo, DateTime.UtcNow, ct);
        if (fila is null) return Results.NotFound(new { estado });
        var organizacion = await db.EntityProfiles.AsNoTracking()
            .Where(e => e.Id == fila.IdEntidad).Select(e => e.Name).FirstOrDefaultAsync(ct);
        // ENMASCARADO (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4): esta consulta es anónima y basta tener el enlace. Dice
        // a qué cuenta va la invitación sin entregar la dirección completa a un enlace reenviado.
        return Results.Ok(new InvitacionAbiertaDto(organizacion ?? string.Empty, fila.RolEntidad, CorreoElectronico.Enmascarar(fila.CorreoInvitado), estado, fila.FechaExpiracion));
    }

    private static async Task<IResult> AceptarAsync(
        AceptarInvitacionSolicitud solicitud, System.Security.Claims.ClaimsPrincipal principal, SimusDbContext db,
        IAntiforgery antiforgery, HttpContext contexto, RevalidacionDeSesion revalidacion, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(solicitud);
        if (!await SesionExterna.VieneDeNuestraPaginaAsync(antiforgery, contexto)) return Rechazo();
        var persona = SesionExterna.PersonaDe(principal);
        if (persona is null) return Results.Unauthorized();

        var ahora = DateTime.UtcNow;
        var (fila, estado) = await ResolverAsync(db, solicitud.Testigo, ahora, ct, seguimiento: true);
        if (fila is null) return Results.NotFound(new { estado, message = "El enlace de invitación no existe." });
        if (estado != EstadosDeInvitacion.Pendiente)
        {
            if (estado == EstadosDeInvitacion.Vencida && fila.Estado == EstadosDeInvitacion.Pendiente)
            {
                fila.Estado = EstadosDeInvitacion.Vencida;
                fila.FechaCierre = ahora;
                await db.SaveChangesAsync(ct);
            }
            return Results.Conflict(new { estado, message = MensajeDeEstado(estado) });
        }

        var organizacionActiva = await db.EntityProfiles.AsNoTracking()
            .AnyAsync(e => e.Id == fila.IdEntidad && e.IsActive && e.EntityType == AdministracionDeOrganizacion.TipoOrganizacion, ct);
        if (!organizacionActiva) return Results.Conflict(new { estado = "organizacion_inactiva", message = "La organización ya no está activa." });

        var cuenta = await db.Users.AsNoTracking().FirstAsync(u => u.Id == persona.Value, ct);

        // SOLO LA CUENTA INVITADA (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4 v1.1). Un enlace reenviado o filtrado daba
        // acceso a la organización a otra persona sin que el administrador lo notara. La comparación
        // es la normalizada con la que se guardan los dos correos.
        if (!string.Equals(CorreoElectronico.Normalizar(cuenta.Email), CorreoElectronico.Normalizar(fila.CorreoInvitado), StringComparison.Ordinal))
        {
            var destino = CorreoElectronico.Enmascarar(fila.CorreoInvitado);
            return Results.Conflict(new
            {
                estado = "correo_distinto",
                correoInvitado = destino,
                message = $"Esta invitación se envió a {destino} y solo puede aceptarla la cuenta con ese correo. "
                    + "Cierra la sesión y entra con esa cuenta, o créala con ese correo si todavía no la tienes.",
            });
        }
        var vinculos = await db.UserEntities
            .Where(v => v.UserId == persona.Value && v.EntityId == fila.IdEntidad)
            .ToListAsync(ct);
        if (vinculos.Any(v => v.IsActive && RolesDeEntidad.EsValido(v.EntityRole)))
            return Results.Conflict(new { estado = "ya_es_miembro", message = "Tu cuenta ya forma parte de esta organización." });

        // Si hubo un vínculo anterior (alguien que salió), se reactiva con el rol nuevo: la clave
        // única (IdUsuario, IdEntidad, RolEntidad) no admite dos filas iguales.
        var vinculo = vinculos.FirstOrDefault(v => v.EntityRole == fila.RolEntidad) ?? vinculos.FirstOrDefault();
        if (vinculo is null)
        {
            vinculo = new UserEntityRow { UserId = persona.Value, EntityId = fila.IdEntidad, CreatedAt = ahora };
            db.UserEntities.Add(vinculo);
        }
        var rolAnteriorDelVinculo = vinculo.IsActive ? vinculo.EntityRole : null;
        vinculo.EntityRole = fila.RolEntidad;
        vinculo.IsActive = true;
        await CambiosDeMembresia.RegistrarAsync(db, fila.IdEntidad, persona.Value, persona.Value, rolAnteriorDelVinculo, fila.RolEntidad, ct);

        fila.Estado = EstadosDeInvitacion.Aceptada;
        fila.IdUsuarioAcepta = persona.Value;
        fila.FechaCierre = ahora;
        await db.SaveChangesAsync(ct);

        // La bitácora guarda los dos correos, el invitado y el de la cuenta (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4).
        Auditar(db, persona.Value, "UsuariosEntidades", vinculo.Id, AccionesAuditoria.Crear, new
        {
            Evento = "invitacion_aceptada", OrganizacionId = fila.IdEntidad, InvitacionId = fila.Id,
            CorreoInvitado = fila.CorreoInvitado, CorreoDeLaCuenta = cuenta.Email, Rol = fila.RolEntidad,
        }, ahora);
        await db.SaveChangesAsync(ct);
        revalidacion.Invalidar(persona.Value);

        return Results.Ok(new { organizacionId = fila.IdEntidad.ToString(CultureInfo.InvariantCulture), rol = fila.RolEntidad });
    }

    // ── Ayudantes ───────────────────────────────────────────────────────────────────────────

    private static async Task<(InvitacionDeOrganizacionRow? Fila, string Estado)> ResolverAsync(
        SimusDbContext db, string? testigo, DateTime ahora, CancellationToken ct, bool seguimiento = false)
    {
        if (string.IsNullOrWhiteSpace(testigo)) return (null, "no_existe");
        var resumen = Resumir(testigo.Trim());
        var consulta = seguimiento ? db.InvitacionesDeOrganizacion : db.InvitacionesDeOrganizacion.AsNoTracking();
        var fila = await consulta.FirstOrDefaultAsync(i => i.HashTestigo == resumen, ct);
        if (fila is null) return (null, "no_existe");
        if (fila.Estado == EstadosDeInvitacion.Pendiente && fila.FechaExpiracion <= ahora)
            return (fila, EstadosDeInvitacion.Vencida);
        return (fila, fila.Estado);
    }

    private static Task<UserEntityRow?> VinculoAsync(SimusDbContext db, int organizacionId, int usuarioId, CancellationToken ct) =>
        db.UserEntities.FirstOrDefaultAsync(v => v.EntityId == organizacionId && v.UserId == usuarioId
            && v.IsActive && RolesDeEntidad.Miembros.Contains(v.EntityRole), ct);

    /// <summary>Si, sin esta persona como administradora, no quedaría ninguna activa.</summary>
    private static async Task<bool> DejariaSinAdministradoresAsync(
        SimusDbContext db, int organizacionId, int usuarioId, CancellationToken ct)
    {
        var activa = await db.EntityProfiles.AsNoTracking().AnyAsync(e => e.Id == organizacionId && e.IsActive, ct);
        if (!activa) return false;
        return !await db.UserEntities.AsNoTracking()
            .Where(v => v.EntityId == organizacionId && v.UserId != usuarioId && v.IsActive
                && RolesDeEntidad.QueResponden.Contains(v.EntityRole))
            .Join(db.Users.AsNoTracking().Where(u => u.IsActive), v => v.UserId, u => u.Id, (v, _) => v.Id)
            .AnyAsync(ct);
    }

    private static InvitacionDeOrganizacionDto ADto(InvitacionDeOrganizacionRow fila, DateTime ahora, string? enlace) =>
        new(fila.Id.ToString(CultureInfo.InvariantCulture), fila.CorreoInvitado, fila.RolEntidad,
            fila.Estado == EstadosDeInvitacion.Pendiente && fila.FechaExpiracion <= ahora ? EstadosDeInvitacion.Vencida : fila.Estado,
            fila.FechaEmision, fila.FechaExpiracion, enlace);

    private static void Auditar(SimusDbContext db, int persona, string tabla, int registro, string accion, object valores, DateTime fecha) =>
        db.AuditLogs.Add(new AuditLogRow
        {
            UserId = persona,
            TableName = tabla,
            RecordId = registro.ToString(CultureInfo.InvariantCulture),
            Action = accion,
            NewValuesJson = JsonSerializer.Serialize(valores),
            CreatedAt = fecha,
        });

    private static IResult Rechazo() =>
        Results.BadRequest(new { message = "La solicitud no pudo validarse. Actualiza la página e inténtalo nuevamente." });

    private static bool EsCorreoValido(string correo) =>
        correo.Length is > 3 and <= 240 && MailAddress.TryCreate(correo, out var direccion) && direccion.Address == correo;

    /// <summary>Quién invita: el nombre de la persona, para que el correo diga quién actúa.</summary>
    private static Task<string?> NombreDeAsync(SimusDbContext db, int usuarioId, CancellationToken ct) =>
        db.Users.AsNoTracking().Where(u => u.Id == usuarioId).Select(u => u.FullName).FirstOrDefaultAsync(ct);

    private static string Etiqueta(string rol) => rol == RolesDeEntidad.Administrador ? "administradora o administrador" : "editora o editor";

    private static string MensajeDeEstado(string estado) => estado switch
    {
        EstadosDeInvitacion.Aceptada => "Esta invitación ya se usó.",
        EstadosDeInvitacion.Revocada => "Esta invitación fue revocada.",
        EstadosDeInvitacion.Vencida => "Esta invitación venció. Pide que te envíen otra.",
        _ => "La invitación no está disponible.",
    };

    internal static string RutaDeInvitacion(string testigo) => $"/ecosistema/invitacion?testigo={testigo}";

    private static string Resumir(string testigo) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(testigo))).ToLowerInvariant();
}

/// <summary>El ciclo de una invitación: <c>pendiente → aceptada | revocada | vencida</c>.</summary>
public static class EstadosDeInvitacion
{
    public const string Pendiente = "pendiente";
    public const string Aceptada = "aceptada";
    public const string Revocada = "revocada";
    public const string Vencida = "vencida";
}
