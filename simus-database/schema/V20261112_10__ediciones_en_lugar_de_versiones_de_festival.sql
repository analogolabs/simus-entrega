-- =============================================
-- Nombre del script: V20261112_10__ediciones_en_lugar_de_versiones_de_festival.sql
-- Descripcion: «Version» deja de usarse en el vocabulario de los Festivales. Las columnas
--              de dbo.Festivales que dicen «version» cuentan EDICIONES: la cantidad de ediciones, la
--              fecha de la ultima y el estado, las fechas y la existencia de la edicion del año en
--              curso. La direccion decidio (12 nov 2026) que pasen a llamarse «edicion». El perfil
--              publico se llama «perfil publico» desde V20261110_31.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-12
-- Version: 20261112.10 (linea interna de desarrollo)
--
-- SOLO CAMBIAN NOMBRES. Ni una fila, ni un valor, ni un tipo. Los guiones ya aplicados NO se tocan
-- (DbUp los registra por nombre): este renombra encima de lo que dejaron.
--
--   dbo.Festivales.NumeroVersiones                -> NumeroEdiciones
--   dbo.Festivales.FechaUltimaVersion             -> FechaUltimaEdicion
--   dbo.Festivales.TieneVersionVigenteAnoActual   -> TieneEdicionVigenteAnoActual
--   dbo.Festivales.EstadoVersionAnoActual         -> EstadoEdicionAnoActual
--   dbo.Festivales.FechaInicioVersionActual       -> FechaInicioEdicionActual
--   dbo.Festivales.FechaFinVersionActual          -> FechaFinEdicionActual
--   CK_Festivales_NumeroVersiones                 -> CK_Festivales_NumeroEdiciones      (se recrea: ver paso 0)
--   CK_Festivales_FechasVersionActual             -> CK_Festivales_FechasEdicionActual  (se recrea: ver paso 0)
--   DF_Festivales_TieneVersionVigente             -> DF_Festivales_TieneEdicionVigente
--
-- Ademas, dos textos que no son nombres de columna:
--   * dbo.Participaciones.DatosFormularioJson guarda la solicitud entera como JSON y su clave
--     "festivalVersions" (cuantas ediciones lleva el Festival) pasa a "festivalEditions", como el
--     contrato de la API: sin esto, lo ya enviado perderia ese dato al leerse.
--   * El permiso «festivales.normalizar» se llamaba «Normalizar versiones».
--
-- IDEMPOTENTE: cada paso comprueba su estado antes de actuar.
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

-- 0) SQL Server no deja renombrar una columna que usa una restriccion CHECK («participates in enforced
--    dependencies»): se quitan las dos, se renombran las columnas y se vuelven a crear con el nombre nuevo
--    y las MISMAS reglas, validando las filas que ya existen (WITH CHECK, para que sigan «de confianza»).
IF OBJECT_ID(N'dbo.CK_Festivales_NumeroVersiones') IS NOT NULL
    ALTER TABLE dbo.Festivales DROP CONSTRAINT CK_Festivales_NumeroVersiones;
IF OBJECT_ID(N'dbo.CK_Festivales_FechasVersionActual') IS NOT NULL
    ALTER TABLE dbo.Festivales DROP CONSTRAINT CK_Festivales_FechasVersionActual;

-- 1) Las columnas.
DECLARE @columnas TABLE (Antiguo sysname NOT NULL, Nuevo sysname NOT NULL);
INSERT INTO @columnas (Antiguo, Nuevo) VALUES
    (N'NumeroVersiones',              N'NumeroEdiciones'),
    (N'FechaUltimaVersion',           N'FechaUltimaEdicion'),
    (N'TieneVersionVigenteAnoActual', N'TieneEdicionVigenteAnoActual'),
    (N'EstadoVersionAnoActual',       N'EstadoEdicionAnoActual'),
    (N'FechaInicioVersionActual',     N'FechaInicioEdicionActual'),
    (N'FechaFinVersionActual',        N'FechaFinEdicionActual');

DECLARE @antiguo sysname, @nuevo sysname, @objeto nvarchar(300), @destino nvarchar(300);
DECLARE columnas_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT Antiguo, Nuevo FROM @columnas;
OPEN columnas_cursor;
FETCH NEXT FROM columnas_cursor INTO @antiguo, @nuevo;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.Festivales', @antiguo) IS NOT NULL AND COL_LENGTH(N'dbo.Festivales', @nuevo) IS NULL
    BEGIN
        SET @objeto = N'dbo.Festivales.' + @antiguo;
        EXEC sp_rename @objeto, @nuevo, N'COLUMN';
    END
    FETCH NEXT FROM columnas_cursor INTO @antiguo, @nuevo;
END
CLOSE columnas_cursor;
DEALLOCATE columnas_cursor;

-- 2) Las restricciones: el nombre dice de que hablan. Las CHECK se recrean (por EXEC: las columnas nuevas
--    no existen cuando se compila el lote) y el valor por omision se renombra.
IF OBJECT_ID(N'dbo.CK_Festivales_NumeroEdiciones') IS NULL
    EXEC (N'ALTER TABLE dbo.Festivales WITH CHECK ADD CONSTRAINT CK_Festivales_NumeroEdiciones CHECK (NumeroEdiciones IS NULL OR NumeroEdiciones >= 0)');
IF OBJECT_ID(N'dbo.CK_Festivales_FechasEdicionActual') IS NULL
    EXEC (N'ALTER TABLE dbo.Festivales WITH CHECK ADD CONSTRAINT CK_Festivales_FechasEdicionActual CHECK (FechaFinEdicionActual IS NULL OR FechaInicioEdicionActual IS NULL OR FechaFinEdicionActual >= FechaInicioEdicionActual)');

DECLARE @restricciones TABLE (Antiguo sysname NOT NULL, Nuevo sysname NOT NULL);
INSERT INTO @restricciones (Antiguo, Nuevo) VALUES
    (N'DF_Festivales_TieneVersionVigente', N'DF_Festivales_TieneEdicionVigente');

DECLARE restricciones_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT Antiguo, Nuevo FROM @restricciones;
OPEN restricciones_cursor;
FETCH NEXT FROM restricciones_cursor INTO @antiguo, @nuevo;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @objeto = N'dbo.' + @antiguo;
    SET @destino = N'dbo.' + @nuevo;
    IF OBJECT_ID(@objeto) IS NOT NULL AND OBJECT_ID(@destino) IS NULL
        EXEC sp_rename @objeto, @nuevo, N'OBJECT';
    FETCH NEXT FROM restricciones_cursor INTO @antiguo, @nuevo;
END
CLOSE restricciones_cursor;
DEALLOCATE restricciones_cursor;

-- 3) La solicitud de participacion guardada como JSON: la clave nueva.
IF OBJECT_ID(N'dbo.Participaciones', N'U') IS NOT NULL
    UPDATE dbo.Participaciones
       SET DatosFormularioJson = REPLACE(DatosFormularioJson, N'"festivalVersions"', N'"festivalEditions"')
     WHERE DatosFormularioJson LIKE N'%"festivalVersions"%';

-- 4) El nombre del permiso.
IF OBJECT_ID(N'dbo.Permisos', N'U') IS NOT NULL
    UPDATE dbo.Permisos
       SET NombrePermiso = N'Normalizar ediciones',
           DescripcionPermiso = N'Lanzar la normalizacion masiva de ediciones historicas. Hoy: PoliticaFuncionario.'
     WHERE CodigoPermiso = N'festivales.normalizar'
       AND NombrePermiso = N'Normalizar versiones';

COMMIT TRANSACTION;
