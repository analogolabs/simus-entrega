import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal, viewChild } from '@angular/core';

/** Una sección de la página a la que lleva una pestaña: el `id` de su elemento y su rótulo. */
export interface SeccionDePestana {
  readonly id: string;
  readonly rotulo: string;
}

/**
 * EL MENÚ INTERNO DE UNA PÁGINA LARGA, COMO PESTAÑAS PEGADAS BAJO LA BARRA PRINCIPAL.
 *
 * <b>UNA SOLA PIEZA</b> para Celebra la música y para El Plan (PNMC). Se desliza con la página y se queda pegada justo
 * debajo de la barra fija (`top: var(--alto-barra-superior)`), así que nunca la tapa ni queda debajo de ella; el salto a
 * una sección descuenta la barra y estas pestañas para que el título no quede escondido.
 *
 * <b>COMPORTAMIENTO.</b> Pestañitas centradas con el filete inferior de la barra; la sección activa (la última cuyo borde
 * superior ya cruzó la línea de lectura) se marca por scroll-spy con el acento y un trazo inferior. En pantalla angosta
 * la fila es una sola y se desplaza en horizontal (la activa se centra sola).
 *
 * <b>ACCESIBILIDAD.</b> `nav` con botones y `aria-current="location"` en la activa (no son `role="tab"`: no gobiernan
 * paneles, llevan a secciones). Tab recorre las pestañas; Enter o Espacio saltan; anillo de foco único. Respeta
 * `prefers-reduced-motion`.
 *
 * <b>COLOR.</b> Toma `--cl-tinta` (acento de la edición de Celebra) y, si no existe, el morado de marca.
 */
@Component({
  selector: 'app-pestanas-de-seccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block; position: sticky; top: var(--alto-barra-superior, 72px); z-index: 20;
      background: rgb(255 255 255 / .96); border-bottom: 1px solid var(--color-filete, #e5e0ee); backdrop-filter: blur(6px);
      --pds-acento: var(--cl-tinta, var(--color-morado, #4c2c54));
    }
    .pds { display: flex; gap: .25rem; width: max-content; max-width: 100%; margin: 0 auto; padding: .375rem 1rem 0; list-style: none; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; scroll-behavior: smooth; }
    .pds::-webkit-scrollbar { display: none; }
    .pds > li { flex: none; }
    .pds__pestana {
      display: inline-flex; align-items: center; min-height: 2.5rem; padding: 0 1rem; margin-bottom: -1px; cursor: pointer; white-space: nowrap;
      border: 1px solid transparent; border-bottom: 3px solid transparent; border-radius: .5rem .5rem 0 0; background: transparent;
      color: var(--color-prosa, #3f3a52); font: inherit; font-size: .9375rem; font-weight: 700;
    }
    .pds__pestana:hover { color: var(--pds-acento); background: color-mix(in srgb, var(--pds-acento) 7%, transparent); }
    .pds__pestana[aria-current='location'] { color: var(--pds-acento); background: color-mix(in srgb, var(--pds-acento) 9%, #fff); border-bottom-color: var(--pds-acento); font-weight: 800; }
    .pds__pestana:focus-visible { outline: 3px solid var(--color-foco, #5b2a86); outline-offset: -3px; }
    @media (max-width: 639.98px) { .pds { width: auto; margin: 0; padding: .375rem .75rem 0; } .pds__pestana { min-height: 2.75rem; padding: 0 .875rem; } }
    @media (pointer: coarse) { .pds__pestana { min-height: var(--spacing-control-comodo, 2.75rem); } }
    @media (prefers-reduced-motion: reduce) { .pds { scroll-behavior: auto; } }
  `],
  template: `
    <nav [attr.aria-label]="etiqueta()" data-testid="pestanas-de-seccion">
      <ul #lista class="pds">
        @for (s of secciones(); track s.id) {
          <li>
            <button type="button" class="pds__pestana" [attr.data-seccion]="s.id" [attr.aria-current]="activa() === s.id ? 'location' : null" (click)="ir(s.id)">{{ s.rotulo }}</button>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class PestanasDeSeccionComponent {
  readonly secciones = input.required<readonly SeccionDePestana[]>();
  readonly etiqueta = input('Secciones de la página');

  readonly activa = signal('');
  private readonly lista = viewChild.required<ElementRef<HTMLElement>>('lista');
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destruccion = inject(DestroyRef);
  private marco = 0;

  constructor() {
    afterNextRender(() => {
      this.medir();
      const alMover = () => { if (!this.marco) { this.marco = requestAnimationFrame(() => { this.marco = 0; this.medir(); }); } };
      window.addEventListener('scroll', alMover, { passive: true });
      window.addEventListener('resize', alMover, { passive: true });
      this.destruccion.onDestroy(() => {
        window.removeEventListener('scroll', alMover);
        window.removeEventListener('resize', alMover);
        if (this.marco) { cancelAnimationFrame(this.marco); }
      });
    });
    // Con la lista que llega o cambia, recalcula la activa; y centra la pestaña activa en la fila desplazable.
    effect(() => { this.secciones(); queueMicrotask(() => this.medir()); });
    effect(() => { this.centrar(this.activa()); });
  }

  /** Lo que ocupan juntas la barra principal y estas pestañas: lo que no debe tapar el título de la sección. */
  private descuento(): number {
    const barra = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-barra-superior')) || 72;
    return barra + this.anfitrion.nativeElement.offsetHeight;
  }

  ir(id: string): void {
    const el = document.getElementById(id);
    if (!el) { return; }
    const y = el.getBoundingClientRect().top + window.scrollY - this.descuento() - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    this.activa.set(id);
  }

  private medir(): void {
    const lista = this.secciones();
    const linea = this.descuento() + 24;
    let actual = '';
    for (const { id } of lista) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= linea) { actual = id; }
    }
    this.activa.set(actual);
  }

  private centrar(id: string): void {
    if (!id) { return; }
    const fila = this.lista().nativeElement;
    const boton = fila.querySelector<HTMLElement>(`[data-seccion="${id}"]`);
    if (!boton || fila.scrollWidth <= fila.clientWidth) { return; }
    fila.scrollTo({ left: boton.offsetLeft - (fila.clientWidth - boton.offsetWidth) / 2 });
  }
}
