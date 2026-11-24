import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LucideLink, LucideMail, LucideMessageCircle, LucideShare2 } from '@lucide/angular';

import { enlacesParaCompartir, EnlaceParaCompartir } from '../../../utils/enlaces-para-compartir';
import { IconoDeEnlaceComponent } from '../icono-de-enlace/icono-de-enlace.component';

/**
 * Compartir una página: menú nativo del dispositivo (Web Share API, si el navegador lo trae), enlaces de WhatsApp,
 * Facebook, X, LinkedIn y correo, y «Copiar enlace».
 *
 * <b>SIN TERCEROS.</b> Son enlaces por dirección: no carga scripts, píxeles ni botones de las redes, y no envía nada
 * hasta que la persona pulsa. Los enlaces externos se abren en otra pestaña y lo dicen en texto para lectores de pantalla.
 *
 * <b>ACCESIBLE.</b> Es un grupo con nombre; cada control lleva un nombre completo («Compartir en WhatsApp») y el foco usa
 * el anillo único. En 390 px los controles pasan a la línea siguiente en vez de salirse.
 */
@Component({
  selector: 'app-compartir-en-redes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconoDeEnlaceComponent, LucideLink, LucideMail, LucideMessageCircle, LucideShare2],
  styles: [`
    :host { display: block; }
    .lista { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0; padding: 0; list-style: none; }
    .control {
      display: inline-flex; align-items: center; gap: .4rem; min-height: var(--spacing-control-minimo, 2.5rem); padding: 0 .85rem;
      border: 1px solid var(--color-borde-campo, #cfd4dc); border-radius: var(--radius-control, .5rem); background: #fff;
      color: var(--color-valor, #1d2433); font: inherit; font-size: var(--text-dato, .875rem); text-decoration: none; cursor: pointer;
    }
    @media (pointer: coarse) { .control { min-height: var(--spacing-control-comodo, 2.75rem); } }
    .control:hover { border-color: var(--color-morado, #6b2a8c); color: var(--color-morado, #6b2a8c); }
    .control:focus-visible { outline: var(--anillo-foco-ancho, 2px) solid var(--color-foco, #6b2a8c); outline-offset: 2px; }
  `],
  template: `
    <section [attr.aria-label]="'Compartir ' + nombre()" data-testid="compartir-en-redes">
      <p class="tipo-etiqueta mb-2 text-tinta-media">Compartir</p>
      <ul class="lista">
        @if (nativo()) {
          <li>
            <button type="button" class="control" data-compartir="nativo" (click)="compartirConElMenuNativo()">
              <svg lucideShare2 [size]="16" aria-hidden="true"></svg>Compartir…
            </button>
          </li>
        }
        @for (e of enlaces(); track e.red) {
          <li>
            <a class="control" [href]="e.href" [attr.data-compartir]="e.red" [attr.target]="e.red === 'correo' ? null : '_blank'" rel="noopener noreferrer"
              [attr.aria-label]="nombreAccesible(e)">
              @switch (e.red) {
                @case ('whatsapp') { <svg lucideMessageCircle [size]="16" aria-hidden="true"></svg> }
                @case ('correo') { <svg lucideMail [size]="16" aria-hidden="true"></svg> }
                @default { <app-icono-de-enlace [tipo]="$any(e.red)" [tamano]="16" /> }
              }
              <span>{{ e.nombre }}</span>
            </a>
          </li>
        }
        <li>
          <button type="button" class="control" data-compartir="copiar" (click)="copiarEnlace()">
            <svg lucideLink [size]="16" aria-hidden="true"></svg>{{ copiado() ? 'Enlace copiado' : 'Copiar enlace' }}
          </button>
        </li>
      </ul>
      <p class="sr-only" role="status">{{ copiado() ? 'Enlace copiado al portapapeles' : '' }}</p>
    </section>
  `,
})
export class CompartirEnRedesComponent {
  /** El título de lo que se comparte. */
  readonly titulo = input.required<string>();
  /** Qué se comparte, para el nombre del grupo: «la noticia», «el evento». */
  readonly nombre = input('esta página');
  /** La dirección; por omisión, la de la página abierta. */
  readonly url = input<string>('');

  protected readonly copiado = signal(false);
  protected readonly nativo = signal(typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  private readonly direccion = computed(() => this.url() || (typeof window !== 'undefined' ? window.location.href : ''));
  protected readonly enlaces = computed<EnlaceParaCompartir[]>(() => enlacesParaCompartir(this.direccion(), this.titulo()));

  protected nombreAccesible(e: EnlaceParaCompartir): string {
    return e.red === 'correo' ? `Compartir por correo: ${this.titulo()}` : `Compartir en ${e.nombre} (se abre en otra pestaña)`;
  }

  protected async compartirConElMenuNativo(): Promise<void> {
    try {
      await navigator.share({ title: this.titulo(), url: this.direccion() });
    } catch {
      // Cerrar el menú sin elegir lanza un `AbortError`: no es un fallo, y los demás enlaces siguen ahí.
    }
  }

  protected async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.direccion());
      this.copiado.set(true);
    } catch {
      this.copiado.set(false);
    }
  }
}
