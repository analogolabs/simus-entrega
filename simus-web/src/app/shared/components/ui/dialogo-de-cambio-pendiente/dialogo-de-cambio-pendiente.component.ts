import { Component, inject } from '@angular/core';
import { ConfirmacionDeCambioDeOrganizacion } from '../../../../core/navegacion/cambio-de-organizacion';
import { DialogoDirective } from '../../../directives/dialogo.directive';

import { BotonNativoDirective } from '../boton/boton.component';
/**
 * El diálogo de «tienes cambios sin guardar» de los armazones del panel.
 *
 * <b>UN SOLO DIÁLOGO PARA DOS PREGUNTAS.</b> Lo abre `confirmarCambioDeOrganizacion` al cambiar de
 * organización con trabajo a medias (L2) y `confirmarSalida` al irse de un formulario con cambios
 * sin guardar (L4). Vive aquí, y no copiado en cada armazón, porque el panel de una organización y
 * el espacio «Persona» lo necesitan por igual y una copia es una pregunta que acaba diciendo cosas
 * distintas según desde dónde se haga.
 */
@Component({
  selector: 'app-dialogo-de-cambio-pendiente',
  standalone: true,
  imports: [BotonNativoDirective, DialogoDirective],
  template: `
    @if (cambio.pendiente(); as pregunta) {
      <div class="fixed inset-0 z-(--z-dialogo) grid place-items-center bg-slate-900/40 p-4">
        <div role="alertdialog" aria-modal="true" aria-labelledby="cambio-organizacion-titulo" aria-describedby="cambio-organizacion-texto" data-testid="confirmar-cambio-de-organizacion"
             appDialogo (cerrar)="cambio.responder(false)" class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl outline-none">
          <h2 id="cambio-organizacion-titulo" class="font-alternate text-sm font-bold uppercase tracking-widest text-morado">{{ pregunta.salida ? pregunta.salida.titulo : '¿Cambiar a «' + pregunta.organizacionNueva + '»?' }}</h2>
          <p id="cambio-organizacion-texto" class="mt-3 text-sm leading-relaxed text-slate-700">{{ pregunta.mensaje }}</p>
          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" data-testid="seguir-en-la-organizacion" (click)="cambio.responder(false)" appBoton="secundaria" tamano="comodo">{{ pregunta.salida ? pregunta.salida.seguir : 'Seguir en «' + pregunta.organizacionActual + '»' }}</button>
            <button type="button" data-testid="confirmar-cambio" (click)="cambio.responder(true)" appBoton="principal" tamano="comodo">{{ pregunta.salida ? pregunta.salida.confirmar : 'Cambiar de organización' }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DialogoDeCambioPendienteComponent {
  readonly cambio = inject(ConfirmacionDeCambioDeOrganizacion);
}
