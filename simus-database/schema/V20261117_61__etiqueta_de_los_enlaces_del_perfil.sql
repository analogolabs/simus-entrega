/*
  V20261117_61 — ETIQUETA DE LOS ENLACES DEL PERFIL PÚBLICO (PERF).

  «Otro» enlace (página web u otra dirección) lleva un rótulo escrito por la persona («Mi sitio», «Tienda»). Se guarda en
  una columna nueva y NULABLE: los enlaces ya guardados quedan sin etiqueta y se leen igual. Sin cascadas ni datos perdidos.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.PerfilesPublicosEnlaces', N'Etiqueta') IS NULL
    ALTER TABLE dbo.PerfilesPublicosEnlaces ADD Etiqueta nvarchar(60) NULL;

COMMIT TRANSACTION;
