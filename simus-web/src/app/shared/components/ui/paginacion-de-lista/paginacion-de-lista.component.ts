import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { BotonNativoDirective } from '../boton/boton.component';
import { FiltroDesplegableComponent } from '../filtro-desplegable/filtro-desplegable.component';

/**
 * La paginación de una lista del portal, con el selector de cuántas personas (o filas) ver por página.
 *
 * <b>NO CALCULA NADA: PINTA Y AVISA.</b> Quien la usa trae la página y el total de páginas del servidor y atiende los dos
 * avisos. Al cambiar la cantidad por página, quien la usa vuelve a la página 1: quedarse en la 4 de una lista que ahora
 * tiene dos páginas enseña un vacío falso.
 *
 * <b>ACCESIBLE.</b> Es un `nav` con nombre; la página actual se anuncia con `aria-live="polite"`; «Anterior» y
 * «Siguiente» se deshabilitan en los extremos.
 */
@Component({
  selector: 'app-paginacion-de-lista',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BotonNativoDirective, FiltroDesplegableComponent],
  template: `
    <nav class="flex flex-col items-center gap-4 border-t border-filete pt-8 sm:flex-row sm:justify-between" [attr.aria-label]="'Paginación de ' + nombre()">
      <div class="flex items-center gap-3">
        <span class="text-sm font-bold text-tinta-media" [id]="identificador() + '-por-pagina-rotulo'">{{ rotuloPorPagina() }}</span>
        <app-filtro-desplegable tamano="comodo" [etiqueta]="rotuloPorPagina()" [identificador]="identificador() + '-por-pagina'"
          [opciones]="opcionesDeCantidad()" [elegida]="'' + porPagina()" (cambiar)="cambiarCantidad($event)" />
      </div>
      @if (totalPaginas() > 1) {
        <div class="flex items-center gap-3">
          <button type="button" appBoton="secundaria" tamano="comodo" data-pagina-anterior
            [disabled]="pagina() <= 1" (click)="paginaCambiada.emit(pagina() - 1)">Anterior</button>
          <span class="text-sm font-bold text-tinta-media" aria-live="polite">Página {{ pagina() }} de {{ totalPaginas() }}</span>
          <button type="button" appBoton="secundaria" tamano="comodo" data-pagina-siguiente
            [disabled]="pagina() >= totalPaginas()" (click)="paginaCambiada.emit(pagina() + 1)">Siguiente</button>
        </div>
      }
    </nav>
  `,
})
export class PaginacionDeListaComponent {
  /** Qué se pagina, para el nombre del `nav`: «personas». */
  readonly nombre = input('la lista');
  readonly identificador = input('paginacion');
  readonly pagina = input.required<number>();
  readonly totalPaginas = input.required<number>();
  readonly porPagina = input.required<number>();
  readonly cantidades = input<readonly number[]>([12, 24, 48]);
  readonly rotuloPorPagina = input('Por página');

  readonly paginaCambiada = output<number>();
  readonly porPaginaCambiado = output<number>();

  protected readonly opcionesDeCantidad = computed(() => this.cantidades().map(n => ({ id: String(n), etiqueta: String(n) })));

  protected cambiarCantidad(valor: string): void {
    const n = Number(valor);
    if (Number.isFinite(n) && n > 0 && n !== this.porPagina()) this.porPaginaCambiado.emit(n);
  }
}
