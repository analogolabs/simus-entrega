import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AdminImage, ContenidoWebApiService } from '../../../core/services/contenido-web-api.service';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';

/**
 * La descripción de una imagen del sitio para quien no puede verla.
 *
 * <b>POR QUÉ EXISTE.</b> El servidor guardaba un texto alternativo por ranura y lo servía en el
 * manifiesto público, pero el panel nunca ofrecía cambiarlo: quedaba el que trajo la siembra, y
 * quien administra el sitio no tenía cómo describir la imagen que acababa de subir. Es una
 * cuestión de accesibilidad, no de maquetación.
 *
 * <b>LO QUE NO HACE.</b> No tiene borrador: la ranura guarda una sola descripción y se aplica a
 * lo que el sitio sirve al guardar. Por eso lo dice debajo del campo, para que nadie espere un
 * «guardar y publicar» que no existe. Tampoco decide por la persona: no puede quedar vacío.
 */
@Component({
  selector: 'app-texto-alternativo-de-imagen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BotonComponent],
  template: `
    <div class="mt-3 space-y-1.5 border-t border-slate-100 pt-3" [attr.data-testid]="'alt-' + imagen().key">
      <div class="flex items-center justify-between gap-3">
        <label [for]="'alt-' + imagen().key" class="campo__rotulo">Descripción para quien no ve la imagen</label>
        <span class="text-dato font-bold" [class.text-rose-500]="excede()" [class.text-slate-400]="!excede()">
          {{ texto().length }}/{{ tope() }}
        </span>
      </div>
      <textarea
        [id]="'alt-' + imagen().key"
        rows="2"
        [value]="texto()"
        [disabled]="!enabled() || ocupado()"
        [attr.maxlength]="tope()"
        [attr.aria-invalid]="vacio() ? 'true' : null"
        [attr.aria-describedby]="'alt-ayuda-' + imagen().key"
        (input)="texto.set($any($event.target).value); guardada.set(false)"
        placeholder="Ej. Niñas y niños ensayan en una escuela municipal de música"
        class="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-hidden transition focus:border-morado focus:ring-1 focus:ring-morado disabled:opacity-60"
      ></textarea>
      <p [id]="'alt-ayuda-' + imagen().key" class="text-dato leading-relaxed text-slate-500">
        Lo lee un lector de pantalla y aparece si la imagen no carga. Describe qué se ve, no cómo se llama el archivo.
        Se aplica al sitio apenas lo guardas.
      </p>
      @if (error()) {
        <p role="alert" class="text-dato font-bold text-rose-600">{{ error() }}</p>
      } @else if (guardada()) {
        <p role="status" class="text-dato font-bold text-emerald-700">Descripción guardada.</p>
      }
      @if (enabled()) {
        <app-boton
          importancia="secundaria"
          tamano="menudo"
          [identificador]="'guardar-alt-' + imagen().key"
          [deshabilitado]="!hayCambio() || vacio() || excede()"
          [ocupado]="ocupado()"
          (accion)="guardar()">Guardar descripción</app-boton>
      }
    </div>
  `,
})
export class TextoAlternativoDeImagenComponent {
  private readonly api = inject(ContenidoWebApiService);

  readonly imagen = input.required<AdminImage>();
  readonly enabled = input(true);
  /** El tope que publica el servidor; mientras llega, el mismo valor que aplica hoy. */
  readonly maximo = input<number | null>(null);

  /** Se emite cuando el servidor aceptó el cambio; el panel vuelve a leer la ranura. */
  readonly guardado = output<void>();

  readonly texto = signal('');
  readonly ocupado = signal(false);
  readonly error = signal<string | null>(null);
  readonly guardada = signal(false);

  readonly tope = computed(() => this.maximo() ?? 300);
  readonly vacio = computed(() => this.texto().trim().length === 0);
  readonly excede = computed(() => this.texto().length > this.tope());
  readonly hayCambio = computed(() => this.texto().trim() !== (this.imagen().alt ?? '').trim());

  constructor() {
    // Lo que llegó del servidor manda: tras guardar o recargar el grupo, el campo vuelve a
    // reflejarlo. Sin esto, otra persona podría haber cambiado la descripción y esta pantalla
    // seguiría mostrando —y reenviando— la vieja.
    effect(() => {
      this.texto.set(this.imagen().alt ?? '');
      this.error.set(null);
    });
  }

  async guardar(): Promise<void> {
    if (this.ocupado() || this.vacio() || this.excede() || !this.hayCambio()) { return; }
    this.ocupado.set(true);
    this.error.set(null);
    this.guardada.set(false);
    const resultado = await this.api.updateImageAlt(this.imagen().key, this.imagen().version, this.texto().trim());
    this.ocupado.set(false);

    if (!resultado.ok) {
      this.error.set(resultado.conflict
        ? 'Otra persona modificó esta imagen mientras la editabas. Recarga el bloque antes de guardar.'
        : resultado.error ?? 'No fue posible guardar la descripción.');
      return;
    }
    this.guardada.set(true);
    this.guardado.emit();
  }
}
