import { test, expect, Browser, Page } from '@playwright/test';
import { elegirTipoDeLaBandeja } from './apoyo/barra-de-la-consola';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { opcionDelMenu } from './apoyo/menu-de-acciones';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Lo que la organización lee de las decisiones del Programa (D3): la pregunta de una
 * aclaración, el motivo de un rechazo y toda la ruta de un evento hasta la Agenda pública.
 *
 * <b>POR QUÉ EXISTE.</b> Al revisar el recorrido completo en el navegador, la organización no veía
 * QUÉ se le preguntaba en una aclaración (solo «necesita una aclaración»), no veía el motivo de un
 * rechazo en su historial, y un evento rechazado desde «Agenda y eventos» llegaba sin aviso, sin motivo
 * y con un botón «Editar» que la API rechazaba. Las pruebas de la API cubren cada pieza; esta cubre
 * que la pantalla las enseña.
 *
 * Requiere el entorno local con la base de demostración completa (`scripts/demo/reconstruir-demo-local.sh`),
 * el frontend y la API. Crea registros con una marca única en cada ejecución.
 */

const GESTOR = { email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test', password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin' };
const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin' };
/** La administradora de la Corporación Cultural Cantaclaro, que ya tiene un Festival publicado. */
const ORGANIZACION = { email: 'lucia.ramirez@cantaclaro.test', password: 'admin' };
const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(6, 14);
const PDF = Buffer.from('%PDF-1.4\n% Acta D3\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'ascii');

test.describe('D3: lo que la organización lee de las decisiones del PNMC', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('una aclaración dice qué se pregunta y un rechazo dice por qué', { tag: '@backend' }, async ({ browser }) => {
    const nombre = `Festival Histórico de Prueba D3 ${MARCA}`;
    const historico = await cargarHistorico(browser, nombre);
    const organizacion = await sesionDeOrganizacion(browser);
    const gestor = await sesionDeConsola(browser, GESTOR);
    const idDeOrganizacion = /\/gestion\/o\/(\d+)/.exec(organizacion.url())![1];

    await test.step('la organización pide administrar el histórico, con un acta', async () => {
      await organizacion.goto(`/gestion/o/${idDeOrganizacion}/herramientas/procesos-historicos?reclamar=${historico}&buscar=${encodeURIComponent(nombre)}#historicos`, { waitUntil: 'domcontentloaded' });
      const tarjeta = organizacion.getByTestId(`historico-${historico}`);
      await expect(tarjeta.getByLabel(/¿Por qué es de tu organización\?/)).toBeVisible({ timeout: 30_000 });
      await tarjeta.getByLabel(/¿Por qué es de tu organización\?/).fill('Lo organizamos desde 2010.');
      await tarjeta.locator('input[type=file]').setInputFiles({ name: `acta-${MARCA}.pdf`, mimeType: 'application/pdf', buffer: PDF });
      await expect(tarjeta.getByRole('list', { name: 'Soportes adjuntos' })).toContainText(`acta-${MARCA}.pdf`, { timeout: 30_000 });
      await tarjeta.getByRole('button', { name: 'Enviar solicitud' }).click();
      await expect(tarjeta.getByText('Ya lo pediste')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('la consola pide una aclaración con una pregunta concreta', async () => {
      await abrirReclamo(gestor, nombre);
      await gestor.getByRole('button', { name: 'Pedir aclaración' }).click();
      await gestor.getByLabel(/Qué aclaración necesitas/i).fill('Adjunta el acta de la edición 2018.');
      await gestor.getByRole('button', { name: /^Pedir una aclaración sobre/ }).click();
      await expect(gestor.getByText('Se pidió una aclaración a la organización.')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('la organización lee LA PREGUNTA, no solo que hay una', async () => {
      await organizacion.goto(`/gestion/o/${idDeOrganizacion}/solicitudes`, { waitUntil: 'domcontentloaded' });
      // SOL: la lista es común y las acciones de la solicitud viven en su ficha, a la que lleva su fila.
      await (await opcionDelMenu(organizacion.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: nombre }), /Atender/)).click({ timeout: 30_000 });
      const pregunta = organizacion.getByTestId('aclaracion-pendiente');
      await expect(pregunta).toBeVisible({ timeout: 30_000 });
      await expect(pregunta).toContainText('El PNMC pregunta:');
      await expect(pregunta).toContainText('Adjunta el acta de la edición 2018.');
      await organizacion.getByRole('button', { name: 'Responder aclaración' }).click();
      await organizacion.getByLabel('Aclaración para la institución').fill('Aquí está el acta.');
      await organizacion.getByRole('button', { name: 'Enviar aclaración' }).click();
      await expect(organizacion.getByText('Enviaste la aclaración')).toBeVisible({ timeout: 30_000 });
    });

    await test.step('la consola rechaza con un motivo y la organización lo lee en su historial', async () => {
      await abrirReclamo(gestor, nombre);
      await gestor.getByRole('button', { name: 'Rechazar', exact: true }).click();
      await gestor.getByLabel('Por qué').fill('El acta no identifica a la organización como convocante.');
      await gestor.getByRole('button', { name: /^Rechazar «/ }).click();
      await expect(gestor.getByText('Reclamación rechazada.')).toBeVisible({ timeout: 30_000 });

      await organizacion.goto(`/gestion/o/${idDeOrganizacion}/solicitudes`, { waitUntil: 'domcontentloaded' });
      await elegirEnDesplegable(organizacion.locator('[data-filtro="filtro-estado-solicitud"]'), { valor: 'resuelta' });
      await (await opcionDelMenu(organizacion.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: nombre }), /Abrir/)).click({ timeout: 30_000 });
      const motivo = organizacion.getByTestId('motivo-del-rechazo').first();
      await expect(motivo).toBeVisible({ timeout: 30_000 });
      await expect(motivo).toContainText('El acta no identifica a la organización como convocante.');
    });
  });

  test('un evento recorre la ruta: borrador, devuelto con motivo, publicado en la Agenda y rechazado con aviso', { tag: '@backend' }, async ({ browser }) => {
    const titulo = `Concierto de prueba D3 ${MARCA}`;
    const organizacion = await sesionDeOrganizacion(browser);
    const gestor = await sesionDeConsola(browser, GESTOR);
    const idDeOrganizacion = /\/gestion\/o\/(\d+)/.exec(organizacion.url())![1];
    const eventos = `/gestion/o/${idDeOrganizacion}/eventos`;

    await test.step('la organización guarda un borrador y lo envía a revisión', async () => {
      await organizacion.goto(eventos, { waitUntil: 'domcontentloaded' });
      await organizacion.getByRole('button', { name: 'Anunciar evento' }).click();
      await organizacion.getByLabel(/Proceso en el que se enmarca/i).selectOption({ index: 1 });
      await organizacion.getByLabel(/^Título/i).fill(titulo);
      await organizacion.getByLabel(/^Descripción/i).fill('Concierto de apertura, con músicas andinas.');
      await organizacion.getByLabel(/^Empieza/i).fill('2027-03-05');
      await organizacion.getByLabel(/^Lugar/i).fill('Teatro Municipal');
      await organizacion.getByLabel(/Guardar como borrador/).check();
      await organizacion.getByRole('dialog').getByRole('button', { name: 'Guardar borrador' }).click();
      const fila = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await expect(fila).toContainText('Borrador', { timeout: 30_000 });
      await (await opcionDelMenu(fila, /^Enviar a revisión/)).click();
      await expect(fila).toContainText('En revisión', { timeout: 30_000 });
    });

    await test.step('la consola lo devuelve con un motivo y la organización lo lee', async () => {
      await decidirEvento(gestor, titulo, 'devolver');
      await organizacion.goto(eventos, { waitUntil: 'domcontentloaded' });
      const fila = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await expect(fila).toContainText('El PNMC lo devolvió: Falta la hora de inicio.', { timeout: 30_000 });
      await expect(await avisos(organizacion)).toContain('Tu evento volvió para corregir');
    });

    await test.step('la organización corrige, lo reenvía y la consola lo publica en la Agenda', async () => {
      const fila = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await (await opcionDelMenu(fila, /^Editar/)).click();
      await organizacion.locator('input[name=conHoraInicio]').check();
      await organizacion.locator('input[type=time]').first().fill('19:00');
      await organizacion.getByRole('dialog').getByRole('button', { name: 'Guardar borrador' }).click();
      await expect(fila).toContainText('Borrador', { timeout: 30_000 });
      await (await opcionDelMenu(fila, /^Enviar a revisión/)).click();
      await expect(fila).toContainText('En revisión', { timeout: 30_000 });

      await decidirEvento(gestor, titulo, 'publicar');
      await organizacion.goto(eventos, { waitUntil: 'domcontentloaded' });
      await expect(organizacion.getByRole('row', { name: new RegExp(titulo) })).toContainText('Publicado', { timeout: 30_000 });
      const publica = await organizacion.request.get(`/api/v1/publico/agenda/${encodeURIComponent(titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`);
      expect(publica.status(), 'el evento publicado se lee en la Agenda pública').toBe(200);
    });

    await test.step('un rechazo desde «Agenda y eventos» avisa, dice por qué y quita «Editar»', async () => {
      // El evento tiene que estar en revisión para rechazarlo: editarlo ya publicado lo devuelve a revisión.
      const fila = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await (await opcionDelMenu(fila, /^Editar/)).click();
      // EL LUGAR ES DE FONDO (E1, decisión 24): lo devuelve a revisión, a diferencia de una errata.
      await organizacion.getByLabel(/^Lugar/i).fill('Auditorio Principal');
      await organizacion.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(fila).toContainText('En revisión', { timeout: 30_000 });

      const propios = (await (await organizacion.request.get(`/api/v1/externo/organizaciones/${idDeOrganizacion}/eventos`)).json()) as { id: string; titulo: string }[];
      const id = propios.find(e => e.titulo === titulo)!.id;
      const consola = gestor.request;
      const testigo = ((await (await consola.get('/api/v1/admin/contenido-web/csrf')).json()) as { token: string }).token;
      const rechazo = await consola.post(`/api/v1/institucional/agenda/${id}/estado`, { headers: { 'X-CSRF-TOKEN': testigo }, data: { estado: 'rechazado', motivo: 'No corresponde al Festival indicado.' } });
      expect(rechazo.status()).toBe(200);

      await organizacion.goto(eventos, { waitUntil: 'domcontentloaded' });
      const rechazada = organizacion.getByRole('row', { name: new RegExp(titulo) });
      await expect(rechazada).toContainText('Rechazado', { timeout: 30_000 });
      await expect(rechazada.getByTestId('motivo-del-rechazo-del-evento')).toContainText('No corresponde al Festival indicado.');
      // «Editar» no desaparece sin explicación: queda apagado, con su motivo (modelo de acciones por estado).
      await expect(await opcionDelMenu(rechazada, /^Editar/)).toBeDisabled();
      expect(await avisos(organizacion)).toContain('Tu evento fue rechazado');
    });
  });
});

// ─────────────────────────────── Apoyos ───────────────────────────────

/** Carga un histórico sin organización, que nace publicado (decisión 16). Devuelve su identificador. */
async function cargarHistorico(browser: Browser, nombre: string): Promise<string> {
  const page = await (await browser.newContext()).newPage();
  const entrada = await postConCupo(page.request, '/api/v1/admin/auth/login', { data: WEBMASTER });
  expect(entrada.status(), 'la cuenta webmaster de demostración tiene que poder entrar').toBe(200);
  const testigo = (await (await page.request.get('/api/v1/admin/contenido-web/csrf')).json()).token as string;
  const alta = await page.request.post('/api/v1/admin/festivales', {
    headers: { 'X-CSRF-TOKEN': testigo },
    data: {
      festival: {
        nombre, descripcion: 'Registro histórico de prueba.', nivelCobertura: 'municipal',
        codigoDepartamento: '19', codigoMunicipio: '19001', periodicidad: 'anual', practicasMusicalesIds: [], territoriosSonorosIds: [],
      },
      organizacionResponsableId: null,
    },
  });
  expect(alta.status(), await alta.text()).toBe(201);
  const id = (await alta.json()).id as string;
  await page.context().close();
  return id;
}

async function sesionDeOrganizacion(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/ingresar', { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').first().fill(ORGANIZACION.email);
  await page.locator('input[type=password]').first().fill(ORGANIZACION.password);
  await page.getByRole('button', { name: /^Ingresar$|^Entrar/i }).last().click();
  // ACC2: tras iniciar sesión se pregunta «¿Cómo quieres entrar?»; esta cuenta entra a su organización.
  await expect(page.getByTestId('entrada-a-gestion')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-testid^="entrar-organizacion-"]').first().click();
  await page.waitForURL(/\/gestion\/o\/\d+/, { timeout: 30_000 });
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

async function abrirReclamo(gestor: Page, nombre: string): Promise<void> {
  await gestor.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
  await elegirTipoDeLaBandeja(gestor, /Reclamos de administración/);
  await gestor.getByText(nombre).first().click();
}

/** «Devolver» (con el motivo de la prueba) o «Publicar» un evento desde la bandeja de revisión. */
async function decidirEvento(gestor: Page, titulo: string, decision: 'devolver' | 'publicar'): Promise<void> {
  await gestor.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
  await elegirTipoDeLaBandeja(gestor, /^Eventos/);
  await gestor.getByText(titulo).first().click();
  if (decision === 'devolver') {
    await gestor.getByRole('button', { name: 'Devolver para corregir' }).click();
    await gestor.getByLabel(/Qué hay que corregir/i).fill('Falta la hora de inicio.');
    await gestor.getByRole('button', { name: /^Devolver «/ }).click();
    await expect(gestor.getByText('El evento volvió a la organización')).toBeVisible({ timeout: 30_000 });
  } else {
    await gestor.getByRole('button', { name: 'Publicar', exact: true }).click();
    // La confirmación llega un instante después del clic: se espera a la condición (la pregunta o ya el aviso), no se
    // cuenta lo que haya en ese momento (`count()` salteaba la confirmación si aún no se había dibujado).
    const confirmar = gestor.getByRole('button', { name: /^Publicar «/ });
    const publicado = gestor.getByText('El evento quedó publicado');
    await expect(confirmar.or(publicado).first()).toBeVisible({ timeout: 30_000 });
    if (await confirmar.count()) await confirmar.last().click();
    await expect(publicado).toBeVisible({ timeout: 30_000 });
  }
}

/** Los títulos de los avisos que la cuenta tiene en su buzón. */
async function avisos(page: Page): Promise<string[]> {
  const respuesta = await page.request.get('/api/v1/notificaciones?ambito=externo&limite=50');
  const buzon = (await respuesta.json()) as { items: { title: string }[] };
  return buzon.items.map(x => x.title);
}
