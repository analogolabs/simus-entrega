#!/usr/bin/env node
/**
 * TRINQUETE DE TEXTOS: «el Programa» NO SE DICE DE CARA A QUIEN USA SIMUS (PERF; docs/usuario/23-guia-de-estilo-de-textos.md §23.7).
 *
 * El texto visible, los mensajes del servidor y las pruebas que los citan dicen «PNMC» (Plan Nacional de Música para la
 * Convivencia), no «el Programa». Este chequeo lee las plantillas, los servicios, los endpoints, los contratos y las
 * pruebas, SIN los comentarios, y falla si reaparece «el Programa», «del Programa», «al Programa»… (o una línea de
 * plantilla que empieza por «Programa» seguida de un verbo). «Programa Nacional de …», «Programa Editorial» y los
 * identificadores (`ProgramaEditorialDto`) no cuentan.
 *
 * Uso:  node trinquete/trinquete-textos.mjs        (sale 1 si hay coincidencias)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..');
const CARPETAS = ['simus-web/src', 'simus-web/e2e', 'simus-api/src', 'simus-api/tests'];
const EXTENSIONES = ['.ts', '.html', '.cs'];
const OMITIR = ['node_modules', `${'/'}bin${'/'}`, `${'/'}obj${'/'}`];

const ARTICULO = /\b(?:el|El|EL|del|Del|al|Al|este|Este|ese|Ese|su|Su)\s+Programa\b(?!\s+(?:Nacional|Editorial|Curricular))/g;
const LINEA_QUE_EMPIEZA = /^[ \t]+Programa[ \t]+[a-záéíóúñ]/gm;

/** El texto sin comentarios (de bloque, de línea y de plantilla), conservando los saltos de línea para citar la línea. */
export function sinComentarios(texto) {
  const blanquear = coincidencia => coincidencia.replace(/[^\n]/g, ' ');
  return texto
    .replace(/<!--[\s\S]*?-->/g, blanquear)
    .replace(/\/\*[\s\S]*?\*\//g, blanquear)
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, previo) => previo + blanquear(m.slice(previo.length)));
}

/** Las coincidencias de un texto: `{ linea, fragmento }`. */
export function coincidencias(texto, esHtml = true) {
  const limpio = sinComentarios(texto);
  const salida = [];
  const buscar = (regex) => {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(limpio)) !== null) {
      const linea = limpio.slice(0, m.index).split('\n').length;
      // Una misma línea se cuenta una vez, aunque la digan dos reglas.
      if (!salida.some(previa => Math.abs(previa.linea - linea) <= 1)) salida.push({ linea, fragmento: m[0].trim().replace(/\s+/g, ' ') });
    }
  };
  buscar(ARTICULO);
  if (esHtml) buscar(LINEA_QUE_EMPIEZA);
  return salida;
}

function* archivos(carpeta) {
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (OMITIR.some(parte => ruta.includes(parte))) continue;
    const info = statSync(ruta);
    if (info.isDirectory()) yield* archivos(ruta);
    else if (EXTENSIONES.some(ext => nombre.endsWith(ext))) yield ruta;
  }
}

export function revisar(raiz = RAIZ) {
  const encontrados = [];
  for (const carpeta of CARPETAS) {
    for (const ruta of archivos(join(raiz, carpeta))) {
      const esHtml = ruta.endsWith('.html') || ruta.endsWith('.ts');
      for (const c of coincidencias(readFileSync(ruta, 'utf8'), esHtml)) encontrados.push({ ruta: relative(raiz, ruta), ...c });
    }
  }
  return encontrados;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const encontrados = revisar();
  if (encontrados.length === 0) {
    console.log('trinquete-textos: ningún «el Programa» en textos de cara al usuario.');
  } else {
    console.error('trinquete-textos: se dice «el Programa» donde corresponde «PNMC» (docs/usuario/23-guia-de-estilo-de-textos.md):');
    for (const e of encontrados) console.error(`  ${e.ruta}:${e.linea}  ${e.fragmento}`);
    process.exit(1);
  }
}
