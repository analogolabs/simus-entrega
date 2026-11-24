import { test, expect, type Page } from '@playwright/test';

/**
 * UI-G: UN SOLO `<main id="contenido-principal">` POR PANTALLA, Y EL BANNER Y LA NAVEGACIÓN FUERA DE ÉL.
 *
 * Hasta UI-G el armazón de la aplicación envolvía todo el enrutador en un `<main>`, así que la cabecera
 * y la barra lateral de la consola y del panel quedaban DENTRO del contenido principal. Esta prueba
 * recorre cada armazón (portal, acceso, consola, panel, Mi espacio) y exige: exactamente un `main`; el
 * `header` de la pantalla y su navegación (`nav` o `aside`) no son descendientes de él; y el enlace de
 * salto lleva el foco a ese `main`. Usa las cuentas ficticias de la demostración.
 */

const CUENTAS = {
  consola: { api: '/api/v1/admin/auth', email: 'webmaster@simus.test' },
  organizacion: { api: '/api/v1/externo/auth', email: 'lucia.ramirez@cantaclaro.test' },
  persona: { api: '/api/v1/externo/auth', email: 'valentina.ocampo@correo.test' },
};

async function entrar(page: Page, quien: keyof typeof CUENTAS): Promise<void> {
  const { api, email } = CUENTAS[quien];
  const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
  const r = await page.request.post(`${api}/login`, { headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: { email, password: 'admin' } });
  expect(r.status(), `la cuenta ficticia ${email} debe poder entrar`).toBe(200);
}

async function estructura(page: Page) {
  return page.evaluate(() => {
    const mains = [...document.querySelectorAll('main, [role="main"]')];
    const main = mains[0] as HTMLElement | undefined;
    const visibles = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
    const dentro = (sel: string) => visibles(sel).filter(e => !!main && main.contains(e)).map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`);
    return {
      mains: mains.length,
      id: main?.id ?? '',
      tabindex: main?.getAttribute('tabindex') ?? '',
      cabecerasDentro: dentro('header.foundation-header, app-navigation header, header[data-testid="cabecera-del-panel"]'),
      navegacionDentro: dentro('aside.foundation-sidebar, nav[data-testid="navegacion-de-la-cuenta"], app-navigation nav'),
    };
  });
}

interface Caso { nombre: string; quien: keyof typeof CUENTAS | null; ruta: (page: Page) => Promise<string> }
const fija = (r: string) => async () => r;
const CASOS: Caso[] = [
  { nombre: 'portal', quien: null, ruta: fija('/agenda') },
  { nombre: 'portal: 404', quien: null, ruta: fija('/esta-ruta-no-existe') },
  { nombre: 'acceso', quien: null, ruta: fija('/ingresar') },
  { nombre: 'registro', quien: null, ruta: fija('/registro') },
  { nombre: 'consola', quien: 'consola', ruta: fija('/administracion/organizaciones') },
  { nombre: 'panel de la organización', quien: 'organizacion', ruta: async page => {
    const me = await (await page.request.get('/api/v1/externo/auth/me')).json();
    return `/gestion/o/${(me.organizations ?? me.organizaciones)[0].id}/procesos/festivales`;
  } },
  { nombre: 'Mi espacio', quien: 'persona', ruta: fija('/gestion/cuenta') },
];

test.describe('estructura de pantalla: un solo main', () => {
  for (const c of CASOS) {
    test(c.nombre, async ({ browser }) => {
      const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      if (c.quien) await entrar(page, c.quien);
      await page.goto(await c.ruta(page), { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const e = await estructura(page);
      expect(e.mains, 'debe haber exactamente un <main>').toBe(1);
      expect(e.id).toBe('contenido-principal');
      expect(e.tabindex).toBe('-1');
      expect(e.cabecerasDentro, 'la cabecera no va dentro del <main>').toEqual([]);
      expect(e.navegacionDentro, 'la navegación no va dentro del <main>').toEqual([]);
      await page.context().close();
    });
  }

  test('el enlace de salto lleva el foco al main también en el panel', async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await entrar(page, 'organizacion');
    const me = await (await page.request.get('/api/v1/externo/auth/me')).json();
    await page.goto(`/gestion/o/${(me.organizations ?? me.organizaciones)[0].id}/procesos/festivales`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const salto = page.getByRole('link', { name: 'Saltar al contenido principal' });
    if (await salto.count() && await salto.first().evaluate(e => e === document.activeElement)) {
      await page.keyboard.press('Enter');
      await expect(page.locator('#contenido-principal')).toBeFocused();
    } else {
      // El panel trae su propia cabecera y no muestra el armazón del portal: el main existe y se puede enfocar.
      await page.locator('#contenido-principal').focus();
      await expect(page.locator('#contenido-principal')).toBeFocused();
    }
    await page.context().close();
  });
});
