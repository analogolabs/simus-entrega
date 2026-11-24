import { test, expect, Page } from '@playwright/test';
import { abrirFichaDelFestival, crearFestivalConElAsistente, sesionDeOrganizacion } from './apoyo/organizacion';

/**
 * Tres Festivales de una misma organización, con tres, dos y cero ediciones.
 *
 * Lo que mide esto que ninguna prueba de Karma mide: el recorrido entero en el navegador —asistente,
 * ficha, sección «Ediciones» y servidor— y que un Festival se pueda tener sin ninguna edición y con
 * varias. Ese fue el criterio original: «creando 3 festivales, uno con 3 ediciones, otro con dos y
 * uno sin ediciones».
 *
 * Reescrita en: el alta se hacía en una ventana que se sustituyó por el asistente de
 * `/gestion/procesos/festivales/nuevo`, y las ediciones se registran ahora en la sección «Ediciones»
 * de la ficha. Requiere la base de demostración y el entorno local en marcha.
 */

const MARCA = new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
const FESTIVALES = [
  { nombre: `Festival de tres ediciones ${MARCA}`, ediciones: 3 },
  { nombre: `Festival de dos ediciones ${MARCA}`, ediciones: 2 },
  { nombre: `Festival sin ediciones ${MARCA}`, ediciones: 0 },
];

test.describe('Tres Festivales con tres, dos y cero ediciones', () => {
  test.describe.configure({ timeout: 240_000 });

  test('el recorrido completo, de punta a punta', { tag: '@backend' }, async ({ browser }) => {
    const page = await sesionDeOrganizacion(browser);

    for (const festival of FESTIVALES) {
      await test.step(`crear «${festival.nombre}» con ${festival.ediciones} edición(es)`, async () => {
        await crearFestivalConElAsistente(page, festival.nombre);
        await abrirFichaDelFestival(page, festival.nombre);
        for (let numero = 1; numero <= festival.ediciones; numero++) {
          await registrarEdicion(page, numero);
        }
      });
    }

    for (const festival of FESTIVALES) {
      await test.step(`comprobar «${festival.nombre}»`, async () => {
        await abrirFichaDelFestival(page, festival.nombre);
        if (festival.ediciones === 0) {
          await expect(page.getByText('Todavía sin ediciones')).toBeVisible();
          return;
        }
        await page.getByRole('button', { name: 'Ediciones', exact: true }).click();
        for (let numero = 1; numero <= festival.ediciones; numero++) {
          await expect(page.getByText(`Edición ${numero}`, { exact: true })).toBeVisible();
        }
        await expect(page.getByText(`Edición ${festival.ediciones + 1}`, { exact: true })).toHaveCount(0);
      });
    }
  });
});

async function registrarEdicion(page: Page, numero: number): Promise<void> {
  await page.getByRole('button', { name: 'Ediciones', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar edición' }).click();
  await page.getByLabel(/Número de Edición/i).fill(String(numero));
  await page.getByRole('button', { name: /Guardar borrador/ }).last().click();
  // El aviso de «guardada» puede seguir a la vista desde la edición anterior: lo que prueba que esta
  // se guardó es que aparezca en la lista.
  await expect(page.getByText(`Edición ${numero}`, { exact: true })).toBeVisible({ timeout: 30_000 });
}
