import type { TipoDeAlbum } from '../../../core/services/galeria.service';
import type { AlbumDeLaConsolaCompleto, AlbumParaGuardar, ItemDeLaConsola, ItemParaGuardar } from '../../../core/services/galeria-admin.service';

/**
 * LAS REGLAS DE LA GESTIÓN DE LA GALERÍA, en funciones puras (sin Angular) para decirlas una sola vez y probarlas.
 *
 * Reflejan lo que exige el servidor (`GaleriaEndpoints`): el servidor es la autoridad y rechaza lo que aquí se escape,
 * pero decirlo ANTES de guardar evita el viaje y le da a la persona el motivo en su lugar.
 */

/** Lo que admite el Banco de archivos: WebP, PNG o JPEG de hasta 2 MiB. */
export const TAMANO_MAXIMO_DE_IMAGEN = 2 * 1024 * 1024;
export const TIPOS_DE_IMAGEN_ADMITIDOS: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];

export const LARGOS = { tituloDeAlbum: 200, descripcionDeAlbum: 1000, lugar: 200, titulo: 250, descripcion: 2000, detalle: 4000, credito: 250, alternativo: 300 } as const;

const ID_DE_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** «Mesa Nacional de Rock 2026» → «mesa-nacional-de-rock-2026» (minúsculas, sin tildes, hasta 120 caracteres). */
export function slugDeTitulo(titulo: string): string {
  return titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/, '');
}

export const esSlugValido = (slug: string): boolean => slug.length > 0 && slug.length <= 120 && SLUG.test(slug);

/** Por qué una imagen no sirve (tipo o peso), o `null` si sirve. Lo mismo que comprueba el Banco al subirla. */
export function problemaDeImagen(archivo: { name: string; type: string; size: number }): string | null {
  if (!TIPOS_DE_IMAGEN_ADMITIDOS.includes(archivo.type)) { return `«${archivo.name}» no es una imagen WebP, PNG o JPEG.`; }
  if (archivo.size > TAMANO_MAXIMO_DE_IMAGEN) {
    return `«${archivo.name}» pesa ${(archivo.size / 1048576).toFixed(1).replace('.', ',')} MB y el máximo es 2 MB.`;
  }
  return null;
}

export type EnlaceLeido =
  | { tipo: 'video'; videoId: string; listaUrl: string | null }
  | { tipo: 'lista'; listaUrl: string }
  | { tipo: 'error'; motivo: string };

const ANFITRIONES_DE_YOUTUBE = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/**
 * Lee lo que alguien pega como «enlace de video». Solo se aceptan los de YouTube (la Galería guarda el identificador de 11 caracteres y
 * monta la incrustación sin cookies al pulsar «Reproducir»); un enlace de otro proveedor se rechaza con su motivo.
 */
export function leerEnlaceDeVideo(texto: string): EnlaceLeido {
  const t = (texto ?? '').trim();
  if (!t) { return { tipo: 'error', motivo: 'Pega el enlace del video.' }; }
  if (ID_DE_VIDEO.test(t)) { return { tipo: 'video', videoId: t, listaUrl: null }; }
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`); } catch { return { tipo: 'error', motivo: 'Eso no parece un enlace.' }; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') { return { tipo: 'error', motivo: 'El enlace debe empezar por https://.' }; }
  const anfitrion = url.hostname.toLowerCase();
  if (anfitrion === 'vimeo.com' || anfitrion.endsWith('.vimeo.com')) {
    return { tipo: 'error', motivo: 'Vimeo todavía no está disponible en la Galería: por ahora solo se aceptan enlaces de YouTube.' };
  }
  const corto = anfitrion === 'youtu.be' || anfitrion === 'www.youtu.be';
  if (!corto && !ANFITRIONES_DE_YOUTUBE.has(anfitrion)) {
    return { tipo: 'error', motivo: 'Solo se aceptan enlaces de YouTube (youtube.com o youtu.be).' };
  }
  const lista = url.searchParams.get('list');
  const listaUrl = lista && /^[A-Za-z0-9_-]{10,60}$/.test(lista) ? `https://www.youtube.com/playlist?list=${lista}` : null;
  const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname);
  const id: string | null = corto ? (url.pathname.split('/').filter(Boolean)[0] ?? null) : url.pathname === '/watch' ? url.searchParams.get('v') : (m?.[1] ?? null);
  if (id && ID_DE_VIDEO.test(id)) { return { tipo: 'video', videoId: id, listaUrl }; }
  if (listaUrl && url.pathname === '/playlist') { return { tipo: 'lista', listaUrl }; }
  return { tipo: 'error', motivo: 'No se encontró el identificador del video en ese enlace (se espera algo como youtube.com/watch?v=…).' };
}

/** Lo mismo que acepta el servidor para «Ver la lista en YouTube»: https y youtube.com o youtu.be. */
export function esListaDeYoutube(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(u.hostname);
  } catch { return false; }
}

export const enlaceDeVideo = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`;

/** «6:17» o «1:02:05» → segundos; vacío → null; algo que no es una duración → NaN. */
export function segundosDeDuracion(texto: string): number | null {
  const t = texto.trim();
  if (!t) { return null; }
  if (/^\d+$/.test(t)) { return Number(t); }
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) { return Number.NaN; }
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// ─────────────────────────────── Modelo editable ───────────────────────────────

let contador = 0;

/** Un ítem en edición. Los textos son siempre cadenas (vacías si no hay), para enlazarlos a los campos sin nulos. */
export interface ItemEditable {
  /** Identidad estable en la pantalla (no es el id del servidor: un ítem nuevo no lo tiene). */
  clave: number;
  tipoItem: 'foto' | 'video';
  titulo: string;
  descripcion: string;
  detalle: string;
  fecha: string;
  credito: string;
  textoAlternativo: string;
  archivoId: number | null;
  /** Foto: su dirección para mostrarla. Video: la de su miniatura propia, si la tiene. */
  imagenUrl: string | null;
  videoId: string;
  /** Duración tal como se escribe: «6:17». */
  duracion: string;
  miniaturaArchivoId: number | null;
  publicado: boolean;
}

export function itemNuevo(parcial: Partial<ItemEditable> & Pick<ItemEditable, 'tipoItem'>): ItemEditable {
  return {
    clave: ++contador, titulo: '', descripcion: '', detalle: '', fecha: '', credito: '', textoAlternativo: '', archivoId: null, imagenUrl: null,
    videoId: '', duracion: '', miniaturaArchivoId: null, publicado: true, ...parcial,
  };
}

function textoDeDuracion(segundos: number | null): string {
  if (!segundos) { return ''; }
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}

export function itemDesdeServidor(i: ItemDeLaConsola): ItemEditable {
  return itemNuevo({
    tipoItem: i.tipoItem, titulo: i.titulo ?? '', descripcion: i.descripcion ?? '', detalle: i.detalle ?? '', fecha: i.fecha ?? '', credito: i.credito ?? '',
    textoAlternativo: i.textoAlternativo ?? '', archivoId: i.archivoId, imagenUrl: i.tipoItem === 'foto' ? i.url : i.miniaturaUrl ?? null, videoId: i.videoId ?? '',
    duracion: textoDeDuracion(i.duracionSegundos), miniaturaArchivoId: i.miniaturaArchivoId, publicado: i.publicado,
  });
}

const nulo = (t: string): string | null => (t.trim() === '' ? null : t.trim());

export function itemParaGuardar(i: ItemEditable): ItemParaGuardar {
  const foto = i.tipoItem === 'foto';
  const segundos = foto ? null : segundosDeDuracion(i.duracion);
  return {
    tipoItem: i.tipoItem, titulo: nulo(i.titulo), descripcion: nulo(i.descripcion), detalle: nulo(i.detalle), fecha: i.fecha || null, credito: nulo(i.credito),
    textoAlternativo: foto ? nulo(i.textoAlternativo) : null, archivoId: foto ? i.archivoId : null, videoId: foto ? null : i.videoId.trim(),
    duracionSegundos: segundos !== null && !Number.isNaN(segundos) && segundos > 0 ? segundos : null,
    miniaturaArchivoId: foto ? null : i.miniaturaArchivoId, publicado: i.publicado,
  };
}

export interface AlbumEditable {
  /** Vacío mientras el álbum es nuevo y no se ha guardado. */
  slug: string;
  esNuevo: boolean;
  titulo: string;
  descripcion: string;
  tipo: TipoDeAlbum;
  lugar: string;
  fechaReferencia: string;
  portadaArchivoId: number | null;
  portadaUrl: string | null;
  listaOrigenUrl: string;
  orden: number;
  publicado: boolean;
  destacado: boolean;
  items: ItemEditable[];
}

export function albumNuevo(orden: number): AlbumEditable {
  return {
    slug: '', esNuevo: true, titulo: '', descripcion: '', tipo: 'fotos', lugar: '', fechaReferencia: '', portadaArchivoId: null, portadaUrl: null,
    listaOrigenUrl: '', orden, publicado: false, destacado: false, items: [],
  };
}

export function albumDesdeServidor(a: AlbumDeLaConsolaCompleto): AlbumEditable {
  return {
    slug: a.slug, esNuevo: false, titulo: a.titulo, descripcion: a.descripcion ?? '', tipo: a.tipo, lugar: a.lugar ?? '', fechaReferencia: a.fechaReferencia ?? '',
    portadaArchivoId: a.portadaArchivoId, portadaUrl: a.portadaUrl, listaOrigenUrl: a.listaOrigenUrl ?? '', orden: a.orden, publicado: a.publicado, destacado: a.destacado,
    items: a.items.map(itemDesdeServidor),
  };
}

export function albumParaGuardar(a: AlbumEditable): AlbumParaGuardar {
  return {
    titulo: a.titulo.trim(), descripcion: nulo(a.descripcion), tipo: a.tipo, lugar: nulo(a.lugar), fechaReferencia: a.fechaReferencia || null,
    portadaArchivoId: a.portadaArchivoId, listaOrigenUrl: nulo(a.listaOrigenUrl), orden: a.orden, publicado: a.publicado, destacado: a.destacado,
    items: a.items.map(itemParaGuardar),
  };
}

/**
 * Lo que impide guardar los ítems, dicho en claro y con el número de ítem para encontrarlo. Con `tipoDeAlbum` nulo (ítems sin álbum) no hay
 * coherencia de tipo que exigir.
 */
export function problemasDeItems(items: readonly ItemEditable[], tipoDeAlbum: TipoDeAlbum | null): string[] {
  const p: string[] = [];
  items.forEach((i, n) => {
    const quien = `${i.tipoItem === 'foto' ? 'La foto' : 'El video'} ${n + 1}`;
    if (tipoDeAlbum === 'fotos' && i.tipoItem === 'video') { p.push(`${quien} es un video y el álbum es de fotos: cambia el tipo del álbum o quita el video.`); }
    if (tipoDeAlbum === 'videos' && i.tipoItem === 'foto') { p.push(`${quien} es una foto y el álbum es de videos: cambia el tipo del álbum o quita la foto.`); }
    if (i.tipoItem === 'foto') {
      if (i.archivoId === null) { p.push(`${quien} no tiene imagen.`); }
      if (!i.textoAlternativo.trim()) { p.push(`${quien} necesita su texto alternativo: describe la imagen para quien no puede verla.`); }
    } else {
      if (!ID_DE_VIDEO.test(i.videoId.trim())) { p.push(`${quien} necesita un enlace de YouTube válido.`); }
      if (!i.titulo.trim()) { p.push(`${quien} necesita su título.`); }
      const s = segundosDeDuracion(i.duracion);
      if (s !== null && (Number.isNaN(s) || s <= 0)) { p.push(`${quien}: la duración se escribe como 6:17 (minutos y segundos).`); }
    }
    const largos: [string, number, number][] = [['el título', i.titulo.trim().length, LARGOS.titulo], ['la descripción', i.descripcion.trim().length, LARGOS.descripcion],
      ['el detalle', i.detalle.trim().length, LARGOS.detalle], ['el crédito', i.credito.trim().length, LARGOS.credito], ['el texto alternativo', i.textoAlternativo.trim().length, LARGOS.alternativo]];
    for (const [que, largo, maximo] of largos) { if (largo > maximo) { p.push(`${quien}: ${que} supera los ${maximo} caracteres.`); } }
  });
  const fotos = items.filter(i => i.tipoItem === 'foto' && i.archivoId !== null).map(i => i.archivoId);
  if (new Set(fotos).size !== fotos.length) { p.push('Una foto aparece dos veces.'); }
  const videos = items.filter(i => i.tipoItem === 'video' && i.videoId.trim()).map(i => i.videoId.trim());
  if (new Set(videos).size !== videos.length) { p.push('Un video aparece dos veces.'); }
  return p;
}

/** Lo que impide guardar el álbum (datos + ítems). Vacío si se puede guardar. */
export function problemasDeAlbum(a: AlbumEditable): string[] {
  const p: string[] = [];
  if (!a.titulo.trim()) { p.push('El título del álbum es obligatorio.'); }
  if (a.titulo.trim().length > LARGOS.tituloDeAlbum) { p.push(`El título supera los ${LARGOS.tituloDeAlbum} caracteres.`); }
  if (a.descripcion.trim().length > LARGOS.descripcionDeAlbum) { p.push(`La descripción supera los ${LARGOS.descripcionDeAlbum} caracteres.`); }
  if (a.lugar.trim().length > LARGOS.lugar) { p.push(`El lugar supera los ${LARGOS.lugar} caracteres.`); }
  if (a.esNuevo && !esSlugValido(a.slug)) { p.push('La dirección del álbum usa minúsculas, números y guiones (por ejemplo «mesa-nacional-2026»).'); }
  if (a.listaOrigenUrl.trim() && !esListaDeYoutube(a.listaOrigenUrl.trim())) { p.push('La lista de reproducción es un enlace https de YouTube.'); }
  p.push(...problemasDeItems(a.items, a.tipo));
  if (a.publicado) {
    if (a.items.length === 0) { p.push('Para publicar, el álbum necesita al menos un ítem.'); }
    else if (a.tipo === 'mixto' && (!a.items.some(i => i.tipoItem === 'foto') || !a.items.some(i => i.tipoItem === 'video'))) {
      p.push('Un álbum mixto publicado necesita al menos una foto y un video.');
    }
  }
  return p;
}

/** Mueve un elemento de la lista una posición; devuelve la misma lista si no se puede. */
export function mover<T>(lista: readonly T[], indice: number, sentido: -1 | 1): T[] {
  const copia = [...lista];
  const destino = indice + sentido;
  if (destino < 0 || destino >= copia.length) { return copia; }
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}
