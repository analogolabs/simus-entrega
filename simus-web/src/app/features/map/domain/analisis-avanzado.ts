import { SIN_CLASIFICAR, clasificacionDeclarada } from './analitica-del-mapa';
import type { PerfilDeDatos, PreguntaDelTablero } from './recomendador-de-visualizacion';

/**
 * La aritmética del ANÁLISIS AVANZADO del tablero: funciones puras sobre registros ya publicados.
 *
 * <b>NADA SE INVENTA.</b> Solo se cuenta lo que las listas públicas ya traen (tipo de proceso,
 * departamento de la sede, prácticas y territorios sonoros declarados). No hay relaciones inferidas ni
 * datos personales: son registros de procesos. Lo que falta se llama «Sin declarar», no se oculta.
 */

export const SIN_DECLARAR = 'Sin declarar';
export const OTROS = 'Otros';

/** Un registro reducido a lo que el análisis necesita. */
export interface RegistroAnalitico {
  readonly tipo: string;
  readonly departamento: string;
  readonly practicas: readonly string[];
  readonly territorios: readonly string[];
}

/** Lo que el análisis necesita de un registro crudo de las listas públicas. */
export interface RegistroCrudo {
  readonly department?: string;
  readonly practices?: string;
  readonly linkedSonorousTerritories?: string;
}

export function construirRegistros(
  fuentes: readonly (readonly [string, Readonly<Record<string, readonly RegistroCrudo[]>>])[],
  nombreDelDepartamento: (crudo: string) => string,
): RegistroAnalitico[] {
  const resultado: RegistroAnalitico[] = [];
  for (const [tipo, porDepartamento] of fuentes) {
    for (const [clave, lista] of Object.entries(porDepartamento ?? {})) {
      for (const registro of lista ?? []) {
        const crudo = (registro?.department ?? '').trim() || clave;
        const departamento = crudo ? nombreDelDepartamento(crudo) : SIN_DECLARAR;
        const practicas = clasificacionDeclarada(registro, 'practicas');
        const territorios = clasificacionDeclarada(registro, 'territorios-sonoros');
        resultado.push({
          tipo, departamento: departamento || SIN_DECLARAR,
          practicas: practicas.map((valor) => (valor === SIN_CLASIFICAR ? SIN_DECLARAR : valor)),
          territorios: territorios.map((valor) => (valor === SIN_CLASIFICAR ? SIN_DECLARAR : valor)),
        });
      }
    }
  }
  return resultado;
}

/** Los filtros cruzados del análisis; vacío = sin filtro. Los tipos son un conjunto: varios a la vez. */
export interface FiltrosDelAnalisis {
  readonly tipos: readonly string[];
  readonly departamento: string;
  readonly practica: string;
  readonly territorio: string;
}

export const SIN_FILTROS: FiltrosDelAnalisis = { tipos: [], departamento: '', practica: '', territorio: '' };

export function filtrarRegistros(registros: readonly RegistroAnalitico[], filtros: FiltrosDelAnalisis): RegistroAnalitico[] {
  return registros.filter((registro) =>
    (filtros.tipos.length === 0 || filtros.tipos.includes(registro.tipo))
    && (!filtros.departamento || registro.departamento === filtros.departamento)
    && (!filtros.practica || registro.practicas.includes(filtros.practica))
    && (!filtros.territorio || registro.territorios.includes(filtros.territorio)));
}

const porTotalYNombre = (a: { nombre: string; total: number }, b: { nombre: string; total: number }) =>
  b.total - a.total || a.nombre.localeCompare(b.nombre, 'es');

function contar<T>(items: readonly T[], clave: (item: T) => readonly string[]): { nombre: string; total: number }[] {
  const cuenta = new Map<string, number>();
  for (const item of items) for (const valor of clave(item)) cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1);
  return [...cuenta].map(([nombre, total]) => ({ nombre, total })).sort(porTotalYNombre);
}

/** Los tipos de proceso presentes, con cuántos registros, de mayor a menor. */
export const tiposPresentes = (registros: readonly RegistroAnalitico[]) => contar(registros, (r) => [r.tipo]);

// ---------------------------------------------------------------------------------------------
// 1. Barras apiladas: departamento × tipo de proceso
// ---------------------------------------------------------------------------------------------

/** Por qué se agrupan las barras: el departamento de la sede, o lo que los registros declaran (puede ser varias cosas a la vez). */
export type EjeDeBarras = 'departamentos' | 'practicas' | 'territorios';

export interface BarrasApiladas {
  /** Las categorías del eje elegido (el nombre del campo es el original: por defecto son departamentos). */
  readonly departamentos: readonly string[];
  readonly tipos: readonly string[];
  /** `valores[tipo][i]` = registros de ese tipo en `departamentos[i]`. */
  readonly valores: Readonly<Record<string, readonly number[]>>;
  readonly totales: readonly number[];
  readonly ocultos: number;
  readonly eje: EjeDeBarras;
}

const categoriasDelEje = (r: RegistroAnalitico, eje: EjeDeBarras): readonly string[] =>
  eje === 'practicas' ? r.practicas : eje === 'territorios' ? r.territorios : [r.departamento];

export function barrasApiladas(registros: readonly RegistroAnalitico[], maximo = 12, eje: EjeDeBarras = 'departamentos'): BarrasApiladas {
  const tipos = tiposPresentes(registros).map((t) => t.nombre);
  const porCategoria = contar(registros, (r) => categoriasDelEje(r, eje));
  const visibles = porCategoria.slice(0, maximo).map((d) => d.nombre);
  const valores: Record<string, number[]> = Object.fromEntries(tipos.map((t) => [t, visibles.map(() => 0)]));
  for (const registro of registros) {
    for (const categoria of categoriasDelEje(registro, eje)) {
      const indice = visibles.indexOf(categoria);
      if (indice >= 0) valores[registro.tipo][indice] += 1;
    }
  }
  return {
    departamentos: visibles, tipos, valores,
    totales: visibles.map((_, i) => tipos.reduce((suma, t) => suma + valores[t][i], 0)),
    ocultos: Math.max(0, porCategoria.length - visibles.length),
    eje,
  };
}

// ---------------------------------------------------------------------------------------------
// 2. Jerarquía: tipo → departamento → práctica
// ---------------------------------------------------------------------------------------------

export interface NodoDeJerarquia {
  readonly name: string;
  readonly value: number;
  readonly children?: readonly NodoDeJerarquia[];
}

export function jerarquia(registros: readonly RegistroAnalitico[], maximoPorNivel = 8): NodoDeJerarquia[] {
  const recortar = (items: { nombre: string; total: number }[]) => {
    if (items.length <= maximoPorNivel) return items;
    const cabeza = items.slice(0, maximoPorNivel - 1);
    const resto = items.slice(maximoPorNivel - 1).reduce((s, i) => s + i.total, 0);
    return [...cabeza, { nombre: OTROS, total: resto }];
  };
  return tiposPresentes(registros).map((tipo) => {
    const deTipo = registros.filter((r) => r.tipo === tipo.nombre);
    const departamentos = contar(deTipo, (r) => [r.departamento]);
    return {
      name: tipo.nombre, value: tipo.total,
      children: departamentos.map((d) => {
        const practicas = recortar(contar(deTipo.filter((r) => r.departamento === d.nombre), (r) => r.practicas));
        return {
          name: d.nombre, value: d.total,
          children: practicas.length > 0 ? practicas.map((p) => ({ name: p.nombre, value: p.total })) : undefined,
        };
      }),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// 3. Flujo (aluvial): tipo → departamento → práctica principal
// ---------------------------------------------------------------------------------------------

export interface DiagramaAluvial {
  readonly nodos: readonly { readonly name: string; readonly profundidad: 0 | 1 | 2 }[];
  readonly enlaces: readonly { readonly source: string; readonly target: string; readonly value: number }[];
  readonly total: number;
}

/** Los nodos de cada columna llevan un sufijo invisible para que «Antioquia» del paso 2 no choque con otro del paso 3. */
const CLAVE_DE_NODO = ['t', 'd', 'p'] as const;
export const nombreDeNodo = (clave: string): string => clave.slice(2);

export function diagramaAluvial(registros: readonly RegistroAnalitico[], maximoPorColumna = 10): DiagramaAluvial {
  const topDepartamentos = new Set(contar(registros, (r) => [r.departamento]).slice(0, maximoPorColumna - 1).map((d) => d.nombre));
  const topPracticas = new Set(contar(registros, (r) => [r.practicas[0] ?? SIN_DECLARAR]).slice(0, maximoPorColumna - 1).map((d) => d.nombre));
  const hilos = new Map<string, number>();
  const sumar = (origen: string, destino: string) => {
    const clave = `${origen}\u0000${destino}`;
    hilos.set(clave, (hilos.get(clave) ?? 0) + 1);
  };
  for (const registro of registros) {
    const tipo = `${CLAVE_DE_NODO[0]}:${registro.tipo}`;
    const departamento = `${CLAVE_DE_NODO[1]}:${topDepartamentos.has(registro.departamento) ? registro.departamento : OTROS}`;
    const practicaCruda = registro.practicas[0] ?? SIN_DECLARAR;
    const practica = `${CLAVE_DE_NODO[2]}:${topPracticas.has(practicaCruda) ? practicaCruda : OTROS}`;
    sumar(tipo, departamento);
    sumar(departamento, practica);
  }
  const enlaces = [...hilos].map(([clave, value]) => {
    const [source, target] = clave.split('\u0000');
    return { source, target, value };
  }).sort((a, b) => b.value - a.value || a.source.localeCompare(b.source, 'es') || a.target.localeCompare(b.target, 'es'));
  const nombres = new Set(enlaces.flatMap((e) => [e.source, e.target]));
  const nodos = [...nombres].map((name) => ({ name, profundidad: CLAVE_DE_NODO.indexOf(name[0] as 't' | 'd' | 'p') as 0 | 1 | 2 }))
    .sort((a, b) => a.profundidad - b.profundidad || a.name.localeCompare(b.name, 'es'));
  return { nodos, enlaces, total: registros.length };
}

// ---------------------------------------------------------------------------------------------
// 4. Matriz de coincidencias
// ---------------------------------------------------------------------------------------------

export type EjeDeMatriz = 'practicas' | 'territorios' | 'departamentos';

export interface MatrizDeCoincidencias {
  readonly filas: readonly string[];
  readonly columnas: readonly string[];
  /** `[columna, fila, valor]` solo donde hay coincidencias. */
  readonly celdas: readonly (readonly [number, number, number])[];
  readonly maximo: number;
}

const valoresDelEje = (r: RegistroAnalitico, eje: EjeDeMatriz): readonly string[] =>
  eje === 'practicas' ? r.practicas : eje === 'territorios' ? r.territorios : [r.departamento];

export function matrizDeCoincidencias(
  registros: readonly RegistroAnalitico[], ejeDeFilas: EjeDeMatriz, ejeDeColumnas: EjeDeMatriz, maximoPorEje = 10,
): MatrizDeCoincidencias {
  // «Sin declarar» no se cruza: que dos datos que faltan coincidan no dice nada y taparía a los que sí constan.
  const declarados = (r: RegistroAnalitico, eje: EjeDeMatriz) => valoresDelEje(r, eje).filter((valor) => valor !== SIN_DECLARAR);
  const filas = contar(registros, (r) => declarados(r, ejeDeFilas)).slice(0, maximoPorEje).map((x) => x.nombre);
  const columnas = contar(registros, (r) => declarados(r, ejeDeColumnas)).slice(0, maximoPorEje).map((x) => x.nombre);
  const cuenta = new Map<string, number>();
  for (const registro of registros) {
    for (const fila of declarados(registro, ejeDeFilas)) {
      const f = filas.indexOf(fila);
      if (f < 0) continue;
      for (const columna of declarados(registro, ejeDeColumnas)) {
        const c = columnas.indexOf(columna);
        if (c < 0) continue;
        cuenta.set(`${c}|${f}`, (cuenta.get(`${c}|${f}`) ?? 0) + 1);
      }
    }
  }
  const celdas = [...cuenta].map(([clave, valor]) => {
    const [c, f] = clave.split('|').map(Number);
    return [c, f, valor] as const;
  });
  return { filas, columnas, celdas, maximo: celdas.reduce((m, c) => Math.max(m, c[2]), 0) };
}

// ---------------------------------------------------------------------------------------------
// Perfil de datos para el recomendador
// ---------------------------------------------------------------------------------------------

/** Lo que el recomendador necesita saber de los datos de este análisis: nada de relaciones ni flujos medidos. */
export function perfilParaElRecomendador(pregunta: PreguntaDelTablero, registros: readonly RegistroAnalitico[]): PerfilDeDatos {
  return {
    pregunta,
    categorias: contar(registros, (r) => [r.departamento]).length,
    solapan: true,
    periodos: 0,
    relacionesRegistradas: false,
    flujosCuantificados: false,
    conteoAbsolutoPorArea: true,
  };
}
