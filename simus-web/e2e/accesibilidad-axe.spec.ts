import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * UI-F: pasada automática de accesibilidad (axe-core, WCAG 2.2 AA) sobre las pantallas clave.
 *
 * Recorre el portal, el acceso externo, la consola, el panel de la organización y Mi espacio con las
 * cuentas ficticias de la siembra de demostración; no usa datos reales ni escribe
 * nada: solo navega. Necesita el entorno levantado (`SIMUS_BASE_URL`), como el resto de `e2e/`.
 *
 * Falla ante cualquier violación de impacto «serious» o «critical» que no esté en `ACEPTADAS`, y cada
 * excepción lleva su motivo: una excepción sin motivo es una violación escondida. El informe completo
 * (también lo «moderate» y «minor») se escribe en la carpeta `SIMUS_AXE_INFORME` si se define, para anexarlo a un PR.
 *
 * axe NO sustituye la revisión con teclado y lector de pantalla: encuentra una parte de los fallos
 * (nombres, roles, contraste, etiquetas), no el orden de tabulación ni lo que de verdad se anuncia.
 */

const ETIQUETAS = ['best-practice', 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Excepciones con motivo: `regla` y, si se quiere, un trozo del selector del nodo. */
const ACEPTADAS: { regla: string; nodo?: string; motivo: string }[] = [
  {
    regla: 'color-contrast', nodo: '.leaflet-',
    motivo: 'Capa del mapa (teselas, atribución y rótulos de Leaflet): es contenido cartográfico de terceros, no controles del producto.',
  },
];

const CREDENCIALES = {
  consola: { api: '/api/v1/admin/auth', email: 'webmaster@simus.test' },
  organizacion: { api: '/api/v1/externo/auth', email: 'lucia.ramirez@cantaclaro.test' },
  persona: { api: '/api/v1/externo/auth', email: 'valentina.ocampo@correo.test' },
};

async function entrar(page: Page, quien: keyof typeof CREDENCIALES): Promise<void> {
  const { api, email } = CREDENCIALES[quien];
  const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
  const r = await page.request.post(`${api}/login`, {
    headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' },
    data: { email, password: 'admin' },
  });
  expect(r.status(), `la cuenta ficticia ${email} debe poder entrar (reconstruye la demo con scripts/demo/reconstruir-demo-local.sh)`).toBe(200);
}

async function idDeLaOrganizacion(page: Page): Promise<string> {
  const me = await (await page.request.get('/api/v1/externo/auth/me')).json();
  const org = (me.organizations ?? me.organizaciones ?? [])[0];
  expect(org, 'la cuenta de organización debe responder por una organización').toBeTruthy();
  return String(org.id);
}

interface Pantalla { nombre: string; ruta: string; espera?: string }

const PORTAL: Pantalla[] = [
  { nombre: 'portal-inicio', ruta: '/' },
  { nombre: 'portal-mapa', ruta: '/mapa-ecosistemico', espera: '#mapa-buscar' },
  { nombre: 'portal-mapa-grafico', ruta: '/mapa-ecosistemico?vista=grafico', espera: '#mapa-buscar' },
  { nombre: 'portal-agenda', ruta: '/agenda' },
  { nombre: 'portal-ecosistema', ruta: '/ecosistema' },
  { nombre: 'portal-pnmc', ruta: '/pnmc' },
  { nombre: 'portal-festivales', ruta: '/ecosistema/festivales' },
  { nombre: 'portal-mercados', ruta: '/ecosistema/mercados-musicales' },
  { nombre: 'portal-espacios', ruta: '/ecosistema/espacios' },
  { nombre: 'portal-noticias', ruta: '/noticias' },
  { nombre: 'portal-editorial', ruta: '/editorial' },
  { nombre: 'portal-celebra-la-musica-2026', ruta: '/pnmc/estrategias/celebra-la-musica', espera: '[data-testid="programacion"]' },
  { nombre: 'portal-celebra-la-musica-2025', ruta: '/pnmc/estrategias/celebra-la-musica/2025', espera: '[data-testid="programacion"]' },
  { nombre: 'portal-no-encontrado', ruta: '/esta-ruta-no-existe' },
  { nombre: 'acceso-ingresar', ruta: '/ingresar' },
  { nombre: 'acceso-registro', ruta: '/registro' },
];

const CONSOLA: Pantalla[] = [
  { nombre: 'consola-resumen', ruta: '/administracion' },
  { nombre: 'consola-solicitudes', ruta: '/administracion/solicitudes' },
  { nombre: 'consola-festivales', ruta: '/administracion/festivales' },
  { nombre: 'consola-organizaciones', ruta: '/administracion/organizaciones' },
  { nombre: 'consola-agenda', ruta: '/administracion/agenda' },
  { nombre: 'consola-usuarios', ruta: '/administracion/usuarios' },
  { nombre: 'consola-mercados', ruta: '/administracion/mercados' },
  { nombre: 'consola-procesos', ruta: '/administracion/procesos?tipo=luteria' },
  { nombre: 'consola-noticias', ruta: '/administracion/noticias' },
  { nombre: 'consola-banco-de-archivos', ruta: '/administracion/banco-de-archivos' },
  { nombre: 'consola-galeria', ruta: '/administracion/galeria' },
  { nombre: 'consola-auditoria', ruta: '/administracion/auditoria' },
  { nombre: 'consola-analisis', ruta: '/administracion/analisis' },
  { nombre: 'consola-sistema', ruta: '/administracion/sistema' },
];

const PANEL = (id: string): Pantalla[] => [
  { nombre: 'panel-resumen', ruta: `/gestion/o/${id}/resumen` },
  { nombre: 'panel-organizacion', ruta: `/gestion/o/${id}/organizacion` },
  { nombre: 'panel-festivales', ruta: `/gestion/o/${id}/procesos/festivales` },
  { nombre: 'panel-equipo', ruta: `/gestion/o/${id}/equipo` },
  { nombre: 'panel-archivos', ruta: `/gestion/o/${id}/archivos` },
  { nombre: 'panel-procesos', ruta: `/gestion/o/${id}/procesos` },
  { nombre: 'panel-mercados', ruta: `/gestion/o/${id}/procesos/mercados` },
  { nombre: 'panel-eventos', ruta: `/gestion/o/${id}/eventos` },
  { nombre: 'panel-solicitudes', ruta: `/gestion/o/${id}/solicitudes` },
  { nombre: 'panel-herramientas', ruta: `/gestion/o/${id}/herramientas` },
  { nombre: 'panel-herramientas-agenda-de-citas', ruta: `/gestion/o/${id}/herramientas/agenda-de-citas` },
  { nombre: 'panel-procesos-por-tipo', ruta: `/gestion/o/${id}/procesos?tipo=festivales` },
  { nombre: 'panel-luteria', ruta: `/gestion/o/${id}/procesos/luteria` },
  { nombre: 'panel-espacios', ruta: `/gestion/o/${id}/procesos/espacios` },
  { nombre: 'panel-redes', ruta: `/gestion/o/${id}/procesos/redes` },
];

const MI_ESPACIO: Pantalla[] = [
  { nombre: 'mi-espacio-inicio', ruta: '/gestion/cuenta' },
  { nombre: 'mi-espacio-datos', ruta: '/gestion/cuenta/datos' },
  { nombre: 'mi-espacio-seguridad', ruta: '/gestion/cuenta/seguridad' },
  { nombre: 'mi-espacio-autorizaciones', ruta: '/gestion/cuenta/autorizaciones' },
  { nombre: 'mi-espacio-perfil-publico', ruta: '/gestion/cuenta/perfil-publico' },
  { nombre: 'mi-espacio-organizaciones', ruta: '/gestion/cuenta/organizaciones' },
  { nombre: 'mi-espacio-eventos', ruta: '/gestion/cuenta/eventos' },
  { nombre: 'mi-espacio-procesos', ruta: '/gestion/cuenta/procesos' },
  { nombre: 'mi-espacio-espacios', ruta: '/gestion/cuenta/espacios' },
  { nombre: 'mi-espacio-solicitudes', ruta: '/gestion/cuenta/solicitudes' },
  { nombre: 'mi-espacio-talleres', ruta: '/gestion/cuenta/talleres' },
  { nombre: 'mi-espacio-redes', ruta: '/gestion/cuenta/redes' },
  { nombre: 'mi-espacio-agenda-de-citas', ruta: '/gestion/cuenta/agenda-de-citas' },
];

interface Hallazgo { pantalla: string; regla: string; impacto: string; nodos: string[]; ayuda: string; html: string[]; detalle: string[] }

async function revisar(page: Page, p: Pantalla): Promise<Hallazgo[]> {
  await page.addInitScript(() => {
    try {
      // Sin el recorrido guiado de la primera visita: atenúa y desenfoca todo lo demás y ese estado no es el de uso.
      localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().split('T')[0]);
      for (const k of Object.keys(localStorage)) if (k.startsWith('pnmc_tour_seen_')) localStorage.setItem(k, '1');
    } catch { /* sin almacenamiento */ }
  });
  await page.goto(p.ruta, { waitUntil: 'networkidle' });
  if (p.espera) await page.locator(p.espera).first().waitFor({ state: 'attached', timeout: 20_000 }).catch(() => undefined);
  // Sin animaciones a medias: una entrada con opacidad parcial da contrastes que nadie ve.
  await page.waitForFunction(() => document.getAnimations().every(x => x.playState !== 'running' || x.effect?.getTiming().iterations === Infinity), undefined, { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  // Una transición de color que arranca tras el primer chequeo (la pestaña «Todos» pasa a seleccionada cuando llegan los
  // conteos) se medía a medias —#667081 sobre #eee9ef, 4,17:1— y el fallo iba y venía con la carga. Se esperan hasta que no
  // quede ninguna transición ni animación finita en curso, dos cuadros seguidos, y solo entonces se mide.
  await page.evaluate(async () => {
    const enCurso = () => document.getAnimations().filter(x => x.effect?.getTiming().iterations !== Infinity && x.playState !== 'finished');
    for (let quietos = 0; quietos < 2;) {
      const pendientes = enCurso();
      if (pendientes.length) { await Promise.allSettled(pendientes.map(x => x.finished)); quietos = 0; }
      else quietos++;
      await new Promise(r => requestAnimationFrame(() => r(null)));
    }
  });
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS)
    .analyze();
  // axe da por bueno un campo cuyo único nombre es el `placeholder` (`non-empty-placeholder`), y no lo es: desaparece al
  // escribir. Aquí se exige `<label for>`, `aria-label`, `aria-labelledby` o `title`.
  const sinNombre: string[] = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')]
    .filter(e => (e as HTMLElement).offsetParent !== null)
    .filter(e => !(e as HTMLInputElement).labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.getAttribute('title'))
    .map(e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}[placeholder="${e.getAttribute('placeholder') ?? ''}"]`));
  const propios: Hallazgo[] = sinNombre.length
    ? [{ pantalla: p.nombre, regla: 'campo-sin-nombre-mas-que-placeholder', impacto: 'serious', ayuda: 'El campo solo tiene el placeholder como nombre', nodos: sinNombre, html: [], detalle: [] }]
    : [];
  return propios.concat(resultado.violations.map(v => ({
    pantalla: p.nombre,
    regla: v.id,
    impacto: v.impact ?? 'minor',
    ayuda: v.help,
    ...(() => {
      const nodos = v.nodes.filter(n => !ACEPTADAS.some(a => a.regla === v.id && (!a.nodo || n.target.join(' ').includes(a.nodo))));
      return { nodos: nodos.map(n => n.target.join(' ')), html: nodos.map(n => n.html.slice(0, 300)), detalle: nodos.map(n => (n.failureSummary ?? '').replace(/\s+/g, ' ')) };
    })(),
  }))).filter(h => h.nodos.length > 0);
}

function describir(h: Hallazgo[]): string {
  return h.map(x => `[${x.impacto}] ${x.pantalla}: ${x.regla} (${x.ayuda}) → ${x.nodos.slice(0, 4).join(' | ')}`).join('\n');
}


/** El informe completo de un grupo (también lo moderado y lo menor) en la carpeta `SIMUS_AXE_INFORME`. */
function guardarInforme(titulo: string, hallazgos: Hallazgo[]): void {
  const carpeta = process.env.SIMUS_AXE_INFORME;
  if (!carpeta) return;
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, `${titulo.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`), JSON.stringify(hallazgos, null, 2));
}

function grupo(titulo: string, quien: keyof typeof CREDENCIALES | null, pantallas: Pantalla[] | ((page: Page) => Promise<Pantalla[]>)): void {
  test(`axe: ${titulo} no tiene violaciones graves`, async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    if (quien) await entrar(page, quien);
    const todas: Hallazgo[] = [];
    for (const p of typeof pantallas === 'function' ? await pantallas(page) : pantallas) todas.push(...await revisar(page, p));
    guardarInforme(titulo, todas);
    const graves = todas.filter(h => h.impacto === 'serious' || h.impacto === 'critical');
    expect(graves, `Violaciones graves de accesibilidad:\n${describir(graves)}`).toEqual([]);
    await page.context().close();
  });
}

grupo('el portal y el acceso externo', null, PORTAL);
grupo('la consola', 'consola', CONSOLA);
grupo('el panel de la organización', 'organizacion', async page => PANEL(await idDeLaOrganizacion(page)));
grupo('Mi espacio', 'persona', MI_ESPACIO);
