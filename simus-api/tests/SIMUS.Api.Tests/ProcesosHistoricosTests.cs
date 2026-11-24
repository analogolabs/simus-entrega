using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Procesos históricos (decisión 129): el catálogo, la coincidencia fuerte con la organización, la
/// búsqueda sin lista por defecto y la reclamación de un Mercado.
/// </summary>
public sealed class ProcesosHistoricosTests
{
    private const string Clave = "ClaveExterna123";

    private static CoincidenciaConLaOrganizacion.Organizacion Organizacion(string nombre = "Corporación Cuerdas del Huila", string? legal = null,
        string? departamento = "41", string? municipio = "41001", string[]? correos = null, string? web = null, string? instagram = null) =>
        new(nombre, legal, departamento, municipio, correos ?? ["contacto@cuerdashuila.example"], web, instagram, null);

    private static CoincidenciaConLaOrganizacion.Proceso Proceso(string nombre = "Festival de Cuerdas", string? organizador = null,
        string? departamento = "41", string? municipio = "41001", string? correo = null, string? web = null, string? instagram = null) =>
        new(nombre, organizador, departamento, municipio, correo, web, instagram, null);

    // ---------- El catálogo ------------------------------------------------------------------

    [Fact]
    public void El_catalogo_sigue_el_orden_fijo_y_los_cinco_tipos_se_reclaman()
    {
        Assert.Equal(["festivales", "mercados", "redes", "talleres", "espacios"], TiposDeProcesoHistorico.Todos.Select(x => x.Modulo));
        Assert.All(TiposDeProcesoHistorico.Todos, x => { Assert.True(x.Reclamable); Assert.Null(x.MotivoNoReclamable); });
        Assert.NotNull(TiposDeProcesoHistorico.ReclamableDe("talleres"));
        Assert.NotNull(TiposDeProcesoHistorico.ReclamableDe("MERCADOS"));
        Assert.Null(TiposDeProcesoHistorico.ReclamableDe("zzz"));
    }

    // ---------- El puntaje: casos positivos --------------------------------------------------

    [Fact]
    public void El_organizador_con_el_mismo_nombre_en_el_mismo_municipio_es_coincidencia_fuerte()
    {
        var resultado = CoincidenciaConLaOrganizacion.Evaluar(Organizacion(), Proceso(organizador: "CORPORACIÓN CUERDAS DEL HUILA."));
        Assert.True(resultado.EsFuerte);
        Assert.Equal(CoincidenciaConLaOrganizacion.PuntosNombreIgual + CoincidenciaConLaOrganizacion.PuntosMismoMunicipio, resultado.Puntaje);
        Assert.Equal("El organizador se llama igual y queda en el mismo municipio.", resultado.Motivo);
    }

    [Fact]
    public void El_nombre_legal_tambien_cuenta_y_la_sigla_respaldada_por_el_territorio_suma_poco()
    {
        var porLegal = CoincidenciaConLaOrganizacion.Evaluar(Organizacion(nombre: "Cuerdas", legal: "Corporación Festival de Cuerdas del Huila"),
            Proceso(organizador: "Corporación Festival de Cuerdas del Huila"));
        Assert.True(porLegal.EsFuerte);
        // Una sigla vale 1: con el municipio son 3, no alcanza.
        var porSigla = CoincidenciaConLaOrganizacion.Evaluar(Organizacion(nombre: "CCH"), Proceso(organizador: "Corporación Cuerdas del Huila"));
        Assert.False(porSigla.EsFuerte);
    }

    [Fact]
    public void El_mismo_correo_la_misma_web_o_la_misma_red_bastan_solos()
    {
        Assert.True(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(departamento: null, municipio: null),
            Proceso(departamento: "05", municipio: "05001", correo: " Contacto@CuerdasHuila.example ")).EsFuerte);
        var web = CoincidenciaConLaOrganizacion.Evaluar(Organizacion(departamento: null, municipio: null, web: "https://www.cuerdashuila.example/"),
            Proceso(nombre: "Encuentro Distinto", departamento: "05", municipio: "05001", web: "http://cuerdashuila.example"));
        Assert.True(web.EsFuerte);
        Assert.Equal("Comparte la página web.", web.Motivo);
        Assert.True(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(departamento: null, municipio: null, instagram: "https://instagram.com/cuerdas_huila/"),
            Proceso(departamento: "05", municipio: "05001", instagram: "instagram.com/cuerdas_huila")).EsFuerte);
    }

    [Fact]
    public void Un_Mercado_sin_organizador_se_compara_por_su_nombre()
    {
        var resultado = CoincidenciaConLaOrganizacion.Evaluar(Organizacion(nombre: "Circulart Mercado Cultural"),
            Proceso(nombre: "Circulart Mercado Cultural"));
        Assert.True(resultado.EsFuerte);
        Assert.StartsWith("El proceso se llama como tu organización", resultado.Motivo, StringComparison.Ordinal);
    }

    // ---------- El puntaje: casos negativos (sin falsos avisos) ------------------------------

    [Fact]
    public void El_mismo_nombre_solo_o_con_el_departamento_no_se_sugiere()
    {
        Assert.False(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(), Proceso(organizador: "Corporación Cuerdas del Huila", departamento: "05", municipio: "05001")).EsFuerte);
        Assert.False(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(), Proceso(organizador: "Corporación Cuerdas del Huila", departamento: "41", municipio: "41551")).EsFuerte);
    }

    [Fact]
    public void El_mismo_municipio_solo_no_se_sugiere()
    {
        var resultado = CoincidenciaConLaOrganizacion.Evaluar(Organizacion(), Proceso(nombre: "Festival del Bambuco", organizador: "Fundación Otra Gente"));
        Assert.False(resultado.EsFuerte);
        Assert.Equal(CoincidenciaConLaOrganizacion.PuntosMismoMunicipio, resultado.Puntaje);
    }

    [Theory]
    [InlineData("Fundación")]
    [InlineData("Corporación Cultural")]
    [InlineData("Asociación Cultural de Música")]
    public void Los_nombres_de_pura_palabra_generica_no_cuentan(string nombre)
    {
        var resultado = CoincidenciaConLaOrganizacion.Evaluar(Organizacion(nombre: nombre), Proceso(organizador: nombre));
        Assert.False(resultado.EsFuerte);
        Assert.Equal(CoincidenciaConLaOrganizacion.PuntosMismoMunicipio, resultado.Puntaje);
    }

    [Fact]
    public void Una_sigla_de_otro_departamento_y_dos_organizaciones_distintas_no_avisan()
    {
        Assert.False(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(nombre: "CCH"), Proceso(organizador: "Corporación Cuerdas del Huila", departamento: "05", municipio: "05001")).EsFuerte);
        Assert.False(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(), Proceso(organizador: "Fundación Bambuco Vivo")).EsFuerte);
        Assert.False(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(), Proceso(nombre: "Festival de Cuerdas del Cauca", organizador: "Corporación Cuerdas del Cauca")).EsFuerte);
    }

    [Fact]
    public void Un_enlace_de_solo_la_red_o_un_correo_distinto_no_cuentan()
    {
        Assert.False(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(departamento: null, municipio: null, instagram: "https://instagram.com/"),
            Proceso(departamento: "05", municipio: "05001", instagram: "instagram.com")).EsFuerte);
        Assert.False(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(departamento: null, municipio: null),
            Proceso(departamento: "05", municipio: "05001", correo: "otro@cuerdashuila.example")).EsFuerte);
        Assert.False(CoincidenciaConLaOrganizacion.Evaluar(Organizacion(departamento: null, municipio: null), Proceso(departamento: "05", municipio: "05001", correo: "sin-arroba")).EsFuerte);
    }

    // ---------- La API: sin lista por defecto ------------------------------------------------

    [Fact]
    public async Task Sin_criterio_y_sin_coincidencia_fuerte_la_herramienta_no_lista_ni_sugiere_nada()
    {
        await using var factory = new TestWebApplicationFactory();
        await FestivalAsync(factory, "Festival del Bambuco", municipio: "05001", organizador: "Otra entidad");
        await MercadoAsync(factory, "Mercado de Saberes");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "sinsugerencias@example.com");

        var respuesta = await BuscarAsync(cliente, organizacionId, "");

        Assert.False(respuesta.GetProperty("hayBusqueda").GetBoolean());
        Assert.Empty(respuesta.GetProperty("resultados").EnumerateArray());
        // LAS DOS COINCIDEN EN EL MUNICIPIO DE LA SEDE (05001) Y NADA MÁS: no se sugieren.
        Assert.Empty(respuesta.GetProperty("sugeridos").EnumerateArray());
        Assert.Equal(5, respuesta.GetProperty("tipos").GetArrayLength());
        Assert.All(respuesta.GetProperty("tipos").EnumerateArray(), x => Assert.True(x.GetProperty("reclamable").GetBoolean()));
    }

    [Fact]
    public async Task Con_coincidencia_fuerte_se_sugiere_solo_ese_proceso_con_su_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var suyo = await FestivalAsync(factory, "Encuentro de Cuerdas Andinas", municipio: "05001", organizador: "Corporación Los Cuerdas Andinas");
        await FestivalAsync(factory, "Festival Ajeno", municipio: "05001", organizador: "Otra entidad");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "sugerido@example.com");
        await PonerNombreAsync(factory, organizacionId, "Corporación Los Cuerdas Andinas");

        var respuesta = await BuscarAsync(cliente, organizacionId, "");

        var sugerido = Assert.Single(respuesta.GetProperty("sugeridos").EnumerateArray());
        Assert.Equal(suyo.ToString(CultureInfo.InvariantCulture), sugerido.GetProperty("id").GetString());
        Assert.True(sugerido.GetProperty("coincidenciaFuerte").GetBoolean());
        Assert.Equal("El organizador se llama igual y queda en el mismo municipio.", sugerido.GetProperty("motivoDeCoincidencia").GetString());
        Assert.Empty(respuesta.GetProperty("resultados").EnumerateArray());
    }

    [Fact]
    public async Task Buscar_trae_resultados_por_nombre_organizador_territorio_y_tipo()
    {
        await using var factory = new TestWebApplicationFactory();
        var festival = await FestivalAsync(factory, "Festival del Bambuco", municipio: "05001", organizador: "Corporación Tierra Cálida");
        var mercado = await MercadoAsync(factory, "Mercado de Saberes del Bambuco", departamento: "41", municipio: "41001");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "busca@example.com");

        var porNombre = await BuscarAsync(cliente, organizacionId, "buscar=bambuco");
        Assert.Equal(2, porNombre.GetProperty("resultados").GetArrayLength());
        Assert.True(porNombre.GetProperty("hayBusqueda").GetBoolean());
        Assert.Empty(porNombre.GetProperty("sugeridos").EnumerateArray());

        var porOrganizador = await BuscarAsync(cliente, organizacionId, "buscar=tierra%20calida");
        Assert.Equal(festival.ToString(CultureInfo.InvariantCulture), Assert.Single(porOrganizador.GetProperty("resultados").EnumerateArray()).GetProperty("id").GetString());

        var porTerritorio = await BuscarAsync(cliente, organizacionId, "codigoDepartamento=41");
        var unico = Assert.Single(porTerritorio.GetProperty("resultados").EnumerateArray());
        Assert.Equal("mercados", unico.GetProperty("modulo").GetString());
        Assert.Equal(mercado.ToString(CultureInfo.InvariantCulture), unico.GetProperty("id").GetString());

        var porMunicipio = await BuscarAsync(cliente, organizacionId, "codigoDepartamento=05&codigoMunicipio=05001");
        Assert.Equal("festivales", Assert.Single(porMunicipio.GetProperty("resultados").EnumerateArray()).GetProperty("modulo").GetString());

        // SOLO EL TIPO YA ES UNA BÚSQUEDA: acota a ese proceso.
        var soloMercados = await BuscarAsync(cliente, organizacionId, "tipo=mercados");
        Assert.All(soloMercados.GetProperty("resultados").EnumerateArray(), x => Assert.Equal("mercados", x.GetProperty("modulo").GetString()));
        Assert.Equal(1, soloMercados.GetProperty("resultados").GetArrayLength());
    }

    [Fact]
    public async Task Un_organizador_que_dice_Sin_organizador_registrado_no_se_muestra_ni_cuenta()
    {
        await using var factory = new TestWebApplicationFactory();
        await FestivalAsync(factory, "Festival del Tiple Antiguo", municipio: "05001", organizador: "Sin organizador registrado");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "sinorganizador@example.com");
        var resultado = Assert.Single((await BuscarAsync(cliente, organizacionId, "buscar=tiple")).GetProperty("resultados").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, resultado.GetProperty("organizadorAnterior").ValueKind);
    }

    [Fact]
    public async Task Un_Festival_con_el_correo_de_quien_reclama_se_sugiere_sin_revelar_el_correo()
    {
        await using var factory = new TestWebApplicationFactory();
        var festival = await FestivalAsync(factory, "Festival del Tiple Antiguo", municipio: "41001", departamento: "41");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            (await db.FestivalRecords.SingleAsync(x => x.Id == festival)).ContactEmail = "representante@example.com";
            await db.SaveChangesAsync();
        }
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "representante@example.com");
        var sugerido = Assert.Single((await BuscarAsync(cliente, organizacionId, "")).GetProperty("sugeridos").EnumerateArray());
        Assert.Equal("Comparte el correo de contacto.", sugerido.GetProperty("motivoDeCoincidencia").GetString());
        Assert.DoesNotContain("representante@example.com", sugerido.GetRawText(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_tipo_desconocido_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "tipodesconocido@example.com");
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.GetAsync($"/api/v1/externo/organizaciones/{organizacionId}/procesos-historicos?tipo=zzz")).StatusCode);
    }

    [Fact]
    public async Task Los_procesos_con_organizacion_borrador_o_fusionados_no_se_ofrecen()
    {
        await using var factory = new TestWebApplicationFactory();
        await FestivalAsync(factory, "Festival Borrador del Bambuco", municipio: "05001", estado: "borrador");
        await MercadoAsync(factory, "Mercado Borrador del Bambuco", estado: "borrador");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "soloreclamables@example.com");
        Assert.Empty((await BuscarAsync(cliente, organizacionId, "buscar=bambuco")).GetProperty("resultados").EnumerateArray());
    }

    // ---------- Reclamar un Mercado ----------------------------------------------------------

    [Fact]
    public async Task Reclamar_un_Mercado_se_aprueba_y_se_transfiere_con_su_historia_y_queda_en_Solicitudes()
    {
        await using var factory = new TestWebApplicationFactory();
        var mercado = await MercadoAsync(factory, "Mercado Cultural del Pacífico", conEdiciones: true);
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "mercado.reclama@example.com");

        var creada = await EnviarAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { modulo = "mercados", registroId = mercado.ToString(CultureInfo.InvariantCulture), justificacion = "Lo organizamos desde 2018." });
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        var cuerpo = await creada.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("mercados", cuerpo.GetProperty("dominio").GetString());
        Assert.Equal("Mercado Cultural del Pacífico", cuerpo.GetProperty("registroNombre").GetString());
        var reclamacion = cuerpo.GetProperty("id").GetString();

        // Ya se ve en curso: otra no puede reclamarlo y la búsqueda lo marca como propio.
        var buscada = await BuscarAsync(cliente, organizacionId, "buscar=pacifico");
        Assert.Equal(reclamacion, Assert.Single(buscada.GetProperty("resultados").EnumerateArray()).GetProperty("reclamacionPropiaId").GetString());
        var (otro, otraId) = await OrganizacionAsync(factory, "mercado.otra@example.com");
        var repetida = await EnviarAsync(otro, $"/api/v1/externo/organizaciones/{otraId}/reclamaciones-administracion",
            new { modulo = "mercados", registroId = mercado.ToString(CultureInfo.InvariantCulture), justificacion = "También lo organizamos." });
        Assert.Equal(HttpStatusCode.Conflict, repetida.StatusCode);

        var solicitudes = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacionId}/solicitudes");
        Assert.Contains(solicitudes.EnumerateArray(), x => x.GetProperty("tipo").GetString() == "acceso"
            && x.GetProperty("titulo").GetString() == "Mercado Cultural del Pacífico");

        var consola = await CmsTestClient.LoginAsync(factory);
        var detalle = await consola.GetFromJsonAsync<JsonElement>($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}");
        Assert.Equal("Mercado Cultural del Pacífico", detalle.GetProperty("festival").GetProperty("nombre").GetString());
        Assert.True(detalle.GetProperty("festival").GetProperty("sinOrganizacion").GetBoolean());
        var decision = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "aprobar" });
        Assert.Equal(HttpStatusCode.OK, decision.StatusCode);
        Assert.Equal("transferencia_ejecutada", (await decision.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal(organizacionId, (await db.Mercados.SingleAsync(x => x.Id == mercado)).OrganizacionPrincipalId);
        Assert.Equal(2, await db.EdicionesMercado.CountAsync(x => x.MercadoId == mercado));
        Assert.Single(await db.AdministrationTransfers.Where(x => x.ModuloId == "mercados").ToListAsync());
    }

    [Fact]
    public async Task La_ficha_publica_del_Mercado_dice_si_es_un_registro_historico()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await MercadoAsync(factory, "Mercado Historico Publico");
        var (_, organizacionId) = await OrganizacionAsync(factory, "fichamercado@example.com");
        var propio = await MercadoAsync(factory, "Mercado Con Duena Publico", organizacion: organizacionId);
        var anonimo = factory.CreateClient();
        Assert.True((await anonimo.GetFromJsonAsync<JsonElement>($"/api/v1/publico/mercados/{historico}")).GetProperty("esRegistroHistorico").GetBoolean());
        Assert.False((await anonimo.GetFromJsonAsync<JsonElement>($"/api/v1/publico/mercados/{propio}")).GetProperty("esRegistroHistorico").GetBoolean());
    }

    [Fact]
    public async Task Reclamar_un_Mercado_que_ya_tiene_organizacion_o_un_proceso_de_una_persona_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "noreclamable@example.com");
        var mercadoPropio = await MercadoAsync(factory, "Mercado Con Dueña", organizacion: organizacionId);
        var ajeno = await EnviarAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { modulo = "mercados", registroId = mercadoPropio.ToString(CultureInfo.InvariantCulture), justificacion = "Es nuestro." });
        Assert.Equal(HttpStatusCode.Conflict, ajeno.StatusCode);
        Assert.Equal("no_reclamable", (await ajeno.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());

        // UN TALLER DE UNA PERSONA NO ES UN HISTÓRICO: tiene responsable y no se reclama.
        var deUnaPersona = await ProcesoAsync(factory, "talleres", "Taller de una Persona", organizacion: null, persona: true);
        var respuesta = await EnviarAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { modulo = "talleres", registroId = deUnaPersona.ToString(CultureInfo.InvariantCulture), justificacion = "Es nuestro." });
        Assert.Equal(HttpStatusCode.Conflict, respuesta.StatusCode);
        Assert.Equal("no_reclamable", (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());
    }

    // ---------- Los cinco tipos (decisión 131) -----------------------------------------------

    [Theory]
    [InlineData("redes", "Red de Memoria Sonora")]
    [InlineData("talleres", "Taller de Luthería Andina")]
    [InlineData("espacios", "Sala de Conciertos del Río")]
    public async Task Reclamar_una_Red_un_Taller_o_un_Espacio_historico_se_busca_se_aprueba_y_se_transfiere(string modulo, string nombre)
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await ProcesoAsync(factory, modulo, nombre);
        await ProcesoAsync(factory, modulo, nombre + " en borrador", estado: "borrador");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, $"{modulo}.reclama@example.com");

        // SIN CRITERIO NO SE LISTA NADA; BUSCANDO SALE SOLO EL PUBLICADO Y SIN DUEÑO.
        Assert.Empty((await BuscarAsync(cliente, organizacionId, "")).GetProperty("resultados").EnumerateArray());
        var encontrado = Assert.Single((await BuscarAsync(cliente, organizacionId, $"tipo={modulo}")).GetProperty("resultados").EnumerateArray());
        Assert.Equal(modulo, encontrado.GetProperty("modulo").GetString());
        Assert.Equal(historico.ToString(CultureInfo.InvariantCulture), encontrado.GetProperty("id").GetString());

        var creada = await EnviarAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { modulo, registroId = historico.ToString(CultureInfo.InvariantCulture), justificacion = "Lo gestionamos desde 2019." });
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        var reclamacion = (await creada.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        var solicitudes = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacionId}/solicitudes");
        Assert.Contains(solicitudes.EnumerateArray(), x => x.GetProperty("tipo").GetString() == "acceso" && x.GetProperty("titulo").GetString() == nombre);

        var consola = await CmsTestClient.LoginAsync(factory);
        var detalle = await consola.GetFromJsonAsync<JsonElement>($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}");
        Assert.Equal(nombre, detalle.GetProperty("festival").GetProperty("nombre").GetString());
        Assert.True(detalle.GetProperty("festival").GetProperty("sinOrganizacion").GetBoolean());
        var decision = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "aprobar" });
        Assert.Equal(HttpStatusCode.OK, decision.StatusCode);
        Assert.Equal("transferencia_ejecutada", (await decision.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var (org, persona) = modulo switch
        {
            "redes" => await db.Redes.Where(x => x.Id == historico).Select(x => new { x.OrganizacionPrincipalId, x.UsuarioResponsableId }).SingleAsync().ContinueWith(t => (t.Result.OrganizacionPrincipalId, t.Result.UsuarioResponsableId)),
            "talleres" => await db.Talleres.Where(x => x.Id == historico).Select(x => new { x.OrganizacionPrincipalId, x.UsuarioResponsableId }).SingleAsync().ContinueWith(t => (t.Result.OrganizacionPrincipalId, t.Result.UsuarioResponsableId)),
            _ => await db.Espacios.Where(x => x.Id == historico).Select(x => new { x.OrganizacionPrincipalId, x.UsuarioResponsableId }).SingleAsync().ContinueWith(t => (t.Result.OrganizacionPrincipalId, t.Result.UsuarioResponsableId)),
        };
        Assert.Equal(organizacionId, org);
        Assert.Null(persona);
        Assert.Single(await db.AdministrationTransfers.Where(x => x.ModuloId == modulo).ToListAsync());
    }

    [Theory]
    [InlineData("redes", "/api/v1/publico/redes/")]
    [InlineData("talleres", "/api/v1/publico/talleres/")]
    [InlineData("espacios", "/api/v1/publico/espacios/")]
    public async Task La_ficha_publica_de_cada_tipo_dice_si_es_un_registro_historico(string modulo, string ruta)
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await ProcesoAsync(factory, modulo, "Proceso Historico Publico " + modulo);
        var (_, organizacionId) = await OrganizacionAsync(factory, $"ficha.{modulo}@example.com");
        var propio = await ProcesoAsync(factory, modulo, "Proceso Con Duena Publico " + modulo, organizacion: organizacionId);
        var anonimo = factory.CreateClient();
        Assert.True((await anonimo.GetFromJsonAsync<JsonElement>(ruta + historico.ToString(CultureInfo.InvariantCulture))).GetProperty("esRegistroHistorico").GetBoolean());
        Assert.False((await anonimo.GetFromJsonAsync<JsonElement>(ruta + propio.ToString(CultureInfo.InvariantCulture))).GetProperty("esRegistroHistorico").GetBoolean());
    }

    // ---------- Piezas -----------------------------------------------------------------------

    private static async Task<int> FestivalAsync(TestWebApplicationFactory factory, string nombre, string? departamento = "05", string? municipio = "05001",
        string? organizador = null, string estado = "publicado")
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
        var festival = new FestivalRow
        {
            Name = nombre, Description = "Registro histórico de prueba.", CoverageLevel = municipio is null ? "departamental" : "municipal",
            DepartmentCode = departamento, MunicipalityCode = municipio, StatusCode = estado, OrganizacionPrincipalId = institucional,
            OrganizerDisplayName = organizador, CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();
        return festival.Id;
    }

    private static async Task<int> MercadoAsync(TestWebApplicationFactory factory, string nombre, string? departamento = "05", string? municipio = "05001",
        string estado = "publicado", bool conEdiciones = false, int? organizacion = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
        var mercado = new MercadoRow
        {
            Nombre = nombre, NivelCobertura = "municipal", CodigoDepartamento = departamento, CodigoMunicipio = municipio,
            OrganizacionPrincipalId = organizacion ?? institucional, EstadoRegistro = estado, Activo = true, FechaCreacion = DateTime.UtcNow,
        };
        db.Mercados.Add(mercado);
        await db.SaveChangesAsync();
        if (conEdiciones)
        {
            db.EdicionesMercado.AddRange(
                new EdicionMercadoRow { MercadoId = mercado.Id, Anio = 2024, FechaCreacion = DateTime.UtcNow },
                new EdicionMercadoRow { MercadoId = mercado.Id, Anio = 2025, FechaCreacion = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }
        return mercado.Id;
    }

    /// <summary>Una Red, un Taller o un Espacio: histórico (a nombre de la institucional) por omisión, o de una organización o de una persona.</summary>
    private static async Task<int> ProcesoAsync(TestWebApplicationFactory factory, string modulo, string nombre, int? organizacion = null,
        string estado = "publicado", bool persona = false)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
        int? org = persona ? null : organizacion ?? institucional;
        int? responsable = persona ? await db.Users.Select(x => (int?)x.Id).FirstAsync() : null;
        var ahora = DateTime.UtcNow;
        switch (modulo)
        {
            case "redes":
                var red = new RedRow { Nombre = nombre, NivelCobertura = "nacional", OrganizacionPrincipalId = org, UsuarioResponsableId = responsable, EstadoRegistro = estado, Activo = true, FechaCreacion = ahora };
                db.Redes.Add(red); await db.SaveChangesAsync(); return red.Id;
            case "talleres":
                var taller = new TallerRow { Nombre = nombre, NivelCobertura = "nacional", OrganizacionPrincipalId = org, UsuarioResponsableId = responsable, EstadoRegistro = estado, Activo = true, FechaCreacion = ahora };
                db.Talleres.Add(taller); await db.SaveChangesAsync(); return taller.Id;
            default:
                var espacio = new EspacioRow { Nombre = nombre, NivelCobertura = "nacional", OrganizacionPrincipalId = org, UsuarioResponsableId = responsable, EstadoRegistro = estado, Activo = true, FechaCreacion = ahora };
                db.Espacios.Add(espacio); await db.SaveChangesAsync(); return espacio.Id;
        }
    }

    private static async Task PonerNombreAsync(TestWebApplicationFactory factory, int organizacionId, string nombre)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        (await db.EntityProfiles.SingleAsync(x => x.Id == organizacionId)).Name = nombre;
        await db.SaveChangesAsync();
    }

    private static async Task<JsonElement> BuscarAsync(HttpClient cliente, int organizacionId, string consulta) =>
        await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacionId}/procesos-historicos?{consulta}");

    private static async Task<(HttpClient Cliente, int OrganizacionId)> OrganizacionAsync(TestWebApplicationFactory factory, string correo)
    {
        var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización de " + correo,
            FullName = "Responsable de la organización",
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = "05",
            HeadquartersMunicipalityCode = "05001",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var mias = await client.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/mis");
        return (client, int.Parse(mias[0].GetProperty("id").GetString()!, CultureInfo.InvariantCulture));
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient client, string ruta, object cuerpo)
    {
        var testigo = await client.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await client.SendAsync(mensaje);
    }
}
