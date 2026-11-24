using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
///: Noticias y Agenda escriben su historial de estados en `RegistrosRevisionHistorial`, y lo
/// publicado solo admite erratas al instante; un cambio de fondo lo devuelve a revisión.
/// </summary>
public sealed class HistorialNoticiasAgendaTests
{
    private const string Noticias = "/api/v1/institucional/noticias";
    private const string Agenda = "/api/v1/institucional/agenda";

    private static async Task<JsonElement> NoticiaPublicadaAsync(HttpClient client)
    {
        var creada = await (await client.PostAsJsonAsync(Noticias, new
        {
            titulo = "Noticia con historial",
            resumen = "Resumen.",
            cuerpo = "Cuerpo de la noticia.",
            fechaPublicacion = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creada.GetProperty("id").GetInt64();
        (await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "publicado", motivo = "Listo" })).EnsureSuccessStatusCode();
        return await client.GetFromJsonAsync<JsonElement>($"{Noticias}/{id}");
    }

    private static async Task<List<HistorialRevisionRegistroRow>> HistorialAsync(TestWebApplicationFactory factory, string modulo, long id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
        var registro = id.ToString(System.Globalization.CultureInfo.InvariantCulture);
        return await db.HistorialesRevisionRegistros.AsNoTracking()
            .Where(x => x.ModuloId == modulo && x.RegistroId == registro)
            .OrderBy(x => x.Id).ToListAsync();
    }

    [Fact]
    public async Task Cambiar_el_estado_de_una_noticia_queda_en_el_historial_con_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var noticia = await NoticiaPublicadaAsync(client);
        var id = noticia.GetProperty("id").GetInt64();

        var historial = await HistorialAsync(factory, Modulos.Noticias, id);

        var fila = Assert.Single(historial);
        Assert.Equal("borrador", fila.EstadoAnterior);
        Assert.Equal("publicado", fila.EstadoNuevo);
        Assert.Equal("Listo", fila.Comentario);
        Assert.NotNull(fila.UsuarioId);
    }

    private static async Task<long> NoticiaEnRevisionAsync(HttpClient client)
    {
        var creada = await (await client.PostAsJsonAsync(Noticias, new
        {
            titulo = "Noticia que se revisa",
            resumen = "Resumen.",
            cuerpo = "Cuerpo de la noticia.",
            fechaPublicacion = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creada.GetProperty("id").GetInt64();
        (await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "en_revision" })).EnsureSuccessStatusCode();
        return id;
    }

    [Theory]
    [InlineData("borrador", "DevueltoParaCorregir")]
    [InlineData("rechazado", "RechazadoEnRevision")]
    public async Task Devolver_o_rechazar_una_noticia_en_revision_pide_motivo_y_lo_guarda(string destino, string accion)
    {
        //: sin motivo, quien la envió no sabe qué corregir.
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await NoticiaEnRevisionAsync(client);

        var sinMotivo = await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = destino, motivo = "   " });
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, sinMotivo.StatusCode);
        Assert.Contains("motivo", await sinMotivo.Content.ReadAsStringAsync());
        Assert.Equal("en_revision", (await client.GetFromJsonAsync<JsonElement>($"{Noticias}/{id}")).GetProperty("estado").GetString());

        (await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = destino, motivo = "El titular no corresponde." }))
            .EnsureSuccessStatusCode();

        var ultima = (await HistorialAsync(factory, Modulos.Noticias, id)).Last();
        Assert.Equal(accion, ultima.Accion);
        Assert.Equal("en_revision", ultima.EstadoAnterior);
        Assert.Equal(destino, ultima.EstadoNuevo);
        Assert.Equal("El titular no corresponde.", ultima.MotivoRechazo);
    }

    [Fact]
    public async Task Despublicar_no_es_devolver_y_no_pide_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = (await NoticiaPublicadaAsync(client)).GetProperty("id").GetInt64();

        (await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "borrador" })).EnsureSuccessStatusCode();
        Assert.Equal("EstadoCambiado", (await HistorialAsync(factory, Modulos.Noticias, id)).Last().Accion);
    }

    [Fact]
    public async Task El_historial_de_una_noticia_se_lee_con_estado_fecha_actor_y_motivo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var id = await NoticiaEnRevisionAsync(client);
        (await client.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "borrador", motivo = "Falta la fuente." }))
            .EnsureSuccessStatusCode();

        var historial = await client.GetFromJsonAsync<List<SIMUS.Contracts.EntradaDeHistorialDeEstadosDto>>($"{Noticias}/{id}/historial");

        Assert.NotNull(historial);
        Assert.Equal(2, historial!.Count);
        var devolucion = historial[0];
        Assert.Equal("Devuelto para corregir", devolucion.AccionEtiqueta);
        Assert.Equal("borrador", devolucion.EstadoNuevo);
        Assert.Equal("Falta la fuente.", devolucion.Motivo);
        Assert.False(string.IsNullOrWhiteSpace(devolucion.Actor));
        Assert.True(devolucion.Fecha > DateTime.UtcNow.AddMinutes(-5));
        Assert.Equal("en_revision", historial[1].EstadoNuevo);

        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await client.GetAsync($"{Noticias}/999999/historial")).StatusCode);
    }

    [Fact]
    public async Task Agenda_tambien_pide_motivo_al_devolver_y_expone_su_historial()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var creado = await (await client.PostAsJsonAsync(Agenda, new
        {
            titulo = "Encuentro que se revisa",
            descripcion = "Evento de la consola.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            modalidad = "presencial",
            lugar = "Teatro Municipal",
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creado.GetProperty("id").GetInt64();
        (await client.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "en_revision" })).EnsureSuccessStatusCode();

        Assert.Equal(System.Net.HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "rechazado" })).StatusCode);
        (await client.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "rechazado", motivo = "Duplicado." }))
            .EnsureSuccessStatusCode();
        // (L6): rechazar deja el evento «rechazado», no «archivado».
        Assert.Equal("rechazado", (await client.GetFromJsonAsync<JsonElement>($"{Agenda}/{id}")).GetProperty("estado").GetString());

        var historial = await client.GetFromJsonAsync<List<SIMUS.Contracts.EntradaDeHistorialDeEstadosDto>>($"{Agenda}/{id}/historial");
        Assert.Equal("Rechazado", historial![0].AccionEtiqueta);
        Assert.Equal("Duplicado.", historial[0].Motivo);
    }

    [Fact]
    public async Task Una_errata_en_lo_publicado_no_lo_saca_de_publicado()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var noticia = await NoticiaPublicadaAsync(client);
        var id = noticia.GetProperty("id").GetInt64();

        var guardada = await (await client.PutAsJsonAsync($"{Noticias}/{id}", new
        {
            titulo = "Noticia con historial",
            resumen = "Resumen.",
            cuerpo = "Cuerpo de la notícia.",
            fechaPublicacion = noticia.GetProperty("fechaPublicacion").GetString(),
            version = noticia.GetProperty("version").GetInt32(),
        })).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("publicado", guardada.GetProperty("estado").GetString());
        var ultima = (await HistorialAsync(factory, Modulos.Noticias, id)).Last();
        Assert.Equal("ErrataCorregida", ultima.Accion);
        Assert.Equal("publicado", ultima.EstadoNuevo);
    }

    [Fact]
    public async Task Cambiar_y_retirar_la_imagen_principal_de_lo_publicado_es_errata_y_queda_registrada()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var noticia = await NoticiaPublicadaAsync(client);
        var id = noticia.GetProperty("id").GetInt64();
        int archivoId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SimusDbContext>();
            var marca = Guid.NewGuid().ToString("N");
            var f = new FileRow
            {
                OriginalName = "portada.png", StoredName = $"n-{marca}.png", MimeType = "image/png", FileSizeBytes = 3,
                StoragePath = $"n/{marca}", UploadedByUserId = 1, CreatedAt = DateTime.UtcNow, Content = [1, 2, 3], Fingerprint = marca,
            };
            db.Files.Add(f);
            await db.SaveChangesAsync();
            archivoId = f.Id;
        }

        var puesta = await (await client.PutAsJsonAsync($"{Noticias}/{id}", new
        {
            titulo = "Noticia con historial", resumen = "Resumen.", cuerpo = "Cuerpo de la noticia.",
            fechaPublicacion = noticia.GetProperty("fechaPublicacion").GetString(),
            version = noticia.GetProperty("version").GetInt32(), imagenArchivoId = archivoId,
        })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("publicado", puesta.GetProperty("estado").GetString());

        var retirada = await (await client.PutAsJsonAsync($"{Noticias}/{id}", new
        {
            titulo = "Noticia con historial", resumen = "Resumen.", cuerpo = "Cuerpo de la noticia.",
            fechaPublicacion = noticia.GetProperty("fechaPublicacion").GetString(),
            version = puesta.GetProperty("version").GetInt32(), retirarImagen = true,
        })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("publicado", retirada.GetProperty("estado").GetString());

        var historial = await HistorialAsync(factory, Modulos.Noticias, id);
        Assert.Equal(2, historial.Count(x => x.Accion == "ErrataCorregida"));
        using var scope2 = factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<SimusDbContext>();
        var cambios = await db2.CambiosDeRegistro.AsNoTracking()
            .Where(x => x.CampoId == "imagenPrincipal" && x.RegistroId == id.ToString(System.Globalization.CultureInfo.InvariantCulture)).ToListAsync();
        Assert.Equal(2, cambios.Count);
    }

    [Fact]
    public async Task Un_cambio_de_fondo_en_lo_publicado_lo_devuelve_a_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var noticia = await NoticiaPublicadaAsync(client);
        var id = noticia.GetProperty("id").GetInt64();

        var guardada = await (await client.PutAsJsonAsync($"{Noticias}/{id}", new
        {
            titulo = "Otro titular",
            resumen = "Resumen.",
            cuerpo = "Cuerpo de la noticia.",
            fechaPublicacion = noticia.GetProperty("fechaPublicacion").GetString(),
            version = noticia.GetProperty("version").GetInt32(),
        })).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("en_revision", guardada.GetProperty("estado").GetString());
        var ultima = (await HistorialAsync(factory, Modulos.Noticias, id)).Last();
        Assert.Equal("CambioDeFondoEnPublicado", ultima.Accion);
        Assert.Equal("publicado", ultima.EstadoAnterior);
        Assert.Equal("en_revision", ultima.EstadoNuevo);
    }

    [Fact]
    public async Task Agenda_tambien_escribe_historial_y_vuelve_a_revision()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var creado = await (await client.PostAsJsonAsync(Agenda, new
        {
            titulo = "Encuentro con historial",
            descripcion = "Evento de la consola.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            modalidad = "presencial",
            lugar = "Teatro Municipal",
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creado.GetProperty("id").GetInt64();
        (await client.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "publicado" })).EnsureSuccessStatusCode();
        var evento = await client.GetFromJsonAsync<JsonElement>($"{Agenda}/{id}");

        var guardado = await (await client.PutAsJsonAsync($"{Agenda}/{id}", new
        {
            titulo = "Encuentro con historial, otra sede",
            descripcion = "Evento de la consola.",
            fechaInicio = evento.GetProperty("fechaInicio").GetString(),
            modalidad = "presencial",
            lugar = "Otra sede",
            version = evento.GetProperty("version").GetInt32(),
        })).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("en_revision", guardado.GetProperty("estado").GetString());
        var historial = await HistorialAsync(factory, Modulos.Agenda, id);
        Assert.Equal(["EstadoCambiado", "CambioDeFondoEnPublicado"], historial.Select(x => x.Accion));
    }

    [Fact]
    public async Task La_marca_esErrata_del_cliente_se_ignora_y_el_servidor_decide()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var noticia = await NoticiaPublicadaAsync(client);
        var id = noticia.GetProperty("id").GetInt64();

        // Marcar «errata» un titular reescrito no lo deja publicado: lo decide el servidor.
        var guardada = await (await client.PutAsJsonAsync($"{Noticias}/{id}", new
        {
            titulo = "Un titular por completo distinto",
            resumen = "Resumen.",
            cuerpo = "Cuerpo de la noticia.",
            fechaPublicacion = noticia.GetProperty("fechaPublicacion").GetString(),
            version = noticia.GetProperty("version").GetInt32(),
            esErrata = true,
        })).Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("en_revision", guardada.GetProperty("estado").GetString());
        var ultima = (await HistorialAsync(factory, Modulos.Noticias, id)).Last();
        Assert.Equal("CambioDeFondoEnPublicado", ultima.Accion);
        Assert.Contains("el titular", ultima.Comentario);
    }

    [Fact]
    public async Task Agenda_corregir_una_tilde_es_errata_y_cambiar_el_lugar_es_de_fondo()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = await CmsTestClient.LoginAsync(factory);
        var creado = await (await client.PostAsJsonAsync(Agenda, new
        {
            titulo = "Encuentro de bandas",
            descripcion = "Evento de la consola.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            modalidad = "presencial",
            lugar = "Teatro Municipal",
        })).Content.ReadFromJsonAsync<JsonElement>();
        var id = creado.GetProperty("id").GetInt64();
        (await client.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "publicado" })).EnsureSuccessStatusCode();
        var evento = await client.GetFromJsonAsync<JsonElement>($"{Agenda}/{id}");

        var errata = await (await client.PutAsJsonAsync($"{Agenda}/{id}", new
        {
            titulo = "Encuentro de bandas",
            descripcion = "Evento de la consóla.",
            fechaInicio = evento.GetProperty("fechaInicio").GetString(),
            modalidad = "presencial",
            lugar = "Teatro Municipal",
            version = evento.GetProperty("version").GetInt32(),
        })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("publicado", errata.GetProperty("estado").GetString());

        var fondo = await (await client.PutAsJsonAsync($"{Agenda}/{id}", new
        {
            titulo = "Encuentro de bandas",
            descripcion = "Evento de la consóla.",
            fechaInicio = evento.GetProperty("fechaInicio").GetString(),
            modalidad = "presencial",
            lugar = "Parque de la Música",
            version = errata.GetProperty("version").GetInt32(),
            esErrata = true,
        })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("en_revision", fondo.GetProperty("estado").GetString());
        var historial = await HistorialAsync(factory, Modulos.Agenda, id);
        Assert.Equal(["EstadoCambiado", "ErrataCorregida", "CambioDeFondoEnPublicado"], historial.Select(x => x.Accion));
    }
}
