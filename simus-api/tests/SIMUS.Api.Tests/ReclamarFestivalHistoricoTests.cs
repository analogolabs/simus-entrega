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
/// Reclamar la administración de un Festival histórico sin organización.
/// </summary>
/// <remarks>
/// El recorrido completo contra SQL Server está en <see cref="ReclamarFestivalHistoricoSqlServerTests"/>:
/// aquí se cubren las reglas que no dependen del motor —parecido de nombres, descubrimiento,
/// borrador congelado, transferencia inmediata, conciliación, detalle de la consola y quién puede
/// cargar un histórico—.
/// </remarks>
public sealed class ReclamarFestivalHistoricoTests
{
    private const string Clave = "ClaveExterna123";

    // ---------- Parecido de nombres (REC-06) -----------------------------------------------------

    [Theory]
    [InlineData("Festival del Bambuco", "Festival Nacional del Bambuco")]
    [InlineData("Festival Folclórico de la Chirimía", "Festival de la Chirimía")]
    [InlineData("Festival Folclórico de la Chirimía", "festival folclorico de chirimia")]
    [InlineData("Festival Sonidos del Huila", "Fest. Sonidos Huila")]
    [InlineData("Festival Sonidos del Huila", "Sonidos del Huila")]
    [InlineData("Muestra Andina de Cuerdas", "Muestra de Cuerdas Andinas")]
    // M2: el año, la edición y el alcance no distinguen un Festival de otro.
    [InlineData("Festival del Bambuco", "XXV Festival Nacional del Bambuco 2019")]
    [InlineData("Festival del Bambuco", "25.º Festival del Bambuco")]
    [InlineData("Festival del Bambuco", "Festival Internacional del Bambuco - Edición 12")]
    // M2: faltas de ortografía comunes en las fuentes históricas.
    [InlineData("Festival del Bambuco", "Festival del Bambuko")]
    [InlineData("Festival de Cuerdas de Zipaquirá", "Festival de Cuerdas de Sipaquira")]
    [InlineData("Encuentro de Tambores y Voces del Pacífico", "Encuentro de Tambor y Voz del Pacifico")]
    [InlineData("Festival Folclórico de Villavicencio", "Festival Folklorico de Villavisencio")]
    // D3-01: lo que distingue sigue distinguiendo aunque la palabra «música» acompañe.
    [InlineData("Festival de Música Andina de Neiva", "Música Andina Neiva")]
    [InlineData("Festival de la Música", "festival de la musica")]
    public void Variantes_de_un_mismo_nombre_se_parecen(string historico, string escrito) =>
        Assert.True(ParecidoDeNombres.SeParecen(historico, escrito), $"«{escrito}» debería parecerse a «{historico}»");

    [Theory]
    [InlineData("Festival del Bambuco", "Festival")]
    [InlineData("Festival del Bambuco", "Festival de Rock al Parque")]
    [InlineData("Muestra Andina de Cuerdas", "Zurrapastro Quimbayalde")]
    [InlineData("Festival Sonidos del Huila", "")]
    // M2: «nacional», «2019» o «XXV» solos no distinguen a nadie.
    [InlineData("Festival Nacional de Danza", "Festival Nacional de Teatro")]
    [InlineData("Festival del Bambuco", "Festival Nacional")]
    [InlineData("Festival del Bambuco", "XXV Festival 2019")]
    // D3-01: «música» o «cultural» solas tampoco distinguen: todos los Festivales del Programa lo son.
    [InlineData("Festival de Músicas Urbanas, Alternativas e Independientes - MUAI de Baraya", "Festival de la Música")]
    [InlineData("Festival Cultural del Pacífico", "Festival Cultural")]
    public void Nombres_distintos_o_genericos_no_se_parecen(string historico, string escrito) =>
        Assert.False(ParecidoDeNombres.SeParecen(historico, escrito), $"«{escrito}» no debería parecerse a «{historico}»");

    [Theory]
    [InlineData("ReclamacionEnviada")]
    [InlineData("AclaracionSolicitada")]
    [InlineData("AclaracionRespondida")]
    [InlineData("ReclamacionCancelada")]
    [InlineData("ReclamacionRechazada")]
    [InlineData("ReclamacionAprobadaPendienteConciliacion")]
    [InlineData("TransferenciaAdministracionEjecutada")]
    public void Cada_evento_se_audita_con_un_verbo_que_la_base_admite(string evento) =>
        // REC-02: el nombre del evento iba en `Accion` y CK_BitacoraAuditoria_Accion lo rechazaba.
        Assert.Contains(ReclamacionesAdministracionEndpoints.VerboDeAuditoria(evento), AccionesAuditoria.Admitidos);

    // ---------- Descubrimiento (REC-05, REC-06, REC-09) -----------------------------------------

    [Fact]
    public async Task Las_coincidencias_encuentran_variantes_y_otros_municipios_y_avisan_de_una_solicitud_en_curso()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival del Bambuco", municipio: "05088");
        var (primera, organizacionUno) = await OrganizacionAsync(factory, "bambuco.uno@example.com");

        var antes = await CoincidenciasAsync(primera, organizacionUno, "Festival Nacional del Bambuco");
        var encontrada = Assert.Single(antes, x => x.FestivalId == historico.ToString(CultureInfo.InvariantCulture));
        Assert.Equal("HistoricoReclamable", encontrada.TipoCoincidencia);
        Assert.False(encontrada.ReclamacionEnCurso);
        // EL MUNICIPIO YA NO FILTRA: la organización escribe 05001 y el histórico está en 05088.
        Assert.Contains(encontrada.Evidencias, x => x.Contains("otro municipio", StringComparison.OrdinalIgnoreCase)
            || x.Contains("sin municipio", StringComparison.OrdinalIgnoreCase));

        Assert.Equal(HttpStatusCode.Created, (await ReclamarAsync(primera, organizacionUno, historico)).StatusCode);

        var (segunda, organizacionDos) = await OrganizacionAsync(factory, "bambuco.dos@example.com");
        var despues = Assert.Single(await CoincidenciasAsync(segunda, organizacionDos, "Festival del Bambuco"),
            x => x.FestivalId == historico.ToString(CultureInfo.InvariantCulture));
        Assert.True(despues.ReclamacionEnCurso);

        var conflicto = await ReclamarAsync(segunda, organizacionDos, historico);
        Assert.Equal(HttpStatusCode.Conflict, conflicto.StatusCode);
        Assert.Equal("reclamacion_activa", (await conflicto.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());
    }

    [Fact]
    public void El_parecido_explica_por_que_dos_nombres_se_parecen()
    {
        Assert.Equal("Es el mismo nombre.", ParecidoDeNombres.Razon("Festival del Bambuco", "festival del bambuco"));
        var contenido = ParecidoDeNombres.Razon("Festival Folclórico de la Chirimía", "Festival de la Chirimía");
        Assert.NotNull(contenido);
        Assert.Contains("chirimia", contenido, StringComparison.Ordinal);
        Assert.Null(ParecidoDeNombres.Razon("Festival del Bambuco", "Festival de Rock al Parque"));
    }

    [Fact]
    public async Task Las_coincidencias_incluyen_el_Festival_registrado_sin_departamento_y_no_el_fusionado()
    {
        await using var factory = new TestWebApplicationFactory();
        var nacional = await HistoricoAsync(factory, "Festival de la Chirimía del Pacífico", departamento: null, municipio: null);
        var absorbido = await HistoricoAsync(factory, "Festival de la Chirimía del Pacífico", municipio: "05088");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.FestivalRecords.SingleAsync(x => x.Id == absorbido);
            fila.StatusCode = "archivado"; fila.FusionadoEnId = nacional; fila.FechaFusion = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "chirimia.nacional@example.com");

        var encontradas = await CoincidenciasAsync(cliente, organizacionId, "Festival de Chirimía del Pacífico");
        // EL DE ALCANCE NACIONAL ANTES NUNCA APARECÍA: la búsqueda filtraba por el departamento.
        Assert.Contains(encontradas, x => x.FestivalId == nacional.ToString(CultureInfo.InvariantCulture));
        // EL QUE YA SE FUSIONÓ NO ES UN DUPLICADO QUE REVISAR.
        Assert.DoesNotContain(encontradas, x => x.FestivalId == absorbido.ToString(CultureInfo.InvariantCulture));
        Assert.Contains(encontradas.Single(x => x.FestivalId == nacional.ToString(CultureInfo.InvariantCulture)).Evidencias,
            x => x.Contains("palabras", StringComparison.OrdinalIgnoreCase) || x.Contains("mismo nombre", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task La_lista_de_historicos_parte_del_departamento_de_la_sede_y_busca_por_nombre()
    {
        await using var factory = new TestWebApplicationFactory();
        var propio = await HistoricoAsync(factory, "Encuentro de Tiples del Valle de Aburrá", departamento: "05", municipio: "05001");
        var ajeno = await HistoricoAsync(factory, "Festival de Cuerdas del Llano", departamento: "50", municipio: "50001");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "lista.historicos@example.com");

        var porSede = await cliente.GetFromJsonAsync<HistoricosReclamablesDto>($"/api/v1/externo/organizaciones/{organizacionId}/festivales/historicos");
        Assert.Equal("05", porSede!.CodigoDepartamento);
        Assert.Contains(porSede.Festivales, x => x.FestivalId == propio.ToString(CultureInfo.InvariantCulture));
        Assert.DoesNotContain(porSede.Festivales, x => x.FestivalId == ajeno.ToString(CultureInfo.InvariantCulture));

        var enTodoElPais = await cliente.GetFromJsonAsync<HistoricosReclamablesDto>(
            $"/api/v1/externo/organizaciones/{organizacionId}/festivales/historicos?codigoDepartamento=todos&buscar=cuerda%20llano");
        Assert.Contains(enTodoElPais!.Festivales, x => x.FestivalId == ajeno.ToString(CultureInfo.InvariantCulture));
        Assert.DoesNotContain(enTodoElPais.Festivales, x => x.FestivalId == propio.ToString(CultureInfo.InvariantCulture));
    }

    // ---------- Reclamar, decidir, conciliar ---------------------------------------------------

    [Fact]
    public async Task Reclamar_congela_el_borrador_y_la_siguiente_alta_empieza_otro()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival Brisas del Río");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "borrador.congelado@example.com");
        var borrador = await BorradorAsync(cliente, organizacionId);
        await GuardarBorradorAsync(cliente, borrador, new { nombre = "Festival Brisas del Río", descripcion = "La nuestra." });

        Assert.Equal(HttpStatusCode.Created, (await ReclamarAsync(cliente, organizacionId, historico, borrador.Id)).StatusCode);

        // REC-03: el asistente recuperaba el mismo borrador y escribía el Festival siguiente encima.
        var siguiente = await BorradorAsync(cliente, organizacionId);
        Assert.NotEqual(borrador.Id, siguiente.Id);
        Assert.Equal("{}", siguiente.DatosJson);
    }

    [Fact]
    public async Task Sin_nada_que_conciliar_aprobar_transfiere_de_inmediato_con_sus_ediciones()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival de Gaitas del Sur", conEdiciones: true);
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "transferencia.directa@example.com");
        var reclamacion = await IdDeAsync(await ReclamarAsync(cliente, organizacionId, historico));

        var consola = await CmsTestClient.LoginAsync(factory);
        var decision = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "aprobar" });
        Assert.Equal(HttpStatusCode.OK, decision.StatusCode);
        Assert.Equal("transferencia_ejecutada", (await decision.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        Assert.Equal(organizacionId, (await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == historico)).OrganizacionPrincipalId);
        Assert.Equal(2, await db.EdicionesFestival.CountAsync(x => x.FestivalId == historico));
        Assert.True(await db.AdministrationTransfers.AnyAsync(x => x.CanonicalRecordId == historico.ToString(CultureInfo.InvariantCulture)));
        // Y LA ORGANIZACIÓN LO VE EN SU LISTA.
        var mios = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacionId}/festivales");
        Assert.Contains(mios.EnumerateArray(), x => x.GetProperty("id").GetString() == historico.ToString(CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task Con_datos_distintos_la_consola_los_ve_y_la_organizacion_elige_lo_que_conserva()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival de Bandas de la Montaña", periodicidad: "anual", correo: "historico@ejemplo.test");
        var duplicado = await HistoricoAsync(factory, "Festival de Bandas de la Montaña", municipio: "05088");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "conciliacion@example.com");
        var borrador = await BorradorAsync(cliente, organizacionId);
        await GuardarBorradorAsync(cliente, borrador, new
        {
            nombre = "Festival de Bandas de la Montaña",
            descripcion = "Encuentro de bandas que organizamos desde 2012.",
            correoContacto = "nuevo@ejemplo.test",
            periodicidad = "",
        });
        var reclamacion = await IdDeAsync(await ReclamarAsync(cliente, organizacionId, historico, borrador.Id));

        var consola = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.OK, (await consola.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/aclaraciones", new { respuesta = "¿Tienen un acta?" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(cliente,
            $"/api/v1/externo/reclamaciones-administracion/{reclamacion}/aclaraciones/responder", new { respuesta = "Sí, la de 2019." })).StatusCode);

        // REC-07: lo que la consola necesita para decidir.
        var detalle = await consola.GetFromJsonAsync<DetalleReclamacionAdministracionDto>($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}");
        Assert.True(detalle!.Festival.SinOrganizacion);
        Assert.Equal("Sí, la de 2019.", Assert.Single(detalle.Aclaraciones).Respuesta);
        Assert.Contains(detalle.Comparacion, x => x.Campo == "Description" && x.Etiqueta == "Descripción");
        Assert.Contains(detalle.Comparacion, x => x.Campo == "ContactEmail" && x.Propuesto == "nuevo@ejemplo.test");
        // Un valor vacío del borrador no es una propuesta de borrar el dato histórico.
        Assert.DoesNotContain(detalle.Comparacion, x => x.Campo == "Periodicidad");
        Assert.Contains(detalle.Relacionadas, x => x.FestivalId == duplicado.ToString(CultureInfo.InvariantCulture));

        var decision = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "aprobar" });
        Assert.Equal("aprobada", (await decision.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());

        // SOLO SE ELIGE LA DESCRIPCIÓN: lo que no se elige se conserva del histórico.
        var resuelta = await EnviarAsync(cliente, $"/api/v1/externo/reclamaciones-administracion/{reclamacion}/conciliacion/resolver",
            new { selecciones = new Dictionary<string, string> { ["Description"] = "borrador" } });
        Assert.Equal(HttpStatusCode.OK, resuelta.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var festival = await db.FestivalRecords.AsNoTracking().SingleAsync(x => x.Id == historico);
        Assert.Equal(organizacionId, festival.OrganizacionPrincipalId);
        Assert.Equal("Encuentro de bandas que organizamos desde 2012.", festival.Description);
        Assert.Equal("historico@ejemplo.test", festival.ContactEmail);
        Assert.Equal("anual", festival.Periodicidad);
    }

    [Fact]
    public async Task Rechazar_exige_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var historico = await HistoricoAsync(factory, "Festival del Viento");
        var (cliente, organizacionId) = await OrganizacionAsync(factory, "rechazo.motivo@example.com");
        var reclamacion = await IdDeAsync(await ReclamarAsync(cliente, organizacionId, historico));
        var consola = await CmsTestClient.LoginAsync(factory);

        var sinMotivo = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "rechazar" });
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
        var conMotivo = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "rechazar", motivo = "No se acredita la relación." });
        Assert.Equal(HttpStatusCode.OK, conMotivo.StatusCode);
    }

    // ---------- Decisión 4 de -------------------------------------------------------------

    [Fact]
    public async Task Solo_el_webmaster_registra_un_Festival_historico_sin_organizacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, gestor, _) = await PermisosPorCuentaTests.GestorAsync(factory);
        var festival = new
        {
            festival = new { nombre = "Festival histórico del gestor", nivelCobertura = "nacional", sedeCodigoDepartamento = "05", sedeCodigoMunicipio = "05001", practicasMusicalesIds = Array.Empty<int>(), territoriosSonorosIds = Array.Empty<int>() },
            organizacionResponsableId = (int?)null,
        };

        var delGestor = await gestor.PostAsJsonAsync("/api/v1/admin/festivales", festival);
        Assert.Equal(HttpStatusCode.Forbidden, delGestor.StatusCode);
        Assert.Equal("registro_historico_solo_webmaster", (await delGestor.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());

        var webmaster = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.Created, (await webmaster.PostAsJsonAsync("/api/v1/admin/festivales", festival)).StatusCode);
    }

    // ---------- Andamio ------------------------------------------------------------------------

    private static async Task<int> HistoricoAsync(TestWebApplicationFactory factory, string nombre, string? departamento = "05", string? municipio = "05001",
        string? periodicidad = null, string? correo = null, bool conEdiciones = false)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await db.EntityProfiles.Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
        var festival = new FestivalRow
        {
            Name = nombre, Description = "Registro histórico de prueba.", CoverageLevel = municipio is null ? "departamental" : "municipal",
            DepartmentCode = departamento, MunicipalityCode = municipio, StatusCode = "publicado", OrganizacionPrincipalId = institucional,
            Periodicidad = periodicidad, ContactEmail = correo, CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();
        if (conEdiciones)
        {
            db.EdicionesFestival.AddRange(
                new EdicionFestivalRow { FestivalId = festival.Id, Anio = 2018, Nombre = "Edición 2018", Estado = "realizada", EstadoRegistro = "publicado", EstadoVisibilidad = "publicada", FechaCreacion = DateTime.UtcNow },
                new EdicionFestivalRow { FestivalId = festival.Id, Anio = 2019, Nombre = "Edición 2019", Estado = "realizada", EstadoRegistro = "publicado", EstadoVisibilidad = "publicada", FechaCreacion = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }
        return festival.Id;
    }

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

    private static async Task<List<CoincidenciaFestivalHistoricoDto>> CoincidenciasAsync(HttpClient cliente, int organizacionId, string nombre) =>
        (await cliente.GetFromJsonAsync<List<CoincidenciaFestivalHistoricoDto>>(
            $"/api/v1/externo/organizaciones/{organizacionId}/festivales/coincidencias-historicas?nombre={Uri.EscapeDataString(nombre)}&codigoDepartamento=05&codigoMunicipio=05001"))!;

    private static async Task<BorradorProcesoDto> BorradorAsync(HttpClient cliente, int organizacionId) =>
        (await cliente.GetFromJsonAsync<BorradorProcesoDto>($"/api/v1/externo/organizaciones/{organizacionId}/festivales/borrador"))!;

    private static async Task GuardarBorradorAsync(HttpClient cliente, BorradorProcesoDto borrador, object datos)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/externo/borradores-proceso/{borrador.Id}")
        {
            Content = JsonContent.Create(new { datosJson = JsonSerializer.Serialize(datos), version = borrador.Version }),
        };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        (await cliente.SendAsync(mensaje)).EnsureSuccessStatusCode();
    }

    private static Task<HttpResponseMessage> ReclamarAsync(HttpClient cliente, int organizacionId, int festivalId, string? borradorId = null) =>
        EnviarAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = festivalId.ToString(CultureInfo.InvariantCulture), borradorId, justificacion = "Organizamos este Festival desde hace años." });

    private static async Task<string> IdDeAsync(HttpResponseMessage respuesta)
    {
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient client, string ruta, object cuerpo)
    {
        var testigo = await client.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await client.SendAsync(mensaje);
    }
}
