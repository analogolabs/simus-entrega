import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { Component, ContentChild, EventEmitter, Input, OnChanges, Output, TemplateRef, inject } from '@angular/core';
import { DEFAULT_TEXTS } from '../../../../core/cms/registro-de-textos-web';
import { TextosWebService } from '../../../../core/services/textos-web.service';
import { TextoWebPipe } from '../../../texto/texto-web.pipe';
import { FormsModule } from '@angular/forms';
import { LucideSlidersHorizontal } from '@lucide/angular';

import { AccesoMapaEcosistemaComponent } from '../acceso-mapa-ecosistema/acceso-mapa-ecosistema.component';
import { BarraExploracionEcosistemaComponent, VistaEcosistema } from '../barra-exploracion-ecosistema/barra-exploracion-ecosistema.component';
import { OpcionSeleccionable, SelectorMultipleComponent } from '../selector-multiple/selector-multiple.component';
import { BuscadorDeListaComponent } from '../buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro as OpcionDelDesplegable } from '../filtro-desplegable/filtro-desplegable.component';
import { EsqueletoComponent } from '../esqueleto/esqueleto.component';
import { CompactHeroComponent } from '../compact-hero/compact-hero.component';
import { MetricaEcosistema } from '../franja-metricas-ecosistema/franja-metricas-ecosistema.component';

import { BotonNativoDirective } from '../boton/boton.component';
import { PaginacionDeListaComponent } from '../paginacion-de-lista/paginacion-de-lista.component';
/** Una opción de un filtro: el valor que se guarda y la palabra que se ve. */
export interface OpcionDeFiltro {
  valor: string;
  etiqueta: string;
}

/**
 * Un filtro desplegable del directorio. La pantalla de cada proceso decide cuáles tiene y de qué
 * lista salen; el directorio solo los dibuja y avisa de lo que se elige.
 */
export interface FiltroDeDirectorio {
  /** Identifica al filtro en el aviso `filtroCambiado` y en el `id` del control. */
  id: string;
  etiqueta: string;
  /** Lo que dice la opción vacía: «Todos los departamentos». */
  textoTodos: string;
  opciones: readonly OpcionDeFiltro[];
  valor: string;
  /**
   * Filtro de SELECCIÓN MÚLTIPLE (varias opciones a la vez): se pinta con casillas y avisa cada marca por
   * `filtroAlternado`; lo elegido va en `valores`, no en `valor`.
   */
  multiple?: boolean;
  valores?: readonly string[];
  /** Un filtro que depende de otro (el municipio, del departamento) se apaga mientras no se pueda usar. */
  deshabilitado?: boolean;
  /** Lo que dice la opción vacía mientras el filtro está apagado: «Elige un departamento primero». */
  textoDeshabilitado?: string;
}

export interface OrdenDeDirectorio {
  valor: string;
  etiqueta: string;
}

/** Las frases del directorio, con el género y el número de cada proceso ya resueltos. */
export interface TextosDeDirectorio {
  cargando: string;
  /** El título del vacío cuando el directorio no tiene ningún registro publicado. */
  vacioTotalTitulo: string;
  vacioTotalTexto: string;
  /** El título del vacío cuando la consulta no devuelve nada. */
  vacioConsultaTitulo: string;
  /**
   * Lo que se aconseja cuando la consulta no devuelve nada; sin él, «Prueba con menos filtros.».
   * Festivales lo lee de su clave del CMS (`ecosistema_festivals_empty_desc`).
   */
  vacioConsultaTexto?: string;
  /** Cuántos hay en total, para decir «Hay 3 mercados publicados en el Ecosistema». */
  hayTotal: (total: number) => string;
}

/**
 * Arma las frases de un directorio a partir de cómo se llama lo que lista.
 *
 * <b>UNA SOLA REDACCIÓN POR PROCESO.</b> Cada directorio escribía las suyas y se desviaban: «No
 * encontramos talleres con esos filtros» en uno, «Ningún mercado coincide con esta consulta» en otro.
 */
export function textosDeDirectorio(singular: string, plural: string, femenino = false): TextosDeDirectorio {
  const publicado = femenino ? 'publicada' : 'publicado';
  const publicados = femenino ? 'publicadas' : 'publicados';
  const ninguno = femenino ? 'Ninguna' : 'Ningún';
  return {
    cargando: `Consultando ${femenino ? 'las' : 'los'} ${plural}…`,
    vacioTotalTitulo: `Todavía no hay ${plural} ${publicados}`,
    vacioTotalTexto: `Cuando el PNMC publique ${femenino ? 'la primera' : 'el primero'}, aparecerá aquí con su territorio y su descripción.`,
    vacioConsultaTitulo: `${ninguno} ${singular} coincide con esta consulta`,
    hayTotal: total => `Hay ${total} ${total === 1 ? `${singular} ${publicado}` : `${plural} ${publicados}`} en el Ecosistema.`,
  };
}

/**
 * El directorio público de un proceso del Ecosistema: la ARMAZÓN que comparten Mercados, Lutería,
 * Espacios para música en vivo y Redes y documentación.
 *
 * <b>ES EL ESTÁNDAR.</b> Nació como la pantalla de Festivales y se repitió a mano en cada proceso, y
 * cada copia se alejó un poco de la anterior: Lutería, Espacios y Redes llegaron con un formulario
 * suelto arriba y una rejilla de tarjetas, sin cifras, sin listado, sin orden ni paginación. Aquí
 * está una vez: encabezado, columna de búsqueda y filtros a la izquierda, franja de cifras con el
 * conmutador de vista, «Mostrando 1–12 de N», listado o cuadrícula, estados de carga, error y vacío,
 * y paginación.
 *
 * <b>LO PROPIO DE CADA PROCESO ENTRA POR FUERA</b>: los filtros y su lógica (en la pantalla del
 * proceso, que decide qué se ofrece y de dónde sale), las cifras y las dos plantillas de registro,
 * `#listado` y `#tarjeta`. El directorio no sabe qué es un taller ni un mercado.
 *
 * <b>SIN MAYÚSCULAS SOSTENIDAS</b> (docs/usuario/23-guia-de-estilo-de-textos.md): ocupan más espacio y se leen peor. Los rótulos y los
 * botones van en minúscula con mayúscula inicial.
 */
@Component({
  selector: 'app-directorio-ecosistema',
  standalone: true,
  imports: [TextoWebPipe, BotonNativoDirective, 
    CommonModule, FormsModule, NgTemplateOutlet,
    CompactHeroComponent, BarraExploracionEcosistemaComponent, AccesoMapaEcosistemaComponent,
    BuscadorDeListaComponent, FiltroDesplegableComponent, SelectorMultipleComponent, LucideSlidersHorizontal, EsqueletoComponent, PaginacionDeListaComponent,
  ],
  templateUrl: './directorio-ecosistema.component.html',
})
export class DirectorioEcosistemaComponent implements OnChanges {
  /** Distingue los `id` de los controles y el ancla de los resultados: `mercados`, `talleres`… */
  @Input({ required: true }) clave = '';
  /** El nombre del proceso, tal como se ve en el encabezado y en las etiquetas de lectura. */
  @Input({ required: true }) set titulo(valor: string) { this._titulo = valor; }
  get titulo(): string { return this.delCms('title', this._titulo); }
  private _titulo = '';
  /**
   * El último tramo de la miga de pan, si no es el título. Festivales dice «Festivales» en la miga y
   * lleva el título del encabezado en una clave del CMS que la dirección puede cambiar.
   */
  @Input() migaActual = '';
  /** El nombre de la región del explorador para lectores de pantalla; por omisión, «Explorador de {titulo}». */
  @Input() etiquetaDeRegion = '';
  @Input() set subtitulo(valor: string) { this._subtitulo = valor; }
  get subtitulo(): string { return this.delCms('subtitle', this._subtitulo); }
  private _subtitulo = '';
  /** El encabezado de la lista para quien usa lector de pantalla; por omisión, «{titulo} publicados en el Ecosistema». */
  @Input() set encabezadoDeLista(valor: string) { this._encabezadoDeLista = valor; }
  get encabezadoDeLista(): string { return this.delCms('list_heading', this._encabezadoDeLista); }
  private _encabezadoDeLista = '';

  @Input() set etiquetaBusqueda(valor: string) { this._etiquetaBusqueda = valor; }
  get etiquetaBusqueda(): string { return this.delCms('search_label', this._etiquetaBusqueda); }
  private _etiquetaBusqueda = 'Buscar';
  @Input() set placeholderBusqueda(valor: string) { this._placeholderBusqueda = valor; }
  get placeholderBusqueda(): string { return this.delCms('search_placeholder', this._placeholderBusqueda); }
  private _placeholderBusqueda = 'Nombre o lugar';
  @Input() set tituloFiltros(valor: string) { this._tituloFiltros = valor; }
  get tituloFiltros(): string { return this.delCms('filters_title', this._tituloFiltros); }
  private _tituloFiltros = 'Filtros';
  @Input() filtros: readonly FiltroDeDirectorio[] = [];
  @Input() busqueda = '';

  @Input() ordenes: readonly OrdenDeDirectorio[] = [];
  @Input() orden = '';
  /** El renglón que aclara qué ofrecen los filtros. */
  @Input() set ayuda(valor: string) { this._ayuda = valor; }
  get ayuda(): string { return this.delCms('filters_help', this._ayuda); }
  private _ayuda = '';
  /** El texto del botón del mapa; sin él, el directorio no ofrece el paso al mapa. */
  @Input() set etiquetaMapa(valor: string | null) { this._etiquetaMapa = valor; }
  get etiquetaMapa(): string | null { return this._etiquetaMapa === null ? null : this.delCms('map_label', this._etiquetaMapa); }
  private _etiquetaMapa: string | null = null;

  @Input() metricas: MetricaEcosistema[] = [];
  @Input() vista: VistaEcosistema = 'listado';
  @Input() set textos(valor: TextosDeDirectorio) { this._textos = valor; }
  get textos(): TextosDeDirectorio {
    if (!this.claveCms) { return this._textos; }
    return {
      ...this._textos,
      cargando: this.delCms('loading', this._textos.cargando),
      vacioTotalTitulo: this.delCms('empty_total_title', this._textos.vacioTotalTitulo),
      vacioTotalTexto: this.delCms('empty_total_text', this._textos.vacioTotalTexto),
      vacioConsultaTitulo: this.delCms('empty_query_title', this._textos.vacioConsultaTitulo),
      vacioConsultaTexto: this.delCms('empty_query_text', this._textos.vacioConsultaTexto ?? ''),
    };
  }
  private _textos: TextosDeDirectorio = textosDeDirectorio('registro', 'registros');

  /**
   * PREFIJO DE LAS CLAVES DEL CMS de este directorio (`dir_mercados`, `dir_luteria`…). Con él, el título, el
   * subtítulo, los rótulos del buscador y de los filtros y los mensajes de vacío salen del CMS (grupo «Textos de
   * la página» de cada directorio); lo que la pantalla pasa por las entradas queda como respaldo si falta la clave.
   */
  @Input() claveCms = '';
  private readonly webTexts = inject(TextosWebService);

  private delCms(sufijo: string, respaldo: string): string {
    if (!this.claveCms) { return respaldo; }
    const clave = `${this.claveCms}_${sufijo}`;
    return clave in DEFAULT_TEXTS ? this.webTexts.getWebText(clave) : respaldo;
  }

  /** Los registros de la página que se pinta. */
  @Input() visibles: readonly unknown[] = [];
  /** Cuántos devuelve la consulta, y cuántos hay publicados sin consulta. */
  @Input() total = 0;
  @Input() totalPublicados = 0;
  @Input() desde = 0;
  @Input() hasta = 0;
  @Input() pagina = 1;
  @Input() totalPaginas = 1;
  /** Cuántos registros por página y las cantidades que se ofrecen (selector común de la paginación). */
  @Input() porPagina = 12;
  @Input() cantidades: readonly number[] = [12, 24, 48];
  @Input() filtrosActivos = 0;
  @Input() hayFiltros = false;
  @Input() cargando = false;
  @Input() error = '';

  @Output() busquedaCambiada = new EventEmitter<string>();
  @Output() filtroCambiado = new EventEmitter<{ id: string; valor: string }>();
  /** Una opción de un filtro de selección múltiple se marcó o se desmarcó. */
  @Output() filtroAlternado = new EventEmitter<{ id: string; valor: string }>();
  @Output() ordenCambiado = new EventEmitter<string>();
  @Output() vistaCambiada = new EventEmitter<VistaEcosistema>();
  @Output() paginaCambiada = new EventEmitter<number>();
  @Output() porPaginaCambiado = new EventEmitter<number>();
  @Output() filtrosLimpiados = new EventEmitter<void>();
  @Output() mapaSolicitado = new EventEmitter<void>();
  @Output() regresoSolicitado = new EventEmitter<void>();

  /** Cómo se pinta un registro en el listado y en la cuadrícula: lo aporta cada proceso. */
  @ContentChild('listado') plantillaListado?: TemplateRef<{ $implicit: unknown }>;
  @ContentChild('tarjeta') plantillaTarjeta?: TemplateRef<{ $implicit: unknown }>;

  /** Lleva a los resultados: en móvil están debajo de la columna de filtros y fuera de la pantalla. */
  irAResultados(): void {
    document.getElementById(`resultados-de-${this.clave}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  get region(): string {
    return this.etiquetaDeRegion || `Explorador de ${this.titulo}`;
  }

  get encabezado(): string {
    return this.encabezadoDeLista || `${this.titulo} publicados en el Ecosistema`;
  }

  /**
   * Las opciones de cada desplegable, CALCULADAS UNA VEZ por cambio de entradas. Un método llamado desde
   * la plantilla devolvería una lista nueva en cada revisión y Angular, en desarrollo, lo lee como un
   * valor que cambió solo (NG0100).
   */
  opcionesPorFiltro = new Map<string, readonly OpcionDelDesplegable[]>();
  opcionesDeOrden: readonly OpcionDelDesplegable[] = [];
  /** Las casillas de cada filtro múltiple, calculadas una vez por cambio de entradas (como las de arriba). */
  multiplesPorFiltro = new Map<string, { opciones: OpcionSeleccionable[]; marcadas: number[] }>();
  /** Las cifras de la franja; MIENTRAS CARGA llevan un guion, porque «0 de 0 publicados» sería falso (decisión 117). */
  metricasMostradas: MetricaEcosistema[] = [];

  ngOnChanges(): void {
    this.metricasMostradas = this.cargando ? this.metricas.map(m => ({ ...m, value: '–', detail: m.detail ? '…' : m.detail })) : this.metricas;
    this.opcionesPorFiltro = new Map(this.filtros.map(filtro => {
      // La opción vacía lleva «todos» o, si el filtro depende de otro, lo que falta.
      const vacia = filtro.deshabilitado && filtro.textoDeshabilitado ? filtro.textoDeshabilitado : filtro.textoTodos;
      return [filtro.id, [{ id: '', etiqueta: vacia }, ...filtro.opciones.map(o => ({ id: o.valor, etiqueta: o.etiqueta }))]];
    }));
    this.multiplesPorFiltro = new Map(this.filtros.filter(f => f.multiple).map(f => [f.id, {
      opciones: f.opciones.map((o, i) => ({ id: i + 1, nombre: o.etiqueta })),
      marcadas: f.opciones.flatMap((o, i) => ((f.valores ?? []).includes(o.valor) ? [i + 1] : [])),
    }]));
    this.opcionesDeOrden = this.ordenes.map(o => ({ id: o.valor, etiqueta: o.etiqueta }));
  }

  filtroEnPantalla(id: string, valor: string): void {
    this.filtroCambiado.emit({ id, valor });
  }

  alternarEnPantalla(id: string, indice: number): void {
    const filtro = this.filtros.find(f => f.id === id);
    const opcion = filtro?.opciones[indice - 1];
    if (opcion) this.filtroAlternado.emit({ id, valor: opcion.valor });
  }
}
