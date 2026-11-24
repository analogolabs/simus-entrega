import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { elegirEnDesplegable } from './apoyo/desplegable';
import { crearFestivalConElAsistente } from './apoyo/organizacion';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * «Archivadas»: las solicitudes resueltas hace más de 90 días siguen guardadas y se ven bajo ese estado del filtro,
 * en Solicitudes del panel y en Mi espacio. No cuentan como pendientes ni cambian la insignia.
 *
 * El envejecimiento de una fila no se puede hacer desde la interfaz (la fecha es la del último cambio), así que la prueba
 * lo hace en la BASE DESECHABLE con `scripts/local/sql-local-comun.sh`. Por eso solo corre si `SIMUS_LOCAL_DB_NAME` y
 * `SIMUS_LOCAL_SA_PASSWORD` están en el entorno (la pila propia de la prueba los define); nunca contra SIMUS_LOCAL.
 */
const BASE = process.env['SIMUS_LOCAL_DB_NAME'] ?? '';
const CLAVE = 'ClaveExterna123';
const SUFIJO = Date.now().toString().slice(-8);
const CORREO = `arch.${SUFIJO}@organizacion.test`;
const ANTIGUO = `Festival archivado ${SUFIJO}`;
const RECIENTE = `Festival resuelto reciente ${SUFIJO}`;

function sql(consulta: string): void {
  const raiz = resolve(__dirname, '..', '..');
  execFileSync('bash', ['-c', 'source "$ROOT_DIR/scripts/local/sql-local-comun.sh"; sql_consulta "$1"', 'x', consulta], {
    env: { ...process.env, ROOT_DIR: raiz }, stdio: 'pipe',
  });
}

async function elegirArchivadas(page: Page): Promise<void> {
  await elegirEnDesplegable(page.locator('[data-filtro="filtro-estado-solicitud"]'), { valor: 'archivadas' });
}

test.describe('Solicitudes archivadas', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });
  test.skip(!BASE || BASE === 'SIMUS_LOCAL' || !process.env['SIMUS_LOCAL_SA_PASSWORD'], 'Necesita una base desechable propia y su clave en el entorno.');

  test('lo resuelto hace más de 90 días sale de la lista, no de la base, y se ve en Archivadas', { tag: '@backend' }, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const registro = await page.request.post('/api/v1/externo/auth/register', {
      data: {
        organizationName: `Corporación de archivadas ${SUFIJO}`, fullName: 'Persona responsable', numeroDocumento: `11${SUFIJO}`,
        phone: '3000000000', email: CORREO, password: CLAVE, headquartersDepartmentCode: '76', headquartersMunicipalityCode: '76001',
        politicasAceptadas: ['tratamiento', 'terminos'],
      },
    });
    expect(registro.status(), await registro.text()).toBeLessThan(300);
    expect((await postConCupo(page.request, '/api/v1/externo/auth/login', { data: { email: CORREO, password: CLAVE } })).status()).toBe(200);
    const id = ((await (await page.request.get('/api/v1/externo/organizaciones/mis')).json()) as { id: string }[])[0].id;

    await crearFestivalConElAsistente(page, ANTIGUO);
    await crearFestivalConElAsistente(page, RECIENTE);
    sql(`UPDATE dbo.Festivales SET EstadoRegistro = N'rechazado', FechaActualizacion = DATEADD(day, -120, SYSUTCDATETIME()) WHERE NombreFestival = N'${ANTIGUO}'`);
    sql(`UPDATE dbo.Festivales SET EstadoRegistro = N'rechazado', FechaActualizacion = DATEADD(day, -10, SYSUTCDATETIME()) WHERE NombreFestival = N'${RECIENTE}'`);

    const fila = (nombre: string) => page.locator('[data-testid="fila-de-solicitud"]').filter({ hasText: nombre });

    await test.step('Solicitudes del panel: la lista normal oculta la antigua; Archivadas la muestra con su explicación', async () => {
      await page.goto(`/gestion/o/${id}/solicitudes`, { waitUntil: 'domcontentloaded' });
      await expect(fila(RECIENTE)).toBeVisible();
      await expect(fila(ANTIGUO)).toHaveCount(0);
      await expect(page.locator('[data-testid="insignia-solicitudes"]')).toHaveCount(0);
      await elegirArchivadas(page);
      await expect(page.locator('[data-testid="aviso-de-archivadas"]')).toContainText('hace más de 90 días');
      await expect(fila(ANTIGUO)).toBeVisible();
      await expect(fila(RECIENTE)).toHaveCount(0);
    });

    await test.step('Mi espacio: lo mismo con la lista de la cuenta', async () => {
      await page.goto('/gestion/cuenta/solicitudes', { waitUntil: 'domcontentloaded' });
      await expect(fila(ANTIGUO)).toHaveCount(0);
      await elegirArchivadas(page);
      await expect(fila(ANTIGUO)).toBeVisible();
    });

    await test.step('si la lectura falla, dice el motivo con «Reintentar» y no da la lista por vacía', async () => {
      await page.goto(`/gestion/o/${id}/solicitudes`, { waitUntil: 'domcontentloaded' });
      await expect(fila(RECIENTE)).toBeVisible();
      let fallar = true;
      await page.route('**/solicitudes?archivadas=true', ruta => (fallar ? ruta.fulfill({ status: 503, body: '{}' }) : ruta.continue()));
      await elegirArchivadas(page);
      await expect(page.locator('[data-testid="error-de-archivadas"]')).toContainText('siguen guardadas');
      await expect(page.locator('[data-testid="sin-solicitudes"]')).toHaveCount(0);
      fallar = false;
      await page.locator('[data-reintentar-archivadas]').click();
      await expect(fila(ANTIGUO)).toBeVisible();
    });
  });
});
