import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';

import { Franja, claveDeDia, horaDeLaFranja, rotuloDeJornada } from '../../../core/services/agendamiento-de-citas.service';
import { SelectorSegmentadoComponent } from '../ui/selector-segmentado/selector-segmentado.component';
import { AvatarDePersonaComponent } from './avatar-de-persona.component';
import { EstadoDeFranja, ETIQUETA_DEL_ESTADO_DE_FRANJA } from './calendario-de-agenda.component';

/** Una persona con su mesa o stand: una FILA de la parrilla. */
export interface FilaDeParrilla {
  id: number;
  nombre: string;
  entidad: string | null;
  fotoUrl?: string | null;
  /** La mesa o la sala que le asignó la organización. */
  espacio?: string | null;
}

/** Lo que hay en una celda (persona × franja). */
export interface CeldaDeParrilla {
  estado: EstadoDeFranja;
  /** Con quién (el artista), si hay cita. */
  texto?: string;
  /** La persona de la cita tiene otra cita viva en la misma franja: el cruce se señala. */
  conflicto?: boolean;
}

/**
 * La PARRILLA de la agenda (docs/referencia/26-agenda-de-citas-y-mercados.md §26.15): una matriz con las personas que reciben (con su mesa o stand) como FILAS y las franjas como COLUMNAS,
 * para ver de un vistazo quién está libre, quién tiene la agenda llena y qué franjas no tienen nada. Es la parrilla de horarios de un festival.
 *
 * <b>CADA CELDA DICE SU ESTADO CON PALABRAS</b> (libre, esperando respuesta, confirmada, rechazada…), una marca de forma y un fondo suave. Los
 * huecos libres se piden con un «+» clicable; la franja de «Ahora» (o la próxima) se marca en la cabecera; un cruce de la misma persona en dos
 * mesas a la vez se señala con «Cruce». Cada fila lleva la cara de la persona, su organización, su mesa y una barra de ocupación.
 * Las cabeceras y la primera columna quedan fijas al desplazarse. Teclado: una sola celda en la tabulación; flechas, Inicio y Fin.
 *
 * <b>EN EL MÓVIL (≤ 640 px)</b> la matriz se vuelve una lista por mesa: cada persona con sus franjas del día como botones, sin desplazamiento horizontal.
 */
@Component({
  selector: 'app-parrilla-de-agenda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarDePersonaComponent, SelectorSegmentadoComponent],
  styles: [`
    :host { display: block; }
    .parrilla { position: relative; max-height: max(24rem, calc(100dvh - 15rem)); overflow: auto; border-radius: .9rem; background: #fff; box-shadow: 0 1px 2px rgb(46 25 51 / .1), 0 6px 18px rgb(46 25 51 / .06); }
    table { border-collapse: separate; border-spacing: 0; min-width: 100%; }
    thead th { position: sticky; top: 0; z-index: 3; background: #fff; border-bottom: 1px solid var(--color-filete); padding: .5rem .35rem; text-align: center; min-width: 6.5rem; font-size: var(--text-dato); font-weight: 700; color: var(--color-valor); }
    thead tr.dias th { top: 0; background: var(--color-morado-50); color: var(--color-morado); text-align: left; padding: .3rem .6rem; border-bottom: 0; }
    thead tr.horas th { top: 1.9rem; }
    thead th.esquina, tbody th { position: sticky; left: 0; z-index: 2; background: #fff; min-width: 14rem; text-align: left; }
    thead th.esquina { z-index: 4; }
    thead th.ahora { background: var(--color-morado); color: #fff; }
    thead th small { display: block; font-weight: 600; color: inherit; opacity: .85; }
    tbody th { padding: .45rem .6rem; border-bottom: 1px solid var(--color-filete); font-weight: 400; vertical-align: middle; }
    td { padding: .25rem; border-bottom: 1px solid var(--color-filete); min-width: 6.5rem; }
    tbody tr:hover th, tbody tr:hover td { background: var(--color-morado-50); }
    .celda { display: block; width: 100%; min-height: 3.25rem; border: 1px solid transparent; border-radius: .55rem; padding: .25rem .45rem; text-align: left; font: inherit; font-size: var(--text-dato); line-height: 1.2; cursor: pointer; color: var(--color-valor); transition: transform var(--dur-rapida), box-shadow var(--dur-rapida); }
    .celda:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgb(46 25 51 / .15); }
    .celda:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 1px; }
    .celda[aria-pressed='true'] { box-shadow: 0 0 0 2px var(--color-morado); }
    .celda strong { display: block; }
    .glifo { display: inline-block; width: 1.1em; font-weight: 700; }
    .celda.atenuada { opacity: .3; }
    .celda.libre-pedible { text-align: center; border-style: dashed; }
    .celda.cruce { box-shadow: inset 0 0 0 2px var(--color-peligro); }
    .cruce-aviso { display: block; font-weight: 800; color: var(--color-peligro); }
    .p-libre { background: #f3faf6; border-color: #b9e6d0; color: #2c6f4f; }
    .p-solicitada { background: #fff2cf; border-color: #f0d58a; }
    .p-confirmada { background: #dff3e8; border-color: #8fd1b0; }
    .p-rechazada { background: #fde9e9; border-color: #f2b5b5; }
    .p-cancelada, .p-vencida { background: #f1f5f9; border-color: #d6dde6; color: #475569; }
    .p-ocupada { background: #eceff3; border-color: #d6dde6; color: #475569; }
    .p-disponible { background: #f3faf6; border-color: #b9e6d0; }
    .barra { height: .35rem; border-radius: 9999px; background: var(--color-morado-100); overflow: hidden; margin-top: .3rem; }
    .barra > span { display: block; height: 100%; background: #2e9d6a; }
    .barra.llena > span { background: #b45309; }
    .completo { margin-left: .4rem; font-size: var(--text-dato); font-weight: 800; color: #7a3a05; }
    .sin-nada { display: block; font-weight: 400; opacity: .8; }
    .leyenda span.marca { display: inline-block; width: .8rem; height: .8rem; border-radius: 3px; border-width: 1px; border-style: solid; margin-right: .35rem; vertical-align: -1px; }
    /* Móvil: una lista por mesa, con las franjas del día como botones. */
    .lista { display: flex; flex-direction: column; gap: .75rem; }
    .lista__mesa { padding: .85rem; border-radius: .9rem; background: #fff; box-shadow: 0 1px 2px rgb(46 25 51 / .1), 0 4px 12px rgb(46 25 51 / .05); }
    .lista__franjas { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.25rem, 1fr)); gap: .4rem; margin-top: .6rem; }
    .lista__franjas .celda { min-height: 3rem; }
    .lista__dia { margin: .6rem 0 0; font-size: var(--text-dato); font-weight: 800; color: var(--color-morado); }
    /* Tableta y ventana angosta: la columna de la persona deja ancho a las franjas (con 14 rem solo se veían dos). */
    @media (max-width: 70rem) { thead th.esquina, tbody th { min-width: 11rem; } }
    @media print { .parrilla { max-height: none; overflow: visible; } }
    @media (prefers-reduced-motion: reduce) { .celda { transition: none; } .celda:hover { transform: none; } }
  `],
  template: `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <app-selector-segmentado forma="segmentado" [comodo]="true" [conFilete]="false" [opciones]="opcionesDeDia()" [elegida]="dia()"
          etiquetaDelGrupo="Día de la parrilla" (elegir)="dia.set($event)" />
        @if (personas().length && visibles().length) {
          <ul class="leyenda flex flex-wrap gap-x-4 gap-y-1 text-dato text-prosa" aria-label="Leyenda de la parrilla" data-testid="parrilla-leyenda">
            @for (e of leyenda; track e.id) {
              <li><span class="marca" [class]="'marca p-' + e.id"></span>{{ e.texto }}<span class="sr-only">:</span>
                <strong class="font-semibold text-valor" [attr.data-testid]="'total-' + e.id"> {{ total(e.id) }}</strong></li>
            }
            <li data-testid="total-cruces" [attr.title]="'Cruce: la misma persona con dos citas a la vez en distintas mesas'">
              <span class="marca" [style.border-color]="cruces() > 0 ? 'var(--color-peligro)' : 'var(--color-filete)'" [style.box-shadow]="cruces() > 0 ? 'inset 0 0 0 2px var(--color-peligro)' : 'none'"></span>Cruces<span class="sr-only">:</span>
              <strong class="font-semibold" [style.color]="cruces() > 0 ? 'var(--color-peligro)' : null" data-testid="cantidad-de-cruces"> {{ cruces() === 0 ? 'ninguno' : cruces() }}</strong>
            </li>
          </ul>
        }
      </div>

      @if (!personas().length) {
        <ng-content select="[sin-columnas]" />
      } @else if (!visibles().length) {
        <p class="text-cuerpo text-prosa">No hay franjas ese día.</p>
      } @else if (angosto()) {
        <div class="lista" data-testid="parrilla">
          @for (p of personas(); track p.id) {
            <section class="lista__mesa" [attr.data-persona]="p.id">
              <div class="flex items-center gap-2">
                <app-avatar-de-persona [nombre]="p.nombre" [fotoUrl]="p.fotoUrl ?? null" [medida]="2.5" />
                <div class="min-w-0">
                  <p class="truncate text-cuerpo font-semibold text-valor">{{ p.nombre }}</p>
                  <p class="truncate text-dato text-prosa">@if (p.espacio) { {{ p.espacio }} · } {{ p.entidad }}</p>
                </div>
              </div>
              <p class="mt-1 text-dato text-prosa" [attr.data-testid]="'ocupacion-' + p.id">{{ ocupadas(p.id) }} de {{ franjas().length }} franjas ocupadas@if (libres(p.id) === 0) { <span class="completo">Completo</span> }</p>
              <div class="barra" [class.llena]="libres(p.id) === 0" aria-hidden="true"><span [style.width.%]="porcentaje(p.id)"></span></div>
              <div class="lista__franjas">
                @for (f of visibles(); track f.id; let j = $index) {
                  <button type="button" class="celda" [class]="clase(p.id, f.id)" [class.atenuada]="atenuada(p.id, f.id)"
                          [attr.data-celda]="p.id + '-' + f.id" [attr.data-estado]="celdaDe(p.id, f.id).estado"
                          [attr.aria-label]="nombreAccesible(p, f)" [attr.aria-pressed]="esLaElegida(p.id, f.id)"
                          (click)="elegir.emit({ columnaId: p.id, franjaId: f.id })">
                    <strong>{{ hora(f) }}</strong>
                    <span><span class="glifo" aria-hidden="true">{{ glifo(celdaDe(p.id, f.id).estado) }}</span>{{ etiqueta(celdaDe(p.id, f.id).estado) }}</span>
                    @if (celdaDe(p.id, f.id).texto) { <span class="block truncate" [attr.title]="celdaDe(p.id, f.id).texto">{{ celdaDe(p.id, f.id).texto }}</span> }
                  </button>
                }
              </div>
            </section>
          }
        </div>
      } @else {
        <div class="parrilla" data-testid="parrilla" tabindex="-1">
          <table role="grid" [attr.aria-label]="'Parrilla de la agenda: personas con su mesa en filas y franjas en columnas'">
            <thead>
              @if (grupos().length > 1) {
                <tr class="dias">
                  <th class="esquina" scope="col" rowspan="2"><span class="sr-only">Mesa o persona</span></th>
                  @for (g of grupos(); track g.clave) { <th scope="colgroup" [attr.colspan]="g.franjas.length">{{ g.rotulo }}</th> }
                </tr>
              }
              <tr class="horas">
                @if (grupos().length <= 1) { <th scope="col" class="esquina"><span class="sr-only">Mesa o persona</span></th> }
                @for (f of visibles(); track f.id) {
                  <th scope="col" [class.ahora]="f.id === franjaDeAhora()" [attr.data-franja]="f.id">
                    {{ hora(f) }}
                    @if (f.id === franjaDeAhora()) { <small>{{ ahoraEsDentro() ? 'Ahora' : 'Próxima' }}</small> }
                    @if (franjaVacia(f.id)) { <small class="sin-nada">Sin citas</small> }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (p of personas(); track p.id; let i = $index) {
                <tr>
                  <th scope="row" [attr.data-columna]="p.id" [attr.data-persona]="p.id">
                    <span class="flex items-center gap-2">
                      <span class="foto"><app-avatar-de-persona [nombre]="p.nombre" [fotoUrl]="p.fotoUrl ?? null" [medida]="2.5" /></span>
                      <span class="min-w-0">
                        <span class="block truncate text-cuerpo font-semibold text-valor" [attr.title]="p.nombre">{{ p.nombre }}</span>
                        @if (p.entidad) { <span class="entidad block truncate text-dato text-prosa" [attr.title]="p.entidad">{{ p.entidad }}</span> }
                        @if (p.espacio) { <span class="block truncate text-dato font-semibold text-valor">Mesa o sala: {{ p.espacio }}</span> }
                      </span>
                    </span>
                    <span class="mt-1 block text-dato text-prosa" [attr.data-testid]="'ocupacion-' + p.id">
                      {{ ocupadas(p.id) }} de {{ franjas().length }} franjas ocupadas
                      @if (libres(p.id) === 0) { <span class="completo">Completo</span> }
                    </span>
                    <span class="barra" [class.llena]="libres(p.id) === 0" aria-hidden="true"><span [style.width.%]="porcentaje(p.id)"></span></span>
                  </th>
                  @for (f of visibles(); track f.id; let j = $index) {
                    <td role="gridcell">
                      <button type="button" class="celda" [class]="clase(p.id, f.id)" [class.atenuada]="atenuada(p.id, f.id)"
                              [attr.data-celda]="p.id + '-' + f.id" [attr.data-estado]="celdaDe(p.id, f.id).estado"
                              [attr.aria-label]="nombreAccesible(p, f)" [attr.aria-pressed]="esLaElegida(p.id, f.id)"
                              [attr.tabindex]="esLaActiva(i, j) ? 0 : -1" [attr.data-fila]="i" [attr.data-col]="j"
                              (keydown)="alTeclear($event, i, j)" (focus)="activa.set(i + ',' + j)" (click)="elegir.emit({ columnaId: p.id, franjaId: f.id })">
                        @if (celdaDe(p.id, f.id).estado === 'libre') {
                          <strong><span class="glifo" aria-hidden="true">+</span>Libre</strong>
                        } @else {
                          <strong><span class="glifo" aria-hidden="true">{{ glifo(celdaDe(p.id, f.id).estado) }}</span>{{ etiqueta(celdaDe(p.id, f.id).estado) }}</strong>
                        }
                        @if (celdaDe(p.id, f.id).texto) { <span class="block truncate" [attr.title]="celdaDe(p.id, f.id).texto">{{ celdaDe(p.id, f.id).texto }}</span> }
                        @if (celdaDe(p.id, f.id).conflicto) { <span class="cruce-aviso">Cruce de horario</span> }
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ParrillaDeAgendaComponent {
  readonly personas = input.required<readonly FilaDeParrilla[]>();
  readonly franjas = input.required<readonly Franja[]>();
  /** Clave `personaId-franjaId`. Lo que no esté, es libre. */
  readonly celdas = input.required<ReadonlyMap<string, CeldaDeParrilla>>();
  /** Si se da, las celdas de otro estado se atenúan. */
  readonly resaltar = input<EstadoDeFranja | null>(null);
  readonly seleccionada = input<{ columnaId: number; franjaId: number } | null>(null);
  /** El instante que se toma por «ahora» (por omisión, el reloj). */
  readonly ahora = input<Date | null>(null);
  readonly elegir = output<{ columnaId: number; franjaId: number }>();

  protected readonly dia = signal('todos');
  protected readonly activa = signal('0,0');
  protected readonly angosto = signal(false);
  protected readonly leyenda = [
    { id: 'libre', texto: 'Libre' }, { id: 'solicitada', texto: 'Esperando respuesta' }, { id: 'confirmada', texto: 'Confirmada' },
    { id: 'rechazada', texto: 'Rechazada' }, { id: 'cancelada', texto: 'Cancelada o vencida' },
  ];

  protected readonly jornadas = computed(() => {
    const m = new Map<string, string>();
    for (const f of this.franjas()) {
      const k = claveDeDia(f.inicioUtc);
      if (!m.has(k)) m.set(k, rotuloDeJornada(f.inicioUtc));
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([clave, rotulo]) => ({ clave, rotulo: rotulo.replace(/^./, c => c.toUpperCase()), corto: rotulo.replace(/^(\S+?),?\s+(\d+)\s+de\s+\S+.*$/, '$1 $2').replace(/^./, c => c.toUpperCase()) }));
  });

  protected readonly visibles = computed(() => [...this.franjas()]
    .filter(f => this.dia() === 'todos' || claveDeDia(f.inicioUtc) === this.dia())
    .sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc)));

  /** Las franjas visibles agrupadas por día: la cabecera de dos niveles. */
  protected readonly grupos = computed(() => {
    const grupos: { clave: string; rotulo: string; franjas: Franja[] }[] = [];
    for (const f of this.visibles()) {
      const clave = claveDeDia(f.inicioUtc);
      let g = grupos[grupos.length - 1];
      if (!g || g.clave !== clave) { g = { clave, rotulo: rotuloDeJornada(f.inicioUtc).replace(/^./, c => c.toUpperCase()), franjas: [] }; grupos.push(g); }
      g.franjas.push(f);
    }
    return grupos;
  });

  /** La franja que está sucediendo o, si ninguna, la próxima del día de hoy. */
  protected readonly franjaDeAhora = computed<number | null>(() => {
    const t = (this.ahora() ?? new Date()).getTime();
    const f = this.visibles().find(x => Date.parse(x.finUtc) > t && claveDeDia(x.inicioUtc) === claveDeDia(new Date(t).toISOString()));
    return f?.id ?? null;
  });
  protected readonly ahoraEsDentro = computed(() => {
    const t = (this.ahora() ?? new Date()).getTime();
    const f = this.visibles().find(x => x.id === this.franjaDeAhora());
    return !!f && Date.parse(f.inicioUtc) <= t;
  });
  protected readonly cruces = computed(() => {
    let n = 0;
    for (const f of this.visibles()) for (const p of this.personas()) if (this.celdaDe(p.id, f.id).conflicto) n++;
    return n;
  });

  constructor() {
    effect(() => { this.dia(); this.activa.set('0,0'); });
    if (typeof window !== 'undefined' && window.matchMedia) {
      const consulta = window.matchMedia('(max-width: 639.98px)');
      this.angosto.set(consulta.matches);
      const alCambiar = (e: MediaQueryListEvent): void => this.angosto.set(e.matches);
      consulta.addEventListener('change', alCambiar);
      inject(DestroyRef).onDestroy(() => consulta.removeEventListener('change', alCambiar));
    }
  }

  /** Una franja en la que nadie tiene nada: se dice en la cabecera. */
  protected franjaVacia(franjaId: number): boolean { return this.personas().every(p => this.celdaDe(p.id, franjaId).estado === 'libre'); }
  protected hora(f: Franja): string { return horaDeLaFranja(f.inicioUtc); }
  protected celdaDe(personaId: number, franjaId: number): CeldaDeParrilla {
    return this.celdas().get(`${personaId}-${franjaId}`) ?? { estado: 'libre' };
  }
  protected clase(personaId: number, franjaId: number): string {
    const c = this.celdaDe(personaId, franjaId);
    return `celda p-${c.estado}${c.estado === 'libre' ? ' libre-pedible' : ''}${c.conflicto ? ' cruce' : ''}`;
  }
  protected etiqueta(e: EstadoDeFranja): string { return ETIQUETA_DEL_ESTADO_DE_FRANJA[e]; }
  /** Una marca de forma por estado: el color no es la única señal (WCAG 1.4.1). */
  protected glifo(e: EstadoDeFranja): string {
    return ({ libre: '+', solicitada: '◔', confirmada: '✓', rechazada: '✕', cancelada: '–', vencida: '–', ocupada: '●', disponible: '○' } as Record<string, string>)[e] ?? '';
  }
  protected readonly opcionesDeDia = computed(() => [{ id: 'todos', etiqueta: 'Todos los días' }, ...this.jornadas().map(j => ({ id: j.clave, etiqueta: j.corto }))]);
  /** Cuántas celdas hay de cada estado en lo que se ve (con el día y las personas elegidas). */
  protected total(id: string): number {
    let n = 0;
    for (const f of this.visibles()) for (const p of this.personas()) {
      const e = this.celdaDe(p.id, f.id).estado;
      if (e === id || (id === 'cancelada' && e === 'vencida')) n++;
    }
    return n;
  }
  protected ocupadas(personaId: number): number {
    return this.franjas().filter(f => ['solicitada', 'confirmada'].includes(this.celdaDe(personaId, f.id).estado)).length;
  }
  protected libres(personaId: number): number { return this.franjas().length - this.ocupadas(personaId); }
  protected porcentaje(personaId: number): number {
    const n = this.franjas().length;
    return n ? Math.round(this.ocupadas(personaId) * 100 / n) : 0;
  }
  protected atenuada(personaId: number, franjaId: number): boolean {
    const r = this.resaltar();
    return !!r && this.celdaDe(personaId, franjaId).estado !== r;
  }
  protected esLaElegida(personaId: number, franjaId: number): boolean {
    const s = this.seleccionada();
    return !!s && s.columnaId === personaId && s.franjaId === franjaId;
  }
  /** Empieza por lo que se ve en la celda (WCAG 2.5.3) y sigue con quién y cuándo. */
  protected nombreAccesible(p: FilaDeParrilla, f: Franja): string {
    const celda = this.celdaDe(p.id, f.id);
    const visible = [this.etiqueta(celda.estado), celda.texto, celda.conflicto ? 'cruce de horario' : ''].filter(Boolean).join(' ');
    return `${visible}. ${p.nombre}, ${rotuloDeJornada(f.inicioUtc)}, ${horaDeLaFranja(f.inicioUtc)}`;
  }
  protected esLaActiva(i: number, j: number): boolean {
    const [ai, aj] = this.activa().split(',').map(Number);
    const hay = ai < this.personas().length && aj < this.visibles().length;
    return hay ? ai === i && aj === j : i === 0 && j === 0;
  }
  protected alTeclear(e: KeyboardEvent, i: number, j: number): void {
    const filas = this.personas().length, cols = this.visibles().length;
    let ni = i, nj = j;
    switch (e.key) {
      case 'ArrowRight': nj = Math.min(cols - 1, j + 1); break;
      case 'ArrowLeft': nj = Math.max(0, j - 1); break;
      case 'ArrowDown': ni = Math.min(filas - 1, i + 1); break;
      case 'ArrowUp': ni = Math.max(0, i - 1); break;
      case 'Home': nj = 0; break;
      case 'End': nj = cols - 1; break;
      default: return;
    }
    e.preventDefault();
    const tabla = (e.currentTarget as HTMLElement).closest('table')!;
    const destino = tabla.querySelector<HTMLButtonElement>(`button[data-fila="${ni}"][data-col="${nj}"]`);
    if (destino) { this.activa.set(`${ni},${nj}`); destino.focus(); }
  }
}
