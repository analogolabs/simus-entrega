import { test, expect, Browser, Page } from '@playwright/test';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { elegirTipoDeLaBandeja } from './apoyo/barra-de-la-consola';
import { opcionDelMenu } from './apoyo/menu-de-acciones';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Reclamar un proceso histórico —aquí un Festival— (decisión 129): el flujo que la dirección marcó como prioritario.
 *
 *   1. El administrador del sistema carga el mismo Festival histórico dos veces, sin organización:
 *      nace publicado (decisión 16), así que no hay que publicarlo aparte.
 *   2. Una organización nueva se registra por /registro, con sede en el mismo departamento.
 *   3. La ficha pública dice que es un registro histórico sin organización (REC-13); desde ahí pide
 *      administrarlo, con un acta en PDF como soporte (REC-16).
 *   4. El administrador del sistema ve el soporte en la bandeja y fusiona la copia duplicada en el
 *      Festival reclamado (decisión 18); la ficha pública de la copia lleva al que se conservó.
 *   5. El gestor del Ecosistema lo ve en la bandeja, con el histórico y la organización, y aprueba.
 *   6. La organización lo administra, con las ediciones de las dos copias y sin duplicados.
 *
 * <b>POR QUÉ EXISTE.</b> El 6 de noviembre de 2026 reclamar respondía 500 en cualquier SQL Server
 * y ninguna prueba lo veía (REC-01). Las pruebas de la API cubren cada paso; esta cubre que la
 * pantalla los encadena.
 *
 * Requiere el entorno local con la base de demostración (`scripts/demo/reconstruir-demo-local.sh`), el
 * frontend y la API. Crea un Festival y una organización nuevos en cada ejecución.
 */

const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin' };
const GESTOR = { email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test', password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin' };
const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const NOMBRE = `Festival Histórico del Tiple ${MARCA}`;
const ORGANIZACION = `Corporación del Tiple ${MARCA}`;
const CORREO = `tiple.${MARCA}@ejemplo.test`;
const CLAVE = 'Clave-Segura-2026';
const ACTA = `acta-tiple-${MARCA}.pdf`;

test.describe('#140 y #147: una organización nueva reclama su Festival histórico', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('lo encuentra, lo pide con soportes, la consola fusiona el duplicado, aprueba y la organización lo administra', { tag: '@backend' }, async ({ browser }) => {
    const [reclamado, copia] = await test.step('el administrador del sistema carga el histórico dos veces y nace publicado', async () => cargarHistoricos(browser));

    const organizacion = await test.step('la organización se registra con sede en Neiva', async () => registrarOrganizacion(browser));

    await test.step('la ficha pública dice que es un registro histórico y desde ahí pide administrarlo, con un acta', async () => {
      await organizacion.goto(`/ecosistema/festivales/${reclamado}`, { waitUntil: 'domcontentloaded' });
      // REC-13: el Programa no aparece como «organización responsable».
      const aviso = organizacion.getByTestId('registro-historico');
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await expect(organizacion.getByText('Ninguna todavía: es un registro histórico')).toBeVisible();
      await aviso.getByRole('link', { name: 'Es de mi organización: pedir su administración' }).click();
      // DECISIÓN 74: reclamar es una herramienta aparte, no un bloque debajo de la lista de Festivales.
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/herramientas\/procesos-historicos\?reclamar=/, { timeout: 30_000 });
      await expect(organizacion.getByRole('heading', { name: 'Procesos históricos' })).toBeVisible();
      // DECISIÓN 90: nunca una organización por omisión. Con una sola se usa y se dice cuál.
      await expect(organizacion.getByTestId('historicos-organizacion-elegida')).toContainText(`«${ORGANIZACION}»`, { timeout: 30_000 });
      // DECISIÓN 91: el resumen ya no avisa de los históricos; la herramienta es el único aviso.
      await expect(organizacion.getByTestId('resumen-historicos')).toHaveCount(0);
      const bloque = organizacion.getByTestId('historicos-reclamables');
      const tarjeta = bloque.getByTestId(`historico-${reclamado}`);
      await expect(tarjeta.getByLabel(/¿Por qué es de tu organización\?/)).toBeVisible({ timeout: 30_000 });
      await tarjeta.getByLabel(/¿Por qué es de tu organización\?/).fill('Lo organizamos desde 2010; adjuntamos el acta de la edición 2019.');
      // REC-16: el soporte va al Banco de archivos de la organización y la solicitud lo cita.
      await tarjeta.locator('input[type=file]').setInputFiles({ name: ACTA, mimeType: 'application/pdf', buffer: pdfDePrueba() });
      await expect(tarjeta.getByRole('list', { name: 'Soportes adjuntos' })).toContainText(ACTA, { timeout: 30_000 });
      await tarjeta.getByRole('button', { name: 'Enviar solicitud' }).click();
      await expect(tarjeta.getByText('Ya lo pediste')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('el administrador del sistema ve el soporte y fusiona la copia duplicada', async () => {
      const webmaster = await sesionDeConsola(browser, WEBMASTER);
      await webmaster.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
      await elegirTipoDeLaBandeja(webmaster, /Reclamos de administración/);
      await webmaster.getByText(NOMBRE).first().click();
      await expect(webmaster.getByTestId('reclamo-soportes')).toContainText(ACTA, { timeout: 30_000 });
      await expect(webmaster.getByTestId('reclamo-relacionadas')).toContainText('Posible duplicado en el registro histórico');
      await webmaster.getByTestId('abrir-fusion').click();
      await webmaster.getByTestId('fusionar-festival').click();
      const dialogo = webmaster.getByRole('dialog', { name: 'Fusionar con otra copia' });
      await dialogo.getByLabel(new RegExp(`n\\.º ${copia}`)).check();
      await dialogo.getByLabel('Por qué son el mismo Festival').fill('Las dos cargas describen el mismo Festival del Tiple de Neiva.');
      // T2: antes de fusionar se ven las dos copias lado a lado, y se confirma lo que no se deshace.
      await expect(dialogo.getByTestId('comparacion-de-copias')).toContainText('Así quedaría la fusión', { timeout: 30_000 });
      await dialogo.getByLabel(/Entiendo que/).check();
      await dialogo.getByRole('button', { name: 'Fusionar', exact: true }).click();
      await expect(webmaster.getByText('quedó fusionado en este Festival y archivado')).toBeVisible({ timeout: 30_000 });
      await webmaster.context().close();

      // LA FICHA PÚBLICA DE LA COPIA LLEVA A LA QUE SE CONSERVÓ.
      await organizacion.goto(`/ecosistema/festivales/${copia}`, { waitUntil: 'domcontentloaded' });
      await expect(organizacion).toHaveURL(new RegExp(`/ecosistema/festivales/${reclamado}$`), { timeout: 30_000 });
    });

    await test.step('la consola ve el histórico y la organización, y aprueba', async () => {
      const gestor = await sesionDeConsola(browser, GESTOR);
      await gestor.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
      await elegirTipoDeLaBandeja(gestor, /Reclamos de administración/);
      await gestor.getByText(NOMBRE).first().click();
      await expect(gestor.getByTestId('reclamo-festival')).toContainText('Histórico, sin organización', { timeout: 30_000 });
      await expect(gestor.getByTestId('reclamo-organizacion')).toContainText('NEIVA');
      await gestor.getByRole('button', { name: 'Aprobar', exact: true }).click();
      await expect(gestor.getByText('pasará a administrar el Festival')).toBeVisible();
      await gestor.getByRole('button', { name: `Aprobar «${NOMBRE}»` }).last().click();
      await expect(gestor.getByText(NOMBRE)).toHaveCount(0, { timeout: 30_000 });
    });

    await test.step('la organización lo administra, con las ediciones de las dos copias y sin duplicados', async () => {
      await organizacion.goto('/gestion/procesos/festivales', { waitUntil: 'domcontentloaded' });
      const lista = organizacion.getByRole('region', { name: 'Listado de Festivales' });
      // UNA SOLA TARJETA: la copia absorbida no aparece (su nombre sí, en la última entrada del historial).
      await expect(lista.getByRole('heading', { name: NOMBRE })).toHaveCount(1, { timeout: 30_000 });
      // LA LISTA DE FESTIVALES YA NO OFRECE RECLAMAR (decisión 74): el bloque está en la herramienta.
      await expect(organizacion.getByTestId('historicos-reclamables')).toHaveCount(0);
      // ENTRADA MANUAL: Herramientas → Procesos históricos, con «Mis solicitudes» y su resultado.
      await organizacion.getByRole('link', { name: 'Herramientas', exact: true }).click();
      await organizacion.getByTestId('abrir-procesos-historicos').click();
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/herramientas\/procesos-historicos$/, { timeout: 30_000 });
      await expect(organizacion.getByTestId('historicos-mis-solicitudes')).toContainText('Administración transferida', { timeout: 30_000 });
      // LA RUTA DE ANTES («festivales-historicos») SIGUE ABRIENDO y redirige a la de ahora (decisión 129).
      await organizacion.goto('/gestion/herramientas/festivales-historicos', { waitUntil: 'domcontentloaded' });
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/herramientas\/procesos-historicos$/, { timeout: 30_000 });
      // LOS ENLACES DE ANTES SIGUEN ABRIENDO: llevan a la herramienta con el Festival buscado.
      await organizacion.goto(`/gestion/procesos/festivales?reclamar=${reclamado}&buscar=${encodeURIComponent(NOMBRE)}`, { waitUntil: 'domcontentloaded' });
      await expect(organizacion).toHaveURL(/\/gestion\/o\/\d+\/herramientas\/procesos-historicos\?reclamar=/, { timeout: 30_000 });
      await organizacion.goto('/gestion/solicitudes', { waitUntil: 'domcontentloaded' });
      // SOL: lista común; lo resuelto está en «Resueltas» y «Abrir el Festival» vive en la ficha de la solicitud.
      await elegirEnDesplegable(organizacion.locator('[data-filtro="filtro-estado-solicitud"]'), { valor: 'resuelta' });
      const fila = organizacion.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: NOMBRE });
      await expect(fila).toContainText('Administración transferida', { timeout: 30_000 });
      await (await opcionDelMenu(fila, /Abrir/)).click();
      await expect(organizacion.getByRole('link', { name: 'Abrir el Festival' }).first()).toBeVisible();
    });
  });
});

// ─────────────────────────────── Apoyos ───────────────────────────────

/** Carga el mismo histórico dos veces, como llega de dos fuentes. Devuelve los dos identificadores. */
async function cargarHistoricos(browser: Browser): Promise<[string, string]> {
  const page = await (await browser.newContext()).newPage();
  const entrada = await postConCupo(page.request, '/api/v1/admin/auth/login', { data: WEBMASTER });
  expect(entrada.status(), 'la cuenta webmaster de demostración tiene que poder entrar').toBe(200);
  const testigo = (await (await page.request.get('/api/v1/admin/contenido-web/csrf')).json()).token as string;
  const cabeceras = { 'X-CSRF-TOKEN': testigo };
  const ids: string[] = [];
  for (const descripcion of ['Registro histórico de demostración.', 'Registro histórico de demostración (segunda fuente).']) {
    const alta = await page.request.post('/api/v1/admin/festivales', {
      headers: cabeceras,
      data: {
        festival: {
          nombre: NOMBRE, descripcion, nivelCobertura: 'municipal',
          codigoDepartamento: '41', codigoMunicipio: '41001', periodicidad: 'anual',
          practicasMusicalesIds: [], territoriosSonorosIds: [],
        },
        organizacionResponsableId: null,
      },
    });
    expect(alta.status(), await alta.text()).toBe(201);
    const creado = await alta.json();
    // DECISIÓN 16: nace publicado; antes había que publicarlo aparte.
    expect(creado.estado).toBe('publicado');
    ids.push(creado.id as string);
  }
  await page.context().close();
  return [ids[0], ids[1]];
}

/** Un PDF mínimo pero válido: cabecera, versión y marca de fin, que es lo que el banco comprueba. */
function pdfDePrueba(): Buffer {
  return Buffer.from(`%PDF-1.4\n% Acta de prueba ${MARCA}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`, 'ascii');
}

async function registrarOrganizacion(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/registro', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Organización/ }).click();
  await page.fill('[name=firstName]', 'Ana');
  await page.fill('[name=firstSurname]', 'Prueba');
  await page.selectOption('select[name=documentType]', { index: 1 });
  await page.fill('[name=documentNumber]', `9${MARCA.slice(-8)}`);
  await page.fill('[name=email]', CORREO);
  await page.fill('[name=password]', CLAVE);
  await page.fill('[name=confirmPassword]', CLAVE);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.fill('[name=organizationName]', ORGANIZACION);
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
