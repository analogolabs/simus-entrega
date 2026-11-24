import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { AfterViewChecked, Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideArrowUpDown,
  LucideBookOpen,
  LucideBoxes,
  LucideBuilding2,
  LucideDisc,
  LucideFileVideo,
  LucideInfo,
  LucideLandmark,
  LucideLibrary,
  LucideMusic2,
  LucideSearch,
  LucideChevronDown,
  LucideChevronUp,
  LucideX,
  LucideLayoutGrid,
  LucideList,
  LucideUserCircle2,
} from '@lucide/angular';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { catchError, filter, of, switchMap, tap } from 'rxjs';
import { NavigationService } from '../../../../core/services/navigation.service';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { CatalogoEditorialService } from '../../../../core/services/catalogo-editorial.service';
import { SectionHeaderComponent } from '../../../../shared/components/ui/section-header/section-header.component';
import { FichaEditorialComponent } from '../../components/ficha-editorial/ficha-editorial.component';
import { getEditorialSectionIconName } from '../../../../core/services/data-transforms';
import { RecursoEditorialDeDiseno, aRecursoEditorialDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { CampoDeOrdenEditorial, ConsultaDelCatalogoPublico, FacetasDelCatalogoEditorial } from '../../../../core/contratos/catalogo-editorial';
import { RevelarDirective } from '../../../../shared/directives/revelar.directive';
import {
  FiltroDesplegableComponent,
  OpcionDeFiltro,
} from '../../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { BuscadorDeListaComponent } from '../../../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltrosActivosComponent } from '../../../../shared/components/ui/filtros-activos/filtros-activos.component';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { EstadoDeListaComponent } from '../../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { PaginacionDeListaComponent } from '../../../../shared/components/ui/paginacion-de-lista/paginacion-de-lista.component';
import { TIPOS_DE_MATERIAL, tipoDeMaterial } from '../../domain/tipo-de-material';
import { partirAutoria } from '../../domain/autoria-visible';
import {
  contarFiltrosPuestos,
  enlazarFiltrosConLaUrl,
  filtroDePagina,
  filtroDeTexto,
  filtroDeVista,
  limpiarFiltros,
} from '../../../../shared/utils/filtros-en-la-url';

import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';

/** Cuántas fichas por página se ve de partida (E-3); las demás cantidades se eligen en la paginación. */
const POR_PAGINA_DE_PARTIDA = 24;

/** Cuántos temas se enseñan como botones; el resto está en «Todos los temas». */
const TEMAS_A_LA_VISTA = 10;

/** Una columna de la vista de lista que se puede ordenar (E-5). */
interface ColumnaOrdenable {
  readonly campo: CampoDeOrdenEditorial;
  readonly etiqueta: string;
  readonly clase: string;
  /** El sentido con el que arranca al pulsarla por primera vez: el año, de más reciente a más antiguo. */
  readonly primerSentido: 'asc' | 'desc';
}

/** Un filtro aplicado, para pintarlo como chip con su «X». */
interface FiltroAplicado {
  readonly clave: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly quitar: () => void;
}

/** Lo que llegó del servidor para la consulta actual. */
interface PaginaDelCatalogo {
  items: RecursoEditorialDeDiseno[];
  total: number;
  totalPaginas: number;
  pagina: number;
  tamano: number;
  facetas: FacetasDelCatalogoEditorial | null;
}

@Component({
  selector: 'app-editorial-page',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective,
    RouterLink,
    RevelarDirective,
    CommonModule,
    SectionHeaderComponent,
    FichaEditorialComponent,
    FiltroDesplegableComponent,
    BuscadorDeListaComponent,
    FiltrosActivosComponent,
    EsqueletoComponent,
    EstadoDeListaComponent,
    PaginacionDeListaComponent,
    LucideArrowDown,
    LucideArrowUp,
    LucideArrowUpDown,
    LucideBookOpen,
    LucideBoxes,
    LucideBuilding2,
    LucideDisc,
    LucideFileVideo,
    LucideInfo,
    LucideLandmark,
    LucideLibrary,
    LucideMusic2,
    LucideSearch,
    LucideChevronDown,
    LucideChevronUp,
    LucideX,
    LucideLayoutGrid,
    LucideList,
    LucideUserCircle2,
  ],
  templateUrl: './editorial-page.component.html'
})
export class EditorialPageComponent implements AfterViewChecked, OnInit {
  private navigationService = inject(NavigationService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly enrutador = inject(Router);
  private webTexts = inject(TextosWebService);
  private readonly catalogoEditorial = inject(CatalogoEditorialService);
  private readonly destruccion = inject(DestroyRef);

  readonly cantidadesPorPagina: readonly number[] = [12, 24, 48];

  selectedMosaicItem = signal<RecursoEditorialDeDiseno | null>(null);
  activeTab = signal<string>('all');
  searchTerm = signal<string>('');
  advancedTitleSearch = signal<string>('');
  advancedAuthorSearch = signal<string>('');
  advancedKeywordSearch = signal<string>('');
  selectedYearFilter = signal<string>('');
  showAdvancedSearch = signal<boolean>(false);
  /** En móvil y tableta, el año y los temas quedan tras «Más filtros». */
  masFiltros = signal<boolean>(false);
  /**
   * EL ORDEN LO HACE EL SERVIDOR (E-5). `orden` es el campo —`titulo`, `categoria`, `autoria`, `anio`— y
   * `sentido` su dirección. Las direcciones antiguas traían `orden=az|za`: se normalizan al entrar.
   */
  orden = signal<string>('titulo');
  sentido = signal<string>('asc');
  selectedKeyword = signal<string>('');
  selectedSubcategory = signal<string>('');
  /** El tipo de material elegido («libro», «audio»…), o vacío para todos. Ver `tipo-de-material.ts`. */
  selectedMaterial = signal<string>('');
  selectedCarrier = signal<string>('');
  /** El nombre exacto de una persona o entidad acreditada, que se filtra al pulsarlo en la lista (E-5). */
  selectedAuthor = signal<string>('');
  porPagina = signal<number>(POR_PAGINA_DE_PARTIDA);
  hoveredId = signal<string | null>(null);
  viewMode = signal<'mosaic' | 'table'>('mosaic');
  expandedId = signal<string | null>(null);
  currentPage = signal<number>(1);

  /** La página que el servidor devolvió para la consulta de ahora; `null` hasta la primera respuesta. */
  readonly pagina = signal<PaginaDelCatalogo | null>(null);
  /** Hay una consulta en vuelo (la primera o una nueva). La primera enseña esqueleto; las demás, el listado atenuado. */
  readonly cargando = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  private readonly reintento = signal(0);

  /** Lo que se pinta: las fichas de la página. */
  readonly paginatedResources = computed(() => this.pagina()?.items ?? []);
  readonly total = computed(() => this.pagina()?.total ?? 0);
  readonly totalPages = computed(() => Math.max(1, this.pagina()?.totalPaginas ?? 1));
  readonly facetas = computed(() => this.pagina()?.facetas ?? null);
  /** El primer pintado todavía no tiene datos: ahí va el esqueleto. Después, atenuar basta. */
  readonly primeraCarga = computed(() => this.pagina() === null && this.error() === null);
  readonly desde = computed(() => (this.total() === 0 ? 0 : (this.currentPage() - 1) * this.porPagina() + 1));
  readonly hasta = computed(() => Math.min(this.currentPage() * this.porPagina(), this.total()));

  /** La consulta que se manda al servidor: lo que hay en los filtros, sin más. */
  readonly consulta = computed<ConsultaDelCatalogoPublico>(() => ({
    q: this.searchTerm().trim(),
    titulo: this.advancedTitleSearch().trim(),
    autoria: this.advancedAuthorSearch().trim(),
    clave: this.advancedKeywordSearch().trim(),
    palabraClave: this.selectedKeyword(),
    categoria: this.activeTab() === 'all' ? '' : this.activeTab(),
    subcategoria: this.selectedSubcategory(),
    material: this.selectedMaterial(),
    soporte: this.selectedCarrier(),
    anio: this.selectedYearFilter(),
    autor: this.selectedAuthor(),
    orden: this.campoDeOrden(),
    sentido: this.sentido() === 'desc' ? 'desc' : 'asc',
    pagina: this.currentPage(),
    tamano: this.porPagina(),
  }));

  private readonly campoDeOrden = computed<CampoDeOrdenEditorial>(() => {
    const campo = this.orden();
    return campo === 'categoria' || campo === 'autoria' || campo === 'anio' ? campo : 'titulo';
  });

  /** Las categorías con cuántas fichas tiene cada una en TODO el acervo. */
  categories = computed(() => [
    { id: 'all', label: 'Todo el Acervo', iconName: 'library' },
    ...(this.facetas()?.categorias ?? []).map(c => ({ id: c.valor, label: c.nombre, iconName: getEditorialSectionIconName(c.nombre) })),
  ]);

  getCategoryCount(catId: string): number {
    const f = this.facetas();
    if (!f) return 0;
    return catId === 'all' ? f.totalAcervo : (f.categorias.find(c => c.valor === catId)?.total ?? 0);
  }

  // ── Opciones de cada filtro: las cuenta el servidor sobre la categoría elegida ──

  readonly opcionesDeMaterial = computed<OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: 'Todos los tipos', conteo: this.facetas()?.totalEnAlcance },
    ...(this.facetas()?.materiales ?? []).map(m => ({ id: m.valor, etiqueta: m.nombre, conteo: m.total })),
  ]);

  readonly opcionesDeSoporte = computed<OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: 'Todos los soportes', conteo: this.facetas()?.totalEnAlcance },
    ...(this.facetas()?.soportes ?? []).map(m => ({ id: m.valor, etiqueta: m.nombre, conteo: m.total })),
  ]);

  readonly availableSubcategories = computed(() => (this.facetas()?.subcategorias ?? []).map(s => s.valor));

  readonly opcionesDeSubcategoria = computed<OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: 'Todas las subcategorías' },
    ...(this.facetas()?.subcategorias ?? []).map(s => ({ id: s.valor, etiqueta: s.nombre, conteo: s.total })),
  ]);

  readonly opcionesDeAnio = computed<OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: 'Cualquier año' },
    ...(this.facetas()?.anios ?? []).map(a => ({ id: a.valor, etiqueta: a.nombre, conteo: a.total })),
  ]);

  /**
   * LOS TEMAS (E-2). Se enseñan los más usados como botones y TODOS en un desplegable con buscador: el
   * acervo tiene cerca de 370 temas y antes solo se veían ocho, así que el 58 % de las fichas con tema
   * era alcanzable por un botón y el resto solo por búsqueda avanzada. Los que comparten raíz («banda»,
   * «bandas») ya vienen agrupados del servidor.
   */
  readonly temasALaVista = computed(() => (this.facetas()?.temas ?? []).slice(0, TEMAS_A_LA_VISTA));
  readonly opcionesDeTema = computed<OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: 'Todos los temas' },
    ...(this.facetas()?.temas ?? []).map(t => ({ id: t.valor, etiqueta: t.nombre, conteo: t.total })),
  ]);
  readonly totalDeTemas = computed(() => this.facetas()?.temas.length ?? 0);
  /**
   * ESQUEMA FINAL DEL FILTRO TEMÁTICO: los diez temas más usados son etiquetas (`#tema`) a la vista y el desplegable
   * «Más temas» trae SOLO el resto, sin repetir los que ya están como etiqueta. Antes la lista «Todos los temas» duplicaba
   * las etiquetas y daba dos caminos al mismo filtro.
   */
  readonly otrosTemas = computed(() => (this.facetas()?.temas ?? []).slice(TEMAS_A_LA_VISTA));
  readonly opcionesDeOtrosTemas = computed<OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: 'Elige otro tema' },
    ...this.otrosTemas().map(t => ({ id: t.valor, etiqueta: t.nombre, conteo: t.total })),
  ]);
  /** El desplegable solo marca el tema elegido si es uno de «los demás»; si es una etiqueta, ella lo marca. */
  readonly otroTemaElegido = computed(() => this.otrosTemas().some(t => t.valor === this.selectedKeyword()) ? this.selectedKeyword() : '');

  readonly opcionesDeOrden: readonly OpcionDeFiltro[] = [
    { id: 'titulo:asc', etiqueta: 'Título de la A a la Z' },
    { id: 'titulo:desc', etiqueta: 'Título de la Z a la A' },
    { id: 'anio:desc', etiqueta: 'Año, del más reciente' },
    { id: 'anio:asc', etiqueta: 'Año, del más antiguo' },
    { id: 'autoria:asc', etiqueta: 'Autoría de la A a la Z' },
    { id: 'categoria:asc', etiqueta: 'Categoría de la A a la Z' },
  ];
  readonly ordenElegido = computed(() => `${this.campoDeOrden()}:${this.sentido() === 'desc' ? 'desc' : 'asc'}`);

  /** Las columnas que se ordenan en la vista de lista. El año arranca del más reciente. */
  readonly columnas: readonly ColumnaOrdenable[] = [
    { campo: 'titulo', etiqueta: 'Recurso', clase: 'min-w-[20rem]', primerSentido: 'asc' },
    { campo: 'categoria', etiqueta: 'Categoría', clase: 'w-48', primerSentido: 'asc' },
    { campo: 'autoria', etiqueta: 'Autoría', clase: 'w-56', primerSentido: 'asc' },
    { campo: 'anio', etiqueta: 'Año', clase: 'w-24', primerSentido: 'desc' },
  ];

  /** `aria-sort` de una columna: solo la que ordena dice su dirección. */
  ariaSort(campo: CampoDeOrdenEditorial): 'ascending' | 'descending' | 'none' {
    if (this.campoDeOrden() !== campo) return 'none';
    return this.sentido() === 'desc' ? 'descending' : 'ascending';
  }

  /** Lo que se anuncia a quien usa lector de pantalla cuando cambia el orden. */
  readonly anuncioDeOrden = computed(() => {
    const columna = this.columnas.find(c => c.campo === this.campoDeOrden());
    const asc = this.sentido() !== 'desc';
    const direccion = this.campoDeOrden() === 'anio' ? (asc ? 'del más antiguo al más reciente' : 'del más reciente al más antiguo') : (asc ? 'de la A a la Z' : 'de la Z a la A');
    return `Ordenado por ${(columna?.etiqueta ?? 'Recurso').toLowerCase()}, ${direccion}.`;
  });

  /** Pulsar una columna: si ya ordena, invierte; si no, la elige con su primer sentido. */
  ordenarPor(columna: ColumnaOrdenable): void {
    if (this.campoDeOrden() === columna.campo) {
      this.sentido.set(this.sentido() === 'desc' ? 'asc' : 'desc');
    } else {
      this.orden.set(columna.campo);
      this.sentido.set(columna.primerSentido);
    }
    this.currentPage.set(1);
    this.expandedId.set(null);
  }

  setOrdenElegido(valor: string): void {
    const [campo, sentido] = valor.split(':');
    this.orden.set(campo);
    this.sentido.set(sentido === 'desc' ? 'desc' : 'asc');
    this.currentPage.set(1);
  }

  /** El tipo de material de una ficha, para la etiqueta de su tarjeta. Lo calcula el servidor; sin él, la misma regla en local. */
  etiquetaDeMaterial(recurso: RecursoEditorialDeDiseno): string {
    return TIPOS_DE_MATERIAL.find(t => t.id === recurso.materialId)?.etiqueta ?? tipoDeMaterial(recurso).etiqueta;
  }

  idDeMaterial(recurso: RecursoEditorialDeDiseno): string {
    return recurso.materialId ?? tipoDeMaterial(recurso).id;
  }

  setMaterial(valor: string) {
    this.selectedMaterial.set(valor);
    this.currentPage.set(1);
  }

  setSoporte(valor: string) {
    this.selectedCarrier.set(valor);
    this.currentPage.set(1);
  }

  // ── Valores clicables de la lista (E-5): cada uno filtra por sí mismo ──

  nombresDeAutoria(recurso: RecursoEditorialDeDiseno) { return partirAutoria(recurso.displayAuthor); }

  /** Un año suelto se puede filtrar; un rango («2011 – 2013») no es un año. */
  esAnioSuelto(anio: string): boolean { return /^(19|20)\d{2}$/.test(anio); }

  filtrarPorCategoria(nombre: string): void { this.setActiveTab(nombre); }
  filtrarPorAutor(nombre: string): void { this.selectedAuthor.set(nombre); this.currentPage.set(1); this.expandedId.set(null); }
  filtrarPorAnio(anio: string): void { this.setSelectedYearFilter(anio); this.expandedId.set(null); }

  // El valor que ya traía la URL de una ficha: se guarda aparte del acervo porque llegan en momentos distintos.
  /**
   * La signatura que venía en la dirección, si venía alguna.
   *
   * SE GUARDA APARTE DEL LISTADO: la dirección está desde el primer instante y la ficha se pide por su
   * signatura, no se busca entre las fichas de la página (puede no estar en ella).
   */
  readonly codigoEnLaUrl = signal<string | null>(null);

  /** La signatura de la dirección cuando el servidor dice que NO existe o no está publicada. */
  readonly obraInexistente = signal<string | null>(null);

  @ViewChild('mosaicDetailDialog') mosaicDetailDialog?: ElementRef<HTMLDialogElement>;

  currentCategoryLabel = computed(() => {
    const tab = this.activeTab();
    return this.categories().find((c) => c.id === tab)?.label || (tab === 'all' ? 'Todo el Acervo' : tab);
  });

  /**
   * Los filtros del Catálogo, declarados una vez y enganchados a la URL.
   *
   * <b>ERA LA PANTALLA CON LA BUSQUEDA MAS RICA Y LA MENOS COMPARTIBLE.</b> Tiene búsqueda simple,
   * búsqueda avanzada por título, autoría y palabra clave, filtro por año, pestaña de tipo,
   * palabra clave suelta, orden por columna y dos formas de leer el listado. Todo viaja en la URL:
   * una búsqueda afinada se pega en un correo y recargar no la pierde.
   *
   * <b>`showAdvancedSearch` NO ES UN FILTRO Y POR ESO NO ESTA AQUI.</b> Es si el panel está
   * desplegado; se deduce de que alguno de sus tres campos venga en la URL.
   */
  readonly filtros = [
    filtroDeTexto('q', this.searchTerm),
    filtroDeTexto('titulo', this.advancedTitleSearch),
    filtroDeTexto('autoria', this.advancedAuthorSearch),
    filtroDeTexto('clave', this.advancedKeywordSearch),
    filtroDeTexto('anio', this.selectedYearFilter),
    filtroDeTexto('tipo', this.activeTab, 'all'),
    filtroDeTexto('palabra', this.selectedKeyword),
    filtroDeTexto('subcategoria', this.selectedSubcategory),
    filtroDeTexto('material', this.selectedMaterial),
    filtroDeTexto('soporte', this.selectedCarrier),
    filtroDeTexto('autor', this.selectedAuthor),
    filtroDeTexto('orden', this.orden, 'titulo'),
    filtroDeTexto('sentido', this.sentido, 'asc'),
    filtroDeVista('vista', this.viewMode, 'mosaic'),
    { parametro: 'por', senal: this.porPagina, vacio: POR_PAGINA_DE_PARTIDA,
      desdeTexto: (texto: string) => (this.cantidadesPorPagina.includes(Number(texto)) ? Number(texto) : POR_PAGINA_DE_PARTIDA) },
    filtroDePagina(this.currentPage),
  ];

  /** Cuántos filtros hay puestos, para rotular «Limpiar» con su número. */
  readonly filtrosPuestos = computed(() => contarFiltrosPuestos(this.filtros));

  /**
   * Los filtros que cambian lo que se ve, como chips con «X». El orden, la vista y la cantidad por página
   * NO cuentan: no quitan fichas.
   */
  readonly filtrosAplicados = computed<FiltroAplicado[]>(() => {
    const f = this.facetas();
    const nombre = (lista: { valor: string; nombre: string }[] | undefined, valor: string) => lista?.find(x => x.valor === valor)?.nombre ?? valor;
    const lista: FiltroAplicado[] = [];
    const poner = (clave: string, rotulo: string, valor: string, quitar: () => void) => { if (valor) lista.push({ clave, rotulo, valor, quitar }); };
    poner('q', 'Búsqueda', this.searchTerm().trim(), () => this.cambiarBusqueda(''));
    poner('titulo', 'Título', this.advancedTitleSearch().trim(), () => this.cambiarCampoAvanzado(this.advancedTitleSearch, ''));
    poner('autoria', 'Autoría', this.advancedAuthorSearch().trim(), () => this.cambiarCampoAvanzado(this.advancedAuthorSearch, ''));
    poner('clave', 'Palabra clave', this.advancedKeywordSearch().trim(), () => this.cambiarCampoAvanzado(this.advancedKeywordSearch, ''));
    poner('tipo', 'Categoría', this.activeTab() === 'all' ? '' : this.activeTab(), () => this.setActiveTab('all'));
    poner('subcategoria', 'Subcategoría', this.selectedSubcategory(), () => this.setSelectedSubcategory(''));
    poner('material', 'Tipo', this.selectedMaterial() ? nombre(f?.materiales, this.selectedMaterial()) : '', () => this.setMaterial(''));
    poner('soporte', 'Soporte', this.selectedCarrier() ? nombre(f?.soportes, this.selectedCarrier()) : '', () => this.setSoporte(''));
    poner('anio', 'Año', this.selectedYearFilter(), () => this.setSelectedYearFilter(''));
    poner('palabra', 'Tema', this.selectedKeyword(), () => this.setSelectedKeyword(''));
    poner('autor', 'Autoría', this.selectedAuthor(), () => this.filtrarPorAutor(''));
    return lista;
  });

  constructor() {
    enlazarFiltrosConLaUrl(this.filtros);
    this.normalizarElOrdenDeLaUrl();

    // ABRIR LA FICHA CUANDO LLEGA LA SIGNATURA: se pide por su código. Si ya está en la página que se ve, no
    // hace falta ir al servidor; si no, se pregunta (puede estar en otra página o filtrada).
    effect(() => {
      const codigo = this.codigoEnLaUrl();
      untracked(() => { void this.abrirLaFichaDeLaUrl(codigo); });
    });
    // SI LA URL TRAIA UN CAMPO AVANZADO, EL PANEL SE ABRE. Llegar con la búsqueda avanzada puesta
    // y el panel plegado enseñaría resultados acotados sin decir por qué.
    if (this.advancedTitleSearch() || this.advancedAuthorSearch() || this.advancedKeywordSearch()) {
      this.showAdvancedSearch.set(true);
    }

    // LA CONSULTA SE REHACE CUANDO CAMBIA ALGO y la anterior se cancela (`switchMap`): así no llegan respuestas
    // desordenadas. Las pausas de escritura las pone el buscador (300 ms).
    toObservable(computed(() => ({ c: this.consulta(), n: this.reintento() }))).pipe(
      tap(() => { this.cargando.set(true); this.error.set(null); }),
      switchMap(({ c }) => this.catalogoEditorial.explorarParaElPortal(c).pipe(catchError((err: unknown) => {
        this.error.set((err as { message?: string })?.message || 'No fue posible cargar el catálogo editorial.');
        return of(null);
      }))),
      takeUntilDestroyed(this.destruccion),
    ).subscribe(respuesta => {
      this.cargando.set(false);
      if (!respuesta) return;
      this.pagina.set(respuesta);
      // Una página que ya no existe (se redujeron los resultados) la acota el servidor: se vuelve a la última.
      if (respuesta.totalPaginas > 0 && this.currentPage() > respuesta.totalPaginas) this.currentPage.set(respuesta.totalPaginas);
    });
  }

  /** Las direcciones antiguas traían `orden=az|za`: se traducen a campo y sentido. */
  private normalizarElOrdenDeLaUrl(): void {
    const crudo = this.orden();
    if (crudo === 'az' || crudo === 'za') {
      this.orden.set('titulo');
      this.sentido.set(crudo === 'za' ? 'desc' : 'asc');
    }
  }

  ngOnInit() {
    /*
     * CADA OBRA TIENE SU DIRECCION, y hasta hoy ninguna la tenía.
     *
     * La ficha se abría como un diálogo sin tocar la URL: no se podía enviar el enlace de una
     * publicación, ni volver con el botón de atrás, ni recargar sin perderla. En un catálogo eso no
     * es un detalle: la signatura ES la forma de citar una obra, y citarla tiene que llevar a algún
     * sitio. Ahora `/editorial/PNMC-ED-019` abre esa ficha, y cerrarla vuelve a `/editorial`.
     *
     * SE ESCUCHA EL PARAMETRO Y NO SOLO SE LEE UNA VEZ: así el botón de atrás del navegador cierra
     * la ficha en vez de sacar a la persona del catálogo.
     */
    // EL PARAMETRO VIVE EN LA RUTA HIJA, así que se lee de `firstChild` y no del propio `paramMap`:
    // la página es el padre y el padre no lleva la signatura. Se escucha cada navegación terminada
    // —y se lee una vez al entrar— para que el botón de atrás cierre la ficha en vez de sacar a la
    // persona del catálogo.
    const leerLaSignatura = () =>
      this.codigoEnLaUrl.set(this.ruta.firstChild?.snapshot.paramMap.get('codigo') ?? null);
    leerLaSignatura();
    this.enrutador.events
      .pipe(filter(evento => evento instanceof NavigationEnd), takeUntilDestroyed(this.destruccion))
      .subscribe(() => leerLaSignatura());

    // Check for navigation target (initial selection)
    const initialId = this.navigationService.selectedEditorialResourceId();
    if (initialId) {
      setTimeout(() => {
        this.viewMode.set('table');
        this.expandedId.set(initialId);
        const targetElement = document.getElementById(`resource-row-${initialId}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }

  /** Pide de nuevo la página actual: la salida de un error de carga. */
  loadCatalog() { this.reintento.update(n => n + 1); }

  /**
   * La ficha de la dirección: la de la página que se ve si está ahí; si no, se pide por su signatura.
   * Una signatura que no existe se dice en vez de dejar el catálogo sin explicación.
   */
  private async abrirLaFichaDeLaUrl(codigo: string | null): Promise<void> {
    this.obraInexistente.set(null);
    if (!codigo) { this.selectedMosaicItem.set(null); return; }
    const enLaPagina = this.paginatedResources().find(r => r.id === codigo);
    if (enLaPagina) { this.selectedMosaicItem.set(enLaPagina); return; }
    const resultado = await this.catalogoEditorial.obtenerPublica(codigo);
    // La dirección pudo cambiar mientras se esperaba.
    if (this.codigoEnLaUrl() !== codigo) return;
    if (resultado.ok && resultado.data) { this.selectedMosaicItem.set(aRecursoEditorialDeDiseno(resultado.data)); }
    else { this.obraInexistente.set(codigo); }
  }

  getWebText(key: string, fallback = ''): string {
    return this.webTexts.getWebText(key) || fallback;
  }

  /**
   * Explorar el acervo desde un dato de la ficha.
   *
   * Cierra la ficha, porque el resultado de explorar es un LISTADO y dejarlo tapado por el diálogo
   * que lo pidió no enseña nada. Y vuelve a la primera página: el filtro nuevo tiene otro reparto.
   */
  explorarDesdeLaFicha(peticion: { campo: 'palabraClave' | 'seccion'; valor: string }) {
    this.closeMosaicDetail();
    this.expandedId.set(null);
    if (peticion.campo === 'palabraClave') {
      this.selectedKeyword.set(peticion.valor);
    } else {
      this.activeTab.set(peticion.valor);
      this.selectedSubcategory.set('');
      this.selectedKeyword.set('');
    }
    this.currentPage.set(1);
    this.scrollToFeed();
  }

  setActiveTab(tabId: string) {
    this.activeTab.set(tabId);
    this.selectedSubcategory.set('');
    this.selectedKeyword.set('');
    this.currentPage.set(1);
    this.expandedId.set(null);
  }

  setSelectedKeyword(keyword: string) {
    this.selectedKeyword.set(this.selectedKeyword() === keyword ? '' : keyword);
    this.currentPage.set(1);
  }

  setSelectedSubcategory(valor: string): void {
    this.selectedSubcategory.set(valor);
    this.currentPage.set(1);
  }

  setSelectedYearFilter(valor: string) {
    this.selectedYearFilter.set(valor);
    this.currentPage.set(1);
  }

  /** La búsqueda simple, ya con la pausa del buscador. */
  cambiarBusqueda(valor: string) {
    this.searchTerm.set(valor);
    this.currentPage.set(1);
  }

  cambiarCampoAvanzado(campo: { set(valor: string): void }, valor: string) {
    campo.set(valor);
    this.currentPage.set(1);
  }

  toggleAdvancedSearch() {
    this.showAdvancedSearch.set(!this.showAdvancedSearch());
  }

  /** Limpia los tres campos de la búsqueda avanzada, y nada más. */
  limpiarAvanzada() {
    this.advancedTitleSearch.set('');
    this.advancedAuthorSearch.set('');
    this.advancedKeywordSearch.set('');
    this.currentPage.set(1);
  }

  /** Devuelve TODOS los filtros a su estado de partida, la página incluida. El orden y la vista también vuelven. */
  limpiarTodo() {
    limpiarFiltros(this.filtros);
    this.showAdvancedSearch.set(false);
    this.expandedId.set(null);
  }

  /** Quita el filtro que dice la clave de `app-filtros-activos`. */
  quitarFiltro(clave: string): void {
    this.filtrosAplicados().find(f => f.clave === clave)?.quitar();
    this.expandedId.set(null);
  }

  /** Quita solo lo que filtra, y conserva cómo se ordena, la vista y la cantidad por página. */
  limpiarFiltrosAplicados() {
    for (const filtro of this.filtrosAplicados()) filtro.quitar();
    this.limpiarAvanzada();
    this.expandedId.set(null);
  }

  setViewMode(mode: 'mosaic' | 'table') {
    this.viewMode.set(mode);
    this.expandedId.set(null);
  }

  toggleExpandedId(itemId: string) {
    const isExpanding = this.expandedId() !== itemId;
    this.expandedId.set(isExpanding ? itemId : null);

    if (isExpanding) {
      setTimeout(() => {
        const element = document.getElementById(`resource-row-${itemId}`);
        if (element) {
          const yOffset = -140;
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);
    }
  }

  setSelectedMosaicItem(item: RecursoEditorialDeDiseno | null) {
    if (!item) {
      this.closeMosaicDetail();
      return;
    }

    this.selectedMosaicItem.set(item);
    // LOS FILTROS SE CONSERVAN: quien vuelve de una ficha vuelve a su búsqueda, no al acervo entero.
    void this.enrutador.navigate(['/editorial', item.id], { queryParamsHandling: 'preserve' });
  }

  ngAfterViewChecked(): void {
    const dialog = this.mosaicDetailDialog?.nativeElement;
    if (this.selectedMosaicItem() && dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  closeMosaicDetail(event?: Event) {
    event?.preventDefault();
    const dialog = this.mosaicDetailDialog?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
    this.selectedMosaicItem.set(null);
    if (this.codigoEnLaUrl()) {
      void this.enrutador.navigate(['/editorial'], { queryParamsHandling: 'preserve' });
    }
  }

  onMosaicDialogClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeMosaicDetail();
    }
  }

  /** La página que pide la paginación. */
  irAPagina(page: number) {
    this.currentPage.set(Math.max(1, Math.min(this.totalPages(), page)));
    this.expandedId.set(null);
    this.scrollToFeed();
  }

  /** Otra cantidad por página (E-3): vuelve a la primera, porque quedarse en la 4 de una lista más corta enseña un vacío falso. */
  cambiarPorPagina(cantidad: number) {
    this.porPagina.set(cantidad);
    this.currentPage.set(1);
    this.expandedId.set(null);
  }

  openUrl(url: string) {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  splitParagraphs(text = ''): string[] {
    return text.split('\n').filter(Boolean);
  }

  private scrollToFeed() {
    setTimeout(() => {
      const element = document.getElementById('editorial-catalogo');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  }
}
