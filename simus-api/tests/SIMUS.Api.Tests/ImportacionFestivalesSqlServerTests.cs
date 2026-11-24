using System.Globalization;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Api.Endpoints;
using SIMUS.Contracts;
using SIMUS.Domain.Entities;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>Comprueba el circuito transaccional de importación contra el esquema real.</summary>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class ImportacionFestivalesSqlServerTests
{
    private readonly SqlServerFixture _base;

    public ImportacionFestivalesSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task La_confirmacion_crea_un_solo_historico_publicado_y_conserva_toda_la_traza()
    {
        var correo = $"importador-{Guid.NewGuid():N}@pnmc.local";
        const string clave = "ImportacionSegura123";
        await SembrarFuncionarioAsync(correo, clave);

        using var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest
        {
            Email = correo,
            Password = clave,
        })).EnsureSuccessStatusCode();

        var csrf = await cliente.GetFromJsonAsync<TokenDto>("/api/v1/admin/importaciones/festivales/csrf");
        Assert.NotNull(csrf);
        cliente.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.Token);

        var nombre = $"Festival importado SQL {Guid.NewGuid():N}";
        var vistaRespuesta = await cliente.PostAsJsonAsync("/api/v1/admin/importaciones/festivales/previsualizar", new PrevisualizarImportacionSolicitud
        {
            NombreArchivo = "festivales.csv",
            Formato = "csv",
            HuellaArchivo = new string('a', 64),
            VersionContrato = 1,
            Filas =
            [
                ImportacionFestivalesTests.Fila(2,
                    ("nombre", nombre),
                    ("nivelCobertura", "municipal"),
                    ("departamento", "05"),
                    ("municipio", "05001"),
                    ("correoContacto", "contacto-sql@example.org"),
                    ("telefonoContacto", "+57 300 123 4567")),
            ],
        });
        vistaRespuesta.EnsureSuccessStatusCode();
        var vista = await vistaRespuesta.Content.ReadFromJsonAsync<ImportacionDto>();
        Assert.NotNull(vista);
        Assert.Equal(1, vista.FilasImportables);

        var confirmacion = new ConfirmarImportacionSolicitud
        {
            HuellaPlan = vista.HuellaPlan,
            ClaveIdempotencia = $"sql-{Guid.NewGuid():N}",
            IdsFilasExcluidas = [],
        };
        var rutaConfirmacion = $"/api/v1/admin/importaciones/festivales/{vista.Id}/confirmar";
        var respuestas = await Task.WhenAll(
            cliente.PostAsJsonAsync(rutaConfirmacion, confirmacion),
            cliente.PostAsJsonAsync(rutaConfirmacion, confirmacion));
        foreach (var respuesta in respuestas)
        {
            respuesta.EnsureSuccessStatusCode();
            respuesta.Dispose();
        }

        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.Festivales WHERE NombreFestival = N'{nombre.Replace("'", "''", StringComparison.Ordinal)}' AND EstadoRegistro = N'publicado';"), CultureInfo.InvariantCulture));
        // EL HISTORIAL DICE POR QUÉ ESTÁ PUBLICADO: la fila pasa CK_RegistrosRevisionHistorial_EstadoNuevo.
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RegistrosRevisionHistorial h JOIN dbo.Festivales f ON h.ModuloId = N'festivales' AND h.RegistroId = CONVERT(nvarchar(64), f.IdFestival) WHERE f.NombreFestival = N'{nombre.Replace("'", "''", StringComparison.Ordinal)}' AND h.Accion = N'RegistroHistoricoPublicadoAlCargarse' AND h.EstadoNuevo = N'publicado';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.DecisionesImportacion WHERE IdLoteImportacion = {vista.Id} AND Decision = N'importar';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.FilasImportacion WHERE IdLoteImportacion = {vista.Id} AND IdRegistroCreado IS NOT NULL;"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.FilasImportacion WHERE IdLoteImportacion = {vista.Id} AND JSON_VALUE(ContenidoNormalizadoJson, '$.CorreoContacto') IS NULL AND JSON_VALUE(ContenidoNormalizadoJson, '$.TelefonoContacto') IS NULL;"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.LotesImportacion WHERE IdLoteImportacion = {vista.Id} AND FechaDepuracion IS NOT NULL;"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.Festivales WHERE NombreFestival = N'{nombre.Replace("'", "''", StringComparison.Ordinal)}' AND CorreoFestival = N'contacto-sql@example.org';"), CultureInfo.InvariantCulture));
    }

    private async Task SembrarFuncionarioAsync(string correo, string clave)
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var idWebmaster = await db.Roles.AsNoTracking()
            .Where(item => item.Name == "webmaster")
            .Select(item => item.Id)
            .SingleAsync();
        var usuario = new UserRow
        {
            FullName = "Responsable de importaciones",
            Email = correo,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, clave);
        db.Users.Add(usuario);
        await db.SaveChangesAsync();
        await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);

        if (!await db.EntityProfiles.AnyAsync(item => item.IsInstitutional))
        {
            db.EntityProfiles.Add(new EntityProfileRow
            {
                EntityType = "organizacion",
                Name = "Plan Nacional de Música para la Convivencia",
                StatusCode = "activa",
                IsActive = true,
                IsInstitutional = true,
                CreatedByUserId = usuario.Id,
                ResponsibleUserId = usuario.Id,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }
    }

    private sealed record TokenDto(string Token);
}
