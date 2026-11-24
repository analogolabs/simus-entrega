/*
    SIMUS — Semilla de demostración de Noticias
    ===========================================

    POR QUE EXISTE. En pre-entrega no hay noticias reales, y la portada, el listado público, el
    detalle y el panel de la consola se juzgan vacíos. Esta semilla deja un conjunto pequeño con la
    forma correcta:

      · Siete categorías cubiertas ...... el filtro por categoría tiene qué filtrar.
      · Fechas repartidas en ~2 meses .... el orden por fecha y la paginación se ven.
      · Dos programadas a futuro ......... «programada» no aparece en público hasta su fecha.
      · Un borrador y una en revisión .... la consola tiene trabajo editorial pendiente.
      · Clasificación parcial ............ territorios sonoros y prácticas con huecos.

    TODO ES DE DEMOSTRACION. Los textos no describen hechos reales; la autoría lo declara.

    SE PIDE A MANO Y SE PUEDE DESHACER. La aplica `scripts/demo/sembrar-demo.sh` (o la reconstrucción
    completa `scripts/demo/reconstruir-demo-local.sh`), nunca `migrar`. Antes de sembrar retira lo que
    ella misma sembró, identificado por `dbo.ProcedenciasDeRegistro` con `ModuloId = 'noticias'` y
    `ContextoOrigen = 'siembra'`. No toca ninguna otra noticia.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @UsuarioSiembra int = (SELECT TOP 1 IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'webmaster@simus.test');
IF @UsuarioSiembra IS NULL
BEGIN
    RAISERROR(N'No existe webmaster@simus.test. Arranca la API una vez en local (./scripts/local/dev-up.sh): crea las cuentas de arranque.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE CodigoModulo = N'noticias')
BEGIN
    RAISERROR(N'No hay categorías de noticias. Ejecuta antes ./scripts/local/seed-local-db.sh.', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1. RETIRAR LO SEMBRADO ANTES
--
-- Hijos antes que el padre: ninguna clave ajena hacia dbo.Noticias borra en cascada.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Anteriores TABLE (Id bigint PRIMARY KEY);
INSERT INTO @Anteriores (Id)
SELECT CAST(RegistroId AS bigint) FROM dbo.ProcedenciasDeRegistro
WHERE ModuloId = N'noticias' AND ContextoOrigen = N'siembra';

DELETE FROM dbo.EtiquetasNoticia WHERE NoticiaId IN (SELECT Id FROM @Anteriores);
DELETE FROM dbo.NoticiasTerritoriosSonoros WHERE NoticiaId IN (SELECT Id FROM @Anteriores);
DELETE FROM dbo.NoticiasPracticasMusicales WHERE NoticiaId IN (SELECT Id FROM @Anteriores);
DELETE FROM dbo.NoticiasProyectosTransversales WHERE NoticiaId IN (SELECT Id FROM @Anteriores);
DELETE FROM dbo.NoticiasArchivos WHERE NoticiaId IN (SELECT Id FROM @Anteriores);
DELETE FROM dbo.Noticias WHERE IdNoticia IN (SELECT Id FROM @Anteriores);
DELETE FROM dbo.ProcedenciasDeRegistro WHERE ModuloId = N'noticias' AND ContextoOrigen = N'siembra';

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2. LAS NOTICIAS
--
-- `Dias` es la distancia a hoy: negativa en el pasado, positiva para las programadas. La categoría
-- se busca por nombre en el catálogo vigente; si una no existe, la noticia queda sin categoría.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @Hoy date = CAST(SYSUTCDATETIME() AS date);

DECLARE @Plan TABLE (
    Orden int PRIMARY KEY,
    Slug nvarchar(360) NOT NULL,
    Titulo nvarchar(600) NOT NULL,
    Resumen nvarchar(1000) NOT NULL,
    Cuerpo nvarchar(max) NOT NULL,
    Categoria nvarchar(200) NOT NULL,
    Estado nvarchar(40) NOT NULL,
    Dias int NULL);

INSERT INTO @Plan (Orden, Slug, Titulo, Resumen, Cuerpo, Categoria, Estado, Dias) VALUES
(1, N'demo-abre-convocatoria-de-estimulos-para-escuelas-de-musica',
    N'Abre la convocatoria de estímulos para escuelas de música',
    N'Escuelas municipales y procesos comunitarios podrán postular proyectos de formación y dotación hasta finales de mes.',
    N'La convocatoria está dirigida a escuelas municipales de música y a procesos comunitarios con al menos dos años de trayectoria.' + NCHAR(10) + NCHAR(10)
    + N'Los proyectos pueden incluir formación de formadores, dotación de instrumentos y circulación de agrupaciones en su región.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración: no corresponde a una convocatoria real.',
    N'Convocatorias y oportunidades', N'publicado', -3),
(2, N'demo-encuentro-de-bandas-reune-agrupaciones-de-cinco-departamentos',
    N'Encuentro de bandas reúne agrupaciones de cinco departamentos',
    N'Durante tres días, bandas sinfónicas y de vientos compartieron repertorio, talleres y conciertos en plaza pública.',
    N'El encuentro combinó conciertos al aire libre con talleres de dirección y de mantenimiento de instrumentos.' + NCHAR(10) + NCHAR(10)
    + N'Las agrupaciones invitadas presentaron repertorio tradicional y obras de compositores de sus regiones.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración: no describe un evento real.',
    N'Eventos y circulación', N'publicado', -6),
(3, N'demo-diplomado-en-pedagogia-musical-para-docentes-rurales',
    N'Diplomado en pedagogía musical para docentes rurales',
    N'Ciento veinte docentes inician un diplomado virtual con encuentros presenciales en cuatro subregiones.',
    N'El diplomado aborda la enseñanza colectiva, la creación con músicas tradicionales y el trabajo con grupos de edades mixtas.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Formación', N'publicado', -9),
(4, N'demo-nuevo-tablero-del-sistema-de-informacion-de-la-musica',
    N'Nuevo tablero del Sistema de Información de la Música',
    N'El mapa ecosistémico permite consultar festivales, mercados y agenda por departamento, municipio y territorio sonoro.',
    N'El tablero reúne en una sola vista la información registrada por las organizaciones y validada por el equipo del Programa.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Institucional', N'publicado', -12),
(5, N'demo-archivo-sonoro-recupera-grabaciones-de-cantadoras',
    N'Archivo sonoro recupera grabaciones de cantadoras del Pacífico',
    N'Un proceso comunitario digitalizó cintas de los años ochenta con cantos de arrullo y alabaos.',
    N'Las grabaciones fueron identificadas junto con las familias de las intérpretes y se conservarán en un archivo comunitario.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración: no describe un archivo real.',
    N'Memoria y patrimonio', N'publicado', -15),
(6, N'demo-red-de-musicas-del-caribe-fortalece-su-agenda-regional',
    N'Red de músicas del Caribe fortalece su agenda regional',
    N'Organizaciones de la región acordaron un calendario conjunto para evitar cruces entre festivales.',
    N'La red publicará un calendario compartido y coordinará la circulación de agrupaciones entre municipios vecinos.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Procesos territoriales', N'publicado', -19),
(7, N'demo-reconocimiento-a-maestros-luthiers',
    N'Reconocimiento a maestros luthiers por su trayectoria',
    N'Tres maestros constructores de instrumentos tradicionales recibieron un reconocimiento a su labor de transmisión.',
    N'Los maestros han formado aprendices durante más de tres décadas y conservan técnicas de construcción propias de su territorio.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Reconocimientos', N'publicado', -24),
(8, N'demo-becas-de-creacion-para-musicas-tradicionales',
    N'Becas de creación para músicas tradicionales',
    N'Compositores y compositoras podrán presentar obras nuevas basadas en formatos tradicionales.',
    N'Las becas apoyan la creación y el registro de obras inéditas, con acompañamiento de tutores de cada región.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración: no corresponde a una beca real.',
    N'Convocatorias y oportunidades', N'publicado', -30),
(9, N'demo-gira-de-coros-infantiles-por-municipios-pdet',
    N'Gira de coros infantiles por municipios PDET',
    N'Coros infantiles de seis municipios se presentarán en escuelas y casas de cultura durante el mes.',
    N'La gira incluye conciertos didácticos y encuentros entre coros para compartir repertorio.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Eventos y circulación', N'publicado', -36),
(10, N'demo-taller-de-gestion-para-festivales-musicales',
    N'Taller de gestión para organizadores de festivales',
    N'El taller abordó planeación, públicos, sostenibilidad y registro de información en SIMUS.',
    N'Los participantes trabajaron con casos de sus propios festivales y revisaron cómo registrar ediciones y programación.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Formación', N'publicado', -45),
(11, N'demo-mesa-departamental-de-musica-sesiona-en-pasto',
    N'Mesa departamental de música sesiona con agentes del sector',
    N'La mesa revisó prioridades de formación, circulación e infraestructura para el próximo año.',
    N'Participaron escuelas, agrupaciones, festivales y gestores culturales de distintos municipios.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Procesos territoriales', N'publicado', -52),
(12, N'demo-programada-lanzamiento-del-catalogo-de-festivales',
    N'Lanzamiento del catálogo nacional de festivales',
    N'El catálogo reunirá la información de los festivales registrados y validados en SIMUS.',
    N'Noticia programada: aparecerá en el sitio público en su fecha de publicación.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Institucional', N'publicado', 5),
(13, N'demo-programada-cierre-de-inscripciones-de-mercados',
    N'Cierre de inscripciones para mercados musicales',
    N'Las organizaciones tienen plazo hasta la fecha indicada para registrar sus mercados.',
    N'Noticia programada: aparecerá en el sitio público en su fecha de publicación.' + NCHAR(10) + NCHAR(10)
    + N'Texto de demostración.',
    N'Convocatorias y oportunidades', N'publicado', 12),
(14, N'demo-borrador-balance-de-la-temporada-de-festivales',
    N'Balance de la temporada de festivales',
    N'Borrador en preparación con las cifras de la temporada.',
    N'Texto de demostración en estado borrador.',
    N'Institucional', N'borrador', NULL),
(15, N'demo-en-revision-escuelas-de-musica-en-cifras',
    N'Escuelas de música en cifras',
    N'Nota en revisión editorial con datos de cobertura de escuelas de música.',
    N'Texto de demostración en revisión.',
    N'Memoria y patrimonio', N'en_revision', -1);

DECLARE @Sembradas TABLE (Id bigint PRIMARY KEY, Orden int NOT NULL);

INSERT INTO dbo.Noticias (Slug, Titulo, Resumen, Cuerpo, FechaPublicacion, AutoriaNombre, Estado, Version,
                          FechaCreacion, FechaActualizacion, CategoriaId)
SELECT p.Slug, p.Titulo, p.Resumen, p.Cuerpo,
       CASE WHEN p.Dias IS NULL THEN NULL ELSE DATEADD(DAY, p.Dias, @Hoy) END,
       N'Equipo SIMUS (demostración)', p.Estado, 1, SYSUTCDATETIME(), SYSUTCDATETIME(), c.IdCategoria
FROM @Plan p
LEFT JOIN dbo.Categorias c ON c.CodigoModulo = N'noticias' AND c.NombreCategoria = p.Categoria;

-- El Slug es único: con él se recupera qué identificador recibió cada fila del plan.
INSERT INTO @Sembradas (Id, Orden)
SELECT n.IdNoticia, p.Orden FROM dbo.Noticias n JOIN @Plan p ON p.Slug = n.Slug;

INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, UsuarioCreadorId, FechaRegistro)
SELECT N'noticias', CAST(Id AS nvarchar(40)), N'siembra', @UsuarioSiembra, SYSUTCDATETIME() FROM @Sembradas;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 3. CLASIFICACION CON HUECOS
--
-- Una de cada tres sin territorio sonoro, para que «sin clasificar» exista. El reparto sale del
-- catálogo vigente por posición, no de nombres escritos aquí.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
DECLARE @TotalTerritorios int = (SELECT COUNT(*) FROM dbo.TerritoriosSonoros);
DECLARE @TotalPracticas int = (SELECT COUNT(*) FROM dbo.PracticasMusicales);

IF @TotalTerritorios > 0
    INSERT INTO dbo.NoticiasTerritoriosSonoros (NoticiaId, TerritorioSonoroId)
    SELECT s.Id, t.IdTerritorioSonoro
    FROM @Sembradas s
    JOIN (SELECT IdTerritorioSonoro, ROW_NUMBER() OVER (ORDER BY OrdenVisualizacion, IdTerritorioSonoro) AS Indice
          FROM dbo.TerritoriosSonoros) t
      ON t.Indice = ((s.Orden * 5) % @TotalTerritorios) + 1
    WHERE s.Orden % 3 <> 0;

IF @TotalPracticas > 0
    INSERT INTO dbo.NoticiasPracticasMusicales (NoticiaId, PracticaMusicalId)
    SELECT s.Id, p.IdPracticaMusical
    FROM @Sembradas s
    JOIN (SELECT IdPracticaMusical, ROW_NUMBER() OVER (ORDER BY OrdenVisualizacion, IdPracticaMusical) AS Indice
          FROM dbo.PracticasMusicales) p
      ON p.Indice = ((s.Orden * 3) % @TotalPracticas) + 1
    WHERE s.Orden % 2 = 0;

INSERT INTO dbo.EtiquetasNoticia (NoticiaId, Termino)
SELECT s.Id, e.Termino
FROM @Sembradas s
CROSS APPLY (VALUES (N'demostración'), (CASE WHEN s.Orden % 2 = 0 THEN N'territorio' ELSE N'sector musical' END)) e(Termino);

COMMIT TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 4. RESUMEN
-- ─────────────────────────────────────────────────────────────────────────────────────────────
SELECT N'Noticias sembradas' AS Concepto, COUNT(*) AS Cifra FROM @Sembradas
UNION ALL SELECT N'  visibles hoy en el sitio', COUNT(*) FROM dbo.Noticias n JOIN @Sembradas s ON s.Id = n.IdNoticia
    WHERE n.Estado = N'publicado' AND n.FechaPublicacion <= @Hoy
UNION ALL SELECT N'  programadas', COUNT(*) FROM dbo.Noticias n JOIN @Sembradas s ON s.Id = n.IdNoticia
    WHERE n.Estado = N'publicado' AND n.FechaPublicacion > @Hoy
UNION ALL SELECT N'  borrador o en revisión', COUNT(*) FROM dbo.Noticias n JOIN @Sembradas s ON s.Id = n.IdNoticia
    WHERE n.Estado IN (N'borrador', N'en_revision')
UNION ALL SELECT N'  sin categoría', COUNT(*) FROM dbo.Noticias n JOIN @Sembradas s ON s.Id = n.IdNoticia
    WHERE n.CategoriaId IS NULL;
