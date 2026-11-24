import { test, expect, Browser, Page } from '@playwright/test';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * La red o centro de documentación, de punta a punta.
 *
 *   1. UNA PERSONA RESPONSABLE (cuenta individual, sin organización) registra su red desde su
 *      espacio, la envía a revisión, el Programa la publica y se ve en el directorio público, en su
 *      ficha y —al mirar el portal sin sesión— sin el nombre de la persona.
 *   2. Una ORGANIZACIÓN registra su red; el Programa pide ajustes con un motivo; la organización lo
 *      ve, lo corrige y lo reenvía.
 *
 * Requiere la base de demostración completa (`scripts/demo/sembrar-demo.sh completa`, que incluye los
 * redes), el frontend y la API en marcha. Escribe redes nuevas en cada ejecución.
 */

const CLAVE = process.env.SIMUS_EXTERNO_PASSWORD ?? process.env.PNMC_EXTERNO_PASSWORD ?? 'admin';
const PERSONA = { email: 'valentina.ocampo@correo.test', password: CLAVE };
const ORGANIZACION = { email: 'lucia.ramirez@cantaclaro.test', password: CLAVE };
const FUNCIONARIO = {
  email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test',
  password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin',
};

const SUFIJO = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const RED_DE_LA_PERSONA = `Archivo de Cuatros ${SUFIJO}`;
const RED_DE_LA_ORGANIZACION = `Archivo de Violines ${SUFIJO}`;

async function sesionExterna(browser: Browser, cuenta: { email: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  const entrada = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: cuenta });
  expect(entrada.status(), `la cuenta ${cuenta.email} de demostración tiene que poder entrar`).toBe(200);
  return page;
}

async function sesionDeConsola(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), FUNCIONARIO.email);
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(FUNCIONARIO.email);
  await page.locator('input[type="password"]').fill(FUNCIONARIO.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

/** Diligencia el formulario de la red con lo mínimo para poder enviarlo a revisión. */
async function diligenciar(page: Page, nombre: string): Promise<void> {
  await page.locator('#red-nombre').fill(nombre);
  await page.locator('#red-descripcion').fill('Archivo de grabaciones y partituras de la región, con consulta en sala.');
  await page.locator('input[name="accesoAbierto"]').check();

  // La primera forma de acceso y el primer formato que ofrezca el catálogo propuesto.
  await page.locator('input[name^="forma-de-acceso-"]').first().check();
  await page.locator('input[name^="formato-"]').first().check();

  await elegirEnDesplegable(page.locator('#red-departamento'), { indice: 1 });
  await elegirEnDesplegable(page.locator('#red-municipio'), { indice: 1 });
  await page.locator('#red-correo').fill('red@ejemplo.org');
}

/** El diálogo de confirmación común (no la ficha lateral de la consola, que también es un diálogo). */
function dialogoComun(page: Page) {
  return page.getByRole('dialog').filter({ has: page.locator('[data-testid="confirmacion-comun-aceptar"]') });
}

/** Pulsa «Aceptar» en el diálogo de confirmación común. */
async function confirmar(page: Page, motivo?: string): Promise<void> {
  const dialogo = dialogoComun(page);
  await expect(dialogo).toBeVisible();
  if (motivo) await dialogo.locator('textarea').fill(motivo);
  await page.locator('[data-testid="confirmacion-comun-aceptar"]').click();
}

test.describe('Redes y documentación: la red de punta a punta', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('una persona responsable registra su red, el PNMC la publica y el portal la muestra', { tag: '@backend' }, async ({ browser }) => {
    const responsable = await sesionExterna(browser, PERSONA);
    const consola = await sesionDeConsola(browser);

    await test.step('la registra desde su espacio, sin organización', async () => {
      await responsable.goto('/gestion/cuenta/redes', { waitUntil: 'domcontentloaded' });
      await expect(responsable.getByRole('heading', { name: 'Procesos', level: 1 })).toBeVisible();
      // (PANEL) La lista de Mi espacio es la de procesos, con pestañas por tipo: se registra desde su menú.
      await responsable.getByRole('button', { name: 'Registrar proceso' }).click();
      await responsable.locator('[data-menu-registrar-red]').click();
      await expect(responsable).toHaveURL(/\/gestion\/cuenta\/redes\/nuevo$/);
      await diligenciar(responsable, RED_DE_LA_PERSONA);
      await responsable.locator('[data-testid="guardar-red"]').click();
      // Guardado como borrador, la ficha de la red nueva se abre sola.
      await expect(responsable).toHaveURL(/\/gestion\/cuenta\/redes\/\d+(\?.*)?$/, { timeout: 30_000 });
      await expect(responsable.getByText('Borrador').first()).toBeVisible();
    });

    await test.step('la envía a revisión, con confirmación, y deja de ser editable', async () => {
      await responsable.locator('[data-testid="enviar-red"]').click();
      await expect(dialogoComun(responsable)).toContainText('Enviar a revisión');
      await confirmar(responsable);
      await expect(responsable.locator('[data-testid="aviso-del-red"]')).toContainText('quedó en revisión', { timeout: 30_000 });
      await expect(responsable.locator('[data-testid="guardar-red"]')).toHaveCount(0);
      await expect(responsable.locator('[data-testid="retirar-de-revision"]')).toBeVisible();
    });

    await test.step('antes de publicarse, el portal no la muestra', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/redes', { waitUntil: 'domcontentloaded' });
      // El directorio estándar ya no tiene un contador propio: la carga terminó cuando aparece el resumen de resultados («Mostrando 1–N de N») o el estado vacío.
      await expect(anonimo.getByText(/Mostrando \d+\S+\d+ de \d+|Todavía no hay redes|Ninguna red coincide/).first()).toBeVisible({ timeout: 30_000 });
      await expect(anonimo.getByText(RED_DE_LA_PERSONA)).toHaveCount(0);
      await anonimo.context().close();
    });

    await test.step('el PNMC la revisa en la consola y la publica', async () => {
      await consola.goto('/administracion/procesos?tipo=redes', { waitUntil: 'domcontentloaded' });
      await consola.locator('[data-testid="buscar-proceso"]').fill(RED_DE_LA_PERSONA);
      await consola.keyboard.press('Enter');
      const fila = consola.locator('[data-testid="fila-de-proceso-consola"]').filter({ hasText: RED_DE_LA_PERSONA });
      await expect(fila).toBeVisible({ timeout: 30_000 });
      // Una persona responsable se nombra así en la consola.
      await expect(fila).toContainText('(independiente)');
      await fila.getByRole('button', { name: RED_DE_LA_PERSONA }).click();
      await expect(consola).toHaveURL(/\/administracion\/redes\/\d+(\?.*)?$/);
      await consola.locator('[data-testid="publicar-red"]').click();
      await confirmar(consola);
      await expect(consola.locator('[data-testid="aviso-de-decision"]')).toContainText('quedó publicada', { timeout: 30_000 });
    });

    await test.step('el portal la muestra en el directorio y en su ficha, sin el nombre de la persona', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/redes', { waitUntil: 'domcontentloaded' });
      const tarjeta = anonimo.locator('[data-testid="tarjeta-de-red"]').filter({ hasText: RED_DE_LA_PERSONA });
      await expect(tarjeta).toBeVisible({ timeout: 30_000 });
      // En el directorio estándar la tarjeta no es un enlace: se abre con su botón «Ver ficha».
      await tarjeta.locator('[data-abrir-registro]').click();
      await expect(anonimo).toHaveURL(/\/ecosistema\/redes\/\d+(\?.*)?$/);
      await expect(anonimo.getByRole('heading', { name: RED_DE_LA_PERSONA }).first()).toBeVisible();
      await expect(anonimo.getByText('Persona responsable')).toBeVisible();
      await expect(anonimo.getByText('Valentina Ocampo')).toHaveCount(0);
      await anonimo.context().close();
    });

    await test.step('el mapa tiene la capa «Redes doc.» y, al elegirla, lista la red publicada', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      // La primera visita abre el tutorial, que tapa las capas: se marca como ya visto.
      await anonimo.addInitScript(() => window.localStorage.setItem('pnmc_last_tutorial_date', '2026-01-01'));
      await anonimo.goto('/mapa-ecosistemico', { waitUntil: 'domcontentloaded' });
      const capa = anonimo.getByRole('button', { name: /Redes doc\./ }).first();
      await expect(capa).toBeVisible({ timeout: 30_000 });
      await capa.click();
      await expect(anonimo.getByText(RED_DE_LA_PERSONA).first()).toBeVisible({ timeout: 30_000 });
      await anonimo.context().close();
    });

    await test.step('la persona responsable retira su red del ecosistema, con motivo, y deja de verse', async () => {
      await responsable.goto('/gestion/cuenta/redes', { waitUntil: 'domcontentloaded' });
      await responsable.locator('[data-proceso-tipo="redes"]').filter({ hasText: RED_DE_LA_PERSONA }).click();
      await responsable.locator('[data-testid="retirar-red"]').click();
      await confirmar(responsable, 'Cierro la red por traslado.');
      await expect(responsable.locator('[data-testid="aviso-del-red"]')).toContainText('se retiró del ecosistema', { timeout: 30_000 });

      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/redes', { waitUntil: 'domcontentloaded' });
      // El directorio estándar ya no tiene un contador propio: la carga terminó cuando aparece el resumen de resultados («Mostrando 1–N de N») o el estado vacío.
      await expect(anonimo.getByText(/Mostrando \d+\S+\d+ de \d+|Todavía no hay redes|Ninguna red coincide/).first()).toBeVisible({ timeout: 30_000 });
      await expect(anonimo.getByText(RED_DE_LA_PERSONA)).toHaveCount(0);
      await anonimo.context().close();
    });
  });

  test('una organización registra su red, el PNMC pide ajustes con motivo y ella los atiende', { tag: '@backend' }, async ({ browser }) => {
    const organizacion = await sesionExterna(browser, ORGANIZACION);
    const consola = await sesionDeConsola(browser);
    const MOTIVO = 'Precisa en qué barrio queda la red y qué acervos conserva.';

    await test.step('la organización la registra desde su panel y la envía', async () => {
      await organizacion.goto('/gestion/procesos/redes/nuevo', { waitUntil: 'domcontentloaded' });
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/procesos\/redes\/nuevo$/);
      await diligenciar(organizacion, RED_DE_LA_ORGANIZACION);
      await organizacion.locator('[data-testid="guardar-red"]').click();
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/procesos\/redes\/\d+(\?.*)?$/, { timeout: 30_000 });
      await organizacion.locator('[data-testid="enviar-red"]').click();
      await confirmar(organizacion);
      await expect(organizacion.locator('[data-testid="aviso-del-red"]')).toContainText('quedó en revisión', { timeout: 30_000 });
    });

    await test.step('el PNMC pide ajustes y el motivo es obligatorio', async () => {
      await consola.goto('/administracion/procesos?tipo=redes', { waitUntil: 'domcontentloaded' });
      await consola.locator('[data-testid="buscar-proceso"]').fill(RED_DE_LA_ORGANIZACION);
      await consola.keyboard.press('Enter');
      const fila = consola.locator('[data-testid="fila-de-proceso-consola"]').filter({ hasText: RED_DE_LA_ORGANIZACION });
      await expect(fila).toBeVisible({ timeout: 30_000 });
      await fila.getByRole('button', { name: RED_DE_LA_ORGANIZACION }).click();
      await consola.locator('[data-testid="pedir-ajustes-red"]').click();
      await expect(dialogoComun(consola)).toContainText('Pedir ajustes');
      // Sin motivo no se puede confirmar.
      await expect(consola.locator('[data-testid="confirmacion-comun-aceptar"]')).toBeDisabled();
      await dialogoComun(consola).locator('textarea').fill(MOTIVO);
      await consola.locator('[data-testid="confirmacion-comun-aceptar"]').click();
      await expect(consola.locator('[data-testid="aviso-de-decision"]')).toContainText('Se pidieron ajustes', { timeout: 30_000 });
    });

    await test.step('la organización ve el motivo, corrige y reenvía', async () => {
      await organizacion.reload({ waitUntil: 'domcontentloaded' });
      await expect(organizacion.locator('[data-testid="ajustes-del-red"]')).toContainText(MOTIVO, { timeout: 30_000 });
      await organizacion.locator('#red-lugar').fill('Barrio Bolívar');
      await organizacion.locator('[data-testid="guardar-red"]').click();
      await expect(organizacion.locator('[data-testid="aviso-del-red"]')).toContainText('quedaron guardados', { timeout: 30_000 });
      await organizacion.locator('[data-testid="enviar-red"]').click();
      await expect(dialogoComun(organizacion)).toContainText('Enviar a revisión');
      await confirmar(organizacion);
      await expect(organizacion.locator('[data-testid="aviso-del-red"]')).toContainText('quedó en revisión', { timeout: 30_000 });
    });
  });
});
