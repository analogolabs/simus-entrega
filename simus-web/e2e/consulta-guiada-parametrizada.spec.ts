import { expect, test } from '@playwright/test';

/**
 * CONSULTA GUIADA PARAMETRIZADA (punto 73): el campo del cajón reconoce departamentos, tipos y meses en
 * lo escrito, pide con selectores lo que falta y responde con tabla, fuente y FILTROS APLICADOS; cada fila lleva a su ficha
 * y los enlaces de conteo abren el directorio ya filtrado. Sin IA: la consulta es una plantilla verificada del servidor.
 */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Consulta guiada parametrizada', () => {
  test('«festivales en Nariño» ejecuta la plantilla, muestra los filtros y enlaza a la ficha', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/agenda', { waitUntil: 'networkidle' });
    await page.locator('[data-abrir-consulta-guiada]').click();
    const cajon = page.locator('[data-cajon-consulta-guiada]');
    const campo = cajon.locator('[data-buscar-pregunta]');
    await expect(cajon.locator('[data-pregunta-publica]').first()).toBeVisible();

    await campo.fill('festivales en Nariño');
    await campo.press('Enter');
    const respuesta = cajon.locator('[data-respuesta-publica]').last();
    await expect(respuesta.locator('table')).toBeVisible();
    await expect(respuesta).toContainText('festival');
    await expect(respuesta.locator('[data-filtros-aplicados]')).toContainText('Departamento: Nariño');
    await expect(respuesta.locator('[data-filtros-aplicados]')).toContainText('Solo registros publicados');
    await expect(respuesta).toContainText('Fuente:');
    const enlace = respuesta.locator('a[data-enlace-de-fila]').first();
    await expect(enlace).toHaveAttribute('href', /^\/ecosistema\/festivales\/\d+$/);
  });

  test('si falta el departamento lo pide con un selector y responde al elegirlo', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/agenda', { waitUntil: 'networkidle' });
    await page.locator('[data-abrir-consulta-guiada]').click();
    const cajon = page.locator('[data-cajon-consulta-guiada]');
    const campo = cajon.locator('[data-buscar-pregunta]');
    await expect(cajon.locator('[data-pregunta-publica]').first()).toBeVisible();

    await campo.fill('mercados');
    await campo.press('Enter');
    const formulario = cajon.locator('[data-pedir-parametros]');
    await expect(formulario).toBeVisible();
    await expect(formulario.locator('[data-consultar-parametros]')).toBeDisabled();
    await formulario.locator('app-filtro-desplegable').first().locator('button').first().click();
    await page.getByRole('option', { name: 'Bogotá, D.C.' }).click();
    await formulario.locator('[data-consultar-parametros]').click();
    const respuesta = cajon.locator('[data-respuesta-publica]').last();
    await expect(respuesta.locator('[data-filtros-aplicados]')).toContainText('Bogotá');
    await expect(respuesta.locator('table tbody tr').first()).toBeVisible();
  });

  test('«mercados de Bogotá en diciembre» reconoce tipo, lugar y mes; lo que no entiende lo dice', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/agenda', { waitUntil: 'networkidle' });
    await page.locator('[data-abrir-consulta-guiada]').click();
    const cajon = page.locator('[data-cajon-consulta-guiada]');
    const campo = cajon.locator('[data-buscar-pregunta]');
    await expect(cajon.locator('[data-pregunta-publica]').first()).toBeVisible();

    await campo.fill('mercados de Bogotá en diciembre');
    await campo.press('Enter');
    const respuesta = cajon.locator('[data-respuesta-publica]').last();
    const filtros = respuesta.locator('[data-filtros-aplicados]');
    await expect(filtros).toContainText('diciembre');
    await expect(filtros).toContainText('Bogotá');
    await expect(filtros).toContainText('mercados musicales');

    await campo.fill('presupuesto del ministerio');
    await campo.press('Enter');
    await expect(cajon.locator('[data-no-entendi]')).toBeVisible();
  });

  test('el enlace de conteo abre el directorio ya filtrado', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/agenda', { waitUntil: 'networkidle' });
    await page.locator('[data-abrir-consulta-guiada]').click();
    const cajon = page.locator('[data-cajon-consulta-guiada]');
    await expect(cajon.locator('[data-pregunta-publica]').first()).toBeVisible();
    await cajon.locator('[data-buscar-pregunta]').fill('talleres por departamento');
    await cajon.locator('[data-buscar-pregunta]').press('Enter');
    const enlace = cajon.locator('[data-respuesta-publica]').last().locator('a[data-enlace-de-fila]').first();
    await expect(enlace).toHaveAttribute('href', /^\/ecosistema\/luteria\?departamento=/);
    await enlace.click();
    await expect(page).toHaveURL(/\/ecosistema\/luteria\?.*departamento=/);
  });
});
