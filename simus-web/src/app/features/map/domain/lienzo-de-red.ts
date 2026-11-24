/**
 * Las reglas del lienzo del grafo (marco, zoom intencional, encuadre), sin tocar el DOM ni ECharts:
 * así se prueban con números. Las cajas van en píxeles de pantalla (`getBoundingClientRect`).
 */
export interface Caja { readonly izquierda: number; readonly arriba: number; readonly derecha: number; readonly abajo: number }

export const ZOOM_MINIMO = 0.35;
export const ZOOM_MAXIMO = 6;
/** Cuánto zoom suman los botones y el teclado en cada paso. */
export const PASO_DE_ZOOM = 1.25;
/** Cuánto se mueve la vista con cada flecha, en píxeles. */
export const PASO_DE_DESPLAZAMIENTO = 48;
/** Aire entre el grafo y el borde del marco al encuadrar. */
export const MARGEN_DEL_ENCUADRE = 20;
/** Cuántos píxeles del grafo deben quedar siempre a la vista: así nunca se «pierde» al arrastrar. */
export const VISIBLE_MINIMO = 64;

export type DecisionDeRueda = 'zoom' | 'pagina';

/**
 * La rueda solo acerca o aleja con Ctrl o ⌘ (el gesto de pellizco del trackpad llega como Ctrl + rueda), con el lienzo
 * activado o en modo ampliado. En cualquier otro caso la rueda sigue siendo de la página: se desplaza el documento.
 */
export function decisionDeRueda(evento: { ctrlKey: boolean; metaKey: boolean }, estado: { activo: boolean; ampliado: boolean }): DecisionDeRueda {
  return evento.ctrlKey || evento.metaKey || estado.activo || estado.ampliado ? 'zoom' : 'pagina';
}

export function cajaUnida(cajas: readonly Caja[]): Caja | null {
  const validas = cajas.filter((c) => Number.isFinite(c.izquierda + c.arriba + c.derecha + c.abajo) && c.derecha - c.izquierda > 0 && c.abajo - c.arriba > 0);
  if (validas.length === 0) return null;
  return {
    izquierda: Math.min(...validas.map((c) => c.izquierda)), arriba: Math.min(...validas.map((c) => c.arriba)),
    derecha: Math.max(...validas.map((c) => c.derecha)), abajo: Math.max(...validas.map((c) => c.abajo)),
  };
}

export const cabeEnElMarco = (caja: Caja, marco: Caja, tolerancia = 1): boolean =>
  caja.izquierda >= marco.izquierda - tolerancia && caja.arriba >= marco.arriba - tolerancia
  && caja.derecha <= marco.derecha + tolerancia && caja.abajo <= marco.abajo + tolerancia;

export interface Correccion { readonly zoom: number; readonly dx: number; readonly dy: number; readonly origenX: number; readonly origenY: number }

/** Qué zoom y desplazamiento hacen falta para que `caja` quede centrada y dentro de `marco`, con margen. */
export function correccionParaEncuadrar(caja: Caja, marco: Caja, margen = MARGEN_DEL_ENCUADRE, crecimientoMaximo = 1.6): Correccion {
  const ancho = caja.derecha - caja.izquierda;
  const alto = caja.abajo - caja.arriba;
  const util = (valor: number) => Math.max(1, valor - 2 * margen);
  const ideal = Math.min(util(marco.derecha - marco.izquierda) / ancho, util(marco.abajo - marco.arriba) / alto);
  const zoom = Math.min(ideal, crecimientoMaximo);
  const cx = (caja.izquierda + caja.derecha) / 2;
  const cy = (caja.arriba + caja.abajo) / 2;
  return {
    zoom, origenX: cx - marco.izquierda, origenY: cy - marco.arriba,
    dx: (marco.izquierda + marco.derecha) / 2 - cx, dy: (marco.arriba + marco.abajo) / 2 - cy,
  };
}

/** Cuánto hay que devolver la vista para que al menos `visible` píxeles del grafo sigan dentro del marco (0 si ya lo están). */
export function correccionDeDesplazamiento(caja: Caja, marco: Caja, visible = VISIBLE_MINIMO): { dx: number; dy: number } {
  const v = Math.min(visible, caja.derecha - caja.izquierda, caja.abajo - caja.arriba);
  let dx = 0;
  let dy = 0;
  if (caja.derecha < marco.izquierda + v) dx = marco.izquierda + v - caja.derecha;
  else if (caja.izquierda > marco.derecha - v) dx = marco.derecha - v - caja.izquierda;
  if (caja.abajo < marco.arriba + v) dy = marco.arriba + v - caja.abajo;
  else if (caja.arriba > marco.abajo - v) dy = marco.abajo - v - caja.arriba;
  return { dx, dy };
}

/** El nivel de zoom que se muestra: 100 % es la vista encuadrada. */
export const porcentajeDeZoom = (zoom: number, base: number): number => Math.round((zoom / (base || 1)) * 100);

/** Pasa de un zoom absoluto al factor que hay que aplicar para llegar al siguiente, respetando los límites. */
export function factorDeZoom(actual: number, factor: number): number {
  const destino = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, actual * factor));
  return destino / actual;
}
