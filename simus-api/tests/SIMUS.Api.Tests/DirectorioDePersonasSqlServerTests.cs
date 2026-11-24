using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La clasificación del perfil y el directorio de personas contra el motor real (DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13).
/// SQLite no aplica la clave foránea al perfil ni <c>CK_PerfilesPublicosClasificaciones_Dimension</c>.
/// </summary>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class DirectorioDePersonasSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private readonly SqlServerFixture _base;

    public DirectorioDePersonasSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var token = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf"))!.RequestToken;
        var mensaje = new HttpRequestMessage(metodo, ruta) { Content = JsonContent.Create(cuerpo ?? new { }) };
        mensaje.Headers.Add("X-CSRF-TOKEN", token);
        return await cliente.SendAsync(mensaje);
    }

    [HechoSqlServer]
    public async Task Clasificar_Publicar_Y_Buscar_Funciona_Y_La_Base_Rechaza_Una_Dimension_Invalida()
    {
        var cliente = _base.CrearCliente();
        var correo = $"dir.{Guid.NewGuid():N}"[..24] + "@persona.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual", FirstName = "Rosa", FirstSurname = "Directorio", DocumentType = "cc",
            DocumentNumber = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            Phone = "3000000000", Email = correo, Password = Clave, PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var guardado = await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", new PerfilPublicoSolicitud { NombreVisible = "Rosa lutier" });
        var mio = (await guardado.Content.ReadFromJsonAsync<MiPerfilPublicoDto>())!;
        var departamento = Convert.ToString(await _base.EscalarAsync("SELECT TOP (1) CodigoDepartamento FROM dbo.Divipola ORDER BY CodigoDepartamento;"), CultureInfo.InvariantCulture)!;

        var clasificada = await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion",
            new ClasificacionSolicitud { Roles = ["luthier"], Servicios = ["luteria", "clases"], Instrumentos = ["cordofonos"], CodigosDeDepartamento = [departamento] });
        Assert.Equal(HttpStatusCode.OK, clasificada.StatusCode);

        var politica = await cliente.GetFromJsonAsync<PoliticaPublicaDto>("/api/v1/publico/politicas/perfil_publico");
        (await EnviarAsync(cliente, HttpMethod.Post, "/api/v1/externo/cuenta/perfil-publico/publicar", new PublicarPerfilPublicoSolicitud { VersionAceptada = politica!.Version })).EnsureSuccessStatusCode();

        var lista = (await _base.CrearCliente().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        var persona = Assert.Single(lista, p => p.Clave == mio.Clave);
        Assert.Contains("luteria", persona.Servicios);
        Assert.Single(persona.Territorios);

        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(
            "BEGIN TRY INSERT INTO dbo.PerfilesPublicosClasificaciones (IdUsuario, Dimension, Codigo) "
            + "SELECT TOP (1) IdUsuario, N'inventada', N'x' FROM dbo.PerfilesPublicos; SELECT N'aceptó'; END TRY "
            + "BEGIN CATCH SELECT N'rechazó'; END CATCH"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task El_Registro_Con_Categorias_Crea_Un_Perfil_Oculto_Con_Sus_Filas()
    {
        var cliente = _base.CrearCliente();
        var correo = $"dir.reg.{Guid.NewGuid():N}"[..24] + "@persona.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual", FirstName = "Eva", FirstSurname = "Registro", DocumentType = "cc",
            DocumentNumber = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            Phone = "3000000000", Email = correo, Password = Clave, PoliticasAceptadas = ["tratamiento", "terminos"],
            Clasificacion = new ClasificacionSolicitud { Roles = ["docente"], Servicios = ["clases", "asesoria"] },
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var mia = (await cliente.GetFromJsonAsync<MiClasificacionDto>("/api/v1/externo/cuenta/perfil-publico/clasificacion"))!;
        Assert.True(mia.Existe);
        Assert.Equal(["asesoria", "clases"], mia.Servicios);
        // Nace oculto: sin la autorización no entra al directorio.
        var lista = (await _base.CrearCliente().GetFromJsonAsync<List<PersonaDelDirectorioDto>>("/api/v1/publico/personas"))!;
        Assert.DoesNotContain(lista, p => p.NombreVisible == "Eva Registro");
    }

    /// <summary>La taxonomía en tabla (decisión 133) contra el motor real: siembra, CHECK, únicos y desactivar sin invalidar perfiles.</summary>
    [HechoSqlServer]
    public async Task La_Taxonomia_En_Tabla_Nace_Sembrada_Y_La_Base_Impone_Sus_Restricciones()
    {
        Assert.Equal(14, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) FROM dbo.ValoresDeTaxonomiaDePerfiles WHERE Dimension = N'rol';"), CultureInfo.InvariantCulture));
        Assert.Equal(10, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) FROM dbo.ValoresDeTaxonomiaDePerfiles WHERE Dimension = N'servicio';"), CultureInfo.InvariantCulture));
        Assert.Equal(6, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) FROM dbo.ValoresDeTaxonomiaDePerfiles WHERE Dimension = N'instrumento';"), CultureInfo.InvariantCulture));
        Assert.Equal("creador", Convert.ToString(await _base.EscalarAsync("SELECT GrupoSoyCultura FROM dbo.ValoresDeTaxonomiaDePerfiles WHERE Dimension = N'rol' AND Codigo = N'luthier';"), CultureInfo.InvariantCulture));

        static string Intento(string valores) =>
            "BEGIN TRY INSERT INTO dbo.ValoresDeTaxonomiaDePerfiles (Dimension, Codigo, Nombre, GrupoSoyCultura, OrdenVisualizacion) VALUES " + valores
            + "; SELECT N'aceptó'; END TRY BEGIN CATCH SELECT N'rechazó'; END CATCH";
        // Territorio no se administra aquí; el grupo es de tres valores; el código y el nombre no se repiten por lista; el orden empieza en 1.
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(Intento("(N'territorio', N'x', N'X', NULL, 1)")), CultureInfo.InvariantCulture));
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(Intento("(N'rol', N'x2', N'X2', N'inventado', 1)")), CultureInfo.InvariantCulture));
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(Intento("(N'rol', N'docente', N'Otro nombre', NULL, 1)")), CultureInfo.InvariantCulture));
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(Intento("(N'rol', N'x3', N'Docente o formador(a) de música', NULL, 1)")), CultureInfo.InvariantCulture));
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(Intento("(N'rol', N'x4', N'X4', NULL, 0)")), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Desactivar_Un_Valor_En_La_Consola_No_Invalida_Los_Perfiles_Que_Ya_Lo_Tienen()
    {
        var cliente = _base.CrearCliente();
        var correo = $"dir.tax.{Guid.NewGuid():N}"[..24] + "@persona.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual", FirstName = "Tomas", FirstSurname = "Taxonomia", DocumentType = "cc",
            DocumentNumber = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            Phone = "3000000000", Email = correo, Password = Clave, PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        (await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico", new PerfilPublicoSolicitud { NombreVisible = "Tomas taxonomia" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion",
            new ClasificacionSolicitud { Roles = ["cultor"] })).StatusCode);

        // Desactivarlo directamente en la tabla: lo mismo que hace la consola, sin sesión institucional de por medio.
        await _base.EscalarAsync("UPDATE dbo.ValoresDeTaxonomiaDePerfiles SET Activo = 0 WHERE Dimension = N'rol' AND Codigo = N'cultor'; SELECT 1;");
        try
        {
            var taxonomia = (await _base.CrearCliente().GetFromJsonAsync<TaxonomiaDePerfilesDto>("/api/v1/publico/taxonomia-de-perfiles"))!;
            Assert.False(taxonomia.Roles.Single(r => r.Codigo == "cultor").Activo);
            // La persona conserva su valor y puede guardar de nuevo; otra persona ya no puede elegirlo.
            Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(cliente, HttpMethod.Put, "/api/v1/externo/cuenta/perfil-publico/clasificacion",
                new ClasificacionSolicitud { Roles = ["cultor"], Servicios = ["clases"] })).StatusCode);
            var mia = (await cliente.GetFromJsonAsync<MiClasificacionDto>("/api/v1/externo/cuenta/perfil-publico/clasificacion"))!;
            Assert.Equal(["cultor"], mia.Roles);
        }
        finally
        {
            await _base.EscalarAsync("UPDATE dbo.ValoresDeTaxonomiaDePerfiles SET Activo = 1 WHERE Dimension = N'rol' AND Codigo = N'cultor'; SELECT 1;");
        }
    }

    /// <summary>La jerarquía de roles (V20261118_30, decisión 135): la migración cuelga los roles de siempre y la base la protege.</summary>
    [HechoSqlServer]
    public async Task La_Jerarquia_De_Roles_Deja_Los_Codigos_De_Siempre_Bajo_Su_Categoria_Y_La_Base_Protege_El_Arbol()
    {
        string Consulta(string codigo) => "SELECT p.Codigo FROM dbo.ValoresDeTaxonomiaDePerfiles h JOIN dbo.ValoresDeTaxonomiaDePerfiles p "
            + $"ON p.IdValor = h.IdPadre WHERE h.Dimension = N'rol' AND h.Codigo = N'{codigo}';";
        Assert.Equal("creacion-e-interpretacion", Convert.ToString(await _base.EscalarAsync(Consulta("cantante")), CultureInfo.InvariantCulture));
        Assert.Equal("formacion-e-investigacion", Convert.ToString(await _base.EscalarAsync(Consulta("docente")), CultureInfo.InvariantCulture));
        Assert.Equal("tecnica-luteria-y-produccion", Convert.ToString(await _base.EscalarAsync(Consulta("luthier")), CultureInfo.InvariantCulture));
        // «gestor» es categoría sin subcategorías y no hay un rol de siempre sin lugar en el árbol.
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync("SELECT COUNT(*) FROM dbo.ValoresDeTaxonomiaDePerfiles WHERE Dimension = N'rol' AND IdPadre IS NULL AND Codigo NOT IN (N'creacion-e-interpretacion', N'formacion-e-investigacion', N'tecnica-luteria-y-produccion', N'gestor');"), CultureInfo.InvariantCulture));

        static string Intento(string valores) => "BEGIN TRY INSERT INTO dbo.ValoresDeTaxonomiaDePerfiles (Dimension, Codigo, Nombre, IdPadre, OrdenVisualizacion) VALUES "
            + valores + "; SELECT N'aceptó'; END TRY BEGIN CATCH SELECT N'rechazó'; END CATCH";
        // Un padre que no existe lo rechaza la clave foránea.
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(Intento("(N'rol', N'h1', N'H1', 2147483000, 1)")), CultureInfo.InvariantCulture));
        // Una fila no puede ser su propio padre.
        Assert.Equal("rechazó", Convert.ToString(await _base.EscalarAsync(
            "BEGIN TRY UPDATE dbo.ValoresDeTaxonomiaDePerfiles SET IdPadre = IdValor WHERE Dimension = N'rol' AND Codigo = N'gestor'; SELECT N'aceptó'; END TRY BEGIN CATCH SELECT N'rechazó'; END CATCH"), CultureInfo.InvariantCulture));
    }
}
