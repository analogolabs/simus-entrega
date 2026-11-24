import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { EventoDeLaOrganizacion } from './panel-organizacion.api';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MAXIMO_DE_EVENTOS = 5;

/** «AAAA-MM-DD» de las partes de una fecha, sin pasar por la zona horaria. */
function clave(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * LA AGENDA DEL INICIO (P1 de la gestión externa, prototipo B4): un calendario del mes con los días que tienen
 * eventos de la organización marcados, y debajo la lista de lo que viene.
 *
 * <b>SOLO LEE LO QUE YA HAY.</b> Recibe los eventos de la organización (la misma lectura de la sección Eventos);
 * no pide nada ni inventa nada. Pulsar un día con eventos filtra la lista a ese día; «Ver todos los próximos
 * eventos» la devuelve a lo que viene. El mes inicial es el del primer evento próximo (o el actual) y se puede
 * recorrer con las flechas. Las fechas se leen tal como vienen (`AAAA-MM-DD`), sin conversión de zona horaria.
 */
@Component({
  selector: 'app-agenda-del-inicio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IndicadorDeEstadoComponent, LucideChevronLeft, LucideChevronRight],
  styleUrl: './agenda-del-inicio.component.css',
  template: `
    <div class="cal" data-testid="agenda-calendario">
      <div class="cal__mes">
        <button type="button" class="cal__flecha" (click)="mover(-1)" aria-label="Mes anterior"><svg lucideChevronLeft [size]="18" aria-hidden="true"></svg></button>
        <p class="cal__nombre" aria-live="polite"><strong>{{ nombreDelMes() }}</strong><span class="t-ayuda">Hoy: {{ hoyCorto }}</span></p>
        <button type="button" class="cal__flecha" (click)="mover(1)" aria-label="Mes siguiente"><svg lucideChevronRight [size]="18" aria-hidden="true"></svg></button>
      </div>
      <div class="cal__rejilla" role="group" [attr.aria-label]="'Días con eventos de ' + nombreDelMes()">
        @for (d of ['L', 'M', 'M', 'J', 'V', 'S', 'D']; track $index) { <span class="cal__semana" aria-hidden="true">{{ d }}</span> }
        @for (celda of celdas(); track celda.clave) {
          @if (!celda.dia) { <span class="cal__vacia"></span> }
          @else if (celda.eventos) {
            <button type="button" class="cal__dia cal__dia--con" [class.cal__dia--hoy]="celda.hoy" [attr.aria-pressed]="seleccionado() === celda.clave" (click)="elegir(celda.clave)"
              [attr.aria-label]="celda.dia + ' de ' + nombreDelMes().split(' ')[0] + ', ' + (celda.eventos === 1 ? '1 evento' : celda.eventos + ' eventos')">{{ celda.dia }}</button>
          } @else {
            <span class="cal__dia" [class.cal__dia--hoy]="celda.hoy">{{ celda.dia }}</span>
          }
        }
      </div>
    </div>

    <ul class="evl" aria-live="polite" data-testid="agenda-eventos">
      @for (evento of visibles(); track evento.id) {
        <li>
          <span class="evl__dia" aria-hidden="true">{{ dia(evento) }}<small>{{ diaDeLaSemana(evento) }}</small></span>
          <div class="evl__texto">
            <p class="evl__titulo">{{ evento.titulo }}</p>
            @if (detalle(evento); as d) { <p class="t-ayuda">{{ d }}</p> }
            <app-indicador-de-estado class="evl__estado" [etiqueta]="evento.estadoEtiqueta" [tono]="tono(evento.estado)" [conTexto]="true"></app-indicador-de-estado>
          </div>
        </li>
      } @empty {
        <li class="evl__vacio t-texto">{{ seleccionado() ? 'Ese día no tiene eventos.' : 'No hay eventos próximos. Los que anuncies aparecerán aquí.' }}</li>
      }
    </ul>
    @if (seleccionado()) {
      <p class="evl__todos"><button type="button" class="cal__enlace" (click)="elegir(null)">Ver todos los próximos eventos</button></p>
    }
  `,
})
export class AgendaDelInicioComponent {
  /** Los eventos de la organización, tal como los lee la sección Eventos. */
  readonly eventos = input.required<EventoDeLaOrganizacion[]>();

  private readonly hoy = new Date();
  private readonly claveDeHoy = clave(this.hoy.getFullYear(), this.hoy.getMonth(), this.hoy.getDate());
  readonly hoyCorto = `${this.hoy.getDate()} ${MESES_CORTOS[this.hoy.getMonth()]}`;
  readonly tono = tonoDelEstado;

  private readonly mesVisible = signal<{ anio: number; mes: number } | null>(null);
  readonly seleccionado = signal<string | null>(null);

  /** Los eventos vigentes (no cancelados ni pasados), por fecha de inicio. */
  readonly proximos = computed(() => this.eventos()
    .filter(e => !e.cancelado && (e.fechaFin ?? e.fechaInicio).slice(0, 10) >= this.claveDeHoy)
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)));

  /** El mes que se ve: el elegido con las flechas o, si no, el del primer evento próximo o el actual. */
  readonly mes = computed(() => {
    const elegido = this.mesVisible();
    if (elegido) return elegido;
    const primero = this.proximos()[0]?.fechaInicio;
    return primero
      ? { anio: Number(primero.slice(0, 4)), mes: Number(primero.slice(5, 7)) - 1 }
      : { anio: this.hoy.getFullYear(), mes: this.hoy.getMonth() };
  });
  readonly nombreDelMes = computed(() => `${MESES[this.mes().mes][0].toUpperCase()}${MESES[this.mes().mes].slice(1)} ${this.mes().anio}`);

  private eventosDelDia(dia: string): number {
    return this.proximos().filter(e => e.fechaInicio.slice(0, 10) <= dia && dia <= (e.fechaFin ?? e.fechaInicio).slice(0, 10)).length;
  }

  readonly celdas = computed(() => {
    const { anio, mes } = this.mes();
    const primeroDeLaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7; // la semana empieza el lunes
    const diasDelMes = new Date(anio, mes + 1, 0).getDate();
    const celdas: { clave: string; dia: number; eventos: number; hoy: boolean }[] = [];
    for (let i = 0; i < primeroDeLaSemana; i++) celdas.push({ clave: `v${i}`, dia: 0, eventos: 0, hoy: false });
    for (let dia = 1; dia <= diasDelMes; dia++) {
      const k = clave(anio, mes, dia);
      celdas.push({ clave: k, dia, eventos: this.eventosDelDia(k), hoy: k === this.claveDeHoy });
    }
    return celdas;
  });

  readonly visibles = computed(() => {
    const dia = this.seleccionado();
    return dia
      ? this.proximos().filter(e => e.fechaInicio.slice(0, 10) <= dia && dia <= (e.fechaFin ?? e.fechaInicio).slice(0, 10))
      : this.proximos().slice(0, MAXIMO_DE_EVENTOS);
  });

  constructor() {
    // Si cambian los eventos (se recargó el inicio), la selección y el mes elegido no sobreviven a lo que ya no existe.
    effect(() => { this.eventos(); this.seleccionado.set(null); this.mesVisible.set(null); });
  }

  mover(delta: number): void {
    const { anio, mes } = this.mes();
    const siguiente = new Date(anio, mes + delta, 1);
    this.mesVisible.set({ anio: siguiente.getFullYear(), mes: siguiente.getMonth() });
    this.seleccionado.set(null);
  }

  elegir(dia: string | null): void {
    this.seleccionado.set(dia === this.seleccionado() ? null : dia);
  }

  dia(evento: EventoDeLaOrganizacion): string { return String(Number(evento.fechaInicio.slice(8, 10))); }
  diaDeLaSemana(evento: EventoDeLaOrganizacion): string {
    const [a, m, d] = evento.fechaInicio.slice(0, 10).split('-').map(Number);
    return DIAS_CORTOS[new Date(a, m - 1, d).getDay()];
  }
  /** Dónde y con qué proceso: lo que el evento declara, sin inventar nada. */
  detalle(evento: EventoDeLaOrganizacion): string {
    return [evento.lugar, evento.procesoNombre].filter(Boolean).join(' · ');
  }
}
