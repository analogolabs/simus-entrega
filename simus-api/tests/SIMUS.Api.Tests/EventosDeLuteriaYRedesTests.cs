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
using static SIMUS.Api.Tests.ProcesosDeLuteriaEnLaAgenda;

namespace SIMUS.Api.Tests;

/// <summary>
/// Los procesos de talleres de lutería, redes y espacios para música en vivo se publican como EVENTOS de la
/// Agenda normal (LUT-01 y LUT-02, decisión 104 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que un taller, un espacio o una red anuncien algo sin estar publicados
/// o a nombre de otra cuenta; que una persona sin organización toque los eventos de otra; que la regla de
/// errata, el retiro y la cancelación sean otros que los del Festival y el Mercado; que la Agenda pública no
/// diga de qué tipo es el evento o no deje filtrar por él; y que la ficha pública nombre a la persona
/// responsable.
/// </para>
/// <para>
/// Esto es el carril rápido (SQLite). Lo que escribe la base (la restricción de un solo proceso, el historial,
/// la bitácora y los avisos) se prueba además contra SQL Server en <see cref="EventosDeLuteriaYRedesSqlServerTests"/>.
/// </para>
/// </remarks>
public sealed class EventosDeLuteriaYRedesTests
{
    private static string RutaDeLaOrganizacion(int organizacionId) => $"/api/v1/externo/organizaciones/{organizacionId}/eventos";

    [Fact]
    public async Task La_lista_publica_trae_el_proceso_de_los_cinco_tipos_resuelto_en_lote()
    {
        // DECISIÓN 130: la tarjeta de la Agenda, el mapa y la portada leen la LISTA, no la ficha, y la lista
        // devolvía `proceso` nulo: el proceso al que está ligado el evento nunca llegaba a la pantalla.
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.lista@example.com");
        var festival = await EventosDeOrganizacionTests.FestivalAsync(cliente, factory, organizacionId, publicado: true);
        int mercado;
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = new MercadoRow
            {
                Nombre = "Mercado del Valle", NivelCobertura = "nacional", OrganizacionPrincipalId = organizacionId,
                EstadoRegistro = "publicado", Activo = true, FechaCreacion = DateTime.UtcNow, FechaPublicacion = DateTime.UtcNow,
            };
            db.Mercados.Add(fila);
            await db.SaveChangesAsync();
            mercado = fila.Id;
        }
        var taller = await ProcesoAsync(factory.Services, "taller", organizacionId, null, nombre: "Taller de lista");
        var espacio = await ProcesoAsync(factory.Services, "espacio", organizacionId, null, nombre: "Espacio de lista");
        var red = await ProcesoAsync(factory.Services, "red", organizacionId, null, nombre: "Red de lista");

        var ruta = RutaDeLaOrganizacion(organizacionId);
        Task Crear(string titulo, string clave, int id) => CrearYPublicarAsync(factory, cliente, ruta, new Dictionary<string, object?>
        {
            ["titulo"] = titulo, ["descripcion"] = Descripcion, ["modalidad"] = "presencial", ["lugar"] = "Plaza",
            ["fechaInicio"] = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(25), [clave] = id,
        });
        await Crear("Evento del festival", "festivalId", festival);
        await Crear("Evento del mercado", "mercadoId", mercado);
        await Crear("Evento del taller", "tallerId", taller);
        await Crear("Evento del espacio", "espacioId", espacio);
        await Crear("Evento de la red", "redId", red);

        var lista = (await factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/v1/publico/agenda?cuando=todos"))
            .GetProperty("items").EnumerateArray().ToDictionary(e => e.GetProperty("titulo").GetString()!);

        foreach (var (titulo, tipo) in new[] { ("Evento del festival", "festival"), ("Evento del mercado", "mercado"),
                     ("Evento del taller", "taller"), ("Evento del espacio", "espacio"), ("Evento de la red", "red") })
        {
            var proceso = lista[titulo].GetProperty("proceso");
            Assert.Equal(JsonValueKind.Object, proceso.ValueKind);
            Assert.Equal(tipo, proceso.GetProperty("tipo").GetString());
            Assert.False(string.IsNullOrWhiteSpace(proceso.GetProperty("nombre").GetString()));
            // La organización viaja con el proceso, y es la misma que da la ficha.
            var ficha = await factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/v1/publico/agenda/{lista[titulo].GetProperty("slug").GetString()}");
            Assert.Equal(ficha.GetProperty("proceso").GetRawText(), proceso.GetRawText());
        }
        Assert.Equal("Taller de lista", lista["Evento del taller"].GetProperty("proceso").GetProperty("nombre").GetString());
    }

    [Fact]
    public async Task La_lista_publica_no_revela_un_proceso_que_no_esta_publicado()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.lista.no@example.com");
        var taller = await ProcesoAsync(factory.Services, "taller", organizacionId, null, nombre: "Taller que se retira");
        await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), Evento("taller", taller, titulo: "Evento sin proceso a la vista"));

        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            (await db.Talleres.SingleAsync(t => t.Id == taller)).EstadoRegistro = "archivado";
            await db.SaveChangesAsync();
        }

        var texto = await factory.CreateClient().GetStringAsync("/api/v1/publico/agenda?cuando=todos");
        var evento = JsonDocument.Parse(texto).RootElement.GetProperty("items").EnumerateArray().Single();
        Assert.Equal(JsonValueKind.Null, evento.GetProperty("proceso").ValueKind);
        Assert.Equal("taller", evento.GetProperty("procesoTipo").GetString());
        Assert.DoesNotContain("Taller que se retira", texto, StringComparison.Ordinal);
    }

    private const string RutaDeLaPersona = "/api/v1/externo/mis-eventos";

    private static async Task<List<string?>> TitulosPublicosAsync(HttpClient cliente, string consulta = "") =>
        (await cliente.GetFromJsonAsync<JsonElement>("/api/v1/publico/agenda?cuando=todos" + consulta))
            .GetProperty("items").EnumerateArray().Select(e => e.GetProperty("titulo").GetString()).ToList();

    private static async Task<(string Id, string Slug)> CrearYPublicarAsync(
        TestWebApplicationFactory factory, HttpClient cliente, string ruta, Dictionary<string, object?> cuerpo)
    {
        var creado = await EnviarAsync(cliente, HttpMethod.Post, ruta, cuerpo);
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
        await PublicarAsync(factory.Services, id);

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var slug = (await db.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == long.Parse(id, CultureInfo.InvariantCulture))).Slug;
        return (id, slug);
    }

    // ---------- La organización anuncia eventos de su taller, su espacio o su red ---------------

    [Theory]
    [InlineData("taller", "Taller de lutería")]
    [InlineData("espacio", "Espacio para música en vivo")]
    [InlineData("red", "Red y documentación")]
    public async Task La_organizacion_anuncia_un_evento_de_su_proceso_y_nace_en_revision(string tipo, string etiqueta)
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, $"lut.{tipo}@example.com");
        var procesoId = await ProcesoAsync(factory.Services, tipo, organizacionId, null);

        var procesos = await cliente.GetFromJsonAsync<JsonElement>(RutaDeLaOrganizacion(organizacionId).Replace("/eventos", "/procesos-que-enmarcan"));
        var propuesto = Assert.Single(procesos.EnumerateArray());
        Assert.Equal(tipo, propuesto.GetProperty("tipo").GetString());
        Assert.Equal(etiqueta, propuesto.GetProperty("tipoEtiqueta").GetString());

        var creado = await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaOrganizacion(organizacionId), Evento(tipo, procesoId));
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("en_revision", cuerpo.GetProperty("estado").GetString());

        var lista = await cliente.GetFromJsonAsync<JsonElement>(RutaDeLaOrganizacion(organizacionId));
        var evento = Assert.Single(lista.EnumerateArray());
        Assert.Equal(tipo, evento.GetProperty("procesoTipo").GetString());

        // EL PROGRAMA LO VE EN SU BANDEJA, con el tipo y el nombre del proceso.
        var consola = await CmsTestClient.LoginAsync(factory);
        var cola = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/revision-de-eventos");
        var enCola = Assert.Single(cola.EnumerateArray());
        Assert.Equal(tipo, enCola.GetProperty("procesoTipo").GetString());
        Assert.False(string.IsNullOrWhiteSpace(enCola.GetProperty("procesoNombre").GetString()));
    }

    [Fact]
    public async Task Un_proceso_sin_publicar_o_ajeno_no_enmarca_eventos_y_no_dice_cual_de_los_dos_es()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.ajeno@example.com");
        var (_, otraOrganizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.otra@example.com");
        var enBorrador = await ProcesoAsync(factory.Services, "taller", organizacionId, null, estado: "borrador");
        var deLaOtra = await ProcesoAsync(factory.Services, "espacio", otraOrganizacionId, null);

        var procesos = await cliente.GetFromJsonAsync<JsonElement>(RutaDeLaOrganizacion(organizacionId).Replace("/eventos", "/procesos-que-enmarcan"));
        Assert.Equal(0, procesos.GetArrayLength());

        var sinPublicar = await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaOrganizacion(organizacionId), Evento("taller", enBorrador));
        Assert.Equal(HttpStatusCode.BadRequest, sinPublicar.StatusCode);
        Assert.Contains("tallerId", await sinPublicar.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        var ajeno = await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaOrganizacion(organizacionId), Evento("espacio", deLaOtra));
        Assert.Equal(HttpStatusCode.BadRequest, ajeno.StatusCode);
        Assert.Contains("espacioId", await ajeno.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Un_evento_se_enmarca_en_un_solo_proceso()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.dos@example.com");
        var taller = await ProcesoAsync(factory.Services, "taller", organizacionId, null);
        var red = await ProcesoAsync(factory.Services, "red", organizacionId, null);

        var cuerpo = Evento("taller", taller);
        cuerpo["redId"] = red;
        var respuesta = await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaOrganizacion(organizacionId), cuerpo);
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);

        var ninguno = Evento("taller", taller);
        ninguno.Remove("tallerId");
        Assert.Equal(HttpStatusCode.BadRequest, (await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaOrganizacion(organizacionId), ninguno)).StatusCode);
    }

    // ---------- La misma regla de errata, retiro y cancelación ---------------------------------

    // ---------- Retirar el proceso archiva sus eventos (decisión 113) --------------------------

    [Theory]
    [InlineData("taller", "talleres", false)]
    [InlineData("espacio", "espacios", false)]
    [InlineData("red", "redes", false)]
    [InlineData("taller", "talleres", true)]
    [InlineData("espacio", "espacios", true)]
    [InlineData("red", "redes", true)]
    public async Task Retirar_un_proceso_archiva_sus_eventos_y_deja_los_de_otro_proceso(string tipo, string plural, bool desdeLaConsola)
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, $"lut.retiro.{tipo}.{desdeLaConsola}@example.com");
        var proceso = await ProcesoAsync(factory.Services, tipo, organizacionId, null);
        var otro = await ProcesoAsync(factory.Services, tipo, organizacionId, null);
        var (propio, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), Evento(tipo, proceso, "Evento del proceso retirado"));
        var (ajeno, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), Evento(tipo, otro, "Evento de otro proceso"));
        Assert.Contains("Evento del proceso retirado", await TitulosPublicosAsync(cliente));

        if (desdeLaConsola)
        {
            var consola = await CmsTestClient.LoginAsync(factory);
            var respuesta = await consola.PostAsJsonAsync($"/api/v1/institucional/{plural}/{proceso}/archivar", new { motivo = "Datos falsos." });
            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        }
        else
        {
            var respuesta = await EnviarAsync(cliente, HttpMethod.Post, $"/api/v1/externo/{plural}/{proceso}/retirar", new { motivo = "Cerramos." });
            Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        }

        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var idPropio = long.Parse(propio, CultureInfo.InvariantCulture);
        var idAjeno = long.Parse(ajeno, CultureInfo.InvariantCulture);
        Assert.Equal("archivado", (await db.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == idPropio)).Estado);
        Assert.Equal("publicado", (await db.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == idAjeno)).Estado);
        var historial = await db.HistorialesRevisionRegistros.AsNoTracking()
            .Where(x => x.ModuloId == Modulos.Agenda && x.RegistroId == propio && x.Accion == "EventoArchivadoConSuProceso").ToListAsync();
        var fila = Assert.Single(historial);
        Assert.Equal("publicado", fila.EstadoAnterior);
        Assert.Equal("archivado", fila.EstadoNuevo);
        // NADA SE BORRA: el evento sigue en la base, solo deja de verse.
        var titulos = await TitulosPublicosAsync(cliente);
        Assert.DoesNotContain("Evento del proceso retirado", titulos);
        Assert.Contains("Evento de otro proceso", titulos);
    }

    [Theory]
    [InlineData("taller")]
    [InlineData("espacio")]
    [InlineData("red")]
    public async Task Antes_de_retirar_el_servidor_cuenta_los_eventos_que_se_archivarian(string tipo)
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, $"lut.cuenta.{tipo}@example.com");
        var proceso = await ProcesoAsync(factory.Services, tipo, organizacionId, null);
        await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), Evento(tipo, proceso, "Publicado uno"));
        var enRevision = await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaOrganizacion(organizacionId), Evento(tipo, proceso, "En revisión dos"));
        Assert.Equal(HttpStatusCode.Created, enRevision.StatusCode);

        var deLaOrganizacion = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/procesos/{tipo}/{proceso}/eventos-que-se-archivan");
        Assert.Equal(2, deLaOrganizacion.GetProperty("total").GetInt32());
        Assert.Equal(1, deLaOrganizacion.GetProperty("publicados").GetInt32());

        var consola = await CmsTestClient.LoginAsync(factory);
        var deLaConsola = await consola.GetFromJsonAsync<JsonElement>($"/api/v1/institucional/procesos/{tipo}/{proceso}/eventos-que-se-archivan");
        Assert.Equal(2, deLaConsola.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await consola.GetAsync("/api/v1/institucional/procesos/inventado/1/eventos-que-se-archivan")).StatusCode);

        // LA CUENTA ES LA MISMA QUE LUEGO ARCHIVA.
        (await consola.PostAsJsonAsync($"/api/v1/institucional/{(tipo == "taller" ? "talleres" : tipo == "espacio" ? "espacios" : "redes")}/{proceso}/archivar", new { motivo = "Cierre." })).EnsureSuccessStatusCode();
        var despues = await consola.GetFromJsonAsync<JsonElement>($"/api/v1/institucional/procesos/{tipo}/{proceso}/eventos-que-se-archivan");
        Assert.Equal(0, despues.GetProperty("total").GetInt32());
    }

    [Theory]
    [InlineData("taller")]
    [InlineData("espacio")]
    [InlineData("red")]
    public async Task El_conteo_de_eventos_solo_lo_ve_quien_administra_el_proceso_o_tiene_el_modulo(string tipo)
    {
        await using var factory = new TestWebApplicationFactory();
        var (duena, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, $"lut.conteo.dueña.{tipo}@example.com");
        var (ajena, _) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, $"lut.conteo.ajena.{tipo}@example.com");
        var proceso = await ProcesoAsync(factory.Services, tipo, organizacionId, null);
        var ruta = $"/api/v1/externo/procesos/{tipo}/{proceso}/eventos-que-se-archivan";
        var rutaConsola = $"/api/v1/institucional/procesos/{tipo}/{proceso}/eventos-que-se-archivan";

        // CANAL EXTERNO: la administradora cuenta; otra organización no ve ni que el proceso existe.
        Assert.Equal(HttpStatusCode.OK, (await duena.GetAsync(ruta)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ajena.GetAsync(ruta)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ajena.GetAsync($"/api/v1/externo/procesos/{tipo}/987654/eventos-que-se-archivan")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(ruta)).StatusCode);

        // CONSOLA: pide el módulo del proceso, no basta con ser funcionario.
        var sinModulo = await MercadosMusicalesTests.CuentaSinModulosAsync(factory);
        Assert.Equal(HttpStatusCode.Forbidden, (await sinModulo.GetAsync(rutaConsola)).StatusCode);
        var consola = await CmsTestClient.LoginAsync(factory);
        Assert.Equal(HttpStatusCode.OK, (await consola.GetAsync(rutaConsola)).StatusCode);
    }

    [Fact]
    public async Task La_persona_responsable_cuenta_los_eventos_de_su_taller_y_otra_persona_no()
    {
        await using var factory = new TestWebApplicationFactory();
        var (lutier, csrf, _) = await TalleresDeLuteriaTests.LutierAsync(factory);
        var (otra, _, _) = await TalleresDeLuteriaTests.LutierAsync(factory, "Otra");
        var (servicios, familias) = await TalleresDeLuteriaTests.CatalogosAsync(factory);
        var taller = await TalleresDeLuteriaTests.CrearComoPersonaAsync(lutier, csrf, TalleresDeLuteriaTests.UnTallerCompleto(servicios, familias));
        var ruta = $"/api/v1/externo/procesos/taller/{taller.Id}/eventos-que-se-archivan";

        Assert.Equal(HttpStatusCode.OK, (await lutier.GetAsync(ruta)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otra.GetAsync(ruta)).StatusCode);
    }

    [Fact]
    public async Task La_errata_el_cambio_de_fondo_el_retiro_y_la_cancelacion_son_los_del_resto_de_eventos()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.reglas@example.com");
        var taller = await ProcesoAsync(factory.Services, "taller", organizacionId, null);
        var otroTaller = await ProcesoAsync(factory.Services, "taller", organizacionId, null);
        var (id, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), Evento("taller", taller));
        var ruta = $"{RutaDeLaOrganizacion(organizacionId)}/{id}";

        // ERRATA: se aplica al instante y el evento sigue en la agenda.
        var errata = await EnviarAsync(cliente, HttpMethod.Put, ruta,
            Evento("taller", taller, descripcion: Descripcion.Replace("cuerda", "cuerda frotada", StringComparison.Ordinal)));
        var cuerpoErrata = await errata.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(cuerpoErrata.GetProperty("esErrata").GetBoolean());
        Assert.Equal("publicado", cuerpoErrata.GetProperty("estado").GetString());
        Assert.Contains("Taller de afinación abierto", await TitulosPublicosAsync(factory.CreateClient()));

        // CAMBIAR DE TALLER ES UN CAMBIO DE FONDO: vuelve a revisión y sale de la agenda.
        var fondo = await EnviarAsync(cliente, HttpMethod.Put, ruta, Evento("taller", otroTaller));
        var cuerpoFondo = await fondo.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("en_revision", cuerpoFondo.GetProperty("estado").GetString());
        Assert.Contains("el proceso que lo enmarca", cuerpoFondo.GetProperty("cambiosDeFondo").EnumerateArray().Select(c => c.GetString()));
        Assert.DoesNotContain("Taller de afinación abierto", await TitulosPublicosAsync(factory.CreateClient()));
    }

    [Fact]
    public async Task Retirar_y_cancelar_un_evento_de_un_espacio_exigen_motivo_y_hacen_lo_mismo_que_siempre()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.cancela@example.com");
        var espacio = await ProcesoAsync(factory.Services, "espacio", organizacionId, null);
        var (id, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), Evento("espacio", espacio));
        var (otroId, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId),
            Evento("espacio", espacio, titulo: "Concierto de cierre en la sala"));
        var anonimo = factory.CreateClient();

        Assert.Equal(HttpStatusCode.BadRequest,
            (await EnviarAsync(cliente, HttpMethod.Post, $"{RutaDeLaOrganizacion(organizacionId)}/{id}/cancelar", new { motivo = " " })).StatusCode);

        Assert.Equal(HttpStatusCode.OK,
            (await EnviarAsync(cliente, HttpMethod.Post, $"{RutaDeLaOrganizacion(organizacionId)}/{id}/cancelar", new { motivo = "La sala quedó sin luz." })).StatusCode);
        var publica = await anonimo.GetFromJsonAsync<JsonElement>("/api/v1/publico/agenda?cuando=todos");
        var cancelado = publica.GetProperty("items").EnumerateArray().Single(e => e.GetProperty("titulo").GetString() == "Taller de afinación abierto");
        Assert.True(cancelado.GetProperty("cancelado").GetBoolean());

        Assert.Equal(HttpStatusCode.OK,
            (await EnviarAsync(cliente, HttpMethod.Post, $"{RutaDeLaOrganizacion(organizacionId)}/{otroId}/retirar", new { motivo = "Se cayó el permiso." })).StatusCode);
        Assert.DoesNotContain("Concierto de cierre en la sala", await TitulosPublicosAsync(anonimo));
    }

    [Fact]
    public async Task La_regla_de_errata_cuenta_el_cambio_de_cualquiera_de_los_cinco_procesos()
    {
        var actual = new EventoAgendaRow
        {
            Titulo = "Taller de afinación abierto", Descripcion = Descripcion, FechaInicio = new DateOnly(2027, 1, 10),
            Modalidad = "presencial", Lugar = "Casa del taller", TallerId = 7,
        };
        var igual = new CrearEventoDeOrganizacionSolicitud
        {
            Titulo = actual.Titulo, Descripcion = actual.Descripcion, FechaInicio = actual.FechaInicio,
            Modalidad = actual.Modalidad, Lugar = actual.Lugar, TallerId = 7,
        };
        Assert.Empty(ReglasDeErrataDeEventos.CambiosDeFondo(actual, igual));

        foreach (var cambio in new Action<CrearEventoDeOrganizacionSolicitud>[]
        {
            s => { s.TallerId = 8; },
            s => { s.TallerId = null; s.EspacioId = 7; },
            s => { s.TallerId = null; s.RedId = 7; },
            s => { s.TallerId = null; s.MercadoId = 7; },
            s => { s.TallerId = null; s.FestivalId = 7; },
        })
        {
            var distinta = new CrearEventoDeOrganizacionSolicitud
            {
                Titulo = actual.Titulo, Descripcion = actual.Descripcion, FechaInicio = actual.FechaInicio,
                Modalidad = actual.Modalidad, Lugar = actual.Lugar, TallerId = 7,
            };
            cambio(distinta);
            Assert.Contains("el proceso que lo enmarca", ReglasDeErrataDeEventos.CambiosDeFondo(actual, distinta));
        }
    }

    // ---------- La Agenda pública: tipo, filtro y ficha ----------------------------------------

    [Fact]
    public async Task La_agenda_publica_dice_el_tipo_de_cada_evento_y_deja_filtrar_por_el()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.filtro@example.com");
        var taller = await ProcesoAsync(factory.Services, "taller", organizacionId, null);
        var red = await ProcesoAsync(factory.Services, "red", organizacionId, null);
        var festival = await EventosDeOrganizacionTests.FestivalAsync(cliente, factory, organizacionId, publicado: true);
        await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), Evento("taller", taller, titulo: "Taller de barnizado"));
        await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), Evento("red", red, titulo: "Jornada de catalogación"));
        await CrearYPublicarAsync(factory, cliente, RutaDeLaOrganizacion(organizacionId), new Dictionary<string, object?>
        {
            ["titulo"] = "Concierto del festival", ["descripcion"] = Descripcion,
            ["fechaInicio"] = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(20),
            ["modalidad"] = "presencial", ["lugar"] = "Plaza", ["festivalId"] = festival,
        });
        var anonimo = factory.CreateClient();

        Assert.Equal(["Taller de barnizado"], await TitulosPublicosAsync(anonimo, "&proceso=taller"));
        Assert.Equal(["Jornada de catalogación"], await TitulosPublicosAsync(anonimo, "&proceso=red"));
        Assert.Equal(["Concierto del festival"], await TitulosPublicosAsync(anonimo, "&proceso=festival"));
        Assert.Empty(await TitulosPublicosAsync(anonimo, "&proceso=espacio"));
        // UN TIPO QUE NO EXISTE NO VACÍA LA LISTA: es un enlace viejo, no una búsqueda sin resultados.
        Assert.Equal(3, (await TitulosPublicosAsync(anonimo, "&proceso=inventado")).Count);

        var todos = await anonimo.GetFromJsonAsync<JsonElement>("/api/v1/publico/agenda?cuando=todos");
        var tipos = todos.GetProperty("items").EnumerateArray()
            .ToDictionary(e => e.GetProperty("titulo").GetString()!, e => e.GetProperty("procesoTipo").GetString());
        Assert.Equal("taller", tipos["Taller de barnizado"]);
        Assert.Equal("red", tipos["Jornada de catalogación"]);
        Assert.Equal("festival", tipos["Concierto del festival"]);
    }

    [Fact]
    public async Task La_ficha_dice_de_que_proceso_es_y_nunca_nombra_a_la_persona_responsable()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, personaId) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.ficha");
        var taller = await ProcesoAsync(factory.Services, "taller", null, personaId, nombre: "Taller Los Cedros");
        var (_, slug) = await CrearYPublicarAsync(factory, cliente, RutaDeLaPersona, Evento("taller", taller));

        var ficha = await factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/v1/publico/agenda/{slug}");
        var proceso = ficha.GetProperty("proceso");
        Assert.Equal("taller", proceso.GetProperty("tipo").GetString());
        Assert.Equal("Taller Los Cedros", proceso.GetProperty("nombre").GetString());
        Assert.Equal(JsonValueKind.Null, proceso.GetProperty("organizacionNombre").ValueKind);
        Assert.DoesNotContain("Valderrama", ficha.GetRawText(), StringComparison.Ordinal);

        // SI EL TALLER SE RETIRA, LA FICHA DEJA DE ENLAZARLO (el tipo sigue: solo dice de qué clase es).
        using (var alcance = factory.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            (await db.Talleres.SingleAsync(t => t.Id == taller)).EstadoRegistro = "archivado";
            await db.SaveChangesAsync();
        }
        var sinProceso = await factory.CreateClient().GetFromJsonAsync<JsonElement>($"/api/v1/publico/agenda/{slug}");
        Assert.Equal(JsonValueKind.Null, sinProceso.GetProperty("proceso").ValueKind);
    }

    // ---------- La persona sin organización, desde Mi espacio ----------------------------------

    [Fact]
    public async Task Una_persona_sin_organizacion_anuncia_eventos_de_su_taller_su_espacio_y_su_red()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, personaId) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.persona");
        var taller = await ProcesoAsync(factory.Services, "taller", null, personaId);
        var espacio = await ProcesoAsync(factory.Services, "espacio", null, personaId);
        var red = await ProcesoAsync(factory.Services, "red", null, personaId);
        await ProcesoAsync(factory.Services, "red", null, personaId, estado: "borrador");

        var procesos = await cliente.GetFromJsonAsync<JsonElement>($"{RutaDeLaPersona}/procesos-que-enmarcan");
        Assert.Equal(["taller", "espacio", "red"], procesos.EnumerateArray().Select(p => p.GetProperty("tipo").GetString()!).ToArray());

        foreach (var (tipo, id) in new[] { ("taller", taller), ("espacio", espacio), ("red", red) })
        {
            var creado = await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaPersona, Evento(tipo, id, titulo: $"Evento de {tipo}"));
            Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
            Assert.Equal("en_revision", (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());
        }

        var lista = await cliente.GetFromJsonAsync<JsonElement>(RutaDeLaPersona);
        Assert.Equal(3, lista.GetArrayLength());

        // SU PROCEDENCIA ES EXTERNA, sin organización: la consola lo ve entre los externos.
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var procedencias = await db.ProcedenciasDeRegistro.AsNoTracking().Where(p => p.ModuloId == Modulos.Agenda).ToListAsync();
        Assert.Equal(3, procedencias.Count);
        Assert.All(procedencias, p =>
        {
            Assert.Equal(ProcedenciaDeRegistro.Externo, p.ContextoOrigen);
            Assert.Null(p.OrganizacionProcedenciaId);
            Assert.Equal(personaId, p.UsuarioCreadorId);
        });

        // LA COLA DE LA CONSOLA DICE QUIÉN RESPONDE cuando no hay organización.
        var consola = await CmsTestClient.LoginAsync(factory);
        var cola = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/revision-de-eventos");
        Assert.Equal(3, cola.GetArrayLength());
        Assert.All(cola.EnumerateArray(), e => Assert.Contains("Marta", e.GetProperty("responsableNombre").GetString(), StringComparison.Ordinal));
    }

    [Fact]
    public async Task Una_persona_solo_enmarca_lo_suyo_y_sin_organizacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, personaId) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.suyo");
        var (_, otraPersonaId) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.otra");
        var (clienteDeOrganizacion, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.suya@example.com");
        var deLaOtra = await ProcesoAsync(factory.Services, "taller", null, otraPersonaId);
        var deUnaOrganizacion = await ProcesoAsync(factory.Services, "espacio", organizacionId, null);
        var festival = await EventosDeOrganizacionTests.FestivalAsync(clienteDeOrganizacion, factory, organizacionId, publicado: true);

        // SIN NINGÚN PROCESO PROPIO, NO HAY QUÉ ANUNCIAR.
        Assert.Equal(0, (await cliente.GetFromJsonAsync<JsonElement>($"{RutaDeLaPersona}/procesos-que-enmarcan")).GetArrayLength());

        Assert.Equal(HttpStatusCode.BadRequest, (await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaPersona, Evento("taller", deLaOtra))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaPersona, Evento("espacio", deUnaOrganizacion))).StatusCode);
        // LOS FESTIVALES Y LOS MERCADOS NO TIENEN PERSONA RESPONSABLE: no entran en el alcance personal.
        Assert.Equal(HttpStatusCode.BadRequest, (await EnviarAsync(cliente, HttpMethod.Post, RutaDeLaPersona, Evento("festival", festival))).StatusCode);

        // Y LA ORGANIZACIÓN TAMPOCO ENMARCA EL TALLER DE UNA PERSONA.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await EnviarAsync(clienteDeOrganizacion, HttpMethod.Post, RutaDeLaOrganizacion(organizacionId), Evento("taller", deLaOtra))).StatusCode);
        _ = personaId;
    }

    [Fact]
    public async Task Los_eventos_de_una_persona_no_existen_para_otra_cuenta_ni_para_una_organizacion()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, personaId) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.dueña");
        var (otra, _) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.ajena");
        var (organizacion, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.curiosa@example.com");
        var taller = await ProcesoAsync(factory.Services, "taller", null, personaId);
        var (id, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaPersona, Evento("taller", taller));

        Assert.Equal(0, (await otra.GetFromJsonAsync<JsonElement>(RutaDeLaPersona)).GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await otra.GetAsync($"{RutaDeLaPersona}/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await otra.GetAsync($"{RutaDeLaPersona}/{id}/historial")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otra, HttpMethod.Put, $"{RutaDeLaPersona}/{id}", Evento("taller", taller))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otra, HttpMethod.Post, $"{RutaDeLaPersona}/{id}/retirar", new { motivo = "Ajeno" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await EnviarAsync(otra, HttpMethod.Post, $"{RutaDeLaPersona}/{id}/cancelar", new { motivo = "Ajeno" })).StatusCode);

        // UNA ORGANIZACIÓN NO LO VE POR SU RUTA.
        Assert.Equal(0, (await organizacion.GetFromJsonAsync<JsonElement>(RutaDeLaOrganizacion(organizacionId))).GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await organizacion.GetAsync($"{RutaDeLaOrganizacion(organizacionId)}/{id}")).StatusCode);

        // Y SIN SESIÓN, NADA.
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(RutaDeLaPersona)).StatusCode);
    }

    [Fact]
    public async Task La_persona_corrige_retira_y_cancela_con_la_misma_regla_y_se_avisa_a_si_misma()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, personaId) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.reglas");
        var taller = await ProcesoAsync(factory.Services, "taller", null, personaId);
        var (id, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaPersona, Evento("taller", taller));
        var (otroId, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaPersona, Evento("taller", taller, titulo: "Jornada de puertas abiertas"));
        var ruta = $"{RutaDeLaPersona}/{id}";

        // ERRATA AL INSTANTE.
        var errata = await EnviarAsync(cliente, HttpMethod.Put, ruta,
            Evento("taller", taller, descripcion: Descripcion.Replace("cuerda", "cuerda frotada", StringComparison.Ordinal)));
        Assert.True((await errata.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("esErrata").GetBoolean());
        Assert.Contains("Taller de afinación abierto", await TitulosPublicosAsync(factory.CreateClient()));

        // CAMBIO DE FONDO: vuelve a revisión.
        var fondo = await EnviarAsync(cliente, HttpMethod.Put, ruta, Evento("taller", taller, dias: 50));
        Assert.Equal("en_revision", (await fondo.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());
        Assert.DoesNotContain("Taller de afinación abierto", await TitulosPublicosAsync(factory.CreateClient()));

        // CANCELAR Y RETIRAR PIDEN MOTIVO.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await EnviarAsync(cliente, HttpMethod.Post, $"{RutaDeLaPersona}/{otroId}/cancelar", new { motivo = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await EnviarAsync(cliente, HttpMethod.Post, $"{RutaDeLaPersona}/{otroId}/cancelar", new { motivo = "Enfermó quien lo dictaba." })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await EnviarAsync(cliente, HttpMethod.Post, $"{RutaDeLaPersona}/{otroId}/retirar", new { motivo = "No se hará más." })).StatusCode);
        Assert.DoesNotContain("Jornada de puertas abiertas", await TitulosPublicosAsync(factory.CreateClient()));

        // EL AVISO LLEGA A LA PERSONA RESPONSABLE: no hay organización a la que avisar.
        using var alcance = factory.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var avisos = await db.Notifications.AsNoTracking()
            .Where(n => n.ModuloId == Modulos.Agenda && n.RecipientUserId == personaId).ToListAsync();
        Assert.Contains(avisos, n => n.EventType == "EventoCancelado");
        Assert.Contains(avisos, n => n.EventType == "EventoRetirado");

        // EL HISTORIAL DE ESTADOS LO LEE ELLA, con su nombre en lo que hizo.
        var historial = await cliente.GetFromJsonAsync<JsonElement>($"{RutaDeLaPersona}/{otroId}/historial");
        Assert.Contains(historial.EnumerateArray(), h => h.GetProperty("accion").GetString() == "EventoRetiradoPorOrganizacion");
        Assert.Contains(historial.EnumerateArray(), h => (h.GetProperty("actor").GetString() ?? string.Empty).Contains("Marta", StringComparison.Ordinal));
    }

    [Fact]
    public async Task El_historial_unico_de_ediciones_tambien_sirve_a_la_persona_y_solo_a_ella()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, personaId) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.hist");
        var (otra, _) = await PersonaAsync(factory.CreateClient(), factory.Services, "lut.hist.ajena");
        var taller = await ProcesoAsync(factory.Services, "taller", null, personaId);
        var (id, _) = await CrearYPublicarAsync(factory, cliente, RutaDeLaPersona, Evento("taller", taller));
        await EnviarAsync(cliente, HttpMethod.Put, $"{RutaDeLaPersona}/{id}",
            Evento("taller", taller, descripcion: Descripcion.Replace("cuerda", "cuerda frotada", StringComparison.Ordinal)));

        var suyo = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/mis-registros/historial/agenda/{id}");
        Assert.True(suyo.GetProperty("entradas").GetArrayLength() > 0);

        // OTRA CUENTA RECIBE LO MISMO QUE UN REGISTRO SIN HISTORIA: no se puede usar para averiguar qué existe.
        var ajeno = await otra.GetFromJsonAsync<JsonElement>($"/api/v1/externo/mis-registros/historial/agenda/{id}");
        Assert.Equal(0, ajeno.GetProperty("entradas").GetArrayLength());

        // Y SOLO LOS MÓDULOS QUE ELLA RESPONDE.
        Assert.Equal(HttpStatusCode.NotFound, (await cliente.GetAsync($"/api/v1/externo/mis-registros/historial/festivales/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync($"/api/v1/externo/mis-registros/historial/agenda/{id}")).StatusCode);

        // LA ORGANIZACIÓN QUE ADMINISTRA EL TALLER LEE LA SUYA POR SU PUERTA, también para los eventos del taller.
        var (organizacion, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "lut.historia.org@example.com");
        var tallerDeOrganizacion = await ProcesoAsync(factory.Services, "taller", organizacionId, null);
        var (eventoOrganizacion, _) = await CrearYPublicarAsync(factory, organizacion, RutaDeLaOrganizacion(organizacionId), Evento("taller", tallerDeOrganizacion));
        var deLaOrganizacion = await organizacion.GetFromJsonAsync<JsonElement>(
            $"/api/v1/externo/organizaciones/{organizacionId}/historial/agenda/{eventoOrganizacion}");
        Assert.True(deLaOrganizacion.GetProperty("entradas").GetArrayLength() > 0);
    }
}
