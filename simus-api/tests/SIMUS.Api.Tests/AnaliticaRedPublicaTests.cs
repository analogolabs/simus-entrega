using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La red del ecosistema solo trae relaciones registradas, sin personas y sin atribuir al Programa lo
/// que nadie administra.
/// </summary>
public sealed class AnaliticaRedPublicaTests
{
    private const string Ruta = "/api/v1/publico/analitica/ecosistema/red";
    private static readonly string[] TiposDeArista = ["responsable", "declara", "en_el_marco"];

    [Fact]
    public async Task Une_organizacion_proceso_y_territorio_solo_donde_hay_una_relacion_registrada()
    {
        await using var factory = new TestWebApplicationFactory();
        int organizacionId;
        int institucionalId;
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var organizacion = new EntityProfileRow { Name = "RED Corporación Sonora", IsInstitutional = false };
            // La organización institucional ya existe en la base de pruebas: se usa esa, no una segunda.
            var institucional = db.EntityProfiles.FirstOrDefault(item => item.IsInstitutional)
                ?? new EntityProfileRow { Name = "RED Programa", IsInstitutional = true };
            if (institucional.Id == 0) db.EntityProfiles.Add(institucional);
            db.EntityProfiles.Add(organizacion);
            await db.SaveChangesAsync();
            organizacionId = organizacion.Id;
            institucionalId = institucional.Id;

            db.FestivalRecords.AddRange(
                new FestivalRow { Name = "RED festival con organización", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = "publicado", OrganizacionPrincipalId = organizacion.Id, CreatedAt = DateTime.UtcNow },
                new FestivalRow { Name = "RED festival histórico", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = "publicado", OrganizacionPrincipalId = institucional.Id, CreatedAt = DateTime.UtcNow },
                new FestivalRow { Name = "RED festival borrador", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = "borrador", OrganizacionPrincipalId = organizacion.Id, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        var red = await factory.CreateClient().GetFromJsonAsync<RedDelEcosistemaDto>(Ruta);

        Assert.NotNull(red);
        Assert.Contains(red!.Nodos, n => n.Tipo == "festival" && n.Nombre == "RED festival con organización");
        Assert.Contains(red.Nodos, n => n.Tipo == "festival" && n.Nombre == "RED festival histórico");
        Assert.DoesNotContain(red.Nodos, n => n.Nombre == "RED festival borrador");
        var festival = red.Nodos.Single(n => n.Nombre == "RED festival con organización");
        Assert.Contains(red.Aristas, a => a.Origen == $"organizacion:{organizacionId}" && a.Destino == festival.Id && a.Tipo == "responsable");
        // El Programa no es «organización responsable» de un registro histórico: no hay nodo ni arista.
        Assert.DoesNotContain(red.Nodos, n => n.Id == $"organizacion:{institucionalId}");
        Assert.DoesNotContain(red.Nodos, n => n.Tipo is not ("organizacion" or "festival" or "mercado" or "territorio" or "practica"));
        Assert.All(red.Aristas, a => Assert.Contains(a.Tipo, TiposDeArista));
    }

    [Fact]
    public async Task Es_anonima_y_toda_arista_une_dos_nodos_que_existen()
    {
        await using var factory = new TestWebApplicationFactory();
        var respuesta = await factory.CreateClient().GetAsync(Ruta);
        respuesta.EnsureSuccessStatusCode();
        var red = await respuesta.Content.ReadFromJsonAsync<RedDelEcosistemaDto>();
        Assert.NotNull(red);
        var ids = red!.Nodos.Select(n => n.Id).ToHashSet();
        Assert.All(red.Aristas, a => { Assert.Contains(a.Origen, ids); Assert.Contains(a.Destino, ids); });
        Assert.False(red.Truncada);
    }
}
