import { test, expect, Browser, Page } from '@playwright/test';
import { abrirFichaDelFestival, crearFestivalConElAsistente, sesionDeOrganizacion } from './apoyo/organizacion';

/**
 * (modelo de acciones por estado y diálogo de confirmación común), de punta a punta.
 *
 *   1. Un Festival publicado ofrece «Proponer cambios» DESDE LA FICHA; la propuesta guardada se ve
 * en la Vista general y se ENVÍA desde la ficha, con confirmación.
 *   2. Rechazar una noticia en revisión pide el motivo en el diálogo común y la deja «Rechazada»,
 * no «Archivada».
 *
 * Requiere el entorno local con la base de demostración, el frontend y la API en marcha.
 * Escribe un Festival y una noticia nuevos en cada ejecución.
 */

const FUNCIONARIO = {
  email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test',
  password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin',
};
const WEBMASTER = {
  email: process.env.SIMUS_WEBMASTER_EMAIL ?? process.env.PNMC_WEBMASTER_EMAIL ?? 'webmaster@simus.test',
  password: process.env.SIMUS_WEBMASTER_PASSWORD ?? process.env.PNMC_WEBMASTER_PASSWORD ?? 'admin',
};

const SUFIJO = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const NOMBRE = `Festival de acciones ${SUFIJO}`;
const DESCRIPCION_PROPUESTA = 'Encuentro anual con una programación ampliada: conciertos, talleres y una muestra de luthiers.';

/** Pulsa «Aceptar» en el diálogo de confirmación común. */
async function confirmar(page: Page): Promise<void> {
  await page.locator('[data-testid="confirmacion-comun-aceptar"]').click();
}

async function entrar(browser: Browser, cuenta: { email: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), cuenta.email);
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(cuenta.email);
  await page.locator('input[type="password"]').fill(cuenta.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

test.describe('L6: acciones por estado y confirmación común', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('Festival publicado: proponer cambios y enviar la propuesta desde la ficha', { tag: '@backend' }, async ({ browser }) => {
    const organizacion = await sesionDeOrganizacion(browser);
    const funcionario = await entrar(browser, FUNCIONARIO);

    await test.step('la organización registra el Festival y lo envía, con confirmación', async () => {
      await crearFestivalConElAsistente(organizacion, NOMBRE);
      await abrirFichaDelFestival(organizacion, NOMBRE);
      await organizacion.locator('[data-accion="enviar"]').click();
      // El diálogo común dice qué va a pasar ANTES de enviar.
      await expect(organizacion.getByRole('dialog')).toContainText('Enviar a revisión');
      await confirmar(organizacion);
      await expect(organizacion.getByText(/Estado\s*En revisión/i)).toBeVisible({ timeout: 30_000 });
      // En revisión, la ficha sigue ofreciendo acciones: editar apagado con su motivo.
      await expect(organizacion.locator('[data-siguiente-accion]')).toContainText('La información está siendo revisada.');
    });

    await test.step('el funcionario lo publica', async () => {
      await funcionario.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
      await funcionario.getByText(NOMBRE).first().click();
      await funcionario.getByRole('button', { name: 'Ver la ficha completa' }).click();
      await expect(funcionario.locator('[data-testid="ficha-festival-incrustada"]')).toBeVisible();
      await funcionario.getByRole('button', { name: 'Publicar Festival' }).click();
      await funcionario.locator('[data-testid="revision-confirmar-accion"]').click();
      await expect(funcionario.getByText(NOMBRE)).toHaveCount(0, { timeout: 30_000 });
    });

    await test.step('publicado, la ficha ofrece proponer cambios (antes no ofrecía nada)', async () => {
      await abrirFichaDelFestival(organizacion, NOMBRE);
      const tarjeta = organizacion.locator('[data-siguiente-accion]');
      await expect(tarjeta).toContainText('publicado', { timeout: 30_000 });
      await expect(tarjeta.locator('[data-accion="proponer-cambios"]')).toBeVisible();
      await expect(tarjeta.locator('[data-accion="editar-contacto"]')).toBeVisible();
      await tarjeta.locator('[data-accion="proponer-cambios"]').click();
    });

    await test.step('guarda la propuesta como borrador y la ficha la muestra', async () => {
      await organizacion.locator('[name="descripcionFestival"]').fill(DESCRIPCION_PROPUESTA);
      await organizacion.getByRole('button', { name: /Guardar borrador/ }).click();
      // Se espera al guardado antes de cambiar de sección: navegar a mitad del PUT descartaría el aviso.
      await expect(organizacion.getByText('La propuesta de cambios quedó guardada')).toBeVisible({ timeout: 30_000 });
      await organizacion.getByRole('button', { name: 'Vista general' }).click();
      await expect(organizacion.locator('[data-siguiente-accion]'))
        .toContainText('Tienes una propuesta de cambios sin enviar.', { timeout: 30_000 });
    });

    await test.step('la envía desde la ficha, con confirmación, y la ficha se refresca', async () => {
      await organizacion.locator('[data-accion="enviar-propuesta"]').click();
      await expect(organizacion.getByRole('dialog')).toContainText('Enviar la propuesta a revisión');
      await confirmar(organizacion);
      await expect(organizacion.locator('[data-siguiente-accion]'))
        .toContainText('Tu propuesta de cambios está en revisión.', { timeout: 30_000 });
      // Y mientras está en revisión, proponer otra está apagado con su motivo (no oculto).
      await expect(organizacion.locator('[data-accion="proponer-cambios"]')).toHaveAttribute('aria-disabled', 'true');
      await expect(organizacion.locator('[data-motivo-de-accion]')).toContainText('en revisión');
    });
  });

  test('rechazar una noticia en revisión pide el motivo y la deja «Rechazada»', { tag: '@backend' }, async ({ browser }) => {
    const titulo = `Noticia por rechazar ${SUFIJO}`;
    const consola = await entrar(browser, WEBMASTER);

    await test.step('una noticia queda en revisión', async () => {
      const testigo = await (await consola.request.get('/api/v1/admin/contenido-web/csrf')).json() as { token: string };
      const cabeceras = { 'X-CSRF-TOKEN': testigo.token };
      const hoy = new Date().toISOString().slice(0, 10);
      const creada = await consola.request.post('/api/v1/institucional/noticias', {
        headers: cabeceras,
        data: { titulo, resumen: 'Resumen de la noticia.', cuerpo: 'Cuerpo de la noticia institucional.', fechaPublicacion: hoy },
      });
      expect(creada.status(), await creada.text()).toBe(201);
      const { id } = await creada.json() as { id: number };
      const revision = await consola.request.post(`/api/v1/institucional/noticias/${id}/estado`, { headers: cabeceras, data: { estado: 'en_revision' } });
      expect(revision.status(), await revision.text()).toBe(200);
    });

    await test.step('Rechazar pide el motivo en el diálogo común', async () => {
      await consola.goto('/administracion/noticias', { waitUntil: 'domcontentloaded' });
      const fila = consola.locator('tr, li').filter({ hasText: titulo }).first();
      await expect(fila).toBeVisible({ timeout: 30_000 });
      await fila.locator('[data-disparador-acciones]').click();
      await consola.getByRole('menuitem', { name: 'Rechazar' }).click();
      const dialogo = consola.getByRole('dialog');
      await expect(dialogo).toContainText('Rechazar');
      // Sin motivo no se puede confirmar.
      await expect(consola.locator('[data-testid="confirmacion-comun-aceptar"]')).toBeDisabled();
      await dialogo.locator('textarea').fill('No cumple la línea editorial del PNMC.');
      await consola.locator('[data-testid="confirmacion-comun-aceptar"]').click();
    });

    await test.step('queda «Rechazada» (no «Archivada») y el motivo está en su historial', async () => {
      const fila = consola.locator('tr, li').filter({ hasText: titulo }).first();
      await expect(fila).toContainText('Rechazado', { timeout: 30_000 });
      await expect(fila).not.toContainText('Archivado');
      await fila.locator('[data-disparador-acciones]').click();
      await consola.getByRole('menuitem', { name: 'Historial' }).click();
      await expect(consola.getByRole('dialog')).toContainText('No cumple la línea editorial del PNMC.');
    });
  });
});
