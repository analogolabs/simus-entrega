import { expect, test } from '@playwright/test';

/**
 * Celebra la música y El Plan: pestañas de sección pegadas bajo la barra principal, ediciones como botones y aliados sin la nota
 * de piezas oficiales. Solo lectura; necesita la siembra de `celebra` (2025 y 2026). @backend
 */
for (const ancho of [1440, 390]) {
  test(`Celebra la música a ${ancho} px: pestañas fijas bajo la barra, sin cápsula, botones de año y sin nota`, { tag: '@backend' }, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto('/pnmc/estrategias/celebra-la-musica/2026', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('celebra-titulo')).toBeVisible();
    await expect(page.locator('header').first()).not.toContainText('Estrategia del PNMC');

    await page.getByRole('button', { name: 'Ediciones', exact: true }).click();
    const pestanas = page.locator('app-pestanas-de-seccion');
    await expect(page.getByRole('button', { name: 'Ediciones', exact: true })).toHaveAttribute('aria-current', 'location');
    const alto = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-barra-superior')));
    await expect.poll(async () => Math.round((await pestanas.boundingBox())!.y)).toBe(alto);   // el salto es suave: se espera a que termine

    const botones = page.getByTestId('botones-de-edicion').getByRole('link');
    await expect(botones).toHaveText(['2026', '2025']);
    await expect(botones.nth(1)).toHaveAttribute('href', '/pnmc/estrategias/celebra-la-musica/2025');
    await expect(page.getByTestId('selector-de-edicion')).not.toContainText('Ediciones anteriores');

    await page.getByRole('button', { name: 'Aliados', exact: true }).click();
    await expect(page.locator('#aliados')).toBeVisible();
    await expect(page.locator('#aliados')).not.toContainText('Piezas oficiales');
    await expect.poll(async () => (await page.locator('#aliados-titulo').boundingBox())!.y).toBeGreaterThanOrEqual(alto + (await pestanas.boundingBox())!.height - 1);
    const titulo = await page.locator('#aliados-titulo').boundingBox();
    expect(titulo!.y).toBeGreaterThanOrEqual(alto + (await pestanas.boundingBox())!.height - 1);
  });

  test(`El Plan a ${ancho} px: el menú lateral pasa a pestañas pegadas bajo la barra`, { tag: '@backend' }, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto('/pnmc', { waitUntil: 'networkidle' });
    const pestanas = page.locator('app-pestanas-de-seccion');
    await expect(pestanas.getByRole('button')).toHaveCount(9);
    await pestanas.getByRole('button', { name: 'Estrategias' }).click();
    await expect(pestanas.getByRole('button', { name: 'Estrategias' })).toHaveAttribute('aria-current', 'location');
    const alto = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-barra-superior')));
    await expect.poll(async () => Math.round((await pestanas.boundingBox())!.y)).toBe(alto);   // el salto es suave: se espera a que termine
  });
}
