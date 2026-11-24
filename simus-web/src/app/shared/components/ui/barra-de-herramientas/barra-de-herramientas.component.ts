import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BarraDeListaComponent } from '../barra-de-lista/barra-de-lista.component';
import { BarraDeTipoComponent } from '../barra-de-tipo/barra-de-tipo.component';
import { OpcionDePestana } from '../pestanas/pestanas.component';

/**
 * LA BARRA DE HERRAMIENTAS de una lista de gestión (P3, prototipo B4). De arriba abajo:
 *
 * 1. la barra de tipo (`app-barra-de-tipo`), solo si la lista se lee por tipo (`tipos`);
 * 2. una fila con el buscador, los filtros y «Ordenar por» (`app-orden-de-lista`), que se colocan por
 *    tipo igual que en `app-barra-de-lista` —el buscador primero, los desplegables después, lo marcado con
 *    `extremo` a la derecha—, en cualquier orden de escritura;
 * 3. la cuenta: «4 de 5» y, cuando algo filtra, el enlace «Quitar filtros».
 *
 * <b>LA CUENTA NO ES ADORNO.</b> Es un `role="status"`: quien usa lector de pantalla oye cuántas filas
 * quedaron al filtrar. «Quitar filtros» solo existe cuando hay algo que quitar (`hayFiltros`, o
 * `mostradas !== total` si no se indica) y emite `quitarFiltros`: la pantalla decide qué reinicia (búsqueda,
 * estado, tipo) y a qué valores. El orden NO es un filtro: no se reinicia.
 *
 * <b>QUÉ SE PROYECTA.</b> `app-buscador-de-lista`, `app-filtro-desplegable`, `app-conmutador-de-ojo`,
 * `app-orden-de-lista` y `[extremo]`. Con un `app-filtro-desplegable` condicional, usa `ngProjectAs`
 * (ver `app-barra-de-lista`).
 *
 * @example
 * <app-barra-de-herramientas etiqueta="Filtrar y ordenar los procesos" [tipos]="opcionesDeTipo()" [tipo]="tipo()"
 *   (elegirTipo)="tipo.set($event)" [mostradas]="filas().length" [total]="todas().length" (quitarFiltros)="limpiar()">
 *   <app-buscador-de-lista … />
 *   <app-filtro-desplegable rotulo="Estado" … />
 *   <app-orden-de-lista [columnas]="columnas" [orden]="orden()" (cambiar)="orden.set($event)" />
 * </app-barra-de-herramientas>
 */
@Component({
  selector: 'app-barra-de-herramientas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarraDeListaComponent, BarraDeTipoComponent],
  // SIN ENCAPSULACIÓN: en móvil la barra estira lo que se le proyecta (buscador, filtros, orden) a todo el ancho, y esos
  // elementos pertenecen a la pantalla que los escribe, no a esta pieza. Todo va bajo `.bh`.
  encapsulation: ViewEncapsulation.None,
  styles: [`
    :host { display: block; }
    .bh { display: flex; flex-direction: column; gap: 1.25rem; padding-bottom: .25rem; }
    .bh__cuenta { margin: -.5rem 0 0; color: var(--color-rotulo); font-size: var(--text-cuerpo); }
    .bh__quitar { padding: 0; border: 0; background: none; color: var(--color-verde-texto); font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; }
    .bh__quitar:hover { text-decoration: underline; }
    .bh__quitar:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); border-radius: .25rem; }
    /* MÓVIL: cada control de la barra ocupa su propia línea, a todo el ancho; la dirección del orden queda al lado de «Ordenar por». */
    @media (max-width: 639.98px) {
      .bh .barra-de-lista > app-buscador-de-lista, .bh .barra-de-lista > app-filtro-desplegable, .bh .barra-de-lista > app-orden-de-lista { flex: 1 1 100%; width: 100%; max-width: none; }
      .bh .barra-de-lista > app-filtro-desplegable { display: block; }
      .bh .barra-de-lista .filtro__control { display: flex; width: 100%; max-width: none; justify-content: space-between; height: var(--spacing-control-comodo); }
      .bh .barra-de-lista .buscador__campo { height: var(--spacing-control-comodo); }
      .bh .barra-de-lista .filtro__valor { flex: 1 1 auto; text-align: left; }
      .bh .barra-de-lista > app-orden-de-lista > app-filtro-desplegable { display: block; flex: 1 1 auto; min-width: 0; }
      .bh .barra-de-lista__extremo { margin-left: 0; width: 100%; }
    }
  `],
  template: `
    <div class="bh" data-barra-de-herramientas>
      @if (tipos(); as opciones) {
        <app-barra-de-tipo [opciones]="opciones" [elegida]="tipo()" [etiquetaDelGrupo]="etiquetaDelTipo()" [controla]="controla()" (elegir)="elegirTipo.emit($event)" />
      }
      <div role="search" [attr.aria-label]="etiqueta()">
        <app-barra-de-lista>
          <ng-content select="app-buscador-de-lista" ngProjectAs="app-buscador-de-lista" />
          <ng-content select="app-filtro-desplegable" ngProjectAs="app-filtro-desplegable" />
          <ng-content select="app-conmutador-de-ojo" ngProjectAs="app-conmutador-de-ojo" />
          <ng-content select="app-orden-de-lista" />
          <ng-content select="[extremo]" ngProjectAs="[extremo]" />
        </app-barra-de-lista>
      </div>
      @if (total() > 0) {
        <p class="bh__cuenta" role="status" data-cuenta-de-lista>
          {{ mostradas() }} de {{ total() }}@if (conFiltros()) { · <button type="button" class="bh__quitar" data-quitar-filtros (click)="quitarFiltros.emit()">Quitar filtros</button> }
        </p>
      }
    </div>
  `,
})
export class BarraDeHerramientasComponent {
  /** Para quien usa lector de pantalla: «Filtrar y ordenar los procesos». */
  readonly etiqueta = input('Filtrar y ordenar');
  /** Las opciones de tipo; sin ellas no hay barra de tipo. */
  readonly tipos = input<readonly OpcionDePestana[] | null>(null);
  readonly tipo = input('todos');
  readonly etiquetaDelTipo = input('Tipo de proceso');
  /** El `id` de la lista que gobierna la barra de tipo. */
  readonly controla = input<string | null>(null);
  /** Cuántas filas quedan tras filtrar. */
  readonly mostradas = input.required<number>();
  /** Cuántas habría sin filtrar. Con cero no se pinta la cuenta. */
  readonly total = input.required<number>();
  /** Si algo está filtrando. Sin indicarlo, se deduce de `mostradas !== total`. */
  readonly hayFiltros = input<boolean | null>(null);

  readonly elegirTipo = output<string>();
  readonly quitarFiltros = output<void>();

  protected readonly conFiltros = computed(() => this.hayFiltros() ?? this.mostradas() !== this.total());
}
