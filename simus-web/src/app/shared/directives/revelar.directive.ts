import { Directive, ElementRef, OnDestroy, OnInit, inject, input, signal } from '@angular/core';

/**
 * La aparición suave de un bloque cuando entra en pantalla: sube unos píxeles y se hace visible.
 *
 * <b>UNA SOLA VEZ Y SIN ESTORBAR.</b> Se observa el bloque hasta que entra y entonces se deja de
 * observar: un bloque que vuelve a esconderse al subir la página mueve el contenido bajo la mirada.
 * `[appRevelar]="ms"` (milisegundos de espera) escalona una lista: cada elemento entra un poco después del anterior.
 * La espera tiene tope (`TOPE_DE_RETARDO_MS`, el `--escalon-tope` de `styles.css`): el elemento 20 de una lista no espera
 * 1,4 s a que se le dé permiso de verse, entra con el sexto. Duración, distancia y curva salen de los tokens de movimiento.
 *
 * <b>SI NO HAY CÓMO ANIMAR, NO SE ESCONDE NADA.</b> Con «reducir movimiento» activado, o en un
 * navegador sin `IntersectionObserver`, el bloque nace visible. La clase `.revelar` (styles.css) es
 * lo único que lo oculta y solo se pone cuando la animación es posible, así que una página sin
 * JavaScript o una captura de pantalla nunca se queda en blanco.
 *
 * La variante `zoom` entra creciendo desde un 96 %, pensada para piezas grandes como el mapa.
 */
/** Espera máxima antes de aparecer, en ms. Igual que `--escalon-tope` de `styles.css`. */
export const TOPE_DE_RETARDO_MS = 420;

@Directive({
  selector: '[appRevelar]',
  standalone: true,
  host: {
    '[class.revelar]': 'animable',
    '[class.revelar--zoom]': "animable && revelarVariante() === 'zoom'",
    '[class.revelar--visto]': 'visto()',
    '[style.--retardo.ms]': 'appRevelar()',
  },
})
export class RevelarDirective implements OnInit, OnDestroy {
  /** Milisegundos de espera antes de aparecer; sirve para escalonar una lista. */
  readonly appRevelar = input(0, { transform: (v: number | string | '') => Math.min(Math.max(Number(v) || 0, 0), TOPE_DE_RETARDO_MS) });
  readonly revelarVariante = input<'subir' | 'zoom'>('subir');

  protected readonly visto = signal(false);
  protected readonly animable =
    typeof IntersectionObserver !== 'undefined' &&
    !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private observador: IntersectionObserver | null = null;

  ngOnInit(): void {
    if (!this.animable) {
      this.visto.set(true);
      return;
    }
    this.observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          this.visto.set(true);
          this.observador?.disconnect();
        }
      },
      // Entra un poco antes del borde inferior: aparece mientras se ve llegar, no ya a medias.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    this.observador.observe(this.elemento.nativeElement);
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }
}
