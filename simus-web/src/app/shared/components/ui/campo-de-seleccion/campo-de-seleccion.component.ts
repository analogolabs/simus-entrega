import { ChangeDetectionStrategy, Component, booleanAttribute, ElementRef, afterEveryRender, computed, forwardRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { ErrorDeCampoComponent } from '../error-de-campo/error-de-campo.component';

/** Una opción de la lista: lo que se guarda y lo que se lee. */
export interface OpcionDeSeleccion {
  readonly valor: string;
  readonly etiqueta: string;
  readonly deshabilitada?: boolean;
}

let contador = 0;

/**
 * El campo de selección del proyecto (UI-C): el `<select>` nativo, con rótulo, ayuda y error.
 *
 * <b>CUÁNDO SE USA.</b> Para una lista CORTA (hasta siete opciones) dentro de un formulario o de una
 * ficha: tipo de documento, sí o no, un estado. Para una lista mediana o larga (departamento,
 * municipio, catálogo) el estándar es `app-filtro-desplegable`, que gobierna su panel, su búsqueda y
 * su teclado; el panel de un `<select>` lo dibuja el sistema operativo (docs/desarrollo/30-consola-y-acceso.md §30.6).
 *
 * <b>QUÉ GARANTIZA</b>, igual que `app-campo-de-texto`: rótulo SIEMPRE arriba y enlazado con `for`;
 * ayuda y error bajo el control, citados por `aria-describedby`; la altura sale de los tokens
 * (`normal` 36 px, `comodo` 44 px); borde de 3:1, radio de 8 px y anillo de foco únicos (los de
 * `styles.css`, que también visten a cualquier `<select>` suelto que aún no se haya migrado).
 *
 * <b>DOS FORMAS DE DAR LAS OPCIONES.</b> Con `[opciones]` (lista de `{ valor, etiqueta }`) o escribiendo
 * los `<option>` dentro de la etiqueta, que es lo que hacen las fichas con catálogos del servidor
 * (`@for` y el pipe `nombrePropio` se quedan en la plantilla de quien lo usa). En la segunda forma el
 * componente alinea el valor elegido con las opciones cada vez que la vista se vuelve a pintar,
 * porque las opciones pueden llegar después del valor. Las opciones con `[ngValue]` (valores que no
 * son texto) NO caben aquí: ese `<select>` se queda nativo.
 *
 * <b>OPCIÓN VACÍA.</b> `textoVacio` añade una primera opción de valor `''` («Todos», «Elige una…»).
 * Se usa con `ngModel` o con formularios reactivos y emite `cambiar` con el valor elegido.
 */
@Component({
  selector: 'app-campo-de-seleccion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorDeCampoComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoDeSeleccionComponent), multi: true }],
  host: { '[attr.data-tamano]': 'tamano()' },
  styles: [`
    :host { display: block; }
    .campo-de-seleccion__rotulo {
      display: block; color: var(--color-valor);
      font-size: var(--text-dato); font-weight: 700; line-height: 1.25;
    }
    .campo-de-seleccion__obligatorio { margin-left: .15rem; color: var(--color-peligro); }
    .campo-de-seleccion__control { display: block; width: 100%; margin-top: .25rem; }
    :host([data-tamano='comodo']) .campo-de-seleccion__control { height: var(--spacing-control-comodo); }
    .campo-de-seleccion__ayuda { margin: .25rem 0 0; color: var(--color-rotulo); font-size: var(--text-dato); line-height: 1.3; }
  `],
  template: `
    <label class="campo-de-seleccion__rotulo" [attr.for]="idCampo()">
      {{ etiqueta() }}@if (obligatorio()) { <span class="campo-de-seleccion__obligatorio" aria-hidden="true">*</span> }
    </label>
    <select #control
      class="campo-de-seleccion__control"
      [attr.id]="idCampo()"
      [attr.data-testid]="pruebaId() || null"
      [attr.name]="nombreDelControl() || null"
      [attr.aria-required]="obligatorio() ? 'true' : null"
      [attr.aria-invalid]="error() || invalido() ? 'true' : null"
      [attr.aria-describedby]="descritoPor()"
      [disabled]="inhabilitado()"
      (change)="alElegir($event)"
      (blur)="alSalir()">
      @if (opciones(); as lista) {
        @if (textoVacio() !== null) {
          <option value="" [selected]="valor() === ''">{{ textoVacio() }}</option>
        }
        @for (opcion of lista; track opcion.valor) {
          <option [value]="opcion.valor" [disabled]="!!opcion.deshabilitada" [selected]="opcion.valor === valor()">{{ opcion.etiqueta }}</option>
        }
      } @else {
        <ng-content />
      }
    </select>
    @if (ayuda() && !error()) {
      <p class="campo-de-seleccion__ayuda" [id]="idAyuda()">{{ ayuda() }}</p>
    }
    <app-error-de-campo [identificador]="idError()" [mensaje]="error()" />
  `,
})
export class CampoDeSeleccionComponent implements ControlValueAccessor {
  /** Qué se elige, en palabras. Es el rótulo visible, SIEMPRE encima del control. */
  readonly etiqueta = input.required<string>();
  /** Las opciones como datos. Sin ellas, se usan los `<option>` escritos dentro de la etiqueta. */
  readonly opciones = input<readonly OpcionDeSeleccion[] | null>(null);

  /** El texto de la primera opción, de valor vacío («Todos», «Elige una»). `null` = sin opción vacía. */
  readonly textoVacio = input<string | null>(null);
  readonly identificador = input<string | null>(null);
  readonly nombre = input<string | null>(null);
  readonly ayuda = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly obligatorio = input(false, { transform: booleanAttribute });
  readonly deshabilitado = input(false, { transform: booleanAttribute });

  /** 36 px (`normal`: consola, panel, filtros) o 44 px (`comodo`: formularios, ingreso, directorios). */
  readonly tamano = input<'normal' | 'comodo'>('normal');

  /** El `data-testid` del `<select>` real, no del anfitrión: es el que recibe `selectOption`. */
  readonly pruebaId = input<string | null>(null);
  /** El error o la ayuda están fuera del componente (un `<app-error-de-campo>` propio): se enlaza su id. */
  readonly descritoPorExterno = input<string | null>(null);
  /** Marca el control como inválido cuando el error lo pinta quien usa el componente. */
  readonly invalido = input(false, { transform: booleanAttribute });

  /**
   * El valor que se guarda NO es texto. El `<select>` nativo con `[ngValue]` guardaba números o `null`;
   * aquí las opciones llevan `value` (texto) y el campo traduce al elegir: con `comoNumero`, «12» pasa a
   * 12; con `vacioComoNulo`, la opción vacía pasa a `null` en lugar de `''`.
   */
  readonly comoNumero = input(false, { transform: booleanAttribute });
  readonly vacioComoNulo = input(false, { transform: booleanAttribute });

  readonly cambiar = output<string>();
  /** El control perdió el foco: para validar al salir del campo (en lugar de `(blur)`, que no sube). */
  readonly salir = output<void>();
  /**
   * EL `name` DEL ANFITRIÓN VIAJA AL `<select>`. `ngModel` dentro de un `<form>` exige `name` en el
   * anfitrión; las pruebas y los recorridos del navegador buscan `select[name=…]`. Así vale para los dos.
   */
  private readonly anfitrion: ElementRef<HTMLElement> = inject(ElementRef);
  protected readonly nombreDelControl = computed(() => this.nombre() || this.anfitrion.nativeElement.getAttribute('name'));
  private readonly control = viewChild<ElementRef<HTMLSelectElement>>('control');

  protected readonly valor = signal('');
  private readonly estaInhabilitadoPorElFormulario = signal(false);
  protected readonly inhabilitado = computed(() => this.deshabilitado() || this.estaInhabilitadoPorElFormulario());

  private readonly idPropio = `campo-de-seleccion-${++contador}`;
  protected readonly idCampo = computed(() => this.identificador() || this.idPropio);
  protected readonly idAyuda = computed(() => `${this.idCampo()}-ayuda`);
  protected readonly idError = computed(() => `${this.idCampo()}-error`);
  protected readonly descritoPor = computed(() => {
    if (this.error()) { return this.idError(); }
    const propios = this.ayuda() ? this.idAyuda() : null;
    const externo = this.descritoPorExterno();
    return [propios, externo].filter(Boolean).join(' ') || null;
  });

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  constructor() {
    // OPCIONES ESCRITAS EN LA PLANTILLA DE QUIEN USA EL CAMPO: no llevan `[selected]`, y pueden llegar
    // después del valor (los departamentos, de un servicio). Tras cada pintado se alinea el control.
    afterEveryRender(() => {
      const select = this.control()?.nativeElement;
      if (select && !this.opciones() && select.value !== this.valor()) { select.value = this.valor(); }
    });
  }

  /**
   * Fija el valor desde fuera, también en el `<select>` real. Lo usa quien tiene que devolver el campo a lo
   * que dice otra fuente de verdad (la barra lateral del panel: la organización la decide la URL, y si
   * cambiar queda pendiente de una confirmación, el selector no puede quedarse diciendo otra).
   */
  establecer(valor: string): void {
    this.valor.set(valor);
    const select = this.control()?.nativeElement;
    if (select) { select.value = valor; }
  }

  writeValue(valor: string | number | null): void { this.valor.set(valor === null || valor === undefined ? '' : String(valor)); }
  registerOnChange(fn: (valor: string) => void): void { this.alCambiar = fn; }
  registerOnTouched(fn: () => void): void { this.alTocar = fn; }
  setDisabledState(inhabilitado: boolean): void { this.estaInhabilitadoPorElFormulario.set(inhabilitado); }

  protected alElegir(evento: Event): void {
    const elegido = (evento.target as HTMLSelectElement).value;
    this.valor.set(elegido);
    this.alCambiar(this.traducir(elegido));
    this.cambiar.emit(elegido);
  }

  private traducir(elegido: string): string {
    if (elegido === '' && this.vacioComoNulo()) { return null as unknown as string; }
    if (this.comoNumero() && elegido !== '' && !Number.isNaN(Number(elegido))) { return Number(elegido) as unknown as string; }
    return elegido;
  }

  protected alSalir(): void { this.alTocar(); this.salir.emit(); }
}
