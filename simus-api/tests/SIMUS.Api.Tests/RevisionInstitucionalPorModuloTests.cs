using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La bandeja y la API de revisión exigen el módulo de cada tipo de elemento.
/// </summary>
/// <remarks>
/// <para>
/// <b>EL DEFECTO.</b> «Solicitudes y revisiones» la tiene toda cuenta de consola, y los grupos
/// <c>/institucional/revision-de-eventos</c>, <c>/festivales</c>, <c>/ediciones-festival</c>,
/// <c>/propuestas-cambio-festival</c> y <c>/reclamaciones-administracion</c> solo exigían ser
/// funcionario. En la revisión de interfaz del 5 de noviembre de 2026 un gestor sin «Agenda» publicó un evento
/// desde la bandeja: la API respondió 200 y la bitácora lo registró. El permiso por módulo se saltaba
/// por la puerta de la bandeja.
/// </para>
/// <para>
/// <b>COMO EN <see cref="PermisosPorCuentaTests"/>, NUNCA CON EL WEBMASTER</b>: los tiene todos y con
/// él todo respondería 200. Cada prueba crea un gestor y le concede, o no, el módulo.
/// </para>
/// </remarks>
public sealed class RevisionInstitucionalPorModuloTests
{
    private static readonly string[] SoloAgenda = ["agenda"];
    private static readonly string[] SoloEcosistema = ["ecosistema"];
    private static readonly string[] SoloMercados = ["mercados"];

    /// <summary>Cada decisión de la revisión institucional, con el módulo que la gobierna.</summary>
    public static TheoryData<string, string, string> Decisiones => new()
    {
        { "agenda", "POST", "/api/v1/institucional/revision-de-eventos/999999/decision" },
        { "ecosistema", "POST", "/api/v1/institucional/festivales/999999/decisiones" },
        { "ecosistema", "POST", "/api/v1/institucional/festivales/999999/archivar" },
        { "ecosistema", "POST", "/api/v1/institucional/festivales/999999/reabrir-revision" },
        { "ecosistema", "POST", "/api/v1/institucional/festivales/999999/revision/enviar" },
        { "ecosistema", "POST", "/api/v1/institucional/ediciones-festival/999999/supervision" },
        { "ecosistema", "POST", "/api/v1/institucional/ediciones-festival/999999/revision/enviar" },
        { "ecosistema", "POST", "/api/v1/institucional/propuestas-cambio-festival/999999/decisiones" },
        { "ecosistema", "POST", "/api/v1/institucional/reclamaciones-administracion/999999/decision" },
        { "ecosistema", "POST", "/api/v1/institucional/reclamaciones-administracion/999999/aclaraciones" },
    };

    /// <summary>Las colas que nutren la bandeja, con su módulo.</summary>
    public static TheoryData<string, string> Colas => new()
    {
        { "agenda", "/api/v1/institucional/revision-de-eventos" },
        { "ecosistema", "/api/v1/institucional/festivales/en-revision" },
        { "ecosistema", "/api/v1/institucional/ediciones-festival/publicadas" },
        { "ecosistema", "/api/v1/institucional/propuestas-cambio-festival/en-revision" },
        { "ecosistema", "/api/v1/institucional/reclamaciones-administracion" },
    };

    [Theory]
    [MemberData(nameof(Decisiones))]
    public async Task Sin_el_modulo_cada_decision_responde_403(string modulo, string metodo, string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);

        var respuesta = await gestor.SendAsync(new HttpRequestMessage(new HttpMethod(metodo), ruta)
        {
            Content = JsonContent.Create(new { }),
        });

        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
        Assert.Contains("no tiene activado este módulo", await respuesta.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        Assert.False(string.IsNullOrEmpty(modulo));
    }

    [Theory]
    [MemberData(nameof(Decisiones))]
    public async Task Con_el_modulo_la_decision_pasa_la_puerta(string modulo, string metodo, string ruta)
    {
        // El elemento 999999 no existe: lo que se comprueba es que la puerta del módulo ya no cierra.
        // La decisión completa con 200 la prueban las de abajo y las de cada circuito.
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        await ConcederAsync(factory, id, [modulo]);

        var respuesta = await gestor.SendAsync(new HttpRequestMessage(new HttpMethod(metodo), ruta)
        {
            Content = JsonContent.Create(new { }),
        });

        Assert.NotEqual(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Colas))]
    public async Task La_cola_solo_se_lista_con_el_modulo(string modulo, string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);

        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync(ruta)).StatusCode);

        await ConcederAsync(factory, id, [modulo]);

        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync(ruta)).StatusCode);
    }

    [Fact]
    public async Task Un_gestor_sin_Agenda_no_publica_un_evento_y_con_Agenda_si()
    {
        // EL CASO DE LA AUDITORIA, ENTERO: un evento real en revisión.
        await using var factory = new TestWebApplicationFactory();
        var (organizacion, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "ux03.agenda@example.com");
        var festivalId = await EventosDeOrganizacionTests.FestivalAsync(organizacion, factory, organizacionId, publicado: true);
        var creado = await EventosDeOrganizacionTests.EnviarAsync(organizacion,
            $"/api/v1/externo/organizaciones/{organizacionId}/eventos",
            EventosDeOrganizacionTests.EventoNuevo(festivalId, "Concierto que decide Agenda"));
        creado.EnsureSuccessStatusCode();
        var evento = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var ruta = $"/api/v1/institucional/revision-de-eventos/{evento}/decision";

        var sinModulo = await gestor.PostAsJsonAsync(ruta, new DecisionSobreEvento { Decision = "publicar" });
        Assert.Equal(HttpStatusCode.Forbidden, sinModulo.StatusCode);

        await ConcederAsync(factory, id, SoloAgenda);
        var conModulo = await gestor.PostAsJsonAsync(ruta, new DecisionSobreEvento { Decision = "publicar" });
        Assert.Equal(HttpStatusCode.OK, conModulo.StatusCode);
    }

    [Fact]
    public async Task Un_retiro_de_Mercado_solo_lo_ve_y_lo_decide_quien_tiene_Mercados()
    {
        // VINCULACIONES Y RETIROS COMPARTEN RUTA PARA TODOS LOS MODULOS, así que no se cierran en el
        // grupo sino fila a fila (`ModuloDeUnTramite`).
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var solicitud = await SolicitudAsync(factory, id, "mercados_retiro");

        var lista = await gestor.GetFromJsonAsync<JsonElement>("/api/v1/admin/solicitudes-de-vinculacion");
        Assert.DoesNotContain(lista.GetProperty("items").EnumerateArray(), x => x.GetProperty("id").ToString() == solicitud.ToString(System.Globalization.CultureInfo.InvariantCulture));

        var ruta = $"/api/v1/admin/solicitudes-de-vinculacion/{solicitud}/status";
        var sinModulo = await gestor.PostAsJsonAsync(ruta, new RecordLinkRequestStatusRequest { Status = "en_revision" });
        Assert.Equal(HttpStatusCode.Forbidden, sinModulo.StatusCode);

        // Con otro módulo tampoco: hace falta el suyo.
        await ConcederAsync(factory, id, SoloEcosistema);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PostAsJsonAsync(ruta, new RecordLinkRequestStatusRequest { Status = "en_revision" })).StatusCode);

        await ConcederAsync(factory, id, SoloMercados);
        lista = await gestor.GetFromJsonAsync<JsonElement>("/api/v1/admin/solicitudes-de-vinculacion");
        Assert.Contains(lista.GetProperty("items").EnumerateArray(), x => x.GetProperty("id").ToString() == solicitud.ToString(System.Globalization.CultureInfo.InvariantCulture));
        Assert.Equal(HttpStatusCode.OK, (await gestor.PostAsJsonAsync(ruta, new RecordLinkRequestStatusRequest { Status = "en_revision" })).StatusCode);
    }

    [Fact]
    public async Task Un_aviso_del_circuito_del_Festival_ya_no_llega_sin_el_Ecosistema()
    {
        // EL BUZON DICE LO MISMO QUE LA BANDEJA. Decidir sobre un Festival exige ahora el Ecosistema;
        // un aviso que lleva a esa decisión, sin el módulo, sería un enlace a un 403.
        await using var factory = new TestWebApplicationFactory();
        var (id, gestor, correo) = await PermisosPorCuentaTests.GestorAsync(factory);
        var webmaster = await CmsTestClient.LoginAsync(factory);

        (await webmaster.PostAsJsonAsync("/api/v1/admin/notificaciones", new NotificationCreateRequest
        {
            RecipientEmail = correo,
            EventType = "aviso_de_prueba",
            Channel = "internal",
            Title = "Festival recibido para revision",
            Body = "Cuerpo del aviso.",
            ModuleId = "festivales",
            AmbitoAcceso = "institucional",
        })).EnsureSuccessStatusCode();

        Assert.DoesNotContain("Festival recibido para revision", await BuzonAsync(gestor), StringComparison.Ordinal);

        await ConcederAsync(factory, id, SoloEcosistema);
        Assert.Contains("Festival recibido para revision", await BuzonAsync(gestor), StringComparison.Ordinal);
    }

    private static async Task<string> BuzonAsync(HttpClient sesion)
    {
        var respuesta = await sesion.GetAsync("/api/v1/notificaciones?ambito=institucional&limite=100");
        respuesta.EnsureSuccessStatusCode();
        return await respuesta.Content.ReadAsStringAsync();
    }

    private static async Task ConcederAsync(TestWebApplicationFactory factory, int cuenta, string[] modulos)
    {
        var webmaster = await CmsTestClient.LoginAsync(factory);
        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{cuenta}/modulos", new { modulos })).EnsureSuccessStatusCode();
    }

    private static async Task<long> SolicitudAsync(TestWebApplicationFactory factory, int solicitante, string modulo)
    {
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;
        var fila = new RecordLinkRequestRow
        {
            ModuloId = modulo,
            RecordId = "1",
            RequestingUserId = solicitante,
            RequestedScope = "responsable",
            Reason = "Prueba de permisos por módulo.",
            Status = "pendiente",
            CreatedAt = ahora,
            UpdatedAt = ahora,
        };
        db.RecordLinkRequests.Add(fila);
        await db.SaveChangesAsync();
        return fila.Id;
    }
}
