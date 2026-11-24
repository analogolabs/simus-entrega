#!/usr/bin/env node
/**
 * EL ACCESO RÁPIDO DE CUENTAS DE DEMOSTRACIÓN NO LLEGA A UN BUILD DE PRODUCCIÓN.
 *
 * El botón flotante «Cuentas de demostración» (y el atajo de cuentas de desarrollo del ingreso administrativo) son una
 * ayuda de quien prueba en su equipo. Esta prueba asegura cuatro cerrojos, y el último mira el artefacto real si existe:
 *   1  `angular.json` (producción) sustituye `arranque.ts` y `dev-accounts.ts` por sus versiones vacías.
 *   2  la versión de producción de `arranque` no importa el componente ni la configuración.
 *   3  `main.ts` solo lo pide con `!environment.production` y desde localhost / 127.0.0.1 / [::1].
 *   4  si hay `dist/simus-web/browser`, ningún archivo contiene el rótulo ni la petición a `config-demo.js`.
 *
 * USO: node trinquete/acceso-rapido-no-llega-a-produccion.prueba.mjs   (sale 1 si algún cerrojo falla)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), "utf8");
const fallos = [];
const exigir = (condicion, mensaje) => { if (!condicion) fallos.push(mensaje); };

const angular = JSON.parse(leer("angular.json"));
const reemplazos = angular.projects["simus-web"]?.architect?.build?.configurations?.production?.fileReplacements
  ?? Object.values(angular.projects)[0].architect.build.configurations.production.fileReplacements;
const conReemplazo = (de, con) => reemplazos.some(r => r.replace === de && r.with === con);
exigir(conReemplazo("src/app/dev/acceso-rapido-demo/arranque.ts", "src/app/dev/acceso-rapido-demo/arranque.production.ts"), "producción no sustituye arranque.ts");
exigir(conReemplazo("src/app/features/admin/admin-login/dev-accounts.ts", "src/app/features/admin/admin-login/dev-accounts.production.ts"), "producción no sustituye dev-accounts.ts");

const vacio = leer("src", "app", "dev", "acceso-rapido-demo", "arranque.production.ts");
exigir(!/acceso-rapido-demo\.component|acceso-rapido-demo\.config|config-demo|fetch\(/.test(vacio), "arranque.production.ts arrastra el componente, la configuración o una petición");

const principal = leer("src", "main.ts");
exigir(/!environment\.production\s*&&\s*\/\^\(localhost\|127\\\.0\\\.0\\\.1\|\\\[::1\\\]\)\$\/\.test\(location\.hostname\)\)\s*\{\s*[^}]*acceso-rapido-demo\/arranque/s.test(principal), "main.ts no condiciona el acceso rápido a desarrollo y localhost");

const dist = path.join(RAIZ, "dist", "simus-web", "browser");
if (fs.existsSync(dist)) {
  const recorrer = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? recorrer(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of recorrer(dist).filter(f => /\.(js|html)$/.test(f))) {
    const t = fs.readFileSync(f, "utf8");
    exigir(!t.includes("Cuentas de demostración") && !t.includes("config-demo.js") && !t.includes("ard-boton"), `el artefacto ${path.relative(dist, f)} contiene el acceso rápido`);
  }
  exigir(!fs.existsSync(path.join(dist, "config-demo.js")), "el artefacto trae config-demo.js");
}

if (fallos.length) { console.error("acceso rápido: FALLA\n - " + fallos.join("\n - ")); process.exit(1); }
console.log(`acceso rápido: ${fs.existsSync(dist) ? "código y artefacto" : "código (sin dist)"} sin la ayuda de demostración en producción: OK`);
