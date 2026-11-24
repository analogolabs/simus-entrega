import { expect, test } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * PANEL (decisión 126): la cabecera es fija y la barra lateral queda anclada debajo, con alto exacto (ventana − cabecera), al
 * desplazar el contenido. El fallo: `.foundation-header` es `position: sticky` y su anfitrión era `display: block`, así que la
 * cabecera se iba con el desplazamiento y la barra, anclada a la altura de la cabecera, se quedaba despegada.
 */
const PANTALLAS: [number, number][] = [[1280, 800], [1440, 900]];

for (const [ancho, alto] of PANTALLAS) {
  test.describe(`Barra lateral fija a ${ancho}×${alto}`, () => {
    test.use({ viewport: { width: ancho, height: alto } });

    test('al desplazar, la cabecera sigue en top 0 y la barra queda justo debajo con alto exacto, en el panel y en Mi espacio', { tag: '@backend' }, async ({ page }) => {
      const api = '/api/v1/externo/auth';
      const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
      const entrada = await postConCupo(page.request, `${api}/login`, { headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: { email: 'lucia.ramirez@cantaclaro.test', password: 'admin' } });
      expect(entrada.status(), 'la cuenta de demostración tiene que poder entrar').toBe(200);
      const me = await (await page.request.get(`${api}/me`)).json();
      const id = (me.organizaciones ?? me.organizations)[0].id;

      for (const ruta of [`/gestion/o/${id}/organizacion`, `/gestion/o/${id}/equipo`, '/gestion/cuenta/seguridad']) {
        await page.goto(ruta, { waitUntil: 'networkidle' });
        // Hay pantallas cortas (Seguridad ya no lleva las autorizaciones): se alarga el contenido para que la ventana se desplace.
        await page.evaluate(() => { const h = document.createElement('div'); h.style.height = '2400px'; h.setAttribute('aria-hidden', 'true'); document.querySelector('#contenido-principal')?.appendChild(h); });
        const medir = () => page.evaluate(() => {
          const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
          return { y: scrollY, cabecera: { top: r('.foundation-header').top, bottom: r('.foundation-header').bottom }, barra: { top: r('.foundation-sidebar').top, height: r('.foundation-sidebar').height }, alto: innerHeight };
        });
        const arriba = await medir();
        await page.mouse.wheel(0, 600);
        await expect.poll(async () => (await medir()).y, { message: `la pantalla ${ruta} se desplaza` }).toBeGreaterThan(100);
        const abajo = await medir();
        expect(abajo.cabecera.top, `cabecera fija en ${ruta}`).toBe(0);
        expect(abajo.barra.top, `la barra queda pegada a la cabecera en ${ruta}`).toBeCloseTo(abajo.cabecera.bottom, 0);
        expect(abajo.barra.top, 'top constante al desplazar').toBeCloseTo(arriba.barra.top, 0);
        expect(abajo.barra.height, 'alto exacto: ventana menos cabecera').toBeCloseTo(abajo.alto - abajo.cabecera.bottom, 0);
      }
    });
  });
}
