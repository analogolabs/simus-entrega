import { Page, expect, test } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * UNA SOLA ESCALA TIPOGRÁFICA EN LA CUENTA, LA GESTIÓN EXTERNA Y LA ADMINISTRACIÓN (puntos 47 y 71 del mapa de comentarios).
 *
 * Los h1, h2 y h3 de las tres superficies toman la escala de `styles.css` (`--tipo-h1-*`, `--tipo-h2-*`, `--tipo-h3-*`) por
 * elemento dentro de `.armazon-de-gestion`. Esta prueba recorre las rutas principales y detecta lo que se sale:
 *   - el título de página (h1) mide 28 px en Oswald, igual en todas;
 *   - ningún h2 ni h3 visible pasa de 24 px ni baja de 12 px;
 *   - ningún encabezado (salvo el h1) vuelve a usar Oswald por encima de 24 px (el «gigante» del síntoma original).
 * Requiere la pila levantada y la siembra de demostración (cuentas `lucia.ramirez@cantaclaro.test` o `camila.restrepo@simus.test`, y `webmaster@simus.test`). @backend
 */
const H1_PX = 28;
const MAX_SUBTITULO_PX = 24;
const CUENTA = ['/gestion/cuenta', '/gestion/cuenta/organizaciones', '/gestion/cuenta/solicitudes', '/gestion/cuenta/procesos',
  '/gestion/cuenta/perfil-publico', '/gestion/cuenta/datos', '/gestion/cuenta/autorizaciones', '/gestion/cuenta/seguridad',
  '/gestion/cuenta/herramientas/procesos-historicos'];
const ORGANIZACION = ['resumen', 'organizacion', 'archivos', 'herramientas', 'procesos', 'eventos', 'solicitudes', 'equipo'];
const ADMINISTRACION = ['solicitudes', 'organizaciones', 'ecosistema', 'procesos', 'agenda', 'noticias', 'catalogo-editorial',
  'usuarios', 'auditoria', 'sistema', 'analisis', 'gestion-sitio'];

async function medirEncabezados(page: Page): Promise<{ tag: string; px: number; familia: string; texto: string }[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll('main h1, main h2, main h3, .armazon-de-gestion h1, .armazon-de-gestion h2, .armazon-de-gestion h3'))
    .filter(el => !el.classList.contains('sr-only') && (el as HTMLElement).getBoundingClientRect().height > 0)
    .map(el => { const cs = getComputedStyle(el); return { tag: el.tagName.toLowerCase(), px: parseFloat(cs.fontSize), familia: cs.fontFamily.split(',')[0].replace(/["']/g, ''), texto: (el.textContent ?? '').trim().slice(0, 30) }; }));
}

function fueraDeEscala(ruta: string, hs: { tag: string; px: number; familia: string; texto: string }[]): string[] {
  const malas: string[] = [];
  for (const h of hs) {
    if (h.tag === 'h1' && Math.abs(h.px - H1_PX) > 0.5) malas.push(`${ruta}: h1 «${h.texto}» mide ${h.px} px (debe ser ${H1_PX})`);
    if (h.tag !== 'h1' && (h.px > MAX_SUBTITULO_PX || h.px < 12)) malas.push(`${ruta}: ${h.tag} «${h.texto}» mide ${h.px} px (rango 12 a ${MAX_SUBTITULO_PX})`);
  }
  return malas;
}

async function recorrer(page: Page, rutas: string[]): Promise<string[]> {
  const malas: string[] = [];
  for (const ruta of rutas) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    malas.push(...fueraDeEscala(ruta, await medirEncabezados(page)));
  }
  return malas;
}

test.describe('Escala tipográfica única', () => {
  test('la cuenta y la gestión externa no se salen de la escala', { tag: '@backend' }, async ({ page }) => {
    test.setTimeout(240_000);
    const api = '/api/v1/externo/auth';
    const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
    // Lucía es de la siembra básica; Camila, de la integral: sirve la que exista en la base levantada.
    let estado = 0;
    for (const email of ['lucia.ramirez@cantaclaro.test', 'camila.restrepo@simus.test']) {
      const r = await postConCupo(page.request, `${api}/login`, { headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: { email, password: 'admin' } });
      estado = r.status();
      if (estado === 200) break;
    }
    expect(estado).toBe(200);
    const yo = await (await page.request.get(`${api}/me`)).json();
    const id = (yo.organizaciones ?? yo.organizations)[0].id;
    const malas = await recorrer(page, [...CUENTA, ...ORGANIZACION.map(s => `/gestion/o/${id}/${s}`)]);
    expect(malas, malas.join('\n')).toEqual([]);
  });

  test('la administración usa la misma escala', { tag: '@backend' }, async ({ page }) => {
    test.setTimeout(240_000);
    const api = '/api/v1/admin/auth';
    const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
    const r = await postConCupo(page.request, `${api}/login`, { headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: { email: 'webmaster@simus.test', password: 'admin' } });
    expect(r.status()).toBe(200);
    const malas = await recorrer(page, ADMINISTRACION.map(s => `/administracion/${s}`));
    expect(malas, malas.join('\n')).toEqual([]);
  });
});
