import { Browser, Page, expect, test } from '@playwright/test';

/**
 * Celebra la música: crear una edición nueva en la consola, editarla, publicarla y verla en el portal (L7). @backend
 *
 * Usa la cuenta de consola de demostración y la siembra `celebra`. ESCRIBE en la base: crea la edición de un año
 * lejano (2050 a 2099) y al terminar la despublica, de modo que no queda a la vista del portal. Como las ediciones no se borran,
 * cada corrida usa un año distinto al azar.
 */
const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? 'admin' };

async function consola(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ locale: 'es-CO' });
  await context.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), WEBMASTER.email);
  const page = await context.newPage();
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(WEBMASTER.email);
  await page.locator('input[type="password"]').fill(WEBMASTER.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

test('crear una edición, editarla, publicarla y verla en el portal', { tag: '@backend' }, async ({ browser }) => {
  test.setTimeout(180_000);
  const anio = 2050 + Math.floor(Math.random() * 50);
  const page = await consola(browser);

  await test.step('abre el apartado propio «Celebra la Música» desde la barra', async () => {
    await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
    await page.locator('aside#navegacion-administrativa').getByRole('button', { name: /Celebra la Música/ }).click();
    await expect(page).toHaveURL(/\/administracion\/celebra-la-musica/);
    await expect(page.getByTestId('celebra-ediciones')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('celebra-ediciones')).toContainText('Celebra la Música 2026');
  });

  await test.step('crea el año nuevo y se abre el editor', async () => {
    await page.getByRole('button', { name: 'Nueva edición' }).click();
    await page.locator('#celebra-anio').fill(String(anio));
    await page.getByRole('button', { name: 'Crear la edición' }).click();
    await expect(page.getByRole('heading', { name: `Nueva edición ${anio}` })).toBeVisible();
  });

  await test.step('completa presentación, categoría, recurso, pregunta e imagen con crédito', async () => {
    await page.locator('textarea[name="resumen"]').fill('Edición de prueba del recorrido de la consola.');
    await page.locator('textarea[name="presentacion"]').fill('Primer párrafo.\n\nSegundo párrafo.');
    await page.getByRole('button', { name: 'Añadir una categoría' }).click();
    await page.locator('input[name="cat-nombre-0"]').fill('Circuitos sonoros');
    await page.getByTestId('celebra-agregar-recurso').click();
    await page.locator('input[name="rec-grupo-0"]').fill('Guías');
    await page.locator('input[name="rec-titulo-0"]').fill('Guía de prueba');
    await page.locator('input[name="rec-url-0"]').fill('https://celebralamusica.mincultura.gov.co/');
    await page.getByTestId('celebra-agregar-pregunta').click();
    await page.locator('input[name="faq-pregunta-0"]').fill('¿Cuesta entrar?');
    await page.locator('textarea[name="faq-respuesta-0"]').fill('Casi siempre es gratis.');
    await page.getByTestId('celebra-galeria-banco').click();
    await page.getByTestId('celebra-banco').locator('button').first().click();
    await page.locator('input[name="gal-alt-0"]').fill('Imagen de la galería de prueba');
    await page.locator('input[name="gal-credito-0"]').fill('Fuente: prueba de la consola');
    await expect(page.getByTestId('celebra-problemas')).toHaveCount(0);
  });

  await test.step('crea la edición: queda en borrador y el portal aún no la ve', async () => {
    await page.getByTestId('celebra-guardar').click();
    await expect(page.getByTestId('celebra-aviso')).toContainText('Cambios guardados', { timeout: 30_000 });
    await expect(page.getByTestId('celebra-publicar')).toBeVisible();
    const anonimo = await (await browser.newContext()).newPage();
    const respuesta = await anonimo.request.get(`/api/v1/publico/celebra-la-musica/ediciones/${anio}`);
    expect(respuesta.status()).toBe(404);
    await anonimo.context().close();
  });

  await test.step('la vista previa muestra el borrador con su aviso', async () => {
    const [previa] = await Promise.all([page.context().waitForEvent('page'), page.getByTestId('celebra-vista-previa').click()]);
    await expect(previa.getByTestId('aviso-vista-previa')).toContainText('no está publicada', { timeout: 30_000 });
    await expect(previa.getByTestId('celebra-titulo')).toContainText(String(anio));
    await previa.close();
  });

  await test.step('publica y el portal la muestra completa, sin sesión', async () => {
    await page.getByTestId('celebra-publicar').click();
    await expect(page.getByTestId('celebra-aviso')).toContainText('quedó publicada', { timeout: 30_000 });
    await expect(page.getByTestId('celebra-historial')).toContainText('la publicó');
    const publico = await (await browser.newContext()).newPage();
    await publico.goto(`/pnmc/estrategias/celebra-la-musica/${anio}`, { waitUntil: 'domcontentloaded' });
    await expect(publico.getByTestId('celebra-titulo')).toContainText(String(anio), { timeout: 30_000 });
    await expect(publico.getByTestId('preguntas')).toContainText('¿Cuesta entrar?');
    await expect(publico.getByTestId('caja-de-herramientas')).toContainText('Guía de prueba');
    await expect(publico.getByTestId('galeria')).toContainText('Fuente: prueba de la consola');
    await publico.context().close();
  });

  await test.step('despublica y deja de verse (limpieza de la prueba)', async () => {
    await page.getByTestId('celebra-despublicar').click();
    await expect(page.getByTestId('celebra-aviso')).toContainText('dejó de estar publicada', { timeout: 30_000 });
    const anonimo = await (await browser.newContext()).newPage();
    expect((await anonimo.request.get(`/api/v1/publico/celebra-la-musica/ediciones/${anio}`)).status()).toBe(404);
    await anonimo.context().close();
  });
});
