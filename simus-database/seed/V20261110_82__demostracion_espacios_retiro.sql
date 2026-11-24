/*
    SIMUS · Demostración de espacios para música en vivo (docs/referencia/25-modulos-restantes.md), paso 1 de 2: retirar lo que sembró la pasada anterior.

    Se reconocen por su nombre (la lista de abajo es la misma que siembra V20261110_83). Las claves
    ajenas no borran en cascada (decisión del modelo), así que se borran los hijos antes que los
    padres. DEBE CORRER ANTES de `V20261106_10__demostracion_completa_retiro.sql`: ese borra
    organizaciones y cuentas a las que estos espacios apuntan.

    Se aplica con ./scripts/demo/sembrar-demo.sh completa (va en la siembra por defecto).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @T TABLE (Id int PRIMARY KEY);
INSERT INTO @T (Id)
SELECT IdEspacio FROM dbo.Espacios WHERE NombreEspacio IN (
    N'Sala Cantaclaro',
    N'Casa Llanera de Música en Yopal',
    N'Café Marimba del Pacífico',
    N'Auditorio Tayrona de la Sierra',
    N'Salón de Bandas del Oriente');

IF NOT EXISTS (SELECT 1 FROM @T) RETURN;

DELETE FROM dbo.EspaciosEquipamiento WHERE EspacioId IN (SELECT Id FROM @T);
DELETE FROM dbo.EspaciosTipos WHERE EspacioId IN (SELECT Id FROM @T);
DELETE FROM dbo.EspaciosPracticasMusicales WHERE EspacioId IN (SELECT Id FROM @T);
DELETE FROM dbo.ProcedenciasDeRegistro WHERE ModuloId = N'espacios' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.CambiosDeRegistro WHERE ModuloId = N'espacios' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.RegistrosRevisionHistorial WHERE ModuloId = N'espacios' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.Notificaciones WHERE ModuloId = N'espacios' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @T);
DELETE FROM dbo.Espacios WHERE IdEspacio IN (SELECT Id FROM @T);
