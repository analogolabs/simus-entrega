import { test, expect, Browser, Page } from '@playwright/test';
import { postConCupo } from './apoyo/cupo-de-entradas';
import { crc32, deflateSync } from 'node:zlib';

/** Un PNG válido de 1×1 píxel cuyo color sale de `semilla` (firma, IHDR, IDAT y IEND con su CRC). */
function pngDeUnPixel(semilla: number): Buffer {
  const trozo = (tipo: string, datos: Buffer): Buffer => {
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo) >>> 0);
    return Buffer.concat([largo, cuerpo, crc]);
  };
  const cabecera = Buffer.alloc(13); cabecera.writeUInt32BE(1, 0); cabecera.writeUInt32BE(1, 4); cabecera[8] = 8; cabecera[9] = 2;
  const pixel = Buffer.from([0, semilla & 255, (semilla >> 8) & 255, (semilla >> 16) & 255]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cabecera), trozo('IDAT', deflateSync(pixel)), trozo('IEND', Buffer.alloc(0))]);
}

/**
 * La agenda de citas de un Mercado, de punta a punta (docs/referencia/26-agenda-de-citas-y-mercados.md).
 *
 *   1. La ORGANIZACIÓN del Mercado ve su edición con la agenda abierta, con el cupo lleno y su lista de
 *      espera, y con los compradores que invitó.
 *   2. Un COMPRADOR INVITADO pide una cita a un artista; el ARTISTA la confirma y se ven el contacto el uno
 *      del otro; el artista la cancela con motivo y el comprador lo lee.
 *   3. Una persona se INSCRIBE con el cupo lleno: queda en la lista de espera, con su lugar, y sale.
 *   4. El portal, sin sesión, dice que el Mercado tiene abierta su agenda y no enseña a ninguna persona.
 *
 * Requiere la base de demostración completa (`scripts/demo/sembrar-demo.sh completa`, que incluye la agenda del
 * Mercado Musical del Valle), el frontend y la API en marcha. Deja la agenda como la encontró: lo que pide
 * lo cancela y de la lista de espera sale.
 */

const CLAVE = process.env.SIMUS_EXTERNO_PASSWORD ?? process.env.PNMC_EXTERNO_PASSWORD ?? 'admin';
const ORGANIZACION = { email: 'lucia.ramirez@cantaclaro.test', password: CLAVE };
const COMPRADORA = { email: 'diana.zapata@bandasoriente.test', password: CLAVE };
const ARTISTA = { email: 'camilo.rojas@llanoadentro.test', password: CLAVE };
const EN_ESPERA = { email: 'mariana.palacios@sonoracaribe.test', password: CLAVE };
const MERCADO = 'Mercado Musical del Valle';

async function sesionExterna(browser: Browser, cuenta: { email: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  const entrada = await postConCupo(page.request, '/api/v1/externo/auth/login', { data: cuenta });
  expect(entrada.status(), `la cuenta ${cuenta.email} de demostración tiene que poder entrar`).toBe(200);
  return page;
}

/** La agenda del Mercado de la demostración, tal como la ve esa cuenta. */
async function idDeLaAgenda(page: Page): Promise<number> {
  const agendas = await (await page.request.get('/api/v1/externo/agendas-de-citas')).json() as { agendaId: number; mercadoNombre: string }[];
  const agenda = agendas.find(a => a.mercadoNombre === MERCADO);
  expect(agenda, `la agenda de «${MERCADO}» tiene que estar sembrada`).toBeTruthy();
  return agenda!.agendaId;
}

/** El diálogo de confirmación común (no la ficha lateral de la consola, que también es un diálogo). */
function dialogoComun(page: Page) {
  return page.getByRole('dialog').filter({ has: page.locator('[data-testid="confirmacion-comun-aceptar"]') });
}

/** Cambia de pestaña en la herramienta de la agenda (organización o persona). */
async function pestana(page: Page, id: string): Promise<void> {
  await page.locator(`[data-pestana="${id}"]`).click();
}

async function confirmar(page: Page, texto?: string): Promise<void> {
  const dialogo = dialogoComun(page);
  await expect(dialogo).toBeVisible();
  if (texto) await dialogo.locator('textarea').fill(texto);
  await page.locator('[data-testid="confirmacion-comun-aceptar"]').click();
  await expect(dialogo).toBeHidden();
}

test.describe('Agenda de citas: de punta a punta', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('la organización del Mercado ve su agenda abierta, el cupo, la lista de espera y a los invitados', { tag: '@backend' }, async ({ browser }) => {
    const organizacion = await sesionExterna(browser, ORGANIZACION);
    const mias = await (await organizacion.request.get('/api/v1/externo/organizaciones/mis')).json() as { id: string; name?: string; nombre?: string }[];
    const cantaclaro = mias.find(o => (o.name ?? o.nombre ?? '').includes('Cantaclaro')) ?? mias[0];

    await organizacion.goto(`/gestion/o/${cantaclaro.id}/herramientas/agenda-de-citas`, { waitUntil: 'domcontentloaded' });
    await expect(organizacion.getByRole('heading', { name: 'Agenda de citas' })).toBeVisible();
    const fila = organizacion.locator('[data-testid="fila-de-edicion"]').filter({ hasText: MERCADO });
    await expect(fila).toBeVisible();
    await expect(fila.locator('[data-testid="estado-de-la-agenda"]')).toContainText('Inscripción abierta');
    // Un solo aviso para las ediciones sin agenda posible, y no uno por fila.
    await expect(organizacion.getByText('La agenda solo se habilita en ediciones en preparación o programadas.')).toHaveCount(1);

    await fila.locator('[data-testid="gestionar-agenda"]').click();
    // La agenda es una herramienta del Mercado: cuelga de su ficha y se abre a pantalla completa.
    await expect(organizacion).toHaveURL(/\/procesos\/mercados\/\d+\/agenda-de-citas\/\d+$/);
    await expect(organizacion.locator('[data-testid="cabecera-de-la-herramienta"]')).toBeVisible();
    await expect(organizacion.locator('[data-testid="siguiente-paso"]')).toBeVisible();
    await expect(organizacion.locator('[data-testid="indicadores"]')).toContainText('franjas disponibles');
    await pestana(organizacion, 'participantes');
    // El cupo está lleno: cuatro inscritos y una persona esperando su lugar.
    await expect(organizacion.locator('[data-testid="cifras-de-artistas"]')).toContainText('4 inscritos de 4');
    await expect(organizacion.locator('[data-testid="cifras-de-artistas"]')).toContainText('1 en lista de espera');
    await expect(organizacion.locator('[data-testid="lista-de-artistas"]')).toContainText('lugar 1');
    // Los compradores los carga el Mercado: uno ya entró con su cuenta y dos aún no.
    const compradores = organizacion.locator('[data-testid="lista-de-compradores"]');
    await expect(compradores).toContainText('Diana Zapata');
    await expect(compradores).toContainText('Ya entró con su cuenta');
    await expect(compradores).toContainText('Aún sin cuenta');
    await expect(organizacion.locator('[data-testid="aviso-de-invitacion"]')).toContainText('7 días');
    await expect(organizacion.locator('[data-testid="exportar-csv"]')).toHaveAttribute('href', /exportar\.csv$/);

    // La parrilla: compradores en columnas, franjas en filas, cada celda con su estado y la ocupación por comprador.
    await pestana(organizacion, 'parrilla');
    await expect(organizacion.locator('[data-testid="parrilla"] tbody th[data-columna]').first()).toBeVisible();
    await expect(organizacion.locator('[data-testid="parrilla"]').getByText('Diana Zapata').first()).toBeVisible();
    await expect(organizacion.locator('[data-testid^="ocupacion-"]').first()).toContainText('franjas ocupadas');
    // Cada columna lleva la foto del comprador (la demostración las siembra todas).
    await expect(organizacion.locator('[data-testid="parrilla"] tbody th[data-columna] img')).toHaveCount(3);
    await expect(organizacion.locator('[data-testid="parrilla-leyenda"]')).toContainText('Libre');
    // El cupo dice de qué es.
    await pestana(organizacion, 'resumen');
    await expect(organizacion.locator('[data-testid="indicador-de-cupo"]')).toContainText('Artistas admitidos');

    // El calendario enseña las franjas con sus citas por estado, y se recorre con el teclado.
    await pestana(organizacion, 'calendario');
    const calendario = organizacion.locator('[data-testid="calendario"]');
    await expect(calendario).toBeVisible();
    await expect(organizacion.locator('[data-testid="calendario-leyenda"]')).toContainText('Confirmada');
    await calendario.locator('button[data-celda][tabindex="0"]').focus();
    await organizacion.keyboard.press('ArrowDown');
    await organizacion.keyboard.press('Enter');
    await expect(organizacion.locator('[data-testid="detalle-de-la-franja"]')).toBeVisible();

    // La vista elegida vive en la dirección: recargar no pierde dónde estabas.
    await expect(organizacion).toHaveURL(/vista=calendario/);
    await organizacion.reload();
    await expect(organizacion.locator('[data-testid="vista-calendario"]')).toBeVisible();

    // La dirección de antes redirige a la del Mercado.
    const idAgenda = organizacion.url().match(/agenda-de-citas\/(\d+)/)![1];
    await organizacion.goto(`/gestion/o/${cantaclaro.id}/herramientas/agenda-de-citas/${idAgenda}`, { waitUntil: 'domcontentloaded' });
    await expect(organizacion).toHaveURL(/\/procesos\/mercados\/\d+\/agenda-de-citas\/\d+$/);
  });

  test('un comprador invitado pide una cita, el artista la confirma, se ven el contacto y la cancela con motivo', { tag: '@backend' }, async ({ browser }) => {
    const comprador = await sesionExterna(browser, COMPRADORA);
    const artista = await sesionExterna(browser, ARTISTA);
    const agendaId = await idDeLaAgenda(comprador);
    const sufijo = Date.now().toString().slice(-6);
    const MENSAJE = `Me gustaría escucharte (${sufijo}).`;

    await test.step('el comprador, que el Mercado invitó, ve a los artistas y pide una franja libre', async () => {
      await comprador.goto('/gestion/cuenta/agenda-de-citas', { waitUntil: 'domcontentloaded' });
      const fila = comprador.locator('[data-testid="fila-de-agenda"]').filter({ hasText: MERCADO });
      await expect(fila.locator('[data-testid="mi-situacion"]')).toContainText('Comprador invitado');
      await fila.click();
      await expect(comprador).toHaveURL(new RegExp(`/gestion/cuenta/agenda-de-citas/${agendaId}$`));
      await pestana(comprador, 'pedir');
      await expect(comprador.locator('[data-testid="contador-de-pendientes"]')).toContainText('solicitudes pendientes');

      const tarjeta = comprador.locator('[data-testid="anfitrion"]').filter({ hasText: 'Camilo Rojas' });
      await expect(tarjeta).toBeVisible();
      // Antes de la cita no hay contacto: solo la presentación y cuántas franjas tiene libres.
      await expect(tarjeta).not.toContainText('camilo.rojas@llanoadentro.test');
      await expect(tarjeta).toContainText('franjas libres');
      // Recorrido de tres pasos: la persona, la franja y la confirmación con su mensaje.
      await tarjeta.click();
      await comprador.locator('[data-testid="pedir-franja"]').last().click();
      await comprador.locator('#mensaje-del-pedido').fill(MENSAJE);
      await comprador.locator('[data-testid="confirmar-pedido"]').click();
      await expect(comprador.locator('[data-testid="aviso"]')).toContainText('Pedimos la cita');
      await pestana(comprador, 'citas');
      await expect(comprador.locator('[data-testid="cita"]').filter({ hasText: MENSAJE })
        .locator('[data-testid="estado-de-la-cita"]')).toContainText('Esperando respuesta');
    });

    await test.step('el artista ve la solicitud y la confirma; ya se ve el contacto de la compradora', async () => {
      await artista.goto(`/gestion/cuenta/agenda-de-citas/${agendaId}`, { waitUntil: 'domcontentloaded' });
      await pestana(artista, 'citas');
      const cita = artista.locator('[data-testid="cita"]').filter({ hasText: MENSAJE });
      await expect(cita).toBeVisible();
      await expect(cita.locator('[data-testid="contacto"]')).toHaveCount(0);
      await cita.locator('[data-testid="confirmar-cita"]').click();
      await expect(artista.locator('[data-testid="aviso"]')).toContainText('Confirmaste la cita');
      await expect(artista.locator('[data-testid="cita"]').filter({ hasText: MENSAJE })
        .locator('[data-testid="contacto"]')).toContainText('diana.zapata@bandasoriente.test');
    });

    await test.step('el comprador ve la cita confirmada con el contacto del artista y su calendario', async () => {
      await comprador.reload({ waitUntil: 'domcontentloaded' });
      await pestana(comprador, 'citas');
      const cita = comprador.locator('[data-testid="cita"]').filter({ hasText: MENSAJE });
      await expect(cita.locator('[data-testid="estado-de-la-cita"]')).toContainText('Confirmada');
      await expect(cita.locator('[data-testid="contacto"]')).toContainText('camilo.rojas@llanoadentro.test');
      await expect(comprador.locator('[data-testid="agregar-al-calendario"]')).toHaveAttribute('href', /mi-agenda\.ics$/);
    });

    await test.step('el artista la cancela con motivo y el comprador lo lee; la franja queda libre', async () => {
      await artista.reload({ waitUntil: 'domcontentloaded' });
      await pestana(artista, 'citas');
      await artista.locator('[data-testid="cita"]').filter({ hasText: MENSAJE }).locator('[data-testid="cancelar-cita"]').click();
      await confirmar(artista, 'Se me cruzó una gira.');
      await expect(artista.locator('[data-testid="aviso"]')).toContainText('Cancelaste la cita');

      await comprador.reload({ waitUntil: 'domcontentloaded' });
      await pestana(comprador, 'citas');
      const cancelada = comprador.locator('[data-testid="cita"]').filter({ hasText: MENSAJE });
      await expect(cancelada.locator('[data-testid="estado-de-la-cita"]')).toContainText('Cancelada');
      await expect(cancelada.locator('[data-testid="estado-de-la-cita"]')).toContainText('Se me cruzó una gira.');
    });
  });

  test('con el cupo lleno, una persona se inscribe, queda en la lista de espera con su lugar y sale', { tag: '@backend' }, async ({ browser }) => {
    const persona = await sesionExterna(browser, ORGANIZACION);
    const enEspera = await sesionExterna(browser, EN_ESPERA);
    const agendaId = await idDeLaAgenda(persona);

    await enEspera.goto(`/gestion/cuenta/agenda-de-citas/${agendaId}`, { waitUntil: 'domcontentloaded' });
    await pestana(enEspera, 'inscripcion');
    await expect(enEspera.locator('[data-testid="mi-participacion"]')).toContainText('En lista de espera');
    await expect(enEspera.locator('[data-testid="mi-participacion"]')).toContainText('lugar 1');
    // Quien espera no pide citas: no ve a nadie a quien pedirle.
    await expect(enEspera.locator('[data-testid="lista-de-anfitriones"]')).toHaveCount(0);

    await persona.goto(`/gestion/cuenta/agenda-de-citas/${agendaId}`, { waitUntil: 'domcontentloaded' });
    await pestana(persona, 'inscripcion');
    // Si una ejecución anterior se cortó con la persona inscrita, se parte de cero.
    if (await persona.locator('[data-testid="salir-de-la-agenda"]').count()) {
      await persona.locator('[data-testid="salir-de-la-agenda"]').click();
      await confirmar(persona, 'Limpieza de una ejecución anterior.');
      await expect(persona.locator('[data-testid="aviso"]')).toContainText('Saliste de la agenda');
    }
    await expect(persona.getByText('no garantiza una cita').first()).toBeVisible();
    await persona.locator('#ins-presentacion').fill('Dúo de piano y voz con repertorio de música andina colombiana.');
    await persona.locator('[data-testid="inscribirme"]').click();
    await pestana(persona, 'inscripcion');
    await expect(persona.locator('[data-testid="mi-participacion"]')).toContainText('En lista de espera', { timeout: 20_000 });
    await expect(persona.locator('[data-testid="mi-participacion"]')).toContainText('lugar 2');

    // «Tu foto»: quien participa la sube, se ve, y la quita (la demostración deja intactas las fotos sembradas).
    const bloque = persona.locator('[data-foto-del-participante]');
    await expect(bloque).toContainText('WebP, PNG o JPEG, de hasta 2 MB');
    // Un PNG de 1×1 con un píxel DISTINTO en cada corrida: el Banco de archivos reconoce el contenido repetido y devuelve el
    // mismo archivo, de modo que con la foto idéntica a la del perfil público (otra prueba sube la suya) quitar la de la
    // agenda dejaba ver la del perfil con la MISMA dirección y la comprobación «la dirección cambió» fallaba.
    const png = pngDeUnPixel(Date.now());
    await persona.locator('#foto-del-participante').setInputFiles({ name: 'mi-foto.png', mimeType: 'image/png', buffer: png });
    await expect(persona.locator('[data-testid="aviso"]')).toContainText('Guardamos tu foto', { timeout: 20_000 });
    await expect(bloque.locator('img')).toHaveCount(1);
    const subida = await bloque.locator('img').getAttribute('src');
    await bloque.getByRole('button', { name: 'Quitar foto' }).click();
    // Sin la foto de la agenda se vuelve a la de su perfil público, si la tiene, o a las iniciales.
    await expect.poll(async () => bloque.locator('img').first().getAttribute('src', { timeout: 1000 }).catch(() => null), { timeout: 20_000 }).not.toBe(subida);

    await persona.locator('[data-testid="salir-de-la-agenda"]').click();
    await confirmar(persona, 'Prueba de la lista de espera.');
    await expect(persona.locator('[data-testid="aviso"]')).toContainText('Saliste de la agenda');
  });

  test('el portal dice que el Mercado tiene abierta su agenda y no enseña a ninguna persona', { tag: '@backend' }, async ({ page }) => {
    await page.goto('/ecosistema/agenda-de-citas', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Agenda de citas', level: 1 })).toBeVisible();
    const lista = page.locator('[data-testid="agendas-publicas"]');
    await expect(lista).toContainText(MERCADO);
    await expect(lista).toContainText('Inscripción abierta');
    await expect(lista).toContainText('4 de 4 lugares');
    // Ni artistas ni compradores ni correos: solo el Mercado y su cupo.
    await expect(page.locator('#contenido-principal')).not.toContainText('Diana Zapata');
    await expect(page.locator('#contenido-principal')).not.toContainText('@');
  });
});
