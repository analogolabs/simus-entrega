import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';

export interface IndicadorAnalisisAdministrativo {
  id: string;
  rotulo: string;
  total: number;
  alcance: string;
}

export interface TableroAnalisisAdministrativo {
  generadoEn: string;
  indicadores: IndicadorAnalisisAdministrativo[];
  estadosFestival: string[][];
  /** Mercados musicales por estado: un módulo del Ecosistema se ve en el tablero como Festivales. */
  estadosMercado: string[][];
  departamentosPrincipales: string[][];
  /** Procesos con la sede principal pendiente de completar, por tipo (tipo, total). De toda la operación. */
  sedesPendientes?: string[][] | null;
  /** El territorio por el que se acotó el tablero, o nulo si es todo el país. */
  acotadoA?: string | null;
}

/**
 * El tablero del panorama administrativo.
 *
 * <b>SOLO EL TABLERO.</b> El estado del asistente y las preguntas se fueron a
 * `ConsultaGuiadaService`, cuando la Consulta Guiada pasó a existir
 * también en el espacio de las organizaciones: mantener aquí una copia de esas dos llamadas habría
 * dejado dos formas de leer la misma respuesta.
 */
@Injectable({ providedIn: 'root' })
export class AnalisisAdministrativoService {
  private readonly api = inject(ApiClientService);

  /** El tablero, acotado por la SEDE principal si se pide (departamento y, con él, municipio). */
  tablero(sede: { departamento?: string; municipio?: string } = {}): Observable<TableroAnalisisAdministrativo> {
    const params: Record<string, string> = {};
    if (sede.departamento) params['departamento'] = sede.departamento;
    if (sede.departamento && sede.municipio) params['municipio'] = sede.municipio;
    return this.api.get<TableroAnalisisAdministrativo>('/api/v1/admin/analisis/tablero', {
      params,
      errorFallback: 'No fue posible construir el tablero administrativo',
    });
  }
}
