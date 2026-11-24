using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Seguimiento de la reclamación de Festivales históricos: históricos que nacen publicados,
/// fusión de duplicados, ficha pública de un histórico (REC-13) y soportes de la solicitud (REC-16).
/// </summary>
/// <remarks>
/// El carril de SQL Server —bitácora, historial y restricciones de la base— está en
/// <see cref="ReclamacionSeguimientoSqlServerTests"/>.
/// </remarks>
public sealed class ReclamacionSeguimientoTests
{
    private const string Clave = "ClaveExterna123";
    private static readonly string[] SoloEcosistema = ["ecosistema"];

    // ---------- Decisión 16: los históricos nacen publicados -------------------------------------

    [Fact]
    public async Task Un_historico_cargado_por_el_webmaster_nace_publicado_se_encuentra_y_su_ficha_dice_que_es_historico()
    {
        await using var factory = new TestWebApplicationFactory();
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var nombre = $"Encuentro Histórico de Tiples {Guid.NewGuid():N}"[..40];
        var alta = await webmaster.PostAsJsonAsync("/api/v1/admin/festivales", new
        {
            festival = new { nombre, nivelCobertura = "municipal", codigoDepartamento = "05", codigoMunicipio = "05001", practicasMusicalesIds = Array.Empty<int>(), territoriosSonorosIds = Array.Empty<int>() },
            organizacionResponsableId = (int?)null,
        });
        Assert.Equal(HttpStatusCode.Created, alta.StatusCode);
        var creado = await alta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("publicado", creado.GetProperty("estado").GetString());
        var id = creado.GetProperty("id").GetString()!;

        // SE ENCUENTRA DESDE EL PRIMER DÍA: «¿Tu Festival ya está en SIMUS?» del departamento de la sede.
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "nace.publicado@example.com");
        var historicos = await cliente.GetFromJsonAsync<HistoricosReclamablesDto>($"/api/v1/externo/organizaciones/{organizacionId}/festivales/historicos");
        Assert.Contains(historicos!.Festivales, x => x.FestivalId == id);

        // REC-13: la ficha pública no le atribuye el Festival al Programa.
        var ficha = await factory.CreateClient().GetFromJsonAsync<FestivalPublicoDto>($"/api/v1/publico/festivales/{id}");
        Assert.True(ficha!.EsRegistroHistorico);
        Assert.Null(ficha.OrganizacionResponsable);
        Assert.Null(ficha.OrganizacionPublicaId);

        // EL HISTORIAL DICE POR QUÉ ESTÁ PUBLICADO SIN HABER PASADO POR LA BANDEJA.
        var historial = await webmaster.GetFromJsonAsync<JsonElement>($"/api/v1/institucional/festivales/{id}/historial");
        Assert.Contains(historial.EnumerateArray(), x => x.GetProperty("accion").GetString() == "RegistroHistoricoPublicadoAlCargarse");

        // UN FESTIVAL CON ORGANIZACIÓN SIGUE NACIENDO EN BORRADOR.
        var conOrganizacion = await webmaster.PostAsJsonAsync("/api/v1/admin/festivales", new
        {
            festival = new { nombre = nombre + " B", nivelCobertura = "nacional", sedeCodigoDepartamento = "05", sedeCodigoMunicipio = "05001", practicasMusicalesIds = Array.Empty<int>(), territoriosSonorosIds = Array.Empty<int>() },
            organizacionResponsableId = organizacionId,
        });
        Assert.Equal("borrador", (await conOrganizacion.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());
    }

    [Fact]
    public async Task Importar_Festivales_es_del_modulo_Ecosistema()
    {
        await using var factory = new TestWebApplicationFactory();
        var (gestorId, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);

        // DECISIÓN 17: sin el módulo Ecosistema, la puerta está cerrada aunque se escriba la ruta.
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync("/api/v1/admin/importaciones/festivales/")).StatusCode);

        var webmaster = await CmsTestClient.LoginAsync(factory);
        (await webmaster.PutAsJsonAsync($"/api/v1/admin/usuarios/{gestorId}/modulos", new { modulos = SoloEcosistema })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync("/api/v1/admin/importaciones/festivales/")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await webmaster.GetAsync("/api/v1/admin/importaciones/festivales/")).StatusCode);
    }

    // ---------- Decisión 18: fusionar duplicados -------------------------------------------------

    [Fact]
    public async Task Fusionar_lleva_ediciones_reclamacion_e_historia_al_que_se_conserva_y_el_absorbido_redirige()
    {
        await using var factory = new TestWebApplicationFactory();
        var conservado = await HistoricoAsync(factory, "Muestra Andina de Cuerdas", ediciones: [2018, 2019], correo: null);
        var absorbido = await HistoricoAsync(factory, "Muestra Andina de Cuerdas", ediciones: [2020], correo: "cuerdas@historico.test", practica: true);
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "fusion.cuerdas@example.com");
        var reclamacion = await IdDeAsync(await ReclamarAsync(cliente, organizacionId, absorbido));

        var webmaster = await CmsTestClient.LoginAsync(factory);
        var candidatos = await webmaster.GetFromJsonAsync<CandidatosDeFusionDto>($"/api/v1/admin/festivales/{conservado}/fusion/candidatos");
        Assert.Null(candidatos!.CodigoBloqueo);
        var candidato = Assert.Single(candidatos.Candidatos, x => x.Id == absorbido.ToString(CultureInfo.InvariantCulture));
        Assert.Null(candidato.CodigoBloqueo);
        Assert.Equal("enviada", candidato.ReclamacionAbiertaEstado);
        Assert.False(string.IsNullOrWhiteSpace(candidato.RazonDelParecido));

        var fusion = await webmaster.PostAsJsonAsync($"/api/v1/admin/festivales/{conservado}/fusion",
            new { absorbidoId = absorbido.ToString(CultureInfo.InvariantCulture), motivo = "Dos fuentes del mismo Festival de Manizales." });
        Assert.Equal(HttpStatusCode.OK, fusion.StatusCode);
        var resultado = await fusion.Content.ReadFromJsonAsync<ResultadoDeFusionDto>();
        Assert.Equal(1, resultado!.Ediciones);
        Assert.Equal(1, resultado.Reclamaciones);
        Assert.Equal(1, resultado.Clasificaciones);
        Assert.Contains("Correo de contacto", resultado.DatosCompletados);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            Assert.Equal(3, await db.EdicionesFestival.CountAsync(x => x.FestivalId == conservado));
            var viejo = await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == absorbido);
            Assert.Equal("archivado", viejo.StatusCode);
            Assert.Equal(conservado, viejo.FusionadoEnId);
            Assert.NotNull(viejo.FechaFusion);
            Assert.Equal("cuerdas@historico.test", (await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == conservado)).ContactEmail);
            Assert.Equal(conservado.ToString(CultureInfo.InvariantCulture),
                (await db.AdministrationClaims.AsNoTracking().SingleAsync(x => x.Id == long.Parse(reclamacion, CultureInfo.InvariantCulture))).CanonicalRecordId);
            Assert.Equal(2, await db.AuditLogs.CountAsync(x => x.TableName == "Festivales"
                && (x.RecordId == conservado.ToString(CultureInfo.InvariantCulture) || x.RecordId == absorbido.ToString(CultureInfo.InvariantCulture))
                && x.NewValuesJson!.Contains("FestivalHistorico")));
        }

        // LA FICHA PÚBLICA DEL ABSORBIDO LLEVA A LA QUE SE CONSERVÓ.
        var publica = await factory.CreateClient().GetFromJsonAsync<FestivalPublicoDto>($"/api/v1/publico/festivales/{absorbido}");
        Assert.Equal(conservado.ToString(CultureInfo.InvariantCulture), publica!.Id);

        // LA HISTORIA DEL ABSORBIDO SE LEE EN LA DEL QUE SE CONSERVA, y la ficha dice qué absorbió.
        var historial = await webmaster.GetFromJsonAsync<JsonElement>($"/api/v1/institucional/festivales/{conservado}/historial");
        Assert.Contains(historial.EnumerateArray(), x => x.GetProperty("accion").GetString() == "FestivalFusionadoEnOtro");
        Assert.Contains(historial.EnumerateArray(), x => x.GetProperty("accion").GetString() == "FestivalAbsorbioUnDuplicado");
        var ficha = await webmaster.GetFromJsonAsync<FichaFestivalAdministrativaDto>($"/api/v1/admin/festivales/{conservado}");
        Assert.True(ficha!.EsRegistroHistorico);
        Assert.Contains(ficha.Absorbidos!, x => x.Id == absorbido.ToString(CultureInfo.InvariantCulture));
        var fichaVieja = await webmaster.GetFromJsonAsync<FichaFestivalAdministrativaDto>($"/api/v1/admin/festivales/{absorbido}");
        Assert.Equal(conservado.ToString(CultureInfo.InvariantCulture), fichaVieja!.FusionadoEnId);

        // EL ABSORBIDO YA NO SE PROPONE COMO «POSIBLE DUPLICADO» en el detalle de la solicitud (M2).
        var detalle = await webmaster.GetFromJsonAsync<DetalleReclamacionAdministracionDto>($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}");
        Assert.DoesNotContain(detalle!.Relacionadas, x => x.FestivalId == absorbido.ToString(CultureInfo.InvariantCulture));

        // LA SOLICITUD SIGUE VIVA Y SE DECIDE SOBRE EL QUE SE CONSERVA, con todas sus ediciones.
        var decision = await webmaster.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "aprobar" });
        Assert.Equal("transferencia_ejecutada", (await decision.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            Assert.Equal(organizacionId, (await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == conservado)).OrganizacionPrincipalId);
        }
    }

    [Fact]
    public async Task La_fusion_no_permite_los_casos_limite_y_explica_que_hacer()
    {
        await using var factory = new TestWebApplicationFactory();
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var uno = await HistoricoAsync(factory, "Festival del Pasillo Andino");
        var dos = await HistoricoAsync(factory, "Festival del Pasillo Andino");

        // SOLO EL WEBMASTER.
        var (_, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PostAsJsonAsync($"/api/v1/admin/festivales/{uno}/fusion", new { absorbidoId = dos.ToString(CultureInfo.InvariantCulture), motivo = "x" })).StatusCode);

        // CONSIGO MISMO Y SIN MOTIVO, NO.
        Assert.Equal(HttpStatusCode.BadRequest, (await FusionarAsync(webmaster, uno, uno, "El mismo.")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await FusionarAsync(webmaster, uno, dos, " ")).StatusCode);

        // LAS DOS COPIAS CON SOLICITUDES ABIERTAS: la fusión no elige entre organizaciones.
        var (primera, primeraId) = await OrganizacionAsync(factory, "pasillo.uno@example.com");
        var (segunda, segundaId) = await OrganizacionAsync(factory, "pasillo.dos@example.com");
        await IdDeAsync(await ReclamarAsync(primera, primeraId, uno));
        var deLaSegunda = await IdDeAsync(await ReclamarAsync(segunda, segundaId, dos));
        await EsperarCodigoAsync(await FusionarAsync(webmaster, uno, dos, "Mismo Festival."), "dos_reclamaciones_abiertas");
        var candidatos = await webmaster.GetFromJsonAsync<CandidatosDeFusionDto>($"/api/v1/admin/festivales/{uno}/fusion/candidatos");
        Assert.Equal("dos_reclamaciones_abiertas", Assert.Single(candidatos!.Candidatos, x => x.Id == dos.ToString(CultureInfo.InvariantCulture)).CodigoBloqueo);

        // UNA YA CON ORGANIZACIÓN: se aprueba la segunda y la copia deja de ser histórica.
        Assert.Equal(HttpStatusCode.OK, (await webmaster.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{deLaSegunda}/decision", new { accion = "aprobar" })).StatusCode);
        await EsperarCodigoAsync(await FusionarAsync(webmaster, uno, dos, "Mismo Festival."), "tiene_organizacion");
        await EsperarCodigoAsync(await FusionarAsync(webmaster, dos, uno, "Mismo Festival."), "tiene_organizacion");

        // CONCILIACIÓN A MEDIAS: la aprobada espera a que la organización elija.
        var tres = await HistoricoAsync(factory, "Festival de Música Carranguera");
        var cuatro = await HistoricoAsync(factory, "Festival de Música Carranguera");
        var (tercera, terceraId) = await OrganizacionAsync(factory, "carranguera@example.com");
        var borrador = await tercera.GetFromJsonAsync<BorradorProcesoDto>($"/api/v1/externo/organizaciones/{terceraId}/festivales/borrador");
        await PutAsync(tercera, $"/api/v1/externo/borradores-proceso/{borrador!.Id}",
            new { datosJson = JsonSerializer.Serialize(new { descripcion = "Otra descripción." }), version = borrador.Version });
        var conciliable = await IdDeAsync(await EnviarAsync(tercera, $"/api/v1/externo/organizaciones/{terceraId}/reclamaciones-administracion",
            new { festivalId = cuatro.ToString(CultureInfo.InvariantCulture), borradorId = borrador.Id, justificacion = "Es nuestro." }));
        Assert.Equal("aprobada", (await (await webmaster.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{conciliable}/decision", new { accion = "aprobar" }))
            .Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());
        await EsperarCodigoAsync(await FusionarAsync(webmaster, tres, cuatro, "Mismo Festival."), "conciliacion_pendiente");

        // YA FUSIONADO: no se vuelve a fusionar.
        var cinco = await HistoricoAsync(factory, "Festival Bandola y Requinto");
        var seis = await HistoricoAsync(factory, "Festival Bandola y Requinto");
        Assert.Equal(HttpStatusCode.OK, (await FusionarAsync(webmaster, cinco, seis, "Mismo Festival.")).StatusCode);
        await EsperarCodigoAsync(await FusionarAsync(webmaster, cinco, seis, "Otra vez."), "ya_fusionado");
        await EsperarCodigoAsync(await FusionarAsync(webmaster, seis, cinco, "Al revés."), "ya_fusionado");
    }

    // ---------- REC-16: soportes de la solicitud -------------------------------------------------

    [Fact]
    public async Task La_solicitud_lleva_soportes_del_banco_que_ven_la_organizacion_y_la_consola()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival de Tambores del Norte");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "soportes@example.com");
        var (otra, _) = await OrganizacionAsync(factory, "soportes.ajena@example.com");
        var acta = await SubirPdfAsync(cliente, "acta-2019.pdf");
        var ajeno = await SubirPdfAsync(otra, "ajeno.pdf");

        // UN ARCHIVO DE OTRA ORGANIZACIÓN NO SE ADJUNTA.
        var conAjeno = await EnviarAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = historico.ToString(CultureInfo.InvariantCulture), justificacion = "Es nuestro.", soportes = new[] { ajeno } });
        Assert.Equal(HttpStatusCode.BadRequest, conAjeno.StatusCode);

        var creada = await EnviarAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = historico.ToString(CultureInfo.InvariantCulture), justificacion = "Es nuestro.", soportes = new[] { acta } });
        var reclamacion = await IdDeAsync(creada);

        var propias = await cliente.GetFromJsonAsync<List<ReclamacionAdministracionDto>>($"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion");
        var soporte = Assert.Single(Assert.Single(propias!).Soportes!);
        Assert.Equal("acta-2019.pdf", soporte.Nombre);
        Assert.Equal("application/pdf", soporte.Tipo);

        // LA CONSOLA LO VE EN EL DETALLE Y LO DESCARGA; NADIE MÁS.
        var webmaster = await CmsTestClient.LoginAsync(factory);
        var detalle = await webmaster.GetFromJsonAsync<DetalleReclamacionAdministracionDto>($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}");
        Assert.Equal(acta, Assert.Single(detalle!.Reclamacion.Soportes!).ArchivoId);
        Assert.Equal(HttpStatusCode.OK, (await webmaster.GetAsync(soporte.Url)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await cliente.GetAsync(soporte.Url)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync(soporte.Url)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otra.GetAsync(soporte.Url)).StatusCode);

        // MIENTRAS LA SOLICITUD LO CITE, NO SE RETIRA DEL BANCO.
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var retiro = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/externo/archivos/{acta}");
        retiro.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await cliente.SendAsync(retiro)).StatusCode);

        // UNA ACLARACIÓN SE RESPONDE CON OTRO SOPORTE.
        Assert.Equal(HttpStatusCode.OK, (await webmaster.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/aclaraciones", new { respuesta = "Adjunta el certificado." })).StatusCode);
        var certificado = await SubirPdfAsync(cliente, "certificado.pdf");
        var respuesta = await EnviarAsync(cliente, $"/api/v1/externo/reclamaciones-administracion/{reclamacion}/aclaraciones/responder",
            new { respuesta = "Aquí está.", soportes = new[] { certificado } });
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Equal(2, (await respuesta.Content.ReadFromJsonAsync<ReclamacionAdministracionDto>())!.Soportes!.Count);
    }

    // ---------- D3-02 y D3-03: lo que la organización lee de la decisión -------------------------

    [Fact]
    public async Task La_organizacion_lee_la_pregunta_de_la_aclaracion_y_el_motivo_del_rechazo_en_la_lista_y_en_el_aviso()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival del Tiple de Prueba");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "pregunta@example.com");
        var reclamacion = await IdDeAsync(await ReclamarAsync(cliente, organizacionId, historico));
        var webmaster = await CmsTestClient.LoginAsync(factory);

        // ANTES LEÍA «NECESITA UNA ACLARACIÓN» SIN SABER CUÁL: la pregunta viaja en la lista y en el aviso.
        const string pregunta = "Adjunta el acta de la edición 2018.";
        Assert.Equal(HttpStatusCode.OK, (await webmaster.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/aclaraciones", new { respuesta = pregunta })).StatusCode);
        var propias = await cliente.GetFromJsonAsync<List<ReclamacionAdministracionDto>>($"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion");
        Assert.Equal(pregunta, Assert.Single(propias!).AclaracionPendiente);
        Assert.Contains(await CuerposDeAvisosAsync(cliente), x => x.Contains(pregunta, StringComparison.Ordinal));

        // RESPONDIDA, YA NO HAY NADA PENDIENTE.
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(cliente, $"/api/v1/externo/reclamaciones-administracion/{reclamacion}/aclaraciones/responder",
            new { respuesta = "Aquí está el acta." })).StatusCode);
        propias = await cliente.GetFromJsonAsync<List<ReclamacionAdministracionDto>>($"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion");
        Assert.Null(Assert.Single(propias!).AclaracionPendiente);

        // EL MOTIVO DEL RECHAZO LLEGA A LA ORGANIZACIÓN, AUNQUE SEA LARGO: el aviso admite 2000 caracteres
        // y el motivo hasta 2400; antes un motivo largo rompía la decisión en SQL Server.
        var motivo = "No se acredita la relación con el Festival. " + new string('x', 2300);
        Assert.Equal(HttpStatusCode.OK, (await webmaster.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "rechazar", motivo })).StatusCode);
        propias = await cliente.GetFromJsonAsync<List<ReclamacionAdministracionDto>>($"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion");
        var rechazada = Assert.Single(propias!);
        Assert.Equal("rechazada", rechazada.Estado);
        Assert.StartsWith("No se acredita la relación con el Festival.", rechazada.MotivoDecision, StringComparison.Ordinal);
        var avisos = await CuerposDeAvisosAsync(cliente);
        var aviso = Assert.Single(avisos, x => x.StartsWith("«Festival del Tiple de Prueba»: No se acredita", StringComparison.Ordinal));
        Assert.True(aviso.Length <= 2000, $"El aviso mide {aviso.Length} y la columna admite 2000.");
    }

    private static async Task<List<string>> CuerposDeAvisosAsync(HttpClient cliente)
    {
        var buzon = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/notificaciones?ambito=externo");
        return buzon.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("body").GetString() ?? string.Empty).ToList();
    }

    // ---------- Andamio ------------------------------------------------------------------------

    internal static byte[] PdfMinimo(string marca) =>
        Encoding.ASCII.GetBytes($"%PDF-1.4\n% {marca} {Guid.NewGuid():N}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

    private static async Task<string> SubirPdfAsync(HttpClient cliente, string nombre)
    {
        using var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(PdfMinimo(nombre));
        parte.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        contenido.Add(parte, "file", nombre);
        var respuesta = await TestigoDelCanalExterno.PostAsync(cliente, "/api/v1/externo/archivos/documentos", contenido);
        Assert.True(respuesta.StatusCode == HttpStatusCode.Created, $"Subir el PDF respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
        return (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32().ToString(CultureInfo.InvariantCulture);
    }

    private static Task<HttpResponseMessage> FusionarAsync(HttpClient webmaster, int conservado, int absorbido, string motivo) =>
        webmaster.PostAsJsonAsync($"/api/v1/admin/festivales/{conservado}/fusion",
            new { absorbidoId = absorbido.ToString(CultureInfo.InvariantCulture), motivo });

    private static async Task EsperarCodigoAsync(HttpResponseMessage respuesta, string codigo)
    {
        var cuerpo = await respuesta.Content.ReadAsStringAsync();
        Assert.True(respuesta.StatusCode == HttpStatusCode.Conflict, $"Se esperaba 409 «{codigo}» y llegó {(int)respuesta.StatusCode}: {cuerpo}");
        using var json = JsonDocument.Parse(cuerpo);
        Assert.Equal(codigo, json.RootElement.GetProperty("codigo").GetString());
        Assert.False(string.IsNullOrWhiteSpace(json.RootElement.GetProperty("message").GetString()));
    }

    private static async Task<int> HistoricoAsync(TestWebApplicationFactory factory, string nombre, int[]? ediciones = null, string? correo = null, bool practica = false)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
        var festival = new FestivalRow
        {
            Name = nombre, Description = "Registro histórico de prueba.", CoverageLevel = "municipal",
            DepartmentCode = "05", MunicipalityCode = "05001", StatusCode = "publicado", OrganizacionPrincipalId = institucional,
            ContactEmail = correo, CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();
        foreach (var anio in ediciones ?? [])
            db.EdicionesFestival.Add(new EdicionFestivalRow { FestivalId = festival.Id, Anio = anio, Nombre = $"Edición {anio}", Estado = "realizada", EstadoRegistro = "publicado", EstadoVisibilidad = "publicada", FechaCreacion = DateTime.UtcNow });
        if (practica)
        {
            var practicaId = await db.PracticasMusicales.Select(x => x.Id).FirstAsync();
            db.Agregar<PracticaMusicalDeRegistroRow>(Modulos.Festivales, festival.Id, [practicaId], DateTime.UtcNow);
        }
        await db.SaveChangesAsync();
        return festival.Id;
    }

    internal static async Task<(HttpClient Cliente, int OrganizacionId)> OrganizacionAsync(TestWebApplicationFactory factory, string correo)
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

    private static Task<HttpResponseMessage> ReclamarAsync(HttpClient cliente, int organizacionId, int festivalId) =>
        EnviarAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = festivalId.ToString(CultureInfo.InvariantCulture), justificacion = "Organizamos este Festival desde hace años." });

    private static async Task<string> IdDeAsync(HttpResponseMessage respuesta)
    {
        Assert.True(respuesta.StatusCode == HttpStatusCode.Created, $"Se esperaba 201 y llegó {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
        return (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
    }

    private static async Task PutAsync(HttpClient cliente, string ruta, object cuerpo)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(HttpMethod.Put, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        (await cliente.SendAsync(mensaje)).EnsureSuccessStatusCode();
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient client, string ruta, object cuerpo)
    {
        var testigo = await client.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await client.SendAsync(mensaje);
    }
}
