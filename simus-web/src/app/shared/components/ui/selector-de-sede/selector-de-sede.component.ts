import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { departamentosDe, municipiosDe } from '../../../../core/territorio/sede-principal';
import { UbicacionDivipola } from '../../../../core/territorio/ubicacion-divipola';
import { ErrorDeCampoComponent } from '../error-de-campo/error-de-campo.component';
import { FiltroDesplegableComponent } from '../filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../filtro-desplegable/opciones-desde.pipe';

/** Lo que emite el selector: la sede entera, para que quien lo usa la guarde en su formulario. */
export interface SedeElegida {
  readonly departamento: string;
  readonly municipio: string;
}

/**
 * EL SELECTOR DE SEDE PRINCIPAL, UNO SOLO PARA LOS CINCO TIPOS DE PROCESO (decisión 119).
 *
 * Festival, Mercado, Taller, Espacio y Red llevan una sede con departamento y municipio, para situarlos
 * en el mapa aunque su cobertura sea nacional o departamental. La cobertura es otro dato y se pide
 * aparte. El departamento va primero; el municipio queda deshabilitado («Elige un departamento
 * primero») hasta que se elige, y al cambiar de departamento se vacía, porque un municipio de otro
 * departamento ya no es válido.
 *
 * Recibe las filas de DIVIPOLA que el formulario ya cargó: no pide nada por su cuenta.
 */
@Component({
  selector: 'app-selector-de-sede',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FiltroDesplegableComponent, OpcionesDesdePipe, ErrorDeCampoComponent],
  styles: [':host { display: block; }'],
  template: `
    <div class="grid gap-4 sm:grid-cols-2" data-selector-de-sede>
      <div>
        <label [for]="idBase() + '-sede-departamento'" class="block text-sm font-bold text-slate-900">Departamento {{ rotulo() }}</label>
        <app-filtro-desplegable completo tamano="comodo" [etiqueta]="'Departamento ' + rotulo()"
          [idDelControl]="idBase() + '-sede-departamento'" name="sedeDepartamento"
          [ngModel]="departamento()" (ngModelChange)="elegirDepartamento($event)"
          [deshabilitado]="deshabilitado()" [invalido]="!!errorDepartamento()"
          [descritoPorExterno]="idBase() + '-sede-departamento-error'"
          [opciones]="departamentos() | opcionesDesde:'codigo':'nombre':'Elige un departamento'" />
        <app-error-de-campo [identificador]="idBase() + '-sede-departamento-error'" [mensaje]="errorDepartamento()" />
      </div>
      <div>
        <label [for]="idBase() + '-sede-municipio'" class="block text-sm font-bold text-slate-900">Municipio {{ rotulo() }}</label>
        <app-filtro-desplegable completo tamano="comodo" [etiqueta]="'Municipio ' + rotulo()"
          [idDelControl]="idBase() + '-sede-municipio'" name="sedeMunicipio"
          [ngModel]="municipio()" (ngModelChange)="elegirMunicipio($event)"
          [deshabilitado]="deshabilitado() || !departamento()" [invalido]="!!errorMunicipio()"
          [descritoPorExterno]="idBase() + '-sede-municipio-error'"
          [opciones]="municipios() | opcionesDesde:'municipalityCode':'municipalityName':(departamento() ? 'Elige un municipio' : 'Elige un departamento primero')" />
        <app-error-de-campo [identificador]="idBase() + '-sede-municipio-error'" [mensaje]="errorMunicipio()" />
      </div>
    </div>
    @if (avisarPendiente() && (!departamento() || !municipio())) {
      <p class="mt-2 text-xs text-slate-500" data-sede-pendiente>Pendiente de completar: la sede hace falta para guardar y para enviar a revisión.</p>
    }
  `,
})
export class SelectorDeSedeComponent {
  readonly ubicaciones = input.required<readonly UbicacionDivipola[]>();
  readonly departamento = input<string>('');
  readonly municipio = input<string>('');
  /** Para que los `id` de dos selectores en una misma página no se repitan. */
  readonly idBase = input<string>('proceso');
  readonly deshabilitado = input(false);
  /**
   * Cómo se llama el lugar elegido: «de la sede» (procesos) o «de residencia» (datos personales de la
   * cuenta, que son opcionales y privados). Sale en las etiquetas de los dos campos.
   */
  readonly rotulo = input('de la sede');
  /** Con `false` no se pinta el aviso «Pendiente de completar»: para datos opcionales. */
  readonly avisarPendiente = input(true);
  readonly errorDepartamento = input<string | null>(null);
  readonly errorMunicipio = input<string | null>(null);

  readonly cambiar = output<SedeElegida>();

  readonly departamentos = computed(() => departamentosDe(this.ubicaciones()));
  readonly municipios = computed(() => municipiosDe(this.ubicaciones(), this.departamento()));

  elegirDepartamento(codigo: string): void {
    if (codigo === this.departamento()) return;
    this.cambiar.emit({ departamento: codigo ?? '', municipio: '' });
  }

  elegirMunicipio(codigo: string): void {
    this.cambiar.emit({ departamento: this.departamento(), municipio: codigo ?? '' });
  }
}
