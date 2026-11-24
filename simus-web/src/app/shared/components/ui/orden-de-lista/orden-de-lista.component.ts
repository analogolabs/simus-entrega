import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideArrowDown, LucideArrowUp } from '@lucide/angular';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../filtro-desplegable/filtro-desplegable.component';
import { DireccionDeOrden, EstadoDeOrden, OpcionDeOrden, etiquetaDeDireccion } from './orden-de-lista';

/**
 * «ORDENAR POR» de una lista: la columna en un desplegable y, al lado, un botón con la dirección escrita
 * («↑ Más reciente primero»). Va dentro de `app-barra-de-herramientas` y la comparte con los encabezados
 * ordenables de `app-tabla-de-gestion`: los dos controles son la misma decisión, y en móvil, donde la tabla
 * se vuelve lista de filas y no tiene encabezados, este es el único.
 *
 * <b>Elegir otra columna reinicia la dirección a ascendente</b> (como pulsar su encabezado). El botón de
 * dirección es un botón normal con el nombre accesible «Dirección del orden: …. Cambiar»; en pantalla angosta
 * se queda solo con la flecha.
 *
 * @example
 * <app-orden-de-lista [columnas]="columnas" [orden]="orden()" (cambiar)="orden.set($event)" />
 */
@Component({
  selector: 'app-orden-de-lista',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FiltroDesplegableComponent, LucideArrowUp, LucideArrowDown],
  styles: [`
    :host { display: inline-flex; align-items: center; gap: .4rem; }
    .dir {
      display: inline-flex; align-items: center; gap: .4rem; height: var(--spacing-control); padding: 0 .75rem;
      border: 1px solid var(--color-borde-campo); border-radius: var(--radius-control); background: #fff;
      color: var(--color-valor); font: inherit; font-size: var(--text-cuerpo); font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    .dir:hover { border-color: var(--color-borde-campo-hover); }
    .dir:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); }
    @media (max-width: 639.98px) {
      :host { display: flex; width: 100%; }
      :host app-filtro-desplegable { flex: 1 1 auto; }
      .dir { width: var(--spacing-control-comodo); height: var(--spacing-control-comodo); justify-content: center; padding: 0; }
      .dir__palabra { display: none; }
    }
  `],
  template: `
    <app-filtro-desplegable rotulo="Ordenar por" [etiqueta]="'Ordenar ' + etiquetaDeLaLista() + ' por'"
      [identificador]="identificador()" [opciones]="opciones()" [elegida]="orden().columna" (cambiar)="elegirColumna($event)" />
    <button type="button" class="dir" data-orden-direccion [attr.aria-label]="'Dirección del orden: ' + palabra() + '. Cambiar'" (click)="invertir()">
      @if (orden().direccion === 'asc') { <svg lucideArrowUp [size]="16" aria-hidden="true"></svg> } @else { <svg lucideArrowDown [size]="16" aria-hidden="true"></svg> }
      <span class="dir__palabra">{{ palabra() }}</span>
    </button>
  `,
})
export class OrdenDeListaComponent {
  /** Las columnas por las que se puede ordenar, con la clase de valor de cada una. */
  readonly columnas = input.required<readonly OpcionDeOrden[]>();
  /** El orden vigente. */
  readonly orden = input.required<EstadoDeOrden>();
  /** Qué se ordena, para quien usa lector de pantalla («solicitudes»). */
  readonly etiquetaDeLaLista = input('la lista');
  /** Para que las pruebas y las capturas encuentren el desplegable. */
  readonly identificador = input('orden-de-lista');
  /** Se emite con la columna y dirección nuevas. */
  readonly cambiar = output<EstadoDeOrden>();

  protected readonly opciones = computed<readonly OpcionDeFiltro[]>(() => this.columnas().map(c => ({ id: c.id, etiqueta: c.etiqueta })));
  protected readonly palabra = computed(() => {
    const columna = this.columnas().find(c => c.id === this.orden().columna);
    return columna ? etiquetaDeDireccion(columna.tipo, this.orden().direccion) : (this.orden().direccion === 'asc' ? 'Ascendente' : 'Descendente');
  });

  protected elegirColumna(id: string): void {
    if (id !== this.orden().columna) this.cambiar.emit({ columna: id, direccion: 'asc' });
  }

  protected invertir(): void {
    const direccion: DireccionDeOrden = this.orden().direccion === 'asc' ? 'desc' : 'asc';
    this.cambiar.emit({ columna: this.orden().columna, direccion });
  }
}
