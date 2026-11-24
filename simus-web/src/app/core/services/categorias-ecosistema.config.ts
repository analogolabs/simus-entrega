export interface CategoriaEcosistema {
  title: string;
  /**
   * A dónde lleva la tarjeta. Solo la declara el proceso que TIENE pantalla.
   *
   * ERA OBLIGATORIA Y LAS SEIS LA TENIAN, pero cinco apuntaban a rutas que no existen en el
   * enrutador: `ecosistema/escuelas`, `escenarios`, `mercados-musicales`, `redes-documentacion`
   * y `luteria`. No llegaban a romperse porque los dos consumidores comprueban antes
   * `status !== 'Disponible'`, así que era una trampa dormida: el día que alguien marcara uno
   * como disponible —el gesto natural al terminarlo— la tarjeta llevaría al comodín de
   * «página no encontrada», y el fallo aparecería lejos de ese cambio de una palabra.
   *
   * Ahora el tipo lo impide: sin ruta no hay a dónde ir, y `abrirCategoria` no puede navegar.
   */
  route?: string;
  layer: string;
  /**
   * Rótulo corto para los controles estrechos (las pastillas de capas del mapa). Solo lo declaran
   * los procesos que tienen capa propia en el mapa.
   */
  etiquetaCorta?: string;
  description: string;
  status: 'Disponible' | 'Próximamente';
  icon: 'groups' | 'agents' | 'spaces' | 'festivals' | 'markets' | 'networks' | 'luthier';
  /**
   * De donde sale el recuento de la tarjeta.
   *
   * Los cinco procesos tienen clave: sus cifras salen de los directorios públicos. Una tarjeta sin clave
   * no muestra cifra en vez de un cero sin contexto.
   */
  countKey?: 'festivals' | 'markets' | 'networks' | 'lutiers' | 'spaces';

  /**
   * Marca los procesos del Ecosistema. Los cinco están implementados y «Disponibles».
   *
   * <b>EL ESTADO DE ESTA LISTA ES LA ÚNICA BANDERA.</b> Un proceso con `status: 'Próximamente'` se
   * anuncia —en la portada del Ecosistema, el menú y las pastillas del mapa— y uno sin `route` no se
   * ofrece como control. Hoy ninguno lo está. El día que se sume un proceso, se declara aquí su
   * `route` y su `status` y esas superficies lo reflejan sin
   * tocar nada más.
   *
   * ESCUELAS DE MÚSICA QUEDA FUERA (10 nov 2026): la dirección decidió mantenerlo fuera por ahora.
   * No se anuncia como próximo: si vuelve, se añade aquí con su modelo.
   *
   * DESDE EL 30 DE AGOSTO DE 2026 UNA SOLA LISTA. Hasta ese dia habia ocho: sobraban
   * «Agrupaciones» y «Agentes», que no tienen ni tabla ni endpoint y cuyo boton caia en una
   * pagina en construccion. Las retiro la direccion de producto al pedir un solo inventario: «que
   * tengamos el mismo lugar de llegada, ahora son diferentes». El menu superior y la vista previa
   * del Inicio ya ofrecian solo estos seis —la vista previa filtra justamente por `proceso`—, asi
   * que la portada era la unica de las tres superficies que ofrecia otra cosa.
   */
  proceso?: boolean;

  /**
   * Si HOY existe un endpoint externo para que una organizacion lo cree.
   *
   * Festivales y Mercados. Los procesos que aún no existen muestran el botón desactivado en vez
   * de esconderlo, para que se vea que el sitio los contempla.
   */
  altaExterna?: boolean;
}

/**
 * Los procesos del ecosistema musical, en el orden en que se leen.
 *
 * UNA SOLA LISTA PARA LAS SUPERFICIES que ofrecen el ecosistema: la portada de `/ecosistema`, el
 * desplegable del menú superior, la vista previa del Inicio, el menú de «Registrar» del panel de la
 * organización y las pastillas de capas del mapa. Antes eran inventarios distintos y el visitante
 * llegaba a un sitio u otro según por dónde entrara.
 */
/*
  SE SIGUEN POR EL TITULO Y NO POR LA RUTA en las tres superficies que las pintan. Un proceso que
  todavía no tiene directorio público no tiene `route`, así que `track category.route` daba
  `undefined` para varios a la vez y Angular lo avisaba con NG0955 en cada pintado: con claves
  repetidas deja de poder reutilizar los nodos y vuelve a crearlos enteros. El título es único y
  existe siempre.
*/
export const CATEGORIAS_ECOSISTEMA: CategoriaEcosistema[] = [
  { title: 'Festivales', route: 'ecosistema/festivales', layer: 'Festivales', description: 'Celebraciones, encuentros y circuitos de circulación.', status: 'Disponible', icon: 'festivals', countKey: 'festivals', proceso: true, altaExterna: true },
  // MERCADOS MUSICALES DEJA DE ESTAR «PROXIMAMENTE»: tiene modelo,
  // circuito de revisión, alta desde la organización, directorio público y capa en el mapa. Es el
  // segundo proceso disponible, y el primero de los cinco que estaban en definición que se
  // completa. Con `altaExterna` porque una organización puede registrarlo desde su panel.
  { title: 'Mercados musicales', route: 'ecosistema/mercados-musicales', layer: 'Mercados Musicales', description: 'Nodos de intercambio, visibilización y profesionalización.', status: 'Disponible', icon: 'markets', countKey: 'markets', proceso: true, altaExterna: true },
  // REDES Y DOCUMENTACIÓN PASA A «DISPONIBLE» (10 nov 2026): tiene modelo, revisión, alta desde la organización o
  // desde la propia persona, directorio público y capa en el mapa.
  { title: 'Redes y documentación', route: 'ecosistema/redes', layer: 'Redes de Documentación', etiquetaCorta: 'Redes doc.', description: 'Memoria, archivos, investigación y redes de conocimiento musical.', status: 'Disponible', icon: 'networks', proceso: true },
  // LUTERÍA PASA A «DISPONIBLE» (10 nov 2026): tiene modelo, revisión, alta desde la organización o
  // desde la propia persona (el lutier independiente), directorio público y capa en el mapa.
  { title: 'Lutería', route: 'ecosistema/luteria', layer: 'Lutieres', etiquetaCorta: 'Lutería', description: 'Talleres, saberes, construcción y reparación de instrumentos.', status: 'Disponible', icon: 'luthier', countKey: 'lutiers', proceso: true, altaExterna: true },
  // ESPACIOS PARA MÚSICA EN VIVO es el nombre público de lo que el inventario interno llama
  // «Escenarios» (decisión del 10 nov 2026). Su capa en el mapa lleva el mismo nombre.
  // ESPACIOS PASA A «DISPONIBLE» (10 nov 2026): tiene modelo, revisión, alta desde la organización o desde la propia
  // persona (el responsable independiente), directorio público y capa en el mapa.
  { title: 'Espacios para música en vivo', route: 'ecosistema/espacios', layer: 'Espacios', etiquetaCorta: 'Espacios', description: 'Salas, teatros, casas de cultura y otros lugares donde se hace música en vivo.', status: 'Disponible', icon: 'spaces', countKey: 'spaces', proceso: true, altaExterna: true },
];

/**
 * ORDEN FIJO DE LOS PROCESOS (decisión 118): Festivales, Mercados musicales, Redes y documentación,
 * Lutería y Espacios para música en vivo. Es el orden de ESTA lista: toda superficie que ofrezca
 * los procesos (portada del Ecosistema, menú, panel, pastillas del mapa) lo hereda de aquí y no
 * lo repite.
 */

/**
 * PROCESO ACTIVO = estado «Disponible» Y directorio público al que llevar (`route`). Es la misma
 * bandera única de la lista: un proceso en «Próximamente», o sin pantalla, no se ofrece como
 * directorio. Conserva el orden de `CATEGORIAS_ECOSISTEMA`.
 */
export function procesosActivos(categorias: readonly CategoriaEcosistema[] = CATEGORIAS_ECOSISTEMA): CategoriaEcosistema[] {
  return categorias.filter(categoria => categoria.proceso && categoria.status === 'Disponible' && !!categoria.route);
}
