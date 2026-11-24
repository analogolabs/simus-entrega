import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Pantalla de mantenimiento. No necesita la API: simula con `page.route` el 503 que responde el modo
 * mantenimiento (`Mantenimiento__Activo=true`) y la caída total del servicio.
 */
const ETIQUETAS = ['best-practice', 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function simularMantenimiento(page: Page): Promise<void> {
  await page.route('**/api/**', route => route.fulfill({
    status: 503,
    headers: { 'X-Mantenimiento': '1', 'Retry-After': '300', 'content-type': 'application/json' },
    body: JSON.stringify({ codigo: 'mantenimiento', mensaje: 'Estamos actualizando la plataforma.', hastaAprox: new Date(Date.now() + 3600e3).toISOString() }),
  }));
}

async function sinViolaciones(page: Page): Promise<void> {
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS).analyze();
  const graves = resultado.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

test.describe('Pantalla de mantenimiento', () => {
  test('un 503 de mantenimiento lleva a la pantalla completa, accesible', async ({ page }) => {
    await simularMantenimiento(page);
    await page.goto('/noticias');
    await expect(page).toHaveURL(/\/mantenimiento$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Estamos mejorando SIMUS/i);
    await expect(page.getByText('Estamos actualizando la plataforma.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(page.getByRole('link', { name: /YouTube/ })).toBeVisible();
    // A pantalla completa: sin cabecera ni pie del portal.
    await expect(page.locator('app-navigation')).toHaveCount(0);
    await expect(page.locator('app-footer')).toHaveCount(0);
    await sinViolaciones(page);
  });

  test('Reintentar sigue en la pantalla mientras dure el mantenimiento y vuelve cuando termina', async ({ page }) => {
    await simularMantenimiento(page);
    await page.goto('/noticias');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByText('Todavía no está disponible')).toBeVisible();

    await page.unroute('**/api/**');
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page).toHaveURL(/\/noticias$/);
  });

  test('es accesible y usable a 390 px, con el teclado', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await simularMantenimiento(page);
    await page.goto('/mantenimiento');
    await page.getByRole('button', { name: 'Reintentar' }).waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    await sinViolaciones(page);
  });

  test('sin conexión con el servicio muestra un estado distinto', async ({ page }) => {
    await page.route('**/api/**', route => route.abort('connectionrefused'));
    await page.route('**/health/live', route => route.abort('connectionrefused'));
    await page.goto('/noticias');
    await expect(page).toHaveURL(/\/mantenimiento$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/No logramos conectar/i);
    await sinViolaciones(page);
  });
});
