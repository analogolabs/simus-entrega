using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Common;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Formularios: una sola regla de dirección web y de teléfono, el tipo de documento en minúscula y el
/// borrador del asistente de Mercado.
/// </summary>
public sealed class FormulariosYBorradoresDelPanelTests
{
    private const string Clave = "ClaveExterna123";

    // ───────────────────── Las reglas, sin red ─────────────────────

    [Theory]
    [InlineData("www.miorganizacion.org", "https://www.miorganizacion.org")]
    [InlineData("  festival-aud-org.ejemplo.org ", "https://festival-aud-org.ejemplo.org")]
    [InlineData("http://sitio.example.org/ruta", "https://sitio.example.org/ruta")]
    [InlineData("HTTPS://Sitio.Example.org", "HTTPS://Sitio.Example.org")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    public void La_direccion_se_completa_con_https(string entrada, string? esperada)
    {
        Assert.Equal(esperada, ValidationHelpers.NormalizeHttpsUrl(entrada));
        Assert.True(ValidationHelpers.IsValidHttpsUrl(entrada));
    }

    [Theory]
    [InlineData("@usuario")]
    [InlineData("solo una frase")]
    [InlineData("localhost")]
    [InlineData("ftp://archivos.example.org")]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://")]
    [InlineData("usuario:clave@sitio.example.org")]
    public void Lo_que_no_es_una_direccion_se_rechaza(string entrada)
    {
        Assert.False(ValidationHelpers.IsValidHttpsUrl(entrada));
    }

    [Theory]
    [InlineData("@mifestival", "@mifestival")]
    [InlineData("mifestival", "mifestival")]
    [InlineData("fb.com/mifestival", "https://fb.com/mifestival")]
    [InlineData("http://instagram.com/mifestival", "https://instagram.com/mifestival")]
    public void Una_red_social_admite_el_usuario_suelto_y_la_direccion_sigue_la_regla_unica(string entrada, string esperada)
    {
        Assert.True(ValidationHelpers.IsValidSocialLink(entrada));
        Assert.Equal(esperada, ValidationHelpers.NormalizeSocialLink(entrada));
    }

    [Theory]
    [InlineData("dos palabras")]
    [InlineData("ftp://x.example.org")]
    [InlineData("@")]
    public void Una_red_social_imposible_se_rechaza(string entrada)
    {
        Assert.False(ValidationHelpers.IsValidSocialLink(entrada));
    }

    [Theory]
    [InlineData("3001234567", true)]
    [InlineData("+57 (300) 123-4567", true)]
    [InlineData("", true)]
    [InlineData(null, true)]
    [InlineData("abc", false)]
    [InlineData("123", false)]
    [InlineData("3001234567 ext. 4", false)]
    public void El_telefono_tiene_una_sola_regla(string? entrada, bool valido)
    {
        Assert.Equal(valido, ValidationHelpers.IsValidPhone(entrada));
    }

    // ───────────────────── Cuenta y seguridad: el tipo de documento ─────────────────────

    [Fact]
    public async Task El_tipo_de_documento_guardado_en_mayuscula_llega_en_minuscula_y_el_telefono_abc_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();
        var correo = $"cuenta.{Guid.NewGuid():N}@individual.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual", FirstName = "Lucía", FirstSurname = "Mosquera", DocumentType = "ppt",
            DocumentNumber = "52000999", Phone = "3001234567", Email = correo, Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        // El alta heredada escribía «CC» y el desplegable solo conoce «cc»: era el campo vacío de.
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var usuario = await db.Users.SingleAsync(item => item.Email == correo);
            usuario.CodigoTipoDocumento = "CC";
            await db.SaveChangesAsync();
        }

        var perfil = await cliente.GetFromJsonAsync<PerfilDeCuentaExternaDto>("/api/v1/externo/cuenta/perfil");
        Assert.Equal("cc", perfil!.TipoDocumento);

        var testigo = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken;
        var peticion = new HttpRequestMessage(HttpMethod.Put, "/api/v1/externo/cuenta/perfil")
        {
            Content = JsonContent.Create(new PerfilDeCuentaExternaSolicitud
            {
                PrimerNombre = "Lucía", PrimerApellido = "Mosquera", TipoDocumento = "cc", NumeroDocumento = "52000999", Telefono = "abc",
            }),
        };
        peticion.Headers.Add("X-CSRF-TOKEN", testigo);
        var rechazo = await cliente.SendAsync(peticion);

        Assert.Equal(HttpStatusCode.BadRequest, rechazo.StatusCode);
        Assert.Contains("telefono", await rechazo.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    // ───────────────────── Mercado: reglas únicas y borrador ─────────────────────

    private static async Task<(HttpClient Sesion, int OrganizacionId, string Csrf)> OrganizacionAsync(TestWebApplicationFactory factory, string nombre)
    {
        var cliente = factory.CreateClient();
        var correo = $"l4.{Guid.NewGuid():N}@organizacion.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = nombre, FullName = "Persona responsable", NumeroDocumento = "1020304051", Phone = "3000000000",
            Email = correo, Password = Clave, HeadquartersDepartmentCode = "05", HeadquartersMunicipalityCode = "05001",
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        await CorreoConfirmadoEnPruebas.ConfirmarAsync(factory, correo);
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var csrf = (await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf")).GetProperty("requestToken").GetString()!;
        var mias = await cliente.GetFromJsonAsync<List<OrganizacionAdministradaDto>>("/api/v1/externo/organizaciones/mis");
        return (cliente, int.Parse(mias![0].Id, System.Globalization.CultureInfo.InvariantCulture), csrf);
    }

    private static Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, string csrf, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var peticion = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) peticion.Content = JsonContent.Create(cuerpo);
        peticion.Headers.Add("X-CSRF-TOKEN", csrf);
        return cliente.SendAsync(peticion);
    }

    private static MercadoUpsertRequest UnMercado(Action<MercadoUpsertRequest>? ajustar = null)
    {
        var mercado = new MercadoUpsertRequest
        {
            Nombre = "Mercado del Sur", NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001",
        };
        ajustar?.Invoke(mercado);
        return mercado;
    }

    [Fact]
    public async Task Una_direccion_sin_esquema_se_guarda_con_https_y_una_imposible_vuelve_con_su_campo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory, "Organización de direcciones");
        var ruta = $"/api/v1/externo/organizaciones/{organizacion}/mercados";

        var bien = await EnviarAsync(cliente, csrf, HttpMethod.Post, ruta, UnMercado(m => { m.SitioWebMercado = "www.mercado.example.org"; m.TelefonoMercado = "3001234567"; }));
        Assert.Equal(HttpStatusCode.Created, bien.StatusCode);
        var creado = await bien.Content.ReadFromJsonAsync<MercadoDto>();
        Assert.Equal("https://www.mercado.example.org", creado!.SitioWebMercado);

        var mala = await EnviarAsync(cliente, csrf, HttpMethod.Post, ruta, UnMercado(m => m.InstagramMercado = "dos palabras"));
        Assert.Equal(HttpStatusCode.BadRequest, mala.StatusCode);
        Assert.Contains("instagramMercado", await mala.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var telefono = await EnviarAsync(cliente, csrf, HttpMethod.Post, ruta, UnMercado(m => m.TelefonoMercado = "abc"));
        Assert.Equal(HttpStatusCode.BadRequest, telefono.StatusCode);
        Assert.Contains("telefonoMercado", await telefono.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_festival_acepta_la_direccion_sin_esquema_y_la_guarda_con_https_y_rechaza_el_telefono_abc()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory, "Organización con festival");
        var ruta = $"/api/v1/externo/organizaciones/{organizacion}/festivales";
        var festival = new CrearFestivalBorradorSolicitud
        {
            Nombre = "Festival de las Aguas", NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001",
            PaginaWeb = "festival-aud-org.ejemplo.org",
        };

        var creado = await EnviarAsync(cliente, csrf, HttpMethod.Post, ruta, festival);
        Assert.True(creado.IsSuccessStatusCode, await creado.Content.ReadAsStringAsync());
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            Assert.Equal("https://festival-aud-org.ejemplo.org", (await db.FestivalRecords.AsNoTracking().SingleAsync(f => f.Name == "Festival de las Aguas")).WebsiteUrl);
        }

        festival.Nombre = "Otro festival";
        festival.TelefonoCelular = "abc";
        var telefono = await EnviarAsync(cliente, csrf, HttpMethod.Post, ruta, festival);
        Assert.Equal(HttpStatusCode.BadRequest, telefono.StatusCode);
        Assert.Contains("telefonoCelular", await telefono.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_borrador_del_mercado_se_guarda_se_lista_se_descarta_y_se_cierra_al_crear()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory, "Organización con borradores");
        var baseRuta = $"/api/v1/externo/organizaciones/{organizacion}";

        // Un borrador en blanco —se abrió el asistente y no se tecleó nada— no es «un registro sin terminar».
        var borrador = await cliente.GetFromJsonAsync<BorradorProcesoDto>($"{baseRuta}/mercados/borrador");
        Assert.Equal("mercados", borrador!.Dominio);
        Assert.Empty(await cliente.GetFromJsonAsync<List<BorradorPendienteDto>>($"{baseRuta}/borradores-pendientes") ?? []);

        var guardado = await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/borradores-proceso/{borrador.Id}",
            new GuardarBorradorProcesoSolicitud { DatosJson = "{\"nombre\":\"Mercado a medias\",\"nivelCobertura\":\"municipal\"}", Version = borrador.Version });
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);

        var pendientes = await cliente.GetFromJsonAsync<List<BorradorPendienteDto>>($"{baseRuta}/borradores-pendientes");
        var uno = Assert.Single(pendientes!);
        Assert.Equal("mercados", uno.ModuloId);
        Assert.Equal("Mercado a medias", uno.Nombre);

        // Crear el mercado cierra el borrador exacto: no vuelve a ofrecerse ni a recuperarse.
        var creado = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"{baseRuta}/mercados", UnMercado(m => m.BorradorProcesoId = borrador.Id));
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        Assert.Empty(await cliente.GetFromJsonAsync<List<BorradorPendienteDto>>($"{baseRuta}/borradores-pendientes") ?? []);
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            Assert.Equal("cerrado", (await db.BorradoresDeProceso.AsNoTracking().SingleAsync(item => item.Id == long.Parse(borrador.Id, System.Globalization.CultureInfo.InvariantCulture))).Estado);
        }

        // Descartar: otro borrador con contenido, y «Descartar» lo cancela.
        var otro = await cliente.GetFromJsonAsync<BorradorProcesoDto>($"{baseRuta}/mercados/borrador");
        (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/borradores-proceso/{otro!.Id}",
            new GuardarBorradorProcesoSolicitud { DatosJson = "{\"nombre\":\"Otro a medias\"}", Version = otro.Version })).EnsureSuccessStatusCode();
        Assert.Single(await cliente.GetFromJsonAsync<List<BorradorPendienteDto>>($"{baseRuta}/borradores-pendientes") ?? []);

        var descartado = await EnviarAsync(cliente, csrf, HttpMethod.Delete, $"/api/v1/externo/borradores-proceso/{otro.Id}");
        Assert.Equal(HttpStatusCode.NoContent, descartado.StatusCode);
        Assert.Empty(await cliente.GetFromJsonAsync<List<BorradorPendienteDto>>($"{baseRuta}/borradores-pendientes") ?? []);
    }

    [Fact]
    public async Task Nadie_ve_ni_descarta_los_borradores_de_otra_persona()
    {
        await using var factory = new TestWebApplicationFactory();
        var (uno, organizacionUno, csrfUno) = await OrganizacionAsync(factory, "Organización uno");
        var (otro, organizacionOtro, csrfOtro) = await OrganizacionAsync(factory, "Organización otra");

        var borrador = await uno.GetFromJsonAsync<BorradorProcesoDto>($"/api/v1/externo/organizaciones/{organizacionUno}/mercados/borrador");
        (await EnviarAsync(uno, csrfUno, HttpMethod.Put, $"/api/v1/externo/borradores-proceso/{borrador!.Id}",
            new GuardarBorradorProcesoSolicitud { DatosJson = "{\"nombre\":\"Privado\"}", Version = borrador.Version })).EnsureSuccessStatusCode();

        // Su lista de pendientes en SU organización no incluye el borrador ajeno.
        Assert.Empty(await otro.GetFromJsonAsync<List<BorradorPendienteDto>>($"/api/v1/externo/organizaciones/{organizacionOtro}/borradores-pendientes") ?? []);
        // Pedir los de la organización ajena se niega.
        Assert.Equal(HttpStatusCode.NotFound, (await otro.GetAsync($"/api/v1/externo/organizaciones/{organizacionUno}/borradores-pendientes")).StatusCode);
        // Y descartar el borrador ajeno también.
        Assert.Equal(HttpStatusCode.NotFound, (await EnviarAsync(otro, csrfOtro, HttpMethod.Delete, $"/api/v1/externo/borradores-proceso/{borrador.Id}")).StatusCode);
    }
}
