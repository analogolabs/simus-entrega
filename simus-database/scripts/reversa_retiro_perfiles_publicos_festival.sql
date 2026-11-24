/*
  SIMUS · REVERSA del retiro de dbo.PerfilesPublicosFestival (PR-8, V20261120_10)

  QUÉ HACE. Devuelve la base al estado anterior al retiro, desde la copia que dejó el guion de respaldo
  (simus-database/scripts/respaldo_perfiles_publicos_festival.sql, esquema `respaldo`, la copia más reciente que tenga la tabla
  y sus ocho hijas):
    1. Recrea dbo.PerfilesPublicosFestival con su DDL FINAL (V20260824_02 y los ALTER posteriores, con los nombres de
       V20261110_31): 39 columnas, PK, UQ_..._Festival_Numero, UX_..._Festival_Vigente (filtrado), IX_..._TipologiaFestivalId,
       las 8 claves foráneas, los 3 CHECK y el DEFAULT de FechaCreacion.
    2. Restablece el módulo `perfiles-publicos-festival` en los CK_<tabla>_Modulo de las ocho tablas hijas.
    3. Devuelve los archivos que el retiro reapuntó al Festival a su perfil (mismo IdArchivoDeRegistro, módulo, registro y orden).
    4. Repuebla la tabla (con su mismo IdPerfilPublicoFestival) y las filas hijas (con sus mismos identificadores) desde el
       respaldo.
    5. Comprueba, fila a fila, que la tabla restaurada es EXACTAMENTE la copia (EXCEPT en los dos sentidos) y que cada hija
       tiene el conteo de su copia. Si algo no cuadra, THROW y no queda nada a medias.

  NO TOCA nada más: las propuestas, las notas y la cabecera ya estaban a salvo antes del retiro. La API del PR-8 no lee esta
  tabla: para volver a usarla hay que desplegar también el código anterior al PR-8. Es manual y debe correrse con la API
  parada. NO es una migración DbUp: va FUERA de schema/ a propósito. Una sola transacción. Si la tabla ya existe o no hay
  respaldo, se detiene con error y no cambia nada.

  Uso: sqlcmd -S <servidor> -d <base> -I -b -i reversa_retiro_perfiles_publicos_festival.sql
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U') IS NOT NULL
    THROW 50101, N'Reversa del PR-8: dbo.PerfilesPublicosFestival ya existe; no hay nada que revertir.', 1;

DECLARE @hijas TABLE (Tabla sysname PRIMARY KEY);
INSERT INTO @hijas (Tabla) VALUES
    (N'PracticasMusicalesDeRegistro'), (N'TerritoriosSonorosDeRegistro'), (N'ExpresionesArtisticasDeRegistro'),
    (N'ModalidadesParticipacionDeRegistro'), (N'TiposIngresoDeRegistro'), (N'LocalizacionesDeRegistro'),
    (N'EntidadesAliadasDeRegistro'), (N'ArchivosDeRegistro');

DECLARE @sufijo nchar(8) = (
    SELECT TOP (1) RIGHT(t.name, 8)
      FROM sys.tables t
     WHERE t.schema_id = SCHEMA_ID(N'respaldo')
       AND t.name LIKE N'PerfilesPublicosFestival[_][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
       AND (SELECT COUNT(*) FROM @hijas h
             WHERE OBJECT_ID(N'respaldo.' + QUOTENAME(h.Tabla + N'_' + RIGHT(t.name, 8)), N'U') IS NOT NULL) = 8
     ORDER BY RIGHT(t.name, 8) DESC);
IF @sufijo IS NULL
    THROW 50102, N'Reversa del PR-8: no hay respaldo (respaldo.PerfilesPublicosFestival_AAAAMMDD y sus ocho hijas); no se puede reconstruir.', 1;

BEGIN TRANSACTION;

DECLARE @modulo nvarchar(60) = N'perfiles-publicos-festival';
DECLARE @sql nvarchar(max), @tabla sysname, @aviso nvarchar(2000);

-- 1) La tabla, con su DDL final.
CREATE TABLE dbo.PerfilesPublicosFestival
(
    IdPerfilPublicoFestival          int IDENTITY(1,1) NOT NULL,
    FestivalOrigenId                 int           NOT NULL,
    NumeroPublicacion                int           NOT NULL,
    EsVigente                        bit           NOT NULL,
    Nombre                           nvarchar(240) NOT NULL,
    Descripcion                      nvarchar(1200) NULL,
    NivelCobertura                   nvarchar(40)  NOT NULL,
    CodigoDepartamento               char(2)       NULL,
    CodigoMunicipio                  char(5)       NULL,
    Periodicidad                     nvarchar(80)  NULL,
    CorreoContacto                   nvarchar(180) NULL,
    FechaPublicacion                 datetime2(0)  NOT NULL,
    FechaCreacion                    datetime2(0)  NOT NULL CONSTRAINT DF_PerfilesPublicosFestival_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaInicio                      date          NULL,
    FechaFin                         date          NULL,
    TipologiaFestivalId              int           NULL,
    FuenteFinanciacionPrimariaId     int           NULL,
    FuenteFinanciacionSecundariaId   int           NULL,
    UsaEstampillaProcultura          bit           NULL,
    TelefonoContacto                 nvarchar(80)  NULL,
    Instagram                        nvarchar(500) NULL,
    Facebook                         nvarchar(500) NULL,
    SitioWeb                         nvarchar(500) NULL,
    OtroEnlace                       nvarchar(500) NULL,
    Director                         nvarchar(240) NULL,
    TipoOrganizadorId                int           NULL,
    PracticasMusicalesQueCongrega    nvarchar(500) NULL,
    OtraTipologia                    nvarchar(200) NULL,
    OtraModalidadParticipacion       nvarchar(200) NULL,
    OtraExpresionArtistica           nvarchar(200) NULL,
    OtraFuenteFinanciacionPrimaria   nvarchar(200) NULL,
    OtraFuenteFinanciacionSecundaria nvarchar(200) NULL,
    PerteneceAOrganizacionColectiva  bit           NULL,
    NombreOrganizacionColectiva      nvarchar(500) NULL,
    OtroTipoOrganizador              nvarchar(200) NULL,
    ObservacionesContacto            nvarchar(600) NULL,
    ObservacionesRechazo             nvarchar(4000) NULL,
    EstadoRegistro                   nvarchar(80)  NULL,
    PeriodicidadDetalle              nvarchar(600) NULL,
    CONSTRAINT PK_PerfilesPublicosFestival PRIMARY KEY CLUSTERED (IdPerfilPublicoFestival),
    CONSTRAINT UQ_PerfilesPublicosFestival_Festival_Numero UNIQUE (FestivalOrigenId, NumeroPublicacion),
    CONSTRAINT CK_PerfilesPublicosFestival_FechasEdicion CHECK (FechaFin IS NULL OR FechaInicio IS NULL OR FechaFin >= FechaInicio),
    CONSTRAINT CK_PerfilesPublicosFestival_FuentesDistintas CHECK (FuenteFinanciacionPrimariaId IS NULL OR FuenteFinanciacionSecundariaId IS NULL OR FuenteFinanciacionPrimariaId <> FuenteFinanciacionSecundariaId),
    CONSTRAINT CK_PerfilesPublicosFestival_EstadoRegistro CHECK (EstadoRegistro IS NULL OR EstadoRegistro IN
        (N'borrador', N'en_revision', N'ajustes_solicitados', N'aprobado', N'publicado', N'archivado', N'rechazado'))
);
CREATE UNIQUE NONCLUSTERED INDEX UX_PerfilesPublicosFestival_Festival_Vigente
    ON dbo.PerfilesPublicosFestival (FestivalOrigenId) WHERE EsVigente = 1;
CREATE NONCLUSTERED INDEX IX_PerfilesPublicosFestival_TipologiaFestivalId
    ON dbo.PerfilesPublicosFestival (TipologiaFestivalId);

ALTER TABLE dbo.PerfilesPublicosFestival ADD CONSTRAINT FK_PerfilesPublicosFestival_Festival
    FOREIGN KEY (FestivalOrigenId) REFERENCES dbo.Festivales (IdFestival);
ALTER TABLE dbo.PerfilesPublicosFestival ADD CONSTRAINT FK_PerfilesPublicosFestival_Divipola
    FOREIGN KEY (CodigoDepartamento, CodigoMunicipio) REFERENCES dbo.Divipola (CodigoDepartamento, CodigoMunicipio);
ALTER TABLE dbo.PerfilesPublicosFestival ADD CONSTRAINT FK_PerfilesPublicosFestival_Periodicidades
    FOREIGN KEY (Periodicidad) REFERENCES dbo.Periodicidades (CodigoPeriodicidad);
ALTER TABLE dbo.PerfilesPublicosFestival ADD CONSTRAINT FK_PerfilesPublicosFestival_TipologiaFestival
    FOREIGN KEY (TipologiaFestivalId) REFERENCES dbo.TipologiasFestival (IdTipologiaFestival);
ALTER TABLE dbo.PerfilesPublicosFestival ADD CONSTRAINT FK_PerfilesPublicosFestival_FuenteFinanciacionPrimaria
    FOREIGN KEY (FuenteFinanciacionPrimariaId) REFERENCES dbo.FuentesFinanciacion (IdFuenteFinanciacion);
ALTER TABLE dbo.PerfilesPublicosFestival ADD CONSTRAINT FK_PerfilesPublicosFestival_FuenteFinanciacionSecundaria
    FOREIGN KEY (FuenteFinanciacionSecundariaId) REFERENCES dbo.FuentesFinanciacion (IdFuenteFinanciacion);
ALTER TABLE dbo.PerfilesPublicosFestival ADD CONSTRAINT FK_PerfilesPublicosFestival_TipoOrganizador
    FOREIGN KEY (TipoOrganizadorId) REFERENCES dbo.TiposOrganizador (IdTipoOrganizador);
ALTER TABLE dbo.PerfilesPublicosFestival ADD CONSTRAINT FK_PerfilesPublicosFestival_EstadosContenido
    FOREIGN KEY (EstadoRegistro) REFERENCES dbo.EstadosContenido (CodigoEstado);

-- 2) El módulo vuelve a los CK_<tabla>_Modulo de las ocho hijas.
DECLARE @restriccion sysname, @definicion nvarchar(max), @nueva nvarchar(max);
DECLARE cks CURSOR LOCAL FAST_FORWARD FOR
    SELECT QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name), cc.name, cc.definition
      FROM sys.check_constraints cc
      JOIN sys.tables t ON t.object_id = cc.parent_object_id
      JOIN @hijas h ON h.Tabla = t.name AND t.schema_id = SCHEMA_ID(N'dbo')
     WHERE cc.name = N'CK_' + t.name + N'_Modulo' AND cc.definition NOT LIKE N'%' + @modulo + N'%';
OPEN cks;
FETCH NEXT FROM cks INTO @tabla, @restriccion, @definicion;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @nueva = REPLACE(@definicion, N'[ModuloId]=N''festivales''', N'[ModuloId]=N''' + @modulo + N''' OR [ModuloId]=N''festivales''');
    IF @nueva NOT LIKE N'%' + @modulo + N'%'
    BEGIN
        SET @aviso = CONCAT(N'Reversa del PR-8: no se pudo reabrir ', @restriccion, N': ', @definicion);
        THROW 50103, @aviso, 1;
    END;
    SET @sql = N'ALTER TABLE ' + @tabla + N' DROP CONSTRAINT ' + QUOTENAME(@restriccion) + N';'
             + N' ALTER TABLE ' + @tabla + N' WITH CHECK ADD CONSTRAINT ' + QUOTENAME(@restriccion) + N' CHECK ' + @nueva + N';';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM cks INTO @tabla, @restriccion, @definicion;
END;
CLOSE cks;
DEALLOCATE cks;

-- 3) Los archivos que el retiro reapuntó al Festival vuelven a su perfil (mismo IdArchivoDeRegistro).
SET @sql = N'UPDATE a SET a.ModuloId = b.ModuloId, a.RegistroId = b.RegistroId, a.OrdenVisualizacion = b.OrdenVisualizacion
               FROM dbo.ArchivosDeRegistro a JOIN respaldo.' + QUOTENAME(N'ArchivosDeRegistro_' + @sufijo) + N' b ON b.IdArchivoDeRegistro = a.IdArchivoDeRegistro;';
EXEC sys.sp_executesql @sql;

-- 4) La tabla y las hijas, desde el respaldo, con sus mismos identificadores.
DECLARE @columnas nvarchar(max), @identidad sysname, @copia nvarchar(300);

SET @copia = N'respaldo.' + QUOTENAME(N'PerfilesPublicosFestival_' + @sufijo);
SELECT @columnas = STRING_AGG(CAST(QUOTENAME(c.name) AS nvarchar(max)), N', ') WITHIN GROUP (ORDER BY c.column_id)
  FROM sys.columns c
 WHERE c.object_id = OBJECT_ID(N'dbo.PerfilesPublicosFestival')
   AND EXISTS (SELECT 1 FROM sys.columns b WHERE b.object_id = OBJECT_ID(@copia) AND b.name = c.name);
SET @sql = N'SET IDENTITY_INSERT dbo.PerfilesPublicosFestival ON; INSERT INTO dbo.PerfilesPublicosFestival (' + @columnas + N') SELECT '
         + @columnas + N' FROM ' + @copia + N' ORDER BY IdPerfilPublicoFestival; SET IDENTITY_INSERT dbo.PerfilesPublicosFestival OFF;';
EXEC sys.sp_executesql @sql;

DECLARE hijas CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla FROM @hijas WHERE Tabla <> N'ArchivosDeRegistro';
OPEN hijas;
FETCH NEXT FROM hijas INTO @tabla;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @copia = N'respaldo.' + QUOTENAME(@tabla + N'_' + @sufijo);
    SET @identidad = (SELECT TOP (1) ic.name FROM sys.identity_columns ic WHERE ic.object_id = OBJECT_ID(N'dbo.' + QUOTENAME(@tabla)));
    SET @columnas = NULL;
    SELECT @columnas = STRING_AGG(CAST(QUOTENAME(c.name) AS nvarchar(max)), N', ') WITHIN GROUP (ORDER BY c.column_id)
      FROM sys.columns c
     WHERE c.object_id = OBJECT_ID(N'dbo.' + QUOTENAME(@tabla))
       AND EXISTS (SELECT 1 FROM sys.columns b WHERE b.object_id = OBJECT_ID(@copia) AND b.name = c.name);
    SET @sql = N'SET IDENTITY_INSERT dbo.' + QUOTENAME(@tabla) + N' ON; INSERT INTO dbo.' + QUOTENAME(@tabla) + N' (' + @columnas + N') SELECT ' + @columnas
             + N' FROM ' + @copia + N' b WHERE NOT EXISTS (SELECT 1 FROM dbo.' + QUOTENAME(@tabla) + N' x WHERE x.' + QUOTENAME(@identidad) + N' = b.' + QUOTENAME(@identidad) + N');'
             + N' SET IDENTITY_INSERT dbo.' + QUOTENAME(@tabla) + N' OFF;';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM hijas INTO @tabla;
END;
CLOSE hijas;
DEALLOCATE hijas;

-- 5) Comprobación fila a fila: la tabla restaurada ES la copia, y cada hija tiene el conteo de su copia.
DECLARE @copiaPerfiles nvarchar(300) = N'respaldo.' + QUOTENAME(N'PerfilesPublicosFestival_' + @sufijo);
DECLARE @dif bigint;
SELECT @columnas = STRING_AGG(CAST(QUOTENAME(c.name) AS nvarchar(max)), N', ') WITHIN GROUP (ORDER BY c.column_id)
  FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.PerfilesPublicosFestival');
SET @sql = N'SELECT @d = (SELECT COUNT_BIG(*) FROM (SELECT ' + @columnas + N' FROM dbo.PerfilesPublicosFestival EXCEPT SELECT ' + @columnas + N' FROM ' + @copiaPerfiles + N') a)'
         + N' + (SELECT COUNT_BIG(*) FROM (SELECT ' + @columnas + N' FROM ' + @copiaPerfiles + N' EXCEPT SELECT ' + @columnas + N' FROM dbo.PerfilesPublicosFestival) b);';
EXEC sys.sp_executesql @sql, N'@d bigint OUTPUT', @d = @dif OUTPUT;
IF @dif <> 0
BEGIN
    SET @aviso = CONCAT(N'Reversa del PR-8: la tabla restaurada difiere de la copia en ', @dif, N' fila(s).');
    THROW 50104, @aviso, 1;
END;

DECLARE @enBase bigint, @enCopia bigint;
DECLARE hijas CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla FROM @hijas;
OPEN hijas;
FETCH NEXT FROM hijas INTO @tabla;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'SELECT @a = (SELECT COUNT_BIG(*) FROM dbo.' + QUOTENAME(@tabla) + N' WHERE ModuloId = @m), @b = (SELECT COUNT_BIG(*) FROM respaldo.'
             + QUOTENAME(@tabla + N'_' + @sufijo) + N');';
    EXEC sys.sp_executesql @sql, N'@m nvarchar(60), @a bigint OUTPUT, @b bigint OUTPUT', @m = @modulo, @a = @enBase OUTPUT, @b = @enCopia OUTPUT;
    IF @enBase <> @enCopia
    BEGIN
        SET @aviso = CONCAT(N'Reversa del PR-8: ', @tabla, N' tiene ', @enBase, N' filas con el módulo y su copia ', @enCopia, N'.');
        THROW 50105, @aviso, 1;
    END;
    FETCH NEXT FROM hijas INTO @tabla;
END;
CLOSE hijas;
DEALLOCATE hijas;

COMMIT TRANSACTION;
