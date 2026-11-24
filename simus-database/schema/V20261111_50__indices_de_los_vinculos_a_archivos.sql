-- =============================================
-- Nombre del script: V20261111_50__indices_de_los_vinculos_a_archivos.sql
-- Descripcion: Tres índices para que la pregunta «¿lo usa algo?» sobre el Banco de archivos sea
-- barata. El filtro «Sin usar» se resuelve ahora en el
--              servidor, ANTES de paginar, y para cada archivo del banco mira las seis tablas que
--              lo pueden vincular. Tres de ellas ya tenían índice sobre su columna de archivo
--              (EventosAgendaArchivos, NoticiasArchivos y ArchivosDeRegistro); estas tres no:
--              la foto de una organización (dbo.Entidades), la foto de un perfil público de
--              persona (dbo.PerfilesPublicos) y el archivo de un acceso editorial
--              (dbo.AccesosEditoriales). Sin índice, cada comprobación recorría la tabla entera.
--              Son índices filtrados (solo las filas con archivo): no pesan donde casi todo es
--              nulo. No toca datos, columnas ni restricciones. Idempotente.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-11
-- Version: 20261111.50 (linea interna de desarrollo)
-- =============================================
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Entidades', N'U') IS NULL
    THROW 51650, 'Falta la tabla dbo.Entidades.', 1;
IF OBJECT_ID(N'dbo.PerfilesPublicos', N'U') IS NULL
    THROW 51651, 'Falta la tabla dbo.PerfilesPublicos.', 1;
IF OBJECT_ID(N'dbo.AccesosEditoriales', N'U') IS NULL
    THROW 51652, 'Falta la tabla dbo.AccesosEditoriales.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Entidades_ArchivoFoto' AND object_id = OBJECT_ID(N'dbo.Entidades'))
    EXEC (N'CREATE INDEX IX_Entidades_ArchivoFoto ON dbo.Entidades (ArchivoFotoId) WHERE ArchivoFotoId IS NOT NULL;');

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_PerfilesPublicos_ArchivoFoto' AND object_id = OBJECT_ID(N'dbo.PerfilesPublicos'))
    EXEC (N'CREATE INDEX IX_PerfilesPublicos_ArchivoFoto ON dbo.PerfilesPublicos (ArchivoFotoId) WHERE ArchivoFotoId IS NOT NULL;');

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AccesosEditoriales_Archivo' AND object_id = OBJECT_ID(N'dbo.AccesosEditoriales'))
    EXEC (N'CREATE INDEX IX_AccesosEditoriales_Archivo ON dbo.AccesosEditoriales (ArchivoId) WHERE ArchivoId IS NOT NULL;');

COMMIT TRANSACTION;
