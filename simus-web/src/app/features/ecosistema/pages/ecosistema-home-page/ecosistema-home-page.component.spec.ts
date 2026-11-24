import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { EcosistemaHomePageComponent } from './ecosistema-home-page.component';
import { NavigationService, PAGE_PATHS } from '../../../../core/services/navigation.service';
import { CATEGORIAS_ECOSISTEMA, procesosActivos } from '../../../../core/services/categorias-ecosistema.config';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { DEFAULT_TEXTS, WEB_TEXT_GROUPS } from '../../../../core/cms/registro-de-textos-web';

/**
 * PORTADA REEMPLAZADA POR LA DEL REPOSITORIO DE REFERENCIA, a pedido
 * explícito de la dirección de producto («reemplazo literal, sin excepciones»): la estructura, la
 * redacción y la composición son las de la referencia, adaptadas a los seis procesos definidos
 * para SIMUS. La edición por CMS se restituyó el mismo día: cada bloque de texto vuelve a leer
 * `texto()`/`imagen()` en vez de texto fijo, reutilizando los seis grupos `ecosistema_*` que ya
 * existían en el registro.
 */
describe('EcosistemaHomePageComponent', () => {
  /** Las claves de la portada; las de los directorios (Festivales/Escuelas) se prueban aparte. */
  const CLAVES_DE_LA_PORTADA = WEB_TEXT_GROUPS
    .filter((g) => g.section === 'Ecosistema' && g.id !== 'ecosistema_directorios')
    .flatMap((g) => g.fields.map((f) => f.key));

  let fixture: ComponentFixture<EcosistemaHomePageComponent>;
  let http: HttpTestingController;
  let navegacion: NavigationService;

  const flushConteos = () => {
    const peticiones = http.match(() => true);
    peticiones.forEach((req) => req.flush({ records: [] }));
  };

  const montar = async (publicados: Record<string, string> = {}) => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EcosistemaHomePageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const textos = TestBed.inject(TextosWebService);
    spyOn(textos, 'getWebText').and.callFake((clave: string) => publicados[clave] ?? DEFAULT_TEXTS[clave] ?? '');

    fixture = TestBed.createComponent(EcosistemaHomePageComponent);
    http = TestBed.inject(HttpTestingController);
    navegacion = TestBed.inject(NavigationService);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    await montar();
  });

  afterEach(() => {
    // `fetchMapCountsBundle` dispara sus seis peticiones en `ngOnInit`, aunque la prueba no le
    // interese el recuento: hay que vaciarlas todas o `verify()` las marca como abiertas.
    http.match(() => true).forEach((req) => req.flush({ records: [] }));
    http.verify();
  });

  it('la portada declara sus ocho bloques de texto editable', () => {
    const grupos = WEB_TEXT_GROUPS
      .filter((g) => g.section === 'Ecosistema' && g.id !== 'ecosistema_directorios')
      .map((g) => g.id);

    expect(grupos).toEqual([
      'ecosistema_hero',
      'ecosistema_about',
      'ecosistema_explore',
      'ecosistema_map',
      'ecosistema_categories',
      'ecosistema_participate',
      'ecosistema_lecturas',
      'ecosistema_personas_tarjeta',
    ]);
  });

  it('los textos publicados llegan TODOS a la pantalla', async () => {
    const publicados = Object.fromEntries(CLAVES_DE_LA_PORTADA.map((k) => [k, `<<${k}>>`]));
    await montar(publicados);
    flushConteos();
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;

    expect(CLAVES_DE_LA_PORTADA.filter((k) => !texto.includes(`<<${k}>>`))).toEqual([]);
  });

  it('sin nada publicado la página conserva su texto de fábrica', () => {
    const texto: string = fixture.nativeElement.textContent;

    expect(texto).toContain(DEFAULT_TEXTS['ecosistema_about_title']);
    expect(texto).toContain(DEFAULT_TEXTS['ecosistema_join_desc']);
  });

  /**
   * LAS TARJETAS SON LAS DE `CATEGORIAS_ECOSISTEMA`, no las de la referencia: esa lista reúne
   * Espacios para música en vivo, Festivales, Mercados, Redes y Lutería —Escuelas queda fuera por
   * decisión de la dirección—, y no existe equivalente en el repositorio de referencia para
   * Agrupaciones ni Agentes. El título y la
   * descripción de cada tarjeta son datos del proceso, no del CMS.
   */
  it('la rejilla de directorios pinta los procesos definidos para SIMUS y ninguno de Escuelas', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const tarjetas = raiz.querySelectorAll('h3');
    const titulos = Array.from(tarjetas).map((el) => el.textContent?.trim());

    CATEGORIAS_ECOSISTEMA.filter((c) => c.proceso).forEach((categoria) => {
      expect(titulos).toContain(categoria.title);
    });
    // ESCUELAS QUEDA FUERA (10 nov 2026): no se anuncia ni como próximo.
    expect(titulos.some((titulo) => /escuelas/i.test(titulo ?? ''))).toBeFalse();
  });

  it('los directorios públicos salen en el orden fijo: Festivales, Mercados, Redes, Lutería y Espacios (decisión 118)', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const titulos = Array.from(raiz.querySelectorAll('[data-testid="directorios-publicos"] h3')).map(el => el.textContent?.trim());

    expect(titulos).toEqual(['Festivales', 'Mercados musicales', 'Redes y documentación', 'Lutería', 'Espacios para música en vivo']);
  });

  it('las tarjetas son exactamente los procesos activos del catálogo', () => {
    expect(fixture.componentInstance.primaryCategories()).toEqual(procesosActivos(CATEGORIAS_ECOSISTEMA));
  });

  it('las tarjetas se reparten el ancho: lista flexible que se estira, sin rejilla de columnas fijas', () => {
    const lista = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="directorios-publicos"]')!;
    expect(lista.className).toContain('flex-wrap');
    expect(lista.className).not.toMatch(/grid-cols/);
    Array.from(lista.children).forEach(li => expect(li.className).toContain('flex-1'));
  });

  it('cada tarjeta disponible es un enlace a su ruta, y las que no tienen directorio no son controles', () => {
    spyOn(navegacion, 'routerNavigate');
    const raiz = fixture.nativeElement as HTMLElement;
    const disponible = CATEGORIAS_ECOSISTEMA.find(categoria => categoria.status === 'Disponible')!;
    const tarjeta = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('a.group'))
      .find(enlace => enlace.textContent?.includes(disponible.title))!;

    // Tiene su dirección real: se puede abrir en otra pestaña y copiar.
    expect(tarjeta.getAttribute('href')).toBe('/' + disponible.route!);
    // El clic normal navega dentro de la aplicación; con Ctrl se lo deja al navegador.
    const visto: boolean[] = [];
    raiz.addEventListener('click', evento => { visto.push(evento.defaultPrevented); evento.preventDefault(); });
    tarjeta.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(navegacion.routerNavigate).not.toHaveBeenCalled();
    tarjeta.click();
    expect(navegacion.routerNavigate).toHaveBeenCalledWith(disponible.route!);
    expect(visto).toEqual([false, true]);

    // Lo que esté «Próximamente» se nombra pero no es un enlace ni un botón. Desde el 10 de noviembre de 2026
    // (Espacios para música en vivo y Redes y documentación ya tienen directorio) no queda ningún proceso así:
    // todos son enlaces con su dirección; si vuelve a haber uno, debe seguir sin ser un control.
    const enPreparacion = CATEGORIAS_ECOSISTEMA.filter(categoria => categoria.proceso && !categoria.route);
    enPreparacion.forEach(categoria => {
      const bloque = Array.from(raiz.querySelectorAll('h3')).find(h => h.textContent?.includes(categoria.title))!;
      expect(bloque.closest('a, button')).toBeNull();
    });
    CATEGORIAS_ECOSISTEMA.filter(categoria => categoria.proceso && categoria.route).forEach(categoria => {
      const enlace = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('a.group'))
        .find(a => a.textContent?.includes(categoria.title));
      expect(enlace?.getAttribute('href')).withContext(categoria.title).toBe('/' + categoria.route!);
    });
  });

  it('el botón «ver en el mapa» abre el mapa en la capa general', () => {
    const irAlMapa = spyOn(navegacion, 'navigateToMapLayer');
    const raiz = fixture.nativeElement as HTMLElement;
    const boton = Array.from(raiz.querySelectorAll('button')).find((b) => b.textContent?.includes(DEFAULT_TEXTS['ecosistema_map_cta']))!;

    boton.click();

    expect(irAlMapa).toHaveBeenCalledOnceWith('General', { targetView: 'map' });
  });

  it('«explorar» lleva al mapa, a editorial y a noticias, y las tres rutas existen', () => {
    const destinos = fixture.componentInstance.accessPaths().map((r) => r.title);
    expect(destinos).toEqual([
      DEFAULT_TEXTS['ecosistema_explore_map_title'],
      DEFAULT_TEXTS['ecosistema_explore_editorial_title'],
      DEFAULT_TEXTS['ecosistema_explore_news_title'],
    ]);
    expect(PAGE_PATHS['mapa']).toBe('/mapa-ecosistemico');
    expect(PAGE_PATHS['editorial']).toBe('/editorial');
    expect(PAGE_PATHS['noticias']).toBe('/noticias');
  });

  it('«consulta contenidos» navega a editorial', () => {
    const ir = spyOn(navegacion, 'navigate');
    fixture.componentInstance.accessPaths()[1].action();
    expect(ir).toHaveBeenCalledWith('editorial');
  });

  it('«ver ayuda y tutoriales» navega a ecosistema/ayuda', () => {
    spyOn(navegacion, 'routerNavigate');
    fixture.componentInstance.go('ecosistema/ayuda');
    expect(navegacion.routerNavigate).toHaveBeenCalledWith('ecosistema/ayuda');
  });

  it('«contacto» navega a El Plan, donde está el equipo', () => {
    spyOn(navegacion, 'routerNavigate');
    fixture.componentInstance.openContact();
    expect(navegacion.routerNavigate).toHaveBeenCalledWith('pnmc');
  });

  /**
   * ESPACIOS PARA MÚSICA EN VIVO NO TIENE `countKey`: `fetchMapCountsBundle` no lo consulta, así que la tarjeta no
   * anuncia una cifra que no puede respaldar.
   */
  it('no inventa el recuento de un proceso que no lo tiene', () => {
    // Se busca por título: desde una revisión anterior, un proceso sin pantalla NO declara ruta.
    const redes = CATEGORIAS_ECOSISTEMA.find((c) => c.title === 'Redes y documentación')!;
    expect(redes.countKey).toBeUndefined();
    expect(fixture.componentInstance.count(redes)).toBe(0);
  });

  it('resuelve los recuentos reales desde fetchMapCountsBundle', () => {
    flushConteos();
    fixture.detectChanges();

    expect(fixture.componentInstance.isLoadingEcosystem()).toBeFalse();
    const festivales = CATEGORIAS_ECOSISTEMA.find((c) => c.route === 'ecosistema/festivales')!;
    expect(fixture.componentInstance.count(festivales)).toBe(0);
  });
});
