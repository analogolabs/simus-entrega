import { expect, test, type Page } from '@playwright/test';

/**
 * La edición del perfil público (PERF): vista previa y formulario con desplazamiento propio, la foto con su zona
 * clara, los enlaces con sus redes y el portafolio de solo enlaces. Usa la cuenta de Lucía de la siembra de demostración
 * y la API con la base sembrada: va con `@backend`.
 */
async function ingresar(page: Page, correo: string): Promise<void> {
  await page.goto('/ingresar');
  await page.fill('#acceso-correo', correo);
  await page.fill('#acceso-contrasena', 'admin');
  await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL(/\/gestion/, { timeout: 60_000 });
}

// Un PNG de 1×1 píxel: basta para la regla del Banco de archivos (firma, tipo y peso).
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('Edición del perfil público', () => {
  test('el formulario y la vista previa se desplazan cada uno por su lado en pantalla ancha', { tag: '@backend' }, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ingresar(page, 'lucia.ramirez@cantaclaro.test');
    await page.goto('/gestion/cuenta/perfil-publico');
    const formulario = page.locator('[data-columna-del-formulario]');
    const vista = page.locator('[data-columna-de-la-vista-previa]');
    await expect(formulario).toBeVisible();
    await expect(vista).toBeVisible();

    const medidas = async () => page.evaluate(() => {
      const f = document.querySelector('[data-columna-del-formulario]') as HTMLElement;
      const v = document.querySelector('[data-columna-de-la-vista-previa]') as HTMLElement;
      return { f: { alto: f.clientHeight, total: f.scrollHeight, y: f.scrollTop }, v: { alto: v.clientHeight, total: v.scrollHeight, y: v.scrollTop }, pagina: window.scrollY, ventana: window.innerHeight };
    });
    const antes = await medidas();
    // Cada columna cabe en la ventana y tiene más contenido que alto: por eso se desplaza ella sola.
    expect(antes.f.total).toBeGreaterThan(antes.f.alto);
    expect(antes.f.alto).toBeLessThan(antes.ventana);
    expect(antes.v.alto).toBeLessThan(antes.ventana);

    // Desplazar el formulario hasta el final NO mueve la vista previa, que sigue a la vista.
    await formulario.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const tras = await medidas();
    expect(tras.f.y).toBeGreaterThan(0);
    expect(tras.v.y).toBe(0);
    const caja = await page.locator('[data-vista-previa]').boundingBox();
    expect(caja!.y).toBeGreaterThanOrEqual(0);
    expect(caja!.y).toBeLessThan(antes.ventana);

    // Y al revés: desplazar la vista previa no mueve el formulario.
    await formulario.evaluate(el => { el.scrollTop = 0; });
    await vista.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const alReves = await medidas();
    expect(alReves.f.y).toBe(0);
    expect(alReves.v.y).toBeGreaterThan(0);
  });

  test('en pantalla estrecha se alterna entre «Editar» y «Vista previa»', { tag: '@backend' }, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ingresar(page, 'lucia.ramirez@cantaclaro.test');
    await page.goto('/gestion/cuenta/perfil-publico');
    await expect(page.locator('#perfil-nombre-visible')).toBeVisible();
    await expect(page.locator('[data-vista-previa]')).toBeHidden();

    await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
    await expect(page.locator('[data-vista-previa]')).toBeVisible();
    await expect(page.locator('#perfil-nombre-visible')).toBeHidden();

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.locator('#perfil-nombre-visible')).toBeVisible();
  });

  test('la foto, los enlaces con su red y el portafolio de solo enlaces se editan y se guardan', { tag: '@backend' }, async ({ page, browser }) => {
    const marca = `Álbum ${Date.now()}`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await ingresar(page, 'lucia.ramirez@cantaclaro.test');
    await page.goto('/gestion/cuenta/perfil-publico');
    await expect(page.locator('#perfil-bio-corta')).toBeVisible();

    // FOTO: una zona clara, con formatos y tamaño; un archivo que no es imagen se rechaza diciendo por qué.
    await expect(page.locator('[data-foto-formatos]')).toContainText('WebP, PNG o JPEG, de hasta 2 MB');
    const entrada = page.locator('#perfil-foto');
    await entrada.setInputFiles({ name: 'curriculo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await expect(page.locator('#perfil-foto-error')).toContainText('no es una imagen');
    await entrada.setInputFiles({ name: 'retrato.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await expect(page.locator('[data-foto-pendiente]')).toContainText('Se subirá cuando pulses «Guardar perfil»');
    await page.fill('#perfil-foto-alt', 'Retrato de Lucía con su gaita');

    // ENLACES: «Añadir enlace» ofrece las redes; una dirección de otra red se señala; una red no se repite.
    await page.locator('[data-anadir-enlace]').click();
    await expect(page.locator('[data-red-opcion]')).toHaveCount(10);
    await page.locator('[data-red-opcion="youtube"]').click();
    const filas = page.locator('[data-enlace-fila]');
    const fila = filas.last();
    await expect(fila).toHaveAttribute('data-red', 'youtube');
    await fila.locator('input').fill('https://www.instagram.com/otra');
    await fila.locator('input').blur();
    await expect(fila).toContainText('no es de YouTube');
    await fila.locator('input').fill('www.youtube.com/@lucia.canta');
    await expect(fila.locator('[data-error-de-campo]')).toHaveCount(0);
    await page.locator('[data-anadir-enlace]').click();
    await expect(page.locator('[data-red-opcion="youtube"]')).toBeDisabled();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).first().click();

    // PORTAFOLIO: título, clase, enlace, descripción y año; se ordena, se edita y se quita.
    await page.locator('[data-anadir-al-portafolio]').click();
    await page.getByRole('button', { name: 'Añadir al portafolio' }).click();
    await expect(page.locator('#perfil-portafolio-titulo-error')).toContainText('título');
    await expect(page.locator('#perfil-portafolio-url-error')).toContainText('dirección');
    await page.fill('#perfil-portafolio-titulo', marca);
    await page.getByLabel('Texto', { exact: true }).check();
    await page.fill('#perfil-portafolio-url', 'prensa.example.org/cronica');
    await page.fill('#perfil-portafolio-descripcion', 'Crónica del festival.');
    await page.fill('#perfil-portafolio-anio', '2024');
    await page.getByRole('button', { name: 'Añadir al portafolio' }).click();
    const item = page.locator('[data-portafolio-item]', { hasText: marca });
    await expect(item).toContainText('Texto · 2024');
    await expect(item).toContainText('https://prensa.example.org/cronica');

    await item.getByRole('button', { name: /^Editar/ }).click();
    await page.fill('#perfil-portafolio-titulo', `${marca} (editado)`);
    await page.getByRole('button', { name: 'Guardar el elemento' }).click();
    await expect(page.locator('[data-portafolio-item]', { hasText: `${marca} (editado)` })).toBeVisible();

    // La vista previa repite lo escrito antes de guardar.
    await expect(page.locator('[data-vp-portafolio]')).toContainText(`${marca} (editado)`);
    await expect(page.locator('[data-vp-enlaces]')).toContainText('YouTube');

    await page.getByRole('button', { name: 'Guardar perfil' }).click();
    await expect(page.locator('form [data-aviso-de-guardado]')).toContainText('quedó guardado');

    // Tras recargar sigue todo: la foto, el enlace con su red y el elemento del portafolio con su año.
    await page.reload();
    await expect(page.locator('[data-enlace-fila][data-red="youtube"]')).toBeVisible();
    await expect(page.locator('[data-portafolio-item]', { hasText: `${marca} (editado)` })).toContainText('2024');
    await expect(page.locator('[data-foto-vista]')).toBeVisible();

    // La ficha pública muestra la red con su nombre y el elemento con su clase, año y descripción.
    const clave = (await page.locator('a[href^="/ecosistema/personas/"]').first().getAttribute('href'))!;
    const anonimo = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const publica = await anonimo.newPage();
    await publica.goto(clave);
    await expect(publica.locator('#perfil-portafolio').locator('xpath=ancestor::section[1]')).toContainText(`${marca} (editado)`);
    await expect(publica.locator('#perfil-portafolio').locator('xpath=ancestor::section[1]')).toContainText('Crónica del festival.');
    await expect(publica.locator('#perfil-enlaces').locator('xpath=ancestor::section[1]')).toContainText('YouTube');
    await anonimo.close();

    // Se deja el perfil como estaba: sin el elemento ni el enlace de la prueba.
    await page.locator('[data-portafolio-item]', { hasText: `${marca} (editado)` }).getByRole('button', { name: /^Quitar/ }).click();
    await page.locator('[data-enlace-fila][data-red="youtube"]').getByRole('button', { name: /^Quitar/ }).click();
    await page.getByRole('button', { name: 'Guardar perfil' }).click();
    await expect(page.locator('form [data-aviso-de-guardado]')).toContainText('quedó guardado');
  });
});
