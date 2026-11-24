import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { EChartsCoreOption } from 'echarts/core';
import { conEtiquetasQueCaben } from '../../domain/opciones-del-tablero';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import {
  Caja, MARGEN_DEL_ENCUADRE, PASO_DE_DESPLAZAMIENTO, PASO_DE_ZOOM, cabeEnElMarco, cajaUnida, correccionDeDesplazamiento,
  correccionParaEncuadrar, decisionDeRueda, factorDeZoom, porcentajeDeZoom,
} from '../../domain/lienzo-de-red';
import { clasesDeChip } from './clases-de-chip';

/** Lo que el lector eligió en el gráfico: el nombre de la marca y su posición. */
export interface MarcaElegida {
  readonly nombre: string;
  readonly indice: number;
  /** Nombre de la serie (barras apiladas: el tipo de proceso) y valor de la marca (matriz: `[columna, fila, valor]`). */
  readonly serie?: string;
  readonly valor?: unknown;
  /** Identificador del nodo pulsado (solo en grafos de red). */
  readonly id?: string;
}

interface Instancia {
  setOption(opcion: EChartsCoreOption, opciones?: { notMerge?: boolean }): void;
  resize(): void;
  dispose(): void;
  on(evento: string, manejador: (parametros: { name?: string; dataIndex?: number; seriesName?: string; value?: unknown; dataType?: string; data?: { id?: string } }) => void): void;
  getDataURL(opciones: { type: 'png' | 'svg'; pixelRatio?: number; backgroundColor?: string }): string;
  dispatchAction(accion: Record<string, unknown>): void;
  getOption(): { series?: { zoom?: number }[] };
}

/** Desde qué zoom (sobre la vista encuadrada) se enseñan las etiquetas de todos los nodos. */
const ZOOM_PARA_ETIQUETAS = 1.5;
const AVISOS = {
  rueda: 'Usa Ctrl + rueda para acercar o alejar',
  tactil: 'Pulsa «Explorar» para mover y acercar con los dedos',
} as const;

/**
 * Un gráfico del tablero: recibe las opciones ya armadas y las dibuja con ECharts (carga diferida).
 *
 * <b>QUE HACE POR SI SOLO:</b> esqueleto mientras la librería baja, ajuste al tamaño de su caja,
 * animación apagada con `prefers-reduced-motion`, fuente heredada de la página y liberación al
 * destruirse. <b>QUE NO HACE:</b> decidir qué se dibuja (eso es `opciones-del-tablero.ts`) ni ser
 * el único camino al dato: el gráfico es `role="img"` con su descripción, y la alternativa para
 * teclado y lector de pantalla es la tabla de datos del panel que lo envuelve.
 */
@Component({
  selector: 'app-grafico-del-tablero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsqueletoComponent],
  styles: [`
    :host { display: block; position: relative; }
    .lienzo-marco { display: flex; flex-direction: column; height: 100%; width: 100%; }
    .lienzo-area { position: relative; flex: 1 1 0; min-height: 0; }
    .lienzo-explorable { overflow: hidden; border: 2px solid rgb(76 44 84 / 0.35); border-radius: 0.75rem; background: rgb(250 248 251); }
    .lienzo-explorable:focus-visible { outline: 3px solid var(--color-foco, rgb(76 44 84)); outline-offset: 2px; }
    .lienzo-explorable .lienzo-area { background: radial-gradient(circle at 1px 1px, rgb(76 44 84 / 0.12) 1px, transparent 0) 0 0 / 18px 18px, white; }
    .lienzo-esquina { position: absolute; z-index: 1; width: 0.9rem; height: 0.9rem; border-color: rgb(76 44 84 / 0.55); pointer-events: none; }
    .esq-ai { left: 4px; top: 4px; border-top: 2px solid; border-left: 2px solid; }
    .esq-ad { right: 4px; top: 4px; border-top: 2px solid; border-right: 2px solid; }
    .esq-bi { left: 4px; bottom: 4px; border-bottom: 2px solid; border-left: 2px solid; }
    .esq-bd { right: 4px; bottom: 4px; border-bottom: 2px solid; border-right: 2px solid; }
    .lienzo-ampliado { position: fixed; inset: 0; z-index: 60; height: auto; border-radius: 0; background: white; }
    .lienzo-pan-y, .lienzo-pan-y * { touch-action: pan-y !important; }
    .lienzo-explorar { display: none; }
    @media (pointer: coarse) { .lienzo-explorar { display: inline-flex; } }
  `],
  template: `
    <div #marco class="lienzo-marco" [class.lienzo-explorable]="explorable()" [class.lienzo-ampliado]="ampliado()"
      [attr.role]="explorable() ? 'group' : null" [attr.tabindex]="explorable() ? 0 : null"
      [attr.aria-label]="explorable() ? 'Lienzo del grafo. Flechas para mover, más y menos para acercar o alejar, cero para ajustar' + (ampliado() ? ', Escape para salir del modo ampliado' : '') : null"
      (keydown)="alTeclear($event)">
      @if (explorable()) {
        <div class="flex flex-wrap items-center gap-1.5 border-b border-morado/20 bg-white px-2 py-1.5" role="toolbar" aria-label="Controles del lienzo" data-testid="lienzo-controles">
          <button type="button" [class]="chip" aria-label="Acercar" title="Acercar (más)" data-testid="lienzo-acercar" (click)="acercar(1)">+</button>
          <button type="button" [class]="chip" aria-label="Alejar" title="Alejar (menos)" data-testid="lienzo-alejar" (click)="acercar(-1)">−</button>
          <button type="button" [class]="chip" title="Encuadrar todo el grafo dentro del marco" data-testid="lienzo-ajustar" (click)="ajustar()">Ajustar</button>
          <button type="button" [class]="chip" title="Volver a la vista inicial" data-testid="lienzo-reiniciar-vista" (click)="reiniciarVista()">Reiniciar vista</button>
          <button type="button" [class]="chip" class="lienzo-explorar" [attr.aria-pressed]="activo()" data-testid="lienzo-explorar"
            title="Activa mover y acercar con los dedos o con la rueda" (click)="alternarActivo()">{{ activo() ? 'Terminar de explorar' : 'Explorar' }}</button>
          <span class="ml-auto text-dato font-bold text-rotulo" data-testid="lienzo-zoom" aria-live="off">Zoom {{ zoomMostrado() }} %</span>
          <button type="button" [class]="chip" #botonAmpliar [attr.aria-pressed]="ampliado()" data-testid="lienzo-ampliar" (click)="alternarAmpliado()">
            {{ ampliado() ? 'Salir de la vista ampliada' : 'Ampliar' }}
          </button>
        </div>
      }
      <div class="lienzo-area">
        <div #lienzo class="h-full w-full" [class.lienzo-pan-y]="explorable() && !activo() && !ampliado()" role="img" [attr.aria-label]="descripcion()"></div>
        @if (explorable()) {
          <span class="lienzo-esquina esq-ai" aria-hidden="true"></span>
          <span class="lienzo-esquina esq-ad" aria-hidden="true"></span>
          <span class="lienzo-esquina esq-bi" aria-hidden="true"></span>
          <span class="lienzo-esquina esq-bd" aria-hidden="true"></span>
          @if (aviso()) {
            <p class="pointer-events-none absolute inset-x-2 bottom-2 z-10 mx-auto w-fit max-w-full rounded-md bg-morado px-3 py-1.5 text-center text-dato font-bold text-white shadow" role="status" data-testid="lienzo-aviso">{{ aviso() }}</p>
          }
          <div class="absolute right-2 top-2 z-[2] max-w-[min(20rem,70%)]" [class.hidden]="!ampliado()"><ng-content select="[lienzo-ficha]" /></div>
        }
        @if (!listo()) {
          <div class="absolute inset-0 bg-white">
            <app-esqueleto variante="ficha" [etiqueta]="'Preparando el gráfico: ' + descripcion()" />
          </div>
        }
      </div>
      @if (explorable()) {
        <div class="border-t border-morado/20 bg-white px-2 py-1"><ng-content select="[lienzo-leyenda]" /></div>
      }
    </div>
  `,
})
export class GraficoDelTableroComponent {
  readonly opcion = input.required<EChartsCoreOption>();
  /** Qué dice el gráfico, para quien no lo ve («Registros por departamento, de mayor a menor»). */
  readonly descripcion = input.required<string>();
  readonly elegida = output<MarcaElegida>();
  /**
   * Lienzo que se recorre (grafo de red): marco visible, controles, zoom solo intencional (Ctrl/⌘ + rueda, botones, teclado o
   * «Explorar»), encuadre que nunca corta el grafo, modo ampliado y gestos táctiles sin atrapar el desplazamiento de la página.
   */
  readonly explorable = input(false);

  protected readonly listo = signal(false);
  protected readonly chip = clasesDeChip(false);
  protected readonly activo = signal(false);
  protected readonly ampliado = signal(false);
  protected readonly aviso = signal('');
  protected readonly zoomMostrado = signal(100);
  private readonly marco = viewChild.required<ElementRef<HTMLElement>>('marco');
  private readonly botonAmpliar = viewChild<ElementRef<HTMLElement>>('botonAmpliar');
  private readonly documento = inject(DOCUMENT);
  private base = 1;
  private tocado = false;
  private etiquetasTodas = false;
  private temporizadores: ReturnType<typeof setTimeout>[] = [];
  private avisoHasta: ReturnType<typeof setTimeout> | null = null;
  private revisando = false;
  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');
  private readonly zona = inject(NgZone);
  private readonly destruccion = inject(DestroyRef);
  private instancia: Instancia | null = null;
  private pendiente: EChartsCoreOption | null = null;

  constructor() {
    effect(() => {
      const opcion = this.opcion();
      this.ultima = opcion;
      if (this.instancia) {
        this.instancia.setOption(this.conMovimiento(this.aLaMedida(opcion)), { notMerge: true });
        this.etiquetasTodas = false;
        this.programarEncuadre();
      } else this.pendiente = opcion;
    });

    afterNextRender(() => {
      void this.arrancar();
    });
    this.destruccion.onDestroy(() => {
      this.limpiarTemporizadores();
      this.documento.body.classList.remove('overflow-hidden');
      this.observador?.disconnect();
      this.instancia?.dispose();
      this.instancia = null;
    });
  }

  private observador: ResizeObserver | null = null;
  private ultima: EChartsCoreOption | null = null;
  private girado = false;

  /** Gira las etiquetas del eje de fechas si, al ancho que hay ahora, no caben en horizontal. */
  private aLaMedida(opcion: EChartsCoreOption): EChartsCoreOption {
    const ajustada = conEtiquetasQueCaben(opcion, this.lienzo().nativeElement.clientWidth);
    this.girado = ajustada !== opcion;
    return ajustada;
  }

  /** PNG o SVG del gráfico tal como está, para la exportación. `null` si aún no se dibujó. */
  imagen(tipo: 'png' | 'svg'): string | null {
    return this.instancia?.getDataURL({ type: tipo, pixelRatio: 2, backgroundColor: '#ffffff' }) ?? null;
  }

  private conMovimiento(opcion: EChartsCoreOption): EChartsCoreOption {
    const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reducido ? { ...opcion, animation: false } : opcion;
  }

  private async arrancar(): Promise<void> {
    const { init } = await import('./echarts-base');
    const anfitrion = this.lienzo().nativeElement;
    this.zona.runOutsideAngular(() => {
      const instancia = init(anfitrion, undefined, { renderer: 'svg' }) as unknown as Instancia;
      instancia.on('click', (parametros) => {
        this.zona.run(() => this.elegida.emit({ nombre: String(parametros.name ?? ''), indice: parametros.dataIndex ?? -1, serie: parametros.seriesName, valor: parametros.value, id: parametros.dataType === 'node' ? parametros.data?.id : undefined }));
      });
      this.instancia = instancia;
      if (this.explorable()) this.prepararGestos(anfitrion, instancia);
      if (typeof ResizeObserver === 'function') {
        this.observador = new ResizeObserver(() => {
          instancia.resize();
          // Al cambiar el ancho puede cambiar si las etiquetas caben: solo se vuelve a dibujar si la decisión cambió.
          if (!this.ultima) return;
          const giraAhora = conEtiquetasQueCaben(this.ultima, anfitrion.clientWidth) !== this.ultima;
          if (giraAhora !== this.girado) {
            instancia.setOption(this.conMovimiento(this.aLaMedida(this.ultima)), { notMerge: true });
          }
        });
        this.observador.observe(anfitrion);
      }
    });
    if (this.pendiente) this.instancia?.setOption(this.conMovimiento(this.aLaMedida(this.pendiente)), { notMerge: true });
    this.pendiente = null;
    this.listo.set(true);
    this.programarEncuadre();
  }

  // ---- Lienzo explorable: zoom intencional, encuadre, límites y teclado ----

  /** Cualquier gesto del lector (rueda con Ctrl, arrastre, botón) detiene el encuadre automático: no se le quita la vista de las manos. */
  private prepararGestos(anfitrion: HTMLElement, instancia: Instancia): void {
    // En fase de captura, antes de que ECharts los vea: sin Ctrl/⌘ la rueda sigue siendo de la página (y se avisa).
    anfitrion.addEventListener('wheel', (evento) => {
      if (decisionDeRueda(evento, { activo: this.activo(), ampliado: this.ampliado() }) === 'zoom') { this.tocado = true; return; }
      evento.stopPropagation();
      this.avisar(AVISOS.rueda);
    }, { capture: true, passive: true });
    // Táctil: sin «Explorar» el dedo desplaza la página y no el grafo (un toque sigue eligiendo un nodo).
    const bloquear = (evento: Event): void => {
      if (this.activo() || this.ampliado()) { this.tocado = true; return; }
      if (evento.type === 'pointermove' && (evento as PointerEvent).pointerType !== 'touch') return;
      evento.stopPropagation();
      this.avisar(AVISOS.tactil);
    };
    anfitrion.addEventListener('touchmove', bloquear, { capture: true, passive: true });
    anfitrion.addEventListener('pointermove', bloquear, { capture: true, passive: true });
    anfitrion.addEventListener('pointerdown', () => { if (this.activo() || this.ampliado()) this.tocado = true; }, { capture: true, passive: true });
    // Con el puntero fuera del lienzo se desactiva «Explorar» del ratón: la rueda vuelve a ser de la página.
    this.marco().nativeElement.addEventListener('pointerleave', (evento) => {
      if ((evento as PointerEvent).pointerType === 'mouse' && !this.ampliado()) this.activo.set(false);
    });
    this.zona.runOutsideAngular(() => instancia.on('graphRoam', () => this.alMoverLaVista()));
  }

  private avisar(texto: string): void {
    if (this.avisoHasta) clearTimeout(this.avisoHasta);
    this.zona.run(() => this.aviso.set(texto));
    this.avisoHasta = setTimeout(() => this.zona.run(() => this.aviso.set('')), 2200);
  }

  private limpiarTemporizadores(): void {
    this.temporizadores.forEach(clearTimeout);
    this.temporizadores = [];
    if (this.avisoHasta) clearTimeout(this.avisoHasta);
  }

  /** El grafo de fuerza se acomoda durante un par de segundos: se encuadra varias veces hasta que se asienta. */
  private programarEncuadre(): void {
    if (!this.explorable()) return;
    this.limpiarTemporizadores();
    this.tocado = false;
    for (const espera of [60, 700, 1800, 3500]) {
      this.temporizadores.push(setTimeout(() => { if (!this.tocado) void this.encuadrar(); }, espera));
    }
  }

  private zoomActual(): number { return this.instancia?.getOption().series?.[0]?.zoom ?? 1; }

  private marcoDelLienzo(): Caja {
    const r = this.lienzo().nativeElement.getBoundingClientRect();
    return { izquierda: r.left, arriba: r.top, derecha: r.right, abajo: r.bottom };
  }

  /** Caja que ocupan los nodos, las líneas y las etiquetas dibujados (SVG), en píxeles de pantalla. */
  cajaDelGrafo(): Caja | null {
    const svg = this.lienzo().nativeElement.querySelector('svg');
    if (!svg) return null;
    const piezas = Array.from(svg.querySelectorAll('path, text')).filter((el) => !el.closest('defs, clipPath'));
    return cajaUnida(piezas.map((el) => {
      const r = el.getBoundingClientRect();
      return { izquierda: r.left, arriba: r.top, derecha: r.right, abajo: r.bottom };
    }));
  }

  /** ¿Cabe el grafo entero dentro del marco del lienzo? (lo comprueban las pruebas de recortes). */
  grafoDentroDelMarco(): boolean {
    const caja = this.cajaDelGrafo();
    return !!caja && cabeEnElMarco(caja, this.marcoDelLienzo());
  }

  private siguienteCuadro(): Promise<void> {
    return new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver())));
  }

  /** Encuadra el grafo: lo centra y lo ajusta con margen dentro del marco (varias pasadas, porque las etiquetas no escalan). */
  async encuadrar(): Promise<void> {
    const instancia = this.instancia;
    if (!instancia || this.revisando) return;
    this.revisando = true;
    try {
      for (let paso = 0; paso < 4; paso++) {
        await this.siguienteCuadro();
        const caja = this.cajaDelGrafo();
        if (!caja) return;
        const marco = this.marcoDelLienzo();
        const interior: Caja = { izquierda: marco.izquierda + MARGEN_DEL_ENCUADRE / 2, arriba: marco.arriba + MARGEN_DEL_ENCUADRE / 2, derecha: marco.derecha - MARGEN_DEL_ENCUADRE / 2, abajo: marco.abajo - MARGEN_DEL_ENCUADRE / 2 };
        const c = correccionParaEncuadrar(caja, marco);
        const centrado = Math.abs(c.dx) < 2 && Math.abs(c.dy) < 2;
        if (paso > 0 && centrado && cabeEnElMarco(caja, interior, 1) && Math.abs(c.zoom - 1) < 0.04) break;
        if (Math.abs(c.zoom - 1) >= 0.02) instancia.dispatchAction({ type: 'graphRoam', seriesIndex: 0, zoom: factorDeZoom(this.zoomActual(), c.zoom), originX: c.origenX, originY: c.origenY });
        if (!centrado || Math.abs(c.zoom - 1) >= 0.02) instancia.dispatchAction({ type: 'graphRoam', seriesIndex: 0, dx: c.dx, dy: c.dy });
      }
      this.base = this.zoomActual();
      this.actualizarIndicador();
    } finally {
      this.revisando = false;
    }
  }

  private actualizarIndicador(): void {
    const zoom = this.zoomActual();
    this.zona.run(() => this.zoomMostrado.set(porcentajeDeZoom(zoom, this.base)));
    // Al acercar se enseñan todas las etiquetas; al alejar, solo las de los nodos principales.
    const todas = zoom / (this.base || 1) >= ZOOM_PARA_ETIQUETAS;
    if (todas !== this.etiquetasTodas && this.instancia) {
      this.etiquetasTodas = todas;
      this.instancia.setOption({ series: [{ label: { show: todas } }] } as EChartsCoreOption);
    }
  }

  private pendienteDeLimites: ReturnType<typeof setTimeout> | null = null;
  /** Tras mover o acercar: actualiza el indicador y, si el grafo casi se salió del marco, lo devuelve. */
  private alMoverLaVista(): void {
    if (this.revisando) return;
    this.actualizarIndicador();
    if (this.pendienteDeLimites) clearTimeout(this.pendienteDeLimites);
    this.pendienteDeLimites = setTimeout(() => {
      const caja = this.cajaDelGrafo();
      if (!caja || !this.instancia) return;
      const { dx, dy } = correccionDeDesplazamiento(caja, this.marcoDelLienzo());
      if (dx || dy) this.instancia.dispatchAction({ type: 'graphRoam', seriesIndex: 0, dx, dy });
    }, 160);
  }

  protected acercar(sentido: 1 | -1): void {
    const instancia = this.instancia;
    if (!instancia) return;
    this.tocado = true;
    const caja = this.lienzo().nativeElement.getBoundingClientRect();
    const factor = factorDeZoom(this.zoomActual(), sentido > 0 ? PASO_DE_ZOOM : 1 / PASO_DE_ZOOM);
    instancia.dispatchAction({ type: 'graphRoam', seriesIndex: 0, zoom: factor, originX: caja.width / 2, originY: caja.height / 2 });
  }

  protected mover(dx: number, dy: number): void {
    this.tocado = true;
    this.instancia?.dispatchAction({ type: 'graphRoam', seriesIndex: 0, dx, dy });
  }

  protected ajustar(): void {
    this.tocado = false;
    void this.encuadrar();
  }

  /** Vuelve a la vista inicial: redibuja el grafo (se reacomoda) y lo encuadra. */
  protected reiniciarVista(): void {
    const opcion = this.ultima;
    if (!this.instancia || !opcion) return;
    this.instancia.setOption(this.conMovimiento(this.aLaMedida(opcion)), { notMerge: true });
    this.etiquetasTodas = false;
    this.programarEncuadre();
  }

  protected alternarActivo(): void {
    this.activo.update((v) => !v);
    if (this.activo()) this.avisar('Mueve con un dedo y acerca con dos. Pulsa «Terminar de explorar» para volver a desplazar la página');
    else this.aviso.set('');
  }

  protected alternarAmpliado(): void {
    const ahora = !this.ampliado();
    this.ampliado.set(ahora);
    this.documento.body.classList.toggle('overflow-hidden', ahora);
    if (ahora) this.activo.set(false);
    this.programarEncuadre();
    setTimeout(() => this.botonAmpliar()?.nativeElement.focus());
  }

  protected alTeclear(evento: KeyboardEvent): void {
    if (!this.explorable()) return;
    if (evento.key === 'Escape') {
      if (this.ampliado()) { evento.preventDefault(); this.alternarAmpliado(); }
      else if (this.activo()) { this.activo.set(false); }
      return;
    }
    // Las teclas del lienzo solo cuentan con el foco en el propio lienzo (en un botón, las flechas y el espacio son del botón).
    if (evento.target !== this.marco().nativeElement || evento.ctrlKey || evento.metaKey || evento.altKey) return;
    const paso = PASO_DE_DESPLAZAMIENTO;
    const acciones: Record<string, () => void> = {
      ArrowLeft: () => this.mover(paso, 0), ArrowRight: () => this.mover(-paso, 0),
      ArrowUp: () => this.mover(0, paso), ArrowDown: () => this.mover(0, -paso),
      '+': () => this.acercar(1), '=': () => this.acercar(1), '-': () => this.acercar(-1), '_': () => this.acercar(-1),
      '0': () => this.ajustar(),
    };
    const accion = acciones[evento.key];
    if (accion) { evento.preventDefault(); accion(); }
  }
}
