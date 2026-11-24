import { expect, test, type Page } from '@playwright/test';

/**
 * El perfil público enriquecido (ME, docs/desarrollo/19-cuentas-y-organizaciones.md §19.12) de punta a punta: una persona completa su ficha, elige qué
 * organización mostrar y quién la ve, y la ficha pública dice lo que decidió. Usa la cuenta de Lucía de la siembra de
 * demostración y necesita la API con la base sembrada: va con `@backend`.
 */
async function ingresar(page: Page, correo: string): Promise<void> {
  await page.goto('/ingresar');
  await page.fill('#acceso-correo', correo);
  await page.fill('#acceso-contrasena', 'admin');
  await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL(/\/gestion/, { timeout: 60_000 });
}

test.describe('Perfil público enriquecido', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('completa la ficha, elige la organización y la ficha pública lo muestra', { tag: '@backend' }, async ({ page, browser }) => {
    const marca = `Bio ${Date.now()}`;
    await ingresar(page, 'lucia.ramirez@cantaclaro.test');
    await page.goto('/gestion/cuenta/perfil-publico');

    // Dos columnas: el formulario y, al lado, quién lo ve, la vista previa y el historial.
    await expect(page.locator('#perfil-bio-corta')).toBeVisible();
    await expect(page.locator('[data-historial]')).toBeVisible();

    await page.fill('#perfil-bio-corta', marca);
    await page.fill('#perfil-bio-larga', `${marca}: biografía larga de la ficha.`);
    await page.fill('#perfil-oficio', 'Narradora oral');
    await page.keyboard.press('Enter');
    await page.locator('[data-organizaciones] input[type="checkbox"]').first().check();

    // La vista previa repite lo escrito antes de guardar.
    await expect(page.locator('#perfil-vista-previa').locator('xpath=ancestor::section[1]')).toContainText(marca);

    await page.getByRole('button', { name: 'Guardar perfil' }).click();
    await expect(page.locator('form [data-aviso-de-guardado]')).toContainText('quedó guardado');

    // El historial lo cuenta.
    await page.locator('[data-historial]').getByRole('button').first().click();
    await expect(page.locator('[data-historial-lista]')).toContainText('Biografía corta');

    // Cualquier persona, sin sesión, lee la ficha con lo nuevo.
    const clave = (await page.locator('a[href^="/ecosistema/personas/"]').first().getAttribute('href'))!;
    const anonimo = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const publica = await anonimo.newPage();
    await publica.goto(clave);
    await expect(publica.locator('[data-biografia-corta]')).toContainText(marca);
    await expect(publica.getByText('Narradora oral')).toBeVisible();
    await expect(publica.getByText('Cantaclaro').first()).toBeVisible();
    await anonimo.close();
  });
});
