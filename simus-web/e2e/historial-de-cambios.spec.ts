import { expect, test } from '@playwright/test';
import { abrirFichaDelFestival, crearFestivalConElAsistente, sesionDeOrganizacion } from './apoyo/organizacion';

/**
 * Corregir una edición ya no pierde el valor anterior (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md). @backend
 *
 * Lo que mide esto que ninguna prueba de Karma ni de API mide: el recorrido en el navegador —registrar
 * una edición con un director, corregirlo, y abrir «Historial de cambios de esta edición»— y que la
 * pantalla diga qué valía antes, qué vale ahora y quién lo cambió. Hasta ahora una edición se
 * corregía sobre sí misma y el valor anterior se perdía.
 *
 * Requiere la base de demostración y el entorno local en marcha.
 */
const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);

test('corregir el director de una edición deja lo que valía antes en su historial', { tag: '@backend' }, async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await sesionDeOrganizacion(browser);
  const nombre = `Festival del historial ${MARCA}`;

  await crearFestivalConElAsistente(page, nombre);
  await abrirFichaDelFestival(page, nombre);

  await test.step('registrar la edición con un director', async () => {
    await page.getByRole('button', { name: 'Ediciones', exact: true }).click();
    await page.getByRole('button', { name: 'Registrar edición' }).click();
    await page.getByLabel(/Número de Edición/i).fill('1');
    await page.getByLabel(/Director o directora/i).fill('Ana Gómez');
    await page.getByRole('button', { name: /Guardar borrador/ }).last().click();
    await expect(page.getByText('Edición 1', { exact: true })).toBeVisible({ timeout: 30_000 });
  });

  await test.step('corregir el director', async () => {
    await abrirLaEdicionParaEditar();
    await page.getByLabel(/Director o directora/i).fill('Beatriz Ríos');
    await page.getByRole('button', { name: /Guardar borrador/ }).last().click();
    await expect(page.getByText('Edición 1', { exact: true })).toBeVisible({ timeout: 30_000 });
  });

  await test.step('el historial dice qué valía antes y qué vale ahora', async () => {
    await abrirLaEdicionParaEditar();
    await page.locator('[data-historial-de-cambios] summary').click();
    const cambios = page.locator('[data-testid="cambios-de-datos"]');
    await expect(cambios).toBeVisible({ timeout: 15_000 });
    await expect(cambios).toContainText('Director o directora');
    await expect(cambios).toContainText('Ana Gómez');
    await expect(cambios).toContainText('Beatriz Ríos');
    // Lo que valía antes está tachado y lo que vale ahora no: la pantalla distingue cuál es cuál.
    await expect(cambios.locator('.line-through').first()).toContainText('Ana Gómez');
    // Y dice desde cuándo existe el registro, para no parecer que promete más.
    await expect(page.locator('[data-testid="cambios-desde"]')).toContainText('Lo anterior no se reconstruye');
  });

  async function abrirLaEdicionParaEditar(): Promise<void> {
    await page.getByRole('button', { name: 'Ediciones', exact: true }).click();
    const fila = page.locator('li').filter({ hasText: 'Edición 1' }).first();
    await fila.getByRole('button', { name: /Acciones/ }).click();
    await page.getByText('Editar', { exact: true }).click();
    await expect(page.getByLabel(/Director o directora/i)).toBeVisible();
  }
});
