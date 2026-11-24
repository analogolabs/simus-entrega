import { test, expect, Browser, Page } from '@playwright/test';

/**
 * La consola: fichas con dirección propia, cajón común y fechas legibles.
 *
 * Las fichas de Noticias, Agenda y Auditoría tienen dirección propia: el enlace abre la
 *           ficha, recargar la conserva y «Atrás» la cierra.
 * La ficha del Catálogo se abre en el cajón lateral común, no en la hoja centrada.
 *   D3-17   Los campos de fecha del diálogo de evento se leen enteros con la configuración es-CO.
 *
 * Requiere el entorno local (API y web) con la siembra completa y la cuenta de consola de
 * demostración (modo demo).
 */

const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin' };

async function consola(browser: Browser, locale = 'es-CO'): Promise<Page> {
  const context = await browser.newContext({ locale });
  await context.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), WEBMASTER.email);
  const page = await context.newPage();
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(WEBMASTER.email);
  await page.locator('input[type="password"]').fill(WEBMASTER.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

/** El primer identificador de una lista de la consola, sea un arreglo o `{ items }`. */
async function primerId(page: Page, ruta: string): Promise<string> {
  const respuesta = await page.request.get(ruta);
  expect(respuesta.ok(), `${ruta}: ${await respuesta.text()}`).toBeTruthy();
  const cuerpo = await respuesta.json() as unknown;
  const lista = (Array.isArray(cuerpo) ? cuerpo : (cuerpo as { items?: unknown[] }).items ?? []) as { id: string | number }[];
  expect(lista.length, `${ruta} no trae registros: ¿está sembrada la demostración?`).toBeGreaterThan(0);
  return String(lista[0].id);
}

test.describe('G1: la consola', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('la ficha de una noticia tiene dirección: enlace, recarga y «Atrás»', { tag: '@backend' }, async ({ browser }) => {
    const page = await consola(browser);
    const id = await primerId(page, '/api/v1/institucional/noticias');

    await page.goto(`/administracion/noticias/${id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-panel-lateral .panel')).toBeVisible({ timeout: 30_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-panel-lateral .panel')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/administracion/noticias/${id}$`));

    await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
    await expect(page).toHaveURL(/\/administracion\/noticias$/);
    await expect(page.locator('app-panel-lateral .panel')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('app-panel-lateral .panel')).toBeVisible({ timeout: 15_000 });
    await page.context().close();
  });

  test('la ficha de un evento de la Agenda tiene dirección', { tag: '@backend' }, async ({ browser }) => {
    const page = await consola(browser);
    const id = await primerId(page, '/api/v1/institucional/agenda');

    await page.goto(`/administracion/agenda/${id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-panel-lateral .panel')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
    await expect(page).toHaveURL(/\/administracion\/agenda$/);
    await page.context().close();
  });

  test('un id que no existe se dice y vuelve a la lista', { tag: '@backend' }, async ({ browser }) => {
    const page = await consola(browser);

    await page.goto('/administracion/noticias/999999999', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Esa noticia no existe')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/administracion\/noticias$/);
    await page.context().close();
  });

  test('la ficha del Catálogo se abre en el cajón lateral común', { tag: '@backend' }, async ({ browser }) => {
    const page = await consola(browser);
    const id = await primerId(page, '/api/v1/institucional/catalogo-editorial?pagina=1&tamano=5');

    await page.goto(`/administracion/catalogo-editorial/${id}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('app-panel-lateral .panel--ancho')).toBeVisible({ timeout: 30_000 });
    // No queda la hoja centrada de antes.
    await expect(page.locator('.dialogo--hoja')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar la ficha' }).click();
    await expect(page).toHaveURL(/\/administracion\/catalogo-editorial$/);
    await page.context().close();
  });

  test('D3-17 · los campos de fecha del diálogo de evento se leen enteros en es-CO', { tag: '@backend' }, async ({ browser }) => {
    const page = await consola(browser, 'es-CO');

    await page.goto('/administracion/agenda', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Nuevo evento' }).first().click();
    await expect(page.locator('#formulario-evento-titulo')).toBeVisible({ timeout: 30_000 });

    // LAS FECHAS ESTÁN EN EL SEGUNDO PASO del formulario; «Siguiente» no valida nada. Se acota al
    // diálogo: la lista de atrás también tiene un «Siguiente» (el de su paginación).
    const dialogo = page.locator('#formulario-evento-titulo').locator('xpath=ancestor::*[contains(@class,"dialogo")][1]');
    await dialogo.getByRole('button', { name: 'Siguiente', exact: true }).click();
    const campos = dialogo.locator('input[type="date"]');
    await expect(campos.first()).toBeVisible({ timeout: 15_000 });
    const medidas = await campos.evaluateAll(
      lista => lista.map(c => ({ id: (c as HTMLInputElement).id || (c as HTMLInputElement).getAttribute('name') || 'fecha', visible: (c as HTMLElement).clientWidth, total: (c as HTMLElement).scrollWidth })));
    expect(medidas.length, 'el diálogo debe tener campos de fecha').toBeGreaterThan(0);
    for (const medida of medidas) {
      // Un campo de fecha truncado («12/05/20…») tiene más contenido del que cabe.
      expect(medida.total, `el campo ${medida.id} se ve truncado (${medida.total} > ${medida.visible})`).toBeLessThanOrEqual(medida.visible + 1);
    }
    await page.context().close();
  });
});
