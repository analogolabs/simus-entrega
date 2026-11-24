using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Api.Historial;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El registro de cambios por campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md): lo que valía antes ya no se pierde.
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE ESTAS PRUEBAS VIGILAN.</b> Una edición se corrige sobre sí misma, y hasta ahora el valor
/// anterior se perdía. Aquí se mira que (1) cada guardado deje una fila por campo que cambió con su
/// valor anterior y nuevo y su autor, (2) un guardado sin cambios no deje nada, (3) la organización
/// lea lo suyo y no lo de otra, y (4) los datos personales se guarden pero solo la consola los lea, y
/// esa lectura quede en la bitácora.
/// </para>
/// <para>
/// <b>LO QUE ESTAS PRUEBAS NO PUEDEN DECIR.</b> SQLite no aplica <c>CK_BitacoraAuditoria_Accion</c> ni
/// <c>CK_CambiosDeRegistro_*</c>. Lo que escribe bitácora o historial se prueba también contra SQL
/// Server en <c>HistorialDeCambiosSqlServerTests</c>.
/// </para>
/// </remarks>
public sealed class HistorialDeCambiosTests : IClassFixture<TestWebApplicationFactory>
{
    private const string Clave = "ClaveExterna123";

    private readonly TestWebApplicationFactory _factory;

    public HistorialDeCambiosTests(TestWebApplicationFactory factory) => _factory = factory;

    private static readonly string[] CamposDeEjemplo = ["correoContacto"];

    private static readonly string[] ClasesDelEsquema = ["publico", "organizacion", "contacto", "identificacion", "sensible"];

    private sealed record Cuenta(HttpClient Cliente, int OrganizacionId, int FestivalId);

    // ---------- Edición de Festival -----------------------------------------------------------------

    [Fact]
    public async Task Corregir_Una_Edicion_Guarda_Lo_Que_Valia_Antes_Y_Quien_Lo_Cambio()
    {
        var cuenta = await RegistrarConFestivalPublicadoAsync("corrige");
        var edicionId = await CrearEdicionAsync(cuenta, 2031, director: "Ana");

        var corregida = await EnviarAsync(cuenta.Cliente, HttpMethod.Put, $"/api/v1/externo/ediciones/{edicionId}",
            new { anio = 2031, nombre = "Edición 2031", director = "Beatriz" });
        Assert.Equal(HttpStatusCode.OK, corregida.StatusCode);

        var filas = await FilasAsync(Modulos.EdicionesDeFestival, edicionId);

        // EL VALOR ANTERIOR NO SE PIERDE: es la brecha G1 de docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md, la que motivó todo esto.
        var director = Assert.Single(filas, x => x.CampoId == "director");
        Assert.Equal("Ana", director.ValorAnterior);
        Assert.Equal("Beatriz", director.ValorNuevo);
        Assert.Equal("publico", director.ClaseDato);
        Assert.Equal(OrigenDelCambio.Directo, director.Origen);
        Assert.Equal(cuenta.OrganizacionId, director.OrganizacionId);
        Assert.NotNull(director.ActorId);
        Assert.False(string.IsNullOrWhiteSpace(director.ActorNombre), "el nombre se copia al escribir");

        // SOLO LO QUE CAMBIÓ: el año y el nombre se enviaron igual.
        Assert.DoesNotContain(filas, x => x.CampoId is "anio" or "nombre");

        // Y LA BITÁCORA CUMPLE EL CONTRATO: evento estable, sin valores personales, origen.
        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var linea = await db.AuditLogs.AsNoTracking()
            .Where(x => x.TableName == "EdicionesFestival" && x.RecordId == edicionId.ToString(CultureInfo.InvariantCulture))
            .OrderByDescending(x => x.Id).FirstAsync();
        Assert.Equal("actualizar", linea.Action);
        using var cuerpo = JsonDocument.Parse(linea.NewValuesJson!);
        Assert.Equal("CambioDeRegistro", cuerpo.RootElement.GetProperty("evento").GetString());
        Assert.Equal("directo", cuerpo.RootElement.GetProperty("origen").GetString());
        Assert.Contains("director", cuerpo.RootElement.GetProperty("despues").GetProperty("campos")
            .EnumerateArray().Select(x => x.GetString()));
    }

    [Fact]
    public async Task Guardar_Sin_Cambiar_Nada_No_Deja_Filas()
    {
        var cuenta = await RegistrarConFestivalPublicadoAsync("sincambio");
        var edicionId = await CrearEdicionAsync(cuenta, 2032, director: "Ana");

        var igual = await EnviarAsync(cuenta.Cliente, HttpMethod.Put, $"/api/v1/externo/ediciones/{edicionId}",
            new { anio = 2032, nombre = "Edición 2032", director = "Ana" });
        Assert.Equal(HttpStatusCode.OK, igual.StatusCode);

        Assert.Empty(await FilasAsync(Modulos.EdicionesDeFestival, edicionId));
    }

    [Fact]
    public async Task La_Organizacion_Lee_El_Historial_De_Lo_Suyo_Y_No_El_De_Otra()
    {
        var duena = await RegistrarConFestivalPublicadoAsync("duena");
        var ajena = await RegistrarConFestivalPublicadoAsync("ajena");
        var edicionId = await CrearEdicionAsync(duena, 2033, director: "Ana");
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(duena.Cliente, HttpMethod.Put,
            $"/api/v1/externo/ediciones/{edicionId}", new { anio = 2033, nombre = "Edición 2033", director = "Beatriz" })).StatusCode);

        var ruta = $"/api/v1/externo/organizaciones/{duena.OrganizacionId}/historial/{Modulos.EdicionesDeFestival}/{edicionId}";

        var suyo = await duena.Cliente.GetFromJsonAsync<LineaDeTiempoDelRegistroDto>(ruta);
        var guardado = Assert.Single(suyo!.Entradas, x => x.Tipo == "cambios");
        var campo = Assert.Single(guardado.Cambios, x => x.CampoId == "director");
        Assert.Equal("Ana", campo.ValorAnterior);
        Assert.Equal("Beatriz", campo.ValorNuevo);
        Assert.Equal("2026-11-10", suyo.InicioDelRegistro);

        // OTRA ORGANIZACIÓN NO LEE EL HISTORIAL AJENO, ni preguntando con su propio identificador.
        Assert.Equal(HttpStatusCode.NotFound, (await ajena.Cliente.GetAsync(ruta)).StatusCode);
        var conLaPropia = await ajena.Cliente.GetFromJsonAsync<LineaDeTiempoDelRegistroDto>(
            $"/api/v1/externo/organizaciones/{ajena.OrganizacionId}/historial/{Modulos.EdicionesDeFestival}/{edicionId}");
        Assert.DoesNotContain(conLaPropia!.Entradas, x => x.Tipo == "cambios");

        // Sin sesión, nada.
        var anonimo = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonimo.GetAsync(ruta)).StatusCode);

        // Y un módulo que no es de la organización no existe para esta ruta.
        Assert.Equal(HttpStatusCode.NotFound, (await duena.Cliente.GetAsync(
            $"/api/v1/externo/organizaciones/{duena.OrganizacionId}/historial/{Modulos.Noticias}/1")).StatusCode);
    }

    // ---------- Datos personales -------------------------------------------------------------------

    [Fact]
    public async Task Los_Datos_Personales_Se_Guardan_Pero_Solo_La_Consola_Los_Lee_Y_Queda_Rastro()
    {
        var cuenta = await RegistrarConFestivalPublicadoAsync("personales");

        var perfil = await cuenta.Cliente.GetFromJsonAsync<PerfilOrganizacionDto>(
            $"/api/v1/externo/organizaciones/{cuenta.OrganizacionId}/perfil");
        Assert.NotNull(perfil);
        var correoAnterior = perfil!.CorreoContacto;
        var correoNuevo = $"nuevo.{Guid.NewGuid():N}"[..24] + "@organizacion.test";

        var guardado = await EnviarAsync(cuenta.Cliente, HttpMethod.Put,
            $"/api/v1/externo/organizaciones/{cuenta.OrganizacionId}/perfil",
            new Dictionary<string, object?>
            {
                ["nombre"] = perfil.Nombre,
                ["nombreLegal"] = perfil.NombreLegal,
                ["numeroIdentificacion"] = null,
                ["descripcion"] = "Descripción nueva.",
                ["correoContacto"] = correoNuevo,
                ["telefonoContacto"] = perfil.TelefonoContacto,
                ["sitioWeb"] = perfil.SitioWeb,
                ["facebook"] = perfil.Facebook,
                ["instagram"] = perfil.Instagram,
                ["otroEnlace"] = perfil.OtroEnlace,
                ["direccion"] = perfil.Direccion,
                ["codigoDepartamentoSede"] = perfil.CodigoDepartamentoSede ?? "11",
                ["codigoMunicipioSede"] = perfil.CodigoMunicipioSede ?? "11001",
                ["archivoFotoId"] = null,
            });
        Assert.Equal(HttpStatusCode.OK, guardado.StatusCode);

        // SE GUARDA EL VALOR, con su clase.
        var filas = await FilasAsync(Modulos.Organizaciones, cuenta.OrganizacionId);
        var correo = Assert.Single(filas, x => x.CampoId == "correoContacto");
        Assert.Equal("contacto", correo.ClaseDato);
        Assert.Equal(correoNuevo, correo.ValorNuevo);
        Assert.Equal(correoAnterior, correo.ValorAnterior);
        var descripcion = Assert.Single(filas, x => x.CampoId == "descripcion");
        Assert.Equal("publico", descripcion.ClaseDato);

        // LA ORGANIZACIÓN NO LO LEE: solo recibe lo público.
        var suyo = await cuenta.Cliente.GetFromJsonAsync<LineaDeTiempoDelRegistroDto>(
            $"/api/v1/externo/organizaciones/{cuenta.OrganizacionId}/historial/{Modulos.Organizaciones}/{cuenta.OrganizacionId}");
        var campos = suyo!.Entradas.SelectMany(x => x.Cambios).ToList();
        Assert.Contains(campos, x => x.CampoId == "descripcion");
        Assert.DoesNotContain(campos, x => x.CampoId == "correoContacto");
        // NI EN CRUDO: el valor personal no viaja ni siquiera como texto de otro campo.
        var crudo = await cuenta.Cliente.GetStringAsync(
            $"/api/v1/externo/organizaciones/{cuenta.OrganizacionId}/historial/{Modulos.Organizaciones}/{cuenta.OrganizacionId}");
        Assert.DoesNotContain(correoNuevo, crudo, StringComparison.Ordinal);

        // LA CONSOLA CON EL MÓDULO DE AUDITORÍA SÍ, y esa lectura queda en la bitácora.
        var consola = _factory.CreateClient();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" })).EnsureSuccessStatusCode();

        var antesDeLeer = await LecturasRegistradasAsync(cuenta.OrganizacionId);
        var completa = await consola.GetFromJsonAsync<LineaDeTiempoDelRegistroDto>(
            $"/api/v1/admin/historial/{Modulos.Organizaciones}/{cuenta.OrganizacionId}");
        var camposConsola = completa!.Entradas.SelectMany(x => x.Cambios).ToList();
        Assert.Equal(correoNuevo, Assert.Single(camposConsola, x => x.CampoId == "correoContacto").ValorNuevo);
        Assert.Equal(0, completa.CamposOcultos);

        Assert.Equal(antesDeLeer + 1, await LecturasRegistradasAsync(cuenta.OrganizacionId));

        // LO QUE QUEDA EN LA BITÁCORA SON LOS NOMBRES DE LOS CAMPOS, NUNCA LOS VALORES.
        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var lectura = await db.AuditLogs.AsNoTracking()
            .Where(x => x.Action == "consultar" && x.RecordId == cuenta.OrganizacionId.ToString(CultureInfo.InvariantCulture))
            .OrderByDescending(x => x.Id).FirstAsync();
        Assert.DoesNotContain(correoNuevo, lectura.NewValuesJson!, StringComparison.Ordinal);
        if (!string.IsNullOrEmpty(correoAnterior))
        {
            Assert.DoesNotContain(correoAnterior, lectura.NewValuesJson!, StringComparison.Ordinal);
        }
        Assert.Contains("correoContacto", lectura.NewValuesJson!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task La_Consola_Exige_Sesion_Y_Un_Modulo_Conocido()
    {
        var anonimo = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonimo.GetAsync($"/api/v1/admin/historial/{Modulos.Organizaciones}/1")).StatusCode);

        var consola = _factory.CreateClient();
        (await consola.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = "test@pnmc.local", Password = "pnmc-master" })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound,
            (await consola.GetAsync("/api/v1/admin/historial/no-existe/1")).StatusCode);
    }

    // ---------- Contrato de la bitácora ------------------------------------------------------------

    [Fact]
    public void La_Bitacora_No_Escribe_Un_Evento_Que_No_Esta_En_El_Catalogo()
    {
        var ahora = DateTime.UtcNow;

        var inventado = Assert.Throws<ArgumentException>(() => ContratoDeBitacora.Nueva(
            AccionesAuditoria.Actualizar, "EventoInventado", 1, "Festivales", "1", null, null, null,
            OrigenDelCambio.Directo, ahora));
        Assert.Contains("catálogo", inventado.Message, StringComparison.OrdinalIgnoreCase);

        var verboFalso = Assert.Throws<ArgumentException>(() => ContratoDeBitacora.Nueva(
            "borrar_todo", "CambioDeRegistro", 1, "Festivales", "1", null, null, null,
            OrigenDelCambio.Directo, ahora));
        Assert.Contains("verbo", verboFalso.Message, StringComparison.OrdinalIgnoreCase);

        Assert.Throws<ArgumentException>(() => ContratoDeBitacora.Nueva(
            AccionesAuditoria.Actualizar, "CambioDeRegistro", 1, "Festivales", "1", null, null, null,
            "origen-raro", ahora));
    }

    [Fact]
    public void Una_Linea_Con_El_Contrato_Se_Lee_Con_Su_Etiqueta()
    {
        var linea = ContratoDeBitacora.Nueva(
            AccionesAuditoria.Consultar, "ConsultaDeDatosPersonales", 7, "Entidades", "3",
            antes: null,
            despues: new Dictionary<string, object?> { ["campos"] = CamposDeEjemplo },
            motivo: null, OrigenDelCambio.Sistema, DateTime.UtcNow);

        Assert.Equal("consultar", linea.Action);
        Assert.Equal("Consultó datos personales del historial", EventosDeLaBitacora.Etiquetar(linea.NewValuesJson));
        using var json = JsonDocument.Parse(linea.NewValuesJson!);
        Assert.True(json.RootElement.TryGetProperty("evento", out _));
        Assert.True(json.RootElement.TryGetProperty("origen", out _));
    }

    [Fact]
    public void Los_Campos_Vigilados_No_Repiten_Identificador_Y_Las_Clases_Son_Las_Del_Esquema()
    {
        RegistradorDeCambios.ValidarDeclaracion(EdicionesFestivalExternosEndpoints.CamposVigilados);
        RegistradorDeCambios.ValidarDeclaracion(EdicionesDeMercadoEndpoints.CamposVigilados);
        RegistradorDeCambios.ValidarDeclaracion(ExternalOrganizationEndpoints.CamposDelPerfil);
        RegistradorDeCambios.ValidarDeclaracion(ExternalOrganizationEndpoints.CamposDelResponsable);
        RegistradorDeCambios.ValidarDeclaracion(NoticiasEndpoints.CamposVigilados);
        RegistradorDeCambios.ValidarDeclaracion(EventosDeOrganizacionEndpoints.CamposVigilados);
        RegistradorDeCambios.ValidarDeclaracion(CamposDelFestival.DelFestival);
        RegistradorDeCambios.ValidarDeclaracion(MercadosEndpoints.CamposVigilados);
        RegistradorDeCambios.ValidarDeclaracion(CatalogoEditorialEndpoints.CamposVigilados);

        // Los códigos que viajan a la base son los que admite CK_CambiosDeRegistro_ClaseDato.
        Assert.Equal(
            ClasesDelEsquema,
            Enum.GetValues<ClaseDeDato>().Select(x => x.Codigo()).ToArray());

        // EL NIT ES DE LA ORGANIZACIÓN, no un dato personal (decisión de la dirección del 10 de noviembre).
        Assert.Equal(
            ClaseDeDato.Organizacion,
            ExternalOrganizationEndpoints.CamposDelPerfil.Single(x => x.Id == "numeroIdentificacion").Clase);
        Assert.True(ClaseDeDatoExtensiones.LaLeeLaOrganizacion("organizacion"));
        Assert.True(ClaseDeDatoExtensiones.LaLeeLaOrganizacion("publico"));
        Assert.False(ClaseDeDatoExtensiones.LaLeeLaOrganizacion("contacto"));
        Assert.False(ClaseDeDatoExtensiones.LaLeeLaOrganizacion("identificacion"));

        // Todo dato de una persona vive fuera de la clase pública.
        Assert.All(
            ExternalOrganizationEndpoints.CamposDelResponsable,
            campo => Assert.NotEqual(ClaseDeDato.Publico, campo.Clase));
    }

    // ---------- Andamio ---------------------------------------------------------------------------

    private async Task<List<CambioDeRegistroRow>> FilasAsync(string modulo, int registroId)
    {
        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var clave = registroId.ToString(CultureInfo.InvariantCulture);
        return await db.CambiosDeRegistro.AsNoTracking()
            .Where(x => x.ModuloId == modulo && x.RegistroId == clave)
            .OrderBy(x => x.Id)
            .ToListAsync();
    }

    private async Task<int> LecturasRegistradasAsync(int organizacionId)
    {
        using var alcance = _factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var clave = organizacionId.ToString(CultureInfo.InvariantCulture);
        return await db.AuditLogs.AsNoTracking().CountAsync(x => x.Action == "consultar" && x.RecordId == clave);
    }

    private static async Task<int> CrearEdicionAsync(Cuenta cuenta, int anio, string? director)
    {
        var creada = await EnviarAsync(cuenta.Cliente, HttpMethod.Post,
            $"/api/v1/externo/festivales/{cuenta.FestivalId}/ediciones",
            new { anio, nombre = $"Edición {anio}", director });
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        return int.Parse((await creada.Content.ReadFromJsonAsync<EdicionFestivalDto>())!.Id, CultureInfo.InvariantCulture);
    }

    private async Task<Cuenta> RegistrarConFestivalPublicadoAsync(string marca)
    {
        var cliente = _factory.CreateClient();
        var correo = $"historial.{marca}@example.com";
        var documento = RandomDocumento();

        var alta = await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organizacion " + marca,
            FullName = "Persona " + marca,
            NumeroDocumento = documento,
            HeadquartersDepartmentCode = "11",
            HeadquartersMunicipalityCode = "11001",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        });
        Assert.Equal(HttpStatusCode.Created, alta.StatusCode);
        var creada = await alta.Content.ReadFromJsonAsync<ExternalRegisterResponse>();
        await CorreoConfirmadoEnPruebas.ConfirmarAsync(_factory, correo);

        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login",
            new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var organizacionId = int.Parse(creada!.OrganizationId!, CultureInfo.InvariantCulture);
        var festival = await EnviarAsync(cliente, HttpMethod.Post,
            $"/api/v1/externo/organizaciones/{organizacionId}/festivales",
            new { nombre = "Festival " + marca, nivelCobertura = "nacional", sedeCodigoDepartamento = "05", sedeCodigoMunicipio = "05001" });
        Assert.Equal(HttpStatusCode.Created, festival.StatusCode);
        using var cuerpo = JsonDocument.Parse(await festival.Content.ReadAsStringAsync());
        var festivalId = int.Parse(cuerpo.RootElement.GetProperty("id").GetString()!, CultureInfo.InvariantCulture);

        using (var alcance = _factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.FestivalRecords.SingleAsync(x => x.Id == festivalId);
            fila.StatusCode = EstadosFestival.Publicado;
            await db.SaveChangesAsync();
        }

        return new Cuenta(cliente, organizacionId, festivalId);
    }

    private static string RandomDocumento() =>
        System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999)
            .ToString(CultureInfo.InvariantCulture);

    private static async Task<string> TokenAsync(HttpClient cliente)
    {
        var token = await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>("/api/v1/externo/organizaciones/csrf");
        return token!.RequestToken;
    }

    private static async Task<HttpResponseMessage> EnviarAsync(
        HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var mensaje = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) mensaje.Content = JsonContent.Create(cuerpo);
        mensaje.Headers.Add("X-CSRF-TOKEN", await TokenAsync(cliente));
        return await cliente.SendAsync(mensaje);
    }
}
