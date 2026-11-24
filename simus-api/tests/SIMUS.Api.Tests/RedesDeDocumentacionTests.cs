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
/// La red o centro de documentación de punta a punta: lo registra una organización o una persona responsable, lo
/// envía a revisión, el Programa decide, el portal solo enseña lo publicado.
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE SE COMPRUEBA, EN ORDEN DE RIESGO.</b> Primero la guarda —quién puede tocar qué red,
/// y que un ajeno responda 404 y no 403—, después el circuito de estados con sus motivos
/// obligatorios, después la regla «errata al instante, cambio de fondo vuelve a revisión», y por
/// último que el DTO público no lleve el nombre de una persona.
/// </para>
/// <para>
/// <b>LAS FILAS QUE ESCRIBEN BITÁCORA Y HISTORIAL SE PRUEBAN TAMBIÉN CONTRA SQL SERVER</b> (los
/// CHECK de acción no existen en SQLite): <see cref="RedesDeDocumentacionSqlServerTests"/>.
/// </para>
/// </remarks>
public sealed class RedesDeDocumentacionTests
{
    private const string Clave = "ClaveExterna123";
    private const string Redes = "/api/v1/institucional/redes";

    // ───────────────────────────────────── Ayudantes ─────────────────────────────────────

    private static async Task<(HttpClient Sesion, int OrganizacionId, string Csrf)> OrganizacionAsync(
        TestWebApplicationFactory factory, string nombre)
    {
        var cliente = factory.CreateClient();
        var correo = $"redes.{Guid.NewGuid():N}@organizacion.test";

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

    /// <summary>Una persona responsable: cuenta individual, sin organización.</summary>
    private static async Task<(HttpClient Sesion, string Csrf, string Nombre)> ResponsableAsync(
        TestWebApplicationFactory factory, string primerNombre = "Marta")
    {
        var cliente = factory.CreateClient();
        var correo = $"responsable.{Guid.NewGuid():N}@correo.test";
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

    private static async Task<HttpResponseMessage> EnviarAsync(
        HttpClient cliente, string csrf, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var peticion = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) peticion.Content = JsonContent.Create(cuerpo);
        peticion.Headers.Add("X-CSRF-TOKEN", csrf);
        return await cliente.SendAsync(peticion);
    }

    private static async Task<(List<int> FormasDeAcceso, List<int> Formatos)> CatalogosAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var formasDeAcceso = await db.FormasDeAccesoDeRed.AsNoTracking().OrderBy(x => x.Id).Take(2).Select(x => x.Id).ToListAsync();
        var formatos = await db.FormatosDeDocumentacion.AsNoTracking().Where(x => x.FormatoPadreId == null)
            .OrderBy(x => x.Id).Take(1).Select(x => x.Id).ToListAsync();
        return (formasDeAcceso, formatos);
    }

    private static RedUpsertRequest UnaRedCompleta(List<int> formasDeAcceso, List<int> formatos, string nombre = "Archivo Sonoro Los Cedros") => new()
    {
        Nombre = nombre,
        Descripcion = "Consulta en sala y reparación de guitarras, tiples y bandolas con maderas de la región.",
        TipoDeNodo = "red",
        AccesoAbierto = true,
        AcervosYColecciones = "Grabaciones de campo, partituras y fotografías.",
        CorreoRed = "cedros@red.test",
        TelefonoRed = "3001112233",
        NivelCobertura = "municipal",
        CodigoDepartamento = "05",
        CodigoMunicipio = "05001",
        FormasDeAccesoIds = formasDeAcceso,
        FormatosIds = formatos,
    };

    private static async Task<RedDto> CrearComoOrganizacionAsync(
        HttpClient cliente, string csrf, int organizacion, RedUpsertRequest cuerpo)
    {
        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacion}/redes", cuerpo);
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<RedDto>())!;
    }

    private static async Task<RedDto> CrearComoPersonaAsync(HttpClient cliente, string csrf, RedUpsertRequest cuerpo)
    {
        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, "/api/v1/externo/mis-redes", cuerpo);
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<RedDto>())!;
    }

    private static async Task<RedDto> EnviarARevisionAsync(HttpClient cliente, string csrf, int id)
    {
        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/redes/{id}/enviar-a-revision", new { });
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<RedDto>())!;
    }

    private static async Task<HttpResponseMessage> DecidirAsync(HttpClient consola, int id, string decision, string? motivo = null) =>
        await consola.PostAsJsonAsync($"{Redes}/{id}/decision", new DecisionSobreRed { Decision = decision, Motivo = motivo });

    // ─────────────────────────────── Vocabularios y alta ───────────────────────────────

    [Fact]
    public async Task Los_vocabularios_iniciales_estan_sembrados_como_propuestos()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, _, _) = await OrganizacionAsync(factory, "Organización que consulta");

        var catalogos = await cliente.GetFromJsonAsync<CatalogosDeRedDto>("/api/v1/externo/catalogos/red");

        Assert.NotNull(catalogos);
        // Los seis formatos de documentación y, debajo de «Impreso», partituras y libros y publicaciones periódicas.
        Assert.Equal(6, catalogos!.Formatos.Count(f => f.PadreId is null));
        Assert.Equal(2, catalogos.Formatos.Count(f => f.PadreId is not null));
        Assert.Contains(catalogos.Formatos, f => f.Slug == "partituras");
        Assert.Contains(catalogos.FormasDeAcceso, s => s.Slug == "consulta-en-sala");
        // Ninguno está aprobado todavía: la aprobación es del Plan Nacional de Música.
        Assert.All(catalogos.FormasDeAcceso.Concat(catalogos.Formatos), o => Assert.Equal("propuesto", o.EstadoAprobacion));
    }

    [Fact]
    public async Task La_organizacion_registra_su_red_y_nace_en_borrador()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory, "Organización documentalista");
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);

        var red = await CrearComoOrganizacionAsync(cliente, csrf, organizacion, UnaRedCompleta(formasDeAcceso, formatos));

        Assert.Equal("borrador", red.EstadoRegistro);
        Assert.Equal(organizacion, red.OrganizacionId);
        Assert.Null(red.UsuarioResponsableId);
        Assert.Equal(2, red.FormasDeAcceso.Count);
        Assert.Single(red.Formatos);
    }

    [Fact]
    public async Task La_persona_responsable_registra_su_red_sin_organizacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);

        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos));

        Assert.Equal("borrador", red.EstadoRegistro);
        Assert.Null(red.OrganizacionId);
        Assert.NotNull(red.UsuarioResponsableId);

        var mios = await cliente.GetFromJsonAsync<List<RedDto>>("/api/v1/externo/mis-redes");
        Assert.Single(mios!);
    }

    [Fact]
    public async Task El_alta_rechaza_un_territorio_incoherente_y_un_catalogo_que_no_existe()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);

        var sinMunicipio = UnaRedCompleta(formasDeAcceso, formatos);
        sinMunicipio.CodigoMunicipio = null; // «municipal» exige municipio
        var respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, "/api/v1/externo/mis-redes", sinMunicipio);
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("nivelCobertura", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var conFormaDeAccesoFalsa = UnaRedCompleta([999_999], formatos);
        respuesta = await EnviarAsync(cliente, csrf, HttpMethod.Post, "/api/v1/externo/mis-redes", conFormaDeAccesoFalsa);
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("formasDeAccesoIds", await respuesta.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_registro_sin_testigo_antiforgery_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, _, _) = await ResponsableAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);

        var respuesta = await cliente.PostAsJsonAsync("/api/v1/externo/mis-redes", UnaRedCompleta(formasDeAcceso, formatos));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    // ─────────────────────────────────── La guarda ───────────────────────────────────

    [Fact]
    public async Task Una_red_ajena_no_existe_para_quien_no_responde_por_ella()
    {
        await using var factory = new TestWebApplicationFactory();
        var (duena, csrfDuena, _) = await ResponsableAsync(factory, "Marta");
        var (otra, csrfOtra, _) = await ResponsableAsync(factory, "Elena");
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(duena, csrfDuena, UnaRedCompleta(formasDeAcceso, formatos));

        // 404, no 403: no se confirma que exista.
        Assert.Equal(HttpStatusCode.NotFound, (await otra.GetAsync($"/api/v1/externo/redes/{red.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otra, csrfOtra, HttpMethod.Put, $"/api/v1/externo/redes/{red.Id}", UnaRedCompleta(formasDeAcceso, formatos))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otra, csrfOtra, HttpMethod.Post, $"/api/v1/externo/redes/{red.Id}/enviar-a-revision", new { })).StatusCode);

        Assert.Empty((await otra.GetFromJsonAsync<List<RedDto>>("/api/v1/externo/mis-redes"))!);
    }

    [Fact]
    public async Task Una_organizacion_no_ve_ni_crea_redes_de_otra()
    {
        await using var factory = new TestWebApplicationFactory();
        var (unaSesion, unaOrganizacion, unCsrf) = await OrganizacionAsync(factory, "Organización A");
        var (otraSesion, otraOrganizacion, otroCsrf) = await OrganizacionAsync(factory, "Organización B");
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoOrganizacionAsync(unaSesion, unCsrf, unaOrganizacion, UnaRedCompleta(formasDeAcceso, formatos));

        Assert.Equal(HttpStatusCode.NotFound, (await otraSesion.GetAsync($"/api/v1/externo/redes/{red.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otraSesion.GetAsync($"/api/v1/externo/organizaciones/{unaOrganizacion}/redes")).StatusCode);
        var intento = await EnviarAsync(otraSesion, otroCsrf, HttpMethod.Post,
            $"/api/v1/externo/organizaciones/{unaOrganizacion}/redes", UnaRedCompleta(formasDeAcceso, formatos));
        Assert.Equal(HttpStatusCode.NotFound, intento.StatusCode);
        Assert.NotEqual(otraOrganizacion, unaOrganizacion);
    }

    // ───────────────────────────────── El circuito ─────────────────────────────────

    [Fact]
    public async Task Enviar_a_revision_dice_en_el_idioma_de_quien_diligencia_que_falta()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var vacio = UnaRedCompleta([], [], "Red a medias");
        vacio.Descripcion = null;
        vacio.CorreoRed = null;
        vacio.TelefonoRed = null;
        var red = await CrearComoPersonaAsync(cliente, csrf, vacio);

        var envio = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/redes/{red.Id}/enviar-a-revision", new { });

        Assert.Equal(HttpStatusCode.BadRequest, envio.StatusCode);
        var cuerpo = await envio.Content.ReadAsStringAsync();
        Assert.Contains("Para enviarlo falta", cuerpo, StringComparison.Ordinal);
        Assert.Contains("formasDeAccesoIds", cuerpo, StringComparison.Ordinal);
        Assert.Contains("formatosIds", cuerpo, StringComparison.Ordinal);
        Assert.Contains("descripcion", cuerpo, StringComparison.Ordinal);
        Assert.NotEmpty(formasDeAcceso);
        Assert.NotEmpty(formatos);
    }

    [Fact]
    public async Task El_circuito_completo_registrar_enviar_publicar_y_verlo_en_el_portal()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, nombreDeLaPersona) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var anonimo = factory.CreateClient();

        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos, "Red Los Cedros"));

        // UN BORRADOR NO SALE EN EL PORTAL, ni en la lista ni por su identificador.
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/redes/{red.Id}")).StatusCode);

        var enviado = await EnviarARevisionAsync(cliente, csrf, red.Id);
        Assert.Equal("en_revision", enviado.EstadoRegistro);

        // EN REVISIÓN NO SE EDITA NI SE REENVÍA: está en manos del Programa.
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/redes/{red.Id}", UnaRedCompleta(formasDeAcceso, formatos))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/redes/{red.Id}/enviar-a-revision", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/redes/{red.Id}")).StatusCode);

        var publicado = await (await DecidirAsync(consola, red.Id, "publicar")).Content.ReadFromJsonAsync<RedDto>();
        Assert.Equal("publicado", publicado!.EstadoRegistro);
        Assert.NotNull(publicado.FechaPublicacion);

        // AHORA SÍ: lista y ficha públicas.
        var lista = await anonimo.GetFromJsonAsync<PagedResponse<RedPublicaDto>>("/api/v1/publico/redes");
        Assert.Contains(lista!.Items, t => t.Id == red.Id);
        var ficha = await anonimo.GetAsync($"/api/v1/publico/redes/{red.Id}");
        Assert.Equal(HttpStatusCode.OK, ficha.StatusCode);
        var detalle = await ficha.Content.ReadFromJsonAsync<RedPublicaDto>();
        Assert.True(detalle!.EsIndependiente);
        Assert.Null(detalle.OrganizacionNombre);

        // EL DTO PÚBLICO NO LLEVA EL NOMBRE DE LA PERSONA: se publica la red, no su identidad.
        var crudo = await ficha.Content.ReadAsStringAsync();
        Assert.DoesNotContain(nombreDeLaPersona.Split(' ')[0], crudo, StringComparison.Ordinal);
        Assert.DoesNotContain("usuarioResponsableId", crudo, StringComparison.OrdinalIgnoreCase);

        // FILTROS DEL DIRECTORIO: por formaDeAcceso y por departamento.
        var porFormaDeAcceso = await anonimo.GetFromJsonAsync<PagedResponse<RedPublicaDto>>($"/api/v1/publico/redes?formaDeAcceso={formasDeAcceso[0]}");
        Assert.Contains(porFormaDeAcceso!.Items, t => t.Id == red.Id);
        var otroDepartamento = await anonimo.GetFromJsonAsync<PagedResponse<RedPublicaDto>>("/api/v1/publico/redes?departamento=08");
        Assert.DoesNotContain(otroDepartamento!.Items, t => t.Id == red.Id);
    }

    [Fact]
    public async Task Pedir_ajustes_y_rechazar_exigen_motivo_y_el_motivo_llega_al_responsable()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos));
        await EnviarARevisionAsync(cliente, csrf, red.Id);

        Assert.Equal(HttpStatusCode.BadRequest, (await DecidirAsync(consola, red.Id, "ajustes")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DecidirAsync(consola, red.Id, "rechazar")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await DecidirAsync(consola, red.Id, "inventada", "Motivo.")).StatusCode);

        var conAjustes = await (await DecidirAsync(consola, red.Id, "ajustes", "Falta el barrio de la red.")).Content.ReadFromJsonAsync<RedDto>();
        Assert.Equal("ajustes_solicitados", conAjustes!.EstadoRegistro);

        // EL RESPONSABLE VE EL MOTIVO, lo edita y lo reenvía.
        var suyo = await cliente.GetFromJsonAsync<RedDto>($"/api/v1/externo/redes/{red.Id}");
        Assert.Equal("Falta el barrio de la red.", suyo!.MotivoDeLaDecision);
        var edicion = UnaRedCompleta(formasDeAcceso, formatos);
        edicion.LugarEspecifico = "Barrio Laureles";
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/redes/{red.Id}", edicion)).StatusCode);
        var reenviado = await EnviarARevisionAsync(cliente, csrf, red.Id);
        Assert.Equal("en_revision", reenviado.EstadoRegistro);

        var rechazado = await (await DecidirAsync(consola, red.Id, "rechazar", "No es una red o centro de documentación.")).Content.ReadFromJsonAsync<RedDto>();
        Assert.Equal("rechazado", rechazado!.EstadoRegistro);
        // RECHAZADO ES TERMINAL: no se edita ni se vuelve a enviar.
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/redes/{red.Id}", edicion)).StatusCode);

        // Y EL AVISO LLEGÓ A LA PERSONA, con el motivo.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var aviso = await db.Notifications.AsNoTracking()
            .FirstOrDefaultAsync(n => n.ModuloId == Modulos.Redes && n.EventType == "RedRechazada");
        Assert.NotNull(aviso);
        Assert.Contains("No es una red o centro de documentación.", aviso!.Body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task La_consola_no_decide_sobre_una_red_que_no_esta_en_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos));

        Assert.Equal(HttpStatusCode.Conflict, (await DecidirAsync(consola, red.Id, "publicar")).StatusCode);
    }

    [Fact]
    public async Task La_decision_de_la_consola_sin_testigo_se_rechaza()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var sinTestigo = await CmsTestClient.LoginAsync(factory, withCsrf: false);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos));
        await EnviarARevisionAsync(cliente, csrf, red.Id);

        var respuesta = await DecidirAsync(sinTestigo, red.Id, "publicar");

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        var intacto = await consola.GetFromJsonAsync<RedDto>($"{Redes}/{red.Id}");
        Assert.Equal("en_revision", intacto!.EstadoRegistro);
    }

    // ───────────────────────── Errata al instante, cambio de fondo a revisión ─────────────────────────

    [Fact]
    public async Task Una_errata_de_una_red_publicada_se_aplica_al_instante_y_deja_su_rastro()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos));
        await EnviarARevisionAsync(cliente, csrf, red.Id);
        (await DecidirAsync(consola, red.Id, "publicar")).EnsureSuccessStatusCode();

        var errata = UnaRedCompleta(formasDeAcceso, formatos);
        errata.Descripcion = "Consulta en sala y reparación de guitarras, tiples y bandolas con maderas de la región, desde 1998.";
        errata.TelefonoRed = "3009998877";
        var guardado = await (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/redes/{red.Id}", errata)).Content.ReadFromJsonAsync<RedDto>();

        // SIGUE PUBLICADO: era una errata.
        Assert.Equal("publicado", guardado!.EstadoRegistro);
        var publico = await factory.CreateClient().GetFromJsonAsync<RedPublicaDto>($"/api/v1/publico/redes/{red.Id}");
        Assert.Contains("desde 1998", publico!.Descripcion, StringComparison.Ordinal);

        // Y QUEDA EN EL REGISTRO DE CAMBIOS, campo por campo, con el valor anterior.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var cambios = await db.CambiosDeRegistro.AsNoTracking()
            .Where(c => c.ModuloId == Modulos.Redes && c.RegistroId == red.Id.ToString(CultureInfo.InvariantCulture))
            .ToListAsync();
        var descripcion = Assert.Single(cambios, c => c.CampoId == "descripcion");
        Assert.Contains("maderas de la región.", descripcion.ValorAnterior, StringComparison.Ordinal);
        Assert.Contains("desde 1998", descripcion.ValorNuevo, StringComparison.Ordinal);
        // EL TELÉFONO ES UN DATO DE CONTACTO: se guarda, pero no es «público» para el historial.
        Assert.Equal("contacto", Assert.Single(cambios, c => c.CampoId == "telefonoRed").ClaseDato);
    }

    [Fact]
    public async Task La_organizacion_lee_el_historial_de_su_red_sin_los_datos_de_contacto()
    {
        // LA HISTORIA SIGUE A LA ADMINISTRACIÓN (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10): la lectura por organización pregunta de
        // quién es la red AHORA. Un módulo que la guarda no conocía devolvería siempre un historial vacío.
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion, csrf) = await OrganizacionAsync(factory, "Organización documentalista del historial");
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoOrganizacionAsync(cliente, csrf, organizacion, UnaRedCompleta(formasDeAcceso, formatos));

        var cambio = UnaRedCompleta(formasDeAcceso, formatos);
        cambio.Descripcion = "Red o centro de documentación con una descripción nueva, escrita para el historial de la organización.";
        cambio.TelefonoRed = "3001112233";
        (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/redes/{red.Id}", cambio)).EnsureSuccessStatusCode();

        var linea = await cliente.GetFromJsonAsync<LineaDeTiempoDelRegistroDto>(
            $"/api/v1/externo/organizaciones/{organizacion}/historial/{Modulos.Redes}/{red.Id}");
        var campos = linea!.Entradas.SelectMany(x => x.Cambios).ToList();
        Assert.Contains(campos, x => x.CampoId == "descripcion");
        // El teléfono es dato de contacto: se guarda, pero la organización no lo lee en el historial.
        Assert.DoesNotContain(campos, x => x.CampoId == "telefonoRed");
    }

    [Fact]
    public async Task Un_cambio_de_fondo_de_una_red_publicada_se_propone_y_el_Programa_lo_aplica()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos, "Red de nombre inicial"));
        await EnviarARevisionAsync(cliente, csrf, red.Id);
        (await DecidirAsync(consola, red.Id, "publicar")).EnsureSuccessStatusCode();

        // LO DE FONDO NO SE ESCRIBE EN CALIENTE: sigue publicada y visible.
        var directo = await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/redes/{red.Id}",
            UnaRedCompleta(formasDeAcceso, formatos, "Red con otro nombre"));
        Assert.Equal(HttpStatusCode.Conflict, directo.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().GetAsync($"/api/v1/publico/redes/{red.Id}")).StatusCode);

        // SE PROPONE, SE ENVIA, SE DECIDE.
        var ruta = $"/api/v1/externo/redes/{red.Id}/propuesta";
        (await EnviarAsync(cliente, csrf, HttpMethod.Put, ruta, new GuardarPropuestaDeCambioSolicitud
        {
            Campos =
            [
                new CampoPropuestoSolicitud { CampoId = "nombre", ValorPropuesto = "Red con otro nombre" },
                new CampoPropuestoSolicitud { CampoId = "formatos", ValorPropuesto = string.Join(',', formatos) },
            ],
        })).EnsureSuccessStatusCode();
        var enviada = await (await EnviarAsync(cliente, csrf, HttpMethod.Post, $"{ruta}/enviar", new { })).Content.ReadFromJsonAsync<PropuestaDeCambioDto>();
        Assert.Equal("en_revision", enviada!.Estado);
        Assert.Single(await consola.GetFromJsonAsync<PropuestaEnRevisionDto[]>("/api/v1/institucional/redes/propuestas/en-revision") ?? []);

        (await consola.PostAsJsonAsync($"/api/v1/institucional/redes/propuestas/{enviada.Id}/decision",
            new DecidirPropuestaDeCambioSolicitud { Decision = "aplicar" })).EnsureSuccessStatusCode();
        var publico = await factory.CreateClient().GetFromJsonAsync<RedPublicaDto>($"/api/v1/publico/redes/{red.Id}");
        Assert.Equal("Red con otro nombre", publico!.Nombre);
    }

    [Fact]
    public async Task Pedir_ajustes_en_la_propuesta_de_una_red_la_devuelve_a_quien_responde_sin_cerrarla()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos, "Red de los ajustes"));
        await EnviarARevisionAsync(cliente, csrf, red.Id);
        (await DecidirAsync(consola, red.Id, "publicar")).EnsureSuccessStatusCode();

        var ruta = $"/api/v1/externo/redes/{red.Id}/propuesta";
        (await EnviarAsync(cliente, csrf, HttpMethod.Put, ruta, new GuardarPropuestaDeCambioSolicitud
        {
            Campos = [new CampoPropuestoSolicitud { CampoId = "nombre", ValorPropuesto = "Red con ajustes" }],
        })).EnsureSuccessStatusCode();
        var enviada = await (await EnviarAsync(cliente, csrf, HttpMethod.Post, $"{ruta}/enviar", new { })).Content.ReadFromJsonAsync<PropuestaDeCambioDto>();

        (await consola.PostAsJsonAsync($"/api/v1/institucional/redes/propuestas/{enviada!.Id}/decision",
            new DecidirPropuestaDeCambioSolicitud { Decision = "pedir_ajustes", Motivo = "Falta el nombre completo." })).EnsureSuccessStatusCode();

        // VUELVE A QUIEN RESPONDE, que la retoma; lo publicado no cambió.
        var devuelta = await cliente.GetFromJsonAsync<PropuestaDeCambioDto>(ruta);
        Assert.Equal("ajustes_solicitados", devuelta!.Estado);
        Assert.Equal("Falta el nombre completo.", devuelta.MotivoDeLaDecision);
        var publico = await factory.CreateClient().GetFromJsonAsync<RedPublicaDto>($"/api/v1/publico/redes/{red.Id}");
        Assert.Equal("Red de los ajustes", publico!.Nombre);
    }

    // ─────────────────────────────────────── Retiro ───────────────────────────────────────

    [Fact]
    public async Task El_responsable_retira_su_red_publicada_con_motivo_y_deja_de_verse()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos));
        await EnviarARevisionAsync(cliente, csrf, red.Id);
        (await DecidirAsync(consola, red.Id, "publicar")).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.BadRequest,
            (await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/redes/{red.Id}/retirar", new { })).StatusCode);
        var retiro = await EnviarAsync(cliente, csrf, HttpMethod.Post, $"/api/v1/externo/redes/{red.Id}/retirar", new { motivo = "Cerré la red." });

        Assert.Equal(HttpStatusCode.OK, retiro.StatusCode);
        Assert.Equal("archivado", (await retiro.Content.ReadFromJsonAsync<RedDto>())!.EstadoRegistro);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync($"/api/v1/publico/redes/{red.Id}")).StatusCode);
    }

    [Fact]
    public async Task La_consola_retira_una_red_publicada_con_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos));
        await EnviarARevisionAsync(cliente, csrf, red.Id);
        (await DecidirAsync(consola, red.Id, "publicar")).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.BadRequest, (await consola.PostAsJsonAsync($"{Redes}/{red.Id}/archivar", new { })).StatusCode);
        var retirado = await consola.PostAsJsonAsync($"{Redes}/{red.Id}/archivar", new { motivo = "Datos de contacto falsos." });

        Assert.Equal(HttpStatusCode.OK, retirado.StatusCode);
        Assert.Equal("archivado", (await retirado.Content.ReadFromJsonAsync<RedDto>())!.EstadoRegistro);
    }

    [Fact]
    public async Task Abandonar_un_borrador_lo_archiva_y_retirar_de_revision_lo_devuelve_a_borrador()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);

        var enRevision = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos, "Uno"));
        await EnviarARevisionAsync(cliente, csrf, enRevision.Id);
        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(cliente, csrf, HttpMethod.Delete, $"/api/v1/externo/redes/{enRevision.Id}")).StatusCode);
        Assert.Equal("borrador", (await cliente.GetFromJsonAsync<RedDto>($"/api/v1/externo/redes/{enRevision.Id}"))!.EstadoRegistro);

        var abandonado = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos, "Dos"));
        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(cliente, csrf, HttpMethod.Delete, $"/api/v1/externo/redes/{abandonado.Id}")).StatusCode);
        // ARCHIVADO NO SE EDITA.
        Assert.Equal(HttpStatusCode.Conflict,
            (await EnviarAsync(cliente, csrf, HttpMethod.Put, $"/api/v1/externo/redes/{abandonado.Id}", UnaRedCompleta(formasDeAcceso, formatos))).StatusCode);
    }

    // ───────────────────────────────────── La consola ─────────────────────────────────────

    [Fact]
    public async Task La_consola_lista_y_filtra_las_redes_por_estado_y_por_tipo_de_responsable()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var (sesionOrganizacion, organizacion, csrfOrganizacion) = await OrganizacionAsync(factory, "Organización documentalista de la lista");
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var deLaPersona = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos, "Red de persona"));
        var deLaOrganizacion = await CrearComoOrganizacionAsync(sesionOrganizacion, csrfOrganizacion, organizacion, UnaRedCompleta(formasDeAcceso, formatos, "Red de organización"));
        await EnviarARevisionAsync(cliente, csrf, deLaPersona.Id);

        var enRevision = await consola.GetFromJsonAsync<PagedResponse<RedDto>>($"{Redes}?estado=en_revision");
        Assert.Contains(enRevision!.Items, t => t.Id == deLaPersona.Id);
        Assert.DoesNotContain(enRevision.Items, t => t.Id == deLaOrganizacion.Id);

        var deOrganizaciones = await consola.GetFromJsonAsync<PagedResponse<RedDto>>($"{Redes}?responsable=organizacion");
        Assert.Contains(deOrganizaciones!.Items, t => t.Id == deLaOrganizacion.Id);
        Assert.DoesNotContain(deOrganizaciones.Items, t => t.Id == deLaPersona.Id);

        // La ficha de la consola sí nombra a quien responde.
        var ficha = await consola.GetFromJsonAsync<RedDto>($"{Redes}/{deLaPersona.Id}");
        Assert.NotNull(ficha!.ResponsableNombre);
    }

    [Fact]
    public async Task Sin_sesion_de_consola_el_modulo_responde_401()
    {
        await using var factory = new TestWebApplicationFactory();

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Redes)).StatusCode);
    }

    [Fact]
    public async Task La_bitacora_registra_los_eventos_del_circuito_con_el_contrato_unico()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, csrf, _) = await ResponsableAsync(factory);
        var consola = await CmsTestClient.LoginAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var red = await CrearComoPersonaAsync(cliente, csrf, UnaRedCompleta(formasDeAcceso, formatos));
        await EnviarARevisionAsync(cliente, csrf, red.Id);
        (await DecidirAsync(consola, red.Id, "publicar")).EnsureSuccessStatusCode();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var lineas = await db.AuditLogs.AsNoTracking()
            .Where(a => a.TableName == "Redes" && a.RecordId == red.Id.ToString(CultureInfo.InvariantCulture))
            .ToListAsync();

        foreach (var evento in new[] { "RedCreada", "RedEnviadaARevision", "RedPublicada" })
        {
            Assert.Contains(lineas, l => l.NewValuesJson != null && l.NewValuesJson.Contains($"\"evento\":\"{evento}\"", StringComparison.Ordinal));
        }
        // La procedencia del registro quedó anotada.
        Assert.True(await db.ProcedenciasDeRegistro.AsNoTracking()
            .AnyAsync(p => p.ModuloId == Modulos.Redes && p.RegistroId == red.Id.ToString(CultureInfo.InvariantCulture)));
    }

    // ─────────────────────── La foto (LUT-02, decisión 120) ───────────────────────

    private static async Task<int> SubirFotoComoResponsableAsync(HttpClient cliente)
    {
        var contenido = new System.Net.Http.MultipartFormDataContent();
        var parte = new ByteArrayContent(Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="));
        parte.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        contenido.Add(parte, "file", "foto.png");
        contenido.Add(new StringContent("Fachada"), "alt");
        var respuesta = await TestigoDelCanalExterno.PostAsync(cliente, "/api/v1/externo/mis-redes/foto", contenido);
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>()).GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task La_foto_solo_es_publica_con_el_registro_publicado_y_no_se_toma_la_de_otra_persona()
    {
        await using var factory = new TestWebApplicationFactory();
        var (duena, csrf, _) = await ResponsableAsync(factory);
        var (otra, csrfOtra, _) = await ResponsableAsync(factory);
        var (formasDeAcceso, formatos) = await CatalogosAsync(factory);
        var anonimo = factory.CreateClient();
        var foto = await SubirFotoComoResponsableAsync(duena);

        var cuerpo = UnaRedCompleta(formasDeAcceso, formatos);
        cuerpo.ArchivoFotoId = foto;
        var creado = await CrearComoPersonaAsync(duena, csrf, cuerpo);
        Assert.Equal(foto, creado.ArchivoFotoId);
        Assert.Equal($"/api/v1/publico/archivos/{foto}", creado.FotoUrl);
        Assert.Equal("Fachada", creado.FotoAlt);

        Assert.Equal(HttpStatusCode.OK, (await duena.GetAsync($"/api/v1/publico/archivos/{foto}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonimo.GetAsync($"/api/v1/publico/archivos/{foto}")).StatusCode);

        await EnviarARevisionAsync(duena, csrf, creado.Id);
        var consola = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.OK, (await DecidirAsync(consola, creado.Id, "publicar")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonimo.GetAsync($"/api/v1/publico/archivos/{foto}")).StatusCode);
        var publico = await anonimo.GetFromJsonAsync<RedPublicaDto>($"/api/v1/publico/redes/{creado.Id}");
        Assert.Equal($"/api/v1/publico/archivos/{foto}", publico!.FotoUrl);

        // La foto de otra persona no se puede apuntar.
        var ajeno = UnaRedCompleta(formasDeAcceso, formatos);
        ajeno.ArchivoFotoId = foto;
        var rechazo = await EnviarAsync(otra, csrfOtra, HttpMethod.Post, "/api/v1/externo/mis-redes", ajeno);
        Assert.Equal(HttpStatusCode.BadRequest, rechazo.StatusCode);
        Assert.Contains("archivoFotoId", await rechazo.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }
}
