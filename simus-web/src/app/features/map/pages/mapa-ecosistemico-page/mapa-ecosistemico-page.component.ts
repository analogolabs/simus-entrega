import { TextoWebPipe } from '../../../../shared/texto/texto-web.pipe';
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  AfterViewInit, 
  inject, 
  signal, 
  computed, 
  effect, 
  untracked, 
  Injector, 
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  HostListener,
  WritableSignal,
  Type,
} from '@angular/core';
import { CommonModule, NgComponentOutlet, isPlatformBrowser } from '@angular/common';
// Extiende L con `L.maplibreGL`. Se importa por efecto: no exporta nada que se use aqui.
import '@maplibre/maplibre-gl-leaflet';
import { environment } from '../../../../../environments/environment';
import { CatalogService, PuntoMunicipalDelCatalogo } from '../../../../core/services/catalog.service';
import {
  FiltroDeclarado,
  enlazarFiltrosConLaUrl,
  filtroDeTexto,
  filtroDeVista,
} from '../../../../shared/utils/filtros-en-la-url';
import { FormsModule } from '@angular/forms';
import { 
  LucideBarChart3, 
  LucideCircleHelp, 
  LucideLayers3, 
  LucideMail, 
  LucideMapPin, 
  LucidePrinter, 
  LucideSearch, 
  LucideX, 
  LucideGlobe, 
  LucideZoomIn,
  LucideZoomOut,
  LucideHand,
  LucideTrendingUp,
  LucidePieChart,
  LucideTarget,
  LucideMap,
  LucideTriangleAlert,
  LucideRadio,
  LucideMusic,
  LucideChevronRight,
  LucideChevronLeft,
  LucideInfo,
  LucideAperture,
  LucideShapes,
  LucideBookOpen,
  LucideLayoutGrid,
  LucideList,
  LucideCalendarDays,
  LucideKeyboard,
  LucidePlay,
  LucideMousePointer2
} from '@lucide/angular';
import { BuscadorDeListaComponent } from '../../../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import type { FiltrosDelAnalisis } from '../../domain/analisis-avanzado';
import { PESTANAS_DEL_TABLERO, PestanaDelTablero, pestanaDesdeTexto, pestanasConTextos } from '../../domain/pestanas-del-tablero';
import { SelectorSegmentadoComponent, OpcionSegmentada } from '../../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { DEFAULT_TEXTS } from '../../../../core/cms/registro-de-textos-web';
import { RecorridoGuiadoService } from '../../../../core/services/recorrido-guiado.service';
import { ubicarLaTarjeta, UbicacionDeLaTarjeta } from '../../domain/ubicacion-del-tutorial';
import { DialogoDirective } from '../../../../shared/directives/dialogo.directive';
import { MapDataService } from '../../../../core/services/map-data.service';
import { CATEGORIAS_ECOSISTEMA } from '../../../../core/services/categorias-ecosistema.config';
import { NavigationService, PAGE_IDS } from '../../../../core/services/navigation.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import * as MapDomain from '../../domain/map-domain';
import * as Analitica from '../../domain/analitica-del-mapa';
import { EvolucionDelEcosistemaService, PuntoDeEvolucion } from '../../../../core/services/evolucion-del-ecosistema.service';
import { SelectorDeVistaDelMapaComponent } from '../../components/selector-de-vista-del-mapa.component';
import { GraficoDelTableroComponent } from '../../components/tablero/grafico-del-tablero.component';
import { FilaDeDatos, PanelDeGraficoComponent } from '../../components/tablero/panel-de-grafico.component';
import { ChipDeFiltroComponent } from '../../../../shared/components/ui/chip-de-filtro/chip-de-filtro.component';
import { fichaDelIndicador, FichaDeIndicador } from '../../domain/indicadores-del-tablero';
import { evolucionPorAnio, opcionBarras, opcionColumnas, opcionMosaico } from '../../domain/opciones-del-tablero';
import { ProcesoDelEvento } from '../../../../core/services/agenda.service';
import { OrigenDelEventoComponent } from '../../../../shared/components/ui/origen-del-evento/origen-del-evento.component';
import { EsqueletoComponent } from '../../../../shared/components/ui/esqueleto/esqueleto.component';
import { AccionDeRegistro, MenuDeAccionesComponent } from '../../../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';
import { CabeceraDeExportacion, FilaDeBarra, Celda, aCsv, aSvg, nombreDeArchivo } from '../../domain/exportar-consulta';
import { descargarBlob, descargarTexto, svgAPng } from '../../domain/descargas-del-mapa';
import * as L from 'leaflet';
import { escalonesDeCalor, PuntoDeCalor } from '../../domain/capa-de-calor';
import { DibujoTematico } from '../../domain/dibujo-tematico';
import 'leaflet.markercluster';

/**
 * Leaflet con los complementos ya enchufados.
 *
 * POR QUE NO VALE `L` A SECAS, Y POR QUE SOLO SE VE EN PRODUCCION.
 *
 * `leaflet.markercluster` es CommonJS y trabaja por efecto: hace
 * `L.markerClusterGroup = ...` sobre el objeto que le devuelve su `require('leaflet')`,
 * o sea sobre `module.exports`. Este fichero, en cambio, hace `import * as L`, y esbuild
 * resuelve eso con `__toESM(require_leaflet())`, que COPIA las propiedades en el momento
 * de importar. La copia se hace antes de que el complemento anada la suya, asi que
 * `L.markerClusterGroup` no existe en ella.
 *
 * En `ng serve` no pasa: ahi el espacio de nombres se sirve con getters vivos y ve la
 * propiedad nueva. El defecto solo aparece en el paquete compilado.
 *
 * MEDIDO EL 29 DE AGOSTO DE 2026 contra el sitio compilado y servido por el API:
 * «TypeError: pi.markerClusterGroup is not a function» dos veces en consola, cero
 * senaladores dibujados en el Modo de Practicas e Influencia. Contra `ng serve`, el mismo
 * commit daba siete pastillas y 155 procesos. Lo vigila `npm run mapa:modo` APUNTADO AL
 * SITIO COMPILADO; contra el servidor de desarrollo este fallo es invisible.
 *
 * `default ?? L` cubre los dos mundos: en el paquete compilado `default` es el
 * `module.exports` que el complemento parcheo, y donde el espacio de nombres ya es el
 * objeto bueno, `default` no existe y se usa `L`.
 *
 * Los TIPOS se siguen tomando de `L`, que es donde viven. Esto es solo el valor.
 */
const LeafletConComplementos: typeof L =
  (L as unknown as { default?: typeof L }).default ?? L;

// Configuración y objetos de mapeo del dominio.
import { MAP_LAYERS_CONFIG, MAP_PANEL_IDS } from '../../config/mapLayersConfig';
import { ECOSYSTEM_LAYERS, WORLD_COUNTRY_LABELS } from '../../domain/mapLayers';
import { NombrePropioPipe } from '../../../../shared/texto/nombre-propio.pipe';
import { DestinoDeCamara, MOMENTOS_DE_COMPROBACION_MS, camaraFueraDeDestino } from '../../domain/reafirmar-destino';
import { nombrePropio } from '../../../../shared/texto/nombre-propio';
import { formatearFecha } from '../../../../shared/utils/formatos-de-fecha';

import { BotonNativoDirective } from '../../../../shared/components/ui/boton/boton.component';
/**
 * Lo que el Modo de Practicas e Influencia necesita de un registro para situarlo.
 *
 * Se declara aqui y no se usa `any` a proposito: el trinquete de tipado esta en rojo
 * —636 ocurrencias contra un techo de 518, medido— y este
 * cambio no le suma ni una.
 */
/**
 * Una ficha de la que se puede leer su clasificación declarada.
 *
 * ADMITE LAS DOS FORMAS A PROPOSITO: el directorio envuelve el registro en `record` y los conteos
 * por departamento que alimentan el mapa lo entregan plano. Declararlo una vez evita que cada
 * consumidor invente su propia comprobación —y que uno de ellos mire sólo una de las dos, que es
 * como el mapa acabó pintando de gris lo que su leyenda decía de catorce colores.
 */
// AQUI ESTABA `OpcionesDeSenalador`, y se fue con el dibujo: ahora vive en `dibujo-tematico.ts`,
// que es quien construye los marcadores y quien lee su color en la burbuja del agrupador. El
// componente ya no toca un solo marcador de Leaflet, así que tampoco necesita su forma.

interface FichaConDetalle {
  readonly type?: string;
  readonly meta?: string;
  readonly record?: {
    readonly description?: string;
    readonly coverageLevel?: string;
    readonly periodicity?: string;
    readonly periodicityDetail?: string;
    readonly linkedSonorousTerritories?: string;
    readonly practices?: string;
    readonly genre?: string;
    readonly websiteUrl?: string;
    readonly instagramUrl?: string;
    readonly facebookUrl?: string;
    readonly otherUrl?: string;
    readonly startDate?: string;
    readonly endDate?: string;
  };
}

interface FichaClasificable {
  readonly linkedSonorousTerritories?: string;
  readonly practices?: string;
  readonly record?: { readonly linkedSonorousTerritories?: string; readonly practices?: string };
}

interface RegistroDelModo extends MapDomain.RegistroSituable {
  readonly id?: string;
  readonly name?: string;
  readonly department?: string;
  readonly municipality?: string;
}

/**
 * Lo que el atajo del directorio necesita de una ficha para llevarla al mapa.
 *
 * NO ES `fichasDelDirectorio[number]`, QUE ES `any`. Ese computed construye objetos
 * sueltos y el fichero no puede permitirse otro `any`: el trinquete de tipado sigue en
 * rojo. Aqui se declara solo lo que el atajo lee, que es de donde sale su municipio.
 *
 * Los tres sitios de donde puede venir el codigo —`municipalityCode`, `divipola` y
 * `fields.*`— son los mismos que consulta `fichasPorCodigoMunicipal`: las cinco capas
 * pasan por normalizadores distintos y no todas dejan el codigo en el mismo campo.
 */
interface FichaDelDirectorio {
  readonly id?: string;
  readonly type?: string;
  readonly department?: string;
  readonly record?: {
    readonly municipalityCode?: string;
    readonly divipola?: string;
    readonly municipality?: string;
    readonly municipio?: string;
    readonly department?: string;
    readonly fields?: { readonly municipalityCode?: string; readonly divipola?: string };
  };
}

// Forma cruda con la que `fetchModuleRecords` entrega Redes, Lutieres y Espacios
// (backend-data.service.ts-293) y forma normalizada que consume la pagina.
interface RawNetworkRecord {
  id?: string;
  fields?: Record<string, unknown>;
}

type NetworkRecord = Record<string, unknown> & {
  id: string;
  name: string;
  department: string;
};

const ESTILOS_CARTOGRAFIA = [
  ['/mapa/leaflet/leaflet.css', 'simus-estilo-leaflet'],
  ['/mapa/maplibre/maplibre-gl.css', 'simus-estilo-maplibre'],
  ['/mapa/markercluster/MarkerCluster.css', 'simus-estilo-agrupaciones'],
  ['/mapa/markercluster/MarkerCluster.Default.css', 'simus-estilo-agrupaciones-tema'],
] as const;

/**
 * Un evento de la Agenda, ya situado en el mapa.
 *
 * SE DECLARA EN VEZ DE USAR `any` aunque el resto de este fichero esté lleno de él: el código nuevo
 * no suma a una deuda que el trinquete lleva meses bajando. Las capas heredadas se tipan cuando se
 * partan, que es lo que este bloque deja empezado.
 */
interface EventoEnElMapa {
  id: string;
  department: string;
  departmentCode: string;
  municipalityCode: string;
  name: string;
  municipality: string;
  description: string;
  organizer: string;
  websiteUrl: string;
  coverageLevel: string;
  fecha: string;
  modalidad: string;
  lugar: string;
  categoria: string;
  /** La dirección del evento en la Agenda. Vacía si el registro no la trae. */
  slug: string;
  /** El proceso al que está ligado el evento (decisión 130), o nulo. */
  proceso: ProcesoDelEvento | null;
}

/** Lo que una lectura pública deja en el mapa: un identificador y un saco de campos. */
interface RegistroCrudo {
  id?: string;
  fields?: Record<string, string | number>;
}

/** Un campo del registro, siempre como texto. El saco admite números y la ficha los enseña. */
function campo(record: RegistroCrudo, clave: string): string {
  const valor = record?.fields?.[clave];
  return typeof valor === 'string' ? valor : typeof valor === 'number' ? String(valor) : '';
}

/**
 * Los tres modos de dibujo del mapa. Declarado como tipo y no como cadena suelta: ver la nota de
 * `modoDeDibujo`.
 */
type ModoDeDibujo = 'cobertura' | 'practicas_territorios' | 'calor';

/**
 * LOS PASOS DEL RECORRIDO QUE HABLAN DE LA VISTA GRÁFICO, con los nombres de hoy.
 *
 * Los textos de fábrica de `map_recorrido_10` a `_15` seguían diciendo «tabla», «siete lecturas» y «Análisis avanzado»
 * cuando el gráfico ya es un tablero de seis pestañas (Panel general, Flujos, Redes, Coincidencias, Barras y Jerarquías).
 * Se corrigen aquí, con el nombre tomado de `PESTANAS_DEL_TABLERO` para que no se separen, y no en el registro de
 * textos del panel: así el recorrido nunca nombra una vista que no existe. Clave = número de paso (de 1 en adelante).
 */
const TEXTOS_DEL_RECORRIDO_DE_LA_VISTA_GRAFICO: Readonly<Record<number, { title: string; description: string }>> = {
  10: {
    title: 'Mapa o gráfico',
    description: 'Los mismos datos en dos vistas, mapa y gráfico, con el mismo conjunto de filtros. El conmutador no se mueve: está siempre arriba a la izquierda, con el nombre de cada vista a la vista. Cambiar de vista no pierde ni la capa, ni el lente, ni los filtros.',
  },
  11: {
    title: 'Gráfico: seis pestañas',
    description: `La vista Gráfico se lee en seis pestañas: ${PESTANAS_DEL_TABLERO.map((p) => p.nombre).join(', ')}. Cada una responde una pregunta distinta con la misma selección y los mismos filtros; empieza por el Panel general y pulsa una pregunta para ir a la pestaña que la contesta.`,
  },
  12: {
    title: 'Registros por departamento',
    description: 'En el Panel general, el orden y el valor: la longitud de cada barra es la cantidad, a escala del mayor. Pulsa un departamento y todo el tablero, y el mapa, se acotan a él. La pestaña Barras lo lleva más lejos, por departamento, práctica o territorio.',
  },
  13: {
    title: 'Composición: de qué está hecho',
    description: 'Lo más declarado en los registros, medido por territorios sonoros o por prácticas y géneros: dos clasificaciones distintas del mismo conjunto. El área del mosaico es cuántas veces se declara; la pestaña Jerarquías lo despliega del tipo de proceso al departamento y a la práctica.',
  },
  15: {
    title: 'Con teclado y lector de pantalla',
    description: 'Todo se alcanza con Tab y se activa con Entrar o Espacio. Cada gráfico tiene su «Ver tabla» con los mismos datos, que es la lectura sin puntero ni color, y los botones de acercar y alejar mueven el mapa. Escape cierra el recorrido. Cada paso se anuncia al cambiar.',
  },
};

/** Dónde se recuerda que el aviso del recorrido guiado ya se ofreció (se descartó o se inició). */
const CLAVE_DEL_AVISO_DEL_RECORRIDO = 'simus_aviso_recorrido_del_mapa';

@Component({
  selector: 'app-mapa-ecosistemico-page',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective, SelectorDeVistaDelMapaComponent, GraficoDelTableroComponent, PanelDeGraficoComponent, ChipDeFiltroComponent, MenuDeAccionesComponent, NombrePropioPipe, BuscadorDeListaComponent, FiltroDesplegableComponent,
    CommonModule,
    NgComponentOutlet,
    FormsModule,
    // `RouterLink` para el enlace de «Sobre este mapa»: sin él, `routerLink` se queda en un
    // atributo inerte —el compilador no se queja— y el enlace no lleva a ninguna parte.
    RouterLink,
    DialogoDirective,
    SelectorSegmentadoComponent,
    LucideBarChart3,
    LucideCircleHelp,
    LucideAperture,
    LucideShapes,
    LucideBookOpen,
    LucideLayoutGrid,
    LucideList,
    LucideCalendarDays,
    LucideKeyboard,
    LucidePlay,
    LucideMousePointer2,
      LucideLayers3,
    EsqueletoComponent,
    OrigenDelEventoComponent,
    LucideMail,
    LucideMapPin,
    LucidePrinter,
    LucideSearch,
    LucideX,
    LucideGlobe,
    LucideZoomIn,
    LucideZoomOut,
    LucideHand,
    LucideTrendingUp,
    LucidePieChart,
    LucideTarget,
    LucideMap,
    LucideTriangleAlert,
    LucideRadio,
    LucideMusic,
    LucideChevronRight,
    LucideChevronLeft,
    LucideInfo
  ],
  templateUrl: './mapa-ecosistemico-page.component.html',
})
export class MapaEcosistemicoPageComponent implements OnInit, OnDestroy, AfterViewInit {
  private mapDataService = inject(MapDataService);
  private navigationService = inject(NavigationService);
  private webTexts = inject(TextosWebService);
  private platformId = inject(PLATFORM_ID);
  private readonly recorridoGuiado = inject(RecorridoGuiadoService);
  private catalog = inject(CatalogService);
  private readonly ruta = inject(ActivatedRoute);
  /**
   * Se guarda el inyector porque los dos efectos de camara se crean dentro de
   * `montarElMapaUnaVez`, que corre DESPUES del constructor. Fuera del constructor no hay
   * contexto de inyeccion y `effect()` lanza `NG0203`; con el inyector explicito, si lo hay.
   */
  private injector = inject(Injector);
  protected readonly Boolean = Boolean;

  mapContainer?: ElementRef;

  @ViewChild('mapContainer', { static: false })
  set mapContainerRef(value: ElementRef | undefined) {
    this.mapContainer = value;
    this.contenedorDelMapaListo.set(Boolean(value));
  }

  // Map reference
  private map?: L.Map;
  private capaDeDepartamentos?: L.GeoJSON;
  private capaDeContacto?: L.GeoJSON;
  private capaDeMunicipios?: L.GeoJSON;
  /** Rotulos de municipio. Agrupados aparte para poder retirarlos con su capa. */
  private capaDeRotulosMunicipales?: L.LayerGroup;
  private capaDelArchipielago?: L.GeoJSON;
  // Los senaladores municipales del Modo de Practicas e Influencia. Eran
  // `L.CircleMarker` mas una lista aparte de `L.Circle` para el falso mapa de calor;
  // ahora es un grupo de agrupacion con un marcador por municipio.
  private marcadoresTematicos: L.Marker[] = [];
  /**
   * Quien dibuja los símbolos y el calor sobre el lienzo.
   *
   * GUARDA SUS PROPIAS CAPAS porque alguien tiene que poder quitarlas, pero no guarda nada de
   * negocio: no sabe qué lente hay puesto ni qué modo está activo. Recibe datos ya resueltos.
   */
  private readonly dibujo = new DibujoTematico();

  // Reactive UI State Signals
  capaActiva = signal<string>('General');
  panelActivo = signal<string | null>(null);
  pestanaLateral = signal<string>('resumen');
  directoryCategory = signal<string>('Todos');
  busquedaDelDirectorio = signal<string>('');
  limiteDelDirectorio = signal<number>(12);
  departamentoElegido = signal<string>('Nacional');
  tarjetaDelDepartamentoSenalado = signal<any | null>(null);
  fichaEnDetalle = signal<any | null>(null);
  selectedSonorousTerritory = signal<string>('Todos');
  selectedPractice = signal<string>('Todas');
  /**
   * Con qué se dibuja el mapa: los tres modos, y solo esos tres.
   *
   * <b>ERA `signal<string>` Y ESO COSTO UN MAPA EN BLANCO.</b> Al reescribir el recorrido guiado se
   * le pidió el modo «simbolos», que no existe —el identificador real es `practicas_territorios`—.
   * El compilador no dijo nada porque cualquier cadena valía, el modo quedó puesto en un valor que
   * ninguna rama de dibujo reconoce, y el paso que explica cómo se dibuja enseñaba un lienzo vacío.
   * Con la unión declarada, ese error es de compilación.
   */
  modoDeDibujo = signal<ModoDeDibujo>('cobertura');
  activeThematicOption = signal<string>('territorio');
  tipoDeInfluencia = signal<string>('puntos');
  tutorialAbierto = signal<boolean>(false);
  pasoDelTutorial = signal<number>(0);
  senalDeReencuadre = signal<number>(0);
  contenedorDelMapaListo = signal<boolean>(false);

  // --- Maqueta de tablero (PNMC-061) ------------------------------------------
  //
  // Que se proyecta en la columna central. El lienzo de Leaflet NO se desmonta
  // al cambiar de vista: grafico y tabla se dibujan encima. Desmontarlo obliga
  // a reconstruir el mapa y a un `invalidateSize()` al volver, y ese es
  // justamente el camino por el que el mapa acababa con altura cero.
  vistaCentral = signal<'mapa' | 'grafico'>('mapa');

  /**
   * Las dos vistas del mapa: mapa y gráficos. La vista «Tabla» se retiró (comentario 11 del 22 de noviembre de 2026):
   * los mismos registros ya están en los listados de cada directorio del ecosistema, con sus filtros y su exportación.
   */
  readonly VISTAS_DEL_MAPA: readonly OpcionSegmentada[] = [
    { id: 'mapa', etiqueta: 'Mapa' },
    { id: 'grafico', etiqueta: 'Gráfico' },
  ];

  /** Municipio abierto y las fichas que tiene registradas. */
  municipioSeleccionado = signal<{
    nombre: string;
    codigo: string;
    fichas: ReturnType<MapaEcosistemicoPageComponent['fichasDeMunicipio']>;
    /** Punto del mapa al que va pegada la tarjeta. Sin el no se puede reposicionar. */
    ancla?: { lat: number; lng: number };
    /** Donde se pinta la tarjeta ahora mismo, en pixeles de viewport. */
    popup: MapDomain.TerritoryPopupPlacement;
    /**
     * Id del registro desde el que se llego, cuando se llego desde el directorio.
     *
     * Sin esto el atajo es ambiguo: se pulsa «Festival PNMC 12» y se abre una tarjeta
     * con los cinco procesos de su municipio, sin nada que diga cual de los cinco era
     * el que se pidio. La tarjeta lo marca.
     */
    resaltado?: string;
  } | null>(null);

  // `panelActivo` sigue siendo la unica fuente de verdad de que control esta
  // abierto: las pestanas del panel de control escriben en esa misma senal, con
  // lo que la coreografia del tutorial (`applyTutorialStep`) sigue valiendo sin
  // tocarla. Esto solo traduce ese valor a una pestana siempre visible, porque
  // una tira de pestanas no puede quedarse sin ninguna seleccionada.
  //
  // LA PESTANA POR DEFECTO ES «TERRITORIO» DESDE EL 29 DE AGOSTO DE 2026, y antes
  // era «Capas». La lista de capas del panel repetia exactamente la eleccion que ya
  // ofrece la barra superior, donde ademas cada capa lleva su cifra; se quito por
  // duplicada. `MAP_PANEL_IDS.layers` sigue existiendo porque el tutorial escribe
  // en `panelActivo`, pero ya no tiene pestana: cae aqui, en Territorio.
  // ---------------------------------------------------------------------------
  // EL PANEL DE LECTURA VA POR PESTANAS (29 de agosto de 2026)
  //
  // La columna derecha apilaba dos cosas de naturaleza distinta: el directorio
  // —buscador y listado, que se consulta— y la llamada «Ser parte del ecosistema»
  // —icono, dos parrafos y un boton, que se lee una vez y ya—. La segunda quedaba
  // DEBAJO del listado, o sea despues de un numero de tarjetas que crece con los
  // datos: medido a 1280x639, su borde superior caia en y=1498, a mil pixeles del
  // pliegue. Nadie que no se propusiera buscarla la encontraba.
  //
  // El criterio es este: «este pasalo arriba como una pestana independiente, en
  // una pestana que solo quede el directorio aqui».
  // ---------------------------------------------------------------------------

  /** Que pestana del panel de lectura esta abierta. */
  readonly pestanaDeLectura = signal<'directorio' | 'agenda'>('directorio');

  activeControlTab = computed(() => {
    const panel = this.panelActivo();
    return panel === MAP_PANEL_IDS.insights ? panel : MAP_PANEL_IDS.filters;
  });

  /**
   * Cuantos filtros hay puestos ahora mismo. Es lo que decide si «Limpiar» tiene
   * algo que limpiar.
   *
   * Se cuentan y no se devuelve un booleano porque el boton dice el numero: un
   * «Limpiar» siempre igual no distingue entre una vista virgen y una con cuatro
   * filtros encadenados, que es justo cuando hace falta.
   */
  /**
   * Quita todo lo que `filtrosActivos` sabe contar.
   *
   * ES UN METODO Y NO UNA CADENA DE `set` EN LA PLANTILLA porque si no, la unica
   * copia de «que significa limpiar» vive en un atributo `(click)` de 180 caracteres
   * y ninguna prueba puede alcanzarla. Anadir un filtro nuevo obliga a tocar dos
   * sitios: la lista de `filtrosActivos` y este metodo. Que sean dos y no tres.
   */
  limpiarFiltros(): void {
    this.volverAVistaNacional();
    this.municipioElegido.set('Todos');
    this.lenteDeLectura.set('territorial');
    this.grupoResaltado.set('');
    this.seleccionarCapa('General');
    this.busquedaDelDirectorio.set('');
    this.rangoDeAgenda.set('proximos');
  }

  /**
   * Qué decir cuando el listado sale vacío.
   *
   * <b>DECIA SIEMPRE LO MISMO: «Intenta cambiando la categoría o ajustando los términos de
   * búsqueda».</b> Con una sola capa consultable no hay categoría que cambiar, y sin nada escrito
   * no hay términos que ajustar: el consejo mandaba a tocar dos controles que no existían o no
   * estaban puestos, y dejaba sin nombrar el filtro que de verdad estaba vaciando el listado.
   *
   * <b>SE NOMBRA LA CAUSA MAS PROBABLE, EN ORDEN DE CERCANIA.</b> Lo último que alguien tocó es lo
   * primero que hay que deshacer: la búsqueda antes que el municipio, y el municipio antes que el
   * departamento. Si no hay ningún filtro puesto, entonces no hay nada que deshacer y lo honesto es
   * decir que no hay registros, no sugerir maniobras.
   */
  /**
   * Lo que el geovisor guarda en la dirección, para que un mapa se pueda compartir.
   *
   * <b>ERA LA UNICA LECTURA PUBLICA QUE NO LO HACIA.</b> El Bloque 10 llevó los filtros a la URL en
   * Festivales, Noticias, Agenda y Catálogo Editorial con esta misma pieza, y el mapa —que es donde
   * más caro sale perder el estado, porque llegar a «Arauca, por territorios sonoros, mapa de
   * calor» son cuatro decisiones— se quedó fuera. Consecuencias, las tres de siempre: no se puede
   * pasar un enlace a lo que uno está mirando, recargar lo devuelve todo al país entero, y «Atrás»
   * no deshace un filtro porque el filtro nunca fue un estado de la navegación.
   *
   * <b>VAN LOS SIETE QUE CAMBIAN LO QUE SE VE, Y NO MAS.</b> Un parámetro por cada decisión que
   * alguien tomaría a mano. Lo que se deriva de ellas —el color de una capa, el zoom que el mapa
   * calcula al abrir un departamento— no se escribe: se vuelve a calcular igual y sólo alargaría el
   * enlace.
   *
   * <b>EL VALOR DE PARTIDA NO SE ESCRIBE</b>, que es lo que evita que mirar el mapa sin tocar nada
   * deje una dirección con siete parámetros redundantes.
   */
  private filtrosDelMapa(): readonly FiltroDeclarado[] {
    // ES UN METODO Y NO UN CAMPO por el orden de inicialización: el constructor lo necesita antes
    // que cualquier efecto, y varias de estas señales se declaran más abajo en la clase. Un campo
    // las leería sin inicializar.
    return [
    // LA CAPA TAMBIÉN VIAJA EN LA DIRECCIÓN (decisión 116): cambiar de vista, copiar el enlace o volver
    // atrás conserva lo que se mira. Se valida contra `CATEGORIA_POR_CAPA` y arrastra al directorio,
    // igual que `seleccionarCapa`.
    {
      parametro: 'capa', senal: this.capaActiva, vacio: 'General',
      desdeTexto: (texto: string) => {
        const conocida = Object.keys(this.CATEGORIA_POR_CAPA).find((clave) => clave.toLowerCase() === texto.toLowerCase());
        if (!conocida) return 'General';
        this.directoryCategory.set(this.CATEGORIA_POR_CAPA[conocida] || 'Todos');
        return conocida;
      },
    } as FiltroDeclarado,
    filtroDeVista('departamento', this.departamentoElegido, 'Nacional'),
    filtroDeVista('municipio', this.municipioElegido, 'Todos'),
    filtroDeTexto('q', this.busquedaDelDirectorio),
    filtroDeVista('lente', this.lenteDeLectura, 'territorial'),
    filtroDeTexto('grupo', this.grupoResaltado),
    filtroDeVista('modo', this.modoDeDibujo, 'cobertura'),
    {
      parametro: 'vista',
      senal: this.vistaCentral as unknown as WritableSignal<string>,
      vacio: 'mapa',
      // Un enlace antiguo con `?vista=tabla` cae en el mapa en vez de dejar una vista que ya no existe.
      desdeTexto: (texto: string) => (texto === 'grafico' ? 'grafico' : 'mapa'),
    },
    {
      parametro: 'tablero',
      senal: this.vistaDelTablero as unknown as WritableSignal<string>,
      vacio: 'panel',
      // Los valores de antes (`panorama`, `lecturas`, `avanzado`) siguen abriendo una pestaña que existe.
      desdeTexto: pestanaDesdeTexto,
    },
    ];
  }

  readonly consejoSinResultados = computed(() => {
    if (this.busquedaDelDirectorio().trim() !== '') {
      return `No hay resultados para «${this.busquedaDelDirectorio().trim()}». Prueba con otras palabras o borra la búsqueda.`;
    }
    if (this.municipioElegido() !== 'Todos') {
      return `${this.municipioElegido()} no tiene registros publicados. Vuelve a «Todos» para ver el departamento entero.`;
    }
    if (this.departamentoElegido() !== 'Nacional') {
      return `${this.nombreDelDepartamentoElegido()} no tiene registros publicados. Quita el filtro de departamento para ver el país.`;
    }
    return 'Todavía no hay registros publicados en esta lectura.';
  });

  /**
   * Qué filtros hay puestos, cada uno con su valor y su forma de quitarse.
   *
   * <b>ANTES ERA UNA LISTA DE NOMBRES Y UN BOTON DE TODO O NADA.</b> «Limpiar filtros (3)» dice
   * cuántos hay y no CUALES, y sólo sabe quitarlos los tres a la vez: quien había acotado a Nariño,
   * municipio de Pasto, buscando «gaita» y quería soltar sólo la búsqueda tenía que quitarlo todo y
   * rehacer dos pasos. La dirección de producto pidió que el botón fuera «más útil», y lo útil es poder
   * deshacer UNO.
   *
   * Cada filtro dice su valor —«Nariño», no «Departamento»— porque en una columna estrecha el valor
   * es lo que permite reconocer lo que se puso sin volver a abrir el desplegable.
   */
  readonly filtrosPuestos = computed(() => {
    const puestos: { clave: 'departamento' | 'municipio' | 'capa' | 'busqueda'; etiqueta: string; valor: string }[] = [];
    if (this.departamentoElegido() !== 'Nacional') {
      puestos.push({ clave: 'departamento', etiqueta: 'Departamento', valor: this.nombreDelDepartamentoElegido() });
    }
    if (this.municipioElegido() !== 'Todos') {
      puestos.push({ clave: 'municipio', etiqueta: 'Municipio', valor: this.municipioElegido() });
    }
    if (this.capaActiva() !== 'General') {
      puestos.push({ clave: 'capa', etiqueta: 'Capa', valor: this.capaActiva() });
    }
    if (this.busquedaDelDirectorio().trim() !== '') {
      puestos.push({ clave: 'busqueda', etiqueta: 'Búsqueda', valor: `«${this.busquedaDelDirectorio().trim()}»` });
    }
    return puestos;
  });

  /** Los nombres de los filtros puestos. Se conserva porque lo leen las pruebas y el rótulo. */
  filtrosActivos = computed(() => this.filtrosPuestos().map((filtro) => filtro.etiqueta));

  /**
   * Quita UN filtro.
   *
   * QUITAR EL DEPARTAMENTO ARRASTRA AL MUNICIPIO, y no por comodidad: un municipio sin departamento
   * no es un estado que la pantalla sepa dibujar —el desplegable de municipios se construye a partir
   * del departamento abierto— y dejarlo puesto daría un filtro invisible que nadie puede ver ni
   * quitar.
   */
  quitarFiltro(clave: 'departamento' | 'municipio' | 'capa' | 'busqueda'): void {
    if (clave === 'departamento') {
      this.volverAVistaNacional();
      this.municipioElegido.set('Todos');
    }
    if (clave === 'municipio') this.municipioElegido.set('Todos');
    if (clave === 'capa') this.seleccionarCapa('General');
    if (clave === 'busqueda') this.busquedaDelDirectorio.set('');
  }

  /** Si la leyenda «Cómo leer…» está desplegada. */
  readonly leyendaVisible = signal(true);

  /**
   * Cómo se lee LO QUE SE ESTA MIRANDO, que no siempre es el mapa.
   *
   * <b>EL BLOQUE DECIA «COMO LEER EL MAPA» EN LAS TRES VISTAS.</b> Al pasar a Gráfico o a Tabla, la
   * columna izquierda seguía explicando la rampa de colores del coroplético y los escalones de
   * densidad —información de una vista que ya no estaba en pantalla— mientras la que sí estaba no
   * se explicaba en ninguna parte. Es el mismo defecto que se corrigió tres veces dentro del mapa:
   * texto que sobrevive al estado que describía.
   *
   * <b>Y NO ES UN ROTULO GENERICO REPETIDO:</b> cada vista se lee de una manera distinta y por un
   * motivo distinto, así que cada una dice el suyo. El del mapa lo compone `leyendaDelModo`, que ya
   * sabe de modos y de lentes; estos dos son fijos porque las otras dos vistas no tienen modos.
   */
  readonly comoSeLeeLaVista = computed(() => {
    const vista = this.vistaCentral();
    if (vista === 'grafico') {
      return {
        titulo: 'Cómo leer esta vista',
        parrafos: [
          'Siete lecturas del mismo conjunto, y ninguna repite lo que otra ya dice. Cada pestaña '
            + 'de arriba es a la vez la cifra y el control: pulsa una para cambiar de lectura.',
          'Con «Exportar» bajas lo que ves en PNG o SVG, o sus datos en CSV, con los filtros, la fecha '
            + 'y la fuente en el propio archivo.',
        ],
      };
    }
    return null;
  });

  /**
   * Qué proceso del municipio abierto se está leyendo dentro del propio panel.
   *
   * <b>NO ERA UNA FICHA DENTRO DE OTRA: ERAN DOS MODALES APILADOS.</b> Al pulsar un municipio se
   * abría una tarjeta de 232 px con la lista de sus procesos, y «Ver detalle» abría ENCIMA el modal
   * grande del registro. El de abajo quedaba tapado, cerrar el de arriba no era evidente, y para
   * comparar dos procesos del mismo municipio había que abrir, leer, cerrar y volver a buscar en la
   * lista de debajo. Quedó definido así: «es necesario que no haya una ficha dentro
   * de una ficha; optimizar con una visualización tipo lista».
   *
   * Con esto, el panel tiene DOS NIVELES EN EL MISMO SITIO —la lista y el detalle— y se va y se
   * vuelve entre ellos. Nada se apila y nada se tapa.
   */
  readonly procesoAbiertoEnElMunicipio = signal<string | null>(null);

  /** La ficha que el panel del municipio está leyendo, o `null` si está en la lista. */
  readonly fichaAbiertaEnElMunicipio = computed(() => {
    const clave = this.procesoAbiertoEnElMunicipio();
    if (!clave) return null;
    const municipio = this.municipioSeleccionado();
    return municipio?.fichas.find((ficha) => this.claveDeFicha(ficha) === clave) ?? null;
  });

  /**
   * El contenido de la ficha abierta dentro del panel del municipio.
   *
   * REUTILIZA EL MISMO CONSTRUCTOR QUE EL MODAL, y no una versión «parecida»: el día que la ficha
   * gane un campo, tendría que ganarlo en dos sitios y uno de los dos se quedaría atrás. Lo único
   * que cambia entre los dos caminos es el marco, no el contenido.
   */
  readonly contenidoEnElMunicipio = computed(() =>
    this.construirContenidoDeFicha(this.fichaAbiertaEnElMunicipio()));

  /** Vuelve de la ficha a la lista del municipio. */
  volverALaListaDelMunicipio(): void {
    this.procesoAbiertoEnElMunicipio.set(null);
  }

  // ---------------------------------------------------------------------------
  // CAPA DEL MAPA Y CATEGORIA DEL DIRECTORIO SON LA MISMA ELECCION (PNMC-061)
  //
  // Eran dos senales independientes: se podia estar mirando la capa de
  // Festivales en el mapa mientras el directorio listaba Lutieres, y las cifras
  // de la barra superior contradecian al listado de al lado. Ahora cualquiera de
  // los tres sitios donde se elige —barra superior, lista de Capas y pastillas
  // del directorio— pasa por estos dos metodos, que mueven las dos senales.
  //
  // Siguen siendo dos senales y no una porque sus vocabularios no coinciden:
  // el mapa dice 'Escuelas de Música' y el directorio dice 'Escuelas'.
  // ---------------------------------------------------------------------------

  private readonly CATEGORIA_POR_CAPA: Record<string, string> = {
    'General': 'Todos',
    'Festivales': 'Festivales',
    'Mercados Musicales': 'Mercados',
    // REDES Y LUTERÍA VOLVERÁN COMO PROCESOS PROPIOS y su lógica de capa se conserva; Escuelas de
    // Música se retiró de aquí porque ese proceso queda fuera por ahora.
    'Redes de Documentación': 'Redes',
    'Lutieres': 'Lutieres',
    'Espacios': 'Espacios',
  };

  // ---------------------------------------------------------------------------
  // MUNICIPIO: DEL CLIC EN EL MAPA A LA FICHA DEL ECOSISTEMA (PNMC-061)
  // ---------------------------------------------------------------------------

  /**
   * Donde se pinta la tarjeta de procesos: al lado del punto pulsado, nunca encima.
   *
   * POR QUE EXISTE. Hasta pulsar un municipio abria un modal
   * de 560 px centrado sobre un velo con desenfoque: para leer la lista de procesos de
   * Amalfi habia que perder de vista Amalfi, y el mapa entero con el. La tarjeta ahora
   * mide 232 px y sale pegada al poligono.
   *
   * Este metodo solo traduce: saca el punto en pixeles del ancla geografica —o, si no
   * la hay, del clic del raton— y le pide la posicion a `MapDomain.territoryPopupPlacement`,
   * que es geometria pura y se comprueba sin navegador.
   *
   * EL ANCLA MANDA SOBRE EL CLIC, y no al reves. El clic da un punto que envejece: en
   * cuanto el mapa se mueve o se acerca, ese pixel ya no corresponde al municipio. El
   * ancla es una coordenada geografica y se puede reproyectar, que es lo que permite que
   * `repositionTerritoryPopup` mantenga la tarjeta pegada a su territorio.
   */
  private territoryPopupPosition(
    evento?: { originalEvent?: { clientX?: number; clientY?: number } },
    ancla?: { lat: number; lng: number },
  ): MapDomain.TerritoryPopupPlacement {
    const enNavegador = isPlatformBrowser(this.platformId);
    const anchoViewport = enNavegador ? window.innerWidth : 1280;
    const altoViewport = enNavegador ? window.innerHeight : 720;

    const marco = this.map?.getContainer?.()?.getBoundingClientRect?.();
    const puntoDelAncla = ancla && this.map
      ? this.map.latLngToContainerPoint([ancla.lat, ancla.lng])
      : null;
    const clic = evento?.originalEvent;

    const puntoX = puntoDelAncla && marco
      ? marco.left + puntoDelAncla.x
      : clic?.clientX ?? (marco ? marco.left + marco.width / 2 : anchoViewport / 2);
    const puntoY = puntoDelAncla && marco
      ? marco.top + puntoDelAncla.y
      : clic?.clientY ?? (marco ? marco.top + marco.height / 2 : altoViewport / 2);

    return MapDomain.territoryPopupPlacement(puntoX, puntoY, anchoViewport, altoViewport);
  }

  /** Abre la lista de procesos registrados en un municipio, junto al punto pulsado. */
  abrirMunicipio(
    nombre: string,
    codigo: string,
    evento?: { originalEvent?: { clientX?: number; clientY?: number } },
    ancla?: { lat: number; lng: number },
    resaltado?: string,
  ): void {
    // SE ABRE SIEMPRE POR LA LISTA. Abrir otro municipio mientras se leía una ficha dejaría el panel
    // enseñando el detalle de un proceso que ya no está en la lista de debajo.
    this.volverALaListaDelMunicipio();
    this.municipioSeleccionado.set({
      nombre: nombre || 'Municipio',
      codigo: codigo || '',
      fichas: this.fichasDeMunicipio(codigo, nombre),
      ancla,
      popup: this.territoryPopupPosition(evento, ancla),
      resaltado,
    });
  }

  // ---------------------------------------------------------------------------
  // EL DIRECTORIO ES UN ATAJO DEL MAPA (29 de agosto de 2026)
  //
  // Pulsar un registro abria un modal a pantalla completa encima del mapa. Medido en
  // el navegador a 1280x639 antes del cambio: al pulsar la primera tarjeta del panel
  // salia un dialogo de 1280x639 —«Detalle de Redes de Documentacion»— y el mapa
  // desaparecia detras del velo.
  //
  // El criterio es este: «que se vaya al mapa y se ubique en el municipio, y se abra
  // la pestana que se usa dentro del mapa para ubicar, la idea es que sea un directorio
  // de navegacion que funciona como atajo en el mapa».
  //
  // LA FICHA NO SE PIERDE: la tarjeta del municipio lleva «Ver detalle» —que abre ese
  // mismo modal— y «Ficha completa» donde esa pagina existe. Se pasa de un clic a dos,
  // y a cambio el registro queda situado en su territorio.
  //
  // EL LISTADO DEL CENTRO NO CAMBIA. Ahi el mapa no esta en pantalla —la vista «Tabla»
  // ocupa su sitio—, asi que un atajo al mapa obligaria a cambiar de vista para leer
  // una tabla que se abrio para comparar filas. Ese listado sigue abriendo la ficha.
  // ---------------------------------------------------------------------------

  /**
   * El municipio que el directorio mando encuadrar, mientras siga encuadrado.
   *
   * NO ES UNA COLA DE «PENDIENTE» QUE SE VACIA. Es el estado del mapa: mientras esta
   * puesto, la camara mira ese municipio y no el departamento entero. Borrarlo desde el
   * propio efecto que lo lee obligaria a un segundo pase que devolveria la camara al
   * departamento, deshaciendo el viaje que se acaba de hacer. Lo borran los gestos que
   * de verdad cambian de sitio: entrar a otro departamento, volver a nacional y cerrar
   * la tarjeta pulsando el mapa por fuera.
   */
  readonly municipioEnfocado = signal<{
    codigo: string;
    nombre: string;
    registroId: string;
  } | null>(null);

  /**
   * Lleva el mapa al municipio de un registro del directorio y abre alli su tarjeta.
   *
   * EL ORDEN DE LAS CUATRO ESCRITURAS IMPORTA. `vistaCentral` primero, porque desde
   * «Grafico» o «Tabla» el centro no muestra cartografia y la tarjeta saldria pegada a
   * un municipio que no esta en pantalla. Los puntos municipales despues, porque el
   * efecto que mueve la camara necesita que el estado ya sea «cargando» para saber que
   * tiene que esperar. El departamento antes que el municipio, para que el directorio
   * ya este acotado cuando se construya la lista de la tarjeta. Y el municipio al
   * final, que es lo que dispara el viaje.
   */
  irAlMunicipioDelRegistro(ficha: FichaDelDirectorio): void {
    const crudo = ficha?.record || {};
    const codigo = MapDomain.normalizeMunicipalityCode(
      crudo.municipalityCode || crudo.divipola || crudo.fields?.municipalityCode || crudo.fields?.divipola || '',
    );
    const nombre = String(crudo.municipality || crudo.municipio || '').trim();
    const departamento = String(ficha?.department || crudo.department || '').trim();

    // Sin municipio no hay adonde ir. Antes de dejar el clic muerto se abre la ficha,
    // que es exactamente lo que este boton hacia hasta hoy. Medido contra el API: los
    // 155 registros publicados traen codigo, asi que esta rama hoy no se pisa; existe
    // para el dia que llegue uno sin el.
    if (!codigo && !nombre) {
      this.fichaEnDetalle.set(ficha);
      return;
    }

    this.vistaCentral.set('mapa');
    this.cargarPuntosMunicipales();

    if (departamento) {
      const seleccion = MapDomain.getDepartmentSelectionValue(departamento);
      if (MapDomain.normalizeDepartmentName(seleccion) !== this.departamentoNormalizado()) {
        this.departamentoElegido.set(seleccion);
        this.pestanaLateral.set('resumen');
      }
    }

    this.municipioEnfocado.set({
      codigo,
      nombre: nombre || 'Municipio',
      registroId: this.claveDeFicha(ficha),
    });
  }

  /**
   * Clave que identifica una ficha del directorio SIN COLISIONAR ENTRE CAPAS.
   *
   * `id` VIENE NUMERADO POR MODULO, no por el ecosistema entero. Comprobado contra el
   * API: `/festivals`, `/music-schools`, `/music-markets`,
   * `/redes-documentacion` y `/lutieres` devuelven los tres primeros como `1`, `2`, `3`
   * cada uno. O sea que «1» nombra a cinco registros distintos.
   *
   * Lo que eso rompia, visto en pantalla en ABEJORRAL —un proceso de cada capa—: al
   * llegar desde el directorio, la tarjeta marcaba «pulsado en el directorio» en los
   * CINCO procesos. Una marca que senala a todos no senala a ninguno.
   *
   * Y rompia tambien el `track` de las dos listas del directorio: con la categoria en
   * «Todos», `track item.id` repite claves entre capas y Angular reutiliza el nodo
   * equivocado al reordenar.
   */
  claveDeFicha(ficha: { type?: string; id?: string } | null | undefined): string {
    return `${ficha?.type || ''}#${ficha?.id || ''}`;
  }

  /**
   * Vuelve a colocar la tarjeta cuando el mapa se mueve o se acerca.
   *
   * Sin esto la tarjeta se queda clavada en un pixel y el municipio se va: al primer
   * arrastre la lista de Amalfi acaba senalando a Sonson. Solo se reescribe la senal si
   * la posicion cambio de verdad, porque `moveend` dispara tambien cuando el mapa no se
   * ha movido —al terminar un zoom, por ejemplo— y cada escritura repinta la lista.
   */
  private repositionTerritoryPopup(): void {
    const actual = this.municipioSeleccionado();
    if (!actual?.ancla) return;

    const popup = this.territoryPopupPosition(undefined, actual.ancla);
    if (popup.left === actual.popup.left && popup.top === actual.popup.top && popup.side === actual.popup.side) {
      return;
    }

    this.municipioSeleccionado.set({ ...actual, popup });
  }

  // ---------------------------------------------------------------------------
  // CONTROLES BASICOS DEL MAPA (29 de agosto de 2026)
  //
  // El mapa se creo con `zoomControl: false` y nunca se le devolvio nada en su
  // lugar: acercarse solo se podia con la rueda, y con la rueda capturada por el
  // mapa la pagina no se podia desplazar cuando el puntero caia encima. Los tres
  // botones cubren eso: dos de zoom y uno que suelta el mapa.
  //
  // NO SE USA EL CONTROL DE LEAFLET. `L.control.zoom()` se pinta dentro del lienzo
  // con su propia hoja de estilos y su propio idioma; estos son botones de la
  // aplicacion, con el mismo aspecto que el resto de la barra y con `aria-label` en
  // castellano.
  // ---------------------------------------------------------------------------

  /** Si el mapa responde al arrastre y a la rueda. El boton de la mano lo alterna. */
  mapaInteractivo = signal(true);

  private ajustarZoom(pasos: number): void {
    if (!this.map) return;
    this.map.setZoom(this.map.getZoom() + pasos);
  }

  acercarMapa(): void {
    this.ajustarZoom(0.5);
  }

  alejarMapa(): void {
    this.ajustarZoom(-0.5);
  }

  /**
   * Suelta o vuelve a coger el mapa.
   *
   * Con el mapa suelto la rueda desplaza la pagina en vez de acercar la cartografia,
   * que es lo que hace falta para leer el resto del tablero sin pelearse con el
   * lienzo. El arrastre se apaga con la rueda para que el estado sea uno solo y no
   * dos que se contradigan.
   */
  alternarInteraccionDelMapa(): void {
    if (!this.map) return;
    const activo = !this.mapaInteractivo();
    this.mapaInteractivo.set(activo);

    if (activo) {
      this.map.dragging.enable();
      this.map.scrollWheelZoom.enable();
    } else {
      this.map.dragging.disable();
      this.map.scrollWheelZoom.disable();
    }
  }

  /**
   * Ruta de la ficha publica de un registro, o null si esa capa no tiene ficha.
   *
   * Solo los Festivales tienen página de detalle enrutada hoy:
   * `ecosistema/festivales/:festivalId`. Mercados no tiene ruta de ficha, y
   * Redes, Lutería y Espacios todavía no existen: una URL con identificador cae
   * en el comodín `**` y acaba en «no encontrado». Por eso se devuelve null y el
   * modal no ofrece el enlace, en vez de ofrecer un botón que lleva a una página
   * de error. (La ruta `ecosistema/escuelas/:schoolId` se retiró: no existe.)
   */
  rutaDeFicha(ficha: { type?: string; record?: { id?: string } } | null): string | null {
    const id = ficha?.record?.id;
    if (!id) return null;

    if (ficha?.type === 'Festival') return `ecosistema/festivales/${encodeURIComponent(id)}`;
    return null;
  }

  /** Lleva a la ficha publica del registro. */
  irAFicha(ficha: { type?: string; record?: { id?: string } }): void {
    const ruta = this.rutaDeFicha(ficha);
    if (!ruta) return;
    this.navigationService.routerNavigate(ruta);
  }

  /** Elegir capa desde el mapa: arrastra al directorio. */
  /**
   * Abre el geovisor con una capa ya encendida, si la direccion la pide.
   *
   * `/mapa?capa=Festivales` LLEGA DESDE LA CONSULTA PUBLICA, donde se define el 30 de
   * agosto de 2026 «un boton o seccion de llamado a ver festivales en el mapa ecosistemico (lo que
   * lleva con un clic al mapa con la capa de festivales activa)». Sin esto el enlace deja el mapa
   * en «General» y hay que volver a elegir la capa a mano, que son los dos clics que pidio evitar.
   *
   * SE VALIDA CONTRA `CATEGORIA_POR_CAPA` y no se confia en la direccion: una capa inventada
   * dejaria el mapa en un estado que ninguna pastilla puede deshacer, porque ninguna coincide.
   */
  private abrirEnLaCapaPedida(): void {
    const pedida = this.ruta.snapshot.queryParamMap.get('capa');
    if (!pedida) return;
    const conocida = Object.keys(this.CATEGORIA_POR_CAPA)
      .find(clave => clave.toLowerCase() === pedida.toLowerCase());
    if (conocida) this.seleccionarCapa(conocida);
  }

  seleccionarCapa(claveDeCapa: string): void {
    this.capaActiva.set(claveDeCapa);
    this.directoryCategory.set(this.CATEGORIA_POR_CAPA[claveDeCapa] || 'Todos');
    // El paginado vuelve al principio: mantenerlo mostraria 24 fichas de una
    // categoria recien elegida y ninguna razon por la que fueran 24.
    this.limiteDelDirectorio.set(12);
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // EL RECORRIDO SE PUEDE VER SOLO, Y TAMBIEN SE PUEDE PREGUNTAR
  //
  // El paso a paso con «Siguiente» sirve a quien está dispuesto a recorrerlo entero. El dueño del
  // proyecto pidió las otras dos formas, y las dos responden a momentos distintos:
  //
  //   · LA PRIMERA VEZ nadie sabe todavía qué preguntar, así que el recorrido se ve SOLO —«como si
  //     fuese un pequeño video, pero dentro de la función real»—: avanza por su cuenta, con el
  //     mapa cambiando de verdad en cada paso. Se puede pausar y se puede tomar el control.
  //
  //   · DESPUES ya no se quiere el recorrido entero, se quiere UNA cosa. Para eso está el modo
  //     explorar: se señala un apartado con el ratón y él dice qué es. Nada de pasar por dieciocho
  //     pasos para llegar al que interesa.
  // ═══════════════════════════════════════════════════════════════════════════════════════

  /** El recorrido avanza por su cuenta. */
  readonly reproduccionAutomatica = signal(false);

  /** La reproducción está detenida a la espera de reanudarse. */
  readonly reproduccionEnPausa = signal(false);

  private temporizadorDelRecorrido: ReturnType<typeof setTimeout> | null = null;

  /**
   * Cuánto se queda cada paso en pantalla, según lo que hay que leer.
   *
   * <b>NO ES UN NUMERO FIJO.</b> Un paso de dos frases y otro de cinco no se leen en el mismo
   * tiempo, y un intervalo único deja corto el largo o hace esperar en el corto. Se calcula sobre
   * el texto: un arranque para mirar lo que se acaba de iluminar, más el tiempo de lectura, con un
   * techo para que ningún paso se eternice —quien quiera detenerse tiene el botón de pausa—.
   */
  private tiempoDelPaso(): number {
    const texto = this.pasoTutorial()?.description ?? '';
    return Math.min(9500, 2800 + texto.length * 28);
  }

  /**
   * Arranca el recorrido y lo pone a andar solo.
   *
   * <b>ENTRA YA EN EL PRIMER APARTADO.</b> Quedarse en la bienvenida esperando su turno haría que
   * lo primero que ocurre tras pulsar «Verlo solo» sea no ocurrir nada durante nueve segundos.
   * Quien pulsa eso quiere ver el mapa moverse.
   */
  verElRecorridoSolo(): void {
    this.reproduccionAutomatica.set(true);
    this.reproduccionEnPausa.set(false);
    this.handleGoToStep(1);
    this.programarElPasoSiguiente();
  }

  /**
   * Salta al apartado anterior o al siguiente sin detener la reproducción.
   *
   * <b>ADELANTAR NO ES PAUSAR.</b> Quien lo está viendo solo y quiere volver a una sección o
   * saltarse una no quiere por eso tomar el control: quiere seguir viéndolo desde otro punto. El
   * temporizador se reinicia con el paso nuevo —si no, el salto heredaría lo que le quedaba al
   * anterior y un paso largo pasaría en un segundo—.
   *
   * <b>SE QUEDA EN LOS EXTREMOS.</b> En el primero, «atrás» no hace nada; en el último, «adelante»
   * tampoco. Dar la vuelta al recorrido sorprendería a quien solo quería avanzar uno más.
   */
  saltarEnElRecorrido(direccion: -1 | 1): void {
    const destino = this.pasoDelTutorial() + direccion;
    if (destino < 0 || destino >= this.PASOS_DEL_TUTORIAL.length) return;

    this.handleGoToStep(destino);
    if (this.reproduccionAutomatica() && !this.reproduccionEnPausa()) this.programarElPasoSiguiente();
  }

  /** Deja de avanzar solo y devuelve el control, sin cerrar nada. */
  tomarElControl(): void {
    this.reproduccionEnPausa.set(true);
    this.detenerElAvance();
  }

  reanudarElRecorrido(): void {
    this.reproduccionEnPausa.set(false);
    this.programarElPasoSiguiente();
  }

  private programarElPasoSiguiente(): void {
    this.detenerElAvance();
    if (!this.reproduccionAutomatica() || this.reproduccionEnPausa() || !this.tutorialAbierto()) return;

    this.temporizadorDelRecorrido = setTimeout(() => {
      const ultimo = this.PASOS_DEL_TUTORIAL.length - 1;
      if (this.pasoDelTutorial() >= ultimo) {
        // AL TERMINAR NO SE CIERRA SOLO. Cerrar de golpe devuelve la pantalla sin decir que el
        // recorrido acabó; se queda en el último paso, detenido, con «Finalizar» a mano.
        this.reproduccionAutomatica.set(false);
        return;
      }
      this.handleGoToStep(this.pasoDelTutorial() + 1);
      this.programarElPasoSiguiente();
    }, this.tiempoDelPaso());
  }

  private detenerElAvance(): void {
    if (this.temporizadorDelRecorrido) {
      clearTimeout(this.temporizadorDelRecorrido);
      this.temporizadorDelRecorrido = null;
    }
  }

  // ───────────────────────── MODO EXPLORAR ─────────────────────────

  /** Señalar un apartado dice qué es, sin recorrer nada. */
  readonly modoExplorar = signal(false);

  /** El apartado señalado ahora mismo, o cadena vacía. */
  readonly apartadoSenalado = signal<string>('');

  /**
   * Qué se dice de cada apartado cuando se señala.
   *
   * <b>SON TEXTOS PROPIOS Y NO LOS DEL RECORRIDO, a propósito.</b> Los del recorrido están
   * escritos como una secuencia —«ahora mira esto», «a diferencia de la anterior»— y sacados de
   * su orden dejan de sostenerse. Además tres pasos distintos explican el mismo control de dibujo,
   * uno por modo: al señalarlo habría que elegir cuál de los tres, y ninguno sirve como respuesta a
   * «¿qué es esto?». Son dos trabajos distintos y llevan dos textos.
   */
  readonly EXPLICACION_DEL_APARTADO: Readonly<Record<string, string>> = {
    capas: 'map_explorar_capas_2',
    filtros: 'map_explorar_filtros',
    lente: 'map_explorar_lente',
    leyenda: 'map_explorar_leyenda',
    dibujo: 'map_explorar_dibujo',
    lienzo: 'map_explorar_lienzo',
    vistas: 'map_explorar_vistas',
    lecturas: 'map_explorar_lecturas',
    dimension: 'map_explorar_dimension',
    listado: 'map_explorar_listado',
    fichas: 'map_explorar_listado',
  };

  /** El texto del apartado señalado, o cadena vacía si no hay ninguno. */
  readonly explicacionSenalada = computed(() => {
    const clave = this.EXPLICACION_DEL_APARTADO[this.apartadoSenalado()];
    return clave ? this.getWebText(clave) : '';
  });

  /**
   * Enciende el modo explorar.
   *
   * <b>CIERRA EL RECORRIDO SI ESTABA ABIERTO.</b> Los dos ocupan la misma tarjeta y el mismo
   * desenfoque: tenerlos a la vez dejaría dos explicaciones peleándose por la pantalla.
   */
  abrirModoExplorar(): void {
    if (this.tutorialAbierto()) this.cerrarTutorial();
    this.modoExplorar.set(true);
    this.apartadoSenalado.set('');
    this.recorridoGuiado.abrir();
    this.vigilarElDesplazamiento();
  }

  cerrarModoExplorar(): void {
    this.dejarDeVigilarElDesplazamiento();
    this.modoExplorar.set(false);
    this.apartadoSenalado.set('');
    this.anclaDelTutorial.set(null);
    this.recorridoGuiado.cerrar();
  }

  /**
   * Alguien señaló un apartado: se mide y se coloca la tarjeta.
   *
   * <b>POR PUNTERO Y POR FOCO.</b> Solo con el ratón, esto no existiría para quien navega con
   * teclado, y la explicación de una herramienta es justo lo que más falta le hace. `pointerenter`
   * y `focusin` entran por el mismo sitio.
   */
  senalarApartado(clave: string): void {
    if (!this.modoExplorar() || !this.EXPLICACION_DEL_APARTADO[clave]) return;
    this.apartadoSenalado.set(clave);
    this.recolocarLaTarjetaJunto(clave);
  }

  /**
   * Dónde va la tarjeta del recorrido y hacia dónde apunta su flecha.
   *
   * <b>NULO SIGNIFICA «CENTRADA».</b> La bienvenida no señala nada y va en medio de la pantalla,
   * como antes; y si el elemento de un paso no se encuentra —porque una capa tarda o porque alguien
   * cambió una marca de sitio—, la tarjeta vuelve al centro en vez de irse a la esquina. Una
   * tarjeta mal colocada se sigue leyendo; una fuera de la pantalla, no.
   */
  readonly anclaDelTutorial = signal<UbicacionDeLaTarjeta | null>(null);

  /**
   * Lo que mide la tarjeta, para calcular dónde cabe antes de pintarla.
   *
   * <b>EL ANCHO NO ES FIJO, Y ESO COSTO UNA VUELTA.</b> Eran 380 px constantes: en una pantalla de
   * 390 px la tarjeta salía por la derecha —medido, se pasaba dos píxeles— en diecisiete de los
   * dieciocho pasos. El ancho se recorta a lo que quepa dejando margen a los dos lados.
   */
  readonly anchoDeLaTarjeta = signal<number>(380);

  private static readonly ANCHO_MAXIMO_DE_LA_TARJETA = 380;
  private static readonly ALTO_ESTIMADO_DE_LA_TARJETA = 250;

  /**
   * Mide el elemento del paso y coloca la tarjeta a su lado.
   *
   * <b>DOS FOTOGRAMAS DE ESPERA, Y NO UNO.</b> El paso puede haber cambiado de vista —del mapa al
   * gráfico— y el elemento que hay que señalar no existe hasta que Angular pinta la vista nueva.
   * Con un solo `requestAnimationFrame` la medida salía del elemento anterior o de cero.
   *
   * <b>SE BUSCA POR `data-tuto` Y NO POR CLASE NI POSICION.</b> Es una marca puesta a propósito
   * para esto: sobrevive a que el elemento cambie de estilo o de sitio en la plantilla, que es lo
   * que le pasó dos veces a las capas.
   */
  private recolocarLaTarjetaDelTutorial(): void {
    if (!this.tutorialAbierto()) {
      this.anclaDelTutorial.set(null);
      return;
    }

    const paso = this.PASOS_DEL_TUTORIAL[this.pasoDelTutorial()];
    this.recolocarLaTarjetaJunto(paso?.destacado ?? '');
  }

  /**
   * Coloca la tarjeta junto al apartado que se le diga.
   *
   * <b>LA USAN LOS DOS MODOS.</b> El recorrido le pasa el apartado del paso; el modo explorar, el
   * que se acaba de señalar. Medir y colocar es lo mismo en los dos casos, y tener dos copias
   * habría hecho que uno de ellos se quedara sin el área segura de la cabecera o sin el alto real,
   * que son las dos cosas que costó descubrir.
   */
  private recolocarLaTarjetaJunto(clave: string): void {
    if (!clave) {
      this.anclaDelTutorial.set(null);
      return;
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ancho = Math.min(
        MapaEcosistemicoPageComponent.ANCHO_MAXIMO_DE_LA_TARJETA,
        Math.max(240, window.innerWidth - 24),
      );
      this.anchoDeLaTarjeta.set(ancho);

      // EL ALTO SE MIDE, NO SE ESTIMA. El texto envuelve en más líneas cuanto más estrecha es la
      // tarjeta, y un paso de cuatro frases mide casi el doble que uno de dos: con un alto fijo se
      // salía por abajo a 390 px de ancho.
      const tarjeta = document.querySelector<HTMLElement>('[data-tarjeta-del-recorrido]');
      const alto = tarjeta?.offsetHeight || MapaEcosistemicoPageComponent.ALTO_ESTIMADO_DE_LA_TARJETA;

      const elemento = document.querySelector<HTMLElement>(`[data-tuto="${clave}"]`);
      if (!elemento) {
        this.anclaDelTutorial.set(null);
        return;
      }

      const caja = elemento.getBoundingClientRect();
      if (caja.width === 0 && caja.height === 0) {
        this.anclaDelTutorial.set(null);
        return;
      }

      this.anclaDelTutorial.set(ubicarLaTarjeta(
        { top: caja.top, left: caja.left, ancho: caja.width, alto: caja.height },
        { ancho, alto },
        // `topSeguro`: la cabecera del sitio es `fixed` y mide unos 80 px. Sin decírselo, la
        // tarjeta de los apartados de la parte alta quedaba montada sobre el menú.
        { ancho: window.innerWidth, alto: window.innerHeight, topSeguro: 88 },
      ));
    }));
  }

  /**
   * Vuelve a medir si la ventana cambia de tamaño con el recorrido abierto.
   *
   * Sin esto, girar una tableta dejaba la tarjeta señalando donde el elemento estaba antes.
   */
  @HostListener('window:resize')
  alRedimensionarConElTutorialAbierto(): void {
    this.volverAColocarLaTarjeta();
  }

  /**
   * Vuelve a medir cuando algo se desplaza debajo.
   *
   * <b>ES EL MISMO DEFECTO QUE ESCONDIA LOS CONTROLES, EN OTRA FORMA.</b> La tarjeta se coloca una
   * vez, con la caja que el elemento tenía entonces, y a partir de ahí no vuelve a mirarlo. Basta
   * con desplazar la columna izquierda —que tiene su propio desplazamiento y en pantallas bajas lo
   * usa siempre— para que el apartado suba noventa píxeles y la flecha se quede apuntando a lo que
   * ahora hay en su sitio. Medido a 1440x700: el elemento pasó de y=161 a y=66 y la tarjeta no se
   * movió.
   *
   * <b>EN CAPTURA, PORQUE `scroll` NO BURBUJEA.</b> Los desplazamientos que importan no son los de
   * la ventana sino los de las tres columnas, cada una con su caja. Un oyente normal en `document`
   * no se entera; en fase de captura, sí.
   *
   * <b>SE REGISTRA SOLO MIENTRAS HAY ALGO QUE COLOCAR</b> y se retira al cerrar: un oyente de
   * desplazamiento en captura sobre todo el documento no tiene por qué seguir ahí cuando nadie
   * está mirando una explicación.
   */
  private readonly alDesplazarse = (): void => this.volverAColocarLaTarjeta();

  private vigilarElDesplazamiento(): void {
    document.addEventListener('scroll', this.alDesplazarse, { capture: true, passive: true });
  }

  private dejarDeVigilarElDesplazamiento(): void {
    document.removeEventListener('scroll', this.alDesplazarse, { capture: true });
  }

  private volverAColocarLaTarjeta(): void {
    if (this.tutorialAbierto()) this.recolocarLaTarjetaDelTutorial();
    else if (this.modoExplorar() && this.apartadoSenalado()) this.recolocarLaTarjetaJunto(this.apartadoSenalado());
  }

  /**
   * Qué queda nítido en cada paso del tutorial, y qué se desenfoca.
   *
   * <b>ANTES ERAN TRES COLUMNAS; AHORA ES CADA APARTADO.</b> La versión anterior atenuaba por
   * zona —`control`, `centro`, `lectura`— y eso bastaba cuando cada zona era un panel con una sola
   * cosa dentro. Hoy la columna izquierda tiene tres apartados distintos —filtrar, el lente, la
   * leyenda—, la central tiene el mapa más dos grupos de controles flotantes y la derecha tiene las
   * capas y el listado. Iluminar la columna entera para hablar del lente dejaba nítidas otras cinco
   * cosas que el paso no estaba explicando, que es casi lo mismo que no atenuar nada.
   *
   * <b>POR QUE EL CONTENEDOR SE DECLARA APARTE DEL DESTACADO.</b> `filter: blur()` afecta a todos
   * los descendientes y no hay forma de devolverle nitidez a un hijo: si la columna se desenfoca,
   * el apartado de dentro se desenfoca con ella, diga lo que diga su propia clase. Por eso cada
   * paso nombra las DOS cosas: los contenedores que debe dejar en claro para poder llegar hasta él
   * (`abiertos`) y el apartado concreto que explica (`destacado`). Lo que no esté en ninguna de las
   * dos listas se desenfoca.
   */
  enfoqueDelTutorial(clave: string): string {
    // EN MODO EXPLORAR NO SE DESENFOCA NADA. Ahí la persona está buscando, y buscar con el resto
    // borroso es imposible: lo que hay que encontrar es justo lo que no se está señalando. Solo se
    // ilumina lo que tiene el puntero encima.
    if (this.modoExplorar()) {
      // SIN `z-index`, Y ESA ES LA DIFERENCIA CON EL RECORRIDO.
      //
      // Levantar lo señalado sobre el resto tiene sentido en el recorrido, donde hay un velo
      // blanco por encima de todo y sin `z-index` el apartado quedaría debajo de él. Aquí no hay
      // velo, y levantarlo hacía daño: al señalar el mapa, el lienzo subía a `z-9998` y se dibujaba
      // ENCIMA de los controles flotantes que son hermanos suyos —los tres modos de dibujo y el
      // conmutador de vistas, a `z-950`—. Los botones seguían ahí, con opacidad 1, y el mapa los
      // tapaba. Comprobado: `elementFromPoint` sobre el control devolvía el lienzo de MapLibre.
      //
      // Es justo el apartado que más se va a señalar, y el efecto era que señalarlo escondía dos
      // de las herramientas que este modo existe para explicar.
      return this.apartadoSenalado() === clave
        ? 'rounded-2xl ring-4 ring-morado ring-offset-4 ring-offset-white transition-all'
        : '';
    }

    if (!this.tutorialAbierto()) {
      return '';
    }

    const paso = this.PASOS_DEL_TUTORIAL[this.pasoDelTutorial()];
    if (!paso) {
      return '';
    }

    if (paso.destacado === clave) {
      // EL ANILLO SE VE, Y ESO COSTO UNA SEGUNDA VUELTA. Era `ring-2 ring-morado/30`: sobre un
      // control pequeño —los tres iconos de dibujo miden 36 px— apenas se distinguía del borde
      // propio del elemento. Ahora son cuatro píxeles a plena opacidad, con un halo blanco por
      // fuera que lo separa de lo que haya detrás —el mapa lleva color en todas partes—.
      return 'rounded-2xl relative z-[9998] ring-4 ring-morado ring-offset-4 ring-offset-white '
        + 'shadow-[0_0_0_9999px_rgba(255,255,255,0.35)] transition-all';
    }

    // NITIDO PERO SIN ANILLO: es el camino hasta el apartado, no el apartado. Ponerle anillo
    // haria que cada paso señalara dos cosas y ninguna de las dos se leeria como la principal.
    return paso.abiertos.includes(clave)
      ? ''
      : 'filter blur-[3.5px] opacity-45 pointer-events-none';
  }

  // Raw Data Signals
  cartografia = signal<any>(null);
  todosLosMunicipios = signal<any[]>([]);
  conteosDeBase = signal<any>({});
  registrosDeFestivales = signal<any[]>([]);
  /**
   * Los eventos publicados de la Agenda, la segunda capa con datos reales.
   *
   * <b>POR QUE ENTRA AHORA.</b> El mapa anunciaba seis capas y cinco marcaban cero. Cuatro de esas
   * cinco son procesos cuyas tablas retiró `V20260904_01`: no están desconectadas, no existen. La
   * Agenda sí tiene territorio —departamento y municipio, atados por CHECK a su nivel de
   * cobertura— y una lectura pública, y nunca se había llevado al mapa.
   */
  registrosDeAgenda = signal<RegistroCrudo[]>([]);
  registrosDeEscuelas = signal<any[]>([]);
  registrosDeMercados = signal<any[]>([]);
  registrosDeRedes = signal<any[]>([]);
  registrosDeLutieres = signal<any[]>([]);
  registrosDeEspacios = signal<NetworkRecord[]>([]);
  festivalCounts = signal<any>({});
  schoolCounts = signal<any>({});
  marketCounts = signal<any>({});
  // PNMC-036 — `fetchMapCountsBundle` nunca emitio `redesCounts` ni `lutieresCounts`
  // (map-data.service.ts-62 devuelve diez claves y ninguna es esta). Cuando eran
  // signals escribibles, `.set(bundle.redesCounts)` los dejaba en `undefined` y
  // `estiloDelDepartamento` reventaba al indexarlos. Derivarlos de los registros normalizados es
  // lo que hace que "N registros" y "% cobertura" hablen de los mismos datos.
  redesCounts = computed<Record<string, number>>(() => ({
    ...this.conteosDeBase(),
    ...this.buildNetworkDepartmentCounts(this.registrosDeRedes()),
  }));
  lutieresCounts = computed<Record<string, number>>(() => ({
    ...this.conteosDeBase(),
    ...this.buildNetworkDepartmentCounts(this.registrosDeLutieres()),
  }));
  espaciosCounts = computed<Record<string, number>>(() => ({
    ...this.conteosDeBase(),
    ...this.buildNetworkDepartmentCounts(this.registrosDeEspacios()),
  }));
  capaDeEscuelasLista = signal<boolean>(false);
  capaDeMercadosLista = signal<boolean>(false);
  cargando = signal<boolean>(true);
  errorDelMapa = signal<string | null>(null);
  /** Las fuentes que no se pudieron leer, con su motivo: el mapa se pinta con lo que llegó pero NO lo esconde. */
  readonly fallasDeFuentes = signal<{ fuente: string; motivo: string }[]>([]);

  // Opciones estáticas del dominio
  TOOLBAR_ITEMS = [
    { id: MAP_PANEL_IDS.layers, label: 'Capas', iconClass: 'layers-3' },
    { id: MAP_PANEL_IDS.filters, label: 'Filtros', iconClass: 'filter' },
    { id: MAP_PANEL_IDS.insights, label: 'Modos', iconClass: 'eye' },
    { id: MAP_PANEL_IDS.registration, label: 'Ser parte del ecosistema', iconClass: 'plus' },
    { id: MAP_PANEL_IDS.export, label: 'Exportar', iconClass: 'download' },
    { id: MAP_PANEL_IDS.tutorial, label: 'Ayuda', iconClass: 'circle-help' },
  ];

  /**
   * El color con el que cada capa se identifica: el punto del panel, la barra
   * del ranking, el ultimo escalon de su rampa en el mapa.
   *
   * PALETA MEDIDA, NO ELEGIDA. Los seis anteriores fallaban el validador de
   * daltonismo sobre todos los pares —la comprobacion que exige un mapa, donde
   * cualquier capa puede compararse con cualquier otra—: Redes contra General
   * daba ΔE 1.1 simulando deuteranopia, y Lutieres contra General daba ΔE 4.9
   * en VISION NORMAL. Ese segundo numero es el que duele: dos de cada tres
   * lectores tampoco veian la diferencia, asi que cambiar de capa no cambiaba
   * visiblemente el mapa.
   *
   * Estos seis dan ΔE 11.5 con daltonismo (objetivo ≥8), 16.2 en vision normal
   * (suelo ≥15) y todos pasan 3:1 de contraste contra la superficie del mapa.
   * Cada capa conserva su familia de tono para no obligar a reaprender nada.
   *
   * DEBEN coincidir con `color` en `mapLayersConfig.ts` y con el ultimo escalon
   * de `MAP_LAYER_CHOROPLETH_STEPS` en `map-domain.ts`. Cambiar uno solo de los
   * tres sitios deja el punto del panel diciendo un color y el mapa otro.
   */
  LAYER_ACCENTS: Record<string, string> = {
    General: '#6d4a7b',
    Festivales: '#7a2f97',
    // LA AGENDA ES VERDE, el color con el que el portal ya la nombra en su navegación. Que el mapa
    // la pintara de otro color obligaría a aprenderse dos códigos para lo mismo.
    'Agenda': '#00A849',
    'Escuelas de Música': '#5e5ceb',
    'Mercados Musicales': '#c88011',
    'Redes de Documentación': '#d33068',
    Lutieres: '#109db5',
    // LOS ESPACIOS USAN EL ÍNDIGO QUE LA PALETA MEDIDA YA TENÍA PARA ESCUELAS, que quedó fuera: es el único
    // tono validado contra daltonismo que no está en uso.
    Espacios: '#5e5ceb',
  };

  SELECTED_DEPARTMENT_STYLE = {
    fillColor: '#8a6a9b',
    fillOpacity: 0.86,
    color: 'rgba(76, 44, 84, 0.75)',
    opacity: 1,
    weight: 2,
  };

  MUTED_DEPARTMENT_STYLE = {
    fillColor: '#d8d3df',
    fillOpacity: 0.48,
    color: 'rgba(76, 44, 84, 0.28)',
    opacity: 1,
    weight: 0.9,
  };

  TERRITORIOS_SONOROS_LIST = [
    'Cantos, Pitos y Tambores',
    'Canta y Torbellino',
    'Rajaleña y Cucamba',
    'Marimba',
    'Flautas, Cuerdas y Tambores Sureños',
    'Chirimía',
    'Joropo',
    'Trova y Parranda',
    'Amazonas',
    'Insular',
    'Prácticas de Pueblos Indígenas',
    'Músicas Urbanas, Alternativas e Independientes - MUAI',
    'Comunidades Académicas',
    'Rrom'
  ];

  PRACTICAS_MUSICALES_LIST = [
    'Expresiones sonoras de pueblos originarios',
    'Músicas de comunidades negras, afrocolombianas, raizales y palenqueras',
    'Músicas campesinas, rurales y de raíz territorial',
    'Músicas populares tradicionales, regionales y patrimoniales',
    'Músicas comunitarias y procesos colectivos de práctica musical',
    'Músicas de frontera, diásporas, migraciones e interculturalidad',
    'Músicas urbanas, alternativas e independientes',
    'Músicas populares de amplia circulación, tropicales, bailables y comerciales',
    'Músicas vocales, corales y de tradición cantada',
    'Músicas sinfónicas, bandas, orquestas y grandes formatos instrumentales',
    'Bandas de marcha, batucadas, comparsas y colectivos sonoros en movimiento',
    'Músicas académicas, de cámara, contemporáneas, experimentales y de vanguardia',
    'Músicas electrónicas, digitales, producción sonora y nuevas tecnologías',
    'Músicas religiosas, rituales, espirituales y devocionales',
    'Músicas para escena, danza, audiovisual e interdisciplinariedad',
    'Prácticas sonoras, arte sonoro, archivo, investigación-creación y paisajes sonoros'
  ];

  /**
   * El recorrido, apartado por apartado del tablero que hay hoy.
   *
   * <b>QUE CAMBIO Y POR QUE.</b> Eran seis pasos heredados de un geovisor que ya no existe. El
   * paso 2 —«Capas y Registros de Procesos»— iluminaba una barra superior retirada el 29 de agosto;
   * el 3 mandaba abrir un panel de filtros que dejó de ser un panel; el 4 y el 5 hablaban de «Modo
   * Cobertura» y de un conmutador de calor que vivían en sitios que se movieron. Un recorrido que
   * enseña a usar controles que no están es peor que no tener recorrido: quien lo sigue concluye
   * que no entiende la herramienta, cuando lo que pasa es que el texto envejeció.
   *
   * <b>AHORA SIGUE LAS TRES PREGUNTAS DE LA PANTALLA</b>, en el orden en que se hacen: qué se está
   * mirando (capas), cómo se acota (filtros, lente), cómo se dibuja (modos, mapa, leyenda) y de qué
   * otras formas se puede leer (vistas, listado). Cada paso destaca UN apartado y desenfoca el
   * resto, que es lo que el criterio pide: «recorriendo cada apartado del modelo actual,
   * cada detalle, con el mismo efecto de desenfoque de lo que no es el elemento a mostrar».
   *
   * <b>LOS ICONOS Y EL ORDEN SON ESTRUCTURA Y SE QUEDAN AQUI</b>; el panel de textos dice cómo se
   * llama cada paso y qué explica, no cuántos hay ni con qué se dibujan. Añadir un paso exige
   * añadir su entrada aquí y sus dos claves de texto: uno que aparezca sin icono y sin texto es
   * peor que uno que no aparezca.
   */
  readonly PASOS_DEL_TUTORIAL: readonly {
    readonly icono: string;
    /** El apartado que explica: queda nítido, con anillo, y la tarjeta lo señala. */
    readonly destacado: string;
    /** Lo que hay que dejar nítido para poder verlo: su columna, su caja. Sin anillo. */
    readonly abiertos: readonly string[];
  }[] = [
    // LA BIENVENIDA NO DESTACA NADA, a propósito: todavía no hay ningún apartado del que hablar y
    // señalar uno cualquiera haría creer que por ahí se empieza.
    { icono: 'Globe', destacado: '', abiertos: [] },

    // ---- QUE SE ESTA MIRANDO -------------------------------------------------------------
    { icono: 'Layers3', destacado: 'capas', abiertos: ['derecha'] },

    // ---- COMO SE ACOTA: LOS MISMOS FILTROS EN LAS TRES VISTAS ----------------------------
    { icono: 'Search', destacado: 'filtros', abiertos: ['izquierda'] },
    { icono: 'Aperture', destacado: 'lente', abiertos: ['izquierda'] },

    // ---- COMO SE DIBUJA: UN PASO POR MODO ------------------------------------------------
    //
    // Cada paso PONE el modo del que habla, así que se ve el mapa cambiar de naturaleza al pasar:
    // nombrar tres modos no es lo mismo que enseñarlos.
    { icono: 'Shapes', destacado: 'dibujo', abiertos: ['centro', 'lienzo'] },
    { icono: 'Shapes', destacado: 'dibujo', abiertos: ['centro', 'lienzo'] },
    { icono: 'Shapes', destacado: 'dibujo', abiertos: ['centro', 'lienzo'] },

    // ---- LEYENDA Y LECTURA POR DEPARTAMENTO ----------------------------------------------
    { icono: 'BookOpen', destacado: 'leyenda', abiertos: ['izquierda'] },
    { icono: 'Map', destacado: 'lienzo', abiertos: ['centro'] },

    // ---- LAS TRES VISTAS -----------------------------------------------------------------
    { icono: 'LayoutGrid', destacado: 'vistas', abiertos: ['centro'] },

    // ---- DENTRO DEL GRAFICO --------------------------------------------------------------
    //
    // Tres pasos para una sola vista, porque tiene decisiones distintas dentro: qué lectura (y su
    // exportación), el orden por departamento y, en la de composición, sobre qué dimensión se mide.
    { icono: 'BarChart3', destacado: 'lecturas', abiertos: ['centro', 'grafico'] },
    { icono: 'List', destacado: 'barras', abiertos: ['centro', 'grafico'] },
    { icono: 'PieChart', destacado: 'dimension', abiertos: ['centro', 'grafico'] },

    // ---- LA EXPORTACION Y EL TECLADO ----------------------------------------------------
    //
    // La vista «Tabla» se retiró: la exportación se explica sobre el gráfico, y el paso del teclado
    // destaca el conmutador porque es el primer control al que se llega.
    { icono: 'BarChart3', destacado: 'lecturas', abiertos: ['centro', 'grafico'] },
    { icono: 'Keyboard', destacado: 'vistas', abiertos: ['centro', 'grafico'] },

    // ---- LA COLUMNA DE LECTURA: DIRECTORIO Y AGENDA --------------------------------------
    { icono: 'CalendarDays', destacado: 'listado', abiertos: ['derecha', 'fichas'] },
  ];

  /**
   * Los pasos con su texto tomado del panel de textos.
   *
   * Antes eran objetos con la prosa incrustada, y el primero llevaba además un parche: la plantilla
   * sustituía su descripción por `map_description` —la entradilla del geovisor— porque era la única
   * clave editable a mano. Era una clave haciendo dos trabajos: quien corrigiera la entradilla del
   * mapa cambiaba, sin saberlo, la bienvenida del recorrido.
   */
  readonly TUTORIAL_STEPS = computed(() =>
    this.PASOS_DEL_TUTORIAL.map((paso, indice) => ({
      title: this.textoDelPaso(indice + 1, 'title'),
      description: this.textoDelPaso(indice + 1, 'desc'),
      iconClass: paso.icono,
    })),
  );

  /**
   * El texto de un paso: lo que el panel de textos tenga publicado y, si sigue siendo el de fábrica de un paso que habla de la
   * vista Gráfico, el texto actualizado de `TEXTOS_DEL_RECORRIDO_DE_LA_VISTA_GRAFICO`. Así editarlo en el panel sigue mandando.
   */
  private textoDelPaso(numero: number, parte: 'title' | 'desc'): string {
    const clave = `map_recorrido_${numero}_${parte}`;
    const actual = this.getWebText(clave);
    const nuevo = TEXTOS_DEL_RECORRIDO_DE_LA_VISTA_GRAFICO[numero];
    if (!nuevo || actual !== DEFAULT_TEXTS[clave]) return actual;
    return parte === 'title' ? nuevo.title : nuevo.description;
  }

  /** El paso visible. Evita repetir el índice nueve veces en la plantilla. */
  readonly pasoTutorial = computed(() => this.TUTORIAL_STEPS()[this.pasoDelTutorial()]);

  MAP_LAYERS_CONFIG_REF = MAP_LAYERS_CONFIG;
  MAP_PANEL_IDS_REF = MAP_PANEL_IDS;

  // Computed signals
  /**
   * Departamentos seleccionables, leidos de la cartografia cargada.
   *
   * Antes salian de `MapDomain.getSortedDepartmentNames()`, que devuelve las
   * claves de una tabla DIVIPOLA de tiempo de ejecucion. Esa tabla se rellena
   * con `setRuntimeDivipolaByDepartment`, que esta definida y exportada pero a
   * la que **no llama nadie en todo el front**: la tabla es `{}` siempre, la
   * lista quedaba en solo 'Nacional' y el desplegable de departamento del
   * geovisor no ha ofrecido nunca ninguna opcion.
   *
   * Se sustituye por los rasgos del GeoJSON, que es el dato que el usuario
   * tiene delante, y se normalizan las claves igual que las de la seleccion por
   * clic (`abrirDepartamento`), para que ambos caminos coincidan.
   */
  departmentsList = computed(() => {
    const rasgos = this.cartografia()?.features || [];
    const nombres = new Set<string>();

    for (const rasgo of rasgos) {
      const propiedades = rasgo?.properties || {};
      const bruto =
        propiedades['departmentName'] ?? propiedades['dpto_cnmbr'] ?? propiedades['DPTO_CNMBR'] ??
        propiedades['dpt'] ?? propiedades['NOMBRE_DPT'] ?? propiedades['name'] ?? '';
      const clave = MapDomain.normalizeDepartmentName(bruto);
      if (clave) nombres.add(clave);
    }

    return ['Nacional', ...Array.from(nombres).sort((izq, der) => izq.localeCompare(der, 'es-CO'))];
  });
  /** Las opciones de los dos desplegables del panel de filtros (UI-C): `app-filtro-desplegable` las lee con `id`. */
  opcionesDeDepartamento = computed<readonly OpcionDeFiltro[]>(() =>
    this.departmentsList().map(d => ({ id: d, etiqueta: nombrePropio(d) })));
  opcionesDeMunicipio = computed<readonly OpcionDeFiltro[]>(() => [
    { id: 'Todos', etiqueta: 'Todos' },
    ...this.municipiosConRegistros().map(m => ({ id: m, etiqueta: nombrePropio(m) })),
  ]);
  departamentoNormalizado = computed(() => MapDomain.normalizeDepartmentName(this.departamentoElegido()));
  nombreDelDepartamentoElegido = computed(() => this.departamentoElegido() === 'Nacional' ? 'Nacional' : MapDomain.getDepartmentDisplayName(this.departamentoElegido()));

  esCapaGeneral = computed(() => this.capaActiva() === 'General');
  esCapaDeFestivales = computed(() => this.capaActiva() === 'Festivales');
  // ─────────────── La organización que responde por un proceso ───────────────
  //
  // <b>SE CONSULTA DESDE EL PROCESO, NO COMO ENTIDAD DEL MAPA.</b> Quedó definido
  // así: «no vamos a incluir las organizaciones dentro del mapa; sin
  // embargo sí están dentro de la información de los eventos […] al hacer clic en la organización
  // debería darme una información básica, pero solo desde los procesos como tal y no de la
  // organización misma».
  //
  // <b>POR ESO NO HAY NINGUNA CONSULTA NUEVA.</b> Lo que se enseña se calcula sobre los registros
  // que el mapa YA tiene cargados: qué procesos lleva esa organización y en qué territorios. No se
  // pide su ficha, no se pide su correo, no se pide su estado. Es lo que los procesos saben de
  // ella, que es exactamente lo que se pidió.

  /** El nombre de la organización cuya lectura está abierta, o `null`. */
  organizacionAbierta = signal<string | null>(null);

  /**
   * Lo que los procesos del mapa saben de esa organización.
   *
   * COMPARA POR NOMBRE NORMALIZADO porque es lo único que traen las lecturas públicas: la ficha
   * pública de un Festival entrega `organizacionResponsable` como texto, no como identificador.
   * Normalizar evita que «Fundación X» y «FUNDACION X  » cuenten como dos.
   */
  resumenDeLaOrganizacion = computed(() => {
    const nombre = this.organizacionAbierta();
    if (!nombre) return null;

    const clave = MapDomain.normalizeDepartmentName(nombre);

    // LAS DOS FUENTES, Y HAY QUE LEER LAS DOS. El directorio lista procesos y ya NO incluye los
    // eventos —se separaron, porque un evento no es un proceso—. Si
    // esto leyera solo el directorio, pulsar la organización DESDE un evento enseñaría cero
    // eventos, que es justo lo contrario de lo que se acaba de pulsar.
    const procesos = this.fichasDelDirectorio()
      .filter((ficha) => MapDomain.normalizeDepartmentName(ficha?.record?.organizer ?? '') === clave)
      .map((ficha) => ({
        tipo: String(ficha.type),
        nombre: String(ficha.name),
        territorio: [ficha.record?.municipality, ficha.record?.department].filter(Boolean).join(', '),
      }));

    const eventos = Object.values(this.agendaPorDepartamento())
      .flat()
      .filter((evento) => MapDomain.normalizeDepartmentName(evento.organizer) === clave)
      .map((evento) => ({
        tipo: 'Evento',
        nombre: evento.name,
        territorio: [evento.municipality, evento.department].filter(Boolean).join(', '),
      }));

    const suyos = [...procesos, ...eventos];

    const territorios = new Set(suyos.map((item) => item.territorio).filter(Boolean));

    return {
      nombre,
      procesos: suyos,
      festivales: suyos.filter((item) => item.tipo === 'Festival').length,
      eventos: suyos.filter((item) => item.tipo === 'Evento').length,
      territorios: territorios.size,
    };
  });

  abrirOrganizacion(nombre: string | null | undefined): void {
    const limpio = (nombre || '').trim();
    if (limpio) this.organizacionAbierta.set(limpio);
  }

  cerrarOrganizacion(): void { this.organizacionAbierta.set(null); }

  // ─────────────── Los filtros, en un solo sitio cada uno ───────────────
  //
  // <b>ANTES ESTABAN REPARTIDOS EN DOS PESTAÑAS, Y DOS DE ELLOS EN LAS DOS.</b>
  // `selectedSonorousTerritory` y `selectedPractice` estaban enlazados en «Territorio» y otra vez
  // dentro de «Modos»: las mismas señales, dos controles, en pestañas distintas. Elegir en una
  // cambiaba la otra DONDE NADIE ESTABA MIRANDO. Y llegar por «Modos» exigía dos decisiones previas
  // para alcanzar el mismo desplegable que en «Territorio» estaba a la vista.
  //
  // Ahora la columna no tiene pestañas y agrupa por las cuatro preguntas que de verdad son
  // distintas: QUÉ SE VE (capas), DÓNDE (departamento y municipio), DE QUÉ TIPO (territorio sonoro
  // y práctica) y CÓMO SE DIBUJA (el modo). El modo elige el dibujo, no el dato: por eso ya no
  // cuelga ningún filtro de él.

  // ─────────────── El lente: con qué gafas se lee el mapa ───────────────
  //
  // <b>NO SON FILTROS, Y TRATARLOS COMO TALES ERA EL ERROR.</b> El 12 de septiembre de 2026 el
  // está definido: «una cosa es cómo se representa el mapa, y otra las gafas que me
  // quiero poner para verlo; una lectura posible es a través de los territorios sonoros, otra a
  // través de las prácticas y géneros. Ponerlos como un filtro no tiene mucho sentido».
  //
  // Un filtro RESTA: deja fuera lo que no coincide. Un lente REAGRUPA: lo enseña todo, ordenado por
  // otro criterio. Y la diferencia no es teórica —tenía dos consecuencias en pantalla—:
  //
  //   · LA AGENDA DESAPARECIA. Un evento no se clasifica por práctica musical, así que con un
  //     filtro puesto había que apagar la pestaña entera. Con un lente, el evento simplemente cae
  //     en «Sin clasificar», que es la verdad: no es que no aplique, es que no consta.
  //   · Y LO QUE NO ESTABA CLASIFICADO SE PERDIA SIN DECIRLO. Un Festival sin territorio sonoro
  //     declarado desaparecía del mapa al filtrar, indistinguible de uno que no existe.
  //
  // <b>EL DEFECTO QUE ESTO DESTAPO.</b> El filtro NO leía la clasificación declarada: buscaba
  // palabras clave en el género y la descripción del registro (`matchesSonorousTerritory` sobre
  // `genre + desc`). Un Festival que declara «Joropo» en `Territorios sonoros` quedaba fuera al
  // filtrar por Joropo si esa palabra no aparecía escrita en su texto. El dato declarado existía
  // —se enseña en la ficha— y el filtro lo ignoraba.

  /** Con qué criterio se lee el mapa. `territorial` es el de siempre: por departamento. */
  readonly lenteDeLectura = signal<'territorial' | 'territorios-sonoros' | 'practicas'>('territorial');

  /**
   * Los tres lentes, redactados como una invitación y no como un control.
   *
   * <b>SE PIDIO ASI:</b> «podría haber un llamado a leer el ecosistema musical de Colombia a través
   * de los territorios sonoros, o a través de sus diferentes prácticas». Y es lo correcto: un
   * desplegable rotulado «Territorio sonoro» se lee como un campo que hay que rellenar; «Léelo por
   * sus territorios sonoros» dice que hay OTRA forma de mirar el país y anima a probarla. La
   * diferencia no es de tono, es de lo que la persona entiende que puede hacer.
   */
  readonly lentesDisponibles = [
    {
      id: 'territorial' as const,
      // EL ROTULO CORTO ES PARA LA PASTILLA, que va en una fila de tres y no puede llevar frases.
      // El largo sigue existiendo para el `title` y para la leyenda, donde sí hay sitio.
      corto: 'Territorio',
      etiqueta: 'Por territorio',
      invitacion: 'Colombia como está organizada administrativamente.',
    },
    {
      id: 'territorios-sonoros' as const,
      corto: 'Sonoros',
      etiqueta: 'Por territorios sonoros',
      invitacion: 'Un mismo territorio sonoro cruza varios departamentos, y ahí se ve.',
    },
    {
      id: 'practicas' as const,
      corto: 'Prácticas',
      etiqueta: 'Por prácticas y géneros',
      invitacion: 'Lee el ecosistema por lo que se toca. Una práctica reúne procesos de regiones que no se parecen en nada más.',
    },
  ];

  /**
   * Mueve el lente al anterior o al siguiente, en ciclo.
   *
   * <b>EN CICLO Y SIN EXTREMOS.</b> Son tres opciones y el selector las enseña de una en una: dejar
   * las flechas sin efecto en los extremos obligaría a volver sobre los pasos para llegar a la
   * tercera y a recordar en qué punto de la lista se está. Con ciclo, cualquiera de las tres queda
   * siempre a un toque o dos.
   *
   * Cambiar de lente suelta el grupo resaltado —pertenecía a la clasificación anterior y no
   * significa nada en la nueva— y devuelve la vista de gráfico a una lectura que exista.
   */
  moverLente(direccion: 1 | -1): void {
    const total = this.lentesDisponibles.length;
    const actual = this.lentesDisponibles.findIndex((lente) => lente.id === this.lenteDeLectura());
    const siguiente = this.lentesDisponibles[(actual + direccion + total) % total];
    this.elegirLente(siguiente.id);
  }

  /** Pone un lente concreto, con todo lo que eso arrastra. */
  elegirLente(id: 'territorial' | 'territorios-sonoros' | 'practicas'): void {
    this.lenteDeLectura.set(id);
    this.grupoResaltado.set('');
    this.asegurarLecturaValida();
  }

  /**
   * Los tres lentes colocados en el dial: el activo al centro y los otros dos a sus lados.
   *
   * <b>SIEMPRE SE DIBUJAN LOS TRES, Y ESO ES LO QUE PERMITE QUE GIRE.</b> Si el selector sólo
   * pintara el activo, cambiar de lente sería un reemplazo: desaparece uno y aparece otro. Con los
   * tres en pantalla y su posición como único dato que cambia, el navegador puede animar el paso de
   * un sitio a otro, y lo que se ve es el dial rotando. La sensación de continuidad no es adorno:
   * es lo que deja claro que son tres formas de mirar lo MISMO y no tres pantallas distintas.
   *
   * `posicion` es -1, 0 o 1. En ciclo, como el propio dial: desde el tercero, el siguiente es el
   * primero.
   */
  readonly dialDeLentes = computed(() => {
    const total = this.lentesDisponibles.length;
    const actual = this.lentesDisponibles.findIndex((lente) => lente.id === this.lenteDeLectura());
    return this.lentesDisponibles.map((lente, indice) => {
      let posicion = indice - actual;
      if (posicion > total / 2) posicion -= total;
      if (posicion < -total / 2) posicion += total;
      return { ...lente, posicion };
    });
  });

  /** El lente que viene antes y el que viene después, para rotular las flechas. */
  readonly lenteAnterior = computed(() => {
    const total = this.lentesDisponibles.length;
    const actual = this.lentesDisponibles.findIndex((lente) => lente.id === this.lenteDeLectura());
    return this.lentesDisponibles[(actual - 1 + total) % total];
  });

  readonly lenteSiguiente = computed(() => {
    const total = this.lentesDisponibles.length;
    const actual = this.lentesDisponibles.findIndex((lente) => lente.id === this.lenteDeLectura());
    return this.lentesDisponibles[(actual + 1) % total];
  });

  readonly lenteActivo = computed(() =>
    this.lentesDisponibles.find((lente) => lente.id === this.lenteDeLectura()) ?? this.lentesDisponibles[0]);

  /**
   * Cómo se clasifica un registro bajo el lente activo.
   *
   * <b>LEE EL CAMPO DECLARADO</b> —`Territorios sonoros`, `Prácticas musicales`— y no el texto
   * libre. Es la corrección del defecto de arriba.
   *
   * <b>UN REGISTRO PUEDE DECLARAR VARIOS</b>, separados por coma, y entonces cuenta en todos: un
   * Festival de bambuco y de pasillo pertenece a las dos lecturas. Contarlo solo en la primera
   * escondería la mitad de lo que declara.
   */
  private clasificacionDe(ficha: FichaClasificable): string[] {
    const lente = this.lenteDeLectura();
    if (lente === 'territorial') return [];
    return this.clasificacionPor(ficha, lente);
  }

  /**
   * Lo mismo, pero por la dimensión que se le pida y no por la del lente activo.
   *
   * <b>HACE FALTA PORQUE LA ANALITICA LEE LAS DOS A LA VEZ</b> y el lente sólo tiene una puesta.
   * Es una sola implementación para las dos consumidoras: si cada una partiera la cadena por su
   * cuenta, el día que una empiece a admitir punto y coma como separador la otra contaría distinto
   * sobre los mismos registros y nada en pantalla lo delataría.
   */
  /**
   * Lo mismo, pero por la dimensión que se le pida y no por la del lente activo.
   *
   * <b>LA CUENTA VIVE EN `analitica-del-mapa.ts`</b>, que no depende de Angular y se puede probar
   * con un array literal. Aquí queda sólo el cableado: qué fichas y qué dimensión.
   */
  private clasificacionPor(ficha: FichaClasificable, dimension: 'territorios-sonoros' | 'practicas'): string[] {
    return Analitica.clasificacionDeclarada(ficha, dimension);
  }

  private contarPorDimension(dimension: 'territorios-sonoros' | 'practicas'): { nombre: string; total: number }[] {
    return [...Analitica.contarPorDimension(this.fichasDelDirectorio(), dimension)];
  }

  /**
   * Los grupos del lente activo, con su cifra, de mayor a menor.
   *
   * Es lo que sustituye al desplegable: en vez de elegir UN valor y perder el resto, se ven todos
   * con cuántos tiene cada uno. «Sin clasificar» va al final aunque sea el mayor: es la ausencia de
   * dato, no un grupo más.
   */
  readonly gruposDelLente = computed(() => {
    const lente = this.lenteDeLectura();
    return lente === 'territorial' ? [] : this.contarPorDimension(lente);
  });

  /**
   * Devuelve la vista de gráfico a una lectura que existe, si la que se estaba mirando desaparece.
   *
   * <b>EL CRUCE SOLO EXISTE CON UN LENTE PUESTO.</b> Quitarse las gafas mientras se mira la matriz
   * dejaría la vista en blanco: el indicador se retira de la franja y el `@if` de abajo deja de
   * cumplirse, así que quedan las cifras y nada debajo, sin nada encendido con lo que salir. Es el
   * mismo cuidado que la pestaña de Agenda cuando se apaga.
   */
  asegurarLecturaValida(): void {
    if (this.formaDelGrafico() === 'cruce' && this.lenteDeLectura() === 'territorial') {
      this.formaDelGrafico.set('composicion');
    }
  }

  /** Si la lista de grupos del lente se enseña entera o sólo su cabeza. */
  readonly gruposDelLenteCompletos = signal(false);

  /**
   * Los grupos del lente que caben sin empujar el resto de la columna fuera de la pantalla.
   *
   * <b>CATORCE FILAS SON CIENTO SESENTA PIXELES</b>, y sumadas a lo que hay encima empujaban la
   * sección «Dibujo» fuera del alto visible. El criterio es este: «el tener que deslizar
   * en la barra de la izquierda hace que no sea tan claro que hay más información ahí». Un control
   * que sólo existe si alguien adivina que hay que deslizar es un control escondido.
   *
   * <b>SEIS Y EL RESTO CONTADO</b>, con la lista entera a un clic. El grupo resaltado entra siempre
   * aunque caiga fuera de los seis: si no, resaltar uno de la cola lo haría desaparecer de la lista
   * justo al pulsarlo.
   */
  readonly gruposDelLenteVisibles = computed(() => {
    const grupos = this.gruposDelLente();
    if (this.gruposDelLenteCompletos() || grupos.length <= MapaEcosistemicoPageComponent.CABEZA_DEL_LENTE) {
      return { grupos, ocultos: 0 };
    }
    const cabeza = grupos.slice(0, MapaEcosistemicoPageComponent.CABEZA_DEL_LENTE);
    const resaltado = this.grupoResaltado();
    const fuera = resaltado && !cabeza.some((grupo) => grupo.nombre === resaltado)
      ? grupos.find((grupo) => grupo.nombre === resaltado)
      : undefined;
    return {
      grupos: fuera ? [...cabeza, fuera] : cabeza,
      ocultos: grupos.length - cabeza.length - (fuera ? 1 : 0),
    };
  });

  private static readonly CABEZA_DEL_LENTE = 5;

  /**
   * El grupo resaltado dentro del lente, o `null`.
   *
   * <b>RESALTA, NO FILTRA.</b> Pulsar «Joropo» no esconde lo demás: lo atenúa. Es la diferencia
   * entre ponerse unas gafas y taparse un ojo, y es lo que permite ver que el Joropo está en tres
   * departamentos SIN perder de vista los otros treinta.
   */
  readonly grupoResaltado = signal<string>('');

  alternarGrupoResaltado(nombre: string): void {
    this.grupoResaltado.set(this.grupoResaltado() === nombre ? '' : nombre);

    // SI LA AGENDA SE APAGA, NO PUEDE QUEDARSE ABIERTA. Deshabilitar la pestaña sin moverse deja el
    // panel derecho enseñando una lista que la propia pantalla acaba de declarar improcedente, y
    // sin un control encendido con el que salir de ahí.
    if (!this.agendaDisponible() && this.pestanaDeLectura() === 'agenda') {
      this.pestanaDeLectura.set('directorio');
    }
  }

  /** Si esta ficha pertenece al grupo resaltado. Decide la opacidad, no la presencia. */
  estaResaltada(ficha: FichaClasificable): boolean {
    const resaltado = this.grupoResaltado();
    if (!resaltado) return true;
    return this.clasificacionDe(ficha).includes(resaltado);
  }

  /** El municipio elegido, o `'Todos'`. Vacío mientras no haya departamento abierto. */
  readonly municipioElegido = signal<string>('Todos');

  /**
   * Los municipios que se pueden elegir: los que tienen registros en el departamento abierto.
   *
   * <b>NO SE LISTAN LOS 1.122 DE DIVIPOLA.</b> Un desplegable con mil entradas de las que
   * novecientas dan cero resultados no es un filtro, es un catálogo. Se ofrecen los que tienen algo
   * —que es la misma regla que ya rige los menús de la consola— y por eso la lista cambia con la
   * capa y con los demás filtros.
   */
  readonly municipiosConRegistros = computed<string[]>(() => {
    if (this.departamentoElegido() === 'Nacional') return [];
    const nombres = new Set<string>();
    for (const ficha of this.fichasDelDirectorio()) {
      const municipio = (ficha?.record?.municipality ?? '').trim();
      if (municipio) nombres.add(municipio);
    }
    return [...nombres].sort((uno, otro) => uno.localeCompare(otro, 'es'));
  });

  actualizarMunicipio(valor: string): void {
    this.municipioElegido.set(valor);
  }

  /**
   * Cuántos registros quedan de cuántos hay.
   *
   * <b>ES LO QUE HOY NO SE PUEDE SABER.</b> La cifra de la capa dice «2», y «2» no distingue «hay
   * dos» de «quedan dos de veinte». Sin esto, un filtro que no encuentra nada es indistinguible de
   * un territorio sin registros, que es la confusión que este geovisor tiene que evitar por encima
   * de todo: el mapa existe para decir dónde HAY y dónde NO hay.
   */
  readonly resultadoDeLaConsulta = computed(() => {
    const visibles = this.fichasDelDirectorio().length;
    const total = this.registrosDeFestivales().length;

    // «2 DE 3» SIN UN SOLO FILTRO PUESTO ES UNA ACUSACION SIN CULPABLE. Con la vista virgen y
    // «Limpiar filtros» apagado, el contador decía «2 de 3» y quien lo leía buscaba el filtro que
    // escondía al tercero. No había ninguno: ese registro declara cobertura nacional y no dice
    // departamento, así que el mapa —que reparte por departamento— no tiene dónde ponerlo. Es un
    // hueco del dato, no un efecto de la consulta, y se dice con esas palabras.
    const sinFiltros = this.filtrosActivos().length === 0;
    const fuera = Math.max(0, total - visibles);

    return {
      visibles,
      total,
      acotado: visibles !== total,
      // Cuántos quedan fuera por no declarar territorio, y no por la consulta.
      sinTerritorio: sinFiltros ? fuera : 0,
    };
  });

  // ─────────────── Cómo se dibuja el mapa ───────────────
  //
  // <b>LOS TRES MODOS, Y LOS TRES DIBUJAN.</b> El de calor estuvo declarado y sin pulsar mientras
  // no hubo con qué dibujarlo: el importador de DIVIPOLA pedía el catálogo sin geometría y los
  // 1.122 municipios llegaban sin coordenada. Arreglado eso en el catálogo —que es donde estaba el
  // fallo—, encender el modo no costó rehacer esta sección, que era para lo que se había dejado
  // declarado de antemano.

  /**
   * Cómo se dibuja el mapa, con los nombres que la cartografía ya tiene para esto.
   *
   * <b>«ZONAS» Y «PUNTOS» NO DECIAN NADA.</b> Eran nombres inventados, y cada uno de estos tres
   * tiene un nombre establecido que además dice qué hace y para qué sirve:
   *
   * <ul>
   *   <li><b>Coropletas</b> —colorear áreas por su valor— responde «cuánto hay aquí», y tiene un
   *       sesgo conocido: un departamento grande y vacío pesa más en la vista que uno pequeño y
   *       lleno. Por eso no basta sola.</li>
   *   <li><b>Símbolos proporcionales</b> —un círculo por lugar, con el tamaño según la cifra—
   *       corrige justo ese sesgo: el área del símbolo no depende del tamaño del territorio.</li>
   *   <li><b>Mapa de calor</b> —densidad continua— responde «dónde se concentra», que no es lo
   *       mismo: dos municipios vecinos con poco cada uno forman una concentración que ni la
   *       coropleta ni los símbolos enseñan.</li>
   * </ul>
   *
   * Los identificadores internos se quedan como estaban —`cobertura`, `practicas_territorios`—
   * porque los lee el lienzo de Leaflet en varios sitios; lo que cambia es cómo se llaman en
   * pantalla, que es lo que se pidió.
   */
  readonly modosDeDibujo: readonly { id: ModoDeDibujo; etiqueta: string; descripcion: string }[] = [
    {
      id: 'cobertura' as const,
      etiqueta: 'Coropletas',
      descripcion: 'Colorea cada departamento según cuántos registros tiene. Ojo: un departamento grande pesa más en la vista aunque tenga menos.',
    },
    {
      id: 'practicas_territorios' as const,
      etiqueta: 'Símbolos proporcionales',
      descripcion: 'Un círculo por municipio, del tamaño de su cifra. No depende de lo grande que sea el territorio.',
    },
    {
      id: 'calor' as const,
      etiqueta: 'Mapa de calor',
      descripcion: 'Superficie continua de densidad: enseña dónde se concentra la actividad, sin depender de los límites administrativos.',
    },
  ];

  /**
   * El radio de influencia de cada proceso, en píxeles de pantalla.
   *
   * EN PIXELES Y NO EN KILOMETROS, con la leyenda diciendo a cuántos kilómetros equivale en esta
   * vista. El porqué está entero en `capa-de-calor.ts`: un radio en metros a escala nacional pinta
   * el 1 % del lienzo y no se ve.
   */
  private static readonly RADIO_DEL_CALOR = 28;

  /**
   * Cuántos procesos solapados llegan al tono más oscuro.
   *
   * CUATRO, Y FIJO. Medido contra los datos sembrados: la inmensa
   * mayoría de los municipios con actividad tiene uno o dos procesos, así que el solape real a
   * escala nacional viene de municipios VECINOS y rara vez pasa de cuatro. Con el techo en cinco,
   * la rampa se quedaba casi entera en sus dos primeros escalones y los tres de arriba no se
   * usaban nunca: una leyenda de cinco cuadros para un mapa que sólo pintaba dos.
   *
   * Fijo —y no «el máximo observado»— para que el tono más oscuro signifique lo mismo antes y
   * después de tocar un filtro.
   */
  private static readonly TECHO_DE_SOLAPE = 4;

  /**
   * La leyenda de tamaños del modo de símbolos proporcionales.
   *
   * <b>ESE MODO NO CODIFICA NADA EN EL COLOR, Y SU LEYENDA DECIA LO CONTRARIO.</b> Enseñaba los
   * cinco escalones de la rampa de densidad —«1 a 3», «4 a 6»…— que es la leyenda del coroplético:
   * describía una gradación de color sobre un mapa donde todos los círculos son del mismo color y
   * lo que cambia es el área. Una leyenda que explica la codificación equivocada es peor que no
   * tenerla, porque se lee y se cree.
   *
   * <b>TRES TALLAS Y NO CINCO, Y DIBUJADAS AL TAMAÑO REAL.</b> El ojo no compara cinco áreas de
   * memoria; con el mínimo, un intermedio y el máximo basta para calibrar, que es lo que una
   * leyenda de símbolos proporcionales tiene que dar. Se dibujan con `ladoDelSimbolo`, la misma
   * función que dimensiona los del mapa: si alguien cambia la escala, la leyenda cambia con ella.
   */
  readonly escalonesDeTamano = computed(() => {
    const maximo = this.procesosPorMunicipio().municipios
      .reduce((mayor, municipio) => Math.max(mayor, municipio.total), 0);
    if (maximo <= 0) return [];

    // Cuando el máximo es pequeño no se inventan tallas intermedias que no existen: con un máximo
    // de dos, «1 y 2» es la leyenda completa y honesta.
    const valores = maximo <= 3
      ? Array.from({ length: maximo }, (_, indice) => indice + 1)
      : [1, Math.max(2, Math.round(maximo / 2)), maximo];

    return [...new Set(valores)].map((valor) => ({
      valor,
      lado: this.ladoDelSimbolo(valor, maximo),
    }));
  });

  /** Cuánto mide el radio del calor en el suelo, según la vista actual. La escribe la capa. */
  readonly radioDelCalorEnMetros = signal<number | null>(null);

  /**
   * Los cinco escalones de la leyenda del calor.
   *
   * LOS CALCULA LA PROPIA CAPA a partir del mismo techo con el que pinta, para que no puedan
   * separarse: una leyenda que dice «5 o más» mientras la rampa satura en ocho miente y nadie lo
   * nota hasta que alguien cuenta.
   */
  readonly escalonesDelCalor = computed(() => {
    // EL MISMO COLOR CON EL QUE SE PINTA. Con un grupo resaltado, el calor dibuja su huella en el
    // color del grupo; una leyenda en verde debajo de una mancha morada describe otro mapa.
    const resaltado = this.grupoResaltado();
    const color = (resaltado ? this.coloresDelLente().get(resaltado) : null) ?? this.colorCapaActiva();
    return escalonesDeCalor(MapaEcosistemicoPageComponent.TECHO_DE_SOLAPE, color);
  });

  /** El radio del calor dicho en unidades que alguien lee: «a menos de 12 km». */
  readonly alcanceDelCalor = computed(() => {
    const metros = this.radioDelCalorEnMetros();
    if (metros === null || !Number.isFinite(metros) || metros <= 0) return '';
    const kilometros = metros / 1000;
    if (kilometros < 1) return `${Math.round(metros / 100) * 100} m`;
    return `${kilometros < 10 ? kilometros.toFixed(1) : Math.round(kilometros)} km`;
  });

  // ─────────────── El color del lente sobre el mapa ───────────────
  //
  // <b>ES LO QUE HACE QUE EL LENTE SE VEA.</b> Sin esto, elegir «por territorios sonoros» cambiaba
  // la columna izquierda y el mapa seguía exactamente igual: las gafas puestas y el paisaje sin
  // cambiar. Con el lente activo, cada símbolo toma el color de lo que declara.

  /**
   * La paleta de los grupos del lente.
   *
   * <b>ASIGNADA POR ORDEN Y NO AL AZAR</b>, para que el mismo territorio sonoro tenga el mismo
   * color entre dos cargas de la misma pantalla: un color que baila hace ilegible cualquier
   * comparación. `gruposDelLente` ordena de mayor a menor, así que el orden es estable.
   *
   * Ocho tonos y no más: a partir de ahí nadie distingue dos colores en un mapa, y lo honesto es
   * que el noveno y siguientes compartan el gris de «otros» en vez de fingir que se leen.
   */
  private static readonly PALETA_DEL_LENTE = [
    '#7a2f97', '#00A849', '#c88011', '#5e5ceb', '#d33068', '#109db5', '#6100D7', '#087B3E',
  ];

  private static readonly COLOR_SIN_CLASIFICAR = '#94a3b8';

  /**
   * De qué tamaño se dibuja el símbolo de un municipio.
   *
   * <b>ESCALA POR RAIZ CUADRADA, Y NO ES UN DETALLE.</b> Lo que la vista compara es el AREA del
   * círculo, no su lado: escalando el lado en proporción directa, un municipio con cuatro procesos
   * se vería cuatro veces más ancho y por tanto sesenta veces más grande, y la lectura saldría
   * completamente falseada. Es el error clásico de los símbolos proporcionales y la raíz cuadrada
   * es su corrección conocida.
   *
   * El mínimo de 22 px no es estética: por debajo la cifra no cabe dentro y el símbolo deja de
   * decir cuántos.
   */
  private ladoDelSimbolo(total: number, maximo: number): number {
    if (this.modoDeDibujo() !== 'practicas_territorios') return 30;
    const MINIMO = 22;
    const MAXIMO = 54;
    const proporcion = Math.sqrt(total) / Math.sqrt(Math.max(maximo, 1));
    return Math.round(MINIMO + (MAXIMO - MINIMO) * proporcion);
  }

  /**
   * De qué color se dibuja el símbolo de un municipio.
   *
   * <b>CON EL LENTE PUESTO, EL COLOR ES EL DE LO QUE DECLARA.</b> Sin esto, elegir «por territorios
   * sonoros» cambiaba la columna izquierda y el mapa seguía idéntico: las gafas puestas y el
   * paisaje sin cambiar.
   *
   * <b>UN MUNICIPIO CON VARIOS GRUPOS TOMA EL DEL PRIMERO POR ORDEN DE LA PALETA</b>, que es el
   * mayoritario del ámbito. Un círculo no puede tener dos colores; partirlo en sectores sería otro
   * tipo de mapa —y de los que se leen mal a este tamaño—. El globo del municipio sigue listando
   * todo lo que hay dentro.
   */
  private colorDelSimbolo(fichas: readonly unknown[], colorDeLaCapa: string): string {
    if (this.lenteDeLectura() === 'territorial') {
      return this.coloreaPorTipo() ? this.colorDelTipoDominante(fichas, colorDeLaCapa) : colorDeLaCapa;
    }
    const colores = this.coloresDelLente();
    for (const grupo of this.gruposDelLente()) {
      const presente = fichas.some((ficha) =>
        this.clasificacionDe(ficha as FichaClasificable).includes(grupo.nombre));
      if (presente) return colores.get(grupo.nombre) ?? colorDeLaCapa;
    }
    return colorDeLaCapa;
  }

  /** El color del tipo que más registros pone en el municipio; los empates, por orden de las capas. */
  private colorDelTipoDominante(fichas: readonly unknown[], colorDeRespaldo: string): string {
    const colores = this.colorDelTipoDeRegistro();
    const cuenta = new Map<string, number>();
    for (const ficha of fichas) {
      const color = colores.get(ficha as object);
      if (color) cuenta.set(color, (cuenta.get(color) ?? 0) + 1);
    }
    let mejor = colorDeRespaldo;
    let max = 0;
    for (const [color, n] of cuenta) {
      if (n > max) { mejor = color; max = n; }
    }
    return mejor;
  }

  /** Si el símbolo se atenúa porque hay un grupo resaltado y este municipio no lo tiene. */
  private simboloAtenuado(fichas: readonly unknown[]): boolean {
    if (!this.grupoResaltado()) return false;
    return !fichas.some((ficha) =>
      this.estaResaltada(ficha as FichaClasificable));
  }

  /**
   * Qué grupo del lente predomina en cada departamento.
   *
   * <b>VACIO CON EL LENTE TERRITORIAL</b>, y ese vacío es el que devuelve el coroplético a su
   * lectura de intensidad: sin lente, el color vuelve a decir «cuántos».
   *
   * <b>EL DOMINANTE ES EL MAS DECLARADO, Y LOS EMPATES SE ROMPEN POR ORDEN DEL LENTE</b> —el mismo
   * que reparte los colores— para que dos cargas de la misma pantalla pinten igual. Un mapa cuyo
   * color baila entre recargas no permite comparar nada.
   *
   * <b>«SIN CLASIFICAR» PUEDE GANAR, Y SE PINTA.</b> Un departamento donde la mayoría de los
   * procesos no declara territorio sonoro es un hecho del dato, y el gris de «sin clasificar» lo
   * dice. Dejarlo en blanco lo confundiría con un departamento sin procesos, que es otra cosa.
   */
  readonly grupoDominantePorDepartamento = computed<Record<string, string>>(() => {
    if (this.lenteDeLectura() === 'territorial' || this.departamentoElegido() !== 'Nacional') return {};

    const orden = new Map(this.gruposDelLente().map((grupo, indice) => [grupo.nombre, indice]));
    const conteo: Record<string, Map<string, number>> = {};

    for (const ficha of this.fichasDelDirectorio()) {
      const departamento = MapDomain.normalizeDepartmentName(
        (ficha as { department?: string })?.department ?? '');
      if (!departamento || departamento === 'DESCONOCIDO') continue;
      const porGrupo = (conteo[departamento] ??= new Map<string, number>());
      for (const valor of this.clasificacionDe(ficha)) {
        porGrupo.set(valor, (porGrupo.get(valor) ?? 0) + 1);
      }
    }

    const dominantes: Record<string, string> = {};
    for (const [departamento, porGrupo] of Object.entries(conteo)) {
      let elegido = '';
      let mayor = -1;
      for (const [nombre, total] of porGrupo) {
        const gana = total > mayor
          || (total === mayor && (orden.get(nombre) ?? 99) < (orden.get(elegido) ?? 99));
        if (gana) { elegido = nombre; mayor = total; }
      }
      if (elegido) dominantes[departamento] = elegido;
    }
    return dominantes;
  });

  /** Qué color le toca a cada grupo del lente. Vacío con el lente territorial. */
  readonly coloresDelLente = computed<ReadonlyMap<string, string>>(() =>
    MapaEcosistemicoPageComponent.repartirColores(this.gruposDelLente().map((grupo) => grupo.nombre)));

  /**
   * Reparte la paleta entre una lista de nombres YA ORDENADA.
   *
   * <b>POR ORDEN Y NO POR NOMBRE.</b> Que el color salga de la posición y no de un hash del texto
   * es lo que hace que el mismo territorio sonoro tenga el mismo color entre dos cargas de la misma
   * pantalla: un color que baila hace ilegible cualquier comparación.
   *
   * Es estática para que el mapa y la analítica repartan igual sin depender del lente que haya
   * puesto: la analítica lee las dos dimensiones y el lente sólo tiene una.
   */
  private static repartirColores(nombres: readonly string[]): ReadonlyMap<string, string> {
    return Analitica.repartirColores(
      nombres,
      MapaEcosistemicoPageComponent.PALETA_DEL_LENTE,
      MapaEcosistemicoPageComponent.COLOR_SIN_CLASIFICAR,
    );
  }

  /** El modo activo, para decir bajo las pastillas qué dibuja el que está elegido. */
  readonly modoDeDibujoActivo = computed(() =>
    this.modosDeDibujo.find((modo) => modo.id === this.modoDeDibujo()) ?? this.modosDeDibujo[0]);

  /**
   * Qué dibuja el modo activo AHORA MISMO, que no siempre es lo que dice su descripción fija.
   *
   * <b>EL LENTE CAMBIA LO QUE SIGNIFICA EL COLOR, y la descripción se quedaba con la versión sin
   * lente.</b> «Colorea cada departamento según cuántos registros tiene» es cierto con el lente
   * territorial y falso con el de territorios sonoros, donde el color dice cuál predomina y no
   * cuántos hay. Lo mismo el calor, que pasa de una nube única a una serie por grupo. Es el mismo
   * descuido que ya se corrigió en la leyenda y en los escalones: el texto describía un estado que
   * la pantalla había dejado atrás.
   */
  readonly loQueDibujaAhora = computed(() => {
    const modo = this.modoDeDibujoActivo();
    if (this.lenteDeLectura() === 'territorial') return modo.descripcion;

    if (modo.id === 'cobertura') {
      return 'Colorea cada departamento según qué grupo se declara más ahí. El color dice cuál, '
        + 'no cuántos: para las cifras, la lista de abajo.';
    }
    if (modo.id === 'calor') {
      return 'Una superficie por grupo, cada una de su color. Las manchas no siguen los límites de '
        + 'los departamentos: siguen dónde está el proceso.';
    }
    return 'Un círculo por municipio, del tamaño de su cifra y del color de lo que declara.';
  });

  elegirModoDeDibujo(id: 'cobertura' | 'practicas_territorios' | 'calor'): void {
    this.modoDeDibujo.set(id);
    // LOS DOS MODOS DE PUNTO NECESITAN EL CATALOGO MUNICIPAL, y el coroplético no: pedirlo siempre
    // añadiría una descarga al arranque para quien no salga nunca del mapa por departamentos.
    if (id === 'practicas_territorios' || id === 'calor') this.cargarPuntosMunicipales();
  }

  // ─────────────── La Agenda del territorio abierto ───────────────
  //
  // <b>NO ES UNA CAPA: ES CONTEXTO.</b> se acotó:
  // «al filtrar por territorio sonoro o práctica no tiene sentido tener los eventos; al hacer algo
  // más superficial, como cliquear dentro de un departamento, sí tendría sentido. Podemos habilitar
  // o deshabilitar esa sección según sea conveniente».
  //
  // Es la distinción justa. Un filtro por práctica musical es una pregunta sobre CÓMO se clasifica
  // lo que hay, y un evento no se clasifica así. Abrir un departamento es una pregunta sobre QUÉ
  // pasa ahí, y ahí la agenda es exactamente la respuesta.

  /**
   * Si la pestaña de Agenda tiene algo que decir ahora mismo.
   *
   * <b>DEVOLVIA `true` FIJO.</b> Se escribió cuando la clasificación eran dos desplegables que
   * filtraban, y la condición que iba a leer —«hay un territorio sonoro o una práctica puestos»—
   * desapareció al convertirlos en lente. Nadie la tradujo: quedó una constante con la explicación
   * de una regla que ya no aplicaba nada, y la pestaña seguía encendida en el único caso en que el
   * dirección de producto había pedido apagarla.
   *
   * <b>LO QUE APAGA LA AGENDA ES RESALTAR UN GRUPO, NO PONERSE EL LENTE.</b> Es la traducción
   * exacta de la regla al modelo nuevo, y la diferencia importa: ponerse las gafas de «territorios
   * sonoros» no esconde nada —se sigue viendo todo, reagrupado—, así que la agenda del territorio
   * sigue siendo una respuesta válida. Pulsar «Joropo» sí convierte la pregunta en clasificatoria,
   * y un evento no se clasifica por práctica ni por territorio sonoro: enseñarlo ahí afirmaría que
   * esos eventos son de joropo.
   */
  agendaDisponible = computed(() =>
    this.lenteDeLectura() === 'territorial' || this.grupoResaltado() === '');

  /**
   * Qué tramo de la agenda se está mirando.
   *
   * <b>ES EL UNICO FILTRO QUE LA AGENDA NO COMPARTE CON LOS PROCESOS</b>, y era el que le faltaba:
   * un Festival no tiene fecha, un evento sí, y acotar por fecha es lo primero que se le pide a una
   * agenda.
   *
   * <b>«PROXIMOS» POR OMISION, PERO CON UNA SALIDA.</b> Septiembre dejó escrito el defecto que hay
   * que evitar: «un panel titulado Eventos próximos y filtrado por fecha futura sale vacío siempre
   * que la base no tenga eventos por venir, y un panel vacío se lee como una agenda rota». Por eso
   * `eventosDelAmbito` cae a «todos» cuando «próximos» no encuentra ninguno, en vez de enseñar el
   * vacío.
   */
  readonly rangoDeAgenda = signal<'proximos' | 'mes' | 'todos'>('proximos');

  readonly rangosDeAgenda = [
    { id: 'proximos' as const, etiqueta: 'Próximos' },
    { id: 'mes' as const, etiqueta: 'Este mes' },
    { id: 'todos' as const, etiqueta: 'Todos' },
  ];

  /**
   * Los eventos del ámbito abierto, ordenados por cercanía a hoy.
   *
   * <b>POR CERCANIA Y NO POR FECHA BRUTA.</b> Ordenar ascendente pondría arriba el evento más
   * antiguo de la base, que es lo menos útil de una agenda. Así arriba queda lo que está a punto de
   * pasar —o lo que acaba de pasar—, que es lo que se busca aquí.
   *
   * <b>Y SE ROTULA «AGENDA», NO «PROXIMOS».</b> Un panel de «eventos próximos» filtrado por fecha
   * futura sale vacío siempre que la base no tenga eventos por venir, y un panel vacío se lee como
   * una agenda rota.
   */
  eventosDelAmbito = computed(() => {
    if (!this.agendaDisponible()) return [];

    const porDepartamento = this.agendaPorDepartamento();
    const delAmbito = this.departamentoElegido() === 'Nacional'
      ? Object.values(porDepartamento).flat()
      : (porDepartamento[this.departamentoNormalizado() || ''] ?? []);

    const hoy = Date.now();
    const rango = this.rangoDeAgenda();
    const enRango = delAmbito.filter((evento) => {
      if (rango === 'todos') return true;
      const cuando = Date.parse(evento.fecha);
      if (Number.isNaN(cuando)) return false;
      if (rango === 'proximos') return cuando >= hoy;
      const ahora = new Date();
      const cuandoFecha = new Date(cuando);
      return cuandoFecha.getFullYear() === ahora.getFullYear() && cuandoFecha.getMonth() === ahora.getMonth();
    });

    // LA SALIDA AL VACIO. Si el tramo elegido no tiene ninguno, se enseñan todos en vez de una
    // lista vacía que se leería como «aquí no pasa nada». El botón sigue marcando lo que se pidió.
    const aEnseñar = enRango.length > 0 ? enRango : delAmbito;

    return [...aEnseñar].sort((uno, otro) => {
      const unoMs = Date.parse(uno.fecha);
      const otroMs = Date.parse(otro.fecha);
      if (Number.isNaN(unoMs) && Number.isNaN(otroMs)) return 0;
      // SIN FECHA LEGIBLE VA AL FINAL, no arriba: un evento sin fecha no es el más próximo.
      if (Number.isNaN(unoMs)) return 1;
      if (Number.isNaN(otroMs)) return -1;
      return Math.abs(unoMs - hoy) - Math.abs(otroMs - hoy);
    });
  });

  isSchoolsLayer = computed(() => this.capaActiva() === 'Escuelas de Música');
  isMarketsLayer = computed(() => this.capaActiva() === 'Mercados Musicales');
  isRedesLayer = computed(() => this.capaActiva() === 'Redes de Documentación');
  isLutieresLayer = computed(() => this.capaActiva() === 'Lutieres');
  isEspaciosLayer = computed(() => this.capaActiva() === 'Espacios');

  configuracionDeLaCapa = computed(() => {
    return MAP_LAYERS_CONFIG.find((layer) => layer.layerKey === this.capaActiva()) || MAP_LAYERS_CONFIG[0];
  });

  festivalesPorDepartamento = computed(() => {
    const records = this.registrosDeFestivales();
    
    return records.reduce((acc: any, record: any) => {
      const deptRaw = record?.fields?.dpt ?? record?.fields?.dpto ?? record?.fields?.departamento ?? record?.fields?.department;
      const deptName = Array.isArray(deptRaw) ? deptRaw[0] : (deptRaw || 'Desconocido');
      const normalized = MapDomain.normalizeDepartmentName(MapDomain.resolveDepartmentNameFromRecord(record, deptName));
      if (!normalized || normalized === 'DESCONOCIDO') return acc;

      const genre = record?.fields?.género_musical || record?.fields?.genero_musical || '';
      const desc = record?.fields?.descripción || record?.fields?.descripcion || record?.fields?.desc || '';

      /*
       * AQUI SE FILTRABA POR TERRITORIO SONORO Y POR PRACTICA, Y TENIA DOS PROBLEMAS.
       *
       * EL DE FONDO: no son filtros. está definido
       * —«una cosa es cómo se representa el mapa, y otra las gafas que me quiero poner para
       * verlo»—. Son un LENTE: reagrupan lo que hay, no lo restan. Ver `lenteDeLectura`.
       *
       * EL DE EJECUCION, que solo se vio al ir a quitarlo: el filtro NO leía la clasificación
       * declarada. Comparaba palabras clave contra `genre + desc`, o sea contra el TEXTO LIBRE del
       * registro. Un Festival que declara «Joropo» en `Territorios sonoros` quedaba fuera al
       * filtrar por Joropo si esa palabra no aparecía escrita en su descripción. El dato existía
       * —la ficha lo enseña— y quien filtraba obtenía una respuesta falsa sin saberlo.
       */

      if (!acc[normalized]) acc[normalized] = [];
      acc[normalized].push({
        // Sin esto la ficha publica del festival es inalcanzable: este objeto
        // literal se construye campo a campo y no copiaba el identificador, asi
        // que `fichasDelDirectorio` caia siempre en su respaldo sintetico
        // `fest-<nombre>-<municipio>`, que ningun endpoint sabe resolver.
        id: record?.id || '',
        department: MapDomain.resolveDepartmentNameFromRecord(record, deptName),
        departmentCode: MapDomain.normalizeDepartmentCode(record?.fields?.departmentCode || record?.fields?.DepartmentCode || record?.fields?.dpto_ccdgo),
        // EL CODIGO DEL MUNICIPIO SE RESUELVE POR NOMBRE CUANDO NO VIENE, y esto era un modo de
        // mapa entero sin dibujar. La lectura pública de Festivales entrega el municipio por
        // NOMBRE —«ARAUQUITA»—, no por código DIVIPOLA; este objeto lo buscaba en tres claves que
        // esa lectura no trae, lo dejaba vacío, y `agruparProcesosPorMunicipio` mandaba el registro
        // a «sin código». Resultado: los símbolos proporcionales no pintaban NI UNO, en silencio,
        // desde que la fuente pasó a ser la ruta pública.
        municipalityCode: MapDomain.normalizeMunicipalityCode(
          record?.fields?.municipalityCode || record?.fields?.divipola || record?.fields?.mpio_cdpmp)
          || this.codigoDeMunicipioPorNombre(record?.fields?.municipio, deptName),
        name: MapDomain.getFestivalRecordName(record),
        municipality: record?.fields?.municipio || '',
        description: desc,
        genre: genre,
        month: record?.fields?.mes_de_realización || record?.fields?.mes_de_realizacion || '',
        versions: record?.fields?.versiones || '',
        organizer: record?.fields?.organizador || record?.fields?.organizer || record?.fields?.responsable || record?.fields?.entidad_responsable || '',
        contactEmail: record?.fields?.contacto_email || record?.fields?.email || '',
        contactPhone: record?.fields?.contacto_telefono || record?.fields?.telefono || '',
        websiteUrl: record?.fields?.sitio_web || '',
        coverageLevel: record?.fields?.coverageLevel || record?.fields?.cobertura_nivel || '',
        // LA CLASIFICACION DECLARADA, QUE NO SE ARRASTRABA HASTA AQUI. La lectura pública la
        // entrega resuelta por nombre y la ficha del registro la enseña, pero este objeto —que es
        // el que alimenta el directorio y los marcadores— se construye campo a campo y no la
        // copiaba. Con el lente puesto, TODO caía en «Sin clasificar»: el dato existía y el mapa
        // no lo veía. Es el mismo descuido que dejó el identificador fuera en su día.
        linkedSonorousTerritories: record?.fields?.['Territorios sonoros'] || '',
        practices: record?.fields?.['Prácticas musicales'] || '',
        // LA PRESENCIA PUBLICA COMPLETA Y EL CUANDO. Los cinco cruzan el contrato público desde
        // siempre —o desde ahora, en el caso de las fechas— y este objeto no los copiaba, así que
        // la ficha del mapa enseñaba dos secciones casi vacías con el dato al otro lado del cable.
        instagramUrl: record?.fields?.instagram || '',
        facebookUrl: record?.fields?.facebook || '',
        otherUrl: record?.fields?.otro_enlace || '',
        periodicity: record?.fields?.periodicidad || '',
        periodicityDetail: record?.fields?.periodicidad_detalle || '',
        startDate: record?.fields?.fecha_inicio || '',
        endDate: record?.fields?.fecha_fin || '',
        specificLocation: record?.fields?.ubicacion_especifica || '',
        contact: [record?.fields?.contacto_email || record?.fields?.email || '', record?.fields?.contacto_telefono || record?.fields?.telefono || ''].filter(Boolean).join(' · '),
      });
      return acc;
    }, {});
  });

  /**
   * Los eventos agrupados por departamento.
   *
   * <b>SIGUE LA MISMA REGLA QUE FESTIVALES</b> —resolver el departamento probando las cuatro claves
   * y normalizar el nombre— porque es el mismo mapa contando sobre el mismo territorio.
   *
   * <b>UN FILTRO POR PRACTICA O POR TERRITORIO SONORO DEJA LA AGENDA FUERA, y es lo correcto.</b>
   * Un evento no se clasifica por práctica musical ni por territorio sonoro: no es que tenga ese
   * dato en blanco, es que no lo tiene. Dejarlo pasar cuando alguien filtra por «Bambuco» diría que
   * ese evento es de bambuco, que es justo lo que no se sabe.
   */
  /** La tarjeta del directorio que está expandida (su clave de capa e id), o vacío. Una a la vez. */
  readonly fichaAbiertaDelDirectorio = signal('');

  alternarFichaDelDirectorio(item: any): void {
    const clave = this.claveDeFicha(item);
    this.fichaAbiertaDelDirectorio.set(this.fichaAbiertaDelDirectorio() === clave ? '' : clave);
  }

  /** «Municipio, Departamento» de un registro del directorio. */
  detalleTerritorialDelRegistro(item: any): string {
    const municipio = item?.record?.municipality || item?.record?.municipio || '';
    return [municipio, item?.department]
      .map((parte) => nombrePropio(parte || ''))
      .filter((parte) => parte.length > 0)
      .join(', ');
  }

  /** «Municipio, Departamento» del evento (lo que se ve al abrir su tarjeta), o lo que haya si falta alguno. */
  territorioDelEvento(evento: EventoEnElMapa): string {
    return [evento.municipality, evento.department]
      .map((parte) => nombrePropio(parte || ''))
      .filter((parte) => parte.length > 0)
      .join(', ');
  }

  agendaPorDepartamento = computed<Record<string, EventoEnElMapa[]>>(() => {
    const records = this.registrosDeAgenda();

    return records.reduce((acc: Record<string, EventoEnElMapa[]>, record: RegistroCrudo) => {
      const deptName = campo(record, 'dpt') || campo(record, 'departamento') || 'Desconocido';
      const normalized = MapDomain.normalizeDepartmentName(MapDomain.resolveDepartmentNameFromRecord(record, deptName));
      if (!normalized || normalized === 'DESCONOCIDO') return acc;

      if (!acc[normalized]) acc[normalized] = [];
      acc[normalized].push({
        id: record?.id || '',
        department: MapDomain.resolveDepartmentNameFromRecord(record, deptName),
        departmentCode: '',
        municipalityCode: '',
        name: campo(record, 'name') || 'Evento sin título',
        municipality: campo(record, 'municipio'),
        description: campo(record, 'desc'),
        organizer: campo(record, 'organizador'),
        websiteUrl: campo(record, 'sitio_web'),
        coverageLevel: campo(record, 'coverageLevel'),
        // LO PROPIO DE UN EVENTO. La ficha del mapa los enseña; un Festival no los tiene.
        fecha: campo(record, 'fecha'),
        modalidad: campo(record, 'modalidad'),
        lugar: campo(record, 'lugar'),
        categoria: campo(record, 'categoria'),
        slug: campo(record, 'slug'),
        proceso: campo(record, 'procesoTipo') && Number(campo(record, 'procesoId'))
          ? {
            tipo: campo(record, 'procesoTipo'), id: Number(campo(record, 'procesoId')), nombre: campo(record, 'procesoNombre'),
            organizacionId: Number(campo(record, 'organizacionId')) || null, organizacionNombre: campo(record, 'organizacionNombre') || null,
          }
          : null,
      });
      return acc;
    }, {} as Record<string, EventoEnElMapa[]>);
  });

  escuelasPorDepartamento = computed(() => {
    const records = this.registrosDeEscuelas();
    const selectedSonorousTerritory = this.selectedSonorousTerritory();
    const selectedPractice = this.selectedPractice();

    return records.reduce((acc: any, record: any) => {
      const normalized = MapDomain.normalizeDepartmentName(record?.department);
      if (!normalized || normalized === 'DESCONOCIDO') return acc;

      const sonorous = record?.linkedSonorousTerritories || '';
      const practices = record?.practices || '';
      const desc = record?.description || '';

      // Apply Filters
      if (selectedSonorousTerritory !== 'Todos') {
        const textToCheck = `${sonorous} ${practices} ${desc}`;
        if (!MapDomain.matchesSonorousTerritory(selectedSonorousTerritory, textToCheck)) return acc;
      }
      if (selectedPractice !== 'Todas') {
        const textToCheck = `${practices} ${desc}`;
        if (!MapDomain.matchesPracticeMusical(selectedPractice, textToCheck)) return acc;
      }

      if (!acc[normalized]) acc[normalized] = [];
      acc[normalized].push(record);
      return acc;
    }, {});
  });

  mercadosPorDepartamento = computed(() => {
    const records = this.registrosDeMercados();
    const selectedSonorousTerritory = this.selectedSonorousTerritory();
    const selectedPractice = this.selectedPractice();

    return records.reduce((acc: any, record: any) => {
      const normalized = MapDomain.normalizeDepartmentName(record?.department);
      if (!normalized || normalized === 'DESCONOCIDO') return acc;

      const desc = record?.description || '';
      const linked = record?.linkedFestival || '';

      // Apply Filters
      if (selectedSonorousTerritory !== 'Todos') {
        const textToCheck = `${desc} ${linked}`;
        if (!MapDomain.matchesSonorousTerritory(selectedSonorousTerritory, textToCheck)) return acc;
      }
      if (selectedPractice !== 'Todas') {
        const textToCheck = `${desc}`;
        if (!MapDomain.matchesPracticeMusical(selectedPractice, textToCheck)) return acc;
      }

      if (!acc[normalized]) acc[normalized] = [];
      acc[normalized].push(record);
      return acc;
    }, {});
  });

  redesPorDepartamento = computed(() => {
    const records = this.registrosDeRedes();
    const selectedSonorousTerritory = this.selectedSonorousTerritory();
    const selectedPractice = this.selectedPractice();

    return records.reduce((acc: any, record: any) => {
      const normalized = MapDomain.normalizeDepartmentName(record?.department);
      if (!normalized || normalized === 'DESCONOCIDO') return acc;

      const sonorous = record?.linkedSonorousTerritories || '';
      const desc = record?.description || '';

      // Apply Filters
      if (selectedSonorousTerritory !== 'Todos') {
        const textToCheck = `${sonorous} ${desc}`;
        if (!MapDomain.matchesSonorousTerritory(selectedSonorousTerritory, textToCheck)) return acc;
      }
      if (selectedPractice !== 'Todas') {
        const textToCheck = `${desc} ${record.centerType}`;
        if (!MapDomain.matchesPracticeMusical(selectedPractice, textToCheck)) return acc;
      }

      if (!acc[normalized]) acc[normalized] = [];
      acc[normalized].push(record);
      return acc;
    }, {});
  });

  lutieresPorDepartamento = computed(() => {
    const records = this.registrosDeLutieres();
    const selectedSonorousTerritory = this.selectedSonorousTerritory();
    const selectedPractice = this.selectedPractice();

    return records.reduce((acc: any, record: any) => {
      const normalized = MapDomain.normalizeDepartmentName(record?.department);
      if (!normalized || normalized === 'DESCONOCIDO') return acc;

      const oficio = record?.oficio || '';
      const desc = record?.description || '';

      // Apply Filters
      if (selectedSonorousTerritory !== 'Todos') {
        const textToCheck = `${oficio} ${desc}`;
        if (!MapDomain.matchesSonorousTerritory(selectedSonorousTerritory, textToCheck)) return acc;
      }
      if (selectedPractice !== 'Todas') {
        const textToCheck = `${oficio} ${desc}`;
        if (!MapDomain.matchesPracticeMusical(selectedPractice, textToCheck)) return acc;
      }

      if (!acc[normalized]) acc[normalized] = [];
      acc[normalized].push(record);
      return acc;
    }, {});
  });

  espaciosPorDepartamento = computed(() => {
    const records = this.registrosDeEspacios();
    const selectedSonorousTerritory = this.selectedSonorousTerritory();
    const selectedPractice = this.selectedPractice();

    return records.reduce((acc: Record<string, NetworkRecord[]>, record: NetworkRecord) => {
      const normalized = MapDomain.normalizeDepartmentName(record.department);
      if (!normalized || normalized === 'DESCONOCIDO') return acc;

      const tipo = String(record['centerType'] ?? '');
      const desc = String(record['description'] ?? '');

      if (selectedSonorousTerritory !== 'Todos') {
        if (!MapDomain.matchesSonorousTerritory(selectedSonorousTerritory, `${tipo} ${desc}`)) return acc;
      }
      if (selectedPractice !== 'Todas') {
        if (!MapDomain.matchesPracticeMusical(selectedPractice, `${tipo} ${desc}`)) return acc;
      }

      (acc[normalized] ??= []).push(record);
      return acc;
    }, {});
  });

  resumenPorDepartamento = computed(() => {
    return MapDomain.buildDepartmentSummaryMap(
      this.conteosDeBase(),
      this.festivalesPorDepartamento(),
      this.escuelasPorDepartamento(),
      this.mercadosPorDepartamento(),
      this.redesPorDepartamento(),
      this.lutieresPorDepartamento(),
      this.espaciosPorDepartamento()
    );
  });

  generalCounts = computed(() => {
    return Object.entries(this.resumenPorDepartamento()).reduce((acc: any, [departmentName, stats]: any) => {
      acc[departmentName] = stats.totalRecords;
      return acc;
    }, {});
  });

  festivalAnalytics = computed(() => MapDomain.buildLayerAnalytics(this.festivalCounts(), this.registrosDeFestivales(), this.departamentoElegido()));
  schoolAnalytics = computed(() => MapDomain.buildLayerAnalytics(this.schoolCounts(), this.registrosDeEscuelas(), this.departamentoElegido()));
  marketAnalytics = computed(() => MapDomain.buildLayerAnalytics(this.marketCounts(), this.registrosDeMercados(), this.departamentoElegido()));
  redesAnalytics = computed(() => MapDomain.buildLayerAnalytics(this.redesCounts(), this.registrosDeRedes(), this.departamentoElegido()));
  lutieresAnalytics = computed(() => MapDomain.buildLayerAnalytics(this.lutieresCounts(), this.registrosDeLutieres(), this.departamentoElegido()));
  espaciosAnalytics = computed(() => MapDomain.buildLayerAnalytics(this.espaciosCounts(), this.registrosDeEspacios(), this.departamentoElegido()));
  generalAnalytics = computed(() => MapDomain.buildLayerAnalytics(this.generalCounts(), [], this.departamentoElegido()));

  activeAnalytics = computed(() => {
    if (this.esCapaGeneral()) return this.generalAnalytics();
    if (this.isSchoolsLayer()) return this.schoolAnalytics();
    if (this.isMarketsLayer()) return this.marketAnalytics();
    if (this.isRedesLayer()) return this.redesAnalytics();
    if (this.isLutieresLayer()) return this.lutieresAnalytics();
    if (this.isEspaciosLayer()) return this.espaciosAnalytics();
    return this.festivalAnalytics();
  });

  conteosDeLaCapaActiva = computed(() => {
    if (this.esCapaGeneral()) return this.generalCounts();
    if (this.isSchoolsLayer()) return this.schoolCounts();
    if (this.isMarketsLayer()) return this.marketCounts();
    if (this.isRedesLayer()) return this.redesCounts();
    if (this.isLutieresLayer()) return this.lutieresCounts();
    if (this.isEspaciosLayer()) return this.espaciosCounts();
    return this.festivalCounts();
  });

  // AQUI VIVIA `thematicPoints`, y con el la posicion inventada. Calculaba el sitio de
  // cada proceso como el centroide de su DEPARTAMENTO mas una espiral cuyo angulo y
  // radio salian del INDICE DEL REGISTRO EN EL ARRAY:
  //
  //     const angle = (index * 0.72) % (2 * Math.PI);
  //     const radius = 0.08 + ((index * 0.03) % 0.14);
  //     lat = centroid[0] + Math.sin(angle) * radius;
  //
  // Reordenar los datos movia los puntos por el mapa. Lo sustituye
  // `procesosPorMunicipio`, que situa cada proceso en el punto real de su municipio y
  // dice cuando no puede situarlo, en vez de inventarse un sitio.

  // ---------------------------------------------------------------------------
  // LA LEYENDA DEL MODO (29 de agosto de 2026)
  //
  // AQUI HABIA `activeLegendItems`, Y NO LA PINTABA NADIE. `grep -rn activeLegendItems
  // src/` devolvia UNA sola linea: su propia declaracion. Treinta y cinco lineas de
  // codigo calculando una leyenda que ninguna plantilla enlazaba. No se «sustituye» por
  // respeto a una deuda: se borra y se escribe la que si se pinta.
  //
  // LAS CIFRAS SE CALCULAN, NO SE ESCRIBEN. Poner «155 procesos» como texto caduca sola
  // y, peor, no la sostiene la tuberia: los filtros y los descartes cambian el numero.
  // ---------------------------------------------------------------------------

  readonly leyendaDelModo = computed(() => {
    // EL COROPLETICO NO DIBUJA MUNICIPIOS, así que no se le pregunta por ellos. Contaba su leyenda
    // con el agrupador municipal y decía «0 procesos · 0 municipios» sobre un mapa con dos
    // departamentos pintados, y añadía «2 sin situar: no se pudo cargar la tabla de municipios» por
    // una tabla que ese modo ni pide. Cada modo responde con lo que de verdad pone en pantalla.
    const porMunicipios = this.modoDeDibujo() !== 'cobertura';
    const resaltado = this.grupoResaltado();
    // Si el coroplético está tiñendo por el lente, el color es una categoría y no una intensidad.
    const tinteDelLente = this.modoDeDibujo() === 'cobertura'
      && Object.keys(this.grupoDominantePorDepartamento()).length > 0;
    // Con lente o con color por tipo, el calor son varias series de colores: una rampa de un solo tono no las explica.
    const calorConLente = this.modoDeDibujo() === 'calor' && (this.lenteDeLectura() !== 'territorial' || this.coloreaPorTipo());
    // SOLO LOS NO SITUADOS. Los municipios agrupados los leía la línea de recuento que se retiró;
    // lo que la leyenda sigue necesitando del agrupador son sus tres causas de «sin situar», que es
    // lo único que ninguna otra parte de la columna dice.
    const noSituados = porMunicipios
      ? this.procesosPorMunicipio().noSituados
      : { catalogoNoDisponible: 0, sinCodigo: 0, municipioSinPunto: 0 };

    // AQUI SE CONTABAN LOS PROCESOS DIBUJADOS Y LOS DEPARTAMENTOS CON REGISTROS, para la línea de
    // recuento de la leyenda. Esa línea se retiró: era la tercera vez que la misma cifra aparecía en
    // la columna —la pastilla de la capa, la lista de grupos y esto—, y una leyenda que repite
    // alarga sin añadir. Con ella se fue la cuenta, que no tenía otro consumidor.


    // LA ETIQUETA LA DA EL LENTE, no dos filtros que ya no existen. Decía «Todos los territorios
    // sonoros» leyendo `selectedSonorousTerritory`, que quedó huérfano al convertir la
    // clasificación en lente: la leyenda anunciaba un filtro que la pantalla ya no ofrecía.
    const etiqueta = resaltado || this.lenteActivo().etiqueta;

    // Las tres causas van SEPARADAS y solo si su cifra es mayor que cero. Fundirlas en
    // «N sin ubicar» las hace inarreglables: son tres fallos con tres responsables.
    const avisos: { clave: string; texto: string }[] = [];
    if (noSituados.catalogoNoDisponible > 0) {
      avisos.push({
        clave: 'catalogo',
        texto: `${noSituados.catalogoNoDisponible} sin situar: no se pudo cargar la tabla de municipios`,
      });
    }
    if (noSituados.sinCodigo > 0) {
      avisos.push({ clave: 'sin_codigo', texto: `${noSituados.sinCodigo} sin código de municipio` });
    }
    if (noSituados.municipioSinPunto > 0) {
      avisos.push({
        clave: 'sin_punto',
        texto: `${noSituados.municipioSinPunto} con municipio sin punto en la tabla`,
      });
    }

    return {
      etiqueta,
      // CADA MODO TIENE SU PROPIA ESCALA Y SU PROPIA LEYENDA. El coroplético y los símbolos se
      // leen contra el máximo del ámbito; el calor, contra un techo fijo, porque su color tiene
      // que significar lo mismo antes y después de tocar un filtro.
      // EN SIMBOLOS, LOS ESCALONES DE COLOR NO APLICAN: los sirve `tamanos`, aparte, porque son
      // círculos y no cuadros de color y la plantilla los dibuja de otra manera.
      // LOS ESCALONES DE COLOR SOLO EXISTEN CUANDO EL COLOR ES UNA INTENSIDAD.
      //
      // Tres de los cuatro casos no lo son, y ponerles debajo una rampa de cinco tonos es una
      // leyenda que describe otro mapa:
      //   · Símbolos proporcionales: el color no codifica nada —lo hace el área— y lo dicen
      //     `tamanos`, que dibuja tres círculos al tamaño real.
      //   · Coroplético con lente: el color es una categoría, no una gradación.
      //   · Calor con lente: se pinta una serie por grupo, con el color de cada uno; una rampa de
      //     un solo tono no puede explicar siete colores.
      // En los tres, quien explica el mapa es la lista de grupos, que está justo debajo.
      escalones:
        this.modoDeDibujo() === 'practicas_territorios' || tinteDelLente || calorConLente
          ? []
          : this.modoDeDibujo() === 'calor'
            ? this.escalonesDelCalor().map((escalon) => ({
                label: `${escalon.etiqueta} ${escalon.desde === 1 ? 'proceso' : 'procesos'} cerca`,
                color: escalon.color,
                opacity: 1,
              }))
            : MapDomain.buildDynamicDensitySteps(this.capaActiva(), this.maximoDelModo()),
      tamanos: this.modoDeDibujo() === 'practicas_territorios' ? this.escalonesDeTamano() : [],
      // EN «VISTA GENERAL» EL COLOR ES EL TIPO DE REGISTRO: la leyenda lo dice con una lista corta.
      tipos: this.tiposDelDibujo(),
      // LOS GRUPOS DEL LENTE VIVEN EN LA LEYENDA, Y EN UN SOLO SITIO.
      //
      // Estaban DOS VECES en la misma columna: como lista de botones en «Cómo leerlo» y otra vez
      // como escalones de la leyenda cuando el coroplético tiñe por el lente. Los mismos catorce
      // nombres con los mismos catorce colores, uno encima del otro, gastando el doble de altura
      // —que es justo lo que obligaba a deslizar— y con la incómoda pregunta de cuál de las dos
      // manda. Manda la leyenda: un mapa por color se lee por su leyenda.
      //
      // SE SIRVEN CON LENTE PUESTO SEA CUAL SEA EL MODO. El coroplético los usa como categorías, y
      // los símbolos y el calor toman de ahí su color: en los tres casos la leyenda es la misma.
      grupos: this.lenteDeLectura() === 'territorial' ? [] : this.gruposDelLenteVisibles().grupos,
      gruposOcultos: this.lenteDeLectura() === 'territorial' ? 0 : this.gruposDelLenteVisibles().ocultos,
      // Dos lineas de procedencia, porque las dos cosas que el mapa afirma —donde esta y
      // de que practica es— salen de procedimientos que el usuario merece conocer.
      procedenciaDePosicion: !porMunicipios
        // EL COROPLETICO NO SITUA NADA: tiñe el polígono oficial entero. Decir que usa el centroide
        // del municipio afirmaría una precisión que ese dibujo no tiene.
        ? 'Posición: el departamento entero, según el límite oficial del DANE. No sitúa el proceso '
          + 'dentro de él.'
          + (tinteDelLente
            ? ' El color dice cuál es el grupo que más se declara ahí, no cuántos procesos hay.'
            : '')
        : this.modoDeDibujo() === 'calor'
        // EN EL CALOR LA POSICION NO BASTA: hay que decir también qué significa la mancha, porque
        // «cerca» sólo es una cifra cierta si se sabe cuánto mide en esta vista. Cambia al acercarse.
        ? 'Posición: centroide oficial del municipio (DIVIPOLA MGN 2025 del DANE). '
          + (this.alcanceDelCalor() ? `«Cerca» son ${this.alcanceDelCalor()} en esta vista; al acercarte, menos.` : '')
        : 'Posición: centroide oficial del municipio (DIVIPOLA MGN 2025 del DANE). '
          + 'Ubica el municipio, no el proceso.',
      // ANTES DECIA «por coincidencia de texto en el nombre y la descripción», que era cierto de la
      // versión que buscaba palabras sueltas y dejó de serlo al leer el campo declarado. Una línea
      // de procedencia que describe un procedimiento retirado es peor que no tenerla: afirma sobre
      // el dato algo que nadie va a volver a comprobar.
      procedenciaDeClasificacion:
        'Clasificación: territorio sonoro y práctica salen de lo que cada registro declara en su '
        + 'ficha. Lo que no lo declara se cuenta aparte, como «Sin clasificar».',
      avisos,
    };
  });

  festivalesDelDepartamento = computed(() => {
    return this.departamentoElegido() === 'Nacional' ? [] : (this.festivalesPorDepartamento()[this.departamentoNormalizado()] || []);
  });
  escuelasDelDepartamento = computed(() => {
    return this.departamentoElegido() === 'Nacional' ? [] : (this.escuelasPorDepartamento()[this.departamentoNormalizado()] || []);
  });
  mercadosDelDepartamento = computed(() => {
    return this.departamentoElegido() === 'Nacional' ? [] : (this.mercadosPorDepartamento()[this.departamentoNormalizado()] || []);
  });
  redesDelDepartamento = computed(() => {
    return this.departamentoElegido() === 'Nacional' ? [] : (this.redesPorDepartamento()[this.departamentoNormalizado()] || []);
  });
  lutieresDelDepartamento = computed(() => {
    return this.departamentoElegido() === 'Nacional' ? [] : (this.lutieresPorDepartamento()[this.departamentoNormalizado()] || []);
  });

  espaciosDelDepartamento = computed<NetworkRecord[]>(() => {
    return this.departamentoElegido() === 'Nacional' ? [] : (this.espaciosPorDepartamento()[this.departamentoNormalizado()] || []);
  });

  /**
   * Fichas del departamento abierto, indexadas por municipio.
   *
   * Sustituye a `activeMunicipalityCounts`, que contaba mal. Aquel diccionario
   * incrementaba, por cada registro, TANTO la clave del codigo DIVIPOLA como la
   * clave del nombre; y sus dos consumidores —el globo del municipio y el color
   * del municipio— sumaban las dos claves. Un registro con codigo y nombre, que
   * es el caso normal, contaba dos veces: el globo decia «4 procesos
   * registrados» donde habia 2. Se habria visto en cuanto el modal listara los
   * procesos de verdad y no cuadraran con el globo.
   *
   * Se indexa `fichasDelDirectorio`, que ya viene recortado a la capa activa y trae
   * las fichas con la forma que consume el modal de detalle. Asi el globo, el
   * color del municipio, el listado del panel y el modal cuentan lo mismo.
   */
  fichasPorMunicipio = computed(() => {
    const fichas = this.fichasDelDirectorio();
    const porCodigo = new Map<string, typeof fichas>();
    const porNombre = new Map<string, typeof fichas>();

    if (this.departamentoElegido() === 'Nacional') {
      return { porCodigo, porNombre };
    }

    const agregar = (indice: Map<string, typeof fichas>, clave: string, ficha: (typeof fichas)[number]) => {
      const lista = indice.get(clave);
      if (lista) {
        lista.push(ficha);
      } else {
        indice.set(clave, [ficha]);
      }
    };

    for (const ficha of fichas) {
      const registro = ficha?.record || {};
      const codigo = registro.municipalityCode || registro?.fields?.municipalityCode || '';
      const nombre = (registro.municipality || registro.municipio || '').toLowerCase().trim();

      if (codigo) agregar(porCodigo, codigo, ficha);
      if (nombre) agregar(porNombre, nombre, ficha);
    }

    return { porCodigo, porNombre };
  });

  /**
   * Fichas de un municipio. Se prueban las dos claves y se unen SIN duplicar:
   * la misma ficha esta en los dos indices, y como es el mismo objeto, basta
   * descartar las repeticiones por identidad. Ni se cuenta dos veces al que
   * tiene codigo y nombre, ni se pierde al que solo tiene uno de los dos.
   */
  /**
   * Las fichas de un municipio, por codigo y por nombre.
   *
   * SE CONSULTA ADEMAS `fichasPorCodigoMunicipal`, y sin eso los senaladores del Modo de
   * Practicas e Influencia abririan una tarjeta VACIA. `fichasPorMunicipio` devuelve sus
   * dos Map vacios en cuanto `departamentoElegido() === 'Nacional'` —se construyo para la vista
   * de un departamento abierto— y los senaladores viven precisamente en vista nacional.
   */
  fichasDeMunicipio(codigo: string, nombre: string) {
    const indice = this.fichasPorMunicipio();
    const codigoNormalizado = MapDomain.normalizeMunicipalityCode(codigo || '');
    const union = [
      ...(indice.porCodigo.get(codigo || '') || []),
      ...(this.fichasPorCodigoMunicipal().get(codigoNormalizado) || []),
      ...(indice.porNombre.get((nombre || '').toLowerCase().trim()) || []),
    ];
    return union.filter((ficha, posicion) => union.indexOf(ficha) === posicion);
  }

  /**
   * El directorio indexado por codigo municipal NORMALIZADO, sin el guardia de vista
   * nacional.
   *
   * POR CODIGO Y SOLO POR CODIGO: el nombre de municipio se repite entre departamentos
   * —hay mas de un «La Union» en Colombia— y un indice por nombre mezclaria fichas de
   * territorios distintos.
   *
   * NORMALIZADO a cinco digitos porque `fichasPorMunicipio` indexa el codigo EN CRUDO y
   * el senalador lleva el normalizado: «5001» no casa con «05001».
   *
   * La deduplicacion de `fichasDeMunicipio` sigue funcionando porque son los MISMOS
   * objetos de `fichasDelDirectorio`, no copias: `indexOf` los reconoce por identidad.
   */
  private fichasPorCodigoMunicipal = computed(() => {
    const indice = new Map<string, ReturnType<MapaEcosistemicoPageComponent['fichasDelDirectorio']>>();

    for (const ficha of this.fichasDelDirectorio()) {
      const crudo = ficha?.record || {};
      const codigo = MapDomain.normalizeMunicipalityCode(
        crudo.municipalityCode || crudo.divipola || crudo?.fields?.municipalityCode || crudo?.fields?.divipola || '',
      );
      if (!codigo) continue;

      const lista = indice.get(codigo);
      if (lista) lista.push(ficha);
      else indice.set(codigo, [ficha]);
    }

    return indice;
  });

  focusedDepartmentStats = computed(() => {
    return this.departamentoElegido() === 'Nacional' ? null : (this.resumenPorDepartamento()[this.departamentoNormalizado()] || MapDomain.EMPTY_DEPARTMENT_SUMMARY);
  });

  schoolCapacityTotals = computed(() => {
    return MapDomain.buildSchoolCapacityTotals(this.departamentoElegido() === 'Nacional' ? this.registrosDeEscuelas() : this.escuelasDelDepartamento());
  });

  marketCapacityTotals = computed(() => {
    return MapDomain.buildMarketTotals(this.departamentoElegido() === 'Nacional' ? this.registrosDeMercados() : this.mercadosDelDepartamento());
  });

  pulsoTerritorial = computed(() => {
    if (this.departamentoElegido() === 'Nacional') {
      const summary = {
        totalRecords: Object.values(this.resumenPorDepartamento()).reduce((sum, s: any) => sum + (s.totalRecords || 0), 0),
        festivalCount: Object.values(this.resumenPorDepartamento()).reduce((sum, s: any) => sum + (s.festivalCount || 0), 0),
        schoolCount: Object.values(this.resumenPorDepartamento()).reduce((sum, s: any) => sum + (s.schoolCount || 0), 0),
        marketCount: Object.values(this.resumenPorDepartamento()).reduce((sum, s: any) => sum + (s.marketCount || 0), 0),
        redesCount: Object.values(this.resumenPorDepartamento()).reduce((sum, s: any) => sum + (s.redesCount || 0), 0),
        lutierCount: Object.values(this.resumenPorDepartamento()).reduce((sum, s: any) => sum + (s.lutierCount || 0), 0),
        spaceCount: Object.values(this.resumenPorDepartamento()).reduce((sum, s) => sum + (s.spaceCount || 0), 0),
      };
      
      const activeDepts = Object.values(this.resumenPorDepartamento()).filter((s: any) => s.totalRecords > 0).length;

      return {
        totalRecords: summary.totalRecords,
        impactedCount: activeDepts,
        impactedLabel: 'Departamentos impactados',
        layerItems: [
          { key: 'festivals', label: 'Festivales', value: summary.festivalCount, color: this.LAYER_ACCENTS['Festivales'] },
          { key: 'markets', label: 'Mercados', value: summary.marketCount, color: this.LAYER_ACCENTS['Mercados Musicales'] },
          // LUTERÍA ENTRA AL MAPA: los talleres publicados alimentan la capa «Lutieres».
          { key: 'lutiers', label: 'Lutería', value: summary.lutierCount, color: this.LAYER_ACCENTS['Lutieres'] },
          { key: 'spaces', label: 'Espacios', value: summary.spaceCount, color: this.LAYER_ACCENTS['Espacios'] },
          // REDES Y DOCUMENTACIÓN ENTRA AL MAPA: las redes publicadas alimentan la capa «Redes de Documentación».
          { key: 'networks', label: 'Redes doc.', value: summary.redesCount, color: this.LAYER_ACCENTS['Redes de Documentación'] },
        ],
      };
    } else {
      const summary = this.focusedDepartmentStats() || MapDomain.EMPTY_DEPARTMENT_SUMMARY;
      const municipalitiesWithRecords = new Set([
        ...(this.festivalesDelDepartamento() || []).map((item: any) => item.municipality),
        ...(this.escuelasDelDepartamento() || []).map((item: any) => item.municipality),
        ...(this.mercadosDelDepartamento() || []).map((item: any) => item.municipio || item.municipality),
        ...(this.redesDelDepartamento() || []).map((item: any) => item.municipio || item.municipality),
        ...(this.lutieresDelDepartamento() || []).map((item: any) => item.municipio || item.municipality),
        ...this.espaciosDelDepartamento().map((item) => item['municipality'])
      ].filter(Boolean));

      return {
        totalRecords: summary.totalRecords,
        impactedCount: municipalitiesWithRecords.size,
        impactedLabel: 'Municipios impactados',
        layerItems: [
          { key: 'festivals', label: 'Festivales', value: summary.festivalCount, color: this.LAYER_ACCENTS['Festivales'] },
          { key: 'markets', label: 'Mercados', value: summary.marketCount, color: this.LAYER_ACCENTS['Mercados Musicales'] },
          // LUTERÍA ENTRA AL MAPA: los talleres publicados alimentan la capa «Lutieres».
          { key: 'lutiers', label: 'Lutería', value: summary.lutierCount, color: this.LAYER_ACCENTS['Lutieres'] },
          { key: 'spaces', label: 'Espacios', value: summary.spaceCount, color: this.LAYER_ACCENTS['Espacios'] },
          // REDES Y DOCUMENTACIÓN ENTRA AL MAPA: las redes publicadas alimentan la capa «Redes de Documentación».
          { key: 'networks', label: 'Redes doc.', value: summary.redesCount, color: this.LAYER_ACCENTS['Redes de Documentación'] },
        ],
      };
    }
  });

  // ---------------------------------------------------------------------------
  // TABLERO DE TRES COLUMNAS (PNMC-061)
  // ---------------------------------------------------------------------------

  /**
   * Cobertura territorial: cuantos departamentos tienen al menos un registro.
   * Es la cifra de cabecera del panel de lectura, y no la habia calculada:
   * `pulsoTerritorial` da el conteo absoluto pero no la proporcion.
   */
  coberturaTerritorial = computed(() => {
    const resumen = this.resumenPorDepartamento();
    const conRegistros = Object.keys(resumen).filter((clave) => (resumen[clave]?.totalRecords || 0) > 0).length;

    // El divisor son TODOS los departamentos de la cartografia, no solo los que
    // ya aparecen en los datos: contando sobre estos ultimos la cobertura da
    // 100 % siempre y la cifra deja de significar nada.
    //
    // No sirve `departmentsList()`, aunque lo parezca: lee una tabla DIVIPOLA de
    // tiempo de ejecucion que no es una senal, de modo que ese `computed` se
    // evalua una vez —antes de que cargue la cartografia— y se queda cacheado
    // en cero para siempre. `cartografia` si es senal y se recalcula al cargar.
    const total = this.cartografia()?.features?.length || 0;

    return {
      conRegistros,
      total,
      porcentaje: total > 0 ? Math.round((conRegistros / total) * 100) : 0,
    };
  });

  /**
   * Las cinco capas con su conteo vigente y la clave con la que se activan.
   * `pulsoTerritorial` ya trae los conteos pero indexados por una clave propia
   * (`festivals`, `schools`...) que no sirve para `capaActiva`; esto une las
   * dos cosas para que la barra superior sea a la vez cifra y control.
   */
  capasConConteo = computed(() => {
    const porClave: Record<string, number> = {};
    for (const item of this.pulsoTerritorial().layerItems) {
      porClave[item.key] = item.value;
    }

    // LA AGENDA NO ES UNA CAPA, y se corrigió:
    // «tampoco es necesario plantear un botón de agenda como el de festivales; la agenda es algo
    // adicional que aparece en la barra derecha y no un filtro». Y tiene razón: un Festival es un
    // proceso que se filtra y se dibuja; un evento es lo que ESTA PASANDO en el territorio que se
    // acaba de abrir. Vive en la columna de lectura, no entre las capas.
    return [
      { layerKey: 'Festivales', label: 'Festivales', valor: porClave['festivals'] || 0 },
      // MERCADOS MUSICALES SE ENCIENDE. Su capa existía con sus colores y su escala por
      // departamento desde hace meses, y se alimentaba de una lista vacía porque sus tablas se
      // habían retirado; la condición escrita entonces era que «cada proceso volverá con su modelo
      // y su revisión propios», y Mercados volvió con los tres.
      //
      // Y CON ESTO «GENERAL» SE ENCIENDE SOLA: mirar el conjunto pasa a ser una elección real en
      // cuanto hay dos capas, que es exactamente lo que `capasDelGeovisor` ya preveía.
      { layerKey: 'Mercados Musicales', label: 'Mercados', valor: porClave['markets'] || 0 },
      // LUTERÍA, con el mismo recorrido que Mercados: tiene modelo, revisión y directorio público.
      { layerKey: 'Lutieres', label: 'Lutería', valor: porClave['lutiers'] || 0 },
      // ESPACIOS PARA MÚSICA EN VIVO, con el mismo recorrido: modelo, revisión y directorio público.
      { layerKey: 'Espacios', label: 'Espacios', valor: porClave['spaces'] || 0 },
      // REDES Y DOCUMENTACIÓN, con el mismo recorrido: tiene modelo, revisión y directorio público.
      { layerKey: 'Redes de Documentación', label: 'Redes doc.', valor: porClave['networks'] || 0 },
    ].map((capa) => ({ ...capa, color: this.LAYER_ACCENTS[capa.layerKey] }));
  });

  /**
   * La única capa consultable, cuando no hay más de una.
   *
   * <b>CON UNA SOLA CAPA, «GENERAL» Y ESA CAPA SON EL MISMO CONJUNTO.</b> La franja enseñaba dos
   * pastillas —«General 2» y «Festivales 2»— con la misma cifra, los mismos registros y el mismo
   * color, y pulsar una u otra no cambiaba nada en pantalla. Dos controles para un solo estado no
   * son una elección: son una pregunta sin respuestas distintas.
   *
   * <b>NO SE BORRA «GENERAL»: SE OCULTA MIENTRAS SOBRE.</b> El día que vuelva una segunda capa
   * —las cuatro en preparación tienen su sitio anunciado ahí mismo— la elección existe otra vez y
   * las pastillas vuelven solas, sin que haya que reconstruir la franja.
   */
  readonly capaUnica = computed(() => {
    const capas = this.capasConConteo();
    return capas.length === 1 ? capas[0] : null;
  });

  /**
   * Cuántos eventos hay en el ámbito abierto.
   *
   * SE CUENTA DE `agendaPorDepartamento` Y NO DE `pulsoTerritorial`, porque aquel agregado sale
   * de `resumenPorDepartamento`, que describe los cinco procesos del modelo anterior. Meter
   * la Agenda allí obligaría a cambiar la forma de ese resumen —y su aritmética— por un dato que se
   * cuenta en una línea aquí.
   */
  totalDeEventosDelAmbito = computed(() => {
    const porDepartamento = this.agendaPorDepartamento();
    if (this.departamentoElegido() === 'Nacional') {
      return Object.values(porDepartamento).reduce((suma, lista) => suma + lista.length, 0);
    }
    return (porDepartamento[this.departamentoNormalizado() || ''] ?? []).length;
  });

  /**
   * Las capas que se anuncian pero todavía no se pueden consultar.
   *
   * <b>SALEN DE `CATEGORIAS_ECOSISTEMA`, QUE ES LA ÚNICA BANDERA.</b> Cada proceso en estado
   * «Próximamente» que declara capa y rótulo corto se anuncia aquí, desactivado y sin cifra: un «0»
   * junto a Lutería es indistinguible de «no hay ningún taller registrado», y lo cierto es que el
   * proceso aún no existe. El día que uno exista, pasa a «Disponible» en esa lista y esta franja lo
   * deja de anunciar; su capa se añade a `capasConConteo`. Escuelas de Música no figura: queda fuera
   * por decisión de la dirección (10 nov 2026).
   *
   * El punto de color es el de la capa si ya tiene uno medido (`LAYER_ACCENTS`) y un gris neutro si
   * no: ninguna capa en preparación necesita un color que aún no se ha validado contra daltonismo.
   */
  readonly capasEnPreparacion = CATEGORIAS_ECOSISTEMA
    .filter((categoria) => categoria.status === 'Próximamente' && categoria.etiquetaCorta)
    .map((categoria) => ({
      layerKey: categoria.layer,
      label: categoria.etiquetaCorta as string,
      color: this.LAYER_ACCENTS[categoria.layer] ?? '#94a3b8',
    }));

  /**
   * Las capas del geovisor, en el sitio donde van a quedar.
   *
   * <b>SE DIBUJAN LAS CONSULTABLES Y, A SU LADO, LAS QUE VIENEN, DESACTIVADAS.</b> Lo pidió el dueño
   * del proyecto: «déjamelos simplemente desactivados, pero en el diseño ya listos». Es un solo
   * sitio para una sola idea —qué procesos hay y cuáles vendrán— y el día que vuelva uno no hay que
   * rehacer la franja: basta con pasarlo a «Disponible» en `CATEGORIAS_ECOSISTEMA`.
   *
   * <b>DESACTIVADAS Y SIN CIFRA, NO CON UN CERO.</b> Un «0» al lado de Lutería es indistinguible
   * de «no hay ningún taller registrado», y lo cierto es otra cosa: el proceso aún no existe y
   * llegará con su modelo y su revisión propios.
   *
   * <b>«GENERAL» CUENTA COMO UNA</b> porque es una elección real en cuanto haya dos capas: mirar el
   * conjunto. Mientras sólo una se pueda consultar, queda desactivada por el mismo motivo que las
   * demás —no lleva a ningún estado distinto—, y el día que vuelva una segunda se enciende
   * sola sin tocar nada.
   */
  readonly capasDelGeovisor = computed(() => {
    const porClave: Record<string, number> = {};
    for (const item of this.pulsoTerritorial().layerItems) porClave[item.key] = item.value;
    const consultables = this.capasConConteo();
    const hayVarias = consultables.length > 1;

    return [
      {
        layerKey: 'General',
        label: 'General',
        valor: this.pulsoTerritorial().totalRecords,
        color: this.LAYER_ACCENTS['General'] ?? '#291242',
        disponible: hayVarias,
        motivo: hayVarias ? '' : 'Mirar el conjunto será una elección cuando haya más de una capa.',
      },
      ...consultables.map((capa) => ({
        ...capa,
        disponible: true,
        motivo: '',
      })),
      ...this.capasEnPreparacion.map((capa) => ({
        ...capa,
        valor: 0,
        disponible: false,
        motivo: 'En preparación: este proceso todavía no tiene registros ni directorio público.',
      })),
    ];
  });

  /** Color con el que se pinta la capa activa. Es el mismo que usan los
   *  marcadores del mapa (`LAYER_ACCENTS`), no el de `MAP_LAYERS_CONFIG`. */
  colorCapaActiva = computed(() => this.LAYER_ACCENTS[this.capaActiva()] || '#291242');

  /**
   * Ranking de departamentos por la capa activa, para la vista «grafico».
   * Una sola serie: el valor es magnitud, no identidad, de modo que todas las
   * barras comparten el color de la capa y quien distingue cada fila es su
   * rotulo, no un color por departamento.
   */
  rankingDepartamental = computed(() => {
    const capa = this.capaActiva();
    const resumen = this.resumenPorDepartamento();

    // Se recorre el resumen por departamento y no `conteosDeBase`:
    // ese segundo es una senal cruda que llega vacia cuando el backend no
    // devuelve conteos agregados, y entonces el ranking sale vacio aunque haya
    // registros. `resumenPorDepartamento` fusiona ambas procedencias.
    const filas = Object.keys(resumen).map((clave) => {
      let valor = resumen[clave]?.totalRecords || 0;

      if (capa === 'Festivales') {
        valor = (this.festivalesPorDepartamento()[clave] || []).length;
      } else if (capa === 'Escuelas de Música') {
        valor = (this.escuelasPorDepartamento()[clave] || []).length;
      } else if (capa === 'Mercados Musicales') {
        valor = (this.mercadosPorDepartamento()[clave] || []).length;
      } else if (capa === 'Redes de Documentación') {
        valor = (this.redesPorDepartamento()[clave] || []).length;
      } else if (capa === 'Lutieres') {
        valor = (this.lutieresPorDepartamento()[clave] || []).length;
      } else if (capa === 'Espacios') {
        valor = (this.espaciosPorDepartamento()[clave] || []).length;
      }

      return { clave, etiqueta: MapDomain.getDepartmentDisplayName(clave), valor };
    });

    const ordenadas = filas.filter((fila) => fila.valor > 0).sort((a, b) => b.valor - a.valor);
    const maximo = ordenadas.length > 0 ? ordenadas[0].valor : 0;

    // El ancho se resuelve aqui y no en la plantilla: un metodo llamado desde
    // el HTML se reevalua en cada deteccion de cambios, una vez por barra.
    return ordenadas.map((fila) => ({
      ...fila,
      porcentaje: maximo > 0 ? Math.max(2, Math.round((fila.valor / maximo) * 100)) : 0,
    }));
  });

  // ---------------------------------------------------------------------------
  // VISTA «GRAFICO»: TRES FORMAS DE LEER LOS MISMOS DATOS (29 de agosto de 2026)
  //
  // Habia una sola: el ranking de departamentos en barras. Es la lectura correcta
  // para «quien tiene mas», y la unica que ese grafico sabia contar. No respondia
  // «de que esta hecho el total» ni «cuanto pais falta», que son las otras dos
  // preguntas que el tablero ya tiene datos para contestar.
  //
  // NINGUNA FORMA INVENTA UN DATO. Las tres leen `resumenPorDepartamento`,
  // `pulsoTerritorial` y `coberturaTerritorial`, que ya alimentaban la barra
  // superior y el panel de lectura. Lo unico nuevo es el reparto en porcentaje y la
  // lista de departamentos sin registros, y las dos son aritmetica sobre eso.
  //
  // Y LAS TRES FILTRAN. Cada barra, cada segmento y cada nombre es un control: la
  // barra lleva el mapa a su departamento, el segmento activa su capa, y el
  // departamento vacio abre su ficha para ver que falta. Era el pedido: mas
  // indicadores, y que se pueda filtrar desde ellos.
  // ---------------------------------------------------------------------------

  formaDelGrafico = signal<'departamentos' | 'composicion' | 'cruce' | 'municipios' | 'calendario' | 'cobertura' | 'sin-situar' | 'evolucion'>('departamentos');

  /** Redondeo para la plantilla. Evita meter `DecimalPipe` solo para un porcentaje. */
  redondear(valor: number): number {
    return Math.round(Number(valor) || 0);
  }

  /**
   * Cambia de lectura, pidiendo lo que esa lectura necesita.
   *
   * <b>«SE PUEDEN SITUAR» DECIA SIEMPRE 0 %.</b> Es una lectura SOBRE el catálogo municipal y era
   * la única que no lo pedía: se abría, encontraba `puntosMunicipales` en nulo y concluía «no se
   * pudo cargar el catálogo» sobre un catálogo que nadie había intentado cargar. Acusaba de fallo
   * a lo que era una omisión suya, que es el mismo defecto que tenía la leyenda del mapa.
   */
  elegirLectura(id: 'departamentos' | 'composicion' | 'cruce' | 'municipios' | 'calendario' | 'cobertura' | 'sin-situar' | 'evolucion'): void {
    this.formaDelGrafico.set(id);
    if (id === 'sin-situar') this.cargarPuntosMunicipales();
  }

  /**
   * Por cuál de las dos dimensiones se está leyendo la composición.
   *
   * <b>SEPARADA DEL LENTE A PROPOSITO.</b> El lente decide cómo se colorea el MAPA; aquí se mira
   * una tabla, y querer ver el reparto por prácticas sin cambiar el color del mapa que se dejó
   * puesto es legítimo. Atarlas obligaría a deshacer una elección para poder hacer la otra.
   */
  readonly dimensionDeComposicion = signal<'territorios-sonoros' | 'practicas'>('territorios-sonoros');

  readonly dimensionesDeComposicion: readonly OpcionSegmentada[] = [
    { id: 'territorios-sonoros', etiqueta: 'Territorios sonoros' },
    { id: 'practicas', etiqueta: 'Prácticas y géneros' },
  ];

  /**
   * De qué está hecho el ecosistema, por la dimensión elegida.
   *
   * <b>SUSTITUYE AL «REPARTO POR CAPA», QUE HABIA DEJADO DE DECIR NADA.</b> Aquel repartía el total
   * entre las cinco capas del geovisor; cuatro de ellas corresponden a tablas que retiró
   * `V20260904_01`, así que llegan siempre a cero y el filtro de «mayor que cero» las descartaba:
   * una barra apilada de un solo segmento al 100 %. La pregunta —«de qué está hecho el total»—
   * sigue siendo buena; lo que había dejado de existir era el eje por el que se repartía.
   *
   * <b>LA SUMA PASA DEL NUMERO DE FICHAS, Y HAY QUE DECIRLO.</b> Un festival puede declarar tres
   * territorios sonoros y cuenta en los tres. Sin la nota, quien sume las filas no le cuadra con el
   * total y no sabe si el error es suyo o del tablero.
   */
  readonly composicionDelEcosistema = computed(() => {
    const dimension = this.dimensionDeComposicion();
    const colores = MapaEcosistemicoPageComponent.repartirColores(
      Analitica.contarPorDimension(this.fichasDelDirectorio(), dimension).map((grupo) => grupo.nombre));
    return Analitica.componerEcosistema(
      this.fichasDelDirectorio(), dimension, colores, MapaEcosistemicoPageComponent.COLOR_SIN_CLASIFICAR);
  });

  /**
   * Los municipios con procesos, de mayor a menor.
   *
   * <b>NO PASA POR EL CATALOGO DE COORDENADAS.</b> Se agrupa por el nombre que trae cada ficha, así
   * que la lista sale completa aunque el catálogo municipal no se haya cargado: esta vista no
   * dibuja nada sobre el mapa y no necesita situar nada. Quién no se puede situar es otra lectura
   * y tiene la suya.
   *
   * <b>SE DESAMBIGUA POR DEPARTAMENTO.</b> «La Unión» está en cinco departamentos: juntarlas en una
   * fila sumaría procesos de cinco sitios distintos bajo un nombre que parece uno solo.
   */
  readonly rankingMunicipal = computed(() => {
    const cuenta = new Map<string, { municipio: string; departamento: string; total: number }>();
    for (const registro of this.registrosDelModo()) {
      const municipio = (registro?.municipality ?? '').trim();
      if (!municipio) continue;
      // EL NOMBRE DEL DEPARTAMENTO SE NORMALIZA antes de agrupar y de enseñar: cada capa lo escribe
      // a su manera —«Antioquia», «ANTIOQUIA», «Valle del Cauca»— y agrupar por la cadena cruda
      // partiría en dos filas el mismo municipio del mismo departamento según de qué capa viniera.
      const clave = MapDomain.normalizeDepartmentName(registro?.department ?? '');
      const departamento = MapDomain.getDepartmentDisplayName(clave);
      const agrupada = `${clave}|${municipio}`;
      const fila = cuenta.get(agrupada);
      if (fila) fila.total += 1;
      else cuenta.set(agrupada, { municipio, departamento, total: 1 });
    }

    const filas = [...cuenta.values()].sort((uno, otro) =>
      otro.total - uno.total || uno.municipio.localeCompare(otro.municipio, 'es'));
    const maximo = filas[0]?.total ?? 1;

    return filas.map((fila) => ({
      ...fila,
      clave: `${fila.departamento}|${fila.municipio}`,
      porcentaje: Math.max(2, Math.round((fila.total / maximo) * 100)),
    }));
  });

  /**
   * El cruce entre los grupos del lente y los departamentos.
   *
   * <b>ES LA UNICA LECTURA QUE ENSEÑA LA TESIS DEL LENTE.</b> El mapa por departamentos puede
   * pintar cuál predomina en cada uno, pero no puede enseñar lo contrario —en cuántos
   * departamentos vive un mismo territorio sonoro— porque para eso habría que leer el mapa al
   * revés. Aquí cada fila es un grupo y cada columna un departamento: una fila con marcas repartidas
   * es un territorio que cruza el país, y eso es exactamente lo que el lente promete y lo que
   * ninguna otra pieza del geovisor demuestra.
   *
   * <b>LA CELDA DICE CUANTOS, NO SOLO SI.</b> Una matriz de presencia —marca o vacío— igualaría un
   * departamento con un proceso y otro con veinte. La intensidad sale del máximo de la propia
   * matriz, que es lo que hace comparables las celdas entre sí.
   *
   * <b>SOLO CON UN LENTE PUESTO.</b> Con el lente territorial no hay grupos que cruzar: la matriz
   * sería el ranking de departamentos escrito de otra forma, que es repetir lo que ya está arriba.
   */
  readonly matrizDelLente = computed(() => {
    const lente = this.lenteDeLectura();
    if (lente === 'territorial') return { grupos: [], departamentos: [], maximo: 0 };

    // Las fichas se etiquetan con su departamento normalizado antes de cruzarlas: la aritmética no
    // sabe de cartografía y no tiene por qué.
    const fichas = this.fichasDelDirectorio()
      .map((ficha) => ({
        ...(ficha as FichaClasificable),
        clave: MapDomain.normalizeDepartmentName((ficha as { department?: string })?.department ?? ''),
      }))
      .filter((ficha) => ficha.clave && ficha.clave !== 'DESCONOCIDO');

    const cruce = Analitica.cruzarGruposConDepartamentos(
      fichas, lente, this.gruposDelLente(), this.coloresDelLente(),
      MapaEcosistemicoPageComponent.COLOR_SIN_CLASIFICAR,
      (clave) => MapDomain.getDepartmentDisplayName(clave),
    );

    return {
      ...cruce,
      grupos: cruce.grupos.map((grupo) => ({
        ...grupo,
        color: this.coloresDelLente().get(grupo.nombre)
          ?? MapaEcosistemicoPageComponent.COLOR_SIN_CLASIFICAR,
      })),
    };
  });

  /**
   * La agenda repartida en el tiempo.
   *
   * <b>EL GEOVISOR NO TENIA NINGUNA LECTURA TEMPORAL, y la circulación cultural es tanto cuándo
   * como dónde.</b> El panel derecho lista los eventos del territorio abierto y sus tres tramos
   * —próximos, este mes, todos—, pero eso responde «qué hay ahora aquí»; no responde «cómo se
   * reparte el año», que es la pregunta que distingue un ecosistema con temporada de uno con
   * actividad continua.
   *
   * <b>DOCE MESES SIEMPRE, INCLUIDOS LOS VACIOS.</b> Enseñar sólo los meses con eventos comprime la
   * escala y esconde justo lo que hay que ver: los huecos. Un año con todo en noviembre y un año
   * repartido se verían igual.
   */
  readonly agendaEnElTiempo = computed(() => {
    // «NACIONAL» NO ES UN DEPARTAMENTO. `departamentoNormalizado()` devuelve esa cadena cuando no hay
    // departamento abierto, y compararla contra la de cada evento dejaba fuera a todos.
    const ambito = this.departamentoElegido() === 'Nacional' ? '' : this.departamentoNormalizado();
    const fechas = this.registrosDeAgenda()
      .filter((evento) => !ambito || MapDomain.normalizeDepartmentName(campo(evento, 'dpt')) === ambito)
      .map((evento) => campo(evento, 'fecha'));
    return Analitica.repartirPorMes(fechas);
  });

  /** Si el ranking municipal se está enseñando entero o sólo su cabeza. */
  readonly rankingMunicipalCompleto = signal(false);

  /**
   * El ranking municipal recortado a su cabeza, con la cola contada.
   *
   * <b>UNA COLA PLANA NO SE RECORRE, SE CUENTA.</b> Medido con los datos sembrados: de 123
   * municipios con actividad, 122 tienen exactamente un proceso. Enseñarlos todos son dos
   * pantallas de puntos idénticos alineados en la misma columna —ni ranking ni distribución, sólo
   * una lista alfabética disfrazada de gráfico— y quien la recorre no encuentra nada que no diga
   * la primera fila.
   *
   * <b>PERO NO SE ESCONDE: SE DICE.</b> «y 118 municipios más con 1 proceso» es información —dice
   * que el ecosistema está repartido y no concentrado—, mientras que cortar la lista en veinticinco
   * sin más haría pensar que ahí se acaba. Y se puede desplegar, porque buscar un municipio
   * concreto en la lista es una razón legítima para quererla entera.
   */
  readonly rankingMunicipalVisible = computed(() => {
    const filas = this.rankingMunicipal();
    if (this.rankingMunicipalCompleto() || filas.length <= MapaEcosistemicoPageComponent.CABEZA_DEL_RANKING) {
      return { filas, ocultos: 0, valorDeLaCola: 0 };
    }
    const cabeza = filas.slice(0, MapaEcosistemicoPageComponent.CABEZA_DEL_RANKING);
    const cola = filas.slice(MapaEcosistemicoPageComponent.CABEZA_DEL_RANKING);
    // El valor de la cola sólo se anuncia si TODA la cola empata: decir «con 1 proceso» sobre una
    // cola que va de 3 a 1 sería falso, y entonces lo honesto es sólo contarlos.
    const primero = cola[0]?.total ?? 0;
    const empatan = cola.every((fila) => fila.total === primero);
    return { filas: cabeza, ocultos: cola.length, valorDeLaCola: empatan ? primero : 0 };
  });

  /** Cuántas filas del ranking se enseñan antes de contar la cola. */
  private static readonly CABEZA_DEL_RANKING = 25;

  /**
   * Cuántos procesos no se pueden poner en el mapa, y por culpa de qué.
   *
   * <b>TRES CAUSAS SEPARADAS, CON TRES RESPONSABLES DISTINTOS.</b> Fundirlas en «N sin ubicar» las
   * hace inarreglables: una se corrige cargando el catálogo, otra completando la ficha y la tercera
   * ampliando el catálogo. Es la misma separación que hace la leyenda del mapa, traída aquí porque
   * en la leyenda cabe un aviso de una línea y aquí cabe la explicación.
   *
   * <b>ES UNA LECTURA DE CALIDAD DEL DATO, Y POR ESO ESTA EN LA ANALITICA</b> y no escondida en un
   * aviso: saber cuánto del ecosistema no se ve es parte de leer el ecosistema.
   */
  readonly procesosSinSituar = computed(() => {
    const { municipios, noSituados } = this.procesosPorMunicipio();
    const situados = municipios.reduce((total, municipio) => total + municipio.total, 0);
    const sinSituar = noSituados.catalogoNoDisponible + noSituados.sinCodigo + noSituados.municipioSinPunto;

    const causas = [
      {
        clave: 'catalogo',
        cifra: noSituados.catalogoNoDisponible,
        titulo: 'No se pudo cargar el catálogo de municipios',
        explicacion: 'No es un problema de estas fichas: sin el catálogo territorial no hay dónde '
          + 'ponerlas. Se resuelve al volver a cargar la página o, si persiste, revisando el catálogo.',
      },
      {
        clave: 'sin_codigo',
        cifra: noSituados.sinCodigo,
        titulo: 'La ficha no dice en qué municipio ocurre',
        explicacion: 'Declara departamento pero no municipio, o ninguno de los dos. Se corrige '
          + 'completando el territorio en la ficha del proceso.',
      },
      {
        clave: 'sin_punto',
        cifra: noSituados.municipioSinPunto,
        titulo: 'El municipio no está situado en el catálogo',
        explicacion: 'La ficha sí dice el municipio, pero el catálogo territorial no tiene su '
          + 'coordenada. Se corrige en el catálogo, no en la ficha.',
      },
    ].filter((causa) => causa.cifra > 0);

    const total = situados + sinSituar;
    return {
      situados,
      sinSituar,
      total,
      porcentaje: total > 0 ? Math.round((situados / total) * 100) : 100,
      causas,
    };
  });

  /**
   * Cuanto pais falta: los departamentos de la cartografia sin un solo registro.
   *
   * Se recorre `cartografia()` y no el resumen: el resumen solo trae los departamentos
   * que YA aparecen en los datos, de modo que preguntarle quien falta devuelve
   * siempre la lista vacia. Es el mismo motivo por el que `coberturaTerritorial`
   * divide por `cartografia()?.features?.length`.
   */
  departamentosSinRegistros = computed(() => {
    const resumen = this.resumenPorDepartamento();
    const rasgos = this.cartografia()?.features || [];

    return rasgos
      .map((rasgo: any) => ({
        clave: MapDomain.getFeatureDepartmentNormalizedName(rasgo),
        etiqueta: MapDomain.getFeatureDepartmentName(rasgo),
      }))
      .filter((fila: any) => fila.clave && (resumen[fila.clave]?.totalRecords || 0) === 0)
      .sort((a: any, b: any) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
  });

  /**
   * Los indicadores que encabezan la vista. Cada uno es tambien un control: pulsarlo cambia la
   * lectura que se esta mirando.
   */
  /**
   * Las lecturas disponibles: cada una es a la vez una cifra y una posición del control.
   *
   * <b>DOS ROTULOS Y NO UNO.</b> `corta` es lo que cabe en la tira —una o dos palabras— y
   * `etiqueta` es la frase entera, que viaja en el `title` para quien se detenga encima. Con un
   * solo rótulo largo la tira los recortaba a «MUNICIPIOS CON …» y «MES CON MÁS EV…», que no dicen
   * lo mismo que el original ni dicen nada por sí solos.
   */
  indicadoresDelGrafico = computed(() => {
    const pulso = this.pulsoTerritorial();
    const cobertura = this.coberturaTerritorial();
    const composicion = this.composicionDelEcosistema();
    const municipios = this.rankingMunicipal();
    const calidad = this.procesosSinSituar();
    const tiempo = this.agendaEnElTiempo();
    const masCruza = this.matrizDelLente().grupos
      .slice().sort((uno, otro) => otro.departamentos - uno.departamentos)[0];
    const mesMayor = tiempo.total > 0
      ? tiempo.meses.slice().sort((uno, otro) => otro.total - uno.total)[0]
      : null;
    const dimension = this.dimensionDeComposicion() === 'territorios-sonoros'
      ? 'territorios sonoros' : 'prácticas';

    return [
      {
        id: 'departamentos' as const,
        etiqueta: this.departamentoElegido() === 'Nacional' ? 'Registros en el país' : 'Registros aquí',
        corta: 'Registros',
        valor: this.formatearCifra(pulso.totalRecords),
        pie: `${this.rankingDepartamental().length} departamentos con registros`,
      },
      // EL ORDEN LO DA LA PREGUNTA: dónde (departamentos, municipios), de qué está hecho (composición, cruce),
      // cuándo (calendario) y qué tan completo es el dato (cobertura, procesos que se sitúan).
      {
        id: 'municipios' as const,
        etiqueta: 'Municipios con actividad',
        corta: 'Municipios',
        valor: this.formatearCifra(municipios.length),
        pie: municipios[0] ? `El mayor: ${municipios[0].municipio}` : 'Ninguna ficha declara municipio',
      },
      {
        id: 'composicion' as const,
        // NO SE ROTULA «MAS DECLARADO» SI EL PRIMERO ES «SIN CLASIFICAR»: eso no es lo más
        // declarado, es lo que nadie declaró, y llamarlo así invierte lo que dice el dato.
        etiqueta: composicion.filas[0]?.nombre === 'Sin clasificar' ? 'Mayoría sin clasificar' : 'Más declarado',
        corta: composicion.filas[0]?.nombre === 'Sin clasificar' ? 'Sin clasificar' : 'Más declarado',
        valor: composicion.filas[0]?.nombre ?? '—',
        pie: composicion.filas.length > 0
          ? `de ${composicion.filas.length} en esta lectura`
          : `Ningún registro declara ${dimension}`,
      },
      // EL CRUCE SOLO SE OFRECE CON UN LENTE PUESTO. Con el lente territorial no hay grupos que
      // cruzar y la matriz sería el ranking de departamentos escrito de otra forma: un indicador
      // que lleva a una lectura vacía enseña a desconfiar de los otros cuatro.
      ...(masCruza ? [{
        id: 'cruce' as const,
        etiqueta: 'El que más cruza departamentos',
        corta: 'El que más cruza',
        valor: masCruza.nombre,
        pie: `en ${masCruza.departamentos} ${masCruza.departamentos === 1 ? 'departamento' : 'departamentos'}`,
      }] : []),
      {
        id: 'calendario' as const,
        etiqueta: 'Mes con más eventos',
        corta: 'Mes mayor',
        valor: mesMayor?.etiqueta ?? '—',
        pie: tiempo.total > 0
          ? `${tiempo.total} ${tiempo.total === 1 ? 'evento' : 'eventos'} en el año`
          : 'Sin eventos en este ámbito',
      },
      {
        id: 'cobertura' as const,
        etiqueta: 'Cobertura territorial',
        corta: 'Cobertura',
        valor: `${cobertura.porcentaje} %`,
        pie: `${cobertura.conRegistros} de ${cobertura.total} departamentos`,
      },
      {
        id: 'sin-situar' as const,
        etiqueta: 'Procesos que se pueden situar',
        corta: 'Se sitúan',
        valor: `${calidad.porcentaje} %`,
        pie: calidad.sinSituar > 0
          ? `${calidad.sinSituar} sin situar, por ${calidad.causas.length} ${calidad.causas.length === 1 ? 'causa' : 'causas'}`
          : 'Todos los procesos tienen dónde ponerse',
      },
    ];
  });

  /**
   * El pie de la lectura que está puesta.
   *
   * <b>SE SACO DE LAS TARJETAS A PROPOSITO.</b> Cada una de las siete llevaba su propia frase de
   * apoyo —«29 departamentos con registros», «El mayor: EL ENCANTO»—, de modo que elegir entre
   * ellas obligaba a leer siete frases para quedarse con una. Aquí se enseña solo la que
   * corresponde, y la tira de arriba se queda con lo único que de verdad se compara de un vistazo:
   * el rótulo y la cifra.
   */
  readonly pieDeLaLectura = computed(() => {
    const puesta = this.formaDelGrafico();
    return this.indicadoresDelGrafico().find(item => item.id === puesta)?.pie ?? '';
  });

  // ---------------------------------------------------------------------------
  // MODO DE PRACTICAS E INFLUENCIA: DONDE ESTA CADA PROCESO (29 de agosto de 2026)
  //
  // Lo que habia: `thematicPoints` calculaba la posicion de cada proceso como el
  // centroide de su DEPARTAMENTO mas una espiral cuyo angulo salia del INDICE DEL
  // REGISTRO EN EL ARRAY. Reordenar los datos movia los puntos por el mapa.
  //
  // Lo que hay: un senalador por MUNICIPIO, sobre el punto de referencia que
  // `/api/v1/publico/divipola` da para ese municipio. La justificacion completa, con
  // sus mediciones, vive en `map-domain.ts` junto a `resolverUbicacionDeRegistro`.
  // ---------------------------------------------------------------------------

  /** Los puntos municipales, o null mientras no se hayan podido cargar. */
  readonly puntosMunicipales = signal<ReadonlyMap<string, PuntoMunicipalDelCatalogo> | null>(null);

  /**
   * En que va la descarga de los puntos.
   *
   * Hace falta un estado y no solo el mapa en null: «todavia no se ha pedido» y «se
   * pidio y fallo» se pintan distinto —uno no dice nada, el otro avisa— y con un solo
   * null son indistinguibles.
   */
  readonly estadoPuntosMunicipales = signal<'sin_pedir' | 'cargando' | 'listo' | 'fallo'>('sin_pedir');

  /**
   * Pide los puntos municipales UNA vez, al entrar al modo.
   *
   * No va en el `forkJoin` de arranque (map-data.service.ts) a proposito: ese bloquea el
   * primer dibujo del mapa, y estos puntos solo hacen falta en un modo que el usuario
   * puede no abrir nunca.
   */
  cargarPuntosMunicipales(): void {
    if (this.estadoPuntosMunicipales() === 'cargando' || this.estadoPuntosMunicipales() === 'listo') return;

    this.estadoPuntosMunicipales.set('cargando');
    this.catalog.fetchPuntosMunicipales().then(
      (puntos) => {
        // UN CATALOGO VACIO ES UN CATALOGO QUE NO ESTA, y hay que decirlo así.
        //
        // Guardaba el mapa vacío y cada registro caía en «municipio sin punto», que acusa al
        // REGISTRO de no tener ubicación. La verdad es la contraria: DIVIPOLA devuelve los 1.122
        // municipios y NINGUNO trae latitud ni longitud —comprobado
        // contra `/publico/divipola`, y también después de correr el importador MGN 2025—. El
        // problema es del catálogo, no de las fichas, y un mensaje que culpa al registro manda a
        // corregir la ficha equivocada.
        this.puntosMunicipales.set(puntos.size > 0 ? puntos : null);
        this.estadoPuntosMunicipales.set(puntos.size > 0 ? 'listo' : 'fallo');
      },
      () => {
        this.puntosMunicipales.set(null);
        this.estadoPuntosMunicipales.set('fallo');
      },
    );
  }

  /**
   * Los registros que el modo tiene que dibujar, ya filtrados.
   *
   * SALEN DE LOS CINCO `*RecordsByDepartment` Y NO DE LOS `*Records` CRUDOS. Esos cinco
   * computeds ya aplican los filtros de Territorio Sonoro y Practica —verificado en
   * `festivalesPorDepartamento`, que descarta con `matchesSonorousTerritory` y
   * `matchesPracticeMusical`— y ya normalizan `municipalityCode` a cinco digitos. Son
   * ademas la fuente de `fichasDelDirectorio` y de `resumenPorDepartamento`, o sea
   * del listado y de la cifra grande de la barra superior: asi el mapa no puede contar
   * una cosa distinta de lo que dice el panel de al lado.
   */
  private fuentesPorCapa = computed<[string, Record<string, RegistroDelModo[]>][]>(() => [
    ['Festivales', this.festivalesPorDepartamento()],
    ['Escuelas de Música', this.escuelasPorDepartamento()],
    ['Mercados Musicales', this.mercadosPorDepartamento()],
    ['Redes de Documentación', this.redesPorDepartamento()],
    ['Lutieres', this.lutieresPorDepartamento()],
    ['Espacios', this.espaciosPorDepartamento()],
  ]);

  private fuentesDelModo = computed<Record<string, RegistroDelModo[]>[]>(() => {
    const capa = this.capaActiva();
    const todas = this.fuentesPorCapa();

    return (capa === 'General' ? todas : todas.filter(([clave]) => clave === capa))
      .map(([, porDepartamento]) => porDepartamento || {});
  });

  // ---------------------------------------------------------------------------
  // COLOR POR TIPO DE REGISTRO (comentario 1 del 22 de noviembre de 2026)
  //
  // Con UNA capa elegida, los símbolos y el calor ya salen del color de esa capa (morado los Festivales,
  // ámbar los Mercados…). El hueco estaba en «Vista general»: todos los tipos juntos, un solo tono. Ahí,
  // y solo ahí, el color pasa a ser el del tipo de cada registro. Con un lente puesto manda el lente (su color
  // es otra categoría) y la coropleta se queda como está: su color es una intensidad, no una identidad.
  // ---------------------------------------------------------------------------

  /** El color del tipo de cada registro del modo, por identidad del registro (los símbolos conservan los mismos objetos). */
  private readonly colorDelTipoDeRegistro = computed(() => {
    const colores = new Map<object, string>();
    for (const [capa, porDepartamento] of this.fuentesPorCapa()) {
      const color = this.LAYER_ACCENTS[capa];
      for (const registro of Object.values(porDepartamento || {}).flat()) colores.set(registro as object, color);
    }
    return colores;
  });

  /** Si el dibujo (símbolos y calor) toma el color del tipo de registro: solo en «Vista general», sin lente y sin coropleta. */
  readonly coloreaPorTipo = computed(() =>
    this.esCapaGeneral() && this.lenteDeLectura() === 'territorial' && this.modoDeDibujo() !== 'cobertura');

  /** Los tipos presentes en el dibujo, con su color y cuántos registros, en el orden de las capas. */
  readonly tiposDelDibujo = computed(() => {
    if (!this.coloreaPorTipo()) return [] as { nombre: string; color: string; total: number }[];
    const colores = this.colorDelTipoDeRegistro();
    // POR COLOR, no por capa: dos tipos que comparten tono (Escuelas y Espacios) son una sola entrada, o la mancha de
    // calor de ese color se dibujaría dos veces.
    const porColor = new Map<string, { nombre: string; color: string; total: number }>();
    for (const [capa, porDepartamento] of this.fuentesPorCapa()) {
      const n = Object.values(porDepartamento || {}).flat().filter((registro) => colores.has(registro as object)).length;
      if (n === 0) continue;
      const color = this.LAYER_ACCENTS[capa];
      const previo = porColor.get(color);
      porColor.set(color, previo
        ? { nombre: `${previo.nombre} y ${capa}`, color, total: previo.total + n }
        : { nombre: capa, color, total: n });
    }
    return [...porColor.values()];
  });

  /** Las listas por capa para el análisis avanzado: todas las capas y todo el país, sin filtros de la columna lateral. */
  readonly fuentesDelAnalisis = computed(() => this.fuentesPorCapa());
  /** El color de cada capa, para que un tipo de proceso se vea igual en el mapa y en el análisis. */
  readonly coloresDelAnalisis = this.LAYER_ACCENTS;

  /**
   * EL ANÁLISIS AVANZADO SE CARGA BAJO DEMANDA con `import()`: ni el componente ni las formas nuevas de
   * ECharts (aluvial, matriz) van en el paquete inicial, que tiene un tope. Se usa `NgComponentOutlet` y no
   * `@defer` porque este último sumaba al paquete inicial el código de ejecución de `@defer`.
   */
  readonly componenteDelAnalisis = signal<Type<unknown> | null>(null);
  readonly fallaElAnalisis = signal(false);
  async cargarAnalisisAvanzado(): Promise<void> {
    if (this.componenteDelAnalisis()) return;
    this.fallaElAnalisis.set(false);
    try {
      const modulo = await import('../../components/tablero/analisis-avanzado.component');
      this.componenteDelAnalisis.set(modulo.AnalisisAvanzadoComponent);
    } catch {
      this.fallaElAnalisis.set(true);
    }
  }
  readonly entradasDelAnalisis = computed(() => ({
    fuentes: this.fuentesDelAnalisis(), colores: this.coloresDelAnalisis, animar: this.animarElTablero,
    vista: this.vistaDelTablero(), filtrosDeLaPagina: this.filtrosDelAnalisis(), alCambiarFiltros: this.cambiarFiltrosDelAnalisis,
  }));

  private registrosDelModo = computed<RegistroDelModo[]>(() =>
    this.fuentesDelModo().flatMap((porDepartamento) => Object.values(porDepartamento).flat()),
  );

  /**
   * El código DIVIPOLA de un municipio, buscándolo por su nombre dentro de su departamento.
   *
   * <b>SE ACOTA AL DEPARTAMENTO A PROPOSITO.</b> Hay nombres repetidos en el país —«La Unión» está
   * en cinco departamentos— y resolver por nombre a secas pondría el proceso en el municipio
   * equivocado sin que nada lo dijera, que es peor que no pintarlo.
   *
   * El catálogo ya está cargado para situar los puntos; esto solo lo lee al revés.
   */
  private codigoDeMunicipioPorNombre(municipio: unknown, departamento: string): string {
    const nombre = typeof municipio === 'string' ? municipio.trim() : '';
    if (!nombre) return '';

    const puntos = this.puntosMunicipales();
    if (!puntos) return '';

    const comparable = MapDomain.normalizeDepartmentName(nombre);
    const departamentoComparable = MapDomain.normalizeDepartmentName(departamento);

    const porNombre: string[] = [];
    for (const [codigo, punto] of puntos) {
      if (MapDomain.normalizeDepartmentName(punto.nombre) !== comparable) continue;
      porNombre.push(codigo);
      const delMismoDepartamento = MapDomain.normalizeDepartmentName(
        MapDomain.getDepartmentDisplayName(punto.codigoDepartamento)) === departamentoComparable;
      if (delMismoDepartamento) return codigo;
    }

    // SI EL DEPARTAMENTO NO CUADRA PERO EL NOMBRE ES UNICO EN EL PAIS, se acepta: no hay a dónde
    // equivocarse. Con dos o más candidatos NO se elige uno: poner el proceso en el municipio
    // equivocado sin decirlo es peor que no pintarlo, y la leyenda ya cuenta los «sin código».
    return porNombre.length === 1 ? porNombre[0] : '';
  }

  /** Los municipios con procesos, con su punto real y su conteo. */
  readonly procesosPorMunicipio = computed(() =>
    MapDomain.agruparProcesosPorMunicipio(this.registrosDelModo(), this.puntosMunicipales()),
  );

  /**
   * Cuantos procesos del modo tiene cada departamento.
   *
   * NO SE USA `conteosDeLaCapaActiva()`. Ese no respeta los filtros salvo en «Vista
   * general»: `festivalCounts` / `schoolCounts` / `marketCounts` se escriben desde el
   * bundle sin filtrar, y redes y lutieres se derivan de los registros sin filtrar. Con
   * «Joropo» puesto, el fondo del mapa contaria los procesos de todas las practicas
   * mientras los senaladores contarian solo los de joropo. Dos cifras del mismo dato en
   * la misma pantalla.
   */
  readonly conteoDelModoPorDepartamento = computed<Record<string, number>>(() => {
    const conteo: Record<string, number> = {};
    for (const porDepartamento of this.fuentesDelModo()) {
      for (const [departamento, registros] of Object.entries(porDepartamento)) {
        conteo[departamento] = (conteo[departamento] || 0) + (registros?.length || 0);
      }
    }
    return conteo;
  });

  private maximoDelModo = computed(() => {
    const valores = Object.values(this.conteoDelModoPorDepartamento());
    return valores.length ? Math.max(...valores) : 0;
  });

  technicalDepartmentRows = computed(() => {
    return Object.keys(this.conteosDeBase())
      .map((departmentKey) => {
        const summary = this.resumenPorDepartamento()[departmentKey] || MapDomain.EMPTY_DEPARTMENT_SUMMARY;
        const festivals = this.festivalesPorDepartamento()[departmentKey] || [];
        const schools = this.escuelasPorDepartamento()[departmentKey] || [];
        const markets = this.mercadosPorDepartamento()[departmentKey] || [];
        const schoolTotals = MapDomain.buildSchoolCapacityTotals(schools);
        const marketTotals = MapDomain.buildMarketTotals(markets);

        return {
          departmentKey,
          departmentLabel: MapDomain.getDepartmentDisplayName(departmentKey),
          totalRecords: summary.totalRecords,
          festivalCount: festivals.length,
          schoolCount: schools.length,
          marketCount: markets.length,
          totalStudents: schoolTotals.totalStudents,
          totalTeachers: schoolTotals.totalTeachers,
          totalInstruments: schoolTotals.totalInstruments,
          totalMarketProjects: marketTotals.totalProjects,
          totalMarketBuyers: marketTotals.totalBuyers,
          municipalities: MapDomain.countDistinctValues(festivals, (item) => item.municipality),
        };
      })
      .sort((left, right) => {
        const isGeneral = this.esCapaGeneral();
        const isSchools = this.isSchoolsLayer();
        const isMarkets = this.isMarketsLayer();
        const sortKey = isGeneral
          ? 'totalRecords'
          : isSchools
          ? 'schoolCount'
          : isMarkets
          ? 'marketCount'
          : 'festivalCount';
        const delta = (right[sortKey] || 0) - (left[sortKey] || 0);
        return delta || left.departmentLabel.localeCompare(right.departmentLabel, 'es-CO');
      });
  });

  tarjetasDeResumen = computed(() => {
    const isDept = this.departamentoElegido() !== 'Nacional' && this.focusedDepartmentStats();
    const summary = isDept ? this.focusedDepartmentStats()! : MapDomain.EMPTY_DEPARTMENT_SUMMARY;

    if (this.esCapaGeneral()) {
      return [
        {
          label: 'Festivales y Encuentros',
          value: isDept ? summary.festivalCount : this.registrosDeFestivales().length,
          note: 'Celebraciones y circuitos de circulación de música en vivo.'
        },
        { 
          label: 'Proyectos en Mercados', 
          value: isDept ? summary.totalMarketProjects : this.marketCapacityTotals().totalProjects, 
          note: `Conexión profesional con ${this.formatearCifra(isDept ? summary.totalMarketBuyers : this.marketCapacityTotals().totalBuyers)} compradores registrados.` 
        },
      ];
    }

    if (this.isSchoolsLayer()) {
      return [
        { label: 'Escuelas visibles', value: isDept ? summary.schoolCount : this.registrosDeEscuelas().length, note: `${this.activeAnalytics().activeDepartments} departamentos con registros.` },
        { label: 'Estudiantes', value: isDept ? summary.totalStudents : this.schoolCapacityTotals().totalStudents, note: 'Suma nacional o territorial visible.' },
        { label: 'Docentes', value: isDept ? summary.totalTeachers : this.schoolCapacityTotals().totalTeachers, note: 'Capacidad pedagógica reportada.' },
        { label: 'Instrumentos', value: isDept ? summary.totalInstruments : this.schoolCapacityTotals().totalInstruments, note: 'Dotación registrada.' },
        { label: 'Con internet', value: this.schoolCapacityTotals().withInternet, note: 'Escuelas con conectividad declarada.' },
      ];
    }

    if (this.isMarketsLayer()) {
      return [
        { label: 'Mercados visibles', value: isDept ? summary.marketCount : this.registrosDeMercados().length, note: `${this.activeAnalytics().activeDepartments} departamentos con registros.` },
        { label: 'Proyectos', value: isDept ? summary.totalMarketProjects : this.marketCapacityTotals().totalProjects, note: 'Promedio o suma reportada por mercado.' },
        { label: 'Bookers', value: isDept ? summary.totalMarketBuyers : this.marketCapacityTotals().totalBuyers, note: 'Capacidad de conexión profesional.' },
        { label: 'Conconvocatorias', value: this.marketCapacityTotals().openCalls, note: 'Mercados con convocatoria abierta.' },
        { label: 'Con festival', value: this.marketCapacityTotals().linkedToFestival, note: 'Relación con circuitos festivaleros.' },
      ];
    }

    if (this.esCapaDeFestivales()) {
      const allFestivals = isDept ? (this.festivalesPorDepartamento()[this.departamentoNormalizado()] || []) : Object.values(this.festivalesPorDepartamento()).flat();
      return [
        { label: 'Festivales visibles', value: isDept ? summary.festivalCount : this.festivalAnalytics().totalRecords, note: `${this.activeAnalytics().activeDepartments} departamentos con presencia.` },
        { label: 'Municipios', value: MapDomain.countDistinctValues(allFestivals, (item) => item.municipality), note: 'Municipios con registros reportados.' },
        { label: 'Meses', value: MapDomain.countDistinctValues(allFestivals, (item) => item.month), note: 'Distribución temporal disponible.' },
        { label: 'Géneros', value: MapDomain.countDistinctValues(allFestivals, (item) => item.genre), note: 'Lectura temática visible.' },
        { label: 'Cobertura', value: `${this.activeAnalytics().coverage}%`, note: 'Departamentos con presencia festivalera.' },
      ];
    }

    if (this.isRedesLayer()) {
      const allRedes = isDept ? (this.redesPorDepartamento()[this.departamentoNormalizado()] || []) : this.registrosDeRedes();
      return [
        { label: 'Redes integradas', value: isDept ? summary.redesCount : this.registrosDeRedes().length, note: `${this.activeAnalytics().activeDepartments} departamentos con presencia.` },
        { label: 'Municipios', value: MapDomain.countDistinctValues(allRedes, (item) => item.municipality), note: 'Cobertura municipal.' },
        { label: 'Cobertura', value: `${this.activeAnalytics().coverage}%`, note: 'Departamentos activos.' },
      ];
    }

    if (this.isEspaciosLayer()) {
      const allEspacios = isDept ? (this.espaciosPorDepartamento()[this.departamentoNormalizado()] || []) : this.registrosDeEspacios();
      return [
        { label: 'Espacios registrados', value: isDept ? summary.spaceCount : this.registrosDeEspacios().length, note: `${this.activeAnalytics().activeDepartments} departamentos con presencia.` },
        { label: 'Municipios', value: MapDomain.countDistinctValues(allEspacios, (item) => String(item['municipality'] ?? '')), note: 'Cobertura municipal.' },
        { label: 'Cobertura', value: `${this.activeAnalytics().coverage}%`, note: 'Departamentos activos.' },
      ];
    }

    if (this.isLutieresLayer()) {
      const allLutieres = isDept ? (this.lutieresPorDepartamento()[this.departamentoNormalizado()] || []) : this.registrosDeLutieres();
      return [
        { label: 'Lutieres registrados', value: isDept ? summary.lutierCount : this.registrosDeLutieres().length, note: `${this.activeAnalytics().activeDepartments} departamentos con presencia.` },
        { label: 'Municipios', value: MapDomain.countDistinctValues(allLutieres, (item) => item.municipality), note: 'Cobertura municipal.' },
        { label: 'Cobertura', value: `${this.activeAnalytics().coverage}%`, note: 'Departamentos activos.' },
      ];
    }

    return [];
  });

  visibleRecords = computed(() => {
    if (this.departamentoElegido() === 'Nacional') return [];
    const departamentoNormalizado = this.departamentoNormalizado();

    return [
      ...this.festivalesDelDepartamento().slice(0, 8).map((item: any) => ({
        type: 'Festival',
        name: item.name,
        meta: [item.municipality, item.month, item.genre].filter(Boolean).join(' · '),
        record: { ...item, department: departamentoNormalizado },
      })),
      ...this.escuelasDelDepartamento().slice(0, 8).map((item: any) => ({
        type: 'Escuela',
        name: item.name,
        meta: [item.municipality, item.status, `${this.formatearCifra(item.students)} estudiantes`].filter(Boolean).join(' · '),
        record: item,
      })),
      ...this.mercadosDelDepartamento().slice(0, 8).map((item: any) => ({
        type: 'Mercado',
        name: item.name,
        meta: [item.municipality, item.periodicity, item.openCall === 'Sí' ? 'Convocatoria abierta' : ''].filter(Boolean).join(' · '),
        record: item,
      })),
      ...this.redesDelDepartamento().slice(0, 8).map((item: any) => ({
        type: 'Redes de Documentación',
        name: item.name,
        meta: [item.municipality, item.centerType].filter(Boolean).join(' · '),
        record: item,
      })),
      ...this.lutieresDelDepartamento().slice(0, 8).map((item: any) => ({
        type: 'Lutieres',
        name: item.name,
        meta: [item.municipality, item.oficio].filter(Boolean).join(' · '),
        record: item,
      })),
      ...this.espaciosDelDepartamento().slice(0, 8).map((item) => ({
        type: 'Espacios',
        name: item.name,
        meta: [item['municipality'], item['centerType']].filter(Boolean).join(' · '),
        record: item,
      })),
    ];
  });

  fichasDelDirectorio = computed(() => {
    const isDept = this.departamentoElegido() !== 'Nacional';
    const deptNorm = this.departamentoNormalizado() || '';
    
    const festivals = isDept
      ? ((this.festivalesPorDepartamento() || {})[deptNorm] || [])
      : Object.entries(this.festivalesPorDepartamento() || {}).flatMap(([deptKey, list]) =>
          ((list as any) || []).map((item: any) => ({ ...item, department: item.department || MapDomain.getDepartmentDisplayName(deptKey) }))
        );
        
    const schools = isDept
      ? ((this.escuelasPorDepartamento() || {})[deptNorm] || [])
      : Object.values(this.escuelasPorDepartamento() || {}).flat();
      
    const markets = isDept
      ? ((this.mercadosPorDepartamento() || {})[deptNorm] || [])
      : Object.values(this.mercadosPorDepartamento() || {}).flat();
      
    const redes = isDept
      ? ((this.redesPorDepartamento() || {})[deptNorm] || [])
      : Object.values(this.redesPorDepartamento() || {}).flat();
      
    const lutieres = isDept
      ? ((this.lutieresPorDepartamento() || {})[deptNorm] || [])
      : Object.values(this.lutieresPorDepartamento() || {}).flat();

    const espacios: NetworkRecord[] = isDept
      ? (this.espaciosPorDepartamento()[deptNorm] || [])
      : Object.values(this.espaciosPorDepartamento()).flat();

    const all: any[] = [];
    const directoryCategory = this.directoryCategory();
    const municipio = this.municipioElegido();
    const acotaMunicipio = municipio !== 'Todos' && municipio.trim().length > 0;

    if (directoryCategory === 'Todos' || directoryCategory === 'Festivales') {
      (festivals || []).forEach((item: any) => {
        if (!item) return;
        all.push({
          id: item.id || `fest-${item.name || 'sin-nombre'}-${item.municipality || 'sin-municipio'}`,
          type: 'Festival',
          name: item.name || 'Festival sin nombre',
          meta: [item.municipality, item.month, item.genre].filter(Boolean).join(' · ') || 'Sin datos de ubicación',
          department: item.department,
          color: this.LAYER_ACCENTS['Festivales'],
          record: { ...item, type: 'Festival' }
        });
      });
    }
    
    /*
     * LA AGENDA NO ENTRA AL DIRECTORIO, y es deliberado. El directorio lista PROCESOS —lo que está
     * registrado en un territorio— y un evento no es un proceso: es algo que ocurre en una fecha.
     * Mezclarlos hacía que «6 registros» contara cosas de dos naturalezas distintas. Los eventos
     * tienen su propia pestaña en la columna de lectura.
     */

    if (directoryCategory === 'Todos' || directoryCategory === 'Escuelas') {
      (schools || []).forEach((item: any) => {
        if (!item) return;
        all.push({
          id: item.id || `school-${item.name || 'sin-nombre'}-${item.municipality || 'sin-municipio'}`,
          type: 'Escuela',
          name: item.name || 'Escuela sin nombre',
          meta: [item.municipality, item.status, item.students ? `${this.formatearCifra(item.students)} estudiantes` : ''].filter(Boolean).join(' · ') || 'Sin datos de ubicación',
          department: item.department,
          color: this.LAYER_ACCENTS['Escuelas de Música'],
          record: { ...item, type: 'Escuela' }
        });
      });
    }
    
    if (directoryCategory === 'Todos' || directoryCategory === 'Mercados') {
      (markets || []).forEach((item: any) => {
        if (!item) return;
        all.push({
          id: item.id || `market-${item.name || 'sin-nombre'}-${item.municipality || 'sin-municipio'}`,
          type: 'Mercado',
          name: item.name || 'Mercado sin nombre',
          meta: [item.municipality, item.periodicity, item.openCall === 'Sí' ? 'Convocatoria abierta' : ''].filter(Boolean).join(' · ') || 'Sin datos de ubicación',
          department: item.department,
          color: this.LAYER_ACCENTS['Mercados Musicales'],
          record: { ...item, type: 'Mercado' }
        });
      });
    }
    
    if (directoryCategory === 'Todos' || directoryCategory === 'Redes') {
      (redes || []).forEach((item: any) => {
        if (!item) return;
        all.push({
          id: item.id || `redes-${item.name || 'sin-nombre'}-${item.municipality || 'sin-municipio'}`,
          type: 'Redes de Documentación',
          name: item.name || 'Red de Documentación sin nombre',
          meta: [item.municipality, item.centerType].filter(Boolean).join(' · ') || 'Sin datos de ubicación',
          department: item.department,
          color: this.LAYER_ACCENTS['Redes de Documentación'],
          record: { ...item, type: 'Redes de Documentación' }
        });
      });
    }
    
    if (directoryCategory === 'Todos' || directoryCategory === 'Lutieres') {
      (lutieres || []).forEach((item: any) => {
        if (!item) return;
        all.push({
          id: item.id || `lutier-${item.name || 'sin-nombre'}-${item.municipality || 'sin-municipio'}`,
          type: 'Lutieres',
          name: item.name || 'Lutier sin nombre',
          meta: [item.municipality, item.oficio].filter(Boolean).join(' · ') || 'Sin datos de ubicación',
          department: item.department,
          color: this.LAYER_ACCENTS['Lutieres'],
          record: { ...item, type: 'Lutieres' }
        });
      });
    }

    if (directoryCategory === 'Todos' || directoryCategory === 'Espacios') {
      espacios.forEach((item: NetworkRecord) => {
        all.push({
          id: item.id || `espacio-${item.name || 'sin-nombre'}-${item['municipality'] || 'sin-municipio'}`,
          type: 'Espacios',
          name: item.name || 'Espacio sin nombre',
          meta: [item['municipality'], item['centerType']].filter(Boolean).join(' · ') || 'Sin datos de ubicación',
          department: item.department,
          color: this.LAYER_ACCENTS['Espacios'],
          record: { ...item, type: 'Espacios' }
        });
      });
    }

    return all
      // EL MUNICIPIO ACOTA LO QUE SE LISTA Y LO QUE SE DIBUJA, porque `fichasDelDirectorio` es la
      // fuente de las dos cosas: la columna derecha y los marcadores del mapa.
      .filter((item) => !acotaMunicipio || String(item?.record?.municipality ?? '').trim() === municipio)
      .sort((a, b) => {
        const nameA = String(a.name || '').trim();
        const nameB = String(b.name || '').trim();
        return nameA.localeCompare(nameB);
      });
  });

  fichasFiltradasDelDirectorio = computed(() => {
    const query = this.busquedaDelDirectorio().toLowerCase().trim();
    const records = this.fichasDelDirectorio();
    if (!query) return records;
    return records.filter(item => {
      if (!item) return false;
      const nameMatch = item.name?.toLowerCase().includes(query);
      const metaMatch = item.meta?.toLowerCase().includes(query);
      const deptMatch = item.department?.toLowerCase().includes(query);
      return nameMatch || metaMatch || deptMatch;
    });
  });

  /** Los filtros puestos, legibles, para la cabecera de todo lo que se exporta. */
  readonly filtrosParaExportar = computed<string[]>(() => {
    const textos = this.filtrosPuestos().map((filtro) => `${filtro.etiqueta}: ${filtro.valor}`);
    if (this.lenteDeLectura() !== 'territorial') textos.push(`Lente: ${this.lenteActivo().etiqueta}`);
    if (this.grupoResaltado()) textos.push(`Grupo resaltado: ${this.grupoResaltado()}`);
    return textos;
  });


  // ---------------------------------------------------------------------------
  // TABLERO (L4, M-3): PANORAMA CON FILTROS CRUZADOS
  //
  // La vista Gráfico tenía siete lecturas en pestañas, una a la vez. El PANORAMA las reúne en una
  // pantalla por pregunta —dónde, de qué está hecho, cómo ha evolucionado, cuándo ocurre— y cada marca
  // escribe en los MISMOS filtros de la columna izquierda y de la dirección (`departamento`, `grupo`):
  // elegir en un gráfico cambia a los demás, a la tabla y al mapa. Las siete lecturas siguen en
  // «Lecturas» mientras sus formas se migran al tablero. Diagnóstico y reglas: informes L4.
  // ---------------------------------------------------------------------------

  readonly fichas: Record<'registros-por-departamento' | 'composicion-declarada' | 'ediciones-por-anio' | 'eventos-por-mes', FichaDeIndicador> = {
    'registros-por-departamento': fichaDelIndicador('registros-por-departamento'),
    'composicion-declarada': fichaDelIndicador('composicion-declarada'),
    'ediciones-por-anio': fichaDelIndicador('ediciones-por-anio'),
    'eventos-por-mes': fichaDelIndicador('eventos-por-mes'),
  };

  /**
   * La pestaña de la vista Gráfico: el Panel general (aquí) o una de las cinco de análisis (fragmento diferido).
   * Viaja en la dirección. Las pestañas y sus preguntas viven en `pestanas-del-tablero.ts`.
   */
  readonly vistaDelTablero = signal<PestanaDelTablero>('panel');
  readonly pestanasDelTablero = computed(() => pestanasConTextos((clave) => this.webTexts.getWebText(clave)));
  readonly preguntasOrientadoras = computed(() => this.pestanasDelTablero().filter((p) => p.id !== 'panel'));

  /** Los filtros compartidos por las pestañas de análisis: los guarda la página para que sobrevivan al cambio de pestaña. */
  readonly filtrosDelAnalisis = signal<FiltrosDelAnalisis>({ tipos: [], departamento: '', practica: '', territorio: '' });
  readonly cambiarFiltrosDelAnalisis = (cambio: Partial<FiltrosDelAnalisis>): void =>
    this.filtrosDelAnalisis.update((actual) => ({ ...actual, ...cambio }));

  /**
   * Una pregunta orientadora del Panel general lleva a la pestaña que la responde CONSERVANDO lo elegido: el
   * departamento, el tipo de proceso (la capa) y el grupo resaltado pasan a los filtros compartidos.
   */
  irAPestana(destino: PestanaDelTablero): void {
    if (destino !== 'panel') {
      const cambio: { -readonly [K in keyof FiltrosDelAnalisis]?: FiltrosDelAnalisis[K] } = {};
      if (this.departamentoElegido() !== 'Nacional') {
        cambio.departamento = nombrePropio(MapDomain.getDepartmentDisplayName(this.departamentoElegido()));
      }
      if (this.capaActiva() !== 'General') cambio.tipos = [this.capaActiva()];
      const grupo = this.grupoResaltado();
      if (grupo) cambio[this.dimensionDeComposicion() === 'practicas' ? 'practica' : 'territorio'] = grupo;
      if (Object.keys(cambio).length > 0) this.cambiarFiltrosDelAnalisis(cambio);
    }
    this.vistaDelTablero.set(destino);
  }

  /** Alterna de pestaña con las flechas, como en cualquier barra de pestañas. */
  moverPestana(evento: KeyboardEvent, actual: PestanaDelTablero): void {
    const ids = PESTANAS_DEL_TABLERO.map((p) => p.id);
    const i = ids.indexOf(actual);
    const salto = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : evento.key === 'Home' ? -i : evento.key === 'End' ? ids.length - 1 - i : 0;
    if (salto === 0) return;
    evento.preventDefault();
    const destino = ids[(i + salto + ids.length) % ids.length];
    this.vistaDelTablero.set(destino);
    queueMicrotask(() => (document.getElementById('pestana-' + destino) as HTMLElement | null)?.focus());
  }

  private readonly servicioDeEvolucion = inject(EvolucionDelEcosistemaService);
  readonly puntosDeEvolucion = signal<readonly PuntoDeEvolucion[]>([]);
  readonly estadoDeEvolucion = signal<'sin_pedir' | 'cargando' | 'listo' | 'fallo'>('sin_pedir');

  /** Pide la evolución una vez, al abrir el tablero; «Reintentar» la vuelve a pedir. */
  cargarEvolucion(): void {
    if (this.estadoDeEvolucion() === 'cargando' || this.estadoDeEvolucion() === 'listo') return;
    this.estadoDeEvolucion.set('cargando');
    this.servicioDeEvolucion.consultar().subscribe({
      next: (puntos) => { this.puntosDeEvolucion.set(puntos); this.estadoDeEvolucion.set('listo'); },
      error: () => this.estadoDeEvolucion.set('fallo'),
    });
  }

  reintentarEvolucion(): void {
    this.estadoDeEvolucion.set('sin_pedir');
    this.cargarEvolucion();
  }

  readonly animarElTablero = typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: reduce)').matches;

  nombreDelProceso(proceso: string): string {
    return proceso === 'mercado' ? 'Mercados' : proceso === 'festival' ? 'Festivales' : proceso;
  }

  /** Qué filtros cruzados hay puestos sobre el tablero, cada uno con su forma de quitarse. */
  readonly filtrosDelTablero = computed(() => {
    const filtros: { clave: 'departamento' | 'grupo'; rotulo: string; valor: string }[] = [];
    if (this.departamentoElegido() !== 'Nacional') {
      filtros.push({ clave: 'departamento', rotulo: 'Departamento', valor: this.nombreDelDepartamentoElegido() });
    }
    if (this.grupoResaltado()) filtros.push({ clave: 'grupo', rotulo: 'Grupo', valor: this.grupoResaltado() });
    return filtros;
  });

  quitarFiltroDelTablero(clave: 'departamento' | 'grupo'): void {
    if (clave === 'departamento') this.volverAVistaNacional();
    else this.grupoResaltado.set('');
  }

  /**
   * Las cifras de cabecera, TODAS sobre lo mismo que dibujan los paneles (capa y departamento elegidos).
   *
   * <b>NO REUTILIZAN LAS CIFRAS DE LAS LECTURAS</b>: «Registros» de las lecturas suma todas las capas
   * aunque el título diga «Festivales», y «Municipios» no sigue al departamento. Aquí una cifra de
   * cabecera que no cuadrara con la barra de debajo desmentiría al gráfico entero.
   */
  readonly cifrasDelTablero = computed(() => {
    const panel = this.panelDeDepartamentos();
    const elegido = panel.elegida ? this.rankingDepartamental().find((fila) => MapDomain.normalizeDepartmentName(fila.clave) === panel.elegida) : null;
    const registros = elegido ? elegido.valor : panel.total;
    const municipios = new Set(this.fichasDelDirectorio()
      .map((ficha: any) => `${MapDomain.normalizeDepartmentName(ficha?.department ?? '')}|${String(ficha?.record?.municipality ?? '').trim()}`)
      .filter((clave: string) => !clave.endsWith('|'))).size;
    const cobertura = this.coberturaTerritorial();
    const ediciones = this.evolucionDelEcosistema().total;
    return [
      {
        id: 'registros', etiqueta: this.configuracionDeLaCapa().label, valor: this.formatearCifra(registros),
        pie: elegido ? `de ${this.formatearCifra(panel.total)} en el país` : `en ${this.rankingDepartamental().length} departamentos`,
      },
      { id: 'municipios', etiqueta: 'Municipios con actividad', valor: this.formatearCifra(municipios), pie: 'con al menos un registro' },
      { id: 'cobertura', etiqueta: 'Cobertura territorial', valor: `${cobertura.porcentaje} %`, pie: `${cobertura.conRegistros} de ${cobertura.total} departamentos` },
      {
        id: 'ediciones', etiqueta: 'Ediciones publicadas',
        valor: this.capaTieneEvolucion() && this.estadoDeEvolucion() === 'listo' ? this.formatearCifra(ediciones) : '—',
        pie: this.capaTieneEvolucion() ? 'Festivales y Mercados, todos los años' : 'esta capa no las registra',
      },
    ];
  });

  // — ¿Cuántos hay y dónde? —
  readonly verTodosLosDepartamentos = signal(false);
  private readonly CABEZA_DE_DEPARTAMENTOS = 10;

  readonly panelDeDepartamentos = computed(() => {
    const todas = this.rankingDepartamental();
    const total = todas.reduce((suma, fila) => suma + fila.valor, 0);
    const visibles = this.verTodosLosDepartamentos() ? todas : todas.slice(0, this.CABEZA_DE_DEPARTAMENTOS);
    // La elegida SIEMPRE se ve, aunque quede fuera de la cabeza: si no, elegirla la haría desaparecer.
    const elegida = this.departamentoElegido() === 'Nacional' ? '' : this.departamentoNormalizado();
    const filas = elegida && !visibles.some((fila) => MapDomain.normalizeDepartmentName(fila.clave) === elegida)
      ? [...visibles, ...todas.filter((fila) => MapDomain.normalizeDepartmentName(fila.clave) === elegida)]
      : visibles;
    return {
      total, ocultos: todas.length - filas.length, elegida,
      filas: filas.map((fila) => ({ clave: MapDomain.normalizeDepartmentName(fila.clave), etiqueta: nombrePropio(fila.etiqueta), valor: fila.valor })),
    };
  });

  readonly opcionDeDepartamentos = computed(() => {
    const panel = this.panelDeDepartamentos();
    return opcionBarras(panel.filas, { color: this.colorCapaActiva(), seleccion: panel.elegida, total: panel.total, animar: this.animarElTablero });
  });

  readonly alturaDeDepartamentos = computed(() => Math.max(160, this.panelDeDepartamentos().filas.length * 28 + 16));

  elegirDepartamentoDelTablero(etiqueta: string): void {
    const fila = this.panelDeDepartamentos().filas.find((item) => item.etiqueta === etiqueta || item.clave === etiqueta);
    if (fila) this.abrirDepartamento(fila.clave);
  }

  // — ¿De qué está hecho? —
  readonly opcionDeComposicion = computed(() => {
    const composicion = this.composicionDelEcosistema();
    return opcionMosaico(
      composicion.filas.map((fila) => ({ nombre: fila.nombre, total: fila.total, color: this.colorCapaActiva() })),
      { seleccion: this.grupoResaltado(), fichas: composicion.fichas, animar: this.animarElTablero, sinClasificar: Analitica.SIN_CLASIFICAR });
  });

  readonly datosDeComposicion = computed<FilaDeDatos[]>(() =>
    this.composicionDelEcosistema().filas.map((fila) => ({ clave: fila.nombre, celdas: [fila.nombre, fila.total, `${fila.cuota} %`] })));

  elegirGrupoDelTablero(nombre: string): void {
    // El grupo resaltado se lee con el lente puesto: sin alinear el lente con la dimensión del gráfico,
    // elegir un grupo no se vería en el mapa ni en la tabla.
    if (this.lenteDeLectura() !== this.dimensionDeComposicion() && this.grupoResaltado() !== nombre) {
      this.elegirLente(this.dimensionDeComposicion());
    }
    this.alternarGrupoResaltado(nombre);
  }

  // — ¿Cómo ha evolucionado? —
  readonly evolucionDelEcosistema = computed(() => {
    const ambito = this.departamentoElegido() === 'Nacional' ? '' : this.departamentoNormalizado();
    const capa = this.capaActiva();
    const procesos = capa === 'Festivales' ? ['festival'] : capa === 'Mercados Musicales' ? ['mercado'] : null;
    const puntos = procesos ? this.puntosDeEvolucion().filter((punto) => procesos.includes(punto.proceso)) : this.puntosDeEvolucion();
    return evolucionPorAnio(puntos, ambito, MapDomain.normalizeDepartmentName);
  });

  /** Solo Festivales y Mercados tienen ediciones por año; el resto de capas no registra esta lectura. */
  readonly capaTieneEvolucion = computed(() => ['General', 'Festivales', 'Mercados Musicales'].includes(this.capaActiva()));

  readonly opcionDeEvolucion = computed(() => {
    const evolucion = this.evolucionDelEcosistema();
    return opcionColumnas(
      evolucion.anios.map(String),
      evolucion.series.map((serie) => ({
        nombre: this.nombreDelProceso(serie.proceso),
        color: this.LAYER_ACCENTS[serie.proceso === 'mercado' ? 'Mercados Musicales' : 'Festivales'],
        datos: serie.datos,
      })),
      { animar: this.animarElTablero, unidad: 'ediciones' });
  });

  readonly datosDeEvolucion = computed<FilaDeDatos[]>(() => {
    const evolucion = this.evolucionDelEcosistema();
    return evolucion.anios.map((anio, i) => ({ clave: String(anio), celdas: [anio, ...evolucion.series.map((serie) => serie.datos[i])] }));
  });

  readonly encabezadosDeEvolucion = computed(() => ['Año', ...this.evolucionDelEcosistema().series.map((serie) => this.nombreDelProceso(serie.proceso))]);

  // — ¿Cuándo ocurre? —
  readonly opcionDeCalendario = computed(() => {
    const tiempo = this.agendaEnElTiempo();
    return opcionColumnas(
      tiempo.meses.map((mes) => mes.etiqueta),
      [{ nombre: 'Eventos', color: this.LAYER_ACCENTS['Agenda'], datos: tiempo.meses.map((mes) => mes.total) }],
      { marcada: tiempo.mesActual, animar: this.animarElTablero, unidad: 'eventos' });
  });

  readonly datosDeCalendario = computed<FilaDeDatos[]>(() =>
    this.agendaEnElTiempo().meses.map((mes) => ({ clave: String(mes.indice), celdas: [mes.etiqueta, mes.total] })));

  /** Exporta el gráfico de un panel: pone su lectura como la activa y reutiliza la exportación con fuente. */
  async exportarPanel(lectura: 'departamentos' | 'composicion' | 'evolucion' | 'calendario', formato: string): Promise<void> {
    this.formaDelGrafico.set(lectura);
    await this.exportarGrafico(formato);
  }

  get accionesDelPanel(): AccionDeRegistro[] { return this.accionesDeExportarGrafico; }

  /** Lo que el gráfico puesto dibuja, como filas de etiqueta y valor: de ahí salen el PNG, el SVG y el CSV. */
  readonly datosDeLaLectura = computed<{ titulo: string; encabezados: string[]; filas: Celda[][]; barras: FilaDeBarra[] }>(() => {
    const ambito = this.departamentoElegido() === 'Nacional' ? 'en el país' : `en ${this.nombreDelDepartamentoElegido()}`;
    const capa = this.configuracionDeLaCapa().label;
    const lectura = this.indicadoresDelGrafico().find((item) => item.id === this.formaDelGrafico());
    const titulo = `${capa} ${ambito}: ${lectura?.etiqueta ?? 'lectura'}`;
    const doble = (filas: { etiqueta: string; valor: number }[], etiqueta: string, valor: string) => ({
      titulo, encabezados: [etiqueta, valor],
      filas: filas.map((fila) => [fila.etiqueta, fila.valor] as Celda[]), barras: filas,
    });
    switch (this.formaDelGrafico()) {
      case 'composicion':
        return doble(this.composicionDelEcosistema().filas.map((f) => ({ etiqueta: f.nombre, valor: f.total })), 'Grupo', 'Registros');
      case 'cruce':
        return doble(this.matrizDelLente().grupos.map((g) => ({ etiqueta: g.nombre, valor: g.departamentos })), 'Grupo', 'Departamentos en los que está');
      case 'municipios': {
        const filas = this.rankingMunicipal();
        return {
          titulo, encabezados: ['Municipio', 'Departamento', 'Registros'],
          filas: filas.map((f) => [f.municipio, f.departamento, f.total] as Celda[]),
          barras: filas.map((f) => ({ etiqueta: `${f.municipio} (${f.departamento})`, valor: f.total })),
        };
      }
      case 'evolucion': {
        const e = this.evolucionDelEcosistema();
        return {
          titulo: `${capa} ${ambito}: Ediciones por año`,
          encabezados: ['Año', ...e.series.map((serie) => this.nombreDelProceso(serie.proceso))],
          filas: e.anios.map((anio, i) => [String(anio), ...e.series.map((serie) => serie.datos[i])] as Celda[]),
          barras: e.anios.map((anio, i) => ({ etiqueta: String(anio), valor: e.series.reduce((suma, serie) => suma + serie.datos[i], 0) })),
        };
      }
      case 'calendario':
        return doble(this.agendaEnElTiempo().meses.map((m) => ({ etiqueta: m.etiqueta, valor: m.total })), 'Mes', 'Eventos');
      case 'cobertura': {
        const c = this.coberturaTerritorial();
        return doble([{ etiqueta: 'Departamentos con registros', valor: c.conRegistros }, { etiqueta: 'Departamentos sin registros', valor: c.total - c.conRegistros }], 'Departamentos', 'Cantidad');
      }
      case 'sin-situar': {
        const c = this.procesosSinSituar();
        return doble([{ etiqueta: 'Situados en el mapa', valor: c.situados }, ...c.causas.map((x) => ({ etiqueta: x.titulo, valor: x.cifra }))], 'Procesos', 'Cantidad');
      }
      default:
        return doble(this.rankingDepartamental().map((f) => ({ etiqueta: f.etiqueta, valor: f.valor })), 'Departamento', 'Registros');
    }
  });

  readonly accionesDeExportarGrafico: AccionDeRegistro[] = [
    { id: 'png', etiqueta: 'Descargar imagen (PNG)', tono: 'principal' },
    { id: 'svg', etiqueta: 'Descargar vector (SVG)' },
    { id: 'csv', etiqueta: 'Descargar datos (CSV)' },
  ];

  /** La cabecera común de lo que sale del mapa: título, filtros, fecha y fuente. */
  cabeceraDeExportacion(titulo: string): CabeceraDeExportacion {
    return { titulo, filtros: this.filtrosParaExportar(), fecha: new Date() };
  }

  async exportarGrafico(formato: string): Promise<void> {
    const datos = this.datosDeLaLectura();
    const cabecera = this.cabeceraDeExportacion(datos.titulo);
    const base = `simus-${datos.titulo}`;
    if (formato === 'csv') {
      descargarTexto(aCsv(cabecera, datos.encabezados, datos.filas), 'text/csv', nombreDeArchivo(base, cabecera.fecha, 'csv'));
      return;
    }
    const dibujo = aSvg(cabecera, datos.barras, { color: this.colorCapaActiva() });
    if (formato === 'svg') {
      descargarTexto(dibujo.svg, 'image/svg+xml', nombreDeArchivo(base, cabecera.fecha, 'svg'));
    } else if (formato === 'png') {
      descargarBlob(await svgAPng(dibujo.svg, dibujo.ancho, dibujo.alto), nombreDeArchivo(base, cabecera.fecha, 'png'));
    }
  }

  contenidoDeLaFichaEnDetalle = computed(() => this.construirContenidoDeFicha(this.fichaEnDetalle()));

  /**
   * El contenido de una ficha, sea cual sea el marco que la enseñe.
   *
   * SE EXTRAJO DEL COMPUTED PARA QUE LO USEN LOS DOS CAMINOS —el modal del directorio y el panel del
   * municipio— sin duplicarlo. Dos constructores «parecidos» de la misma ficha se separan en cuanto
   * uno gana un campo, y el que se quede atrás no lo dirá.
   */
  private construirContenidoDeFicha(fichaEnDetalle: FichaConDetalle | null) {
    if (!fichaEnDetalle) return { highlights: [], sections: [] };
    const record = fichaEnDetalle.record || {};

    const isValidField = (val: any) => {
      if (val === undefined || val === null || val === '') return false;
      const str = String(val).trim().toLowerCase();
      return str !== 'sin dato' && str !== 'sin datos' && str !== 'no aplica' && str !== 'n/a';
    };

    if (fichaEnDetalle.type === 'Festival') {
      // LA FICHA PEDIA DOCE CAMPOS Y EL CONTRATO ENTREGABA CUATRO, y las dos mitades del desajuste
      // estaban mal por motivos distintos:
      //
      //   · `zone`, `ubicacion_especifica`, `contactEmail` y `contactPhone` NO CRUZAN, y no por
      //     descuido: la lectura pública los excluye a propósito —«ni correo, ni teléfono, ni
      //     director: lo único que cruza al DTO público es la presencia pública del Festival»—.
      //     Pedirlos aquí era pedir lo que alguien decidió no publicar.
      //   · `instagram`, `facebook`, `otroEnlace` y `periodicidad` SI CRUZABAN y se tiraban en el
      //     servicio del mapa. El dato estaba y la ficha no lo veía.
      //
      // Y la línea de «Financiación» era peor que un hueco: `record.funding || 'Pública y recursos
      // PNMC'` AFIRMABA la fuente de financiación de todos los Festivales sin un solo dato detrás.
      // Nada en el modelo dice cómo se financia un Festival. Un campo vacío no se enseña; uno
      // inventado se lee como cierto.
      const itemsCirculacion = [
        { label: 'Nivel de Cobertura', value: record.coverageLevel },
        { label: 'Cuándo ocurre', value: this.temporadaDelFestival(record) },
        { label: 'Periodicidad', value: record.periodicityDetail || record.periodicity },
        { label: 'Territorios Sonoros', value: MapDomain.clasificacionLegible(record.linkedSonorousTerritories) },
        { label: 'Prácticas Musicales', value: MapDomain.clasificacionLegible(record.practices) || record.genre },
      ].filter(item => item.value && isValidField(item.value));

      const itemsContacto = [
        { label: 'Sitio Web Oficial', value: record.websiteUrl },
        { label: 'Instagram', value: record.instagramUrl },
        { label: 'Facebook', value: record.facebookUrl },
        { label: 'Otro Enlace', value: record.otherUrl },
      ].filter(item => isValidField(item.value));

      return {
        highlights: [],
        sections: [
          { title: 'Lectura General', body: record.description || 'No hay descripción pública disponible para este festival.' },
          { title: 'Circulación e Impacto', items: itemsCirculacion },
          { title: 'Contacto y Canales', items: itemsContacto },
        ],
      };
    }

    // AQUI HABIA CUATRO RAMAS MAS —Escuela, Mercado, Redes de Documentación y Lutieres— con su
    // lista de campos cada una: ciento cuarenta líneas construyendo fichas que no se pueden abrir.
    //
    // Sus tablas las retiró `V20260904_01`, sus cinco listas de registros llegan siempre vacías y
    // ningún camino de la pantalla puede poner `type` en esos cuatro valores. No era código que
    // «todavía no se usa»: era código que describe un modelo de datos que el proyecto ya retiró, y
    // que además leía campos —`students`, `teachers`, `marketMode`, `oficio`— que ninguna lectura
    // pública entrega.
    //
    // Cuando esos procesos vuelvan lo harán con su modelo y su revisión propios —es lo que anuncian
    // las cuatro pastillas «Pronto» de la columna derecha—, y su ficha se escribirá contra ese
    // modelo, no contra este. Guardarla mientras tanto sólo garantizaba que llegara desactualizada.

    return { highlights: [], sections: [] };
  }

  metadatosDeLaFicha = computed(() => {
    const fichaEnDetalle = this.fichaEnDetalle();
    if (!fichaEnDetalle) return '';
    const record = fichaEnDetalle.record || {};
    const type = fichaEnDetalle.type;
    const location = [record.municipality || record.municipio, record.department || record.departamento].filter(Boolean).join(', ');

    if (type === 'Festival') {
      return [
        record.versions ? `${record.versions} ediciones` : null,
        record.organizer ? `Organiza: ${record.organizer}` : null,
        location
      ].filter(Boolean).join('  ·  ');
    }
    // Y aquí las mismas cuatro, por el mismo motivo: ver la nota de `construirContenidoDeFicha`.
    return fichaEnDetalle.meta || location;
  });

  limitesDeColombia = computed(() => {
    const cartografia = this.cartografia();
    if (!cartografia) return null;
    const nationalFeatures = cartografia.features.filter(
      (feature: any) => MapDomain.getFeatureDepartmentNormalizedName(feature) !== MapDomain.ARCHIPELAGO_NORMALIZED_NAME
    );
    return L.geoJSON({
      ...cartografia,
      features: nationalFeatures.length > 0 ? nationalFeatures : cartografia.features,
    }).getBounds();
  });

  limitesDeColombiaConMargen = computed(() => {
    const bounds = this.limitesDeColombia();
    return bounds ? bounds.pad(-0.065) : null;
  });

  archipelagoFeature = computed(() => {
    const cartografia = this.cartografia();
    return cartografia?.features?.find(
      (feature: any) => MapDomain.getFeatureDepartmentNormalizedName(feature) === MapDomain.ARCHIPELAGO_NORMALIZED_NAME
    ) || null;
  });

  archipielagoAmpliado = computed(() => {
    return MapDomain.buildScaledFeature(this.archipelagoFeature());
  });

  resumenDelArchipielago = computed(() => {
    return this.resumenPorDepartamento()[MapDomain.ARCHIPELAGO_NORMALIZED_NAME] || MapDomain.EMPTY_DEPARTMENT_SUMMARY;
  });

  archipelagoCount = computed(() => {
    return (this.conteosDeLaCapaActiva() || {})[MapDomain.ARCHIPELAGO_NORMALIZED_NAME] || 0;
  });

  archipelagoIsSelected = computed(() => {
    return this.departamentoNormalizado() === MapDomain.ARCHIPELAGO_NORMALIZED_NAME;
  });

  estiloDelArchipielago = computed(() => {
    const hasSelectedDept = this.departamentoElegido() !== 'Nacional';
    const archSelected = this.archipelagoIsSelected();
    const visMode = this.modoDeDibujo();
    const capaActiva = this.capaActiva();
    const archipelagoCount = this.archipelagoCount();

    if (hasSelectedDept && archSelected) {
      return {
        ...this.SELECTED_DEPARTMENT_STYLE,
        fillOpacity: 0.9,
        weight: 3,
      };
    }

    if (hasSelectedDept) {
      return {
        ...this.MUTED_DEPARTMENT_STYLE,
        fillOpacity: 0.42,
      };
    }

    if (visMode === 'practicas_territorios') {
      return {
        fillColor: '#f8fafc',
        fillOpacity: 0.35,
        color: 'rgba(203, 213, 225, 0.45)',
        weight: 1.2,
        opacity: 0.5,
      };
    }

    const baseStyle = MapDomain.getChoroplethStyles(archipelagoCount, archSelected, capaActiva);
    return {
      ...baseStyle,
      fillOpacity: Math.max(baseStyle.fillOpacity, 0.78),
      weight: baseStyle.weight,
      color: baseStyle.color,
    };
  });

  activeInfoNote = computed(() => {
    if (this.esCapaGeneral()) {
      return 'La capa General integra los festivales y los mercados visibles por departamento para ofrecer una lectura sintética del ecosistema musical.';
    }
    if (this.isSchoolsLayer()) {
      return `La capa de Escuelas publica ${MapDomain.SCHOOL_PUBLICATION_POLICY.public.length} campos territoriales e institucionales y reserva información sensible.`;
    }
    if (this.isMarketsLayer()) {
      return `La capa de Mercados publica ${MapDomain.MARKET_PUBLICATION_POLICY.public.length} campos territoriales y programáticos y reserva campos sensibles.`;
    }
    return 'La base de datos del mapa está en construcción y consolidación permanente con registros territoriales del ecosistema musical.';
  });

  municipiosDelDepartamento = signal<any>(null);

  /**
   * Cargador del fragmento municipal de un departamento, tal como lo entrega
   * `fetchColombiaGeoJson`. Con el TopoJSON partido en departamentos + un fichero por
   * departamento, la coleccion de municipios que viene en el paquete llega VACIA y los
   * municipios hay que pedirlos de uno en uno. Sin esto, abrir un departamento filtraba
   * una lista vacia y no dibujaba nada.
   */
  private cargadorDeMunicipios?: (departmentCode: string) => Promise<any>;
  /** Fragmentos ya descargados, por codigo de departamento. */
  private municipiosPorDepartamento = new Map<string, any[]>();

  constructor() {
    // LO PRIMERO, ANTES DE CUALQUIER EFECTO QUE LEA UN FILTRO. `enlazarFiltrosConLaUrl` hidrata las
    // señales con lo que traiga la dirección y sólo después empieza a escribirla. Si fuera después
    // del efecto de arranque, el mapa encuadraría Colombia entera y acto seguido saltaría al
    // departamento del enlace: un parpadeo, y un `fitBounds` de más en cada visita compartida.
    enlazarFiltrosConLaUrl(this.filtrosDelMapa());

    // La evolución se pide al abrir el gráfico (no en el arranque del mapa, que no la necesita).
    effect(() => { if (this.vistaCentral() === 'grafico') untracked(() => this.cargarEvolucion()); });
    // El análisis avanzado es un fragmento aparte: se descarga la primera vez que se abre (también desde un enlace).
    effect(() => {
      if (this.vistaCentral() === 'grafico' && this.vistaDelTablero() !== 'panel') untracked(() => void this.cargarAnalisisAvanzado());
    });

    // Arranque del mapa, cuando ya hay contenedor y geometria.
    //
    // `untracked` NO es cosmetica. `montarElMapaUnaVez` CREA a su vez dos `effect()`
    // —el encuadre nacional y el acercamiento al departamento—, y Angular prohibe crear
    // un efecto dentro de un contexto reactivo: lanza `NG0602`. Llamarlo directamente
    // desde aqui reventaba en la primera de esas dos lineas, asi que TODO lo que venia
    // despues no llegaba a ejecutarse nunca:
    //
    //   - el mapa no encuadraba Colombia (`fitBounds` sobre `limitesDeColombiaConMargen`),
    //   - no se acercaba al elegir departamento,
    //   - y la capa base de MapLibre se quedaba con `style` en nulo, sin pedir una sola
    //     teja, porque su carga asincrona moria con la excepcion.
    //
    // Las dos lecturas de senal se quedan FUERA de `untracked`: son las que registran
    // las dependencias del efecto. Solo la llamada va dentro.
    effect(() => {
      const geo = this.cartografia();
      const ready = this.contenedorDelMapaListo();
      if (geo && ready && isPlatformBrowser(this.platformId)) {
        untracked(() => this.montarElMapaUnaVez());
      }
    });

    // LOS PUNTOS MUNICIPALES SE PIDEN AL ENTRAR AL MODO, Y SE PIDEN AQUI Y NO EN EL
    // BOTON. Al modo se entra por tres sitios: el boton del panel y los pasos 5 y 6 del
    // tutorial, que escriben `modoDeDibujo` directamente (lineas 2992 y 2996).
    // Colgar la carga del clic dejaba el modo sin un solo senalador cuando lo abria el
    // tutorial, sin error y sin aviso.
    //
    // `untracked` alrededor de la llamada: escribe tres senales, y no queremos que esas
    // escrituras se registren como dependencias de este mismo efecto.
    effect(() => {
      const modo = this.modoDeDibujo();
      // LOS DOS MODOS DE PUNTO, y no sólo el de símbolos. El de calor sitúa por el mismo catálogo;
      // dejarlo fuera lo dejaba en blanco cuando se llegaba a él por el tutorial o por un enlace
      // compartido, que son justo los dos caminos que no pasan por el botón.
      const necesitaPuntos = modo === 'practicas_territorios' || modo === 'calor';
      if (necesitaPuntos && isPlatformBrowser(this.platformId)) {
        untracked(() => this.cargarPuntosMunicipales());
      }
    });

    // Y LA VISTA DE GRAFICO ENTERA, POR LO MISMO. Es una lectura SOBRE el catálogo municipal: sin
    // pedirlo concluye «no se pudo cargar» sobre algo que nadie intentó cargar.
    //
    // SE PIDE AL ABRIR LA VISTA Y NO AL ABRIR LA LECTURA, que era el error: «Se pueden situar» es
    // uno de los SIETE indicadores de la franja superior, y esa franja está a la vista desde el
    // primer momento. Colgar la carga de la lectura dejaba la tarjeta anunciando «0 %· 141 sin
    // situar» a quien no la había abierto —es decir, a todo el mundo—, que es exactamente la
    // acusación falsa que este apartado vino a corregir.
    effect(() => {
      const vista = this.vistaCentral();
      if (vista === 'grafico' && isPlatformBrowser(this.platformId)) {
        untracked(() => this.cargarPuntosMunicipales());
      }
    });

    // Effect to update map layers when reactive filters change.
    // Las lecturas sueltas no son codigo muerto: registran las dependencias del
    // effect. Sin ellas, cambiar un filtro no vuelve a dibujar las capas.
    effect(() => {
      this.capaActiva();
      this.departamentoElegido();
      this.modoDeDibujo();
      this.tipoDeInfluencia();
      // Los puntos municipales llegan por red DESPUES del primer dibujo. Sin esta
      // lectura el efecto no se entera de que llegaron y el modo se queda sin un solo
      // senalador hasta que el usuario toque otro filtro.
      this.puntosMunicipales();
      this.activeThematicOption();
      // EL LENTE Y SU RESALTADO REDIBUJAN EL MAPA, que es lo que los hace visibles. Sin estas dos
      // lecturas, elegir «por territorios sonoros» cambiaba la columna izquierda y el mapa seguía
      // idéntico: las gafas puestas y el paisaje sin cambiar. Sustituyen a las dos de abajo, que
      // leían los filtros retirados.
      this.lenteDeLectura();
      this.grupoResaltado();
      this.municipioElegido();
      this.contenedorDelMapaListo();
      this.conteosDeLaCapaActiva();

      this.redibujarLasCapas();
    });

    // Municipios del departamento abierto.
    //
    // Antes esto SOLO filtraba `todosLosMunicipios()`, que se llena con los municipios
    // que vengan embebidos en el paquete cartografico. Desde que el TopoJSON se partio
    // —33 departamentos por un lado, un fichero por departamento por otro— esa coleccion
    // llega vacia, asi que el filtro devolvia cero municipios y el mapa no dibujaba
    // ninguno. Ninguna prueba se puso en rojo: filtrar una lista vacia da una lista
    // vacia, y eso es «correcto».
    //
    // Ahora se conserva el filtro para el caso embebido, y si no hay nada se pide el
    // fragmento del departamento al API. Lo vigila `npm run mapa:territorios`.
    effect(() => {
      const departamentoElegido = this.departamentoElegido();
      const departamentoNormalizado = this.departamentoNormalizado();
      this.cartografia(); // Dependencia del effect, no un valor que se use aqui.
      const allMun = this.todosLosMunicipios();

      if (departamentoElegido === 'Nacional') {
        this.municipiosDelDepartamento.set(null);
        return;
      }

      const embebidos = allMun.filter((f) => {
        const deptName = MapDomain.normalizeDepartmentName(f.properties?.departmentName);
        return deptName === departamentoNormalizado;
      });

      if (embebidos.length) {
        this.municipiosDelDepartamento.set({ type: 'FeatureCollection', features: embebidos });
        return;
      }

      untracked(() => this.cargarMunicipiosRemotos(departamentoElegido));
    });

    // Effect to handle navigationRequest triggers from router
    effect(() => {
      const req = this.navigationService.mapaNavigationRequest();
      if (req && req.requestId) {
        const nextLayer = ECOSYSTEM_LAYERS.some((layer) => layer.key === req.targetLayer)
          ? req.targetLayer
          : 'General';
        this.capaActiva.set(nextLayer);
        this.departamentoElegido.set('Nacional');
        this.pestanaLateral.set('resumen');
        this.senalDeReencuadre.update(c => c + 1);
      }
    });
  }

  ngOnInit() {
    this.limiteDelDirectorio.set(12);
    this.abrirEnLaCapaPedida();
    
    // Lock body scroll on map load
    if (isPlatformBrowser(this.platformId)) {
      this.cargarEstilosCartografia();
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      this.loadTutorialAuto();
    }

    this.fetchMapData();
    this.cargarDivipola();
  }

  /** Los estilos pesados del geovisor se descargan al visitar `/mapa-ecosistemico`. */
  private cargarEstilosCartografia(): void {
    for (const [href, id] of ESTILOS_CARTOGRAFIA) {
      if (document.getElementById(id)) continue;
      const enlace = document.createElement('link');
      enlace.id = id;
      enlace.rel = 'stylesheet';
      enlace.href = href;
      document.head.appendChild(enlace);
    }
  }

  /**
   * Trae el catalogo DIVIPOLA —los municipios de cada departamento— al estado en memoria
   * del dominio.
   *
   * FALTABA AQUI. `setRuntimeDivipolaByDepartment` solo lo llamaba la pagina de Agenda,
   * asi que quien entraba directo a `/mapa` trabajaba con el catalogo vacio: sin el, ni
   * `getSortedDepartmentNames` ni `resolveDepartmentDivipolaKey` tienen de donde tirar, y
   * el nombre de un municipio no se puede contrastar contra el territorio al que dice
   * pertenecer.
   *
   * Si la peticion falla no se detiene el mapa: la cartografia y los conteos no dependen
   * de esto, y un geovisor sin catalogo es peor que uno sin municipios pero sigue siendo
   * un geovisor.
   */
  private cargarDivipola(): void {
    this.catalog.cargarDivipolaPorDepartamento().subscribe({
      next: (agrupado) => {
        MapDomain.setRuntimeDivipolaByDepartment(agrupado);
        // Se vuelve a sembrar el catalogo de departamentos: `setRuntimeDepartmentCatalog`
        // completa los nombres que solo conoce DIVIPOLA, y al arrancar todavia no estaba.
        MapDomain.setRuntimeDepartmentCatalog(this.cartografia()?.features || []);
      },
      error: () => undefined,
    });
  }

  ngAfterViewInit() {
    this.contenedorDelMapaListo.set(Boolean(this.mapContainer));
  }

  ngOnDestroy() {
    this.comprobacionesDeDestino.forEach(clearTimeout);
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    // LO QUE EL RECORRIDO DEJA ENCENDIDO HAY QUE APAGARLO AL SALIR, y no estaba.
    //
    //   · El temporizador de la reproducción automática seguía corriendo y llamaba a
    //     `handleGoToStep` sobre un componente que ya no existe.
    //   · El oyente de desplazamiento en captura se quedaba pegado a `document` para siempre, una
    //     visita más en cada entrada al mapa.
    //   · Y la señal de «hay un recorrido en marcha» se quedaba en verdadero, de modo que el botón
    //     flotante del sitio —que se aparta mientras dura— desaparecía del RESTO DE LAS PAGINAS.
    //     Salir del mapa con el recorrido abierto dejaba el sitio entero sin ese botón.
    //
    // Es el mismo defecto que escondía los controles, una capa más arriba: un estado puesto para
    // una situación que sobrevive a la situación.
    this.detenerElAvance();
    this.dejarDeVigilarElDesplazamiento();
    this.recorridoGuiado.cerrar();

    if (this.map) {
      this.map.remove();
    }
  }

  // Los registros de Redes y Lutieres llegan crudos del API
  // (`fields.departamento`, `fields.deptCode`), mientras que el resto del
  // componente los consume ya normalizados: `.department` (redesPorDepartamento),
  // `.name` y `.municipality` (visibleRecords, fichasDelDirectorio) y `.centerType` /
  // `.oficio`. Esa discordancia de forma es la causa de fondo de PNMC-036: sin
  // `.department` no existe conteo por departamento que calcular. Mismo criterio de
  // visibilidad que `buildPublicSchoolRecord` / `buildPublicMarketRecord`: un
  // registro sin departamento resoluble no se puede pintar, y contarlo en el total
  // reproduciria la contradiccion "N registros / 0 % cobertura" a menor escala.
  private buildPublicNetworkRecord(record: RawNetworkRecord, kind: 'redes' | 'lutieres' | 'espacios'): NetworkRecord | null {
    const fields = record?.fields || {};
    const departmentCode = MapDomain.normalizeDepartmentCode(fields['deptCode'] || fields['departmentCode'] || '');
    const departmentLabel = String(
      MapDomain.getDepartmentNameByCode(departmentCode)
      || fields['departamento']
      || fields['department']
      || ''
    );
    const department = MapDomain.normalizeDepartmentName(departmentLabel);
    const name = String(fields['name'] || fields['nombre'] || '').trim();

    if (!department || department === 'DESCONOCIDO' || !name) return null;

    const municipalityCode = MapDomain.normalizeMunicipalityCode(fields['divipola'] || fields['municipalityCode'] || '');

    return {
      ...record,
      id: record?.id || `${kind}-${municipalityCode || department}-${name}`,
      name,
      department,
      departmentCode,
      municipality: fields['municipio'] || fields['municipality'] || '',
      municipalityCode,
      divipola: municipalityCode || fields['divipola'] || '',
      centerType: fields['centerType'] || '',
      oficio: fields['oficio'] || '',
      description: fields['descripcion'] || fields['desc'] || '',
      linkedSonorousTerritories: fields['Territorios sonoros'] || '',
      practices: fields['Prácticas musicales'] || '',
      contact: fields['contact'] || '',
      websiteUrl: fields['sitio_web'] || '',
      latitude: fields['latitud'] ?? null,
      longitude: fields['longitud'] ?? null,
    };
  }

  private normalizeNetworkRecords(records: unknown[] = [], kind: 'redes' | 'lutieres' | 'espacios'): NetworkRecord[] {
    return (Array.isArray(records) ? records : [])
      .map((record) => this.buildPublicNetworkRecord(record as RawNetworkRecord, kind))
      .filter((record): record is NetworkRecord => record !== null);
  }

  private buildNetworkDepartmentCounts(records: { department?: string }[] = []): Record<string, number> {
    return (Array.isArray(records) ? records : []).reduce((acc: Record<string, number>, record) => {
      const normalized = MapDomain.normalizeDepartmentName(record?.department ?? '');
      if (!normalized || normalized === 'DESCONOCIDO') return acc;

      acc[normalized] = (acc[normalized] || 0) + 1;
      return acc;
    }, {});
  }

  readonly nombresDeFuentesConFalla = computed(() => this.fallasDeFuentes().map(f => f.fuente).join(', '));

  fetchMapData() {
    this.cargando.set(true);
    this.errorDelMapa.set(null);
    this.fallasDeFuentes.set([]);

    this.mapDataService.fetchMapCountsBundle().subscribe({
      next: (bundle) => {
        const fallas: { fuente: string; motivo: string }[] = bundle.fallas ?? [];
        this.fallasDeFuentes.set(fallas);
        // SIN CARTOGRAFÍA el mapa no se pinta: el motivo real sustituye al texto genérico.
        if (fallas.some(f => f.fuente === 'la cartografía')) {
          this.errorDelMapa.set(fallas.find(f => f.fuente === 'la cartografía')!.motivo);
        }
        const geoPayload = bundle.geoJson;
        const departmentGeoJson = geoPayload?.type === 'FeatureCollection'
          ? geoPayload
          : { type: 'FeatureCollection', features: [] };
        
        const nextMunicipalityGeoJson = geoPayload?.municipalities?.type === 'FeatureCollection'
          ? geoPayload.municipalities
          : { type: 'FeatureCollection', features: [] };

        MapDomain.setRuntimeDepartmentCatalog(departmentGeoJson.features || []);
        this.cargadorDeMunicipios = typeof geoPayload?.getMunicipalitiesForDepartment === 'function'
          ? geoPayload.getMunicipalitiesForDepartment
          : undefined;
        this.todosLosMunicipios.set(nextMunicipalityGeoJson?.features || []);
        this.cartografia.set(departmentGeoJson);
        
        this.conteosDeBase.set(bundle.baseCounts);
        this.registrosDeFestivales.set(bundle.festivalRecords);
        this.registrosDeAgenda.set(bundle.agendaRecords ?? []);
        this.registrosDeEscuelas.set(bundle.schoolRecords);
        this.registrosDeMercados.set(bundle.marketRecords);
        this.registrosDeRedes.set(this.normalizeNetworkRecords(bundle.redesRecords, 'redes'));
        this.registrosDeLutieres.set(this.normalizeNetworkRecords(bundle.luthierRecords, 'lutieres'));
        this.registrosDeEspacios.set(this.normalizeNetworkRecords(bundle.spaceRecords, 'espacios'));

        this.festivalCounts.set(bundle.festivalCounts);
        this.schoolCounts.set(bundle.schoolCounts);
        this.marketCounts.set(bundle.marketCounts);

        this.capaDeEscuelasLista.set(true);
        this.capaDeMercadosLista.set(true);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Fallo critico en el mapa:', err);
        this.errorDelMapa.set(err.message || 'Error al descargar datos del mapa');
        this.cargando.set(false);
      }
    });
  }

  /**
   * LA PRIMERA VISITA YA NO ABRE EL RECORRIDO ENCIMA: OFRECE UN AVISO DISCRETO.
   *
   * Abrirlo solo bloqueaba la pantalla con un tutorial de 16 pasos antes de que la persona hubiera visto el mapa.
   * Ahora la primera vez aparece un aviso pequeño en la columna de filtros, sin velo ni desenfoque, con dos salidas:
   * «Recorrido guiado» (lo abre) y «No, gracias» (lo descarta). Cualquiera de las dos se recuerda y el aviso no
   * vuelve; el recorrido sigue a un clic en el botón «Recorrido guiado» y en la ayuda.
   *
   * Quien llega con una consulta hecha (un enlace compartido) tampoco ve el aviso: venía a algo concreto.
   */
  loadTutorialAuto() {
    if (localStorage.getItem(CLAVE_DEL_AVISO_DEL_RECORRIDO) || localStorage.getItem('pnmc_last_tutorial_date')) return;
    if (this.filtrosDelMapa().some((filtro) => !Object.is(filtro.senal(), filtro.vacio))) return;
    this.avisoDelRecorrido.set(true);
  }

  /** El aviso de la primera visita: verdadero mientras se ofrece el recorrido y no se ha elegido. */
  readonly avisoDelRecorrido = signal(false);

  /** «No, gracias»: se recuerda la elección y el aviso no vuelve. */
  descartarElAvisoDelRecorrido(): void {
    this.avisoDelRecorrido.set(false);
    localStorage.setItem(CLAVE_DEL_AVISO_DEL_RECORRIDO, 'descartado');
  }

  /** «Recorrido guiado», desde el aviso o desde el botón fijo: abre el recorrido y recuerda que ya se ofreció. */
  iniciarElRecorridoGuiado(): void {
    this.avisoDelRecorrido.set(false);
    localStorage.setItem(CLAVE_DEL_AVISO_DEL_RECORRIDO, 'iniciado');
    this.abrirElRecorrido();
  }

  /**
   * Abre el recorrido guiado por su primer paso.
   *
   * <b>UNA SOLA PUERTA PARA LAS DOS ENTRADAS.</b> El recorrido se abre por dos caminos —solo, la
   * primera visita del día, y a mano desde el botón de ayuda— y cada uno preparaba el mapa por su
   * cuenta: uno ponía tres señales y el otro nueve, y ninguno pasaba por `handleGoToStep`, que es
   * donde vive la preparación de verdad desde que cada paso monta su propia situación. Resultado:
   * el paso 1 enseñaba cosas distintas según por dónde se hubiera entrado.
   */
  /** Abre el recorrido paso a paso. Lo llaman la primera visita, el modo explorar y las pruebas. */
  abrirElRecorrido(): void {
    this.modoExplorar.set(false);
    this.apartadoSenalado.set('');
    this.vigilarElDesplazamiento();
    this.recordarEstadoDelMapa();
    this.tutorialAbierto.set(true);
    this.recorridoGuiado.abrir();
    this.panelActivo.set(null);
    this.handleGoToStep(0);
  }

  /**
   * Cuándo ocurre el Festival este año, dicho como lo diría alguien.
   *
   * <b>«NOVIEMBRE DE 2026» Y NO «2026-11-14 a 2026-11-16».</b> La ficha de un mapa de circulación
   * responde «¿cuándo puedo ir?», y para eso el mes basta: el día exacto de una edición cambia
   * todos los años y el mes casi nunca. Cuando la edición cruza dos meses se dicen los dos, que es
   * información y no ruido.
   *
   * <b>SIN FECHAS NO SE INVENTA UNA TEMPORADA.</b> Devuelve cadena vacía y la ficha no enseña la
   * línea: un Festival cuya edición de este año no está fechada todavía es un hecho, y rellenarlo
   * con «anual» respondería otra pregunta.
   *
   * `'es-CO'` explícito: `LOCALE_ID` está deliberadamente sin fijar en este proyecto.
   */
  temporadaDelFestival(record: { startDate?: string; endDate?: string }): string {
    const inicio = this.mesLegible(record?.startDate);
    if (!inicio) return '';
    const fin = this.mesLegible(record?.endDate);
    return !fin || fin === inicio ? inicio : `${inicio} a ${fin}`;
  }

  private mesLegible(fecha?: string): string {
    if (!fecha) return '';
    const texto = formatearFecha(fecha, 'mes-anio');
    if (!texto) return '';
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  formatearCifra(val: any): string {
    return MapDomain.formatMetricValue(val);
  }

  formatRecordDetailValue(value: any) {
    if (value === undefined || value === null || value === '') return 'Sin dato';
    if (typeof value === 'number') return this.formatearCifra(value);
    return String(value);
  }

  getWebText(key: string): string {
    return this.webTexts.getWebText(key);
  }

  montarElMapaUnaVez() {
    if (this.map) return;

    const container = this.mapContainer?.nativeElement;
    if (!container) return;
    this.map = L.map(container, {
      center: [4.5709, -74.2973],
      zoom: 5.5,
      zoomControl: false,
      // Las tres licencias de capa base —OpenFreeMap, OpenMapTiles y OpenStreetMap—
      // exigen atribucion VISIBLE. Antes estaba apagada. Se enciende sin el reclamo de
      // Leaflet, para que quede solo lo que la licencia obliga.
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      // EL MAPA NO TENIA TOPE DE ACERCAMIENTO, y eso rompia dos cosas.
      //
      // La visible: `leaflet.markercluster` pide `map.getMaxZoom()` para decidir a que
      // distancia deja de agrupar, y sin tope lanza «Map has no maxZoom specified» y no
      // dibuja NI UN marcador. Comprobado: 0 senaladores en pantalla
      // y dos errores en consola.
      //
      // La otra, que ya estaba: sin tope se puede seguir acercando mas alla de la
      // cartografia disponible y la pantalla se queda en el color de fondo.
      //
      // 18 y no mas porque es lo que sostienen los dos proveedores de la tabla: la capa
      // raster de OpenStreetMap se declara con `maxZoom: 19` unas lineas mas abajo, y el
      // estilo vectorial de OpenFreeMap llega a 20. Dieciocho cabe en los dos.
      maxZoom: 18,
    });
    this.map.attributionControl.setPrefix('');

    const capaBase = MapDomain.resolveBasemapProvider(environment.basemap);
    this.añadirCapaBase(capaBase);

    // Los rotulos se leen a partir de cierto acercamiento. Se recalcula al terminar cada
    // gesto de zoom y una vez al arrancar, para no depender de que el usuario mueva algo.
    // VA DESPUES DE LA CAPA BASE a proposito: ver la nota de `añadirCapaBase`.
    this.map.on('zoomend', () => {
      this.updateDepartmentLabelVisibility();
      this.repositionTerritoryPopup();
    });
    // `move` y no `moveend`: con `moveend` la tarjeta se quedaba quieta durante todo el
    // arrastre y saltaba al soltar. `repositionTerritoryPopup` sale por la primera linea
    // si no hay tarjeta abierta, que es el caso normal, y solo escribe la senal cuando la
    // posicion cambia de verdad.
    this.map.on('move', () => this.repositionTerritoryPopup());
    // Pulsar el mapa por fuera cierra la tarjeta. Este gesto lo daba antes el velo del
    // modal; al quitarlo habia que devolverlo por otro lado o la tarjeta solo se cerraria
    // con el aspa y con Escape. El clic sobre un municipio no llega hasta aqui: su
    // manejador hace `stopPropagation`.
    this.map.on('click', () => {
      this.municipioSeleccionado.set(null);
      this.volverALaListaDelMunicipio();
      // Y se olvida el municipio al que llevo el directorio. Si no, el siguiente
      // cambio de departamento devolveria la camara a un municipio que el usuario ya
      // cerro a mano.
      this.municipioEnfocado.set(null);
    });
    this.updateDepartmentLabelVisibility();

    // Rotulos de pais dibujados por la aplicacion. No se pintan si la propia capa base
    // ya rotula, porque saldrian los nombres por duplicado.
    if (!capaBase.hasOwnLabels) {
    WORLD_COUNTRY_LABELS.filter((country) => country.name !== 'Colombia').forEach((country) => {
      // Aqui se registraba un listener vacio de 'zoom' por cada pais, es decir
      // decenas de manejadores que no hacian nada en cada gesto de zoom.
      // Construct a Leaflet marker using raw divicon
      const labelIcon = L.divIcon({
        className: 'custom-country-label-marker',
        html: `<span class="country-label-text">${country.name}</span>`,
        iconSize: [120, 20],
      });
      L.marker(country.position as L.LatLngExpression, { icon: labelIcon, interactive: false }).addTo(this.map!);
    });
    }

    // Zoom management effect
    effect(() => {
      const bounds = this.limitesDeColombiaConMargen();
      this.senalDeReencuadre(); // Dependencia: reencuadra el mapa al pedir reinicio.
      if (bounds && this.map) {
        this.map.fitBounds(bounds, {
          paddingTopLeft: [28, 20],
          paddingBottomRight: [0, 0],
          animate: true,
          duration: 0.55,
        });
        
        setTimeout(() => {
          this.map!.invalidateSize();
        }, 600);
      }
    }, { injector: this.injector });

    // Drilldown Zoom management effect
    //
    // DOS DESTINOS, NO UNO. Sin municipio enfocado encuadra el departamento, que es lo
    // que hacia desde siempre. Con municipio enfocado —o sea llegando desde el
    // directorio— va a su punto, y esa rama tiene que ir ANTES y cortar.
    //
    // POR QUE CORTAR NO ES OPCIONAL, con su medicion. Dejando las dos ramas, el
    // encuadre del departamento se programa en el mismo clic y el salto al municipio
    // llega despues; pero `fitBounds` animado NO EMPIEZA EN EL ACTO, se programa para el
    // siguiente fotograma, asi que el orden en el que se ejecutan no es el orden en el
    // que se llamaron. Instrumentando este efecto: las corridas
    // buenas daban tres pases —el tercero reponia el municipio— y las malas dos, y en
    // esas el rotulo de ABEJORRAL quedaba a 124 px del centro en vez de a 9.
    //
    // `untracked` alrededor de `abrirMunicipio`: ese metodo lee `fichasDelDirectorio`, o
    // sea las cinco capas, los filtros y el departamento. Sin `untracked` el efecto se
    // suscribiria a todo eso y cualquier cambio de filtro devolveria la camara al
    // municipio de un clic que ya paso.
    effect(() => {
      const departamentoElegido = this.departamentoElegido();
      const geo = this.cartografia();
      const enfocado = this.municipioEnfocado();
      const puntos = this.puntosMunicipales();
      // El estado se lee ADEMAS del mapa de puntos, y no sobra: cuando la descarga
      // falla, `puntosMunicipales` se pone a null, que es el valor que ya tenia. Una
      // senal reescrita con el mismo valor no avisa a nadie, asi que sin esta lectura
      // el efecto no se enteraria del fallo y la tarjeta no se abriria nunca.
      const estadoDeLosPuntos = this.estadoPuntosMunicipales();
      if (!this.map || !geo) return;

      if (enfocado) {
        const destino = MapDomain.resolverDestinoDeNavegacion(enfocado.codigo, puntos, estadoDeLosPuntos);

        if (destino.camara === 'municipio' && destino.lat !== null && destino.lng !== null) {
          // ES UN SALTO SIN ANIMACION, Y LAS DOS ALTERNATIVAS SE PROBARON Y SE MIDIERON.
          //
          // 1. `flyTo([lat, lng], zoom, { duration: 0.7 })` —la llamada que Leaflet
          //    ofrece justo para esto— CONGELA LA PAGINA. Medido
          //    sondeando el hilo principal cada cinco segundos despues del clic:
          //    responde durante ~1 s y despues no vuelve a responder nunca. Se repitio
          //    con la capa base vectorial y con la raster, con la tarjeta abierta y sin
          //    ella, y en ventana de verdad con GPU, no solo sin ventana: las cuatro
          //    veces igual. La causa no se identifico; el sintoma esta medido cuatro
          //    veces. `flyTo` no se usa en ninguna otra parte del proyecto.
          //
          // 2. `setView` CON `animate: true` no congela, pero deja la camara donde no
          //    toca una de cada tres veces. Medido con `npm run mapa:atajo` en tres
          //    corridas seguidas: el rotulo de ABEJORRAL quedo a 124 px del centro del
          //    lienzo en la primera y a 9 px en las otras dos. La animacion del municipio
          //    compite con el encuadre del departamento —que se lanza en el mismo clic y
          //    dura 0,55 s— y a veces pierde.
          //
          // El salto instantaneo no puede competir con nada porque no dura: tres corridas
          // seguidas dan 9 px de desvio. Y para un atajo, aparecer ya en el municipio se
          // lee mejor que un deslizamiento de casi un segundo.
          //
          // Lo vigila `npm run mapa:atajo`, que sondea el hilo despues del clic y mide en
          // pixeles a que distancia del centro quedo el municipio.
          this.saltarAlDestino({ lat: destino.lat, lng: destino.lng, zoom: destino.zoom });
        }

        if (destino.tarjeta === 'abrir') {
          const ancla = destino.lat !== null && destino.lng !== null
            ? { lat: destino.lat, lng: destino.lng }
            : undefined;
          untracked(() => this.abrirMunicipio(enfocado.nombre, enfocado.codigo, undefined, ancla, enfocado.registroId));
        }

        // SOLO SE SIGUE HASTA EL ENCUADRE DEL DEPARTAMENTO SI EL DESTINO LO PIDE.
        //
        // Con `municipio` la camara ya esta puesta. Con `ninguna` —la tabla de puntos
        // todavia viene por la red— tampoco se toca, y esa es la correccion del 29 de
        // agosto de 2026: encuadrar el departamento mientras se espera dejaba dos
        // movimientos compitiendo, y el del municipio perdia una de cada dos veces.
        // Solo se encuadra el departamento cuando ya se sabe que el municipio no se va a
        // poder situar: sin codigo, o con la descarga fallada.
        if (destino.camara !== 'departamento') return;
      }

      if (departamentoElegido === 'Nacional') return;

      const normalized = MapDomain.normalizeDepartmentName(departamentoElegido);
      const feature = geo.features.find(
        (f: any) => MapDomain.getFeatureDepartmentNormalizedName(f) === normalized
      );

      if (feature) {
        const tempLayer = L.geoJSON(feature);
        const bounds = tempLayer.getBounds();
        this.map.fitBounds(bounds, {
          animate: true,
          duration: 0.55,
          padding: [30, 30],
        });

        setTimeout(() => {
          this.map!.invalidateSize();
        }, 600);
      }
    }, { injector: this.injector });
  }

  /** Los temporizadores de comprobación del último salto, para cancelarlos si llega otro o la persona mueve el mapa. */
  private comprobacionesDeDestino: ReturnType<typeof setTimeout>[] = [];

  /**
   * El salto instantáneo al municipio, más la comprobación de que de verdad se quedó.
   *
   * REPRODUCIDO (ver `reafirmar-destino.ts`): un zoom animado en curso deshace el `setView` sin animación cuando
   * termina su transición, y «Ubicar en el mapa» dejaba el mapa en un zoom y un centro cualquiera una de cada
   * varias veces. Se repite el salto SOLO si la cámara quedó fuera del destino, y se deja de insistir en cuanto la
   * persona toca el mapa (arrastre, rueda o toque), para no pelearse con ella.
   */
  private saltarAlDestino(destino: DestinoDeCamara): void {
    const mapa = this.map;
    if (!mapa) return;
    this.comprobacionesDeDestino.forEach(clearTimeout);
    this.comprobacionesDeDestino = [];
    mapa.setView([destino.lat, destino.lng], destino.zoom, { animate: false });

    const contenedor = mapa.getContainer();
    const cancelar = (): void => {
      this.comprobacionesDeDestino.forEach(clearTimeout);
      this.comprobacionesDeDestino = [];
    };
    for (const evento of ['pointerdown', 'wheel', 'touchstart'] as const) {
      contenedor.addEventListener(evento, cancelar, { once: true, passive: true });
    }
    this.comprobacionesDeDestino = MOMENTOS_DE_COMPROBACION_MS.map((ms) => setTimeout(() => {
      if (!this.map || this.map !== mapa || !this.municipioEnfocado()) return;
      const centro = mapa.getCenter();
      if (camaraFueraDeDestino({ lat: centro.lat, lng: centro.lng, zoom: mapa.getZoom() }, destino)) {
        mapa.setView([destino.lat, destino.lng], destino.zoom, { animate: false });
      }
    }, ms));
  }

  /**
   * Monta la capa base segun el proveedor configurado.
   *
   * VECTORIAL (OpenFreeMap). MapLibre pinta el estilo sobre un lienzo WebGL dentro de
   * Leaflet. Al terminar de cargar se RETIRAN las capas de rotulo del estilo: Positron
   * rotula paises, ciudades, vias y agua, y el geovisor dibuja sus propios rotulos de
   * pais con su tipografia y sus posiciones. Dejar los dos era verlo todo repetido.
   *
   * RASTER (OpenStreetMap). Capa de tejas de toda la vida, sin dependencias.
   *
   * NINGUNA. No se monta nada y quedan los poligonos sobre fondo plano.
   */
  /**
   * Pide al API el fragmento municipal de un departamento y lo deja dibujado.
   *
   * El desplegable trabaja con nombres y el API con codigos DIVIPOLA, de ahi la
   * traduccion. Si el nombre no esta en el catalogo —o el paquete no trajo cargador—
   * se deja el mapa sin municipios en vez de dibujar los de otro departamento.
   */
  /**
   * Enciende o apaga los rotulos de territorio segun el acercamiento.
   *
   * Los tooltips permanentes de departamento y de municipio siempre estan puestos; lo
   * que decide si se leen es una clase en el contenedor del mapa, porque conmutar una
   * clase es mucho mas barato que crear y destruir 1.155 tooltips en cada gesto de zoom.
   *
   * Esto FALTABA. El CSS deja `.department-label` en `opacity: 0` y solo lo levanta bajo
   * `.map-department-labels-visible`, una clase que nadie ponia: los 32 rotulos existian
   * en el DOM y ninguno se veia.
   */
  private updateDepartmentLabelVisibility(): void {
    if (!this.map) return;
    const contenedor = this.map.getContainer();
    if (!contenedor) return;

    const { departments, municipalities } = MapDomain.labelVisibilityForZoom(this.map.getZoom());
    contenedor.classList.toggle('map-department-labels-visible', departments);
    contenedor.classList.toggle('map-municipality-labels-visible', municipalities);
  }

  private async cargarMunicipiosRemotos(nombreDepartamento: string): Promise<void> {
    const codigo = MapDomain.getDepartmentCodeByName(nombreDepartamento);
    if (!codigo || !this.cargadorDeMunicipios) {
      this.municipiosDelDepartamento.set(null);
      return;
    }

    const yaDescargado = this.municipiosPorDepartamento.get(codigo);
    if (yaDescargado) {
      this.municipiosDelDepartamento.set({ type: 'FeatureCollection', features: yaDescargado });
      return;
    }

    try {
      const coleccion = await this.cargadorDeMunicipios(codigo);
      const features = Array.isArray(coleccion?.features) ? coleccion.features : [];
      this.municipiosPorDepartamento.set(codigo, features);

      // Entre la peticion y la respuesta el usuario pudo cambiar de departamento. Se
      // comprueba antes de pintar, para no dejar en pantalla municipios de otro sitio.
      if (MapDomain.getDepartmentCodeByName(this.departamentoElegido()) !== codigo) return;

      this.municipiosDelDepartamento.set({ type: 'FeatureCollection', features });
    } catch {
      this.municipiosDelDepartamento.set(null);
    }
  }

  private añadirCapaBase(proveedor: MapDomain.BasemapProvider): void {
    if (!this.map || proveedor.kind === 'none') return;

    // LA ATRIBUCION VA YA, SIN APLAZAR. Es texto, no cuesta nada, y la licencia de
    // OpenFreeMap la exige visible: no puede depender de que el aplazamiento de abajo
    // llegue a ejecutarse.
    if (proveedor.attribution) {
      this.map.attributionControl.addAttribution(proveedor.attribution);
    }

    if (proveedor.kind === 'raster') {
      L.tileLayer(proveedor.url, { opacity: 0.55, maxZoom: 19 }).addTo(this.map);
      return;
    }

    // -------------------------------------------------------------------------
    // LA CAPA VECTORIAL SE MONTA DESPUES DEL PRIMER DIBUJO, Y ESO SE MIDIO
    // (29 de agosto de 2026)
    //
    // Montarla aqui mismo bloqueaba el hilo principal antes de que se pintara un solo
    // departamento. Perfilando la carga del sitio compilado:
    //
    //   territorios dibujados         2154 ms
    //   una sola tarea del hilo       1588 ms, empezando a los 567 ms
    //   dentro de esa tarea           `_setupPainter`, 1359 ms de tiempo propio
    //
    // `_setupPainter` es el arranque del pintor WebGL de MapLibre: compilar los
    // programas de sombreado del estilo. En un navegador con GPU de verdad la misma
    // medida daba 502 ms —menos, pero seguia siendo el mayor gasto de la carga—.
    //
    // Durante ese rato la pantalla estaba en blanco y no respondia a nada. Y no hacia
    // falta: los poligonos de los departamentos son SVG de Leaflet y se pintan sin
    // WebGL. Aplazando la capa base, Colombia aparece primero y la cartografia de fondo
    // entra detras, sin que se pierda ninguna de las dos.
    //
    // `requestIdleCallback` CON PLAZO, no a secas. Sin `timeout`, un hilo ocupado puede
    // no quedarse nunca libre y la capa base no llegaria jamas. Con 1.500 ms el
    // navegador la ejecuta si o si, y ese es el peor caso, no el normal.
    //
    // Lo vigila `npm run mapa:velocidad`, que mide cuando aparecen los territorios y
    // comprueba ADEMAS que la capa base acaba montandose: aplazarla es ganar tiempo,
    // perderla seria cambiar cartografia por velocidad.
    // -------------------------------------------------------------------------
    const montar = () => {
      if (!this.map) return;
      this.montarCapaVectorial(proveedor);
    };

    const programar = (globalThis as { requestIdleCallback?: (cb: () => void, opciones?: { timeout: number }) => void })
      .requestIdleCallback;
    if (typeof programar === 'function') {
      programar(montar, { timeout: 1500 });
    } else {
      // Safari no trae `requestIdleCallback`. Un `setTimeout` de cero cede el hilo
      // igual: basta con no hacerlo dentro de la misma tarea que crea el mapa.
      setTimeout(montar, 0);
    }
  }

  /** El montaje en si de la capa vectorial, ya fuera de la tarea de arranque. */
  private montarCapaVectorial(proveedor: MapDomain.BasemapProvider): void {
    if (!this.map) return;

    const capa = (L as any).maplibreGL({ style: proveedor.url, attributionControl: false });
    capa.addTo(this.map);

    const mapaLibre = capa.getMaplibreMap();
    mapaLibre.on('load', () => {
      // `getStyle()` ES DE MAPLIBRE Y NO NUESTRO, así que conserva su nombre. Al pasar el geovisor
      // a nomenclatura española, el renombrado de nuestro `getStyle` alcanzó también esta llamada y
      // la capa base dejó de poder apagar sus propios rótulos: «mapaLibre.estiloDelDepartamento is
      // not a function» en consola, y los nombres de ciudad duplicados sobre el mapa.
      //
      // La regla del proyecto pide traducir LO QUE ES NUESTRO. La superficie de una biblioteca de
      // terceros no lo es: traducirla no la renombra, la rompe.
      const estilo = mapaLibre.getStyle();
      (estilo?.layers ?? [])
        .filter((capaDelEstilo: any) => MapDomain.isLabelLayer(capaDelEstilo))
        .forEach((capaDelEstilo: any) => mapaLibre.removeLayer(capaDelEstilo.id));
    });
  }

  redibujarLasCapas() {
    if (!this.map) return;

    // Clear dynamic layers
    if (this.capaDeDepartamentos) this.map.removeLayer(this.capaDeDepartamentos);
    if (this.capaDeContacto) this.map.removeLayer(this.capaDeContacto);
    if (this.capaDeMunicipios) this.map.removeLayer(this.capaDeMunicipios);
    if (this.capaDeRotulosMunicipales) this.map.removeLayer(this.capaDeRotulosMunicipales);
    if (this.capaDelArchipielago) this.map.removeLayer(this.capaDelArchipielago);
    
    this.marcadoresTematicos.forEach(m => this.map!.removeLayer(m));
    this.marcadoresTematicos = [];
    this.dibujo.limpiarSimbolos(this.map);
    if (this.modoDeDibujo() !== 'calor') {
      // SOLO SI SE SALE DEL MODO. Quitar la superficie y reponerla en cada repintado del coroplético
      // cuesta una lectura completa del lienzo de más y se nota al arrastrar el mapa.
      this.dibujo.limpiarCalor(this.map);
    }

    const geo = this.cartografia();
    if (!geo) return;

    // 1. Base coropleth layer
    this.capaDeDepartamentos = L.geoJSON(geo, {
      interactive: false,
      style: (feature) => this.estiloDelDepartamento(feature),
      onEachFeature: (feature, layer) => {
        const deptName = MapDomain.getFeatureDepartmentName(feature);
        const normalized = MapDomain.getFeatureDepartmentNormalizedName(feature);
        if (normalized !== MapDomain.ARCHIPELAGO_NORMALIZED_NAME) {
          layer.bindTooltip(nombrePropio(deptName), {
            permanent: true,
            direction: 'center',
            className: 'department-label',
            opacity: 1,
          });
        }
      }
    }).addTo(this.map);

    // 2. Hit area layer
    this.capaDeContacto = L.geoJSON(geo, {
      filter: (feature) => MapDomain.getFeatureDepartmentNormalizedName(feature) !== MapDomain.ARCHIPELAGO_NORMALIZED_NAME,
      style: () => MapDomain.DEPARTMENT_HIT_AREA_STYLE as L.PathOptions,
      onEachFeature: (feature, layer) => {
        const deptName = MapDomain.getFeatureDepartmentName(feature);
        const normalized = MapDomain.getFeatureDepartmentNormalizedName(feature);
        const stats = this.resumenPorDepartamento()[normalized] || MapDomain.EMPTY_DEPARTMENT_SUMMARY;

        layer.on({
          mouseover: () => this.tarjetaDelDepartamentoSenalado.set({ deptName, stats }),
          mouseout: () => this.tarjetaDelDepartamentoSenalado.set(null),
          click: () => this.abrirDepartamento(deptName)
        });
      }
    }).addTo(this.map);

    // 3. Municipalities layer (Drilldown)
    const currentDeptMun = this.municipiosDelDepartamento();
    if (this.departamentoElegido() !== 'Nacional' && currentDeptMun) {
      this.capaDeRotulosMunicipales = L.layerGroup().addTo(this.map);
      this.capaDeMunicipios = L.geoJSON(currentDeptMun, {
        style: (feature) => this.estiloDelMunicipio(feature),
        onEachFeature: (feature, layer) => {
          const munName = feature.properties?.municipalityName || 'Municipio';
          const munCode = feature.properties?.municipalityCode;
          const count = this.fichasDeMunicipio(munCode, munName).length;

          const tooltipContent = `<div class="municipality-tooltip">
            <p class="tooltip-title">${munName}</p>
            <p class="tooltip-value">${count} ${count === 1 ? 'proceso' : 'procesos'} registrado${count === 1 ? '' : 's'}</p>
          </div>`;

          layer.bindTooltip(tooltipContent, {
            sticky: true,
            direction: 'auto',
            className: 'custom-municipality-tooltip',
          });

          // ROTULO PERMANENTE, Y VA COMO MARCADOR APARTE, NO COMO SEGUNDO TOOLTIP.
          // `bindTooltip` sustituye al tooltip anterior de la misma capa: un segundo
          // atado aqui se llevaba por delante el globo de hover de arriba, que es el que
          // cuenta los procesos. Comprobado: cero rotulos en pantalla y el globo perdido.
          // Con un marcador con `divIcon` conviven los dos. Es el mismo patron que ya
          // usan los rotulos de pais.
          const centro = (layer as L.Polygon).getBounds?.().getCenter?.();
          if (centro && this.capaDeRotulosMunicipales) {
            L.marker(centro, {
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: 'municipality-label',
                html: `<span>${nombrePropio(munName)}</span>`,
                iconSize: [70, 12],
              }),
            }).addTo(this.capaDeRotulosMunicipales);
          }

          // El municipio era inerte: `onEachFeature` solo ataba el globo. Y
          // ademas se traga el clic del departamento, porque esta capa se anade
          // encima del `capaDeContacto` y sus poligonos son interactivos y con
          // relleno. O sea que dentro de un departamento abierto no se podia
          // pulsar nada. Ahora abre la lista de sus procesos.
          layer.on('click', (evento: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(evento);
            // El ancla es el centro del poligono, no el pixel del clic: es lo que deja
            // que la tarjeta siga a su municipio cuando el mapa se mueve.
            const limites = (layer as L.Polygon).getBounds?.();
            const centro = limites?.isValid?.() ? limites.getCenter() : undefined;
            const ancla = centro ? { lat: centro.lat, lng: centro.lng } : undefined;
            this.abrirMunicipio(munName, munCode, evento, ancla);
          });
        }
      }).addTo(this.map);
    }

    // 4. Archipelago Layer (San Andres)
    const enlargedArchipelago = this.archipielagoAmpliado();
    if (enlargedArchipelago) {
      const resumenDelArchipielago = this.resumenDelArchipielago();
      const style = this.estiloDelArchipielago();

      this.capaDelArchipielago = L.geoJSON(enlargedArchipelago, {
        style: () => style as L.PathOptions,
        onEachFeature: (_, layer) => {
          // ---------------------------------------------------------------------
          // EL ROTULO DEL ARCHIPIELAGO ES UN ROTULO DE DEPARTAMENTO, Y NO LO ERA.
          //
          // Llevaba `className: 'archipelago-label'`, una clase QUE NO EXISTE EN EL
          // CSS: ni una regla en `styles.css`. Sin estilo propio se quedaba con el
          // globo por defecto de Leaflet —caja blanca con borde y sombra, 312 px de
          // ancho— flotando sobre el Caribe. Y como el CSS que apaga los rotulos
          // fuera de zoom se aplica a `.department-label`, este se quedaba fuera del
          // interruptor y salia SIEMPRE.
          //
          // Medido, contando rotulos visibles al abrir:
          //
          //   1280x639    0 de 32 departamentos    archipielago VISIBLE
          //   1500x950   32 de 32 departamentos    archipielago visible
          //   1920x1080  32 de 32 departamentos    archipielago visible
          //
          // En la pantalla del usuario era la unica etiqueta del mapa, y ademas la
          // unica con caja. Con `department-label` entra en el mismo interruptor de
          // zoom y en la misma tipografia que los otros treinta y dos.
          //
          // EL NOMBRE VA CORTO, Y NO SALE DE `getDepartmentDisplayName`. Esa funcion
          // devuelve el nombre completo —«Archipiélago de San Andrés, Providencia y
          // Santa Catalina»—, que medido en pantalla con la tipografia del rotulo
          // ocupa 311 px: casi el triple que el siguiente mas ancho, «NORTE DE
          // SANTANDER» con 112. `getDepartmentLabelName` da la forma corta, que es la
          // misma que el clic de abajo le pasa al drilldown: el rotulo dice
          // exactamente lo que se selecciona al pulsarlo.
          //
          // Va a la derecha y no centrado porque las islas son diminutas: centrado, el
          // texto las tapa enteras.
          // ---------------------------------------------------------------------
          layer.bindTooltip(nombrePropio(MapDomain.getDepartmentLabelName(MapDomain.ARCHIPELAGO_NORMALIZED_NAME)), {
            permanent: true,
            direction: 'right',
            className: 'department-label',
            opacity: 1,
            offset: [14, 0],
          });
          layer.on({
            mouseover: () => this.tarjetaDelDepartamentoSenalado.set({
              deptName: 'Archipiélago de San Andrés, Providencia y Santa Catalina',
              stats: resumenDelArchipielago,
            }),
            mouseout: () => this.tarjetaDelDepartamentoSenalado.set(null),
            click: () => this.abrirDepartamento('San Andrés y Providencia')
          });
        }
      }).addTo(this.map);
    }

    // 5. Thematic points (Modes)
    if (this.modoDeDibujo() === 'practicas_territorios') {
      this.dibujarSenaladoresMunicipales();
    }
    if (this.modoDeDibujo() === 'calor') {
      this.dibujarMapaDeCalor();
    }
  }

  /**
   * La superficie de densidad.
   *
   * <b>UN PUNTO POR PROCESO Y NO POR MUNICIPIO.</b> Es lo que hace que la mancha signifique algo:
   * el lienzo SUMA los aportes que se solapan, así que cinco procesos en el mismo municipio tiñen
   * cinco veces más que uno. Con un punto por municipio, Bogotá con cuarenta procesos y un
   * municipio con uno pintarían exactamente igual, y el mapa de calor sería un mapa de presencia.
   *
   * <b>EL COLOR SALE DEL LENTE CUANDO HAY UN GRUPO RESALTADO.</b> Mirar «por territorios sonoros»
   * y que la mancha siguiera siendo del color de la capa dejaría las gafas puestas y el paisaje
   * igual, que es justo lo que el lente vino a corregir.
   */
  private dibujarMapaDeCalor(): void {
    if (!this.map) return;

    const { municipios } = this.procesosPorMunicipio();
    const resaltado = this.grupoResaltado();
    const conLente = this.lenteDeLectura() !== 'territorial';

    // ─── UNA SERIE POR GRUPO, CON SU COLOR ───
    //
    // <b>EL CALOR ERA EL UNICO MODO QUE NO HABLABA EL IDIOMA DEL LENTE.</b> Las coropletas tiñen
    // cada departamento del grupo que predomina y los símbolos toman el color de lo que declaran;
    // el calor seguía en el verde de la capa salvo que hubiera un grupo resaltado. Así que de los
    // tres modos, dos decían CUAL y uno no.
    //
    // <b>Y ES EL QUE MEJOR PUEDE DECIRLO.</b> El coroplético sólo sabe pintar polígonos
    // administrativos, así que sus regiones tienen forma de departamento aunque el fenómeno no la
    // tenga. El calor dibuja fronteras blandas: con una serie por territorio sonoro, las zonas del
    // país se tiñen del que predomina en cada una y las manchas se solapan y se deshacen donde de
    // verdad lo hacen. Es la lectura «menos cuadriculada» que faltaba.
    //
    // <b>CON UN GRUPO RESALTADO, SOLO SU HUELLA.</b> Es la pregunta concreta —«¿dónde está el
    // Joropo?»— y enseñarla sola, sin los otros trece encima, es lo único que la responde.
    const series: { color: string; puntos: PuntoDeCalor[] }[] = [];

    if (!conLente && this.coloreaPorTipo()) {
      // «VISTA GENERAL»: una serie por tipo de registro, con su color. Las manchas se solapan y se mezclan donde
      // los tipos conviven, que es justo lo que este mapa quiere decir.
      const colores = this.colorDelTipoDeRegistro();
      for (const tipo of this.tiposDelDibujo()) {
        const puntos: PuntoDeCalor[] = [];
        for (const municipio of municipios) {
          const aportan = municipio.fichas.filter((ficha) => colores.get(ficha as object) === tipo.color).length;
          for (let repeticion = 0; repeticion < aportan; repeticion += 1) puntos.push({ lat: municipio.lat, lng: municipio.lng });
        }
        if (puntos.length > 0) series.push({ color: tipo.color, puntos });
      }
    } else if (!conLente) {
      const puntos: PuntoDeCalor[] = [];
      for (const municipio of municipios) {
        for (let repeticion = 0; repeticion < municipio.total; repeticion += 1) {
          puntos.push({ lat: municipio.lat, lng: municipio.lng });
        }
      }
      series.push({ color: this.colorCapaActiva(), puntos });
    } else {
      const colores = this.coloresDelLente();
      // SOLO LOS GRUPOS QUE LA LEYENDA ENSEÑA, y no los catorce. Cada serie cuesta una lectura del
      // lienzo entero; y además pintar un grupo que no está en la leyenda daría un color que nadie
      // puede traducir, que es peor que no pintarlo.
      const grupos = resaltado
        ? this.gruposDelLente().filter((grupo) => grupo.nombre === resaltado)
        : this.gruposDelLenteVisibles().grupos;

      for (const grupo of grupos) {
        const puntos: PuntoDeCalor[] = [];
        for (const municipio of municipios) {
          // CUANTOS DE ESTE MUNICIPIO SON DE ESTE GRUPO. Un municipio con un proceso de Joropo y
          // nueve de otra cosa no es un foco de Joropo, y contarlo entero pintaría una huella que
          // no existe.
          const aportan = municipio.fichas.filter((ficha) =>
            this.clasificacionDe(ficha as FichaClasificable).includes(grupo.nombre)).length;
          for (let repeticion = 0; repeticion < aportan; repeticion += 1) {
            puntos.push({ lat: municipio.lat, lng: municipio.lng });
          }
        }
        if (puntos.length > 0) {
          series.push({
            color: colores.get(grupo.nombre) ?? MapaEcosistemicoPageComponent.COLOR_SIN_CLASIFICAR,
            puntos,
          });
        }
      }
    }

    const opciones = {
      radioEnPixeles: MapaEcosistemicoPageComponent.RADIO_DEL_CALOR,
      color: this.colorCapaActiva(),
      techoDeSolape: MapaEcosistemicoPageComponent.TECHO_DE_SOLAPE,
      alCambiarEscala: (metros: number) => {
        // FUERA DEL CICLO DE DIBUJO DE LEAFLET. Escribir la señal desde dentro del repintado pone
        // a Angular a recalcular la leyenda en mitad del `moveend`, y el arrastre se entrecorta.
        queueMicrotask(() => this.radioDelCalorEnMetros.set(metros));
      },
    };

    this.dibujo.dibujarCalor(this.map, series, opciones);
  }

  /**
   * Un senalador por MUNICIPIO con procesos, sobre el punto real de ese municipio.
   *
   * UNO POR MUNICIPIO Y NO UNO POR PROCESO. Comprobado: los 155
   * procesos publicados viven en 33 municipios, y 30 de esos 33 tienen exactamente 5
   * registros. Dibujar 155 marcas sobre 33 puntos apila cinco en el mismo pixel cuatro
   * veces de cada cinco: se ve una y se pierden cuatro. La cifra dentro de la pastilla
   * dice cuantas hay debajo.
   *
   * SE ANCLA POR EL CENTRO Y NO POR UNA PUNTA. Una punta de alfiler senala un pixel del
   * suelo, y el dato tiene resolucion de MUNICIPIO: la punta afirmaria una precision que
   * no existe. El aro discontinuo es la convencion de «aproximado» y se lee tambien en
   * escala de grises, sin depender del color.
   *
   * LOS `data-*` NO SON DECORACION: son lo que permite al comprobador de navegador
   * verificar, uno por uno, que la posicion dibujada es la que el API da para ese
   * municipio. Es el medidor que habria matado la espiral el dia que se escribio.
   */
  /**
   * Qué símbolos hay que dibujar. El CÓMO vive en `dibujo-tematico.ts`.
   *
   * <b>ESTA ES LA COSTURA.</b> Aquí se decide —leyendo señales— qué municipios entran, de qué
   * color, de qué tamaño y cuáles se atenúan; allí se convierte en capas de Leaflet sin saber nada
   * de lentes ni de modos. Antes las dos cosas vivían en el mismo método de cien líneas, y cualquier
   * cambio en la lógica obligaba a leer el dibujo y al revés.
   */
  private dibujarSenaladoresMunicipales(): void {
    if (!this.map) return;

    const { municipios } = this.procesosPorMunicipio();
    const colorDeLaCapa = this.colorCapaActiva();

    // EL MAXIMO DEL AMBITO, PARA ESCALAR. Sin él, un símbolo «grande» no significaría nada: sería
    // grande respecto de nada. Con él, el mayor del ámbito marca el techo y el resto se lee contra
    // ese techo, que es lo que hace comparable un símbolo con otro.
    const maximo = municipios.reduce((mayor, item) => Math.max(mayor, item.total), 0) || 1;

    const simbolos = municipios.map((municipio) => ({
      codigo: municipio.codigo,
      nombre: municipio.nombre,
      lat: municipio.lat,
      lng: municipio.lng,
      total: municipio.total,
      color: this.colorDelSimbolo(municipio.fichas, colorDeLaCapa),
      lado: this.ladoDelSimbolo(municipio.total, maximo),
      atenuado: this.simboloAtenuado(municipio.fichas),
      titulos: municipio.fichas.slice(0, 5).map((ficha) => ficha?.name || 'Proceso sin nombre'),
      restantes: municipio.total - Math.min(5, municipio.total),
    }));

    this.dibujo.dibujarSimbolos(
      this.map, simbolos, maximo, colorDeLaCapa,
      (total, techo) => this.ladoDelSimbolo(total, techo),
      (nombre, codigo, evento, ancla) => this.abrirMunicipio(nombre, codigo, evento, ancla),
      (opciones) => LeafletConComplementos.markerClusterGroup(opciones),
    );
  }

  estiloDelDepartamento(feature: any): L.PathOptions {
    const departmentName = MapDomain.getFeatureDepartmentNormalizedName(feature);
    if (departmentName === MapDomain.ARCHIPELAGO_NORMALIZED_NAME) {
      return {
        fillColor: 'transparent',
        fillOpacity: 0,
        color: 'transparent',
        weight: 0,
        opacity: 0,
      };
    }
    const count = (this.conteosDeLaCapaActiva() || {})[departmentName] || 0;
    const isSelectedDepartment = this.departamentoElegido() !== 'Nacional' && this.departamentoNormalizado() === departmentName;

    if (isSelectedDepartment) {
      return {
        ...this.SELECTED_DEPARTMENT_STYLE,
        fillColor: 'transparent',
        fillOpacity: 0,
      };
    }

    if (this.departamentoElegido() !== 'Nacional') {
      return this.MUTED_DEPARTMENT_STYLE;
    }

    // ─── EL LENTE TIÑE TAMBIEN EL COROPLETICO ───
    //
    // <b>ERA LA MITAD QUE FALTABA.</b> El lente cambiaba la columna izquierda y el color de los
    // símbolos, y el coroplético —que es el modo por omisión, o sea el mapa que casi todo el mundo
    // ve— seguía pintado por densidad. Con «por territorios sonoros» puesto, el paisaje no cambiaba:
    // exactamente lo que la dirección de producto vino a corregir cuando dijo que una cosa es cómo se
    // representa el mapa y otra las gafas que uno se pone para verlo.
    //
    // <b>ES UN COROPLETICO CUALITATIVO, NO DE INTENSIDAD.</b> Con el lente puesto, el color deja de
    // significar «cuántos» y pasa a significar «cuál»: cada departamento toma el color del grupo
    // que más declara. Son dos lecturas distintas del mismo mapa y no se pueden mezclar —un tono
    // que a la vez dice cuál y cuánto no dice ninguna de las dos—, así que la leyenda cambia con él.
    //
    // <b>Y ES LO QUE HACE VISIBLE LA PROMESA DEL LENTE</b>: que un territorio sonoro cruza varios
    // departamentos. Pintados por «cuál», los departamentos de un mismo territorio comparten color
    // y la mancha regional aparece sola, que es justo lo que un mapa por departamentos esconde.
    // ─── LOS DOS MODOS DE PUNTO DIBUJAN SOBRE FONDO NEUTRO ───
    //
    // <b>LA MISMA CIFRA NO SE CODIFICA DOS VECES.</b> Los símbolos y el calor se pintaban ENCIMA
    // del coroplético de densidad, así que el mapa decía «cuántos hay aquí» dos veces a la vez: con
    // el tono del departamento y con el tamaño del círculo. Eso no es redundancia inofensiva: hace
    // que los tres modos se parezcan —los tres se ven verdes por densidad— y borra justo aquello
    // que los diferencia, que es POR QUE CANAL cada uno dice la cifra.
    //
    // Con el fondo neutro, cada modo tiene su canal y sólo el suyo:
    //   · Coropletas ............. el color del área
    //   · Símbolos proporcionales  el área del círculo
    //   · Mapa de calor .......... la densidad de la superficie
    //
    // El polígono no desaparece: se queda como referencia territorial, que es lo que un mapa de
    // símbolos necesita del fondo —saber dónde cae cada punto— y nada más.
    if (this.modoDeDibujo() !== 'cobertura') {
      return MapDomain.FONDO_NEUTRO_DEL_DEPARTAMENTO as L.PathOptions;
    }

    const dominante = this.grupoDominantePorDepartamento()[departmentName];
    if (dominante) {
      const resaltado = this.grupoResaltado();
      const atenuado = resaltado !== '' && resaltado !== dominante;
      return {
        ...MapDomain.getChoroplethStyles(1, true, this.capaActiva()),
        fillColor: this.coloresDelLente().get(dominante)
          ?? MapaEcosistemicoPageComponent.COLOR_SIN_CLASIFICAR,
        // Atenuar y no esconder: resaltar «Joropo» tiene que dejar ver dónde NO está.
        fillOpacity: atenuado ? 0.12 : 0.78,
      };
    }

    if (this.modoDeDibujo() === 'practicas_territorios') {
      // LA MISMA RAMPA QUE EL RESTO DEL MAPA, alimentada por el conteo DEL MODO.
      //
      // Lo que habia eran dos ramas y ninguna decia cuantos procesos hay. La de «calor»
      // pintaba los 33 departamentos del mismo gris plano. La de «puntos» buscaba el
      // COLOR DOMINANTE por departamento y, al empatar —que con dieciseis practicas en
      // once colores y tres de ellos repetidos pasa a menudo—, caia en el mismo gris.
      // Un mapa que colorea por «cual gana» no deja comparar territorios: dice quien es
      // primero, no cuanto hay.
      //
      // El conteo sale de `conteoDelModoPorDepartamento` y no de `conteosDeLaCapaActiva()`
      // porque este ultimo no respeta los filtros: ver la nota de aquel computed.
      const conteoDelModo = this.conteoDelModoPorDepartamento()[departmentName] || 0;
      return MapDomain.getChoroplethStyles(conteoDelModo, true, this.capaActiva(), this.maximoDelModo());
    }

    return MapDomain.getChoroplethStyles(count, true, this.capaActiva());
  }

  estiloDelMunicipio(feature: any): L.PathOptions {
    const munCode = feature.properties?.municipalityCode;
    const munName = (feature.properties?.municipalityName || '').toLowerCase().trim();
    
    const count = this.fichasDeMunicipio(munCode, munName).length;
    const style = MapDomain.getChoroplethStyles(count, true, this.capaActiva());
    
    style.weight = count > 0 ? 1.0 : 0.6;
    style.color = count > 0 ? 'rgba(41, 18, 66, 0.7)' : 'rgba(41, 18, 66, 0.2)';
    
    return style;
  }

  abrirDepartamento(departmentName: string) {
    // Entrar a un departamento por el mapa es cambiar de sitio: el municipio al que
    // llevo el directorio deja de ser lo que se esta mirando.
    this.municipioEnfocado.set(null);
    const nextSelectedDept = MapDomain.getDepartmentSelectionValue(departmentName);
    const nextNormalized = MapDomain.normalizeDepartmentName(nextSelectedDept);

    if (this.departamentoElegido() !== 'Nacional' && nextNormalized === this.departamentoNormalizado()) {
      this.departamentoElegido.set('Nacional');
      this.tarjetaDelDepartamentoSenalado.set(null);
      this.senalDeReencuadre.update(c => c + 1);
    } else {
      this.departamentoElegido.set(nextSelectedDept);
    }
    this.pestanaLateral.set('resumen');
  }

  volverAVistaNacional() {
    this.municipioEnfocado.set(null);
    this.departamentoElegido.set('Nacional');
    this.pestanaLateral.set('resumen');
    this.tarjetaDelDepartamentoSenalado.set(null);
    this.senalDeReencuadre.update(c => c + 1);
  }

  alternarPanel(panelId: string) {
    if (panelId === MAP_PANEL_IDS.tutorial) {
      // EL BOTON DE AYUDA ABRE EL MODO EXPLORAR Y NO EL RECORRIDO ENTERO. Lo pidió así el dueño
      // del proyecto: «en lugar de darme todo el recorrido, que me permita con el mouse apuntar un
      // apartado y que ahí sea cuando me explique qué es». Quien llega al botón de ayuda ya está
      // en el mapa y tiene UNA duda; pasar por dieciocho pasos para resolverla es el camino largo.
      // El recorrido completo sigue a un clic, desde la propia tarjeta de explorar.
      this.abrirModoExplorar();
    } else {
      this.panelActivo.update(c => c === panelId ? null : panelId);
    }
  }

  /**
   * Lleva el recorrido a un paso y deja el mapa como ese paso necesita.
   *
   * <b>CADA PASO PONE LA SITUACION QUE EXPLICA.</b> Hablar del mapa de calor con una coropleta
   * debajo obliga a imaginárselo; con el calor puesto, se ve. Por eso los tres modos de dibujo son
   * tres pasos y no uno, y por eso los cinco del gráfico dejan cada uno su combinación puesta.
   *
   * <b>SE PARTE SIEMPRE DE LO MISMO</b> y después cada paso cambia solo lo suyo. Sin ese suelo
   * común, llegar a un paso desde el anterior o desde el índice enseñaría cosas distintas.
   *
   * <b>EL MODO DE DIBUJO VA POR `elegirModoDeDibujo` Y NO ESCRIBIENDO LA SEÑAL.</b> Los dos modos
   * de punto necesitan el catálogo municipal y quien lo pide es ese método: al escribir
   * `modoDeDibujo` directamente —que es lo que hacía el recorrido anterior— el modo cambiaba y el
   * mapa se quedaba vacío, sin error y sin aviso.
   */
  handleGoToStep(step: number) {
    this.pasoDelTutorial.set(step);

    // Suelo común: capa general, país entero, sin nada abierto encima.
    this.capaActiva.set('General');
    this.departamentoElegido.set('Nacional');
    this.municipioElegido.set('Todos');
    this.selectedSonorousTerritory.set('Todos');
    this.selectedPractice.set('Todas');
    this.grupoResaltado.set('');
    this.tarjetaDelDepartamentoSenalado.set(null);
    this.fichaEnDetalle.set(null);
    this.procesoAbiertoEnElMunicipio.set(null);
    this.panelActivo.set(null);

    switch (step) {
      // 1-2. Bienvenida y capas: el mapa como se encuentra al entrar.
      case 0:
      case 1:
        this.vistaCentral.set('mapa');
        this.lenteDeLectura.set('territorial');
        this.elegirModoDeDibujo('cobertura');
        break;

      // 3. Filtros compartidos. Con la coropleta, que es donde acotar se nota más.
      case 2:
        this.vistaCentral.set('mapa');
        this.lenteDeLectura.set('territorial');
        this.elegirModoDeDibujo('cobertura');
        break;

      // 4-7. El lente y los tres modos de dibujo. Se pone un lente que SI reparte colores: con el
      // territorial no hay grupos que colorear y el paso explicaría un control sin efecto visible.
      case 3:
      case 4:
        this.vistaCentral.set('mapa');
        this.lenteDeLectura.set('territorios-sonoros');
        this.elegirModoDeDibujo('cobertura');
        break;
      case 5:
        this.vistaCentral.set('mapa');
        this.lenteDeLectura.set('territorios-sonoros');
        this.elegirModoDeDibujo('practicas_territorios');
        break;
      // 7 y 8. El calor, y la leyenda con el calor puesto: es cuando más tiene que explicar.
      case 6:
      case 7:
        this.vistaCentral.set('mapa');
        this.lenteDeLectura.set('territorios-sonoros');
        this.elegirModoDeDibujo('calor');
        break;

      // 9-10. Lectura por departamento y las tres vistas, sobre la coropleta, que es la que
      // reacciona al clic por departamento. El paso del conmutador explica el control, no su destino.
      case 8:
      case 9:
        this.vistaCentral.set('mapa');
        this.lenteDeLectura.set('territorial');
        this.elegirModoDeDibujo('cobertura');
        break;

      // 11-12. La tira de lecturas del gráfico (con su exportación) y el orden por departamento.
      case 10:
      case 11:
        this.elegirModoDeDibujo('cobertura');
        this.lenteDeLectura.set('territorios-sonoros');
        this.vistaCentral.set('grafico');
        this.vistaDelTablero.set('panel');
        this.elegirLectura('departamentos');
        break;

      // 13. La composición, y sobre qué dimensión se mide.
      case 12:
        this.elegirModoDeDibujo('cobertura');
        this.lenteDeLectura.set('territorios-sonoros');
        this.vistaCentral.set('grafico');
        this.vistaDelTablero.set('panel');
        this.elegirLectura('composicion');
        this.dimensionDeComposicion.set('territorios-sonoros');
        break;

      // 14. La exportación de lo que se ve en el gráfico (la vista «Tabla» se retiró).
      case 13:
        this.elegirModoDeDibujo('cobertura');
        this.lenteDeLectura.set('territorial');
        this.vistaCentral.set('grafico');
        this.vistaDelTablero.set('panel');
        break;

      // 15. Teclado y lector de pantalla: sobre el gráfico, la lectura sin puntero ni color.
      case 14:
        this.elegirModoDeDibujo('cobertura');
        this.lenteDeLectura.set('territorial');
        this.vistaCentral.set('grafico');
        this.vistaDelTablero.set('panel');
        this.elegirLectura('departamentos');
        break;

      // 16. Directorio y agenda, en la columna de lectura.
      default:
        this.vistaCentral.set('mapa');
        this.lenteDeLectura.set('territorial');
        this.elegirModoDeDibujo('cobertura');
        this.pestanaLateral.set('directorio');
        break;
    }

    // LA TARJETA SE RECOLOCA DESPUES de que el paso haya cambiado lo que cambie: el elemento que
    // tiene que señalar puede no existir todavía —los controles del gráfico no están mientras se
    // mira el mapa— o haber cambiado de sitio.
    this.recolocarLaTarjetaDelTutorial();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.tutorialAbierto()) {
      this.cerrarTutorial();
      return;
    }

    if (this.modoExplorar()) {
      this.cerrarModoExplorar();
      return;
    }

    // De fuera hacia dentro: primero el detalle, que se abre encima, y solo
    // despues la lista del municipio que lo abrio. Escape no cerraba ninguno
    // de los dos: solo miraba el tutorial.
    if (this.fichaEnDetalle()) {
      this.fichaEnDetalle.set(null);
      return;
    }

    // DE DENTRO HACIA FUERA, UN NIVEL POR PULSACION. El panel del municipio tiene dos —la lista y
    // la ficha— y Escape tiene que deshacer el último paso, no el primero: cerrarlo entero desde la
    // ficha haría perder también la lista, que es justo a donde se quiere volver.
    if (this.procesoAbiertoEnElMunicipio()) {
      this.volverALaListaDelMunicipio();
      return;
    }

    if (this.municipioSeleccionado()) {
      this.municipioSeleccionado.set(null);
    }
  }

  /**
   * Lo que el mapa estaba enseñando justo antes de que el tutorial lo tomara prestado.
   *
   * <b>NULO SIGNIFICA «EL TUTORIAL NO ESTA PUESTO»</b>, y por eso restaurar dos veces seguidas no
   * hace nada la segunda: cerrar con Escape y cerrar con el aspa no pueden pisar lo que ya se
   * devolvió.
   */
  private estadoAntesDelTutorial: {
    modo: ModoDeDibujo; influencia: string; capa: string; departamento: string;
    municipio: string; lente: 'territorial' | 'territorios-sonoros' | 'practicas';
    grupo: string; vista: 'mapa' | 'grafico';
  } | null = null;

  /**
   * Guarda el mapa antes de que el tutorial lo use de escenario.
   *
   * <b>EL TUTORIAL CONDUCE EL MAPA DE VERDAD</b> —sus pasos 5 y 6 escriben `modoDeDibujo`— y
   * eso está bien: enseñar un modo describiéndolo sin dibujarlo no enseña nada. Lo que estaba mal
   * era cómo salía de ahí.
   */
  private recordarEstadoDelMapa(): void {
    this.estadoAntesDelTutorial = {
      modo: this.modoDeDibujo(),
      influencia: this.tipoDeInfluencia(),
      capa: this.capaActiva(),
      departamento: this.departamentoElegido(),
      municipio: this.municipioElegido(),
      lente: this.lenteDeLectura(),
      grupo: this.grupoResaltado(),
      vista: this.vistaCentral(),
    };
  }

  cerrarTutorial() {
    this.dejarDeVigilarElDesplazamiento();
    this.tutorialAbierto.set(false);
    this.reproduccionAutomatica.set(false);
    this.reproduccionEnPausa.set(false);
    this.detenerElAvance();
    this.recorridoGuiado.cerrar();
    this.anclaDelTutorial.set(null);
    this.panelActivo.set(null);

    // DEVUELVE EL MAPA DONDE ESTABA, Y NO A CERO.
    //
    // Aquí había un bloque rotulado «Reset filters» que ponía modo, capa, departamento y lente en
    // sus valores de fábrica. Se escribió cuando cerrar el tutorial sólo podía significar «deshaz
    // lo que el tour tocó», y desde entonces significa otra cosa: el tutorial se abre solo una vez
    // al día, así que quien llegaba con un departamento elegido —o abriendo un enlace compartido a
    // «Arauca, por territorios sonoros, mapa de calor»— perdía todo al cerrarlo, sin aviso y sin
    // forma de recuperarlo salvo rehacerlo a mano.
    //
    // Recordar y restaurar cuesta lo mismo y no descarta nada de nadie.
    const antes = this.estadoAntesDelTutorial;
    if (antes) {
      this.modoDeDibujo.set(antes.modo);
      this.tipoDeInfluencia.set(antes.influencia);
      this.capaActiva.set(antes.capa);
      this.departamentoElegido.set(antes.departamento);
      this.municipioElegido.set(antes.municipio);
      this.lenteDeLectura.set(antes.lente);
      this.grupoResaltado.set(antes.grupo);
      this.vistaCentral.set(antes.vista);
      this.estadoAntesDelTutorial = null;
    }
    this.tarjetaDelDepartamentoSenalado.set(null);
    this.fichaEnDetalle.set(null);

    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem('pnmc_last_tutorial_date', todayStr);
  }

  onOpenParticipation() {
    // LLEVABA A `/colaboradores`, la consola institucional en modo externo, retirada el 27
    // de agosto de 2026 por ser una segunda puerta de entrada. Desde el mapa publico,
    // «participar» es darse de alta, y eso es `/registro`.
    this.navigationService.navigate(PAGE_IDS.registro);
  }

  printMap() {
    window.print();
  }

  zoomIn() {
    if (this.map) this.map.zoomIn();
  }

  zoomOut() {
    if (this.map) this.map.zoomOut();
  }
}
