using System.Globalization;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// PNMC-054 - El contenido de una propuesta que NO acabo Publicada no puede llegar nunca a la
/// lectura publica anonima. El circuito de revision solo vale algo si rechazar produce un cambio
/// observable en lo que ve el ciudadano.
/// </summary>
public sealed class Pnmc054LecturaPublicaTests : IClassFixture<TestWebApplicationFactory>
{
    private const string CorreoAprobado = "contacto.institucional@festival.test";
    private const string CorreoRechazado = "secuestrado@atacante.test";
    // Las dos periodicidades ya estaban sembradas; ahora ademas se nombran, porque son el
    // centinela que distingue el contenido aprobado del rechazado en la lectura publica.
    private const string PeriodicidadAprobada = "anual";
    private const string PeriodicidadRechazada = "bienal";
    private const string DepartamentoAprobado = "Antioquia";
    // El nombre canonico DIVIPOLA del codigo 11 lleva coma (DatabaseBootstrapper.cs).
    // La prueba siembra el CODIGO y la lectura publica devuelve el NOMBRE resuelto.
    private const string DepartamentoRechazado = "Bogota, D.C.";

    private readonly TestWebApplicationFactory _factory;

    public Pnmc054LecturaPublicaTests(TestWebApplicationFactory factory) => _factory = factory;

    /// <summary>
    /// El criterio de PR-4: LO PÚBLICO ES LA CABECERA, y una propuesta que no se aplicó nunca la escribió. Por eso
    /// rechazar no necesita «repudiar» nada: la lectura sigue sirviendo lo que ya había. Se recorre por HTTP el camino
    /// real: la línea base prueba que PUBLICAR sí cambia lo que ve el público (la cabecera, por el espejo de PR-2) y
    /// que RECHAZAR no lo toca.
    /// </summary>
    [Fact]
    public async Task Una_Propuesta_Rechazada_Nunca_Toca_La_Cabecera_Y_No_Llega_A_La_Lectura_Publica()
    {
        var (festivalRechazado, propuestaRechazada) = SembrarFestivalConPropuestaEnRevision();
        var (festivalPublicado, propuestaPublicada) = SembrarFestivalConPropuestaEnRevision();

        var institucional = await CrearClienteInstitucionalAsync();
        await DecidirAsync(institucional, propuestaRechazada, new { accion = "Rechazar", motivoRechazo = "No corresponde." });
        await DecidirAsync(institucional, propuestaPublicada, new { accion = "Publicar" });

        var anonimo = _factory.CreateClient();

        // Línea base: publicar SÍ cambia la lectura pública. Sin esta comprobación la aserción siguiente podría
        // pasar por accidente aunque el circuito entero estuviera muerto.
        var publicada = await anonimo.GetFromJsonAsync<FestivalPublicoDto>($"/api/v1/publico/festivales/{festivalPublicado}");
        Assert.NotNull(publicada);
        Assert.Equal(DepartamentoRechazado, publicada!.TerritorioPrincipal.Departamento);
        Assert.Equal(PeriodicidadRechazada, publicada.Periodicidad);

        var rechazada = await anonimo.GetFromJsonAsync<FestivalPublicoDto>($"/api/v1/publico/festivales/{festivalRechazado}");
        Assert.NotNull(rechazada);
        Assert.Equal(DepartamentoAprobado, rechazada!.TerritorioPrincipal.Departamento);
        Assert.Equal(PeriodicidadAprobada, rechazada.Periodicidad);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var cabecera = db.FestivalRecords.Single(item => item.Id == festivalRechazado);
        Assert.Equal("05", cabecera.DepartmentCode);
        Assert.Equal("anual", cabecera.Periodicidad);

        var listado = await anonimo.GetFromJsonAsync<PagedResponse<FestivalPublicoDto>>("/api/v1/publico/festivales?limit=500");
        Assert.NotNull(listado);
        var enListado = Assert.Single(listado!.Items, item => item.Id == festivalRechazado.ToString());
        Assert.Equal(PeriodicidadAprobada, enListado.Periodicidad);
    }

    private static async Task DecidirAsync(HttpClient institucional, int propuestaId, object cuerpo)
    {
        var decision = new HttpRequestMessage(
            HttpMethod.Post,
            $"/api/v1/institucional/propuestas-cambio-festival/{propuestaId}/decisiones")
        {
            Content = JsonContent.Create(cuerpo)
        };
        decision.Headers.Add("X-CSRF-TOKEN", await ObtenerCsrfPropuestasAsync(institucional));
        (await institucional.SendAsync(decision)).EnsureSuccessStatusCode();
    }

    private (int FestivalId, int PropuestaId) SembrarFestivalConPropuestaEnRevision()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var organizacion = CrearOrganizacion(db);
        var festival = new FestivalRow
        {
            Name = "Festival PNMC-054",
            CoverageLevel = "municipal",
            DepartmentCode = "05",
            MunicipalityCode = "05001",
            ContactEmail = CorreoAprobado,
            // La cabecera ya es lo publicado (PR-3): no hay perfil: el PR-8 retiró la tabla.
            Periodicidad = "anual",
            StatusCode = "Publicado",
            OrganizacionPrincipalId = organizacion.Id,
            CreatedAt = DateTime.UtcNow
        };
        db.FestivalRecords.Add(festival);
        db.SaveChanges();

        // EL EXPEDIENTE, EN LA FORMA GENERICA: cabecera más SOLO LOS CAMPOS QUE CAMBIAN. Es lo
        // que hace que la propuesta se distinga de la versión: aquí, el departamento y la
        // periodicidad, que son los dos centinelas que la lectura pública sí sirve.
        var propuesta = new PropuestaDeCambioRow
        {
            ModuloId = Modulos.Festivales,
            RegistroId = festival.Id.ToString(CultureInfo.InvariantCulture),
            Estado = EstadosDePropuesta.EnRevision,
            IdOrganizacion = organizacion.Id,
            IdUsuarioProponente = 1,
            FechaCreacion = DateTime.UtcNow.AddHours(-3),
            FechaEnvio = DateTime.UtcNow.AddHours(-2),
            FechaActualizacion = DateTime.UtcNow.AddHours(-2),
        };
        db.PropuestasDeCambio.Add(propuesta);
        db.SaveChanges();
        db.PropuestasDeCambioCampos.AddRange(
            new PropuestaDeCambioCampoRow { IdPropuesta = propuesta.Id, SeccionId = "generales", CampoId = "descripcion", CampoEtiqueta = "Descripción", ValorAnterior = festival.Description, ValorPropuesto = "Contenido propuesto y despues rechazado", FechaCreacion = DateTime.UtcNow },
            new PropuestaDeCambioCampoRow { IdPropuesta = propuesta.Id, SeccionId = "territorio", CampoId = "codigoDepartamento", CampoEtiqueta = "Departamento", ValorAnterior = "05", ValorPropuesto = "11", FechaCreacion = DateTime.UtcNow },
            new PropuestaDeCambioCampoRow { IdPropuesta = propuesta.Id, SeccionId = "territorio", CampoId = "codigoMunicipio", CampoEtiqueta = "Municipio", ValorAnterior = "05001", ValorPropuesto = "11001", FechaCreacion = DateTime.UtcNow },
            new PropuestaDeCambioCampoRow { IdPropuesta = propuesta.Id, SeccionId = "generales", CampoId = "periodicidad", CampoEtiqueta = "Periodicidad", ValorAnterior = "anual", ValorPropuesto = "bienal", FechaCreacion = DateTime.UtcNow },
            new PropuestaDeCambioCampoRow { IdPropuesta = propuesta.Id, SeccionId = "contacto", CampoId = "correoContacto", CampoEtiqueta = "Correo de contacto", ValorAnterior = CorreoAprobado, ValorPropuesto = CorreoRechazado, FechaCreacion = DateTime.UtcNow });
        db.SaveChanges();
        return (festival.Id, (int)propuesta.Id);
    }

    private static EntityProfileRow CrearOrganizacion(SimusDbContext db)
    {
        var organizacion = new EntityProfileRow
        {
            EntityType = "organizacion",
            Name = "Organizacion proponente PNMC-054",
            CoverageLevel = "municipal",
            DepartmentCode = "05",
            MunicipalityCode = "05001",
            StatusCode = "activa",
            IsActive = true,
            CreatedByUserId = 1,
            CreatedAt = DateTime.UtcNow
        };
        db.EntityProfiles.Add(organizacion);
        db.SaveChanges();
        return organizacion;
    }

    private async Task<HttpClient> CrearClienteInstitucionalAsync()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest
        {
            Email = "test@pnmc.local",
            Password = "pnmc-master"
        });
        login.EnsureSuccessStatusCode();
        return client;
    }

    private static async Task<string> ObtenerCsrfPropuestasAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/v1/institucional/propuestas-cambio-festival/csrf");
        response.EnsureSuccessStatusCode();
        var token = await response.Content.ReadFromJsonAsync<TokenAntiforgeryRespuesta>();
        Assert.NotNull(token);
        Assert.False(string.IsNullOrWhiteSpace(token!.RequestToken));
        return token.RequestToken;
    }
}
