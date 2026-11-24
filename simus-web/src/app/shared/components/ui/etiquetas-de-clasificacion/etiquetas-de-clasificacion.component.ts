import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NombrePropioPipe } from '../../../texto/nombre-propio.pipe';

/** Un elemento de clasificación (práctica musical o territorio sonoro) tal como llega del servidor. */
export interface ElementoClasificado { id: number | string; nombre: string }

/**
 * Las prácticas musicales y los territorios sonoros de un registro, SIEMPRE como etiquetas clicables que filtran.
 *
 * <b>UNA SOLA PIEZA PARA LOS CINCO DIRECTORIOS Y SUS FICHAS.</b> Antes cada proceso pintaba las suyas: en unos eran
 * botones, en otros enlaces y en otros texto muerto. Dos modos:
 * <ul>
 *   <li><b>`enlazar`</b> (fichas): cada etiqueta es un `<a href>` real al directorio (`ruta`) con `?practica=` o
 *   `?territorio=`; se puede abrir en otra pestaña.</li>
 *   <li><b>`filtrar`</b> (listados): cada etiqueta es un botón que acota la lista en pantalla (`aria-pressed` dice si ya
 *   filtra y volver a pulsarla lo quita).</li>
 * </ul>
 */
@Component({
  selector: 'app-etiquetas-de-clasificacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NombrePropioPipe],
  styles: [`
    :host { display: contents; }
    .e { display: inline-flex; align-items: center; max-width: 100%; min-height: 1.75rem; padding: 0 .65rem; border-radius: 999px;
      font-size: .75rem; line-height: 1.2; text-decoration: none; cursor: pointer; border: 0; transition: background-color .15s; }
    @media (pointer: coarse) { .e { min-height: var(--spacing-control-comodo, 2.75rem); } }
    .e:focus-visible { outline: 2px solid var(--color-foco, #4c2c54); outline-offset: 2px; }
    .p { background: rgb(76 44 84 / .08); color: #4c2c54; }
    .p:hover { background: rgb(76 44 84 / .18); }
    .t { background: #f5f3ff; color: #6d28d9; }
    .t:hover { background: #ede9fe; }
    .e[aria-pressed='true'] { font-weight: 700; box-shadow: inset 0 0 0 1px currentColor; }
  `],
  template: `
    @for (p of practicas(); track p.id) {
      @if (modo() === 'enlazar') {
        <a class="e p" data-etiqueta-practica [routerLink]="ruta()" [queryParams]="{ practica: p.nombre }"
           [attr.aria-label]="'Ver los registros con la práctica musical ' + p.nombre">{{ p.nombre }}</a>
      } @else {
        <button type="button" class="e p" data-etiqueta-practica (click)="practicaElegida.emit(p.nombre)"
          [attr.aria-pressed]="practicaActiva() === p.nombre"
          [attr.aria-label]="practicaActiva() === p.nombre ? 'Quitar el filtro por la práctica ' + p.nombre : 'Filtrar por la práctica musical ' + p.nombre">{{ p.nombre }}</button>
      }
    }
    @for (t of territorios(); track t.id) {
      @if (modo() === 'enlazar') {
        <a class="e t" data-etiqueta-territorio [routerLink]="ruta()" [queryParams]="{ territorio: t.nombre }"
           [attr.aria-label]="'Ver los registros del territorio sonoro ' + t.nombre">{{ t.nombre | nombrePropio }}</a>
      } @else {
        <button type="button" class="e t" data-etiqueta-territorio (click)="territorioElegido.emit(t.nombre)"
          [attr.aria-pressed]="territorioActivo() === t.nombre"
          [attr.aria-label]="territorioActivo() === t.nombre ? 'Quitar el filtro por el territorio ' + t.nombre : 'Filtrar por el territorio sonoro ' + t.nombre">{{ t.nombre | nombrePropio }}</button>
      }
    }
  `,
})
export class EtiquetasDeClasificacionComponent {
  readonly practicas = input<readonly ElementoClasificado[]>([]);
  readonly territorios = input<readonly ElementoClasificado[]>([]);
  readonly modo = input<'enlazar' | 'filtrar'>('filtrar');
  /** El directorio al que enlazan las etiquetas en modo `enlazar`. */
  readonly ruta = input<string>('/ecosistema');
  readonly practicaActiva = input('');
  readonly territorioActivo = input('');
  readonly practicaElegida = output<string>();
  readonly territorioElegido = output<string>();
}
