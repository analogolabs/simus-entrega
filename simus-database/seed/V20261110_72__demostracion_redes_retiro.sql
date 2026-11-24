/*
    SIMUS · Demostración de redes y documentación (#56), paso 1 de 2: retirar lo que sembró la pasada anterior.

    Se reconocen por su nombre (la tabla de abajo es la misma que siembra V20261110_73). Las claves
    ajenas no borran en cascada (decisión del modelo), así que se borran los hijos antes que los
    padres. DEBE CORRER ANTES de `V20261106_10__demostracion_completa_retiro.sql`: ese borra
    organizaciones y cuentas a las que estas redes apuntan.

    Se aplica con ./scripts/demo/sembrar-demo.sh completa (va en la siembra por defecto).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @T TABLE (Id int PRIMARY KEY);
INSERT INTO @T (Id)
SELECT IdRed FROM dbo.Redes WHERE NombreRed IN (
    N'Archivo Sonoro del Cauca',
    N'Centro de Documentación del Joropo Llanero',
    N'Fonoteca del Pacífico',
    N'Red de Investigadores de Músicas del Caribe',
    N'Archivo de Bandas del Oriente');

IF NOT EXISTS (SELECT 1 FROM @T) RETURN;

DELETE FROM dbo.RedesFormasDeAcceso WHERE RedId IN (SELECT Id FROM @T);
DELETE FROM dbo.RedesFormatos WHERE RedId IN (SELECT Id FROM @T);
DELETE FROM dbo.RedesPracticasMusicales WHERE RedId IN (SELECT Id FROM @T);
DELETE FROM dbo.ProcedenciasDeRegistro WHERE ModuloId = N'redes' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.CambiosDeRegistro WHERE ModuloId = N'redes' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'redes' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.Notificaciones WHERE ModuloId = N'redes' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.Redes WHERE IdRed IN (SELECT Id FROM @T);
