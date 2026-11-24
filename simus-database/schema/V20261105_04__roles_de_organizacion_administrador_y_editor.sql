-- =============================================
-- Nombre del script: V20261105_04__roles_de_organizacion_administrador_y_editor.sql
-- Descripcion: Dentro de una organizacion solo existen dos roles: administrador y editor
-- (docs/desarrollo/19-cuentas-y-organizaciones.md §19.3). Las filas «propietario» pasan a «administrador» y las de
--              «cargador» y «lector» pasan a «editor». Si una persona queda con dos filas para la
--              misma organizacion, se conserva la de mayor rango (administrador) y la mas antigua.
--              Escribe el conteo por rol antes y despues.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-05
-- Version: 20261105.04 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET NOCOUNT ON;

PRINT N'UsuariosEntidades por rol, ANTES:';
SELECT RolEntidad, COUNT(*) AS Filas FROM dbo.UsuariosEntidades GROUP BY RolEntidad ORDER BY RolEntidad;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = N'CK_UsuariosEntidades_Rol' AND parent_object_id = OBJECT_ID(N'dbo.UsuariosEntidades'))
    ALTER TABLE dbo.UsuariosEntidades DROP CONSTRAINT CK_UsuariosEntidades_Rol;

-- Rol de destino y rango de cada fila. El rango decide cual sobrevive si una persona tenia dos
-- vinculos con la misma organizacion (p. ej. propietario y administrador): gana la activa, despues
-- la de mayor rango, despues la mas antigua.
;WITH Destino AS (
    SELECT IdUsuarioEntidad,
           ROW_NUMBER() OVER (
               PARTITION BY IdUsuario, IdEntidad
               ORDER BY Activo DESC,
                        CASE WHEN RolEntidad IN (N'propietario', N'administrador') THEN 0 ELSE 1 END,
                        FechaCreacion, IdUsuarioEntidad) AS Orden
    FROM dbo.UsuariosEntidades
)
DELETE ue
FROM dbo.UsuariosEntidades ue
JOIN Destino d ON d.IdUsuarioEntidad = ue.IdUsuarioEntidad
WHERE d.Orden > 1;

UPDATE dbo.UsuariosEntidades SET RolEntidad = N'administrador' WHERE RolEntidad = N'propietario';
UPDATE dbo.UsuariosEntidades SET RolEntidad = N'editor' WHERE RolEntidad IN (N'cargador', N'lector');

ALTER TABLE dbo.UsuariosEntidades WITH CHECK
    ADD CONSTRAINT CK_UsuariosEntidades_Rol CHECK (RolEntidad IN (N'administrador', N'editor'));

COMMIT TRANSACTION;

PRINT N'UsuariosEntidades por rol, DESPUES:';
SELECT RolEntidad, COUNT(*) AS Filas FROM dbo.UsuariosEntidades GROUP BY RolEntidad ORDER BY RolEntidad;
