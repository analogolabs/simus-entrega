-- =============================================
-- Nombre del script: V20261122_20__boletin_autorizacion_simus.sql
-- Descripcion: Publica la version 2026-11-22 de la autorizacion del boletin, que nombra al
--              Sistema de Informacion de la Musica (SIMUS) en lugar del «PNMC».
--              CAMBIAR UN TEXTO ES PUBLICAR UNA VERSION, NO EDITAR LA ANTERIOR: la fila
--              2026-09-12 (y la 2026-08-28) queda con Vigente = 0 y SIN TOCAR, porque las
--              autorizaciones ya otorgadas se refieren a ella y guardan su propia copia del texto.
--              No se reescribe ninguna fila de dbo.AutorizacionesDatos ni de BoletinSuscripciones.
--              Las suscripciones nuevas y las confirmaciones pendientes veran la version vigente.
--              Idempotente: si la version ya existe, no hace nada.
-- Autor: Edder Jiménez
-- Fecha: 2026-11-22
-- Version: 20261122.20 (linea interna de desarrollo)
-- =============================================
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.PoliticasDatos WHERE Clave = N'boletin' AND Version = N'2026-11-22')
BEGIN
    -- Primero se retira la vigente: el indice UX_PoliticasDatos_ClaveVigente solo admite una.
    UPDATE dbo.PoliticasDatos SET Vigente = 0 WHERE Clave = N'boletin' AND Vigente = 1;

    INSERT INTO dbo.PoliticasDatos (Clave, Version, Titulo, Texto, Vigente, FechaPublicacion)
    VALUES (
        N'boletin',
        N'2026-11-22',
        N'Autorización para recibir el boletín del SIMUS',
        N'Autorizo al Ministerio de las Culturas, las Artes y los Saberes —responsable del tratamiento— a usar mi correo electrónico con la única finalidad de enviarme el boletín del Sistema de Información de la Música (SIMUS), administrado por el Plan Nacional de Música para la Convivencia: convocatorias, publicaciones y agenda.

El correo es el único dato que se trata. No se usará para ninguna otra finalidad, no se entregará a terceros y no se cruzará con otra información mía.

Suscribirme es voluntario. Conforme al artículo 8 de la Ley 1581 de 2012 puedo conocer, actualizar y rectificar mi dato, solicitar prueba de esta autorización y revocarla en cualquier momento, desde el enlace que acompaña a cada envío o escribiendo por los canales del Ministerio.',
        1,
        SYSUTCDATETIME());
END;

COMMIT TRANSACTION;
