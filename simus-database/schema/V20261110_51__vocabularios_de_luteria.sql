/*
  SIMUS · Lutería: vocabularios iniciales (docs/referencia/27-fuentes-de-luteria.md §27.4)

  TODOS NACEN COMO «PROPUESTO». Ningún valor está verificado en una fuente abierta (docs/referencia/27-fuentes-de-luteria.md: el
  buscador devolvió resúmenes, no se abrieron los textos). Se pueden elegir desde el primer día
  —si no, el formulario estaría vacío— y la dirección del sistema, el Plan Nacional de Música para
  la Convivencia, los aprueba después.

  LO QUE NO SE SIEMBRA, A PROPOSITO:
  - Instrumentos tradicionales regionales (llaneros, del Caribe, del Pacífico, andinos): ninguna
    fuente vista da la lista y no se completan de memoria (docs/referencia/27-fuentes-de-luteria.md §27.4.2).
  - Oficios, saberes y técnicas: los oficios se expresan como «servicios del taller» y los saberes
    son texto libre (docs/referencia/27-fuentes-de-luteria.md §27.4.3 y §27.4.4).
  - Maderas y materiales: fuera de la primera versión (docs/referencia/27-fuentes-de-luteria.md §27.4.5).
*/

-- ── Familias de instrumentos: las cinco clases de Hornbostel-Sachs (F-13, F-14) ────────────────

INSERT INTO dbo.FamiliasDeInstrumentos (NombreFamilia, Slug, FamiliaPadreId, EstadoAprobacion, Fuente, OrdenVisualizacion)
SELECT v.NombreFamilia, v.Slug, NULL, N'propuesto', v.Fuente, v.OrdenVisualizacion
FROM (VALUES
    (N'Cordófonos', N'cordofonos', N'F-13, F-14, F-08', 1),
    (N'Aerófonos', N'aerofonos', N'F-13, F-14', 2),
    (N'Membranófonos', N'membranofonos', N'F-13, F-14', 3),
    (N'Idiófonos', N'idiofonos', N'F-13, F-14', 4),
    (N'Electrófonos', N'electrofonos', N'F-13', 5)
) AS v(NombreFamilia, Slug, Fuente, OrdenVisualizacion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.FamiliasDeInstrumentos f WHERE f.Slug = v.Slug);

-- Subnivel de uso del módulo (no una subdivisión oficial) con base en F-08: cuerda frotada y pulsada.
INSERT INTO dbo.FamiliasDeInstrumentos (NombreFamilia, Slug, FamiliaPadreId, EstadoAprobacion, Fuente, OrdenVisualizacion)
SELECT v.NombreFamilia, v.Slug, p.IdFamiliaInstrumento, N'propuesto', N'F-08', v.OrdenVisualizacion
FROM (VALUES
    (N'Cordófonos frotados', N'cordofonos-frotados', 11),
    (N'Cordófonos pulsados', N'cordofonos-pulsados', 12)
) AS v(NombreFamilia, Slug, OrdenVisualizacion)
JOIN dbo.FamiliasDeInstrumentos p ON p.Slug = N'cordofonos'
WHERE NOT EXISTS (SELECT 1 FROM dbo.FamiliasDeInstrumentos f WHERE f.Slug = v.Slug);

-- ── Servicios del taller (en lugar de un catálogo de oficios, docs/referencia/27-fuentes-de-luteria.md §27.4.3) ──────────────────

INSERT INTO dbo.ServiciosDeTaller (NombreServicio, Slug, EstadoAprobacion, Fuente, OrdenVisualizacion)
SELECT v.NombreServicio, v.Slug, N'propuesto', v.Fuente, v.OrdenVisualizacion
FROM (VALUES
    (N'Construcción de instrumentos', N'construccion', N'F-07, F-08', 1),
    (N'Reparación', N'reparacion', N'F-07', 2),
    (N'Restauración y conservación', N'restauracion', N'F-08', 3),
    (N'Afinación y puesta a punto', N'afinacion', N'F-16', 4),
    (N'Venta de instrumentos', N'venta', NULL, 5),
    (N'Enseñanza y formación', N'ensenanza', N'F-07', 6)
) AS v(NombreServicio, Slug, Fuente, OrdenVisualizacion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ServiciosDeTaller s WHERE s.Slug = v.Slug);
