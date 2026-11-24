/**
 * Qué grupos de la barra lateral de la consola están plegados, y cómo se recuerda.
 *
 * <b>POR QUÉ SE PLIEGAN (UI-06, decisión 1 de `docs/desarrollo/30-consola-y-acceso.md`).</b> Con diecinueve secciones, la lista
 * mide más que la ventana de un portátil (a 1280×800 desborda 172 px) y el desplazamiento esconde
 * justo lo que está al final. Antes se descartó plegar «porque esconde destinos detrás de un clic»;
 * la dirección de producto lo aprobó después con dos condiciones que este módulo cumple: la
 * elección se RECUERDA (nadie vuelve a desplegar lo mismo en cada visita) y un grupo con la sección
 * que se está viendo NUNCA se esconde (nadie pierde de vista dónde está).
 *
 * <b>POR OMISIÓN.</b> Quedan plegados «Sitio web y comunicación» y «Gobierno y control»: son los
 * grupos de menor uso diario y, juntos, los que desbordan. Lo que la persona elija explícitamente
 * manda sobre la omisión, en un sentido y en otro.
 *
 * Es una función pura sobre un almacén mínimo (`getItem`/`setItem`) para poder probarla sin
 * navegador y para que un almacén que falla —modo privado, cuota— no rompa la consola: sin
 * almacenamiento, la barra funciona igual y solo olvida.
 */

/** Qué grupos están plegados por omisión (los demás, desplegados). */
export const GRUPOS_PLEGADOS_POR_OMISION: readonly string[] = ['sitio', 'gobierno'];

export const CLAVE_GRUPOS_PLEGADOS = 'simus.consola.grupos-plegados';

/** La elección explícita de cada grupo: `true` es plegado. Lo que falta, sigue la omisión. */
export type EleccionDePlegado = Readonly<Record<string, boolean>>;

/** Lo mínimo que se pide a un almacén: `Storage` lo cumple, y una prueba puede darle un objeto. */
export interface AlmacenDePlegado {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/**
 * La clave del almacén de otra barra (UI-E: el panel de la organización usa esta misma lógica con la
 * suya). Sin ella, la de la consola.
 */
function claveDe(cuenta: string | null | undefined, clave: string = CLAVE_GRUPOS_PLEGADOS): string {
  return `${clave}.${cuenta || 'anonima'}`;
}

/** La elección guardada de esa cuenta, o vacía si no hay almacén, no hay nada o está dañada. */
export function leerEleccionDePlegado(
  almacen: AlmacenDePlegado | null | undefined,
  cuenta: string | null | undefined,
  clave: string = CLAVE_GRUPOS_PLEGADOS,
): EleccionDePlegado {
  if (!almacen) return {};
  try {
    const crudo = almacen.getItem(claveDe(cuenta, clave));
    if (!crudo) return {};
    const dato: unknown = JSON.parse(crudo);
    if (!dato || typeof dato !== 'object' || Array.isArray(dato)) return {};
    const limpio: Record<string, boolean> = {};
    for (const [grupo, plegado] of Object.entries(dato as Record<string, unknown>)) {
      if (typeof plegado === 'boolean') limpio[grupo] = plegado;
    }
    return limpio;
  } catch {
    return {};
  }
}

/** Guarda la elección; un almacén que falla no es un error de la consola. */
export function guardarEleccionDePlegado(
  almacen: AlmacenDePlegado | null | undefined,
  cuenta: string | null | undefined,
  eleccion: EleccionDePlegado,
  clave: string = CLAVE_GRUPOS_PLEGADOS,
): void {
  if (!almacen) return;
  try {
    almacen.setItem(claveDe(cuenta, clave), JSON.stringify(eleccion));
  } catch {
    /* sin almacenamiento: la barra funciona igual, solo olvida */
  }
}

/**
 * Si el grupo se dibuja plegado.
 *
 * Un grupo que contiene la sección activa NUNCA se pliega: es la regla que impide perder de vista
 * dónde se está. Para los demás, manda la elección guardada y, a falta de ella, la omisión.
 */
export function grupoPlegado(
  grupo: string,
  eleccion: EleccionDePlegado,
  contieneLaSeccionActiva: boolean,
  porOmision: readonly string[] = GRUPOS_PLEGADOS_POR_OMISION,
): boolean {
  if (contieneLaSeccionActiva) return false;
  const guardada = eleccion[grupo];
  return guardada !== undefined ? guardada : porOmision.includes(grupo);
}

/** La elección que resulta de pulsar el título de un grupo (el contrario de como se ve ahora). */
export function alternarPlegado(
  grupo: string,
  eleccion: EleccionDePlegado,
  plegadoAhora: boolean,
): EleccionDePlegado {
  return { ...eleccion, [grupo]: !plegadoAhora };
}
