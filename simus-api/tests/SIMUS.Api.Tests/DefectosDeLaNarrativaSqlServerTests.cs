using System.Globalization;
using System.Net.Http.Json;
using SIMUS.Contracts;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// D-05 contra SQL Server: el alta de una cuenta y de su organización deja sus líneas en la bitácora.
/// </summary>
/// <remarks>
/// EN EL CARRIL DE SQL SERVER Y NO SOLO EN SQLITE porque <c>CK_BitacoraAuditoria_Accion</c> solo existe en el motor real:
/// una línea con un verbo que la restricción no admite hace fallar TODO el registro, y SQLite no lo vería. Es la
/// lección de siempre de este archivo de pruebas: el carril rápido no puede desmentirte sobre restricciones que su
/// base no tiene.
/// </remarks>
[Collection(ColeccionSqlServer.Nombre)]
public sealed class DefectosDeLaNarrativaSqlServerTests
{
    private readonly SqlServerFixture _base;

    public DefectosDeLaNarrativaSqlServerTests(SqlServerFixture baseDeDatos) => _base = baseDeDatos;

    [HechoSqlServer]
    public async Task Registrarse_deja_en_la_bitacora_el_alta_de_la_cuenta_y_de_la_organizacion_sin_romper_el_CHECK()
    {
        using var cliente = _base.CrearCliente();
        var par = Convert.ToString(await _base.EscalarAsync(
            "SELECT TOP 1 CONCAT(RTRIM(CodigoDepartamento), '/', RTRIM(CodigoMunicipio)) FROM dbo.Divipola ORDER BY CodigoMunicipio;"))!.Split('/');

        var registro = await cliente.PostAsJsonAsync("/api/v1/externo/auth/register", new ExternalRegisterRequest
        {
            OrganizationName = "Organización de la bitácora",
            FullName = "Responsable de la bitácora",
            NumeroDocumento = "1020304099",
            Phone = "3000000003",
            Email = "bitacora.alta@example.com",
            Password = "ClaveExterna123",
            HeadquartersDepartmentCode = par[0],
            HeadquartersMunicipalityCode = par[1],
            PoliticasAceptadas = ["tratamiento", "terminos"],
        });
        registro.EnsureSuccessStatusCode();
        var cuenta = await registro.Content.ReadFromJsonAsync<ExternalRegisterResponse>();
        var usuario = int.Parse(cuenta!.UserId, CultureInfo.InvariantCulture);
        var organizacion = int.Parse(cuenta.OrganizationId!, CultureInfo.InvariantCulture);

        int Contar(object? valor) => Convert.ToInt32(valor, CultureInfo.InvariantCulture);
        Assert.Equal(1, Contar(await _base.EscalarAsync(
            "SELECT COUNT(1) FROM dbo.BitacoraAuditoria WHERE Accion = N'crear' AND TablaAfectada = N'Usuarios' "
            + $"AND IdUsuario = {usuario} AND IdRegistroAfectado = N'{usuario}' AND ValoresNuevos LIKE N'%CuentaRegistrada%';")));
        Assert.Equal(1, Contar(await _base.EscalarAsync(
            "SELECT COUNT(1) FROM dbo.BitacoraAuditoria WHERE Accion = N'crear_organizacion' AND TablaAfectada = N'Entidades' "
            + $"AND IdUsuario = {usuario} AND IdRegistroAfectado = N'{organizacion}' AND ValoresNuevos LIKE N'%OrganizacionRegistrada%';")));
        Assert.Equal(1, Contar(await _base.EscalarAsync(
            "SELECT COUNT(1) FROM dbo.BitacoraAuditoria WHERE Accion = N'asignar_administrador_inicial' AND TablaAfectada = N'Entidades' "
            + $"AND IdUsuario = {usuario} AND IdRegistroAfectado = N'{organizacion}';")));
    }
}
