import { test, expect, type Page } from '@playwright/test';

/**
 * Importar eventos de la Agenda y fichas del Catálogo desde un archivo, por la pantalla.
 *
 * D5-11: la API ya sabía recibirlos, pero la pantalla solo ofrecía Festivales y Organizaciones. Se
 * abren Agenda y Catálogo editorial; Noticias no se importa (se redactan una a una, con revisión).
 *
 * NO CONFIRMA: la previsualización guarda el lote y sus filas, no crea eventos ni fichas, así que se
 * puede repetir sin ensuciar la base. Necesita la siembra completa.
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
  await expect(page.getByRole('navigation', { name: 'Secciones de la consola' })).toBeVisible({ timeout: 30_000 });
}

async function previsualizar(page: Page, nombreDelArchivo: string, csv: string) {
  await page.locator('input[type="file"]').setInputFiles({
    name: nombreDelArchivo,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });
  await page.getByRole('button', { name: /Avanzar a mapeo/i }).click();
  await page.getByRole('button', { name: /Aplicar reglas de preparaci/i }).click();
  const peticion = page.waitForResponse((r) => r.url().includes('/previsualizar') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Previsualizar importaci/i }).click();
  expect((await peticion).status()).toBe(200);
  await expect(page.getByText('Previsualización del servidor')).toBeVisible();
}

test('Agenda: «Importar eventos desde un archivo» abre el circuito y previsualiza en borrador', { tag: '@backend' }, async ({ page }) => {
  await entrar(page);
  await page.goto('/administracion/agenda');

  await page.getByRole('button', { name: 'Más acciones de la lista de eventos' }).click();
  await page.getByRole('menuitem', { name: /Importar eventos desde un archivo/ }).click();
  await expect(page.getByRole('button', { name: /Volver a Agenda y eventos/ })).toBeVisible();

  await previsualizar(page, 'eventos-e2e.csv', [
    'titulo,descripcion,fechaInicio,modalidad,lugar',
    'Concierto de prueba D5b,Un evento de prueba que no se confirma,2027-03-15,presencial,Plaza principal',
  ].join('\n'));

  await expect(page.getByText(/Crear como borrador/)).toBeVisible();

  // Volver deja la lista de eventos como estaba.
  await page.getByRole('button', { name: /Volver a Agenda y eventos/ }).click();
  await expect(page.getByRole('button', { name: 'Más acciones de la lista de eventos' })).toBeVisible();
});

test('Catálogo editorial: «Importar fichas desde un archivo» abre el circuito y previsualiza en borrador', { tag: '@backend' }, async ({ page }) => {
  await entrar(page);
  await page.goto('/administracion/catalogo-editorial');

  await page.getByRole('button', { name: 'Más acciones de la lista de publicaciones' }).click();
  await page.getByRole('menuitem', { name: /Importar fichas desde un archivo/ }).click();
  await expect(page.getByRole('button', { name: /Volver al Catálogo editorial/ })).toBeVisible();

  await previsualizar(page, 'fichas-e2e.csv', [
    'codigo,titulo,resumen',
    `D5B-${Date.now()},Ficha de prueba D5b,Una ficha que no se confirma`,
  ].join('\n'));

  await expect(page.getByText(/Crear como borrador/)).toBeVisible();
});

test('Noticias ya no se ofrece para importar: ni la pantalla ni la API', { tag: '@backend' }, async ({ page }) => {
  await entrar(page);
  await page.goto('/administracion/noticias');

  // La lista de Noticias no trae acciones de importación.
  await expect(page.getByRole('menuitem', { name: /Importar/ })).toHaveCount(0);

  // Y el servidor ya no lista Noticias entre lo que sabe importar.
  const respuesta = await page.request.get('/api/v1/admin/importaciones');
  expect(respuesta.status()).toBe(200);
  const cuerpo = await respuesta.json() as { dominios: { dominio: string }[] };
  const dominios = cuerpo.dominios.map((d) => d.dominio);
  expect(dominios).not.toContain('noticias');
  expect(dominios).toEqual(expect.arrayContaining(['festivales', 'organizaciones', 'agenda', 'catalogo-editorial']));
});
