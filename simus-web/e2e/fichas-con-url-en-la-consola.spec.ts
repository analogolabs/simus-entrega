import { test, expect, Browser, Page } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Las fichas de la consola tienen dirección propia.
 *
 *   1. SIN SESIÓN: un enlace profundo a un Festival muestra el acceso bajo esa misma dirección; al
 *      entrar, abre la ficha (no se tira al Resumen).
 *   2. CON SESIÓN: el enlace a la revisión de un Festival nuevo abre su revisión; recargar la
 *      conserva; «Ver la ficha completa» tiene su dirección y «Atrás» vuelve al resumen.
 *   3. El enlace antiguo `?revisar={id}` —el de los correos ya enviados— redirige a la revisión sin
 *      apilar una entrada.
 *   4. Abrir una organización desde la lista cambia la dirección, y «Atrás» cierra la ficha.
 *   5. La campana abre la revisión concreta del aviso, no la bandeja genérica, y no repite el aviso
 *      con forma de correo.
 *
 * Requiere el entorno local (API y web) con la cuenta de consola de demostración y la confirmación
 * de correo dispensada (modo demo). Crea una organización y un Festival enviado a revisión.
 */

const MARCA = `${Date.now()}`.slice(-9);
const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin' };
const ORGANIZACION = `Corporación de la Ficha ${MARCA}`;
const FESTIVAL = `Festival de la Ficha ${MARCA}`;
const CUENTA = { email: `l5.${MARCA}@ejemplo.test`, password: 'Clave-Segura-2026' };

let festivalId = '';
let organizacionId = '';

async function prepararFestivalEnRevision(browser: Browser): Promise<void> {
  const page = await (await browser.newContext()).newPage();
  const preparacion = await (await page.request.get('/api/v1/externo/auth/register-preparation')).json() as { politicas?: { clave: string }[] };
  const alta = await page.request.post('/api/v1/externo/auth/register', {
    data: {
      registrationType: 'organizacion',
      organizationName: ORGANIZACION,
      headquartersDepartmentCode: '41',
      headquartersMunicipalityCode: '41001',
      firstName: 'Ana', firstSurname: 'Restrepo', documentType: 'cc', documentNumber: `7${MARCA}`,
      phone: '3001234567', email: CUENTA.email, password: CUENTA.password,
      politicasAceptadas: (preparacion.politicas ?? []).map(politica => politica.clave),
    },
  });
  expect(alta.ok(), `el registro tiene que aceptar la cuenta: ${await alta.text()}`).toBeTruthy();
  const entrada = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: CUENTA });
  expect(entrada.ok(), await entrada.text()).toBeTruthy();
  const sesion = await (await page.request.get('/api/v1/externo/auth/me')).json() as { organizations: { id: string | number }[] };
  organizacionId = String(sesion.organizations[0].id);

  const testigo = async () => ((await (await page.request.get('/api/v1/externo/organizaciones/csrf')).json()) as { requestToken: string }).requestToken;
  const borrador = await page.request.post(`/api/v1/externo/organizaciones/${organizacionId}/festivales`, {
    headers: { 'X-CSRF-TOKEN': await testigo() },
    data: { nombre: FESTIVAL, descripcion: 'Festival para probar la ficha con dirección.', nivelCobertura: 'municipal', codigoDepartamento: '41', codigoMunicipio: '41001' },
  });
  expect(borrador.ok(), await borrador.text()).toBeTruthy();
  festivalId = String(((await borrador.json()) as { id: string | number }).id);
  const envio = await page.request.post(`/api/v1/externo/festivales/${festivalId}/enviar-a-revision`, {
    headers: { 'X-CSRF-TOKEN': await testigo() }, data: {},
  });
  expect(envio.ok(), await envio.text()).toBeTruthy();
  await page.context().close();
}

async function entrar(page: Page): Promise<void> {
  await page.locator('input[type="email"]').fill(WEBMASTER.email);
  await page.locator('input[type="password"]').fill(WEBMASTER.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
}

async function contextoDeConsola(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), WEBMASTER.email);
  const page = await context.newPage();
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await entrar(page);
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

test.describe('las fichas de la consola tienen dirección propia', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeAll(async ({ browser }) => { await prepararFestivalEnRevision(browser); });

  test('un enlace profundo a un Festival, sin sesión, sobrevive al ingreso', { tag: '@backend' }, async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), WEBMASTER.email);
    const page = await context.newPage();

    await page.goto(`/administracion/festivales/${festivalId}`, { waitUntil: 'domcontentloaded' });
    // Sin sesión: el acceso, bajo la misma dirección.
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/administracion/festivales/${festivalId}$`));

    await entrar(page);

    await expect(page).toHaveURL(new RegExp(`/administracion/festivales/${festivalId}$`));
    await expect(page.locator('#ficha-festival-titulo')).toHaveText(FESTIVAL, { timeout: 30_000 });
    await context.close();
  });

  test('la revisión de una solicitud: enlace, recarga, ficha completa y «Atrás»', { tag: '@backend' }, async ({ browser }) => {
    const page = await contextoDeConsola(browser);
    const revision = `/administracion/solicitudes/review-festivals-${festivalId}`;

    await page.goto(revision, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.revision-detalle__titulo')).toHaveText(FESTIVAL, { timeout: 30_000 });

    // Recargar conserva la ficha.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.revision-detalle__titulo')).toHaveText(FESTIVAL, { timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`${revision}$`));

    // La ficha completa tiene su dirección; «Atrás» vuelve al resumen del mismo asunto.
    await page.getByRole('button', { name: 'Ver la ficha completa' }).click();
    await expect(page).toHaveURL(new RegExp(`${revision}/ficha$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${revision}$`));
    await expect(page.locator('.revision-detalle__titulo')).toHaveText(FESTIVAL);
    await expect(page.getByRole('button', { name: 'Ver la ficha completa' })).toBeVisible();

    // Quitar el asunto —cerrar— deja la lista, y «Atrás» lo vuelve a abrir.
    await page.getByRole('button', { name: 'Cerrar la previsualización' }).click();
    await expect(page).toHaveURL(/\/administracion\/solicitudes$/);
    await expect(page.locator('.revision-detalle__titulo')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('.revision-detalle__titulo')).toHaveText(FESTIVAL, { timeout: 15_000 });
    await page.context().close();
  });

  test('el enlace antiguo ?revisar= abre la revisión y «Atrás» no vuelve a él', { tag: '@backend' }, async ({ browser }) => {
    const page = await contextoDeConsola(browser);
    await page.goto('/administracion/resumen', { waitUntil: 'domcontentloaded' });
    await page.goto(`/administracion/festivales?revisar=${festivalId}`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(new RegExp(`/administracion/solicitudes/review-festivals-${festivalId}$`), { timeout: 30_000 });
    await expect(page.locator('.revision-detalle__titulo')).toHaveText(FESTIVAL, { timeout: 30_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/administracion\/resumen$/);
    await page.context().close();
  });

  test('una organización se abre desde la lista con su dirección y «Atrás» la cierra', { tag: '@backend' }, async ({ browser }) => {
    const page = await contextoDeConsola(browser);
    await page.goto('/administracion/organizaciones', { waitUntil: 'domcontentloaded' });

    await page.locator('[data-abrir-ficha-organizacion]', { hasText: ORGANIZACION }).first().click();
    await expect(page).toHaveURL(new RegExp(`/administracion/organizaciones/${organizacionId}$`));
    await expect(page.locator('#ficha-organizacion-titulo')).toHaveText(ORGANIZACION, { timeout: 30_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/administracion\/organizaciones$/);
    await expect(page.locator('#ficha-organizacion-titulo')).toHaveCount(0);

    // Y el enlace directo, con recarga, la abre.
    await page.goto(`/administracion/organizaciones/${organizacionId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#ficha-organizacion-titulo')).toHaveText(ORGANIZACION, { timeout: 30_000 });
    await page.context().close();
  });

  test('la campana abre la revisión concreta del aviso, una sola vez', { tag: '@backend' }, async ({ browser }) => {
    const page = await contextoDeConsola(browser);
    await page.goto('/administracion/resumen', { waitUntil: 'domcontentloaded' });

    await page.locator('button.notification-button').click();
    const avisos = page.locator('.notification-tray__lista button', { hasText: FESTIVAL });
    // UN AVISO POR EVENTO: el correo en cola («SIMUS · Nueva solicitud…») ya no se lista.
    await expect(avisos).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('.notification-tray__lista')).not.toContainText('revisar=');

    await avisos.first().click();
    await expect(page).toHaveURL(new RegExp(`/administracion/solicitudes/review-festivals-${festivalId}$`), { timeout: 30_000 });
    await expect(page.locator('.revision-detalle__titulo')).toHaveText(FESTIVAL, { timeout: 30_000 });
    await page.context().close();
  });
});
