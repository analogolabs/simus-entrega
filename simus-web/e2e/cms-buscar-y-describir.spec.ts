import { test, expect, type Page } from '@playwright/test';
import { abrirSeccionDeLaBarra } from './apoyo/barra-de-la-consola';

/**
 * Lo que una persona sin conocimientos técnicos hace en «CMS»:
 * encontrar un texto sin saber en qué página vive, describir una imagen y abrir un pendiente en
 * su bloque. Todo por la pantalla, nada por API.
 *
 * Repone el estado previo al terminar, incluso si falla a mitad: la descripción de la imagen se
 * devuelve a la que tenía y el borrador del lema se descarta publicando lo que ya estaba.
 */

const CREDENCIALES = {
  email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test',
  password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin',
};

async function entrar(page: Page) {
  await page.addInitScript((email) => {
    window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1');
  }, CREDENCIALES.email);
  await page.goto('/administracion');
  await page.locator('input[type="email"]').fill(CREDENCIALES.email);
  await page.locator('input[type="password"]').fill(CREDENCIALES.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await abrirSeccionDeLaBarra(page, 'CMS');
}

const area = (page: Page, nombre: RegExp) =>
  page.getByRole('group', { name: 'Áreas de Gestión del sitio' }).getByRole('button', { name: nombre });

test('buscar un texto lleva a su bloque, sin saber en qué sección vive', { tag: '@backend' }, async ({ page }) => {
  await entrar(page);
  await area(page, /Textos y páginas/).click();

  await page.getByLabel('Buscar un texto del sitio').fill('estrategias');
  const resultados = page.getByTestId('resultados-de-busqueda');
  await expect(resultados).toBeVisible();

  const primero = resultados.getByRole('button').first();
  const clave = ((await primero.getAttribute('data-testid')) ?? '').replace('resultado-', '');
  expect(clave).not.toBe('');
  await primero.click();

  // La búsqueda se cierra, el bloque queda abierto y el cursor en la casilla del texto elegido.
  await expect(page.getByTestId('resultados-de-busqueda')).toHaveCount(0);
  await expect(page.locator(`#campo-${clave}`)).toBeVisible();
  await expect(page.locator(`#campo-${clave}`)).toBeFocused();
});

test('una búsqueda sin coincidencias lo dice', { tag: '@backend' }, async ({ page }) => {
  await entrar(page);
  await area(page, /Textos y páginas/).click();

  await page.getByLabel('Buscar un texto del sitio').fill('zzzzqqqqxxxx');

  await expect(page.getByTestId('sin-resultados-de-busqueda')).toBeVisible();
});

test('describir una imagen guarda su texto alternativo y no exige subirla de nuevo', { tag: '@backend' }, async ({ page }) => {
  await entrar(page);
  await area(page, /Imágenes del sitio/).click();

  const ranura = page.locator('[data-testid^="alt-"]').first();
  const caja = ranura.locator('textarea');
  await expect(caja).toBeVisible();
  const original = await caja.inputValue();
  const nueva = `Descripción de prueba ${new Date().toISOString().slice(11, 19)}`;

  try {
    // Sin cambios no se puede guardar, y vaciar el campo tampoco.
    await expect(ranura.getByRole('button', { name: 'Guardar descripción' })).toBeDisabled();
    await caja.fill('   ');
    await expect(ranura.getByRole('button', { name: 'Guardar descripción' })).toBeDisabled();

    await caja.fill(nueva);
    await ranura.getByRole('button', { name: 'Guardar descripción' }).click();
    await expect(page.getByText(/quedó guardada\./)).toBeVisible();

    // Sobrevive a recargar: lo guardó el servidor y no solo la pantalla.
    await page.reload();
    await abrirSeccionDeLaBarra(page, 'CMS');
    await area(page, /Imágenes del sitio/).click();
    await expect(page.locator('[data-testid^="alt-"]').first().locator('textarea')).toHaveValue(nueva);
  } finally {
    const hoy = page.locator('[data-testid^="alt-"]').first();
    if (await hoy.locator('textarea').inputValue() !== original) {
      await hoy.locator('textarea').fill(original);
      await hoy.getByRole('button', { name: 'Guardar descripción' }).click();
      await expect(page.getByText(/quedó guardada\./)).toBeVisible();
    }
  }
});

test('«Abrir» un cambio pendiente lleva a su sección y su bloque, no al primero de Home', { tag: '@backend' }, async ({ page }) => {
  const rotulo = 'Hero - Antetítulo (nombre del Plan)';
  const irAlCampo = async () => {
    await area(page, /Textos y páginas/).click();
    await page.getByTestId('section-tabs').getByRole('button', { name: 'PNMC', exact: true }).click();
    return page.getByLabel(rotulo, { exact: true });
  };

  await entrar(page);
  let campo = await irAlCampo();
  const original = await campo.inputValue();
  try {
    await campo.fill(`Antetítulo de prueba ${new Date().toISOString().slice(11, 19)}`);
    await page.getByRole('button', { name: /Guardar borrador/i }).click();
    await expect(page.locator('.animate-fade-in').filter({ hasText: /borrador/i })).toBeVisible();

    // Se sale de «Sobre PNMC» a propósito: «Abrir» tiene que volver a ella y al bloque exacto.
    await area(page, /Resumen/).click();
    await area(page, /Cambios y respaldos/).click();
    await page.getByRole('button', { name: /^Abrir Hero y Presentación/ }).click();

    await expect(page.getByLabel(rotulo, { exact: true })).toHaveValue(/Antetítulo de prueba/);
  } finally {
    await page.reload();
    await abrirSeccionDeLaBarra(page, 'CMS');
    campo = await irAlCampo();
    await campo.fill(original);
    await page.getByRole('button', { name: /Guardar y publicar/i }).click();
    await expect(page.locator('.animate-fade-in').filter({ hasText: /publicó/i })).toBeVisible();
  }
});
