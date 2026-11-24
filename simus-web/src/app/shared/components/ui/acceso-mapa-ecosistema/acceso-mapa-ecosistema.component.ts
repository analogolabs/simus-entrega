import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideMap } from '@lucide/angular';

import { BotonNativoDirective } from '../boton/boton.component';
@Component({
  selector: 'app-acceso-mapa-ecosistema',
  standalone: true,
  imports: [BotonNativoDirective, LucideMap],
  template: `
    <div class="mt-8 border-t border-slate-200 pt-6 lg:mt-auto">
      <p class="mb-3 text-sm font-bold text-slate-600">Exploración territorial</p>
      <button type="button" data-testid="ir-al-mapa-festivales" (click)="activar.emit()" appBoton="secundaria" tamano="comodo" class="w-full"><svg lucideMap [size]="15"></svg>{{ etiqueta }}</button>
    </div>
  `,
})
export class AccesoMapaEcosistemaComponent {
  @Input() etiqueta = 'Ver registros en el mapa';
  @Output() activar = new EventEmitter<void>();
}
