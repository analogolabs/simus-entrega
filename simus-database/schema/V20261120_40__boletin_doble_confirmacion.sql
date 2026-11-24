/*
  V20261120_40 · Boletín con doble confirmación (hallazgo S-10, decisión 158)

  QUE HACE. Agrega a dbo.BoletinSuscripciones las columnas de la doble confirmación:
    · Confirmada            bit NOT NULL DEFAULT 0   (la fila solo es una suscripción cuando vale 1)
    · FechaConfirmacion     datetime2(0) NULL
    · HashTestigo           nvarchar(64) NULL        (SHA-256 hex del enlace vigente; nunca el enlace)
    · FechaEmisionTestigo   datetime2(0) NULL        (fija el vencimiento de 3 días y el espacio entre reenvíos)
  y un índice filtrado único sobre HashTestigo para buscar el enlace.

  LAS FILAS QUE YA EXISTEN SE CONSERVAN COMO CONFIRMADAS (FechaConfirmacion NULL = «anterior a la doble confirmación»).
  Es una decisión de continuidad —SIMUS está en modo demo y no hay lista real de envío— que el usuario puede revertir
  poniendo Confirmada = 0 a las que quiera volver a pedir (la reversa está abajo). La autorización de tratamiento que
  ya tenían en dbo.AutorizacionesDatos no se toca.

  RESPALDO. Antes de agregar nada, si hay filas, se copia la tabla a respaldo.BoletinSuscripciones_V20261120_40.

  IDEMPOTENTE. Cada paso pregunta si ya está hecho; una segunda ejecución no cambia nada. No borra datos.

  REVERSA (manual): DROP INDEX UX_BoletinSuscripciones_HashTestigo; quitar el DEFAULT y las cuatro columnas; los datos
  originales están en el respaldo.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.BoletinSuscripciones', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.BoletinSuscripciones', N'Confirmada') IS NULL
BEGIN
    BEGIN TRANSACTION;

    IF EXISTS (SELECT 1 FROM dbo.BoletinSuscripciones)
    BEGIN
        IF SCHEMA_ID(N'respaldo') IS NULL EXEC (N'CREATE SCHEMA respaldo');
        IF OBJECT_ID(N'respaldo.BoletinSuscripciones_V20261120_40', N'U') IS NULL
            EXEC (N'SELECT SYSUTCDATETIME() AS FechaRespaldo, b.* INTO respaldo.BoletinSuscripciones_V20261120_40 FROM dbo.BoletinSuscripciones b');
    END;

    ALTER TABLE dbo.BoletinSuscripciones ADD
        Confirmada bit NOT NULL CONSTRAINT DF_BoletinSuscripciones_Confirmada DEFAULT (0),
        FechaConfirmacion datetime2(0) NULL,
        HashTestigo nvarchar(64) NULL,
        FechaEmisionTestigo datetime2(0) NULL;

    -- Las suscripciones anteriores a la doble confirmación siguen contando (ver arriba).
    EXEC (N'UPDATE dbo.BoletinSuscripciones SET Confirmada = 1');

    COMMIT TRANSACTION;
END;

IF OBJECT_ID(N'dbo.BoletinSuscripciones', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.BoletinSuscripciones', N'HashTestigo') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_BoletinSuscripciones_HashTestigo'
                   AND object_id = OBJECT_ID(N'dbo.BoletinSuscripciones'))
    EXEC (N'CREATE UNIQUE INDEX UX_BoletinSuscripciones_HashTestigo ON dbo.BoletinSuscripciones (HashTestigo) WHERE HashTestigo IS NOT NULL');
