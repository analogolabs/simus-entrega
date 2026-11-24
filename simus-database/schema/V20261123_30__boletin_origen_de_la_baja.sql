/*
  V20261123_30 · Boletín: quién dio de baja la suscripción (baja pública)

  QUE HACE. Agrega a dbo.BoletinSuscripciones la columna OrigenBaja nvarchar(20) NULL con un CHECK que solo admite
  N'persona' (el enlace de baja que acompaña a cada correo) o N'administracion' (la consola). Las bajas que ya existen
  quedan en NULL: se hicieron antes de que el origen se registrara y no se inventa un valor.

  NO HAY COLUMNA PARA EL ENLACE DE BAJA. El enlace se firma con HMAC-SHA256 sobre el identificador de la suscripción y la
  clave Correo:ClaveDeBaja; no se guarda nada, sirve para las suscripciones que ya existen y no vence.

  IDEMPOTENTE. Una segunda ejecución no cambia nada. No borra datos.

  REVERSA (manual): ALTER TABLE dbo.BoletinSuscripciones DROP CONSTRAINT CK_BoletinSuscripciones_OrigenBaja;
  ALTER TABLE dbo.BoletinSuscripciones DROP COLUMN OrigenBaja;
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.BoletinSuscripciones', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.BoletinSuscripciones', N'OrigenBaja') IS NULL
    EXEC (N'ALTER TABLE dbo.BoletinSuscripciones ADD OrigenBaja nvarchar(20) NULL');

IF OBJECT_ID(N'dbo.BoletinSuscripciones', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.BoletinSuscripciones', N'OrigenBaja') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_BoletinSuscripciones_OrigenBaja')
    EXEC (N'ALTER TABLE dbo.BoletinSuscripciones ADD CONSTRAINT CK_BoletinSuscripciones_OrigenBaja
            CHECK (OrigenBaja IS NULL OR OrigenBaja IN (N''persona'', N''administracion''))');
