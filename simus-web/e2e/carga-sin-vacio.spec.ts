import { test, expect, type Page } from '@playwright/test';

/**
 * Noticias: mientras carga se ve la forma de la página, y «vacío» solo aparece cuando la carga terminó
 * (decisión 117 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`).
 *
 * La API de noticias se simula con un retardo de 1,5 s para poder mirar la pantalla DURANTE la carga;
 * no necesita base de datos. Se corre contra un `ng serve`:
 *
 *   SIMUS_BASE_URL=http://localhost:4300 npx playwright test e2e/carga-sin-vacio.spec.ts
 */
const ESPERA_MS = 1500;

const noticia = (id: number) => ({
  id, slug: `noticia-${id}`, titulo: `Noticia de prueba ${id}`, resumen: 'Un resumen corto.', cuerpo: 'Cuerpo de la noticia.',
  fechaPublicacion: '2026-11-01T00:00:00Z', imagenRuta: null, imagenAlternativa: null, autoriaNombre: null,
  imagenArchivoId: null, imagenUrl: null, imagenAlt: null, categoriaId: null, categoria: 'Convocatorias',
  estado: 'publicado', estadoEfectivo: 'publicado', version: 1, etiquetas: [], practicasMusicales: [],
  territoriosSonoros: [], procedencia: null, proyectosTransversales: [], fechaActualizacion: '2026-11-01T00:00:00Z',
});

async function simularNoticias(page: Page, items: unknown[]): Promise<void> {
  await page.route('**/api/v1/publico/noticias?**', async ruta => {
    await new Promise(r => setTimeout(r, ESPERA_MS));
    await ruta.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ items, pagina: 1, tamano: 50, total: items.length, totalPaginas: 1 }),
    });
  });
}

test.describe('Carga de Noticias', () => {
  test('con datos: esqueleto de inmediato, sin «archivo vacío», y después las noticias', async ({ page }) => {
    await simularNoticias(page, [1, 2, 3, 4, 5].map(noticia));
    await page.goto('/noticias');

    const esqueleto = page.locator('[data-noticias-cargando] [data-esqueleto]').first();
    await expect(esqueleto).toBeVisible({ timeout: 1000 });
    await expect(page.locator('[data-noticias-cargando]')).toHaveAttribute('data-noticias-cargando', '');
    await expect(esqueleto).toHaveAttribute('aria-busy', 'true');
    // Un solo texto para lector de pantalla por esqueleto.
    expect(await esqueleto.locator('.sr-only').count()).toBe(1);
    // Durante la carga NUNCA aparece el vacío.
    await expect(page.getByText('Archivo de actualidad vacío')).toHaveCount(0);

    await expect(page.getByText('Noticia de prueba 1').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-noticias-cargando]')).toHaveCount(0);
    await expect(page.getByText('Archivo de actualidad vacío')).toHaveCount(0);
  });

  test('sin noticias: el vacío real aparece solo al terminar la carga', async ({ page }) => {
    await simularNoticias(page, []);
    await page.goto('/noticias');

    await expect(page.locator('[data-noticias-cargando] [data-esqueleto]').first()).toBeVisible({ timeout: 1000 });
    await expect(page.getByText('Archivo de actualidad vacío')).toHaveCount(0);

    await expect(page.getByText('Archivo de actualidad vacío')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-noticias-cargando]')).toHaveCount(0);
  });

  test('abrir una noticia desde la lista no vuelve a mostrar un esqueleto de ficha', async ({ page }) => {
    await simularNoticias(page, [1, 2, 3, 4, 5].map(noticia));
    await page.route('**/api/v1/publico/noticias/noticia-1', async ruta => {
      await new Promise(r => setTimeout(r, ESPERA_MS));
      await ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noticia(1)) });
    });
    await page.goto('/noticias');
    await page.getByRole('link', { name: 'Noticia de prueba 1' }).first().click();
    // La lista ya tenía la noticia: la ficha se pinta sin esperar los 1,5 s de la API.
    await expect(page.getByRole('heading', { name: 'Noticia de prueba 1' }).first()).toBeVisible({ timeout: 800 });
    await expect(page.locator('[data-esqueleto="ficha"]')).toHaveCount(0);
  });
});
