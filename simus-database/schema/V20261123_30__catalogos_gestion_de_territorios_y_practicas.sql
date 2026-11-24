-- =============================================
-- Nombre del script: V20261123_30__catalogos_gestion_de_territorios_y_practicas.sql
-- Descripcion: Prepara la administracion de los catalogos «Territorios sonoros» y «Practicas musicales»
--              desde la consola (seccion «Catalogos»). No cambia ni borra ninguna fila ni ningun vinculo
--              de festivales, mercados, noticias, agenda, editorial, talleres, espacios, redes o perfiles.
--              En los catalogos: Activo (desactivar en lugar de borrar lo que esta en uso), Sinonimos
--              (sinonimos para la busqueda), Observaciones (notas internas, nunca publicas) y
--              FechaActualizacion; en Practicas ademas PracticaPadreId (jerarquia opcional de un nivel).
--              En las fichas conceptuales: EsPreliminar («Definicion preliminar» mientras sea borrador)
--              e ImagenArchivoId (imagen del Banco de archivos). El historial de cambios usa la
--              bitacora de auditoria existente (BitacoraAuditoria), sin tabla nueva.
--              Idempotente: cada columna y restriccion se crea solo si falta.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-23
-- Version: 20261123.30 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
GO

-- ---------- Territorios sonoros ----------
IF COL_LENGTH(N'dbo.TerritoriosSonoros', N'Activo') IS NULL
    ALTER TABLE dbo.TerritoriosSonoros ADD Activo bit NOT NULL CONSTRAINT DF_TerritoriosSonoros_Activo DEFAULT (1);
IF COL_LENGTH(N'dbo.TerritoriosSonoros', N'Sinonimos') IS NULL
    ALTER TABLE dbo.TerritoriosSonoros ADD Sinonimos nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.TerritoriosSonoros', N'Observaciones') IS NULL
    ALTER TABLE dbo.TerritoriosSonoros ADD Observaciones nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.TerritoriosSonoros', N'FechaActualizacion') IS NULL
    ALTER TABLE dbo.TerritoriosSonoros ADD FechaActualizacion datetime2(0) NULL;
GO

-- ---------- Practicas musicales ----------
IF COL_LENGTH(N'dbo.PracticasMusicales', N'Activo') IS NULL
    ALTER TABLE dbo.PracticasMusicales ADD Activo bit NOT NULL CONSTRAINT DF_PracticasMusicales_Activo DEFAULT (1);
IF COL_LENGTH(N'dbo.PracticasMusicales', N'PracticaPadreId') IS NULL
    ALTER TABLE dbo.PracticasMusicales ADD PracticaPadreId int NULL;
IF COL_LENGTH(N'dbo.PracticasMusicales', N'Sinonimos') IS NULL
    ALTER TABLE dbo.PracticasMusicales ADD Sinonimos nvarchar(500) NULL;
IF COL_LENGTH(N'dbo.PracticasMusicales', N'Observaciones') IS NULL
    ALTER TABLE dbo.PracticasMusicales ADD Observaciones nvarchar(1000) NULL;
IF COL_LENGTH(N'dbo.PracticasMusicales', N'FechaActualizacion') IS NULL
    ALTER TABLE dbo.PracticasMusicales ADD FechaActualizacion datetime2(0) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_PracticasMusicales_Padre' AND parent_object_id = OBJECT_ID(N'dbo.PracticasMusicales'))
    ALTER TABLE dbo.PracticasMusicales ADD CONSTRAINT FK_PracticasMusicales_Padre
        FOREIGN KEY (PracticaPadreId) REFERENCES dbo.PracticasMusicales (IdPracticaMusical);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_PracticasMusicales_Padre' AND parent_object_id = OBJECT_ID(N'dbo.PracticasMusicales'))
    ALTER TABLE dbo.PracticasMusicales ADD CONSTRAINT CK_PracticasMusicales_Padre
        CHECK (PracticaPadreId IS NULL OR PracticaPadreId <> IdPracticaMusical);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PracticasMusicales_Padre' AND object_id = OBJECT_ID(N'dbo.PracticasMusicales'))
    CREATE INDEX IX_PracticasMusicales_Padre ON dbo.PracticasMusicales (PracticaPadreId);
GO

-- ---------- Fichas conceptuales ----------
IF COL_LENGTH(N'dbo.FichasConceptualesTerritoriosSonoros', N'EsPreliminar') IS NULL
    ALTER TABLE dbo.FichasConceptualesTerritoriosSonoros ADD EsPreliminar bit NOT NULL CONSTRAINT DF_FichasConceptualesTerritorios_Preliminar DEFAULT (0);
IF COL_LENGTH(N'dbo.FichasConceptualesTerritoriosSonoros', N'ImagenArchivoId') IS NULL
    ALTER TABLE dbo.FichasConceptualesTerritoriosSonoros ADD ImagenArchivoId int NULL;
IF COL_LENGTH(N'dbo.FichasConceptualesPracticasMusicales', N'EsPreliminar') IS NULL
    ALTER TABLE dbo.FichasConceptualesPracticasMusicales ADD EsPreliminar bit NOT NULL CONSTRAINT DF_FichasConceptualesPracticas_Preliminar DEFAULT (0);
IF COL_LENGTH(N'dbo.FichasConceptualesPracticasMusicales', N'ImagenArchivoId') IS NULL
    ALTER TABLE dbo.FichasConceptualesPracticasMusicales ADD ImagenArchivoId int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_FichasConceptualesTerritorios_Imagen' AND parent_object_id = OBJECT_ID(N'dbo.FichasConceptualesTerritoriosSonoros'))
    ALTER TABLE dbo.FichasConceptualesTerritoriosSonoros ADD CONSTRAINT FK_FichasConceptualesTerritorios_Imagen
        FOREIGN KEY (ImagenArchivoId) REFERENCES dbo.Archivos (IdArchivo);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_FichasConceptualesPracticas_Imagen' AND parent_object_id = OBJECT_ID(N'dbo.FichasConceptualesPracticasMusicales'))
    ALTER TABLE dbo.FichasConceptualesPracticasMusicales ADD CONSTRAINT FK_FichasConceptualesPracticas_Imagen
        FOREIGN KEY (ImagenArchivoId) REFERENCES dbo.Archivos (IdArchivo);
GO

-- Todo elemento debe tener su ficha (la consola la edita siempre): se crean las que falten, vacias.
INSERT INTO dbo.FichasConceptualesTerritoriosSonoros (TerritorioSonoroId)
SELECT t.IdTerritorioSonoro FROM dbo.TerritoriosSonoros t
WHERE NOT EXISTS (SELECT 1 FROM dbo.FichasConceptualesTerritoriosSonoros f WHERE f.TerritorioSonoroId = t.IdTerritorioSonoro);
INSERT INTO dbo.FichasConceptualesPracticasMusicales (PracticaMusicalId)
SELECT p.IdPracticaMusical FROM dbo.PracticasMusicales p
WHERE NOT EXISTS (SELECT 1 FROM dbo.FichasConceptualesPracticasMusicales f WHERE f.PracticaMusicalId = p.IdPracticaMusical);
GO
