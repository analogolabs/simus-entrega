import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideMail, LucideMapPin, LucidePhone } from '@lucide/angular';
import { esUrlValida, normalizarUrl } from '../../../../core/formularios/url';
import { IconoDeEnlaceComponent, TipoDeEnlace } from '../icono-de-enlace/icono-de-enlace.component';

/** Qué dibuja el icono de un dato de contacto o de presencia en línea. */
export type IconoDeDato = 'direccion' | 'telefono' | 'correo' | TipoDeEnlace;

/**
 * UN DATO CON SU ICONO, para la ficha de contacto y de presencia en línea de la organización (P4, prototipo B4).
 *
 * El rótulo va ARRIBA, en pequeño y gris, y el valor debajo, en el peso de lectura: lo contrario de
 * `app-dato-en-lectura` (que pone el valor primero), porque aquí el icono ya dice de qué dato se trata y el rótulo lo
 * confirma. El anfitrión es el `div` que agrupa el `dt` y el `dd` de un `<dl>`, como en `app-dato-en-lectura`.
 *
 * <b>LOS ENLACES SON ENLACES SOLO SI SON SEGUROS.</b> Con `enlace`, el valor se vuelve un vínculo (se abre en otra pestaña)
 * únicamente si, completado con `https://`, es una dirección web válida (`esUrlValida`); si no, se lee como texto. El correo
 * y el teléfono se vuelven `mailto:` y `tel:` con `vinculo`. Lo que falta se dice «Sin registrar» en el gris de los rótulos.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'div[app-dato-con-icono]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideMapPin, LucidePhone, LucideMail, IconoDeEnlaceComponent],
  styles: [`
    :host { display: grid; grid-template-columns: 1.5rem minmax(0, 1fr); column-gap: .75rem; align-items: start; min-width: 0; }
    .dato-con-icono__icono { grid-row: 1 / span 2; padding-top: .25rem; color: var(--color-morado-claro); }
    .dato-con-icono__icono--vacio { color: var(--color-rotulo); }
    dt { grid-column: 2; color: var(--color-rotulo); font-size: var(--text-dato); }
    dd { grid-column: 2; margin: .125rem 0 0; min-width: 0; overflow-wrap: anywhere; font-size: var(--text-lectura); font-weight: 600; color: var(--color-valor); }
    dd.vacio { color: var(--color-rotulo); font-weight: 400; }
    dd a { color: var(--color-verde-texto); text-decoration: none; }
    dd a:hover { text-decoration: underline; }
    dd a:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); border-radius: .25rem; }
  `],
  template: `
    <span class="dato-con-icono__icono" [class.dato-con-icono__icono--vacio]="vacio()" aria-hidden="true">
      @switch (icono()) {
        @case ('direccion') { <svg lucideMapPin [size]="20"></svg> }
        @case ('telefono') { <svg lucidePhone [size]="20"></svg> }
        @case ('correo') { <svg lucideMail [size]="20"></svg> }
        @default { <app-icono-de-enlace [tipo]="$any(icono())" [tamano]="20" /> }
      }
    </span>
    <dt>{{ rotulo() }}</dt>
    <dd [class.vacio]="vacio()">
      @if (vacio()) { Sin registrar }
      @else if (direccionWeb(); as href) { <a [href]="href" target="_blank" rel="noopener noreferrer" [attr.data-enlace]="icono()">{{ valorLimpio() }}</a> }
      @else if (vinculo(); as href) { <a [href]="href">{{ valorLimpio() }}</a> }
      @else { {{ valorLimpio() }} }
    </dd>
  `,
})
export class DatoConIconoComponent {
  readonly rotulo = input.required<string>();
  readonly valor = input<string | null | undefined>('');
  readonly icono = input.required<IconoDeDato>();
  /** El valor es una dirección web (sitio, red social, otro enlace): se vuelve vínculo si es válida. */
  readonly enlace = input(false);
  /** `mailto` o `tel`: convierte el valor en el vínculo correspondiente. */
  readonly vinculoDe = input<'mailto' | 'tel' | null>(null);

  protected readonly valorLimpio = computed(() => (this.valor() ?? '').trim());
  protected readonly vacio = computed(() => this.valorLimpio().length === 0);
  protected readonly direccionWeb = computed(() => {
    if (!this.enlace() || this.vacio()) return null;
    const normal = normalizarUrl(this.valorLimpio());
    return esUrlValida(normal) ? normal : null;
  });
  protected readonly vinculo = computed(() => {
    const tipo = this.vinculoDe();
    if (!tipo || this.vacio()) return null;
    return tipo === 'mailto' ? `mailto:${this.valorLimpio()}` : `tel:${this.valorLimpio().replace(/[^\d+]/g, '')}`;
  });
}
