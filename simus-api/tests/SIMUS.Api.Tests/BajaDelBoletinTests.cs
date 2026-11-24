using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La baja pública del boletín: el enlace «Darme de baja» de cada correo (revocación de la autorización, Ley 1581 art. 8).
/// </summary>
/// <remarks>
/// Se fijan seis decisiones: el testigo es una firma que no se puede falsificar; abrir el enlace (GET) no da de baja, la
/// da el botón (POST); repetir la baja no cambia nada; un testigo inválido responde siempre igual (no revela quién está
/// en la lista); la baja retira la autorización y deja escrito el origen; y las tres rutas llevan el cupo del alta.
/// </remarks>
public sealed class BajaDelBoletinTests : IClassFixture<TestWebApplicationFactory>
{
    private const string RutaAlta = "/api/v1/publico/boletin/suscripciones";
    private const string RutaConfirmar = "/api/v1/publico/boletin/confirmar";
    private const string RutaBaja = "/api/v1/publico/boletin/baja";
    private const string RutaUnClic = "/api/v1/publico/boletin/baja-un-clic";

    private readonly TestWebApplicationFactory _factory;

    public BajaDelBoletinTests(TestWebApplicationFactory factory) => _factory = factory;

    private static string Correo() => $"baja.{Guid.NewGuid():N}"[..20] + "@pnmc.test";

    private string CuerpoDelUltimoCorreo(string correo)
    {
        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        return db.Notifications.AsNoTracking()
            .Where(n => n.EventType == "ConfirmacionDeBoletin" && n.RecipientEmail == correo)
            .OrderByDescending(n => n.Id).Select(n => n.Body).First();
    }

    private static string Despues(string cuerpo, string marca)
    {
        var inicio = cuerpo.IndexOf(marca, StringComparison.Ordinal) + marca.Length;
        return new string(cuerpo[inicio..].TakeWhile(c => char.IsAsciiHexDigit(c) || c == '.').ToArray());
    }

    /// <summary>Suscribe, confirma y devuelve el testigo de baja que llegó en el correo.</summary>
    private async Task<string> SuscritoAsync(HttpClient cliente, string correo)
    {
        Assert.Equal(HttpStatusCode.Accepted, (await cliente.PostAsJsonAsync(RutaAlta, new { correo, autorizaTratamiento = true })).StatusCode);
        var cuerpo = CuerpoDelUltimoCorreo(correo);
        var confirmar = await cliente.PostAsJsonAsync(RutaConfirmar, new { testigo = Despues(cuerpo, "confirmar-boletin?testigo=") });
        Assert.Equal(HttpStatusCode.OK, confirmar.StatusCode);
        return Despues(cuerpo, "baja-boletin?testigo=");
    }

    private async Task<T> ConLaBaseAsync<T>(Func<SimusDbContext, Task<T>> trabajo)
    {
        using var alcance = _factory.Services.CreateScope();
        return await trabajo(alcance.ServiceProvider.GetRequiredService<SimusDbContext>());
    }

    [Fact]
    public async Task El_correo_de_confirmacion_lleva_el_enlace_de_baja_en_texto_plano_y_en_html()
    {
        var cliente = _factory.CreateClient();
        var correo = Correo();
        var testigo = await SuscritoAsync(cliente, correo);

        Assert.Matches(@"^\d+\.[0-9a-f]{64}$", testigo);
        var cuerpo = CuerpoDelUltimoCorreo(correo);
        Assert.Contains("darte de baja", cuerpo, StringComparison.Ordinal);

        var completo = DespachadorDeCorreo.CompletarEnlaces(cuerpo, "https://simus.gov.co");
        var html = PlantillaDeCorreoSimus.HtmlPara(PlantillaDeCorreoSimus.TipoConfirmacionDeBoletin, completo)!;
        Assert.Contains("Darme de baja", html, StringComparison.Ordinal);
        Assert.Contains($"https://simus.gov.co/ecosistema/baja-boletin?testigo={testigo}", html, StringComparison.Ordinal);
        // El «un clic» de la cabecera apunta al API con el mismo testigo.
        Assert.Equal(
            $"https://simus.gov.co/api/v1/publico/boletin/baja-un-clic?testigo={testigo}",
            PlantillaDeCorreoSimus.EnlaceDeUnClicDeBaja(completo));
    }

    [Fact]
    public async Task Abrir_el_enlace_no_da_de_baja_y_solo_enseña_el_correo_enmascarado()
    {
        var cliente = _factory.CreateClient();
        var correo = Correo();
        var testigo = await SuscritoAsync(cliente, correo);

        var vista = await cliente.GetAsync($"{RutaBaja}?testigo={testigo}");

        Assert.Equal(HttpStatusCode.OK, vista.StatusCode);
        var cuerpo = await vista.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("activa", cuerpo.GetProperty("estado").GetString());
        var enmascarado = cuerpo.GetProperty("correo").GetString()!;
        Assert.Contains("***@", enmascarado, StringComparison.Ordinal);
        Assert.NotEqual(correo, enmascarado);
        var fila = await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == correo));
        Assert.Equal("activa", fila.Estado);
        Assert.Null(fila.FechaBaja);
    }

    [Fact]
    public async Task El_boton_da_de_baja_registra_fecha_y_origen_y_retira_la_autorizacion()
    {
        var cliente = _factory.CreateClient();
        var correo = Correo();
        var testigo = await SuscritoAsync(cliente, correo);

        var baja = await cliente.PostAsJsonAsync(RutaBaja, new { testigo });

        Assert.Equal(HttpStatusCode.OK, baja.StatusCode);
        var fila = await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == correo));
        Assert.Equal("baja", fila.Estado);
        Assert.NotNull(fila.FechaBaja);
        Assert.Equal("persona", fila.OrigenBaja);
        var vigentes = await ConLaBaseAsync(db => db.AutorizacionesDeDatos.AsNoTracking()
            .CountAsync(a => a.Finalidad == "boletin" && a.CorreoTitular == correo && a.FechaRevocacion == null));
        Assert.Equal(0, vigentes);

        // Y el mismo enlace, abierto después, dice «baja».
        var vista = await (await cliente.GetAsync($"{RutaBaja}?testigo={testigo}")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("baja", vista.GetProperty("estado").GetString());
    }

    [Fact]
    public async Task Repetir_la_baja_es_idempotente_y_no_cambia_la_fecha()
    {
        var cliente = _factory.CreateClient();
        var correo = Correo();
        var testigo = await SuscritoAsync(cliente, correo);
        await cliente.PostAsJsonAsync(RutaBaja, new { testigo });
        var primera = await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == correo));

        var otra = await cliente.PostAsJsonAsync(RutaBaja, new { testigo });
        var tercera = await cliente.PostAsync($"{RutaUnClic}?testigo={testigo}", new FormUrlEncodedContent([new("List-Unsubscribe", "One-Click")]));

        Assert.Equal(HttpStatusCode.OK, otra.StatusCode);
        Assert.Equal(HttpStatusCode.OK, tercera.StatusCode);
        var despues = await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == correo));
        Assert.Equal(primera.FechaBaja, despues.FechaBaja);
        Assert.Equal("persona", despues.OrigenBaja);
    }

    [Fact]
    public async Task El_un_clic_del_cliente_de_correo_da_de_baja_con_un_POST_sin_pantalla()
    {
        var cliente = _factory.CreateClient();
        var correo = Correo();
        var testigo = await SuscritoAsync(cliente, correo);

        var respuesta = await cliente.PostAsync($"{RutaUnClic}?testigo={testigo}", new FormUrlEncodedContent([new("List-Unsubscribe", "One-Click")]));

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var fila = await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == correo));
        Assert.Equal("baja", fila.Estado);
        Assert.Equal("persona", fila.OrigenBaja);
    }

    [Fact]
    public async Task Un_testigo_falso_o_manipulado_responde_siempre_lo_mismo_y_no_toca_a_nadie()
    {
        var cliente = _factory.CreateClient();
        var correo = Correo();
        var testigo = await SuscritoAsync(cliente, correo);
        var id = testigo.Split('.')[0];
        var firma = testigo.Split('.')[1];
        var otraFirma = new string(firma.Select(c => c == '0' ? '1' : '0').ToArray());
        var inexistente = $"{int.MaxValue}.{firma}";

        var intentos = new[] { $"{id}.{otraFirma}", $"{id}.{firma[..^1]}", $"{int.Parse(id) + 1}.{firma}", inexistente, "x.y", firma, id, "", new string('a', 300) };
        string? mensaje = null;
        foreach (var intento in intentos)
        {
            var lectura = await cliente.GetAsync($"{RutaBaja}?testigo={Uri.EscapeDataString(intento)}");
            var escritura = await cliente.PostAsJsonAsync(RutaBaja, new { testigo = intento });
            var unClic = await cliente.PostAsync($"{RutaUnClic}?testigo={Uri.EscapeDataString(intento)}", null);
            Assert.Equal(HttpStatusCode.BadRequest, lectura.StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, escritura.StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, unClic.StatusCode);
            var texto = (await escritura.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString();
            mensaje ??= texto;
            // IGUAL para un id que existe con firma mala que para uno que no existe: no se puede sondear la lista.
            Assert.Equal(mensaje, texto);
        }

        var fila = await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == correo));
        Assert.Equal("activa", fila.Estado);
    }

    [Fact]
    public async Task Sin_testigo_o_con_cuerpo_vacio_no_rompe()
    {
        var cliente = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.GetAsync(RutaBaja)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsJsonAsync(RutaBaja, new { })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsync(RutaUnClic, null)).StatusCode);
    }

    [Fact]
    public async Task El_testigo_de_una_persona_no_sirve_para_otra()
    {
        var cliente = _factory.CreateClient();
        var ana = Correo();
        var berta = Correo();
        var testigoDeAna = await SuscritoAsync(cliente, ana);
        await SuscritoAsync(cliente, berta);

        await cliente.PostAsJsonAsync(RutaBaja, new { testigo = testigoDeAna });

        var filaDeBerta = await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == berta));
        Assert.Equal("activa", filaDeBerta.Estado);
    }

    [Fact]
    public async Task Quien_vuelve_a_suscribirse_despues_de_una_baja_queda_activa_sin_origen_de_baja()
    {
        var cliente = _factory.CreateClient();
        var correo = Correo();
        var testigo = await SuscritoAsync(cliente, correo);
        await cliente.PostAsJsonAsync(RutaBaja, new { testigo });

        await SuscritoAsync(cliente, correo);

        var fila = await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == correo));
        Assert.Equal("activa", fila.Estado);
        Assert.Null(fila.FechaBaja);
        Assert.Null(fila.OrigenBaja);
        // El enlace de antes sigue siendo el mismo (la firma es estable) y vuelve a servir.
        var vista = await (await cliente.GetAsync($"{RutaBaja}?testigo={testigo}")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("activa", vista.GetProperty("estado").GetString());
    }

    [Fact]
    public async Task La_baja_desde_la_consola_deja_origen_administracion_y_la_lista_lo_muestra()
    {
        var anonimo = _factory.CreateClient();
        var correo = Correo();
        await SuscritoAsync(anonimo, correo);
        var id = (await ConLaBaseAsync(db => db.BoletinSuscripciones.AsNoTracking().SingleAsync(f => f.CorreoElectronico == correo))).Id;

        var consola = _factory.CreateClient();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" })).EnsureSuccessStatusCode();
        await CmsTestClient.AttachCsrfAsync(consola);
        Assert.Equal(HttpStatusCode.OK, (await consola.PostAsync($"/api/v1/admin/comunicaciones/boletin/{id}/baja", null)).StatusCode);

        var lista = await consola.GetFromJsonAsync<JsonElement>($"/api/v1/admin/comunicaciones/boletin/?q={correo}");
        var item = lista.GetProperty("items").EnumerateArray().Single();
        Assert.Equal("baja", item.GetProperty("estado").GetString());
        Assert.Equal("administracion", item.GetProperty("origenBaja").GetString());
    }

    [Fact]
    public async Task La_lista_muestra_origen_persona_cuando_la_baja_la_hizo_el_enlace()
    {
        var anonimo = _factory.CreateClient();
        var correo = Correo();
        var testigo = await SuscritoAsync(anonimo, correo);
        await anonimo.PostAsJsonAsync(RutaBaja, new { testigo });

        var consola = _factory.CreateClient();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" })).EnsureSuccessStatusCode();
        var lista = await consola.GetFromJsonAsync<JsonElement>($"/api/v1/admin/comunicaciones/boletin/?q={correo}");
        Assert.Equal("persona", lista.GetProperty("items").EnumerateArray().Single().GetProperty("origenBaja").GetString());
    }

    [Fact]
    public void Las_tres_rutas_de_baja_llevan_el_cupo_del_alta_y_son_anonimas()
    {
        var fuentes = _factory.Services.GetServices<EndpointDataSource>();
        var rutas = fuentes.SelectMany(f => f.Endpoints).OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText is { } t && t.Contains("/publico/boletin/baja", StringComparison.Ordinal))
            .ToList();

        Assert.Equal(3, rutas.Count);
        foreach (var ruta in rutas)
        {
            Assert.Equal("boletin-alta", ruta.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName);
            Assert.NotNull(ruta.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.IAllowAnonymous>());
        }
    }

    [Fact]
    public void La_firma_cambia_con_la_clave_y_con_el_correo()
    {
        var a = Endpoints.BajaDelBoletin.Crear(new OpcionesDeCorreo { ClaveDeBaja = new string('a', 40) }, esEntornoLocal: false);
        var b = Endpoints.BajaDelBoletin.Crear(new OpcionesDeCorreo { ClaveDeBaja = new string('b', 40) }, esEntornoLocal: false);
        var fila = new SIMUS.Domain.Entities.BoletinSuscripcionRow { Id = 5, CorreoElectronico = "ana@x.co" };

        Assert.Equal(a.TestigoDe(fila), a.TestigoDe(fila));
        Assert.NotEqual(a.TestigoDe(fila), b.TestigoDe(fila));
        Assert.False(b.Coincide(fila, a.TestigoDe(fila)));
        fila.CorreoElectronico = "otra@x.co";
        Assert.False(a.Coincide(fila, a.TestigoDe(new SIMUS.Domain.Entities.BoletinSuscripcionRow { Id = 5, CorreoElectronico = "ana@x.co" })));
    }

    [Fact]
    public void En_Production_la_clave_de_baja_es_obligatoria()
    {
        var sinClave = new OpcionesDeCorreo
        {
            Proveedor = OpcionesDeCorreo.ProveedorSmtp,
            UrlPublica = "https://simus.gov.co",
            Remitente = "no-responder@simus.gov.co",
            Smtp = new OpcionesSmtp { Servidor = "smtp.ejemplo.org" },
        };

        var error = Assert.Throws<InvalidOperationException>(() => sinClave.Validar(exigirProveedor: true));
        Assert.Contains("Correo:ClaveDeBaja", error.Message, StringComparison.Ordinal);
        sinClave.Validar(exigirProveedor: false);
    }

    [Fact]
    public void El_enmascarado_no_deja_ver_el_correo_entero()
    {
        Assert.Equal("a***@g***.com", Endpoints.BajaDelBoletin.Enmascarar("ana@gmail.com"));
    }
}
