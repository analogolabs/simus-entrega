import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CampoDeTextoComponent } from '../ui/campo-de-texto/campo-de-texto.component';
import { BotonNativoDirective } from '../ui/boton/boton.component';

/** Cuántos enlaces de escucha admite un portafolio. */
export const MAXIMO_DE_ENLACES = 5;

/** El tipo de enlace según su sitio: se detecta sola, para rotular cada campo. */
export function tipoDeEnlace(url: string): string {
  const texto = url.trim().toLowerCase();
  if (!texto) return '';
  let host: string;
  try { host = new URL(texto).hostname.replace(/^www\./, ''); } catch { return ''; }
  if (host.endsWith('spotify.com') || host === 'spoti.fi') return 'Spotify';
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'YouTube';
  if (host.endsWith('bandcamp.com')) return 'Bandcamp';
  if (host.endsWith('soundcloud.com')) return 'SoundCloud';
  return 'Sitio web';
}

/** «https://…» y nada más: es lo único que se admite como enlace. */
export function esEnlaceHttps(url: string): boolean {
  try { return new URL(url.trim()).protocol === 'https:'; } catch { return false; }
}

/** Los enlaces de un texto (uno por línea), sin vacíos y hasta el tope. */
export function enlacesDeTexto(texto: string | null | undefined): string[] {
  return (texto ?? '').split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, MAXIMO_DE_ENLACES);
}

/**
 * LOS ENLACES DE ESCUCHA, UNO POR CAMPO (hasta cinco): cada campo dice el tipo que detecta (Spotify, YouTube, Bandcamp, SoundCloud, sitio web) y
 * valida que sea https. El valor sale como texto de una línea por enlace, que es lo que guarda la agenda. En el teléfono los campos se apilan.
 */
@Component({
  selector: 'app-campos-de-enlaces',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CampoDeTextoComponent, BotonNativoDirective],
  styles: [`:host { display: block; } .lista { display: grid; grid-template-columns: minmax(0, 1fr); gap: .75rem; }`],
  template: `
    <fieldset class="space-y-2" data-testid="campos-de-enlaces">
      <legend class="text-dato font-bold text-valor">{{ etiqueta() }}</legend>
      <div class="lista">
        @for (campo of campos(); track $index; let i = $index) {
          <app-campo-de-texto [etiqueta]="'Enlace ' + (i + 1) + (tipo(campo) ? ' · ' + tipo(campo) : '')" [identificador]="prefijo() + '-' + i" tipo="url"
            marcador="https://" [ngModel]="campo" (ngModelChange)="cambiar(i, $event)" [error]="error(campo)" />
        }
      </div>
      @if (campos().length < maximo) {
        <button type="button" appBoton="secundaria" tamano="menudo" data-testid="agregar-enlace" (click)="agregar()">Agregar otro enlace</button>
      }
      <p class="text-dato text-prosa">Hasta {{ maximo }} enlaces de audio, video o sitio; deben empezar por https://.</p>
    </fieldset>
  `,
})
export class CamposDeEnlacesComponent {
  readonly etiqueta = input('Enlaces de escucha');
  readonly prefijo = input('enlace');
  /** Una línea por enlace. */
  readonly valor = model('');
  protected readonly maximo = MAXIMO_DE_ENLACES;

  /** Los campos: los enlaces que hay y, al final, uno vacío mientras quepan (o los que se agregaron a mano). */
  private readonly extra = signal(0);
  protected readonly campos = computed(() => {
    const lleno = this.valor().split(/\r?\n/).slice(0, MAXIMO_DE_ENLACES);
    while (lleno.length > 0 && lleno[lleno.length - 1] === '' && lleno.length > this.extra() + 1) lleno.pop();
    const n = Math.max(1, Math.min(MAXIMO_DE_ENLACES, lleno.length));
    return Array.from({ length: n }, (_, i) => lleno[i] ?? '');
  });

  protected tipo(url: string): string { return tipoDeEnlace(url); }
  protected error(url: string): string | null {
    return url.trim() && !esEnlaceHttps(url) ? 'Escribe un enlace completo que empiece por https://' : null;
  }
  protected cambiar(i: number, nuevo: string): void {
    const lista = [...this.campos()];
    lista[i] = (nuevo ?? '').replace(/[\r\n]+/g, ' ').trim();
    this.valor.set(lista.join('\n').replace(/\n+$/, ''));
  }
  protected agregar(): void {
    const lista = [...this.campos(), ''];
    this.extra.set(lista.length - 1);
    this.valor.set(lista.join('\n'));
  }
}
