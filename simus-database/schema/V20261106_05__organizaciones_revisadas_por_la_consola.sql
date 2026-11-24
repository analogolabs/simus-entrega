-- =============================================
-- Nombre del script: V20261106_05__organizaciones_revisadas_por_la_consola.sql
-- Descripcion: La revision de la consola decide si una organizacion es publica
-- (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1, decision 11).
--              - Columnas FechaRevisionConsola e IdUsuarioRevisionConsola en dbo.Entidades.
--              - FK_Entidades_UsuarioRevisionConsola hacia dbo.Usuarios, sin cascada.
--              - CK_Entidades_RevisionConsolaCoherente: las dos columnas o ninguna.
--              NO SE RELLENA NADA: ninguna organizacion queda revisada por esta migracion.
--              La columna antigua FechaRevision no se reutiliza, porque en los datos de prueba
--              marca que la revision empezo, no que termino.
--              Idempotente: cada paso comprueba si ya se aplico.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-05
-- Version: 20261106.05 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Entidades', N'U') IS NULL
    THROW 51139, 'Falta la tabla dbo.Entidades.', 1;

IF COL_LENGTH(N'dbo.Entidades', N'FechaRevisionConsola') IS NULL
    ALTER TABLE dbo.Entidades ADD FechaRevisionConsola datetime2(0) NULL;

IF COL_LENGTH(N'dbo.Entidades', N'IdUsuarioRevisionConsola') IS NULL
    ALTER TABLE dbo.Entidades ADD IdUsuarioRevisionConsola int NULL;
COMMIT TRANSACTION;
GO

SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys
               WHERE name = N'FK_Entidades_UsuarioRevisionConsola'
                 AND parent_object_id = OBJECT_ID(N'dbo.Entidades'))
    ALTER TABLE dbo.Entidades WITH CHECK ADD CONSTRAINT FK_Entidades_UsuarioRevisionConsola
        FOREIGN KEY (IdUsuarioRevisionConsola) REFERENCES dbo.Usuarios (IdUsuario);

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_Entidades_RevisionConsolaCoherente'
                 AND parent_object_id = OBJECT_ID(N'dbo.Entidades'))
    ALTER TABLE dbo.Entidades WITH CHECK ADD CONSTRAINT CK_Entidades_RevisionConsolaCoherente CHECK (
        (FechaRevisionConsola IS NULL AND IdUsuarioRevisionConsola IS NULL)
        OR (FechaRevisionConsola IS NOT NULL AND IdUsuarioRevisionConsola IS NOT NULL)
    );

COMMIT TRANSACTION;
GO
