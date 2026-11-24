import { Page, expect, test } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';
import { TOLERANCIA_DE_TEXTO, medir } from './apoyo/barra-superior';

/**
 * LA BARRA SUPERIOR NUNCA TAPA CONTENIDO (punto 31 del mapa de comentarios; ya había pasado dos veces).
 *
 * <b>La regla estructural que esta prueba vigila:</b> el armazón del portal (`PortalLayoutComponent`) reserva por su cuenta el
 * alto de la barra fija (`--alto-barra-superior`, clase `reserva-de-barra` de `styles.css`) en TODA pantalla que no declare
 * en su ruta `data: { barraSuperior: 'propia' }` (la pantalla pone el alto ella misma: un encabezado fotográfico o su propio
 * margen). Una pantalla nueva queda bien sin acordarse de nada. Los armazones propios de gestión (Mi espacio, panel de una
 * organización, consola) traen su cabecera dentro del flujo y no pueden quedar tapados; `/gestion/entrada`, que sí lleva la
 * barra pública, usa la misma clase.
 *
 * <b>Qué mide.</b> Con la página arriba del todo, el primer contenido visible (texto, imagen o control, sin contar lo fijo ni
 * lo oculto) tiene que empezar por debajo del borde inferior de la barra. Se recorre cada ruta de la gestión externa, las
 * pantallas del portal que se abren sin sesión y las pantallas de enlace por correo, a 1440 y a 390 píxeles.
 *
 * Requiere la base con la siembra de demostración (cuentas `lucia.ramirez@cantaclaro.test` y `camilo.rojas@llanoadentro.test`,
 * contraseña `admin`) y la pila levantada. @backend
 */
const CUENTA = { email: 'lucia.ramirez@cantaclaro.test', password: 'admin' };
const TAMANOS = [{ ancho: 1440, alto: 900 }, { ancho: 390, alto: 844 }];

/** Pantallas del portal y de enlaces por correo, que se abren sin sesión. */
const RUTAS_PUBLICAS = [
  '/', '/pnmc', '/noticias', '/agenda', '/editorial', '/galeria',
  '/ecosistema', '/ecosistema/festivales', '/ecosistema/mercados-musicales', '/ecosistema/luteria', '/ecosistema/espacios',
  '/ecosistema/redes', '/ecosistema/agenda-de-citas', '/ecosistema/personas', '/ecosistema/territorios-sonoros',
  '/ecosistema/practicas-musicales', '/ecosistema/confirmar-correo', '/ecosistema/confirmar-boletin', '/ecosistema/baja-boletin',
  '/ecosistema/invitacion', '/ecosistema/invitacion-agenda', '/ecosistema/restablecer-contrasena',
  '/politicas/privacidad', '/ingresar', '/registro', '/ruta-que-no-existe',
];

/** Las pantallas de la gestión externa que cuelgan de una organización (`/gestion/o/{id}/…`). */
const SECCIONES_DE_LA_ORGANIZACION = [
  'resumen', 'organizacion', 'responsable', 'archivos', 'herramientas', 'herramientas/procesos-historicos',
  'herramientas/agenda-de-citas', 'procesos', 'procesos/festivales', 'procesos/mercados', 'procesos/espacios',
  'procesos/luteria', 'procesos/redes', 'eventos', 'solicitudes', 'equipo',
];

/** Las del espacio personal (`/gestion/cuenta/…`) y la entrada. */
const RUTAS_DE_LA_CUENTA = [
  '/gestion/entrada', '/gestion/cuenta', '/gestion/cuenta/solicitudes', '/gestion/cuenta/organizaciones',
  '/gestion/cuenta/organizaciones/registrar', '/gestion/cuenta/procesos', '/gestion/cuenta/perfil-publico',
  '/gestion/cuenta/datos', '/gestion/cuenta/autorizaciones', '/gestion/cuenta/seguridad', '/gestion/cuenta/agenda-de-citas',
  '/gestion/cuenta/herramientas/procesos-historicos', '/gestion/cuenta/eventos',
];

async function esperarPantalla(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

for (const { ancho, alto } of TAMANOS) {
  test.describe(`La barra superior no tapa contenido a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: alto } });

    test('las pantallas del portal y los enlaces por correo empiezan por debajo de la barra', { tag: '@backend' }, async ({ page }) => {
      test.setTimeout(240_000);
      const tapadas: string[] = [];
      for (const ruta of RUTAS_PUBLICAS) {
        await page.goto(ruta, { waitUntil: 'domcontentloaded' });
        await esperarPantalla(page);
        const m = await medir(page);
        if (m.contenidoArriba !== null && m.contenidoArriba < m.barraAbajo - TOLERANCIA_DE_TEXTO) {
          tapadas.push(`${ruta}: «${m.muestra}» empieza en ${Math.round(m.contenidoArriba)} px y la barra llega a ${Math.round(m.barraAbajo)} px`);
        }
      }
      expect(tapadas, `Contenido bajo la barra:\n${tapadas.join('\n')}`).toEqual([]);
    });

    test('toda la gestión externa (entrada, Mi espacio y el panel de la organización) empieza por debajo de la barra', { tag: '@backend' }, async ({ page }) => {
      test.setTimeout(300_000);
      const api = '/api/v1/externo/auth';
      const token = (await (await page.request.get(`${api}/csrf`)).json()).requestToken;
      const entrada = await postConCupo(page.request, `${api}/login`, {
        headers: { 'X-CSRF-TOKEN': token, 'Content-Type': 'application/json' }, data: CUENTA,
      });
      expect(entrada.status(), 'la cuenta de demostración tiene que poder entrar').toBe(200);
      const yo = await (await page.request.get(`${api}/me`)).json();
      const id = (yo.organizaciones ?? yo.organizations)[0].id;

      const rutas = [...RUTAS_DE_LA_CUENTA, ...SECCIONES_DE_LA_ORGANIZACION.map(s => `/gestion/o/${id}/${s}`)];
      const tapadas: string[] = [];
      for (const ruta of rutas) {
        await page.goto(ruta, { waitUntil: 'domcontentloaded' });
        await esperarPantalla(page);
        const m = await medir(page);
        if (m.contenidoArriba === null) { tapadas.push(`${ruta}: no se encontró contenido que medir`); continue; }
        if (m.contenidoArriba < m.barraAbajo - TOLERANCIA_DE_TEXTO) {
          tapadas.push(`${ruta}: «${m.muestra}» empieza en ${Math.round(m.contenidoArriba)} px y la barra llega a ${Math.round(m.barraAbajo)} px`);
        }
      }
      expect(tapadas, `Contenido bajo la barra:\n${tapadas.join('\n')}`).toEqual([]);
    });
  });
}
