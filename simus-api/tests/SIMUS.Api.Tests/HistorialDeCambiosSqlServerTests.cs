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
/// El registro de cambios contra el motor real (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ VIVE EN LA VÍA DE SQL SERVER.</b> Porque lo que escribe bitácora o historial se prueba
/// contra el motor: SQLite no aplica <c>CK_BitacoraAuditoria_Accion</c> (que ahora admite
/// «consultar»), ni <c>CK_BitacoraAuditoria_ValoresNuevos_JSON</c>, ni <c>CK_CambiosDeRegistro_*</c>.
/// Un verbo o un JSON que la base rechaza solo se ve aquí, como un 500.
/// </para>
/// <para>
/// Omitida salvo que se encienda <c>SIMUS_PRUEBAS_SQLSERVER=1</c>. Ver <c>ArnesSqlServer</c>.
/// </para>
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class HistorialDeCambiosSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private const string CorreoConsola = "historial.consola@pnmc.local";
    private const string ClaveConsola = "PnmcFuncionario123";

    private readonly SqlServerFixture _base;

    public HistorialDeCambiosSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task Corregir_Una_Edicion_Escribe_Cambio_Y_Bitacora_Que_La_Base_Admite()
    {
        var (cliente, organizacionId, festivalId) = await OrganizacionConFestivalAsync("edicion");
        var creada = await EnviarAsync(cliente, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/ediciones",
            new { anio = 2040, nombre = "Edición 2040", director = "Ana" });
        creada.EnsureSuccessStatusCode();
        var edicionId = int.Parse((await creada.Content.ReadFromJsonAsync<EdicionFestivalDto>())!.Id, CultureInfo.InvariantCulture);

        var corregida = await EnviarAsync(cliente, HttpMethod.Put, $"/api/v1/externo/ediciones/{edicionId}",
            new { anio = 2040, nombre = "Edición 2040", director = "Beatriz", descripcion = "Ahora con descripción." });

        // 200 y no 500: la bitácora que escribe el registrador entra por CK_BitacoraAuditoria_Accion
        // y por el CK de JSON válido.
        Assert.Equal(HttpStatusCode.OK, corregida.StatusCode);

        Assert.Equal("Ana", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorAnterior FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' "
            + $"AND RegistroId = N'{edicionId}' AND CampoId = N'director';"), CultureInfo.InvariantCulture));
        Assert.Equal("Beatriz", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' "
            + $"AND RegistroId = N'{edicionId}' AND CampoId = N'director';"), CultureInfo.InvariantCulture));
        // Una descripción que antes no estaba: el anterior es nulo, no una cadena vacía.
        Assert.Null(await _base.EscalarAsync(
            "SELECT ValorAnterior FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' "
            + $"AND RegistroId = N'{edicionId}' AND CampoId = N'descripcion';"));
        Assert.Equal(organizacionId, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT TOP (1) OrganizacionId FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' "
            + $"AND RegistroId = N'{edicionId}';"), CultureInfo.InvariantCulture));

        // La bitácora: contrato único, JSON válido, y el evento dentro.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'EdicionesFestival' "
            + $"AND IdRegistroAfectado = N'{edicionId}' AND Accion = N'actualizar' "
            + "AND ISJSON(ValoresNuevos) = 1 AND JSON_VALUE(ValoresNuevos, '$.evento') = N'CambioDeRegistro';"),
            CultureInfo.InvariantCulture));

        // Los dos guardados idénticos de una misma pasada comparten grupo, y el cambio de dos campos
        // son dos filas del mismo guardado.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(DISTINCT IdGrupo) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' "
            + $"AND RegistroId = N'{edicionId}';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Leer_Datos_Personales_Desde_La_Consola_Deja_La_Linea_Consultar_Que_La_Base_Admite()
    {
        var (cliente, organizacionId, _) = await OrganizacionConFestivalAsync("personales");

        var perfil = await cliente.GetFromJsonAsync<PerfilOrganizacionDto>($"/api/v1/externo/organizaciones/{organizacionId}/perfil");
        var correoNuevo = $"nuevo.{Guid.NewGuid():N}"[..24] + "@organizacion.test";
        var guardado = await EnviarAsync(cliente, HttpMethod.Put, $"/api/v1/externo/organizaciones/{organizacionId}/perfil",
            new Dictionary<string, object?>
            {
                ["nombre"] = perfil!.Nombre,
                ["nombreLegal"] = perfil.NombreLegal,
                ["numeroIdentificacion"] = null,
                ["descripcion"] = perfil.Descripcion,
                ["correoContacto"] = correoNuevo,
                ["telefonoContacto"] = perfil.TelefonoContacto,
                ["sitioWeb"] = perfil.SitioWeb,
                ["facebook"] = perfil.Facebook,
                ["instagram"] = perfil.Instagram,
                ["otroEnlace"] = perfil.OtroEnlace,
                ["direccion"] = perfil.Direccion,
                ["codigoDepartamentoSede"] = perfil.CodigoDepartamentoSede ?? string.Empty,
                ["codigoMunicipioSede"] = perfil.CodigoMunicipioSede ?? string.Empty,
                ["archivoFotoId"] = null,
            });
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);

        await SembrarConsolaAsync();
        using var consola = _base.CrearCliente();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CorreoConsola, Password = ClaveConsola })).EnsureSuccessStatusCode();

        var respuesta = await consola.GetAsync($"/api/v1/admin/historial/{Modulos.Organizaciones}/{organizacionId}");
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var linea = await respuesta.Content.ReadFromJsonAsync<LineaDeTiempoDelRegistroDto>();
        Assert.Contains(linea!.Entradas.SelectMany(x => x.Cambios), x => x.CampoId == "correoContacto" && x.ValorNuevo == correoNuevo);

        // «consultar» es el verbo nuevo de CK_BitacoraAuditoria_Accion (V20261110_11): si el guion no
        // lo hubiera ampliado, la lectura habría respondido 500 al escribir esta línea.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE Accion = N'consultar' "
            + $"AND IdRegistroAfectado = N'{organizacionId}' "
            + "AND JSON_VALUE(ValoresNuevos, '$.evento') = N'ConsultaDeDatosPersonales';"), CultureInfo.InvariantCulture));
        // Y la línea no copia el valor personal.
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE Accion = N'consultar' "
            + $"AND IdRegistroAfectado = N'{organizacionId}' AND ValoresNuevos LIKE N'%{correoNuevo}%';"),
            CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task El_Nit_Es_Dato_De_La_Organizacion_Y_El_Municipio_Se_Guarda_Con_Su_Nombre()
    {
        var (cliente, organizacionId, _) = await OrganizacionConFestivalAsync("nit");
        var perfil = await cliente.GetFromJsonAsync<PerfilOrganizacionDto>($"/api/v1/externo/organizaciones/{organizacionId}/perfil");

        // OTRO MUNICIPIO que el de la sede de hoy, con el nombre que debe quedar en el historial.
        var otro = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio + N'|' + NombreMunicipio + N'|' + NombreDepartamento "
            + $"FROM dbo.Divipola WHERE CodigoMunicipio <> N'{perfil!.CodigoMunicipioSede}' ORDER BY CodigoMunicipio DESC;"),
            CultureInfo.InvariantCulture)!.Split('|');
        var correoNuevo = $"nit.{Guid.NewGuid():N}"[..20] + "@organizacion.test";

        var guardado = await EnviarAsync(cliente, HttpMethod.Put, $"/api/v1/externo/organizaciones/{organizacionId}/perfil",
            new Dictionary<string, object?>
            {
                ["nombre"] = perfil.Nombre,
                ["nombreLegal"] = perfil.NombreLegal,
                ["numeroIdentificacion"] = "900123456-8",
                ["descripcion"] = perfil.Descripcion,
                ["correoContacto"] = correoNuevo,
                ["telefonoContacto"] = perfil.TelefonoContacto,
                ["sitioWeb"] = perfil.SitioWeb,
                ["facebook"] = perfil.Facebook,
                ["instagram"] = perfil.Instagram,
                ["otroEnlace"] = perfil.OtroEnlace,
                ["direccion"] = perfil.Direccion,
                ["codigoDepartamentoSede"] = otro[0],
                ["codigoMunicipioSede"] = otro[1],
                ["archivoFotoId"] = null,
            });
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);

        // El NIT es dato de la propia organización: clase «organizacion», no «identificacion».
        Assert.Equal("organizacion", Convert.ToString(await _base.EscalarAsync(
            "SELECT ClaseDato FROM dbo.CambiosDeRegistro WHERE ModuloId = N'organizaciones' "
            + $"AND RegistroId = N'{organizacionId}' AND CampoId = N'numeroIdentificacion';"), CultureInfo.InvariantCulture));

        // El código es interno: se guarda con el nombre que tenía ese día.
        Assert.Equal($"{otro[2]} ({otro[3]})", Convert.ToString(await _base.EscalarAsync(
            "SELECT NombreNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'organizaciones' "
            + $"AND RegistroId = N'{organizacionId}' AND CampoId = N'codigoMunicipioSede';"), CultureInfo.InvariantCulture));
        Assert.Equal(otro[1], Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'organizaciones' "
            + $"AND RegistroId = N'{organizacionId}' AND CampoId = N'codigoMunicipioSede';"), CultureInfo.InvariantCulture));

        // LA ORGANIZACIÓN LEE SU NIT Y EL NOMBRE DEL MUNICIPIO; NO LEE EL CORREO.
        var respuesta = await cliente.GetAsync(
            $"/api/v1/externo/organizaciones/{organizacionId}/historial/{Modulos.Organizaciones}/{organizacionId}");
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        var cambios = (await respuesta.Content.ReadFromJsonAsync<LineaDeTiempoDelRegistroDto>())!
            .Entradas.SelectMany(x => x.Cambios).ToList();
        Assert.Contains(cambios, x => x.CampoId == "numeroIdentificacion" && x.ValorNuevo == "900123456-8");
        Assert.Contains(cambios, x => x.CampoId == "codigoMunicipioSede" && x.NombreNuevo == $"{otro[2]} ({otro[3]})");
        Assert.DoesNotContain(cambios, x => x.CampoId == "correoContacto");
    }

    [HechoSqlServer]
    public async Task La_Organizacion_Que_Pasa_A_Administrar_Ve_El_Historial_Anterior_Y_La_Anterior_Ya_No()
    {
        var (anterior, organizacionAnterior, festivalId) = await OrganizacionConFestivalAsync("antes");
        var (nueva, organizacionNueva, _) = await OrganizacionConFestivalAsync("despues");

        var creada = await EnviarAsync(anterior, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/ediciones",
            new { anio = 2041, nombre = "Edición 2041", director = "Ana" });
        creada.EnsureSuccessStatusCode();
        var edicionId = int.Parse((await creada.Content.ReadFromJsonAsync<EdicionFestivalDto>())!.Id, CultureInfo.InvariantCulture);
        (await EnviarAsync(anterior, HttpMethod.Put, $"/api/v1/externo/ediciones/{edicionId}",
            new { anio = 2041, nombre = "Edición 2041", director = "Beatriz" })).EnsureSuccessStatusCode();

        // La fila queda con la organización que administraba entonces.
        Assert.Equal(organizacionAnterior, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT TOP (1) OrganizacionId FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' "
            + $"AND RegistroId = N'{edicionId}';"), CultureInfo.InvariantCulture));

        // El Festival pasa a otra organización administradora.
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var festival = await db.FestivalRecords.SingleAsync(x => x.Id == festivalId);
            festival.OrganizacionPrincipalId = organizacionNueva;
            await db.SaveChangesAsync();
        }

        var ruta = $"/historial/{Modulos.EdicionesDeFestival}/{edicionId}";
        var paraLaNueva = await nueva.GetFromJsonAsync<LineaDeTiempoDelRegistroDto>(
            $"/api/v1/externo/organizaciones/{organizacionNueva}{ruta}");
        Assert.Contains(paraLaNueva!.Entradas.SelectMany(x => x.Cambios), x => x.CampoId == "director" && x.ValorNuevo == "Beatriz");

        // La que ya no administra no recibe nada: la misma respuesta que un registro sin historia.
        var paraLaAnterior = await anterior.GetFromJsonAsync<LineaDeTiempoDelRegistroDto>(
            $"/api/v1/externo/organizaciones/{organizacionAnterior}{ruta}");
        Assert.Empty(paraLaAnterior!.Entradas);
    }

    [HechoSqlServer]
    public async Task Las_Listas_De_Una_Edicion_Quedan_Con_Los_Nombres_Que_Tenian()
    {
        var (cliente, _, festivalId) = await OrganizacionConFestivalAsync("listas");
        var creada = await EnviarAsync(cliente, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/ediciones",
            new { anio = 2042, nombre = "Edición 2042" });
        creada.EnsureSuccessStatusCode();
        var edicionId = int.Parse((await creada.Content.ReadFromJsonAsync<EdicionFestivalDto>())!.Id, CultureInfo.InvariantCulture);

        List<(int Id, string Nombre)> practicas;
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            practicas = (await db.PracticasMusicales.AsNoTracking().OrderBy(x => x.Id).Take(3).ToListAsync())
                .Select(x => (x.Id, x.Nombre)).ToList();
        }
        Assert.True(practicas.Count >= 3);

        (await EnviarAsync(cliente, HttpMethod.Put, $"/api/v1/externo/ediciones/{edicionId}",
            new { anio = 2042, nombre = "Edición 2042", practicasMusicalesIds = new[] { practicas[0].Id, practicas[1].Id } }))
            .EnsureSuccessStatusCode();
        (await EnviarAsync(cliente, HttpMethod.Put, $"/api/v1/externo/ediciones/{edicionId}",
            new { anio = 2042, nombre = "Edición 2042", practicasMusicalesIds = new[] { practicas[2].Id } }))
            .EnsureSuccessStatusCode();

        // El segundo guardado: de dos prácticas a una, con los nombres de cada día.
        var fila = $"FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' AND RegistroId = N'{edicionId}' "
            + "AND CampoId = N'practicasMusicales' ORDER BY IdCambio DESC;";
        Assert.Equal(practicas[2].Id.ToString(CultureInfo.InvariantCulture), Convert.ToString(
            await _base.EscalarAsync("SELECT TOP (1) ValorNuevo " + fila), CultureInfo.InvariantCulture));
        Assert.Equal(practicas[2].Nombre, Convert.ToString(
            await _base.EscalarAsync("SELECT TOP (1) NombreNuevo " + fila), CultureInfo.InvariantCulture));
        Assert.Equal($"{practicas[0].Nombre}; {practicas[1].Nombre}", Convert.ToString(
            await _base.EscalarAsync("SELECT TOP (1) NombreAnterior " + fila), CultureInfo.InvariantCulture));
        // Dos guardados con listas distintas: dos filas de la lista, y no una por cada marca.
        Assert.Equal(2, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' "
            + $"AND RegistroId = N'{edicionId}' AND CampoId = N'practicasMusicales';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Los_Lugares_Las_Entidades_Aliadas_Y_Los_Materiales_De_Una_Edicion_Quedan_En_El_Historial()
    {
        var (cliente, _, festivalId) = await OrganizacionConFestivalAsync("relaciones");
        var creada = await EnviarAsync(cliente, HttpMethod.Post, $"/api/v1/externo/festivales/{festivalId}/ediciones",
            new { anio = 2043, nombre = "Edición 2043" });
        creada.EnsureSuccessStatusCode();
        var edicionId = int.Parse((await creada.Content.ReadFromJsonAsync<EdicionFestivalDto>())!.Id, CultureInfo.InvariantCulture);

        // Dos municipios con el nombre que debe quedar en el historial.
        var uno = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio + N'|' + NombreMunicipio + N'|' + NombreDepartamento FROM dbo.Divipola ORDER BY CodigoMunicipio;"),
            CultureInfo.InvariantCulture)!.Split('|');
        var dos = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio + N'|' + NombreMunicipio + N'|' + NombreDepartamento FROM dbo.Divipola "
            + $"WHERE CodigoMunicipio <> N'{uno[1]}' ORDER BY CodigoMunicipio DESC;"), CultureInfo.InvariantCulture)!.Split('|');

        object Cuerpo(object[] lugares, string correoAliada) => new
        {
            anio = 2043,
            nombre = "Edición 2043",
            localizaciones = lugares,
            entidadesAliadas = new object[] { new { nombre = "Aliada Uno", correo = correoAliada } },
            materiales = new object[] { new { url = "https://ejemplo.test/afiche", descripcionArchivo = "Afiche" } },
        };
        (await EnviarAsync(cliente, HttpMethod.Put, $"/api/v1/externo/ediciones/{edicionId}",
            Cuerpo([new { codigoDepartamento = uno[0], codigoMunicipio = uno[1] }], "uno@aliada.test")))
            .EnsureSuccessStatusCode();
        (await EnviarAsync(cliente, HttpMethod.Put, $"/api/v1/externo/ediciones/{edicionId}",
            Cuerpo([new { codigoDepartamento = uno[0], codigoMunicipio = uno[1] }, new { codigoDepartamento = dos[0], codigoMunicipio = dos[1] }], "dos@aliada.test")))
            .EnsureSuccessStatusCode();

        string Desde(string campo) => "FROM dbo.CambiosDeRegistro WHERE ModuloId = N'ediciones-festival' "
            + $"AND RegistroId = N'{edicionId}' AND CampoId = N'{campo}'";
        string Ultima(string columna, string campo) => $"SELECT TOP (1) {columna} " + Desde(campo) + " ORDER BY IdCambio DESC;";

        // LOS LUGARES: dos guardados distintos, dos filas; la última con los dos nombres y la clase pública.
        Assert.Equal(2, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) " + Desde("lugares") + ";"), CultureInfo.InvariantCulture));
        var nombres = Convert.ToString(await _base.EscalarAsync(Ultima("NombreNuevo", "lugares")), CultureInfo.InvariantCulture)!;
        Assert.Contains($"{uno[2]} ({uno[3]})", nombres, StringComparison.Ordinal);
        Assert.Contains($"{dos[2]} ({dos[3]})", nombres, StringComparison.Ordinal);
        Assert.Equal("publico", Convert.ToString(await _base.EscalarAsync(Ultima("ClaseDato", "lugares")), CultureInfo.InvariantCulture));

        // LAS ENTIDADES ALIADAS llevan el correo: cambió, hay dos filas y es dato de CONTACTO.
        Assert.Equal(2, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) " + Desde("entidadesAliadas") + ";"), CultureInfo.InvariantCulture));
        Assert.Equal("contacto", Convert.ToString(await _base.EscalarAsync(Ultima("ClaseDato", "entidadesAliadas")), CultureInfo.InvariantCulture));
        Assert.Contains("dos@aliada.test", Convert.ToString(await _base.EscalarAsync(Ultima("NombreNuevo", "entidadesAliadas")), CultureInfo.InvariantCulture)!, StringComparison.Ordinal);
        Assert.Contains("uno@aliada.test", Convert.ToString(await _base.EscalarAsync(Ultima("NombreAnterior", "entidadesAliadas")), CultureInfo.InvariantCulture)!, StringComparison.Ordinal);

        // LOS MATERIALES no cambiaron en el segundo guardado: una sola fila, la del primero.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) " + Desde("materiales") + ";"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Guardar_La_Nomina_Del_Equipo_Escribe_Cambios_Que_La_Base_Admite_Y_No_Copia_La_Foto()
    {
        await SembrarConsolaAsync();
        using var consola = _base.CrearCliente();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CorreoConsola, Password = ClaveConsola })).EnsureSuccessStatusCode();
        await CmsTestClient.AttachCsrfAsync(consola);

        var foto = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
        var actual = JsonDocument.Parse(await consola.GetStringAsync("/api/v1/admin/equipo-web")).RootElement;
        var guardado = await consola.PostAsJsonAsync("/api/v1/admin/equipo-web", new
        {
            members = new[]
            {
                new { id = "h1-sql-1", group = "leadership", role = "Cargo uno", name = "Integrante Uno", email = "uno@pnmc.gov.co", photo = foto },
            },
            publish = false,
            version = actual.GetProperty("version").GetInt32(),
        });
        // 200 y no 500: el módulo nuevo y la clase «contacto» entran por las restricciones de la base.
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);

        Assert.Equal("contacto", Convert.ToString(await _base.EscalarAsync(
            "SELECT ClaseDato FROM dbo.CambiosDeRegistro WHERE ModuloId = N'equipo-web' AND RegistroId = N'nomina' "
            + "AND CampoId = N'integrante.h1-sql-1';"), CultureInfo.InvariantCulture));
        Assert.Contains("Integrante Uno: Cargo uno", Convert.ToString(await _base.EscalarAsync(
            "SELECT NombreNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'equipo-web' AND RegistroId = N'nomina' "
            + "AND CampoId = N'integrante.h1-sql-1';"), CultureInfo.InvariantCulture)!, StringComparison.Ordinal);
        // La fotografía no se copia al historial: solo su huella.
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'equipo-web' AND ValorNuevo LIKE N'%base64%';"),
            CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Cambiar_El_Rol_De_Un_Miembro_O_Quitarlo_Queda_En_El_Historial_De_La_Organizacion()
    {
        var (cliente, organizacionId, _) = await OrganizacionConFestivalAsync("equipo");

        int miembroId;
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var persona = new UserRow
            {
                FullName = "Persona del equipo",
                Email = $"equipo.{Guid.NewGuid():N}"[..20] + "@organizacion.test",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                PasswordHash = "no-se-usa",
            };
            db.Users.Add(persona);
            await db.SaveChangesAsync();
            db.UserEntities.Add(new UserEntityRow
            {
                UserId = persona.Id, EntityId = organizacionId, EntityRole = "editor", IsActive = true, CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
            miembroId = persona.Id;
        }

        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/equipo/miembros/{miembroId}";
        var fila = "FROM dbo.CambiosDeRegistro WHERE ModuloId = N'organizaciones' "
            + $"AND RegistroId = N'{organizacionId}' AND CampoId = N'miembro.{miembroId}' ORDER BY IdCambio ";

        Assert.Equal(HttpStatusCode.NoContent,
            (await EnviarAsync(cliente, HttpMethod.Put, ruta, new { rol = "administrador" })).StatusCode);
        Assert.Equal("editor", Convert.ToString(await _base.EscalarAsync("SELECT TOP (1) ValorAnterior " + fila + "DESC;"), CultureInfo.InvariantCulture));
        Assert.Equal("administrador", Convert.ToString(await _base.EscalarAsync("SELECT TOP (1) ValorNuevo " + fila + "DESC;"), CultureInfo.InvariantCulture));

        Assert.Equal(HttpStatusCode.NoContent, (await EnviarAsync(cliente, HttpMethod.Delete, ruta)).StatusCode);

        // Quitarlo: el rol que tenía pasa a vacío. Y la etiqueta lleva el nombre de una persona: es dato
        // de contacto y solo lo lee la consola con Auditoría (decisión 96, docs/referencia/20-decisiones-y-flujos-por-modulo.md).
        Assert.Equal("administrador", Convert.ToString(await _base.EscalarAsync("SELECT TOP (1) ValorAnterior " + fila + "DESC;"), CultureInfo.InvariantCulture));
        Assert.Null(await _base.EscalarAsync("SELECT TOP (1) ValorNuevo " + fila + "DESC;"));
        Assert.Equal("contacto", Convert.ToString(await _base.EscalarAsync("SELECT TOP (1) ClaseDato " + fila + "DESC;"), CultureInfo.InvariantCulture));
        Assert.Equal("Rol de Persona del equipo", Convert.ToString(await _base.EscalarAsync("SELECT TOP (1) CampoEtiqueta " + fila + "DESC;"), CultureInfo.InvariantCulture));
    }

    /// <summary>
    /// La migración V20261119_30 aplica la decisión 96 al historial ya escrito: las membresías pasan a
    /// «contacto», el NIT con forma de cédula a «identificacion», el NIT con forma de NIT no se toca, y
    /// repetirla no cambia nada. La clase anterior queda en la tabla de respaldo.
    /// </summary>
    [HechoSqlServer]
    public async Task La_Migracion_Reclasifica_Membresias_Y_NIT_Con_Forma_De_Cedula_Y_Se_Puede_Repetir()
    {
        const string registro = "decision96";
        string fila(string campo, string? anterior, string? despues) =>
            "INSERT INTO dbo.CambiosDeRegistro (ModuloId, RegistroId, IdGrupo, CampoId, CampoEtiqueta, ClaseDato, ValorAnterior, ValorNuevo, Origen) "
            + $"VALUES (N'organizaciones', N'{registro}', NEWID(), N'{campo}', N'x', N'organizacion', "
            + (anterior is null ? "NULL" : $"N'{anterior}'") + ", " + (despues is null ? "NULL" : $"N'{despues}'") + ", N'directo');";
        await _base.EscalarAsync(
            "DELETE FROM dbo.CambiosDeRegistro WHERE RegistroId = N'" + registro + "';"
            + fila("miembro.7", "editor", "administrador")
            + fila("numeroIdentificacion", null, "1020304050")
            + fila("numeroIdentificacion", "1.020.304.050", "900123456-8")
            + fila("numeroIdentificacion", "52123456", null)
            + fila("numeroIdentificacion", null, "900123456-8")
            + fila("numeroIdentificacion", "901900101-1", "900.123.456-8")
            + fila("nombre", null, "Nombre"));

        var guion = await File.ReadAllTextAsync(Path.Combine(RutasDelRepositorio.Esquema(), "V20261119_30__historial_clase_de_datos_de_nit_y_membresias.sql"));
        async Task<string> FirmaAsync() => Convert.ToString(await _base.EscalarAsync(
            "SELECT STRING_AGG(CAST(CampoId + N':' + ISNULL(ValorNuevo, N'-') + N'=' + ClaseDato AS nvarchar(max)), N'|') WITHIN GROUP (ORDER BY IdCambio) "
            + $"FROM dbo.CambiosDeRegistro WHERE RegistroId = N'{registro}';"), CultureInfo.InvariantCulture)!;

        await _base.EscalarAsync(guion);
        var primera = await FirmaAsync();
        Assert.Equal(
            "miembro.7:administrador=contacto|numeroIdentificacion:1020304050=identificacion|numeroIdentificacion:900123456-8=identificacion|"
            + "numeroIdentificacion:-=identificacion|numeroIdentificacion:900123456-8=organizacion|numeroIdentificacion:900.123.456-8=organizacion|nombre:Nombre=organizacion",
            primera);

        // Repetirla no cambia nada y el respaldo no duplica filas.
        var respaldo = Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) FROM dbo.CambiosDeRegistro_RespaldoClase_20261119;"), CultureInfo.InvariantCulture);
        await _base.EscalarAsync(guion);
        Assert.Equal(primera, await FirmaAsync());
        Assert.Equal(respaldo, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) FROM dbo.CambiosDeRegistro_RespaldoClase_20261119;"), CultureInfo.InvariantCulture));
        Assert.Equal(4, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.CambiosDeRegistro_RespaldoClase_20261119 r JOIN dbo.CambiosDeRegistro c ON c.IdCambio = r.IdCambio "
            + $"WHERE c.RegistroId = N'{registro}' AND r.ClaseDatoAnterior = N'organizacion';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Editar_Desde_La_Consola_La_Agenda_Y_El_Catalogo_Escribe_Cambios_Que_La_Base_Admite()
    {
        await SembrarConsolaAsync();
        using var consola = _base.CrearCliente();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CorreoConsola, Password = ClaveConsola })).EnsureSuccessStatusCode();
        await CmsTestClient.AttachCsrfAsync(consola);

        // AGENDA: un evento creado en la consola y corregido en la consola.
        var titulo = $"Evento de la consola {Guid.NewGuid():N}"[..36];
        var fecha = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(9));
        var evento = JsonDocument.Parse(await (await consola.PostAsJsonAsync("/api/v1/institucional/agenda", new
        {
            titulo, descripcion = "Evento.", fechaInicio = fecha, modalidad = "presencial", lugar = "Teatro Municipal",
        })).Content.ReadAsStringAsync()).RootElement;
        var eventoId = evento.GetProperty("id").GetInt64();
        var guardado = await consola.PutAsJsonAsync($"/api/v1/institucional/agenda/{eventoId}", new
        {
            titulo, descripcion = "Evento.", fechaInicio = fecha, modalidad = "presencial", lugar = "Teatro Distrital",
            version = evento.GetProperty("version").GetInt32(),
        });
        // 200 y no 500: el registro de cambios entra por las mismas restricciones de la base.
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        Assert.Equal("Teatro Municipal", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorAnterior FROM dbo.CambiosDeRegistro WHERE ModuloId = N'agenda' "
            + $"AND RegistroId = N'{eventoId}' AND CampoId = N'lugar';"), CultureInfo.InvariantCulture));
        Assert.Equal("Teatro Distrital", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'agenda' "
            + $"AND RegistroId = N'{eventoId}' AND CampoId = N'lugar';"), CultureInfo.InvariantCulture));
        Assert.Equal("Consola", Convert.ToString(await _base.EscalarAsync(
            "SELECT ActorRol FROM dbo.CambiosDeRegistro WHERE ModuloId = N'agenda' "
            + $"AND RegistroId = N'{eventoId}' AND CampoId = N'lugar';"), CultureInfo.InvariantCulture));

        // CATÁLOGO EDITORIAL: una ficha creada y retitulada en la consola.
        var codigo = $"ED-V2-{Guid.NewGuid():N}"[..20];
        var ficha = JsonDocument.Parse(await (await consola.PostAsJsonAsync("/api/v1/institucional/catalogo-editorial",
            new { codigo, titulo = "Título original" })).Content.ReadAsStringAsync()).RootElement;
        var fichaId = ficha.GetProperty("id").GetInt64();
        var retitulada = await consola.PutAsJsonAsync($"/api/v1/institucional/catalogo-editorial/{fichaId}", new
        {
            titulo = "Título corregido", version = ficha.GetProperty("version").GetInt32(),
        });
        Assert.Equal(HttpStatusCode.OK, retitulada.StatusCode);
        Assert.Equal("Título original", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorAnterior FROM dbo.CambiosDeRegistro WHERE ModuloId = N'catalogo-editorial' "
            + $"AND RegistroId = N'{fichaId}' AND CampoId = N'titulo';"), CultureInfo.InvariantCulture));
        Assert.Equal("Título corregido", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'catalogo-editorial' "
            + $"AND RegistroId = N'{fichaId}' AND CampoId = N'titulo';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Una_Ficha_Publicada_Del_Catalogo_Distingue_Errata_De_Cambio_De_Fondo_Y_La_Base_Admite_Los_Dos_Historiales()
    {
        // LIS-04 (G1; docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 36): el servidor decide. Los dos caminos escriben el
        // historial de estados (con su CHECK de acción y de estado) y el registro de cambios.
        await SembrarConsolaAsync();
        using var consola = _base.CrearCliente();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CorreoConsola, Password = ClaveConsola })).EnsureSuccessStatusCode();

        var codigo = $"ED-G1-{Guid.NewGuid():N}"[..20];
        var ficha = JsonDocument.Parse(await (await consola.PostAsJsonAsync("/api/v1/institucional/catalogo-editorial",
            new { codigo, titulo = "Cantos de las Sabanas del Casanare" })).Content.ReadAsStringAsync()).RootElement;
        var id = ficha.GetProperty("id").GetInt64();
        await _base.EscalarAsync($"UPDATE dbo.PublicacionesEditoriales SET EstadoPublicacion = N'publicado' WHERE IdPublicacionEditorial = {id};");

        // ERRATA: una mayúscula y una tilde. Sigue publicada y el historial dice «errata».
        var errata = await consola.PutAsJsonAsync($"/api/v1/institucional/catalogo-editorial/{id}", new
        {
            titulo = "Cantos de las Sábanas del Casanare", version = ficha.GetProperty("version").GetInt32(),
        });
        Assert.Equal(HttpStatusCode.OK, errata.StatusCode);
        Assert.Equal("publicado", Convert.ToString(await _base.EscalarAsync(
            $"SELECT EstadoPublicacion FROM dbo.PublicacionesEditoriales WHERE IdPublicacionEditorial = {id};"), CultureInfo.InvariantCulture));

        // CAMBIO DE FONDO: otro título. Vuelve a revisión y el historial dice por qué.
        var version = JsonDocument.Parse(await errata.Content.ReadAsStringAsync()).RootElement.GetProperty("version").GetInt32();
        var fondo = await consola.PutAsJsonAsync($"/api/v1/institucional/catalogo-editorial/{id}", new
        {
            titulo = "Músicas del Llano", version,
        });
        Assert.Equal(HttpStatusCode.OK, fondo.StatusCode);
        Assert.Equal("en_revision", Convert.ToString(await _base.EscalarAsync(
            $"SELECT EstadoPublicacion FROM dbo.PublicacionesEditoriales WHERE IdPublicacionEditorial = {id};"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'catalogo-editorial' "
            + $"AND RegistroId = N'{id}' AND Accion = N'CambioDeFondoEnPublicado' AND Comentario LIKE N'%el título%';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'catalogo-editorial' "
            + $"AND RegistroId = N'{id}' AND Accion = N'ErrataCorregida';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Subir_La_Misma_Imagen_Con_Otra_Descripcion_La_Actualiza_Y_Deja_El_Cambio_Que_La_Base_Admite()
    {
        await SembrarConsolaAsync();
        using var consola = _base.CrearCliente();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CorreoConsola, Password = ClaveConsola })).EnsureSuccessStatusCode();
        // LAS SUBIDAS AL BANCO DE ARCHIVOS EXIGEN EL TESTIGO ANTIFORGERY: sin él responde 400.
        await CmsTestClient.AttachCsrfAsync(consola);

        // Bytes distintos en cada corrida: el banco de la prueba se comparte con otras.
        var datos = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
        var marca = Guid.NewGuid().ToString("N");

        static MultipartFormDataContent Formulario(byte[] bytes, string alt)
        {
            var contenido = new MultipartFormDataContent();
            var parte = new ByteArrayContent(bytes);
            parte.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
            contenido.Add(parte, "file", "prueba.png");
            contenido.Add(new StringContent(alt), "alt");
            return contenido;
        }

        var primera = await consola.PostAsync("/api/v1/institucional/archivos", Formulario(datos, "Primera " + marca));
        Assert.Contains(primera.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.OK });
        var id = (await primera.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var segunda = await consola.PostAsync("/api/v1/institucional/archivos", Formulario(datos, "Segunda " + marca));

        // 200 y no 500: la bitácora que escribe el registrador pasa por CK_BitacoraAuditoria_Accion y
        // el CK de JSON válido, y el cambio por CK_CambiosDeRegistro_*.
        Assert.Equal(HttpStatusCode.OK, segunda.StatusCode);
        var cuerpo = await segunda.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(cuerpo.GetProperty("descripcionActualizada").GetBoolean());

        Assert.Equal("Primera " + marca, Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorAnterior FROM dbo.CambiosDeRegistro WHERE ModuloId = N'archivos' "
            + $"AND RegistroId = N'{id}' AND CampoId = N'altText';"), CultureInfo.InvariantCulture));
        Assert.Equal("Segunda " + marca, Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'archivos' "
            + $"AND RegistroId = N'{id}' AND CampoId = N'altText';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE Accion = N'actualizar' "
            + $"AND IdRegistroAfectado = N'{id}' AND TablaAfectada = N'Archivos';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Confirmar_La_Importacion_De_Organizaciones_Escribe_Quien_La_Crea_Y_La_Base_Lo_Admite()
    {
        // EL DEFECTO (D5b): el dominio nunca fijaba `IdUsuarioCreador`, una columna obligatoria con clave
        // foránea. SQLite no la aplica y SQL Server respondía 500 al confirmar. Solo este carril lo ve.
        await SembrarConsolaAsync();
        using var consola = _base.CrearCliente();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CorreoConsola, Password = ClaveConsola })).EnsureSuccessStatusCode();
        var testigo = await consola.GetFromJsonAsync<JsonElement>("/api/v1/admin/importaciones/organizaciones/csrf");
        consola.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        consola.DefaultRequestHeaders.Add("X-CSRF-TOKEN", testigo.GetProperty("token").GetString());

        var marca = Guid.NewGuid().ToString("N")[..10];
        var nombre = "Corporación importada " + marca;
        var previa = await consola.PostAsJsonAsync("/api/v1/admin/importaciones/organizaciones/previsualizar", new
        {
            nombreArchivo = "organizaciones.csv",
            formato = "csv",
            huellaArchivo = marca.PadRight(64, 'a'),
            versionContrato = 1,
            filas = new[]
            {
                new
                {
                    numeroFila = 2,
                    valores = new Dictionary<string, string?>
                    {
                        ["nombre"] = nombre,
                        ["departamentoSede"] = "Antioquia",
                        ["municipioSede"] = "Medellín",
                    },
                },
            },
        });
        previa.EnsureSuccessStatusCode();
        var lote = (await previa.Content.ReadFromJsonAsync<ImportacionDto>())!;
        Assert.Equal(1, lote.FilasImportables);

        var confirmada = await consola.PostAsJsonAsync($"/api/v1/admin/importaciones/organizaciones/{lote.Id}/confirmar", new
        {
            huellaPlan = lote.HuellaPlan,
            claveIdempotencia = "d5b-" + marca,
            idsFilasExcluidas = Array.Empty<long>(),
        });

        // 200 y no 500: la clave foránea de IdUsuarioCreador se cumple.
        Assert.Equal(HttpStatusCode.OK, confirmada.StatusCode);
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.Entidades e JOIN dbo.Usuarios u ON u.IdUsuario = e.IdUsuarioCreador "
            + $"WHERE e.Nombre = N'{nombre}' AND u.CorreoElectronico = N'{CorreoConsola}';"), CultureInfo.InvariantCulture));
    }

    // ---------- Andamio ---------------------------------------------------------------------------

    private async Task SembrarConsolaAsync()
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var usuarioId = await db.Users.Where(x => x.Email == CorreoConsola).Select(x => (int?)x.Id).FirstOrDefaultAsync();
        if (usuarioId is null)
        {
            var idWebmaster = await db.Roles.AsNoTracking().Where(x => x.Name == "webmaster").Select(x => x.Id).FirstAsync();
            var usuario = new UserRow
            {
                FullName = "Consola del historial",
                Email = CorreoConsola,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            };
            usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, ClaveConsola);
            db.Users.Add(usuario);
            await db.SaveChangesAsync();
            await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);
            usuarioId = usuario.Id;
        }

        // LA IMPORTACIÓN NECESITA UNA ORGANIZACIÓN INSTITUCIONAL que responda por lo importado: sin ella
        // confirma con 503. En una base nueva no existe hasta que alguna otra prueba la siembra, y entonces
        // esta prueba pasaba o fallaba según el ORDEN en que corriera. Se asegura aquí.
        if (!await db.EntityProfiles.AnyAsync(x => x.IsInstitutional))
        {
            db.EntityProfiles.Add(new EntityProfileRow
            {
                EntityType = "organizacion",
                Name = "Plan Nacional de Música para la Convivencia",
                StatusCode = "activa",
                IsActive = true,
                IsInstitutional = true,
                CreatedByUserId = usuarioId.Value,
                ResponsibleUserId = usuarioId.Value,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
    }

    private async Task<(HttpClient Cliente, int OrganizacionId, int FestivalId)> OrganizacionConFestivalAsync(string marca)
    {
        var cliente = _base.CrearCliente();
        var correo = $"hist.{marca}.{Guid.NewGuid():N}"[..24] + "@organizacion.test";

        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio FROM dbo.Divipola "
            + "ORDER BY CodigoDepartamento, CodigoMunicipio;"), CultureInfo.InvariantCulture)!.Split('|');

        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización " + marca,
            FullName = "Responsable " + marca,
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = par[0],
            HeadquartersMunicipalityCode = par[1],
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login",
            new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var mias = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/mis");
        var organizacionId = int.Parse(mias[0].GetProperty("id").GetString()!, CultureInfo.InvariantCulture);

        var creado = await EnviarAsync(cliente, HttpMethod.Post, $"/api/v1/externo/organizaciones/{organizacionId}/festivales",
            new { nombre = "Festival " + marca, nivelCobertura = "nacional", sedeCodigoDepartamento = "05", sedeCodigoMunicipio = "05001" });
        creado.EnsureSuccessStatusCode();
        var festivalId = int.Parse(
            (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!, CultureInfo.InvariantCulture);

        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var festival = await db.FestivalRecords.SingleAsync(x => x.Id == festivalId);
            festival.StatusCode = "publicado";
            await db.SaveChangesAsync();
        }

        return (cliente, organizacionId, festivalId);
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) mensaje.Content = JsonContent.Create(cuerpo);
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await cliente.SendAsync(mensaje);
    }
}
