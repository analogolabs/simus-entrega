import { test, expect, type Page } from '@playwright/test';

/**
 * El portal público, visto como un visitante anónimo: sin errores en la consola y sin esperar a una interacción
 * (D-02 y D-09 de la narrativa).
 *
 * <b>D-02.</b> `/noticias` pedía la lista, la API respondía 200 y la pantalla seguía en «Cargando las noticias…» hasta
 * que la persona pulsaba una tecla. Aquí no se toca nada: la lista tiene que aparecer sola.
 *
 * <b>D-09.</b> Toda página pública preguntaba por la sesión en `GET /externo/auth/me`, que contesta 401 a un anónimo, y el
 * navegador lo pinta como un error rojo en la consola. Ahora se pregunta en `/externo/auth/estado`, que contesta 200.
 *
 * Necesita la API y la base de demostración (`@backend`). Lo ideal es correrla contra el build de producción servido
 * estático (`npm run servir:produccion`), que es lo que se despliega y donde se midió el defecto:
 *
 *   SIMUS_BASE_URL=http://127.0.0.1:4300 npx playwright test e2e/portal-sin-errores-de-consola.spec.ts
 */

const PAGINAS_PUBLICAS = ['/', '/noticias', '/agenda', '/ecosistema/festivales', '/editorial', '/ecosistema/personas'];

/** Lo que el navegador deja en rojo: mensajes de consola de tipo `error`, excepciones de la página y respuestas 4xx/5xx. */
async function registrarErrores(page: Page): Promise<string[]> {
  const errores: string[] = [];
  page.on('console', mensaje => { if (mensaje.type() === 'error') errores.push(`consola: ${mensaje.text()}`); });
  page.on('pageerror', error => errores.push(`excepción: ${error.message}`));
  page.on('response', respuesta => {
    if (respuesta.status() >= 400 && respuesta.url().includes('/api/')) errores.push(`HTTP ${respuesta.status()} ${new URL(respuesta.url()).pathname}`);
  });
  return errores;
}

test.describe('Portal público anónimo', { tag: '@backend' }, () => {
  test('Noticias sale del esqueleto por sí sola, sin pulsar nada (D-02)', async ({ page }) => {
    await page.goto('/noticias');

    // Sin mover el ratón ni pulsar una tecla: la lista llega con la respuesta de la API.
    await expect(page.locator('[data-noticias-cargando]')).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByText('Cargando las noticias')).toHaveCount(0);
    await expect(page.locator('main h3, main h2').first()).toBeVisible();
  });

  for (const ruta of PAGINAS_PUBLICAS) {
    test(`${ruta} no deja errores en la consola (D-09)`, async ({ page }) => {
      const errores = await registrarErrores(page);

      await page.goto(ruta);
      await page.waitForLoadState('networkidle');

      expect(errores, errores.join('\n')).toEqual([]);
    });
  }

  test('la sesión se consulta en /estado y la respuesta es 200 aunque no haya sesión (D-09)', async ({ page }) => {
    const consultas: number[] = [];
    page.on('response', respuesta => {
      if (new URL(respuesta.url()).pathname === '/api/v1/externo/auth/estado') consultas.push(respuesta.status());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(consultas).toEqual([200]);
  });
});
