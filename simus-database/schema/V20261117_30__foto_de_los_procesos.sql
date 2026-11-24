-- =============================================
-- Nombre del script: V20261117_30__foto_de_los_procesos.sql
-- Descripcion: La foto de un taller, un espacio y una red (LUT-02; decision 115 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).
--              Anade dbo.Talleres.ArchivoFotoId, anulable, con su foranea al Banco de archivos
--              (dbo.Archivos) y un indice filtrado, igual que la foto de una organizacion o de un
--              perfil publico. La foto es publica solo mientras el taller esta publicado; la
--              consulta de «donde se usa un archivo» del banco ya la cuenta como septimo vinculo.
--              No toca filas existentes (la columna nace NULL) ni cascadas: nada se borra.
--              Idempotente.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-17
-- Version: 20261117.30 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Talleres', N'U') IS NULL
    THROW 51720, 'Falta la tabla dbo.Talleres (V20261110_50).', 1;
IF OBJECT_ID(N'dbo.Archivos', N'U') IS NULL
    THROW 51721, 'Falta la tabla dbo.Archivos.', 1;
GO

IF COL_LENGTH(N'dbo.Talleres', N'ArchivoFotoId') IS NULL
    ALTER TABLE dbo.Talleres ADD ArchivoFotoId int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Talleres_ArchivoFoto')
    ALTER TABLE dbo.Talleres ADD CONSTRAINT FK_Talleres_ArchivoFoto
        FOREIGN KEY (ArchivoFotoId) REFERENCES dbo.Archivos (IdArchivo);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Talleres_ArchivoFoto' AND object_id = OBJECT_ID(N'dbo.Talleres'))
    EXEC (N'CREATE INDEX IX_Talleres_ArchivoFoto ON dbo.Talleres (ArchivoFotoId) WHERE ArchivoFotoId IS NOT NULL;');
GO

-- ═══ Espacios para música en vivo y Redes y documentación: la misma foto (decisión 120) ═══
IF OBJECT_ID(N'dbo.Espacios', N'U') IS NULL
    THROW 51722, 'Falta la tabla dbo.Espacios (V20261110_80).', 1;
IF OBJECT_ID(N'dbo.Redes', N'U') IS NULL
    THROW 51723, 'Falta la tabla dbo.Redes (V20261110_70).', 1;
GO

IF COL_LENGTH(N'dbo.Espacios', N'ArchivoFotoId') IS NULL
    ALTER TABLE dbo.Espacios ADD ArchivoFotoId int NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Espacios_ArchivoFoto')
    ALTER TABLE dbo.Espacios ADD CONSTRAINT FK_Espacios_ArchivoFoto
        FOREIGN KEY (ArchivoFotoId) REFERENCES dbo.Archivos (IdArchivo);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Espacios_ArchivoFoto' AND object_id = OBJECT_ID(N'dbo.Espacios'))
    EXEC (N'CREATE INDEX IX_Espacios_ArchivoFoto ON dbo.Espacios (ArchivoFotoId) WHERE ArchivoFotoId IS NOT NULL;');
GO

IF COL_LENGTH(N'dbo.Redes', N'ArchivoFotoId') IS NULL
    ALTER TABLE dbo.Redes ADD ArchivoFotoId int NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Redes_ArchivoFoto')
    ALTER TABLE dbo.Redes ADD CONSTRAINT FK_Redes_ArchivoFoto
        FOREIGN KEY (ArchivoFotoId) REFERENCES dbo.Archivos (IdArchivo);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Redes_ArchivoFoto' AND object_id = OBJECT_ID(N'dbo.Redes'))
    EXEC (N'CREATE INDEX IX_Redes_ArchivoFoto ON dbo.Redes (ArchivoFotoId) WHERE ArchivoFotoId IS NOT NULL;');
GO
