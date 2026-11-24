-- =============================================
-- Nombre del script: V20261105_01__mercado_rechazado.sql
-- Descripcion: Mercados adopta el estado terminal «rechazado», igual que
-- Festivales (docs/referencia/20-decisiones-y-flujos-por-modulo.md). Amplia CK_Mercados_EstadoRegistro.
--              Idempotente: si la restriccion ya admite «rechazado», no hace nada.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-05
-- Version: 20261105.01 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Mercados', N'U') IS NULL
    THROW 51049, 'Falta la tabla dbo.Mercados.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_Mercados_EstadoRegistro'
      AND parent_object_id = OBJECT_ID(N'dbo.Mercados')
      AND definition LIKE N'%rechazado%')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_Mercados_EstadoRegistro' AND parent_object_id = OBJECT_ID(N'dbo.Mercados'))
        ALTER TABLE dbo.Mercados DROP CONSTRAINT CK_Mercados_EstadoRegistro;

    ALTER TABLE dbo.Mercados WITH CHECK ADD CONSTRAINT CK_Mercados_EstadoRegistro CHECK (
        EstadoRegistro IN (N'borrador', N'en_revision', N'ajustes_solicitados', N'publicado', N'archivado', N'rechazado')
    );
END;

COMMIT TRANSACTION;
