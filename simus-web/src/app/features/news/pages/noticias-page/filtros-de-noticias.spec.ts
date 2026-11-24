import { DEFAULT_TEXTS } from '../../../../core/cms/registro-de-textos-web';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoticiasPageComponent } from './noticias-page.component';
import { NoticiasService } from '../../../../core/services/noticias.service';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { BoletinService } from '../../../../core/services/boletin.service';

/**
 * Los filtros de Noticias, y la categoría que los pone desde una tarjeta.
 *
 * <b>LO QUE ESTAS PRUEBAS IMPIDEN.</b> Dos cosas que el §10 nombra.
 *
 * <ul>
 *   <li>Que los filtros vuelvan a vivir solo en señales. Antes, filtrar por «Convocatorias» y
 *       pasarle el enlace a alguien le abría la lista entera; recargar lo perdía; y volver de una
 *       noticia al listado también —siendo que la noticia abierta SÍ era enlazable desde hacía
 *       cortes, porque vive en la ruta—.</li>
 *   <li>Que la categoría de una tarjeta vuelva a ser texto muerto habiendo un filtro por categoría
 *       tres párrafos más arriba.</li>
 * </ul>
 */
describe('las Noticias se filtran y la consulta se puede compartir', () => {
  let fixture: ComponentFixture<NoticiasPageComponent>;
  let componente: NoticiasPageComponent;

  const noticia = (id: number, category: string) => ({
    id, title: `Noticia ${id}`, desc: 'Resumen', content: '<p>Cuerpo</p>',
    category, date: `2026-09-0${id}`, img: '', slug: `noticia-${id}`,
  });

  // Las tres primeras alimentan el destacado y el par secundario; el listado empieza en la cuarta.
  const NOTICIAS = [
    noticia(1, 'Convocatorias'), noticia(2, 'Convocatorias'), noticia(3, 'Formación'),
    noticia(4, 'Convocatorias'), noticia(5, 'Formación'), noticia(6, 'Convocatorias'),
  ];

  function montar(urlDeEntrada: Record<string, string> = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [NoticiasPageComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(urlDeEntrada) }, paramMap: of(convertToParamMap({})) } },
        { provide: NoticiasService, useValue: { listarPublicas: () => Promise.resolve({ ok: true, data: { items: [] } }) } },
        { provide: TextosWebService, useValue: { getWebText: (k: string) => DEFAULT_TEXTS[k] ?? '', getWebImage: () => '', getWebImageAlt: () => '' } },
        { provide: BoletinService, useValue: { suscribir: () => of({}) } },
      ],
    });
    const router = TestBed.inject(Router);
    const navegar = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(NoticiasPageComponent);
    componente = fixture.componentInstance;
    componente.newsData.set(NOTICIAS as never);
    fixture.detectChanges();
    return { navegar };
  }

  it('arranca con el estado que trae la URL', () => {
    montar({ q: 'bambuco', categoria: 'Convocatorias', orden: 'oldest', vista: 'list', pagina: '2' });

    expect(componente.newsSearchTerm()).toBe('bambuco');
    expect(componente.newsCategoryFilter()).toBe('Convocatorias');
    expect(componente.newsSortOrder()).toBe('oldest');
    expect(componente.viewLayout()).toBe('list');
    expect(componente.currentPage()).toBe(2);
  });

  it('sin parámetros conserva los valores con los que abre la pantalla', () => {
    // MUTANTE QUE MATA: poner el «vacío» cuando la URL no trae el parámetro. El orden arranca en
    // «newest», que no es su vacío: machacarlo cambiaría lo que se ve al entrar.
    montar();

    expect(componente.newsSortOrder()).toBe('newest');
    expect(componente.newsCategoryFilter()).toBe('all');
    expect(componente.viewLayout()).toBe('grid');
  });

  it('lo que se filtra se escribe en la URL, y lo vacío no', () => {
    const { navegar } = montar();

    componente.newsCategoryFilter.set('Convocatorias');
    fixture.detectChanges();

    const extras = navegar.calls.mostRecent().args[1] as { queryParams: Record<string, string | null>; replaceUrl: boolean };
    expect(extras.queryParams['categoria']).toBe('Convocatorias');
    expect(extras.queryParams['q']).toBeNull();
    expect(extras.queryParams['pagina']).toBeNull();
    // Sin apilar una entrada de historial por cada tecla escrita en el buscador.
    expect(extras.replaceUrl).toBeTrue();
  });

  it('la categoría de una tarjeta acota el listado y no abre la noticia', () => {
    montar();
    const evento = new MouseEvent('click');
    spyOn(evento, 'stopPropagation');

    componente.filtrarPorCategoria('Convocatorias', evento);

    // MUTANTE QUE MATA: no detener la propagación. La tarjeta entera es pulsable y abre la
    // noticia: sin esto, pulsar la categoría filtraría Y abriría la noticia a la vez.
    expect(evento.stopPropagation).toHaveBeenCalled();
    expect(componente.newsCategoryFilter()).toBe('Convocatorias');
    expect(componente.filteredListNews().every(item => item.category === 'Convocatorias')).toBeTrue();
  });

  it('pulsar la categoría que ya filtra la quita', () => {
    montar();
    componente.filtrarPorCategoria('Convocatorias');
    expect(componente.categoriaActiva('Convocatorias')).toBeTrue();

    componente.filtrarPorCategoria('Convocatorias');

    // Quien llegó pulsando una etiqueta no tiene por qué saber que existe un desplegable arriba
    // para deshacerlo.
    expect(componente.newsCategoryFilter()).toBe('all');
    expect(componente.categoriaActiva('Convocatorias')).toBeFalse();
  });

  it('el rótulo accesible dice qué va a pasar y cambia según el estado', () => {
    montar();
    expect(componente.rotuloDeCategoria('Convocatorias')).toBe('Ver solo las noticias de Convocatorias');

    componente.filtrarPorCategoria('Convocatorias');

    expect(componente.rotuloDeCategoria('Convocatorias')).toBe('Quitar el filtro por la categoría Convocatorias');
  });

  it('limpiar los filtros los devuelve a su vacío, la página incluida', () => {
    montar({ q: 'bambuco', categoria: 'Convocatorias', pagina: '2' });

    componente.resetAllFilters();

    expect(componente.newsSearchTerm()).toBe('');
    expect(componente.newsCategoryFilter()).toBe('all');
    expect(componente.newsSortOrder()).toBe('newest');
    // MUTANTE QUE MATA: dejar la página donde estaba. Quitar los filtros en la página 2 deja la
    // lista en blanco si la consulta sin filtrar no llega a dos páginas.
    expect(componente.currentPage()).toBe(1);
    expect(componente.filtrosPuestos()).toBe(0);
  });

  it('una categoría que solo existe en una destacada no se ofrece como filtro', () => {
    montar();

    // EL LISTADO EMPIEZA EN LA CUARTA NOTICIA: las tres primeras son el destacado y el par
    // secundario. «Formación» sí está en el listado —la 5—, así que se puede filtrar por ella.
    expect(componente.categoriaFiltrable('Formación')).toBeTrue();
    expect(componente.categoriaFiltrable('Convocatorias')).toBeTrue();

    // Pero una categoría que SOLO viva en una destacada daría cero resultados siempre.
    componente.newsData.set([
      { ...noticia(1, 'Solo en destacada'), id: 1 },
      noticia(2, 'Formación'), noticia(3, 'Formación'),
      noticia(4, 'Formación'),
    ] as never);
    fixture.detectChanges();

    // MUTANTE QUE MATA: ofrecer la etiqueta siempre. Se vio en navegador: pulsar «Convocatorias»
    // en la tarjeta destacada dejaba la pantalla en «ninguna noticia coincide con tus filtros».
    expect(componente.categoriaFiltrable('Solo en destacada')).toBeFalse();
    expect(componente.categoriaFiltrable('Formación')).toBeTrue();
  });

  /**
   * Monta la pantalla y espera a que termine la carga inicial: mientras carga, la barra de filtros no
   * está en el DOM, y la respuesta (vacía en estas pruebas) pisaría las noticias de la prueba.
   */
  async function montarConPantalla(url: Record<string, string> = {}, noticias: unknown[] = NOTICIAS) {
    montar(url);
    await fixture.whenStable();
    componente.newsData.set(noticias as never);
    fixture.detectChanges();
  }

  it('las categorías son un solo desplegable con conteo, y no una fila de pastillas que crece (G6)', async () => {
    await montarConPantalla();
    const raiz = fixture.nativeElement as HTMLElement;
    const barra = raiz.querySelector('[data-testid="categorias-de-noticias"]')!;

    // Un control, no una pastilla por categoría.
    expect(barra.querySelectorAll('app-filtro-desplegable').length).toBe(1);
    expect(barra.querySelectorAll('button[data-filtrar-categoria], .rounded-full').length).toBe(0);
    // Las opciones llevan cuántas noticias tiene cada una, en orden alfabético, tras «Todas».
    expect(componente.opcionesDeCategoria().map(o => `${o.etiqueta} (${o.conteo})`)).toEqual([
      'Todas las categorías (3)', 'Convocatorias (2)', 'Formación (1)',
    ]);
  });

  it('con decenas de categorías la barra mide lo mismo y el desplegable ofrece buscador', async () => {
    await montarConPantalla();
    const muchas = Array.from({ length: 40 }, (_, i) => noticia(10 + i, `Categoría ${String(i).padStart(2, '0')}`));
    componente.newsData.set([noticia(1, 'A'), noticia(2, 'A'), noticia(3, 'A'), ...muchas] as never);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const barra = raiz.querySelector('[data-testid="categorias-de-noticias"]') as HTMLElement;

    expect(componente.opcionesDeCategoria().length).toBe(41);
    expect(barra.querySelectorAll('app-filtro-desplegable').length).toBe(1);
    // La altura de la barra no depende de cuántas categorías haya: un control, un renglón.
    expect(barra.getBoundingClientRect().height).toBeLessThan(80);

    (barra.querySelector('.filtro__control') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(barra.querySelector('.filtro__buscador input')).not.toBeNull();
  });

  it('elegir una categoría en el desplegable filtra, y la «X» de su chip la deshace (A-1)', async () => {
    await montarConPantalla();
    const raiz = fixture.nativeElement as HTMLElement;

    componente.setCategoryFilter('Formación');
    fixture.detectChanges();
    expect(componente.filteredListNews().every(item => item.category === 'Formación')).toBeTrue();

    // El filtro puesto aparece como chip junto a la barra, con su «X» y «Limpiar filtros».
    const filtros = raiz.querySelector('app-filtros-activos')!;
    expect(filtros.textContent).toContain('Formación');
    expect(filtros.textContent).toContain('Limpiar filtros');
    (filtros.querySelector('.chip__quitar') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(componente.newsCategoryFilter()).toBe('all');
    expect(raiz.querySelector('app-filtros-activos [data-filtros-activos]')).toBeNull();
  });

  describe('la etiqueta o proyecto (`?proyecto=`)', () => {
    const conProyecto = (id: number, category: string, codigos: string[]) => ({
      ...noticia(id, category),
      proyectos: codigos.map(codigo => ({ codigo, nombre: codigo === 'celebra' ? 'Celebra la Música' : 'Otra campaña' })),
    });
    const CON_CAMPANAS = [
      noticia(1, 'A'), noticia(2, 'A'), noticia(3, 'A'),
      conProyecto(4, 'Formación', ['celebra']), conProyecto(5, 'Convocatorias', ['celebra', 'otra']),
      conProyecto(6, 'Formación', ['otra']), noticia(7, 'Formación'),
    ];

    it('arranca con la etiqueta de la URL y filtra por su código', () => {
      montar({ proyecto: 'celebra' });
      componente.newsData.set(CON_CAMPANAS as never);

      expect(componente.newsProjectFilter()).toBe('celebra');
      expect(componente.filteredListNews().map(n => n.id)).toEqual([5, 4] as never);
    });

    it('ofrece solo etiquetas que tienen noticias, con su conteo, y ninguna si no hay', () => {
      montar();
      expect(componente.etiquetasDeNoticias()).toEqual([]);

      componente.newsData.set(CON_CAMPANAS as never);
      expect(componente.etiquetasDeNoticias().map(e => `${e.codigo}:${e.nombre} (${e.total})`)).toEqual([
        'celebra:Celebra la Música (2)', 'otra:Otra campaña (2)',
      ]);
    });

    it('con una etiqueta elegida el listado sale de TODAS las noticias, también de las que hoy son destacadas', async () => {
      // La 1 (destacada) pertenece a la campaña: sin esto no habría forma de verla filtrando por ella.
      await montarConPantalla({ proyecto: 'otra' },
        [conProyecto(1, 'A', ['otra']), noticia(2, 'A'), noticia(3, 'A'), noticia(4, 'A'), conProyecto(5, 'A', ['otra'])]);

      expect(componente.proyectoActivo()).toBeTrue();
      expect(componente.etiquetasDeNoticias().map(e => e.codigo)).toEqual(['otra']);
      expect(componente.filteredListNews().map(n => n.id)).toEqual([5, 1] as never);
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('[data-testid="noticias-de-la-etiqueta"]')?.textContent).toContain('Otra campaña');
    });

    it('la etiqueta es un chip con el NOMBRE (no el código), se escribe en la URL y se quita desde su chip', () => {
      const { navegar } = montar();
      componente.newsData.set(CON_CAMPANAS as never);

      componente.setProjectFilter('celebra');
      fixture.detectChanges();

      expect(componente.filtrosActivos()).toEqual([{ clave: 'proyecto', rotulo: 'Etiqueta', valor: 'Celebra la Música' }]);
      const extras = navegar.calls.mostRecent().args[1] as { queryParams: Record<string, string | null> };
      expect(extras.queryParams['proyecto']).toBe('celebra');
      componente.quitarFiltro('proyecto');
      expect(componente.newsProjectFilter()).toBe('all');
      expect(componente.currentPage()).toBe(1);
    });

    it('quitar un chip deja los demás y «Limpiar filtros» los quita todos', () => {
      montar({ q: 'noticia', categoria: 'Formación', proyecto: 'celebra' });
      componente.newsData.set(CON_CAMPANAS as never);
      expect(componente.filtrosActivos().map(f => f.clave)).toEqual(['q', 'categoria', 'proyecto']);

      componente.quitarFiltro('categoria');
      expect(componente.filtrosActivos().map(f => f.clave)).toEqual(['q', 'proyecto']);

      componente.resetAllFilters();
      expect(componente.filtrosActivos()).toEqual([]);
      expect(componente.newsProjectFilter()).toBe('all');
    });
  });

  it('buscar con el buscador común acota por texto y vuelve a la primera página', () => {
    montar({ pagina: '2' });

    componente.buscar('Noticia 5');

    expect(componente.newsSearchTerm()).toBe('Noticia 5');
    expect(componente.currentPage()).toBe(1);
    expect(componente.filteredListNews().map(n => n.id)).toEqual([5] as never);
  });

  it('las destacadas son las tres más recientes y la página no explica su funcionamiento interno (N-1)', async () => {
    await montarConPantalla();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).not.toContain('Se actualizan solas');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="regla-de-destacadas"]')).toBeNull();
    expect(componente.featuredSecondary().length).toBe(2);
    expect(componente.newsListPool().length).toBe(3);
  });

  it('la cantidad por página parte de 6, se elige con el selector común y vuelve a la primera página', async () => {
    await montarConPantalla();
    expect(componente.porPagina()).toBe(6);
    expect(componente.cantidadesPorPagina).toEqual([6, 12, 24]);
    componente.setCurrentPage(2);
    componente.cambiarPorPagina(12);
    expect(componente.porPagina()).toBe(12);
    expect(componente.currentPage()).toBe(1);
  });

  it('sin noticias que coincidan, el vacío ofrece «Limpiar filtros»', async () => {
    await montarConPantalla();
    componente.buscar('no existe');
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.textContent).toContain('Ninguna noticia coincide con tus filtros');
    const limpiar = Array.from(raiz.querySelectorAll('app-estado-de-lista button'))
      .find(b => b.textContent?.includes('Limpiar filtros')) as HTMLButtonElement;
    limpiar.click();
    fixture.detectChanges();
    expect(componente.newsSearchTerm()).toBe('');
  });
});

/**
 * D-02: la lista llegaba con la API respondiendo 200 y la pantalla se quedaba en «Cargando las noticias…» hasta
 * que la persona pulsaba una tecla (medido en el build de producción servido estático).
 *
 * La prueba corre SIN zona (`provideZonelessChangeDetection`): ahí la vista solo se entera de lo que cambia una
 * SEÑAL que la plantilla lee, que es exactamente la condición en la que fallaba la página con campos simples
 * (`isLoading = false` no avisa a nadie). Con señales se repinta sola.
 */
describe('Noticias sale del esqueleto al llegar la lista, sin esperar una interacción (D-02)', () => {
  it('repinta cuando la respuesta llega sin que ningún evento avise a la vista', async () => {
    TestBed.resetTestingModule();
    let resolver!: (valor: unknown) => void;
    const pendiente = new Promise((r) => { resolver = r; });
    TestBed.configureTestingModule({
      imports: [NoticiasPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) }, paramMap: of(convertToParamMap({})) } },
        { provide: NoticiasService, useValue: { listarPublicas: () => pendiente } },
        { provide: TextosWebService, useValue: { getWebText: (k: string) => DEFAULT_TEXTS[k] ?? '', getWebImage: () => '', getWebImageAlt: () => '' } },
        { provide: BoletinService, useValue: { suscribir: () => of({}) } },
      ],
    });
    const fixture = TestBed.createComponent(NoticiasPageComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-noticias-cargando]')).not.toBeNull();

    const items = [1, 2, 3, 4].map((id) => ({ id, slug: `n-${id}`, titulo: `Noticia ${id}`, resumen: 'Resumen', categoria: 'Convocatorias', fechaPublicacion: '2026-09-01T00:00:00Z' }));
    resolver({ ok: true, data: { items } });
    await pendiente;
    await fixture.whenStable();

    expect(el.querySelector('[data-noticias-cargando]')).toBeNull();
  });
});
