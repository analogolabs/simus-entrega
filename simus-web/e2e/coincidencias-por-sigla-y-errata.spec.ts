import { test, expect, Browser, Page } from '@playwright/test';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Siglas y erratas de tecleo al buscar un proceso histórico (COI2).
 *
 *   1. El administrador del sistema carga dos Festivales históricos en Neiva (Huila).
 *   2. Una organización nueva con sede en Neiva busca en «Procesos históricos» y
 *      encuentra el primero escribiendo solo su sigla, «FIMC», y el segundo con una errata de
 *      tecleo, «Currulo» por «Currulao». Al abrir la herramienta no hay lista alguna (decisión 129).
 *   3. Sin departamento (todo el país) la sigla ya NO avisa (sin territorio que la respalde, «FIMC»
 *      podría ser de cualquier parte); la errata sí, porque es del nombre.
 *   4. El asistente de alta dice POR QUÉ avisa: «Posible coincidencia por sigla…» y «Posible errata
 *      de tecleo…», con el nombre del Festival, y nunca bloquea.
 *
 * Requiere el entorno local con la base de demostración (`scripts/demo/reconstruir-demo-local.sh`), el
 * frontend y la API. Crea Festivales y una organización nuevos en cada ejecución.
 */

const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin' };
const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const CLAVE = 'Clave-Segura-2026';
const CORREO = `sigla.${MARCA}@ejemplo.test`;
const NOMBRE_DE_LA_SIGLA = 'Festival Internacional de Música Clásica';
const NOMBRE_DE_LA_ERRATA = 'Festival Currulao de Guapi';

test.describe('COI2: siglas y erratas al buscar un Festival histórico', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('la sigla y la errata encuentran el histórico, con su razón y sin salirse del territorio', { tag: '@backend' }, async ({ browser }) => {
    const [idSigla, idErrata] = await test.step('el administrador del sistema carga dos históricos en Neiva', async () => cargarHistoricos(browser));
    const organizacion = await test.step('la organización se registra con sede en Neiva', async () => registrarOrganizacion(browser));

    await test.step('la búsqueda en el departamento encuentra el histórico por su sigla y por una errata', async () => {
      // LA BÚSQUEDA VIVE EN LA HERRAMIENTA «PROCESOS HISTÓRICOS» (decisiones 74 y 129), no debajo de la lista.
      await organizacion.goto('/gestion/herramientas/procesos-historicos', { waitUntil: 'domcontentloaded' });
      const bloque = organizacion.getByTestId('historicos-reclamables');
      const buscador = bloque.getByTestId('historicos-buscar');
      await expect(buscador).toBeVisible({ timeout: 30_000 });
      // SIN SUGERENCIAS POR DEFECTO: ninguno de los dos aparece antes de buscar.
      await expect(bloque.getByTestId('historicos-estado-inicial')).toBeVisible({ timeout: 30_000 });
      await expect(bloque.getByTestId(`historico-${idSigla}`)).toHaveCount(0);
      await expect(bloque.getByTestId(`historico-${idErrata}`)).toHaveCount(0);
      // LA SIGLA SOLO AVISA CON EL TERRITORIO QUE LA RESPALDA: se elige el departamento.
      await elegirEnDesplegable(bloque.locator('[data-filtro="historicos-sede-departamento"]'), { etiqueta: 'Huila' });

      await buscador.fill('FIMC');
      await buscador.press('Enter');
      await expect(bloque.getByTestId(`historico-${idSigla}`)).toBeVisible({ timeout: 30_000 });

      await buscador.fill('Festival Currulo de Guapi');
      await buscador.press('Enter');
      await expect(bloque.getByTestId(`historico-${idErrata}`)).toBeVisible({ timeout: 30_000 });
    });

    await test.step('en todo el país la sigla no avisa y la errata sí', async () => {
      const bloque = organizacion.getByTestId('historicos-reclamables');
      await elegirEnDesplegable(bloque.locator('[data-filtro="historicos-sede-departamento"]'), { etiqueta: 'Todos los departamentos' });
      const buscador = bloque.getByTestId('historicos-buscar');
      await buscador.fill('FIMC');
      await buscador.press('Enter');
      await expect(bloque.getByTestId(`historico-${idSigla}`)).toHaveCount(0, { timeout: 30_000 });

      await buscador.fill('Festival Currulo de Guapi');
      await buscador.press('Enter');
      await expect(bloque.getByTestId(`historico-${idErrata}`)).toBeVisible({ timeout: 30_000 });
    });

    await test.step('el asistente de alta dice por qué avisa, sin bloquear', async () => {
      const organizacionId = /\/gestion\/o\/(\d+)\//.exec(organizacion.url())?.[1];
      expect(organizacionId, 'la URL del panel lleva la organización activa').toBeTruthy();
      const ruta = (nombre: string) =>
        `/api/v1/externo/organizaciones/${organizacionId}/festivales/coincidencias-historicas?nombre=${encodeURIComponent(nombre)}&codigoDepartamento=41&codigoMunicipio=41001`;

      const porSigla = await (await organizacion.request.get(ruta('FIMC'))).json() as { festivalId: string; tipoCoincidencia: string; evidencias: string[] }[];
      const avisoDeSigla = porSigla.find(x => x.festivalId === idSigla);
      expect(avisoDeSigla, 'la sigla encuentra el histórico del mismo departamento').toBeTruthy();
      expect(avisoDeSigla!.evidencias.some(e => e.startsWith('Posible coincidencia por sigla'))).toBe(true);
      expect(avisoDeSigla!.tipoCoincidencia).toBe('HistoricoReclamable');

      const porErrata = await (await organizacion.request.get(ruta('Festival Currulo de Guapi'))).json() as { festivalId: string; evidencias: string[] }[];
      const avisoDeErrata = porErrata.find(x => x.festivalId === idErrata);
      expect(avisoDeErrata, 'la errata encuentra el histórico').toBeTruthy();
      expect(avisoDeErrata!.evidencias.some(e => e.startsWith('Posible errata de tecleo'))).toBe(true);

      // Con otro departamento la sigla no avisa: dos «FIMC» de dos departamentos no son el mismo.
      const otroDepartamento = await (await organizacion.request.get(
        `/api/v1/externo/organizaciones/${organizacionId}/festivales/coincidencias-historicas?nombre=FIMC&codigoDepartamento=05&codigoMunicipio=05001`)).json() as { festivalId: string }[];
      expect(otroDepartamento.some(x => x.festivalId === idSigla)).toBe(false);
    });
  });
});

// ─────────────────────────────── Apoyos ───────────────────────────────

async function cargarHistoricos(browser: Browser): Promise<[string, string]> {
  const page = await (await browser.newContext()).newPage();
  const entrada = await postConCupo(page.request, '/api/v1/admin/auth/login', { data: WEBMASTER });
  expect(entrada.status(), 'la cuenta webmaster de demostración tiene que poder entrar').toBe(200);
  const testigo = (await (await page.request.get('/api/v1/admin/csrf')).json()).requestToken as string;
  const ids: string[] = [];
  for (const nombre of [NOMBRE_DE_LA_SIGLA, NOMBRE_DE_LA_ERRATA]) {
    const alta = await page.request.post('/api/v1/admin/festivales', {
      headers: { 'X-CSRF-TOKEN': testigo },
      data: {
        festival: {
          nombre, descripcion: 'Registro histórico de demostración para medir siglas y erratas.', nivelCobertura: 'municipal',
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
  await page.fill('[name=firstSurname]', 'Sigla');
  await page.selectOption('select[name=documentType]', { index: 1 });
  await page.fill('[name=documentNumber]', `8${MARCA.slice(-8)}`);
  await page.fill('[name=email]', CORREO);
  await page.fill('[name=password]', CLAVE);
  await page.fill('[name=confirmPassword]', CLAVE);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.fill('[name=organizationName]', `Corporación de las Siglas ${MARCA}`);
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
