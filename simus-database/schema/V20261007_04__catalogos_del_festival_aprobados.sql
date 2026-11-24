/*
    SIMUS · Catalogos del Festival: cambios aprobados el 7-oct-2026

      1. TitulacionesColectivas -> descripcion con la norma de cada figura.
      2. FuentesFinanciacion    -> cuatro fuentes nuevas: Estampilla Procultura, contribucion
                                   parafiscal de los espectaculos publicos (Ley 1493 de 2011), regalias y
                                   cooperacion internacional. «Otra» pasa al final.
      3. TipologiasFestival     -> se retiran «Conferencia» (no es un tipo de festival) y «Mercado» y
                                   «Mercados culturales» (los Mercados tienen su propio modulo).

    SOBRE EL RETIRO. Estas tablas no tienen `Activo`: retirar un valor es borrar la fila. Por eso el retiro
    SE NIEGA si alguna edicion o version ya la usa (en la base local no hay ninguna); la migracion falla
    entera, antes de tocar nada, y quien la aplique decide a que tipologia pasar esos registros.

    Idempotente. Sin cambios de estructura ni de ids de las filas que se conservan.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- 1. Titulaciones colectivas: la norma de cada figura.
UPDATE dbo.TitulacionesColectivas SET Descripcion = N'Comunidades negras. Ley 70 de 1993.'
WHERE Slug = N'consejo-comunitario' AND Descripcion IS NULL;
UPDATE dbo.TitulacionesColectivas SET Descripcion = N'Pueblos indígenas. Decreto 2164 de 1995.'
WHERE Slug = N'resguardo-indigena' AND Descripcion IS NULL;
UPDATE dbo.TitulacionesColectivas SET Descripcion = N'La localización no está en un territorio colectivo.'
WHERE Slug = N'no-aplica' AND Descripcion IS NULL;
GO

-- 2. Fuentes de financiacion: cuatro nuevas antes de «Otra».
IF EXISTS (SELECT 1 FROM dbo.FuentesFinanciacion)
BEGIN
    INSERT INTO dbo.FuentesFinanciacion (NombreFuenteFinanciacion, Slug, Descripcion, OrdenVisualizacion)
    SELECT v.N, v.S, v.D, v.O FROM (VALUES
        (N'Estampilla Procultura', N'estampilla-procultura', N'Recursos de la estampilla procultura de departamentos y municipios.', 9),
        (N'Contribución parafiscal de espectáculos públicos', N'contribucion-parafiscal', N'Ley 1493 de 2011.', 10),
        (N'Regalías', N'regalias', N'Sistema General de Regalías.', 11),
        (N'Cooperación internacional', N'cooperacion-internacional', NULL, 12)
    ) AS v (N, S, D, O) WHERE NOT EXISTS (SELECT 1 FROM dbo.FuentesFinanciacion t WHERE t.Slug = v.S);

    UPDATE dbo.FuentesFinanciacion SET OrdenVisualizacion = 13 WHERE Slug = N'otra' AND OrdenVisualizacion <> 13;
END;
GO

-- 3. Tipologias de festival: retiro de tres, con la comprobacion de que nadie las use.
IF EXISTS (
    SELECT 1 FROM dbo.TipologiasFestival t
    WHERE t.Slug IN (N'conferencia', N'mercado', N'mercados-culturales')
      AND (EXISTS (SELECT 1 FROM dbo.EdicionesFestival e WHERE e.TipologiaFestivalId = t.IdTipologiaFestival)
        OR EXISTS (SELECT 1 FROM dbo.VersionesFestival v WHERE v.TipologiaFestivalId = t.IdTipologiaFestival)))
    THROW 51010, 'No se retiran las tipologias Conferencia, Mercado y Mercados culturales: hay ediciones o versiones que las usan. Reasignarlas antes de migrar.', 1;

DELETE FROM dbo.TipologiasFestival WHERE Slug IN (N'conferencia', N'mercado', N'mercados-culturales');

UPDATE dbo.TipologiasFestival SET OrdenVisualizacion = 6 WHERE Slug = N'encuentros' AND OrdenVisualizacion <> 6;
UPDATE dbo.TipologiasFestival SET OrdenVisualizacion = 7 WHERE Slug = N'otra' AND OrdenVisualizacion <> 7;
GO
