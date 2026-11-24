using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// «Mi actividad y solicitudes» y la insignia de Solicitudes del panel (SOL): lo que espera a la
/// organización, lo que espera respuesta y lo resuelto, leído de los circuitos que ya existen.
/// </summary>
public sealed class SolicitudesDeLaCuentaTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private static async Task SembrarAsync(TestWebApplicationFactory factory, int organizacionId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;
        db.FestivalRecords.Add(new FestivalRow { Name = "Festival en revisión", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.EnRevision, OrganizacionPrincipalId = organizacionId, CreatedAt = ahora });
        db.FestivalRecords.Add(new FestivalRow { Name = "Festival con ajustes", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.AjustesSolicitados, OrganizacionPrincipalId = organizacionId, CreatedAt = ahora });
        db.FestivalRecords.Add(new FestivalRow { Name = "Festival rechazado", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.Rechazado, OrganizacionPrincipalId = organizacionId, CreatedAt = ahora });
        db.FestivalRecords.Add(new FestivalRow { Name = "Festival en borrador", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.Borrador, OrganizacionPrincipalId = organizacionId, CreatedAt = ahora });
        db.Mercados.Add(new MercadoRow { Nombre = "Mercado en revisión", NivelCobertura = "nacional", OrganizacionPrincipalId = organizacionId, EstadoRegistro = "en_revision", Activo = true, FechaCreacion = ahora });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task La_organizacion_ve_lo_que_espera_su_accion_lo_que_espera_respuesta_y_lo_resuelto()
    {
        using var factory = new TestWebApplicationFactory();
        var (org, organizacionId) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);
        await SembrarAsync(factory, organizacionId);

        var lista = await org.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>($"/api/v1/externo/organizaciones/{organizacionId}/solicitudes", Web);

        Assert.NotNull(lista);
        Assert.Equal(["Festival con ajustes"], lista!.Where(i => i.Espera == "tu_accion").Select(i => i.Titulo));
        Assert.Equal(["Festival en revisión", "Mercado en revisión"], lista.Where(i => i.Espera == "en_espera").Select(i => i.Titulo).OrderBy(t => t));
        Assert.Equal(["Festival rechazado"], lista.Where(i => i.Espera == "resuelta").Select(i => i.Titulo));
        // Un borrador no es una solicitud: nadie ha pedido nada todavía.
        Assert.DoesNotContain(lista, i => i.Titulo == "Festival en borrador");
        // Las pendientes van primero y cada una trae adónde se atiende.
        Assert.Equal("tu_accion", lista[0].Espera);
        Assert.All(lista, i => Assert.StartsWith($"/gestion/o/{organizacionId}/", i.Ruta));
    }

    [Fact]
    public async Task El_conteo_de_la_insignia_coincide_con_la_lista()
    {
        using var factory = new TestWebApplicationFactory();
        var (org, organizacionId) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);
        await SembrarAsync(factory, organizacionId);

        var conteo = await org.Sesion.GetFromJsonAsync<ConteoDeSolicitudesDto>($"/api/v1/externo/organizaciones/{organizacionId}/solicitudes/conteo", Web);

        Assert.Equal(new ConteoDeSolicitudesDto(1, 2, 1), conteo);
    }

    private static async Task SembrarResueltasAsync(TestWebApplicationFactory factory, int organizacionId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;
        db.FestivalRecords.Add(new FestivalRow { Name = "Festival resuelto antiguo", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.Rechazado, OrganizacionPrincipalId = organizacionId, CreatedAt = ahora.AddDays(-200), UpdatedAt = ahora.AddDays(-120) });
        db.FestivalRecords.Add(new FestivalRow { Name = "Festival resuelto más antiguo", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.Rechazado, OrganizacionPrincipalId = organizacionId, CreatedAt = ahora.AddDays(-400), UpdatedAt = ahora.AddDays(-300) });
        db.FestivalRecords.Add(new FestivalRow { Name = "Festival resuelto reciente", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.Rechazado, OrganizacionPrincipalId = organizacionId, CreatedAt = ahora.AddDays(-20), UpdatedAt = ahora.AddDays(-10) });
        db.FestivalRecords.Add(new FestivalRow { Name = "Festival en revisión viejo", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = EstadosFestival.EnRevision, OrganizacionPrincipalId = organizacionId, CreatedAt = ahora.AddDays(-200), UpdatedAt = ahora.AddDays(-150) });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Las_resueltas_de_mas_de_90_dias_salen_de_la_lista_normal_y_se_listan_en_archivadas_sin_perderse()
    {
        using var factory = new TestWebApplicationFactory();
        var (org, organizacionId) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);
        await SembrarResueltasAsync(factory, organizacionId);
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/solicitudes";

        var normal = await org.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>(ruta, Web);
        var archivadas = await org.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>($"{ruta}?archivadas=true", Web);

        Assert.Equal(["Festival en revisión viejo", "Festival resuelto reciente"], normal!.Select(i => i.Titulo));
        // Solo resueltas con más de 90 días, la más reciente primero; una pendiente vieja nunca se archiva.
        Assert.Equal(["Festival resuelto antiguo", "Festival resuelto más antiguo"], archivadas!.Select(i => i.Titulo));
        Assert.All(archivadas!, i => Assert.Equal("resuelta", i.Espera));
        // Pedir archivadas no cambia el conteo ni la insignia, y lo archivado sigue contado como resuelto.
        var conteo = await org.Sesion.GetFromJsonAsync<ConteoDeSolicitudesDto>($"{ruta}/conteo", Web);
        Assert.Equal(new ConteoDeSolicitudesDto(0, 1, 3), conteo);
        // Nada se borró.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal(4, db.FestivalRecords.Count(f => f.OrganizacionPrincipalId == organizacionId));
    }

    [Fact]
    public async Task Las_archivadas_de_la_cuenta_siguen_siendo_solo_las_propias_y_las_ajenas_no_se_leen()
    {
        using var factory = new TestWebApplicationFactory();
        var (org, organizacionId) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);
        var (_, ajena) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);
        await SembrarResueltasAsync(factory, organizacionId);
        await SembrarResueltasAsync(factory, ajena);

        var archivadas = await org.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>("/api/v1/externo/cuenta/solicitudes?archivadas=true", Web);
        Assert.Equal(2, archivadas!.Count);
        Assert.All(archivadas, i => Assert.Equal(organizacionId, i.OrganizacionId));

        var persona = await AgendamientoDeCitasTests.PersonaAsync(factory);
        Assert.Equal(HttpStatusCode.NotFound, (await persona.Sesion.GetAsync($"/api/v1/externo/organizaciones/{ajena}/solicitudes?archivadas=true")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/v1/externo/cuenta/solicitudes?archivadas=true")).StatusCode);
    }

    [Fact]
    public async Task Sin_solicitudes_el_conteo_es_cero()
    {
        using var factory = new TestWebApplicationFactory();
        var (org, organizacionId) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);

        var conteo = await org.Sesion.GetFromJsonAsync<ConteoDeSolicitudesDto>($"/api/v1/externo/organizaciones/{organizacionId}/solicitudes/conteo", Web);

        Assert.Equal(new ConteoDeSolicitudesDto(0, 0, 0), conteo);
    }

    [Fact]
    public async Task Una_organizacion_ajena_no_se_lee()
    {
        using var factory = new TestWebApplicationFactory();
        var (_, organizacionAjena) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);
        var persona = await AgendamientoDeCitasTests.PersonaAsync(factory);

        Assert.Equal(HttpStatusCode.NotFound, (await persona.Sesion.GetAsync($"/api/v1/externo/organizaciones/{organizacionAjena}/solicitudes")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await persona.Sesion.GetAsync($"/api/v1/externo/organizaciones/{organizacionAjena}/solicitudes/conteo")).StatusCode);
    }

    [Fact]
    public async Task Sin_sesion_responde_401()
    {
        using var factory = new TestWebApplicationFactory();
        var cliente = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await cliente.GetAsync("/api/v1/externo/cuenta/solicitudes")).StatusCode);
    }

    [Fact]
    public async Task La_cuenta_reune_las_solicitudes_de_sus_organizaciones_y_no_las_de_otras()
    {
        using var factory = new TestWebApplicationFactory();
        var (org, organizacionId) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);
        var (_, otra) = await AgendamientoDeCitasTests.OrganizacionAsync(factory);
        await SembrarAsync(factory, organizacionId);
        await SembrarAsync(factory, otra);

        var lista = await org.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>("/api/v1/externo/cuenta/solicitudes", Web);

        Assert.Equal(4, lista!.Count);
        Assert.All(lista, i => Assert.Equal(organizacionId, i.OrganizacionId));
        Assert.All(lista, i => Assert.False(string.IsNullOrEmpty(i.OrganizacionNombre)));
    }

    [Fact]
    public async Task Los_procesos_propios_de_una_persona_sin_organizacion_aparecen_en_su_cuenta()
    {
        using var factory = new TestWebApplicationFactory();
        var persona = await AgendamientoDeCitasTests.PersonaAsync(factory);
        var perfil = await persona.Sesion.GetFromJsonAsync<JsonElement>("/api/v1/externo/cuenta/perfil");
        Assert.Equal(JsonValueKind.Object, perfil.ValueKind);
        var vacia = await persona.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>("/api/v1/externo/cuenta/solicitudes", Web);
        Assert.Empty(vacia!);
    }
}
