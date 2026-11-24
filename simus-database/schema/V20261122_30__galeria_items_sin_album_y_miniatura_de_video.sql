/* SIMUS · Galería pública: ítems sueltos («Sin álbum») y miniatura propia de cada video */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

/*
  QUE RESUELVE. (0) Detalle: el texto completo de un ítem cuando Descripcion es solo un resumen editorial de 1 a 3 frases. (1) La pestaña «Sin álbum» de la Galería: un ítem (foto o video) puede no pertenecer a ningún álbum. Para eso
  GaleriaItems.GaleriaAlbumId deja de ser obligatorio y el ítem suelto lleva su propia marca Publicado (dentro de un álbum manda
  la del álbum). (2) La miniatura de un video es una imagen PROPIA del Banco de archivos (MiniaturaArchivoId), sembrada una sola
  vez: el navegador nunca pide una imagen a YouTube hasta que la persona pulsa «Reproducir».

  IDEMPOTENTE Y ADITIVA: solo relaja una columna (los datos existentes siguen siendo válidos) y agrega columnas con valor por
  omisión; no borra ni reescribe filas. Las claves foráneas no cascadean (regla del proyecto).

  REVERSA (manual, solo si no hay ítems sueltos): DROP INDEX IX_GaleriaItems_Sueltos y IX_GaleriaItems_Miniatura; quitar CK_GaleriaItems_Miniatura,
  FK_GaleriaItems_Miniatura y las columnas MiniaturaArchivoId y Publicado; ALTER COLUMN GaleriaAlbumId int NOT NULL.
*/

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.GaleriaItems') AND name = N'GaleriaAlbumId' AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.GaleriaItems ALTER COLUMN GaleriaAlbumId int NULL;
END
GO

IF COL_LENGTH(N'dbo.GaleriaItems', N'Publicado') IS NULL
BEGIN
    ALTER TABLE dbo.GaleriaItems ADD Publicado bit NOT NULL CONSTRAINT DF_GaleriaItems_Publicado DEFAULT (1);
END
GO

IF COL_LENGTH(N'dbo.GaleriaItems', N'Detalle') IS NULL
BEGIN
    ALTER TABLE dbo.GaleriaItems ADD Detalle nvarchar(4000) NULL;
END
GO

IF COL_LENGTH(N'dbo.GaleriaItems', N'MiniaturaArchivoId') IS NULL
BEGIN
    ALTER TABLE dbo.GaleriaItems ADD MiniaturaArchivoId int NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_GaleriaItems_Miniatura')
BEGIN
    ALTER TABLE dbo.GaleriaItems ADD CONSTRAINT FK_GaleriaItems_Miniatura FOREIGN KEY (MiniaturaArchivoId) REFERENCES dbo.Archivos (IdArchivo);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_GaleriaItems_Miniatura')
BEGIN
    ALTER TABLE dbo.GaleriaItems ADD CONSTRAINT CK_GaleriaItems_Miniatura CHECK (MiniaturaArchivoId IS NULL OR TipoItem = N'video');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GaleriaItems_Miniatura' AND object_id = OBJECT_ID(N'dbo.GaleriaItems'))
BEGIN
    CREATE INDEX IX_GaleriaItems_Miniatura ON dbo.GaleriaItems (MiniaturaArchivoId) WHERE MiniaturaArchivoId IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GaleriaItems_Sueltos' AND object_id = OBJECT_ID(N'dbo.GaleriaItems'))
BEGIN
    CREATE INDEX IX_GaleriaItems_Sueltos ON dbo.GaleriaItems (Publicado, Orden, IdGaleriaItem) WHERE GaleriaAlbumId IS NULL;
END
GO
