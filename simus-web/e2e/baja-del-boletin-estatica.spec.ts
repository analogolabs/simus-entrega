import { expect, test } from '@playwright/test';
import { TOLERANCIA_DE_TEXTO, medir } from './apoyo/barra-superior';

/**
 * LA PÁGINA PÚBLICA DE BAJA DEL BOLETÍN, SOLO LECTURA (ligera, contra la demo o cualquier pila).
 *
 * No da de baja a nadie: sin testigo y con un testigo falso solo se LEE. El segundo caso hace un GET al API que responde 400 y
 * no escribe nada; el botón «Darme de baja» (POST) no se pulsa aquí porque necesita un enlace auténtico de un correo real.
 * La baja de punta a punta la cubren las pruebas xUnit del API (`BajaDelBoletinTests`) y la de Karma de la página. @backend
 */
for (const tamano of [{ ancho: 1440, alto: 900 }, { ancho: 390, alto: 844 }]) {
  test.describe(`baja pública del boletín a ${tamano.ancho} px`, () => {
    test.use({ viewport: { width: tamano.ancho, height: tamano.alto } });

    test('sin testigo dice «Enlace inválido» y la barra no tapa el título', async ({ page }) => {
      await page.goto('/ecosistema/baja-boletin', { waitUntil: 'networkidle' });
      await expect(page.locator('[data-testid="baja-boletin-invalido"]')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Enlace inválido');
      await expect(page.locator('[data-testid="baja-boletin-boton"]')).toHaveCount(0);

      const medida = await medir(page);
      expect(medida.contenidoArriba, 'hay contenido visible').not.toBeNull();
      expect(medida.contenidoArriba! + TOLERANCIA_DE_TEXTO, `la barra no tapa «${medida.muestra}»`).toBeGreaterThanOrEqual(medida.barraAbajo);

      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(desborde, 'sin desborde horizontal').toBeLessThanOrEqual(0);
    });

    test('con un testigo falso el servidor lo rechaza y la página no ofrece dar de baja', async ({ page }) => {
      const peticiones: string[] = [];
      page.on('request', r => { if (r.url().includes('/publico/boletin/')) peticiones.push(`${r.method()} ${new URL(r.url()).pathname}`); });

      await page.goto('/ecosistema/baja-boletin?testigo=1.00000000000000000000000000000000000000000000000000000000000000ff', { waitUntil: 'networkidle' });

      await expect(page.locator('[data-testid="baja-boletin-invalido"]')).toBeVisible();
      await expect(page.locator('[data-testid="baja-boletin-boton"]')).toHaveCount(0);
      expect(peticiones, 'abrir el enlace solo consulta (GET), nunca escribe').toEqual(['GET /api/v1/publico/boletin/baja']);
    });
  });
}
