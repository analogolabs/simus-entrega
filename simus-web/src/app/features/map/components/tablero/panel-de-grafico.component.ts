import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { aCsv, fechaLegible, nombreDeArchivo } from '../../domain/exportar-consulta';
import { descargarTexto } from '../../domain/descargas-del-mapa';
import { FichaDeIndicador } from '../../domain/indicadores-del-tablero';
import { AccionDeRegistro, MenuDeAccionesComponent } from '../../../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';

/** Una fila de la tabla de datos que acompaña al gráfico. `clave` es lo que se filtra al elegirla. */
export interface FilaDeDatos {
  readonly clave: string;
  readonly celdas: readonly (string | number)[];
}

/**
 * El marco de un gráfico del tablero: la pregunta que responde, el gráfico, su regla de lectura, la
 * exportación y la TABLA EQUIVALENTE.
 *
 * <b>LA TABLA ES LA ALTERNATIVA ACCESIBLE, NO UN ADORNO.</b> Un gráfico dibujado no se recorre con
 * teclado ni lo lee un lector de pantalla fila por fila; esta tabla sí, y además cada fila elegible
 * es un botón que aplica el MISMO filtro cruzado que pulsar la marca. Va plegada porque quien ve el
 * gráfico no la necesita, y desplegable porque quien la necesita la necesita completa.
 *
 * Sin tarjeta con borde ni sombra: la separación entre paneles la ponen los filetes del tablero.
 */
@Component({
  selector: 'app-panel-de-grafico',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuDeAccionesComponent],
  styles: [':host { display: block; min-width: 0; }'],
  template: `
    <section [attr.aria-labelledby]="idDelTitulo()">
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-dato font-bold text-rotulo">{{ pregunta() }}</p>
          <h3 [id]="idDelTitulo()" class="font-alternate text-base font-bold leading-snug text-morado">{{ titulo() }}</h3>
        </div>
        @if (acciones().length > 0) {
          <app-menu-de-acciones etiqueta="Exportar" [conTexto]="true" [descripcion]="'el gráfico «' + titulo() + '»'"
            [acciones]="acciones()" (elegida)="exportar.emit($event)" />
        }
      </header>
      <p class="mt-1 text-dato text-slate-600">{{ lectura() }}</p>
      <div class="mt-3"><ng-content /></div>
      @if (ficha(); as f) {
        <details class="mt-3 text-dato" [attr.data-testid]="'ficha-' + f.id">
          <summary class="cursor-pointer font-bold text-morado focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-foco)]">Ficha del indicador</summary>
          <dl class="mt-2 space-y-1.5 text-slate-700">
            <div><dt class="inline font-bold">Definición: </dt><dd class="inline">{{ f.definicion }}</dd></div>
            <div><dt class="inline font-bold">Fórmula: </dt><dd class="inline">{{ f.formula }}</dd></div>
            <div><dt class="inline font-bold">Unidad: </dt><dd class="inline">{{ f.unidad }}</dd></div>
            <div><dt class="inline font-bold">Fuente: </dt><dd class="inline">{{ f.fuente }}</dd></div>
            <div><dt class="inline font-bold">Periodo: </dt><dd class="inline">{{ f.periodo }}</dd></div>
            <div><dt class="inline font-bold">Cobertura: </dt><dd class="inline">{{ f.cobertura }}</dd></div>
            <div><dt class="inline font-bold">Actualización: </dt><dd class="inline">{{ f.actualizacion }}</dd></div>
            <div><dt class="inline font-bold">Fecha de la lectura: </dt><dd class="inline">{{ fechaDeLectura }}</dd></div>
            <div><dt class="inline font-bold">Filtros aplicados: </dt><dd class="inline">{{ filtros().length > 0 ? filtros().join('; ') : 'ninguno' }}</dd></div>
            <div><dt class="inline font-bold">Limitaciones: </dt><dd class="inline">{{ f.limitaciones }}</dd></div>
          </dl>
        </details>
      }
      @if (encabezados().length > 0) {
        <div class="mt-3 flex flex-wrap items-center gap-2 text-dato">
          <button type="button" data-testid="ver-tabla" class="inline-flex min-h-[calc(var(--spacing-control,2.25rem)-0.5rem)] cursor-pointer items-center rounded-[var(--radius-control,0.5rem)] border border-slate-300 bg-white px-3 font-bold text-morado no-underline hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-foco)]"
            [attr.aria-expanded]="tablaAbierta()" [attr.aria-controls]="idDelTitulo() + '-tabla'" (click)="tablaAbierta.set(!tablaAbierta())">
            {{ tablaAbierta() ? 'Ocultar tabla' : 'Ver tabla' }}
          </button>
          @if (filas().length > 0) {
            <button type="button" data-testid="descargar-csv" class="inline-flex min-h-[calc(var(--spacing-control,2.25rem)-0.5rem)] cursor-pointer items-center rounded-[var(--radius-control,0.5rem)] border border-slate-300 bg-white px-3 font-bold text-morado no-underline hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-foco)]"
              (click)="descargarCsv()">Descargar CSV</button>
          }
        </div>
        @if (tablaAbierta()) {
          <div [id]="idDelTitulo() + '-tabla'" class="mt-2 max-h-72 overflow-auto rounded-md border border-slate-200 text-dato" data-testid="tabla-equivalente">
            <table class="w-full border-collapse text-left">
              <caption class="sr-only">{{ titulo() }}: tabla equivalente del gráfico</caption>
              <thead class="sticky top-0 bg-slate-50">
                <tr>@for (encabezado of encabezados(); track encabezado) { <th scope="col" class="px-2.5 py-1.5 font-bold text-slate-600">{{ encabezado }}</th> }</tr>
              </thead>
              <tbody>
                @for (fila of filas(); track fila.clave) {
                  <tr class="border-t border-slate-100">
                    @for (celda of fila.celdas; track $index) {
                      @if ($first && elegible()) {
                        <th scope="row" class="px-2.5 py-1 font-semibold text-slate-700">
                          <button type="button" class="cursor-pointer text-left no-underline hover:text-morado focus-visible:outline-2 focus-visible:outline-[var(--color-foco)]"
                            [attr.aria-pressed]="fila.clave === seleccion()" (click)="elegir.emit(fila.clave)">{{ celda }}</button>
                        </th>
                      } @else {
                        <td class="px-2.5 py-1 tabular-nums text-slate-700">{{ celda }}</td>
                      }
                    }
                  </tr>
                } @empty {
                  <tr><td class="px-2.5 py-3 text-slate-600" [attr.colspan]="encabezados().length">Sin filas con estos filtros.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
})
export class PanelDeGraficoComponent {
  readonly idDelTitulo = input.required<string>();
  /** La pregunta que responde: «¿Cuántos hay y dónde?». */
  readonly pregunta = input.required<string>();
  readonly titulo = input.required<string>();
  /** La regla de lectura, una frase: «Longitud = cantidad; pulsa una barra para filtrar». */
  readonly lectura = input.required<string>();
  readonly acciones = input<AccionDeRegistro[]>([]);
  readonly encabezados = input<readonly string[]>([]);
  readonly filas = input<readonly FilaDeDatos[]>([]);
  readonly ficha = input<FichaDeIndicador | null>(null);
  /** Los filtros puestos, legibles, para que la ficha diga con qué se calculó lo que se ve. */
  readonly filtros = input<readonly string[]>([]);
  readonly elegible = input(false);
  readonly seleccion = input('');
  readonly tablaAbierta = signal(false);
  protected readonly fechaDeLectura = fechaLegible(new Date());
  readonly exportar = output<string>();
  readonly elegir = output<string>();

  /** El CSV de la misma tabla que se ve, con la cabecera de fuente, filtros y fecha de las demás exportaciones. */
  protected descargarCsv(): void {
    const fecha = new Date();
    const csv = aCsv({ titulo: this.titulo(), filtros: this.filtros(), fecha }, this.encabezados(), this.filas().map((fila) => fila.celdas));
    descargarTexto(csv, 'text/csv', nombreDeArchivo(this.titulo(), fecha, 'csv'));
  }
}
