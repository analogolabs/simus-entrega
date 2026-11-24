import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChildren } from '@angular/core';

/** Una pestaña: su identificador, su rótulo y, si cuenta algo, cuántos hay. */
export interface OpcionDePestana {
  readonly id: string;
  readonly etiqueta: string;
  /** Cuántos elementos hay en esa vista. Opcional: una pestaña de vista no cuenta nada. */
  readonly conteo?: number;
}

/**
 * Las pestañas del proyecto (UI-B, docs/desarrollo/30-consola-y-acceso.md §30.5 y §30.13).
 *
 * <b>LA REGLA ÚNICA.</b> Pestañas = el ESTADO o la VISTA de una misma lista y son excluyentes
 * («Pendientes» / «Resueltas»). Lo que afina esa lista (tipo, territorio, responsable) es un FILTRO
 * y va en un desplegable; lo que lleva a otra sección es la barra lateral. Nunca dos filas de
 * pestañas en la misma página, ni pestañas haciendo de segundo menú. Alternar entre dos o tres
 * posiciones de un mismo control (`Lista / Mapa`) es `app-selector-segmentado`.
 *
 * <b>SEMÁNTICA DE PESTAÑA DE VERDAD.</b> `role="tablist"` / `role="tab"` con `aria-selected`, y
 * `aria-controls` hacia el panel que gobiernan (`controla`: el `id` de la lista). Teclado: flechas
 * izquierda y derecha para moverse (y activar), Inicio y Fin para los extremos; solo la pestaña
 * activa entra en el orden de tabulación (`tabindex` itinerante), y el foco usa el anillo único.
 *
 * <b>CÓMO SE VE LA ACTIVA.</b> Subrayado de 2 px en el morado de marca y texto en morado; nunca un
 * relleno ni una cápsula. El conteo es un NUMERAL junto al rótulo, no una píldora.
 */
@Component({
  selector: 'app-pestanas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .pestanas { display: flex; flex-wrap: wrap; gap: 0 .25rem; border-bottom: 1px solid var(--color-filete); }
    .pestana {
      margin-bottom: -1px; display: inline-flex; align-items: center; gap: .4rem;
      min-height: var(--spacing-control); padding: 0 .75rem;
      border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none;
      color: var(--color-prosa); font-family: inherit; font-size: var(--text-cuerpo); font-weight: 600;
      cursor: pointer;
    }
    .pestana:hover { color: var(--color-morado); }
    .pestana[aria-selected='true'] { border-bottom-color: var(--color-morado); color: var(--color-morado); font-weight: 700; }
    .pestana:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: -2px; }
    .pestana__conteo { color: var(--color-rotulo); font-size: var(--text-dato); font-weight: 400; font-variant-numeric: tabular-nums; }
    .pestana[aria-selected='true'] .pestana__conteo { color: var(--color-morado); }
    /* En pantalla angosta las pestañas son UNA SOLA fila que se desplaza en horizontal (nunca dos o tres filas apiladas)
       y cada una mide al menos 44 px de alto para el dedo. */
    @media (max-width: 639.98px) {
      .pestanas { flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
      .pestanas::-webkit-scrollbar { display: none; }
      .pestana { flex: none; min-height: var(--spacing-control-comodo); white-space: nowrap; }
    }
  `],
  template: `
    <div class="pestanas" role="tablist" [attr.aria-label]="etiquetaDelGrupo()">
      @for (opcion of opciones(); track opcion.id) {
        <button
          #pestana
          type="button"
          class="pestana"
          role="tab"
          [attr.id]="'pestana-' + opcion.id"
          [attr.data-pestana]="opcion.id"
          [attr.aria-selected]="opcion.id === elegida()"
          [attr.aria-controls]="controla()"
          [attr.tabindex]="opcion.id === elegida() ? 0 : -1"
          (click)="elegir.emit(opcion.id)"
          (keydown)="alTeclear($event, opcion.id)">
          <span>{{ opcion.etiqueta }}</span>
          @if (opcion.conteo !== undefined) { <span class="pestana__conteo">{{ opcion.conteo }}</span> }
        </button>
      }
    </div>
  `,
})
export class PestanasComponent {
  readonly opciones = input.required<readonly OpcionDePestana[]>();
  readonly elegida = input.required<string>();

  /** Qué se está eligiendo, para quien navega con lector de pantalla («Estado de las solicitudes»). */
  readonly etiquetaDelGrupo = input.required<string>();

  /** El `id` del panel o la lista que gobiernan las pestañas. */
  readonly controla = input<string | null>(null);

  readonly elegir = output<string>();

  private readonly botones = viewChildren<ElementRef<HTMLButtonElement>>('pestana');

  constructor() {
    // En la fila que se desplaza, la pestaña elegida siempre queda a la vista.
    effect(() => {
      const i = this.opciones().findIndex(o => o.id === this.elegida());
      const boton = this.botones()[i]?.nativeElement;
      const fila = boton?.parentElement;
      // Solo el desplazamiento horizontal de la fila: la página no se mueve.
      if (boton && fila && fila.scrollWidth > fila.clientWidth) {
        fila.scrollLeft = Math.max(0, boton.offsetLeft - (fila.clientWidth - boton.offsetWidth) / 2);
      }
    });
  }

  protected alTeclear(evento: KeyboardEvent, id: string): void {
    const ids = this.opciones().map(o => o.id);
    const actual = ids.indexOf(id);
    let destino: number;
    switch (evento.key) {
      case 'ArrowRight': destino = (actual + 1) % ids.length; break;
      case 'ArrowLeft': destino = (actual - 1 + ids.length) % ids.length; break;
      case 'Home': destino = 0; break;
      case 'End': destino = ids.length - 1; break;
      default: return;
    }
    evento.preventDefault();
    this.elegir.emit(ids[destino]);
    // El foco acompaña a la pestaña que se activa: así el teclado no «pierde» dónde está.
    this.botones()[destino]?.nativeElement.focus();
  }
}
