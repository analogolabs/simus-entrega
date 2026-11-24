/**
 * UNA SOLA REGLA PARA EL NIT DE UNA ORGANIZACIÓN (decisión 96 de docs/referencia/20-decisiones-y-flujos-por-modulo.md, 19 de noviembre de 2026).
 * El servidor aplica la misma (`NitColombiano` en `SIMUS.Api`): el campo admite el NIT de una persona
 * jurídica, nunca una cédula, y es opcional porque una organización sin personería jurídica se
 * identifica por su responsable.
 *
 * LA REGLA. Nueve dígitos que empiezan por 8 o 9, con el dígito de verificación opcional
 * (`900123456-8`, `900.123.456-8`, `9001234568` o `900123456`). Si se escribe el dígito de
 * verificación, tiene que ser el que calcula la DIAN (módulo 11, pesos 3, 7, 13, 17, 19, 23, 29, 37,
 * 41, 43, 47, 53, 59, 67, 71). Una cédula tiene entre 6 y 10 dígitos y ninguna es de nueve dígitos
 * que empiecen por 8 o 9, así que la forma separa un NIT de una cédula sin ambigüedad.
 */
const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export type ResultadoDeNit = 'vacio' | 'valido' | 'cedula' | 'digito' | 'formato';

/** El NIT que se muestra como ejemplo de fondo y en las ayudas: tiene que pasar `analizarNit` (lo exige una prueba). */
export const NIT_DE_EJEMPLO = '900123456-8';

export const AYUDA_DEL_NIT =
  'Solo si la organización tiene personería jurídica. Escríbelo con el dígito de verificación, por ejemplo 900123456-8. ' +
  'Si no la tiene, deja el campo vacío: se identifica por su responsable. No escribas una cédula.';

export const MENSAJE_DE_NIT_CEDULA =
  'Este campo es para el NIT de la organización (9 dígitos y dígito de verificación, por ejemplo 900123456-8), no para una cédula. ' +
  'Si la organización no tiene personería jurídica, deja el campo vacío: se identifica por su responsable.';
export const MENSAJE_DE_NIT_DIGITO =
  'El dígito de verificación no corresponde a este NIT. Revisa el número (por ejemplo 900123456-8) o escríbelo sin el dígito.';
export const MENSAJE_DE_NIT_FORMATO =
  'El NIT debe tener 9 dígitos y, si quieres, el dígito de verificación (por ejemplo 900123456-8). No lleva letras ni otros símbolos.';

/** Dígito de verificación de la DIAN para un NIT de nueve dígitos. */
export function digitoDeVerificacion(base: string): number {
  let suma = 0;
  for (let i = 0; i < base.length; i++) suma += Number(base[base.length - 1 - i]) * PESOS[i];
  const resto = suma % 11;
  return resto > 1 ? 11 - resto : resto;
}

export function analizarNit(valor: string | null | undefined): { resultado: ResultadoDeNit; canonico: string | null } {
  const texto = (valor ?? '').trim();
  if (!texto) return { resultado: 'vacio', canonico: null };
  if (!/^[\d.\- ]+$/.test(texto)) return { resultado: 'formato', canonico: null };

  const limpio = texto.replace(/[. ]/g, '');
  let base = limpio;
  let escrito: string | null = null;
  const guion = limpio.indexOf('-');
  if (guion >= 0) {
    if (limpio.lastIndexOf('-') !== guion || limpio.length - guion - 1 !== 1 || guion === 0) {
      return { resultado: 'formato', canonico: null };
    }
    base = limpio.slice(0, guion);
    escrito = limpio.slice(guion + 1);
  } else if (limpio.length === 10) {
    base = limpio.slice(0, 9);
    escrito = limpio.slice(9);
  }

  if (base.length === 9 && (base[0] === '8' || base[0] === '9')) {
    const dv = digitoDeVerificacion(base);
    if (escrito !== null && escrito !== String(dv)) return { resultado: 'digito', canonico: null };
    return { resultado: 'valido', canonico: `${base}-${dv}` };
  }
  return base.length >= 5 && base.length <= 11
    ? { resultado: 'cedula', canonico: null }
    : { resultado: 'formato', canonico: null };
}

/** El mensaje de error en español, o `null` si el valor está vacío o es un NIT válido. */
export function mensajeDeNit(valor: string | null | undefined): string | null {
  switch (analizarNit(valor).resultado) {
    case 'cedula': return MENSAJE_DE_NIT_CEDULA;
    case 'digito': return MENSAJE_DE_NIT_DIGITO;
    case 'formato': return MENSAJE_DE_NIT_FORMATO;
    default: return null;
  }
}
