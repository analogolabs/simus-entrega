import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';
import { identidadDePantalla } from './desplazamiento-al-navegar';

/**
 * Cuándo una navegación lleva el fundido cruzado entre pantallas, y cuándo no.
 *
 * <b>UNA TRANSICIÓN DISCRETA Y FUNCIONAL.</b> Es la API nativa de transiciones de vista del navegador, activada con
 * `withViewTransitions` en `app.config.ts`: un fundido cruzado de `--dur-media` (200 ms) entre la pantalla que se va
 * y la que llega. No mueve nada (solo `opacity`), así que no puede producir desplazamiento de diseño. En un navegador
 * sin la API, Angular navega como siempre: es una mejora progresiva, no un requisito.
 *
 * <b>LA MISMA REGLA QUE EL DESPLAZAMIENTO: SE ANIMA CUANDO CAMBIA LA PANTALLA, NO SU ESTADO.</b> Filtrar, ordenar,
 * paginar, abrir una ficha que no monta pantalla o ir a un ancla cambian la dirección pero no la pantalla; animarlos
 * parpadearía la lista bajo la mano de quien la está usando. Se reutiliza `identidadDePantalla`, la definición
 * comprobada de «pantalla».
 *
 * <b>CON «REDUCIR MOVIMIENTO» NO HAY TRANSICIÓN</b> (WCAG 2.3.3): se salta la animación y el cambio es instantáneo.
 */
export function debeAnimarseLaNavegacion(origen: ActivatedRouteSnapshot, destino: ActivatedRouteSnapshot, movimientoReducido: boolean): boolean {
  if (movimientoReducido) return false;
  return identidadDePantalla(origen.root) !== identidadDePantalla(destino.root);
}

/** El gancho que pasa `withViewTransitions({ onViewTransitionCreated })`. */
export function alCrearseLaTransicion({ transition, from, to }: ViewTransitionInfo): void {
  const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!debeAnimarseLaNavegacion(from, to, reducido)) transition.skipTransition();
}
