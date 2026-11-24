import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BarraDeListaComponent } from '../barra-de-lista/barra-de-lista.component';
import { PestanasDeTipoComponent } from '../pestanas-de-tipo/pestanas-de-tipo.component';

/**
 * LAS HERRAMIENTAS DE UNA LISTA del espacio externo (LIS2, docs/desarrollo/30-consola-y-acceso.md §30.18): las pestañas por tipo de proceso (si la
 * lista las tiene) y, debajo, la barra con el buscador y los filtros. Una sola pieza para las seis familias de
 * pantallas —Procesos, Solicitudes, Eventos, Festivales, Mercados y las vistas equivalentes de Mi espacio—, que antes
 * armaban cada una su par de `app-pestanas-de-tipo` y `app-barra-de-lista` con su propio espaciado.
 *
 * <b>ESPACIO ENTRE LAS DOS ZONAS.</b> Las pestañas llevan un filete inferior y la barra de búsqueda empezaba pegada a
 * él: la lista se sentía «cortada». Aquí van separadas por 1,25 rem y las pestañas conservan su filete; la barra y la
 * lista que sigue quedan a 1 rem. La medida vive en esta pieza, no en cada pantalla.
 *
 * <b>QUÉ SE PROYECTA.</b> Lo mismo que entiende `app-barra-de-lista`: `app-buscador-de-lista`, `app-filtro-desplegable`,
 * `app-conmutador-de-ojo` y lo marcado con `extremo`; se colocan por tipo, no por orden de escritura. Sin `tipos`
 * ni `conteos` no se pintan pestañas (Festivales y Mercados no las tienen: son un solo tipo).
 */
@Component({
  selector: 'app-herramientas-de-lista',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarraDeListaComponent, PestanasDeTipoComponent],
  styles: [`
    :host { display: block; }
    .herramientas { display: flex; flex-direction: column; gap: 1.25rem; padding-bottom: .25rem; }
  `],
  template: `
    <div class="herramientas" data-herramientas-de-lista>
      @if (conPestanas()) {
        <app-pestanas-de-tipo [etiquetaDelGrupo]="etiquetaDelGrupo()" [controla]="controla()" [tipos]="tipos()"
          [conteos]="conteos() ?? {}" [total]="total()" [conOtras]="conOtras()" [elegida]="elegida()" (elegir)="elegir.emit($event)" />
      }
      <app-barra-de-lista>
        <ng-content select="app-buscador-de-lista" ngProjectAs="app-buscador-de-lista" />
        <ng-content select="app-filtro-desplegable" ngProjectAs="app-filtro-desplegable" />
        <ng-content select="app-conmutador-de-ojo" ngProjectAs="app-conmutador-de-ojo" />
        <ng-content />
        <ng-content select="[extremo]" ngProjectAs="[extremo]" />
      </app-barra-de-lista>
    </div>
  `,
})
export class HerramientasDeListaComponent {
  /** Los conteos por tipo. Sin ellos no hay pestañas. */
  readonly conteos = input<Readonly<Record<string, number>> | null>(null);
  readonly elegida = input<string>('todos');
  readonly etiquetaDelGrupo = input('Tipo de proceso');
  /** El `id` de la lista que gobiernan las pestañas. */
  readonly controla = input<string | null>(null);
  readonly tipos = input<readonly string[] | null>(null);
  readonly total = input<number | null>(null);
  readonly conOtras = input(false);
  readonly elegir = output<string>();

  protected readonly conPestanas = computed(() => this.conteos() !== null);
}
