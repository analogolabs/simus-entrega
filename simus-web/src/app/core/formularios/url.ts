/**
 * UNA SOLA REGLA PARA LAS DIRECCIONES WEB.
 *
 * Cada formulario tenía la suya: el asistente de Festival exigía «http://» o «https://», la ficha
 * aceptaba lo que se escribiera sin esquema y «Editar contacto» lo rechazaba después con
 * «paginaWeb: Ingresa una URL válida», sobre un campo que ni se había tocado. Ahora es la misma en
 * todas partes y en los dos lados: <b>se acepta sin esquema, se completa con `https://` y solo se
 * admite https</b>. El servidor aplica exactamente lo mismo (`ValidationHelpers.NormalizeHttpsUrl`).
 *
 * UNA DIRECCIÓN `http://` SE GUARDA COMO `https://`: es la forma segura de la misma dirección y
 * evita avisos de contenido mixto en las fichas públicas.
 */
const CON_ESQUEMA = /^[a-z][a-z0-9+.-]*:\/\//i;
const ANFITRION = /^[^\s.@:/]+(\.[^\s.@:/]+)+$/;

/**
 * La dirección lista para guardar: sin espacios en los extremos, con `https://`. Vacío se queda
 * vacío. No valida: una dirección imposible se devuelve igual, para que `mensajeDeUrl` la señale.
 */
export function normalizarUrl(valor: string | null | undefined): string {
  const limpio = (valor ?? '').trim();
  if (!limpio) return '';
  if (/^http:\/\//i.test(limpio)) return 'https://' + limpio.slice('http://'.length);
  return CON_ESQUEMA.test(limpio) ? limpio : 'https://' + limpio;
}

/** Si la dirección, ya normalizada, es una dirección https completa. Vacío es válido (opcional). */
export function esUrlValida(valor: string | null | undefined): boolean {
  const normal = normalizarUrl(valor);
  if (!normal) return true;
  if (/\s/.test(normal)) return false;
  try {
    const url = new URL(normal);
    return url.protocol === 'https:' && !url.username && !url.password && ANFITRION.test(url.hostname);
  } catch {
    return false;
  }
}

export const MENSAJE_DE_URL =
  'Escribe una dirección web completa, por ejemplo www.miorganizacion.org o https://miorganizacion.org.';

/** El mensaje bajo el campo, o `null` si la dirección sirve. */
export function mensajeDeUrl(valor: string | null | undefined): string | null {
  return esUrlValida(valor) ? null : MENSAJE_DE_URL;
}

// ───────────────────────────── Redes sociales ─────────────────────────────

/**
 * Una red social admite el USUARIO suelto («@mifestival») además de la dirección: los datos
 * históricos del Programa traen usuarios, y exigir una dirección completa los dejaba sin poder
 * editarse. El usuario se guarda tal cual; la dirección sigue la regla única de arriba. Es la misma
 * regla que `ValidationHelpers.IsValidSocialLink` en el servidor.
 */
const USUARIO_DE_RED = /^@[A-Za-z0-9._]{2,60}$|^[A-Za-z0-9_]{2,60}$/;

export function esRedSocialValida(valor: string | null | undefined): boolean {
  const limpio = (valor ?? '').trim();
  return !limpio || USUARIO_DE_RED.test(limpio) || esUrlValida(limpio);
}

export function normalizarRedSocial(valor: string | null | undefined): string {
  const limpio = (valor ?? '').trim();
  return USUARIO_DE_RED.test(limpio) ? limpio : normalizarUrl(limpio);
}

export const MENSAJE_DE_RED_SOCIAL = 'Escribe el usuario (por ejemplo @mifestival) o la dirección completa de la red social.';

export function mensajeDeRedSocial(valor: string | null | undefined): string | null {
  return esRedSocialValida(valor) ? null : MENSAJE_DE_RED_SOCIAL;
}
