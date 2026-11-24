import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Las pestañas de la vista Gráfico del mapa (solo lectura): Panel general, Flujos, Redes, Coincidencias, Barras y
 * Jerarquías. Cada una trae su tabla equivalente; las preguntas orientadoras llevan a la pestaña que las responde;
 * la red se recorre ampliando nodos. Necesita la demostración sembrada.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().split('T')[0]));
});

const NOMBRES = ['Panel general', 'Flujos', 'Redes', 'Coincidencias', 'Barras', 'Jerarquías'];

test('el Gráfico tiene seis pestañas, sin «Lecturas», y cada pregunta orientadora lleva a la suya', async ({ page }) => {
  await page.goto('/mapa-ecosistemico?vista=grafico');
  const pestanas = page.getByRole('tablist', { name: 'Vistas del tablero' });
  for (const nombre of NOMBRES) await expect(pestanas.getByRole('tab', { name: nombre })).toBeVisible();
  await expect(pestanas.getByRole('tab', { name: 'Lecturas' })).toHaveCount(0);
  await page.getByTestId('preguntas-orientadoras').getByRole('button', { name: /Qué coincide con qué/ }).click();
  await expect(page).toHaveURL(/tablero=coincidencias/);
  await expect(pestanas.getByRole('tab', { name: 'Coincidencias' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('tablero-avanzado')).toBeVisible();
});

for (const [id, nombre] of [['flujos', 'Flujos'], ['coincidencias', 'Coincidencias'], ['barras', 'Barras'], ['jerarquias', 'Jerarquías']] as const) {
  test(`la pestaña ${nombre} muestra su gráfico y «Ver tabla» muestra la tabla`, async ({ page }) => {
    await page.goto(`/mapa-ecosistemico?vista=grafico&tablero=${id}`);
    const panel = page.locator('app-panel-de-grafico');
    await expect(panel).toHaveCount(1);
    await expect(panel.locator('[role="img"]')).toBeVisible();
    await panel.getByRole('button', { name: 'Ver tabla' }).click();
    await expect(panel.getByTestId('tabla-equivalente').locator('tbody tr').first()).toBeVisible();
  });
}

/** Una red mínima y fija: la prueba de Redes no depende de lo que haya sembrado ni de que la API ya sirva la ruta. */
const RED = {
  truncada: false,
  nodos: [
    { id: 'organizacion:1', tipo: 'organizacion', nombre: 'Corporación Sonora', departamento: null },
    { id: 'festival:1', tipo: 'festival', nombre: 'Festival de prueba', departamento: 'Meta' },
    { id: 'territorio:1', tipo: 'territorio', nombre: 'Llanos', departamento: null },
    { id: 'practica:1', tipo: 'practica', nombre: 'Arpa llanera', departamento: null },
  ],
  aristas: [
    { origen: 'organizacion:1', destino: 'festival:1', tipo: 'responsable' },
    { origen: 'festival:1', destino: 'territorio:1', tipo: 'declara' },
    { origen: 'festival:1', destino: 'practica:1', tipo: 'declara' },
  ],
};

test('Redes: se amplía un nodo, aparece su ficha y se puede reiniciar', async ({ page }) => {
  await page.route('**/api/v1/publico/analitica/ecosistema/red', (ruta) => ruta.fulfill({ json: RED }));
  await page.goto('/mapa-ecosistemico?vista=grafico&tablero=redes');
  const red = page.getByTestId('tablero-red');
  await expect(red.getByTestId('red-lista').getByRole('button').first()).toBeVisible({ timeout: 20_000 });
  const nodo = red.getByTestId('red-lista').getByRole('button').last();
  await nodo.click();
  await expect(red.getByTestId('red-ficha').getByRole('heading', { level: 4 })).toBeVisible();
  await red.getByTestId('red-reiniciar').click();
  await expect(red.getByTestId('red-ficha')).toContainText('Pulsa un nodo');
});

test('Redes: el grafo cabe en su marco, la rueda sin Ctrl no hace zoom y los botones sí (1440, tableta y 390 px)', async ({ page }) => {
  await page.route('**/api/v1/publico/analitica/ecosistema/red', (ruta) => ruta.fulfill({ json: RED }));
  for (const [ancho, alto] of [[1440, 900], [820, 1180], [390, 844]]) {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto('/mapa-ecosistemico?vista=grafico&tablero=redes');
    const red = page.getByTestId('tablero-red');
    const lienzo = red.locator('[role="img"]').first();
    await expect(lienzo.locator('svg')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4000); // el grafo de fuerza se acomoda y se encuadra solo
    await red.getByTestId('lienzo-ajustar').click();
    await page.waitForTimeout(1500);
    // Prueba de recortes: todos los nodos y etiquetas dibujados caben dentro del lienzo.
    const fuera = await lienzo.evaluate((host) => {
      const marco = host.getBoundingClientRect();
      return Array.from(host.querySelectorAll('svg path, svg text')).filter((e) => !e.closest('defs, clipPath')).filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < marco.left - 1 || r.right > marco.right + 1 || r.top < marco.top - 1 || r.bottom > marco.bottom + 1);
      }).map((e) => `${e.tagName} ${JSON.stringify(e.getBoundingClientRect())} marco ${JSON.stringify(marco)}`);
    });
    expect(fuera, `elementos fuera del lienzo a ${ancho} px`).toEqual([]);
    // La rueda sin Ctrl desplaza la página y no cambia el zoom.
    const zoom = () => red.getByTestId('lienzo-zoom').textContent();
    const antes = await zoom();
    const caja = (await lienzo.boundingBox())!;
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(300);
    expect(await zoom()).toBe(antes);
    await red.getByTestId('lienzo-acercar').click();
    await expect.poll(zoom).not.toBe(antes);
    await red.getByTestId('lienzo-reiniciar-vista').click();
  }
});

test('Redes: el modo ampliado se abre con el botón y se cierra con Escape', async ({ page }) => {
  await page.route('**/api/v1/publico/analitica/ecosistema/red', (ruta) => ruta.fulfill({ json: RED }));
  await page.goto('/mapa-ecosistemico?vista=grafico&tablero=redes');
  const red = page.getByTestId('tablero-red');
  await expect(red.locator('[role="img"] svg').first()).toBeVisible({ timeout: 20_000 });
  await red.getByTestId('lienzo-ampliar').click();
  await expect(red.locator('.lienzo-ampliado')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(red.locator('.lienzo-ampliado')).toHaveCount(0);
});

test('ninguna pestaña del tablero tiene violaciones graves de accesibilidad ni desborda a 390 px', async ({ page }) => {
  await page.route('**/api/v1/publico/analitica/ecosistema/red', (ruta) => ruta.fulfill({ json: RED }));
  for (const ancho of [1440, 390]) {
    await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 });
    for (const id of ['panel', 'flujos', 'redes', 'coincidencias', 'barras', 'jerarquias']) {
      await page.goto(`/mapa-ecosistemico?vista=grafico&tablero=${id}`);
      await expect(page.getByRole('tab', { name: /./ }).first()).toBeVisible();
      await page.waitForTimeout(1500);
      const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('.leaflet-container').analyze();
      const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(graves.map((v) => `${v.id}: ${v.nodes[0]?.target}`), `${id} a ${ancho} px`).toEqual([]);
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(desborde, `desborde horizontal de ${id} a ${ancho} px`).toBeLessThanOrEqual(1);
    }
  }
});
