import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { Franja, claveDeDia, horaDeLaFranja, rotuloDeJornada } from '../../../core/services/agendamiento-de-citas.service';
import { BotonNativoDirective } from '../ui/boton/boton.component';
import { OpcionSegmentada, SelectorSegmentadoComponent } from '../ui/selector-segmentado/selector-segmentado.component';

/** Cómo se ve una franja en el calendario. Cada estado lleva SU TEXTO: el color solo refuerza. */
export type EstadoDeFranja = 'libre' | 'disponible' | 'solicitada' | 'confirmada' | 'rechazada' | 'cancelada' | 'vencida' | 'ocupada';

/** Lo que el calendario dibuja dentro de una franja. */
export interface CeldaDeFranja {
  franjaId: number;
  estado: EstadoDeFranja;
  /** Líneas de texto de la celda (con quién, cuántas). */
  lineas: readonly string[];
  /** Lo que lee un lector de pantalla al llegar a la celda; incluye el día y la hora. */
  etiqueta: string;
  /** La celda se puede pulsar: elegirla emite `elegir`. */
  accionable: boolean;
}

export const ETIQUETA_DEL_ESTADO_DE_FRANJA: Readonly<Record<EstadoDeFranja, string>> = {
  libre: 'Libre', disponible: 'Disponible para pedir', solicitada: 'Esperando respuesta', confirmada: 'Confirmada',
  rechazada: 'Rechazada', cancelada: 'Cancelada', vencida: 'Vencida', ocupada: 'Ocupada',
};

const MS_DIA = 86_400_000;
const aFecha = (clave: string): number => Date.parse(`${clave}T12:00:00Z`);
const aClave = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const FORMATO_DIA = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const FORMATO_DIA_LARGO = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });

/**
 * El calendario de la agenda de citas, en vista de SEMANA o de DÍA (docs/referencia/26-agenda-de-citas-y-mercados.md §26.15).
 *
 * <b>UNA SOLA PIEZA PARA LOS DOS LADOS.</b> La organización ve cada franja con cuántas citas tiene; la persona
 * que participa ve las suyas y las franjas libres donde puede pedir. Quien lo usa decide qué dice cada celda
 * (`celdas`); el calendario pone el eje de tiempo, la navegación, la leyenda y el teclado.
 *
 * <b>TECLADO.</b> Es una cuadrícula (`role="grid"`): una sola celda entra en el orden de tabulación; con las
 * flechas se mueve por día y por hora, con Inicio y Fin va a los extremos de la fila, y Enter o espacio elige.
 * Todas las celdas tienen nombre accesible con día, hora y estado.
 *
 * <b>NO SE LEE SOLO POR COLOR.</b> Cada estado tiene su palabra dentro de la celda y su entrada en la leyenda.
 */
@Component({
  selector: 'app-calendario-de-agenda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BotonNativoDirective, SelectorSegmentadoComponent],
  styles: [`
    :host { display: block; }
    .cal__tabla { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
    .cal__tabla th, .cal__tabla td { border-bottom: 1px solid var(--color-filete); padding: .25rem; vertical-align: top; }
    .cal__dia { font-size: var(--text-cuerpo); font-weight: 700; color: var(--color-valor); text-align: left; }
    .cal__dia::first-letter { text-transform: uppercase; }
    .cal__hora { width: 4.5rem; font-size: var(--text-dato); font-weight: 600; color: var(--color-rotulo); text-align: right; padding-right: .5rem; }
    .cal__celda { display: block; width: 100%; min-height: 3.25rem; border: 1px solid var(--color-filete); border-radius: .5rem; background: #fff; padding: .3rem .5rem; text-align: left; font: inherit; font-size: var(--text-dato); line-height: 1.25; color: var(--color-valor); }
    button.cal__celda { cursor: pointer; }
    button.cal__celda:hover { background: #f6f3fb; }
    .cal__celda:focus-visible { outline: var(--anillo-foco-ancho) solid var(--color-foco); outline-offset: 1px; }
    .cal__celda[aria-pressed='true'] { box-shadow: 0 0 0 2px var(--color-morado); }
    .cal__celda strong { display: block; font-size: var(--text-dato); }
    .cal__vacia { min-height: 3.25rem; }
    .e-libre { border-color: #cbd5e1; }
    .e-disponible { border-color: #0f766e; background: #f0fdfa; }
    .e-solicitada { border-color: #b45309; background: #fffbeb; }
    .e-confirmada { border-color: #15803d; background: #f0fdf4; }
    .e-rechazada { border-color: #b91c1c; background: #fef2f2; }
    .e-cancelada, .e-vencida { border-color: #64748b; background: #f8fafc; color: #475569; }
    .e-ocupada { border-color: #64748b; background: #f1f5f9; color: #475569; }
    .cal__marca { display: inline-block; width: .75rem; height: .75rem; border-radius: 2px; border: 1px solid var(--color-filete); vertical-align: -1px; margin-right: .35rem; }
    @media print { .cal__navegacion, .cal__leyenda { display: none; } .cal__celda { break-inside: avoid; } }
  `],
  template: `
    <div class="space-y-3">
      <div class="cal__navegacion flex flex-wrap items-center gap-3">
        <app-selector-segmentado [opciones]="vistas" [elegida]="vista()" etiquetaDelGrupo="Vista del calendario"
          forma="segmentado" [conFilete]="false" (elegir)="vista.set($any($event))" />
        <div class="flex items-center gap-2">
          <button type="button" appBoton="secundaria" tamano="menudo" data-testid="calendario-anterior" (click)="mover(-1)">
            <span aria-hidden="true">←</span> {{ vista() === 'semana' ? 'Semana anterior' : 'Día anterior' }}</button>
          <button type="button" appBoton="secundaria" tamano="menudo" data-testid="calendario-siguiente" (click)="mover(1)">
            {{ vista() === 'semana' ? 'Semana siguiente' : 'Día siguiente' }} <span aria-hidden="true">→</span></button>
        </div>
        <p class="text-cuerpo font-semibold text-valor" aria-live="polite" data-testid="calendario-rango">{{ rango() }}</p>
      </div>

      @if (!franjas().length) {
        <p class="text-cuerpo text-prosa" data-testid="calendario-sin-franjas">Todavía no hay franjas para mostrar.</p>
      } @else {
        <div class="overflow-x-auto">
          <table class="cal__tabla" role="grid" [attr.aria-label]="'Calendario de la agenda, ' + rango()" data-testid="calendario"
                 [style.min-width]="dias().length > 2 ? '44rem' : '16rem'" [style.max-width]="dias().length <= 2 ? '36rem' : null">
            <thead>
              <tr>
                <th scope="col" class="cal__hora"><span class="sr-only">Hora</span></th>
                @for (d of dias(); track d.clave) {
                  <th scope="col" class="cal__dia" [attr.data-dia]="d.clave">{{ d.rotulo }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (fila of filas(); track fila.hora; let i = $index) {
                <tr>
                  <th scope="row" class="cal__hora">{{ fila.hora }}</th>
                  @for (d of dias(); track d.clave; let j = $index) {
                    <td role="gridcell">
                      @if (celdaDe(d.clave, fila.hora); as c) {
                          <button type="button" class="cal__celda" [class]="'cal__celda e-' + c.celda.estado"
                                  [attr.data-celda]="c.franja.id" [attr.data-estado]="c.celda.estado"
                                  [attr.aria-label]="nombreAccesible(c.celda, c.franja)" [attr.aria-pressed]="seleccionada() === c.franja.id"
                                  [attr.tabindex]="esLaActiva(i, j) ? 0 : -1" [attr.data-fila]="i" [attr.data-col]="j"
                                  (keydown)="alTeclear($event, i, j)" (focus)="activa.set(i + ',' + j)" (click)="pulsar(c.franja.id)">
                            <strong>{{ estadoEtiqueta(c.celda.estado) }}</strong>
                            @for (l of c.celda.lineas; track $index) { <span class="block">{{ ' ' + l }}</span> }
                          </button>
                      } @else {
                        <div class="cal__vacia" aria-hidden="true"></div>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <ul class="cal__leyenda flex flex-wrap gap-x-5 gap-y-1 text-dato text-prosa" aria-label="Leyenda del calendario" data-testid="calendario-leyenda">
          @for (e of leyenda(); track e) {
            <li><span class="cal__marca" [class]="'cal__marca e-' + e"></span>{{ estadoEtiqueta(e) }}</li>
          }
        </ul>
      }
    </div>
  `,
})
export class CalendarioDeAgendaComponent {
  readonly franjas = input.required<readonly Franja[]>();
  readonly celdas = input.required<readonly CeldaDeFranja[]>();
  /** La franja marcada (por ejemplo, la que se está mirando en el detalle). */
  readonly seleccionada = input<number | null>(null);
  readonly elegir = output<number>();

  protected readonly vistas: readonly OpcionSegmentada[] = [{ id: 'semana', etiqueta: 'Semana' }, { id: 'dia', etiqueta: 'Día' }];
  readonly vista = signal<'semana' | 'dia'>(typeof window !== 'undefined' && window.innerWidth < 640 ? 'dia' : 'semana');
  /** El día de referencia (`AAAA-MM-DD`); `null` = el primero con franjas. */
  private readonly referencia = signal<string | null>(null);
  protected readonly activa = signal('0,0');

  private readonly porDiaYHora = computed(() => {
    const mapa = new Map<string, { franja: Franja }>();
    for (const f of this.franjas()) mapa.set(`${claveDeDia(f.inicioUtc)}|${horaDeLaFranja(f.inicioUtc)}`, { franja: f });
    return mapa;
  });
  private readonly celdaPorFranja = computed(() => new Map(this.celdas().map(c => [c.franjaId, c])));

  private readonly diasConFranjas = computed(() => [...new Set(this.franjas().map(f => claveDeDia(f.inicioUtc)))].sort());
  private readonly dia = computed(() => this.referencia() ?? this.diasConFranjas()[0] ?? aClave(Date.now()));

  protected readonly dias = computed(() => {
    const ref = aFecha(this.dia());
    if (this.vista() === 'dia') return [{ clave: this.dia(), rotulo: FORMATO_DIA.format(ref) }];
    const diaSemana = (new Date(ref).getUTCDay() + 6) % 7; // lunes = 0
    const lunes = ref - diaSemana * MS_DIA;
    const semana = Array.from({ length: 7 }, (_, k) => ({ clave: aClave(lunes + k * MS_DIA), rotulo: FORMATO_DIA.format(lunes + k * MS_DIA) }));
    // Sin columnas vacías: solo los días de esa semana que tienen franjas (si ninguno, la semana completa).
    const conFranjas = semana.filter(d => this.diasConFranjas().includes(d.clave));
    return conFranjas.length ? conFranjas : semana;
  });

  protected readonly rango = computed(() => {
    const d = this.dias();
    return this.vista() === 'dia' || d.length === 1 ? FORMATO_DIA_LARGO.format(aFecha(d[0].clave)) : `${FORMATO_DIA.format(aFecha(d[0].clave))} al ${FORMATO_DIA.format(aFecha(d[d.length - 1].clave))}`;
  });

  /** Las filas son las horas de inicio que existen ese día o esa semana: sin renglones vacíos. */
  protected readonly filas = computed(() => {
    const claves = new Set(this.dias().map(d => d.clave));
    const horas = new Set<string>();
    for (const f of this.franjas()) if (claves.has(claveDeDia(f.inicioUtc))) horas.add(horaDeLaFranja(f.inicioUtc));
    return [...horas].sort().map(hora => ({ hora }));
  });

  protected readonly leyenda = computed(() => {
    const presentes = new Set(this.celdas().map(c => c.estado));
    return (Object.keys(ETIQUETA_DEL_ESTADO_DE_FRANJA) as EstadoDeFranja[]).filter(e => presentes.has(e));
  });

  constructor() {
    // Al cambiar de vista o de semana, la celda activa vuelve al origen.
    effect(() => { this.vista(); this.dia(); this.activa.set('0,0'); });
  }

  /** Empieza por lo que se ve en la celda (WCAG 2.5.3) y añade el día y la hora. */
  protected nombreAccesible(celda: CeldaDeFranja, franja: Franja): string {
    const visible = [this.estadoEtiqueta(celda.estado), ...celda.lineas].join(' ');
    return `${visible}. ${rotuloDeJornada(franja.inicioUtc)}, ${horaDeLaFranja(franja.inicioUtc)}`;
  }

  protected estadoEtiqueta(e: EstadoDeFranja): string { return ETIQUETA_DEL_ESTADO_DE_FRANJA[e]; }

  protected celdaDe(clave: string, hora: string): { franja: Franja; celda: CeldaDeFranja } | null {
    const hallada = this.porDiaYHora().get(`${clave}|${hora}`);
    if (!hallada) return null;
    const celda = this.celdaPorFranja().get(hallada.franja.id)
      ?? { franjaId: hallada.franja.id, estado: 'libre' as const, lineas: [], etiqueta: `${hora}, libre`, accionable: false };
    return { franja: hallada.franja, celda };
  }

  /** Una sola celda entra en el orden de tabulación: la activa y, si ya no existe, la primera que haya. */
  protected esLaActiva(i: number, j: number): boolean {
    const [ai, aj] = this.activa().split(',').map(Number);
    const existe = (a: number, b: number): boolean => !!this.celdaDe(this.dias()[b]?.clave ?? '', this.filas()[a]?.hora ?? '');
    if (existe(ai, aj)) return ai === i && aj === j;
    for (let a = 0; a < this.filas().length; a++) for (let b = 0; b < this.dias().length; b++) if (existe(a, b)) return a === i && b === j;
    return false;
  }

  protected pulsar(id: number): void { this.elegir.emit(id); }

  protected mover(pasos: number): void {
    const salto = this.vista() === 'semana' ? 7 : 1;
    // En vista de día se salta de jornada con franjas en jornada con franjas; en semana, de siete en siete.
    if (this.vista() === 'dia') {
      const dias = this.diasConFranjas();
      const i = dias.indexOf(this.dia());
      const siguiente = dias[Math.min(Math.max(i + pasos, 0), dias.length - 1)];
      if (siguiente) { this.referencia.set(siguiente); return; }
    }
    this.referencia.set(aClave(aFecha(this.dia()) + pasos * salto * MS_DIA));
  }

  protected alTeclear(evento: KeyboardEvent, i: number, j: number): void {
    const filas = this.filas().length, cols = this.dias().length;
    let ni = i, nj = j;
    switch (evento.key) {
      case 'ArrowRight': nj = Math.min(cols - 1, j + 1); break;
      case 'ArrowLeft': nj = Math.max(0, j - 1); break;
      case 'ArrowDown': ni = Math.min(filas - 1, i + 1); break;
      case 'ArrowUp': ni = Math.max(0, i - 1); break;
      case 'Home': nj = 0; break;
      case 'End': nj = cols - 1; break;
      default: return;
    }
    evento.preventDefault();
    // Se salta lo que no existe (un día sin esa hora) hasta la celda vecina más cercana en esa dirección.
    const host = (evento.currentTarget as HTMLElement).closest('table')!;
    const dx = Math.sign(nj - j), dy = Math.sign(ni - i);
    let ci = i + dy, cj = j + dx;
    if (evento.key === 'Home') { ci = i; cj = 0; }
    if (evento.key === 'End') { ci = i; cj = cols - 1; }
    while (ci >= 0 && ci < filas && cj >= 0 && cj < cols) {
      const destino = host.querySelector<HTMLButtonElement>(`button[data-fila="${ci}"][data-col="${cj}"]`);
      if (destino) { this.activa.set(`${ci},${cj}`); destino.focus(); return; }
      if (evento.key === 'Home') cj++; else if (evento.key === 'End') cj--; else { ci += dy; cj += dx; }
      if (dx === 0 && dy === 0) break;
    }
  }
}
