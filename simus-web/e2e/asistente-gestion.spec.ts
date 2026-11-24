import { expect, test, type Page } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * EL ASISTENTE EN LOS ESPACIOS DE GESTIÓN: burbuja flotante y chat con el campo abajo en el panel de una organización
 * (motor propio, acotado a esa organización) y en Mi espacio (motor público). Solo lecturas. Prueba de solapes a tres anchos: el panel
 * no tapa la barra lateral ni la barra superior y la burbuja se aparta de los controles del contenido.
 */
async function entrar(page: Page): Promise<string> {
  const api = '/api/v1/externo/auth';
  const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
  const entrada = await postConCupo(page.request, `${api}/login`, { headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: { email: 'lucia.ramirez@cantaclaro.test', password: 'admin' } });
  expect(entrada.status(), 'la cuenta de demostración tiene que poder entrar').toBe(200);
  const me = await (await page.request.get(`${api}/me`)).json();
  return (me.organizaciones ?? me.organizations)[0].id;
}

for (const [nombre, ancho, alto] of [['escritorio', 1440, 900], ['tableta', 820, 1100], ['teléfono', 390, 844]] as const) {
  test.describe(`Asistente en gestión · ${nombre}`, () => {
    test.use({ viewport: { width: ancho, height: alto } });

    for (const [espacio, ruta] of [['panel de la organización', (id: string) => `/gestion/o/${id}/resumen`], ['Mi espacio', () => '/gestion/cuenta/procesos']] as const) {
      test(`${espacio}: burbuja «Asistente», bienvenida, frecuentes, campo enfocado abajo y sin solapes`, { tag: '@backend' }, async ({ page }) => {
        const id = await entrar(page);
        await page.goto(ruta(id), { waitUntil: 'networkidle' });
        const burbuja = page.locator('[data-abrir-consulta-guiada]');
        await expect(burbuja).toBeVisible();
        await expect(burbuja).toHaveAccessibleName('Asistente');
        await burbuja.click();
        const panel = page.locator('[data-cajon-consulta-guiada]');
        await expect(panel).toBeVisible();
        await expect(panel.locator('h2')).toContainText('Asistente');
        await expect(panel).not.toContainText(/consulta guiada|catálogo de consultas/i);
        await expect(panel.locator('textarea, [data-buscar-pregunta]').first()).toBeFocused();
        await expect(panel).toContainText(/Escribe tu pregunta/);

        const p = (await panel.boundingBox())!;
        const campo = (await panel.locator('textarea, [data-buscar-pregunta]').first().boundingBox())!;
        expect(campo.y + campo.height, 'el campo de escribir está en la parte baja del panel').toBeGreaterThan(p.y + p.height - 160);
        if (ancho >= 640) {
          const barra = await page.evaluate(() => document.querySelector('header, nav')?.getBoundingClientRect().bottom ?? 0);
          expect(p.y, 'el panel no se mete bajo la barra superior').toBeGreaterThanOrEqual(barra - 1);
          const lateral = await page.evaluate(() => { const r = document.querySelector('.foundation-sidebar, [data-testid="navegacion-de-la-cuenta"]')?.getBoundingClientRect(); return r ? { x: r.x, w: r.width, visible: r.width > 0 } : null; });
          if (lateral?.visible) expect(p.x, 'el panel no tapa la barra lateral').toBeGreaterThanOrEqual(lateral.x + lateral.w - 1);
        }
        await page.keyboard.press('Escape');
        await expect(panel).toHaveCount(0);
        await expect(burbuja).toBeFocused();
      });
    }

    test('la burbuja no se pinta en la agenda de citas ni en el asistente de alta de un Festival', { tag: '@backend' }, async ({ page }) => {
      const id = await entrar(page);
      await page.goto(`/gestion/o/${id}/herramientas/agenda-de-citas`, { waitUntil: 'networkidle' });
      await expect(page.locator('[data-abrir-consulta-guiada]')).toHaveCount(0);
      await page.goto(`/gestion/o/${id}/procesos/festivales/nuevo`, { waitUntil: 'networkidle' });
      await expect(page.locator('[data-abrir-consulta-guiada]')).toHaveCount(0);
    });
  });
}
