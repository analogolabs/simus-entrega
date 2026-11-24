import { test, expect, Browser, Page } from '@playwright/test';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Procesos históricos sin sugerencias por defecto (decisión 129).
 *
 *   1. El administrador del sistema carga dos Festivales históricos en Neiva: uno con el correo de
 *      contacto de la organización que se va a registrar (una coincidencia fuerte) y otro ajeno.
 *   2. La organización se registra con sede en Neiva y abre «Procesos históricos»: NO se lista nada;
 *      solo se sugiere el de la coincidencia fuerte, con su motivo en lenguaje claro. El ajeno, que
 *      comparte solo el municipio, no aparece.
 *   3. Buscar por nombre trae los resultados; el tipo acota (Mercados no trae el Festival) y los
 *      filtros viven en la URL: al recargar siguen puestos.
 *
 * Un Mercado histórico no se carga aquí: lo cubren las pruebas de la API (reclamar, aprobar y
 * transferir) y de Karma. Requiere el entorno local con la base de demostración y crea registros
 * nuevos en cada ejecución.
 */

const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin' };
const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const CLAVE = 'Clave-Segura-2026';
const CORREO = `historicos.${MARCA}@ejemplo.test`;
const NOMBRE_SUGERIDO = `Encuentro del Requinto ${MARCA}`;
const NOMBRE_AJENO = `Encuentro de la Guacharaca ${MARCA}`;

test.describe('decisión 129: procesos históricos sin sugerencias por defecto', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('abre limpio, sugiere solo con coincidencia fuerte y busca con filtros en la URL', { tag: '@backend' }, async ({ browser }) => {
    const [idSugerido, idAjeno] = await test.step('el administrador carga un histórico con el correo de la organización y otro ajeno', async () => cargarHistoricos(browser));
    const organizacion = await test.step('la organización se registra con sede en Neiva', async () => registrarOrganizacion(browser));
    const bloque = organizacion.getByTestId('historicos-reclamables');

    await test.step('al abrir solo se sugiere la coincidencia fuerte, con su motivo', async () => {
      await organizacion.goto('/gestion/herramientas/procesos-historicos', { waitUntil: 'domcontentloaded' });
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/herramientas\/procesos-historicos$/, { timeout: 30_000 });
      await expect(bloque.getByTestId('historicos-sugeridos')).toBeVisible({ timeout: 30_000 });
      await expect(bloque.getByTestId(`historico-${idSugerido}`)).toBeVisible();
      await expect(bloque.getByTestId(`historico-${idSugerido}`).getByTestId('coincidencia-fuerte')).toContainText('comparte el correo de contacto');
      // EL AJENO COMPARTE SOLO EL MUNICIPIO: no se sugiere.
      await expect(bloque.getByTestId(`historico-${idAjeno}`)).toHaveCount(0);
      await expect(bloque.getByTestId('historicos-estado-inicial')).toHaveCount(0);
    });

    await test.step('buscar por nombre trae el resultado y el tipo acota; los filtros quedan en la URL', async () => {
      const buscador = bloque.getByTestId('historicos-buscar');
      await buscador.fill('Guacharaca');
      await expect(bloque.getByTestId(`historico-${idAjeno}`)).toBeVisible({ timeout: 30_000 });
      await expect(bloque.getByTestId('historicos-sugeridos')).toHaveCount(0);
      await expect(organizacion).toHaveURL(/buscar=Guacharaca/);
      await elegirEnDesplegable(bloque.locator('[data-filtro="historicos-tipo"]'), { etiqueta: 'Mercados musicales' });
      await expect(bloque.getByTestId('historicos-sin-resultados')).toBeVisible({ timeout: 30_000 });
      await expect(organizacion).toHaveURL(/tipo=mercados/);
      // RECARGAR CONSERVA LOS FILTROS.
      await organizacion.reload({ waitUntil: 'domcontentloaded' });
      await expect(bloque.getByTestId('historicos-buscar')).toHaveValue('Guacharaca', { timeout: 30_000 });
      await expect(bloque.getByTestId('historicos-sin-resultados')).toBeVisible({ timeout: 30_000 });
      await bloque.getByTestId('historicos-limpiar').first().click();
      await expect(bloque.getByTestId('historicos-sugeridos')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('el texto de la herramienta no habla de «el PNMC»', async () => {
      await expect(organizacion.getByRole('heading', { name: 'Procesos históricos' })).toBeVisible();
      await expect(organizacion.locator('app-procesos-historicos-page')).not.toContainText(/Programa/);
      await expect(bloque.getByTestId('historicos-tipos-no-aplican')).toHaveCount(0);
    });
  });
});

async function cargarHistoricos(browser: Browser): Promise<[string, string]> {
  const page = await (await browser.newContext()).newPage();
  const entrada = await postConCupo(page.request, '/api/v1/admin/auth/login', { data: WEBMASTER });
  expect(entrada.status(), 'la cuenta webmaster de demostración tiene que poder entrar').toBe(200);
  const testigo = (await (await page.request.get('/api/v1/admin/csrf')).json()).requestToken as string;
  const ids: string[] = [];
  for (const [nombre, correo] of [[NOMBRE_SUGERIDO, CORREO], [NOMBRE_AJENO, null]] as const) {
    const alta = await page.request.post('/api/v1/admin/festivales', {
      headers: { 'X-CSRF-TOKEN': testigo },
      data: {
        festival: {
          nombre, descripcion: 'Registro histórico de demostración.', correoContacto: correo, nivelCobertura: 'municipal',
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

async function registrarOrganizacion(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/registro', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Organización/ }).click();
  await page.fill('[name=firstName]', 'Ana');
  await page.fill('[name=firstSurname]', 'Histórica');
  await page.selectOption('select[name=documentType]', { index: 1 });
  await page.fill('[name=documentNumber]', `7${MARCA.slice(-8)}`);
  await page.fill('[name=email]', CORREO);
  await page.fill('[name=password]', CLAVE);
  await page.fill('[name=confirmPassword]', CLAVE);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.fill('[name=organizationName]', `Corporación de los Históricos ${MARCA}`);
  await elegirEnDesplegable(page.locator('[name=headquartersDepartmentCode]'), { etiqueta: 'Huila' });
  await elegirEnDesplegable(page.locator('[name=headquartersMunicipalityCode]'), { etiqueta: 'Neiva' });
  await page.getByRole('button', { name: 'Siguiente' }).click();
  const registrar = page.getByRole('button', { name: 'Registrar organización' });
  await expect(registrar).toBeVisible();
  for (const casilla of await page.locator('main input[type=checkbox]').all()) {
    if (!(await casilla.isChecked())) await casilla.check({ force: true });
  }
  await registrar.click();
  await expect(page).toHaveURL(/\/gestion/, { timeout: 30_000 });
  return page;
}
