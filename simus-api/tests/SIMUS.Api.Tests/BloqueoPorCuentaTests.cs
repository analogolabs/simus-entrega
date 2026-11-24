using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// S-07 de la auditoría de seguridad: límite de intentos fallidos por CUENTA, además del límite por IP.
/// </summary>
/// <remarks>
/// <para>
/// El límite por origen (20 por minuto la consola, 10 el portal) depende de la topología del despliegue y no frena un
/// rociado de contraseñas desde muchas direcciones. Aquí se mide el bloqueo por cuenta: cinco fallos en quince minutos
/// bloquean temporalmente la cuenta, ni la clave correcta entra mientras dura, la respuesta es la misma para una cuenta que
/// existe y para una que no, y el bloqueo se levanta con un ingreso exitoso, con la recuperación de la clave (portal) o con
/// el restablecimiento que hace el webmaster (consola).
/// </para>
/// <para>
/// Los demás arneses de la suite hacen decenas de ingresos fallidos contra la misma cuenta; solo este archivo prueba el bloqueo.
/// </para>
/// </remarks>
public sealed class BloqueoPorCuentaTests : IClassFixture<TestWebApplicationFactory>
{
    private const string ClaveExterna = "ClaveExterna.2026-ok";
    private const string RutaConsola = "/api/v1/admin/auth/login";
    private const string RutaExterna = "/api/v1/externo/auth/login";
    private static int _contador;

    private readonly TestWebApplicationFactory _factory;

    public BloqueoPorCuentaTests(TestWebApplicationFactory factory) => _factory = factory;

    private static int Fallos => BloqueoDeIngresoPorCuenta.FallosPorOmision;

    private static Task<HttpResponseMessage> IngresarConsolaAsync(HttpClient cliente, string correo, string clave) =>
        cliente.PostAsJsonAsync(RutaConsola, new AdminLoginRequest { Email = correo, Password = clave });

    private static Task<HttpResponseMessage> IngresarExternoAsync(HttpClient cliente, string correo, string clave) =>
        cliente.PostAsJsonAsync(RutaExterna, new ExternalLoginRequest { Email = correo, Password = clave });

    private async Task<string> RegistrarExternaAsync()
    {
        var numero = Interlocked.Increment(ref _contador);
        var correo = $"bloqueo.{Guid.NewGuid():N}"[..28] + "@example.com";
        var respuesta = await _factory.CreateClient().PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Lucía",
            FirstSurname = "Mosquera",
            DocumentType = "cc",
            DocumentNumber = (72_000_000 + numero).ToString(System.Globalization.CultureInfo.InvariantCulture),
            Phone = "3001234567",
            Email = correo,
            Password = ClaveExterna,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        });
        respuesta.EnsureSuccessStatusCode();
        return correo;
    }

    private async Task<string> CrearGestorAsync(string clave)
    {
        var webmaster = await CmsTestClient.LoginAsync(_factory);
        var correo = $"bloqueo.{Guid.NewGuid():N}@pnmc.local";
        (await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            FullName = "Gestor de prueba",
            Email = correo,
            Roles = ["gestor_interno"],
            Password = clave,
            IsActive = true,
        })).EnsureSuccessStatusCode();
        return correo;
    }

    /// <summary>El cuerpo del problema sin el identificador de traza, que es distinto en cada petición.</summary>
    private static async Task<string> CuerpoSinTraza(HttpResponseMessage respuesta)
    {
        var json = await respuesta.Content.ReadFromJsonAsync<Dictionary<string, JsonElement>>();
        json!.Remove("traceId");
        return JsonSerializer.Serialize(json.OrderBy(par => par.Key, StringComparer.Ordinal).ToDictionary(par => par.Key, par => par.Value));
    }

    private async Task<int> FilasDeFalloAsync()
    {
        using var alcance = _factory.Services.CreateScope();
        return await alcance.ServiceProvider.GetRequiredService<SimusDbContext>().IntentosDeIngresoFallidos.CountAsync();
    }

    // ---------- Consola ----------------------------------------------------------

    [Fact]
    public async Task Consola_cinco_fallos_bloquean_la_cuenta_y_ni_la_clave_correcta_entra()
    {
        const string clave = "ClaveDeGestor.2026-ok";
        var correo = await CrearGestorAsync(clave);
        var cliente = _factory.CreateClient();

        for (var i = 0; i < Fallos; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await IngresarConsolaAsync(cliente, correo, $"equivocada-{i}")).StatusCode);
        }

        var conLaBuena = await IngresarConsolaAsync(cliente, correo, clave);
        Assert.Equal(HttpStatusCode.TooManyRequests, conLaBuena.StatusCode);
        Assert.Contains("Espera", await conLaBuena.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Consola_el_bloqueo_responde_igual_para_una_cuenta_que_existe_y_para_una_que_no()
    {
        const string clave = "ClaveDeGestor.2026-ok";
        var existente = await CrearGestorAsync(clave);
        var inventada = $"no.existe.{Guid.NewGuid():N}@pnmc.local";
        var cliente = _factory.CreateClient();

        for (var i = 0; i < Fallos; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await IngresarConsolaAsync(cliente, existente, $"x{i}")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await IngresarConsolaAsync(cliente, inventada, $"x{i}")).StatusCode);
        }

        var a = await IngresarConsolaAsync(cliente, existente, "otra");
        var b = await IngresarConsolaAsync(cliente, inventada, "otra");

        Assert.Equal(HttpStatusCode.TooManyRequests, a.StatusCode);
        Assert.Equal(a.StatusCode, b.StatusCode);
        Assert.Equal(await CuerpoSinTraza(a), await CuerpoSinTraza(b));
    }

    [Fact]
    public async Task Consola_un_ingreso_exitoso_borra_los_fallos_y_cuatro_fallos_no_bloquean()
    {
        const string clave = "ClaveDeGestor.2026-ok";
        var correo = await CrearGestorAsync(clave);
        var cliente = _factory.CreateClient();

        for (var i = 0; i < Fallos - 1; i++)
        {
            await IngresarConsolaAsync(cliente, correo, $"x{i}");
        }

        Assert.Equal(HttpStatusCode.OK, (await IngresarConsolaAsync(cliente, correo, clave)).StatusCode);

        // El contador volvió a cero: otros cuatro fallos tampoco bloquean.
        for (var i = 0; i < Fallos - 1; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await IngresarConsolaAsync(cliente, correo, $"y{i}")).StatusCode);
        }

        Assert.Equal(HttpStatusCode.OK, (await IngresarConsolaAsync(cliente, correo, clave)).StatusCode);
    }

    [Fact]
    public async Task Consola_el_webmaster_que_restablece_la_clave_desbloquea_la_cuenta()
    {
        const string clave = "ClaveDeGestor.2026-ok";
        const string nueva = "OtraClaveDeGestor.2026-ok";
        var correo = await CrearGestorAsync(clave);
        var cliente = _factory.CreateClient();

        for (var i = 0; i < Fallos; i++)
        {
            await IngresarConsolaAsync(cliente, correo, $"x{i}");
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await IngresarConsolaAsync(cliente, correo, clave)).StatusCode);

        var webmaster = await CmsTestClient.LoginAsync(_factory);
        var lista = await webmaster.GetFromJsonAsync<JsonElement>("/api/v1/admin/auth/users");
        var id = lista.EnumerateArray()
            .First(u => string.Equals(u.GetProperty("email").GetString(), correo, StringComparison.OrdinalIgnoreCase))
            .GetProperty("id").GetString();
        var restablece = await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            Id = id,
            FullName = "Gestor de prueba",
            Email = correo,
            Roles = ["gestor_interno"],
            Password = nueva,
            IsActive = true,
        });
        restablece.EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await IngresarConsolaAsync(cliente, correo, nueva)).StatusCode);
    }

    // ---------- Portal -----------------------------------------------------------

    [Fact]
    public async Task Externo_cinco_fallos_bloquean_la_cuenta_y_ni_la_clave_correcta_entra()
    {
        var correo = await RegistrarExternaAsync();
        var cliente = _factory.CreateClient();

        for (var i = 0; i < Fallos; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await IngresarExternoAsync(cliente, correo, $"equivocada-{i}")).StatusCode);
        }

        var conLaBuena = await IngresarExternoAsync(cliente, correo, ClaveExterna);
        Assert.Equal(HttpStatusCode.TooManyRequests, conLaBuena.StatusCode);
        Assert.Contains("Olvidaste tu contraseña", await conLaBuena.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Externo_el_bloqueo_responde_igual_para_una_cuenta_que_existe_y_para_una_que_no()
    {
        var existente = await RegistrarExternaAsync();
        var inventada = $"no.existe.{Guid.NewGuid():N}@example.com";
        var cliente = _factory.CreateClient();

        for (var i = 0; i < Fallos; i++)
        {
            await IngresarExternoAsync(cliente, existente, $"x{i}");
            await IngresarExternoAsync(cliente, inventada, $"x{i}");
        }

        var a = await IngresarExternoAsync(cliente, existente, "otra");
        var b = await IngresarExternoAsync(cliente, inventada, "otra");

        Assert.Equal(HttpStatusCode.TooManyRequests, a.StatusCode);
        Assert.Equal(a.StatusCode, b.StatusCode);
        Assert.Equal(await CuerpoSinTraza(a), await CuerpoSinTraza(b));
    }

    [Fact]
    public async Task Externo_recuperar_la_clave_desbloquea_la_cuenta()
    {
        const string claveNueva = "FraseNuevaDeSimus#2026";
        var correo = await RegistrarExternaAsync();
        var cliente = _factory.CreateClient();

        for (var i = 0; i < Fallos; i++)
        {
            await IngresarExternoAsync(cliente, correo, $"x{i}");
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await IngresarExternoAsync(cliente, correo, ClaveExterna)).StatusCode);

        // Pedir el enlace de recuperación NUNCA está bloqueado: es la salida.
        var anonimo = _factory.CreateClient();
        var solicitud = await PostConCsrfAsync(anonimo, "/api/v1/externo/auth/olvide-contrasena", new { correo });
        Assert.True(solicitud.IsSuccessStatusCode, $"Solicitar el enlace respondió {(int)solicitud.StatusCode}: {await solicitud.Content.ReadAsStringAsync()}");

        string testigo;
        using (var alcance = _factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var cuerpo = await db.Notifications.AsNoTracking()
                .Where(n => n.RecipientEmail == correo && n.EventType == "RecuperacionDeContrasena")
                .OrderByDescending(n => n.Id).Select(n => n.Body).FirstAsync();
            testigo = System.Text.RegularExpressions.Regex.Match(cuerpo, "testigo=([0-9a-f]{64})").Groups[1].Value;
        }

        var hecho = await PostConCsrfAsync(anonimo, "/api/v1/externo/auth/restablecer-contrasena", new { testigo, nueva = claveNueva });
        Assert.Equal(HttpStatusCode.NoContent, hecho.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await IngresarExternoAsync(cliente, correo, claveNueva)).StatusCode);
    }

    private static async Task<HttpResponseMessage> PostConCsrfAsync(HttpClient cliente, string ruta, object cuerpo)
    {
        var token = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/auth/csrf"))!.RequestToken;
        var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", token);
        return await cliente.SendAsync(mensaje);
    }

    // ---------- El servicio, con reloj propio ------------------------------------

    private sealed class RelojDePrueba(DateTimeOffset inicio) : TimeProvider
    {
        private DateTimeOffset _ahora = inicio;

        public override DateTimeOffset GetUtcNow() => _ahora;

        public void Avanzar(TimeSpan tiempo) => _ahora += tiempo;
    }

    private static BloqueoDeIngresoPorCuenta Servicio(IServiceScope alcance, RelojDePrueba reloj) =>
        new(alcance.ServiceProvider.GetRequiredService<SimusDbContext>(),
            alcance.ServiceProvider.GetRequiredService<IConfiguration>(),
            reloj);

    [Fact]
    public async Task El_bloqueo_es_temporal_y_se_levanta_cuando_el_fallo_sale_de_la_ventana()
    {
        var correo = $"temporal.{Guid.NewGuid():N}@pnmc.local";
        var reloj = new RelojDePrueba(DateTimeOffset.UtcNow);
        using var alcance = _factory.Services.CreateScope();
        var servicio = Servicio(alcance, reloj);

        for (var i = 0; i < servicio.MaximoDeFallos; i++)
        {
            Assert.Null(await servicio.EsperaAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None));
            await servicio.RegistrarFalloAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None);
            reloj.Avanzar(TimeSpan.FromSeconds(10));
        }

        var espera = await servicio.EsperaAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None);
        Assert.NotNull(espera);
        Assert.InRange(espera!.Value, TimeSpan.FromMinutes(13), servicio.Ventana);

        // Pasada la ventana desde el fallo que completaba el cupo, la cuenta vuelve a poder intentar.
        reloj.Avanzar(servicio.Ventana);
        Assert.Null(await servicio.EsperaAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None));
    }

    [Fact]
    public async Task Las_dos_puertas_llevan_su_cuenta_aparte_y_la_huella_no_es_el_correo()
    {
        var correo = $"aparte.{Guid.NewGuid():N}@pnmc.local";
        var reloj = new RelojDePrueba(DateTimeOffset.UtcNow);
        using var alcance = _factory.Services.CreateScope();
        var servicio = Servicio(alcance, reloj);

        for (var i = 0; i < servicio.MaximoDeFallos; i++)
        {
            await servicio.RegistrarFalloAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None);
        }

        Assert.NotNull(await servicio.EsperaAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None));
        Assert.Null(await servicio.EsperaAsync(BloqueoDeIngresoPorCuenta.CanalExterno, correo, CancellationToken.None));

        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var huella = BloqueoDeIngresoPorCuenta.HuellaDe(BloqueoDeIngresoPorCuenta.CanalConsola, correo);
        Assert.Equal(64, huella.Length);
        Assert.DoesNotContain(correo, huella, StringComparison.OrdinalIgnoreCase);
        Assert.False(await db.IntentosDeIngresoFallidos.AnyAsync(f => f.HuellaDeCuenta.Contains(correo)));
    }

    [Fact]
    public async Task Registrar_un_fallo_poda_lo_que_salio_de_la_ventana()
    {
        var correo = $"poda.{Guid.NewGuid():N}@pnmc.local";
        var reloj = new RelojDePrueba(DateTimeOffset.UtcNow);
        using var alcance = _factory.Services.CreateScope();
        var servicio = Servicio(alcance, reloj);

        await servicio.RegistrarFalloAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None);
        await servicio.RegistrarFalloAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None);
        reloj.Avanzar(servicio.Ventana + TimeSpan.FromMinutes(1));
        await servicio.RegistrarFalloAsync(BloqueoDeIngresoPorCuenta.CanalConsola, correo, CancellationToken.None);

        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var huella = BloqueoDeIngresoPorCuenta.HuellaDe(BloqueoDeIngresoPorCuenta.CanalConsola, correo);
        Assert.Equal(1, await db.IntentosDeIngresoFallidos.CountAsync(f => f.HuellaDeCuenta == huella));
        Assert.True(await FilasDeFalloAsync() >= 1);
    }
}
