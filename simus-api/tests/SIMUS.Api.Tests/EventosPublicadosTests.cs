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
/// Un evento ya publicado: se corrige, se retira o se cancela (D3-12, D3-13 y D3-14 de la auditoría,
/// docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 24).
/// </summary>
/// <remarks>
/// <para>
/// <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Que cambiar la fecha de un concierto ya aprobado se cuele como
/// «errata» y quede en la agenda sin que nadie lo vea; que una errata de ortografía saque de la agenda
/// un evento que el Programa ya aprobó; que retirar o cancelar un evento ajeno o sin motivo sea
/// posible; y que un evento retirado o cancelado siga apareciendo un minuto más porque la lista pública
/// está en caché.
/// </para>
/// <para>
/// Esto es el carril rápido (SQLite). Lo que escribe historial, registro de cambios, bitácora y avisos
/// se prueba además contra SQL Server en <see cref="EventosPublicadosSqlServerTests"/>.
/// </para>
/// </remarks>
public sealed class EventosPublicadosTests
{
    private const string Descripcion = "Concierto abierto al público en el marco del festival de música tradicional.";

    private static string Ruta(int organizacionId) => $"/api/v1/externo/organizaciones/{organizacionId}/eventos";

    internal static object Evento(
        int festivalId,
        string titulo = "Concierto de clausura del festival",
        string descripcion = Descripcion,
        string lugar = "Plaza principal",
        int dias = 30,
        string? departamento = null,
        string? municipio = null) => new
        {
            titulo,
            descripcion,
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(dias),
            modalidad = "presencial",
            lugar,
            codigoDepartamento = departamento,
            codigoMunicipio = municipio,
            festivalId,
        };

    /// <summary>Una organización con un Festival publicado y un evento suyo ya publicado.</summary>
    internal static async Task<(HttpClient Cliente, int OrganizacionId, int FestivalId, string EventoId, string Slug)> PublicadoAsync(
        TestWebApplicationFactory factory, string correo)
    {
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, correo);
        var festivalId = await EventosDeOrganizacionTests.FestivalAsync(cliente, factory, organizacionId, publicado: true);

        var creado = await EventosDeOrganizacionTests.EnviarAsync(cliente, Ruta(organizacionId), Evento(festivalId));
        creado.EnsureSuccessStatusCode();
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

        // PUBLICAR SE HACE CONTRA LA BASE: lo que se mide aquí es lo que pasa DESPUÉS de publicar, no
        // el circuito de revisión, que tiene sus propias pruebas.
        string slug;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.EventosAgenda.SingleAsync(e => e.Id == long.Parse(id, CultureInfo.InvariantCulture));
            fila.Estado = "publicado";
            await db.SaveChangesAsync();
            slug = fila.Slug;
        }

        return (cliente, organizacionId, festivalId, id, slug);
    }

    private static async Task<List<string?>> TitulosPublicosAsync(HttpClient cliente)
    {
        var pagina = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/publico/agenda?cuando=todos");
        return pagina.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("titulo").GetString()).ToList();
    }

    private static async Task<EventoAgendaRow> FilaAsync(TestWebApplicationFactory factory, string id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        return await db.EventosAgenda.AsNoTracking().SingleAsync(e => e.Id == long.Parse(id, CultureInfo.InvariantCulture));
    }

    // ---------- D3-12: errata al instante, cambio de fondo a revisión --------------------------

    [Fact]
    public async Task Una_errata_en_un_evento_publicado_se_corrige_al_instante_y_sigue_en_la_agenda()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, festivalId, id, _) = await PublicadoAsync(factory, "errata.evento@example.com");

        var respuesta = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}",
            Evento(festivalId, descripcion: "Concierto abierto al público en el marco del festival de música tradicional colombiana."),
            HttpMethod.Put);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("publicado", cuerpo.GetProperty("estado").GetString());
        Assert.True(cuerpo.GetProperty("esErrata").GetBoolean());
        Assert.Equal(0, cuerpo.GetProperty("cambiosDeFondo").GetArrayLength());

        // SIGUE EN LA AGENDA PÚBLICA, sin pasar por revisión.
        Assert.Contains("Concierto de clausura del festival", await TitulosPublicosAsync(factory.CreateClient()));
        Assert.Equal("publicado", (await FilaAsync(factory, id)).Estado);
    }

    [Theory]
    [InlineData("tildes y mayúsculas del título", "Concierto de Clausura del Festival.", "Plaza principal", true)]
    [InlineData("el lugar con otras mayúsculas", "Concierto de clausura del festival", "PLAZA  principal", true)]
    [InlineData("otro lugar", "Concierto de clausura del festival", "Parque de la Música", false)]
    public async Task El_lugar_y_el_titulo_se_comparan_sin_tildes_ni_mayusculas(
        string caso, string titulo, string lugar, bool esErrata)
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, festivalId, id, _) = await PublicadoAsync(factory, $"comparar.{Math.Abs(caso.GetHashCode()):x}@example.com");

        var respuesta = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}", Evento(festivalId, titulo: titulo, lugar: lugar), HttpMethod.Put);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(esErrata, cuerpo.GetProperty("esErrata").GetBoolean());
        Assert.Equal(esErrata ? "publicado" : "en_revision", cuerpo.GetProperty("estado").GetString());
    }

    [Fact]
    public async Task Un_cambio_de_fecha_vuelve_a_revision_y_sale_de_la_agenda_hasta_que_se_apruebe()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, festivalId, id, _) = await PublicadoAsync(factory, "fondo.fecha@example.com");

        var respuesta = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}", Evento(festivalId, dias: 45), HttpMethod.Put);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("en_revision", cuerpo.GetProperty("estado").GetString());
        Assert.False(cuerpo.GetProperty("esErrata").GetBoolean());
        Assert.Equal("la fecha", Assert.Single(cuerpo.GetProperty("cambiosDeFondo").EnumerateArray()).GetString());

        // LO NUEVO NO ESTÁ APROBADO: sale de la agenda.
        Assert.DoesNotContain("Concierto de clausura del festival", await TitulosPublicosAsync(factory.CreateClient()));
    }

    [Fact]
    public async Task Cambiar_el_proceso_o_el_territorio_tambien_es_un_cambio_de_fondo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, festivalId, id, _) = await PublicadoAsync(factory, "fondo.territorio@example.com");

        var respuesta = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}", Evento(festivalId, departamento: "05", municipio: "05001"), HttpMethod.Put);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("en_revision", cuerpo.GetProperty("estado").GetString());
        Assert.Contains("el territorio", cuerpo.GetProperty("cambiosDeFondo").EnumerateArray().Select(c => c.GetString()));
    }

    [Fact]
    public async Task Reescribir_la_descripcion_entera_ya_no_es_una_errata()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, festivalId, id, _) = await PublicadoAsync(factory, "fondo.descripcion@example.com");

        var respuesta = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}",
            Evento(festivalId, descripcion: "Taller de composición con invitados internacionales y entrada con inscripción previa."),
            HttpMethod.Put);
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);

        var cuerpo = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("en_revision", cuerpo.GetProperty("estado").GetString());
        Assert.Contains("la descripción", cuerpo.GetProperty("cambiosDeFondo").EnumerateArray().Select(c => c.GetString()));
    }

    // ---------- D3-13: retirar y cancelar ------------------------------------------------------

    [Fact]
    public async Task Retirar_un_evento_publicado_exige_motivo_y_lo_saca_de_la_agenda_al_instante()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, _, id, _) = await PublicadoAsync(factory, "retira.evento@example.com");
        var anonimo = factory.CreateClient();

        // PRIMERO SE CALIENTA LA CACHÉ de la lista pública: si retirar no la vaciara, lo retirado
        // seguiría apareciendo hasta un minuto después.
        Assert.Contains("Concierto de clausura del festival", await TitulosPublicosAsync(anonimo));

        var sinMotivo = await EventosDeOrganizacionTests.EnviarAsync(cliente, $"{Ruta(organizacionId)}/{id}/retirar", new { motivo = "  " });
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);
        Assert.Equal("publicado", (await FilaAsync(factory, id)).Estado);

        var retirado = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}/retirar", new { motivo = "Se cayó el permiso del lugar." });
        Assert.Equal(HttpStatusCode.OK, retirado.StatusCode);

        var fila = await FilaAsync(factory, id);
        Assert.Equal("archivado", fila.Estado);
        Assert.DoesNotContain("Concierto de clausura del festival", await TitulosPublicosAsync(anonimo));

        // Y YA NO SE PUEDE EDITAR NI VOLVER A RETIRAR.
        var editado = await EventosDeOrganizacionTests.EnviarAsync(cliente, $"{Ruta(organizacionId)}/{id}", Evento(0), HttpMethod.Put);
        Assert.Equal(HttpStatusCode.Conflict, editado.StatusCode);
        var otraVez = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}/retirar", new { motivo = "Otra vez." });
        Assert.Equal(HttpStatusCode.Conflict, otraVez.StatusCode);
    }

    [Fact]
    public async Task Solo_se_retira_lo_publicado_y_lo_propio()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, festivalId, id, _) = await PublicadoAsync(factory, "retira.propio@example.com");

        // UN BORRADOR NO SE «RETIRA»: no estaba anunciado.
        var borrador = await EventosDeOrganizacionTests.EnviarAsync(cliente, Ruta(organizacionId), new
        {
            titulo = "Ensayo abierto en borrador",
            descripcion = "Aún sin enviar.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(10),
            modalidad = "presencial",
            lugar = "Plaza principal",
            festivalId,
            borrador = true,
        });
        borrador.EnsureSuccessStatusCode();
        var idBorrador = (await borrador.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();
        var retiradoBorrador = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{idBorrador}/retirar", new { motivo = "No sale." });
        Assert.Equal(HttpStatusCode.Conflict, retiradoBorrador.StatusCode);

        // UN EVENTO DE OTRA ORGANIZACIÓN RESPONDE COMO UNO QUE NO EXISTE.
        var (ajeno, organizacionAjena) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "retira.ajeno@example.com");
        var intento = await EventosDeOrganizacionTests.EnviarAsync(
            ajeno, $"{Ruta(organizacionAjena)}/{id}/retirar", new { motivo = "No es mío." });
        Assert.Equal(HttpStatusCode.NotFound, intento.StatusCode);
        Assert.Equal("publicado", (await FilaAsync(factory, id)).Estado);
    }

    [Fact]
    public async Task Cancelar_deja_el_evento_en_la_agenda_marcado_como_cancelado_con_su_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, _, id, slug) = await PublicadoAsync(factory, "cancela.evento@example.com");
        var anonimo = factory.CreateClient();

        // SE CALIENTA LA CACHÉ ANTES: el aviso debe verse de inmediato, no al cabo de un minuto.
        var antes = await anonimo.GetFromJsonAsync<JsonElement>("/api/v1/publico/agenda?cuando=todos");
        Assert.False(antes.GetProperty("items")[0].GetProperty("cancelado").GetBoolean());

        var sinMotivo = await EventosDeOrganizacionTests.EnviarAsync(cliente, $"{Ruta(organizacionId)}/{id}/cancelar", new { motivo = "" });
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);

        var cancelado = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}/cancelar", new { motivo = "Lluvia en toda la región." });
        Assert.Equal(HttpStatusCode.OK, cancelado.StatusCode);

        var fila = await FilaAsync(factory, id);
        // NO ES UN ESTADO NUEVO DEL CIRCUITO: sigue «publicado», con la marca.
        Assert.Equal("publicado", fila.Estado);
        Assert.True(fila.Cancelado);
        Assert.Equal("Lluvia en toda la región.", fila.MotivoCancelacion);
        Assert.NotNull(fila.FechaCancelacion);

        var lista = await anonimo.GetFromJsonAsync<JsonElement>("/api/v1/publico/agenda?cuando=todos");
        var suyo = lista.GetProperty("items").EnumerateArray().First(e => e.GetProperty("slug").GetString() == slug);
        // LA SITUACIÓN SIGUE SIENDO DE TIEMPO: un evento cancelado que ya pasó es cancelado y finalizado.
        Assert.Equal("proximo", suyo.GetProperty("situacion").GetString());
        Assert.True(suyo.GetProperty("cancelado").GetBoolean());

        var ficha = await anonimo.GetFromJsonAsync<JsonElement>($"/api/v1/publico/agenda/{slug}");
        Assert.Equal("Lluvia en toda la región.", ficha.GetProperty("motivoCancelacion").GetString());

        var propios = await cliente.GetFromJsonAsync<JsonElement>(Ruta(organizacionId));
        Assert.Equal("Cancelado", propios[0].GetProperty("estadoEtiqueta").GetString());
        Assert.True(propios[0].GetProperty("cancelado").GetBoolean());
    }

    [Fact]
    public async Task Un_evento_cancelado_no_se_edita_ni_se_cancela_otra_vez_pero_si_se_retira()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, festivalId, id, _) = await PublicadoAsync(factory, "cancela.luego@example.com");

        (await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}/cancelar", new { motivo = "Se aplaza sin fecha." })).EnsureSuccessStatusCode();

        var editado = await EventosDeOrganizacionTests.EnviarAsync(cliente, $"{Ruta(organizacionId)}/{id}", Evento(festivalId), HttpMethod.Put);
        Assert.Equal(HttpStatusCode.Conflict, editado.StatusCode);

        var otraVez = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}/cancelar", new { motivo = "Otra vez." });
        Assert.Equal(HttpStatusCode.Conflict, otraVez.StatusCode);

        // RETIRARLO DESPUÉS SÍ: lo cancelado también puede dejar de anunciarse.
        var retirado = await EventosDeOrganizacionTests.EnviarAsync(
            cliente, $"{Ruta(organizacionId)}/{id}/retirar", new { motivo = "Ya no tiene sentido anunciarlo." });
        Assert.Equal(HttpStatusCode.OK, retirado.StatusCode);
        Assert.Equal("archivado", (await FilaAsync(factory, id)).Estado);
    }

    [Fact]
    public async Task Sin_testigo_antifalsificacion_no_se_retira_ni_se_cancela()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId, _, id, _) = await PublicadoAsync(factory, "sin.testigo@example.com");

        var retirar = await cliente.PostAsJsonAsync($"{Ruta(organizacionId)}/{id}/retirar", new { motivo = "Sin testigo." });
        var cancelar = await cliente.PostAsJsonAsync($"{Ruta(organizacionId)}/{id}/cancelar", new { motivo = "Sin testigo." });

        Assert.Equal(HttpStatusCode.BadRequest, retirar.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, cancelar.StatusCode);
        Assert.Equal("publicado", (await FilaAsync(factory, id)).Estado);
        Assert.False((await FilaAsync(factory, id)).Cancelado);
    }

    // ---------- D3-14: el territorio del proceso viaja al formulario ---------------------------

    [Fact]
    public async Task El_proceso_que_enmarca_dice_su_territorio_para_que_el_formulario_lo_proponga()
    {
        await using var factory = new TestWebApplicationFactory();
        var (cliente, organizacionId) = await EventosDeOrganizacionTests.OrganizacionAsync(factory, "territorio.heredado@example.com");
        var festivalId = await EventosDeOrganizacionTests.FestivalAsync(cliente, factory, organizacionId, publicado: true);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var festival = await db.FestivalRecords.SingleAsync(f => f.Id == festivalId);
            festival.CoverageLevel = "municipal";
            festival.DepartmentCode = "05";
            festival.MunicipalityCode = "05001";
            await db.SaveChangesAsync();
        }

        var procesos = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/organizaciones/{organizacionId}/procesos-que-enmarcan");
        Assert.Equal("05", procesos[0].GetProperty("codigoDepartamento").GetString());
        Assert.Equal("05001", procesos[0].GetProperty("codigoMunicipio").GetString());
    }

    // ---------- La regla, sola ----------------------------------------------------------------

    private static EventoAgendaRow Publicado() => new()
    {
        Titulo = "Concierto de clausura del festival",
        Descripcion = Descripcion,
        FechaInicio = new DateOnly(2027, 3, 14),
        Modalidad = "presencial",
        Lugar = "Plaza principal",
        FestivalId = 7,
        Estado = "publicado",
    };

    private static CrearEventoDeOrganizacionSolicitud Igual() => new()
    {
        Titulo = "Concierto de clausura del festival",
        Descripcion = Descripcion,
        FechaInicio = new DateOnly(2027, 3, 14),
        Modalidad = "presencial",
        Lugar = "Plaza principal",
        FestivalId = 7,
    };

    [Fact]
    public void Lo_que_no_cambia_nada_no_es_de_fondo()
    {
        Assert.Empty(ReglasDeErrataDeEventos.CambiosDeFondo(Publicado(), Igual()));
    }

    [Theory]
    [InlineData("fecha de fin")]
    [InlineData("hora")]
    [InlineData("modalidad")]
    [InlineData("enlace")]
    [InlineData("proceso")]
    public void Cada_dato_de_fondo_lo_es_por_si_solo(string cual)
    {
        var nueva = Igual();
        switch (cual)
        {
            case "fecha de fin": nueva.FechaFin = new DateOnly(2027, 3, 15); break;
            case "hora": nueva.HoraInicio = new TimeOnly(19, 0); break;
            case "modalidad": nueva.Modalidad = "virtual"; break;
            case "enlace": nueva.Url = "https://example.org/en-vivo"; break;
            default: nueva.FestivalId = null; nueva.MercadoId = 3; break;
        }

        Assert.Single(ReglasDeErrataDeEventos.CambiosDeFondo(Publicado(), nueva));
    }

    [Fact]
    public void La_errata_de_una_letra_en_una_descripcion_corta_no_es_de_fondo()
    {
        var actual = Publicado();
        actual.Descripcion = "Concierto de clausura";
        var nueva = Igual();
        nueva.Descripcion = "Concierto de clausora";

        Assert.Empty(ReglasDeErrataDeEventos.CambiosDeFondo(actual, nueva));
    }

    [Fact]
    public void Las_cuentas_de_la_prosa_se_leen_como_una_frase()
    {
        Assert.Equal(string.Empty, ReglasDeErrataDeEventos.EnProsa([]));
        Assert.Equal("la fecha", ReglasDeErrataDeEventos.EnProsa(["la fecha"]));
        Assert.Equal("la fecha y el lugar", ReglasDeErrataDeEventos.EnProsa(["la fecha", "el lugar"]));
        Assert.Equal("la fecha, la hora y el lugar", ReglasDeErrataDeEventos.EnProsa(["la fecha", "la hora", "el lugar"]));
    }
}
