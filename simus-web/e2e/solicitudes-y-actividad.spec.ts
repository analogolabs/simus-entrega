import { test, expect, Browser, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { abrirFichaDelFestival, crearFestivalConElAsistente } from './apoyo/organizacion';
import { opcionDelMenu } from './apoyo/menu-de-acciones';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * «Mi actividad y solicitudes», la lista común de Solicitudes del panel y su insignia (SOL).
 *
 *   1. Una organización nueva registra un Festival: un borrador NO es una solicitud (cero pendientes, sin insignia).
 *   2. Lo envía a revisión: aparece en «Esperan respuesta», en Mi espacio y en Solicitudes del panel, con la misma fila.
 *   3. El funcionario pide un ajuste: la insignia del panel dice «1» y lo lee el lector de pantalla; la fila pasa a
 *      «Atender» (lo que espera la acción va primero) lleva a la ficha con los ajustes.
 *
 * Las capturas se guardan en `<carpeta-de-informes>/sol/` (o en SIMUS_CAPTURAS). Requiere la API y el frontend
 * en marcha con las cuentas técnicas (`Database__SeedBootstrapUsers=true`) y DIVIPOLA cargada.
 */

const CARPETA = process.env['SIMUS_CAPTURAS'] ?? join(homedir(), 'SIMUS-capturas', 'sol');
const CLAVE = 'ClaveExterna123';
const SUFIJO = Date.now().toString().slice(-8);
const CORREO = `sol.${SUFIJO}@organizacion.test`;
const NOMBRE = `Festival de solicitudes ${SUFIJO}`;
const NOTA = 'Describe el Festival con más detalle: público, programación y fechas.';
const FUNCIONARIO = {
  email: process.env['SIMUS_GESTOR_EMAIL'] ?? process.env['PNMC_GESTOR_EMAIL'] ?? 'gestor@simus.test',
  password: process.env['SIMUS_GESTOR_PASSWORD'] ?? process.env['PNMC_GESTOR_PASSWORD'] ?? 'admin',
};

async function captura(page: Page, nombre: string): Promise<void> {
  mkdirSync(CARPETA, { recursive: true });
  await page.screenshot({ path: join(CARPETA, `${nombre}.png`), fullPage: false });
}

async function organizacionNueva(browser: Browser): Promise<{ page: Page; id: string }> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const registro = await page.request.post('/api/v1/externo/auth/register', {
    data: {
      organizationName: `Corporación de solicitudes ${SUFIJO}`, fullName: 'Persona responsable', numeroDocumento: `10${SUFIJO}`,
      phone: '3000000000', email: CORREO, password: CLAVE, headquartersDepartmentCode: '76', headquartersMunicipalityCode: '76001',
      politicasAceptadas: ['tratamiento', 'terminos'],
    },
  });
  expect(registro.status(), await registro.text()).toBeLessThan(300);
  const entrada = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: { email: CORREO, password: CLAVE } });
  expect(entrada.status()).toBe(200);
  const mias = await (await page.request.get('/api/v1/externo/organizaciones/mis')).json() as { id: string }[];
  return { page, id: mias[0].id };
}

async function sesionDeFuncionario(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), FUNCIONARIO.email);
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(FUNCIONARIO.email);
  await page.locator('input[type="password"]').fill(FUNCIONARIO.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

test.describe('SOL: Mi actividad y solicitudes y la insignia del panel', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('del borrador a los ajustes pedidos, con la misma fila en todas partes', { tag: '@backend' }, async ({ browser }) => {
    const { page: organizacion, id } = await organizacionNueva(browser);
    const funcionario = await sesionDeFuncionario(browser);
    const insignia = organizacion.locator('[data-testid="insignia-solicitudes"]');

    await test.step('un borrador no es una solicitud: sin insignia y sin filas', async () => {
      await crearFestivalConElAsistente(organizacion, NOMBRE);
      await organizacion.goto(`/gestion/o/${id}/solicitudes`, { waitUntil: 'domcontentloaded' });
      await expect(organizacion.getByText('Todavía no hay solicitudes ni actividad')).toBeVisible();
      await expect(insignia).toHaveCount(0);
      await captura(organizacion, '01-solicitudes-panel-vacio');
    });

    await test.step('enviado a revisión espera respuesta, en el panel y en Mi espacio', async () => {
      await abrirFichaDelFestival(organizacion, NOMBRE);
      await organizacion.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
      await organizacion.locator('[data-testid="confirmacion-comun-aceptar"]').click();
      await expect(organizacion.getByText(/Estado\s*En revisión/i)).toBeVisible({ timeout: 30_000 });

      await organizacion.goto(`/gestion/o/${id}/solicitudes`, { waitUntil: 'domcontentloaded' });
      // PANEL: el estado es un filtro y por omisión se ven todas las filas.
      const fila = organizacion.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: NOMBRE });
      await expect(fila).toContainText('En revisión');
      await expect(fila).toHaveAttribute('data-tipo', 'festival');
      await expect(insignia).toHaveCount(0);
      await captura(organizacion, '02-solicitudes-panel-en-espera');

      await organizacion.goto('/gestion/cuenta/solicitudes', { waitUntil: 'domcontentloaded' });
      // PANEL: el estado es un filtro y por omisión se ven todas las filas.
      await expect(organizacion.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: NOMBRE })).toContainText('Corporación de solicitudes');
      await captura(organizacion, '03-mi-actividad-en-espera');
    });

    await test.step('el funcionario pide un ajuste y la insignia lo cuenta, también para el lector de pantalla', async () => {
      await funcionario.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
      await funcionario.getByText(NOMBRE).first().click();
      await funcionario.getByRole('button', { name: 'Ver la ficha completa' }).click();
      await funcionario.locator('[data-testid="pedir-cambio-festival.descripcion"]').click();
      await funcionario.locator('[data-testid="caja-nota-festival.descripcion"]').fill(NOTA);
      await funcionario.getByRole('button', { name: 'Guardar sugerencia' }).click();
      await funcionario.getByRole('button', { name: 'Enviar sugerencias de ajuste' }).click();
      await funcionario.locator('[data-testid="revision-confirmar-accion"]').click();
      await expect(funcionario.getByText(NOMBRE)).toHaveCount(0, { timeout: 30_000 });

      await organizacion.goto(`/gestion/o/${id}/resumen`, { waitUntil: 'domcontentloaded' });
      await expect(insignia).toHaveText('1', { timeout: 30_000 });
      const enlace = organizacion.locator('a[data-seccion="solicitudes"]');
      await expect(enlace).toContainText('1 solicitud espera tu acción');
      await captura(organizacion, '04-insignia-en-la-barra-del-panel');

      await enlace.click();
      const fila = organizacion.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: NOMBRE });
      await expect(fila).toContainText('Ajustes pedidos');
      await captura(organizacion, '05-solicitudes-panel-tu-accion');
      await (await opcionDelMenu(fila, /Atender/)).click();
      await expect(organizacion).toHaveURL(new RegExp(`/gestion/o/${id}/procesos/festivales/\\d+\\?seccion=informacion&ajustes=1`));
    });

    await test.step('Mi espacio lo muestra con la misma fila: pestañas por tipo de proceso y el estado como filtro', async () => {
      await organizacion.goto('/gestion/cuenta/solicitudes', { waitUntil: 'domcontentloaded' });
      await expect(organizacion.getByRole('tab', { name: /^Todos/ })).toHaveAttribute('aria-selected', 'true');
      await expect(organizacion.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: NOMBRE })).toContainText('Ajustes pedidos');
      await captura(organizacion, '06-mi-actividad-tu-accion');
      await organizacion.getByRole('tab', { name: /^Festivales/ }).click();
      await expect(organizacion.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: NOMBRE })).toBeVisible();
      await captura(organizacion, '07-mi-actividad-reciente');
    });
  });
});
