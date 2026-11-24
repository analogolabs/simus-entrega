import { motivoDeLaAccion } from '../formularios/traductor-de-errores';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';

/**
 * Las categorías temáticas de Agenda, Noticias y Catálogo Editorial.
 *
 * <b>POR QUE EXISTEN.</b> Los tres módulos guardaban su categoría como texto libre: nadie podía
 * corregir un nombre mal escrito sin editar cada ficha, y dos personas escribían «Convocatorias» y
 * «convocatoria» sin que nada lo impidiera.
 *
 * Cada módulo utiliza su catálogo propio. Editorial incorpora una jerarquía de dos niveles.
 */

export interface CategoriaDeContenido {
  id: number;
  categoriaPadreId?: number | null;
  codigoModulo: string;
  nombreCategoria: string;
  slug: string;
  descripcion: string | null;
  ordenVisualizacion: number;
  /** Cuántos contenidos la usan. Es lo que permite decidir si compartirla o retirarla. */
  contenidosQueLaUsan: number;
}

/** Los módulos que pueden tener categorías propias, más el compartido. */
export const MODULOS_DE_CATEGORIA = ['agenda', 'noticias', 'editorial'] as const;

export const ETIQUETAS_DE_MODULO: Record<string, string> = {
  agenda: 'Agenda y eventos',
  noticias: 'Noticias y prensa',
  editorial: 'Catálogo Editorial',
  comun: 'Común · revisión editorial',
};

export interface ResultadoDeCategoria<T> {
  ok: boolean;
  data?: T | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriasDeContenidoService {
  private readonly api = inject(ApiClientService);

  private static readonly CONSOLA = '/api/v1/institucional/categorias-contenido';
  private static readonly PUBLICO = '/api/v1/publico/categorias-contenido';

  private async envolver<T>(operacion: () => Promise<T>, respaldo: string): Promise<ResultadoDeCategoria<T>> {
    try {
      return { ok: true, data: await operacion() };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, respaldo) };
    }
  }

  /** Las de un módulo —con las comunes— o todas si no se pide ninguno. */
  listar(modulo?: string) {
    const params = modulo ? `?modulo=${encodeURIComponent(modulo)}` : '';
    return this.envolver(
      () => firstValueFrom(this.api.get<{ items: CategoriaDeContenido[] }>(`${CategoriasDeContenidoService.CONSOLA}${params}`, {})),
      'No fue posible consultar las categorías.');
  }

  /** La misma lectura, sin sesión. La usan las pantallas del portal. */
  listarPublicas(modulo?: string) {
    const params = modulo ? `?modulo=${encodeURIComponent(modulo)}` : '';
    return this.envolver(
      () => firstValueFrom(this.api.get<{ items: CategoriaDeContenido[] }>(`${CategoriasDeContenidoService.PUBLICO}${params}`, {})),
      'No fue posible consultar las categorías.');
  }

  crear(categoria: { codigoModulo: string; nombreCategoria: string; categoriaPadreId?: number | null; descripcion?: string | null }) {
    return this.envolver(
      () => firstValueFrom(this.api.post<CategoriaDeContenido>(CategoriasDeContenidoService.CONSOLA, categoria, {})),
      'No fue posible crear la categoría.');
  }

  guardar(id: number, categoria: { codigoModulo: string; nombreCategoria: string; categoriaPadreId?: number | null; descripcion?: string | null; ordenVisualizacion?: number }) {
    return this.envolver(
      () => firstValueFrom(this.api.put<CategoriaDeContenido>(`${CategoriasDeContenidoService.CONSOLA}/${id}`, categoria, {})),
      'No fue posible guardar la categoría.');
  }

  /**
   * Pasa el contenido de una categoría a otra y retira la que queda vacía.
   *
   * ES LO QUE HACE REVERSIBLE LA DECISION entre categorías propias y comunes. Sin fusionar, elegir
   * mal era definitivo: había que reasignar a mano ficha por ficha.
   */
  fusionar(id: number, destinoId: number) {
    return this.envolver(
      () => firstValueFrom(this.api.post<CategoriaDeContenido>(`${CategoriasDeContenidoService.CONSOLA}/${id}/fusionar`, { destinoId }, {})),
      'No fue posible fusionar la categoría.');
  }

  eliminar(id: number) {
    return this.envolver(
      () => firstValueFrom(this.api.delete<void>(`${CategoriasDeContenidoService.CONSOLA}/${id}`, {})),
      'No fue posible eliminar la categoría.');
  }
}
