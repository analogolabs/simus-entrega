import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideCircleAlert, LucideInbox } from '@lucide/angular';

import { EsqueletoComponent } from '../esqueleto/esqueleto.component';

/**
 * Lo que una lista enseña cuando no tiene filas que enseñar: vacía, cargando o con error.
 *
 * <b>ERAN OCHO VERSIONES.</b> La auditoría encontró el estado vacío
 * escrito de ocho maneras solo en Bandeja de trabajo y Ecosistema musical —dentro de una tarjeta,
 * como celda de tabla, como párrafo suelto, en gris claro, en negrita, con y sin explicación—.
 * Una lista vacía es el mismo hecho en todas: se dice igual.
 *
 * <b>UN VACIO DICE QUE HACER.</b> El título nombra lo que no hay; el detalle, cuándo aparecerá o
 * qué se puede hacer. Sin detalle, un vacío se lee como un fallo.
 *
 * <b>Y CABE EN UNA SUBLISTA.</b> La variante `denso` existe porque la que no lo era —centrada y con
 * 3 rem de aire arriba y abajo— no cabía dentro de una sección de una ficha, y eso es lo que llevaba
 * a escribir a mano un párrafo gris cada vez que la lista vacía era pequeña. Con ella, la misma
 * pieza sirve para la tabla de una sección y para las localizaciones de una edición.
 */
@Component({
  selector: 'app-estado-de-lista',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCircleAlert, LucideInbox, EsqueletoComponent],
  styles: [`
    :host { display: block; }
    .estado { display: flex; flex-direction: column; align-items: center; gap: .5rem; padding: 3rem 1.5rem; text-align: center; color: var(--color-prosa); }
    .estado--denso { padding: 1.25rem 0; align-items: flex-start; text-align: left; }
    .estado--error { color: #8a3b12; }
    .estado__icono { color: var(--color-rotulo); }
    .estado--error .estado__icono { color: #b45309; }
    .estado__titulo { margin: .25rem 0 0; color: var(--color-valor); font-size: var(--text-lectura); font-weight: 600; }
    .estado--denso .estado__titulo { margin: 0; font-size: var(--text-cuerpo); }
    .estado--denso .estado__accion { margin-top: .5rem; }
    .estado--error .estado__titulo { color: inherit; }
    .estado__detalle { margin: 0; max-width: 34rem; font-size: var(--text-cuerpo); line-height: 1.5; }
    .estado__accion { margin-top: .75rem; display: flex; gap: .5rem; }
    .estado__accion:empty { display: none; }
  `],
  template: `
    @if (tipo() === 'cargando') {
      <!-- CARGAR ES MOSTRAR LA FORMA DE LA LISTA, no un círculo girando (decisión 117). El título es el texto del lector. -->
      <app-esqueleto [variante]="denso() ? 'encabezado' : 'fila'" [cantidad]="denso() ? 1 : 4" [etiqueta]="titulo()" />
    } @else {
      <div class="estado" [class.estado--error]="tipo() === 'error'" [class.estado--denso]="denso()"
           [attr.role]="tipo() === 'error' ? 'alert' : 'status'">
        <span class="estado__icono" aria-hidden="true">
          @switch (tipo()) {
            @case ('error') { <svg lucideCircleAlert [size]="denso() ? 18 : 22"></svg> }
            @default { <svg lucideInbox [size]="denso() ? 18 : 22"></svg> }
          }
        </span>
        <p class="estado__titulo">{{ titulo() }}</p>
        @if (detalle()) { <p class="estado__detalle">{{ detalle() }}</p> }
        <div class="estado__accion"><ng-content /></div>
      </div>
    }
  `,
})
export class EstadoDeListaComponent {
  readonly tipo = input<'vacio' | 'cargando' | 'error'>('vacio');
  readonly titulo = input.required<string>();
  readonly detalle = input<string | null | undefined>(null);

  /** Para sublistas dentro de una ficha: sin el aire de una lista de pantalla completa, y a la izquierda. */
  readonly denso = input(false, { transform: booleanAttribute });
}
