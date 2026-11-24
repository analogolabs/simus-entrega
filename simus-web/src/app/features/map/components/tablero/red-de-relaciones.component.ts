import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import * as MapDomain from '../../domain/map-domain';
import { nombrePropio } from '../../../../shared/texto/nombre-propio';
import { RedDelEcosistema, RedDelEcosistemaService, TipoDeNodo } from '../../../../core/services/red-del-ecosistema.service';
import type { FiltrosDelAnalisis } from '../../domain/analisis-avanzado';
import { fichaDelIndicador } from '../../domain/indicadores-del-tablero';
import {
  COLOR_DE_NODO, ROTULO_DE_NODO, TIPOS_DE_NODO, VECINOS_POR_NODO, buscarNodos, enlaceDeLaFicha, filtrarRed,
  opcionRed, semillasDeLaRed, tablaDeVinculos, vinculosDe, vistaDeLaRed,
} from '../../domain/red-del-tablero';
import { clasesDeChip } from './clases-de-chip';
import { GraficoDelTableroComponent, MarcaElegida } from './grafico-del-tablero.component';
import { FilaDeDatos, PanelDeGraficoComponent } from './panel-de-grafico.component';

const PROCESO_DE_LA_CAPA: Readonly<Record<string, 'festival' | 'mercado'>> = { Festivales: 'festival', 'Mercados Musicales': 'mercado' };
const VINCULOS_EN_LA_FICHA = 12;

/**
 * La pestaña REDES: un grafo de relaciones REGISTRADAS que se recorre ampliando nodo por nodo (ego-red).
 *
 * <b>CÓMO SE LEE.</b> Se abre con los nodos más conectados ya ampliados. Pulsar un nodo lo elige, lo amplía
 * (muestra con quién y con qué se conecta) y abre su ficha; pulsar otro hace lo mismo con él, y los vecinos del
 * elegido se resaltan. Cada nodo ampliado muestra hasta ocho vecinos y un «Ver más» pide más.
 * <b>NO SE INVENTA NADA</b>: las líneas son las del servidor (sin personas, solo lo publicado). La alternativa
 * sin puntero es la lista de nodos a la vista y la tabla de todas las relaciones del ámbito.
 */
@Component({
  selector: 'app-red-de-relaciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, GraficoDelTableroComponent, PanelDeGraficoComponent],
  styles: [':host { display: block; min-width: 0; }'],
  template: `
    <div data-testid="tablero-red">
      @if (estado() === 'cargando') {
        <p class="rounded-md bg-slate-50 px-3 py-8 text-center text-dato font-bold text-rotulo" role="status">Cargando las relaciones registradas…</p>
      } @else if (estado() === 'fallo') {
        <p class="rounded-md bg-amber-50 px-3 py-4 text-dato text-amber-900" role="alert">
          No se pudieron leer las relaciones registradas.
          <button type="button" [class]="clasesDeChip(false)" class="ml-2" (click)="cargar()">Reintentar</button>
        </p>
      } @else {
        <app-panel-de-grafico idDelTitulo="av-red" [ficha]="ficha" [filtros]="textoDeFiltros()" pregunta="¿Quién se conecta con quién o con qué?"
          titulo="Relaciones registradas entre organizaciones, procesos, territorios y prácticas"
          lectura="Cada línea es una relación escrita en la base. Pulsa un nodo para ampliarlo y ver sus conexiones; pulsa otro para seguir el recorrido."
          [encabezados]="['Desde', 'Tipo', 'Relación', 'Hacia']" [filas]="filasDeLaTabla()">

          <div class="flex flex-wrap items-end gap-3">
            <div class="min-w-0 flex-1 basis-56">
              <label for="red-buscar" class="text-dato font-bold text-rotulo">Buscar un nodo</label>
              <input id="red-buscar" type="search" autocomplete="off" data-testid="red-buscar" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)"
                placeholder="Nombre de una organización, festival, territorio…"
                class="mt-1 block min-h-[var(--spacing-control,2.25rem)] w-full rounded-[var(--radius-control,0.5rem)] border border-slate-300 bg-white px-3 text-cuerpo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-foco)]" />
            </div>
            <button type="button" [class]="clasesDeChip(false)" data-testid="red-reiniciar" (click)="reiniciar()">Reiniciar</button>
          </div>
          @if (resultados().length > 0) {
            <ul class="mt-2 flex flex-wrap gap-1.5" aria-label="Nodos encontrados" data-testid="red-resultados">
              @for (nodo of resultados(); track nodo.id) {
                <li><button type="button" [class]="clasesDeChip(false)" (click)="ampliar(nodo.id)">{{ nodo.nombre }} <span class="font-normal text-slate-600">· {{ rotuloDeNodo[nodo.tipo] }}</span></button></li>
              }
            </ul>
          } @else if (busqueda().trim().length >= 2) {
            <p class="mt-2 text-dato text-slate-600">Ningún nodo se llama así en este ámbito.</p>
          }

          <div class="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipos de nodo que se muestran">
            <span class="text-dato font-bold text-rotulo">Mostrar</span>
            @for (tipo of tiposDeNodo; track tipo) {
              <button type="button" [class]="clasesDeChip(tiposElegidos().includes(tipo))" [attr.aria-pressed]="tiposElegidos().includes(tipo)" (click)="alternarTipo(tipo)">
                <span class="inline-block h-2 w-2 shrink-0 rounded-full" [style.background-color]="colorDeNodo[tipo]" aria-hidden="true"></span>
                {{ rotuloDeNodo[tipo] }}
              </button>
            }
          </div>

          @if (red().nodos.length === 0) {
            <p class="mt-4 rounded-md bg-slate-50 px-3 py-8 text-center text-dato font-bold text-rotulo" data-testid="red-vacia">
              {{ sinProcesosDeRed() ? 'La red registrada solo cubre festivales y mercados: elige alguno de esos tipos de proceso.' : 'Ninguna relación registrada con estos filtros' }}
            </p>
          } @else {
            <div class="@container mt-4"><div class="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_19rem]">
              <div class="min-w-0">
                <app-grafico-del-tablero class="h-[26rem] sm:h-[32rem]" [opcion]="opcion()" [explorable]="true"
                  descripcion="Red de relaciones registradas: {{ vista().red.nodos.length }} nodos a la vista; hay una lista de nodos y una tabla de relaciones equivalentes"
                  (elegida)="alElegir($event)">
                  <ul lienzo-leyenda class="flex flex-wrap gap-x-3 gap-y-0.5 rounded-md bg-white/90 px-2 py-1 text-dato text-slate-700" aria-label="Leyenda de tipos de nodo" data-testid="red-leyenda">
                    @for (tipo of tiposDeNodo; track tipo) {
                      <li class="inline-flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" [style.background-color]="colorDeNodo[tipo]" aria-hidden="true"></span>{{ rotuloDeNodo[tipo] }}</li>
                    }
                  </ul>
                  <div lienzo-ficha class="rounded-lg border border-morado/30 bg-white px-3 py-2 text-dato text-slate-700 shadow" data-testid="red-ficha-flotante">
                    @if (nodoElegido(); as nodo) {
                      <p class="font-bold text-rotulo">{{ rotuloDeNodo[nodo.tipo] }}@if (nodo.departamento) { · {{ nodo.departamento }} }</p>
                      <p class="font-alternate font-bold leading-snug text-morado">{{ nodo.nombre }}</p>
                      <p>{{ vinculosDelNodo().length }} {{ vinculosDelNodo().length === 1 ? 'relación registrada' : 'relaciones registradas' }}.</p>
                      @if (enlaceDeLaFicha(nodo); as ruta) {
                        <a [routerLink]="ruta" [class]="clasesDeChip(false)" class="mt-1.5">Ver su ficha pública</a>
                      }
                    } @else {
                      <p>Pulsa un nodo para ver su ficha aquí.</p>
                    }
                  </div>
                </app-grafico-del-tablero>
                <p class="mt-2 text-dato text-slate-600" aria-live="polite">
                  A la vista: {{ vista().red.nodos.length }} de {{ red().nodos.length }} nodos y {{ vista().red.aristas.length }} relaciones.
                  @if (vista().recortada) { Se llegó al tope de {{ tope }} nodos: contrae alguno para ver otros. }
                  @if (redCompleta().truncada) { El servidor recortó la red por su tamaño. }
                  <span class="block">Mueve la vista arrastrando; para acercar usa Ctrl + rueda o los botones +, −. Con el teclado: enfoca el lienzo y usa las flechas, + y −.</span>
                </p>
              </div>

              <aside class="min-w-0 self-start rounded-lg bg-morado/[0.05] px-3 py-3 text-dato text-slate-700" aria-label="Ficha del nodo elegido" data-testid="red-ficha">
                @if (nodoElegido(); as nodo) {
                  <p class="font-bold text-rotulo">{{ rotuloDeNodo[nodo.tipo] }}@if (nodo.departamento) { · {{ nodo.departamento }} }</p>
                  <h4 class="font-alternate text-base font-bold leading-snug text-morado">{{ nodo.nombre }}</h4>
                  <p class="mt-1">{{ vinculosDelNodo().length }} {{ vinculosDelNodo().length === 1 ? 'relación registrada' : 'relaciones registradas' }}.</p>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    @if (estaAmpliado(nodo.id)) {
                      <button type="button" [class]="clasesDeChip(false)" (click)="contraer(nodo.id)">Contraer</button>
                    } @else {
                      <button type="button" [class]="clasesDeChip(false)" (click)="ampliar(nodo.id)">Ampliar</button>
                    }
                    @if (vista().ocultos[nodo.id] > 0) {
                      <button type="button" [class]="clasesDeChip(false)" data-testid="red-ver-mas" (click)="verMas(nodo.id)">Ver más ({{ vista().ocultos[nodo.id] }})</button>
                    }
                    @if (enlaceDeLaFicha(nodo); as ruta) {
                      <a [routerLink]="ruta" [class]="clasesDeChip(false)" data-testid="red-ficha-publica">Ver su ficha pública</a>
                    }
                    @if (nodo.tipo === 'territorio') {
                      <button type="button" [class]="clasesDeChip(false)" (click)="alElegirFiltro()({ territorio: nodo.nombre })">Filtrar todo por este territorio</button>
                    } @else if (nodo.tipo === 'practica') {
                      <button type="button" [class]="clasesDeChip(false)" (click)="alElegirFiltro()({ practica: nodo.nombre })">Filtrar todo por esta práctica</button>
                    }
                  </div>
                  <h5 class="mt-3 font-bold text-rotulo">Se conecta con</h5>
                  <ul class="mt-1 space-y-1" data-testid="red-vinculos">
                    @for (vinculo of vinculosVisibles(); track vinculo.nodo.id + vinculo.relacion) {
                      <li>
                        <button type="button" class="cursor-pointer text-left no-underline hover:text-morado focus-visible:outline-2 focus-visible:outline-[var(--color-foco)]" (click)="ampliar(vinculo.nodo.id)">
                          <span class="text-slate-600">{{ vinculo.relacion }}</span>&ngsp;<strong>{{ vinculo.nodo.nombre }}</strong>&ngsp;<span class="text-slate-600">({{ rotuloDeNodo[vinculo.nodo.tipo].toLowerCase() }})</span>
                        </button>
                      </li>
                    }
                  </ul>
                  @if (vinculosDelNodo().length > vinculosVisibles().length) {
                    <button type="button" [class]="clasesDeChip(false)" class="mt-2" (click)="vinculosPedidos.set(vinculosPedidos() + vinculosEnLaFicha)">
                      Ver más conexiones ({{ vinculosDelNodo().length - vinculosVisibles().length }})
                    </button>
                  }
                } @else {
                  <p class="font-bold text-rotulo">Ficha del nodo</p>
                  <p class="mt-1">Pulsa un nodo del gráfico o de la lista para ver con quién y con qué se conecta.</p>
                }
              </aside>
            </div></div>

            <section class="mt-4" aria-labelledby="red-lista-titulo">
              <h4 id="red-lista-titulo" class="text-dato font-bold text-rotulo">Nodos a la vista ({{ vista().red.nodos.length }}), para recorrer con el teclado</h4>
              <ul class="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-auto" data-testid="red-lista">
                @for (nodo of vista().red.nodos; track nodo.id) {
                  <li>
                    <button type="button" [class]="clasesDeChip(nodo.id === seleccion())" [attr.aria-pressed]="nodo.id === seleccion()" (click)="ampliar(nodo.id)">
                      <span class="inline-block h-2 w-2 shrink-0 rounded-full" [style.background-color]="colorDeNodo[nodo.tipo]" aria-hidden="true"></span>
                      {{ nodo.nombre }}&ngsp;<span class="font-normal text-slate-600">· {{ rotuloDeNodo[nodo.tipo] }}</span>
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
        </app-panel-de-grafico>
      }
    </div>
  `,
})
export class RedDeRelacionesComponent {
  readonly filtros = input.required<FiltrosDelAnalisis>();
  readonly animar = input(true);
  /** Para los nodos que son un filtro del tablero (territorio, práctica): escribe en los filtros compartidos. */
  readonly alElegirFiltro = input<(cambio: Partial<FiltrosDelAnalisis>) => void>(() => undefined);

  protected readonly clasesDeChip = clasesDeChip;
  protected readonly ficha = fichaDelIndicador('avanzado-red');
  protected readonly rotuloDeNodo = ROTULO_DE_NODO;
  protected readonly colorDeNodo = COLOR_DE_NODO;
  protected readonly tiposDeNodo = TIPOS_DE_NODO;
  protected readonly vinculosEnLaFicha = VINCULOS_EN_LA_FICHA;
  protected readonly tope = 120;
  protected readonly enlaceDeLaFicha = enlaceDeLaFicha;

  private readonly servicio = inject(RedDelEcosistemaService);
  private readonly destruccion = inject(DestroyRef);
  readonly estado = signal<'cargando' | 'listo' | 'fallo'>('cargando');
  protected readonly redCompleta = signal<RedDelEcosistema>({ nodos: [], aristas: [], truncada: false });

  readonly busqueda = signal('');
  readonly seleccion = signal('');
  readonly tiposElegidos = signal<readonly TipoDeNodo[]>([]);
  /** `null` = los de apertura (los más conectados); en cuanto se pulsa un nodo, la lista propia. */
  private readonly ampliados = signal<readonly string[] | null>(null);
  private readonly extra = signal<Readonly<Record<string, number>>>({});
  protected readonly vinculosPedidos = signal(VINCULOS_EN_LA_FICHA);

  private readonly normalizar = (nombre: string): string => nombrePropio(MapDomain.getDepartmentDisplayName(nombre));

  /** Si los tipos de proceso elegidos no incluyen ni festivales ni mercados, esta red no tiene qué mostrar. */
  protected readonly sinProcesosDeRed = computed(() => {
    const tipos = this.filtros().tipos;
    return tipos.length > 0 && !tipos.some((tipo) => tipo in PROCESO_DE_LA_CAPA);
  });
  protected readonly red = computed(() => {
    const f = this.filtros();
    if (this.sinProcesosDeRed()) return { nodos: [], aristas: [], truncada: false } as RedDelEcosistema;
    const procesos = f.tipos.length === 0 ? null : f.tipos.filter((tipo) => tipo in PROCESO_DE_LA_CAPA).map((tipo) => PROCESO_DE_LA_CAPA[tipo]);
    return filtrarRed(this.redCompleta(), {
      departamento: f.departamento, procesos, territorio: f.territorio, practica: f.practica, tiposDeNodo: this.tiposElegidos(),
    }, this.normalizar);
  });
  private readonly semillas = computed(() => semillasDeLaRed(this.red()));
  protected readonly expandidos = computed(() => this.ampliados() ?? this.semillas());
  protected readonly vista = computed(() => vistaDeLaRed(this.red(), { expandidos: this.expandidos(), extra: this.extra() }));
  protected readonly opcion = computed(() => opcionRed(this.vista().red, {
    seleccion: this.seleccion() || undefined, animar: this.animar(), expandidos: this.expandidos(),
  }));
  protected readonly resultados = computed(() => buscarNodos(this.red(), this.busqueda()));
  protected readonly nodoElegido = computed(() => this.red().nodos.find((n) => n.id === this.seleccion()) ?? null);
  protected readonly vinculosDelNodo = computed(() => (this.seleccion() ? vinculosDe(this.red(), this.seleccion()) : []));
  protected readonly vinculosVisibles = computed(() => this.vinculosDelNodo().slice(0, this.vinculosPedidos()));
  protected readonly filasDeLaTabla = computed<FilaDeDatos[]>(() => tablaDeVinculos(this.red()).map((fila) => ({ clave: fila.clave, celdas: fila.celdas })));
  protected readonly textoDeFiltros = computed(() => {
    const f = this.filtros();
    return [
      ...(f.tipos.length > 0 ? [`Tipo: ${f.tipos.join(', ')}`] : []),
      ...(f.departamento ? [`Departamento: ${f.departamento}`] : []),
      ...(f.practica ? [`Práctica: ${f.practica}`] : []),
      ...(f.territorio ? [`Territorio sonoro: ${f.territorio}`] : []),
      ...(this.tiposElegidos().length > 0 ? [`Nodos: ${this.tiposElegidos().map((t) => ROTULO_DE_NODO[t]).join(', ')}`] : []),
    ];
  });

  constructor() {
    this.cargar();
    // Cambiar el ámbito (filtros compartidos o tipos de nodo) empieza el recorrido de nuevo: lo ampliado antes puede ya no existir.
    effect(() => {
      this.red();
      untracked(() => {
        this.ampliados.set(null);
        this.extra.set({});
        if (!this.red().nodos.some((n) => n.id === this.seleccion())) this.seleccion.set('');
      });
    });
  }

  cargar(): void {
    this.estado.set('cargando');
    this.servicio.consultar().pipe(takeUntilDestroyed(this.destruccion)).subscribe({
      next: (red) => { this.redCompleta.set(red); this.estado.set('listo'); },
      error: () => this.estado.set('fallo'),
    });
  }

  estaAmpliado(id: string): boolean { return this.expandidos().includes(id); }

  /** Elige el nodo y lo amplía: se ven sus conexiones y su ficha. */
  ampliar(id: string): void {
    if (!this.red().nodos.some((n) => n.id === id)) return;
    this.seleccion.set(id);
    this.vinculosPedidos.set(VINCULOS_EN_LA_FICHA);
    if (!this.estaAmpliado(id)) this.ampliados.set([...this.expandidos(), id]);
  }
  contraer(id: string): void {
    this.ampliados.set(this.expandidos().filter((otro) => otro !== id));
  }
  verMas(id: string): void {
    this.extra.update((actual) => ({ ...actual, [id]: (actual[id] ?? 0) + VECINOS_POR_NODO }));
  }
  alternarTipo(tipo: TipoDeNodo): void {
    this.tiposElegidos.update((actual) => (actual.includes(tipo) ? actual.filter((t) => t !== tipo) : [...actual, tipo]));
  }
  reiniciar(): void {
    this.ampliados.set(null);
    this.extra.set({});
    this.seleccion.set('');
    this.busqueda.set('');
    this.tiposElegidos.set([]);
  }
  alElegir(marca: MarcaElegida): void {
    if (marca.id) this.ampliar(marca.id);
  }
}
