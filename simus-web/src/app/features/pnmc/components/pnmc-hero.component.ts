import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * LA CABECERA DEL PLAN, con la paleta PNMC (ver `.tema-pnmc` en styles.css): violeta profundo con
 * verde neón sobre el violeta plano de la barra (sin foto). Sin ruta de migas: el protagonista es el antetítulo, el título y la
 * descripción. A la derecha, unos arcos concéntricos —un guiño a la Órbita de SIMUS— en verde y
 * violeta vivo, solo decorativos. Lo que cada página quiera añadir debajo (accesos, datos) va en el
 * contenido proyectado.
 */
@Component({
  selector: 'app-pnmc-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tema-pnmc block' },
  template: `
    <header class="relative overflow-hidden bg-morado pt-(--alto-barra-superior) text-white">

      <div class="relative mx-auto max-w-7xl px-6 pb-10 pt-10 text-center lg:px-8 lg:pb-12 lg:pt-14">
        @if (eyebrow()) {
          <p class="tipo-etiqueta text-verde">{{ eyebrow() }}</p>
        }
        <h1 class="tipo-seccion mx-auto mt-4 max-w-4xl text-balance">
          {{ title() }}@if (accent()) { <span class="text-verde"> {{ accent() }}</span> }
        </h1>
        
        <div class="mt-8 empty:hidden"><ng-content></ng-content></div>
      </div>
    </header>
  `,
})
export class PnmcHeroComponent {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly accent = input('');
  readonly description = input('');
}
