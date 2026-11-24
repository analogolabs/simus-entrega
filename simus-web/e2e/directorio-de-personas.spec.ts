import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * El directorio de personas como búsqueda (DIR, docs/desarrollo/19-cuentas-y-organizaciones.md §19.13) de punta a punta: entrada desde la portada del
 * Ecosistema, filtros por tipo de servicio y por zona con el estado en la URL, ficha con perfiles similares al lado y
 * accesibilidad (axe). Usa la siembra de demostración con `./scripts/demo/sembrar-demo.sh directorio` y va con `@backend`.
 */
const ETIQUETAS = ['best-practice', 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CAPTURAS = process.env.SIMUS_CAPTURAS_DIR;

/** `zona` acota la pasada a un bloque: el resto del formulario de registro tiene ayudas con contraste previo a este lote. */
async function sinViolaciones(page: Page, zona?: string): Promise<void> {
  const constructor = new AxeBuilder({ page });
  const resultado = await (zona ? constructor.include(zona) : constructor).withTags(ETIQUETAS).analyze();
  const graves = resultado.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}

test.describe('Directorio de personas', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('se entra desde la portada, se filtra por servicio y zona y se ven perfiles similares', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/ecosistema');
    await page.locator('[data-testid="entrada-directorio-de-personas"]').getByRole('link', { name: 'Explorar el directorio' }).click();
    await expect(page).toHaveURL(/\/ecosistema\/personas$/);

    const tarjetas = page.locator('[data-testid="tarjeta-de-persona"]');
    await expect(tarjetas.first()).toBeVisible();
    const total = await tarjetas.count();
    expect(total).toBeGreaterThan(3);
    await sinViolaciones(page);
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/01-directorio.png`, fullPage: false });

    // Tipo de servicio: «Clases y formación musical» acota la lista y viaja en la URL.
    await page.getByRole('button', { name: /Tipo de servicio/ }).click();
    await page.getByLabel(/Clases y formación musical \(\d+\)/).check();
    await expect(page).toHaveURL(/servicio=clases/);
    await expect(tarjetas.first()).toBeVisible();
    await expect.poll(() => tarjetas.count()).toBeLessThan(total); // el servidor filtra: se espera su respuesta
    await expect(tarjetas.filter({ hasText: 'Sofía Benítez' })).toHaveCount(1);
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/02-filtro-por-servicio.png` });

    // SELECCIÓN MÚLTIPLE dentro de la misma dimensión: sumar «Construcción…» amplía el resultado.
    const conUno = await tarjetas.count();
    await page.getByLabel(/Construcción, reparación y restauración de instrumentos \(\d+\)/).check();
    await expect(page).toHaveURL(/servicio=clases(%2C|,)luteria/);
    await expect(tarjetas.filter({ hasText: 'Tomás Guerrero' })).toHaveCount(1);
    await expect.poll(() => tarjetas.count()).toBeGreaterThanOrEqual(conUno);

    // CATEGORÍA DE ROL (decisión 135): filtra a quien tiene cualquiera de las subcategorías y viaja en la URL.
    await page.goto('/ecosistema/personas');
    await page.getByRole('button', { name: /Categoría de rol/ }).click();
    await page.getByLabel(/Formación e investigación \(\d+\)/).check();
    await expect(page).toHaveURL(/categoria=formacion-e-investigacion/);
    await expect(tarjetas.first()).toBeVisible();
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/02a-filtro-por-categoria-de-rol.png` });

    // Un enlace con el filtro puesto llega con él aplicado.
    await page.goto('/ecosistema/personas?servicio=luteria');
    await expect(tarjetas).toHaveCount(1);
    await expect(tarjetas.first()).toContainText('Tomás Guerrero');

    // La ficha trae «Perfiles similares» al lado, con enlaces y el criterio.
    await page.goto('/ecosistema/personas?servicio=clases');
    await tarjetas.filter({ hasText: 'Sofía Benítez' }).getByRole('link').first().click();
    const similares = page.locator('[data-testid="perfiles-similares"]');
    await expect(similares).toContainText('Perfiles similares');
    await expect(similares.locator('[data-criterio]')).toBeVisible();
    await expect(similares.locator('[data-similar]').first()).toBeVisible();
    await expect(similares.locator('[data-similar] a[href^="/ecosistema/personas/"]').first()).toBeVisible();
    await sinViolaciones(page);
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/03-ficha-con-similares.png`, fullPage: true });
  });

  test('un clic en un perfil similar abre a esa persona y «Volver» regresa al directorio con su consulta', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/ecosistema/personas?servicio=clases');
    const tarjetas = page.locator('[data-testid="tarjeta-de-persona"]');
    await tarjetas.filter({ hasText: 'Sofía Benítez' }).getByRole('link').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sofía Benítez');

    // El clic en un similar cambia SOLO la clave de la ruta: el contenido y el título deben seguirla.
    const similar = page.locator('[data-testid="perfiles-similares"] [data-similar] a[href^="/ecosistema/personas/"]').first();
    const nombre = (await similar.textContent())?.trim() ?? '';
    expect(nombre).not.toBe('');
    const destino = await similar.getAttribute('href');
    await similar.click();
    await expect(page).toHaveURL(new RegExp(`${destino}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(nombre);
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Sofía Benítez');
    await expect(page).toHaveTitle(new RegExp(nombre));

    // Y se puede seguir recorriendo, y volver al directorio con el filtro que se traía.
    await page.locator('[data-testid="perfiles-similares"] [data-similar] a').first().click();
    await page.getByRole('button', { name: 'Directorio de agentes y actores' }).first().click();
    await expect(page).toHaveURL(/\/ecosistema\/personas\?servicio=clases/);
  });

  test('una persona elige sus categorías en su perfil', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/ingresar');
    await page.fill('#acceso-correo', 'valentina.ocampo@correo.test');
    await page.fill('#acceso-contrasena', 'admin');
    await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
    await page.waitForURL(/\/gestion/, { timeout: 60_000 });
    await page.goto('/gestion/cuenta/perfil-publico');
    const editor = page.locator('[data-clasificacion-editor]');
    await expect(editor).toBeVisible();
    // ROLES EN DOS NIVELES (decisión 135): cada categoría titula a sus subcategorías y se eligen varias, de categorías distintas.
    await editor.getByRole('button', { name: /Roles/ }).click();
    const roles = editor.getByRole('group', { name: /Roles/ });
    await expect(roles.locator('[data-grupo-de-opciones]').first()).toBeVisible();
    await expect(roles).toContainText('Formación e investigación');
    await expect(roles).toContainText('Creación e interpretación');
    await roles.getByLabel('Docente o formador(a) de música').check();
    await roles.getByLabel('Intérprete o instrumentista').check();
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/04a-roles-por-categoria.png` });
    await editor.getByRole('button', { name: /Roles/ }).click();
    await editor.getByRole('button', { name: 'Guardar categorías' }).click();
    await expect(editor.locator('[data-aviso-clasificacion]')).toContainText('guardadas');
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/04-editor-de-categorias.png`, fullPage: true });
  });

  test('el registro de una cuenta personal ofrece las categorías, opcionales', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/registro');
    await page.getByRole('button', { name: /Agente o actor de la música/ }).click();
    const bloque = page.locator('[data-categorias-del-registro]');
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText('opcional');
    await sinViolaciones(page, '[data-categorias-del-registro]');
    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/05-registro-con-categorias.png`, fullPage: true });
  });
});
