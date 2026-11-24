/*
  SIMUS · Límite de intentos por cuenta y generación de sesión (auditoría de seguridad S-07 y S-11, decisión 164)

  QUE ES. Dos piezas aditivas:
    · dbo.IntentosDeIngresoFallidos: un renglón por cada intento fallido de ingreso (consola o portal), con la HUELLA de la
      cuenta —SHA-256 de «canal|correo» normalizado— y no el correo. Existe igual para un correo con cuenta y para uno sin
      ella, de modo que el bloqueo temporal (5 fallos en 15 minutos, configurable) no revela si la cuenta existe. La API poda
      lo que sale de la ventana y lo que tiene más de un día; un ingreso exitoso, la recuperación de la clave y el
      restablecimiento que hace el webmaster borran los fallos de la cuenta.
    · dbo.Usuarios.GeneracionDeSesion (int, 0 por omisión): cada cookie lleva escrita la generación de su cuenta y la API la
      compara en cada petición; cerrar sesión la sube, y una cookie copiada antes del cierre deja de valer.

  LO QUE NO HACE. No borra ni reescribe ninguna fila existente: la tabla nace vacía y la columna nace en 0 para todas las
  cuentas. No hay nada que respaldar: ninguna fila cambia de valor (un respaldo de dbo.Usuarios copiaría hashes de contraseñas
  a otro esquema sin necesidad). La reversa, manual y fuera de schema/, es simus-database/scripts/reversa_bloqueo_por_cuenta_y_generacion_de_sesion.sql.
  Idempotente: se puede correr dos veces.

  PRIVACIDAD. La huella no es reversible a un correo salvo por diccionario; las filas viven a lo sumo un día.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.IntentosDeIngresoFallidos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.IntentosDeIngresoFallidos
    (
        IdIntento bigint IDENTITY(1,1) NOT NULL,
        Canal varchar(12) NOT NULL,
        HuellaDeCuenta char(64) NOT NULL,
        FechaIntento datetime2(7) NOT NULL,
        CONSTRAINT PK_IntentosDeIngresoFallidos PRIMARY KEY (IdIntento),
        CONSTRAINT CK_IntentosDeIngresoFallidos_Canal CHECK (Canal IN (N'consola', N'externo'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IntentosDeIngresoFallidos_Cuenta' AND object_id = OBJECT_ID(N'dbo.IntentosDeIngresoFallidos'))
    CREATE INDEX IX_IntentosDeIngresoFallidos_Cuenta ON dbo.IntentosDeIngresoFallidos (Canal, HuellaDeCuenta, FechaIntento);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IntentosDeIngresoFallidos_Fecha' AND object_id = OBJECT_ID(N'dbo.IntentosDeIngresoFallidos'))
    CREATE INDEX IX_IntentosDeIngresoFallidos_Fecha ON dbo.IntentosDeIngresoFallidos (FechaIntento);
GO

IF COL_LENGTH(N'dbo.Usuarios', N'GeneracionDeSesion') IS NULL
    ALTER TABLE dbo.Usuarios ADD GeneracionDeSesion int NOT NULL
        CONSTRAINT DF_Usuarios_GeneracionDeSesion DEFAULT (0);
GO
