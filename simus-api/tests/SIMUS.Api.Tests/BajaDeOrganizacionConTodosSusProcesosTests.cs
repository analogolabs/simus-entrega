using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;
using static SIMUS.Api.Tests.ProcesosDeLuteriaEnLaAgenda;

namespace SIMUS.Api.Tests;

/// <summary>
/// Dar de baja una organización resuelve TODOS sus procesos —Festivales, Mercados, Talleres, Espacios y Redes—
/// con la misma regla (docs/desarrollo/30-consola-y-acceso.md §30.17, decisión 134): liberar los devuelve al Programa, archivar los saca del
/// sitio público y archiva sus eventos de la Agenda; el aviso previo trae el conteo de eventos. Nada se borra.
/// </summary>
public sealed class BajaDeOrganizacionConTodosSusProcesosTests
{
    private static async Task<int> MercadoAsync(IServiceProvider servicios, int organizacionId, string estado = "publicado")
    {
        using var alcance = servicios.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var mercado = new MercadoRow
        {
            Nombre = "Mercado de la baja",
            NivelCobertura = "nacional",
            OrganizacionPrincipalId = organizacionId,
            EstadoRegistro = estado,
            Activo = true,
            FechaCreacion = DateTime.UtcNow,
            FechaPublicacion = DateTime.UtcNow,
        };
        db.Mercados.Add(mercado);
        await db.SaveChangesAsync();
        return mercado.Id;
    }

    private static async Task<int> EventoAsync(
        TestWebApplicationFactory factory, HttpClient cliente, int organizacionId, string tipo, int proceso)
    {
        var creado = await EnviarAsync(cliente, HttpMethod.Post,
            $"/api/v1/externo/organizaciones/{organizacionId}/eventos", Evento(tipo, proceso, $"Evento de {tipo}"));
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
        await PublicarAsync(factory.Services, id);
        return int.Parse(id, CultureInfo.InvariantCulture);
    }

    private static Task<HttpResponseMessage> CerrarAsync(HttpClient consola, int organizacionId, string? queHacer) =>
        consola.PostAsJsonAsync($"/api/v1/admin/organizaciones/{organizacionId}/estado", new
        {
            estado = "eliminada",
            motivo = "La organización se disolvió.",
            queHacerConLosProcesos = queHacer,
        });

    [Fact]
    public async Task Cerrar_con_procesos_simples_se_rechaza_nombrandolos_con_su_tipo_y_el_conteo_de_eventos()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "baja.aviso@example.com");
        var mercado = await MercadoAsync(factory.Services, organizacionId);
        var taller = await ProcesoAsync(factory.Services, "taller", organizacionId, null);
        var borrador = await ProcesoAsync(factory.Services, "red", organizacionId, null, estado: "borrador");
        await EventoAsync(factory, cliente, organizacionId, "taller", taller);

        var consola = await CmsTestClient.LoginAsync(factory);
        var respuesta = await CerrarAsync(consola, organizacionId, null);

        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        var nombrados = cuerpo.GetProperty("procesos").EnumerateArray()
            .Select(p => $"{p.GetProperty("tipo").GetString()}:{p.GetProperty("id").GetString()}").ToList();
        Assert.Contains($"mercado:{mercado}", nombrados);
        Assert.Contains($"taller:{taller}", nombrados);
        // Un borrador no bloquea el cierre, como en los Festivales.
        Assert.DoesNotContain($"red:{borrador}", nombrados);
        Assert.Equal(1, cuerpo.GetProperty("eventosQueSeArchivarian").GetInt32());
    }

    [Fact]
    public async Task Archivar_los_procesos_los_saca_del_sitio_archiva_sus_eventos_y_no_cambia_la_custodia()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "baja.archiva@example.com");
        var mercado = await MercadoAsync(factory.Services, organizacionId);
        var taller = await ProcesoAsync(factory.Services, "taller", organizacionId, null);
        var espacio = await ProcesoAsync(factory.Services, "espacio", organizacionId, null, estado: "en_revision");
        var red = await ProcesoAsync(factory.Services, "red", organizacionId, null);
        var eventoMercado = await EventoAsync(factory, cliente, organizacionId, "mercado", mercado);
        var eventoRed = await EventoAsync(factory, cliente, organizacionId, "red", red);

        var consola = await CmsTestClient.LoginAsync(factory);
        (await CerrarAsync(consola, organizacionId, "archivar")).EnsureSuccessStatusCode();

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal("archivado", (await db.Mercados.AsNoTracking().SingleAsync(x => x.Id == mercado)).EstadoRegistro);
        Assert.Equal("archivado", (await db.Talleres.AsNoTracking().SingleAsync(x => x.Id == taller)).EstadoRegistro);
        Assert.Equal("archivado", (await db.Espacios.AsNoTracking().SingleAsync(x => x.Id == espacio)).EstadoRegistro);
        var filaRed = await db.Redes.AsNoTracking().SingleAsync(x => x.Id == red);
        Assert.Equal("archivado", filaRed.EstadoRegistro);
        // La custodia no cambia: siguen siendo de quien los registró, y nada se borró.
        Assert.Equal(organizacionId, filaRed.OrganizacionPrincipalId);
        Assert.False(await db.AdministrationTransfers.AnyAsync(x => x.PreviousOrganizationId == organizacionId));
        Assert.True(await db.AuditLogs.AnyAsync(x => x.TableName == "Redes" && x.RecordId == red.ToString(CultureInfo.InvariantCulture)));

        // Los eventos de la Agenda se archivan con su proceso, sin borrarse.
        Assert.Equal("archivado", (await db.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == eventoMercado)).Estado);
        Assert.Equal("archivado", (await db.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == eventoRed)).Estado);
    }

    [Fact]
    public async Task Liberar_los_procesos_los_devuelve_al_programa_con_su_transferencia_y_deja_los_eventos()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "baja.libera@example.com");
        var mercado = await MercadoAsync(factory.Services, organizacionId);
        var taller = await ProcesoAsync(factory.Services, "taller", organizacionId, null);
        var espacio = await ProcesoAsync(factory.Services, "espacio", organizacionId, null);
        var red = await ProcesoAsync(factory.Services, "red", organizacionId, null);
        var eventoTaller = await EventoAsync(factory, cliente, organizacionId, "taller", taller);

        var consola = await CmsTestClient.LoginAsync(factory);
        (await CerrarAsync(consola, organizacionId, "liberar")).EnsureSuccessStatusCode();

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
        Assert.Equal(institucional, (await db.Mercados.AsNoTracking().SingleAsync(x => x.Id == mercado)).OrganizacionPrincipalId);
        Assert.Equal(institucional, (await db.Talleres.AsNoTracking().SingleAsync(x => x.Id == taller)).OrganizacionPrincipalId);
        Assert.Equal(institucional, (await db.Espacios.AsNoTracking().SingleAsync(x => x.Id == espacio)).OrganizacionPrincipalId);
        Assert.Equal(institucional, (await db.Redes.AsNoTracking().SingleAsync(x => x.Id == red)).OrganizacionPrincipalId);
        foreach (var (modulo, id) in new[] { (Modulos.Mercados, mercado), (Modulos.Talleres, taller), (Modulos.Espacios, espacio), (Modulos.Redes, red) })
        {
            Assert.True(await db.AdministrationTransfers.AnyAsync(x => x.ModuloId == modulo
                && x.CanonicalRecordId == id.ToString(CultureInfo.InvariantCulture)
                && x.PreviousOrganizationId == organizacionId && x.NewOrganizationId == institucional));
        }

        // Liberar no retira el proceso: sus eventos siguen donde estaban, como los de un Festival liberado.
        Assert.Equal("publicado", (await db.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == eventoTaller)).Estado);
    }

    [Fact]
    public async Task Un_proceso_ajeno_o_archivado_no_bloquea_ni_se_toca()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "baja.suya@example.com");
        var (_, otra) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "baja.otra@example.com");
        var ajeno = await ProcesoAsync(factory.Services, "taller", otra, null);
        await ProcesoAsync(factory.Services, "espacio", organizacionId, null, estado: "archivado");

        var consola = await CmsTestClient.LoginAsync(factory);
        (await CerrarAsync(consola, organizacionId, null)).EnsureSuccessStatusCode();

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal("publicado", (await db.Talleres.AsNoTracking().SingleAsync(x => x.Id == ajeno)).EstadoRegistro);
    }
}
