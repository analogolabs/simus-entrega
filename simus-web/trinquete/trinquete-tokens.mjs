#!/usr/bin/env node
/**
 * REVISIÓN DE LOS TOKENS DE DISEÑO (UI-B)
 * =============================================
 *
 * Hermana de `trinquete-interfaz.mjs`. Vigila dos cosas que ese no puede ver porque viven en la hoja
 * de estilos y no en las plantillas:
 *
 *   1  LOS TOKENS DE CONTROL EXISTEN Y CUMPLEN SU CONTRASTE. `styles.css` declara el radio único, el
 *      borde de campo, el anillo de foco y los colores con función; aquí se lee ese fichero (no se
 *      repiten los valores) y se calcula el contraste de WCAG 2.2:
 *          · borde de campo, y su estado hover, sobre blanco ........ ≥ 3:1  (1.4.11, contorno)
 *          · anillo de foco sobre blanco ............................ ≥ 3:1  (2.4.11)
 *          · peligro / error sobre blanco y sobre su fondo suave .... ≥ 4,5:1 (1.4.3, texto)
 *          · texto de apoyo (`rotulo`) y de valor sobre blanco ...... ≥ 4,5:1
 *      Un cambio de marca que bajara cualquiera de ellos por debajo de la norma falla aquí, en CI,
 *      y no se descubre meses después midiendo una pantalla.
 *
 *   2  LOS LITERALES ANTIGUOS NO VUELVEN. Cuenta, en el CSS y en los `styles:` de los componentes:
 *          · `bordes_de_campo_sin_contraste`: el `#dfe3ea` (1,29:1) que usaban los campos;
 *          · `radios_de_control_a_mano`: el `.7rem` que usaban campos y desplegables;
 *          · `mayuscula_sostenida_en_css`: `text-transform: uppercase`.
 *      Son techos que SOLO BAJAN (`--sellar` aprieta, nunca afloja), como en el trinquete de
 *      interfaz, y se guardan en `trinquete/techo-tokens.json`. Falla cerrado: sin techo, o con una
 *      métrica sin declarar, sale 1.
 *
 * USO:
 *   node trinquete/trinquete-tokens.mjs                verificar (lo que corre el CI)
 *   node trinquete/trinquete-tokens.mjs --sellar       apretar tras pagar deuda
 *   node trinquete/trinquete-tokens.mjs --json         salida para máquinas
 *   node trinquete/trinquete-tokens.mjs --raiz DIR     apuntar a otro `src` (pruebas)
 *   node trinquete/trinquete-tokens.mjs --techo FICHERO
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_POR_DEFECTO = path.resolve(AQUI, "..", "src");
const FICHERO_TECHO = path.join(AQUI, "techo-tokens.json");

// ── 1) Los tokens y su contraste ────────────────────────────────────────────────────────────────────

/** Los tokens que tienen que existir en `styles.css`. */
export const TOKENS_OBLIGATORIOS = [
  "--radius-control", "--color-borde-campo", "--color-borde-campo-hover", "--color-foco",
  "--anillo-foco-ancho", "--anillo-foco-separacion", "--color-peligro", "--color-peligro-suave",
  "--shadow-menu", "--color-rotulo", "--color-valor",
  "--spacing-control-minimo", "--spacing-control", "--spacing-control-comodo",
];

/** Los valores que NO se pueden mover sin una decisión de diseño: radio y alturas. */
export const VALORES_FIJOS = {
  "--radius-control": "0.5rem",
  "--spacing-control-minimo": "1.5rem",
  "--spacing-control": "2.25rem",
  "--spacing-control-comodo": "2.75rem",
  "--anillo-foco-ancho": "2px",
};

/** Pares (primer plano, fondo) con el contraste mínimo que la norma exige. */
export const PARES_DE_CONTRASTE = [
  { primero: "--color-borde-campo", fondo: "#ffffff", minimo: 3, norma: "1.4.11 contorno del componente" },
  { primero: "--color-borde-campo-hover", fondo: "#ffffff", minimo: 3, norma: "1.4.11 contorno del componente" },
  { primero: "--color-foco", fondo: "#ffffff", minimo: 3, norma: "2.4.11 anillo de foco" },
  { primero: "--color-peligro", fondo: "#ffffff", minimo: 4.5, norma: "1.4.3 texto" },
  { primero: "--color-peligro", fondo: "--color-peligro-suave", minimo: 4.5, norma: "1.4.3 texto" },
  { primero: "--color-rotulo", fondo: "#ffffff", minimo: 4.5, norma: "1.4.3 texto" },
  { primero: "--color-valor", fondo: "#ffffff", minimo: 4.5, norma: "1.4.3 texto" },
];

/**
 * Lee las propiedades personalizadas de un CSS. Gana la ÚLTIMA declaración de cada nombre, que es la
 * que de verdad llega a la hoja compilada; y `var(--otro)` se resuelve contra lo ya leído.
 */
export function leerTokens(css) {
  // EL AJUSTE TÁCTIL NO ES UN VALOR DE DISEÑO NUEVO: con `@media (pointer: coarse)` la altura de trabajo pasa de 36 a 44 px (el paso
  // «cómodo» que ya existe). Se lee el valor de ESCRITORIO, que es el que fija docs/desarrollo/30-consola-y-acceso.md §30.6; el bloque táctil se ignora a propósito.
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media\s*\(pointer:\s*coarse\)\s*\{[^{}]*\{[^{}]*\}\s*\}/g, "");
  const tokens = new Map();
  for (const m of sinComentarios.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) tokens.set(m[1], m[2].trim());
  const resolver = (valor, profundidad = 0) => {
    const v = /^var\((--[\w-]+)\)$/.exec(valor);
    return v && profundidad < 5 && tokens.has(v[1]) ? resolver(tokens.get(v[1]), profundidad + 1) : valor;
  };
  return { crudos: tokens, resueltos: new Map([...tokens].map(([k, v]) => [k, resolver(v)])) };
}

function aRgb(color) {
  const c = color.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c);
  if (!hex) return null;
  const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Luminancia relativa de WCAG. */
export function luminancia(rgb) {
  const [r, g, b] = rgb.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste entre dos colores hexadecimales. `null` si alguno no es hexadecimal. */
export function contraste(a, b) {
  const ra = aRgb(a), rb = aRgb(b);
  if (!ra || !rb) return null;
  const [mayor, menor] = [luminancia(ra), luminancia(rb)].sort((x, y) => y - x);
  return (mayor + 0.05) / (menor + 0.05);
}

/** Verifica los tokens de una hoja de estilos y devuelve la lista de incumplimientos. */
export function verificarTokens(css) {
  const { resueltos } = leerTokens(css);
  const fallos = [];
  for (const t of TOKENS_OBLIGATORIOS) if (!resueltos.has(t)) fallos.push(`Falta el token ${t} en styles.css.`);
  for (const [t, esperado] of Object.entries(VALORES_FIJOS)) {
    if (resueltos.has(t) && resueltos.get(t) !== esperado) {
      fallos.push(`${t} vale «${resueltos.get(t)}» y debe valer «${esperado}»: moverlo es una decisión de diseño (docs/desarrollo/30-consola-y-acceso.md §30.6).`);
    }
  }
  const resolverColor = (n) => (n.startsWith("#") ? n : resueltos.get(n));
  for (const par of PARES_DE_CONTRASTE) {
    const p = resolverColor(par.primero), f = resolverColor(par.fondo);
    if (!p || !f) continue; // la ausencia ya se reportó arriba
    const razon = contraste(p, f);
    if (razon === null) {
      fallos.push(`${par.primero} («${p}») o su fondo («${f}») no es un hexadecimal: la revisión no puede medir el contraste.`);
    } else if (razon < par.minimo) {
      fallos.push(`${par.primero} sobre ${par.fondo} da ${razon.toFixed(2)}:1 y la norma (${par.norma}) pide ${par.minimo}:1.`);
    }
  }
  return fallos;
}

// ── 2) Los literales antiguos ───────────────────────────────────────────────────────────────────────

export const METRICAS = [
  {
    clave: "bordes_de_campo_sin_contraste",
    titulo: "borde de campo #dfe3ea (1,29:1 sobre blanco)",
    porque: "El borde de un campo debe dar 3:1 (WCAG 1.4.11). Usa `var(--color-borde-campo)`.",
    patron: /#dfe3ea\b/gi,
  },
  {
    clave: "radios_de_control_a_mano",
    titulo: "radio de control escrito a mano (.7rem)",
    porque: "Todo control usa `var(--radius-control)` (8 px). Cinco radios distintos era un hallazgo del barrido.",
    patron: /border-radius\s*:\s*0?\.7rem/gi,
  },
  {
    clave: "mayuscula_sostenida_en_css",
    titulo: "`text-transform: uppercase` en hojas de estilo",
    porque: "La guía de estilo (docs/usuario/23-guia-de-estilo-de-textos.md) pide mayúscula inicial solo al comienzo de la frase; las siglas ya se escriben en mayúscula.",
    patron: /text-transform\s*:\s*uppercase/gi,
  },
];

/** Cuenta las metricas sobre el texto de un fichero CSS o de un componente. */
export function contarEnTexto(texto, metrica) {
  const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  return (sinComentarios.match(metrica.patron) ?? []).length;
}

function ficheros(dir, salida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") ficheros(ruta, salida); }
    else if (/\.(css|ts)$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) salida.push(ruta);
  }
  return salida;
}

export function medir(raiz) {
  const totales = Object.fromEntries(METRICAS.map((m) => [m.clave, 0]));
  const lista = ficheros(raiz);
  for (const f of lista) {
    const texto = fs.readFileSync(f, "utf8");
    // En un .ts solo cuentan los `styles:` (CSS en línea): se leen los literales con acento grave y
    // los de comillas. Aquí basta con contar sobre el fichero entero: un `.7rem` o un `#dfe3ea` en TS
    // fuera de un `styles:` es, igualmente, un literal de diseño que no debe repetirse.
    for (const m of METRICAS) totales[m.clave] += contarEnTexto(texto, m);
  }
  return { totales, ficheros: lista.length };
}

// ── Programa ────────────────────────────────────────────────────────────────────────────────────────

function salirCon(codigo, mensaje) { (codigo === 0 ? console.log : console.error)(mensaje); process.exit(codigo); }

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const args = process.argv.slice(2);
  const bandera = (n) => args.includes(n);
  const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const raiz = path.resolve(valor("--raiz") ?? RAIZ_POR_DEFECTO);
  const ficheroTecho = valor("--techo") ?? FICHERO_TECHO;

  const hoja = path.join(raiz, "styles.css");
  if (!fs.existsSync(hoja)) salirCon(1, `REVISIÓN DE TOKENS: no existe ${hoja}. Falla cerrado: una puerta que no midió nada no es una puerta.`);
  const fallosDeTokens = verificarTokens(fs.readFileSync(hoja, "utf8"));

  let techo;
  try { techo = JSON.parse(fs.readFileSync(ficheroTecho, "utf8")); }
  catch (e) { salirCon(1, `REVISIÓN DE TOKENS: no se pudo leer el techo (${ficheroTecho}). ${e.message}\nFalla cerrado a propósito: sin techo no hay puerta.`); }
  if (!techo || typeof techo.metricas !== "object") salirCon(1, `REVISIÓN DE TOKENS: el techo (${ficheroTecho}) no tiene un objeto "metricas". Falla cerrado.`);
  const faltantes = METRICAS.filter((m) => typeof techo.metricas[m.clave] !== "number");
  if (faltantes.length) salirCon(1, `REVISIÓN DE TOKENS: el techo no declara ${faltantes.map((m) => m.clave).join(", ")}. Falla cerrado.`);

  const { totales, ficheros: n } = medir(raiz);
  if (n === 0) salirCon(1, "REVISIÓN DE TOKENS: el barrido no encontró ni un fichero .css/.ts. Falla cerrado.");

  const filas = METRICAS.map((m) => ({ clave: m.clave, titulo: m.titulo, valor: totales[m.clave], techo: techo.metricas[m.clave] }));
  const enRojo = filas.filter((f) => f.valor > f.techo);
  const holgadas = filas.filter((f) => f.valor < f.techo);

  if (bandera("--json")) {
    console.log(JSON.stringify({ tokens_en_rojo: fallosDeTokens, filas, ficheros: n }, null, 2));
    process.exit(fallosDeTokens.length || enRojo.length ? 1 : 0);
  }

  if (bandera("--sellar")) {
    if (fallosDeTokens.length || enRojo.length) {
      salirCon(1, "REVISIÓN DE TOKENS: no se sella con algo en rojo. El techo gira en un solo sentido: aprieta, nunca afloja.");
    }
    const cambios = [];
    for (const f of holgadas) { cambios.push(`${f.clave} ${f.techo} -> ${f.valor}`); techo.metricas[f.clave] = f.valor; }
    techo.medido_en = new Date().toISOString();
    fs.writeFileSync(ficheroTecho, JSON.stringify(techo, null, 2) + "\n", "utf8");
    salirCon(0, cambios.length ? `Techo apretado: ${cambios.join(", ")}.` : "Nada que apretar.");
  }

  console.log("REVISIÓN DE TOKENS DE DISEÑO");
  console.log(`  tokens obligatorios y contraste: ${fallosDeTokens.length === 0 ? "ok" : `${fallosDeTokens.length} incumplimiento(s)`}`);
  for (const f of fallosDeTokens) console.log(`    ✘ ${f}`);
  for (const f of filas) console.log(`  ${f.valor > f.techo ? "ROJO   " : f.valor < f.techo ? "holgura" : "ok     "} ${f.clave.padEnd(34)} ${String(f.valor).padStart(4)} <= ${f.techo}`);
  if (fallosDeTokens.length || enRojo.length) {
    for (const f of enRojo) {
      const m = METRICAS.find((x) => x.clave === f.clave);
      console.error(`\n✘ ${m.titulo}: ${f.valor} > ${f.techo}. ${m.porque}`);
    }
    process.exit(1);
  }
  if (holgadas.length) console.log("\nHay holgura: `node trinquete/trinquete-tokens.mjs --sellar` aprieta el techo.");
}
