import { Directive, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';

/**
 * Marca con la clase `hay-mas` un contenedor desplazable mientras le queda contenido por recorrer
 * hacia abajo, y se la quita cuando llega al final o cuando todo cabe.
 *
 * <b>POR QUÉ EXISTE (UI-01 de `docs/desarrollo/30-consola-y-acceso.md`).</b> La barra lateral de la consola avisaba de «hay más»
 * con cuatro degradados de desplazamiento pintados siempre sobre la lista: una sombra fija arriba y
 * otra abajo, que se leían como una pieza superpuesta («la barrita con sombra») y no como una señal.
 * La señal correcta es un desvanecido de 28 px al final y SOLO mientras queda lista por ver; esa
 * condición no se puede expresar en CSS, y esta directiva la calcula: al desplazar, al cambiar el
 * tamaño del contenedor y al plegar o desplegar un grupo (cambia el contenido sin cambiar la caja).
 *
 * No dibuja nada: solo pone o quita la clase. La presentación es de la hoja de cada pantalla.
 */
@Directive({
  selector: '[appIndicaMas]',
  standalone: true,
  host: { '(scroll)': 'actualizar()' },
})
export class IndicaMasDirective implements OnDestroy {
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private tamano: ResizeObserver | null = null;
  private contenido: MutationObserver | null = null;
  private cuadro = 0;

  constructor() {
    afterNextRender(() => {
      const elemento = this.anfitrion.nativeElement;
      if (typeof ResizeObserver !== 'undefined') {
        this.tamano = new ResizeObserver(() => this.programar());
        this.tamano.observe(elemento);
      }
      if (typeof MutationObserver !== 'undefined') {
        this.contenido = new MutationObserver(() => this.programar());
        this.contenido.observe(elemento, {
          childList: true,
          subtree: true,
          attributes: true,
          // Solo `hidden`: es lo que cambia al plegar un grupo. Observar `class` haría que la propia
          // clase que esta directiva pone volviera a disparar la medición.
          attributeFilter: ['hidden'],
        });
      }
      this.actualizar();
    });
  }

  /** Recalcula en el siguiente cuadro: varias mutaciones seguidas cuestan una sola medición. */
  private programar(): void {
    if (this.cuadro) return;
    this.cuadro = requestAnimationFrame(() => {
      this.cuadro = 0;
      this.actualizar();
    });
  }

  actualizar(): void {
    const elemento = this.anfitrion.nativeElement;
    const queda = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight > 2;
    elemento.classList.toggle('hay-mas', queda);
  }

  ngOnDestroy(): void {
    this.tamano?.disconnect();
    this.contenido?.disconnect();
    if (this.cuadro) cancelAnimationFrame(this.cuadro);
  }
}
