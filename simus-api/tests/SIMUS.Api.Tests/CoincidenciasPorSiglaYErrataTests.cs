using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Siglas y erratas en el asistente de alta y en la lista «¿Tu Festival ya está en SIMUS?» (COI2).
/// </summary>
/// <remarks>
/// El parecido en sí está en <see cref="ParecidoDeNombresErratasYSiglasTests"/>; aquí se prueba que el
/// TERRITORIO llega al parecido: la sigla solo avisa de un Festival del mismo departamento (o municipio),
/// y nunca del registrado con alcance nacional ni cuando la lista recorre todo el país.
/// </remarks>
public sealed class CoincidenciasPorSiglaYErrataTests
{
    private const string Clave = "ClaveExterna123";

    [Fact]
    public async Task El_asistente_avisa_de_una_sigla_con_el_mismo_departamento_y_dice_por_que()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival Internacional de Música Clásica", "05", "05088");
        var (cliente, organizacion) = await OrganizacionAsync(factory, "sigla.uno@example.com");

        var encontradas = await CoincidenciasAsync(cliente, organizacion, "FIMC", "05", "05001");

        var aviso = Assert.Single(encontradas, x => x.FestivalId == historico.ToString(CultureInfo.InvariantCulture));
        Assert.Contains(aviso.Evidencias, x => x.StartsWith("Posible coincidencia por sigla", StringComparison.Ordinal));
        // Nunca bloquea: es la misma tarjeta de siempre, con la razón añadida.
        Assert.Equal("HistoricoReclamable", aviso.TipoCoincidencia);
    }

    [Fact]
    public async Task La_sigla_no_avisa_de_otro_departamento_ni_de_un_Festival_sin_departamento()
    {
        await using var factory = new TestWebApplicationFactory();
        var otroDepartamento = await HistoricoAsync(factory, "Festival Internacional de Música Clásica", "08", "08001");
        var nacional = await HistoricoAsync(factory, "Festival Internacional de Música Clásica", null, null);
        var (cliente, organizacion) = await OrganizacionAsync(factory, "sigla.dos@example.com");

        var encontradas = await CoincidenciasAsync(cliente, organizacion, "FIMC", "05", "05001");

        Assert.DoesNotContain(encontradas, x => x.FestivalId == otroDepartamento.ToString(CultureInfo.InvariantCulture));
        // El registrado sin departamento entra a la búsqueda (el territorio ordena, no filtra) pero SIN
        // respaldo de territorio la sigla no avisa: «FIMC» podría ser de cualquier parte.
        Assert.DoesNotContain(encontradas, x => x.FestivalId == nacional.ToString(CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task Una_sigla_de_una_serie_de_Festivales_con_la_misma_plantilla_es_ambigua_y_no_avisa()
    {
        await using var factory = new TestWebApplicationFactory();
        var anori = await HistoricoAsync(factory, "Festival de Canta y Torbellino de Anorí", "05", "05040");
        var anza = await HistoricoAsync(factory, "Festival de Canta y Torbellino de Anzá", "05", "05044");
        var (cliente, organizacion) = await OrganizacionAsync(factory, "sigla.serie@example.com");

        // «FCTA» son las iniciales de los dos: no dice cuál es el suyo, así que no avisa de ninguno.
        var porSigla = await CoincidenciasAsync(cliente, organizacion, "FCTA", "05", "05001");
        Assert.DoesNotContain(porSigla, x => x.FestivalId == anori.ToString(CultureInfo.InvariantCulture));
        Assert.DoesNotContain(porSigla, x => x.FestivalId == anza.ToString(CultureInfo.InvariantCulture));

        // Por el nombre completo sí encuentra el suyo.
        var porNombre = await CoincidenciasAsync(cliente, organizacion, "Festival de Canta y Torbellino de Anorí", "05", "05001");
        Assert.Contains(porNombre, x => x.FestivalId == anori.ToString(CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task Una_sigla_de_tres_letras_necesita_el_mismo_municipio()
    {
        await using var factory = new TestWebApplicationFactory();
        var otroMunicipio = await HistoricoAsync(factory, "Festival de Música Andina", "05", "05088");
        var mismoMunicipio = await HistoricoAsync(factory, "Festival de Música Andina", "05", "05001");
        var (cliente, organizacion) = await OrganizacionAsync(factory, "sigla.tres@example.com");

        var encontradas = await CoincidenciasAsync(cliente, organizacion, "FMA", "05", "05001");

        Assert.DoesNotContain(encontradas, x => x.FestivalId == otroMunicipio.ToString(CultureInfo.InvariantCulture));
        Assert.Contains(encontradas, x => x.FestivalId == mismoMunicipio.ToString(CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task El_asistente_avisa_de_una_errata_de_tecleo_y_no_de_dos_municipios_con_una_letra_de_diferencia()
    {
        await using var factory = new TestWebApplicationFactory();
        var currulao = await HistoricoAsync(factory, "Festival Currulao de Guapi", "05", "05001");
        var neiva = await HistoricoAsync(factory, "Festival de Cuerdas de Neiva", "05", "05001");
        var (cliente, organizacion) = await OrganizacionAsync(factory, "errata.uno@example.com");

        var conErrata = await CoincidenciasAsync(cliente, organizacion, "Festival Currulo de Guapi", "05", "05001");
        var aviso = Assert.Single(conErrata, x => x.FestivalId == currulao.ToString(CultureInfo.InvariantCulture));
        Assert.Contains(aviso.Evidencias, x => x.StartsWith("Posible errata de tecleo", StringComparison.Ordinal));

        var otroMunicipio = await CoincidenciasAsync(cliente, organizacion, "Festival de Cuerdas de Leiva", "05", "05001");
        Assert.DoesNotContain(otroMunicipio, x => x.FestivalId == neiva.ToString(CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task La_lista_de_historicos_encuentra_por_sigla_en_el_departamento_y_no_en_todo_el_pais()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival Internacional de Música Clásica", "05", "05088");
        var (cliente, organizacion) = await OrganizacionAsync(factory, "sigla.lista@example.com");
        var id = historico.ToString(CultureInfo.InvariantCulture);

        // Sin departamento explícito se usa el de la sede de la organización (05): respalda la sigla.
        var delDepartamento = (await cliente.GetFromJsonAsync<HistoricosReclamablesDto>(
            $"/api/v1/externo/organizaciones/{organizacion}/festivales/historicos?buscar=FIMC"))!;
        Assert.Contains(delDepartamento.Festivales, x => x.FestivalId == id);

        // Con «todos» no hay territorio que respalde la sigla: no avisa.
        var detodoElPais = (await cliente.GetFromJsonAsync<HistoricosReclamablesDto>(
            $"/api/v1/externo/organizaciones/{organizacion}/festivales/historicos?buscar=FIMC&codigoDepartamento=todos"))!;
        Assert.DoesNotContain(detodoElPais.Festivales, x => x.FestivalId == id);
    }

    [Fact]
    public async Task La_lista_de_historicos_encuentra_una_errata_en_todo_el_pais()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival Currulao de Guapi", "19", "19001");
        var (cliente, organizacion) = await OrganizacionAsync(factory, "errata.lista@example.com");

        var lista = (await cliente.GetFromJsonAsync<HistoricosReclamablesDto>(
            $"/api/v1/externo/organizaciones/{organizacion}/festivales/historicos?buscar={Uri.EscapeDataString("Festival Currulo de Guapi")}&codigoDepartamento=todos"))!;

        // La errata no necesita territorio de respaldo: es del nombre.
        Assert.Contains(lista.Festivales, x => x.FestivalId == historico.ToString(CultureInfo.InvariantCulture));
    }

    // ---------- Andamio ------------------------------------------------------------------------

    private static async Task<int> HistoricoAsync(TestWebApplicationFactory factory, string nombre, string? departamento, string? municipio)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
        var festival = new FestivalRow
        {
            Name = nombre, Description = "Registro histórico de prueba.", CoverageLevel = municipio is null ? "departamental" : "municipal",
            DepartmentCode = departamento, MunicipalityCode = municipio, StatusCode = "publicado", OrganizacionPrincipalId = institucional,
            CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();
        return festival.Id;
    }

    private static async Task<(HttpClient Cliente, int OrganizacionId)> OrganizacionAsync(TestWebApplicationFactory factory, string correo)
    {
        var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización de " + correo,
            FullName = "Responsable de la organización",
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = "05",
            HeadquartersMunicipalityCode = "05001",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var mias = await client.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/mis");
        return (client, int.Parse(mias[0].GetProperty("id").GetString()!, CultureInfo.InvariantCulture));
    }

    private static async Task<List<CoincidenciaFestivalHistoricoDto>> CoincidenciasAsync(HttpClient cliente, int organizacionId, string nombre, string departamento, string municipio) =>
        (await cliente.GetFromJsonAsync<List<CoincidenciaFestivalHistoricoDto>>(
            $"/api/v1/externo/organizaciones/{organizacionId}/festivales/coincidencias-historicas?nombre={Uri.EscapeDataString(nombre)}&codigoDepartamento={departamento}&codigoMunicipio={municipio}"))!;
}
