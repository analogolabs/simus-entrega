-- =============================================
-- Nombre del script: V20261105_05__invitaciones_de_organizacion.sql
-- Descripcion: Invitaciones para unirse a una organizacion como administrador o editor
-- (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4). Enlace de un solo uso, 7 dias; se guarda solo el resumen
--              SHA-256 del testigo; una invitacion pendiente por correo y organizacion.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-05
-- Version: 20261105.05 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.InvitacionesDeOrganizacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InvitacionesDeOrganizacion
    (
        IdInvitacion int IDENTITY(1,1) NOT NULL,
        IdEntidad int NOT NULL,
        CorreoInvitado nvarchar(240) NOT NULL,
        RolEntidad nvarchar(20) NOT NULL,
        HashTestigo nvarchar(64) NOT NULL,
        Estado nvarchar(20) NOT NULL CONSTRAINT DF_InvitacionesDeOrganizacion_Estado DEFAULT (N'pendiente'),
        IdUsuarioInvita int NOT NULL,
        FechaEmision datetime2(0) NOT NULL,
        FechaExpiracion datetime2(0) NOT NULL,
        IdUsuarioAcepta int NULL,
        FechaCierre datetime2(0) NULL,
        CONSTRAINT PK_InvitacionesDeOrganizacion PRIMARY KEY (IdInvitacion),
        CONSTRAINT FK_InvitacionesDeOrganizacion_Entidades FOREIGN KEY (IdEntidad) REFERENCES dbo.Entidades (IdEntidad),
        CONSTRAINT FK_InvitacionesDeOrganizacion_Invita FOREIGN KEY (IdUsuarioInvita) REFERENCES dbo.Usuarios (IdUsuario),
        CONSTRAINT FK_InvitacionesDeOrganizacion_Acepta FOREIGN KEY (IdUsuarioAcepta) REFERENCES dbo.Usuarios (IdUsuario),
        CONSTRAINT CK_InvitacionesDeOrganizacion_Rol CHECK (RolEntidad IN (N'administrador', N'editor')),
        CONSTRAINT CK_InvitacionesDeOrganizacion_Estado CHECK (Estado IN (N'pendiente', N'aceptada', N'revocada', N'vencida')),
        CONSTRAINT CK_InvitacionesDeOrganizacion_Vigencia CHECK (FechaExpiracion > FechaEmision)
    );

    CREATE UNIQUE INDEX UQ_InvitacionesDeOrganizacion_HashTestigo
        ON dbo.InvitacionesDeOrganizacion (HashTestigo);

    -- Una pendiente por correo y organizacion.
    CREATE UNIQUE INDEX UX_InvitacionesDeOrganizacion_PendientePorCorreo
        ON dbo.InvitacionesDeOrganizacion (IdEntidad, CorreoInvitado)
        WHERE Estado = N'pendiente';
END;

COMMIT TRANSACTION;
