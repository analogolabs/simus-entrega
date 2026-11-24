/*
    SIMUS · Siembra del micrositio «Celebra la música»: ediciones 2025 y 2026 (L7).

    QUÉ SIEMBRA
      1. Las dos ediciones con su presentación, categorías, caja de herramientas, preguntas frecuentes y galería.
         El texto y las piezas gráficas salen del sitio oficial del Ministerio de Cultura (https://celebralamusica.mincultura.gov.co/Paginas/index.aspx),
         cotejados el 20 de noviembre de 2026, con su crédito en la columna Fuente y en cada imagen (Archivos.Credito). Las imágenes se
         optimizan a WebP sin metadatos y viajan en `celebra-imagenes/` (las carga `sembrar-demo.sh celebra` al Banco de archivos). La caja
         de herramientas 2026 enlaza a cada archivo oficial (PDF de 180 MB, editables, videos): no se duplican. La edición 2025 no tiene
         página propia en el sitio: se reconstruye de sus noticias y sigue marcada «PENDIENTE DE VALIDAR por el PNMC».
      2. Eventos de agenda y noticias GENERALES de demostración, etiquetados con el proyecto transversal de su edición y con
         el paraguas `celebra-la-musica`. El micrositio NO guarda noticias ni agenda propias: filtra las generales.

    IDEMPOTENTE. Retira lo suyo (eventos y noticias con slug `celebra-demo-`, las dos ediciones y sus hijas) y vuelve a sembrar.
    TODO ES FICTICIO salvo la referencia editorial citada. No se ejecuta en producción: `migrar` no aplica `simus-database/seed/`.
    Requiere `schema/V20261120_20` y la siembra `completa` (necesita sus imágenes y las cuentas de demostración).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Gestor int = (SELECT IdUsuario FROM dbo.Usuarios WHERE CorreoElectronico = N'gestor@simus.test');
DECLARE @Institucional int = (SELECT TOP 1 IdEntidad FROM dbo.Entidades WHERE EsInstitucional = 1 ORDER BY IdEntidad);
DECLARE @Paraguas int = (SELECT IdProyectoTransversal FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica');
DECLARE @P25 int = (SELECT IdProyectoTransversal FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica-2025');
DECLARE @P26 int = (SELECT IdProyectoTransversal FROM dbo.ProyectosTransversales WHERE Codigo = N'celebra-la-musica-2026');
IF @Gestor IS NULL OR @Institucional IS NULL OR @Paraguas IS NULL OR @P25 IS NULL OR @P26 IS NULL
   OR OBJECT_ID(N'dbo.CelebraEdiciones', N'U') IS NULL
   OR (SELECT COUNT(*) FROM dbo.Archivos WHERE NombreOriginal LIKE N'demo-completa-%') < 10
   OR (SELECT COUNT(*) FROM dbo.Archivos WHERE NombreOriginal LIKE N'celebra-oficial-%') < 13
BEGIN
    PRINT N'[celebra] Faltan la migración V20261120_20, las cuentas de demostración o las imágenes (siembra completa y celebra-imagenes): no se siembra.';
    RETURN;
END

-- ── Retiro de lo propio ────────────────────────────────────────────────────────────────────
DECLARE @Ev TABLE (Id bigint PRIMARY KEY);
INSERT INTO @Ev SELECT IdEventoAgenda FROM dbo.EventosAgenda WHERE Slug LIKE N'celebra-demo-%';
DECLARE @No TABLE (Id bigint PRIMARY KEY);
INSERT INTO @No SELECT IdNoticia FROM dbo.Noticias WHERE Slug LIKE N'celebra-demo-%';

DELETE FROM dbo.EventosAgendaProyectosTransversales WHERE EventoAgendaId IN (SELECT Id FROM @Ev);
DELETE FROM dbo.EventosAgendaArchivos WHERE EventoAgendaId IN (SELECT Id FROM @Ev);
DELETE FROM dbo.EtiquetasEventoAgenda WHERE EventoAgendaId IN (SELECT Id FROM @Ev);
DELETE FROM dbo.ProcedenciasDeRegistro WHERE ModuloId = N'agenda' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @Ev);
DELETE FROM dbo.EventosAgenda WHERE IdEventoAgenda IN (SELECT Id FROM @Ev);
DELETE FROM dbo.NoticiasProyectosTransversales WHERE NoticiaId IN (SELECT Id FROM @No);
DELETE FROM dbo.NoticiasArchivos WHERE NoticiaId IN (SELECT Id FROM @No);
DELETE FROM dbo.EtiquetasNoticia WHERE NoticiaId IN (SELECT Id FROM @No);
DELETE FROM dbo.ProcedenciasDeRegistro WHERE ModuloId = N'noticias' AND RegistroId IN (SELECT CAST(Id AS nvarchar(120)) FROM @No);
DELETE FROM dbo.Noticias WHERE IdNoticia IN (SELECT Id FROM @No);

DELETE FROM dbo.CelebraGaleria;
DELETE FROM dbo.CelebraRecursos;
DELETE FROM dbo.CelebraPreguntas;
DELETE FROM dbo.CelebraCategorias;
DELETE FROM dbo.CelebraEdiciones WHERE Anio IN (2025, 2026);

-- ── Ediciones ──────────────────────────────────────────────────────────────────────────────
DECLARE @Fuente26 nvarchar(300) = N'Fuente: Ministerio de Cultura de Colombia, Celebra la música 2026, https://celebralamusica.mincultura.gov.co/Paginas/index.aspx (consultado el 20 de noviembre de 2026).';
DECLARE @Fuente25 nvarchar(300) = N'Fuente: noticias de Celebra la música 2025 del Ministerio de Cultura de Colombia, https://celebralamusica.mincultura.gov.co/Paginas/noticias/index.aspx (consultado el 20 de noviembre de 2026). PENDIENTE DE VALIDAR por el PNMC: el sitio no tiene página propia de la edición.';
DECLARE @Portada25 int = (SELECT TOP 1 IdArchivo FROM dbo.Archivos WHERE NombreOriginal = N'celebra-oficial-2025-galeria-1.webp');
DECLARE @Portada26 int = (SELECT TOP 1 IdArchivo FROM dbo.Archivos WHERE NombreOriginal = N'celebra-oficial-2026-ilustracion-principal.webp');

/* LA PALETA SE MIDIÓ EN LAS PIEZAS Y EN LA HOJA DE ESTILOS DEL SITIO OFICIAL (20 nov 2026).
   2026: fucsia #D8175A (variable --color-fucsia del sitio; las ondas de la campaña son #FF004F y el título degrada de #FC085B a #FFB62E) y azul
   profundo #09153C (--color-azul-intenso; los parlantes de la ilustración son #0D1B48). 2025: violeta #4C007E y amarillo #FEF43D del ícono
   «Celebra la música 2025» (icono-clm2025-amarillo.png). */
/* EL HASHTAG QUEDA VACÍO: el sitio oficial no publica ninguno (revisado en la portada, las noticias y la caja de herramientas). */
INSERT INTO dbo.CelebraEdiciones (Anio, Nombre, Hashtag, ProyectoTransversalId, FechaInicio, FechaFin, Resumen, Presentacion, Aliados,
    Actividades, Municipios, Departamentos, Organizaciones, Musicos, ColorPrincipal, ColorSecundario, ImagenPortadaArchivoId, Actual, Publicada, Fuente, PendienteDeValidar)
VALUES
 (2025, N'Celebra la Música 2025', NULL, @P25, '2025-11-01', '2025-11-30',
  N'Durante todo noviembre de 2025, escuelas, festivales, mercados y comunidades de todo el país celebraron la música colombiana.',
  N'Celebra la Música es una estrategia anual del Ministerio de Cultura, desarrollada por su grupo de música desde 2011. '
  + N'En 2025 se vivió durante todo noviembre, en el marco del Día del Músico, desde el Plan Nacional de Música para la Convivencia.' + NCHAR(10) + NCHAR(10)
  + N'La edición convocó a escuelas de música, festivales, mercados, artistas y comunidades de todas las regiones. Hubo presentaciones en escuelas, conciertos, '
  + N'circuitos de música en vivo, alianzas con mercados musicales y encuentros académicos, con el propósito de fortalecer la gobernanza musical y ampliar la participación ciudadana.',
  N'Fundación Nacional Batuta, Asociación Nacional de las Artes y Fundación Poliedro',
  NULL, NULL, 12, 174, 1300, '#4C007E', '#FEF43D', @Portada25, 0, 1, @Fuente25, 1),
 (2026, N'Celebra la Música 2026', NULL, @P26, '2026-11-01', '2026-11-30',
  N'Más de 190 actividades en 76 municipios de 28 departamentos para conmemorar el Día del Músico durante todo noviembre.',
  N'Cada año, en noviembre, llega Celebra la Música, la estrategia del Ministerio de Cultura que conmemora el Día del Músico (22 de noviembre). '
  + N'Es una invitación al encuentro entre artistas, comunidades e instituciones para aprender, crear y compartir sonidos en toda Colombia. '
  + N'Esta conmemoración recuerda que hacer música es un derecho que merece reconocimiento y protección por parte del Estado.' + NCHAR(10) + NCHAR(10)
  + N'Este año, Celebra la Música tendrá una agenda de actividades que honran la posibilidad de cantar y tocar un instrumento en el país, de la mano de Batuta, '
  + N'la Asociación Nacional de las Artes, la Fundación Poliedro y 15 organizaciones aliadas.',
  N'Fundación Nacional Batuta, Asociación Nacional de las Artes, Fundación Poliedro y 15 organizaciones aliadas',
  190, 76, 28, 15, NULL, '#D8175A', '#09153C', @Portada26, 1, 1, @Fuente26, 0);

DECLARE @E25 int = (SELECT IdCelebraEdicion FROM dbo.CelebraEdiciones WHERE Anio = 2025);
DECLARE @E26 int = (SELECT IdCelebraEdicion FROM dbo.CelebraEdiciones WHERE Anio = 2026);

INSERT INTO dbo.CelebraCategorias (CelebraEdicionId, Nombre, Descripcion, Orden) VALUES
 (@E25, N'Músicas para la vida', N'Visibiliza procesos formativos y comunitarios: escuelas de música, encuentros y muestras.', 1),
 (@E25, N'Cultura festiva', N'Reconoce festivales y territorios sonoros como espacios de memoria, encuentro y convivencia.', 2),
 (@E25, N'Circuitos sonoros', N'Destaca los mercados musicales como motores de economías populares y de la música en vivo.', 3),
 (@E26, N'Músicas de nuestra patria', N'Procesos de formación y escuelas comunitarias, municipales y Centros Batuta.', 1),
 (@E26, N'Cultura festiva', N'Festivales y celebraciones constructoras de memoria, encuentro y circulación.', 2),
 (@E26, N'Circuitos sonoros', N'Mercados musicales y culturales, festivales y espacios de música en vivo como nodos de economía, encuentro y circulación.', 3);

INSERT INTO dbo.CelebraRecursos (CelebraEdicionId, Grupo, Titulo, Descripcion, Url, Orden) VALUES
 (@E26, N'Guía visual', N'branding-clm-2026.pdf', N'PDF, 180 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/1.%20Gu%C3%ADa%20visual%20Celebra%20la%20M%C3%BAsica%202026/branding-clm-2026.pdf', 1),
 (@E26, N'Recursos gráficos', N'DJ.png', N'PNG, 1,0 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/DJ.png', 1),
 (@E26, N'Recursos gráficos', N'elemento_1.png', N'PNG, 135 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/elemento_1.png', 2),
 (@E26, N'Recursos gráficos', N'FLOR.png', N'PNG, 142 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/FLOR.png', 3),
 (@E26, N'Recursos gráficos', N'Ilustrracion_parlante.png', N'PNG, 14 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Ilustrracion_parlante.png', 4),
 (@E26, N'Recursos gráficos', N'Ilustrracion_Principal.psb', N'PSB, 49 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Ilustrracion_Principal.psb', 5),
 (@E26, N'Recursos gráficos', N'mockup_cartel.psd', N'PSD, 69 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/mockup_cartel.psd', 6),
 (@E26, N'Recursos gráficos', N'Obj_1.png', N'PNG, 32 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Obj_1.png', 7),
 (@E26, N'Recursos gráficos', N'Obj_2.png', N'PNG, 535 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Obj_2.png', 8),
 (@E26, N'Recursos gráficos', N'Obj_3.png', N'PNG, 432 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Obj_3.png', 9),
 (@E26, N'Recursos gráficos', N'parlante11.png', N'PNG, 310 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/parlante11.png', 10),
 (@E26, N'Recursos gráficos', N'parlante2.png', N'PNG, 774 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/parlante2.png', 11),
 (@E26, N'Recursos gráficos', N'parlante3.png', N'PNG, 775 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/parlante3.png', 12),
 (@E26, N'Recursos gráficos', N'parlante4.png', N'PNG, 1,5 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/parlante4.png', 13),
 (@E26, N'Recursos gráficos', N'punk_bike.png', N'PNG, 3 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/punk_bike.png', 14),
 (@E26, N'Recursos gráficos', N'Titulo.png', N'PNG, 4 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Titulo.png', 15),
 (@E26, N'Recursos gráficos', N'Titulo.psb', N'PSB, 14 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Titulo.psb', 16),
 (@E26, N'Recursos gráficos', N'trompeta.png', N'PNG, 1,3 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/trompeta.png', 17),
 (@E26, N'Logo del Ministerio', N'LOGO_V1_BLANCO.png', N'PNG, 18 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_BLANCO.png', 1),
 (@E26, N'Logo del Ministerio', N'LOGO_V1_COLOR.png', N'PNG, 20 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_COLOR.png', 2),
 (@E26, N'Logo del Ministerio', N'LOGO_V1_GRIS.png', N'PNG, 20 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_GRIS.png', 3),
 (@E26, N'Logo del Ministerio', N'LOGO_V1_MONOTINTA BLANCO.png', N'PNG, 18 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_MONOTINTA%20BLANCO.png', 4),
 (@E26, N'Logo del Ministerio', N'LOGO_V1_MONOTINTA NEGRO.png', N'PNG, 19 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_MONOTINTA%20NEGRO.png', 5),
 (@E26, N'Tipografías', N'LanceRg.ttf', N'TTF, 56 KB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/4.%20Tipograf%C3%ADas/LanceRg.ttf', 1),
 (@E26, N'Cortinillas de video', N'Culturas_Full_NUEVO.mp4', N'MP4, 7 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/5.%20Cortinillas%20de%20video/Culturas_Full_NUEVO.mp4', 1),
 (@E26, N'Cortinillas de video', N'Culturas_Reel_NUEVO.mp4', N'MP4, 7 MB. Archivo oficial de la caja de herramientas.', N'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/5.%20Cortinillas%20de%20video/Culturas_Reel_NUEVO.mp4', 2),
 (@E25, N'Noticias de la edición', N'Anuncio de Celebra la Música 2025', N'Comunicado de lanzamiento de la edición, del 17 de octubre de 2025.', N'https://celebralamusica.mincultura.gov.co/Paginas/noticias/noticia1.aspx', 1),
 (@E25, N'Noticias de la edición', N'Más de 1.300 músicos y 174 organizaciones se unen a la celebración', N'Cifras de la edición 2025.', N'https://celebralamusica.mincultura.gov.co/Paginas/noticias/noticia6.aspx', 2);

INSERT INTO dbo.CelebraPreguntas (CelebraEdicionId, Pregunta, Respuesta, Orden) VALUES
 (@E26, N'¿Qué es Celebra la Música 2026?', N'Es una estrategia nacional liderada por el Ministerio de Cultura que promueve el encuentro, la creación y la circulación de las músicas de Colombia en su diversidad de expresiones, géneros y prácticas culturales. Durante noviembre, artistas, agrupaciones, comunidades, organizaciones e instituciones de diferentes regiones se unen para compartir la riqueza musical de sus territorios y fortalecer las redes del sector musical.', 1),
 (@E26, N'¿Quién organiza la celebración?', N'La organiza el Ministerio de Cultura en articulación con escuelas de formación, festivales, mercados culturales, entidades territoriales y comunidades artísticas en todo el país.', 2),
 (@E26, N'¿Es una celebración diferente cada año?', N'Sí. Desde su creación en 2011, Celebra la Música ha evolucionado cada año. Desde la versión anterior dejó de ser una jornada conmemorativa para convertirse en un proceso estructural y territorial que articula formación, creación, circulación y memoria musical.', 3),
 (@E26, N'¿Se necesita comprar boletas o pagar entrada?', N'No. Todas las actividades son gratuitas y abiertas al público, salvo algunos eventos especiales organizados por aliados locales. La información estará en la programación.', 4),
 (@E26, N'¿Quiénes pueden asistir a los conciertos y actividades?', N'Todas las personas. Celebra la Música promueve la participación de familias, comunidades y públicos diversos, garantizando la inclusión de niños, jóvenes, adultos mayores y personas con capacidades especiales.', 5),
 (@E26, N'¿Cómo consulto la programación en mi ciudad o municipio?', N'La programación está en el sitio oficial de Celebra la Música, donde se puede filtrar por día y departamento, y en la agenda del PNMC de este portal.', 6),
 (@E26, N'¿La programación es igual en todo el país?', N'No. Cada territorio diseña su propia agenda con base en sus procesos locales, artistas y espacios culturales, y por eso la programación refleja la identidad musical de cada región.', 7),
 (@E26, N'¿Puedo llevar a mi familia y niños?', N'Sí. Es un evento para todos los públicos. La mayoría de las actividades son familiares y se desarrollan en espacios culturales, parques y escenarios públicos.', 8),
 (@E26, N'¿Qué pasa si un evento se cancela o cambia de lugar?', N'Los cambios se anunciarán a través de los canales oficiales del Ministerio de Cultura.', 9),
 (@E26, N'¿Dónde se realizan las actividades en mi municipio?', N'En escenarios culturales, parques, teatros, casas de la cultura, escuelas de música y otros espacios comunitarios.', 10),
 (@E25, N'¿Qué fue Celebra la Música 2025?', N'Fue la edición de noviembre de 2025, en el marco del Día del Músico, con presentaciones en escuelas de música, circuitos de música en vivo, alianzas con mercados musicales y encuentros académicos.', 1),
 (@E25, N'¿Quiénes participaron?', N'Más de 1.300 músicos y 174 organizaciones de 12 departamentos, junto con la Fundación Nacional Batuta, la Asociación Nacional de las Artes y la Fundación Poliedro.', 2);

-- LA GALERÍA USA LAS PIEZAS OFICIALES (`celebra-imagenes/`); el crédito y el texto alternativo viajan con cada archivo del Banco.
DECLARE @Gal TABLE (Ed int, Nombre nvarchar(120), Orden int);
INSERT INTO @Gal VALUES
 (@E25, N'celebra-oficial-2025-galeria-1.webp', 1), (@E25, N'celebra-oficial-2025-galeria-2.webp', 2), (@E25, N'celebra-oficial-2025-galeria-3.webp', 3),
 (@E25, N'celebra-oficial-2025-galeria-4.webp', 4), (@E25, N'celebra-oficial-2025-galeria-5.webp', 5), (@E25, N'celebra-oficial-2025-galeria-6.webp', 6),
 (@E26, N'celebra-oficial-2026-titulo.webp', 1), (@E26, N'celebra-oficial-2026-afiche.webp', 2), (@E26, N'celebra-oficial-2026-foto-baterista.webp', 3),
 (@E26, N'celebra-oficial-2026-foto-festiva.webp', 4), (@E26, N'celebra-oficial-2026-foto-vida.webp', 5), (@E26, N'celebra-oficial-2026-foto-circuitos.webp', 6);
INSERT INTO dbo.CelebraGaleria (CelebraEdicionId, ArchivoId, TextoAlternativo, Credito, Orden)
SELECT g.Ed, a.IdArchivo, a.TextoAlternativo, a.Credito, g.Orden
FROM @Gal g JOIN dbo.Archivos a ON a.NombreOriginal = g.Nombre;

-- ── Eventos y noticias GENERALES, etiquetados con su edición ──────────────────────────────────
DECLARE @Ahora datetime2 = SYSUTCDATETIME();
DECLARE @CatConc int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'conciertos-y-presentaciones');
DECLARE @CatForm int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'formacion');
DECLARE @CatEnc int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'encuentros-y-dialogos');
DECLARE @CatFest int = (SELECT IdCategoria FROM dbo.Categorias WHERE CodigoModulo = N'agenda' AND Slug = N'festivales');

DECLARE @Ev2 TABLE (Clave nvarchar(40) PRIMARY KEY, Edicion int, Titulo nvarchar(300), Descr nvarchar(1000), Larga nvarchar(max), Inicio date, Fin date,
    Hi time, Hf time, Lugar nvarchar(300), Dep char(2), Mun char(5), Img nvarchar(60), Cat int, Id bigint NULL);
INSERT INTO @Ev2 (Clave, Edicion, Titulo, Descr, Larga, Inicio, Fin, Hi, Hf, Lugar, Dep, Mun, Img, Cat) VALUES
 (N'2025-showcases-cali', 2025, N'Showcases de música en vivo en Cali', N'Dos jornadas de presentaciones de agrupaciones de la región, con entrada libre.',
  N'Dos días de showcases con agrupaciones del suroccidente, en un teatro al aire libre y una sala de música en vivo. Entrada libre hasta completar el aforo.', '2025-11-15', '2025-11-16', '16:00', '22:00',
  N'Teatro al Aire Libre Los Cristales, Cali', '76', '76001', N'evento-concierto-cierre', @CatConc),
 (N'2025-escuelas-tolima', 2025, N'Encuentro de escuelas de artes del sur del Tolima', N'Niñas, niños y jóvenes de escuelas de varios municipios se encuentran para compartir su trabajo.',
  N'Jornada de muestras y talleres para las escuelas de artes de la subregión, orientada a la articulación regional y a la construcción de paz.', '2025-11-20', '2025-11-20', '09:00', '16:00',
  N'Casa de la Cultura de Ataco', '73', '73067', N'evento-taller-marimba', @CatForm),
 (N'2025-muestra-batuta', 2025, N'Muestras de los centros de formación musical infantil', N'Presentaciones de coros y orquestas infantiles en cuatro municipios.',
  N'Los centros de formación musical celebran con muestras abiertas al público de coros, orquestas y ensambles de iniciación.', '2025-11-22', '2025-11-22', '10:00', '13:00',
  N'Teatro Municipal de Paipa', '15', '15516', N'evento-concierto-cierre', @CatConc),
 (N'2025-mercados', 2025, N'Encuentro nacional de mercados musicales', N'Tres días de ruedas de negocios, charlas y música en vivo de los mercados del país.',
  N'Los mercados musicales del país se reúnen para fortalecer su articulación y el trabajo en red: ruedas de negocios, conversatorios y presentaciones.', '2025-11-27', '2025-11-29', '09:00', '18:00',
  N'Plaza de los Artistas, Medellín', '05', '05001', N'evento-rueda-negocios', @CatEnc),
 (N'2025-conversatorio-gobernanza', 2025, N'Conversatorio sobre gobernanza musical', N'Un diálogo abierto sobre participación ciudadana y política pública de música.',
  N'Conversatorio con representantes de consejos y organizaciones sobre cómo ampliar la participación ciudadana en las decisiones del sector.', '2025-11-18', '2025-11-18', '15:00', '17:30',
  N'Biblioteca departamental, Pasto', '52', '52001', N'evento-conversatorio', @CatEnc),
 (N'2026-dia-del-musico', 2026, N'Concierto por el Día del Músico', N'Concierto con agrupaciones de varias regiones para celebrar el 22 de noviembre.',
  N'Gran concierto con agrupaciones de varias regiones, en el marco del Día del Músico. Entrada libre.', '2026-11-22', '2026-11-22', '17:00', '21:00',
  N'Parque de la Leyenda Vallenata, Valledupar', '20', '20001', N'evento-concierto-cierre', @CatConc),
 (N'2026-centenario-escalona', 2026, N'Homenaje por el centenario de Rafael Escalona', N'Acto de reconocimiento al maestro con música, memoria y conversatorio.',
  N'Reconocimiento por el centenario del natalicio del maestro Rafael Escalona, con presentaciones de acordeoneros y compositores de la región y un conversatorio sobre su legado.', '2026-11-26', '2026-11-26', '18:00', '21:00',
  N'Casa de la Cultura de Patillal', '20', '20621', N'evento-conversatorio', @CatEnc),
 (N'2026-laboratorio', 2026, N'Laboratorio de producción y gestión musical', N'Espacio académico de dos días para músicos y gestores.',
  N'Laboratorio práctico sobre producción, circulación y sostenibilidad de proyectos musicales, con cupos limitados.', '2026-11-24', '2026-11-25', '09:00', '16:00',
  N'Biblioteca pública Piloto, Medellín', '05', '05001', N'evento-taller-marimba', @CatForm),
 (N'2026-mercado', 2026, N'Rueda de negocios del mercado musical del Pacífico', N'Encuentro de agrupaciones, programadores y festivales.',
  N'Rueda de negocios con agendamiento de citas entre agrupaciones, programadores y festivales del Pacífico.', '2026-11-27', '2026-11-28', '09:00', '17:00',
  N'Centro de Convenciones, Buenaventura', '76', '76109', N'evento-rueda-negocios', @CatEnc),
 (N'2026-festival-cierre', 2026, N'Gran cierre de Celebra la Música 2026', N'Festival de cierre con bandas, coros y orquestas de todo el país.',
  N'Cierre de la edición con presentaciones de bandas, coros y orquestas de escuelas de música, y balance de la celebración.', '2026-11-30', '2026-11-30', '16:00', '21:00',
  N'Plaza Mayor, Bogotá', '11', '11001', N'evento-concierto-cierre', @CatFest);

INSERT INTO dbo.EventosAgenda (Slug, Titulo, Descripcion, FechaInicio, FechaFin, HoraInicio, Modalidad, Lugar, CodigoDepartamento, CodigoMunicipio, Url,
    ImagenRuta, ImagenAlternativa, Estado, Version, FechaCreacion, FechaActualizacion, Organizador, DescripcionLarga, HoraFin, OrdenVisualizacion, NivelCobertura, CategoriaId)
SELECT CONCAT(N'celebra-demo-', e.Clave), e.Titulo, e.Descr, e.Inicio, e.Fin, e.Hi, N'presencial', e.Lugar, e.Dep, e.Mun, NULL,
       CONCAT(N'/api/v1/publico/archivos/', a.IdArchivo), a.TextoAlternativo, N'publicado', 1, DATEADD(DAY, -40, @Ahora), DATEADD(DAY, -39, @Ahora),
       N'PNMC · Celebra la Música', e.Larga, e.Hf, ROW_NUMBER() OVER (ORDER BY e.Inicio), N'municipal', e.Cat
FROM @Ev2 e JOIN dbo.Archivos a ON a.NombreOriginal = CONCAT(N'demo-completa-', e.Img, N'.jpg');

UPDATE e SET Id = x.IdEventoAgenda FROM @Ev2 e JOIN dbo.EventosAgenda x ON x.Slug = CONCAT(N'celebra-demo-', e.Clave);
INSERT INTO dbo.EventosAgendaArchivos (EventoAgendaId, ArchivoId, RolArchivo, OrdenVisualizacion)
SELECT e.Id, a.IdArchivo, N'imagen_principal', 1 FROM @Ev2 e JOIN dbo.Archivos a ON a.NombreOriginal = CONCAT(N'demo-completa-', e.Img, N'.jpg');
INSERT INTO dbo.EtiquetasEventoAgenda (EventoAgendaId, Termino) SELECT Id, N'celebra la música' FROM @Ev2;
INSERT INTO dbo.EventosAgendaProyectosTransversales (EventoAgendaId, ProyectoTransversalId) SELECT Id, @Paraguas FROM @Ev2;
INSERT INTO dbo.EventosAgendaProyectosTransversales (EventoAgendaId, ProyectoTransversalId) SELECT Id, CASE Edicion WHEN 2025 THEN @P25 ELSE @P26 END FROM @Ev2;
INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'agenda', CAST(Id AS nvarchar(120)), N'administrativo', @Institucional, @Gestor, DATEADD(DAY, -40, @Ahora) FROM @Ev2;

DECLARE @No2 TABLE (Clave nvarchar(40) PRIMARY KEY, Edicion int, Titulo nvarchar(300), Resumen nvarchar(1000), Cuerpo nvarchar(max), Fecha date, Img nvarchar(60), Cat nvarchar(80), Id bigint NULL);
INSERT INTO @No2 (Clave, Edicion, Titulo, Resumen, Cuerpo, Fecha, Img, Cat) VALUES
 (N'2025-lanzamiento', 2025, N'Prepárate para honrar nuestra diversidad musical en noviembre', N'Muestras musicales, circuitos de música en vivo y encuentros académicos durante todo el mes.',
  N'Durante todo noviembre de 2025, escuelas de música, festivales, mercados y comunidades de todo el país celebran la música colombiana en el marco del Día del Músico. La programación se publica desde el 27 de octubre.', '2025-10-17', N'noticia-formacion', N'institucional'),
 (N'2025-cifras', 2025, N'Más de 1.300 músicos y 174 organizaciones se unen a la celebración', N'La edición 2025 reúne a participantes de 12 departamentos.',
  N'Más de 1.300 músicos y 174 organizaciones se sumaron a Celebra la Música 2025. Noviembre será el mes de la música en Colombia.', '2025-10-30', N'noticia-convocatoria', N'institucional'),
 (N'2025-cali', 2025, N'Cali celebra la diversidad sonora con dos jornadas de showcases', N'Música en vivo los días 15 y 16 de noviembre.',
  N'La ciudad vivió dos jornadas de presentaciones en vivo con agrupaciones de la región, con entrada libre hasta completar el aforo.', '2025-11-24', N'noticia-bandas', N'eventos-y-circulacion'),
 (N'2026-programacion', 2026, N'Celebra la Música 2026 tendrá más de 190 actividades gratuitas en todo el país', N'La agenda recorre 76 municipios de 28 departamentos para conmemorar el Día del Músico.',
  N'La edición 2026 reúne más de 190 actividades, la mayoría gratuitas, en 76 municipios de 28 departamentos, con más de 15 organizaciones musicales en los territorios. Algunos eventos especiales pueden tener costo.', '2026-10-30', N'noticia-formacion', N'institucional'),
 (N'2026-escalona', 2026, N'Un centenario para recordar a Rafael Escalona', N'La celebración incluye actos de reconocimiento al maestro en su región.',
  N'Con presentaciones y conversatorios, la edición 2026 reconoce el centenario del natalicio del maestro Rafael Escalona.', '2026-11-05', N'noticia-memoria', N'memoria-y-patrimonio'),
 (N'2026-mercados', 2026, N'Los mercados musicales se suman a Celebra la Música', N'Ruedas de negocios y circuitos de música en vivo durante noviembre.',
  N'Mercados musicales de varias regiones abren sus ruedas de negocios y presentaciones al público dentro de la celebración.', '2026-11-12', N'noticia-convocatoria', N'eventos-y-circulacion');

INSERT INTO dbo.Noticias (Slug, Titulo, Resumen, Cuerpo, FechaPublicacion, ImagenRuta, ImagenAlternativa, AutoriaNombre, Estado, Version, FechaCreacion, FechaActualizacion, CategoriaId)
SELECT CONCAT(N'celebra-demo-', n.Clave), n.Titulo, n.Resumen, n.Cuerpo, n.Fecha, CONCAT(N'/api/v1/publico/archivos/', a.IdArchivo), a.TextoAlternativo,
       N'Equipo de Comunicaciones del PNMC', N'publicado', 1, DATEADD(DAY, -30, @Ahora), DATEADD(DAY, -29, @Ahora), c.IdCategoria
FROM @No2 n JOIN dbo.Archivos a ON a.NombreOriginal = CONCAT(N'demo-completa-', n.Img, N'.jpg')
LEFT JOIN dbo.Categorias c ON c.CodigoModulo = N'noticias' AND c.Slug = n.Cat;
UPDATE n SET Id = x.IdNoticia FROM @No2 n JOIN dbo.Noticias x ON x.Slug = CONCAT(N'celebra-demo-', n.Clave);
INSERT INTO dbo.NoticiasArchivos (NoticiaId, ArchivoId, RolArchivo, OrdenVisualizacion)
SELECT n.Id, a.IdArchivo, N'imagen_principal', 1 FROM @No2 n JOIN dbo.Archivos a ON a.NombreOriginal = CONCAT(N'demo-completa-', n.Img, N'.jpg');
INSERT INTO dbo.EtiquetasNoticia (NoticiaId, Termino) SELECT Id, N'celebra la música' FROM @No2;
INSERT INTO dbo.NoticiasProyectosTransversales (NoticiaId, ProyectoTransversalId) SELECT Id, @Paraguas FROM @No2;
INSERT INTO dbo.NoticiasProyectosTransversales (NoticiaId, ProyectoTransversalId) SELECT Id, CASE Edicion WHEN 2025 THEN @P25 ELSE @P26 END FROM @No2;
INSERT INTO dbo.ProcedenciasDeRegistro (ModuloId, RegistroId, ContextoOrigen, OrganizacionProcedenciaId, UsuarioCreadorId, FechaRegistro)
SELECT N'noticias', CAST(Id AS nvarchar(120)), N'administrativo', @Institucional, @Gestor, DATEADD(DAY, -30, @Ahora) FROM @No2;

PRINT N'[celebra] Sembradas las ediciones 2025 y 2026, 10 eventos y 6 noticias etiquetados.';
