import { test, expect, type Page } from '@playwright/test';
import { abrirSeccionDeLaBarra } from './apoyo/barra-de-la-consola';
import { mkdirSync } from 'node:fs';

/**
 * El recorrido de un editor real sobre una pestaña del CMS, de principio a fin.
 *
 * Lo que esta prueba aporta y ninguna otra cubre: aquí NADA se pide por API. Se
 * escribe en la casilla, se pulsa el botón, se lee el aviso que sale en pantalla
 * y se abre la página pública en otra pestaña para mirar el resultado con los
 * ojos. Es la única forma de comprobar la promesa central del sistema —«guardar
 * no es publicar»— tal y como la vive quien lo usa, y no como la cuenta el
 * servidor.
 *
 * `panel-fidelidad` comprueba que el panel no deforma lo que muestra; esta
 * comprueba que el panel HACE lo que dice. Son preguntas distintas.
 *
 * Deja capturas numeradas en `e2e/capturas/<pestaña>/` para poder revisar a ojo
 * cada paso: un aviso verde que dice «se guardó» mientras el sitio no cambió es
 * exactamente el defecto original de este panel, y una aserción sobre el DOM no
 * lo habría distinguido de lo correcto.
 *
 * PARA AÑADIR UNA PESTAÑA basta con una fila en `PESTANAS`. Se hizo así al
 * llegar la segunda: el cuerpo de la prueba no tiene nada de Home, y copiarlo
 * once veces habría garantizado que once copias se desincronizaran.
 *
 * Repone el estado previo al terminar, incluso si falla a mitad.
 */

const CREDENCIALES = {
  email: process.env.SIMUS_ADMIN_EMAIL ?? process.env.PNMC_ADMIN_EMAIL ?? 'webmaster@simus.test',
  password: process.env.SIMUS_ADMIN_PASSWORD ?? process.env.PNMC_ADMIN_PASSWORD ?? 'admin',
};

/**
 * Qué se edita en cada pestaña.
 *
 * Se elige un campo **corto y visible en la parte alta de la página**: si el
 * texto de prueba quedara enterrado tras un desplazamiento, la comprobación de
 * «ya se ve en el sitio» dependería de la altura de la ventana.
 */
const PESTANAS = [
  {
    pestana: 'Portada',
    // La etiqueta superior se retiró el 5 oct 2026 y el lema la sustituyó (ver el editor de Home).
    grupo: 'Encabezado Principal (Hero)',
    campo: 'Lema',
    clave: 'home_hero_lema',
    ruta: '/',
  },
  {
    pestana: 'PNMC',
    grupo: 'Hero y Presentación',
    campo: 'Hero - Antetítulo (nombre del Plan)',
    clave: 'about_hero_tag',
    ruta: '/pnmc',
  },
  {
    pestana: 'Ecosistema',
    grupo: 'Encabezado',
    campo: 'Antetítulo',
    clave: 'ecosistema_hero_tag',
    ruta: '/ecosistema',
  },
  {
    // La pestaña «Navegación y Footer» sale en TODAS las páginas, así que no
    // hay una ruta suya. Se usa la del 404 porque sus cinco claves solo se ven
    // ahí, y porque a esa página se llega justamente por no acertar ninguna
    // ruta: cualquier dirección inventada vale.
    pestana: 'Barra y pie',
    grupo: 'Página no encontrada (error 404)',
    campo: 'Rótulo superior',
    clave: 'notfound_eyebrow',
    ruta: '/esta-ruta-no-existe',
  },
  {
    // Se edita el título del primer eje, que la página pinta como cabecera del
    // bloque y el mega-menú repite en su desplegable.
    //
    // Aquí decía «la pestaña con más claves armadas en tiempo de ejecución: 23
    // de 32», y las dos mitades estaban mal. No es la que más arma —recontado
    // contra el catálogo, «Sobre PNMC» arma 33 y «Home» 24, frente a las 23 de
    // esta—; y «23 de 32» mezclaba dos cuentas distintas: el panel declara 32,
    // de las cuales 9 sí aparecen escritas en la portada, así que 23 es lo que
    // reporta `cms:huerfanas`, no lo que arma el resolvedor. Arma las 32.
    //
    // Lo que sí hace distinta a esta fila: la clave no está escrita en ninguna
    // parte del resolvedor, se deduce de la POSICIÓN del eje en el arreglo
    // compilado. Si alguien reordena los ejes, este campo pasa a gobernar otro
    // bloque sin que falle nada, y esta prueba lo vería antes que un visitante.
    pestana: 'PNMC',
    grupo: 'Eje 1 - Música para la Vida',
    campo: 'Título del Eje',
    clave: 'eje01_title',
    ruta: '/ejes',
  },
  // FALTAN «Galería» Y «Agenda», Y ES DELIBERADO: sus portadas dejaron de ser textos editables del
  // CMS (las secciones del editor son hoy ocho: Home, Sobre PNMC, Mapa, Ejes, Estrategias,
  // Ecosistema, Registro y Navegación y Footer) y las claves `gallery_hero_title` y
  // `agenda_hero_title` ya no existen en el registro. Una fila aquí buscaría una pestaña que no
  // está y la prueba fallaría por eso y no por lo que mide.
  {
    // La portada de acceso externo. Es la unica pestana cuyos textos incluyen
    // dos ETIQUETAS DE CONSENTIMIENTO, asi que conviene que su circuito de
    // publicacion este medido: lo que se publica aqui es lo que alguien acepta.
    pestana: 'Registro',
    grupo: 'Portada de acceso externo',
    campo: 'Rótulo superior · Registrarse',
    clave: 'access_eyebrow',
    ruta: '/registro',
  },
  // FALTA «Mapa Ecosistemico», Y ES DELIBERADO.
  //
  // `map_tutorial` es el unico grupo del catalogo que nadie ha publicado nunca:
  // sus 14 claves tienen `Publicado = NULL` y la pagina tira del texto del
  // registro. Esta prueba publica y luego repone publicando de nuevo, asi que
  // pasar por aqui dejaria el grupo publicado PARA SIEMPRE — y no hay vuelta
  // atras por la API: `retire` responde 409 si la clave no esta publicada y,
  // cuando lo esta, deja marca de retirada, que es otro estado. Volver exige SQL.
  //
  // Es la misma razon por la que `cms:ciclo` se planta ante este grupo salvo que
  // se le pase `--publicar-por-primera-vez`. Quien quiera medirlo, que lo haga a
  // conciencia y sabiendo que cambia el estado.
] as const;

/** Marca con hora para que dos corridas seguidas no se confundan entre sí. */
const marcador = () => `PRUEBA ORGANICA ${new Date().toISOString().slice(11, 19)}`;

async function abrirGrupo(page: Page, pestana: string, grupo: string) {
  // «CMS» es el área de la consola; los textos son una de sus seis posiciones.
  // `visible`: el menú lateral tiene además un disparador plegado con el mismo texto, oculto.
  await abrirSeccionDeLaBarra(page, 'CMS');
  await page.getByRole('group', { name: 'Áreas de Gestión del sitio' })
    .getByRole('button', { name: /Textos y páginas/ }).click();
  // Se ancla en las pestañas de sección, que solo existen con el editor de textos abierto.
  await expect(page.getByTestId('section-tabs')).toBeVisible();

  await page.getByTestId('section-tabs').getByRole('button', { name: pestana, exact: true }).click();
  // Desde los grupos son cabeceras de acordeon, no una lista aparte.
  // Se localiza por el prefijo del testid y no por rol dentro del contenedor: con un bloque
  // abierto, el contenedor tambien tiene los botones de historial y de imagen dentro.
  const cabecera = page.locator('[data-testid^="bloque-"]', { hasText: grupo }).first();
  // Pulsar una cabecera YA ABIERTA la pliega. El primer bloque de cada seccion se estrena
  // abierto, asi que abrir a ciegas dejaria el formulario sin pintar.
  if ((await cabecera.getAttribute('aria-expanded')) !== 'true') { await cabecera.click(); }
  await expect(page.getByRole('button', { name: 'Guardar Borrador' })).toBeEnabled();
}

async function entrarAlPanel(page: Page) {
  // El tour de bienvenida cubre la pantalla en cada perfil nuevo del navegador.
  // Se marca como visto por su clave en vez de pulsar por él: no depende de sus
  // textos y no es lo que esta prueba mide.
  await page.addInitScript((email) => {
    window.localStorage.setItem(`pnmc_tour_seen_${email}`, '1');
  }, CREDENCIALES.email);

  await page.goto('/administracion');
  await page.locator('input[type="email"]').fill(CREDENCIALES.email);
  await page.locator('input[type="password"]').fill(CREDENCIALES.password);
  await page.getByRole('button', { name: 'Entrar al panel' }).click();
  // La consola abre en su tablero; el editor de textos es una posición de «Páginas y bloques
  // (CMS)», y de llegar ahí se encarga `abrirGrupo`.
  await expect(page.getByRole('navigation', { name: 'Secciones de la consola' }).getByRole('button', { name: 'Sitio web y comunicación' })).toBeVisible();
}

/**
 * La casilla de un campo, localizada por su rótulo como haría una persona.
 *
 * `getByLabel` sigue la asociación `<label for>` ↔ `id`, que es exactamente el
 * vínculo que usa quien mira la pantalla: «la casilla que está debajo de este
 * rótulo». Un localizador por parentesco de `div` —el primer intento— eligió el
 * campo equivocado y la prueba pasó igualmente, escribiendo en la descripción
 * mientras el nombre decía «etiqueta superior». Se descubrió mirando la captura,
 * no ejecutando la prueba: ninguna aserción lo habría delatado.
 *
 * Por eso además se verifica el `id`. Una prueba que puede editar el campo
 * equivocado en silencio es peor que no tenerla, porque da una confianza que no
 * corresponde a lo que mide.
 */
async function casilla(page: Page, rotulo: string, clave: string) {
  const campo = page.getByLabel(rotulo, { exact: true });
  await expect(campo, `«${rotulo}» no resolvió a la casilla de ${clave}`)
    .toHaveAttribute('id', `campo-${clave}`);
  return campo;
}

/**
 * Lo que un visitante lee hoy en esa página, con las mayúsculas del CMS.
 *
 * Se usa `textContent` y no `innerText` a propósito: `innerText` devuelve el
 * texto **ya transformado por CSS**, y medio portal lleva `text-transform:
 * uppercase`. Comparar contra él hacía fallar la comprobación de Ecosistema —
 * el CMS guarda «Ecosistema musical de Colombia» y la migaja de pan lo pinta
 * «ECOSISTEMA MUSICAL DE COLOMBIA»— y, peor, hacía que Home y Sobre PNMC
 * pasaran por casualidad, porque su marcador ya iba en mayúsculas.
 *
 * `textContent` devuelve lo que hay en el DOM, que es lo que el CMS puso. El
 * `text-transform` es presentación y no es lo que esta prueba mide.
 */
async function textoPublico(page: Page, ruta: string): Promise<string> {
  const publica = await page.context().newPage();
  await publica.goto(ruta, { waitUntil: 'networkidle' });
  const texto = ((await publica.locator('body').textContent()) ?? '').replace(/\s+/g, ' ');
  await publica.close();
  return texto;
}

for (const caso of PESTANAS) {
  const CAPTURAS = `e2e/capturas/${caso.pestana.toLowerCase().replace(/\s+/g, '-')}`;

  test(`${caso.pestana}: un editor escribe, guarda, publica y repone, y el sitio obedece en cada paso`,
    { tag: '@backend' }, async ({ page }) => {
    test.setTimeout(4 * 60_000);
    mkdirSync(CAPTURAS, { recursive: true });

    await entrarAlPanel(page);
    await abrirGrupo(page, caso.pestana, caso.grupo);

    const campo = await casilla(page, caso.campo, caso.clave);
    const original = await campo.inputValue();
    const nuevo = marcador();
    expect(original, 'la casilla llegó vacía: el grupo no cargó del servidor').not.toBe('');
    expect(original, 'la base conserva el marcador de una corrida anterior: repón el texto original antes de repetir').not.toContain('PRUEBA ORGANICA');
    await page.screenshot({ path: `${CAPTURAS}/01-estado-inicial.png` });

    try {
      // ---- 1. Escribir y guardar como borrador -----------------------------
      await campo.fill(nuevo);
      await page.screenshot({ path: `${CAPTURAS}/02-texto-escrito.png` });

      await page.getByRole('button', { name: 'Guardar Borrador' }).click();
      const aviso = page.locator('.animate-fade-in').filter({ hasText: /se guardó|no fue posible|no se guardó/i });
      await expect(aviso).toBeVisible({ timeout: 15_000 });
      const textoDelAviso = (await aviso.innerText()).replace(/\s+/g, ' ');
      await page.screenshot({ path: `${CAPTURAS}/03-aviso-tras-guardar.png` });

      // El aviso tiene que decir que NO está publicado. Un «se guardó» a secas
      // fue el defecto original: la persona se iba creyendo que ya estaba en el
      // sitio.
      expect(textoDelAviso.toLowerCase()).toContain('borrador');
      expect(textoDelAviso.toLowerCase()).toContain('publicar');

      // ---- 2. La página pública NO debe haber cambiado ---------------------
      const trasGuardar = await textoPublico(page, caso.ruta);
      expect(trasGuardar, 'guardar un borrador cambió el sitio público').not.toContain(nuevo);
      expect(trasGuardar).toContain(original);

      // ---- 3. El borrador sobrevive a recargar -----------------------------
      await page.reload();
      await abrirGrupo(page, caso.pestana, caso.grupo);
      await expect(await casilla(page, caso.campo, caso.clave)).toHaveValue(nuevo, { timeout: 15_000 });
      await page.screenshot({ path: `${CAPTURAS}/04-borrador-tras-recargar.png` });

      // ---- 4. Publicar ------------------------------------------------------
      await page.getByRole('button', { name: /Guardar y Publicar/i }).click();
      const avisoPublicado = page.locator('.animate-fade-in').filter({ hasText: /publicó|no fue posible/i });
      await expect(avisoPublicado).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${CAPTURAS}/05-aviso-tras-publicar.png` });
      expect((await avisoPublicado.innerText()).toLowerCase()).toContain('publicó');

      // ---- 5. Ahora sí, el sitio lo muestra --------------------------------
      const publica = await page.context().newPage();
      await publica.goto(caso.ruta, { waitUntil: 'networkidle' });
      // `getByText` compara sobre el texto ya transformado por CSS, así que se
      // busca sin distinguir mayúsculas: media página lleva `uppercase`.
      await expect(publica.getByText(new RegExp(nuevo, 'i')).first()).toBeVisible({ timeout: 15_000 });
      await publica.screenshot({ path: `${CAPTURAS}/06-pagina-publicada.png` });
      await publica.close();

      // ---- 6. El historial lo registró, y no crece sin techo ---------------
      // El desplegable del campo bajo prueba, no «el primero de la página»:
      // cada campo del grupo tiene el suyo y confiar en el orden es el mismo
      // error que ya cometió el localizador de la casilla.
      const abrirHistorial = page.locator(
        `xpath=//*[@id="campo-${caso.clave}"]/following::button[contains(., "Ver historial")][1]`);
      await abrirHistorial.click();
      await page.screenshot({ path: `${CAPTURAS}/07-historial.png` });

      const cuantas = Number(((await abrirHistorial.innerText()).match(/\((\d+)\)/) ?? [])[1] ?? '0');
      expect(cuantas, 'el historial no registró la edición').toBeGreaterThan(0);
      // El tope vive en `PodaDelHistorialContenidoWeb.Tope`, del lado del API.
      // Aquí se repite el número porque esta prueba no puede leer C#, pero el
      // comentario dice dónde está el original para que no se olvide.
      //
      // SI ESTO FALLA, MIRE PRIMERO CONTRA QUÉ API ESTÁ CORRIENDO. La poda vive
      // en el servidor, así que un proceso arrancado ANTES de que se escribiera
      // no poda nada y el historial crece sin techo — y el síntoma es
      // exactamente este, en las seis pestañas a la vez. Pasó el 22 ago 2026: el
      // `ng serve` del 4300 apunta al 8180 (`proxy.conf.cjs`), y ese proceso
      // llevaba quince horas arriba con un binario anterior a la poda. Se
      // comprueba con `Get-Process -Name SIMUS.Api | Select StartTime` contra la
      // fecha de `PodaDelHistorialContenidoWeb.cs`. Reiniciar la API basta: el
      // arranque corre `PodarTodoAsync` y deja la base al día.
      //
      // Que falle en UNA sola pestaña sí apunta a la poda; que falle en todas,
      // casi nunca.
      expect(cuantas, 'el historial superó el tope de 6 entradas por clave').toBeLessThanOrEqual(6);
    } finally {
      // ---- 7. Reponer, pase lo que pase ------------------------------------
      await page.reload();
      await abrirGrupo(page, caso.pestana, caso.grupo);
      // «Rellenar, pulsar y ver la respuesta» se repite como una unidad hasta que la petición salga: bajo carga el botón aún no
      // aceptaba el clic tras recargar y la reposición no se enviaba (la base quedaba con el marcador publicado). Es
      // idempotente: reponer dos veces el mismo original deja lo mismo.
      await expect(async () => {
        await (await casilla(page, caso.campo, caso.clave)).fill(original);
        // SE ESPERA LA RESPUESTA DE LA PETICIÓN, NO EL AVISO. El aviso «publicó» de la publicación anterior sigue en
        // pantalla unos segundos y satisfacía la espera al instante: la prueba navegaba a la portada antes de que
        // terminara la petición de reposición, la petición se perdía y el marcador quedaba publicado (visto en el
        // barrido del 13 nov 2026: la base conservaba «PRUEBA ORGANICA» y la siguiente corrida lo tomaba por original).
        const reposicion = page.waitForResponse(r => r.url().includes('/contenido-web/') && r.request().method() !== 'GET', { timeout: 6_000 });
        await page.getByRole('button', { name: /Guardar y Publicar/i }).click();
        expect((await reposicion).ok(), 'la petición que repone el texto original').toBe(true);
      }).toPass({ timeout: 45_000 });
      await expect(page.locator('.animate-fade-in').filter({ hasText: /publicó/i })).toBeVisible({ timeout: 15_000 });
    }

    // ---- 8. Y el sitio quedó como estaba -----------------------------------
    const alFinal = await textoPublico(page, caso.ruta);
    expect(alFinal).toContain(original);
    expect(alFinal).not.toContain('PRUEBA ORGANICA');
    await page.screenshot({ path: `${CAPTURAS}/08-repuesto.png` });
  });
}
