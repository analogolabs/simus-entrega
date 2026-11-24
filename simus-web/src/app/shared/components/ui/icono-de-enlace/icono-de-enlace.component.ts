import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAudioLines, LucideGlobe, LucideLink, LucideMusic2 } from '@lucide/angular';

/** Los cuatro enlaces que una organización o un Festival pueden declarar. */
// Las cuatro claves son las que ya usaba el listado público de Festivales; se conservan tal cual
// para que la pieza compartida no obligue a traducir nada en quien la adopta.
export type TipoDeEnlace =
  | 'sitioWeb' | 'facebook' | 'instagram' | 'otroEnlace'
  // Las redes y plataformas del perfil público de una persona (trazos genéricos, no logotipos).
  | 'youtube' | 'linkedin' | 'x' | 'tiktok' | 'spotify' | 'soundcloud' | 'bandcamp';

/**
 * El icono de un enlace, por lo que ese enlace es.
 *
 * <b>POR QUE ES UN COMPONENTE.</b> El dibujo de Instagram y el de Facebook estaban escritos a mano
 * —dos veces— dentro de `festivales-publicos-page`, y hicieron falta
 * también en la ficha de la organización. Tres copias del mismo trazo es la forma segura de que
 * dentro de un mes haya tres iconos distintos.
 *
 * <b>POR QUE NO SON ICONOS DE LUCIDE.</b> Lucide retiró los logotipos de marca de su catálogo, así
 * que `lucideFacebook` y `lucideInstagram` no existen. Los dos de aquí no son los logotipos: son
 * trazos genéricos —un rectángulo con lente para Instagram, una silueta de «f» para Facebook— del
 * mismo grosor y la misma rejilla que el resto de la interfaz. El sitio web y «otro enlace» sí usan
 * iconos de Lucide.
 */
@Component({
  selector: 'app-icono-de-enlace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAudioLines, LucideGlobe, LucideLink, LucideMusic2],
  styles: [':host { display: contents; }'],
  template: `
    @switch (tipo()) {
      @case ('sitioWeb') { <svg lucideGlobe [size]="medida()" aria-hidden="true"></svg> }
      @case ('instagram') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             [style.width.px]="medida()" [style.height.px]="medida()">
          <rect x="2" y="2" width="20" height="20" rx="5"/>
          <circle cx="12" cy="12" r="4"/>
          <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
        </svg>
      }
      @case ('facebook') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             [style.width.px]="medida()" [style.height.px]="medida()">
          <path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h3l1-4h-4V7.5a1 1 0 0 1 1-1H16z"/>
        </svg>
      }
      @case ('youtube') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             [style.width.px]="medida()" [style.height.px]="medida()">
          <rect x="2" y="5" width="20" height="14" rx="4"/>
          <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/>
        </svg>
      }
      @case ('linkedin') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             [style.width.px]="medida()" [style.height.px]="medida()">
          <rect x="2" y="2" width="20" height="20" rx="3"/>
          <path d="M7.5 10v6.5M7.5 7.2v.1M11.5 16.5V10m0 3c0-1.7 1.2-3 2.8-3s2.2 1.1 2.2 2.8v3.7"/>
        </svg>
      }
      @case ('x') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             [style.width.px]="medida()" [style.height.px]="medida()">
          <path d="M4 4l16 16M20 4L4 20"/>
        </svg>
      }
      @case ('tiktok') { <svg lucideMusic2 [size]="medida()" aria-hidden="true"></svg> }
      @case ('spotify') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             [style.width.px]="medida()" [style.height.px]="medida()">
          <circle cx="12" cy="12" r="10"/>
          <path d="M7 9.5c3.5-1 7-.7 10 1M7.5 12.7c3-.8 6-.5 8.5 1M8 15.7c2.5-.6 5-.3 7 .8"/>
        </svg>
      }
      @case ('soundcloud') { <svg lucideAudioLines [size]="medida()" aria-hidden="true"></svg> }
      @case ('bandcamp') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             [style.width.px]="medida()" [style.height.px]="medida()">
          <path d="M2 18L8.5 6H22l-6.5 12z"/>
        </svg>
      }
      @default { <svg lucideLink [size]="medida()" aria-hidden="true"></svg> }
    }
  `,
})
export class IconoDeEnlaceComponent {
  readonly tipo = input.required<TipoDeEnlace>();

  /** Lado del icono en píxeles. 14 es el de las tarjetas; 16 acompaña bien a un valor de 16 px. */
  readonly tamano = input(16);

  readonly medida = computed(() => this.tamano());
}
