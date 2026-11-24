/**
 * Lo que sale del mapa hacia afuera: gráfico (PNG y SVG), datos (CSV) y tabla (CSV y XLSX).
 *
 * <b>TODA EXPORTACIÓN LLEVA LA MISMA CABECERA</b> (decisión 116 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`): el título de lo que se
 * exporta, los filtros aplicados, la fecha de generación y la fuente. Quien reutilice una cifra de
 * SIMUS tiene que poder citarla sin buscar de dónde salió, y quien reciba un archivo suelto tiene que
 * saber con qué filtros se generó. Este módulo es puro (no toca el DOM): el componente solo descarga.
 */

/** La fuente que se cita en todo lo que se exporta. */
export const FUENTE_DEL_SISTEMA =
  'Sistema de Información de la Música (SIMUS) — Plan Nacional de Música para la Convivencia';

export interface CabeceraDeExportacion {
  readonly titulo: string;
  /** Los filtros aplicados, ya legibles («Departamento: Meta»). Vacío = sin filtros. */
  readonly filtros: readonly string[];
  readonly fecha: Date;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «17 de noviembre de 2026», sin depender de la configuración regional del equipo. */
export function fechaLegible(fecha: Date): string {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

/** Las líneas de la cabecera, en el orden en que se leen. */
export function lineasDeCabecera(cabecera: CabeceraDeExportacion): string[] {
  return [
    cabecera.titulo,
    `Filtros aplicados: ${cabecera.filtros.length > 0 ? cabecera.filtros.join('; ') : 'ninguno'}`,
    `Fecha de generación: ${fechaLegible(cabecera.fecha)}`,
    `Fuente: ${FUENTE_DEL_SISTEMA}`,
  ];
}

/** Un nombre de archivo sin acentos ni signos: `mapa-festivales-2026-11-17`. */
export function nombreDeArchivo(base: string, fecha: Date, extension: string): string {
  const limpio = base.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  return `${limpio || 'simus'}-${dia}.${extension}`;
}

export type Celda = string | number;

/**
 * Una celda de CSV. Se entrecomilla siempre y, si empieza por `=`, `+`, `-` o `@`, se antepone un
 * apóstrofo: un nombre de proceso escrito por una persona no puede convertirse en fórmula al abrirlo
 * en una hoja de cálculo.
 */
export function celdaCsv(valor: Celda): string {
  let texto = String(valor ?? '');
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

/** El CSV completo: cabecera de fuente, una línea en blanco, los encabezados y las filas. */
export function aCsv(cabecera: CabeceraDeExportacion, columnas: readonly string[], filas: readonly (readonly Celda[])[]): string {
  const lineas = [
    ...lineasDeCabecera(cabecera).map((linea) => celdaCsv(linea)),
    '',
    columnas.map(celdaCsv).join(','),
    ...filas.map((fila) => fila.map(celdaCsv).join(',')),
  ];
  // El BOM hace que Excel lea los acentos como UTF-8.
  return '﻿' + lineas.join('\r\n') + '\r\n';
}

export interface FilaDeBarra {
  readonly etiqueta: string;
  readonly valor: number;
}

function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Parte un texto en líneas de a lo sumo `ancho` caracteres, sin cortar palabras. */
export function partirEnLineas(texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (actual && (actual + ' ' + palabra).length > ancho) { lineas.push(actual); actual = palabra; }
    else actual = actual ? `${actual} ${palabra}` : palabra;
  }
  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : [''];
}

export interface OpcionesDelSvg {
  readonly color?: string;
  /** Cuántas barras se dibujan como máximo; el resto queda en el CSV. */
  readonly maximoDeBarras?: number;
  readonly unidad?: string;
}

export const ANCHO_DEL_SVG = 960;

/**
 * El gráfico de barras como SVG autónomo, con su cabecera arriba y la fuente abajo.
 *
 * Es autónomo a propósito (sin hojas de estilo ni tipografías externas): el mismo texto sirve de
 * archivo SVG y, dibujado en un lienzo, de PNG.
 */
export function aSvg(cabecera: CabeceraDeExportacion, filas: readonly FilaDeBarra[], opciones: OpcionesDelSvg = {}): { svg: string; ancho: number; alto: number } {
  const color = opciones.color ?? '#5b2d8e';
  const visibles = filas.slice(0, opciones.maximoDeBarras ?? 40);
  const margen = 32;
  const anchoDeEtiqueta = 220;
  const anchoDeValor = 64;
  const anchoDeBarra = ANCHO_DEL_SVG - margen * 2 - anchoDeEtiqueta - anchoDeValor;
  const maximo = Math.max(1, ...visibles.map((fila) => fila.valor));

  const titulo = partirEnLineas(cabecera.titulo, 62);
  const filtros = partirEnLineas(lineasDeCabecera(cabecera)[1], 120);
  const pie = [
    ...partirEnLineas(`Fuente: ${FUENTE_DEL_SISTEMA}`, 120),
    `Fecha de generación: ${fechaLegible(cabecera.fecha)}`,
  ];
  if (filas.length > visibles.length) pie.unshift(`Se muestran ${visibles.length} de ${filas.length} filas; el resto está en el CSV.`);

  const altoDeCabecera = margen + titulo.length * 28 + 8 + filtros.length * 18 + 16;
  const altoDeFila = 24;
  const altoDelCuerpo = Math.max(1, visibles.length) * altoDeFila;
  const alto = altoDeCabecera + altoDelCuerpo + 16 + pie.length * 16 + margen;

  const partes: string[] = [];
  partes.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO_DEL_SVG}" height="${alto}" viewBox="0 0 ${ANCHO_DEL_SVG} ${alto}" role="img" aria-label="${escaparXml(cabecera.titulo)}" font-family="Arial, Helvetica, sans-serif">`);
  partes.push(`<title>${escaparXml(cabecera.titulo)}</title>`);
  partes.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  let y = margen + 20;
  for (const linea of titulo) { partes.push(`<text x="${margen}" y="${y}" font-size="22" font-weight="700" fill="#3b1a5e">${escaparXml(linea)}</text>`); y += 28; }
  y += 4;
  for (const linea of filtros) { partes.push(`<text x="${margen}" y="${y}" font-size="13" fill="#475569">${escaparXml(linea)}</text>`); y += 18; }
  y = altoDeCabecera;
  if (visibles.length === 0) partes.push(`<text x="${margen}" y="${y + 16}" font-size="14" fill="#475569">Sin datos para estos filtros.</text>`);
  visibles.forEach((fila, indice) => {
    const base = y + indice * altoDeFila;
    const largo = Math.max(fila.valor > 0 ? 2 : 0, Math.round((fila.valor / maximo) * anchoDeBarra));
    const etiqueta = fila.etiqueta.length > 34 ? fila.etiqueta.slice(0, 33) + '…' : fila.etiqueta;
    partes.push(`<text x="${margen + anchoDeEtiqueta - 8}" y="${base + 15}" font-size="13" text-anchor="end" fill="#334155">${escaparXml(etiqueta)}</text>`);
    partes.push(`<rect x="${margen + anchoDeEtiqueta}" y="${base + 3}" width="${largo}" height="15" rx="2" fill="${escaparXml(color)}"/>`);
    partes.push(`<text x="${margen + anchoDeEtiqueta + largo + 6}" y="${base + 15}" font-size="13" font-weight="700" fill="#3b1a5e">${escaparXml(String(fila.valor))}${opciones.unidad ? ' ' + escaparXml(opciones.unidad) : ''}</text>`);
  });
  y = altoDeCabecera + altoDelCuerpo + 16;
  partes.push(`<line x1="${margen}" x2="${ANCHO_DEL_SVG - margen}" y1="${y - 8}" y2="${y - 8}" stroke="#cbd5e1"/>`);
  for (const linea of pie) { y += 16; partes.push(`<text x="${margen}" y="${y - 4}" font-size="12" fill="#475569">${escaparXml(linea)}</text>`); }
  partes.push('</svg>');
  return { svg: partes.join(''), ancho: ANCHO_DEL_SVG, alto };
}
