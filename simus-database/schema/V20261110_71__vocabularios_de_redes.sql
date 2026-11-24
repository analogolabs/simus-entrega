/*
  SIMUS · Redes y documentación: vocabularios iniciales (docs/referencia/25-modulos-restantes.md §25.4)

  TODOS NACEN COMO «PROPUESTO». Son una propuesta técnica, no una lista oficial: ninguno viene de
  una fuente verificada (no existe un vocabulario colombiano único de formas de acceso ni de formatos
  de documentación musical). Se pueden elegir desde el primer día —si no, el formulario estaría
  vacío— y la dirección del sistema, el Plan Nacional de Música para la Convivencia, los aprueba o
  los ajusta después.

  LO QUE NO SE SIEMBRA, A PROPOSITO:
  - Acervos y colecciones: son texto libre de cada red. No hay datos reales con los que construir un
    vocabulario, y duplicaría al Catálogo Editorial.
  - Un catálogo de documentos: la red dice qué acervos tiene y cómo se consultan, no cataloga cada
    pieza (eso es el Catálogo Editorial).
*/

-- ── Formatos de documentación: cinco clases y dos subniveles dentro de «Impreso» ───────────────

INSERT INTO dbo.FormatosDeDocumentacion (NombreFormato, Slug, FormatoPadreId, EstadoAprobacion, Fuente, OrdenVisualizacion)
SELECT v.NombreFormato, v.Slug, NULL, N'propuesto', N'Propuesta técnica (docs/referencia/25-modulos-restantes.md)', v.OrdenVisualizacion
FROM (VALUES
    (N'Sonoro', N'sonoro', 1),
    (N'Audiovisual', N'audiovisual', 2),
    (N'Impreso', N'impreso', 3),
    (N'Fotográfico y gráfico', N'fotografico-y-grafico', 4),
    (N'Digital', N'digital', 5),
    (N'Objetos', N'objetos', 6)
) AS v(NombreFormato, Slug, OrdenVisualizacion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.FormatosDeDocumentacion f WHERE f.Slug = v.Slug);

-- Subniveles del formato impreso: partituras, y libros y publicaciones periódicas.
INSERT INTO dbo.FormatosDeDocumentacion (NombreFormato, Slug, FormatoPadreId, EstadoAprobacion, Fuente, OrdenVisualizacion)
SELECT v.NombreFormato, v.Slug, p.IdFormato, N'propuesto', N'Propuesta técnica (docs/referencia/25-modulos-restantes.md)', v.OrdenVisualizacion
FROM (VALUES
    (N'Partituras', N'partituras', 31),
    (N'Libros y publicaciones periódicas', N'libros-y-periodicos', 32)
) AS v(NombreFormato, Slug, OrdenVisualizacion)
JOIN dbo.FormatosDeDocumentacion p ON p.Slug = N'impreso'
WHERE NOT EXISTS (SELECT 1 FROM dbo.FormatosDeDocumentacion f WHERE f.Slug = v.Slug);

-- ── Formas de acceso y consulta ─────────────────────────────────────────────────────────────────

INSERT INTO dbo.FormasDeAccesoDeRed (NombreFormaDeAcceso, Slug, EstadoAprobacion, Fuente, OrdenVisualizacion)
SELECT v.NombreFormaDeAcceso, v.Slug, N'propuesto', N'Propuesta técnica (docs/referencia/25-modulos-restantes.md)', v.OrdenVisualizacion
FROM (VALUES
    (N'Consulta en sala', N'consulta-en-sala', 1),
    (N'Consulta en línea', N'consulta-en-linea', 2),
    (N'Con cita previa', N'con-cita-previa', 3),
    (N'Solo para investigadores', N'solo-investigadores', 4),
    (N'Préstamo de materiales', N'prestamo', 5),
    (N'Reproducción o copia digital', N'copia-digital', 6),
    (N'Visitas guiadas', N'visitas-guiadas', 7)
) AS v(NombreFormaDeAcceso, Slug, OrdenVisualizacion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.FormasDeAccesoDeRed s WHERE s.Slug = v.Slug);
