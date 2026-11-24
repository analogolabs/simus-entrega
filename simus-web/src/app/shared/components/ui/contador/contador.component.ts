import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, signal } from '@angular/core';

/**
 * UNA CIFRA QUE SE CUENTA: cuando entra en pantalla sube de 0 a su valor en poco más de un segundo
 * (con frenado al final) y se queda en el número exacto. Se usa solo en las cifras destacadas de la
 * portada, donde el movimiento llama la atención sobre el dato.
 *
 * - Con «reducir movimiento», o sin `IntersectionObserver`, muestra el valor final de entrada.
 * - Si el valor cambia después (llegan los datos), se anima de nuevo desde lo que se mostraba.
 * - Antes de entrar en pantalla muestra el valor final, así que una captura o una persona sin
 *   JavaScript nunca ve un 0 engañoso.
 */
@Component({
  selector: 'app-contador',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ texto() }}`,
})
export class ContadorComponent {
  readonly valor = input.required<number>();
  readonly duracion = input(1200);

  protected readonly texto = signal('');
  private readonly visible = signal(false);
  private mostrado = 0;
  private marco = 0;
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const reducido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sinObservador = typeof IntersectionObserver === 'undefined';

    effect(() => {
      const objetivo = this.valor();
      if (reducido || sinObservador || !this.visible()) {
        this.mostrado = objetivo;
        this.texto.set(objetivo.toLocaleString('es-CO'));
        return;
      }
      this.animar(this.mostrado === objetivo ? 0 : this.mostrado, objetivo);
    });

    afterNextRender(() => {
      if (reducido || sinObservador) return;
      const obs = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) { this.visible.set(true); obs.disconnect(); }
      }, { threshold: 0.4 });
      obs.observe(this.el.nativeElement);
    });
    inject(DestroyRef).onDestroy(() => { if (this.marco) cancelAnimationFrame(this.marco); });
  }

  private animar(desde: number, hasta: number): void {
    if (this.marco) cancelAnimationFrame(this.marco);
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / this.duracion());
      const frenado = 1 - Math.pow(1 - t, 3);
      this.mostrado = Math.round(desde + (hasta - desde) * frenado);
      this.texto.set(this.mostrado.toLocaleString('es-CO'));
      this.marco = t < 1 ? requestAnimationFrame(paso) : 0;
    };
    this.marco = requestAnimationFrame(paso);
  }
}
