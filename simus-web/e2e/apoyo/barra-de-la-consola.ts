import { expect, Page } from '@playwright/test';

/**
 * Lo que comparten las pruebas de navegador que se mueven por la barra lateral de la consola.
 *
 * Desde UI-A (docs/desarrollo/30-consola-y-acceso.md) la barra tiene rótulos CORTOS («Textos y páginas», «Solicitudes») y los grupos
 * «Sitio web y comunicación» y «Gobierno y control» vienen PLEGADOS: una sección de esos grupos no es
 * visible hasta desplegar el suyo. Esta ayuda lo hace sin que cada prueba tenga que saber en qué grupo
 * vive la sección, que es justo lo que se movió.
 */

/** La barra lateral, por su nombre accesible (es un `<nav>`). */
export function barraDeLaConsola(page: Page) {
  return page.getByRole('navigation', { name: 'Secciones de la consola' });
}

/** Espera a que la consola esté dibujada: la barra existe y se ve. */
export async function esperarLaConsola(page: Page): Promise<void> {
  await expect(barraDeLaConsola(page)).toBeVisible({ timeout: 30_000 });
}

/**
 * Elige el TIPO de asunto de la bandeja «Solicitudes». Desde UI-A el tipo ya no son pestañas sino un
 * filtro desplegable (`Tipo de asunto`), y las pestañas son solo de estado (Pendientes y Resueltas). La
 * opción se busca por su nombre accesible, que lleva además el recuento («Eventos 3»).
 */
export async function elegirTipoDeLaBandeja(page: Page, nombre: RegExp): Promise<void> {
  await page.locator('[data-filtro="tipo-de-la-bandeja"]').click();
  await page.getByRole('option', { name: nombre }).first().click();
}

/**
 * Abre una sección por su rótulo corto de la barra, desplegando antes el grupo que la contiene si
 * hace falta. El nombre se compara como prefijo: «Solicitudes» lleva además el aviso de pendientes.
 */
export async function abrirSeccionDeLaBarra(page: Page, rotulo: string): Promise<void> {
  const barra = barraDeLaConsola(page);
  const entrada = barra.getByRole('button', { name: new RegExp(`^${rotulo}( |$)`) }).first();
  const plegados = barra.locator('.sidebar-grupo-titulo[aria-expanded="false"]');
  // La elección de plegado se carga cuando llega la sesión; si llegó después de nuestro clic, vuelve a
  // plegar. Por eso se reintenta hasta que la entrada se vea, en vez de contar con un solo intento.
  await expect(barra.locator('.sidebar-item').first()).toBeVisible();
  await expect(async () => {
    if (!(await entrada.isVisible()) && (await plegados.count()) > 0) {
      await plegados.first().click();
    }
    await expect(entrada).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await entrada.click();
}
