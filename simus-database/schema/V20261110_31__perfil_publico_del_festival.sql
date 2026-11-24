-- =============================================
-- Nombre del script: V20261110_31__perfil_publico_del_festival.sql
-- Descripcion: «Version de Festival» deja de existir como concepto (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md §24.10). Lo que
--              dbo.VersionesFestival guarda es el PERFIL PUBLICO del Festival —el que el sitio
--              publico lee y contra el que se compara una propuesta de cambios—, y asi pasa a
--              llamarse. La HISTORIA de los datos vive en dbo.CambiosDeRegistro, que es el sistema
--              unico de trazabilidad: la direccion decidio (10 nov 2026) que la «version» solo
--              servia para eso.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-10
-- Version: 20261110.31 (linea interna de desarrollo)
--
-- SOLO CAMBIAN NOMBRES. Ni una fila, ni un valor, ni un tipo: dbo.VersionesFestival pasa a
-- dbo.PerfilesPublicosFestival con sus mismas filas, y sus columnas, restricciones e indices se
-- renombran con ella. Los guiones ya aplicados NO se tocan (DbUp los registra por nombre): este
-- renombra encima de lo que dejaron.
--
--   dbo.VersionesFestival                    -> dbo.PerfilesPublicosFestival
--   IdVersionFestival                        -> IdPerfilPublicoFestival
--   NumeroVersion                            -> NumeroPublicacion   (la enesima publicacion del perfil)
--   dbo.CambiosDeRegistro.VersionFestivalId  -> PerfilPublicoFestivalId
--   PK_/UQ_/UX_/IX_/FK_/CK_/DF_VersionesFestival... -> ...PerfilesPublicosFestival...
--   perfilVersionado.<campo>  (el campoId de las notas de revision de un Festival) -> perfilPublico.<campo>
--
-- IDEMPOTENTE: cada paso comprueba su estado antes de actuar.
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

-- 1) La tabla.
IF OBJECT_ID(N'dbo.VersionesFestival', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.PerfilesPublicosFestival', N'U') IS NULL
    EXEC sp_rename N'dbo.VersionesFestival', N'PerfilesPublicosFestival';

-- 2) Sus columnas.
IF COL_LENGTH(N'dbo.PerfilesPublicosFestival', N'IdVersionFestival') IS NOT NULL
    EXEC sp_rename N'dbo.PerfilesPublicosFestival.IdVersionFestival', N'IdPerfilPublicoFestival', N'COLUMN';

IF COL_LENGTH(N'dbo.PerfilesPublicosFestival', N'NumeroVersion') IS NOT NULL
    EXEC sp_rename N'dbo.PerfilesPublicosFestival.NumeroVersion', N'NumeroPublicacion', N'COLUMN';

-- 3) El enlace desde el registro de cambios (V20261110_10).
IF COL_LENGTH(N'dbo.CambiosDeRegistro', N'VersionFestivalId') IS NOT NULL
    EXEC sp_rename N'dbo.CambiosDeRegistro.VersionFestivalId', N'PerfilPublicoFestivalId', N'COLUMN';

-- 4) Restricciones, claves y valores por omision: el nombre dice a que tabla pertenecen.
DECLARE @antiguo sysname, @nuevo sysname;
DECLARE restricciones CURSOR LOCAL FAST_FORWARD FOR
    SELECT o.name
      FROM sys.objects o
     WHERE o.parent_object_id = OBJECT_ID(N'dbo.PerfilesPublicosFestival')
       AND o.name LIKE N'%VersionesFestival%';
OPEN restricciones;
FETCH NEXT FROM restricciones INTO @antiguo;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @nuevo = REPLACE(@antiguo, N'VersionesFestival', N'PerfilesPublicosFestival');
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = @nuevo AND parent_object_id = OBJECT_ID(N'dbo.PerfilesPublicosFestival'))
        EXEC sp_rename @objname = @antiguo, @newname = @nuevo, @objtype = N'OBJECT';
    FETCH NEXT FROM restricciones INTO @antiguo;
END;
CLOSE restricciones;
DEALLOCATE restricciones;

-- 5) Indices que no son de una restriccion (los de una restriccion ya se renombraron con ella).
DECLARE @indice sysname, @indiceNuevo sysname, @calificado nvarchar(300);
DECLARE indices CURSOR LOCAL FAST_FORWARD FOR
    SELECT i.name
      FROM sys.indexes i
     WHERE i.object_id = OBJECT_ID(N'dbo.PerfilesPublicosFestival')
       AND i.name IS NOT NULL
       AND i.is_primary_key = 0 AND i.is_unique_constraint = 0
       AND i.name LIKE N'%VersionesFestival%';
OPEN indices;
FETCH NEXT FROM indices INTO @indice;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @indiceNuevo = REPLACE(@indice, N'VersionesFestival', N'PerfilesPublicosFestival');
    SET @calificado = N'dbo.PerfilesPublicosFestival.' + @indice;
    EXEC sp_rename @objname = @calificado, @newname = @indiceNuevo, @objtype = N'INDEX';
    FETCH NEXT FROM indices INTO @indice;
END;
CLOSE indices;
DEALLOCATE indices;

-- 6) El identificador del campo en las notas de revision de un Festival: `perfilVersionado.` ->
--    `perfilPublico.`. Lo que ya esta escrito se renombra; el codigo nuevo escribe el nuevo.
EXEC (N'
UPDATE dbo.RevisionesDeRegistroObservaciones
   SET CampoId = N''perfilPublico.'' + SUBSTRING(CampoId, LEN(N''perfilVersionado.'') + 1, 200)
 WHERE CampoId LIKE N''perfilVersionado.%'';');

EXEC (N'
UPDATE dbo.PropuestasDeCambioCampos
   SET CampoId = N''perfilPublico.'' + SUBSTRING(CampoId, LEN(N''perfilVersionado.'') + 1, 200)
 WHERE CampoId LIKE N''perfilVersionado.%'';');

COMMIT TRANSACTION;
