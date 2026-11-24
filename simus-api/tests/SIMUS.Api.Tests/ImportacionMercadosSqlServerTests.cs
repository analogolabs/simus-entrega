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

/// <summary>
/// La importación de Mercados contra el esquema real (CON-01): pasa <c>CK_LotesImportacion_Modulo</c>
/// ampliada por V20261113_20, <c>CK_Mercados_*</c> y las del historial y la procedencia.
/// </summary>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class ImportacionMercadosSqlServerTests
{
    private readonly SqlServerFixture _base;

    public ImportacionMercadosSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task La_confirmacion_crea_un_borrador_con_historial_procedencia_y_sin_tocar_lo_existente()
    {
        var correo = $"importador-mercados-{Guid.NewGuid():N}@pnmc.local";
        const string clave = "ImportacionSegura123";
        await SembrarFuncionarioAsync(correo, clave);

        using var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = correo, Password = clave }))
            .EnsureSuccessStatusCode();
        var csrf = await cliente.GetFromJsonAsync<TokenDto>("/api/v1/admin/importaciones/mercados/csrf");
        Assert.NotNull(csrf);
        cliente.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.Token);

        var nombre = $"Mercado importado SQL {Guid.NewGuid():N}";
        var vistaRespuesta = await cliente.PostAsJsonAsync("/api/v1/admin/importaciones/mercados/previsualizar", new PrevisualizarImportacionSolicitud
        {
            NombreArchivo = "mercados.csv",
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
                    ("alcance", "Nacional"),
                    ("modalidad", "Mixta"),
                    ("periodicidad", "Anual"),
                    ("correoContacto", "mercado-sql@example.org")),
            ],
        });
        vistaRespuesta.EnsureSuccessStatusCode();
        var vista = await vistaRespuesta.Content.ReadFromJsonAsync<ImportacionDto>();
        Assert.NotNull(vista);
        Assert.Equal(1, vista.FilasImportables);

        // PREVISUALIZAR NO ESCRIBE EN EL DESTINO.
        var porNombre = nombre.Replace("'", "''", StringComparison.Ordinal);
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.Mercados WHERE NombreMercado = N'{porNombre}';"), CultureInfo.InvariantCulture));

        var confirmacion = new ConfirmarImportacionSolicitud
        {
            HuellaPlan = vista.HuellaPlan,
            ClaveIdempotencia = $"sql-{Guid.NewGuid():N}",
            IdsFilasExcluidas = [],
        };
        var rutaConfirmacion = $"/api/v1/admin/importaciones/mercados/{vista.Id}/confirmar";
        var respuestas = await Task.WhenAll(
            cliente.PostAsJsonAsync(rutaConfirmacion, confirmacion),
            cliente.PostAsJsonAsync(rutaConfirmacion, confirmacion));
        foreach (var respuesta in respuestas)
        {
            respuesta.EnsureSuccessStatusCode();
            respuesta.Dispose();
        }

        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.Mercados WHERE NombreMercado = N'{porNombre}' AND EstadoRegistro = N'borrador' AND FechaPublicacion IS NULL AND CorreoMercado = N'mercado-sql@example.org';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.ProcedenciasDeRegistro p JOIN dbo.Mercados m ON p.ModuloId = N'mercados' AND p.RegistroId = CONVERT(nvarchar(120), m.IdMercado) WHERE m.NombreMercado = N'{porNombre}' AND p.ContextoOrigen = N'importacion';"), CultureInfo.InvariantCulture));
        // EL HISTORIAL UNICO EMPIEZA EL DIA DE LA IMPORTACION, con origen «importacion».
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro c JOIN dbo.Mercados m ON c.ModuloId = N'mercados' AND c.RegistroId = CONVERT(nvarchar(64), m.IdMercado) WHERE m.NombreMercado = N'{porNombre}' AND c.CampoId = N'nombre' AND c.Origen = N'importacion';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.DecisionesImportacion WHERE IdLoteImportacion = {vista.Id} AND Decision = N'importar';"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.FilasImportacion WHERE IdLoteImportacion = {vista.Id} AND IdRegistroCreado IS NOT NULL AND JSON_VALUE(ContenidoNormalizadoJson, '$.CorreoContacto') IS NULL;"), CultureInfo.InvariantCulture));
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
            FullName = "Responsable de importaciones de mercados",
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
