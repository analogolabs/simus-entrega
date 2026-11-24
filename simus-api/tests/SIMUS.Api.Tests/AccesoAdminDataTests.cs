using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Quién puede usar <c>/api/v1/admin/data</c>, decidido en el servidor.
/// </summary>
/// <remarks>
/// <para>
/// La consola oculta «Salud del sistema» a quien no es webmaster, pero ocultar un menú no es
/// autorizar: un <c>gestor_interno</c> podía leer estructura, conteos y monitor llamando a la ruta.
/// </para>
/// <para>
/// La lista de Festivales (<c>/records/festivals</c>) vive en el mismo prefijo pero no es salud del
/// sistema: es el trabajo del módulo Ecosistema. Sigue la regla de cualquier módulo de la consola.
/// </para>
/// </remarks>
public sealed class AccesoAdminDataTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Gestor = "gestor@simus.test";
    private const string ClaveGestor = "pnmc-gestor";
    private const string ListaDeFestivales = "/api/v1/admin/data/records/festivals";

    public static TheoryData<string> SaludDelSistema => new()
    {
        "/api/v1/admin/data/schema",
        "/api/v1/admin/data/stats",
        "/api/v1/admin/data/monitor",
    };

    private readonly TestWebApplicationFactory _factory;

    public AccesoAdminDataTests(TestWebApplicationFactory factory) => _factory = factory;

    [Theory]
    [MemberData(nameof(SaludDelSistema))]
    public async Task Un_gestor_no_puede_leer_la_salud_del_sistema(string ruta)
    {
        var gestor = await SesionDelGestorAsync(conEcosistema: true, withCsrf: false);

        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync(ruta)).StatusCode);
    }

    [Theory]
    [MemberData(nameof(SaludDelSistema))]
    public async Task El_webmaster_conserva_la_salud_del_sistema(string ruta)
    {
        var webmaster = await CmsTestClient.LoginAsync(_factory, withCsrf: false);

        Assert.Equal(HttpStatusCode.OK, (await webmaster.GetAsync(ruta)).StatusCode);
    }

    [Fact]
    public async Task Un_gestor_no_puede_cambiar_estados_desde_admin_data()
    {
        var gestor = await SesionDelGestorAsync(conEcosistema: true, withCsrf: true);

        var respuesta = await gestor.PostAsJsonAsync($"{ListaDeFestivales}/1/status", new { status = "publicado" });

        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }

    [Fact]
    public async Task Un_gestor_con_el_modulo_Ecosistema_ve_la_lista_de_Festivales()
    {
        var gestor = await SesionDelGestorAsync(conEcosistema: true, withCsrf: false);

        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync(ListaDeFestivales)).StatusCode);
    }

    [Fact]
    public async Task Un_gestor_sin_el_modulo_Ecosistema_no_ve_la_lista_de_Festivales()
    {
        var gestor = await SesionDelGestorAsync(conEcosistema: false, withCsrf: false);

        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync(ListaDeFestivales)).StatusCode);
    }

    [Fact]
    public async Task El_webmaster_ve_la_lista_de_Festivales()
    {
        var webmaster = await CmsTestClient.LoginAsync(_factory, withCsrf: false);

        Assert.Equal(HttpStatusCode.OK, (await webmaster.GetAsync(ListaDeFestivales)).StatusCode);
    }

    /// <summary>Deja la cuenta de gestor activa, con su rol y con o sin el módulo Ecosistema.</summary>
    private async Task<HttpClient> SesionDelGestorAsync(bool conEcosistema, bool withCsrf)
    {
        using (var alcance = _factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.Users.SingleAsync(usuario => usuario.Email == Gestor);
            fila.IsActive = true;
            var concedido = await db.ModulosPorCuenta
                .Where(x => x.IdUsuario == fila.Id && x.CodigoModulo == "ecosistema")
                .ToListAsync();
            if (conEcosistema && concedido.Count == 0)
                db.ModulosPorCuenta.Add(new ModuloPorCuentaRow { IdUsuario = fila.Id, CodigoModulo = "ecosistema", FechaOtorgado = DateTime.UtcNow });
            if (!conEcosistema)
                db.ModulosPorCuenta.RemoveRange(concedido);
            await db.SaveChangesAsync();
            await RolesEnPruebas.AsignarAsync(db, fila.Id, "gestor_interno");
        }

        return await CmsTestClient.LoginAsync(_factory, Gestor, ClaveGestor, withCsrf: withCsrf);
    }
}
