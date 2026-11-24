import { test, expect, type Page } from '@playwright/test';

/**
 * Movimiento del portal público: tokens únicos, modo «reducir movimiento» y transición entre pantallas.
 *
 * Solo lectura. Necesita el entorno levantado (`SIMUS_BASE_URL`), como el resto de `e2e/`:
 *
 *   SIMUS_BASE_URL=http://localhost:4300 npx playwright test e2e/movimiento-y-transiciones.spec.ts
 *
 * Lo que fija:
 *  1. Los tokens de movimiento existen y respetan el techo de 600 ms para entradas y 200 ms para interfaz.
 *  2. Con `prefers-reduced-motion: reduce`: ninguna animación visible sigue en curso (salvo la inmediata de 1 ms) y
 *     NADA queda oculto por la clase de aparición `.revelar`.
 *  3. Sin esa preferencia, ninguna entrada de bloque dura más de 600 ms y solo se animan propiedades que no mueven el diseño.
 *  4. La navegación entre pantallas usa transición de vista (fundido) y no produce desplazamiento de diseño; con «reducir
 *     movimiento» no hay transición.
 */

const RUTAS = ['/', '/pnmc', '/agenda', '/noticias', '/editorial', '/ecosistema/festivales', '/ecosistema/territorios-sonoros'];
const PROPIEDADES_DE_DISENO = /^(height|width|top|left|right|bottom|margin|padding|max-height|min-height|max-width|flex|grid|gap|font|line-height)/i;

/** Cuenta cuántas transiciones de vista inicia Angular y cuántas de ellas se saltan (`skipTransition`). */
async function contarTransiciones(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: number; __omitidas: number };
    w.__vt = 0; w.__omitidas = 0;
    const d = document as unknown as { startViewTransition?: (...a: unknown[]) => { skipTransition: () => void } };
    const original = d.startViewTransition;
    if (!original) return;
    d.startViewTransition = function (this: Document, ...a: unknown[]) {
      w.__vt++;
      const t = original.apply(this, a);
      const saltar = t.skipTransition.bind(t);
      t.skipTransition = () => { w.__omitidas++; saltar(); };
      return t;
    };
  });
}
const transiciones = (page: Page) => page.evaluate(() => { const w = window as unknown as { __vt: number; __omitidas: number }; return { iniciadas: w.__vt, omitidas: w.__omitidas }; });

async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
}

const vivas = (page: Page) => page.evaluate(() =>
  document.getAnimations().map((a) => {
    const t = a.effect?.getComputedTiming?.();
    const props = new Set<string>();
    a.effect?.getKeyframes?.().forEach((k) => Object.keys(k).forEach((p) => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p); }));
    return { estado: a.playState, duracion: typeof t?.duration === 'number' ? t.duration : 0, infinita: t?.iterations === Infinity, props: [...props], nombre: (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? '' };
  }));

test.describe('Tokens de movimiento', () => {
  test('existen y respetan los techos del criterio (interfaz 200 ms, entrada 500 ms)', async ({ page }) => {
    await abrir(page, '/');
    const t = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const v = (n: string) => css.getPropertyValue(n).trim();
      return { rapida: v('--dur-rapida'), media: v('--dur-media'), entrada: v('--dur-entrada'), latido: v('--dur-latido'), distancia: v('--distancia-entrada'), escalon: v('--escalon'), tope: v('--escalon-tope'), curva: v('--ease-soft') };
    });
    // El build de producción reescribe los valores a su forma más corta (`.12s`, `cubic-bezier(.22,1,.36,1)`): se
    // comparan por valor (en milisegundos y con los números normalizados), no por cómo estén escritos.
    const normal = (valor: string): string => valor
      .replace(/(^|[^\w.])(\d*\.?\d+)(ms|s)\b/g, (_t, antes: string, n: string, u: string) => `${antes}${Math.round(Number(n) * (u === 's' ? 1000 : 1))}ms`)
      .replace(/(^|[^\w.])\.(\d)/g, '$10.$2')
      .replace(/\s+/g, '');
    const esperado = { rapida: '120ms', media: '200ms', entrada: '500ms', latido: '1200ms', distancia: '1rem', escalon: '70ms', tope: '420ms', curva: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    expect(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, normal(v)])))
      .toEqual(Object.fromEntries(Object.entries(esperado).map(([k, v]) => [k, normal(v)])));
  });
});

test.describe('Con «reducir movimiento»', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  for (const ruta of RUTAS) {
    test(`${ruta}: nada se mueve y nada queda oculto`, async ({ page }) => {
      await abrir(page, ruta);
      const enCurso = (await vivas(page)).filter((a) => a.estado === 'running' && a.duracion > 1);
      expect(enCurso, `animaciones visibles en ${ruta}`).toEqual([]);
      const ocultos = await page.evaluate(() => [...document.querySelectorAll('.revelar')].filter((e) => getComputedStyle(e).opacity === '0').length);
      expect(ocultos, 'elementos ocultos por .revelar').toBe(0);
    });
  }

  test('la navegación entre pantallas salta la transición de vista', async ({ page }) => {
    await contarTransiciones(page);
    await abrir(page, '/');
    await page.evaluate(() => (document.querySelector('a[href="/agenda"]') as HTMLElement | null)?.click());
    await page.waitForURL('**/agenda');
    await page.waitForTimeout(300);
    const t = await transiciones(page);
    expect(t.omitidas).toBe(t.iniciadas);
  });
});

test.describe('Sin esa preferencia', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  for (const ruta of RUTAS) {
    test(`${ruta}: las entradas duran a lo sumo 600 ms y no animan el diseño`, async ({ page }) => {
      await page.addInitScript(() => {
        // Se registra TODA animación que empiece, aunque termine antes de que se pueda mirar.
        const visto: { nombre: string; duracion: number; props: string[] }[] = [];
        (window as unknown as { __anim: typeof visto }).__anim = visto;
        const mirar = () => document.getAnimations().forEach((a) => {
          const t = a.effect?.getComputedTiming?.();
          if (!t || t.iterations === Infinity) return;
          const props = new Set<string>();
          a.effect?.getKeyframes?.().forEach((k) => Object.keys(k).forEach((p) => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p); }));
          visto.push({ nombre: (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? '', duracion: Number(t.duration), props: [...props] });
        });
        setInterval(mirar, 100);
      });
      await abrir(page, ruta);
      const registro = await page.evaluate(() => (window as unknown as { __anim: { nombre: string; duracion: number; props: string[] }[] }).__anim);
      // Las transiciones de UN solo estado de interfaz (puntero, foco) no se disparan al cargar; aquí solo hay entradas.
      const largas = registro.filter((a) => a.duracion > 600 && !/orbita|bounce|spin|pulse|latido/.test(a.nombre));
      expect(largas, 'entradas de más de 600 ms').toEqual([]);
      const dedisenio = registro.filter((a) => a.props.some((p) => PROPIEDADES_DE_DISENO.test(p)) && !/orbita|bounce|spin|pulse|latido/.test(a.nombre));
      expect(dedisenio, 'animaciones que mueven el diseño').toEqual([]);
    });
  }

  test('de una pantalla a otra hay fundido de vista y el diseño no se mueve', async ({ page }) => {
    await contarTransiciones(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await abrir(page, '/');
    const soportada = await page.evaluate(() => 'startViewTransition' in document);
    test.skip(!soportada, 'Este navegador no trae la API de transiciones de vista: la navegación es instantánea.');
    const antes = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    await page.evaluate(() => ([...document.querySelectorAll('a[href="/noticias"]')].find((e) => (e as HTMLElement).offsetParent) as HTMLElement | undefined)?.click());
    await page.waitForURL('**/noticias');
    await page.waitForTimeout(1500);
    const t = await transiciones(page);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(t.iniciadas, 'transiciones de vista iniciadas').toBe(1);
    expect(t.omitidas, 'transiciones saltadas').toBe(0);
    expect(cls - antes, 'desplazamiento de diseño durante la navegación').toBeLessThan(0.05);
    // El contenido nunca queda a medias: la página nueva es visible y su opacidad final es 1.
    await expect(page.locator('#contenido-principal')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#contenido-principal')!).opacity)).toBe('1');
  });

  test('cambiar solo la dirección de la misma pantalla (filtros, página) salta la transición: la lista no parpadea', async ({ page }) => {
    await contarTransiciones(page);
    await abrir(page, '/noticias');
    // Un retroceso/avance dentro de la misma pantalla: el enrutador navega a `/noticias?q=musica`, la pantalla es la misma.
    await page.evaluate(() => { history.pushState({}, '', '/noticias?q=musica'); dispatchEvent(new PopStateEvent('popstate', { state: {} })); });
    await page.waitForTimeout(800);
    const t = await transiciones(page);
    expect(t.omitidas).toBe(t.iniciadas);
  });
});
