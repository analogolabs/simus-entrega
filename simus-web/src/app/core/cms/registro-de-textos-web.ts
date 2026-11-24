/**
 * Registro unico del contenido editable del sitio publico.
 *
 * Antes existian tres listas paralelas de las mismas claves — los textos por
 * defecto, el catalogo de etiquetas/limites y la agrupacion del panel — que
 * habia que mantener sincronizadas a mano. Aqui cada clave se declara una sola
 * vez y las otras tres vistas se derivan. Agregar contenido editable es agregar
 * un field() al grupo que corresponda.
 *
 * Este archivo es datos puros: no importa Angular ni toca almacenamiento, para
 * que pueda alimentar tambien la semilla de la base de datos.
 */

export interface DefinicionDeCampoDeTexto {
  key: string;
  label: string;
  limit: number;
  defaultValue: string;
}

export interface DefinicionDeGrupoDeTexto {
  id: string;
  label: string;
  section: string;
  fields: DefinicionDeCampoDeTexto[];
}

/** Una clave del catalogo, aplanada con la seccion de su grupo. */
export interface DescriptorDeClaveDeTexto {
  key: string;
  label: string;
  section: string;
  limit: number;
}

/** Seccion del panel: el orden y la etiqueta corta no se derivan del contenido. */
export interface DefinicionDeSeccionDeTexto {
  section: string;
  /** El nombre de la página en el menú lateral del CMS (el mismo que usa el portal). */
  pill: string;
  /** El encabezado del menú bajo el que se agrupa la página. */
  area: string;
}

const field = (key: string, label: string, limit: number, defaultValue: string): DefinicionDeCampoDeTexto => ({
  key,
  label,
  limit,
  defaultValue,
});

const timelineDefaults = [
  ['2003-2006', 'Creación e Institucionalización', 'La aprobación del CONPES 3409 de 2006 formalizó el PNMC y consolidó las Escuelas Municipales de Música (EMM) como espacios centrales para la formación musical colectiva. Este periodo estableció los cimientos del programa: acceso, democratización, convivencia y fortalecimiento de las músicas locales. Se amplió la dotación instrumental, se fortalecieron los equipos territoriales y se empezó a articular una red nacional de formación basada en la práctica comunitaria.'],
  ['2007-2014', 'Territorialización y saberes', 'Durante esta etapa se profundizó en la institucionalización territorial, con énfasis en la formación de formadores, la cualificación de músicos en ejercicio y el impulso a las músicas tradicionales. Se promovió la descentralización, se consolidaron procesos comunitarios sostenidos y se promovió el reconocimiento de músicos empíricos y sabedores. Este periodo marcó un avance significativo en la diversidad musical, al visibilizar prácticas propias de cada región y promover su circulación.'],
  ['2015-2018', 'Profesionalización y SIMUS', 'En estos años se desarrollaron las líneas estratégicas de Musicalización de la Ciudadanía y Estructuración del Campo Profesional de la Música, orientadas a fortalecer la formación integral y la profesionalización del sector. Se creó el Sistema de Información de la Música (SIMUS), herramienta clave para la toma de decisiones y la caracterización del ecosistema musical. Además, se implementaron nuevas estrategias de circulación y se amplió la presencia del PNMC en festivales, mercados y espacios de movilidad artística.'],
  ['2018-2022', 'Evaluación y Consolidación', 'El Departamento Nacional de Planeación (DNP) realizó una evaluación integral del PNMC, destacando su impacto en la formación musical, el fortalecimiento del tejido social y la dignificación del trabajo artístico. A partir de esta evaluación se identificaron retos y oportunidades, como mejorar la articulación interinstitucional, fortalecer SIMUS, ampliar la presencia del PNMC en educación superior, incentivar economías creativas en los territorios y mejorar las condiciones laborales de los músicos y formadores.'],
  ['2023-2025', 'Actualización y Proyección 2035', 'En un ejercicio nacional sin precedentes, el Ministerio de las Culturas abrió espacios de participación a través de 34 Encuentros Territoriales, mesas sectoriales, la Mesa Nacional Vinculante y el VII Congreso Nacional de Música. Estas iniciativas permitieron recoger las necesidades, visiones y apuestas del sector musical en todo el país y dieron origen al PNMC 2025-2035, “Huellas y apuestas de la diversidad sonora”. Este nuevo Plan articula la música con la vida, el diálogo intercultural, la bioculturalidad, la equidad, la sostenibilidad y la gobernanza participativa, proyectando un ecosistema musical diverso, justo y sostenible para la próxima década.'],
];

const normativeDefaults = [
  ['1997', 'Ley 397 de 1997', 'La Ley General de Cultura establece los principios, objetivos y mecanismos para proteger, fomentar y difundir la cultura en Colombia. Reconoce la diversidad cultural como fundamento de la identidad nacional y define la cultura como derecho. En su estructura se incluyen disposiciones para el fomento de las artes, la formación artística y la protección del patrimonio cultural, elementos esenciales para el desarrollo del PNMC. Actualizada por la Ley 1185 de 2008.'],
  ['2006', 'CONPES 3409 de 2006', 'Este documento aprobó la política del Plan Nacional de Música para la Convivencia, institucionalizando las Escuelas Municipales de Música y definiendo estrategias para mejorar la formación musical, la dotación instrumental y la gestión cultural en los territorios. Fue la base técnica y financiera que permitió consolidar el PNMC como política pública estable.'],
  ['2011', 'Ley 1493 de 2011', 'La Ley de Espectáculos Públicos regula la organización de espectáculos públicos de las artes escénicas y promueve la circulación artística en condiciones más equitativas. Aunque su alcance es más amplio que la música, ha tenido un impacto directo en la infraestructura cultural y en la movilidad de artistas y agrupaciones musicales en el país, facilitando escenarios más dignos y accesibles.'],
  ['2018', 'Decreto 2120 de 2018', 'Este decreto reglamenta la organización, funcionamiento y articulación de los subsistemas que integran el Sistema Nacional de Cultura. Para el PNMC es clave porque define los espacios de participación ciudadana, la gobernanza territorial y las responsabilidades institucionales en procesos formativos y comunitarios, incluyendo los vinculados a las músicas del país.'],
  ['2024-2038', 'Plan Nacional de Cultura', 'El nuevo PNC establece la visión cultural del país para los próximos 14 años. Define la cultura como eje del cuidado de la vida, la diversidad y la paz, y orienta las políticas del Ministerio de las Culturas, las Artes y los Saberes. El PNMC 2025-2035 se enmarca plenamente en esta estrategia, en sus componentes institucional y subsectorial, articulando lineamientos de diversidad sonora, ecosistemas culturales, gobernanza y sostenibilidad.'],
  ['2025', 'Ley 2555 de 2025', 'La Ley Artes al Aula convierte la educación artística en un mandato para todas las instituciones educativas oficiales del país. Reconoce las artes, incluida la música, como un derecho cultural fundamental y exige su incorporación transversal en los procesos pedagógicos, fortaleciendo competencias creativas, socioemocionales y ciudadanas. Impulsa la formación docente en pedagogías artísticas, promueve la articulación entre escuela, comunidad y territorio, y orienta la implementación desde el SINEFAC, facilitando la coordinación entre los sectores de educación y cultura.'],
];

/**
 * EQUIPO DE TRABAJO DEL PNMC (P-6): ÚNICA FUENTE DE LA NÓMINA DE FÁBRICA. La página «El Plan» la lee de aquí
 * (`TextosWebService.getWebTeamMembers`) mientras nadie publique otra desde el panel (Equipo).
 *
 * PENDIENTE DE ACTUALIZAR: los nombres de abajo los entregará el equipo antes de la entrega. Para actualizarlos
 * basta editar esta lista (o publicar la nómina desde el panel); la página no escribe ningún nombre propio.
 * No se inventan nombres: hasta entonces se conserva la lista vigente.
 */
export const TEAM_DEFAULTS: string[][] = [
  ['Coordinación Grupo de Música', 'Jorge Enrique Sossa Santos', 'jsossa@mincultura.gov.co'],
  ['Apoyo a la coordinación', 'Dora Carolina Rojas Rivera', 'drojas@mincultura.gov.co'],
  ['Líder Componente: Formación', 'Diego Rodríguez', 'drodriguezc@mincultura.gov.co'],
  ['Líder Componente: Investigación', 'Raúl Hernán Daza', 'rdaza@mincultura.gov.co'],
  ['Líder Componente: Circulación', 'Carolina Ruiz Barragán', 'druizb@mincultura.gov.co'],
  ['Líder Componente: Dotación', 'Guadalupe Gil', 'ggil@mincultura.gov.co'],
  ['Líder Componente: Creación', 'Isabel Durán', 'iduranp@mincultura.gov.co'],
  ['Líder Componente: Gobernanza', 'Sergio Said', 'ssaid@mincultura.gov.co'],
  ['Líder Componente: Información', 'Yazmín López', 'ylopez@mincultura.gov.co'],
  ['Líder Componente: Comunicación', 'Shirley Giomar Gómez', 'sgomezc@mincultura.gov.co'],
];

export const WEB_TEXT_GROUPS: DefinicionDeGrupoDeTexto[] = [
  {
    id: 'about_hero_presentation', label: 'Hero y Presentación', section: 'PNMC', fields: [
      field('about_hero_tag', 'Hero - Antetítulo (nombre del Plan)', 60, 'Plan Nacional de Música para la Convivencia'),
      field('about_hero_title', 'Hero - Título', 70, 'PNMC 2025–2035'),
      field('about_description', 'Hero - Definición del Plan', 300, 'La política pública del Ministerio de las Culturas, las Artes y los Saberes que reconoce la música como derecho cultural y orienta su formación, circulación, investigación y gobernanza en todo el país.'),
      field('about_presentation_bg', 'Presentación - Palabra de fondo', 50, 'POLÍTICA'),
      field('about_presentation_title', 'Presentación - Título', 80, 'Presentación'),
      field('about_presentation_intro_1', 'Presentación - Párrafo 1', 700, 'La música nos conecta y nos permite expresar quiénes somos. En Colombia, nuestra diversidad sonora fortalece los vínculos comunitarios y refleja la riqueza cultural de cada región. Desde hace 20 años, el Plan Nacional de Música para la Convivencia (PNMC) protege y proyecta nuestra pluralidad musical.'),
      field('about_presentation_intro_2', 'Presentación - Párrafo 2', 700, 'Entendemos la música como un derecho cultural y una herramienta fundamental para la equidad y la construcción de paz. Nuestra nueva hoja de ruta, “Huellas y apuestas de la diversidad sonora”, nace de un proceso participativo sin precedentes en todo el país. Es una política renovada, inclusiva y descentralizada para los retos del futuro.'),
      field('about_base_tag', 'Apuesta base - Etiqueta', 80, 'Apuesta Base'),
      field('about_base_quote', 'Apuesta base - Texto', 500, 'Consolidar la equidad de condiciones y oportunidades en el campo musical, promoviendo la participación y el ejercicio pleno de los derechos culturales.'),
      field('about_base_objective_label', 'Apuesta base - Etiqueta objetivo', 80, 'Objetivo General'),
      field('about_base_plan_label', 'Apuesta base - Etiqueta plan', 100, 'Plan Nacional de Música'),
      field('about_collective_tag', 'Construcción colectiva - Etiqueta', 80, 'Construcción Colectiva'),
      field('about_collective_text', 'Construcción colectiva - Texto', 500, 'El PNMC 2025–2035, Huellas y apuestas de la diversidad sonora, nace de un proceso participativo sin precedentes, recogiendo voces a través de encuentros territoriales en todo el país.'),
    ],
  },
  {
    id: 'about_objectives', label: 'Objetivos', section: 'PNMC', fields: [
      field('about_objectives_bg', 'Objetivos - Palabra de fondo', 50, 'ESTRATEGIA'),
      field('about_objectives_title', 'Objetivos - Título', 80, 'Objetivos de Eje'),
      field('about_objective_1_axis', 'Objetivo 1 - Nombre del eje', 200, 'MÚSICA PARA LA VIDA, EL DIÁLOGO INTERCULTURAL Y LA DIVERSIDAD BIOCULTURAL'),
      field('about_objective_1_title', 'Objetivo 1 - Título', 100, 'Formación y Cuidado'),
      field('about_objective_1_desc', 'Objetivo 1 - Descripción', 500, 'Promover procesos de formación y práctica musical que fortalezcan la relación ética, sensible y sostenible entre las personas y sus territorios, como medio para el cuidado biocultural y la paz.'),
      field('about_objective_1_button', 'Objetivo 1 - Botón', 40, 'Explorar eje'),
      field('about_objective_2_axis', 'Objetivo 2 - Nombre del eje', 200, 'FORTALECIMIENTO DE LAS PRÁCTICAS, EXPRESIONES Y OFICIOS DE LA MÚSICA'),
      field('about_objective_2_title', 'Objetivo 2 - Título', 100, 'Desarrollo Integral'),
      field('about_objective_2_desc', 'Objetivo 2 - Descripción', 500, 'Cualificar procesos de creación, producción y circulación. Fomentar la formalización de oficios y saberes para lograr el reconocimiento profesional y la equidad en todas las regiones.'),
      field('about_objective_2_button', 'Objetivo 2 - Botón', 40, 'Explorar eje'),
      field('about_objective_3_axis', 'Objetivo 3 - Nombre del eje', 200, 'GOBERNANZA MUSICAL E INTEGRACIÓN CULTURAL E INTERSECTORIAL'),
      field('about_objective_3_title', 'Objetivo 3 - Título', 100, 'Gobernanza y Gestión'),
      field('about_objective_3_desc', 'Objetivo 3 - Descripción', 500, 'Impulsar la legitimidad y articulación de los mecanismos de organización del sector con el Estado, orientada a la sostenibilidad cultural y la dignificación de los oficios musicales.'),
      field('about_objective_3_button', 'Objetivo 3 - Botón', 40, 'Explorar eje'),
    ],
  },
  {
    id: 'about_approaches', label: 'Enfoques transversales', section: 'PNMC', fields: [
      field('about_approaches_tag', 'Enfoques - Etiqueta', 60, 'TRANSVERSALIDAD'),
      field('about_approaches_title', 'Enfoques - Título', 100, 'Enfoques del Sistema'),
      field('about_approaches_desc', 'Enfoques - Descripción', 400, 'Consideramos las particularidades sociales y geográficas para garantizar un acceso equitativo a la cultura.'),
      field('about_approach_1_title', 'Enfoque 1 - Título', 80, 'Biocultural'),
      field('about_approach_1_desc', 'Enfoque 1 - Descripción', 350, 'Relación música-entorno natural. Integración de saberes ancestrales y preservación sonora ambiental.'),
      field('about_approach_2_title', 'Enfoque 2 - Título', 80, 'Poblacional'),
      field('about_approach_2_desc', 'Enfoque 2 - Descripción', 350, 'Equidad para infancia, mujeres, diversidades de género, pueblos étnicos y personas con capacidades diversas.'),
      field('about_approach_3_title', 'Enfoque 3 - Título', 80, 'Territorial'),
      field('about_approach_3_desc', 'Enfoque 3 - Descripción', 350, 'Estrategias diferenciadas según geografía, infraestructura local y financiamiento por contextos.'),
    ],
  },
  {
    id: 'about_actors', label: 'Actores del Plan', section: 'PNMC', fields: [
      field('about_actors_bg', 'Actores - Palabra de fondo', 50, 'ECOSISTEMA'),
      field('about_actors_title', 'Actores - Título', 80, 'Actores del Plan'),
      field('about_actors_tag', 'Actores - Etiqueta', 80, 'Ecosistema humano'),
      field('about_actors_heading', 'Actores - Encabezado', 120, 'Tres capas de articulación'),
      field('about_actors_desc', 'Actores - Descripción', 500, 'El plan conecta sector musical, institucionalidad y sociedad civil en una misma arquitectura de colaboración para la formación, circulación, sostenibilidad y gobernanza de la música.'),
      field('about_actors_sector_title', 'Actores sectoriales - Título', 100, 'Agentes Sectoriales'),
      field('about_actors_sector_items', 'Actores sectoriales - Lista (una línea por elemento)', 700, 'Creadores y compositores\nIntérpretes y agrupaciones\nDocentes y formadores\nInvestigadores\nProductores y técnicos\nGestores y promotores\nConstructores de instrumentos'),
      field('about_actors_institutional_title', 'Actores institucionales - Título', 100, 'Agentes Institucionales'),
      field('about_actors_institutional_items', 'Actores institucionales - Lista (una línea por elemento)', 700, 'Gobiernos locales\nEscuelas de Música\nCasas de la Cultura\nMinisterios nacionales\nAliados del Estado\nCooperación Ibermúsicas'),
      field('about_actors_civil_title', 'Sociedad civil - Título', 100, 'Sociedad Civil'),
      field('about_actors_civil_items', 'Sociedad civil - Lista (una línea por elemento)', 700, 'Asociaciones de músicos\nOrganizaciones sin ánimo de lucro\nAsociaciones de padres\nCabildos indígenas\nConsejos afrodescendientes'),
    ],
  },
  {
    id: 'about_timeline', label: 'Hitos', section: 'PNMC', fields: [
      field('about_timeline_bg', 'Hitos - Palabra de fondo', 50, 'EVOLUCIÓN'),
      field('about_timeline_title', 'Hitos - Título', 80, 'Hitos del PNMC'),
      field('about_timeline_intro', 'Hitos - Introducción', 700, 'Desde hace más de medio siglo, Colombia ha construido una política musical que reconoce la música como un derecho cultural y puente de convivencia. El PNMC, creado en 2003, es el resultado de una trayectoria que inició con Colcultura en 1968, garantizando hoy que todas las personas puedan vivir plenamente la música como experiencia y bien común.'),
      ...timelineDefaults.flatMap((stage, index) => [
        field(`about_timeline_${index + 1}_year`, `Hito ${index + 1} - Periodo`, 30, stage[0]),
        field(`about_timeline_${index + 1}_title`, `Hito ${index + 1} - Título`, 120, stage[1]),
        field(`about_timeline_${index + 1}_desc`, `Hito ${index + 1} - Descripción`, 1400, stage[2]),
      ]),
    ],
  },
  {
    id: 'about_normative', label: 'Marco normativo', section: 'PNMC', fields: [
      field('about_normative_bg', 'Marco normativo - Palabra de fondo', 50, 'MARCO'),
      field('about_normative_title', 'Marco normativo - Título', 80, 'Marco Normativo'),
      field('about_normative_intro', 'Marco normativo - Introducción', 700, 'El PNMC se sustenta en una trayectoria normativa que ha consolidado la cultura y la música como derechos, políticas públicas y herramientas de transformación territorial. Este marco articula leyes, decretos, documentos de política y planes nacionales que orientan la formación, la circulación, la participación y la gobernanza cultural en Colombia.'),
      ...normativeDefaults.flatMap((stage, index) => [
        field(`about_normative_${index + 1}_year`, `Norma ${index + 1} - Año`, 30, stage[0]),
        field(`about_normative_${index + 1}_title`, `Norma ${index + 1} - Título`, 120, stage[1]),
        field(`about_normative_${index + 1}_desc`, `Norma ${index + 1} - Descripción`, 1400, stage[2]),
      ]),
    ],
  },
  {
    id: 'about_team', label: 'Equipo de Trabajo', section: 'PNMC', fields: [
      field('about_team_bg', 'Palabra de fondo', 50, 'EQUIPO'),
      field('about_team_title', 'Título', 80, 'Equipo de Trabajo'),
      field('about_team_intro', 'Introducción', 700, 'El PNMC se construye y acompaña desde un equipo técnico que articula componentes, seguimiento institucional y trabajo con los territorios. Aquí puedes identificar los referentes del plan por coordinación y componente, con sus canales de contacto institucional.'),
      field('about_team_coordination_label', 'Etiqueta coordinación', 80, 'Coordinación General'),
      field('about_team_leadership_label', 'Etiqueta liderazgos', 100, 'Liderazgos por componente'),
      field('about_team_name_placeholder', 'Nombre pendiente', 80, 'Por definir'),
      field('about_team_email_placeholder', 'Correo pendiente', 80, 'Correo pendiente'),
    ],
  },
  {
    id: 'home_hero', label: 'Encabezado Principal (Hero)', section: 'Portada', fields: [
      field('home_title', 'Título principal', 120, 'Sistema de Información de la Música'),
      field('home_hero_lema', 'Lema', 120, 'La música de Colombia, en todos sus territorios.'),
      field('home_description', 'Descripción', 400, 'SIMUS reúne la información de festivales, mercados y procesos musicales del país para que cualquier persona pueda explorarla, entenderla y usarla para tomar decisiones.'),
    ],
  },
  // Los dos botones del hero —«Sobre el PNMC» y «Explorar Ejes»— fueron
  // editables hasta agosto de 2026. Se retiraron del panel a peticion del
  // equipo: son rotulos de navegacion, no copia. Su texto vive ahora en
  // `home.component.html`, al lado del destino al que llevan, que nunca fue
  // editable. Separar el rotulo del destino invitaba a que alguien renombrara
  // «Explorar Ejes» a otra cosa sin que el boton dejara de ir a /ejes.
  {
    id: 'home_about', label: 'Sección Identidad', section: 'Portada', fields: [
      field('home_about_title', 'Antetítulo', 100, 'Qué es SIMUS'),
      field('home_about_quote', 'Frase de la sección', 200, 'La infraestructura digital que conecta el ecosistema musical colombiano.'),
      field('home_concepto_1_title', 'Concepto 1 - Título', 40, 'Ecosistema'),
      field('home_concepto_1_desc', 'Concepto 1 - Descripción', 180, 'Reconoce a las personas, organizaciones y procesos que hacen la música del país.'),
      field('home_concepto_2_title', 'Concepto 2 - Título', 40, 'Información'),
      field('home_concepto_2_desc', 'Concepto 2 - Descripción', 180, 'Reúne, revisa y publica datos del sector musical con criterios comunes.'),
      field('home_concepto_3_title', 'Concepto 3 - Título', 40, 'Territorio'),
      field('home_concepto_3_desc', 'Concepto 3 - Descripción', 180, 'Sitúa cada proceso en su lugar: departamentos, municipios y territorios sonoros.'),
      field('home_concepto_4_title', 'Concepto 4 - Título', 40, 'Conocimiento'),
      field('home_concepto_4_desc', 'Concepto 4 - Descripción', 180, 'Pone a disposición publicaciones y lecturas para la gestión y la política pública.'),
      field('home_about_desc', 'Subtítulo', 500, 'Reconoce actores, organizaciones, procesos, prácticas y territorios de la música en Colombia, y sostiene progresivamente funciones de conocimiento, gestión y política pública para el sector.'),
    ],
  },
  {
    id: 'home_bulletin', label: 'Boletín y Redes', section: 'Portada', fields: [
      field('home_bulletin_title', 'Cierre - Frase final', 80, 'La música colombiana sigue moviéndose.'),
      field('home_bulletin_desc', 'Boletín - Descripción', 200, 'Recibe el boletín del SIMUS: novedades del ecosistema musical colombiano.'),
      field('home_bulletin_placeholder', 'Boletín - Marcador email', 55, 'Ingresa tu correo'),
      field('home_bulletin_btn', 'Boletín - Botón registro', 40, 'Registrarme'),
      field('home_social_title', 'Redes - Título redes', 80, 'Síguenos'),
      field('home_social_desc', 'Redes - Subtexto oficial', 120, 'Síguenos en nuestras redes oficiales'),
    ],
  },
  {
    // «La música en el territorio» (portada-territorio.component.ts). Hasta el 5 de octubre de
    // 2026 era el banner deslizante de tres diapositivas; queda solo la del mapa, que se volvió
    // sección propia, y por eso sus claves conservan el nombre `home_banner2_*`. El destino del
    // botón no entra: siempre es el mapa.
    id: 'home_banner', label: 'La música en el territorio', section: 'Portada', fields: [
      field('home_banner2_tag', 'Antetítulo', 60, 'Mapa ecosistémico'),
      field('home_banner2_title', 'Título de la sección', 90, 'La música en el territorio'),
      field('home_banner2_desc', 'Subtítulo', 300, 'Explora dónde ocurren los procesos y eventos del ecosistema musical, por departamento, territorio sonoro o práctica.'),
      field('home_banner2_cta', 'Botón', 50, 'Explorar el mapa'),
    ],
  },
  {
    id: 'home_strategies_title', label: 'Qué encuentras en SIMUS · cabecera', section: 'Portada', fields: [
      field('home_strat_tag', 'Antetítulo', 80, 'Puertas de entrada'),
      field('home_strat_title', 'Título de la sección', 120, 'Explora SIMUS'),
      field('home_strat_desc', 'Subtítulo', 300, 'Distintas puertas para recorrer, comprender y conectar con el ecosistema musical colombiano.'),
    ],
  },
  {
    id: 'home_strategies_cards', label: 'Explora SIMUS · 5 puertas', section: 'Portada', fields: [
      // Las puertas de entrada, no categorías de la base. Agenda conserva la clave de la antigua
      // tarjeta («mercados») aunque ya no la describa: renombrarla obligaría a migrar lo publicado.
      // Ver TARJETAS_DE_SIMUS en home-strategies-section.
      field('strat_ecosistema_tag', 'Ecosistema - Antetítulo', 60, 'Puerta principal'),
      field('strat_ecosistema_title', 'Ecosistema - Título', 80, 'Ecosistema musical'),
      field('strat_ecosistema_desc', 'Ecosistema - Descripción', 200, 'Descubre actores, procesos y territorios de la música en Colombia.'),
      field('strat_conocimiento_tag', 'Conocimiento - Antetítulo', 60, 'Consulta'),
      field('strat_conocimiento_title', 'Conocimiento - Título', 80, 'Conocimiento'),
      field('strat_conocimiento_desc', 'Conocimiento - Descripción', 140, 'Datos, estudios y publicaciones.'),
      field('strat_historias_tag', 'Historias - Antetítulo', 60, 'Editorial'),
      field('strat_historias_title', 'Historias - Título', 80, 'Historias'),
      field('strat_historias_desc', 'Historias - Descripción', 140, 'Historias y miradas sobre el sector.'),
      field('strat_mercados_tag', 'Agenda - Antetítulo', 60, 'Lo que viene'),
      field('strat_mercados_title', 'Agenda - Título', 80, 'Agenda'),
      field('strat_mercados_desc', 'Agenda - Descripción', 140, 'Conoce lo que está sucediendo.'),
      field('strat_pnmc_tag', 'PNMC - Antetítulo', 60, 'El Plan'),
      field('strat_pnmc_title', 'PNMC - Título', 80, 'PNMC'),
      field('strat_pnmc_desc', 'PNMC - Descripción', 140, 'El Plan Nacional de Música para la Convivencia: sus ejes, componentes y estrategias.'),
    ],
  },
  // Aqui vivia `map_hero`, con una sola clave: `map_description`, la
  // «introduccion del geovisor». Ya no la lee nadie. Su unico uso real era un
  // parche de la plantilla del tutorial —sustituia la descripcion del primer
  // paso, de modo que una misma clave hacia dos trabajos— y ese parche se quito
  // al declarar los 14 campos propios del tutorial.
  //
  // Se retira en vez de conectarla porque /mapa es un geovisor a pantalla
  // completa: no tiene encabezado ni bloque donde quepan 300 caracteres de
  // introduccion. Inventarle uno seria diseno de producto, no correccion de un
  // defecto. Si algun dia se quiere esa entradilla, se vuelve a declarar y se
  // pinta; hasta entonces, ofrecerla en el panel es prometer un cambio que la
  // pagina ignora.
  /*
   * El tutorial del geovisor: catorce textos que solo ve quien no sabe usarlo.
   *
   * Es la única pieza del portal cuyo público es, por definición, el que más
   * ayuda necesita, y era la que menos podía corregirse: siete pasos de prosa
   * dentro de un arreglo de TypeScript. Ahí siguen viviendo el ORDEN y el icono
   * de cada paso —son estructura—; el texto lo manda el panel.
   *
   * Los números («1.», «2.») se quedan DENTRO del texto editable y no se
   * generan alrededor. Es a propósito: el primer paso es una bienvenida y no
   * lleva número, así que numerar automáticamente exigiría una excepción para
   * el primero, y esa excepción se rompe en cuanto alguien reordene los pasos
   * desde el panel.
   */
  {
    // EL RECORRIDO GUIADO DEL MAPA, ACTUALIZADO A LA VERSIÓN FINAL (18 nov 2026, `docs/desarrollo/30-consola-y-acceso.md` §30.16).
    //
    // CLAVES NUEVAS `map_recorrido_N_*` Y NO LAS DE `map_tutorial_N_*`. El recorrido anterior se
    // renumeró al retirar los pasos de áreas y unidades: un texto editado desde la gestión del
    // sitio bajo `map_tutorial_13` a `_18` habría caído en otro paso, con otro significado. Con claves
    // nuevas cada texto vuelve a su valor de fábrica y nadie ve prosa de otro paso. Las claves
    // antiguas siguen más abajo, como respaldo, con su contenido intacto.
    //
    // LOS ICONOS, EL ORDEN Y LOS APARTADOS QUE SE SEÑALAN SON ESTRUCTURA y viven en
    // `PASOS_DEL_TUTORIAL`; aquí solo está lo que cada paso dice. Añadir un paso exige su entrada
    // allí y sus dos claves aquí.
    id: 'map_recorrido', label: 'Recorrido guiado del mapa', section: 'Mapa ecosistémico', fields: [
      field('map_recorrido_1_title', 'Paso 1, título', 80, 'Un mapa que se lee de varias formas'),
      field('map_recorrido_1_desc', 'Paso 1, texto', 400, 'Aquí están los procesos musicales que registra el PNMC, situados en su territorio. En 16 pasos verás cómo acotarlos, dibujarlos, leerlos como mapa o gráfico, y exportarlos con su fuente. Sal cuando quieras con Escape; la ayuda vuelve a abrirlo.'),

      field('map_recorrido_2_title', 'Paso 2, título', 80, 'Capas: qué tipo de proceso miras'),
      field('map_recorrido_2_desc', 'Paso 2, texto', 400, 'Cada capa es un tipo de proceso: Festivales, Mercados, Redes y documentación, Lutería y Espacios para música en vivo. «General» los junta. La cifra de cada una es cuántos registros públicos tiene en este momento.'),

      field('map_recorrido_3_title', 'Paso 3, título', 80, 'Filtros: los mismos en las dos vistas'),
      field('map_recorrido_3_desc', 'Paso 3, texto', 400, 'Busca por nombre o palabra y elige departamento y municipio. Cada filtro aparece como etiqueta y se quita por separado; «Limpiar» los quita todos. Al pasar de mapa a gráfico se conservan, y quedan en la dirección: puedes compartirla.'),

      field('map_recorrido_4_title', 'Paso 4, título', 80, 'El lente: con qué se colorea'),
      field('map_recorrido_4_desc', 'Paso 4, texto', 400, 'Elige con qué criterio se reparte el color: territorios sonoros, prácticas musicales o división administrativa. El lente no quita registros: cambia cómo se pinta lo mismo, y su criterio acompaña al gráfico.'),

      field('map_recorrido_5_title', 'Paso 5, título', 80, 'Coropleta: el departamento entero'),
      field('map_recorrido_5_desc', 'Paso 5, texto', 400, 'Cada departamento se tiñe según lo que domina en él o cuántos registros tiene. Se lee de un vistazo, pero un departamento extenso pesa más a la vista aunque tenga menos procesos. Para comparar cantidades, mira los símbolos.'),

      field('map_recorrido_6_title', 'Paso 6, título', 80, 'Símbolos: un círculo por municipio'),
      field('map_recorrido_6_desc', 'Paso 6, texto', 400, 'Un círculo en cada municipio, más grande cuantos más procesos tiene. El tamaño no depende de lo extenso que sea el territorio, así que compara cantidades de verdad. Los círculos cercanos se agrupan y se separan al acercar.'),

      field('map_recorrido_7_title', 'Paso 7, título', 80, 'Mapa de calor: dónde se concentra'),
      field('map_recorrido_7_desc', 'Paso 7, texto', 400, 'Una mancha continua que ignora los límites administrativos. Muestra lo que las otras dos no pueden: una práctica musical no se detiene en la frontera de un departamento, y aquí se ve dónde se concentra.'),

      field('map_recorrido_8_title', 'Paso 8, título', 80, 'Leyenda: cómo leer lo que ves'),
      field('map_recorrido_8_desc', 'Paso 8, texto', 400, 'Dice qué significan los colores y los tamaños del dibujo puesto, y cambia con él. Incluye una línea de lectura con los procesos, municipios y departamentos que se ven. Se puede plegar y volver a abrir.'),

      field('map_recorrido_9_title', 'Paso 9, título', 80, 'Lectura por departamento y municipio'),
      field('map_recorrido_9_desc', 'Paso 9, texto', 400, 'Pulsa un departamento para entrar en él: el mapa se acota a sus municipios y la columna derecha pasa a su directorio y su agenda. Pulsa un municipio para ver sus procesos. Para volver al país, quita el departamento en los filtros.'),

      field('map_recorrido_10_title', 'Paso 10, título', 80, 'Mapa, gráfico o tabla'),
      field('map_recorrido_10_desc', 'Paso 10, texto', 400, 'Los mismos datos en dos vistas, mapa y gráfico, con el mismo conjunto de filtros. El conmutador no se mueve: está siempre arriba a la izquierda, con el nombre de cada vista a la vista. Cambiar de vista no pierde ni la capa, ni el lente, ni los filtros.'),

      field('map_recorrido_11_title', 'Paso 11, título', 80, 'Gráfico: siete lecturas'),
      field('map_recorrido_11_desc', 'Paso 11, texto', 400, 'Cada posición de esta tira es una cifra y un control: dice el dato y, al pulsarla, cambia lo que se dibuja debajo. «Exportar» baja el gráfico en PNG o SVG, o sus datos en CSV, con título, filtros, fecha y la fuente: el Sistema de Información de la Música (SIMUS).'),

      field('map_recorrido_12_title', 'Paso 12, título', 80, 'Registros por departamento'),
      field('map_recorrido_12_desc', 'Paso 12, texto', 400, 'El orden y el valor. Las barras están a escala del mayor, con la rejilla en sus cuartos para decir «este está por la mitad» sin medir. Cada fila es un botón: púlsala y el mapa se acota a ese departamento.'),

      field('map_recorrido_13_title', 'Paso 13, título', 80, 'Composición: de qué está hecho'),
      field('map_recorrido_13_desc', 'Paso 13, texto', 400, 'Lo más declarado en los registros, medido por territorios sonoros o por prácticas y géneros: dos clasificaciones distintas del mismo conjunto. Cada fila lleva el color que el lente le da en el mapa.'),

      field('map_recorrido_14_title', 'Paso 14, título', 80, 'Exportar lo que ves'),
      field('map_recorrido_14_desc', 'Paso 14, texto', 400, 'Desde el gráfico, «Exportar» baja lo que ves en imagen PNG, vector SVG o sus datos en CSV, con los filtros puestos, la fecha y la fuente en el propio archivo. El listado completo de registros está en cada directorio del ecosistema.'),

      field('map_recorrido_15_title', 'Paso 15, título', 80, 'Con teclado y lector de pantalla'),
      field('map_recorrido_15_desc', 'Paso 15, texto', 400, 'Todo se alcanza con Tab y se activa con Entrar o Espacio. Las barras del gráfico y sus tablas de datos son la lectura sin puntero ni color del mapa, y los botones de acercar y alejar mueven el mapa. Escape cierra el recorrido. Cada paso se anuncia al cambiar.'),

      field('map_recorrido_16_title', 'Paso 16, título', 80, 'Directorio y agenda'),
      field('map_recorrido_16_desc', 'Paso 16, texto', 400, 'Junto al mapa, el directorio lista los registros del ámbito que tengas puesto y la agenda, sus eventos con fecha y lugar. Ambos siguen a los filtros. En cada ficha, «Ubicar» lleva el mapa a su municipio, y un evento abre su ficha.'),
    ],
  },
  {
    // LOS TEXTOS DEL MODO EXPLORAR, que no son los del recorrido y por eso viven aparte.
    //
    // Los del recorrido están escritos como una secuencia —«ahora mira esto», «a diferencia de la
    // anterior»— y fuera de su orden dejan de sostenerse. Además tres pasos del recorrido explican
    // el mismo control de dibujo, uno por modo: al señalarlo habría que elegir cuál de los tres y
    // ninguno responde a «¿qué es esto?». Son dos trabajos y llevan dos textos.
    id: 'map_explorar', label: 'Modo explorar del geovisor', section: 'Mapa ecosistémico', fields: [

      field('map_explorar_capas_2', 'Capas', 300, 'Qué tipo de proceso hay en el mapa: Festivales, Mercados, Redes y documentación, Lutería y Espacios para música en vivo. «General» los junta. La cifra es cuántos registros públicos tiene cada capa.'),
      field('map_explorar_filtros', 'Filtrar', 300, 'Acota lo que se ve: por nombre, por departamento o por municipio. Lo que pongas aparece como etiqueta y se quita de uno en uno.'),
      field('map_explorar_lente', 'El lente', 300, 'Con qué criterio se reparte el color: territorios sonoros, prácticas musicales o división administrativa. No filtra nada; cambia cómo se pinta lo mismo.'),
      field('map_explorar_dibujo', 'Cómo se dibuja', 300, 'Tres maneras de proyectar lo mismo: coropleta tiñe departamentos enteros, símbolos pone un círculo por municipio, y calor dibuja una mancha que ignora los límites.'),
      field('map_explorar_lienzo', 'El mapa', 300, 'Pulsa un departamento para entrar en él; pulsa un municipio para ver sus procesos. La rueda acerca y aleja.'),
      field('map_explorar_leyenda', 'Cómo leer esta vista', 300, 'Qué significan los colores y los tamaños del dibujo que esté puesto. Cambia con él, y se puede plegar.'),
      field('map_explorar_vistas', 'Mapa, gráfico o tabla', 300, 'Los mismos datos en tres presentaciones. El gráfico ordena y compara; la tabla sirve para recorrer la lista entera o imprimirla.'),
      field('map_explorar_lecturas', 'Las lecturas', 300, 'Siete maneras de leer el mismo conjunto. Cada posición dice su cifra y, al pulsarla, cambia lo que se dibuja debajo.'),
      field('map_explorar_dimension', 'La dimensión', 300, 'Sobre qué se mide la composición: territorios sonoros o prácticas y géneros. Son dos clasificaciones distintas del mismo conjunto.'),
      field('map_explorar_listado', 'Directorio y agenda', 300, 'El directorio lista lo que hay en el ámbito puesto; la agenda, lo que tiene fecha. Desde cualquier ficha se puede ubicar el proceso en el mapa.'),
    ],
  },
  {
    id: 'ejes_hero', label: 'Encabezado de la sección Ejes (en El Plan)', section: 'PNMC', fields: [
      // LOS CUATRO TEXTOS DE LA PORTADA DE /ejes, que hasta estaban
      // escritos a mano en `ejes-page.component.html:3-6` mientras la FOTO de esa misma portada
      // ya era administrable (`[bgImage]="imagen('hero_ejes')"`, linea 7). Se podia cambiar la
      // imagen del encabezado y no el titulo que va encima.
      //
      // Los valores son EXACTAMENTE los que la plantilla venia mostrando: declarar una clave con
      // otro texto cambia el sitio el dia que entra, y eso no es conectar, es editar.
      field('ejes_hero_tag', 'Antetítulo', 60, 'Ejes'),
      field('ejes_hero_title', 'Título', 80, 'Ejes de Transformación'),
      field('ejes_hero_desc', 'Descripción del encabezado', 300, 'Explora las dimensiones fundamentales del PNMC.'),
    ],
  },
  {
    id: 'eje1_details', label: 'Eje 1 - Música para la Vida', section: 'PNMC', fields: [
      field('eje01_title', 'Título del Eje', 200, 'MÚSICA PARA LA VIDA, EL DIÁLOGO INTERCULTURAL Y LA DIVERSIDAD BIOCULTURAL'),
      field('eje01_desc1', 'Explicación Párrafo 1', 500, 'Este eje promueve el acceso, la apropiación y la práctica musical como derechos culturales fundamentales, entendiendo la música y lo sonoro como bienes comunes que fortalecen identidades, cohesión social y equidad en el país.'),
      field('eje01_desc2', 'Explicación Párrafo 2', 500, 'Desde una perspectiva de diversidad cultural y biocultural, este eje impulsa procesos que reconocen la música como herramienta para el diálogo intercultural, la construcción de paz y la participación ciudadana.'),
      field('eje01_purpose', 'Propósito General', 400, 'Establecer la música como vehículo de inclusión, identidad y reconciliación, garantizando que todas las personas, sin distinción, puedan vivirla plenamente como parte de su vida, su territorio y su comunidad.'),
      field('eje01_c1_title', 'Comp 1: Título', 120, 'Apropiación de la música y de los derechos culturales'),
      field('eje01_c1_desc', 'Comp 1: Detalle', 400, 'Este componente busca fortalecer el vínculo de la ciudadanía con la música como derecho cultural y bien común. Promueve el acceso equitativo, la participación activa y el disfrute de la música en espacios comunitarios, educativos y culturales.'),
      field('eje01_c2_title', 'Comp 2: Título', 120, 'Enfoque poblacional y cultura de paz'),
      field('eje01_c2_desc', 'Comp 2: Detalle', 400, 'Promueve la inclusión de poblaciones históricamente excluidas en el ecosistema musical, reconociendo sus particularidades culturales y garantizando su acceso equitativo a procesos asociados a la música.'),
    ],
  },
  {
    id: 'eje2_details', label: 'Eje 2 - Prácticas y Oficios', section: 'PNMC', fields: [
      field('eje02_title', 'Título del Eje', 200, 'FORTALECIMIENTO DE LAS PRÁCTICAS, EXPRESIONES Y OFICIOS DE LA MÚSICA'),
      field('eje02_desc1', 'Explicación Párrafo 1', 500, 'Este eje busca fortalecer de manera integral el campo musical en Colombia, garantizando mejores condiciones para la formación, la creación, la producción, la investigación, la dotación y la circulación musical en el país.'),
      field('eje02_desc2', 'Explicación Párrafo 2', 500, 'Se destaca la importancia de la memoria, la identidad y la diversidad cultural como bases para la producción artística y para la construcción del presente y el futuro del sector musical.'),
      field('eje02_purpose', 'Propósito General', 400, 'Dignificar y reconocer profesionalmente los oficios y saberes vinculados a la música, promover la equidad de oportunidades y asegurar la sostenibilidad de las diversas expresiones sonoras del territorio.'),
      field('eje02_c1_title', 'Comp 1: Título', 120, 'Formación'),
      field('eje02_c1_desc', 'Comp 1: Detalle', 450, 'Este componente impulsa procesos de cualificación para músicos, sabedores, pedagogos, licenciados, formadores, investigadores, gestores y otros oficios del ecosistema musical. Busca consolidar la educación y formación musical como un pilar del desarrollo cultural y social del país, articulando acciones con el sistema educativo, el SINEFAC y las Escuelas Municipales y Comunitarias de Música.'),
      field('eje02_c2_title', 'Comp 2: Título', 120, 'Creación y producción'),
      field('eje02_c2_desc', 'Comp 2: Detalle', 400, 'Este componente fortalece las condiciones necesarias para la composición, interpretación, experimentación, grabación y producción musical en el país. Promueve estímulos, laboratorios y herramientas técnicas para desarrollar nuevas obras, integrar saberes tradicionales, potenciar la innovación y ampliar la diversidad sonora del territorio.'),
      field('eje02_c3_title', 'Comp 3: Título', 120, 'Circulación'),
      field('eje02_c3_desc', 'Comp 3: Detalle', 500, 'La circulación es un pilar fundamental para el fortalecimiento del ecosistema musical en Colombia, ya que permite la movilidad y visibilización de las músicas y los músicos en distintos escenarios locales, nacionales e internacionales. Este componente busca consolidar redes de colaboración, potenciar festivales y mercados musicales, e integrar a los artistas en diversos circuitos culturales, facilitando el acceso a oportunidades de difusión y profesionalización.'),
      field('eje02_c4_title', 'Comp 4: Título', 120, 'Memoria, investigación y documentación'),
      field('eje02_c4_desc', 'Comp 4: Detalle', 400, 'Este componente impulsa la preservación, investigación y difusión del patrimonio sonoro del país. Articula el conocimiento académico con los saberes comunitarios y ancestrales para documentar repertorios, prácticas y trayectorias musicales.'),
      field('eje02_c5_title', 'Comp 5: Título', 120, 'Información y comunicación'),
      field('eje02_c5_desc', 'Comp 5: Detalle', 500, 'El acceso a información clara, actualizada y estructurada es clave para la toma de decisiones y el diseño de políticas públicas pertinentes. Este componente fortalece la recopilación, sistematización y divulgación de datos del sector musical, promoviendo herramientas como el SIMUS y estrategias de comunicación que permitan a gestores, instituciones, investigadores y ciudadanía comprender y usar la información del ecosistema musical.'),
      field('eje02_c6_title', 'Comp 6: Título', 120, 'Dotación e infraestructura'),
      field('eje02_c6_desc', 'Comp 6: Detalle', 400, 'Este componente garantiza el acceso a instrumentos, herramientas técnicas y espacios adecuados para la formación, creación y circulación musical.'),
    ],
  },
  {
    id: 'eje3_details', label: 'Eje 3 - Gobernanza', section: 'PNMC', fields: [
      field('eje03_title', 'Título del Eje', 200, 'GOBERNANZA MUSICAL E INTEGRACIÓN CULTURAL E INTERSECTORIAL'),
      field('eje03_desc1', 'Explicación Párrafo 1', 500, 'Este eje promueve el fortalecimiento de los mecanismos de organización, participación y articulación del sector musical con y desde el Estado.'),
      field('eje03_desc2', 'Explicación Párrafo 2', 500, 'Consolidando una gobernanza efectiva que garantice la sostenibilidad cultural del ecosistema musical en Colombia.'),
      field('eje03_purpose', 'Propósito General', 400, 'Consolidar una gobernanza sólida y una articulación intersectorial amplia que potencie la capacidad de la música para incidir en la transformación social, la construcción de paz y la reducción de desigualdades.'),
      field('eje03_c1_title', 'Comp 1: Título', 120, 'Participación ciudadana, intersectorialidad y articulación territorial'),
      field('eje03_c1_desc', 'Comp 1: Detalle', 400, 'Este componente busca fortalecer la participación activa del sector musical en la formulación y ejecución de políticas públicas, promoviendo espacios de diálogo, concertación y decisión colectiva como los Comités Departamentales de Música y los Planes Departamentales de Desarrollo Musical.'),
      field('eje03_c2_title', 'Comp 2: Título', 120, 'Sostenibilidad, condiciones laborales y economías de la música'),
      field('eje03_c2_desc', 'Comp 2: Detalle', 450, 'Este componente se centra en mejorar las condiciones laborales y económicas de los actores del ecosistema musical, promoviendo la formalización, la seguridad social, la dignificación del trabajo y el fortalecimiento de capacidades en gestión, producción y emprendimiento.'),
    ],
  },
  {
    id: 'component_detail', label: 'Ficha de componente', section: 'PNMC', fields: [
      /*
        `/ejes/componentes/:id` no tenia ni una clave, y es la pagina donde termina cualquiera que
        pulse un componente en `/ejes`. Entran los dos bloques de relacionados —con su bajada, que
        es la que explica que hace ahi ese listado— y el mensaje de componente inexistente, que es
        lo que ve quien llega con un enlace viejo.

        NO entran los rotulos de navegacion —«Conoce el eje completo», «Explorar editorial»—: son
        destinos, y la regla del proyecto es que el CMS diga como se llama un boton y la
        configuracion adonde lleva.
      */
      field('component_products_title', 'Productos, título', 60, 'Productos relacionados'),
      field('component_products_desc', 'Productos, bajada', 200, 'Material del acervo editorial vinculado a este componente.'),
      field('component_agenda_title', 'Agenda, título', 60, 'Agenda relacionada'),
      field('component_agenda_desc', 'Agenda, bajada', 200, 'Eventos de la agenda vinculados a este componente.'),
      field('component_missing_title', 'Componente inexistente', 80, 'Componente no encontrado'),
    ],
  },
  {
    id: 'strategy_celebra_details', label: 'Celebra la Música', section: 'PNMC', fields: [
      field('strategy_celebra_hero_desc', 'Descripción Hero', 300, 'Una estrategia nacional que articula territorios, agentes e instituciones para visibilizar la diversidad sonora de Colombia.'),
      field('strategy_celebra_section_title', 'Título sección', 120, 'La celebración de la música'),
      field('strategy_celebra_intro', 'Introducción', 400, 'Como parte del Plan Nacional de Música para la Convivencia del Ministerio de las Culturas del Gobierno de Colombia, Celebra la Música busca que el sonido y la creatividad lleguen a todos los rincones del país, para que cada territorio haga oír su voz.'),
      field('strategy_celebra_mission', 'Misión', 500, 'Su propósito es conectar a artistas, comunidades e instituciones para fortalecer los procesos de formación, creación y circulación musical. Promueve la música como un derecho, un espacio de encuentro y una oportunidad para construir memoria, dignificar el trabajo artístico y enriquecer la vida cultural del país.'),
      field('strategy_celebra_edition_intro', 'Edición Intro', 500, 'En 2025, Celebra la Música se renueva para convertirse en un gran proceso nacional que promueve la circulación musical en el país y que no será solo una jornada conmemorativa, sino un movimiento que, durante 29 días, unirá a los 32 departamentos de Colombia en torno a la diversidad sonora.'),
      field('strategy_celebra_edition_vision', 'Edición Visión', 500, 'Esta edición se articula con el Plan Nacional de Cultura 2024-2038 y el Plan Nacional de Música para la Convivencia 2025-2035, impulsando espacios de formación, creación, circulación y memoria.'),
      field('strategy_celebra_edition_closing', 'Conclusión', 300, 'Celebra la Música 2025 es una apuesta por hacer de la música un camino para la convivencia, la paz y la vida.'),
    ],
  },
  {
    id: 'strategy_territorios_details', label: 'Territorios Sonoros', section: 'PNMC', fields: [
      /*
        LAS DOS QUE LA PAGINA MUESTRA, Y NI UNA MAS.

        Territorios Sonoros era la unica estrategia sin ninguna clave: `cmsPrefix: null` en
        `resolve-strategy.ts`. Eso dejaba su FOTO administrable sin ningun bloque del acordeon
        donde editarse, porque el editor de imagenes vive dentro del bloque de sus textos.

        Se declaran las dos que la pagina pinta hoy —la bajada del encabezado y el parrafo de
        entrada— con el texto que ya venia mostrando. NO se declara el relato de tres partes que
        si tiene Celebra la Musica: esa pagina no lo pinta, y escribirlo aqui seria inventar
        copia institucional para justificar unos campos. Cuando exista la copia, se anade el
        bloque y se pone `tieneRelato: true`.
      */
      field('strategy_territorios_hero_desc', 'Descripción Hero', 300, 'Una ruta para reconocer, documentar y fortalecer la diversidad musical desde los territorios de Colombia.'),
      field('strategy_territorios_intro', 'Introducción', 400, 'Territorios Sonoros conecta comunidades, investigadores, portadores de saberes e instituciones para comprender las prácticas musicales en su contexto y convertir ese conocimiento en acciones de política pública.'),
    ],
  },
  {
    /**
     * Portada de /registro: lo que lee una persona ANTES de entregar sus datos.
     *
     * La pagina tenia 119 cadenas fijas y cero cobertura del CMS. Aqui no se
     * declaran las 119: los rotulos de formulario y los mensajes de estado son
     * mecanica de la interfaz y llenarian el panel de ruido. Se declara la prosa
     * que un area de comunicaciones o juridica querria reescribir, y sobre todo
     * las dos frases de consentimiento.
     *
     * Que los consentimientos sean editables desde el panel puede sonar
     * arriesgado; lo arriesgado es lo contrario. Hoy corregir «Acepto la
     * politica de tratamiento de datos» exige un despliegue, y el panel ya tiene
     * borrador, publicacion, historial y roles: un gestor no puede publicar.
     * Es mas control del que habia, no menos.
     */
    id: 'access_external_portal', label: 'Portada de acceso externo', section: 'Registro', fields: [
      // El 1 de septiembre de 2026 la columna de marca paso a mostrar un mensaje distinto segun la
      // pestaña activa: estas tres claves quedaron para «Registrarse» -es el mensaje que ya existia
      // y que la dirección de producto confirmo que «puede quedar tal cual»- y las tres siguientes,
      // nuevas, son las de «Ingresar». Antes eran un solo bloque compartido por las dos pestañas.
      field('access_eyebrow', 'Rótulo superior · Registrarse', 40, 'Tu cuenta en SIMUS'),
      field('access_title', 'Título · Registrarse', 60, 'Haz parte del ecosistema'),
      field('access_intro', 'Presentación · Registrarse', 220, 'Crea tu cuenta, gestiona organizaciones y mantén actualizada la información del ecosistema musical.'),
      // Las siete claves de las dos tarjetas de eleccion —«Registro personal» y «Registrar una
      // organizacion»— se retiraron el 25 ago 2026 con las tarjetas: el alta dejo de ser una
      // eleccion entre dos caminos y paso a ser un formulario. Una clave que nadie lee es una
      // casilla que alguien va a editar creyendo que cambia algo.
      field('access_footer_note', 'Nota al pie', 200, 'Este es tu espacio para gestionar tus registros dentro del Sistema de Información de la Música: tu perfil, tus organizaciones y sus procesos.'),
    ],
  },
  /*
   * Ecosistema — la sección que no tenía pestaña.
   *
   * `/ecosistema` y sus directorios son la lectura pública del ecosistema
   * musical del PNMC y llevaban 0 claves: todo su texto vivía fijo en
   * plantillas y arreglos de TypeScript. Es la sección con más prosa
   * institucional del portal —qué reúne, para qué sirve, cómo se navega, cómo
   * se participa— y era la única que exigía un despliegue para corregir una
   * coma.
   *
   * Se llamaba «SIMUS» hasta que se aclaró que el Sistema de Información de la
   * Música es una plataforma EXTERNA (simus.mincultura.gov.co) y no un módulo
   * de este portal. Las claves conservan su forma y su orden; lo que cambió es
   * el prefijo (`simus_` → `ecosistema_`) y toda la copia que se presentaba
   * como si el sistema fuera nuestro. El renombrado de las filas ya sembradas
   * lo hace `RenombradoContenidoWeb` en el arranque del API, sin perder lo que
   * haya escrito una persona.
   *
   * Qué NO entra, y por qué: los once textos de «módulo en construcción» de
   * `/ecosistema/:section` se quedan fijos. Son copia transitoria —desaparecen
   * según cada módulo se publica— y meter veintidós campos de «está en
   * construcción» en el panel es ruido que estorba a quien busca lo editable de
   * verdad. Tampoco entran los rótulos de los botones de volver ni los estados
   * de carga: son mecánica de la interfaz.
   */
  {
    id: 'ecosistema_hero', label: 'Encabezado', section: 'Ecosistema', fields: [
      field('ecosistema_hero_tag', 'Antetítulo', 60, 'Ecosistema musical de Colombia'),
      field('ecosistema_hero_title', 'Título', 100, 'Ecosistema que conecta el territorio'),
      field('ecosistema_hero_desc', 'Descripción del encabezado', 300, 'Un espacio público para conocer, consultar y fortalecer la información sobre las músicas, sus procesos y quienes las hacen posibles en Colombia.'),
    ],
  },
  {
    id: 'ecosistema_about', label: 'Qué reúne', section: 'Ecosistema', fields: [
      field('ecosistema_about_tag', 'Qué reúne, antetítulo', 40, 'Consulta pública'),
      field('ecosistema_about_title', 'Qué reúne, título', 120, 'Una puerta de entrada al ecosistema musical.'),
      field('ecosistema_about_p1', 'Qué reúne, párrafo 1', 400, 'SIMUS, el Sistema de Información de la Música, registra, organiza, relaciona y actualiza información estructurada sobre el ecosistema musical colombiano. Reúne agentes, organizaciones, procesos, prácticas, territorios e infraestructuras para hacer visible la riqueza musical del país.'),
      field('ecosistema_about_p2', 'Qué reúne, párrafo 2', 400, 'Festivales, mercados, agenda y contenidos editoriales se conectan aquí para facilitar la consulta pública. El Mapa Ecosistémico ofrece una mirada territorial integral; los directorios especializados permiten profundizar en cada registro.'),
    ],
  },
  /*
   * AQUI ESTUVIERON LOS GRUPOS `ecosistema_simus_externo` (4 campos) y `ecosistema_routes`
   * (11 campos), retirados con las dos secciones que los pintaban.
   *
   * La direccion de producto elimino de /ecosistema la tarjeta que enlazaba a SIMUS y el bloque
   * morado «Consulta, participa y gestiona». Sin lector, esas 15 claves quedaban en el panel
   * como campos que se pueden editar y no cambian nada en ninguna pantalla, y `cms:huerfanas`
   * las habria reportado en cada ejecucion.
   *
   * EL ENLACE A SIMUS NO ERA EDITABLE Y SIGUE SIN SERLO: la URL vive en `ENLACES_EXTERNOS.simus`
   * y las rutas `/simus/*` de `app.routes.ts` siguen redirigiendo. Lo que se fue es la copia de
   * la tarjeta, no el destino.
   */
  {
    id: 'ecosistema_explore', label: 'Actualidad y conocimiento', section: 'Ecosistema', fields: [
      field('ecosistema_explore_tag', 'Actualidad y conocimiento - Antetítulo', 40, 'Actualidad y conocimiento'),
      field('ecosistema_explore_title', 'Actualidad y conocimiento - Título', 120, 'Sigue las músicas en movimiento'),
      field('ecosistema_explore_desc', 'Rutas de consulta - Introducción', 300, 'Consulta información disponible, conoce la actualidad musical o recorre las publicaciones del PNMC.'),
      field('ecosistema_explore_map_title', 'Consulta «Mapa» - Título', 60, 'Lee el territorio'),
      field('ecosistema_explore_map_desc', 'Consulta «Mapa» - Descripción', 200, 'Conecta las categorías y su presencia geográfica en el Mapa Ecosistémico.'),
      field('ecosistema_explore_editorial_title', 'Consulta «Editorial» - Título', 60, 'Consulta contenidos'),
      field('ecosistema_explore_editorial_desc', 'Consulta «Editorial» - Descripción', 200, 'Accede a publicaciones, documentos y recursos desde Editorial.'),
      field('ecosistema_explore_news_title', 'Consulta «Noticias» - Título', 60, 'Mantente al día'),
      field('ecosistema_explore_news_desc', 'Consulta «Noticias» - Descripción', 200, 'Conoce noticias y agenda de la actividad musical del país.'),
    ],
  },
  {
    id: 'ecosistema_map', label: 'Botón «Ver en el mapa»', section: 'Ecosistema', fields: [
      field('ecosistema_map_cta', 'Botón «Ver en el mapa»', 60, 'Ver en el mapa ecosistémico'),
    ],
  },
  {
    // EL GRUPO SE LLAMA COMO LO QUE ENCABEZA, y sus campos ya no repiten ese nombre. Cuando
    // tenia seis campos —tres de «Actores» y tres de «Procesos»— el prefijo distinguia un
    // bloque del otro. Al quedarse en tres, los tres empezaban por «Procesos - » delante del
    // titulo del formulario que ya dice «Procesos»: prefijo constante, que es justo lo que
    // `registro-de-textos-web.spec.ts` prohibe.
    id: 'ecosistema_categories', label: 'Directorios públicos', section: 'Ecosistema', fields: [
      field('ecosistema_processes_tag', 'Antetítulo', 40, 'Directorios públicos'),
      field('ecosistema_processes_title', 'Título', 120, 'Explora los registros'),
      field('ecosistema_processes_desc', 'Introducción', 300, 'Busca, filtra por territorio y consulta fichas individuales de los procesos disponibles.'),
    ],
  },
  {
    id: 'ecosistema_participate', label: 'Ayuda y tutoriales', section: 'Ecosistema', fields: [
      field('ecosistema_join_tag', 'Antetítulo', 60, 'Ayuda y tutoriales'),
      field('ecosistema_join_title', 'Título', 120, 'Acompañamiento para navegar'),
      field('ecosistema_join_desc', 'Texto', 400, 'Este espacio reunirá guías para registrarse, actualizar información, consultar el mapa y utilizar los filtros. Mientras se amplía, puedes revisar la ayuda o contactar al equipo del PNMC.'),
      field('ecosistema_join_cta', 'Botón', 60, 'Ver ayuda y tutoriales'),
    ],
  },
  {
    id: 'ecosistema_directorios', label: 'Textos del directorio', section: 'Festivales', fields: [
      field('ecosistema_festivals_title', 'Título del encabezado', 60, 'Festivales'),
      field('ecosistema_festivals_subtitle', 'Subtítulo', 100, 'Procesos de circulación y encuentro'),
      field('ecosistema_festivals_tag', 'Antetítulo', 40, 'Consulta pública'),
      field('ecosistema_festivals_heading', 'Título de la consulta', 120, 'Festivales musicales'),
      // `ecosistema_festivals_desc` se retiró: pintaba un párrafo bajo la
      // barra de herramientas que el repositorio de referencia no tiene, y la dirección de producto
      // pidió quitarlo.
      field('ecosistema_festivals_search_label', 'Rótulo del buscador', 80, 'Buscar Festival, territorio o práctica'),
      field('ecosistema_festivals_empty_title', 'Sin resultados, título', 80, 'No hay Festivales para esta consulta'),
      field('ecosistema_festivals_empty_desc', 'Sin resultados, texto', 200, 'Prueba con otro nombre, territorio o práctica musical.'),
    ],
  },
  /*
   * La página de error: cinco textos que solo lee quien ya se perdió.
   *
   * Entra al panel por la misma razón que el tutorial del mapa —su público es
   * el que más ayuda necesita— y por una propia: es la única página del sitio
   * cuyo texto puede volverse falso sin que nadie toque la página. Cuando una
   * sección se renombra o se retira, el 404 sigue diciendo lo de siempre, y
   * corregirlo pedía un despliegue. Acaba de pasar: `/simus` dejó de existir.
   */
  {
    id: 'agenda_filtros', label: 'Filtros de la agenda', section: 'Agenda', fields: [
      field('agenda_filter_search_title', 'Buscador - Título', 40, 'Buscador'),
      field('agenda_filter_search_label', 'Buscador - Rótulo del campo', 60, 'Buscar en la agenda'),
      field('agenda_filter_search_placeholder', 'Buscador - Texto de ayuda', 80, 'Nombre, lugar u organizador…'),
      field('agenda_filter_when_title', 'Fecha - Título del bloque', 40, 'Cuándo'),
      field('agenda_filter_date_exact', 'Fecha - Opción «Día»', 20, 'Día'),
      field('agenda_filter_date_month', 'Fecha - Opción «Mes»', 20, 'Mes'),
      field('agenda_filter_date_range', 'Fecha - Opción «Rango»', 20, 'Rango'),
      field('agenda_filter_day_label', 'Fecha - Rótulo del día', 40, 'Seleccionar día'),
      field('agenda_filter_year_label', 'Fecha - Rótulo del año', 30, 'Año'),
      field('agenda_filter_month_label', 'Fecha - Rótulo del mes', 30, 'Mes'),
      field('agenda_filter_from_label', 'Fecha - Rótulo «Desde»', 30, 'Desde'),
      field('agenda_filter_to_label', 'Fecha - Rótulo «Hasta»', 30, 'Hasta'),
      field('agenda_filter_range_hint', 'Fecha - Aclaración del rango', 160, 'Se muestran los eventos que ocurren durante el tramo, aunque empiecen antes.'),
      field('agenda_filter_activity_type', 'Tipo de actividad - Título del bloque', 40, 'Tipo de actividad'),
      field('agenda_filter_project_title', 'Hashtag - Título del bloque', 40, 'Hashtag'),
      field('agenda_filter_where_title', 'Lugar - Título del bloque', 40, 'Dónde'),
      field('agenda_filter_department_label', 'Lugar - Rótulo del departamento', 40, 'Departamento'),
      field('agenda_filter_all_departments', 'Lugar - Opción «todos los departamentos»', 60, 'Todos los departamentos'),
      field('agenda_filter_city_label', 'Lugar - Rótulo del municipio', 40, 'Ciudad o municipio'),
      field('agenda_filter_city_select_dept', 'Lugar - Municipio sin departamento', 80, 'Elige primero un departamento'),
      field('agenda_filter_city_all_mun', 'Lugar - Opción «todos los municipios»', 60, 'Todos los municipios'),
      field('agenda_filter_city_no_mun', 'Lugar - Departamento sin municipios', 80, 'Sin municipios disponibles'),
    ],
  },
  {
    id: 'agenda_listado', label: 'Listado de eventos', section: 'Agenda', fields: [
      field('agenda_events_title', 'Listado - Título', 40, 'Eventos'),
      field('agenda_loading_title', 'Listado - Mensaje de carga', 60, 'Cargando agenda…'),
      field('agenda_empty_title', 'Sin resultados - Título', 100, 'No hay eventos programados para este filtro'),
      field('agenda_empty_desc', 'Sin resultados - Mensaje', 200, 'Prueba con otro criterio o vuelve más tarde.'),
      field('agenda_empty_desc_proximos', 'Sin resultados - Mensaje de próximos', 260, 'No hay eventos próximos con estos filtros. Elige un mes, un año o un tramo de fechas para ver los ya realizados.'),
    ],
  },
  {
    id: 'general_404', label: 'Página no encontrada (error 404)', section: 'Barra y pie', fields: [
      field('notfound_eyebrow', 'Rótulo superior', 40, 'Error 404'),
      field('notfound_title', 'Título', 60, 'Página no encontrada'),
      field('notfound_desc', 'Explicación', 300, 'La página que buscas no existe o fue movida. Verifica la dirección o vuelve al inicio para seguir explorando el Plan Nacional de Música para la Convivencia.'),
      field('notfound_cta_home', 'Botón al inicio', 40, 'Volver al inicio'),
      field('notfound_cta_map', 'Botón al mapa', 40, 'Ir al mapa ecosistémico'),
    ],
  },
  {
    id: 'general_nav_footer', label: 'Enlaces y Contacto', section: 'Barra y pie', fields: [
      // «Sobre el PNMC» y «Ejes» se reunieron en una sola entrada, «PNMC». `nav_ejes` salió con
      // el enlace: no queda nada en el menú que lo lea.
      field('nav_home', 'Menú - Inicio', 40, 'Inicio'),
      field('nav_noticias', 'Menú - Noticias', 40, 'Noticias'),
      field('nav_agenda', 'Menú - Agenda', 40, 'Agenda'),
      field('nav_editorial', 'Menú - Editorial', 40, 'Editorial'),
      field('nav_galeria', 'Menú - Galería', 40, 'Galería'),
      field('nav_pnmc', 'Menú - PNMC', 40, 'PNMC'),
      // Se llamó `nav_mapa` mientras el enlace del menú tenía el identificador
      // del mapa. Renombrarla a `nav_ecosistema` es lo que hace que el editor
      // que quiera cambiar cómo se llama «Ecosistema» esté cambiando eso y no
      // el rótulo de otra página. La vieja se retira en el arranque.
      field('nav_ecosistema', 'Menú - Ecosistema', 40, 'Ecosistema'),
      field('nav_components_title', 'Menú - Título de componentes', 60, 'Componentes del eje'),
      field('footer_col2_title', 'Footer - Col 2 Título (Ministerio)', 120, 'Ministerio de las Culturas, las Artes y los Saberes'),
      field('footer_col2_address', 'Footer - Col 2 Dirección', 120, 'Dirección: Calle 9 No. 8 - 31 Bogotá'),
      field('footer_col2_schedule', 'Footer - Col 2 Horario', 150, 'Horario de atención: 8:00 a.m. a 5:00 p.m. jornada continua.'),
      field('footer_col2_phone', 'Footer - Col 2 Teléfono', 60, 'Teléfono: +57 (601) 3424100'),
      field('footer_col2_free_line', 'Footer - Col 2 Línea Gratuita', 60, 'Línea gratuita: 018000 938081'),
      field('footer_col3_title', 'Footer - Col 3 Título (Correspondencia)', 120, 'Contacto Correspondencia'),
      field('footer_col3_address', 'Footer - Col 3 Dirección', 120, 'Dirección: Calle 9 No. 8 - 31 Bogotá'),
      field('footer_col3_schedule', 'Footer - Col 3 Horario', 150, 'Lunes a viernes de 8:00 a.m. a 4:00 p.m. jornada continua'),
      field('footer_col3_email_label', 'Footer - Col 3 Etiqueta Correo', 30, 'Correo:'),
      field('footer_col3_email', 'Footer - Col 3 Correo Servicio', 80, 'servicioalciudadano@mincultura.gov.co'),
      field('footer_col3_email_note', 'Footer - Col 3 Correo Aviso', 150, '(Los correos que se reciban después de las 5:00 p. m., se radicarán el siguiente día hábil)'),
      field('footer_col3_corruption_title', 'Footer - Denuncias Corrupción', 100, 'Registro de denuncias de corrupción:'),
      field('footer_col3_corruption_email', 'Footer - Denuncias Correo', 80, 'soytransparente@mincultura.gov.co'),
      field('footer_col3_legal_title', 'Footer - Notificaciones Título', 100, 'Notificaciones judiciales:'),
      field('footer_col3_legal_email', 'Footer - Notificaciones Correo', 80, 'notificaciones@mincultura.gov.co'),
      field('footer_col4_services_title', 'Footer - Col 4 Servicios Título', 80, 'Servicios a la Ciudadanía'),
      field('footer_col4_about_title', 'Footer - Col 4 Acerca Título', 80, 'Acerca del sitio'),
      // Solo el prefijo. La plantilla añade el año —que se calcula, para que en
      // enero no haya que acordarse— y el nombre del Ministerio. El texto de
      // fábrica llevaba la línea entera, así que el pie renderizaba «Copyright ©
      // 2026 Ministerio de las Culturas 2026 Ministerio de las Culturas» en
      // todas las páginas del portal. La instantánea lo tenía grabado como
      // normal desde que existe la puerta.
      field('footer_credits_text', 'Footer - Créditos Copyright', 120, 'Copyright ©'),
      field('footer_credits_tagline', 'Footer - Lema Institucional', 100, 'Colombia - Potencia de la Vida'),
    ],
  },
  {
    id: 'boletin_baja', label: 'Página de baja del boletín', section: 'Boletín', fields: [
      field('boletin_etiqueta', 'Etiqueta superior de las páginas del boletín', 60, 'Boletín del SIMUS'),
      field('boletin_baja_cargando_titulo', 'Baja · Revisando el enlace (título)', 60, 'Revisando tu enlace…'),
      field('boletin_baja_cargando_texto', 'Baja · Revisando el enlace (texto)', 80, 'Un momento, estamos buscando tu suscripción.'),
      field('boletin_baja_titulo', 'Baja · Pregunta de confirmación (título)', 60, '¿Quieres darte de baja del boletín?'),
      field('boletin_baja_texto', 'Baja · Texto tras el correo (confirmación)', 280, 'dejará de recibir el boletín del Sistema de Información de la Música (SIMUS) y retiraremos tu autorización de tratamiento de datos. Puedes volver a suscribirte cuando quieras.'),
      field('boletin_baja_mantener', 'Baja · Botón «Mantener mi suscripción»', 60, 'Mantener mi suscripción'),
      field('boletin_baja_hecha_texto', 'Baja hecha · Texto tras el correo', 260, 'ya no recibirá el boletín del SIMUS y retiramos tu autorización de tratamiento de datos. Si fue un error, puedes volver a suscribirte desde el inicio del portal.'),
      field('boletin_baja_resuscribir', 'Baja hecha · Botón «Volver a suscribirte»', 60, 'Volver a suscribirte'),
      field('boletin_volver_inicio', 'Botón «Volver al inicio» (boletín)', 60, 'Volver al inicio'),
      field('boletin_baja_fallo_titulo', 'Baja · Falla (título)', 60, 'No pudimos completar la baja'),
      field('boletin_reintentar', 'Botón «Reintentar» (boletín)', 60, 'Reintentar'),
      field('boletin_enlace_invalido_titulo', 'Enlace inválido · Título', 60, 'Enlace inválido'),
      field('boletin_baja_invalido_texto', 'Baja · Enlace inválido (texto)', 140, 'Este enlace de baja no es válido o está incompleto. Ábrelo tal como llegó a tu correo.'),
      field('boletin_baja_invalido_ayuda', 'Baja · Enlace inválido (qué hacer)', 160, 'Si no logras darte de baja, escríbenos por los canales del Ministerio y retiraremos tu autorización.'),
      field('boletin_baja_ya_titulo', 'Baja hecha · Ya estaba dado de baja (título)', 60, 'Ya estabas dado de baja'),
      field('boletin_baja_hecha_titulo', 'Baja hecha · Título', 60, 'Listo: te diste de baja'),
      field('boletin_baja_boton', 'Baja · Botón «Darme de baja»', 60, 'Darme de baja'),
      field('boletin_baja_boton_trabajando', 'Baja · Botón mientras trabaja', 60, 'Dándote de baja…'),
    ],
  },
  {
    id: 'boletin_confirmar', label: 'Página de confirmación de la suscripción', section: 'Boletín', fields: [
      field('boletin_confirmar_listo_titulo', 'Confirmada · Título', 60, 'Suscripción confirmada'),
      field('boletin_confirmar_listo_texto', 'Confirmada · Texto', 300, 'Gracias: desde ahora recibirás el boletín del Sistema de Información de la Música (SIMUS) en este correo: noticias, agenda de eventos, convocatorias y crónicas de los territorios. Puedes retirar tu autorización cuando quieras.'),
      field('boletin_confirmar_trabajando_titulo', 'Confirmando · Título', 60, 'Confirmando tu suscripción…'),
      field('boletin_confirmar_trabajando_texto', 'Confirmando · Texto', 80, 'Un momento, estamos registrando tu autorización.'),
      field('boletin_confirmar_vencido', 'Falla · Si el enlace venció', 150, 'Si el enlace venció, vuelve a suscribirte desde el inicio del portal y recibirás uno nuevo.'),
      field('boletin_confirmar_pendiente_titulo', 'Pendiente · Título', 60, 'Confirma tu suscripción'),
      field('boletin_confirmar_pendiente_texto', 'Pendiente · Texto', 310, 'Alguien pidió recibir el boletín del Sistema de Información de la Música (SIMUS) en tu correo. Si fuiste tú, confirma la suscripción y, con ella, tu autorización de tratamiento de datos. Si no fuiste tú, no hagas nada: no se activará.'),
      field('boletin_confirmar_boton', 'Pendiente · Botón «Confirmar mi suscripción»', 60, 'Confirmar mi suscripción'),
      field('boletin_confirmar_fallo_titulo', 'Falla · Título', 60, 'No pudimos confirmar tu suscripción'),
    ],
  },
  {
    id: 'ecosistema_lecturas', label: 'Lecturas del país musical (prácticas y territorios)', section: 'Ecosistema', fields: [
      field('ecosistema_lecturas_practicas_titulo', 'Prácticas · Título de la tarjeta', 60, 'Prácticas musicales'),
      field('ecosistema_lecturas_practicas_desc', 'Prácticas · Descripción', 220, 'Una práctica puede aparecer en distintos procesos y territorios, y permite consultar los registros asociados sin perder el contexto.'),
      field('ecosistema_lecturas_practicas_boton', 'Prácticas · Botón', 60, 'Conocer Prácticas musicales'),
      field('ecosistema_lecturas_territorios_titulo', 'Territorios · Título de la tarjeta', 60, 'Territorios sonoros'),
      field('ecosistema_lecturas_territorios_desc', 'Territorios · Descripción', 230, 'Los territorios sonoros conectan comprensión, identificación y exploración de las músicas más allá de la división político-administrativa.'),
      field('ecosistema_lecturas_territorios_boton', 'Territorios · Botón', 60, 'Conocer Territorios sonoros'),
      field('ecosistema_lecturas_tag', 'Lecturas · Etiqueta', 60, 'Lecturas del país musical'),
      field('ecosistema_lecturas_titulo', 'Lecturas · Título', 60, 'Prácticas y territorios'),
      field('ecosistema_lecturas_desc', 'Lecturas · Descripción', 240, 'Además de los procesos, SIMUS permite leer el país musical de manera transversal: qué músicas se practican y en qué territorios sonoros se relacionan.'),
    ],
  },
  {
    id: 'ecosistema_personas_tarjeta', label: 'Directorio de agentes y actores (tarjeta del Ecosistema)', section: 'Ecosistema', fields: [
      field('ecosistema_personas_desc', 'Directorio de agentes · Descripción', 310, 'Recorre el directorio de agentes y actores de la música: docentes, intérpretes, lutieres, productores, gestores e investigadores con perfil público, por rol, servicio, instrumento y territorio.'),
      field('ecosistema_personas_boton', 'Directorio de agentes · Botón', 60, 'Explorar el directorio'),
      field('ecosistema_personas_tag', 'Directorio de agentes · Etiqueta', 60, 'Personas del ecosistema'),
      field('ecosistema_personas_titulo', 'Directorio de agentes · Título', 60, 'Directorio de agentes y actores'),
    ],
  },
  {
    id: 'territorios_pagina', label: 'Catálogo público de territorios sonoros', section: 'Territorios sonoros', fields: [
      field('dir_comun_miga_ecosistema', 'Directorios · Migas «Ecosistema»', 60, 'Ecosistema'),
      field('territorios_titulo', 'Título de la página', 60, 'Territorios sonoros'),
      field('territorios_subtitulo', 'Subtítulo de la página', 80, 'Una lectura cultural del ecosistema musical.'),
      field('territorios_marco_etiqueta', 'Marco conceptual · Etiqueta', 60, 'Marco conceptual'),
      field('territorios_marco_titulo', 'Marco conceptual · Título', 60, '¿Qué son los Territorios sonoros?'),
      field('territorios_marco_p1', 'Marco conceptual · Párrafo 1', 340, 'Son una forma de lectura del país musical que permite reconocer configuraciones culturales y musicales compartidas. No reemplazan los territorios geográficos: los atraviesan y los relacionan con prácticas, memorias, contextos sociales y formas de hacer música.'),
      field('territorios_marco_p2', 'Marco conceptual · Párrafo 2', 150, 'En SIMUS sirven para comprender y explorar procesos del ecosistema desde esas relaciones.'),
      field('territorios_definicion_etiqueta', 'Tarjeta · Etiqueta «Definición preliminar»', 60, 'Definición preliminar'),
      field('territorios_ver_ficha', 'Tarjeta · Botón «Conocer territorio»', 60, 'Conocer territorio'),
      field('territorios_cargando', 'Mensaje de carga', 60, 'Cargando territorios sonoros…'),
    ],
  },
  {
    id: 'territorios_ficha', label: 'Ficha de un territorio sonoro', section: 'Territorios sonoros', fields: [
      field('territorios_ficha_subtitulo', 'Subtítulo de la ficha', 60, 'Ficha conceptual'),
      field('territorios_ficha_relacion', 'Ficha · Relación territorial documentada', 60, 'Relación territorial documentada'),
      field('territorios_ficha_caracteristicas', 'Ficha · Características', 60, 'Características'),
      field('territorios_ficha_contextos', 'Ficha · Contextos', 60, 'Contextos'),
      field('territorios_ficha_ejemplos', 'Ficha · Ejemplos', 60, 'Ejemplos'),
      field('territorios_ficha_fuente', 'Ficha · Rótulo «Fuente:»', 60, 'Fuente:'),
      field('territorios_ficha_festivales', 'Ficha · Botón de festivales relacionados', 60, 'Explorar Festivales relacionados'),
      field('territorios_ficha_no_encontrada', 'Ficha no encontrada', 240, 'No encontramos esta ficha. Puede que se haya movido o que la dirección esté incompleta. Vuelve al listado de territorios sonoros y búscala allí.'),
      field('territorios_ficha_cargando', 'Ficha · Mensaje de carga', 60, 'Cargando la ficha conceptual…'),
    ],
  },
  {
    id: 'practicas_pagina', label: 'Catálogo público de prácticas musicales', section: 'Prácticas musicales', fields: [
      field('practicas_titulo', 'Título de la página', 60, 'Prácticas musicales'),
      field('practicas_subtitulo', 'Subtítulo de la página', 70, 'Una lectura transversal del país musical.'),
      field('practicas_marco_titulo', 'Marco conceptual · Título', 60, 'Prácticas para comprender y explorar'),
      field('practicas_marco_texto', 'Marco conceptual · Texto', 320, 'Las Prácticas musicales permiten reconocer formas de creación, transmisión, participación y circulación que atraviesan distintos procesos y territorios. En SIMUS conectan la comprensión conceptual con la exploración de registros asociados.'),
      field('practicas_ver_ficha', 'Tarjeta · Botón «Conocer práctica»', 60, 'Conocer práctica'),
      field('practicas_cargando', 'Mensaje de carga', 60, 'Cargando prácticas musicales…'),
    ],
  },
  {
    id: 'personas_directorio', label: 'Directorio de agentes y actores', section: 'Agentes y actores', fields: [
      field('personas_titulo', 'Título de la página', 80, 'Directorio de agentes y actores de la música'),
      field('personas_subtitulo', 'Subtítulo de la página', 220, 'Las personas que hacen la música en Colombia: docentes, intérpretes, lutieres, productores, gestores e investigadores con perfil público'),
      field('personas_buscar_marcador', 'Buscador · Texto de ayuda', 60, 'Nombre, rol, instrumento o lugar'),
      field('personas_buscar_etiqueta', 'Buscador · Rótulo', 60, 'Buscar en el directorio'),
      field('personas_filtros_ayuda', 'Filtros · Ayuda', 160, 'Las opciones dicen cuántas personas hay con cada una. Solo aparecen quienes publicaron su perfil.'),
      field('personas_cifra_rotulo', 'Cifra · Rótulo', 60, 'Personas con perfil público'),
      field('personas_vacio_titulo', 'Directorio vacío · Título', 70, 'Todavía no hay personas en el directorio'),
      field('personas_vacio_texto', 'Directorio vacío · Texto', 130, 'Aparecen aquí quienes publican su perfil con su consentimiento. Vuelve pronto.'),
      field('personas_sin_resultados', 'Sin resultados · Título', 70, 'Ninguna persona coincide con tu búsqueda'),
      field('personas_cargando', 'Mensaje de carga', 60, 'Cargando el directorio…'),
    ],
  },
  {
    id: 'personas_perfil', label: 'Perfil público de una persona', section: 'Agentes y actores', fields: [
      field('perfil_subtitulo', 'Subtítulo del perfil', 110, 'Perfil público en el directorio de agentes y actores de la música'),
      field('personas_titulo_corto', 'Migas · «Directorio de agentes y actores»', 60, 'Directorio de agentes y actores'),
      field('perfil_biografia', 'Apartado «Biografía»', 60, 'Biografía'),
      field('perfil_oficios', 'Apartado «Oficios»', 60, 'Oficios'),
      field('perfil_practicas', 'Apartado «Prácticas musicales»', 60, 'Prácticas musicales'),
      field('perfil_organizaciones', 'Apartado «Organizaciones en las que participa»', 60, 'Organizaciones en las que participa'),
      field('perfil_portafolio', 'Apartado «Portafolio»', 60, 'Portafolio'),
      field('perfil_enlaces', 'Apartado «Enlaces»', 60, 'Enlaces'),
      field('perfil_no_disponible', 'Perfil no disponible · Título', 60, 'Este perfil no está disponible'),
      field('perfil_cargando', 'Mensaje de carga', 60, 'Cargando el perfil…'),
    ],
  },
  {
    id: 'citas_publica', label: 'Agenda de citas de los Mercados', section: 'Agenda de citas', fields: [
      field('citas_miga', 'Migas · «Mercados musicales»', 60, 'Mercados musicales'),
      field('citas_titulo', 'Título de la página', 60, 'Agenda de citas'),
      field('citas_intro', 'Introducción', 420, 'En algunos Mercados, artistas y compradores o bookers se reúnen en citas cortas. Aquí ves qué Mercados tienen abierta su agenda. Inscribirte no garantiza una cita: depende de quien confirme. La agenda es una herramienta de cada Mercado: te inscribes con tu cuenta y trabajas en ella a pantalla completa, con su calendario.'),
      field('citas_cargando', 'Mensaje de carga', 60, 'Consultando las agendas…'),
      field('citas_vacio_titulo', 'Sin agendas abiertas · Título', 100, 'Por ahora ningún Mercado tiene abierta su agenda de citas'),
      field('citas_vacio_texto', 'Sin agendas abiertas · Texto', 60, 'Cuando uno la abra, aparecerá aquí.'),
    ],
  },
  {
    id: 'celebra_micrositio', label: 'Textos fijos del micrositio', section: 'Celebra la Música', fields: [
      field('celebra_cargando', 'Mensaje de carga', 60, 'Cargando Celebra la música…'),
      field('celebra_error_titulo', 'Error de carga · Título', 60, 'No pudimos cargar Celebra la música'),
      field('celebra_no_disponible_titulo', 'Edición no disponible · Título', 60, 'Esta edición no está disponible'),
      field('celebra_no_disponible_texto', 'Edición no disponible · Texto', 230, 'No existe o todavía no se ha publicado. Puedes ver las ediciones publicadas desde el selector de ediciones o volver a las estrategias del PNMC.'),
      field('celebra_volver', 'Enlace «Volver a las estrategias del PNMC»', 60, 'Volver a las estrategias del PNMC'),
      field('celebra_reintentar', 'Botón «Reintentar»', 60, 'Reintentar'),
      field('celebra_ver_destacados', 'Botón «Ver eventos destacados»', 60, 'Ver eventos destacados'),
      field('celebra_herramientas_titulo', 'Sección · Caja de herramientas', 60, 'Caja de herramientas'),
      field('celebra_que_es_etiqueta', 'Sección · «Qué es» (etiqueta)', 60, 'Qué es'),
      field('celebra_celebracion_titulo', 'Sección · La celebración', 60, 'La celebración'),
      field('celebra_categorias_titulo', 'Sección · Categorías', 60, 'Categorías'),
      field('celebra_programacion_etiqueta', 'Programación · Etiqueta', 60, 'Lo que no te puedes perder'),
      field('celebra_programacion_titulo', 'Programación · Título', 60, 'Eventos destacados'),
      field('celebra_programacion_cargando', 'Programación · Mensaje de carga', 60, 'Cargando la programación…'),
      field('celebra_programacion_error', 'Programación · Error', 60, 'No pudimos cargar la programación'),
      field('celebra_programacion_vacia_titulo', 'Programación vacía · Título', 90, 'Todavía no hay actividades etiquetadas en esta edición'),
      field('celebra_programacion_vacia_texto', 'Programación vacía · Texto', 90, 'Pronto publicaremos las actividades de esta edición.'),
      field('celebra_herramientas_etiqueta', 'Herramientas · Etiqueta', 60, 'Para sumarte'),
      field('celebra_documentos_vacio_titulo', 'Sin documentos · Título', 60, 'Esta edición no tiene documentos'),
      field('celebra_documentos_vacio_texto', 'Sin documentos · Texto', 100, 'Pronto podrás descargar guías, piezas gráficas y documentos.'),
      field('celebra_faq_etiqueta', 'Preguntas frecuentes · Etiqueta', 60, 'Resolvemos tus dudas'),
      field('celebra_faq_titulo', 'Preguntas frecuentes · Título', 60, 'Preguntas frecuentes'),
      field('celebra_faq_vacio', 'Sin preguntas frecuentes', 70, 'Esta edición no tiene preguntas frecuentes'),
      field('celebra_noticias_etiqueta', 'Noticias · Etiqueta', 60, 'Mantente al día'),
      field('celebra_noticias_titulo', 'Noticias · Título', 60, 'Noticias'),
      field('celebra_noticias_todas', 'Noticias · Enlace «Todas las noticias»', 60, 'Todas las noticias'),
      field('celebra_noticias_cargando', 'Noticias · Mensaje de carga', 60, 'Cargando las noticias…'),
      field('celebra_noticias_error', 'Noticias · Error', 60, 'No pudimos cargar las noticias'),
      field('celebra_noticias_vacio_titulo', 'Sin noticias · Título', 70, 'Todavía no hay noticias de esta edición'),
      field('celebra_noticias_vacio_texto', 'Sin noticias · Texto', 80, 'Pronto publicaremos las noticias de esta edición.'),
      field('celebra_galeria_etiqueta', 'Galería · Etiqueta', 60, 'Piezas y momentos'),
      field('celebra_galeria_titulo', 'Galería · Título', 60, 'Galería'),
      field('celebra_galeria_vacio', 'Galería vacía', 70, 'Esta edición todavía no tiene imágenes'),
      field('celebra_ediciones_etiqueta', 'Ediciones · Etiqueta', 60, 'Explora Celebra la Música'),
      field('celebra_ediciones_titulo', 'Ediciones · Título', 60, 'Todas las ediciones'),
      field('celebra_ediciones_texto', 'Ediciones · Texto', 180, 'Cada año Celebra la música tiene su propia edición, con su programación, sus piezas y su caja de herramientas.'),
      field('celebra_aliados_titulo', 'Aliados · Título', 60, 'Aliados'),
      field('celebra_aliados_vacio', 'Sin aliados', 80, 'Esta edición todavía no tiene aliados registrados.'),
    ],
  },
  {
    id: 'galeria_textos', label: 'Textos fijos de la Galería', section: 'Galería', fields: [
      field('galeria_etiqueta', 'Encabezado · Etiqueta', 60, 'Archivo visual'),
      field('galeria_titulo', 'Encabezado · Título', 60, 'Galería'),
      field('galeria_descripcion', 'Encabezado · Descripción', 150, 'Registro visual de procesos, territorios y actividades del PNMC: álbumes, fotos y videos.'),
      field('galeria_error_etiqueta', 'Error · Etiqueta', 60, 'No se pudo cargar'),
      field('galeria_error_titulo', 'Error · Título', 60, 'No pudimos leer la Galería'),
      field('galeria_reintentar', 'Botón «Reintentar»', 60, 'Reintentar'),
      field('galeria_vacia_etiqueta', 'Galería vacía · Etiqueta', 60, 'Sin contenido'),
      field('galeria_vacia_titulo', 'Galería vacía · Título', 60, 'Aún no hay contenido visual publicado'),
      field('galeria_vacia_texto', 'Galería vacía · Texto', 120, 'Cuando el PNMC publique álbumes de fotos o de videos aparecerán aquí.'),
      field('galeria_album_no_encontrado', 'Álbum no encontrado · Título', 60, 'No encontramos este álbum'),
      field('galeria_album_no_encontrado_texto', 'Álbum no encontrado · Texto', 120, 'Puede que el enlace esté incompleto o que el álbum ya no esté publicado.'),
      field('galeria_ver_albumes', 'Botón «Ver todos los álbumes»', 60, 'Ver todos los álbumes'),
      field('galeria_copiar_enlace', 'Botón «Copiar enlace al álbum»', 60, 'Copiar enlace al álbum'),
      field('galeria_ver_youtube', 'Enlace «Ver la lista en YouTube»', 60, 'Ver la lista en YouTube'),
      field('galeria_album_vacio', 'Álbum sin contenido', 60, 'Este álbum aún no tiene contenido.'),
      field('galeria_destacados', 'Etiqueta «Destacados»', 60, 'Destacados'),
      field('galeria_ver_album', 'Botón «Ver álbum»', 60, 'Ver álbum'),
      field('galeria_sin_fotos', 'Sin fotos', 60, 'Aún no hay fotos publicadas.'),
      field('galeria_ver_sin_album', 'Enlace «Ver todos los archivos sin álbum»', 60, 'Ver todos los archivos sin álbum'),
      field('galeria_mas_fotos', 'Botón «Mostrar más fotos»', 60, 'Mostrar más fotos'),
      field('galeria_sin_videos', 'Sin videos', 60, 'Aún no hay videos publicados.'),
      field('galeria_sin_album_titulo', 'Pestaña «Sin álbum» · Título', 60, 'Sin álbum'),
      field('galeria_sin_album_texto', 'Pestaña «Sin álbum» · Descripción', 100, 'Fotos y videos publicados que no pertenecen a ningún álbum.'),
      field('galeria_sin_sueltos', 'Sin archivos sueltos', 60, 'No hay archivos sueltos publicados.'),
      field('galeria_mostrar_mas', 'Botón «Mostrar más»', 60, 'Mostrar más'),
    ],
  },
  {
    id: 'noticias_textos', label: 'Textos fijos del portal de noticias', section: 'Noticias', fields: [
      field('noticias_titulo', 'Título de la página', 60, 'Noticias'),
      field('noticias_cargando', 'Mensaje de carga', 60, 'Cargando las noticias…'),
      field('noticias_error', 'Error de carga', 70, 'No logramos cargar el portal de noticias'),
      field('noticias_vacio_titulo', 'Sin noticias · Título', 60, 'Archivo de actualidad vacío'),
      field('noticias_vacio_texto', 'Sin noticias · Texto', 100, 'Vuelve pronto para consultar las nuevas crónicas del PNMC.'),
      field('noticias_filtro_etiqueta', 'Filtro por etiqueta · Rótulo', 60, 'Etiqueta'),
      field('noticias_filtro_etiqueta_texto', 'Filtro por etiqueta · Descripción', 130, 'Las noticias publicadas con esta etiqueta, de la más reciente a la más antigua.'),
      field('noticias_foco', 'Sección · «Foco informativo»', 60, 'Foco informativo'),
      field('noticias_destacadas', 'Sección · «Narrativas destacadas»', 60, 'Narrativas destacadas'),
      field('noticias_leer_completa', 'Enlace «Leer historia completa»', 60, 'Leer historia completa'),
      field('noticias_leer_mas', 'Enlace «Leer más»', 60, 'Leer más'),
      field('noticias_limpiar_filtros', 'Botón «Limpiar filtros»', 60, 'Limpiar filtros'),
      field('noticias_filtrar_categoria', 'Rótulo del filtro por categoría', 60, 'Filtrar las noticias por categoría'),
      field('noticias_buscar_etiqueta', 'Buscador · Rótulo', 60, 'Buscar noticias por título o tema'),
      field('noticias_buscar_marcador', 'Buscador · Texto de ayuda', 60, 'Buscar por título o tema'),
      field('noticias_ordenar', 'Rótulo de «Ordenar»', 60, 'Ordenar las noticias'),
      field('noticias_sin_resultados_titulo', 'Sin resultados · Título', 70, 'Ninguna noticia coincide con tus filtros'),
      field('noticias_sin_resultados_texto', 'Sin resultados · Texto', 130, 'Prueba con otro término o quita algún filtro para seguir explorando el archivo.'),
      field('noticias_boletin_etiqueta', 'Tarjeta del boletín · Etiqueta', 60, 'Boletín'),
      field('noticias_boletin_titulo', 'Tarjeta del boletín · Título', 60, 'Únete al ecosistema'),
      field('noticias_boletin_texto', 'Tarjeta del boletín · Texto', 200, 'Recibe el boletín del Sistema de Información de la Música (SIMUS): convocatorias, crónicas y novedades de los territorios.'),
      field('noticias_boletin_boton', 'Tarjeta del boletín · Botón', 60, 'Registrarme'),
      field('noticias_boletin_ok_titulo', 'Tarjeta del boletín · Suscrito (título)', 60, '¡Suscrito!'),
      field('noticias_boletin_ok_texto', 'Tarjeta del boletín · Suscrito (texto)', 80, 'Pronto recibirás nuestras novedades sonoras.'),
      field('noticias_boletin_privacidad', 'Tarjeta del boletín · Nota de privacidad', 70, 'No compartiremos tu dirección con terceros.'),
      field('noticias_redes_titulo', 'Tarjeta del boletín · «Sigue nuestras redes»', 60, 'Sigue nuestras redes'),
      field('noticias_boletin_marcador', 'Tarjeta del boletín · Texto de ayuda del correo', 60, 'Tu correo...'),
    ],
  },
  {
    id: 'noticias_detalle', label: 'Textos fijos de una noticia', section: 'Noticias', fields: [
      field('noticia_volver', 'Enlace «← Noticias»', 60, '← Noticias'),
      field('noticia_volver_todas', 'Enlace «← Todas las noticias»', 60, '← Todas las noticias'),
      field('noticia_seguir_leyendo', 'Apartado «Seguir leyendo»', 60, 'Seguir leyendo'),
      field('noticia_cargando', 'Mensaje de carga', 60, 'Cargando la noticia…'),
      field('noticia_no_publicada', 'Noticia no publicada', 60, 'Esta noticia no está publicada'),
    ],
  },
  {
    id: 'editorial_textos', label: 'Textos fijos del catálogo editorial', section: 'Editorial', fields: [
      field('editorial_buscar_etiqueta', 'Buscador · Rótulo', 60, 'Buscar en el catálogo'),
      field('editorial_buscar_marcador', 'Buscador · Texto de ayuda', 60, 'Título, autoría, tema o signatura'),
      field('editorial_busqueda_avanzada', 'Búsqueda avanzada · Título', 60, 'Buscador'),
      field('editorial_campo_titulo', 'Búsqueda avanzada · Campo «Título»', 60, 'Título'),
      field('editorial_campo_autoria', 'Búsqueda avanzada · Campo «Autoría»', 60, 'Autoría'),
      field('editorial_campo_palabra', 'Búsqueda avanzada · Campo «Palabra clave»', 60, 'Palabra clave'),
      field('editorial_limpiar_busqueda', 'Botón «Limpiar la búsqueda avanzada»', 60, 'Limpiar la búsqueda avanzada'),
      field('editorial_categorias', 'Filtro «Categorías»', 60, 'Categorías'),
      field('editorial_subcategoria', 'Filtro «Subcategoría»', 60, 'Subcategoría'),
      field('editorial_tipo_material', 'Filtro «Tipo de material»', 60, 'Tipo de material'),
      field('editorial_soporte', 'Filtro «Soporte»', 60, 'Soporte'),
      field('editorial_anio', 'Filtro «Año de Publicación»', 60, 'Año de Publicación'),
      field('editorial_tematico', 'Filtro «Filtro temático»', 60, 'Filtro temático'),
      field('editorial_limpiar_filtros', 'Botón «Limpiar filtros»', 60, 'Limpiar filtros'),
      field('editorial_ver_detalle', 'Botón «Ver detalle»', 60, 'Ver detalle'),
      field('editorial_ver_ficha', 'Botón «Ver la ficha»', 60, 'Ver la ficha'),
      field('editorial_sin_categoria', 'Rótulo «Sin categoría»', 60, 'Sin categoría'),
      field('editorial_sin_autoria', 'Rótulo «Sin autoría registrada»', 60, 'Sin autoría registrada'),
      field('editorial_reintentar', 'Botón «Reintentar»', 60, 'Reintentar'),
      field('editorial_error', 'Error de carga', 70, 'No fue posible cargar el catálogo editorial'),
      field('editorial_cargando', 'Mensaje de carga', 60, 'Cargando el catálogo editorial…'),
      field('editorial_sin_resultados_titulo', 'Sin resultados · Título', 60, 'No encontramos resultados'),
      field('editorial_sin_resultados_texto', 'Sin resultados · Texto', 160, 'Ajusta la búsqueda, cambia la categoría o quita algún filtro para explorar de nuevo el catálogo.'),
    ],
  },
  {
    id: 'agenda_textos_fijos', label: 'Textos fijos de la Agenda y de cada evento', section: 'Agenda', fields: [
      field('agenda_reintentar', 'Botón «Reintentar»', 60, 'Reintentar'),
      field('agenda_limpiar_filtros', 'Botón «Limpiar filtros»', 60, 'Limpiar filtros'),
      field('agenda_cancelado', 'Rótulo «Cancelado»', 60, 'Cancelado'),
      field('agenda_mas_informacion', 'Enlace «Más información»', 60, 'Más información'),
      field('agenda_detalles', 'Apartado «Detalles del evento»', 60, 'Detalles del evento'),
      field('agenda_ver_mas', 'Botón «Ver más»', 60, 'Ver más'),
      field('agenda_error', 'Error de carga', 60, 'No pudimos cargar la agenda'),
      field('evento_cargando', 'Evento · Mensaje de carga', 60, 'Consultando el evento…'),
      field('evento_cancelado', 'Evento · Aviso de cancelación', 60, 'Este evento fue cancelado'),
      field('evento_enlace_externo', 'Evento · «Enlace externo»', 60, 'Enlace externo'),
      field('evento_cuando', 'Evento · «Cuándo»', 60, 'Cuándo'),
      field('evento_no_encontrado', 'Evento no encontrado', 60, 'No encontramos ese evento'),
    ],
  },
  {
    id: 'politicas_textos', label: 'Textos fijos de las páginas de políticas', section: 'Políticas', fields: [
      field('politicas_no_encontrado', 'Política no encontrada · Etiqueta', 60, 'No encontrado'),
      field('politicas_no_pide', 'Política no encontrada · Título', 60, 'Este sistema no pide esa autorización'),
      field('politicas_no_pide_texto', 'Política no encontrada · Texto', 190, 'Solo se pide autorización para lo que el sistema hace de verdad con los datos. Estas son las finalidades vigentes:'),
      field('politicas_tratamiento', 'Enlace «Tratamiento de datos personales»', 60, 'Tratamiento de datos personales'),
      field('politicas_terminos', 'Enlace «Términos de uso»', 60, 'Términos de uso'),
      field('politicas_boletin', 'Enlace «Boletín del SIMUS»', 60, 'Boletín del SIMUS'),
      field('politicas_marca', 'Pie del documento', 70, 'Sistema de Información de la Música · PNMC'),
      field('politicas_documento', 'Etiqueta «Documento institucional»', 60, 'Documento institucional'),
      field('politicas_abrir_documento', 'Botón «Abrir el documento del Ministerio»', 60, 'Abrir el documento del Ministerio'),
      field('politicas_mis_autorizaciones', 'Enlace «Mis autorizaciones»', 60, 'Mis autorizaciones'),
      field('politicas_cargando', 'Mensaje de carga', 60, 'Cargando el documento…'),
    ],
  },
  {
    id: 'footer_enlaces', label: 'Redes sociales y enlaces del pie', section: 'Barra y pie', fields: [
      /*
        LAS DIRECCIONES DE LAS REDES Y DE LOS ENLACES DEL PIE, que estaban escritas en el código. Una dirección
        vacía retira el enlace del sitio. Las de fábrica son las del Ministerio (mincultura.gov.co) y las cuentas
        institucionales; la de X sigue pendiente de confirmar por el equipo de contenido.
      */
      field('red_youtube_url', 'Red social · YouTube (dirección)', 200, 'https://www.youtube.com/@MinCulturasCol'),
      field('red_instagram_url', 'Red social · Instagram (dirección)', 200, 'https://www.instagram.com/minculturascol'),
      field('red_facebook_url', 'Red social · Facebook (dirección)', 200, 'https://www.facebook.com/MinCulturasCol'),
      field('red_x_url', 'Red social · X (dirección)', 200, 'https://x.com/MinCulturasCol'),
      field('footer_serv_pqrsd', 'Servicios a la ciudadanía · PQRSD (rótulo)', 60, 'PQRSD'),
      field('footer_serv_pqrsd_url', 'Servicios a la ciudadanía · PQRSD (dirección)', 200, 'https://www.mincultura.gov.co/atencion-al-ciudadano/Paginas/PQRS.aspx'),
      field('footer_serv_faq', 'Servicios a la ciudadanía · Preguntas frecuentes (rótulo)', 60, 'Preguntas Frecuentes'),
      field('footer_serv_faq_url', 'Servicios a la ciudadanía · Preguntas frecuentes (dirección)', 200, 'https://www.mincultura.gov.co/atencion-al-ciudadano/preguntas-frecuentes'),
      field('footer_serv_glosario', 'Servicios a la ciudadanía · Glosario (rótulo)', 60, 'Glosario'),
      field('footer_serv_glosario_url', 'Servicios a la ciudadanía · Glosario (dirección)', 200, 'https://www.mincultura.gov.co/atencion-al-ciudadano/glosario'),
      field('footer_serv_tramites', 'Servicios a la ciudadanía · Trámites (rótulo)', 60, 'Trámites y servicios'),
      field('footer_serv_tramites_url', 'Servicios a la ciudadanía · Trámites (dirección)', 200, 'https://www.mincultura.gov.co/atencion-al-ciudadano/tramites-y-servicios'),
      field('footer_sitio_politicas', 'Acerca del sitio · Políticas (rótulo)', 60, 'Políticas'),
      field('footer_sitio_politicas_url', 'Acerca del sitio · Políticas (dirección)', 200, 'https://www.mincultura.gov.co/politicas'),
      field('footer_sitio_datos', 'Acerca del sitio · Tratamiento de datos (rótulo)', 80, 'Política de tratamiento de datos'),
      field('footer_sitio_datos_url', 'Acerca del sitio · Tratamiento de datos (ruta interna)', 120, '/politicas/tratamiento'),
      field('footer_sitio_mapa', 'Acerca del sitio · Mapa del sitio (rótulo)', 60, 'Mapa del sitio'),
      field('footer_sitio_mapa_url', 'Acerca del sitio · Mapa del sitio (dirección)', 200, 'https://www.mincultura.gov.co/mapa-del-sitio'),
      field('footer_sitio_terminos', 'Acerca del sitio · Términos de uso (rótulo)', 60, 'Términos de uso'),
      field('footer_sitio_terminos_url', 'Acerca del sitio · Términos de uso (ruta interna)', 120, '/politicas/terminos'),
      field('footer_sitio_accesibilidad', 'Acerca del sitio · Accesibilidad (rótulo)', 60, 'Accesibilidad'),
      field('footer_sitio_accesibilidad_url', 'Acerca del sitio · Accesibilidad (dirección)', 200, 'https://www.mincultura.gov.co/accesibilidad'),
    ],
  },
  {
    id: 'dir_mercados_textos', label: 'Textos de la página', section: 'Mercados musicales', fields: [
      field('dir_mercados_title', 'Título de la página', 60, 'Mercados musicales'),
      field('dir_mercados_subtitle', 'Subtítulo de la página', 100, 'Nodos de intercambio, visibilización y profesionalización'),
      field('dir_mercados_list_heading', 'Encabezado de la lista (lectores de pantalla)', 80, 'Mercados musicales publicados en el Ecosistema'),
      field('dir_mercados_search_label', 'Buscador · Rótulo', 60, 'Buscar mercado, territorio o práctica'),
      field('dir_mercados_search_placeholder', 'Buscador · Texto de ayuda', 60, 'Mercado, organización o lugar'),
      field('dir_mercados_filters_title', 'Filtros · Título', 60, 'Territorio'),
      field('dir_mercados_map_label', 'Botón «Ver en el mapa»', 60, 'Ver mercados en el mapa'),
      field('dir_mercados_filters_help', 'Filtros · Ayuda', 130, 'Los filtros muestran únicamente territorios y prácticas con mercados publicados.'),
      field('dir_mercados_loading', 'Mensaje de carga', 60, 'Consultando los mercados…'),
      field('dir_mercados_empty_total_title', 'Directorio vacío · Título', 60, 'Todavía no hay mercados publicados'),
      field('dir_mercados_empty_total_text', 'Directorio vacío · Texto', 140, 'Cuando el PNMC publique el primero, aparecerá aquí con su territorio y su descripción.'),
      field('dir_mercados_empty_query_title', 'Sin resultados · Título', 70, 'Ningún mercado coincide con esta consulta'),
      field('dir_mercados_empty_query_text', 'Sin resultados · Consejo', 60, 'Prueba con menos filtros.'),
    ],
  },
  {
    id: 'dir_luteria_textos', label: 'Textos de la página', section: 'Lutería', fields: [
      field('dir_luteria_title', 'Título de la página', 60, 'Lutería'),
      field('dir_luteria_subtitle', 'Subtítulo de la página', 110, 'Talleres donde se construyen, reparan y enseñan a hacer instrumentos'),
      field('dir_luteria_list_heading', 'Encabezado de la lista (lectores de pantalla)', 80, 'Talleres de lutería publicados en el Ecosistema'),
      field('dir_luteria_search_label', 'Buscador · Rótulo', 60, 'Buscar un taller'),
      field('dir_luteria_search_placeholder', 'Buscador · Texto de ayuda', 60, 'Nombre, descripción o lugar'),
      field('dir_luteria_filters_title', 'Filtros · Título', 60, 'Filtros'),
      field('dir_luteria_map_label', 'Botón «Ver en el mapa»', 60, 'Ver talleres en el mapa'),
      field('dir_luteria_filters_help', 'Filtros · Ayuda', 120, 'Los filtros muestran únicamente lo que tienen los talleres publicados.'),
      field('dir_luteria_loading', 'Mensaje de carga', 60, 'Consultando los talleres…'),
      field('dir_luteria_empty_total_title', 'Directorio vacío · Título', 60, 'Todavía no hay talleres publicados'),
      field('dir_luteria_empty_total_text', 'Directorio vacío · Texto', 140, 'Cuando el PNMC publique el primero, aparecerá aquí con su territorio y su descripción.'),
      field('dir_luteria_empty_query_title', 'Sin resultados · Título', 70, 'Ningún taller coincide con esta consulta'),
      field('dir_luteria_empty_query_text', 'Sin resultados · Consejo', 60, 'Prueba con menos filtros.'),
    ],
  },
  {
    id: 'dir_espacios_textos', label: 'Textos de la página', section: 'Espacios en vivo', fields: [
      field('dir_espacios_title', 'Título de la página', 60, 'Espacios para música en vivo'),
      field('dir_espacios_subtitle', 'Subtítulo de la página', 140, 'Salas, teatros, bares, casas de cultura y escenarios donde la música suena en vivo'),
      field('dir_espacios_list_heading', 'Encabezado de la lista (lectores de pantalla)', 90, 'Espacios para música en vivo publicados en el Ecosistema'),
      field('dir_espacios_search_label', 'Buscador · Rótulo', 60, 'Buscar un espacio'),
      field('dir_espacios_search_placeholder', 'Buscador · Texto de ayuda', 60, 'Nombre, descripción o lugar'),
      field('dir_espacios_filters_title', 'Filtros · Título', 60, 'Filtros'),
      field('dir_espacios_map_label', 'Botón «Ver en el mapa»', 60, 'Ver espacios en el mapa'),
      field('dir_espacios_filters_help', 'Filtros · Ayuda', 120, 'Los filtros muestran únicamente lo que tienen los espacios publicados.'),
      field('dir_espacios_loading', 'Mensaje de carga', 60, 'Consultando los espacios…'),
      field('dir_espacios_empty_total_title', 'Directorio vacío · Título', 60, 'Todavía no hay espacios publicados'),
      field('dir_espacios_empty_total_text', 'Directorio vacío · Texto', 140, 'Cuando el PNMC publique el primero, aparecerá aquí con su territorio y su descripción.'),
      field('dir_espacios_empty_query_title', 'Sin resultados · Título', 70, 'Ningún espacio coincide con esta consulta'),
      field('dir_espacios_empty_query_text', 'Sin resultados · Consejo', 60, 'Prueba con menos filtros.'),
    ],
  },
  {
    id: 'dir_redes_textos', label: 'Textos de la página', section: 'Redes y documentación', fields: [
      field('dir_redes_title', 'Título de la página', 60, 'Redes y documentación'),
      field('dir_redes_subtitle', 'Subtítulo de la página', 150, 'Redes, archivos y centros de documentación musical: qué acervos tienen y cómo se consultan'),
      field('dir_redes_list_heading', 'Encabezado de la lista (lectores de pantalla)', 100, 'Redes y centros de documentación publicados en el Ecosistema'),
      field('dir_redes_search_label', 'Buscador · Rótulo', 60, 'Buscar una red'),
      field('dir_redes_search_placeholder', 'Buscador · Texto de ayuda', 60, 'Nombre, descripción o lugar'),
      field('dir_redes_filters_title', 'Filtros · Título', 60, 'Filtros'),
      field('dir_redes_map_label', 'Botón «Ver en el mapa»', 60, 'Ver redes en el mapa'),
      field('dir_redes_filters_help', 'Filtros · Ayuda', 110, 'Los filtros muestran únicamente lo que tienen las redes publicadas.'),
      field('dir_redes_loading', 'Mensaje de carga', 60, 'Consultando las redes…'),
      field('dir_redes_empty_total_title', 'Directorio vacío · Título', 60, 'Todavía no hay redes publicadas'),
      field('dir_redes_empty_total_text', 'Directorio vacío · Texto', 140, 'Cuando el PNMC publique la primera, aparecerá aquí con su territorio y su descripción.'),
      field('dir_redes_empty_query_title', 'Sin resultados · Título', 70, 'Ninguna red coincide con esta consulta'),
      field('dir_redes_empty_query_text', 'Sin resultados · Consejo', 60, 'Prueba con menos filtros.'),
    ],
  },
  {
    id: 'dir_comunes', label: 'Textos comunes de todos los directorios', section: 'Festivales', fields: [
      field('dir_comun_buscar', 'Directorios · Botón «Buscar»', 60, 'Buscar'),
      field('dir_comun_limpiar_filtros', 'Directorios · Botón «Limpiar filtros»', 60, 'Limpiar filtros'),
    ],
  },
  {
    id: 'home_botones', label: 'Botones y avisos de la portada', section: 'Portada', fields: [
      field('home_boton_ecosistema', 'Portada · Botón «Explorar el ecosistema»', 60, 'Explorar el ecosistema'),
      field('home_boton_pnmc', 'Portada · Botón «Conocer el PNMC»', 60, 'Conocer el PNMC'),
      field('home_actualidad_titulo', 'Actualidad · Título', 60, 'Actualidad'),
      field('home_actualidad_noticias', 'Actualidad · Rótulo «Noticias»', 60, 'Noticias'),
      field('home_actualidad_todas_noticias', 'Actualidad · Enlace «Todas las noticias»', 60, 'Todas las noticias'),
      field('home_actualidad_proximamente', 'Actualidad · Rótulo «Próximamente»', 60, 'Próximamente'),
      field('home_actualidad_toda_agenda', 'Actualidad · Enlace «Toda la agenda»', 60, 'Toda la agenda'),
      field('home_actualidad_cargando', 'Actualidad · Mensaje de carga', 60, 'Cargando noticias y agenda…'),
      field('home_actualidad_error', 'Actualidad · Error de carga', 70, 'No pudimos cargar la portada informativa'),
      field('home_actualidad_sin_noticias', 'Actualidad · Sin noticias (título)', 60, 'Todavía no hay noticias publicadas'),
      field('home_actualidad_sin_noticias_texto', 'Actualidad · Sin noticias (texto)', 80, 'Cuando se publique la primera aparecerá aquí.'),
      field('home_actualidad_cargando_agenda', 'Actualidad · Agenda cargando', 60, 'Cargando agenda…'),
      field('home_actualidad_agenda_error', 'Actualidad · Agenda con error', 60, 'No pudimos cargar la agenda'),
      field('home_actualidad_sin_eventos', 'Actualidad · Sin eventos (título)', 60, 'No hay eventos próximos'),
      field('home_actualidad_sin_eventos_texto', 'Actualidad · Sin eventos (texto)', 70, 'Vuelve pronto para revisar nuevas fechas.'),
      field('home_bulletin_etiqueta', 'Boletín · Etiqueta superior', 60, 'Boletín'),
    ],
  },
  {
    id: 'home_boletin_formulario', label: 'Formulario de suscripción al boletín', section: 'Portada', fields: [
      field('boletin_form_autorizacion_titulo', 'Autorización · Título', 60, 'Autorización de tratamiento de datos'),
      field('boletin_form_registrar_a', 'Autorización · «Vas a registrar»', 60, 'Vas a registrar'),
      field('boletin_form_registrar_b', 'Autorización · Texto tras el correo', 190, 'en el boletín del SIMUS. Te enviaremos un correo con un enlace: la suscripción solo se activa cuando lo confirmes.'),
      field('boletin_form_baja', 'Autorización · Aviso de baja', 220, 'Puedes darte de baja cuando quieras con el enlace «Darme de baja» de cada correo del boletín, y retiramos tu autorización. Más en la'),
      field('boletin_form_politica', 'Autorización · Enlace «política de privacidad»', 60, 'política de privacidad'),
      field('boletin_form_cargando_politica', 'Autorización · Cargando la política', 80, 'Cargando la política de tratamiento de datos…'),
      field('boletin_form_acepto', 'Autorización · Casilla de aceptación', 140, 'He leído y autorizo el tratamiento de mi correo electrónico en los términos anteriores.'),
      field('boletin_form_reintentar', 'Botón «Reintentar»', 60, 'Reintentar'),
      field('boletin_form_cancelar', 'Botón «Cancelar»', 60, 'Cancelar'),
    ],
  },
  {
    id: 'sobre_mapa_textos', label: 'Página «Sobre este mapa»', section: 'Sobre el mapa', fields: [
      field('sobre_mapa_miga', 'Migas · «Mapa ecosistémico»', 60, 'Mapa ecosistémico'),
      field('sobre_mapa_titulo', 'Título de la página', 60, 'Sobre este mapa'),
      field('sobre_mapa_subtitulo', 'Subtítulo de la página', 80, 'Por qué el geovisor se dibuja como se dibuja.'),
      field('sobre_mapa_s1_etiqueta', 'Apartado 1 · Etiqueta', 60, 'Qué es y qué no es'),
      field('sobre_mapa_s1_titulo', 'Apartado 1 · Título', 60, 'Una lectura, no un censo'),
      field('sobre_mapa_s1_p1', 'Apartado 1 · Párrafo 1', 370, 'El Mapa Ecosistémico enseña los procesos musicales que las organizaciones han registrado en SIMUS y que están publicados. No es un censo del ecosistema musical colombiano ni una muestra estadística de él: es lo que hay registrado, que crece a medida que las organizaciones registran.'),
      field('sobre_mapa_s1_p2', 'Apartado 1 · Párrafo 2', 320, 'Esa distinción cambia cómo se lee. Un departamento en blanco no dice que ahí no pase nada: dice que ahí todavía no hay registros. Por eso el mapa cuenta aparte cuántos procesos no puede situar y por qué, en vez de dejarlos caer en silencio.'),
      field('sobre_mapa_s2_etiqueta', 'Apartado 2 · Etiqueta', 60, 'Cómo se dibuja'),
      field('sobre_mapa_s2_titulo', 'Apartado 2 · Título', 60, 'Tres formas, tres preguntas'),
      field('sobre_mapa_s2_p1', 'Apartado 2 · Párrafo', 330, 'No existe una forma neutral de dibujar un mapa: cada técnica destaca algo y deforma otra cosa. Por eso el geovisor ofrece tres y dice, en cada una, qué responde y qué deforma. Elegir entre ellas es parte de la lectura, no un ajuste de presentación.'),
      field('sobre_mapa_deforma', 'Rótulo «Lo que deforma»', 60, 'Lo que deforma'),
      field('sobre_mapa_de_donde_viene', 'Rótulo «De dónde viene»', 60, 'De dónde viene'),
      field('sobre_mapa_s3_etiqueta', 'Apartado 3 · Etiqueta', 60, 'Con qué criterio se lee'),
      field('sobre_mapa_s3_titulo', 'Apartado 3 · Título', 60, 'El lente no es un filtro'),
      field('sobre_mapa_s3_p1', 'Apartado 3 · Párrafo', 410, 'Una cosa es cómo se representa el mapa y otra las gafas con las que se mira. Un filtro RESTA: esconde lo que no encaja, y lo que no está clasificado desaparece sin decirlo. Un lente REAGRUPA: se sigue viendo todo, sólo que ordenado por otro criterio, y lo que no consta cae en «Sin clasificar», que es la verdad.'),
      field('sobre_mapa_fichas_a', 'Apartado 3 · Fichas (inicio de la frase)', 130, 'Las fichas conceptuales de cada territorio sonoro y de cada práctica viven en el'),
      field('sobre_mapa_enlace_territorios', 'Apartado 3 · Enlace al catálogo de territorios', 60, 'catálogo de territorios sonoros'),
      field('sobre_mapa_enlace_practicas', 'Apartado 3 · Enlace al catálogo de prácticas', 60, 'catálogo de prácticas musicales'),
      field('sobre_mapa_s4_etiqueta', 'Apartado 4 · Etiqueta', 60, 'De dónde salen los datos'),
      field('sobre_mapa_s4_titulo', 'Apartado 4 · Título', 70, 'Qué afirma el mapa, y con qué respaldo'),
      field('sobre_mapa_s4_p1', 'Apartado 4 · Párrafo', 230, 'Un mapa afirma al menos dos cosas sobre cada proceso —dónde está y de qué es— y quien lo lee tiene derecho a saber de dónde salen las dos.'),
      field('sobre_mapa_tabla_titulo', 'Tabla de procedencia · Título', 80, 'Procedencia de cada dato que el mapa representa'),
      field('sobre_mapa_col_dato', 'Tabla · Columna «Dato»', 60, 'Dato'),
      field('sobre_mapa_col_fuente', 'Tabla · Columna «Fuente»', 60, 'Fuente'),
      field('sobre_mapa_col_alcance', 'Tabla · Columna «Alcance»', 60, 'Alcance'),
      field('sobre_mapa_referentes_etiqueta', 'Referentes · Etiqueta', 60, 'Referentes'),
      field('sobre_mapa_referentes_titulo', 'Referentes · Título', 60, 'En qué se apoya'),
      field('sobre_mapa_volver', 'Botón «Volver al mapa»', 60, 'Volver al mapa'),
      field('sobre_mapa_cierre', 'Cierre · Texto', 160, 'Las cifras viven allí y cambian con los registros. Aquí sólo está el razonamiento, que no cambia.'),
      field('sobre_mapa_abrir', 'Cierre · Botón «Abrir el Mapa Ecosistémico»', 60, 'Abrir el Mapa Ecosistémico'),
    ],
  },
  {
    id: 'mapa_pagina', label: 'Textos fijos de la página del mapa', section: 'Mapa ecosistémico', fields: [
      field('mapa_titulo', 'Título de la página', 60, 'Mapa ecosistémico de la música'),
      field('mapa_filtrar', 'Barra · «Filtrar»', 60, 'Filtrar'),
      field('mapa_buscar', 'Barra · «Buscar»', 60, 'Buscar'),
      field('mapa_primera_vez', 'Invitación al recorrido · Título', 60, '¿Primera vez en el mapa?'),
      field('mapa_primera_vez_texto', 'Invitación al recorrido · Texto', 170, 'Un recorrido corto explica cada parte. Puedes verlo ahora o más tarde con el botón «Recorrido guiado».'),
      field('mapa_recorrido_boton', 'Botón «Recorrido guiado»', 60, 'Recorrido guiado'),
      field('mapa_primera_vez_no', 'Invitación al recorrido · «No, gracias»', 60, 'No, gracias'),
      field('mapa_error_cartografia', 'Error de cartografía', 60, 'No fue posible cargar la cartografía.'),
      field('mapa_reintentar', 'Botón «Reintentar»', 60, 'Reintentar'),
      field('mapa_lectura_capa', 'Panel · «Lectura de la capa»', 60, 'Lectura de la capa'),
      field('mapa_que_quieres_saber', 'Gráfico · «¿Qué quieres saber?»', 60, '¿Qué quieres saber?'),
      field('mapa_mostrando', 'Gráfico · «Mostrando»', 60, 'Mostrando'),
      field('mapa_ayuda_filtrar_tablero', 'Gráfico · Ayuda para filtrar', 160, 'Pulsa una barra o un mosaico para filtrar todo el tablero; vuelve a pulsarlo para quitar el filtro.'),
      field('mapa_sin_registros_capa', 'Gráfico · Sin registros en la capa', 60, 'Sin registros en esta capa'),
      field('mapa_municipios_titulo', 'Gráfico · Municipios con más registros', 60, 'Municipios con más registros'),
      field('mapa_municipios_texto', 'Gráfico · Texto de municipios', 100, 'El ranking de municipios según lo que declara cada ficha.'),
      field('mapa_cobertura_titulo', 'Gráfico · Cobertura del territorio', 60, 'Cobertura del territorio'),
      field('mapa_no_situado_titulo', 'Gráfico · Lo que no se puede situar', 60, 'Lo que no se puede situar en el mapa'),
      field('mapa_nada_fuera', 'Gráfico · Nada queda fuera del mapa', 60, 'Nada queda fuera del mapa'),
      field('mapa_cargando_vista', 'Mensaje «Cargando la vista»', 60, 'Cargando la vista…'),
      field('mapa_inscribe', 'Directorio · «Inscribe tu proceso en SIMUS»', 60, 'Inscribe tu proceso en SIMUS'),
      field('mapa_directorio_ayuda', 'Directorio · Ayuda', 120, 'Pulsa un registro para ver su detalle, o el icono para ubicarlo en el mapa.'),
      field('mapa_ubicar', 'Directorio · «Ubicar en el mapa»', 60, 'Ubicar en el mapa'),
      field('mapa_ver_detalle', 'Directorio · «Ver detalle»', 60, 'Ver detalle'),
      field('mapa_sin_registros', 'Directorio · Sin registros', 60, 'Sin registros encontrados'),
      field('mapa_senala', 'Mapa · Invitación a señalar', 80, 'Señala cualquier parte del mapa y te digo qué es.'),
      field('mapa_ver_ficha', 'Ficha · «Ver la ficha completa»', 60, 'Ver la ficha completa'),
      field('mapa_web_oficial', 'Ficha · «Visita la web oficial»', 60, 'Visita la web oficial'),
      field('mapa_contactar', 'Ficha · «Contactar Entidad»', 60, 'Contactar Entidad'),
      field('mapa_organizacion', 'Ficha · «Organización responsable»', 60, 'Organización responsable'),
    ],
  },
  {
    id: 'nav_textos_fijos', label: 'Barra principal · textos fijos', section: 'Barra y pie', fields: [
      field('nav_pnmc_nombre', 'Menú PNMC · Nombre completo del Plan', 70, 'Plan Nacional de Música para la Convivencia'),
      field('nav_pnmc_ver', 'Menú PNMC · Enlace «Ver el PNMC →»', 60, 'Ver el PNMC →'),
      field('nav_pnmc_ejes_ayuda', 'Menú PNMC · Ayuda de los ejes', 70, 'Elige un eje para ver sus componentes.'),
      field('nav_simus_nombre', 'Menú · Nombre «Sistema de Información de la Música»', 60, 'Sistema de Información de la Música'),
      field('nav_ecosistema_nombre', 'Menú Ecosistema · «Ecosistema Musical de Colombia»', 60, 'Ecosistema Musical de Colombia'),
      field('nav_directorios_titulo', 'Menú Ecosistema · «Directorios del ecosistema»', 60, 'Directorios del ecosistema'),
      field('nav_personas_titulo', 'Menú Ecosistema · «Directorio de agentes y actores»', 60, 'Directorio de agentes y actores'),
      field('nav_personas_desc', 'Menú Ecosistema · Descripción del directorio de agentes', 70, 'Personas con perfil público de la música.'),
      field('nav_mi_espacio', 'Cuenta · «Mi espacio»', 60, 'Mi espacio'),
      field('nav_perfil_publico', 'Cuenta · «Perfil público»', 60, 'Perfil público'),
      field('nav_seguridad', 'Cuenta · «Contraseña y seguridad»', 60, 'Contraseña y seguridad'),
      field('nav_autorizaciones', 'Cuenta · «Mis autorizaciones»', 60, 'Mis autorizaciones'),
      field('nav_organizaciones', 'Cuenta · «Mis organizaciones»', 60, 'Mis organizaciones'),
      field('nav_cerrar_sesion', 'Cuenta · «Cerrar sesión»', 60, 'Cerrar sesión'),
      field('nav_ingresar', 'Cuenta · «Ingresar»', 60, 'Ingresar'),
      field('nav_cuenta_titulo', 'Cuenta · «Tu cuenta en SIMUS»', 60, 'Tu cuenta en SIMUS'),
      field('nav_cuenta_acceso', 'Cuenta · «Accede a tu cuenta de SIMUS.»', 60, 'Accede a tu cuenta de SIMUS.'),
      field('nav_crear_cuenta_organizacion', 'Cuenta · «Crear cuenta o registrar organización»', 60, 'Crear cuenta o registrar organización'),
      field('nav_participa', 'Cuenta · Invitación a participar', 90, 'Participa y gestiona información del ecosistema musical.'),
      field('nav_crear_cuenta', 'Cuenta · «Crear cuenta»', 60, 'Crear cuenta'),
      field('nav_gestion', 'Cuenta · «Gestión»', 60, 'Gestión'),
    ],
  },
  {
    id: 'mapa_pestanas_grafico', label: 'Vista Gráfico · seis pestañas', section: 'Mapa ecosistémico', fields: [
      field('mapa_tab_panel_nombre', 'Pestaña «Panel general» · Nombre', 40, 'Panel general'),
      field('mapa_tab_panel_pregunta', 'Pestaña «Panel general» · Pregunta que responde', 60, '¿Por dónde empiezo?'),
      field('mapa_tab_panel_responde', 'Pestaña «Panel general» · Qué se ve', 130, 'Las cifras y los gráficos de resumen, y las preguntas que llevan a cada vista.'),
      field('mapa_tab_flujos_nombre', 'Pestaña «Flujos» · Nombre', 40, 'Flujos'),
      field('mapa_tab_flujos_pregunta', 'Pestaña «Flujos» · Pregunta que responde', 60, '¿Cómo se reparte en tres pasos?'),
      field('mapa_tab_flujos_responde', 'Pestaña «Flujos» · Qué se ve', 140, 'Cómo se reparten los registros del tipo de proceso al departamento y a la práctica.'),
      field('mapa_tab_redes_nombre', 'Pestaña «Redes» · Nombre', 40, 'Redes'),
      field('mapa_tab_redes_pregunta', 'Pestaña «Redes» · Pregunta que responde', 70, '¿Quién se conecta con quién o con qué?'),
      field('mapa_tab_redes_responde', 'Pestaña «Redes» · Qué se ve', 150, 'Las relaciones registradas entre organizaciones, procesos, territorios sonoros y prácticas.'),
      field('mapa_tab_coincidencias_nombre', 'Pestaña «Coincidencias» · Nombre', 40, 'Coincidencias'),
      field('mapa_tab_coincidencias_pregunta', 'Pestaña «Coincidencias» · Pregunta que responde', 60, '¿Qué coincide con qué?'),
      field('mapa_tab_coincidencias_responde', 'Pestaña «Coincidencias» · Qué se ve', 150, 'Cuántos registros declaran a la vez dos valores, como una práctica y un territorio sonoro.'),
      field('mapa_tab_barras_nombre', 'Pestaña «Barras» · Nombre', 40, 'Barras'),
      field('mapa_tab_barras_pregunta', 'Pestaña «Barras» · Pregunta que responde', 60, '¿Dónde se concentra la actividad?'),
      field('mapa_tab_barras_responde', 'Pestaña «Barras» · Qué se ve', 150, 'Cuántos registros hay por departamento, práctica o territorio, y de qué tipo de proceso.'),
      field('mapa_tab_jerarquias_nombre', 'Pestaña «Jerarquías» · Nombre', 40, 'Jerarquías'),
      field('mapa_tab_jerarquias_pregunta', 'Pestaña «Jerarquías» · Pregunta que responde', 60, '¿De qué está hecho el ecosistema?'),
      field('mapa_tab_jerarquias_responde', 'Pestaña «Jerarquías» · Qué se ve', 160, 'El conjunto en mosaico, del tipo de proceso al departamento y a la práctica, con descenso por clic.'),
    ],
  },
  {
    id: 'about_documento', label: 'El documento y las estrategias (encabezados)', section: 'PNMC', fields: [
      field('about_documento_tag', 'Documento · Etiqueta', 60, 'Documento'),
      field('about_documento_titulo', 'Documento · Título', 80, 'Conoce el documento completo del PNMC 2025–2035'),
      field('about_documento_desc', 'Documento · Descripción', 260, 'Huellas y apuestas de la diversidad sonora: el diagnóstico, los tres ejes con sus diez componentes y las acciones del Plan, tal como los publicó el Ministerio.'),
      field('about_documento_boton', 'Documento · Botón de descarga', 60, 'Descargar PDF'),
      field('about_estrategias_tag', 'Estrategias · Etiqueta', 60, 'Estrategias'),
      field('about_estrategias_titulo', 'Estrategias · Título', 60, 'Estrategias del Plan'),
      field('about_estrategias_proximamente', 'Estrategias · Rótulo «Próximamente»', 60, 'Próximamente'),
    ],
  },
  {
    id: 'about_navegacion', label: 'Pestañas de navegación de la página', section: 'PNMC', fields: [
      field('about_nav_presentacion', 'Pestaña · Presentación', 40, 'Presentación'),
      field('about_nav_enfoques', 'Pestaña · Enfoques', 40, 'Enfoques'),
      field('about_nav_ejes', 'Pestaña · Ejes', 40, 'Ejes de transformación'),
      field('about_nav_documento', 'Pestaña · El documento', 40, 'El documento'),
      field('about_nav_estrategias', 'Pestaña · Estrategias', 40, 'Estrategias'),
      field('about_nav_actores', 'Pestaña · Actores', 40, 'Actores'),
      field('about_nav_hitos', 'Pestaña · Hitos', 40, 'Hitos'),
      field('about_nav_marco', 'Pestaña · Marco normativo', 40, 'Marco normativo'),
      field('about_nav_equipo', 'Pestaña · Equipo', 40, 'Equipo'),
    ],
  },
  {
    id: 'festivales_ficha', label: 'Ficha de un festival', section: 'Festivales', fields: [
      field('fest_ficha_sobre', 'Apartado «Sobre el Festival»', 60, 'Sobre el Festival'),
      field('ficha_practicas_territorios', 'Fichas · Apartado «Prácticas y territorios»', 60, 'Prácticas y territorios'),
      field('ficha_practicas', 'Fichas · Rótulo «Prácticas musicales»', 60, 'Prácticas musicales'),
      field('ficha_territorios', 'Fichas · Rótulo «Territorios sonoros»', 60, 'Territorios sonoros'),
      field('fest_ficha_datos', 'Apartado «Datos del Festival»', 60, 'Datos del Festival'),
      field('ficha_presencia', 'Fichas · Apartado «Presencia pública»', 60, 'Presencia pública'),
      field('fest_ficha_marco', 'Apartado «En el marco de este festival»', 60, 'En el marco de este festival'),
      field('fest_ficha_mercados', 'Apartado «Mercados musicales»', 60, 'Mercados musicales'),
      field('fest_ficha_ver_mercados', 'Botón «Ver mercados»', 60, 'Ver mercados'),
      field('fest_ficha_ediciones_tag', 'Ediciones · Etiqueta', 60, 'Ediciones anuales'),
      field('ficha_ediciones', 'Fichas · Apartado «Ediciones»', 60, 'Ediciones'),
      field('fest_ficha_ediciones_texto', 'Ediciones · Texto', 150, 'Cada edición reúne información propia de un año. El perfil del Festival se mantiene separado.'),
      field('ficha_sin_ediciones', 'Fichas · «Sin ediciones publicadas»', 60, 'Sin ediciones publicadas'),
      field('fest_ficha_sin_ediciones_texto', 'Ediciones · Sin ediciones (texto)', 170, 'Las ediciones aparecen aquí cuando la organización responsable las envía y el equipo del PNMC las publica.'),
      field('ficha_descripcion', 'Fichas · Apartado «Descripción»', 60, 'Descripción'),
      field('ficha_estado_realizacion', 'Fichas · «Estado de realización»', 60, 'Estado de realización'),
      field('fest_ficha_volver', 'Botón «Volver a Festivales»', 60, 'Volver a Festivales'),
      field('fest_ficha_cargando', 'Mensaje de carga', 70, 'Cargando la ficha pública del Festival…'),
      field('ficha_no_disponible', 'Fichas · «Esta ficha no está disponible»', 60, 'Esta ficha no está disponible'),
      field('fest_ficha_miga', 'Migas · «Festivales»', 60, 'Festivales'),
      field('ficha_cargando_ediciones', 'Fichas · Cargando las ediciones', 60, 'Cargando las ediciones publicadas…'),
    ],
  },
  {
    id: 'mercados_ficha', label: 'Ficha de un mercado', section: 'Mercados musicales', fields: [
      field('merc_ficha_sobre', 'Apartado «Sobre el mercado»', 60, 'Sobre el mercado'),
      field('merc_ficha_datos', 'Apartado «Datos del mercado»', 60, 'Datos del mercado'),
      field('merc_ficha_marco', 'Apartado «En el marco de»', 60, 'En el marco de'),
      field('merc_ficha_realizaciones', 'Apartado «Realizaciones»', 60, 'Realizaciones'),
      field('merc_ficha_ediciones_texto', 'Ediciones · Texto', 150, 'Cada edición reúne información propia de un año. El perfil del mercado se mantiene separado.'),
      field('merc_ficha_sin_ediciones_texto', 'Ediciones · Sin ediciones (texto)', 150, 'Las ediciones aparecen aquí cuando la organización responsable las registra y las publica.'),
      field('ficha_donde', 'Fichas · Rótulo «Dónde»', 60, 'Dónde'),
      field('merc_ficha_volver', 'Botón «Volver a Mercados musicales»', 60, 'Volver a Mercados musicales'),
      field('merc_ficha_cargando', 'Mensaje de carga', 70, 'Cargando la ficha pública del mercado…'),
      field('merc_ficha_miga', 'Migas · «Mercados musicales»', 60, 'Mercados musicales'),
    ],
  },
  {
    id: 'luteria_ficha', label: 'Ficha de un taller', section: 'Lutería', fields: [
      field('lut_ficha_sobre', 'Apartado «Sobre el taller»', 60, 'Sobre el taller'),
      field('lut_ficha_saberes', 'Apartado «Saberes y técnicas»', 60, 'Saberes y técnicas'),
      field('lut_ficha_ofrece', 'Apartado «Qué ofrece»', 60, 'Qué ofrece'),
      field('lut_ficha_familias', 'Apartado «Familias de instrumentos»', 60, 'Familias de instrumentos'),
      field('lut_ficha_datos', 'Apartado «Datos del taller»', 60, 'Datos del taller'),
      field('lut_ficha_modalidad', 'Rótulo «Modalidad»', 60, 'Modalidad'),
      field('lut_ficha_aprendices', 'Rótulo «Aprendices»', 60, 'Aprendices'),
      field('ficha_responsable', 'Fichas · Rótulo «Responsable»', 60, 'Responsable'),
      field('ficha_contacto', 'Fichas · Rótulo «Contacto»', 60, 'Contacto'),
      field('lut_ficha_sin_contacto', 'Sin datos de contacto', 70, 'El taller no publicó datos de contacto.'),
      field('lut_ficha_cargando', 'Mensaje de carga', 60, 'Cargando la ficha del taller…'),
      field('lut_ficha_miga', 'Migas · «Lutería»', 60, 'Lutería'),
    ],
  },
  {
    id: 'espacios_ficha', label: 'Ficha de un espacio', section: 'Espacios en vivo', fields: [
      field('esp_ficha_sobre', 'Apartado «Sobre el espacio»', 60, 'Sobre el espacio'),
      field('esp_ficha_horario', 'Apartado «Horario y programación»', 60, 'Horario y programación'),
      field('esp_ficha_lugar', 'Apartado «Qué lugar es»', 60, 'Qué lugar es'),
      field('esp_ficha_equipamiento', 'Apartado «Equipamiento»', 60, 'Equipamiento'),
      field('esp_ficha_datos', 'Apartado «Datos del espacio»', 60, 'Datos del espacio'),
      field('esp_ficha_ambiente', 'Rótulo «Ambiente»', 60, 'Ambiente'),
      field('esp_ficha_aforo', 'Rótulo «Aforo»', 60, 'Aforo'),
      field('esp_ficha_accesibilidad', 'Rótulo «Accesibilidad»', 60, 'Accesibilidad'),
      field('esp_ficha_sin_contacto', 'Sin datos de contacto', 70, 'El espacio no publicó datos de contacto.'),
      field('esp_ficha_cargando', 'Mensaje de carga', 60, 'Cargando la ficha del espacio…'),
      field('esp_ficha_miga', 'Migas · «Espacios para música en vivo»', 60, 'Espacios para música en vivo'),
    ],
  },
  {
    id: 'redes_ficha', label: 'Ficha de una red', section: 'Redes y documentación', fields: [
      field('red_ficha_sobre', 'Apartado «Sobre la red»', 60, 'Sobre la red'),
      field('red_ficha_acervos', 'Apartado «Acervos y colecciones»', 60, 'Acervos y colecciones'),
      field('red_ficha_consulta', 'Apartado «Cómo se consulta»', 60, 'Cómo se consulta'),
      field('red_ficha_formatos', 'Apartado «Formatos de documentación»', 60, 'Formatos de documentación'),
      field('red_ficha_datos', 'Apartado «Datos de la red»', 60, 'Datos de la red'),
      field('red_ficha_tipo', 'Rótulo «Tipo de nodo»', 60, 'Tipo de nodo'),
      field('red_ficha_acceso', 'Rótulo «Acceso»', 60, 'Acceso'),
      field('red_ficha_sin_contacto', 'Sin datos de contacto', 60, 'La red no publicó datos de contacto.'),
      field('red_ficha_cargando', 'Mensaje de carga', 60, 'Cargando la ficha de la red…'),
      field('red_ficha_miga', 'Migas · «Redes y documentación»', 60, 'Redes y documentación'),
    ],
  },
  {
    id: 'practicas_ficha', label: 'Ficha de una práctica musical', section: 'Prácticas musicales', fields: [
      field('practicas_ficha_subtitulo', 'Subtítulo de la ficha', 60, 'Ficha conceptual'),
      field('practicas_ficha_no_encontrada', 'Ficha no encontrada', 240, 'No encontramos esta ficha. Puede que se haya movido o que la dirección esté incompleta. Vuelve al listado de prácticas musicales y búscala allí.'),
    ],
  },
  {
    id: 'organizacion_publica', label: 'Ficha pública de una organización', section: 'Agentes y actores', fields: [
      field('org_publica_personas', 'Apartado «Personas con perfil público»', 60, 'Personas con perfil público'),
      field('org_publica_sin_personas', 'Sin perfiles publicados', 100, 'Nadie de esta organización ha publicado su perfil todavía.'),
      field('org_publica_subtitulo', 'Subtítulo de la ficha', 60, 'Organización'),
      field('org_publica_no_disponible', 'Organización no disponible', 60, 'Esta organización no está disponible'),
      field('org_publica_cargando', 'Mensaje de carga', 60, 'Cargando la organización…'),
    ],
  },
  {
    id: 'asistente_textos', label: 'Asistente (botón flotante y panel de chat)', section: 'Barra y pie', fields: [
      field('asistente_titulo_panel', 'Panel · Título', 60, 'Asistente de consulta'),
      field('asistente_nota_verificada', 'Panel · Nota «(consulta verificada)»', 60, '(consulta verificada)'),
      field('asistente_invitacion', 'Portada · Botón «Habla con el Asistente»', 60, 'Habla con el Asistente'),
    ],
  },
];

/** Compatibilidad con el editor de la seccion "Sobre PNMC". */
export const ABOUT_PNMC_TEXT_GROUPS: DefinicionDeGrupoDeTexto[] =
  WEB_TEXT_GROUPS.filter((group) => group.section === 'Sobre PNMC');

export const WEB_TEXT_FIELDS: DefinicionDeCampoDeTexto[] =
  WEB_TEXT_GROUPS.flatMap((group) => group.fields);

/** Texto compilado que se sirve cuando una clave no tiene version publicada. */
export const DEFAULT_TEXTS: Record<string, string> =
  Object.fromEntries(WEB_TEXT_FIELDS.map((f) => [f.key, f.defaultValue]));

export const WEB_TEXT_KEYS_LIST: DescriptorDeClaveDeTexto[] = WEB_TEXT_GROUPS.flatMap((group) =>
  group.fields.map((f) => ({ key: f.key, label: f.label, section: group.section, limit: f.limit })),
);

/** Busqueda por clave; evita el find() lineal que hacia el panel por cada campo. */
export const WEB_TEXT_KEY_INDEX: ReadonlyMap<string, DescriptorDeClaveDeTexto> =
  new Map(WEB_TEXT_KEYS_LIST.map((descriptor) => [descriptor.key, descriptor]));

/**
 * LAS PÁGINAS DEL PORTAL, en el orden y con los encabezados del menú lateral del CMS. Cada `section` es una
 * página real del sitio (o un conjunto de piezas de ella); `area` las agrupa como lo hace el portal: la
 * portada, el Plan, el Ecosistema con sus directorios, los contenidos, el mapa, la suscripción y cuenta, y
 * lo que sale en todas las páginas (barra principal, pie y página no encontrada).
 */
export const WEB_TEXT_SECTIONS: DefinicionDeSeccionDeTexto[] = [
  { section: 'Portada', pill: 'Portada', area: 'Inicio' },
  { section: 'PNMC', pill: 'PNMC', area: 'El Plan' },
  { section: 'Celebra la Música', pill: 'Celebra la Música', area: 'El Plan' },
  { section: 'Ecosistema', pill: 'Ecosistema', area: 'Ecosistema y directorios' },
  { section: 'Festivales', pill: 'Festivales', area: 'Ecosistema y directorios' },
  { section: 'Mercados musicales', pill: 'Mercados musicales', area: 'Ecosistema y directorios' },
  { section: 'Lutería', pill: 'Lutería', area: 'Ecosistema y directorios' },
  { section: 'Espacios en vivo', pill: 'Espacios en vivo', area: 'Ecosistema y directorios' },
  { section: 'Redes y documentación', pill: 'Redes y documentación', area: 'Ecosistema y directorios' },
  { section: 'Territorios sonoros', pill: 'Territorios sonoros', area: 'Ecosistema y directorios' },
  { section: 'Prácticas musicales', pill: 'Prácticas musicales', area: 'Ecosistema y directorios' },
  { section: 'Agentes y actores', pill: 'Agentes y actores', area: 'Ecosistema y directorios' },
  { section: 'Agenda de citas', pill: 'Agenda de citas', area: 'Ecosistema y directorios' },
  { section: 'Noticias', pill: 'Noticias', area: 'Contenidos' },
  { section: 'Agenda', pill: 'Agenda', area: 'Contenidos' },
  { section: 'Editorial', pill: 'Editorial', area: 'Contenidos' },
  { section: 'Galería', pill: 'Galería', area: 'Contenidos' },
  { section: 'Mapa ecosistémico', pill: 'Mapa', area: 'Mapa' },
  { section: 'Sobre el mapa', pill: 'Sobre el mapa', area: 'Mapa' },
  { section: 'Boletín', pill: 'Boletín', area: 'Suscripción y cuenta' },
  { section: 'Políticas', pill: 'Políticas', area: 'Suscripción y cuenta' },
  { section: 'Registro', pill: 'Registro', area: 'Suscripción y cuenta' },
  { section: 'Barra y pie', pill: 'Barra principal y pie', area: 'En todas las páginas' },
];
