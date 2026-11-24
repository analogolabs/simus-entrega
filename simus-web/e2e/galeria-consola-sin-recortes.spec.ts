import { expect, test } from '@playwright/test';
import { recortesDe } from './apoyo/sin-recortes';

/**
 * La sección «Galería» de la consola sin recortes ni solapes a 360, 390, 768, 1024 y 1280 px: lista, editor de un álbum (con vista previa) y «Sin álbum».
 * Solo lectura. Requiere al menos un álbum (la demo sembrada los trae). @backend
 */
const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? 'admin' };

for (const ancho of [360, 390, 768, 1024, 1280]) {
  test(`Galería de la consola sin recortes a ${ancho} px`, { tag: '@backend' }, async ({ browser }) => {
    test.setTimeout(120_000);
    const contexto = await browser.newContext({ viewport: { width: ancho, height: ancho < 600 ? 800 : 900 }, hasTouch: ancho < 1100, isMobile: ancho < 600, locale: 'es-CO' });
    await contexto.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), WEBMASTER.email);
    const page = await contexto.newPage();
    await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(WEBMASTER.email);
    await page.locator('input[type="password"]').fill(WEBMASTER.password);
    await page.getByRole('button', { name: 'Entrar al panel' }).click();
    await page.waitForTimeout(2500);
    const fallos: string[] = [];
    const revisar = async (donde: string) => { for (const h of await recortesDe(page)) fallos.push(`${donde} · ${h.tipo} · ${h.elemento} · ${h.detalle}`); };

    await page.goto('/administracion/galeria', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('galeria-albumes')).toBeVisible({ timeout: 30_000 });
    await revisar('lista');

    await page.locator('[data-album] app-menu-de-acciones button').first().click();
    await page.getByText('Editar el álbum').first().click();
    await expect(page.getByTestId('galeria-editor-titulo')).toBeVisible();
    await page.waitForTimeout(800);
    await revisar('editor');

    await page.getByTestId('galeria-volver').click();
    await page.getByRole('tab', { name: /Sin álbum/ }).or(page.getByRole('button', { name: /Sin álbum/ })).first().click();
    await page.waitForTimeout(1000);
    await revisar('sin álbum');
    await contexto.close();
    expect(fallos, `Recortes o desbordes a ${ancho} px:\n${fallos.join('\n')}`).toEqual([]);
  });
}
