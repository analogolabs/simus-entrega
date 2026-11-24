import { Browser, Page, expect, test } from '@playwright/test';

/**
 * Galería en la consola: crear un álbum de videos, publicarlo, destacarlo, verlo en el portal y eliminarlo. @backend
 * ESCRIBE en la base: crea un álbum con dirección única y lo elimina al terminar.
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

test('crear un álbum de videos, publicarlo, destacarlo, verlo en el portal y eliminarlo', { tag: '@backend' }, async ({ browser }) => {
  test.setTimeout(180_000);
  const sufijo = Date.now().toString(36);
  const titulo = `Prueba de consola ${sufijo}`;
  const slug = `prueba-de-consola-${sufijo}`;
  const page = await consola(browser);

  await test.step('abre la sección', async () => {
    await page.goto('/administracion/galeria', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('galeria-albumes')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Álbumes por página')).toBeVisible();
  });

  await test.step('crea el álbum: la dirección sale del título y un enlace de Vimeo se rechaza', async () => {
    await page.getByTestId('galeria-nuevo').click();
    await page.getByTestId('galeria-titulo').fill(titulo);
    await expect(page.getByTestId('galeria-slug')).toHaveValue(slug);
    await page.locator('select[name="galeriaTipo"]').selectOption('videos');
    await page.getByTestId('galeria-items-anadir-video').click();
    await page.getByTestId('galeria-items-enlace-nuevo').fill('https://vimeo.com/123');
    await page.getByTestId('galeria-items-titulo-nuevo').fill('Un video');
    await page.getByTestId('galeria-items-confirmar-video').click();
    await expect(page.getByRole('alert')).toContainText('Vimeo');
    await page.getByTestId('galeria-items-enlace-nuevo').fill('https://www.youtube.com/watch?v=Rv5Oiq8UXi0');
    await page.getByTestId('galeria-items-confirmar-video').click();
    await expect(page.getByTestId('galeria-items-conteo')).toContainText('1 ítem');
    await page.getByTestId('galeria-guardar').click();
    await expect(page.getByTestId('galeria-editor-aviso')).toContainText('borrador', { timeout: 30_000 });
  });

  await test.step('es borrador: el portal no lo ve; al publicarlo, sí', async () => {
    const anonimo = await (await browser.newContext()).newPage();
    expect((await anonimo.request.get(`/api/v1/publico/galeria/albumes/${slug}`)).status()).toBe(404);
    await page.getByTestId('galeria-publicar').click();
    await expect(page.getByTestId('galeria-editor-aviso')).toContainText('publicado', { timeout: 30_000 });
    expect((await anonimo.request.get(`/api/v1/publico/galeria/albumes/${slug}`)).status()).toBe(200);
    await anonimo.context().close();
  });

  await test.step('lo destaca desde la lista', async () => {
    await page.getByTestId('galeria-volver').click();
    await page.getByRole('searchbox').first().fill(titulo);
    const fila = page.locator(`[data-album="${slug}"]`);
    await expect(fila).toBeVisible({ timeout: 15_000 });
    await fila.locator('app-menu-de-acciones button').first().click();
    await page.getByText('Destacar en el portal').click();
    await expect(page.getByTestId('galeria-aviso')).toContainText('Destacados');
  });

  await test.step('lo elimina con confirmación', async () => {
    await page.locator(`[data-album="${slug}"] app-menu-de-acciones button`).first().click();
    await page.getByText('Eliminar', { exact: true }).click();
    await page.getByTestId('galeria-confirmar-eliminar').click();
    await expect(page.getByTestId('galeria-aviso')).toContainText('Se eliminó', { timeout: 30_000 });
    expect((await page.request.get(`/api/v1/publico/galeria/albumes/${slug}`)).status()).toBe(404);
  });
});
