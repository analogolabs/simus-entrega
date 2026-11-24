import { Page, expect, test } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * GESTIÓN EXTERNA, CUENTA Y AGENDA DE CITAS: SIN DESBORDE HORIZONTAL en teléfono, tableta y escritorio (carril responsive-gestion).
 *
 * Por cada ruta y cada tamaño comprueba que la página no se ensancha más que la ventana (`scrollWidth <= innerWidth`) y que ningún
 * elemento visible asoma por la derecha fuera de un contenedor con desplazamiento propio. Solo lee: no crea ni edita nada.
 * Requiere la demostración integral sembrada (cuenta `camila.restrepo@simus.test`, clave `admin`). @backend
 */
const CLAVE = process.env.SIMUS_EXTERNO_PASSWORD ?? 'admin';
const TAMANOS = [
  { n: 'teléfono 360', ancho: 360, alto: 740 }, { n: 'teléfono 390', ancho: 390, alto: 844 }, { n: 'teléfono apaisado', ancho: 844, alto: 390 },
  { n: 'tableta 768', ancho: 768, alto: 1024 }, { n: 'tableta 1024', ancho: 1024, alto: 768 },
  { n: 'portátil 1280', ancho: 1280, alto: 720 }, { n: 'escritorio 1440', ancho: 1440, alto: 900 }, { n: 'escritorio 1920', ancho: 1920, alto: 1080 },
];
const CUENTA = [
  '/gestion/entrada', '/gestion/cuenta', '/gestion/cuenta/solicitudes', '/gestion/cuenta/organizaciones', '/gestion/cuenta/organizaciones/registrar',
  '/gestion/cuenta/procesos', '/gestion/cuenta/perfil-publico', '/gestion/cuenta/datos', '/gestion/cuenta/autorizaciones', '/gestion/cuenta/seguridad',
  '/gestion/cuenta/agenda-de-citas', '/gestion/cuenta/eventos',
];
const ORGANIZACION = [
  'resumen', 'organizacion', 'responsable', 'archivos', 'herramientas', 'procesos/festivales', 'procesos/mercados', 'procesos/espacios',
  'procesos/luteria', 'procesos/redes', 'eventos', 'solicitudes', 'equipo', 'herramientas/agenda-de-citas', 'herramientas/procesos-historicos',
];

/** Cuánto se sale la página por la derecha y qué elementos lo provocan (los que no están dentro de un contenedor con desplazamiento). */
async function medirDesborde(page: Page): Promise<{ exceso: number; culpables: string[] }> {
  return page.evaluate(() => {
    const ancho = window.innerWidth;
    const dentroDeScroll = (e: Element): boolean => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
      }
      return false;
    };
    const culpables: string[] = [];
    for (const e of Array.from(document.querySelectorAll('body *'))) {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      if (r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.position !== 'fixed' && r.right > ancho + 1 && !dentroDeScroll(e)) {
        culpables.push(`${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).trim().split(/\s+/).slice(0, 2).join('.')} (der ${Math.round(r.right)})`);
      }
    }
    return { exceso: Math.max(0, document.documentElement.scrollWidth - ancho), culpables: culpables.slice(0, 4) };
  });
}

for (const t of TAMANOS) {
  test.describe(`Sin desborde horizontal en ${t.n} (${t.ancho}×${t.alto})`, () => {
    test.use({ viewport: { width: t.ancho, height: t.alto }, hasTouch: t.ancho < 1100, isMobile: t.ancho < 1100 });

    test('Mi espacio, el panel de la organización y la agenda de citas caben en la ventana', { tag: '@backend' }, async ({ page }) => {
      test.setTimeout(420_000);
      const api = '/api/v1/externo';
      const token = (await (await page.request.get(`${api}/auth/csrf`)).json()).requestToken;
      const entrada = await postConCupo(page.request, `${api}/auth/login`, {
        headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: { email: 'camila.restrepo@simus.test', password: CLAVE },
      });
      expect(entrada.status(), 'la cuenta de demostración tiene que poder entrar').toBe(200);
      const yo = await (await page.request.get(`${api}/auth/me`)).json();
      const org = (yo.organizations as { id: number; name: string }[]).find(o => o.name.includes('Sonora Andina')) ?? yo.organizations[0];
      const rutas = [...CUENTA, ...ORGANIZACION.map(s => `/gestion/o/${org.id}/${s}`)];

      const ediciones = await (await page.request.get(`${api}/organizaciones/${org.id}/agendas-de-citas`)).json() as { mercadoId: number; agendaId: number | null; agendaEstado: string | null }[];
      const abierta = ediciones.find(e => e.agendaEstado === 'abierta');
      if (abierta) {
        const base = `/gestion/o/${org.id}/procesos/mercados/${abierta.mercadoId}/agenda-de-citas/${abierta.agendaId}`;
        for (const v of ['', '?vista=participantes', '?vista=parrilla', '?vista=calendario', '?vista=franjas', '?vista=citas', '?vista=configuracion']) rutas.push(base + v);
      }

      const ensanchadas: string[] = [];
      for (const ruta of rutas) {
        await page.goto(ruta, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(400);
        const m = await medirDesborde(page);
        if (m.exceso > 1 || m.culpables.length) ensanchadas.push(`${ruta}: +${m.exceso} px; ${m.culpables.join(', ')}`);
      }
      expect(ensanchadas, `Pantallas que se salen de la ventana a ${t.ancho} px:\n${ensanchadas.join('\n')}`).toEqual([]);
    });
  });
}
