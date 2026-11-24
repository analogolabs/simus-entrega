import type { EChartsCoreOption } from 'echarts/core';

/**
 * Las opciones de dibujo del tablero, como datos.
 *
 * <b>FUNCIONES PURAS, SIN ECHARTS EN TIEMPO DE EJECUCION.</b> Aquí solo se arma el objeto de
 * opciones (el tipo se importa y no pesa); quien lo dibuja es `app-grafico-del-tablero`, que carga la
 * librería bajo demanda. Así cada decisión de diseño —qué se rotula, qué se atenúa, cómo se
 * ordena— se prueba con un array literal y sin canvas.
 *
 * <b>REGLAS DE LECTURA QUE FIJAN ESTAS OPCIONES</b> (diagnóstico L4, §4):
 *  · Un solo color por serie; el nombre va en la etiqueta, nunca solo en el color.
 *  · Lo elegido se resalta y lo demás se atenúa, no se oculta: es el filtro cruzado.
 *  · El valor va rotulado en la marca; la rejilla es recesiva; no hay eje doble.
 *  · Los textos usan tinta de texto, no el color de la serie.
 */

export const TINTA = '#291242';
export const TINTA_SUAVE = '#5b5668';
export const REJILLA = '#e6e3ec';
export const GRIS_SIN_DATO = '#94a3b8';
const ATENUADO = 0.3;

/**
 * La tinta que se lee sobre un color de fondo: blanca sobre los oscuros, de texto sobre los claros.
 * Umbral por luminancia relativa (WCAG): por encima de 0,3 el blanco no llega a 4,5:1.
 */
export function tintaSobre(fondo: string): string {
  const canal = (hex: string) => {
    const v = parseInt(hex, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const limpio = fondo.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(limpio)) return '#ffffff';
  const luminancia = 0.2126 * canal(limpio.slice(0, 2)) + 0.7152 * canal(limpio.slice(2, 4)) + 0.0722 * canal(limpio.slice(4, 6));
  return luminancia > 0.3 ? TINTA : '#ffffff';
}

const escapar = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cifra = (valor: number): string => new Intl.NumberFormat('es-CO').format(valor);

export interface FilaDeBarras {
  readonly clave: string;
  readonly etiqueta: string;
  readonly valor: number;
}

const base = (animar: boolean): EChartsCoreOption => ({
  animation: animar,
  animationDuration: 200,
  textStyle: { fontFamily: 'inherit', color: TINTA_SUAVE, fontSize: 12 },
  aria: { enabled: true, decal: { show: false } },
});

/**
 * Barras horizontales ordenadas, una serie.
 *
 * `seleccion` es la clave elegida (o vacío): esa barra queda llena y las demás, atenuadas.
 * `total` es el denominador del porcentaje del tooltip y de la etiqueta.
 */
export function opcionBarras(
  filas: readonly FilaDeBarras[],
  opciones: { color: string; seleccion?: string; total: number; animar?: boolean; unidad?: string },
): EChartsCoreOption {
  const unidad = opciones.unidad ?? 'registros';
  const hayEleccion = !!opciones.seleccion;
  const porcentaje = (valor: number) => (opciones.total > 0 ? Math.round((valor / opciones.total) * 100) : 0);
  return {
    ...base(opciones.animar ?? true),
    grid: { left: 8, right: 64, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (parametros: { dataIndex: number }) => {
        const fila = filas[parametros.dataIndex];
        return fila
          ? `<b>${escapar(fila.etiqueta)}</b><br/>${cifra(fila.valor)} ${unidad} · ${porcentaje(fila.valor)} % del total`
          : '';
      },
    },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: REJILLA } }, axisLabel: { color: TINTA_SUAVE, fontSize: 12 } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: filas.map((fila) => fila.etiqueta),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: TINTA, fontSize: 12, width: 120, overflow: 'truncate', ellipsis: '…' },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 14,
      data: filas.map((fila) => ({
        value: fila.valor,
        itemStyle: {
          color: opciones.color,
          borderRadius: [0, 4, 4, 0],
          opacity: !hayEleccion || fila.clave === opciones.seleccion ? 1 : ATENUADO,
        },
      })),
      label: {
        show: true,
        position: 'right',
        color: TINTA,
        fontSize: 12,
        formatter: (parametros: { dataIndex: number }) => {
          const fila = filas[parametros.dataIndex];
          return fila ? `${cifra(fila.valor)} · ${porcentaje(fila.valor)} %` : '';
        },
      },
    }],
  };
}

export interface GrupoDeComposicion {
  readonly nombre: string;
  readonly total: number;
  readonly color: string;
}

/**
 * Mosaico (treemap) de una composición: el área es la cantidad.
 *
 * Responde «de qué está hecho», con las partes que más pesan a la vista. El nombre va dentro de cada
 * mosaico; el que declara el color es la capa, y «Sin clasificar» va en gris porque es el dato que
 * falta y no un grupo más.
 */
export function opcionMosaico(
  grupos: readonly GrupoDeComposicion[],
  opciones: { seleccion?: string; fichas: number; animar?: boolean; sinClasificar: string },
): EChartsCoreOption {
  const hayEleccion = !!opciones.seleccion;
  return {
    ...base(opciones.animar ?? true),
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (parametros: { name: string; value: number }) => {
        const cuota = opciones.fichas > 0 ? Math.round((parametros.value / opciones.fichas) * 100) : 0;
        return `<b>${escapar(parametros.name)}</b><br/>${cifra(parametros.value)} declaraciones · ${cuota} % de los registros`;
      },
    },
    series: [{
      type: 'treemap',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      width: '100%',
      height: '100%',
      top: 0, left: 0, right: 0, bottom: 0,
      itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2, borderRadius: 4 },
      label: { show: true, position: 'insideTopLeft', fontSize: 12, overflow: 'truncate', ellipsis: '…', formatter: '{b}\n{c}' },
      upperLabel: { show: false },
      data: grupos.map((grupo) => ({
        name: grupo.nombre,
        value: grupo.total,
        label: { color: tintaSobre(grupo.nombre === opciones.sinClasificar ? GRIS_SIN_DATO : grupo.color) },
        itemStyle: {
          color: grupo.nombre === opciones.sinClasificar ? GRIS_SIN_DATO : grupo.color,
          opacity: !hayEleccion || grupo.nombre === opciones.seleccion ? 1 : ATENUADO,
        },
      })),
    }],
  };
}

export interface SerieDeColumnas {
  readonly nombre: string;
  readonly color: string;
  readonly datos: readonly number[];
}

/**
 * Columnas sobre un eje de categorías (años o meses), apiladas si hay más de una serie.
 *
 * Con una sola serie no hay leyenda (el título la nombra); con varias, leyenda siempre visible y
 * 2 px de aire entre segmentos. `marcada` es la categoría que se rotula distinta (el mes en curso).
 */
export function opcionColumnas(
  categorias: readonly string[],
  series: readonly SerieDeColumnas[],
  opciones: { marcada?: number; animar?: boolean; unidad: string },
): EChartsCoreOption {
  const apilada = series.length > 1;
  return {
    ...base(opciones.animar ?? true),
    grid: { left: 8, right: 8, top: apilada ? 32 : 16, bottom: 4, containLabel: true },
    legend: apilada
      ? { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: TINTA, fontSize: 12 } }
      : { show: false },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
      formatter: (parametros: { axisValueLabel: string; seriesName: string; value: number; marker: string }[]) => {
        const lineas = parametros
          .filter((p) => p.value > 0)
          .map((p) => `${p.marker} ${escapar(p.seriesName)}: <b>${cifra(p.value)}</b>`);
        return `<b>${escapar(parametros[0]?.axisValueLabel ?? '')}</b><br/>${lineas.join('<br/>') || `Sin ${opciones.unidad}`}`;
      },
    },
    xAxis: {
      type: 'category',
      data: [...categorias],
      axisTick: { show: false },
      axisLine: { lineStyle: { color: REJILLA } },
      axisLabel: {
        color: TINTA_SUAVE,
        fontSize: 12,
        interval: 0,
        ...(opciones.marcada === undefined ? {} : {
          formatter: (valor: string, indice: number) => (indice === opciones.marcada ? `{marca|${valor}}` : `{normal|${valor}}`),
          rich: {
            marca: { color: TINTA, fontWeight: 'bold', fontSize: 12 },
            normal: { color: TINTA_SUAVE, fontSize: 12 },
          },
        }),
      },
    },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: REJILLA } }, axisLabel: { color: TINTA_SUAVE, fontSize: 12 } },
    series: series.map((serie) => ({
      name: serie.nombre,
      type: 'bar',
      stack: apilada ? 'total' : undefined,
      barMaxWidth: 28,
      itemStyle: { color: serie.color, borderColor: '#fff', borderWidth: apilada ? 1 : 0, borderRadius: apilada ? 0 : [4, 4, 0, 0] },
      label: apilada ? { show: false } : { show: true, position: 'top', color: TINTA, fontSize: 12, formatter: (p: { value: number }) => (p.value > 0 ? cifra(p.value) : '') },
      data: [...serie.datos],
    })),
  };
}

export interface PuntoAnual {
  readonly proceso: string;
  readonly anio: number;
  readonly departamento: string;
  readonly total: number;
}

export interface EvolucionPorAnio {
  readonly anios: readonly number[];
  readonly series: readonly { readonly proceso: string; readonly datos: readonly number[]; readonly total: number }[];
  readonly total: number;
}

/**
 * Las ediciones por año, en un eje de tiempo CONTINUO.
 *
 * <b>LOS AÑOS SIN EDICIONES SE MUESTRAN EN CERO.</b> Saltarlos junta 2019 con 2023 como si fueran
 * años seguidos, y el hueco —lo que hay que ver— desaparece. `normalizar` iguala los nombres de
 * departamento (cada fuente los escribe a su manera) antes de filtrar por el ámbito elegido.
 */
export function evolucionPorAnio(
  puntos: readonly PuntoAnual[],
  ambito: string,
  normalizar: (nombre: string) => string,
): EvolucionPorAnio {
  const visibles = puntos.filter((punto) => !ambito || normalizar(punto.departamento) === ambito);
  if (visibles.length === 0) return { anios: [], series: [], total: 0 };
  const primero = Math.min(...visibles.map((punto) => punto.anio));
  const ultimo = Math.max(...visibles.map((punto) => punto.anio));
  const anios = Array.from({ length: ultimo - primero + 1 }, (_, indice) => primero + indice);
  const procesos = [...new Set(visibles.map((punto) => punto.proceso))].sort();
  const series = procesos.map((proceso) => {
    const datos = anios.map((anio) => visibles
      .filter((punto) => punto.proceso === proceso && punto.anio === anio)
      .reduce((suma, punto) => suma + punto.total, 0));
    return { proceso, datos, total: datos.reduce((suma, valor) => suma + valor, 0) };
  });
  return { anios, series, total: series.reduce((suma, serie) => suma + serie.total, 0) };
}

/**
 * Pone en VERTICAL las etiquetas del eje de categorías (años, meses) cuando horizontales no caben.
 *
 * Mide a ojo —unos 7 px por carácter y 10 px de aire entre etiquetas— contra el ancho útil del lienzo
 * (menos 56 px de eje y márgenes). Si no cabe, las gira 90° en vez de dejar que se monten o se oculten;
 * si cabe, las deja como están. Solo toca opciones con un eje X de categorías; las demás vuelven iguales.
 */
export function conEtiquetasQueCaben(opcion: EChartsCoreOption, anchoDelLienzo: number): EChartsCoreOption {
  const eje = (opcion as { xAxis?: { type?: string; data?: unknown[]; axisLabel?: Record<string, unknown> } }).xAxis;
  if (!eje || eje.type !== 'category' || !Array.isArray(eje.data) || anchoDelLienzo <= 0) return opcion;
  const necesario = eje.data.reduce<number>((suma, etiqueta) => suma + String(etiqueta).length * 7 + 10, 0);
  const vertical = necesario > anchoDelLienzo - 56;
  if (!vertical) return opcion;
  return { ...opcion, xAxis: { ...eje, axisLabel: { ...eje.axisLabel, rotate: 90, interval: 0 } } };
}
