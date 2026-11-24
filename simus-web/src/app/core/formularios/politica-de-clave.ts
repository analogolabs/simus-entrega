/**
 * LA POLÍTICA DE CLAVES, DICHA MIENTRAS SE ESCRIBE (L-3).
 *
 * Es el espejo en el navegador de `PoliticaDeContrasena` del servidor (`SIMUS.Api/Security`): longitud
 * de 12 a 128, fuera de la lista de claves comunes, sin secuencias ni repeticiones, y sin contener el
 * nombre ni la parte local del correo. No consulta al servidor —no hay nada que saturar—, y el servidor
 * sigue siendo quien decide: si algún día difieren, manda el servidor y su mensaje vuelve al campo.
 */
export const LONGITUD_MINIMA_DE_CLAVE = 12;
export const LONGITUD_MAXIMA_DE_CLAVE = 128;

const BLOQUEADAS = new Set([
  'password', 'password123', 'password1234', '123456789012', '1234567890',
  'qwertyuiop', 'qwerty123', 'contrasena', 'contraseña', 'clave123456',
  'simus123456', 'pnmc123456', 'admin123456',
]);

export interface ReglaDeClave {
  readonly id: 'longitud' | 'comun' | 'predecible' | 'personal';
  /** Lo que la persona lee junto a la marca. */
  readonly texto: string;
  /** El mensaje de error cuando no se cumple (el mismo del servidor). */
  readonly mensaje: string;
  readonly cumple: boolean;
}

function esRepetitivaOConsecutiva(clave: string): boolean {
  if (new Set(clave).size === 1) return true;
  const ascendentes = '0123456789abcdefghijklmnopqrstuvwxyz';
  const minuscula = clave.toLowerCase();
  for (let i = 0; i + 4 <= minuscula.length; i++) {
    const tramo = minuscula.slice(i, i + 4);
    if (ascendentes.includes(tramo) || ascendentes.includes([...tramo].reverse().join(''))) return true;
  }
  return false;
}

/** Las reglas con su estado para esta clave. Con la clave vacía ninguna está cumplida. */
export function reglasDeClave(clave: string, correo: string, nombres: readonly string[]): readonly ReglaDeClave[] {
  const hay = clave.length > 0;
  const partes = [...nombres, correo.split('@')[0] ?? '']
    .map(parte => parte.trim())
    .filter(parte => parte.length >= 3);
  const minuscula = clave.toLowerCase();
  return [
    {
      id: 'longitud', texto: `Entre ${LONGITUD_MINIMA_DE_CLAVE} y ${LONGITUD_MAXIMA_DE_CLAVE} caracteres`,
      mensaje: clave.length > LONGITUD_MAXIMA_DE_CLAVE
        ? `La contraseña no puede superar ${LONGITUD_MAXIMA_DE_CLAVE} caracteres.`
        : `La contraseña debe tener al menos ${LONGITUD_MINIMA_DE_CLAVE} caracteres.`,
      cumple: clave.length >= LONGITUD_MINIMA_DE_CLAVE && clave.length <= LONGITUD_MAXIMA_DE_CLAVE,
    },
    {
      id: 'comun', texto: 'No es una clave común',
      mensaje: 'Esta contraseña es demasiado común. Elige una frase de paso distinta.',
      cumple: hay && !BLOQUEADAS.has(clave.trim().toLowerCase()),
    },
    {
      id: 'predecible', texto: 'Sin repeticiones ni secuencias (1234, abcd)',
      mensaje: 'Esta contraseña es predecible. Elige una frase de paso distinta.',
      cumple: hay && !esRepetitivaOConsecutiva(clave),
    },
    {
      id: 'personal', texto: 'No contiene tu nombre ni tu correo',
      mensaje: 'La contraseña no debe contener tu nombre ni tu correo electrónico.',
      cumple: hay && !partes.some(parte => minuscula.includes(parte.toLowerCase())),
    },
  ];
}

/** El primer mensaje de la política que la clave incumple, o `null` si la cumple. */
export function mensajeDeClave(clave: string, correo: string, nombres: readonly string[]): string | null {
  if (!clave) return reglasDeClave(clave, correo, nombres)[0].mensaje;
  return reglasDeClave(clave, correo, nombres).find(regla => !regla.cumple)?.mensaje ?? null;
}
