using System.Globalization;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// LA PRUEBA DORADA del retiro de <c>dbo.PerfilesPublicosFestival</c> (PR-4, adaptada en el PR-6 al desaparecer el
/// interruptor <c>Festivales:LecturaDesdePerfilLegado</c> y en el PR-8 al desaparecer la tabla): lo que ve el público sale de la cabecera. Con la cabecera
/// igual a lo publicado (el estado en que PR-3 la deja) se piden las respuestas JSON públicas (la ficha, el listado, las
/// ediciones y el resumen de analítica) y se comparan con lo esperado, y dos pedidos seguidos dan la misma respuesta
/// byte a byte.
/// </summary>
/// <remarks>
/// Los casos que habrían separado la lectura por cabecera de la legada si alguien se equivocara: un Festival sin perfil
/// (histórico), uno con el teléfono retirado A PROPÓSITO, uno cuya última versión del perfil fue repudiada (la cabecera
/// guarda la aprobada), uno con listas en el perfil y otras distintas en la cabecera, y un borrador que no debe salir en
/// ninguna. El PR-8 retiró la tabla del perfil: ya no hay filas de respaldo que sembrar.
/// </remarks>
public sealed class LecturaPublicaDesdeLaCabeceraDoradaTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly TestWebApplicationFactory _factory;

    public LecturaPublicaDesdeLaCabeceraDoradaTests(TestWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task Las_Respuestas_Publicas_Salen_De_La_Cabecera_Y_Son_Estables_Byte_A_Byte()
    {
        var ids = Sembrar();
        var anonimo = _factory.CreateClient();
        var rutas = new List<string>
        {
            "/api/v1/publico/festivales?limit=500",
            "/api/v1/publico/analitica/festivales/resumen",
        };
        foreach (var id in ids.Publicados)
        {
            rutas.Add($"/api/v1/publico/festivales/{id}");
            rutas.Add($"/api/v1/publico/festivales/{id}/ediciones");
        }
        rutas.Add($"/api/v1/publico/festivales/{ids.Borrador}");

        var primera = await CapturarAsync(anonimo, rutas);
        var segunda = await CapturarAsync(anonimo, rutas);

        Assert.Equal(rutas.Count, primera.Length);
        for (var i = 0; i < rutas.Count; i++)
            Assert.True(string.Equals(primera[i], segunda[i], StringComparison.Ordinal), $"La respuesta de {rutas[i]} no es estable.");

        // Lo publicado es la cabecera: nombre, teléfono retirado, periodicidad y listas de la cabecera.
        var listado = primera[0];
        Assert.Contains("Festival dorado histórico", listado);
        Assert.Contains("Festival dorado con perfil (publicado)", listado);
        Assert.Contains("Festival dorado sin teléfono (publicado)", listado);
        Assert.Contains("Festival dorado repudiado (aprobada)", listado);
        Assert.DoesNotContain("Borrador dorado", listado);
        Assert.DoesNotContain("(rechazada)", string.Concat(primera));
        Assert.DoesNotContain("3999999999", string.Concat(primera));
        Assert.Contains("\"periodicidad\":\"bienal\"", primera[4]); // la de la cabecera, no la del alta
        Assert.StartsWith("404", primera[^1], StringComparison.Ordinal);
        Assert.DoesNotContain(primera, r => r.StartsWith("5", StringComparison.Ordinal));
    }

    private static async Task<string[]> CapturarAsync(HttpClient cliente, IReadOnlyList<string> rutas)
    {
        var capturas = new List<string>();
        foreach (var ruta in rutas)
        {
            using var respuesta = await cliente.GetAsync(ruta);
            capturas.Add($"{(int)respuesta.StatusCode} {await respuesta.Content.ReadAsStringAsync()}");
        }
        return [.. capturas];
    }

    private (int[] Publicados, int Borrador) Sembrar()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;
        var organizacion = new EntityProfileRow
        {
            EntityType = "organizacion", Name = "Organización dorada", CoverageLevel = "municipal", DepartmentCode = "05",
            MunicipalityCode = "05001", StatusCode = "activa", IsActive = true, CreatedByUserId = 1, CreatedAt = ahora,
        };
        db.EntityProfiles.Add(organizacion);
        var practicaA = new PracticaMusicalRow { Nombre = "Práctica dorada A", Slug = "practica-dorada-a", Orden = 90 };
        var practicaB = new PracticaMusicalRow { Nombre = "Práctica dorada B", Slug = "practica-dorada-b", Orden = 91 };
        var territorio = new TerritorioSonoroRow { Nombre = "Territorio dorado" };
        db.PracticasMusicales.AddRange(practicaA, practicaB);
        db.TerritoriosSonoros.Add(territorio);
        db.SaveChanges();

        FestivalRow Nuevo(string nombre, string estado) => new()
        {
            Name = nombre, CoverageLevel = "municipal", DepartmentCode = "05", MunicipalityCode = "05001",
            Periodicidad = "anual", ContactEmail = "dorado@festival.test", ContactPhone = "3000000000",
            InstagramUrl = "https://instagram.test/dorado", StatusCode = estado, OrganizacionPrincipalId = organizacion.Id,
            CreatedAt = ahora,
        };

        // 1. Histórico: solo cabecera, con listas en la cabecera.
        var historico = Nuevo("Festival dorado histórico", "publicado");
        // 2. Con valores publicados que difieren del alta, escritos en la cabecera (así los deja una propuesta aplicada).
        var conPerfil = Nuevo("Festival dorado con perfil (publicado)", "publicado");
        // 3. Con teléfono retirado a propósito.
        var sinTelefono = Nuevo("Festival dorado sin teléfono (publicado)", "Publicado");
        // 4. Con una propuesta posterior rechazada: nunca escribió la cabecera, que guarda lo aprobado.
        var repudiado = Nuevo("Festival dorado repudiado (aprobada)", "publicado");
        var borrador = Nuevo("Borrador dorado", "borrador");
        conPerfil.Description = "Descripción de Festival dorado con perfil (publicado)";
        conPerfil.CoverageLevel = "departamental"; conPerfil.MunicipalityCode = null; conPerfil.Periodicidad = "bienal";
        conPerfil.ContactEmail = "perfil@festival.test"; conPerfil.ContactPhone = "3111111111";
        sinTelefono.Description = "Descripción de Festival dorado sin teléfono (publicado)";
        sinTelefono.CoverageLevel = "departamental"; sinTelefono.MunicipalityCode = null;
        sinTelefono.ContactEmail = "perfil@festival.test"; sinTelefono.ContactPhone = null;
        repudiado.Description = "Descripción de Festival dorado repudiado (aprobada)";
        repudiado.CoverageLevel = "departamental"; repudiado.MunicipalityCode = null;
        repudiado.ContactEmail = "perfil@festival.test"; repudiado.ContactPhone = "3222222222";
        db.FestivalRecords.AddRange(historico, conPerfil, sinTelefono, repudiado, borrador);
        db.SaveChanges();

        db.Agregar<PracticaMusicalDeRegistroRow>(Modulos.Festivales, historico.Id, [practicaA.Id, practicaB.Id], ahora);
        db.Agregar<TerritorioSonoroDeRegistroRow>(Modulos.Festivales, historico.Id, [territorio.Id], ahora);
        db.PropuestasDeCambio.Add(new PropuestaDeCambioRow
        {
            ModuloId = Modulos.Festivales, RegistroId = repudiado.Id.ToString(CultureInfo.InvariantCulture),
            IdOrganizacion = organizacion.Id, IdUsuarioProponente = 1, Estado = EstadosDePropuesta.Rechazada,
            MotivoDeLaDecision = "No corresponde.", FechaCreacion = ahora.AddDays(-1), FechaEnvio = ahora.AddHours(-2),
            FechaDecision = ahora, FechaActualizacion = ahora,
        });
        db.Agregar<PracticaMusicalDeRegistroRow>(Modulos.Festivales, conPerfil.Id, [practicaB.Id], ahora);
        db.Agregar<TerritorioSonoroDeRegistroRow>(Modulos.Festivales, repudiado.Id, [territorio.Id], ahora);
        db.SaveChanges();

        return ([historico.Id, conPerfil.Id, sinTelefono.Id, repudiado.Id], borrador.Id);
    }
}
