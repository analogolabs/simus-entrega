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
/// LA SEDE PRINCIPAL DE TODO PROCESO (decisión 119): un solo modelo y un solo validador
/// para Festival, Mercado, Taller, Espacio y Red.
/// </summary>
/// <remarks>
/// La sede es aparte de la cobertura: un proceso de cobertura nacional también la lleva, y el mapa
/// lee la sede. Lo que ya existía sin sede no se bloquea: queda pendiente de completar.
/// </remarks>
public sealed class SedePrincipalDeLosProcesosTests
{
    private const string Clave = "ClaveExterna123";

    /// <summary>La base de pruebas trae solo Bogotá y Medellín: se añade Cali para tener un segundo departamento.</summary>
    private static async Task SembrarCaliAsync(TestWebApplicationFactory factory)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        if (await db.DivipolaLocations.AnyAsync(d => d.MunicipalityCode == "76001")) return;
        db.DivipolaLocations.Add(new DivipolaLocationRow
        {
            DepartmentCode = "76", DepartmentName = "Valle del Cauca", MunicipalityCode = "76001", MunicipalityName = "Cali", LocationType = "MUNICIPALITY",
        });
        await db.SaveChangesAsync();
    }

    // ───────────────────────────── La regla, sin la API ─────────────────────────────

    [Theory]
    [InlineData("municipal", "05", "05001", "05", "05001")]
    [InlineData("departamental", "05", null, "05", null)]
    [InlineData("nacional", null, null, null, null)]
    public void Sin_sede_elegida_sale_del_territorio_de_la_cobertura(
        string nivel, string? departamento, string? municipio, string? sedeDepartamento, string? sedeMunicipio)
    {
        var sede = SedePrincipal.Resolver(null, null, nivel, departamento, municipio);

        Assert.Equal((sedeDepartamento, sedeMunicipio), sede);
    }

    [Fact]
    public void La_sede_elegida_gana_sobre_la_cobertura_aunque_sea_nacional()
    {
        var sede = SedePrincipal.Resolver("11", "11001", "nacional", null, null);

        Assert.Equal(("11", "11001"), sede);
    }

    [Fact]
    public async Task El_validador_exige_que_existan_y_que_el_municipio_sea_del_departamento()
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarCaliAsync(factory);
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();

        Assert.Empty(await SedePrincipal.ErroresAsync(db, "05", "05001", default));
        Assert.Contains(SedePrincipal.ClaveDepartamento, (await SedePrincipal.ErroresAsync(db, null, null, default)).Keys);
        Assert.Contains(SedePrincipal.ClaveDepartamento, (await SedePrincipal.ErroresAsync(db, "98", "98001", default)).Keys);
        Assert.Contains(SedePrincipal.ClaveMunicipio, (await SedePrincipal.ErroresAsync(db, "05", null, default)).Keys);
        // Un municipio que existe, pero de otro departamento.
        Assert.Contains(SedePrincipal.ClaveMunicipio, (await SedePrincipal.ErroresAsync(db, "76", "05001", default)).Keys);
    }

    [Fact]
    public async Task Un_proceso_sin_sede_se_lee_sin_nombres_y_queda_pendiente()
    {
        await using var factory = new TestWebApplicationFactory();
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var sinSede = new TallerRow();
        var conSede = new TallerRow { SedeCodigoDepartamento = "05", SedeCodigoMunicipio = "05001" };

        var nombres = await SedePrincipal.ResolverNombresAsync(db, [sinSede, conSede], default);

        Assert.True(SedePrincipal.Pendiente(sinSede));
        Assert.Null(nombres(sinSede));
        Assert.False(SedePrincipal.Pendiente(conSede));
        Assert.Equal("05001", nombres(conSede)!.CodigoMunicipio);
        Assert.False(string.IsNullOrWhiteSpace(nombres(conSede)!.NombreMunicipio));
    }

    // ───────────────────────────── Por la API: Taller ─────────────────────────────

    private static async Task<(HttpClient Sesion, int OrganizacionId, string Csrf)> OrganizacionAsync(TestWebApplicationFactory factory)
    {
        var cliente = factory.CreateClient();
        var correo = $"sede.{Guid.NewGuid():N}@organizacion.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización con sede",
            FullName = "Persona responsable",
            NumeroDocumento = "1020304051",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            HeadquartersDepartmentCode = "05",
            HeadquartersMunicipalityCode = "05001",
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        await CorreoConfirmadoEnPruebas.ConfirmarAsync(factory, correo);
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();
        var csrf = (await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf"))
            .GetProperty("requestToken").GetString()!;
        var mias = await cliente.GetFromJsonAsync<List<OrganizacionAdministradaDto>>("/api/v1/externo/organizaciones/mis");
        return (cliente, int.Parse(mias![0].Id, CultureInfo.InvariantCulture), csrf);
    }

    private static async Task<HttpResponseMessage> EnviarAsync(
        HttpClient cliente, string csrf, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var peticion = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) peticion.Content = JsonContent.Create(cuerpo);
        peticion.Headers.Add("X-CSRF-TOKEN", csrf);
        return await cliente.SendAsync(peticion);
    }

    private static async Task<(List<int> Servicios, List<int> Familias)> CatalogosAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var servicios = await db.ServiciosDeTaller.AsNoTracking().OrderBy(x => x.Id).Take(1).Select(x => x.Id).ToListAsync();
        var familias = await db.FamiliasDeInstrumentos.AsNoTracking().Where(x => x.FamiliaPadreId == null)
            .OrderBy(x => x.Id).Take(1).Select(x => x.Id).ToListAsync();
        return (servicios, familias);
    }

    private static TallerUpsertRequest UnTaller(List<int> servicios, List<int> familias, string nivel = "nacional") => new()
    {
        Nombre = "Taller con sede principal",
        Descripcion = "Construcción y reparación de guitarras.",
        Modalidad = "fijo",
        CorreoTaller = "sede@taller.test",
        NivelCobertura = nivel,
        CodigoDepartamento = nivel == "nacional" ? null : "05",
        CodigoMunicipio = nivel == "municipal" ? "05001" : null,
        ServiciosIds = servicios,
        FamiliasIds = familias,
    };

    [Fact]
    public async Task Un_taller_de_cobertura_nacional_sin_sede_se_rechaza_y_con_sede_se_guarda_y_se_lee()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var ruta = $"/api/v1/externo/organizaciones/{organizacion}/talleres";

        var sinSede = await EnviarAsync(cliente, csrf, HttpMethod.Post, ruta, UnTaller(servicios, familias));
        Assert.Equal(HttpStatusCode.BadRequest, sinSede.StatusCode);
        Assert.Contains(SedePrincipal.ClaveDepartamento, await sinSede.Content.ReadAsStringAsync());

        var cuerpo = UnTaller(servicios, familias);
        cuerpo.SedeCodigoDepartamento = "11";
        cuerpo.SedeCodigoMunicipio = "11001";
        var creado = await EnviarAsync(cliente, csrf, HttpMethod.Post, ruta, cuerpo);
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var taller = (await creado.Content.ReadFromJsonAsync<TallerDto>())!;
        // La cobertura sigue siendo nacional y sin territorio: la sede es otro dato.
        Assert.Equal("nacional", taller.NivelCobertura);
        Assert.Null(taller.CodigoDepartamento);
        Assert.Equal("11001", taller.Sede!.CodigoMunicipio);
        Assert.False(string.IsNullOrWhiteSpace(taller.Sede.NombreDepartamento));
    }

    [Fact]
    public async Task Un_taller_municipal_sin_sede_la_toma_del_municipio_de_su_cobertura()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);

        var creado = await EnviarAsync(cliente, csrf, HttpMethod.Post,
            $"/api/v1/externo/organizaciones/{organizacion}/talleres", UnTaller(servicios, familias, "municipal"));

        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var taller = (await creado.Content.ReadFromJsonAsync<TallerDto>())!;
        Assert.Equal("05", taller.Sede!.CodigoDepartamento);
        Assert.Equal("05001", taller.Sede.CodigoMunicipio);
    }

    [Theory]
    [InlineData("05", null, SedePrincipal.ClaveMunicipio)]
    [InlineData("76", "05001", SedePrincipal.ClaveMunicipio)]
    [InlineData("98", "98001", SedePrincipal.ClaveDepartamento)]
    public async Task Una_sede_incompleta_o_que_no_existe_se_rechaza_con_el_campo_que_hay_que_corregir(
        string departamento, string? municipio, string campo)
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarCaliAsync(factory);
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var cuerpo = UnTaller(servicios, familias);
        cuerpo.SedeCodigoDepartamento = departamento;
        cuerpo.SedeCodigoMunicipio = municipio;

        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacion}/talleres", cuerpo);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains(campo, await respuesta.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Un_taller_que_ya_existia_sin_sede_se_lee_y_se_le_pide_la_sede_al_enviarlo_a_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var cuerpo = UnTaller(servicios, familias);
        cuerpo.SedeCodigoDepartamento = "11";
        cuerpo.SedeCodigoMunicipio = "11001";
        var taller = (await (await EnviarAsync(cliente, csrf, HttpMethod.Post,
            $"/api/v1/externo/organizaciones/{organizacion}/talleres", cuerpo)).Content.ReadFromJsonAsync<TallerDto>())!;

        // Lo que había antes de la migración: sin sede.
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.Talleres.SingleAsync(t => t.Id == taller.Id);
            fila.SedeCodigoDepartamento = null;
            fila.SedeCodigoMunicipio = null;
            await db.SaveChangesAsync();
        }

        var leido = await cliente.GetFromJsonAsync<TallerDto>($"/api/v1/externo/talleres/{taller.Id}");
        Assert.Null(leido!.Sede);

        var envio = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/talleres/{taller.Id}/enviar-a-revision", new { });
        Assert.Equal(HttpStatusCode.BadRequest, envio.StatusCode);
        Assert.Contains(SedePrincipal.ClaveDepartamento, await envio.Content.ReadAsStringAsync());

        // Se completa en la edición y el envío pasa.
        cuerpo.SedeCodigoDepartamento = "05";
        cuerpo.SedeCodigoMunicipio = "05001";
        var guardado = await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", cuerpo);
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        var reenvio = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/talleres/{taller.Id}/enviar-a-revision", new { });
        Assert.Equal(HttpStatusCode.OK, reenvio.StatusCode);
    }

    // ───────────────────────────── El mapa lee la sede ─────────────────────────────

    [Fact]
    public async Task El_mapa_situa_un_festival_nacional_en_su_sede_y_no_en_su_cobertura()
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarCaliAsync(factory);
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            db.FestivalRecords.Add(new FestivalRow
            {
                Name = "Festival nacional con sede en Valle",
                CoverageLevel = "nacional",
                SedeCodigoDepartamento = "76",
                SedeCodigoMunicipio = "76001",
                StatusCode = "publicado",
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
        var cliente = factory.CreateClient();

        var resumen = await cliente.GetFromJsonAsync<ResumenAnaliticoFestivalesDto>("/api/v1/publico/analitica/festivales/resumen");
        Assert.Contains(resumen!.PorDepartamento, d => d.Total >= 1 && d.Nombre.Contains("Valle", StringComparison.OrdinalIgnoreCase));

        var listado = await cliente.GetFromJsonAsync<PagedResponse<FestivalPublicoDto>>("/api/v1/publico/festivales?limit=100&offset=0");
        var festival = Assert.Single(listado!.Items, f => f.Nombre == "Festival nacional con sede en Valle");
        Assert.Contains("Valle", festival.TerritorioPrincipal.Departamento, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Cali", festival.TerritorioPrincipal.Municipio, StringComparison.OrdinalIgnoreCase);
    }

    // ───────────────────── La sede de lo publicado se corrige como errata ─────────────────────

    [Fact]
    public async Task La_organizacion_corrige_la_sede_de_un_festival_publicado_sin_devolverlo_a_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarCaliAsync(factory);
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory);
        var id = await EventosDeOrganizacionTests.FestivalAsync(cliente, factory, organizacion, publicado: true);

        var invalida = await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/festivales/{id}/sede",
            new { sedeCodigoDepartamento = "76", sedeCodigoMunicipio = "05001" });
        Assert.Equal(HttpStatusCode.BadRequest, invalida.StatusCode);

        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/festivales/{id}/sede",
            new { sedeCodigoDepartamento = "76", sedeCodigoMunicipio = "76001" });
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var festival = await db.FestivalRecords.AsNoTracking().SingleAsync(f => f.Id == id);
        Assert.Equal("publicado", festival.StatusCode);
        Assert.Equal(("76", "76001"), (festival.SedeCodigoDepartamento, festival.SedeCodigoMunicipio));
        var clave = id.ToString(CultureInfo.InvariantCulture);
        Assert.Contains(await db.CambiosDeRegistro.AsNoTracking().Where(c => c.ModuloId == "festivales" && c.RegistroId == clave).ToListAsync(),
            c => c.CampoId == "sedeCodigoMunicipio" && c.ValorNuevo == "76001");
    }

    [Fact]
    public async Task Otra_organizacion_no_corrige_la_sede_y_la_consola_si_puede()
    {
        await using var factory = new TestWebApplicationFactory();
        await SembrarCaliAsync(factory);
        var (duena, organizacionDuena, _) = await OrganizacionAsync(factory);
        var (ajena, _, csrfAjena) = await OrganizacionAsync(factory);
        var id = await EventosDeOrganizacionTests.FestivalAsync(duena, factory, organizacionDuena, publicado: true);

        var ajeno = await EnviarAsync(ajena, csrfAjena, HttpMethod.Put, $"/api/v1/externo/festivales/{id}/sede",
            new { sedeCodigoDepartamento = "76", sedeCodigoMunicipio = "76001" });
        Assert.True(ajeno.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound);

        using var consola = await CmsTestClient.LoginAsync(factory, withCsrf: true);
        var respuesta = await consola.PutAsJsonAsync($"/api/v1/institucional/festivales/{id}/sede",
            new { sedeCodigoDepartamento = "76", sedeCodigoMunicipio = "76001" });
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
    }
}
