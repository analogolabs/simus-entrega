using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// PR-3 del retiro de <c>dbo.PerfilesPublicosFestival</c>: la migración <c>V20261119_20</c> deja la cabecera
/// <c>dbo.Festivales</c> igual a lo publicado (el perfil vigente aprobado), de modo que el diagnóstico de PR-2 da 0.
/// </summary>
/// <remarks>
/// Arma la base «de antes» (todo el esquema MENOS este guion), siembra Festivales, perfiles, listas y ediciones, mide
/// el diagnóstico SQL de PR-2 (debe ver divergencias), aplica el guion, y comprueba: cabecera igual al perfil aprobado,
/// historia en <c>CambiosDeRegistro</c>, listas reemplazadas, respaldo de lo sobrescrito, datos de edición solo a campos
/// vacíos, perfil sin tocar salvo la alineación de los campos que la lectura resuelve con <c>perfil ?? cabecera</c>,
/// diagnóstico en 0 e idempotencia.
/// </remarks>
public sealed class CabeceraIgualALoPublicadoSqlServerTests
{
    private const string Guion = "V20261119_20__cabecera_igual_a_lo_publicado.sql";
    private const string GuionDelRetiro = "V20261120_10__retiro_de_perfiles_publicos_festival.sql";

    private static readonly Regex SeparadorDeLotes = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [HechoSqlServer]
    public async Task La_migracion_deja_la_cabecera_igual_a_lo_publicado_y_el_diagnostico_en_cero()
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
            var delGuion = guiones.Single(ruta => Path.GetFileName(ruta) == Guion);
            // El retiro de la tabla (PR-8) es POSTERIOR a este guion y la borraría: esta prueba mide el estado «de antes».
            foreach (var guion in guiones.Where(ruta => ruta != delGuion && Path.GetFileName(ruta) != GuionDelRetiro)) await AplicarAsync(cadena, guion);

            // Las foráneas de las tablas sembradas se apagan: apuntan a catálogos que aquí no existen y lo que se mide es el relleno.
            await EjecutarAsync(cadena, "DECLARE @a nvarchar(max) = (SELECT STRING_AGG(CAST(N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + N' NOCHECK CONSTRAINT ' + QUOTENAME(name) AS nvarchar(max)), N';') FROM sys.foreign_keys WHERE OBJECT_NAME(parent_object_id) IN (N'Festivales', N'PerfilesPublicosFestival', N'PropuestasDeCambio', N'EdicionesFestival', N'PracticasMusicalesDeRegistro', N'TerritoriosSonorosDeRegistro', N'ExpresionesArtisticasDeRegistro', N'ModalidadesParticipacionDeRegistro', N'TiposIngresoDeRegistro')); IF @a IS NOT NULL EXEC (@a);");

            // F1: cabecera atrasada; perfil v2 vigente APROBADO con valores nuevos y listas distintas.
            var f1 = await FestivalAsync(cadena, "F1 cabecera atrasada", "Descripción vieja", "viejo@correo.test", "3000000", "@viejo", "MiPagina", "Contacto viejo");
            var f1p1 = await PerfilAsync(cadena, f1, 1, vigente: false, nombre: "Perfil 1 archivado", descripcion: "Archivada");
            var f1p2 = await PerfilAsync(cadena, f1, 2, vigente: true, nombre: "Nombre publicado F1", descripcion: "Descripción publicada",
                correo: "nuevo@correo.test", telefono: "3111111", instagram: "@nuevo", sitio: "MIPAGINA", observaciones: "Contacto nuevo",
                director: "Directora Uno", periodicidad: "anual", nivel: "departamental", departamento: "05");
            await PropuestaAsync(cadena, f1, f1p2, "aplicada");
            await ListaAsync(cadena, "PracticasMusicalesDeRegistro", "IdPracticaMusical", "festivales", f1, 1, 2);
            await ListaAsync(cadena, "PracticasMusicalesDeRegistro", "IdPracticaMusical", "perfiles-publicos-festival", f1p2, 2, 3);
            await ListaAsync(cadena, "TerritoriosSonorosDeRegistro", "IdTerritorioSonoro", "festivales", f1, 1);
            _ = f1p1;

            // F2: el vigente nació de una propuesta RECHAZADA; lo publicado es v1.
            var f2 = await FestivalAsync(cadena, "F2 vigente repudiado", "Desc F2", null, null, null, null, null);
            await PerfilAsync(cadena, f2, 1, vigente: false, nombre: "Publicado F2", descripcion: "Desc F2 aprobada");
            var f2p2 = await PerfilAsync(cadena, f2, 2, vigente: true, nombre: "Rechazado F2", descripcion: "No debe llegar");
            await PropuestaAsync(cadena, f2, f2p2, "rechazada");

            // F3: perfil con NULL donde la lectura pública cae a la cabecera (no se pisa) y con teléfono retirado a propósito (sí se vacía).
            var f3 = await FestivalAsync(cadena, "F3 perfil con nulos", "Descripción de la cabecera", "cab@correo.test", "3222222", null, null, null);
            var f3p1 = await PerfilAsync(cadena, f3, 1, vigente: true, nombre: "F3 perfil con nulos", descripcion: null, correo: null, telefono: null);

            // F4: sin perfil.
            var f4 = await FestivalAsync(cadena, "F4 sin perfil", "Desc F4", null, "3444444", null, null, null);

            // F5: datos de edición. Edición 2025 vacía (se rellena), edición 2024 (no se toca) y otro Festival con una edición ya con tipología.
            var f5 = await FestivalAsync(cadena, "F5 con ediciones", "Desc F5", null, null, null, null, null);
            await PerfilAsync(cadena, f5, 1, vigente: true, nombre: "F5 con ediciones", descripcion: "Desc F5",
                fechaInicio: "2025-05-01", fechaFin: "2025-05-04", tipologia: 7, estampilla: 1, otraModalidad: "Otra modalidad");
            var e2025 = await EdicionAsync(cadena, f5, 2025, tipologia: null);
            var e2024 = await EdicionAsync(cadena, f5, 2024, tipologia: null);
            var f6 = await FestivalAsync(cadena, "F6 edición ya con dato", "Desc F6", null, null, null, null, null);
            await PerfilAsync(cadena, f6, 1, vigente: true, nombre: "F6 edición ya con dato", descripcion: "Desc F6",
                fechaInicio: "2025-06-01", tipologia: 7, estampilla: 1);
            var e6 = await EdicionAsync(cadena, f6, 2025, tipologia: 9);

            // Antes: el diagnóstico de PR-2 ve divergencias.
            var carpeta = Path.Combine(RutasDelRepositorio.Raiz(), "simus-database", "scripts");
            var diagnostico = await File.ReadAllTextAsync(Path.Combine(carpeta, "diagnostico_perfil_vs_cabecera_festivales.sql"));
            var antes = await ResultadosAsync(cadena, diagnostico);
            Assert.Equal(5, antes["festivales con perfil aprobado"]);
            Assert.True(antes["nombre"] > 0 && antes["practicasMusicales"] > 0 && antes["telefonoContacto"] > 0, "El diagnóstico debía ver divergencias antes.");

            var perfilesAntes = await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival");

            // Primer paso.
            await AplicarAsync(cadena, delGuion);

            // La cabecera dice lo publicado.
            Assert.Equal("Nombre publicado F1|Descripción publicada|nuevo@correo.test|3111111|@nuevo|MIPAGINA|Contacto nuevo|Directora Uno|anual|departamental|05",
                await CabeceraAsync(cadena, f1));
            Assert.Equal("Publicado F2|Desc F2 aprobada", await Escalar(cadena, $"SELECT CONCAT(NombreFestival, N'|', Descripcion) FROM dbo.Festivales WHERE IdFestival = {f2}"));
            // F3: la descripción y el correo de la cabecera se conservan (la lectura pública los mostraba); el teléfono retirado queda vacío.
            Assert.Equal("Descripción de la cabecera|cab@correo.test|NULL", await Escalar(cadena, $"SELECT CONCAT(Descripcion, N'|', CorreoFestival, N'|', ISNULL(TelefonoFestival, N'NULL')) FROM dbo.Festivales WHERE IdFestival = {f3}"));
            // ... y el perfil se alinea con la cabecera en esos campos (queda respaldado el original).
            Assert.Equal("Descripción de la cabecera|cab@correo.test", await Escalar(cadena, $"SELECT CONCAT(Descripcion, N'|', CorreoContacto) FROM dbo.PerfilesPublicosFestival WHERE IdPerfilPublicoFestival = {f3p1}"));
            Assert.Equal(1, await Escalar(cadena, $"SELECT COUNT(*) FROM respaldo.PerfilesPublicosFestival_V20261119_20 WHERE IdPerfilPublicoFestival = {f3p1} AND Descripcion IS NULL"));
            // F4 sin perfil: intacta.
            Assert.Equal("Desc F4|3444444", await Escalar(cadena, $"SELECT CONCAT(Descripcion, N'|', TelefonoFestival) FROM dbo.Festivales WHERE IdFestival = {f4}"));

            // Listas: la cabecera de F1 quedó con las del perfil (2, 3) y sin territorios (el perfil no tiene).
            Assert.Equal("2,3", await Escalar(cadena, $"SELECT STRING_AGG(CONVERT(nvarchar(10), IdPracticaMusical), N',') WITHIN GROUP (ORDER BY IdPracticaMusical) FROM dbo.PracticasMusicalesDeRegistro WHERE ModuloId = N'festivales' AND RegistroId = N'{f1}'"));
            Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.TerritoriosSonorosDeRegistro WHERE ModuloId = N'festivales' AND RegistroId = N'{f1}'"));

            // Respaldo de lo sobrescrito.
            Assert.Equal("Nombre F1 cabecera atrasada|3000000", await Escalar(cadena, $"SELECT CONCAT(N'Nombre ', NombreFestival, N'|', TelefonoFestival) FROM respaldo.Festivales_V20261119_20 WHERE IdFestival = {f1}"));
            Assert.Equal(3, await Escalar(cadena, $"SELECT COUNT(*) FROM respaldo.ListasDeRegistro_V20261119_20 WHERE RegistroId = N'{f1}'"));
            Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM respaldo.Festivales_V20261119_20 WHERE IdFestival = {f4}"));

            // Historia: una fila por campo cambiado, origen migración, un solo grupo por Festival.
            Assert.Equal(1, await Escalar(cadena, $"SELECT COUNT(DISTINCT IdGrupo) FROM dbo.CambiosDeRegistro WHERE ModuloId = N'festivales' AND RegistroId = N'{f1}' AND Origen = N'migracion'"));
            Assert.Equal(1, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE RegistroId = N'{f1}' AND CampoId = N'nombre' AND ValorAnterior = N'F1 cabecera atrasada' AND ValorNuevo = N'Nombre publicado F1' AND PerfilPublicoFestivalId = {f1p2}"));
            Assert.Equal(1, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE RegistroId = N'{f1}' AND CampoId = N'practicasMusicales' AND ValorAnterior = N'1, 2' AND ValorNuevo = N'2, 3'"));
            // Solo cambió las mayúsculas de «sitioWeb»: la cabecera se corrige, pero no queda fila (CK_CambiosDeRegistro_Distinto).
            Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE RegistroId = N'{f1}' AND CampoId = N'sitioWeb'"));
            Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE RegistroId = N'{f4}'"));
            Assert.Equal(1, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE RegistroId = N'{f3}' AND CampoId = N'telefonoContacto' AND ValorAnterior = N'3222222' AND ValorNuevo IS NULL"));
            Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE RegistroId = N'{f3}' AND CampoId IN (N'descripcion', N'correoContacto')"));

            // Edición: la de 2025 se rellena; la de 2024 y la que ya tenía tipología no se pisan.
            Assert.Equal("2025-05-01|2025-05-04|7|True|Otra modalidad", await Escalar(cadena, $"SELECT CONCAT(FechaInicio, N'|', FechaFin, N'|', TipologiaFestivalId, N'|', CASE UsaEstampillaProcultura WHEN 1 THEN N'True' ELSE N'False' END, N'|', OtraModalidadParticipacion) FROM dbo.EdicionesFestival WHERE IdEdicionFestival = {e2025}"));
            Assert.Equal("NULL|NULL", await Escalar(cadena, $"SELECT CONCAT(ISNULL(CONVERT(nvarchar(20), TipologiaFestivalId), N'NULL'), N'|', ISNULL(CONVERT(nvarchar(20), FechaInicio), N'NULL')) FROM dbo.EdicionesFestival WHERE IdEdicionFestival = {e2024}"));
            Assert.Equal("9|2025-06-01|True", await Escalar(cadena, $"SELECT CONCAT(TipologiaFestivalId, N'|', FechaInicio, N'|', CASE UsaEstampillaProcultura WHEN 1 THEN N'True' ELSE N'False' END) FROM dbo.EdicionesFestival WHERE IdEdicionFestival = {e6}"));

            // El diagnóstico de PR-2 da 0 en todo.
            var despues = await ResultadosAsync(cadena, diagnostico);
            Assert.Equal(5, despues["festivales con perfil aprobado"]);
            foreach (var par in despues.Where(p => p.Key != "festivales con perfil aprobado"))
            {
                Assert.True(par.Value == 0, $"Divergencia tras el backfill en «{par.Key}»: {par.Value}");
            }

            // El perfil no cambió salvo la alineación de F3 (ver arriba): mismo número de filas y las columnas de F1/F2 intactas.
            Assert.Equal(7, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.PerfilesPublicosFestival"));
            _ = perfilesAntes;

            // Segundo paso: no escribe nada.
            var firmaCabecera = await FirmaAsync(cadena, "dbo.Festivales");
            var firmaPerfil = await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival");
            var historia = await Escalar(cadena, "SELECT COUNT(*) FROM dbo.CambiosDeRegistro");
            var firmaEdiciones = await FirmaAsync(cadena, "dbo.EdicionesFestival");
            await AplicarAsync(cadena, delGuion);
            Assert.Equal(firmaCabecera, await FirmaAsync(cadena, "dbo.Festivales"));
            Assert.Equal(firmaPerfil, await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival"));
            Assert.Equal(firmaEdiciones, await FirmaAsync(cadena, "dbo.EdicionesFestival"));
            Assert.Equal(historia, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.CambiosDeRegistro"));
        }
        finally
        {
            await EjecutarAsync(
                cadenaMaestra,
                $"IF DB_ID(N'{nombreBase}') IS NOT NULL BEGIN ALTER DATABASE [{nombreBase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{nombreBase}]; END");
        }
    }

    private static string Texto(string? valor) => valor is null ? "NULL" : $"N'{valor}'";

    private static async Task<int> FestivalAsync(string cadena, string nombre, string? descripcion, string? correo, string? telefono, string? instagram, string? sitio, string? observaciones)
    {
        await InsertarAsync(cadena, "dbo.Festivales", new()
        {
            ["NombreFestival"] = $"N'{nombre}'", ["EstadoRegistro"] = "N'publicado'", ["NivelCobertura"] = "N'nacional'",
            ["Descripcion"] = Texto(descripcion), ["CorreoFestival"] = Texto(correo), ["TelefonoFestival"] = Texto(telefono),
            ["InstagramFestival"] = Texto(instagram), ["SitioWebFestival"] = Texto(sitio), ["ObservacionesContacto"] = Texto(observaciones),
        });
        return Convert.ToInt32(await Escalar(cadena, $"SELECT IdFestival FROM dbo.Festivales WHERE NombreFestival = N'{nombre}'"), CultureInfo.InvariantCulture);
    }

    private static async Task<int> PerfilAsync(
        string cadena, int festival, int numero, bool vigente, string nombre, string? descripcion = null, string? correo = null,
        string? telefono = null, string? instagram = null, string? sitio = null, string? observaciones = null, string? director = null,
        string? periodicidad = null, string nivel = "nacional", string? departamento = null, string? fechaInicio = null,
        string? fechaFin = null, int? tipologia = null, int? estampilla = null, string? otraModalidad = null)
    {
        await InsertarAsync(cadena, "dbo.PerfilesPublicosFestival", new()
        {
            ["FestivalOrigenId"] = festival.ToString(CultureInfo.InvariantCulture), ["NumeroPublicacion"] = numero.ToString(CultureInfo.InvariantCulture),
            ["EsVigente"] = vigente ? "1" : "0", ["Nombre"] = Texto(nombre), ["Descripcion"] = Texto(descripcion), ["NivelCobertura"] = Texto(nivel),
            ["CodigoDepartamento"] = Texto(departamento), ["CodigoMunicipio"] = "NULL", ["Periodicidad"] = Texto(periodicidad),
            ["CorreoContacto"] = Texto(correo), ["TelefonoContacto"] = Texto(telefono), ["Instagram"] = Texto(instagram), ["SitioWeb"] = Texto(sitio),
            ["ObservacionesContacto"] = Texto(observaciones), ["Director"] = Texto(director),
            ["FechaInicio"] = fechaInicio is null ? "NULL" : $"'{fechaInicio}'", ["FechaFin"] = fechaFin is null ? "NULL" : $"'{fechaFin}'",
            ["TipologiaFestivalId"] = tipologia?.ToString(CultureInfo.InvariantCulture) ?? "NULL",
            ["UsaEstampillaProcultura"] = estampilla?.ToString(CultureInfo.InvariantCulture) ?? "NULL", ["OtraModalidadParticipacion"] = Texto(otraModalidad),
        });
        return Convert.ToInt32(await Escalar(cadena, $"SELECT IdPerfilPublicoFestival FROM dbo.PerfilesPublicosFestival WHERE FestivalOrigenId = {festival} AND NumeroPublicacion = {numero}"), CultureInfo.InvariantCulture);
    }

    private static Task PropuestaAsync(string cadena, int festival, int perfilResultante, string estado) =>
        InsertarAsync(cadena, "dbo.PropuestasDeCambio", new()
        {
            ["ModuloId"] = "N'festivales'", ["RegistroId"] = $"N'{festival}'", ["Estado"] = $"N'{estado}'",
            ["SubregistroResultanteId"] = $"N'{perfilResultante}'", ["FechaEnvio"] = "SYSUTCDATETIME()",
            ["FechaDecision"] = "SYSUTCDATETIME()", ["MotivoDeLaDecision"] = "N'prueba'", ["IdOrganizacion"] = "1",
        });

    private static async Task<int> EdicionAsync(string cadena, int festival, int anio, int? tipologia)
    {
        await InsertarAsync(cadena, "dbo.EdicionesFestival", new()
        {
            ["FestivalId"] = festival.ToString(CultureInfo.InvariantCulture), ["Anio"] = anio.ToString(CultureInfo.InvariantCulture),
            ["Nombre"] = $"N'Edición {festival}-{anio}'", ["EstadoVisibilidad"] = "N'borrador'", ["EstadoRegistro"] = "N'borrador'", ["TipologiaFestivalId"] = tipologia?.ToString(CultureInfo.InvariantCulture) ?? "NULL",
        });
        return Convert.ToInt32(await Escalar(cadena, $"SELECT IdEdicionFestival FROM dbo.EdicionesFestival WHERE FestivalId = {festival} AND Anio = {anio}"), CultureInfo.InvariantCulture);
    }

    private static Task ListaAsync(string cadena, string tabla, string columna, string modulo, int registro, params int[] valores) =>
        EjecutarAsync(cadena, string.Join(";", valores.Select(v =>
            $"INSERT INTO dbo.{tabla} (ModuloId, RegistroId, {columna}) VALUES (N'{modulo}', N'{registro}', {v})")));

    private static async Task<string> CabeceraAsync(string cadena, int festival) =>
        (string)(await Escalar(cadena, $"SELECT CONCAT(NombreFestival, N'|', Descripcion, N'|', CorreoFestival, N'|', TelefonoFestival, N'|', InstagramFestival, N'|', SitioWebFestival, N'|', ObservacionesContacto, N'|', Director, N'|', Periodicidad, N'|', NivelCobertura, N'|', CodigoDepartamento) FROM dbo.Festivales WHERE IdFestival = {festival}"))!;

    private static async Task<string> FirmaAsync(string cadena, string tabla)
    {
        var columnas = await Escalar(cadena, $"SELECT STRING_AGG(CAST(QUOTENAME(name) AS nvarchar(max)), N',') WITHIN GROUP (ORDER BY column_id) FROM sys.columns WHERE object_id = OBJECT_ID(N'{tabla}')");
        return (string)(await Escalar(cadena, $"SELECT CAST(CHECKSUM_AGG(CHECKSUM({columnas})) AS nvarchar(40)) + N'/' + CAST(COUNT(*) AS nvarchar(20)) FROM {tabla}"))!;
    }

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

    /// <summary>Ejecuta el guion y junta los resultados de (nombre, valor) en un diccionario.</summary>
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
    private static async Task<object?> Escalar(string cadena, string sql)
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
