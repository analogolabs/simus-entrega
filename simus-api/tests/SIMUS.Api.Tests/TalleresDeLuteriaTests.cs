using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El taller de lutería de punta a punta: lo registra una organización o un lutier independiente, lo
/// envía a revisión, el Programa decide, el portal solo enseña lo publicado.
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE SE COMPRUEBA, EN ORDEN DE RIESGO.</b> Primero la guarda —quién puede tocar qué taller,
/// y que un ajeno responda 404 y no 403—, después el circuito de estados con sus motivos
/// obligatorios, después la regla «errata al instante, cambio de fondo vuelve a revisión», y por
/// último que el DTO público no lleve el nombre de una persona.
/// </para>
/// <para>
/// <b>LAS FILAS QUE ESCRIBEN BITÁCORA Y HISTORIAL SE PRUEBAN TAMBIÉN CONTRA SQL SERVER</b> (los
/// CHECK de acción no existen en SQLite): <see cref="TalleresDeLuteriaSqlServerTests"/>.
/// </para>
/// </remarks>
public sealed class TalleresDeLuteriaTests
{
    private const string Clave = "ClaveExterna123";
    private const string Talleres = "/api/v1/institucional/talleres";

    // ───────────────────────────────────── Ayudantes ─────────────────────────────────────

    internal static async Task<(HttpClient Sesion, int OrganizacionId, string Csrf)> OrganizacionAsync(
        TestWebApplicationFactory factory, string nombre)
    {
        var cliente = factory.CreateClient();
        var correo = $"luteria.{Guid.NewGuid():N}@organizacion.test";

        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = nombre,
            FullName = "Persona responsable",
            NumeroDocumento = "1020304051",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            HeadquartersDepartmentCode = "05",
            HeadquartersMunicipalityCode = "05001",
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        await CorreoConfirmadoEnPruebas.ConfirmarAsync(factory, correo);

        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();

        var csrf = (await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf"))
            .GetProperty("requestToken").GetString()!;
        var mias = await cliente.GetFromJsonAsync<List<OrganizacionAdministradaDto>>("/api/v1/externo/organizaciones/mis");
        return (cliente, int.Parse(mias![0].Id, CultureInfo.InvariantCulture), csrf);
    }

    /// <summary>Un lutier independiente: cuenta individual, sin organización.</summary>
    internal static async Task<(HttpClient Sesion, string Csrf, string Nombre)> LutierAsync(
        TestWebApplicationFactory factory, string primerNombre = "Marta")
    {
        var cliente = factory.CreateClient();
        var correo = $"lutier.{Guid.NewGuid():N}@correo.test";
        var documento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture);

        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = primerNombre,
            FirstSurname = "Valderrama",
            DocumentType = "cc",
            DocumentNumber = documento,
            Phone = "3001234567",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        await CorreoConfirmadoEnPruebas.ConfirmarAsync(factory, correo);

        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();
        var csrf = (await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf"))
            .GetProperty("requestToken").GetString()!;
        return (cliente, csrf, $"{primerNombre} Valderrama");
    }

    internal static async Task<HttpResponseMessage> EnviarAsync(
        HttpClient cliente, string csrf, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var peticion = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) peticion.Content = JsonContent.Create(cuerpo);
        peticion.Headers.Add("X-CSRF-TOKEN", csrf);
        return await cliente.SendAsync(peticion);
    }

    internal static async Task<(List<int> Servicios, List<int> Familias)> CatalogosAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var servicios = await db.ServiciosDeTaller.AsNoTracking().OrderBy(x => x.Id).Take(2).Select(x => x.Id).ToListAsync();
        var familias = await db.FamiliasDeInstrumentos.AsNoTracking().Where(x => x.FamiliaPadreId == null)
            .OrderBy(x => x.Id).Take(1).Select(x => x.Id).ToListAsync();
        return (servicios, familias);
    }

    internal static TallerUpsertRequest UnTallerCompleto(List<int> servicios, List<int> familias, string nombre = "Taller de lutería Los Cedros") => new()
    {
        Nombre = nombre,
        Descripcion = "Construcción y reparación de guitarras, tiples y bandolas con maderas de la región.",
        Modalidad = "fijo",
        RecibeAprendices = true,
        SaberesYTecnicas = "Encolado en caliente, barnizado a muñequilla.",
        CorreoTaller = "cedros@taller.test",
        TelefonoTaller = "3001112233",
        NivelCobertura = "municipal",
        CodigoDepartamento = "05",
        CodigoMunicipio = "05001",
        ServiciosIds = servicios,
        FamiliasIds = familias,
    };

    internal static async Task<TallerDto> CrearComoOrganizacionAsync(
        HttpClient cliente, string csrf, int organizacion, TallerUpsertRequest cuerpo)
    {
        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacion}/talleres", cuerpo);
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<TallerDto>())!;
    }

    internal static async Task<TallerDto> CrearComoPersonaAsync(HttpClient cliente, string csrf, TallerUpsertRequest cuerpo)
    {
        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, "/api/v1/externo/mis-talleres", cuerpo);
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<TallerDto>())!;
    }

    internal static async Task<TallerDto> EnviarARevisionAsync(HttpClient cliente, string csrf, int id)
    {
        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/talleres/{id}/enviar-a-revision", new { });
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<TallerDto>())!;
    }

    internal static async Task<HttpResponseMessage> DecidirAsync(HttpClient consola, int id, string decision, string? motivo = null) =>
        await consola.PostAsJsonAsync($"{Talleres}/{id}/decision", new DecisionSobreTaller { Decision = decision, Motivo = motivo });

    // ─────────────────────────────── Vocabularios y alta ───────────────────────────────

    [Fact]
    public async Task Los_vocabularios_iniciales_estan_sembrados_como_propuestos()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, _, _) = await OrganizacionAsync(factory, "Organización que consulta");

        var catalogos = await cliente.GetFromJsonAsync<CatalogosDeTallerDto>("/api/v1/externo/catalogos/taller");

        Assert.NotNull(catalogos);
        // Las cinco clases de Hornbostel-Sachs y, debajo de los cordófonos, frotados y pulsados.
        Assert.Equal(5, catalogos!.Familias.Count(f => f.PadreId is null));
        Assert.Equal(2, catalogos.Familias.Count(f => f.PadreId is not null));
        Assert.Contains(catalogos.Familias, f => f.Slug == "cordofonos-frotados");
        Assert.Contains(catalogos.Servicios, s => s.Slug == "construccion");
        // Ninguno está aprobado todavía: la aprobación es del Plan Nacional de Música.
        Assert.All(catalogos.Servicios.Concat(catalogos.Familias), o => Assert.Equal("propuesto", o.EstadoAprobacion));
    }

    [Fact]
    public async Task La_organizacion_registra_su_taller_y_nace_en_borrador()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory, "Organización lutera");
        var (servicios, familias) = await CatalogosAsync(factory);

        var taller = await CrearComoOrganizacionAsync(cliente, csrf, organizacion, UnTallerCompleto(servicios, familias));

        Assert.Equal("borrador", taller.EstadoRegistro);
        Assert.Equal(organizacion, taller.OrganizacionId);
        Assert.Null(taller.UsuarioResponsableId);
        Assert.Equal(2, taller.Servicios.Count);
        Assert.Single(taller.Familias);
    }

    [Fact]
    public async Task El_lutier_independiente_registra_su_taller_sin_organizacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);

        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias));

        Assert.Equal("borrador", taller.EstadoRegistro);
        Assert.Null(taller.OrganizacionId);
        Assert.NotNull(taller.UsuarioResponsableId);

        var mios = await cliente.GetFromJsonAsync<List<TallerDto>>("/api/v1/externo/mis-talleres");
        Assert.Single(mios!);
    }

    [Fact]
    public async Task El_alta_rechaza_un_territorio_incoherente_y_un_catalogo_que_no_existe()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);

        var sinMunicipio = UnTallerCompleto(servicios, familias);
        sinMunicipio.CodigoMunicipio = null; // «municipal» exige municipio
        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, "/api/v1/externo/mis-talleres", sinMunicipio);
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("nivelCobertura", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var conServicioFalso = UnTallerCompleto([999_999], familias);
        respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, "/api/v1/externo/mis-talleres", conServicioFalso);
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("serviciosIds", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_registro_sin_testigo_antiforgery_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, _, _) = await LutierAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);

        var respuesta = await cliente.PostAsJsonAsync("/api/v1/externo/mis-talleres", UnTallerCompleto(servicios, familias));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    // ─────────────────────────────────── La guarda ───────────────────────────────────

    [Fact]
    public async Task Un_taller_ajeno_no_existe_para_quien_no_responde_por_el()
    {
        await using var factory = new TestWebApplicationFactory();
        var (duena, csrfDuena, _) = await LutierAsync(factory, "Marta");
        var (otra, csrfOtra, _) = await LutierAsync(factory, "Elena");
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(duena, csrfDuena, UnTallerCompleto(servicios, familias));

        // 404, no 403: no se confirma que exista.
        Assert.Equal(HttpStatusCode.NotFound, (await otra.GetAsync($"/api/v1/externo/talleres/{taller.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otra, csrfOtra, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", UnTallerCompleto(servicios, familias))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otra, csrfOtra, HttpMethod.Post, $"/api/v1/externo/talleres/{taller.Id}/enviar-a-revision", new { })).StatusCode);

        Assert.Empty((await otra.GetFromJsonAsync<List<TallerDto>>("/api/v1/externo/mis-talleres"))!);
    }

    [Fact]
    public async Task Una_organizacion_no_ve_ni_crea_talleres_de_otra()
    {
        await using var factory = new TestWebApplicationFactory();
        var (unaSesion, unaOrganizacion, unCsrf) = await OrganizacionAsync(factory, "Organización A");
        var (otraSesion, otraOrganizacion, otroCsrf) = await OrganizacionAsync(factory, "Organización B");
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoOrganizacionAsync(unaSesion, unCsrf, unaOrganizacion, UnTallerCompleto(servicios, familias));

        Assert.Equal(HttpStatusCode.NotFound, (await otraSesion.GetAsync($"/api/v1/externo/talleres/{taller.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otraSesion.GetAsync($"/api/v1/externo/organizaciones/{unaOrganizacion}/talleres")).StatusCode);
        var intento = await EnviarAsync(otraSesion, otroCsrf, HttpMethod.Post,
            $"/api/v1/externo/organizaciones/{unaOrganizacion}/talleres", UnTallerCompleto(servicios, familias));
        Assert.Equal(HttpStatusCode.NotFound, intento.StatusCode);
        Assert.NotEqual(otraOrganizacion, unaOrganizacion);
    }

    // ───────────────────────────────── El circuito ─────────────────────────────────

    [Fact]
    public async Task Enviar_a_revision_dice_en_el_idioma_de_quien_diligencia_que_falta()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var vacio = UnTallerCompleto([], [], "Taller a medias");
        vacio.Descripcion = null;
        vacio.CorreoTaller = null;
        vacio.TelefonoTaller = null;
        var taller = await CrearComoPersonaAsync(cliente, csrf, vacio);

        var envio = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/talleres/{taller.Id}/enviar-a-revision", new { });

        Assert.Equal(HttpStatusCode.BadRequest, envio.StatusCode);
        var cuerpo = await envio.Content.ReadAsStringAsync();
        Assert.Contains("Para enviarlo falta", cuerpo, StringComparison.Ordinal);
        Assert.Contains("serviciosIds", cuerpo, StringComparison.Ordinal);
        Assert.Contains("familiasIds", cuerpo, StringComparison.Ordinal);
        Assert.Contains("descripcion", cuerpo, StringComparison.Ordinal);
        Assert.NotEmpty(servicios);
        Assert.NotEmpty(familias);
    }

    [Fact]
    public async Task El_circuito_completo_registrar_enviar_publicar_y_verlo_en_el_portal()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, nombreDeLaPersona) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var anonimo = factory.CreateClient();

        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias, "Taller Los Cedros"));

        // UN BORRADOR NO SALE EN EL PORTAL, ni en la lista ni por su identificador.
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/talleres/{taller.Id}")).StatusCode);

        var enviado = await EnviarARevisionAsync(cliente, csrf, taller.Id);
        Assert.Equal("en_revision", enviado.EstadoRegistro);

        // EN REVISIÓN NO SE EDITA NI SE REENVÍA: está en manos del Programa.
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", UnTallerCompleto(servicios, familias))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/talleres/{taller.Id}/enviar-a-revision", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/talleres/{taller.Id}")).StatusCode);

        var publicado = await (await DecidirAsync(consola, taller.Id, "publicar")).Content.ReadFromJsonAsync<TallerDto>();
        Assert.Equal("publicado", publicado!.EstadoRegistro);
        Assert.NotNull(publicado.FechaPublicacion);

        // AHORA SÍ: lista y ficha públicas.
        var lista = await anonimo.GetFromJsonAsync<PagedResponse<TallerPublicoDto>>("/api/v1/publico/talleres");
        Assert.Contains(lista!.Items, t => t.Id == taller.Id);
        var ficha = await anonimo.GetAsync($"/api/v1/publico/talleres/{taller.Id}");
        Assert.Equal(HttpStatusCode.OK, ficha.StatusCode);
        var detalle = await ficha.Content.ReadFromJsonAsync<TallerPublicoDto>();
        Assert.True(detalle!.EsIndependiente);
        Assert.Null(detalle.OrganizacionNombre);

        // EL DTO PÚBLICO NO LLEVA EL NOMBRE DE LA PERSONA: se publica el taller, no su identidad.
        var crudo = await ficha.Content.ReadAsStringAsync();
        Assert.DoesNotContain(nombreDeLaPersona.Split(' ')[0], crudo, StringComparison.Ordinal);
        Assert.DoesNotContain("usuarioResponsableId", crudo, StringComparison.OrdinalIgnoreCase);

        // FILTROS DEL DIRECTORIO: por servicio y por departamento.
        var porServicio = await anonimo.GetFromJsonAsync<PagedResponse<TallerPublicoDto>>($"/api/v1/publico/talleres?servicio={servicios[0]}");
        Assert.Contains(porServicio!.Items, t => t.Id == taller.Id);
        var otroDepartamento = await anonimo.GetFromJsonAsync<PagedResponse<TallerPublicoDto>>("/api/v1/publico/talleres?departamento=08");
        Assert.DoesNotContain(otroDepartamento!.Items, t => t.Id == taller.Id);
    }

    [Fact]
    public async Task Pedir_ajustes_y_rechazar_exigen_motivo_y_el_motivo_llega_al_responsable()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias));
        await EnviarARevisionAsync(cliente, csrf, taller.Id);

        Assert.Equal(HttpStatusCode.BadRequest, (await DecidirAsync(consola, taller.Id, "ajustes")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DecidirAsync(consola, taller.Id, "rechazar")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DecidirAsync(consola, taller.Id, "inventada", "Motivo.")).StatusCode);

        var conAjustes = await (await DecidirAsync(consola, taller.Id, "ajustes", "Falta el barrio del taller.")).Content.ReadFromJsonAsync<TallerDto>();
        Assert.Equal("ajustes_solicitados", conAjustes!.EstadoRegistro);

        // EL RESPONSABLE VE EL MOTIVO, lo edita y lo reenvía.
        var suyo = await cliente.GetFromJsonAsync<TallerDto>($"/api/v1/externo/talleres/{taller.Id}");
        Assert.Equal("Falta el barrio del taller.", suyo!.MotivoDeLaDecision);
        var edicion = UnTallerCompleto(servicios, familias);
        edicion.LugarEspecifico = "Barrio Laureles";
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", edicion)).StatusCode);
        var reenviado = await EnviarARevisionAsync(cliente, csrf, taller.Id);
        Assert.Equal("en_revision", reenviado.EstadoRegistro);

        var rechazado = await (await DecidirAsync(consola, taller.Id, "rechazar", "No es un taller de lutería.")).Content.ReadFromJsonAsync<TallerDto>();
        Assert.Equal("rechazado", rechazado!.EstadoRegistro);
        // RECHAZADO ES TERMINAL: no se edita ni se vuelve a enviar.
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", edicion)).StatusCode);

        // Y EL AVISO LLEGÓ A LA PERSONA, con el motivo.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var aviso = await db.Notifications.AsNoTracking()
            .FirstOrDefaultAsync(n => n.ModuloId == Modulos.Talleres && n.EventType == "TallerRechazado");
        Assert.NotNull(aviso);
        Assert.Contains("No es un taller de lutería.", aviso!.Body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task La_consola_no_decide_sobre_un_taller_que_no_esta_en_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias));

        Assert.Equal(HttpStatusCode.Conflict, (await DecidirAsync(consola, taller.Id, "publicar")).StatusCode);
    }

    [Fact]
    public async Task La_decision_de_la_consola_sin_testigo_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias));
        await EnviarARevisionAsync(cliente, csrf, taller.Id);

        var respuesta = await DecidirAsync(sinTestigo, taller.Id, "publicar");

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        var intacto = await consola.GetFromJsonAsync<TallerDto>($"{Talleres}/{taller.Id}");
        Assert.Equal("en_revision", intacto!.EstadoRegistro);
    }

    // ───────────────────────── Errata al instante, cambio de fondo a revisión ─────────────────────────

    [Fact]
    public async Task Una_errata_de_un_taller_publicado_se_aplica_al_instante_y_deja_su_rastro()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias));
        await EnviarARevisionAsync(cliente, csrf, taller.Id);
        (await DecidirAsync(consola, taller.Id, "publicar")).EnsureSuccessStatusCode();

        var errata = UnTallerCompleto(servicios, familias);
        errata.Descripcion = "Construcción y reparación de guitarras, tiples y bandolas con maderas de la región, desde 1998.";
        errata.TelefonoTaller = "3009998877";
        var guardado = await (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", errata)).Content.ReadFromJsonAsync<TallerDto>();

        // SIGUE PUBLICADO: era una errata.
        Assert.Equal("publicado", guardado!.EstadoRegistro);
        var publico = await factory.CreateClient().GetFromJsonAsync<TallerPublicoDto>($"/api/v1/publico/talleres/{taller.Id}");
        Assert.Contains("desde 1998", publico!.Descripcion, StringComparison.Ordinal);

        // Y QUEDA EN EL REGISTRO DE CAMBIOS, campo por campo, con el valor anterior.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var cambios = await db.CambiosDeRegistro.AsNoTracking()
            .Where(c => c.ModuloId == Modulos.Talleres && c.RegistroId == taller.Id.ToString(CultureInfo.InvariantCulture))
            .ToListAsync();
        var descripcion = Assert.Single(cambios, c => c.CampoId == "descripcion");
        Assert.Contains("maderas de la región.", descripcion.ValorAnterior, StringComparison.Ordinal);
        Assert.Contains("desde 1998", descripcion.ValorNuevo, StringComparison.Ordinal);
        // EL TELÉFONO ES UN DATO DE CONTACTO: se guarda, pero no es «público» para el historial.
        Assert.Equal("contacto", Assert.Single(cambios, c => c.CampoId == "telefonoTaller").ClaseDato);
    }

    [Fact]
    public async Task La_organizacion_lee_el_historial_de_su_taller_sin_los_datos_de_contacto()
    {
        // LA HISTORIA SIGUE A LA ADMINISTRACIÓN (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10): la lectura por organización pregunta de
        // quién es el taller AHORA. Un módulo que la guarda no conocía devolvería siempre un historial vacío.
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory, "Organización lutera del historial");
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoOrganizacionAsync(cliente, csrf, organizacion, UnTallerCompleto(servicios, familias));

        var cambio = UnTallerCompleto(servicios, familias);
        cambio.Descripcion = "Taller de lutería con una descripción nueva, escrita para el historial de la organización.";
        cambio.TelefonoTaller = "3001112233";
        (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", cambio)).EnsureSuccessStatusCode();

        var linea = await cliente.GetFromJsonAsync<LineaDeTiempoDelRegistroDto>(
            $"/api/v1/externo/organizaciones/{organizacion}/historial/{Modulos.Talleres}/{taller.Id}");
        var campos = linea!.Entradas.SelectMany(x => x.Cambios).ToList();
        Assert.Contains(campos, x => x.CampoId == "descripcion");
        // El teléfono es dato de contacto: se guarda, pero la organización no lo lee en el historial.
        Assert.DoesNotContain(campos, x => x.CampoId == "telefonoTaller");
    }

    [Fact]
    public async Task Un_cambio_de_fondo_de_un_taller_publicado_no_se_guarda_en_caliente_y_se_propone()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias, "Taller de nombre inicial"));
        await EnviarARevisionAsync(cliente, csrf, taller.Id);
        (await DecidirAsync(consola, taller.Id, "publicar")).EnsureSuccessStatusCode();

        // 1. LO DE FONDO NO SE ESCRIBE EN CALIENTE: responde 409 con los campos y el taller sigue publicado y visible.
        var renombrado = UnTallerCompleto(servicios, familias, "Taller con otro nombre");
        var directo = await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{taller.Id}", renombrado);
        Assert.Equal(HttpStatusCode.Conflict, directo.StatusCode);
        var rechazo = await directo.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("cambio_de_fondo", rechazo.GetProperty("motivo").GetString());
        Assert.Contains("nombre", rechazo.GetProperty("campos").EnumerateArray().Select(c => c.GetString()));
        var publico = await factory.CreateClient().GetFromJsonAsync<TallerPublicoDto>($"/api/v1/publico/talleres/{taller.Id}");
        Assert.Equal("Taller de nombre inicial", publico!.Nombre);

        // 2. SE PROPONE, y el borrador es de quien responde: la consola no lo ve.
        var ruta = $"/api/v1/externo/talleres/{taller.Id}/propuesta";
        var guardada = await EnviarAsync(cliente, csrf, HttpMethod.Put, ruta, new GuardarPropuestaDeCambioSolicitud
        {
            Motivo = "Cambió el nombre del taller.",
            Campos =
            [
                new CampoPropuestoSolicitud { CampoId = "nombre", ValorPropuesto = "Taller con otro nombre" },
                new CampoPropuestoSolicitud { CampoId = "servicios", ValorPropuesto = servicios[0].ToString(CultureInfo.InvariantCulture) },
            ],
        });
        guardada.EnsureSuccessStatusCode();
        var invisible = await consola.GetFromJsonAsync<PropuestaDeCambioDto>($"/api/v1/institucional/talleres/{taller.Id}/propuesta");
        Assert.Equal(0, invisible!.Id);

        // UN CAMPO DE ERRATA NO SE PROPONE: se edita directo.
        var errata = await EnviarAsync(cliente, csrf, HttpMethod.Put, ruta, new GuardarPropuestaDeCambioSolicitud
        {
            Campos = [new CampoPropuestoSolicitud { CampoId = "telefonoTaller", ValorPropuesto = "3000000000" }],
        });
        Assert.Equal(HttpStatusCode.BadRequest, errata.StatusCode);

        // 3. AL ENVIAR SE CONGELA EL «ANTES», y se lee por nombre, no por identificador.
        var enviada = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"{ruta}/enviar", new { });
        enviada.EnsureSuccessStatusCode();
        var enRevision = await enviada.Content.ReadFromJsonAsync<PropuestaDeCambioDto>();
        Assert.Equal("en_revision", enRevision!.Estado);
        var campoServicios = Assert.Single(enRevision.Campos, c => c.CampoId == "servicios");
        Assert.False(string.IsNullOrWhiteSpace(campoServicios.ValorPropuestoLegible));
        Assert.DoesNotContain("#", campoServicios.ValorPropuestoLegible, StringComparison.Ordinal);
        Assert.Equal("Taller de nombre inicial", Assert.Single(enRevision.Campos, c => c.CampoId == "nombre").ValorAnterior);

        // 4. LA CONSOLA LA VE EN SU LISTA Y LA DECIDE; la persona no tiene organización y la propuesta lo respeta.
        var bandeja = await consola.GetFromJsonAsync<PropuestaEnRevisionDto[]>("/api/v1/institucional/talleres/propuestas/en-revision");
        var fila = Assert.Single(bandeja!);
        Assert.Equal("Taller de nombre inicial", fila.NombreDelRegistro);
        Assert.Equal(2, fila.CamposQueCambian);
        Assert.Null(fila.OrganizacionNombre);

        var decidida = await consola.PostAsJsonAsync($"/api/v1/institucional/talleres/propuestas/{enRevision.Id}/decision",
            new DecidirPropuestaDeCambioSolicitud { Decision = "aplicar" });
        decidida.EnsureSuccessStatusCode();

        // 5. APLICAR CAMBIA LA FICHA PUBLICADA, y queda en el registro de cambios con el origen «propuesta».
        publico = await factory.CreateClient().GetFromJsonAsync<TallerPublicoDto>($"/api/v1/publico/talleres/{taller.Id}");
        Assert.Equal("Taller con otro nombre", publico!.Nombre);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var cambios = await db.CambiosDeRegistro.AsNoTracking()
            .Where(c => c.ModuloId == Modulos.Talleres && c.RegistroId == taller.Id.ToString(CultureInfo.InvariantCulture) && c.Origen == "propuesta")
            .ToListAsync();
        Assert.Contains(cambios, c => c.CampoId == "nombre" && c.ValorNuevo == "Taller con otro nombre" && c.PropuestaId == enRevision.Id);
        Assert.Single(db.PropuestasDeCambio.AsNoTracking().Where(p => p.ModuloId == Modulos.Talleres && p.Estado == EstadosDePropuesta.Aplicada));
        Assert.Empty(await consola.GetFromJsonAsync<PropuestaEnRevisionDto[]>("/api/v1/institucional/talleres/propuestas/en-revision") ?? []);
    }

    [Fact]
    public async Task La_propuesta_de_un_taller_de_una_organizacion_pide_administrar_y_aparece_en_sus_solicitudes()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = await CmsTestClient.LoginAsync(factory);
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory, "Organización lutera de las propuestas");
        var (ajeno, csrfAjeno, _) = await LutierAsync(factory, "Otra");
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoOrganizacionAsync(cliente, csrf, organizacion, UnTallerCompleto(servicios, familias));

        // EN BORRADOR SE EDITA DIRECTAMENTE: proponer no tiene sentido todavía.
        var ruta = $"/api/v1/externo/talleres/{taller.Id}/propuesta";
        var cambio = new GuardarPropuestaDeCambioSolicitud { Campos = [new CampoPropuestoSolicitud { CampoId = "nombre", ValorPropuesto = "Otro" }] };
        Assert.Equal(HttpStatusCode.Conflict, (await EnviarAsync(cliente, csrf, HttpMethod.Put, ruta, cambio)).StatusCode);

        await EnviarARevisionAsync(cliente, csrf, taller.Id);
        (await DecidirAsync(consola, taller.Id, "publicar")).EnsureSuccessStatusCode();

        // QUIEN NO ADMINISTRA LA ORGANIZACION NO PROPONE EN NOMBRE DE ELLA.
        Assert.Equal(HttpStatusCode.NotFound, (await EnviarAsync(ajeno, csrfAjeno, HttpMethod.Put, ruta, cambio)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(cliente, csrf, HttpMethod.Put, ruta, cambio)).StatusCode);
        (await EnviarAsync(cliente, csrf, HttpMethod.Post, $"{ruta}/enviar", new { })).EnsureSuccessStatusCode();

        // «MI ACTIVIDAD Y SOLICITUDES» LA LISTA, con el nombre del taller y la ruta de su ficha.
        var solicitudes = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacion}/solicitudes");
        var texto = solicitudes.GetRawText();
        Assert.Contains("propuesta-", texto, StringComparison.Ordinal);
        Assert.Contains($"/procesos/luteria/{taller.Id}", texto, StringComparison.Ordinal);
    }

    // ─────────────────────────────────────── Retiro ───────────────────────────────────────

    [Fact]
    public async Task El_responsable_retira_su_taller_publicado_con_motivo_y_deja_de_verse()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias));
        await EnviarARevisionAsync(cliente, csrf, taller.Id);
        (await DecidirAsync(consola, taller.Id, "publicar")).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.BadRequest,
            (await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/talleres/{taller.Id}/retirar", new { })).StatusCode);
        var retiro = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/talleres/{taller.Id}/retirar", new { motivo = "Cerré el taller." });

        Assert.Equal(HttpStatusCode.OK, retiro.StatusCode);
        Assert.Equal("archivado", (await retiro.Content.ReadFromJsonAsync<TallerDto>())!.EstadoRegistro);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync($"/api/v1/publico/talleres/{taller.Id}")).StatusCode);
    }

    [Fact]
    public async Task La_consola_retira_un_taller_publicado_con_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias));
        await EnviarARevisionAsync(cliente, csrf, taller.Id);
        (await DecidirAsync(consola, taller.Id, "publicar")).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync($"{Talleres}/{taller.Id}/archivar", new { })).StatusCode);
        var retirado = await consola.PostAsJsonAsync($"{Talleres}/{taller.Id}/archivar", new { motivo = "Datos de contacto falsos." });

        Assert.Equal(HttpStatusCode.OK, retirado.StatusCode);
        Assert.Equal("archivado", (await retirado.Content.ReadFromJsonAsync<TallerDto>())!.EstadoRegistro);
    }

    [Fact]
    public async Task Abandonar_un_borrador_lo_archiva_y_retirar_de_revision_lo_devuelve_a_borrador()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);

        var enRevision = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias, "Uno"));
        await EnviarARevisionAsync(cliente, csrf, enRevision.Id);
        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(cliente, csrf, HttpMethod.Delete, $"/api/v1/externo/talleres/{enRevision.Id}")).StatusCode);
        Assert.Equal("borrador", (await cliente.GetFromJsonAsync<TallerDto>($"/api/v1/externo/talleres/{enRevision.Id}"))!.EstadoRegistro);

        var abandonado = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias, "Dos"));
        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(cliente, csrf, HttpMethod.Delete, $"/api/v1/externo/talleres/{abandonado.Id}")).StatusCode);
        // ARCHIVADO NO SE EDITA.
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/talleres/{abandonado.Id}", UnTallerCompleto(servicios, familias))).StatusCode);
    }

    // ───────────────────────────────────── La consola ─────────────────────────────────────

    [Fact]
    public async Task La_consola_lista_y_filtra_los_talleres_por_estado_y_por_tipo_de_responsable()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var (sesionOrganizacion, organizacion, csrfOrganizacion) = await OrganizacionAsync(factory, "Organización lutera de la lista");
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var deLaPersona = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias, "Taller de persona"));
        var deLaOrganizacion = await CrearComoOrganizacionAsync(sesionOrganizacion, csrfOrganizacion, organizacion, UnTallerCompleto(servicios, familias, "Taller de organización"));
        await EnviarARevisionAsync(cliente, csrf, deLaPersona.Id);

        var enRevision = await consola.GetFromJsonAsync<PagedResponse<TallerDto>>($"{Talleres}?estado=en_revision");
        Assert.Contains(enRevision!.Items, t => t.Id == deLaPersona.Id);
        Assert.DoesNotContain(enRevision.Items, t => t.Id == deLaOrganizacion.Id);

        var deOrganizaciones = await consola.GetFromJsonAsync<PagedResponse<TallerDto>>($"{Talleres}?responsable=organizacion");
        Assert.Contains(deOrganizaciones!.Items, t => t.Id == deLaOrganizacion.Id);
        Assert.DoesNotContain(deOrganizaciones.Items, t => t.Id == deLaPersona.Id);

        // La ficha de la consola sí nombra a quien responde.
        var ficha = await consola.GetFromJsonAsync<TallerDto>($"{Talleres}/{deLaPersona.Id}");
        Assert.NotNull(ficha!.ResponsableNombre);
    }

    [Fact]
    public async Task Sin_sesion_de_consola_el_modulo_responde_401()
    {
        await using var factory = new TestWebApplicationFactory();

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Talleres)).StatusCode);
    }

    [Fact]
    public async Task La_bitacora_registra_los_eventos_del_circuito_con_el_contrato_unico()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await LutierAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (servicios, familias) = await CatalogosAsync(factory);
        var taller = await CrearComoPersonaAsync(cliente, csrf, UnTallerCompleto(servicios, familias));
        await EnviarARevisionAsync(cliente, csrf, taller.Id);
        (await DecidirAsync(consola, taller.Id, "publicar")).EnsureSuccessStatusCode();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var lineas = await db.AuditLogs.AsNoTracking()
            .Where(a => a.TableName == "Talleres" && a.RecordId == taller.Id.ToString(CultureInfo.InvariantCulture))
            .ToListAsync();

        foreach (var evento in new[] { "TallerCreado", "TallerEnviadoARevision", "TallerPublicado" })
        {
            Assert.Contains(lineas, l => l.NewValuesJson != null && l.NewValuesJson.Contains($"\"evento\":\"{evento}\"", StringComparison.Ordinal));
        }
        // La procedencia del registro quedó anotada.
        Assert.True(await db.ProcedenciasDeRegistro.AsNoTracking()
            .AnyAsync(p => p.ModuloId == Modulos.Talleres && p.RegistroId == taller.Id.ToString(CultureInfo.InvariantCulture)));
    }
}
