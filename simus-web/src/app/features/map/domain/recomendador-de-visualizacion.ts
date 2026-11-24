/**
 * El recomendador de visualización: dado el perfil de un conjunto de datos y la pregunta, sugiere de
 * dos a tres formas de dibujarlo y EXPLICA cuándo usar cada una y cuándo no.
 *
 * <b>SON REGLAS DECLARATIVAS EN UN SOLO ARCHIVO, no un modelo.</b> Cada regla dice a qué pregunta
 * responde, qué condición del dato la habilita y por qué. Se leen, se discuten con quien decide y se
 * prueban con un perfil literal; un recomendador opaco no se podría defender ante una persona que
 * pregunta «¿por qué me propones un grafo?». La respuesta está aquí, escrita.
 *
 * <b>NO PREFIERE LO ESPECTACULAR.</b> La tabla es siempre una alternativa (accesibilidad y registros
 * precisos), y las formas que inducen a error con ciertos datos —torta con muchas categorías,
 * Sankey sin flujos, red sin relaciones registradas— quedan fuera por condición, no por gusto.
 */
export type PreguntaDelTablero =
  | 'comparar'      // ¿cuánto tiene cada uno?
  | 'tendencia'     // ¿cómo cambia en el tiempo?
  | 'composicion'   // ¿de qué está hecho?
  | 'relaciones'    // ¿quién se conecta con quién?
  | 'flujos'        // ¿de dónde a dónde pasa algo?
  | 'territorio'    // ¿dónde está?
  | 'registros';    // ¿cuáles son, con precisión?

export interface PerfilDeDatos {
  readonly pregunta: PreguntaDelTablero;
  /** Cuántas categorías o filas distintas hay. */
  readonly categorias: number;
  /** Si un registro puede estar en varias categorías a la vez (las partes suman más que el todo). */
  readonly solapan?: boolean;
  /** Cuántos periodos distintos hay (años, meses). */
  readonly periodos?: number;
  /** Si hay relaciones REGISTRADAS entre entidades (no inferidas). */
  readonly relacionesRegistradas?: boolean;
  /** Si los datos son flujos cuantificables origen→destino. */
  readonly flujosCuantificados?: boolean;
  /** Si la medida es un conteo absoluto de áreas de tamaño desigual (riesgo de leer área por valor). */
  readonly conteoAbsolutoPorArea?: boolean;
  /** Cuántas clasificaciones distintas se cruzan a la vez (práctica × territorio = 2; tipo → departamento → práctica = 3). */
  readonly criterios?: number;
}

export type FormaDeVisualizacion =
  | 'barras-ordenadas' | 'puntos-ordenados' | 'columnas-por-periodo' | 'linea' | 'areas-apiladas' | 'barras-apiladas'
  | 'mosaico' | 'aluvial' | 'sunburst' | 'matriz-de-calor' | 'red-de-relaciones' | 'matriz-de-adyacencia' | 'sankey'
  | 'mapa-coropletico' | 'mapa-de-puntos' | 'multiples-pequenos' | 'tabla';

export interface Recomendacion {
  readonly forma: FormaDeVisualizacion;
  readonly cuandoUsarla: string;
  readonly cuandoNo: string;
}

interface Regla {
  readonly forma: FormaDeVisualizacion;
  readonly preguntas: readonly PreguntaDelTablero[];
  /** Condición del dato que la habilita; ausente = siempre que la pregunta coincida. */
  readonly si?: (perfil: PerfilDeDatos) => boolean;
  /** Menor es mejor: orden de preferencia entre las que pasan. */
  readonly prioridad: number;
  readonly cuandoUsarla: string;
  readonly cuandoNo: string;
}

const REGLAS: readonly Regla[] = [
  { forma: 'barras-ordenadas', preguntas: ['comparar', 'composicion'], si: (p) => p.categorias >= 2, prioridad: 1,
    cuandoUsarla: 'Comparar cantidades entre categorías: la longitud se lee con precisión y las etiquetas caben enteras.',
    cuandoNo: 'Con cientos de categorías (use un ranking recortado con «ver todos») o para series en el tiempo.' },
  { forma: 'puntos-ordenados', preguntas: ['comparar'], si: (p) => p.categorias > 15, prioridad: 3,
    cuandoUsarla: 'Muchas categorías: el punto ocupa menos que la barra y deja ver el orden.',
    cuandoNo: 'Con pocas categorías la barra es más inmediata.' },
  { forma: 'mosaico', preguntas: ['composicion'], si: (p) => p.categorias >= 4 && p.categorias <= 40, prioridad: 2,
    cuandoUsarla: 'Ver de un vistazo qué partes pesan más cuando hay muchas y las partes se solapan (no suman el 100 %).',
    cuandoNo: 'Si hay que comparar valores cercanos con precisión (el área se lee peor que la longitud) o hay menos de cuatro partes.' },
  { forma: 'barras-apiladas', preguntas: ['composicion'], si: (p) => !p.solapan && p.categorias <= 6, prioridad: 2,
    cuandoUsarla: 'Pocas partes que suman un todo, comparadas entre varios grupos.',
    cuandoNo: 'Si las partes se solapan o son más de seis: el segmento del medio no se compara.' },
  { forma: 'columnas-por-periodo', preguntas: ['tendencia'], si: (p) => (p.periodos ?? 0) >= 2 && (p.periodos ?? 0) <= 24, prioridad: 1,
    cuandoUsarla: 'Conteos por periodo discreto (años, meses), con los periodos vacíos en cero.',
    cuandoNo: 'Con muchos periodos o medidas continuas: use línea.' },
  { forma: 'linea', preguntas: ['tendencia'], si: (p) => (p.periodos ?? 0) > 12, prioridad: 2,
    cuandoUsarla: 'Una medida que cambia de forma continua en muchos periodos.',
    cuandoNo: 'Con pocos periodos o datos esporádicos: la línea inventa un tránsito entre puntos que no existe.' },
  { forma: 'areas-apiladas', preguntas: ['tendencia'], si: (p) => (p.periodos ?? 0) > 12 && p.categorias >= 2 && p.categorias <= 6, prioridad: 3,
    cuandoUsarla: 'Cómo cambia el total y su composición a la vez.',
    cuandoNo: 'Si importa comparar cada serie por separado: use múltiplos pequeños.' },
  { forma: 'multiples-pequenos', preguntas: ['tendencia', 'comparar'], si: (p) => p.categorias >= 3 && (p.periodos ?? 0) >= 3, prioridad: 4,
    cuandoUsarla: 'Comparar la forma de la evolución de varios territorios o tipos sin que se pisen.',
    cuandoNo: 'Con una o dos series.' },
  { forma: 'matriz-de-calor', preguntas: ['composicion', 'comparar'], si: (p) => p.categorias >= 5, prioridad: 4,
    cuandoUsarla: 'Cruzar dos dimensiones (grupo × departamento) y ver dónde se concentra cada una.',
    cuandoNo: 'Con pocas filas o columnas: una tabla es más clara. No es legible en pantallas angostas sin desplazamiento.' },
  { forma: 'red-de-relaciones', preguntas: ['relaciones'], si: (p) => !!p.relacionesRegistradas, prioridad: 1,
    cuandoUsarla: 'Ver cómo se conectan agentes, organizaciones, procesos y territorios, SOLO con relaciones registradas.',
    cuandoNo: 'Si las relaciones no están registradas o son inferidas (no se presentan como hechos), o si hay cientos de nodos sin filtro.' },
  { forma: 'matriz-de-adyacencia', preguntas: ['relaciones'], si: (p) => !!p.relacionesRegistradas && p.categorias > 40, prioridad: 2,
    cuandoUsarla: 'Redes densas: la matriz no enreda los enlaces.',
    cuandoNo: 'Redes pequeñas, donde el grafo se entiende mejor.' },
  { forma: 'matriz-de-calor', preguntas: ['composicion'], si: (p) => p.criterios === 2, prioridad: 0,
    cuandoUsarla: 'Cruzar dos clasificaciones (práctica × territorio sonoro, grupo × departamento) y ver dónde coinciden más.',
    cuandoNo: 'Si una de las dos tiene pocos valores: una tabla es más clara. Muestra coexistencia, no causa ni relación.' },
  { forma: 'aluvial', preguntas: ['composicion'], si: (p) => (p.criterios ?? 0) >= 3 && p.categorias >= 3, prioridad: 0,
    cuandoUsarla: 'Seguir cómo se reparten los mismos registros entre tres clasificaciones seguidas (tipo, lugar, práctica).',
    cuandoNo: 'Si se lee como un movimiento: las bandas dicen cómo se reparten, no que algo pase de un sitio a otro. Con una sola clasificación basta una barra.' },
  { forma: 'sankey', preguntas: ['flujos'], si: (p) => !!p.flujosCuantificados, prioridad: 1,
    cuandoUsarla: 'Cantidades que pasan de un origen a un destino (p. ej. de un tipo a otro).',
    cuandoNo: 'Si no hay flujo cuantificado: un Sankey sin transición real es una composición disfrazada.' },
  { forma: 'mapa-coropletico', preguntas: ['territorio'], si: (p) => !p.conteoAbsolutoPorArea, prioridad: 1,
    cuandoUsarla: 'Una tasa o proporción por territorio (ya normalizada): el color por área no engaña.',
    cuandoNo: 'Con conteos absolutos: el territorio grande parece más importante por el solo tamaño del área.' },
  { forma: 'mapa-de-puntos', preguntas: ['territorio'], si: (p) => !!p.conteoAbsolutoPorArea, prioridad: 1,
    cuandoUsarla: 'Conteos absolutos: círculos proporcionales o puntos, que no dependen del tamaño del área.',
    cuandoNo: 'Si hay que comparar tasas entre territorios.' },
  { forma: 'barras-ordenadas', preguntas: ['territorio'], prioridad: 2,
    cuandoUsarla: 'Complementa al mapa: da el orden y la cifra exacta de cada territorio.',
    cuandoNo: 'No sustituye al mapa si la pregunta es de vecindad o dispersión.' },
  { forma: 'tabla', preguntas: ['registros', 'comparar', 'composicion', 'tendencia', 'relaciones', 'flujos', 'territorio'], prioridad: 9,
    cuandoUsarla: 'Siempre como alternativa accesible; y como forma principal cuando se piden registros precisos o exportar.',
    cuandoNo: 'Como único recurso cuando la pregunta es de patrón (tendencia, concentración, relación).' },
];

/**
 * De dos a tres visualizaciones para el perfil dado, de la más a la menos recomendada.
 * La tabla entra siempre que haya hueco, y es la primera si la pregunta es de registros.
 */
export function recomendarVisualizaciones(perfil: PerfilDeDatos): readonly Recomendacion[] {
  const candidatas = REGLAS
    .filter((regla) => regla.preguntas.includes(perfil.pregunta) && (!regla.si || regla.si(perfil)))
    .sort((a, b) => (perfil.pregunta === 'registros' ? 0 : a.prioridad - b.prioridad) || a.prioridad - b.prioridad);
  const unicas: Regla[] = [];
  for (const regla of candidatas) if (!unicas.some((u) => u.forma === regla.forma)) unicas.push(regla);
  const sinTabla = unicas.filter((regla) => regla.forma !== 'tabla').slice(0, 2);
  const tabla = unicas.find((regla) => regla.forma === 'tabla');
  const elegidas = perfil.pregunta === 'registros' ? [tabla, ...sinTabla] : [...sinTabla, tabla];
  return elegidas.filter((r): r is Regla => !!r).slice(0, 3)
    .map(({ forma, cuandoUsarla, cuandoNo }) => ({ forma, cuandoUsarla, cuandoNo }));
}
