/**
 * UNA SOLA REGLA PARA EL TELÉFONO Y EL CORREO. El servidor aplica la misma
 * (`ValidationHelpers.IsValidPhone` / `IsValidEmail`): dígitos, espacios y `+ ( ) -`, con al menos
 * siete dígitos. Antes el teléfono «abc» se aceptaba en la ficha del Festival y se rechazaba en la
 * cuenta.
 */
export function esTelefonoValido(valor: string | null | undefined): boolean {
  const limpio = (valor ?? '').trim();
  if (!limpio) return true;
  if (!/^[+()\-\s\d]{7,80}$/.test(limpio)) return false;
  return limpio.replace(/\D/g, '').length >= 7;
}

export const MENSAJE_DE_TELEFONO = 'Escribe un teléfono válido: solo números (mínimo 7), espacios y + ( ) -.';

export function mensajeDeTelefono(valor: string | null | undefined): string | null {
  return esTelefonoValido(valor) ? null : MENSAJE_DE_TELEFONO;
}

/** El mismo criterio de correo que usa el servidor: una arroba y un dominio con punto. */
export function esCorreoValido(valor: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((valor ?? '').trim());
}

export const MENSAJE_DE_CORREO = 'Escribe un correo electrónico válido, por ejemplo nombre@correo.org.';

export function mensajeDeCorreo(valor: string | null | undefined): string | null {
  return !(valor ?? '').trim() || esCorreoValido(valor) ? null : MENSAJE_DE_CORREO;
}
