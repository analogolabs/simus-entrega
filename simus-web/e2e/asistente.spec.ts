import { expect, test } from '@playwright/test';

/**
 * EL ASISTENTE: burbuja flotante abajo a la derecha que abre un panel de chat (historial arriba, campo de
 * escribir abajo). SOLO LECTURA: no escribe nada en la base (las consultas son lecturas públicas).
 */
for (const [nombre, ancho, alto] of [['escritorio', 1440, 900], ['tableta', 820, 1100], ['teléfono', 390, 844]] as const) {
  test.describe(`Asistente · ${nombre}`, () => {
    test.use({ viewport: { width: ancho, height: alto } });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().split('T')[0]));
    });

    test('la burbuja abre el panel con el foco en el campo; Esc lo cierra y devuelve el foco', { tag: '@backend' }, async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      const boton = page.locator('[data-abrir-pregunta]');
      await expect(boton).toBeVisible();
      await expect(boton).toContainText('Asistente');
      await boton.click();
      const panel = page.locator('[data-cajon-consulta-guiada]');
      await expect(panel).toBeVisible();
      await expect(panel.locator('h2')).toContainText('Asistente');
      await expect(panel.locator('[data-buscar-pregunta]')).toBeFocused();
      await expect(panel).not.toContainText(/guiada|asistida|abierta|Pregunta lo que quieras/i);
      await expect(panel.locator('h3').first()).toContainText('Preguntas frecuentes');
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(boton).toBeFocused();
    });

    test('el campo queda abajo, la barra queda libre y la burbuja no tapa el pie', { tag: '@backend' }, async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.locator('[data-abrir-pregunta]').click();
      const panel = page.locator('[data-cajon-consulta-guiada]');
      await expect(panel).toBeVisible();
      const p = (await panel.boundingBox())!;
      const c = (await panel.locator('[data-buscar-pregunta]').boundingBox())!;
      const barra = await page.evaluate(() => document.querySelector('nav')?.getBoundingClientRect().bottom ?? 0);
      expect(c.y + c.height, 'el campo está en la parte baja del panel').toBeGreaterThan(p.y + p.height - 120);
      expect(p.y, 'el panel no se mete bajo la barra principal').toBeGreaterThanOrEqual(barra - 1);
      expect(p.x + p.width).toBeLessThanOrEqual(ancho);
      expect(p.y + p.height).toBeLessThanOrEqual(alto);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('la burbuja cerrada no solapa los enlaces del pie ni el contenido al final de la página', { tag: '@backend' }, async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const b = (await page.locator('[data-abrir-pregunta]').boundingBox())!;
      const solapados = await page.evaluate(({ x, y, w, h }) => [...document.querySelectorAll('footer a, footer button, main a, main button')]
        .filter(e => !e.closest('app-cajon-de-consulta-guiada'))
        .map(e => e.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0 && r.left < x + w && r.right > x && r.top < y + h && r.bottom > y).length, { x: b.x, y: b.y, w: b.width, h: b.height });
      expect(solapados, 'controles bajo la burbuja al final de la portada').toBe(0);
    });

    test('una pregunta escrita se responde con tabla, fuente y enlaces por fila', { tag: '@backend' }, async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.locator('[data-abrir-pregunta]').click();
      const campo = page.locator('[data-buscar-pregunta]');
      await campo.fill('festivales en Nariño');
      await page.locator('[data-enviar-pregunta]').click();
      const respuesta = page.locator('[data-respuesta-publica]').last();
      await expect(respuesta.locator('table')).toBeVisible({ timeout: 30_000 });
      await expect(respuesta).toContainText('Fuente:');
      await expect(respuesta.locator('a[data-enlace-de-fila]').first()).toHaveAttribute('href', /^\/ecosistema\//);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('el enlace discreto de la portada abre el Asistente', { tag: '@backend' }, async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      const enlace = page.locator('[data-pregunta-destacada-campo]');
      await enlace.scrollIntoViewIfNeeded();
      await expect(enlace).toContainText('Habla con el Asistente');
      await enlace.click();
      await expect(page.locator('[data-cajon-consulta-guiada]')).toBeVisible();
    });

    test('en el mapa y en la agenda de citas la burbuja no se pinta', { tag: '@backend' }, async ({ page }) => {
      for (const ruta of ['/mapa-ecosistemico', '/ecosistema/agenda-de-citas']) {
        await page.goto(ruta, { waitUntil: 'networkidle' });
        await expect(page.locator('[data-abrir-pregunta]'), `en «${ruta}»`).toHaveCount(0);
      }
    });
  });
}
