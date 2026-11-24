using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El espacio para música en vivo <b>contra SQL Server</b>: el circuito completo escribe bitácora, historial de
/// estados y registro de cambios que la base admite, y sus restricciones existen de verdad.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ EXISTE.</b> Todo flujo que escribe en la bitácora o en el historial se prueba aquí: SQLite
/// no tiene <c>CK_BitacoraAuditoria_Accion</c>, ni <c>ISJSON</c>, ni los CHECK propios de
/// <c>dbo.Espacios</c> (un solo responsable, ambiente, estado, coherencia del territorio). Un verbo o
/// un valor que la base rechaza solo se ve como un 500 en este carril.
/// </para>
/// <para>Omitida salvo que se encienda la vía de SQL Server. Ver <c>ArnesSqlServer</c>.</para>
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class EspaciosParaMusicaEnVivoSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private const string Espacios = "/api/v1/institucional/espacios";
    private readonly SqlServerFixture _base;

    public EspaciosParaMusicaEnVivoSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    private async Task<HttpClient> WebmasterAsync()
    {
        var correo = $"espacios.{Guid.NewGuid():N}@pnmc.local";
        const string clave = "EspaciosSeguros123";
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var idWebmaster = await db.Roles.AsNoTracking().Where(x => x.Name == "webmaster").Select(x => x.Id).SingleAsync();
            var usuario = new UserRow { FullName = "Webmaster de espacios", Email = correo, IsActive = true, CreatedAt = DateTime.UtcNow };
            usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, clave);
            db.Users.Add(usuario);
            await db.SaveChangesAsync();
            await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);
        }
        var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = correo, Password = clave })).EnsureSuccessStatusCode();
        await CmsTestClient.AttachCsrfAsync(cliente);
        return cliente;
    }

    /// <summary>Un responsable independiente: cuenta individual sin organización.</summary>
    private async Task<HttpClient> ResponsableAsync()
    {
        var cliente = _base.CrearCliente();
        var correo = $"responsable.{Guid.NewGuid():N}"[..24] + "@correo.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Marta",
            FirstSurname = "Valderrama",
            DocumentType = "cc",
            DocumentNumber = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            Phone = "3001234567",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        return cliente;
    }

    /// <summary>Una organización externa real, con su cuenta.</summary>
    private async Task OrganizacionAsync()
    {
        var cliente = _base.CrearCliente();
        var correo = $"espacios.org.{Guid.NewGuid():N}"[..24] + "@organizacion.test";
        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio FROM dbo.Divipola "
            + "ORDER BY CodigoDepartamento, CodigoMunicipio;"), CultureInfo.InvariantCulture)!.Split('|');
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización lutera de la restricción",
            FullName = "Responsable",
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = par[0],
            HeadquartersMunicipalityCode = par[1],
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) mensaje.Content = JsonContent.Create(cuerpo);
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await cliente.SendAsync(mensaje);
    }

    private async Task<(int ServicioUno, int ServicioDos, int Familia)> VocabulariosAsync()
    {
        var equipamiento = await _base.EscalarAsync("SELECT TOP (1) IdEquipamientoEspacio FROM dbo.EquipamientoDeEspacio ORDER BY IdEquipamientoEspacio;");
        var otro = await _base.EscalarAsync("SELECT IdEquipamientoEspacio FROM dbo.EquipamientoDeEspacio ORDER BY IdEquipamientoEspacio OFFSET 1 ROWS FETCH NEXT 1 ROWS ONLY;");
        var familia = await _base.EscalarAsync("SELECT TOP (1) IdTipoEspacio FROM dbo.TiposDeEspacio ORDER BY IdTipoEspacio;");
        return (Convert.ToInt32(equipamiento, CultureInfo.InvariantCulture), Convert.ToInt32(otro, CultureInfo.InvariantCulture),
            Convert.ToInt32(familia, CultureInfo.InvariantCulture));
    }

    private static EspacioUpsertRequest Cuerpo(int servicioUno, int servicioDos, int familia, string nombre) => new()
    {
        Nombre = nombre,
        Descripcion = "Sala para conciertos de música tradicional.",
        Ambiente = "cerrado",
        AforoMaximo = 90,
        CorreoEspacio = "espacio@responsable.test",
        NivelCobertura = "municipal",
        CodigoDepartamento = "05",
        CodigoMunicipio = "05001",
        LugarEspecifico = "Calle 10 # 5-20, centro",
        EquipamientoIds = [servicioUno, servicioDos],
        TiposIds = [familia],
    };

    private static async Task<int> CrearAsync(HttpClient cliente, EspacioUpsertRequest cuerpo)
    {
        var creado = await EnviarAsync(cliente, HttpMethod.Post, "/api/v1/externo/mis-espacios", cuerpo);
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        return (await creado.Content.ReadFromJsonAsync<EspacioDto>())!.Id;
    }

    [HechoSqlServer]
    public async Task El_circuito_completo_escribe_bitacora_historial_y_cambios_que_la_base_admite()
    {
        var responsable = await ResponsableAsync();
        var consola = await WebmasterAsync();
        var (uno, dos, familia) = await VocabulariosAsync();
        var id = await CrearAsync(responsable, Cuerpo(uno, dos, familia, "Espacio del circuito SQL"));

        // CREAR → ENVIAR → PEDIR AJUSTES → REENVIAR → PUBLICAR → ERRATA → CAMBIO DE FONDO → RETIRAR.
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(responsable, HttpMethod.Post, $"/api/v1/externo/espacios/{id}/enviar-a-revision", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await consola.PostAsJsonAsync($"{Espacios}/{id}/decision", new DecisionSobreEspacio { Decision = "ajustes", Motivo = "Falta precisar el lugar." })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(responsable, HttpMethod.Post, $"/api/v1/externo/espacios/{id}/enviar-a-revision", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await consola.PostAsJsonAsync($"{Espacios}/{id}/decision", new DecisionSobreEspacio { Decision = "publicar" })).StatusCode);

        var errata = Cuerpo(uno, dos, familia, "Espacio del circuito SQL");
        errata.Descripcion = "Construcción y reparación de instrumentos de cuerda, desde 1998.";
        errata.TelefonoEspacio = "3009998877";
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(responsable, HttpMethod.Put, $"/api/v1/externo/espacios/{id}", errata)).StatusCode);

        // LO DE FONDO SOBRE LO PUBLICADO NO SE ESCRIBE EN CALIENTE: se propone, la persona (sin organización) envía y el
        // Programa aplica. La propuesta de una persona exige la columna y el CHECK de V20261117_40.
        var deFondo = Cuerpo(uno, dos, familia, "Espacio con otro nombre SQL");
        deFondo.Descripcion = errata.Descripcion;
        Assert.Equal(HttpStatusCode.Conflict, (await EnviarAsync(responsable, HttpMethod.Put, $"/api/v1/externo/espacios/{id}", deFondo)).StatusCode);
        var rutaPropuesta = $"/api/v1/externo/espacios/{id}/propuesta";
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(responsable, HttpMethod.Put, rutaPropuesta, new GuardarPropuestaDeCambioSolicitud
        {
            Motivo = "Cambió el nombre.",
            Campos = [new CampoPropuestoSolicitud { CampoId = "nombre", ValorPropuesto = "Espacio con otro nombre SQL" }],
        })).StatusCode);
        var enviada = await EnviarAsync(responsable, HttpMethod.Post, $"{rutaPropuesta}/enviar", new { });
        Assert.Equal(HttpStatusCode.OK, enviada.StatusCode);
        var propuestaId = (await enviada.Content.ReadFromJsonAsync<PropuestaDeCambioDto>())!.Id;
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.PropuestasDeCambio WHERE ModuloId = N'espacios' "
            + $"AND RegistroId = N'{id}' AND IdOrganizacion IS NULL AND IdUsuarioResponsable IS NOT NULL AND Estado = N'en_revision';"), CultureInfo.InvariantCulture));
        Assert.Equal(HttpStatusCode.OK, (await consola.PostAsJsonAsync($"/api/v1/institucional/espacios/propuestas/{propuestaId}/decision",
            new DecidirPropuestaDeCambioSolicitud { Decision = "aplicar" })).StatusCode);
        Assert.Equal("Espacio con otro nombre SQL", Convert.ToString(await _base.EscalarAsync($"SELECT NombreEspacio FROM dbo.Espacios WHERE IdEspacio = {id};"), CultureInfo.InvariantCulture));

        Assert.Equal(HttpStatusCode.OK,
            (await EnviarAsync(responsable, HttpMethod.Post, $"/api/v1/externo/espacios/{id}/retirar", new { motivo = "Cierro el espacio." })).StatusCode);
        Assert.Equal("archivado", Convert.ToString(await _base.EscalarAsync($"SELECT EstadoRegistro FROM dbo.Espacios WHERE IdEspacio = {id};"), CultureInfo.InvariantCulture));

        // BITÁCORA: JSON válido, contrato único y los verbos que admite CK_BitacoraAuditoria_Accion.
        foreach (var (evento, verbo) in new[]
        {
            ("EspacioCreado", "crear"), ("EspacioEnviadoARevision", "actualizar"), ("EspacioConAjustesSolicitados", "actualizar"),
            ("EspacioPublicado", "publicar"), ("EspacioCambioPropuesto", "crear"), ("EspacioPropuestaAplicada", "aprobar"), ("EspacioRetirado", "archivar"),
        })
        {
            Assert.True(Convert.ToInt32(await _base.EscalarAsync(
                "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'Espacios' "
                + $"AND IdRegistroAfectado = N'{id}' AND Accion = N'{verbo}' AND ISJSON(ValoresNuevos) = 1 "
                + $"AND JSON_VALUE(ValoresNuevos, '$.evento') = N'{evento}';"), CultureInfo.InvariantCulture) >= 1,
                $"Falta la línea de bitácora «{evento}» ({verbo}).");
        }

        // HISTORIAL DE ESTADOS: la devolución de ajustes lleva su motivo.
        Assert.Equal("Falta precisar el lugar.", Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) Comentario FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'espacios' "
            + $"AND RegistroId = N'{id}' AND EstadoNuevo = N'ajustes_solicitados' ORDER BY Fecha DESC;"), CultureInfo.InvariantCulture));

        // REGISTRO DE CAMBIOS: la errata guardó el valor anterior y la nueva.
        Assert.Contains("1998", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'espacios' "
            + $"AND RegistroId = N'{id}' AND CampoId = N'descripcion';"), CultureInfo.InvariantCulture), StringComparison.Ordinal);
        // EL TELÉFONO ES UN DATO DE CONTACTO: se guarda su valor, y la clase decide quién lo lee.
        Assert.Equal("contacto", Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) ClaseDato FROM dbo.CambiosDeRegistro WHERE ModuloId = N'espacios' "
            + $"AND RegistroId = N'{id}' AND CampoId = N'telefonoEspacio';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Rechazar_con_motivo_y_los_avisos_entran_en_las_tablas_de_la_base()
    {
        var responsable = await ResponsableAsync();
        var consola = await WebmasterAsync();
        var (uno, dos, familia) = await VocabulariosAsync();
        var id = await CrearAsync(responsable, Cuerpo(uno, dos, familia, "Espacio a rechazar SQL"));
        (await EnviarAsync(responsable, HttpMethod.Post, $"/api/v1/externo/espacios/{id}/enviar-a-revision", new { })).EnsureSuccessStatusCode();

        var rechazo = await consola.PostAsJsonAsync($"{Espacios}/{id}/decision", new DecisionSobreEspacio { Decision = "rechazar", Motivo = "No es espacios para música en vivo." });

        Assert.Equal(HttpStatusCode.OK, rechazo.StatusCode);
        Assert.Equal("rechazado", Convert.ToString(await _base.EscalarAsync($"SELECT EstadoRegistro FROM dbo.Espacios WHERE IdEspacio = {id};"), CultureInfo.InvariantCulture));
        Assert.Equal("No es espacios para música en vivo.", Convert.ToString(await _base.EscalarAsync($"SELECT MotivoDeLaDecision FROM dbo.Espacios WHERE IdEspacio = {id};"), CultureInfo.InvariantCulture));
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'Espacios' "
            + $"AND IdRegistroAfectado = N'{id}' AND Accion = N'rechazar';"), CultureInfo.InvariantCulture) >= 1);
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.Notificaciones WHERE ModuloId = N'espacios' "
            + $"AND RegistroId = N'{id}' AND TipoEvento = N'EspacioRechazado';"), CultureInfo.InvariantCulture) >= 1);
    }

    [HechoSqlServer]
    public async Task La_base_exige_un_solo_responsable_y_un_estado_y_una_ambiente_validos()
    {
        // LA PRUEBA CREA LO QUE NECESITA: sola, la base no tiene organizaciones ni cuentas externas.
        await ResponsableAsync();
        await OrganizacionAsync();
        var organizacion = Convert.ToInt32(await _base.EscalarAsync(
            "SELECT TOP (1) IdEntidad FROM dbo.Entidades WHERE EsInstitucional = 0 ORDER BY IdEntidad DESC;"), CultureInfo.InvariantCulture);
        var persona = Convert.ToInt32(await _base.EscalarAsync(
            "SELECT TOP (1) IdUsuario FROM dbo.Usuarios WHERE CanalAcceso = N'externo' ORDER BY IdUsuario DESC;"), CultureInfo.InvariantCulture);

        const string Columnas = "NombreEspacio, Ambiente, NivelCobertura, OrganizacionPrincipalId, UsuarioResponsableId";

        // SIN RESPONSABLE Y CON LOS DOS: el CHECK las rechaza.
        await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"INSERT INTO dbo.Espacios ({Columnas}) VALUES (N'Sin dueño', N'cerrado', N'nacional', NULL, NULL);"));
        await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"INSERT INTO dbo.Espacios ({Columnas}) VALUES (N'Con dos dueños', N'cerrado', N'nacional', {organizacion}, {persona});"));
        // AMBIENTE INVENTADO.
        await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"INSERT INTO dbo.Espacios ({Columnas}) VALUES (N'Ambiente rara', N'volante', N'nacional', {organizacion}, NULL);"));
        // TERRITORIO INCOHERENTE: «municipal» sin municipio.
        await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"INSERT INTO dbo.Espacios ({Columnas}) VALUES (N'Sin municipio', N'cerrado', N'municipal', {organizacion}, NULL);"));
        // UN AFORO QUE NO ES POSITIVO.
        await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"INSERT INTO dbo.Espacios (NombreEspacio, Ambiente, AforoMaximo, NivelCobertura, OrganizacionPrincipalId, UsuarioResponsableId) VALUES (N'Aforo cero', N'cerrado', 0, N'nacional', {organizacion}, NULL);"));
        // Y UNO VÁLIDO ENTRA.
        await _base.EscalarAsync(
            $"INSERT INTO dbo.Espacios ({Columnas}) VALUES (N'Válido de la prueba', N'mixto', N'nacional', NULL, {persona});");
    }

    [HechoSqlServer]
    public async Task Las_migraciones_de_espacios_dejan_los_vocabularios_y_el_permiso_del_modulo()
    {
        Assert.Equal(8, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) FROM dbo.TiposDeEspacio;"), CultureInfo.InvariantCulture));
        Assert.Equal(6, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) FROM dbo.EquipamientoDeEspacio;"), CultureInfo.InvariantCulture));
        // Ninguno nace aprobado: la aprobación es del Plan Nacional de Música.
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.EquipamientoDeEspacio WHERE EstadoAprobacion <> N'propuesto';"), CultureInfo.InvariantCulture));
    }
}
