import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * UI-F: lo que axe no ve, con teclado. Enlace de salto, orden de tabulación con foco visible, menú de cuenta
 * (abre, Escape cierra y devuelve el foco), diálogo (rol, foco dentro, Tab no sale, Escape cierra y devuelve el
 * foco) y axe sobre esos estados abiertos. Usa las cuentas ficticias de la siembra de demostración y solo navega.
 */

const SESIONES = {
  consola: { api: '/api/v1/admin/auth', email: 'webmaster@simus.test' },
  organizacion: { api: '/api/v1/externo/auth', email: 'lucia.ramirez@cantaclaro.test' },
};

async function abrirSesion(page: Page, quien: keyof typeof SESIONES): Promise<void> {
  const { api, email } = SESIONES[quien];
  const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
  const r = await page.request.post(`${api}/login`, {
    headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' },
    data: { email, password: 'admin' },
  });
  expect(r.status(), `la cuenta ficticia ${email} debe poder entrar`).toBe(200);
}

async function pagina(browser: import('@playwright/test').Browser, quien: keyof typeof SESIONES | null): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().split('T')[0]);
      for (const k of Object.keys(localStorage)) if (k.startsWith('pnmc_tour_seen_')) localStorage.setItem(k, '1');
      localStorage.setItem('pnmc_tour_seen_admin@pnmc.local', '1');
    } catch { /* sin almacenamiento */ }
  });
  if (quien) await abrirSesion(page, quien);
  return page;
}

async function axeGrave(page: Page, alcance?: string): Promise<string[]> {
  let b = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
  if (alcance) b = b.include(alcance);
  const r = await b.analyze();
  return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
}

/** Indica si el elemento enfocado se distingue: contorno, sombra de anillo o borde cambiado. */
async function focoVisible(page: Page): Promise<{ ok: boolean; quien: string }> {
  return page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    if (!e || e === document.body) return { ok: false, quien: '(nada enfocado)' };
    const cs = getComputedStyle(e);
    const contorno = cs.outlineStyle === 'auto' || cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(cs.outlineColor);
    // Un anillo de Tailwind es una sombra sin desenfoque con propagación: `rgb(...) 0px 0px 0px 2px`. Las capas transparentes
    // o de propagación cero (el valor por omisión) no cuentan.
    const sombra = cs.boxShadow.split(/,(?![^(]*\))/).some(capa => {
      const m = capa.trim().match(/^((?:rgba?|oklab|oklch|lab|lch|hsla?|color)\([^)]*\)|#[0-9a-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+([\d.]+)px/i);
      return !!m && parseFloat(m[5]) >= 2 && !/(,\s*0\s*\)|\/\s*0\s*\))$/.test(m[1]);
    });
    const r = e.getBoundingClientRect();
    // El enlace de salto y los controles ocultos hasta recibir foco se miden una vez ya visibles.
    const visible = r.width > 0 && r.height > 0;
    return { ok: visible && (contorno || sombra), quien: `[sombra ${cs.boxShadow.slice(0, 120)}] ${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).slice(0, 60)} «${(e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}»` };
  });
}

test.describe('accesibilidad con teclado', () => {
  test('portal: el primer Tab lleva al enlace de salto y este lleva al contenido', async ({ browser }) => {
    const page = await pagina(browser, null);
    await page.goto('/agenda', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const salto = page.getByRole('link', { name: 'Saltar al contenido principal' });
    await expect(salto).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido-principal')).toBeFocused();
  });

  test('portal: los primeros 15 destinos de Tab muestran el foco', async ({ browser }) => {
    const page = await pagina(browser, null);
    await page.goto('/ecosistema/festivales', { waitUntil: 'networkidle' });
    const sinFoco: string[] = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(400); // las transiciones del anillo terminan antes de medir
      const f = await focoVisible(page);
      if (!f.ok) sinFoco.push(f.quien);
    }
    expect(sinFoco, `Destinos de Tab sin foco visible:\n${sinFoco.join('\n')}`).toEqual([]);
  });

  for (const caso of [
    { nombre: 'consola', quien: 'consola' as const, ruta: async () => '/administracion/organizaciones' },
    { nombre: 'panel', quien: 'organizacion' as const, ruta: async (page: Page) => {
      const me = await (await page.request.get('/api/v1/externo/auth/me')).json();
      return `/gestion/o/${(me.organizations ?? me.organizaciones)[0].id}/procesos/festivales`;
    } },
  ]) {
    test(`${caso.nombre}: los primeros 25 destinos de Tab muestran el foco`, async ({ browser }) => {
      const page = await pagina(browser, caso.quien);
      await page.goto(await caso.ruta(page), { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const sinFoco: string[] = [];
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400); // las transiciones del anillo terminan antes de medir
        const f = await focoVisible(page);
        if (!f.ok) sinFoco.push(`${i + 1}. ${f.quien}`);
      }
      expect(sinFoco, `Destinos de Tab sin foco visible:\n${sinFoco.join('\n')}`).toEqual([]);
    });
  }

  test('consola: el menú de cuenta abre con Enter, Escape lo cierra y el foco vuelve al botón', async ({ browser }) => {
    const page = await pagina(browser, 'consola');
    await page.goto('/administracion', { waitUntil: 'networkidle' });
    const disparador = page.locator('.header-cuenta__disparador');
    await disparador.focus();
    await page.keyboard.press('Enter');
    await expect(disparador).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    expect(await axeGrave(page, '[role="menu"]'), 'axe sobre el menú abierto').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(disparador).toBeFocused();
  });

  test('panel: el menú de cuenta abre con Enter, Escape lo cierra y el foco vuelve al botón', async ({ browser }) => {
    const page = await pagina(browser, 'organizacion');
    const me = await (await page.request.get('/api/v1/externo/auth/me')).json();
    const id = String((me.organizations ?? me.organizaciones)[0].id);
    await page.goto(`/gestion/o/${id}/resumen`, { waitUntil: 'networkidle' });
    const disparador = page.locator('.header-cuenta__disparador');
    await disparador.focus();
    await page.keyboard.press('Enter');
    await expect(disparador).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(disparador).toBeFocused();
  });

  test('consola: un diálogo tiene rol, retiene el foco, se cierra con Escape y devuelve el foco', async ({ browser }) => {
    const page = await pagina(browser, 'consola');
    await page.goto('/administracion/organizaciones', { waitUntil: 'networkidle' });
    const abrir = page.getByRole('button', { name: 'Nueva organización' });
    await abrir.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toHaveAccessibleName(/.+/);

    // El foco está dentro y Tab no sale del diálogo, ni hacia delante ni hacia atrás.
    const dentro = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"], dialog'));
    expect(await dentro(), 'el foco entra al diálogo al abrirlo').toBe(true);
    for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); expect(await dentro(), `Tab ${i + 1} sigue dentro`).toBe(true); }
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Shift+Tab'); expect(await dentro(), `Shift+Tab ${i + 1} sigue dentro`).toBe(true); }

    expect(await axeGrave(page, '[role="dialog"]'), 'axe sobre el diálogo abierto').toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(abrir).toBeFocused();
  });

  test('consola: un desplegable de filtro abre con el teclado, se recorre con flechas y Escape devuelve el foco', async ({ browser }) => {
    const page = await pagina(browser, 'consola');
    await page.goto('/administracion/organizaciones', { waitUntil: 'networkidle' });
    const filtro = page.locator('button.filtro__control').first();
    await filtro.focus();
    await page.keyboard.press('Enter');
    await expect(filtro).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();
    expect(await axeGrave(page, '.filtro__panel'), 'axe sobre el desplegable abierto').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(filtro).toHaveAttribute('aria-expanded', 'false');
    await expect(filtro).toBeFocused();
  });
});
