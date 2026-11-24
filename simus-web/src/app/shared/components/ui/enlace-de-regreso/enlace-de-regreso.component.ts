import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';

/**
 * EL ENLACE PARA VOLVER A LA LISTA DESDE UNA PÁGINA DE DETALLE (A-7).
 *
 * <b>POR QUÉ UNA PIEZA.</b> Había tres estilos de «volver»: «← Agenda» con una flecha de TEXTO en la página de
 * evento, la flecha de iconos con «Volver a Festivales» y «Volver a Mercados musicales», y botones terciarios en la
 * consola. El de la Agenda no era coherente con el resto (observación A-7). Esta es la forma única.
 *
 * <b>QUÉ ES.</b> Un enlace (`routerLink`, no un botón: navega) con la flecha de `@lucide/angular` a 14 px y el texto
 * «Volver a {destino}», dentro de un `<nav aria-label="Volver">`. Va arriba a la izquierda, sobre el título. El foco
 * es el anillo único. Los parámetros de consulta (`queryParams`) permiten volver a la lista CON los filtros que
 * tenía; el destino con artículo (`a la agenda`) se da entero para que el texto sea gramatical.
 *
 * <b>ACCESIBILIDAD.</b> La flecha es decorativa (`aria-hidden`); el nombre accesible es el texto visible, así que
 * contiene lo que se ve (WCAG 2.5.3). Alto mínimo de 36 px (44 con `comodo`).
 *
 * @example
 *   <app-enlace-de-regreso destino="la agenda" [enlace]="['/agenda']" [queryParams]="filtrosDeLaLista()" />
 */
@Component({
  selector: 'app-enlace-de-regreso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideArrowLeft],
  styles: [`
    :host { display: block; }
    .regreso {
      display: inline-flex; align-items: center; gap: .4rem;
      min-height: var(--spacing-control); padding: 0 .5rem 0 .25rem; margin-left: -.25rem;
      border-radius: var(--radius-control); color: var(--color-rotulo); font-size: var(--text-cuerpo); font-weight: 700;
      text-decoration: none; transition: color .15s var(--ease-soft, ease), background-color .15s var(--ease-soft, ease);
    }
    .regreso--comodo { min-height: var(--spacing-control-comodo); }
    .regreso:hover { color: var(--color-morado); background: color-mix(in srgb, var(--color-filete) 45%, transparent); }
    .regreso:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); }
    .regreso svg { flex: 0 0 auto; transition: transform .15s var(--ease-soft, ease); }
    .regreso:hover svg { transform: translateX(-2px); }
    @media (prefers-reduced-motion: reduce) { .regreso, .regreso svg { transition: none; } .regreso:hover svg { transform: none; } }
  `],
  template: `
    <nav aria-label="Volver">
      <a class="regreso" [class.regreso--comodo]="comodo()" [routerLink]="enlace()" [queryParams]="queryParams()" [attr.data-testid]="identificador()">
        <svg lucideArrowLeft [size]="14" aria-hidden="true"></svg>
        <span>Volver {{ destino() }}</span>
      </a>
    </nav>
  `,
})
export class EnlaceDeRegresoComponent {
  /** A dónde se vuelve, con su artículo: «a la agenda», «a Festivales», «al directorio». El texto es «Volver {destino}». */
  readonly destino = input.required<string>();
  /** La ruta de la lista, como la entiende `routerLink`. */
  readonly enlace = input.required<string | readonly unknown[]>();
  /** Los filtros con que estaba la lista, para volver a ella tal como se dejó. */
  readonly queryParams = input<Params | null>(null);
  readonly comodo = input(false);
  readonly identificador = input<string | null>('enlace-de-regreso');
}
