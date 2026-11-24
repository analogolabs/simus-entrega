/**
 * Las redes sociales institucionales del Ministerio de las Culturas, declaradas una sola vez.
 *
 * El pie de página y la franja de redes del inicio leen de aquí: antes cada uno escribía sus enlaces
 * a mano y la franja del inicio apuntaba a la raíz de cada red (`https://instagram.com`), no a una
 * cuenta (H-1, F-1). Para cambiar una cuenta se toca este archivo y nada más.
 *
 * El pie muestra SOLO estas cuatro redes y en este orden: YouTube, Instagram, Facebook y X.
 * WhatsApp y TikTok no se muestran (F-1).
 *
 * Las tres primeras cuentas son las que ya usa la página de noticias. La de X sigue el mismo nombre
 * de usuario del Ministerio en las demás redes.
 * PENDIENTE DE CONFIRMAR: que `@MinCulturasCol` sea la cuenta vigente en X; la confirma el equipo
 * de comunicaciones del Ministerio antes de la entrega.
 */
export type IdDeRedInstitucional = 'youtube' | 'instagram' | 'facebook' | 'x';

export interface RedInstitucional {
  readonly id: IdDeRedInstitucional;
  readonly nombre: string;
  readonly href: string;
}

export const REDES_INSTITUCIONALES: readonly RedInstitucional[] = [
  { id: 'youtube', nombre: 'YouTube', href: 'https://www.youtube.com/@MinCulturasCol' },
  { id: 'instagram', nombre: 'Instagram', href: 'https://www.instagram.com/minculturascol' },
  { id: 'facebook', nombre: 'Facebook', href: 'https://www.facebook.com/MinCulturasCol' },
  { id: 'x', nombre: 'X', href: 'https://x.com/MinCulturasCol' }, // PENDIENTE DE CONFIRMAR
];

/** La clave del CMS con la dirección de una red institucional (grupo «Redes sociales y enlaces del pie»). */
export const claveDeUrlDeRed = (id: IdDeRedInstitucional): string => `red_${id}_url`;

/**
 * Las redes institucionales con la dirección que el CMS tenga publicada. `leer` es `getWebText`: si
 * nadie publicó otra, devuelve la de fábrica del registro, que es la de esta lista. Una dirección vacía
 * (borrada a propósito en el CMS) retira la red del sitio.
 */
export function redesConDireccionDelCms(leer: (clave: string) => string): RedInstitucional[] {
  return REDES_INSTITUCIONALES
    .map(red => ({ ...red, href: (leer(claveDeUrlDeRed(red.id)) || '').trim() }))
    .filter(red => red.href.length > 0);
}
