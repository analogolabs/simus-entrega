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
/// Registrar un Festival desde la consola con «Todavía no se sabe» <b>contra SQL Server</b>.
/// </summary>
/// <remarks>
/// <para>
///. El paso 1 del alta recomienda «Todavía no se sabe» para los Festivales históricos y
/// la API respondía 500: mandaba <c>OrganizacionPrincipalId = NULL</c> a una columna que
/// V20260825_02 dejó NOT NULL. El carril rápido es SQLite, que fabrica la tabla desde el modelo de EF
/// —donde la propiedad es anulable—, así que la prueba equivalente de allí pasaba en verde.
/// </para>
/// <para>
/// LA REGLA QUE SE APLICA ES LA DE AQUELLA MIGRACIÓN: mientras ninguna organización lo reclame,
/// responde la institución.
/// </para>
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class AltaDeFestivalSinOrganizacionSqlServerTests
{
    private readonly SqlServerFixture _base;

    public AltaDeFestivalSinOrganizacionSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task Todavia_no_se_sabe_registra_el_Festival_a_cargo_de_la_institucion()
    {
        var correo = $"alta.festival.{Guid.NewGuid():N}@pnmc.local";
        const string clave = "AltaDeFestivalSegura123";
        var institucional = await SembrarWebmasterEInstitucionAsync(correo, clave);

        using var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest
        {
            Email = correo,
            Password = clave,
        })).EnsureSuccessStatusCode();
        await CmsTestClient.AttachCsrfAsync(cliente);

        var respuesta = await cliente.PostAsJsonAsync("/api/v1/admin/festivales", new
        {
            festival = new
            {
                nombre = $"Festival histórico {Guid.NewGuid():N}",
                nivelCobertura = "municipal",
                codigoDepartamento = "05",
                codigoMunicipio = "05001",
                practicasMusicalesIds = Array.Empty<int>(),
                territoriosSonorosIds = Array.Empty<int>(),
            },
            organizacionResponsableId = (int?)null,
        });

        Assert.True(
            respuesta.StatusCode == HttpStatusCode.Created,
            $"POST /admin/festivales respondió {(int)respuesta.StatusCode}: {await respuesta.Content.ReadAsStringAsync()}");

        var creado = await respuesta.Content.ReadFromJsonAsync<JsonElement>();
        var id = creado.GetProperty("id").GetString();
        var responsable = Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT OrganizacionPrincipalId FROM dbo.Festivales WHERE IdFestival = {id};"),
            CultureInfo.InvariantCulture);
        Assert.Equal(institucional, responsable);
    }

    private async Task<int> SembrarWebmasterEInstitucionAsync(string correo, string clave)
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        var idWebmaster = await db.Roles.AsNoTracking()
            .Where(item => item.Name == "webmaster")
            .Select(item => item.Id)
            .SingleAsync();
        var usuario = new UserRow
        {
            FullName = "Webmaster del alta de Festivales",
            Email = correo,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        usuario.PasswordHash = AdminAuthEndpoints.HashPassword(usuario, clave);
        db.Users.Add(usuario);
        await db.SaveChangesAsync();
        await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);

        var institucional = await db.EntityProfiles.AsNoTracking()
            .Where(item => item.IsInstitutional)
            .Select(item => (int?)item.Id)
            .FirstOrDefaultAsync();
        if (institucional is { } existente) return existente;

        var entidad = new EntityProfileRow
        {
            EntityType = "organizacion",
            Name = "Plan Nacional de Música para la Convivencia",
            StatusCode = "activa",
            IsActive = true,
            IsInstitutional = true,
            CreatedByUserId = usuario.Id,
            ResponsibleUserId = usuario.Id,
            CreatedAt = DateTime.UtcNow,
        };
        db.EntityProfiles.Add(entidad);
        await db.SaveChangesAsync();
        return entidad.Id;
    }
}
