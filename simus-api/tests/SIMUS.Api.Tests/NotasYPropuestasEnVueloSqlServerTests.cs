using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// PR-5b del retiro de <c>dbo.PerfilesPublicosFestival</c>: la migración <c>V20261119_30</c> pasa las notas de revisión de un
/// Festival de «una versión del perfil» a la ficha, quita el prefijo <c>perfilPublico.</c> de los campos de propuesta y deja
/// las propuestas en vuelo sin perfil de origen (con su «antes» volcado), y la reversa devuelve todo desde el respaldo.
/// </summary>
/// <remarks>
/// Arma la base «de antes» (todo el esquema MENOS este guion), siembra perfiles, revisiones, notas, propuestas y campos, aplica
/// el guion y comprueba: notas reescritas a <c>principal</c>/<c>festival.*</c>, colisiones resueltas (gana la de la ficha, y
/// entre perfiles el más reciente), la nota de Mercados intacta, el «antes» de las propuestas en vuelo, las cerradas sin tocar,
/// el respaldo, la idempotencia y que la reversa deja las tres tablas idénticas a como estaban.
/// </remarks>
public sealed class NotasYPropuestasEnVueloSqlServerTests
{
    private const string Guion = "V20261119_30__notas_y_propuestas_en_vuelo_sin_perfil.sql";
    private const string GuionDelRetiro = "V20261120_10__retiro_de_perfiles_publicos_festival.sql";

    private static readonly Regex SeparadorDeLotes = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [HechoSqlServer]
    public async Task La_migracion_deja_notas_y_propuestas_en_vuelo_sin_perfil_y_la_reversa_las_devuelve()
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

            // Las foráneas de las tablas sembradas se apagan: apuntan a catálogos y usuarios que aquí no existen.
            await EjecutarAsync(cadena, "DECLARE @a nvarchar(max) = (SELECT STRING_AGG(CAST(N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + N' NOCHECK CONSTRAINT ' + QUOTENAME(name) AS nvarchar(max)), N';') FROM sys.foreign_keys WHERE OBJECT_NAME(parent_object_id) IN (N'Festivales', N'PerfilesPublicosFestival', N'PropuestasDeCambio', N'PropuestasDeCambioCampos', N'RevisionesDeRegistro', N'RevisionesDeRegistroObservaciones', N'PracticasMusicalesDeRegistro', N'TerritoriosSonorosDeRegistro')); IF @a IS NOT NULL EXEC (@a);");

            var f1 = await FestivalAsync(cadena, "F1 con propuesta en vuelo");
            var f2 = await FestivalAsync(cadena, "F2 con propuesta sin perfil");
            var p1 = await PerfilAsync(cadena, f1, 1, nombre: "Nombre P1", director: "Dir P1", correo: "p1@correo.test", descripcion: "Descripción P1");
            var p2 = await PerfilAsync(cadena, f1, 2, nombre: "Nombre P2", director: "Dir P2", correo: "p2@correo.test", descripcion: "Descripción P2");
            await ListaAsync(cadena, "PracticasMusicalesDeRegistro", "IdPracticaMusical", "perfiles-publicos-festival", p1, 5, 4);

            // ── Propuestas ───────────────────────────────────────────────────────────────────────
            // A: borrador de F1 sobre el perfil p1, con un perfil-borrador resultante (999) que NO se debe soltar.
            var a = await PropuestaAsync(cadena, f1, "borrador", subregistro: p1.ToString(CultureInfo.InvariantCulture), resultante: "999");
            var aNombre = await CampoAsync(cadena, a, "nombre", anterior: null, propuesto: "Nombre propuesto");
            var aCorreo = await CampoAsync(cadena, a, "correoContacto", anterior: "otro@correo.test", propuesto: "nuevo@correo.test");
            var aDirector = await CampoAsync(cadena, a, "director", anterior: null, propuesto: "Dir nueva");
            var aTelefono = await CampoAsync(cadena, a, "telefonoContacto", anterior: null, propuesto: "3000000");
            var aPracticas = await CampoAsync(cadena, a, "practicasMusicales", anterior: null, propuesto: "4,5,6");
            var aDescripcion = await CampoAsync(cadena, a, "perfilPublico.descripcion", anterior: null, propuesto: "Descripción propuesta");
            var aNombreConPrefijo = await CampoAsync(cadena, a, "perfilPublico.nombre", anterior: null, propuesto: "Duplicado con prefijo");
            // B: una propuesta CERRADA del mismo Festival: es historia y conserva su perfil de origen.
            var b = await PropuestaAsync(cadena, f1, "aplicada", subregistro: p1.ToString(CultureInfo.InvariantCulture), resultante: p2.ToString(CultureInfo.InvariantCulture));
            var bNombre = await CampoAsync(cadena, b, "nombre", anterior: "Nombre P1", propuesto: "Nombre P2");
            // C: en revisión de F2 con un SubregistroId que no apunta a ningún perfil.
            var c = await PropuestaAsync(cadena, f2, "en_revision", subregistro: "abc", resultante: null);
            var cNombre = await CampoAsync(cadena, c, "nombre", anterior: null, propuesto: "Otro nombre");

            // ── Notas de revisión ─────────────────────────────────────────────────────────────────
            var r1 = await RevisionAsync(cadena, "festivales", f1);
            var r2 = await RevisionAsync(cadena, "mercados", 77);
            var n1 = await NotaAsync(cadena, r1, "subregistro", p1.ToString(CultureInfo.InvariantCulture), "perfilPublico.correoContacto", "Revisa el correo.");
            var n2 = await NotaAsync(cadena, r1, "subregistro", p1.ToString(CultureInfo.InvariantCulture), "perfilPublico.nombre", "Nota del perfil sobre el nombre.");
            var n3 = await NotaAsync(cadena, r1, "principal", null, "festival.nombre", "Nota de la ficha sobre el nombre.");
            var n4 = await NotaAsync(cadena, r1, "subregistro", p1.ToString(CultureInfo.InvariantCulture), "perfilPublico.director", "Del perfil viejo.");
            var n5 = await NotaAsync(cadena, r1, "subregistro", p2.ToString(CultureInfo.InvariantCulture), "perfilPublico.director", "Del perfil reciente.");
            var n6 = await NotaAsync(cadena, r1, "principal", null, "festival.descripcion", "Ya estaba en la ficha.");
            var n7 = await NotaAsync(cadena, r2, "subregistro", "2026", "ficha.nombre", "Nota de una edición de Mercados.");

            var firmaNotas = await FirmaAsync(cadena, "dbo.RevisionesDeRegistroObservaciones");
            var firmaCampos = await FirmaAsync(cadena, "dbo.PropuestasDeCambioCampos");
            var firmaPropuestas = await FirmaAsync(cadena, "dbo.PropuestasDeCambio");

            // Primer paso.
            await AplicarAsync(cadena, delGuion);

            // Notas: las del perfil pasan a la ficha con el identificador que escribe la pantalla.
            Assert.Equal("principal|NULL|festival.correoContacto", await NotaDeAsync(cadena, n1));
            Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.RevisionesDeRegistroObservaciones WHERE IdObservacion = {n2}"));
            Assert.Equal("principal|NULL|festival.nombre", await NotaDeAsync(cadena, n3));
            Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.RevisionesDeRegistroObservaciones WHERE IdObservacion = {n4}"));
            Assert.Equal("principal|NULL|festival.director", await NotaDeAsync(cadena, n5));
            Assert.Equal("principal|NULL|festival.descripcion", await NotaDeAsync(cadena, n6));
            Assert.Equal("subregistro|2026|ficha.nombre", await NotaDeAsync(cadena, n7));
            Assert.Equal(0, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.RevisionesDeRegistroObservaciones WHERE CampoId LIKE N'perfilPublico.%' OR (Ambito = N'subregistro' AND IdRevision = " + r1 + ")"));
            Assert.Equal(2, await Escalar(cadena, "SELECT COUNT(*) FROM respaldo.RevisionesObservaciones_V20261119_30 WHERE Accion = N'descartada'"));
            Assert.Equal(2, await Escalar(cadena, "SELECT COUNT(*) FROM respaldo.RevisionesObservaciones_V20261119_30 WHERE Accion = N'reescrita'"));

            // Propuesta en vuelo A: sin perfil de origen, con el «antes» volcado y el resultante intacto.
            Assert.Equal("NULL|999", await Escalar(cadena, $"SELECT CONCAT(ISNULL(SubregistroId, N'NULL'), N'|', SubregistroResultanteId) FROM dbo.PropuestasDeCambio WHERE IdPropuesta = {a}"));
            Assert.Equal("Nombre P1", await AnteriorAsync(cadena, aNombre));
            Assert.Equal("otro@correo.test", await AnteriorAsync(cadena, aCorreo));            // lo que ya tenía no se pisa
            Assert.Equal("Dir P1", await AnteriorAsync(cadena, aDirector));
            Assert.Equal("NULL", await AnteriorAsync(cadena, aTelefono));                       // el perfil tampoco tenía teléfono
            Assert.Equal("4,5", await AnteriorAsync(cadena, aPracticas));                       // la lista, ordenada y con coma
            // El campo con prefijo pierde el prefijo y recibe el «antes»; el duplicado con prefijo se descarta.
            Assert.Equal("descripcion|Descripción P1", await Escalar(cadena, $"SELECT CONCAT(CampoId, N'|', ValorAnterior) FROM dbo.PropuestasDeCambioCampos WHERE IdCampoPropuesto = {aDescripcion}"));
            Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.PropuestasDeCambioCampos WHERE IdCampoPropuesto = {aNombreConPrefijo}"));
            Assert.Equal(0, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.PropuestasDeCambioCampos WHERE CampoId LIKE N'perfilPublico.%'"));
            // Cerrada: intacta.
            Assert.Equal($"{p1}|{p2}", await Escalar(cadena, $"SELECT CONCAT(SubregistroId, N'|', SubregistroResultanteId) FROM dbo.PropuestasDeCambio WHERE IdPropuesta = {b}"));
            Assert.Equal("Nombre P1", await AnteriorAsync(cadena, bNombre));
            // En vuelo sin perfil que encontrar: se suelta el SubregistroId y no se inventa un «antes».
            Assert.Equal("NULL", await Escalar(cadena, $"SELECT ISNULL(SubregistroId, N'NULL') FROM dbo.PropuestasDeCambio WHERE IdPropuesta = {c}"));
            Assert.Equal("NULL", await AnteriorAsync(cadena, cNombre));
            Assert.Equal(0, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.PropuestasDeCambio WHERE ModuloId = N'festivales' AND SubregistroId IS NOT NULL AND Estado IN (N'borrador', N'en_revision', N'ajustes_solicitados')"));

            // Respaldo de las propuestas en vuelo.
            Assert.Equal(2, await Escalar(cadena, "SELECT COUNT(*) FROM respaldo.PropuestasDeCambio_V20261119_30"));

            // Segundo paso: no escribe nada.
            var tras = (await FirmaAsync(cadena, "dbo.RevisionesDeRegistroObservaciones"), await FirmaAsync(cadena, "dbo.PropuestasDeCambioCampos"), await FirmaAsync(cadena, "dbo.PropuestasDeCambio"));
            await AplicarAsync(cadena, delGuion);
            Assert.Equal(tras, (await FirmaAsync(cadena, "dbo.RevisionesDeRegistroObservaciones"), await FirmaAsync(cadena, "dbo.PropuestasDeCambioCampos"), await FirmaAsync(cadena, "dbo.PropuestasDeCambio")));
            Assert.Equal(2, await Escalar(cadena, "SELECT COUNT(*) FROM respaldo.PropuestasDeCambio_V20261119_30"));

            // La reversa deja las tres tablas idénticas a como estaban.
            var reversa = Path.Combine(RutasDelRepositorio.Raiz(), "simus-database", "scripts", "reversa_notas_y_propuestas_en_vuelo.sql");
            await AplicarAsync(cadena, reversa);
            Assert.Equal(firmaNotas, await FirmaAsync(cadena, "dbo.RevisionesDeRegistroObservaciones"));
            Assert.Equal(firmaCampos, await FirmaAsync(cadena, "dbo.PropuestasDeCambioCampos"));
            Assert.Equal(firmaPropuestas, await FirmaAsync(cadena, "dbo.PropuestasDeCambio"));
        }
        finally
        {
            await EjecutarAsync(
                cadenaMaestra,
                $"IF DB_ID(N'{nombreBase}') IS NOT NULL BEGIN ALTER DATABASE [{nombreBase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{nombreBase}]; END");
        }
    }

    private static string Texto(string? valor) => valor is null ? "NULL" : $"N'{valor}'";

    private static async Task<int> FestivalAsync(string cadena, string nombre)
    {
        await InsertarAsync(cadena, "dbo.Festivales", new()
        {
            ["NombreFestival"] = $"N'{nombre}'", ["EstadoRegistro"] = "N'publicado'", ["NivelCobertura"] = "N'nacional'",
        });
        return Convert.ToInt32(await Escalar(cadena, $"SELECT IdFestival FROM dbo.Festivales WHERE NombreFestival = N'{nombre}'"), CultureInfo.InvariantCulture);
    }

    private static async Task<int> PerfilAsync(string cadena, int festival, int numero, string nombre, string? director, string? correo, string? descripcion)
    {
        await InsertarAsync(cadena, "dbo.PerfilesPublicosFestival", new()
        {
            ["FestivalOrigenId"] = festival.ToString(CultureInfo.InvariantCulture), ["NumeroPublicacion"] = numero.ToString(CultureInfo.InvariantCulture),
            ["EsVigente"] = numero == 2 ? "1" : "0", ["Nombre"] = Texto(nombre), ["Descripcion"] = Texto(descripcion), ["NivelCobertura"] = "N'nacional'",
            ["CodigoDepartamento"] = "NULL", ["CodigoMunicipio"] = "NULL", ["CorreoContacto"] = Texto(correo), ["Director"] = Texto(director),
        });
        return Convert.ToInt32(await Escalar(cadena, $"SELECT IdPerfilPublicoFestival FROM dbo.PerfilesPublicosFestival WHERE FestivalOrigenId = {festival} AND NumeroPublicacion = {numero}"), CultureInfo.InvariantCulture);
    }

    private static async Task<long> PropuestaAsync(string cadena, int festival, string estado, string? subregistro, string? resultante)
    {
        var enviada = estado != "borrador";
        var cerrada = estado is "aplicada" or "rechazada";
        await InsertarAsync(cadena, "dbo.PropuestasDeCambio", new()
        {
            ["ModuloId"] = "N'festivales'", ["RegistroId"] = $"N'{festival}'", ["Estado"] = $"N'{estado}'",
            ["SubregistroId"] = Texto(subregistro), ["SubregistroResultanteId"] = Texto(resultante),
            ["FechaEnvio"] = enviada ? "SYSUTCDATETIME()" : "NULL", ["FechaDecision"] = cerrada ? "SYSUTCDATETIME()" : "NULL",
            ["MotivoDeLaDecision"] = "NULL", ["IdOrganizacion"] = "1",
        });
        return Convert.ToInt64(await Escalar(cadena, $"SELECT MAX(IdPropuesta) FROM dbo.PropuestasDeCambio WHERE RegistroId = N'{festival}' AND Estado = N'{estado}'"), CultureInfo.InvariantCulture);
    }

    private static async Task<long> CampoAsync(string cadena, long propuesta, string campo, string? anterior, string? propuesto)
    {
        await EjecutarAsync(cadena,
            $"INSERT INTO dbo.PropuestasDeCambioCampos (IdPropuesta, SeccionId, CampoId, CampoEtiqueta, ValorAnterior, ValorPropuesto) VALUES ({propuesta}, N'generales', N'{campo}', N'{campo}', {Texto(anterior)}, {Texto(propuesto)})");
        return Convert.ToInt64(await Escalar(cadena, $"SELECT IdCampoPropuesto FROM dbo.PropuestasDeCambioCampos WHERE IdPropuesta = {propuesta} AND CampoId = N'{campo}'"), CultureInfo.InvariantCulture);
    }

    private static async Task<long> RevisionAsync(string cadena, string modulo, int registro)
    {
        await InsertarAsync(cadena, "dbo.RevisionesDeRegistro", new() { ["ModuloId"] = $"N'{modulo}'", ["RegistroId"] = $"N'{registro}'" });
        return Convert.ToInt64(await Escalar(cadena, $"SELECT MAX(IdRevision) FROM dbo.RevisionesDeRegistro WHERE ModuloId = N'{modulo}' AND RegistroId = N'{registro}'"), CultureInfo.InvariantCulture);
    }

    private static async Task<long> NotaAsync(string cadena, long revision, string ambito, string? subregistro, string campo, string nota)
    {
        await EjecutarAsync(cadena,
            $"INSERT INTO dbo.RevisionesDeRegistroObservaciones (IdRevision, Ambito, SubregistroId, SeccionId, CampoId, CampoEtiqueta, Nota) VALUES ({revision}, N'{ambito}', {Texto(subregistro)}, N'generales', N'{campo}', N'{campo}', N'{nota}')");
        return Convert.ToInt64(await Escalar(cadena, $"SELECT IdObservacion FROM dbo.RevisionesDeRegistroObservaciones WHERE IdRevision = {revision} AND CampoId = N'{campo}' AND Nota = N'{nota}'"), CultureInfo.InvariantCulture);
    }

    private static async Task<string> NotaDeAsync(string cadena, long nota) =>
        (string)(await Escalar(cadena, $"SELECT CONCAT(Ambito, N'|', ISNULL(SubregistroId, N'NULL'), N'|', CampoId) FROM dbo.RevisionesDeRegistroObservaciones WHERE IdObservacion = {nota}"))!;

    private static async Task<string> AnteriorAsync(string cadena, long campo) =>
        (string)(await Escalar(cadena, $"SELECT ISNULL(ValorAnterior, N'NULL') FROM dbo.PropuestasDeCambioCampos WHERE IdCampoPropuesto = {campo}"))!;

    private static Task ListaAsync(string cadena, string tabla, string columna, string modulo, int registro, params int[] valores) =>
        EjecutarAsync(cadena, string.Join(";", valores.Select(v =>
            $"INSERT INTO dbo.{tabla} (ModuloId, RegistroId, {columna}) VALUES (N'{modulo}', N'{registro}', {v})")));

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
