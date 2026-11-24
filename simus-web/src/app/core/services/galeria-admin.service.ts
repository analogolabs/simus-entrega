import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { motivoDeLaAccion } from '../formularios/traductor-de-errores';
import type { AlbumDeGaleria, AlbumDeGaleriaResumen, ItemDeGaleria, TipoDeAlbum } from './galeria.service';

/** Un álbum tal como lo lista la consola: con su estado de publicación, su marca de destacado y su orden. */
export interface AlbumDeLaConsola extends AlbumDeGaleriaResumen {
  destacado: boolean;
  orden: number;
}

/** Un ítem tal como lo devuelve la consola: además de lo público, la miniatura del video (id) y si el ítem suelto se publica. */
export interface ItemDeLaConsola extends ItemDeGaleria {
  miniaturaArchivoId: number | null;
  publicado: boolean;
}

export interface AlbumDeLaConsolaCompleto extends Omit<AlbumDeGaleria, 'items'> {
  destacado: boolean;
  items: ItemDeLaConsola[];
}

/** Lo que se manda por cada ítem al guardar. */
export interface ItemParaGuardar {
  tipoItem: 'foto' | 'video';
  titulo: string | null;
  descripcion: string | null;
  detalle: string | null;
  fecha: string | null;
  credito: string | null;
  textoAlternativo: string | null;
  archivoId: number | null;
  videoId: string | null;
  duracionSegundos: number | null;
  miniaturaArchivoId: number | null;
  publicado: boolean;
}

export interface AlbumParaGuardar {
  titulo: string;
  descripcion: string | null;
  tipo: TipoDeAlbum;
  lugar: string | null;
  fechaReferencia: string | null;
  portadaArchivoId: number | null;
  listaOrigenUrl: string | null;
  orden: number;
  publicado: boolean;
  destacado: boolean;
  items: ItemParaGuardar[];
}

export interface ResultadoDeAdminGaleria<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const BASE = '/api/v1/institucional/galeria';

/**
 * LA GESTIÓN DE LA GALERÍA desde la consola: álbumes, sus ítems (fotos y videos) y los ítems sin álbum.
 *
 * Es la contraparte de `GaleriaService` (la lectura pública). Todo pasa por la API institucional: se abre con el módulo
 * «Banco de archivos», cada escritura lleva el testigo de la consola (lo pone el cliente HTTP) y deja su línea en la
 * auditoría. El álbum se guarda COMPLETO de una vez (como «Celebra la música»); publicar, destacar, ordenar y retirar se
 * hacen desde la lista sin abrir el álbum.
 */
@Injectable({ providedIn: 'root' })
export class GaleriaAdminService {
  private readonly api = inject(ApiClientService);

  async albumes(): Promise<ResultadoDeAdminGaleria<AlbumDeLaConsola[]>> {
    try {
      const r = await firstValueFrom(this.api.get<{ items: AlbumDeLaConsola[] }>(`${BASE}/albumes`, {}));
      return { ok: true, data: r?.items ?? [] };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible consultar los álbumes de la Galería.') };
    }
  }

  async album(slug: string): Promise<ResultadoDeAdminGaleria<AlbumDeLaConsolaCompleto | null>> {
    try {
      return { ok: true, data: await firstValueFrom(this.api.get<AlbumDeLaConsolaCompleto>(`${BASE}/albumes/${encodeURIComponent(slug)}`, {})) };
    } catch (error: unknown) {
      if ((error as { status?: number })?.status === 404) { return { ok: true, data: null }; }
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible consultar el álbum.') };
    }
  }

  async guardar(slug: string, album: AlbumParaGuardar): Promise<ResultadoDeAdminGaleria<AlbumDeLaConsolaCompleto>> {
    try {
      return { ok: true, data: await firstValueFrom(this.api.put<AlbumDeLaConsolaCompleto>(`${BASE}/albumes/${encodeURIComponent(slug)}`, album, {})) };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible guardar el álbum.') };
    }
  }

  /** Publica, despublica o destaca un álbum sin abrirlo; lo que se omite no se toca. */
  async cambiarEstado(slug: string, cambio: { publicado?: boolean; destacado?: boolean }): Promise<ResultadoDeAdminGaleria<AlbumDeLaConsola>> {
    try {
      return { ok: true, data: await firstValueFrom(this.api.put<AlbumDeLaConsola>(`${BASE}/albumes/${encodeURIComponent(slug)}/estado`, cambio, {})) };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible cambiar el estado del álbum.') };
    }
  }

  async ordenar(slugs: string[]): Promise<ResultadoDeAdminGaleria<AlbumDeLaConsola[]>> {
    try {
      const r = await firstValueFrom(this.api.put<{ items: AlbumDeLaConsola[] }>(`${BASE}/albumes-orden`, { slugs }, {}));
      return { ok: true, data: r?.items ?? [] };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible guardar el orden de los álbumes.') };
    }
  }

  /** Retira el álbum y sus ítems; las fotos siguen en el Banco de archivos. */
  async eliminar(slug: string): Promise<ResultadoDeAdminGaleria<void>> {
    try {
      await firstValueFrom(this.api.delete<void>(`${BASE}/albumes/${encodeURIComponent(slug)}`, {}));
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible eliminar el álbum.') };
    }
  }

  async sueltos(): Promise<ResultadoDeAdminGaleria<ItemDeLaConsola[]>> {
    try {
      const r = await firstValueFrom(this.api.get<{ items: ItemDeLaConsola[] }>(`${BASE}/sin-album`, {}));
      return { ok: true, data: r?.items ?? [] };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible consultar los ítems sin álbum.') };
    }
  }

  async guardarSueltos(items: ItemParaGuardar[]): Promise<ResultadoDeAdminGaleria<ItemDeLaConsola[]>> {
    try {
      const r = await firstValueFrom(this.api.put<{ items: ItemDeLaConsola[] }>(`${BASE}/sin-album`, { items }, {}));
      return { ok: true, data: r?.items ?? [] };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible guardar los ítems sin álbum.') };
    }
  }
}
