import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucidePause, LucidePlay } from '@lucide/angular';

/** Una imagen de la galería de una edición, tal como llega de la API. */
export interface ImagenDeGaleria {
  readonly archivoId: number;
  readonly url: string;
  readonly textoAlternativo: string;
  readonly credito: string | null;
}

/** Lo que tarda cada imagen antes de pasar a la siguiente cuando el pase automático está encendido. */
export const MS_POR_IMAGEN = 8000;

/**
 * LA GALERÍA DE UNA EDICIÓN: IMÁGENES GRANDES QUE CAMBIAN, NO UN MOSAICO.
 *
 * Una imagen a la vez en un marco de proporción fija (no hay saltos de alto aunque haya fotos verticales), con flechas,
 * indicadores, miniaturas, teclado (flechas, Inicio y Fin con el foco en la galería) y deslizamiento en pantalla táctil.
 *
 * <b>MOVIMIENTO.</b> El pase automático solo arranca si la persona no pidió reducir el movimiento (`prefers-reduced-motion`),
 * es lento (8 s por imagen), se detiene al pasar el puntero o enfocar la galería, y tiene un botón visible de
 * pausa (WCAG 2.2.2). Si la persona cambia de imagen a mano, el pase se detiene para siempre en esa visita.
 */
@Component({
  selector: 'app-galeria-celebra',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideChevronLeft, LucideChevronRight, LucidePause, LucidePlay],
  styles: [`
    :host { display: block; }
    .gal { display: grid; gap: 1rem; }
    .gal__marco { position: relative; overflow: hidden; border-radius: .75rem; background: var(--cl-secundario); aspect-ratio: 16 / 9; touch-action: pan-y; }
    @media (max-width: 639.98px) { .gal__marco { aspect-ratio: 4 / 3; } }
    .gal__marco:focus-visible { outline: 3px solid var(--color-foco, #5b2a86); outline-offset: 3px; }
    .gal__pista { display: flex; height: 100%; transition: transform .5s cubic-bezier(.2, .7, .2, 1); }
    @media (prefers-reduced-motion: reduce) { .gal__pista { transition: none; } }
    .gal__diapositiva { flex: none; width: 100%; height: 100%; display: grid; place-items: center; margin: 0; }
    .gal__imagen { width: 100%; height: 100%; object-fit: contain; user-select: none; -webkit-user-drag: none; }
    .gal__flecha {
      position: absolute; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 2.75rem; height: 2.75rem;
      border: 0; border-radius: .5rem; background: rgb(255 255 255 / .92); color: #1b1230; cursor: pointer;
    }
    .gal__flecha:hover { background: #fff; }
    .gal__flecha:focus-visible, .gal__control:focus-visible, .gal__mini:focus-visible, .gal__punto:focus-visible { outline: 3px solid var(--color-foco, #5b2a86); outline-offset: 2px; }
    .gal__flecha--ant { left: .75rem; } .gal__flecha--sig { right: .75rem; }
    .gal__barra { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem 1.5rem; }
    .gal__puntos { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem; margin: 0; padding: 0; list-style: none; }
    .gal__punto { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border: 0; background: transparent; cursor: pointer; }
    .gal__punto::before { content: ''; width: 1.5rem; height: .375rem; border-radius: .125rem; background: color-mix(in srgb, var(--cl-principal) 30%, #fff); }
    .gal__punto[aria-current='true']::before { background: var(--cl-tinta); }
    .gal__control { display: inline-flex; align-items: center; gap: .5rem; min-height: 2.75rem; padding: .5rem 1rem; border: 2px solid var(--cl-tinta); border-radius: .5rem; background: transparent; color: var(--cl-tinta); font: inherit; font-weight: 800; cursor: pointer; }
    .gal__control:hover { background: var(--cl-tinte); }
    .gal__minis { display: grid; grid-auto-flow: column; grid-auto-columns: 7rem; gap: .5rem; margin: 0; padding: .25rem; list-style: none; overflow-x: auto; scrollbar-width: thin; }
    .gal__mini { display: block; width: 100%; padding: 0; border: 2px solid transparent; border-radius: .5rem; overflow: hidden; background: var(--cl-secundario); cursor: pointer; aspect-ratio: 16 / 10; opacity: .75; }
    .gal__mini:hover { opacity: 1; }
    .gal__mini[aria-current='true'] { border-color: var(--cl-tinta); opacity: 1; }
    .gal__mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .gal__pie { min-height: 2.75rem; }
  `],
  template: `
    <section class="gal" aria-roledescription="carrusel" [attr.aria-label]="'Galería de imágenes'" data-testid="galeria"
      (mouseenter)="enPausaPorPuntero.set(true)" (mouseleave)="enPausaPorPuntero.set(false)">
      <div class="gal__marco" tabindex="0" role="group" [attr.aria-label]="'Imagen ' + (indice() + 1) + ' de ' + imagenes().length"
        (keydown)="alTeclear($event)" (focusin)="enPausaPorFoco.set(true)" (focusout)="enPausaPorFoco.set(false)"
        (pointerdown)="alPulsar($event)" (pointerup)="alSoltar($event)" (pointercancel)="inicioX = null">
        <div class="gal__pista" [style.transform]="'translateX(-' + indice() * 100 + '%)'" aria-live="off">
          @for (g of imagenes(); track g.archivoId; let i = $index) {
            <figure class="gal__diapositiva" role="group" aria-roledescription="imagen" [attr.aria-hidden]="i !== indice()" [attr.inert]="i !== indice() ? '' : null">
              <img class="gal__imagen" width="1280" height="720" [src]="g.url" [alt]="g.textoAlternativo" draggable="false" [attr.loading]="i === 0 ? null : 'lazy'" />
            </figure>
          }
        </div>
        @if (imagenes().length > 1) {
          <button type="button" class="gal__flecha gal__flecha--ant" aria-label="Imagen anterior" (click)="ir(indice() - 1, true)"><svg lucideChevronLeft [size]="22" aria-hidden="true"></svg></button>
          <button type="button" class="gal__flecha gal__flecha--sig" aria-label="Imagen siguiente" (click)="ir(indice() + 1, true)"><svg lucideChevronRight [size]="22" aria-hidden="true"></svg></button>
        }
      </div>

      <p class="gal__pie tipo-pequeno text-tinta-media [overflow-wrap:anywhere]" aria-live="polite" data-testid="galeria-pie">
        <span class="tabular-nums font-bold">{{ indice() + 1 }} / {{ imagenes().length }}</span>
        @if (actual().credito) { · {{ actual().credito }} }
      </p>

      @if (imagenes().length > 1) {
        <div class="gal__barra">
          <ul class="gal__puntos" aria-label="Elegir imagen">
            @for (g of imagenes(); track g.archivoId; let i = $index) {
              <li><button type="button" class="gal__punto" [attr.aria-current]="i === indice()" [attr.aria-label]="'Ir a la imagen ' + (i + 1)" (click)="ir(i, true)"></button></li>
            }
          </ul>
          @if (puedeAutoavanzar()) {
            <button type="button" class="gal__control" (click)="alternarPase()" data-testid="galeria-pase">
              @if (!pausadaPorPersona()) { <svg lucidePause [size]="16" aria-hidden="true"></svg>Pausar el pase automático }
              @else { <svg lucidePlay [size]="16" aria-hidden="true"></svg>Reanudar el pase automático }
            </button>
          }
        </div>
        <ul class="gal__minis" aria-label="Miniaturas">
          @for (g of imagenes(); track g.archivoId; let i = $index) {
            <li><button type="button" class="gal__mini" [attr.aria-current]="i === indice()" [attr.aria-label]="'Ver ' + g.textoAlternativo" (click)="ir(i, true)"><img [src]="g.url" alt="" width="112" height="70" loading="lazy" /></button></li>
          }
        </ul>
      }
    </section>
  `,
})
export class GaleriaCelebraComponent {
  readonly imagenes = input.required<readonly ImagenDeGaleria[]>();

  readonly indice = signal(0);
  readonly actual = computed(() => this.imagenes()[Math.min(this.indice(), this.imagenes().length - 1)]);

  readonly enPausaPorPuntero = signal(false);
  readonly enPausaPorFoco = signal(false);
  /** La persona detuvo el pase, o cambió de imagen a mano: no vuelve a avanzar solo. */
  readonly pausadaPorPersona = signal(false);

  /** El pase automático solo existe si la persona no pidió reducir el movimiento. */
  readonly puedeAutoavanzar = signal(
    typeof matchMedia === 'function' ? !matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );
  readonly pasando = computed(() => this.puedeAutoavanzar() && !this.pausadaPorPersona() && !this.enPausaPorPuntero() && !this.enPausaPorFoco());

  inicioX: number | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const destruir = inject(DestroyRef);
    // Un temporizador por imagen: se rearma con cada cambio y se apaga con cualquier pausa.
    effect(() => {
      this.limpiar();
      const n = this.imagenes().length;
      const i = this.indice();
      if (n > 1 && this.pasando()) {
        this.temporizador = setTimeout(() => this.indice.set((i + 1) % n), MS_POR_IMAGEN);
      }
    });
    destruir.onDestroy(() => this.limpiar());
  }

  private limpiar(): void {
    if (this.temporizador) { clearTimeout(this.temporizador); this.temporizador = null; }
  }

  /** Va a una imagen (circular). Si lo pide la persona, el pase automático se detiene. */
  ir(destino: number, porPersona: boolean): void {
    const n = this.imagenes().length;
    if (n === 0) { return; }
    this.indice.set(((destino % n) + n) % n);
    if (porPersona) { this.pausadaPorPersona.set(true); }
  }

  alternarPase(): void { this.pausadaPorPersona.update((p) => !p); }

  alTeclear(e: KeyboardEvent): void {
    const n = this.imagenes().length;
    switch (e.key) {
      case 'ArrowRight': this.ir(this.indice() + 1, true); break;
      case 'ArrowLeft': this.ir(this.indice() - 1, true); break;
      case 'Home': this.ir(0, true); break;
      case 'End': this.ir(n - 1, true); break;
      default: return;
    }
    e.preventDefault();
  }

  alPulsar(e: PointerEvent): void {
    // Los botones de las flechas llevan su propio clic.
    this.inicioX = (e.target as HTMLElement).closest('button') ? null : e.clientX;
  }

  alSoltar(e: PointerEvent): void {
    if (this.inicioX === null) { return; }
    const dx = e.clientX - this.inicioX;
    this.inicioX = null;
    if (Math.abs(dx) > 40) { this.ir(this.indice() + (dx < 0 ? 1 : -1), true); }
  }
}
