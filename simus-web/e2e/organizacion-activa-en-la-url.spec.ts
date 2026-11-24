import { test, expect, Page } from '@playwright/test';
import { elegirEnDesplegable, esDesplegable } from './apoyo/desplegable';
import { crearFestivalConElAsistente } from './apoyo/organizacion';

/**
 * La organización activa vive en la URL, con dos organizaciones de la misma
 * cuenta.
 *
 *   1. Una cuenta registra «Caribe» por /registro y, desde su espacio personal, «Pacífico»: llega
 * al panel de la nueva con la confirmación de que la administra.
 *   2. Cambiar a mitad del asistente de Festival PREGUNTA; quedarse no cambia nada, y confirmar
 *      deja lo escrito como borrador de Caribe: nada aparece en Pacífico (lo que encontró la
 *      auditoría: el Festival escrito para Caribe se guardaba en Pacífico).
 *   3. Recargar conserva la organización; la cabecera dice la misma que el panel.
 *   4. Un enlace profundo a un Festival de Caribe abierto desde Pacífico —o con la dirección
 *      antigua sin organización— abre Caribe con un aviso; una organización ajena se dice.
 * 5. Sin sesión, la página pedida sobrevive al ingreso.
 *
 * <b>POR QUÉ EXISTE.</b> Es el único hallazgo crítico de integridad de datos de la revisión de interfaz, y se
 * verificó en navegador: solo un navegador lo da por resuelto.
 *
 * Requiere el entorno local con la base de demostración (`scripts/demo/reconstruir-demo-local.sh`), el
 * frontend y la API (con la confirmación de correo dispensada, como en modo demo). Crea una cuenta
 * y dos organizaciones nuevas en cada ejecución.
 */

const MARCA = `${Date.now()}`.slice(-9);
const CUENTA = { email: `l2.${MARCA}@ejemplo.test`, password: 'Clave-Segura-2026' };
const CARIBE = `Corporación Caribe ${MARCA}`;
const PACIFICO = `Corporación Pacífico ${MARCA}`;
const FESTIVAL_A_MEDIAS = `Festival a medias ${MARCA}`;
const FESTIVAL_DE_CARIBE = `Festival del Caribe ${MARCA}`;

async function ingresar(page: Page): Promise<void> {
  await page.fill('#acceso-correo', CUENTA.email);
  await page.fill('#acceso-contrasena', CUENTA.password);
  await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
}

async function elegirOrganizacion(page: Page, nombre: string): Promise<void> {
  await page.locator('#selector-organizacion').selectOption({ label: nombre });
}

async function borradorDe(page: Page, organizacionId: string): Promise<string> {
  const respuesta = await page.request.get(`/api/v1/externo/organizaciones/${organizacionId}/festivales/borrador`);
  expect(respuesta.ok(), await respuesta.text()).toBeTruthy();
  return ((await respuesta.json()) as { datosJson: string }).datosJson ?? '';
}

async function festivalesDe(page: Page, organizacionId: string): Promise<{ id: string; nombre: string }[]> {
  const respuesta = await page.request.get(`/api/v1/externo/organizaciones/${organizacionId}/festivales`);
  expect(respuesta.ok(), await respuesta.text()).toBeTruthy();
  return respuesta.json();
}

test.describe('la organización activa vive en la URL', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('dos organizaciones, cambio a mitad del asistente, recarga y enlaces profundos', { tag: '@backend' }, async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    let caribe = '';
    let pacifico = '';

    await test.step('la cuenta se registra con «Caribe» y entra a su panel', async () => {
      const preparacion = await (await page.request.get('/api/v1/externo/auth/register-preparation')).json() as { politicas?: { clave: string }[] };
      const alta = await page.request.post('/api/v1/externo/auth/register', {
        data: {
          registrationType: 'organizacion',
          organizationName: CARIBE,
          headquartersDepartmentCode: '41',
          headquartersMunicipalityCode: '41001',
          firstName: 'Ana', firstSurname: 'Restrepo', documentType: 'cc', documentNumber: `7${MARCA}`,
          phone: '3001234567', email: CUENTA.email, password: CUENTA.password,
          politicasAceptadas: (preparacion.politicas ?? []).map(politica => politica.clave),
        },
      });
      expect(alta.ok(), `el registro tiene que aceptar la cuenta: ${await alta.text()}`).toBeTruthy();

      await page.goto('/ingresar', { waitUntil: 'domcontentloaded' });
      await ingresar(page);
      // ACC2: tras iniciar sesión se pregunta «¿Cómo quieres entrar?»; aquí se entra a la organización.
      await expect(page.getByTestId('entrada-a-gestion')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: new RegExp(CARIBE) }).click();
      await expect(page).toHaveURL(/\/gestion\/o\/\d+\/resumen/, { timeout: 30_000 });
      caribe = /\/gestion\/o\/(\d+)\//.exec(page.url())![1];
      await expect(page.getByTestId('nombre-organizacion-activa')).toContainText(CARIBE);
    });

    await test.step('registra «Pacífico» desde su espacio personal y llega a su panel con la confirmación', async () => {
      await page.goto('/gestion/cuenta/organizaciones', { waitUntil: 'domcontentloaded' });
      // El espacio de la persona no es el panel de ninguna organización.
      await expect(page.getByTestId('nombre-de-la-persona')).toContainText('Ana Restrepo', { timeout: 30_000 });
      await expect(page.getByRole('navigation', { name: 'Secciones del panel de la organización' })).toHaveCount(0);
      await page.getByTestId('registrar-organizacion').click();
      await page.fill('#nueva-org-name', PACIFICO);
      // El correo de contacto nace vacío: el personal se rechazaba.
      await expect(page.locator('#nueva-org-contactEmail')).toHaveValue('');
      await page.fill('#nueva-org-contactEmail', `pacifico.${MARCA}@ejemplo.test`);
      // En «Registrar una organización» de Mi espacio el departamento aún es un `<select>` nativo; el municipio, el desplegable estándar.
      const departamento = page.locator('#nueva-org-headquartersDepartmentCode');
      if (await esDesplegable(departamento)) await elegirEnDesplegable(departamento, { etiqueta: 'Huila' });
      else await departamento.selectOption({ label: 'Huila' });
      await elegirEnDesplegable(page.locator('#nueva-org-headquartersMunicipalityCode'), { indice: 1 });
      await page.getByRole('button', { name: 'Registrar la organización' }).click();

      await expect(page).toHaveURL(/\/gestion\/o\/\d+\/resumen\?registrada=1/, { timeout: 30_000 });
      pacifico = /\/gestion\/o\/(\d+)\//.exec(page.url())![1];
      expect(pacifico).not.toBe(caribe);
      await expect(page.getByTestId('bienvenida-organizacion')).toContainText(`Registraste «${PACIFICO}»`);
      // Título y selector de la barra lateral dicen la MISMA organización (antes, tres distintas); la cabecera ya no la repite (UI-E).
      await expect(page.getByTestId('nombre-organizacion-activa')).toContainText(PACIFICO);
      await expect(page.locator('#selector-organizacion')).toHaveValue(pacifico);
    });

    await test.step('el selector lleva a la misma sección de la otra organización', async () => {
      await page.goto(`/gestion/o/${pacifico}/equipo`, { waitUntil: 'domcontentloaded' });
      await elegirOrganizacion(page, CARIBE);
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${caribe}/equipo$`), { timeout: 30_000 });
      await expect(page.getByTestId('nombre-organizacion-activa')).toContainText(CARIBE);
    });

    await test.step('a mitad del asistente de Caribe, cambiar a Pacífico pregunta; quedarse no cambia nada', async () => {
      await page.goto(`/gestion/o/${caribe}/procesos/festivales/nuevo`, { waitUntil: 'domcontentloaded' });
      // El borrador se respalda tras una quietud: se espera a que el servidor lo guarde ANTES de cambiar de organización;
      // si no, a veces el aviso dice «no está guardado» en vez de «se guarda como borrador».
      const borradorGuardado = page.waitForResponse(
        (r) => r.url().includes('/borradores-proceso') && ['POST', 'PUT'].includes(r.request().method()) && r.ok(),
        { timeout: 30_000 },
      );
      await page.fill('#asistente-nombre', FESTIVAL_A_MEDIAS);
      await borradorGuardado;
      await elegirOrganizacion(page, PACIFICO);

      const dialogo = page.getByTestId('confirmar-cambio-de-organizacion');
      await expect(dialogo).toBeVisible({ timeout: 15_000 });
      await expect(dialogo).toContainText(`borrador de «${CARIBE}»`);
      await expect(dialogo).toContainText(`no pasará a «${PACIFICO}»`);
      await page.getByTestId('seguir-en-la-organizacion').click();

      await expect(dialogo).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${caribe}/procesos/festivales/nuevo$`));
      await expect(page.locator('#asistente-nombre')).toHaveValue(FESTIVAL_A_MEDIAS);
      await expect(page.locator('#selector-organizacion')).toHaveValue(caribe);
    });

    await test.step('confirmar el cambio deja lo escrito como borrador de Caribe y NADA pasa a Pacífico', async () => {
      await elegirOrganizacion(page, PACIFICO);
      await page.getByTestId('confirmar-cambio').click();
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${pacifico}/procesos/festivales$`), { timeout: 30_000 });

      // El asistente de Pacífico empieza vacío.
      await page.goto(`/gestion/o/${pacifico}/procesos/festivales/nuevo`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#asistente-nombre')).toHaveValue('', { timeout: 30_000 });

      // En el servidor: el borrador de Caribe tiene lo escrito; ni el borrador ni la lista de
      // Pacífico lo tienen (antes quedaban dos copias, una en cada organización).
      await expect.poll(() => borradorDe(page, caribe), { timeout: 15_000 }).toContain(FESTIVAL_A_MEDIAS);
      expect(await borradorDe(page, pacifico)).not.toContain(FESTIVAL_A_MEDIAS);
      expect((await festivalesDe(page, pacifico)).map(festival => festival.nombre)).not.toContain(FESTIVAL_A_MEDIAS);

      // Y al volver al asistente de Caribe, lo escrito está ahí.
      await page.goto(`/gestion/o/${caribe}/procesos/festivales/nuevo`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#asistente-nombre')).toHaveValue(FESTIVAL_A_MEDIAS, { timeout: 30_000 });
    });

    await test.step('recargar conserva la organización', async () => {
      await page.goto(`/gestion/o/${pacifico}/solicitudes`, { waitUntil: 'domcontentloaded' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${pacifico}/solicitudes$`));
      await expect(page.getByTestId('nombre-organizacion-activa')).toContainText(PACIFICO, { timeout: 30_000 });
      await expect(page.locator('#selector-organizacion')).toHaveValue(pacifico);
    });

    let festivalDeCaribe = '';
    await test.step('Caribe registra un Festival', async () => {
      await crearFestivalConElAsistente(page, FESTIVAL_DE_CARIBE, 'Festival de prueba de L2.', `/gestion/o/${caribe}/procesos/festivales/nuevo`);
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${caribe}/procesos/festivales$`));
      festivalDeCaribe = (await festivalesDe(page, caribe)).find(festival => festival.nombre === FESTIVAL_DE_CARIBE)!.id;
      expect((await festivalesDe(page, pacifico)).map(festival => festival.nombre)).not.toContain(FESTIVAL_DE_CARIBE);
    });

    await test.step('un enlace profundo al Festival de Caribe abierto desde Pacífico abre Caribe, con aviso', async () => {
      await page.goto(`/gestion/o/${pacifico}/procesos/festivales/${festivalDeCaribe}?seccion=informacion`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${caribe}/procesos/festivales/${festivalDeCaribe}\\?seccion=informacion`), { timeout: 30_000 });
      await expect(page.getByTestId('aviso-cambio-de-organizacion')).toContainText(`Este Festival es de «${CARIBE}»`);
      await expect(page.getByText(FESTIVAL_DE_CARIBE).first()).toBeVisible();
    });

    await test.step('la dirección antigua, sin organización, también llega al Festival', async () => {
      // Pacífico es la última abierta: la dirección antigua va a Pacífico y la ficha cambia a Caribe.
      await page.goto(`/gestion/o/${pacifico}/resumen`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('nombre-organizacion-activa')).toContainText(PACIFICO, { timeout: 30_000 });
      await page.goto(`/gestion/procesos/festivales/${festivalDeCaribe}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${caribe}/procesos/festivales/${festivalDeCaribe}`), { timeout: 30_000 });
    });

    await test.step('una organización de la que la cuenta no es miembro se dice con claridad', async () => {
      await page.goto('/gestion/o/1/resumen', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('panel-sin-acceso')).toContainText('No formas parte de esta organización', { timeout: 30_000 });
      await expect(page.getByRole('navigation', { name: 'Secciones del panel de la organización' })).toHaveCount(0);
    });

    await test.step('el menú de cuenta separa a la persona de sus organizaciones y marca la activa', async () => {
      await page.goto(`/gestion/o/${pacifico}/resumen`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-menu-de-cuenta]').click();
      const menu = page.locator('[data-menu-de-cuenta-panel]');
      await expect(menu.getByRole('group', { name: 'Persona' })).toContainText('Mi espacio');
      const organizaciones = menu.getByRole('group', { name: 'Mis organizaciones' });
      await expect(organizaciones).toContainText(CARIBE);
      await expect(organizaciones.locator(`[data-menu-organizacion="${pacifico}"]`)).toHaveAttribute('aria-current', 'true');
      await organizaciones.locator(`[data-menu-organizacion="${caribe}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${caribe}/resumen$`), { timeout: 30_000 });
    });

    await test.step('sin sesión, la página pedida sobrevive al ingreso', async () => {
      const otra = await (await browser.newContext()).newPage();
      await otra.goto(`/gestion/o/${pacifico}/equipo`, { waitUntil: 'domcontentloaded' });
      await expect(otra).toHaveURL(/\/ingresar\?volver=/, { timeout: 30_000 });
      await ingresar(otra);
      await expect(otra).toHaveURL(new RegExp(`/gestion/o/${pacifico}/equipo$`), { timeout: 30_000 });
      await expect(otra.getByTestId('nombre-organizacion-activa')).toContainText(PACIFICO);
    });
  });
});
