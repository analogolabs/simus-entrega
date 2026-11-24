using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace SIMUS.Api.Tests;

/// <summary>
/// PR-8 del retiro de <c>dbo.PerfilesPublicosFestival</c>: la migración <c>V20261120_10</c> (DESTRUCTIVA) y su reversa
/// <c>reversa_retiro_perfiles_publicos_festival.sql</c>, probadas contra SQL Server real con datos sembrados.
/// </summary>
/// <remarks>
/// Arma la base «de antes» (todo el esquema MENOS el retiro) y siembra perfiles (vigentes e históricos), sus hijas, archivos
/// ligados a un perfil y las referencias lógicas. Comprueba, en este orden: cada PRECONDICIÓN aborta con su error y no cambia
/// nada (sin respaldo, respaldo desactualizado, divergencia perfil vs. cabecera, propuesta en vuelo con perfil, nota por
/// reescribir, archivo sin destino); con el respaldo y sin divergencias el retiro borra la tabla, sus hijas y el módulo de los CHECK, deja la
/// cabecera y la historia exactamente como estaban, reapunta los archivos al Festival y es idempotente; y la REVERSA recrea la
/// tabla y la deja idéntica, fila a fila, a la copia (y devuelve archivos y CHECK). La prueba dorada de los JSON públicos con la
/// siembra completa no vive aquí: se corrió a mano y está en el informe del PR.
/// </remarks>
public sealed class RetiroDePerfilesPublicosFestivalSqlServerTests
{
    private const string Retiro = "V20261120_10__retiro_de_perfiles_publicos_festival.sql";

    private static readonly Regex SeparadorDeLotes = new(
        @"^[\t ]*GO[\t ]*(?:--[^\r\n]*)?\r?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly string[] Hijas =
    [
        "PracticasMusicalesDeRegistro", "TerritoriosSonorosDeRegistro", "ExpresionesArtisticasDeRegistro", "ModalidadesParticipacionDeRegistro",
        "TiposIngresoDeRegistro", "LocalizacionesDeRegistro", "EntidadesAliadasDeRegistro", "ArchivosDeRegistro",
    ];

    [HechoSqlServer]
    public async Task El_retiro_exige_sus_precondiciones_borra_lo_que_dice_es_idempotente_y_se_revierte()
    {
        var cadenaMaestra = ArnesSqlServer.CadenaMaestra();
        var nombreBase = ArnesSqlServer.NuevoNombreDeBase();
        ArnesSqlServer.ExigirNombreDesechable(nombreBase);
        var cadena = ArnesSqlServer.CadenaHacia(cadenaMaestra, nombreBase);
        var carpeta = Path.Combine(RutasDelRepositorio.Raiz(), "simus-database", "scripts");

        await EjecutarAsync(cadenaMaestra, $"CREATE DATABASE [{nombreBase}];");
        try
        {
            var guiones = Directory.GetFiles(RutasDelRepositorio.Esquema(), "*.sql").OrderBy(ruta => Path.GetFileName(ruta), StringComparer.Ordinal).ToList();
            var retiro = guiones.Single(ruta => Path.GetFileName(ruta) == Retiro);
            foreach (var guion in guiones.Where(ruta => ruta != retiro)) await AplicarAsync(cadena, guion);

            // Las foráneas de las tablas sembradas se apagan: apuntan a catálogos que aquí no existen y lo que se mide es el retiro.
            await EjecutarAsync(cadena, "DECLARE @a nvarchar(max) = (SELECT STRING_AGG(CAST(N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + N' NOCHECK CONSTRAINT ' + QUOTENAME(name) AS nvarchar(max)), N';') FROM sys.foreign_keys WHERE OBJECT_NAME(parent_object_id) IN (N'Festivales', N'PerfilesPublicosFestival', N'PropuestasDeCambio', N'PracticasMusicalesDeRegistro', N'TerritoriosSonorosDeRegistro', N'ExpresionesArtisticasDeRegistro', N'ModalidadesParticipacionDeRegistro', N'TiposIngresoDeRegistro', N'LocalizacionesDeRegistro', N'EntidadesAliadasDeRegistro', N'ArchivosDeRegistro')); IF @a IS NOT NULL EXEC (@a);");

            // F1: perfil histórico distinto + vigente igual a la cabecera; F2: solo vigente; F3: sin perfil.
            var f1 = await FestivalAsync(cadena, "F1 con perfil e historia", "Descripción F1", "f1@correo.test", "3000001");
            var f2 = await FestivalAsync(cadena, "F2 con perfil", "Descripción F2", "f2@correo.test", null);
            var f3 = await FestivalAsync(cadena, "F3 sin perfil", "Descripción F3", null, null);
            var f1v1 = await PerfilAsync(cadena, f1, 1, vigente: false, nombre: "F1 versión vieja", descripcion: "Vieja", correo: "viejo@correo.test", telefono: null);
            var f1v2 = await PerfilAsync(cadena, f1, 2, vigente: true, nombre: "F1 con perfil e historia", descripcion: "Descripción F1", correo: "f1@correo.test", telefono: "3000001");
            var f2v1 = await PerfilAsync(cadena, f2, 1, vigente: true, nombre: "F2 con perfil", descripcion: "Descripción F2", correo: "f2@correo.test", telefono: null);
            foreach (var festival in new[] { f1, f2 })
            {
                await ListaAsync(cadena, "PracticasMusicalesDeRegistro", "IdPracticaMusical", "festivales", festival, 1, 2);
                await ListaAsync(cadena, "TerritoriosSonorosDeRegistro", "IdTerritorioSonoro", "festivales", festival, 4);
            }
            foreach (var perfil in new[] { f1v2, f2v1 })
            {
                await ListaAsync(cadena, "PracticasMusicalesDeRegistro", "IdPracticaMusical", "perfiles-publicos-festival", perfil, 1, 2);
                await ListaAsync(cadena, "TerritoriosSonorosDeRegistro", "IdTerritorioSonoro", "perfiles-publicos-festival", perfil, 4);
                await ListaAsync(cadena, "ExpresionesArtisticasDeRegistro", "IdExpresionArtistica", "perfiles-publicos-festival", perfil, 7);
                await ListaAsync(cadena, "TiposIngresoDeRegistro", "IdTipoIngreso", "perfiles-publicos-festival", perfil, 3);
            }
            await ListaAsync(cadena, "PracticasMusicalesDeRegistro", "IdPracticaMusical", "perfiles-publicos-festival", f1v1, 9); // historia: no cuenta como divergencia
            await EjecutarAsync(cadena, $"INSERT INTO dbo.EntidadesAliadasDeRegistro (ModuloId, RegistroId, NombreEntidadAliada) VALUES (N'perfiles-publicos-festival', N'{f1v2}', N'Entidad aliada')");
            // Archivos: F1 ya tiene uno propio (orden 1) y su perfil vigente dos (material orden 1, afiche orden 1); F2, uno.
            await EjecutarAsync(cadena, $@"
INSERT INTO dbo.ArchivosDeRegistro (ModuloId, RegistroId, ArchivoId, RolArchivo, OrdenVisualizacion) VALUES
 (N'festivales', N'{f1}', 11, N'material', 1),
 (N'perfiles-publicos-festival', N'{f1v2}', 12, N'material', 1),
 (N'perfiles-publicos-festival', N'{f1v2}', 13, N'afiche', 1),
 (N'perfiles-publicos-festival', N'{f2v1}', 14, N'material', 1)");
            // Referencias lógicas que se conservan sin FK.
            await EjecutarAsync(cadena, $@"
INSERT INTO dbo.PropuestasDeCambio (ModuloId, RegistroId, Estado, SubregistroId, SubregistroResultanteId, FechaEnvio, FechaDecision, MotivoDeLaDecision, IdOrganizacion)
VALUES (N'festivales', N'{f1}', N'aplicada', N'{f1v1}', N'{f1v2}', SYSUTCDATETIME(), SYSUTCDATETIME(), N'cerrada', 1)");
            await InsertarAsync(cadena, "dbo.CambiosDeRegistro", new()
            {
                ["ModuloId"] = "N'festivales'", ["RegistroId"] = $"N'{f1}'", ["CampoId"] = "N'nombre'", ["ValorAnterior"] = "N'F1 versión vieja'",
                ["ValorNuevo"] = "N'F1 con perfil e historia'", ["ClaseDato"] = "N'publico'", ["Origen"] = "N'migracion'", ["PerfilPublicoFestivalId"] = f1v2.ToString(CultureInfo.InvariantCulture),
            });

            var perfilesAntes = await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival");
            var cabeceraAntes = await FirmaAsync(cadena, "dbo.Festivales");
            var cambiosAntes = await FirmaAsync(cadena, "dbo.CambiosDeRegistro");
            var propuestasAntes = await FirmaAsync(cadena, "dbo.PropuestasDeCambio");
            var hijasAntes = await HijasDelModuloAsync(cadena);
            var restriccionesAntes = await RestriccionesDeModuloAsync(cadena);
            Assert.Equal(3, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.PerfilesPublicosFestival"));
            Assert.Equal(8, await Escalar(cadena, "SELECT COUNT(*) FROM sys.check_constraints WHERE definition LIKE N'%perfiles-publicos-festival%'"));

            // PRECONDICIÓN 1: sin respaldo no se toca nada.
            await AfirmarAbortoAsync(cadena, retiro, 50081);
            await AfirmarIntactoAsync(cadena, perfilesAntes, hijasAntes);

            // El respaldo (guion manual). Todas sus copias cuadran con el origen.
            await EjecutarLotesAsync(cadena, Path.Combine(carpeta, "respaldo_perfiles_publicos_festival.sql"));
            var sufijo = (string)(await Escalar(cadena, "SELECT TOP (1) RIGHT(name, 8) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'respaldo') AND name LIKE N'PerfilesPublicosFestival[_]%'"))!;
            Assert.Equal(3, await Escalar(cadena, $"SELECT COUNT(*) FROM respaldo.PerfilesPublicosFestival_{sufijo}"));

            // PRECONDICIÓN 1b: el respaldo debe seguir cuadrando con la tabla (un perfil nuevo tras la copia lo invalida).
            var extra = await PerfilAsync(cadena, f3, 1, vigente: true, nombre: "F3 sin perfil", descripcion: "Descripción F3", correo: null, telefono: null);
            await AfirmarAbortoAsync(cadena, retiro, 50082);
            await EjecutarAsync(cadena, $"DELETE FROM dbo.PerfilesPublicosFestival WHERE IdPerfilPublicoFestival = {extra}");
            await AfirmarIntactoAsync(cadena, perfilesAntes, hijasAntes);

            // PRECONDICIÓN 2: la cabecera difiere del perfil vigente aprobado.
            await EjecutarAsync(cadena, $"UPDATE dbo.Festivales SET NombreFestival = N'F2 editada a mano' WHERE IdFestival = {f2}");
            await AfirmarAbortoAsync(cadena, retiro, 50084);
            await EjecutarAsync(cadena, $"UPDATE dbo.Festivales SET NombreFestival = N'F2 con perfil' WHERE IdFestival = {f2}");

            // PRECONDICIÓN 3: propuesta en vuelo apoyada en un perfil.
            await EjecutarAsync(cadena, $@"
INSERT INTO dbo.PropuestasDeCambio (ModuloId, RegistroId, Estado, SubregistroId, IdOrganizacion) VALUES (N'festivales', N'{f2}', N'borrador', N'{f2v1}', 1)");
            await AfirmarAbortoAsync(cadena, retiro, 50085);
            await EjecutarAsync(cadena, $"DELETE FROM dbo.PropuestasDeCambio WHERE Estado = N'borrador' AND SubregistroId = N'{f2v1}'");

            // PRECONDICIÓN 1c: una fila hija nueva tras la copia también invalida el respaldo (archivo de un perfil que ni existe).
            await EjecutarAsync(cadena, "INSERT INTO dbo.ArchivosDeRegistro (ModuloId, RegistroId, ArchivoId, RolArchivo, OrdenVisualizacion) VALUES (N'perfiles-publicos-festival', N'999999', 15, N'material', 1)");
            await AfirmarAbortoAsync(cadena, retiro, 50083);
            await EjecutarAsync(cadena, "DELETE FROM dbo.ArchivosDeRegistro WHERE RegistroId = N'999999'");
            await AfirmarIntactoAsync(cadena, perfilesAntes, hijasAntes);
            Assert.Equal(cabeceraAntes, await FirmaAsync(cadena, "dbo.Festivales"));

            // EL RETIRO.
            await AplicarAsync(cadena, retiro);
            Assert.Null(await Escalar(cadena, "SELECT OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U')"));
            Assert.Equal(0, await Escalar(cadena, "SELECT COUNT(*) FROM sys.foreign_keys WHERE name LIKE N'%PerfilesPublicosFestival%'"));
            Assert.Equal(0, await Escalar(cadena, "SELECT COUNT(*) FROM sys.check_constraints WHERE definition LIKE N'%perfiles-publicos-festival%'"));
            foreach (var hija in Hijas)
                Assert.Equal(0, await Escalar(cadena, $"SELECT COUNT(*) FROM dbo.{hija} WHERE ModuloId = N'perfiles-publicos-festival'"));
            // Lo demás, exactamente como estaba: cabecera, historia, propuestas y las listas de la cabecera.
            Assert.Equal(cabeceraAntes, await FirmaAsync(cadena, "dbo.Festivales"));
            Assert.Equal(cambiosAntes, await FirmaAsync(cadena, "dbo.CambiosDeRegistro"));
            Assert.Equal(propuestasAntes, await FirmaAsync(cadena, "dbo.PropuestasDeCambio"));
            Assert.Equal(4, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.PracticasMusicalesDeRegistro WHERE ModuloId = N'festivales'"));
            // Las referencias lógicas se conservan sin clave foránea.
            Assert.Equal(1, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.CambiosDeRegistro WHERE PerfilPublicoFestivalId IS NOT NULL"));
            Assert.Equal(1, await Escalar(cadena, "SELECT COUNT(*) FROM dbo.PropuestasDeCambio WHERE SubregistroResultanteId IS NOT NULL"));
            // Los archivos de los perfiles pasaron al Festival, a continuación de los propios (UQ_ArchivosDeRegistro).
            Assert.Equal("11:material:1|12:material:2|13:afiche:1", await Escalar(cadena,
                $"SELECT STRING_AGG(CONCAT(ArchivoId, N':', RolArchivo, N':', OrdenVisualizacion), N'|') WITHIN GROUP (ORDER BY ArchivoId) FROM dbo.ArchivosDeRegistro WHERE ModuloId = N'festivales' AND RegistroId = N'{f1}'"));
            Assert.Equal("14:material:1", await Escalar(cadena,
                $"SELECT STRING_AGG(CONCAT(ArchivoId, N':', RolArchivo, N':', OrdenVisualizacion), N'|') FROM dbo.ArchivosDeRegistro WHERE ModuloId = N'festivales' AND RegistroId = N'{f2}'"));
            // El módulo ya no es admisible, el resto sí.
            await Assert.ThrowsAsync<SqlException>(() => EjecutarAsync(cadena, "INSERT INTO dbo.PracticasMusicalesDeRegistro (ModuloId, RegistroId, IdPracticaMusical) VALUES (N'perfiles-publicos-festival', N'1', 1)"));
            await EjecutarAsync(cadena, "INSERT INTO dbo.PracticasMusicalesDeRegistro (ModuloId, RegistroId, IdPracticaMusical) VALUES (N'ediciones-festival', N'1', 1)");
            await EjecutarAsync(cadena, "DELETE FROM dbo.PracticasMusicalesDeRegistro WHERE ModuloId = N'ediciones-festival' AND RegistroId = N'1' AND IdPracticaMusical = 1");

            // IDEMPOTENTE: la segunda ejecución no hace nada.
            var archivosDespues = await FirmaAsync(cadena, "dbo.ArchivosDeRegistro");
            await AplicarAsync(cadena, retiro);
            Assert.Equal(archivosDespues, await FirmaAsync(cadena, "dbo.ArchivosDeRegistro"));
            Assert.Equal(cabeceraAntes, await FirmaAsync(cadena, "dbo.Festivales"));

            // LA REVERSA: tabla idéntica a la copia, hijas, archivos y CHECK devueltos.
            await EjecutarLotesAsync(cadena, Path.Combine(carpeta, "reversa_retiro_perfiles_publicos_festival.sql"));
            Assert.Equal(perfilesAntes, await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival"));
            Assert.Equal(0, await Escalar(cadena, $"SELECT (SELECT COUNT(*) FROM (SELECT * FROM dbo.PerfilesPublicosFestival EXCEPT SELECT * FROM respaldo.PerfilesPublicosFestival_{sufijo}) a) + (SELECT COUNT(*) FROM (SELECT * FROM respaldo.PerfilesPublicosFestival_{sufijo} EXCEPT SELECT * FROM dbo.PerfilesPublicosFestival) b)"));
            Assert.Equal(hijasAntes, await HijasDelModuloAsync(cadena));
            Assert.Equal(restriccionesAntes, await RestriccionesDeModuloAsync(cadena));
            Assert.Equal(8, await Escalar(cadena, "SELECT COUNT(*) FROM sys.check_constraints WHERE definition LIKE N'%perfiles-publicos-festival%'"));
            Assert.Equal(8, await Escalar(cadena, "SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.PerfilesPublicosFestival')"));
            Assert.Equal("11:material:1:festivales:" + f1, await Escalar(cadena, $"SELECT CONCAT(ArchivoId, N':', RolArchivo, N':', OrdenVisualizacion, N':', ModuloId, N':', RegistroId) FROM dbo.ArchivosDeRegistro WHERE ArchivoId = 11"));
            Assert.Equal("12:material:1:perfiles-publicos-festival:" + f1v2, await Escalar(cadena, $"SELECT CONCAT(ArchivoId, N':', RolArchivo, N':', OrdenVisualizacion, N':', ModuloId, N':', RegistroId) FROM dbo.ArchivosDeRegistro WHERE ArchivoId = 12"));
            Assert.Equal(cabeceraAntes, await FirmaAsync(cadena, "dbo.Festivales"));
            // La reversa no se puede repetir sobre una tabla que ya existe.
            await AfirmarAbortoAsync(cadena, Path.Combine(carpeta, "reversa_retiro_perfiles_publicos_festival.sql"), 50101);
            // Y el retiro puede volver a aplicarse sobre lo restaurado (el respaldo sigue cuadrando).
            await AplicarAsync(cadena, retiro);
            Assert.Null(await Escalar(cadena, "SELECT OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U')"));
            Assert.Equal(cabeceraAntes, await FirmaAsync(cadena, "dbo.Festivales"));
        }
        finally
        {
            await EjecutarAsync(
                cadenaMaestra,
                $"IF DB_ID(N'{nombreBase}') IS NOT NULL BEGIN ALTER DATABASE [{nombreBase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{nombreBase}]; END");
        }
    }

    /// <summary>Una base nueva (tabla vacía, sin respaldo) aplica el retiro sin exigir nada: no hay datos que perder.</summary>
    [HechoSqlServer]
    public async Task En_una_base_sin_datos_el_retiro_no_exige_respaldo()
    {
        var cadenaMaestra = ArnesSqlServer.CadenaMaestra();
        var nombreBase = ArnesSqlServer.NuevoNombreDeBase();
        ArnesSqlServer.ExigirNombreDesechable(nombreBase);
        var cadena = ArnesSqlServer.CadenaHacia(cadenaMaestra, nombreBase);

        await EjecutarAsync(cadenaMaestra, $"CREATE DATABASE [{nombreBase}];");
        try
        {
            foreach (var guion in Directory.GetFiles(RutasDelRepositorio.Esquema(), "*.sql").OrderBy(ruta => Path.GetFileName(ruta), StringComparer.Ordinal))
                await AplicarAsync(cadena, guion);
            Assert.Null(await Escalar(cadena, "SELECT OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U')"));
            Assert.Equal(0, await Escalar(cadena, "SELECT COUNT(*) FROM sys.check_constraints WHERE definition LIKE N'%perfiles-publicos-festival%'"));
        }
        finally
        {
            await EjecutarAsync(
                cadenaMaestra,
                $"IF DB_ID(N'{nombreBase}') IS NOT NULL BEGIN ALTER DATABASE [{nombreBase}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{nombreBase}]; END");
        }
    }

    private static async Task AfirmarAbortoAsync(string cadena, string guion, int numero)
    {
        var excepcion = await Assert.ThrowsAsync<InvalidOperationException>(() => AplicarAsync(cadena, guion));
        var sql = Assert.IsType<SqlException>(excepcion.InnerException);
        Assert.Equal(numero, sql.Number);
    }

    private static async Task AfirmarIntactoAsync(string cadena, string perfilesAntes, string hijasAntes)
    {
        Assert.Equal(perfilesAntes, await FirmaAsync(cadena, "dbo.PerfilesPublicosFestival"));
        Assert.Equal(hijasAntes, await HijasDelModuloAsync(cadena));
    }

    private static async Task<string> HijasDelModuloAsync(string cadena)
    {
        var partes = new List<string>();
        foreach (var hija in Hijas)
            partes.Add(hija + "=" + await Escalar(cadena, $"SELECT CAST(CHECKSUM_AGG(CHECKSUM(*)) AS nvarchar(40)) + N'/' + CAST(COUNT(*) AS nvarchar(20)) FROM dbo.{hija} WHERE ModuloId = N'perfiles-publicos-festival'"));
        return string.Join(';', partes);
    }

    private static async Task<string> RestriccionesDeModuloAsync(string cadena) =>
        (string)(await Escalar(cadena, "SELECT CAST(CHECKSUM_AGG(CHECKSUM(name, definition)) AS nvarchar(40)) + N'/' + CAST(COUNT(*) AS nvarchar(20)) FROM sys.check_constraints WHERE name LIKE N'CK[_]%[_]Modulo'"))!;

    private static async Task<int> FestivalAsync(string cadena, string nombre, string? descripcion, string? correo, string? telefono)
    {
        await InsertarAsync(cadena, "dbo.Festivales", new()
        {
            ["NombreFestival"] = $"N'{nombre}'", ["EstadoRegistro"] = "N'publicado'", ["NivelCobertura"] = "N'nacional'",
            ["Descripcion"] = Texto(descripcion), ["CorreoFestival"] = Texto(correo), ["TelefonoFestival"] = Texto(telefono),
        });
        return Convert.ToInt32(await Escalar(cadena, $"SELECT IdFestival FROM dbo.Festivales WHERE NombreFestival = N'{nombre}'"), CultureInfo.InvariantCulture);
    }

    private static async Task<int> PerfilAsync(string cadena, int festival, int numero, bool vigente, string nombre, string? descripcion, string? correo, string? telefono)
    {
        await InsertarAsync(cadena, "dbo.PerfilesPublicosFestival", new()
        {
            ["FestivalOrigenId"] = festival.ToString(CultureInfo.InvariantCulture), ["NumeroPublicacion"] = numero.ToString(CultureInfo.InvariantCulture),
            ["EsVigente"] = vigente ? "1" : "0", ["Nombre"] = Texto(nombre), ["Descripcion"] = Texto(descripcion), ["NivelCobertura"] = "N'nacional'",
            ["CodigoDepartamento"] = "NULL", ["CodigoMunicipio"] = "NULL", ["Periodicidad"] = "NULL",
            ["CorreoContacto"] = Texto(correo), ["TelefonoContacto"] = Texto(telefono),
        });
        return Convert.ToInt32(await Escalar(cadena, $"SELECT IdPerfilPublicoFestival FROM dbo.PerfilesPublicosFestival WHERE FestivalOrigenId = {festival} AND NumeroPublicacion = {numero}"), CultureInfo.InvariantCulture);
    }

    private static Task ListaAsync(string cadena, string tabla, string columna, string modulo, int registro, params int[] valores) =>
        EjecutarAsync(cadena, string.Join(";", valores.Select(v =>
            $"INSERT INTO dbo.{tabla} (ModuloId, RegistroId, {columna}) VALUES (N'{modulo}', N'{registro}', {v})")));

    /// <summary>Ejecuta un guion manual (con o sin GO) y propaga el error si lo hay.</summary>
    private static Task EjecutarLotesAsync(string cadena, string ruta) => AplicarAsync(cadena, ruta);

    private static string Texto(string? valor) => valor is null ? "NULL" : $"N'{valor}'";

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
