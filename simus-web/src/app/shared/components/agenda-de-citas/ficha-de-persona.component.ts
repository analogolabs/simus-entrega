import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TonoDeEstado } from '../ui/indicador-de-estado/indicador-de-estado.component';
import { IndicadorDeEstadoComponent } from '../ui/indicador-de-estado/indicador-de-estado.component';
import { AvatarDePersonaComponent } from './avatar-de-persona.component';

/** Un enlace del portafolio de una persona, listo para pintar como etiqueta. */
export interface EnlaceDePortafolio { url: string; rotulo: string; }

/** Los enlaces de un portafolio (uno por línea): solo http o https, nunca otro esquema; cada uno con el sitio como rótulo. */
export function enlacesDePortafolio(texto: string | null | undefined): EnlaceDePortafolio[] {
  return (texto ?? '').split(/\r?\n/).map(x => x.trim()).filter(x => /^https?:\/\//i.test(x)).slice(0, 5).map(url => {
    let rotulo = url;
    try {
      const u = new URL(url);
      const camino = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
      rotulo = u.hostname.replace(/^www\./, '') + (camino ? `/${camino}` : '');
    } catch { /* se deja la dirección completa */ }
    return { url, rotulo };
  });
}

/**
 * La FICHA de una PERSONA de la agenda (artista, comprador o booker): su cara, su nombre, su rol, su agrupación u organización, su estado con
 * palabras, su mesa o stand y los accesos rápidos a su portafolio. Las acciones (aprobar, rechazar, retirar…) entran por `[acciones]`.
 *
 * Es la misma ficha en la lista de participantes, en las cabeceras de la parrilla y en el detalle de una cita: así las personas se reconocen
 * donde estén. No lleva borde de color ni cápsulas: el rol y los enlaces son etiquetas rectas y el estado es un punto con su palabra.
 */
@Component({
  selector: 'app-ficha-de-persona',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarDePersonaComponent, IndicadorDeEstadoComponent],
  styles: [`
    :host { display: block; }
    .ficha { display: flex; flex-direction: column; gap: .6rem; height: 100%; }
    .ficha__cabecera { display: flex; align-items: center; gap: .75rem; min-width: 0; }
    .ficha__nombre { margin: 0; font-size: var(--text-lectura); font-weight: 700; color: var(--color-valor); }
    .ficha__sub { margin: 0; font-size: var(--text-cuerpo); color: var(--color-prosa); }
    .etiqueta { display: inline-block; padding: 0 .45rem; border-radius: .3rem; background: var(--color-morado-100); color: var(--color-morado); font-size: var(--text-dato); font-weight: 700; line-height: 1.25rem; }
    a.etiqueta { text-decoration: none; transition: background var(--dur-rapida); }
    a.etiqueta:hover { background: color-mix(in srgb, var(--color-morado) 18%, white); }
    a.etiqueta:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 1px; }
    .ficha__sitio { margin: 0; font-size: var(--text-cuerpo); color: var(--color-valor); font-weight: 600; }
    @media (prefers-reduced-motion: reduce) { a.etiqueta { transition: none; } }
  `],
  template: `
    <div class="ficha">
      <div class="ficha__cabecera">
        <app-avatar-de-persona [nombre]="nombre()" [fotoUrl]="fotoUrl()" [medida]="3.25" />
        <div class="min-w-0">
          <p class="ficha__nombre break-words" data-testid="ficha-nombre">{{ nombre() }}</p>
          @if (entidad()) { <p class="ficha__sub break-words" data-testid="ficha-entidad">{{ entidad() }}</p> }
        </div>
      </div>
      <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="etiqueta" data-testid="ficha-rol">{{ rol() }}</span>
        @if (estado()) { <app-indicador-de-estado [etiqueta]="estado()!" [tono]="tono()" [conTexto]="true" /> }
      </p>
      @if (sitio()) { <p class="ficha__sitio" data-testid="ficha-sitio">{{ sitio() }}</p> }
      @if (detalle()) { <p class="ficha__sub line-clamp-2">{{ detalle() }}</p> }
      @if (enlaces().length) {
        <p class="flex flex-wrap gap-1" data-testid="ficha-portafolio">
          @for (e of enlaces(); track e.url) {
            <a class="etiqueta" [href]="e.url" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Portafolio de ' + nombre() + ': ' + e.rotulo + ' (se abre en otra pestaña)'">{{ e.rotulo }}</a>
          }
        </p>
      }
      <ng-content />
      <div class="mt-auto flex flex-wrap gap-2 empty:hidden"><ng-content select="[acciones]" /></div>
    </div>
  `,
})
export class FichaDePersonaComponent {
  readonly nombre = input.required<string>();
  readonly rol = input.required<string>();
  readonly entidad = input<string | null>(null);
  readonly fotoUrl = input<string | null>(null);
  readonly estado = input<string | null>(null);
  readonly tono = input<TonoDeEstado>('preliminar');
  /** La mesa o el stand que le toca. */
  readonly sitio = input<string | null>(null);
  readonly detalle = input<string | null>(null);
  /** Los enlaces del portafolio, uno por línea. */
  readonly portafolio = input<string | null>(null);
  protected readonly enlaces = computed(() => enlacesDePortafolio(this.portafolio()));
}
