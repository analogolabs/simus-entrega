using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// Corregir, retirar y cancelar un evento publicado <b>contra SQL
/// Server</b>.
/// </summary>
/// <remarks>
/// Cada acción escribe en lugares que el carril rápido (SQLite) no protege:
/// <c>CK_EventosAgenda_Cancelacion</c> (V20261110_60), <c>CK_RegistrosRevisionHistorial_EstadoNuevo</c>,
/// <c>CK_BitacoraAuditoria_Accion</c> y su <c>ISJSON</c>, <c>CK_CambiosDeRegistro_*</c> y la tabla de
/// avisos. Es la lección de REC-01 y REC-02: lo que solo se prueba en SQLite no se ha probado.
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class EventosPublicadosSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private readonly SqlServerFixture _base;

    public EventosPublicadosSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task Cancelar_deja_la_marca_el_historial_el_registro_de_cambios_la_bitacora_y_el_aviso()
    {
        var (cliente, organizacionId, id) = await EventoPublicadoAsync("cancela");
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos/{id}";

        var respuesta = await PostAsync(cliente, ruta + "/cancelar", new { motivo = "Lluvia en toda la región." });
        await EsperarAsync(HttpStatusCode.OK, respuesta);

        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id} AND Cancelado = 1 AND Estado = N'publicado' " +
            "AND MotivoCancelacion = N'Lluvia en toda la región.' AND FechaCancelacion IS NOT NULL;"), CultureInfo.InvariantCulture));

        // EL HISTORIAL DICE QUE SE CANCELÓ Y POR QUÉ, y el estado no se movió.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND Accion = N'EventoCancelado' AND EstadoAnterior = N'publicado' AND EstadoNuevo = N'publicado' " +
            "AND Comentario = N'Lluvia en toda la región.';"), CultureInfo.InvariantCulture));

        // Y EL REGISTRO DE CAMBIOS GUARDA LA MARCA Y EL MOTIVO, campo por campo.
        Assert.Equal(2, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND CampoId IN (N'cancelado', N'motivoCancelacion');"), CultureInfo.InvariantCulture));

        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'EventosAgenda' AND IdRegistroAfectado = N'{id}' " +
            "AND JSON_VALUE(ValoresNuevos, '$.evento') = N'EventoCanceladoPorOrganizacion';"), CultureInfo.InvariantCulture));

        // EL AVISO LLEGA A QUIEN ADMINISTRA, con el motivo.
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.Notificaciones WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND TipoEvento = N'EventoCancelado' AND Cuerpo LIKE N'%Lluvia en toda la región.%';"), CultureInfo.InvariantCulture) >= 1);
    }

    [HechoSqlServer]
    public async Task La_base_no_admite_una_cancelacion_a_medias()
    {
        var (_, _, id) = await EventoPublicadoAsync("medias");

        // CK_EventosAgenda_Cancelacion: cancelado sin motivo ni fecha no es una cancelación.
        var fallo = await Assert.ThrowsAnyAsync<Exception>(() => _base.EscalarAsync(
            $"UPDATE dbo.EventosAgenda SET Cancelado = 1 WHERE IdEventoAgenda = {id};"));
        Assert.Contains("CK_EventosAgenda_Cancelacion", fallo.ToString(), StringComparison.Ordinal);

        // Y UNA MARCA SIN CANCELAR TAMPOCO: el motivo sin la bandera es un dato huérfano.
        var huerfano = await Assert.ThrowsAnyAsync<Exception>(() => _base.EscalarAsync(
            $"UPDATE dbo.EventosAgenda SET MotivoCancelacion = N'Huérfano' WHERE IdEventoAgenda = {id};"));
        Assert.Contains("CK_EventosAgenda_Cancelacion", huerfano.ToString(), StringComparison.Ordinal);
    }

    [HechoSqlServer]
    public async Task Retirar_archiva_el_evento_y_deja_historial_bitacora_y_aviso()
    {
        var (cliente, organizacionId, id) = await EventoPublicadoAsync("retira");
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos/{id}";

        await EsperarAsync(HttpStatusCode.OK, await PostAsync(cliente, ruta + "/retirar", new { motivo = "Se cayó el permiso del lugar." }));

        Assert.Equal("archivado", Convert.ToString(await _base.EscalarAsync(
            $"SELECT Estado FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id};"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND Accion = N'EventoRetiradoPorOrganizacion' AND EstadoAnterior = N'publicado' AND EstadoNuevo = N'archivado';"), CultureInfo.InvariantCulture));
        // «archivar» es un verbo de la lista blanca de CK_BitacoraAuditoria_Accion.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'EventosAgenda' AND IdRegistroAfectado = N'{id}' " +
            "AND Accion = N'archivar' AND JSON_VALUE(ValoresNuevos, '$.evento') = N'EventoRetiradoPorOrganizacion';"), CultureInfo.InvariantCulture));
        Assert.True(Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.Notificaciones WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND TipoEvento = N'EventoRetirado';"), CultureInfo.InvariantCulture) >= 1);
    }

    [HechoSqlServer]
    public async Task Una_errata_deja_su_historial_y_el_valor_anterior_sin_mover_el_estado()
    {
        var (cliente, organizacionId, id) = await EventoPublicadoAsync("errata");
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos/{id}";
        var festivalId = await FestivalDelEventoAsync(id);

        await EsperarAsync(HttpStatusCode.OK, await PutAsync(cliente, ruta, EventoCorregido(festivalId, "Concierto de clausura del festival", "Concierto abierto al público en el marco del festival de música tradicional colombiana.")));

        Assert.Equal("publicado", Convert.ToString(await _base.EscalarAsync(
            $"SELECT Estado FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id};"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND Accion = N'ErrataCorregida' AND EstadoAnterior = N'publicado' AND EstadoNuevo = N'publicado';"), CultureInfo.InvariantCulture));

        // EL VALOR ANTERIOR NO SE PIERDE (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md): el registro de cambios guarda la descripción de antes.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' AND CampoId = N'descripcion' " +
            "AND ValorAnterior = N'Concierto abierto al público en el marco del festival de música tradicional.' " +
            "AND ValorNuevo LIKE N'%tradicional colombiana.';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Un_cambio_de_fondo_deja_en_el_historial_que_cambio_y_vuelve_a_revision()
    {
        var (cliente, organizacionId, id) = await EventoPublicadoAsync("fondo");
        var ruta = $"/api/v1/externo/organizaciones/{organizacionId}/eventos/{id}";
        var festivalId = await FestivalDelEventoAsync(id);

        var respuesta = await PutAsync(cliente, ruta, new
        {
            titulo = "Concierto de clausura del festival",
            descripcion = "Concierto abierto al público en el marco del festival de música tradicional.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(60),
            modalidad = "presencial",
            lugar = "Plaza principal",
            festivalId,
        });
        await EsperarAsync(HttpStatusCode.OK, respuesta);

        Assert.Equal("en_revision", Convert.ToString(await _base.EscalarAsync(
            $"SELECT Estado FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id};"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND Accion = N'EventoEditadoTrasPublicar' AND EstadoNuevo = N'en_revision' " +
            "AND Comentario LIKE N'%la fecha%' AND JSON_VALUE(MetadataJson, '$.camposDeFondo[0]') = N'la fecha';"), CultureInfo.InvariantCulture));
    }

    // ---------- Apoyos --------------------------------------------------------------------

    private static object EventoCorregido(int festivalId, string titulo, string descripcion) => new
    {
        titulo,
        descripcion,
        fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30),
        modalidad = "presencial",
        lugar = "Plaza principal",
        festivalId,
    };

    private async Task<int> FestivalDelEventoAsync(string id) =>
        Convert.ToInt32(await _base.EscalarAsync($"SELECT FestivalId FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id};"), CultureInfo.InvariantCulture);

    /// <summary>Una organización con un Festival publicado y un evento suyo ya publicado.</summary>
    private async Task<(HttpClient Cliente, int OrganizacionId, string EventoId)> EventoPublicadoAsync(string marca)
    {
        var cliente = _base.CrearCliente();
        var correo = $"evpub.{marca}.{Guid.NewGuid():N}"[..28] + "@organizacion.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización " + marca + Guid.NewGuid().ToString("N")[..5],
            FullName = "Responsable " + marca,
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = "05",
            HeadquartersMunicipalityCode = "05001",
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var mias = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/mis");
        var organizacionId = int.Parse(mias[0].GetProperty("id").GetString()!, CultureInfo.InvariantCulture);

        int festivalId;
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var festival = new FestivalRow
            {
                Name = "Festival de " + marca + Guid.NewGuid().ToString("N")[..6],
                Description = "Festival de prueba.",
                CoverageLevel = "nacional",
                StatusCode = "publicado",
                OrganizacionPrincipalId = organizacionId,
                CreatedAt = DateTime.UtcNow,
            };
            db.FestivalRecords.Add(festival);
            await db.SaveChangesAsync();
            festivalId = festival.Id;
        }

        var creado = await PostAsync(cliente, $"/api/v1/externo/organizaciones/{organizacionId}/eventos", new
        {
            titulo = "Concierto de clausura del festival",
            descripcion = "Concierto abierto al público en el marco del festival de música tradicional.",
            fechaInicio = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30),
            modalidad = "presencial",
            lugar = "Plaza principal",
            festivalId,
        });
        await EsperarAsync(HttpStatusCode.Created, creado);
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

        // PUBLICAR SE HACE CONTRA LA BASE: lo que se mide es lo que pasa después, no el circuito.
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var fila = await db.EventosAgenda.SingleAsync(e => e.Id == long.Parse(id, CultureInfo.InvariantCulture));
            fila.Estado = "publicado";
            await db.SaveChangesAsync();
        }

        return (cliente, organizacionId, id);
    }

    private static async Task<HttpResponseMessage> PostAsync(HttpClient cliente, string ruta, object cuerpo) =>
        await EnviarAsync(cliente, HttpMethod.Post, ruta, cuerpo);

    private static async Task<HttpResponseMessage> PutAsync(HttpClient cliente, string ruta, object cuerpo) =>
        await EnviarAsync(cliente, HttpMethod.Put, ruta, cuerpo);

    private static async Task<HttpResponseMessage> EnviarAsync(HttpClient cliente, HttpMethod metodo, string ruta, object cuerpo)
    {
        var testigo = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/csrf");
        var mensaje = new HttpRequestMessage(metodo, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return await cliente.SendAsync(mensaje);
    }

    private static async Task EsperarAsync(HttpStatusCode esperado, HttpResponseMessage respuesta) =>
        Assert.True(respuesta.StatusCode == esperado,
            $"{respuesta.RequestMessage?.Method} {respuesta.RequestMessage?.RequestUri} respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");
}
