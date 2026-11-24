using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Las decisiones de política de la revisión de interfaz que tocan el API (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1, 11 a 13).
/// </summary>
/// <remarks>
/// <list type="bullet">
/// <item><description>Una organización solo es pública cuando la consola la revisó.</description></item>
/// <item><description>«Persona responsable» y «Mis autorizaciones» leen la misma autorización.</description></item>
/// </list>
/// </remarks>
public sealed class PoliticasDeLaAuditoriaTests
{
    private const string Clave = "ClaveExterna123";

    [Fact]
    public async Task Solo_la_organizacion_revisada_por_la_consola_es_publica_y_retirar_la_revision_pide_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (sesion, organizacionId) = await CuentaConOrganizacionAsync(factory, "revision.consola@example.com", "53001001");
        await ActivarAsync(factory, organizacionId);
        var anonimo = factory.CreateClient();
        var consola = await CmsTestClient.LoginAsync(factory);

        // ACTIVA NO BASTA: sin la revisión de la consola, la ficha no existe.
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/organizaciones/{organizacionId}")).StatusCode);

        // LA ORGANIZACIÓN NO SE REVISA A SÍ MISMA.
        Assert.NotEqual(HttpStatusCode.OK,
            (await sesion.PostAsJsonAsync($"/api/v1/admin/organizaciones/{organizacionId}/revision", new { revisada = true })).StatusCode);

        var marcada = await consola.PostAsJsonAsync($"/api/v1/admin/organizaciones/{organizacionId}/revision", new { revisada = true });
        Assert.Equal(HttpStatusCode.OK, marcada.StatusCode);
        var revision = (await marcada.Content.ReadFromJsonAsync<RevisionDeOrganizacionDto>())!;
        Assert.True(revision.Revisada);
        Assert.True(revision.Publica);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/organizaciones/{organizacionId}")).StatusCode);

        // LA FICHA DE LA CONSOLA LO DICE, para poder ofrecer la acción contraria.
        var ficha = await consola.GetFromJsonAsync<JsonElement>($"/api/v1/admin/organizaciones/{organizacionId}");
        Assert.Equal(JsonValueKind.String, ficha.GetProperty("organizacion").GetProperty("fechaRevisionConsola").ValueKind);

        // RETIRARLA LA SACA DEL PORTAL, y por eso pide motivo.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await consola.PostAsJsonAsync($"/api/v1/admin/organizaciones/{organizacionId}/revision", new { revisada = false })).StatusCode);
        var retirada = await consola.PostAsJsonAsync($"/api/v1/admin/organizaciones/{organizacionId}/revision",
            new { revisada = false, motivo = "Sus datos de contacto no corresponden a la organización." });
        Assert.Equal(HttpStatusCode.OK, retirada.StatusCode);
        Assert.False((await retirada.Content.ReadFromJsonAsync<RevisionDeOrganizacionDto>())!.Revisada);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/organizaciones/{organizacionId}")).StatusCode);

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var rastro = await db.AuditLogs.AsNoTracking()
            .Where(item => item.TableName == "Entidades" && item.RecordId == organizacionId.ToString())
            .Select(item => item.NewValuesJson)
            .ToListAsync();
        Assert.Contains(rastro, json => json != null && json.Contains("organizacion_revisada_por_la_consola", StringComparison.Ordinal));
        Assert.Contains(rastro, json => json != null && json.Contains("Sus datos de contacto", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Persona_responsable_y_mis_autorizaciones_no_se_contradicen()
    {
        await using var factory = new TestWebApplicationFactory();
        var (sesion, organizacionId) = await CuentaConOrganizacionAsync(factory, "responsable.autoriza@example.com", "53001002");

        // LA CUENTA ACEPTÓ EL TRATAMIENTO AL REGISTRARSE: «Mis autorizaciones» la da por vigente.
        var autorizaciones = await sesion.GetStringAsync("/api/v1/externo/mis-autorizaciones");
        Assert.Contains("tratamiento", autorizaciones, StringComparison.Ordinal);

        // Y «Persona responsable», sobre la misma persona, ya no dice «Sin otorgar».
        var responsable = await sesion.GetFromJsonAsync<ResponsableOrganizacionDto>(
            $"/api/v1/externo/organizaciones/{organizacionId}/responsable");
        Assert.True(responsable!.ResponsableAutorizacionDatos);
    }

    [Fact]
    public async Task El_boletin_no_aceptado_al_registrarse_se_otorga_despues_con_el_texto_vigente_y_solo_el_boletin()
    {
        // (L7): «retirar lo voluntario» no tenía contrapartida; lo voluntario que no se marcó al
        // registrarse no se podía otorgar nunca. Ahora sí, con el texto vigente copiado dentro.
        await using var factory = new TestWebApplicationFactory();
        var (sesion, _) = await CuentaConOrganizacionAsync(factory, "boletin.despues@example.com", "53001003");

        async Task<HttpResponseMessage> OtorgarAsync(string finalidad, bool conTestigo = true)
        {
            var mensaje = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/externo/mis-autorizaciones/{finalidad}/otorgar");
            if (conTestigo)
                mensaje.Headers.Add("X-CSRF-TOKEN", (await sesion.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken);
            return await sesion.SendAsync(mensaje);
        }

        Assert.DoesNotContain("\"boletin\"", await sesion.GetStringAsync("/api/v1/externo/mis-autorizaciones"), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.BadRequest, (await OtorgarAsync("boletin", conTestigo: false)).StatusCode);
        // Solo lo voluntario que se puede dar aquí: el tratamiento y los términos se aceptan al registrarse.
        Assert.Equal(HttpStatusCode.Conflict, (await OtorgarAsync("tratamiento")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await OtorgarAsync("inventada")).StatusCode);

        var otorgada = await OtorgarAsync("boletin");
        Assert.Equal(HttpStatusCode.OK, otorgada.StatusCode);
        var lista = await otorgada.Content.ReadFromJsonAsync<List<AutorizacionDeDatosDto>>();
        var boletin = Assert.Single(lista!, a => a.Finalidad == "boletin");
        Assert.True(boletin.Vigente);
        Assert.Equal(SIMUS.Infrastructure.Data.PoliticasDeDatosSembradas.TextoBoletin.Replace("\r\n", "\n", StringComparison.Ordinal),
            boletin.TextoAceptado.Replace("\r\n", "\n", StringComparison.Ordinal));

        // Idempotente: pedirlo otra vez no duplica la autorización vigente.
        await OtorgarAsync("boletin");
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal(1, await db.AutorizacionesDeDatos.CountAsync(a => a.Finalidad == "boletin" && a.FechaRevocacion == null && a.CorreoTitular == "boletin.despues@example.com"));
        Assert.Equal(1, await db.BoletinSuscripciones.CountAsync(b => b.CorreoElectronico == "boletin.despues@example.com" && b.Estado == "activa"));
    }

    // ---------- Andamio ----------------------------------------------------------

    /// <summary>Una cuenta individual que acepta el tratamiento y luego registra su organización.</summary>
    private static async Task<(HttpClient Sesion, int OrganizacionId)> CuentaConOrganizacionAsync(
        TestWebApplicationFactory factory, string correo, string documento)
    {
        var anonimo = factory.CreateClient();
        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Lucía",
            FirstSurname = "Mosquera",
            DocumentType = "cc",
            DocumentNumber = documento,
            Phone = "3009876543",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();

        var sesion = factory.CreateClient();
        (await sesion.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();

        var token = (await sesion.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken;
        var mensaje = new HttpRequestMessage(HttpMethod.Post, "/api/v1/externo/organizaciones/")
        {
            Content = JsonContent.Create(new ExternalOrganizationCreateRequest
            {
                Name = "Red de Gaitas de " + documento,
                ContactEmail = $"contacto-{documento}@red-de-gaitas.test",
                HeadquartersDepartmentCode = "05",
                HeadquartersMunicipalityCode = "05001",
            }),
        };
        mensaje.Headers.Add("X-CSRF-TOKEN", token);
        var respuesta = await sesion.SendAsync(mensaje);
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        var creada = (await respuesta.Content.ReadFromJsonAsync<ExternalOrganizationDto>())!;
        return (sesion, int.Parse(creada.Id, System.Globalization.CultureInfo.InvariantCulture));
    }

    /// <summary>La deja activa, que es lo que el modo demo hace al dar el correo por confirmado.</summary>
    private static async Task ActivarAsync(TestWebApplicationFactory factory, int organizacionId)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var entidad = await db.EntityProfiles.SingleAsync(item => item.Id == organizacionId);
        entidad.StatusCode = "activa";
        entidad.IsActive = true;
        await db.SaveChangesAsync();
    }
}
