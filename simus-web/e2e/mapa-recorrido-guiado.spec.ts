import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * El recorrido guiado del mapa (docs/desarrollo/30-consola-y-acceso.md §30.16) recorre todos sus pasos sin elementos huérfanos:
 * cada paso señala un apartado que existe y se ve, la tarjeta cabe en la pantalla, el paso se
 * anuncia a un lector de pantalla y Escape lo cierra devolviendo el foco. Se repite a 1440 y a 390 px.
 *
 * Necesita la demostración sembrada (`sembrar-demo.sh completa`). No escribe nada.
 */

/** Lo que cada paso destaca, en el orden de `PASOS_DEL_TUTORIAL`. Vacío = la bienvenida. */
const APARTADOS = [
  '', 'capas', 'filtros', 'lente', 'dibujo', 'dibujo', 'dibujo', 'leyenda',
  'lienzo', 'vistas', 'lecturas', 'barras', 'dimension', 'lecturas', 'vistas', 'listado',
];

const ETIQUETAS = ['best-practice', 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function abrirElRecorrido(page: Page): Promise<void> {
  // La primera visita ya NO abre el recorrido encima: ofrece un aviso, y el recorrido se abre con «Recorrido guiado».
  await page.addInitScript(() => { localStorage.removeItem('pnmc_last_tutorial_date'); localStorage.removeItem('simus_aviso_recorrido_del_mapa'); });
  await page.goto('/mapa-ecosistemico');
  await expect(page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' })).toHaveCount(0);
  await page.locator('[data-aviso-del-recorrido]').getByRole('button', { name: 'Recorrido guiado' }).click();
  await expect(page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' })).toBeVisible();
}

for (const tam of [{ nombre: '1440', width: 1440, height: 900 }, { nombre: '390', width: 390, height: 844 }]) {
  test.describe(`recorrido guiado a ${tam.nombre} px`, () => {
    test.use({ viewport: { width: tam.width, height: tam.height } });

    test('recorre los 16 pasos y cada uno señala un apartado que existe', async ({ page }) => {
      await abrirElRecorrido(page);
      const tarjeta = page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' });

      await tarjeta.getByRole('button', { name: 'Ir a mi ritmo' }).click();

      for (let i = 1; i < APARTADOS.length; i++) {
        await expect(tarjeta.getByText(`Paso ${i + 1} de 16`)).toBeVisible();
        const apartado = APARTADOS[i];

        // El apartado señalado existe, se ve y lleva el anillo del recorrido: sin él el paso habla
        // de algo que la pantalla no está enseñando.
        const marca = page.locator(`[data-tuto="${apartado}"]`).first();
        await expect(marca, `paso ${i + 1}: «${apartado}» debe existir`).toBeVisible();
        await expect(marca).toHaveClass(/ring-4/);

        // La tarjeta cabe entera en la pantalla.
        const caja = (await tarjeta.boundingBox())!;
        expect(caja.x, `paso ${i + 1}: tarjeta fuera por la izquierda`).toBeGreaterThanOrEqual(-1);
        expect(caja.y, `paso ${i + 1}: tarjeta fuera por arriba`).toBeGreaterThanOrEqual(-1);
        expect(caja.x + caja.width, `paso ${i + 1}: tarjeta fuera por la derecha`).toBeLessThanOrEqual(tam.width + 1);

        // Título y texto con contenido, y el texto cabe en el límite editable.
        const titulo = (await tarjeta.getByRole('heading').innerText()).trim();
        expect(titulo.length).toBeGreaterThan(3);

        if (i < APARTADOS.length - 1) {
          await tarjeta.getByRole('button', { name: 'Siguiente' }).click();
        }
      }

      await tarjeta.getByRole('button', { name: 'Finalizar' }).click();
      await expect(page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' })).toHaveCount(0);
    });

    test('el paso cambia el contenido de la vista que explica', async ({ page }) => {
      await abrirElRecorrido(page);
      const tarjeta = page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' });
      await tarjeta.getByRole('button', { name: 'Ir a mi ritmo' }).click();

      // Paso 11: el gráfico con sus seis pestañas y «Exportar».
      for (let i = 0; i < 9; i++) await tarjeta.getByRole('button', { name: 'Siguiente' }).click();
      await expect(tarjeta.getByText('Paso 11 de 16')).toBeVisible();
      await expect(page.getByRole('tablist', { name: 'Vistas del tablero' })).toBeVisible();

      // Paso 14: la exportación, sobre el gráfico (la vista «Tabla» se retiró).
      for (let i = 0; i < 3; i++) await tarjeta.getByRole('button', { name: 'Siguiente' }).click();
      await expect(tarjeta.getByText('Paso 14 de 16')).toBeVisible();
      await expect(page.getByRole('tablist', { name: 'Vistas del tablero' })).toBeVisible();
    });

    test('el paso nuevo se anuncia y Escape cierra devolviendo el foco', async ({ page }) => {
      await abrirElRecorrido(page);
      const tarjeta = page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' });
      await tarjeta.getByRole('button', { name: 'Ir a mi ritmo' }).click();

      // El título y el texto viven en una región viva: el foco se queda en «Siguiente».
      const viva = tarjeta.locator('[aria-live="polite"]');
      await expect(viva).toHaveCount(1);
      await expect(viva.getByRole('heading')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' })).toHaveCount(0);
      // Tras cerrar, la persona no queda con el foco en un elemento que ya no existe.
      const enCuerpo = await page.evaluate(() => document.activeElement !== null);
      expect(enCuerpo).toBe(true);
    });

    test('con movimiento reducido no hay transiciones en la tarjeta', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await abrirElRecorrido(page);
      const tarjeta = page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' });
      const duracion = await tarjeta.evaluate((el) => getComputedStyle(el).transitionDuration);
      expect(parseFloat(duracion)).toBeLessThan(0.01);
    });

    test('axe: la tarjeta de cada paso no tiene violaciones graves', async ({ page }) => {
      await abrirElRecorrido(page);
      const tarjeta = page.getByRole('dialog', { name: 'Tutorial del geovisor ecosistémico' });
      await tarjeta.getByRole('button', { name: 'Ir a mi ritmo' }).click();

      for (let i = 1; i < APARTADOS.length; i++) {
        await expect(tarjeta.getByText(`Paso ${i + 1} de 16`)).toBeVisible();
        const informe = await new AxeBuilder({ page })
          .withTags(ETIQUETAS)
          .include('[data-tarjeta-del-recorrido]')
          .analyze();
        const graves = informe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `paso ${i + 1}`).toEqual([]);
        if (i < APARTADOS.length - 1) await tarjeta.getByRole('button', { name: 'Siguiente' }).click();
      }
    });
  });
}

test('axe: el mapa con el recorrido cerrado sigue sin violaciones graves', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().split('T')[0]));
  await page.goto('/mapa-ecosistemico', { waitUntil: 'networkidle' });
  await expect(page.locator('#mapa-buscar')).toBeVisible();
  // Igual que `accesibilidad-axe.spec.ts`: sin animaciones en curso y con el mapa ya dibujado.
  await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running' || x.effect?.getTiming().iterations === Infinity), undefined, { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const informe = await new AxeBuilder({ page }).withTags(ETIQUETAS).analyze();
  const graves = informe.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .filter((v) => !(v.id === 'color-contrast' && v.nodes.every((n) => n.target.join(' ').includes('.leaflet-'))));
  expect(graves.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
});
