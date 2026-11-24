import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * El mensaje de error JUNTO a su campo.
 *
 * Es la única forma de decir «esto está mal» bajo un campo: el mismo tipo de letra, el mismo color
 * y el mismo `id` que el campo cita en `aria-describedby`. Va vacío —no pinta nada— si no hay
 * mensaje, así que se puede dejar siempre debajo del control.
 */
@Component({
  selector: 'app-error-de-campo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (mensaje()) { <p [id]="identificador()" class="mt-1 text-xs font-medium text-peligro" data-error-de-campo>{{ mensaje() }}</p> }`,
  styles: [':host { display: contents; }'],
})
export class ErrorDeCampoComponent {
  /** El `id` que el campo cita en `aria-describedby`. */
  readonly identificador = input.required<string>();
  readonly mensaje = input<string | null | undefined>(null);
}
