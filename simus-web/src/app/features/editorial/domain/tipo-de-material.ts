/**
 * EL TIPO DE MATERIAL DEL CATÁLOGO, EN LA PALABRA QUE USA QUIEN LO BUSCA (G6).
 *
 * <b>LO QUE HABÍA.</b> El filtro «Tipo de contenido» ofrecía los términos de RDA 336 que existen en
 * el acervo: «texto», «música notada», «música interpretada» e «imagen en movimiento
 * bidimensional». Son cuatro, son del vocabulario de una norma catalográfica y no se parecen a lo que
 * alguien viene a buscar: un libro, una partitura, un disco, un video. Y la etiqueta de cada tarjeta
 * mostraba el texto tal como lo escribió la fuente —«Libro CD y DVD», «Estuche incluye 4 impresos,
 * partitura general cada una identificada en la portada con un color…»—, en mayúsculas.
 *
 * <b>LO QUE HAY AHORA.</b> Un vocabulario corto de siete tipos, deducido de lo que la ficha ya
 * declara: las facetas DCMI/RDA cuando existen y, cuando no (once fichas no traen tipología), el
 * texto de origen. No se guarda nada nuevo ni se toca el dato de la fuente: la ficha detallada sigue
 * mostrando la tipología RDA completa, que es lo que necesita quien cataloga.
 *
 * <b>LA TABLA DE EQUIVALENCIAS, POR ORDEN DE PRIORIDAD</b> (la primera que se cumple gana):
 * <ol>
 *   <li><b>Partitura</b>: el contenido es música notada (RDA 336) o el texto de origen dice
 *       «partitura» o «cancionero». Gana sobre «mixto»: un libro de partituras con un CD sigue siendo,
 *       ante todo, una partitura.</li>
 *   <li><b>Material mixto</b>: la ficha declara dos o más tipos de recurso DCMI distintos (texto y
 *       sonido, texto y video…): «Libro y CD», «Libro con CD y DVD».</li>
 *   <li><b>Audio</b>: el recurso es sonido (DCMI), o el texto de origen es un CD o un disco.</li>
 *   <li><b>Video</b>: el recurso es imagen en movimiento, o el texto de origen es un DVD, un VHS o un
 *       videoclip.</li>
 *   <li><b>Recurso digital</b>: el recurso es interactivo, o el texto de origen habla de una app, un
 *       curso virtual, un CD-ROM, un multimedia o algo «virtual» o «digital».</li>
 *   <li><b>Guía o manual</b>: el texto de origen dice «guía», «manual» o «cuaderno».</li>
 *   <li><b>Libro</b>: todo lo demás.</li>
 * </ol>
 *
 * El criterio vive aquí y solo aquí: el filtro, la etiqueta de la tarjeta y la ficha lo leen de esta
 * función, de modo que cambiarlo es cambiar un archivo.
 */
export type IdDeTipoDeMaterial = 'libro' | 'guia' | 'partitura' | 'audio' | 'video' | 'digital' | 'mixto';

export interface TipoDeMaterial {
  readonly id: IdDeTipoDeMaterial;
  readonly etiqueta: string;
}

/** Los siete tipos, en el orden en que se ofrecen en el filtro. */
export const TIPOS_DE_MATERIAL: readonly TipoDeMaterial[] = [
  { id: 'libro', etiqueta: 'Libro' },
  { id: 'guia', etiqueta: 'Guía o manual' },
  { id: 'partitura', etiqueta: 'Partitura' },
  { id: 'audio', etiqueta: 'Audio' },
  { id: 'video', etiqueta: 'Video' },
  { id: 'digital', etiqueta: 'Recurso digital' },
  { id: 'mixto', etiqueta: 'Material mixto' },
];

const PORID = new Map(TIPOS_DE_MATERIAL.map(tipo => [tipo.id, tipo]));

/** Sin tildes y en minúsculas, para comparar el texto de origen sin depender de cómo lo escribió la fuente. */
function plano(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Lo mínimo que se necesita de una ficha: su texto de origen y su tipología. */
export interface FichaParaClasificar {
  readonly publicationType?: string | null;
  readonly typology?: readonly { readonly eje: string; readonly codigo: string }[] | null;
}

export function tipoDeMaterial(ficha: FichaParaClasificar): TipoDeMaterial {
  const origen = plano(ficha.publicationType);
  const terminos = ficha.typology ?? [];
  const recursos = new Set(terminos.filter(t => t.eje === 'recurso').map(t => t.codigo));
  const esMusicaNotada = terminos.some(t => t.eje === 'contenido' && t.codigo === 'musica-notada');

  let id: IdDeTipoDeMaterial;
  if (esMusicaNotada || /partitura|cancionero/.test(origen)) {
    id = 'partitura';
  } else if (recursos.size >= 2) {
    id = 'mixto';
  } else if (recursos.has('sound') || (/(?:^|[^a-z])\d*cds?(?![a-z])|\bdisco\b/.test(origen) && !/rom/.test(origen))) {
    id = 'audio';
  } else if (recursos.has('movingimage') || /dvd|vhs|video/.test(origen)) {
    id = 'video';
  } else if (recursos.has('interactiveresource') || /\bapp\b|curso virtual|multimedia|cd-?\s?rom|virtual|digital/.test(origen)) {
    id = 'digital';
  } else if (/guia|manual|cuaderno/.test(origen)) {
    id = 'guia';
  } else {
    id = 'libro';
  }
  return PORID.get(id)!;
}

/**
 * El soporte físico, en la palabra de uso común: «volumen» es lo que dice RDA 338 y quien busca dice
 * «impreso»; «videodisco», «DVD». La ficha detallada conserva el término de la norma.
 */
const SOPORTE_EN_LLANO: Readonly<Record<string, string>> = {
  'volumen': 'Impreso',
  'disco-de-audio': 'CD de audio',
  'videodisco': 'DVD',
  'disco-de-computador': 'CD-ROM',
  'recurso-en-linea': 'En línea',
};

export function soporteEnLlano(codigo: string, respaldo: string): string {
  return SOPORTE_EN_LLANO[codigo] ?? respaldo;
}
