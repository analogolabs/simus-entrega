-- =============================================
-- Nombre del script: V20261009_01__idiomas_catalogo_depurado.sql
-- Descripcion: Depuracion del catalogo Idiomas a seis columnas.
--              Retira nombres alternativos, ambito y equivalencia MARC.
--              Conserva codigos e idiomas asociados a publicaciones.
-- Autor: Edder Jiménez
-- Fecha: 2026-10-09
-- Version: 20261009.01 (linea interna de desarrollo)
-- =============================================
-- Antes de desplegar: exportar IdiomasNombres y las columnas retiradas
-- como referencia documental; ensayar en una copia de la base vigente.
-- Para el repositorio institucional se asignara una version SemVer disponible.
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Idiomas', N'U') IS NULL
    THROW 51042, 'Falta el catalogo Idiomas.', 1;
IF OBJECT_ID(N'dbo.PublicacionesEditorialesIdiomas', N'U') IS NULL
    THROW 51042, 'Falta la relacion de idiomas de publicaciones.', 1;
DECLARE @IdiomasAntes int = (SELECT COUNT(*) FROM dbo.Idiomas);
DECLARE @RelacionesAntes int = (SELECT COUNT(*) FROM dbo.PublicacionesEditorialesIdiomas);

IF OBJECT_ID(N'dbo.IdiomasNombres', N'U') IS NOT NULL
    DROP TABLE dbo.IdiomasNombres;

-- Retirar las restricciones que dependen de las columnas eliminadas.
DECLARE @Sql nvarchar(max) = N'';
SELECT @Sql = @Sql + N'ALTER TABLE dbo.Idiomas DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID(N'dbo.Idiomas')
  AND (cc.definition LIKE N'%Ambito%' OR cc.definition LIKE N'%CodigoMarc%');
SELECT @Sql = @Sql + N'ALTER TABLE dbo.Idiomas DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Idiomas') AND c.name IN (N'Ambito', N'CodigoMarc');
IF @Sql <> N'' EXEC sys.sp_executesql @Sql;

IF COL_LENGTH(N'dbo.Idiomas', N'Ambito') IS NOT NULL
    ALTER TABLE dbo.Idiomas DROP COLUMN Ambito;
IF COL_LENGTH(N'dbo.Idiomas', N'CodigoMarc') IS NOT NULL
    ALTER TABLE dbo.Idiomas DROP COLUMN CodigoMarc;

IF (SELECT COUNT(*) FROM dbo.Idiomas) <> @IdiomasAntes
   OR (SELECT COUNT(*) FROM dbo.PublicacionesEditorialesIdiomas) <> @RelacionesAntes
    THROW 51042, 'Se alteraron los idiomas o las relaciones existentes.', 1;
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Idiomas')) <> 6
    THROW 51042, 'Idiomas debe conservar exactamente seis columnas.', 1;
IF EXISTS (SELECT 1 FROM dbo.PublicacionesEditorialesIdiomas p
           LEFT JOIN dbo.Idiomas i ON i.CodigoIdioma = p.CodigoIdioma WHERE i.CodigoIdioma IS NULL)
    THROW 51042, 'Hay publicaciones con idiomas inexistentes.', 1;
COMMIT TRANSACTION;
