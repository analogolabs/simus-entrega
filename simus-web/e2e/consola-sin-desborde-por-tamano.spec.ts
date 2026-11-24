import { expect, test } from '@playwright/test';

/**
 * LA CONSOLA NO DESBORDA EN NINGÚN TAMAÑO (revisión de teléfono, tableta y portátil).
 *
 * Recorre cada sección de `/administracion` en teléfono (360 y 390 de ancho, vertical y apaisado), tableta (768,
 * 820, 1024) y escritorio (1280, 1366, 1440, 1920) y comprueba dos cosas baratas y que no dependen de la siembra:
 * la PÁGINA no se desplaza en horizontal (`scrollWidth <= innerWidth`) y ningún elemento sale por la derecha de la
 * ventana salvo dentro de un contenedor que se desplaza a propósito (las tablas anchas).
 *
 * Requiere la pila levantada con la siembra de demostración (cuenta `webmaster@simus.test`, clave `admin`). @backend
 */
const TAMANOS = [
  { ancho: 360, alto: 740 }, { ancho: 390, alto: 844 }, { ancho: 844, alto: 390 },
  { ancho: 768, alto: 1024 }, { ancho: 820, alto: 1180 }, { ancho: 1024, alto: 768 },
  { ancho: 1280, alto: 720 }, { ancho: 1366, alto: 768 }, { ancho: 1440, alto: 900 }, { ancho: 1920, alto: 1080 },
];
const SECCIONES = [
  'resumen', 'solicitudes', 'festivales', 'mercados', 'procesos', 'organizaciones', 'catalogo-editorial', 'agenda',
  'noticias', 'categorias', 'banco-de-archivos', 'galeria', 'gestion-del-sitio', 'boletin', 'analisis', 'auditoria', 'usuarios', 'sistema',
];

/** Elementos cuyo borde derecho pasa de la ventana sin que un ancestro con desplazamiento horizontal los contenga. */
function buscarSalidos(): string[] {
  const ancho = window.innerWidth;
  const salidos: string[] = [];
  const contenidoEnDesplazamiento = (e: Element): boolean => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
      if (o === 'hidden' && p.getBoundingClientRect().right <= ancho + 1) return true;
    }
    return false;
  };
  document.querySelectorAll('body *').forEach((e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    if (!r.width || s.visibility === 'hidden' || s.position === 'fixed') return;
    if (r.right > ancho + 2 && r.left < ancho && !contenidoEnDesplazamiento(e)) {
      salidos.push(`${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).slice(0, 40)}`);
    }
  });
  return salidos.slice(0, 5);
}

/**
 * RECORTES: lo que un contenedor con `overflow: hidden` esconde sin que la página lo delate. Un elemento cuyo borde
 * derecho pasa del de su ancestro recortante (y ese ancestro cabe en la ventana), o un contenedor que oculta
 * contenido más ancho que él mismo. Es el fallo que `scrollWidth` no ve.
 */
function buscarRecortes(): string[] {
  const ancho = window.innerWidth;
  const etiqueta = (e: Element) => `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).trim().split(/\s+/).slice(0, 2).join('.')}`;
  const recortante = (e: Element): Element | null => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'hidden' || o === 'clip') return p;
      if (o === 'auto' || o === 'scroll') return null;
    }
    return null;
  };
  const fallos: string[] = [];
  document.querySelectorAll('body *').forEach((e) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || s.visibility === 'hidden' || s.position === 'fixed' || e.closest('.sr-only,[hidden],.foundation-sidebar')) return;
    const c = recortante(e);
    if (c) {
      const cr = c.getBoundingClientRect();
      if (cr.width && cr.right <= ancho + 2 && r.width <= ancho * 3 && (r.right > cr.right + 2 || r.left < cr.left - 2)) fallos.push(`recortado ${etiqueta(e)} en ${etiqueta(c)}`);
    }
    if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && s.textOverflow !== 'ellipsis' && ['DIV', 'SECTION', 'MAIN', 'ARTICLE', 'FORM', 'LI', 'UL', 'TD', 'TR', 'TABLE'].includes(e.tagName)) {
      fallos.push(`oculta desborde ${etiqueta(e)} (${e.scrollWidth} > ${e.clientWidth})`);
    }
  });
  return [...new Set(fallos)].slice(0, 5);
}

test.describe('Consola sin desborde horizontal por tamaño', () => {
  test.setTimeout(180_000);
  for (const t of TAMANOS) {
    test(`${t.ancho}x${t.alto}`, async ({ page }) => {
      await page.setViewportSize({ width: t.ancho, height: t.alto });
      await page.addInitScript(() => localStorage.setItem('pnmc_tour_seen_admin@pnmc.local', '1'));
      await page.goto('/administracion');
      await page.locator('input[type="email"]').fill('webmaster@simus.test');
      await page.locator('input[type="password"]').fill('admin');
      await page.getByRole('button', { name: 'Entrar al panel' }).click();
      // En teléfono la barra lateral es un cajón plegado: basta con que exista en la página.
      await page.locator('aside#navegacion-administrativa').waitFor({ state: 'attached', timeout: 30_000 });

      for (const seccion of SECCIONES) {
        await page.goto(`/administracion/${seccion}`, { waitUntil: 'domcontentloaded' });
        await page.locator('h1').first().waitFor({ timeout: 20_000 });
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
        const medida = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
        expect(medida.sw, `${seccion}: la página se desplaza en horizontal`).toBeLessThanOrEqual(medida.w);
        expect(await page.evaluate(buscarSalidos), `${seccion}: elementos fuera de la ventana`).toEqual([]);
        expect(await page.evaluate(buscarRecortes), `${seccion}: elementos recortados por un contenedor`).toEqual([]);
      }
    });
  }
});
