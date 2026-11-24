using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La agenda de citas <b>contra SQL Server</b>: lo que escribe en la bitácora y en el registro de cambios
/// lo admite la base, y la doble reserva es imposible de verdad, también cuando muchas personas piden a la
/// vez (docs/referencia/26-agenda-de-citas-y-mercados.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ EXISTE.</b> Todo flujo que escribe bitácora se prueba aquí: SQLite no tiene
/// <c>CK_BitacoraAuditoria_Accion</c>, ni <c>ISJSON</c>, ni los CHECK propios de las cuatro tablas de la
/// agenda, ni la concurrencia real de un índice único filtrado. Un verbo o un valor que la base rechaza
/// solo se ve como un 500 en este carril.
/// </para>
/// <para>Omitida salvo que se encienda la vía de SQL Server. Ver <c>ArnesSqlServer</c>.</para>
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class AgendamientoDeCitasSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private const string Persona = "/api/v1/externo/agendas-de-citas";
    private readonly SqlServerFixture _base;

    public AgendamientoDeCitasSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    // ───────────────────────────────────── Ayudantes ─────────────────────────────────────

    private async Task<HttpClient> PersonaAsync(string? correo = null, string nombre = "Valeria")
    {
        var cliente = _base.CrearCliente();
        correo ??= $"cita.{Guid.NewGuid():N}"[..24] + "@correo.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = nombre,
            FirstSurname = "Ocampo",
            DocumentType = "cc",
            DocumentNumber = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            Phone = "3001234567",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();
        cliente.DefaultRequestHeaders.Add("X-Prueba-Correo", correo);
        return cliente;
    }

    private static string CorreoDe(HttpClient cliente) =>
        cliente.DefaultRequestHeaders.GetValues("X-Prueba-Correo").Single();

    private async Task<(HttpClient Sesion, int OrganizacionId)> OrganizacionAsync()
    {
        var cliente = _base.CrearCliente();
        var correo = $"citas.org.{Guid.NewGuid():N}"[..24] + "@organizacion.test";
        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio FROM dbo.Divipola "
            + "ORDER BY CodigoDepartamento, CodigoMunicipio;"), CultureInfo.InvariantCulture)!.Split('|');
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Corporación del Mercado de la base real",
            FullName = "Responsable",
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = par[0],
            HeadquartersMunicipalityCode = par[1],
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave }))
            .EnsureSuccessStatusCode();
        var mias = await cliente.GetFromJsonAsync<List<OrganizacionAdministradaDto>>("/api/v1/externo/organizaciones/mis");
        return (cliente, int.Parse(mias![0].Id, CultureInfo.InvariantCulture));
    }

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object? cuerpo = null)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(metodo, ruta);
        if (cuerpo is not null) mensaje.Content = JsonContent.Create(cuerpo);
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await cliente.SendAsync(mensaje);
    }

    /// <summary>Un Mercado publicado con una edición programada, una agenda abierta y cinco franjas.</summary>
    private async Task<(HttpClient Org, int OrganizacionId, int AgendaId, string Ruta, List<FranjaDto> Franjas)> AgendaAbiertaAsync(
        string modo = "compradores_rotan", int? cupo = null, string? aprobacion = null)
    {
        var (org, organizacionId) = await OrganizacionAsync();
        var inicio = DateTime.UtcNow.Date.AddDays(10);
        int edicionId;
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var mercado = new MercadoRow
            {
                Nombre = "Mercado de la base real",
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
                MercadoId = mercado.Id, Anio = inicio.Year, Nombre = "Edición SQL", FechaInicio = inicio,
                FechaFin = inicio.AddDays(2), Estado = "programada", EstadoVisibilidad = "publicado",
                FechaCreacion = DateTime.UtcNow,
            };
            db.EdicionesMercado.Add(edicion);
            await db.SaveChangesAsync();
            edicionId = edicion.Id;
        }

        var configurada = await EnviarAsync(org, HttpMethod.Put,
            $"/api/v1/externo/organizaciones/{organizacionId}/ediciones-de-mercado/{edicionId}/agenda",
            new AgendaConfiguracionRequest(modo, 20, 5, 5, 72, cupo, null, null, aprobacion));
        Assert.Equal(HttpStatusCode.Created, configurada.StatusCode);
        var agenda = (await configurada.Content.ReadFromJsonAsync<AgendaDto>())!;
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/agendas-de-citas/{agenda.Id}";

        var generadas = await EnviarAsync(org, HttpMethod.Post, $"{ruta}/franjas",
            new GenerarFranjasRequest(inicio.AddDays(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), "09:00", "11:00"));
        Assert.Equal(HttpStatusCode.OK, generadas.StatusCode);
        var franjas = (await generadas.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("franjas")
            .Deserialize<List<FranjaDto>>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(org, HttpMethod.Post, $"{ruta}/estado", new CambiarEstadoDeAgendaRequest("abrir"))).StatusCode);
        return (org, organizacionId, agenda.Id, ruta, franjas);
    }

    private static async Task<HttpResponseMessage> InscribirAsync(HttpClient artista, int agendaId, string nombre = "Valeria Ocampo") =>
        await EnviarAsync(artista, HttpMethod.Post, $"{Persona}/{agendaId}/inscripcion",
            new InscripcionRequest(nombre, "Trío Valeria", "Música del Pacífico para cuarteto.", null, null, null, null));

    private static async Task<MiAgendaDto> MiAgendaAsync(HttpClient cuenta, int agendaId) =>
        (await cuenta.GetFromJsonAsync<MiAgendaDto>($"{Persona}/{agendaId}"))!;

    private static async Task InvitarAsync(HttpClient org, string ruta, string correo, string nombre) =>
        Assert.Equal(HttpStatusCode.Created, (await EnviarAsync(org, HttpMethod.Post, $"{ruta}/compradores",
            new AgregarCompradorRequest(nombre, "Festival de prueba", "festival", correo, "Programo para un festival.", null, "Mesa 1"))).StatusCode);

    private async Task<int> CuentaAsync(string sql) =>
        Convert.ToInt32(await _base.EscalarAsync(sql), CultureInfo.InvariantCulture);

    // ═════════════════════════════════════ Lo que la base admite ═════════════════════════════════════

    [HechoSqlServer]
    public async Task El_recorrido_escribe_la_bitacora_y_el_registro_de_cambios_que_la_base_admite()
    {
        var (org, _, agendaId, ruta, _) = await AgendaAbiertaAsync();
        var comprador = await PersonaAsync(nombre: "Camilo");
        var artista = await PersonaAsync();
        await InvitarAsync(org, ruta, CorreoDe(comprador), "Camilo Comprador");
        Assert.Equal(HttpStatusCode.OK, (await InscribirAsync(artista, agendaId)).StatusCode);

        var vista = await MiAgendaAsync(comprador, agendaId);
        var anfitrion = vista.Anfitriones.Single();
        var pedida = await EnviarAsync(comprador, HttpMethod.Post, $"{Persona}/{agendaId}/citas",
            new SolicitarCitaRequest(anfitrion.Anfitrion.Id, anfitrion.FranjasLibres[0], "Quiero escucharte."));
        Assert.Equal(HttpStatusCode.OK, pedida.StatusCode);
        var cita = (await pedida.Content.ReadFromJsonAsync<MiAgendaDto>())!.Citas.Single();
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(artista, HttpMethod.Post,
            $"{Persona}/{agendaId}/citas/{cita.Id}/confirmar", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(comprador, HttpMethod.Post,
            $"{Persona}/{agendaId}/citas/{cita.Id}/cancelar", new MotivoRequest("Se me cruzó una reunión."))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(org, HttpMethod.Post, $"{ruta}/estado", new CambiarEstadoDeAgendaRequest("cerrar"))).StatusCode);

        // BITÁCORA: JSON válido, contrato único y los verbos que admite CK_BitacoraAuditoria_Accion.
        foreach (var (tabla, id, evento, verbo) in new[]
        {
            ("AgendasDeCitas", agendaId, "AgendaDeCitasCreada", "crear"),
            ("AgendasDeCitas", agendaId, "FranjasDeCitasGeneradas", "crear"),
            ("AgendasDeCitas", agendaId, "AgendaDeCitasAbierta", "actualizar"),
            ("AgendasDeCitas", agendaId, "AgendaDeCitasCerrada", "actualizar"),
            ("CitasDeAgenda", cita.Id, "CitaSolicitada", "crear"),
            ("CitasDeAgenda", cita.Id, "CitaConfirmada", "actualizar"),
            ("CitasDeAgenda", cita.Id, "CitaCancelada", "actualizar"),
        })
        {
            Assert.True(await CuentaAsync(
                $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'{tabla}' "
                + $"AND IdRegistroAfectado = N'{id}' AND Accion = N'{verbo}' AND ISJSON(ValoresNuevos) = 1 "
                + $"AND JSON_VALUE(ValoresNuevos, '$.evento') = N'{evento}';") >= 1,
                $"Falta la línea de bitácora «{evento}» ({verbo}).");
        }
        Assert.True(await CuentaAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'ParticipantesDeCitas' "
            + "AND JSON_VALUE(ValoresNuevos, '$.evento') = N'InscripcionEnAgendaDeCitas';") >= 1);

        // REGISTRO DE CAMBIOS: cada estado de la cita queda, con su motivo, campo por campo.
        Assert.Equal("cancelada", Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) ValorNuevo FROM dbo.CambiosDeRegistro WHERE ModuloId = N'citas-de-agenda' "
            + $"AND RegistroId = N'{cita.Id}' AND CampoId = N'estado' ORDER BY IdCambio DESC;"), CultureInfo.InvariantCulture));
        Assert.Equal("confirmada", Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) ValorAnterior FROM dbo.CambiosDeRegistro WHERE ModuloId = N'citas-de-agenda' "
            + $"AND RegistroId = N'{cita.Id}' AND CampoId = N'estado' ORDER BY IdCambio DESC;"), CultureInfo.InvariantCulture));
        Assert.True(await CuentaAsync(
            "SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'agendas-de-citas' "
            + $"AND RegistroId = N'{agendaId}' AND CampoId = N'estado' AND ValorNuevo = N'cerrada';") >= 1);

        // AVISOS: la otra parte se entera de cada paso, en las tablas que la base admite.
        Assert.True(await CuentaAsync(
            "SELECT COUNT(*) FROM dbo.Notificaciones WHERE ModuloId = N'agendas-de-citas' "
            + $"AND RegistroId = N'{agendaId}' AND TipoEvento = N'CitaSolicitada';") >= 1);
    }

    [HechoSqlServer]
    public async Task Las_cuatro_tablas_declaran_sus_restricciones_en_la_base_real()
    {
        // Los CHECK y los índices únicos filtrados que hacen cumplir las reglas existen de verdad.
        foreach (var restriccion in new[]
        {
            "CK_AgendasDeCitas_Estado", "CK_AgendasDeCitas_Modo", "CK_AgendasDeCitas_Duracion", "CK_AgendasDeCitas_Pausa",
            "CK_AgendasDeCitas_Tope", "CK_AgendasDeCitas_Vence", "CK_AgendasDeCitas_Aprobacion", "CK_InvitacionesDeAgenda_Estado", "CK_ParticipantesDeCitas_Rol", "CK_ParticipantesDeCitas_Identidad",
            "CK_ParticipantesDeCitas_Espera", "CK_CitasDeAgenda_Estado", "CK_CitasDeAgenda_Distintos", "CK_FranjasDeCitas_Rango",
        })
        {
            Assert.True(1 == await CuentaAsync($"SELECT COUNT(*) FROM sys.check_constraints WHERE name = N'{restriccion}';"), $"Falta el CHECK {restriccion}.");
        }
        foreach (var indice in new[]
        {
            "UX_CitasDeAgenda_Anfitrion_Franja", "UX_CitasDeAgenda_Visitante_Franja",
            "UX_ParticipantesDeCitas_Artista", "UX_ParticipantesDeCitas_Comprador",
            "UX_InvitacionesDeAgenda_PendientePorComprador",
        })
        {
            Assert.True(1 == await CuentaAsync($"SELECT COUNT(*) FROM sys.indexes WHERE name = N'{indice}' AND is_unique = 1 AND has_filter = 1;"), $"Falta el índice único filtrado {indice}.");
        }
        // El testigo de una invitación es único sin más (no lleva filtro: ningún resumen se repite jamás).
        Assert.Equal(1, await CuentaAsync("SELECT COUNT(*) FROM sys.indexes WHERE name = N'UQ_InvitacionesDeAgenda_HashTestigo' AND is_unique = 1;"));
        // Y ninguna de las cuatro tiene cascadas.
        Assert.Equal(0, await CuentaAsync(
            "SELECT COUNT(*) FROM sys.foreign_keys WHERE delete_referential_action <> 0 "
            + "AND parent_object_id IN (OBJECT_ID(N'dbo.AgendasDeCitas'), OBJECT_ID(N'dbo.FranjasDeCitas'), "
            + "OBJECT_ID(N'dbo.ParticipantesDeCitas'), OBJECT_ID(N'dbo.CitasDeAgenda'), OBJECT_ID(N'dbo.InvitacionesDeAgenda'));"));
    }

    [HechoSqlServer]
    public async Task Una_edicion_admite_varias_agendas_y_la_base_hace_unico_el_nombre_dentro_de_la_edicion()
    {
        // La migración V20261117_70 quitó la unicidad por edición y puso la del nombre dentro de la edición; V20261123_20 la extiende al subtítulo.
        Assert.Equal(0, await CuentaAsync("SELECT COUNT(*) FROM sys.key_constraints WHERE name = N'UQ_AgendasDeCitas_Edicion';"));
        Assert.Equal(1, await CuentaAsync("SELECT COUNT(*) FROM sys.indexes WHERE name = N'UX_AgendasDeCitas_EdicionNombreSubtitulo' AND is_unique = 1;"));
        Assert.Equal(1, await CuentaAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.AgendasDeCitas') AND name = N'Nombre' AND is_nullable = 0;"));

        var (org, organizacionId, agendaId, _, _) = await AgendaAbiertaAsync();
        int edicionId;
        using (var scope = _base.Services.CreateScope())
        {
            edicionId = (await scope.ServiceProvider.GetRequiredService<SimusDbContext>().AgendasDeCitas.AsNoTracking().FirstAsync(a => a.Id == agendaId)).EdicionMercadoId;
        }
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/ediciones-de-mercado/{edicionId}/agendas";
        Task<HttpResponseMessage> Crear(string? nombre) => EnviarAsync(org, HttpMethod.Post, ruta,
            new AgendaConfiguracionRequest("compradores_fijos", 30, 0, 4, 48, 10, null, null, "aceptacion", nombre));

        var segunda = await Crear("Sala de cámara");
        Assert.Equal(HttpStatusCode.Created, segunda.StatusCode);
        // El mismo nombre en la misma edición lo para la API y, si llegara a la base, el índice único.
        Assert.Equal(HttpStatusCode.Conflict, (await Crear("sala de cámara")).StatusCode);
        Assert.Equal(2, await CuentaAsync($"SELECT COUNT(*) FROM dbo.AgendasDeCitas WHERE EdicionMercadoId = {edicionId};"));
        var duplicado = await Assert.ThrowsAnyAsync<SqlException>(async () => await CuentaAsync(
            $"INSERT INTO dbo.AgendasDeCitas (EdicionMercadoId, Nombre, Subtitulo) SELECT TOP 1 EdicionMercadoId, Nombre, Subtitulo FROM dbo.AgendasDeCitas WHERE EdicionMercadoId = {edicionId} AND Nombre = N'Sala de cámara'; SELECT 1;"));
        Assert.Contains("UX_AgendasDeCitas_EdicionNombreSubtitulo", duplicado.Message, StringComparison.Ordinal);
    }

    [HechoSqlServer]
    public async Task La_base_rechaza_la_segunda_cita_viva_en_la_misma_franja()
    {
        var (org, _, agendaId, ruta, franjas) = await AgendaAbiertaAsync();
        var uno = await PersonaAsync();
        var dos = await PersonaAsync();
        var artista = await PersonaAsync();
        await InvitarAsync(org, ruta, CorreoDe(uno), "Comprador uno");
        await InvitarAsync(org, ruta, CorreoDe(dos), "Comprador dos");
        await InscribirAsync(artista, agendaId);

        var vista = await MiAgendaAsync(uno, agendaId);
        var anfitrion = vista.Anfitriones.Single().Anfitrion;
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(uno, HttpMethod.Post, $"{Persona}/{agendaId}/citas",
            new SolicitarCitaRequest(anfitrion.Id, franjas[0].Id, null))).StatusCode);

        var visitanteDos = await MiAgendaAsync(dos, agendaId);
        var idDos = visitanteDos.MiParticipacion!.Id;
        // Saltándose la API, SQL Server rechaza con un error de índice único (2601 o 2627).
        var error = await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            "INSERT INTO dbo.CitasDeAgenda (AgendaId, FranjaId, AnfitrionId, VisitanteId, Estado, FechaSolicitud) "
            + $"VALUES ({agendaId}, {franjas[0].Id}, {anfitrion.Id}, {idDos}, N'solicitada', SYSUTCDATETIME());"));
        Assert.True(error.Number is 2601 or 2627, $"Se esperaba un índice único (2601 o 2627) y fue {error.Number}.");

        // Un estado fuera de la lista tampoco entra (CHECK).
        var fueraDeLista = await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            "INSERT INTO dbo.CitasDeAgenda (AgendaId, FranjaId, AnfitrionId, VisitanteId, Estado, FechaSolicitud) "
            + $"VALUES ({agendaId}, {franjas[1].Id}, {anfitrion.Id}, {idDos}, N'inventada', SYSUTCDATETIME());"));
        Assert.Equal(547, fueraDeLista.Number);
    }

    [HechoSqlServer]
    public async Task Muchos_compradores_pidiendo_la_misma_franja_a_la_vez_solo_dejan_pasar_a_uno()
    {
        var (org, _, agendaId, ruta, franjas) = await AgendaAbiertaAsync();
        var artista = await PersonaAsync();
        await InscribirAsync(artista, agendaId);

        const int Compradores = 8;
        var compradores = new List<HttpClient>();
        for (var i = 0; i < Compradores; i++)
        {
            var c = await PersonaAsync(nombre: $"Comprador{i}");
            await InvitarAsync(org, ruta, CorreoDe(c), $"Comprador {i}");
            compradores.Add(c);
        }
        var anfitrion = (await MiAgendaAsync(compradores[0], agendaId)).Anfitriones.Single().Anfitrion;

        // Cada uno pide la MISMA franja con el MISMO artista, todos a la vez.
        var respuestas = await Task.WhenAll(compradores.Select(c => EnviarAsync(c, HttpMethod.Post, $"{Persona}/{agendaId}/citas",
            new SolicitarCitaRequest(anfitrion.Id, franjas[0].Id, "A la vez."))));

        Assert.Equal(1, respuestas.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(Compradores - 1, respuestas.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.DoesNotContain(respuestas, r => (int)r.StatusCode >= 500);
        Assert.Equal(1, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.CitasDeAgenda WHERE AgendaId = {agendaId} AND FranjaId = {franjas[0].Id} "
            + "AND Estado IN (N'solicitada', N'confirmada');"));
    }

    [HechoSqlServer]
    public async Task Muchas_inscripciones_a_la_vez_no_se_pasan_del_cupo()
    {
        var (_, _, agendaId, _, _) = await AgendaAbiertaAsync(cupo: 3);

        const int Artistas = 8;
        var cuentas = new List<HttpClient>();
        for (var i = 0; i < Artistas; i++) cuentas.Add(await PersonaAsync(nombre: $"Artista{i}"));

        var respuestas = await Task.WhenAll(cuentas.Select((c, i) => InscribirAsync(c, agendaId, $"Artista {i}")));

        var codigos = string.Join(", ", respuestas.Select(r => (int)r.StatusCode));
        var cuerpos = string.Join(" | ", await Task.WhenAll(respuestas.Where(r => r.StatusCode != HttpStatusCode.OK)
            .Select(async r => (await r.Content.ReadAsStringAsync())[..Math.Min(200, (await r.Content.ReadAsStringAsync()).Length)])));
        Assert.True(respuestas.All(r => r.StatusCode == HttpStatusCode.OK), $"Respuestas: {codigos}. {cuerpos}");
        Assert.Equal(3, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.ParticipantesDeCitas WHERE AgendaId = {agendaId} AND Rol = N'artista' AND Estado = N'aprobado';"));
        Assert.Equal(Artistas - 3, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.ParticipantesDeCitas WHERE AgendaId = {agendaId} AND Rol = N'artista' AND Estado = N'lista_de_espera';"));
    }

    [HechoSqlServer]
    public async Task Rechazar_con_motivo_promueve_al_primero_de_la_lista_y_escribe_lo_que_la_base_admite()
    {
        var (org, _, agendaId, ruta, _) = await AgendaAbiertaAsync(cupo: 1);
        var primero = await PersonaAsync();
        var segundo = await PersonaAsync();
        Assert.Equal(HttpStatusCode.OK, (await InscribirAsync(primero, agendaId, "Primero Ocampo")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await InscribirAsync(segundo, agendaId, "Segundo Ocampo")).StatusCode);

        var organizador = await org.GetFromJsonAsync<AgendaDelOrganizadorDto>(ruta);
        var idPrimero = organizador!.Participantes.Single(p => p.Nombre == "Primero Ocampo").Id;
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(org, HttpMethod.Post, $"{ruta}/participantes/{idPrimero}/decision",
            new DecisionSobreParticipanteRequest("rechazar", "No cumple el perfil."))).StatusCode);

        Assert.Equal("aprobado", (await MiAgendaAsync(segundo, agendaId)).MiParticipacion!.Estado);
        Assert.Equal("No cumple el perfil.", Convert.ToString(await _base.EscalarAsync(
            $"SELECT MotivoDeLaDecision FROM dbo.ParticipantesDeCitas WHERE IdParticipante = {idPrimero};"), CultureInfo.InvariantCulture));
        Assert.True(await CuentaAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'ParticipantesDeCitas' "
            + "AND ISJSON(ValoresNuevos) = 1 AND JSON_VALUE(ValoresNuevos, '$.evento') = N'ParticipanteDeCitasPromovido';") >= 1);
    }

    [HechoSqlServer]
    public async Task El_lugar_en_la_lista_de_espera_no_cuenta_a_quien_pregunta_aunque_la_base_guarde_milesimas()
    {
        // La base guarda la hora de inscripción con milésimas (datetime2(3)); la fila que acaba de crearse
        // en memoria trae siete dígitos. Comparada contra sí misma, la persona se contaba en su propia fila.
        var (_, _, agendaId, _, _) = await AgendaAbiertaAsync(cupo: 1);
        var primero = await PersonaAsync(nombre: "Primero");
        var segundo = await PersonaAsync(nombre: "Segundo");
        var tercero = await PersonaAsync(nombre: "Tercero");
        Assert.Equal(HttpStatusCode.OK, (await InscribirAsync(primero, agendaId, "Primero Ocampo")).StatusCode);

        var alInscribirse = await (await InscribirAsync(segundo, agendaId, "Segundo Ocampo")).Content.ReadFromJsonAsync<MiAgendaDto>();
        Assert.Equal("lista_de_espera", alInscribirse!.MiParticipacion!.Estado);
        Assert.Equal(1, alInscribirse.PosicionEnLaLista);

        var elTercero = await (await InscribirAsync(tercero, agendaId, "Tercero Ocampo")).Content.ReadFromJsonAsync<MiAgendaDto>();
        Assert.Equal(2, elTercero!.PosicionEnLaLista);
        // Y leída después, la misma cifra.
        Assert.Equal(2, (await MiAgendaAsync(tercero, agendaId)).PosicionEnLaLista);
    }

    // ═════════════════ Aprobación de artistas e invitación por enlace (decisiones del 12 de noviembre) ═════════════════

    [HechoSqlServer]
    public async Task Muchas_aprobaciones_a_la_vez_no_se_pasan_del_cupo_y_escriben_lo_que_la_base_admite()
    {
        var (org, _, agendaId, ruta, _) = await AgendaAbiertaAsync(cupo: 3, aprobacion: "aceptacion");

        const int Artistas = 8;
        var cuentas = new List<HttpClient>();
        for (var i = 0; i < Artistas; i++) cuentas.Add(await PersonaAsync(nombre: $"Artista{i}"));
        foreach (var (cuenta, i) in cuentas.Select((c, i) => (c, i)))
        {
            Assert.Equal(HttpStatusCode.OK, (await InscribirAsync(cuenta, agendaId, $"Artista {i}")).StatusCode);
        }
        // Con aceptación nadie entra solo: los ocho quedan pendientes y no cuentan en el cupo.
        Assert.Equal(Artistas, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.ParticipantesDeCitas WHERE AgendaId = {agendaId} AND Estado = N'pendiente';"));

        var cola = (await org.GetFromJsonAsync<AgendaDelOrganizadorDto>(ruta))!;
        var respuestas = await Task.WhenAll(cola.Participantes.Where(p => p.Rol == "artista").Select(p =>
            EnviarAsync(org, HttpMethod.Post, $"{ruta}/participantes/{p.Id}/decision", new DecisionSobreParticipanteRequest("aprobar", null))));

        var codigos = string.Join(", ", respuestas.Select(r => (int)r.StatusCode));
        Assert.True(respuestas.All(r => r.StatusCode == HttpStatusCode.OK), $"Respuestas: {codigos}");
        Assert.Equal(3, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.ParticipantesDeCitas WHERE AgendaId = {agendaId} AND Rol = N'artista' AND Estado = N'aprobado';"));
        Assert.Equal(Artistas - 3, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.ParticipantesDeCitas WHERE AgendaId = {agendaId} AND Rol = N'artista' AND Estado = N'lista_de_espera';"));

        // Bitácora (JSON válido y verbo admitido) y registro de cambios del estado de cada participante.
        Assert.Equal(3, await CuentaAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'ParticipantesDeCitas' AND Accion = N'actualizar' "
            + "AND ISJSON(ValoresNuevos) = 1 AND JSON_VALUE(ValoresNuevos, '$.evento') = N'ParticipanteDeCitasAprobado' "
            + $"AND IdRegistroAfectado IN (SELECT CAST(IdParticipante AS nvarchar(20)) FROM dbo.ParticipantesDeCitas WHERE AgendaId = {agendaId});"));
        Assert.Equal(Artistas - 3, await CuentaAsync(
            "SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'ParticipantesDeCitas' AND Accion = N'actualizar' "
            + "AND ISJSON(ValoresNuevos) = 1 AND JSON_VALUE(ValoresNuevos, '$.evento') = N'ParticipanteDeCitasEnListaDeEspera' "
            + $"AND IdRegistroAfectado IN (SELECT CAST(IdParticipante AS nvarchar(20)) FROM dbo.ParticipantesDeCitas WHERE AgendaId = {agendaId});"));

        // La base no admite un estado inventado ni una aprobación fuera de la lista.
        var fueraDeLista = await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"UPDATE dbo.ParticipantesDeCitas SET Estado = N'inventado' WHERE AgendaId = {agendaId};"));
        Assert.Equal(547, fueraDeLista.Number);
        var aprobacionInvalida = await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            $"UPDATE dbo.AgendasDeCitas SET AprobacionDeArtistas = N'al_azar' WHERE IdAgenda = {agendaId};"));
        Assert.Equal(547, aprobacionInvalida.Number);
    }

    [HechoSqlServer]
    public async Task La_invitacion_por_enlace_escribe_la_bitacora_y_la_base_solo_admite_una_pendiente()
    {
        var (org, _, agendaId, ruta, _) = await AgendaAbiertaAsync();
        var correo = $"booker.{Guid.NewGuid():N}"[..24] + "@correo.test";
        await InvitarAsync(org, ruta, correo, "Booker sin cuenta");

        var idComprador = await CuentaAsync(
            $"SELECT IdParticipante FROM dbo.ParticipantesDeCitas WHERE AgendaId = {agendaId} AND CorreoInvitacion = N'{correo}';");
        // El correo salió a la cola de salida, pendiente, y de la invitación solo se guarda el resumen del testigo.
        Assert.Equal(1, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.Notificaciones WHERE CorreoDestinatario = N'{correo}' AND TipoEvento = N'InvitacionALaAgendaDeCitas' "
            + "AND Canal = N'email' AND Estado = N'pendiente' AND FechaEnvio IS NULL;"));
        Assert.Equal(1, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.InvitacionesDeAgenda WHERE ParticipanteId = {idComprador} AND Estado = N'pendiente' AND LEN(HashTestigo) = 64;"));

        // Saltándose la API, la base no deja una segunda pendiente para el mismo comprador (2601 o 2627).
        var error = await Assert.ThrowsAsync<SqlException>(() => _base.EscalarAsync(
            "INSERT INTO dbo.InvitacionesDeAgenda (ParticipanteId, CorreoInvitado, HashTestigo, Estado, IdUsuarioInvita, FechaEmision, FechaExpiracion) "
            + $"SELECT ParticipanteId, CorreoInvitado, REPLICATE(N'a', 64), N'pendiente', IdUsuarioInvita, FechaEmision, FechaExpiracion FROM dbo.InvitacionesDeAgenda WHERE ParticipanteId = {idComprador};"));
        Assert.True(error.Number is 2601 or 2627, $"Se esperaba un índice único (2601 o 2627) y fue {error.Number}.");

        // Aceptarla con la cuenta de ese correo enlaza al comprador y escribe la bitácora con los verbos que la base admite.
        var cuerpo = Convert.ToString(await _base.EscalarAsync(
            $"SELECT TOP (1) Cuerpo FROM dbo.Notificaciones WHERE CorreoDestinatario = N'{correo}' AND TipoEvento = N'InvitacionALaAgendaDeCitas';"),
            CultureInfo.InvariantCulture)!;
        var inicio = cuerpo.IndexOf("testigo=", StringComparison.Ordinal) + "testigo=".Length;
        var testigo = new string(cuerpo[inicio..].TakeWhile(char.IsAsciiHexDigit).ToArray());

        var booker = await PersonaAsync(correo, "Booker");
        Assert.Equal(HttpStatusCode.OK, (await EnviarAsync(booker, HttpMethod.Post,
            $"{Persona}/invitaciones/aceptar", new InvitacionDeAgendaSolicitud(testigo))).StatusCode);
        Assert.Equal("comprador", (await MiAgendaAsync(booker, agendaId)).MiParticipacion!.Rol);
        Assert.Equal(1, await CuentaAsync(
            $"SELECT COUNT(*) FROM dbo.InvitacionesDeAgenda WHERE ParticipanteId = {idComprador} AND Estado = N'aceptada' AND IdUsuarioAcepta IS NOT NULL;"));

        foreach (var (evento, verbo) in new[] { ("InvitacionDeAgendaEmitida", "crear"), ("InvitacionDeAgendaAceptada", "actualizar") })
        {
            Assert.True(await CuentaAsync(
                $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'InvitacionesDeAgenda' AND Accion = N'{verbo}' "
                + $"AND ISJSON(ValoresNuevos) = 1 AND JSON_VALUE(ValoresNuevos, '$.evento') = N'{evento}';") >= 1, evento);
        }
    }
}
