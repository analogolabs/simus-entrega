-- =============================================
-- Nombre del script: V20261110_11__bitacora_verbo_consultar.sql
-- Descripcion: Amplia CK_BitacoraAuditoria_Accion con el verbo «consultar» (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md, fase 0 de
-- la lectura de datos personales de identificacion deja rastro. Hasta ahora la
--              bitacora solo audita escrituras y accesos.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-10
-- Version: 20261110.11 (linea interna de desarrollo)
--
-- COMO SE AMPLIA SIN RIESGO. La lista nueva es la anterior MAS un verbo: ninguna fila existente
-- puede dejar de cumplirla, asi que se vuelve a crear la restriccion WITH CHECK sin que falle
-- sobre datos ya escritos. Idempotente: si la restriccion ya admite «consultar», no hace nada.
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.BitacoraAuditoria', N'U') IS NULL
    THROW 51110, 'Falta la tabla dbo.BitacoraAuditoria.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_BitacoraAuditoria_Accion'
      AND parent_object_id = OBJECT_ID(N'dbo.BitacoraAuditoria')
      AND definition LIKE N'%consultar%')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_BitacoraAuditoria_Accion'
                 AND parent_object_id = OBJECT_ID(N'dbo.BitacoraAuditoria'))
        ALTER TABLE dbo.BitacoraAuditoria DROP CONSTRAINT CK_BitacoraAuditoria_Accion;

    ALTER TABLE dbo.BitacoraAuditoria WITH CHECK ADD CONSTRAINT CK_BitacoraAuditoria_Accion CHECK (Accion IN (
        N'crear', N'actualizar', N'eliminar', N'publicar', N'archivar',
        N'aprobar', N'rechazar', N'iniciar_sesion', N'cerrar_sesion',
        N'iniciar_sesion_externa', N'cerrar_sesion_externa',
        N'crear_organizacion', N'asignar_administrador_inicial',
        N'consultar'
    ));
END;

COMMIT TRANSACTION;
