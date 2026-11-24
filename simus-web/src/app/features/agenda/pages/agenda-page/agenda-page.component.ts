import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import {  
  LucideCalendar, 
  LucideClock, 
  LucideGraduationCap, 
  LucideMegaphone, 
  LucideMusic2, 
  LucidePartyPopper, 
  LucideSparkles, 
  LucideUsers2, 
  LucideMapPin
} from '@lucide/angular';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { EventoDeDiseno } from '../../../../core/services/adaptadores-del-diseno';
import { TerritorioConCodigo } from '../../../../core/services/catalog.service';
import { OrigenDelEventoComponent } from '../../../../shared/components/ui/origen-del-evento/origen-del-evento.component';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { SectionHeaderComponent } from '../../../../shared/components/ui/section-header/section-header.component';
import { 
  sortUniqueByLocale,
  normalizeDepartmentName,
  normalizeMunicipalityName,
  getDepartmentSelectionValue
} from '../../../map/domain/map-domain';
import { CLAVE_DE_FILTROS_RECORDADOS } from '../../domain/filtros-recordados';
import { AnadirAlCalendarioComponent } from '../../components/anadir-al-calendario/anadir-al-calendario.component';
import { BuscadorDeListaComponent } from '../../../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroActivo, FiltrosActivosComponent } from '../../../../shared/components/ui/filtros-activos/filtros-activos.component';
import { BotonComponent } from '../../../../shared/components/ui/boton/boton.component';
import { EstadoDeListaComponent } from '../../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { RevelarDirective } from '../../../../shared/directives/revelar.directive';
import {
  CANTIDADES_POR_PAGINA,
  contarFiltrosPuestos,
  enlazarFiltrosConLaUrl,
  filtroDeCantidad,
  filtroDePagina,
  filtroDeTexto,
  filtroDeVista,
  limpiarFiltros,
} from '../../../../shared/utils/filtros-en-la-url';
import { PaginacionDeListaComponent } from '../../../../shared/components/ui/paginacion-de-lista/paginacion-de-lista.component';
import { etiquetasDisponibles } from '../../../../shared/utils/etiquetas';
import { EtiquetasDeContenidoComponent } from '../../../../shared/components/ui/etiquetas-de-contenido/etiquetas-de-contenido.component';
import { formatearFecha } from '../../../../shared/utils/formatos-de-fecha';
import {
  FiltroDesplegableComponent,
  OpcionDeFiltro,
} from '../../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import {
  OpcionSegmentada,
  SelectorSegmentadoComponent,
} from '../../../../shared/components/ui/selector-segmentado/selector-segmentado.component';


@Component({
  selector: 'app-agenda-page',
  standalone: true,
  imports: [TextoWebPipe, 
    RouterLink,
    RevelarDirective,
    CommonModule,
    SectionHeaderComponent,
    EsqueletoComponent,
    OrigenDelEventoComponent,
    EstadoDeListaComponent,
    BotonComponent,
    BuscadorDeListaComponent,
    FiltrosActivosComponent,
    AnadirAlCalendarioComponent,
    FiltroDesplegableComponent,
    EtiquetasDeContenidoComponent,
    PaginacionDeListaComponent,
    SelectorSegmentadoComponent,
    LucideCalendar,
    LucideClock,
    LucideGraduationCap,
    LucideMegaphone,
    LucideMusic2,
    LucidePartyPopper,
    LucideSparkles,
    LucideUsers2,
    LucideMapPin,
  ],
  templateUrl: './agenda-page.component.html'
})
export class AgendaPageComponent implements OnInit {
  private webTexts = inject(TextosWebService);
  private catalogService = inject(CatalogService);

  openIndex = signal<number>(-1);
  currentPage = signal<number>(1);
  /**
   * CÓMO SE ACOTA EL TIEMPO: un día, un mes o un tramo entre dos fechas.
   *
   * Eran dos posiciones —día y mes— y ninguna respondía «qué hay entre el 20 de septiembre y el 5
   * de octubre», que es como se planea un viaje o una programación. El tramo se pidió el 14 de
   * septiembre de 2026: «una mejor manera para filtrar una fecha exacta, un mes, como rango de
   * tiempo en la búsqueda».
   */
  /** Las tres posiciones del selector de fecha, en su orden y con su rótulo editable. */
  readonly MODOS_DE_FECHA = [
    { id: 'exact' as const, clave: 'agenda_filter_date_exact', rotulo: 'Día' },
    { id: 'month' as const, clave: 'agenda_filter_date_month', rotulo: 'Mes' },
    { id: 'range' as const, clave: 'agenda_filter_date_range', rotulo: 'Rango' },
  ];

  /** Las mismas tres posiciones, en la forma que pide el selector segmentado común. */
  readonly modosDeFecha = computed<readonly OpcionSegmentada[]>(() =>
    this.MODOS_DE_FECHA.map(modo => ({ id: modo.id, etiqueta: this.getWebText(modo.clave, modo.rotulo) })));

  dateMode = signal<'exact' | 'month' | 'range'>('exact');
  fechaDesde = signal<string>('');
  fechaHasta = signal<string>('');

  /**
   * LA BÚSQUEDA ESCRITA, QUE NO EXISTÍA.
   *
   * La Agenda solo se podía acotar por listas: departamento, municipio, categoría y fecha. Quien
   * busca «marimba» o el nombre de un festival no tenía por dónde entrar, mientras que el Catálogo
   * Editorial sí tiene buscador. Mira título, descripción, lugar, categoría y organizador.
   */
  busqueda = signal<string>('');
  viewMode = signal<'list' | 'calendar'>('list');

  selectedDept = signal<string>('');
  selectedMunicipality = signal<string>('');
  selectedExactDate = signal<string>('');
  /** El año elegido («2026»), o vacío para todos. */
  anioElegido = signal<string>('');
  /** El mes elegido, de «01» a «12», o vacío para todos. */
  mesElegido = signal<string>('');
  selectedCategory = signal<string>('Todos');
  /** El código de la etiqueta (proyecto transversal) elegida, p. ej. `celebra-la-musica-2026`; vacío para todas. */
  proyectoElegido = signal<string>('');

  /**
   * SIN «PRÓXIMOS / PASADOS / TODOS»: LA FECHA DECIDE QUÉ PARTE DEL TIEMPO SE VE (G6).
   *
   * Eran tres botones más en un panel que ya tenía tres maneras de acotar la fecha, y casi nadie
   * los necesitaba. Por omisión se ve lo que viene (los eventos en curso cuentan, porque un
   * festival que empezó ayer y acaba el domingo sigue siendo algo a lo que se puede ir), del más
   * cercano al más lejano. En cuanto se elige un día, un mes, un año o un tramo se mira todo el
   * calendario, también lo ya realizado: el archivo no desaparece, se llega a él por la fecha, que
   * es como se busca.
   */
  readonly hayFechaPuesta = computed(() => {
    switch (this.dateMode()) {
      case 'exact': return !!this.selectedExactDate();
      case 'month': return !!this.anioElegido() || !!this.mesElegido();
      case 'range': return !!this.fechaDesde() || !!this.fechaHasta();
    }
  });

  isLoading = true;
  isRefreshing = false;
  isError = false;
  error: { message?: string } | null = null;

// TIPADO Y NO `any`, que es lo unico que se toca del codigo portado ademas de la conexion.
// El diseno viene de un desarrollo mas laxo; poner el tipo no cambia un pixel y es lo que
// permite que el trinquete de tipado siga bajando en vez de subir.
  agendaData = signal<EventoDeDiseno[]>([]);

  Math = Math;

  padDay(d: string | number): string {
    return String(d ?? '').padStart(2, '0');
  }

  /**
   * El catálogo territorial, leído de la fuente confirmada del proyecto.
   *
   * <b>ANTES SALIA DE UNA TABLA EN MEMORIA Y ESTABA SIEMPRE VACIO.</b> El diseño portado leía
   * `MapDomain.getSortedDepartmentNames()`, que devuelve las claves de una tabla que rellena EL
   * GEOVISOR al cargarse. Quien entraba directo a `/agenda` no había pasado por el mapa, así que
   * la tabla era `{}` y el desplegable de departamento no ofrecía ninguna opción. El dato existía
   * y era correcto; lo que fallaba era depender de que otra pantalla lo hubiera traído antes.
   *
   * Ahora se pide a `/publico/divipola`, que es la fuente del proyecto, desde esta misma pantalla.
   */
  private readonly territorios = signal<TerritorioConCodigo[]>([]);

  departments = computed(() => this.territorios().map((territorio) => territorio.nombre));

  cities = computed(() => {
    const departamento = this.selectedDept();
    if (!departamento) return [];
    const encontrado = this.territorios().find((territorio) => territorio.nombre === departamento);
    return sortUniqueByLocale((encontrado?.municipios ?? []).map((municipio) => municipio.nombre));
  });

  /** «nov»: el mes abreviado de la tarjeta, del formateador único. */
  mesCorto(fecha: Date | null | undefined, respaldo: string): string {
    return fecha ? formatearFecha(fecha, 'mes', { calendario: true }) : respaldo;
  }

  /**
   * Los eventos del tiempo que se mira, ya en el orden en que se leen.
   *
   * Sin fecha puesta, solo lo que viene; con una fecha puesta, todo el calendario, del más antiguo al
   * más reciente (quien busca «septiembre» quiere leer septiembre de principio a fin).
   * EL MISMO DESEMPATE QUE EL SERVIDOR (`/publico/agenda`): por fecha y, a igual fecha, por
   * identificador. Sin él, la lista y la portada podían no coincidir en cuál es «el próximo».
   */
  private readonly delTiempoElegido = computed(() => {
    const porVenir = (item: EventoDeDiseno) => item.situacion !== 'finalizado';
    const primeroElCercano = (a: EventoDeDiseno, b: EventoDeDiseno) =>
      a.dateObj.getTime() - b.dateObj.getTime() || Number(a.id) - Number(b.id);
    const todos = this.agendaData();
    return (this.hayFechaPuesta() ? [...todos] : todos.filter(porVenir)).sort(primeroElCercano);
  });

  /** Cuántos eventos hay en cada año, sobre TODO el calendario: es por donde se llega al archivo. */
  readonly opcionesDeAnio = computed<OpcionDeFiltro[]>(() => {
    const cuenta = new Map<string, number>();
    for (const item of this.agendaData()) {
      if (!item.dateObj) { continue; }
      const anio = String(item.dateObj.getFullYear());
      cuenta.set(anio, (cuenta.get(anio) ?? 0) + 1);
    }
    return [
      { id: '', etiqueta: 'Todos los años', conteo: this.agendaData().length },
      ...[...cuenta.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([anio, total]) => ({ id: anio, etiqueta: anio, conteo: total })),
    ];
  });

  /**
   * Los meses que de verdad tienen eventos —en el año elegido, si hay uno—, escritos solo como mes
   * («enero», «febrero»): sin año y sin mayúscula sostenida. Un desplegable de doce meses donde nueve
   * no llevan a nada es una lista de callejones sin salida.
   */
  readonly opcionesDeMes = computed<OpcionDeFiltro[]>(() => {
    const anio = this.anioElegido();
    const cuenta = new Map<string, number>();
    let total = 0;
    for (const item of this.agendaData()) {
      if (!item.dateObj) { continue; }
      if (anio && String(item.dateObj.getFullYear()) !== anio) { continue; }
      const mes = String(item.dateObj.getMonth() + 1).padStart(2, '0');
      cuenta.set(mes, (cuenta.get(mes) ?? 0) + 1);
      total++;
    }
    return [
      { id: '', etiqueta: 'Todos los meses', conteo: total },
      ...[...cuenta.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, cuantos]) => ({
        id: mes,
        etiqueta: formatearFecha(new Date(2000, Number(mes) - 1, 1), 'mes-nombre', { calendario: true }),
        conteo: cuantos,
      })),
    ];
  });

  activityCategories = computed(() => {
    const cats = [...new Set(this.agendaData().map(item => item.cat).filter(Boolean))];
    return ['Todos', ...cats];
  });

  /** Departamento y municipio en la forma de los filtros comunes, con la opción de «todos» al frente. */
  readonly opcionesDeDepartamento = computed<OpcionDeFiltro[]>(() => [
    { id: '', etiqueta: this.getWebText('agenda_filter_all_departments', 'Todos los departamentos') },
    ...this.departments().map(nombre => ({ id: nombre, etiqueta: nombre })),
  ]);

  readonly opcionesDeMunicipio = computed<OpcionDeFiltro[]>(() => [
    {
      id: '',
      etiqueta: !this.selectedDept()
        ? this.getWebText('agenda_filter_city_select_dept', 'Elige primero un departamento')
        : this.cities().length > 0
          ? this.getWebText('agenda_filter_city_all_mun', 'Todos los municipios')
          : this.getWebText('agenda_filter_city_no_mun', 'Sin municipios disponibles'),
    },
    ...this.cities().map(nombre => ({ id: nombre, etiqueta: nombre })),
  ]);

  /**
   * LAS ETIQUETAS QUE TIENEN EVENTOS, con cuántos. Son los proyectos transversales de los eventos (una sola fuente
   * para todo el sitio, ver `utils/etiquetas.ts`): salen de lo que cada evento declara, no de una lista escrita aquí.
   * El filtro del servidor (`/publico/agenda?proyecto=<código>`) usa el mismo código, así que un enlace de etiqueta
   * como `/agenda?proyecto=celebra-la-musica-2026` abre la lista ya acotada.
   */
  readonly etiquetasDeLaAgenda = computed(() => etiquetasDisponibles(this.agendaData()));

  filteredAgendaItems = computed(() => {
    const data = this.delTiempoElegido();
    const dept = this.selectedDept();
    const municipality = this.selectedMunicipality();
    const exactDate = this.selectedExactDate();
    const anio = this.anioElegido();
    const mes = this.mesElegido();
    const category = this.selectedCategory();
    const dMode = this.dateMode();
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    const texto = this.normalizarTexto(this.busqueda());
    const proyecto = this.proyectoElegido();

    const selectedDepartmentNormalized = normalizeDepartmentName(getDepartmentSelectionValue(dept));
    const selectedMunicipalityNormalized = normalizeMunicipalityName(municipality);

    return data.filter((item) => {
      // 1. Filter by location
      const locationTokens = String(item?.l || '')
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);
      const itemMunicipality = item?.municipality || locationTokens[0] || '';
      const itemDepartment = item?.department || locationTokens[1] || '';

      const matchesDepartment = !selectedDepartmentNormalized
        || normalizeDepartmentName(itemDepartment) === selectedDepartmentNormalized;
      const matchesMunicipality = !selectedMunicipalityNormalized
        || normalizeMunicipalityName(itemMunicipality) === selectedMunicipalityNormalized;

      if (!matchesDepartment || !matchesMunicipality) return false;

      if (proyecto && !(item.proyectos ?? []).some(p => p.slug === proyecto)) return false;

      // 2. Filter by activity type
      const matchesCategory = category === 'Todos' || item.cat === category;
      if (!matchesCategory) return false;

      // 2 bis. Búsqueda escrita: sin tildes y en minúsculas, sobre lo que alguien recordaría de un
      // evento —su nombre, dónde es, de qué tipo y quién lo organiza—.
      if (texto) {
        const donde = [item.t, item.desc, item.l, item.exactLocation, item.cat, item.organizer]
          .map(valor => this.normalizarTexto(String(valor ?? '')))
          .join(' ');
        if (!donde.includes(texto)) return false;
      }

      // 3. Filter by date / month selection
      if (dMode === 'range') {
        // UN EVENTO ENTRA SI SE SOLAPA CON EL TRAMO, no solo si empieza dentro: un festival de una
        // semana que arranca el día antes del «desde» sigue ocurriendo durante el tramo.
        if (!desde && !hasta) return true;
        if (!item.dateObj) return false;
        const inicio = item.dateObj;
        const fin = item.fechaFin ? new Date(item.fechaFin.slice(0, 10) + 'T23:59:59') : inicio;
        if (desde && fin < new Date(desde + 'T00:00:00')) return false;
        if (hasta && inicio > new Date(hasta + 'T23:59:59')) return false;
        return true;
      }
      if (dMode === 'exact') {
        if (!exactDate) return true;
        const filterDateObj = new Date(exactDate + 'T00:00:00');
        return item.dateObj && 
               item.dateObj.getFullYear() === filterDateObj.getFullYear() &&
               item.dateObj.getMonth() === filterDateObj.getMonth() &&
               item.dateObj.getDate() === filterDateObj.getDate();
      } else {
        // MES Y AÑO SON FILTROS APARTE: el mes solo («marzo») vale para cualquier año, y con un año
        // puesto se acota a ese año. Cada uno puede quedar vacío.
        if (dMode === 'month' && (anio || mes)) {
          if (!item.dateObj) return false;
          if (anio && String(item.dateObj.getFullYear()) !== anio) return false;
          if (mes && String(item.dateObj.getMonth() + 1).padStart(2, '0') !== mes) return false;
        }
        return true;
      }
    });
  });

  /** Cuántos eventos por página (`?por=`): el selector común de la paginación. */
  readonly porPagina = signal<number>(CANTIDADES_POR_PAGINA[0]);
  readonly cantidadesPorPagina = CANTIDADES_POR_PAGINA;

  totalPages = computed(() => {
    const count = this.filteredAgendaItems().length;
    return Math.max(1, Math.ceil(count / this.porPagina()));
  });

  paginatedAgendaItems = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.porPagina();
    return this.filteredAgendaItems().slice(startIndex, startIndex + this.porPagina());
  });

  /**
   * Los filtros de la Agenda, declarados una vez y enganchados a la URL.
   *
   * <b>ERA LA PANTALLA CON MAS FILTROS Y LA UNICA SIN FORMA DE LIMPIARLOS.</b> Cinco —territorio,
   * municipio, fecha exacta, mes y categoría— y ninguno se podía compartir, ni sobrevivía a una
   * recarga, ni tenía un «Limpiar filtros»: había que devolver los cinco desplegables a mano.
   *
   * <b>`dateMode` NO ES UN FILTRO Y POR ESO NO ESTA AQUI.</b> Decide cuál de los dos filtros de
   * fecha está activo, y viaja implícito en cuál de los dos parámetros trae la URL.
   */
  readonly filtros = [
    filtroDeTexto('departamento', this.selectedDept),
    filtroDeTexto('municipio', this.selectedMunicipality),
    filtroDeTexto('fecha', this.selectedExactDate),
    filtroDeTexto('anio', this.anioElegido),
    filtroDeTexto('mes', this.mesElegido),
    filtroDeTexto('desde', this.fechaDesde),
    filtroDeTexto('hasta', this.fechaHasta),
    filtroDeTexto('q', this.busqueda),
    filtroDeTexto('categoria', this.selectedCategory, 'Todos'),
    filtroDeTexto('proyecto', this.proyectoElegido),
    filtroDeVista('vista', this.viewMode, 'list'),
    filtroDePagina(this.currentPage),
    filtroDeCantidad(this.porPagina),
  ];

  /** Los filtros que acotan la lista: todos menos la vista y la página, que «Limpiar filtros» no debe tocar. */
  private readonly filtrosDeContenido = this.filtros.filter(filtro => filtro.parametro !== 'vista' && filtro.parametro !== 'pagina' && filtro.parametro !== 'por');

  /** Cuántos filtros hay puestos (sin contar la vista ni la página). */
  readonly filtrosPuestos = computed(() => contarFiltrosPuestos(this.filtrosDeContenido));

  /**
   * LOS FILTROS QUE DE VERDAD ESTÁN ACOTANDO LA LISTA, cada uno con su «X» (A-1).
   *
   * Solo los del modo de fecha activo: un día elegido y luego abandonado por «Mes» ya no acota nada y no se
   * pinta, para que el chip diga lo que la lista hace. «Limpiar filtros» sí los borra todos.
   */
  readonly filtrosActivos = computed<readonly FiltroActivo[]>(() => {
    const filtros: FiltroActivo[] = [];
    const largo = (iso: string) => formatearFecha(new Date(iso + 'T12:00:00'), 'fecha-larga');
    if (this.busqueda().trim()) { filtros.push({ clave: 'q', rotulo: 'Búsqueda', valor: this.busqueda().trim() }); }
    if (this.selectedCategory() !== 'Todos') { filtros.push({ clave: 'categoria', rotulo: 'Tipo', valor: this.selectedCategory() }); }
    const proyecto = this.proyectoElegido();
    if (proyecto) {
      const nombre = this.etiquetasDeLaAgenda().find(e => e.codigo === proyecto)?.nombre;
      filtros.push({ clave: 'proyecto', rotulo: 'Etiqueta', valor: nombre ?? proyecto });
    }
    switch (this.dateMode()) {
      case 'exact':
        if (this.selectedExactDate()) { filtros.push({ clave: 'fecha', rotulo: 'Día', valor: largo(this.selectedExactDate()) }); }
        break;
      case 'month':
        if (this.anioElegido()) { filtros.push({ clave: 'anio', rotulo: 'Año', valor: this.anioElegido() }); }
        if (this.mesElegido()) {
          filtros.push({ clave: 'mes', rotulo: 'Mes', valor: formatearFecha(new Date(2000, Number(this.mesElegido()) - 1, 1), 'mes-nombre', { calendario: true }) });
        }
        break;
      case 'range':
        if (this.fechaDesde()) { filtros.push({ clave: 'desde', rotulo: 'Desde', valor: largo(this.fechaDesde()) }); }
        if (this.fechaHasta()) { filtros.push({ clave: 'hasta', rotulo: 'Hasta', valor: largo(this.fechaHasta()) }); }
        break;
    }
    if (this.selectedDept()) { filtros.push({ clave: 'departamento', rotulo: 'Departamento', valor: this.selectedDept() }); }
    if (this.selectedMunicipality()) { filtros.push({ clave: 'municipio', rotulo: 'Municipio', valor: this.selectedMunicipality() }); }
    return filtros;
  });

  /** Los modos de vista, solo con icono y a la derecha del título (A-4). El id `calendar` se conserva: ya viaja en enlaces compartidos (`?vista=calendar`). */
  readonly modosDeVista: readonly OpcionSegmentada[] = [
    { id: 'list', etiqueta: 'Vista de lista', icono: 'lista' },
    { id: 'calendar', etiqueta: 'Vista de mosaico', icono: 'mosaico' },
  ];

  /** Cuántos eventos cumplen los filtros, para el aviso de resultados. */
  readonly totalFiltrados = computed(() => this.filteredAgendaItems().length);

  constructor() {
    enlazarFiltrosConLaUrl(this.filtros);
    // UN ENLACE ANTIGUO TRAÍA EL MES COMO «2026-11»: se parte en año y mes para que siga abriendo.
    const antiguo = /^(\d{4})-(\d{2})$/.exec(this.mesElegido());
    if (antiguo) {
      this.anioElegido.set(antiguo[1]);
      this.mesElegido.set(antiguo[2]);
    }
    // EL MODO DE FECHA NO SE GUARDA: se deduce de cuál de los filtros vino en la URL, que es lo que
    // evita que la pantalla abra en «fecha exacta» enseñando resultados de un filtro por mes o por tramo.
    if (this.anioElegido() || this.mesElegido()) this.dateMode.set('month');
    else if (this.fechaDesde() || this.fechaHasta()) this.dateMode.set('range');
  }

  /** Devuelve los filtros a su estado de partida y vuelve al principio de la lista. La vista (lista o mosaico) se conserva. */
  limpiarTodosLosFiltros() {
    limpiarFiltros(this.filtrosDeContenido);
    this.dateMode.set('exact');
    this.resetPaginationAndSelection();
  }

  /** Quita UN filtro, el de la «X» de su chip, sin tocar los demás. */
  quitarFiltro(clave: string): void {
    switch (clave) {
      case 'q': this.busqueda.set(''); break;
      case 'categoria': this.selectedCategory.set('Todos'); break;
      case 'proyecto': this.proyectoElegido.set(''); break;
      case 'fecha': this.selectedExactDate.set(''); break;
      case 'anio': this.setAnio(''); break;
      case 'mes': this.mesElegido.set(''); break;
      case 'desde': this.fechaDesde.set(''); break;
      case 'hasta': this.fechaHasta.set(''); break;
      case 'departamento': this.setSelectedDept(''); break;
      case 'municipio': this.selectedMunicipality.set(''); break;
    }
    this.resetPaginationAndSelection();
  }

  /**
   * RECUERDA LOS FILTROS AL ABRIR UN EVENTO, para que «Volver a la agenda» los devuelva (A-7).
   *
   * La dirección del evento no los lleva (sería compartir un enlace con filtros ajenos), así que se guardan en la
   * sesión de la pestaña. Se leen en la ficha y se borran al volver.
   */
  recordarFiltros(): void {
    try { sessionStorage.setItem(CLAVE_DE_FILTROS_RECORDADOS, window.location.search); } catch { /* sin almacenamiento, vuelve sin filtros */ }
  }

  setProyecto(valor: string | null) {
    this.proyectoElegido.set(valor ?? '');
    this.resetPaginationAndSelection();
  }

  /** Lo que escribe el buscador, ya con su pausa de 300 ms (B-1). */
  alBuscar(texto: string): void {
    this.busqueda.set(texto);
    this.resetPaginationAndSelection();
  }

  ngOnInit() {
    // SIN CATALOGO LA AGENDA SE SIGUE LEYENDO: los filtros territoriales no aparecen y ya está.
    // Es lo que la gente viene a hacer aquí, y no puede depender de una segunda petición.
    this.catalogService.fetchDivipolaConCodigos().subscribe({
      next: (territorios) => this.territorios.set(territorios),
      error: () => this.territorios.set([]),
    });

    this.loadAgendaData();
  }

  loadAgendaData(isRefresh = false) {
    if (isRefresh) {
      this.isRefreshing = true;
    } else {
      this.isLoading = true;
    }
    this.isError = false;
    this.error = null;

    // CONEXION REAL. `fetchAgendaEvents` lee `/publico/agenda` y traduce en
    // `adaptadores-del-diseno`; el orden por fecha lo mantiene esta pantalla, como el diseno.
    this.catalogService.fetchAgendaEvents().subscribe({
      next: (res) => {
        this.agendaData.set([...(res.items || [])]);
        this.isLoading = false;
        this.isRefreshing = false;
      },
      error: (err) => {
        this.error = err;
        this.isError = true;
        this.isLoading = false;
        this.isRefreshing = false;
      }
    });
  }

  retry() {
    this.loadAgendaData(false);
  }

  getWebText(key: string, fallback = ''): string {
    return this.webTexts.getWebText(key) || fallback;
  }

  setDateMode(mode: string) {
    this.dateMode.set(mode as 'exact' | 'month' | 'range');
    this.resetPaginationAndSelection();
  }

  cambiarFechaDesde(evento: Event): void {
    this.fechaDesde.set((evento.target as HTMLInputElement).value);
    this.resetPaginationAndSelection();
  }

  cambiarFechaHasta(evento: Event): void {
    this.fechaHasta.set((evento.target as HTMLInputElement).value);
    this.resetPaginationAndSelection();
  }

  /** Sin tildes y en minúsculas: quien busca escribe rápido, y exigir acentos es un examen. */
  private normalizarTexto(valor: string): string {
    return (valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  /**
   * El icono de cada tipo de actividad.
   *
   * SE ELIGE POR EL NOMBRE porque la categoría llega como texto del registro —«Festivales»,
   * «Formacion», «Encuentros»— y no como un catálogo con icono, que es lo que sí tiene el Catálogo
   * Editorial. Se normaliza antes de comparar para que «Formación» y «Formacion» caigan en el
   * mismo sitio. Lo que no esté en la tabla se dibuja con el icono genérico de actividad.
   */
  iconoDeCategoria(categoria: string): string {
    const nombre = this.normalizarTexto(categoria);
    if (nombre === 'todos') return 'todos';
    if (nombre.includes('festival')) return 'festival';
    if (nombre.includes('formacion') || nombre.includes('taller') || nombre.includes('curso')) return 'formacion';
    if (nombre.includes('encuentro') || nombre.includes('foro')) return 'encuentro';
    if (nombre.includes('concierto') || nombre.includes('concurso')) return 'concierto';
    if (nombre.includes('convocatoria')) return 'convocatoria';
    return 'otra';
  }

  /** Cuántos eventos hay en cada tipo, dentro del tiempo que se está mirando (lo próximo o el calendario elegido). */
  cuantosEnCategoria(categoria: string): number {
    const mirados = this.delTiempoElegido();
    if (categoria === 'Todos') { return mirados.length; }
    return mirados.filter(item => item.cat === categoria).length;
  }

  setSelectedDept(valor: string) {
    this.selectedDept.set(valor);
    this.selectedMunicipality.set('');
    this.resetPaginationAndSelection();
  }

  setSelectedMunicipality(valor: string) {
    this.selectedMunicipality.set(valor);
    this.resetPaginationAndSelection();
  }

  setAnio(valor: string) {
    this.anioElegido.set(valor);
    // El mes elegido puede no existir en el año nuevo.
    if (this.mesElegido() && !this.opcionesDeMes().some(opcion => opcion.id === this.mesElegido())) {
      this.mesElegido.set('');
    }
    this.resetPaginationAndSelection();
  }

  setMes(valor: string) {
    this.mesElegido.set(valor);
    this.resetPaginationAndSelection();
  }

  setSelectedExactDate(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedExactDate.set(input.value);
    this.resetPaginationAndSelection();
  }

  setSelectedCategory(cat: string) {
    this.selectedCategory.set(cat);
    this.resetPaginationAndSelection();
  }

  toggleOpenIndex(index: number) {
    this.openIndex.set(this.openIndex() === index ? -1 : index);
  }

  setViewMode(mode: 'list' | 'calendar') {
    this.viewMode.set(mode);
    this.openIndex.set(-1);
  }

  setCurrentPage(page: number) {
    this.currentPage.set(page);
    this.openIndex.set(-1);
    this.scrollToFeed();
  }

  /** Otra cantidad por página: vuelve a la primera, porque quedarse en la 4 de una lista más corta enseña un vacío falso. */
  cambiarPorPagina(cantidad: number) {
    this.porPagina.set(cantidad);
    this.setCurrentPage(1);
  }

  /** El lugar en su propia línea y el territorio en otra: el código ya no sustituye al municipio. */
  territorioDe(item: EventoDeDiseno): string {
    return item.l;
  }

  private resetPaginationAndSelection() {
    this.currentPage.set(1);
    this.openIndex.set(-1);
  }

  private scrollToFeed() {
    setTimeout(() => {
      const element = document.getElementById('agenda-lista-eventos');
      if (element) {
        const yOffset = -112;
        const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 50);
  }
}
