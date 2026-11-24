import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, input, output, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideSearch, LucideX } from '@lucide/angular';

import { ErrorDeCampoComponent } from '../error-de-campo/error-de-campo.component';

/** Los tipos de entrada que admite el campo. Una fecha o un archivo son otra pieza. */
export type TipoDeCampoDeTexto = 'text' | 'email' | 'tel' | 'url' | 'number' | 'password' | 'search';

let contador = 0;

/**
 * El campo de texto del proyecto (UI-B).
 *
 * <b>POR QUÉ EXISTE.</b> El barrido de diseño (docs/desarrollo/30-consola-y-acceso.md §30.3 y anexo A) midió 129 campos en 59
 * pantallas: cada formulario escribía su rótulo, su ayuda y su error a su manera, y el resultado eran
 * 8 alturas de búsqueda, 5 radios y 8 tratamientos de foco. Lo que faltaba era UNA pieza con
 * etiqueta, ayuda y error que cualquier formulario pudiera pedir. Esta es.
 *
 * <b>QUÉ GARANTIZA.</b>
 * <list type="number">
 *   <item><b>Etiqueta SUPERIOR y siempre enlazada</b> (`<label for>` con el `id` del campo): nunca un
 *   rótulo dentro del control ni un `placeholder` haciendo de rótulo.</item>
 *   <item><b>Ayuda y error bajo el campo</b>, citados por `aria-describedby`; el error es
 *   `app-error-de-campo`, la única forma de decir «esto está mal» en el producto, y el campo pasa a
 *   `aria-invalid`.</item>
 *   <item><b>Dos alturas por contexto, desde los tokens</b>: `normal` 36 px (consola, panel,
 *   filtros) y `comodo` 44 px (formularios, ingreso y directorios públicos).</item>
 *   <item><b>Borde de 3:1 y foco único</b>: los de `styles.css` (`--color-borde-campo`,
 *   `--color-foco`). Aquí no hay un color ni un radio propios.</item>
 *   <item><b>Lupa y «✕» opcionales</b> (`conBusqueda`) para el campo que busca; el buscador de lista
 *   (`app-buscador-de-lista`) sigue siendo el de las barras de lista, con su espera de 300 ms.</item>
 * </list>
 *
 * <b>SE USA CON `ngModel` O CON FORMULARIOS REACTIVOS</b> (`ControlValueAccessor`) y emite `cambiar`
 * en cada pulsación para quien lo usa sin formulario.
 */
@Component({
  selector: 'app-campo-de-texto',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorDeCampoComponent, LucideSearch, LucideX],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoDeTextoComponent), multi: true }],
  host: { '[attr.data-tamano]': 'tamano()' },
  styles: [`
    :host { display: block; }
    .campo-de-texto__rotulo {
      display: block; color: var(--color-valor);
      font-size: var(--text-dato); font-weight: 700; line-height: 1.25;
    }
    .campo-de-texto__obligatorio { margin-left: .15rem; color: var(--color-peligro); }
    .campo-de-texto__envoltorio { position: relative; margin-top: .25rem; }
    .campo-de-texto__control {
      display: block; width: 100%; height: var(--spacing-control);
      border: 1px solid var(--color-borde-campo); border-radius: var(--radius-control); background: #fff;
      padding: 0 .75rem; color: var(--color-valor);
      font-family: inherit; font-size: var(--text-cuerpo); line-height: 1.25rem;
      transition: border-color .12s;
    }
    :host([data-tamano='comodo']) .campo-de-texto__control { height: var(--spacing-control-comodo); }
    textarea.campo-de-texto__control { height: auto; min-height: 5rem; padding: .45rem .75rem; line-height: 1.5; resize: vertical; }
    :host([data-tamano='comodo']) textarea.campo-de-texto__control { height: auto; }
    .campo-de-texto__control::placeholder { color: var(--color-rotulo); }
    .campo-de-texto__control:hover:not(:disabled) { border-color: var(--color-borde-campo-hover); }
    .campo-de-texto__control:focus-visible {
      outline: var(--anillo-foco-ancho) solid var(--color-foco);
      outline-offset: var(--anillo-foco-separacion); border-color: var(--color-foco);
    }
    .campo-de-texto__control:disabled { background: #f6f7f9; color: var(--color-rotulo); cursor: not-allowed; }
    .campo-de-texto__control[aria-invalid='true'] { border-color: var(--color-peligro); }
    .campo-de-texto__control--con-lupa { padding-left: 2.1rem; }
    .campo-de-texto__control--con-aspa { padding-right: 2.3rem; }
    .campo-de-texto__lupa {
      position: absolute; left: .75rem; top: 50%; transform: translateY(-50%);
      color: var(--color-rotulo); pointer-events: none;
    }
    .campo-de-texto__limpiar {
      position: absolute; right: .35rem; top: 50%; transform: translateY(-50%);
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.75rem; height: 1.75rem; border: 0; border-radius: var(--radius-control);
      background: transparent; color: var(--color-rotulo); cursor: pointer;
    }
    .campo-de-texto__limpiar:hover { background: #f1f3f7; color: var(--color-valor); }
    .campo-de-texto__limpiar:focus-visible {
      outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 1px;
    }
    .campo-de-texto__ayuda { margin: .25rem 0 0; color: var(--color-rotulo); font-size: var(--text-dato); line-height: 1.3; }
  `],
  template: `
    <label class="campo-de-texto__rotulo" [attr.for]="idCampo()">
      {{ etiqueta() }}@if (obligatorio()) { <span class="campo-de-texto__obligatorio" aria-hidden="true">*</span> }
    </label>
    <div class="campo-de-texto__envoltorio">
      @if (conBusqueda()) {
        <svg class="campo-de-texto__lupa" lucideSearch [size]="14" aria-hidden="true"></svg>
      }
      @if (multilinea()) {
        <textarea
          #control
          class="campo-de-texto__control"
          [attr.id]="idCampo()"
          [attr.name]="nombre() || null"
          [attr.rows]="filas()"
          [attr.placeholder]="marcador() || null"
          [attr.maxlength]="maximo()"
          [attr.aria-required]="obligatorio() ? 'true' : null"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="descritoPor()"
          [attr.autocomplete]="autocompletar() || null"
          [disabled]="inhabilitado()"
          [value]="valor()"
          (input)="alEscribir($event)"
          (blur)="alSalir()"></textarea>
      } @else {
        <input
          #control
          class="campo-de-texto__control"
          [class.campo-de-texto__control--con-lupa]="conBusqueda()"
          [class.campo-de-texto__control--con-aspa]="conBusqueda() && valor().length > 0"
          [attr.type]="tipo()"
          [attr.id]="idCampo()"
          [attr.name]="nombre() || null"
          [attr.placeholder]="marcador() || null"
          [attr.maxlength]="maximo()"
          [attr.aria-required]="obligatorio() ? 'true' : null"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="descritoPor()"
          [attr.autocomplete]="autocompletar() || null"
          [disabled]="inhabilitado()"
          [value]="valor()"
          (input)="alEscribir($event)"
          (blur)="alSalir()"
          (keydown.escape)="alEscapar($event)" />
        @if (conBusqueda() && valor().length > 0 && !inhabilitado()) {
          <button type="button" class="campo-de-texto__limpiar"
            [attr.aria-label]="'Limpiar ' + etiqueta().toLowerCase()" [title]="'Limpiar ' + etiqueta().toLowerCase()"
            (click)="limpiar()">
            <svg lucideX [size]="14" aria-hidden="true"></svg>
          </button>
        }
      }
    </div>
    @if (ayuda() && !error()) {
      <p class="campo-de-texto__ayuda" [id]="idAyuda()">{{ ayuda() }}</p>
    }
    <app-error-de-campo [identificador]="idError()" [mensaje]="error()" />
  `,
})
export class CampoDeTextoComponent implements ControlValueAccessor {
  /** Qué es este campo, en palabras. Es el rótulo visible, SIEMPRE encima del control. */
  readonly etiqueta = input.required<string>();

  readonly tipo = input<TipoDeCampoDeTexto>('text');

  /** El `id` del control. Si no se da, se genera uno estable por instancia. */
  readonly identificador = input<string | null>(null);
  readonly nombre = input<string | null>(null);

  /** El texto tenue de dentro: un ejemplo, NO un rótulo (el rótulo es `etiqueta`). */
  readonly marcador = input<string | null>(null);

  /** Una frase que ayuda a rellenarlo. Se oculta cuando hay un error. */
  readonly ayuda = input<string | null>(null);

  /** El error que se muestra bajo el campo: una frase que dice qué hacer. `null` = sin error. */
  readonly error = input<string | null>(null);

  readonly obligatorio = input(false);
  readonly deshabilitado = input(false);

  /** 36 px (`normal`: consola, panel, filtros) o 44 px (`comodo`: formularios, ingreso, directorios). */
  readonly tamano = input<'normal' | 'comodo'>('normal');

  /** Lupa a la izquierda y «✕» para limpiar: para el campo que busca. */
  readonly conBusqueda = input(false);

  /** Un área de texto en vez de una línea. */
  readonly multilinea = input(false);
  readonly filas = input(4);
  readonly maximo = input<number | null>(null);
  readonly autocompletar = input<string | null>(null);

  /** El valor, en cada pulsación. Quien usa `ngModel` o un formulario reactivo no lo necesita. */
  readonly cambiar = output<string>();

  protected readonly valor = signal('');
  private readonly estaInhabilitadoPorElFormulario = signal(false);
  protected readonly inhabilitado = computed(() => this.deshabilitado() || this.estaInhabilitadoPorElFormulario());

  private readonly idPropio = `campo-de-texto-${++contador}`;
  protected readonly idCampo = computed(() => this.identificador() || this.idPropio);
  protected readonly idAyuda = computed(() => `${this.idCampo()}-ayuda`);
  protected readonly idError = computed(() => `${this.idCampo()}-error`);
  protected readonly descritoPor = computed(() => {
    if (this.error()) { return this.idError(); }
    return this.ayuda() ? this.idAyuda() : null;
  });

  private readonly control = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('control');
  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: string | null): void { this.valor.set(valor ?? ''); }
  registerOnChange(fn: (valor: string) => void): void { this.alCambiar = fn; }
  registerOnTouched(fn: () => void): void { this.alTocar = fn; }
  setDisabledState(inhabilitado: boolean): void { this.estaInhabilitadoPorElFormulario.set(inhabilitado); }

  protected alEscribir(evento: Event): void {
    const texto = (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.valor.set(texto);
    this.alCambiar(texto);
    this.cambiar.emit(texto);
  }

  protected alSalir(): void { this.alTocar(); }

  /** Escape limpia el campo que busca, y solo se detiene si había algo que limpiar. */
  protected alEscapar(evento: Event): void {
    if (!this.conBusqueda() || this.valor().length === 0) { return; }
    evento.stopPropagation();
    this.limpiar();
  }

  protected limpiar(): void {
    this.valor.set('');
    this.alCambiar('');
    this.cambiar.emit('');
    this.control()?.nativeElement.focus();
  }
}
