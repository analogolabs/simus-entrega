import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface EtapaDeLaLinea { id: string; texto: string; actual: boolean; hecha: boolean; }

/**
 * La LÍNEA DE TIEMPO de la agenda: las etapas (en preparación, inscripción abierta, en curso, terminada) como una línea horizontal con la actual
 * resaltada y las anteriores marcadas como hechas. El estado nunca se dice solo con color: cada etapa lleva su palabra y su marca.
 */
@Component({
  selector: 'app-linea-de-etapas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    ol { display: flex; margin: 0; padding: 0; list-style: none; }
    li { position: relative; flex: 1 1 0; padding-top: 1.75rem; text-align: center; font-size: var(--text-cuerpo); font-weight: 600; color: var(--color-prosa); }
    li::before { content: ''; position: absolute; top: .55rem; left: 0; right: 0; height: 3px; background: var(--color-morado-100); }
    li:first-child::before { left: 50%; } li:last-child::before { right: 50%; }
    li.hecha::before { background: var(--color-avance); }
    .punto { position: absolute; top: 0; left: 50%; width: 1.4rem; height: 1.4rem; margin-left: -.7rem; display: grid; place-items: center; border-radius: 50%; background: var(--color-morado-100); color: var(--color-morado); font-size: .75rem; font-weight: 800; z-index: 1; }
    li.hecha .punto { background: var(--color-avance); color: #fff; }
    li.actual { color: var(--color-morado); font-weight: 800; }
    li.actual .punto { background: var(--color-verde); color: var(--color-tinta); box-shadow: 0 0 0 4px rgb(255 189 0 / .3); animation: latido-etapa 2s ease-in-out infinite; }
    @keyframes latido-etapa { 50% { box-shadow: 0 0 0 7px rgb(255 189 0 / .12); } }
    @media (prefers-reduced-motion: reduce) { li.actual .punto { animation: none; } }
  `],
  template: `
    <ol aria-label="Etapas de la agenda" data-testid="recorrido-de-la-agenda">
      @for (e of etapas(); track e.id) {
        <li [class.hecha]="e.hecha" [class.actual]="e.actual" [attr.aria-current]="e.actual ? 'step' : null">
          <span class="punto" aria-hidden="true">{{ e.hecha ? '✓' : '' }}</span>{{ e.texto }}@if (e.hecha) { <span class="sr-only"> (hecha)</span> }
        </li>
      }
    </ol>
  `,
})
export class LineaDeEtapasComponent {
  readonly etapas = input.required<readonly EtapaDeLaLinea[]>();
}
