import { test, expect } from '@playwright/test';

/**
 * Recorrido del perfil público de la persona.
 *
 *   1. Una cuenta individual entra por /ingresar.
 *   2. Crea su perfil en /gestion/cuenta/perfil-publico y lo guarda: nace oculto.
 *   3. Lo publica aceptando el texto de la finalidad `perfil_publico`.
 *   4. Sin sesión, /ecosistema/personas/:clave lo enseña.
 *   5. Lo oculta y, sin sesión, la misma dirección dice «Perfil no disponible» y la API responde 404.
 *
 * <b>POR QUE EXISTE.</b> tiene pruebas de API y de componente, pero ninguna recorre la pantalla
 * con un navegador: que el enlace «Ver mi perfil público» lleve a la ficha anónima, o que ocultar
 * la retire de verdad, solo se ve así.
 *
 * <b>UNA CUENTA NUEVA EN CADA EJECUCION.</b> El perfil es de la cuenta y conserva su estado entre
 * corridas; con la cuenta de demostración, una ejecución a medias dejaría la siguiente empezando
 * con el perfil ya publicado. La cuenta se crea por la API de registro, que en modo demo no exige
 * confirmar el correo.
 *
 * Requiere el entorno local con la base de demostración (`scripts/demo/reconstruir-demo-local.sh`), el
 * frontend en 4300 y la API en 8180.
 */

/** Diez cifras distintas en cada ejecución: sirven de documento y hacen únicos el correo y el nombre. */
function sello(): string {
  return `${Date.now()}`.slice(-9) + Math.floor(Math.random() * 10);
}

test.describe('#125: el perfil público se crea, se publica, se ve sin sesión y se oculta', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('crear, publicar, ver sin sesión y ocultar', { tag: '@backend' }, async ({ browser }) => {
    const persona = await (await browser.newContext()).newPage();
    const anonimo = await (await browser.newContext()).newPage();
    const SELLO = sello();
    const CUENTA = { email: `perfil.e2e.${SELLO}@ejemplo.org`, password: 'ClaveDePrueba2026!' };
    const NOMBRE_VISIBLE = `Intérprete de recorrido ${SELLO}`;
    let clave = '';

    await test.step('se crea una cuenta individual nueva', async () => {
      const alta = await persona.request.post('/api/v1/externo/auth/register', {
        data: {
          registrationType: 'individual',
          firstName: 'Intérprete',
          firstSurname: 'De Recorrido',
          documentType: 'cc',
          documentNumber: SELLO,
          phone: '3001234567',
          email: CUENTA.email,
          password: CUENTA.password,
          politicasAceptadas: ['tratamiento', 'terminos'],
        },
      });
      expect(alta.ok(), `el registro tiene que aceptar la cuenta: ${await alta.text()}`).toBeTruthy();
    });

    await test.step('la persona entra con su cuenta', async () => {
      await persona.goto('/ingresar', { waitUntil: 'domcontentloaded' });
      await persona.fill('#acceso-correo', CUENTA.email);
      await persona.fill('#acceso-contrasena', CUENTA.password);
      // Dentro del formulario: la cabecera también tiene un botón «Ingresar».
      await persona.locator('form').getByRole('button', { name: 'Ingresar', exact: true }).click();
      await expect(persona).toHaveURL(/\/gestion/, { timeout: 30_000 });
    });

    await test.step('crea su perfil y lo guarda: nace oculto', async () => {
      await persona.goto('/gestion/cuenta/perfil-publico', { waitUntil: 'domcontentloaded' });
      await expect(persona.locator('[data-estado="oculto"]')).toBeVisible({ timeout: 30_000 });
      await persona.fill('#perfil-nombre-visible', NOMBRE_VISIBLE);
      await persona.getByRole('button', { name: 'Guardar perfil' }).click();
      await expect(persona.getByText('Tu perfil quedó guardado.')).toBeVisible({ timeout: 30_000 });
      await expect(persona.locator('[data-estado="oculto"]')).toBeVisible();
    });

    await test.step('lo publica aceptando la autorización', async () => {
      await persona.locator('#perfil-acepta').check();
      await persona.getByRole('button', { name: 'Publicar mi perfil' }).click();
      await expect(persona.getByText('Tu perfil ya es público.')).toBeVisible({ timeout: 30_000 });
      await expect(persona.locator('[data-estado="visible"]')).toBeVisible();
      const enlace = persona.getByRole('link', { name: 'Ver mi perfil público' });
      const href = (await enlace.getAttribute('href')) ?? '';
      clave = /\/ecosistema\/personas\/([0-9a-f-]{36})/i.exec(href)?.[1] ?? '';
      expect(clave, `el enlace a la ficha pública lleva la clave: ${href}`).not.toBe('');
    });

    await test.step('sin sesión, la ficha pública lo enseña', async () => {
      await anonimo.goto(`/ecosistema/personas/${clave}`, { waitUntil: 'domcontentloaded' });
      await expect(anonimo.locator('#perfil-nombre')).toHaveText(NOMBRE_VISIBLE, { timeout: 30_000 });
      // LO PRIVADO NO VIAJA: ni el correo ni el teléfono de la cuenta están en la página.
      await expect(anonimo.locator('body')).not.toContainText(CUENTA.email);
      await expect(anonimo.locator('body')).not.toContainText('3001234567');
    });

    await test.step('lo oculta', async () => {
      await persona.getByRole('button', { name: 'Ocultar mi perfil' }).click();
      await expect(persona.getByText('Tu perfil dejó de ser público y retiramos la autorización.')).toBeVisible({ timeout: 30_000 });
      await expect(persona.locator('[data-estado="oculto"]')).toBeVisible();
    });

    await test.step('sin sesión, ya no se ve', async () => {
      await anonimo.goto(`/ecosistema/personas/${clave}`, { waitUntil: 'domcontentloaded' });
      await expect(anonimo.getByRole('heading', { name: 'Este perfil no está disponible' })).toBeVisible({ timeout: 30_000 });
      await expect(anonimo.getByText(NOMBRE_VISIBLE)).toHaveCount(0);
      const respuesta = await anonimo.request.get(`/api/v1/publico/personas/${clave}`);
      expect(respuesta.status()).toBe(404);
    });
  });
});
