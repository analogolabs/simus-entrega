import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { GaleriaPageComponent } from './galeria-page.component';
import { AlbumDeGaleria, AlbumDeGaleriaResumen, GaleriaService, ItemDeGaleria, ItemPublicoDeGaleria } from '../../../../core/services/galeria.service';

const RESUMEN = (slug: string, fecha: string, fotos: number, videos: number, extra: Partial<AlbumDeGaleriaResumen> = {}): AlbumDeGaleriaResumen => ({
  slug, titulo: `Álbum ${slug}`, descripcion: 'Descripción.', tipo: videos && fotos ? 'mixto' : videos ? 'videos' : 'fotos', lugar: 'Bogotá, D. C.', fechaReferencia: fecha,
  portadaUrl: `/api/v1/publico/archivos/${slug.length}`, totalFotos: fotos, totalVideos: videos, listaOrigenUrl: null, publicado: true, ...extra,
});
const FOTO = (id: number): ItemDeGaleria => ({
  id, tipoItem: 'foto', orden: id, titulo: null, descripcion: null, fecha: null, credito: 'Archivo PNMC', textoAlternativo: `Foto ${id}`, archivoId: id, url: `/api/v1/publico/archivos/${id}`,
  videoId: null, urlYoutube: null, duracionSegundos: null, ancho: 1600, alto: 1070,
});
const VIDEO = (id: number, videoId: string): ItemDeGaleria => ({
  id, tipoItem: 'video', orden: id, titulo: `Voces y Saberes: ${videoId}`, descripcion: 'Resumen.', detalle: 'Texto completo largo.', fecha: '2026-08-06', credito: 'PNMC', textoAlternativo: null,
  archivoId: null, url: null, videoId, urlYoutube: `https://www.youtube.com/watch?v=${videoId}`, duracionSegundos: 377, miniaturaUrl: `/api/v1/publico/archivos/${id + 100}`,
});
const PUBLICO = (i: ItemDeGaleria, album: string | null): ItemPublicoDeGaleria => ({
  id: i.id, tipoItem: i.tipoItem, titulo: i.titulo, descripcion: i.descripcion, fecha: i.fecha, credito: i.credito, textoAlternativo: i.textoAlternativo, url: i.url,
  miniaturaUrl: i.miniaturaUrl ?? null, videoId: i.videoId, urlYoutube: i.urlYoutube, duracionSegundos: i.duracionSegundos, ancho: i.ancho ?? null, alto: i.alto ?? null,
  albumSlug: album, albumTitulo: album ? `Álbum ${album}` : null, albumLugar: album ? 'Bogotá, D. C.' : null, albumFecha: album ? '2026-04-07' : null, detalle: i.detalle ?? null,
});
const ALBUM = (r: AlbumDeGaleriaResumen, items: ItemDeGaleria[]): AlbumDeGaleria => ({
  slug: r.slug, titulo: r.titulo, descripcion: r.descripcion, tipo: r.tipo, lugar: r.lugar, fechaReferencia: r.fechaReferencia, portadaUrl: r.portadaUrl, listaOrigenUrl: r.listaOrigenUrl,
  publicado: true, portadaArchivoId: null, orden: 1, fechaActualizacion: null, items,
});

describe('GaleriaPageComponent', () => {
  const resumenes = [
    RESUMEN('voces', '2026-08-06', 0, 2, { listaOrigenUrl: 'https://youtube.com/playlist?list=PLx' }), RESUMEN('rock', '2026-04-07', 3, 0),
    RESUMEN('congreso', '2025-09-11', 3, 0), RESUMEN('mixto', '2025-09-10', 1, 1), RESUMEN('calle', '2025-09-09', 2, 0),
  ];
  const items: Record<string, ItemDeGaleria[]> = {
    voces: [VIDEO(1, 'Rv5Oiq8UXi0'), VIDEO(2, 'FqTfFxwH8QA')], rock: [FOTO(11), FOTO(12), FOTO(13)], congreso: [FOTO(21), FOTO(22), FOTO(23)], mixto: [FOTO(31), VIDEO(32, 'MHIY0k8ZCmY')], calle: [FOTO(41), FOTO(42)],
  };
  let servicio: { albumes: jasmine.Spy; album: jasmine.Spy; items: jasmine.Spy };
  let h: RouterTestingHarness;

  async function montar(url: string, lista = resumenes, sueltos: ItemPublicoDeGaleria[] = []): Promise<HTMLElement> {
    const fotos = lista.flatMap(r => (items[r.slug] ?? []).filter(i => i.tipoItem === 'foto').map(i => PUBLICO(i, r.slug)));
    const videos = lista.flatMap(r => (items[r.slug] ?? []).filter(i => i.tipoItem === 'video').map(i => PUBLICO(i, r.slug)));
    servicio = {
      albumes: jasmine.createSpy('albumes').and.resolveTo({ ok: true, data: { items: lista, totales: { albumes: lista.length, fotos: fotos.length + sueltos.filter(s => s.tipoItem === 'foto').length, videos: videos.length, sueltos: sueltos.length } } }),
      album: jasmine.createSpy('album').and.callFake(async (slug: string) => ({ ok: true, data: items[slug] && lista.some(r => r.slug === slug) ? ALBUM(lista.find(r => r.slug === slug)!, items[slug]) : null })),
      items: jasmine.createSpy('items').and.callFake(async (clase: string) => {
        const l = clase === 'fotos' ? fotos : clase === 'videos' ? videos : sueltos;
        return { ok: true, data: { items: l, total: l.length } };
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: GaleriaService, useValue: servicio },
        provideRouter([{ path: 'galeria', component: GaleriaPageComponent, children: [{ path: 'album/:slug', children: [] }, { path: ':vista', children: [] }] }]),
      ],
    });
    h = await RouterTestingHarness.create();
    await h.navigateByUrl(url, GaleriaPageComponent);
    await h.fixture.whenStable();
    h.detectChanges();
    await h.fixture.whenStable();
    h.detectChanges();
    return h.routeNativeElement as HTMLElement;
  }

  async function ir(url: string): Promise<void> {
    await h.navigateByUrl(url);
    await h.fixture.whenStable();
    h.detectChanges();
    await h.fixture.whenStable();
    h.detectChanges();
  }

  const texto = (el: Element | null) => el?.textContent ?? '';

  it('sin nada publicado dice que aún no hay contenido', async () => {
    const el = await montar('/galeria', []);
    expect(el.querySelector('[data-testid="galeria-vacia"]')).not.toBeNull();
    expect(texto(el)).toContain('Aún no hay contenido visual publicado');
  });

  it('ofrece las cuatro pestañas con sus conteos y NO un selector de álbumes ni botones de tipo', async () => {
    const el = await montar('/galeria');
    const tabs = Array.from(el.querySelectorAll('[role="tab"]')).map(t => (t.textContent ?? '').replace(/\s+/g, ''));
    expect(tabs).toEqual(['Álbumes5', 'Fotos9', 'Videos3', 'Sinálbum0']);
    expect(el.querySelector('select')).toBeNull();
    expect(el.querySelector('[data-testid^="galeria-tipo-"]')).toBeNull();
  });

  it('la portada muestra el álbum más reciente y el mosaico de álbumes trae los demás, cada uno con su conteo rotulado', async () => {
    const el = await montar('/galeria');
    expect(texto(el.querySelector('[data-testid="galeria-hero"] h1'))).toContain('Álbum voces');
    const tarjetas = Array.from(el.querySelectorAll('[data-testid="galeria-albumes"] li'));
    expect(tarjetas.length).toBe(4);
    expect(el.querySelector('[data-testid="album-voces"]')).toBeNull();
    expect(texto(el.querySelector('[data-testid="album-mixto"]'))).toContain('1 foto · 1 video');
    expect(el.querySelector('[data-testid="album-rock"]')!.getAttribute('href')).toBe('/galeria/album/rock');
  });

  it('un álbum se abre desde su dirección: cabecera, mosaico y visor con la información a la derecha', async () => {
    const el = await montar('/galeria/album/rock');
    expect(texto(el.querySelector('[data-testid="galeria-album"] h1'))).toContain('Álbum rock');
    expect(el.querySelectorAll('[data-testid="galeria-items"] li').length).toBe(3);
    (el.querySelector('[data-testid="foto-12"]') as HTMLButtonElement).click();
    await h.fixture.whenStable();
    h.detectChanges();
    const visor = el.querySelector<HTMLDialogElement>('dialog')!;
    expect(visor.open).toBeTrue();
    const info = el.querySelector('[data-testid="galeria-visor-info"]')!;
    expect(info.tagName).toBe('ASIDE');
    expect(texto(info)).toContain('Archivo PNMC');
    expect(texto(el.querySelector('.cuenta'))).toContain('2 / 3');
    visor.close();
  });

  it('un álbum de videos muestra miniaturas propias y no pide nada a YouTube hasta «Reproducir»', async () => {
    const el = await montar('/galeria/album/voces');
    expect(el.querySelectorAll('iframe').length).toBe(0);
    expect(el.innerHTML).not.toContain('ytimg.com');
    expect(el.innerHTML).not.toContain('youtube-nocookie.com/embed');
    expect(el.querySelector('.player__imagen')!.getAttribute('src')).toBe('/api/v1/publico/archivos/101');
    expect(el.querySelector('[data-testid="galeria-lista"]')!.getAttribute('href')).toBe('https://youtube.com/playlist?list=PLx');
    expect(texto(el.querySelector('[data-testid="galeria-video-detalle"]'))).toContain('Texto completo largo.');
    (el.querySelector('[data-testid="galeria-reproducir"]') as HTMLButtonElement).click();
    h.detectChanges();
    const marcos = el.querySelectorAll('iframe');
    expect(marcos.length).toBe(1);
    expect(marcos[0].getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/Rv5Oiq8UXi0?autoplay=1&rel=0');
  });

  it('la pestaña Fotos agrupa por álbum y la de Videos lista todos los videos con fecha y duración', async () => {
    const el = await montar('/galeria/fotos');
    expect(el.querySelectorAll('[data-testid="galeria-fotos"] section').length).toBe(4);
    await ir('/galeria/videos?video=FqTfFxwH8QA');
    expect(texto(el.querySelector('[data-testid="galeria-video-titulo"]'))).toContain('FqTfFxwH8QA');
    expect(el.querySelectorAll('[data-testid="galeria-lista-videos"] li').length).toBe(3);
    expect(texto(el.querySelector('.vdatos'))).toContain('6 de agosto de 2026');
    expect(texto(el.querySelector('.vdatos'))).toContain('6 min 17 s');
  });

  it('«Sin álbum» lista los archivos sueltos y avisa cuando no hay', async () => {
    const suelta = PUBLICO(FOTO(90), null);
    const el = await montar('/galeria/sin-album', resumenes, [suelta, PUBLICO(VIDEO(91, 'ahrHwtptkoA'), null)]);
    expect(el.querySelectorAll('[data-testid="galeria-sueltos"] li').length).toBe(2);
    expect(el.querySelector('[data-testid="foto-90"]')).not.toBeNull();
  });

  it('«Sin álbum» sin archivos dice que no hay', async () => {
    const el = await montar('/galeria/sin-album');
    expect(el.querySelector('[data-testid="galeria-sin-sueltos"]')).not.toBeNull();
  });

  it('un álbum que no existe avisa y ofrece volver', async () => {
    const el = await montar('/galeria/album/no-existe');
    expect(el.querySelector('[data-testid="galeria-album-no-existe"]')).not.toBeNull();
  });

  it('si el servicio falla muestra el motivo y «Reintentar»', async () => {
    servicio = { albumes: jasmine.createSpy().and.resolveTo({ ok: false, error: 'Sin conexión.' }), album: jasmine.createSpy(), items: jasmine.createSpy() };
    TestBed.configureTestingModule({ providers: [{ provide: GaleriaService, useValue: servicio }, provideRouter([{ path: 'galeria', component: GaleriaPageComponent, children: [{ path: ':vista', children: [] }] }])] });
    h = await RouterTestingHarness.create();
    await h.navigateByUrl('/galeria', GaleriaPageComponent);
    await h.fixture.whenStable();
    h.detectChanges();
    const el = h.routeNativeElement as HTMLElement;
    expect(texto(el.querySelector('[data-testid="galeria-error"]'))).toContain('Sin conexión.');
    expect(texto(el.querySelector('[data-testid="galeria-error"] button'))).toContain('Reintentar');
  });

  describe('ajustes de la Galería (3)', () => {
    afterEach(() => { jasmine.clock().uninstall(); });
    const paso = async () => { await h.fixture.whenStable(); h.detectChanges(); };

    it('si la consola marcó álbumes como «Destacados», el encabezado rota entre ellos y no entre los más recientes', async () => {
      const marcados = resumenes.map(r => (r.slug === 'calle' || r.slug === 'congreso' ? { ...r, destacado: true } : r));
      const el = await montar('/galeria', marcados);
      const hero = el.querySelector('[data-testid="galeria-hero"]')!;
      expect(el.querySelectorAll('[data-testid^="galeria-hero-punto-"]').length).toBe(2);
      expect(texto(hero.querySelector('h1'))).toContain('Álbum congreso');
      expect(texto(hero)).not.toContain('Álbum voces');
    });

    it('el encabezado rota entre los tres álbumes más recientes, se pausa con el botón y el foco, y se elige uno con los indicadores', async () => {
      jasmine.clock().install();
      const el = await montar('/galeria');
      const hero = () => el.querySelector('[data-testid="galeria-hero"]')!;
      expect(texto(hero().querySelector('.et--oro'))).toContain('Destacados');
      expect(texto(hero())).not.toContain('Álbum más reciente');
      expect(el.querySelectorAll('[data-testid^="galeria-hero-punto-"]').length).toBe(3);
      expect(texto(hero().querySelector('h1'))).toContain('Álbum voces');
      expect(hero().querySelector('.hero__texto')!.getAttribute('aria-live')).toBe('off');
      jasmine.clock().tick(6100); await paso();
      expect(texto(hero().querySelector('h1'))).toContain('Álbum rock');
      // El foco pausa; al salir, sigue.
      hero().dispatchEvent(new Event('focusin', { bubbles: true })); await paso();
      jasmine.clock().tick(13000); await paso();
      expect(texto(hero().querySelector('h1'))).toContain('Álbum rock');
      hero().dispatchEvent(new Event('focusout', { bubbles: true })); await paso();
      jasmine.clock().tick(6100); await paso();
      expect(texto(hero().querySelector('h1'))).toContain('Álbum congreso');
      // El botón de pausa detiene la rotación.
      (el.querySelector('[data-testid="galeria-hero-pausa"]') as HTMLButtonElement).click(); await paso();
      jasmine.clock().tick(20000); await paso();
      expect(texto(hero().querySelector('h1'))).toContain('Álbum congreso');
      expect(el.querySelector('[data-testid="galeria-hero-pausa"]')!.getAttribute('aria-label')).toContain('Reanudar');
      expect(hero().querySelector('.hero__texto')!.getAttribute('aria-live')).toBe('polite');
      // Un indicador elige directamente.
      (el.querySelector('[data-testid="galeria-hero-punto-0"]') as HTMLButtonElement).click(); await paso();
      expect(texto(hero().querySelector('h1'))).toContain('Álbum voces');
      expect(el.querySelector('[data-testid="galeria-hero-punto-0"]')!.getAttribute('aria-current')).toBe('true');
    });

    it('con un álbum de videos arriba, cada miniatura lleva a un video concreto', async () => {
      const el = await montar('/galeria');
      const enlaces = Array.from(el.querySelectorAll<HTMLAnchorElement>('[data-testid="galeria-hero-video"]'));
      expect(enlaces.map(a => a.getAttribute('href'))).toEqual(['/galeria/album/voces?video=Rv5Oiq8UXi0', '/galeria/album/voces?video=FqTfFxwH8QA']);
    });

    it('con «reducir movimiento» no rota solo ni ofrece pausa, pero los indicadores siguen funcionando', async () => {
      jasmine.clock().install();
      spyOn(window, 'matchMedia').and.returnValue({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as MediaQueryList);
      const el = await montar('/galeria');
      jasmine.clock().tick(30000); await paso();
      expect(texto(el.querySelector('[data-testid="galeria-hero"] h1'))).toContain('Álbum voces');
      expect(el.querySelector('[data-testid="galeria-hero-pausa"]')).toBeNull();
      (el.querySelector('[data-testid="galeria-hero-punto-1"]') as HTMLButtonElement).click(); await paso();
      expect(texto(el.querySelector('[data-testid="galeria-hero"] h1'))).toContain('Álbum rock');
    });

    it('en «Fotos», cada álbum largo se previsualiza con un máximo de 3 filas y «Ver álbum completo» abre el álbum', async () => {
      items['rock'] = Array.from({ length: 40 }, (_, i) => FOTO(100 + i));
      const el = await montar('/galeria/fotos', [RESUMEN('rock', '2026-04-07', 40, 0), RESUMEN('calle', '2025-09-09', 2, 0)]);
      await new Promise(r => setTimeout(r, 80)); await paso();
      const grupos = el.querySelectorAll('[data-testid="galeria-fotos"] section.grupo');
      const filasDe = (g: Element) => new Set(Array.from(g.querySelectorAll('li')).map(li => (li as HTMLElement).offsetTop)).size;
      expect(filasDe(grupos[0])).toBeLessThanOrEqual(3);
      expect(grupos[0].querySelectorAll('li').length).toBeLessThan(40);
      const ver = el.querySelector('[data-testid="ver-album-rock"]') as HTMLAnchorElement;
      expect(ver.getAttribute('href')).toBe('/galeria/album/rock');
      expect(texto(ver)).toContain('40 fotos');
      // El álbum corto se muestra entero y no ofrece «Ver álbum completo».
      expect(grupos[1].querySelectorAll('li').length).toBe(2);
      expect(el.querySelector('[data-testid="ver-album-calle"]')).toBeNull();
      items['rock'] = [FOTO(11), FOTO(12), FOTO(13)];
    });

    it('dentro de un álbum hay migas y «Volver» a la vista de origen', async () => {
      const el = await montar('/galeria/fotos');
      await ir('/galeria/album/rock');
      expect(texto(el.querySelector('[data-testid="galeria-volver-boton"]'))).toContain('Volver a Fotos');
      const migas = el.querySelector('nav.crumb')!;
      expect(texto(migas).replace(/\s+/g, '')).toContain('Galería›Fotos›Álbumrock');
      expect(el.querySelector('[data-testid="galeria-miga-origen"]')!.getAttribute('href')).toBe('/galeria/fotos');
      (el.querySelector('[data-testid="galeria-volver-boton"]') as HTMLButtonElement).click();
      await paso(); await paso();
      expect(h.routeNativeElement && (TestBed.inject(Router)).url).toBe('/galeria/fotos');
    });

    it('con la dirección directa de un álbum, «Volver» lleva a Álbumes', async () => {
      const el = await montar('/galeria/album/rock');
      expect(texto(el.querySelector('[data-testid="galeria-volver-boton"]'))).toContain('Volver a Álbumes');
      (el.querySelector('[data-testid="galeria-volver-boton"]') as HTMLButtonElement).click();
      await paso(); await paso();
      expect(TestBed.inject(Router).url).toBe('/galeria');
    });

    it('en un álbum con videos, el reproductor también ofrece «Volver»', async () => {
      const el = await montar('/galeria/videos');
      await ir('/galeria/album/voces');
      expect(texto(el.querySelector('[data-testid="galeria-reproductor-volver"]'))).toContain('Volver a Videos');
    });

    it('cambiar de pestaña conserva la barra de pestañas y el panel con altura mínima estable', async () => {
      const el = await montar('/galeria');
      const barra = el.querySelector('[data-testid="galeria-pestanas"]');
      const panel = () => el.querySelector('#galeria-panel') as HTMLElement;
      expect(parseFloat(getComputedStyle(panel()).minHeight)).toBeGreaterThan(200);
      await ir('/galeria/videos');
      expect(el.querySelector('[data-testid="galeria-pestanas"]')).toBe(barra);
      expect(panel().classList).toContain('panel');
      expect(parseFloat(getComputedStyle(panel()).minHeight)).toBeGreaterThan(200);
      expect(el.querySelector('[role="tab"][aria-selected="true"]')!.getAttribute('data-pestana')).toBe('videos');
    });
  });
});
