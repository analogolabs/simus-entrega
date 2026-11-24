import { test, expect, Browser, Page } from '@playwright/test';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { elegirTipoDeLaBandeja } from './apoyo/barra-de-la-consola';

/**
 * Procesos históricos de los CINCO tipos (decisión 131): una organización nueva reclama un histórico
 * de cada tipo sembrado (Mercado, Red, Lutería y Espacio) con la misma herramienta y el Ecosistema los
 * aprueba; sin criterio de búsqueda no se sugiere nada.
 *
 * Requiere la base de demostración con la siembra `procesos-historicos` (scripts/demo/sembrar-demo.sh), el
 * frontend y la API. Crea una organización nueva en cada ejecución, pero RECLAMA los históricos sembrados:
 * para repetirla hay que reconstruir la base (`scripts/demo/reconstruir-demo-local.sh`) o renombrar los usados y volver a sembrar. Los Festivales se reclaman en
 * `reclamar-festival-historico`.
 */

const GESTOR = { email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test', password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin' };
const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const CLAVE = 'Clave-Segura-2026';
const CORREO = `cinco.${MARCA}@ejemplo.test`;
const CASOS = [
  { tipo: 'Mercados musicales', buscar: 'Mercado Musical del Pacífico', nombre: 'Mercado Musical del Pacífico (histórico)', ficha: '/ecosistema/mercados-musicales/' },
  { tipo: 'Redes y documentación', buscar: 'Archivo Sonoro del Caribe', nombre: 'Archivo Sonoro del Caribe (histórico)', ficha: '/ecosistema/redes/' },
  { tipo: 'Lutería', buscar: 'Luthería Andina', nombre: 'Taller de Luthería Andina (histórico)', ficha: '/ecosistema/luteria/' },
  { tipo: 'Espacios para música en vivo', buscar: 'Sala de Conciertos del Río', nombre: 'Sala de Conciertos del Río (histórica)', ficha: '/ecosistema/espacios/' },
];

test.describe('decisión 131: reclamar un histórico de cada tipo', () => {
  test.describe.configure({ mode: 'serial', timeout: 480_000 });

  test('abre sin sugerencias, filtra por cada tipo, reclama y el Ecosistema aprueba', { tag: '@backend' }, async ({ browser }) => {
    const organizacion = await test.step('la organización se registra con sede en Neiva', async () => registrarOrganizacion(browser));
    const bloque = organizacion.getByTestId('historicos-reclamables');

    await test.step('al abrir no hay lista ni sugerencias', async () => {
      await organizacion.goto('/gestion/herramientas/procesos-historicos', { waitUntil: 'domcontentloaded' });
      await expect(bloque.getByTestId('historicos-estado-inicial')).toBeVisible({ timeout: 30_000 });
      await expect(bloque.locator('[data-testid^="historico-"]')).toHaveCount(0);
      await expect(bloque.getByTestId('historicos-tipos-no-aplican')).toHaveCount(0);
    });

    for (const caso of CASOS) {
      await test.step(`reclama «${caso.nombre}» (${caso.tipo})`, async () => {
        await organizacion.goto('/gestion/herramientas/procesos-historicos', { waitUntil: 'domcontentloaded' });
        await elegirEnDesplegable(bloque.locator('[data-filtro="historicos-tipo"]'), { etiqueta: caso.tipo });
        // La lista se vuelve a pedir con cada cambio de filtro y `cambiar()` cierra el formulario abierto.
        // Se espera la respuesta de ESTA búsqueda (la última) antes de tocar la tarjeta: si no, el clic
        // en «Es mío» podía caer sobre la lista del filtro anterior y el formulario se cerraba o se
        // reconstruía bajo el relleno, y «Enviar solicitud» quedaba deshabilitado.
        const respuestaDeLaBusqueda = organizacion.waitForResponse(
          (r) => r.url().includes('/procesos-historicos') && new URL(r.url()).searchParams.get('buscar') === caso.buscar && r.ok(),
          { timeout: 30_000 },
        );
        await bloque.getByTestId('historicos-buscar').fill(caso.buscar);
        await respuestaDeLaBusqueda;
        const tarjeta = bloque.locator('[data-testid^="historico-"]').filter({ hasText: caso.nombre });
        await expect(tarjeta).toBeVisible({ timeout: 30_000 });
        await expect(tarjeta).toHaveCount(1);
        await expect(tarjeta.locator(`a[href^="${caso.ficha}"]`)).toBeVisible();
        await tarjeta.getByRole('button', { name: 'Es mío: pedir administración' }).click();
        const justificacion = tarjeta.getByLabel(/¿Por qué es de tu organización\?/);
        await justificacion.fill('Lo gestionamos desde 2019.');
        await expect(justificacion).toHaveValue('Lo gestionamos desde 2019.');
        const enviar = tarjeta.getByRole('button', { name: 'Enviar solicitud' });
        await expect(enviar).toBeEnabled();
        await enviar.click();
        await expect(tarjeta.getByText('Ya lo pediste')).toBeVisible({ timeout: 30_000 });
      });
    }

    await test.step('el Ecosistema aprueba los cuatro y la organización los ve transferidos', async () => {
      const gestor = await sesionDeConsola(browser, GESTOR);
      for (const caso of CASOS) {
        await gestor.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
        await elegirTipoDeLaBandeja(gestor, /Reclamos de administración/);
        await gestor.getByText(caso.nombre).first().click();
        await expect(gestor.getByTestId('reclamo-organizacion')).toContainText('NEIVA', { timeout: 30_000 });
        await gestor.getByRole('button', { name: 'Aprobar', exact: true }).click();
        await gestor.getByRole('button', { name: `Aprobar «${caso.nombre}»` }).last().click();
        await expect(gestor.getByText(caso.nombre)).toHaveCount(0, { timeout: 30_000 });
      }
      await organizacion.goto('/gestion/herramientas/procesos-historicos', { waitUntil: 'domcontentloaded' });
      for (const caso of CASOS) {
        await expect(organizacion.getByTestId('historicos-mis-solicitudes')).toContainText(caso.nombre, { timeout: 30_000 });
      }
      await expect(organizacion.getByTestId('historicos-mis-solicitudes')).toContainText('Administración transferida');
    });
  });
});

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

async function registrarOrganizacion(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/registro', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Organización/ }).click();
  await page.fill('[name=firstName]', 'Ana');
  await page.fill('[name=firstSurname]', 'Cinco');
  await page.selectOption('select[name=documentType]', { index: 1 });
  await page.fill('[name=documentNumber]', `6${MARCA.slice(-8)}`);
  await page.fill('[name=email]', CORREO);
  await page.fill('[name=password]', CLAVE);
  await page.fill('[name=confirmPassword]', CLAVE);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.fill('[name=organizationName]', `Corporación de los Cinco Tipos ${MARCA}`);
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
