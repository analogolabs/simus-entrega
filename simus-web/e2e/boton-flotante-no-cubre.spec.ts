import { expect, test } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * PANEL (decisión 126): los botones flotantes de la esquina inferior derecha (consulta guiada y ayuda) no cubren el contenido
 * del panel: «Enviar a revisión» de la tabla de eventos quedaba debajo del botón en una pantalla que no se desplaza.
 */
test.describe('Botones flotantes en el panel de la organización', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('ningún control del contenido queda bajo la consulta guiada ni la ayuda', { tag: '@backend' }, async ({ page }) => {
    const api = '/api/v1/externo/auth';
    const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
    const entrada = await postConCupo(page.request, `${api}/login`, { headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: { email: 'lucia.ramirez@cantaclaro.test', password: 'admin' } });
    expect(entrada.status(), 'la cuenta de demostración tiene que poder entrar').toBe(200);
    const me = await (await page.request.get(`${api}/me`)).json();
    const id = (me.organizaciones ?? me.organizations)[0].id;

    for (const seccion of ['eventos', 'procesos', 'solicitudes', 'resumen']) {
      await page.goto(`/gestion/o/${id}/${seccion}`, { waitUntil: 'networkidle' });
      const flotantes = await page.evaluate(() => [...document.querySelectorAll('app-cajon-de-consulta-guiada button, [data-testid="boton-flotante"], .floating-button, app-floating-button button')]
        .filter(e => { const p = getComputedStyle(e).position; const f = (e.closest('[style*="fixed"], .fixed') ?? e); return p === 'fixed' || getComputedStyle(f).position === 'fixed'; })
        .map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      const controles = await page.evaluate(() => [...document.querySelectorAll('.foundation-main a, .foundation-main button, .foundation-main td')]
        .filter(e => (e as HTMLElement).offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      expect(flotantes.length, `en «${seccion}» el botón flotante se encuentra (la prueba no puede pasar en vacío)`).toBeGreaterThan(0);
      for (const f of flotantes) {
        const cubiertos = controles.filter(c => c.w > 0 && c.x < f.x + f.w && c.x + c.w > f.x && c.y < f.y + f.h && c.y + c.h > f.y);
        expect(cubiertos, `en «${seccion}» hay ${cubiertos.length} controles bajo un botón flotante`).toEqual([]);
      }
    }
  });
});
