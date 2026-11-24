using System.Globalization;
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
/// La baja de una organización con Mercados, Talleres, Espacios y Redes <b>contra SQL Server</b>: lo que el carril
/// rápido no protege es la bitácora (<c>CK_BitacoraAuditoria_Accion</c>, <c>ISJSON</c>), las claves foráneas de la
/// transferencia y el <c>CK_*_UnSoloResponsable</c> al pasar el proceso a la entidad institucional.
/// </summary>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class BajaDeOrganizacionConTodosSusProcesosSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private readonly SqlServerFixture _base;

    public BajaDeOrganizacionConTodosSusProcesosSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    private async Task<int> NumeroAsync(string consulta) =>
        Convert.ToInt32(await _base.EscalarAsync(consulta), CultureInfo.InvariantCulture);

    private async Task<HttpClient> ConsolaAsync()
    {
        var correo = $"baja.{Guid.NewGuid():N}@pnmc.local";
        const string clave = "BajaSegura12345";
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var idWebmaster = await db.Roles.AsNoTracking().Where(x => x.Name == "webmaster").Select(x => x.Id).SingleAsync();
            var usuario = new UserRow { FullName = "Webmaster de la baja", Email = correo, IsActive = true, CreatedAt = DateTime.UtcNow };
            usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, clave);
            db.Users.Add(usuario);
            await db.SaveChangesAsync();
            await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);
            if (!await db.EntityProfiles.AnyAsync(x => x.IsInstitutional))
            {
                db.EntityProfiles.Add(new EntityProfileRow
                {
                    EntityType = "organizacion", Name = "Plan Nacional de Música para la Convivencia", StatusCode = "activa",
                    IsActive = true, IsInstitutional = true, CreatedByUserId = usuario.Id, ResponsibleUserId = usuario.Id, CreatedAt = DateTime.UtcNow,
                });
                await db.SaveChangesAsync();
            }
        }

        var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = correo, Password = clave })).EnsureSuccessStatusCode();
        await CmsTestClient.AttachCsrfAsync(cliente);
        return cliente;
    }

    private async Task<int> OrganizacionAsync()
    {
        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP (1) CodigoDepartamento + N'|' + CodigoMunicipio FROM dbo.Divipola ORDER BY CodigoDepartamento, CodigoMunicipio;"),
            CultureInfo.InvariantCulture)!.Split('|');
        var cliente = _base.CrearCliente();
        var correo = $"baja.{Guid.NewGuid():N}"[..24] + "@organizacion.test";
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización de la baja " + Guid.NewGuid().ToString("N")[..5],
            FullName = "Responsable de la baja",
            NumeroDocumento = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            HeadquartersDepartmentCode = par[0],
            HeadquartersMunicipalityCode = par[1],
            Phone = "3000000000",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();
        var mias = await cliente.GetFromJsonAsync<JsonElement>("/api/v1/externo/organizaciones/mis");
        return int.Parse(mias[0].GetProperty("id").GetString()!, CultureInfo.InvariantCulture);
    }

    private async Task<int> MercadoAsync(int organizacionId)
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var mercado = new MercadoRow
        {
            Nombre = "Mercado de la baja", NivelCobertura = "nacional", OrganizacionPrincipalId = organizacionId,
            EstadoRegistro = "publicado", Activo = true, FechaCreacion = DateTime.UtcNow, FechaPublicacion = DateTime.UtcNow,
        };
        db.Mercados.Add(mercado);
        await db.SaveChangesAsync();
        return mercado.Id;
    }

    [HechoSqlServer]
    public async Task Archivar_y_liberar_los_procesos_simples_respetan_las_restricciones_de_la_base()
    {
        var consola = await ConsolaAsync();

        // ARCHIVAR.
        var archivada = await OrganizacionAsync();
        var mercadoA = await MercadoAsync(archivada);
        var tallerA = await ProcesoAsync(_base.Services, "taller", archivada, null);
        var espacioA = await ProcesoAsync(_base.Services, "espacio", archivada, null);
        var redA = await ProcesoAsync(_base.Services, "red", archivada, null);
        var rechazo = await consola.PostAsJsonAsync($"/api/v1/admin/organizaciones/{archivada}/estado",
            new { estado = "eliminada", motivo = "Se disolvió." });
        Assert.Equal(System.Net.HttpStatusCode.Conflict, rechazo.StatusCode);
        (await consola.PostAsJsonAsync($"/api/v1/admin/organizaciones/{archivada}/estado",
            new { estado = "eliminada", motivo = "Se disolvió.", queHacerConLosProcesos = "archivar" })).EnsureSuccessStatusCode();
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            Assert.Equal("archivado", (await db.Mercados.AsNoTracking().SingleAsync(x => x.Id == mercadoA)).EstadoRegistro);
            Assert.Equal("archivado", (await db.Talleres.AsNoTracking().SingleAsync(x => x.Id == tallerA)).EstadoRegistro);
            Assert.Equal("archivado", (await db.Espacios.AsNoTracking().SingleAsync(x => x.Id == espacioA)).EstadoRegistro);
            var red = await db.Redes.AsNoTracking().SingleAsync(x => x.Id == redA);
            Assert.Equal("archivado", red.EstadoRegistro);
            Assert.Equal(archivada, red.OrganizacionPrincipalId);
        }

        // LIBERAR.
        var liberada = await OrganizacionAsync();
        var tallerL = await ProcesoAsync(_base.Services, "taller", liberada, null);
        var redL = await ProcesoAsync(_base.Services, "red", liberada, null);
        var mercadoL = await MercadoAsync(liberada);
        (await consola.PostAsJsonAsync($"/api/v1/admin/organizaciones/{liberada}/estado",
            new { estado = "eliminada", motivo = "Se disolvió.", queHacerConLosProcesos = "liberar" })).EnsureSuccessStatusCode();
        using (var alcance = _base.Services.CreateScope())
        {
            var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
            var institucional = await db.EntityProfiles.AsNoTracking().Where(x => x.IsInstitutional).Select(x => x.Id).SingleAsync();
            var taller = await db.Talleres.AsNoTracking().SingleAsync(x => x.Id == tallerL);
            Assert.Equal(institucional, taller.OrganizacionPrincipalId);
            Assert.Null(taller.UsuarioResponsableId);
            Assert.Equal(institucional, (await db.Redes.AsNoTracking().SingleAsync(x => x.Id == redL)).OrganizacionPrincipalId);
            Assert.Equal(institucional, (await db.Mercados.AsNoTracking().SingleAsync(x => x.Id == mercadoL)).OrganizacionPrincipalId);
            Assert.Equal(3, await db.AdministrationTransfers.AsNoTracking().CountAsync(x => x.PreviousOrganizationId == liberada && x.NewOrganizationId == institucional));
        }
    }
}
