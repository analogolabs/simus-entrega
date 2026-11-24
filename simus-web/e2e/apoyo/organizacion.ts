import { expect, Browser, Page } from '@playwright/test';
import { elegirEnDesplegable } from './desplegable';
import { postConCupo } from './cupo-de-entradas';

/**
 * Lo que comparten las pruebas de navegador del panel de organización (`/gestion`).
 *
 * Requieren la base de demostración (`scripts/demo/reconstruir-demo-local.sh`): en ella la cuenta de
 * organización responde por «Corporación Musical de Antioquia».
 */

export const ORGANIZACION = {
  email: process.env.SIMUS_EXTERNO_EMAIL ?? process.env.PNMC_EXTERNO_EMAIL ?? 'externo@simus.test',
  password: process.env.SIMUS_EXTERNO_PASSWORD ?? process.env.PNMC_EXTERNO_PASSWORD ?? 'admin',
};

/** Un contexto de navegador propio con la sesión de la organización ya abierta. */
export async function sesionDeOrganizacion(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  const entrada = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: ORGANIZACION });
  expect(entrada.status(), 'la cuenta de organización de demostración tiene que poder entrar').toBe(200);
  const sesion = await (await page.request.get('/api/v1/externo/auth/me')).json();
  expect(sesion.organizations?.length ?? 0,
    'la cuenta de demostración debe responder por una organización: reconstruye la base con scripts/demo/reconstruir-demo-local.sh')
    .toBeGreaterThan(0);
  return page;
}

/** Registra un Festival con el asistente de cuatro pasos y vuelve a la lista. */
export async function crearFestivalConElAsistente(
  page: Page, nombre: string, descripcion = 'Festival de prueba.', asistente = '/gestion/procesos/festivales/nuevo',
): Promise<void> {
  // `/gestion/procesos/…` sin organización lleva a la organización por omisión.
  await page.goto(asistente, { waitUntil: 'domcontentloaded' });
  await page.fill('#asistente-nombre', nombre);
  await page.fill('#asistente-descripcion', descripcion);
  await siguiente(page);

  await elegirEnDesplegable(page.locator('#asistente-departamento'), { indice: 1 });
  // El alcance nace «Municipal»: la lista de municipios llega un instante después del departamento.
  await elegirEnDesplegable(page.locator('#asistente-municipio'), { indice: 1 });
  await page.fill('#asistente-correo', 'festival@ejemplo.org');
  await siguiente(page);

  await page.locator('[data-testid="casillas-practicasMusicalesIds"] input').first().check();
  await page.locator('[data-testid="casillas-territoriosSonorosIds"] input').first().check();
  await siguiente(page);

  // LAS COINCIDENCIAS: con varios Festivales de nombre parecido en el mismo
  // territorio —los que crea la propia prueba— el asistente pregunta antes de crear otro.
  const guardar = page.getByRole('button', { name: /Guardar borrador/ });
  const seguirConUnoNuevo = page.getByRole('button', { name: 'No corresponde; continuar con un Festival nuevo' });
  await expect(guardar.or(seguirConUnoNuevo).first()).toBeVisible({ timeout: 15_000 });
  if (await seguirConUnoNuevo.isVisible()) await seguirConUnoNuevo.click();
  await guardar.click();
  await expect(page.locator('[data-testid="asistente-error"]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/gestion\/o\/\d+\/procesos\/festivales$/, { timeout: 30_000 });
}

/** Abre la ficha del Festival desde la lista y devuelve su identificador. */
export async function abrirFichaDelFestival(page: Page, nombre: string): Promise<string> {
  await page.goto('/gestion/procesos/festivales', { waitUntil: 'domcontentloaded' });
  const fila = page.locator('li, article').filter({ hasText: nombre }).first();
  await fila.getByRole('button', { name: 'Ver ficha' }).click();
  await expect(page).toHaveURL(/\/gestion\/o\/\d+\/procesos\/festivales\/\d+/);
  return /festivales\/(\d+)/.exec(page.url())![1];
}

async function siguiente(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Siguiente' }).click();
}
