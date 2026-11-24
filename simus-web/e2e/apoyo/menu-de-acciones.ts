import { Locator } from '@playwright/test';

/**
 * LAS ACCIONES DE UNA FILA VIVEN EN SU MENÚ «Acciones de …» (P3, tabla de gestión): una opción por acción, con
 * `role="menuitem"`. Abre el menú de la fila si aún no está abierto y devuelve la opción con ese nombre. Las apagadas
 * se leen como `toBeDisabled()`.
 */
export async function opcionDelMenu(fila: Locator, nombre: string | RegExp): Promise<Locator> {
  const opcion = fila.getByRole('menuitem', { name: nombre });
  if (!(await opcion.count())) await fila.getByRole('button', { name: /^Acciones de / }).click();
  return opcion;
}
