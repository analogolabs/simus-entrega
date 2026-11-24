import { expect, test } from '@playwright/test';

/**
 * CAPAS Y ESTRUCTURA DEL PORTAL PÚBLICO .
 *
 *  - El pie nunca está a la vista sin desplazarse: en toda página pública aparece solo al terminar el scroll.
 *  - Un diálogo del portal queda POR ENCIMA de la barra de navegación fija (el del boletín quedaba debajo
 *    porque su contenedor tenía `z-10` y creaba un contexto de apilamiento propio).
 *  - El pie muestra solo YouTube, Instagram, Facebook y X, enlazados a cuentas, no a la raíz de cada red.
 */
const RUTAS = ['/', '/agenda', '/noticias', '/editorial', '/pnmc', '/ecosistema', '/ecosistema/festivales', '/ecosistema/personas'];

for (const ancho of [1440, 390]) {
  test.describe(`a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: ancho === 390 ? 844 : 900 } });

    test('el pie solo aparece al terminar el scroll, en todas las páginas públicas', async ({ page }) => {
      for (const ruta of RUTAS) {
        await page.goto(ruta, { waitUntil: 'networkidle' });
        const arriba = await page.evaluate(() => document.querySelector('footer')!.getBoundingClientRect().top - innerHeight);
        expect(arriba, `en «${ruta}» el pie ya se ve sin desplazarse`).toBeGreaterThanOrEqual(0);
      }
    });
  });
}

test('el diálogo del boletín queda por encima de la barra de navegación', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.fill('[data-testid="boletin-correo"]', 'prueba@ejemplo.test');
  await page.click('[data-testid="boletin-enviar"]');
  await page.waitForSelector('[data-testid="boletin-modal"]');
  const sobreLaBarra = await page.evaluate(() => !!document.elementFromPoint(300, 20)?.closest('[data-testid="boletin-modal-fondo"]'));
  expect(sobreLaBarra).toBe(true);
});

test('el pie enlaza solo YouTube, Instagram, Facebook y X, cada uno a su cuenta', async ({ page }) => {
  await page.goto('/agenda', { waitUntil: 'networkidle' });
  const redes = await page.locator('footer a[aria-label^="Abrir "]').evaluateAll(a => a.map(e => [e.textContent?.trim(), e.getAttribute('href')]));
  expect(redes).toEqual([
    ['YouTube', 'https://www.youtube.com/@MinCulturasCol'],
    ['Instagram', 'https://www.instagram.com/minculturascol'],
    ['Facebook', 'https://www.facebook.com/MinCulturasCol'],
    ['X', 'https://x.com/MinCulturasCol'],
  ]);
});

