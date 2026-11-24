import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideLoaderCircle, LucideSearch, LucideX } from '@lucide/angular';
import { Subject, filter, merge, of, switchMap, take, tap, timer } from 'rxjs';

/** La pausa por omisión de toda búsqueda que consulta al servidor (B-1): ni una petición por tecla, ni un retraso que se note. */
export const ESPERA_DE_BUSQUEDA_MS = 300;

/**
 * El buscador de una lista del proyecto.
 *
 * <b>FILTRA MIENTRAS SE ESCRIBE.</b> quedó fijado para
 * todo el proyecto, no para una pantalla: «quiero que los buscadores de todo el proyecto sean
 * automáticos, que vayan filtrando a medida que vas escribiendo y no hasta darle enter, poner la x
 * para limpiar la barra de búsqueda y eliminar elementos o botones redundantes». Los trece
 * buscadores de la consola y del portal hacían tres cosas distintas: unos filtraban al escribir,
 * otros esperaban a Intro, y dos tenían además un botón «Buscar» al lado que hacía lo mismo que
 * Intro.
 *
 * <b>LA ESPERA NO ES UN RETARDO, ES LO QUE EVITA UNA PETICION POR TECLA.</b> Cuando la búsqueda la
 * resuelve el servidor —Agenda, Noticias, Organizaciones—, emitir en cada pulsación mandaría diez
 * peticiones por «festival» y las respuestas podrían llegar desordenadas, dejando en pantalla el
 * resultado de «festiv» encima del de «festival». Se espera a que la escritura se detenga. Cuando
 * el filtrado es en memoria no hay nada que esperar y `espera` se pone en cero.
 *
 * <b>CÓMO ESPERA (B-1).</b> Con RxJS: cada pulsación entra a un flujo que SE DESCARTA si llega otra antes de la pausa
 * (`switchMap` + `timer`, el mismo efecto de `debounceTime` pero con una pausa que se puede cambiar y adelantar con Intro),
 * y solo emite si el texto es DISTINTO del último que se avisó (`distinctUntilChanged` a mano, porque la referencia se
 * reinicia cuando la pantalla cambia `valor` desde fuera, p. ej. «Limpiar filtros»). Quien consulta al servidor debe
 * cancelar su petición en vuelo con `switchMap`: ver `consultaCancelable` en `shared/utils/consulta-cancelable.ts`.
 *
 * <b>ESTADO DE CARGA.</b> `cargando` cambia la lupa por un indicador sutil, pone `aria-busy` en el campo y anuncia
 * «Buscando» en una región de estado; con `prefers-reduced-motion` el indicador no gira.
 *
 * <b>LA «X» SOLO APARECE CUANDO HAY ALGO QUE BORRAR</b>, y al pulsarla devuelve el foco al campo:
 * quien limpia una búsqueda casi siempre va a escribir otra.
 *
 * NO SE USA EL ASPA QUE PINTA EL NAVEGADOR en `input[type=search]`: existe solo en algunos
 * navegadores, no se puede estilar, no se anuncia con nombre y no avisa a la aplicación de forma
 * fiable. Se apaga en el contrato de estilo y se pone una de verdad.
 */
@Component({
  selector: 'app-buscador-de-lista',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tamano]': 'tamano()', '[attr.data-tono]': 'tono()' },
  imports: [LucideLoaderCircle, LucideSearch, LucideX],
  styles: [`
    :host { position: relative; display: block; flex: 1 1 14rem; min-width: 11rem; max-width: 18rem; }
    :host([ancho]) { max-width: none; }

    .buscador__espera { animation: buscador-girar .8s linear infinite; }
    @keyframes buscador-girar { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .buscador__espera { animation: none; opacity: .7; } }
    .buscador__lupa {
      position: absolute; left: .75rem; top: 50%; transform: translateY(-50%);
      color: var(--color-rotulo); pointer-events: none;
    }
    .buscador__campo {
      height: var(--spacing-control); width: 100%;
      border: 1px solid var(--color-borde-campo); border-radius: var(--radius-control); background: #fff;
      padding: 0 .8rem 0 2.1rem;
      color: var(--color-valor); font-size: var(--text-cuerpo);
      transition: border-color .12s, box-shadow .12s;
    }
    .buscador__campo::placeholder { color: var(--color-rotulo); }
    .buscador__campo:hover { border-color: var(--color-borde-campo-hover); }
    .buscador__campo:focus { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); border-color: var(--color-foco); }
    /* DOS ALTURAS POR CONTEXTO (docs/desarrollo/30-consola-y-acceso.md §30.6): 36 px en áreas de trabajo y 44 px en el directorio
       público y los formularios. El componente no elige: lo pide quien lo coloca. */
    :host([data-tamano='comodo']) .buscador__campo { height: var(--spacing-control-comodo); }
    /* El aspa nativa, fuera: la de este componente la sustituye en todos los navegadores. */
    .buscador__campo::-webkit-search-cancel-button { appearance: none; }

    .buscador__limpiar {
      position: absolute; right: .35rem; top: 50%; transform: translateY(-50%);
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.75rem; height: 1.75rem;
      border: 1px solid transparent; border-radius: 50%;
      background: transparent; color: var(--color-rotulo); cursor: pointer;
    }
    .buscador__limpiar:hover { background: #f1f3f7; color: var(--color-valor); }
    .buscador__limpiar:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); }
    /* SOBRE FONDO OSCURO (la cabecera de la consola, UI-D): mismo campo, la misma altura de 36 px y el
       mismo anillo, con el relleno traslúcido y la letra clara. No es otro componente: es el tono. */
    :host([data-tono='oscuro']) { max-width: none; }
    :host([data-tono='oscuro']) .buscador__lupa { color: rgba(255, 255, 255, .6); }
    :host([data-tono='oscuro']) .buscador__campo {
      border-color: transparent; background: rgba(255, 255, 255, .07); color: #fff;
    }
    :host([data-tono='oscuro']) .buscador__campo::placeholder { color: rgba(255, 255, 255, .6); }
    :host([data-tono='oscuro']) .buscador__campo:hover { background: rgba(255, 255, 255, .12); }
    :host([data-tono='oscuro']) .buscador__campo:focus { border-color: rgba(255, 255, 255, .45); background: rgba(255, 255, 255, .16); outline-color: rgba(255, 255, 255, .7); }
    :host([data-tono='oscuro']) .buscador__limpiar { color: rgba(255, 255, 255, .7); }
    :host([data-tono='oscuro']) .buscador__limpiar:hover { background: rgba(255, 255, 255, .14); color: #fff; }
    :host([data-tono='oscuro']) .buscador__limpiar:focus-visible { outline-color: rgba(255, 255, 255, .7); }
    /* El texto no pasa por debajo del aspa. */
    .buscador__campo--con-aspa { padding-right: 2.3rem; }
  `],
  template: `
    @if (!etiquetaVisible()) {
      <label class="sr-only" [attr.for]="identificador()">{{ etiqueta() }}</label>
    }
    @if (cargando()) {
      <span class="buscador__lupa" aria-hidden="true"><svg class="buscador__espera" lucideLoaderCircle [size]="14"></svg></span>
      <span class="sr-only" role="status">Buscando…</span>
    } @else {
      <svg class="buscador__lupa" lucideSearch [size]="14" aria-hidden="true"></svg>
    }
    <input
      #campo
      class="buscador__campo"
      [class.buscador__campo--con-aspa]="texto().length > 0"
      [attr.aria-busy]="cargando() ? 'true' : null"
      type="search"
      [attr.id]="identificador()"
      [attr.name]="identificador()"
      [attr.data-testid]="identificador()"
      [attr.placeholder]="marcador()"
      [attr.aria-label]="sinRotuloExterno() ? etiqueta() : null"
      [value]="texto()"
      [attr.role]="combobox() ? 'combobox' : null"
      [attr.aria-controls]="combobox()?.controla ?? null"
      [attr.aria-autocomplete]="combobox() ? 'list' : null"
      [attr.aria-expanded]="combobox() ? combobox()!.expandido : null"
      [attr.aria-activedescendant]="combobox()?.activo ?? null"
      [attr.autocomplete]="combobox() ? 'off' : null"
      (input)="alEscribir($event)"
      (keydown.escape)="alEscapar($event)"
      (keydown.enter)="emitirYa()" />
    @if (texto().length > 0) {
      <button type="button" class="buscador__limpiar"
        [attr.aria-label]="'Limpiar ' + etiqueta().toLowerCase()"
        [title]="'Limpiar ' + etiqueta().toLowerCase()"
        (click)="limpiar()">
        <svg lucideX [size]="14" aria-hidden="true"></svg>
      </button>
    }
  `,
})
export class BuscadorDeListaComponent {
  /** Lo que hay escrito. Lo guarda el panel: este componente no tiene estado propio. */
  readonly valor = input.required<string>();

  /** Qué se busca aquí, en palabras. Es el nombre accesible del campo y el de la «x». */
  readonly etiqueta = input.required<string>();

  /** El texto tenue de dentro del campo. */
  readonly marcador = input('Buscar…');

  /** El `id`, el `name` y el `data-testid` del campo, que en la consola son el mismo. */
  readonly identificador = input.required<string>();

  /**
   * La pantalla ya pinta un rótulo visible asociado a este campo con su propio `<label for>`.
   *
   * <b>ENTONCES ESTE COMPONENTE NO PONE EL SUYO.</b> Dos etiquetas para un mismo campo hacen que un
   * lector de pantalla lea el nombre dos veces, o que se queden con la que no toca. Donde el
   * buscador va suelto en una barra de lista —lo corriente— el rótulo no se ve y lo pone esta
   * pieza; donde va dentro de un formulario con su rótulo escrito, se declara aquí.
   */
  readonly etiquetaVisible = input(false);

  /**
   * Cuánto se espera tras la última tecla antes de avisar, en milisegundos.
   *
   * CERO PARA LO QUE SE FILTRA EN MEMORIA y 300 para lo que va al servidor. No hay un tercer valor
   * a elegir: con menos, una escritura normal manda varias peticiones; con más, se nota el retraso.
   */
  readonly espera = input(300);

  /**
   * `normal` = 36 px (consola, panel, filtros de lista); `comodo` = 44 px (directorio público y
   * formularios). Los dos valores de `--spacing-control*`; no hay un tercero que elegir.
   */
  readonly tamano = input<'normal' | 'comodo'>('normal');

  /** `claro` (el de siempre) o `oscuro`, para la cabecera morada de la consola. */
  readonly tono = input<'claro' | 'oscuro'>('claro');

  /**
   * El campo es la entrada de una lista de resultados que pinta quien lo usa (`combobox` de ARIA):
   * `controla` es el `id` de esa lista, `activo` el `id` del resultado resaltado y `expandido` si hay
   * lista abierta. Las flechas y Enter los gestiona quien lo usa, escuchando `(keydown)` en este anfitrión.
   */
  readonly combobox = input<{ controla: string; activo: string | null; expandido: boolean } | null>(null);

  /** La búsqueda está en curso (la consulta salió y no ha vuelto): lupa por indicador, `aria-busy` y aviso «Buscando». */
  readonly cargando = input(false);

  /** El texto, cuando la escritura se ha detenido y es distinto del último que se avisó. */
  readonly cambiar = output<string>();

  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');
  private readonly escritura$ = new Subject<string>();
  private readonly adelantar$ = new Subject<void>();
  /** Lo último que se avisó: lo que ya tiene quien nos usa. Una repetición no se vuelve a avisar. */
  private ultimoAvisado = '';
  /** Lo que se ve escrito en el campo, ya, aunque todavía no se haya avisado (para que la «X» aparezca al instante). */
  protected readonly texto = signal('');

  /**
   * UI-F: declara `etiquetaVisible` pero la pantalla NO enlazó un `<label for>` con este campo (el mapa pintaba un
   * `<span>`): el campo se quedaba sin nombre, y el único que tenía era el texto del `placeholder`, que desaparece al
   * escribir y no es un nombre. Entonces la pieza pone el suyo con `aria-label`. Si el `<label for>` existe, no
   * se duplica.
   */
  protected readonly sinRotuloExterno = signal(false);

  constructor() {
    afterNextRender(() => {
      this.sinRotuloExterno.set(this.etiquetaVisible() && !document.querySelector(`label[for="${CSS.escape(this.identificador())}"]`));
    });
    // Si la pantalla cambia `valor` (limpiar filtros, restaurar de la URL), eso es lo que ya está avisado y lo escrito.
    effect(() => {
      const externo = this.valor();
      untracked(() => {
        // Si es lo que acabamos de avisar, el campo ya lo muestra (y quizá hay algo más escrito después): no se pisa.
        if (externo === this.ultimoAvisado) { return; }
        this.ultimoAvisado = externo;
        this.texto.set(externo);
      });
    });
    this.escritura$.pipe(
      // Cada pulsación descarta la espera de la anterior. El `timer` o Intro la cierran; en memoria (espera 0) no hay pausa.
      switchMap(t => (this.espera() <= 0 ? of(t) : merge(timer(this.espera()), this.adelantar$).pipe(take(1), switchMap(() => of(t))))),
      filter(t => t !== this.ultimoAvisado),
      tap(t => { this.ultimoAvisado = t; }),
      // UNA ESPERA PENDIENTE NO PUEDE SOBREVIVIR A LA PANTALLA que la lanzó: emitiría sobre un panel que ya no existe.
      takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(t => this.cambiar.emit(t));
  }

  alEscribir(evento: Event): void {
    const escrito = (evento.target as HTMLInputElement).value;
    this.texto.set(escrito);
    this.escritura$.next(escrito);
  }

  /** Intro no es la forma de buscar, pero tampoco puede no hacer nada: adelanta la espera. */
  emitirYa(): void {
    this.escritura$.next(this.campo().nativeElement.value);
    this.adelantar$.next();
  }

  /**
   * Escape limpia el campo, Y SOLO SE DETIENE SI HABIA ALGO QUE LIMPIAR.
   *
   * Con el campo ya vacío la tecla sigue su camino y cierra la ventana que contenga al buscador,
   * que es lo que se espera. Si se detuviera siempre, un buscador vacío dejaría una ventana que no
   * cierra con Escape sin ninguna razón visible.
   *
   * SE MIRA LO QUE HAY ESCRITO, NO `valor()`: entre la tecla y el valor que devuelve quien nos usa
   * hay una espera, así que recién escrito `valor()` todavía está vacío y Escape no limpiaría nada.
   */
  alEscapar(evento: Event): void {
    const escrito = (evento.target as HTMLInputElement | null)?.value ?? this.valor();
    if (escrito.length === 0) return;
    evento.stopPropagation();
    this.limpiar();
  }

  limpiar(): void {
    this.campo().nativeElement.value = '';
    this.texto.set('');
    // Descarta lo pendiente y avisa ya: borrar no debe esperar. Si lo avisado ya era vacío, no se repite.
    this.escritura$.next('');
    this.adelantar$.next();
    this.campo().nativeElement.focus();
  }
}
