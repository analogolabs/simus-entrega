import { test, expect } from '@playwright/test';

/**
 * Portada del Ecosistema: el bloque «Directorios públicos» (decisión 118).
 *
 * Muestra solo los procesos activos, en el orden fijo del catálogo común, repartidos por todo el
 * ancho y sin huecos. No necesita la API para pintarse (las cifras no aparecen en las tarjetas
 * de los procesos sin recuento y el resto es del catálogo), pero se corre contra el entorno vivo:
 *
 *   SIMUS_BASE_URL=http://localhost:4352 npx playwright test e2e/directorios-publicos-de-la-portada.spec.ts
 */
const ORDEN = ['Festivales', 'Mercados musicales', 'Redes y documentación', 'Lutería', 'Espacios para música en vivo'];

test.describe('Directorios públicos de la portada del Ecosistema', () => {
  test('salen en el orden fijo y cada tarjeta lleva a su directorio', async ({ page }) => {
    await page.goto('/ecosistema');
    const lista = page.getByTestId('directorios-publicos');
    await expect(lista.locator('h3')).toHaveText(ORDEN);
    await expect(page.getByRole('region', { name: /Explora los registros/ })).toBeVisible();
    await lista.getByRole('link', { name: /Lutería/ }).click();
    await expect(page).toHaveURL(/\/ecosistema\/luteria$/);
  });

  test('ocupan todo el ancho sin huecos en escritorio y se apilan en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ecosistema');
    const items = page.getByTestId('directorios-publicos').locator('> li');
    await expect(items).toHaveCount(5);
    const caja = async () => Promise.all((await items.all()).map(i => i.boundingBox()));
    let cajas = await caja();
    const lista = (await page.getByTestId('directorios-publicos').boundingBox())!;
    // Cada fila llega hasta el borde derecho de la lista (la última fila se estira).
    const filas = new Map<number, number>();
    cajas.forEach(c => filas.set(Math.round(c!.y), Math.max(filas.get(Math.round(c!.y)) ?? 0, c!.x + c!.width)));
    filas.forEach(derecha => expect(Math.abs(derecha - (lista.x + lista.width))).toBeLessThan(2));

    await page.setViewportSize({ width: 375, height: 800 });
    cajas = await caja();
    expect(new Set(cajas.map(c => Math.round(c!.x))).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });
});
