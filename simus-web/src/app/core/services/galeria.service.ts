import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { motivoDeLaAccion } from '../formularios/traductor-de-errores';

/** El tipo de un álbum: de fotos, de videos o mixto (fotos y videos). */
export type TipoDeAlbum = 'fotos' | 'videos' | 'mixto';

/** Rótulo legible de cada tipo (nunca el código de la base). */
export const ROTULO_DE_TIPO: Readonly<Record<TipoDeAlbum, string>> = { fotos: 'Fotos', videos: 'Videos', mixto: 'Fotos y videos' };

export interface AlbumDeGaleriaResumen {
  slug: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoDeAlbum;
  lugar: string | null;
  fechaReferencia: string | null;
  portadaUrl: string | null;
  totalFotos: number;
  totalVideos: number;
  listaOrigenUrl: string | null;
  publicado: boolean;
  /** Marcado en la consola para el carrusel «Destacados» (ausente en respuestas anteriores). */
  destacado?: boolean;
}

export interface ItemDeGaleria {
  id: number;
  tipoItem: 'foto' | 'video';
  orden: number;
  titulo: string | null;
  descripcion: string | null;
  fecha: string | null;
  credito: string | null;
  textoAlternativo: string | null;
  archivoId: number | null;
  /** Foto: ruta pública del Banco de archivos. */
  url: string | null;
  /** Video: identificador de YouTube (11 caracteres, validado por el servidor). */
  videoId: string | null;
  /** Video: dirección de la página en YouTube; solo se usa para el enlace «Ver en YouTube». */
  urlYoutube: string | null;
  duracionSegundos: number | null;
  /** Video: su imagen PROPIA en el Banco de archivos (sembrada una sola vez); el navegador no pide nada a YouTube para mostrarla. */
  miniaturaUrl?: string | null;
  /** Foto: medidas del archivo, para armar el mosaico sin saltos. */
  ancho?: number | null;
  alto?: number | null;
  /** Texto completo cuando `descripcion` es un resumen editorial. */
  detalle?: string | null;
}

/** Un ítem tal como lo lista la Galería por clase (fotos, videos o sin álbum), con su álbum si lo tiene. */
export interface ItemPublicoDeGaleria {
  id: number;
  tipoItem: 'foto' | 'video';
  titulo: string | null;
  descripcion: string | null;
  fecha: string | null;
  credito: string | null;
  textoAlternativo: string | null;
  url: string | null;
  miniaturaUrl: string | null;
  videoId: string | null;
  urlYoutube: string | null;
  duracionSegundos: number | null;
  ancho: number | null;
  alto: number | null;
  albumSlug: string | null;
  albumTitulo: string | null;
  albumLugar: string | null;
  albumFecha: string | null;
  detalle: string | null;
}

/** Las clases de ítem que ofrece la Galería: una por pestaña. */
export type ClaseDeItem = 'fotos' | 'videos' | 'sueltos';

export interface PaginaDeItems {
  items: ItemPublicoDeGaleria[];
  total: number;
}

export interface AlbumDeGaleria extends Omit<AlbumDeGaleriaResumen, 'totalFotos' | 'totalVideos'> {
  portadaArchivoId: number | null;
  orden: number;
  fechaActualizacion: string | null;
  items: ItemDeGaleria[];
}

export interface ListadoDeGaleria {
  items: AlbumDeGaleriaResumen[];
  totales: { albumes: number; fotos: number; videos: number; sueltos: number };
}

export interface ResultadoDeGaleria<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * La Galería pública: álbumes de fotos, de videos y mixtos.
 *
 * Solo lee lo publicado. El portal no pide nada a YouTube al cargar: el video es un identificador y la
 * incrustación sin cookies se monta únicamente cuando la persona pulsa «Reproducir».
 */
@Injectable({ providedIn: 'root' })
export class GaleriaService {
  private readonly api = inject(ApiClientService);
  private static readonly PUBLICO = '/api/v1/publico/galeria/albumes';

  async albumes(): Promise<ResultadoDeGaleria<ListadoDeGaleria>> {
    try {
      const r = await firstValueFrom(this.api.get<ListadoDeGaleria>(GaleriaService.PUBLICO, {}));
      return { ok: true, data: { items: r?.items ?? [], totales: r?.totales ?? { albumes: 0, fotos: 0, videos: 0, sueltos: 0 } } };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible consultar la Galería.') };
    }
  }

  async album(slug: string): Promise<ResultadoDeGaleria<AlbumDeGaleria | null>> {
    try {
      return { ok: true, data: await firstValueFrom(this.api.get<AlbumDeGaleria>(`${GaleriaService.PUBLICO}/${encodeURIComponent(slug)}`, {})) };
    } catch (error: unknown) {
      if ((error as { status?: number })?.status === 404) return { ok: true, data: null };
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible consultar el álbum.') };
    }
  }

  /** Una página de ítems de una clase: todas las fotos, todos los videos o los sueltos. */
  async items(clase: ClaseDeItem, desde = 0, cantidad = 60): Promise<ResultadoDeGaleria<PaginaDeItems>> {
    try {
      const r = await firstValueFrom(this.api.get<PaginaDeItems>('/api/v1/publico/galeria/items', { params: { clase, desde, cantidad } }));
      return { ok: true, data: { items: r?.items ?? [], total: r?.total ?? 0 } };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible consultar la Galería.') };
    }
  }
}
