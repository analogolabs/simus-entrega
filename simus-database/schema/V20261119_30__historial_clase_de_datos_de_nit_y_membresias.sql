-- =============================================
-- Nombre del script: V20261119_30__historial_clase_de_datos_de_nit_y_membresias.sql
-- Descripcion: Aplica al historial ya escrito la decision 96 (docs/referencia/20-decisiones-y-flujos-por-modulo.md), tomada el 19 de noviembre de 2026:
--              1) El nombre de la persona en el historial de membresias («Rol de Ana Gomez») es un dato
--                 personal de contacto: las filas «miembro.*» pasan de «organizacion» a «contacto», y solo
--                 las lee la consola con el modulo de Auditoria.
--              2) Un NIT guardado antes de la regla que NO tiene forma de NIT (9 digitos que empiezan por 8
--                 o 9, con digito de verificacion opcional; p. ej. una cedula) pasa de «organizacion» a
--                 «identificacion», con el mismo efecto.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-19
-- Version: 20261119.30 (linea interna de desarrollo)
--
-- IDEMPOTENTE. Cada paso comprueba su estado antes de actuar; volver a ejecutarlo no cambia nada.
-- NO REESCRIBE LA HISTORIA: solo cambia la clase (quien lee); los valores no se tocan.
-- CON RESPALDO: la clase anterior de cada fila reclasificada queda en
-- dbo.CambiosDeRegistro_RespaldoClase_20261119, para poder revertir.
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.CambiosDeRegistro', N'U') IS NULL
    THROW 51190, 'Falta la tabla dbo.CambiosDeRegistro (V20261110_10).', 1;

IF OBJECT_ID(N'dbo.CambiosDeRegistro_RespaldoClase_20261119', N'U') IS NULL
    EXEC (N'CREATE TABLE dbo.CambiosDeRegistro_RespaldoClase_20261119 (
        IdCambio bigint NOT NULL PRIMARY KEY,
        ClaseDatoAnterior nvarchar(20) NOT NULL,
        FechaRespaldo datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME());');

-- 1) Membresias: el nombre de la persona es dato de contacto.
EXEC (N'
INSERT INTO dbo.CambiosDeRegistro_RespaldoClase_20261119 (IdCambio, ClaseDatoAnterior)
SELECT c.IdCambio, c.ClaseDato
  FROM dbo.CambiosDeRegistro c
 WHERE c.ModuloId = N''organizaciones'' AND c.CampoId LIKE N''miembro.%'' AND c.ClaseDato = N''organizacion''
   AND NOT EXISTS (SELECT 1 FROM dbo.CambiosDeRegistro_RespaldoClase_20261119 r WHERE r.IdCambio = c.IdCambio);

UPDATE dbo.CambiosDeRegistro
   SET ClaseDato = N''contacto''
 WHERE ModuloId = N''organizaciones'' AND CampoId LIKE N''miembro.%'' AND ClaseDato = N''organizacion'';');

-- 2) NIT sin forma de NIT: identificacion. Forma de NIT = solo digitos, puntos, espacios y un guion; una vez
--    quitados, 9 digitos que empiezan por 8 o 9, o esos 9 mas el digito de verificacion. (El digito de
--    verificacion no se calcula aqui: un NIT con el digito errado sigue siendo de la organizacion.)
EXEC (N'
INSERT INTO dbo.CambiosDeRegistro_RespaldoClase_20261119 (IdCambio, ClaseDatoAnterior)
SELECT c.IdCambio, c.ClaseDato
  FROM dbo.CambiosDeRegistro c
 WHERE c.ModuloId = N''organizaciones'' AND c.CampoId = N''numeroIdentificacion'' AND c.ClaseDato = N''organizacion''
   AND (
        (c.ValorAnterior IS NOT NULL AND (c.ValorAnterior LIKE N''%[^0-9. -]%'' OR
            REPLACE(REPLACE(REPLACE(c.ValorAnterior, N''.'', N''''), N'' '', N''''), N''-'', N'''') NOT LIKE N''[89][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%'' OR
            LEN(REPLACE(REPLACE(REPLACE(c.ValorAnterior, N''.'', N''''), N'' '', N''''), N''-'', N'''')) NOT IN (9, 10)))
     OR (c.ValorNuevo IS NOT NULL AND (c.ValorNuevo LIKE N''%[^0-9. -]%'' OR
            REPLACE(REPLACE(REPLACE(c.ValorNuevo, N''.'', N''''), N'' '', N''''), N''-'', N'''') NOT LIKE N''[89][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%'' OR
            LEN(REPLACE(REPLACE(REPLACE(c.ValorNuevo, N''.'', N''''), N'' '', N''''), N''-'', N'''')) NOT IN (9, 10)))
       )
   AND NOT EXISTS (SELECT 1 FROM dbo.CambiosDeRegistro_RespaldoClase_20261119 r WHERE r.IdCambio = c.IdCambio);

UPDATE c
   SET c.ClaseDato = N''identificacion''
  FROM dbo.CambiosDeRegistro c
  JOIN dbo.CambiosDeRegistro_RespaldoClase_20261119 r ON r.IdCambio = c.IdCambio
 WHERE c.CampoId = N''numeroIdentificacion'' AND c.ClaseDato = N''organizacion'';');

COMMIT TRANSACTION;
