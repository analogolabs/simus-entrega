import { expect, test } from '@playwright/test';

/**
 * Las cookies de sesión llevan el nombre del sistema (9 nov 2026). @backend
 *
 * Ingresar por la pantalla real y comprobar en el navegador qué cookies quedaron: `simus.external`
 * (la sesión del ecosistema) y ninguna `pnmc.*`. Después, una cookie con el nombre antiguo no abre
 * sesión: no hay alias de compatibilidad, y quien la tenía vuelve a ingresar.
 */
const MARCA = `${Date.now()}`.slice(-9);
const CUENTA = { email: `sesion.${MARCA}@ejemplo.test`, password: 'Clave-Segura-2026' };

test('el ingreso deja la cookie simus.external y una cookie pnmc.external no abre sesión', { tag: '@backend' }, async ({ browser }) => {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();

  const preparacion = await (await page.request.get('/api/v1/externo/auth/register-preparation')).json() as { politicas?: { clave: string }[] };
  const alta = await page.request.post('/api/v1/externo/auth/register', {
    data: {
      registrationType: 'individual', firstName: 'Ana', firstSurname: 'Restrepo', documentType: 'cc',
      documentNumber: `8${MARCA}`, phone: '3001234567', email: CUENTA.email, password: CUENTA.password,
      politicasAceptadas: (preparacion.politicas ?? []).map(politica => politica.clave),
    },
  });
  expect(alta.ok(), `el registro tiene que aceptar la cuenta: ${await alta.text()}`).toBeTruthy();

  await page.goto('/ingresar', { waitUntil: 'domcontentloaded' });
  await page.fill('#acceso-correo', CUENTA.email);
  await page.fill('#acceso-contrasena', CUENTA.password);
  // El ingreso tiene cupo por dirección (10 por minuto): en la suite completa, a mitad de corrida, la pantalla puede responder
  // «No fue posible iniciar sesión» por el 429 y quedarse en /ingresar. Se repite el envío hasta que el cupo se reponga.
  await expect(async () => {
    if (!/\/gestion\//.test(page.url())) await page.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page).toHaveURL(/\/gestion\//, { timeout: 8_000 });
  }).toPass({ timeout: 90_000, intervals: [1_000, 5_000, 10_000] });

  const nombres = (await contexto.cookies()).map(cookie => cookie.name);
  expect(nombres).toContain('simus.external');
  expect(nombres.filter(nombre => nombre.toLowerCase().startsWith('pnmc.'))).toEqual([]);

  // Misma sesión, pero con el nombre antiguo: sin alias, el servidor no la reconoce.
  const valor = (await contexto.cookies()).find(cookie => cookie.name === 'simus.external')!.value;
  const otro = await browser.newContext();
  await otro.addCookies([{ name: 'pnmc.external', value: valor, domain: new URL(page.url()).hostname, path: '/' }]);
  const sinSesion = await otro.request.get('/api/v1/externo/cuenta/perfil');
  expect(sinSesion.status(), 'la cookie con el nombre antiguo no debe autenticar').toBe(401);

  // Control: el mismo valor con el nombre nuevo sí autentica.
  await otro.addCookies([{ name: 'simus.external', value: valor, domain: new URL(page.url()).hostname, path: '/' }]);
  expect((await otro.request.get('/api/v1/externo/cuenta/perfil')).status()).toBe(200);
});
