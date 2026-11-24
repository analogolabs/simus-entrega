import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

/**
 * Pantallas de Mi espacio y del panel de una organización donde la burbuja del Asistente estorba: los asistentes de alta
 * («nuevo»/«nueva», «crear»), los editores de ficha («editar») y la agenda de citas, que es una aplicación con sus propios
 * controles. Con el panel ya abierto la burbuja se sigue pintando (hace de interruptor); lo decide el cajón.
 */
export const GESTION_SIN_ASISTENTE = /\/(nuevo|nueva|crear|editar)(\/|$)|\/agenda-de-citas(\/|$)/;

/** Una señal que dice si la ruta activa es una de {@link GESTION_SIN_ASISTENTE}. Llamar en contexto de inyección. */
export function rutaSinAsistente() {
  const router = inject(Router);
  const actual = () => router.url.split(/[?#]/)[0];
  return toSignal(
    router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => GESTION_SIN_ASISTENTE.test(actual()))),
    { initialValue: GESTION_SIN_ASISTENTE.test(actual()) });
}
