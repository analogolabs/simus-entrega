using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Los roles de los perfiles en dos niveles, categoría y subcategoría, con selección múltiple (decisión 135, DIR).
/// </summary>
/// <remarks>
/// LO QUE IMPIDEN: que los códigos de siempre cambien o queden sin categoría, que se elija una categoría que tiene
/// subcategorías, que una subcategoría de una categoría desactivada se siga ofreciendo, que una persona pierda un rol que ya
/// tenía al reorganizar el árbol, y que haya más de dos niveles o jerarquía en servicios e instrumentos.
/// </remarks>
public sealed class RolesJerarquicosDePerfilesTests
{
    private const string Consola = "/api/v1/institucional/taxonomia-de-perfiles";
    private const string Publica = "/api/v1/publico/taxonomia-de-perfiles";
    private const string Clasificacion = "/api/v1/externo/cuenta/perfil-publico/clasificacion";
    private const string Clave = "ClaveExterna123";

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var token = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken;
        var mensaje = new HttpRequestMessage(metodo, ruta) { Content = JsonContent.Create(cuerpo ?? new { }) };
        mensaje.Headers.Add("X-CSRF-TOKEN", token);
        return await cliente.SendAsync(mensaje);
    }

    /// <summary>Una persona con perfil guardado (sin clasificar ni publicar todavía).</summary>
    private static async Task<(HttpClient Sesion, Guid Clave)> PersonaAsync(TestWebApplicationFactory fabrica, string correo, string documento)
    {
        (await fabrica.CreateClient().PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual", FirstName = "Ana", FirstSurname = "Jerarquia", DocumentType = "cc",
            DocumentNumber = documento, Phone = "3151112233", Email = correo, Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        var sesion = fabrica.CreateClient();
        (await sesion.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico",
            new PerfilPublicoSolicitud { NombreVisible = "Persona " + documento, IdsPracticas = [], CodigoMunicipio = "11001", Enlaces = [] });
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        return (sesion, mio.Clave!.Value);
    }

    private static async Task PublicarAsync(HttpClient sesion)
    {
        var politica = await sesion.GetFromJsonAsync<PoliticaPublicaDto>("/api/v1/publico/politicas/perfil_publico");
        (await EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/cuenta/perfil-publico/publicar",
            new PublicarPerfilPublicoSolicitud { VersionAceptada = politica!.Version })).EnsureSuccessStatusCode();
    }

    private static async Task<int> IdDeAsync(HttpClient consola, string codigo) =>
        (await consola.GetFromJsonAsync<JsonElement>(Consola)).GetProperty("items").EnumerateArray()
            .First(v => v.GetProperty("dimension").GetString() == "rol" && v.GetProperty("codigo").GetString() == codigo).GetProperty("id").GetInt32();

    [Fact]
    public async Task La_lectura_publica_es_un_arbol_con_los_codigos_de_siempre_bajo_su_categoria()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var t = (await fabrica.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>(Publica))!;

        Assert.Equal(["creacion-e-interpretacion", "formacion-e-investigacion", "tecnica-luteria-y-produccion", "gestor"],
            t.RolesPorCategoria.Select(c => c.Codigo));
        Assert.Equal(["interprete", "cantante", "compositor", "director", "cultor"],
            t.RolesPorCategoria.Single(c => c.Codigo == "creacion-e-interpretacion").Subcategorias.Select(s => s.Codigo));
        Assert.Equal(["docente", "investigador"], t.RolesPorCategoria.Single(c => c.Codigo == "formacion-e-investigacion").Subcategorias.Select(s => s.Codigo));
        Assert.Equal(["luthier", "sonidista", "productor"], t.RolesPorCategoria.Single(c => c.Codigo == "tecnica-luteria-y-produccion").Subcategorias.Select(s => s.Codigo));
        // «gestor» es categoría sin subcategorías: se elige a sí misma.
        Assert.Empty(t.RolesPorCategoria.Single(c => c.Codigo == "gestor").Subcategorias);
        // La lista plana trae a las subcategorías con su padre, y las categorías sin padre.
        Assert.Equal("formacion-e-investigacion", t.Roles.Single(r => r.Codigo == "docente").Padre);
        Assert.Null(t.Roles.Single(r => r.Codigo == "gestor").Padre);
        Assert.All(t.Servicios.Concat(t.Instrumentos), v => Assert.Null(v.Padre));
        // Cada rol de siempre aparece una sola vez y todos tienen categoría salvo las categorías mismas.
        Assert.Equal(t.Roles.Count, t.Roles.Select(r => r.Codigo).Distinct().Count());
    }

    [Fact]
    public async Task Se_eligen_varias_subcategorias_de_categorias_distintas_pero_no_una_categoria_con_hijas()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var (sesion, clave) = await PersonaAsync(fabrica, "rj.multi@example.com", "56000001");

        // Una categoría con subcategorías no se elige sola.
        var sola = await EnviarAsync(sesion, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["creacion-e-interpretacion"] });
        Assert.Equal(HttpStatusCode.BadRequest, sola.StatusCode);
        Assert.Contains("Creación e interpretación", await sola.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        // Varias subcategorías de varias categorías, y una categoría sin hijas.
        var ok = await EnviarAsync(sesion, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["interprete", "cantante", "docente", "gestor"] });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        await PublicarAsync(sesion);
        var lista = (await fabrica.CreateClient().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        Assert.Equal(["cantante", "docente", "gestor", "interprete"], lista.Single(p => p.Clave == clave).Roles);

        // El máximo por dimensión sigue valiendo: siete roles son demasiados.
        var demasiados = await EnviarAsync(sesion, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud
        { Roles = ["interprete", "cantante", "compositor", "director", "cultor", "docente", "investigador"] });
        Assert.Equal(HttpStatusCode.BadRequest, demasiados.StatusCode);
    }

    [Fact]
    public async Task Una_subcategoria_nueva_se_ofrece_y_la_de_una_categoria_desactivada_deja_de_ofrecerse_sin_quitarsela_a_quien_la_tenia()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);
        var idCategoria = await IdDeAsync(consola, "formacion-e-investigacion");

        var creada = await consola.PostAsJsonAsync(Consola, new { dimension = "rol", nombre = "Pedagogo(a) de coros", grupoSoyCultura = "otro", idPadre = idCategoria });
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        var valor = await creada.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("formacion-e-investigacion", valor.GetProperty("codigoDePadre").GetString());
        Assert.Equal(3, valor.GetProperty("ordenVisualizacion").GetInt32());

        var (sesion, clave) = await PersonaAsync(fabrica, "rj.desactiva@example.com", "56000002");
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(sesion, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["pedagogo-a-de-coros", "docente"] })).StatusCode);
        await PublicarAsync(sesion);

        // Desactivar la CATEGORÍA retira de la oferta a sus subcategorías...
        Assert.Equal(HttpStatusCode.OK, (await consola.PutAsJsonAsync($"{Consola}/{idCategoria}", new { nombre = "Formación e investigación", grupoSoyCultura = "otro", activo = false })).StatusCode);
        var (otra, _) = await PersonaAsync(fabrica, "rj.otra@example.com", "56000003");
        Assert.Equal(HttpStatusCode.BadRequest, (await EnviarAsync(otra, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["docente"] })).StatusCode);
        // ...pero quien ya las tenía las conserva y puede volver a guardar.
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(sesion, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["pedagogo-a-de-coros", "docente"] })).StatusCode);
        var lista = (await fabrica.CreateClient().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        Assert.Contains("docente", lista.Single(p => p.Clave == clave).Roles);
    }

    [Fact]
    public async Task Solo_hay_dos_niveles_y_solo_en_roles()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);
        var categoria = await IdDeAsync(consola, "creacion-e-interpretacion");
        var hija = await IdDeAsync(consola, "cantante");

        // Una subcategoría no puede ser padre; una categoría con hijas no puede pasar a ser hija; servicios no tienen jerarquía.
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync(Consola, new { dimension = "rol", nombre = "Nieta", idPadre = hija })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync(Consola, new { dimension = "rol", nombre = "Inexistente", idPadre = 99999 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync(Consola, new { dimension = "servicio", nombre = "Servicio hijo", idPadre = categoria })).StatusCode);
        var gestor = await IdDeAsync(consola, "gestor");
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync($"{Consola}/{categoria}/categoria", new { idPadre = gestor })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync($"{Consola}/{categoria}/categoria", new { idPadre = categoria })).StatusCode);
    }

    [Fact]
    public async Task Reubicar_un_rol_conserva_su_codigo_y_a_quien_lo_tiene_y_guardar_el_nombre_no_lo_mueve()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);
        var (sesion, clave) = await PersonaAsync(fabrica, "rj.reubica@example.com", "56000004");
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(sesion, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["cultor"] })).StatusCode);
        await PublicarAsync(sesion);
        var cultor = await IdDeAsync(consola, "cultor");
        var formacion = await IdDeAsync(consola, "formacion-e-investigacion");

        // Renombrar (PUT) no cambia de categoría.
        Assert.Equal(HttpStatusCode.OK, (await consola.PutAsJsonAsync($"{Consola}/{cultor}", new { nombre = "Cultor(a) o portador(a) de tradición oral", grupoSoyCultura = "creador", activo = true })).StatusCode);
        var t = (await fabrica.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>(Publica))!;
        Assert.Equal("creacion-e-interpretacion", t.Roles.Single(r => r.Codigo == "cultor").Padre);

        // Reubicar sí, y la persona sigue con su rol.
        var movido = await consola.PostAsJsonAsync($"{Consola}/{cultor}/categoria", new { idPadre = formacion });
        Assert.Equal(HttpStatusCode.OK, movido.StatusCode);
        t = (await fabrica.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>(Publica))!;
        Assert.Equal("formacion-e-investigacion", t.Roles.Single(r => r.Codigo == "cultor").Padre);
        Assert.Contains("cultor", (await fabrica.CreateClient().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!.Single(p => p.Clave == clave).Roles);
    }

    [Fact]
    public async Task Los_similares_cuentan_la_misma_categoria_aunque_la_subcategoria_sea_otra()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var (a, claveA) = await PersonaAsync(fabrica, "rj.sim.a@example.com", "56000005");
        var (b, _) = await PersonaAsync(fabrica, "rj.sim.b@example.com", "56000006");
        var (c, _) = await PersonaAsync(fabrica, "rj.sim.c@example.com", "56000007");
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(a, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["interprete"] })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(b, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["cantante"] })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(c, HttpMethod.Put, Clasificacion, new ClasificacionSolicitud { Roles = ["docente"] })).StatusCode);
        await PublicarAsync(a); await PublicarAsync(b); await PublicarAsync(c);

        var similares = (await fabrica.CreateClient().GetFromJsonAsync<PerfilesSimilaresDto>($"/api/v1/publico/personas/{claveA}/similares"))!;
        var coincide = Assert.Single(similares.Similares);
        Assert.Contains("Misma categoría: Creación e interpretación", coincide.Coincidencias);
    }
}
