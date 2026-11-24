import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';

/**
 * «¿Olvidaste tu contraseña?» de punta a punta contra la API real. @backend
 *
 * Solicitar → leer el enlace de la cola de correo de la demo → restablecer → ingresar con la clave
 * nueva → la sesión anterior queda cerrada → el enlace no se reutiliza.
 *
 * <b>POR QUÉ SE LEE LA BASE.</b> Sin proveedor de correo el mensaje queda en `dbo.Notificaciones`, y
 * la persona que olvidó su clave no tiene sesión, así que no puede verlo en la campana (a propósito:
 * si pudiera, cualquiera restablecería la clave de cualquiera). La prueba hace de buzón leyendo esa
 * cola con `sqlcmd` dentro del contenedor local. Se define con variables de entorno, nunca en el
 * código:
 *
 *   SIMUS_E2E_SQL_CLAVE      la contraseña de `sa` del SQL Server local (sin ella, la prueba se omite)
 *   SIMUS_E2E_SQL_BASE       la base del entorno (por omisión SIMUS_LOCAL)
 *
 * Habla con la base por `scripts/local/sql-local-comun.sh` (`sql_consulta`), el mismo camino de los guiones de
 * siembra: `sqlcmd` del anfitrión, del contenedor o de la imagen de herramientas, el que haya.
 */
const CLAVE_SQL = process.env.SIMUS_E2E_SQL_CLAVE ?? process.env.PNMC_E2E_SQL_CLAVE;
const BASE_SQL = process.env.SIMUS_E2E_SQL_BASE ?? process.env.PNMC_E2E_SQL_BASE ?? 'SIMUS_LOCAL';
// Playwright corre desde simus-web: la raíz del repositorio está un nivel arriba.
const RAIZ = resolve(process.cwd(), '..');

const CLAVE_VIEJA = 'ClaveVieja#2026-Simus';
const CLAVE_NUEVA = 'FraseNuevaDeSimus#2026-Z';

/** El enlace relativo del último correo de recuperación enviado a esa dirección. */
function enlaceDelCorreo(correo: string): string {
  // Solo la línea del enlace: `sql_consulta` recorta las columnas largas, y el cuerpo entero no cabe.
  const consulta = `SELECT TOP 1 SUBSTRING(Cuerpo, CHARINDEX(N'/ecosistema/restablecer-contrasena', Cuerpo), 120) FROM dbo.Notificaciones WHERE CorreoDestinatario = N'${correo}' AND TipoEvento = N'RecuperacionDeContrasena' ORDER BY IdNotificacion DESC;`;
  const salida = execFileSync('bash', ['-c', 'source "$ROOT_DIR/scripts/local/sql-local-comun.sh"; sql_consulta "$1" "$2"', 'bash', consulta, BASE_SQL], {
    encoding: 'utf8',
    env: { ...process.env, ROOT_DIR: RAIZ, SIMUS_LOCAL_SA_PASSWORD: CLAVE_SQL, SIMUS_LOCAL_DB_NAME: BASE_SQL },
  });
  const coincidencia = /^(\/ecosistema\/restablecer-contrasena\?testigo=[0-9a-f]{64})\s*$/m.exec(salida);
  expect(coincidencia, 'el correo de recuperación tiene que traer el enlace en su propia línea').not.toBeNull();
  return coincidencia![1];
}

test.describe('Recuperar la contraseña, de punta a punta', { tag: '@backend' }, () => {
  test.skip(!CLAVE_SQL, 'Define SIMUS_E2E_SQL_CLAVE para leer la cola de correo de la demo.');

  test('solicitar, abrir el enlace, restablecer, ingresar y comprobar que la sesión anterior se cerró', async ({ browser }) => {
    const correo = `recuperar.${Date.now()}@example.com`;

    // La cuenta y una sesión abierta con la clave vieja (en otro navegador).
    const anterior = await (await browser.newContext()).newPage();
    const alta = await anterior.request.post('/api/v1/externo/auth/register', {
      data: {
        registrationType: 'individual', firstName: 'Lucía', firstSurname: 'Mosquera', documentType: 'cc',
        documentNumber: String(100000000 + (Date.now() % 800000000)), phone: '3001234567', email: correo,
        password: CLAVE_VIEJA, politicasAceptadas: ['tratamiento', 'terminos'],
      },
    });
    expect(alta.status(), 'el alta de la cuenta de prueba').toBe(201);
    expect((await postConCupo(anterior.request, '/api/v1/externo/auth/login', { data: { email: correo, password: CLAVE_VIEJA } })).status()).toBe(200);
    expect((await anterior.request.get('/api/v1/externo/auth/me')).status()).toBe(200);

    // 1 · Solicitar desde /ingresar.
    const pagina = await (await browser.newContext()).newPage();
    await pagina.goto('/ingresar', { waitUntil: 'domcontentloaded' });
    await pagina.getByTestId('olvide-mi-contrasena').click();
    await expect(pagina.getByText('Las cuentas de la consola de administración no se recuperan por correo')).toBeVisible();
    await pagina.locator('#recuperacion-correo').fill(correo);
    await pagina.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(pagina.getByTestId('recuperacion-enviada')).toContainText('Revisa tu correo');
    await expect(pagina.getByTestId('recuperacion-enviada')).toContainText('Si existe una cuenta');

    // Una cuenta que no existe recibe exactamente el mismo aviso.
    await pagina.getByRole('button', { name: 'Pedir otro enlace' }).click();
    await pagina.locator('#recuperacion-correo').fill(`nadie.${Date.now()}@example.com`);
    await pagina.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(pagina.getByTestId('recuperacion-enviada')).toContainText('Si existe una cuenta');

    // 2 · El «buzón»: el enlace de la cola de correo.
    const enlace = enlaceDelCorreo(correo);

    // 3 · Abrir el enlace y restablecer.
    await pagina.goto(enlace, { waitUntil: 'domcontentloaded' });
    await expect(pagina.getByRole('heading', { name: 'Elige una contraseña nueva' })).toBeVisible();
    await expect(pagina.locator('#restablecer-nueva')).toBeVisible();
    await pagina.locator('#restablecer-nueva').fill('corta');
    await pagina.locator('#restablecer-confirmacion').fill('otra');
    await pagina.getByRole('button', { name: 'Guardar contraseña nueva' }).click();
    await expect(pagina.locator('#restablecer-nueva-error')).toContainText('12 caracteres');
    await pagina.locator('#restablecer-nueva').fill(CLAVE_NUEVA);
    await pagina.locator('#restablecer-confirmacion').fill(CLAVE_NUEVA);
    await pagina.getByRole('button', { name: 'Guardar contraseña nueva' }).click();
    await expect(pagina.getByTestId('restablecer-hecho')).toContainText('cerramos las demás sesiones');

    // 4 · La sesión anterior queda cerrada; la clave vieja ya no entra.
    expect((await anterior.request.get('/api/v1/externo/auth/me')).status(), 'la sesión abierta con la clave vieja').toBe(401);
    expect((await postConCupo(pagina.request, '/api/v1/externo/auth/login', { data: { email: correo, password: CLAVE_VIEJA } })).status()).toBe(401);

    // 5 · Ingresar con la clave nueva desde la pantalla.
    await pagina.getByTestId('restablecer-ir-a-ingresar').click();
    await expect(pagina).toHaveURL(/\/ingresar$/);
    await pagina.locator('#acceso-correo').fill(correo);
    await pagina.locator('#acceso-contrasena').fill(CLAVE_NUEVA);
    // El botón del formulario, no el «Ingresar» de la cabecera que lleva el mismo nombre.
    await pagina.locator('form button[type="submit"]').click();
    await expect(pagina).toHaveURL(/\/gestion/, { timeout: 30_000 });

    // 6 · El enlace no se reutiliza.
    const otra = await (await browser.newContext()).newPage();
    await otra.goto(enlace, { waitUntil: 'domcontentloaded' });
    await expect(otra.getByTestId('restablecer-sin-enlace')).toContainText('ya se usó');
    await expect(otra.getByTestId('restablecer-pedir-otro')).toHaveAttribute('href', '/ingresar?recuperar=1');
  });
});
