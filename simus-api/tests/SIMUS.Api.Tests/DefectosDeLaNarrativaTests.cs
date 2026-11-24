using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Los defectos D-04 a D-07 y D-09 que dejó el recorrido de punta a punta de la narrativa.
/// </summary>
/// <remarks>
/// Cada prueba nombra el defecto, lo reproduce como lo vio quien lo encontró y fija el comportamiento correcto.
/// </remarks>
public sealed class DefectosDeLaNarrativaTests
{
    private const string Clave = "ClaveExterna123";

    // ---------- D-04: el aviso del histórico no sobrevive a la transferencia ----------------------

    [Fact]
    public async Task D04_La_nota_de_que_el_registro_historico_se_publico_no_es_una_observacion_de_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion) = await OrganizacionAsync(factory, "d04.historico@example.com", "05");
        var festival = await FestivalAsync(factory, organizacion, "Festival histórico ya transferido", "publicado");
        await HistorialAsync(factory, festival, "RegistroHistoricoPublicadoAlCargarse",
            "Registro histórico cargado: se publica para que su organización pueda encontrarlo y reclamarlo.", DateTime.UtcNow.AddDays(-2));

        var lista = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacion}/festivales");
        var tarjeta = lista.EnumerateArray().Single(x => x.GetProperty("id").GetString() == festival.ToString(CultureInfo.InvariantCulture));

        // Antes: «Registro histórico: se publica para que su organización pueda encontrarlo…» en la tarjeta de un
        // Festival que ya es de la organización.
        Assert.True(tarjeta.GetProperty("observacionRevision").ValueKind == JsonValueKind.Null,
            "la nota informativa del histórico no puede salir como observación de revisión");
    }

    [Fact]
    public async Task D04_Una_observacion_real_de_revision_sigue_saliendo_aunque_haya_una_nota_informativa_mas_antigua()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion) = await OrganizacionAsync(factory, "d04.ajustes@example.com", "05");
        var festival = await FestivalAsync(factory, organizacion, "Festival con ajustes", "ajustes_solicitados");
        await HistorialAsync(factory, festival, "RegistroHistoricoPublicadoAlCargarse", "Nota informativa.", DateTime.UtcNow.AddDays(-3));
        await HistorialAsync(factory, festival, "FestivalAjustesSolicitados", "Falta indicar las prácticas musicales.", DateTime.UtcNow.AddDays(-1));
        // Una nota informativa POSTERIOR (p. ej. una fusión) tampoco puede tapar la observación.
        await HistorialAsync(factory, festival, "FestivalAbsorbioUnDuplicado", "Absorbió una copia.", DateTime.UtcNow);

        var lista = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacion}/festivales");
        var tarjeta = lista.EnumerateArray().Single(x => x.GetProperty("id").GetString() == festival.ToString(CultureInfo.InvariantCulture));

        Assert.Equal("Falta indicar las prácticas musicales.", tarjeta.GetProperty("observacionRevision").GetString());
    }

    // ---------- D-05: la bitácora dice qué pasó ---------------------------------------------------

    [Fact]
    public async Task D05_Registrarse_deja_en_la_bitacora_el_alta_de_la_persona_y_de_la_organizacion_con_rotulo_claro()
    {
        await using var factory = new TestWebApplicationFactory();
        var (_, organizacion) = await OrganizacionAsync(factory, "d05.alta@example.com", "05");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var usuario = await db.Users.AsNoTracking().SingleAsync(x => x.Email == "d05.alta@example.com");
            var filas = await db.AuditLogs.AsNoTracking()
                .Where(x => x.UserId == usuario.Id && (x.TableName == "Usuarios" || x.TableName == "Entidades"))
                .ToListAsync();

            var cuenta = Assert.Single(filas, x => x.Action == AccionesAuditoria.Crear && x.TableName == "Usuarios");
            Assert.Equal(usuario.Id.ToString(CultureInfo.InvariantCulture), cuenta.RecordId);
            Assert.Equal("Registró su cuenta", EventosDeLaBitacora.Etiquetar(cuenta.NewValuesJson));

            var entidad = Assert.Single(filas, x => x.Action == AccionesAuditoria.CrearOrganizacion);
            Assert.Equal(organizacion.ToString(CultureInfo.InvariantCulture), entidad.RecordId);
            Assert.Equal("Registró su organización", EventosDeLaBitacora.Etiquetar(entidad.NewValuesJson));

            Assert.Contains(filas, x => x.Action == AccionesAuditoria.AsignarAdministradorInicial);
            // La línea lleva el hecho, nunca datos personales: ni el correo ni el nombre.
            Assert.DoesNotContain("d05.alta@example.com", string.Join(' ', filas.Select(x => x.NewValuesJson)), StringComparison.Ordinal);
        }

        // Y la consola la lista con su rótulo y el nombre del registro, no como «Creó · Sin nombre registrado».
        var consola = factory.CreateClient();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" })).EnsureSuccessStatusCode();
        var pagina = await consola.GetFromJsonAsync<AuditoriaRespuestaDto>("/api/v1/admin/auditoria/?tamano=50&vista=actuaciones");
        Assert.Contains(pagina!.Items, x => x.AccionEtiqueta == "Registró su cuenta" && x.NombreRegistro == "Responsable de la organización");
        Assert.Contains(pagina.Items, x => x.AccionEtiqueta == "Registró su organización" && x.NombreRegistro == "Organización de d05.alta@example.com");
    }

    [Fact]
    public void D05_Pedir_ajustes_y_el_resto_de_decisiones_se_leen_con_su_verbo_y_no_como_Actualizo()
    {
        // El cuerpo exacto que escribe `RevisionInstitucionalFestivalesEndpoints` al «Pedir ajustes».
        const string cuerpo = "{\"Estado\":\"ajustes_solicitados\",\"OrganizacionPrincipalId\":12,\"Evento\":\"FestivalAjustesSolicitados\"}";
        Assert.Equal("Pidió ajustes en el Festival", EventosDeLaBitacora.Etiquetar(cuerpo));
        Assert.Equal("Aprobó la solicitud de administración",
            EventosDeLaBitacora.Etiquetar("{\"evento\":\"ReclamacionAprobadaPendienteConciliacion\",\"estado\":\"aprobada\"}"));
        Assert.Equal("Cambió su contraseña",
            EventosDeLaBitacora.Etiquetar("{\"evento\":\"contrasena_cambiada\",\"sesionesCerradas\":true}"));
    }

    /// <summary>
    /// LA PUERTA QUE EVITA EL SIGUIENTE «ACTUALIZÓ» (D-05): todo evento funcional que el código escribe en la bitácora
    /// está en el catálogo con su rótulo. Se leen los fuentes y no una lista aparte, para que añadir un evento sin
    /// rótulo rompa esta prueba y no la auditoría de quien la lee.
    /// </summary>
    [Fact]
    public void D05_Los_eventos_que_el_codigo_escribe_estan_en_el_catalogo()
    {
        var raiz = RaizDeLaApi();
        var patrones = new[]
        {
            new Regex(@"\b[eE]vento\s*=\s*""([A-Za-z_]+)""", RegexOptions.Compiled),
            new Regex(@"\\""Evento\\"":\\""([A-Za-z_]+)\\""", RegexOptions.Compiled),
            new Regex(@"""[eE]vento""\s*:\s*\\?""([A-Za-z_]+)", RegexOptions.Compiled),
        };
        var sinRotulo = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var archivo in Directory.EnumerateFiles(raiz, "*.cs", SearchOption.AllDirectories)
                     .Where(x => !x.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
                              && !x.EndsWith("EventosDeLaBitacora.cs", StringComparison.Ordinal)))
        {
            var texto = File.ReadAllText(archivo);
            foreach (var patron in patrones)
                foreach (Match coincidencia in patron.Matches(texto))
                    if (!EventosDeLaBitacora.Conoce(coincidencia.Groups[1].Value))
                        sinRotulo.Add($"{coincidencia.Groups[1].Value} ({Path.GetFileName(archivo)})");
        }

        Assert.True(sinRotulo.Count == 0,
            "Eventos de bitácora sin rótulo en EventosDeLaBitacora (se leerían «Actualizó»): " + string.Join(", ", sinRotulo));
    }

    [Fact]
    public void D05_Todo_verbo_que_la_bitacora_admite_tiene_etiqueta()
    {
        foreach (var verbo in AccionesAuditoria.Admitidos)
            Assert.Contains(verbo, VerbosDeBitacora.Conocidos);
    }

    // ---------- D-06: «en este territorio» solo si se comprobó --------------------------------------

    [Fact]
    public async Task D06_Un_Festival_con_sede_en_otro_departamento_no_es_una_coincidencia_en_este_territorio()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion) = await OrganizacionAsync(factory, "d06.cauca@example.com", "05");
        var (_, otraOrganizacion) = await OrganizacionAsync(factory, "d06.boyaca@example.com", "05");
        // Como los generados para el mapa: sin departamento de cobertura, solo la sede.
        var enBoyaca = await FestivalAsync(factory, otraOrganizacion, "Festival Regional de Marimba en Belén", "publicado",
            departamento: null, sedeDepartamento: "15", sedeMunicipio: "15087");
        var enCauca = await FestivalAsync(factory, otraOrganizacion, "Festival de Marimba del Cauca", "publicado",
            departamento: null, sedeDepartamento: "19", sedeMunicipio: "19001");
        var sinTerritorio = await FestivalAsync(factory, otraOrganizacion, "Festival Nacional de Marimba", "publicado",
            departamento: null, sedeDepartamento: null, sedeMunicipio: null);

        var coincidencias = await cliente.GetFromJsonAsync<List<CoincidenciaFestivalHistoricoDto>>(
            $"/api/v1/externo/organizaciones/{organizacion}/festivales/coincidencias-historicas?nombre=Marimba&codigoDepartamento=19");

        Assert.DoesNotContain(coincidencias!, x => x.FestivalId == enBoyaca.ToString(CultureInfo.InvariantCulture));

        var delCauca = Assert.Single(coincidencias!, x => x.FestivalId == enCauca.ToString(CultureInfo.InvariantCulture));
        Assert.Equal("19", delCauca.CodigoDepartamento);
        Assert.Contains(delCauca.Evidencias, x => x.Contains("en este territorio", StringComparison.Ordinal));

        // Sin territorio alguno no se afirma lo que no se comprobó.
        var nacional = Assert.Single(coincidencias!, x => x.FestivalId == sinTerritorio.ToString(CultureInfo.InvariantCulture));
        Assert.DoesNotContain(nacional.Evidencias, x => x.Contains("en este territorio", StringComparison.Ordinal));
        Assert.Contains(nacional.Evidencias, x => x.Contains("sin territorio registrado", StringComparison.Ordinal));
    }

    // ---------- D-07: «completos» con ajustes pedidos ------------------------------------------------

    [Fact]
    public async Task D07_Con_ajustes_pedidos_la_consulta_no_dice_que_esta_completo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion) = await OrganizacionAsync(factory, "d07.ajustes@example.com", "05");
        await FestivalAsync(factory, organizacion, "Festival devuelto por la revisión", "ajustes_solicitados");

        var respuesta = await PreguntarAsync(cliente, organizacion, "¿qué información me falta?");

        var texto = respuesta.GetProperty("respuesta").GetString()!;
        Assert.DoesNotContain("tiene completos los campos", texto, StringComparison.Ordinal);
        Assert.Contains("ajustes pendientes", texto, StringComparison.Ordinal);
        var fila = respuesta.GetProperty("consulta").GetProperty("filas").EnumerateArray().Single();
        Assert.Equal("Festival devuelto por la revisión", fila[1].GetString());
        Assert.Contains("ajustes pedidos por el PNMC", fila[2].GetString()!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task D07_Sin_ajustes_y_con_los_campos_completos_sigue_diciendo_completo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacion) = await OrganizacionAsync(factory, "d07.completo@example.com", "05");
        await FestivalAsync(factory, organizacion, "Festival publicado y completo", "publicado");

        var respuesta = await PreguntarAsync(cliente, organizacion, "¿qué información me falta?");

        Assert.Contains("completos los campos", respuesta.GetProperty("respuesta").GetString()!, StringComparison.Ordinal);
        var fila = respuesta.GetProperty("consulta").GetProperty("filas").EnumerateArray().Single();
        Assert.Equal("Completo", fila[2].GetString());
    }

    // ---------- D-09: la barra del portal no provoca un 401 -------------------------------------------

    [Fact]
    public async Task D09_Preguntar_si_hay_sesion_sin_haber_entrado_responde_200_y_no_401()
    {
        await using var factory = new TestWebApplicationFactory();
        var anonimo = factory.CreateClient();

        var respuesta = await anonimo.GetAsync("/api/v1/externo/auth/estado");

        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(cuerpo.GetProperty("autenticado").GetBoolean());
        Assert.Equal(JsonValueKind.Null, cuerpo.GetProperty("sesion").ValueKind);
        // `/me` sigue siendo la puerta de quien SÍ exige sesión.
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.GetAsync("/api/v1/externo/auth/me")).StatusCode);
    }

    [Fact]
    public async Task D09_Con_sesion_externa_responde_la_misma_sesion_que_me()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, _) = await OrganizacionAsync(factory, "d09.sesion@example.com", "05");

        var estado = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/auth/estado");
        var me = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/auth/me");

        Assert.True(estado.GetProperty("autenticado").GetBoolean());
        Assert.Equal(me.GetProperty("email").GetString(), estado.GetProperty("sesion").GetProperty("email").GetString());
        Assert.Equal(me.GetProperty("organizations").GetArrayLength(), estado.GetProperty("sesion").GetProperty("organizations").GetArrayLength());
    }

    [Fact]
    public async Task D09_Una_sesion_de_la_consola_no_cuenta_como_sesion_externa()
    {
        await using var factory = new TestWebApplicationFactory();
        var consola = factory.CreateClient();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" })).EnsureSuccessStatusCode();

        var estado = await consola.GetFromJsonAsync<JsonElement>("/api/v1/externo/auth/estado");

        Assert.False(estado.GetProperty("autenticado").GetBoolean());
    }

    // ---------- Andamio ---------------------------------------------------------------------------

    private static string RaizDeLaApi()
    {
        var directorio = new DirectoryInfo(AppContext.BaseDirectory);
        while (directorio is not null && !Directory.Exists(Path.Combine(directorio.FullName, "src", "SIMUS.Api", "Endpoints")))
            directorio = directorio.Parent;
        return directorio is null
            ? throw new DirectoryNotFoundException("No se encontró simus-api/src/SIMUS.Api desde " + AppContext.BaseDirectory)
            : Path.Combine(directorio.FullName, "src", "SIMUS.Api");
    }

    private static async Task<(HttpClient Cliente, int OrganizacionId)> OrganizacionAsync(TestWebApplicationFactory factory, string correo, string departamento)
    {
        var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización de " + correo,
            FullName = "Responsable de la organización",
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = departamento,
            HeadquartersMunicipalityCode = departamento + "001",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var mias = await client.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/mis");
        return (client, int.Parse(mias[0].GetProperty("id").GetString()!, CultureInfo.InvariantCulture));
    }

    private static async Task<int> FestivalAsync(
        TestWebApplicationFactory factory, int organizacionId, string nombre, string estado,
        string? departamento = "05", string? sedeDepartamento = "05", string? sedeMunicipio = "05001")
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var festival = new FestivalRow
        {
            Name = nombre,
            Description = "Descripción completa del Festival de prueba.",
            ContactEmail = "contacto@example.com",
            CoverageLevel = departamento is null ? "nacional" : "departamental",
            DepartmentCode = departamento,
            SedeCodigoDepartamento = sedeDepartamento,
            SedeCodigoMunicipio = sedeMunicipio,
            StatusCode = estado,
            OrganizacionPrincipalId = organizacionId,
            CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();
        return festival.Id;
    }

    private static async Task HistorialAsync(TestWebApplicationFactory factory, int festivalId, string accion, string comentario, DateTime fecha)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        db.HistorialesRevisionRegistros.Add(new HistorialRevisionRegistroRow
        {
            ModuloId = "festivales",
            RegistroId = festivalId.ToString(CultureInfo.InvariantCulture),
            EstadoAnterior = "borrador",
            EstadoNuevo = "publicado",
            Accion = accion,
            Comentario = comentario,
            Fecha = fecha,
        });
        await db.SaveChangesAsync();
    }

    private static async Task<JsonElement> PreguntarAsync(HttpClient cliente, int organizacionId, string pregunta)
    {
        var respuesta = await cliente.PostAsJsonAsync(
            $"/api/v1/externo/organizaciones/{organizacionId}/consulta-guiada/consultar", new { pregunta, contexto = (object?)null });
        respuesta.EnsureSuccessStatusCode();
        return await respuesta.Content.ReadFromJsonAsync<JsonElement>();
    }
}
