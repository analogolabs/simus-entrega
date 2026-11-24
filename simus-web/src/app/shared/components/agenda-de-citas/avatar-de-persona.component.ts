import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Pares de fondo y letra con contraste AA (≥ 4,5:1) para las iniciales. */
const PALETA: readonly (readonly [string, string])[] = [
  ['#ede4f7', '#3b1d5a'], ['#dcf3ea', '#0f5132'], ['#fde8d3', '#7a3a05'], ['#dbeafe', '#1e3a8a'],
  ['#fce7f3', '#831843'], ['#fef3c7', '#78350f'], ['#e0f2f1', '#134e4a'],
];

/**
 * La cara de una persona o de una entidad: su foto si la tiene y, si no, sus iniciales sobre un color estable
 * (el mismo nombre siempre da el mismo color). Es decorativa: el nombre ya va escrito al lado, así que no se anuncia.
 */
@Component({
  selector: 'app-avatar-de-persona',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: inline-flex; flex: none; }
    .avatar { display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; overflow: hidden; font-weight: 700; font-family: var(--font-alternate, inherit); }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
  `],
  template: `
    <span class="avatar" aria-hidden="true" [style.width.rem]="medida()" [style.height.rem]="medida()" [style.font-size.rem]="medida() * 0.38"
          [style.background]="fondo()" [style.color]="letra()">
      @if (fotoUrl()) { <img [src]="fotoUrl()" alt="" loading="lazy" width="64" height="64" /> } @else { {{ iniciales() }} }
    </span>
  `,
})
export class AvatarDePersonaComponent {
  readonly nombre = input.required<string>();
  readonly fotoUrl = input<string | null>(null);
  /** Alto y ancho en rem. */
  readonly medida = input(2.5);

  private readonly par = computed(() => {
    let h = 0;
    for (const c of this.nombre()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return PALETA[h % PALETA.length];
  });
  protected readonly fondo = computed(() => this.par()[0]);
  protected readonly letra = computed(() => this.par()[1]);
  protected readonly iniciales = computed(() => {
    const partes = this.nombre().trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  });
}
