import type { Page } from '@playwright/test';

/**
 * Detector de «lo que se sale o se esconde» (punto 87 del mapa de comentarios). Solo lee: no hace clic ni escribe.
 *
 * Por qué existe. La prueba de «sin desborde horizontal» miraba solo el ancho de la página. Un contenedor con
 * `overflow: hidden` (o un `truncate`, o una altura fija) esconde justo lo que se sale: la página no se ensancha y el
 * defecto pasa inadvertido. Este detector mira cada elemento visible contra SU contenedor, no contra la página.
 *
 * Qué devuelve (cada hallazgo lleva `tipo`, el elemento y el detalle):
 *  - `fuera-de-la-pantalla`: un elemento visible llega más allá del borde derecho (o izquierdo) de la ventana y ningún
 *    ancestro lo recoge con desplazamiento.
 *  - `recortado-por-su-contenedor`: un elemento sobrepasa a un ancestro con `overflow: hidden|clip` (queda escondido).
 *    Un ancestro con `overflow: auto|scroll` es un desplazamiento intencional y no se reporta.
 *  - `texto-recortado`: un texto que no cabe en su caja (`scrollWidth > clientWidth` con `overflow` oculto o puntos
 *    suspensivos, `line-clamp` o altura fija) y no ofrece su texto completo en `title`.
 *  - `campo-fuera-de-su-tarjeta`: un campo (input, select, textarea, desplegable) que sobrepasa la tarjeta que lo contiene.
 *  - `pagina-con-desplazamiento-horizontal`: la comprobación de siempre, que se conserva.
 *
 * EXCEPCIONES DOCUMENTADAS. Un elemento (o cualquiera de sus descendientes) con `data-recorte-intencional="motivo"` queda
 * fuera del examen; el motivo es obligatorio para que quien lea el código sepa por qué. También se ignora lo decorativo
 * (`aria-hidden="true"`), lo solo para lectores de pantalla (`.sr-only`) y lo que no se pinta. Un texto con elipsis
 * es válido si él o un ancestro cercano tiene `title` (el tooltip da el texto completo). Un extracto con `line-clamp`
 * (descripción de tarjeta) es intencional y no se examina; un TÍTULO con `line-clamp` o altura fija sí.
 */
export interface HallazgoDeRecorte {
  tipo: 'fuera-de-la-pantalla' | 'recortado-por-su-contenedor' | 'texto-recortado' | 'campo-fuera-de-su-tarjeta' | 'pagina-con-desplazamiento-horizontal';
  elemento: string;
  detalle: string;
}

/** Se ejecuta DENTRO de la página: no puede usar nada de este módulo. */
export function detectarRecortes(): HallazgoDeRecorte[] {
  const TOL = 1.5;
  const TOL_TEXTO = 3;
  const salida: { el: Element | null; h: HallazgoDeRecorte }[] = [];
  const vw = document.documentElement.clientWidth;

  const describir = (el: Element): string => {
    const clases = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3).map(c => '.' + c).join('');
    const texto = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${clases}${texto ? ` «${texto}»` : ''}`;
  };
  const redondo = (n: number): number => Math.round(n);

  const excluido = (el: Element): boolean =>
    !!el.closest('[data-recorte-intencional], [aria-hidden="true"], [inert], .sr-only, script, style, option, [hidden]')
    || (el.closest('svg') !== null && el.tagName.toLowerCase() !== 'svg');

  const visible = (el: Element): DOMRect | null => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    // Lo recortado con `clip` o con una caja de 1 px es la técnica de «solo lectores de pantalla».
    if (cs.position === 'absolute' && r.width <= 1 && r.height <= 1) return null;
    return r;
  };

  const desbordaX = (cs: CSSStyleDeclaration): string => cs.overflowX;

  const todos = Array.from(document.body.querySelectorAll('*'));

  for (const el of todos) {
    if (excluido(el)) continue;
    const r = visible(el);
    if (!r) continue;
    const cs = getComputedStyle(el);

    // Una caja girada (los años en vertical de una línea de tiempo) tiene un rectángulo que no es su caja; un elemento en línea
    // que se parte en varias líneas (un enlace dentro de un título con `line-clamp`) tiene uno que une todas sus líneas.
    const giro = (e: Element): boolean => {
      const c = getComputedStyle(e);
      const m = c.transform !== 'none' ? new DOMMatrixReadOnly(c.transform) : null;
      return (!!m && Math.abs(m.b) > 0.01) || (c.rotate !== 'none' && c.rotate !== '0deg');
    };
    let girado = false;
    for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) if (giro(e)) { girado = true; break; }
    const enLinea = cs.display === 'inline';

    // 1) ¿Se sale de su contenedor o de la pantalla?
    let veredicto: 'ok' | 'fuera' | 'recortado' = 'ok';
    let ancestroQueRecorta: Element | null = null;
    if (cs.position !== 'fixed' && !girado && !enLinea) {
      for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (acs.position === 'fixed') break;
        const ox = desbordaX(acs);
        if (ox === 'visible') continue;
        const ar = a.getBoundingClientRect();
        if (ar.width < 1) continue;
        const sobra = r.right > ar.right + TOL || r.left < ar.left - TOL;
        if (!sobra) continue;
        // Un absoluto/fijo cuyo contenedor de posición queda fuera de este ancestro no lo recorta.
        if (cs.position === 'absolute' && !a.contains(el.offsetParent)) continue;
        if (ox === 'auto' || ox === 'scroll') { veredicto = 'ok'; ancestroQueRecorta = null; break; }
        veredicto = 'recortado'; ancestroQueRecorta = a; break;
      }
      if (veredicto === 'ok' && (r.right > vw + TOL || r.left < -TOL)) {
        // Si ningún ancestro lo recoge con desplazamiento, está fuera de la ventana.
        let recogido = false;
        for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
          const ox = desbordaX(getComputedStyle(a));
          if (ox === 'auto' || ox === 'scroll') { recogido = true; break; }
        }
        if (!recogido) veredicto = 'fuera';
      }
    }
    if (veredicto === 'recortado' && ancestroQueRecorta) {
      const ar = ancestroQueRecorta.getBoundingClientRect();
      salida.push({ el, h: { tipo: 'recortado-por-su-contenedor', elemento: describir(el), detalle: `llega a ${redondo(r.right)} px y su contenedor (${describir(ancestroQueRecorta).slice(0, 50)}) termina en ${redondo(ar.right)} px` } });
    } else if (veredicto === 'fuera') {
      salida.push({ el, h: { tipo: 'fuera-de-la-pantalla', elemento: describir(el), detalle: `ocupa de ${redondo(r.left)} a ${redondo(r.right)} px y la ventana mide ${vw} px` } });
    }

    // 2) ¿Es un texto que no cabe en su caja?
    const tieneTextoPropio = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0);
    if (tieneTextoPropio) {
      const oculto = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis';
      const ocultoY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
      const clamp = cs.getPropertyValue('-webkit-line-clamp');
      const conClamp = !!clamp && clamp !== 'none';
      // Solo el texto en UNA línea (`nowrap`, elipsis) se corta a lo ancho: el que se parte en líneas no puede, salvo por una palabra larga.
      const unaLinea = cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre' || cs.textOverflow === 'ellipsis';
      const cortaX = oculto && unaLinea && el.scrollWidth > el.clientWidth + TOL_TEXTO && el.clientWidth > 0;
      // Un EXTRACTO (descripción, resumen) con `line-clamp` es un patrón de tarjeta intencional; el recorte vertical solo
      // se examina en títulos y encabezados, que son lo que la persona necesita leer completo.
      const esTitulo = /^h[1-6]$/i.test(el.tagName) || el.getAttribute('role') === 'heading' || /(^|\s)(tipo-titulo|titulo-|t-titulo|title)/i.test(el.getAttribute('class') ?? '')
        || !!el.closest('h1, h2, h3, h4, h5, h6, [role="heading"]');
      const cortaY = esTitulo && (conClamp || ocultoY) && el.scrollHeight > el.clientHeight + TOL && el.clientHeight > 0;
      if ((cortaX || cortaY) && !el.closest('[title]') && !(el instanceof HTMLElement && el.title)) {
        salida.push({ el, h: { tipo: 'texto-recortado', elemento: describir(el), detalle: cortaX ? `el texto mide ${el.scrollWidth} px y la caja ${el.clientWidth} px` : `el texto mide ${el.scrollHeight} px de alto y la caja ${el.clientHeight} px` } });
        }
    }

    // 3) ¿Un campo sobrepasa su tarjeta?
    const esCampo = /^(input|select|textarea)$/.test(el.tagName.toLowerCase()) || el.matches('button[aria-haspopup]');
    if (esCampo && (el as HTMLInputElement).type !== 'hidden' && (el as HTMLInputElement).type !== 'checkbox' && (el as HTMLInputElement).type !== 'radio') {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        const conBorde = parseFloat(acs.borderTopWidth) > 0 || parseFloat(acs.borderLeftWidth) > 0;
        const conFondo = acs.backgroundColor !== 'rgba(0, 0, 0, 0)' && acs.backgroundColor !== 'transparent';
        if (parseFloat(acs.borderTopLeftRadius) > 0 && (conBorde || conFondo)) {
          const ar = a.getBoundingClientRect();
          if (r.right > ar.right + TOL || r.left < ar.left - TOL) {
            salida.push({ el, h: { tipo: 'campo-fuera-de-su-tarjeta', elemento: describir(el), detalle: `el campo llega a ${redondo(r.right)} px y la tarjeta termina en ${redondo(ar.right)} px` } });
                }
          break;
        }
      }
    }
  }

  // Solo el más externo de una cadena: sus hijos exceden por la misma causa.
  const conHallazgo = new Set(salida.map(s => s.el));
  const finales = salida.filter(s => {
    for (let a = s.el?.parentElement ?? null; a; a = a.parentElement) if (conHallazgo.has(a)) return false;
    return true;
  });
  const unicos = new Map<string, HallazgoDeRecorte>();
  for (const f of finales) unicos.set(f.h.tipo + '|' + f.h.elemento, f.h);
  const lista = Array.from(unicos.values());
  const ancho = document.documentElement.scrollWidth;
  if (ancho > vw + TOL) lista.unshift({ tipo: 'pagina-con-desplazamiento-horizontal', elemento: 'html', detalle: `el documento mide ${ancho} px y la ventana ${vw} px` });
  return lista;
}

/** Espera a que la pantalla se asiente y devuelve los hallazgos de recorte. */
export async function recortesDe(page: Page): Promise<HallazgoDeRecorte[]> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  return page.evaluate(detectarRecortes);
}
