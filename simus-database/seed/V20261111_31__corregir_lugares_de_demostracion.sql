/*
  Corrige el lugar de los eventos de DEMOSTRACIÓN ya sembrados.

  LA SEMILLA DEL MAPA ESCRIBÍA «Casa de la Cultura de 76100»: concatenaba el CÓDIGO del municipio
  donde iba su nombre. La fuente ya está corregida (V20260912_01); este guion arregla las filas que
  esa semilla escribió antes en una base ya sembrada. Solo toca un lugar que sea exactamente «Casa de
  la Cultura de» + el código de SU municipio: un lugar escrito a mano no se reconoce y no se toca.

  ES DE DEMOSTRACIÓN: lo ejecuta `scripts/demo/sembrar-demo.sh` (nombre `correcciones`) y NO está en la
  lista de semillas de referencia de `seed-local-db.sh`, que no lleva datos demostrativos.

  IDEMPOTENTE, y no crea objetos en el esquema: calcula la mayúscula inicial del nombre con
  conjuntos, igual que la semilla del mapa.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

-- ─────────────────────────── 1. El lugar de los eventos ───────────────────────────
DECLARE @Afectados TABLE (CodigoMunicipio char(5) PRIMARY KEY, Original nvarchar(160));
INSERT INTO @Afectados (CodigoMunicipio, Original)
SELECT DISTINCT d.CodigoMunicipio, d.NombreMunicipio
FROM dbo.EventosAgenda e
JOIN dbo.Divipola d ON d.CodigoMunicipio = e.CodigoMunicipio
WHERE e.Lugar = CONCAT(N'Casa de la Cultura de ', e.CodigoMunicipio);

DECLARE @Posiciones TABLE (n int PRIMARY KEY);
INSERT INTO @Posiciones (n)
SELECT TOP (160) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) FROM dbo.Divipola;

-- Las letras se materializan antes de juntarlas (ver la semilla del mapa: STRING_AGG con una
-- referencia exterior dentro de un CROSS APPLY falla).
DECLARE @Letras TABLE (Original nvarchar(160), n int, Letra nvarchar(2), PRIMARY KEY (Original, n));
INSERT INTO @Letras (Original, n, Letra)
SELECT a.Original, pos.n,
       CASE WHEN pos.n = 1 OR SUBSTRING(a.Original, pos.n - 1, 1) = N' '
            THEN UPPER(SUBSTRING(a.Original, pos.n, 1))
            ELSE LOWER(SUBSTRING(a.Original, pos.n, 1)) END
FROM (SELECT DISTINCT Original FROM @Afectados) a
JOIN @Posiciones pos ON pos.n <= LEN(a.Original);

DECLARE @Legibles TABLE (Original nvarchar(160) PRIMARY KEY, Legible nvarchar(160));
INSERT INTO @Legibles (Original, Legible)
SELECT Original,
       -- Los conectores vuelven a minúscula: «Santa Fe de Antioquia», no «Santa Fe De Antioquia».
       REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           STRING_AGG(Letra, N'') WITHIN GROUP (ORDER BY n),
           N' De ', N' de '), N' Del ', N' del '), N' La ', N' la '), N' Y ', N' y '), N' El ', N' el ')
FROM @Letras
GROUP BY Original;

UPDATE e
SET Lugar = CONCAT(N'Casa de la Cultura de ', l.Legible),
    FechaActualizacion = SYSUTCDATETIME()
FROM dbo.EventosAgenda e
JOIN @Afectados a ON a.CodigoMunicipio = e.CodigoMunicipio
JOIN @Legibles l ON l.Original = a.Original
WHERE e.Lugar = CONCAT(N'Casa de la Cultura de ', e.CodigoMunicipio);

COMMIT TRANSACTION;
