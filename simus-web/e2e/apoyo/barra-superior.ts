import { Page } from '@playwright/test';

/**
 * Medición de la barra superior y del primer contenido visible (la usan `barra-superior-no-tapa-contenido.spec.ts` y lo que
 * necesite saber si algo queda bajo la barra fija).
 */
/** Un texto puede dibujar su caja unos píxeles por encima de su línea (fuentes altas): eso no es quedar bajo la barra. */
export const TOLERANCIA_DE_TEXTO = 6;

export interface Medida { barraAbajo: number; contenidoArriba: number | null; muestra: string; }

/** Borde inferior de la barra superior y alto del primer contenido visible, con la página arriba del todo. */
export async function medir(page: Page): Promise<Medida> {
  // «Arriba del todo» de verdad: algunas pantallas se desplazan solas a un apartado (p. ej. `/responsable`) y con
  // `scroll-behavior: smooth` un `scrollTo` normal mediría a medio camino.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.waitForTimeout(200);
  }
  return page.evaluate(() => {
    const ancho = window.innerWidth;
    // LA BARRA: lo fijo o pegado arriba, ancho y con alto de barra. Puede ser la del portal o la cabecera de gestión.
    let barraAbajo = 0;
    const barras: Element[] = [];
    for (const e of Array.from(document.querySelectorAll('header, nav, app-navigation, div'))) {
      const estilo = getComputedStyle(e);
      if (estilo.position !== 'fixed' && estilo.position !== 'sticky') continue;
      const r = e.getBoundingClientRect();
      if (r.top > 1 || r.top < -1 || r.width < ancho * 0.9 || r.height < 40 || r.height > 140) continue;
      barras.push(e);
      barraAbajo = Math.max(barraAbajo, r.bottom);
    }
    const dentroDeBarra = (n: Node) => barras.some(b => b.contains(n));
    const esFijoOOculto = (el: Element | null): boolean => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const estilo = getComputedStyle(e);
        if (estilo.display === 'none' || estilo.visibility === 'hidden' || Number(estilo.opacity) === 0) return true;
        if (estilo.position === 'fixed') return true;
        if (e.getAttribute('aria-hidden') === 'true') return true;
        const r = e.getBoundingClientRect();
        if (e !== el && (r.width <= 1 || r.height <= 1) && estilo.overflow !== 'visible') return true;
      }
      return false;
    };
    let arriba: number | null = null;
    let muestra = '';
    const raiz = document.querySelector('#contenido-principal') ?? document.body;
    const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
      if (dentroDeBarra(n)) continue;
      let r: DOMRect | null = null;
      let etiqueta = '';
      if (n.nodeType === Node.TEXT_NODE) {
        const texto = (n.textContent ?? '').trim();
        if (!texto || esFijoOOculto(n.parentElement)) continue;
        const rango = document.createRange();
        rango.selectNodeContents(n);
        r = rango.getBoundingClientRect();
        etiqueta = texto.slice(0, 40);
        const padre = n.parentElement;
        if (padre && ['SCRIPT', 'STYLE', 'OPTION'].includes(padre.tagName)) continue;
      } else {
        const el = n as Element;
        if (!['IMG', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'VIDEO', 'CANVAS'].includes(el.tagName)) continue;
        if (el.classList.contains('sr-only') || esFijoOOculto(el)) continue;
        r = el.getBoundingClientRect();
        etiqueta = `<${el.tagName.toLowerCase()}>`;
      }
      if (!r || r.width < 2 || r.height < 2) continue;
      if (r.bottom <= 0) continue;
      if (arriba === null || r.top < arriba) { arriba = r.top; muestra = etiqueta; }
    }
    return { barraAbajo, contenidoArriba: arriba, muestra };
  });
}

