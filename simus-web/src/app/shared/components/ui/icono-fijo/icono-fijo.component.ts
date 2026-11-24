import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';

interface Trazo {
  readonly forma: 'path' | 'circle' | 'line';
  readonly attrs: Readonly<Record<string, string>>;
}

const p = (d: string): Trazo => ({ forma: 'path', attrs: { d } });

/**
 * Iconos del arranque (barra superior y botón flotante), copiados tal cual de Lucide.
 *
 * POR QUÉ EXISTEN: `@lucide/angular` es un único módulo y el empaquetador lo coloca entero en el
 * trozo inicial si alguien del arranque lo importa, con todos los iconos que usa cualquier página
 * (~100 kB). Dibujar estos pocos iconos aquí saca el paquete del primer pintado: pasa a un trozo
 * que solo se descarga con la primera página que lo usa. El resultado visual es idéntico (mismo
 * SVG, mismas clases `lucide lucide-<nombre>`, mismo `aria-hidden`).
 *
 * Los iconos del resto de la aplicación siguen importándose de `@lucide/angular`; esta lista NO debe
 * crecer salvo que el icono se use en el arranque.
 */
const ICONOS: Readonly<Record<string, readonly Trazo[]>> = {
  'x': [p('M18 6 6 18'), p('m6 6 12 12')],
  'menu': [p('M4 5h16'), p('M4 12h16'), p('M4 19h16')],
  'chevron-down': [p('m6 9 6 6 6-6')],
  'arrow-up-right': [p('M7 7h10v10'), p('M7 17 17 7')],
  'message-circle-question': [p('M7.9 20A9 9 0 1 0 4 16.1L2 22Z'), p('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'), p('M12 17h.01')],
  'log-in': [p('m10 17 5-5-5-5'), p('M15 12H3'), p('M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4')],
  'user-plus': [
    p('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'),
    { forma: 'circle', attrs: { cx: '9', cy: '7', r: '4' } },
    { forma: 'line', attrs: { x1: '19', x2: '19', y1: '8', y2: '14' } },
    { forma: 'line', attrs: { x1: '22', x2: '16', y1: '11', y2: '11' } },
  ],
  'party-popper': [
    p('M5.8 11.3 2 22l10.7-3.79'),
    p('M4 3h.01'),
    p('M22 8h.01'),
    p('M15 2h.01'),
    p('M22 20h.01'),
    p('m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10'),
    p('m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17'),
    p('m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7'),
    p('M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z'),
  ],
};

export type NombreDeIconoFijo = keyof typeof ICONOS;

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'svg[iconoFijo]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    '[attr.width]': 'size()',
    '[attr.height]': 'size()',
    '[class]': 'clases()',
  },
  template: `@for (t of trazos(); track $index) {
    @switch (t.forma) {
      @case ('circle') { <svg:circle [attr.cx]="t.attrs['cx']" [attr.cy]="t.attrs['cy']" [attr.r]="t.attrs['r']" /> }
      @case ('line') {
        <svg:line [attr.x1]="t.attrs['x1']" [attr.x2]="t.attrs['x2']" [attr.y1]="t.attrs['y1']" [attr.y2]="t.attrs['y2']" />
      }
      @default { <svg:path [attr.d]="t.attrs['d']" /> }
    }
  }`,
})
export class IconoFijoComponent {
  readonly iconoFijo = input.required<NombreDeIconoFijo>();
  readonly size = input<number>(24);

  protected readonly trazos = computed(() => ICONOS[this.iconoFijo()] ?? []);
  protected readonly clases = computed(() => `lucide lucide-${this.iconoFijo()}`);
}
