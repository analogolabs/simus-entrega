import { ChangeDetectionStrategy, Component, forwardRef, input, signal, computed } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

import { AYUDA_DEL_NIT, mensajeDeNit } from '../../../../core/formularios/nit';
import { CampoDeTextoComponent } from '../campo-de-texto/campo-de-texto.component';

/**
 * El campo del NIT de una organización: la pieza común de los cuatro formularios que lo piden
 * (registro con cuenta, segunda organización, alta de la consola y perfil), decisión 96 de docs/referencia/20-decisiones-y-flujos-por-modulo.md.
 *
 * <b>QUÉ HACE POR TODOS.</b> Pone la ayuda que dice cuándo se escribe y cuándo se deja vacío (una
 * organización sin personería jurídica no tiene NIT y se identifica por su responsable), y revisa el
 * formato al salir del campo con la misma regla que el servidor (`core/formularios/nit.ts`). El error
 * que devuelve el servidor se pasa en `error` y gana sobre el local.
 *
 * <b>LO QUE YA ESTABA GUARDADO NO SE REPRUEBA.</b> Con `valorGuardado`, el campo no se queja mientras
 * el valor sea el que ya tenía la organización: la regla se aplica a lo que cambia, igual que en el servidor.
 */
@Component({
  selector: 'app-campo-de-nit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CampoDeTextoComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoDeNitComponent), multi: true }],
  host: { '(focusout)': 'alSalir()' },
  template: `
    <app-campo-de-texto
      [etiqueta]="etiqueta()"
      [identificador]="identificador()"
      [nombre]="nombre()"
      [ayuda]="ayuda"
      [marcador]="marcador()"
      [error]="errorVisible()"
      [tamano]="tamano()"
      [maximo]="40"
      autocompletar="off"
      [formControl]="control"
      (cambiar)="alEscribir($event)" />
  `,
})
export class CampoDeNitComponent implements ControlValueAccessor {
  readonly etiqueta = input('NIT de la organización (opcional)');
  readonly identificador = input<string | null>(null);
  readonly nombre = input<string | null>(null);
  readonly tamano = input<'normal' | 'comodo'>('comodo');
  /** Un ejemplo de fondo mientras el campo está vacío (L-2); no sustituye a la etiqueta. */
  readonly marcador = input<string | null>(null);
  /** El error del servidor, o el que el formulario calculó al enviar. */
  readonly error = input<string | null>(null);
  /** El valor con el que la organización ya está guardada: no se vuelve a juzgar mientras no cambie. */
  readonly valorGuardado = input<string | null>(null);

  protected readonly ayuda = AYUDA_DEL_NIT;
  /** El valor vive en un control reactivo: se escribe de forma síncrona desde `ngModel` de quien lo usa. */
  protected readonly control = new FormControl('', { nonNullable: true });
  private readonly local = signal<string | null>(null);
  protected readonly errorVisible = computed(() => this.error() ?? this.local());

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: string | null): void { this.control.setValue(valor ?? '', { emitEvent: false }); this.local.set(null); }
  registerOnChange(fn: (valor: string) => void): void { this.alCambiar = fn; }
  registerOnTouched(fn: () => void): void { this.alTocar = fn; }
  setDisabledState(inhabilitado: boolean): void {
    if (inhabilitado) this.control.disable({ emitEvent: false }); else this.control.enable({ emitEvent: false });
  }

  protected alEscribir(texto: string): void {
    this.local.set(null);
    this.alCambiar(texto);
  }

  protected alSalir(): void {
    this.alTocar();
    const actual = this.control.value.trim();
    const guardado = this.valorGuardado();
    this.local.set(guardado !== null && actual === guardado.trim() ? null : mensajeDeNit(actual));
  }
}
