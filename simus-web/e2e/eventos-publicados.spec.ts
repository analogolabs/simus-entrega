import { test, expect, Browser, Page } from '@playwright/test';
import { opcionDelMenu } from './apoyo/menu-de-acciones';

/**
 * Un evento ya publicado se corrige, se retira o se cancela (E1; D3-12 a D3-14, docs/referencia/20-decisiones-y-flujos-por-modulo.md decisiones 24 a 26).
 *
 * <b>POR QUÉ EXISTE.</b> Corregir una letra de un evento publicado lo sacaba de la Agenda hasta una nueva
 * revisión, y la organización no podía retirar ni cancelar el suyo. Las pruebas de la API cubren cada
 * regla; esta cubre que la pantalla las enseña y que lo público cambia al instante (la lista pública se
 * guarda 60 s: si no se vaciara, lo retirado seguiría a la vista).
 *
 * Requiere el entorno local con la base de demostración completa (`scripts/demo/reconstruir-demo-local.sh`),
 * el frontend y la API. Crea un evento con una marca única en cada ejecución.
 */

const GESTOR = { email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test', password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin' };
/** La administradora de la Corporación Cultural Cantaclaro, que ya tiene un Festival publicado. */
const ORGANIZACION = { email: 'lucia.ramirez@cantaclaro.test', password: 'admin' };
const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(6, 14);

test.describe('E1: un evento publicado se corrige, se cancela o se retira', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('la errata sigue en la agenda, el cambio de fondo vuelve a revisión, y cancelar o retirar se ven al instante', { tag: '@backend' }, async ({ browser }) => {
    const titulo = `Concierto de prueba E1 ${MARCA}`;
    const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const organizacion = await sesionDeOrganizacion(browser);
    const gestor = await sesionDeConsola(browser);
    const idDeOrganizacion = /\/gestion\/o\/(\d+)/.exec(organizacion.url())![1];
    const eventos = `/gestion/o/${idDeOrganizacion}/eventos`;
    const detallePublico = () => organizacion.request.get(`/api/v1/publico/agenda/${slug}`);

    await test.step('un evento publicado, preparado por la API y aprobado por la consola', async () => {
      const id = await anunciarEvento(organizacion, idDeOrganizacion, titulo);
      await publicar(gestor, id);
      expect((await detallePublico()).status(), 'el evento publicado se lee en la Agenda pública').toBe(200);
    });

    await test.step('una errata se corrige al instante y el evento sigue en la agenda', async () => {
      await organizacion.goto(eventos, { waitUntil: 'domcontentloaded' });
      const fila = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await (await opcionDelMenu(fila, /^Editar/)).click();
      // El formulario dice qué es una errata ANTES de guardar.
      await expect(organizacion.getByRole('dialog')).toContainText('se aplica al instante');
      await organizacion.getByLabel(/^Descripción/i).fill('Concierto de apertura con músicas andinas.');
      await organizacion.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();

      await expect(organizacion.getByRole('status').filter({ hasText: 'Corregimos el evento' })).toBeVisible({ timeout: 30_000 });
      await expect(organizacion.getByRole('row', { name: new RegExp(titulo) })).toContainText('Publicado');
      const publico = await detallePublico();
      expect(publico.status(), 'la errata no lo saca de la Agenda').toBe(200);
      expect(((await publico.json()) as { descripcion: string }).descripcion).toBe('Concierto de apertura con músicas andinas.');
    });

    await test.step('un cambio de fondo lo devuelve a revisión, dice qué cambió y lo saca de la agenda', async () => {
      const fila = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await (await opcionDelMenu(fila, /^Editar/)).click();
      await organizacion.getByLabel(/^Lugar/i).fill('Auditorio Principal');
      await organizacion.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();

      await expect(organizacion.getByRole('status').filter({ hasText: 'volvió a revisión porque cambió el lugar' })).toBeVisible({ timeout: 30_000 });
      await expect(organizacion.getByRole('row', { name: new RegExp(titulo) })).toContainText('En revisión');
      expect((await detallePublico()).status(), 'lo nuevo no está aprobado: sale de la Agenda').toBe(404);

      await publicar(gestor, await idDelEvento(organizacion, idDeOrganizacion, titulo));
      expect((await detallePublico()).status()).toBe(200);
    });

    await test.step('cancelar pide el motivo y el evento sigue en la agenda, marcado como cancelado', async () => {
      await organizacion.goto(eventos, { waitUntil: 'domcontentloaded' });
      const fila = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await (await opcionDelMenu(fila, /^Cancelar evento/)).click();

      const dialogo = organizacion.getByRole('dialog');
      await expect(dialogo).toContainText('seguirá en la agenda pública');
      // SIN MOTIVO, NO SE PUEDE CONFIRMAR.
      await expect(organizacion.getByTestId('confirmacion-comun-aceptar')).toBeDisabled();
      await dialogo.getByLabel('Por qué se cancela').fill('Lluvia en toda la región.');
      await organizacion.getByTestId('confirmacion-comun-aceptar').click();

      await expect(organizacion.getByRole('status').filter({ hasText: 'quedó cancelado' })).toBeVisible({ timeout: 30_000 });
      const cancelada = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await expect(cancelada).toContainText('Cancelado');
      await expect(cancelada.getByTestId('motivo-de-la-cancelacion')).toContainText('Lluvia en toda la región.');
      await expect(await opcionDelMenu(cancelada, /^Editar/)).toBeDisabled();
      await expect(await opcionDelMenu(cancelada, /^Cancelar evento/)).toBeDisabled();

      const publico = await detallePublico();
      expect(publico.status(), 'un evento cancelado sigue en la Agenda').toBe(200);
      const cuerpo = (await publico.json()) as { cancelado: boolean; motivoCancelacion: string };
      expect(cuerpo.cancelado).toBe(true);
      expect(cuerpo.motivoCancelacion).toBe('Lluvia en toda la región.');

      // Y SE LEE EN LA PÁGINA PÚBLICA.
      await organizacion.goto(`/agenda/${slug}`, { waitUntil: 'domcontentloaded' });
      await expect(organizacion.getByTestId('evento-cancelado')).toContainText('Este evento fue cancelado', { timeout: 30_000 });
      await expect(organizacion.getByTestId('evento-motivo-cancelacion')).toContainText('Lluvia en toda la región.');
    });

    await test.step('retirar pide el motivo y lo saca de la agenda al instante', async () => {
      await organizacion.goto(eventos, { waitUntil: 'domcontentloaded' });
      const fila = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await (await opcionDelMenu(fila, /^Retirar de la agenda/)).click();

      await organizacion.getByRole('dialog').getByLabel('Por qué se retira').fill('Ya no tiene sentido anunciarlo.');
      await organizacion.getByTestId('confirmacion-comun-aceptar').click();

      await expect(organizacion.getByRole('status').filter({ hasText: 'salió de la agenda pública' })).toBeVisible({ timeout: 30_000 });
      await expect(organizacion.getByRole('row', { name: new RegExp(titulo) })).toContainText('Archivado');
      expect((await detallePublico()).status(), 'lo retirado no sigue a la vista, aunque la lista se guarde 60 s').toBe(404);
    });
  });
});

// ─────────────────────────────── Apoyos ───────────────────────────────

async function sesionDeOrganizacion(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/ingresar', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').first().fill(ORGANIZACION.email);
  await page.locator('input[type=password]').first().fill(ORGANIZACION.password);
  await page.getByRole('button', { name: /^Ingresar$|^Entrar/i }).last().click();
  // ACC2: tras iniciar sesión se pregunta «¿Cómo quieres entrar?»; esta cuenta entra a su organización.
  await expect(page.getByTestId('entrada-a-gestion')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-testid^="entrar-organizacion-"]').first().click();
  await page.waitForURL(/\/gestion\/o\/\d+/, { timeout: 30_000 });
  return page;
}

async function sesionDeConsola(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), GESTOR.email);
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(GESTOR.email);
  await page.locator('input[type="password"]').fill(GESTOR.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

/** Anuncia un evento por la API de la organización (el recorrido de pantalla ya lo cubre D3). Devuelve su id. */
async function anunciarEvento(organizacion: Page, idDeOrganizacion: string, titulo: string): Promise<string> {
  const procesos = (await (await organizacion.request.get(`/api/v1/externo/organizaciones/${idDeOrganizacion}/procesos-que-enmarcan`)).json()) as { id: string; tipo: string }[];
  const festival = procesos.find(p => p.tipo === 'festival');
  expect(festival, 'la organización de demostración tiene un Festival publicado').toBeTruthy();
  const testigo = ((await (await organizacion.request.get('/api/v1/externo/organizaciones/csrf')).json()) as { requestToken: string }).requestToken;
  const alta = await organizacion.request.post(`/api/v1/externo/organizaciones/${idDeOrganizacion}/eventos`, {
    headers: { 'X-CSRF-TOKEN': testigo },
    data: {
      titulo, descripcion: 'Concierto de apertura, con músicas andinas.', fechaInicio: '2027-03-05', modalidad: 'presencial',
      lugar: 'Teatro Municipal', festivalId: Number(festival!.id),
    },
  });
  expect(alta.status(), await alta.text()).toBe(201);
  return ((await alta.json()) as { id: string }).id;
}

async function idDelEvento(organizacion: Page, idDeOrganizacion: string, titulo: string): Promise<string> {
  const propios = (await (await organizacion.request.get(`/api/v1/externo/organizaciones/${idDeOrganizacion}/eventos`)).json()) as { id: string; titulo: string }[];
  return propios.find(e => e.titulo === titulo)!.id;
}

/** La consola publica un evento que está en revisión. */
async function publicar(gestor: Page, id: string): Promise<void> {
  const testigo = ((await (await gestor.request.get('/api/v1/admin/contenido-web/csrf')).json()) as { token: string }).token;
  const decision = await gestor.request.post(`/api/v1/institucional/revision-de-eventos/${id}/decision`, {
    headers: { 'X-CSRF-TOKEN': testigo }, data: { decision: 'publicar' },
  });
  expect(decision.status(), await decision.text()).toBe(200);
}
