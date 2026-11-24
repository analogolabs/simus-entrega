import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { FotoDeGaleria, repartirEnFilas } from '../domain/galeria-modelo';

const SEPARACION = 6;

/**
 * EL MOSAICO JUSTIFICADO DE FOTOS con tope de filas (Galería, pestaña «Fotos»).
 *
 * Las filas se calculan según el ANCHO REAL del contenedor (no por un número fijo de fotos): cada fila se ajusta para llenar el ancho exacto y, con
 * `maxFilas`, solo se muestran esas filas completas; las demás fotos quedan en el álbum (`ocultas`). Si el álbum es tan corto que no llena las filas,
 * se muestra entero y su última fila queda a su alto natural.
 */
@Component({
  selector: 'app-galeria-muro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './galeria-muro.component.css',
  template: `
    <ul class="muro" [attr.aria-label]="etiqueta()" data-testid="galeria-muro">
      @for (c of reparto().celdas; track c.foto.id) {
        <li class="tile" [style.width.px]="c.ancho" [style.height.px]="c.alto">
          <button type="button" (click)="abrir.emit(c.foto)" [attr.aria-label]="'Abrir la foto: ' + (c.foto.titulo ?? c.foto.alt)" [attr.data-testid]="'foto-' + c.foto.id">
            <img [src]="c.foto.url" [alt]="c.foto.alt" [attr.width]="c.ancho" [attr.height]="c.alto" loading="lazy" decoding="async" />
            <span class="tile__pie">{{ c.foto.titulo ?? c.foto.alt }}</span>
          </button>
        </li>
      }
    </ul>
  `,
})
export class GaleriaMuroComponent {
  readonly fotos = input.required<readonly FotoDeGaleria[]>();
  /** Máximo de filas a mostrar (`null` = todas). */
  readonly maxFilas = input<number | null>(null);
  readonly etiqueta = input<string | null>(null);
  readonly abrir = output<FotoDeGaleria>();

  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ancho = signal(0);

  protected readonly reparto = computed(() => {
    const a = this.ancho();
    // En pantalla angosta las fotos son más bajas para que quepan dos o tres por fila.
    return repartirEnFilas(this.fotos(), a, a < 600 ? 140 : 210, SEPARACION, this.maxFilas());
  });
  /** Cuántas fotos quedan fuera de las filas mostradas. */
  readonly ocultas = computed(() => this.reparto().ocultas);

  constructor() {
    const destruccion = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.anfitrion.nativeElement;
      this.ancho.set(Math.floor(el.clientWidth));
      if (typeof ResizeObserver === 'undefined') return;
      const o = new ResizeObserver(() => this.ancho.set(Math.floor(el.clientWidth)));
      o.observe(el);
      destruccion.onDestroy(() => o.disconnect());
    });
  }
}
