import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PropuestaDeCambio } from '../../../../core/services/propuestas-de-proceso.service';
import { BotonNativoDirective } from '../boton/boton.component';

/**
 * La propuesta de cambio sobre un proceso ya publicado, vista por quien responde por él (PROP, decisión 122).
 *
 * <b>UNA SOLA PIEZA PARA MERCADO, TALLER, ESPACIO Y RED.</b> Lo que cambia entre ellos son los campos que se
 * pueden proponer, y eso lo dice el servidor; esta tarjeta solo cuenta en qué punto está la propuesta y qué se
 * puede hacer con ella. La ficha decide cuándo montarla (con el proceso publicado) y qué hace cada botón.
 *
 * <b>LO PUBLICADO NO CAMBIA TODAVÍA.</b> Es lo primero que dice: quien escribe un nombre nuevo no debe creer que el
 * portal ya lo muestra. El borrador es de quien responde y el Programa no lo ve hasta que se envía.
 */
@Component({
  selector: 'app-propuesta-del-proceso',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, BotonNativoDirective],
  template: `
    @if (visible()) {
      <section data-propuesta-del-proceso [attr.data-estado]="estado()" aria-labelledby="propuesta-titulo"
               class="rounded-lg border border-violet-200 bg-violet-50 p-5">
        <h2 id="propuesta-titulo" class="text-sm font-bold text-slate-900">{{ titulo() }}</h2>
        <p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-700">{{ detalle() }}</p>

        @if (estado() === 'ajustes_solicitados' && propuesta()?.motivoDeLaDecision) {
          <p data-propuesta-ajustes class="mt-3 max-w-2xl rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800">
            <b>Qué pidieron:</b> {{ propuesta()?.motivoDeLaDecision }}
          </p>
        }

        @if (campos().length) {
          <ul class="mt-3 space-y-1" aria-label="Campos de la propuesta">
            @for (campo of campos(); track campo.id) {
              <li class="text-sm text-slate-700">
                <b>{{ campo.campoEtiqueta }}:</b>&nbsp;
                @if (enRevision() && (campo.valorAnteriorLegible ?? campo.valorAnterior)) {
                  <span class="text-slate-500">{{ campo.valorAnteriorLegible ?? campo.valorAnterior }} →</span>
                }
                {{ campo.valorPropuestoLegible ?? campo.valorPropuesto ?? 'sin valor' }}
              </li>
            }
          </ul>
        }

        @if (!enRevision()) {
          <label for="motivo-de-la-propuesta" class="mt-4 block text-sm font-bold text-slate-800">Por qué lo propones</label>
          <textarea id="motivo-de-la-propuesta" name="motivoDeLaPropuesta" rows="2" maxlength="2400"
                    [ngModel]="motivo()" (ngModelChange)="motivo.set($event)"
                    aria-describedby="ayuda-motivo-de-la-propuesta"
                    class="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900"></textarea>
          <small id="ayuda-motivo-de-la-propuesta" class="campo__ayuda">
            Es lo primero que lee quien revisa, antes de mirar campo por campo. Se guarda con los demás cambios.
          </small>
        }

        @if (cambiosSinGuardar() > 0) {
          <p role="note" data-propuesta-cambios-sin-guardar class="mt-3 text-sm text-violet-900">
            {{ cambiosSinGuardar() === 1 ? 'Hay un cambio de fondo sin guardar' : 'Hay ' + cambiosSinGuardar() + ' cambios de fondo sin guardar' }}:
            al guardar, se añaden a esta propuesta.
          </p>
        }

        @if (!enRevision() && hayBorrador()) {
          <div class="mt-4 flex flex-wrap items-center gap-3">
            @if (puedeAdministrar()) {
              <button type="button" data-enviar-propuesta [disabled]="ocupado() || cambiosSinGuardar() > 0" (click)="enviar.emit()"
                      appBoton="principal">Enviar la propuesta al PNMC</button>
              <button type="button" data-abandonar-propuesta [disabled]="ocupado()" (click)="abandonar.emit()"
                      appBoton="secundaria">Descartar la propuesta</button>
            } @else {
              <p class="text-sm text-slate-600">Enviarla o descartarla lo hace quien administra.</p>
            }
          </div>
        }
      </section>
    }
  `,
})
export class PropuestaDelProcesoComponent {
  /** La propuesta viva, o `null` si no hay ninguna (el servidor responde con `id` en cero). */
  readonly propuesta = input<PropuestaDeCambio | null>(null);
  /** Cuántos campos de fondo hay escritos en el formulario y todavía sin guardar como propuesta. */
  readonly cambiosSinGuardar = input(0);
  readonly puedeAdministrar = input(false);
  readonly ocupado = input(false);
  /** «Por qué lo propones»: se guarda junto con los campos, en un solo envío. */
  readonly motivo = model('');

  readonly enviar = output<void>();
  readonly abandonar = output<void>();

  readonly estado = computed(() => this.propuesta()?.estado ?? 'borrador');
  readonly campos = computed(() => this.propuesta()?.campos ?? []);
  readonly enRevision = computed(() => this.estado() === 'en_revision');
  readonly hayBorrador = computed(() => (this.propuesta()?.id ?? 0) > 0
    && ['borrador', 'ajustes_solicitados'].includes(this.estado()));
  readonly visible = computed(() => this.hayBorrador() || this.enRevision() || this.cambiosSinGuardar() > 0);

  readonly titulo = computed(() => {
    if (this.enRevision()) return 'Tu propuesta de cambio está en revisión';
    if (this.estado() === 'ajustes_solicitados') return 'El PNMC pidió ajustes a tu propuesta';
    return this.hayBorrador() ? 'Propuesta de cambio sin enviar' : 'Un cambio de fondo se propone';
  });

  readonly detalle = computed(() => this.enRevision()
    ? 'Lo publicado no cambia mientras el PNMC decide. No puedes modificar la propuesta hasta que responda.'
    : 'Lo publicado no cambia todavía: el nombre, el territorio y lo demás que define el proceso se proponen, y el PNMC decide si se aplican. '
      + 'Lo que es errata, como un teléfono o una foto, se guarda al instante sin pasar por aquí.');
}
