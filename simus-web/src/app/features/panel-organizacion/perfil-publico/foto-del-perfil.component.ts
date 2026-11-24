import { ChangeDetectionStrategy, Component, ElementRef, input, model, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideImagePlus } from '@lucide/angular';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { ErrorDeCampoComponent } from '../../../shared/components/ui/error-de-campo/error-de-campo.component';

/** La regla del Banco de archivos para una imagen (`MediosWebContrato`): WebP, PNG o JPEG, hasta 2 MB. */
export const FORMATOS_DE_FOTO = ['image/webp', 'image/png', 'image/jpeg'] as const;
export const PESO_MAXIMO_DE_FOTO = 2 * 1024 * 1024;

function pesoLegible(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * La foto del perfil público: una zona clara para subirla (perfil público).
 *
 * <b>POR QUÉ SE REDISEÑÓ.</b> Era un campo de archivo del navegador, sin zona ni indicación: una persona subió su
 * foto «casi por casualidad». Ahora hay un botón «Subir foto» con icono, una zona donde también se puede arrastrar
 * la imagen, los formatos y el tamaño admitidos a la vista, la vista previa de lo elegido y un error que dice qué
 * corregir. Usa el botón común y la MISMA regla del Banco de archivos (el servidor la vuelve a comprobar).
 *
 * <b>LA FOTO ESPERA AL GUARDADO.</b> Se elige y se ve; se sube junto con el perfil al pulsar «Guardar perfil».
 */
@Component({
  selector: 'app-foto-del-perfil',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BotonNativoDirective, ErrorDeCampoComponent, LucideImagePlus],
  template: `
    <fieldset data-foto-del-perfil>
      <legend class="text-sm font-semibold text-slate-800">Foto</legend>
      @let imagen = vistaPrevia() || fotoActual();
      <div class="mt-2 rounded-xl border-2 border-dashed p-4 transition-colors"
        [class.border-morado]="arrastrando()" [class.bg-violet-50]="arrastrando()" [class.border-slate-300]="!arrastrando()"
        (dragover)="alArrastrar($event)" (dragleave)="arrastrando.set(false)" (drop)="alSoltar($event)" data-zona-de-foto>
        <div class="flex flex-wrap items-center gap-4">
          @if (imagen) {
            <img [src]="imagen" [alt]="vistaPrevia() ? 'Vista previa de la foto elegida' : 'Tu foto actual'" class="h-24 w-24 rounded-full border border-slate-200 object-cover" width="96" height="96" data-foto-vista />
          } @else {
            <span aria-hidden="true" class="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400"><svg lucideImagePlus size="32" aria-hidden="true"></svg></span>
          }
          <div class="min-w-0 flex-1">
            <p class="text-sm text-slate-700">{{ imagen ? 'Puedes cambiarla o quitarla.' : 'Todavía no tienes foto. Arrastra una imagen aquí o elige una.' }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" appBoton="principal" (click)="abrir()" [disabled]="subiendo()" data-subir-foto>
                <svg lucideImagePlus size="16" aria-hidden="true"></svg>
                {{ imagen ? 'Cambiar foto' : 'Subir foto' }}
              </button>
              @if (imagen) { <button type="button" appBoton="secundaria" (click)="quitada.emit()" [disabled]="subiendo()">Quitar foto</button> }
            </div>
            <p id="perfil-foto-ayuda" class="mt-2 text-xs text-slate-600" data-foto-formatos>WebP, PNG o JPEG, de hasta 2 MB.</p>
            @if (subiendo()) { <p role="status" class="mt-1 text-sm font-semibold text-morado" data-foto-subiendo>Subiendo la foto…</p> }
            @else if (vistaPrevia()) { <p class="mt-1 text-sm text-slate-700" data-foto-pendiente>{{ nombreElegido() }} lista. Se subirá cuando pulses «Guardar perfil».</p> }
          </div>
        </div>
        <input #entrada id="perfil-foto" type="file" class="sr-only" tabindex="-1" aria-label="Elegir una imagen para tu foto" accept="image/webp,image/png,image/jpeg"
          (change)="alElegir($event)" aria-describedby="perfil-foto-ayuda perfil-foto-error" />
      </div>
      <app-error-de-campo identificador="perfil-foto-error" [mensaje]="errorPropio() || error()" />

      <div class="mt-3">
        <label for="perfil-foto-alt" class="block text-sm text-slate-700">Descripción de la imagen</label>
        <p id="perfil-foto-alt-ayuda" class="text-xs text-slate-600">Para quien no puede verla. Es obligatoria al elegir una foto nueva.</p>
        <input id="perfil-foto-alt" name="fotoAlt" type="text" maxlength="300" [ngModel]="descripcion()" (ngModelChange)="descripcion.set($event)" aria-describedby="perfil-foto-alt-ayuda perfil-foto-alt-error"
          class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado" />
        <app-error-de-campo identificador="perfil-foto-alt-error" [mensaje]="errorDeDescripcion()" />
      </div>
    </fieldset>
  `,
})
export class FotoDelPerfilComponent {
  /** La foto que ya tiene el perfil. */
  readonly fotoActual = input<string | null>(null);
  /** La vista previa de la imagen elegida, que todavía no se sube. */
  readonly vistaPrevia = input<string | null>(null);
  readonly subiendo = input(false);
  /** Un error del servidor (al subir o guardar). */
  readonly error = input<string | null>(null);
  readonly errorDeDescripcion = input<string | null>(null);
  readonly descripcion = model('');
  readonly elegida = output<File>();
  readonly quitada = output<void>();

  protected readonly arrastrando = signal(false);
  protected readonly errorPropio = signal('');
  protected readonly nombreElegido = signal('La imagen');
  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');

  abrir(): void {
    this.entrada().nativeElement.click();
  }

  alElegir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const archivo = campo.files?.[0] ?? null;
    campo.value = '';
    if (archivo) this.recibir(archivo);
  }

  alArrastrar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(true);
  }

  alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo) this.recibir(archivo);
  }

  /** La regla del Banco, comprobada antes de subir para no esperar al servidor por algo que se ve a simple vista. */
  private recibir(archivo: File): void {
    if (!(FORMATOS_DE_FOTO as readonly string[]).includes(archivo.type)) {
      this.errorPropio.set(`«${archivo.name}» no es una imagen WebP, PNG o JPEG. Elige otro archivo.`);
      return;
    }
    if (archivo.size > PESO_MAXIMO_DE_FOTO) {
      this.errorPropio.set(`La imagen pesa ${pesoLegible(archivo.size)} y el máximo es ${pesoLegible(PESO_MAXIMO_DE_FOTO)}. Elige una más liviana.`);
      return;
    }
    this.errorPropio.set('');
    this.nombreElegido.set(archivo.name);
    this.elegida.emit(archivo);
  }
}
