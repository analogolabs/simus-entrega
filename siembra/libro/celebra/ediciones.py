"""Datos de las dos ediciones publicadas de «Celebra la música» (2025 y 2026).

Los textos, las cifras, la paleta, las categorías, las preguntas y los enlaces de la caja de herramientas vienen del sitio oficial del Ministerio de
Cultura de Colombia (https://celebralamusica.mincultura.gov.co/) y son los mismos que ya usaba la siembra clásica del micrositio
(`simus-database/seed/V20261120_21__celebra_la_musica_siembra.sql`). Lo ficticio de esta siembra es lo que se añade: los logotipos de los aliados
(marcas ilustrativas generadas, NO los logotipos reales), las piezas descargables del Banco de archivos y los grupos de recursos que las agrupan.
Procedencia: híbrida (público verificable + sintético). Sin fechas de consulta en los textos que ve el público.

Imágenes: se piden por alias al pool multimedia (`img.pool.celebra.*` son las piezas oficiales del repo; `img.organizacion.<clave>.logo`, los logotipos
generados de los aliados). Cada edición termina con su portada, su galería (6 piezas) y sus aliados.
"""

RECURSOS_2025 = [
        ('Noticias de la edición', 'Anuncio de Celebra la Música 2025', 'Comunicado de lanzamiento de la edición, del 17 de octubre de 2025.', 'https://celebralamusica.mincultura.gov.co/Paginas/noticias/noticia1.aspx'),
        ('Noticias de la edición', 'Más de 1.300 músicos y 174 organizaciones se unen a la celebración', 'Cifras de la edición 2025.', 'https://celebralamusica.mincultura.gov.co/Paginas/noticias/noticia6.aspx'),
    ]
RECURSOS_2026 = [
        ('Guía visual', 'branding-clm-2026.pdf', 'PDF, 180 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/1.%20Gu%C3%ADa%20visual%20Celebra%20la%20M%C3%BAsica%202026/branding-clm-2026.pdf'),
        ('Recursos gráficos', 'DJ.png', 'PNG, 1,0 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/DJ.png'),
        ('Recursos gráficos', 'elemento_1.png', 'PNG, 135 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/elemento_1.png'),
        ('Recursos gráficos', 'FLOR.png', 'PNG, 142 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/FLOR.png'),
        ('Recursos gráficos', 'Ilustrracion_parlante.png', 'PNG, 14 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Ilustrracion_parlante.png'),
        ('Recursos gráficos', 'Ilustrracion_Principal.psb', 'PSB, 49 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Ilustrracion_Principal.psb'),
        ('Recursos gráficos', 'mockup_cartel.psd', 'PSD, 69 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/mockup_cartel.psd'),
        ('Recursos gráficos', 'Obj_1.png', 'PNG, 32 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Obj_1.png'),
        ('Recursos gráficos', 'Obj_2.png', 'PNG, 535 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Obj_2.png'),
        ('Recursos gráficos', 'Obj_3.png', 'PNG, 432 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Obj_3.png'),
        ('Recursos gráficos', 'parlante11.png', 'PNG, 310 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/parlante11.png'),
        ('Recursos gráficos', 'parlante2.png', 'PNG, 774 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/parlante2.png'),
        ('Recursos gráficos', 'parlante3.png', 'PNG, 775 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/parlante3.png'),
        ('Recursos gráficos', 'parlante4.png', 'PNG, 1,5 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/parlante4.png'),
        ('Recursos gráficos', 'punk_bike.png', 'PNG, 3 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/punk_bike.png'),
        ('Recursos gráficos', 'Titulo.png', 'PNG, 4 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Titulo.png'),
        ('Recursos gráficos', 'Titulo.psb', 'PSB, 14 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/Titulo.psb'),
        ('Recursos gráficos', 'trompeta.png', 'PNG, 1,3 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/2.%20Recursos%20gr%C3%A1ficos/trompeta.png'),
        ('Logo del Ministerio', 'LOGO_V1_BLANCO.png', 'PNG, 18 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_BLANCO.png'),
        ('Logo del Ministerio', 'LOGO_V1_COLOR.png', 'PNG, 20 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_COLOR.png'),
        ('Logo del Ministerio', 'LOGO_V1_GRIS.png', 'PNG, 20 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_GRIS.png'),
        ('Logo del Ministerio', 'LOGO_V1_MONOTINTA BLANCO.png', 'PNG, 18 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_MONOTINTA%20BLANCO.png'),
        ('Logo del Ministerio', 'LOGO_V1_MONOTINTA NEGRO.png', 'PNG, 19 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/3.%20Logo%20Cultura/LOGO_V1_MONOTINTA%20NEGRO.png'),
        ('Tipografías', 'LanceRg.ttf', 'TTF, 56 KB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/4.%20Tipograf%C3%ADas/LanceRg.ttf'),
        ('Cortinillas de video', 'Culturas_Full_NUEVO.mp4', 'MP4, 7 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/5.%20Cortinillas%20de%20video/Culturas_Full_NUEVO.mp4'),
        ('Cortinillas de video', 'Culturas_Reel_NUEVO.mp4', 'MP4, 7 MB. Archivo oficial de la caja de herramientas.', 'https://celebralamusica.mincultura.gov.co/Paginas/assets/caja-herramientas/2026/5.%20Cortinillas%20de%20video/Culturas_Reel_NUEVO.mp4'),
    ]
PREGUNTAS_2025 = [
        ('¿Qué fue Celebra la Música 2025?', 'Fue la edición de noviembre de 2025, en el marco del Día del Músico, con presentaciones en escuelas de música, circuitos de música en vivo, alianzas con mercados musicales y encuentros académicos.'),
        ('¿Quiénes participaron?', 'Más de 1.300 músicos y 174 organizaciones de 12 departamentos, junto con la Fundación Nacional Batuta, la Asociación Nacional de las Artes y la Fundación Poliedro.'),
    ]
PREGUNTAS_2026 = [
        ('¿Qué es Celebra la Música 2026?', 'Es una estrategia nacional liderada por el Ministerio de Cultura que promueve el encuentro, la creación y la circulación de las músicas de Colombia en su diversidad de expresiones, géneros y prácticas culturales. Durante noviembre, artistas, agrupaciones, comunidades, organizaciones e instituciones de diferentes regiones se unen para compartir la riqueza musical de sus territorios y fortalecer las redes del sector musical.'),
        ('¿Quién organiza la celebración?', 'La organiza el Ministerio de Cultura en articulación con escuelas de formación, festivales, mercados culturales, entidades territoriales y comunidades artísticas en todo el país.'),
        ('¿Es una celebración diferente cada año?', 'Sí. Desde su creación en 2011, Celebra la Música ha evolucionado cada año. Desde la versión anterior dejó de ser una jornada conmemorativa para convertirse en un proceso estructural y territorial que articula formación, creación, circulación y memoria musical.'),
        ('¿Se necesita comprar boletas o pagar entrada?', 'No. Todas las actividades son gratuitas y abiertas al público, salvo algunos eventos especiales organizados por aliados locales. La información estará en la programación.'),
        ('¿Quiénes pueden asistir a los conciertos y actividades?', 'Todas las personas. Celebra la Música promueve la participación de familias, comunidades y públicos diversos, garantizando la inclusión de niños, jóvenes, adultos mayores y personas con capacidades especiales.'),
        ('¿Cómo consulto la programación en mi ciudad o municipio?', 'La programación está en el sitio oficial de Celebra la Música, donde se puede filtrar por día y departamento, y en la agenda del PNMC de este portal.'),
        ('¿La programación es igual en todo el país?', 'No. Cada territorio diseña su propia agenda con base en sus procesos locales, artistas y espacios culturales, y por eso la programación refleja la identidad musical de cada región.'),
        ('¿Puedo llevar a mi familia y niños?', 'Sí. Es un evento para todos los públicos. La mayoría de las actividades son familiares y se desarrollan en espacios culturales, parques y escenarios públicos.'),
        ('¿Qué pasa si un evento se cancela o cambia de lugar?', 'Los cambios se anunciarán a través de los canales oficiales del Ministerio de Cultura.'),
        ('¿Dónde se realizan las actividades en mi municipio?', 'En escenarios culturales, parques, teatros, casas de la cultura, escuelas de música y otros espacios comunitarios.'),
    ]

FUENTE_2025 = ("Fuente: noticias de Celebra la música 2025 del Ministerio de Cultura de Colombia, "
               "https://celebralamusica.mincultura.gov.co/Paginas/noticias/index.aspx. Edición reconstruida de sus noticias (el sitio no tiene página propia de 2025).")
FUENTE_2026 = "Fuente: Ministerio de Cultura de Colombia, Celebra la música 2026, https://celebralamusica.mincultura.gov.co/Paginas/index.aspx."

# Aliados con logotipo REAL: (clave del logotipo, nombre). El nombre es el de la ficha de la edición y el título del recurso del grupo «Aliados».
# Los logos se descargaron de la página oficial (https://celebralamusica.mincultura.gov.co, pie «Aliados»): ver ALIADOS_OFICIALES en
# siembra/multimedia/pool.py. El sitio solo publica estos tres; las «15 organizaciones aliadas» no tienen logo ni nombre propio en él,
# así que se muestran como complemento del texto («y 15 organizaciones aliadas»), no se inventan.
ALIADOS = [
    ("aliado-fundacion-nacional-batuta", "Fundación Nacional Batuta"),
    ("aliado-asociacion-nacional-de-las-artes", "Asociación Nacional de las Artes"),
    ("aliado-fundacion-poliedro", "Fundación Poliedro"),
]
NOMBRES_DE_ALIADOS = {a: n for a, n in ALIADOS}

# Piezas de la edición que se descargan del Banco de archivos (con vista previa): (grupo, título, descripción, alias de la pieza).
PIEZAS_2025 = [
    ("Piezas de la edición", "Fotografía de la edición 2025: cantante", "Cantante con micrófono durante un concierto de la edición, para notas de prensa y redes. El crédito viaja con el archivo.", "img.pool.celebra.2025-galeria-1"),
    ("Piezas de la edición", "Fotografía de la edición 2025: baterista", "Baterista en escena durante la edición, lista para materiales de comunicación. El crédito viaja con el archivo.", "img.pool.celebra.2025-galeria-2"),
]
PIEZAS_2026 = [
    ("Piezas de la edición", "Ilustración principal 2026", "Ilustración del bus musical en WebP optimizado, lista para piezas de comunicación.", "img.pool.celebra.2026-ilustracion-principal"),
    ("Piezas de la edición", "Afiche 2026", "Afiche de la edición en WebP optimizado.", "img.pool.celebra.2026-afiche"),
    ("Piezas de la edición", "Título de la campaña", "Título de la campaña en letras amarillas y fucsia, en WebP optimizado.", "img.pool.celebra.2026-titulo"),
]

GALERIA_2025 = [f"img.pool.celebra.2025-galeria-{n}" for n in range(1, 7)]
GALERIA_2026 = ["img.pool.celebra.2026-titulo", "img.pool.celebra.2026-afiche", "img.pool.celebra.2026-foto-baterista",
                "img.pool.celebra.2026-foto-festiva", "img.pool.celebra.2026-foto-vida", "img.pool.celebra.2026-foto-circuitos"]

CATEGORIAS_2025 = [
    ("Músicas para la vida", "Visibiliza procesos formativos y comunitarios: escuelas de música, encuentros y muestras."),
    ("Cultura festiva", "Reconoce festivales y territorios sonoros como espacios de memoria, encuentro y convivencia."),
    ("Circuitos sonoros", "Destaca los mercados musicales como motores de economías populares y de la música en vivo."),
]
CATEGORIAS_2026 = [
    ("Músicas de nuestra patria", "Procesos de formación y escuelas comunitarias, municipales y Centros Batuta."),
    ("Cultura festiva", "Festivales y celebraciones constructoras de memoria, encuentro y circulación."),
    ("Circuitos sonoros", "Mercados musicales y culturales, festivales y espacios de música en vivo como nodos de economía, encuentro y circulación."),
]

EDICIONES = [
    dict(
        anio=2025, nombre="Celebra la Música 2025", proyecto="celebra-la-musica-2025", actual=False, publicada=True,
        inicio="2025-11-01", fin="2025-11-30", color_principal="#4C007E", color_secundario="#FEF43D",
        portada="img.pool.celebra.2025-galeria-1", fuente=FUENTE_2025,
        resumen="Durante todo noviembre de 2025, escuelas, festivales, mercados y comunidades de todo el país celebraron la música colombiana.",
        presentacion=(
            "Celebra la Música es una estrategia anual del Ministerio de Cultura, desarrollada por su grupo de música desde 2011. "
            "En 2025 se vivió durante todo noviembre, en el marco del Día del Músico, desde el Plan Nacional de Música para la Convivencia.\n\n"
            "La edición convocó a escuelas de música, festivales, mercados, artistas y comunidades de todas las regiones. Hubo presentaciones en escuelas, conciertos, "
            "circuitos de música en vivo, alianzas con mercados musicales y encuentros académicos, con el propósito de fortalecer la gobernanza musical y ampliar la participación ciudadana."),
        aliados="Fundación Nacional Batuta y Asociación Nacional de las Artes",
        aliados_logos=["aliado-fundacion-nacional-batuta", "aliado-asociacion-nacional-de-las-artes"],
        cifras=dict(actividades=None, municipios=None, departamentos=12, organizaciones=174, musicos=1300),
        categorias=CATEGORIAS_2025, recursos=RECURSOS_2025, piezas=PIEZAS_2025, preguntas=PREGUNTAS_2025, galeria=GALERIA_2025,
        creada="2025-10-17T10:00:00", actualizada="2026-11-18T09:30:00"),
    dict(
        anio=2026, nombre="Celebra la Música 2026", proyecto="celebra-la-musica-2026", actual=True, publicada=True,
        inicio="2026-11-01", fin="2026-11-30", color_principal="#D8175A", color_secundario="#09153C",
        portada="img.pool.celebra.2026-ilustracion-principal", fuente=FUENTE_2026,
        resumen="Más de 190 actividades en 76 municipios de 28 departamentos para conmemorar el Día del Músico durante todo noviembre.",
        presentacion=(
            "Cada año, en noviembre, llega Celebra la Música, la estrategia del Ministerio de Cultura que conmemora el Día del Músico (22 de noviembre). "
            "Es una invitación al encuentro entre artistas, comunidades e instituciones para aprender, crear y compartir sonidos en toda Colombia. "
            "Esta conmemoración recuerda que hacer música es un derecho que merece reconocimiento y protección por parte del Estado.\n\n"
            "Este año, Celebra la Música tendrá una agenda de actividades que honran la posibilidad de cantar y tocar un instrumento en el país, de la mano de Batuta, "
            "la Asociación Nacional de las Artes, la Fundación Poliedro y 15 organizaciones aliadas."),
        aliados="Fundación Nacional Batuta, Asociación Nacional de las Artes y Fundación Poliedro",
        aliados_logos=["aliado-fundacion-nacional-batuta", "aliado-asociacion-nacional-de-las-artes", "aliado-fundacion-poliedro"],
        cifras=dict(actividades=190, municipios=76, departamentos=28, organizaciones=15, musicos=None),
        categorias=CATEGORIAS_2026, recursos=RECURSOS_2026, piezas=PIEZAS_2026, preguntas=PREGUNTAS_2026, galeria=GALERIA_2026,
        creada="2026-10-19T10:00:00", actualizada="2026-11-19T09:30:00"),
]
