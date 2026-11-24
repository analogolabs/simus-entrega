using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El perfil público enriquecido contra el motor real (ME, docs/desarrollo/19-cuentas-y-organizaciones.md §19.12).
/// </summary>
/// <remarks>
/// <b>POR QUÉ VIVE EN LA VÍA DE SQL SERVER.</b> SQLite no aplica <c>CK_PerfilesPublicos_Visibilidad</c> ni
/// <c>CK_PerfilesPublicos_Json</c> (que obliga a que las listas sean JSON válido), ni
/// <c>CK_CambiosDeRegistro_*</c>. Guardar el perfil escribe una fila de historial por campo y una línea de bitácora: un valor
/// que la base rechaza solo se ve aquí, como un 500. Omitida salvo que se encienda <c>SIMUS_PRUEBAS_SQLSERVER=1</c>.
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class PerfilPublicoSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private readonly SqlServerFixture _base;

    public PerfilPublicoSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task Guardar_Y_Publicar_El_Perfil_Enriquecido_Escribe_Historial_Que_La_Base_Admite()
    {
        var (cliente, organizacionId) = await PersonaConOrganizacionAsync("enriquecido");

        var guardado = await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", new PerfilPublicoSolicitud
        {
            NombreVisible = "Rosa la maestra",
            BiografiaCorta = "Maestra de marimba.",
            BiografiaLarga = "Enseño marimba en el Pacífico desde hace veinte años.",
            Oficios = ["Maestra", "Cantadora"],
            Portafolio = [new ItemDePortafolioDto("audio", "Currulao", "https://musica.example.org/currulao")],
            IdsOrganizaciones = [organizacionId],
            Visibilidad = "solo_simus",
            NombreCivilVisible = true,
        });

        // 200 y no 500: las columnas JSON y la visibilidad pasan por sus CK, y el historial por los suyos.
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        Assert.Equal("solo_simus", mio.Visibilidad);
        Assert.Equal(["Maestra", "Cantadora"], mio.Oficios);

        var usuario = await IdDeLaCuentaAsync(cliente);
        Assert.Equal("Maestra de marimba.", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'perfiles-publicos-persona' "
            + $"AND RegistroId = N'{usuario}' AND CampoId = N'biografiaCorta';"), CultureInfo.InvariantCulture));
        Assert.Equal("solo_simus", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'perfiles-publicos-persona' "
            + $"AND RegistroId = N'{usuario}' AND CampoId = N'visibilidad';"), CultureInfo.InvariantCulture));
        // El nombre civil es un dato de contacto: su historia no la lee la organización.
        Assert.Equal("contacto", Convert.ToString(await _base.EscalarAsync(
            "SELECT ClaseDato FROM dbo.CambiosDeRegistro WHERE ModuloId = N'perfiles-publicos-persona' "
            + $"AND RegistroId = N'{usuario}' AND CampoId = N'nombreCivilVisible';"), CultureInfo.InvariantCulture));

        // Y el historial se lee por su titular.
        var historial = await cliente.GetFromJsonAsync<List<CambioDePerfilPublicoDto>>("/api/v1/externo/cuenta/perfil-publico/historial");
        Assert.Contains(historial!, cambio => cambio.Campo == "Biografía corta" && cambio.Nuevo == "Maestra de marimba.");
    }

    [HechoSqlServer]
    public async Task La_Base_Rechaza_Una_Visibilidad_Y_Un_Json_Invalidos()
    {
        var (cliente, _) = await PersonaConOrganizacionAsync("ck");
        (await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", new PerfilPublicoSolicitud { NombreVisible = "Ana" }))
            .EnsureSuccessStatusCode();
        var usuario = await IdDeLaCuentaAsync(cliente);

        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(
            "BEGIN TRY UPDATE dbo.PerfilesPublicos SET Visibilidad = N'privado' WHERE IdUsuario = " + usuario
            + "; SELECT N'aceptó'; END TRY BEGIN CATCH SELECT N'rechazó'; END CATCH"), CultureInfo.InvariantCulture));
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(
            "BEGIN TRY UPDATE dbo.PerfilesPublicos SET RolesJson = N'esto no es json' WHERE IdUsuario = " + usuario
            + "; SELECT N'aceptó'; END TRY BEGIN CATCH SELECT N'rechazó'; END CATCH"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task La_Residencia_De_La_Cuenta_Pasa_Por_Sus_Restricciones_Y_El_Nombre_Civil_De_Una_Cuenta_De_Organizacion_Sale()
    {
        var (cliente, _) = await PersonaConOrganizacionAsync("residencia");
        var usuario = await IdDeLaCuentaAsync(cliente);
        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio FROM dbo.Divipola ORDER BY CodigoDepartamento, CodigoMunicipio;"),
            CultureInfo.InvariantCulture)!.Split('|');

        // La cuenta de organización solo tiene el nombre completo: el nombre civil sale igual.
        var publico = await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico",
            new PerfilPublicoSolicitud { NombreVisible = "Ana Música", NombreCivilVisible = true });
        publico.EnsureSuccessStatusCode();
        var mio = (await publico.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        Assert.False(string.IsNullOrWhiteSpace(mio.NombreCivilPropio));

        // La residencia se guarda con sus datos reales del catálogo.
        var guardado = await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil", new PerfilDeCuentaExternaSolicitud
        {
            PrimerNombre = "Ana", PrimerApellido = "Mosquera", TipoDocumento = "cc",
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            Telefono = "3001234567", ResidenciaCodigoDepartamento = par[0], ResidenciaCodigoMunicipio = par[1], CanalDeContactoPreferido = "correo",
        });
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);
        Assert.Equal(par[1], Convert.ToString(await _base.EscalarAsync(
            $"SELECT ResidenciaCodigoMunicipio FROM dbo.Usuarios WHERE IdUsuario = {usuario};"), CultureInfo.InvariantCulture));

        // La base rechaza un municipio de otro departamento y un canal fuera de la lista.
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(
            $"BEGIN TRY UPDATE dbo.Usuarios SET ResidenciaCodigoDepartamento = N'99', ResidenciaCodigoMunicipio = N'{par[1]}' WHERE IdUsuario = {usuario}; "
            + "SELECT N'aceptó'; END TRY BEGIN CATCH SELECT N'rechazó'; END CATCH"), CultureInfo.InvariantCulture));
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(
            $"BEGIN TRY UPDATE dbo.Usuarios SET CanalDeContactoPreferido = N'paloma' WHERE IdUsuario = {usuario}; "
            + "SELECT N'aceptó'; END TRY BEGIN CATCH SELECT N'rechazó'; END CATCH"), CultureInfo.InvariantCulture));
    }

    private async Task<(HttpClient Cliente, int OrganizacionId)> PersonaConOrganizacionAsync(string marca)
    {
        var cliente = _base.CrearCliente();
        var correo = $"perfil.{marca}.{Guid.NewGuid():N}"[..26] + "@organizacion.test";
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
        return (cliente, organizacionId);
    }

    private static async Task<string> IdDeLaCuentaAsync(HttpClient cliente)
    {
        var sesion = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/auth/me");
        return sesion.GetProperty("userId").GetString()!;
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
