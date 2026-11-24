#!/usr/bin/env node
/**
 * CENSO DE FRONTERAS DEL FRONTEND
 * ===============================
 *
 * `core/` y `shared/` son capas transversales: no deben conocer una capacidad
 * concreta de `features/`. Este censo localiza importaciones estáticas relativas
 * que cruzan esa frontera. Es deliberadamente informativo mientras se revisan
 * las dependencias existentes; por eso los hallazgos no cambian el código de
 * salida. Un barrido imposible o vacío sí falla: no se informa nada si no se
 * pudo medir.
 *
 * Reconoce las dos formas estáticas que usa el proyecto: `import ... from` y
 * `export ... from`, además de `import('...')` con literal. No hay alias de
 * TypeScript configurados, por lo que las rutas relativas se resuelven desde
 * el archivo que las declara.
 *
 * Uso:
 *   node trinquete/trinquete-fronteras.mjs
 *   node trinquete/trinquete-fronteras.mjs --json
 *   node trinquete/trinquete-fronteras.mjs --raiz DIR
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_POR_DEFECTO = path.resolve(AQUI, '..', 'src', 'app');
const CAPAS_VIGILADAS = new Set(['core', 'shared']);

export function listarTs(raiz) {
  const salida = [];
  const pila = [raiz];
  while (pila.length > 0) {
    const actual = pila.pop();
    let entradas;
    try {
      entradas = fs.readdirSync(actual, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entrada of entradas) {
      const destino = path.join(actual, entrada.name);
      if (entrada.isSymbolicLink()) continue;
      if (entrada.isDirectory()) pila.push(destino);
      else if (entrada.isFile() && destino.endsWith('.ts') && !destino.endsWith('.spec.ts')) salida.push(destino);
    }
  }
  return salida.sort();
}

export function especificadores(texto) {
  const salida = [];
  const estaticos = /\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s*['\"]([^'\"]+)['\"]/g;
  const dinamicos = /\bimport\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  for (const patron of [estaticos, dinamicos]) {
    for (const coincidencia of texto.matchAll(patron)) salida.push(coincidencia[1]);
  }
  return salida;
}

export function medir(raiz) {
  const ficheros = listarTs(raiz);
  if (ficheros.length === 0) return { error: `No se encontro ningun .ts bajo ${raiz}.` };

  const hallazgos = [];
  for (const fichero of ficheros) {
    const relativo = path.relative(raiz, fichero).split(path.sep).join('/');
    const capa = relativo.split('/')[0];
    if (!CAPAS_VIGILADAS.has(capa)) continue;
    for (const especificador of especificadores(fs.readFileSync(fichero, 'utf8'))) {
      if (!especificador.startsWith('.')) continue;
      const destino = path.relative(raiz, path.resolve(path.dirname(fichero), especificador)).split(path.sep).join('/');
      if (destino === 'features' || destino.startsWith('features/')) {
        hallazgos.push({ archivo: relativo, capa, importacion: especificador, destino });
      }
    }
  }
  hallazgos.sort((a, b) => a.archivo.localeCompare(b.archivo) || a.importacion.localeCompare(b.importacion));
  return { ficherosEscaneados: ficheros.length, hallazgos };
}

function principal() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const indiceRaiz = args.indexOf('--raiz');
  const raiz = indiceRaiz >= 0 && args[indiceRaiz + 1] ? path.resolve(args[indiceRaiz + 1]) : RAIZ_POR_DEFECTO;
  if (!fs.existsSync(raiz)) {
    const resultado = { estado: 'RAIZ_INEXISTENTE', error: `La raiz ${raiz} no existe.` };
    if (json) console.log(JSON.stringify(resultado, null, 2)); else console.error(`CENSO DE FRONTERAS — FALLO: ${resultado.error}`);
    process.exitCode = 1;
    return;
  }
  const resultado = medir(raiz);
  if (resultado.error) {
    if (json) console.log(JSON.stringify({ estado: 'BARRIDO_VACIO', ...resultado }, null, 2)); else console.error(`CENSO DE FRONTERAS — FALLO: ${resultado.error}`);
    process.exitCode = 1;
    return;
  }
  const salida = { estado: resultado.hallazgos.length === 0 ? 'SIN_HALLAZGOS' : 'HALLAZGOS', raiz, ...resultado };
  if (json) {
    console.log(JSON.stringify(salida, null, 2));
    return;
  }
  console.log(`CENSO DE FRONTERAS — ${resultado.ficherosEscaneados} archivos TypeScript revisados`);
  if (resultado.hallazgos.length === 0) console.log('  Sin importaciones desde core/ o shared/ hacia features/.');
  else for (const hallazgo of resultado.hallazgos) console.log(`  ${hallazgo.archivo}: ${hallazgo.importacion} -> ${hallazgo.destino}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
