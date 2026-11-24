using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using Xunit;
using static SIMUS.Api.Tests.ProcesosDeLuteriaEnLaAgenda;

namespace SIMUS.Api.Tests;

/// <summary>
/// Los eventos de talleres, espacios y redes (LUT-01 y LUT-02) <b>contra SQL Server</b>.
/// </summary>
/// <remarks>
/// Lo que el carril rápido (SQLite) no protege: <c>CK_EventosAgenda_UnSoloProceso</c> con los cinco procesos, las
/// tres claves foráneas nuevas (<c>V20261115_10</c>), la procedencia externa sin organización, el historial, la
/// bitácora con su <c>ISJSON</c>, el registro de cambios y los avisos a la persona responsable. Es la lección de
/// REC-01 y REC-02: lo que solo se prueba en SQLite no se ha probado.
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class EventosDeLuteriaYRedesSqlServerTests
{
    private readonly SqlServerFixture _base;

    public EventosDeLuteriaYRedesSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    private async Task<int> NumeroAsync(string consulta) =>
        Convert.ToInt32(await _base.EscalarAsync(consulta), CultureInfo.InvariantCulture);

    [HechoSqlServer]
    public async Task La_base_admite_un_solo_proceso_de_cinco_y_rechaza_dos()
    {
        var (cliente, persona) = await PersonaAsync(_base.CrearCliente(), _base.Services, "luts.check");
        var taller = await ProcesoAsync(_base.Services, "taller", null, persona);
        var red = await ProcesoAsync(_base.Services, "red", null, persona);
        var creado = await EnviarAsync(cliente, HttpMethod.Post, "/api/v1/externo/mis-eventos", Evento("taller", taller));
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

        // CK_EventosAgenda_UnSoloProceso: un taller y una red a la vez no es un evento.
        var fallo = await Assert.ThrowsAnyAsync<Exception>(() => _base.EscalarAsync(
            $"UPDATE dbo.EventosAgenda SET RedId = {red} WHERE IdEventoAgenda = {id};"));
        Assert.Contains("CK_EventosAgenda_UnSoloProceso", fallo.ToString(), StringComparison.Ordinal);

        // Y UNA FORÁNEA A UN TALLER QUE NO EXISTE tampoco.
        var huerfano = await Assert.ThrowsAnyAsync<Exception>(() => _base.EscalarAsync(
            $"UPDATE dbo.EventosAgenda SET TallerId = 2000000 WHERE IdEventoAgenda = {id};"));
        Assert.Contains("FK_EventosAgenda_Talleres", huerfano.ToString(), StringComparison.Ordinal);
    }

    [HechoSqlServer]
    public async Task Un_evento_de_una_persona_deja_procedencia_historial_bitacora_y_registro_de_cambios()
    {
        var (cliente, persona) = await PersonaAsync(_base.CrearCliente(), _base.Services, "luts.crea");
        var espacio = await ProcesoAsync(_base.Services, "espacio", null, persona);

        var creado = await EnviarAsync(cliente, HttpMethod.Post, "/api/v1/externo/mis-eventos", Evento("espacio", espacio));
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

        Assert.Equal(espacio, await NumeroAsync($"SELECT EspacioId FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id};"));
        Assert.Equal(1, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.ProcedenciasDeRegistro WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            $"AND ContextoOrigen = N'externo' AND OrganizacionProcedenciaId IS NULL AND UsuarioCreadorId = {persona};"));
        Assert.Equal(1, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            $"AND Accion = N'EventoEnviadoARevision' AND OrganizacionId IS NULL AND IdUsuario = {persona} " +
            $"AND JSON_VALUE(MetadataJson, '$.espacioId') = N'{espacio}';"));
        Assert.Equal(1, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'EventosAgenda' AND IdRegistroAfectado = N'{id}' " +
            "AND JSON_VALUE(ValoresNuevos, '$.evento') = N'EventoAnunciadoPorPersona' " +
            $"AND JSON_VALUE(ValoresNuevos, '$.procesoTipo') = N'espacio';"));
    }

    [HechoSqlServer]
    public async Task Cancelar_y_retirar_dejan_marca_historial_bitacora_registro_de_cambios_y_aviso_a_la_persona()
    {
        var (cliente, persona) = await PersonaAsync(_base.CrearCliente(), _base.Services, "luts.cancela");
        var taller = await ProcesoAsync(_base.Services, "taller", null, persona);
        var creado = await EnviarAsync(cliente, HttpMethod.Post, "/api/v1/externo/mis-eventos", Evento("taller", taller));
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
        await PublicarAsync(_base.Services, id);
        var ruta = $"/api/v1/externo/mis-eventos/{id}";

        var cancelado = await EnviarAsync(cliente, HttpMethod.Post, ruta + "/cancelar", new { motivo = "Lluvia en toda la región." });
        Assert.Equal(HttpStatusCode.OK, cancelado.StatusCode);
        Assert.Equal(1, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id} AND Cancelado = 1 AND Estado = N'publicado' " +
            "AND MotivoCancelacion = N'Lluvia en toda la región.' AND FechaCancelacion IS NOT NULL;"));
        Assert.Equal(1, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND Accion = N'EventoCancelado' AND EstadoNuevo = N'publicado';"));
        Assert.Equal(2, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND CampoId IN (N'cancelado', N'motivoCancelacion') AND ActorRol = N'Persona';"));
        Assert.True(await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.Notificaciones WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            $"AND TipoEvento = N'EventoCancelado' AND UsuarioDestinatarioId = {persona};") >= 1);

        var retirado = await EnviarAsync(cliente, HttpMethod.Post, ruta + "/retirar", new { motivo = "Se cayó el permiso." });
        Assert.Equal(HttpStatusCode.OK, retirado.StatusCode);
        Assert.Equal("archivado", Convert.ToString(await _base.EscalarAsync(
            $"SELECT Estado FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id};"), CultureInfo.InvariantCulture));
        Assert.Equal(1, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE TablaAfectada = N'EventosAgenda' AND IdRegistroAfectado = N'{id}' " +
            "AND Accion = N'archivar' AND JSON_VALUE(ValoresNuevos, '$.evento') = N'EventoRetiradoPorOrganizacion';"));
    }

    [HechoSqlServer]
    public async Task Una_errata_y_un_cambio_de_fondo_de_una_persona_dejan_su_rastro()
    {
        var (cliente, persona) = await PersonaAsync(_base.CrearCliente(), _base.Services, "luts.errata");
        var red = await ProcesoAsync(_base.Services, "red", null, persona);
        var creado = await EnviarAsync(cliente, HttpMethod.Post, "/api/v1/externo/mis-eventos", Evento("red", red));
        var id = (await creado.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
        await PublicarAsync(_base.Services, id);
        var ruta = $"/api/v1/externo/mis-eventos/{id}";

        await EnviarAsync(cliente, HttpMethod.Put, ruta, Evento("red", red, descripcion: Descripcion.Replace("cuerda", "cuerda frotada", StringComparison.Ordinal)));
        Assert.Equal(1, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND Accion = N'ErrataCorregida' AND EstadoAnterior = N'publicado' AND EstadoNuevo = N'publicado';"));

        await EnviarAsync(cliente, HttpMethod.Put, ruta, Evento("red", red, dias: 60));
        Assert.Equal("en_revision", Convert.ToString(await _base.EscalarAsync(
            $"SELECT Estado FROM dbo.EventosAgenda WHERE IdEventoAgenda = {id};"), CultureInfo.InvariantCulture));
        Assert.Equal(1, await NumeroAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'agenda' AND RegistroId = N'{id}' " +
            "AND Accion = N'EventoEditadoTrasPublicar' AND JSON_VALUE(MetadataJson, '$.camposDeFondo[0]') = N'la fecha';"));

        // EL HISTORIAL ÚNICO TAMBIÉN LO LEE LA PERSONA: errata y cambio de fondo, en una sola línea de tiempo.
        var linea = await cliente.GetFromJsonAsync<JsonElement>($"/api/v1/externo/mis-registros/historial/agenda/{id}");
        Assert.True(linea.GetProperty("entradas").GetArrayLength() >= 2);
    }
}
