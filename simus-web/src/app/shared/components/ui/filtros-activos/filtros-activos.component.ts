import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { BotonComponent } from '../boton/boton.component';
import { ChipDeFiltroComponent } from '../chip-de-filtro/chip-de-filtro.component';

/** Un filtro aplicado a la lista: lo que se ve y la clave con la que quien lo usa sabe cuál quitar. */
export interface FiltroActivo {
  /** Identifica el filtro (`dia`, `mes`, `rango`, `departamento`…). Es lo que se devuelve en `quitar`. */
  readonly clave: string;
  /** Qué se filtra: «Día», «Departamento». Opcional. */
  readonly rotulo?: string;
  /** El valor aplicado, ya legible: «12 de diciembre», «Casanare». */
  readonly valor: string;
}

/**
 * LOS FILTROS APLICADOS A UNA LISTA, CADA UNO CON SU «X», Y «LIMPIAR FILTROS» A LA VISTA (A-1).
 *
 * <b>EL DEFECTO.</b> En Agenda, al elegir un día no había forma de quitarlo desde donde se eligió: solo un «Limpiar
 * filtros» al fondo de la barra, que quien filtra no ve. Un filtro que se puede poner con un clic se quita con un
 * clic, y en el mismo lugar donde se ve que está puesto.
 *
 * <b>QUÉ PINTA.</b> Un chip por filtro activo (`app-chip-de-filtro`, con su «X» nombrada: «Quitar filtro Día: 12 de
 * diciembre») y, al final de la misma fila, «Limpiar filtros». La fila se coloca JUNTO A LOS FILTROS —justo bajo la
 * barra de búsqueda y desplegables—, no al pie de la página. Sin filtros activos no pinta nada y no ocupa espacio.
 * «Limpiar filtros» aparece desde el primer filtro, no desde el segundo: con uno solo, el chip ya lo quita, pero quien
 * busca «empezar de cero» no debe tener que contar.
 *
 * <b>LO QUE NO HACE.</b> No guarda estado: quien la usa tiene los filtros y los quita en `(quitar)` y `(limpiar)`.
 *
 * <b>TECLADO Y LECTOR.</b> El grupo se anuncia como «Filtros aplicados». Al quitar un chip el foco pasa al que ocupó
 * su lugar (o al anterior, o a «Limpiar filtros» si solo quedaba uno), para que quien navega con teclado no pierda su
 * sitio; y una región de estado anuncia «Filtro quitado» o «Filtros limpiados».
 *
 * @example
 *   <app-filtros-activos [filtros]="filtrosActivos()" (quitar)="quitarFiltro($event)" (limpiar)="limpiarFiltros()" />
 */
@Component({
  selector: 'app-filtros-activos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BotonComponent, ChipDeFiltroComponent],
  styles: [`
    :host { display: block; }
    .filtros-activos { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .5rem; }
    .filtros-activos__limpiar { margin-left: .25rem; }
  `],
  template: `
    @if (filtros().length > 0) {
      <div class="filtros-activos" role="group" [attr.aria-label]="etiquetaDelGrupo()" data-filtros-activos>
        @for (filtro of filtros(); track filtro.clave) {
          <app-chip-de-filtro [rotulo]="filtro.rotulo ?? null" [valor]="filtro.valor" (quitar)="alQuitar(filtro, $index)" />
        }
        <span class="filtros-activos__limpiar">
          <app-boton importancia="terciaria" tamano="menudo" identificador="limpiar-filtros" (accion)="alLimpiar()">Limpiar filtros</app-boton>
        </span>
      </div>
    }
    <span class="sr-only" role="status" aria-live="polite">{{ aviso() }}</span>
  `,
})
export class FiltrosActivosComponent {
  readonly filtros = input.required<readonly FiltroActivo[]>();
  /** El nombre del grupo para quien navega con lector de pantalla. */
  readonly etiquetaDelGrupo = input('Filtros aplicados');

  /** Se quita un filtro: llega su `clave`. */
  readonly quitar = output<string>();
  /** Se piden quitar todos. */
  readonly limpiar = output<void>();

  protected readonly aviso = signal('');
  private readonly anfitrion: ElementRef<HTMLElement> = inject(ElementRef);
  private indiceParaElFoco: number | null = null;

  constructor() {
    // Tras quitar un chip, el foco va al que ocupa su lugar; si no hay, al anterior; si no queda ninguno, al aviso.
    effect(() => {
      const total = this.filtros().length;
      untracked(() => {
        const indice = this.indiceParaElFoco;
        if (indice === null) { return; }
        this.indiceParaElFoco = null;
        queueMicrotask(() => {
          const quitar = Array.from(this.anfitrion.nativeElement.querySelectorAll<HTMLElement>('.chip__quitar'));
          const destino = quitar[Math.min(indice, quitar.length - 1)];
          destino?.focus();
          if (total === 0) { this.aviso.set('Filtros limpiados'); }
        });
      });
    });
  }

  protected alQuitar(filtro: FiltroActivo, indice: number): void {
    this.indiceParaElFoco = indice;
    this.aviso.set(`Filtro quitado: ${filtro.rotulo ? filtro.rotulo + ': ' : ''}${filtro.valor}`);
    this.quitar.emit(filtro.clave);
  }

  protected alLimpiar(): void {
    this.aviso.set('Filtros limpiados');
    this.limpiar.emit();
  }
}
