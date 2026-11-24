import { expect, Locator } from '@playwright/test';

/**
 * Cómo se elige una opción de un `app-filtro-desplegable` (UI-D).
 *
 * <b>POR QUÉ EXISTE.</b> Los departamentos y los municipios de las fichas y de los registros eran un
 * `<select>` y los recorridos hacían `selectOption`. El desplegable estándar no es un `<select>`: es un
 * botón que abre una lista de opciones (`role="option"`), así que se elige como lo hace una persona:
 * se abre y se pulsa la opción. Esta función es la única que lo sabe; si el desplegable cambia, se
 * cambia aquí y no en veinte recorridos.
 *
 * <b>EL CONTROL</b> puede ser el botón (`#id`), el anfitrión (`[name=…]`) o cualquier cosa dentro de él.
 * <b>LA ELECCIÓN</b> es por posición (`indice`; el 0 es la opción vacía, igual que en `selectOption`), por
 * lo que se lee (`etiqueta`) o por el valor guardado (`valor`).
 */
export type Eleccion = { indice: number } | { etiqueta: string } | { valor: string };

export async function elegirEnDesplegable(control: Locator, eleccion: Eleccion, esperaMs = 15_000): Promise<void> {
  const anfitrion = control.locator('xpath=ancestor-or-self::app-filtro-desplegable');
  // El municipio nace apagado hasta que hay departamento, y sus opciones llegan un instante después.
  await expect(anfitrion.locator('button.filtro__control')).toBeEnabled({ timeout: esperaMs });
  await anfitrion.locator('button.filtro__control').click();
  const opciones = anfitrion.getByRole('option');
  if ('indice' in eleccion) {
    await expect.poll(() => opciones.count(), { timeout: esperaMs }).toBeGreaterThan(eleccion.indice);
    await opciones.nth(eleccion.indice).click();
  } else if ('etiqueta' in eleccion) {
    await anfitrion.getByRole('option', { name: eleccion.etiqueta, exact: true }).click({ timeout: esperaMs });
  } else {
    await anfitrion.locator(`button[role="option"][data-valor="${eleccion.valor}"]`).click({ timeout: esperaMs });
  }
}

/** ¿Este control es un desplegable estándar (y no un `<select>` nativo)? */
export async function esDesplegable(control: Locator): Promise<boolean> {
  return (await control.locator('xpath=ancestor-or-self::app-filtro-desplegable').count()) > 0;
}
