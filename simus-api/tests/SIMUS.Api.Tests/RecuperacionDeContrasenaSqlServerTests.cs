using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La recuperación de contraseña <b>contra SQL Server</b>.
/// </summary>
/// <remarks>
/// Escribe en la bitácora (<c>CK_BitacoraAuditoria_Accion</c>, <c>ISJSON</c>), en
/// <c>dbo.RestablecimientosDeContrasena</c> (V20261106_80: CHECK de vigencia, hash único, índice
/// filtrado de un solo enlace vivo) y en la cola de correo. Nada de eso lo protege el carril rápido:
/// es la lección de REC-01 y REC-02. También cubre el cambio de contraseña de la cuenta, que escribía
/// un verbo que la restricción rechaza.
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed partial class RecuperacionDeContrasenaSqlServerTests
{
    private const string Clave = "ClaveExterna123";
    private const string ClaveNueva = "FraseNuevaDeSimus#2026";
    private readonly SqlServerFixture _base;

    public RecuperacionDeContrasenaSqlServerTests(SqlServerFixture baseDesechable) => _base = baseDesechable;

    [HechoSqlServer]
    public async Task El_recorrido_completo_cumple_las_restricciones_de_la_base_y_deja_su_rastro()
    {
        var correo = await RegistrarAsync();
        var sesionAnterior = _base.CrearCliente();
        (await sesionAnterior.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var cliente = _base.CrearCliente();
        var pedido = await PostConCsrfAsync(cliente, "/api/v1/externo/auth/olvide-contrasena", new { correo });
        Assert.Equal(HttpStatusCode.Accepted, pedido.StatusCode);
        var inexistente = await PostConCsrfAsync(cliente, "/api/v1/externo/auth/olvide-contrasena", new { correo = "nadie." + Guid.NewGuid().ToString("N")[..8] + "@example.com" });
        Assert.Equal(await pedido.Content.ReadAsStringAsync(), await inexistente.Content.ReadAsStringAsync());

        var cuerpo = Convert.ToString(await _base.EscalarAsync(
            $"SELECT TOP 1 Cuerpo FROM dbo.Notificaciones WHERE CorreoDestinatario = N'{correo}' AND TipoEvento = N'RecuperacionDeContrasena' ORDER BY IdNotificacion DESC;"), CultureInfo.InvariantCulture)!;
        var testigo = TestigoEnElCuerpo().Match(cuerpo).Groups[1].Value;
        Assert.Equal(64, testigo.Length);

        // Solo el resumen está en la base, y es de 256 bits; el CHECK de vigencia y el índice de un solo enlace vivo.
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.RestablecimientosDeContrasena WHERE HashTestigo = N'{testigo}';"), CultureInfo.InvariantCulture));
        Assert.Equal(3600, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT DATEDIFF(SECOND, FechaEmision, FechaExpiracion) FROM dbo.RestablecimientosDeContrasena r JOIN dbo.Usuarios u ON u.IdUsuario = r.IdUsuario WHERE u.CorreoElectronico = N'{correo}';"), CultureInfo.InvariantCulture));

        (await PostConCsrfAsync(cliente, "/api/v1/externo/auth/restablecer-contrasena", new { testigo, nueva = ClaveNueva })).EnsureSuccessStatusCode();

        // Un solo uso, y las sesiones anteriores cerradas.
        var repetido = await PostConCsrfAsync(cliente, "/api/v1/externo/auth/restablecer-contrasena", new { testigo, nueva = "OtraFraseDistinta#2027" });
        Assert.Equal(HttpStatusCode.BadRequest, repetido.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await sesionAnterior.GetAsync("/api/v1/externo/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _base.CrearCliente().PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = ClaveNueva })).StatusCode);

        // Bitácora: los dos eventos con un verbo que admite la restricción y JSON válido, sin secretos.
        var filas = await _base.EscalarAsync(
            $@"SELECT COUNT(*) FROM dbo.BitacoraAuditoria b JOIN dbo.Usuarios u ON CAST(u.IdUsuario AS nvarchar(120)) = b.IdRegistroAfectado
               WHERE u.CorreoElectronico = N'{correo}' AND b.TablaAfectada = N'Usuarios' AND ISJSON(b.ValoresNuevos) = 1
                 AND JSON_VALUE(b.ValoresNuevos, '$.evento') IN (N'restablecimiento_solicitado', N'contrasena_restablecida');");
        Assert.Equal(2, Convert.ToInt32(filas, CultureInfo.InvariantCulture));
        Assert.Equal(0, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BitacoraAuditoria WHERE ValoresNuevos LIKE N'%{testigo}%' OR ValoresNuevos LIKE N'%{ClaveNueva}%';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Solo_hay_un_enlace_vivo_por_cuenta_aunque_el_codigo_fallara()
    {
        var correo = await RegistrarAsync();
        await PostConCsrfAsync(_base.CrearCliente(), "/api/v1/externo/auth/olvide-contrasena", new { correo });

        // El índice único filtrado lo impone la base: una segunda fila viva para la cuenta se rechaza.
        var ex = await Assert.ThrowsAnyAsync<Exception>(() => _base.EscalarAsync(
            $@"INSERT INTO dbo.RestablecimientosDeContrasena (IdUsuario, HashTestigo, FechaEmision, FechaExpiracion)
               SELECT IdUsuario, REPLICATE(N'a', 64), SYSUTCDATETIME(), DATEADD(MINUTE, 60, SYSUTCDATETIME()) FROM dbo.Usuarios WHERE CorreoElectronico = N'{correo}';"));
        Assert.Contains("UX_RestablecimientosDeContrasena_UnoVivoPorCuenta", ex.ToString(), StringComparison.Ordinal);
    }

    [HechoSqlServer]
    public async Task Cambiar_la_contrasena_desde_la_cuenta_ya_no_choca_con_la_restriccion_de_la_bitacora()
    {
        var correo = await RegistrarAsync();
        var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var cambio = await PostConCsrfAsync(cliente, "/api/v1/externo/cuenta/contrasena",
            new CambioDeContrasenaExternaSolicitud { Actual = Clave, Nueva = ClaveNueva }, "/api/v1/externo/organizaciones/csrf");
        Assert.Equal(HttpStatusCode.NoContent, cambio.StatusCode);
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $@"SELECT COUNT(*) FROM dbo.BitacoraAuditoria b JOIN dbo.Usuarios u ON CAST(u.IdUsuario AS nvarchar(120)) = b.IdRegistroAfectado
               WHERE u.CorreoElectronico = N'{correo}' AND JSON_VALUE(b.ValoresNuevos, '$.evento') = N'contrasena_cambiada';"), CultureInfo.InvariantCulture));
    }

    [HechoSqlServer]
    public async Task Otorgar_el_boletin_despues_del_alta_escribe_con_los_valores_que_admite_la_base()
    {
        var correo = await RegistrarAsync();
        var cliente = _base.CrearCliente();
        (await cliente.PostAsJsonAsync("/api/v1/externo/auth/login", new ExternalLoginRequest { Email = correo, Password = Clave })).EnsureSuccessStatusCode();

        var respuesta = await PostConCsrfAsync(cliente, "/api/v1/externo/mis-autorizaciones/boletin/otorgar", new { }, "/api/v1/externo/organizaciones/csrf");
        Assert.Equal(HttpStatusCode.OK, respuesta.StatusCode);
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.AutorizacionesDatos WHERE CorreoTitular = N'{correo}' AND Finalidad = N'boletin' AND Origen = N'cuenta' AND FechaRevocacion IS NULL;"), CultureInfo.InvariantCulture));
        Assert.Equal(1, Convert.ToInt32(await _base.EscalarAsync(
            $"SELECT COUNT(*) FROM dbo.BoletinSuscripciones WHERE CorreoElectronico = N'{correo}' AND Estado = N'activa';"), CultureInfo.InvariantCulture));
    }

    // ── Andamio ──────────────────────────────────────────────────────────────────────────────

    [GeneratedRegex(@"testigo=([0-9a-f]{64})")]
    private static partial Regex TestigoEnElCuerpo();

    private async Task<string> RegistrarAsync()
    {
        var correo = $"rec.sql.{Guid.NewGuid():N}"[..24] + "@example.com";
        (await _base.CrearCliente().PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            RegistrationType = "individual",
            FirstName = "Lucía",
            FirstSurname = "Mosquera",
            DocumentType = "cc",
            DocumentNumber = RandomNumberGenerator.GetInt32(100000000, 999999999).ToString(CultureInfo.InvariantCulture),
            Phone = "3001234567",
            Email = correo,
            Password = Clave,
            PoliticasAceptadas = ["tratamiento", "terminos"],
        })).EnsureSuccessStatusCode();
        return correo;
    }

    private static async Task<HttpResponseMessage> PostConCsrfAsync(HttpClient cliente, string ruta, object cuerpo, string rutaDelTestigo = "/api/v1/externo/auth/csrf")
    {
        var testigo = (await cliente.GetFromJsonAsync<ExternalCsrfTokenResponse>(rutaDelTestigo))!.RequestToken;
        var mensaje = new HttpRequestMessage(HttpMethod.Post, ruta) { Content = JsonContent.Create(cuerpo) };
        mensaje.Headers.Add("X-CSRF-TOKEN", testigo);
        return await cliente.SendAsync(mensaje);
    }
}
