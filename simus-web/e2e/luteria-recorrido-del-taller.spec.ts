import { test, expect, Browser, Page } from '@playwright/test';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * El taller de lutería, de punta a punta.
 *
 *   1. Un LUTIER INDEPENDIENTE (cuenta individual, sin organización) registra su taller desde su
 *      espacio, lo envía a revisión, el Programa lo publica y se ve en el directorio público, en su
 *      ficha y —al mirar el portal sin sesión— sin el nombre de la persona.
 *   2. Una ORGANIZACIÓN registra su taller; el Programa pide ajustes con un motivo; la organización lo
 *      ve, lo corrige y lo reenvía.
 *
 * Requiere la base de demostración completa (`scripts/demo/sembrar-demo.sh completa`, que incluye los
 * talleres), el frontend y la API en marcha. Escribe talleres nuevos en cada ejecución.
 */

const CLAVE = process.env.SIMUS_EXTERNO_PASSWORD ?? process.env.PNMC_EXTERNO_PASSWORD ?? 'admin';
const LUTIER = { email: 'valentina.ocampo@correo.test', password: CLAVE };
const ORGANIZACION = { email: 'lucia.ramirez@cantaclaro.test', password: CLAVE };
const FUNCIONARIO = {
  email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test',
  password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin',
};

const SUFIJO = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const TALLER_INDEPENDIENTE = `Taller de Cuatros ${SUFIJO}`;
const TALLER_DE_ORGANIZACION = `Taller de Violines ${SUFIJO}`;

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

/** Diligencia el formulario del taller con lo mínimo para poder enviarlo a revisión. */
async function diligenciar(page: Page, nombre: string): Promise<void> {
  await page.locator('#taller-nombre').fill(nombre);
  await page.locator('#taller-descripcion').fill('Construcción y reparación de instrumentos de cuerda para músicos de la región.');
  await page.locator('input[name="aprendices"]').check();

  // El primer servicio y la primera familia que ofrezca el catálogo propuesto.
  await page.locator('input[name^="servicio-"]').first().check();
  await page.locator('input[name^="familia-"]').first().check();

  await elegirEnDesplegable(page.locator('#taller-departamento'), { indice: 1 });
  await elegirEnDesplegable(page.locator('#taller-municipio'), { indice: 1 });
  // LA SEDE PRINCIPAL (decisión 119): aparte de la cobertura. El municipio queda deshabilitado hasta elegir departamento.
  await expect(page.locator('#taller-sede-municipio')).toBeDisabled();
  await elegirEnDesplegable(page.locator('#taller-sede-departamento'), { indice: 1 });
  await expect(page.locator('#taller-sede-municipio')).toBeEnabled();
  await elegirEnDesplegable(page.locator('#taller-sede-municipio'), { indice: 1 });
  await expect(page.locator('[data-sede-pendiente]')).toHaveCount(0);
  await page.locator('#taller-correo').fill('taller@ejemplo.org');
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

test.describe('Lutería: el taller de punta a punta', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('un lutier independiente registra su taller, el PNMC lo publica y el portal lo muestra', { tag: '@backend' }, async ({ browser }) => {
    const lutier = await sesionExterna(browser, LUTIER);
    const consola = await sesionDeConsola(browser);

    await test.step('lo registra desde su espacio, sin organización', async () => {
      await lutier.goto('/gestion/cuenta/talleres', { waitUntil: 'domcontentloaded' });
      await expect(lutier.getByRole('heading', { name: 'Procesos', level: 1 })).toBeVisible();
      // (PANEL) La lista de Mi espacio es la de procesos, con pestañas por tipo: se registra desde su menú.
      await lutier.getByRole('button', { name: 'Registrar proceso' }).click();
      await lutier.locator('[data-menu-registrar-taller]').click();
      await expect(lutier).toHaveURL(/\/gestion\/cuenta\/talleres\/nuevo$/);
      await diligenciar(lutier, TALLER_INDEPENDIENTE);
      await lutier.locator('[data-testid="guardar-taller"]').click();
      // Guardado como borrador, la ficha del taller nuevo se abre sola.
      await expect(lutier).toHaveURL(/\/gestion\/cuenta\/talleres\/\d+(\?.*)?$/, { timeout: 30_000 });
      await expect(lutier.getByText('Borrador').first()).toBeVisible();
    });

    await test.step('lo envía a revisión, con confirmación, y deja de ser editable', async () => {
      await lutier.locator('[data-testid="enviar-taller"]').click();
      await expect(dialogoComun(lutier)).toContainText('Enviar a revisión');
      await confirmar(lutier);
      await expect(lutier.locator('[data-testid="aviso-del-taller"]')).toContainText('quedó en revisión', { timeout: 30_000 });
      await expect(lutier.locator('[data-testid="guardar-taller"]')).toHaveCount(0);
      await expect(lutier.locator('[data-testid="retirar-de-revision"]')).toBeVisible();
    });

    await test.step('antes de publicarse, el portal no lo muestra', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/luteria', { waitUntil: 'domcontentloaded' });
      // El directorio estándar ya no tiene un contador propio: la carga terminó cuando aparece el resumen de resultados («Mostrando 1–N de N») o el estado vacío.
      await expect(anonimo.getByText(/Mostrando \d+\S+\d+ de \d+|Todavía no hay talleres|Ningún taller coincide/).first()).toBeVisible({ timeout: 30_000 });
      await expect(anonimo.getByText(TALLER_INDEPENDIENTE)).toHaveCount(0);
      await anonimo.context().close();
    });

    await test.step('el PNMC lo revisa en la consola y lo publica', async () => {
      await consola.goto('/administracion/procesos?tipo=luteria', { waitUntil: 'domcontentloaded' });
      await consola.locator('[data-testid="buscar-proceso"]').fill(TALLER_INDEPENDIENTE);
      await consola.keyboard.press('Enter');
      const fila = consola.locator('[data-testid="fila-de-proceso-consola"]').filter({ hasText: TALLER_INDEPENDIENTE });
      await expect(fila).toBeVisible({ timeout: 30_000 });
      // Un lutier independiente se nombra así en la consola.
      await expect(fila).toContainText('(independiente)');
      await fila.getByRole('button', { name: TALLER_INDEPENDIENTE }).click();
      await expect(consola).toHaveURL(/\/administracion\/talleres\/\d+(\?.*)?$/);
      await consola.locator('[data-testid="publicar-taller"]').click();
      await confirmar(consola);
      await expect(consola.locator('[data-testid="aviso-de-decision"]')).toContainText('quedó publicado', { timeout: 30_000 });
    });

    await test.step('el portal lo muestra en el directorio y en su ficha, sin el nombre de la persona', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/luteria', { waitUntil: 'domcontentloaded' });
      const tarjeta = anonimo.locator('[data-testid="tarjeta-de-taller"]').filter({ hasText: TALLER_INDEPENDIENTE });
      await expect(tarjeta).toBeVisible({ timeout: 30_000 });
      // En el directorio estándar la tarjeta no es un enlace: se abre con su botón «Ver ficha».
      await tarjeta.locator('[data-abrir-registro]').click();
      await expect(anonimo).toHaveURL(/\/ecosistema\/luteria\/\d+(\?.*)?$/);
      await expect(anonimo.getByRole('heading', { name: TALLER_INDEPENDIENTE }).first()).toBeVisible();
      await expect(anonimo.getByText('Lutier independiente')).toBeVisible();
      await expect(anonimo.getByText('Valentina Ocampo')).toHaveCount(0);
      await anonimo.context().close();
    });

    await test.step('el mapa tiene la capa «Lutería» y, al elegirla, lista el taller publicado', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      // La primera visita abre el tutorial, que tapa las capas: se marca como ya visto (como en Redes y Espacios).
      await anonimo.addInitScript(() => window.localStorage.setItem('pnmc_last_tutorial_date', '2026-01-01'));
      await anonimo.goto('/mapa-ecosistemico', { waitUntil: 'domcontentloaded' });
      const capa = anonimo.getByRole('button', { name: /Lutería/ }).first();
      await expect(capa).toBeVisible({ timeout: 30_000 });
      await capa.click();
      await expect(anonimo.getByText(TALLER_INDEPENDIENTE).first()).toBeVisible({ timeout: 30_000 });
      await anonimo.context().close();
    });

    await test.step('PROP: un cambio de fondo de lo publicado se propone, el taller sigue publicado y el PNMC lo aplica', async () => {
      const NUEVO_NOMBRE = `${TALLER_INDEPENDIENTE} Sur`;
      await lutier.goto('/gestion/cuenta/talleres', { waitUntil: 'domcontentloaded' });
      await lutier.locator('[data-proceso-tipo="luteria"]').filter({ hasText: TALLER_INDEPENDIENTE }).click();
      await lutier.locator('#taller-nombre').fill(NUEVO_NOMBRE);
      await lutier.locator('[data-testid="guardar-taller"]').click();
      await expect(dialogoComun(lutier)).toContainText('proponer');
      await confirmar(lutier);
      await expect(lutier.locator('[data-propuesta-del-proceso]')).toBeVisible({ timeout: 30_000 });
      await lutier.locator('[data-enviar-propuesta]').click();
      await confirmar(lutier);
      await expect(lutier.locator('[data-propuesta-del-proceso]')).toContainText('está en revisión', { timeout: 30_000 });

      // LO PUBLICADO NO CAMBIA: el portal sigue mostrando el nombre de antes.
      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/luteria', { waitUntil: 'domcontentloaded' });
      await expect(anonimo.locator('[data-testid="tarjeta-de-taller"]').filter({ hasText: TALLER_INDEPENDIENTE }).first()).toBeVisible({ timeout: 30_000 });
      await expect(anonimo.getByText(NUEVO_NOMBRE)).toHaveCount(0);

      // EL PROGRAMA LA REVISA CAMPO POR CAMPO EN SOLICITUDES Y LA APLICA.
      await consola.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
      await consola.getByText(TALLER_INDEPENDIENTE).first().click();
      await expect(consola.getByText('Cambia un campo de la ficha publicada')).toBeVisible({ timeout: 30_000 });
      await consola.getByRole('button', { name: 'Aprobar' }).click();
      // LA BANDEJA CONFIRMA EN LÍNEA, con su propio botón (no el diálogo común).
      await consola.locator('[data-confirmar-decision]').click();
      await expect(consola.getByText('Los cambios propuestos ya están en la ficha publicada')).toBeVisible({ timeout: 30_000 });
      await anonimo.reload({ waitUntil: 'domcontentloaded' });
      await expect(anonimo.getByText(NUEVO_NOMBRE).first()).toBeVisible({ timeout: 30_000 });
      await anonimo.context().close();
    });

    await test.step('el lutier retira su taller del ecosistema, con motivo, y deja de verse', async () => {
      await lutier.goto('/gestion/cuenta/talleres', { waitUntil: 'domcontentloaded' });
      await lutier.locator('[data-proceso-tipo="luteria"]').filter({ hasText: TALLER_INDEPENDIENTE }).first().click();
      await lutier.locator('[data-testid="retirar-taller"]').click();
      await confirmar(lutier, 'Cierro el taller por traslado.');
      await expect(lutier.locator('[data-testid="aviso-del-taller"]')).toContainText('se retiró del ecosistema', { timeout: 30_000 });

      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/luteria', { waitUntil: 'domcontentloaded' });
      // El directorio estándar ya no tiene un contador propio: la carga terminó cuando aparece el resumen de resultados («Mostrando 1–N de N») o el estado vacío.
      await expect(anonimo.getByText(/Mostrando \d+\S+\d+ de \d+|Todavía no hay talleres|Ningún taller coincide/).first()).toBeVisible({ timeout: 30_000 });
      await expect(anonimo.getByText(TALLER_INDEPENDIENTE)).toHaveCount(0);
      await anonimo.context().close();
    });
  });

  test('una organización registra su taller, el PNMC pide ajustes con motivo y ella los atiende', { tag: '@backend' }, async ({ browser }) => {
    const organizacion = await sesionExterna(browser, ORGANIZACION);
    const consola = await sesionDeConsola(browser);
    const MOTIVO = 'Precisa en qué barrio queda el taller y qué instrumentos repara.';

    await test.step('la organización lo registra desde su panel y lo envía', async () => {
      await organizacion.goto('/gestion/procesos/luteria/nuevo', { waitUntil: 'domcontentloaded' });
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/procesos\/luteria\/nuevo$/);
      await diligenciar(organizacion, TALLER_DE_ORGANIZACION);
      await organizacion.locator('[data-testid="guardar-taller"]').click();
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/procesos\/luteria\/\d+(\?.*)?$/, { timeout: 30_000 });
      await organizacion.locator('[data-testid="enviar-taller"]').click();
      await confirmar(organizacion);
      await expect(organizacion.locator('[data-testid="aviso-del-taller"]')).toContainText('quedó en revisión', { timeout: 30_000 });
    });

    await test.step('el PNMC pide ajustes y el motivo es obligatorio', async () => {
      await consola.goto('/administracion/procesos?tipo=luteria', { waitUntil: 'domcontentloaded' });
      await consola.locator('[data-testid="buscar-proceso"]').fill(TALLER_DE_ORGANIZACION);
      await consola.keyboard.press('Enter');
      const fila = consola.locator('[data-testid="fila-de-proceso-consola"]').filter({ hasText: TALLER_DE_ORGANIZACION });
      await expect(fila).toBeVisible({ timeout: 30_000 });
      await fila.getByRole('button', { name: TALLER_DE_ORGANIZACION }).click();
      await consola.locator('[data-testid="pedir-ajustes-taller"]').click();
      await expect(dialogoComun(consola)).toContainText('Pedir ajustes');
      // Sin motivo no se puede confirmar.
      await expect(consola.locator('[data-testid="confirmacion-comun-aceptar"]')).toBeDisabled();
      await dialogoComun(consola).locator('textarea').fill(MOTIVO);
      await consola.locator('[data-testid="confirmacion-comun-aceptar"]').click();
      await expect(consola.locator('[data-testid="aviso-de-decision"]')).toContainText('Se pidieron ajustes', { timeout: 30_000 });
    });

    await test.step('la organización ve el motivo, corrige y reenvía', async () => {
      await organizacion.reload({ waitUntil: 'domcontentloaded' });
      await expect(organizacion.locator('[data-testid="ajustes-del-taller"]')).toContainText(MOTIVO, { timeout: 30_000 });
      await organizacion.locator('#taller-lugar').fill('Barrio Bolívar');
      await organizacion.locator('[data-testid="guardar-taller"]').click();
      await expect(organizacion.locator('[data-testid="aviso-del-taller"]')).toContainText('quedaron guardados', { timeout: 30_000 });
      await organizacion.locator('[data-testid="enviar-taller"]').click();
      await expect(dialogoComun(organizacion)).toContainText('Enviar a revisión');
      await confirmar(organizacion);
      await expect(organizacion.locator('[data-testid="aviso-del-taller"]')).toContainText('quedó en revisión', { timeout: 30_000 });
    });
  });
});
