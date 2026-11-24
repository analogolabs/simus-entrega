import { expect, test, type Page } from '@playwright/test';

/**
 * «Mi espacio» (ME): el espacio personal con navegación lateral por grupos y el contenido a todo el ancho.
 *
 * Usa dos cuentas de la siembra de demostración: una persona sin organización y una administradora de
 * una organización. Necesita la API con la base sembrada: va con `@backend`.
 */
async function ingresar(page: Page, correo: string): Promise<void> {
  await page.goto('/ingresar');
  await page.fill('#acceso-correo', correo);
  await page.fill('#acceso-contrasena', 'admin');
  await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL(/\/gestion/, { timeout: 60_000 });
}

test.describe('Mi espacio', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('una persona sin organización recorre su espacio: resumen, datos y seguridad a todo el ancho', { tag: '@backend' }, async ({ page }) => {
    await ingresar(page, 'valentina.ocampo@correo.test');
    await page.goto('/gestion/cuenta');

    const navegacion = page.getByRole('navigation', { name: 'Secciones de tu cuenta' });
    await expect(navegacion.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    for (const nombre of ['Mi actividad y solicitudes', 'Perfil público', 'Datos personales', 'Contraseña y seguridad', 'Mis autorizaciones', 'Mis organizaciones', 'Procesos']) {
      await expect(navegacion.getByRole('link', { name: nombre })).toBeVisible();
    }

    // El resumen dice en qué está la cuenta, y el perfil público es opcional.
    // (PANEL, decisión 126) El estado de la cuenta solo aparece si falta algo; con todo completo no se pinta.
    await expect(page.locator('#inicio-titulo')).toBeVisible();
    if (await page.getByTestId('estado-de-la-cuenta').count()) {
      await expect(page.getByTestId('avance-de-la-cuenta')).toContainText(/\d de 2 pasos de la cuenta/);
    }
    await expect(page.getByTestId('resumen-de-procesos').getByRole('link')).toHaveCount(3);

    // Datos personales: el formulario ya no vive en una columna estrecha a la izquierda.
    await navegacion.getByRole('link', { name: 'Datos personales' }).click();
    await expect(page).toHaveURL(/\/gestion\/cuenta\/datos$/);
    await expect(navegacion.getByRole('link', { name: 'Datos personales' })).toHaveAttribute('aria-current', 'page');
    const formulario = page.locator('section[aria-labelledby="datos-titulo"]');
    await expect(formulario).toBeVisible();
    const ancho = (await formulario.boundingBox())?.width ?? 0;
    expect(ancho, 'la tarjeta de datos usa más de 36 rem (576 px)').toBeGreaterThan(640);
    await expect(page.locator('#seguridad-titulo')).toHaveCount(0);

    // Contraseña y seguridad: la contraseña y el cierre de sesión; las autorizaciones tienen su propia pantalla.
    await navegacion.getByRole('link', { name: 'Contraseña y seguridad' }).click();
    await expect(page).toHaveURL(/\/gestion\/cuenta\/seguridad$/);
    await expect(page.locator('#seguridad-titulo')).toBeVisible();
    await expect(page.locator('app-mis-autorizaciones')).toHaveCount(0);
    await expect(page.locator('#datos-titulo')).toHaveCount(0);

    // Mis autorizaciones, aparte; la dirección vieja de la pantalla sigue llevando allí.
    await navegacion.getByRole('link', { name: 'Mis autorizaciones' }).click();
    await expect(page).toHaveURL(/\/gestion\/cuenta\/autorizaciones$/);
    await expect(page.locator('app-mis-autorizaciones')).toBeVisible();
    await expect(page.locator('#seguridad-titulo')).toHaveCount(0);
    await page.goto('/gestion/mis-autorizaciones');
    await expect(page).toHaveURL(/\/gestion\/cuenta\/autorizaciones$/);
  });

  test('una administradora ve sus organizaciones con el rol y las abre sin confundirlas con su espacio', { tag: '@backend' }, async ({ page }) => {
    await ingresar(page, 'lucia.ramirez@cantaclaro.test');
    await page.goto('/gestion/cuenta');

    const organizaciones = page.getByTestId('resumen-de-organizaciones');
    await expect(organizaciones).toContainText('Corporación Cultural Cantaclaro');
    await expect(organizaciones).toContainText('Administrador');
    await organizaciones.getByRole('link', { name: /Cantaclaro/ }).click();
    await expect(page).toHaveURL(/\/gestion\/o\/\d+\/resumen$/);
  });
});
