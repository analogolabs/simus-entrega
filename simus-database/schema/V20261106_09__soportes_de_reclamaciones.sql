-- =============================================
-- Nombre del script: V20261106_09__soportes_de_reclamaciones.sql
-- Descripcion: Los soportes de una solicitud de administracion de un Festival historico
-- (hallazgo REC-16).
--              La organizacion adjunta actas, afiches o certificados desde el Banco de
--              archivos y el vinculo va en dbo.ArchivosDeRegistro, con su foranea a
--              dbo.Archivos, en vez de en el texto libre de EvidenciasJson.
--              - CK_ArchivosDeRegistro_Modulo admite tambien 'reclamaciones-administracion'
--                (el mismo identificador que ya usan las notificaciones del tramite).
--              Idempotente: si la restriccion ya admite el valor, no se toca.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-06
-- Version: 20261106.09 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.ArchivosDeRegistro', N'U') IS NULL
    THROW 51148, 'Falta la tabla dbo.ArchivosDeRegistro.', 1;

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = N'CK_ArchivosDeRegistro_Modulo'
             AND parent_object_id = OBJECT_ID(N'dbo.ArchivosDeRegistro')
             AND definition NOT LIKE N'%reclamaciones-administracion%')
    ALTER TABLE dbo.ArchivosDeRegistro DROP CONSTRAINT CK_ArchivosDeRegistro_Modulo;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_ArchivosDeRegistro_Modulo'
                 AND parent_object_id = OBJECT_ID(N'dbo.ArchivosDeRegistro'))
    ALTER TABLE dbo.ArchivosDeRegistro WITH CHECK ADD CONSTRAINT CK_ArchivosDeRegistro_Modulo
        CHECK (ModuloId IN (N'festivales', N'versiones-festival', N'ediciones-festival', N'ediciones-mercado',
                            N'reclamaciones-administracion'));

COMMIT TRANSACTION;
GO
