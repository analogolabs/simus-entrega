import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import type { MarcaElegida } from './grafico-del-tablero.component';

/** Un gráfico que no dibuja: para las pruebas de componentes que no miran el lienzo (un grafo de fuerza en una caja sin tamaño falla en ECharts). */
@Component({
  selector: 'app-grafico-del-tablero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div role="img" [attr.aria-label]="descripcion()"></div>',
})
export class GraficoDePruebaComponent {
  readonly opcion = input.required<EChartsCoreOption>();
  readonly descripcion = input.required<string>();
  readonly explorable = input(false);
  readonly elegida = output<MarcaElegida>();
}
