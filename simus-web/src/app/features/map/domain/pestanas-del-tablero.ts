/**
 * Las pestañas de la vista Gráfico: una visualización por pestaña, cada una con la pregunta que responde.
 *
 * <b>UNA SOLA FUENTE.</b> La barra de pestañas, las preguntas orientadoras del «Panel general» y la frase de
 * cada pestaña salen de esta lista: cambiar un nombre o una pregunta se hace aquí y en ningún otro sitio.
 * Lo que NO hay a propósito: «Territorio» (ya es el Mapa) ni «Distribuciones» (los datos públicos son
 * conteos de registros; no hay una medida numérica cuya distribución tenga sentido leer).
 */
export type PestanaDelTablero = 'panel' | 'flujos' | 'redes' | 'coincidencias' | 'barras' | 'jerarquias';
export type PestanaDeAnalisis = Exclude<PestanaDelTablero, 'panel'>;

export interface DatosDePestana {
  readonly id: PestanaDelTablero;
  readonly nombre: string;
  /** La pregunta que responde, como se la haría quien mira. */
  readonly pregunta: string;
  /** Una frase sobre qué se ve en la pestaña. */
  readonly responde: string;
}

export const PESTANAS_DEL_TABLERO: readonly DatosDePestana[] = [
  { id: 'panel', nombre: 'Panel general', pregunta: '¿Por dónde empiezo?', responde: 'Las cifras y los gráficos de resumen, y las preguntas que llevan a cada vista.' },
  { id: 'flujos', nombre: 'Flujos', pregunta: '¿Cómo se reparte en tres pasos?', responde: 'Cómo se reparten los registros del tipo de proceso al departamento y a la práctica.' },
  { id: 'redes', nombre: 'Redes', pregunta: '¿Quién se conecta con quién o con qué?', responde: 'Las relaciones registradas entre organizaciones, procesos, territorios sonoros y prácticas.' },
  { id: 'coincidencias', nombre: 'Coincidencias', pregunta: '¿Qué coincide con qué?', responde: 'Cuántos registros declaran a la vez dos valores, como una práctica y un territorio sonoro.' },
  { id: 'barras', nombre: 'Barras', pregunta: '¿Dónde se concentra la actividad?', responde: 'Cuántos registros hay por departamento, práctica o territorio, y de qué tipo de proceso.' },
  { id: 'jerarquias', nombre: 'Jerarquías', pregunta: '¿De qué está hecho el ecosistema?', responde: 'El conjunto en mosaico, del tipo de proceso al departamento y a la práctica, con descenso por clic.' },
];

/**
 * Las pestañas con los textos que el CMS tenga publicados (grupo «Vista Gráfico · seis pestañas»). `leer` es
 * `getWebText`: sin nada publicado devuelve el texto de fábrica del registro, que es el de la lista de arriba.
 * El orden, los identificadores y lo que hace cada pestaña no se editan: solo lo que se lee.
 */
export function pestanasConTextos(leer: (clave: string) => string): readonly DatosDePestana[] {
  return PESTANAS_DEL_TABLERO.map((p) => ({
    id: p.id,
    nombre: leer(`mapa_tab_${p.id}_nombre`) || p.nombre,
    pregunta: leer(`mapa_tab_${p.id}_pregunta`) || p.pregunta,
    responde: leer(`mapa_tab_${p.id}_responde`) || p.responde,
  }));
}

/** Las preguntas orientadoras del Panel general: una por cada pestaña que contesta. */
export const PREGUNTAS_ORIENTADORAS: readonly DatosDePestana[] = PESTANAS_DEL_TABLERO.filter((p) => p.id !== 'panel');

const IDS: readonly string[] = PESTANAS_DEL_TABLERO.map((p) => p.id);

/** De la dirección a la pestaña. Los valores antiguos no se rompen: «panorama» y «lecturas» caen en el Panel general y «avanzado» en Flujos. */
export function pestanaDesdeTexto(texto: string): PestanaDelTablero {
  if (IDS.includes(texto)) return texto as PestanaDelTablero;
  if (texto === 'avanzado') return 'flujos';
  return 'panel';
}

export const nombreDeLaPestana = (id: PestanaDelTablero): string => PESTANAS_DEL_TABLERO.find((p) => p.id === id)?.nombre ?? '';
