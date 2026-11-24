import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Una CIFRA grande de la agenda con su barra: «5 de 8 admitidos». Si hay total, la barra muestra el avance; si no, la cifra va sola. El `tono`
 * pinta la barra (`atencion` cuando algo está lleno o espera una decisión). Es una superficie sin borde: la sombra y el fondo del lienzo la separan.
 */
@Component({
  selector: 'app-indicador-de-cifra',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .cifra { height: 100%; padding: 1rem; border-radius: .9rem; background: #fff; box-shadow: 0 1px 2px rgb(46 25 51 / .1), 0 6px 18px rgb(46 25 51 / .06); }
    .cifra__valor { font-family: var(--font-alternate); font-size: 1.75rem; line-height: 2.125rem; font-weight: 600; color: var(--color-morado); }
    .cifra__de { font-size: var(--text-cuerpo); color: var(--color-prosa); font-family: inherit; font-weight: 400; }
    .barra { height: .45rem; margin-top: .5rem; border-radius: 9999px; background: var(--color-morado-100); overflow: hidden; }
    .barra > span { display: block; height: 100%; background: var(--color-avance); transition: width var(--dur-entrada) var(--ease-soft); }
    .barra.atencion > span { background: var(--color-atencion-fuerte); }
    @media (prefers-reduced-motion: reduce) { .barra > span { transition: none; } }
  `],
  template: `
    <div class="cifra">
      <p class="text-cuerpo font-semibold text-valor">{{ etiqueta() }}</p>
      <p class="cifra__valor" data-testid="cifra-valor">{{ valor() }}{{ unidad() }}@if (de() !== null && !unidad()) { <span class="cifra__de"> de {{ de() }}</span> }</p>
      @if (de() !== null) { <div class="barra" [class.atencion]="atencion()" role="img" [attr.aria-label]="porcentaje() + ' por ciento'"><span [style.width.%]="porcentaje()"></span></div> }
      @if (pie()) { <p class="mt-2 text-dato text-prosa">{{ pie() }}</p> }
    </div>
  `,
})
export class IndicadorDeCifraComponent {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<number | string>();
  /** El total de referencia; sin él no hay barra. */
  readonly de = input<number | null>(null);
  readonly pie = input<string | null>(null);
  /** «%» si la cifra ya es un porcentaje: la barra se llena con ella y no se dice «de 100». */
  readonly unidad = input('');
  readonly atencion = input(false);
  protected readonly porcentaje = computed(() => {
    const v = Number(this.valor()), t = this.de();
    return t && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v * 100 / t))) : 0;
  });
}
