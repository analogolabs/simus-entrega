-- =============================================
-- Nombre del script: V20261110_32__modulo_perfiles_publicos_festival.sql
-- Descripcion: El perfil publico de un Festival era el «modulo» `versiones-festival` en las tablas
--              hijas del registro (practicas, territorios, expresiones, modalidades, ingresos,
--              localizaciones, entidades aliadas, archivos). Pasa a `perfiles-publicos-festival`,
-- como el resto de la nomenclatura (V20261110_31, docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10).
-- Autor: Edder Jiménez
-- Fecha: 2026-11-10
-- Version: 20261110.32 (linea interna de desarrollo)
--
-- SOLO CAMBIA EL TEXTO DE ESE DISCRIMINADOR: en las filas que lo guardan y en las restricciones que
-- lo admiten. Ni un registro nuevo ni uno menos. Las restricciones se leen de la propia base, se
-- sueltan, se actualizan las filas y se vuelven a crear con el texto nuevo, de modo que no hay que
-- adivinar que tablas lo admiten.
--
-- IDEMPOTENTE: si ya no queda nada que renombrar, no hace nada.
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'tempdb..#Restricciones') IS NOT NULL DROP TABLE #Restricciones;

SELECT
    QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) AS Tabla,
    QUOTENAME(cc.name) AS Restriccion,
    cc.definition AS Definicion
INTO #Restricciones
FROM sys.check_constraints cc
JOIN sys.tables t ON t.object_id = cc.parent_object_id
WHERE cc.definition LIKE N'%versiones-festival%';

DECLARE @tabla nvarchar(300), @restriccion nvarchar(300), @definicion nvarchar(max), @sql nvarchar(max);

-- 1) Soltar las restricciones que lo admiten.
DECLARE soltar CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla, Restriccion FROM #Restricciones;
OPEN soltar;
FETCH NEXT FROM soltar INTO @tabla, @restriccion;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE ' + @tabla + N' DROP CONSTRAINT ' + @restriccion + N';';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM soltar INTO @tabla, @restriccion;
END;
CLOSE soltar;
DEALLOCATE soltar;

-- 2) Las filas: toda tabla con una columna ModuloId de texto que lo guarde.
DECLARE actualizar CURSOR LOCAL FAST_FORWARD FOR
    SELECT QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name)
      FROM sys.columns c
      JOIN sys.tables t ON t.object_id = c.object_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
     WHERE c.name = N'ModuloId' AND ty.name IN (N'nvarchar', N'varchar');
OPEN actualizar;
FETCH NEXT FROM actualizar INTO @tabla;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'UPDATE ' + @tabla + N' SET ModuloId = N''perfiles-publicos-festival'' WHERE ModuloId = N''versiones-festival'';';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM actualizar INTO @tabla;
END;
CLOSE actualizar;
DEALLOCATE actualizar;

-- 3) Volver a crear las restricciones con el texto nuevo.
DECLARE crear CURSOR LOCAL FAST_FORWARD FOR SELECT Tabla, Restriccion, Definicion FROM #Restricciones;
OPEN crear;
FETCH NEXT FROM crear INTO @tabla, @restriccion, @definicion;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE ' + @tabla + N' ADD CONSTRAINT ' + @restriccion + N' CHECK '
             + REPLACE(@definicion, N'versiones-festival', N'perfiles-publicos-festival') + N';';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM crear INTO @tabla, @restriccion, @definicion;
END;
CLOSE crear;
DEALLOCATE crear;

DROP TABLE #Restricciones;

COMMIT TRANSACTION;
