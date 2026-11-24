import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { motivoDeLaAccion } from '../formularios/traductor-de-errores';

/**
 * El micrositio «Celebra la música» y sus ediciones históricas.
 *
 * <b>SOLO LO EDITORIAL VIVE AQUÍ.</b> La programación y las noticias de una edición son la agenda y las noticias
 * generales del portal, filtradas por `proyectoCodigo` (el proyecto transversal de la edición): no hay módulo ni
 * agenda propios. Presentación, cifras, categorías, caja de herramientas, preguntas frecuentes, galería y colores
 * salen de la API y se editan desde la consola.
 */
export interface EdicionDeCelebraResumen {
  anio: number;
  nombre: string;
  hashtag: string | null;
  proyectoCodigo: string;
  actual: boolean;
  publicada: boolean;
  colorPrincipal: string;
  colorSecundario: string;
  imagenPortadaUrl: string | null;
  resumen: string | null;
}

export interface RecursoDeCelebra {
  id: number;
  grupo: string;
  titulo: string;
  descripcion: string | null;
  archivoId: number | null;
  /** Enlace https o ruta del Banco de archivos: lo que se abre al descargar. */
  url: string | null;
  orden: number;
}

export interface EdicionDeCelebra extends EdicionDeCelebraResumen {
  imagenPortadaArchivoId: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  presentacion: string | null;
  aliados: string | null;
  actividades: number | null;
  municipios: number | null;
  departamentos: number | null;
  organizaciones: number | null;
  musicos: number | null;
  fuente: string | null;
  pendienteDeValidar: boolean;
  fechaActualizacion: string | null;
  categorias: { nombre: string; descripcion: string | null; orden: number }[];
  recursos: RecursoDeCelebra[];
  preguntas: { pregunta: string; respuesta: string; orden: number }[];
  galeria: { archivoId: number; url: string; textoAlternativo: string; credito: string | null; orden: number }[];
}

export interface ResultadoDeCelebra<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Lo que la consola guarda de una edición completa (el `PUT` reemplaza lo hijo). */
export interface GuardarEdicionDeCelebra {
  nombre: string;
  hashtag: string | null;
  actual: boolean;
  publicada: boolean;
  colorPrincipal: string;
  colorSecundario: string;
  imagenPortadaArchivoId: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  resumen: string | null;
  presentacion: string | null;
  aliados: string | null;
  actividades: number | null;
  municipios: number | null;
  departamentos: number | null;
  organizaciones: number | null;
  musicos: number | null;
  fuente: string | null;
  pendienteDeValidar: boolean;
  categorias: { nombre: string; descripcion: string | null; orden: number }[];
  recursos: { grupo: string; titulo: string; descripcion: string | null; archivoId: number | null; url: string | null }[];
  preguntas: { pregunta: string; respuesta: string; orden: number }[];
  galeria: { archivoId: number; textoAlternativo: string; credito: string | null }[];
}

export interface CambioDeEdicion {
  fecha: string;
  usuario: string | null;
  accion: string;
  resumen: string;
}

@Injectable({ providedIn: 'root' })
export class CelebraLaMusicaService {
  private readonly api = inject(ApiClientService);
  private static readonly PUBLICO = '/api/v1/publico/celebra-la-musica/ediciones';

  private static readonly CONSOLA = '/api/v1/institucional/celebra-la-musica/ediciones';

  /** `previa` lee por la consola (con sesión) y trae también las ediciones en borrador: es la vista previa del micrositio. */
  async ediciones(previa = false): Promise<ResultadoDeCelebra<EdicionDeCelebraResumen[]>> {
    try {
      const url = previa ? CelebraLaMusicaService.CONSOLA : CelebraLaMusicaService.PUBLICO;
      const pagina = await firstValueFrom(this.api.get<{ items: EdicionDeCelebraResumen[] }>(url, {}));
      return { ok: true, data: pagina?.items ?? [] };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible consultar las ediciones de Celebra la música.') };
    }
  }

  async edicion(anio: number, previa = false): Promise<ResultadoDeCelebra<EdicionDeCelebra | null>> {
    try {
      const url = previa ? CelebraLaMusicaService.CONSOLA : CelebraLaMusicaService.PUBLICO;
      return { ok: true, data: await firstValueFrom(this.api.get<EdicionDeCelebra>(`${url}/${anio}`, {})) };
    } catch (error: unknown) {
      if ((error as { status?: number })?.status === 404) return { ok: true, data: null };
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible consultar la edición.') };
    }
  }

  /** Crea o reemplaza la edición de ese año (si no existe, el servidor crea también su proyecto transversal). */
  async guardar(anio: number, edicion: GuardarEdicionDeCelebra): Promise<ResultadoDeCelebra<EdicionDeCelebra>> {
    try {
      const data = await firstValueFrom(this.api.put<EdicionDeCelebra>(`${CelebraLaMusicaService.CONSOLA}/${anio}`, edicion, {}));
      return { ok: true, data };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible guardar la edición.') };
    }
  }

  async historial(anio: number): Promise<ResultadoDeCelebra<CambioDeEdicion[]>> {
    try {
      const r = await firstValueFrom(this.api.get<{ items: CambioDeEdicion[] }>(`${CelebraLaMusicaService.CONSOLA}/${anio}/historial`, {}));
      return { ok: true, data: r?.items ?? [] };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, 'No fue posible leer el historial.') };
    }
  }
}
