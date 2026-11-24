import { claveDeUrlDeRed, IdDeRedInstitucional } from '../../../../core/config/redes-institucionales';
import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
// `OnDestroy` se retiró con su método vacío: el listener de desplazamiento lo quita Angular
// solo, porque está declarado con `@HostListener` y no a mano.
import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { sanitizeArticleContent } from './article-content';
import {
  LucideArrowLeft,
  LucideClock,
  LucideShare2,
  LucideBookmark,
  LucideCheckCircle2,
} from '@lucide/angular';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { NoticiasService } from '../../../../core/services/noticias.service';
import { BoletinService } from '../../../../core/services/boletin.service';
import { PageHeroComponent } from '../../../../shared/components/ui/page-hero/page-hero.component';
import {
  contarFiltrosPuestos,
  enlazarFiltrosConLaUrl,
  filtroDeCantidad,
  filtroDePagina,
  filtroDeTexto,
  filtroDeVista,
  limpiarFiltros,
} from '../../../../shared/utils/filtros-en-la-url';
import { 
  ErrorStateComponent, 
  EmptyStateComponent 
} from '../../../../shared/components/ui/remote-state/remote-state.component';
import { 
  getNewsDateKeys, 
  splitHeroHeadline 
} from '../../../../core/services/data-transforms';
import { NoticiaDeDiseno, aNoticiaDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { imagenDeNoticia, respaldosDeNoticias } from '../../../../shared/utils/imagen-de-noticia';
import { RevelarDirective } from '../../../../shared/directives/revelar.directive';
import {
  FiltroDesplegableComponent,
  OpcionDeFiltro,
} from '../../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';

import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { BuscadorDeListaComponent } from '../../../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroActivo, FiltrosActivosComponent } from '../../../../shared/components/ui/filtros-activos/filtros-activos.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { EstadoDeListaComponent } from '../../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { BotonComponent } from '../../../../shared/components/ui/boton/boton.component';
import { PaginacionDeListaComponent } from '../../../../shared/components/ui/paginacion-de-lista/paginacion-de-lista.component';
import { etiquetasDisponibles } from '../../../../shared/utils/etiquetas';
import { EtiquetasDeContenidoComponent } from '../../../../shared/components/ui/etiquetas-de-contenido/etiquetas-de-contenido.component';
import { NOTICIAS_DESTACADAS } from '../../destacadas-de-noticias';

@Component({
  selector: 'app-noticias-page',
  standalone: true,
  imports: [TextoWebPipe, 
    RouterLink,
    EtiquetasDeContenidoComponent,
    PaginacionDeListaComponent,
    RevelarDirective,
    CommonModule,
    PageHeroComponent,
    EsqueletoComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    FiltroDesplegableComponent,
    BuscadorDeListaComponent,
    FiltrosActivosComponent,
    SelectorSegmentadoComponent,
    EstadoDeListaComponent,
    BotonComponent,
    LucideArrowLeft,
    LucideClock,
    LucideShare2,
    LucideBookmark,
    LucideCheckCircle2,
  ],
  templateUrl: './noticias-page.component.html'
})
export class NoticiasPageComponent implements OnInit {
  Math = Math;
  private webTexts = inject(TextosWebService);

  /** La dirección de una red institucional, de «Redes sociales y enlaces del pie» en el CMS. */
  urlDeRed(id: IdDeRedInstitucional): string {
    return this.webTexts.getWebText(claveDeUrlDeRed(id));
  }

  private noticiasApi = inject(NoticiasService);
  private boletin = inject(BoletinService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Reactivo a la ruta: /noticias/:articleId identifica la noticia abierta,
  // así el artículo es enlazable, compartible y sobrevive a un refresco.
  private readonly routeParamMap = toSignal(this.route.paramMap);
  private readonly articleIdParam = computed(() => this.routeParamMap()?.get('articleId') ?? null);

  readonly localSelectedArticle = computed(() => {
    const id = this.articleIdParam();
    if (!id) return null;
    return this.newsData().find((item) => String(item.id) === id) ?? null;
  });

  newsSearchTerm = signal<string>('');
  newsCategoryFilter = signal<string>('all');
  /** El código de la etiqueta (proyecto transversal, `?proyecto=`), o `'all'`. Es el mismo código que acepta `/publico/noticias`. */
  newsProjectFilter = signal<string>('all');
  newsSortOrder = signal<string>('newest');
  currentPage = signal<number>(1);
  viewLayout = signal<'grid' | 'list'>('grid');
  readingProgress = signal<number>(0);

  /** `true` DESDE EL VALOR INICIAL: la primera pintura es el esqueleto, nunca «archivo vacío» (decisión 117). */
  /**
   * SON SEÑALES, y esto era el defecto D-02: con campos simples la vista solo se enteraba de que la
   * lista había llegado si la zona de Angular veía pasar un evento. Con la API respondiendo 200 la
   * página se quedaba en «Cargando las noticias…» hasta que la persona pulsaba una tecla (medido en el
   * build de producción servido estático). Una señal que la plantilla lee avisa por sí sola.
   */
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly isError = signal(false);
  readonly error = signal<{ message?: string } | null>(null);

// TIPADO Y NO `any`, que es lo unico que se toca del codigo portado ademas de la conexion.
// El diseno viene de un desarrollo mas laxo; poner el tipo no cambia un pixel y es lo que
// permite que el trinquete de tipado siga bajando en vez de subir.
  newsData = signal<NoticiaDeDiseno[]>([]);

  // Subscription state
  isSubscribed = false;
  subscriberEmail = '';
  subscriptionError = '';

  /** Cuántas noticias por página (`?por=`): el selector común de la paginación. Parte de seis, como siempre. */
  readonly cantidadesPorPagina: readonly number[] = [6, 12, 24];
  readonly porPagina = signal<number>(this.cantidadesPorPagina[0]);

  // Derivadas usando computed()
  featuredPrimary = computed(() => this.newsData()[0] || null);
  featuredSecondary = computed(() => this.newsData().slice(1, NOTICIAS_DESTACADAS));
  newsListPool = computed(() => this.newsData().slice(NOTICIAS_DESTACADAS));

  /** Si se está viendo una etiqueta (`?proyecto=`). */
  readonly proyectoActivo = computed(() => this.newsProjectFilter() !== 'all');

  /**
   * De dónde sale el listado filtrable.
   *
   * <b>SIN CAMPAÑA</b>, de la cuarta noticia en adelante: las tres primeras ya están arriba como destacadas.
   * <b>CON CAMPAÑA</b>, de todas: es una vista de resultados y las destacadas no se pintan, así que una noticia
   * de la campaña que hoy es la segunda más reciente no puede quedar fuera del listado ni de la lista de campañas.
   */
  readonly baseDeLaLista = computed(() => (this.proyectoActivo() ? this.newsData() : this.newsListPool()));

  /** El nombre de la campaña elegida, para el encabezado de la vista filtrada. */
  readonly nombreDeLaEtiqueta = computed(() => this.etiquetasDeNoticias().find((e) => e.codigo === this.newsProjectFilter())?.nombre ?? '');

  /** La regla de las destacadas, editable desde el panel de textos; si no hay texto publicado, el de respaldo (N-1). */

  newsCategoryOptions = computed(() => {
    const categories = this.baseDeLaLista().map((item) => item.category).filter(Boolean);
    return [...new Set(categories)];
  });

  /**
   * LAS CATEGORÍAS SON UN DESPLEGABLE CON BUSCADOR Y CONTEO, NO UNA FILA DE PASTILLAS (G6).
   *
   * Cada categoría nueva ensanchaba la barra: una pastilla más, un renglón más, y la franja de
   * control crecía sin techo y empujaba el listado hacia abajo. Un desplegable ocupa siempre lo mismo
   * con tres categorías o con treinta; a partir de nueve opciones trae su buscador (el mismo
   * componente que usan los filtros de la consola y de la Agenda), y cada opción lleva cuántas
   * noticias tiene (CON-02). Van en orden alfabético para que se encuentren sin leerlas todas.
   */
  opcionesDeCategoria = computed<OpcionDeFiltro[]>(() => [
    { id: 'all', etiqueta: 'Todas las categorías', conteo: this.baseDeLaLista().length },
    ...[...this.newsCategoryOptions()]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map(categoria => ({ id: categoria, etiqueta: categoria, conteo: this.getCategoryCount(categoria) })),
  ]);

  /**
   * Las etiquetas que hay en las noticias, con cuántas lleva cada una (`?proyecto=`). Son los proyectos transversales
   * de las noticias (una sola fuente para todo el sitio, ver `utils/etiquetas.ts`). Salen de TODAS las noticias
   * cargadas y no del listado: una etiqueta cuya única noticia es hoy destacada también se puede elegir. Sin ninguna, no se muestra el bloque.
   */
  readonly etiquetasDeNoticias = computed(() => etiquetasDisponibles(this.newsData()));

  /** Los dos modos de vista, con icono (A-4): la etiqueta es el nombre accesible y la ayuda del botón. */
  readonly opcionesDeVista: readonly OpcionSegmentada[] = [
    { id: 'grid', etiqueta: 'Vista de mosaico', icono: 'mosaico' },
    { id: 'list', etiqueta: 'Vista de lista', icono: 'lista' },
  ];

  readonly opcionesDeOrden: readonly OpcionDeFiltro[] = [
    { id: 'newest', etiqueta: 'Más recientes' },
    { id: 'oldest', etiqueta: 'Más antiguas' },
  ];

  filteredListNews = computed(() => {
    const pool = this.baseDeLaLista();
    const term = this.newsSearchTerm().trim().toLowerCase();
    const category = this.newsCategoryFilter();
    const project = this.newsProjectFilter();
    const sortOrder = this.newsSortOrder();

    return [...pool]
      .filter((item) => {
        const searchableText = [item.title, item.desc, item.category, item.content]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch = !term || searchableText.includes(term);
        if (!matchesSearch) return false;

        const matchesCategory = category === 'all' || item.category === category;
        if (!matchesCategory) return false;

        return project === 'all' || (item.proyectos ?? []).some((p) => p.codigo === project);
      })
      .sort((leftItem, rightItem) => {
        const leftDate = getNewsDateKeys(leftItem.date)?.dateKey || '';
        const rightDate = getNewsDateKeys(rightItem.date)?.dateKey || '';

        if (leftDate === rightDate) {
          return leftItem.title.localeCompare(rightItem.title, 'es', { sensitivity: 'base' });
        }

        return sortOrder === 'oldest'
          ? leftDate.localeCompare(rightDate)
          : rightDate.localeCompare(leftDate);
      });
  });

  totalPages = computed(() => {
    const count = this.filteredListNews().length;
    return Math.max(1, Math.ceil(count / this.porPagina()));
  });

  paginatedNews = computed(() => {
    const list = this.filteredListNews();
    const page = Math.min(this.currentPage(), this.totalPages());
    const startIndex = (page - 1) * this.porPagina();
    return list.slice(startIndex, startIndex + this.porPagina());
  });

  selectedArticleHeroCopy = computed(() => {
    const article = this.localSelectedArticle();
    return article ? splitHeroHeadline(article.title || '') : { title: '', titleAccent: '' };
  });

  // S-02: el cuerpo pasa por el saneador de Angular (lista blanca), nunca por un `bypass…`.
  selectedArticleSafeContent = computed<string>(() =>
    sanitizeArticleContent(this.sanitizer, this.localSelectedArticle()?.content)
  );

  /**
   * Los filtros de esta pantalla, declarados una vez y enganchados a la URL.
   *
   * <b>ANTES NO ESTABAN EN NINGUNA PARTE MAS QUE EN ESTAS SEÑALES.</b> Filtrar por «Convocatorias»
   * y pasarle el enlace a alguien le abría la lista entera; recargar lo perdía; y volver de una
   * noticia al listado también. La noticia abierta sí era enlazable desde hacía cortes —vive en la
   * ruta, `/noticias/:articleId`—, y el filtro que la encontró no.
   *
   * <b>EL VACIO SE DECLARA POR FILTRO.</b> Aquí la categoría vacía se escribe `'all'` y el orden
   * arranca en `'newest'`: unificar esas palabras obligaría a tocar la lógica de filtrado, que es
   * código del diseño aprobado. La pieza compartida admite el vacío de cada uno y deja la URL
   * limpia igual.
   */
  readonly filtros = [
    filtroDeTexto('q', this.newsSearchTerm),
    filtroDeTexto('categoria', this.newsCategoryFilter, 'all'),
    filtroDeTexto('proyecto', this.newsProjectFilter, 'all'),
    filtroDeTexto('orden', this.newsSortOrder, 'newest'),
    filtroDeVista('vista', this.viewLayout, 'grid'),
    filtroDePagina(this.currentPage),
  ];

  /** Cuántos filtros hay puestos, para rotular «Limpiar filtros» con su número. */
  readonly filtrosPuestos = computed(() => contarFiltrosPuestos(this.filtros));

  /** Los filtros puestos como chips con «X» y «Limpiar filtros» junto a la barra (A-1). El orden no es un filtro: no cuenta. */
  readonly filtrosActivos = computed<FiltroActivo[]>(() => {
    const activos: FiltroActivo[] = [];
    const texto = this.newsSearchTerm().trim();
    if (texto) activos.push({ clave: 'q', rotulo: 'Búsqueda', valor: texto });
    const categoria = this.newsCategoryFilter();
    if (categoria !== 'all') activos.push({ clave: 'categoria', rotulo: 'Categoría', valor: categoria });
    const proyecto = this.newsProjectFilter();
    if (proyecto !== 'all') {
      const nombre = this.etiquetasDeNoticias().find((e) => e.codigo === proyecto)?.nombre ?? proyecto;
      activos.push({ clave: 'proyecto', rotulo: 'Etiqueta', valor: nombre });
    }
    return activos;
  });

  /**
   * Cambia cuando cambia lo que se ve en la lista. Quien la pinta lo usa de clave para que el bloque entre con un
   * fundido corto (`.aparece`, 120 ms) en vez de cambiar de golpe. Con `prefers-reduced-motion` no se anima.
   */
  readonly claveDeLaLista = computed(() => [
    this.newsSearchTerm().trim(), this.newsCategoryFilter(), this.newsProjectFilter(),
    this.newsSortOrder(), this.viewLayout(), this.currentPage(),
  ].join('|'));

  constructor() {
    // La cantidad por página viaja en la URL pero no cuenta como filtro: «Limpiar filtros» no la toca.
    enlazarFiltrosConLaUrl([...this.filtros, filtroDeCantidad(this.porPagina, this.cantidadesPorPagina)]);
  }

  ngOnInit() {
    this.loadNewsData();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (!this.localSelectedArticle()) return;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const totalHeight = scrollHeight - clientHeight;
    if (totalHeight > 0) {
      const progress = (window.scrollY / totalHeight) * 100;
      this.readingProgress.set(progress);
    }
  }

  loadNewsData(isRefresh = false) {
    // LA LISTA SE RECUERDA UN MINUTO: abrir una noticia y volver pedía otra vez las 50 y la
    // lista tardaba en pintarse, así que el desplazamiento guardado se aplicaba sobre una página
    // vacía y se perdía. Con la copia, volver pinta la lista de inmediato y el navegador restaura
    // el lugar donde se estaba. «Reintentar» (`isRefresh`) sí pide de nuevo.
    const guardada = this.noticiasApi.ultimaListaPublica;
    if (!isRefresh && guardada && Date.now() - guardada.momento < 60_000) {
      this.newsData.set(guardada.items.map(aNoticiaDeDiseno));
      this.isLoading.set(false);
      return;
    }
    if (isRefresh) {
      this.isRefreshing.set(true);
    } else {
      this.isLoading.set(true);
    }
    this.isError.set(false);
    this.error.set(null);

    // CONEXION REAL, y es lo unico que cambia respecto del diseno aprobado. Antes llamaba a
    // `fetchNewsRecords`, que pasaba por `buildNewsItemFromRecord`: aquella funcion asignaba una
    // IMAGEN ALEATORIA cuando el registro no traia ninguna, que es justo lo que hacia que esta
    // pantalla estuviera falsamente conectada. Aqui una noticia sin imagen se queda sin imagen.
    void this.noticiasApi.listarPublicas({ tamano: 50 }).then((resultado) => {
      if (resultado.ok && resultado.data) {
        this.noticiasApi.ultimaListaPublica = { momento: Date.now(), items: resultado.data.items };
        this.newsData.set(resultado.data.items.map(aNoticiaDeDiseno));
      } else {
        this.error.set({ message: resultado.error });
        this.isError.set(true);
      }
      this.isLoading.set(false);
      this.isRefreshing.set(false);
    });
  }

  retry() {
    this.loadNewsData(false);
  }

  getWebText(key: string, fallback = ''): string {
    return this.webTexts.getWebText(key) || fallback;
  }

  /**
   * Abre una noticia del listado.
   *
   * <b>NAVEGA POR EL SLUG Y NO POR EL IDENTIFICADOR, y esto era un enlace roto.</b> La ruta se
   * declara como `/noticias/:slug` y la ficha resuelve con `obtenerPublica(slug)`; el listado
   * navegaba con `article.id`, así que pulsar cualquier noticia llevaba a `/noticias/2` y la ficha
   * contestaba «ESTA NOTICIA NO ESTÁ PUBLICADA» sobre una noticia que sí lo está.
   *
   * <b>NO LO VIO NINGUNA PRUEBA</b> porque las dos mitades funcionan por separado: el listado
   * navega y la ficha abre —comprobado con el slug a mano—. Lo que fallaba era el paso de una a la
   * otra, que es justo lo que ningún unitario mira. Apareció al recorrer el sitio entero como lo
   * recorre alguien.
   *
   * El `slug` viene en `NoticiaDeDiseno` desde el adaptador, así que no hace falta pedir nada más.
   */
  /** La imagen de la noticia, o la de respaldo que también usa la portada. */
  imagenDe(noticia: NoticiaDeDiseno): string {
    return imagenDeNoticia(noticia, respaldosDeNoticias((clave) => this.webTexts.getWebImage(clave)));
  }

  handleSelectArticle(article: NoticiaDeDiseno | null) {
    this.readingProgress.set(0);
    // NO SE SUBE ARRIBA ANTES DE NAVEGAR: el enrutador guarda el desplazamiento al salir, y subir
    // antes lo guardaba en cero. Volver desde la noticia dejaba la lista arriba.
    if (article?.slug) {
      this.router.navigate(['/noticias', article.slug]);
    } else {
      this.router.navigate(['/noticias']);
    }
  }

  setCategoryFilter(category: string) {
    this.newsCategoryFilter.set(category);
    this.currentPage.set(1);
    this.scrollToFeed();
  }

  setSortOrder(order: string) {
    this.newsSortOrder.set(order);
    this.currentPage.set(1);
    this.scrollToFeed();
  }

  /** El buscador común avisa ya con la pausa hecha; la «X» y Intro avisan sin esperar. */
  buscar(texto: string) {
    this.newsSearchTerm.set(texto);
    this.currentPage.set(1);
  }

  setProjectFilter(proyecto: string | null) {
    this.newsProjectFilter.set(proyecto ?? 'all');
    this.currentPage.set(1);
    this.scrollToFeed();
  }

  /** Quita un solo filtro desde su chip. */
  quitarFiltro(clave: string) {
    if (clave === 'q') this.newsSearchTerm.set('');
    else if (clave === 'categoria') this.newsCategoryFilter.set('all');
    else if (clave === 'proyecto') this.newsProjectFilter.set('all');
    this.currentPage.set(1);
  }

  clearSearch() {
    this.newsSearchTerm.set('');
    this.currentPage.set(1);
  }

  setViewLayout(layout: string) {
    this.viewLayout.set(layout === 'list' ? 'list' : 'grid');
  }

  setCurrentPage(page: number) {
    this.currentPage.set(page);
    this.scrollToFeed();
  }

  /** Otra cantidad por página: vuelve a la primera, porque quedarse en la 4 de una lista más corta enseña un vacío falso. */
  cambiarPorPagina(cantidad: number) {
    this.porPagina.set(cantidad);
    this.setCurrentPage(1);
  }

  /**
   * Acota el listado por la categoría de una tarjeta, o lo deshace si ya era esa.
   *
   * <b>DETIENE LA PROPAGACION, Y ESA ES LA PARTE QUE HAY QUE MIRAR.</b> La tarjeta entera es
   * pulsable —abre la noticia— y esta etiqueta vive dentro. Sin `stopPropagation`, pulsar la
   * categoría filtraría Y abriría la noticia a la vez, que es peor que dejarla como texto muerto.
   *
   * <b>ALTERNA</b>, igual que las etiquetas del ecosistema: pulsar la que ya está filtrando
   * significa «quítamelo».
   */
  filtrarPorCategoria(categoria: string, evento?: Event) {
    evento?.stopPropagation();
    const actual = this.newsCategoryFilter();
    this.newsCategoryFilter.set(actual === categoria ? 'all' : categoria);
    this.currentPage.set(1);
    this.scrollToFeed();
  }

  /** Si el listado ya está acotado por esta categoría. Decide el estilo y el `aria-pressed`. */
  categoriaActiva(categoria: string): boolean {
    return this.newsCategoryFilter() === categoria;
  }

  /**
   * Si filtrar por esta categoría puede dar algún resultado.
   *
   * <b>EL LISTADO EMPIEZA EN LA CUARTA NOTICIA.</b> Las tres primeras son el destacado y el par
   * secundario, y no entran en `newsListPool()` —de donde salen tanto el filtrado como las
   * pestañas de categoría de arriba—. Así que una categoría que SOLO existe en una destacada no
   * tiene pestaña y, si se filtrara por ella, daría cero resultados siempre.
   *
   * Se comprobó en navegador: pulsar «Convocatorias» en la tarjeta destacada dejaba la pantalla en
   * «ninguna noticia coincide con tus filtros». Una acción que solo puede llevar a una vista vacía
   * no se ofrece: es la misma regla que ya rige los menús de la consola.
   */
  categoriaFiltrable(categoria: string): boolean {
    return !!categoria && this.newsCategoryOptions().includes(categoria);
  }

  /** Lo que se le lee a quien no ve la pantalla, y que cambia cuando el filtro ya está puesto. */
  rotuloDeCategoria(categoria: string): string {
    return this.categoriaActiva(categoria)
      ? `Quitar el filtro por la categoría ${categoria}`
      : `Ver solo las noticias de ${categoria}`;
  }

  resetAllFilters() {
    // CADA FILTRO A SU PROPIO VACIO, el declarado arriba. Escribirlos aquí otra vez es donde
    // empiezan a divergir: este método ya se había quedado sin la vista.
    limpiarFiltros(this.filtros);
    this.scrollToFeed();
  }

  onEmailChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.subscriberEmail = input.value;
    this.subscriptionError = '';
  }

  /**
   * Da de alta el correo en el boletín.
   *
   * ANTES ESTE METODO NO LLAMABA A NADA: validaba que hubiera una arroba y ponía `isSubscribed` a
   * cierto. El formulario daba las gracias y el correo no llegaba a ninguna parte, que es la
   * definición exacta de falsamente conectado. Ahora escribe en `/publico/boletin/suscripciones`.
   *
   * EL ORIGEN ES «noticias» Y NO «portada»: la consola necesita distinguir qué pantalla convierte,
   * que es para lo que existe la lista de suscripciones.
   *
   * NO SE DISTINGUE SI EL CORREO YA ESTABA, y es decisión del API: hacerlo convertiría esta ruta
   * anónima en un comprobador abierto de quién está en la lista.
   */
  handleSubscribeSubmit(event: Event) {
    event.preventDefault();
    const correo = (this.subscriberEmail || '').trim();
    if (!correo || !correo.includes('@')) {
      this.subscriptionError = 'Por favor, ingresa una dirección de correo válida.';
      return;
    }

    this.subscriptionError = '';
    this.boletin.suscribir(correo, true, 'noticias').subscribe({
      next: () => {
        this.isSubscribed = true;
        this.subscriberEmail = '';
      },
      error: (error: { payload?: { message?: string } }) => {
        this.subscriptionError = error?.payload?.message
          || 'No fue posible registrar el correo. Inténtalo de nuevo.';
      }
    });
  }

  calculateReadingTime(content = ''): number {
    const wordsPerMinute = 200;
    const wordCount = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  }

  getCategoryCount(cat: string): number {
    return this.baseDeLaLista().filter(item => item.category === cat).length;
  }

  private scrollToFeed() {
    setTimeout(() => {
      const element = document.getElementById('news-feed-section');
      if (element) {
        const yOffset = -100;
        const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 50);
  }
}
