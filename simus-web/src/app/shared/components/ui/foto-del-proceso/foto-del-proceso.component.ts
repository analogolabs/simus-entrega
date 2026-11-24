import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BotonNativoDirective } from '../boton/boton.component';
import { ErrorDeCampoComponent } from '../error-de-campo/error-de-campo.component';

/** Lo que devuelve quien sube la imagen al Banco de archivos. */
export interface ResultadoDeFotoSubida {
  ok: boolean;
  archivo?: { id: number; url: string };
  error?: string;
}

/** La foto tal como la guarda el proceso: el identificador es el dato y la dirección es cómo se ve. */
export interface FotoDelProceso {
  archivoFotoId: number | null;
  fotoUrl: string | null;
  fotoAlt: string | null;
}

/**
 * La foto de un proceso del ecosistema (LUT-02, decisión 115): la misma pieza para un taller, un
 * espacio o una red, sin que cada ficha escriba su propio selector de imagen.
 *
 * <b>LA SUBIDA SE INYECTA</b> (`subir`): una organización sube por la puerta de sus archivos y una
 * persona sin organización por la suya, con cuota propia. La pieza no sabe cuál; solo exige texto
 * alternativo, enseña la imagen y avisa del cambio. Quitar la foto la desvincula: el archivo se
 * conserva en el Banco (nada se borra).
 */
@Component({
  selector: 'app-foto-del-proceso',
  standalone: true,
  imports: [FormsModule, BotonNativoDirective, ErrorDeCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="space-y-3" [disabled]="deshabilitada()" data-testid="foto-del-proceso">
      <legend class="text-sm font-bold text-slate-900">Foto</legend>
      <p class="text-xs text-slate-500">Se ve en la ficha pública cuando el registro está publicado. Cambiarla no lo devuelve a revisión.</p>
      @if (fotoUrl()) {
        <img [src]="fotoUrl()" [alt]="fotoAlt() || 'Foto actual'" width="320" height="192" class="max-h-48 w-auto rounded-lg border border-slate-200 object-cover" data-foto-vista />
        <button type="button" appBoton="secundaria" (click)="quitar()">Quitar foto</button>
      } @else {
        <div>
          <label [for]="idBase() + '-archivo'" class="block text-sm text-slate-700">Imagen (WebP, PNG o JPEG)</label>
          <input [id]="idBase() + '-archivo'" type="file" accept="image/webp,image/png,image/jpeg" (change)="elegir($event)"
                 class="mt-1 block w-full text-sm" [attr.aria-describedby]="idBase() + '-error'" />
        </div>
        <div>
          <label [for]="idBase() + '-alt'" class="block text-sm text-slate-700">Descripción de la imagen</label>
          <input [id]="idBase() + '-alt'" type="text" maxlength="300" name="fotoAlt" [ngModel]="alt()" (ngModelChange)="alt.set($event)"
                 class="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm" />
        </div>
        <button type="button" appBoton="secundaria" [disabled]="subiendo() || !archivo()" (click)="subirLaElegida()">
          {{ subiendo() ? 'Subiendo…' : 'Subir foto' }}
        </button>
      }
      <app-error-de-campo [identificador]="idBase() + '-error'" [mensaje]="error() || errorExterno()" />
    </fieldset>
  `,
})
export class FotoDelProcesoComponent {
  readonly idBase = input('foto-del-proceso');
  readonly fotoUrl = input<string | null>(null);
  readonly fotoAlt = input<string | null>(null);
  readonly deshabilitada = input(false);
  readonly errorExterno = input<string | null>(null);
  /** Quien sube la imagen al Banco de archivos, por la puerta que le corresponda. */
  readonly subir = input.required<(archivo: File, alt: string) => Promise<ResultadoDeFotoSubida>>();

  readonly cambio = output<FotoDelProceso>();

  readonly archivo = signal<File | null>(null);
  readonly alt = signal('');
  readonly subiendo = signal(false);
  readonly error = signal('');

  elegir(evento: Event): void {
    this.archivo.set((evento.target as HTMLInputElement).files?.[0] ?? null);
    this.error.set('');
  }

  async subirLaElegida(): Promise<void> {
    const archivo = this.archivo();
    if (!archivo || this.subiendo()) return;
    const alt = this.alt().trim();
    if (!alt) { this.error.set('Describe la imagen para quien no puede verla.'); return; }
    this.subiendo.set(true);
    this.error.set('');
    const resultado = await this.subir()(archivo, alt);
    this.subiendo.set(false);
    if (!resultado.ok || !resultado.archivo) {
      this.error.set(resultado.error ?? 'No fue posible subir la foto.');
      return;
    }
    this.archivo.set(null);
    this.alt.set('');
    this.cambio.emit({ archivoFotoId: resultado.archivo.id, fotoUrl: resultado.archivo.url, fotoAlt: alt });
  }

  quitar(): void {
    this.cambio.emit({ archivoFotoId: null, fotoUrl: null, fotoAlt: null });
  }
}
