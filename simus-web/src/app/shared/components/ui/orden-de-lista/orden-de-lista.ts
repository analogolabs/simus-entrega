import { DireccionDeOrden } from '../tabla/orden-de-tabla';

export type { DireccionDeOrden };

/**
 * QUÉ CLASE DE VALOR ORDENA UNA COLUMNA. De ella salen las palabras de la dirección: una lista de
 * nombres se ordena «A–Z», una de fechas «Más reciente primero». Una flecha sola («↑») no dice qué
 * pasará; la palabra sí.
 *
 * - `texto`: alfabético, sin distinguir tildes ni mayúsculas.
 * - `fecha`: pasado y futuro; ascendente es «Más antigua primero».
 * - `cerca`: una fecha que se lee por cercanía (eventos); ascendente es «Más cercana primero».
 * - `rank`: un estado con urgencia; ascendente es «Más urgente primero».
 * - `num`: una cantidad (tamaño, conteo).
 */
export type TipoDeOrden = 'texto' | 'fecha' | 'cerca' | 'rank' | 'num';

/** El orden vigente de una lista: una columna y su dirección. Es el valor que viaja entre piezas. */
export interface EstadoDeOrden {
  readonly columna: string;
  readonly direccion: DireccionDeOrden;
}

/** Lo que `app-orden-de-lista` ofrece en «Ordenar por», y lo que `app-tabla-de-gestion` pinta como cabecera. */
export interface OpcionDeOrden {
  readonly id: string;
  readonly etiqueta: string;
  readonly tipo: TipoDeOrden;
}

/** Una opción de orden que además sabe sacar su valor de una fila (para `ordenarFilas`). */
export interface ColumnaOrdenable<T> extends OpcionDeOrden {
  readonly valor: (fila: T) => string | number | Date | null | undefined;
}

const PALABRAS: Record<TipoDeOrden, readonly [string, string]> = {
  texto: ['A–Z', 'Z–A'],
  fecha: ['Más antigua primero', 'Más reciente primero'],
  cerca: ['Más cercana primero', 'Más lejana primero'],
  rank: ['Más urgente primero', 'Menos urgente primero'],
  num: ['Menor primero', 'Mayor primero'],
};

/** La palabra de la dirección para esa clase de valor: «Más reciente primero». */
export function etiquetaDeDireccion(tipo: TipoDeOrden, direccion: DireccionDeOrden): string {
  return PALABRAS[tipo][direccion === 'asc' ? 0 : 1];
}

/**
 * Pulsar el encabezado de una columna: si ya era la del orden, invierte la dirección; si no, la elige
 * en ascendente. Es la misma regla que el prototipo aprobado y la misma para todas las listas.
 */
export function alternarOrden(actual: EstadoDeOrden, columna: string): EstadoDeOrden {
  return actual.columna === columna
    ? { columna, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' }
    : { columna, direccion: 'asc' };
}

/**
 * Ordena una copia de `filas` por la columna y dirección del estado. Los valores vacíos van SIEMPRE al
 * final, sea cual sea la dirección: una fecha que falta no es «la más antigua». Si la columna no existe,
 * devuelve la lista como llegó.
 */
export function ordenarFilas<T>(filas: readonly T[], columnas: readonly ColumnaOrdenable<T>[], orden: EstadoDeOrden): T[] {
  const columna = columnas.find(c => c.id === orden.columna);
  if (!columna) return [...filas];
  const signo = orden.direccion === 'desc' ? -1 : 1;
  return [...filas].sort((a, b) => {
    const va = columna.valor(a);
    const vb = columna.valor(b);
    const aVacio = va === null || va === undefined || va === '';
    const bVacio = vb === null || vb === undefined || vb === '';
    if (aVacio && bVacio) return 0;
    if (aVacio) return 1;
    if (bVacio) return -1;
    if (va instanceof Date || vb instanceof Date) return (Number(new Date(va as Date)) - Number(new Date(vb as Date))) * signo;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * signo;
    return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' }) * signo;
  });
}
