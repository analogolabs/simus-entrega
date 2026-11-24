using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Los eventos que una organización anuncia sobre sus propios procesos.
///
/// <para>
/// LO QUE ESTAS PRUEBAS IMPIDEN. Que la agenda pública se convierta en un tablón abierto donde
/// cualquiera con cuenta escribe; que un evento cuelgue de un proceso ajeno o de uno que todavía no
/// está publicado; y que quien escribe el evento decida también si se publica.
/// </para>
/// </summary>
public sealed class EventosDeOrganizacionTests
{
    private const string Clave = "ClaveExterna123";

    internal static object EventoNuevo(int festivalId, string titulo = "Concierto de clausura") => new
    {
        titulo,
        descripcion = "Concierto abierto al público en el marco del festival.",
        fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
        modalidad = "presencial",
        lugar = "Plaza principal",
        festivalId,
    };

    [Fact]
    public async Task Sin_procesos_publicados_no_hay_nada_que_enmarcar()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "sin.procesos@example.com");

        var procesos = await (await client.GetAsync($"/api/v1/externo/organizaciones/{organizacionId}/procesos-que-enmarcan"))
            .Content.ReadFromJsonAsync<JsonElement>();

        // SI ESTA LISTA VIENE VACIA, LA PANTALLA NO OFRECE EL FORMULARIO: es más honesto que dejar
        // escribir un evento entero para rechazarlo al guardar por algo que se sabía al principio.
        Assert.Equal(0, procesos.GetArrayLength());
    }

    [Fact]
    public async Task Un_festival_en_borrador_todavia_no_puede_enmarcar_eventos()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "festival.borrador@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: false);

        var procesos = await (await client.GetAsync($"/api/v1/externo/organizaciones/{organizacionId}/procesos-que-enmarcan"))
            .Content.ReadFromJsonAsync<JsonElement>();

        // UN FESTIVAL SIN PUBLICAR NO EXISTE PARA EL PUBLICO: colgarle un evento lo anunciaría
        // antes que al propio Festival del que habla.
        Assert.Equal(0, procesos.GetArrayLength());

        var respuesta = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId));
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task Con_un_festival_publicado_la_organizacion_puede_anunciar_su_evento()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "con.festival@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);

        var procesos = await (await client.GetAsync($"/api/v1/externo/organizaciones/{organizacionId}/procesos-que-enmarcan"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, procesos.GetArrayLength());
        Assert.Equal("festival", procesos[0].GetProperty("tipo").GetString());

        var creado = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId));
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);

        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        // NACE EN REVISION, SIEMPRE: quien lo escribe no decide si se publica.
        Assert.Equal("en_revision", cuerpo.GetProperty("estado").GetString());
    }

    /// <summary>
    /// Un evento con territorio se guarda, y su nivel de cobertura se deriva solo.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>EL DEFECTO QUE TRAJO ESTA PRUEBA.</b> Este canal escribía el departamento y el municipio y
    /// <b>nunca escribía <c>NivelCobertura</c></b>, que nace en «nacional».
    /// <c>CK_EventosAgenda_NivelCobertura</c> exige que en nacional los dos códigos sean nulos, así
    /// que en cuanto alguien elegía un departamento —justo lo que el formulario ofrece— el INSERT
    /// chocaba con el CHECK y la pantalla decía «no fue posible anunciar el evento. Revisa los
    /// campos», sobre unos campos que estaban bien. Lo reportó la dirección de producto el 15 de
    /// septiembre de 2026.
    /// </para>
    /// <para>
    /// <b>LA REGLA YA EXISTIA Y LA CONSOLA LA APLICABA.</b> Dos canales que escriben la misma tabla
    /// y solo uno deriva la columna: la definición de «dos copias que divergen».
    /// </para>
    /// </remarks>
    [Theory]
    [InlineData("05", null, "departamental")]
    [InlineData("05", "05001", "municipal")]
    [InlineData(null, null, "nacional")]
    public async Task El_nivel_de_cobertura_se_deriva_del_territorio(
        string? departamento, string? municipio, string esperado)
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, $"territorio.{esperado}@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);

        var creado = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", new
        {
            titulo = $"Concierto {esperado}",
            descripcion = "Concierto abierto al público en el marco del festival.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Plaza principal",
            codigoDepartamento = departamento,
            codigoMunicipio = municipio,
            festivalId,
        });

        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);

        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        var id = int.Parse(cuerpo.GetProperty("id").GetString()!, System.Globalization.CultureInfo.InvariantCulture);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var evento = await db.EventosAgenda.AsNoTracking().FirstAsync(e => e.Id == id);
        Assert.Equal(esperado, evento.NivelCobertura);
    }

    [Fact]
    public async Task Un_municipio_sin_su_departamento_se_rechaza_con_su_motivo()
    {
        // NO ES UN TERRITORIO, y el formulario no deja llegar ahí; pero la ruta está abierta a
        // cualquiera con sesión externa, y sin esto el CHECK lo rechazaría como un 500 sin
        // explicación en vez de como un 400 sobre el campo.
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "municipio.huerfano@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);

        var respuesta = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", new
        {
            titulo = "Concierto sin departamento",
            descripcion = "Concierto abierto al público en el marco del festival.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Plaza principal",
            codigoMunicipio = "05001",
            festivalId,
        });
        var cuerpo = await respuesta.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        Assert.Contains("departamento", cuerpo, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Un_evento_sin_proceso_no_se_puede_anunciar()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "sin.proceso@example.com");
        await FestivalAsync(client, factory, organizacionId, publicado: true);

        var respuesta = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", new
        {
            titulo = "Evento suelto",
            descripcion = "Un evento que no pertenece a ningún proceso.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Plaza principal",
            festivalId = 0,
        });

        // ES LA REGLA ENTERA: sin proceso, la agenda pública sería un tablón abierto.
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task No_se_puede_colgar_un_evento_de_un_proceso_ajeno()
    {
        await using var factory = new TestWebApplicationFactory();
        var (dueña, organizacionPropia) = await OrganizacionAsync(factory, "dueña@example.com");
        var festivalAjeno = await FestivalAsync(dueña, factory, organizacionPropia, publicado: true);

        var (otra, organizacionOtra) = await OrganizacionAsync(factory, "otra@example.com");

        var respuesta = await EnviarAsync(otra, $"/api/v1/externo/organizaciones/{organizacionOtra}/eventos", EventoNuevo(festivalAjeno));

        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task El_evento_anunciado_llega_a_la_bandeja_institucional_con_su_procedencia()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "llega.bandeja@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);

        await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos",
            EventoNuevo(festivalId, "Evento que espera revisión"));

        var consola = await CmsTestClient.LoginAsync(factory);
        var pendientes = await (await consola.GetAsync("/api/v1/institucional/agenda?estado=en_revision"))
            .Content.ReadFromJsonAsync<JsonElement>();

        var suyo = pendientes.GetProperty("items").EnumerateArray()
            .First(x => x.GetProperty("titulo").GetString() == "Evento que espera revisión");

        // NO ES UN SEGUNDO MODELO DE AGENDA: escribe la misma fila y aparece en la misma bandeja
        // donde la consola revisa todo lo demás.
        Assert.Equal("externo", suyo.GetProperty("procedencia").GetProperty("contextoOrigen").GetString());
        Assert.Equal(festivalId, suyo.GetProperty("festivalId").GetInt32());
    }

    [Fact]
    public async Task Dos_eventos_con_el_mismo_titulo_no_chocan()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "mismo.titulo@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);

        var primero = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId));
        var segundo = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId));

        // «Concierto de clausura» OCURRE TODOS LOS AÑOS. El índice único de la agenda rechazaría el
        // segundo con un error ilegible; se numera en vez de pedir un título distinto.
        Assert.Equal(HttpStatusCode.Created, primero.StatusCode);
        Assert.Equal(HttpStatusCode.Created, segundo.StatusCode);
    }

    [Fact]
    public async Task La_organizacion_ve_sus_eventos_con_el_proceso_que_los_enmarca()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "ve.sus.eventos@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);

        await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId));

        var eventos = await (await client.GetAsync($"/api/v1/externo/organizaciones/{organizacionId}/eventos"))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(1, eventos.GetArrayLength());
        Assert.Equal("En revisión", eventos[0].GetProperty("estadoEtiqueta").GetString());
        Assert.False(string.IsNullOrWhiteSpace(eventos[0].GetProperty("procesoNombre").GetString()));
    }

    // ----------: borrador, Mercado, historial y edición ---------------------------------

    [Fact]
    public async Task Un_borrador_solo_lo_ve_su_organizacion_y_luego_se_envia()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "borrador.evento@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos";

        var creado = await EnviarAsync(client, ruta, new
        {
            titulo = "Ensayo abierto en borrador",
            descripcion = "Aún sin enviar.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Plaza principal",
            festivalId,
            borrador = true,
        });
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("borrador", cuerpo.GetProperty("estado").GetString());
        var id = cuerpo.GetProperty("id").GetString();

        var propios = await client.GetFromJsonAsync<JsonElement>(ruta);
        Assert.Equal("Borrador", propios[0].GetProperty("estadoEtiqueta").GetString());

        // NI LA COLA NI LA AGENDA DE LA CONSOLA LO VEN TODAVIA.
        var consola = await CmsTestClient.LoginAsync(factory);
        var cola = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/revision-de-eventos");
        Assert.DoesNotContain("Ensayo abierto en borrador", cola.EnumerateArray().Select(e => e.GetProperty("titulo").GetString()));
        var agenda = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/agenda?estado=borrador");
        Assert.DoesNotContain("Ensayo abierto en borrador",
            agenda.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("titulo").GetString()));

        var enviado = await EnviarAsync(client, $"{ruta}/{id}/enviar", new { });
        Assert.Equal(HttpStatusCode.OK, enviado.StatusCode);

        cola = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/revision-de-eventos");
        Assert.Contains("Ensayo abierto en borrador", cola.EnumerateArray().Select(e => e.GetProperty("titulo").GetString()));

        var historial = await HistorialAsync(factory, id!);
        Assert.Equal(["borrador", "en_revision"], historial.Select(h => h.EstadoNuevo).ToArray());
        Assert.Equal("borrador", historial[1].EstadoAnterior);
        Assert.All(historial, h => Assert.NotNull(h.UsuarioId));
    }

    [Fact]
    public async Task Un_evento_se_puede_enmarcar_en_un_mercado_publicado()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "con.mercado@example.com");
        var mercadoId = await MercadoAsync(factory, organizacionId, "publicado");
        var mercadoEnBorrador = await MercadoAsync(factory, organizacionId, "borrador");

        var procesos = await client.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacionId}/procesos-que-enmarcan");
        Assert.Equal(1, procesos.GetArrayLength());
        Assert.Equal("mercado", procesos[0].GetProperty("tipo").GetString());

        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos";
        var rechazado = await EnviarAsync(client, ruta, new
        {
            titulo = "Rueda de negocios",
            descripcion = "En un mercado sin publicar.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Centro de convenciones",
            mercadoId = mercadoEnBorrador,
        });
        Assert.Equal(HttpStatusCode.BadRequest, rechazado.StatusCode);

        var creado = await EnviarAsync(client, ruta, new
        {
            titulo = "Rueda de negocios",
            descripcion = "Encuentro de programadores.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Centro de convenciones",
            mercadoId,
        });
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);

        var propios = await client.GetFromJsonAsync<JsonElement>(ruta);
        Assert.Equal("mercado", propios[0].GetProperty("procesoTipo").GetString());

        var consola = await CmsTestClient.LoginAsync(factory);
        var cola = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/revision-de-eventos");
        var suyo = cola.EnumerateArray().First(e => e.GetProperty("titulo").GetString() == "Rueda de negocios");
        Assert.Equal(mercadoId, suyo.GetProperty("mercadoId").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(suyo.GetProperty("organizacionNombre").GetString()));
    }

    [Fact]
    public async Task Festival_y_mercado_a_la_vez_no_es_un_proceso()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "dos.procesos@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var mercadoId = await MercadoAsync(factory, organizacionId, "publicado");

        var respuesta = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", new
        {
            titulo = "Evento doble",
            descripcion = "Dos procesos.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            lugar = "Plaza",
            festivalId,
            mercadoId,
        });
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Fact]
    public async Task Un_cambio_de_fondo_en_un_evento_publicado_lo_devuelve_a_revision_y_queda_en_el_historial()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "editar.publicado@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos";
        var creado = await EnviarAsync(client, ruta, EventoNuevo(festivalId, "Concierto que cambia"));
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        var consola = await CmsTestClient.LoginAsync(factory);
        (await consola.PostAsJsonAsync($"/api/v1/institucional/revision-de-eventos/{id}/decision",
            new DecisionSobreEvento { Decision = "publicar" })).EnsureSuccessStatusCode();

        // QUIEN EDITA NO PUEDE DEVOLVERLO A BORRADOR NI DEJARLO PUBLICADO: la hora es de fondo, no una
        // errata (D3-12; las erratas se prueban en EventosPublicadosTests).
        var editado = await EnviarAsync(client, $"{ruta}/{id}", new
        {
            titulo = "Concierto que cambia de hora",
            descripcion = "Concierto abierto al público en el marco del festival.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            horaInicio = "19:00:00",
            modalidad = "presencial",
            lugar = "Plaza principal",
            festivalId,
            borrador = true,
        }, HttpMethod.Put);
        Assert.Equal(HttpStatusCode.OK, editado.StatusCode);
        Assert.Equal("en_revision", (await editado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("estado").GetString());

        var detalle = await client.GetFromJsonAsync<JsonElement>($"{ruta}/{id}");
        Assert.Equal("Concierto que cambia de hora", detalle.GetProperty("titulo").GetString());

        var historial = await HistorialAsync(factory, id!);
        Assert.Equal(["en_revision", "publicado", "en_revision"], historial.Select(h => h.EstadoNuevo).ToArray());
        Assert.Equal("publicado", historial[2].EstadoAnterior);
    }

    [Fact]
    public async Task Devolver_deja_el_motivo_en_el_historial_y_la_organizacion_lo_lee()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "devuelto.motivo@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos";
        var creado = await EnviarAsync(client, ruta, EventoNuevo(festivalId, "Evento devuelto"));
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        var consola = await CmsTestClient.LoginAsync(factory);
        (await consola.PostAsJsonAsync($"/api/v1/institucional/revision-de-eventos/{id}/decision",
            new DecisionSobreEvento { Decision = "devolver", Motivo = "Falta la hora." })).EnsureSuccessStatusCode();

        var historial = await HistorialAsync(factory, id!);
        var ultima = historial[^1];
        Assert.Equal("borrador", ultima.EstadoNuevo);
        Assert.Equal("en_revision", ultima.EstadoAnterior);
        Assert.Equal("Falta la hora.", ultima.MotivoRechazo);

        var propios = await client.GetFromJsonAsync<JsonElement>(ruta);
        Assert.Equal("Falta la hora.", propios[0].GetProperty("ultimoMotivo").GetString());
    }

    [Fact]
    public async Task Decidir_desde_Agenda_y_eventos_avisa_a_la_organizacion_y_ella_lee_el_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "decide.agenda@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos";
        var consola = await CmsTestClient.LoginAsync(factory);

        async Task<string> NuevoAsync(string titulo)
        {
            var creado = await EnviarAsync(client, ruta, EventoNuevo(festivalId, titulo));
            return (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
        }

        Task<HttpResponseMessage> CambiarAsync(string id, string estado, string? motivo = null) =>
            consola.PostAsJsonAsync($"/api/v1/institucional/agenda/{id}/estado", new { estado, motivo });

        // RECHAZAR DESDE EL PANEL DE LA AGENDA: antes la organización veía «Rechazado» sin aviso ni motivo.
        var rechazado = await NuevoAsync("Evento que se rechaza");
        Assert.Equal(HttpStatusCode.OK, (await CambiarAsync(rechazado, "rechazado", "No corresponde al Festival indicado.")).StatusCode);
        // DEVOLVERLO DESDE EL MISMO PANEL: el motivo se anota con otro nombre que el de la bandeja y no se leía.
        var devuelto = await NuevoAsync("Evento que se devuelve");
        Assert.Equal(HttpStatusCode.OK, (await CambiarAsync(devuelto, "borrador", "Falta la hora de inicio.")).StatusCode);
        // PUBLICARLO Y LUEGO RETIRARLO.
        var retirado = await NuevoAsync("Evento que se retira");
        Assert.Equal(HttpStatusCode.OK, (await CambiarAsync(retirado, "publicado")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await CambiarAsync(retirado, "archivado", "Se canceló el concierto.")).StatusCode);

        var propios = await client.GetFromJsonAsync<JsonElement>(ruta);
        string? MotivoDe(string titulo) => propios.EnumerateArray().Single(x => x.GetProperty("titulo").GetString() == titulo).GetProperty("ultimoMotivo").GetString();
        Assert.Equal("No corresponde al Festival indicado.", MotivoDe("Evento que se rechaza"));
        Assert.Equal("Falta la hora de inicio.", MotivoDe("Evento que se devuelve"));
        Assert.Null(MotivoDe("Evento que se retira"));

        var buzon = await client.GetFromJsonAsync<JsonElement>("/api/v1/notificaciones?ambito=externo");
        var avisos = buzon.GetProperty("items").EnumerateArray()
            .Select(x => (Titulo: x.GetProperty("title").GetString()!, Cuerpo: x.GetProperty("body").GetString()!)).ToList();
        Assert.Contains(avisos, a => a.Titulo == "Tu evento fue rechazado" && a.Cuerpo.Contains("No corresponde al Festival indicado.", StringComparison.Ordinal));
        Assert.Contains(avisos, a => a.Titulo == "Tu evento volvió para corregir" && a.Cuerpo.Contains("Falta la hora de inicio.", StringComparison.Ordinal));
        Assert.Contains(avisos, a => a.Titulo == "Tu evento está publicado" && a.Cuerpo.Contains("Evento que se retira", StringComparison.Ordinal));
        Assert.Contains(avisos, a => a.Titulo == "Tu evento salió de la agenda" && a.Cuerpo.Contains("Se canceló el concierto.", StringComparison.Ordinal));
    }

    [Fact]
    public async Task El_historial_se_lee_en_la_consola_con_nombres_y_en_la_organizacion_firmado_por_el_Programa()
    {
        //: estado, fecha, actor y motivo. La consola nombra a quien decidió; la organización
        // lee «Equipo del Programa» y el nombre de quien envió, que es de los suyos.
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "historial.visible@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos";
        var creado = await EnviarAsync(client, ruta, EventoNuevo(festivalId, "Evento con historial"));
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        var consola = await CmsTestClient.LoginAsync(factory);
        (await consola.PostAsJsonAsync($"/api/v1/institucional/revision-de-eventos/{id}/decision",
            new DecisionSobreEvento { Decision = "devolver", Motivo = "Falta la hora." })).EnsureSuccessStatusCode();

        var enConsola = await consola.GetFromJsonAsync<List<EntradaDeHistorialDeEstadosDto>>(
            $"/api/v1/institucional/revision-de-eventos/{id}/historial");
        Assert.NotNull(enConsola);
        var devolucion = enConsola![0];
        Assert.Equal("EventoDevuelto", devolucion.Accion);
        Assert.Equal("Devuelto para corregir", devolucion.AccionEtiqueta);
        Assert.Equal("en_revision", devolucion.EstadoAnterior);
        Assert.Equal("borrador", devolucion.EstadoNuevo);
        Assert.Equal("Falta la hora.", devolucion.Motivo);
        Assert.False(string.IsNullOrWhiteSpace(devolucion.Actor));
        Assert.NotEqual("Equipo del PNMC", devolucion.Actor);

        var enPanel = await client.GetFromJsonAsync<List<EntradaDeHistorialDeEstadosDto>>($"{ruta}/{id}/historial");
        Assert.NotNull(enPanel);
        Assert.Equal(2, enPanel!.Count);
        Assert.Equal("Equipo del PNMC", enPanel[0].Actor);
        Assert.Equal("Falta la hora.", enPanel[0].Motivo);
        Assert.NotEqual("Equipo del PNMC", enPanel[1].Actor);
        Assert.Equal("en_revision", enPanel[1].EstadoNuevo);
    }

    [Fact]
    public async Task El_historial_de_un_evento_ajeno_no_se_lee()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "historial.propio@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var creado = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId));
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        var (otro, otraOrganizacion) = await OrganizacionAsync(factory, "historial.ajeno@example.com");
        var ajeno = await otro.GetAsync($"/api/v1/externo/organizaciones/{otraOrganizacion}/eventos/{id}/historial");
        Assert.Equal(HttpStatusCode.NotFound, ajeno.StatusCode);
        var suplantando = await otro.GetAsync($"/api/v1/externo/organizaciones/{organizacionId}/eventos/{id}/historial");
        Assert.Equal(HttpStatusCode.NotFound, suplantando.StatusCode);
    }

    [Fact]
    public async Task Un_evento_ajeno_no_se_puede_editar()
    {
        await using var factory = new TestWebApplicationFactory();
        var (dueña, organizacionPropia) = await OrganizacionAsync(factory, "dueña.edicion@example.com");
        var festivalId = await FestivalAsync(dueña, factory, organizacionPropia, publicado: true);
        var creado = await EnviarAsync(dueña, $"/api/v1/externo/organizaciones/{organizacionPropia}/eventos", EventoNuevo(festivalId));
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        var (otra, organizacionOtra) = await OrganizacionAsync(factory, "otra.edicion@example.com");
        var respuesta = await EnviarAsync(otra, $"/api/v1/externo/organizaciones/{organizacionOtra}/eventos/{id}",
            EventoNuevo(festivalId), HttpMethod.Put);

        Assert.Equal(HttpStatusCode.NotFound, respuesta.StatusCode);
    }

    private static async Task<List<SIMUS.Domain.Entities.HistorialRevisionRegistroRow>> HistorialAsync(
        TestWebApplicationFactory factory, string id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        return await db.HistorialesRevisionRegistros.AsNoTracking()
            .Where(h => h.ModuloId == "agenda" && h.RegistroId == id)
            .OrderBy(h => h.Id)
            .ToListAsync();
    }

    /// <summary>Un Mercado de la organización, escrito contra la base: lo que se mide es el evento.</summary>
    private static async Task<int> MercadoAsync(TestWebApplicationFactory factory, int organizacionId, string estado)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var mercado = new SIMUS.Domain.Entities.MercadoRow
        {
            Nombre = $"Mercado {estado} de {organizacionId}",
            NivelCobertura = "nacional",
            OrganizacionPrincipalId = organizacionId,
            EstadoRegistro = estado,
            FechaCreacion = DateTime.UtcNow,
        };
        db.Mercados.Add(mercado);
        await db.SaveChangesAsync();
        return mercado.Id;
    }

    // ---------- Andamio ----------------------------------------------------------

    /// <summary>
    /// Lo que una organización envía llega a la bandeja del Programa y se decide allí.
    /// </summary>
    /// <remarks>
    /// <b>EL DEFECTO QUE TRAJO ESTA PRUEBA.</b> El circuito ponía el evento «en revisión» y no había
    /// ninguna cola que lo listara: la única forma de encontrarlo era abrir Agenda y filtrar por
    /// estado. El criterio es este: «al enviar evento a
    /// revisión debería aparecer en la bandeja de Solicitudes y revisiones».
    /// </remarks>
    [Fact]
    public async Task El_evento_enviado_aparece_en_la_cola_del_Programa()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "cola.programa@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        (await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId, "Taller en la cola")))
            .EnsureSuccessStatusCode();

        var consola = await CmsTestClient.LoginAsync(factory);
        var cola = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/revision-de-eventos");

        var titulos = cola.EnumerateArray().Select(e => e.GetProperty("titulo").GetString()).ToList();
        Assert.Contains("Taller en la cola", titulos);
    }

    [Fact]
    public async Task Publicar_un_evento_al_que_le_falta_el_lugar_se_rechaza_con_su_motivo()
    {
        // `CK_EventosAgenda_DatosDeModalidad` SOLO APRIETA AL PUBLICAR: un presencial necesita lugar.
        // Sin comprobarlo antes, publicar saldría como un 500 sin explicación —el mismo defecto que
        // se corrigió ese día en el alta externa— en vez de decir qué falta.
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "sin.lugar@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);

        var creado = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", new
        {
            titulo = "Evento sin lugar",
            descripcion = "Un evento presencial al que le falta el lugar.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow),
            modalidad = "presencial",
            festivalId,
        });
        creado.EnsureSuccessStatusCode();
        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        var id = cuerpo.GetProperty("id").GetString();

        var consola = await CmsTestClient.LoginAsync(factory);
        var decision = await consola.PostAsJsonAsync($"/api/v1/institucional/revision-de-eventos/{id}/decision",
            new DecisionSobreEvento { Decision = "publicar" });
        var respuesta = await decision.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, decision.StatusCode);
        Assert.Contains("lugar", respuesta, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Devolver_sin_decir_que_corregir_no_es_una_decision()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "devolver.sin.motivo@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var creado = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId, "Evento por devolver"));
        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        var id = cuerpo.GetProperty("id").GetString();

        var consola = await CmsTestClient.LoginAsync(factory);
        var sinMotivo = await consola.PostAsJsonAsync($"/api/v1/institucional/revision-de-eventos/{id}/decision",
            new DecisionSobreEvento { Decision = "devolver" });

        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
    }

    [Fact]
    public async Task El_circuito_del_evento_se_cierra_publicandolo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (client, organizacionId) = await OrganizacionAsync(factory, "circuito.evento@example.com");
        var festivalId = await FestivalAsync(client, factory, organizacionId, publicado: true);
        var creado = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", EventoNuevo(festivalId, "Evento que se publica"));
        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        var id = cuerpo.GetProperty("id").GetString();

        var consola = await CmsTestClient.LoginAsync(factory);
        var decision = await consola.PostAsJsonAsync($"/api/v1/institucional/revision-de-eventos/{id}/decision",
            new DecisionSobreEvento { Decision = "publicar" });
        decision.EnsureSuccessStatusCode();

        // Y SALE DE LA COLA: una bandeja que conserva lo ya decidido deja de ser una bandeja.
        var cola = await consola.GetFromJsonAsync<JsonElement>("/api/v1/institucional/revision-de-eventos");
        Assert.DoesNotContain("Evento que se publica",
            cola.EnumerateArray().Select(e => e.GetProperty("titulo").GetString()).ToList());
    }

    internal static async Task<(HttpClient Cliente, int OrganizacionId)> OrganizacionAsync(
        TestWebApplicationFactory factory, string correo)
    {
        var client = factory.CreateClient();
        (await client.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización de " + correo,
            FullName = "Responsable de la organización",
            NumeroDocumento = "1020304052",
            HeadquartersDepartmentCode = "05",
            HeadquartersMunicipalityCode = "05001",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();

        (await client.PostAsJsonAsync("/api/v1/externo/auth/login",
            new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var mias = await client.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/mis");
        var id = int.Parse(mias[0].GetProperty("id").GetString()!, System.Globalization.CultureInfo.InvariantCulture);
        return (client, id);
    }

    /// <summary>
    /// Un Festival de la organización, publicado o no.
    /// </summary>
    /// <remarks>
    /// PUBLICAR SE HACE CONTRA LA BASE Y NO POR EL CIRCUITO porque lo que esta prueba mide es la
    /// regla del evento, no el circuito de revisión del Festival, que tiene sus propias pruebas.
    /// </remarks>
    internal static async Task<int> FestivalAsync(
        HttpClient client, TestWebApplicationFactory factory, int organizacionId, bool publicado)
    {
        var creado = await EnviarAsync(client, $"/api/v1/externo/organizaciones/{organizacionId}/festivales", new
        {
            nombre = "Festival de la organización " + organizacionId,
            nivelCobertura = "nacional",
            // LA SEDE PRINCIPAL es obligatoria aunque la cobertura sea nacional (decisión 119).
            sedeCodigoDepartamento = "05",
            sedeCodigoMunicipio = "05001",
            practicasMusicalesIds = Array.Empty<int>(),
            territoriosSonorosIds = Array.Empty<int>(),
        });
        creado.EnsureSuccessStatusCode();

        var cuerpo = await creado.Content.ReadFromJsonAsync<JsonElement>();
        var id = int.Parse(cuerpo.GetProperty("id").GetString()!, System.Globalization.CultureInfo.InvariantCulture);

        if (publicado)
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var festival = await db.FestivalRecords.SingleAsync(x => x.Id == id);
            festival.StatusCode = "publicado";
            await db.SaveChangesAsync();
        }

        return id;
    }

    internal static async Task<HttpResponseMessage> EnviarAsync(HttpClient client, string ruta, object cuerpo, HttpMethod? metodo = null)
    {
        var testigo = await client.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(metodo ?? HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await client.SendAsync(mensaje);
    }
}
