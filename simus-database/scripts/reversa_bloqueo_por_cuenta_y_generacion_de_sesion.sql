/*
  SIMUS · REVERSA de V20261120_30 (límite de intentos por cuenta y generación de sesión, S-07 y S-11)

  QUE HACE. Elimina dbo.IntentosDeIngresoFallidos y la columna dbo.Usuarios.GeneracionDeSesion con su DEFAULT. Solo se pierde
  lo que la migración creó: los intentos fallidos de las últimas horas y el contador de cierres de sesión. Hay que
  desplegar antes el código anterior a este cambio (el actual lee la columna).
  NO se ejecuta sola ni la llama ninguna migración: va FUERA de schema/ a propósito. Manual, con la API parada.
  Además del esquema, hay que borrar la fila de dbo.SchemaVersions de V20261120_30 si se quiere volver a aplicar la migración.

  Uso: sqlcmd -S <servidor> -d <base> -i reversa_bloqueo_por_cuenta_y_generacion_de_sesion.sql
*/
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.IntentosDeIngresoFallidos', N'U') IS NOT NULL
    DROP TABLE dbo.IntentosDeIngresoFallidos;

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = N'DF_Usuarios_GeneracionDeSesion')
    ALTER TABLE dbo.Usuarios DROP CONSTRAINT DF_Usuarios_GeneracionDeSesion;
IF COL_LENGTH(N'dbo.Usuarios', N'GeneracionDeSesion') IS NOT NULL
    ALTER TABLE dbo.Usuarios DROP COLUMN GeneracionDeSesion;

COMMIT TRANSACTION;
