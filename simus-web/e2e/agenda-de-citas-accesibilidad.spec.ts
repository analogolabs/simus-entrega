import { test, expect, Browser, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Accesibilidad de la agenda de citas (docs/referencia/26-agenda-de-citas-y-mercados.md §26.15): axe-core sobre las pantallas de las dos personas,
 * en cada una de sus vistas, y el calendario con teclado. Necesita la demostración completa y el entorno en pie.
 */
const CLAVE = process.env.SIMUS_EXTERNO_PASSWORD ?? 'admin';
const ETIQUETAS = ['best-practice', 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function sesion(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  const r = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: { email, password: CLAVE } });
  expect(r.status()).toBe(200);
  return page;
}

async function sinViolacionesGraves(page: Page, donde: string): Promise<void> {
  // Pasada la animación de entrada de la página: axe mide el contraste sobre lo ya opaco.
  await page.waitForTimeout(900);
  const { violations } = await new AxeBuilder({ page }).include('#contenido-principal').exclude('app-cabecera-del-panel').exclude('.foundation-sidebar').exclude('.panel-contexto').withTags(ETIQUETAS).analyze();
  const graves = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`), `axe en ${donde}`).toEqual([]);
}

test.describe('Agenda de citas: accesibilidad', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('la organizadora: cada vista de la herramienta no tiene violaciones graves', { tag: '@backend' }, async ({ browser }) => {
    const page = await sesion(browser, 'lucia.ramirez@cantaclaro.test');
    const mias = await (await page.request.get('/api/v1/externo/organizaciones/mis')).json() as { id: string; name?: string; nombre?: string }[];
    const org = mias.find(o => (o.name ?? o.nombre ?? '').includes('Cantaclaro')) ?? mias[0];
    await page.goto(`/gestion/o/${org.id}/herramientas/agenda-de-citas`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="ediciones-por-mercado"]')).toBeVisible();
    await sinViolacionesGraves(page, 'herramientas');
    await page.locator('[data-testid="gestionar-agenda"]').first().click();
    await expect(page.locator('[data-testid="cabecera-de-la-herramienta"]')).toBeVisible();
    for (const vista of ['resumen', 'parrilla', 'calendario', 'participantes', 'citas', 'franjas', 'configuracion']) {
      await page.locator(`[data-pestana="${vista}"]`).click();
      await sinViolacionesGraves(page, `agenda de citas · ${vista}`);
    }
    // Lo que queda detrás de la herramienta no entra en el orden de tabulación.
    expect(await page.locator('[inert]').count()).toBeGreaterThan(0);
  });

  test('la organizadora en el móvil (390 px): pestañas en una fila fija, objetivos de 44 px y sin violaciones graves', { tag: '@backend' }, async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await contexto.newPage();
    const r = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: { email: 'lucia.ramirez@cantaclaro.test', password: CLAVE } });
    expect(r.status()).toBe(200);
    const mias = await (await page.request.get('/api/v1/externo/organizaciones/mis')).json() as { id: string; name?: string; nombre?: string }[];
    const org = mias.find(o => (o.name ?? o.nombre ?? '').includes('Cantaclaro')) ?? mias[0];
    await page.goto(`/gestion/o/${org.id}/herramientas/agenda-de-citas`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="gestionar-agenda"]').first().click();
    await expect(page.locator('[data-testid="pestanas-fijas"]')).toBeVisible();
    // Una sola fila: todas las pestañas comparten la misma línea y la fila se desplaza en horizontal.
    const cajas = await page.locator('[data-testid="pestanas-fijas"] [role="tab"]').evaluateAll(es => es.map(e => { const c = e.getBoundingClientRect(); return { y: Math.round(c.top), alto: Math.round(c.height) }; }));
    expect(new Set(cajas.map(c => c.y)).size).toBe(1);
    for (const c of cajas) expect(c.alto).toBeGreaterThanOrEqual(44);
    expect(await page.locator('[data-testid="pestanas-fijas"] [role="tablist"]').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
    await page.locator('[data-pestana="parrilla"]').click();
    await expect(page.locator('[data-testid="parrilla"]')).toBeVisible();
    // Los días de la parrilla y las celdas se pueden pulsar con el dedo.
    const dias = await page.locator('[data-testid="vista-parrilla"] [data-opcion]').evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    for (const h of dias) expect(h).toBeGreaterThanOrEqual(44);
    const celda = await page.locator('[data-testid="parrilla"] button[data-celda]').first().boundingBox();
    expect(celda!.height).toBeGreaterThanOrEqual(44);
    // Fijas al desplazarse: tras bajar la página, la fila de pestañas sigue a la vista.
    await page.locator('[data-testid="parrilla"]').scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    const fija = await page.locator('[data-testid="pestanas-fijas"]').boundingBox();
    expect(fija!.y).toBeGreaterThanOrEqual(0);
    expect(fija!.y + fija!.height).toBeLessThanOrEqual(300);
    await sinViolacionesGraves(page, 'agenda de citas · parrilla (390 px)');
    await contexto.close();
  });

  test('la compradora: cada vista de su agenda no tiene violaciones graves y el calendario responde al teclado', { tag: '@backend' }, async ({ browser }) => {
    const page = await sesion(browser, 'diana.zapata@bandasoriente.test');
    const agendas = await (await page.request.get('/api/v1/externo/agendas-de-citas')).json() as { agendaId: number }[];
    await page.goto(`/gestion/cuenta/agenda-de-citas/${agendas[0].agendaId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="cabecera-de-la-herramienta"]')).toBeVisible();
    for (const vista of ['calendario', 'pedir', 'citas', 'inscripcion']) {
      await page.locator(`[data-pestana="${vista}"]`).click();
      await sinViolacionesGraves(page, `mi agenda de citas · ${vista}`);
    }
    // El recorrido de tres pasos, en sus tres pantallas.
    await page.locator('[data-pestana="pedir"]').click();
    await page.locator('[data-testid="anfitrion"]:not([disabled])').first().click();
    await sinViolacionesGraves(page, 'pedir una cita · paso 2');
    await page.locator('[data-testid="pedir-franja"]').first().click();
    await sinViolacionesGraves(page, 'pedir una cita · paso 3');
    await page.locator('[data-pestana="calendario"]').click();
    const activa = page.locator('[data-testid="calendario"] button[data-celda][tabindex="0"]');
    await expect(activa).toHaveCount(1);
    // El calendario se vuelve a dibujar cuando llegan sus datos y la celda enfocada puede perder el foco justo antes de la
    // flecha (bajo carga ocurría): se repite «enfocar y pulsar» hasta que el foco quede en una celda, en vez de suponer
    // que el primer intento cayó sobre el dibujo definitivo.
    const enfocada = page.locator('[data-testid="calendario"] button[data-celda]:focus');
    await expect(async () => {
      await page.locator('[data-testid="calendario"] button[data-celda][tabindex="0"]').focus();
      await page.keyboard.press('ArrowDown');
      await expect(enfocada).toHaveCount(1, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(enfocada).toHaveAttribute('aria-label', /.+/);
  });

  test('la página de la invitación, con un enlace que no existe, no tiene violaciones graves', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/ecosistema/invitacion-agenda?testigo=inexistente', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Invitación a una agenda de citas' })).toBeVisible();
    await sinViolacionesGraves(page, 'invitación a la agenda');
  });
});
