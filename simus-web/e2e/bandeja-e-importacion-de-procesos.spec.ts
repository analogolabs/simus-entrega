import { test, expect, Browser, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Talleres, Espacios y Redes con el modelo común (CON, decisión 123).
 *
 *   1. La bandeja de Solicitudes de la consola incluye una red en revisión, con la misma fila que los demás, y el
 *      Programa la publica desde la propia bandeja.
 *   2. «Importar espacios» y «Importar redes» están en «Más acciones» de su lista y abren la preparación del archivo;
 *      la importación crea un borrador, sin organización nueva.
 *   3. La consulta guiada de la consola contesta por redes y espacios.
 *
 * Las capturas se guardan en `<carpeta-de-informes>/con/` (o en SIMUS_CAPTURAS). Requiere la API y el frontend
 * en marcha con la siembra de demostración (cuentas de persona y del Programa).
 */

const CARPETA = process.env['SIMUS_CAPTURAS'] ?? join(homedir(), 'SIMUS-capturas', 'con');
const CLAVE = process.env['SIMUS_EXTERNO_PASSWORD'] ?? process.env['PNMC_EXTERNO_PASSWORD'] ?? 'admin';
const PERSONA = { email: 'valentina.ocampo@correo.test', password: CLAVE };
const FUNCIONARIO = {
  email: process.env['SIMUS_GESTOR_EMAIL'] ?? process.env['PNMC_GESTOR_EMAIL'] ?? 'gestor@simus.test',
  password: process.env['SIMUS_GESTOR_PASSWORD'] ?? process.env['PNMC_GESTOR_PASSWORD'] ?? 'admin',
};
const SUFIJO = Date.now().toString().slice(-8);
const RED = `Archivo de Gaitas ${SUFIJO}`;
const ESPACIO = `Sala La Cueva ${SUFIJO}`;

async function captura(page: Page, nombre: string): Promise<void> {
  mkdirSync(CARPETA, { recursive: true });
  await page.screenshot({ path: join(CARPETA, `${nombre}.png`), fullPage: false });
}

async function sesionDeConsola(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), FUNCIONARIO.email);
  await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(FUNCIONARIO.email);
  await page.locator('input[type="password"]').fill(FUNCIONARIO.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

async function csrfDeConsola(page: Page, ruta: string): Promise<string> {
  const respuesta = await page.request.get(ruta);
  expect(respuesta.status()).toBe(200);
  return ((await respuesta.json()) as { token: string }).token;
}

test.describe('Talleres, Espacios y Redes con el modelo común', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test('una red en revisión sale en la bandeja y se publica desde ella', { tag: '@backend' }, async ({ browser }) => {
    const persona = await (await browser.newContext()).newPage();
    const entrada = await postConCupo(persona.request, '/api/v1/externo/auth/login', { data: PERSONA });
    expect(entrada.status(), 'la cuenta de demostración de la persona tiene que poder entrar').toBe(200);
    const testigo = ((await (await persona.request.get('/api/v1/externo/organizaciones/csrf')).json()) as { requestToken: string }).requestToken;
    const catalogos = await (await persona.request.get('/api/v1/externo/catalogos/red')).json() as
      { formasDeAcceso: { id: number }[]; formatos: { id: number }[] };
    const divipola = await (await persona.request.get('/api/v1/publico/divipola')).json().catch(() => null);
    void divipola;

    const creada = await persona.request.post('/api/v1/externo/mis-redes', {
      headers: { 'X-CSRF-TOKEN': testigo },
      data: {
        nombre: RED, descripcion: 'Archivo de grabaciones y partituras de gaita.', tipoDeNodo: 'archivo', accesoAbierto: true,
        acervosYColecciones: null, correoRed: 'red@ejemplo.org', telefonoRed: null, sitioWebRed: null, instagramRed: null,
        facebookRed: null, otroEnlaceRed: null, nivelCobertura: 'nacional', codigoDepartamento: null, codigoMunicipio: null,
        // Todo proceso lleva sede principal (docs/desarrollo/30-consola-y-acceso.md §30.17): Popayán, Cauca.
        sedeCodigoDepartamento: '19', sedeCodigoMunicipio: '19001',
        lugarEspecifico: null, formasDeAccesoIds: [catalogos.formasDeAcceso[0].id], formatosIds: [catalogos.formatos[0].id],
        practicasMusicalesIds: [],
      },
    });
    expect(creada.status(), await creada.text()).toBe(201);
    const { id } = (await creada.json()) as { id: number };
    const enviada = await persona.request.post(`/api/v1/externo/redes/${id}/enviar-a-revision`, { headers: { 'X-CSRF-TOKEN': testigo }, data: {} });
    expect(enviada.status()).toBe(200);

    const consola = await sesionDeConsola(browser);
    await consola.goto('/administracion/solicitudes', { waitUntil: 'domcontentloaded' });
    const fila = consola.locator('.revision-item').filter({ hasText: RED });
    await expect(fila).toBeVisible({ timeout: 30_000 });
    await expect(fila).toContainText('Red o centro de documentación en revisión');
    await captura(consola, '01-bandeja-con-una-red-en-revision');

    await fila.click();
    await expect(consola.getByRole('heading', { name: RED })).toBeVisible();
    await expect(consola.locator('[data-testid="ficha-del-proceso"]')).toBeVisible();
    await captura(consola, '02-resumen-de-la-red-en-la-bandeja');

    await consola.locator('[data-publicar-revision]').click();
    await consola.locator('[data-confirmar-decision]').click();
    await expect(consola.locator('.revision-item').filter({ hasText: RED })).toHaveCount(0, { timeout: 30_000 });

    const publica = await persona.request.get(`/api/v1/publico/redes/${id}`);
    expect(publica.status(), 'la red decidida desde la bandeja queda publicada').toBe(200);
    await captura(consola, '03-bandeja-tras-publicar');
  });

  test('«Importar espacios» y «Importar redes» abren la preparación del archivo y la importación deja un borrador', { tag: '@backend' }, async ({ browser }) => {
    const consola = await sesionDeConsola(browser);

    for (const [seccion, accion, titulo] of [['espacios', 'Importar espacios', 'espacios'], ['redes', 'Importar redes', 'redes']] as const) {
      await consola.goto(`/administracion/procesos?tipo=${seccion}`, { waitUntil: 'domcontentloaded' });
      await consola.getByRole('button', { name: /Más acciones/ }).click();
      await expect(consola.getByRole('menuitem', { name: 'Descargar la plantilla' })).toBeVisible();
      await captura(consola, `04-mas-acciones-de-${titulo}`);
      await consola.getByRole('menuitem', { name: accion }).click();
      await expect(consola.getByText(/Volver a/)).toBeVisible({ timeout: 30_000 });
      await captura(consola, `05-preparacion-del-archivo-de-${titulo}`);
    }

    const token = await csrfDeConsola(consola, '/api/v1/admin/importaciones/espacios/csrf');
    const filaDeEspacio = {
      numeroFila: 2,
      valores: { nombre: ESPACIO, departamento: 'Antioquia', municipio: 'Medellín', ambiente: 'Cerrado', correoContacto: 'sala@ejemplo.org' },
    };
    const previa = await consola.request.post('/api/v1/admin/importaciones/espacios/previsualizar', {
      headers: { 'X-CSRF-TOKEN': token },
      data: { nombreArchivo: 'espacios.csv', formato: 'csv', huellaArchivo: 'b'.repeat(64), versionContrato: 1, filas: [filaDeEspacio] },
    });
    expect(previa.status()).toBe(200);
    const vista = (await previa.json()) as { id: number; huellaPlan: string; filasImportables: number };
    expect(vista.filasImportables).toBe(1);
    const confirmada = await consola.request.post(`/api/v1/admin/importaciones/espacios/${vista.id}/confirmar`, {
      headers: { 'X-CSRF-TOKEN': token },
      data: { huellaPlan: vista.huellaPlan, claveIdempotencia: `con-${SUFIJO}`, idsFilasExcluidas: [] },
    });
    expect(confirmada.status()).toBe(200);

    await consola.goto('/administracion/procesos?tipo=espacios', { waitUntil: 'domcontentloaded' });
    await consola.locator('app-filtro-desplegable', { hasText: 'Estado:' }).getByRole('button').first().click();
    await consola.getByRole('option', { name: 'Borrador' }).click();
    await expect(consola.locator('[data-testid="fila-de-proceso-consola"]').filter({ hasText: ESPACIO })).toBeVisible({ timeout: 30_000 });
    await captura(consola, '06-espacio-importado-en-borrador');
  });

  test('las listas por tipo de antes redirigen a la lista única con el tipo elegido', { tag: '@backend' }, async ({ browser }) => {
    const consola = await sesionDeConsola(browser);
    for (const [ruta, tipo] of [['talleres', 'luteria'], ['espacios', 'espacios'], ['redes', 'redes']] as const) {
      await consola.goto(`/administracion/${ruta}`, { waitUntil: 'domcontentloaded' });
      await expect(consola).toHaveURL(new RegExp(`/administracion/procesos\\?tipo=${tipo}$`));
      await expect(consola.getByRole('tab', { selected: true })).toBeVisible();
    }
  });

  test('la consulta guiada de la consola contesta por redes y espacios', { tag: '@backend' }, async ({ browser }) => {
    const consola = await sesionDeConsola(browser);
    for (const [pregunta, consulta] of [
      ['¿Cuántas redes hay?', 'resumen_de_redes'],
      ['¿Cuántos espacios para música en vivo hay?', 'resumen_de_espacios'],
      ['¿En qué departamentos hay talleres de lutería?', 'talleres_por_departamento'],
    ] as const) {
      const respuesta = await consola.request.post('/api/v1/admin/analisis/consultar', { data: { pregunta } });
      expect(respuesta.status()).toBe(200);
      const cuerpo = (await respuesta.json()) as { consultaElegida: string; respuesta: string };
      expect(cuerpo.consultaElegida, pregunta).toBe(consulta);
      expect(cuerpo.respuesta.length).toBeGreaterThan(10);
    }
  });
});
