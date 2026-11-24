import { test, expect } from '@playwright/test';

/**
 * Catálogo Editorial (E-2…E-5): el servidor ordena, filtra y pagina; la pantalla solo pinta.
 *
 * Necesita la API y la base de demostración con el acervo (`@backend`). Se corre a mano contra el entorno vivo:
 *
 *   SIMUS_BASE_URL=http://localhost:4300 npx playwright test e2e/editorial-explora-en-el-servidor.spec.ts
 */
test.describe('Editorial explora en el servidor', { tag: '@backend' }, () => {
  test('E-5: pulsar un encabezado ordena por el servidor, queda en la URL y dice aria-sort', async ({ page }) => {
    await page.goto('/editorial?vista=table');
    const anio = page.locator('th button[data-ordenar="anio"]');
    await expect(anio).toBeVisible({ timeout: 30_000 });

    const pedido = page.waitForRequest(r => r.url().includes('/publico/catalogo-editorial') && r.url().includes('orden=anio') && r.url().includes('sentido=desc'));
    await anio.click();
    await pedido;
    await expect(page.locator('th[aria-sort]').filter({ has: page.locator('button[data-ordenar="anio"]') })).toHaveAttribute('aria-sort', 'descending');
    await expect(page).toHaveURL(/orden=anio/);
    await expect(page).toHaveURL(/sentido=desc/);

    // De más reciente a más antiguo: el primer año de la lista no es menor que el último.
    const anios = (await page.locator('tbody tr[id^="resource-row-"] [data-filtrar="anio"]').allInnerTexts()).map(Number).filter(Boolean);
    expect(anios.length).toBeGreaterThan(3);
    expect(anios[0]).toBeGreaterThanOrEqual(anios[anios.length - 1]);

    // Con el teclado: el encabezado es un botón y Intro lo invierte.
    await anio.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('th[aria-sort]').filter({ has: page.locator('button[data-ordenar="anio"]') })).toHaveAttribute('aria-sort', 'ascending');
  });

  test('E-5: pulsar la categoría, la autoría o el año de una fila filtra y deja un chip con su «X»', async ({ page }) => {
    await page.goto('/editorial?vista=table');
    const fila = page.locator('tbody tr[id^="resource-row-"]').first();
    await expect(fila).toBeVisible({ timeout: 30_000 });
    const total = Number((await page.locator('[role="status"] .font-alternate').first().innerText()).trim());

    const autor = fila.locator('[data-filtrar="autor"]').first();
    const nombre = (await autor.innerText()).trim();
    await autor.click();
    await expect(page).toHaveURL(/autor=/);
    const chips = page.locator('[data-testid="filtros-aplicados"]');
    await expect(chips).toContainText(nombre);
    await expect(page.locator('[role="status"] .font-alternate').first()).not.toHaveText(String(total));
    expect(Number((await page.locator('[role="status"] .font-alternate').first().innerText()).trim())).toBeLessThan(total);
    // Pulsar el valor no abre la ficha de la fila.
    await expect(page.locator('app-ficha-editorial')).toHaveCount(0);

    await chips.getByRole('button', { name: /Quitar filtro/ }).first().click();
    await expect(page).not.toHaveURL(/autor=/);
  });

  test('E-3: la cantidad por página se elige, se conserva en la URL y reinicia la página', async ({ page }) => {
    await page.goto('/editorial?pagina=3');
    await expect(page.locator('app-paginacion-de-lista')).toBeVisible({ timeout: 30_000 });
    await page.locator('app-paginacion-de-lista [data-filtro="catalogo-por-pagina"]').click();
    await page.locator('[role="listbox"] [role="option"]', { hasText: /^\s*12\s*$/ }).click();
    await expect(page).toHaveURL(/por=12/);
    await expect(page).not.toHaveURL(/pagina=/);
    await expect(page.locator('[data-testid="resumen-del-catalogo"]')).toContainText('Mostrando 1–12');
  });

  test('E-2: todos los temas están al alcance, y «banda» y «bandas» cuentan como uno', async ({ page }) => {
    await page.goto('/editorial');
    const todos = page.locator('[data-filtro="tema-del-catalogo"]');
    await expect(todos).toBeVisible({ timeout: 30_000 });
    await todos.click();
    // `allInnerTexts()` no espera: leía la lista antes de que se dibujara el desplegable y daba 0 (intermitente). Se espera a
    // la condición —que ya haya más de trescientas opciones— y solo entonces se leen.
    // Más de trescientos temas: ya no son ocho botones.
    await expect(async () => {
      expect(await page.locator('[role="listbox"] [role="option"]').count()).toBeGreaterThan(300);
    }).toPass({ timeout: 20_000 });
    const opciones = await page.locator('[role="listbox"] [role="option"]').allInnerTexts();
    expect(opciones.length).toBeGreaterThan(300);
    const temas = opciones.map(t => t.replace(/\d+\s*$/, '').trim().toLowerCase());
    expect(new Set(temas).size).toBe(temas.length);
    expect(temas.filter(t => t === 'banda' || t === 'bandas').length).toBeLessThanOrEqual(1);
  });
});
