/**
 * Lleva el foco al primer campo con error: quien teclea con lector de pantalla o con
 * el teclado queda justo donde está el problema, y la vista se desplaza hasta él.
 *
 * <b>REINTENTA UNOS INSTANTES</b> porque el campo puede acabar de aparecer: se cambió de paso (el
 * error del servidor devuelve al paso 1 desde el 3) y Angular todavía no lo ha pintado cuando
 * vence el primer intento. Sin esto el foco se quedaba en el botón que se había pulsado.
 */
export function enfocarCampo(id: string, raiz: ParentNode = document, intentos = 15): void {
  setTimeout(() => {
    const destino = raiz.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!destino) {
      if (intentos > 0) enfocarCampo(id, raiz, intentos - 1);
      return;
    }
    destino.focus({ preventScroll: true });
    const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    destino.scrollIntoView?.({ block: 'center', behavior: reducido ? 'auto' : 'smooth' });
  }, intentos === 15 ? 0 : 30);
}
