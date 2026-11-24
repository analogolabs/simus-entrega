-- =============================================
-- Nombre del script: V20261105_03__eventos_de_organizacion_mercado.sql
-- Descripcion: Un evento de organizacion puede enmarcarse en un Mercado publicado
-- ademas de en un Festival (decision del 5 de noviembre de 2026).
-- Autor: Edder Jiménez
-- Fecha: 2026-11-05
-- Version: 20261105.03 (linea interna de desarrollo)
-- =============================================
/*
  QUE CAMBIA. `dbo.EventosAgenda` ganaba su proceso solo por `FestivalId`. Ahora tambien puede
  colgar de un Mercado, con su propia columna y su foranea, y nunca de los dos a la vez: un evento
  se enmarca en un solo proceso.

  LO QUE NO CAMBIA. El borrador y el historial no piden columnas: `Estado` ya admite 'borrador' y
  `dbo.RegistrosRevisionHistorial` ya admite los estados de la agenda.

  ES IDEMPOTENTE: cada paso comprueba si ya esta hecho.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.EventosAgenda', 'MercadoId') IS NULL
    ALTER TABLE dbo.EventosAgenda ADD MercadoId int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventosAgenda_Mercados')
    ALTER TABLE dbo.EventosAgenda ADD CONSTRAINT FK_EventosAgenda_Mercados
        FOREIGN KEY (MercadoId) REFERENCES dbo.Mercados (IdMercado);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_EventosAgenda_UnSoloProceso')
    ALTER TABLE dbo.EventosAgenda ADD CONSTRAINT CK_EventosAgenda_UnSoloProceso
        CHECK (FestivalId IS NULL OR MercadoId IS NULL);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EventosAgenda_MercadoId' AND object_id = OBJECT_ID(N'dbo.EventosAgenda'))
    CREATE INDEX IX_EventosAgenda_MercadoId ON dbo.EventosAgenda (MercadoId) WHERE MercadoId IS NOT NULL;
GO
