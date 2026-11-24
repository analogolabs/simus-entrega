/*
    SIMUS · Demostración: la sede principal de todo proceso (decisión 119).

    Las siembras anteriores crean Festivales, Mercados, Talleres, Espacios y Redes sin sede principal.
    Este paso la completa para que el mapa y los filtros situen toda la demostración:

      · cobertura municipal ....... la sede es ese municipio;
      · cobertura departamental ... la sede es el departamento y su capital (código del departamento + 001,
                                    solo si existe en DIVIPOLA);
      · cobertura nacional ........ la sede es Bogotá, D. C. (11001), solo si no hay otra.

    Solo escribe donde la sede está vacía, y solo valores que existen en DIVIPOLA. IDEMPOTENTE. No borra nada.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

UPDATE t SET
    SedeCodigoDepartamento = CASE WHEN t.NivelCobertura = N'nacional' THEN '11' ELSE t.CodigoDepartamento END,
    SedeCodigoMunicipio = CASE
        WHEN t.NivelCobertura = N'municipal' THEN t.CodigoMunicipio
        WHEN t.NivelCobertura = N'nacional' THEN '11001'
        ELSE (SELECT TOP (1) d.CodigoMunicipio FROM dbo.Divipola d
               WHERE d.CodigoDepartamento = t.CodigoDepartamento AND d.CodigoMunicipio = t.CodigoDepartamento + '001')
    END
FROM dbo.Festivales t
WHERE t.SedeCodigoDepartamento IS NULL AND t.SedeCodigoMunicipio IS NULL
  AND (t.NivelCobertura <> N'nacional' OR EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '11001'))
  AND (t.NivelCobertura = N'nacional' OR t.CodigoDepartamento IS NOT NULL);

UPDATE t SET
    SedeCodigoDepartamento = CASE WHEN t.NivelCobertura = N'nacional' THEN '11' ELSE t.CodigoDepartamento END,
    SedeCodigoMunicipio = CASE
        WHEN t.NivelCobertura = N'municipal' THEN t.CodigoMunicipio
        WHEN t.NivelCobertura = N'nacional' THEN '11001'
        ELSE (SELECT TOP (1) d.CodigoMunicipio FROM dbo.Divipola d
               WHERE d.CodigoDepartamento = t.CodigoDepartamento AND d.CodigoMunicipio = t.CodigoDepartamento + '001')
    END
FROM dbo.Mercados t
WHERE t.SedeCodigoDepartamento IS NULL AND t.SedeCodigoMunicipio IS NULL
  AND (t.NivelCobertura <> N'nacional' OR EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '11001'))
  AND (t.NivelCobertura = N'nacional' OR t.CodigoDepartamento IS NOT NULL);

UPDATE t SET
    SedeCodigoDepartamento = CASE WHEN t.NivelCobertura = N'nacional' THEN '11' ELSE t.CodigoDepartamento END,
    SedeCodigoMunicipio = CASE
        WHEN t.NivelCobertura = N'municipal' THEN t.CodigoMunicipio
        WHEN t.NivelCobertura = N'nacional' THEN '11001'
        ELSE (SELECT TOP (1) d.CodigoMunicipio FROM dbo.Divipola d
               WHERE d.CodigoDepartamento = t.CodigoDepartamento AND d.CodigoMunicipio = t.CodigoDepartamento + '001')
    END
FROM dbo.Talleres t
WHERE t.SedeCodigoDepartamento IS NULL AND t.SedeCodigoMunicipio IS NULL
  AND (t.NivelCobertura <> N'nacional' OR EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '11001'))
  AND (t.NivelCobertura = N'nacional' OR t.CodigoDepartamento IS NOT NULL);

UPDATE t SET
    SedeCodigoDepartamento = CASE WHEN t.NivelCobertura = N'nacional' THEN '11' ELSE t.CodigoDepartamento END,
    SedeCodigoMunicipio = CASE
        WHEN t.NivelCobertura = N'municipal' THEN t.CodigoMunicipio
        WHEN t.NivelCobertura = N'nacional' THEN '11001'
        ELSE (SELECT TOP (1) d.CodigoMunicipio FROM dbo.Divipola d
               WHERE d.CodigoDepartamento = t.CodigoDepartamento AND d.CodigoMunicipio = t.CodigoDepartamento + '001')
    END
FROM dbo.Espacios t
WHERE t.SedeCodigoDepartamento IS NULL AND t.SedeCodigoMunicipio IS NULL
  AND (t.NivelCobertura <> N'nacional' OR EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '11001'))
  AND (t.NivelCobertura = N'nacional' OR t.CodigoDepartamento IS NOT NULL);

UPDATE t SET
    SedeCodigoDepartamento = CASE WHEN t.NivelCobertura = N'nacional' THEN '11' ELSE t.CodigoDepartamento END,
    SedeCodigoMunicipio = CASE
        WHEN t.NivelCobertura = N'municipal' THEN t.CodigoMunicipio
        WHEN t.NivelCobertura = N'nacional' THEN '11001'
        ELSE (SELECT TOP (1) d.CodigoMunicipio FROM dbo.Divipola d
               WHERE d.CodigoDepartamento = t.CodigoDepartamento AND d.CodigoMunicipio = t.CodigoDepartamento + '001')
    END
FROM dbo.Redes t
WHERE t.SedeCodigoDepartamento IS NULL AND t.SedeCodigoMunicipio IS NULL
  AND (t.NivelCobertura <> N'nacional' OR EXISTS (SELECT 1 FROM dbo.Divipola WHERE CodigoMunicipio = '11001'))
  AND (t.NivelCobertura = N'nacional' OR t.CodigoDepartamento IS NOT NULL);
