/*
    SIMUS · Catalogos contrastados con sus fuentes

    QUE HACE. Lleva cuatro catalogos a lo que dice su fuente, SIN CAMBIAR SU ESTRUCTURA y sin
    cambiar los ids de las filas existentes (las claves foraneas siguen valiendo):

      1. RegionesOcad          -> nombres oficiales de las regiones del Sistema General de Regalias
                                  (Ley 2056 de 2020, art. 45): «Centro Sur Amazonia» y «Llanos».
      2. ZonasUrbanoRural      -> las tres CLASES del territorio del DANE (Marco Geoestadistico
                                  Nacional): cabecera municipal, centro poblado y rural disperso.
      3. TiposDocumento        -> rotulos del RUT de la DIAN (casilla 25); el PEP se conserva activo.
      4. NaturalezasEntidad    -> la descripcion de cada valor lleva su codigo del RUT (casilla 62).

    DE DONDE SALE CADA UNO. Ver `02_Documentacion/13_Catalogos_maestros/DER_10_...` y la revision
    de antes y despues `DER_11_...`.

    LO QUE NO TOCA. Los codigos y slugs de TiposDocumento y NaturalezasEntidad; los slugs de las
    regiones (`centro-sur`, `llano`); los ids de todas las filas.

    DECISION SOBRE LO RURAL. La zona «Rural» que ya existia pasa a «Rural disperso» conservando su
    id. Era la unica forma de no perder las localizaciones ya guardadas, pero es una suposicion: el
    catalogo antiguo no distinguia centro poblado de rural disperso. Donde importe, se corrige a mano.

    IDEMPOTENTE Y SIN EFECTO EN UNA BASE VACIA. Cada paso se guia por la clave natural y no hace
    nada si la fila ya esta como debe o si la tabla aun no tiene datos (en una base nueva los valores
    los siembra `seed/V20260828_01`, que ya trae los nuevos).
*/
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Regiones del SGR: nombres oficiales (los slugs no cambian).
UPDATE dbo.RegionesOcad SET NombreRegionOcad = N'Centro Sur Amazonía'
WHERE Slug = N'centro-sur' AND NombreRegionOcad <> N'Centro Sur Amazonía';

UPDATE dbo.RegionesOcad SET NombreRegionOcad = N'Llanos'
WHERE Slug = N'llano' AND NombreRegionOcad <> N'Llanos';
GO

-- 2. Zona urbano / rural -> clase del territorio del DANE.
IF EXISTS (SELECT 1 FROM dbo.ZonasUrbanoRural)
BEGIN
    UPDATE dbo.ZonasUrbanoRural
    SET NombreZonaUrbanoRural = N'Cabecera municipal', Slug = N'cabecera-municipal', OrdenVisualizacion = 1,
        Descripcion = N'DANE, clase 1. Área del municipio donde están la alcaldía y los demás entes administrativos.'
    WHERE Slug = N'urbana';

    UPDATE dbo.ZonasUrbanoRural
    SET NombreZonaUrbanoRural = N'Rural disperso', Slug = N'rural-disperso', OrdenVisualizacion = 3,
        Descripcion = N'DANE, clase 3. Área de baja densidad, con viviendas y explotaciones agropecuarias dispersas y sin trazado de calles.'
    WHERE Slug = N'rural';

    IF NOT EXISTS (SELECT 1 FROM dbo.ZonasUrbanoRural WHERE Slug = N'centro-poblado')
        INSERT INTO dbo.ZonasUrbanoRural (NombreZonaUrbanoRural, Slug, Descripcion, OrdenVisualizacion)
        VALUES (N'Centro poblado', N'centro-poblado',
                N'DANE, clase 2. Caserío, inspección de policía o corregimiento: concentración de 20 o más viviendas contiguas.', 2);
END;
GO

-- 3. Tipos de documento: rotulo del RUT para el registro civil; el PEP se conserva (el RUT ya no lo habilita).
IF EXISTS (SELECT 1 FROM dbo.TiposDocumento)
BEGIN
    UPDATE dbo.TiposDocumento SET NombreTipoDocumento = N'Registro civil'
    WHERE CodigoTipoDocumento = N'rc' AND NombreTipoDocumento <> N'Registro civil';

    IF NOT EXISTS (SELECT 1 FROM dbo.TiposDocumento WHERE CodigoTipoDocumento = N'pep')
        INSERT INTO dbo.TiposDocumento (CodigoTipoDocumento, NombreTipoDocumento, OrdenVisualizacion, Activo)
        VALUES (N'pep', N'Permiso especial de permanencia', 7, 1);
    ELSE
        UPDATE dbo.TiposDocumento SET Activo = 1 WHERE CodigoTipoDocumento = N'pep' AND Activo = 0;
END;
GO

-- 4. Naturaleza de la entidad: el codigo del RUT (casilla 62) queda en la descripcion.
UPDATE dbo.NaturalezasEntidad SET Descripcion = N'RUT, casilla 62, código 03.'
WHERE Slug = N'publica' AND Descripcion IS NULL;
UPDATE dbo.NaturalezasEntidad SET Descripcion = N'RUT, casilla 62, código 02.'
WHERE Slug = N'privada' AND Descripcion IS NULL;
UPDATE dbo.NaturalezasEntidad SET Descripcion = N'RUT, casilla 62, código 01.'
WHERE Slug = N'mixta' AND Descripcion IS NULL;
GO
