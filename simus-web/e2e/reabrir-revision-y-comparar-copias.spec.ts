import { test, expect, Browser, Page } from '@playwright/test';
import { ORGANIZACION, abrirFichaDelFestival, crearFestivalConElAsistente, sesionDeOrganizacion } from './apoyo/organizacion';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * T2: reabrir la revisión de un Festival rechazado y comparar dos copias antes de fusionar.
 *
 * <b>REABRIR.</b> «Rechazado» no tenía salida desde la consola. Aquí una organización envía su
 * Festival, quien revisa lo rechaza, y desde la ficha de la consola lo devuelve a «en revisión» con un
 * motivo que queda en el historial y vuelve a la bandeja.
 *
 * <b>COMPARAR.</b> Antes de fusionar dos copias del mismo histórico, el diálogo las muestra lado a lado
 * —qué se queda, qué se completa, qué se traslada— y exige confirmar lo que no se deshace.
 *
 * Requiere el entorno local con la base de demostración (`scripts/demo/reconstruir-demo-local.sh`), el
 * frontend y la API. Crea Festivales nuevos en cada ejecución.
 */

const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin' };
const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);

test.describe('T2: reabrir una revisión y comparar dos copias', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('un Festival rechazado vuelve a revisión desde la ficha de la consola, con motivo', { tag: '@backend' }, async ({ browser }) => {
    const nombre = `Festival de la Chirimía ${MARCA}`;
    const festivalId = await test.step('la organización envía su Festival a revisión', async () => {
      const organizacion = await sesionDeOrganizacion(browser);
      await crearFestivalConElAsistente(organizacion, nombre, 'Festival sembrado para reabrir su revisión.');
      const id = await abrirFichaDelFestival(organizacion, nombre);
      const testigo = (await (await organizacion.request.get('/api/v1/externo/organizaciones/csrf')).json()).requestToken as string;
      const envio = await organizacion.request.post(`/api/v1/externo/festivales/${id}/enviar-a-revision`, { headers: { 'X-CSRF-TOKEN': testigo }, data: {} });
      expect(envio.status(), await envio.text()).toBe(200);
      await organizacion.context().close();
      return id;
    });

    const webmaster = await sesionDeConsola(browser, WEBMASTER);
    await test.step('quien revisa lo rechaza, con su motivo', async () => {
      const testigo = (await (await webmaster.request.get('/api/v1/institucional/festivales/csrf')).json()).requestToken as string;
      const rechazo = await webmaster.request.post(`/api/v1/institucional/festivales/${festivalId}/decisiones`, {
        headers: { 'X-CSRF-TOKEN': testigo }, data: { accion: 'Rechazar', motivoRechazo: 'No se pudo comprobar el municipio.' },
      });
      expect(rechazo.status(), await rechazo.text()).toBe(200);
    });

    await test.step('la ficha de la consola dice que fue rechazado y ofrece reabrir la revisión', async () => {
      await webmaster.goto(`/administracion/festivales/${festivalId}`, { waitUntil: 'domcontentloaded' });
      const aviso = webmaster.getByTestId('festival-rechazado');
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await expect(aviso).toContainText('rechazado');
      await aviso.getByRole('button', { name: 'Reabrir revisión' }).click();

      const dialogo = webmaster.getByRole('dialog', { name: `Reabrir la revisión de «${nombre}»` });
      await expect(dialogo).toBeVisible();
      // SIN MOTIVO NO SE PUEDE CONFIRMAR.
      await expect(dialogo.getByRole('button', { name: 'Reabrir revisión' })).toBeDisabled();
      await dialogo.getByLabel('Por qué se reabre').fill('La organización aportó el acta que acredita el municipio.');
      await dialogo.getByRole('button', { name: 'Reabrir revisión' }).click();

      await expect(webmaster.getByText('La revisión se reabrió')).toBeVisible({ timeout: 30_000 });
      await expect(webmaster.getByTestId('reabrir-revision')).toHaveCount(0);
    });

    await test.step('el Festival vuelve a la bandeja y el historial cuenta por qué', async () => {
      const bandeja = await (await webmaster.request.get('/api/v1/institucional/festivales/en-revision')).json() as { id: string }[];
      expect(bandeja.map(x => x.id)).toContain(festivalId);

      const historial = await (await webmaster.request.get(`/api/v1/institucional/festivales/${festivalId}/historial`)).json() as
        { accion: string; estadoAnterior: string; estadoNuevo: string; motivo: string | null }[];
      const entrada = historial.find(x => x.accion === 'FestivalRevisionReabierta');
      expect(entrada, 'el historial debe registrar la reapertura').toBeTruthy();
      expect(entrada!.estadoAnterior).toBe('rechazado');
      expect(entrada!.estadoNuevo).toBe('en_revision');
      expect(entrada!.motivo).toBe('La organización aportó el acta que acredita el municipio.');
    });

    await test.step('la organización recibe el aviso con el motivo', async () => {
      const organizacion = await (await browser.newContext()).newPage();
      expect((await postConCupo(organizacion.request, '/api/v1/externo/auth/login', { data: ORGANIZACION })).status()).toBe(200);
      const avisos = await (await organizacion.request.get('/api/v1/notificaciones?ambito=externo&limite=100')).json();
      const texto = JSON.stringify(avisos);
      expect(texto).toContain('Revisión de tu Festival reabierta');
      expect(texto).toContain('La organización aportó el acta que acredita el municipio.');
      await organizacion.context().close();
    });
    await webmaster.context().close();
  });

  test('la comparación enseña las dos copias lado a lado y la fusión pide confirmar', { tag: '@backend' }, async ({ browser }) => {
    const nombre = `Festival Histórico de la Bandola ${MARCA}`;
    const [conservado, copia] = await test.step('el administrador del sistema carga el histórico dos veces', async () =>
      cargarHistoricos(browser, nombre));

    const webmaster = await sesionDeConsola(browser, WEBMASTER);
    await webmaster.goto(`/administracion/festivales/${conservado}`, { waitUntil: 'domcontentloaded' });
    await webmaster.getByTestId('fusionar-festival').click();
    const dialogo = webmaster.getByRole('dialog', { name: 'Fusionar con otra copia' });
    await dialogo.getByLabel(new RegExp(`n\\.º ${copia}`)).check();
    await dialogo.getByLabel('Por qué son el mismo Festival').fill('Las dos cargas describen la misma bandola.');

    await test.step('aparece la comparación con lo que se completa y lo que se conserva', async () => {
      const comparacion = dialogo.getByTestId('comparacion-de-copias');
      await expect(comparacion).toContainText('Así quedaría la fusión', { timeout: 30_000 });
      const tabla = comparacion.getByTestId('tabla-de-comparacion');
      // El correo solo lo tiene la copia: se completa. La descripción la tienen las dos: se queda la de este Festival.
      const correo = tabla.getByRole('row', { name: /Correo de contacto/ });
      await expect(correo).toContainText('Se completa con el de la copia');
      await expect(correo).toContainText(`bandola.${MARCA}@historico.test`);
      await expect(tabla.getByRole('row', { name: /Descripción/ })).toContainText('Se queda el de este Festival');
      await expect(comparacion.getByTestId('traslado-de-la-fusion')).toBeVisible();
    });

    await test.step('no se fusiona sin confirmar lo que no se deshace', async () => {
      const fusionar = dialogo.getByRole('button', { name: 'Fusionar', exact: true });
      await expect(fusionar).toBeDisabled();
      await dialogo.getByLabel(/Entiendo que/).check();
      await expect(fusionar).toBeEnabled();
      await fusionar.click();
      await expect(webmaster.getByText('quedó fusionado en este Festival y archivado')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('lo anunciado es lo que pasó: este Festival tiene ahora el correo de la copia', async () => {
      const ficha = await (await webmaster.request.get(`/api/v1/admin/festivales/${conservado}`)).json() as { correoContacto?: string | null };
      expect(ficha.correoContacto).toBe(`bandola.${MARCA}@historico.test`);
    });
    await webmaster.context().close();
  });
});

// ─────────────────────────────── Apoyos ───────────────────────────────

/** Carga el mismo histórico dos veces: la segunda copia trae el correo que la primera no tiene. */
async function cargarHistoricos(browser: Browser, nombre: string): Promise<[string, string]> {
  const page = await (await browser.newContext()).newPage();
  const entrada = await postConCupo(page.request, '/api/v1/admin/auth/login', { data: WEBMASTER });
  expect(entrada.status(), 'la cuenta webmaster de demostración tiene que poder entrar').toBe(200);
  const testigo = (await (await page.request.get('/api/v1/admin/csrf')).json()).requestToken as string;
  const ids: string[] = [];
  for (const [descripcion, correo] of [['Registro histórico de la bandola.', null], ['Registro histórico de la bandola (segunda fuente).', `bandola.${MARCA}@historico.test`]] as const) {
    const alta = await page.request.post('/api/v1/admin/festivales', {
      headers: { 'X-CSRF-TOKEN': testigo },
      data: {
        festival: {
          nombre, descripcion, correoContacto: correo, nivelCobertura: 'municipal',
          codigoDepartamento: '41', codigoMunicipio: '41001', periodicidad: 'anual',
          practicasMusicalesIds: [], territoriosSonorosIds: [],
        },
        organizacionResponsableId: null,
      },
    });
    expect(alta.status(), await alta.text()).toBe(201);
    ids.push((await alta.json()).id as string);
  }
  await page.context().close();
  return [ids[0], ids[1]];
}

async function sesionDeConsola(browser: Browser, cuenta: { email: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), cuenta.email);
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(cuenta.email);
  await page.locator('input[type="password"]').fill(cuenta.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}
