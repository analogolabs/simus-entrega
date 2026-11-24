/* SIMUS · Galería pública: álbumes destacados para el carrusel del portal */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

/*
  QUE RESUELVE. El carrusel «Destacados» de la Galería mostraba siempre los tres álbumes más recientes. Con el panel de la
  consola, quien administra la Galería puede MARCAR qué álbumes destacar. Si ningún álbum publicado está marcado, el portal
  conserva el comportamiento anterior (los tres más recientes), así que esta migración no cambia lo que se ve hoy.

  IDEMPOTENTE Y ADITIVA: agrega una columna con valor por omisión (0); no borra ni reescribe filas.

  REVERSA (manual): quitar DF_GaleriaAlbumes_Destacado y la columna Destacado.
*/

IF COL_LENGTH(N'dbo.GaleriaAlbumes', N'Destacado') IS NULL
BEGIN
    ALTER TABLE dbo.GaleriaAlbumes ADD Destacado bit NOT NULL CONSTRAINT DF_GaleriaAlbumes_Destacado DEFAULT (0);
END
GO
