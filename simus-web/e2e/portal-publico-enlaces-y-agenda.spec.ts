import { test, expect, type Page } from '@playwright/test';

/**
 * El portal público como lo recorre una persona.
 *
 * Necesita la API y la base de demostración (`@backend`): los eventos y las noticias vienen de ella.
 * Se corre a mano contra el entorno vivo:
 *
 *   SIMUS_BASE_URL=http://localhost:4319 npx playwright test e2e/portal-publico-enlaces-y-agenda.spec.ts
 *
 * LO QUE FIJA, de la auditoría del portal:
 *   · el evento de la Agenda tiene dirección propia y sobrevive a la recarga;
 *   · «Más información» lleva a algo, y la lista empieza por lo que viene;
 *   · la navegación son enlaces: se abren en otra pestaña y se recorren con el teclado;
 *   · un recurso que no existe dice qué pasó y adónde ir, igual en todas las pantallas.
 */

interface EventoResumido { slug: string; titulo: string; fechaInicio: string; situacion: string }

async function eventosProximos(page: Page, tamano = 3): Promise<EventoResumido[]> {
  const respuesta = await page.request.get(`/api/v1/publico/agenda?cuando=proximos&tamano=${tamano}`);
  expect(respuesta.ok(), 'la API pública de Agenda no contestó').toBeTruthy();
  const cuerpo = await respuesta.json() as { items: EventoResumido[] };
  expect(cuerpo.items.length, 'la base de demostración no tiene eventos por venir').toBeGreaterThan(0);
  return cuerpo.items;
}

test.describe('Agenda: cada evento con su dirección', { tag: '@backend' }, () => {
  test('lista → detalle por URL → recarga', async ({ page }) => {
    const [primero] = await eventosProximos(page, 1);

    await page.goto('/agenda');
    // La lista empieza por lo que viene: el primer evento de la página es el primero que el servidor
    // da como próximo, y ninguno de los visibles ya terminó.
    const filas = page.locator('[id^="agenda-item-"]');
    await expect(filas.first()).toBeVisible();
    await expect(filas.first().locator('h2')).toHaveText(primero.titulo);
    // Sin «Próximos / Pasados / Todos» (G6): por omisión solo lo que viene.
    await expect(page.locator('[data-tiempo]')).toHaveCount(0);

    // El acordeón dice si está abierto, y «Más información» lleva a la ficha del evento.
    const disparador = filas.first().locator('button[aria-expanded]').first();
    await expect(disparador).toHaveAttribute('aria-expanded', 'false');
    await disparador.click();
    await expect(disparador).toHaveAttribute('aria-expanded', 'true');
    const masInformacion = filas.first().locator('[data-testid="agenda-mas-informacion"]');
    await expect(masInformacion).toHaveAttribute('href', `/agenda/${primero.slug}`);
    await masInformacion.click();

    await expect(page).toHaveURL(new RegExp(`/agenda/${primero.slug}$`));
    await expect(page.locator('h1')).toHaveText(primero.titulo);
    await expect(page.locator('[data-testid="evento-cuando"]')).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${primero.titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · Agenda`));

    // La dirección es suya: recargar no la pierde.
    await page.reload();
    await expect(page.locator('h1')).toHaveText(primero.titulo);
    await expect(page.locator('[data-testid="evento-agenda"]')).toBeVisible();

    // Y desde la ficha se vuelve a la lista.
    // A-7: con el enlace común de regreso, no con una flecha de texto.
    await page.getByRole('link', { name: 'Volver a la agenda' }).first().click();
    await expect(page).toHaveURL(/\/agenda$/);
  });

  test('A-1, A-7: un filtro se quita con su «X», «Limpiar filtros» está sobre la lista y «Volver a la agenda» devuelve los filtros', async ({ page }) => {
    await page.goto('/agenda');
    await page.locator('#agenda-lista-eventos').waitFor();
    // La vista elegida y el selector van en la línea del título (A-4), solo con iconos con nombre.
    await expect(page.locator('#agenda-lista-eventos').getByRole('button', { name: 'Vista de mosaico' })).toBeVisible();

    await page.locator('#agenda-filtros nav button').nth(1).click();
    const chips = page.locator('[data-testid="agenda-filtros-aplicados"]');
    await expect(chips).toBeVisible();
    await expect(chips.locator('app-chip-de-filtro')).toHaveCount(1);
    await expect(chips.getByRole('button', { name: 'Limpiar filtros' })).toBeVisible();

    // Abrir un evento y volver: la lista conserva el filtro.
    await page.locator('button[aria-controls^="agenda-detalle-"]').first().click();
    await page.locator('[data-testid="agenda-mas-informacion"]').first().click();
    await page.getByRole('link', { name: 'Volver a la agenda' }).first().click();
    await expect(page).toHaveURL(/categoria=/);
    await expect(page.locator('[data-testid="agenda-filtros-aplicados"] app-chip-de-filtro')).toHaveCount(1);

    // La «X» del chip quita ese filtro y nada más.
    await page.locator('[data-testid="agenda-filtros-aplicados"] .chip__quitar').first().click();
    await expect(page.locator('[data-testid="agenda-filtros-aplicados"]')).toHaveCount(0);
  });

  test('A-6: «Añadir a mi calendario» es un menú con Google Calendar, Outlook y el archivo .ics bien formado', async ({ page }) => {
    const [primero] = await eventosProximos(page, 1);
    await page.goto(`/agenda/${primero.slug}`);
    await page.locator('[data-testid="evento-calendario"]').click();
    const google = page.getByRole('menuitem', { name: /Google Calendar/ });
    const outlook = page.getByRole('menuitem', { name: /Outlook/ });
    await expect(google).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
    await expect(outlook).toHaveAttribute('href', /^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose/);

    const descarga = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /Descargar archivo/ }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toMatch(/\.ics$/);
    const ruta = await archivo.path();
    const { readFileSync } = await import('node:fs');
    const ics = readFileSync(ruta, 'utf8');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('UID:' + primero.slug + '@simus-web');
    expect(ics).toMatch(/DTSTART(;VALUE=DATE|;TZID=America\/Bogota):/);
    expect(ics).toContain('URL:');
    expect(ics).toContain('BEGIN:VALARM');
  });

  test('la fecha abre lo ya realizado: año y mes aparte, el mes solo con su nombre, y viajan en la dirección', async ({ page }) => {
    await page.goto('/agenda');
    // Tres maneras de acotar la fecha en un selector segmentado, no tres botones de tiempo.
    await page.locator('app-selector-segmentado [data-opcion="month"]').click();

    const anio = page.locator('[data-filtro="anio-de-agenda"]');
    const mes = page.locator('[data-filtro="mes-de-agenda"]');
    await anio.click();
    const opcionesDeAnio = await page.locator('[role="listbox"] [role="option"]').allInnerTexts();
    expect(opcionesDeAnio.join(' ')).toMatch(/Todos los años/);
    await page.locator('[role="option"]', { hasText: /^\s*20\d\d/ }).first().click();

    await mes.click();
    const etiquetasDeMes = await page.locator('[role="listbox"] [role="option"] span:first-child').allInnerTexts();
    // Solo el nombre del mes, en minúscula y sin año: nada de «NOVIEMBRE 2026».
    for (const etiqueta of etiquetasDeMes.filter(e => !/^Todos/.test(e))) {
      expect(etiqueta, 'el mes lleva año o mayúscula sostenida').toMatch(/^[a-záéíóúñ]+$/);
    }
    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/anio=20\d\d/);
    await page.reload();
    await page.locator('[data-filtro="anio-de-agenda"]').waitFor();
    await expect(page).toHaveURL(/anio=20\d\d/);
  });

  test('los controles del panel de filtros miden lo mismo y ninguno está en mayúsculas sostenidas', async ({ page }) => {
    await page.goto('/agenda');
    await page.locator('app-selector-segmentado [data-opcion="month"]').click();

    const controles = page.locator('#agenda-filtros app-filtro-desplegable .filtro__control');
    // Los filtros se pintan al cargar los catálogos: se espera a que estén todos en vez de medir en el primer cuadro.
    await expect.poll(() => controles.count()).toBeGreaterThanOrEqual(3);
    const alturas = await controles.evaluateAll(
      cajas => cajas.map(caja => Math.round(caja.getBoundingClientRect().height)));
    expect(new Set(alturas).size, `alturas distintas: ${alturas.join(', ')}`).toBe(1);

    const anchos = await page.locator('#agenda-filtros app-filtro-desplegable[class*="completo"]').evaluateAll(
      cajas => cajas.map(caja => Math.round(caja.getBoundingClientRect().width)));
    // Departamento y municipio, a todo el ancho del panel, miden lo mismo.
    const [departamento, municipio] = anchos.slice(-2);
    expect(departamento).toBe(municipio);

    const enMayuscula = await page.locator('#agenda-filtros').evaluate(panel =>
      [...panel.querySelectorAll('label span, app-filtro-desplegable *, button')]
        .filter(el => getComputedStyle(el).textTransform === 'uppercase' && !el.closest('h4'))
        .map(el => (el.textContent ?? '').trim().slice(0, 30)));
    expect(enMayuscula, 'controles con mayúsculas sostenidas').toEqual([]);
  });

  test('desde la portada, un evento de «Próximamente» abre ese evento', async ({ page }) => {
    const [primero] = await eventosProximos(page, 1);

    await page.goto('/');
    const tarjeta = page.locator('[data-testid="portada-evento"]').first();
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toHaveAttribute('href', `/agenda/${primero.slug}`);
    await tarjeta.click();

    await expect(page).toHaveURL(new RegExp(`/agenda/${primero.slug}$`));
    await expect(page.locator('h1')).toHaveText(primero.titulo);
  });

  test('las tarjetas de «Próximamente» no se superponen: categoría, título y lugar en renglones propios', async ({ page }) => {
    await page.goto('/');
    const tarjetas = page.locator('[data-testid="portada-evento"]');
    await expect(tarjetas.first()).toBeVisible();

    // ESPERAR A QUE LA PÁGINA DEJE DE MOVERSE. La portada es larga y las tarjetas están muy abajo:
    // mientras cargan las fuentes y las imágenes de arriba, todo lo de abajo se desplaza unos
    // píxeles. Antes se leían las cajas de los hijos y, en otra llamada, la de la tarjeta; si la
    // maquetación se movía entre las dos lecturas, la prueba fallaba por ~3 px de forma intermitente
    // aunque el CSS estuviera bien.
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(img => img.complete ? null : new Promise<void>(r => { img.addEventListener('load', () => r()); img.addEventListener('error', () => r()); })));
    });

    // Y UNA SOLA LECTURA para toda la medición: tarjeta y bloques salen del mismo instante.
    const medidas = await tarjetas.evaluateAll(lista => lista.map(tarjeta => {
      const c = tarjeta.getBoundingClientRect();
      const bloques = [...tarjeta.querySelectorAll('span.flex.min-w-0.flex-col > *')].map(nodo => {
        const r = nodo.getBoundingClientRect(); return { arriba: r.top, abajo: r.bottom };
      });
      return { arriba: c.top, abajo: c.bottom, bloques };
    }));
    expect(medidas.length).toBeGreaterThan(0);

    medidas.forEach((m, i) => {
      // Los hijos de la columna de texto se apilan: cada uno empieza donde termina el anterior.
      for (let j = 1; j < m.bloques.length; j++) {
        expect(m.bloques[j].arriba, `tarjeta ${i}: el bloque ${j} se encima al anterior`).toBeGreaterThanOrEqual(m.bloques[j - 1].abajo - 1);
      }
      // Y la tarjeta contiene a todos sus bloques.
      if (m.bloques.length) { expect(m.bloques[m.bloques.length - 1].abajo).toBeLessThanOrEqual(m.abajo + 1); }
    });
  });

  test('un evento que no existe dice qué pasó y ofrece la lista y el inicio', async ({ page }) => {
    await page.goto('/agenda/este-evento-no-existe');
    await expect(page.locator('h1')).toHaveText('No encontramos ese evento');
    await expect(page.locator('[data-testid="rne-lista"]')).toHaveAttribute('href', '/agenda');
    await expect(page.locator('[data-testid="rne-inicio"]')).toHaveAttribute('href', '/');
    await page.locator('[data-testid="rne-lista"]').click();
    await expect(page).toHaveURL(/\/agenda$/);
  });
});

test.describe('Navegación: enlaces reales y teclado', { tag: '@backend' }, () => {
  test('la cabecera son enlaces con dirección, con Galería, y el clic central abre otra pestaña', async ({ page, context }) => {
    await page.goto('/');
    const cabecera = page.getByRole('navigation', { name: 'Navegación principal' });

    for (const [nombre, href] of [['Noticias', '/noticias'], ['Agenda', '/agenda'], ['Editorial', '/editorial'], ['Galería', '/galeria'], ['PNMC', '/pnmc']] as const) {
      const enlace = cabecera.getByRole('link', { name: nombre, exact: true });
      await expect(enlace).toHaveAttribute('href', href);
    }
    await expect(cabecera.getByRole('link', { name: /SIMUS, Sistema de información de la música/i })).toHaveAttribute('href', '/');

    // Clic central: abre en pestaña nueva y la actual no se mueve.
    // Bajo carga el clic central a veces abre la pestaña pero esta se queda en blanco (o no se abre): el intento completo
    // —clic, pestaña nueva y dirección alcanzada— se reintenta hasta tres veces antes de dar el fallo.
    let llego = false;
    for (let intento = 0; intento < 3 && !llego; intento++) {
      const nueva = context.waitForEvent('page', { timeout: 10_000 }).catch(() => undefined);
      await cabecera.getByRole('link', { name: 'Agenda', exact: true }).click({ button: 'middle' });
      const pestana = await nueva;
      if (!pestana) continue;
      llego = await expect(pestana).toHaveURL(/\/agenda$/, { timeout: 8_000 }).then(() => true, () => false);
      if (!llego) await pestana.close().catch(() => undefined);
    }
    if (!llego) throw new Error('El clic central no abrió la agenda en una pestaña nueva tras tres intentos.');
    expect(page.url()).toMatch(/\/$/);
  });

  test('con el teclado: se llega al enlace, se ve el foco, Enter navega y el desplegable del PNMC se abre y se cierra', async ({ page }) => {
    await page.goto('/noticias');
    await page.waitForLoadState('networkidle');

    // Tabular hasta «PNMC»: es un enlace y abre su panel al recibir el foco.
    let nombre = '';
    for (let i = 0; i < 12 && nombre !== 'PNMC'; i++) {
      await page.keyboard.press('Tab');
      nombre = await page.evaluate(() => (document.activeElement?.textContent ?? '').trim());
    }
    expect(nombre).toBe('PNMC');
    const foco = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const e = getComputedStyle(el);
      return { etiqueta: el.tagName, aria: el.getAttribute('aria-expanded'), sombra: e.boxShadow !== 'none' };
    });
    expect(foco.etiqueta).toBe('A');
    expect(foco.sombra, 'el enlace con foco no muestra señal visible').toBe(true);
    // Angular pinta el panel después del evento de foco: se espera la señal en vez de leerla al instante.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-expanded')))
      .toBe('true');

    // El panel cabe en la ventana y sus componentes son enlaces alcanzables con Tab.
    const panel = page.locator('[data-testid="panel-pnmc"]');
    await expect(panel).toBeVisible();
    const caja = await panel.boundingBox();
    const ancho = page.viewportSize()!.width;
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho);
    await page.keyboard.press('Tab');
    const siguiente = await page.evaluate(() => ({ etiqueta: document.activeElement?.tagName, href: document.activeElement?.getAttribute('href') }));
    expect(siguiente.etiqueta).toBe('A');
    expect(siguiente.href).toMatch(/^\/pnmc/);

    // Escape lo cierra.
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    // Enter sobre un enlace de la barra navega sin recargar.
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Agenda', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/agenda$/);
  });

  test('el desplegable de Ecosistema lista solo los procesos que existen, sin cifras ni catálogos transversales', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Ecosistema', exact: true }).hover();
    const enlaces = page.locator('[data-testid="ecosystem-tool-item"]');
    // POR NOMBRE Y NO POR CANTIDAD NI POSICIÓN: los procesos que van saliendo de «en preparación» (Lutería
    // ya salió; Redes y Espacios vienen) añaden entradas, y la prueba no tiene que reescribirse con cada uno.
    await expect(page.locator('[data-testid="ecosystem-tool-item"][href="/ecosistema/festivales"]')).toHaveCount(1);
    expect(await enlaces.count()).toBeGreaterThanOrEqual(4);
    // TERRITORIOS SONOROS Y PRÁCTICAS MUSICALES NO ESTÁN EN EL MENÚ (decisión 60): son catálogos
    // transversales y viven en el cuerpo de `/ecosistema`.
    await expect(page.locator('[data-testid="ecosystem-tool-item"][href="/ecosistema/territorios-sonoros"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="ecosystem-tool-item"][href="/ecosistema/practicas-musicales"]')).toHaveCount(0);
    // Lutería, Espacios y Redes ya están disponibles: son enlaces del menú, y el bloque «en preparación» solo
    // existe mientras quede algún proceso sin directorio (hoy ninguno). Si reaparece, no puede tener controles.
    for (const ruta of ['luteria', 'espacios', 'redes']) {
      await expect(page.locator(`[data-testid="ecosystem-tool-item"][href="/ecosistema/${ruta}"]`)).toHaveCount(1);
    }
    await expect(page.locator('[data-testid="ecosistema-en-preparacion"] a, [data-testid="ecosistema-en-preparacion"] button')).toHaveCount(0);

    // Sin cifras de registros en el menú (decisión 65): no hacen falta para elegir un directorio.
    await expect(page.locator('[data-testid="ecosystem-tool-count"]')).toHaveCount(0);
  });
});
