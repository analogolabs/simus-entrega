-- =============================================
-- Nombre del script: V20261110_60__eventos_cancelados.sql
-- Descripcion: Un evento publicado puede marcarse como CANCELADO sin dejar la agenda (D3-13,
--). La organización avisa de que no se realiza y el evento sigue
--              visible, con su estado «cancelado» y el motivo, en vez de desaparecer.
--              Es una marca aparte del estado del circuito: el evento sigue «publicado»
--              (aprobado por el Programa); lo que cambia es que ya no ocurre.
--              Añade Cancelado, MotivoCancelacion y FechaCancelacion a dbo.EventosAgenda, y un
--              CHECK que ata las tres: sin motivo y sin fecha no hay cancelación, y una
--              cancelación nunca queda a medias. No toca filas existentes ni cascadas.
--              Idempotente.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-10
-- Version: 20261110.60 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.EventosAgenda', N'U') IS NULL
    THROW 51600, 'Falta la tabla dbo.EventosAgenda.', 1;

IF COL_LENGTH(N'dbo.EventosAgenda', N'Cancelado') IS NULL
    EXEC (N'ALTER TABLE dbo.EventosAgenda ADD Cancelado BIT NOT NULL
                CONSTRAINT DF_EventosAgenda_Cancelado DEFAULT (0);');

IF COL_LENGTH(N'dbo.EventosAgenda', N'MotivoCancelacion') IS NULL
    EXEC (N'ALTER TABLE dbo.EventosAgenda ADD MotivoCancelacion NVARCHAR(500) NULL;');

IF COL_LENGTH(N'dbo.EventosAgenda', N'FechaCancelacion') IS NULL
    EXEC (N'ALTER TABLE dbo.EventosAgenda ADD FechaCancelacion DATETIME2(0) NULL;');

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_EventosAgenda_Cancelacion'
      AND parent_object_id = OBJECT_ID(N'dbo.EventosAgenda'))
    EXEC (N'ALTER TABLE dbo.EventosAgenda WITH CHECK ADD CONSTRAINT CK_EventosAgenda_Cancelacion CHECK (
        (Cancelado = 0 AND MotivoCancelacion IS NULL AND FechaCancelacion IS NULL)
        OR (Cancelado = 1 AND FechaCancelacion IS NOT NULL
            AND MotivoCancelacion IS NOT NULL AND LEN(LTRIM(RTRIM(MotivoCancelacion))) > 0)
    );');

COMMIT TRANSACTION;
