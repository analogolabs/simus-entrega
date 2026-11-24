using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;
using static SIMUS.Api.Tests.RolesDeOrganizacionTests;

namespace SIMUS.Api.Tests;

/// <summary>
///: el ciclo del Festival —crear, revisar, publicar— y su historial de estados, leído con la
/// pieza compartida de desde la organización y desde la consola.
/// </summary>
/// <remarks>
/// <b>«APROBADO» NO ES UN PASO.</b> Aprobar es publicar (<c>docs/referencia/20-decisiones-y-flujos-por-modulo.md</c> §20.2): ninguna transición
/// escribe <c>aprobado</c>, ni en el Festival ni en su historial.
/// </remarks>
public sealed class FlujoDeFestivalesTests
{
    private const string Consola = "/api/v1/institucional/festivales";

    private static async Task<int> FestivalAsync(Sesion sesion, int organizacionId)
    {
        var creado = await EnviarAsync(sesion, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacionId}/festivales", new
        {
            nombre = "Festival con historial " + Guid.NewGuid().ToString("N")[..6],
            nivelCobertura = "nacional", sedeCodigoDepartamento = "05", sedeCodigoMunicipio = "05001",
            practicasMusicalesIds = Array.Empty<int>(),
            territoriosSonorosIds = Array.Empty<int>(),
        });
        creado.EnsureSuccessStatusCode();
        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        return int.Parse(cuerpo.GetProperty("id").GetString()!, CultureInfo.InvariantCulture);
    }

    private static async Task<HttpClient> FuncionarioAsync(TestWebApplicationFactory factory)
    {
        var consola = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var testigo = await consola.GetFromJsonAsync<TokenAntiforgeryRespuesta>($"{Consola}/csrf");
        consola.DefaultRequestHeaders.Add("X-CSRF-TOKEN", testigo!.RequestToken);
        return consola;
    }

    private static string Historial(int organizacionId, int festivalId) =>
        $"/api/v1/externo/organizaciones/{organizacionId}/festivales/{festivalId}/historial";

    [Fact]
    public async Task Rechazar_deja_el_motivo_y_la_organizacion_lo_lee_firmado_por_el_Programa()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacionId) = await OrganizacionAsync(factory, "Organización con Festival rechazado");
        var festivalId = await FestivalAsync(administradora, organizacionId);
        (await EnviarAsync(administradora, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/enviar-a-revision", new { }))
            .EnsureSuccessStatusCode();

        var consola = await FuncionarioAsync(factory);
        (await consola.PostAsJsonAsync($"{Consola}/{festivalId}/decisiones",
            new { accion = "Rechazar", motivoRechazo = "No es un Festival: es un concierto único." })).EnsureSuccessStatusCode();

        var enPanel = await administradora.Cliente.GetFromJsonAsync<List<EntradaDeHistorialDeEstadosDto>>(Historial(organizacionId, festivalId));
        Assert.NotNull(enPanel);
        Assert.Equal(2, enPanel!.Count);
        var rechazo = enPanel[0];
        Assert.Equal("FestivalRechazado", rechazo.Accion);
        Assert.Equal("Rechazado", rechazo.AccionEtiqueta);
        Assert.Equal("en_revision", rechazo.EstadoAnterior);
        Assert.Equal("rechazado", rechazo.EstadoNuevo);
        Assert.Equal("No es un Festival: es un concierto único.", rechazo.Motivo);
        Assert.Equal("Equipo del PNMC", rechazo.Actor);
        var envio = enPanel[1];
        Assert.Equal("Enviado a revisión", envio.AccionEtiqueta);
        Assert.Equal("borrador", envio.EstadoAnterior);
        Assert.Equal("en_revision", envio.EstadoNuevo);
        Assert.NotEqual("Equipo del PNMC", envio.Actor);

        // LA CONSOLA NOMBRA A QUIEN DECIDIÓ.
        var enConsola = await consola.GetFromJsonAsync<List<EntradaDeHistorialDeEstadosDto>>($"{Consola}/{festivalId}/historial");
        Assert.NotNull(enConsola);
        Assert.False(string.IsNullOrWhiteSpace(enConsola![0].Actor));
        Assert.NotEqual("Equipo del PNMC", enConsola[0].Actor);
    }

    [Theory]
    [InlineData("Rechazar")]
    [InlineData("SolicitarAjustes")]
    public async Task Devolver_o_rechazar_sin_motivo_no_se_admite(string accion)
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacionId) = await OrganizacionAsync(factory, "Organización sin motivo");
        var festivalId = await FestivalAsync(administradora, organizacionId);
        (await EnviarAsync(administradora, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/enviar-a-revision", new { }))
            .EnsureSuccessStatusCode();

        var consola = await FuncionarioAsync(factory);
        var respuesta = await consola.PostAsJsonAsync($"{Consola}/{festivalId}/decisiones", new { accion, motivoRechazo = "  ", observacion = "" });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task Publicar_va_de_en_revision_a_publicado_sin_pasar_por_aprobado()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacionId) = await OrganizacionAsync(factory, "Organización con Festival publicado");
        var festivalId = await FestivalAsync(administradora, organizacionId);
        (await EnviarAsync(administradora, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/enviar-a-revision", new { }))
            .EnsureSuccessStatusCode();

        var consola = await FuncionarioAsync(factory);
        (await consola.PostAsJsonAsync($"{Consola}/{festivalId}/decisiones", new { accion = "Publicar" })).EnsureSuccessStatusCode();

        var historial = await consola.GetFromJsonAsync<List<EntradaDeHistorialDeEstadosDto>>($"{Consola}/{festivalId}/historial");
        Assert.NotNull(historial);
        Assert.Equal(["publicado", "en_revision"], historial!.Select(h => h.EstadoNuevo).ToArray());
        Assert.Equal("Aprobado y publicado", historial![0].AccionEtiqueta);
        Assert.DoesNotContain(historial!, h => h.EstadoNuevo == "aprobado" || h.EstadoAnterior == "aprobado");

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal("publicado", (await db.FestivalRecords.AsNoTracking().SingleAsync(f => f.Id == festivalId)).StatusCode);
    }

    [Fact]
    public async Task Retirar_de_la_revision_o_eliminar_el_borrador_queda_en_el_historial()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacionId) = await OrganizacionAsync(factory, "Organización que retira");
        var festivalId = await FestivalAsync(administradora, organizacionId);
        (await EnviarAsync(administradora, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/enviar-a-revision", new { }))
            .EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(administradora, HttpMethod.Delete, $"/api/v1/externo/festivales/{festivalId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(administradora, HttpMethod.Delete, $"/api/v1/externo/festivales/{festivalId}")).StatusCode);

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var registro = festivalId.ToString(CultureInfo.InvariantCulture);
        var filas = await db.HistorialesRevisionRegistros.AsNoTracking()
            .Where(h => h.ModuloId == Modulos.Festivales && h.RegistroId == registro)
            .OrderBy(h => h.Id).ToListAsync();
        Assert.Equal(["FestivalEnviadoARevision", "FestivalRetiradoDeRevision", "FestivalBorradorArchivado"], filas.Select(h => h.Accion).ToArray());
        Assert.Equal(("en_revision", "borrador"), (filas[1].EstadoAnterior, filas[1].EstadoNuevo));
        Assert.Equal(("borrador", "archivado"), (filas[2].EstadoAnterior, filas[2].EstadoNuevo));
    }

    [Fact]
    public async Task El_editor_lee_el_historial_pero_no_envia_a_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacionId) = await OrganizacionAsync(factory, "Organización con editor de Festivales");
        var correoEditor = $"editor.{Guid.NewGuid():N}@organizacion.test";
        await MiembroAsync(factory, organizacionId, "editor", correoEditor);
        var editor = await EntrarAsync(factory, correoEditor);
        var festivalId = await FestivalAsync(administradora, organizacionId);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await EnviarAsync(editor, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/enviar-a-revision", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await editor.Cliente.GetAsync(Historial(organizacionId, festivalId))).StatusCode);
    }

    [Fact]
    public async Task El_historial_de_un_Festival_ajeno_no_se_lee_ni_desde_fuera_de_la_consola()
    {
        await using var factory = new TestWebApplicationFactory();
        var (duena, organizacionId) = await OrganizacionAsync(factory, "Organización dueña");
        var festivalId = await FestivalAsync(duena, organizacionId);
        var (otra, otraOrganizacion) = await OrganizacionAsync(factory, "Organización ajena");

        Assert.Equal(HttpStatusCode.NotFound, (await otra.Cliente.GetAsync(Historial(otraOrganizacion, festivalId))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otra.Cliente.GetAsync(Historial(organizacionId, festivalId))).StatusCode);

        // LA LECTURA DE LA CONSOLA, CON SUS NOMBRES, NO ESTÁ AL ALCANCE DE UNA CUENTA EXTERNA.
        var desdeFuera = await duena.Cliente.GetAsync($"{Consola}/{festivalId}/historial");
        Assert.True(desdeFuera.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound, desdeFuera.StatusCode.ToString());
    }
}
