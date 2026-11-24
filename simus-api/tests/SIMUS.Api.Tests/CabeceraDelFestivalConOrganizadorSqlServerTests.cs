using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// PR-1 del retiro de <c>dbo.PerfilesPublicosFestival</c>: la migración <c>V20261119_10</c> añade a
/// <c>dbo.Festivales</c> los cinco datos del organizador, rellena solo esas columnas desde el perfil vigente
/// aprobado, se puede repetir, y los guiones de respaldo y validación funcionan sobre datos.
/// </summary>
/// <remarks>
/// <para>
/// POR QUÉ NO BASTA CON LA FIXTURE: aplica todo el esquema sobre tablas vacías, y el relleno solo se mide
/// con datos previos. Esta prueba arma la base «de antes» (todo el esquema MENOS este guion), siembra
/// Festivales y perfiles, aplica el guion dos veces y comprueba qué quedó en la cabecera.
/// </para>
/// <para>
/// LO QUE DEBE QUEDAR DICHO: la migración es ADITIVA. No cambia el perfil ni ninguna columna existente de la
/// cabecera; la prueba lo mide con una firma de ambas tablas antes y después.
/// </para>
/// </remarks>
public sealed class CabeceraDelFestivalConOrganizadorSqlServerTests
{
    private static readonly string[] Organizador = ["Director", "TipoOrganizadorId", "OtroTipoOrganizador", "PerteneceAOrganizacionColectiva", "NombreOrganizacionColectiva"];

    private const string Guion = "V20261119_10__cabecera_del_festival_con_el_organizador.sql";

    private static readonly Regex SeparadorDeLotes = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [HechoSqlServer]
    public async Task La_migracion_rellena_solo_las_columnas_nuevas_desde_el_perfil_aprobado_y_se_puede_repetir()
    {
        var cadenaMaestra = ArnesSqlServer.CadenaMaestra();
        var nombreBase = ArnesSqlServer.NuevoNombreDeBase();
        ArnesSqlServer.ExigirNombreDesechable(nombreBase);
        var cadena = ArnesSqlServer.CadenaHacia(cadenaMaestra, nombreBase);

        await EjecutarAsync(cadenaMaestra, $"CREATE DATABASE [{nombreBase}];");
        try
        {
            // 1) La base «de antes»: todo el esquema menos este guion.
            var guiones = Directory.GetFiles(RutasDelRepositorio.Esquema(), "*.sql")
                .OrderBy(ruta => Path.GetFileName(ruta), StringComparer.Ordinal).ToList();
            var delGuion = guiones.Single(ruta => Path.GetFileName(ruta) == Guion);
            // Solo los anteriores: los guiones posteriores (p. ej. V20261119_20) dependen de las columnas que este añade.
            foreach (var guion in guiones.Where(ruta => string.CompareOrdinal(Path.GetFileName(ruta), Guion) < 0)) await AplicarAsync(cadena, guion);
            Assert.Equal(0, await EscalarAsync(cadena, "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Festivales') AND name IN (N'Director', N'TipoOrganizadorId', N'OtroTipoOrganizador', N'PerteneceAOrganizacionColectiva', N'NombreOrganizacionColectiva')"));

            // 2) Datos. Las foráneas se apagan en las tablas sembradas: apuntan a filas que aquí no existen y
            //    lo que se mide es el relleno. Sí hay un tipo de organizador real.
            await EjecutarAsync(cadena, "DECLARE @a nvarchar(max) = (SELECT STRING_AGG(CAST(N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + N' NOCHECK CONSTRAINT ' + QUOTENAME(name) AS nvarchar(max)), N';') FROM sys.foreign_keys WHERE OBJECT_NAME(parent_object_id) IN (N'Festivales', N'PerfilesPublicosFestival', N'PropuestasDeCambio')); IF @a IS NOT NULL EXEC (@a);");
            await EjecutarAsync(cadena, "INSERT INTO dbo.TiposOrganizador (NombreTipoOrganizador, Slug, OrdenVisualizacion) VALUES (N'Colectivo', N'colectivo-pr1', 1);");
            var tipo = Convert.ToInt32(await EscalarAsync(cadena, "SELECT IdTipoOrganizador FROM dbo.TiposOrganizador WHERE Slug = N'colectivo-pr1'"), CultureInfo.InvariantCulture);

            var f1 = await FestivalAsync(cadena, "F1 aprobado");
            var f2 = await FestivalAsync(cadena, "F2 vigente repudiado");
            var f3 = await FestivalAsync(cadena, "F3 perfil sin organizador");
            var f4 = await FestivalAsync(cadena, "F4 sin perfil");
            var f5 = await FestivalAsync(cadena, "F5 ya con dato");

            // F1: v1 archivado con otros valores, v2 vigente aprobado (propuesta aplicada) con los cinco datos.
            await PerfilAsync(cadena, f1, 1, vigente: false, "Director viejo", tipo, "Otro viejo", 0, "Colectiva vieja");
            var f1v2 = await PerfilAsync(cadena, f1, 2, vigente: true, "Directora Uno", tipo, "Otro Uno", 1, "Red Uno");
            await PropuestaAsync(cadena, f1, f1v2, "aplicada");
            // F2: v2 vigente nació de una propuesta RECHAZADA: la lectura pública retrocede a v1, y el relleno también.
            await PerfilAsync(cadena, f2, 1, vigente: false, "Director aprobado", tipo, null, null, null);
            var f2v2 = await PerfilAsync(cadena, f2, 2, vigente: true, "Director rechazado", null, null, 1, "Rechazada");
            await PropuestaAsync(cadena, f2, f2v2, "rechazada");
            // F3: perfil vigente sin ningún dato del organizador.
            await PerfilAsync(cadena, f3, 1, vigente: true, null, null, null, null, null);
            // F5: perfil con datos; la cabecera ya tendrá un valor puesto a mano tras el primer paso.
            await PerfilAsync(cadena, f5, 1, vigente: true, "Director perfil", tipo, null, null, null);

            var perfilAntes = await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival");
            var cabeceraAntes = await FirmaAsync(cadena, "dbo.Festivales", Organizador);

            // 3) Primer paso.
            await AplicarAsync(cadena, delGuion);
            Assert.Equal(5, await EscalarAsync(cadena, "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Festivales') AND is_nullable = 1 AND name IN (N'Director', N'TipoOrganizadorId', N'OtroTipoOrganizador', N'PerteneceAOrganizacionColectiva', N'NombreOrganizacionColectiva')"));
            Assert.Equal(1, await EscalarAsync(cadena, "SELECT COUNT(*) FROM sys.foreign_keys WHERE name = N'FK_Festivales_TipoOrganizador'"));

            Assert.Equal($"Directora Uno|{tipo}|Otro Uno|True|Red Uno", await OrganizadorAsync(cadena, f1));
            Assert.Equal($"Director aprobado|{tipo}|NULL|NULL|NULL", await OrganizadorAsync(cadena, f2));
            Assert.Equal("NULL|NULL|NULL|NULL|NULL", await OrganizadorAsync(cadena, f3));
            Assert.Equal("NULL|NULL|NULL|NULL|NULL", await OrganizadorAsync(cadena, f4));
            Assert.Equal($"Director perfil|{tipo}|NULL|NULL|NULL", await OrganizadorAsync(cadena, f5));

            // Lo existente NO cambió: ni el perfil ni las columnas anteriores de la cabecera.
            Assert.Equal(perfilAntes, await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival"));
            Assert.Equal(cabeceraAntes, await FirmaAsync(cadena, "dbo.Festivales", Organizador));

            // La foránea rechaza un tipo que no existe (la cabecera no admite basura).
            await Assert.ThrowsAsync<SqlException>(() => EjecutarAsync(cadena, $"UPDATE dbo.Festivales SET TipoOrganizadorId = 999999 WHERE IdFestival = {f4}"));

            // 4) Segundo paso: no cambia nada, y NO pisa lo que alguien escribió en la cabecera.
            await EjecutarAsync(cadena, $"UPDATE dbo.Festivales SET Director = N'Escrito a mano' WHERE IdFestival = {f5}; UPDATE dbo.Festivales SET Director = NULL, TipoOrganizadorId = NULL, OtroTipoOrganizador = NULL, PerteneceAOrganizacionColectiva = NULL, NombreOrganizacionColectiva = NULL WHERE IdFestival = {f1}; UPDATE dbo.Festivales SET Director = N'Solo director' WHERE IdFestival = {f1};");
            var antes = await FirmaOrganizadorAsync(cadena);
            await AplicarAsync(cadena, delGuion);
            Assert.Equal(antes, await FirmaOrganizadorAsync(cadena));
            Assert.Equal($"Escrito a mano|{tipo}|NULL|NULL|NULL", await OrganizadorAsync(cadena, f5));
            Assert.Equal("Solo director|NULL|NULL|NULL|NULL", await OrganizadorAsync(cadena, f1));

            // 5) Los guiones de respaldo y de validación, sobre datos.
            var carpeta = Path.Combine(RutasDelRepositorio.Raiz(), "simus-database", "scripts");
            var validacion = await ResultadosAsync(cadena, await File.ReadAllTextAsync(Path.Combine(carpeta, "validar_perfiles_publicos_festival.sql")));
            Assert.Equal(6, validacion["perfiles: filas"]);
            Assert.Equal(4, validacion["perfiles: vigentes"]);
            Assert.Equal(1, validacion["perfiles vigentes repudiados (propuesta no aplicada)"]);
            Assert.Equal(0, validacion["hijas: prácticas"]);
            foreach (var par in validacion.Where(p => p.Key.StartsWith("Hallazgos", StringComparison.Ordinal) && !p.Key.Contains("distinta", StringComparison.Ordinal)))
            {
                Assert.True(par.Value == 0, $"{par.Key} = {par.Value}");
            }

            var respaldo = await File.ReadAllTextAsync(Path.Combine(carpeta, "respaldo_perfiles_publicos_festival.sql"));
            await EjecutarAsync(cadena, respaldo);
            // El guion nombra el respaldo con la fecha del SERVIDOR (UTC en Docker): no la del reloj local, que difiere después de las 19:00 en Colombia.
            var sufijo = (string)(await EscalarAsync(cadena, "SELECT CONVERT(nchar(8), GETDATE(), 112)"))!;
            Assert.Equal(6, await EscalarAsync(cadena, "SELECT COUNT(*) FROM respaldo.PerfilesPublicosFestival_" + sufijo));
            Assert.Equal(5, await EscalarAsync(cadena, "SELECT COUNT(*) FROM respaldo.Festivales_columnas_" + sufijo));
            Assert.Equal(2, await EscalarAsync(cadena, "SELECT COUNT(*) FROM respaldo.PropuestasDeCambio_festivales_" + sufijo));
            // No sobrescribe un respaldo del mismo día y no toca el perfil.
            await Assert.ThrowsAsync<SqlException>(() => EjecutarAsync(cadena, respaldo));
            Assert.Equal(perfilAntes, await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival"));
        }
        finally
        {
            await EjecutarAsync(
                cadenaMaestra,
                $"IF DB_ID(N'{nombreBase}') IS NOT NULL BEGIN ALTER DATABASE [{nombreBase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{nombreBase}]; END");
        }
    }

    private static async Task<int> FestivalAsync(string cadena, string nombre)
    {
        await InsertarAsync(cadena, "dbo.Festivales", new()
        {
            ["NombreFestival"] = $"N'{nombre}'", ["EstadoRegistro"] = "N'publicado'", ["NivelCobertura"] = "N'nacional'",
        });
        return Convert.ToInt32(await EscalarAsync(cadena, $"SELECT IdFestival FROM dbo.Festivales WHERE NombreFestival = N'{nombre}'"), CultureInfo.InvariantCulture);
    }

    private static async Task<int> PerfilAsync(string cadena, int festival, int numero, bool vigente, string? director, int? tipo, string? otro, int? colectiva, string? nombreColectiva)
    {
        static string Texto(string? valor) => valor is null ? "NULL" : $"N'{valor}'";
        await InsertarAsync(cadena, "dbo.PerfilesPublicosFestival", new()
        {
            ["FestivalOrigenId"] = festival.ToString(CultureInfo.InvariantCulture), ["NumeroPublicacion"] = numero.ToString(CultureInfo.InvariantCulture),
            ["EsVigente"] = vigente ? "1" : "0", ["Nombre"] = $"N'Perfil {festival}-{numero}'", ["NivelCobertura"] = "N'nacional'",
            ["Director"] = Texto(director), ["TipoOrganizadorId"] = tipo?.ToString(CultureInfo.InvariantCulture) ?? "NULL",
            ["OtroTipoOrganizador"] = Texto(otro), ["PerteneceAOrganizacionColectiva"] = colectiva?.ToString(CultureInfo.InvariantCulture) ?? "NULL",
            ["NombreOrganizacionColectiva"] = Texto(nombreColectiva),
        });
        return Convert.ToInt32(await EscalarAsync(cadena, $"SELECT IdPerfilPublicoFestival FROM dbo.PerfilesPublicosFestival WHERE FestivalOrigenId = {festival} AND NumeroPublicacion = {numero}"), CultureInfo.InvariantCulture);
    }

    private static Task PropuestaAsync(string cadena, int festival, int perfilResultante, string estado) =>
        InsertarAsync(cadena, "dbo.PropuestasDeCambio", new()
        {
            ["ModuloId"] = "N'festivales'", ["RegistroId"] = $"N'{festival}'", ["Estado"] = $"N'{estado}'",
            ["SubregistroResultanteId"] = $"N'{perfilResultante}'", ["FechaEnvio"] = "SYSUTCDATETIME()",
            ["FechaDecision"] = "SYSUTCDATETIME()", ["MotivoDeLaDecision"] = "N'prueba'", ["IdOrganizacion"] = "1",
        });

    /// <summary>INSERT genérico: rellena las columnas obligatorias sin valor por omisión según su tipo y aplica los valores dados.</summary>
    private static async Task InsertarAsync(string cadena, string tabla, Dictionary<string, string> valores)
    {
        var lista = string.Join(",", valores.Select(par => $"(N'{par.Key}', N'{par.Value.Replace("'", "''", StringComparison.Ordinal)}')"));
        await EjecutarAsync(cadena, $@"
DECLARE @dados TABLE (Columna sysname, Valor nvarchar(max));
INSERT INTO @dados VALUES {lista};
DECLARE @columnas nvarchar(max), @vals nvarchar(max);
SELECT @columnas = STRING_AGG(CAST(QUOTENAME(x.Columna) AS nvarchar(max)), N','), @vals = STRING_AGG(CAST(x.Valor AS nvarchar(max)), N',')
FROM (
    SELECT c.name AS Columna, COALESCE(d.Valor, CASE
        WHEN t.name IN (N'nvarchar', N'varchar', N'nchar', N'char') THEN N'N''x'''
        WHEN t.name IN (N'int', N'bigint', N'smallint', N'tinyint', N'decimal', N'numeric') THEN N'1'
        WHEN t.name = N'bit' THEN N'0'
        WHEN t.name IN (N'date', N'datetime', N'datetime2', N'smalldatetime', N'datetimeoffset') THEN N'SYSUTCDATETIME()'
        WHEN t.name = N'uniqueidentifier' THEN N'NEWID()'
        ELSE N'NULL' END) AS Valor
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    LEFT JOIN sys.default_constraints df ON df.parent_object_id = c.object_id AND df.parent_column_id = c.column_id
    LEFT JOIN @dados d ON d.Columna = c.name
    WHERE c.object_id = OBJECT_ID(N'{tabla}') AND c.is_identity = 0 AND c.is_computed = 0 AND t.name <> N'timestamp'
      AND (d.Columna IS NOT NULL OR (c.is_nullable = 0 AND df.object_id IS NULL))
) x;
EXEC (N'INSERT INTO {tabla} (' + @columnas + N') VALUES (' + @vals + N')');");
    }

    private static async Task<string> OrganizadorAsync(string cadena, int festival) =>
        (string)(await EscalarAsync(cadena, $"SELECT CONCAT(ISNULL(Director, N'NULL'), N'|', ISNULL(CONVERT(nvarchar(20), TipoOrganizadorId), N'NULL'), N'|', ISNULL(OtroTipoOrganizador, N'NULL'), N'|', CASE PerteneceAOrganizacionColectiva WHEN 1 THEN N'True' WHEN 0 THEN N'False' ELSE N'NULL' END, N'|', ISNULL(NombreOrganizacionColectiva, N'NULL')) FROM dbo.Festivales WHERE IdFestival = {festival}"))!;

    private static async Task<string> FirmaOrganizadorAsync(string cadena) =>
        (string)(await EscalarAsync(cadena, "SELECT STRING_AGG(CONCAT(IdFestival, N':', Director, N':', TipoOrganizadorId, N':', OtroTipoOrganizador, N':', PerteneceAOrganizacionColectiva, N':', NombreOrganizacionColectiva), N';') WITHIN GROUP (ORDER BY IdFestival) FROM dbo.Festivales"))!;

    /// <summary>Firma de las columnas de una tabla, salvo las excluidas: detecta cualquier cambio en las demás.</summary>
    private static async Task<string> FirmaAsync(string cadena, string tabla, params string[] excluidas)
    {
        var filtro = excluidas.Length == 0 ? string.Empty : " AND name NOT IN (" + string.Join(",", excluidas.Select(c => $"N'{c}'")) + ")";
        var columnas = await EscalarAsync(cadena, $"SELECT STRING_AGG(CAST(QUOTENAME(name) AS nvarchar(max)), N',') WITHIN GROUP (ORDER BY column_id) FROM sys.columns WHERE object_id = OBJECT_ID(N'{tabla}')" + filtro);
        return (string)(await EscalarAsync(cadena, $"SELECT CAST(CHECKSUM_AGG(CHECKSUM({columnas})) AS nvarchar(40)) + N'/' + CAST(COUNT(*) AS nvarchar(20)) FROM {tabla}"))!;
    }

    /// <summary>Ejecuta un guion que devuelve varios resultados de (Validacion, Valor) y los junta en un diccionario.</summary>
    [SuppressMessage("Security", "CA2100:Review SQL queries for security vulnerabilities", Justification = "Solo recibe el guion versionado del repositorio, contra una base desechable.")]
    private static async Task<Dictionary<string, long>> ResultadosAsync(string cadena, string sql)
    {
        var resultado = new Dictionary<string, long>();
        await using var conexion = new SqlConnection(cadena);
        await conexion.OpenAsync();
        await using var comando = conexion.CreateCommand();
        comando.CommandText = sql;
        await using var lector = await comando.ExecuteReaderAsync();
        do
        {
            while (await lector.ReadAsync()) resultado[lector.GetString(0)] = Convert.ToInt64(lector.GetValue(1), CultureInfo.InvariantCulture);
        }
        while (await lector.NextResultAsync());
        return resultado;
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
        comando.CommandTimeout = 60;
        comando.CommandText = sql;
        var valor = await comando.ExecuteScalarAsync();
        return valor == DBNull.Value ? null : valor;
    }
}
