/**
 * Cada cuánto ocurre un proceso del Ecosistema.
 *
 * <b>ERAN TRES LISTAS, UNA POR PANTALLA, Y YA HABIAN DIVERGIDO.</b> El 17 de septiembre de 2026 el
 * mismo vocabulario vivía copiado dentro de tres componentes —el alta de Festival de la consola, el
 * asistente de Festival y el asistente de Mercado—, y una cuarta pantalla —el cajón de Mercados de
 * la consola— lo capturaba como <b>texto libre</b> con el ejemplo escrito en el marcador. Las copias
 * ya no decían lo mismo: la de Mercados ofrecía «Permanente», que el contrato del servidor no
 * declara, y le faltaban «Trimestral», «Bianual» y «Trienal», que sí acepta.
 *
 * <b>LO QUE SE PUEDE ELEGIR ES LO QUE EL SERVIDOR ADMITE</b>, ni más ni menos. Estos nueve códigos
 * son exactamente los de <c>PeriodicidadesFestival</c> en el contrato y los de la tabla <c>Periodicidades</c>: una pantalla que ofrezca un
 * noveno está ofreciendo algo que el circuito no reconoce, y una que ofrezca siete esconde una
 * respuesta legítima.
 *
 * <b>DOS DE ELLOS OBLIGAN A EXPLICARSE.</b> «Otra periodicidad regular» e «Intermitente» no dicen
 * cada cuánto, así que el formulario pide el detalle en cuanto se eligen —y no antes—. La misma
 * regla la aplica el servidor.
 */
export interface OpcionDePeriodicidad {
  readonly codigo: string;
  readonly etiqueta: string;
}

/**
 * Los nueve valores declarados, en el orden en que se ofrecen.
 *
 * DE LO MAS FRECUENTE A LO MENOS: anual es la respuesta de la mayoría de los procesos del
 * Ecosistema, y las dos que obligan a explicarse van al final porque son la salida cuando ninguna
 * de las anteriores sirve.
 */
export const PERIODICIDADES: readonly OpcionDePeriodicidad[] = [
  { codigo: 'anual', etiqueta: 'Anual' },
  { codigo: 'semestral', etiqueta: 'Semestral' },
  { codigo: 'trimestral', etiqueta: 'Trimestral' },
  { codigo: 'bianual', etiqueta: 'Bianual (dos veces al año)' },
  { codigo: 'bienal', etiqueta: 'Bienal (cada dos años)' },
  { codigo: 'trienal', etiqueta: 'Trienal (cada tres años)' },
  { codigo: 'unica_vez', etiqueta: 'Única vez' },
  { codigo: 'otra_regular', etiqueta: 'Otra periodicidad regular' },
  { codigo: 'intermitente', etiqueta: 'Intermitente o sin periodicidad fija' },
] as const;

/** Las dos que no dicen cada cuánto y por eso piden explicarlo. */
const PIDEN_DETALLE = ['otra_regular', 'intermitente'];

/** Si la periodicidad elegida obliga a explicar cuál es. */
export function pideDetalle(periodicidad: string | null | undefined): boolean {
  return PIDEN_DETALLE.includes((periodicidad ?? '').trim().toLowerCase());
}

/**
 * Cómo se lee una periodicidad guardada.
 *
 * Si el código no está entre los nueve se devuelve tal cual y no una cadena vacía: un dato raro es
 * más fácil de diagnosticar que un dato ausente, que es el mismo criterio de `etiquetaDelFestival`.
 */
export function etiquetaDePeriodicidad(codigo: string | null | undefined): string {
  const clave = (codigo ?? '').trim().toLowerCase();
  if (!clave) return '';
  return PERIODICIDADES.find(opcion => opcion.codigo === clave)?.etiqueta ?? clave;
}

/**
 * Un dato de la conciliación de una reclamación, dicho como lo dice el resto de la plataforma.
 *
 * <b>LA PERIODICIDAD VIAJA COMO CÓDIGO</b> («anual», «otra_regular») y la conciliación la enseñaba
 * así, mientras el asistente la rotula «Anual» u «Otra periodicidad regular» (D3-04). El resto de los
 * datos son texto que la persona escribió y se dejan como están.
 */
export function valorLegibleDeUnCampo(clave: string, valor: unknown): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) return '';
  return clave.toLowerCase() === 'periodicidad' ? etiquetaDePeriodicidad(texto) : texto;
}
