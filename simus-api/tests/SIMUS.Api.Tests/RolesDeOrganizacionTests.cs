using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Administrador y editor dentro de una organización, y la regla del último administrador.
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE FIJA</b> (<c>docs/desarrollo/19-cuentas-y-organizaciones.md</c> §19.3): el editor ve la organización, crea y edita
/// borradores; no envía, no retira, no edita los datos de la organización (403). Y ninguna
/// operación deja una organización activa sin administradores: es el mismo candado que
/// <c>CandadoDelUltimoWebmasterTests</c>, aplicado a las organizaciones.
/// </para>
/// <para>
/// <b>CADA PRUEBA CON SU FÁBRICA</b> porque siembran cuentas y vínculos que cambian el recuento de
/// administradores; compartir la base haría que el resultado dependiera del orden.
/// </para>
/// </remarks>
public sealed class RolesDeOrganizacionTests
{
    private const string Clave = "ClaveExterna123";

    internal sealed record Sesion(HttpClient Cliente, string Csrf, int UsuarioId, string Correo);

    /// <summary>Registra una organización con su administradora, con el correo ya confirmado.</summary>
    internal static async Task<(Sesion Administradora, int OrganizacionId)> OrganizacionAsync(
        TestWebApplicationFactory factory, string nombre)
    {
        var cliente = factory.CreateClient();
        var correo = $"roles.{Guid.NewGuid():N}@organizacion.test";

        var alta = await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = nombre,
            FullName = "Persona responsable",
            NumeroDocumento = "1020304051",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            HeadquartersDepartmentCode = "05",
            HeadquartersMunicipalityCode = "05001",
            PoliticasAceptadas = ["tratamiento", "terminos"],
        });
        alta.EnsureSuccessStatusCode();
        await CorreoConfirmadoEnPruebas.ConfirmarAsync(factory, correo);

        var sesion = await EntrarAsync(factory, correo);
        var mias = await sesion.Cliente.GetFromJsonAsync<List<OrganizacionAdministradaDto>>("/api/v1/externo/organizaciones/mis");
        return (sesion, int.Parse(mias![0].Id, CultureInfo.InvariantCulture));
    }

    /// <summary>Una cuenta externa vinculada a la organización con el rol indicado.</summary>
    internal static async Task<int> MiembroAsync(
        TestWebApplicationFactory factory, int organizacionId, string rol, string correo)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;
        var cuenta = new UserRow
        {
            FullName = "Miembro " + rol,
            Email = correo,
            AccessChannel = "externo",
            ProfileType = "individual",
            IsActive = true,
            CorreoConfirmado = true,
            CreatedAt = ahora,
            UpdatedAt = ahora,
        };
        cuenta.PasswordHash = AdminAuthEndpoints.HashPassword(cuenta, Clave);
        db.Users.Add(cuenta);
        await db.SaveChangesAsync();
        await RolesEnPruebas.AsignarAsync(db, cuenta.Id, "externo");
        db.UserEntities.Add(new UserEntityRow
        {
            UserId = cuenta.Id,
            EntityId = organizacionId,
            EntityRole = rol,
            IsActive = true,
            CreatedAt = ahora,
        });
        await db.SaveChangesAsync();
        return cuenta.Id;
    }

    internal static async Task<Sesion> EntrarAsync(TestWebApplicationFactory factory, string correo)
    {
        var cliente = factory.CreateClient();
        var entrada = await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest
        {
            Email = correo,
            Password = Clave,
        });
        entrada.EnsureSuccessStatusCode();
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var sesion = await cliente.GetFromJsonAsync<ExternalSessionResponse>("/api/v1/externo/auth/me");
        return new Sesion(cliente, testigo.GetProperty("requestToken").GetString()!,
            int.Parse(sesion!.UserId, CultureInfo.InvariantCulture), correo);
    }

    internal static async Task<HttpResponseMessage> EnviarAsync(Sesion sesion, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var peticion = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) peticion.Content = JsonContent.Create(cuerpo);
        peticion.Headers.Add("X-CSRF-TOKEN", sesion.Csrf);
        return await sesion.Cliente.SendAsync(peticion);
    }

    private static MercadoUpsertRequest UnMercadoCompleto() => new()
    {
        Nombre = "Mercado Musical del Sur",
        Descripcion = "Encuentro de intercambio y circulación para músicas del sur del país.",
        NivelCobertura = "municipal",
        CodigoDepartamento = "05",
        CodigoMunicipio = "05001",
        CorreoMercado = "contacto@mercado.test",
    };

    // ── Editor: prepara, no entrega ─────────────────────────────────────────────────────────

    [Fact]
    public async Task El_editor_crea_y_edita_el_borrador_pero_enviarlo_le_responde_403()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacion) = await OrganizacionAsync(factory, "Organización con editor");
        var correoEditor = $"editor.{Guid.NewGuid():N}@organizacion.test";
        await MiembroAsync(factory, organizacion, "editor", correoEditor);
        var editor = await EntrarAsync(factory, correoEditor);

        var creado = await EnviarAsync(editor, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacion}/mercados", UnMercadoCompleto());
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var mercado = await creado.Content.ReadFromJsonAsync<MercadoDto>();

        var editado = await EnviarAsync(editor, HttpMethod.Put, $"/api/v1/externo/mercados/{mercado!.Id}", UnMercadoCompleto());
        Assert.Equal(HttpStatusCode.OK, editado.StatusCode);

        var envioDelEditor = await EnviarAsync(editor, HttpMethod.Post, $"/api/v1/externo/mercados/{mercado.Id}/enviar-a-revision", new { });
        Assert.Equal(HttpStatusCode.Forbidden, envioDelEditor.StatusCode);

        var borradoDelEditor = await EnviarAsync(editor, HttpMethod.Delete, $"/api/v1/externo/mercados/{mercado.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, borradoDelEditor.StatusCode);

        // El mismo intento, hecho por quien administra, pasa la guarda: si algo lo detiene es la
        // validación del contenido (400), no el permiso.
        var envio = await EnviarAsync(administradora, HttpMethod.Post, $"/api/v1/externo/mercados/{mercado.Id}/enviar-a-revision", new { });
        Assert.NotEqual(HttpStatusCode.Forbidden, envio.StatusCode);
    }

    [Fact]
    public async Task El_editor_ve_la_organizacion_y_su_rol_en_la_sesion_pero_no_edita_sus_datos()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, organizacion) = await OrganizacionAsync(factory, "Organización con editor que mira");
        var correoEditor = $"editor.{Guid.NewGuid():N}@organizacion.test";
        await MiembroAsync(factory, organizacion, "editor", correoEditor);
        var editor = await EntrarAsync(factory, correoEditor);

        var sesion = await editor.Cliente.GetFromJsonAsync<ExternalSessionResponse>("/api/v1/externo/auth/me");
        var suya = Assert.Single(sesion!.Organizations);
        Assert.Equal(organizacion.ToString(CultureInfo.InvariantCulture), suya.Id);
        Assert.Equal("editor", suya.Role);

        Assert.Equal(HttpStatusCode.OK,
            (await editor.Cliente.GetAsync($"/api/v1/externo/organizaciones/{organizacion}/perfil")).StatusCode);

        var perfil = await EnviarAsync(editor, HttpMethod.Put, $"/api/v1/externo/organizaciones/{organizacion}/perfil", new
        {
            nombre = "Cambio que el editor no puede hacer",
            correoContacto = "otro@organizacion.test",
            codigoDepartamentoSede = "05",
            codigoMunicipioSede = "05001",
        });
        Assert.Equal(HttpStatusCode.Forbidden, perfil.StatusCode);
    }

    [Fact]
    public async Task El_editor_de_una_organizacion_no_entra_en_otra()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, mia) = await OrganizacionAsync(factory, "Organización propia");
        var (_, ajena) = await OrganizacionAsync(factory, "Organización ajena");
        var correoEditor = $"editor.{Guid.NewGuid():N}@organizacion.test";
        await MiembroAsync(factory, mia, "editor", correoEditor);
        var editor = await EntrarAsync(factory, correoEditor);

        Assert.Equal(HttpStatusCode.OK,
            (await editor.Cliente.GetAsync($"/api/v1/externo/organizaciones/{mia}/mercados")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await editor.Cliente.GetAsync($"/api/v1/externo/organizaciones/{ajena}/mercados")).StatusCode);
        var creado = await EnviarAsync(editor, HttpMethod.Post, $"/api/v1/externo/organizaciones/{ajena}/mercados", UnMercadoCompleto());
        Assert.Equal(HttpStatusCode.NotFound, creado.StatusCode);
    }

    // ── El último administrador ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task La_consola_no_desactiva_la_cuenta_del_unico_administrador_de_una_organizacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacion) = await OrganizacionAsync(factory, "Organización con una sola administradora");
        var consola = await CmsTestClient.LoginAsync(factory);

        var desactivar = await DesactivarDesdeLaConsolaAsync(factory, consola, administradora.UsuarioId);
        Assert.Equal(HttpStatusCode.Conflict, desactivar.StatusCode);
        Assert.Contains("ultimo_administrador", await desactivar.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var conCsrf = await CmsTestClient.LoginAsync(factory);
        var borrar = await conCsrf.DeleteAsync($"/api/v1/admin/auth/users/{administradora.UsuarioId}");
        Assert.Equal(HttpStatusCode.Conflict, borrar.StatusCode);

        // Un editor no cuenta: la organización seguiría sin nadie que la administre.
        await MiembroAsync(factory, organizacion, "editor", $"editor.{Guid.NewGuid():N}@organizacion.test");
        Assert.Equal(HttpStatusCode.Conflict,
            (await DesactivarDesdeLaConsolaAsync(factory, consola, administradora.UsuarioId)).StatusCode);

        // Con otra administradora activa, la baja procede.
        await MiembroAsync(factory, organizacion, "administrador", $"admin2.{Guid.NewGuid():N}@organizacion.test");
        Assert.Equal(HttpStatusCode.OK,
            (await DesactivarDesdeLaConsolaAsync(factory, consola, administradora.UsuarioId)).StatusCode);
    }

    [Fact]
    public async Task Una_segunda_administradora_con_la_cuenta_inactiva_no_cuenta()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacion) = await OrganizacionAsync(factory, "Organización con suplente inactiva");
        var suplente = await MiembroAsync(factory, organizacion, "administrador", $"admin2.{Guid.NewGuid():N}@organizacion.test");
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var cuenta = await db.Users.SingleAsync(item => item.Id == suplente);
            cuenta.IsActive = false;
            await db.SaveChangesAsync();
        }

        var consola = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.Conflict,
            (await DesactivarDesdeLaConsolaAsync(factory, consola, administradora.UsuarioId)).StatusCode);
    }

    private static async Task<HttpResponseMessage> DesactivarDesdeLaConsolaAsync(
        TestWebApplicationFactory factory, HttpClient consola, int usuarioId)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var fila = await db.Users.AsNoTracking().SingleAsync(item => item.Id == usuarioId);
        return await consola.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            Id = usuarioId.ToString(CultureInfo.InvariantCulture),
            FullName = fila.FullName,
            Email = fila.Email,
            Role = "externo",
            IsActive = false,
        });
    }
}
