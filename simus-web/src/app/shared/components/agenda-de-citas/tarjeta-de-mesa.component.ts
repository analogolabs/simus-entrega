import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AvatarDePersonaComponent } from './avatar-de-persona.component';

/**
 * La COSA de la agenda: una mesa o un stand como entidad visual, con quién la ocupa y cuánto de su horario está tomado. Sirve a las dos modalidades:
 * el stand fijo es de un artista o de un comprador o booker, según quién rote. Una mesa sin ocupante se dice sin ocupante, no se esconde.
 */
@Component({
  selector: 'app-tarjeta-de-mesa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarDePersonaComponent],
  styles: [`
    :host { display: block; }
    .mesa { display: flex; flex-direction: column; gap: .5rem; height: 100%; }
    .mesa__lugar { display: flex; align-items: center; gap: .6rem; }
    .mesa__icono { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: .6rem; background: var(--color-morado); color: #fff; flex: none; }
    .mesa__icono svg { width: 1.4rem; height: 1.4rem; }
    .mesa__icono--vacia { background: var(--color-morado-100); color: var(--color-morado-claro); }
    .barra { height: .4rem; border-radius: 9999px; background: var(--color-morado-100); overflow: hidden; }
    .barra > span { display: block; height: 100%; background: var(--color-avance); transition: width var(--dur-media); }
    .barra.llena > span { background: var(--color-atencion-fuerte); }
    @media (prefers-reduced-motion: reduce) { .barra > span { transition: none; } }
  `],
  template: `
    <div class="mesa">
      <div class="mesa__lugar">
        <span class="mesa__icono" [class.mesa__icono--vacia]="!ocupante()" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-1.5-5h-15z"/><path d="M5 9v11M19 9v11M5 14h14"/></svg>
        </span>
        <p class="text-lectura font-bold" [class.text-valor]="!!espacio()" [class.text-prosa]="!espacio()" data-testid="mesa-nombre">{{ espacio() || (tipo() === 'stand' ? 'Stand sin asignar' : 'Mesa sin asignar') }}</p>
      </div>
      @if (ocupante()) {
        <p class="flex items-center gap-2 text-cuerpo text-prosa">
          <app-avatar-de-persona [nombre]="ocupante()!" [fotoUrl]="fotoUrl()" [medida]="2" />
          <span class="min-w-0"><strong class="block truncate text-valor" [attr.title]="ocupante()">{{ ocupante() }}</strong>@if (entidad()) { <span class="block truncate" [attr.title]="entidad()">{{ entidad() }}</span> }</span>
        </p>
      } @else { <p class="text-cuerpo text-prosa">Sin ocupante: asigna esta mesa a quien recibe las citas.</p> }
      <p class="text-dato text-prosa" data-testid="mesa-ocupacion">{{ ocupadas() }} de {{ total() }} franjas ocupadas@if (completa()) { · <strong class="text-valor">Completa</strong> }</p>
      <div class="barra" [class.llena]="completa()" aria-hidden="true"><span [style.width.%]="porcentaje()"></span></div>
    </div>
  `,
})
export class TarjetaDeMesaComponent {
  readonly espacio = input<string | null>(null);
  /** Qué es el sitio: un stand (artistas) o una mesa (compradores). */
  readonly tipo = input<'mesa' | 'stand'>('mesa');
  readonly ocupante = input<string | null>(null);
  readonly entidad = input<string | null>(null);
  readonly fotoUrl = input<string | null>(null);
  readonly ocupadas = input(0);
  readonly total = input(0);
  protected readonly porcentaje = computed(() => this.total() ? Math.min(100, Math.round(this.ocupadas() * 100 / this.total())) : 0);
  protected readonly completa = computed(() => this.total() > 0 && this.ocupadas() >= this.total());
}
