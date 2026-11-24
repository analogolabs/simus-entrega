import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideX } from '@lucide/angular';

/**
 * El chip de un filtro activo (UI-B, docs/desarrollo/30-consola-y-acceso.md §30.5): muestra un valor que se aplicó a la lista y se
 * puede quitar con un clic. Es lo único para lo que sirve un chip: un estado se pinta con el
 * indicador de estado (`app-indicador-de-estado`), no con un chip; una acción, con un botón.
 *
 * <b>QUITARLO ES UN BOTÓN CON NOMBRE.</b> La «✕» lleva `aria-label="Quitar filtro Tipo: Eventos"`:
 * un lector de pantalla no puede decir «botón» a secas. El foco usa el anillo único.
 */
@Component({
  selector: 'app-chip-de-filtro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX],
  styles: [`
    :host { display: inline-flex; }
    .chip {
      display: inline-flex; align-items: center; gap: .15rem;
      min-height: var(--spacing-control-minimo); padding: 0 .25rem 0 .6rem;
      border: 1px solid var(--color-borde-campo); border-radius: var(--radius-control); background: #fff;
      color: var(--color-valor); font-size: var(--text-dato); line-height: 1.25;
    }
    .chip__rotulo { color: var(--color-rotulo); }
    .chip__quitar {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.5rem; height: 1.5rem; border: 0; border-radius: var(--radius-control);
      background: transparent; color: var(--color-rotulo); cursor: pointer;
    }
    .chip__quitar:hover { background: #f1f3f7; color: var(--color-valor); }
    .chip__quitar:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 1px; }
  `],
  template: `
    <span class="chip">
      @if (rotulo()) { <span class="chip__rotulo">{{ rotulo() }}:</span> }
      <span>{{ valor() }}</span>
      <button type="button" class="chip__quitar"
        [attr.aria-label]="'Quitar filtro ' + (rotulo() ? rotulo() + ': ' : '') + valor()"
        (click)="quitar.emit()">
        <svg lucideX [size]="12" aria-hidden="true"></svg>
      </button>
    </span>
  `,
})
export class ChipDeFiltroComponent {
  /** Qué se filtra: «Tipo», «Territorio». Opcional. */
  readonly rotulo = input<string | null>(null);
  /** El valor aplicado: «Eventos», «Casanare». */
  readonly valor = input.required<string>();
  readonly quitar = output<void>();
}
