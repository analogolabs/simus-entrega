/**
 * La base de gráficos del tablero: ECharts con SOLO los módulos que se dibujan.
 *
 * <b>SE CARGA BAJO DEMANDA</b> (`import()` desde `grafico-del-tablero.component.ts`): este fichero y
 * la librería viven en un fragmento aparte que solo se descarga al abrir la vista Gráfico, así el
 * portal no paga el peso de la librería en la carga inicial. Cada gráfico nuevo (red, sankey, mapa de
 * calor…) añade aquí su módulo, no una librería más.
 *
 * El dibujo es SVG y no canvas: es el que se puede exportar como vector, escala sin pixelar en
 * pantallas de alta densidad y deja los textos como texto.
 */
import { BarChart, GraphChart, HeatmapChart, SankeyChart, TreemapChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import { init, use } from 'echarts/core';
import { LegacyGridContainLabel } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

use([BarChart, GraphChart, HeatmapChart, SankeyChart, TreemapChart, AriaComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, SVGRenderer, LegacyGridContainLabel]);

export { init };
