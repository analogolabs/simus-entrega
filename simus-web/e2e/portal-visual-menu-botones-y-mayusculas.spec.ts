import { test, expect, type Page } from '@playwright/test';

/**
 * Lo visual del portal que pidió la dirección el 12 nov 2026.
 *
 * Es de escritorio y casi no necesita datos de la API (el menú del PNMC y las páginas de componente
 * son contenido fijo), pero se etiqueta `@backend` como los demás recorridos del portal. Se corre a
 * mano contra el entorno vivo:
 *
 *   SIMUS_BASE_URL=http://localhost:4350 npx playwright test e2e/portal-visual-menu-botones-y-mayusculas.spec.ts
 *
 * LO QUE FIJA:
 *   · los tres ejes del menú PNMC se marcan igual al pasar el cursor: línea a la izquierda, sin
 *     borde inferior (antes el 1 y el 2 enseñaban un «cuadrado recortado» y el 3 solo la línea);
 *   · «componente anterior» y «siguiente» son una fila compacta, no dos cajas de 408 × 97 px;
 *   · en el portal solo los TÍTULOS grandes van en mayúscula sostenida (docs/usuario/23-guia-de-estilo-de-textos.md, docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 76).
 */

async function abrirMenuPnmc(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.locator('header a:has-text("PNMC"), nav a:has-text("PNMC")').first().hover();
  await expect(page.locator('[data-testid="panel-pnmc"]')).toBeVisible();
}

test.describe('Portal: menú PNMC, botones de componente y mayúsculas', { tag: '@backend' }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('los tres ejes del menú PNMC se marcan igual al pasar el cursor', async ({ page }) => {
    await abrirMenuPnmc(page);
    const ejes = page.locator('[data-testid="enlace-eje"]');
    expect(await ejes.count()).toBe(3);

    for (let i = 0; i < 3; i++) {
      await ejes.nth(i).hover();
      await page.waitForTimeout(350);
      const estilo = await ejes.nth(i).evaluate(el => {
        const c = getComputedStyle(el);
        return { izq: c.borderLeftWidth, abajo: c.borderBottomWidth, arriba: c.borderTopWidth, anillo: c.boxShadow };
      });
      expect(estilo.izq, `eje ${i + 1}: línea a la izquierda`).toBe('2px');
      expect(estilo.abajo, `eje ${i + 1}: sin borde inferior`).toBe('0px');
      expect(estilo.arriba, `eje ${i + 1}: sin borde superior`).toBe('0px');
    }
  });

  test('«componente anterior» y «siguiente» son una fila compacta con el título del vecino', async ({ page }) => {
    await page.goto('/pnmc/ejes/creacion-y-produccion');
    const nav = page.locator('[data-testid="componentes-vecinos"]');
    await nav.scrollIntoViewIfNeeded();
    const anterior = page.locator('[data-testid="componente-anterior"]');
    const siguiente = page.locator('[data-testid="componente-siguiente"]');
    await expect(anterior).toContainText('Componente anterior');
    await expect(siguiente).toContainText('Componente siguiente');
    await expect(anterior).toHaveAttribute('href', /^\/pnmc\/ejes\/.+/);
    await expect(siguiente).toHaveAttribute('href', /^\/pnmc\/ejes\/.+/);

    for (const enlace of [anterior, siguiente]) {
      const caja = (await enlace.boundingBox())!;
      expect(caja.height, 'ya no es una caja de ~97 px').toBeLessThan(70);
      expect(caja.width, 'ya no ocupa media columna').toBeLessThan(300);
    }
    // El teclado llega a los dos y el foco se ve.
    await anterior.focus();
    const foco = await anterior.evaluate(el => getComputedStyle(el).boxShadow);
    expect(foco, 'el anillo de foco es visible').not.toBe('none');
  });

  for (const ruta of ['/', '/ecosistema', '/agenda', '/noticias', '/editorial', '/pnmc', '/pnmc/ejes/creacion-y-produccion', '/mapa-ecosistemico']) {
    test(`${ruta}: solo los títulos grandes van en mayúscula sostenida`, async ({ page }) => {
      await page.goto(ruta);
      await page.waitForTimeout(2500);
      // UNA RUTA EQUIVOCADA NO PUEDE PASAR EN SILENCIO: «/mapa» no existe y la prueba salía verde
      // mirando la página «no encontrada».
      await expect(page.getByText('Página no encontrada')).toHaveCount(0);
      const intrusos = await page.evaluate(() => {
        const permitidas = ['tipo-seccion', 'tipo-titulo-grande', 'tipo-titulo'];
        const salida: string[] = [];
        for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
          if (getComputedStyle(el).textTransform !== 'uppercase') continue;
          const texto = (el.childNodes.length && Array.from(el.childNodes).some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) ? (el.textContent ?? '').trim() : '';
          if (!texto) continue;
          const titulo = el.closest('h1, h2, h3, .tipo-seccion, .tipo-titulo-grande, .tipo-titulo') !== null || permitidas.some(c => el.classList.contains(c));
          const cartografia = el.closest('.country-label-marker, .leaflet-container') !== null;
          if (!titulo && !cartografia) salida.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 50)} → ${texto.slice(0, 40)}`);
        }
        return salida;
      });
      expect(intrusos, 'mayúscula sostenida fuera de los títulos').toEqual([]);
    });
  }
});
