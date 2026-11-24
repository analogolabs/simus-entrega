import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';

import { EtiquetaDeContenido, PARAMETRO_DE_ETIQUETA } from '../../../utils/etiquetas';

/**
 * Las etiquetas de un contenido o de un listado, como TEXTO que filtra (no un selector).
 *
 * <b>CADA ETIQUETA ES UN ENLACE.</b> Lleva al listado (`ruta`, p. ej. `/agenda`) filtrado por ella
 * (`?proyecto=<código>`): es un `<a href>` real, así que los buscadores la rastrean y se puede abrir en otra pestaña.
 * Una sola pieza sirve a las fichas (evento, noticia) y a los filtros de los listados; en un listado, la etiqueta que
 * ya filtra se marca (`aria-current`) y volver a pulsarla quita el filtro.
 *
 * <b>SIN LISTA PROPIA.</b> Quien la usa pasa las etiquetas que salen del contenido (ver `utils/etiquetas.ts`).
 */
@Component({
  selector: 'app-etiquetas-de-contenido',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .etiquetas { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0; padding: 0; list-style: none; }
    .etiqueta {
      display: inline-flex; align-items: center; gap: .25rem; min-height: 2rem; padding: 0 .75rem;
      border: 1px solid var(--color-borde-campo, #cfd4dc); border-radius: 999px; background: #fff;
      color: var(--color-valor, #1d2433); font-size: var(--text-dato, .875rem); line-height: 1.25; text-decoration: none;
    }
    .etiqueta:hover { border-color: var(--color-morado, #6b2a8c); color: var(--color-morado, #6b2a8c); }
    .etiqueta:focus-visible { outline: var(--anillo-foco-ancho, 2px) solid var(--color-foco, #6b2a8c); outline-offset: 2px; }
    .etiqueta[aria-current='true'] { border-color: var(--color-morado, #6b2a8c); background: var(--color-morado, #6b2a8c); color: #fff; }
    .etiqueta__almohadilla { opacity: .7; }
    @media (pointer: coarse) { .etiqueta { min-height: var(--spacing-control-comodo, 2.75rem); } }
    .etiqueta__total { opacity: .75; font-variant-numeric: tabular-nums; }
    .rotulo { margin: 0 0 .5rem; }
  `],
  template: `
    @if (etiquetas().length > 0) {
      <nav [attr.aria-label]="nombre()" [attr.data-testid]="'etiquetas-de-contenido'">
        @if (rotulo()) { <p class="rotulo tipo-etiqueta text-tinta-media">{{ rotulo() }}</p> }
        <ul class="etiquetas">
          @for (e of etiquetas(); track e.codigo) {
            <li>
              <a class="etiqueta" rel="tag" data-etiqueta
                [href]="direccionDe(e)" (click)="alPulsar($event, e)"
                [attr.aria-current]="esLaActiva(e) ? 'true' : null"
                [attr.aria-label]="descripcionDe(e)">
                <span class="etiqueta__almohadilla" aria-hidden="true">#</span><span>{{ e.nombre }}</span>
                @if (conConteo() && e.total !== undefined) { <span class="etiqueta__total" aria-hidden="true">({{ e.total }})</span> }
              </a>
            </li>
          }
        </ul>
      </nav>
    }
  `,
})
export class EtiquetasDeContenidoComponent {
  readonly etiquetas = input<readonly EtiquetaDeContenido[]>([]);
  /** El listado al que lleva cada etiqueta: `/agenda`, `/noticias`. */
  readonly ruta = input.required<string>();
  /** La etiqueta que ya filtra el listado (su código): al pulsarla se quita el filtro. */
  readonly activa = input<string>('');
  /** El nombre accesible del grupo. */
  readonly nombre = input('Etiquetas');
  /** Un rótulo visible opcional sobre las etiquetas. */
  readonly rotulo = input<string>('');
  /** Muestra cuántos contenidos lleva cada una (solo si traen `total`). */
  readonly conConteo = input(false);
  /**
   * Dentro de un listado que ya filtra en pantalla: el clic no navega, avisa por `elegida` (el código, o `null` si se
   * quita) para que el listado ponga el filtro sin recargar. Con Ctrl, Cmd o clic central sigue siendo un enlace normal.
   */
  readonly interceptar = input(false);
  /** Se eligió una etiqueta (código) o se quitó la activa (`null`). Solo con `interceptar`. */
  readonly elegida = output<string | null>();

  private readonly router = inject(Router);
  private readonly ubicacion = inject(Location);

  protected direccionDe(e: EtiquetaDeContenido): string {
    const arbol = this.router.createUrlTree([this.ruta()], { queryParams: { [PARAMETRO_DE_ETIQUETA]: this.esLaActiva(e) ? null : e.codigo } });
    return this.ubicacion.prepareExternalUrl(this.router.serializeUrl(arbol));
  }

  protected alPulsar(evento: MouseEvent, e: EtiquetaDeContenido): void {
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    if (this.interceptar()) {
      this.elegida.emit(this.esLaActiva(e) ? null : e.codigo);
    } else {
      void this.router.navigateByUrl(this.router.serializeUrl(this.router.createUrlTree([this.ruta()], { queryParams: { [PARAMETRO_DE_ETIQUETA]: e.codigo } })));
    }
  }

  protected esLaActiva(e: EtiquetaDeContenido): boolean {
    return !!this.activa() && e.codigo === this.activa();
  }

  protected descripcionDe(e: EtiquetaDeContenido): string {
    return this.esLaActiva(e) ? `Quitar el filtro por la etiqueta ${e.nombre}` : `Ver todo lo etiquetado con ${e.nombre}`;
  }
}
