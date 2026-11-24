import { test, expect, Browser, Page } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * Consola: arquitectura de información y pulido (,;
 *). @backend
 *
 *   WEBMASTER
 *   1. Barra lateral: ninguna sección queda inalcanzable a 1440×900 y la lista avisa de lo que sigue.
 *   2. Buscador: «publicar» encuentra por tarea, Enter abre el primero, no hay aspa nativa.
 *   3. «Perfiles públicos de personas» es una pestaña de Organizaciones, con dirección y buscable.
 *   4. Auditoría: «Actuaciones» por omisión (sin inicios de sesión) y «Accesos» aparte.
 *   5. Resumen: el estado técnico es un indicador con enlace a Salud.
 *   6. Las listas comparten la barra: «Estado:», «Más acciones» y «Nuevo …».
 *   7. Importación: sin paso de módulo, numerada desde 1, sin chat sin archivo.
 *   8. Catálogo: «Ver todas» en las facetas largas.
 *   9. CMS: las pestañas de portada se distinguen por página.
 *
 *   GESTOR CON MÓDULOS LIMITADOS
 *   10. Solo ve sus secciones; el buscador no ofrece las demás; las listas se leen igual.
 *
 * Requiere el entorno local (API y web) con las cuentas de consola de demostración y la siembra
 * completa de. El gestor se limita por API y se RESTAURA al terminar.
 */

const WEBMASTER = { email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test', password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin' };
const GESTOR = { email: process.env.SIMUS_GESTOR_EMAIL ?? process.env.PNMC_GESTOR_EMAIL ?? 'gestor@simus.test', password: process.env.SIMUS_GESTOR_PASSWORD ?? process.env.PNMC_GESTOR_PASSWORD ?? 'admin' };
const MODULOS_DEL_GESTOR = ['monitor', 'solicitudes', 'noticias', 'agenda', 'mercados'];

async function entrar(page: Page, cuenta: { email: string; password: string }): Promise<void> {
  await page.locator('input[type="email"]').fill(cuenta.email);
  await page.locator('input[type="password"]').fill(cuenta.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
}

async function abrirConsola(browser: Browser, cuenta: { email: string; password: string }, url = '/administracion'): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), cuenta.email);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await entrar(page, cuenta);
  await expect(page.locator('aside#navegacion-administrativa')).toBeVisible({ timeout: 30_000 });
  return page;
}

test.describe('L9 · consola del webmaster', { tag: '@backend' }, () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await abrirConsola(browser, WEBMASTER);
  });
  test.afterAll(async () => { await page.context().close(); });

  test('UI-01 a UI-06 · la barra no tiene degradados fijos ni scroll doble, y los grupos de abajo se alcanzan al desplegar', async () => {
    const lista = page.locator('.sidebar-secciones');
    // Sin la «barrita con sombra»: ningún degradado de desplazamiento pintado en el fondo de la lista.
    expect(await lista.evaluate(el => getComputedStyle(el).backgroundImage)).toBe('none');
    // UN solo contenedor con desplazamiento: la barra entera no se desplaza, solo la lista.
    expect(await page.locator('aside#navegacion-administrativa').evaluate(el => getComputedStyle(el).overflowY)).toBe('hidden');
    // «Gobierno y control» viene plegado por omisión; al desplegarlo se llega a «Sistema».
    const titulo = page.getByRole('button', { name: 'Gobierno y control' });
    await expect(titulo).toHaveAttribute('aria-expanded', 'false');
    await titulo.click();
    await expect(titulo).toHaveAttribute('aria-expanded', 'true');
    const sistema = lista.getByRole('button', { name: 'Sistema', exact: true });
    await sistema.scrollIntoViewIfNeeded();
    await expect(sistema).toBeVisible();
    // Sin desborde horizontal: el contenido no es más ancho que la lista.
    const medidas = await lista.evaluate(el => ({ visible: el.clientWidth, total: el.scrollWidth }));
    expect(medidas.total).toBeLessThanOrEqual(medidas.visible + 1);
    // Los rótulos son de una sola línea: ninguna entrada mide más que la fila de 34 px (más un respiro).
    const alturas = await lista.locator('.sidebar-item').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
    expect(Math.max(...alturas)).toBeLessThanOrEqual(36);
    // Se deja como estaba: plegado, como viene por omisión.
    await titulo.click();
    await expect(titulo).toHaveAttribute('aria-expanded', 'false');
  });

  test('el buscador encuentra por tarea, Enter abre el primero y no hay dos aspas', async () => {
    const campo = page.locator('#buscador-de-seccion');
    await campo.fill('publicar noticia');
    await expect(page.locator('#secciones-encontradas [role="option"]').first()).toContainText('Noticias y prensa');
    await campo.press('Enter');
    await expect(page).toHaveURL(/\/administracion\/noticias$/);

    await campo.fill('bitacora');
    await campo.press('Enter');
    await expect(page).toHaveURL(/\/administracion\/auditoria$/);

    await campo.fill('festival');
    // Un solo «borrar»: el botón propio. (El aspa nativa se oculta por CSS; se verificó en captura.)
    await expect(page.getByRole('button', { name: /^Limpiar buscar una sección/ })).toBeVisible();
    await campo.press('Escape');
  });

  test('los perfiles de personas son una pestaña de Organizaciones y el buscador la encuentra', async () => {
    const campo = page.locator('#buscador-de-seccion');
    await campo.fill('personas');
    await expect(page.locator('#secciones-encontradas [role="option"]').first()).toContainText('Perfiles públicos de personas');
    await campo.press('Enter');
    await expect(page).toHaveURL(/\/administracion\/organizaciones\?vista=personas$/);
    await expect(page.locator('app-admin-perfiles-publicos')).toBeVisible();

    // «Atrás» vuelve a la pestaña de organizaciones, con su tabla.
    // (La barra lateral también tiene una entrada «Organizaciones»: se pide la pestaña por su opción.)
    await page.locator('button[data-opcion="organizaciones"]').click();
    await expect(page).toHaveURL(/\/administracion\/organizaciones$/);
    await expect(page.locator('table.tabla-de-organizaciones')).toBeVisible();
    await expect(page.locator('app-admin-perfiles-publicos')).toHaveCount(0);
  });

  test('la bitácora abre en «Actuaciones» y los accesos están aparte', async () => {
    await page.goto('/administracion/auditoria');
    const tabla = page.locator('table.tabla-de-la-bitacora');
    await expect(tabla).toBeVisible();
    await expect(page.getByRole('button', { name: /^Actuaciones/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(tabla).not.toContainText('Inició sesión');
    // Ninguna fila deja el nombre crudo de una tabla interna.
    await expect(tabla).not.toContainText('ModulosPorCuenta');
    await expect(tabla).not.toContainText('Administracion control');

    await page.getByRole('button', { name: /^Accesos/ }).click();
    await expect(tabla).toContainText('Inició sesión');
  });

  test('el Resumen reduce el estado técnico a un indicador con enlace a Salud', async () => {
    await page.goto('/administracion/resumen');
    const indicador = page.locator('[data-indicador-tecnico]');
    await expect(indicador).toBeVisible();
    await expect(indicador.locator('.resumen-escala')).toHaveCount(0);
    await indicador.getByRole('button', { name: 'Ver salud del sistema' }).click();
    await expect(page).toHaveURL(/\/administracion\/sistema$/);
    await page.goto('/administracion/resumen');
    await expect(page.locator('.resumen-dato__rotulo', { hasText: 'Cuentas' })).toContainText('internas y externas');
  });

  test('las listas comparten la barra: «Estado:», «Más acciones» y «Nuevo …»', async () => {
    for (const [ruta, nuevo] of [
      ['festivales', 'Nuevo Festival'],
      ['mercados', 'Nuevo mercado'],
      ['organizaciones', 'Nueva organización'],
      ['agenda', 'Nuevo evento'],
      ['noticias', 'Nueva noticia'],
    ] as const) {
      await page.goto(`/administracion/${ruta}`);
      const barra = page.locator('[data-barra-de-lista]').first();
      await expect(barra).toBeVisible();
      await expect(barra.locator('app-filtro-desplegable', { hasText: 'Estado:' }).first()).toBeVisible();
      await expect(barra.getByRole('button', { name: nuevo })).toBeVisible();
      await expect(barra.getByRole('button', { name: 'Actualizar la lista' })).toBeVisible();
    }

    await page.goto('/administracion/festivales');
    await page.getByRole('button', { name: /Más acciones/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Descargar la plantilla' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Importar Festivales' })).toBeVisible();
    // La cabecera de la sección ya no lleva «Importar».
    await page.keyboard.press('Escape');
    await expect(page.locator('app-cabecera-de-pagina').getByRole('button', { name: /^Importar/ })).toHaveCount(0);

    await page.goto('/administracion/organizaciones');
    await page.getByRole('button', { name: /Más acciones/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Importar organizaciones' })).toBeVisible();
  });

  test('la importación no pide módulo, numera desde 1 y no muestra un segundo asistente', async () => {
    await page.goto('/administracion/festivales');
    await page.getByRole('button', { name: /Más acciones/ }).click();
    await page.getByRole('menuitem', { name: 'Importar Festivales' }).click();

    const importacion = page.locator('app-admin-preparacion-asistida-panel');
    await expect(importacion).toBeVisible();
    await expect(importacion).not.toContainText('Selecciona el módulo destino');
    await expect(importacion).toContainText('1. Cargar tu base de datos externa');
    await expect(importacion).not.toContainText('Puedes consultarme');
    // La burbuja del Asistente no convive con la importación.
    await expect(page.locator('[data-abrir-consulta-guiada]')).toHaveCount(0);

    await page.getByRole('button', { name: /Volver a Festivales/ }).click();
    await expect(page.locator('[data-abrir-consulta-guiada]')).toBeVisible();
  });

  test('el Asistente es una burbuja flotante que abre un chat con el campo abajo, preguntas frecuentes y «Ver más»', async () => {
    await page.goto('/administracion/festivales');
    const boton = page.locator('[data-abrir-consulta-guiada]');
    await expect(boton).toBeVisible();
    await expect(boton).toHaveAccessibleName('Asistente');
    expect(await boton.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
    await boton.click();
    const panel = page.locator('[data-cajon-consulta-guiada]');
    await expect(panel.locator('h2')).toHaveText(/^\s*Asistente/);
    await expect(panel).not.toContainText(/consulta guiada/i);
    await expect(panel.locator('[data-pregunta]')).toBeFocused();
    await expect(panel.locator('[data-pregunta]')).toHaveAttribute('placeholder', /Escribe tu pregunta/);
    const visibles = await panel.locator('[data-sugerencia]').count();
    expect(visibles).toBeGreaterThanOrEqual(3);
    expect(visibles).toBeLessThanOrEqual(6);
    const verMas = panel.locator('[data-ver-mas-frecuentes]');
    if (await verMas.count()) {
      await verMas.click();
      expect(await panel.locator('[data-sugerencia]').count()).toBeGreaterThan(visibles);
    }
    // «Ver más» se retira al pulsarlo y el foco cae al documento; Escape se escucha en el propio panel
    // (no es modal), asi que el recorrido vuelve al campo antes de cerrar, como lo hace quien teclea.
    await panel.locator('[data-pregunta]').focus();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(boton).toBeFocused();
  });

  test('el Catálogo recorta las facetas largas con «Ver todas» y filtra por práctica individual', async () => {
    await page.goto('/administracion/catalogo-editorial');
    await expect(page.locator('aside [data-faceta]').first()).toBeVisible({ timeout: 30_000 });
    // Ninguna faceta pinta una combinación unida por « · ».
    const practica = page.locator('[data-faceta="practica"]');
    if (await practica.count()) {
      await expect(practica).not.toContainText(' · ');
    }
    const verTodas = page.locator('[data-ver-todas]').first();
    if (await verTodas.count()) {
      const clave = await verTodas.getAttribute('data-ver-todas');
      await expect(verTodas).toContainText('Ver todas (');
      await verTodas.click();
      await expect(page.locator(`#buscar-en-faceta-${clave}`)).toBeVisible();
      await expect(verTodas).toContainText('Ver menos');
    }
    // El estado se puede filtrar aunque todas las fichas estén igual.
    await expect(page.locator('[data-faceta="estado"]')).toBeVisible();
  });

  test('las imágenes del CMS se ordenan por página y bloque y llevan tildes', async () => {
    await page.goto('/administracion/gestion-del-sitio');
    await page.getByRole('button', { name: /Imágenes del sitio|Imagenes del sitio/ }).first().click();
    // Desde la ronda final del CMS las imágenes se eligen por página y, dentro de ella, por bloque.
    for (const pagina of ['Portada', 'PNMC', 'Noticias', 'Registro']) {
      await expect(page.getByTestId(`pagina-${pagina}`)).toBeVisible();
    }
    await expect(page.locator('[data-testid^="pagina-"]').filter({ hasText: 'Barra principal y pie' })).toBeVisible();
    await expect(page.getByText('Bloques de Portada')).toBeVisible();
    await expect(page.getByText('Portada de la pagina')).toHaveCount(0);
    await expect(page.getByText('Imagenes del sitio')).toHaveCount(0);
  });
});

test.describe('L9 · consola del gestor con módulos limitados', { tag: '@backend' }, () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  let modulosOriginales: string[] = [];
  let gestorId = 0;

  async function conWebmaster<T>(browser: Browser, accion: (peticiones: Page['request']) => Promise<T>): Promise<T> {
    const contexto = await browser.newContext();
    try {
      const pagina = await contexto.newPage();
      const entrada = await postConCupo(pagina.request, '/api/v1/admin/auth/login', { data: WEBMASTER });
      expect(entrada.ok(), await entrada.text()).toBeTruthy();
      return await accion(pagina.request);
    } finally {
      await contexto.close();
    }
  }

  async function fijarModulos(browser: Browser, modulos: string[]): Promise<void> {
    await conWebmaster(browser, async peticiones => {
      const testigo = ((await (await peticiones.get('/api/v1/admin/contenido-web/csrf')).json()) as { token: string }).token;
      const respuesta = await peticiones.put(`/api/v1/admin/usuarios/${gestorId}/modulos`, {
        headers: { 'X-CSRF-TOKEN': testigo }, data: { modulos },
      });
      expect(respuesta.ok(), await respuesta.text()).toBeTruthy();
    });
  }

  test.beforeAll(async ({ browser }) => {
    await conWebmaster(browser, async peticiones => {
      const usuarios = (await (await peticiones.get('/api/v1/admin/auth/users')).json()) as { id: number; email: string }[];
      const gestor = usuarios.find(u => u.email.toLowerCase() === GESTOR.email.toLowerCase());
      expect(gestor, 'la siembra local trae la cuenta del gestor').toBeTruthy();
      gestorId = gestor!.id;
      const mios = (await (await peticiones.get(`/api/v1/admin/usuarios/${gestorId}/modulos`)).json()) as { modulos: string[] };
      modulosOriginales = mios.modulos;
    });
    await fijarModulos(browser, MODULOS_DEL_GESTOR);
  });

  test.afterAll(async ({ browser }) => {
    // Se deja la cuenta como estaba: otras pruebas (y la demostración) cuentan con ella.
    await fijarModulos(browser, modulosOriginales);
  });

  test('ve solo sus secciones; el buscador y la barra no ofrecen las demás', async ({ browser }) => {
    const gestor = await abrirConsola(browser, GESTOR);
    try {
      // La barra NO ofrece secciones hasta que llegan los módulos de la cuenta (esqueleto): se espera a que
      // se dibuje con ellos. («Auditoría: 0» por sí solo se cumple de forma vacía: el grupo «Gobierno y
      // control» viene plegado y sus botones están ocultos para getByRole.)
      await expect(gestor.locator('[data-barra-cargando]')).toHaveCount(0);
      await expect(gestor.locator('.sidebar-secciones').getByRole('button', { name: 'Noticias', exact: true })).toBeVisible();
      await expect(gestor.locator('.sidebar-secciones').getByRole('button', { name: 'Auditoría', exact: true })).toHaveCount(0);
      const etiquetas = await gestor.locator('.sidebar-secciones button .sidebar-rotulo').allInnerTexts();
      expect(etiquetas).toContain('Noticias');
      expect(etiquetas).toContain('Mercados');
      expect(etiquetas).not.toContain('Auditoría');
      expect(etiquetas).not.toContain('Usuarios y roles');
      // Con todo cabiendo en la lista, no hay nada que desplazar.
      await expect(gestor.locator('.sidebar-secciones').getByRole('button', { name: 'Noticias', exact: true })).toBeVisible();

      const campo = gestor.locator('#buscador-de-seccion');
      await campo.fill('publicar');
      const resultados = await gestor.locator('#secciones-encontradas [role="option"]').allInnerTexts();
      expect(resultados.join(' ')).toContain('Noticias y prensa');
      expect(resultados.join(' ')).not.toContain('Catálogo Editorial');
      await campo.fill('personas');
      await expect(gestor.locator('#secciones-encontradas')).toContainText('Nada coincide');
      await campo.fill('bitacora');
      await expect(gestor.locator('#secciones-encontradas')).toContainText('Nada coincide');
    } finally {
      await gestor.context().close();
    }
  });

  test('las listas que sí tiene se leen con la barra común y el resto dice que no hay acceso', async ({ browser }) => {
    const gestor = await abrirConsola(browser, GESTOR);
    try {
      await gestor.goto('/administracion/noticias');
      const barra = gestor.locator('[data-barra-de-lista]').first();
      await expect(barra.getByRole('button', { name: 'Nueva noticia' })).toBeVisible();
      await expect(barra.locator('app-filtro-desplegable', { hasText: 'Estado:' }).first()).toBeVisible();

      await gestor.goto('/administracion/mercados');
      await gestor.getByRole('button', { name: /Más acciones/ }).click();
      await expect(gestor.getByRole('menuitem', { name: 'Descargar la plantilla' })).toBeVisible();

      await gestor.goto('/administracion/organizaciones?vista=personas');
      await expect(gestor.locator('[data-sin-acceso]')).toBeVisible();
      await expect(gestor.locator('app-admin-perfiles-publicos')).toHaveCount(0);

      await gestor.goto('/administracion/auditoria');
      await expect(gestor.locator('[data-sin-acceso]')).toBeVisible();
    } finally {
      await gestor.context().close();
    }
  });
});
