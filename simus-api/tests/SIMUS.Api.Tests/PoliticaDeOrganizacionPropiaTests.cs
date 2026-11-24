using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Security;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;
using static SIMUS.Api.Tests.RolesDeOrganizacionTests;

namespace SIMUS.Api.Tests;

/// <summary>
/// «Es imposible que alguien abra una organización que no sea suya». La política vive
/// en <see cref="PoliticaDeOrganizacionPropia"/> y se lee del PATRÓN de la ruta; estas pruebas la
/// comprueban recorriendo TODAS las rutas registradas, no una lista escrita a mano: la ruta número
/// N+1 queda cubierta o hace fallar la prueba.
/// </summary>
/// <remarks>
/// DECISIÓN DE RESPUESTA: 404 sin cuerpo para «no existe» y para «no es tuya», idénticos byte a byte.
/// El 403 queda solo para un MIEMBRO sin rol suficiente (un editor que intenta administrar).
/// </remarks>
public sealed partial class PoliticaDeOrganizacionPropiaTests
{
    private const int Inexistente = 987654;

    [GeneratedRegex(@"\{(\*{0,2})(\w+)(?::[^}]*)?\}")]
    private static partial Regex Parametro();

    private static List<RouteEndpoint> Rutas(TestWebApplicationFactory factory)
    {
        using var arranque = factory.CreateClient();
        return factory.Services.GetServices<EndpointDataSource>()
            .SelectMany(fuente => fuente.Endpoints).Distinct().OfType<RouteEndpoint>().ToList();
    }

    private static string Metodo(RouteEndpoint punto) =>
        punto.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.FirstOrDefault() ?? "GET";

    /// <summary>Sustituye cada parámetro: <paramref name="propios"/> por nombre, el resto por 1.</summary>
    private static string Url(RouteEndpoint punto, Dictionary<string, string> propios) =>
        "/" + Parametro().Replace(punto.RoutePattern.RawText!.TrimStart('/'),
            coincidencia => propios.TryGetValue(coincidencia.Groups[2].Value, out var valor) ? valor : "1");

    private static async Task<HttpResponseMessage> LlamarAsync(Sesion sesion, RouteEndpoint punto, string url)
    {
        var metodo = new HttpMethod(Metodo(punto));
        return await EnviarAsync(sesion, metodo, url, metodo == HttpMethod.Get || metodo == HttpMethod.Delete ? null : new { });
    }

    private static async Task<(HttpStatusCode Estado, string Cuerpo)> ResumenAsync(HttpResponseMessage respuesta) =>
        (respuesta.StatusCode, await respuesta.Content.ReadAsStringAsync());

    // ── 1. Todas las rutas /externo/organizaciones/{id}/... ────────────────────────────────

    [Fact]
    public async Task Toda_ruta_de_organizacion_responde_el_mismo_404_a_una_ajena_que_a_una_inexistente()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, organizacionAjena) = await OrganizacionAsync(factory, "Organización ajena");
        var (intrusa, _) = await OrganizacionAsync(factory, "Organización de la intrusa");

        var rutas = Rutas(factory)
            .Select(punto => (Punto: punto, Parametro: PoliticaDeOrganizacionPropia.ParametroDeOrganizacion(punto.RoutePattern)))
            .Where(par => par.Parametro is not null)
            .ToList();
        // Canario: un barrido que recorre cero rutas pasa siempre y no vigila nada.
        Assert.True(rutas.Count >= 60, $"Se esperaban muchas rutas de organización y se hallaron {rutas.Count}.");

        var fallos = new List<string>();
        foreach (var (punto, nombre) in rutas)
        {
            var ajena = await ResumenAsync(await LlamarAsync(intrusa, punto,
                Url(punto, new Dictionary<string, string> { [nombre!] = organizacionAjena.ToString(CultureInfo.InvariantCulture) })));
            var inexistente = await ResumenAsync(await LlamarAsync(intrusa, punto,
                Url(punto, new Dictionary<string, string> { [nombre!] = Inexistente.ToString(CultureInfo.InvariantCulture) })));

            if (ajena != inexistente || ajena.Estado != HttpStatusCode.NotFound || ajena.Cuerpo.Length != 0)
            {
                fallos.Add($"{Metodo(punto)} {punto.RoutePattern.RawText}: ajena={(int)ajena.Estado} '{ajena.Cuerpo}', inexistente={(int)inexistente.Estado}");
            }
        }

        Assert.True(fallos.Count == 0, "Rutas que distinguen «ajena» de «inexistente» o no responden 404:\n" + string.Join("\n", fallos));
    }

    [Fact]
    public async Task Quien_es_miembro_no_es_bloqueado_por_la_politica_y_el_anonimo_recibe_401()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacion) = await OrganizacionAsync(factory, "Organización propia");

        Assert.Equal(HttpStatusCode.OK,
            (await administradora.Cliente.GetAsync($"/api/v1/externo/organizaciones/{organizacion}/perfil")).StatusCode);

        using var anonimo = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonimo.GetAsync($"/api/v1/externo/organizaciones/{organizacion}/perfil")).StatusCode);
    }

    [Fact]
    public async Task Un_miembro_sin_rol_suficiente_recibe_403_y_no_404()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, organizacion) = await OrganizacionAsync(factory, "Organización con editor");
        var correo = $"editor.{Guid.NewGuid():N}@organizacion.test";
        await MiembroAsync(factory, organizacion, "editor", correo);
        var editor = await EntrarAsync(factory, correo);

        var respuesta = await EnviarAsync(editor, HttpMethod.Post,
            $"/api/v1/externo/organizaciones/{organizacion}/equipo/invitaciones", new { correo = "otra@organizacion.test", rol = "editor" });
        Assert.Equal(HttpStatusCode.Forbidden, respuesta.StatusCode);
    }

    [Fact]
    public async Task Un_miembro_dado_de_baja_deja_de_entrar_a_la_organizacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var (administradora, organizacion) = await OrganizacionAsync(factory, "Organización que pierde a una persona");
        var correo = $"saliente.{Guid.NewGuid():N}@organizacion.test";
        await MiembroAsync(factory, organizacion, "editor", correo);
        var saliente = await EntrarAsync(factory, correo);
        Assert.Equal(HttpStatusCode.OK, (await saliente.Cliente.GetAsync($"/api/v1/externo/organizaciones/{organizacion}/perfil")).StatusCode);

        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var vinculo = await db.UserEntities.SingleAsync(v => v.UserId == saliente.UsuarioId && v.EntityId == organizacion);
            vinculo.IsActive = false;
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.NotFound, (await saliente.Cliente.GetAsync($"/api/v1/externo/organizaciones/{organizacion}/perfil")).StatusCode);
        _ = administradora;
    }

    [Fact]
    public async Task El_intento_queda_en_la_bitacora_sin_datos_personales()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, organizacionAjena) = await OrganizacionAsync(factory, "Organización observada");
        var (intrusa, _) = await OrganizacionAsync(factory, "Organización de quien intenta");

        Assert.Equal(HttpStatusCode.NotFound,
            (await intrusa.Cliente.GetAsync($"/api/v1/externo/organizaciones/{organizacionAjena}/perfil")).StatusCode);

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var intento = await db.AuditLogs.AsNoTracking()
            .SingleAsync(a => a.NewValuesJson != null && a.NewValuesJson.Contains(PoliticaDeOrganizacionPropia.EventoDeBitacora));
        Assert.Equal(intrusa.UsuarioId, intento.UserId);
        Assert.Equal(organizacionAjena.ToString(CultureInfo.InvariantCulture), intento.RecordId);
        Assert.Equal("consultar", intento.Action);
        Assert.DoesNotContain(intrusa.Correo, intento.NewValuesJson!, StringComparison.OrdinalIgnoreCase);
    }

    // ── 2. La red: ninguna ruta con organización o recurso hijo queda sin clasificar ───────

    /// <summary>
    /// Primer segmento (tras <c>/api/v1/externo/</c>) de las rutas con parámetro que NO cubre la política
    /// y que SÍ se revisaron a mano. Añadir una familia nueva obliga a decidir: cubrirla en
    /// <see cref="PoliticaDeOrganizacionPropia.FamiliasDeRecursos"/> o anotarla aquí con su motivo.
    /// </summary>
    private static readonly Dictionary<string, string> FamiliasRevisadas = new(StringComparer.OrdinalIgnoreCase)
    {
        ["archivos"] = "el banco resuelve la organización de la persona que pide y responde 404 a lo ajeno (prueba de IDOR más abajo)",
        ["mis-eventos"] = "eventos de la persona autenticada; se filtra por su cuenta en el manejador",
        ["mis-autorizaciones"] = "autorizaciones de la propia cuenta, por finalidad (texto), no por recurso",
        ["mis-registros"] = "historial de los registros de la propia cuenta",
        ["agendas-de-citas"] = "cada ruta resuelve el participante de la propia cuenta; no hay recurso de una organización",
        ["cambios-pedidos"] = "el manejador resuelve la observación y comprueba al administrador del proceso",
        ["ediciones/cambios-pedidos"] = "la nota ajena responde 404 como la inexistente; lo resuelve el manejador",
        ["mercados/cambios-pedidos"] = "la observación ajena responde 404 como la inexistente; lo resuelve el manejador",
        ["procesos"] = "el manejador resuelve el proceso y comprueba al administrador",
        ["invitaciones"] = "el testigo de la invitación es la credencial",
        ["catalogos"] = "vocabularios sin dato de nadie",
        ["organizaciones"] = "cubierta por ParametroDeOrganizacion (aquí solo caen /mis, /csrf y /catalogos)",
        ["auth"] = "sin recurso de organización",
        ["cuenta"] = "la propia cuenta",
    };

    [Fact]
    public async Task Toda_ruta_externa_con_parametro_esta_cubierta_por_la_politica_o_revisada_a_mano()
    {
        await using var factory = new TestWebApplicationFactory();
        var sinClasificar = new List<string>();

        foreach (var punto in Rutas(factory))
        {
            var texto = punto.RoutePattern.RawText!.TrimStart('/');
            if (!texto.StartsWith("api/v1/externo/", StringComparison.OrdinalIgnoreCase)) continue;

            var parametros = punto.RoutePattern.Parameters.Select(p => p.Name).ToList();
            if (parametros.Count == 0) continue;
            if (PoliticaDeOrganizacionPropia.ParametroDeOrganizacion(punto.RoutePattern) is not null) continue;
            if (PoliticaDeOrganizacionPropia.RecursoHijo(punto.RoutePattern) is not null) continue;

            var segmentos = texto["api/v1/externo/".Length..].Split('/');
            var familia = segmentos.Length > 1 && segmentos[1] == "cambios-pedidos" ? $"{segmentos[0]}/{segmentos[1]}" : segmentos[0];
            var llevaOrganizacion = parametros.Any(p => Regex.IsMatch(p, "organizaci|organization|entidad", RegexOptions.IgnoreCase));
            if (llevaOrganizacion || !FamiliasRevisadas.ContainsKey(familia))
            {
                sinClasificar.Add($"{Metodo(punto)} /{texto}");
            }
        }

        Assert.True(sinClasificar.Count == 0,
            "Rutas con parámetro que ni la política cubre ni se revisaron: súmalas a PoliticaDeOrganizacionPropia o a FamiliasRevisadas con su motivo:\n"
            + string.Join("\n", sinClasificar));
    }

    // ── 3. IDOR de recursos hijos ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Un_recurso_hijo_de_otra_organizacion_no_se_distingue_de_uno_inexistente()
    {
        await using var factory = new TestWebApplicationFactory();
        var (ajena, organizacionAjena) = await OrganizacionAsync(factory, "Organización dueña de los recursos");
        var (intrusa, organizacionIntrusa) = await OrganizacionAsync(factory, "Organización de la intrusa");

        var ids = await SembrarRecursosAsync(factory, ajena, organizacionAjena);

        var rutas = Rutas(factory)
            .Select(punto => (Punto: punto, Hijo: PoliticaDeOrganizacionPropia.RecursoHijo(punto.RoutePattern)))
            .Where(par => par.Hijo is not null)
            .ToList();
        Assert.True(rutas.Count >= 60, $"Se esperaban muchas rutas de recursos hijos y se hallaron {rutas.Count}.");

        var fallos = new List<string>();
        foreach (var (punto, hijo) in rutas)
        {
            var familia = hijo!.Value.Familia.ToLowerInvariant();
            if (!ids.TryGetValue(familia, out var idAjeno))
            {
                fallos.Add($"Sin recurso sembrado para la familia «{familia}»: siémbralo en SembrarRecursosAsync.");
                continue;
            }

            var conAjeno = await ResumenAsync(await LlamarAsync(intrusa, punto,
                Url(punto, new Dictionary<string, string> { [hijo.Value.Parametro] = idAjeno.ToString(CultureInfo.InvariantCulture) })));
            var conInexistente = await ResumenAsync(await LlamarAsync(intrusa, punto,
                Url(punto, new Dictionary<string, string> { [hijo.Value.Parametro] = Inexistente.ToString(CultureInfo.InvariantCulture) })));

            if (conAjeno != conInexistente || conAjeno.Estado != HttpStatusCode.NotFound)
            {
                fallos.Add($"{Metodo(punto)} {punto.RoutePattern.RawText}: ajeno={(int)conAjeno.Estado}, inexistente={(int)conInexistente.Estado}");
            }
        }

        Assert.True(fallos.Count == 0, "Recursos hijos que se filtran o difieren:\n" + string.Join("\n", fallos));

        // Con el id de organización PROPIO y el id de un hijo AJENO (IDOR clásico).
        var eventoAjeno = ids["evento"];
        var festivalAjeno = ids["festivales"];
        foreach (var ruta in new[]
        {
            $"/api/v1/externo/organizaciones/{organizacionIntrusa}/eventos/{eventoAjeno}",
            $"/api/v1/externo/organizaciones/{organizacionIntrusa}/eventos/{eventoAjeno}/historial",
            $"/api/v1/externo/organizaciones/{organizacionIntrusa}/festivales/{festivalAjeno}/historial",
            $"/api/v1/externo/mis-eventos/{eventoAjeno}",
            $"/api/v1/externo/archivos/{ids["archivo"]}",
        })
        {
            var ajeno = await ResumenAsync(await intrusa.Cliente.GetAsync(ruta));
            var inexistente = await ResumenAsync(await intrusa.Cliente.GetAsync(
                ruta.Replace($"/{eventoAjeno}", $"/{Inexistente}").Replace($"/{festivalAjeno}/", $"/{Inexistente}/").Replace($"/{ids["archivo"]}", $"/{Inexistente}")));
            Assert.Equal(HttpStatusCode.NotFound, ajeno.Estado);
            Assert.Equal(inexistente, ajeno);
        }
        var intento = await EnviarAsync(intrusa, HttpMethod.Delete, $"/api/v1/externo/archivos/{ids["archivo"]}");
        Assert.Equal(HttpStatusCode.NotFound, intento.StatusCode);

        // Nada se movió: el archivo y el festival siguen en su sitio.
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.True(await db.Files.AnyAsync(f => f.Id == ids["archivo"]));
        Assert.Equal(organizacionAjena, (await db.FestivalRecords.AsNoTracking().SingleAsync(f => f.Id == festivalAjeno)).OrganizacionPrincipalId);
    }

    internal static async Task<Dictionary<string, int>> SembrarRecursosAsync(
        TestWebApplicationFactory factory, Sesion dueña, int organizacion)
    {
        var festival = await EnviarAsync(dueña, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacion}/festivales", new
        {
            nombre = "Festival ajeno",
            nivelCobertura = "nacional",
            sedeCodigoDepartamento = "05",
            sedeCodigoMunicipio = "05001",
            practicasMusicalesIds = Array.Empty<int>(),
            territoriosSonorosIds = Array.Empty<int>(),
        });
        festival.EnsureSuccessStatusCode();
        var festivalId = int.Parse((await festival.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>()).GetProperty("id").ToString(), CultureInfo.InvariantCulture);

        var mercado = await EnviarAsync(dueña, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacion}/mercados", new
        {
            nombre = "Mercado ajeno",
            descripcion = "Encuentro de intercambio y circulación para músicas del sur del país.",
            nivelCobertura = "municipal",
            codigoDepartamento = "05",
            codigoMunicipio = "05001",
            correoMercado = "contacto@mercado.test",
        });
        mercado.EnsureSuccessStatusCode();
        var mercadoId = int.Parse((await mercado.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>()).GetProperty("id").ToString(), CultureInfo.InvariantCulture);

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var ahora = DateTime.UtcNow;

        (await db.FestivalRecords.SingleAsync(f => f.Id == festivalId)).StatusCode = "publicado";
        var edicion = new EdicionFestivalRow { FestivalId = festivalId, Anio = 2026, Nombre = "Edición ajena" };
        var red = new RedRow { Nombre = "Red ajena", NivelCobertura = "municipal", OrganizacionPrincipalId = organizacion, FechaCreacion = ahora };
        var taller = new TallerRow { Nombre = "Taller ajeno", NivelCobertura = "municipal", OrganizacionPrincipalId = organizacion, FechaCreacion = ahora };
        var espacio = new EspacioRow { Nombre = "Espacio ajeno", NivelCobertura = "municipal", OrganizacionPrincipalId = organizacion, FechaCreacion = ahora };
        var reclamacion = new AdministrationClaimRow
        {
            ModuloId = "festivales", CanonicalRecordId = festivalId.ToString(CultureInfo.InvariantCulture),
            RequestingOrganizationId = organizacion, RequestingPersonId = dueña.UsuarioId, CreatedAt = ahora, UpdatedAt = ahora,
        };
        var borrador = new BorradorDeProcesoRow
        {
            ModuloId = "festivales", OrganizacionId = organizacion, PersonaId = dueña.UsuarioId, FechaCreacion = ahora, FechaActualizacion = ahora,
        };
        var archivo = new FileRow
        {
            OriginalName = "ajeno.txt", StoredName = "ajeno.txt", MimeType = "text/plain", StoragePath = "ajeno.txt",
            UploadedByUserId = dueña.UsuarioId, OrganizacionId = organizacion, CreatedAt = ahora, Content = [1, 2, 3],
        };
        db.EdicionesFestival.Add(edicion);
        db.Redes.Add(red);
        db.Talleres.Add(taller);
        db.Espacios.Add(espacio);
        db.AdministrationClaims.Add(reclamacion);
        db.BorradoresDeProceso.Add(borrador);
        db.Files.Add(archivo);
        await db.SaveChangesAsync();

        var evento = await EnviarAsync(dueña, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacion}/eventos", new
        {
            titulo = "Concierto ajeno",
            descripcion = "Concierto abierto al público en el marco del festival.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Plaza principal",
            festivalId,
        });
        evento.EnsureSuccessStatusCode();
        var eventoId = int.Parse((await evento.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>()).GetProperty("id").ToString(), CultureInfo.InvariantCulture);

        return new Dictionary<string, int>
        {
            ["festivales"] = festivalId,
            ["ediciones"] = edicion.Id,
            ["mercados"] = mercadoId,
            ["redes"] = red.Id,
            ["talleres"] = taller.Id,
            ["espacios"] = espacio.Id,
            ["reclamaciones-administracion"] = (int)reclamacion.Id,
            ["borradores-proceso"] = (int)borrador.Id,
            ["archivo"] = archivo.Id,
            ["evento"] = eventoId,
        };
    }
}
