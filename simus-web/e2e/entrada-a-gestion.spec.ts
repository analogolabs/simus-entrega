import { Browser, Page, expect, test } from '@playwright/test';

/**
 * «¿Cómo quieres entrar?» tras iniciar sesión, y el menú de cuenta sin «Actuando como» (ACC2). @backend
 *
 * Usa las cuentas de la siembra completa de demostración (; contraseña `admin`):
 *   - lucia.ramirez@cantaclaro.test  → una organización (Cantaclaro) y su espacio personal.
 *   - camilo.rojas@llanoadentro.test → dos organizaciones.
 *   - valentina.ocampo@correo.test   → persona sin organización.
 */
const CLAVE = 'admin';

async function ingresar(browser: Browser, correo: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/ingresar', { waitUntil: 'domcontentloaded' });
  await page.fill('#acceso-correo', correo);
  await page.fill('#acceso-contrasena', CLAVE);
  await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
  return page;
}

test('una cuenta con organización elige cómo entrar y el menú dice solo el nombre de la organización', { tag: '@backend' }, async ({ browser }) => {
  const page = await ingresar(browser, 'lucia.ramirez@cantaclaro.test');

  await test.step('tras iniciar sesión aparece «¿Cómo quieres entrar?», no una organización', async () => {
    await expect(page).toHaveURL(/\/gestion\/entrada$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: '¿Cómo quieres entrar?' })).toBeVisible();
    await expect(page.getByTestId('entrar-mi-espacio')).toContainText('Mi espacio');
    const organizacion = page.locator('[data-testid^="entrar-organizacion-"]').first();
    await expect(organizacion).toContainText('Corporación Cultural Cantaclaro');
    await expect(organizacion).toContainText('Administrador');
    await expect(page.locator('body')).not.toContainText('Actuando como');
  });

  await test.step('entrar a la organización abre su panel y deja el rol, sin «Actuando como»', async () => {
    await page.locator('[data-testid^="entrar-organizacion-"]').first().click();
    await expect(page).toHaveURL(/\/gestion\/o\/\d+\/resumen/, { timeout: 30_000 });
    await expect(page.getByTestId('rol-en-organizacion')).toHaveText('Administrador');
    await expect(page.getByTestId('nombre-organizacion-activa')).toContainText('Corporación Cultural Cantaclaro');
    await expect(page.locator('body')).not.toContainText('Actuando como');
  });

  await test.step('el menú de cuenta no ofrece «Registrar una organización»', async () => {
    await page.locator('[data-menu-de-cuenta]').click();
    const menu = page.locator('[data-menu-de-cuenta-panel]');
    await expect(menu.locator('[data-menu-mi-espacio]')).toBeVisible();
    await expect(menu.locator('[data-menu-organizacion]').first()).toContainText('Corporación Cultural Cantaclaro');
    await expect(menu.locator('[data-menu-registrar-organizacion]')).toHaveCount(0);
    await expect(menu).not.toContainText('Registrar una organización');
  });

  await test.step('en un inicio de sesión nuevo la pantalla se muestra otra vez y preselecciona la última vez', async () => {
    const otra = await ingresar(browser, 'lucia.ramirez@cantaclaro.test');
    await expect(otra).toHaveURL(/\/gestion\/entrada$/, { timeout: 30_000 });
    await expect(otra.getByTestId('entrada-a-gestion')).toBeVisible();
  });
});

test('mi espacio se elige desde la entrada y queda como la última vez', { tag: '@backend' }, async ({ browser }) => {
  const page = await ingresar(browser, 'camilo.rojas@llanoadentro.test');
  await expect(page).toHaveURL(/\/gestion\/entrada$/, { timeout: 30_000 });
  await expect(page.locator('[data-testid^="entrar-organizacion-"]')).toHaveCount(2);

  await page.getByTestId('entrar-mi-espacio').click();
  await expect(page).toHaveURL(/\/gestion\/cuenta$/, { timeout: 30_000 });

  await page.goto('/gestion/entrada', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('entrar-mi-espacio')).toHaveAttribute('data-recordada', 'true');
});

test('una cuenta sin organización entra directo a su espacio y no ve la pantalla de entrada', { tag: '@backend' }, async ({ browser }) => {
  const page = await ingresar(browser, 'valentina.ocampo@correo.test');
  await expect(page).toHaveURL(/\/gestion\/cuenta/, { timeout: 30_000 });
  await expect(page.getByTestId('entrada-a-gestion')).toHaveCount(0);
});
