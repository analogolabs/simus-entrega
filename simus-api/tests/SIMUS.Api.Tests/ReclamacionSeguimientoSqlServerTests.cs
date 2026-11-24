using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
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
/// El seguimiento de la reclamación <b>contra SQL Server</b>: alta de un histórico publicado,
/// soportes de la solicitud y fusión de duplicados.
/// </summary>
/// <remarks>
/// Cada uno escribe en la bitácora, en el historial o en <c>dbo.ArchivosDeRegistro</c>, que el carril
/// rápido (SQLite) no protege: <c>CK_BitacoraAuditoria_Accion</c>, <c>ISJSON</c>,
/// <c>CK_RegistrosRevisionHistorial_EstadoNuevo</c>, <c>CK_ArchivosDeRegistro_Modulo</c>
/// (V20261106_09) y <c>CK_Festivales_FusionCoherente</c> (V20261106_08). Es la lección de REC-01 y
/// REC-02: lo que solo se prueba en SQLite no se ha probado.
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class ReclamacionSeguimientoSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private readonly SqlServerFixture _base;

    public ReclamacionSeguimientoSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task Un_historico_cargado_desde_la_consola_nace_publicado_con_su_historial_y_su_bitacora()
    {
        var (departamento, municipio) = await TerritorioRealAsync();
        var consola = await WebmasterAsync();
        var alta = await consola.PostAsJsonAsync("/api/v1/admin/festivales", new
        {
            festival = new { nombre = $"Histórico Publicado {Guid.NewGuid():N}"[..30], nivelCobertura = "municipal", codigoDepartamento = departamento, codigoMunicipio = municipio, practicasMusicalesIds = Array.Empty<int>(), territoriosSonorosIds = Array.Empty<int>() },
            organizacionResponsableId = (int?)null,
        });
        await EsperarAsync(HttpStatusCode.Created, alta);
        var id = (await alta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        Assert.Equal("publicado", Convert.ToString(await _base.EscalarAsync($"SELECT EstadoRegistro FROM dbo.Festivales WHERE IdFestival = {id};"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'festivales' AND RegistroId = N'{id}' AND Accion = N'RegistroHistoricoPublicadoAlCargarse' AND EstadoNuevo = N'publicado';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'Festivales' AND IdRegistroAfectado = N'{id}' AND JSON_VALUE(ValoresNuevos, '$.estado') = N'publicado';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Los_soportes_de_una_solicitud_cuelgan_del_banco_y_quedan_en_la_bitacora()
    {
        var (departamento, municipio) = await TerritorioRealAsync();
        var historico = await HistoricoAsync($"Festival con Soportes {Guid.NewGuid():N}"[..32], departamento, municipio);
        var (cliente, organizacionId) = await OrganizacionAsync("soporte", departamento, municipio);
        var consola = await WebmasterAsync();

        var acta = await SubirPdfAsync(cliente, "acta.pdf");
        var reclamacion = await IdDeAsync(await PostAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = historico.ToString(CultureInfo.InvariantCulture), justificacion = "Somos quienes lo organizan.", soportes = new[] { acta } }));
        await EsperarAsync(HttpStatusCode.OK, await consola.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/aclaraciones", new { respuesta = "Adjunta el certificado." }));
        var certificado = await SubirPdfAsync(cliente, "certificado.pdf");
        await EsperarAsync(HttpStatusCode.OK, await PostAsync(cliente, $"/api/v1/externo/reclamaciones-administracion/{reclamacion}/aclaraciones/responder",
            new { respuesta = "Aquí está.", soportes = new[] { certificado } }));

        Assert.Equal(2, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.ArchivosDeRegistro WHERE ModuloId = N'reclamaciones-administracion' AND RegistroId = N'{reclamacion}' AND RolArchivo = N'soporte';"), CultureInfo.InvariantCulture));
        Assert.Equal(2, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'ReclamacionesAdministracion' AND IdRegistroAfectado = N'{reclamacion}' AND JSON_VALUE(ValoresNuevos, '$.soportes') = N'1';"), CultureInfo.InvariantCulture));
        var detalle = await consola.GetFromJsonAsync<DetalleReclamacionAdministracionDto>($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}");
        Assert.Equal(2, detalle!.Reclamacion.Soportes!.Count);
        Assert.Equal(HttpStatusCode.OK, (await consola.GetAsync(detalle.Reclamacion.Soportes[0].Url)).StatusCode);
    }

    [HechoSqlServer]
    public async Task Fusionar_duplicados_mueve_lo_que_cuelga_archiva_el_absorbido_y_lo_escribe_todo()
    {
        var (departamento, municipio) = await TerritorioRealAsync();
        var consola = await WebmasterAsync();
        var nombre = $"Muestra Duplicada {Guid.NewGuid():N}"[..28];
        var conservado = await HistoricoAsync(nombre, departamento, municipio, [2018, 2019]);
        var absorbido = await HistoricoAsync(nombre, departamento, municipio, [2020]);
        var (cliente, organizacionId) = await OrganizacionAsync("fusion", departamento, municipio);
        var reclamacion = await IdDeAsync(await PostAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = absorbido.ToString(CultureInfo.InvariantCulture), justificacion = "Es nuestro." }));

        var fusion = await consola.PostAsJsonAsync($"/api/v1/admin/festivales/{conservado}/fusion",
            new { absorbidoId = absorbido.ToString(CultureInfo.InvariantCulture), motivo = "Dos cargas del mismo Festival." });
        await EsperarAsync(HttpStatusCode.OK, fusion);

        Assert.Equal(3, Convert.ToInt32(await _base.EscalarAsync($"SELECT COUNT(*) FROM dbo.EdicionesFestival WHERE FestivalId = {conservado};"), CultureInfo.InvariantCulture));
        Assert.Equal(conservado, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT FusionadoEnId FROM dbo.Festivales WHERE IdFestival = {absorbido} AND EstadoRegistro = N'archivado' AND FechaFusion IS NOT NULL;"), CultureInfo.InvariantCulture));
        Assert.Equal(conservado.ToString(CultureInfo.InvariantCulture), Convert.ToString(await _base.EscalarAsync(
            $"SELECT RegistroCanonicoId FROM dbo.ReclamacionesAdministracion WHERE IdReclamacion = {reclamacion};"), CultureInfo.InvariantCulture));
        // BITÁCORA: el que se conserva, el absorbido y la solicitud trasladada.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'Festivales' AND IdRegistroAfectado = N'{conservado}' AND Accion = N'actualizar' AND JSON_VALUE(ValoresNuevos, '$.evento') = N'FestivalHistoricoFusionado';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'Festivales' AND IdRegistroAfectado = N'{absorbido}' AND Accion = N'archivar' AND JSON_VALUE(ValoresNuevos, '$.fusionadoEnId') = N'{conservado}';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'ReclamacionesAdministracion' AND IdRegistroAfectado = N'{reclamacion}' AND JSON_VALUE(ValoresNuevos, '$.evento') = N'ReclamacionTrasladadaPorFusion';"), CultureInfo.InvariantCulture));
        // HISTORIAL de los dos registros.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'festivales' AND RegistroId = N'{absorbido}' AND Accion = N'FestivalFusionadoEnOtro' AND EstadoNuevo = N'archivado';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'festivales' AND RegistroId = N'{conservado}' AND Accion = N'FestivalAbsorbioUnDuplicado';"), CultureInfo.InvariantCulture));

        // LA SOLICITUD TRASLADADA SE DECIDE Y TRANSFIERE EL QUE SE CONSERVA.
        var decision = await consola.PostAsJsonAsync($"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "aprobar" });
        await EsperarAsync(HttpStatusCode.OK, decision);
        Assert.Equal(organizacionId, Convert.ToInt32(await _base.EscalarAsync($"SELECT OrganizacionPrincipalId FROM dbo.Festivales WHERE IdFestival = {conservado};"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Una_pregunta_y_un_motivo_largos_caben_en_el_aviso_y_no_rompen_la_decision()
    {
        // D3-08: el aviso (Notificaciones.Cuerpo) admite 2000 caracteres y la pregunta o el motivo, 2400:
        // pedir una aclaración o rechazar con un texto largo respondía 500 en SQL Server.
        var (departamento, municipio) = await TerritorioRealAsync();
        var consola = await WebmasterAsync();
        var historico = await HistoricoAsync($"Festival de Texto Largo {Guid.NewGuid():N}"[..32], departamento, municipio);
        var (cliente, organizacionId) = await OrganizacionAsync("textolargo", departamento, municipio);
        var reclamacion = await IdDeAsync(await PostAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion",
            new { festivalId = historico.ToString(CultureInfo.InvariantCulture), justificacion = "Es nuestro." }));

        var pregunta = "Adjunta el acta de la edición 2018. " + new string('p', 2300);
        await EsperarAsync(HttpStatusCode.OK, await consola.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/aclaraciones", new { respuesta = pregunta }));
        var propias = await cliente.GetFromJsonAsync<List<ReclamacionAdministracionDto>>($"/api/v1/externo/organizaciones/{organizacionId}/reclamaciones-administracion");
        Assert.StartsWith("Adjunta el acta de la edición 2018.", Assert.Single(propias!).AclaracionPendiente, StringComparison.Ordinal);

        var motivo = "No se acredita la relación con el Festival. " + new string('m', 2300);
        await EsperarAsync(HttpStatusCode.OK, await consola.PostAsJsonAsync(
            $"/api/v1/institucional/reclamaciones-administracion/{reclamacion}/decision", new { accion = "rechazar", motivo }));

        // LOS DOS AVISOS EXISTEN Y CABEN EN LA COLUMNA.
        Assert.Equal(2, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.Notificaciones WHERE ModuloId = N'reclamaciones-administracion' AND RegistroId = N'{reclamacion}' AND TipoEvento IN (N'ReclamacionRequiereAclaracion', N'ReclamacionRechazada');"), CultureInfo.InvariantCulture));
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT MAX(LEN(Cuerpo)) FROM dbo.Notificaciones WHERE ModuloId = N'reclamaciones-administracion' AND RegistroId = N'{reclamacion}';"), CultureInfo.InvariantCulture) <= 2000);
    }

    [HechoSqlServer]
    public async Task Una_fusion_rechazada_no_escribe_nada()
    {
        var (departamento, municipio) = await TerritorioRealAsync();
        var consola = await WebmasterAsync();
        var nombre = $"Festival Disputado {Guid.NewGuid():N}"[..28];
        var uno = await HistoricoAsync(nombre, departamento, municipio, [2017]);
        var dos = await HistoricoAsync(nombre, departamento, municipio, [2018]);
        var (primera, primeraId) = await OrganizacionAsync("disputa1", departamento, municipio);
        var (segunda, segundaId) = await OrganizacionAsync("disputa2", departamento, municipio);
        await IdDeAsync(await PostAsync(primera, $"/api/v1/externo/organizaciones/{primeraId}/reclamaciones-administracion",
            new { festivalId = uno.ToString(CultureInfo.InvariantCulture), justificacion = "Es nuestro." }));
        await IdDeAsync(await PostAsync(segunda, $"/api/v1/externo/organizaciones/{segundaId}/reclamaciones-administracion",
            new { festivalId = dos.ToString(CultureInfo.InvariantCulture), justificacion = "También es nuestro." }));

        var fusion = await consola.PostAsJsonAsync($"/api/v1/admin/festivales/{uno}/fusion",
            new { absorbidoId = dos.ToString(CultureInfo.InvariantCulture), motivo = "Mismo Festival." });
        Assert.Equal(HttpStatusCode.Conflict, fusion.StatusCode);
        Assert.Equal("dos_reclamaciones_abiertas", (await fusion.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("codigo").GetString());
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync($"SELECT COUNT(*) FROM dbo.EdicionesFestival WHERE FestivalId = {dos};"), CultureInfo.InvariantCulture));
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync($"SELECT COUNT(*) FROM dbo.Festivales WHERE IdFestival = {dos} AND FusionadoEnId IS NOT NULL;"), CultureInfo.InvariantCulture));
    }

    // ---------- Andamio ------------------------------------------------------------------------

    private static async Task<string> SubirPdfAsync(HttpClient cliente, string nombre)
    {
        using var contenido = new MultipartFormDataContent();
        var parte = new ByteArrayContent(ReclamacionSeguimientoTests.PdfMinimo(nombre));
        parte.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        contenido.Add(parte, "file", nombre);
        var respuesta = await TestigoDelCanalExterno.PostAsync(cliente, "/api/v1/externo/archivos/documentos", contenido);
        await EsperarAsync(HttpStatusCode.Created, respuesta);
        return (await respuesta.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32().ToString(CultureInfo.InvariantCulture);
    }

    private async Task<int> HistoricoAsync(string nombre, string departamento, string municipio, int[]? ediciones = null)
    {
        // LA ORGANIZACIÓN INSTITUCIONAL SE CREA A NOMBRE DE UN USUARIO QUE YA EXISTA: en una base recién
        // creada no hay ninguno hasta que alguien entra, y la prueba que corría primero fallaba.
        await WebmasterAsync();
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
        foreach (var anio in ediciones ?? [])
            db.EdicionesFestival.Add(new EdicionFestivalRow { FestivalId = festival.Id, Anio = anio, Nombre = $"Edición {anio}", Estado = "realizada", EstadoRegistro = "publicado", EstadoVisibilidad = "publicada", FechaCreacion = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return festival.Id;
    }

    private async Task<HttpClient> WebmasterAsync()
    {
        var correo = $"seguimiento.{Guid.NewGuid():N}@pnmc.local";
        const string clave = "SeguimientoSeguro123";
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var idWebmaster = await db.Roles.AsNoTracking().Where(x => x.Name == "webmaster").Select(x => x.Id).SingleAsync();
            var usuario = new UserRow { FullName = "Webmaster de seguimiento", Email = correo, IsActive = true, CreatedAt = DateTime.UtcNow };
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
        var correo = $"seg.{marca}.{Guid.NewGuid():N}"[..24] + "@organizacion.test";
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

    private static async Task<HttpResponseMessage> PostAsync(HttpClient cliente, string ruta, object cuerpo)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
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
