import { esUrlValida, normalizarUrl } from './url';

/**
 * LOS ENLACES DEL PERFIL PÚBLICO, CON SU RED (perfil público).
 *
 * «Añadir enlace» ofrece de base las redes y plataformas habituales de quien hace música: cada una con su
 * icono, su ejemplo y su regla de formato (la dirección tiene que ser https y de esa red). «Otro» es la página
 * web propia u otra dirección cualquiera. El servidor guarda solo la dirección https (hasta cinco): la red se
 * reconoce por el anfitrión de la dirección, así que los enlaces que ya estaban guardados siguen valiendo.
 */
export type ClaveDeRed =
  | 'linkedin' | 'instagram' | 'facebook' | 'youtube' | 'x' | 'tiktok' | 'spotify' | 'soundcloud' | 'bandcamp' | 'otro';

export interface RedDeEnlace {
  readonly clave: ClaveDeRed;
  readonly rotulo: string;
  /** Anfitriones propios de la red; un subdominio también vale (`artista.bandcamp.com`). Vacío: cualquiera. */
  readonly anfitriones: readonly string[];
  readonly ejemplo: string;
}

export const REDES_DE_ENLACE: readonly RedDeEnlace[] = [
  { clave: 'instagram', rotulo: 'Instagram', anfitriones: ['instagram.com', 'instagr.am'], ejemplo: 'https://www.instagram.com/tu_usuario' },
  { clave: 'facebook', rotulo: 'Facebook', anfitriones: ['facebook.com', 'fb.com', 'fb.me'], ejemplo: 'https://www.facebook.com/tu.pagina' },
  { clave: 'youtube', rotulo: 'YouTube', anfitriones: ['youtube.com', 'youtu.be'], ejemplo: 'https://www.youtube.com/@tu_canal' },
  { clave: 'spotify', rotulo: 'Spotify', anfitriones: ['spotify.com', 'spoti.fi'], ejemplo: 'https://open.spotify.com/artist/…' },
  { clave: 'soundcloud', rotulo: 'SoundCloud', anfitriones: ['soundcloud.com'], ejemplo: 'https://soundcloud.com/tu_usuario' },
  { clave: 'bandcamp', rotulo: 'Bandcamp', anfitriones: ['bandcamp.com'], ejemplo: 'https://tu-usuario.bandcamp.com' },
  { clave: 'tiktok', rotulo: 'TikTok', anfitriones: ['tiktok.com'], ejemplo: 'https://www.tiktok.com/@tu_usuario' },
  { clave: 'x', rotulo: 'X', anfitriones: ['x.com', 'twitter.com'], ejemplo: 'https://x.com/tu_usuario' },
  { clave: 'linkedin', rotulo: 'LinkedIn', anfitriones: ['linkedin.com', 'lnkd.in'], ejemplo: 'https://www.linkedin.com/in/tu-nombre' },
  { clave: 'otro', rotulo: 'Otro (página web u otra dirección)', anfitriones: [], ejemplo: 'https://www.mi-sitio.org' },
];

export const MAXIMO_DE_ENLACES_DEL_PERFIL = 5;

export function redDe(clave: ClaveDeRed): RedDeEnlace {
  return REDES_DE_ENLACE.find(red => red.clave === clave) ?? REDES_DE_ENLACE[REDES_DE_ENLACE.length - 1];
}

function anfitrionDe(valor: string): string | null {
  try {
    return new URL(normalizarUrl(valor)).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function perteneceA(anfitrion: string, propios: readonly string[]): boolean {
  return propios.some(propio => anfitrion === propio || anfitrion.endsWith(`.${propio}`));
}

/** De qué red es una dirección ya escrita; `otro` si no es de ninguna de las conocidas. */
export function detectarRed(valor: string | null | undefined): ClaveDeRed {
  const anfitrion = anfitrionDe(valor ?? '');
  if (!anfitrion) return 'otro';
  return REDES_DE_ENLACE.find(red => red.anfitriones.length > 0 && perteneceA(anfitrion, red.anfitriones))?.clave ?? 'otro';
}

/** El mensaje bajo el campo de una red concreta, o `null` si la dirección sirve. Vacía no sirve: la fila existe para llevar una. */
export function mensajeDeEnlaceDeRed(clave: ClaveDeRed, valor: string | null | undefined): string | null {
  const red = redDe(clave);
  if (!(valor ?? '').trim()) return `Escribe la dirección de ${clave === 'otro' ? 'la página' : red.rotulo}.`;
  if (!esUrlValida(valor)) return `Escribe una dirección https completa, por ejemplo ${red.ejemplo}.`;
  if (red.anfitriones.length > 0) {
    const anfitrion = anfitrionDe(valor!);
    if (!anfitrion || !perteneceA(anfitrion, red.anfitriones)) return `Esa dirección no es de ${red.rotulo}. Usa una como ${red.ejemplo}.`;
  }
  return null;
}

/** Un enlace del formulario: la red elegida al añadirlo y su dirección. */
export interface EnlaceDelPerfil {
  red: ClaveDeRed;
  url: string;
  /** El rótulo que la persona le pone a un enlace «otro» (hasta 60 caracteres). Las redes conocidas no lo llevan. */
  etiqueta?: string | null;
}

export const LARGO_DE_ETIQUETA_DE_ENLACE = 60;

export function enlacesDesdeDirecciones(direcciones: readonly string[], etiquetas: readonly (string | null)[] = []): EnlaceDelPerfil[] {
  return direcciones.map((url, i) => ({ red: detectarRed(url), url, etiqueta: etiquetas[i] ?? null })).filter(enlace => enlace.url);
}

/**
 * Los errores por fila, en el mismo orden. Una red conocida no se repite (una cuenta de Instagram, una de
 * YouTube…) y ninguna dirección se repite, sea de la red que sea.
 */
export function erroresDeEnlaces(enlaces: readonly EnlaceDelPerfil[]): (string | null)[] {
  const vistas = new Set<string>();
  const direcciones = new Set<string>();
  return enlaces.map(enlace => {
    const propio = mensajeDeEnlaceDeRed(enlace.red, enlace.url);
    if (propio) return propio;
    if ((enlace.etiqueta ?? '').trim().length > LARGO_DE_ETIQUETA_DE_ENLACE) return `El rótulo admite hasta ${LARGO_DE_ETIQUETA_DE_ENLACE} caracteres.`;
    if (enlace.red !== 'otro') {
      if (vistas.has(enlace.red)) return `Ya añadiste un enlace de ${redDe(enlace.red).rotulo}.`;
      vistas.add(enlace.red);
    }
    const normal = normalizarUrl(enlace.url).toLowerCase().replace(/\/$/, '');
    if (direcciones.has(normal)) return 'Esa dirección ya está en tu lista.';
    direcciones.add(normal);
    return null;
  });
}
