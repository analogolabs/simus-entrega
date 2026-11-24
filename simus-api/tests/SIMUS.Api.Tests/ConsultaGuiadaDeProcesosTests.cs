using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La Consulta Guiada de Talleres, Espacios y Redes (decisión 123): UNA implementación para los tres tipos,
/// con la misma lectura que los mercados. Cuenta lo que hay, por estado y por departamento.
/// </summary>
public sealed class ConsultaGuiadaDeProcesosTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public ConsultaGuiadaDeProcesosTests(TestWebApplicationFactory factory) => _factory = factory;

    private static async Task<RespuestaDeConsultaGuiadaDto> PreguntarAsync(HttpClient cliente, string pregunta)
    {
        var respuesta = await cliente.PostAsJsonAsync("/api/v1/admin/analisis/consultar", new { pregunta });
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<RespuestaDeConsultaGuiadaDto>())!;
    }

    [Fact]
    public async Task Los_tres_tipos_se_cuentan_por_estado_y_por_departamento_con_la_misma_forma()
    {
        await using var factory = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var entidad = new EntityProfileRow
            {
                EntityType = "organizacion", Name = "Organización de los procesos", StatusCode = "activa",
                IsActive = true, CreatedByUserId = 1, CreatedAt = DateTime.UtcNow,
            };
            db.EntityProfiles.Add(entidad);
            await db.SaveChangesAsync();
            var ahora = DateTime.UtcNow;
            db.Talleres.AddRange(
                new TallerRow { Nombre = "Taller A", NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001", OrganizacionPrincipalId = entidad.Id, EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora },
                new TallerRow { Nombre = "Taller B", NivelCobertura = "departamental", CodigoDepartamento = "05", OrganizacionPrincipalId = entidad.Id, EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora },
                new TallerRow { Nombre = "Taller C", NivelCobertura = "nacional", OrganizacionPrincipalId = entidad.Id, EstadoRegistro = "borrador", Activo = true, FechaCreacion = ahora });
            db.Espacios.Add(new EspacioRow { Nombre = "Espacio A", NivelCobertura = "municipal", CodigoDepartamento = "05", CodigoMunicipio = "05001", OrganizacionPrincipalId = entidad.Id, EstadoRegistro = "publicado", Activo = true, FechaCreacion = ahora });
            db.Redes.Add(new RedRow { Nombre = "Red A", NivelCobertura = "nacional", OrganizacionPrincipalId = entidad.Id, EstadoRegistro = "borrador", Activo = true, FechaCreacion = ahora });
            await db.SaveChangesAsync();
        }

        var resumen = await PreguntarAsync(cliente, "¿cuántos talleres de lutería hay?");
        Assert.Equal("resumen_de_talleres", resumen.ConsultaElegida);
        Assert.Contains("3 talleres de lutería registrados", resumen.Respuesta, StringComparison.Ordinal);
        Assert.Contains("2 publicados", resumen.Respuesta, StringComparison.Ordinal);

        var borradores = await PreguntarAsync(cliente, "¿cuántos talleres hay en borrador?");
        Assert.Equal("resumen_de_talleres", borradores.ConsultaElegida);
        Assert.Contains("1 taller de lutería", borradores.Respuesta, StringComparison.Ordinal);

        var porDepartamento = await PreguntarAsync(cliente, "¿en qué departamentos hay talleres de lutería?");
        Assert.Equal("talleres_por_departamento", porDepartamento.ConsultaElegida);
        Assert.NotNull(porDepartamento.Consulta);
        Assert.Equal("2", Assert.Single(porDepartamento.Consulta!.Filas)[1]);

        var espacios = await PreguntarAsync(cliente, "¿cuántos espacios para música en vivo hay?");
        Assert.Equal("resumen_de_espacios", espacios.ConsultaElegida);
        Assert.Contains("1 espacio para música en vivo registrado", espacios.Respuesta, StringComparison.Ordinal);

        var redes = await PreguntarAsync(cliente, "¿cuántas redes hay?");
        Assert.Equal("resumen_de_redes", redes.ConsultaElegida);
        Assert.Contains("1 red o centro de documentación registrada", redes.Respuesta, StringComparison.Ordinal);
        Assert.Contains("0 publicadas", redes.Respuesta, StringComparison.Ordinal);

        // LA FRONTERA: una pregunta sobre talleres no recibe la cifra de los Festivales.
        var enRevision = await PreguntarAsync(cliente, "¿cuántos talleres hay en revisión?");
        Assert.Equal("resumen_de_talleres", enRevision.ConsultaElegida);
    }
}
