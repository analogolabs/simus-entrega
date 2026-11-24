import { ChangeDetectionStrategy, Component, DestroyRef, computed, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../filtro-desplegable/filtro-desplegable.component';
import { OpcionDePestana } from '../pestanas/pestanas.component';

/**
 * LA BARRA DE TIPO de una lista de gestión (P3 de la gestión externa, prototipo B4): arriba de la lista, un
 * selector segmentado con el rótulo «TIPO» y, en cada segmento, el conteo («Festivales 3»).
 *
 * <b>SEGMENTADO SI CABE, DESPLEGABLE SI NO, MEDIDO POR EL ANCHO REAL DEL CONTENEDOR.</b> No hay punto de
 * corte en píxeles: con el menú lateral expandido o contraído, en una tarjeta estrecha o en el móvil, la barra
 * mide cuánto ocuparían los segmentos (con una copia invisible, en una línea) y los pinta solo si caben en
 * el ancho que tiene. Si no caben, los reemplaza por un desplegable «Tipo: Todos (8)». Cambia sola cuando el
 * contenedor cambia de ancho (`ResizeObserver`).
 *
 * <b>ES UN SOLO CONTROL EN DOS FORMAS.</b> La opción elegida, los conteos y el evento `elegir` son los mismos;
 * en forma segmentada es un `tablist` (flechas, Inicio y Fin, tabulación itinerante) y en forma desplegable es
 * `app-filtro-desplegable` (combobox). `controla` enlaza los segmentos con el `id` de la lista que gobiernan
 * (esa lista lleva `role="tabpanel"`).
 *
 * <b>SUSTITUYE</b> a `app-pestanas-de-tipo` en Solicitudes, Procesos y Eventos; las demás pantallas conservan
 * las pestañas hasta que las toque su carril. Las opciones de procesos las arma `opcionesDeTipoDeProceso`.
 *
 * @example
 * <app-barra-de-tipo etiquetaDelGrupo="Tipo de proceso" controla="lista-de-procesos"
 *   [opciones]="opciones()" [elegida]="tipo()" (elegir)="tipo.set($event)" />
 */
@Component({
  selector: 'app-barra-de-tipo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FiltroDesplegableComponent],
  styles: [`
    :host { display: block; position: relative; min-width: 0; }
    .bt__segmentos { display: flex; width: fit-content; max-width: 100%; align-items: center; gap: .125rem; padding: .1875rem;
      border-radius: .75rem; background: var(--color-lila-agua); white-space: nowrap; }
    .bt__rotulo { padding: 0 .65rem 0 .75rem; color: var(--color-morado-claro); font-size: var(--text-dato); font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .bt__segmento { display: inline-flex; flex: 0 0 auto; align-items: center; gap: .4rem; min-height: var(--spacing-control-comodo);
      padding: 0 .9rem; border: 0; border-radius: .5625rem; background: transparent; color: var(--color-tinta-media);
      font: inherit; font-size: var(--text-cuerpo); font-weight: 700; cursor: pointer; }
    .bt__segmento:hover { background: rgb(255 255 255 / .6); }
    .bt__segmento[aria-selected='true'] { background: #fff; color: var(--color-morado); }
    .bt__segmento:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: -2px; }
    .bt__conteo { color: var(--color-rotulo); font-size: var(--text-dato); font-weight: 600; font-variant-numeric: tabular-nums; }
    .bt__segmento[aria-selected='true'] .bt__conteo { color: var(--color-morado); }
    /* LA COPIA INVISIBLE: mide lo que ocuparían los segmentos sin tocar el diseño ni el orden de tabulación. */
    .bt__medida { position: absolute; top: 0; left: 0; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
    .bt__medida .bt__segmentos { width: max-content; max-width: none; }
  `],
  template: `
    <div #contenedor class="bt" data-barra-de-tipo [attr.data-forma]="cabe() ? 'segmentada' : 'desplegable'">
      @if (cabe()) {
        <div class="bt__segmentos" role="tablist" [attr.aria-label]="etiquetaDelGrupo()">
          <span class="bt__rotulo" aria-hidden="true">{{ rotulo() }}</span>
          @for (opcion of opciones(); track opcion.id) {
            <button #segmento type="button" class="bt__segmento" role="tab"
              [attr.id]="'pestana-' + opcion.id" [attr.data-pestana]="opcion.id"
              [attr.aria-selected]="opcion.id === elegida()" [attr.aria-controls]="controla()"
              [attr.tabindex]="opcion.id === elegida() ? 0 : -1"
              (click)="elegir.emit(opcion.id)" (keydown)="alTeclear($event, opcion.id)">
              <span>{{ opcion.etiqueta }}</span>
              @if (opcion.conteo !== undefined) { <span class="bt__conteo">{{ opcion.conteo }}</span> }
            </button>
          }
        </div>
      } @else {
        <app-filtro-desplegable [completo]="estrecho()" [rotulo]="rotulo()" [etiqueta]="etiquetaDelGrupo()" identificador="barra-de-tipo"
          [opciones]="opcionesDelDesplegable()" [elegida]="elegida()" (cambiar)="elegir.emit($event)" />
      }
      <div #medida class="bt__medida" aria-hidden="true" inert>
        <div class="bt__segmentos">
          <span class="bt__rotulo">{{ rotulo() }}</span>
          @for (opcion of opciones(); track opcion.id) {
            <span class="bt__segmento"><span>{{ opcion.etiqueta }}</span>@if (opcion.conteo !== undefined) { <span class="bt__conteo">{{ opcion.conteo }}</span> }</span>
          }
        </div>
      </div>
    </div>
  `,
})
export class BarraDeTipoComponent {
  /** Los tipos, con su conteo. «Todos» es una opción más: la barra no la inventa. */
  readonly opciones = input.required<readonly OpcionDePestana[]>();
  readonly elegida = input.required<string>();
  /** Qué se elige, para quien usa lector de pantalla («Tipo de proceso de los eventos»). */
  readonly etiquetaDelGrupo = input('Tipo de proceso');
  /** La palabra que encabeza la barra y el desplegable. */
  readonly rotulo = input('Tipo');
  /** El `id` de la lista (o panel) que gobierna la barra. */
  readonly controla = input<string | null>(null);
  /** Se emite con el `id` de la opción elegida. */
  readonly elegir = output<string>();

  /** Verdadero mientras los segmentos caben en el ancho del contenedor. */
  protected readonly cabe = signal(true);

  /**
   * Verdadero en un contenedor de teléfono (< 640 px): ahí el desplegable ocupa todo el ancho como los demás filtros de la
   * barra. En anchos mayores toma el ancho de su texto, igual que «Estado» o «Ordenar por», y no se estira por toda la fila.
   */
  protected readonly estrecho = signal(false);

  protected readonly opcionesDelDesplegable = computed(() => this.opciones().map<OpcionDeFiltro>(o => ({ id: o.id, etiqueta: o.etiqueta, conteo: o.conteo })));

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  private readonly medida = viewChild.required<ElementRef<HTMLElement>>('medida');
  private readonly segmentos = viewChildren<ElementRef<HTMLButtonElement>>('segmento');
  private readonly destruccion = inject(DestroyRef);
  private observador: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.medir();
      if (typeof ResizeObserver !== 'undefined') {
        this.observador = new ResizeObserver(() => this.medir());
        this.observador.observe(this.contenedor().nativeElement);
        // También la copia que mide: al cargar las fuentes cambia lo que ocuparían los segmentos sin que el contenedor se mueva.
        this.observador.observe(this.medida().nativeElement.firstElementChild as Element);
        this.destruccion.onDestroy(() => this.observador?.disconnect());
      }
    });
    // Si cambian las opciones (un conteo de tres cifras, un tipo nuevo), se vuelve a medir.
    effect(() => { this.opciones(); this.rotulo(); queueMicrotask(() => this.medir()); });
  }

  /** Compara el ancho que pedirían los segmentos con el que tiene el contenedor. */
  medir(): void {
    const contenedor = this.contenedor().nativeElement;
    const pedido = this.medida().nativeElement.firstElementChild as HTMLElement | null;
    if (!pedido || contenedor.clientWidth === 0) return;
    this.cabe.set(pedido.offsetWidth <= contenedor.clientWidth);
    this.estrecho.set(contenedor.clientWidth < 640);
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
    this.segmentos()[destino]?.nativeElement.focus();
  }
}
