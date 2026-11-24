import { test, expect, Browser, Page } from '@playwright/test';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * El espacio para música en vivo, de punta a punta (docs/referencia/25-modulos-restantes.md).
 *
 *   1. Una PERSONA RESPONSABLE INDEPENDIENTE (cuenta individual, sin organización) registra su espacio desde su
 *      cuenta, lo envía a revisión, el Programa lo publica y se ve en el directorio público, en su
 *      ficha y —al mirar el portal sin sesión— sin el nombre de la persona.
 *   2. Una ORGANIZACIÓN registra su espacio; el Programa pide ajustes con un motivo; la organización lo
 *      ve, lo corrige y lo reenvía.
 *
 * Requiere la base de demostración completa (`scripts/demo/sembrar-demo.sh completa`, que incluye los
 * espacios), el frontend y la API en marcha. Escribe espacios nuevos en cada ejecución.
 */

const CLAVE = process.env.SIMUS_EXTERNO_PASSWORD ?? process.env.PNMC_EXTERNO_PASSWORD ?? 'admin';
const RESPONSABLE = { email: 'valentina.ocampo@correo.test', password: CLAVE };
const ORGANIZACION = { email: 'lucia.ramirez@cantaclaro.test', password: CLAVE };
const FUNCIONARIO = {
  email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test',
  password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin',
};

const SUFIJO = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const ESPACIO_INDEPENDIENTE = `Café de Cuatros ${SUFIJO}`;
const ESPACIO_DE_ORGANIZACION = `Sala de Violines ${SUFIJO}`;

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

/** Diligencia el formulario del espacio con lo mínimo para poder enviarlo a revisión. */
async function diligenciar(page: Page, nombre: string): Promise<void> {
  await page.locator('#espacio-nombre').fill(nombre);
  await page.locator('#espacio-descripcion').fill('Sala pequeña con música en vivo de cuerdas tradicionales, de jueves a sábado.');
  await page.locator('#espacio-aforo').fill('60');

  // El primer tipo de espacio que ofrezca el catálogo propuesto (obligatorio) y el primer equipamiento (opcional).
  await page.locator('input[name^="tipo-"]').first().check();
  await page.locator('input[name^="equipamiento-"]').first().check();

  await elegirEnDesplegable(page.locator('#espacio-departamento'), { indice: 1 });
  await elegirEnDesplegable(page.locator('#espacio-municipio'), { indice: 1 });
  await page.locator('#espacio-lugar').fill('Calle 10 # 5-20, centro');
  await page.locator('#espacio-correo').fill('espacio@ejemplo.org');
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

test.describe('Espacios para música en vivo: el espacio de punta a punta', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('un responsable independiente registra su espacio, el PNMC lo publica y el portal lo muestra', { tag: '@backend' }, async ({ browser }) => {
    const responsable = await sesionExterna(browser, RESPONSABLE);
    const consola = await sesionDeConsola(browser);

    await test.step('lo registra desde su espacio, sin organización', async () => {
      await responsable.goto('/gestion/cuenta/espacios', { waitUntil: 'domcontentloaded' });
      await expect(responsable.getByRole('heading', { name: 'Procesos', level: 1 })).toBeVisible();
      // (PANEL) La lista de Mi espacio es la de procesos, con pestañas por tipo: se registra desde su menú.
      await responsable.getByRole('button', { name: 'Registrar proceso' }).click();
      await responsable.locator('[data-menu-registrar-espacio]').click();
      await expect(responsable).toHaveURL(/\/gestion\/cuenta\/espacios\/nuevo$/);
      await diligenciar(responsable, ESPACIO_INDEPENDIENTE);
      await responsable.locator('[data-testid="guardar-espacio"]').click();
      // Guardado como borrador, la ficha del espacio nuevo se abre sola.
      await expect(responsable).toHaveURL(/\/gestion\/cuenta\/espacios\/\d+(\?.*)?$/, { timeout: 30_000 });
      await expect(responsable.getByText('Borrador').first()).toBeVisible();
    });

    await test.step('lo envía a revisión, con confirmación, y deja de ser editable', async () => {
      await responsable.locator('[data-testid="enviar-espacio"]').click();
      await expect(dialogoComun(responsable)).toContainText('Enviar a revisión');
      await confirmar(responsable);
      await expect(responsable.locator('[data-testid="aviso-del-espacio"]')).toContainText('quedó en revisión', { timeout: 30_000 });
      await expect(responsable.locator('[data-testid="guardar-espacio"]')).toHaveCount(0);
      await expect(responsable.locator('[data-testid="retirar-de-revision"]')).toBeVisible();
    });

    await test.step('antes de publicarse, el portal no lo muestra', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/espacios', { waitUntil: 'domcontentloaded' });
      // El directorio estándar ya no tiene un contador propio: la carga terminó cuando aparece el resumen de resultados («Mostrando 1–N de N») o el estado vacío.
      await expect(anonimo.getByText(/Mostrando \d+\S+\d+ de \d+|Todavía no hay espacios|Ningún espacio coincide/).first()).toBeVisible({ timeout: 30_000 });
      await expect(anonimo.getByText(ESPACIO_INDEPENDIENTE)).toHaveCount(0);
      await anonimo.context().close();
    });

    await test.step('el PNMC lo revisa en la consola y lo publica', async () => {
      await consola.goto('/administracion/procesos?tipo=espacios', { waitUntil: 'domcontentloaded' });
      await consola.locator('[data-testid="buscar-proceso"]').fill(ESPACIO_INDEPENDIENTE);
      await consola.keyboard.press('Enter');
      const fila = consola.locator('[data-testid="fila-de-proceso-consola"]').filter({ hasText: ESPACIO_INDEPENDIENTE });
      await expect(fila).toBeVisible({ timeout: 30_000 });
      // Un responsable independiente se nombra así en la consola.
      await expect(fila).toContainText('(independiente)');
      await fila.getByRole('button', { name: ESPACIO_INDEPENDIENTE }).click();
      await expect(consola).toHaveURL(/\/administracion\/espacios\/\d+(\?.*)?$/);
      await consola.locator('[data-testid="publicar-espacio"]').click();
      await confirmar(consola);
      await expect(consola.locator('[data-testid="aviso-de-decision"]')).toContainText('quedó publicado', { timeout: 30_000 });
    });

    await test.step('el portal lo muestra en el directorio y en su ficha, sin el nombre de la persona', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/espacios', { waitUntil: 'domcontentloaded' });
      const tarjeta = anonimo.locator('[data-testid="tarjeta-de-espacio"]').filter({ hasText: ESPACIO_INDEPENDIENTE });
      await expect(tarjeta).toBeVisible({ timeout: 30_000 });
      // En el directorio estándar la tarjeta no es un enlace: se abre con su botón «Ver ficha».
      await tarjeta.locator('[data-abrir-registro]').click();
      await expect(anonimo).toHaveURL(/\/ecosistema\/espacios\/\d+(\?.*)?$/);
      await expect(anonimo.getByRole('heading', { name: ESPACIO_INDEPENDIENTE }).first()).toBeVisible();
      await expect(anonimo.getByText('Responsable independiente')).toBeVisible();
      await expect(anonimo.getByText('Valentina Ocampo')).toHaveCount(0);
      await anonimo.context().close();
    });

    await test.step('el mapa tiene la capa «Espacios» y, al elegirla, lista el espacio publicado', async () => {
      const anonimo = await (await browser.newContext()).newPage();
      // LA PRIMERA VISITA ABRE EL TUTORIAL Y SU VELO TAPA LAS CAPAS. Se marca como ya visto antes de
      // entrar, en vez de pulsar «Escape» con el mapa a medio cargar, que llegaba antes de que se abriera.
      await anonimo.addInitScript(() => window.localStorage.setItem('pnmc_last_tutorial_date', '2026-01-01'));
      await anonimo.goto('/mapa-ecosistemico', { waitUntil: 'domcontentloaded' });
      const capa = anonimo.getByRole('button', { name: /Espacios/ }).first();
      await expect(capa).toBeVisible({ timeout: 30_000 });
      await capa.click();
      await expect(anonimo.getByText(ESPACIO_INDEPENDIENTE).first()).toBeVisible({ timeout: 30_000 });
      await anonimo.context().close();
    });

    await test.step('el responsable retira su espacio del ecosistema, con motivo, y deja de verse', async () => {
      await responsable.goto('/gestion/cuenta/espacios', { waitUntil: 'domcontentloaded' });
      await responsable.locator('[data-proceso-tipo="espacios"]').filter({ hasText: ESPACIO_INDEPENDIENTE }).click();
      await responsable.locator('[data-testid="retirar-espacio"]').click();
      await confirmar(responsable, 'Cierro el espacio por traslado.');
      await expect(responsable.locator('[data-testid="aviso-del-espacio"]')).toContainText('se retiró del ecosistema', { timeout: 30_000 });

      const anonimo = await (await browser.newContext()).newPage();
      await anonimo.goto('/ecosistema/espacios', { waitUntil: 'domcontentloaded' });
      // El directorio estándar ya no tiene un contador propio: la carga terminó cuando aparece el resumen de resultados («Mostrando 1–N de N») o el estado vacío.
      await expect(anonimo.getByText(/Mostrando \d+\S+\d+ de \d+|Todavía no hay espacios|Ningún espacio coincide/).first()).toBeVisible({ timeout: 30_000 });
      await expect(anonimo.getByText(ESPACIO_INDEPENDIENTE)).toHaveCount(0);
      await anonimo.context().close();
    });
  });

  test('una organización registra su espacio, el PNMC pide ajustes con motivo y ella los atiende', { tag: '@backend' }, async ({ browser }) => {
    const organizacion = await sesionExterna(browser, ORGANIZACION);
    const consola = await sesionDeConsola(browser);
    const MOTIVO = 'Precisa en qué barrio queda el espacio y cuántas personas caben.';

    await test.step('la organización lo registra desde su panel y lo envía', async () => {
      await organizacion.goto('/gestion/procesos/espacios/nuevo', { waitUntil: 'domcontentloaded' });
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/procesos\/espacios\/nuevo$/);
      await diligenciar(organizacion, ESPACIO_DE_ORGANIZACION);
      await organizacion.locator('[data-testid="guardar-espacio"]').click();
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/procesos\/espacios\/\d+(\?.*)?$/, { timeout: 30_000 });
      await organizacion.locator('[data-testid="enviar-espacio"]').click();
      await confirmar(organizacion);
      await expect(organizacion.locator('[data-testid="aviso-del-espacio"]')).toContainText('quedó en revisión', { timeout: 30_000 });
    });

    await test.step('el PNMC pide ajustes y el motivo es obligatorio', async () => {
      await consola.goto('/administracion/procesos?tipo=espacios', { waitUntil: 'domcontentloaded' });
      await consola.locator('[data-testid="buscar-proceso"]').fill(ESPACIO_DE_ORGANIZACION);
      await consola.keyboard.press('Enter');
      const fila = consola.locator('[data-testid="fila-de-proceso-consola"]').filter({ hasText: ESPACIO_DE_ORGANIZACION });
      await expect(fila).toBeVisible({ timeout: 30_000 });
      await fila.getByRole('button', { name: ESPACIO_DE_ORGANIZACION }).click();
      await consola.locator('[data-testid="pedir-ajustes-espacio"]').click();
      await expect(dialogoComun(consola)).toContainText('Pedir ajustes');
      // Sin motivo no se puede confirmar.
      await expect(consola.locator('[data-testid="confirmacion-comun-aceptar"]')).toBeDisabled();
      await dialogoComun(consola).locator('textarea').fill(MOTIVO);
      await consola.locator('[data-testid="confirmacion-comun-aceptar"]').click();
      await expect(consola.locator('[data-testid="aviso-de-decision"]')).toContainText('Se pidieron ajustes', { timeout: 30_000 });
    });

    await test.step('la organización ve el motivo, corrige y reenvía', async () => {
      await organizacion.reload({ waitUntil: 'domcontentloaded' });
      await expect(organizacion.locator('[data-testid="ajustes-del-espacio"]')).toContainText(MOTIVO, { timeout: 30_000 });
      await organizacion.locator('#espacio-lugar').fill('Barrio Bolívar, carrera 6 # 5-22');
      await organizacion.locator('[data-testid="guardar-espacio"]').click();
      await expect(organizacion.locator('[data-testid="aviso-del-espacio"]')).toContainText('quedaron guardados', { timeout: 30_000 });
      await organizacion.locator('[data-testid="enviar-espacio"]').click();
      await expect(dialogoComun(organizacion)).toContainText('Enviar a revisión');
      await confirmar(organizacion);
      await expect(organizacion.locator('[data-testid="aviso-del-espacio"]')).toContainText('quedó en revisión', { timeout: 30_000 });
    });
  });
});
