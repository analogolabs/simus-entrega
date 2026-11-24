import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * UN INTERRUPTOR de dos estados (habilitado / deshabilitado) para una opción que se aplica al instante.
 *
 * <b>ES UN BOTÓN CON `role="switch"`</b>, no una casilla: una casilla se marca y luego se guarda; un interruptor
 * actúa al pulsarlo, y por eso emite `cambiar` con el estado que se PIDE y NO lo cambia por su cuenta. Quien lo usa
 * guarda y, cuando el servidor confirma, le pasa el nuevo `activo`. Así nunca muestra un estado que no se guardó.
 * El nombre accesible lo da `etiqueta` («Agenda y eventos para Ana Pérez»); el estado lo lee el lector de pantalla
 * por `aria-checked` y también se dice con texto («Habilitado») para no depender solo del color.
 */
@Component({
  selector: 'app-interruptor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: .5rem; }
    .interruptor { position: relative; flex: none; width: 2.75rem; height: 1.5rem; padding: 0; border: 1px solid var(--color-rotulo); border-radius: 999px; background: var(--color-niebla); cursor: pointer; transition: background-color .15s; }
    .interruptor::after { content: ''; position: absolute; top: .1875rem; left: .1875rem; width: 1rem; height: 1rem; border-radius: 50%; background: var(--color-rotulo); transition: transform .15s, background-color .15s; }
    .interruptor[aria-checked='true'] { border-color: var(--color-morado); background: var(--color-morado); }
    .interruptor[aria-checked='true']::after { transform: translateX(1.25rem); background: #fff; }
    .interruptor:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); }
    .interruptor:disabled { cursor: not-allowed; opacity: .6; }
    .interruptor__texto { min-width: 6.5rem; color: var(--color-prosa); font-size: var(--text-dato); font-weight: 600; }
    @media (prefers-reduced-motion: reduce) { .interruptor, .interruptor::after { transition: none; } }
  `],
  template: `
    <button type="button" class="interruptor" role="switch" data-interruptor
      [attr.aria-checked]="activo()" [attr.aria-label]="etiqueta()" [disabled]="deshabilitado() || ocupado()"
      [attr.aria-busy]="ocupado() ? 'true' : null" [attr.title]="motivo()"
      (click)="cambiar.emit(!activo())"></button>
    @if (conTexto()) {
      <span class="interruptor__texto" aria-hidden="true">{{ ocupado() ? 'Guardando…' : (activo() ? textoActivo() : textoInactivo()) }}</span>
    }
  `,
})
export class InterruptorComponent {
  readonly activo = input(false, { transform: booleanAttribute });
  /** El nombre accesible: qué se enciende y para quién. */
  readonly etiqueta = input.required<string>();
  readonly deshabilitado = input(false, { transform: booleanAttribute });
  readonly ocupado = input(false, { transform: booleanAttribute });
  /** Por qué no se puede tocar (se ve como `title`). */
  readonly motivo = input<string | null>(null);
  readonly conTexto = input(true, { transform: booleanAttribute });
  readonly textoActivo = input('Habilitado');
  readonly textoInactivo = input('Deshabilitado');
  /** El estado que la persona pide al pulsarlo. */
  readonly cambiar = output<boolean>();
}
