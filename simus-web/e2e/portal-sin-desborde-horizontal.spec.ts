import { expect, test, type Page } from '@playwright/test';

/**
 * EL PORTAL PÚBLICO NO DESBORDA HORIZONTALMENTE en ningún tamaño de teléfono, tableta o escritorio (revisión responsive del portal).
 *
 * <b>Qué mide.</b> En cada ruta y tamaño, el ancho del documento (`scrollWidth`) no supera el de la ventana: ninguna pantalla se
 * puede arrastrar de lado. Es la falla más visible en un teléfono (un enlace largo, una tabla sin adaptar, una cuadrícula con
 * ancho fijo) y la que más a menudo reaparece, porque en escritorio ni se nota. El caso que la motivó: la ficha de un Territorio
 * sonoro, cuya fuente es una dirección web larga sin puntos de corte, ensanchaba la página a 507 px en un teléfono de 390.
 *
 * <b>Tamaños.</b> Teléfono 360×740 y 390×844 (y apaisado 844×390), tableta 768×1024, 820×1180 y 1024×768, portátil 1280×720 y
 * 1366×768, escritorio 1440×900, 1920×1080 y ultraancho 2560×1080, más 853×480 y 1024×576, que son el 150 % y el 125 % de zoom
 * del navegador sobre un portátil de 1280.
 *
 * <b>Dos grupos.</b> Las pantallas estáticas (sin datos) corren sin pila: miden el armazón, la barra y el pie, que sí están.
 * Las que dependen de datos (listas y fichas) llevan `@backend`: descubren la primera ficha de cada lista y requieren la API
 * con la siembra de demostración; contra la demostración del usuario solo LEEN.
 */
const TAMANOS = [
  { nombre: 'teléfono 360', ancho: 360, alto: 740, tactil: true },
  { nombre: 'teléfono 390', ancho: 390, alto: 844, tactil: true },
  { nombre: 'teléfono apaisado', ancho: 844, alto: 390, tactil: true },
  { nombre: 'tableta 768', ancho: 768, alto: 1024, tactil: true },
  { nombre: 'tableta 820', ancho: 820, alto: 1180, tactil: true },
  { nombre: 'tableta apaisada', ancho: 1024, alto: 768, tactil: true },
  { nombre: 'zoom 150 %', ancho: 853, alto: 480, tactil: false },
  { nombre: 'zoom 125 %', ancho: 1024, alto: 576, tactil: false },
  { nombre: 'portátil 1280', ancho: 1280, alto: 720, tactil: false },
  { nombre: 'portátil 1366', ancho: 1366, alto: 768, tactil: false },
  { nombre: 'escritorio 1440', ancho: 1440, alto: 900, tactil: false },
  { nombre: 'escritorio 1920', ancho: 1920, alto: 1080, tactil: false },
  { nombre: 'ultraancho 2560', ancho: 2560, alto: 1080, tactil: false },
];

const RUTAS_ESTATICAS = [
  '/', '/pnmc', '/pnmc/estrategias/celebra-la-musica', '/ecosistema', '/ecosistema/agenda-de-citas', '/mapa-ecosistemico/sobre-el-mapa',
  '/politicas/tratamiento', '/ingresar', '/registro', '/ecosistema/confirmar-boletin', '/ruta-que-no-existe',
];

const LISTAS = [
  '/noticias', '/agenda', '/editorial', '/galeria', '/galeria/fotos', '/galeria/videos', '/galeria/sin-album', '/mapa-ecosistemico',
  '/ecosistema/festivales', '/ecosistema/mercados-musicales', '/ecosistema/luteria', '/ecosistema/espacios', '/ecosistema/redes',
  '/ecosistema/personas', '/ecosistema/territorios-sonoros', '/ecosistema/practicas-musicales',
];

/** Cuánto sobra a lo ancho: 0 si la pantalla cabe. */
async function sobranteHorizontal(page: Page): Promise<{ sobra: number; culpables: string[] }> {
  return page.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    const sobra = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - ancho;
    const culpables: string[] = [];
    if (sobra > 1) {
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > ancho + 1 && culpables.length < 4) culpables.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} llega a ${Math.round(r.right)} px`);
      }
    }
    return { sobra, culpables };
  });
}

/**
 * LO QUE EL DESBORDE ESCONDE: un control, título o chip que sobresale de un contenedor con `overflow: hidden` no hace crecer el
 * documento (el barrido de arriba no lo ve) pero queda cortado o inalcanzable. Es el fallo de «Perfil público» en la gestión: campos
 * en dos columnas que se salían de la tarjeta. Se ignoran lo inerte (acordeones cerrados), lo transparente y los carruseles.
 */
async function recortados(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const malos: string[] = [];
    for (const el of Array.from(document.querySelectorAll('input,select,textarea,button,a,h1,h2,h3,label,span,p,li'))) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (el.closest('[inert],[aria-hidden="true"],.sr-only,[class*="leaflet"],[class*="carousel"],[class*="carrusel"],[class*="slide"]')) continue;
      const ocultoPorOpacidad = (() => { for (let n: Element | null = el; n; n = n.parentElement) { if (parseFloat(getComputedStyle(n).opacity) === 0) return true; } return false; })();
      if (ocultoPorOpacidad) continue;
      // lo que está girado o desplazado por una transformación (años verticales de un acordeón de tarjetas) no tiene un rectángulo comparable
      if ((() => { for (let n: Element | null = el; n; n = n.parentElement) { const e = getComputedStyle(n); if (e.transform !== 'none' || e.rotate !== 'none' || e.translate !== 'none') return true; } return false; })()) continue;
      if (el.matches('span,p,li') && !(el.children.length === 0 && (el.textContent ?? '').trim().length > 0)) continue;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        // un desplazable horizontal entre el elemento y quien recorta lo hace alcanzable (pestañas que se deslizan)
        if (/(auto|scroll)/.test(cs.overflowX)) break;
        if (!/(hidden|clip)/.test(cs.overflowX)) continue;
        const q = a.getBoundingClientRect();
        if (q.width > 0 && r.left < q.right && r.right > q.left && (r.right > q.right + 2 || r.left < q.left - 2)) {
          // un texto con puntos suspensivos es un recorte deliberado
          if (cs.textOverflow === 'ellipsis' || /truncate|line-clamp/.test(String((a as HTMLElement).className)) || (cs as unknown as Record<string, string>)['webkitLineClamp'] !== 'none') break;
          malos.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} [${Math.round(r.left)}..${Math.round(r.right)}] en ${a.tagName.toLowerCase()}.${String((a as HTMLElement).className).slice(0, 40)} [${Math.round(q.left)}..${Math.round(q.right)}]`);
          break;
        }
      }
      if (malos.length >= 6) break;
    }
    return malos;
  });
}

async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

for (const t of TAMANOS) {
  test.describe(`Sin desborde horizontal: ${t.nombre} (${t.ancho}×${t.alto})`, () => {
    test.use({ viewport: { width: t.ancho, height: t.alto }, isMobile: t.tactil, hasTouch: t.tactil });

    test('las pantallas estáticas del portal caben a lo ancho', async ({ page }) => {
      test.setTimeout(180_000);
      const desbordadas: string[] = [];
      for (const ruta of RUTAS_ESTATICAS) {
        await abrir(page, ruta);
        const { sobra, culpables } = await sobranteHorizontal(page);
        if (sobra > 1) desbordadas.push(`${ruta}: sobran ${sobra} px (${culpables.join('; ')})`);
      }
      expect(desbordadas, `Pantallas que se arrastran de lado:\n${desbordadas.join('\n')}`).toEqual([]);
    });

    test('en las pantallas estáticas nada queda recortado dentro de su contenedor', async ({ page }) => {
      test.setTimeout(180_000);
      const recortes: string[] = [];
      for (const ruta of RUTAS_ESTATICAS) {
        await abrir(page, ruta);
        for (const r of await recortados(page)) recortes.push(`${ruta}: ${r}`);
      }
      expect(recortes, `Elementos cortados por su contenedor:\n${recortes.join('\n')}`).toEqual([]);
    });

    test('en las listas y las fichas con datos nada queda recortado dentro de su contenedor', { tag: '@backend' }, async ({ page }) => {
      test.setTimeout(300_000);
      const recortes: string[] = [];
      for (const ruta of LISTAS) {
        await abrir(page, ruta);
        for (const r of await recortados(page)) recortes.push(`${ruta}: ${r}`);
      }
      expect(recortes, `Elementos cortados por su contenedor:\n${recortes.join('\n')}`).toEqual([]);
    });

    test('las listas y las fichas con datos caben a lo ancho', { tag: '@backend' }, async ({ page }) => {
      test.setTimeout(300_000);
      const desbordadas: string[] = [];
      const fichas: string[] = [];
      for (const ruta of LISTAS) {
        await abrir(page, ruta);
        const r = await sobranteHorizontal(page);
        if (r.sobra > 1) desbordadas.push(`${ruta}: sobran ${r.sobra} px (${r.culpables.join('; ')})`);
        if (ruta.startsWith('/ecosistema/') || ruta === '/noticias' || ruta === '/agenda') {
          const primera = await page.evaluate((l) => {
            const hijos = Array.from(document.querySelectorAll<HTMLAnchorElement>(`main a[href^="${l}/"]`)).map(a => a.getAttribute('href') ?? '');
            return hijos.find(h => !h.includes('#') && h.split('/').length === l.split('/').length + 1) ?? null;
          }, ruta);
          if (primera) fichas.push(primera);
        }
      }
      for (const ficha of fichas) {
        await abrir(page, ficha);
        const r = await sobranteHorizontal(page);
        if (r.sobra > 1) desbordadas.push(`${ficha}: sobran ${r.sobra} px (${r.culpables.join('; ')})`);
      }
      expect(desbordadas, `Pantallas que se arrastran de lado:\n${desbordadas.join('\n')}`).toEqual([]);
    });
  });
}
