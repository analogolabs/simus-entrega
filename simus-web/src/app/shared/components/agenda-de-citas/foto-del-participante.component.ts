import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

import { BotonNativoDirective } from '../ui/boton/boton.component';
import { ErrorDeCampoComponent } from '../ui/error-de-campo/error-de-campo.component';
import { AvatarDePersonaComponent } from './avatar-de-persona.component';

/** La regla del Banco de archivos para una imagen (`MediosWebContrato`): WebP, PNG o JPEG, hasta 2 MB. */
const FORMATOS = ['image/webp', 'image/png', 'image/jpeg'];
const PESO_MAXIMO = 2 * 1024 * 1024;

/**
 * «Tu foto» dentro de la agenda de citas (AGE2): quien participa, comprador o artista, sube su foto y así aparece en la
 * parrilla, en las tarjetas y en las listas. Sin foto se pintan sus iniciales.
 *
 * <b>RECONCILIADA CON PERF.</b> La pieza de perfil público (`app-foto-del-perfil`) vive en una función del
 * panel y trae la zona para arrastrar, atada al guardado del perfil; esta es compartida, mínima y se sube al instante,
 * porque quien participa puede ser un comprador sin cuenta con su propio vínculo. Las dos usan la MISMA regla del
 * Banco (WebP, PNG o JPEG, hasta 2 MB) y la MISMA API de subida; el texto «Tu foto» es el mismo.
 */
@Component({
  selector: 'app-foto-del-participante',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarDePersonaComponent, BotonNativoDirective, ErrorDeCampoComponent],
  template: `
    <fieldset data-foto-del-participante class="space-y-2">
      <legend class="text-cuerpo font-semibold text-valor">Tu foto</legend>
      <div class="flex flex-wrap items-center gap-4">
        <app-avatar-de-persona [nombre]="nombre()" [fotoUrl]="vistaPrevia() || fotoActual()" [medida]="5" />
        <div class="min-w-0">
          <p class="text-cuerpo text-prosa">{{ (vistaPrevia() || fotoActual()) ? 'Así te verán en la parrilla y en las listas.' : 'Sin foto, te verán con tus iniciales.' }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" appBoton="secundaria" tamano="menudo" data-subir-foto [disabled]="subiendo()" (click)="abrir()">
              {{ (vistaPrevia() || fotoActual()) ? 'Cambiar foto' : 'Subir foto' }}</button>
            @if (fotoActual() || vistaPrevia()) { <button type="button" appBoton="terciaria" tamano="menudo" [disabled]="subiendo()" (click)="quitada.emit()">Quitar foto</button> }
          </div>
          <p id="foto-participante-ayuda" class="mt-1 text-dato text-prosa">WebP, PNG o JPEG, de hasta 2 MB.</p>
          @if (subiendo()) { <p role="status" class="text-cuerpo font-semibold text-morado">Subiendo la foto…</p> }
        </div>
      </div>
      <input #entrada id="foto-del-participante" type="file" class="sr-only" tabindex="-1" aria-label="Elegir una imagen para tu foto"
             accept="image/webp,image/png,image/jpeg" aria-describedby="foto-participante-ayuda foto-participante-error" (change)="alElegir($event)" />
      <app-error-de-campo identificador="foto-participante-error" [mensaje]="errorPropio() || error()" />
    </fieldset>
  `,
})
export class FotoDelParticipanteComponent {
  readonly nombre = input.required<string>();
  /** La foto que ya tiene. */
  readonly fotoActual = input<string | null>(null);
  /** La imagen elegida que todavía no se sube (antes de inscribirse). */
  readonly vistaPrevia = input<string | null>(null);
  readonly subiendo = input(false);
  readonly error = input<string | null>(null);
  readonly elegida = output<File>();
  readonly quitada = output<void>();

  protected readonly errorPropio = signal('');
  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');

  protected abrir(): void { this.entrada().nativeElement.click(); }

  protected alElegir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const archivo = campo.files?.[0] ?? null;
    campo.value = '';
    if (!archivo) return;
    if (!FORMATOS.includes(archivo.type)) {
      this.errorPropio.set(`«${archivo.name}» no es una imagen WebP, PNG o JPEG. Elige otro archivo.`);
      return;
    }
    if (archivo.size > PESO_MAXIMO) {
      this.errorPropio.set('La imagen pesa más de 2 MB. Elige una más liviana.');
      return;
    }
    this.errorPropio.set('');
    this.elegida.emit(archivo);
  }
}
