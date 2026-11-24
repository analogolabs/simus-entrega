/*
  SIMUS · Etiqueta de edición para el contenido de Celebra la música.

  QUE HACE. A todo evento de agenda y toda noticia que ya lleve la etiqueta paraguas «celebra-la-musica»
  y NO lleve la de una edición, le añade «celebra-la-musica-2025» o «celebra-la-musica-2026» según el año
  del contenido (FechaInicio del evento, FechaPublicacion de la noticia). Lo que no cae en 2025 o 2026 no
  se toca.

  SEGURIDAD. Solo INSERTA vínculos que faltan: no borra ni cambia ninguna fila, no toca cuentas, archivos
  ni el resto del estado de la demo. Es idempotente (volver a correrlo no añade nada). Si faltan los
  proyectos de edición, no hace nada.

  USO. Manual y solo cuando se decida, con sql_consulta de scripts/local/sql-local-comun.sh o sqlcmd. Las
  siembras nuevas ya etiquetan por edición: este archivo es solo para una base ya sembrada con la versión anterior.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Paraguas int = (SELECT IdProyectoTransversal FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica');
DECLARE @P25 int = (SELECT IdProyectoTransversal FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica-2025');
DECLARE @P26 int = (SELECT IdProyectoTransversal FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica-2026');

IF @Paraguas IS NULL OR @P25 IS NULL OR @P26 IS NULL
BEGIN
    PRINT N'[celebra] Faltan los proyectos transversales de Celebra la música: no se hace nada.';
    RETURN;
END

BEGIN TRANSACTION;

INSERT INTO dbo.EventosAgendaProyectosTransversales (EventoAgendaId, ProyectoTransversalId)
SELECT e.IdEventoAgenda, CASE YEAR(e.FechaInicio) WHEN 2025 THEN @P25 ELSE @P26 END
FROM dbo.EventosAgenda e
JOIN dbo.EventosAgendaProyectosTransversales v ON v.EventoAgendaId = e.IdEventoAgenda AND v.ProyectoTransversalId = @Paraguas
WHERE YEAR(e.FechaInicio) IN (2025, 2026)
  AND NOT EXISTS (SELECT 1 FROM dbo.EventosAgendaProyectosTransversales x
                  WHERE x.EventoAgendaId = e.IdEventoAgenda AND x.ProyectoTransversalId IN (@P25, @P26));
PRINT N'[celebra] Eventos etiquetados por edición: ' + CAST(@@ROWCOUNT AS nvarchar(20));

INSERT INTO dbo.NoticiasProyectosTransversales (NoticiaId, ProyectoTransversalId)
SELECT n.IdNoticia, CASE YEAR(n.FechaPublicacion) WHEN 2025 THEN @P25 ELSE @P26 END
FROM dbo.Noticias n
JOIN dbo.NoticiasProyectosTransversales v ON v.NoticiaId = n.IdNoticia AND v.ProyectoTransversalId = @Paraguas
WHERE YEAR(n.FechaPublicacion) IN (2025, 2026)
  AND NOT EXISTS (SELECT 1 FROM dbo.NoticiasProyectosTransversales x
                  WHERE x.NoticiaId = n.IdNoticia AND x.ProyectoTransversalId IN (@P25, @P26));
PRINT N'[celebra] Noticias etiquetadas por edición: ' + CAST(@@ROWCOUNT AS nvarchar(20));

COMMIT TRANSACTION;
