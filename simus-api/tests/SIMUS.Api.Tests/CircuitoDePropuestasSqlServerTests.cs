using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El circuito de propuestas de cambio de un Festival, de punta a punta, contra SQL Server
/// con la estrategia de reintentos de produccion.
/// </summary>
/// <remarks>
/// <para>
/// POR QUE EXISTE. <c>POST /externo/festivales/{id}/propuestas-cambio</c> y
/// <c>POST /institucional/propuestas-cambio-festival/{id}/decisiones</c> abrian una
/// transaccion con <c>BeginTransactionAsync</c> fuera de la estrategia de ejecucion. Con
/// <c>EnableRetryOnFailure</c> —que es como produccion registra el contexto— EF lo prohibe y
/// el primer <c>SaveChangesAsync</c> lanza: las dos rutas respondian 500 SIEMPRE. Era el
/// mismo bloqueo que se diagnostico en la normalizacion de versiones; lo encontro la
/// documentacion del modulo Festivales leyendo el codigo, no una
/// prueba, porque el arnes de SQL Server no reintentaba y el de SQLite no tiene estrategia.
/// </para>
/// <para>
/// Mutante demostrado antes de dejar esta prueba: con el arnes reintentando y las dos rutas
/// sin la estrategia, el POST de la propuesta responde 500 y la prueba muere en el primer
/// paso del circuito.
/// </para>
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class CircuitoDePropuestasSqlServerTests
{
    private const string Correo = "agrupacion.propuestas@example.com";
    private const string Clave = "ClaveExterna123";
    private const string CorreoFuncionario = "funcionario.propuestas@pnmc.local";
    private const string ClaveFuncionario = "PnmcFuncionario123";

    private readonly SqlServerFixture _base;

    public CircuitoDePropuestasSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task Una_Propuesta_Se_Crea_Se_Envia_Y_Se_Aplica_Sobre_La_Cabecera()
    {
        Assert.Equal(_base.NombreDeBase, Convert.ToString(await _base.EscalarAsync("SELECT DB_NAME();")));

        // Linea base honesta: el arnes tiene que reintentar como produccion, o esta prueba no
        // puede ver el defecto que la justifica.
        using (var alcance = _base.Services.CreateScope())
        {
            var contexto = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var estrategia = contexto.Database.CreateExecutionStrategy();
            Assert.True(estrategia.RetriesOnFailure, "El arnes de SQL Server no reintenta: no reproduce la configuracion de produccion.");
        }

        var (departamento, municipio) = await TerritorioRealAsync();

        // 1. Una agrupacion publica un Festival (registro, organizacion, borrador, envio,
        //    decision institucional). Es el mismo tramo que Pnmc059 ya prueba; aqui es el
        //    punto de partida.
        using var agrupacion = _base.CrearCliente();
        var registro = await agrupacion.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organizacion de prueba",
            FullName = "Responsable de propuestas",
            NumeroDocumento = "1020304051",
            HeadquartersDepartmentCode = departamento,
            HeadquartersMunicipalityCode = municipio,
            Phone = "3000000000",
            Email = Correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        });
        registro.EnsureSuccessStatusCode();
        var cuenta = await registro.Content.ReadFromJsonAsync<ExternalRegisterResponse>();
        (await agrupacion.PostAsJsonAsync("/api/v1/externo/auth/login",
            new ExternalLoginRequest { Email = Correo, Password = Clave })).EnsureSuccessStatusCode();

        var organizacion = await OrganizacionDeLaCuenta.PrepararAsync(
            agrupacion, nombre: "Agrupación de las Propuestas", correoContacto: "contacto@agrupacion-propuestas.test", departamento: departamento, municipio: municipio);
        var festival = await CrearAsync<FestivalBorradorDto>(agrupacion, $"/api/v1/externo/organizaciones/{organizacion.Id}/festivales", new
        {
            nombre = "Festival con propuesta",
            descripcion = "Festival sembrado para recorrer el circuito de propuestas contra el motor real.",
            nivelCobertura = "municipal",
            codigoDepartamento = departamento,
            codigoMunicipio = municipio,
        });
        await EnviarExternoAsync(agrupacion, $"/api/v1/externo/festivales/{festival.Id}/enviar-a-revision", new { });

        await SembrarFuncionarioAsync();
        using var funcionario = _base.CrearCliente();
        (await funcionario.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CorreoFuncionario, Password = ClaveFuncionario })).EnsureSuccessStatusCode();
        await DecidirAsync(funcionario, $"/api/v1/institucional/festivales/{festival.Id}/decisiones", "/api/v1/institucional/festivales/csrf");

        var festivalId = int.Parse(festival.Id, CultureInfo.InvariantCulture);

        // 2. LA PROPUESTA. Antes del arreglo este POST respondia 500 contra SQL Server.
        var creada = await EnviarExternoAsync(agrupacion, $"/api/v1/externo/festivales/{festival.Id}/propuestas-cambio", new { });
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        var propuesta = await creada.Content.ReadFromJsonAsync<PropuestaCambioFestivalDto>();
        Assert.NotNull(propuesta);

        var editada = await EnviarExternoAsync(agrupacion, $"/api/v1/externo/festivales/{festival.Id}/propuesta-cambio", new
        {
            nombre = "Festival con propuesta, segunda versión",
            descripcion = "Contenido de la nueva versión.",
            periodicidad = "bienal",
            correoContacto = "nueva@festival.test",
            nivelCobertura = "municipal",
            codigoDepartamento = departamento,
            codigoMunicipio = municipio,
            practicasMusicalesIds = Array.Empty<int>(),
            territoriosSonorosIds = Array.Empty<int>(),
        }, HttpMethod.Put);
        Assert.Equal(HttpStatusCode.OK, editada.StatusCode);

        var enviada = await EnviarExternoAsync(agrupacion, $"/api/v1/externo/festivales/{festival.Id}/propuesta-cambio/enviar-a-revision", new { });
        Assert.Equal(HttpStatusCode.OK, enviada.StatusCode);

        // 3. LA DECISION. Tambien respondia 500 antes del arreglo.
        var bandeja = await funcionario.GetFromJsonAsync<List<PropuestaCambioFestivalRevisionDto>>("/api/v1/institucional/propuestas-cambio-festival/en-revision");
        Assert.Contains(bandeja!, item => item.Id == propuesta!.Id);
        await DecidirAsync(funcionario, $"/api/v1/institucional/propuestas-cambio-festival/{propuesta!.Id}/decisiones", "/api/v1/institucional/propuestas-cambio-festival/csrf");

        // Lo que quedo escrito, leido del motor: el expediente aplicado, SIN versión resultante. La tabla del perfil ya no existe (PR-8).
        Assert.True(await _base.EscalarAsync("SELECT OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U');") is null or DBNull,
            "dbo.PerfilesPublicosFestival debía estar retirada.");
        // EL EXPEDIENTE VIVE EN LAS TABLAS GENERICAS, y su vocabulario es el de allí: `aplicada` es lo que antes se llamaba `Publicada`.
        Assert.Equal("aplicada", Convert.ToString(await _base.EscalarAsync(
            $"SELECT Estado FROM dbo.PropuestasDeCambio WHERE IdPropuesta = {propuesta.Id};")));
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.PropuestasDeCambio WHERE IdPropuesta = {propuesta.Id} AND SubregistroResultanteId IS NOT NULL;"), CultureInfo.InvariantCulture));

        var publico = await agrupacion.GetFromJsonAsync<FestivalPublicoDto>($"/api/v1/publico/festivales/{festival.Id}");
        Assert.Equal("Festival con propuesta, segunda versión", publico!.Nombre);

        // LA PUBLICACIÓN DEJÓ SU HISTORIA EN EL SISTEMA ÚNICO (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md): campo por campo, con la
        // propuesta de la que viene y la versión que la publicó. Contra SQL Server, que es donde
        // CK_CambiosDeRegistro_* y CK_BitacoraAuditoria_* se aplican de verdad.
        Assert.Equal("Festival con propuesta", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorAnterior FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' "
            + $"AND RegistroId = N'{festivalId}' AND CampoId = N'nombre' AND Origen = N'propuesta';")));
        Assert.Equal("Festival con propuesta, segunda versión", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' "
            + $"AND RegistroId = N'{festivalId}' AND CampoId = N'nombre' AND Origen = N'propuesta';")));
        Assert.Equal("bienal", Convert.ToString(await _base.EscalarAsync(
            "SELECT ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' "
            + $"AND RegistroId = N'{festivalId}' AND CampoId = N'periodicidad';")));
        // El correo es un dato personal: se guarda, con su clase, y solo la consola lo lee.
        Assert.Equal("contacto", Convert.ToString(await _base.EscalarAsync(
            "SELECT ClaseDato FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' "
            + $"AND RegistroId = N'{festivalId}' AND CampoId = N'correoContacto';")));
        Assert.Equal(propuesta.Id.ToString(CultureInfo.InvariantCulture), Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) PropuestaId FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' "
            + $"AND RegistroId = N'{festivalId}' AND Origen = N'propuesta';"), CultureInfo.InvariantCulture));
        // La historia ya no apunta a una versión del perfil: la propuesta escribió la cabecera.
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(DISTINCT PerfilPublicoFestivalId) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' "
            + $"AND RegistroId = N'{festivalId}' AND Origen = N'propuesta';"), CultureInfo.InvariantCulture));

        // LA CABECERA, contra el motor real: lo aprobado quedó escrito en dbo.Festivales. El CHECK de cobertura y las FK de la
        // cabecera se aplican aquí.
        Assert.Equal("Festival con propuesta, segunda versión", Convert.ToString(await _base.EscalarAsync(
            $"SELECT NombreFestival FROM dbo.Festivales WHERE IdFestival = {festivalId};")));
        Assert.Equal("bienal", Convert.ToString(await _base.EscalarAsync(
            $"SELECT Periodicidad FROM dbo.Festivales WHERE IdFestival = {festivalId};")));
        Assert.Equal("nueva@festival.test", Convert.ToString(await _base.EscalarAsync(
            $"SELECT CorreoFestival FROM dbo.Festivales WHERE IdFestival = {festivalId};")));
        // Una fila por campo y por aprobación.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            "SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' "
            + $"AND RegistroId = N'{festivalId}' AND CampoId = N'nombre' AND Origen = N'propuesta';"), CultureInfo.InvariantCulture));
    }

    /// <summary>
    /// Rechazar una propuesta de Festival escribe el motivo en `MotivoDeLaDecision`, que
    /// `CK_PropuestasDeCambio_MotivoDelRechazo` exige. Antes el rechazo respondía 500 en SQL Server.
    /// </summary>
    [HechoSqlServer]
    public async Task Rechazar_Una_Propuesta_Guarda_El_Motivo_Que_Exige_La_Base()
    {
        var (departamento, municipio) = await TerritorioRealAsync();
        const string correo = "agrupacion.rechazo@example.com";

        using var agrupacion = _base.CrearCliente();
        (await agrupacion.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organizacion del rechazo",
            FullName = "Responsable del rechazo",
            NumeroDocumento = "1020304052",
            HeadquartersDepartmentCode = departamento,
            HeadquartersMunicipalityCode = municipio,
            Phone = "3000000001",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await agrupacion.PostAsJsonAsync("/api/v1/externo/auth/login",
            new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var organizacion = await OrganizacionDeLaCuenta.PrepararAsync(
            agrupacion, nombre: "Agrupación del Rechazo", correoContacto: "contacto@agrupacion-rechazo.test", departamento: departamento, municipio: municipio);
        var festival = await CrearAsync<FestivalBorradorDto>(agrupacion, $"/api/v1/externo/organizaciones/{organizacion.Id}/festivales", new
        {
            nombre = "Festival con propuesta rechazada",
            descripcion = "Festival sembrado para rechazar una propuesta contra el motor real.",
            nivelCobertura = "municipal",
            codigoDepartamento = departamento,
            codigoMunicipio = municipio,
        });
        await EnviarExternoAsync(agrupacion, $"/api/v1/externo/festivales/{festival.Id}/enviar-a-revision", new { });

        await SembrarFuncionarioAsync();
        using var funcionario = _base.CrearCliente();
        (await funcionario.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = CorreoFuncionario, Password = ClaveFuncionario })).EnsureSuccessStatusCode();
        await DecidirAsync(funcionario, $"/api/v1/institucional/festivales/{festival.Id}/decisiones", "/api/v1/institucional/festivales/csrf");

        var creada = await EnviarExternoAsync(agrupacion, $"/api/v1/externo/festivales/{festival.Id}/propuestas-cambio", new { });
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        var propuesta = await creada.Content.ReadFromJsonAsync<PropuestaCambioFestivalDto>();
        Assert.Equal(HttpStatusCode.OK, (await EnviarExternoAsync(agrupacion, $"/api/v1/externo/festivales/{festival.Id}/propuesta-cambio", new
        {
            nombre = "Festival con propuesta rechazada, cambio",
            descripcion = "Contenido que se va a rechazar.",
            nivelCobertura = "municipal",
            codigoDepartamento = departamento,
            codigoMunicipio = municipio,
            practicasMusicalesIds = Array.Empty<int>(),
            territoriosSonorosIds = Array.Empty<int>(),
        }, HttpMethod.Put)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarExternoAsync(agrupacion, $"/api/v1/externo/festivales/{festival.Id}/propuesta-cambio/enviar-a-revision", new { })).StatusCode);

        await DecidirAsync(funcionario, $"/api/v1/institucional/propuestas-cambio-festival/{propuesta!.Id}/decisiones",
            "/api/v1/institucional/propuestas-cambio-festival/csrf",
            new { accion = "Rechazar", motivoRechazo = "El cambio de nombre no tiene soporte." });

        Assert.Equal("rechazada", Convert.ToString(await _base.EscalarAsync(
            $"SELECT Estado FROM dbo.PropuestasDeCambio WHERE IdPropuesta = {propuesta.Id};")));
        Assert.Equal("El cambio de nombre no tiene soporte.", Convert.ToString(await _base.EscalarAsync(
            $"SELECT MotivoDeLaDecision FROM dbo.PropuestasDeCambio WHERE IdPropuesta = {propuesta.Id};")));
    }

    private static async Task DecidirAsync(HttpClient funcionario, string ruta, string rutaCsrf, object? cuerpo = null)
    {
        var csrf = await funcionario.GetAsync(rutaCsrf);
        csrf.EnsureSuccessStatusCode();
        var token = (await csrf.Content.ReadFromJsonAsync<TokenAntiforgeryRespuesta>())!.RequestToken;
        var decidir = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo ?? new { accion = "Publicar" }) };
        decidir.Headers.Add("X-CSRF-TOKEN", token);
        var respuesta = await funcionario.SendAsync(decidir);
        if (!respuesta.IsSuccessStatusCode)
        {
            Assert.Fail($"POST {ruta} respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
        }
    }

    private async Task SembrarFuncionarioAsync()
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        if (await db.Users.AnyAsync(item => item.Email == CorreoFuncionario))
        {
            return;
        }

        var idWebmaster = await db.Roles.AsNoTracking().Where(item => item.Name == "webmaster").Select(item => item.Id).FirstAsync();
        var usuario = new SIMUS.Domain.Entities.UserRow
        {
            FullName = "Funcionaria de propuestas",
            Email = CorreoFuncionario,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, ClaveFuncionario);
        db.Users.Add(usuario);
        await db.SaveChangesAsync();

            // LA FILA DE dbo.UsuariosRoles. `RoleId` de arriba ya no da ningun rol: desde la
            // El rol vive en la tabla de asignacion, y sin esta linea la cuenta existe
            // pero el login la rechaza con el motivo `sin_rol_valido`. Ver RolesEnPruebas.
        await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);
    }

    private async Task<(string Departamento, string Municipio)> TerritorioRealAsync()
    {
        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio FROM dbo.Divipola ORDER BY CodigoDepartamento, CodigoMunicipio;"));
        Assert.False(string.IsNullOrWhiteSpace(par), "dbo.Divipola esta vacia: el arnes no aplico la siembra de referencia.");
        var partes = par!.Split('|');
        return (partes[0], partes[1]);
    }

    private static async Task<string> CsrfExternoAsync(HttpClient cliente)
    {
        var respuesta = await cliente.GetAsync("/api/v1/externo/organizaciones/csrf");
        respuesta.EnsureSuccessStatusCode();
        return (await respuesta.Content.ReadFromJsonAsync<ExternalCsrfTokenResponse>())!.RequestToken;
    }

    private static async Task<HttpResponseMessage> EnviarExternoAsync(HttpClient cliente, string ruta, object cuerpo, HttpMethod? metodo = null)
    {
        var mensaje = new HttpRequestMessage(metodo ?? HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", await CsrfExternoAsync(cliente));
        var respuesta = await cliente.SendAsync(mensaje);
        if (!respuesta.IsSuccessStatusCode)
        {
            Assert.Fail($"{mensaje.Method} {ruta} respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
        }
        return respuesta;
    }

    private static async Task<T> CrearAsync<T>(HttpClient cliente, string ruta, object cuerpo)
    {
        var respuesta = await EnviarExternoAsync(cliente, ruta, cuerpo);
        var creado = await respuesta.Content.ReadFromJsonAsync<T>();
        Assert.NotNull(creado);
        return creado!;
    }
}
