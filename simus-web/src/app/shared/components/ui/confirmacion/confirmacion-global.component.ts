import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ServicioDeConfirmacion } from '../../../../core/confirmacion/servicio-de-confirmacion';
import { ConfirmacionComponent } from './confirmacion.component';

/**
 * El anfitrión del diálogo de confirmación común: se monta UNA vez, en la raíz de la aplicación, y
 * pinta `app-confirmacion` cuando alguna pantalla llama a `ServicioDeConfirmacion.pedir()`.
 *
 * El `@if` decide cuándo se abre —igual que en el resto de diálogos del proyecto—, de modo que el
 * ciclo de vida de `appDialogo` (foco dentro, foco retenido, Escape, fondo bloqueado) coincide con el
 * del diálogo. Va con `encima` porque casi siempre se abre sobre una ficha o un cajón.
 */
@Component({
  selector: 'app-confirmacion-global',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmacionComponent],
  template: `
    @if (servicio.peticion(); as p) {
      <app-confirmacion
        [titulo]="p.titulo"
        [detalle]="p.detalle ?? ''"
        [accion]="p.accion ?? 'Continuar'"
        [cancelacion]="p.cancelacion ?? 'Cancelar'"
        [tono]="p.tono ?? 'confirmar'"
        [pideMotivo]="p.pideMotivo ?? false"
        [rotuloDelMotivo]="p.rotuloDelMotivo ?? 'Por qué'"
        [ayudaDelMotivo]="p.ayudaDelMotivo ?? ''"
        [motivoObligatorio]="p.motivoObligatorio ?? true"
        [eventosDelProceso]="p.eventosDelProceso ?? null"
        [encima]="true"
        identificador="confirmacion-comun-aceptar"
        (confirmar)="servicio.aceptar($event)"
        (cancelar)="servicio.cancelar()" />
    }
  `,
})
export class ConfirmacionGlobalComponent {
  readonly servicio = inject(ServicioDeConfirmacion);
}
