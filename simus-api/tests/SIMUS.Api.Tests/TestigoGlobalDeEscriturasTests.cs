using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Api.Security;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// S-06. Toda escritura del API con sesión de cookie exige el testigo antiforgery, y lo exige una
/// pieza global, no la memoria de cada ruta.
/// </summary>
/// <remarks>
/// <para>
/// LA RED: el barrido recorre <see cref="EndpointDataSource"/> y, ruta por ruta, manda la escritura con
/// la sesión que esa ruta pide y SIN testigo. Una ruta nueva entra sola en el barrido; si queda fuera de la
/// pieza, la prueba se pone roja en vez de dejar una puerta muda.
/// </para>
/// <para>
/// LO ANÓNIMO SE DECLARA: las escrituras sin sesión (ingreso, registro, recuperación…) no llevan testigo porque
/// el visitante aún no tiene ninguno. Su lista está escrita abajo, con el motivo; abrir una más obliga a tocarla.
/// </para>
/// </remarks>
public sealed class TestigoGlobalDeEscriturasTests : IClassFixture<TestWebApplicationFactory>
{
    private const string MensajeDeRechazo = "La acción no pudo validarse. Actualiza la página e inténtalo nuevamente.";

    /// <summary>
    /// Escrituras anónimas permitidas, cada una con su motivo: no hay sesión que aprovechar y el visitante
    /// aún no tiene testigo. Abrir una más obliga a tocar esta lista.
    /// </summary>
    private static readonly string[] AnonimasPermitidas =
    [
        "POST /api/v1/admin/auth/login",                                    // ingreso de la consola
        "POST /api/v1/externo/auth/login",                                  // ingreso del portal
        "POST /api/v1/externo/auth/register",                               // alta de cuenta
        "POST /api/v1/externo/auth/olvide-contrasena",                      // recuperación (respuesta neutra)
        "POST /api/v1/externo/auth/restablecer-contrasena/comprobar",       // enlace de recuperación
        "POST /api/v1/externo/auth/restablecer-contrasena",                 // enlace de recuperación
        "POST /api/v1/externo/auth/confirmar-correo",                       // enlace del correo
        "POST /api/v1/externo/invitaciones/consultar",                      // enlace de invitación
        "POST /api/v1/externo/agendas-de-citas/invitaciones/consultar",     // enlace de invitación
        "POST /api/v1/publico/boletin/suscripciones",                       // formulario público del boletín
        "POST /api/v1/publico/boletin/confirmar",                           // enlace del correo del boletín (#292)
        "POST /api/v1/publico/boletin/baja",                                // enlace «Darme de baja» del correo del boletín (testigo firmado)
        "POST /api/v1/publico/boletin/baja-un-clic",                        // List-Unsubscribe-Post (RFC 8058): lo invoca el cliente de correo
        "POST /api/v1/publico/consulta-guiada/consultar",                   // consulta guiada pública, sin sesión (#292)
        "POST /api/v1/publico/consulta-abierta/consultar",                  // consulta abierta pública (lectura), sin sesión
    ];

    private readonly TestWebApplicationFactory _factory;

    public TestigoGlobalDeEscriturasTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed record Escritura(string Metodo, string Patron, bool Anonima, bool EsExterna, string? ParametroDeOrganizacion = null, (string Familia, string Parametro)? Hijo = null)
    {
        public string Clave => $"{Metodo} {Patron}";
    }

    private List<Escritura> Escrituras()
    {
        var fuente = _factory.Services.GetRequiredService<EndpointDataSource>();
        var resultado = new List<Escritura>();
        foreach (var endpoint in fuente.Endpoints.OfType<RouteEndpoint>())
        {
            var patron = endpoint.RoutePattern.RawText ?? string.Empty;
            if (!patron.StartsWith(TestigoGlobalDeEscrituras.PrefijoDelApi, StringComparison.Ordinal)) continue;
            var metodos = endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? [];
            var anonima = endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null;
            var politicas = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(d => d.Policy);
            var esExterna = politicas.Contains(SimusAuthentication.ExternalPolicy);
            var parametroOrg = PoliticaDeOrganizacionPropia.ParametroDeOrganizacion(endpoint.RoutePattern);
            var hijo = PoliticaDeOrganizacionPropia.RecursoHijo(endpoint.RoutePattern);
            foreach (var metodo in metodos.Where(TestigoGlobalDeEscrituras.EsEscritura))
            {
                resultado.Add(new Escritura(metodo, patron, anonima, esExterna, parametroOrg, hijo));
            }
        }

        return resultado;
    }

    private static string Concretar(string patron, IReadOnlyDictionary<string, string>? propios = null) =>
        System.Text.RegularExpressions.Regex.Replace(patron, @"\{(\*{0,2})(\w+)(?::[^}]*)?\}", m =>
            propios is not null && propios.TryGetValue(m.Groups[2].Value, out var valor) ? valor
            : m.Value.Contains(":guid", StringComparison.Ordinal) ? Guid.Empty.ToString() : "1");

    /// <summary>
    /// Los identificadores con los que una ruta bajo la política de organización propia llega al testigo: la organización
    /// de la que la sesión de prueba SÍ es miembro y, en los recursos hijos, un recurso que le pertenece.
    /// </summary>
    private static Dictionary<string, string>? Propios(Escritura e, int organizacion, Dictionary<string, int> hijos)
    {
        if (e.ParametroDeOrganizacion is { } org)
            return new() { [org] = organizacion.ToString(System.Globalization.CultureInfo.InvariantCulture) };
        if (e.Hijo is { } hijo && hijos.TryGetValue(hijo.Familia.ToLowerInvariant(), out var id))
            return new() { [hijo.Parametro] = id.ToString(System.Globalization.CultureInfo.InvariantCulture) };
        return null;
    }

    [Fact]
    public void Las_escrituras_anonimas_son_solo_las_declaradas()
    {
        var anonimas = Escrituras().Where(e => e.Anonima).Select(e => e.Clave).ToList();
        var sobran = anonimas.Except(AnonimasPermitidas, StringComparer.Ordinal).ToList();
        var faltan = AnonimasPermitidas.Except(anonimas, StringComparer.Ordinal).ToList();
        Assert.True(sobran.Count == 0, "Escrituras anónimas sin declarar (no llevan testigo): " + string.Join("; ", sobran));
        Assert.True(faltan.Count == 0, "Declaradas pero ya no existen (quítalas de la lista): " + string.Join("; ", faltan));
    }

    [Fact]
    public void Las_escrituras_con_sesion_sin_testigo_son_solo_las_declaradas_y_existen()
    {
        var existentes = Escrituras().Select(e => e.Patron).ToHashSet(StringComparer.Ordinal);
        var perdidas = TestigoGlobalDeEscrituras.SinTestigo.Where(p => !existentes.Contains(p)).ToList();
        Assert.True(perdidas.Count == 0, "Declaradas sin testigo pero ya no existen (quítalas): " + string.Join("; ", perdidas));
        Assert.Equal(4, TestigoGlobalDeEscrituras.SinTestigo.Length);
    }

    /// <summary>Rutas con sesión que el barrido NO puede medir y el motivo. Hoy: ninguna (se miden todas).</summary>
    private static readonly Dictionary<string, string> NoMedibles = new(StringComparer.Ordinal);

    [Fact]
    public async Task Toda_escritura_con_sesion_rechaza_la_peticion_sin_testigo()
    {
        var todas = Escrituras().Where(e => !e.Anonima && !TestigoGlobalDeEscrituras.SinTestigo.Contains(e.Patron)).ToList();
        Assert.True(todas.Count > 200, $"El barrido vio solo {todas.Count} escrituras: algo anda mal.");
        var escrituras = todas.Where(e => !NoMedibles.ContainsKey(e.Clave)).ToList();

        var consola = await CmsTestClient.LoginAsync(_factory, withCsrf: false);
        //: las rutas bajo /externo/organizaciones/{id} y los recursos hijos pasan antes por la política de «esta organización
        // es tuya» (404). Para que lleguen al testigo, el barrido usa una organización de la que la sesión es miembro activo y
        // recursos que le pertenecen. La sesión NO manda el testigo: lo que se mide es el 400.
        var (propia, organizacion) = await RolesDeOrganizacionTests.OrganizacionAsync(_factory, "Organización del barrido del testigo");
        var hijos = await PoliticaDeOrganizacionPropiaTests.SembrarRecursosAsync(_factory, propia, organizacion);
        var portal = propia.Cliente;

        var fallos = new List<string>();
        foreach (var escritura in escrituras)
        {
            var cliente = escritura.EsExterna ? portal : consola;
            var propios = Propios(escritura, organizacion, hijos);
            // El cuerpo importa para llegar a la ruta: las que declaran un cuerpo JSON o un formulario solo
            // casan con ese Content-Type (si no, el enrutador cae al 404 del API y nada se mide).
            var respuesta = await EnviarAsync(cliente, escritura, propios, () => JsonContent.Create(new { }));
            if (respuesta.StatusCode == HttpStatusCode.NotFound)
            {
                respuesta = await EnviarAsync(cliente, escritura, propios, () => new MultipartFormDataContent());
            }

            var cuerpo = await respuesta.Content.ReadAsStringAsync();
            if (respuesta.StatusCode != HttpStatusCode.BadRequest || !cuerpo.Contains("no pudo validarse", StringComparison.Ordinal))
            {
                fallos.Add($"{escritura.Clave} -> {(int)respuesta.StatusCode} {Concretar(escritura.Patron, propios)} {cuerpo[..Math.Min(80, cuerpo.Length)]}");
            }
        }

        Assert.True(fallos.Count == 0, "Escrituras con sesión que no rechazaron la falta de testigo:\n" + string.Join("\n", fallos));
        Assert.True(escrituras.Count >= todas.Count - NoMedibles.Count, "Se midieron menos escrituras de las esperadas.");
    }

    [Fact]
    public async Task Con_una_organizacion_ajena_la_politica_responde_404_antes_del_testigo()
    {
        var bajoPolitica = Escrituras().Where(e => !e.Anonima && (e.ParametroDeOrganizacion is not null || e.Hijo is not null)).ToList();
        Assert.True(bajoPolitica.Count > 80, $"Se esperaban muchas escrituras bajo la política y hay {bajoPolitica.Count}.");

        var (duena, ajena) = await RolesDeOrganizacionTests.OrganizacionAsync(_factory, "Organización ajena al barrido");
        var hijosAjenos = await PoliticaDeOrganizacionPropiaTests.SembrarRecursosAsync(_factory, duena, ajena);
        var (intrusa, _) = await RolesDeOrganizacionTests.OrganizacionAsync(_factory, "Organización de quien intenta");

        var fallos = new List<string>();
        foreach (var escritura in bajoPolitica)
        {
            var propios = Propios(escritura, ajena, hijosAjenos);
            var respuesta = await EnviarAsync(intrusa.Cliente, escritura, propios, () => JsonContent.Create(new { }));
            if (respuesta.StatusCode != HttpStatusCode.NotFound) fallos.Add($"{escritura.Clave} -> {(int)respuesta.StatusCode}");
        }

        Assert.True(fallos.Count == 0, "Escrituras que no respondieron 404 a una organización ajena:\n" + string.Join("\n", fallos));
    }

    private static Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, Escritura escritura,
        IReadOnlyDictionary<string, string>? propios, Func<HttpContent> contenido)
    {
        var peticion = new HttpRequestMessage(new HttpMethod(escritura.Metodo), Concretar(escritura.Patron, propios));
        if (escritura.Metodo != "DELETE") peticion.Content = contenido();
        return cliente.SendAsync(peticion);
    }

    [Fact]
    public async Task Una_escritura_con_testigo_valido_pasa_la_pieza()
    {
        var cliente = await CmsTestClient.LoginAsync(_factory);
        var testigo = await cliente.GetFromJsonAsync<TokenAntiforgeryRespuesta>("/api/v1/csrf");
        using var peticion = new HttpRequestMessage(HttpMethod.Post, "/api/v1/admin/auth/mi-contrasena")
        {
            Content = JsonContent.Create(new { actual = "no-es", nueva = "otra-clave-larga-1" }),
        };
        peticion.Headers.Add("X-CSRF-TOKEN", testigo!.RequestToken);

        var respuesta = await cliente.SendAsync(peticion);

        // Llega al manejador: rechaza por la clave actual, no por el testigo.
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.DoesNotContain("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_testigo_para_cualquier_sesion_lo_entrega_tanto_la_consola_como_el_portal()
    {
        var consola = await CmsTestClient.LoginAsync(_factory, withCsrf: false);
        var portal = _factory.CreateClient();
        (await portal.PostAsJsonAsync("/api/v1/externo/auth/login",
            new ExternalLoginRequest { Email = "externo@simus.test", Password = "pnmc-externo" })).EnsureSuccessStatusCode();

        Assert.False(string.IsNullOrEmpty((await consola.GetFromJsonAsync<TokenAntiforgeryRespuesta>("/api/v1/csrf"))!.RequestToken));
        Assert.False(string.IsNullOrEmpty((await portal.GetFromJsonAsync<TokenAntiforgeryRespuesta>("/api/v1/csrf"))!.RequestToken));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync("/api/v1/csrf")).StatusCode);
    }

    [Fact]
    public async Task En_modo_registrar_la_falta_se_anota_y_la_escritura_pasa()
    {
        // Una ruta que NO validaba por su cuenta (cambiar el estado de una noticia): solo la pieza global la protege.
        const string ruta = "/api/v1/institucional/noticias/1/estado";
        await using var fabrica = new TestWebApplicationFactory();
        var cliente = await CmsTestClient.LoginAsync(fabrica, withCsrf: false);

        var exigente = await cliente.PostAsJsonAsync(ruta, new { });
        Assert.Equal(HttpStatusCode.BadRequest, exigente.StatusCode);
        Assert.Contains("no pudo validarse", await exigente.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        fabrica.FijarModoDelTestigo("Registrar");
        var observando = await cliente.PostAsJsonAsync(ruta, new { });
        Assert.DoesNotContain("no pudo validarse", await observando.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }
}
