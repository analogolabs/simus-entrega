/*
  Respaldo de dbo.PerfilesPublicosFestival y de todo lo que cuelga de ella (retiro del perfil público del Festival, PR-1).

  NO ES UNA MIGRACIÓN DbUp: vive fuera de schema/ y se ejecuta a mano, sobre una base propia o con autorización
  expresa, ANTES de cualquier fase que sobrescriba o borre (PR-3 en adelante).

  QUÉ HACE. Crea el esquema `respaldo` si falta y copia (SELECT INTO) a tablas con sufijo de fecha AAAAMMDD:
    · la tabla entera de perfiles;
    · las ocho tablas hijas genéricas filtradas por ModuloId = 'perfiles-publicos-festival';
    · las referencias en PropuestasDeCambio, PropuestasDeCambioCampos, RevisionesDeRegistroObservaciones y CambiosDeRegistro;
    · las columnas de dbo.Festivales que una fase posterior puede sobrescribir (incluidas las cinco del organizador).
  NO BORRA NI MODIFICA NADA del esquema dbo. Si una tabla de respaldo del mismo día ya existe, se detiene con error
  (no sobrescribe un respaldo): para repetirlo el mismo día hay que renombrar o retirar la anterior a mano.

  Exportación a CSV: fuera del repositorio, p. ej. con `sqlcmd -s"," -W` o bcp, a una ruta persistente (nunca a git).

  Uso: sqlcmd -S <servidor> -d <base> -i respaldo_perfiles_publicos_festival.sql
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;

IF SCHEMA_ID(N'respaldo') IS NULL EXEC (N'CREATE SCHEMA respaldo');

DECLARE @sufijo nchar(8) = CONVERT(nchar(8), GETDATE(), 112);
DECLARE @modulo nvarchar(60) = N'perfiles-publicos-festival';

DECLARE @copias TABLE (Nombre sysname, Origen nvarchar(max));
INSERT INTO @copias (Nombre, Origen) VALUES
 (N'PerfilesPublicosFestival', N'SELECT * FROM dbo.PerfilesPublicosFestival'),
 (N'PracticasMusicalesDeRegistro', N'SELECT * FROM dbo.PracticasMusicalesDeRegistro WHERE ModuloId = N''perfiles-publicos-festival'''),
 (N'TerritoriosSonorosDeRegistro', N'SELECT * FROM dbo.TerritoriosSonorosDeRegistro WHERE ModuloId = N''perfiles-publicos-festival'''),
 (N'ExpresionesArtisticasDeRegistro', N'SELECT * FROM dbo.ExpresionesArtisticasDeRegistro WHERE ModuloId = N''perfiles-publicos-festival'''),
 (N'ModalidadesParticipacionDeRegistro', N'SELECT * FROM dbo.ModalidadesParticipacionDeRegistro WHERE ModuloId = N''perfiles-publicos-festival'''),
 (N'TiposIngresoDeRegistro', N'SELECT * FROM dbo.TiposIngresoDeRegistro WHERE ModuloId = N''perfiles-publicos-festival'''),
 (N'LocalizacionesDeRegistro', N'SELECT * FROM dbo.LocalizacionesDeRegistro WHERE ModuloId = N''perfiles-publicos-festival'''),
 (N'EntidadesAliadasDeRegistro', N'SELECT * FROM dbo.EntidadesAliadasDeRegistro WHERE ModuloId = N''perfiles-publicos-festival'''),
 (N'ArchivosDeRegistro', N'SELECT * FROM dbo.ArchivosDeRegistro WHERE ModuloId = N''perfiles-publicos-festival'''),
 (N'PropuestasDeCambio_festivales', N'SELECT * FROM dbo.PropuestasDeCambio WHERE ModuloId = N''festivales'' AND (SubregistroId IS NOT NULL OR SubregistroResultanteId IS NOT NULL)'),
 (N'PropuestasDeCambioCampos_perfil', N'SELECT * FROM dbo.PropuestasDeCambioCampos WHERE CampoId LIKE N''perfilPublico.%'''),
 (N'RevisionesObservaciones_perfil', N'SELECT * FROM dbo.RevisionesDeRegistroObservaciones WHERE CampoId LIKE N''perfilPublico.%'' OR Ambito = N''subregistro'''),
 (N'CambiosDeRegistro_perfil', N'SELECT * FROM dbo.CambiosDeRegistro WHERE PerfilPublicoFestivalId IS NOT NULL'),
 (N'Festivales_columnas', N'SELECT IdFestival, NombreFestival, Descripcion, NivelCobertura, CodigoDepartamento, CodigoMunicipio, Periodicidad, PeriodicidadDetalle, CorreoFestival, TelefonoFestival, InstagramFestival, FacebookFestival, SitioWebFestival, OtroEnlaceFestival, ObservacionesContacto, Director, TipoOrganizadorId, OtroTipoOrganizador, PerteneceAOrganizacionColectiva, NombreOrganizacionColectiva, FechaActualizacion FROM dbo.Festivales');

-- Primero verifica que NINGÚN destino exista: o se copia todo o no se copia nada.
DECLARE @existentes nvarchar(max) = (
    SELECT STRING_AGG(Nombre + N'_' + @sufijo, N', ') FROM @copias
    WHERE OBJECT_ID(N'respaldo.' + QUOTENAME(Nombre + N'_' + @sufijo)) IS NOT NULL);
IF @existentes IS NOT NULL
    THROW 50001, N'Ya existe un respaldo de hoy; no se sobrescribe. Retire o renombre las tablas respaldo.* con el sufijo de hoy.', 1;

DECLARE @nombre sysname, @origen nvarchar(max), @sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Nombre, Origen FROM @copias;
OPEN c;
FETCH NEXT FROM c INTO @nombre, @origen;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'SELECT * INTO respaldo.' + QUOTENAME(@nombre + N'_' + @sufijo) + N' FROM (' + @origen + N') AS origen;';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM c INTO @nombre, @origen;
END
CLOSE c; DEALLOCATE c;

-- Cuadre: el conteo de cada copia debe ser el de su origen.
DECLARE @cuadre TABLE (Copia sysname, Origen bigint, Respaldo bigint);
DECLARE c2 CURSOR LOCAL FAST_FORWARD FOR SELECT Nombre, Origen FROM @copias;
OPEN c2;
FETCH NEXT FROM c2 INTO @nombre, @origen;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'SELECT N''' + @nombre + N''', (SELECT COUNT_BIG(*) FROM (' + @origen + N') AS o), (SELECT COUNT_BIG(*) FROM respaldo.'
             + QUOTENAME(@nombre + N'_' + @sufijo) + N');';
    INSERT INTO @cuadre EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM c2 INTO @nombre, @origen;
END
CLOSE c2; DEALLOCATE c2;

SELECT Copia, Origen, Respaldo, CASE WHEN Origen = Respaldo THEN N'ok' ELSE N'DIFIERE' END AS Resultado FROM @cuadre ORDER BY Copia;
IF EXISTS (SELECT 1 FROM @cuadre WHERE Origen <> Respaldo)
    THROW 50002, N'El conteo de una copia de respaldo no coincide con su origen.', 1;
