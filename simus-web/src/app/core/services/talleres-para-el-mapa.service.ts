import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';
import { TallerPublico, etiquetaDeModalidad } from './talleres.service';

/**
 * Un taller tal como lo consume el geovisor: la forma `{ id, fields }` con la que la capa de
 * Lutieres ya lee sus registros (`buildPublicNetworkRecord`).
 */
export interface RegistroDeTallerParaElMapa {
  id: string;
  fields: Record<string, string>;
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

/**
 * Los talleres de lutería publicados, para el geovisor y para el recuento del Inicio del Ecosistema.
 *
 * <b>LA CAPA YA EXISTÍA Y SE ALIMENTABA DE UNA LISTA VACÍA.</b> El mapa declara «Lutieres» con su
 * color, su recuento por departamento y su ficha desde que el proceso se retiró; lo que no tenía era
 * de dónde leerlos. Este servicio es ese regreso, con la misma ruta pública que el directorio.
 */
@Injectable({ providedIn: 'root' })
export class TalleresParaElMapaService {
  private readonly api = inject(ApiClientService);

  consultar(): Observable<{ records: RegistroDeTallerParaElMapa[] }> {
    return this.api.get<{ items?: TallerPublico[] }>('/api/v1/publico/talleres', {
      params: { limit: 500, offset: 0 },
      errorFallback: 'No fue posible cargar los talleres de lutería del mapa',
    }).pipe(
      map(respuesta => ({
        records: (Array.isArray(respuesta?.items) ? respuesta.items : []).map(taller => ({
          id: String(taller?.id ?? ''),
          fields: {
            name: texto(taller?.nombre),
            departamento: texto(taller?.nombreDepartamento),
            deptCode: texto(taller?.codigoDepartamento),
            municipio: texto(taller?.nombreMunicipio),
            divipola: texto(taller?.codigoMunicipio),
            descripcion: texto(taller?.descripcion),
            sitio_web: texto(taller?.sitioWebTaller),
            centerType: etiquetaDeModalidad(taller?.modalidad),
            oficio: (taller?.servicios ?? []).map(s => s.nombre).join(', '),
          },
        })),
      })),
    );
  }
}
