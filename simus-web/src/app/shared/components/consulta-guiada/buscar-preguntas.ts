import { ConsultaOfrecida } from './consulta-guiada.service';

/**
 * Busca por palabras entre las preguntas VERIFICADAS del banco. No genera respuestas ni interpreta
 * la frase: solo ordena el catálogo cerrado según cuánto se parece a lo que la persona escribió.
 *
 * <b>SIN IA.</b> Normaliza (minúsculas, sin tildes), descarta palabras vacías y compara por prefijo
 * de raíz («festivales» casa con «festival»). Si ninguna pregunta contiene una palabra escrita,
 * `cercanas` devuelve las que más se parecen por letras, para sugerirlas en lugar de quedarse en blanco.
 */
export interface ResultadoDeBusqueda<T extends ConsultaOfrecida = ConsultaOfrecida> {
  /** Preguntas que contienen al menos una palabra escrita, de la más a la menos pertinente. */
  coincidencias: T[];
  /** Las más cercanas por letras cuando no hay coincidencias; vacío si las hay. */
  cercanas: T[];
}

const PALABRAS_VACIAS = new Set([
  'a', 'al', 'algo', 'cual', 'cuales', 'como', 'con', 'de', 'del', 'el', 'en', 'es', 'esta', 'estan', 'hay', 'la', 'las',
  'lo', 'los', 'me', 'mas', 'muy', 'para', 'por', 'que', 'se', 'si', 'sobre', 'su', 'un', 'una', 'y', 'o', 'quiero', 'saber', 'dime',
]);

export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Raíz tosca: quita plurales y terminaciones comunes para que «mercados» y «mercado» coincidan. */
function raiz(palabra: string): string {
  let r = palabra;
  for (const sufijo of ['es', 's']) {
    if (r.length > 4 && r.endsWith(sufijo)) { r = r.slice(0, -sufijo.length); break; }
  }
  return r.length > 6 ? r.slice(0, 6) : r;
}

function palabrasDe(texto: string): string[] {
  return normalizar(texto).split(' ').filter(p => p.length > 1 && !PALABRAS_VACIAS.has(p));
}

function trigramas(texto: string): Set<string> {
  const t = `  ${normalizar(texto)} `;
  const conjunto = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) conjunto.add(t.slice(i, i + 3));
  return conjunto;
}

export function buscarPreguntas<T extends ConsultaOfrecida>(preguntas: readonly T[], consulta: string, cercanasMax = 3): ResultadoDeBusqueda<T> {
  const palabras = palabrasDe(consulta);
  if (normalizar(consulta).length === 0) return { coincidencias: [...preguntas], cercanas: [] };

  const puntuadas = preguntas.map(pregunta => {
    const rotulo = palabrasDe(pregunta.rotulo).map(raiz);
    const descripcion = palabrasDe(pregunta.descripcion).map(raiz);
    let puntos = 0;
    for (const palabra of palabras) {
      const r = raiz(palabra);
      if (rotulo.some(p => p.startsWith(r) || r.startsWith(p))) puntos += 3;
      else if (descripcion.some(p => p.startsWith(r) || r.startsWith(p))) puntos += 1;
    }
    return { pregunta, puntos };
  });

  const coincidencias = puntuadas.filter(p => p.puntos > 0).sort((a, b) => b.puntos - a.puntos).map(p => p.pregunta);
  if (coincidencias.length > 0 || palabras.length === 0) return { coincidencias, cercanas: [] };

  const buscado = trigramas(consulta);
  const cercanas = preguntas
    .map(pregunta => {
      const propios = trigramas(`${pregunta.rotulo} ${pregunta.descripcion}`);
      let comunes = 0;
      buscado.forEach(t => { if (propios.has(t)) comunes++; });
      return { pregunta, similitud: comunes / (buscado.size || 1) };
    })
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, cercanasMax)
    .map(p => p.pregunta);
  return { coincidencias: [], cercanas };
}
