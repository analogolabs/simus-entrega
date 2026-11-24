-- =============================================
-- Nombre del script: V20261106_08__fusion_de_festivales_historicos.sql
-- Descripcion: Fusionar dos copias del mismo Festival historico (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1, decision 18;
-- issue).
--              - Columnas FusionadoEnId y FechaFusion en dbo.Festivales: el registro absorbido
--                queda archivado y apunta al que lo absorbio, para que su ficha publica pueda
--                redirigir y la historia no se pierda.
--              - FK_Festivales_FusionadoEn hacia dbo.Festivales, SIN CASCADA: el absorbido no
--                se borra nunca, y una cascada lo arrastraria si alguien borrara el otro.
--              - CK_Festivales_FusionNoASiMismo: un Festival no se fusiona en si mismo.
--              - CK_Festivales_FusionCoherente: la referencia y la fecha van juntas, y solo en
--                un registro archivado.
--              NO SE RELLENA NADA: ningun Festival queda fusionado por esta migracion.
--              Idempotente: cada paso comprueba si ya se aplico.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-06
-- Version: 20261106.08 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Festivales', N'U') IS NULL
    THROW 51147, 'Falta la tabla dbo.Festivales.', 1;

IF COL_LENGTH(N'dbo.Festivales', N'FusionadoEnId') IS NULL
    ALTER TABLE dbo.Festivales ADD FusionadoEnId int NULL;

IF COL_LENGTH(N'dbo.Festivales', N'FechaFusion') IS NULL
    ALTER TABLE dbo.Festivales ADD FechaFusion datetime2(0) NULL;
COMMIT TRANSACTION;
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = N'FK_Festivales_FusionadoEn'
                 AND parent_object_id = OBJECT_ID(N'dbo.Festivales'))
    ALTER TABLE dbo.Festivales WITH CHECK ADD CONSTRAINT FK_Festivales_FusionadoEn
        FOREIGN KEY (FusionadoEnId) REFERENCES dbo.Festivales (IdFestival);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_Festivales_FusionNoASiMismo'
                 AND parent_object_id = OBJECT_ID(N'dbo.Festivales'))
    ALTER TABLE dbo.Festivales WITH CHECK ADD CONSTRAINT CK_Festivales_FusionNoASiMismo
        CHECK (FusionadoEnId IS NULL OR FusionadoEnId <> IdFestival);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_Festivales_FusionCoherente'
                 AND parent_object_id = OBJECT_ID(N'dbo.Festivales'))
    ALTER TABLE dbo.Festivales WITH CHECK ADD CONSTRAINT CK_Festivales_FusionCoherente CHECK (
        (FusionadoEnId IS NULL AND FechaFusion IS NULL)
        OR (FusionadoEnId IS NOT NULL AND FechaFusion IS NOT NULL AND EstadoRegistro = N'archivado')
    );

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Festivales_FusionadoEnId' AND object_id = OBJECT_ID(N'dbo.Festivales'))
    CREATE INDEX IX_Festivales_FusionadoEnId ON dbo.Festivales (FusionadoEnId) WHERE FusionadoEnId IS NOT NULL;

COMMIT TRANSACTION;
GO
