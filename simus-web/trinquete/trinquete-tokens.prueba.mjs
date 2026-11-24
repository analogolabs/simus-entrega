#!/usr/bin/env node
/**
 * PRUEBAS DE LA REVISIÓN DE TOKENS DE DISEÑO
 * ==========================================
 *
 * Una puerta que no puede fallar no es una puerta. Aquí se demuestra, en cada corrida, que
 * `trinquete-tokens.mjs` RECHAZA de verdad:
 *
 *   1  El contraste de WCAG se calcula bien (blanco/negro 21:1; el borde de campo, 3,14:1).
 *   2  Un cambio de marca que BAJA un contraste por debajo de la norma falla, diciendo cuál.
 *   3  Un token que desaparece, o un radio o una altura que se mueven sin decisión, fallan.
 *   4  `var(--otro)` se resuelve, y gana la última declaración (como en la hoja compilada).
 *   5  La puerta muerde: con el techo una unidad por debajo sale 1; con el exacto, 0.
 *   6  Gira en un solo sentido: `--sellar` con algo en rojo se niega; con holgura aprieta.
 *   7  Falla cerrado: sin techo, con una métrica sin declarar o sin `styles.css`, sale 1.
 *   8  El `styles.css` REAL cumple, y el techo real no se ha movido durante las pruebas.
 *
 *   node trinquete/trinquete-tokens.prueba.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { contraste, leerTokens, verificarTokens, contarEnTexto, METRICAS } from "./trinquete-tokens.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HERRAMIENTA = path.join(AQUI, "trinquete-tokens.mjs");
const TECHO_REAL = path.join(AQUI, "techo-tokens.json");
const CSS_REAL = path.resolve(AQUI, "..", "src", "styles.css");
const huellaAntes = fs.readFileSync(TECHO_REAL, "utf8");

let pasadas = 0;
let fallos = 0;
function comprobar(titulo, condicion, detalle = "") {
  if (condicion) { pasadas++; console.log(`   ok   ${titulo}`); }
  else { fallos++; console.log(`   FALLA ${titulo}`); if (detalle) console.log(`        ${String(detalle).split("\n").slice(0, 6).join("\n        ")}`); }
}

const CSS_BUENO = `
@theme static {
  --color-morado: #4C2C54;
  --color-rotulo: #667081;
  --color-valor: #27314d;
  --spacing-control-minimo: 1.5rem;
  --spacing-control: 2.25rem;
  --spacing-control-comodo: 2.75rem;
  --radius-control: 0.5rem;
  --color-borde-campo: #8892a4;
  --color-borde-campo-hover: #5f6b80;
  --color-foco: var(--color-morado);
  --anillo-foco-ancho: 2px;
  --anillo-foco-separacion: 2px;
  --color-peligro: #b42318;
  --color-peligro-suave: #fef3f2;
  --shadow-menu: 0 8px 24px rgb(0 0 0 / .14);
}
`;

console.log("\n1) El contraste de WCAG");
comprobar("blanco sobre negro da 21:1", Math.abs(contraste("#ffffff", "#000000") - 21) < 0.01);
comprobar("el borde de campo #8892a4 sobre blanco da 3,14:1 (≥ 3)", contraste("#8892a4", "#ffffff") >= 3 && contraste("#8892a4", "#ffffff") < 3.3, contraste("#8892a4", "#ffffff"));
comprobar("el borde antiguo #dfe3ea daba 1,29:1: por debajo de la norma", Math.abs(contraste("#dfe3ea", "#ffffff") - 1.29) < 0.02, contraste("#dfe3ea", "#ffffff"));
comprobar("un valor que no es hexadecimal no se mide, y lo dice (null)", contraste("rgb(0,0,0)", "#fff") === null);

console.log("\n2) Un contraste que baja de la norma falla");
comprobar("la hoja buena no tiene incumplimientos", verificarTokens(CSS_BUENO).length === 0, verificarTokens(CSS_BUENO).join("\n"));
{
  const f = verificarTokens(CSS_BUENO.replace("--color-borde-campo: #8892a4", "--color-borde-campo: #dfe3ea"));
  comprobar("un borde de campo claro falla y dice cuál", f.some((x) => x.includes("--color-borde-campo ") && x.includes("3:1")), f.join("\n"));
}
{
  const f = verificarTokens(CSS_BUENO.replace("--color-peligro: #b42318", "--color-peligro: #f87171"));
  comprobar("un rojo de error claro falla sobre blanco y sobre su fondo suave", f.filter((x) => x.includes("--color-peligro")).length === 2, f.join("\n"));
}
{
  const f = verificarTokens(CSS_BUENO.replace("--color-rotulo: #667081", "--color-rotulo: #9aa3b2"));
  comprobar("un texto de apoyo claro falla (4,5:1)", f.some((x) => x.includes("--color-rotulo")), f.join("\n"));
}

console.log("\n3) Tokens ausentes o movidos sin decisión");
comprobar("falta el radio único: lo dice",
  verificarTokens(CSS_BUENO.replace("  --radius-control: 0.5rem;\n", "")).some((x) => x.includes("Falta el token --radius-control")));
comprobar("mover el radio a 12 px falla: es una decisión de diseño",
  verificarTokens(CSS_BUENO.replace("--radius-control: 0.5rem", "--radius-control: 0.75rem")).some((x) => x.includes("--radius-control vale")));
comprobar("mover la altura normal de 36 px falla",
  verificarTokens(CSS_BUENO.replace("--spacing-control: 2.25rem", "--spacing-control: 2.5rem")).some((x) => x.includes("--spacing-control vale")));
comprobar("un color de foco que no es hexadecimal ni apunta a uno se reporta, no se ignora",
  verificarTokens(CSS_BUENO.replace("--color-foco: var(--color-morado)", "--color-foco: hsl(280 30% 25%)")).some((x) => x.includes("no es un hexadecimal")));

console.log("\n4) var() se resuelve y gana la última declaración");
{
  const { resueltos } = leerTokens("a{--x: #111111;--y: var(--x);} b{--x: #222222;}");
  comprobar("`--y: var(--x)` resuelve al último `--x`", resueltos.get("--y") === "#222222", resueltos.get("--y"));
}

{
  const { resueltos } = leerTokens(":root{--spacing-control: 2.25rem;} @media (pointer: coarse) { :root { --spacing-control: 2.75rem; } }");
  comprobar("el bloque táctil no cambia el valor de diseño de escritorio", resueltos.get("--spacing-control") === "2.25rem", resueltos.get("--spacing-control"));
}

console.log("\n5) Los literales antiguos se cuentan, no los comentarios");
{
  const m = METRICAS.find((x) => x.clave === "bordes_de_campo_sin_contraste");
  comprobar("cuenta el #dfe3ea y no el que está en un comentario", contarEnTexto("a{border:1px solid #dfe3ea} /* antes #dfe3ea */ // #dfe3ea", m) === 1);
  const u = METRICAS.find((x) => x.clave === "mayuscula_sostenida_en_css");
  comprobar("cuenta `text-transform: uppercase` y no `none`", contarEnTexto("a{text-transform: uppercase} b{text-transform:none} c{text-transform:uppercase}", u) === 2);
}

function banco(css, metricas) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trinquete-tokens-"));
  const src = path.join(dir, "src");
  fs.mkdirSync(src, { recursive: true });
  if (css !== null) fs.writeFileSync(path.join(src, "styles.css"), css, "utf8");
  fs.writeFileSync(path.join(src, "a.css"), "a{border:1px solid #dfe3ea; text-transform: uppercase}", "utf8");
  const techo = path.join(dir, "techo.json");
  if (metricas) fs.writeFileSync(techo, JSON.stringify({ metricas }, null, 2), "utf8");
  return { dir, src, techo };
}
function correr(args) {
  const r = spawnSync(process.execPath, [HERRAMIENTA, ...args], { encoding: "utf8" });
  return { codigo: r.status, salida: (r.stdout || "") + (r.stderr || "") };
}
const TECHOS_EXACTOS = { bordes_de_campo_sin_contraste: 1, radios_de_control_a_mano: 0, mayuscula_sostenida_en_css: 1 };

console.log("\n6) La puerta muerde, en los dos sentidos");
{
  const b = banco(CSS_BUENO, TECHOS_EXACTOS);
  comprobar("con el techo exacto sale 0", correr(["--raiz", b.src, "--techo", b.techo]).codigo === 0);
  fs.writeFileSync(b.techo, JSON.stringify({ metricas: { ...TECHOS_EXACTOS, bordes_de_campo_sin_contraste: 0 } }), "utf8");
  const r = correr(["--raiz", b.src, "--techo", b.techo]);
  comprobar("con el techo una unidad por debajo sale 1 y dice qué", r.codigo === 1 && r.salida.includes("#dfe3ea"), r.salida);
  fs.rmSync(b.dir, { recursive: true, force: true });
}
{
  const b = banco(CSS_BUENO.replace("--color-borde-campo: #8892a4", "--color-borde-campo: #dfe3ea"), TECHOS_EXACTOS);
  const r = correr(["--raiz", b.src, "--techo", b.techo]);
  comprobar("un contraste por debajo de la norma pone la puerta en rojo aunque los techos estén bien", r.codigo === 1 && r.salida.includes("3:1"), r.salida);
  fs.rmSync(b.dir, { recursive: true, force: true });
}

console.log("\n7) --sellar aprieta, nunca afloja");
{
  const b = banco(CSS_BUENO, { ...TECHOS_EXACTOS, radios_de_control_a_mano: 5 });
  const r = correr(["--raiz", b.src, "--techo", b.techo, "--sellar"]);
  const tras = JSON.parse(fs.readFileSync(b.techo, "utf8"));
  comprobar("con holgura aprieta (5 → 0)", r.codigo === 0 && tras.metricas.radios_de_control_a_mano === 0, r.salida);
  fs.writeFileSync(b.techo, JSON.stringify({ metricas: { ...TECHOS_EXACTOS, bordes_de_campo_sin_contraste: 0 } }), "utf8");
  const r2 = correr(["--raiz", b.src, "--techo", b.techo, "--sellar"]);
  const tras2 = JSON.parse(fs.readFileSync(b.techo, "utf8"));
  comprobar("con una métrica en rojo se niega y no toca el fichero", r2.codigo === 1 && tras2.metricas.bordes_de_campo_sin_contraste === 0, r2.salida);
  fs.rmSync(b.dir, { recursive: true, force: true });
}

console.log("\n8) Falla cerrado");
{
  const b = banco(CSS_BUENO, null);
  comprobar("sin techo sale 1", correr(["--raiz", b.src, "--techo", b.techo]).codigo === 1);
  fs.writeFileSync(b.techo, "{ no es json", "utf8");
  comprobar("con un techo corrupto sale 1", correr(["--raiz", b.src, "--techo", b.techo]).codigo === 1);
  fs.writeFileSync(b.techo, JSON.stringify({ metricas: { radios_de_control_a_mano: 0 } }), "utf8");
  const r = correr(["--raiz", b.src, "--techo", b.techo]);
  comprobar("con una métrica sin declarar sale 1 y la nombra", r.codigo === 1 && r.salida.includes("bordes_de_campo_sin_contraste"), r.salida);
  fs.rmSync(b.dir, { recursive: true, force: true });
}
{
  const b = banco(null, TECHOS_EXACTOS);
  comprobar("sin styles.css sale 1: no se pasa porque no se midió nada", correr(["--raiz", b.src, "--techo", b.techo]).codigo === 1);
  fs.rmSync(b.dir, { recursive: true, force: true });
}

console.log("\n9) El styles.css REAL");
{
  const f = verificarTokens(fs.readFileSync(CSS_REAL, "utf8"));
  comprobar("cumple los tokens y el contraste", f.length === 0, f.join("\n"));
  const r = correr([]);
  comprobar("y la revisión real sale 0", r.codigo === 0, r.salida);
}

console.log("\n10) Las pruebas no han movido el techo real");
comprobar("techo-tokens.json intacto", fs.readFileSync(TECHO_REAL, "utf8") === huellaAntes, "las pruebas han reescrito el techo de verdad; eso las invalida");

console.log(`\n${pasadas} pasadas, ${fallos} fallidas\n`);
process.exit(fallos === 0 ? 0 : 1);
