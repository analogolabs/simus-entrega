-- =============================================
-- Nombre del script: V20261110_30__cambios_nombres_de_catalogo_y_clase_organizacion.sql
-- Descripcion: Dos ajustes al registro de cambios por campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md), por decision de la
--              direccion del 10 de noviembre de 2026:
--              1) Un campo que guarda un CODIGO de catalogo (un municipio, una tipologia) guarda
--                 tambien el NOMBRE que tenia ese dia: la persona lee el nombre; el codigo es interno.
--              2) El NIT de una organizacion es un dato de la propia organizacion, no un dato personal:
--                 clase «organizacion», que la organizacion y la consola leen sin el modulo de Auditoria.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-10
-- Version: 20261110.30 (linea interna de desarrollo)
--
-- IDEMPOTENTE. Cada paso comprueba su estado antes de actuar; volver a ejecutarlo no duplica ni falla.
-- NO REESCRIBE LA HISTORIA: solo anade el nombre a filas que ya guardan el codigo, con la tabla
-- territorial vigente, y reclasifica las filas del NIT. Los valores no se tocan.
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.CambiosDeRegistro', N'U') IS NULL
    THROW 51130, 'Falta la tabla dbo.CambiosDeRegistro (V20261110_10).', 1;

-- 1) El nombre que tenia el codigo el dia del cambio.
IF COL_LENGTH(N'dbo.CambiosDeRegistro', N'NombreAnterior') IS NULL
    ALTER TABLE dbo.CambiosDeRegistro ADD NombreAnterior nvarchar(300) NULL;

IF COL_LENGTH(N'dbo.CambiosDeRegistro', N'NombreNuevo') IS NULL
    ALTER TABLE dbo.CambiosDeRegistro ADD NombreNuevo nvarchar(300) NULL;

-- 2) La clase «organizacion» en la restriccion de la clase de dato.
IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = N'CK_CambiosDeRegistro_ClaseDato'
             AND parent_object_id = OBJECT_ID(N'dbo.CambiosDeRegistro')
             AND definition NOT LIKE N'%organizacion%')
BEGIN
    ALTER TABLE dbo.CambiosDeRegistro DROP CONSTRAINT CK_CambiosDeRegistro_ClaseDato;
END;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_CambiosDeRegistro_ClaseDato'
                 AND parent_object_id = OBJECT_ID(N'dbo.CambiosDeRegistro'))
BEGIN
    ALTER TABLE dbo.CambiosDeRegistro ADD CONSTRAINT CK_CambiosDeRegistro_ClaseDato CHECK (ClaseDato IN (
        N'publico', N'organizacion', N'contacto', N'identificacion', N'sensible'));
END;

-- Lo que ya estaba escrito: el NIT de una organizacion deja de ser «identificacion».
-- (La identificacion de la PERSONA responsable sigue siendolo: otro campo, otro dueño.)
EXEC (N'
UPDATE dbo.CambiosDeRegistro
   SET ClaseDato = N''organizacion''
 WHERE ModuloId = N''organizaciones''
   AND CampoId = N''numeroIdentificacion''
   AND ClaseDato = N''identificacion'';');

-- Los nombres de los codigos territoriales ya escritos, con la misma forma que los escribe la API:
-- el departamento por su nombre; el municipio como «Nombre (DEPARTAMENTO)».
EXEC (N'
UPDATE c
   SET c.NombreAnterior = (SELECT TOP 1 d.NombreDepartamento FROM dbo.Divipola d WHERE d.CodigoDepartamento = c.ValorAnterior),
       c.NombreNuevo    = (SELECT TOP 1 d.NombreDepartamento FROM dbo.Divipola d WHERE d.CodigoDepartamento = c.ValorNuevo)
  FROM dbo.CambiosDeRegistro c
 WHERE c.CampoId IN (N''codigoDepartamento'', N''codigoDepartamentoSede'')
   AND c.NombreAnterior IS NULL AND c.NombreNuevo IS NULL;');

EXEC (N'
UPDATE c
   SET c.NombreAnterior = (SELECT TOP 1 d.NombreMunicipio + N'' ('' + d.NombreDepartamento + N'')''
                             FROM dbo.Divipola d WHERE d.CodigoMunicipio = c.ValorAnterior),
       c.NombreNuevo    = (SELECT TOP 1 d.NombreMunicipio + N'' ('' + d.NombreDepartamento + N'')''
                             FROM dbo.Divipola d WHERE d.CodigoMunicipio = c.ValorNuevo)
  FROM dbo.CambiosDeRegistro c
 WHERE c.CampoId IN (N''codigoMunicipio'', N''codigoMunicipioSede'')
   AND c.NombreAnterior IS NULL AND c.NombreNuevo IS NULL;');

COMMIT TRANSACTION;
