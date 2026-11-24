import { test, expect, Browser, Page } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * La agenda de citas como APLICACIÓN a pantalla completa (docs/referencia/26-agenda-de-citas-y-mercados.md §26.15), contra la demostración integral sembrada
 * con `scripts/demo/sembrar-agenda-de-citas.sh`: la organización (camila.restrepo@), un artista (eliecer.rios@) y una compradora
 * (margarita.buelvas@), todas con la clave de las cuentas de demostración. Solo lee: no pide, confirma ni cancela nada.
 */
const CLAVE = process.env.SIMUS_EXTERNO_PASSWORD ?? 'admin';

async function sesion(browser: Browser, email: string, ancho = 1440, alto = 900): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto } });
  const page = await ctx.newPage();
  const r = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: { email, password: CLAVE } });
  expect(r.status(), `la cuenta ${email} tiene que poder entrar`).toBe(200);
  return page;
}

async function agendaAbiertaDeLaOrganizacion(page: Page): Promise<string> {
  const yo = await (await page.request.get('/api/v1/externo/auth/me')).json() as { organizations: { id: string; name: string }[] };
  const org = yo.organizations.find(o => o.name.includes('Sonora Andina'))!;
  const ediciones = await (await page.request.get(`/api/v1/externo/organizaciones/${org.id}/agendas-de-citas`)).json() as { mercadoId: number; agendaId: number | null; agendaEstado: string | null }[];
  const abierta = ediciones.find(e => e.agendaEstado === 'abierta')!;
  return `/gestion/o/${org.id}/procesos/mercados/${abierta.mercadoId}/agenda-de-citas/${abierta.agendaId}`;
}

test.describe('La agenda de citas como aplicación', () => {
  test('la organización ve el armazón, las personas y mesas, y la parrilla con su panel', async ({ browser }) => {
    const page = await sesion(browser, 'camila.restrepo@simus.test');
    await page.goto(await agendaAbiertaDeLaOrganizacion(page));

    // Cabecera de aplicación: nombre del Mercado o de la agenda (nunca «Nueva agenda»), estado y salida.
    const cabecera = page.locator('[data-testid="cabecera-de-la-herramienta"]');
    await expect(cabecera).toBeVisible();
    await expect(cabecera.locator('h1')).not.toContainText('Nueva agenda de citas');
    await expect(cabecera.locator('[data-testid="estado-de-la-agenda"]')).toContainText('Inscripción abierta');
    await expect(page.locator('[data-testid="volver-de-la-herramienta"]')).toContainText('Salir de la herramienta');
    // La cabecera de la herramienta nunca queda tapada por la barra principal.
    const caja = await cabecera.boundingBox();
    expect(caja!.y).toBeLessThanOrEqual(1);

    // Navegación lateral con marca de trabajo pendiente y resumen con cifras y línea de etapas.
    const nav = page.locator('[data-testid="navegacion-de-la-herramienta"]');
    await expect(nav.locator('[data-pestana="resumen"]')).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[data-pestana="participantes"] .app__marca')).toBeVisible();
    await expect(page.locator('[data-testid="indicadores"]')).toContainText('Artistas admitidos');
    await expect(page.locator('[data-testid="recorrido-de-la-agenda"]')).toContainText('Inscripción abierta');

    // Personas (con su foto y su rol) y mesas como cosas.
    await nav.locator('[data-pestana="participantes"]').click();
    await expect(page.locator('[data-testid="mesas-de-la-agenda"] [data-testid="tarjeta-de-mesa"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="lista-de-artistas"] [data-testid="ficha-rol"]').first()).toContainText('Artista');
    await expect(page.locator('[data-testid="lista-de-compradores"]')).toContainText('Comprador o booker');

    // Programación: filas = quienes tienen stand o mesa fija; elegir una celda abre el panel de la derecha.
    await nav.locator('[data-pestana="parrilla"]').click();
    const celda = page.locator('[data-testid="parrilla"] button[data-celda][tabindex="0"]');
    await celda.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    const panel = page.locator('[data-testid="detalle-de-la-celda"]');
    await expect(panel.locator('[data-testid="ficha-nombre"]').first()).toBeVisible();
    const cajaPanel = await panel.boundingBox();
    const cajaParrilla = await page.locator('[data-testid="parrilla"]').boundingBox();
    expect(cajaPanel!.x).toBeGreaterThan(cajaParrilla!.x + cajaParrilla!.width - 1);
  });

  test('en el móvil la programación es una lista por mesa y la navegación va abajo', async ({ browser }) => {
    const page = await sesion(browser, 'camila.restrepo@simus.test', 390, 844);
    await page.goto(`${await agendaAbiertaDeLaOrganizacion(page)}?vista=parrilla`);
    await expect(page.locator('[data-testid="parrilla"] section[data-persona]').first()).toBeVisible();
    await expect(page.locator('[data-testid="parrilla"] table')).toHaveCount(0);
    const nav = await page.locator('[data-testid="navegacion-de-la-herramienta"]').boundingBox();
    expect(nav!.y).toBeGreaterThan(600);
    // Sin desplazamiento horizontal de la página.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });

  test('quien participa ve «Mi día» y la ruta: artista con stand fijo y compradora que pide citas', async ({ browser }) => {
    for (const [email, pedir] of [['eliecer.rios@simus.test', false], ['margarita.buelvas@simus.test', true]] as const) {
      const page = await sesion(browser, email);
      const agendas = await (await page.request.get('/api/v1/externo/agendas-de-citas')).json() as { agendaId: number; mercadoNombre: string }[];
      await page.goto(`/gestion/cuenta/agenda-de-citas/${agendas[0].agendaId}`);
      await expect(page.locator('[data-testid="siguiente-paso"]')).toBeVisible();
      await expect(page.locator('[data-testid="como-funciona"]')).toContainText('Cómo funciona esta agenda');
      await page.locator('[data-testid="navegacion-de-la-herramienta"] [data-pestana="dia"]').click();
      await expect(page.locator('[data-testid="mi-dia"]')).toBeVisible();
      if (pedir) await expect(page.locator('[data-testid="navegacion-de-la-herramienta"] [data-pestana="pedir"]')).toBeVisible();
      await page.context().close();
    }
  });
});
