import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject, input } from '@angular/core';

/** Aire que se deja entre el panel y el borde de la ventana, y entre el panel y su disparador. */
const MARGEN_DE_VENTANA = 8;
const SEPARACION_DEL_DISPARADOR = 4;
/** Por debajo de esta altura un panel no es navegable: si no cabe debajo, se mira arriba. */
const ALTURA_MINIMA_UTIL = 160;

/**
 * Coloca un panel desplegable DENTRO DE LA VENTANA y anclado a su disparador (A-3).
 *
 * <b>EL DEFECTO QUE RESUELVE.</b> El panel de «Departamento» de la Agenda se pintaba con `position: absolute`
 * dentro de la barra lateral, que tiene `overflow-y: auto`: el panel quedaba recortado por la caja de la barra y
 * parecía «un cuadro dentro de un espacio», sin forma de recorrer departamentos y municipios. Un panel absoluto
 * vive en el espacio de su contenedor; un panel que debe poder salirse de él se calcula contra la ventana.
 *
 * <b>QUÉ HACE.</b> Pone el panel en `position: fixed` y le calcula, al abrirse y en cada desplazamiento o cambio de
 * tamaño de la ventana: el borde izquierdo (alineado con el disparador y empujado hacia dentro si no cabe), el
 * lado (debajo; arriba si debajo no cabe y arriba sí) y una `max-height` igual al espacio realmente disponible,
 * de modo que el contenido que sobra se recorre con scroll interno y nunca queda fuera de la ventana.
 *
 * <b>CORRIGE EL ORIGEN DEL `fixed`.</b> Dentro de un ancestro con `transform`, `filter` o `contain`, un elemento
 * `fixed` mide desde ese ancestro y no desde la ventana (pasa con las animaciones de entrada de los diálogos).
 * Se mide dónde cae realmente el punto (0, 0) y se resta, así que la posición es correcta también ahí.
 *
 * <b>LO QUE NO HACE.</b> No abre ni cierra, no mueve el foco y no escucha el teclado: eso es de la pieza que lo
 * usa. Tampoco fija la capa (`z-index`): la pone la hoja de la pieza con la escala de capas del portal.
 *
 * @example
 * <div class="panel" [appPanelAnclado]="disparador" > … </div>
 */
@Directive({
  selector: '[appPanelAnclado]',
  standalone: true,
  host: { style: 'position: fixed; box-sizing: border-box;' },
})
export class PanelAncladoDirective {
  /** El disparador al que se ancla el panel (normalmente el botón que lo abrió). */
  readonly appPanelAnclado = input.required<HTMLElement>();
  /** `true` para que el panel mida al menos lo que el disparador (el desplegable de un filtro). */
  readonly igualarAncho = input(true);

  private readonly panel = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zona = inject(NgZone);
  private pendiente = 0;

  constructor() {
    afterNextRender(() => {
      this.colocar();
      this.zona.runOutsideAngular(() => {
        const alMover = () => this.programar();
        // `capture`: el desplazamiento de un contenedor intermedio no burbujea hasta `window`.
        window.addEventListener('scroll', alMover, { capture: true, passive: true });
        window.addEventListener('resize', alMover, { passive: true });
        window.visualViewport?.addEventListener('resize', alMover, { passive: true });
        this.limpiar = () => {
          window.removeEventListener('scroll', alMover, { capture: true } as EventListenerOptions);
          window.removeEventListener('resize', alMover);
          window.visualViewport?.removeEventListener('resize', alMover);
          cancelAnimationFrame(this.pendiente);
        };
      });
    });
    inject(DestroyRef).onDestroy(() => this.limpiar());
  }

  private limpiar: () => void = () => undefined;

  private programar(): void {
    cancelAnimationFrame(this.pendiente);
    this.pendiente = requestAnimationFrame(() => this.colocar());
  }

  /** Recalcula la posición. Público para que la pieza lo pida cuando cambia su contenido (p. ej. al filtrar). */
  colocar(): void {
    const disparador = this.appPanelAnclado();
    const panel = this.panel;
    if (!disparador?.isConnected) { return; }
    const caja = disparador.getBoundingClientRect();
    const ventanaAlto = window.visualViewport?.height ?? window.innerHeight;
    const ventanaAncho = document.documentElement.clientWidth || window.innerWidth;

    // 1. Medir el panel «libre»: sin tope de altura y con el ancho que le toca.
    panel.style.maxHeight = 'none';
    panel.style.top = '0px';
    panel.style.left = '0px';
    if (this.igualarAncho()) { panel.style.minWidth = `${Math.round(caja.width)}px`; }
    const origen = panel.getBoundingClientRect(); // dónde cae (0, 0) de verdad: corrige ancestros con transform
    const alturaNatural = panel.scrollHeight + (panel.offsetHeight - panel.clientHeight);
    const ancho = Math.min(panel.offsetWidth, ventanaAncho - 2 * MARGEN_DE_VENTANA);

    // 2. Lado: debajo si cabe o si es donde hay más sitio; arriba si debajo no llega y arriba sí.
    const abajo = ventanaAlto - caja.bottom - SEPARACION_DEL_DISPARADOR - MARGEN_DE_VENTANA;
    // La barra superior fija del portal tapa los primeros píxeles de la ventana: el panel no debe abrirse debajo de ella.
    const barra = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--alto-barra-superior')) || 0;
    const arriba = caja.top - SEPARACION_DEL_DISPARADOR - MARGEN_DE_VENTANA - barra;
    const hacia: 'abajo' | 'arriba' = alturaNatural <= abajo || abajo >= ALTURA_MINIMA_UTIL || abajo >= arriba ? 'abajo' : 'arriba';
    const disponible = Math.max(96, Math.floor(hacia === 'abajo' ? abajo : arriba));
    const alto = Math.min(alturaNatural, disponible);

    // 3. Posición: alineado a la izquierda del disparador; si se sale por la derecha, se empuja hacia dentro.
    let izquierda = caja.left;
    if (izquierda + ancho > ventanaAncho - MARGEN_DE_VENTANA) { izquierda = ventanaAncho - MARGEN_DE_VENTANA - ancho; }
    izquierda = Math.max(MARGEN_DE_VENTANA, izquierda);
    const superior = hacia === 'abajo' ? caja.bottom + SEPARACION_DEL_DISPARADOR : caja.top - SEPARACION_DEL_DISPARADOR - alto;

    panel.style.maxHeight = `${disponible}px`;
    panel.style.left = `${Math.round(izquierda - origen.left)}px`;
    panel.style.top = `${Math.round(superior - origen.top)}px`;
    panel.dataset['lado'] = hacia;
  }
}
