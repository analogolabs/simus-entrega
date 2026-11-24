import type { EChartsCoreOption } from 'echarts/core';
import {
  BarrasApiladas, DiagramaAluvial, MatrizDeCoincidencias, NodoDeJerarquia, nombreDeNodo,
} from './analisis-avanzado';
import { GRIS_SIN_DATO, REJILLA, TINTA, TINTA_SUAVE, tintaSobre } from './opciones-del-tablero';

/**
 * Las opciones de dibujo del ANÁLISIS AVANZADO, como datos (sin ECharts en tiempo de ejecución).
 * Mismas reglas de lectura que el Panorama: la marca se rotula, lo elegido se resalta y lo demás se
 * atenúa, los textos usan tinta de texto y el color de un tipo de proceso es siempre el mismo.
 */

const ATENUADO = 0.3;
const SIN_DECLARAR = 'Sin declarar';
const cifra = (valor: number): string => new Intl.NumberFormat('es-CO').format(valor);
const escapar = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const base = (animar: boolean): EChartsCoreOption => ({
  animation: animar,
  animationDuration: 200,
  textStyle: { fontFamily: 'inherit', color: TINTA_SUAVE, fontSize: 12 },
  aria: { enabled: true, decal: { show: false } },
});

/** Mezcla un color con blanco: `fuerza` 0 = blanco, 1 = el color. Para la escala de la matriz. */
export function aclarar(hex: string, fuerza: number): string {
  const limpio = hex.replace('#', '');
  const canal = (i: number) => {
    const v = parseInt(limpio.slice(i, i + 2), 16);
    return Math.round(255 - (255 - v) * Math.min(1, Math.max(0, fuerza)));
  };
  return `#${[0, 2, 4].map((i) => canal(i).toString(16).padStart(2, '0')).join('')}`;
}

export function opcionBarrasApiladas(
  datos: BarrasApiladas,
  opciones: { colorDelTipo: (tipo: string) => string; seleccion?: string; tipoElegido?: string; animar?: boolean },
): EChartsCoreOption {
  const hayEleccion = !!opciones.seleccion;
  return {
    ...base(opciones.animar ?? true),
    grid: { left: 8, right: 56, top: 28, bottom: 4, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: TINTA, fontSize: 12 } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true,
      formatter: (parametros: { dataIndex: number; seriesName: string; value: number; marker: string }[]) => {
        const i = parametros[0]?.dataIndex ?? 0;
        const filas = parametros.filter((p) => p.value > 0)
          .map((p) => `${p.marker} ${escapar(p.seriesName)}: ${cifra(p.value)}`).join('<br/>');
        return `<b>${escapar(datos.departamentos[i] ?? '')}</b> · ${cifra(datos.totales[i] ?? 0)}<br/>${filas}`;
      },
    },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: REJILLA } }, axisLabel: { color: TINTA_SUAVE, fontSize: 12 } },
    yAxis: {
      type: 'category', inverse: true, data: [...datos.departamentos],
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: TINTA, fontSize: 12, width: 110, overflow: 'truncate', ellipsis: '…' },
    },
    series: datos.tipos.map((tipo, indiceDeTipo) => ({
      type: 'bar', name: tipo, stack: 'total', barMaxWidth: 16,
      emphasis: { focus: 'series' },
      itemStyle: { color: opciones.colorDelTipo(tipo), borderColor: '#fff', borderWidth: 1 },
      data: datos.valores[tipo].map((valor, i) => ({
        value: valor,
        itemStyle: {
          opacity: (!hayEleccion || datos.departamentos[i] === opciones.seleccion)
            && (!opciones.tipoElegido || tipo === opciones.tipoElegido) ? 1 : ATENUADO,
        },
      })),
      label: indiceDeTipo === datos.tipos.length - 1
        ? { show: true, position: 'right', color: TINTA, fontSize: 12, formatter: (p: { dataIndex: number }) => cifra(datos.totales[p.dataIndex] ?? 0) }
        : { show: false },
    })),
  };
}

export function opcionJerarquia(
  arbol: readonly NodoDeJerarquia[],
  opciones: { colorDelTipo: (tipo: string) => string; animar?: boolean },
): EChartsCoreOption {
  const conColor = (nodo: NodoDeJerarquia, color: string, nivel: number): Record<string, unknown> => {
    const sin = nodo.name === SIN_DECLARAR;
    const fondo = sin ? GRIS_SIN_DATO : aclarar(color, nivel === 0 ? 1 : nivel === 1 ? 0.75 : 0.5);
    return {
      name: nodo.name, value: nodo.value,
      itemStyle: { color: fondo },
      label: { color: tintaSobre(fondo) },
      children: nodo.children?.map((hijo) => conColor(hijo, color, nivel + 1)),
    };
  };
  return {
    ...base(opciones.animar ?? true),
    tooltip: {
      trigger: 'item', confine: true,
      formatter: (p: { name: string; value: number; treePathInfo?: { name: string }[] }) => {
        const ruta = (p.treePathInfo ?? []).map((n) => n.name).filter(Boolean).join(' › ');
        return `<b>${escapar(ruta || p.name)}</b><br/>${cifra(p.value)}`;
      },
    },
    series: [{
      type: 'treemap', roam: false, nodeClick: 'zoomToNode',
      breadcrumb: { show: true, height: 24, bottom: 0, itemStyle: { color: '#f3eef6', textStyle: { color: TINTA } }, emptyItemWidth: 25 },
      width: '100%', height: '100%', top: 0, left: 0, right: 0, bottom: 28,
      itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2, borderRadius: 4 },
      label: { show: true, position: 'insideTopLeft', fontSize: 12, overflow: 'truncate', ellipsis: '…', formatter: '{b}\n{c}' },
      upperLabel: { show: false },
      levels: [{ itemStyle: { borderWidth: 0, gapWidth: 3 } }, { itemStyle: { gapWidth: 2 } }, { itemStyle: { gapWidth: 1 } }],
      data: arbol.map((nodo) => conColor(nodo, opciones.colorDelTipo(nodo.name), 0)),
    }],
  };
}

export function opcionAluvial(
  datos: DiagramaAluvial,
  opciones: { colorDelTipo: (tipo: string) => string; seleccion?: string; animar?: boolean },
): EChartsCoreOption {
  const colorDe = (clave: string): string => {
    const nombre = nombreDeNodo(clave);
    if (clave.startsWith('t:')) return opciones.colorDelTipo(nombre);
    return nombre === SIN_DECLARAR ? GRIS_SIN_DATO : clave.startsWith('d:') ? '#8a6a99' : '#b98a2f';
  };
  const hayEleccion = !!opciones.seleccion;
  return {
    ...base(opciones.animar ?? true),
    tooltip: {
      trigger: 'item', confine: true,
      formatter: (p: { dataType: string; name: string; value: number; data: { source?: string; target?: string } }) =>
        p.dataType === 'edge'
          ? `${escapar(nombreDeNodo(p.data.source ?? ''))} → ${escapar(nombreDeNodo(p.data.target ?? ''))}<br/>${cifra(p.value)} registros`
          : `<b>${escapar(nombreDeNodo(p.name))}</b><br/>${cifra(p.value)} registros`,
    },
    series: [{
      type: 'sankey', left: 8, right: 110, top: 8, bottom: 8, nodeWidth: 14, nodeGap: 8, draggable: false,
      emphasis: { focus: 'adjacency' },
      lineStyle: { color: 'source', opacity: 0.35, curveness: 0.5 },
      label: {
        color: TINTA, fontSize: 12, overflow: 'truncate', width: 100,
        formatter: (p: { name: string }) => nombreDeNodo(p.name),
      },
      data: datos.nodos.map((nodo) => ({
        name: nodo.name, depth: nodo.profundidad,
        itemStyle: {
          color: colorDe(nodo.name),
          opacity: !hayEleccion || nombreDeNodo(nodo.name) === opciones.seleccion ? 1 : ATENUADO,
        },
      })),
      links: datos.enlaces.map((e) => ({ ...e })),
    }],
  };
}

export function opcionMatriz(
  datos: MatrizDeCoincidencias,
  opciones: { color: string; animar?: boolean },
): EChartsCoreOption {
  return {
    ...base(opciones.animar ?? true),
    grid: { left: 8, right: 8, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'item', confine: true,
      formatter: (p: { value: [number, number, number] }) =>
        `<b>${escapar(datos.filas[p.value[1]] ?? '')}</b> y <b>${escapar(datos.columnas[p.value[0]] ?? '')}</b><br/>${cifra(p.value[2])} registros los declaran a la vez`,
    },
    xAxis: {
      type: 'category', data: [...datos.columnas], position: 'top', splitArea: { show: false },
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: TINTA, fontSize: 11, interval: 0, rotate: 35, width: 90, overflow: 'truncate', ellipsis: '…' },
    },
    yAxis: {
      type: 'category', data: [...datos.filas], inverse: true,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: TINTA, fontSize: 11, interval: 0, width: 120, overflow: 'truncate', ellipsis: '…' },
    },
    // ECharts exige un `visualMap` para un mapa de calor sobre ejes (en desarrollo lanza «Heatmap must use with
    // visualMap»); aquí es el que pinta la escala y no se dibuja (`show: false`): la cifra va escrita en cada celda.
    visualMap: {
      show: false, type: 'continuous', dimension: 2, min: 0, max: Math.max(1, datos.maximo),
      inRange: { color: [aclarar(opciones.color, 0.15), opciones.color] },
    },
    series: [{
      type: 'heatmap',
      data: datos.celdas.map(([c, f, valor]) => {
        const fondo = aclarar(opciones.color, 0.15 + 0.85 * (valor / Math.max(1, datos.maximo)));
        return { value: [c, f, valor], itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 }, label: { show: true, color: tintaSobre(fondo), fontSize: 11 } };
      }),
      label: { show: true, formatter: (p: { value: [number, number, number] }) => cifra(p.value[2]) },
      emphasis: { itemStyle: { borderColor: TINTA, borderWidth: 2 } },
    }],
  };
}
