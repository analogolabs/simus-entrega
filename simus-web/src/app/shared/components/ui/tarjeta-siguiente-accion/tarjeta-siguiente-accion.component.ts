import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AccionDeProceso, SiguienteAccion } from '../../../../core/acciones/acciones-por-estado';
import { clasesDeBoton } from '../boton/boton.component';

/**
 * La tarjeta de «siguiente acción» de la ficha de un proceso.
 *
 * <b>Una sola, para Festival y Mercado.</b> Dice en qué punto está el trámite y ofrece lo que el
 * estado admite, con los verbos del modelo de acciones (`core/acciones`), los mismos que el menú
 * de la lista. Hasta ahora cada ficha pintaba la suya, y la de un Festival publicado no ofrecía
 * nada.
 *
 * <b>Lo apagado no desaparece ni se queda mudo.</b> Una acción que hoy no se puede hacer se pinta
 * con `aria-disabled` —sigue en el recorrido del teclado, a diferencia de un `disabled`— y su
 * motivo escrito debajo, enlazado con `aria-describedby`. Pulsarla no emite nada.
 */
@Component({
  selector: 'app-tarjeta-siguiente-accion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (siguiente(); as s) {
      <section data-siguiente-accion [attr.data-tono]="s.tono" [attr.aria-labelledby]="idTitulo" [class]="clasesDeLaTarjeta(s.tono)">
        @if (s.tono === 'atencion') {
          <p class="text-dato font-bold text-amber-800">Acción requerida</p>
        }
        <h2 [id]="idTitulo" class="text-lectura font-semibold text-valor">{{ s.titulo }}</h2>
        @if (s.detalle) { <p class="mt-2 max-w-2xl text-cuerpo leading-relaxed text-prosa">{{ s.detalle }}</p> }

        <!-- Lo que el hijo quiera añadir: la lista de lo que falta, el motivo de un rechazo. -->
        <ng-content />

        @if (s.acciones.length) {
          <ul class="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start" aria-label="Acciones disponibles">
            @for (accion of s.acciones; track accion.id; let i = $index) {
              <li class="flex max-w-xs flex-col gap-1">
                <button type="button" [attr.data-accion]="accion.id"
                        [attr.aria-disabled]="accion.habilitada ? null : 'true'"
                        [attr.aria-describedby]="accion.habilitada ? null : idMotivo(accion)"
                        [attr.aria-busy]="ocupadaLa() === accion.id ? 'true' : null"
                        [class]="clasesDelBoton(accion, i)"
                        (click)="pulsar(accion)">{{ accion.etiqueta }}</button>
                @if (!accion.habilitada && accion.motivo) {
                  <small [id]="idMotivo(accion)" data-motivo-de-accion class="text-xs leading-snug text-slate-600">{{ accion.motivo }}</small>
                }
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
})
export class TarjetaSiguienteAccionComponent {
  private static contador = 0;
  private readonly sufijo = `${++TarjetaSiguienteAccionComponent.contador}`;
  readonly idTitulo = `siguiente-accion-${this.sufijo}`;

  readonly siguiente = input.required<SiguienteAccion | null>();

  /** La acción que está esperando respuesta del servidor: se pinta como ocupada. */
  readonly ocupadaLa = input<string | null>(null);

  /** Lo que la persona eligió. Una acción apagada no emite. */
  readonly elegida = output<AccionDeProceso>();

  idMotivo(accion: AccionDeProceso): string {
    return `${this.idTitulo}-motivo-${accion.id}`;
  }

  pulsar(accion: AccionDeProceso): void {
    if (!accion.habilitada) return;
    this.elegida.emit(accion);
  }

  clasesDelBoton(accion: AccionDeProceso, posicion: number): string {
    const importancia = accion.tono === 'principal' && posicion === 0 ? 'principal' : 'secundaria';
    return clasesDeBoton(importancia, 'normal') + (accion.habilitada ? '' : ' opacity-60 cursor-not-allowed');
  }

  clasesDeLaTarjeta(tono: SiguienteAccion['tono']): string {
    const base = 'mt-8 rounded-2xl px-5 py-5 sm:px-6 ';
    switch (tono) {
      case 'atencion': return base + 'border border-amber-200 bg-amber-50';
      case 'exito': return base + 'border border-emerald-200 bg-emerald-50';
      case 'rechazo': return base + 'border border-rose-200 bg-rose-50';
      default: return base + 'bg-slate-50';
    }
  }
}
