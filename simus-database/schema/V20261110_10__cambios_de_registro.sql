-- =============================================
-- Nombre del script: V20261110_10__cambios_de_registro.sql
-- Descripcion: Registro de cambios por campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md). Una fila por campo
--              que cambia en un registro: de que valor a cual, quien, cuando y por que.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-10
-- Version: 20261110.10 (linea interna de desarrollo)
--
-- POR QUE UNA TABLA GENERICA. docs/desarrollo/13-nucleo-de-procesos.md ya lo decidio para el nucleo de procesos: el par
-- (ModuloId, RegistroId) identifica al dueño y cada proceso conserva sus propias claves. Una
-- supertabla de versiones por modulo ocultaria las reglas del dominio; esta tabla solo guarda
-- «que valia este campo el dia X».
--
-- LO QUE NO ES. No reemplaza al historial de transiciones (RegistrosRevisionHistorial: quien movio el
-- registro de estado) ni a la bitacora (BitacoraAuditoria: hechos de seguridad y de gestion). Se
-- enlaza a ellos; no los sustituye.
--
-- DATOS PERSONALES. Se guardan los valores (decision de la direccion, 10 nov 2026: «es importante
-- para el gobierno del dato»). Por eso cada fila lleva su clase de dato: la API entrega a la
-- organizacion y al publico SOLO las filas de clase «publico»; el resto lo lee unicamente la consola
-- con el modulo de Auditoria, y esa lectura queda registrada en la bitacora.
--
-- SIN CASCADAS NI DISPARADORES. Las filas no se borran con el registro: son su evidencia. Las llena
-- un servicio central de la API en la misma transaccion que el cambio, no la base.
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.CambiosDeRegistro', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CambiosDeRegistro
    (
        IdCambio bigint IDENTITY(1,1) NOT NULL,
        ModuloId nvarchar(40) NOT NULL,
        RegistroId nvarchar(64) NOT NULL,
        -- La organizacion responsable cuando se escribio la fila (copiada, no resuelta al leer):
        -- si el registro cambia de administradora, su historia no se reescribe. Nula en lo que no
        -- pertenece a una organizacion.
        OrganizacionId int NULL,
        -- Todas las filas de un mismo guardado comparten este identificador: es lo que permite
        -- leer «el guardado del 10 de noviembre cambio tres campos» y no tres lineas sueltas.
        IdGrupo uniqueidentifier NOT NULL,
        CampoId nvarchar(80) NOT NULL,
        CampoEtiqueta nvarchar(160) NOT NULL,
        ClaseDato nvarchar(20) NOT NULL,
        ValorAnterior nvarchar(max) NULL,
        ValorNuevo nvarchar(max) NULL,
        Origen nvarchar(20) NOT NULL,
        PropuestaId bigint NULL,
        VersionFestivalId int NULL,
        ActorId int NULL,
        ActorNombre nvarchar(200) NULL,
        ActorRol nvarchar(60) NULL,
        Motivo nvarchar(500) NULL,
        Fecha datetime2(0) NOT NULL CONSTRAINT DF_CambiosDeRegistro_Fecha DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_CambiosDeRegistro PRIMARY KEY (IdCambio),
        CONSTRAINT FK_CambiosDeRegistro_Usuarios FOREIGN KEY (ActorId) REFERENCES dbo.Usuarios (IdUsuario),
        CONSTRAINT CK_CambiosDeRegistro_ClaseDato CHECK (ClaseDato IN (
            N'publico', N'contacto', N'identificacion', N'sensible')),
        CONSTRAINT CK_CambiosDeRegistro_Origen CHECK (Origen IN (
            N'directo', N'propuesta', N'importacion', N'fusion', N'sistema', N'migracion')),
        CONSTRAINT CK_CambiosDeRegistro_Distinto CHECK (
            ValorAnterior IS NULL OR ValorNuevo IS NULL OR ValorAnterior <> ValorNuevo)
    );

    CREATE INDEX IX_CambiosDeRegistro_Registro
        ON dbo.CambiosDeRegistro (ModuloId, RegistroId, Fecha DESC, IdCambio DESC);

    CREATE INDEX IX_CambiosDeRegistro_Organizacion
        ON dbo.CambiosDeRegistro (OrganizacionId, Fecha DESC, IdCambio DESC)
        WHERE OrganizacionId IS NOT NULL;

    CREATE INDEX IX_CambiosDeRegistro_Grupo
        ON dbo.CambiosDeRegistro (IdGrupo);
END;

COMMIT TRANSACTION;
