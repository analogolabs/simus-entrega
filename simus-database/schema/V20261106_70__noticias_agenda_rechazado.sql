-- =============================================
-- Nombre del script: V20261106_70__noticias_agenda_rechazado.sql
-- Descripcion: Noticias y Agenda adoptan el estado terminal «rechazado», igual que Festivales
-- y Mercados. Hasta ahora rechazar una noticia o un
--              evento en revisión los dejaba «archivado»: dos decisiones distintas (no se
--              aprobó / se retiró del flujo activo) con la misma palabra.
--              Amplía CK_Noticias_Estado y CK_EventosAgenda_Estado. No toca filas ni
--              cascadas. Idempotente: si la restricción ya admite «rechazado», no hace nada.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-06
-- Version: 20261106.70 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Noticias', N'U') IS NULL
    THROW 51070, 'Falta la tabla dbo.Noticias.', 1;
IF OBJECT_ID(N'dbo.EventosAgenda', N'U') IS NULL
    THROW 51071, 'Falta la tabla dbo.EventosAgenda.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_Noticias_Estado'
      AND parent_object_id = OBJECT_ID(N'dbo.Noticias')
      AND definition LIKE N'%rechazado%')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_Noticias_Estado' AND parent_object_id = OBJECT_ID(N'dbo.Noticias'))
        ALTER TABLE dbo.Noticias DROP CONSTRAINT CK_Noticias_Estado;

    ALTER TABLE dbo.Noticias WITH CHECK ADD CONSTRAINT CK_Noticias_Estado CHECK (
        Estado IN (N'borrador', N'en_revision', N'publicado', N'rechazado', N'archivado')
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_EventosAgenda_Estado'
      AND parent_object_id = OBJECT_ID(N'dbo.EventosAgenda')
      AND definition LIKE N'%rechazado%')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_EventosAgenda_Estado' AND parent_object_id = OBJECT_ID(N'dbo.EventosAgenda'))
        ALTER TABLE dbo.EventosAgenda DROP CONSTRAINT CK_EventosAgenda_Estado;

    ALTER TABLE dbo.EventosAgenda WITH CHECK ADD CONSTRAINT CK_EventosAgenda_Estado CHECK (
        Estado IN (N'borrador', N'en_revision', N'publicado', N'rechazado', N'archivado')
    );
END;

COMMIT TRANSACTION;
