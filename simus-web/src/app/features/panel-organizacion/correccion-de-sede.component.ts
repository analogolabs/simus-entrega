import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { SedeDelServidor } from '../../core/territorio/sede-principal';
import { UbicacionDivipola } from '../../core/territorio/ubicacion-divipola';
import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { SedeElegida, SelectorDeSedeComponent } from '../../shared/components/ui/selector-de-sede/selector-de-sede.component';
import { FalloDelServidor, PanelOrganizacionApi } from './panel-organizacion.api';

/**
 * COMPLETAR O CORREGIR LA SEDE PRINCIPAL DE LO PUBLICADO (decisión 119): una errata, con el selector común.
 *
 * Un Festival o un Mercado publicado no se edita directamente, pero su sede sí se corrige al instante: no lo
 * devuelve a revisión y queda en el registro de cambios.
 */
@Component({
  selector: 'app-correccion-de-sede',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SelectorDeSedeComponent, BotonNativoDirective],
  template: `
    <div class="space-y-2" data-testid="correccion-de-sede">
      <h4 class="text-sm font-bold text-slate-900">Sede principal</h4>
      <p class="text-xs text-slate-500">Se corrige al instante, sin devolver a revisión: queda en el registro de cambios.</p>
      <app-selector-de-sede [idBase]="'sede-' + tipo()" [ubicaciones]="ubicaciones()"
        [departamento]="departamento()" [municipio]="municipio()"
        [errorDepartamento]="errorDepartamento()" [errorMunicipio]="errorMunicipio()" (cambiar)="elegir($event)" />
      <button type="button" appBoton="secundaria" data-testid="guardar-sede" [disabled]="guardando() || !completa() || !cambio()" (click)="guardar()">
        {{ guardando() ? 'Guardando…' : 'Guardar sede' }}
      </button>
      @if (aviso()) { <p class="text-xs font-medium text-slate-700" role="status">{{ aviso() }}</p> }
      @if (error()) { <p class="text-xs font-medium text-red-700" role="alert">{{ error() }}</p> }
    </div>
  `,
})
export class CorreccionDeSedeComponent {
  private readonly api = inject(PanelOrganizacionApi);

  readonly tipo = input.required<'festivales' | 'mercados'>();
  readonly procesoId = input.required<string>();
  readonly ubicaciones = input.required<readonly UbicacionDivipola[]>();
  readonly sede = input<SedeDelServidor | null | undefined>(null);
  readonly corregida = output<SedeDelServidor | null>();

  private readonly elegida = signal<SedeElegida | null>(null);
  readonly guardando = signal(false);
  readonly aviso = signal('');
  readonly error = signal('');
  readonly errorDepartamento = signal<string | null>(null);
  readonly errorMunicipio = signal<string | null>(null);

  readonly departamento = computed(() => this.elegida()?.departamento ?? this.sede()?.codigoDepartamento ?? '');
  readonly municipio = computed(() => this.elegida()?.municipio ?? this.sede()?.codigoMunicipio ?? '');
  readonly completa = computed(() => !!this.departamento() && !!this.municipio());
  readonly cambio = computed(() => this.elegida() !== null);

  elegir(sede: SedeElegida): void {
    this.elegida.set(sede);
    this.aviso.set(''); this.error.set(''); this.errorDepartamento.set(null); this.errorMunicipio.set(null);
  }

  guardar(): void {
    if (!this.completa() || this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    this.api.corregirSede(this.tipo(), this.procesoId(), {
      sedeCodigoDepartamento: this.departamento(), sedeCodigoMunicipio: this.municipio(),
    }).subscribe({
      next: sede => {
        this.guardando.set(false);
        this.elegida.set(null);
        this.aviso.set('La sede quedó guardada.');
        this.corregida.emit(sede);
      },
      error: (fallo: FalloDelServidor) => {
        this.guardando.set(false);
        const errores = fallo?.payload?.errors ?? {};
        this.errorDepartamento.set(errores['sedeCodigoDepartamento']?.[0] ?? null);
        this.errorMunicipio.set(errores['sedeCodigoMunicipio']?.[0] ?? null);
        this.error.set(this.errorDepartamento() || this.errorMunicipio() ? 'Revisa la sede.' : (fallo?.message ?? 'No fue posible guardar la sede.'));
      },
    });
  }
}
