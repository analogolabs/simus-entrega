using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La lectura «evolución» del tablero público del ecosistema: ediciones publicadas por año, tipo de
/// proceso y departamento de la sede. Solo cuenta lo publicado y solo devuelve conteos.
/// </summary>
public sealed class AnaliticaEvolucionPublicaTests
{
    private const string Ruta = "/api/v1/publico/analitica/ecosistema/evolucion";

    [Fact]
    public async Task Cuenta_las_ediciones_publicadas_por_anio_y_departamento_sin_traer_borradores()
    {
        await using var factory = new TestWebApplicationFactory();
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var publicado = new FestivalRow { Name = "EVO festival publicado", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = "publicado", CreatedAt = DateTime.UtcNow };
            var borrador = new FestivalRow { Name = "EVO festival borrador", CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = "borrador", CreatedAt = DateTime.UtcNow };
            db.FestivalRecords.AddRange(publicado, borrador);
            await db.SaveChangesAsync();

            EdicionFestivalRow Edicion(int festivalId, int anio, string visibilidad) => new()
            {
                FestivalId = festivalId, Anio = anio, Nombre = $"Edición {anio}", Estado = "realizada",
                EstadoRegistro = "publicado", EstadoVisibilidad = visibilidad, FechaCreacion = DateTime.UtcNow,
            };
            db.EdicionesFestival.AddRange(
                Edicion(publicado.Id, 2019, "publicada"),
                Edicion(publicado.Id, 2020, "publicada"),
                Edicion(publicado.Id, 2021, "borrador"),
                Edicion(borrador.Id, 2019, "publicada"));
            await db.SaveChangesAsync();
        }

        var respuesta = await factory.CreateClient().GetFromJsonAsync<EvolucionAnaliticaDto>(Ruta);

        Assert.NotNull(respuesta);
        var festivales = respuesta!.Puntos.Where(p => p.Proceso == "festival").ToList();
        Assert.Equal(1, festivales.Single(p => p.Anio == 2019).Total);
        Assert.Equal(1, festivales.Single(p => p.Anio == 2020).Total);
        Assert.DoesNotContain(festivales, p => p.Anio == 2021);
        Assert.All(festivales, p => Assert.Contains("Antioquia", p.Departamento ?? string.Empty, StringComparison.OrdinalIgnoreCase));
        Assert.Equal(festivales.OrderBy(p => p.Anio).Select(p => p.Anio), festivales.Select(p => p.Anio));
    }

    [Fact]
    public async Task Es_anonima_y_responde_vacia_sin_datos()
    {
        await using var factory = new TestWebApplicationFactory();
        var respuesta = await factory.CreateClient().GetAsync(Ruta);
        respuesta.EnsureSuccessStatusCode();
        var cuerpo = await respuesta.Content.ReadFromJsonAsync<EvolucionAnaliticaDto>();
        Assert.NotNull(cuerpo);
        Assert.DoesNotContain(cuerpo!.Puntos, p => p.Total <= 0);
    }
}
