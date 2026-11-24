import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * Las dos vistas del mapa (mapa y gráfico) comparten filtros y dirección, y lo que se exporta lleva título, filtros,
 * fecha y fuente (decisión 116). Necesita la demostración sembrada (`sembrar-demo.sh completa`).
 */
const FUENTE = 'Sistema de Información de la Música (SIMUS) — Plan Nacional de Música para la Convivencia';

test.beforeEach(async ({ page }) => {
  // El recorrido guiado se abre solo una vez al día y taparía los controles.
  await page.addInitScript(() => localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().split('T')[0]));
});

test('cambiar de vista conserva los filtros y los deja en la dirección', async ({ page }) => {
  await page.goto('/mapa-ecosistemico?capa=Festivales&q=festival');
  const vistas = page.getByRole('group', { name: 'Cómo se mira lo que está puesto' });
  await expect(vistas.getByRole('button', { name: 'Tabla' })).toHaveCount(0);
  await vistas.getByRole('button', { name: 'Gráfico' }).click();
  await expect(page).toHaveURL(/vista=grafico/);
  await expect(page).toHaveURL(/q=festival/);
  await expect(page.getByTestId('tablero-panorama')).toBeVisible();
});

test('el panorama filtra de forma cruzada: pulsar un departamento en la tabla equivalente filtra todo', async ({ page }) => {
  await page.goto('/mapa-ecosistemico?vista=grafico&capa=Festivales');
  await expect(page.getByTestId('tablero-panorama')).toBeVisible();
  const panel = page.locator('app-panel-de-grafico', { hasText: 'Registros por departamento' });
  await panel.getByRole('button', { name: 'Ver tabla' }).click();
  await panel.locator('tbody button').first().click();
  await expect(page).toHaveURL(/departamento=/);
  await expect(page.getByRole('group', { name: 'Filtros elegidos en el tablero' })).toBeVisible();
  // Quitar el chip devuelve el país y limpia la dirección.
  await page.getByRole('button', { name: /Quitar filtro Departamento/ }).click();
  await expect(page).not.toHaveURL(/departamento=/);
});

test('cada panel del panorama trae su ficha de indicador', async ({ page }) => {
  await page.goto('/mapa-ecosistemico?vista=grafico');
  const ficha = page.getByTestId('ficha-ediciones-por-anio');
  await ficha.getByText('Ficha del indicador').click();
  await expect(ficha).toContainText('Limitaciones');
  await expect(ficha).toContainText('Fuente');
});

test('el gráfico exporta PNG, SVG y CSV con filtros, fecha y fuente', async ({ page }) => {
  await page.goto('/mapa-ecosistemico?vista=grafico&capa=Festivales');
  const panel = page.locator('app-panel-de-grafico', { hasText: 'Registros por departamento' });
  const exportar = async (opcion: string) => {
    await panel.getByRole('button', { name: /Exportar/ }).click();
    const descarga = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: opcion }).click();
    return descarga;
  };

  const csv = await exportar('Descargar datos (CSV)');
  const texto = await readFile((await csv.path())!, 'utf-8');
  expect(texto).toContain(FUENTE);
  expect(texto).toContain('Filtros aplicados: Capa: Festivales');
  expect(texto).toMatch(/Fecha de generación: \d{1,2} de \w+ de \d{4}/);

  const svg = await exportar('Descargar vector (SVG)');
  const dibujo = await readFile((await svg.path())!, 'utf-8');
  expect(dibujo).toContain('<svg');
  expect(dibujo).toContain('Plan Nacional de Música para la Convivencia');

  const png = await exportar('Descargar imagen (PNG)');
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  const bytes = await readFile((await png.path())!);
  expect(bytes.subarray(0, 4).toString('hex')).toBe('89504e47');
});

test('un enlace antiguo con vista=tabla cae en el mapa, sin la vista retirada', async ({ page }) => {
  await page.goto('/mapa-ecosistemico?vista=tabla&capa=Festivales');
  await expect(page.getByTestId('tabla-de-consulta')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Cómo se mira lo que está puesto' }).getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-pressed', 'true');
});

test('la tarjeta del directorio ubica con un icono de nombre accesible, sin texto visible', async ({ page }) => {
  await page.goto('/mapa-ecosistemico');
  const tarjeta = page.getByTestId('tarjeta-del-directorio').first();
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).not.toContainText('Ubicar en el mapa');
  await expect(tarjeta.getByRole('button', { name: /^Ubicar .+ en el mapa/ })).toHaveAttribute('title', 'Ubicar en el mapa');
});

test('la Agenda no ofrece filtro por tipo de proceso ni lo lleva como etiqueta en la tarjeta', async ({ page }) => {
  await page.goto('/agenda');
  await expect(page.getByTestId('filtro-de-proceso')).toHaveCount(0);
  await expect(page.getByText('Tipo de proceso')).toHaveCount(0);
  await expect(page.getByTestId('evento-tipo-de-proceso')).toHaveCount(0);
});

/** Lugar, organización y, DEBAJO de la organización, el proceso al que está ligado (decisión 130). */
async function procesoBajoLaOrganizacion(contenedor: import('@playwright/test').Locator) {
  const organiza = contenedor.getByTestId('evento-organiza');
  await expect(organiza).toBeVisible();
  const proceso = organiza.getByTestId('evento-proceso');
  await expect(proceso).toBeVisible();
  await expect(proceso.getByRole('link')).toHaveAttribute('href', /\/ecosistema\/(festivales|mercados-musicales|luteria|espacios|redes)\/\d+/);
  const cajaOrganiza = await organiza.locator('dd').first().boundingBox();
  const cajaProceso = await proceso.boundingBox();
  expect(cajaProceso!.y).toBeGreaterThan(cajaOrganiza!.y);
}

test('al abrir un evento de la lista de la Agenda se ve el proceso bajo la organización', async ({ page }) => {
  await page.goto('/agenda');
  const fila = page.getByRole('button', { name: /Concierto de cierre del Festival/ }).first();
  await fila.click();
  await procesoBajoLaOrganizacion(page.locator('[aria-expanded="true"]').first().locator('xpath=..'));
});

test('al abrir un evento en el mapa se ve el proceso bajo la organización', async ({ page }) => {
  await page.goto('/mapa-ecosistemico');
  await page.getByRole('tab', { name: /Agenda/ }).click();
  const tarjeta = page.getByTestId('tarjeta-de-evento').filter({ hasText: 'Concierto de cierre del Festival' });
  await tarjeta.locator('summary').click();
  await procesoBajoLaOrganizacion(tarjeta);
  await expect(tarjeta.getByTestId('mapa-evento-enlace')).toBeVisible();
});

test('la ficha del evento pone el proceso bajo la organización', async ({ page }) => {
  await page.goto('/agenda');
  await page.getByRole('button', { name: /Concierto de cierre del Festival/ }).first().click();
  await page.locator('[aria-expanded="true"]').first().locator('xpath=..').getByTestId('agenda-mas-informacion').click();
  await expect(page).toHaveURL(/\/agenda\/.+/);
  await procesoBajoLaOrganizacion(page.locator('main'));
});
