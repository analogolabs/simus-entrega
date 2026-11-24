import { test, expect } from '@playwright/test';

/**
 * Noticias, Agenda y Editorial: filtros que no crecen ni hablan en norma catalográfica (G6).
 *
 * Necesita la API y la base de demostración (`@backend`). Se corre a mano contra el entorno vivo:
 *
 *   SIMUS_BASE_URL=http://localhost:4348 npx playwright test e2e/filtros-del-portal.spec.ts
 */
test.describe('Filtros del portal', { tag: '@backend' }, () => {
  test('Noticias: las categorías son un desplegable con conteo y la barra no crece', async ({ page }) => {
    await page.goto('/noticias');
    const barra = page.locator('[data-testid="categorias-de-noticias"]');
    await expect(barra).toBeVisible();
    // Dos desplegables: «Categoría» y «Campaña» (las campañas se añadieron al filtro de Noticias).
    await expect(barra.locator('app-filtro-desplegable')).toHaveCount(2);
    const categoria = barra.locator('app-filtro-desplegable[identificador="categoria-de-noticias"]');
    expect((await barra.boundingBox())!.height).toBeLessThan(80);

    await categoria.locator('.filtro__control').click();
    const opciones = page.locator('[role="listbox"] [role="option"]');
    await expect(opciones.first()).toContainText('Todas las categorías');
    // Cada opción lleva cuántas noticias tiene.
    expect(await opciones.nth(1).locator('.filtro__conteo').innerText()).toMatch(/^\d+$/);

    await opciones.nth(1).click();
    // El filtro puesto sale como un chip («Quitar filtro Categoría: …») en la franja de filtros activos, bajo la barra.
    await expect(page.locator('[data-filtros-activos]').getByRole('button', { name: /^Quitar filtro / })).toBeVisible();
    await expect(page).toHaveURL(/categoria=/);
  });

  test('Editorial: el tipo de material habla de libros, partituras, audio y video, no de la norma RDA', async ({ page }) => {
    await page.goto('/editorial');
    // Las opciones salen de las fichas: se espera a que el catálogo termine de cargar.
    await expect(page.locator('span.bg-verde-claro').first()).toBeVisible({ timeout: 30_000 });
    const filtro = page.locator('[data-filtro="material-del-catalogo"]');
    await expect(filtro).toBeVisible();
    await filtro.click();
    const etiquetas = (await page.locator('[role="listbox"] [role="option"]').allInnerTexts()).join(' | ');

    expect(etiquetas).toMatch(/Libro/);
    expect(etiquetas).not.toMatch(/bidimensional|sin mediación|música notada|música interpretada/i);
    await page.keyboard.press('Escape');

    // El soporte, en la palabra de uso común.
    await page.locator('[data-filtro="soporte-del-catalogo"]').click();
    const soportes = (await page.locator('[role="listbox"] [role="option"]').allInnerTexts()).join(' | ');
    expect(soportes).not.toMatch(/volumen|videodisco/i);
  });

  test('Editorial: la etiqueta de cada tarjeta es el tipo corto y no la frase de la fuente', async ({ page }) => {
    await page.goto('/editorial');
    const etiquetas = page.locator('span.bg-verde-claro');
    await expect(etiquetas.first()).toBeVisible();
    const textos = await etiquetas.allInnerTexts();
    for (const texto of textos) {
      expect(texto.length, `etiqueta demasiado larga: ${texto}`).toBeLessThan(22);
      expect(texto, `en mayúsculas sostenidas: ${texto}`).not.toBe(texto.toUpperCase());
    }
  });
});
