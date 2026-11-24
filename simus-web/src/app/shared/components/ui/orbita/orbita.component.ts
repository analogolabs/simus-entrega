import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, computed, inject, input } from '@angular/core';

/** Los colores expresivos de SIMUS, más el morado para lo institucional. */
export type ColorDeOrbita = 'magenta' | 'cian' | 'amarillo' | 'morado';

const HEX: Record<ColorDeOrbita, string> = {
  magenta: '#FF053F',
  cian: '#00B6DD',
  amarillo: '#FFBD00',
  morado: '#4C2C54',
};

/**
 * ÓRBITA SIMUS: el recurso gráfico del sistema, tomado de la geometría del logotipo.
 *
 * Su principio es «círculo + interrupción + arco + desplazamiento + superposición», y se usa a
 * distintas escalas:
 *
 * - `heroe`: enorme y parcialmente fuera de la pantalla, en el encabezado de la portada. Aros
 *   tenues interrumpidos y tres arcos de color (magenta, cian, amarillo) desplazados entre sí.
 * - `acento`: un aro de 28 px con un arco de un solo color.
 *
 * MOVIMIENTO DEL `heroe`, SUTIL Y BARATO. Dos capas:
 * - Cada arco de color oscila en su aro alrededor de su posición inicial (entre 15 y 22 grados, en
 *   ciclos de 15 a 26 s, desfasados). Es un vaivén y no un giro completo: la órbita está en parte
 *   fuera de la pantalla, y una vuelta entera sacaba los arcos de la vista. Así los tres colores se
 *   ven siempre. Animación CSS de `transform`: la hace el compositor, sin JavaScript.
 * - Al mover el puntero sobre el contenedor, las capas se desplazan unos pocos píxeles a ritmos
 *   distintos (parallax). El cálculo va fuera de Angular y una vez por cuadro.
 * Con «reducir movimiento» activado en el sistema no se mueve nada.
 */
@Component({
  selector: 'app-orbita',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'block' },
  styles: [`
    .giro { transform-box: view-box; transform-origin: 500px 500px; animation: orbita-vaiven ease-in-out infinite alternate; }
    .giro--lento { --amplitud: 15deg; animation-duration: 26s; }
    .giro--medio { --amplitud: 22deg; animation-duration: 19s; animation-delay: -7s; }
    .giro--rapido { --amplitud: 18deg; animation-duration: 15s; animation-delay: -4s; }
    :host(.fuera) .giro { animation-play-state: paused; }
    .capa { transition: transform 1.2s cubic-bezier(.2,.7,.2,1); }
    .capa--fondo { transform: translate(calc(var(--px, 0) * 6px), calc(var(--py, 0) * 6px)); }
    .capa--media { transform: translate(calc(var(--px, 0) * 14px), calc(var(--py, 0) * 14px)); }
    .capa--frente { transform: translate(calc(var(--px, 0) * 24px), calc(var(--py, 0) * 24px)); }
    @keyframes orbita-vaiven { from { transform: rotate(calc(var(--amplitud) * -1)); } to { transform: rotate(var(--amplitud)); } }
    @media (prefers-reduced-motion: reduce) {
      .giro { animation: none; }
      .capa { transition: none; transform: none; }
    }
  `],
  template: `
    @if (variante() === 'heroe') {
      <svg viewBox="0 0 1000 1000" class="h-full w-full overflow-visible">
        <!-- Fondo: aros tenues interrumpidos y la banda ancha del morado profundo -->
        <g class="capa capa--fondo">
          <circle cx="500" cy="500" r="460" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2" pathLength="100" stroke-dasharray="82 18" transform="rotate(-30 500 500)" />
          <circle cx="500" cy="500" r="340" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2" pathLength="100" stroke-dasharray="70 30" transform="rotate(120 500 500)" />
          <circle cx="500" cy="500" r="220" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2" />
          <circle cx="540" cy="470" r="400" fill="none" stroke="#3B2242" stroke-width="90" pathLength="100" stroke-dasharray="58 42" transform="rotate(150 540 470)" />
          <circle cx="500" cy="500" r="96" fill="#3B2242" />
        </g>
        <!-- Arcos de color: cada uno oscila en su aro, a su ritmo, sin salir de la vista -->
        <g class="capa capa--media">
          <g class="giro giro--lento">
            <circle cx="500" cy="500" r="460" fill="none" stroke="#FF053F" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="16 84" transform="rotate(200 500 500)" />
          </g>
          <g class="giro giro--medio">
            <circle cx="500" cy="500" r="340" fill="none" stroke="#00B6DD" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="22 78" transform="rotate(20 500 500)" />
          </g>
        </g>
        <g class="capa capa--frente">
          <g class="giro giro--rapido">
            <circle cx="500" cy="500" r="220" fill="none" stroke="#FFBD00" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="12 88" transform="rotate(255 500 500)" />
            <circle cx="742" cy="270" r="18" fill="#FFBD00" />
          </g>
        </g>
      </svg>
    } @else {
      <svg viewBox="0 0 28 28" class="h-7 w-7">
        <circle cx="14" cy="14" r="11" fill="none" [attr.stroke]="tenue()" stroke-width="2.5" />
        <circle cx="14" cy="14" r="11" fill="none" [attr.stroke]="hex()" stroke-width="2.5" stroke-linecap="round" pathLength="100" stroke-dasharray="32 68" transform="rotate(-90 14 14)" />
      </svg>
    }
  `,
})
export class OrbitaComponent implements AfterViewInit, OnDestroy {
  readonly variante = input<'heroe' | 'acento'>('acento');
  readonly color = input<ColorDeOrbita>('morado');
  /** Sobre fondos oscuros el aro de base va en blanco translúcido. */
  readonly sobreOscuro = input(false);

  protected readonly hex = computed(() => HEX[this.color()]);
  protected readonly tenue = computed(() => (this.sobreOscuro() ? 'rgba(255,255,255,0.18)' : '#E3DFE4'));

  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zona = inject(NgZone);
  private soltar: (() => void) | null = null;
  private observador: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    if (this.variante() !== 'heroe' || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // El puntero se escucha en el contenedor (el encabezado), no en la órbita, que no recibe
    // eventos. Fuera de Angular: mover el ratón no dispara detección de cambios.
    const contenedor = this.anfitrion.nativeElement.parentElement;
    const svg = this.anfitrion.nativeElement;
    if (!contenedor) return;
    // Fuera de pantalla la animación se pausa: no hay razón para mover 3 arcos que nadie ve.
    if (typeof IntersectionObserver !== 'undefined') {
      this.observador = new IntersectionObserver(([e]) => svg.classList.toggle('fuera', !e.isIntersecting));
      this.observador.observe(svg);
    }
    let pendiente = 0;
    const mover = (e: PointerEvent) => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(() => {
        pendiente = 0;
        const r = contenedor.getBoundingClientRect();
        svg.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        svg.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
    };
    const salir = () => { svg.style.setProperty('--px', '0'); svg.style.setProperty('--py', '0'); };
    this.zona.runOutsideAngular(() => {
      contenedor.addEventListener('pointermove', mover, { passive: true });
      contenedor.addEventListener('pointerleave', salir, { passive: true });
    });
    this.soltar = () => {
      contenedor.removeEventListener('pointermove', mover);
      contenedor.removeEventListener('pointerleave', salir);
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    this.soltar?.();
  }
}
