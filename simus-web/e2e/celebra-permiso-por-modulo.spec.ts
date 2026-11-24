import { test, expect, Browser, Page } from '@playwright/test';

/**
 * «Celebra la Música» es un apartado propio: solo lo abre quien tiene el módulo `celebra`. El webmaster lo concede y lo
 * revoca en «Usuarios y roles > Módulos del gestor»; la barra del Gestor lo refleja y la dirección directa dice «Sin
 * acceso» cuando no lo tiene. Requiere el entorno local con las cuentas de demostración. @backend
 */
const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? 'admin' };
const GESTOR = { email: process.env.SIMUS_GESTOR_EMAIL ?? 'gestor@simus.test', password: process.env.SIMUS_GESTOR_PASSWORD ?? 'admin' };

async function consola(browser: Browser, cuenta: { email: string; password: string }): Promise<Page> {
  const context = await browser.newContext({ locale: 'es-CO' });
  await context.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), cuenta.email);
  const page = await context.newPage();
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(cuenta.email);
  await page.locator('input[type="password"]').fill(cuenta.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

test('el webmaster concede y revoca «Celebra la Música» y el gestor lo ve o no según el permiso', { tag: '@backend' }, async ({ browser }) => {
  test.setTimeout(180_000);
  const web = await consola(browser, WEBMASTER);
  const gestor = await consola(browser, GESTOR);
  try {
    // El webmaster lo tiene siempre, con entrada propia en la barra.
    await expect(web.locator('aside#navegacion-administrativa')).toContainText('Celebra la Música');

    await web.goto('/administracion/usuarios');
    await web.getByRole('tab', { name: /Módulos del gestor/ }).or(web.getByRole('button', { name: /Módulos del gestor/ })).first().click();
    await expect(web.locator('[data-modulos-del-gestor]')).toBeVisible();
    await web.locator('[data-modulo-fila="celebra"]').getByRole('button', { name: 'Celebra la Música', exact: true }).click();
    const interruptor = web.locator('app-panel-lateral [data-cuenta] button[role="switch"]').first();
    await expect(interruptor).toBeVisible();

    // Sin el módulo: «Sin acceso» y sin entrada en la barra.
    if ((await interruptor.getAttribute('aria-checked')) === 'true') {
      await interruptor.click();
      await web.getByRole('button', { name: 'Quitar acceso' }).click();
    }
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
    await gestor.goto('/administracion/celebra-la-musica');
    await expect(gestor.getByText('Sin acceso a este apartado')).toBeVisible();
    await expect(gestor.locator('aside#navegacion-administrativa')).not.toContainText('Celebra la Música');

    // Con el módulo: el apartado abre y la barra lo muestra.
    await interruptor.click();
    await expect(interruptor).toHaveAttribute('aria-checked', 'true');
    await gestor.goto('/administracion/celebra-la-musica');
    await expect(gestor.getByText('Sin acceso a este apartado')).toHaveCount(0);
    await expect(gestor.locator('aside#navegacion-administrativa')).toContainText('Celebra la Música');
    await expect(gestor.getByRole('button', { name: 'Nueva edición' })).toBeVisible({ timeout: 30_000 });

    // La pestaña de Categorías ya no ofrece Celebra.
    await gestor.goto('/administracion/categorias');
    await expect(gestor.getByRole('button', { name: /Celebra la música/i })).toHaveCount(0);

    // Se deja como estaba: sin el módulo.
    await interruptor.click();
    await web.getByRole('button', { name: 'Quitar acceso' }).click();
    await expect(interruptor).toHaveAttribute('aria-checked', 'false');
  } finally {
    await web.context().close();
    await gestor.context().close();
  }
});
