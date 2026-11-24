import { expect, test, type Page } from '@playwright/test';

/**
 * Los roles de los perfiles en categorías y subcategorías, administrados desde el Catálogo (decisión 135, DIR).
 * Usa la siembra de la base local (la migración V20261118_30 deja las categorías) y va con `@backend`.
 */
const CAPTURAS = process.env.SIMUS_CAPTURAS_DIR;
const CREDENCIALES = {
  email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test',
  password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin',
};

async function entrar(page: Page) {
  await page.addInitScript((email) => { window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'); }, CREDENCIALES.email);
  await page.goto('/administracion');
  await page.locator('input[type="email"]').fill(CREDENCIALES.email);
  await page.locator('input[type="password"]').fill(CREDENCIALES.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.getByRole('navigation', { name: 'Secciones de la consola' })).toBeVisible({ timeout: 30_000 });
}

test.describe('Roles por categoría en el Catálogo', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('el Catálogo muestra el árbol de roles, añade una subcategoría y la lectura pública la trae bajo su categoría', { tag: '@backend' }, async ({ page, request }) => {
    await entrar(page);
    await page.goto('/administracion/categorias');
    await page.getByRole('button', { name: 'Perfiles de personas' }).click();

    const filas = page.locator('tr[data-nivel]');
    await expect(filas.first()).toBeVisible();
    await expect(page.locator('tr[data-nivel="0"]', { hasText: 'Creación e interpretación' })).toContainText('subcategorías');
    await expect(page.locator('tr[data-nivel="1"]', { hasText: 'Intérprete o instrumentista' })).toBeVisible();
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/06-catalogo-arbol-de-roles.png`, fullPage: true });

    const nombre = `Arreglista e2e ${Date.now()}`;
    await page.locator('tr[data-nivel="0"]', { hasText: 'Creación e interpretación' }).getByRole('button', { name: 'Añadir subcategoría' }).click();
    await page.locator('#valor-de-perfil-nombre').fill(nombre);
    await page.getByRole('button', { name: /Guardar/ }).last().click();
    await expect(page.locator('tr[data-nivel="1"]', { hasText: nombre })).toBeVisible();
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/07-catalogo-subcategoria-nueva.png`, fullPage: true });

    // La lectura pública es un árbol y la subcategoría nueva cuelga de su categoría.
    const t = await (await request.get('/api/v1/publico/taxonomia-de-perfiles')).json();
    const categoria = t.rolesPorCategoria.find((c: { codigo: string }) => c.codigo === 'creacion-e-interpretacion');
    expect(categoria.subcategorias.map((s: { nombre: string }) => s.nombre)).toContain(nombre);
  });
});
