import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EstadoDeListaComponent } from '../../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { AccionDeRegistro, MenuDeAccionesComponent } from '../../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';
import { FiltroDeSedeComponent, FiltroDeSede } from '../../../shared/components/ui/filtro-de-sede/filtro-de-sede.component';
import { BarraDeListaComponent } from '../../../shared/components/ui/barra-de-lista/barra-de-lista.component';
import { BuscadorDeListaComponent } from '../../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { PestanasDeTipoComponent } from '../../../shared/components/ui/pestanas-de-tipo/pestanas-de-tipo.component';
import { IndicadorDeEstadoComponent } from '../../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { NombrePropioPipe } from '../../../shared/texto/nombre-propio.pipe';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { descargarPlantillaDeProceso } from '../../../shared/utils/plantillas-de-procesos';
import { TIPOS_DE_PROCESO, TipoDeProceso as TipoDePestana } from '../../../core/navegacion/tipos-de-proceso';
import {
  FilaDeProcesoDeLaConsola, PROCESOS_DE_LA_CONSOLA, ProcesosDeLaConsolaService, TipoDeProceso,
} from '../../../core/services/procesos-de-la-consola.service';

/** La clave de la pestaña (`luteria`) y el módulo de la consola (`talleres`) de cada uno de los tres procesos. */
export const MODULO_DE_LA_PESTANA: Readonly<Record<string, TipoDeProceso>> = { luteria: 'talleres', espacios: 'espacios', redes: 'redes' };
export const PESTANA_DEL_MODULO: Readonly<Record<TipoDeProceso, TipoDePestana>> = { talleres: 'luteria', espacios: 'espacios', redes: 'redes' };

/**
 * LA LISTA ÚNICA DE PROCESOS DE LA CONSOLA (`/administracion/procesos`), con el tipo como pestaña y el estado
 * como filtro (decisión 126 de `docs/referencia/20-decisiones-y-flujos-por-modulo.md`, `docs/desarrollo/30-consola-y-acceso.md` §30.18; retiro de las listas por tipo, decisión 132).
 *
 * <b>SUSTITUYE A TRES LISTAS CASI IDÉNTICAS</b> (`/administracion/talleres`, `/espacios` y `/redes`): una sola
 * implementación para Lutería, Espacios y Redes, con la misma búsqueda, el mismo filtro de responsable y de sede
 * principal, la misma importación asistida y la plantilla, y la misma puerta a la ficha de cada proceso
 * (`/administracion/{módulo}/{id}`), donde se decide. Las direcciones de antes redirigen aquí con `?tipo=`.
 *
 * <b>NO CREA PROCESOS.</b> Los registra su responsable; la consola los revisa, los publica y los retira. Los que
 * esperan la decisión del Programa se ofrecen primero (el estado «En revisión» es el de partida) y también
 * llegan a la bandeja de Solicitudes.
 */
@Component({
  selector: 'app-admin-procesos-panel',
  standalone: true,
  imports: [
    EstadoDeListaComponent, MenuDeAccionesComponent, FiltroDeSedeComponent, BarraDeListaComponent, BuscadorDeListaComponent,
    FiltroDesplegableComponent, PestanasDeTipoComponent, FechaPipe, NombrePropioPipe, IndicadorDeEstadoComponent,
  ],
  template: `
    <section aria-labelledby="admin-procesos-titulo" class="space-y-5">
      <!-- El título y la descripción ya los pone la cabecera de la página: repetirlos aquí era un segundo título igual. -->
      <h2 id="admin-procesos-titulo" class="sr-only">Procesos del ecosistema</h2>

      <app-pestanas-de-tipo etiquetaDelGrupo="Tipo de proceso" controla="lista-de-procesos-de-la-consola"
        [tipos]="pestanasOfrecidas()" [conteos]="conteos()" [total]="totalGeneral()" [elegida]="tipo()" (elegir)="elegirTipo($event)" />

      <section class="space-y-3" aria-label="Filtros de procesos">
        <app-barra-de-lista>
          <app-buscador-de-lista identificador="buscar-proceso" etiqueta="Buscar proceso"
            marcador="Nombre o descripción" [valor]="busqueda()" (cambiar)="busqueda.set($event); cargar()" />
          <app-filtro-desplegable rotulo="Estado" etiqueta="Filtrar por estado" identificador="filtro-estado-proceso"
            [opciones]="opcionesDeEstado" [elegida]="estado()" (cambiar)="estado.set($event); cargar()" />
          <app-filtro-desplegable rotulo="Responsable" etiqueta="Filtrar por responsable" identificador="filtro-responsable-proceso"
            [opciones]="opcionesDeResponsable" [elegida]="responsable()" (cambiar)="responsable.set($event); cargar()" />
          <app-filtro-de-sede idBase="procesos" [departamento]="sedeDepartamento()" [municipio]="sedeMunicipio()"
            [pendiente]="sedePendiente()" (cambiar)="filtrarPorSede($event)" />
          <ng-container extremo>
            <app-menu-de-acciones etiqueta="Más acciones" descripcion="la lista de procesos"
              [acciones]="acciones()" (elegida)="elegirAccionDeLaLista($event)" />
          </ng-container>
        </app-barra-de-lista>
        @if (aviso()) { <p class="text-sm font-semibold text-verde-texto" role="status">{{ aviso() }}</p> }
      </section>

      @if (error()) { <app-estado-de-lista tipo="error" titulo="No fue posible consultar los procesos." [detalle]="error()" [denso]="true" /> }

      <div id="lista-de-procesos-de-la-consola">
        @if (cargando()) {
          <app-estado-de-lista tipo="cargando" titulo="Consultando los procesos…" />
        } @else if (!filas().length) {
          <app-estado-de-lista tipo="vacio" titulo="No hay procesos con esos criterios." detalle="Cambia el tipo, el estado o los filtros para ver otros." data-testid="sin-procesos" />
        } @else {
          <p class="mb-2 text-xs text-slate-500" role="status">{{ cuenta() }}</p>
          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table class="min-w-full text-left text-sm">
              <caption class="sr-only">Procesos del ecosistema</caption>
              <thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" class="px-4 py-3">Proceso</th>
                  <th scope="col" class="px-4 py-3">Responsable</th>
                  <th scope="col" class="px-4 py-3">Sede principal</th>
                  <th scope="col" class="px-4 py-3">Estado</th>
                  <th scope="col" class="px-4 py-3">Actualizado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (f of filas(); track f.tipo + f.id) {
                  <tr class="hover:bg-slate-50" data-testid="fila-de-proceso-consola" [attr.data-tipo]="f.tipo">
                    <td class="px-4 py-3">
                      <button type="button" (click)="ficha.emit({ modulo: f.tipo, id: String(f.id) })" class="text-left font-bold text-morado underline-offset-2 hover:underline">{{ f.nombre }}</button>
                      <span class="block text-xs text-slate-500">{{ rotuloDelTipo(f) }}@if (f.detalle) { · {{ f.detalle }} }</span>
                    </td>
                    <td class="px-4 py-3">{{ f.organizacionNombre || ((f.responsableNombre || 'Una persona') + ' (independiente)') }}</td>
                    <td class="px-4 py-3">{{ territorio(f) | nombrePropio }}</td>
                    <td class="px-4 py-3">
                      <app-indicador-de-estado [etiqueta]="f.etiquetaDeEstado" [tono]="tonoDelEstado(f.estadoRegistro)" [matiz]="matizDelEstado(f.estadoRegistro)" [conTexto]="true"></app-indicador-de-estado>
                    </td>
                    <td class="px-4 py-3 text-xs text-slate-500">{{ f.fecha | fecha }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class AdminProcesosPanelComponent {
  private readonly servicio = inject(ProcesosDeLaConsolaService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly enabled = input(true);
  /** Los módulos que la cuenta puede abrir (`null`: aún no se sabe, se ofrecen los tres). */
  readonly modulos = input<readonly string[] | null>(null);
  /** Se abre la ficha de este proceso: la dirección propia la pone el armazón. */
  readonly ficha = output<{ modulo: TipoDeProceso; id: string }>();
  /** Pide abrir la importación asistida del módulo (la pinta el armazón, como en Mercados). */
  readonly importar = output<TipoDeProceso>();

  readonly String = String;
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  /** El tipo elegido: `todos` o la clave de la pestaña (`luteria`, `espacios`, `redes`). Sale de `?tipo=`. */
  readonly tipo = signal('todos');
  readonly resultados = signal<Partial<Record<TipoDeProceso, { items: FilaDeProcesoDeLaConsola[]; total: number }>>>({});
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly generandoPlantilla = signal(false);
  readonly busqueda = signal('');
  readonly estado = signal('en_revision');
  readonly responsable = signal('');
  /** El filtro por SEDE principal (decisión 124): departamento, municipio y «pendiente de completar». */
  readonly sedeDepartamento = signal('');
  readonly sedeMunicipio = signal('');
  readonly sedePendiente = signal(false);

  readonly opcionesDeEstado: readonly OpcionDeFiltro[] = [
    { id: 'todos', etiqueta: 'Todos' },
    { id: 'en_revision', etiqueta: 'En revisión' },
    { id: 'ajustes_solicitados', etiqueta: 'Ajustes solicitados' },
    { id: 'borrador', etiqueta: 'Borrador' },
    { id: 'publicado', etiqueta: 'Publicado' },
    { id: 'rechazado', etiqueta: 'Rechazado' },
    { id: 'archivado', etiqueta: 'Archivado' },
  ];
  readonly opcionesDeResponsable: readonly OpcionDeFiltro[] = [
    { id: '', etiqueta: 'Cualquiera' },
    { id: 'organizacion', etiqueta: 'Una organización' },
    { id: 'persona', etiqueta: 'Una persona' },
  ];

  /** Los módulos que esta cuenta puede ver: sin permiso, ni pestaña ni petición (el servidor respondería 403). */
  readonly modulosPermitidos = computed<TipoDeProceso[]>(() => {
    const mios = this.modulos();
    return (Object.keys(PROCESOS_DE_LA_CONSOLA) as TipoDeProceso[]).filter(m => mios === null || mios.includes(m));
  });
  readonly pestanasOfrecidas = computed(() => TIPOS_DE_PROCESO
    .filter(t => t.clave in MODULO_DE_LA_PESTANA && this.modulosPermitidos().includes(MODULO_DE_LA_PESTANA[t.clave]))
    .map(t => t.clave as string));

  readonly conteos = computed<Record<string, number>>(() => {
    const r = this.resultados();
    const c: Record<string, number> = {};
    for (const m of this.modulosPermitidos()) c[PESTANA_DEL_MODULO[m]] = r[m]?.total ?? 0;
    return c;
  });
  readonly totalGeneral = computed(() => Object.values(this.conteos()).reduce((a, n) => a + n, 0));

  /** Las filas del tipo elegido; en «Todos», las de los tres, de la más reciente a la más antigua. */
  readonly filas = computed<FilaDeProcesoDeLaConsola[]>(() => {
    const r = this.resultados();
    const elegido = MODULO_DE_LA_PESTANA[this.tipo()];
    if (elegido) return r[elegido]?.items ?? [];
    return this.modulosPermitidos()
      .flatMap(m => r[m]?.items ?? [])
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  });

  readonly cuenta = computed(() => {
    const elegido = MODULO_DE_LA_PESTANA[this.tipo()];
    const total = elegido ? (this.resultados()[elegido]?.total ?? 0) : this.totalGeneral();
    const n = this.filas().length;
    const palabra = total === 1 ? '1 proceso' : `${total} procesos`;
    return n < total ? `${palabra} (se muestran ${n})` : palabra;
  });

  /** Las acciones de la lista: importar y descargar la plantilla del tipo elegido (en «Todos», las de los tres). */
  readonly acciones = computed<AccionDeRegistro[]>(() => {
    const elegido = MODULO_DE_LA_PESTANA[this.tipo()];
    const modulos = elegido ? [elegido] : this.modulosPermitidos();
    return [
      ...modulos.map(m => ({ id: `importar:${m}`, etiqueta: `Importar ${this.plural(m)}` })),
      ...modulos.map(m => ({
        id: `plantilla:${m}`,
        etiqueta: modulos.length === 1 ? 'Descargar la plantilla' : `Plantilla de ${this.plural(m)}`,
        deshabilitada: this.generandoPlantilla(), motivo: 'Se está generando',
      })),
    ];
  });

  constructor() {
    // El tipo sale de la dirección (`?tipo=luteria`): las rutas de antes y los enlaces del Inicio llegan así.
    this.ruta.queryParamMap.subscribe(p => {
      const t = p.get('tipo');
      this.tipo.set(t && t in MODULO_DE_LA_PESTANA ? t : 'todos');
    });
    effect(() => {
      if (this.enabled()) { this.modulosPermitidos(); this.cargar(); }
    });
  }

  elegirTipo(tipo: string): void {
    this.tipo.set(tipo);
    void this.router.navigate([], {
      relativeTo: this.ruta, queryParams: { tipo: tipo === 'todos' ? null : tipo }, queryParamsHandling: 'merge', replaceUrl: true,
    });
  }

  /** Pide los tres tipos con los mismos filtros: así cada pestaña lleva su conteo y cambiar de pestaña no espera. */
  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    const filtros = {
      q: this.busqueda().trim() || undefined,
      estado: this.estado() === 'todos' ? undefined : this.estado(),
      responsable: this.responsable() || undefined,
      sedeDepartamento: this.sedeDepartamento() || undefined,
      sedeMunicipio: this.sedeMunicipio() || undefined,
      sedePendiente: this.sedePendiente() || undefined,
    };
    const modulos = this.modulosPermitidos();
    const fallos: string[] = [];
    const peticiones = Object.fromEntries(modulos.map(m => [m, this.servicio.listar(m, filtros).pipe(
      catchError(fallo => { fallos.push((fallo as { message?: string })?.message ?? `No fue posible consultar ${PROCESOS_DE_LA_CONSOLA[m].modulo}.`); return of({ items: [], total: 0 }); }),
    )]));
    if (!modulos.length) { this.resultados.set({}); this.cargando.set(false); return; }
    forkJoin(peticiones).subscribe(r => {
      this.resultados.set(r);
      this.error.set(fallos[0] ?? '');
      this.cargando.set(false);
    });
  }

  rotuloDelTipo(f: FilaDeProcesoDeLaConsola): string {
    return PROCESOS_DE_LA_CONSOLA[f.tipo].rotulo;
  }

  /** La sede principal («Municipio, Departamento»); «Sede pendiente» mientras falte, con la cobertura de respaldo. */
  territorio(f: Pick<FilaDeProcesoDeLaConsola, 'sede' | 'nivelCobertura' | 'nombreMunicipio' | 'nombreDepartamento'>): string {
    const sede = [f.sede?.nombreMunicipio, f.sede?.nombreDepartamento].filter(Boolean).join(', ');
    if (sede) return sede;
    const cobertura = f.nivelCobertura === 'nacional'
      ? 'Todo el país'
      : [f.nombreMunicipio, f.nombreDepartamento].filter(Boolean).join(', ');
    return cobertura ? `Sede pendiente (cobertura: ${cobertura})` : 'Sede pendiente';
  }

  filtrarPorSede(sede: FiltroDeSede): void {
    this.sedeDepartamento.set(sede.departamento);
    this.sedeMunicipio.set(sede.municipio);
    this.sedePendiente.set(sede.pendiente);
    this.cargar();
  }

  private plural(m: TipoDeProceso): string {
    return m === 'talleres' ? 'talleres' : m === 'espacios' ? 'espacios' : 'redes';
  }

  elegirAccionDeLaLista(id: string): void {
    const [accion, modulo] = id.split(':') as [string, TipoDeProceso];
    if (accion === 'importar') { this.importar.emit(modulo); }
    if (accion === 'plantilla') { void this.descargarPlantilla(modulo); }
  }

  /** Las columnas son las que declara el servidor para el dominio del módulo (`DominioDeTalleres`, `…Espacios`, `…Redes`). */
  async descargarPlantilla(modulo: TipoDeProceso): Promise<void> {
    this.generandoPlantilla.set(true);
    try {
      await descargarPlantillaDeProceso(modulo, await firstValueFrom(this.servicio.catalogos(modulo)));
      this.aviso.set('Plantilla Excel descargada con listas y validaciones.');
    } catch {
      this.error.set('No fue posible generar la plantilla.');
    } finally {
      this.generandoPlantilla.set(false);
    }
  }
}
