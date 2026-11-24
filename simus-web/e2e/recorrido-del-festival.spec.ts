import { test, expect, Browser, Page } from '@playwright/test';
import { abrirFichaDelFestival, crearFestivalConElAsistente, sesionDeOrganizacion } from './apoyo/organizacion';

/**
 * Recorridos D3 y D4 del MVP: un Festival va de la organización al mapa público.
 *
 *   1. La organización lo registra con el asistente de /gestion y lo envía a revisión.
 *   2. El funcionario, desde Solicitudes, pide un ajuste en un campo concreto.
 *   3. La organización ve el ajuste junto a ese campo, lo corrige y lo reenvía.
 *   4. El funcionario lo publica y el Festival aparece en el directorio público.
 *
 * <b>POR QUE EXISTE.</b> Las pruebas de la API cubren cada paso, pero no la pantalla: el 4 de
 * noviembre de 2026 el asistente fallaba al guardar con «la ruta solicitada no existe» porque la
 * cuenta de demostración no respondía por ninguna organización, y ninguna prueba lo vio.
 *
 * Requiere el entorno local con la base de demostración (`scripts/demo/reconstruir-demo-local.sh`), el
 * frontend en 4300 y la API en 8180. Escribe un Festival nuevo en cada ejecución.
 */

const FUNCIONARIO = {
  email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test',
  password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin',
};

const NOMBRE = `Festival de recorrido ${new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14)}`;
const NOTA = 'Describe el Festival con más detalle: público, programación y fechas.';
const DESCRIPCION_CORREGIDA =
  'Encuentro anual de bandas y chirimías con conciertos en plaza, talleres y una muestra de luthiers.';

test.describe('D3–D4: el Festival de una organización llega al directorio público', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('registrar, ajustar, corregir y publicar', { tag: '@backend' }, async ({ browser }) => {
    const organizacion = await sesionDeOrganizacion(browser);
    const funcionario = await sesionDeFuncionario(browser);

    await test.step('la organización registra el Festival con el asistente', async () => {
      await crearFestivalConElAsistente(organizacion, NOMBRE);
    });

    await test.step('la organización lo envía a revisión', async () => {
      await abrirFichaDelFestival(organizacion, NOMBRE);
      await organizacion.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
      // L6: enviar a revisión pregunta antes, en el diálogo de confirmación común.
      await organizacion.locator('[data-testid="confirmacion-comun-aceptar"]').click();
      await expect(organizacion.getByText(/Estado\s*En revisión/i)).toBeVisible({ timeout: 30_000 });
    });

    await test.step('el funcionario pide un ajuste en la descripción', async () => {
      await abrirEnSolicitudes(funcionario);
      await funcionario.locator('[data-testid="pedir-cambio-festival.descripcion"]').click();
      await funcionario.locator('[data-testid="caja-nota-festival.descripcion"]').fill(NOTA);
      await funcionario.getByRole('button', { name: 'Guardar sugerencia' }).click();
      await expect(funcionario.locator('[data-testid="ficha-recuento-ajustes"]')).toContainText('de 1');
      await funcionario.getByRole('button', { name: 'Enviar sugerencias de ajuste' }).click();
      await funcionario.locator('[data-testid="revision-confirmar-accion"]').click();
      await expect(funcionario.getByText(NOMBRE)).toHaveCount(0, { timeout: 30_000 });
    });

    await test.step('la organización ve el ajuste junto al campo, lo corrige y lo reenvía', async () => {
      await abrirFichaDelFestival(organizacion, NOMBRE);
      await expect(organizacion.getByText(/Ajustes solicitados/).first()).toBeVisible({ timeout: 30_000 });
      await organizacion.getByRole('button', { name: 'Atender ajustes', exact: true }).click();
      // El campo señalado lleva un indicador; al pulsarlo se lee la nota del funcionario.
      await organizacion.getByRole('button', { name: 'Revisar ajuste sugerido para Descripción del festival' }).click();
      await expect(organizacion.getByText(NOTA)).toBeVisible();
      // La corrección se hace desde la propia nota: así el ajuste queda atendido.
      await organizacion.getByRole('button', { name: 'Editar este campo' }).click();
      await organizacion.locator('[name="descripcionFestival"]').fill(DESCRIPCION_CORREGIDA);
      await organizacion.getByRole('button', { name: 'Guardar ajuste' }).click();
      // Cuando el ajuste queda guardado aparece el reenvío; antes, navegar cortaría el guardado.
      await expect(organizacion.getByRole('button', { name: 'Volver a enviar a revisión' })).toBeVisible({ timeout: 30_000 });
      await abrirFichaDelFestival(organizacion, NOMBRE);
      const resueltos = organizacion.getByRole('region', { name: 'Los ajustes están resueltos.' });
      await resueltos.getByRole('button', { name: 'Volver a enviar a revisión' }).click();
      await organizacion.locator('[data-testid="confirmacion-comun-aceptar"]').click();
      await expect(organizacion.getByText(/Estado\s*En revisión/i)).toBeVisible({ timeout: 30_000 });
    });

    await test.step('el funcionario lo publica', async () => {
      await abrirEnSolicitudes(funcionario);
      await funcionario.getByRole('button', { name: 'Publicar Festival' }).click();
      await funcionario.locator('[data-testid="revision-confirmar-accion"]').click();
      await expect(funcionario.getByText(NOMBRE)).toHaveCount(0, { timeout: 30_000 });
    });

    await test.step('aparece publicado, con la descripción corregida, y se encuentra en el mapa', async () => {
      const id = await abrirFichaDelFestival(organizacion, NOMBRE);
      const respuesta = await organizacion.request.get(`/api/v1/publico/festivales/${id}`);
      expect(respuesta.status(), 'la ficha pública del Festival publicado').toBe(200);
      const ficha = JSON.stringify(await respuesta.json());
      expect(ficha).toContain(NOMBRE);
      expect(ficha).toContain(DESCRIPCION_CORREGIDA.slice(0, 40));

      const visitante = await (await browser.newContext()).newPage();
      await visitante.addInitScript(() =>
        window.localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().slice(0, 10)));
      await visitante.goto('/mapa-ecosistemico', { waitUntil: 'domcontentloaded' });
      await visitante.locator('#mapa-buscar').fill(NOMBRE);
      await expect(visitante.getByText(NOMBRE).first()).toBeVisible({ timeout: 30_000 });
    });
  });
});

// ─────────────────────────────── Apoyos ───────────────────────────────


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



async function abrirEnSolicitudes(page: Page): Promise<void> {
  await page.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
  await page.getByText(NOMBRE).first().click();
  await page.getByRole('button', { name: 'Ver la ficha completa' }).click();
  await expect(page.locator('[data-testid="ficha-festival-incrustada"]')).toBeVisible();
}
