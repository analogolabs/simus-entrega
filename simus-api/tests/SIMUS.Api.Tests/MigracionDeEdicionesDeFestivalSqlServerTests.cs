using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// La migración que renombra las columnas «versión» de Festivales a «edición»
/// CONSERVA LOS DATOS que ya hay, y se puede repetir.
/// </summary>
/// <remarks>
/// <para>
/// POR QUÉ NO BASTA CON LA FIXTURE. La fixture de SQL Server aplica TODO el esquema sobre tablas
/// vacías: un renombrado que funcione ahí puede fallar sobre una base con datos y restricciones. De hecho
/// SQL Server no deja renombrar una columna que usa una restricción CHECK («participates in enforced
/// dependencies»), y eso solo lo dice el motor.
/// </para>
/// <para>
/// LO QUE HACE. Crea una base desechable, le aplica todos los guiones de <c>schema/</c> MENOS el de
/// ediciones (la base «de antes»), mete un Festival, una solicitud de participación y mira el permiso con
/// los nombres antiguos, aplica el guion y comprueba: las columnas nuevas existen con los mismos valores,
/// las antiguas no, las restricciones están «de confianza» y siguen rechazando lo que rechazaban, el JSON
/// de la solicitud tiene la clave nueva, el permiso cambió de nombre, y un segundo paso no cambia nada.
/// </para>
/// </remarks>
public sealed class MigracionDeEdicionesDeFestivalSqlServerTests
{
    private const string GuionDeEdiciones = "V20261112_10__ediciones_en_lugar_de_versiones_de_festival.sql";

    private static readonly Regex SeparadorDeLotes = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [HechoSqlServer]
    public async Task Renombrar_Las_Columnas_Conserva_Los_Datos_Y_Se_Puede_Repetir()
    {
        var cadenaMaestra = ArnesSqlServer.CadenaMaestra();
        var nombreBase = ArnesSqlServer.NuevoNombreDeBase();
        ArnesSqlServer.ExigirNombreDesechable(nombreBase);
        var cadena = ArnesSqlServer.CadenaHacia(cadenaMaestra, nombreBase);

        await EjecutarAsync(cadenaMaestra, $"CREATE DATABASE [{nombreBase}];");
        try
        {
            // 1) La base «de antes»: todo el esquema menos el guion de ediciones.
            var directorio = RutasDelRepositorio.Esquema();
            var guiones = Directory.GetFiles(directorio, "*.sql")
                .OrderBy(ruta => Path.GetFileName(ruta), StringComparer.Ordinal)
                .ToList();
            var delGuion = guiones.Single(ruta => Path.GetFileName(ruta) == GuionDeEdiciones);
            foreach (var guion in guiones.Where(ruta => ruta != delGuion))
            {
                await AplicarAsync(cadena, guion);
            }

            // Sobre la base «de antes» las columnas tienen los nombres antiguos.
            Assert.Equal(1, await EscalarAsync(cadena, "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Festivales') AND name = N'NumeroVersiones'"));

            // 2) Datos con los nombres antiguos: un Festival (las columnas obligatorias con un valor por
            //    omisión razonable según su tipo), una solicitud de participación y el permiso.
            await EjecutarAsync(cadena, InsertarFestivalConNombresAntiguos());
            await EjecutarAsync(cadena, @"
INSERT INTO dbo.Participaciones (Referencia, FechaEnvio, TipoActor, NombreActor, CorreoElectronico, Departamento, Municipio, DatosFormularioJson)
VALUES (N'H1-REF', SYSUTCDATETIME(), N'agrupacion', N'Nombre', N'a@b.test', N'05', N'05001', N'{""festivalFrequency"":""anual"",""festivalVersions"":""12""}');");
            Assert.Equal("Normalizar versiones", await EscalarAsync(cadena, "SELECT NombrePermiso FROM dbo.Permisos WHERE CodigoPermiso = N'festivales.normalizar'"));

            // 3) El guion, dos veces: la segunda no cambia nada.
            await AplicarAsync(cadena, delGuion);
            var firma1 = await FirmaAsync(cadena);
            await AplicarAsync(cadena, delGuion);
            var firma2 = await FirmaAsync(cadena);
            Assert.Equal(firma1, firma2);

            // 4) Las columnas nuevas existen con los mismos valores; las antiguas ya no.
            foreach (var antigua in new[] { "NumeroVersiones", "FechaUltimaVersion", "TieneVersionVigenteAnoActual", "EstadoVersionAnoActual", "FechaInicioVersionActual", "FechaFinVersionActual" })
            {
                Assert.Equal(0, await EscalarAsync(cadena, $"SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Festivales') AND name = N'{antigua}'"));
            }
            Assert.Equal(7, await EscalarAsync(cadena, "SELECT NumeroEdiciones FROM dbo.Festivales WHERE NombreFestival = N'H1-FESTIVAL'"));
            Assert.Equal("2025-05-01", ((DateTime)(await EscalarAsync(cadena, "SELECT FechaUltimaEdicion FROM dbo.Festivales WHERE NombreFestival = N'H1-FESTIVAL'"))!).ToString("yyyy-MM-dd"));
            Assert.Equal(true, await EscalarAsync(cadena, "SELECT TieneEdicionVigenteAnoActual FROM dbo.Festivales WHERE NombreFestival = N'H1-FESTIVAL'"));
            Assert.Equal("Confirmado", await EscalarAsync(cadena, "SELECT EstadoEdicionAnoActual FROM dbo.Festivales WHERE NombreFestival = N'H1-FESTIVAL'"));
            Assert.Equal("2026-01-01", ((DateTime)(await EscalarAsync(cadena, "SELECT FechaInicioEdicionActual FROM dbo.Festivales WHERE NombreFestival = N'H1-FESTIVAL'"))!).ToString("yyyy-MM-dd"));

            // 5) Las restricciones: con el nombre nuevo, «de confianza» y rechazando lo mismo que antes.
            Assert.Equal(2, await EscalarAsync(cadena, "SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.Festivales') AND name IN (N'CK_Festivales_NumeroEdiciones', N'CK_Festivales_FechasEdicionActual') AND is_not_trusted = 0"));
            Assert.Equal(0, await EscalarAsync(cadena, "SELECT COUNT(*) FROM sys.objects WHERE parent_object_id = OBJECT_ID(N'dbo.Festivales') AND (name LIKE N'%NumeroVersiones%' OR name LIKE N'%FechasVersionActual%' OR name LIKE N'%TieneVersionVigente%')"));
            Assert.Equal(1, await EscalarAsync(cadena, "SELECT COUNT(*) FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.Festivales') AND name = N'DF_Festivales_TieneEdicionVigente'"));
            await Assert.ThrowsAsync<SqlException>(() => EjecutarAsync(cadena, "UPDATE dbo.Festivales SET NumeroEdiciones = -1 WHERE NombreFestival = N'H1-FESTIVAL'"));
            await Assert.ThrowsAsync<SqlException>(() => EjecutarAsync(cadena, "UPDATE dbo.Festivales SET FechaInicioEdicionActual = '2026-03-01', FechaFinEdicionActual = '2026-02-01' WHERE NombreFestival = N'H1-FESTIVAL'"));

            // 6) El JSON de la solicitud lleva la clave nueva y conserva lo demás; el permiso cambió de nombre.
            var json = (string)(await EscalarAsync(cadena, "SELECT DatosFormularioJson FROM dbo.Participaciones WHERE Referencia = N'H1-REF'"))!;
            Assert.Contains("\"festivalEditions\":\"12\"", json);
            Assert.DoesNotContain("festivalVersions", json);
            Assert.Contains("\"festivalFrequency\":\"anual\"", json);
            Assert.Equal("Normalizar ediciones", await EscalarAsync(cadena, "SELECT NombrePermiso FROM dbo.Permisos WHERE CodigoPermiso = N'festivales.normalizar'"));
        }
        finally
        {
            await EjecutarAsync(
                cadenaMaestra,
                $"IF DB_ID(N'{nombreBase}') IS NOT NULL BEGIN ALTER DATABASE [{nombreBase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{nombreBase}]; END");
        }
    }

    /// <summary>
    /// INSERT de un Festival con los nombres ANTIGUOS: las columnas obligatorias sin valor por omisión se
    /// rellenan según su tipo, y las de «versión» llevan valores concretos que luego se vuelven a leer.
    /// </summary>
    private static string InsertarFestivalConNombresAntiguos() => @"
-- Las claves foraneas se apagan para esta fila de prueba (apuntan a organizaciones que aqui no existen):
-- lo que se mide es el renombrado y sus restricciones CHECK, que siguen encendidas.
DECLARE @apagar nvarchar(max) = (SELECT STRING_AGG(CAST(N'ALTER TABLE dbo.Festivales NOCHECK CONSTRAINT ' + QUOTENAME(name) AS nvarchar(max)), N';')
                                   FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Festivales'));
IF @apagar IS NOT NULL EXEC (@apagar);
DECLARE @columnas nvarchar(max), @valores nvarchar(max);
SELECT @columnas = STRING_AGG(CAST(QUOTENAME(c.name) AS nvarchar(max)), N','),
       @valores  = STRING_AGG(CAST(CASE
            WHEN c.name = N'NombreFestival' THEN N'N''H1-FESTIVAL'''
            WHEN c.name = N'EstadoRegistro' THEN N'N''borrador'''
            WHEN c.name = N'NivelCobertura' THEN N'N''nacional'''
            WHEN t.name IN (N'nvarchar', N'varchar', N'nchar', N'char') THEN N'N''x'''
            WHEN t.name IN (N'int', N'bigint', N'smallint', N'tinyint', N'decimal', N'numeric') THEN N'1'
            WHEN t.name = N'bit' THEN N'0'
            WHEN t.name IN (N'date', N'datetime', N'datetime2', N'smalldatetime') THEN N'SYSUTCDATETIME()'
            WHEN t.name = N'uniqueidentifier' THEN N'NEWID()'
            ELSE N'NULL' END AS nvarchar(max)), N',')
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  LEFT JOIN sys.default_constraints d ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
 WHERE c.object_id = OBJECT_ID(N'dbo.Festivales')
   AND c.is_nullable = 0 AND c.is_identity = 0 AND c.is_computed = 0 AND d.object_id IS NULL
   AND t.name <> N'timestamp'
   AND c.name NOT IN (N'TieneVersionVigenteAnoActual');
DECLARE @sql nvarchar(max) = N'INSERT INTO dbo.Festivales (' + @columnas + N', NumeroVersiones, FechaUltimaVersion, TieneVersionVigenteAnoActual, EstadoVersionAnoActual, FechaInicioVersionActual, FechaFinVersionActual) VALUES ('
    + @valores + N', 7, ''2025-05-01'', 1, N''Confirmado'', ''2026-01-01'', ''2026-01-03'');';
EXEC sys.sp_executesql @sql;";

    /// <summary>Una firma del estado de las restricciones y columnas: si dos pasos dan lo mismo, el segundo no cambió nada.</summary>
    private static async Task<string> FirmaAsync(string cadena)
    {
        var filas = new List<string>();
        await using var conexion = new SqlConnection(cadena);
        await conexion.OpenAsync();
        await using var comando = conexion.CreateCommand();
        comando.CommandText = @"
SELECT name + N'|' + CAST(is_not_trusted AS nvarchar(5)) FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.Festivales')
UNION ALL SELECT name FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.Festivales')
UNION ALL SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Festivales')
ORDER BY 1";
        await using var lector = await comando.ExecuteReaderAsync();
        while (await lector.ReadAsync())
        {
            filas.Add(lector.GetString(0));
        }
        return string.Join(";", filas);
    }

    private static async Task AplicarAsync(string cadena, string guion)
    {
        var texto = await File.ReadAllTextAsync(guion);
        var numero = 0;
        foreach (var lote in SeparadorDeLotes.Split(texto))
        {
            numero++;
            if (string.IsNullOrWhiteSpace(lote))
            {
                continue;
            }

            try
            {
                await EjecutarAsync(cadena, lote);
            }
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
        comando.CommandTimeout = 60;
        comando.CommandText = sql;
        var valor = await comando.ExecuteScalarAsync();
        return valor == DBNull.Value ? null : valor;
    }
}
