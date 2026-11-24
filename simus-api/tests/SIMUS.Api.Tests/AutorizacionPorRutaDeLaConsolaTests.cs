using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Security;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// auditoría de seguridad (hueco H-06 de la matriz de endpoints).
/// <para>
/// <b>EL DEFECTO.</b> Treinta y cinco operaciones de la consola se cerraban con
/// <c>RequireAuthorization()</c> a secas —«cuenta de consola, la que sea»— y dejaban el rol o el módulo
/// a un <c>if</c> dentro del manejador. El barrido de <see cref="AutorizacionPorDefectoTests"/> solo exige
/// que cada ruta diga algo; con una autorización sin nombre dice «hay sesión» y la matriz de
/// permisos no se puede leer sin abrir cada manejador. Una ruta nueva, copiada de una de ellas, nacía
/// con la misma puerta a medias.
/// </para>
/// <para>
/// <b>LAS DOS MITADES DE ESTA CLASE.</b> (1) Un censo sobre <see cref="EndpointDataSource"/>: ninguna ruta
/// autorizada puede llevar una autorización sin política con nombre, y la política tiene que ser una de las
/// que el sistema conoce; una ruta de lectura o escritura sensible nueva sin política rompe la suite.
/// (2) Una prueba parametrizada por cada una de las 35 operaciones: sin sesión es 401, con la sesión de
/// una persona del ecosistema (canal externo) es 401, con una cuenta de gestor sin el módulo o sin el rol
/// es 403, y con la cuenta que sí puede la puerta se abre (cualquier cosa menos 401 o 403).
/// </para>
/// </summary>
public sealed class AutorizacionPorRutaDeLaConsolaTests : IClassFixture<TestWebApplicationFactory>, IAsyncLifetime
{
    private static int _contador;
    private const string ClaveExterna = "ClaveExterna.2026-ok";

    private readonly TestWebApplicationFactory _factory;
    private HttpClient _gestorSinModulos = null!;
    private HttpClient _externa = null!;

    public AutorizacionPorRutaDeLaConsolaTests(TestWebApplicationFactory factory) => _factory = factory;

    /// <summary>Qué puerta lleva cada ruta.</summary>
    public enum Puerta
    {
        /// <summary>Cualquier rol interno (webmaster o gestor); el módulo, si lo hay, lo decide el filtro del grupo.</summary>
        Funcionario,

        /// <summary>Solo el webmaster, por política declarada en la ruta.</summary>
        Webmaster,

        /// <summary>Rol interno y el módulo «gestion-sitio» activado en la cuenta.</summary>
        ModuloGestionDelSitio,
    }

    public async Task InitializeAsync()
    {
        // La cuenta de gestor sin ningún módulo concedido, ya con su primer ingreso hecho (si no, el 403 sería
        // el del recorrido de bienvenida y no el del módulo). El testigo se le adjunta para que la escritura
        // llegue a la autorización y no se pare antes en el 400 del testigo.
        var (_, sesion, _) = await PermisosPorCuentaTests.GestorAsync(_factory);
        await CmsTestClient.AttachCsrfAsync(sesion);
        _gestorSinModulos = sesion;

        _externa = _factory.CreateClient();
        var correo = $"externa.{Guid.NewGuid():N}@example.com";
        var registro = await _externa.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Lucía",
            FirstSurname = "Mosquera",
            DocumentType = "cc",
            DocumentNumber = (71_000_000 + Interlocked.Increment(ref _contador)).ToString(System.Globalization.CultureInfo.InvariantCulture),
            Phone = "3001234567",
            Email = correo,
            Password = ClaveExterna,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        });
        registro.EnsureSuccessStatusCode();
        (await _externa.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = ClaveExterna }))
            .EnsureSuccessStatusCode();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // ---------- 1. El censo -------------------------------------------------------

    private List<RouteEndpoint> RutasAutorizadas()
    {
        using var arranque = _factory.CreateClient();
        var rutas = _factory.Services.GetServices<EndpointDataSource>()
            .SelectMany(fuente => fuente.Endpoints)
            .OfType<RouteEndpoint>()
            .Distinct()
            .Where(ruta => ruta.Metadata.GetMetadata<IAllowAnonymous>() is null
                && ruta.Metadata.GetOrderedMetadata<IAuthorizeData>().Count > 0)
            .ToList();

        // Canario: un censo que no ve rutas pasa siempre y no vigila nada.
        Assert.True(rutas.Count >= 300, $"El censo solo vio {rutas.Count} rutas autorizadas; la lectura de EndpointDataSource dejó de funcionar.");
        return rutas;
    }

    private static string Nombrar(RouteEndpoint ruta)
    {
        var metodos = ruta.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? [];
        return $"{string.Join(",", metodos)} {ruta.RoutePattern.RawText}";
    }

    /// <summary>Las políticas con nombre que el sistema declara; cualquier otra en una ruta es un error de escritura.</summary>
    private static readonly HashSet<string> PoliticasConocidas = new(StringComparer.Ordinal)
    {
        SimusAuthentication.InstitutionalPolicy,
        SimusAuthentication.ExternalPolicy,
        SimusAuthentication.PoliticaCualquierSesion,
        Permisos.PoliticaFuncionario,
        Permisos.PoliticaWebmaster,
    };

    /// <summary>
    /// EL CENSO. Toda ruta autorizada lleva una política con nombre. <c>RequireAuthorization()</c> a secas
    /// cae en la política por omisión («hay sesión de consola») y deja el rol o el módulo a un <c>if</c> del
    /// manejador, que ni la matriz de endpoints ni esta suite pueden leer. Si falla: elija la política que
    /// corresponde —<see cref="Permisos.PoliticaFuncionario"/>, <see cref="Permisos.PoliticaWebmaster"/>,
    /// <see cref="SimusAuthentication.ExternalPolicy"/>…— y, si es de un módulo, añada <c>ExigeModulo</c>.
    /// </summary>
    [Fact]
    public void Ninguna_ruta_autorizada_se_queda_sin_politica_con_nombre()
    {
        var sinPolitica = RutasAutorizadas()
            .Where(ruta => !ruta.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Any(dato => !string.IsNullOrWhiteSpace(dato.Policy)))
            .Select(Nombrar)
            .OrderBy(nombre => nombre, StringComparer.Ordinal)
            .ToList();

        Assert.True(
            sinPolitica.Count == 0,
            $"{sinPolitica.Count} ruta(s) autorizadas sin política con nombre (solo «hay sesión»):"
            + Environment.NewLine + string.Join(Environment.NewLine, sinPolitica));
    }

    [Fact]
    public void Toda_politica_declarada_en_una_ruta_es_una_politica_conocida()
    {
        var desconocidas = RutasAutorizadas()
            .SelectMany(ruta => ruta.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Where(dato => !string.IsNullOrWhiteSpace(dato.Policy) && !PoliticasConocidas.Contains(dato.Policy!))
                .Select(dato => $"{Nombrar(ruta)} → {dato.Policy}"))
            .Distinct()
            .OrderBy(texto => texto, StringComparer.Ordinal)
            .ToList();

        Assert.True(
            desconocidas.Count == 0,
            "Rutas con una política que no está en la lista del censo (añádala a PoliticasConocidas si es nueva y a propósito):"
            + Environment.NewLine + string.Join(Environment.NewLine, desconocidas));
    }

    /// <summary>
    /// La consola institucional (<c>/admin/*</c> e <c>/institucional/*</c>) no admite la política «cualquier
    /// sesión» ni la externa: esas son del buzón y del portal. Si una ruta de consola las usa, hay un cruce
    /// de puertas.
    /// </summary>
    [Fact]
    public void Las_rutas_de_la_consola_solo_usan_politicas_institucionales()
    {
        var institucionales = new HashSet<string>(StringComparer.Ordinal)
        {
            SimusAuthentication.InstitutionalPolicy, Permisos.PoliticaFuncionario, Permisos.PoliticaWebmaster,
        };

        var cruzadas = RutasAutorizadas()
            .Where(ruta => ruta.RoutePattern.RawText is { } patron
                && (patron.StartsWith("/api/v1/admin/", StringComparison.Ordinal)
                    || patron.StartsWith("/api/v1/institucional/", StringComparison.Ordinal)))
            .Where(ruta => !ruta.Metadata.GetOrderedMetadata<IAuthorizeData>()
                .Any(dato => dato.Policy is not null && institucionales.Contains(dato.Policy)))
            .Select(Nombrar)
            .OrderBy(nombre => nombre, StringComparer.Ordinal)
            .ToList();

        Assert.True(
            cruzadas.Count == 0,
            "Rutas de consola cuya política no es institucional:" + Environment.NewLine + string.Join(Environment.NewLine, cruzadas));
    }

    // ---------- 2. Las 35 operaciones --------------------------------------------

    /// <summary>Las 35 operaciones del hueco H-06: método, ruta con valores de muestra y la puerta que lleva cada una.</summary>
    public static TheoryData<string, string, Puerta> Operaciones => new()
    {
        // Cuentas de la consola: solo el webmaster.
        { "GET", "/api/v1/admin/auth/users", Puerta.Webmaster },
        { "POST", "/api/v1/admin/auth/users", Puerta.Webmaster },
        { "DELETE", "/api/v1/admin/auth/users/999999", Puerta.Webmaster },
        { "DELETE", "/api/v1/admin/auth/users/999999/definitiva", Puerta.Webmaster },
        // Importar un respaldo de textos pisa la nómina y los borradores: solo el webmaster.
        { "POST", "/api/v1/admin/contenido-web/import", Puerta.Webmaster },
        // Textos del sitio: módulo «gestion-sitio».
        { "GET", "/api/v1/admin/contenido-web/backup", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/contenido-web/import/preview", Puerta.ModuloGestionDelSitio },
        { "GET", "/api/v1/admin/contenido-web/summary", Puerta.ModuloGestionDelSitio },
        { "GET", "/api/v1/admin/contenido-web/groups/home_hero", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/contenido-web/groups/home_hero", Puerta.ModuloGestionDelSitio },
        { "GET", "/api/v1/admin/contenido-web/groups/home_hero/history", Puerta.ModuloGestionDelSitio },
        { "GET", "/api/v1/admin/contenido-web/home_title/history", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/contenido-web/home_title/republish", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/contenido-web/home_title/retire", Puerta.ModuloGestionDelSitio },
        { "GET", "/api/v1/admin/equipo-web", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/equipo-web", Puerta.ModuloGestionDelSitio },
        { "GET", "/api/v1/admin/imagenes-web/groups/home_hero", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/imagenes-web/inicio_portada", Puerta.ModuloGestionDelSitio },
        { "PUT", "/api/v1/admin/imagenes-web/inicio_portada/alt", Puerta.ModuloGestionDelSitio },
        { "GET", "/api/v1/admin/imagenes-web/inicio_portada/history", Puerta.ModuloGestionDelSitio },
        { "GET", "/api/v1/admin/imagenes-web/inicio_portada/preview/borrador", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/imagenes-web/inicio_portada/publish", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/imagenes-web/inicio_portada/republish", Puerta.ModuloGestionDelSitio },
        { "POST", "/api/v1/admin/imagenes-web/inicio_portada/retire", Puerta.ModuloGestionDelSitio },
        // Propias de la cuenta y gobierno del registro: cualquier rol interno (el trámite lo vetan sus módulos por dentro).
        { "PUT", "/api/v1/admin/auth/profile", Puerta.Funcionario },
        { "GET", "/api/v1/admin/contenido-web/csrf", Puerta.Funcionario },
        { "GET", "/api/v1/admin/data-quality/flags", Puerta.Funcionario },
        { "POST", "/api/v1/admin/data-quality/flags", Puerta.Funcionario },
        { "POST", "/api/v1/admin/data-quality/flags/999999/status", Puerta.Funcionario },
        { "GET", "/api/v1/admin/duplicates", Puerta.Funcionario },
        { "POST", "/api/v1/admin/duplicates", Puerta.Funcionario },
        { "POST", "/api/v1/admin/duplicates/999999/decision", Puerta.Funcionario },
        { "GET", "/api/v1/admin/solicitudes-de-vinculacion", Puerta.Funcionario },
        { "POST", "/api/v1/admin/solicitudes-de-vinculacion/999999/status", Puerta.Funcionario },
        { "POST", "/api/v1/admin/auth/logout", Puerta.Funcionario },
    };

    private static HttpRequestMessage Pedir(string metodo, string ruta)
    {
        var mensaje = new HttpRequestMessage(new HttpMethod(metodo), ruta);
        if (metodo is "POST" or "PUT")
        {
            // La subida de imagen solo encaja con un formulario: con JSON el enrutador ni la reconoce (404).
            mensaje.Content = ruta.EndsWith("/imagenes-web/inicio_portada", StringComparison.Ordinal)
                ? new MultipartFormDataContent { { new StringContent("x"), "campo" } }
                : JsonContent.Create(new { });
        }

        return mensaje;
    }

    [Theory]
    [MemberData(nameof(Operaciones))]
    public async Task Sin_sesion_la_ruta_responde_401(string metodo, string ruta, Puerta puerta)
    {
        _ = puerta;
        using var anonimo = _factory.CreateClient();

        var respuesta = await anonimo.SendAsync(Pedir(metodo, ruta));

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Operaciones))]
    public async Task Con_la_sesion_de_una_persona_del_ecosistema_la_ruta_responde_401(string metodo, string ruta, Puerta puerta)
    {
        _ = puerta;
        // La cookie del canal externo no abre la puerta institucional: no es un 403 con la ruta a la vista,
        // es una puerta que no la reconoce.
        var respuesta = await _externa.SendAsync(Pedir(metodo, ruta));

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Operaciones))]
    public async Task Una_cuenta_de_gestor_sin_el_rol_o_el_modulo_recibe_403(string metodo, string ruta, Puerta puerta)
    {
        if (puerta == Puerta.Funcionario)
        {
            // Un gestor ES un rol interno: para estas rutas el 403 por rol no se puede provocar con una cuenta
            // real (la puerta de la consola no emite cookie a nadie sin rol interno; lo vigila
            // PuertaInstitucionalTests). Lo que sí se comprueba aquí es que la puerta se abre.
            if (ruta.EndsWith("/logout", StringComparison.Ordinal))
            {
                return; // cierra la sesión compartida; lo cubre Con_la_cuenta_que_puede_la_puerta_se_abre.
            }

            var abierta = await _gestorSinModulos.SendAsync(Pedir(metodo, ruta));
            Assert.NotEqual(HttpStatusCode.Unauthorized, abierta.StatusCode);
            Assert.NotEqual(HttpStatusCode.Forbidden, abierta.StatusCode);
            return;
        }

        var respuesta = await _gestorSinModulos.SendAsync(Pedir(metodo, ruta));

        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Operaciones))]
    public async Task Con_la_cuenta_que_puede_la_puerta_se_abre(string metodo, string ruta, Puerta puerta)
    {
        _ = puerta;
        // El webmaster tiene todos los módulos siempre. Una sesión nueva por caso: el cierre de sesión y el
        // cambio de perfil no deben estorbar a los demás.
        using var webmaster = await CmsTestClient.LoginAsync(_factory);

        var respuesta = await webmaster.SendAsync(Pedir(metodo, ruta));

        Assert.NotEqual(HttpStatusCode.Unauthorized, respuesta.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }
}
