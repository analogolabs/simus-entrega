using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La taxonomía de perfiles vive en una tabla administrable desde el Catálogo (decisión 133, DIR).
/// </summary>
/// <remarks>
/// LO QUE IMPIDEN: que los valores vuelvan a ser constantes de código, que desactivar un valor deje inválidos o invisibles
/// los perfiles que ya lo usan, y que se cambie un código estable al renombrar.
/// </remarks>
public sealed class TaxonomiaDePerfilesAdministrableTests
{
    private const string Consola = "/api/v1/institucional/taxonomia-de-perfiles";
    private const string Publica = "/api/v1/publico/taxonomia-de-perfiles";
    private const string Clave = "ClaveExterna123";

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var token = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken;
        var mensaje = new HttpRequestMessage(metodo, ruta) { Content = JsonContent.Create(cuerpo ?? new { }) };
        mensaje.Headers.Add("X-CSRF-TOKEN", token);
        return await cliente.SendAsync(mensaje);
    }

    /// <summary>Una persona con perfil clasificado y, si se pide, publicado.</summary>
    private static async Task<(HttpClient Sesion, Guid Clave)> PersonaAsync(
        TestWebApplicationFactory fabrica, string correo, string documento, ClasificacionSolicitud clasificacion)
    {
        (await fabrica.CreateClient().PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual", FirstName = "Ana", FirstSurname = "Taxonomia", DocumentType = "cc",
            DocumentNumber = documento, Phone = "3151112233", Email = correo, Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        var sesion = fabrica.CreateClient();
        (await sesion.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico",
            new PerfilPublicoSolicitud { NombreVisible = "Persona " + documento, IdsPracticas = [], CodigoMunicipio = "11001", Enlaces = [] });
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion", clasificacion)).StatusCode);
        var politica = await sesion.GetFromJsonAsync<PoliticaPublicaDto>("/api/v1/publico/politicas/perfil_publico");
        (await EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/cuenta/perfil-publico/publicar",
            new PublicarPerfilPublicoSolicitud { VersionAceptada = politica!.Version })).EnsureSuccessStatusCode();
        return (sesion, mio.Clave!.Value);
    }

    private static async Task<JsonElement> ListaAsync(HttpClient consola) =>
        await consola.GetFromJsonAsync<JsonElement>(Consola);

    private static int IdDe(JsonElement lista, string dimension, string codigo) =>
        lista.GetProperty("items").EnumerateArray()
            .First(v => v.GetProperty("dimension").GetString() == dimension && v.GetProperty("codigo").GetString() == codigo)
            .GetProperty("id").GetInt32();

    [Fact]
    public async Task La_tabla_nace_con_los_valores_vigentes_y_los_mismos_codigos()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var taxonomia = (await fabrica.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>(Publica))!;

        Assert.Equal(14, taxonomia.Roles.Count); // 11 roles de siempre + 3 categorías nuevas (decisión 135)
        Assert.Equal(10, taxonomia.Servicios.Count);
        Assert.Equal(6, taxonomia.Instrumentos.Count);
        Assert.All(taxonomia.Roles.Concat(taxonomia.Servicios).Concat(taxonomia.Instrumentos), v => Assert.True(v.Activo));
        // LOS CÓDIGOS NO CAMBIAN: los perfiles guardados los conservan.
        string[] deSiempre = ["interprete", "cantante", "compositor", "director", "docente", "investigador", "luthier", "sonidista", "productor", "gestor", "cultor"];
        Assert.All(deSiempre, codigo => Assert.Contains(taxonomia.Roles, r => r.Codigo == codigo));
        Assert.Contains(taxonomia.Servicios, s => s.Codigo == "luteria");
        Assert.Contains(taxonomia.Instrumentos, i => i.Codigo == "voz");
    }

    [Fact]
    public async Task Administrar_exige_sesion_institucional_y_la_lectura_publica_no()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var anonimo = fabrica.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.GetAsync(Consola)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.PostAsJsonAsync(Consola, new { dimension = "rol", nombre = "Mago" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync(Publica)).StatusCode);
    }

    [Fact]
    public async Task Un_valor_nuevo_se_ofrece_al_clasificarse_y_el_codigo_sale_del_nombre()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);

        var creado = await consola.PostAsJsonAsync(Consola, new { dimension = "rol", nombre = "Arreglista de salsa", grupoSoyCultura = "creador", fuente = "Propuesta del PNMC" });
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var valor = await creado.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("arreglista-de-salsa", valor.GetProperty("codigo").GetString());
        Assert.Equal(5, valor.GetProperty("ordenVisualizacion").GetInt32()); // al final de las categorías (hay cuatro)
        Assert.True(valor.GetProperty("activo").GetBoolean());

        var publica = (await fabrica.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>(Publica))!;
        Assert.Contains(publica.Roles, r => r.Codigo == "arreglista-de-salsa" && r.GrupoSoyCultura == "creador");

        var (_, clave) = await PersonaAsync(fabrica, "tax.nuevo@example.com", "55000001", new ClasificacionSolicitud { Roles = ["arreglista-de-salsa"] });
        var lista = (await fabrica.CreateClient().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        Assert.Contains("arreglista-de-salsa", lista.Single(p => p.Clave == clave).Roles);
    }

    [Fact]
    public async Task Valida_dimension_nombre_repetido_grupo_y_que_el_grupo_solo_es_de_los_roles()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);

        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync(Consola, new { dimension = "territorio", nombre = "Costa" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync(Consola, new { dimension = "rol", nombre = "  " })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await consola.PostAsJsonAsync(Consola, new { dimension = "rol", nombre = "Gestor(a) cultural" })).StatusCode);
        // El mismo nombre en OTRA lista sí cabe.
        Assert.Equal(HttpStatusCode.Created, (await consola.PostAsJsonAsync(Consola, new { dimension = "servicio", nombre = "Gestor(a) cultural" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync(Consola, new { dimension = "rol", nombre = "Otro rol", grupoSoyCultura = "inventado" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync(Consola, new { dimension = "servicio", nombre = "Otro servicio", grupoSoyCultura = "creador" })).StatusCode);
    }

    [Fact]
    public async Task Renombrar_no_cambia_el_codigo_ni_la_dimension_y_los_perfiles_siguen_con_su_valor()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);
        var (_, clave) = await PersonaAsync(fabrica, "tax.renombre@example.com", "55000002", new ClasificacionSolicitud { Roles = ["docente"] });
        var id = IdDe(await ListaAsync(consola), "rol", "docente");

        var guardado = await consola.PutAsJsonAsync($"{Consola}/{id}", new { dimension = "servicio", nombre = "Docente de música", grupoSoyCultura = "otro", activo = true });
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        var valor = await guardado.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("docente", valor.GetProperty("codigo").GetString());
        Assert.Equal("rol", valor.GetProperty("dimension").GetString());
        Assert.Equal("Docente de música", valor.GetProperty("nombre").GetString());
        Assert.Equal(1, valor.GetProperty("personas").GetInt32());

        var lista = (await fabrica.CreateClient().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        Assert.Contains("docente", lista.Single(p => p.Clave == clave).Roles);
        var publica = (await fabrica.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>(Publica))!;
        Assert.Equal("Docente de música", publica.Roles.Single(r => r.Codigo == "docente").Nombre);
    }

    [Fact]
    public async Task Desactivar_un_valor_no_toca_a_quien_ya_lo_tiene_pero_ya_no_se_ofrece_a_otros()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);
        var (conServicio, clave) = await PersonaAsync(fabrica, "tax.desactiva.a@example.com", "55000003",
            new ClasificacionSolicitud { Roles = ["luthier"], Servicios = ["asesoria", "clases"] });
        var (otra, _) = await PersonaAsync(fabrica, "tax.desactiva.b@example.com", "55000004", new ClasificacionSolicitud { Servicios = ["clases"] });

        var id = IdDe(await ListaAsync(consola), "servicio", "asesoria");
        var apagado = await consola.PutAsJsonAsync($"{Consola}/{id}", new { nombre = "Asesoría y consultoría", activo = false });
        Assert.Equal(HttpStatusCode.OK, apagado.StatusCode);
        Assert.False((await apagado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("activo").GetBoolean());

        // La persona que lo tenía sigue en el directorio con su código, y la taxonomía sigue diciendo su nombre.
        var lista = (await fabrica.CreateClient().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        Assert.Contains("asesoria", lista.Single(p => p.Clave == clave).Servicios);
        var publica = (await fabrica.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>(Publica))!;
        var asesoria = publica.Servicios.Single(s => s.Codigo == "asesoria");
        Assert.False(asesoria.Activo);
        Assert.Equal("Asesoría y consultoría", asesoria.Nombre);

        // Puede guardar su perfil de nuevo sin quitarlo...
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(conServicio, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion",
            new ClasificacionSolicitud { Roles = ["luthier"], Servicios = ["asesoria"] })).StatusCode);
        // ...pero nadie más puede elegirlo.
        Assert.Equal(HttpStatusCode.BadRequest, (await EnviarAsync(otra, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion",
            new ClasificacionSolicitud { Servicios = ["asesoria"] })).StatusCode);

        // La consola cuenta a las personas que lo tienen, y reactivarlo lo devuelve a la oferta.
        var enLista = (await ListaAsync(consola)).GetProperty("items").EnumerateArray().Single(v => v.GetProperty("id").GetInt32() == id);
        Assert.Equal(1, enLista.GetProperty("personas").GetInt32());
        Assert.Equal(HttpStatusCode.OK, (await consola.PutAsJsonAsync($"{Consola}/{id}", new { nombre = "Asesoría y consultoría", activo = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(otra, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion",
            new ClasificacionSolicitud { Servicios = ["asesoria"] })).StatusCode);
    }

    [Fact]
    public async Task Los_similares_dicen_el_nombre_de_un_valor_desactivado()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);
        var (_, a) = await PersonaAsync(fabrica, "tax.sim.a@example.com", "55000005", new ClasificacionSolicitud { Servicios = ["gestion"] });
        await PersonaAsync(fabrica, "tax.sim.b@example.com", "55000006", new ClasificacionSolicitud { Servicios = ["gestion"] });
        var id = IdDe(await ListaAsync(consola), "servicio", "gestion");
        Assert.Equal(HttpStatusCode.OK, (await consola.PutAsJsonAsync($"{Consola}/{id}", new { nombre = "Gestión y producción de eventos", activo = false })).StatusCode);

        var similares = await fabrica.CreateClient().GetFromJsonAsync<PerfilesSimilaresDto>($"/api/v1/publico/personas/{a}/similares");
        Assert.Contains("Gestión y producción de eventos", similares!.Similares.Single().Coincidencias);
    }

    [Fact]
    public async Task Mover_intercambia_con_la_vecina_y_deja_el_orden_sin_huecos()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);
        var id = IdDe(await ListaAsync(consola), "instrumento", "aerofonos");

        Assert.Equal(HttpStatusCode.OK, (await consola.PostAsJsonAsync($"{Consola}/{id}/mover", new { sentido = -1 })).StatusCode);
        var publica = (await fabrica.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>(Publica))!;
        Assert.Equal(["aerofonos", "cordofonos", "membranofonos", "idiofonos", "electrofonos", "voz"], publica.Instrumentos.Select(i => i.Codigo));
        Assert.Equal([1, 2, 3, 4, 5, 6], (await ListaAsync(consola)).GetProperty("items").EnumerateArray()
            .Where(v => v.GetProperty("dimension").GetString() == "instrumento").Select(v => v.GetProperty("ordenVisualizacion").GetInt32()).Order());

        // Subir al primero no hace nada y no falla; un sentido inválido sí se rechaza.
        Assert.Equal(HttpStatusCode.OK, (await consola.PostAsJsonAsync($"{Consola}/{id}/mover", new { sentido = -1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync($"{Consola}/{id}/mover", new { sentido = 3 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await consola.PostAsJsonAsync($"{Consola}/99999/mover", new { sentido = 1 })).StatusCode);
    }

    [Fact]
    public async Task Los_cambios_quedan_en_la_bitacora_con_el_nombre_del_valor()
    {
        await using var fabrica = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(fabrica);
        Assert.Equal(HttpStatusCode.Created, (await consola.PostAsJsonAsync(Consola, new { dimension = "instrumento", nombre = "Tiple" })).StatusCode);

        var bitacora = await consola.GetStringAsync("/api/v1/admin/auditoria?pageSize=50");
        Assert.Contains("ValoresDeTaxonomiaDePerfiles", bitacora, StringComparison.Ordinal);
    }
}
