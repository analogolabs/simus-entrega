import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { FalloDelServidor, FestivalDeLaOrganizacion, MercadoDeLaOrganizacion, PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { BarraDeHerramientasComponent } from '../../shared/components/ui/barra-de-herramientas/barra-de-herramientas.component';
import { OrdenDeListaComponent } from '../../shared/components/ui/orden-de-lista/orden-de-lista.component';
import { ColumnaOrdenable, EstadoDeOrden, alternarOrden, ordenarFilas } from '../../shared/components/ui/orden-de-lista/orden-de-lista';
import { CeldaDeTablaDirective, ColumnaDeGestion, TablaDeGestionComponent } from '../../shared/components/ui/tabla-de-gestion/tabla-de-gestion.component';
import { AccionDeFila, AccionElegida } from '../../shared/components/ui/tabla-de-gestion/acciones-de-fila.component';
import { opcionesDeTipoDeProceso } from '../../shared/components/ui/barra-de-tipo/opciones-de-tipo';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { BuscadorDeListaComponent } from '../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { EncabezadoDePantallaComponent } from '../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { TIPOS_DE_PROCESO, TipoDeProceso, TipoDeProcesoInfo } from '../../core/navegacion/tipos-de-proceso';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { NombrePropioPipe } from '../../shared/texto/nombre-propio.pipe';
import { RAIZ_DE_LA_CUENTA, rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { Taller, TalleresService, etiquetaDeModalidad } from '../../core/services/talleres.service';
import { Espacio, EspaciosService, etiquetaDeAmbiente } from '../../core/services/espacios.service';
import { Red, RedesService, etiquetaDeTipoDeNodo } from '../../core/services/redes.service';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';
/** Los estados por los que se filtra, con su palabra. El orden es el del recorrido de un proceso. */
const ESTADOS_DE_PROCESO: readonly { id: string; etiqueta: string }[] = [
  { id: 'borrador', etiqueta: 'Borrador' },
  { id: 'enrevision', etiqueta: 'En revisión' },
  { id: 'ajustessolicitados', etiqueta: 'Ajustes solicitados' },
  { id: 'publicado', etiqueta: 'Publicado' },
  { id: 'archivado', etiqueta: 'Archivado' },
  { id: 'rechazado', etiqueta: 'Rechazado' },
];

/** La urgencia de cada estado, para ordenar por «Estado»: lo que pide acción primero, lo cerrado al final. */
const URGENCIA_DEL_ESTADO: Record<string, number> = { ajustessolicitados: 0, enrevision: 1, borrador: 2, rechazado: 3, publicado: 4, archivado: 5 };

/** Una fila de la lista única: lo que se pinta de cualquier tipo de proceso, ya con su palabra. */
interface FilaDeProceso {
  /** Única entre tipos: el identificador solo lo es dentro de su tipo. */
  clave: string;
  tipo: TipoDeProceso;
  tipoEtiqueta: string;
  /** La dirección del tipo dentro del panel; la ficha es esa más el identificador. */
  ruta: string;
  id: string | number;
  nombre: string;
  descripcion: string | null | undefined;
  territorio: string;
  estado: string | null | undefined;
  /** Un dato corto del tipo: las ediciones, la modalidad, el ambiente… */
  dato: string;
  detalle: string;
  ajustes: number;
  actualizado: string | null | undefined;
}

/** Si un tipo que no es imprescindible falla, la lista se pinta con los demás en vez de quedarse sin nada. */
function sinFallar<T>(fuente: Observable<T[]>): Observable<T[]> {
  return fuente.pipe(catchError(() => of([] as T[])));
}

/**
 * Entrada para incorporar procesos al Ecosistema desde una organización.
 *
 * Antes del primer registro es una invitación de incorporación. Después pasa a
 * ser un inventario breve de los procesos propios, sin repetirlos como tarjetas
 * ni presentar módulos todavía inexistentes como disponibles.
 */
@Component({
  selector: 'app-procesos-gestion-page',
  standalone: true,
  imports: [EsqueletoComponent, BotonNativoDirective, FechaPipe, NombrePropioPipe, RouterLink, NgTemplateOutlet, BarraDeHerramientasComponent, OrdenDeListaComponent, TablaDeGestionComponent, CeldaDeTablaDirective, IndicadorDeEstadoComponent, BuscadorDeListaComponent, FiltroDesplegableComponent, EstadoDeListaComponent, EncabezadoDePantallaComponent],
  template: `
    <section class="pb-8" aria-labelledby="procesos-gestion-titulo">
      <app-encabezado-de-pantalla idDelTitulo="procesos-gestion-titulo" titulo="Procesos"
        [descripcion]="descripcion()"
        [contador]="contadorDeLaLista()">
        @if (!cargando() && !error()) {
          <div class="relative flex" data-selector-procesos>
            <button type="button" (click)="alternarOpciones()" [attr.aria-expanded]="opcionesAbiertas()" aria-haspopup="menu" appBoton="principal">Registrar proceso</button>
            @if (opcionesAbiertas()) { <ng-container [ngTemplateOutlet]="selectorDeProcesos"></ng-container> }
          </div>
        }
      </app-encabezado-de-pantalla>
      @if (cargando()) {
        <app-esqueleto variante="fila" [cantidad]="2" etiqueta="Consultando los procesos de la organización…" />
      } @else if (error()) {
        <app-estado-de-lista tipo="error" titulo="No fue posible consultar los procesos." [detalle]="error()" />
      } @else if (!tieneProcesos()) {
        <ul class="divide-y divide-slate-200 border-y border-slate-200">
          @for (tipo of tiposRegistrables; track tipo.clave) {
            <li class="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between" [attr.aria-label]="'Tipo de proceso ' + tipo.nombre">
              <div class="min-w-0"><h2>{{ tipo.nombre }}</h2><p class="t-texto mt-1">{{ tipo.descripcion }}</p></div>
              <a [routerLink]="enPanel(tipo.ruta, 'nuevo')" [attr.data-registrar-mercado]="tipo.clave === 'mercados' ? '' : null" appBoton="secundaria" class="shrink-0">{{ tipo.accion }}</a>
            </li>
          }
        </ul>
      } @else {
        <!--
          UNA SOLA LISTA DE PROCESOS (LIS-02), LEÍDA POR TIPO (PANEL, decisión 126; P3 de la gestión externa). La barra de
          TIPO va arriba (Todos, Festivales, Mercados, Redes, Lutería y Espacios, con su conteo); debajo, una barra con UN
          buscador (nombre, descripción o territorio), el estado y «Ordenar por», y la cuenta con «Quitar filtros». La lista
          es una tabla de gestión: Nombre, Estado, Actualizado y «Acciones», con encabezados ordenables.
        -->
        <app-barra-de-herramientas etiqueta="Filtrar y ordenar los procesos" etiquetaDelTipo="Tipo de proceso" controla="lista-de-procesos"
          [tipos]="opcionesDeTipo()" [tipo]="tipoFiltro()" (elegirTipo)="tipoFiltro.set($event)"
          [mostradas]="filasFiltradas().length" [total]="cuantosProcesos()" [hayFiltros]="hayFiltros()" (quitarFiltros)="quitarFiltros()">
          <app-buscador-de-lista identificador="procesos-buscar" etiqueta="Buscar procesos"
            marcador="Nombre o territorio" [valor]="busqueda()" [espera]="0" (cambiar)="busqueda.set($event)" />
          <app-filtro-desplegable rotulo="Estado" etiqueta="Filtrar los procesos por estado" identificador="procesos-estado"
            [opciones]="opcionesDeEstado()" [elegida]="estadoFiltro()" (cambiar)="estadoFiltro.set($event)" />
          <app-orden-de-lista etiquetaDeLaLista="los procesos" identificador="orden-de-procesos" [columnas]="criteriosDeOrden" [orden]="orden()" (cambiar)="orden.set($event)" />
        </app-barra-de-herramientas>
        @if (administracionDelTipo(); as administracion) {
          <p class="t-texto mt-2">
            Para enviar a revisión, proponer cambios o solicitar el retiro:
            <a [routerLink]="enPanel(administracion.ruta)" [attr.data-administrar-festivales]="tipoFiltro() === 'festivales' ? '' : null" [attr.data-administrar-mercados]="tipoFiltro() === 'mercados' ? '' : null" class="font-bold text-morado">{{ administracion.etiqueta }}</a>
          </p>
        }

        <div id="lista-de-procesos" role="tabpanel" [attr.aria-labelledby]="'pestana-' + tipoFiltro()" class="mt-3">
        @if (!filasFiltradas().length) {
          <app-estado-de-lista titulo="No hay procesos que coincidan." detalle="Cambia la búsqueda o los filtros elegidos.">
            @if (hayFiltros()) { <button type="button" appBoton="secundaria" (click)="quitarFiltros()">Quitar filtros</button> }
          </app-estado-de-lista>
        } @else {
          <app-tabla-de-gestion etiqueta="Procesos de la organización" [columnas]="columnas" [filas]="filasFiltradas()" [clave]="claveDe"
            [orden]="orden()" (ordenar)="orden.set(alternarOrden(orden(), $event))"
            [acciones]="accionesDe" [descripcionDeFila]="nombreDe" (accion)="alElegirAccion($event.fila, $event.accion)"
            filaAbre (abrir)="abrir($event)">
            <ng-template appCelda="nombre" let-fila>
              <a class="tg-titulo" [routerLink]="enPanel(fila.ruta, fila.id)" [attr.data-proceso-tipo]="fila.tipo">{{ fila.nombre }}</a>
              <p class="tg-detalle">{{ fila.tipoEtiqueta }} · {{ fila.territorio | nombrePropio }}@if (fila.ajustes) { · {{ fila.ajustes }} {{ fila.ajustes === 1 ? 'ajuste por atender' : 'ajustes por atender' }} } @else if (fila.detalle) { · {{ fila.detalle }} }</p>
            </ng-template>
            <ng-template appCelda="estado" let-fila>
              <app-indicador-de-estado [etiqueta]="etiquetaEstado(fila.estado)" [tono]="tonoDelEstado(fila.estado)" [conTexto]="true"></app-indicador-de-estado>
            </ng-template>
            <ng-template appCelda="actualizado" let-fila>{{ fila.actualizado ? (fila.actualizado | fecha) : '—' }}</ng-template>
          </app-tabla-de-gestion>
        }
        </div>
      }
    </section>
    <ng-template #selectorDeProcesos>
      <div role="menu" class="absolute right-0 z-30 mt-3 w-[min(23rem,calc(100vw-2rem))] border border-slate-200 bg-white p-2 shadow-xl">
        @if (!esPersona()) {
        <a role="menuitem" [routerLink]="enPanel('procesos/festivales/nuevo')" (click)="opcionesAbiertas.set(false)" class="block border border-emerald-200 rounded-lg px-3 py-3 no-underline transition hover:bg-emerald-50"><span class="block text-sm font-bold text-morado">Festival</span><span class="mt-1 block text-xs leading-relaxed text-slate-500">Información permanente, Ediciones y presencia pública en el ecosistema.</span></a>
        <a role="menuitem" [routerLink]="enPanel('procesos/mercados/nuevo')" (click)="opcionesAbiertas.set(false)" data-menu-registrar-mercado class="block border border-emerald-200 rounded-lg px-3 py-3 no-underline transition hover:bg-emerald-50"><span class="block text-sm font-bold text-morado">Mercado musical</span><span class="mt-1 block text-xs leading-relaxed text-slate-500">Independiente o dentro de uno de tus Festivales, con su territorio y su publicación.</span></a>
        }
        <a role="menuitem" [routerLink]="enPanel('procesos/luteria/nuevo')" (click)="opcionesAbiertas.set(false)" data-menu-registrar-taller class="block border border-emerald-200 rounded-lg px-3 py-3 no-underline transition hover:bg-emerald-50"><span class="block text-sm font-bold text-morado">Taller de lutería</span><span class="mt-1 block text-xs leading-relaxed text-slate-500">Dónde se construyen, reparan o enseñan a hacer instrumentos, con su territorio y su publicación.</span></a>
        <a role="menuitem" [routerLink]="enPanel('procesos/espacios/nuevo')" (click)="opcionesAbiertas.set(false)" data-menu-registrar-espacio class="block border border-emerald-200 rounded-lg px-3 py-3 no-underline transition hover:bg-emerald-50"><span class="block text-sm font-bold text-morado">Espacio para música en vivo</span><span class="mt-1 block text-xs leading-relaxed text-slate-500">Un bar, una sala, un teatro o un escenario, con su territorio y su publicación.</span></a>
        <a role="menuitem" [routerLink]="enPanel('procesos/redes/nuevo')" (click)="opcionesAbiertas.set(false)" data-menu-registrar-red class="block border border-emerald-200 rounded-lg px-3 py-3 no-underline transition hover:bg-emerald-50"><span class="block text-sm font-bold text-morado">Red o centro de documentación</span><span class="mt-1 block text-xs leading-relaxed text-slate-500">Qué acervos tiene y cómo se consultan, con su territorio y su publicación.</span></a>
      </div>
    </ng-template>
  `,
})
export class ProcesosGestionPageComponent implements OnInit {
  private readonly api = inject(PanelOrganizacionApi);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly talleresApi = inject(TalleresService);
  private readonly espaciosApi = inject(EspaciosService);
  private readonly redesApi = inject(RedesService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    if (!this.esPersona()) return rutaDelPanel(this.store.organizacionId(), ...segmentos);
    // EN MI ESPACIO la misma lista lleva a las direcciones de la persona: `procesos/luteria/3` es `/gestion/cuenta/talleres/3`.
    const partes = segmentos.flatMap(x => String(x).split('/')).filter(Boolean);
    const propia: Record<string, string> = { luteria: 'talleres', espacios: 'espacios', redes: 'redes' };
    if (partes[0] === 'procesos' && propia[partes[1]]) return [RAIZ_DE_LA_CUENTA, propia[partes[1]], ...partes.slice(2)];
    return [RAIZ_DE_LA_CUENTA, ...partes];
  }

  /**
   * UNA LISTA, DOS ÁMBITOS (PANEL, decisión 126): la de una organización (`/gestion/o/{id}/procesos`) y la de la persona
   * (`/gestion/cuenta/procesos`), que solo registra Lutería, Espacios y Redes a título propio. Mismo componente.
   */
  readonly esPersona = signal(false);
  readonly tiposDisponibles = computed<readonly TipoDeProcesoInfo[]>(() => this.esPersona()
    ? TIPOS_DE_PROCESO.filter(t => t.clave === 'luteria' || t.clave === 'espacios' || t.clave === 'redes') : TIPOS_DE_PROCESO);
  readonly descripcion = computed(() => this.esPersona()
    ? (this.tieneProcesos() ? 'Tus talleres de lutería, espacios y redes, registrados con tu cuenta, en una sola lista.' : 'Aún no registras procesos con tu cuenta. Elige el tipo que quieres incorporar al ecosistema.')
    : (this.tieneProcesos() ? 'Festivales, Mercados, Redes, talleres de lutería y espacios de tu organización, en una sola lista.' : 'Aún no hay procesos registrados. Elige el tipo que deseas incorporar al ecosistema.'));
  readonly clavesDisponibles = computed(() => this.tiposDisponibles().map(t => t.clave));

  readonly festivales = signal<readonly FestivalDeLaOrganizacion[]>([]);
  readonly mercados = signal<readonly MercadoDeLaOrganizacion[]>([]);
  readonly talleres = signal<readonly Taller[]>([]);
  readonly espacios = signal<readonly Espacio[]>([]);
  readonly redes = signal<readonly Red[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly opcionesAbiertas = signal(false);
  readonly busqueda = signal('');
  readonly tipoFiltro = signal<string>('todos');
  readonly estadoFiltro = signal('todos');
  readonly tonoDelEstado = tonoDelEstado;
  readonly alternarOrden = alternarOrden;

  /** Las columnas de la tabla (el tipo y el territorio se leen bajo el nombre). */
  readonly columnas: readonly ColumnaDeGestion[] = [
    { id: 'nombre', etiqueta: 'Nombre' },
    { id: 'estado', etiqueta: 'Estado', ancho: 'estado' },
    { id: 'actualizado', etiqueta: 'Actualizado', ancho: 'fecha' },
  ];
  /** Por qué se puede ordenar: «Estado» va por urgencia (ajustes, revisión, borrador, publicado…). */
  readonly criteriosDeOrden: readonly ColumnaOrdenable<FilaDeProceso>[] = [
    { id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', valor: f => f.nombre },
    { id: 'estado', etiqueta: 'Estado', tipo: 'rank', valor: f => URGENCIA_DEL_ESTADO[this.estadoNormalizado(f.estado)] ?? 9 },
    { id: 'actualizado', etiqueta: 'Actualizado', tipo: 'fecha', valor: f => f.actualizado },
    { id: 'tipo', etiqueta: 'Tipo', tipo: 'texto', valor: f => f.tipoEtiqueta },
  ];
  /** Por omisión, lo más urgente primero (prototipo B4). */
  readonly orden = signal<EstadoDeOrden>({ columna: 'estado', direccion: 'asc' });
  readonly claveDe = (fila: FilaDeProceso): string => fila.clave;
  readonly nombreDe = (fila: FilaDeProceso): string => fila.nombre;
  readonly accionesDe = (fila: FilaDeProceso): readonly AccionDeFila[] => [
    { id: 'abrir', etiqueta: 'Abrir', tono: 'principal' },
    ...(fila.ajustes ? [{ id: 'ajustes', etiqueta: 'Atender ajustes' }] : []),
  ];
  alElegirAccion(fila: FilaDeProceso, accion: AccionElegida): void { if (accion.id === 'abrir' || accion.id === 'ajustes') this.abrir(fila); }
  abrir(fila: FilaDeProceso): void { void this.router.navigate(this.enPanel(fila.ruta, fila.id)); }
  readonly opcionesDeTipo = computed(() => opcionesDeTipoDeProceso({ conteos: this.conteosPorTipo(), total: this.cuantosProcesos(), tipos: this.clavesDisponibles() }));
  readonly hayFiltros = computed(() => !!this.busqueda().trim() || this.estadoFiltro() !== 'todos' || this.tipoFiltro() !== 'todos');
  quitarFiltros(): void { this.busqueda.set(''); this.estadoFiltro.set('todos'); this.tipoFiltro.set('todos'); }
  get tiposRegistrables(): readonly TipoDeProcesoInfo[] { return this.tiposDisponibles(); }

  /** Todos los procesos de la organización en una sola lista, del tipo que sean. */
  readonly filas = computed<readonly FilaDeProceso[]>(() => [
    ...this.festivales().map(festival => this.filaDeFestival(festival)),
    ...this.mercados().map(mercado => this.filaDeMercado(mercado)),
    ...this.talleres().map(taller => this.filaDeTaller(taller)),
    ...this.espacios().map(espacio => this.filaDeEspacio(espacio)),
    ...this.redes().map(red => this.filaDeRed(red)),
  ]);
  readonly cuantosProcesos = computed(() => this.filas().length);
  readonly tieneProcesos = computed(() => this.cuantosProcesos() > 0);
  /** Cuántos procesos hay de cada tipo: son los conteos de las pestañas. */
  readonly conteosPorTipo = computed<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    for (const fila of this.filas()) c[fila.tipo] = (c[fila.tipo] ?? 0) + 1;
    return c;
  });
  /**
   * EL FILTRO DE ESTADO: «Todos» y los estados que algún proceso del tipo elegido tiene (más el elegido, para no
   * dejar sin opción lo que está activo), cada uno con su conteo dentro del tipo de la pestaña.
   */
  readonly opcionesDeEstado = computed<readonly OpcionDeFiltro[]>(() => {
    const tipo = this.tipoFiltro();
    const delTipo = this.filas().filter(f => tipo === 'todos' || f.tipo === tipo);
    const conteos = new Map<string, number>();
    for (const fila of delTipo) {
      const clave = this.estadoNormalizado(fila.estado);
      conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
    }
    const elegido = this.estadoFiltro();
    return [
      { id: 'todos', etiqueta: 'Todos', conteo: delTipo.length },
      ...ESTADOS_DE_PROCESO
        .filter(e => (conteos.get(e.id) ?? 0) > 0 || e.id === elegido)
        .map(e => ({ ...e, conteo: conteos.get(e.id) ?? 0 })),
    ];
  });
  /** El contador discreto del encabezado: cuántos hay y cuántos esperan al PNMC. */
  readonly contadorDeLaLista = computed(() => {
    const n = this.cuantosProcesos();
    if (!n) return null;
    const enRevision = this.filas().filter(f => this.estadoNormalizado(f.estado) === 'enrevision').length;
    return `${n} ${n === 1 ? 'proceso' : 'procesos'}${enRevision ? ` · ${enRevision} en revisión` : ''}`;
  });
  readonly filasFiltradas = computed(() => {
    const tipo = this.tipoFiltro();
    return ordenarFilas(this.filas().filter(fila => (tipo === 'todos' || fila.tipo === tipo)
      && this.coincideConFiltros(fila.nombre, fila.descripcion, fila.estado, fila.territorio)), this.criteriosDeOrden, this.orden());
  });
  /**
   * LA ADMINISTRACIÓN DE LOS TIPOS QUE LA TIENEN. Con un tipo elegido, la lista ofrece el enlace a la
   * pantalla donde se envía a revisión, se proponen cambios o se solicita el retiro (Festivales y
   * Mercados); con «Todos» no hay un solo destino y no se ofrece.
   */
  readonly administracionDelTipo = computed(() => {
    const tipo = TIPOS_DE_PROCESO.find(t => t.clave === this.tipoFiltro());
    return tipo && (tipo.clave === 'festivales' || tipo.clave === 'mercados')
      ? { ruta: tipo.ruta, etiqueta: `Administrar ${tipo.etiquetaDeLista}` } : null;
  });
  ngOnInit(): void {
    // `?tipo=` abre la pestaña de ese tipo: así enlazan el Inicio y las demás pantallas.
    const tipoPedido = this.ruta.snapshot.queryParamMap.get('tipo');
    if (tipoPedido && TIPOS_DE_PROCESO.some(t => t.clave === tipoPedido)) this.tipoFiltro.set(tipoPedido);
    this.esPersona.set(this.ruta.snapshot.data?.['responsable'] === 'persona');
    if (this.esPersona()) {
      forkJoin({ talleres: sinFallar(this.talleresApi.mios()), espacios: sinFallar(this.espaciosApi.mios()), redes: sinFallar(this.redesApi.mios()) })
        .subscribe(({ talleres, espacios, redes }) => {
          this.talleres.set(talleres); this.espacios.set(espacios); this.redes.set(redes);
          this.cargando.set(false);
        });
      return;
    }
    const organizacionId = this.store.organizacionId();
    if (!organizacionId) {
      this.cargando.set(false);
      return;
    }
    // LOS CINCO TIPOS SE PIDEN A LA VEZ. En serie, la lista aparecería primero a medias y volvería a
    // saltar con cada respuesta. Solo los Festivales son imprescindibles.
    forkJoin({
      festivales: this.api.obtenerFestivales(organizacionId),
      mercados: sinFallar(this.api.obtenerMercados(organizacionId)),
      talleres: sinFallar(this.talleresApi.deLaOrganizacion(organizacionId)),
      espacios: sinFallar(this.espaciosApi.deLaOrganizacion(organizacionId)),
      redes: sinFallar(this.redesApi.deLaOrganizacion(organizacionId)),
    }).subscribe({
      next: ({ festivales, mercados, talleres, espacios, redes }) => {
        this.festivales.set(festivales);
        this.mercados.set(mercados);
        this.talleres.set(talleres);
        this.espacios.set(espacios);
        this.redes.set(redes);
        this.cargando.set(false);
      },
      error: (fallo: FalloDelServidor) => {
        this.error.set(fallo?.message ?? 'No fue posible consultar los procesos de la organización');
        this.cargando.set(false);
      },
    });
  }

  alternarOpciones(): void {
    this.opcionesAbiertas.update(abiertas => !abiertas);
  }

  @HostListener('document:keydown.escape')
  cerrarOpcionesConEscape(): void { this.opcionesAbiertas.set(false); }

  @HostListener('document:pointerdown', ['$event'])
  cerrarOpcionesAlSalir(evento: PointerEvent): void {
    const objetivo = evento.target as Element | null;
    if (!objetivo?.closest('[data-selector-procesos]')) this.opcionesAbiertas.set(false);
  }

  etiquetaEstado(estado: string | null | undefined): string {
    // EL NORMALIZADOR QUITA GUIONES Y ESPACIOS, así que `ajustes_solicitados` del mercado y
    // `AjustesSolicitados` del festival caen los dos en la misma clave. Una segunda tabla para el
    // mercado divergiría en el primer estado nuevo.
    const etiquetas: Record<string, string> = { borrador: 'Borrador', enrevision: 'En revisión', ajustessolicitados: 'Ajustes solicitados', publicado: 'Publicado', archivado: 'Archivado', rechazado: 'Rechazado' };
    return etiquetas[this.estadoNormalizado(estado)] ?? 'Sin estado';
  }

  territorioDelMercado(mercado: MercadoDeLaOrganizacion): string {
    if (mercado.nivelCobertura === 'nacional') return 'Todo el país';
    return [mercado.nombreMunicipio, mercado.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }

  territorioDe(festival: FestivalDeLaOrganizacion): string {
    return [festival.nombreMunicipio, festival.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }

  private nombreDelTipo(clave: TipoDeProceso): string {
    return TIPOS_DE_PROCESO.find(t => t.clave === clave)!.nombre;
  }

  private territorioDeCobertura(c: { nivelCobertura?: string | null; nombreMunicipio?: string | null; nombreDepartamento?: string | null }): string {
    if (c.nivelCobertura === 'nacional') return 'Todo el país';
    return [c.nombreMunicipio, c.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }

  private filaDeFestival(festival: FestivalDeLaOrganizacion): FilaDeProceso {
    const ediciones = festival.cuantasEdiciones || 0;
    return {
      clave: `festivales-${festival.id}`, tipo: 'festivales', tipoEtiqueta: this.nombreDelTipo('festivales'), ruta: 'procesos/festivales',
      id: festival.id, nombre: festival.nombre, descripcion: festival.descripcion, territorio: this.territorioDe(festival),
      estado: festival.estado,
      dato: `${festival.periodicidad || 'Periodicidad sin registrar'} · ${ediciones} ${ediciones === 1 ? 'edición' : 'ediciones'}`,
      // Las prácticas y territorios se leen en la ficha: en la fila harían cada festival de tres líneas (prototipo B4: una).
      detalle: '',
      ajustes: festival.cambiosPedidos || 0, actualizado: festival.fechaActualizacion,
    };
  }

  private filaDeMercado(mercado: MercadoDeLaOrganizacion): FilaDeProceso {
    return {
      clave: `mercados-${mercado.id}`, tipo: 'mercados', tipoEtiqueta: this.nombreDelTipo('mercados'), ruta: 'procesos/mercados',
      id: mercado.id, nombre: mercado.nombre, descripcion: mercado.descripcion, territorio: this.territorioDelMercado(mercado),
      estado: mercado.estadoRegistro,
      dato: `${mercado.numeroDeEdiciones} ${mercado.numeroDeEdiciones === 1 ? 'edición' : 'ediciones'}`,
      detalle: mercado.seRealizaEnElMarcoDeUnFestival && mercado.festivalNombre ? `En el marco de ${mercado.festivalNombre}` : '',
      ajustes: 0, actualizado: mercado.fechaActualizacion,
    };
  }

  private filaDeTaller(taller: Taller): FilaDeProceso {
    return {
      clave: `luteria-${taller.id}`, tipo: 'luteria', tipoEtiqueta: this.nombreDelTipo('luteria'), ruta: 'procesos/luteria',
      id: taller.id, nombre: taller.nombre, descripcion: taller.descripcion, territorio: this.territorioDeCobertura(taller),
      estado: taller.estadoRegistro, dato: etiquetaDeModalidad(taller.modalidad), detalle: '',
      ajustes: 0, actualizado: taller.fechaActualizacion,
    };
  }

  private filaDeEspacio(espacio: Espacio): FilaDeProceso {
    return {
      clave: `espacios-${espacio.id}`, tipo: 'espacios', tipoEtiqueta: this.nombreDelTipo('espacios'), ruta: 'procesos/espacios',
      id: espacio.id, nombre: espacio.nombre, descripcion: espacio.descripcion, territorio: this.territorioDeCobertura(espacio),
      estado: espacio.estadoRegistro, dato: etiquetaDeAmbiente(espacio.ambiente), detalle: '',
      ajustes: 0, actualizado: espacio.fechaActualizacion,
    };
  }

  private filaDeRed(red: Red): FilaDeProceso {
    return {
      clave: `redes-${red.id}`, tipo: 'redes', tipoEtiqueta: this.nombreDelTipo('redes'), ruta: 'procesos/redes',
      id: red.id, nombre: red.nombre, descripcion: red.descripcion, territorio: this.territorioDeCobertura(red),
      estado: red.estadoRegistro, dato: etiquetaDeTipoDeNodo(red.tipoDeNodo), detalle: '',
      ajustes: 0, actualizado: red.fechaActualizacion,
    };
  }

  private estadoNormalizado(estado: string | null | undefined): string {
    return (estado ?? '').replace(/[_\s-]/g, '').toLowerCase();
  }

  private coincideConFiltros(nombre: string, descripcion: string | null | undefined, estado: string | null | undefined, territorio: string): boolean {
    const busqueda = this.busqueda().trim().toLocaleLowerCase();
    // UN SOLO BUSCADOR: encuentra por nombre, descripción o territorio.
    const texto = `${nombre} ${descripcion ?? ''} ${territorio}`.toLocaleLowerCase();
    return (!busqueda || texto.includes(busqueda))
      && (this.estadoFiltro() === 'todos' || this.estadoNormalizado(estado) === this.estadoFiltro());
  }
}
