import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AprobacionDeArtistas, ModoDeAgenda, vocabularioDeModo } from '../../../core/services/agendamiento-de-citas.service';

/**
 * La VISTA PREVIA de una agenda de citas: lo que verá una persona que quiera inscribirse, con la modalidad, las reglas
 * y los cupos dichos con las palabras del sector. La usa el asistente de configuración (a la derecha, en vivo) y el
 * Resumen de una agenda en preparación, para revisar todo ANTES de abrir la inscripción.
 *
 * Es solo presentación: recibe valores, no llama a la API ni guarda nada.
 */
@Component({
  selector: 'app-vista-previa-de-agenda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .barra { height: .6rem; border-radius: 9999px; background: #e7eaf0; overflow: hidden; }
    .barra > span { display: block; height: 100%; background: #2e9d6a; }
  `],
  template: `
    <div class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" data-testid="vista-previa-de-agenda">
      <p class="text-dato font-bold text-verde-texto">{{ mercado() }}</p>
      <div>
        <p class="font-alternate text-lectura font-bold text-morado">{{ nombre() || mercado() }}</p>
        @if (subtitulo()) { <p class="text-cuerpo text-prosa">{{ subtitulo() }}</p> }
      </div>
      <p class="text-cuerpo font-semibold text-valor">{{ modo() === 'compradores_fijos' ? 'Los artistas rotan; los compradores tienen mesa fija' : 'Los compradores rotan; los artistas tienen stand fijo' }}</p>
      <p class="text-cuerpo text-prosa">{{ explicacionDelModo() }}</p>
      <ul class="space-y-1 text-cuerpo text-valor">
        <li>Citas de <strong>{{ duracion() }} minutos</strong>{{ pausa() ? ', con ' + pausa() + ' de pausa' : ', sin pausa' }}</li>
        <li>Participación: <strong>{{ aprobacion() === 'aceptacion' ? 'la organización aprueba cada inscripción' : 'por orden de inscripción' }}</strong></li>
        <li>{{ voc().cupoDeCitas }}: <strong>{{ cupoDeCitas() ?? 'sin límite' }}</strong></li>
        <li>Hasta <strong>{{ tope() }}</strong> solicitudes sin respuesta a la vez</li>
        <li>Una solicitud sin respuesta se libera a las <strong>{{ vence() }} horas</strong></li>
        <li>Nunca dos citas en el mismo horario: la franja ocupada se bloquea sola</li>
      </ul>
      <div>
        <p class="text-cuerpo text-valor">Artistas admitidos: <strong>{{ admitidos() }} de {{ cupoDeArtistas() ?? 'sin límite' }}</strong></p>
        <div class="barra mt-1" aria-hidden="true"><span [style.width.%]="porcentajeAdmitido()"></span></div>
      </div>
      <span class="inline-flex min-h-control-minimo items-center rounded-control bg-morado px-4 text-dato font-bold text-white" aria-hidden="true">Inscribirme</span>
    </div>
  `,
})
export class VistaPreviaDeAgendaComponent {
  readonly mercado = input('Mercado');
  readonly nombre = input('');
  readonly subtitulo = input('');
  readonly modo = input<ModoDeAgenda>('compradores_fijos');
  readonly aprobacion = input<AprobacionDeArtistas>('automatica');
  readonly duracion = input(20);
  readonly pausa = input(5);
  readonly tope = input(5);
  readonly vence = input(72);
  readonly cupoDeCitas = input<number | null>(null);
  readonly cupoDeArtistas = input<number | null>(null);
  /** Artistas ya admitidos: en el asistente (agenda aún sin guardar) es 0; en el Resumen, la cifra real. */
  readonly admitidos = input(0);

  /** El ancho de la barra: lo admitido sobre el cupo; con un mínimo visible si hay cupo y todavía no hay nadie. */
  protected readonly porcentajeAdmitido = computed(() => {
    const cupo = this.cupoDeArtistas();
    if (!cupo) return this.admitidos() > 0 ? 100 : 8;
    return Math.max(8, Math.min(100, Math.round((this.admitidos() / cupo) * 100)));
  });

  protected readonly voc = computed(() => vocabularioDeModo(this.modo()));
  protected readonly explicacionDelModo = computed(() => this.modo() === 'compradores_fijos'
    ? 'Tú, como artista, pides la cita al comprador o booker en su mesa; él o ella la confirma.'
    : 'Los compradores o bookers te piden la cita en tu stand y tú la confirmas.');
}
