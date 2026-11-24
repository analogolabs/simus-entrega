import { test, expect, type Page } from '@playwright/test';

/**
 * Noticias y Actualidad: la regla de las destacadas a la vista, los filtros con chips, la campaña
 * (`?proyecto=`), el bloque «Actualidad» del Inicio y el respeto de `prefers-reduced-motion`.
 *
 * Usa la siembra de demostración: trece noticias publicadas, una de ellas ligada al proyecto
 * transversal «celebra-la-musica». No escribe nada: solo navega.
 */

async function sinTutorial(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try { localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().split('T')[0]); } catch { /* sin almacenamiento */ }
  });
}

test.describe('Noticias: la regla, los chips y la campaña', () => {
  test('la regla de las destacadas está escrita en la página', async ({ page }) => {
    await sinTutorial(page);
    await page.goto('/noticias');
    const regla = page.getByTestId('regla-de-destacadas');
    await expect(regla).toBeVisible();
    await expect(regla).toContainText('tres noticias publicadas más recientes');
    await expect(regla).toContainText('fecha de publicación');
  });

  test('buscar y elegir categoría ponen chips con «X»; «Limpiar filtros» los quita todos', async ({ page }) => {
    await sinTutorial(page);
    await page.goto('/noticias');
    await page.getByTestId('buscar-noticias').fill('escuelas');
    // El filtrado es en memoria: la lista responde sin pausa y el chip aparece junto a la barra.
    const filtros = page.locator('app-filtros-activos');
    await expect(filtros).toContainText('escuelas');
    await expect(page).toHaveURL(/q=escuelas/);

    await filtros.getByRole('button', { name: /Quitar filtro/ }).first().click();
    await expect(page.getByTestId('buscar-noticias')).toHaveValue('');
    await expect(page.locator('app-filtros-activos [data-filtros-activos]')).toHaveCount(0);

    await page.getByTestId('buscar-noticias').fill('zzzzzz');
    await expect(page.getByText('Ninguna noticia coincide con tus filtros')).toBeVisible();
    await page.locator('app-estado-de-lista').getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(page.getByTestId('buscar-noticias')).toHaveValue('');
  });

  test('la campaña de la URL muestra solo sus noticias, con la destacada incluida, y se quita desde su chip', async ({ page }) => {
    await sinTutorial(page);
    await page.goto('/noticias?proyecto=celebra-la-musica');
    const vista = page.getByTestId('noticias-de-la-campana');
    await expect(vista).toBeVisible();
    await expect(vista).toContainText('Celebra la Música');
    // La regla de las destacadas no se pinta en la vista de una campaña: no hay destacadas.
    await expect(page.getByTestId('regla-de-destacadas')).toHaveCount(0);
    await expect(page.locator('app-filtros-activos')).toContainText('Campaña');
    await expect(page.locator('main article').first()).toBeVisible();

    await page.locator('app-filtros-activos').getByRole('button', { name: /Quitar filtro/ }).first().click();
    await expect(page.getByTestId('noticias-de-la-campana')).toHaveCount(0);
    await expect(page.getByTestId('regla-de-destacadas')).toBeVisible();
    await expect(page).not.toHaveURL(/proyecto=/);
  });

  test('con movimiento reducido el listado aparece sin animación', async ({ browser }) => {
    const contexto = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await contexto.newPage();
    await sinTutorial(page);
    await page.goto('/noticias');
    await expect(page.getByTestId('regla-de-destacadas')).toBeVisible();
    const duraciones = await page.evaluate(() => {
      const bloque = document.querySelector('.aparece');
      const tarjeta = document.querySelector('article.group img');
      return {
        aparece: bloque ? getComputedStyle(bloque).animationName : 'sin-bloque',
        imagen: tarjeta ? getComputedStyle(tarjeta).transitionDuration : 'sin-imagen',
      };
    });
    // `.aparece` no anima y la transición de la foto vale 0 con `prefers-reduced-motion: reduce`.
    expect(duraciones.aparece === 'none' || duraciones.aparece === 'sin-bloque').toBeTruthy();
    expect(['sin-imagen', '1e-06s', '0s']).toContain(duraciones.imagen);
    await contexto.close();
  });
});

test.describe('Inicio: Actualidad', () => {
  test('Noticias lleva la principal y cuatro secundarias, y llena la altura de Próximamente', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await sinTutorial(page);
    await page.goto('/');
    await page.getByTestId('portada-evento').first().waitFor();
    const secundarias = page.getByTestId('noticias-secundarias-inicio').locator('article');
    await expect(secundarias).toHaveCount(4);
    await expect(secundarias.first()).toBeVisible();

    const alturas = await page.evaluate(() => {
      const s = document.querySelector('app-noticias-agenda-preview section')!;
      const medir = (c: Element) => {
        const arriba = c.getBoundingClientRect().top;
        return Math.max(...[...c.children].map(h => h.getBoundingClientRect().bottom - arriba));
      };
      return {
        noticias: medir(s.querySelector('[aria-labelledby="inicio-noticias-titulo"]')!),
        agenda: medir(s.querySelector('[aria-labelledby="inicio-agenda-titulo"]')!),
      };
    });
    // Antes de H-3 la diferencia era de ~180 px; ahora no pasa de 80 px y Noticias no supera a la agenda de forma visible.
    expect(alturas.agenda - alturas.noticias).toBeLessThan(80);
    expect(alturas.noticias - alturas.agenda).toBeLessThan(40);
  });

  test('en pantalla estrecha solo se ven dos secundarias', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await sinTutorial(page);
    await page.goto('/');
    await page.getByTestId('portada-evento').first().waitFor();
    const visibles = await page.getByTestId('noticias-secundarias-inicio').locator('article').evaluateAll(
      els => els.filter(e => (e as HTMLElement).offsetParent !== null).length);
    expect(visibles).toBe(2);
  });
});
