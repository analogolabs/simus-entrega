import { Browser, BrowserContext, Page, expect, test } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';
import { HallazgoDeRecorte, recortesDe } from './apoyo/sin-recortes';

/**
 * SIN RECORTES NI DESBORDES (punto 87 del mapa de comentarios; «que no pasen estas cosas de nuevo»). Solo lectura.
 *
 * La comprobación anterior miraba el ancho de la página. Un contenedor con `overflow: hidden`, un `truncate` o una altura
 * fija esconden lo que se sale, y la página sigue midiendo lo mismo. Esta prueba mira CADA elemento visible contra SU
 * contenedor (ver `apoyo/sin-recortes.ts` para las reglas y para las excepciones documentadas con
 * `data-recorte-intencional="motivo"`):
 *   - nada visible más allá del borde de la ventana, ni más allá de un contenedor que lo recorta;
 *   - ningún texto cortado (puntos suspensivos, `line-clamp`, altura fija) que no ofrezca su texto completo en `title`;
 *   - ningún campo de formulario fuera de su tarjeta.
 *
 * Recorre, a 360, 390, 768, 1024 y 1280 px de ancho: el portal, Mi espacio, el panel de la organización (datos, responsable,
 * equipo, archivos, procesos y los formularios de alta abiertos), la agenda de citas (organización y participante) y la
 * administración. NO abre los asistentes de alta (`…/nuevo`): abrirlos contra una base real crea borradores vacíos por
 * autoguardado (`dbo.BorradoresProceso`); sus plantillas se revisan en Karma y en el código. No envía formularios ni crea ni edita nada: solo abre pantallas y, en el perfil público, añade filas de
 * enlace EN PANTALLA (sin guardar) para medir el peor caso (cinco enlaces).
 *
 * Requiere la pila con la siembra de demostración (cuentas con clave `admin`). @backend
 *
 * Variables: `SIMUS_RECORTES_ANCHOS=360,390` y `SIMUS_RECORTES_RUTAS=perfil` filtran la ejecución al depurar.
 */
const CLAVE = 'admin';
const ANCHOS = (process.env.SIMUS_RECORTES_ANCHOS ?? '360,390,768,1024,1280').split(',').map(Number);
const FILTRO = process.env.SIMUS_RECORTES_RUTAS;
const alto = (ancho: number): number => (ancho < 600 ? 800 : ancho < 1100 ? 1000 : 800);

const RUTAS_DEL_PORTAL = [
  '/', '/pnmc', '/noticias', '/agenda', '/editorial', '/galeria', '/ecosistema', '/ecosistema/festivales',
  '/ecosistema/mercados-musicales', '/ecosistema/luteria', '/ecosistema/espacios', '/ecosistema/redes',
  '/ecosistema/agenda-de-citas', '/ecosistema/personas', '/ecosistema/territorios-sonoros',
  '/ecosistema/practicas-musicales', '/ecosistema/invitacion', '/ecosistema/restablecer-contrasena',
  '/politicas/privacidad', '/ingresar', '/registro',
];
const RUTAS_DE_LA_CUENTA = [
  '/gestion/cuenta', '/gestion/cuenta/solicitudes', '/gestion/cuenta/organizaciones', '/gestion/cuenta/organizaciones/registrar',
  '/gestion/cuenta/procesos', '/gestion/cuenta/perfil-publico', '/gestion/cuenta/datos', '/gestion/cuenta/autorizaciones',
  '/gestion/cuenta/seguridad', '/gestion/cuenta/agenda-de-citas', '/gestion/cuenta/eventos',
];
const SECCIONES_DE_LA_ORGANIZACION = [
  'resumen', 'organizacion', 'responsable', 'archivos', 'herramientas', 'herramientas/procesos-historicos',
  'herramientas/agenda-de-citas', 'procesos', 'procesos/festivales', 'procesos/mercados',
  'procesos/espacios', 'procesos/luteria',
  'procesos/redes', 'eventos', 'solicitudes', 'equipo',
];
const SECCIONES_DE_ADMINISTRACION = [
  'resumen', 'solicitudes', 'organizaciones', 'usuarios', 'festivales', 'mercados', 'noticias', 'agenda', 'procesos',
  'catalogo-editorial', 'banco-de-archivos', 'galeria', 'auditoria', 'analisis', 'sistema',
];

/** Excepciones documentadas: ruta (fragmento) → motivo. Nada se agrega aquí sin explicar por qué es intencional. */
const EXCEPCIONES: { ruta: RegExp; tipo: HallazgoDeRecorte['tipo']; elemento: RegExp; motivo: string }[] = [];

function sinExcepciones(ruta: string, hallazgos: HallazgoDeRecorte[]): HallazgoDeRecorte[] {
  return hallazgos.filter(h => !EXCEPCIONES.some(e => e.ruta.test(ruta) && e.tipo === h.tipo && e.elemento.test(h.elemento)));
}

async function entrar(browser: Browser, email: string, ancho: number): Promise<{ contexto: BrowserContext; page: Page }> {
  const contexto = await browser.newContext({ viewport: { width: ancho, height: alto(ancho) }, hasTouch: ancho < 1100, isMobile: ancho < 600 });
  await contexto.addInitScript(correo => window.localStorage.setItem(`pnmc_tour_seen_${correo}`, '1'), email);
  const page = await contexto.newPage();
  const api = '/api/v1/externo/auth';
  const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
  const r = await postConCupo(page.request, `${api}/login`, { headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: { email, password: CLAVE } });
  expect(r.status(), `la cuenta ${email} tiene que poder entrar`).toBe(200);
  return { contexto, page };
}

async function revisar(page: Page, ruta: string, acumulado: string[], antes?: (p: Page) => Promise<void>): Promise<void> {
  if (FILTRO && !ruta.includes(FILTRO)) return;
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  if (antes) await antes(page);
  const hallazgos = sinExcepciones(ruta, await recortesDe(page));
  for (const h of hallazgos) acumulado.push(`${ruta} · ${h.tipo} · ${h.elemento} · ${h.detalle}`);
}

/** En el perfil público, añade en pantalla (sin guardar) los cinco enlaces, con la red «otro» con rótulo: el peor caso. */
async function llenarEnlacesEnPantalla(page: Page): Promise<void> {
  await page.waitForSelector('[data-enlaces]', { timeout: 15_000 }).catch(() => undefined);
  for (let i = 0; i < 6; i++) {
    const anadir = page.locator('[data-anadir-enlace]');
    if (!(await anadir.count())) break;
    await anadir.click();
    const opcion = page.locator('[data-elegir-red] button:not([disabled])').first();
    if (!(await opcion.count())) break;
    await opcion.click();
  }
}

for (const ancho of ANCHOS) {
  test.describe(`Sin recortes ni desbordes a ${ancho} px`, { tag: '@backend' }, () => {
    test.describe.configure({ timeout: 600_000 });

    test('portal público', async ({ browser }) => {
      const contexto = await browser.newContext({ viewport: { width: ancho, height: alto(ancho) }, hasTouch: ancho < 1100, isMobile: ancho < 600 });
      const page = await contexto.newPage();
      const fallos: string[] = [];
      for (const ruta of RUTAS_DEL_PORTAL) await revisar(page, ruta, fallos);
      await contexto.close();
      expect(fallos, `Recortes o desbordes a ${ancho} px:\n${fallos.join('\n')}`).toEqual([]);
    });

    test('Mi espacio y panel de la organización (responsable de la organización)', async ({ browser }) => {
      const { contexto, page } = await entrar(browser, 'camila.restrepo@simus.test', ancho);
      const yo = await (await page.request.get('/api/v1/externo/auth/me')).json();
      const organizaciones = (yo.organizaciones ?? yo.organizations) as { id: string; name?: string }[];
      const id = (organizaciones.find(o => (o.name ?? '').includes('Sonora Andina')) ?? organizaciones[0]).id;
      const fallos: string[] = [];
      for (const ruta of RUTAS_DE_LA_CUENTA) await revisar(page, ruta, fallos, ruta.endsWith('/perfil-publico') ? llenarEnlacesEnPantalla : undefined);
      for (const seccion of SECCIONES_DE_LA_ORGANIZACION) await revisar(page, `/gestion/o/${id}/${seccion}`, fallos);
      await contexto.close();
      expect(fallos, `Recortes o desbordes a ${ancho} px:\n${fallos.join('\n')}`).toEqual([]);
    });

    test('agenda de citas (organización y participante)', async ({ browser }) => {
      const fallos: string[] = [];
      const org = await entrar(browser, 'camila.restrepo@simus.test', ancho);
      const yo = await (await org.page.request.get('/api/v1/externo/auth/me')).json();
      const organizaciones = (yo.organizaciones ?? yo.organizations) as { id: string; name?: string }[];
      const id = (organizaciones.find(o => (o.name ?? '').includes('Sonora Andina')) ?? organizaciones[0]).id;
      const agendas = await (await org.page.request.get(`/api/v1/externo/organizaciones/${id}/agendas-de-citas`)).json();
      const abierta = (agendas as { agendaId?: string; mercadoId?: string; agendaEstado?: string }[]).find(a => a.agendaEstado === 'abierta') ?? (agendas as { agendaId?: string; mercadoId?: string }[])[0];
      if (abierta?.agendaId) {
        const base = `/gestion/o/${id}/procesos/mercados/${abierta.mercadoId}/agenda-de-citas/${abierta.agendaId}`;
        for (const vista of ['resumen', 'participantes', 'parrilla', 'calendario', 'franjas', 'citas', 'configuracion']) {
          await revisar(org.page, `${base}?vista=${vista}`, fallos);
        }
      }
      await org.contexto.close();
      for (const correo of ['eliecer.rios@simus.test', 'margarita.buelvas@simus.test']) {
        const { contexto, page } = await entrar(browser, correo, ancho);
        await revisar(page, '/gestion/cuenta/agenda-de-citas', fallos);
        const href = await page.evaluate(() => document.querySelector('a[href*="/agenda-de-citas/"]')?.getAttribute('href') ?? null);
        if (href) {
          await revisar(page, href, fallos);
          const pestanas = await page.locator('[data-pestana]').evaluateAll(l => l.map(e => e.getAttribute('data-pestana') ?? ''));
          for (const p of pestanas) {
            await page.locator(`[data-pestana="${p}"]`).click().catch(() => undefined);
            const h = sinExcepciones(`${href}#${p}`, await recortesDe(page));
            for (const x of h) fallos.push(`${correo} ${href} [${p}] · ${x.tipo} · ${x.elemento} · ${x.detalle}`);
          }
        }
        await contexto.close();
      }
      expect(fallos, `Recortes o desbordes a ${ancho} px:\n${fallos.join('\n')}`).toEqual([]);
    });

    test('administración', async ({ browser }) => {
      const contexto = await browser.newContext({ viewport: { width: ancho, height: alto(ancho) }, hasTouch: ancho < 1100, isMobile: ancho < 600 });
      const correo = 'webmaster@simus.test';
      await contexto.addInitScript(c => window.localStorage.setItem(`pnmc_tour_seen_${c}`, '1'), correo);
      const page = await contexto.newPage();
      await page.goto('/administracion', { waitUntil: 'domcontentloaded' });
      await page.locator('input[type="email"]').fill(correo);
      await page.locator('input[type="password"]').fill(CLAVE);
      await page.getByRole('button', { name: 'Entrar al panel' }).click();
      // En el teléfono la barra lateral es un cajón cerrado: se espera a que desaparezca el formulario de acceso.
      await expect(page.locator('input[type="password"]')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator('#navegacion-administrativa')).toBeAttached();
      const fallos: string[] = [];
      for (const seccion of SECCIONES_DE_ADMINISTRACION) await revisar(page, `/administracion/${seccion}`, fallos);
      await contexto.close();
      expect(fallos, `Recortes o desbordes a ${ancho} px:\n${fallos.join('\n')}`).toEqual([]);
    });
  });
}
