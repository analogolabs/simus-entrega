using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SIMUS.Contracts;
using SIMUS.Infrastructure.Data;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// El bloqueo por cuenta (S-07) y la generación de sesión (S-11) contra SQL Server de verdad: la migración
/// <c>V20261120_30</c> crea lo que dice, se puede correr dos veces, su reversa deja el esquema como estaba y el bloqueo y el
/// cierre de sesión funcionan sobre la base real y no solo sobre el SQLite del carril rápido.
/// </summary>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class BloqueoPorCuentaSqlServerTests
{
    private const string Migracion = "V20261120_30__bloqueo_por_cuenta_y_generacion_de_sesion.sql";
    private const string CorreoWebmaster = "bloqueo.webmaster@pnmc.local";
    private const string ClaveWebmaster = "PnmcBloqueoWebmaster123";
    private const string ClaveGestor = "ClaveDeGestor.2026-ok";

    private static readonly Regex SeparadorDeLotes = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly SqlServerFixture _base;

    public BloqueoPorCuentaSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    private async Task<int> EnteroAsync(string sql) => Convert.ToInt32(await _base.EscalarAsync(sql), CultureInfo.InvariantCulture);

    [HechoSqlServer]
    public async Task La_migracion_crea_la_tabla_la_columna_y_su_indice_y_se_puede_correr_dos_veces()
    {
        Assert.Equal(1, await EnteroAsync("SELECT COUNT(*) FROM sys.tables WHERE name = N'IntentosDeIngresoFallidos' AND schema_id = SCHEMA_ID(N'dbo')"));
        Assert.Equal(1, await EnteroAsync("SELECT COUNT(*) FROM sys.check_constraints WHERE name = N'CK_IntentosDeIngresoFallidos_Canal'"));
        Assert.Equal(2, await EnteroAsync("SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.IntentosDeIngresoFallidos') AND name IN (N'IX_IntentosDeIngresoFallidos_Cuenta', N'IX_IntentosDeIngresoFallidos_Fecha')"));
        Assert.Equal(1, await EnteroAsync("SELECT COUNT(*) FROM sys.default_constraints WHERE name = N'DF_Usuarios_GeneracionDeSesion'"));
        Assert.Equal(0, await EnteroAsync("SELECT COUNT(*) FROM dbo.Usuarios WHERE GeneracionDeSesion IS NULL"));

        // Una huella que no es de 64 caracteres o un canal inventado no entran.
        await Assert.ThrowsAsync<SqlException>(() => EjecutarAsync(
            "INSERT INTO dbo.IntentosDeIngresoFallidos (Canal, HuellaDeCuenta, FechaIntento) VALUES (N'otro', REPLICATE(N'a', 64), SYSUTCDATETIME())"));

        // IDEMPOTENTE: volver a aplicarla no cambia nada ni falla.
        var antes = await EnteroAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Usuarios')");
        await AplicarAsync(Path.Combine(RutasDelRepositorio.Esquema(), Migracion));
        await AplicarAsync(Path.Combine(RutasDelRepositorio.Esquema(), Migracion));
        Assert.Equal(antes, await EnteroAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Usuarios')"));
    }

    [HechoSqlServer]
    public async Task La_reversa_quita_lo_que_la_migracion_puso_y_no_toca_nada_mas()
    {
        var reversa = await File.ReadAllTextAsync(Path.Combine(RutasDelRepositorio.Raiz(), "simus-database", "scripts",
            "reversa_bloqueo_por_cuenta_y_generacion_de_sesion.sql"));

        // Dentro de una transacción que se deshace: se mide el efecto sin dejar la base sin la columna.
        var resultado = await _base.EscalarAsync(
            "BEGIN TRANSACTION;\n" + reversa + "\n"
            + "DECLARE @quedo int = CASE WHEN OBJECT_ID(N'dbo.IntentosDeIngresoFallidos') IS NULL "
            + "AND COL_LENGTH(N'dbo.Usuarios', N'GeneracionDeSesion') IS NULL THEN 1 ELSE 0 END;\n"
            + "WHILE @@TRANCOUNT > 0 ROLLBACK TRANSACTION;\n"
            + "SELECT @quedo;");

        Assert.Equal(1, Convert.ToInt32(resultado, CultureInfo.InvariantCulture));
        Assert.Equal(1, await EnteroAsync("SELECT COUNT(*) FROM sys.tables WHERE name = N'IntentosDeIngresoFallidos'"));
        Assert.NotEqual(0, await EnteroAsync("SELECT COALESCE(COL_LENGTH(N'dbo.Usuarios', N'GeneracionDeSesion'), 0)"));
    }

    [HechoSqlServer]
    public async Task Cinco_fallos_bloquean_la_cuenta_en_SQL_Server_y_el_webmaster_la_desbloquea()
    {
        var webmaster = await SesionDeWebmasterAsync();
        var correo = $"bloqueo.sql.{Guid.NewGuid():N}@pnmc.local";
        (await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            FullName = "Gestor del bloqueo", Email = correo, Roles = ["gestor_interno"], Password = ClaveGestor, IsActive = true,
        })).EnsureSuccessStatusCode();

        using var cliente = _base.CrearCliente();
        for (var i = 0; i < 5; i++)
        {
            var fallo = await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = correo, Password = $"mala-{i}" });
            Assert.Equal(HttpStatusCode.Unauthorized, fallo.StatusCode);
        }

        var bloqueada = await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = correo, Password = ClaveGestor });
        Assert.Equal(HttpStatusCode.TooManyRequests, bloqueada.StatusCode);

        // Lo que queda en la base es la huella, nunca el correo.
        Assert.Equal(5, await EnteroAsync("SELECT COUNT(*) FROM dbo.IntentosDeIngresoFallidos WHERE Canal = N'consola' AND HuellaDeCuenta = "
            + $"N'{SIMUS.Api.Security.BloqueoDeIngresoPorCuenta.HuellaDe("consola", correo)}'"));
        Assert.Equal(0, await EnteroAsync($"SELECT COUNT(*) FROM dbo.IntentosDeIngresoFallidos WHERE HuellaDeCuenta LIKE N'%{correo}%'"));

        // El webmaster restablece la clave: la cuenta entra de inmediato y los fallos desaparecen.
        var lista = await webmaster.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/v1/admin/auth/users");
        var id = lista.EnumerateArray()
            .First(u => string.Equals(u.GetProperty("email").GetString(), correo, StringComparison.OrdinalIgnoreCase))
            .GetProperty("id").GetString();
        (await webmaster.PostAsJsonAsync("/api/v1/admin/auth/users", new AdminUserUpsertRequest
        {
            Id = id, FullName = "Gestor del bloqueo", Email = correo, Roles = ["gestor_interno"], Password = "OtraClaveDeGestor.2026-ok", IsActive = true,
        })).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login",
            new AdminLoginRequest { Email = correo, Password = "OtraClaveDeGestor.2026-ok" })).StatusCode);
        Assert.Equal(0, await EnteroAsync("SELECT COUNT(*) FROM dbo.IntentosDeIngresoFallidos WHERE Canal = N'consola' AND HuellaDeCuenta = "
            + $"N'{SIMUS.Api.Security.BloqueoDeIngresoPorCuenta.HuellaDe("consola", correo)}'"));
    }

    [HechoSqlServer]
    public async Task Cerrar_sesion_sube_la_generacion_en_la_base_y_deja_sin_valor_la_cookie_copiada()
    {
        await SembrarWebmasterAsync();
        using var dueno = _base.CrearCliente();
        var login = await dueno.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = CorreoWebmaster, Password = ClaveWebmaster });
        login.EnsureSuccessStatusCode();
        var cookie = login.Headers.GetValues("Set-Cookie").First(v => v.StartsWith("simus.admin=", StringComparison.Ordinal)).Split(';')[0];

        var antes = await EnteroAsync($"SELECT GeneracionDeSesion FROM dbo.Usuarios WHERE CorreoElectronico = N'{CorreoWebmaster}'");

        using var ladron = _base.CrearCliente();
        using (var viva = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/csrf"))
        {
            viva.Headers.Add("Cookie", cookie);
            Assert.Equal(HttpStatusCode.OK, (await ladron.SendAsync(viva)).StatusCode);
        }

        (await dueno.PostAsync("/api/v1/admin/auth/logout", content: null)).EnsureSuccessStatusCode();

        Assert.Equal(antes + 1, await EnteroAsync($"SELECT GeneracionDeSesion FROM dbo.Usuarios WHERE CorreoElectronico = N'{CorreoWebmaster}'"));
        using var muerta = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/csrf");
        muerta.Headers.Add("Cookie", cookie);
        Assert.Equal(HttpStatusCode.Unauthorized, (await ladron.SendAsync(muerta)).StatusCode);
    }

    // ---------- Andamio ----------------------------------------------------------

    private async Task<HttpClient> SesionDeWebmasterAsync()
    {
        await SembrarWebmasterAsync();
        var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/admin/auth/login", new AdminLoginRequest { Email = CorreoWebmaster, Password = ClaveWebmaster }))
            .EnsureSuccessStatusCode();
        var testigo = await cliente.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/v1/admin/csrf");
        cliente.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        cliente.DefaultRequestHeaders.Add("X-CSRF-TOKEN", testigo.GetProperty("requestToken").GetString());
        return cliente;
    }

    private async Task SembrarWebmasterAsync()
    {
        using var alcance = _base.Services.CreateScope();
        var db = alcance.ServiceProvider.GetRequiredService<SimusDbContext>();
        if (await db.Users.AsNoTracking().AnyAsync(item => item.Email == CorreoWebmaster))
        {
            return;
        }

        var idWebmaster = await db.Roles.AsNoTracking().Where(rol => rol.Name == "webmaster").Select(rol => rol.Id).FirstAsync();
        var usuario = new UserRow { FullName = "Webmaster del bloqueo", Email = CorreoWebmaster, IsActive = true, CreatedAt = DateTime.UtcNow };
        usuario.PasswordHash = SIMUS.Api.Endpoints.AdminAuthEndpoints.HashPassword(usuario, ClaveWebmaster);
        db.Users.Add(usuario);
        await db.SaveChangesAsync();
        await RolesEnPruebas.AsignarPorIdAsync(db, usuario.Id, [idWebmaster]);
    }

    private async Task AplicarAsync(string guion)
    {
        foreach (var lote in SeparadorDeLotes.Split(await File.ReadAllTextAsync(guion)))
        {
            if (!string.IsNullOrWhiteSpace(lote))
            {
                await EjecutarAsync(lote);
            }
        }
    }

    [SuppressMessage("Security", "CA2100:Review SQL queries for security vulnerabilities", Justification = "Solo recibe SQL constante de esta prueba versionada, contra una base desechable.")]
    private async Task EjecutarAsync(string sql)
    {
        await using var conexion = new SqlConnection(_base.CadenaDeConexion);
        await conexion.OpenAsync();
        await using var comando = conexion.CreateCommand();
        comando.CommandTimeout = 120;
        comando.CommandText = sql;
        await comando.ExecuteNonQueryAsync();
    }
}
