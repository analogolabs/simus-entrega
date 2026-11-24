using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Cuenta individual, perfil y contraseña del canal externo (docs/desarrollo/19-cuentas-y-organizaciones.md).
/// </summary>
public sealed class CuentaExternaTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Clave = "ClaveExterna123";
    private readonly TestWebApplicationFactory _factory;

    public CuentaExternaTests(TestWebApplicationFactory factory) => _factory = factory;

    private static ExternalRegisterRequest Individual(string correo, string documento) => new()
    {
        RegistrationType = "individual",
        FirstName = "Lucía",
        FirstSurname = "Mosquera",
        DocumentType = "cc",
        DocumentNumber = documento,
        Phone = "3001234567",
        Email = correo,
        Password = Clave,
        PoliticasAceptadas = ["tratamiento", "terminos"],
    };

    private async Task<HttpClient> EntrarAsync(string correo, string clave = Clave)
    {
        var cliente = _factory.CreateClient();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = clave }))
            .EnsureSuccessStatusCode();
        return cliente;
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object cuerpo)
    {
        var token = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken;
        var mensaje = new HttpRequestMessage(metodo, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", token);
        return await cliente.SendAsync(mensaje);
    }

    [Fact]
    public async Task El_registro_individual_crea_solo_la_cuenta_con_sus_datos()
    {
        var cliente = _factory.CreateClient();
        var respuesta = await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", Individual("lucia.individual@example.com", "52000111"));

        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        var creada = await respuesta.Content.ReadFromJsonAsync<ExternalRegisterResponse>();
        Assert.Null(creada!.OrganizationId);

        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var usuario = await db.Users.AsNoTracking().SingleAsync(item => item.Email == "lucia.individual@example.com");
        Assert.Equal("individual", usuario.ProfileType);
        Assert.Equal("52000111", usuario.Identificacion);
        Assert.False(await db.UserEntities.AnyAsync(item => item.UserId == usuario.Id));

        var sesion = await EntrarAsync("lucia.individual@example.com");
        var perfil = await sesion.GetFromJsonAsync<PerfilDeCuentaExternaDto>("/api/v1/externo/cuenta/perfil");
        Assert.Equal("Lucía", perfil!.PrimerNombre);
        Assert.Equal("individual", perfil.TipoPerfil);
    }

    [Fact]
    public async Task No_duplica_una_identidad_por_documento()
    {
        var cliente = _factory.CreateClient();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", Individual("primera.doc@example.com", "52000222"))).EnsureSuccessStatusCode();

        var repetida = await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", Individual("segunda.doc@example.com", "52000222"));

        Assert.Equal(HttpStatusCode.BadRequest, repetida.StatusCode);
        Assert.Contains("documentNumber", await repetida.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_perfil_solo_se_lee_y_cambia_con_sesion_y_testigo()
    {
        var anonimo = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.GetAsync("/api/v1/externo/cuenta/perfil")).StatusCode);

        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", Individual("perfil.cambio@example.com", "52000333"))).EnsureSuccessStatusCode();
        var sesion = await EntrarAsync("perfil.cambio@example.com");

        var sinTestigo = await sesion.PutAsJsonAsync("/api/v1/externo/cuenta/perfil", new { primerNombre = "Otra" });
        Assert.Equal(HttpStatusCode.BadRequest, sinTestigo.StatusCode);

        var cambio = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil", new PerfilDeCuentaExternaSolicitud
        {
            PrimerNombre = "Lucía", SegundoNombre = "Esther", PrimerApellido = "Mosquera", SegundoApellido = "Palacios",
            TipoDocumento = "cc", NumeroDocumento = "52000333", Telefono = "6041234567",
        });
        Assert.Equal(HttpStatusCode.OK, cambio.StatusCode);
        var perfil = await cambio.Content.ReadFromJsonAsync<PerfilDeCuentaExternaDto>();
        Assert.Equal("Esther", perfil!.SegundoNombre);

        // El documento de otra cuenta no se puede tomar.
        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", Individual("ajena.doc@example.com", "52000444"))).EnsureSuccessStatusCode();
        var ajeno = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil", new PerfilDeCuentaExternaSolicitud
        {
            PrimerNombre = "Lucía", PrimerApellido = "Mosquera", TipoDocumento = "cc", NumeroDocumento = "52000444",
        });
        Assert.Equal(HttpStatusCode.BadRequest, ajeno.StatusCode);
    }

    [Fact]
    public async Task La_residencia_y_el_canal_son_opcionales_validados_y_privados()
    {
        var anonimo = _factory.CreateClient();
        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", Individual("lucia.residencia@example.com", "52009444"))).EnsureSuccessStatusCode();
        var sesion = await EntrarAsync("lucia.residencia@example.com");

        PerfilDeCuentaExternaSolicitud Base() => new()
        {
            PrimerNombre = "Lucía", PrimerApellido = "Mosquera", TipoDocumento = "cc", NumeroDocumento = "52009444", Telefono = "3001234567",
        };

        // Sin residencia ni canal: sigue valiendo (son opcionales) y la lectura los trae vacíos.
        var vacio = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil", Base());
        Assert.Equal(HttpStatusCode.OK, vacio.StatusCode);
        var inicial = (await vacio.Content.ReadFromJsonAsync<PerfilDeCuentaExternaDto>())!;
        Assert.Null(inicial.ResidenciaCodigoMunicipio);
        Assert.Null(inicial.CanalDeContactoPreferido);

        // Con residencia del catálogo y canal: se guardan y se leen de vuelta.
        var conDatos = Base();
        conDatos.ResidenciaCodigoDepartamento = "05";
        conDatos.ResidenciaCodigoMunicipio = "05001";
        conDatos.CanalDeContactoPreferido = "telefono";
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil", conDatos);
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        var leido = (await sesion.GetFromJsonAsync<PerfilDeCuentaExternaDto>("/api/v1/externo/cuenta/perfil"))!;
        Assert.Equal("05", leido.ResidenciaCodigoDepartamento);
        Assert.Equal("05001", leido.ResidenciaCodigoMunicipio);
        Assert.Equal("telefono", leido.CanalDeContactoPreferido);

        // Un municipio que no es del departamento, un municipio sin departamento, un código inventado y un canal ajeno se rechazan.
        foreach (var (departamento, municipio, canal, campo) in new[]
        {
            ("11", "05001", "correo", "residenciaCodigoMunicipio"),
            (null, "05001", "correo", "residenciaCodigoDepartamento"),
            ("99", null, "correo", "residenciaCodigoDepartamento"),
            ("05", "05001", "paloma", "canalDeContactoPreferido"),
        })
        {
            var malo = Base();
            malo.ResidenciaCodigoDepartamento = departamento;
            malo.ResidenciaCodigoMunicipio = municipio;
            malo.CanalDeContactoPreferido = canal;
            var rechazo = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil", malo);
            Assert.Equal(HttpStatusCode.BadRequest, rechazo.StatusCode);
            Assert.Contains(campo, await rechazo.Content.ReadAsStringAsync());
        }

        // Preferir el teléfono sin tener teléfono no tiene sentido.
        var sinTelefono = Base();
        sinTelefono.Telefono = null;
        sinTelefono.CanalDeContactoPreferido = "telefono";
        Assert.Equal(HttpStatusCode.BadRequest, (await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil", sinTelefono)).StatusCode);

        // PRIVADOS: ni el perfil público ni el directorio los llevan, ni siquiera con consentimiento del nombre civil.
        (await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico",
            new PerfilPublicoSolicitud { NombreVisible = "Lucía M.", NombreCivilVisible = true })).EnsureSuccessStatusCode();
        var json = await sesion.GetStringAsync("/api/v1/externo/cuenta/perfil-publico");
        Assert.DoesNotContain("05001", json);
        Assert.DoesNotContain("residencia", json, StringComparison.OrdinalIgnoreCase);

        // Una cuenta anónima no puede leer ni cambiar nada.
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync("/api/v1/externo/cuenta/perfil")).StatusCode);

        // Vacío lo borra.
        var borrado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil", Base());
        var sinResidencia = (await borrado.Content.ReadFromJsonAsync<PerfilDeCuentaExternaDto>())!;
        Assert.Null(sinResidencia.ResidenciaCodigoMunicipio);
    }

    [Fact]
    public async Task Cambiar_la_contrasena_exige_la_actual_y_cierra_las_demas_sesiones()
    {
        var anonimo = _factory.CreateClient();
        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", Individual("clave.cambio@example.com", "52000555"))).EnsureSuccessStatusCode();
        var esta = await EntrarAsync("clave.cambio@example.com");
        var otra = await EntrarAsync("clave.cambio@example.com");

        var malActual = await EnviarAsync(esta, HttpMethod.Post, "/api/v1/externo/cuenta/contrasena", new CambioDeContrasenaExternaSolicitud { Actual = "NoEsLaClave99", Nueva = "NuevaClaveSegura#2026" });
        Assert.Equal(HttpStatusCode.BadRequest, malActual.StatusCode);

        var cambio = await EnviarAsync(esta, HttpMethod.Post, "/api/v1/externo/cuenta/contrasena", new CambioDeContrasenaExternaSolicitud { Actual = Clave, Nueva = "NuevaClaveSegura#2026" });
        Assert.Equal(HttpStatusCode.NoContent, cambio.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await esta.GetAsync("/api/v1/externo/cuenta/perfil")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await otra.GetAsync("/api/v1/externo/cuenta/perfil")).StatusCode);
        await EntrarAsync("clave.cambio@example.com", "NuevaClaveSegura#2026");
    }
}
