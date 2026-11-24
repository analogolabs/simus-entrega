import { CATEGORIAS_ECOSISTEMA } from '../services/categorias-ecosistema.config';

/**
 * EL CATÁLOGO ÚNICO DE TIPOS DE PROCESO del espacio externo (PANEL, decisión 126).
 *
 * <b>LAS PESTAÑAS SON EL TIPO; EL ESTADO ES UN FILTRO.</b> Procesos, Solicitudes, Eventos y «Mi actividad y
 * solicitudes» de Mi espacio se leen por tipo de proceso —Festivales, Mercados, Redes, Lutería, Espacios— y el
 * estado (en revisión, publicado, ajustes…) afina la lista desde un desplegable con conteos. Una sola lista de
 * tipos para las cuatro pantallas, en el orden fijo del Ecosistema (decisión 118: el de los directorios públicos).
 */
export type TipoDeProceso = 'festivales' | 'mercados' | 'redes' | 'luteria' | 'espacios';

export interface TipoDeProcesoInfo {
  clave: TipoDeProceso;
  /** Singular, para una fila («Festival»). */
  nombre: string;
  /** Plural, para listas y desplegables («Talleres de lutería»). */
  etiquetaDeLista: string;
  /** El rótulo de la pestaña: el del Ecosistema. */
  etiquetaDePestana: string;
  accion: string;
  /** La dirección de su lista dentro del panel de una organización. */
  ruta: string;
  descripcion: string;
}

const DATOS: Record<TipoDeProceso, Omit<TipoDeProcesoInfo, 'clave'>> = {
  festivales: { nombre: 'Festival', etiquetaDeLista: 'Festivales', etiquetaDePestana: 'Festivales', accion: 'Registrar Festival', ruta: 'procesos/festivales',
    descripcion: 'Registro y gestión de la información permanente del Festival, sus ediciones y su publicación en el ecosistema.' },
  mercados: { nombre: 'Mercado musical', etiquetaDeLista: 'Mercados musicales', etiquetaDePestana: 'Mercados', accion: 'Registrar Mercado', ruta: 'procesos/mercados',
    descripcion: 'Nodos de intercambio, visibilización y profesionalización. Puede ser independiente o realizarse en el marco de uno de tus Festivales.' },
  redes: { nombre: 'Red o centro de documentación', etiquetaDeLista: 'Redes y centros de documentación', etiquetaDePestana: 'Redes y documentación', accion: 'Registrar red', ruta: 'procesos/redes',
    descripcion: 'Redes, archivos y centros de documentación musical: qué acervos tienen y cómo se consultan. Sus jornadas y conversatorios se anuncian como eventos de la Agenda.' },
  luteria: { nombre: 'Taller de lutería', etiquetaDeLista: 'Talleres de lutería', etiquetaDePestana: 'Lutería', accion: 'Registrar Taller', ruta: 'procesos/luteria',
    descripcion: 'Dónde se construyen, reparan, restauran o enseñan a hacer instrumentos. Sus jornadas y clases se anuncian como eventos de la Agenda.' },
  espacios: { nombre: 'Espacio para música en vivo', etiquetaDeLista: 'Espacios para música en vivo', etiquetaDePestana: 'Espacios para música en vivo', accion: 'Registrar espacio', ruta: 'procesos/espacios',
    descripcion: 'Dónde se presenta música en vivo: bares, salas, teatros, casas de cultura y escenarios. Sus conciertos y ciclos se anuncian como eventos de la Agenda.' },
};

/** El título del Ecosistema de cada tipo: de ahí sale el ORDEN, para que no haya una segunda lista que diverja. */
const TITULO_EN_EL_ECOSISTEMA: Record<TipoDeProceso, string> = {
  festivales: 'Festivales', mercados: 'Mercados musicales', redes: 'Redes y documentación', luteria: 'Lutería', espacios: 'Espacios para música en vivo',
};

function posicion(clave: TipoDeProceso): number {
  const i = CATEGORIAS_ECOSISTEMA.findIndex(c => c.title === TITULO_EN_EL_ECOSISTEMA[clave]);
  return i < 0 ? 99 : i;
}

export const TIPOS_DE_PROCESO: readonly TipoDeProcesoInfo[] = (Object.keys(DATOS) as TipoDeProceso[])
  .sort((a, b) => posicion(a) - posicion(b))
  .map(clave => ({ clave, ...DATOS[clave] }));

/**
 * A qué tipo de proceso pertenece algo que solo trae una dirección (una solicitud) o una clave de tipo (un evento).
 * Lo que no es de un proceso —una invitación, una cita— devuelve `null` y se lee bajo «Citas e invitaciones».
 */
export function tipoDeProcesoDeLaRuta(ruta: string | null | undefined): TipoDeProceso | null {
  const r = (ruta ?? '').split(/[?#]/)[0];
  if (/\/festivales(\/|$)/.test(r)) return 'festivales';
  if (/\/mercados(\/|$)/.test(r)) return 'mercados';
  if (/\/luteria(\/|$)|\/talleres(\/|$)/.test(r)) return 'luteria';
  if (/\/espacios(\/|$)/.test(r)) return 'espacios';
  if (/\/redes(\/|$)/.test(r)) return 'redes';
  return null;
}
