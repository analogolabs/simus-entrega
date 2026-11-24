import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * CONSULTA GUIADA PÚBLICA Y BOLETÍN CON DOBLE CONFIRMACIÓN (decisión 158, S-10).
 *
 *  - El lanzador de la consulta guiada flota en el portal, abre un cajón por encima de la barra, ofrece preguntas
 *    (sin caja de texto) y contesta con fuente, alcance y tabla; no cubre el pie ni sus enlaces.
 *  - El alta al boletín deja una solicitud; solo cuenta (y se ve en la consola) al abrir el enlace del correo.
 *
 * Para leer el enlace de la cola de salida la prueba consulta la base local por `docker exec`: necesita
 * `SIMUS_LOCAL_SA_PASSWORD` y, si no es el de siempre, `SIMUS_LOCAL_DB_NAME` y `SIMUS_LOCAL_SQL_CONTAINER`.
 */
test.use({ viewport: { width: 1440, height: 900 } });

function consultarBase(sql: string): string {
  const raiz = resolve(__dirname, '..', '..');
  const base = process.env['SIMUS_LOCAL_DB_NAME'] ?? 'SIMUS_LOCAL';
  // `sql_consulta` de scripts/local/sql-local-comun.sh elige cómo llegar a la base (sqlcmd, contenedor o imagen de
  // herramientas). La clave pasa por el entorno de ese proceso, no por argumentos de esta prueba.
  try {
    return execFileSync('bash', ['-c', 'source "$ROOT_DIR/scripts/local/sql-local-comun.sh"; sql_consulta "$1" "$2"', 'consulta', sql, base],
      { encoding: 'utf8', env: { ...process.env, ROOT_DIR: raiz } }).trim();
  } catch (error) {
    throw new Error(`La consulta a la base local falló: ${sql}\n${(error as { stdout?: string }).stdout ?? ''}`);
  }
}

test.describe('Consulta guiada del portal público', () => {
  test('el lanzador abre el cajón sobre la barra, ofrece preguntas y contesta con fuente, alcance y tabla', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/agenda', { waitUntil: 'networkidle' });
    const lanzador = page.locator('[data-abrir-consulta-guiada]');
    await expect(lanzador).toBeVisible();
    await lanzador.click();

    const cajon = page.locator('[data-cajon-consulta-guiada]');
    await expect(cajon).toBeVisible();
    // El campo NO genera respuestas: busca por palabras entre las preguntas del banco (sin área de texto libre).
    expect(await cajon.locator('textarea').count()).toBe(0);
    const campo = cajon.locator('[data-buscar-pregunta]');
    await campo.fill('noticias');
    await expect(cajon.locator('[data-pregunta-publica]')).toHaveCount(1);
    await campo.fill('presupuesto del ministerio');
    await expect(cajon.locator('[data-sin-coincidencia]')).toBeVisible();
    await campo.fill('');
    const preguntas = cajon.locator('[data-pregunta-publica]');
    await expect.poll(() => preguntas.count()).toBeGreaterThanOrEqual(8);

    await cajon.locator('[data-id="publica_procesos_por_tipo"]').click();
    const respuesta = cajon.locator('[data-respuesta-publica]').last();
    await expect(respuesta.locator('table')).toBeVisible();
    await expect(respuesta).toContainText('Fuente:');
    await expect(respuesta).toContainText('Alcance:');
    // Cada fila lleva un enlace real a su ficha o directorio.
    const enlace = respuesta.locator('a[data-enlace-de-fila]').first();
    await expect(enlace).toHaveAttribute('href', /^\/ecosistema\//);
    // Ningún dato personal en pantalla.
    await expect(cajon).not.toContainText('@');
  });

  test('el Asistente es una burbuja flotante en el portal (no en la barra) y no hay botón «Pregunta lo que quieras»', { tag: '@backend' }, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pnmc_last_tutorial_date', new Date().toISOString().split('T')[0]));
    for (const ruta of ['/', '/agenda', '/noticias', '/editorial']) {
      await page.goto(ruta, { waitUntil: 'networkidle' });
      const boton = page.locator('[data-abrir-consulta-guiada]');
      await expect(boton, `en «${ruta}» la burbuja se ve`).toBeVisible();
      await expect(boton).toContainText('Asistente');
      expect(await boton.evaluate(e => !!e.closest('nav')), `en «${ruta}» no está en la barra`).toBe(false);
      expect(await boton.evaluate(e => getComputedStyle(e).position)).toBe('fixed');
      await expect(page.getByText('Pregunta lo que quieras')).toHaveCount(0);
    }
  });
});

test.describe('Boletín con doble confirmación', () => {
  test('el alta es una solicitud: solo cuenta al abrir el enlace del correo', { tag: '@backend' }, async ({ page, request }) => {
    test.skip(!process.env['SIMUS_LOCAL_SA_PASSWORD'], 'Necesita SIMUS_LOCAL_SA_PASSWORD para leer la cola de salida.');
    const correo = `boletin.${Date.now()}@ficticio.test`;

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.fill('[data-testid="boletin-correo"]', correo);
    await page.click('[data-testid="boletin-enviar"]');
    await page.waitForSelector('[data-testid="boletin-modal"]');
    // El diálogo queda por encima de la barra.
    expect(await page.evaluate(() => !!document.elementFromPoint(300, 20)?.closest('[data-testid="boletin-modal-fondo"]'))).toBe(true);
    await expect(page.locator('[data-testid="boletin-modal"]')).toContainText('solo se activa cuando lo confirmes');
    await page.check('[data-testid="boletin-casilla"]');
    await page.click('[data-testid="boletin-confirmar"]');
    await expect(page.locator('[data-testid="boletin-exito"]')).toContainText('enlace para confirmar');

    // Pendiente: sin autorización escrita y sin enlace consumido.
    expect(consultarBase(`SELECT CAST(Confirmada AS int) FROM dbo.BoletinSuscripciones WHERE CorreoElectronico = N'${correo}'`)).toBe('0');
    expect(consultarBase(`SELECT COUNT(*) FROM dbo.AutorizacionesDatos WHERE CorreoTitular = N'${correo}'`)).toBe('0');

    // Solo el testigo: sqlcmd recorta las columnas anchas y el cuerpo entero no cabe.
    const salida = consultarBase(`SELECT TOP 1 SUBSTRING(Cuerpo, CHARINDEX(N'testigo=', Cuerpo) + 8, 64) FROM dbo.Notificaciones WHERE TipoEvento = N'ConfirmacionDeBoletin' AND CorreoDestinatario = N'${correo}' ORDER BY IdNotificacion DESC`);
    const testigo = /[0-9a-f]{64}/.exec(salida)?.[0];
    expect(testigo, 'el correo de confirmación trae un enlace de 256 bits').toBeTruthy();

    await page.goto(`/ecosistema/confirmar-boletin?testigo=${testigo}`, { waitUntil: 'networkidle' });
    expect(consultarBase(`SELECT CAST(Confirmada AS int) FROM dbo.BoletinSuscripciones WHERE CorreoElectronico = N'${correo}'`), 'abrir el enlace no confirma').toBe('0');
    await page.click('[data-testid="confirmar-boletin-boton"]');
    await expect(page.locator('[data-testid="confirmar-boletin-listo"]')).toBeVisible();
    expect(consultarBase(`SELECT CAST(Confirmada AS int) FROM dbo.BoletinSuscripciones WHERE CorreoElectronico = N'${correo}'`)).toBe('1');
    expect(consultarBase(`SELECT COUNT(*) FROM dbo.AutorizacionesDatos WHERE CorreoTitular = N'${correo}' AND Finalidad = N'boletin'`)).toBe('1');

    // Un solo uso.
    await page.goto(`/ecosistema/confirmar-boletin?testigo=${testigo}`, { waitUntil: 'networkidle' });
    await page.click('[data-testid="confirmar-boletin-boton"]');
    await expect(page.locator('[data-testid="confirmar-boletin-error"]')).toBeVisible();
    void request;
  });
});
