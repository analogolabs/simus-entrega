import { test, expect } from '@playwright/test';

/**
 * Los directorios del Ecosistema son una sola pantalla (DIR).
 *
 * Festivales, Mercados, Lutería, Espacios para música en vivo y Redes y documentación comparten la
 * misma armazón: columna de búsqueda y filtros, franja de cifras con conmutador de vista, «Mostrando
 * 1–N de M», listado o cuadrícula y paginación. Aquí se recorre cada uno como lo haría una persona:
 * mira las cifras, busca, filtra, cambia de vista y abre una ficha.
 *
 * Necesita la API y la base de demostración (`@backend`). Se corre a mano contra el entorno vivo:
 *
 *   SIMUS_BASE_URL=http://localhost:4352 npx playwright test e2e/directorios-estandar.spec.ts
 */
const DIRECTORIOS = [
  { nombre: 'Mercados', ruta: '/ecosistema/mercados-musicales', buscar: 'Mercado', ficha: /\/ecosistema\/mercados-musicales\/\d+$/ },
  { nombre: 'Lutería', ruta: '/ecosistema/luteria', buscar: 'Taller', ficha: /\/ecosistema\/luteria\/\d+$/ },
  { nombre: 'Espacios', ruta: '/ecosistema/espacios', buscar: 'Café', ficha: /\/ecosistema\/espacios\/\d+$/ },
  { nombre: 'Redes', ruta: '/ecosistema/redes', buscar: 'Archivo', ficha: /\/ecosistema\/redes\/\d+$/ },
] as const;

test.describe('Directorios estándar del Ecosistema', { tag: '@backend' }, () => {
  for (const directorio of DIRECTORIOS) {
    test(`${directorio.nombre}: cifras, búsqueda, filtros, vista y ficha`, async ({ page }) => {
      await page.goto(directorio.ruta);

      // La armazón estándar: columna de filtros, franja de cifras con el conmutador y el conteo.
      await expect(page.getByRole('complementary', { name: /^Filtros del directorio de/ })).toBeVisible();
      await expect(page.locator('app-franja-metricas-ecosistema')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Modo de visualización' })).toBeVisible();
      const conteo = page.locator('[data-directorio-conteo]');
      await expect(conteo).toContainText(/Mostrando 1–\d+ de \d+/);

      // Sin mayúsculas sostenidas en lo que es del directorio: los rótulos de la columna de filtros.
      const rotulo = page.locator('aside label').first();
      expect(await rotulo.evaluate(el => getComputedStyle(el).textTransform)).toBe('none');

      // BUSCAR acota y la «✕» de `app-buscador-de-lista` limpia (UI-C; su nombre accesible es «Limpiar …», no «Borrar la búsqueda», que es de la Agenda).
      const caja = page.getByRole('searchbox').first();
      await caja.fill('zzzzzz-no-existe');
      await expect(page.locator('[data-sin-resultados]')).toBeVisible();
      await expect(page.locator('[data-sin-resultados]')).toContainText('con esta consulta');
      await page.locator('app-buscador-de-lista').first().getByRole('button', { name: /^Limpiar/ }).click();
      await expect(page.locator('[data-sin-resultados]')).toHaveCount(0);

      await caja.fill(directorio.buscar);
      await expect(conteo).toContainText(/de [1-9]\d*/);

      // FILTRAR por territorio: el municipio no se ofrece sin departamento.
      await caja.fill('');
      const departamento = page.locator('[data-filtro$="-departamento"]');
      const municipio = page.locator('[data-filtro$="-municipio"]');
      await expect(municipio).toBeDisabled();
      await departamento.click();
      // El panel se pinta tras el clic: se espera a las opciones en vez de leerlas al instante.
      await expect(page.getByRole('option').nth(1)).toBeVisible();
      expect(await page.getByRole('option').count()).toBeGreaterThan(1);
      await page.getByRole('option').nth(1).click();
      await expect(municipio).toBeEnabled();
      await expect(page.getByRole('button', { name: /Limpiar filtros \(1\)/ })).toBeVisible();
      await page.getByRole('button', { name: /Limpiar filtros/ }).click();
      await expect(page.getByRole('button', { name: /Limpiar filtros/ })).toBeDisabled();

      // CAMBIAR DE VISTA a la cuadrícula y volver.
      await page.getByTitle('Ver en cuadrícula').click();
      await expect(page.locator('[data-directorio-cuadricula]')).toBeVisible();
      await page.getByTitle('Ver en listado').click();
      await expect(page.locator('[data-directorio-listado]')).toBeVisible();

      // ABRIR UNA FICHA desde el listado.
      await page.locator('[data-directorio-listado] a', { hasText: 'Ver ficha' }).first().click();
      await expect(page).toHaveURL(directorio.ficha);
    });
  }

  test('Festivales es el mismo directorio: cifras, búsqueda, etiquetas que filtran y ficha (DIR-06)', async ({ page }) => {
    await page.goto('/ecosistema/festivales');
    await expect(page.getByRole('complementary', { name: /^Filtros del directorio de/ })).toBeVisible();
    await expect(page.locator('app-franja-metricas-ecosistema')).toBeVisible();
    const conteo = page.locator('[data-directorio-conteo]');
    await expect(conteo).toContainText(/Mostrando 1–\d+ de \d+/);

    // La búsqueda acota y el vacío dice qué hacer, con el texto que edita el CMS.
    const caja = page.getByRole('searchbox').first();
    await caja.fill('zzzzzz-no-existe');
    await expect(page.locator('[data-sin-resultados]')).toBeVisible();
    await page.locator('app-buscador-de-lista').first().getByRole('button', { name: /^Limpiar/ }).click();
    await expect(page.locator('[data-sin-resultados]')).toHaveCount(0);

    // Una etiqueta del registro filtra la lista y deja el filtro puesto (no navega).
    const etiqueta = page.locator('[data-festival-fila] [data-etiqueta-filtro]').first();
    await etiqueta.click();
    await expect(page.getByRole('button', { name: /Limpiar filtros \(\d+\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Limpiar filtros/ }).click();

    await page.locator('[data-directorio-listado] a', { hasText: 'Ver ficha' }).first().click();
    await expect(page).toHaveURL(/\/ecosistema\/festivales\/[\w-]+$/);
    // La ficha: datos y presencia pública en la barra lateral.
    await expect(page.getByRole('complementary', { name: 'Datos del Festival' })).toBeVisible();
  });
});
