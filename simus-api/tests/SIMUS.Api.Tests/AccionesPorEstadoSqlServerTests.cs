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
/// <b>contra SQL Server</b>: rechazar una noticia o un evento y registrar
/// y corregir las fuentes de una ficha editorial.
/// </summary>
/// <remarks>
/// <para>
/// <b>POR QUÉ EXISTE.</b> Todo flujo que escribe en la bitácora o en el historial tiene que probarse
/// aquí: el carril de SQLite no tiene <c>CK_BitacoraAuditoria_Accion</c> ni <c>ISJSON</c>, y es
/// donde un verbo nuevo («rechazar») o un valor que no sea un objeto JSON se convierten en un 500.
/// Y el estado <c>rechazado</c> lo admiten <c>CK_Noticias_Estado</c> y <c>CK_EventosAgenda_Estado</c>
/// solo desde la migración <c>V20261106_70</c>: sin ella el INSERT/UPDATE falla.
/// </para>
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class AccionesPorEstadoSqlServerTests
{
    private const string Noticias = "/api/v1/institucional/noticias";
    private const string Agenda = "/api/v1/institucional/agenda";
    private const string Catalogo = "/api/v1/institucional/catalogo-editorial";
    private readonly SqlServerFixture _base;

    public AccionesPorEstadoSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    private async Task<HttpClient> WebmasterAsync()
    {
        var correo = $"acciones.{Guid.NewGuid():N}@pnmc.local";
        const string clave = "AccionesSeguras123";
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var idWebmaster = await db.Roles.AsNoTracking().Where(x => x.Name == "webmaster").Select(x => x.Id).SingleAsync();
            var usuario = new UserRow { FullName = "Webmaster de acciones", Email = correo, IsActive = true, CreatedAt = DateTime.UtcNow };
            usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, clave);
            db.Users.Add(usuario);
            await db.SaveChangesAsync();
            await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);
        }
        var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = correo, Password = clave })).EnsureSuccessStatusCode();
        await CmsTestClient.AttachCsrfAsync(cliente);
        return cliente;
    }

    private static async Task<JsonElement> LeerAsync(HttpResponseMessage respuesta)
    {
        var texto = await respuesta.Content.ReadAsStringAsync();
        Assert.True(respuesta.IsSuccessStatusCode, $"{(int)respuesta.StatusCode}: {texto}");
        return JsonDocument.Parse(texto).RootElement.Clone();
    }

    [HechoSqlServer]
    public async Task Rechazar_una_noticia_escribe_el_estado_la_bitacora_y_el_historial()
    {
        var cliente = await WebmasterAsync();
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        var id = (await LeerAsync(await cliente.PostAsJsonAsync(Noticias, new
        {
            titulo = $"Noticia a rechazar {Guid.NewGuid():N}"[..40],
            resumen = "Resumen.",
            cuerpo = "Cuerpo de la noticia.",
            fechaPublicacion = hoy,
        }))).GetProperty("id").GetInt64();
        await LeerAsync(await cliente.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "en_revision" }));

        var sinMotivo = await cliente.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "rechazado" });
        Assert.Equal(HttpStatusCode.BadRequest, sinMotivo.StatusCode);

        var rechazada = await LeerAsync(await cliente.PostAsJsonAsync($"{Noticias}/{id}/estado",
            new { estado = "rechazado", motivo = "No cumple la línea editorial." }));
        Assert.Equal("rechazado", rechazada.GetProperty("estado").GetString());

        // LA BASE LA ACEPTA (CK_Noticias_Estado) Y LA BITÁCORA GUARDÓ EL VERBO Y LOS DOS JSON.
        Assert.Equal("rechazado", (string)(await _base.EscalarAsync($"SELECT Estado FROM dbo.Noticias WHERE IdNoticia = {id};"))!);
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'Noticias' AND IdRegistroAfectado = N'{id}' AND Accion = N'rechazar';"),
            CultureInfo.InvariantCulture) >= 1);
        var historial = await cliente.GetFromJsonAsync<List<EntradaDeHistorialDeEstadosDto>>($"{Noticias}/{id}/historial");
        Assert.Equal("Rechazado", historial![0].AccionEtiqueta);
        Assert.Equal("No cumple la línea editorial.", historial[0].Motivo);

        // Y SE PUEDE REABRIR A BORRADOR.
        Assert.Equal("borrador", (await LeerAsync(await cliente.PostAsJsonAsync($"{Noticias}/{id}/estado", new { estado = "borrador" })))
            .GetProperty("estado").GetString());
    }

    [HechoSqlServer]
    public async Task Rechazar_un_evento_escribe_el_estado_la_bitacora_y_el_historial()
    {
        var cliente = await WebmasterAsync();
        var id = (await LeerAsync(await cliente.PostAsJsonAsync(Agenda, new
        {
            titulo = $"Evento a rechazar {Guid.NewGuid():N}"[..40],
            descripcion = "Evento de la consola.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            modalidad = "presencial",
            lugar = "Teatro Municipal",
        }))).GetProperty("id").GetInt64();
        await LeerAsync(await cliente.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "en_revision" }));

        await LeerAsync(await cliente.PostAsJsonAsync($"{Agenda}/{id}/estado", new { estado = "rechazado", motivo = "Duplicado." }));

        Assert.Equal("rechazado", (string)(await _base.EscalarAsync($"SELECT Estado FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id};"))!);
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'EventosAgenda' AND IdRegistroAfectado = N'{id}' AND Accion = N'rechazar';"),
            CultureInfo.InvariantCulture) >= 1);
        var historial = await cliente.GetFromJsonAsync<List<EntradaDeHistorialDeEstadosDto>>($"{Agenda}/{id}/historial");
        Assert.Equal("Duplicado.", historial![0].Motivo);

        // «RECHAZADO» SOLO SE ALCANZA DESDE «EN REVISIÓN».
        var borrador = (await LeerAsync(await cliente.PostAsJsonAsync(Agenda, new
        {
            titulo = $"Evento en borrador {Guid.NewGuid():N}"[..40],
            descripcion = "Evento de la consola.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(6)),
            modalidad = "presencial",
            lugar = "Teatro Municipal",
        }))).GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.BadRequest,
            (await cliente.PostAsJsonAsync($"{Agenda}/{borrador}/estado", new { estado = "rechazado", motivo = "No." })).StatusCode);
    }

    [HechoSqlServer]
    public async Task Registrar_y_corregir_una_fuente_permite_publicar_una_ficha_creada_en_la_consola()
    {
        var cliente = await WebmasterAsync();
        var codigo = $"ED-L6-{Guid.NewGuid():N}"[..20];
        var ficha = await LeerAsync(await cliente.PostAsJsonAsync(Catalogo, new { codigo, titulo = "Ficha creada en la consola" }));
        var id = ficha.GetProperty("id").GetInt64();

        var sinFuente = await cliente.PostAsJsonAsync($"{Catalogo}/{id}/publicacion", new { estado = "publicado" });
        Assert.Equal(HttpStatusCode.BadRequest, sinFuente.StatusCode);

        ficha = await LeerAsync(await cliente.PostAsJsonAsync($"{Catalogo}/{id}/fuentes", new
        {
            version = ficha.GetProperty("version").GetInt32(),
            nombre = "Archivo Histórico del Cauca",
            referencia = "Caja 12, folio 4",
            url = "https://archivo.example.org/caja-12",
            fechaFuente = "2024-03-05",
        }));
        var fuenteId = ficha.GetProperty("fuentes")[0].GetProperty("id").GetInt64();

        ficha = await LeerAsync(await cliente.PutAsJsonAsync($"{Catalogo}/{id}/fuentes/{fuenteId}", new
        {
            version = ficha.GetProperty("version").GetInt32(),
            nombre = "Archivo Histórico del Cauca (corregido)",
            referencia = "Caja 12, folio 5",
        }));

        await LeerAsync(await cliente.PutAsJsonAsync($"{Catalogo}/{id}/derechos", new
        {
            version = ficha.GetProperty("version").GetInt32(),
            ficha = new { estado = "verificado", permitePublicarFicha = true, permitePublicarArchivo = false, licenciaONota = "CC BY-NC 4.0", fuenteId },
        }));
        await LeerAsync(await cliente.PostAsJsonAsync($"{Catalogo}/{id}/catalogacion", new { estado = "validada" }));
        await LeerAsync(await cliente.PostAsJsonAsync($"{Catalogo}/{id}/publicacion", new { estado = "publicado" }));

        // LA FUENTE Y SU HISTORIAL QUEDARON EN LA BASE, con la fecha de calendario a mediodía.
        Assert.Equal("Archivo Histórico del Cauca (corregido)", (string)(await _base.EscalarAsync(
            $"SELECT Nombre FROM dbo.FuentesEditoriales WHERE IdFuenteEditorial = {fuenteId};"))!);
        var acciones = await cliente.GetFromJsonAsync<List<JsonElement>>($"{Catalogo}/{id}/historial");
        Assert.Contains(acciones!, h => h.GetProperty("accion").GetString() == "FuenteRegistrada");
        Assert.Contains(acciones!, h => h.GetProperty("accion").GetString() == "FuenteCorregida");
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'PublicacionesEditoriales' AND IdRegistroAfectado = N'{id}' AND Accion = N'actualizar';"),
            CultureInfo.InvariantCulture) >= 2);
    }
}
