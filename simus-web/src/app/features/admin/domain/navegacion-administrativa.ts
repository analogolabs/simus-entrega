export type IdSeccionAdministrativa =
  | 'monitor'
  | 'solicitudes'
  | 'calidad'
  | 'ecosistema'
  | 'mercados'
  | 'procesos'
  | 'organizaciones'
  | 'catalogo-editorial'
  | 'agenda'
  | 'noticias'
  | 'banco-de-archivos'
  | 'celebra'
  | 'categorias'
  | 'catalogos'
  | 'galeria'
  | 'gestion-sitio'
  | 'boletin'
  | 'analisis'
  | 'auditoria'
  | 'usuarios'
  | 'sistema';

export interface SeccionAdministrativa {
  id: IdSeccionAdministrativa;
  ruta: string;
  titulo: string;
  /**
   * El rótulo CORTO con el que la sección aparece en la barra lateral (UI-04, decisión 6 de
   * `docs/desarrollo/30-consola-y-acceso.md`). El título completo sigue siendo el de la página, el del buscador de secciones y el
   * del `title` de la entrada: la barra mide 272 px y un rótulo de una sola línea se recorre mejor
   * que uno partido en dos. Sin rótulo, la barra usa el título.
   */
  rotulo?: string;
  descripcion: string;
  icono?: string;
  /**
   * Cómo la llama quien busca por TAREA y no por nombre: «publicar», «correo», «contraseña».
   *
   * El buscador de la cabecera solo encontraba títulos: «publicar» respondía «Ninguna sección se
   * llama así», aunque se publica desde cinco secciones. Estas palabras son los sinónimos por tarea;
   * se comparan sin tildes y sin mayúsculas.
   */
  palabrasClave?: readonly string[];
  rolesPermitidos?: readonly string[];
  /**
   * Rutas con las que esta sección se publicó antes y que deben seguir abriéndola.
   *
   * NO ES DECORATIVO: cuando una ruta desaparece, `seccionAdministrativaPorRuta` no la
   * encuentra y el armazón cae en «Resumen». Es decir, un enlace guardado no daría error
   * —daría OTRA pantalla, en silencio—, que es la forma más cara de romper un enlace.
   */
  rutasAnteriores?: readonly string[];
}

export interface GrupoAdministrativo {
  id: 'bandeja' | 'ecosistema' | 'publicaciones' | 'sitio' | 'gobierno';
  titulo: string;
  secciones: readonly SeccionAdministrativa[];
}

/**
 * La arquitectura visible del Espacio de Gestión Administrativa reorganizada en cinco
 * familias de negocio cultural:
 * 1. Bandeja de Trabajo: Triage y decisiones inmediatas de solicitudes y calidad.
 * 2. Ecosistema Musical: Actores y procesos territoriales (Festivales, Organizaciones).
 * 3. Publicaciones y Mediateca: Catálogo Editorial, Agenda, Noticias, Categorías y Banco de archivos.
 * 4. Sitio Web y Comunicación: CMS de páginas del portal, medios y boletín.
 * 5. Gobierno y Control: Indicadores de análisis, auditoría legal y configuración del sistema.
 */
export const GRUPOS_DE_GESTION_ADMINISTRATIVA: readonly GrupoAdministrativo[] = [
  {
    id: 'bandeja',
    titulo: 'Bandeja de trabajo',
    secciones: [
      {
        id: 'monitor',
        ruta: 'resumen',
        titulo: 'Resumen operativo',
        rotulo: 'Resumen',
        descripcion: 'Prioridades, alertas inmediatas y pulso general de la gestión.',
        icono: 'LayoutDashboard',
        palabrasClave: ['inicio','panel','pendientes','alertas','cifras','prioridades'],
      },
      {
        id: 'solicitudes',
        ruta: 'solicitudes',
        titulo: 'Solicitudes y revisiones',
        rotulo: 'Solicitudes',
        // LA DESCRIPCION PROMETIA LO QUE LA PANTALLA NO HACE. Decía «expande una fila para
        // revisarla y decidir sin salir de aquí», y medido: nueve de las diez filas de la bandeja no
        // ofrecen ninguna decisión al desplegarse, porque un registro inicial de festival se revisa
        // en su ficha completa. Ahora lo dice como es.
        descripcion: 'Todo lo que espera una decisión: registros nuevos, cambios, eliminaciones, reclamaciones, vinculaciones, posibles duplicados y alertas de calidad. Unos se deciden aquí mismo; los registros completos se revisan en su ficha.',
        icono: 'Inbox',
        palabrasClave: ['bandeja','decidir','aprobar','rechazar','revisar','publicar festival','pedir ajustes','reclamaciones','duplicados','eliminaciones','vinculaciones'],
        // UNA SOLA BANDEJA, Y POR ESO ESTA SECCION ABSORBE DOS RUTAS ANTIGUAS.
        //
        // «Calidad y coincidencias» -antes «Gobernanza»- era una segunda seccion con cinco
        // pestañas, y tres de ellas -Eliminaciones, Reclamaciones, Vinculaciones- listaban
        // EXACTAMENTE los mismos trámites que esta bandeja, leídos de los mismos dos endpoints,
        // pero con otra interfaz de decisión. Dos caminos al mismo asunto que podían divergir en
        // cuanto uno cambiara. Las otras dos -Duplicados y Alertas- son hallazgos del sistema y
        // entraron aquí como dos posiciones más del filtro.
        //
        // Lo decidió la dirección de producto, tras preguntar si el
        // apartado debía estar aparte o podía ser una categoría más de la vista general.
        rutasAnteriores: ['calidad', 'gobernanza'],
      },
    ],
  },
  {
    id: 'ecosistema',
    titulo: 'Ecosistema musical',
    secciones: [
      {
        id: 'ecosistema',
        ruta: 'festivales',
        titulo: 'Festivales y ediciones',
        rotulo: 'Festivales',
        descripcion: 'Catálogo de Festivales, historial de cambios e importación asistida.',
        icono: 'Music',
        palabrasClave: ['festival','ediciones','importar festivales','plantilla','registrar festival','publicar festival'],
        rutasAnteriores: ['ecosistema'],
      },
      {
        id: 'mercados',
        ruta: 'mercados',
        titulo: 'Mercados musicales',
        rotulo: 'Mercados',
        descripcion: 'Mercados del ecosistema, sus ediciones y su relación con festivales.',
        icono: 'Store',
        palabrasClave: ['mercado','ediciones de mercado','plantilla','publicar mercado'],
      },
      {
        // UNA SOLA LISTA PARA LOS TRES PROCESOS (decisión 132). Lutería, Espacios y Redes tenían cada uno su
        // sección con la misma lista copiada tres veces; ahora son las pestañas de esta lista y la dirección
        // `?tipo=` abre la que se pida. Las rutas de antes (`/talleres`, `/espacios`, `/redes`) redirigen aquí;
        // la ficha de cada proceso conserva la suya (`/administracion/talleres/{id}`).
        id: 'procesos',
        ruta: 'procesos',
        titulo: 'Procesos del ecosistema',
        rotulo: 'Lutería, espacios y redes',
        descripcion: 'Talleres de lutería, espacios para música en vivo, redes y centros de documentación: revisión, publicación, importación y retiro.',
        icono: 'Wrench',
        palabrasClave: ['taller','lutería','luteria','lutier','instrumentos','espacio','sala','bar','teatro','auditorio','escenario','música en vivo','casa de cultura','red','redes','documentación','documentacion','archivo','centro de documentación','acervo','fonoteca','procesos','importar'],
      },
      {
        id: 'organizaciones',
        ruta: 'organizaciones',
        titulo: 'Organizaciones y responsables',
        rotulo: 'Organizaciones',
        descripcion: 'Directorio de entidades gestoras, directores, personerías y relaciones.',
        icono: 'Building2',
        palabrasClave: ['entidades','responsables','directorio','nit','importar organizaciones'],
      },
    ],
  },
  {
    id: 'publicaciones',
    titulo: 'Publicaciones y mediateca',
    secciones: [
      {
        id: 'catalogo-editorial',
        ruta: 'catalogo-editorial',
        titulo: 'Catálogo Editorial',
        rotulo: 'Catálogo editorial',
        // LA DESCRIPCION DICE EL CRITERIO, NO REPITE EL TITULO. Decía «Fichas bibliográficas,
        // partituras, métodos pedagógicos…», que es lo mismo que ya dice el nombre de la sección y no
        // ayuda a decidir nada. Esta frase estaba dentro del panel, en un segundo encabezado que
        // repetía el título; al retirar ese encabezado se conserva lo único que el armazón no sabía.
        descripcion: 'Catalogar dice si la ficha está bien hecha. Publicar dice si se ve. Son dos decisiones distintas: una ficha validada puede quedarse sin publicar.',
        icono: 'BookOpen',
        palabrasClave: ['catalogar','validar','publicar publicacion','errata','libros','partituras','fichas','publicaciones','autorias'],
      },
      {
        id: 'agenda',
        ruta: 'agenda',
        titulo: 'Agenda y eventos',
        rotulo: 'Agenda',
        descripcion: 'Convocatorias, eventos y programación de actividades en territorio.',
        icono: 'Calendar',
        palabrasClave: ['eventos','convocatorias','programacion','publicar evento','calendario'],
      },
      {
        id: 'noticias',
        ruta: 'noticias',
        titulo: 'Noticias y prensa',
        rotulo: 'Noticias',
        descripcion: 'Publicaciones informativas, notas de prensa y comunicados oficiales del PNMC.',
        icono: 'Newspaper',
        palabrasClave: ['prensa','comunicados','publicar noticia','articulos'],
      },
      {
        id: 'categorias',
        ruta: 'categorias',
        titulo: 'Categorías y proyectos',
        rotulo: 'Categorías',
        descripcion: 'Catálogos de Editorial, Agenda y Noticias, y proyectos del PNMC vinculados con el contenido.',
        icono: 'Tags',
        palabrasClave: ['proyectos','etiquetas','clasificacion','temas'],
      },
      {
        // LA MISMA LLAVE QUE «CATEGORIAS»: son vocabularios controlados con el mismo trabajo editorial, así que no hay un
        // módulo nuevo que conceder (`puedeAbrir` y el servidor piden `categorias`).
        id: 'catalogos',
        ruta: 'catalogos',
        titulo: 'Catálogos',
        descripcion: 'Territorios sonoros y prácticas musicales, catálogos transversales de la plataforma: aquí se editan, se amplían y se ordenan, con la ficha de cada uno, tras la revisión misional del PNMC.',
        icono: 'BookMarked',
        palabrasClave: ['territorios','practicas','fichas','definiciones','importar','exportar','hoja de calculo','csv','ordenar'],
      },
      {
        // EL BANCO ES EL ALMACEN DE LO QUE SE ADJUNTA desde una ficha —el afiche de una Edición, la
        // foto de perfil de una organización, la imagen de una noticia—, y no el archivo
        // fotográfico del Programa. Ese archivo —la Galería— salió de la barra el 15 de septiembre
        // de 2026 por no tener panel ni circuito; volvió como la sección «Galería» (la entrada siguiente)
        // cuando tuvo ambos.
        id: 'banco-de-archivos',
        ruta: 'banco-de-archivos',
        titulo: 'Banco de archivos',
        descripcion: 'Las imágenes adjuntas a fichas, con su procedencia, dónde se usan y cuáles no usa nadie.',
        icono: 'Files',
        palabrasClave: ['imagenes','archivos','adjuntos','fotos','subir'],
      },
      {
        // LA MISMA LLAVE QUE «BANCO DE ARCHIVOS»: las fotos de los álbumes salen del Banco y la API de la Galería ya pedía ese módulo, así
        // que no hay un módulo nuevo que conceder (`puedeAbrir` y el servidor piden `banco-de-archivos`). Las cuentas existentes
        // conservan exactamente lo que podían hacer.
        id: 'galeria',
        ruta: 'galeria',
        titulo: 'Galería',
        descripcion: 'Álbumes de fotos y de videos de la Galería pública: crear, ordenar, destacar, publicar y retirar. Las fotos salen del Banco de archivos.',
        icono: 'Images',
        palabrasClave: ['albumes','fotos','videos','youtube','destacados','portada','archivo fotografico','publicar album','sin album'],
      },
      {
        // APARTADO PROPIO CON PERMISO PROPIO (23 nov 2026): solo lo abre quien tiene el módulo «celebra», que se concede
        // persona por persona en «Usuarios y roles». Antes era una pestaña de «Categorías y proyectos».
        id: 'celebra',
        ruta: 'celebra-la-musica',
        titulo: 'Celebra la Música',
        descripcion: 'Ediciones del micrositio «Celebra la Música»: contenido, aliados y logos, fondo, archivos y publicación. Solo para las personas a quienes se les concede.',
        icono: 'PartyPopper',
        palabrasClave: ['celebra','edicion','micrositio','aliados','logos','fondo','publicar','despublicar','festival'],
      },
    ],
  },
  {
    id: 'sitio',
    titulo: 'Sitio web y comunicación',
    secciones: [
      {
        id: 'gestion-sitio',
        ruta: 'gestion-del-sitio',
        titulo: 'CMS',
        rotulo: 'CMS',
        descripcion: 'Textos, imágenes y equipo de las páginas del portal, ordenados por página y bloque.',
        icono: 'Globe',
        palabrasClave: ['cms','textos','portada','imagenes del sitio','equipo','respaldos','publicar sitio','paginas','bloques'],
        rutasAnteriores: ['sitio-web'],
      },
      {
        id: 'boletin',
        ruta: 'boletin',
        titulo: 'Boletín informativo',
        rotulo: 'Boletín',
        descripcion: 'Consulta, bajas y exportación autorizada de suscripciones ciudadanas.',
        icono: 'Mail',
        palabrasClave: ['correo','suscripciones','suscriptores','newsletter','bajas','exportar'],
      },
    ],
  },
  {
    id: 'gobierno',
    titulo: 'Gobierno y control',
    secciones: [
      {
        id: 'analisis',
        ruta: 'analisis',
        titulo: 'Análisis y consultas',
        rotulo: 'Análisis',
        descripcion: 'Indicadores verificables y consultas agregadas sobre la operación vigente.',
        icono: 'BarChart3',
        palabrasClave: ['indicadores','consultas','estadisticas','cifras','reportes','graficos'],
      },
      {
        id: 'auditoria',
        ruta: 'auditoria',
        titulo: 'Auditoría y trazabilidad',
        rotulo: 'Auditoría',
        descripcion: 'Trazabilidad legal paginada de todas las actuaciones administrativas.',
        icono: 'FileText',
        palabrasClave: ['bitacora','accesos','inicios de sesion','quien hizo','trazabilidad','actuaciones','historial'],
      },
      {
        id: 'usuarios',
        ruta: 'usuarios',
        titulo: 'Usuarios y roles',
        descripcion: 'Cuentas institucionales, roles y control de acceso del Ministerio.',
        icono: 'Users',
        palabrasClave: ['cuentas','roles','permisos','contrasena','modulos','webmaster','gestor','crear usuario','desactivar usuario'],
        rolesPermitidos: ['webmaster'],
      },
      {
        id: 'sistema',
        ruta: 'sistema',
        titulo: 'Salud del sistema',
        rotulo: 'Sistema',
        descripcion: 'Salud de la API, capacidades informadas y telemetría técnica.',
        icono: 'Shield',
        palabrasClave: ['salud','estado','api','base de datos','tecnico','latencia','servidor'],
        rolesPermitidos: ['webmaster'],
      },
    ],
  },
] as const;

/**
 * Un destino del buscador que no es una sección entera sino una VISTA de una.
 *
 * Los perfiles públicos de personas se moderan dentro de Organizaciones, y no tenían entrada en la
 * barra ni en el buscador. Aquí se declaran para que quien busque «personas» o «ocultar perfil»
 * llegue a la pestaña correcta. `vista` es el valor del parámetro `?vista=` de la dirección.
 */
export interface VistaBuscable {
  seccion: IdSeccionAdministrativa;
  vista: string;
  titulo: string;
  palabrasClave: readonly string[];
}

export const VISTAS_BUSCABLES_DE_LA_CONSOLA: readonly VistaBuscable[] = [
  {
    seccion: 'organizaciones',
    vista: 'personas',
    titulo: 'Perfiles públicos de personas',
    palabrasClave: ['personas', 'perfiles', 'moderar', 'ocultar perfil', 'restablecer perfil', 'moderacion'],
  },
] as const;

export const SECCIONES_DE_GESTION_ADMINISTRATIVA = GRUPOS_DE_GESTION_ADMINISTRATIVA.flatMap(
  grupo => grupo.secciones,
);

export function seccionAdministrativaPorId(id: string): SeccionAdministrativa | undefined {
  return SECCIONES_DE_GESTION_ADMINISTRATIVA.find(seccion => seccion.id === id);
}

/** La familia a la que pertenece una sección: es lo que la cabecera de página enseña como miga. */
export function grupoAdministrativoDeSeccion(id: string): GrupoAdministrativo | undefined {
  return GRUPOS_DE_GESTION_ADMINISTRATIVA.find(grupo => grupo.secciones.some(seccion => seccion.id === id));
}

export function seccionAdministrativaPorRuta(ruta: string): SeccionAdministrativa | undefined {
  return SECCIONES_DE_GESTION_ADMINISTRATIVA.find(
    seccion => seccion.ruta === ruta || seccion.rutasAnteriores?.includes(ruta),
  );
}

export function gruposAdministrativosVisibles(roles: readonly string[]): GrupoAdministrativo[] {
  return GRUPOS_DE_GESTION_ADMINISTRATIVA
    .map(grupo => ({
      ...grupo,
      secciones: grupo.secciones.filter(
        seccion => !seccion.rolesPermitidos || roles.some(rol => seccion.rolesPermitidos?.includes(rol)),
      ),
    }))
    .filter(grupo => grupo.secciones.length > 0);
}
