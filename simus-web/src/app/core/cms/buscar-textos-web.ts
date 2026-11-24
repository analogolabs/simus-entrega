import { WEB_TEXT_GROUPS, WEB_TEXT_SECTIONS } from './registro-de-textos-web';

/**
 * Un texto del sitio que coincide con lo que la persona buscó.
 *
 * Lleva todo lo que hace falta para saltar a él —la sección, el bloque— y para que quien lee la
 * lista reconozca si es el que busca sin abrirlo: el rótulo del campo, el bloque al que
 * pertenece y un extracto de lo que dice hoy en el sitio.
 */
export interface ResultadoDeBusquedaDeTexto {
  key: string;
  groupId: string;
  groupLabel: string;
  section: string;
  sectionPill: string;
  fieldLabel: string;
  /** Lo que dice hoy en el sitio, recortado alrededor de la coincidencia. */
  extracto: string;
  /** Dónde coincidió: el rótulo/bloque pesa más que una coincidencia suelta dentro del texto. */
  coincideEn: 'rotulo' | 'texto';
}

/** Mínimo de letras para buscar: con una o dos, casi todo coincide y la lista no ayuda. */
export const MINIMO_PARA_BUSCAR = 3;

const AMPLITUD_DEL_EXTRACTO = 60;

/** Sin tildes, sin mayúsculas y con los espacios colapsados: «Educación» encuentra «EDUCACION». */
export function normalizarParaBuscar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractoAlrededor(texto: string, terminos: string[]): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= AMPLITUD_DEL_EXTRACTO * 2) { return limpio; }

  // La posición se busca sobre el texto normalizado, que conserva la longitud: quitar tildes con
  // NFD las separa y las descarta, así que se compara carácter a carácter sobre la versión sin
  // marcas combinantes de CADA letra y no sobre la cadena entera.
  const plano = limpio.split('').map(letra => normalizarParaBuscar(letra) || letra.toLowerCase()).join('');
  let posicion = -1;
  for (const termino of terminos) {
    posicion = plano.indexOf(termino);
    if (posicion >= 0) { break; }
  }
  if (posicion < 0) { return `${limpio.slice(0, AMPLITUD_DEL_EXTRACTO * 2).trimEnd()}…`; }

  const desde = Math.max(0, posicion - AMPLITUD_DEL_EXTRACTO);
  const hasta = Math.min(limpio.length, posicion + AMPLITUD_DEL_EXTRACTO);
  return `${desde > 0 ? '…' : ''}${limpio.slice(desde, hasta).trim()}${hasta < limpio.length ? '…' : ''}`;
}

/**
 * Busca en todos los textos editables del sitio, sin tener que saber en qué página están.
 *
 * <b>POR QUÉ.</b> El sitio tiene unos trescientos textos repartidos en ocho secciones y decenas de
 * bloques. Quien ve una frase en el portal y quiere corregirla no sabe en qué sección vive, y la
 * única forma de encontrarla era abrir bloque por bloque.
 *
 * <b>BUSCA LO QUE EL VISITANTE LEE</b> —`textoVisible` devuelve lo publicado o, si nunca se
 * publicó, el texto de fábrica— y también el rótulo del campo y el nombre del bloque. No busca en
 * borradores sin publicar: esos solo los carga el servidor al abrir cada bloque.
 *
 * Todas las palabras tienen que aparecer (en cualquier orden). Primero salen los que coinciden por
 * rótulo o bloque, luego los que coinciden por lo que dicen.
 */
export function buscarTextosWeb(
  consulta: string,
  textoVisible: (clave: string) => string,
  limite = 12,
): ResultadoDeBusquedaDeTexto[] {
  const normalizada = normalizarParaBuscar(consulta);
  if (normalizada.length < MINIMO_PARA_BUSCAR) { return []; }
  const terminos = normalizada.split(' ');

  const porRotulo: ResultadoDeBusquedaDeTexto[] = [];
  const porTexto: ResultadoDeBusquedaDeTexto[] = [];

  for (const grupo of WEB_TEXT_GROUPS) {
    const pastilla = WEB_TEXT_SECTIONS.find(s => s.section === grupo.section)?.pill ?? grupo.section;
    const nombreDelBloque = normalizarParaBuscar(`${pastilla} ${grupo.label}`);

    for (const campo of grupo.fields) {
      const texto = textoVisible(campo.key);
      const rotulo = `${nombreDelBloque} ${normalizarParaBuscar(campo.label)}`;
      const contenido = normalizarParaBuscar(texto);

      const enRotulo = terminos.every(t => rotulo.includes(t));
      const enTexto = terminos.every(t => `${rotulo} ${contenido}`.includes(t));
      if (!enRotulo && !enTexto) { continue; }

      const resultado: ResultadoDeBusquedaDeTexto = {
        key: campo.key,
        groupId: grupo.id,
        groupLabel: grupo.label,
        section: grupo.section,
        sectionPill: pastilla,
        fieldLabel: campo.label,
        extracto: extractoAlrededor(texto, terminos),
        coincideEn: enRotulo ? 'rotulo' : 'texto',
      };
      (enRotulo ? porRotulo : porTexto).push(resultado);
    }
  }

  return [...porRotulo, ...porTexto].slice(0, limite);
}
