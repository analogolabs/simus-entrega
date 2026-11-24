import { test, expect, Browser, Page } from '@playwright/test';

/**
 * «Es imposible que alguien abra una organización que no sea suya», en navegador.
 *
 *   1. Dos cuentas, cada una con su organización (el alta externa crea la organización con la cuenta).
 *   2. La cuenta de «Norte» pide por URL el panel de «Sur» y por API los datos de Sur: la pantalla
 *      dice «No formas parte de esta organización», NO pinta el nombre de Sur ni sección alguna, y
 *      la API responde 404 sin cuerpo (lo mismo que para una organización que no existe).
 *   3. La «última organización» guardada que apunta a una ajena se olvida y `/gestion` abre la propia.
 *
 * Requiere la pila local con la base de demostración (frontend + API, correo dispensado). NO se ejecuta
 * en la validación rápida: la cubren el xUnit `PoliticaDeOrganizacionPropiaTests` y el spec Karma
 * `organizacion-propia.guard.spec.ts`.
 */

const MARCA = `${Date.now()}`.slice(-9);
const CLAVE = 'Clave-Segura-2026';
const NORTE = `Corporación Norte ${MARCA}`;
const SUR = `Corporación Sur ${MARCA}`;

async function registrarYEntrar(browser: Browser, nombre: string, correo: string, documento: string): Promise<{ page: Page; organizacionId: string }> {
  const page = await (await browser.newContext()).newPage();
  const preparacion = await (await page.request.get('/api/v1/externo/auth/register-preparation')).json() as { politicas?: { clave: string }[] };
  const alta = await page.request.post('/api/v1/externo/auth/register', {
    data: {
      registrationType: 'organizacion', organizationName: nombre,
      headquartersDepartmentCode: '41', headquartersMunicipalityCode: '41001',
      firstName: 'Persona', firstSurname: 'Prueba', documentType: 'cc', documentNumber: documento,
      phone: '3001234567', email: correo, password: CLAVE,
      politicasAceptadas: (preparacion.politicas ?? []).map(politica => politica.clave),
    },
  });
  expect(alta.ok(), await alta.text()).toBeTruthy();
  await page.goto('/ingresar', { waitUntil: 'domcontentloaded' });
  await page.fill('#acceso-correo', correo);
  await page.fill('#acceso-contrasena', CLAVE);
  await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByTestId('entrada-a-gestion')).toBeVisible({ timeout: 30_000 });
  const mias = await (await page.request.get('/api/v1/externo/organizaciones/mis')).json() as { id: string }[];
  return { page, organizacionId: mias[0].id };
}

test.describe('Una organización ajena no se abre', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('ni por la pantalla ni por la API, y sin rastro de lo ajeno', { tag: '@backend' }, async ({ browser }) => {
    const sur = await registrarYEntrar(browser, SUR, `sur.${MARCA}@ejemplo.test`, `8${MARCA}`);
    const norte = await registrarYEntrar(browser, NORTE, `norte.${MARCA}@ejemplo.test`, `9${MARCA}`);
    const { page } = norte;

    await test.step('la API responde el mismo 404 vacío para la ajena y para la inexistente', async () => {
      const ajena = await page.request.get(`/api/v1/externo/organizaciones/${sur.organizacionId}/perfil`);
      const inexistente = await page.request.get('/api/v1/externo/organizaciones/987654/perfil');
      expect(ajena.status()).toBe(404);
      expect(inexistente.status()).toBe(404);
      expect(await ajena.text()).toBe(await inexistente.text());
      for (const ruta of ['equipo', 'solicitudes', 'festivales', 'eventos', 'responsable']) {
        expect((await page.request.get(`/api/v1/externo/organizaciones/${sur.organizacionId}/${ruta}`)).status(), ruta).toBe(404);
      }
    });

    await test.step('la pantalla dice «sin acceso» y no pinta nada de la otra organización', async () => {
      const filtrados: string[] = [];
      page.on('response', async respuesta => {
        if (respuesta.url().includes(`/organizaciones/${sur.organizacionId}/`) && respuesta.ok()) filtrados.push(respuesta.url());
      });
      await page.goto(`/gestion/o/${sur.organizacionId}/resumen`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('panel-sin-acceso')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(SUR)).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Secciones del panel de la organización' })).toHaveCount(0);
      expect(filtrados, 'ninguna respuesta con datos de la organización ajena').toEqual([]);
    });

    await test.step('la «última organización» que ya no es válida se olvida y /gestion abre la propia', async () => {
      await page.evaluate(([ajena]) => {
        for (const clave of Object.keys(localStorage)) {
          if (clave.startsWith('simus.gestion.ultimaOrganizacion.')) localStorage.setItem(clave, ajena);
        }
      }, [sur.organizacionId]);
      await page.goto('/gestion', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/gestion/o/${norte.organizacionId}/`), { timeout: 30_000 });
      const guardada = await page.evaluate(() =>
        Object.entries(localStorage).filter(([clave]) => clave.startsWith('simus.gestion.ultimaOrganizacion.')).map(([, valor]) => valor));
      expect(guardada).not.toContain(sur.organizacionId);
    });
  });
});
