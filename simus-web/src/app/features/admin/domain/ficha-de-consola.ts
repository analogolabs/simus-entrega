import { Injectable, inject, signal } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';

/**
 * El identificador con el que la bandeja de Solicitudes conoce la revisión de un Festival nuevo.
 *
 * Es el mismo que arma `BandejaDeTrabajoService.colaCompleta` —`review-{modulo}-{id}`—, y es lo que
 * va en la dirección: `/administracion/solicitudes/review-festivals-173`.
 */
export function idDeRevisionDeFestival(festivalId: string | number): string {
  return `review-festivals-${festivalId}`;
}

/**
 * LA FICHA DE LA CONSOLA VIVE EN LA DIRECCION.
 *
 * Hasta aquí había cuatro maneras de abrir un registro —columna derecha, cajón, ventana centrada,
 * panel bajo la tabla— y ninguna tocaba la dirección: no se podía compartir, ni recargar, ni volver
 * con «Atrás», y el enlace del correo (`?revisar=173`) cargaba la lista y se olvidaba del Festival.
 *
 * Ahora la forma es una sola: `/administracion/{seccion}/{id}` y, si el registro tiene una segunda
 * vista, `/administracion/{seccion}/{id}/{vista}` (la ficha completa de una solicitud). El armazón
 * lee esos segmentos y los deja aquí; los paneles de sección ABREN y CIERRAN navegando, y mantienen
 * su ficha como reflejo de lo que dice la dirección. Así «Atrás» deshace una apertura y recargar la
 * conserva.
 */
@Injectable({ providedIn: 'root' })
export class FichaDeConsola {
  private readonly router = inject(Router);

  /** El segmento `id` de la dirección, o `null` si se está viendo la lista. */
  readonly id = signal<string | null>(null);

  /** El segmento de la segunda vista (`ficha`), o `null`. */
  readonly vista = signal<string | null>(null);

  /** Lo llama el armazón cada vez que cambia la dirección. */
  fijar(id: string | null, vista: string | null = null): void {
    this.id.set(id || null);
    this.vista.set(vista || null);
  }

  /** La dirección de una ficha. `seccion` es el segmento de la sección, no su identificador. */
  static direccion(seccion: string, id?: string | number | null, vista?: string | null): string[] {
    const segmentos = ['/administracion', seccion];
    if (id !== undefined && id !== null && String(id) !== '') { segmentos.push(String(id)); }
    if (vista && segmentos.length === 3) { segmentos.push(vista); }
    return segmentos;
  }

  /**
   * Abre una ficha. CONSERVA LOS PARAMETROS DE CONSULTA: los filtros de la lista (el Catálogo los
   * guarda en la dirección) siguen puestos cuando se cierra la ficha.
   */
  abrir(seccion: string, id: string | number, opciones: { vista?: string | null; reemplazar?: boolean } = {}): void {
    const extras: NavigationExtras = { queryParamsHandling: 'preserve', replaceUrl: opciones.reemplazar === true };
    // Un fallo de navegación (una dirección sin ruta, en una prueba aislada) no debe romper el gesto.
    this.router.navigate(FichaDeConsola.direccion(seccion, id, opciones.vista), extras).catch(() => false);
  }

  /** Vuelve a la lista de la sección. */
  cerrar(seccion: string, opciones: { reemplazar?: boolean } = {}): void {
    this.router.navigate(FichaDeConsola.direccion(seccion), {
      queryParamsHandling: 'preserve',
      replaceUrl: opciones.reemplazar === true,
    }).catch(() => false);
  }
}
