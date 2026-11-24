import { ChangeDetectionStrategy, Component, booleanAttribute, ElementRef, computed, effect, forwardRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideChevronDown, LucideSearch } from '@lucide/angular';
import { PanelAncladoDirective } from '../../../directives/panel-anclado.directive';

/** Una opción del filtro: su valor, lo que se lee, y cuántos registros hay detrás. */
export interface OpcionDeFiltro {
  readonly id: string;
  readonly etiqueta: string;
  /** Cuántos hay. Opcional: un filtro de «orden» no cuenta nada. */
  readonly conteo?: number;
}

/**
 * Un filtro de lista, con su panel propio.
 *
 * <b>POR QUE NO UN `<select>`.</b> Los once filtros de la consola eran desplegables nativos, y el
 * dirección de producto reportó que «al hacer clic sobre algunos filtros,
 * los desplegables o paneles resultantes son desproporcionadamente grandes frente al contenido que
 * contienen». Comprobado: el control en sí ya era proporcional —entre 118 y 217 px según su texto— pero
 * el panel que abre un `<select>` lo dibuja el sistema operativo, y con los 32 departamentos de
 * DIVIPOLA ocupa media pantalla. De un `<select>` no se puede gobernar nada de eso: ni el ancho, ni
 * el alto, ni el interlineado, ni dónde aparece, ni si trae buscador.
 *
 * <b>EL TAMAÑO LO PIDE EL CONTENIDO.</b> El panel mide lo que mide su opción más larga, con un
 * mínimo para que no quede un sello y un máximo para que no se coma la pantalla; el alto crece
 * hasta unas diez opciones y a partir de ahí aparece el scroll, no antes. Y se ancla al control
 * que lo abrió, alineado por su borde izquierdo.
 *
 * <b>EL BUSCADOR APARECE CUANDO HACE FALTA</b>, no siempre: con cuatro estados sobra, con treinta y
 * dos departamentos es la diferencia entre elegir y rebuscar. El umbral está en
 * `MINIMO_PARA_BUSCAR`.
 *
 * <b>SEMANTICA Y TECLADO.</b> `combobox` + `listbox`, como pide el patrón: flechas para moverse,
 * Enter para elegir, Escape para cerrar volviendo el foco al control, Inicio y Fin para los
 * extremos. Un filtro que solo funcione con ratón deja fuera a quien navega con teclado, y este
 * sustituye a un nativo que sí funcionaba así.
 */
@Component({
  selector: 'app-filtro-desplegable',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideChevronDown, LucideSearch, PanelAncladoDirective],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FiltroDesplegableComponent), multi: true }],
  styles: [`
    :host { display: inline-block; position: relative; }

    .filtro__control {
      display: inline-flex; align-items: center; gap: .45rem;
      height: var(--spacing-control); max-width: 18rem;
      border: 1px solid var(--color-borde-campo); border-radius: var(--radius-control); background: #fff;
      padding: 0 .7rem;
      color: var(--color-valor); font-size: var(--text-cuerpo); font-family: inherit;
      cursor: pointer; text-align: left;
    }
    /* A TODO EL ANCHO (G6): en un panel lateral los filtros se apilan, y cada uno con el ancho de su
       texto daba una columna de cajas de tamaños distintos. Con esta variante todos miden lo mismo. */
    :host(.completo) { display: block; width: 100%; }
    :host(.completo) .filtro__control { display: flex; width: 100%; max-width: none; justify-content: space-between; }
    :host(.completo) .filtro__valor { flex: 1 1 auto; }
    .filtro__control:disabled { cursor: not-allowed; opacity: .55; background: #f3f4f8; }
    .filtro__control:hover { border-color: var(--color-borde-campo-hover); }
    .filtro__control:disabled:hover { border-color: var(--color-borde-campo); }
    .filtro__control:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); border-color: var(--color-foco); }
    /* DOS ALTURAS POR CONTEXTO (docs/desarrollo/30-consola-y-acceso.md §30.6): 36 px de trabajo, 44 px en formularios y directorios. */
    :host([data-tamano='comodo']) .filtro__control { height: var(--spacing-control-comodo); }
    .filtro__control[aria-expanded="true"] { border-color: var(--color-morado); }
    .filtro__rotulo { flex: 0 0 auto; color: var(--color-rotulo); font-size: var(--text-dato); font-weight: 700; }
    .filtro__valor { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .filtro__flecha { flex: 0 0 auto; color: var(--color-rotulo); transition: transform .12s; }
    .filtro__control[aria-expanded="true"] .filtro__flecha { transform: rotate(180deg); }

    /* EL PANEL MIDE LO QUE PIDE SU CONTENIDO, entre un mínimo y un máximo: con max-content, una
       lista de opciones cortas da un panel corto, que es justo lo que no hacía el nativo.
       SIN ACENTOS GRAVES EN ESTE BLOQUE: va dentro de un literal de plantilla y uno solo lo cierra,
       con lo que el resto del CSS pasa a leerse como expresión y el compilador de Angular falla
       con «Failed to resolve styles at position 1». Costó un build entender de dónde salía. */
    /* A-3: EL PANEL NO VIVE EN EL ESPACIO DE SU CONTENEDOR. appPanelAnclado lo pone en position: fixed y le
       calcula izquierda, lado (abajo o, si no cabe, arriba) y max-height contra la VENTANA: así una barra lateral
       con overflow ya no lo recorta, y lo que no cabe se recorre con el scroll interno de la lista. La capa es el
       token del portal (--z-desplegable, 60 si aún no está declarado). */
    .filtro__panel {
      z-index: var(--z-desplegable, 60);
      display: flex; flex-direction: column; overflow: hidden;
      width: max-content; max-width: min(22rem, calc(100vw - 1rem));
      border: 1px solid var(--color-filete); border-radius: var(--radius-control); background: #fff;
      box-shadow: var(--shadow-menu);
      padding: .3rem;
    }
    /* El scroll aparece cuando de verdad hace falta: diez opciones caben sin él. */
    .filtro__lista { flex: 1 1 auto; min-height: 0; max-height: 19rem; overflow-y: auto; overscroll-behavior: contain; margin: 0; padding: 0; list-style: none; }
    .filtro__buscador { position: relative; flex: 0 0 auto; padding: .25rem .25rem .35rem; }
    .filtro__buscador svg { position: absolute; left: .85rem; top: 50%; transform: translateY(-50%); color: var(--color-rotulo); pointer-events: none; }
    .filtro__buscador input {
      width: 100%; min-height: var(--spacing-control);
      border: 1px solid var(--color-borde-campo); border-radius: var(--radius-control); background: #fff;
      padding: .35rem .6rem .35rem 2rem;
      color: var(--color-valor); font-size: var(--text-cuerpo); font-family: inherit;
    }
    .filtro__buscador input:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 1px; border-color: var(--color-foco); }

    .filtro__opcion {
      display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
      width: 100%; min-height: var(--spacing-control);
      border: 0; border-radius: .45rem; background: none;
      padding: .35rem .6rem;
      color: var(--color-valor); font-size: var(--text-cuerpo); font-family: inherit; text-align: left;
      cursor: pointer;
    }
    .filtro__opcion:hover, .filtro__opcion.esta-marcada { background: #f3f4f8; }
    .filtro__opcion[aria-selected="true"] { color: var(--color-morado); font-weight: 700; }
    .filtro__conteo { flex: 0 0 auto; color: var(--color-rotulo); font-size: var(--text-dato); font-variant-numeric: tabular-nums; }
    .filtro__vacio { padding: .6rem; color: var(--color-rotulo); font-size: var(--text-cuerpo); }
  `],
  template: `
    <button type="button" class="filtro__control" #control
      [attr.aria-expanded]="abierto()" aria-haspopup="listbox" [disabled]="apagado()"
      [attr.aria-controls]="abierto() ? idDeLista : null"
      [attr.aria-activedescendant]="abierto() && !hayBuscador() ? idDeOpcion(marcada()) : null"
      [attr.id]="idDelControl() || null"
      [attr.aria-label]="nombreDelControl()"
      [attr.aria-required]="obligatorio() ? 'true' : null"
      [attr.aria-invalid]="invalido() ? 'true' : null"
      [attr.aria-describedby]="descritoPorExterno() || null"
      (blur)="alTocar()"
      [attr.data-filtro]="identificador() || null"
      (click)="alternar()">
      @if (rotulo()) { <span class="filtro__rotulo">{{ rotulo() }}:</span> }
      <span class="filtro__valor" [attr.title]="textoDelElegido()">{{ textoDelElegido() }}</span>
      <svg lucideChevronDown [size]="14" class="filtro__flecha" aria-hidden="true"></svg>
    </button>

    @if (abierto()) {
      <div class="filtro__panel" [appPanelAnclado]="control">
        @if (hayBuscador()) {
          <div class="filtro__buscador">
            <svg lucideSearch [size]="13" aria-hidden="true"></svg>
            <input #buscador type="search" [attr.aria-label]="'Buscar en ' + etiqueta()"
              [ngModel]="busqueda()" (ngModelChange)="alBuscar($event)" name="buscar-en-filtro"
              role="combobox" aria-expanded="true" aria-autocomplete="list" [attr.aria-controls]="idDeLista" [attr.aria-activedescendant]="idDeOpcion(marcada())" />
          </div>
        }
        <ul class="filtro__lista" role="listbox" [attr.id]="idDeLista" [attr.aria-label]="etiqueta()">
          @for (opcion of visibles(); track opcion.id; let i = $index) {
            <li role="presentation">
              <button type="button" class="filtro__opcion" role="option"
                [class.esta-marcada]="i === marcada()" [attr.id]="idDeOpcion(i)"
                [attr.data-valor]="opcion.id"
                [attr.aria-selected]="opcion.id === valorEfectivo()"
                (click)="elegir(opcion.id)" (mouseenter)="marcada.set(i)">
                <span>{{ opcion.etiqueta }}</span>
                @if (opcion.conteo !== undefined) { <span class="filtro__conteo">{{ opcion.conteo }}</span> }
              </button>
            </li>
          } @empty {
            <li role="option" aria-disabled="true" aria-selected="false" class="filtro__vacio">Ninguna coincide.</li>
          }
        </ul>
      </div>
    }
  `,
  host: {
    '[class.completo]': 'completo()',
    '[attr.data-tamano]': 'tamano()',
    '(document:click)': 'alPulsarFuera($event)',
    // EL TECLADO SE ESCUCHA EN EL ANFITRION, no en el panel. El panel es un `div` sin foco propio:
    // colgarle un `keydown` obliga a que el evento llegue burbujeando desde dentro, y una regla de
    // accesibilidad lo señala con razón —un manejador de teclado sobre algo que no puede recibir
    // foco es, casi siempre, un control inalcanzable—. Aquí el foco está siempre en un descendiente
    // real (el disparador, el buscador o una opción), así que el sitio honesto es el anfitrión.
    '(keydown)': 'alTeclear($event)',
  },
})
export class FiltroDesplegableComponent implements ControlValueAccessor {
  /** A partir de cuántas opciones aparece el buscador. Con menos, rebuscar es más lento que mirar. */
  readonly MINIMO_PARA_BUSCAR = 9;

  readonly opciones = input.required<readonly OpcionDeFiltro[]>();
  /**
   * El valor elegido, si quien lo usa lo gobierna por entrada. En un formulario NO se pasa: el valor
   * llega por `ngModel` o por formularios reactivos, como en cualquier campo (UI-D).
   */
  readonly elegida = input<string | null>(null);
  /** Qué se está filtrando, para quien navega con lector de pantalla. */
  readonly etiqueta = input.required<string>();
  /** Nombre con el que una prueba localiza este filtro, si ya lo buscaba por atributo. */
  readonly identificador = input<string | null>(null);
  /**
   * Lo que filtra, ESCRITO junto al valor («Estado: Todos») —. Un desplegable que solo dice
   * «Todas» no deja saber si filtra por estado, por categoría o por procedencia. Es un complemento
   * visible de `etiqueta`, que sigue siendo el nombre accesible.
   */
  readonly rotulo = input<string>('');
  /** Ocupa todo el ancho de su contenedor: para paneles laterales, donde los filtros se apilan. */
  readonly completo = input(false, { transform: booleanAttribute });

  /** `normal` = 36 px (áreas de trabajo); `comodo` = 44 px (formularios y directorios públicos). */
  readonly tamano = input<'normal' | 'comodo'>('normal');
  /** Sin opciones que elegir todavía (p. ej. el municipio, mientras no hay departamento). */
  readonly deshabilitado = input(false, { transform: booleanAttribute });

  /** El `id` del botón real, para que el `<label for>` del formulario lo nombre y una prueba lo localice. */
  readonly idDelControl = input<string | null>(null);
  readonly obligatorio = input(false, { transform: booleanAttribute });
  readonly invalido = input(false, { transform: booleanAttribute });
  readonly descritoPorExterno = input<string | null>(null);

  readonly cambiar = output<string>();

  private readonly valorDelFormulario = signal('');
  private readonly inhabilitadoPorElFormulario = signal(false);
  private alCambiarElFormulario: (valor: string) => void = () => undefined;
  private alTocarElFormulario: () => void = () => undefined;
  protected readonly valorEfectivo = computed(() => this.elegida() ?? this.valorDelFormulario());
  protected readonly apagado = computed(() => this.deshabilitado() || this.inhabilitadoPorElFormulario());

  writeValue(valor: string | number | null): void { this.valorDelFormulario.set(valor === null || valor === undefined ? '' : String(valor)); }
  registerOnChange(fn: (valor: string) => void): void { this.alCambiarElFormulario = fn; }
  registerOnTouched(fn: () => void): void { this.alTocarElFormulario = fn; }
  setDisabledState(inhabilitado: boolean): void { this.inhabilitadoPorElFormulario.set(inhabilitado); }
  /** El control perdió el foco: para validar al salir del campo. */
  readonly salir = output<void>();
  protected alTocar(): void { this.alTocarElFormulario(); this.salir.emit(); }

  protected readonly abierto = signal(false);
  protected readonly busqueda = signal('');
  /** Qué opción está bajo el cursor o el teclado, para mover con flechas sin ratón. */
  protected readonly marcada = signal(0);

  private readonly anfitrion: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');
  private readonly anclaje = viewChild(PanelAncladoDirective);
  private static contador = 0;
  private readonly base = `filtro-${++FiltroDesplegableComponent.contador}`;
  protected readonly idDeLista = `${this.base}-lista`;
  protected idDeOpcion(i: number): string { return `${this.base}-op-${i}`; }
  protected readonly hayBuscador = computed(() => this.opciones().length >= this.MINIMO_PARA_BUSCAR);

  protected readonly visibles = computed(() => {
    const termino = this.busqueda().trim().toLocaleLowerCase('es-CO');
    if (!termino) { return this.opciones(); }
    return this.opciones().filter(o => o.etiqueta.toLocaleLowerCase('es-CO').includes(termino));
  });

  /**
   * UI-F: el nombre accesible del botón **contiene** el texto que se ve (WCAG 2.5.3, «etiqueta en el
   * nombre»). Antes decía solo «Departamento» mientras el botón mostraba «Antioquia»: quien dicta
   * «pulsar Antioquia» no encontraba el control y el lector no anunciaba qué estaba elegido.
   */
  protected readonly nombreDelControl = computed(() => {
    const valor = this.textoDelElegido();
    const encabezado = this.rotulo() || this.etiqueta();
    return valor === this.etiqueta() ? valor : `${encabezado}: ${valor}`;
  });

  protected readonly textoDelElegido = computed(() => {
    const elegida = this.valorEfectivo();
    return this.opciones().find(o => o.id === elegida)?.etiqueta ?? this.etiqueta();
  });

  constructor() {
    // El foco va al buscador en cuanto se abre: quien abre un filtro de treinta y dos opciones
    // viene a escribir, no a recorrerlas.
    effect(() => {
      if (this.abierto()) { queueMicrotask(() => this.buscador()?.nativeElement.focus()); }
    });
  }

  protected alternar(): void {
    if (this.apagado()) { return; }
    const abriendo = !this.abierto();
    this.abierto.set(abriendo);
    if (abriendo) {
      this.busqueda.set('');
      this.marcada.set(Math.max(0, this.visibles().findIndex(o => o.id === this.valorEfectivo())));
    }
  }

  /** Al escribir en el buscador del panel: filtra, vuelve a la primera opción y recalcula lado y altura del panel. */
  protected alBuscar(texto: string): void {
    this.busqueda.set(texto);
    this.marcada.set(0);
    queueMicrotask(() => this.anclaje()?.colocar());
  }

  /**
   * La opción marcada con el teclado queda a la vista dentro del scroll interno de la lista. Se llama desde las teclas y
   * no desde un efecto: un efecto que lee `marcada` y toca el DOM se disparaba también al abrir y con cada
   * recomputación de las opciones, y en el asistente de registro de Festival dejaba la página sin respuesta.
   */
  private verLaMarcada(): void {
    queueMicrotask(() => (this.anfitrion.nativeElement.querySelector(`#${CSS.escape(this.idDeOpcion(this.marcada()))}`) as HTMLElement | null)
      ?.scrollIntoView?.({ block: 'nearest' }));
  }

  protected elegir(id: string): void {
    this.valorDelFormulario.set(id);
    this.alCambiarElFormulario(id);
    this.cambiar.emit(id);
    this.cerrar();
  }

  private cerrar(devolverElFoco = true): void {
    if (!this.abierto()) { return; }
    this.abierto.set(false);
    this.busqueda.set('');
    // EL FOCO VUELVE AL CONTROL. Si se queda en un elemento que acaba de desaparecer, el siguiente
    // tabulador empieza desde el principio del documento.
    if (devolverElFoco) {
      this.anfitrion.nativeElement.querySelector<HTMLButtonElement>('.filtro__control')?.focus();
    }
  }

  /**
   * Una sola puerta para el teclado: cerrado, abre; abierto, navega.
   *
   * Con dos manejadores —uno en el disparador y otro en el panel— la flecha abajo que abre podía
   * llegar también al que navega y saltarse la primera opción.
   */
  protected alTeclear(evento: KeyboardEvent): void {
    if (!this.abierto()) {
      if (evento.key !== 'ArrowDown' && evento.key !== 'Enter' && evento.key !== ' ') { return; }
      evento.preventDefault();
      this.alternar();
      return;
    }
    this.alNavegar(evento);
  }

  private alNavegar(evento: KeyboardEvent): void {
    const total = this.visibles().length;
    switch (evento.key) {
      // Tab sigue su camino y el panel se cierra: no deja un menú abierto detrás del foco.
      case 'Tab':
        this.cerrar(false);
        break;
      case 'Escape':
        evento.preventDefault();
        // Lo que está dentro se cierra primero: una ventana que contenga el filtro no se cierra con la misma tecla.
        evento.stopPropagation();
        this.cerrar();
        break;
      case 'ArrowDown':
        evento.preventDefault();
        if (total) { this.marcada.set((this.marcada() + 1) % total); this.verLaMarcada(); }
        break;
      case 'ArrowUp':
        evento.preventDefault();
        if (total) { this.marcada.set((this.marcada() - 1 + total) % total); this.verLaMarcada(); }
        break;
      case 'Home':
        evento.preventDefault();
        this.marcada.set(0);
        this.verLaMarcada();
        break;
      case 'End':
        evento.preventDefault();
        this.marcada.set(Math.max(0, total - 1));
        this.verLaMarcada();
        break;
      case 'Enter': {
        evento.preventDefault();
        const opcion = this.visibles()[this.marcada()];
        if (opcion) { this.elegir(opcion.id); }
        break;
      }
    }
  }

  protected alPulsarFuera(evento: MouseEvent): void {
    if (!this.abierto()) { return; }
    if (this.anfitrion.nativeElement.contains(evento.target as Node)) { return; }
    // Sin devolver el foco: quien pulsa fuera está yendo a otra parte.
    this.cerrar(false);
  }
}
