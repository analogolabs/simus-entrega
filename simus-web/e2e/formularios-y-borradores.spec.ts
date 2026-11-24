import { test, expect, Page } from '@playwright/test';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Formularios: validación por paso, errores junto al campo y asistente de Mercado que no pierde lo
 * escrito.
 *
 *   1. REGISTRO CON ERRORES. «Siguiente» con todo vacío NO avanza: dice qué falta junto a cada
 *      campo, pone el foco en el primero y marca el paso incompleto (antes pasaba al de
 *      Consentimientos y acumulaba los errores al final). El tipo de documento ofrece los diez
 *      códigos del servidor. Un correo ya registrado vuelve al campo con «¿Quieres ingresar?».
 *   2. ASISTENTE DE MERCADO INTERRUMPIDO. Lo escrito se autoguarda como borrador; salir y volver lo
 *      recupera; la lista y el Resumen dicen «Tienes un Mercado sin terminar» con «Continuar» y
 *      «Descartar»; «Cancelar» pregunta; la revisión dice «Falta antes de guardar» con enlace a cada
 *      campo.
 *
 * Requiere el entorno local con la API (con la confirmación de correo dispensada, como en modo demo)
 * y el frontend. Crea cuentas nuevas en cada ejecución.
 */

const MARCA = `${Date.now()}`.slice(-9);
const CLAVE = 'Clave-Segura-2026';

async function registrarPorApi(page: Page, correo: string, documento: string, organizacion: string): Promise<void> {
  const preparacion = await (await page.request.get('/api/v1/externo/auth/register-preparation')).json() as { politicas?: { clave: string }[] };
  const alta = await page.request.post('/api/v1/externo/auth/register', {
    data: {
      registrationType: 'organizacion', organizationName: organizacion,
      headquartersDepartmentCode: '41', headquartersMunicipalityCode: '41001',
      firstName: 'Ana', firstSurname: 'Restrepo', documentType: 'cc', documentNumber: documento,
      phone: '3001234567', email: correo, password: CLAVE,
      politicasAceptadas: (preparacion.politicas ?? []).map(politica => politica.clave),
    },
  });
  expect(alta.ok(), `el registro tiene que aceptar la cuenta: ${await alta.text()}`).toBeTruthy();
}

test.describe('L4: formularios, validación y guardado', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('registro con errores: valida por paso, junto al campo, con foco y sin avisos flotantes', { tag: '@backend' }, async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    const correoExistente = `l4.existente.${MARCA}@ejemplo.test`;
    await registrarPorApi(page, correoExistente, `8${MARCA}`, `Corporación Existente ${MARCA}`);

    await test.step('«Siguiente» con todo vacío no avanza y dice qué falta junto a cada campo', async () => {
      await page.goto('/registro', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /^Organización/ }).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();

      await expect(page.locator('#registro-firstName-error')).toContainText('Escribe el primer nombre');
      await expect(page.locator('#registro-documentNumber-error')).toContainText('entre 6 y 15 cifras');
      await expect(page.locator('#registro-password-error')).toContainText('12 caracteres');
      await expect(page.locator('#registro-firstName')).toBeFocused();
      // Sigue en el paso 1: el de Organización todavía no se muestra, y no hay aviso flotante.
      await expect(page.locator('#registro-organizationName')).toHaveCount(0);
      await expect(page.locator('[role="alert"].fixed')).toHaveCount(0);
      // El indicador sigue en el paso 1: antes marcaba el paso 1 «completado» y saltaba al 3.
      await expect(page.locator('app-indicador-de-pasos button[aria-current="step"]')).toContainText('Datos personales');
      await expect(page.locator('app-indicador-de-pasos svg')).toHaveCount(0);
    });

    await test.step('las reglas se ven desde el principio y el tipo de documento ofrece los diez del servidor', async () => {
      await expect(page.locator('#registro-password-ayuda')).toContainText('Entre 12 y 128 caracteres');
      await expect(page.locator('#registro-documentNumber-ayuda')).toContainText('Entre 6 y 15 cifras');
      await expect(page.locator('#registro-documentType option')).toHaveCount(11); // «Selecciona» + 10 tipos
      await page.selectOption('#registro-documentType', { label: 'Permiso por protección temporal' });
    });

    await test.step('un campo se valida al salir de él', async () => {
      await page.fill('#registro-documentNumber', '123');
      await page.locator('#registro-documentNumber').blur();
      await expect(page.locator('#registro-documentNumber-error')).toContainText('entre 6 y 15 cifras');
      await page.fill('#registro-documentNumber', `9${MARCA}`);
      await expect(page.locator('#registro-documentNumber-error')).toHaveCount(0);
    });

    await test.step('con el paso bien diligenciado avanza; el siguiente paso también valida', async () => {
      await page.fill('#registro-firstName', 'Lucía');
      await page.fill('#registro-firstSurname', 'Mosquera');
      await page.fill('#registro-email', correoExistente);
      await page.fill('#registro-password', CLAVE);
      await page.fill('#registro-confirmPassword', CLAVE);
      await page.getByRole('button', { name: 'Siguiente' }).click();

      await expect(page.locator('#registro-organizationName')).toBeVisible();
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await expect(page.locator('#registro-organizationName-error')).toContainText('Escribe el nombre de la organización');
      await expect(page.locator('#registro-headquartersDepartmentCode-error')).toContainText('Elige el departamento');
      await expect(page.locator('#registro-organizationName')).toBeFocused();

      await page.fill('#registro-organizationName', `Corporación Nueva ${MARCA}`);
      await elegirEnDesplegable(page.locator('#registro-headquartersDepartmentCode'), { indice: 1 });
      await elegirEnDesplegable(page.locator('#registro-headquartersMunicipalityCode'), { indice: 1 });
      await page.getByRole('button', { name: 'Siguiente' }).click();
    });

    await test.step('sin aceptar lo obligatorio no registra; con todo, un correo repetido vuelve a su campo', async () => {
      await page.getByRole('button', { name: 'Registrar organización' }).click();
      await expect(page.locator('#registro-politicas-error')).toContainText('Debes aceptar');

      for (const casilla of await page.locator('input[type="checkbox"][name^="politica-"]').all()) await casilla.check();
      await page.getByRole('button', { name: 'Registrar organización' }).click();

      await expect(page.locator('#registro-email-error')).toContainText('Ya hay una cuenta con este correo. ¿Quieres ingresar?', { timeout: 20_000 });
      await expect(page.locator('#registro-email')).toBeFocused();
      await expect(page.getByRole('button', { name: 'Ingresar con este correo' })).toBeVisible();
      // Nada de «No fue posible registrar el usuario externo…» ni nombres técnicos.
      await expect(page.locator('body')).not.toContainText('usuario externo');
    });
  });

  test('asistente de Mercado interrumpido: autoguarda, avisa, recupera y deja continuar o descartar', { tag: '@backend' }, async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    const correo = `l4.mercado.${MARCA}@ejemplo.test`;
    await registrarPorApi(page, correo, `7${MARCA}`, `Corporación de Mercados ${MARCA}`);
    const entrada = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: { email: correo, password: CLAVE } });
    expect(entrada.ok()).toBeTruthy();
    const NOMBRE = `Mercado a medias ${MARCA}`;
    let organizacion = '';

    await test.step('lo escrito se guarda como borrador mientras se escribe', async () => {
      await page.goto('/gestion', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/gestion\/o\/\d+\/resumen/, { timeout: 30_000 });
      organizacion = /\/gestion\/o\/(\d+)\//.exec(page.url())![1];
      await page.goto(`/gestion/o/${organizacion}/procesos/mercados/nuevo`, { waitUntil: 'domcontentloaded' });

      // En blanco no dice «Borrador guardado» (era engañoso).
      await expect(page.locator('#mercado-nombre')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('mercado-estado-guardado')).toHaveText('');
      await page.fill('#mercado-nombre', NOMBRE);
      await expect(page.getByTestId('mercado-estado-guardado')).toContainText('Borrador guardado a las', { timeout: 15_000 });
    });

    await test.step('salir no pierde nada y no hay que confirmar: el borrador está en el servidor', async () => {
      await page.goto(`/gestion/o/${organizacion}/resumen`, { waitUntil: 'domcontentloaded' });
      const aviso = page.getByTestId('registro-sin-terminar').first();
      await expect(aviso).toContainText(`Tienes un Mercado sin terminar: «${NOMBRE}»`, { timeout: 30_000 });
    });

    await test.step('la lista de Mercados lo ofrece y «Continuar» recupera lo escrito', async () => {
      await page.goto(`/gestion/o/${organizacion}/procesos/mercados`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('registro-sin-terminar')).toContainText(NOMBRE, { timeout: 30_000 });
      await page.getByTestId('continuar-registro').click();

      await expect(page).toHaveURL(new RegExp(`/gestion/o/${organizacion}/procesos/mercados/nuevo$`));
      await expect(page.locator('#mercado-nombre')).toHaveValue(NOMBRE, { timeout: 30_000 });
      await expect(page.getByTestId('mercado-borrador-recuperado')).toBeVisible();
    });

    await test.step('la revisión dice qué falta, con enlace al campo', async () => {
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();
      const falta = page.getByTestId('mercado-falta');
      await expect(falta).toContainText('Falta antes de guardar');
      await expect(falta).toContainText('Municipio');
      // El paso 2 se visitó con algo pendiente: incompleto, no «completado».
      await expect(page.locator('app-indicador-de-pasos li').nth(1).locator('.sr-only')).toContainText('Falta completar');
      await falta.getByRole('button', { name: 'Departamento', exact: true }).click();
      await expect(page.locator('#mercado-departamento')).toBeFocused();
    });

    await test.step('«Cancelar» pregunta y «Descartar» borra el registro sin terminar', async () => {
      await page.getByTestId('mercado-cancelar').click();
      await expect(page.getByRole('heading', { name: '¿Salir del registro del mercado?' })).toBeVisible();
      await page.getByTestId('mercado-descartar').click();

      await expect(page).toHaveURL(new RegExp(`/gestion/o/${organizacion}/procesos/mercados$`), { timeout: 30_000 });
      await expect(page.getByTestId('abrir-crear-mercado')).toBeVisible();
      await expect(page.getByTestId('registro-sin-terminar')).toHaveCount(0);
      const pendientes = await (await page.request.get(`/api/v1/externo/organizaciones/${organizacion}/borradores-pendientes`)).json() as unknown[];
      expect(pendientes).toEqual([]);
    });
  });
});
