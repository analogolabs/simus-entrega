import { test, expect, type Page } from '@playwright/test';

/**
 * La Galería, fiel a la maqueta aprobada (opción D). Va contra la API y la web vivas con la demo sembrada
 * (`scripts/demo/sembrar-galeria.sh`): sin álbumes no hay nada que recorrer y se omite diciéndolo.
 *
 * Comprueba lo que ninguna prueba unitaria ve: que el navegador NO pide nada a YouTube hasta pulsar «Reproducir», que el visor pone la información a la
 * derecha, que las cuatro pestañas llevan a su vista, que el foco vuelve a quien abrió el visor y que a 390 px nada se desborda.
 */
async function hayGaleria(page: Page): Promise<boolean> {
  await page.goto('/galeria', { waitUntil: 'networkidle' });
  return page.locator('[data-testid="galeria-hero"]').waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false);
}

test('portada, cuatro pestañas y ningún selector de álbumes', { tag: '@backend' }, async ({ page }) => {
  test.skip(!(await hayGaleria(page)), 'La demostración no tiene álbumes en la Galería.');
  const pestañas = page.locator('[data-testid="galeria-pestanas"] [role="tab"]');
  await expect(pestañas).toHaveCount(4);
  await expect(pestañas.nth(0)).toContainText('Álbumes');
  await expect(pestañas.nth(1)).toContainText('Fotos');
  await expect(pestañas.nth(2)).toContainText('Videos');
  await expect(pestañas.nth(3)).toContainText('Sin álbum');
  await expect(page.locator('select')).toHaveCount(0);
  await expect(page.locator('[data-testid="galeria-albumes"] li').first()).toBeVisible();
});

test('el navegador no pide nada a YouTube hasta «Reproducir»', { tag: '@backend' }, async ({ page }) => {
  const terceros: string[] = [];
  page.on('request', r => { if (/youtube|ytimg|ggpht|googlevideo/.test(new URL(r.url()).hostname)) terceros.push(r.url()); });
  test.skip(!(await hayGaleria(page)), 'La demostración no tiene álbumes en la Galería.');
  await page.getByRole('tab', { name: /Videos/ }).click();
  await expect(page.locator('[data-testid="galeria-reproductor"] img.player__imagen')).toBeVisible();
  await expect(page.locator('[data-testid="galeria-lista-videos"] img').first()).toBeVisible();
  expect(terceros, 'peticiones a terceros antes de pulsar Reproducir').toEqual([]);
  // Las imágenes vienen del Banco de archivos, no de YouTube.
  const origen = await page.locator('img.player__imagen').getAttribute('src');
  expect(origen).toContain('/api/v1/publico/archivos/');
  await page.locator('[data-testid="galeria-reproducir"]').click();
  await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toHaveCount(1);
});

test('un álbum se abre desde su tarjeta y el visor muestra la información a la derecha; Esc devuelve el foco', { tag: '@backend' }, async ({ page }) => {
  test.skip(!(await hayGaleria(page)), 'La demostración no tiene álbumes en la Galería.');
  await page.locator('[data-testid^="album-"]', { hasText: /fotos/ }).first().click();
  await expect(page).toHaveURL(/\/galeria\/album\//);
  const foto = page.locator('[data-testid^="foto-"]').first();
  await foto.focus();
  await foto.press('Enter');
  const visor = page.locator('dialog[open][data-testid="galeria-visor"]');
  await expect(visor).toBeVisible();
  await expect(page).toHaveURL(/foto=\d+/);
  const cajaFoto = await visor.locator('.im__foto').boundingBox();
  const cajaInfo = await visor.locator('[data-testid="galeria-visor-info"]').boundingBox();
  expect(cajaInfo!.x, 'el panel de información va a la derecha de la foto').toBeGreaterThan(cajaFoto!.x + cajaFoto!.width - 1);
  await page.keyboard.press('ArrowRight');
  await expect(visor.locator('.cuenta')).toContainText('2 /');
  await page.keyboard.press('Escape');
  await expect(visor).toBeHidden();
  await expect(page).not.toHaveURL(/foto=/);
  await expect(page.locator('[data-testid^="foto-"]').first()).toBeFocused();
});

test('Fotos, Videos y Sin álbum cargan su vista', { tag: '@backend' }, async ({ page }) => {
  test.skip(!(await hayGaleria(page)), 'La demostración no tiene álbumes en la Galería.');
  await page.getByRole('tab', { name: /^Fotos/ }).click();
  await expect(page).toHaveURL(/\/galeria\/fotos$/);
  await expect(page.locator('[data-testid="galeria-fotos"] img').first()).toBeVisible();
  await page.getByRole('tab', { name: /^Sin álbum/ }).click();
  await expect(page).toHaveURL(/\/galeria\/sin-album$/);
  await expect(page.locator('[data-testid="galeria-sueltos"] li').first()).toBeVisible();
});

test('a 390 px nada se desborda en ninguna vista', { tag: '@backend' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  test.skip(!(await hayGaleria(page)), 'La demostración no tiene álbumes en la Galería.');
  for (const ruta of ['/galeria', '/galeria/fotos', '/galeria/videos', '/galeria/sin-album']) {
    await page.goto(ruta, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra, `${ruta} se desborda en horizontal`).toBeLessThanOrEqual(1);
  }
});
