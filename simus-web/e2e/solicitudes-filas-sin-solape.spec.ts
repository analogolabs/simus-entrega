import { test, expect, Page } from '@playwright/test';

/**
 * LAS FILAS DE LA BANDEJA NO SE PISAN (pulido final).
 *
 * El índice de «Solicitudes y revisiones» es una columna flex con alto máximo y desplazamiento propios: sin `flex: none`
 * en cada fila, con 20 o más pendientes las filas se comprimían y su título, tipo, organización y «hace N meses» se pisaban.
 * Se compara la caja de cada fila con la de la siguiente: la de arriba no puede terminar más abajo de donde empieza la otra.
 * Solo lectura: entra con la cuenta de demostración y no escribe nada.
 */

const WEBMASTER = {
  email: process.env.SIMUS_WEBMASTER_EMAIL ?? 'webmaster@simus.test',
  password: process.env.SIMUS_WEBMASTER_PASSWORD ?? 'admin',
};

const TAMANOS = [
  { nombre: '1440x900', width: 1440, height: 900 },
  { nombre: 'tableta 820x1180', width: 820, height: 1180 },
  { nombre: 'teléfono 390x844', width: 390, height: 844 },
];

/** Los pares de filas consecutivas cuyo solape vertical pasa de 1 px, o cuyo contenido se sale de su caja. */
async function solapes(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const filas = [...document.querySelectorAll<HTMLElement>(sel)].filter(f => f.getBoundingClientRect().height > 0);
    const problemas: string[] = [];
    filas.forEach((fila, i) => {
      const caja = fila.getBoundingClientRect();
      if (fila.scrollHeight > fila.clientHeight + 1) problemas.push(`fila ${i}: contenido ${fila.scrollHeight} > caja ${fila.clientHeight}`);
      const siguiente = filas[i + 1];
      if (siguiente && caja.bottom > siguiente.getBoundingClientRect().top + 1) problemas.push(`filas ${i} y ${i + 1} se solapan`);
    });
    return problemas;
  }, selector);
}

for (const tam of TAMANOS) {
  test(`@backend la bandeja de Solicitudes no solapa sus filas a ${tam.nombre}`, async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: tam.width, height: tam.height } });
    const page = await contexto.newPage();
    const entrada = await page.request.post('/api/v1/admin/auth/login', { data: WEBMASTER });
    expect(entrada.ok(), 'la cuenta de demostración tiene que poder entrar').toBeTruthy();
    await page.addInitScript(email => window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1'), WEBMASTER.email);
    await page.goto('/administracion/solicitudes', { waitUntil: 'networkidle' });

    const filas = page.locator('.revision-item');
    await expect(filas.first()).toBeVisible();
    expect(await filas.count(), 'hace falta una lista larga para que el defecto aparezca').toBeGreaterThan(1);
    expect(await solapes(page, '.revision-item')).toEqual([]);
    await contexto.close();
  });
}
