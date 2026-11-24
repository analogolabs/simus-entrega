import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideChartColumn, LucideMap } from '@lucide/angular';

export type VistaDelMapa = 'mapa' | 'grafico';

/**
 * Mapa / Gráfico como DOS ICONOS (M-2): sutiles, sin borde propio ni relleno fuerte.
 *
 * <b>POR QUE LOCAL Y NO EL SELECTOR COMUN.</b> Los criterios comunes mandan que el conmutador de vista
 * use `app-selector-segmentado` con el modo solo-icono que añade L2 (carril de búsqueda y filtros), y
 * ese modo aún no existe en `main`. Esta pieza lo anticipa con el mismo contrato (opción con icono,
 * `aria-label` y `title` obligatorios, elegida = fondo suave + icono morado) y SE MIGRA al selector
 * común cuando L2 lo fusione: es borrar este fichero y cambiar una línea de la plantilla.
 *
 * Cada botón mide 36 px (área de trabajo), lleva su nombre como `aria-label` y `title`, y marca la
 * vista puesta con `aria-pressed`. El icono nunca es la única señal: el nombre accesible es el texto.
 */
@Component({
  selector: 'app-selector-de-vista-del-mapa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChartColumn, LucideMap],
  styles: [':host { display: inline-flex; }'],
  template: `
    <div class="inline-flex gap-0.5 rounded-[var(--radius-control,0.5rem)] bg-white/90 p-0.5 shadow-sm backdrop-blur-sm" role="group" [attr.aria-label]="etiquetaDelGrupo()">
      @for (vista of vistas; track vista.id) {
        <button type="button" [attr.data-opcion]="vista.id" [attr.aria-label]="vista.nombre" [attr.title]="vista.nombre"
          [attr.aria-pressed]="elegida() === vista.id" (click)="elegir.emit(vista.id)"
          [class]="'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[calc(var(--radius-control,0.5rem)-2px)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-foco)] ' +
            (elegida() === vista.id ? 'bg-slate-100 text-morado' : 'text-slate-500 hover:bg-slate-50 hover:text-morado')">
          @switch (vista.id) {
            @case ('mapa') { <svg lucideMap [size]="18" aria-hidden="true"></svg> }
            @default { <svg lucideChartColumn [size]="18" aria-hidden="true"></svg> }
          }
        </button>
      }
    </div>
  `,
})
export class SelectorDeVistaDelMapaComponent {
  readonly elegida = input.required<VistaDelMapa>();
  readonly etiquetaDelGrupo = input('Cómo se mira lo que está puesto');
  readonly elegir = output<VistaDelMapa>();

  protected readonly vistas: readonly { id: VistaDelMapa; nombre: string }[] = [
    { id: 'mapa', nombre: 'Mapa' },
    { id: 'grafico', nombre: 'Gráfico' },
  ];
}
