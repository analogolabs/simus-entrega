import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { motivoDeLaAccion } from '../formularios/traductor-de-errores';
import { ApiClientService } from '../http/api-client.service';

/** Las tres listas que se administran; el territorio son los departamentos de DIVIPOLA y no se editan aquí. */
export type DimensionDePerfil = 'rol' | 'servicio' | 'instrumento';

/** Un valor de la taxonomía de perfiles tal como lo ve la consola (decisión 133). */
export interface ValorDeTaxonomiaAdministrado {
  id: number;
  dimension: DimensionDePerfil;
  codigo: string;
  nombre: string;
  grupoSoyCultura: string | null;
  fuente: string | null;
  activo: boolean;
  ordenVisualizacion: number;
  /** Cuántos perfiles lo tienen guardado: dice qué consecuencias tiene desactivarlo. */
  personas: number;
  /** Solo roles: la categoría de la que es subcategoría (decisión 135). */
  idPadre: number | null;
  codigoDePadre: string | null;
  /** Cuántas subcategorías tiene (solo una categoría). */
  subcategorias: number;
}

export interface ListaDeTaxonomia {
  items: ValorDeTaxonomiaAdministrado[];
  total: number;
  maximos: Record<DimensionDePerfil, number>;
}

export interface CambiosDeValorDeTaxonomia {
  dimension?: DimensionDePerfil;
  nombre: string;
  grupoSoyCultura: string | null;
  fuente: string | null;
  activo: boolean;
  /** Solo al crear un rol: la categoría de la que será subcategoría. */
  idPadre?: number | null;
}

export interface ResultadoDeTaxonomia<T> {
  ok: boolean;
  data?: T | null;
  error?: string;
}

/**
 * Administración de roles, servicios e instrumentos con los que una persona se clasifica (decisión 133, DIR).
 * Nada se borra: un valor se desactiva y los perfiles que ya lo tienen lo conservan.
 */
@Injectable({ providedIn: 'root' })
export class TaxonomiaDePerfilesAdminService {
  private readonly api = inject(ApiClientService);
  private static readonly CONSOLA = '/api/v1/institucional/taxonomia-de-perfiles';

  private async envolver<T>(operacion: () => Promise<T>, respaldo: string): Promise<ResultadoDeTaxonomia<T>> {
    try {
      return { ok: true, data: await operacion() };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, respaldo) };
    }
  }

  listar() {
    return this.envolver(
      () => firstValueFrom(this.api.get<ListaDeTaxonomia>(TaxonomiaDePerfilesAdminService.CONSOLA, {})),
      'No fue posible consultar las listas de perfiles.');
  }

  crear(cambios: CambiosDeValorDeTaxonomia) {
    return this.envolver(
      () => firstValueFrom(this.api.post<ValorDeTaxonomiaAdministrado>(TaxonomiaDePerfilesAdminService.CONSOLA, cambios, {})),
      'No fue posible crear el valor.');
  }

  guardar(id: number, cambios: CambiosDeValorDeTaxonomia) {
    return this.envolver(
      () => firstValueFrom(this.api.put<ValorDeTaxonomiaAdministrado>(`${TaxonomiaDePerfilesAdminService.CONSOLA}/${id}`, cambios, {})),
      'No fue posible guardar el valor.');
  }

  /** Cambia un rol de categoría (nulo lo vuelve categoría); aparte de guardar para que renombrar no lo mueva. */
  cambiarDeCategoria(id: number, idPadre: number | null) {
    return this.envolver(
      () => firstValueFrom(this.api.post<ValorDeTaxonomiaAdministrado>(`${TaxonomiaDePerfilesAdminService.CONSOLA}/${id}/categoria`, { idPadre }, {})),
      'No fue posible cambiar de categoría.');
  }

  mover(id: number, sentido: -1 | 1) {
    return this.envolver(
      () => firstValueFrom(this.api.post<ValorDeTaxonomiaAdministrado>(`${TaxonomiaDePerfilesAdminService.CONSOLA}/${id}/mover`, { sentido }, {})),
      'No fue posible reordenar.');
  }
}
