using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Las escrituras de la consola exigen el testigo antiforgery: el alta de organizaciones y la
/// publicación de un mercado, y un inventario que impide que otra escritura de <c>/admin</c> quede
/// sin él sin que nadie lo decida.
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que una escritura de la consola vuelva a quedar sin testigo. Las
/// pruebas de comportamiento usan una sesión real SIN cabecera de testigo: la suite no puede pasar
/// en verde sobre una puerta abierta.
/// </para>
/// </summary>
public sealed class TestigoDeLasEscriturasDeLaConsolaTests
{
    private const string Admin = "/api/v1/admin";

    [Fact]
    public async Task El_alta_de_una_organizacion_sin_testigo_se_rechaza_y_no_escribe()
    {
        await using var factory = new TestWebApplicationFactory();
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var nombre = "Fundación sin testigo " + Guid.NewGuid().ToString("N")[..8];

        var respuesta = await sinTestigo.PostAsJsonAsync($"{Admin}/organizaciones", CuerpoDeOrganizacion(nombre));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.False(await db.EntityProfiles.AsNoTracking().AnyAsync(x => x.Name == nombre));
    }

    [Fact]
    public async Task La_publicacion_de_un_mercado_sin_testigo_se_rechaza_y_no_cambia_el_estado()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var mercadoId = await CrearMercadoAsync(factory, consola);
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        var respuesta = await sinTestigo.PostAsJsonAsync($"{Admin}/mercados/{mercadoId}/publicacion",
            new CambioDePublicacionDeFestival { Estado = "publicado" });

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var estado = await db.Mercados.AsNoTracking().Where(m => m.Id == mercadoId).Select(m => m.EstadoRegistro).FirstAsync();
        Assert.NotEqual("publicado", estado);
    }

    [Fact]
    public async Task Con_el_testigo_de_la_ruta_de_la_consola_las_escrituras_se_aceptan()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        // El testigo sale de la ruta neutra de la consola, la misma que usa la web.
        var token = await consola.GetFromJsonAsync<JsonElement>($"{Admin}/csrf");
        consola.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("requestToken").GetString());

        var alta = await consola.PostAsJsonAsync($"{Admin}/organizaciones",
            CuerpoDeOrganizacion("Fundación con testigo " + Guid.NewGuid().ToString("N")[..8]));
        Assert.True(alta.IsSuccessStatusCode, await alta.Content.ReadAsStringAsync());

        var mercadoId = await CrearMercadoAsync(factory, consola);
        var publicacion = await consola.PostAsJsonAsync($"{Admin}/mercados/{mercadoId}/publicacion",
            new CambioDePublicacionDeFestival { Estado = "publicado" });
        Assert.True(publicacion.IsSuccessStatusCode, await publicacion.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// Las escrituras que el inventario dejaba abiertas (G5, SEG-03): cada una, con una sesión REAL de la
    /// consola sin testigo, se rechaza antes de llegar al manejador.
    /// </summary>
    public static TheoryData<string, string> RutasCerradas => new()
    {
        { "PUT", "/api/v1/admin/usuarios/1/modulos" },
        { "POST", "/api/v1/admin/auth/users" },
        { "POST", "/api/v1/admin/auth/mi-contrasena" },
        { "POST", "/api/v1/admin/auth/mi-perfil" },
        { "PUT", "/api/v1/admin/auth/profile" },
        { "DELETE", "/api/v1/admin/auth/users/1" },
        { "DELETE", "/api/v1/admin/auth/users/1/definitiva" },
        { "POST", "/api/v1/admin/organizaciones/1/mensajes" },
        { "POST", "/api/v1/admin/organizaciones/1/estado" },
        { "POST", "/api/v1/admin/organizaciones/1/confirmar-correo" },
        { "POST", "/api/v1/admin/organizaciones/1/revision" },
        { "POST", "/api/v1/admin/comunicaciones/boletin/1/baja" },
        { "POST", "/api/v1/admin/notificaciones" },
        { "POST", "/api/v1/admin/solicitudes-de-vinculacion/1/status" },
        { "POST", "/api/v1/admin/duplicates" },
        { "POST", "/api/v1/admin/duplicates/1/decision" },
        { "POST", "/api/v1/admin/data-quality/flags" },
        { "POST", "/api/v1/admin/data-quality/flags/1/status" },
        { "POST", "/api/v1/admin/data/records/festivals/1/status" },
    };

    [Theory]
    [MemberData(nameof(RutasCerradas))]
    public async Task Las_escrituras_de_la_consola_sin_testigo_se_rechazan_antes_del_manejador(string metodo, string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);

        using var peticion = new HttpRequestMessage(new HttpMethod(metodo), ruta);
        if (metodo != "DELETE") peticion.Content = JsonContent.Create(new { });
        var respuesta = await sinTestigo.SendAsync(peticion);

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(RutasCerradas))]
    public async Task Con_el_testigo_las_escrituras_de_la_consola_llegan_al_manejador(string metodo, string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var token = await consola.GetFromJsonAsync<JsonElement>($"{Admin}/csrf");
        consola.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.GetProperty("requestToken").GetString());

        using var peticion = new HttpRequestMessage(new HttpMethod(metodo), ruta);
        if (metodo != "DELETE") peticion.Content = JsonContent.Create(new { });
        var respuesta = await consola.SendAsync(peticion);

        // Llegue donde llegue el manejador (404 por un id que no existe, 400 por el cuerpo vacío…),
        // ya no es el rechazo del testigo.
        Assert.DoesNotContain("no pudo validarse", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_ingreso_y_la_salida_no_piden_testigo()
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();
        var ingreso = await anonimo.PostAsJsonAsync($"{Admin}/auth/login", new { email = "nadie@pnmc.local", password = "mal" });
        Assert.DoesNotContain("no pudo validarse", await ingreso.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var consola = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var salida = await consola.PostAsJsonAsync($"{Admin}/auth/logout", new { });
        Assert.True(salida.IsSuccessStatusCode, await salida.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task La_ruta_del_testigo_solo_la_entrega_a_quien_tiene_sesion_de_consola()
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();

        var respuesta = await anonimo.GetAsync($"{Admin}/csrf");

        Assert.Equal(HttpStatusCode.Unauthorized, respuesta.StatusCode);
    }

    /// <summary>
    /// INVENTARIO: los archivos de puntos de entrada que declaran escrituras bajo <c>/admin</c> y no
    /// comprueban el testigo en ninguna parte son exactamente los de <see cref="SinTestigo"/>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>POR ARCHIVO, Y POR QUÉ NO POR RUTA.</b> Un sondeo por comportamiento (mandar cada escritura
    /// sin testigo y mirar qué dice) da falsos «sin proteger»: muchas rutas leen primero el registro
    /// y contestan 404 o validan el cuerpo antes de mirar el testigo, de modo que con y sin testigo
    /// responden igual aunque lo exijan. Mirar si el archivo comprueba el testigo no se equivoca en
    /// ese sentido. Su límite es el contrario: una escritura nueva añadida a un archivo que ya lo
    /// comprueba no se detecta aquí; esa la cubren las pruebas de comportamiento de arriba.
    /// </para>
    /// <para>
    /// <b>LA LISTA ES UNA DEUDA ESCRITA, NO UN PERMISO.</b> Cada entrada dice qué escrituras deja
    /// abiertas y por qué todavía no se cerraron. Si se cierra una, hay que quitarla de la lista: la
    /// prueba también falla cuando una entrada ya no hace falta.
    /// </para>
    /// </remarks>
    [Fact]
    public void Los_archivos_con_escrituras_de_la_consola_sin_testigo_son_solo_los_documentados()
    {
        var carpeta = CarpetaDeLosPuntosDeEntrada();
        var comprobaTestigo = new Regex(
            @"TestigoDePeticion|ValidateRequestAsync|VieneDeNuestraPaginaAsync|ExigeTestigoDeLaConsola|IAntiforgery",
            RegexOptions.CultureInvariant);
        var declaraAdmin = new Regex(@"MapGroup\(""/admin", RegexOptions.CultureInvariant);
        var escribe = new Regex(@"\.Map(Post|Put|Delete|Patch)\(", RegexOptions.CultureInvariant);

        var sinTestigo = Directory.EnumerateFiles(carpeta, "*.cs")
            .Select(ruta => (Nombre: Path.GetFileName(ruta), Texto: File.ReadAllText(ruta)))
            .Where(f => declaraAdmin.IsMatch(f.Texto) && escribe.IsMatch(f.Texto) && !comprobaTestigo.IsMatch(f.Texto))
            .Select(f => f.Nombre)
            .ToHashSet(StringComparer.Ordinal);

        var sinDocumentar = sinTestigo.Except(SinTestigo.Keys).Order(StringComparer.Ordinal).ToList();
        var yaNoHaceFalta = SinTestigo.Keys.Except(sinTestigo).Order(StringComparer.Ordinal).ToList();

        Assert.True(sinDocumentar.Count == 0,
            "Archivos con escrituras de /admin que no comprueban el testigo y no están en la lista:\n  "
            + string.Join("\n  ", sinDocumentar)
            + "\nPonles el filtro ExigeTestigoDeLaConsola (y que la web mande el testigo) o documenta por qué no.");
        Assert.True(yaNoHaceFalta.Count == 0,
            "Están en la lista pero ya comprueban el testigo (o ya no existen); quítalos:\n  "
            + string.Join("\n  ", yaNoHaceFalta));
    }

    /// <summary>
    /// Archivos con escrituras bajo <c>/admin</c> que no piden el testigo, y por qué. Ya solo queda una
    /// consulta de solo lectura. La cookie de sesión de la consola es <c>SameSite=Lax</c>; el testigo es la segunda capa.
    /// </summary>
    private static readonly Dictionary<string, string> SinTestigo = new(StringComparer.Ordinal)
    {
        // LA ÚNICA EXCEPCIÓN QUE QUEDA, y es de solo lectura: no hay nada que falsificar.
        ["AnalisisAdministrativoEndpoints.cs"] =
            "`analisis/consultar` es una consulta que usa POST por el cuerpo: no cambia datos.",
    };

    // En AdminAuthEndpoints.cs quedan SIN testigo, a propósito, solo estas dos: `POST /admin/auth/login`
    // (no hay una sesión que falsificar: quien lo manda aún no la tiene, y lo limita `admin-login`) y
    // `POST /admin/auth/logout` (solo termina la sesión de quien lo manda). Todo lo demás del archivo
    // lo exige. Esas dos las cubre `El_ingreso_y_la_salida_no_piden_testigo`.

    // ---------- Andamio ----------------------------------------------------------

    /// <summary>La carpeta de los puntos de entrada, subiendo desde donde corre la prueba.</summary>
    private static string CarpetaDeLosPuntosDeEntrada()
    {
        var actual = new DirectoryInfo(AppContext.BaseDirectory);
        while (actual is not null)
        {
            var candidata = Path.Combine(actual.FullName, "src", "SIMUS.Api", "Endpoints");
            if (Directory.Exists(candidata)) return candidata;
            actual = actual.Parent;
        }

        throw new DirectoryNotFoundException("No se encontró simus-api/src/SIMUS.Api/Endpoints subiendo desde " + AppContext.BaseDirectory);
    }

    private static object CuerpoDeOrganizacion(string nombre) => new
    {
        nombre,
        correoContacto = "contacto@fundacion.test",
        codigoDepartamentoSede = "05",
        codigoMunicipioSede = "05001",
        responsableNombre = "Ana Restrepo",
        responsableAutorizacionDatos = true,
    };

    private static async Task<int> CrearMercadoAsync(TestWebApplicationFactory factory, HttpClient consola)
    {
        int organizacion;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = new EntityProfileRow
            {
                EntityType = "organizacion",
                Name = "Organización responsable del mercado",
                CoverageLevel = "municipal",
                DepartmentCode = "05",
                MunicipalityCode = "05001",
                StatusCode = "activa",
                IsActive = true,
                CreatedByUserId = 1,
                CreatedAt = DateTime.UtcNow,
            };
            db.EntityProfiles.Add(fila);
            await db.SaveChangesAsync();
            organizacion = fila.Id;
        }

        var creado = await consola.PostAsJsonAsync("/api/v1/institucional/mercados", new MercadoUpsertRequest
        {
            Nombre = "Mercado Musical del testigo",
            Descripcion = "Incorporado por el PNMC.",
            NivelCobertura = "municipal",
            CodigoDepartamento = "05",
            CodigoMunicipio = "05001",
            CorreoMercado = "contacto@mercadotestigo.test",
            OrganizacionId = organizacion,
        });
        creado.EnsureSuccessStatusCode();
        var mercado = await creado.Content.ReadFromJsonAsync<MercadoDto>();
        return int.Parse(mercado!.Id.ToString(CultureInfo.InvariantCulture), CultureInfo.InvariantCulture);
    }
}
