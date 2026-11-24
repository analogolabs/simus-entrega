using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// «¿Olvidaste tu contraseña?» de las cuentas externas.
/// </summary>
/// <remarks>
/// Cada prueba nombra una de las garantías de seguridad que el flujo promete: respuesta idéntica
/// exista o no la cuenta, un solo enlace vivo, un solo uso, vencimiento, sesiones anteriores
/// cerradas, límite por cuenta y enlace armado con la dirección pública configurada.
/// </remarks>
public sealed partial class RecuperacionDeContrasenaTests
    : IClassFixture<TestWebApplicationFactory>, IClassFixture<FabricaConLimitadorDeLoginActivo>
{
    private const string Clave = "ClaveExterna123";
    private const string ClaveNueva = "FraseNuevaDeSimus#2026";
    private const string Solicitar = "/api/v1/externo/auth/olvide-contrasena";
    private const string Restablecer = "/api/v1/externo/auth/restablecer-contrasena";
    private const string Comprobar = "/api/v1/externo/auth/restablecer-contrasena/comprobar";

    private readonly TestWebApplicationFactory _factory;
    private readonly FabricaConLimitadorDeLoginActivo _conLimitador;

    public RecuperacionDeContrasenaTests(TestWebApplicationFactory factory, FabricaConLimitadorDeLoginActivo conLimitador)
    {
        _factory = factory;
        _conLimitador = conLimitador;
    }

    // ── Andamio ──────────────────────────────────────────────────────────────────────────────

    private async Task<string> RegistrarAsync(string marca)
    {
        var correo = $"rec.{marca}.{Guid.NewGuid():N}"[..28] + "@example.com";
        var cliente = _factory.CreateClient();
        var respuesta = await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Lucía",
            FirstSurname = "Mosquera",
            DocumentType = "cc",
            DocumentNumber = RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(System.Globalization.CultureInfo.InvariantCulture),
            Phone = "3001234567",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        });
        respuesta.EnsureSuccessStatusCode();
        return correo;
    }

    private static async Task<string> TestigoCsrfAsync(HttpClient cliente) =>
        (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/auth/csrf"))!.RequestToken;

    private static async Task<HttpResponseMessage> PostConCsrfAsync(HttpClient cliente, string ruta, object cuerpo, string? host = null)
    {
        var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", await TestigoCsrfAsync(cliente));
        if (host is not null) mensaje.Headers.Host = host;
        return await cliente.SendAsync(mensaje);
    }

    private async Task<HttpResponseMessage> PedirAsync(string correo, HttpClient? cliente = null, string? host = null) =>
        await PostConCsrfAsync(cliente ?? _factory.CreateClient(), Solicitar, new { correo }, host);

    /// <summary>El testigo en claro, leído del cuerpo del correo en cola (lo único que lo contiene).</summary>
    private async Task<string> TestigoDelCorreoAsync(string correo)
    {
        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var cuerpo = await db.Notifications.AsNoTracking()
            .Where(n => n.RecipientEmail == correo && n.EventType == "RecuperacionDeContrasena")
            .OrderByDescending(n => n.Id).Select(n => n.Body).FirstAsync();
        return TestigoEnElCuerpo().Match(cuerpo).Groups[1].Value;
    }

    [GeneratedRegex(@"testigo=([0-9a-f]{64})")]
    private static partial Regex TestigoEnElCuerpo();

    private async Task<T> ConDbAsync<T>(Func<SimusDbContext, Task<T>> trabajo)
    {
        using var alcance = _factory.Services.CreateScope();
        return await trabajo(alcance.ServiceProvider.GetRequiredService<SimusDbContext>());
    }

    private Task<int> FilasDeEnlaceAsync(string correo) => ConDbAsync(db =>
        db.RestablecimientosDeContrasena.CountAsync(f => db.Users.Any(u => u.Email == correo && u.Id == f.IdUsuario)));

    /// <summary>Retrasa lo ya emitido para que la espera entre solicitudes no impida pedir otro enlace.</summary>
    private async Task RetrocederEmisionesAsync(string correo) => _ = await ConDbAsync(async db =>
    {
        var filas = await db.RestablecimientosDeContrasena
            .Where(f => db.Users.Any(u => u.Email == correo && u.Id == f.IdUsuario)).ToListAsync();
        foreach (var fila in filas)
        {
            fila.FechaEmision = fila.FechaEmision.AddMinutes(-5);
            fila.FechaExpiracion = fila.FechaExpiracion.AddMinutes(-5);
        }
        await db.SaveChangesAsync();
        return 0;
    });

    private async Task<HttpClient> EntrarAsync(string correo, string clave = Clave)
    {
        var cliente = _factory.CreateClient();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = clave }))
            .EnsureSuccessStatusCode();
        return cliente;
    }

    // ── Sin enumeración de cuentas ──────────────────────────────────────────────────────────

    [Fact]
    public async Task La_respuesta_es_identica_exista_o_no_la_cuenta_y_solo_la_real_recibe_enlace()
    {
        var existente = await RegistrarAsync("existe");
        var desactivada = await RegistrarAsync("baja");
        await ConDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Email == desactivada)).IsActive = false;
            await db.SaveChangesAsync();
            return 0;
        });

        var respuestas = new List<(string Correo, HttpStatusCode Estado, string Cuerpo)>();
        foreach (var correo in new[] { existente, "no.existe.nunca@example.com", desactivada, "test@pnmc.local" })
        {
            var r = await PedirAsync(correo);
            respuestas.Add((correo, r.StatusCode, await r.Content.ReadAsStringAsync()));
        }

        Assert.All(respuestas, r => Assert.Equal(HttpStatusCode.Accepted, r.Estado));
        Assert.Single(respuestas.Select(r => r.Cuerpo).Distinct());

        Assert.Equal(1, await FilasDeEnlaceAsync(existente));
        Assert.Equal(0, await FilasDeEnlaceAsync(desactivada));
        // La cuenta interna de la consola (webmaster) tampoco recibe nada: su contraseña la restablece el webmaster.
        Assert.Equal(0, await ConDbAsync(db => db.Notifications.CountAsync(n => n.RecipientEmail == "test@pnmc.local" && n.EventType == "RecuperacionDeContrasena")));
        Assert.Equal(0, await ConDbAsync(db => db.Notifications.CountAsync(n => n.RecipientEmail == desactivada && n.EventType == "RecuperacionDeContrasena")));
        Assert.Equal(1, await ConDbAsync(db => db.Notifications.CountAsync(n => n.RecipientEmail == existente && n.EventType == "RecuperacionDeContrasena")));
    }

    [Fact]
    public async Task Atender_una_cuenta_real_no_se_distingue_por_el_tiempo_de_una_inexistente()
    {
        var existente = await RegistrarAsync("tiempo");

        var reloj = Stopwatch.StartNew();
        await PedirAsync(existente);
        var real = reloj.Elapsed;
        reloj.Restart();
        await PedirAsync("nadie.tiempo@example.com");
        var inexistente = reloj.Elapsed;

        // Las dos tardan al menos el piso, así que la diferencia no es la de una consulta de menos.
        var piso = TimeSpan.FromMilliseconds(400);
        Assert.True(real >= piso, $"real {real}");
        Assert.True(inexistente >= piso, $"inexistente {inexistente}");
    }

    [Fact]
    public async Task Un_correo_mal_escrito_se_dice_y_la_peticion_sin_testigo_antiforgery_se_rechaza()
    {
        var cliente = _factory.CreateClient();
        var malEscrito = await PostConCsrfAsync(cliente, Solicitar, new { correo = "no-es-un-correo" });
        Assert.Equal(HttpStatusCode.BadRequest, malEscrito.StatusCode);

        var sinTestigo = await _factory.CreateClient().PostAsJsonAsync(Solicitar, new { correo = "alguien@example.com" });
        Assert.Equal(HttpStatusCode.BadRequest, sinTestigo.StatusCode);
    }

    // ── El testigo y el enlace ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task El_testigo_tiene_256_bits_y_en_la_base_solo_queda_su_resumen()
    {
        var correo = await RegistrarAsync("hash");
        await PedirAsync(correo);
        var testigo = await TestigoDelCorreoAsync(correo);

        Assert.Equal(64, testigo.Length); // 32 bytes = 256 bits en hexadecimal
        var fila = await ConDbAsync(db => db.RestablecimientosDeContrasena.AsNoTracking()
            .SingleAsync(f => db.Users.Any(u => u.Email == correo && u.Id == f.IdUsuario)));
        Assert.Equal(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(testigo))).ToLowerInvariant(), fila.HashTestigo);
        Assert.NotEqual(testigo, fila.HashTestigo);
        Assert.Equal(TimeSpan.FromMinutes(60), fila.FechaExpiracion - fila.FechaEmision);
        // Ni el testigo en claro ni nada derivado aparecen en ninguna otra tabla.
        Assert.Equal(0, await ConDbAsync(db => db.AuditLogs.CountAsync(a => (a.NewValuesJson ?? "").Contains(testigo))));
    }

    [Fact]
    public async Task Pedir_otro_enlace_invalida_el_anterior_y_deja_uno_solo_vivo()
    {
        var correo = await RegistrarAsync("unico");
        await PedirAsync(correo);
        var primero = await TestigoDelCorreoAsync(correo);
        await RetrocederEmisionesAsync(correo);
        await PedirAsync(correo);
        var segundo = await TestigoDelCorreoAsync(correo);

        Assert.NotEqual(primero, segundo);
        Assert.Equal(1, await ConDbAsync(db => db.RestablecimientosDeContrasena.CountAsync(f =>
            db.Users.Any(u => u.Email == correo && u.Id == f.IdUsuario) && f.FechaUso == null && f.FechaInvalidacion == null)));

        var cliente = _factory.CreateClient();
        var viejo = await PostConCsrfAsync(cliente, Restablecer, new { testigo = primero, nueva = ClaveNueva });
        Assert.Equal(HttpStatusCode.BadRequest, viejo.StatusCode);
        Assert.Contains("enlace_reemplazado", await viejo.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        var bueno = await PostConCsrfAsync(cliente, Restablecer, new { testigo = segundo, nueva = ClaveNueva });
        Assert.Equal(HttpStatusCode.NoContent, bueno.StatusCode);
    }

    [Fact]
    public async Task El_enlace_se_arma_con_la_direccion_publica_configurada_y_nunca_con_el_Host_de_la_peticion()
    {
        // Fábrica propia: la dirección pública es configuración del arranque y su base es otra.
        using var conUrl = new TestWebApplicationFactory().WithWebHostBuilder(constructor => constructor.ConfigureServices(servicios =>
        {
            servicios.RemoveAll<OpcionesDeCorreo>();
            servicios.AddSingleton(new OpcionesDeCorreo { UrlPublica = "https://simus.ejemplo.org/" });
        }));
        var cliente = conUrl.CreateClient();
        var correo = $"rec.host.{Guid.NewGuid():N}"[..24] + "@example.com";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual", FirstName = "Lucía", FirstSurname = "Mosquera", DocumentType = "cc",
            DocumentNumber = "52" + RandomNumberGenerator.GetInt32(1000000, 9999999).ToString(System.Globalization.CultureInfo.InvariantCulture),
            Phone = "3001234567", Email = correo, Password = Clave, PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();

        var respuesta = await PedirAsync(correo, cliente, host: "sitio-malicioso.example");
        Assert.Equal(HttpStatusCode.Accepted, respuesta.StatusCode);

        using var alcance = conUrl.Services.CreateScope();
        var cuerpo = await alcance.ServiceProvider.GetRequiredService<SimusDbContext>().Notifications.AsNoTracking()
            .Where(n => n.RecipientEmail == correo && n.EventType == "RecuperacionDeContrasena").Select(n => n.Body).SingleAsync();
        Assert.Contains("https://simus.ejemplo.org/ecosistema/restablecer-contrasena?testigo=", cuerpo, StringComparison.Ordinal);
        Assert.DoesNotContain("malicioso", cuerpo, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Sin_direccion_publica_el_enlace_queda_relativo_para_que_lo_complete_el_despachador()
    {
        var correo = await RegistrarAsync("relativo");
        await PedirAsync(correo, host: "sitio-malicioso.example");

        var cuerpo = await ConDbAsync(db => db.Notifications.AsNoTracking()
            .Where(n => n.RecipientEmail == correo && n.EventType == "RecuperacionDeContrasena").Select(n => n.Body).SingleAsync());
        Assert.Matches(@"(?m)^/ecosistema/restablecer-contrasena\?testigo=[0-9a-f]{64}$", cuerpo);
        Assert.DoesNotContain("malicioso", cuerpo, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task El_correo_no_lleva_el_nombre_de_la_cuenta_ni_las_respuestas_se_guardan_en_cache()
    {
        // Quien registra una cuenta con un correo ajeno elige el nombre: puesto en el correo que llega al
        // dueño del buzón sería un texto de suplantación dentro de un mensaje legítimo.
        var correo = await RegistrarAsync("nombre");
        await ConDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Email == correo)).FullName = "Visita https://sitio-falso.example ya";
            await db.SaveChangesAsync();
            return 0;
        });

        var cliente = _factory.CreateClient();
        var testigo = await cliente.GetAsync("/api/v1/externo/auth/csrf");
        Assert.Contains("no-store", testigo.Headers.CacheControl?.ToString() ?? string.Empty, StringComparison.Ordinal);
        var respuesta = await PedirAsync(correo, cliente);
        Assert.Contains("no-store", respuesta.Headers.CacheControl?.ToString() ?? string.Empty, StringComparison.Ordinal);

        var cuerpo = await ConDbAsync(db => db.Notifications.AsNoTracking()
            .Where(n => n.RecipientEmail == correo && n.EventType == "RecuperacionDeContrasena").Select(n => n.Body).SingleAsync());
        Assert.DoesNotContain("sitio-falso", cuerpo, StringComparison.Ordinal);
    }

    // ── Restablecer ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Restablecer_cambia_la_clave_cierra_las_demas_sesiones_y_el_enlace_no_se_reutiliza()
    {
        var correo = await RegistrarAsync("flujo");
        var sesionAnterior = await EntrarAsync(correo);
        Assert.Equal(HttpStatusCode.OK, (await sesionAnterior.GetAsync("/api/v1/externo/auth/me")).StatusCode);

        await PedirAsync(correo);
        var testigo = await TestigoDelCorreoAsync(correo);

        var cliente = _factory.CreateClient();
        var estado = await (await cliente.PostAsJsonAsync(Comprobar, new { testigo })).Content.ReadFromJsonAsync<EstadoDelEnlaceDeRecuperacion>();
        Assert.True(estado!.Valido);
        Assert.DoesNotContain(correo, estado.CorreoEnmascarado!, StringComparison.Ordinal);

        // Sin testigo antiforgery no se restablece.
        var sinCsrf = await _factory.CreateClient().PostAsJsonAsync(Restablecer, new { testigo, nueva = ClaveNueva });
        Assert.Equal(HttpStatusCode.BadRequest, sinCsrf.StatusCode);

        // Una clave débil no gasta el enlace.
        var debil = await PostConCsrfAsync(cliente, Restablecer, new { testigo, nueva = "corta" });
        Assert.Equal(HttpStatusCode.BadRequest, debil.StatusCode);
        Assert.Contains("nueva", await debil.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var hecho = await PostConCsrfAsync(cliente, Restablecer, new { testigo, nueva = ClaveNueva });
        Assert.Equal(HttpStatusCode.NoContent, hecho.StatusCode);

        // Un solo uso.
        var repetido = await PostConCsrfAsync(cliente, Restablecer, new { testigo, nueva = "OtraFraseDistinta#2027" });
        Assert.Equal(HttpStatusCode.BadRequest, repetido.StatusCode);
        Assert.Contains("enlace_usado", await repetido.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        // La sesión que ya estaba abierta con la clave anterior deja de servir (sello de credencial).
        Assert.Equal(HttpStatusCode.Unauthorized, (await sesionAnterior.GetAsync("/api/v1/externo/auth/me")).StatusCode);

        // La clave vieja no entra; la nueva sí.
        var vieja = await _factory.CreateClient().PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave });
        Assert.Equal(HttpStatusCode.Unauthorized, vieja.StatusCode);
        var nueva = await _factory.CreateClient().PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = ClaveNueva });
        Assert.Equal(HttpStatusCode.OK, nueva.StatusCode);

        // Se avisa a la persona del cambio.
        Assert.Equal(1, await ConDbAsync(db => db.Notifications.CountAsync(n => n.RecipientEmail == correo && n.EventType == "ContrasenaRestablecida")));
    }

    [Fact]
    public async Task La_bitacora_registra_la_solicitud_y_el_restablecimiento_sin_datos_sensibles()
    {
        var correo = await RegistrarAsync("bitacora");
        await PedirAsync(correo);
        var testigo = await TestigoDelCorreoAsync(correo);
        (await PostConCsrfAsync(_factory.CreateClient(), Restablecer, new { testigo, nueva = ClaveNueva })).EnsureSuccessStatusCode();

        var filas = await ConDbAsync(async db =>
        {
            var id = (await db.Users.SingleAsync(u => u.Email == correo)).Id.ToString(System.Globalization.CultureInfo.InvariantCulture);
            return await db.AuditLogs.AsNoTracking().Where(a => a.TableName == "Usuarios" && a.RecordId == id).ToListAsync();
        });
        var eventos = filas.Select(a => a.NewValuesJson).Where(j => j is not null).Select(j => JsonDocument.Parse(j!).RootElement.GetProperty("evento").GetString()).ToList();
        Assert.Contains("restablecimiento_solicitado", eventos);
        Assert.Contains("contrasena_restablecida", eventos);
        Assert.All(filas, a => Assert.Contains(a.Action, SIMUS.Api.Endpoints.AccionesAuditoria.Admitidos));
        var todo = string.Concat(filas.Select(a => (a.NewValuesJson ?? "") + (a.PreviousValuesJson ?? "")));
        Assert.DoesNotContain(testigo, todo, StringComparison.Ordinal);
        Assert.DoesNotContain(ClaveNueva, todo, StringComparison.Ordinal);
        Assert.DoesNotContain(correo, todo, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_enlace_vencido_inexistente_o_de_otra_cuenta_no_sirve()
    {
        var a = await RegistrarAsync("cuentaa");
        var b = await RegistrarAsync("cuentab");
        await PedirAsync(a);
        var testigoA = await TestigoDelCorreoAsync(a);
        var cliente = _factory.CreateClient();

        // Inexistente y mal formado.
        foreach (var falso in new[] { new string('a', 64), "corto", "", new string('z', 64) })
        {
            var r = await PostConCsrfAsync(cliente, Restablecer, new { testigo = falso, nueva = ClaveNueva });
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Contains("enlace_no_valido", await r.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        }

        // El enlace de A cambia la clave de A y de nadie más.
        (await PostConCsrfAsync(cliente, Restablecer, new { testigo = testigoA, nueva = ClaveNueva })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await _factory.CreateClient().PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = b, Password = Clave })).StatusCode);

        // Vencido: se retrasa su expiración.
        await RetrocederEmisionesAsync(a);
        await PedirAsync(a);
        await ConDbAsync(async db =>
        {
            var fila = await db.RestablecimientosDeContrasena.Where(f => f.FechaUso == null && f.FechaInvalidacion == null).OrderByDescending(f => f.Id).FirstAsync();
            fila.FechaEmision = DateTime.UtcNow.AddMinutes(-90);
            fila.FechaExpiracion = DateTime.UtcNow.AddMinutes(-30);
            await db.SaveChangesAsync();
            return 0;
        });
        var vencidoTestigo = await TestigoDelCorreoAsync(a);
        var vencido = await PostConCsrfAsync(cliente, Restablecer, new { testigo = vencidoTestigo, nueva = "OtraFraseDistinta#2027" });
        Assert.Equal(HttpStatusCode.BadRequest, vencido.StatusCode);
        Assert.Contains("enlace_vencido", await vencido.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Si_la_cuenta_se_desactiva_despues_el_enlace_ya_no_sirve()
    {
        var correo = await RegistrarAsync("desactivar");
        await PedirAsync(correo);
        var testigo = await TestigoDelCorreoAsync(correo);
        await ConDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Email == correo)).IsActive = false;
            await db.SaveChangesAsync();
            return 0;
        });

        var r = await PostConCsrfAsync(_factory.CreateClient(), Restablecer, new { testigo, nueva = ClaveNueva });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
    }

    // ── Límites ──────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Por_cuenta_se_atienden_tres_por_hora_y_con_dos_minutos_de_espera_sin_contestar_distinto()
    {
        var correo = await RegistrarAsync("limite");

        var primera = await PedirAsync(correo);
        var inmediata = await PedirAsync(correo); // dentro de la espera: no emite otro enlace
        Assert.Equal(1, await FilasDeEnlaceAsync(correo));
        Assert.Equal(await primera.Content.ReadAsStringAsync(), await inmediata.Content.ReadAsStringAsync());
        Assert.Equal(primera.StatusCode, inmediata.StatusCode);

        for (var i = 0; i < 3; i++)
        {
            await RetrocederEmisionesAsync(correo);
            var r = await PedirAsync(correo);
            Assert.Equal(HttpStatusCode.Accepted, r.StatusCode);
            // Retroceder 5 min cada vez deja las cuatro dentro de la hora: la cuarta ya no se emite.
        }

        Assert.Equal(3, await FilasDeEnlaceAsync(correo));
        // El último enlace emitido sigue sirviendo: el límite no deja a la persona sin recuperar.
        var vivo = await TestigoDelCorreoAsync(correo);
        var r2 = await PostConCsrfAsync(_factory.CreateClient(), Restablecer, new { testigo = vivo, nueva = ClaveNueva });
        Assert.Equal(HttpStatusCode.NoContent, r2.StatusCode);
    }

    [Fact]
    public async Task Por_origen_el_limitador_corta_en_429_sin_afectar_a_otro_origen()
    {
        // Lo que se mide es que el limitador (que corre ANTES del manejador) corta al décimo primero; en
        // este entorno el manejador no llega a contestar bien (el anillo de claves no está configurado),
        // y da igual: el 429 sale antes.
        var cliente = _conLimitador.CreateClient();
        async Task<HttpStatusCode> IntentarAsync(string ip)
        {
            var mensaje = new HttpRequestMessage(HttpMethod.Post, Solicitar) { Content = JsonContent.Create(new { correo = "alguien@example.com" }) };
            mensaje.Headers.Add(FabricaConLimitadorDeLoginActivo.CabeceraIpDeOrigen, ip);
            return (await cliente.SendAsync(mensaje)).StatusCode;
        }

        var estados = new List<HttpStatusCode>();
        for (var i = 0; i < 12; i++) estados.Add(await IntentarAsync("203.0.113.50"));

        Assert.DoesNotContain(HttpStatusCode.TooManyRequests, estados.Take(10));
        Assert.Equal(HttpStatusCode.TooManyRequests, estados[^1]);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, await IntentarAsync("203.0.113.51"));
    }
}
