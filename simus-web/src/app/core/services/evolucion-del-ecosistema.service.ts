import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';

/** Cuántas ediciones publicadas de un tipo de proceso hubo en un año, en el departamento de la sede. */
export interface PuntoDeEvolucion {
  readonly proceso: string;
  readonly anio: number;
  readonly departamento: string;
  readonly total: number;
}

interface PuntoCrudo {
  readonly proceso?: string;
  readonly anio?: number;
  readonly departamento?: string | null;
  readonly total?: number;
}

/**
 * La evolución del ecosistema, tal como la agrega el servidor.
 *
 * <b>NO SE CALCULA EN EL NAVEGADOR.</b> Las ediciones por año no viajan en las listas públicas que
 * alimentan el mapa (solo la vigente), y traer las de cada proceso sería una petición por registro.
 * `/publico/analitica/ecosistema/evolucion` devuelve ya el conteo por año, tipo de proceso y
 * departamento de la sede, sobre lo publicado.
 */
@Injectable({ providedIn: 'root' })
export class EvolucionDelEcosistemaService {
  private readonly api = inject(ApiClientService);

  consultar(): Observable<readonly PuntoDeEvolucion[]> {
    return this.api.get<{ puntos?: PuntoCrudo[] }>('/api/v1/publico/analitica/ecosistema/evolucion', {
      errorFallback: 'No fue posible cargar la evolución del ecosistema',
    }).pipe(
      map((respuesta) => (Array.isArray(respuesta?.puntos) ? respuesta.puntos : [])
        .filter((punto) => Number.isFinite(punto?.anio) && Number(punto?.total) > 0)
        .map((punto) => ({
          proceso: String(punto.proceso ?? ''),
          anio: Number(punto.anio),
          departamento: String(punto.departamento ?? ''),
          total: Number(punto.total),
        }))),
    );
  }
}
