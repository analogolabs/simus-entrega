import { Component, Input } from '@angular/core';
import { SOLO_ADMINISTRACION } from './panel-organizacion.store';

/**
 * La nota que sustituye a las acciones reservadas a la administración cuando la cuenta es editora
 *.
 *
 * <b>SE OCULTA EL BOTÓN Y SE EXPLICA, EN VEZ DE DESHABILITARLO.</b> Un `<button disabled>` sale del
 * recorrido de tabulación, así que su explicación no la oye quien navega con teclado. Una nota
 * visible, en el sitio donde estaría la acción, sí se lee.
 */
@Component({
  selector: 'app-aviso-solo-administracion',
  standalone: true,
  template: `
    <p role="note" data-testid="aviso-solo-administracion"
       class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
      {{ texto || SOLO_ADMINISTRACION }}
    </p>
  `,
})
export class AvisoSoloAdministracionComponent {
  protected readonly SOLO_ADMINISTRACION = SOLO_ADMINISTRACION;

  /** Un texto propio cuando la sección necesita nombrar la acción concreta. */
  @Input() texto = '';
}
