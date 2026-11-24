using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// S-11 de la auditoría de seguridad: la vida de una sesión.
/// </summary>
/// <remarks>
/// <para>
/// Antes de este cambio las dos cookies eran persistentes y deslizantes de 8 horas: con uso constante no vencían nunca y una
/// cookie copiada seguía valiendo tras «Cerrar sesión». Ahora (1) hay un tope absoluto de vida —12 horas la consola, 7 días el
/// portal— que la renovación deslizante no alarga, (2) cerrar sesión sube la «generación de sesión» de la cuenta en la base y
/// toda cookie anterior, la copiada incluida, deja de valer, y (3) la cookie de la consola es de sesión del navegador.
/// </para>
/// <para>
/// <b>CÓMO SE PRUEBA UNA COOKIE COPIADA.</b> Se toma el valor del <c>Set-Cookie</c> del ingreso y se manda en una cabecera
/// <c>Cookie</c> desde un cliente que no comparte jarra de cookies con el original: es lo que haría quien se la llevó. El tope
/// se prueba desprotegiendo el tiquete con el propio formato de datos de la cookie, atrasándole el inicio y volviéndolo a
/// proteger.
/// </para>
/// </remarks>
public sealed class VidaDeLaSesionTests : IClassFixture<TestWebApplicationFactory>
{
    private const string CookieConsola = "simus.admin";
    private const string CookieExterna = "simus.external";
    private const string RutaConsola = "/api/v1/admin/contenido-web/csrf";
    private const string RutaExterna = "/api/v1/externo/auth/me";
    private const string ClaveExterna = "ClaveExterna.2026-ok";
    private static int _contador;

    private readonly TestWebApplicationFactory _factory;

    public VidaDeLaSesionTests(TestWebApplicationFactory factory) => _factory = factory;

    private static string? ValorDeLaCookie(HttpResponseMessage respuesta, string nombre) =>
        respuesta.Headers.TryGetValues("Set-Cookie", out var valores)
            ? valores.FirstOrDefault(v => v.StartsWith(nombre + "=", StringComparison.Ordinal))
            : null;

    private static string SoloElValor(string setCookie) => setCookie.Split(';')[0][(setCookie.IndexOf('=', StringComparison.Ordinal) + 1)..];

    private HttpClient SinJarra() => _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });

    private static async Task<HttpStatusCode> PedirConCookieAsync(HttpClient cliente, string ruta, string nombre, string valor)
    {
        using var mensaje = new HttpRequestMessage(HttpMethod.Get, ruta);
        mensaje.Headers.Add("Cookie", $"{nombre}={valor}");
        using var respuesta = await cliente.SendAsync(mensaje);
        return respuesta.StatusCode;
    }

    private async Task<(HttpClient Dueno, string SetCookie)> IngresarConsolaAsync()
    {
        var cliente = _factory.CreateClient();
        var respuesta = await cliente.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CmsTestClient.WebmasterEmail, Password = CmsTestClient.WebmasterPassword });
        respuesta.EnsureSuccessStatusCode();
        return (cliente, ValorDeLaCookie(respuesta, CookieConsola)!);
    }

    private async Task<(HttpClient Dueno, string SetCookie)> IngresarExternaAsync()
    {
        var numero = Interlocked.Increment(ref _contador);
        var correo = $"vida.{Guid.NewGuid():N}"[..28] + "@example.com";
        (await _factory.CreateClient().PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Lucía",
            FirstSurname = "Mosquera",
            DocumentType = "cc",
            DocumentNumber = (73_000_000 + numero).ToString(System.Globalization.CultureInfo.InvariantCulture),
            Phone = "3001234567",
            Email = correo,
            Password = ClaveExterna,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();

        var cliente = _factory.CreateClient();
        var respuesta = await cliente.PostAsJsonAsync("/api/v1/externo/auth/login",
            new ExternalLoginRequest { Email = correo, Password = ClaveExterna });
        respuesta.EnsureSuccessStatusCode();
        return (cliente, ValorDeLaCookie(respuesta, CookieExterna)!);
    }

    /// <summary>Re-firma el valor de una cookie con otro inicio de sesión (o sin él, si es <c>null</c>).</summary>
    private string ConInicio(string esquema, string valor, DateTimeOffset? inicio)
    {
        var formato = _factory.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(esquema).TicketDataFormat;
        var tiquete = formato.Unprotect(valor)!;
        if (inicio is null)
        {
            tiquete.Properties.Items.Remove(VidaDeLaSesion.ItemDeInicio);
        }
        else
        {
            tiquete.Properties.Items[VidaDeLaSesion.ItemDeInicio] = inicio.Value.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        return formato.Protect(tiquete);
    }

    // ---------- Cerrar sesión de verdad ------------------------------------------

    [Fact]
    public async Task Consola_la_cookie_copiada_deja_de_valer_al_cerrar_sesion()
    {
        var (dueno, setCookie) = await IngresarConsolaAsync();
        var copiada = SoloElValor(setCookie);
        using var ladron = SinJarra();

        Assert.Equal(HttpStatusCode.OK, await PedirConCookieAsync(ladron, RutaConsola, CookieConsola, copiada));

        (await dueno.PostAsync("/api/v1/admin/auth/logout", content: null)).EnsureSuccessStatusCode();

        // El dueño ya no está dentro, y tampoco quien se llevó la cookie.
        Assert.Equal(HttpStatusCode.Unauthorized, (await dueno.GetAsync(RutaConsola)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, await PedirConCookieAsync(ladron, RutaConsola, CookieConsola, copiada));
    }

    [Fact]
    public async Task Externa_la_cookie_copiada_deja_de_valer_al_cerrar_sesion()
    {
        var (dueno, setCookie) = await IngresarExternaAsync();
        var copiada = SoloElValor(setCookie);
        using var ladron = SinJarra();

        Assert.Equal(HttpStatusCode.OK, await PedirConCookieAsync(ladron, RutaExterna, CookieExterna, copiada));

        var token = (await dueno.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/auth/csrf"))!.RequestToken;
        using var cierre = new HttpRequestMessage(HttpMethod.Post, "/api/v1/externo/auth/logout");
        cierre.Headers.Add("X-CSRF-TOKEN", token);
        (await dueno.SendAsync(cierre)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Unauthorized, await PedirConCookieAsync(ladron, RutaExterna, CookieExterna, copiada));
    }

    [Fact]
    public async Task Volver_a_ingresar_despues_de_cerrar_sesion_funciona_con_la_generacion_nueva()
    {
        var (dueno, _) = await IngresarConsolaAsync();
        (await dueno.PostAsync("/api/v1/admin/auth/logout", content: null)).EnsureSuccessStatusCode();

        var (nuevo, _) = await IngresarConsolaAsync();

        Assert.Equal(HttpStatusCode.OK, (await nuevo.GetAsync(RutaConsola)).StatusCode);
    }

    // ---------- Tope absoluto ----------------------------------------------------

    [Fact]
    public async Task Consola_pasado_el_tope_de_doce_horas_la_cookie_no_sirve_aunque_siga_viva()
    {
        var (_, setCookie) = await IngresarConsolaAsync();
        var valor = SoloElValor(setCookie);
        using var cliente = SinJarra();

        var dentroDelTope = ConInicio(CookieAuthenticationDefaults.AuthenticationScheme, valor, DateTimeOffset.UtcNow.AddHours(-11));
        var fueraDelTope = ConInicio(CookieAuthenticationDefaults.AuthenticationScheme, valor, DateTimeOffset.UtcNow.AddHours(-13));

        Assert.Equal(HttpStatusCode.OK, await PedirConCookieAsync(cliente, RutaConsola, CookieConsola, dentroDelTope));
        Assert.Equal(HttpStatusCode.Unauthorized, await PedirConCookieAsync(cliente, RutaConsola, CookieConsola, fueraDelTope));
    }

    [Fact]
    public async Task Externa_pasado_el_tope_de_siete_dias_la_cookie_no_sirve_aunque_siga_viva()
    {
        var (_, setCookie) = await IngresarExternaAsync();
        var valor = SoloElValor(setCookie);
        using var cliente = SinJarra();

        var dentroDelTope = ConInicio(SimusAuthentication.ExternalScheme, valor, DateTimeOffset.UtcNow.AddDays(-6));
        var fueraDelTope = ConInicio(SimusAuthentication.ExternalScheme, valor, DateTimeOffset.UtcNow.AddDays(-8));

        Assert.Equal(HttpStatusCode.OK, await PedirConCookieAsync(cliente, RutaExterna, CookieExterna, dentroDelTope));
        Assert.Equal(HttpStatusCode.Unauthorized, await PedirConCookieAsync(cliente, RutaExterna, CookieExterna, fueraDelTope));
    }

    [Fact]
    public async Task Un_tiquete_sin_marca_de_inicio_se_rechaza()
    {
        var (_, setCookie) = await IngresarConsolaAsync();
        using var cliente = SinJarra();

        var sinMarca = ConInicio(CookieAuthenticationDefaults.AuthenticationScheme, SoloElValor(setCookie), inicio: null);

        Assert.Equal(HttpStatusCode.Unauthorized, await PedirConCookieAsync(cliente, RutaConsola, CookieConsola, sinMarca));
    }

    [Fact]
    public async Task La_renovacion_deslizante_y_el_cambio_de_perfil_conservan_el_inicio()
    {
        var (dueno, setCookie) = await IngresarConsolaAsync();
        var formato = _factory.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(CookieAuthenticationDefaults.AuthenticationScheme).TicketDataFormat;
        var inicioOriginal = VidaDeLaSesion.InicioDe(formato.Unprotect(SoloElValor(setCookie))!.Properties);
        Assert.NotNull(inicioOriginal);

        // Un cambio de perfil re-emite la cookie: su inicio es el de la sesión, no uno nuevo.
        await CmsTestClient.AttachCsrfAsync(dueno);
        var perfil = await dueno.PutAsJsonAsync("/api/v1/admin/auth/profile", new UpdateProfileRequest { FullName = "Webmaster de pruebas", Email = CmsTestClient.WebmasterEmail });
        perfil.EnsureSuccessStatusCode();
        var nueva = ValorDeLaCookie(perfil, CookieConsola);
        Assert.NotNull(nueva);

        var inicioNuevo = VidaDeLaSesion.InicioDe(formato.Unprotect(SoloElValor(nueva!))!.Properties);
        Assert.Equal(inicioOriginal, inicioNuevo);
    }

    // ---------- Persistencia de la cookie ----------------------------------------

    [Fact]
    public async Task La_cookie_de_la_consola_es_de_sesion_del_navegador_y_la_del_portal_persiste()
    {
        var (_, consola) = await IngresarConsolaAsync();
        var (_, portal) = await IngresarExternaAsync();

        Assert.DoesNotContain("expires=", consola, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("max-age=", consola, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", portal, StringComparison.OrdinalIgnoreCase);
    }
}
