import { expect, test } from '@playwright/test';

/**
 * `/admin` es el atajo corto de `/administracion` (punto 41): lleva a la misma consola y deja en la barra la dirección
 * canónica, con la sección y la consulta que se hayan escrito.
 */
test('/admin y /administrador llevan a /administracion', async ({ page }) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/administracion$/);

  await page.goto('/admin/agenda?x=1', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/administracion\/agenda\?x=1$/);

  await page.goto('/administrador/solicitudes', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/administracion\/solicitudes$/);
});
