/*
    SIMUS · Demostración de talleres de lutería (#55), paso 1 de 2: retirar lo que sembró la pasada anterior.

    Se reconocen por su nombre (la tabla de abajo es la misma que siembra V20261110_53). Las claves
    ajenas no borran en cascada (decisión del modelo), así que se borran los hijos antes que los
    padres. DEBE CORRER ANTES de `V20261106_10__demostracion_completa_retiro.sql`: ese borra
    organizaciones y cuentas a las que estos talleres apuntan.

    Se aplica con ./scripts/demo/sembrar-demo.sh completa (va en la siembra por defecto).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @T TABLE (Id int PRIMARY KEY);
INSERT INTO @T (Id)
SELECT IdTaller FROM dbo.Talleres WHERE NombreTaller IN (
    N'Taller de Lutería Los Cedros',
    N'Lutería Llanera de Arpas y Cuatros',
    N'Taller de Marimbas de Chonta del Pacífico',
    N'Taller de Gaitas y Tambores de la Sierra',
    N'Lutería de Bandas del Oriente');

IF NOT EXISTS (SELECT 1 FROM @T) RETURN;

DELETE FROM dbo.TalleresServicios WHERE TallerId IN (SELECT Id FROM @T);
DELETE FROM dbo.TalleresFamiliasDeInstrumentos WHERE TallerId IN (SELECT Id FROM @T);
DELETE FROM dbo.TalleresPracticasMusicales WHERE TallerId IN (SELECT Id FROM @T);
DELETE FROM dbo.ProcedenciasDeRegistro WHERE ModuloId = N'talleres' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.CambiosDeRegistro WHERE ModuloId = N'talleres' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'talleres' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.Notificaciones WHERE ModuloId = N'talleres' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.Talleres WHERE IdTaller IN (SELECT Id FROM @T);
