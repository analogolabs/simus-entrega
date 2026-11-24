import { ChangeDetectionStrategy, Component, Injector, computed, inject, input, signal } from '@angular/core';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { Router, RouterLink } from '@angular/router';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { BarraDeHerramientasComponent } from '../../../shared/components/ui/barra-de-herramientas/barra-de-herramientas.component';
import { OrdenDeListaComponent } from '../../../shared/components/ui/orden-de-lista/orden-de-lista.component';
import { ColumnaOrdenable, EstadoDeOrden, alternarOrden, ordenarFilas } from '../../../shared/components/ui/orden-de-lista/orden-de-lista';
import { CeldaDeTablaDirective, ColumnaDeGestion, TablaDeGestionComponent } from '../../../shared/components/ui/tabla-de-gestion/tabla-de-gestion.component';
import { AccionDeFila, AccionElegida } from '../../../shared/components/ui/tabla-de-gestion/acciones-de-fila.component';
import { opcionesDeTipoDeProceso } from '../../../shared/components/ui/barra-de-tipo/opciones-de-tipo';
import { BuscadorDeListaComponent } from '../../../shared/components/ui/buscador/buscador-de-lista.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { TIPO_OTRAS as PESTANA_OTRAS } from '../../../shared/components/ui/barra-de-tipo/opciones-de-tipo';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { tonoDelEstado } from '../../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { TIPOS_DE_PROCESO, tipoDeProcesoDeLaRuta } from '../../../core/navegacion/tipos-de-proceso';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { SolicitudDeLaCuenta, SolicitudesDeLaCuentaService } from './solicitudes-de-la-cuenta.service';

/** Los estados en que puede estar una solicitud, en el orden en que importan. */
const ESPERAS: readonly { id: string; etiqueta: string }[] = [
  { id: 'tu_accion', etiqueta: 'Esperan tu acción' },
  { id: 'en_espera', etiqueta: 'Esperan respuesta' },
  { id: 'resuelta', etiqueta: 'Resueltas' },
];
/** Sin tildes ni mayúsculas, para que «Lutería» se encuentre escribiendo «luteria». */
function normalizar(texto: string): string { return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
/** El estado «Archivadas»: las resueltas hace más de 90 días. Las trae el servidor aparte; siguen guardadas. */
export const ESTADO_ARCHIVADAS = 'archivadas';
const PRIORIDAD: Record<string, number> = { tu_accion: 0, en_espera: 1, resuelta: 2 };

/**
 * LA LISTA ÚNICA de solicitudes y actividad (SOL), la misma para todos los tipos de proceso.
 *
 * <b>PESTAÑAS POR TIPO, ESTADO COMO FILTRO</b> (PANEL, decisión 126, docs/desarrollo/30-consola-y-acceso.md §30.18). Las pestañas son el tipo de proceso
 * —Todos, Festivales, Mercados, Redes, Lutería y Espacios, más «Citas e invitaciones» para citas, invitaciones y eventos— y el ESTADO
 * («Esperan tu acción», «Esperan respuesta», «Resueltas») es un filtro desplegable con conteos. Antes era al revés. La
 * lista une todo, por omisión con lo más reciente arriba (se ordena por fecha, estado, tipo o nombre desde «Ordenar por» o
 * el encabezado; ordenar por «Estado» deja primero lo que espera la acción de la persona): la «actividad reciente» ya no
 * es una vista aparte, es esta misma lista.
 *
 * <b>LAS PIEZAS DE P3</b>: la barra de herramientas (tipo, buscador, estado, «Ordenar por», cuenta y «Quitar filtros») y la
 * tabla de gestión con su columna «Acciones». Cada fila lleva a la ficha donde se atiende.
 *
 * <b>NO ESCRIBE NADA.</b> Cada fila abre la ficha donde se atiende; allí viven las acciones.
 */
@Component({
  selector: 'app-lista-de-solicitudes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FechaPipe, BarraDeHerramientasComponent, OrdenDeListaComponent, TablaDeGestionComponent, CeldaDeTablaDirective, BuscadorDeListaComponent, EstadoDeListaComponent, FiltroDesplegableComponent, IndicadorDeEstadoComponent, BotonNativoDirective],
  template: `
    <div class="space-y-3">
      <app-barra-de-herramientas etiqueta="Filtrar y ordenar las solicitudes" etiquetaDelTipo="Tipo de proceso de las solicitudes" controla="lista-de-solicitudes"
        [tipos]="opcionesDeTipo()" [tipo]="tipo()" (elegirTipo)="tipo.set($event)"
        [mostradas]="visibles().length" [total]="totalDeLaVista()" [hayFiltros]="hayFiltros()" (quitarFiltros)="quitarFiltros()">
        <app-buscador-de-lista identificador="solicitudes-buscar" etiqueta="Buscar solicitudes"
          marcador="Solicitud, organización o detalle" [valor]="busqueda()" [espera]="0" (cambiar)="busqueda.set($event)" />
        <app-filtro-desplegable rotulo="Estado" etiqueta="Filtrar las solicitudes por estado" identificador="filtro-estado-solicitud"
          [opciones]="opcionesDeEstado()" [elegida]="estado()" (cambiar)="elegirEstado($event)" />
        <app-orden-de-lista etiquetaDeLaLista="las solicitudes" identificador="orden-de-solicitudes" [columnas]="columnasDeOrden" [orden]="orden()" (cambiar)="orden.set($event)" />
      </app-barra-de-herramientas>

      @if (enArchivadas()) {
        <p data-testid="aviso-de-archivadas" class="t-texto">Archivadas son las solicitudes resueltas hace más de 90 días. Siguen guardadas y no cuentan como pendientes.</p>
      }

      <div id="lista-de-solicitudes" role="tabpanel" [attr.aria-labelledby]="'pestana-' + tipo()">
        @if (enArchivadas() && cargandoArchivadas()) {
          <app-estado-de-lista tipo="cargando" titulo="Consultando las solicitudes archivadas…" />
        } @else if (enArchivadas() && errorArchivadas()) {
          <app-estado-de-lista data-testid="error-de-archivadas" tipo="error" [titulo]="errorArchivadas()">
            <button type="button" appBoton="secundaria" (click)="cargarArchivadas()" data-reintentar-archivadas>Reintentar</button>
          </app-estado-de-lista>
        } @else if (visibles().length === 0) {
          <app-estado-de-lista data-testid="sin-solicitudes" [titulo]="textoVacio()">
            @if (hayFiltros()) { <button type="button" appBoton="secundaria" (click)="quitarFiltros()">Quitar filtros</button> }
          </app-estado-de-lista>
        } @else {
          <app-tabla-de-gestion etiqueta="Solicitudes" [columnas]="columnas" [filas]="visibles()" [clave]="claveDe"
            [orden]="orden()" (ordenar)="orden.set(alternarOrden(orden(), $event))"
            [acciones]="accionesDe" [descripcionDeFila]="tituloDe" (accion)="alElegirAccion($event.fila, $event.accion)"
            [atributosDeFila]="atributosDe" filaAbre (abrir)="abrir($event)">
            <ng-template appCelda="nombre" let-fila>
              <p class="tg-rotulo">{{ fila.tipoEtiqueta }}@if (fila.organizacionNombre) { <span class="font-normal normal-case tracking-normal"> · {{ fila.organizacionNombre }}</span> }</p>
              <a class="tg-titulo" [routerLink]="rutaDe(fila)" [queryParams]="consultaDe(fila)">{{ fila.titulo }}</a>
              @if (fila.detalle) { <p class="tg-detalle">{{ fila.detalle }}</p> }
            </ng-template>
            <ng-template appCelda="estado" let-fila>
              <app-indicador-de-estado [etiqueta]="fila.estadoEtiqueta" [tono]="tonoDe(fila)" [conTexto]="true"></app-indicador-de-estado>
            </ng-template>
            <ng-template appCelda="fecha" let-fila>{{ fila.fecha | fecha }}</ng-template>
          </app-tabla-de-gestion>
        }
      </div>
    </div>
  `,
})
export class ListaDeSolicitudesComponent {
  readonly solicitudes = input.required<readonly SolicitudDeLaCuenta[]>();
  /** La organización de la lista; sin ella, la lista es la de la cuenta (Mi espacio). Solo sirve para pedir las archivadas. */
  readonly organizacionId = input<string | null>(null);

  private readonly injector = inject(Injector);
  /** Las archivadas se piden la primera vez que se elige el estado; nada se pide mientras nadie lo use. */
  readonly archivadas = signal<readonly SolicitudDeLaCuenta[] | null>(null);
  readonly cargandoArchivadas = signal(false);
  readonly errorArchivadas = signal('');
  readonly enArchivadas = computed(() => this.estado() === ESTADO_ARCHIVADAS);

  /** Elige el estado del filtro; «Archivadas» dispara su lectura la primera vez. */
  elegirEstado(id: string): void {
    this.estado.set(id);
    if (id === ESTADO_ARCHIVADAS && this.archivadas() === null) this.cargarArchivadas();
  }

  /** Lee las archivadas del servidor; también es lo que hace «Reintentar». */
  cargarArchivadas(): void {
    const servicio = this.injector.get(SolicitudesDeLaCuentaService);
    const organizacion = this.organizacionId();
    this.cargandoArchivadas.set(true);
    this.errorArchivadas.set('');
    (organizacion ? servicio.deLaOrganizacion(organizacion, true) : servicio.deLaCuenta(true)).subscribe({
      next: filas => { this.archivadas.set(filas ?? []); this.cargandoArchivadas.set(false); },
      error: () => { this.errorArchivadas.set('No fue posible consultar las solicitudes archivadas. Tus solicitudes siguen guardadas; inténtalo de nuevo.'); this.cargandoArchivadas.set(false); },
    });
  }

  readonly tonoDelEstado = tonoDelEstado;
  readonly alternarOrden = alternarOrden;

  /** Las columnas de la tabla. «Estado» ordena por urgencia: lo que espera tu acción primero. */
  readonly columnas: readonly ColumnaDeGestion[] = [
    { id: 'nombre', etiqueta: 'Solicitud' },
    { id: 'estado', etiqueta: 'Estado', ancho: 'estado' },
    { id: 'fecha', etiqueta: 'Fecha', ancho: 'fecha' },
  ];
  /** Lo que ofrece «Ordenar por»: las tres columnas más el tipo. */
  private readonly criterios: readonly ColumnaOrdenable<SolicitudDeLaCuenta>[] = [
    { id: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', valor: s => s.fecha },
    { id: 'estado', etiqueta: 'Estado', tipo: 'rank', valor: s => PRIORIDAD[s.espera] },
    { id: 'tipo', etiqueta: 'Tipo', tipo: 'texto', valor: s => s.tipoEtiqueta },
    { id: 'nombre', etiqueta: 'Solicitud', tipo: 'texto', valor: s => s.titulo },
  ];
  readonly columnasDeOrden = this.criterios;
  /** Por omisión, lo más reciente primero (prototipo B4). */
  readonly orden = signal<EstadoDeOrden>({ columna: 'fecha', direccion: 'desc' });

  private readonly router = inject(Router);
  readonly claveDe = (fila: SolicitudDeLaCuenta): string => fila.clave;
  readonly tituloDe = (fila: SolicitudDeLaCuenta): string => fila.titulo;
  readonly atributosDe = (fila: SolicitudDeLaCuenta): Record<string, string | null> => ({ 'data-testid': 'fila-de-solicitud', 'data-tipo': fila.tipo, 'data-espera': fila.espera });
  tonoDe(fila: SolicitudDeLaCuenta) { return tonoDelEstado(fila.espera === 'tu_accion' ? 'ajustes_solicitados' : fila.espera === 'en_espera' ? 'en_revision' : fila.estadoEtiqueta); }

  /** «Atender» si espera tu acción; si no, «Abrir». Es la única acción: lleva a donde se atiende. */
  readonly accionesDe = (fila: SolicitudDeLaCuenta): readonly AccionDeFila[] =>
    [{ id: 'abrir', etiqueta: fila.espera === 'tu_accion' ? 'Atender' : 'Abrir', tono: 'principal' }];

  alElegirAccion(fila: SolicitudDeLaCuenta, accion: AccionElegida): void { if (accion.id === 'abrir') this.abrir(fila); }
  abrir(fila: SolicitudDeLaCuenta): void { void this.router.navigate([this.rutaDe(fila)], { queryParams: this.consultaDe(fila) ?? undefined }); }

  /** Solo los tipos que tienen solicitudes (más el elegido): una barra con cinco tipos en cero no ayuda a nadie (prototipo B4). */
  readonly opcionesDeTipo = computed(() => {
    const conteos = this.conteosPorTipo();
    const elegido = this.tipo();
    return opcionesDeTipoDeProceso({
      conteos, total: this.deLaEspera().length, conOtras: this.hayOtras() || elegido === PESTANA_OTRAS,
      tipos: TIPOS_DE_PROCESO.map(t => t.clave).filter(clave => (conteos[clave] ?? 0) > 0 || clave === elegido),
    });
  });
  readonly hayFiltros = computed(() => !!this.busqueda().trim() || this.estado() !== 'todos' || this.tipo() !== 'todos');
  /** Cuántas habría sin búsqueda, estado ni tipo: la vista vigente o la de archivadas. */
  readonly totalDeLaVista = computed(() => this.enArchivadas() ? (this.archivadas()?.length ?? 0) : this.solicitudes().length);
  quitarFiltros(): void { this.busqueda.set(''); this.tipo.set('todos'); this.estado.set('todos'); }

  /** La ruta del servidor puede traer su consulta (`?solicitud=17`): el enlace la separa para no codificarla. */
  rutaDe(fila: SolicitudDeLaCuenta): string { return fila.ruta.split('?')[0]; }
  consultaDe(fila: SolicitudDeLaCuenta): Record<string, string> | null {
    const [, texto] = fila.ruta.split('?');
    return texto ? Object.fromEntries(new URLSearchParams(texto)) : null;
  }

  /** La pestaña: el tipo de proceso. */
  readonly tipo = signal<string>('todos');
  /** El texto del buscador (título, organización o detalle). */
  readonly busqueda = signal('');
  /** El filtro: el estado de la solicitud (`todos`, `tu_accion`, `en_espera`, `resuelta`). */
  readonly estado = signal<string>('todos');

  private tipoDe(fila: SolicitudDeLaCuenta): string { return tipoDeProcesoDeLaRuta(fila.ruta) ?? PESTANA_OTRAS; }

  /** Lo de `lista` que coincide con el buscador; sin texto, todo. */
  private buscar(lista: readonly SolicitudDeLaCuenta[]): readonly SolicitudDeLaCuenta[] {
    const q = normalizar(this.busqueda());
    return q ? lista.filter(s => normalizar([s.titulo, s.organizacionNombre, s.detalle, s.tipoEtiqueta, s.estadoEtiqueta].filter(Boolean).join(' ')).includes(q)) : lista;
  }

  /** Lo vigente que coincide con el buscador (de ahí salen las opciones del filtro de estado). */
  private readonly coincidentes = computed(() => this.buscar(this.solicitudes()));
  /** Lo que se está viendo: lo vigente o, en «Archivadas», lo que trajo el servidor, con la misma búsqueda. */
  private readonly base = computed(() => this.enArchivadas() ? this.buscar(this.archivadas() ?? []) : this.coincidentes());

  /** Todo, en el orden elegido (por omisión, lo más reciente primero). */
  private readonly ordenadas = computed(() => ordenarFilas(this.base(), this.criterios, this.orden()));

  /** Lo que queda al aplicar el filtro de estado: de ahí salen los conteos de las pestañas. */
  readonly deLaEspera = computed(() => {
    const estado = this.estado();
    return estado === 'todos' || estado === ESTADO_ARCHIVADAS ? this.ordenadas() : this.ordenadas().filter(s => s.espera === estado);
  });

  readonly conteosPorTipo = computed<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    for (const fila of this.deLaEspera()) { const t = this.tipoDe(fila); c[t] = (c[t] ?? 0) + 1; }
    return c;
  });
  readonly hayOtras = computed(() => this.base().some(s => this.tipoDe(s) === PESTANA_OTRAS));

  /** El estado se ofrece con lo que hay en el tipo elegido, con su conteo. */
  readonly opcionesDeEstado = computed<OpcionDeFiltro[]>(() => {
    const tipo = this.tipo();
    const delTipo = this.coincidentes().filter(s => tipo === 'todos' || this.tipoDe(s) === tipo);
    return [
      { id: 'todos', etiqueta: 'Todos', conteo: delTipo.length },
      ...ESPERAS.map(e => ({ ...e, conteo: delTipo.filter(s => s.espera === e.id).length })),
      // Sin conteo: las archivadas no se leen hasta que se piden y no cuentan como pendientes.
      { id: ESTADO_ARCHIVADAS, etiqueta: 'Archivadas (más de 90 días)' },
    ];
  });

  readonly visibles = computed(() => {
    const tipo = this.tipo();
    const filas = this.deLaEspera();
    return tipo === 'todos' ? filas : filas.filter(f => this.tipoDe(f) === tipo);
  });

  readonly textoVacio = computed(() => {
    if (this.busqueda().trim()) return 'No hay solicitudes que coincidan con la búsqueda.';
    if (this.enArchivadas()) return 'No hay solicitudes archivadas con este tipo. Aquí aparecen las resueltas hace más de 90 días.';
    if (!this.solicitudes().length) return 'Todavía no hay solicitudes ni actividad. Lo que envíes a revisión o pidas a otra persona aparecerá aquí.';
    return ({
      tu_accion: 'Nada espera tu acción por ahora.',
      en_espera: 'Nada está esperando una respuesta. Lo que envíes a revisión o pidas a otra persona aparecerá aquí.',
      resuelta: 'Todavía no hay solicitudes resueltas.',
    } as Record<string, string>)[this.estado()] ?? 'No hay solicitudes de este tipo con el estado elegido.';
  });
}
