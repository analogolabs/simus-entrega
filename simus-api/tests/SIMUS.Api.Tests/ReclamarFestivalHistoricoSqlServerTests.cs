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
/// Reclamar un Festival histórico, de punta a punta, <b>contra SQL Server</b>.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ EXISTE.</b> El 6 de noviembre de 2026 el flujo prioritario no funcionaba en ningún
/// entorno con SQL Server y ninguna prueba lo veía: reclamar abría una transacción fuera de la
/// estrategia de reintentos (REC-01) y cada acción escribía en la bitácora un verbo y unos valores
/// que <c>CK_BitacoraAuditoria_Accion</c> y <c>ISJSON</c> rechazan (REC-02). El carril rápido es
/// SQLite y no tiene ni la estrategia ni las restricciones.
/// </para>
/// <para>
/// Recorre todas las escrituras: reclamar, pedir y responder una aclaración, aprobar, conciliar,
/// aprobar sin conciliación, rechazar y cancelar.
/// </para>
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class ReclamarFestivalHistoricoSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private readonly SqlServerFixture _base;

    public ReclamarFestivalHistoricoSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task Reclamar_aclarar_aprobar_y_conciliar_transfiere_el_Festival()
    {
        var (departamento, municipio) = await TerritorioRealAsync();
        var consola = await WebmasterAsync();
        var historico = await HistoricoAsync($"Festival Histórico de Prueba {Guid.NewGuid():N}"[..34], departamento, municipio);
        var (cliente, organizacionId) = await OrganizacionAsync("concilia", departamento, municipio);

        var borrador = await cliente.GetFromJsonAsync<BorradorProcesoDto>($"/api/v1/externo/organizaciones/{organizacionId}/festivales/borrador");
        await PutAsync(cliente, $"/api/v1/externo/borradores-proceso/{borrador!.Id}",
            new { datosJson = JsonSerializer.Serialize(new { descripcion = "Lo organizamos desde 2010." }), version = borrador.Version });
        var reclamacion = await IdDeAsync(await PostAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = historico.ToString(CultureInfo.InvariantCulture), borradorId = borrador.Id, justificacion = "Somos quienes lo organizan." }));

        await EsperarAsync(HttpStatusCode.OK, await consola.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/aclaraciones", new { respuesta = "Adjunta un acta." }));
        await EsperarAsync(HttpStatusCode.OK, await PostAsync(cliente,
            $"/api/v1/externo/reclamaciones-administracion/{reclamacion}/aclaraciones/responder", new { respuesta = "Acta de 2019." }));
        var detalle = await consola.GetFromJsonAsync<DetalleReclamacionAdministracionDto>($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}");
        Assert.Contains(detalle!.Comparacion, x => x.Campo == "Description");

        var aprobada = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "aprobar" });
        await EsperarAsync(HttpStatusCode.OK, aprobada);
        Assert.Equal("aprobada", (await aprobada.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());

        await EsperarAsync(HttpStatusCode.OK, await PostAsync(cliente,
            $"/api/v1/externo/reclamaciones-administracion/{reclamacion}/conciliacion/resolver",
            new { selecciones = new Dictionary<string, string> { ["Description"] = "borrador" } }));

        Assert.Equal(organizacionId, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT OrganizacionPrincipalId FROM dbo.Festivales WHERE IdFestival = {historico};"), CultureInfo.InvariantCulture));
        Assert.Equal(2, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.EdicionesFestival WHERE FestivalId = {historico};"), CultureInfo.InvariantCulture));
        // LA BITÁCORA SE ESCRIBIÓ: enviar, aclarar, responder, aprobar y transferir.
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'ReclamacionesAdministracion' AND IdRegistroAfectado IN (N'{reclamacion}', N'{historico}');"),
            CultureInfo.InvariantCulture) >= 5);
    }

    [HechoSqlServer]
    public async Task Aprobar_sin_nada_que_conciliar_rechazar_y_cancelar_tambien_se_escriben()
    {
        var (departamento, municipio) = await TerritorioRealAsync();
        var consola = await WebmasterAsync();
        var (cliente, organizacionId) = await OrganizacionAsync("directa", departamento, municipio);

        var directo = await HistoricoAsync($"Festival Directo {Guid.NewGuid():N}"[..26], departamento, municipio);
        var primera = await ReclamarAsync(cliente, organizacionId, directo);
        var aprobada = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{primera}/decision", new { accion = "aprobar" });
        await EsperarAsync(HttpStatusCode.OK, aprobada);
        Assert.Equal("transferencia_ejecutada", (await aprobada.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());

        var rechazado = await HistoricoAsync($"Festival Rechazado {Guid.NewGuid():N}"[..28], departamento, municipio);
        var segunda = await ReclamarAsync(cliente, organizacionId, rechazado);
        await EsperarAsync(HttpStatusCode.OK, await consola.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{segunda}/decision", new { accion = "rechazar", motivo = "No se acredita." }));

        var cancelado = await HistoricoAsync($"Festival Cancelado {Guid.NewGuid():N}"[..28], departamento, municipio);
        var tercera = await ReclamarAsync(cliente, organizacionId, cancelado);
        await EsperarAsync(HttpStatusCode.OK, await PostAsync(cliente, $"/api/v1/externo/reclamaciones-administracion/{tercera}/cancelar", new { }));

        // UNA SOLICITUD EN CURSO BLOQUEA OTRA SOBRE EL MISMO FESTIVAL, con un 409 legible.
        var (otra, otraId) = await OrganizacionAsync("segunda", departamento, municipio);
        var enCurso = await HistoricoAsync($"Festival En Curso {Guid.NewGuid():N}"[..27], departamento, municipio);
        await ReclamarAsync(cliente, organizacionId, enCurso);
        var conflicto = await PostAsync(otra, $"/api/v1/externo/organizaciones/{otraId}/reclamaciones-administracion",
            new { festivalId = enCurso.ToString(CultureInfo.InvariantCulture), justificacion = "También es nuestro." });
        Assert.Equal(HttpStatusCode.Conflict, conflicto.StatusCode);
    }

    // ---------- Andamio ------------------------------------------------------------------------

    private static async Task<string> ReclamarAsync(HttpClient cliente, int organizacionId, int festivalId) =>
        await IdDeAsync(await PostAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = festivalId.ToString(CultureInfo.InvariantCulture), justificacion = "Somos quienes lo organizan." }));

    private async Task<int> HistoricoAsync(string nombre, string departamento, string municipio)
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var institucional = await InstitucionalAsync(db);
        var festival = new FestivalRow
        {
            Name = nombre, Description = "Registro histórico de prueba.", CoverageLevel = "municipal",
            DepartmentCode = departamento, MunicipalityCode = municipio, StatusCode = "publicado",
            OrganizacionPrincipalId = institucional, CreatedAt = DateTime.UtcNow,
        };
        db.FestivalRecords.Add(festival);
        await db.SaveChangesAsync();
        db.EdicionesFestival.AddRange(
            new EdicionFestivalRow { FestivalId = festival.Id, Anio = 2018, Nombre = "Edición 2018", Estado = "realizada", EstadoRegistro = "publicado", EstadoVisibilidad = "publicada", FechaCreacion = DateTime.UtcNow },
            new EdicionFestivalRow { FestivalId = festival.Id, Anio = 2019, Nombre = "Edición 2019", Estado = "realizada", EstadoRegistro = "publicado", EstadoVisibilidad = "publicada", FechaCreacion = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return festival.Id;
    }

    private async Task<HttpClient> WebmasterAsync()
    {
        var correo = $"reclamos.{Guid.NewGuid():N}@pnmc.local";
        const string clave = "ReclamosSeguros123";
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var idWebmaster = await db.Roles.AsNoTracking().Where(x => x.Name == "webmaster").Select(x => x.Id).SingleAsync();
            var usuario = new UserRow { FullName = "Webmaster de reclamaciones", Email = correo, IsActive = true, CreatedAt = DateTime.UtcNow };
            usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, clave);
            db.Users.Add(usuario);
            await db.SaveChangesAsync();
            await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);
            await InstitucionalAsync(db);
        }
        var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = correo, Password = clave })).EnsureSuccessStatusCode();
        await CmsTestClient.AttachCsrfAsync(cliente);
        return cliente;
    }

    private static async Task<int> InstitucionalAsync(SimusDbContext db)
    {
        var existente = await db.EntityProfiles.AsNoTracking().Where(x => x.IsInstitutional).Select(x => (int?)x.Id).FirstOrDefaultAsync();
        if (existente is { } id) return id;
        var autor = await db.Users.AsNoTracking().OrderBy(x => x.Id).Select(x => x.Id).FirstAsync();
        var entidad = new EntityProfileRow
        {
            EntityType = "organizacion", Name = "Plan Nacional de Música para la Convivencia", StatusCode = "activa",
            IsActive = true, IsInstitutional = true, CreatedByUserId = autor, ResponsibleUserId = autor, CreatedAt = DateTime.UtcNow,
        };
        db.EntityProfiles.Add(entidad);
        await db.SaveChangesAsync();
        return entidad.Id;
    }

    private async Task<(HttpClient Cliente, int OrganizacionId)> OrganizacionAsync(string marca, string departamento, string municipio)
    {
        var cliente = _base.CrearCliente();
        var correo = $"rec.{marca}.{Guid.NewGuid():N}"[..24] + "@organizacion.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización " + marca + Guid.NewGuid().ToString("N")[..5],
            FullName = "Responsable " + marca,
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = departamento,
            HeadquartersMunicipalityCode = municipio,
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var mias = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/mis");
        return (cliente, int.Parse(mias[0].GetProperty("id").GetString()!, CultureInfo.InvariantCulture));
    }

    private async Task<(string Departamento, string Municipio)> TerritorioRealAsync()
    {
        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio FROM dbo.Divipola ORDER BY CodigoDepartamento, CodigoMunicipio;"),
            CultureInfo.InvariantCulture);
        Assert.False(string.IsNullOrWhiteSpace(par), "dbo.Divipola esta vacia.");
        var partes = par!.Split('|');
        return (partes[0], partes[1]);
    }

    private static async Task<HttpResponseMessage> PostAsync(HttpClient cliente, string ruta, object cuerpo) => await EnviarAsync(cliente, HttpMethod.Post, ruta, cuerpo);

    private static async Task PutAsync(HttpClient cliente, string ruta, object cuerpo) =>
        await EsperarAsync(HttpStatusCode.OK, await EnviarAsync(cliente, HttpMethod.Put, ruta, cuerpo));

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object cuerpo)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(metodo, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await cliente.SendAsync(mensaje);
    }

    private static async Task<string> IdDeAsync(HttpResponseMessage respuesta)
    {
        await EsperarAsync(HttpStatusCode.Created, respuesta);
        return (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
    }

    private static async Task EsperarAsync(HttpStatusCode esperado, HttpResponseMessage respuesta) =>
        Assert.True(respuesta.StatusCode == esperado,
            $"{respuesta.RequestMessage?.Method} {respuesta.RequestMessage?.RequestUri} respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
}
