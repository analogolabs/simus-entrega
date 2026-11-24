import { test, expect, Browser, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * El apartado «Módulos del gestor» de «Usuarios y roles»: se habilita y deshabilita un módulo a un Gestor, la
 * consola del Gestor lo refleja de inmediato, la dirección directa de un módulo deshabilitado dice «Sin acceso»
 * y la pantalla pasa axe (WCAG 2.2 AA). Requiere el entorno local con las cuentas de demostración.
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

async function axe(page: Page, donde: string): Promise<void> {
  await page.waitForTimeout(600);
  const resultado = await new AxeBuilder({ page })
    .withTags(['best-practice', 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const graves = resultado.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`), `axe en ${donde}`).toEqual([]);
}

test.describe('Módulos del gestor', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('el webmaster habilita y deshabilita un módulo y el gestor lo ve al instante', async ({ browser }) => {
    const web = await consola(browser, WEBMASTER);
    const gestor = await consola(browser, GESTOR);
    try {
      await web.goto('/administracion/usuarios');
      await web.getByRole('tab', { name: /Módulos del gestor/ }).or(web.getByRole('button', { name: /Módulos del gestor/ })).first().click();
      await expect(web.locator('[data-modulos-del-gestor]')).toBeVisible();
      await axe(web, 'Módulos del gestor, por módulo');

      // Vista inversa: quién tiene «Noticias».
      await web.locator('[data-modulo-fila="noticias"]').getByRole('button', { name: 'Noticias y prensa', exact: true }).click();
      const interruptor = web.locator('app-panel-lateral [data-cuenta] button[role="switch"]').first();
      await expect(interruptor).toBeVisible();
      await axe(web, 'Módulos del gestor, quién lo tiene');

      // Se deja deshabilitado, se comprueba el «Sin acceso» y se habilita.
      if ((await interruptor.getAttribute('aria-checked')) === 'true') {
        await interruptor.click();
        await web.getByRole('button', { name: 'Quitar acceso' }).click();
      }
      await expect(interruptor).toHaveAttribute('aria-checked', 'false');
      await gestor.goto('/administracion/noticias');
      await expect(gestor.getByText('Sin acceso a este apartado')).toBeVisible();

      await interruptor.click();
      await expect(interruptor).toHaveAttribute('aria-checked', 'true');
      await gestor.goto('/administracion/noticias');
      await expect(gestor.getByText('Sin acceso a este apartado')).toHaveCount(0);
      await expect(gestor.locator('aside#navegacion-administrativa')).toContainText('Noticias');

      // Por gestor: perfiles y axe.
      await web.keyboard.press('Escape');
      await web.getByRole('button', { name: 'Por gestor' }).or(web.getByRole('tab', { name: /Por gestor/ })).first().click();
      await expect(web.locator('[data-gestor-fila]').first()).toBeVisible();
      await axe(web, 'Módulos del gestor, por gestor');
    } finally {
      await web.context().close();
      await gestor.context().close();
    }
  });
});
