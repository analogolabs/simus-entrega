/**
 * EL MENÚ LATERAL DEL ESPACIO EXTERNO: qué forma toma según el ancho y qué se recuerda (gestión externa).
 *
 * Lógica pura, sin Angular, para poder probarla sin montar nada. Reglas (prototipo B4 aprobado):
 *  - menos de 700 px: no hay columna; la navegación pasa a una barra inferior con «Más»;
 *  - de 700 a 1099 px (tableta): riel de iconos siempre, con expansión superpuesta a demanda;
 *  - desde 1100 px (escritorio): menú abierto o riel. Sin elección, manda el ancho (riel por debajo de 1280 px);
 *    con elección, manda la elección, y vuelve a lo automático si el ancho cambia mucho respecto de aquel en que se eligió.
 */

export type ModoDelMenu = 'movil' | 'tableta' | 'escritorio';
export type FormaDelMenu = 'riel' | 'abierto';

/** La elección de una persona: la forma que pidió y el ancho de ventana en que la pidió. */
export interface EleccionDelMenu { forma: FormaDelMenu; ancho: number }

export const ANCHO_MINIMO_DE_TABLETA = 700;
export const ANCHO_MINIMO_DE_ESCRITORIO = 1100;
/** Por debajo de este ancho, sin elección guardada, el menú se contrae solo. */
export const ANCHO_PARA_EXPANDIR_SOLO = 1280;
/** Cuánto puede cambiar el ancho respecto del de la elección antes de que se olvide. */
export const CAMBIO_MAXIMO_DE_ANCHO = 400;
export const CLAVE_DEL_MENU = 'simus.gestion.menu-lateral';

export function modoPorAncho(ancho: number): ModoDelMenu {
  return ancho < ANCHO_MINIMO_DE_TABLETA ? 'movil' : ancho < ANCHO_MINIMO_DE_ESCRITORIO ? 'tableta' : 'escritorio';
}

/** ¿Va el menú en riel (solo iconos)? En móvil no hay columna y la respuesta es no. */
export function estaEnRiel(ancho: number, eleccion: EleccionDelMenu | null): boolean {
  const modo = modoPorAncho(ancho);
  if (modo === 'movil') return false;
  if (modo === 'tableta') return true;
  const vigente = !!eleccion && eleccion.ancho >= ANCHO_MINIMO_DE_ESCRITORIO && Math.abs(ancho - eleccion.ancho) <= CAMBIO_MAXIMO_DE_ANCHO;
  return vigente ? eleccion!.forma === 'riel' : ancho < ANCHO_PARA_EXPANDIR_SOLO;
}

export function leerEleccionDelMenu(almacen: Storage | null): EleccionDelMenu | null {
  try {
    const crudo = almacen?.getItem(CLAVE_DEL_MENU);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as Partial<EleccionDelMenu> | null;
    if ((dato?.forma === 'riel' || dato?.forma === 'abierto') && typeof dato.ancho === 'number' && Number.isFinite(dato.ancho)) {
      return { forma: dato.forma, ancho: dato.ancho };
    }
  } catch { /* almacenamiento o contenido inservible: sin elección */ }
  return null;
}

export function guardarEleccionDelMenu(almacen: Storage | null, eleccion: EleccionDelMenu): void {
  try { almacen?.setItem(CLAVE_DEL_MENU, JSON.stringify(eleccion)); } catch { /* sin almacenamiento: vale por esta visita */ }
}

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'para', 'por']);

/** Las dos iniciales de un nombre, sin conectores («Corporación Cultural Cantaclaro» → «CC»). Vacío si no hay nombre. */
export function inicialesDe(nombre: string | null | undefined): string {
  const palabras = (nombre ?? '').split(/\s+/).map(p => p.replace(/^[^\p{L}\p{N}]+/u, '')).filter(p => p && !CONECTORES.has(p.toLowerCase()));
  return palabras.slice(0, 2).map(p => p.charAt(0).toLocaleUpperCase('es')).join('');
}
