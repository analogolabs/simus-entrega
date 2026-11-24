using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Las fichas públicas de Festival y Mercado enlazan a la ficha de su organización.
/// </summary>
/// <remarks>
/// <b>SOLO SI ESA FICHA EXISTE.</b> /ecosistema/organizaciones/:id responde únicamente para una
/// organización activa y revisada por la consola; un enlace a una organización
/// suspendida o sin revisar terminaría en «no disponible». Por eso el DTO trae
/// <c>OrganizacionPublicaId</c> solo cuando hay ficha, y la prueba siembra una organización de cada
/// clase.
/// </remarks>
public sealed class EnlaceALaOrganizacionEnFichasPublicasTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public EnlaceALaOrganizacionEnFichasPublicasTests(TestWebApplicationFactory factory) => _factory = factory;

    private (int Organizacion, int Festival, int Mercado) Sembrar(string nombre, string estado, bool revisada = true)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();

        var organizacion = new EntityProfileRow
        {
            EntityType = "organizacion",
            Name = nombre,
            CoverageLevel = "municipal",
            DepartmentCode = "05",
            MunicipalityCode = "05001",
            StatusCode = estado,
            IsActive = true,
            CreatedByUserId = 1,
            CreatedAt = DateTime.UtcNow,
            FechaRevisionConsola = revisada ? DateTime.UtcNow : null,
            IdUsuarioRevisionConsola = revisada ? 1 : null,
        };
        db.EntityProfiles.Add(organizacion);
        db.SaveChanges();

        var festival = new FestivalRow
        {
            Name = "Festival de " + nombre,
            CoverageLevel = "municipal",
            DepartmentCode = "05",
            MunicipalityCode = "05001",
            StatusCode = "Publicado",
            OrganizacionPrincipalId = organizacion.Id,
            CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        db.SaveChanges();

        var mercado = new MercadoRow
        {
            Nombre = "Mercado de " + nombre,
            NivelCobertura = "municipal",
            CodigoDepartamento = "05",
            CodigoMunicipio = "05001",
            OrganizacionPrincipalId = organizacion.Id,
            EstadoRegistro = "publicado",
            FechaPublicacion = DateTime.UtcNow,
            FechaCreacion = DateTime.UtcNow,
        };
        db.Mercados.Add(mercado);
        db.SaveChanges();

        return (organizacion.Id, festival.Id, mercado.Id);
    }

    [Fact]
    public async Task La_ficha_lleva_a_la_organizacion_solo_si_esta_tiene_ficha_publica()
    {
        var activa = Sembrar("Organización activa con ficha", "activa");
        var suspendida = Sembrar("Organización suspendida sin ficha", "inactiva");
        var sinRevisar = Sembrar("Organización activa sin revisar", "activa", revisada: false);
        var anonimo = _factory.CreateClient();

        // CENTINELA: la ficha de la organización activa existe y la de la suspendida no.
        Assert.True((await anonimo.GetAsync($"/api/v1/publico/organizaciones/{activa.Organizacion}")).IsSuccessStatusCode);
        Assert.False((await anonimo.GetAsync($"/api/v1/publico/organizaciones/{suspendida.Organizacion}")).IsSuccessStatusCode);

        var festivalActiva = await anonimo.GetFromJsonAsync<FestivalPublicoDto>($"/api/v1/publico/festivales/{activa.Festival}");
        var festivalSuspendida = await anonimo.GetFromJsonAsync<FestivalPublicoDto>($"/api/v1/publico/festivales/{suspendida.Festival}");
        Assert.Equal(activa.Organizacion, festivalActiva!.OrganizacionPublicaId);
        Assert.Equal("Organización suspendida sin ficha", festivalSuspendida!.OrganizacionResponsable);
        Assert.Null(festivalSuspendida.OrganizacionPublicaId);

        var mercadoActiva = await anonimo.GetFromJsonAsync<MercadoPublicoDto>($"/api/v1/publico/mercados/{activa.Mercado}");
        var mercadoSuspendida = await anonimo.GetFromJsonAsync<MercadoPublicoDto>($"/api/v1/publico/mercados/{suspendida.Mercado}");
        Assert.Equal(activa.Organizacion, mercadoActiva!.OrganizacionPublicaId);
        Assert.Equal("Organización suspendida sin ficha", mercadoSuspendida!.OrganizacionNombre);
        Assert.Null(mercadoSuspendida.OrganizacionPublicaId);

        // ACTIVA NO BASTA: sin la revisión de la consola no hay ficha ni enlace.
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/organizaciones/{sinRevisar.Organizacion}")).StatusCode);
        var festivalSinRevisar = await anonimo.GetFromJsonAsync<FestivalPublicoDto>($"/api/v1/publico/festivales/{sinRevisar.Festival}");
        Assert.Equal("Organización activa sin revisar", festivalSinRevisar!.OrganizacionResponsable);
        Assert.Null(festivalSinRevisar.OrganizacionPublicaId);
        var mercadoSinRevisar = await anonimo.GetFromJsonAsync<MercadoPublicoDto>($"/api/v1/publico/mercados/{sinRevisar.Mercado}");
        Assert.Null(mercadoSinRevisar!.OrganizacionPublicaId);

        // EL LISTADO USA LA MISMA REGLA que la ficha: no hay dos definiciones de «tiene ficha».
        var listado = await anonimo.GetFromJsonAsync<PagedResponse<MercadoPublicoDto>>("/api/v1/publico/mercados");
        Assert.Equal(activa.Organizacion, listado!.Items.Single(m => m.Id == activa.Mercado).OrganizacionPublicaId);
        Assert.Null(listado.Items.Single(m => m.Id == suspendida.Mercado).OrganizacionPublicaId);
        Assert.Null(listado.Items.Single(m => m.Id == sinRevisar.Mercado).OrganizacionPublicaId);
    }
}
