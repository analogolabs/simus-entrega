using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Correo;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La agenda de citas de un Mercado de punta a punta: la organización la configura, invita a los
/// compradores, los artistas se inscriben y piden franjas, y quien recibe confirma (docs/referencia/26-agenda-de-citas-y-mercados.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE SE COMPRUEBA, EN ORDEN DE RIESGO.</b> Primero que nadie reserve la misma franja dos veces y
/// que los contactos no salgan antes de confirmar; después el cupo con su lista de espera por orden de
/// ingreso, el tope de pendientes y el vencimiento que libera la franja; y que cada modo ponga a pedir a
/// quien corresponde.
/// </para>
/// <para>
/// <b>LAS FILAS QUE ESCRIBEN BITÁCORA Y HISTORIAL SE PRUEBAN TAMBIÉN CONTRA SQL SERVER</b> (los CHECK de
/// acción no existen en SQLite), junto con la concurrencia real de la reserva:
/// <see cref="AgendamientoDeCitasSqlServerTests"/>.
/// </para>
/// </remarks>
public sealed class AgendamientoDeCitasTests
{
    private const string Clave = "ClaveExterna123";
    private const string Persona = "/api/v1/externo/agendas-de-citas";

    // ───────────────────────────────────── Ayudantes ─────────────────────────────────────

    internal sealed record Cuenta(HttpClient Sesion, string Csrf, string Correo);

    internal sealed record Escenario(
        TestWebApplicationFactory Factory, Cuenta Organizacion, int OrganizacionId, int EdicionId, int AgendaId,
        IReadOnlyList<FranjaDto> Franjas)
    {
        public string Org => $"/api/v1/externo/organizaciones/{OrganizacionId}/agendas-de-citas/{AgendaId}";
    }

    internal static async Task<HttpResponseMessage> EnviarAsync(
        HttpClient cliente, string csrf, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var peticion = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) peticion.Content = JsonContent.Create(cuerpo);
        peticion.Headers.Add("X-CSRF-TOKEN", csrf);
        return await cliente.SendAsync(peticion);
    }

    internal static async Task<(Cuenta Cuenta, int OrganizacionId)> OrganizacionAsync(TestWebApplicationFactory factory)
    {
        var cliente = factory.CreateClient();
        var correo = $"mercado.{Guid.NewGuid():N}@organizacion.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Corporación del Mercado del Valle",
            FullName = "Persona responsable",
            NumeroDocumento = "1020304051",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            HeadquartersDepartmentCode = "76",
            HeadquartersMunicipalityCode = "76001",
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        await CorreoConfirmadoEnPruebas.ConfirmarAsync(factory, correo);
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();
        var csrf = (await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf"))
            .GetProperty("requestToken").GetString()!;
        var mias = await cliente.GetFromJsonAsync<List<OrganizacionAdministradaDto>>("/api/v1/externo/organizaciones/mis");
        return (new Cuenta(cliente, csrf, correo), int.Parse(mias![0].Id, CultureInfo.InvariantCulture));
    }

    /// <summary>Una persona con cuenta individual: un artista, un representante o un comprador.</summary>
    internal static async Task<Cuenta> PersonaAsync(TestWebApplicationFactory factory, string? correo = null, string nombre = "Valeria")
    {
        var cliente = factory.CreateClient();
        correo ??= $"persona.{Guid.NewGuid():N}@correo.test";
        var documento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture);
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = nombre,
            FirstSurname = "Ocampo",
            DocumentType = "cc",
            DocumentNumber = documento,
            Phone = "3001234567",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        await CorreoConfirmadoEnPruebas.ConfirmarAsync(factory, correo);
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();
        var csrf = (await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf"))
            .GetProperty("requestToken").GetString()!;
        return new Cuenta(cliente, csrf, correo);
    }

    /// <summary>
    /// Una organización con un Mercado publicado y una edición programada dentro de diez días, con la agenda
    /// ya configurada, cinco franjas generadas y la inscripción abierta (la agenda, «abierta»).
    /// </summary>
    internal static async Task<Escenario> EscenarioAsync(
        TestWebApplicationFactory factory, string modo = "compradores_rotan", int? cupo = null, int tope = 5,
        int vencimientoHoras = 72, bool abrir = true, string? aprobacion = null)
    {
        var (org, organizacionId) = await OrganizacionAsync(factory);

        int edicionId;
        var inicio = DateTime.UtcNow.Date.AddDays(10);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var mercado = new MercadoRow
            {
                Nombre = "Mercado Musical del Valle",
                NivelCobertura = "nacional",
                OrganizacionPrincipalId = organizacionId,
                EstadoRegistro = "publicado",
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
                FechaPublicacion = DateTime.UtcNow,
            };
            db.Mercados.Add(mercado);
            await db.SaveChangesAsync();
            var edicion = new EdicionMercadoRow
            {
                MercadoId = mercado.Id,
                Anio = inicio.Year,
                Nombre = "Edición de prueba",
                FechaInicio = inicio,
                FechaFin = inicio.AddDays(2),
                Estado = "programada",
                EstadoVisibilidad = "publicado",
                FechaCreacion = DateTime.UtcNow,
            };
            db.EdicionesMercado.Add(edicion);
            await db.SaveChangesAsync();
            edicionId = edicion.Id;
        }

        var configurada = await EnviarAsync(org.Sesion, org.Csrf, HttpMethod.Put,
            $"/api/v1/externo/organizaciones/{organizacionId}/ediciones-de-mercado/{edicionId}/agenda",
            new AgendaConfiguracionRequest(modo, 20, 5, tope, vencimientoHoras, cupo, null, null, aprobacion));
        Assert.Equal(HttpStatusCode.Created, configurada.StatusCode);
        var agenda = (await configurada.Content.ReadFromJsonAsync<AgendaDto>())!;

        var generadas = await EnviarAsync(org.Sesion, org.Csrf, HttpMethod.Post,
            $"/api/v1/externo/organizaciones/{organizacionId}/agendas-de-citas/{agenda.Id}/franjas",
            new GenerarFranjasRequest(inicio.AddDays(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), "09:00", "11:00"));
        Assert.Equal(HttpStatusCode.OK, generadas.StatusCode);
        var franjas = (await generadas.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("franjas")
            .Deserialize<List<FranjaDto>>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

        var escenario = new Escenario(factory, org, organizacionId, edicionId, agenda.Id, franjas);
        if (abrir) await CambiarEstadoAsync(escenario, "abrir");
        return escenario;
    }

    internal static async Task<AgendaDto> CambiarEstadoAsync(Escenario e, string accion)
    {
        var respuesta = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{e.Org}/estado",
            new CambiarEstadoDeAgendaRequest(accion));
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<AgendaDto>())!;
    }

    internal static async Task<ParticipanteDto> InvitarCompradorAsync(Escenario e, string correo, string nombre = "Comprador de prueba")
    {
        var respuesta = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{e.Org}/compradores",
            new AgregarCompradorRequest(nombre, "Festival de prueba", "festival", correo, "Programo para un festival.", null, "Mesa 1"));
        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<ParticipanteDto>())!;
    }

    internal static async Task<MiAgendaDto> InscribirAsync(Cuenta artista, int agendaId, string nombre = "Valeria Ocampo")
    {
        var respuesta = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post, $"{Persona}/{agendaId}/inscripcion",
            new InscripcionRequest(nombre, "Trío Valeria", "Música del Pacífico para cuarteto.", null, null, null, null));
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        return (await respuesta.Content.ReadFromJsonAsync<MiAgendaDto>())!;
    }

    internal static async Task<MiAgendaDto> MiAgendaAsync(Cuenta cuenta, int agendaId) =>
        (await cuenta.Sesion.GetFromJsonAsync<MiAgendaDto>($"{Persona}/{agendaId}"))!;

    internal static Task<HttpResponseMessage> PedirAsync(Cuenta quienPide, int agendaId, int anfitrionId, int franjaId) =>
        EnviarAsync(quienPide.Sesion, quienPide.Csrf, HttpMethod.Post, $"{Persona}/{agendaId}/citas",
            new SolicitarCitaRequest(anfitrionId, franjaId, "Me gustaría escucharte."));

    // ─────────────────────────────── El recorrido completo ───────────────────────────────

    [Fact]
    public async Task El_recorrido_completo_del_modo_con_compradores_que_rotan()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory, nombre: "Camilo");
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);

        // El artista ve la agenda abierta y se inscribe: entra, porque no hay cupo.
        var abiertas = await artista.Sesion.GetFromJsonAsync<List<AgendaDisponibleDto>>(Persona);
        var enLaLista = Assert.Single(abiertas!);
        Assert.True(enLaLista.InscripcionAbierta);
        Assert.Null(enLaLista.MiRol);
        var vistaArtista = await InscribirAsync(artista, e.AgendaId);
        Assert.Equal("aprobado", vistaArtista.MiParticipacion!.Estado);
        Assert.False(vistaArtista.RotoYPidoCitas);

        // El comprador invitado se reconoce por su correo: ve la agenda con el artista y sus franjas libres.
        var comoComprador = await MiAgendaAsync(comprador, e.AgendaId);
        Assert.Equal("comprador", comoComprador.MiParticipacion!.Rol);
        Assert.True(comoComprador.RotoYPidoCitas);
        var anfitrion = Assert.Single(comoComprador.Anfitriones);
        Assert.Equal(5, anfitrion.FranjasLibres.Count);
        // Antes de confirmar, el contacto del artista no sale.
        Assert.Null(anfitrion.Anfitrion.ContactoCorreo);

        var franja = anfitrion.FranjasLibres[0];
        var pedida = await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, franja);
        Assert.Equal(HttpStatusCode.OK, pedida.StatusCode);
        var cita = Assert.Single((await pedida.Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas);
        Assert.Equal("solicitada", cita.Estado);
        Assert.Null(cita.ContactoCorreo);

        // Quien recibe confirma; el otro lado, no.
        var noPuede = await EnviarAsync(comprador.Sesion, comprador.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{cita.Id}/confirmar", new { });
        Assert.Equal(HttpStatusCode.Conflict, noPuede.StatusCode);
        var confirmada = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{cita.Id}/confirmar", new { });
        Assert.Equal(HttpStatusCode.OK, confirmada.StatusCode);

        // Con la cita confirmada, cada uno ve el contacto del otro.
        var despues = await MiAgendaAsync(comprador, e.AgendaId);
        var confirmadaParaElComprador = Assert.Single(despues.Citas);
        Assert.Equal("confirmada", confirmadaParaElComprador.Estado);
        Assert.Equal(artista.Correo, confirmadaParaElComprador.ContactoCorreo);

        // El calendario y el CSV.
        var ics = await comprador.Sesion.GetAsync($"{Persona}/{e.AgendaId}/mi-agenda.ics");
        Assert.Equal(HttpStatusCode.OK, ics.StatusCode);
        var texto = await ics.Content.ReadAsStringAsync();
        Assert.Contains("BEGIN:VEVENT", texto, StringComparison.Ordinal);
        Assert.Contains("STATUS:CONFIRMED", texto, StringComparison.Ordinal);

        var csv = await e.Organizacion.Sesion.GetAsync($"{e.Org}/exportar.csv");
        Assert.Equal(HttpStatusCode.OK, csv.StatusCode);
        Assert.StartsWith("text/csv", csv.Content.Headers.ContentType!.ToString(), StringComparison.Ordinal);
        Assert.Contains("Valeria Ocampo", await csv.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task En_el_modo_con_compradores_fijos_piden_los_artistas_y_confirma_el_comprador()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, modo: "compradores_fijos");
        var comprador = await PersonaAsync(factory, nombre: "Camilo");
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);
        await InscribirAsync(artista, e.AgendaId);

        // Aquí el artista rota: ve a los compradores y pide.
        var comoArtista = await MiAgendaAsync(artista, e.AgendaId);
        Assert.True(comoArtista.RotoYPidoCitas);
        var mesa = Assert.Single(comoArtista.Anfitriones);
        Assert.Equal("comprador", mesa.Anfitrion.Rol);
        Assert.Equal("Mesa 1", mesa.Anfitrion.Espacio);

        var pedida = await PedirAsync(artista, e.AgendaId, mesa.Anfitrion.Id, mesa.FranjasLibres[0]);
        Assert.Equal(HttpStatusCode.OK, pedida.StatusCode);

        // El comprador, que es fijo, no puede pedir: confirma lo que le piden.
        var comoComprador = await MiAgendaAsync(comprador, e.AgendaId);
        Assert.False(comoComprador.RotoYPidoCitas);
        var cita = Assert.Single(comoComprador.Citas);
        var intento = await PedirAsync(comprador, e.AgendaId, comoComprador.MiParticipacion!.Id, e.Franjas[1].Id);
        Assert.Equal(HttpStatusCode.Conflict, intento.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(comprador.Sesion, comprador.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{cita.Id}/confirmar", new { })).StatusCode);
    }

    // ────────────────────────── La franja no se reserva dos veces ──────────────────────────

    [Fact]
    public async Task Dos_compradores_no_pueden_reservar_la_misma_franja_con_el_mismo_artista()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var uno = await PersonaAsync(factory, nombre: "Uno");
        var dos = await PersonaAsync(factory, nombre: "Dos");
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, uno.Correo, "Comprador uno");
        await InvitarCompradorAsync(e, dos.Correo, "Comprador dos");
        await InscribirAsync(artista, e.AgendaId);

        var vista = await MiAgendaAsync(uno, e.AgendaId);
        var anfitrion = vista.Anfitriones.Single().Anfitrion;
        var franja = vista.Anfitriones.Single().FranjasLibres[0];

        Assert.Equal(HttpStatusCode.OK, (await PedirAsync(uno, e.AgendaId, anfitrion.Id, franja)).StatusCode);
        var segunda = await PedirAsync(dos, e.AgendaId, anfitrion.Id, franja);
        Assert.Equal(HttpStatusCode.Conflict, segunda.StatusCode);

        // La franja desaparece de lo libre para el segundo comprador.
        var vistaDos = await MiAgendaAsync(dos, e.AgendaId);
        Assert.DoesNotContain(franja, vistaDos.Anfitriones.Single().FranjasLibres);
    }

    [Fact]
    public async Task La_base_impide_la_doble_reserva_aunque_el_servidor_no_la_vea()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var uno = await PersonaAsync(factory);
        var dos = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, uno.Correo, "Comprador uno");
        var segundo = await InvitarCompradorAsync(e, dos.Correo, "Comprador dos");
        await InscribirAsync(artista, e.AgendaId);

        var vista = await MiAgendaAsync(uno, e.AgendaId);
        var anfitrion = vista.Anfitriones.Single().Anfitrion;
        var franja = vista.Anfitriones.Single().FranjasLibres[0];
        Assert.Equal(HttpStatusCode.OK, (await PedirAsync(uno, e.AgendaId, anfitrion.Id, franja)).StatusCode);

        // Saltándose la API, la base rechaza la segunda cita viva del mismo anfitrión en esa franja.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        db.CitasDeAgenda.Add(new CitaDeAgendaRow
        {
            AgendaId = e.AgendaId, FranjaId = franja, AnfitrionId = anfitrion.Id, VisitanteId = segundo.Id,
            Estado = "solicitada", FechaSolicitud = DateTime.UtcNow, VenceUtc = DateTime.UtcNow.AddHours(1),
        });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Una_solicitud_que_se_rechaza_o_se_retira_libera_la_franja()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var uno = await PersonaAsync(factory);
        var dos = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, uno.Correo, "Comprador uno");
        await InvitarCompradorAsync(e, dos.Correo, "Comprador dos");
        await InscribirAsync(artista, e.AgendaId);

        var vista = await MiAgendaAsync(uno, e.AgendaId);
        var anfitrion = vista.Anfitriones.Single().Anfitrion;
        var franja = vista.Anfitriones.Single().FranjasLibres[0];
        var cita = (await (await PedirAsync(uno, e.AgendaId, anfitrion.Id, franja)).Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas.Single();

        // Rechazar pide un motivo, porque la otra persona lo lee.
        var sinMotivo = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{cita.Id}/rechazar", new MotivoRequest(null));
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
        var rechazada = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{cita.Id}/rechazar", new MotivoRequest("Ese día no puedo."));
        Assert.Equal(HttpStatusCode.OK, rechazada.StatusCode);

        // La franja quedó libre: el otro comprador la reserva.
        Assert.Equal(HttpStatusCode.OK, (await PedirAsync(dos, e.AgendaId, anfitrion.Id, franja)).StatusCode);
    }

    // ────────────────────────────── Cupo, topes y vencimiento ──────────────────────────────

    [Fact]
    public async Task El_cupo_llena_y_la_lista_de_espera_entra_por_orden_de_ingreso_cuando_se_libera_un_lugar()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, cupo: 1);
        var primero = await PersonaAsync(factory, nombre: "Primero");
        var segundo = await PersonaAsync(factory, nombre: "Segundo");
        var tercero = await PersonaAsync(factory, nombre: "Tercero");

        Assert.Equal("aprobado", (await InscribirAsync(primero, e.AgendaId, "Primero Ocampo")).MiParticipacion!.Estado);
        var esperando = await InscribirAsync(segundo, e.AgendaId, "Segundo Ocampo");
        Assert.Equal("lista_de_espera", esperando.MiParticipacion!.Estado);
        Assert.Equal(1, esperando.PosicionEnLaLista);
        Assert.Equal(2, (await InscribirAsync(tercero, e.AgendaId, "Tercero Ocampo")).PosicionEnLaLista);

        // Una persona en la lista de espera no puede pedir citas.
        var enEspera = await MiAgendaAsync(segundo, e.AgendaId);
        Assert.False(enEspera.PuedoPedirCitas);

        // La organización rechaza al primero: entra el segundo, no el tercero.
        var organizador = await e.Organizacion.Sesion.GetFromJsonAsync<AgendaDelOrganizadorDto>(e.Org);
        var idPrimero = organizador!.Participantes.Single(p => p.Nombre == "Primero Ocampo").Id;
        var sinMotivo = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post,
            $"{e.Org}/participantes/{idPrimero}/decision", new DecisionSobreParticipanteRequest("rechazar", null));
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
        var rechazo = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post,
            $"{e.Org}/participantes/{idPrimero}/decision", new DecisionSobreParticipanteRequest("rechazar", "No cumple el perfil."));
        Assert.Equal(HttpStatusCode.OK, rechazo.StatusCode);

        Assert.Equal("aprobado", (await MiAgendaAsync(segundo, e.AgendaId)).MiParticipacion!.Estado);
        var elTercero = await MiAgendaAsync(tercero, e.AgendaId);
        Assert.Equal("lista_de_espera", elTercero.MiParticipacion!.Estado);
        Assert.Equal(1, elTercero.PosicionEnLaLista);
    }

    [Fact]
    public async Task Quien_se_retira_cancela_sus_citas_y_deja_pasar_a_la_lista_de_espera()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, cupo: 1);
        var comprador = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        var espera = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);
        await InscribirAsync(artista, e.AgendaId, "Artista Ocampo");
        await InscribirAsync(espera, e.AgendaId, "Espera Ocampo");

        var vista = await MiAgendaAsync(comprador, e.AgendaId);
        var anfitrion = vista.Anfitriones.Single();
        Assert.Equal(HttpStatusCode.OK, (await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[0])).StatusCode);

        var salida = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/inscripcion/retirar", new MotivoRequest("Se me cruzó una gira."));
        Assert.Equal(HttpStatusCode.NoContent, salida.StatusCode);

        var cita = (await MiAgendaAsync(comprador, e.AgendaId)).Citas.Single();
        Assert.Equal("cancelada", cita.Estado);
        Assert.Equal("Se me cruzó una gira.", cita.MotivoDeLaDecision);
        Assert.Equal("aprobado", (await MiAgendaAsync(espera, e.AgendaId)).MiParticipacion!.Estado);
    }

    [Fact]
    public async Task El_tope_de_solicitudes_pendientes_se_respeta()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, tope: 1);
        var comprador = await PersonaAsync(factory);
        var uno = await PersonaAsync(factory);
        var dos = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);
        await InscribirAsync(uno, e.AgendaId, "Uno Ocampo");
        await InscribirAsync(dos, e.AgendaId, "Dos Ocampo");

        var vista = await MiAgendaAsync(comprador, e.AgendaId);
        Assert.Equal(2, vista.Anfitriones.Count);
        Assert.Equal(HttpStatusCode.OK, (await PedirAsync(comprador, e.AgendaId, vista.Anfitriones[0].Anfitrion.Id, vista.Anfitriones[0].FranjasLibres[0])).StatusCode);
        var segunda = await PedirAsync(comprador, e.AgendaId, vista.Anfitriones[1].Anfitrion.Id, vista.Anfitriones[1].FranjasLibres[1]);
        Assert.Equal(HttpStatusCode.Conflict, segunda.StatusCode);
        Assert.False((await MiAgendaAsync(comprador, e.AgendaId)).PuedoPedirCitas);
    }

    [Theory]
    [InlineData("compradores_rotan")]
    [InlineData("compradores_fijos")]
    public async Task El_cupo_de_citas_limita_a_quien_rota_segun_el_modo(string modo)
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, modo: modo);
        var quienRota = await PersonaAsync(factory);
        var uno = await PersonaAsync(factory);
        var dos = await PersonaAsync(factory);
        if (modo == "compradores_rotan")
        {
            await InvitarCompradorAsync(e, quienRota.Correo);
            await InscribirAsync(uno, e.AgendaId, "Uno Ocampo");
            await InscribirAsync(dos, e.AgendaId, "Dos Ocampo");
        }
        else
        {
            await InscribirAsync(quienRota, e.AgendaId, "Rota Ocampo");
            await InvitarCompradorAsync(e, uno.Correo, "Comprador uno");
            await InvitarCompradorAsync(e, dos.Correo, "Comprador dos");
            // Los compradores fijos entran a la agenda con su cuenta antes de que se pueda citar con ellos.
            await MiAgendaAsync(uno, e.AgendaId);
            await MiAgendaAsync(dos, e.AgendaId);
        }

        // Cupo de UNA cita por quien rota (el resto de la configuración se conserva).
        var actualizada = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put,
            $"/api/v1/externo/organizaciones/{e.OrganizacionId}/ediciones-de-mercado/{e.EdicionId}/agendas/{e.AgendaId}",
            new AgendaConfiguracionRequest(modo, 20, 5, 5, 72, null, null, null, null, null, CitasMaximasPorVisitante: 1));
        Assert.Equal(HttpStatusCode.OK, actualizada.StatusCode);
        Assert.Equal(1, (await actualizada.Content.ReadFromJsonAsync<AgendaDto>())!.CitasMaximasPorVisitante);

        var vista = await MiAgendaAsync(quienRota, e.AgendaId);
        Assert.True(vista.PuedoPedirCitas);
        Assert.Equal(2, vista.Anfitriones.Count);
        Assert.Equal(HttpStatusCode.OK, (await PedirAsync(quienRota, e.AgendaId, vista.Anfitriones[0].Anfitrion.Id, vista.Anfitriones[0].FranjasLibres[0])).StatusCode);

        var segunda = await PedirAsync(quienRota, e.AgendaId, vista.Anfitriones[1].Anfitrion.Id, vista.Anfitriones[1].FranjasLibres[1]);
        Assert.Equal(HttpStatusCode.Conflict, segunda.StatusCode);
        Assert.Contains("máximo", await segunda.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        var despues = await MiAgendaAsync(quienRota, e.AgendaId);
        Assert.False(despues.PuedoPedirCitas);
        Assert.Equal(1, despues.MisCitasVivas);

        // Quien tiene su cupo lleno recupera el lugar si retira la solicitud.
        var cita = despues.Citas.Single();
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(quienRota.Sesion, quienRota.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{cita.Id}/cancelar", new { })).StatusCode);
        Assert.True((await MiAgendaAsync(quienRota, e.AgendaId)).PuedoPedirCitas);
    }

    [Fact]
    public async Task Cada_paso_de_la_agenda_avisa_por_correo_a_las_dos_partes_con_la_plantilla_comun()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo, "Comprador uno");
        await InscribirAsync(artista, e.AgendaId, "Artista uno");

        var vista = await MiAgendaAsync(comprador, e.AgendaId);
        var pedida = await PedirAsync(comprador, e.AgendaId, vista.Anfitriones.Single().Anfitrion.Id, vista.Anfitriones.Single().FranjasLibres[0]);
        var cita = (await pedida.Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas.Single();
        (await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post, $"{Persona}/{e.AgendaId}/citas/{cita.Id}/confirmar", new { }))
            .EnsureSuccessStatusCode();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var correos = db.Notifications.AsNoTracking().Where(n => n.Channel == "email" && n.EventType.StartsWith("AgendaDeCitas.")).ToList();
        string[] Eventos(string destino) => correos.Where(n => n.RecipientEmail == destino).Select(n => n.EventType).ToArray();

        // El artista: inscripción, solicitud recibida y confirmación propia. El comprador: invitación, solicitud pedida y cita confirmada.
        Assert.Contains("AgendaDeCitas.InscripcionEnAgendaConfirmada", Eventos(artista.Correo));
        Assert.Contains("AgendaDeCitas.CitaSolicitada", Eventos(artista.Correo));
        Assert.Contains("AgendaDeCitas.CitaConfirmada", Eventos(artista.Correo));
        Assert.Contains("AgendaDeCitas.CitaPedida", Eventos(comprador.Correo));
        Assert.Contains("AgendaDeCitas.CitaConfirmada", Eventos(comprador.Correo));
        Assert.All(correos, n => Assert.Equal("pendiente", n.Status));

        // Cada uno sale con la plantilla común: título, agenda, qué se espera y botón a «Mi agenda de citas».
        var aviso = correos.Single(n => n.RecipientEmail == comprador.Correo && n.EventType == "AgendaDeCitas.CitaConfirmada");
        Assert.Contains("Mercado Musical del Valle", aviso.Body, StringComparison.Ordinal);
        Assert.Contains("/gestion/cuenta/agenda-de-citas", aviso.Body, StringComparison.Ordinal);
        Assert.Contains("<table", PlantillaDeCorreoSimus.HtmlPara(aviso.EventType, aviso.Body, aviso.Title)!, StringComparison.Ordinal);
    }

    [Fact]
    public async Task El_portafolio_de_cada_agenda_se_ajusta_y_viaja_con_la_cita()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo, "Comprador uno");
        await InscribirAsync(artista, e.AgendaId, "Artista uno");

        // El comprador ajusta SU portafolio para esta agenda: enlaces solo http(s) y hasta cinco.
        var mal = await EnviarAsync(comprador.Sesion, comprador.Csrf, HttpMethod.Put, $"{Persona}/{e.AgendaId}/mi-portafolio",
            new MiPortafolioRequest("Programamos festivales.", "javascript:alert(1)", "Festival del Valle", null));
        Assert.Equal(HttpStatusCode.BadRequest, mal.StatusCode);
        var bien = await EnviarAsync(comprador.Sesion, comprador.Csrf, HttpMethod.Put, $"{Persona}/{e.AgendaId}/mi-portafolio",
            new MiPortafolioRequest("Programamos festivales de música andina.", "https://festival.test/programacion\nhttps://festival.test/brochure", "Festival del Valle", null));
        Assert.Equal(HttpStatusCode.OK, bien.StatusCode);
        Assert.Equal("Festival del Valle", (await bien.Content.ReadFromJsonAsync<MiAgendaDto>())!.MiParticipacion!.Entidad);

        // Al pedir la cita, el artista recibe el portafolio del comprador: en la cita y en el correo.
        var vista = await MiAgendaAsync(comprador, e.AgendaId);
        var pedida = await PedirAsync(comprador, e.AgendaId, vista.Anfitriones.Single().Anfitrion.Id, vista.Anfitriones.Single().FranjasLibres[0]);
        pedida.EnsureSuccessStatusCode();
        var citaDelArtista = (await MiAgendaAsync(artista, e.AgendaId)).Citas.Single();
        Assert.Equal("Festival del Valle", citaDelArtista.OtraParte!.Entidad);
        Assert.Contains("festival.test/brochure", citaDelArtista.OtraParte.Enlaces, StringComparison.Ordinal);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var correo = db.Notifications.AsNoTracking().Single(n => n.RecipientEmail == artista.Correo && n.EventType == "AgendaDeCitas.CitaSolicitada");
        Assert.Contains("Programamos festivales de música andina.", correo.Body, StringComparison.Ordinal);
        Assert.Contains("festival.test/programacion", correo.Body, StringComparison.Ordinal);

        // El artista, sin presentación, no puede dejar su portafolio vacío.
        var vacio = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Put, $"{Persona}/{e.AgendaId}/mi-portafolio", new MiPortafolioRequest(null, null, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, vacio.StatusCode);
    }

    [Fact]
    public async Task Una_solicitud_sin_respuesta_vence_y_libera_la_franja()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var uno = await PersonaAsync(factory);
        var dos = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, uno.Correo, "Comprador uno");
        await InvitarCompradorAsync(e, dos.Correo, "Comprador dos");
        await InscribirAsync(artista, e.AgendaId);

        var vista = await MiAgendaAsync(uno, e.AgendaId);
        var anfitrion = vista.Anfitriones.Single().Anfitrion;
        var franja = vista.Anfitriones.Single().FranjasLibres[0];
        var cita = (await (await PedirAsync(uno, e.AgendaId, anfitrion.Id, franja)).Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas.Single();
        // La solicitud vence a las 72 horas por omisión, y nunca después del inicio de la franja.
        Assert.NotNull(cita.VenceUtc);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.CitasDeAgenda.SingleAsync(c => c.Id == cita.Id);
            fila.VenceUtc = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        // Quien responde llega tarde: la solicitud venció.
        var tarde = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{cita.Id}/confirmar", new { });
        Assert.Equal(HttpStatusCode.Conflict, tarde.StatusCode);
        Assert.Equal("vencida", (await MiAgendaAsync(uno, e.AgendaId)).Citas.Single().Estado);
        // Y la franja la puede tomar otro.
        Assert.Equal(HttpStatusCode.OK, (await PedirAsync(dos, e.AgendaId, anfitrion.Id, franja)).StatusCode);
    }

    [Fact]
    public async Task Una_cita_vencida_no_cuenta_como_por_responder_en_la_lista_ni_en_el_conteo()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);
        await InscribirAsync(artista, e.AgendaId);
        var vista = await MiAgendaAsync(comprador, e.AgendaId);
        var anfitrion = vista.Anfitriones.Single();
        var cita = (await (await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[0]))
            .Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas.Single();
        var web = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        // Vigente: a quien la recibe le toca responder, y la insignia lo cuenta.
        var vigente = await artista.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>("/api/v1/externo/cuenta/solicitudes", web);
        Assert.Contains(vigente!, i => i.Clave == $"cita-{cita.Id}" && i.Espera == "tu_accion");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.CitasDeAgenda.SingleAsync(c => c.Id == cita.Id);
            fila.VenceUtc = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        // Vencida, SIN que nadie haya abierto la agenda: la lista y el conteo la excluyen de lo pendiente.
        var lista = await artista.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>("/api/v1/externo/cuenta/solicitudes", web);
        var vencida = Assert.Single(lista!, i => i.Clave == $"cita-{cita.Id}");
        Assert.Equal("resuelta", vencida.Espera);
        Assert.Equal("Vencida", vencida.EstadoEtiqueta);
        Assert.Equal(0, lista!.Count(i => i.Espera == "tu_accion" && i.Tipo == "cita"));
        // Quien la pidió tampoco la ve «esperando respuesta».
        var propia = await comprador.Sesion.GetFromJsonAsync<List<SolicitudDeLaCuentaDto>>("/api/v1/externo/cuenta/solicitudes", web);
        Assert.Equal("resuelta", Assert.Single(propia!, i => i.Clave == $"cita-{cita.Id}").Espera);
    }

    [Fact]
    public async Task Cerrar_la_agenda_cancela_lo_pendiente_y_deja_lo_confirmado()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);
        await InscribirAsync(artista, e.AgendaId);

        var vista = await MiAgendaAsync(comprador, e.AgendaId);
        var anfitrion = vista.Anfitriones.Single();
        await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[0]);
        await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[1]);
        var citas = (await MiAgendaAsync(comprador, e.AgendaId)).Citas;
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{citas[0].Id}/confirmar", new { })).StatusCode);

        var cerrada = await CambiarEstadoAsync(e, "cerrar");
        Assert.Equal("cerrada", cerrada.Estado);

        var despues = (await MiAgendaAsync(comprador, e.AgendaId)).Citas;
        Assert.Equal("confirmada", despues.Single(c => c.Id == citas[0].Id).Estado);
        Assert.Equal("cancelada", despues.Single(c => c.Id == citas[1].Id).Estado);
        // Cerrada, ya no se piden citas.
        Assert.Equal(HttpStatusCode.Conflict, (await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[2])).StatusCode);
    }

    // ───────────────────────────────── Guardas y privacidad ─────────────────────────────────

    [Fact]
    public async Task Sin_el_testigo_de_la_pagina_ninguna_escritura_pasa()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var artista = await PersonaAsync(factory);

        var inscripcion = await artista.Sesion.PostAsJsonAsync($"{Persona}/{e.AgendaId}/inscripcion",
            new InscripcionRequest("Valeria", null, "Presentación.", null, null, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, inscripcion.StatusCode);

        var estado = await e.Organizacion.Sesion.PostAsJsonAsync($"{e.Org}/estado", new CambiarEstadoDeAgendaRequest("cerrar"));
        Assert.Equal(HttpStatusCode.BadRequest, estado.StatusCode);
    }

    [Fact]
    public async Task Otra_organizacion_no_ve_ni_toca_la_agenda_y_recibe_no_encontrada()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var (ajena, ajenaId) = await OrganizacionAsync(factory);

        // La agenda es de otra organización: no se confirma que existe.
        var ruta = $"/api/v1/externo/organizaciones/{ajenaId}/agendas-de-citas/{e.AgendaId}";
        Assert.Equal(HttpStatusCode.NotFound, (await ajena.Sesion.GetAsync(ruta)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await EnviarAsync(ajena.Sesion, ajena.Csrf, HttpMethod.Post, $"{ruta}/estado",
            new CambiarEstadoDeAgendaRequest("cerrar"))).StatusCode);
        // Y tampoco puede usar la organización de otra: no administra esa.
        Assert.Equal(HttpStatusCode.NotFound, (await ajena.Sesion.GetAsync(e.Org)).StatusCode);
    }

    [Fact]
    public async Task Una_persona_que_no_participa_no_puede_responder_citas_ajenas()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        var curiosa = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);
        await InscribirAsync(artista, e.AgendaId);

        var vista = await MiAgendaAsync(comprador, e.AgendaId);
        var anfitrion = vista.Anfitriones.Single();
        var cita = (await (await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[0]))
            .Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas.Single();

        Assert.Equal(HttpStatusCode.NotFound, (await EnviarAsync(curiosa.Sesion, curiosa.Csrf, HttpMethod.Post,
            $"{Persona}/{e.AgendaId}/citas/{cita.Id}/confirmar", new { })).StatusCode);
        // Quien no participa solo ve que la agenda existe, sin citas ni anfitriones.
        var suVista = await MiAgendaAsync(curiosa, e.AgendaId);
        Assert.Empty(suVista.Citas);
        Assert.Empty(suVista.Anfitriones);
        Assert.Null(suVista.MiParticipacion);
    }

    [Fact]
    public async Task Un_editor_prepara_la_agenda_pero_no_la_abre_ni_la_cierra()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, abrir: false);

        // La organización la creó una administradora: abrir y cerrar siguen con el administrador.
        var abierta = await CambiarEstadoAsync(e, "abrir");
        Assert.Equal("abierta", abierta.Estado);
        var iniciada = await CambiarEstadoAsync(e, "iniciar");
        Assert.Equal("en_curso", iniciada.Estado);
        // No se puede volver atrás: una agenda iniciada no se abre otra vez.
        var otraVez = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{e.Org}/estado",
            new CambiarEstadoDeAgendaRequest("abrir"));
        Assert.Equal(HttpStatusCode.Conflict, otraVez.StatusCode);
    }

    [Fact]
    public async Task El_modo_no_cambia_cuando_ya_hay_citas_y_la_duracion_no_cambia_con_franjas()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var ruta = $"/api/v1/externo/organizaciones/{e.OrganizacionId}/ediciones-de-mercado/{e.EdicionId}/agenda";

        // Hay franjas generadas: cambiar la duración las dejaría mal medidas.
        var duracion = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, ruta,
            new AgendaConfiguracionRequest("compradores_rotan", 30, 5, 5, 72, null, null, null));
        Assert.Equal(HttpStatusCode.Conflict, duracion.StatusCode);

        // Un cupo sí se puede cambiar, y un valor fuera de rango se explica.
        var cupo = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, ruta,
            new AgendaConfiguracionRequest("compradores_rotan", 20, 5, 5, 72, 40, null, null));
        Assert.Equal(HttpStatusCode.OK, cupo.StatusCode);
        var fuera = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, ruta,
            new AgendaConfiguracionRequest("compradores_rotan", 5, 5, 5, 72, null, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, fuera.StatusCode);
    }

    [Fact]
    public async Task Las_franjas_se_generan_con_la_duracion_y_la_pausa_y_no_se_repiten()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, abrir: false);

        // 09:00 a 11:00 con 20 minutos y 5 de pausa: 09:00, 09:25, 09:50, 10:15 y 10:40.
        Assert.Equal(5, e.Franjas.Count);
        Assert.All(e.Franjas, f => Assert.Equal(TimeSpan.FromMinutes(20), f.FinUtc - f.InicioUtc));
        Assert.Equal(TimeSpan.FromMinutes(25), e.Franjas[1].InicioUtc - e.Franjas[0].InicioUtc);
        // Las 09:00 de Bogotá son las 14:00 UTC.
        Assert.Equal(14, e.Franjas[0].InicioUtc.Hour);

        var dia = e.Franjas[0].InicioUtc.AddHours(-5).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var repetida = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{e.Org}/franjas",
            new GenerarFranjasRequest(dia, "09:00", "11:00"));
        var cuerpo = await repetida.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, cuerpo.GetProperty("generadas").GetInt32());
        Assert.Equal(5, cuerpo.GetProperty("yaExistian").GetInt32());

        // Fuera de las fechas de la edición no se agenda.
        var lejos = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{e.Org}/franjas",
            new GenerarFranjasRequest(DateTime.UtcNow.AddDays(100).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), "09:00", "10:00"));
        Assert.Equal(HttpStatusCode.BadRequest, lejos.StatusCode);
    }

    [Fact]
    public async Task Un_correo_invitado_dos_veces_se_rechaza_y_el_contacto_del_comprador_no_se_filtra()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory);
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);

        var repetido = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{e.Org}/compradores",
            new AgregarCompradorRequest("Otra vez", null, "sala", comprador.Correo, null, null, null));
        Assert.Equal(HttpStatusCode.Conflict, repetido.StatusCode);

        // El artista, al mirar la agenda, no ve el correo con el que se invitó al comprador.
        await InscribirAsync(artista, e.AgendaId);
        var vista = await MiAgendaAsync(artista, e.AgendaId);
        Assert.NotNull(vista.MiParticipacion);
        Assert.Empty(vista.Anfitriones);
        var enLaLista = await artista.Sesion.GetStringAsync(Persona);
        Assert.DoesNotContain(comprador.Correo, enLaLista, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(comprador.Correo, JsonSerializer.Serialize(vista), StringComparison.OrdinalIgnoreCase);
    }

    // ───────────────────── Aprobación de artistas, varias agendas e invitación por enlace ─────────────────────

    private static Task<HttpResponseMessage> DecidirAsync(Escenario e, int participanteId, string accion, string? motivo = null) =>
        EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post,
            $"{e.Org}/participantes/{participanteId}/decision", new DecisionSobreParticipanteRequest(accion, motivo));

    [Fact]
    public async Task Con_aprobacion_por_aceptacion_el_artista_queda_pendiente_y_la_organizacion_decide()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, cupo: 1, aprobacion: "aceptacion");
        var primera = await PersonaAsync(factory, nombre: "Primera");
        var segunda = await PersonaAsync(factory, nombre: "Segunda");
        var tercera = await PersonaAsync(factory, nombre: "Tercera");

        // Nadie entra solo: ni siquiera con cupo libre.
        var vista = await InscribirAsync(primera, e.AgendaId, "Primera Ocampo");
        Assert.Equal("pendiente", vista.MiParticipacion!.Estado);
        Assert.Equal("aceptacion", vista.Agenda.AprobacionDeArtistas);
        Assert.Null(vista.PosicionEnLaLista);
        Assert.False(vista.PuedoPedirCitas);
        await InscribirAsync(segunda, e.AgendaId, "Segunda Ocampo");
        await InscribirAsync(tercera, e.AgendaId, "Tercera Ocampo");

        // La cola de aprobaciones: los pendientes no cuentan en el cupo.
        var cola = (await e.Organizacion.Sesion.GetFromJsonAsync<AgendaDelOrganizadorDto>(e.Org))!;
        Assert.Equal(3, cola.Agenda.ArtistasPendientes);
        Assert.Equal(0, cola.Agenda.ArtistasAprobados);
        var idPrimera = cola.Participantes.Single(p => p.Nombre == "Primera Ocampo").Id;
        var idSegunda = cola.Participantes.Single(p => p.Nombre == "Segunda Ocampo").Id;
        var idTercera = cola.Participantes.Single(p => p.Nombre == "Tercera Ocampo").Id;

        // Aprobar no pide motivo; rechazar sí.
        Assert.Equal(HttpStatusCode.BadRequest, (await DecidirAsync(e, idTercera, "rechazar")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await DecidirAsync(e, idPrimera, "aprobar")).StatusCode);
        Assert.Equal("aprobado", (await MiAgendaAsync(primera, e.AgendaId)).MiParticipacion!.Estado);

        // Con el cupo lleno, aprobar a la segunda la deja en la lista de espera.
        var enEspera = await (await DecidirAsync(e, idSegunda, "aprobar")).Content.ReadFromJsonAsync<ParticipanteDto>();
        Assert.Equal("lista_de_espera", enEspera!.Estado);
        Assert.Equal(1, (await MiAgendaAsync(segunda, e.AgendaId)).PosicionEnLaLista);

        // Rechazada con motivo; y no se puede aprobar a quien ya no está pendiente.
        Assert.Equal(HttpStatusCode.OK, (await DecidirAsync(e, idTercera, "rechazar", "No es música del Pacífico.")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await DecidirAsync(e, idPrimera, "aprobar")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await DecidirAsync(e, idTercera, "aprobar")).StatusCode);

        // Si la aprobada se retira, entra la que esperaba, que ya estaba aprobada.
        (await EnviarAsync(primera.Sesion, primera.Csrf, HttpMethod.Post, $"{Persona}/{e.AgendaId}/inscripcion/retirar", new MotivoRequest(null)))
            .EnsureSuccessStatusCode();
        Assert.Equal("aprobado", (await MiAgendaAsync(segunda, e.AgendaId)).MiParticipacion!.Estado);

        // El artista recibe un aviso por cada decisión, y todo queda en la bitácora.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var eventos = db.Notifications.AsNoTracking().Select(n => n.EventType).ToList();
        Assert.Contains("InscripcionPendienteDeAprobacion", eventos);
        Assert.Contains("InscripcionEnAgendaRechazada", eventos);
        var bitacora = db.AuditLogs.AsNoTracking().Select(a => a.NewValuesJson).ToList().Select(v => v ?? string.Empty).ToList();
        Assert.Contains(bitacora, v => v.Contains("ParticipanteDeCitasAprobado", StringComparison.Ordinal));
        Assert.Contains(bitacora, v => v.Contains("ParticipanteDeCitasEnListaDeEspera", StringComparison.Ordinal));
    }

    [Fact]
    public async Task La_organizacion_cambia_la_aprobacion_y_sin_el_campo_se_conserva()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var ruta = $"/api/v1/externo/organizaciones/{e.OrganizacionId}/ediciones-de-mercado/{e.EdicionId}/agenda";

        var nueva = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, ruta,
            new AgendaConfiguracionRequest("compradores_rotan", 20, 5, 5, 72, null, null, null, "aceptacion"));
        Assert.Equal("aceptacion", (await nueva.Content.ReadFromJsonAsync<AgendaDto>())!.AprobacionDeArtistas);

        // Un cliente anterior, que no manda el campo, no lo pisa.
        var sinCampo = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, ruta,
            new AgendaConfiguracionRequest("compradores_rotan", 20, 5, 5, 72, 30, null, null));
        Assert.Equal("aceptacion", (await sinCampo.Content.ReadFromJsonAsync<AgendaDto>())!.AprobacionDeArtistas);

        var invalida = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, ruta,
            new AgendaConfiguracionRequest("compradores_rotan", 20, 5, 5, 72, null, null, null, "al_azar"));
        Assert.Equal(HttpStatusCode.BadRequest, invalida.StatusCode);
    }

    [Fact]
    public async Task Un_artista_puede_estar_en_las_agendas_de_varios_Mercados_sin_cruce_entre_ellas()
    {
        await using var factory = new TestWebApplicationFactory();
        var uno = await EscenarioAsync(factory, aprobacion: "aceptacion");
        var otro = await EscenarioAsync(factory, cupo: 1);
        var artista = await PersonaAsync(factory, nombre: "Valeria");

        // En un Mercado queda pendiente y en el otro entra: cada agenda es una herramienta independiente.
        Assert.Equal("pendiente", (await InscribirAsync(artista, uno.AgendaId)).MiParticipacion!.Estado);
        Assert.Equal("aprobado", (await InscribirAsync(artista, otro.AgendaId)).MiParticipacion!.Estado);

        var mias = (await artista.Sesion.GetFromJsonAsync<List<AgendaDisponibleDto>>(Persona))!;
        Assert.Equal("pendiente", mias.Single(a => a.AgendaId == uno.AgendaId).MiEstado);
        Assert.Equal("aprobado", mias.Single(a => a.AgendaId == otro.AgendaId).MiEstado);

        // Lo que pase en una no toca a la otra: rechazarla en una deja intacta su inscripción en la otra.
        var cola = (await uno.Organizacion.Sesion.GetFromJsonAsync<AgendaDelOrganizadorDto>(uno.Org))!;
        Assert.Equal(HttpStatusCode.OK, (await DecidirAsync(uno, cola.Participantes.Single().Id, "rechazar", "Fuera del enfoque.")).StatusCode);
        Assert.Equal("aprobado", (await MiAgendaAsync(artista, otro.AgendaId)).MiParticipacion!.Estado);
    }

    private static string TestigoDelCorreo(TestWebApplicationFactory factory, string correo)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var cuerpo = db.Notifications.AsNoTracking()
            .Where(n => n.EventType == "InvitacionALaAgendaDeCitas" && n.RecipientEmail == correo && n.Channel == "email")
            .OrderByDescending(n => n.Id).Select(n => n.Body).First();
        var inicio = cuerpo.IndexOf("testigo=", StringComparison.Ordinal) + "testigo=".Length;
        return new string(cuerpo[inicio..].TakeWhile(char.IsAsciiHexDigit).ToArray());
    }

    [Fact]
    public async Task El_comprador_sin_cuenta_recibe_un_enlace_de_un_solo_uso_y_entra_con_el_mismo_correo()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var correo = $"booker.{Guid.NewGuid():N}@correo.test";

        var invitado = await InvitarCompradorAsync(e, correo, "Booker del Valle");
        Assert.True(invitado.InvitacionPendiente);
        Assert.False(invitado.TieneCuenta);

        // El correo queda en la cola de salida (la demostración no tiene proveedor): pendiente, sin fingir el envío.
        var testigo = TestigoDelCorreo(factory, correo);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var correoEnCola = db.Notifications.AsNoTracking().Single(n => n.RecipientEmail == correo && n.EventType == "InvitacionALaAgendaDeCitas");
            Assert.Equal("pendiente", correoEnCola.Status);
            Assert.Contains("/ecosistema/invitacion-agenda?testigo=", correoEnCola.Body, StringComparison.Ordinal);
            // De la invitación solo se guarda el resumen del testigo, nunca el testigo.
            Assert.DoesNotContain(db.InvitacionesDeAgenda.AsNoTracking().Select(i => i.HashTestigo).ToList(), h => h == testigo);
        }

        // Sin sesión se ve a qué agenda es y el correo va enmascarado.
        var anonimo = factory.CreateClient();
        var abierta = await anonimo.PostAsJsonAsync("/api/v1/externo/agendas-de-citas/invitaciones/consultar", new InvitacionDeAgendaSolicitud(testigo));
        Assert.Equal(HttpStatusCode.OK, abierta.StatusCode);
        var contenido = (await abierta.Content.ReadFromJsonAsync<InvitacionDeAgendaAbiertaDto>())!;
        Assert.Equal("pendiente", contenido.Estado);
        Assert.Equal("Mercado Musical del Valle", contenido.MercadoNombre);
        Assert.DoesNotContain(correo, JsonSerializer.Serialize(contenido), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.NotFound,
            (await anonimo.PostAsJsonAsync("/api/v1/externo/agendas-de-citas/invitaciones/consultar", new InvitacionDeAgendaSolicitud("no-existe"))).StatusCode);

        // Otra cuenta con el enlace no sirve.
        var intrusa = await PersonaAsync(factory);
        var rechazo = await EnviarAsync(intrusa.Sesion, intrusa.Csrf, HttpMethod.Post,
            "/api/v1/externo/agendas-de-citas/invitaciones/aceptar", new InvitacionDeAgendaSolicitud(testigo));
        Assert.Equal(HttpStatusCode.Conflict, rechazo.StatusCode);
        Assert.Contains("correo_distinto", await rechazo.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        // Sin el testigo de la página tampoco.
        var sinTestigo = await intrusa.Sesion.PostAsJsonAsync("/api/v1/externo/agendas-de-citas/invitaciones/aceptar", new InvitacionDeAgendaSolicitud(testigo));
        Assert.Equal(HttpStatusCode.BadRequest, sinTestigo.StatusCode);

        // Quien crea la cuenta con ese correo acepta y queda enlazado como comprador.
        var booker = await PersonaAsync(factory, correo, "Booker");
        var aceptada = await EnviarAsync(booker.Sesion, booker.Csrf, HttpMethod.Post,
            "/api/v1/externo/agendas-de-citas/invitaciones/aceptar", new InvitacionDeAgendaSolicitud(testigo));
        Assert.Equal(HttpStatusCode.OK, aceptada.StatusCode);
        var vista = await MiAgendaAsync(booker, e.AgendaId);
        Assert.Equal("comprador", vista.MiParticipacion!.Rol);
        Assert.True(vista.MiParticipacion.TieneCuenta);

        // Un solo uso.
        var otraVez = await EnviarAsync(booker.Sesion, booker.Csrf, HttpMethod.Post,
            "/api/v1/externo/agendas-de-citas/invitaciones/aceptar", new InvitacionDeAgendaSolicitud(testigo));
        Assert.Equal(HttpStatusCode.Conflict, otraVez.StatusCode);
        Assert.Contains("aceptada", await otraVez.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_enlace_nuevo_deja_sin_efecto_el_anterior_y_la_organizacion_puede_revocarlo()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var correo = $"booker.{Guid.NewGuid():N}@correo.test";
        var invitado = await InvitarCompradorAsync(e, correo);
        var primero = TestigoDelCorreo(factory, correo);

        var reenviada = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{e.Org}/participantes/{invitado.Id}/invitacion");
        Assert.Equal(HttpStatusCode.OK, reenviada.StatusCode);
        var segundo = TestigoDelCorreo(factory, correo);
        Assert.NotEqual(primero, segundo);

        var anonimo = factory.CreateClient();
        var viejo = await anonimo.PostAsJsonAsync("/api/v1/externo/agendas-de-citas/invitaciones/consultar", new InvitacionDeAgendaSolicitud(primero));
        Assert.Equal("revocada", (await viejo.Content.ReadFromJsonAsync<InvitacionDeAgendaAbiertaDto>())!.Estado);

        (await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Delete, $"{e.Org}/participantes/{invitado.Id}/invitacion"))
            .EnsureSuccessStatusCode();
        var revocado = await anonimo.PostAsJsonAsync("/api/v1/externo/agendas-de-citas/invitaciones/consultar", new InvitacionDeAgendaSolicitud(segundo));
        Assert.Equal("revocada", (await revocado.Content.ReadFromJsonAsync<InvitacionDeAgendaAbiertaDto>())!.Estado);

        // Un comprador que ya tiene cuenta con el correo confirmado no necesita invitación: queda enlazado.
        var conCuenta = await PersonaAsync(factory);
        var enlazado = await InvitarCompradorAsync(e, conCuenta.Correo, "Con cuenta");
        Assert.True(enlazado.TieneCuenta);
        Assert.False(enlazado.InvitacionPendiente);
    }

    // ───────────────────────────── Varias agendas por edición (AGE2) ─────────────────────────────

    [Fact]
    public async Task Una_edicion_puede_tener_varias_agendas_cada_una_con_su_configuracion_y_sus_franjas()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory, cupo: 3);
        var baseDeLaEdicion = $"/api/v1/externo/organizaciones/{e.OrganizacionId}/ediciones-de-mercado/{e.EdicionId}";

        // La segunda agenda, con otro nombre, otro modo, otra duración y su propio cupo.
        var creada = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{baseDeLaEdicion}/agendas",
            new AgendaConfiguracionRequest("compradores_fijos", 30, 0, 4, 48, 10, null, null, "aceptacion", "Sala de cámara"));
        Assert.Equal(HttpStatusCode.Created, creada.StatusCode);
        var segunda = (await creada.Content.ReadFromJsonAsync<AgendaDto>())!;
        Assert.NotEqual(e.AgendaId, segunda.Id);
        Assert.Equal("Sala de cámara", segunda.Nombre);
        Assert.Equal("compradores_fijos", segunda.Modo);
        Assert.Equal(10, segunda.CupoArtistas);

        // Cada una conserva lo suyo: la primera sigue con su cupo, su duración y sus cinco franjas.
        var primera = (await e.Organizacion.Sesion.GetFromJsonAsync<AgendaDelOrganizadorDto>(e.Org))!;
        Assert.Equal("Mercado Musical del Valle", primera.Agenda.Nombre);
        Assert.Equal(3, primera.Agenda.CupoArtistas);
        Assert.Equal(20, primera.Agenda.DuracionMinutos);
        Assert.Equal(5, primera.Agenda.Franjas);
        var vistaSegunda = (await e.Organizacion.Sesion.GetFromJsonAsync<AgendaDelOrganizadorDto>(
            $"/api/v1/externo/organizaciones/{e.OrganizacionId}/agendas-de-citas/{segunda.Id}"))!;
        Assert.Empty(vistaSegunda.Franjas);

        // El listado de ediciones trae las dos, en orden de creación.
        var ediciones = (await e.Organizacion.Sesion.GetFromJsonAsync<List<EdicionConAgendaDto>>(
            $"/api/v1/externo/organizaciones/{e.OrganizacionId}/agendas-de-citas"))!;
        var edicion = Assert.Single(ediciones, x => x.EdicionId == e.EdicionId);
        Assert.Equal(["Mercado Musical del Valle", "Sala de cámara"], edicion.Agendas!.Select(a => a.Nombre).ToArray());
        Assert.Equal(e.AgendaId, edicion.AgendaId);

        // Se actualiza una sola, con su dirección, y se puede cambiar su nombre.
        var actualizada = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, $"{baseDeLaEdicion}/agendas/{segunda.Id}",
            new AgendaConfiguracionRequest("compradores_fijos", 30, 0, 4, 48, 12, null, null, "aceptacion", "Sala grande"));
        Assert.Equal(HttpStatusCode.OK, actualizada.StatusCode);
        var renombrada = (await actualizada.Content.ReadFromJsonAsync<AgendaDto>())!;
        Assert.Equal("Sala grande", renombrada.Nombre);
        Assert.Equal(12, renombrada.CupoArtistas);
    }

    [Fact]
    public async Task Dos_agendas_de_una_edicion_no_pueden_llamarse_igual_y_la_ruta_antigua_pide_cual()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var baseDeLaEdicion = $"/api/v1/externo/organizaciones/{e.OrganizacionId}/ediciones-de-mercado/{e.EdicionId}";

        // Sin nombre, la segunda parte del nombre del Mercado y se distingue con el subtítulo «Agenda 2».
        var sinNombre = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{baseDeLaEdicion}/agendas",
            new AgendaConfiguracionRequest("compradores_rotan", 20, 5, 5, 72, null, null, null));
        Assert.Equal(HttpStatusCode.Created, sinNombre.StatusCode);
        var segunda = (await sinNombre.Content.ReadFromJsonAsync<AgendaDto>())!;
        Assert.Equal("Mercado Musical del Valle", segunda.Nombre);
        Assert.Equal("Agenda 2", segunda.Subtitulo);

        var repetida = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Post, $"{baseDeLaEdicion}/agendas",
            new AgendaConfiguracionRequest("compradores_rotan", 20, 5, 5, 72, null, null, null, null, "mercado musical del valle"));
        Assert.Equal(HttpStatusCode.Conflict, repetida.StatusCode);

        // La dirección en singular, con una sola agenda, la actualizaba; con varias, no adivina.
        var ambigua = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, $"{baseDeLaEdicion}/agenda",
            new AgendaConfiguracionRequest("compradores_rotan", 20, 5, 5, 72, null, null, null));
        Assert.Equal(HttpStatusCode.Conflict, ambigua.StatusCode);

        // Y no se configura una agenda de otra edición con la dirección de esta.
        var ajena = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put, $"{baseDeLaEdicion}/agendas/999999",
            new AgendaConfiguracionRequest("compradores_rotan", 20, 5, 5, 72, null, null, null));
        Assert.Equal(HttpStatusCode.NotFound, ajena.StatusCode);
    }

    [Fact]
    public async Task La_organizacion_exporta_el_calendario_de_toda_la_agenda_con_las_citas_confirmadas()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory, nombre: "Camilo");
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);
        await InscribirAsync(artista, e.AgendaId);
        var anfitrion = Assert.Single((await MiAgendaAsync(comprador, e.AgendaId)).Anfitriones);
        var pedida = await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[0]);
        var cita = Assert.Single((await pedida.Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas);

        // Solicitada todavía: el .ics de la organización solo lleva las confirmadas.
        var vacio = await (await e.Organizacion.Sesion.GetAsync($"{e.Org}/exportar.ics")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("BEGIN:VEVENT", vacio, StringComparison.Ordinal);

        (await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post, $"{Persona}/{e.AgendaId}/citas/{cita.Id}/confirmar", new { }))
            .EnsureSuccessStatusCode();
        var respuesta = await e.Organizacion.Sesion.GetAsync($"{e.Org}/exportar.ics");
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.StartsWith("text/calendar", respuesta.Content.Headers.ContentType!.ToString(), StringComparison.Ordinal);
        var ics = await respuesta.Content.ReadAsStringAsync();
        Assert.Contains("BEGIN:VEVENT", ics, StringComparison.Ordinal);
        Assert.Contains("LOCATION:Mesa 1", ics, StringComparison.Ordinal);
        Assert.Contains("X-WR-CALNAME:Mercado Musical del Valle", ics, StringComparison.Ordinal);

        // Una cuenta que no es de la organización no lo descarga.
        var ajeno = await PersonaAsync(factory);
        Assert.NotEqual(HttpStatusCode.OK, (await ajeno.Sesion.GetAsync($"{e.Org}/exportar.ics")).StatusCode);
    }

    // ──────────────────────── La mesa o la sala la asigna la organización (AGE2) ────────────────────────

    [Fact]
    public async Task La_mesa_la_asigna_la_organizacion_y_quien_participa_solo_la_ve_en_su_cita()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory, nombre: "Camilo");
        var artista = await PersonaAsync(factory);
        var invitado = await InvitarCompradorAsync(e, comprador.Correo); // «Mesa 1» la puso la organización al invitar.

        // Quien se inscribe no puede escribir una mesa: el cuerpo trae «espacio» y se ignora.
        var inscripcion = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Post, $"{Persona}/{e.AgendaId}/inscripcion",
            new { nombre = "Valeria", entidad = "Trío", presentacion = "Música del Pacífico.", espacio = "Mesa VIP" });
        Assert.Equal(HttpStatusCode.OK, inscripcion.StatusCode);
        var yo = (await inscripcion.Content.ReadFromJsonAsync<MiAgendaDto>())!.MiParticipacion!;
        Assert.Null(yo.Espacio);

        // Ni el comprador ni el artista pueden asignarla con la ruta de la organización.
        foreach (var quien in new[] { comprador, artista })
        {
            var intento = await EnviarAsync(quien.Sesion, quien.Csrf, HttpMethod.Put,
                $"{e.Org}/participantes/{invitado.Id}/espacio", new { espacio = "Mesa VIP" });
            Assert.NotEqual(HttpStatusCode.OK, intento.StatusCode);
        }

        // La organización la cambia y el artista la lee en su cita, junto con quien la pidió.
        var cambiada = await EnviarAsync(e.Organizacion.Sesion, e.Organizacion.Csrf, HttpMethod.Put,
            $"{e.Org}/participantes/{invitado.Id}/espacio", new { espacio = "Sala del Mar" });
        Assert.Equal(HttpStatusCode.OK, cambiada.StatusCode);
        var anfitrion = Assert.Single((await MiAgendaAsync(comprador, e.AgendaId)).Anfitriones);
        var pedida = await PedirAsync(comprador, e.AgendaId, anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[0]);
        var cita = Assert.Single((await pedida.Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas);
        var vistaDelArtista = await MiAgendaAsync(artista, e.AgendaId);
        Assert.Equal("Sala del Mar", Assert.Single(vistaDelArtista.Citas).Espacio);
        Assert.Equal(cita.Id, vistaDelArtista.Citas[0].Id);
    }

    // ───────────────────────────── La foto de quien participa (AGE2) ─────────────────────────────

    [Fact]
    public async Task La_foto_de_quien_participa_sale_en_la_agenda_de_la_organizacion_y_solo_se_vincula_una_foto_propia()
    {
        await using var factory = new TestWebApplicationFactory();
        var e = await EscenarioAsync(factory);
        var comprador = await PersonaAsync(factory, nombre: "Camilo");
        var artista = await PersonaAsync(factory);
        await InvitarCompradorAsync(e, comprador.Correo);
        await InscribirAsync(artista, e.AgendaId);

        int fotoDelArtista, fotoAjena;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var yo = await db.Users.AsNoTracking().FirstAsync(u => u.Email == artista.Correo);
            var otro = await db.Users.AsNoTracking().FirstAsync(u => u.Email == comprador.Correo);
            FileRow Foto(int dueno, string nombre) => new()
            {
                OriginalName = nombre, StoredName = nombre, MimeType = "image/jpeg", Extension = ".jpg", FileSizeBytes = 1024,
                StoragePath = nombre, PublicUrl = "/api/v1/publico/archivos/" + nombre, AltText = "Foto de prueba",
                UploadedByUserId = dueno, CreatedAt = DateTime.UtcNow,
            };
            var mia = Foto(yo.Id, "foto-artista.jpg");
            var suya = Foto(otro.Id, "foto-comprador.jpg");
            db.Files.AddRange(mia, suya);
            await db.SaveChangesAsync();
            fotoDelArtista = mia.Id;
            fotoAjena = suya.Id;
        }

        // Una foto que subió otra persona no se puede vincular a mi participación.
        var ajena = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Put, $"{Persona}/{e.AgendaId}/mi-foto", new MiFotoRequest(fotoAjena));
        Assert.Equal(HttpStatusCode.Conflict, ajena.StatusCode);
        // Quien no participa no tiene foto que guardar aquí.
        var forastero = await PersonaAsync(factory);
        Assert.Equal(HttpStatusCode.NotFound, (await EnviarAsync(forastero.Sesion, forastero.Csrf, HttpMethod.Put,
            $"{Persona}/{e.AgendaId}/mi-foto", new MiFotoRequest(fotoDelArtista))).StatusCode);

        var propia = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Put, $"{Persona}/{e.AgendaId}/mi-foto", new MiFotoRequest(fotoDelArtista));
        Assert.Equal(HttpStatusCode.OK, propia.StatusCode);
        var suVista = (await propia.Content.ReadFromJsonAsync<MiAgendaDto>())!;
        Assert.Equal($"/api/v1/publico/archivos/{fotoDelArtista}", suVista.MiParticipacion!.FotoUrl);

        // La organización la ve en su lista de participantes; el comprador, en la tarjeta del artista.
        var org = (await e.Organizacion.Sesion.GetFromJsonAsync<AgendaDelOrganizadorDto>(e.Org))!;
        var delArtista = Assert.Single(org.Participantes, p => p.Rol == "artista");
        Assert.Equal($"/api/v1/publico/archivos/{fotoDelArtista}", delArtista.FotoUrl);
        var paraElComprador = Assert.Single((await MiAgendaAsync(comprador, e.AgendaId)).Anfitriones);
        Assert.Equal($"/api/v1/publico/archivos/{fotoDelArtista}", paraElComprador.Anfitrion.FotoUrl);
        Assert.Null(Assert.Single(org.Participantes, p => p.Rol == "comprador").FotoUrl);

        // Quitarla devuelve las iniciales.
        var quitada = await EnviarAsync(artista.Sesion, artista.Csrf, HttpMethod.Put, $"{Persona}/{e.AgendaId}/mi-foto", new MiFotoRequest(null));
        Assert.Null((await quitada.Content.ReadFromJsonAsync<MiAgendaDto>())!.MiParticipacion!.FotoUrl);
    }
}
