import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

let contador = 0;

/**
 * El selector numérico del proyecto: un «−», la casilla del número y un «+», los tres de la MISMA altura y pegados en
 * un solo control.
 *
 * <b>POR QUÉ EXISTE.</b> En el asistente de la agenda de citas el «−» y el «+» eran botones redondos de 44 px y la casilla,
 * un campo de texto de 36 px en otra línea base: el trío salía desalineado. Aquí es un único grupo (`role="group"`) cuyos
 * tres elementos comparten el token de altura de los controles (`--spacing-control-comodo`, o `--spacing-control` con
 * `tamano="normal"`) y el mismo borde, sin cápsulas.
 *
 * <b>CON LÍMITE O SIN ÉL.</b> `permiteVacio` deja la casilla en blanco con el rótulo `rotuloVacio` («Sin límite»): `null` es
 * «sin límite». Pulsar «+» desde vacío parte del mínimo; pulsar «−» en el mínimo vuelve a vacío si se permite.
 * Escribir un número fuera de rango lo lleva al rango al salir de la casilla.
 */
@Component({
  selector: 'app-selector-numerico',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tamano]': 'tamano()' },
  styles: [`
    :host { display: block; }
    .grupo { display: inline-flex; align-items: stretch; height: var(--spacing-control-comodo); border: 1px solid var(--color-borde-campo); border-radius: var(--radius-control); background: #fff; overflow: hidden; }
    :host([data-tamano='normal']) .grupo { height: var(--spacing-control); }
    .paso { width: var(--spacing-control-comodo); display: inline-flex; align-items: center; justify-content: center; border: 0; background: #fff; color: var(--color-morado); font: inherit; font-size: var(--text-destacado); font-weight: 700; line-height: 1; cursor: pointer; }
    :host([data-tamano='normal']) .paso { width: var(--spacing-control); }
    .paso:first-child { border-right: 1px solid var(--color-borde-campo); }
    .paso:last-child { border-left: 1px solid var(--color-borde-campo); }
    .paso:hover:not(:disabled) { background: #f6f3fb; }
    .paso:disabled { color: var(--color-rotulo); cursor: not-allowed; background: #f6f7f9; }
    .paso:focus-visible, .casilla:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: -2px; }
    .casilla { width: 5.5rem; border: 0; padding: 0 .5rem; text-align: center; font: inherit; font-size: var(--text-cuerpo); font-variant-numeric: tabular-nums; color: var(--color-valor); background: #fff; -moz-appearance: textfield; appearance: textfield; }
    .casilla::-webkit-outer-spin-button, .casilla::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .casilla:disabled { background: #f6f7f9; color: var(--color-rotulo); }
    .rotulo { display: block; margin-bottom: .25rem; color: var(--color-valor); font-size: var(--text-dato); font-weight: 700; line-height: 1.25; }
  `],
  template: `
    <label class="rotulo" [attr.for]="id">{{ etiqueta() }}</label>
    <div class="grupo" role="group" [attr.aria-label]="etiqueta()">
      <button type="button" class="paso" [attr.aria-label]="'Un número menos: ' + etiqueta()" [disabled]="deshabilitado() || !puedeBajar()" (click)="bajar()">−</button>
      <input class="casilla" type="text" inputmode="numeric" [id]="id" [value]="valor() === null ? '' : valor()" [placeholder]="rotuloVacio()"
             [disabled]="deshabilitado()" [attr.aria-describedby]="ayuda() ? id + '-ayuda' : null" (change)="escribir($any($event.target))" />
      <button type="button" class="paso" [attr.aria-label]="'Un número más: ' + etiqueta()" [disabled]="deshabilitado() || !puedeSubir()" (click)="subir()">+</button>
    </div>
    @if (ayuda()) { <p class="mt-1 text-cuerpo text-prosa" [id]="id + '-ayuda'">{{ ayuda() }}</p> }
  `,
})
export class SelectorNumericoComponent {
  protected readonly id = `selector-numerico-${++contador}`;

  readonly etiqueta = input.required<string>();
  readonly ayuda = input('');
  readonly valor = model<number | null>(null);
  readonly minimo = input(1);
  readonly maximo = input(10000);
  readonly salto = input(1);
  /** Con `true`, `null` es un valor válido y se muestra con `rotuloVacio`. */
  readonly permiteVacio = input(false);
  readonly rotuloVacio = input('Sin límite');
  readonly deshabilitado = input(false);
  readonly tamano = input<'normal' | 'comodo'>('comodo');

  protected readonly puedeBajar = computed(() => {
    const v = this.valor();
    return v === null ? false : v > this.minimo() || this.permiteVacio();
  });
  protected readonly puedeSubir = computed(() => (this.valor() ?? this.minimo() - this.salto()) < this.maximo());

  protected bajar(): void {
    const v = this.valor();
    if (v === null) return;
    if (v - this.salto() < this.minimo()) { if (this.permiteVacio()) this.valor.set(null); return; }
    this.valor.set(v - this.salto());
  }

  protected subir(): void {
    const v = this.valor();
    this.valor.set(v === null ? this.minimo() : Math.min(this.maximo(), v + this.salto()));
  }

  protected escribir(campo: HTMLInputElement): void {
    const texto = campo.value.trim();
    if (!texto) {
      if (this.permiteVacio()) this.valor.set(null);
      else this.valor.set(this.minimo());
    } else {
      const n = Math.round(Number(texto.replace(',', '.')));
      this.valor.set(Number.isFinite(n) ? Math.min(this.maximo(), Math.max(this.minimo(), n)) : this.valor());
    }
    campo.value = this.valor() === null ? '' : String(this.valor());
  }
}
