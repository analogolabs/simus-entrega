import type { AlbumDeGaleria, ItemDeGaleria, ItemPublicoDeGaleria } from '../../../core/services/galeria.service';

/** Una foto tal como la necesitan el mosaico y el visor, venga de un álbum o de la lista de fotos. */
export interface FotoDeGaleria {
  id: number;
  url: string;
  alt: string;
  titulo: string | null;
  credito: string | null;
  fecha: string | null;
  lugar: string | null;
  albumSlug: string | null;
  albumTitulo: string | null;
  /** Relación ancho/alto (1,5 si no se conoce). */
  razon: number;
}

/** Un video tal como lo necesitan el reproductor y sus listas. */
export interface VideoDeGaleria {
  id: number;
  videoId: string;
  titulo: string;
  descripcion: string | null;
  detalle: string | null;
  fecha: string | null;
  duracionSegundos: number | null;
  miniaturaUrl: string | null;
  urlYoutube: string | null;
  credito: string | null;
  albumSlug: string | null;
  albumTitulo: string | null;
}

export const ID_DE_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «6 de agosto de 2026» a partir de AAAA-MM-DD, sin pasar por la zona horaria. */
export function fechaLarga(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : '';
}

/** «Agosto de 2026». */
export function mesYAnio(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '');
  return m ? `${MESES[Number(m[2]) - 1][0].toUpperCase()}${MESES[Number(m[2]) - 1].slice(1)} de ${m[1]}` : '';
}

/** «6:17» o «1:02:05». */
export function duracionCorta(segundos: number | null | undefined): string {
  if (!segundos) return '';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}

/** «6 min 17 s». */
export function duracionLarga(segundos: number | null | undefined): string {
  if (!segundos) return '';
  return `${Math.floor(segundos / 60)} min ${segundos % 60} s`;
}

/** «18 fotos», «4 videos» o «6 fotos · 2 videos». */
export function conteoRotulado(fotos: number, videos: number): string {
  const p: string[] = [];
  if (fotos > 0) p.push(`${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`);
  if (videos > 0) p.push(`${videos} ${videos === 1 ? 'video' : 'videos'}`);
  return p.join(' · ');
}

const razon = (ancho: number | null | undefined, alto: number | null | undefined) => (ancho && alto ? ancho / alto : 1.5);

export function fotoDeItem(i: ItemDeGaleria, a: Pick<AlbumDeGaleria, 'slug' | 'titulo' | 'lugar' | 'fechaReferencia'>): FotoDeGaleria {
  return {
    id: i.id, url: i.url ?? '', alt: i.textoAlternativo ?? '', titulo: i.titulo, credito: i.credito, fecha: i.fecha ?? a.fechaReferencia, lugar: a.lugar,
    albumSlug: a.slug, albumTitulo: a.titulo, razon: razon(i.ancho, i.alto),
  };
}

export function fotoDePublico(i: ItemPublicoDeGaleria): FotoDeGaleria {
  return {
    id: i.id, url: i.url ?? '', alt: i.textoAlternativo ?? '', titulo: i.titulo, credito: i.credito, fecha: i.fecha ?? i.albumFecha, lugar: i.albumLugar,
    albumSlug: i.albumSlug, albumTitulo: i.albumTitulo, razon: razon(i.ancho, i.alto),
  };
}

export function videoDeItem(i: ItemDeGaleria, a: Pick<AlbumDeGaleria, 'slug' | 'titulo' | 'fechaReferencia'>): VideoDeGaleria {
  return {
    id: i.id, videoId: i.videoId ?? '', titulo: i.titulo ?? 'Video', descripcion: i.descripcion, detalle: i.detalle ?? null, fecha: i.fecha ?? a.fechaReferencia,
    duracionSegundos: i.duracionSegundos, miniaturaUrl: i.miniaturaUrl ?? null, urlYoutube: i.urlYoutube, credito: i.credito, albumSlug: a.slug, albumTitulo: a.titulo,
  };
}

export function videoDePublico(i: ItemPublicoDeGaleria): VideoDeGaleria {
  return {
    id: i.id, videoId: i.videoId ?? '', titulo: i.titulo ?? 'Video', descripcion: i.descripcion, detalle: i.detalle, fecha: i.fecha ?? i.albumFecha,
    duracionSegundos: i.duracionSegundos, miniaturaUrl: i.miniaturaUrl, urlYoutube: i.urlYoutube, credito: i.credito, albumSlug: i.albumSlug, albumTitulo: i.albumTitulo,
  };
}

/** Un grupo del mosaico de fotos: las de un álbum (o las sueltas) seguidas. */
export interface GrupoDeFotos {
  clave: string;
  slug: string | null;
  titulo: string;
  sub: string;
  fotos: FotoDeGaleria[];
}

/** Agrupa fotos CONSECUTIVAS por álbum (el servidor ya las ordena así). */
export function agruparPorAlbum(fotos: FotoDeGaleria[]): GrupoDeFotos[] {
  const grupos: GrupoDeFotos[] = [];
  for (const f of fotos) {
    const clave = f.albumSlug ?? '';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === clave) { ultimo.fotos.push(f); continue; }
    grupos.push({ clave, slug: f.albumSlug, titulo: f.albumTitulo ?? 'Sin álbum', sub: [f.lugar, fechaLarga(f.fecha)].filter(Boolean).join(' · '), fotos: [f] });
  }
  return grupos;
}

/** Extensión de archivo según el tipo de contenido de la foto (JPG si no se reconoce). */
export function extensionDeImagen(tipo: string | null | undefined): string {
  const t = (tipo ?? '').toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  if (t.includes('avif')) return 'avif';
  return 'jpg';
}

/** El nombre legible de un archivo descargado: «mesa-nacional-de-rock-foto-12.jpg» (sin tildes ni símbolos, hasta 60 caracteres). */
export function nombreDeDescarga(f: Pick<FotoDeGaleria, 'id' | 'titulo' | 'alt' | 'albumTitulo'>, tipo?: string | null): string {
  const limpio = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = limpio(f.titulo ?? f.alt) || limpio(f.albumTitulo);
  const nombre = (base ? `${base.slice(0, 60).replace(/-+$/, '')}-` : '') + `foto-${f.id}`;
  return `${nombre}.${extensionDeImagen(tipo)}`;
}

/** Los rótulos de las vistas que llevan a un álbum (para las migas y «Volver»). */
export const ROTULO_DE_VISTA: Readonly<Record<'albumes' | 'fotos' | 'videos' | 'sin-album', string>> = {
  albumes: 'Álbumes', fotos: 'Fotos', videos: 'Videos', 'sin-album': 'Sin álbum',
};

/** Una fila de un mosaico justificado: las fotos con su ancho y alto ya calculados, en píxeles. */
export interface CeldaDeMuro { foto: FotoDeGaleria; ancho: number; alto: number }

/**
 * Reparte las fotos en FILAS REALES según el ancho disponible (mosaico justificado): cada fila crece hasta llenar el ancho y se ajusta su alto para que
 * calce exacto. Con `maxFilas` solo se devuelven esas filas COMPLETAS; si el álbum no llega a llenarlas, la última fila (incompleta) se muestra a su alto natural.
 */
export function repartirEnFilas(fotos: readonly FotoDeGaleria[], ancho: number, altoObjetivo: number, separacion: number, maxFilas: number | null): { celdas: CeldaDeMuro[]; ocultas: number } {
  if (ancho <= 0 || fotos.length === 0) return { celdas: [], ocultas: 0 };
  const filas: CeldaDeMuro[][] = [];
  let actual: FotoDeGaleria[] = [];
  let suma = 0;
  let usadas = 0;
  const cerrar = (completa: boolean): void => {
    const hueco = separacion * (actual.length - 1);
    const alto = completa ? (ancho - hueco) / suma : altoObjetivo;
    filas.push(actual.map(f => ({ foto: f, ancho: Math.floor(f.razon * alto), alto: Math.floor(alto) })));
    usadas += actual.length;
    actual = []; suma = 0;
  };
  for (const f of fotos) {
    if (maxFilas !== null && filas.length >= maxFilas) break;
    actual.push(f);
    suma += f.razon;
    if (suma * altoObjetivo + separacion * (actual.length - 1) >= ancho) cerrar(true);
  }
  if (actual.length > 0 && (maxFilas === null || filas.length < maxFilas)) cerrar(false);
  return { celdas: filas.flat(), ocultas: fotos.length - usadas };
}
