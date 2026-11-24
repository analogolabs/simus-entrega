import { test, expect, type Page } from '@playwright/test';

/**
 * «Importar Festivales» de punta a punta por la pantalla, hasta la revisión.
 *
 * Cubre lo que se rompió sin que nadie lo viera: «Previsualizar importación» no llamaba al servidor
 * (D5-01), el chat del archivo mostraba los asteriscos del énfasis (D5-04), la tabla ancha estiraba
 * la pantalla (D5-08) y un Festival casi igual a uno existente entraba sin aviso (D5-10).
 *
 * NO CONFIRMA: la previsualización guarda solo el lote y sus filas, no crea ningún Festival, así
 * que la prueba se puede repetir sin ensuciar la base. Necesita la siembra completa,
 * que trae «Festival de Chirimía de Arauca».
 */

const CREDENCIALES = {
  email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test',
  password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin',
};

const CSV = [
  'nombre,descripcion,nivelCobertura,departamento,municipio,periodicidad',
  'Festival Chirimía Arauca,Se parece a uno que ya existe,municipal,Arauca,Arauca,anual',
  'Festival Nuevo D5 E2E,Uno que no existe,municipal,Huila,Neiva,anual',
  ',Sin nombre,municipal,Huila,Neiva,anual',
].join('\n');

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

async function abrirLaImportacion(page: Page) {
  await page.goto('/administracion/festivales');
  await page.getByRole('button', { name: 'Más acciones de la lista de Festivales' }).click();
  await page.getByRole('menuitem', { name: /Importar Festivales/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'festivales-e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV, 'utf-8'),
  });
}

test('el menú de acciones de la lista se llama como se lee, sin «de de»', { tag: '@backend' }, async ({ page }) => {
  await entrar(page);
  await page.goto('/administracion/festivales');

  await expect(page.getByRole('button', { name: 'Más acciones de la lista de Festivales' })).toBeVisible();
  await expect(page.getByRole('button', { name: /de de/ })).toHaveCount(0);
});

test('previsualizar llama al servidor, avisa del parecido y la tabla no estira la pantalla', { tag: '@backend' }, async ({ page }) => {
  await entrar(page);
  await abrirLaImportacion(page);

  // D5-04: el chat del archivo no deja los asteriscos del énfasis a la vista.
  await expect(page.getByText('6 columnas', { exact: false }).first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText('**');

  await page.getByRole('button', { name: /Avanzar a mapeo/i }).click();
  await page.getByRole('button', { name: /Aplicar reglas de preparaci/i }).click();

  // D5-08: con las 13 columnas del paso 3 la página no gana desplazamiento horizontal.
  await expect(page.getByRole('button', { name: /Previsualizar importaci/i })).toBeVisible();
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(desborda).toBe(false);

  // D5-01: el botón hace una petición al servidor y la revisión aparece.
  const peticion = page.waitForResponse((r) => r.url().includes('/importaciones/festivales/previsualizar'));
  await page.getByRole('button', { name: /Previsualizar importaci/i }).click();
  expect((await peticion).status()).toBe(200);
  await expect(page.getByText('Previsualización del servidor')).toBeVisible();

  // D5-10: el nombre casi igual se avisa con el Festival existente, y la fila sigue siendo importable.
  await expect(page.getByText(/Se parece a «Festival de Chirimía de Arauca»/)).toBeVisible();
  await expect(page.getByText('Crear como publicado').first()).toBeVisible();
  // La fila sin nombre sí se rechaza.
  await expect(page.getByText('El nombre del Festival es obligatorio.')).toBeVisible();

  // D5b: el aviso se puede comparar con el Festival que ya existe, sin salir de la pantalla.
  await page.getByRole('button', { name: /Comparar con el Festival ya registrado/ }).first().click();
  const comparacion = page.getByRole('region', { name: 'Comparación con el Festival ya registrado' });
  await expect(comparacion).toBeVisible();
  await expect(comparacion.getByText('Festival de Chirimía de Arauca')).toBeVisible();
  await expect(comparacion.getByText('Ninguna: registro histórico')).toBeVisible();
  await expect(comparacion.getByRole('link', { name: /Abrir su ficha en la consola/ })).toBeVisible();
});
