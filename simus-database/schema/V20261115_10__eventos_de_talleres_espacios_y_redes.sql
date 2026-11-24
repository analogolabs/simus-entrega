-- =============================================
-- Nombre del script: V20261115_10__eventos_de_talleres_espacios_y_redes.sql
-- Descripcion: Un evento de la Agenda puede enmarcarse en un Taller de luteria, un Espacio para
--              musica en vivo o una Red y centro de documentacion, ademas de en un Festival o un
-- Mercado (LUT-01 y LUT-02; decision 101 de docs/referencia/20-decisiones-y-flujos-por-modulo.md).
--              Los procesos de estos tres modulos NO tienen una Agenda aparte: se anuncian como
--              eventos de la Agenda normal, con la misma regla de errata, retiro y cancelacion.
--              Anade TallerId, EspacioId y RedId a dbo.EventosAgenda, cada uno con su foranea y su
--              indice filtrado, y reemplaza CK_EventosAgenda_UnSoloProceso por una que admite
--              A LO SUMO UNO de los cinco procesos. No toca filas existentes ni cascadas:
--              nada se borra, y las filas ya escritas siguen cumpliendo la restriccion nueva.
--              Idempotente.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-15
-- Version: 20261115.10 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.EventosAgenda', N'U') IS NULL
    THROW 51610, 'Falta la tabla dbo.EventosAgenda.', 1;
IF OBJECT_ID(N'dbo.Talleres', N'U') IS NULL
    THROW 51611, 'Falta la tabla dbo.Talleres (V20261110_50).', 1;
IF OBJECT_ID(N'dbo.Espacios', N'U') IS NULL
    THROW 51612, 'Falta la tabla dbo.Espacios (V20261110_80).', 1;
IF OBJECT_ID(N'dbo.Redes', N'U') IS NULL
    THROW 51613, 'Falta la tabla dbo.Redes (V20261110_70).', 1;
GO

IF COL_LENGTH(N'dbo.EventosAgenda', N'TallerId') IS NULL
    ALTER TABLE dbo.EventosAgenda ADD TallerId int NULL;
GO
IF COL_LENGTH(N'dbo.EventosAgenda', N'EspacioId') IS NULL
    ALTER TABLE dbo.EventosAgenda ADD EspacioId int NULL;
GO
IF COL_LENGTH(N'dbo.EventosAgenda', N'RedId') IS NULL
    ALTER TABLE dbo.EventosAgenda ADD RedId int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventosAgenda_Talleres')
    ALTER TABLE dbo.EventosAgenda ADD CONSTRAINT FK_EventosAgenda_Talleres
        FOREIGN KEY (TallerId) REFERENCES dbo.Talleres (IdTaller);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventosAgenda_Espacios')
    ALTER TABLE dbo.EventosAgenda ADD CONSTRAINT FK_EventosAgenda_Espacios
        FOREIGN KEY (EspacioId) REFERENCES dbo.Espacios (IdEspacio);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventosAgenda_Redes')
    ALTER TABLE dbo.EventosAgenda ADD CONSTRAINT FK_EventosAgenda_Redes
        FOREIGN KEY (RedId) REFERENCES dbo.Redes (IdRed);
GO

-- UN EVENTO SE ENMARCA EN UN SOLO PROCESO. La restriccion anterior solo conocia Festival y Mercado;
-- se reemplaza (no se suma) para que haya una sola definicion de «un solo proceso». Los eventos que
-- ya existen tienen las tres columnas nuevas en NULL, asi que la comprueban sin cambio alguno.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_EventosAgenda_UnSoloProceso'
           AND parent_object_id = OBJECT_ID(N'dbo.EventosAgenda'))
    ALTER TABLE dbo.EventosAgenda DROP CONSTRAINT CK_EventosAgenda_UnSoloProceso;
GO
EXEC (N'ALTER TABLE dbo.EventosAgenda WITH CHECK ADD CONSTRAINT CK_EventosAgenda_UnSoloProceso CHECK (
    (CASE WHEN FestivalId IS NULL THEN 0 ELSE 1 END
     + CASE WHEN MercadoId IS NULL THEN 0 ELSE 1 END
     + CASE WHEN TallerId IS NULL THEN 0 ELSE 1 END
     + CASE WHEN EspacioId IS NULL THEN 0 ELSE 1 END
     + CASE WHEN RedId IS NULL THEN 0 ELSE 1 END) <= 1
);');
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EventosAgenda_TallerId' AND object_id = OBJECT_ID(N'dbo.EventosAgenda'))
    EXEC (N'CREATE INDEX IX_EventosAgenda_TallerId ON dbo.EventosAgenda (TallerId) WHERE TallerId IS NOT NULL;');
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EventosAgenda_EspacioId' AND object_id = OBJECT_ID(N'dbo.EventosAgenda'))
    EXEC (N'CREATE INDEX IX_EventosAgenda_EspacioId ON dbo.EventosAgenda (EspacioId) WHERE EspacioId IS NOT NULL;');
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EventosAgenda_RedId' AND object_id = OBJECT_ID(N'dbo.EventosAgenda'))
    EXEC (N'CREATE INDEX IX_EventosAgenda_RedId ON dbo.EventosAgenda (RedId) WHERE RedId IS NOT NULL;');
GO
