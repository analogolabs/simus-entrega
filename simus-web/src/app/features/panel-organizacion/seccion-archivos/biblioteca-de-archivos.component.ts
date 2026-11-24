import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideTriangleAlert } from '@lucide/angular';
import { ArchivoEnElBanco, BancoDeArchivosService } from '../../../core/services/banco-de-archivos.service';
import { ServicioDeConfirmacion } from '../../../core/confirmacion/servicio-de-confirmacion';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { dimensionesLegibles, pesoLegible, tipoLegible } from '../../../shared/utils/datos-de-archivo';
import { BarraDeHerramientasComponent } from '../../../shared/components/ui/barra-de-herramientas/barra-de-herramientas.component';
import { BotonNativoDirective } from '../../../shared/components/ui/boton/boton.component';
import { BuscadorDeListaComponent } from '../../../shared/components/ui/buscador/buscador-de-lista.component';
import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { OrdenDeListaComponent } from '../../../shared/components/ui/orden-de-lista/orden-de-lista.component';
import { ColumnaOrdenable, EstadoDeOrden, alternarOrden, ordenarFilas } from '../../../shared/components/ui/orden-de-lista/orden-de-lista';
import { PanelLateralComponent } from '../../../shared/components/ui/panel-lateral/panel-lateral.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { AccionDeFila, AccionElegida, AccionesDeFilaComponent } from '../../../shared/components/ui/tabla-de-gestion/acciones-de-fila.component';
import { CeldaDeTablaDirective, ColumnaDeGestion, TablaDeGestionComponent } from '../../../shared/components/ui/tabla-de-gestion/tabla-de-gestion.component';

function sinTildes(texto: string): string { return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

/** Cuántos archivos se piden por página al servidor (su tope). Una organización tiene decenas, así que cabe en una. */
const POR_PAGINA = 100;

/**
 * LA BIBLIOTECA DE ARCHIVOS DE LA ORGANIZACIÓN (P4, prototipo B4): las imágenes que la organización subió, como una
 * biblioteca que se hojea en cuadrícula o en lista, se busca, se ordena, se filtra y se abre en una ficha lateral.
 *
 * <b>QUÉ CAMBIA Y QUÉ NO.</b> Los datos, las rutas y las reglas son las del banco de siempre (`BancoDeArchivosService`,
 * canal externo): el servidor decide qué ve esta organización y rechaza retirar lo que algo usa. Lo nuevo es de
 * presentación y se resuelve en el cliente con lo que el servidor ya devuelve: el conmutador cuadrícula/lista, la ficha
 * lateral con vista previa, buscar por nombre o texto alternativo, «Ordenar por» (nombre, fecha de carga, tamaño, tipo)
 * y los filtros de uso y de visibilidad. La consola sigue con `app-gestion-del-banco`, que no cambia.
 *
 * <b>POR QUÉ BUSCAR Y ORDENAR EN EL CLIENTE.</b> Una organización sube su foto y un material por edición, y el servidor
 * le fija una cuota de decenas de archivos; se leen todos (de cien en cien, por si algún día hay más) y la búsqueda y
 * el orden son instantáneos y exactos sobre el total, no sobre una página.
 *
 * <b>RETIRAR NO SE DESHACE.</b> Solo se ofrece si ninguna ficha usa el archivo; si lo usa, la opción sale apagada con el
 * motivo escrito (dónde está usado). Retirar pide confirmación en el diálogo común, también desde la ficha lateral.
 *
 * <b>SIN BARRA DE CUOTA</b> (decisión de producto del 13 de septiembre de 2026): se dice cuántos archivos hay y cuáles no
 * usa nadie; el tope sigue en el servidor.
 */
@Component({
  selector: 'app-biblioteca-de-archivos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FechaPipe, BarraDeHerramientasComponent, BotonNativoDirective, BuscadorDeListaComponent, EstadoDeListaComponent, FiltroDesplegableComponent,
    IndicadorDeEstadoComponent, OrdenDeListaComponent, PanelLateralComponent, SelectorSegmentadoComponent, AccionesDeFilaComponent,
    TablaDeGestionComponent, CeldaDeTablaDirective, LucideTriangleAlert,
  ],
  styles: [`
    :host { display: block; container-type: inline-size; }
    .cuadricula { display: grid; margin: 0; padding: 0; list-style: none; gap: 1.5rem 1.125rem; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); }
    @container (max-width: 30rem) { .cuadricula { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem .75rem; } }
    /* La tarjeta entera abre la ficha: el botón del nombre se estira sobre ella (::after) y el menú queda por encima. */
    .tarjeta { position: relative; min-width: 0; border-radius: .625rem; }
    .tarjeta:has(.tarjeta__nombre:focus-visible) { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: var(--anillo-foco-separacion); }
    .tarjeta__miniatura { position: relative; display: grid; aspect-ratio: 3 / 4; place-items: center; overflow: hidden; border-radius: .625rem; background: var(--color-niebla); }
    .tarjeta__miniatura img { width: 100%; height: 100%; object-fit: contain; }
    .tarjeta:hover .tarjeta__miniatura { box-shadow: 0 0 0 2px var(--color-morado-claro); }
    .tarjeta__sello { position: absolute; top: .5rem; left: .5rem; display: inline-flex; align-items: center; gap: .3rem; padding: .125rem .5rem; border-radius: 999px; background: #fff4d1; color: #6b4300; font-size: var(--text-dato); font-weight: 800; }
    .tarjeta__pie { display: flex; align-items: flex-start; justify-content: space-between; gap: .5rem; margin-top: .5rem; }
    .tarjeta__texto { min-width: 0; }
    .tarjeta__nombre { display: -webkit-box; padding: 0; border: 0; background: none; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
      color: var(--color-valor); font: inherit; font-weight: 700; line-height: 1.3; text-align: left; overflow-wrap: anywhere; cursor: pointer; }
    .tarjeta__nombre::after { content: ''; position: absolute; inset: 0; border-radius: .625rem; }
    .tarjeta__nombre:focus-visible { outline: none; }
    .tarjeta__meta { margin: .125rem 0 0; color: var(--color-rotulo); font-size: var(--text-dato); }
    .tarjeta__menu { position: relative; z-index: 1; flex: none; }
    .sin-vista { padding: .25rem; color: var(--color-rotulo); font-size: var(--text-dato); font-weight: 700; text-align: center; }
    .fila-miniatura { display: grid; width: 3rem; height: 3.5rem; flex: none; place-items: center; overflow: hidden; border-radius: .375rem; background: var(--color-niebla); }
    .fila-miniatura img { width: 100%; height: 100%; object-fit: contain; }
    .ficha__vista { display: grid; place-items: center; padding: .75rem; border-radius: .75rem; background: var(--color-niebla); }
    .ficha__vista img { max-width: 100%; max-height: 22rem; object-fit: contain; }
    .ficha__datos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem 1.5rem; margin: 1.25rem 0 0; }
    .ficha__datos dt { color: var(--color-rotulo); font-size: var(--text-dato); }
    .ficha__datos dd { margin: .125rem 0 0; color: var(--color-valor); font-weight: 700; }
    .ficha__seccion { margin: 1.5rem 0 .5rem; color: var(--color-morado); font-family: var(--font-alternate); font-size: var(--text-dato); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .ficha__acciones { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 1.5rem; }
  `],
  template: `
    <div class="space-y-4">
      <p role="status" class="text-cuerpo font-semibold text-verde-texto" [class.hidden]="!aviso()">{{ aviso() }}</p>
      @if (error() && archivos().length) { <p role="alert" class="text-cuerpo font-semibold text-amber-800">{{ error() }}</p> }

      @if (cargando() && !leido()) {
        <app-estado-de-lista tipo="cargando" titulo="Consultando los archivos de la organización…" />
      } @else if (error() && !archivos().length) {
        <app-estado-de-lista tipo="error" titulo="No fue posible consultar los archivos." [detalle]="error()">
          <button type="button" appBoton="secundaria" (click)="cargar()">Reintentar</button>
        </app-estado-de-lista>
      } @else if (!archivos().length) {
        <app-estado-de-lista titulo="Todavía no hay archivos" detalle="Las imágenes entran aquí al subir la foto de la organización o al adjuntarlas desde la ficha de un proceso." />
      } @else {
        <p class="text-cuerpo text-prosa" data-testid="resumen-de-archivos">
          {{ archivos().length }} {{ archivos().length === 1 ? 'archivo' : 'archivos' }}@if (sinUsar().length) { · {{ sinUsar().length }} sin usar ({{ pesoDeSinUsar() }}). No se borra nada por sí solo. }
        </p>

        <app-barra-de-herramientas etiqueta="Buscar, filtrar y ordenar los archivos" [mostradas]="visibles().length" [total]="archivos().length"
          [hayFiltros]="hayFiltros()" (quitarFiltros)="quitarFiltros()">
          <app-buscador-de-lista identificador="archivos-buscar" etiqueta="Buscar archivos" marcador="Nombre o texto alternativo"
            [valor]="busqueda()" [espera]="0" (cambiar)="busqueda.set($event)" />
          <app-filtro-desplegable rotulo="Uso" etiqueta="Filtrar los archivos por uso" identificador="archivos-uso"
            [opciones]="opcionesDeUso()" [elegida]="uso()" (cambiar)="uso.set($event)" />
          <app-filtro-desplegable rotulo="Visibilidad" etiqueta="Filtrar los archivos por visibilidad" identificador="archivos-visibilidad"
            [opciones]="opcionesDeVisibilidad()" [elegida]="visibilidad()" (cambiar)="visibilidad.set($event)" />
          <app-orden-de-lista etiquetaDeLaLista="los archivos" identificador="orden-de-archivos" [columnas]="criterios" [orden]="orden()" (cambiar)="orden.set($event)" />
        </app-barra-de-herramientas>

        <app-selector-segmentado [opciones]="vistas" [elegida]="vista()" etiquetaDelGrupo="Vista de los archivos" [soloIconos]="true" (elegir)="vista.set($event === 'lista' ? 'lista' : 'mosaico')" />

        @if (!visibles().length) {
          <app-estado-de-lista titulo="No hay archivos que coincidan." detalle="Cambia la búsqueda o los filtros elegidos.">
            <button type="button" appBoton="secundaria" (click)="quitarFiltros()">Quitar filtros</button>
          </app-estado-de-lista>
        } @else if (vista() === 'mosaico') {
          <ul class="cuadricula" data-testid="archivos-cuadricula">
            @for (archivo of visibles(); track archivo.id) {
              <li class="tarjeta" data-testid="archivo-tarjeta" [attr.data-uso]="archivo.huerfano ? 'sin-usar' : 'en-uso'">
                <div class="tarjeta__miniatura">
                  @if (seVe(archivo.id)) {
                    <img [src]="archivo.url" [alt]="archivo.alt || ''" width="240" height="320" loading="lazy" decoding="async" (error)="noSeVe(archivo.id)">
                  } @else { <span class="sin-vista">Sin vista previa</span> }
                  @if (archivo.huerfano) { <span class="tarjeta__sello"><svg lucideTriangleAlert [size]="13" aria-hidden="true"></svg>Sin usar</span> }
                </div>
                <div class="tarjeta__pie">
                  <div class="tarjeta__texto">
                    <button type="button" class="tarjeta__nombre" [title]="archivo.nombre" [attr.aria-label]="'Abrir la ficha de ' + archivo.nombre" (click)="abrirFicha(archivo)">{{ archivo.nombre }}</button>
                    <p class="tarjeta__meta">{{ detalleCorto(archivo) }}</p>
                  </div>
                  <div class="tarjeta__menu">
                    <app-acciones-de-fila [acciones]="accionesDe(archivo)" [descripcion]="archivo.nombre" (elegida)="alElegirAccion(archivo, $event)" />
                  </div>
                </div>
              </li>
            }
          </ul>
        } @else {
          <div data-testid="archivos-lista">
            <app-tabla-de-gestion etiqueta="Archivos de la organización" [columnas]="columnas" [filas]="visibles()" [clave]="claveDe"
              [orden]="orden()" (ordenar)="orden.set(alternarOrden(orden(), $event))"
              [acciones]="accionesDe" [descripcionDeFila]="nombreDe" (accion)="alElegirAccion($event.fila, $event.accion)"
              [atributosDeFila]="atributosDe" filaAbre (abrir)="abrirFicha($event)">
              <ng-template appCelda="nombre" let-archivo>
                <div class="flex items-center gap-3">
                  <span class="fila-miniatura">
                    @if (seVe(archivo.id)) { <img [src]="archivo.url" [alt]="archivo.alt || ''" width="48" height="56" loading="lazy" decoding="async" (error)="noSeVe(archivo.id)"> }
                    @else { <span class="sin-vista">—</span> }
                  </span>
                  <div class="min-w-0">
                    <button type="button" class="tg-titulo" (click)="abrirFicha(archivo)">{{ archivo.nombre }}</button>
                    <p class="tg-detalle">{{ archivo.alt || 'Sin texto alternativo' }}</p>
                  </div>
                </div>
              </ng-template>
              <ng-template appCelda="uso" let-archivo>
                <app-indicador-de-estado [etiqueta]="archivo.huerfano ? 'Sin usar' : 'En uso'" [tono]="archivo.huerfano ? 'requiere_accion' : 'logrado'" [conTexto]="true" />
              </ng-template>
              <ng-template appCelda="visibilidad" let-archivo>{{ visibilidadDe(archivo) }}</ng-template>
              <ng-template appCelda="tamano" let-archivo>{{ peso(archivo.bytes) }}<span class="tg-aparte">{{ dimensiones(archivo) }}</span></ng-template>
              <ng-template appCelda="fecha" let-archivo>{{ archivo.fechaCarga | fecha: 'fecha-hora' }}</ng-template>
            </app-tabla-de-gestion>
          </div>
        }
      }

      @if (seleccionado(); as archivo) {
        <app-panel-lateral [titulo]="archivo.nombre" idDelTitulo="ficha-de-archivo-titulo" (cerrar)="cerrarFicha()">
          <div data-testid="ficha-de-archivo">
            <div class="ficha__vista">
              @if (seVe(archivo.id)) { <img [src]="archivo.url" [alt]="archivo.alt || 'Vista previa de ' + archivo.nombre" width="360" height="352" (error)="noSeVe(archivo.id)"> }
              @else { <span class="sin-vista">Sin vista previa</span> }
            </div>
            <dl class="ficha__datos">
              <div><dt>Tipo</dt><dd>{{ tipo(archivo) }}</dd></div>
              <div><dt>Tamaño</dt><dd>{{ peso(archivo.bytes) }}@if (dimensiones(archivo)) { · {{ dimensiones(archivo) }} px }</dd></div>
              <div><dt>Cargado</dt><dd>{{ archivo.fechaCarga | fecha: 'fecha-hora' }}</dd></div>
              <div><dt>Visibilidad</dt><dd>{{ visibilidadDe(archivo) }}</dd></div>
            </dl>

            <p class="ficha__seccion" role="heading" aria-level="3">Dónde se usa</p>
            @if (archivo.huerfano) {
              <p><app-indicador-de-estado etiqueta="Sin usar" tono="requiere_accion" [conTexto]="true" /></p>
              <p class="mt-1 text-cuerpo text-prosa">Ninguna ficha usa este archivo. Se puede retirar del banco.</p>
            } @else {
              <ul class="space-y-1 text-cuerpo text-valor" data-testid="usos-del-archivo">
                @for (uso of archivo.usos; track uso.descripcion) { <li>{{ uso.descripcion }}@if (uso.esPublico) { <span class="text-rotulo"> · público</span> }</li> }
              </ul>
              <p class="mt-1 text-cuerpo text-prosa">Mientras se use no se puede retirar: quítalo antes de donde está.</p>
            }

            <p class="ficha__seccion" role="heading" aria-level="3">Texto alternativo</p>
            <p class="text-lectura text-valor">{{ archivo.alt || 'Sin texto alternativo' }}</p>

            <div class="ficha__acciones">
              <a [href]="archivo.url" target="_blank" rel="noopener" appBoton="secundaria">Ver el archivo</a>
              <a [href]="archivo.url" [attr.download]="archivo.nombre" appBoton="secundaria">Descargar</a>
              <button type="button" appBoton="secundaria" data-testid="ficha-retirar" [disabled]="!archivo.huerfano || retirando() === archivo.id"
                [attr.aria-describedby]="archivo.huerfano ? null : 'ficha-motivo-retirar'" (click)="retirar(archivo)">Retirar del banco</button>
            </div>
            @if (!archivo.huerfano) { <p id="ficha-motivo-retirar" class="mt-2 text-dato text-rotulo">{{ motivoDeUso(archivo) }}</p> }
          </div>
        </app-panel-lateral>
      }
    </div>
  `,
})
export class BibliotecaDeArchivosComponent implements OnInit {
  private readonly banco = inject(BancoDeArchivosService);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  readonly archivos = signal<readonly ArchivoEnElBanco[]>([]);
  readonly cargando = signal(false);
  readonly leido = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly retirando = signal<number | null>(null);
  readonly seleccionado = signal<ArchivoEnElBanco | null>(null);

  readonly busqueda = signal('');
  readonly uso = signal('todos');
  readonly visibilidad = signal('todas');
  /** Por omisión, lo último que se cargó primero (prototipo B4). */
  readonly orden = signal<EstadoDeOrden>({ columna: 'fecha', direccion: 'desc' });
  readonly vista = signal<'mosaico' | 'lista'>('mosaico');
  readonly alternarOrden = alternarOrden;

  readonly vistas: readonly OpcionSegmentada[] = [
    { id: 'mosaico', etiqueta: 'Vista de cuadrícula', icono: 'mosaico' },
    { id: 'lista', etiqueta: 'Vista de lista', icono: 'lista' },
  ];
  readonly columnas: readonly ColumnaDeGestion[] = [
    { id: 'nombre', etiqueta: 'Nombre' },
    { id: 'uso', etiqueta: 'Uso', ancho: 'estado', ordenable: false },
    { id: 'visibilidad', etiqueta: 'Visibilidad', ancho: 'corta', ordenable: false },
    { id: 'tamano', etiqueta: 'Tamaño', ancho: 'corta' },
    { id: 'fecha', etiqueta: 'Fecha de carga', ancho: 'fecha' },
  ];
  /** Lo que ofrece «Ordenar por»: las columnas ordenables y el tipo. */
  readonly criterios: readonly ColumnaOrdenable<ArchivoEnElBanco>[] = [
    { id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', valor: a => a.nombre },
    { id: 'fecha', etiqueta: 'Fecha de carga', tipo: 'fecha', valor: a => a.fechaCarga },
    { id: 'tamano', etiqueta: 'Tamaño', tipo: 'num', valor: a => a.bytes },
    { id: 'tipo', etiqueta: 'Tipo', tipo: 'texto', valor: a => tipoLegible(a.tipo) },
  ];

  readonly sinUsar = computed(() => this.archivos().filter(a => a.huerfano));
  readonly pesoDeSinUsar = computed(() => pesoLegible(this.sinUsar().reduce((suma, a) => suma + (a.bytes ?? 0), 0)));

  readonly hayFiltros = computed(() => !!this.busqueda().trim() || this.uso() !== 'todos' || this.visibilidad() !== 'todas');

  readonly opcionesDeUso = computed<readonly OpcionDeFiltro[]>(() => [
    { id: 'todos', etiqueta: 'Todos', conteo: this.archivos().length },
    { id: 'sin_usar', etiqueta: 'Sin usar', conteo: this.sinUsar().length },
    { id: 'en_uso', etiqueta: 'En uso', conteo: this.archivos().length - this.sinUsar().length },
  ]);
  readonly opcionesDeVisibilidad = computed<readonly OpcionDeFiltro[]>(() => [
    { id: 'todas', etiqueta: 'Todas', conteo: this.archivos().length },
    { id: 'publica', etiqueta: 'Pública', conteo: this.archivos().filter(a => a.visiblePublicamente).length },
    { id: 'privada', etiqueta: 'Privada', conteo: this.archivos().filter(a => !a.visiblePublicamente).length },
  ]);

  /** Lo que coincide con el buscador y los filtros, en el orden elegido. */
  readonly visibles = computed(() => {
    const q = sinTildes(this.busqueda());
    const uso = this.uso();
    const visibilidad = this.visibilidad();
    const filas = this.archivos().filter(a =>
      (!q || sinTildes(`${a.nombre} ${a.alt ?? ''}`).includes(q))
      && (uso === 'todos' || (uso === 'sin_usar') === a.huerfano)
      && (visibilidad === 'todas' || (visibilidad === 'publica') === a.visiblePublicamente));
    return ordenarFilas(filas, this.criterios, this.orden());
  });

  readonly claveDe = (a: ArchivoEnElBanco): number => a.id;
  readonly nombreDe = (a: ArchivoEnElBanco): string => a.nombre;
  readonly atributosDe = (a: ArchivoEnElBanco): Record<string, string | null> => ({ 'data-testid': 'fila-de-archivo', 'data-uso': a.huerfano ? 'sin-usar' : 'en-uso' });

  /** Los que no se pudieron pintar; se recuerda por identificador para no reintentar en bucle. */
  private readonly sinVistaPrevia = signal<ReadonlySet<number>>(new Set());
  seVe(id: number): boolean { return !this.sinVistaPrevia().has(id); }
  noSeVe(id: number): void { this.sinVistaPrevia.update(previos => new Set([...previos, id])); }

  peso = pesoLegible;
  tipo(a: ArchivoEnElBanco): string { return tipoLegible(a.tipo); }
  dimensiones(a: ArchivoEnElBanco): string { return dimensionesLegibles(a.ancho, a.alto); }
  visibilidadDe(a: ArchivoEnElBanco): string { return a.visiblePublicamente ? 'Pública' : 'Privada'; }
  /** La línea de la tarjeta: «48 KB · 720×960 · Privada». */
  detalleCorto(a: ArchivoEnElBanco): string {
    return [pesoLegible(a.bytes), this.dimensiones(a), this.visibilidadDe(a)].filter(Boolean).join(' · ');
  }
  motivoDeUso(a: ArchivoEnElBanco): string {
    return `Se está usando: ${a.usos.map(u => u.descripcion).join(' · ')}. Quítalo primero de donde está.`;
  }

  ngOnInit(): void { void this.cargar(); }

  /** Lee todos los archivos de la organización (de cien en cien) y se queda con ellos. */
  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    const primera = await this.banco.listar('externo', { tamano: POR_PAGINA, pagina: 1 });
    if (!primera.ok || !primera.data) {
      this.error.set(primera.error ?? 'No fue posible consultar los archivos.');
      this.cargando.set(false);
      return;
    }
    let todos = [...primera.data.items];
    for (let pagina = 2; pagina <= primera.data.totalPaginas; pagina++) {
      const siguiente = await this.banco.listar('externo', { tamano: POR_PAGINA, pagina });
      if (!siguiente.ok || !siguiente.data) { this.error.set(siguiente.error ?? 'No fue posible consultar todos los archivos.'); break; }
      todos = todos.concat(siguiente.data.items);
    }
    this.archivos.set(todos);
    this.leido.set(true);
    this.cargando.set(false);
    const abierto = this.seleccionado();
    if (abierto) this.seleccionado.set(todos.find(a => a.id === abierto.id) ?? null);
  }

  quitarFiltros(): void { this.busqueda.set(''); this.uso.set('todos'); this.visibilidad.set('todas'); }
  abrirFicha(archivo: ArchivoEnElBanco): void { this.seleccionado.set(archivo); }
  cerrarFicha(): void { this.seleccionado.set(null); }

  /**
   * Lo que se puede hacer con un archivo, en su menú: abrir la ficha, verlo (otra pestaña) y, al final y en rojo, retirarlo.
   * Retirar se ofrece apagado, con el motivo escrito, mientras algo lo use.
   */
  readonly accionesDe = (archivo: ArchivoEnElBanco): readonly AccionDeFila[] => [
    { id: 'ficha', etiqueta: 'Ver la ficha', tono: 'principal' },
    { id: 'abrir', etiqueta: 'Ver el archivo', enlace: archivo.url, nuevaPestana: true },
    {
      id: 'retirar', etiqueta: 'Retirar del banco', tono: 'peligro',
      deshabilitada: !archivo.huerfano || this.retirando() === archivo.id,
      motivo: archivo.huerfano ? undefined : this.motivoDeUso(archivo),
      confirmacion: this.peticionDeRetiro(archivo),
    },
  ];

  alElegirAccion(archivo: ArchivoEnElBanco, accion: AccionElegida): void {
    if (accion.id === 'ficha') this.abrirFicha(archivo);
    else if (accion.id === 'retirar') void this.retirarConfirmado(archivo);
  }

  private peticionDeRetiro(archivo: ArchivoEnElBanco) {
    return {
      titulo: 'Retirar del banco',
      detalle: `Se borra ${archivo.nombre || `el archivo ${archivo.id}`} del banco y no se puede deshacer. Ahora mismo no lo está usando ningún registro.`,
      accion: 'Retirar del banco',
      tono: 'destructiva' as const,
    };
  }

  /** «Retirar del banco» desde la ficha lateral: pide la confirmación aquí. */
  async retirar(archivo: ArchivoEnElBanco): Promise<void> {
    if (!archivo.huerfano) return;
    if (!(await this.confirmaciones.pedir(this.peticionDeRetiro(archivo)))) return;
    await this.retirarConfirmado(archivo);
  }

  async retirarConfirmado(archivo: ArchivoEnElBanco): Promise<void> {
    this.error.set('');
    this.aviso.set('');
    this.retirando.set(archivo.id);
    const resultado = await this.banco.retirar('externo', archivo.id);
    this.retirando.set(null);
    if (!resultado.ok) {
      this.error.set([resultado.error, resultado.usos?.join(' · ')].filter(Boolean).join(' '));
      return;
    }
    this.aviso.set(`Se retiró ${archivo.nombre || `el archivo ${archivo.id}`}.`);
    this.cerrarFicha();
    await this.cargar();
  }
}
