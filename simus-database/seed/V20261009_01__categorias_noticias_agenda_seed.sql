-- =============================================
-- Nombre del script: V20261009_01__categorias_noticias_agenda_seed.sql
-- Descripcion: Consolida catalogos propios de noticias y agenda.
--              Conserva identificadores en uso y fusiona Encuentro en Encuentros.
--              Restablece el catalogo despues de semillas historicas.
--              No modifica la clasificacion editorial.
-- Autor: Edder Jiménez
-- Fecha: 2026-10-09
-- Version: 20261009.01 (linea interna de desarrollo)
-- =============================================
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.Categorias', N'U') IS NULL
    THROW 51043, 'Falta el catalogo Categorias.', 1;
DECLARE @NoticiasAntes int = (SELECT COUNT(*) FROM dbo.Noticias);
DECLARE @AgendaAntes int = (SELECT COUNT(*) FROM dbo.EventosAgenda);
DECLARE @EditorialAntes int = (SELECT COUNT(*) FROM dbo.PublicacionesEditoriales);

DECLARE @Cambios TABLE (Modulo nvarchar(30), Anterior nvarchar(150), Nuevo nvarchar(150), Slug nvarchar(150));
INSERT INTO @Cambios VALUES
(N'noticias', N'Convocatorias', N'Convocatorias y oportunidades', N'convocatorias-y-oportunidades'),
(N'noticias', N'Encuentros', N'Eventos y circulación', N'eventos-y-circulacion'),
(N'noticias', N'Territorio', N'Procesos territoriales', N'procesos-territoriales'),
(N'noticias', N'Memoria', N'Memoria y patrimonio', N'memoria-y-patrimonio'),
(N'agenda', N'Circulación', N'Conciertos y presentaciones', N'conciertos-y-presentaciones'),
(N'agenda', N'Encuentros', N'Encuentros y diálogos', N'encuentros-y-dialogos'),
(N'agenda', N'Convocatoria', N'Convocatorias', N'convocatorias');
-- En una recarga de semillas pueden coexistir nombres antiguos y consolidados.
-- Reasignar solo el contenido del modulo correspondiente y retirar la fila redundante.
DECLARE @IdOrigen int, @IdDestino int, @Modulo nvarchar(30);
DECLARE duplicadas CURSOR LOCAL FAST_FORWARD FOR
SELECT a.IdCategoria,b.IdCategoria,x.Modulo FROM @Cambios x
JOIN dbo.Categorias a ON a.CodigoModulo=x.Modulo AND a.NombreCategoria COLLATE Latin1_General_100_CI_AI=x.Anterior COLLATE Latin1_General_100_CI_AI
JOIN dbo.Categorias b ON b.CodigoModulo=x.Modulo AND b.NombreCategoria=x.Nuevo AND b.IdCategoria<>a.IdCategoria;
OPEN duplicadas;
FETCH NEXT FROM duplicadas INTO @IdOrigen,@IdDestino,@Modulo;
WHILE @@FETCH_STATUS=0
BEGIN
    IF (@Modulo<>N'noticias' AND EXISTS(SELECT 1 FROM dbo.Noticias WHERE CategoriaId=@IdOrigen))
       OR (@Modulo<>N'agenda' AND EXISTS(SELECT 1 FROM dbo.EventosAgenda WHERE CategoriaId=@IdOrigen))
       OR EXISTS(SELECT 1 FROM dbo.PublicacionesEditoriales WHERE CategoriaId=@IdOrigen)
        THROW 51043, 'Una categoria duplicada tiene referencias de otro modulo.', 1;
    IF @Modulo=N'noticias' UPDATE dbo.Noticias SET CategoriaId=@IdDestino WHERE CategoriaId=@IdOrigen;
    IF @Modulo=N'agenda' UPDATE dbo.EventosAgenda SET CategoriaId=@IdDestino WHERE CategoriaId=@IdOrigen;
    DELETE FROM dbo.Categorias WHERE IdCategoria=@IdOrigen;
    FETCH NEXT FROM duplicadas INTO @IdOrigen,@IdDestino,@Modulo;
END;
CLOSE duplicadas;
DEALLOCATE duplicadas;
UPDATE c SET NombreCategoria=x.Nuevo, Slug=x.Slug
FROM dbo.Categorias c JOIN @Cambios x ON x.Modulo=c.CodigoModulo AND x.Anterior COLLATE Latin1_General_100_CI_AI=c.NombreCategoria COLLATE Latin1_General_100_CI_AI;

DECLARE @Origen int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo=N'agenda' AND NombreCategoria=N'Encuentro');
DECLARE @Destino int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo=N'agenda' AND NombreCategoria=N'Encuentros y diálogos');
IF @Origen IS NOT NULL
BEGIN
    IF @Destino IS NULL THROW 51043, 'Falta el destino de Encuentro.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Noticias WHERE CategoriaId=@Origen)
       OR EXISTS (SELECT 1 FROM dbo.PublicacionesEditoriales WHERE CategoriaId=@Origen)
        THROW 51043, 'Encuentro tiene referencias fuera de agenda.', 1;
    UPDATE dbo.EventosAgenda SET CategoriaId=@Destino WHERE CategoriaId=@Origen;
    DELETE FROM dbo.Categorias WHERE IdCategoria=@Origen;
END;

DECLARE @Catalogo TABLE (Modulo nvarchar(30), Nombre nvarchar(150), Slug nvarchar(150), Descripcion nvarchar(600), Orden int);
INSERT INTO @Catalogo VALUES
(N'noticias',N'Institucional',N'institucional',N'Informacion sobre el programa, sus decisiones, alianzas y resultados institucionales.',1),
(N'noticias',N'Convocatorias y oportunidades',N'convocatorias-y-oportunidades',N'Anuncios de inscripciones, apoyos, becas, estimulos y oportunidades para el sector musical.',2),
(N'noticias',N'Formación',N'formacion',N'Informacion sobre aprendizaje, procesos pedagogicos y fortalecimiento de capacidades musicales.',3),
(N'noticias',N'Eventos y circulación',N'eventos-y-circulacion',N'Anuncios y balances de festivales, conciertos, encuentros y otras actividades de circulacion musical.',4),
(N'noticias',N'Procesos territoriales',N'procesos-territoriales',N'Noticias sobre iniciativas, comunidades y articulacion del ecosistema musical en los territorios. La ubicacion se registra aparte.',5),
(N'noticias',N'Memoria y patrimonio',N'memoria-y-patrimonio',N'Informacion sobre memoria musical, saberes, archivos y patrimonio cultural.',6),
(N'noticias',N'Reconocimientos',N'reconocimientos',N'Premios, homenajes y distinciones a personas, colectivos e iniciativas musicales.',7),
(N'agenda',N'Festivales',N'festivales',N'Programaciones identificadas como festivales musicales, con una o varias jornadas.',1),
(N'agenda',N'Conciertos y presentaciones',N'conciertos-y-presentaciones',N'Conciertos, recitales, muestras y presentaciones musicales que no se registran como festival.',2),
(N'agenda',N'Formación',N'formacion',N'Talleres, cursos, seminarios y otras actividades de aprendizaje con fechas de participacion.',3),
(N'agenda',N'Encuentros y diálogos',N'encuentros-y-dialogos',N'Foros, reuniones, encuentros sectoriales y espacios de intercambio de saberes. Los talleres se clasifican en Formacion.',4),
(N'agenda',N'Convocatorias',N'convocatorias',N'Periodos de inscripcion, postulacion y fechas de cierre de convocatorias. No sustituye la noticia que las anuncia.',5);
UPDATE c SET NombreCategoria=x.Nombre, Slug=x.Slug, Descripcion=x.Descripcion, OrdenVisualizacion=x.Orden
FROM dbo.Categorias c JOIN @Catalogo x ON c.CodigoModulo=x.Modulo AND c.Slug=x.Slug;
INSERT INTO dbo.Categorias (CodigoModulo,NombreCategoria,Slug,Descripcion,OrdenVisualizacion)
SELECT x.Modulo,x.Nombre,x.Slug,x.Descripcion,x.Orden FROM @Catalogo x
WHERE NOT EXISTS (SELECT 1 FROM dbo.Categorias c WHERE c.CodigoModulo=x.Modulo AND c.Slug=x.Slug);
IF EXISTS (SELECT 1 FROM dbo.Categorias c WHERE c.CodigoModulo IN (N'noticias',N'agenda')
           AND NOT EXISTS (SELECT 1 FROM @Catalogo x WHERE x.Modulo=c.CodigoModulo AND x.Nombre=c.NombreCategoria))
    THROW 51043, 'Hay categorias adicionales de noticias o agenda: revisar su correspondencia.', 1;
IF EXISTS (SELECT 1 FROM dbo.Noticias n JOIN dbo.Categorias c ON c.IdCategoria=n.CategoriaId WHERE c.CodigoModulo<>N'noticias')
   OR EXISTS (SELECT 1 FROM dbo.EventosAgenda e JOIN dbo.Categorias c ON c.IdCategoria=e.CategoriaId WHERE c.CodigoModulo<>N'agenda')
    THROW 51043, 'Hay contenido con categorias de otro modulo.', 1;
IF @NoticiasAntes<>(SELECT COUNT(*) FROM dbo.Noticias)
   OR @AgendaAntes<>(SELECT COUNT(*) FROM dbo.EventosAgenda)
   OR @EditorialAntes<>(SELECT COUNT(*) FROM dbo.PublicacionesEditoriales)
    THROW 51043, 'Cambio inesperado en los recuentos de contenidos.', 1;
COMMIT TRANSACTION;
