// Genera las imágenes de la siembra de demostración completa.
//
//   cd simus-web && node tools/generar-imagenes-demo.mjs
//
// POR QUÉ SE DIBUJAN Y NO SE DESCARGAN. La demostración no puede llevar fotos de terceros: ni
// derechos que verificar ni personas reales retratadas. Cada imagen es una ilustración SVG
// —afiches, emblemas y retratos abstractos— que Chromium (Playwright) rasteriza a JPEG. El
// resultado se versiona en `simus-database/seed/demo-imagenes/` y la siembra lo carga en el Banco de
// archivos; este guion solo hace falta para cambiarlas.
//
// Escribe también `imagenes.tsv` (archivo, ancho, alto, texto alternativo, pie), que lee
// `scripts/demo/sembrar-demo.sh` para llenar `dbo.Archivos`.

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESTINO = join(RAIZ, 'simus-database', 'seed', 'demo-imagenes');
mkdirSync(DESTINO, { recursive: true });

// Generador pseudoaleatorio con semilla: la misma imagen dos veces seguidas.
function azar(semilla) {
  let s = 0;
  for (const c of semilla) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Afiche: fondo en degradado, ondas sonoras, círculos de tambor y el título. */
function afiche({ clave, ancho, alto, colores, titulo, subtitulo, linea }) {
  const r = azar(clave);
  const [a, b, c, d] = colores;
  let figuras = '';
  for (let i = 0; i < 9; i++) {
    const cx = r() * ancho, cy = r() * alto * 0.7, rad = 30 + r() * ancho * 0.22;
    figuras += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="${i % 2 ? c : d}" opacity="${(0.12 + r() * 0.25).toFixed(2)}"/>`;
  }
  let ondas = '';
  for (let j = 0; j < 6; j++) {
    const y0 = alto * (0.55 + j * 0.045);
    let p = `M0 ${y0.toFixed(0)}`;
    for (let x = 0; x <= ancho; x += ancho / 12) {
      p += ` Q ${(x + ancho / 24).toFixed(0)} ${(y0 - 30 - r() * 50).toFixed(0)} ${(x + ancho / 12).toFixed(0)} ${y0.toFixed(0)}`;
    }
    ondas += `<path d="${p}" fill="none" stroke="${j % 2 ? c : '#ffffff'}" stroke-width="${3 + j}" opacity="0.55"/>`;
  }
  // La escala sale del lado corto: en un 16:9 el ancho haría el título enorme.
  const base = Math.min(ancho, alto * 0.75);
  const tam = Math.round(base / (titulo.length > 22 ? 13 : 10));
  const lineas = partir(titulo, titulo.length > 22 ? 18 : 14);
  const texto = lineas.map((l, i) =>
    `<text x="${ancho * 0.07}" y="${alto * 0.78 + i * tam * 1.05}" font-family="Georgia, serif" font-weight="700" font-size="${tam}" fill="#ffffff">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>${figuras}${ondas}
  <rect x="0" y="${alto * 0.7}" width="${ancho}" height="${alto * 0.3}" fill="#000" opacity="0.28"/>
  ${texto}
  <text x="${ancho * 0.07}" y="${alto * 0.12}" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(base / 26)}" letter-spacing="3" fill="#ffffff">${esc(subtitulo.toUpperCase())}</text>
  <text x="${ancho * 0.07}" y="${alto * 0.95}" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(base / 34)}" fill="#ffffff" opacity="0.9">${esc(linea)}</text>
</svg>`;
}

/** Emblema de organización: anillo, iniciales y nombre corto. */
function emblema({ clave, colores, iniciales, nombre }) {
  const [a, b, c] = colores;
  const r = azar(clave);
  let rayos = '';
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2, largo = 40 + r() * 50;
    const x1 = 256 + Math.cos(ang) * 170, y1 = 256 + Math.sin(ang) * 170;
    const x2 = 256 + Math.cos(ang) * (170 + largo), y2 = 256 + Math.sin(ang) * (170 + largo);
    rayos += `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="${a}"/>${rayos}
  <circle cx="256" cy="256" r="160" fill="${b}"/>
  <circle cx="256" cy="256" r="140" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.7"/>
  <text x="256" y="290" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="104" fill="#ffffff">${esc(iniciales)}</text>
  <text x="256" y="345" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="2" fill="#ffffff">${esc(nombre.toUpperCase())}</text>
</svg>`;
}

/** Retrato abstracto: silueta de busto sobre fondo de color, sin rasgos de nadie. */
function retrato({ colores, instrumento }) {
  const [a, b, c] = colores;
  const objeto = {
    guitarra: `<ellipse cx="350" cy="380" rx="70" ry="85" fill="${c}"/><rect x="340" y="190" width="20" height="150" fill="${c}"/>`,
    tambor: `<rect x="300" y="330" width="130" height="110" rx="14" fill="${c}"/><ellipse cx="365" cy="330" rx="65" ry="20" fill="#ffffff" opacity="0.8"/>`,
    flauta: `<rect x="280" y="250" width="190" height="16" rx="8" fill="${c}" transform="rotate(-25 375 258)"/>`,
    voz: `<circle cx="370" cy="250" r="30" fill="${c}"/><rect x="362" y="275" width="16" height="120" fill="${c}"/>`,
  }[instrumento];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480">
  <defs><radialGradient id="f" cx="0.3" cy="0.3" r="0.9"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs>
  <rect width="480" height="480" fill="url(#f)"/>
  <circle cx="200" cy="170" r="78" fill="#ffffff" opacity="0.92"/>
  <path d="M60 480 C 70 320, 330 320, 340 480 Z" fill="#ffffff" opacity="0.92"/>
  ${objeto}
</svg>`;
}

function partir(texto, ancho) {
  const palabras = texto.split(' ');
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    if ((actual + ' ' + p).trim().length > ancho && actual) { lineas.push(actual); actual = p; }
    else actual = (actual + ' ' + p).trim();
  }
  if (actual) lineas.push(actual);
  return lineas;
}

const CARIBE = ['#0b5563', '#1d8a8a', '#f2b134', '#ef6f3c'];
const MACIZO = ['#2d3a1f', '#6b8f3c', '#d9c36a', '#b5502e'];
const LLANO = ['#7a3b12', '#d07a2a', '#f4d27a', '#3f6e2a'];
const PACIFICO = ['#122b49', '#2e6e8e', '#9ad1d4', '#e8a33d'];
const BANDAS = ['#40214f', '#8a3f78', '#f0c05a', '#d9534f'];
const PROGRAMA = ['#1f2a44', '#3c5a99', '#f6c85f', '#6fb07f'];

/** Las imágenes: archivo, tamaño, dibujo, texto alternativo y pie. */
const IMAGENES = [
  // Emblemas de organización (foto de perfil).
  { archivo: 'org-cantaclaro.jpg', ancho: 512, alto: 512, svg: emblema({ clave: 'cc', colores: MACIZO, iniciales: 'CC', nombre: 'Cantaclaro' }),
    alt: 'Emblema de la Corporación Cultural Cantaclaro: iniciales CC en un círculo verde rodeado de rayos dorados.', pie: 'Emblema de la Corporación Cultural Cantaclaro.' },
  { archivo: 'org-sonora-caribe.jpg', ancho: 512, alto: 512, svg: emblema({ clave: 'sc', colores: CARIBE, iniciales: 'SC', nombre: 'Sonora Caribe' }),
    alt: 'Emblema de la Fundación Sonora del Caribe: iniciales SC sobre un círculo turquesa con rayos amarillos.', pie: 'Emblema de la Fundación Sonora del Caribe.' },
  { archivo: 'org-llano-adentro.jpg', ancho: 512, alto: 512, svg: emblema({ clave: 'la', colores: LLANO, iniciales: 'LA', nombre: 'Llano Adentro' }),
    alt: 'Emblema del Colectivo Llano Adentro: iniciales LA en un círculo terracota con rayos claros.', pie: 'Emblema del Colectivo Llano Adentro.' },
  { archivo: 'org-bandas-oriente.jpg', ancho: 512, alto: 512, svg: emblema({ clave: 'bo', colores: BANDAS, iniciales: 'BO', nombre: 'Bandas del Oriente' }),
    alt: 'Emblema de la Asociación de Bandas del Oriente: iniciales BO en un círculo morado con rayos dorados.', pie: 'Emblema de la Asociación de Bandas del Oriente.' },
  // Retratos abstractos para los perfiles públicos.
  { archivo: 'persona-lucia.jpg', ancho: 480, alto: 480, svg: retrato({ colores: ['#f3d9a4', '#c9734a', '#5b3a1e'], instrumento: 'voz' }),
    alt: 'Ilustración abstracta de una persona con un micrófono, sobre fondo ocre.', pie: 'Retrato ilustrado de Lucía Ramírez.' },
  { archivo: 'persona-andres.jpg', ancho: 480, alto: 480, svg: retrato({ colores: ['#bfe3d0', '#3f7f6a', '#2a2a2a'], instrumento: 'tambor' }),
    alt: 'Ilustración abstracta de una persona junto a un tambor, sobre fondo verde.', pie: 'Retrato ilustrado de Andrés Muñoz.' },
  { archivo: 'persona-camilo.jpg', ancho: 480, alto: 480, svg: retrato({ colores: ['#f6e1b8', '#d07a2a', '#6b3410'], instrumento: 'guitarra' }),
    alt: 'Ilustración abstracta de una persona con un cuatro llanero, sobre fondo naranja.', pie: 'Retrato ilustrado de Camilo Rojas.' },
  { archivo: 'persona-valentina.jpg', ancho: 480, alto: 480, svg: retrato({ colores: ['#d6e4f5', '#4a6fa5', '#1d2d44'], instrumento: 'flauta' }),
    alt: 'Ilustración abstracta de una persona tocando una flauta, sobre fondo azul.', pie: 'Retrato ilustrado de Valentina Ocampo.' },
  // Participantes de la agenda de citas del Mercado Musical del Valle (AGE2): retratos abstractos y emblemas, sin personas reales.
  { archivo: 'persona-jose.jpg', ancho: 480, alto: 480, svg: retrato({ colores: ['#cfe8f3', '#2e7fa3', '#1b3a4b'], instrumento: 'tambor' }),
    alt: 'Ilustración abstracta de una persona junto a un tambor alegre, sobre fondo azul claro.', pie: 'Retrato ilustrado de José Caicedo.' },
  { archivo: 'persona-mariana.jpg', ancho: 480, alto: 480, svg: retrato({ colores: ['#fbd5d5', '#c2556a', '#5a1f2c'], instrumento: 'voz' }),
    alt: 'Ilustración abstracta de una persona cantando con un micrófono, sobre fondo rosado.', pie: 'Retrato ilustrado de Mariana Palacios.' },
  { archivo: 'persona-diana.jpg', ancho: 480, alto: 480, svg: retrato({ colores: ['#e6dcf7', '#7a55b8', '#2d1b4e'], instrumento: 'flauta' }),
    alt: 'Ilustración abstracta de una persona con una flauta, sobre fondo violeta.', pie: 'Retrato ilustrado de Diana Zapata.' },
  { archivo: 'org-festival-costa.jpg', ancho: 512, alto: 512, svg: emblema({ clave: 'fc', colores: CARIBE, iniciales: 'FC', nombre: 'Festival de la Costa' }),
    alt: 'Emblema del Festival de la Costa: iniciales FC sobre un círculo turquesa con rayos amarillos.', pie: 'Emblema del Festival de la Costa.' },
  { archivo: 'org-sala-del-mar.jpg', ancho: 512, alto: 512, svg: emblema({ clave: 'sm', colores: PACIFICO, iniciales: 'SM', nombre: 'Sala del Mar' }),
    alt: 'Emblema de la Sala del Mar: iniciales SM en un círculo azul profundo con rayos dorados.', pie: 'Emblema de la Sala del Mar.' },
  // Afiches de las ediciones del Festival de Músicas del Macizo.
  ...[['2023', 'XI edición · Popayán'], ['2024', 'XII edición · Popayán'], ['2025', 'XIII edición · Cancelada'], ['2026', 'XIV edición · Popayán']].map(([anio, linea]) => ({
    archivo: `afiche-macizo-${anio}.jpg`, ancho: 720, alto: 960,
    svg: afiche({ clave: `macizo${anio}`, ancho: 720, alto: 960, colores: MACIZO, titulo: 'Festival de Músicas del Macizo', subtitulo: `Edición ${anio}`, linea }),
    alt: `Afiche ilustrado del Festival de Músicas del Macizo ${anio}: montañas verdes, ondas sonoras y el título en letras blancas.`,
    pie: `Afiche de la edición ${anio} del Festival de Músicas del Macizo.` })),
  { archivo: 'afiche-chirimias-2026.jpg', ancho: 720, alto: 960,
    svg: afiche({ clave: 'chirimias', ancho: 720, alto: 960, colores: PACIFICO, titulo: 'Encuentro de Chirimías del Cauca', subtitulo: 'Primera edición', linea: 'Timbío · Cauca' }),
    alt: 'Afiche ilustrado del Encuentro de Chirimías del Cauca en tonos azules con ondas sonoras.', pie: 'Afiche del Encuentro de Chirimías del Cauca.' },
  { archivo: 'afiche-gaitas-2025.jpg', ancho: 720, alto: 960,
    svg: afiche({ clave: 'gaitas', ancho: 720, alto: 960, colores: CARIBE, titulo: 'Festival de Gaitas y Tambores de la Sierra', subtitulo: 'Edición 2025', linea: 'Santa Marta · Magdalena' }),
    alt: 'Afiche ilustrado del Festival de Gaitas y Tambores de la Sierra con círculos turquesa y amarillos.', pie: 'Afiche del Festival de Gaitas y Tambores de la Sierra.' },
  { archivo: 'afiche-bullerengue-2026.jpg', ancho: 720, alto: 960,
    svg: afiche({ clave: 'bullerengue', ancho: 720, alto: 960, colores: ['#4a1d3f', '#c0476b', '#f7b267', '#f4845f'], titulo: 'Festival Bullerengue al Mar', subtitulo: 'Edición 2026', linea: 'Ciénaga · Magdalena' }),
    alt: 'Afiche ilustrado del Festival Bullerengue al Mar en tonos fucsia y naranja.', pie: 'Afiche del Festival Bullerengue al Mar.' },
  { archivo: 'afiche-mercado-suroccidente.jpg', ancho: 720, alto: 960,
    svg: afiche({ clave: 'mercado', ancho: 720, alto: 960, colores: ['#263238', '#546e7a', '#ffca28', '#8d6e63'], titulo: 'Mercado de Músicas del Suroccidente', subtitulo: 'Rueda de negocios', linea: 'Popayán · Cauca' }),
    alt: 'Afiche ilustrado del Mercado de Músicas del Suroccidente en grises y amarillo.', pie: 'Afiche del Mercado de Músicas del Suroccidente.' },
  // Imágenes de noticias (16:9).
  ...[
    ['noticia-convocatoria', 'Convocatoria abierta', 'Estímulos para festivales', PROGRAMA],
    ['noticia-macizo', 'El Macizo suena', 'Crónica de festival', MACIZO],
    ['noticia-formacion', 'Escuelas de música', 'Formación territorial', PACIFICO],
    ['noticia-memoria', 'Memoria sonora', 'Archivo y patrimonio', LLANO],
    ['noticia-bandas', 'Bandas en encuentro', 'Circulación regional', BANDAS],
  ].map(([clave, titulo, subtitulo, colores]) => ({
    archivo: `${clave}.jpg`, ancho: 1200, alto: 675,
    svg: afiche({ clave, ancho: 1200, alto: 675, colores, titulo, subtitulo, linea: 'Ilustración de demostración · SIMUS' }),
    alt: `Ilustración con ondas sonoras y círculos de color y el texto «${titulo}».`, pie: `${titulo}: ilustración de la noticia.` })),
  // Imágenes de eventos de la Agenda (16:9).
  ...[
    ['evento-taller-marimba', 'Taller de marimba', 'Formación', PACIFICO],
    ['evento-concierto-cierre', 'Concierto de cierre', 'Conciertos', MACIZO],
    ['evento-conversatorio', 'Conversatorio', 'Encuentros y diálogos', PROGRAMA],
    ['evento-rueda-negocios', 'Rueda de negocios', 'Mercado', ['#263238', '#546e7a', '#ffca28', '#8d6e63']],
  ].map(([clave, titulo, subtitulo, colores]) => ({
    archivo: `${clave}.jpg`, ancho: 1200, alto: 675,
    svg: afiche({ clave, ancho: 1200, alto: 675, colores, titulo, subtitulo, linea: 'Ilustración de demostración · SIMUS' }),
    alt: `Ilustración del evento «${titulo}» con ondas sonoras de colores.`, pie: `${titulo}: imagen del evento.` })),
  // Portadas del Catálogo Editorial.
  { archivo: 'portada-cancionero-macizo.jpg', ancho: 600, alto: 800,
    svg: afiche({ clave: 'cancionero', ancho: 600, alto: 800, colores: MACIZO, titulo: 'Cancionero del Macizo', subtitulo: 'Repertorio', linea: 'Corporación Cultural Cantaclaro' }),
    alt: 'Portada ilustrada del Cancionero del Macizo, en verdes y ocres con el título en blanco.', pie: 'Portada del Cancionero del Macizo.' },
  { archivo: 'portada-cartilla-chirimia.jpg', ancho: 600, alto: 800,
    svg: afiche({ clave: 'cartilla', ancho: 600, alto: 800, colores: PACIFICO, titulo: 'Cartilla de chirimía', subtitulo: 'Formación', linea: 'Iniciación instrumental' }),
    alt: 'Portada ilustrada de la Cartilla de chirimía, en azules con el título en blanco.', pie: 'Portada de la Cartilla de chirimía.' },
];

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
const filas = [];
let total = 0;
for (const img of IMAGENES) {
  await pagina.setViewportSize({ width: img.ancho, height: img.alto });
  await pagina.setContent(`<html><body style="margin:0">${img.svg}</body></html>`);
  const ruta = join(DESTINO, img.archivo);
  await pagina.screenshot({ path: ruta, type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: img.ancho, height: img.alto } });
  const peso = statSync(ruta).size;
  total += peso;
  if (peso > 150 * 1024) throw new Error(`${img.archivo} pesa ${peso} bytes: más de 150 KB.`);
  filas.push([img.archivo, img.ancho, img.alto, img.alt, img.pie].join('\t'));
}
await navegador.close();
writeFileSync(join(DESTINO, 'imagenes.tsv'),
  ['archivo\tancho\talto\ttexto_alternativo\tpie', ...filas].join('\n') + '\n');
console.log(`${IMAGENES.length} imágenes, ${(total / 1024).toFixed(0)} KB en total.`);
