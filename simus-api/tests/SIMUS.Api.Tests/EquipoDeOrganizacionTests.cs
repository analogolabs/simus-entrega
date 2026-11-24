using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;
using static SIMUS.Api.Tests.RolesDeOrganizacionTests;

namespace SIMUS.Api.Tests;

/// <summary>
/// La pantalla «Equipo» desde el servidor: invitaciones de un solo uso, cambio de rol, quitar y
/// salir, la regla del último administrador y el aislamiento entre organizaciones.
/// </summary>
public sealed class EquipoDeOrganizacionTests
{
    private static string Base(int organizacion) => $"/api/v1/externo/organizaciones/{organizacion}/equipo";

    private static string Correo(string prefijo) => $"{prefijo}.{Guid.NewGuid():N}@organizacion.test";

    private static async Task<InvitacionDeOrganizacionDto> InvitarAsync(Sesion admin, int organizacion, string correo, string rol = "editor")
    {
        var respuesta = await EnviarAsync(admin, HttpMethod.Post, $"{Base(organizacion)}/invitaciones", new { correo, rol });
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<InvitacionDeOrganizacionDto>())!;
    }

    private static string TestigoDe(InvitacionDeOrganizacionDto invitacion) =>
        invitacion.Enlace!.Split("testigo=")[1];

    private static Task<HttpResponseMessage> AceptarAsync(Sesion sesion, string testigo) =>
        EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/invitaciones/aceptar", new { testigo });

    [Fact]
    public async Task La_invitacion_se_acepta_una_sola_vez_y_deja_rastro_en_la_bitacora()
    {
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización que invita");
        var invitacion = await InvitarAsync(admin, organizacion, Correo("invitada"));
        Assert.StartsWith("/ecosistema/invitacion?testigo=", invitacion.Enlace, StringComparison.Ordinal);
        var testigo = TestigoDe(invitacion);

        // Solo se guarda el resumen: el testigo no aparece en la base.
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.InvitacionesDeOrganizacion.AsNoTracking().SingleAsync(i => i.Id == int.Parse(invitacion.Id, System.Globalization.CultureInfo.InvariantCulture));
            Assert.NotEqual(testigo, fila.HashTestigo);
            Assert.Equal(64, fila.HashTestigo.Length);
            // Se encoló el correo de la invitación.
            Assert.True(await db.Notifications.AsNoTracking().AnyAsync(n => n.EventType == "InvitacionAOrganizacion"));
        }

        // Solo la cuenta del correo invitado acepta (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4 v1.1).
        var correoDeLaCuenta = invitacion.Correo;
        await MiembroSinOrganizacionAsync(factory, correoDeLaCuenta);
        var invitada = await EntrarAsync(factory, correoDeLaCuenta);

        var consulta = await invitada.Cliente.PostAsJsonAsync("/api/v1/externo/invitaciones/consultar", new { testigo });
        Assert.Equal(HttpStatusCode.OK, consulta.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await AceptarAsync(invitada, testigo)).StatusCode);
        var sesion = await invitada.Cliente.GetFromJsonAsync<ExternalSessionResponse>("/api/v1/externo/auth/me");
        Assert.Contains(sesion!.Organizations, o => o.Id == organizacion.ToString(System.Globalization.CultureInfo.InvariantCulture) && o.Role == "editor");

        // Segundo uso: rechazado.
        var otraCuenta = Correo("tercera");
        await MiembroSinOrganizacionAsync(factory, otraCuenta);
        var segundo = await AceptarAsync(await EntrarAsync(factory, otraCuenta), testigo);
        Assert.Equal(HttpStatusCode.Conflict, segundo.StatusCode);
        Assert.Contains("aceptada", await segundo.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var bitacora = await db.AuditLogs.AsNoTracking().Where(a => a.NewValuesJson != null && a.NewValuesJson.Contains("invitacion_aceptada")).ToListAsync();
            var entrada = Assert.Single(bitacora);
            Assert.Contains(invitacion.Correo, entrada.NewValuesJson, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Una_cuenta_con_otro_correo_no_acepta_y_se_le_dice_a_que_correo_se_envio()
    {
        // un enlace reenviado o filtrado daba acceso a la organización a otra persona. Ahora
        // solo la acepta la cuenta del correo invitado, y la respuesta dice a cuál —enmascarado—
        // para que la persona sepa con qué cuenta entrar.
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización que invita a una sola");
        var invitacion = await InvitarAsync(admin, organizacion, Correo("destinataria"));
        var testigo = TestigoDe(invitacion);

        var otroCorreo = Correo("otra");
        await MiembroSinOrganizacionAsync(factory, otroCorreo);
        var otra = await EntrarAsync(factory, otroCorreo);

        // La consulta anónima no entrega la dirección completa.
        var consulta = await (await otra.Cliente.PostAsJsonAsync("/api/v1/externo/invitaciones/consultar", new { testigo }))
            .Content.ReadFromJsonAsync<InvitacionAbiertaDto>();
        Assert.NotEqual(invitacion.Correo, consulta!.CorreoInvitado);
        Assert.StartsWith("d•••", consulta.CorreoInvitado, StringComparison.Ordinal);
        Assert.EndsWith("@organizacion.test", consulta.CorreoInvitado, StringComparison.Ordinal);

        var respuesta = await AceptarAsync(otra, testigo);
        var cuerpo = await respuesta.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
        Assert.Contains("correo_distinto", cuerpo, StringComparison.Ordinal);
        Assert.Contains(consulta.CorreoInvitado, cuerpo, StringComparison.Ordinal);
        Assert.DoesNotContain(invitacion.Correo, cuerpo, StringComparison.OrdinalIgnoreCase);

        // La invitación sigue pendiente y la otra cuenta no entró a la organización.
        var sesion = await otra.Cliente.GetFromJsonAsync<ExternalSessionResponse>("/api/v1/externo/auth/me");
        Assert.DoesNotContain(sesion!.Organizations, o => o.Id == organizacion.ToString(System.Globalization.CultureInfo.InvariantCulture));

        await MiembroSinOrganizacionAsync(factory, invitacion.Correo);
        Assert.Equal(HttpStatusCode.OK, (await AceptarAsync(await EntrarAsync(factory, invitacion.Correo), testigo)).StatusCode);
    }

    [Fact]
    public async Task Generar_un_enlace_nuevo_invalida_el_anterior_y_solo_lo_hace_el_administrador_de_esa_organizacion()
    {
        // (L7): del enlace de una invitación pendiente solo queda el resumen, así que no se puede
        // volver a mostrar; se emite otro y el anterior deja de servir.
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización que reemite");
        var (otroAdmin, otraOrganizacion) = await OrganizacionAsync(factory, "Otra organización que reemite");
        var invitacion = await InvitarAsync(admin, organizacion, Correo("reenviada"));
        var primerTestigo = TestigoDe(invitacion);

        // Otra organización no toca esta invitación.
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otroAdmin, HttpMethod.Post, $"{Base(otraOrganizacion)}/invitaciones/{invitacion.Id}/enlace-nuevo")).StatusCode);
        // Tampoco una cuenta que no administra la organización.
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otroAdmin, HttpMethod.Post, $"{Base(organizacion)}/invitaciones/{invitacion.Id}/enlace-nuevo")).StatusCode);

        var respuesta = await EnviarAsync(admin, HttpMethod.Post, $"{Base(organizacion)}/invitaciones/{invitacion.Id}/enlace-nuevo");
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var nueva = (await respuesta.Content.ReadFromJsonAsync<InvitacionDeOrganizacionDto>())!;
        Assert.Equal(invitacion.Id, nueva.Id);
        Assert.NotEqual(primerTestigo, TestigoDe(nueva));

        // El anterior ya no existe para quien lo tenga; el nuevo sí.
        Assert.Equal(HttpStatusCode.NotFound,
            (await admin.Cliente.PostAsJsonAsync("/api/v1/externo/invitaciones/consultar", new { testigo = primerTestigo }))
                .StatusCode == HttpStatusCode.OK ? HttpStatusCode.OK : HttpStatusCode.NotFound);
        var viejo = await (await admin.Cliente.PostAsJsonAsync("/api/v1/externo/invitaciones/consultar", new { testigo = primerTestigo })).Content.ReadAsStringAsync();
        Assert.DoesNotContain("pendiente", viejo, StringComparison.Ordinal);
        var vigente = await admin.Cliente.PostAsJsonAsync("/api/v1/externo/invitaciones/consultar", new { testigo = TestigoDe(nueva) });
        Assert.Contains("pendiente", await vigente.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        // Se volvió a encolar el correo, y una revocada no se reemite.
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            Assert.Equal(2, await db.Notifications.CountAsync(n => n.EventType == "InvitacionAOrganizacion" && n.RecipientEmail == invitacion.Correo));
        }
        Assert.Equal(HttpStatusCode.NoContent, (await EnviarAsync(admin, HttpMethod.Delete, $"{Base(organizacion)}/invitaciones/{invitacion.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(admin, HttpMethod.Post, $"{Base(organizacion)}/invitaciones/{invitacion.Id}/enlace-nuevo")).StatusCode);
    }

    [Fact]
    public async Task Una_invitacion_vencida_no_se_acepta()
    {
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización con invitación vencida");
        var invitacion = await InvitarAsync(admin, organizacion, Correo("tarde"));
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.InvitacionesDeOrganizacion.SingleAsync();
            fila.FechaEmision = DateTime.UtcNow.AddDays(-9);
            fila.FechaExpiracion = DateTime.UtcNow.AddDays(-2);
            await db.SaveChangesAsync();
        }

        var correo = Correo("tarde-cuenta");
        await MiembroSinOrganizacionAsync(factory, correo);
        var respuesta = await AceptarAsync(await EntrarAsync(factory, correo), TestigoDe(invitacion));

        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
        Assert.Contains("vencida", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Hay_una_sola_invitacion_pendiente_por_correo_y_una_revocada_no_sirve()
    {
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización que no repite");
        var correo = Correo("repetida");
        var primera = await InvitarAsync(admin, organizacion, correo);

        var repetida = await EnviarAsync(admin, HttpMethod.Post, $"{Base(organizacion)}/invitaciones", new { correo = correo.ToUpperInvariant(), rol = "administrador" });
        Assert.Equal(HttpStatusCode.Conflict, repetida.StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await EnviarAsync(admin, HttpMethod.Delete, $"{Base(organizacion)}/invitaciones/{primera.Id}")).StatusCode);
        await MiembroSinOrganizacionAsync(factory, correo);
        Assert.Equal(HttpStatusCode.Conflict, (await AceptarAsync(await EntrarAsync(factory, correo), TestigoDe(primera))).StatusCode);

        // Revocada, se puede volver a invitar.
        await InvitarAsync(admin, organizacion, correo);
    }

    [Fact]
    public async Task Un_editor_no_invita_ni_cambia_roles_ni_quita_pero_puede_salir()
    {
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización con editora");
        var correoEditor = Correo("editora");
        var editorId = await MiembroAsync(factory, organizacion, "editor", correoEditor);
        var editor = await EntrarAsync(factory, correoEditor);

        var equipo = await editor.Cliente.GetFromJsonAsync<EquipoDeOrganizacionDto>(Base(organizacion));
        Assert.False(equipo!.PuedeAdministrar);
        Assert.Equal(2, equipo.Miembros.Count);
        Assert.Empty(equipo.Invitaciones);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await EnviarAsync(editor, HttpMethod.Post, $"{Base(organizacion)}/invitaciones", new { correo = Correo("x"), rol = "editor" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await EnviarAsync(editor, HttpMethod.Put, $"{Base(organizacion)}/miembros/{editorId}", new { rol = "administrador" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await EnviarAsync(editor, HttpMethod.Delete, $"{Base(organizacion)}/miembros/{admin.UsuarioId}")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(editor, HttpMethod.Delete, $"{Base(organizacion)}/miembros/{editorId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await editor.Cliente.GetAsync(Base(organizacion))).StatusCode);
    }

    [Fact]
    public async Task El_ultimo_administrador_no_puede_salir_ni_rebajarse_ni_ser_quitado()
    {
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización con una administradora");

        var salir = await EnviarAsync(admin, HttpMethod.Delete, $"{Base(organizacion)}/miembros/{admin.UsuarioId}");
        Assert.Equal(HttpStatusCode.Conflict, salir.StatusCode);
        Assert.Contains("ultimo_administrador", await salir.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(admin, HttpMethod.Put, $"{Base(organizacion)}/miembros/{admin.UsuarioId}", new { rol = "editor" })).StatusCode);

        // Con una segunda administradora: la primera puede rebajarse, y entonces la segunda ya no
        // puede salir.
        var correo2 = Correo("admin2");
        var segunda = await MiembroAsync(factory, organizacion, "administrador", correo2);
        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(admin, HttpMethod.Put, $"{Base(organizacion)}/miembros/{admin.UsuarioId}", new { rol = "editor" })).StatusCode);
        var sesion2 = await EntrarAsync(factory, correo2);
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(sesion2, HttpMethod.Delete, $"{Base(organizacion)}/miembros/{segunda}")).StatusCode);

        // Y la bitácora registra el cambio de rol.
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.True(await db.AuditLogs.AsNoTracking().AnyAsync(a => a.NewValuesJson != null && a.NewValuesJson.Contains("rol_cambiado")));
    }

    [Fact]
    public async Task Un_administrador_no_toca_el_equipo_de_otra_organizacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var (adminA, organizacionA) = await OrganizacionAsync(factory, "Organización A");
        var (adminB, organizacionB) = await OrganizacionAsync(factory, "Organización B");
        var invitacionB = await InvitarAsync(adminB, organizacionB, Correo("de-b"));

        Assert.Equal(HttpStatusCode.NotFound, (await adminA.Cliente.GetAsync(Base(organizacionB))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(adminA, HttpMethod.Delete, $"{Base(organizacionB)}/miembros/{adminB.UsuarioId}")).StatusCode);
        // La invitación de B, pedida por la ruta de A: no existe para A.
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(adminA, HttpMethod.Delete, $"{Base(organizacionA)}/invitaciones/{invitacionB.Id}")).StatusCode);
        // Quitar por la ruta de A a quien solo es de B: no es miembro de A.
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(adminA, HttpMethod.Delete, $"{Base(organizacionA)}/miembros/{adminB.UsuarioId}")).StatusCode);
    }

    /// <summary>Una cuenta externa sin organización (como la de un registro individual).</summary>
    [Fact]
    public async Task La_cuenta_ve_sus_invitaciones_pendientes_y_solo_las_suyas()
    {
        // «Mis organizaciones» del espacio Persona: quien espera una invitación la ve
        // sin depender de encontrar el enlace. La lista no lleva el testigo.
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización que espera a alguien");
        var correo = Correo("esperada");
        var invitacion = await InvitarAsync(admin, organizacion, correo, "administrador");
        await MiembroSinOrganizacionAsync(factory, correo);
        var invitada = await EntrarAsync(factory, correo);

        var lista = await invitada.Cliente.GetFromJsonAsync<InvitacionesDeLaCuentaDto>("/api/v1/externo/cuenta/invitaciones");
        Assert.False(lista!.CorreoSinConfirmar);
        var pendiente = Assert.Single(lista.Pendientes);
        Assert.Equal(organizacion.ToString(System.Globalization.CultureInfo.InvariantCulture), pendiente.OrganizacionId);
        Assert.Equal("Organización que espera a alguien", pendiente.Organizacion);
        Assert.Equal("administrador", pendiente.Rol);
        var crudo = await invitada.Cliente.GetStringAsync("/api/v1/externo/cuenta/invitaciones");
        Assert.DoesNotContain(TestigoDe(invitacion), crudo, StringComparison.Ordinal);

        // Otra cuenta no ve la invitación ajena.
        var otroCorreo = Correo("ajena");
        await MiembroSinOrganizacionAsync(factory, otroCorreo);
        var ajena = await (await EntrarAsync(factory, otroCorreo)).Cliente
            .GetFromJsonAsync<InvitacionesDeLaCuentaDto>("/api/v1/externo/cuenta/invitaciones");
        Assert.Empty(ajena!.Pendientes);

        // Aceptada, deja de estar pendiente.
        Assert.Equal(HttpStatusCode.OK, (await AceptarAsync(invitada, TestigoDe(invitacion))).StatusCode);
        var despues = await invitada.Cliente.GetFromJsonAsync<InvitacionesDeLaCuentaDto>("/api/v1/externo/cuenta/invitaciones");
        Assert.Empty(despues!.Pendientes);
    }

    [Fact]
    public async Task Una_invitacion_vencida_no_aparece_entre_las_pendientes_de_la_cuenta()
    {
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización con invitación caducada");
        var correo = Correo("caducada");
        await InvitarAsync(admin, organizacion, correo);
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.InvitacionesDeOrganizacion.SingleAsync();
            fila.FechaEmision = DateTime.UtcNow.AddDays(-9);
            fila.FechaExpiracion = DateTime.UtcNow.AddDays(-2);
            await db.SaveChangesAsync();
        }
        await MiembroSinOrganizacionAsync(factory, correo);
        var lista = await (await EntrarAsync(factory, correo)).Cliente
            .GetFromJsonAsync<InvitacionesDeLaCuentaDto>("/api/v1/externo/cuenta/invitaciones");
        Assert.Empty(lista!.Pendientes);
    }

    [Fact]
    public async Task Con_el_correo_sin_confirmar_no_se_entregan_las_invitaciones()
    {
        // Cualquiera puede registrar una cuenta con un correo ajeno: sin confirmarlo, no sabrá a qué
        // organizaciones se invitó a su dueño.
        await using var factory = new TestWebApplicationFactory();
        var (admin, organizacion) = await OrganizacionAsync(factory, "Organización que invita a un correo sin confirmar");
        var correo = Correo("sin-confirmar");
        await InvitarAsync(admin, organizacion, correo);
        await MiembroSinOrganizacionAsync(factory, correo);
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var cuenta = await db.Users.SingleAsync(u => u.Email == correo);
            cuenta.CorreoConfirmado = false;
            await db.SaveChangesAsync();
        }
        var lista = await (await EntrarAsync(factory, correo)).Cliente
            .GetFromJsonAsync<InvitacionesDeLaCuentaDto>("/api/v1/externo/cuenta/invitaciones");
        Assert.True(lista!.CorreoSinConfirmar);
        Assert.Empty(lista.Pendientes);
    }

    [Fact]
    public async Task Sin_sesion_no_se_consultan_las_invitaciones_de_la_cuenta()
    {
        await using var factory = new TestWebApplicationFactory();
        var respuesta = await factory.CreateClient().GetAsync(new Uri("/api/v1/externo/cuenta/invitaciones", UriKind.Relative));
        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
    }

    private static async Task MiembroSinOrganizacionAsync(TestWebApplicationFactory factory, string correo)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;
        var cuenta = new SIMUS.Domain.Entities.UserRow
        {
            FullName = "Persona invitada",
            Email = correo,
            AccessChannel = "externo",
            ProfileType = "individual",
            IsActive = true,
            CorreoConfirmado = true,
            CreatedAt = ahora,
            UpdatedAt = ahora,
        };
        cuenta.PasswordHash = SIMUS.Api.Endpoints.AdminAuthEndpoints.HashPassword(cuenta, "ClaveExterna123");
        db.Users.Add(cuenta);
        await db.SaveChangesAsync();
        await RolesEnPruebas.AsignarAsync(db, cuenta.Id, "externo");
    }
}
