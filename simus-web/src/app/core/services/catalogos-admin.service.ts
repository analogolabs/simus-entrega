import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { motivoDeLaAccion } from '../formularios/traductor-de-errores';
import { ApiClientService } from '../http/api-client.service';

/**
 * La administración de los catálogos «Territorios sonoros» y «Prácticas musicales» (sección «Catálogos» de la consola).
 *
 * <b>POR QUÉ EXISTE.</b> Eran tablas que solo se tocaban con una migración: el área misional no podía agregar una
 * práctica, ordenarlas ni completar su ficha. Aquí se hace desde la consola; el servidor valida (nombre único sin
 * tildes, largos, dos niveles) y no deja eliminar lo que está en uso: se desactiva.
 */
export type TipoDeCatalogo = 'territorios-sonoros' | 'practicas-musicales';

export type EstadoDeFicha = 'completa' | 'preliminar' | 'pendiente';

export interface UsoDeCatalogo { fuente: string; total: number }

export interface ElementoDeCatalogo {
  id: number;
  nombre: string;
  slug: string;
  orden: number;
  activo: boolean;
  padreId: number | null;
  padreNombre: string | null;
  sinonimos: string | null;
  observaciones: string | null;
  definicionBreve: string | null;
  definicionAmpliada: string | null;
  caracteristicas: string | null;
  relacionTerritorial: string | null;
  contextos: string | null;
  ejemplos: string | null;
  fuentes: string | null;
  esPreliminar: boolean;
  imagenArchivoId: number | null;
  imagenUrl: string | null;
  textoAlternativoRecurso: string | null;
  fechaActualizacion: string | null;
  totalDeUsos: number;
  usos: UsoDeCatalogo[];
  subelementos: number;
  estadoDeFicha: EstadoDeFicha;
}

/** Lo que se guarda de un elemento y su ficha. */
export interface FormularioDeElemento {
  nombre: string;
  orden?: number | null;
  activo: boolean;
  padreId: number | null;
  sinonimos: string | null;
  observaciones: string | null;
  definicionBreve: string | null;
  definicionAmpliada: string | null;
  caracteristicas: string | null;
  relacionTerritorial: string | null;
  contextos: string | null;
  ejemplos: string | null;
  fuentes: string | null;
  esPreliminar: boolean;
  imagenArchivoId: number | null;
  textoAlternativoRecurso: string | null;
}

export interface EntradaDeHistorial { id: number; fecha: string; accion: string; autor: string | null; resumen: string }

export interface FilaDeImportacion { numero: number; nombre: string; accion: 'crear' | 'actualizar' | 'sin-cambios' | 'error'; cambios: string[]; errores: string[] }

export interface ResultadoDeImportacion {
  aplicada: boolean; crea: number; actualiza: number; sinCambios: number; conErrores: number; filas: FilaDeImportacion[];
}

export interface ResultadoDeCatalogo<T> { ok: boolean; data?: T | null; error?: string }

@Injectable({ providedIn: 'root' })
export class CatalogosAdminService {
  private readonly api = inject(ApiClientService);
  private static readonly CONSOLA = '/api/v1/institucional/catalogos';

  private async envolver<T>(operacion: () => Promise<T>, respaldo: string): Promise<ResultadoDeCatalogo<T>> {
    try {
      return { ok: true, data: await operacion() };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, respaldo) };
    }
  }

  private ruta(tipo: TipoDeCatalogo, resto = ''): string { return `${CatalogosAdminService.CONSOLA}/${tipo}${resto}`; }

  listar(tipo: TipoDeCatalogo) {
    return this.envolver(() => firstValueFrom(this.api.get<{ items: ElementoDeCatalogo[]; total: number }>(this.ruta(tipo), {})),
      'No fue posible consultar el catálogo.');
  }

  crear(tipo: TipoDeCatalogo, cuerpo: FormularioDeElemento) {
    return this.envolver(() => firstValueFrom(this.api.post<ElementoDeCatalogo>(this.ruta(tipo), cuerpo, {})), 'No fue posible crear el elemento.');
  }

  guardar(tipo: TipoDeCatalogo, id: number, cuerpo: FormularioDeElemento) {
    return this.envolver(() => firstValueFrom(this.api.put<ElementoDeCatalogo>(this.ruta(tipo, `/${id}`), cuerpo, {})), 'No fue posible guardar el elemento.');
  }

  cambiarActivo(tipo: TipoDeCatalogo, id: number, activo: boolean) {
    return this.envolver(() => firstValueFrom(this.api.post<ElementoDeCatalogo>(this.ruta(tipo, `/${id}/activo`), { activo }, {})),
      'No fue posible cambiar el estado del elemento.');
  }

  eliminar(tipo: TipoDeCatalogo, id: number) {
    return this.envolver(() => firstValueFrom(this.api.delete<void>(this.ruta(tipo, `/${id}`), {})), 'No fue posible eliminar el elemento.');
  }

  ordenar(tipo: TipoDeCatalogo, ids: number[]) {
    return this.envolver(() => firstValueFrom(this.api.post<{ items: ElementoDeCatalogo[]; total: number }>(this.ruta(tipo, '/orden'), { ids }, {})),
      'No fue posible guardar el orden.');
  }

  historial(tipo: TipoDeCatalogo, id: number) {
    return this.envolver(() => firstValueFrom(this.api.get<{ items: EntradaDeHistorial[] }>(this.ruta(tipo, `/${id}/historial`), {})),
      'No fue posible consultar el historial.');
  }

  importar(tipo: TipoDeCatalogo, filas: Record<string, string>[], aplicar: boolean) {
    return this.envolver(() => firstValueFrom(this.api.post<ResultadoDeImportacion>(this.ruta(tipo, '/importar'), { filas, aplicar }, {})),
      'No fue posible importar la hoja.');
  }
}
