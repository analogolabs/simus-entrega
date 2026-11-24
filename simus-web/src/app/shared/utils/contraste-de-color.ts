/**
 * Contraste de un color de la edición frente al texto que va encima (WCAG 2.x).
 *
 * LA PÁGINA ELIGE EL TEXTO Y LA CONSOLA AVISA. El micrositio de «Celebra la música» pinta su encabezado con un color
 * por edición; `textoLegibleSobre` escoge entre un negro violáceo y el blanco el que más contraste da, y
 * `razonDeContraste` dice cuánto es, para que la consola avise cuando ni el mejor de los dos llega a AA (4,5:1).
 */
const NEGRO_VIOLACEO = '#1B1230';
const BLANCO = '#FFFFFF';

export const CONTRASTE_MINIMO_AA = 4.5;

export function esColorHexadecimal(valor: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(valor.trim());
}

export function luminanciaRelativa(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) { return 0; }
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste entre dos colores hexadecimales, de 1 a 21. */
export function razonDeContraste(a: string, b: string): number {
  const [claro, oscuro] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** El texto (negro violáceo o blanco) que más contraste da sobre ese color. Sin color válido, blanco. */
export function textoLegibleSobre(hex: string): string {
  if (!esColorHexadecimal(hex)) { return BLANCO; }
  return razonDeContraste(hex, BLANCO) >= razonDeContraste(hex, NEGRO_VIOLACEO) ? BLANCO : NEGRO_VIOLACEO;
}

/** El mejor contraste que puede lograr el texto sobre ese color; menos de 4,5 significa que no cumple AA. */
export function mejorContrasteSobre(hex: string): number {
  if (!esColorHexadecimal(hex)) { return 21; }
  return Math.max(razonDeContraste(hex, BLANCO), razonDeContraste(hex, NEGRO_VIOLACEO));
}
