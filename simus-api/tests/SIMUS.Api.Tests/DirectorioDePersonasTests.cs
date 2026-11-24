using System.Net;
using System.Net.Http.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>El directorio de personas como búsqueda y los perfiles similares (DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).</summary>
public sealed class DirectorioDePersonasTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Clave = "ClaveExterna123";
    private const string Telefono = "3151112233";
    private readonly TestWebApplicationFactory _factory;

    public DirectorioDePersonasTests(TestWebApplicationFactory factory) => _factory = factory;

    private async Task<HttpClient> PersonaAsync(string correo, string documento)
    {
        var anonimo = _factory.CreateClient();
        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual", FirstName = "Ana", FirstSurname = "Dir", DocumentType = "cc",
            DocumentNumber = documento, Phone = Telefono, Email = correo, Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        var sesion = _factory.CreateClient();
        (await sesion.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        return sesion;
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var token = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken;
        var mensaje = new HttpRequestMessage(metodo, ruta) { Content = JsonContent.Create(cuerpo ?? new { }) };
        mensaje.Headers.Add("X-CSRF-TOKEN", token);
        return await cliente.SendAsync(mensaje);
    }

    private async Task<(HttpClient Sesion, Guid Clave)> PublicaAsync(string correo, string documento, string nombre, ClasificacionSolicitud clasificacion, bool publicar = true)
    {
        var sesion = await PersonaAsync(correo, documento);
        var guardado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico",
            new PerfilPublicoSolicitud { NombreVisible = nombre, IdsPracticas = [], CodigoMunicipio = "11001", Enlaces = [] });
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        var clasificado = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion", clasificacion);
        Assert.Equal(HttpStatusCode.OK, clasificado.StatusCode);
        if (publicar)
        {
            var politica = await sesion.GetFromJsonAsync<PoliticaPublicaDto>("/api/v1/publico/politicas/perfil_publico");
            (await EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/cuenta/perfil-publico/publicar",
                new PublicarPerfilPublicoSolicitud { VersionAceptada = politica!.Version })).EnsureSuccessStatusCode();
        }
        return (sesion, mio.Clave!.Value);
    }

    [Fact]
    public async Task La_taxonomia_es_publica_y_trae_la_correspondencia_con_Soy_Cultura()
    {
        var taxonomia = await _factory.CreateClient().GetFromJsonAsync<TaxonomiaDePerfilesDto>("/api/v1/publico/taxonomia-de-perfiles");
        Assert.Contains(taxonomia!.Roles, r => r.Codigo == "luthier" && r.GrupoSoyCultura == "creador");
        Assert.Contains(taxonomia.Roles, r => r.Codigo == "gestor" && r.GrupoSoyCultura == "gestor");
        Assert.Contains(taxonomia.Servicios, s => s.Codigo == "clases");
    }

    [Fact]
    public async Task La_clasificacion_rechaza_valores_fuera_de_la_lista_y_pide_el_perfil()
    {
        var sinPerfil = await PersonaAsync("dir.sinperfil@example.com", "54000001");
        Assert.Equal(HttpStatusCode.Conflict, (await EnviarAsync(sinPerfil, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion", new ClasificacionSolicitud { Roles = ["docente"] })).StatusCode);

        var (sesion, _) = await PublicaAsync("dir.valida@example.com", "54000002", "Valida", new ClasificacionSolicitud { Roles = ["docente"] }, publicar: false);
        var mala = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion", new ClasificacionSolicitud { Roles = ["mago"] });
        Assert.Equal(HttpStatusCode.BadRequest, mala.StatusCode);
        var departamento = await EnviarAsync(sesion, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion", new ClasificacionSolicitud { CodigosDeDepartamento = ["99"] });
        Assert.Equal(HttpStatusCode.BadRequest, departamento.StatusCode);
    }

    [Fact]
    public async Task Solo_lista_a_quien_publico_y_un_perfil_sin_categorias_queda_pendiente()
    {
        var (_, publicada) = await PublicaAsync("dir.lista.a@example.com", "54000003", "Lista Visible", new ClasificacionSolicitud { Roles = ["luthier"], Servicios = ["luteria"] });
        var (_, privada) = await PublicaAsync("dir.lista.b@example.com", "54000004", "Lista Privada", new ClasificacionSolicitud { Roles = ["luthier"] }, publicar: false);
        var (_, pendiente) = await PublicaAsync("dir.lista.c@example.com", "54000005", "Lista Pendiente", new ClasificacionSolicitud());

        var lista = (await _factory.CreateClient().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        Assert.Contains(lista, p => p.Clave == publicada && p.Servicios.Contains("luteria") && p.Completo);
        Assert.DoesNotContain(lista, p => p.Clave == privada);
        Assert.Contains(lista, p => p.Clave == pendiente && !p.Completo);
    }

    [Fact]
    public async Task Los_similares_excluyen_a_la_misma_persona_y_a_los_no_publicados_y_dicen_por_que()
    {
        var (_, a) = await PublicaAsync("dir.sim.a@example.com", "54000006", "Sim A", new ClasificacionSolicitud { Roles = ["docente"], Servicios = ["clases"], Instrumentos = ["cordofonos"] });
        var (_, b) = await PublicaAsync("dir.sim.b@example.com", "54000007", "Sim B", new ClasificacionSolicitud { Servicios = ["clases"] });
        var (_, sinNada) = await PublicaAsync("dir.sim.c@example.com", "54000008", "Sim C", new ClasificacionSolicitud { Servicios = ["gestion"] });
        var (_, oculta) = await PublicaAsync("dir.sim.d@example.com", "54000009", "Sim D", new ClasificacionSolicitud { Servicios = ["clases"] }, publicar: false);

        var respuesta = await _factory.CreateClient().GetAsync($"/api/v1/publico/personas/{a}/similares");
        var crudo = await respuesta.Content.ReadAsStringAsync();
        var similares = System.Text.Json.JsonSerializer.Deserialize<PerfilesSimilaresDto>(crudo, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))!;

        Assert.DoesNotContain(similares.Similares, s => s.Persona.Clave == a);
        Assert.Contains(similares.Similares, s => s.Persona.Clave == b && s.Coincidencias.Contains("Clases y formación musical"));
        Assert.DoesNotContain(similares.Similares, s => s.Persona.Clave == sinNada);
        Assert.DoesNotContain(similares.Similares, s => s.Persona.Clave == oculta);
        Assert.False(string.IsNullOrWhiteSpace(similares.Criterio));
        // LO PRIVADO NO VIAJA: se busca por valor en el JSON crudo.
        Assert.DoesNotContain("@example.com", crudo);
        Assert.DoesNotContain(Telefono, crudo);
        Assert.DoesNotContain("54000007", crudo);
    }

    [Fact]
    public async Task Ocultar_el_perfil_lo_saca_del_directorio_y_de_los_similares()
    {
        var (sesion, a) = await PublicaAsync("dir.ocultar.a@example.com", "54000010", "Ocultar A", new ClasificacionSolicitud { Servicios = ["sonido"] });
        var (_, b) = await PublicaAsync("dir.ocultar.b@example.com", "54000011", "Ocultar B", new ClasificacionSolicitud { Servicios = ["sonido"] });
        var anonimo = _factory.CreateClient();
        Assert.Contains((await anonimo.GetFromJsonAsync<PerfilesSimilaresDto>($"/api/v1/publico/personas/{b}/similares"))!.Similares, s => s.Persona.Clave == a);

        (await EnviarAsync(sesion, HttpMethod.Post, "/api/v1/externo/cuenta/perfil-publico/ocultar")).EnsureSuccessStatusCode();
        Assert.DoesNotContain((await anonimo.GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!, p => p.Clave == a);
        Assert.DoesNotContain((await anonimo.GetFromJsonAsync<PerfilesSimilaresDto>($"/api/v1/publico/personas/{b}/similares"))!.Similares, s => s.Persona.Clave == a);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/personas/{a}/similares")).StatusCode);
    }

    [Fact]
    public async Task El_registro_guarda_las_categorias_en_un_perfil_oculto_y_las_invalidas_lo_rechazan()
    {
        var anonimo = _factory.CreateClient();
        var malo = await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", Registro("dir.reg.mala@example.com", "54000020", new ClasificacionSolicitud { Roles = ["mago"] }));
        Assert.Equal(HttpStatusCode.BadRequest, malo.StatusCode);

        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", Registro("dir.reg.ok@example.com", "54000021", new ClasificacionSolicitud { Roles = ["docente"], Servicios = ["clases"] }))).EnsureSuccessStatusCode();
        var sesion = _factory.CreateClient();
        (await sesion.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = "dir.reg.ok@example.com", Password = Clave })).EnsureSuccessStatusCode();

        var mia = (await sesion.GetFromJsonAsync<MiClasificacionDto>("/api/v1/externo/cuenta/perfil-publico/clasificacion"))!;
        Assert.True(mia.Existe);
        Assert.Contains("docente", mia.Roles);
        Assert.False(mia.Pendiente);
        // NACE OCULTO: sin la autorización no se indexa.
        var lista = (await anonimo.GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        Assert.DoesNotContain(lista, p => p.NombreVisible == "Ana Dir");

        // Sin categorías, el registro sigue como antes: no crea perfil.
        (await anonimo.PostAsJsonAsync("/api/v1/externo/auth/register", Registro("dir.reg.sin@example.com", "54000022", null))).EnsureSuccessStatusCode();
        var otra = _factory.CreateClient();
        (await otra.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = "dir.reg.sin@example.com", Password = Clave })).EnsureSuccessStatusCode();
        Assert.False((await otra.GetFromJsonAsync<MiClasificacionDto>("/api/v1/externo/cuenta/perfil-publico/clasificacion"))!.Existe);
    }

    private static ExternalRegisterRequest Registro(string correo, string documento, ClasificacionSolicitud? clasificacion) => new()
    {
        RegistrationType = "individual", FirstName = "Ana", FirstSurname = "Dir", DocumentType = "cc",
        DocumentNumber = documento, Phone = Telefono, Email = correo, Password = Clave,
        PoliticasAceptadas = ["tratamiento", "terminos"], Clasificacion = clasificacion,
    };
}
