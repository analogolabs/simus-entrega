-- =============================================
-- Nombre del script: V20261106_80__restablecimientos_de_contrasena.sql
-- Descripcion: Enlaces de recuperacion de contrasena de las cuentas externas (docs/desarrollo/19-cuentas-y-organizaciones.md §19.9,
-- revisión de interfaz, hallazgo de).
-- Autor: Edder Jiménez
-- Fecha: 2026-11-06
-- Version: 20261106.80 (linea interna de desarrollo)
--
-- QUE GUARDA, Y QUE NO. Una fila por solicitud. Solo se guarda el resumen SHA-256 del testigo (256 bits
-- aleatorios): quien lea esta tabla no puede restablecer la contrasena de nadie, igual que no puede
-- confirmar un correo (ConfirmacionesDeCorreo). El testigo en claro existe una sola vez, dentro del
-- enlace que sale por correo.
--
-- UN SOLO ENLACE VIVO POR CUENTA. «Vivo» es el que ni se uso ni se reemplazo: solicitar uno nuevo marca el
-- anterior con FechaInvalidacion. El indice unico filtrado lo impone en la base, no solo el codigo: dos
-- solicitudes simultaneas no pueden dejar dos enlaces abiertos.
--
-- Sin cascadas: la cuenta no se borra con sus enlaces; el historial de «lo pedi tres veces» tambien sirve
-- para el limite de solicitudes por cuenta (3 por hora, 2 minutos entre una y otra).
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.RestablecimientosDeContrasena', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RestablecimientosDeContrasena
    (
        IdRestablecimiento int IDENTITY(1,1) NOT NULL,
        IdUsuario int NOT NULL,
        HashTestigo char(64) NOT NULL,
        FechaEmision datetime2(0) NOT NULL,
        FechaExpiracion datetime2(0) NOT NULL,
        FechaUso datetime2(0) NULL,
        FechaInvalidacion datetime2(0) NULL,
        CONSTRAINT PK_RestablecimientosDeContrasena PRIMARY KEY (IdRestablecimiento),
        CONSTRAINT FK_RestablecimientosDeContrasena_Usuarios FOREIGN KEY (IdUsuario)
            REFERENCES dbo.Usuarios (IdUsuario),
        CONSTRAINT UQ_RestablecimientosDeContrasena_HashTestigo UNIQUE (HashTestigo),
        CONSTRAINT CK_RestablecimientosDeContrasena_Vigencia CHECK (FechaExpiracion > FechaEmision)
    );

    CREATE INDEX IX_RestablecimientosDeContrasena_Usuario
        ON dbo.RestablecimientosDeContrasena (IdUsuario, FechaEmision DESC);

    CREATE UNIQUE INDEX UX_RestablecimientosDeContrasena_UnoVivoPorCuenta
        ON dbo.RestablecimientosDeContrasena (IdUsuario)
        WHERE FechaUso IS NULL AND FechaInvalidacion IS NULL;
END;

COMMIT TRANSACTION;
