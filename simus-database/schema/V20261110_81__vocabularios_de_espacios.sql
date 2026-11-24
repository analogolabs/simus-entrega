/*
  SIMUS · Espacios para música en vivo: vocabularios iniciales (docs/referencia/25-modulos-restantes.md §25.7)

  TODOS NACEN COMO «PROPUESTO». Son listas cortas propuestas por el equipo técnico, sin una fuente
  oficial detrás: no existe un catálogo nacional de tipos de espacio para música en vivo que este
  proyecto haya podido verificar. Se pueden elegir desde el primer día —si no, el formulario estaría
  vacío— y la dirección del sistema, el Plan Nacional de Música para la Convivencia, los aprueba o
  los ajusta después. La columna `Fuente` queda vacía a propósito: no se inventa una cita.

  LO QUE NO SE SIEMBRA, A PROPOSITO: capacidades técnicas detalladas (potencia, marcas, plano de
  escenario). El aforo es un número opcional en el espacio y el detalle va en el texto libre.
*/

-- ── Tipos de espacio ────────────────────────────────────────────────────────────────────────────

INSERT INTO dbo.TiposDeEspacio (NombreTipo, Slug, EstadoAprobacion, Fuente, OrdenVisualizacion)
SELECT v.NombreTipo, v.Slug, N'propuesto', NULL, v.OrdenVisualizacion
FROM (VALUES
    (N'Bar o taberna', N'bar', 1),
    (N'Restaurante o café con música en vivo', N'restaurante-cafe', 2),
    (N'Sala de conciertos', N'sala-de-conciertos', 3),
    (N'Teatro', N'teatro', 4),
    (N'Auditorio', N'auditorio', 5),
    (N'Casa de cultura o centro cultural', N'casa-de-cultura', 6),
    (N'Escenario al aire libre', N'escenario-al-aire-libre', 7),
    (N'Otro lugar', N'otro', 8)
) AS v(NombreTipo, Slug, OrdenVisualizacion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.TiposDeEspacio t WHERE t.Slug = v.Slug);

-- ── Equipamiento del espacio ────────────────────────────────────────────────────────────────────

INSERT INTO dbo.EquipamientoDeEspacio (NombreEquipamiento, Slug, EstadoAprobacion, Fuente, OrdenVisualizacion)
SELECT v.NombreEquipamiento, v.Slug, N'propuesto', NULL, v.OrdenVisualizacion
FROM (VALUES
    (N'Sistema de sonido', N'sonido', 1),
    (N'Iluminación escénica', N'iluminacion', 2),
    (N'Tarima o escenario fijo', N'tarima', 3),
    (N'Instrumentos y amplificación de respaldo', N'backline', 4),
    (N'Camerinos', N'camerinos', 5),
    (N'Grabación o transmisión', N'grabacion-transmision', 6)
) AS v(NombreEquipamiento, Slug, OrdenVisualizacion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.EquipamientoDeEspacio e WHERE e.Slug = v.Slug);
