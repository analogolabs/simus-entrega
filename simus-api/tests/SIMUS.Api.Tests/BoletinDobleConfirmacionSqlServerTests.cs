using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// S-10: la migración <c>V20261120_40</c> (doble confirmación del boletín) contra SQL Server real.
/// </summary>
/// <remarks>
/// Arma la base «de antes» (todo el esquema menos la migración), siembra una suscripción anterior y
/// comprueba: respaldo previo, columnas nuevas, la fila anterior queda confirmada, una fila nueva sin
/// decir nada entra SIN confirmar, el índice del enlace es único e idempotencia (segunda ejecución sin cambios).
/// </remarks>
public sealed class BoletinDobleConfirmacionSqlServerTests
{
    private const string Migracion = "V20261120_40__boletin_doble_confirmacion.sql";

    private static readonly Regex SeparadorDeLotes = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [HechoSqlServer]
    public async Task La_migracion_respalda_conserva_lo_anterior_y_las_filas_nuevas_nacen_sin_confirmar()
    {
        var cadenaMaestra = ArnesSqlServer.CadenaMaestra();
        var nombreBase = ArnesSqlServer.NuevoNombreDeBase();
        ArnesSqlServer.ExigirNombreDesechable(nombreBase);
        var cadena = ArnesSqlServer.CadenaHacia(cadenaMaestra, nombreBase);

        await EjecutarAsync(cadenaMaestra, $"CREATE DATABASE [{nombreBase}];");
        try
        {
            var guiones = Directory.GetFiles(RutasDelRepositorio.Esquema(), "*.sql")
                .OrderBy(ruta => Path.GetFileName(ruta), StringComparer.Ordinal).ToList();
            var migracion = guiones.Single(ruta => Path.GetFileName(ruta) == Migracion);
            foreach (var guion in guiones.Where(ruta => ruta != migracion)) await AplicarAsync(cadena, guion);

            Assert.Null(await EscalarAsync(cadena, "SELECT COL_LENGTH(N'dbo.BoletinSuscripciones', N'Confirmada')"));
            await EjecutarAsync(cadena,
                "INSERT INTO dbo.BoletinSuscripciones (CorreoElectronico, Origen, Estado, FechaAlta) VALUES (N'anterior@correo.test', N'portada', N'activa', SYSUTCDATETIME())");

            await AplicarAsync(cadena, migracion);

            // Respaldo con la fila de antes, y la fila anterior sigue contando.
            Assert.Equal(1, await EscalarAsync(cadena, "SELECT COUNT(*) FROM respaldo.BoletinSuscripciones_V20261120_40"));
            Assert.Equal(1, await EscalarAsync(cadena, "SELECT CAST(Confirmada AS int) FROM dbo.BoletinSuscripciones WHERE CorreoElectronico = N'anterior@correo.test'"));
            Assert.Null(await EscalarAsync(cadena, "SELECT FechaConfirmacion FROM dbo.BoletinSuscripciones WHERE CorreoElectronico = N'anterior@correo.test'"));

            // Una alta nueva que no dice nada es una solicitud.
            await EjecutarAsync(cadena,
                "INSERT INTO dbo.BoletinSuscripciones (CorreoElectronico, Origen, Estado, FechaAlta, HashTestigo, FechaEmisionTestigo) VALUES (N'nuevo@correo.test', N'portada', N'activa', SYSUTCDATETIME(), N'abc', SYSUTCDATETIME())");
            Assert.Equal(0, await EscalarAsync(cadena, "SELECT CAST(Confirmada AS int) FROM dbo.BoletinSuscripciones WHERE CorreoElectronico = N'nuevo@correo.test'"));

            // El enlace es unico: dos filas no pueden compartir hash.
            await Assert.ThrowsAsync<SqlException>(() => EjecutarAsync(cadena,
                "INSERT INTO dbo.BoletinSuscripciones (CorreoElectronico, Origen, Estado, FechaAlta, HashTestigo) VALUES (N'otro@correo.test', N'portada', N'activa', SYSUTCDATETIME(), N'abc')"));

            // Idempotente: segunda ejecucion, nada cambia.
            var antes = await EscalarAsync(cadena, "SELECT CONCAT(COUNT(*), N'/', SUM(CAST(Confirmada AS int))) FROM dbo.BoletinSuscripciones");
            await AplicarAsync(cadena, migracion);
            Assert.Equal(antes, await EscalarAsync(cadena, "SELECT CONCAT(COUNT(*), N'/', SUM(CAST(Confirmada AS int))) FROM dbo.BoletinSuscripciones"));
            Assert.Equal(1, await EscalarAsync(cadena, "SELECT COUNT(*) FROM respaldo.BoletinSuscripciones_V20261120_40"));
        }
        finally
        {
            await EjecutarAsync(
                cadenaMaestra,
                $"IF DB_ID(N'{nombreBase}') IS NOT NULL BEGIN ALTER DATABASE [{nombreBase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{nombreBase}]; END");
        }
    }

    private static async Task AplicarAsync(string cadena, string guion)
    {
        var texto = await File.ReadAllTextAsync(guion);
        var numero = 0;
        foreach (var lote in SeparadorDeLotes.Split(texto))
        {
            numero++;
            if (string.IsNullOrWhiteSpace(lote)) continue;
            try { await EjecutarAsync(cadena, lote); }
            catch (SqlException excepcion)
            {
                throw new InvalidOperationException($"Fallo el lote {numero} de {Path.GetFileName(guion)}: {excepcion.Message}", excepcion);
            }
        }
    }

    [SuppressMessage("Security", "CA2100:Review SQL queries for security vulnerabilities", Justification = "Solo recibe SQL constante de esta prueba versionada, contra una base desechable.")]
    private static async Task EjecutarAsync(string cadena, string sql)
    {
        await using var conexion = new SqlConnection(cadena);
        await conexion.OpenAsync();
        await using var comando = conexion.CreateCommand();
        comando.CommandTimeout = 180;
        comando.CommandText = sql;
        await comando.ExecuteNonQueryAsync();
    }

    [SuppressMessage("Security", "CA2100:Review SQL queries for security vulnerabilities", Justification = "Solo recibe SQL constante de esta prueba versionada, contra una base desechable.")]
    private static async Task<object?> EscalarAsync(string cadena, string sql)
    {
        await using var conexion = new SqlConnection(cadena);
        await conexion.OpenAsync();
        await using var comando = conexion.CreateCommand();
        comando.CommandText = sql;
        var valor = await comando.ExecuteScalarAsync();
        return valor is DBNull ? null : valor;
    }
}
