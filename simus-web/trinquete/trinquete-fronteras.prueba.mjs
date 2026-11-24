#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { medir } from './trinquete-fronteras.mjs';

let fallos = 0;
function comprobar(nombre, condicion) {
  if (condicion) console.log(`  ok  ${nombre}`);
  else { fallos += 1; console.error(`  FALLA  ${nombre}`); }
}

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'trinquete-fronteras-'));
try {
  fs.mkdirSync(path.join(raiz, 'core', 'services'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'shared', 'ui'), { recursive: true });
  fs.mkdirSync(path.join(raiz, 'features', 'map', 'domain'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'features', 'map', 'domain', 'modelo.ts'), 'export const modelo = 1;\n');
  fs.writeFileSync(path.join(raiz, 'core', 'services', 'prohibido.ts'), "import { modelo } from '../../features/map/domain/modelo';\nexport { modelo };\n");
  fs.writeFileSync(path.join(raiz, 'shared', 'ui', 'prohibido.ts'), "export { modelo } from '../../features/map/domain/modelo';\n");
  fs.writeFileSync(path.join(raiz, 'core', 'services', 'permitido.ts'), "import { modelo } from './local';\nexport { modelo };\n");
  fs.writeFileSync(path.join(raiz, 'core', 'services', 'ignorado.spec.ts'), "import { modelo } from '../../features/map/domain/modelo';\n");

  const resultado = medir(raiz);
  comprobar('recorre archivos TypeScript de las capas vigiladas', resultado.ficherosEscaneados === 4);
  comprobar('detecta importacion relativa desde core hacia features', resultado.hallazgos?.some(h => h.archivo === 'core/services/prohibido.ts'));
  comprobar('detecta reexportacion relativa desde shared hacia features', resultado.hallazgos?.some(h => h.archivo === 'shared/ui/prohibido.ts'));
  comprobar('no acusa rutas internas de la misma capa', !resultado.hallazgos?.some(h => h.archivo === 'core/services/permitido.ts'));
  comprobar('excluye archivos de prueba del censo de produccion', !resultado.hallazgos?.some(h => h.archivo.endsWith('.spec.ts')));
} finally {
  fs.rmSync(raiz, { recursive: true, force: true });
}

if (fallos > 0) process.exitCode = 1;
