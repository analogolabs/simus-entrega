import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';
import { RedPublica, etiquetaDeTipoDeNodo } from './redes.service';

/**
 * Una red tal como lo consume el geovisor: la forma `{ id, fields }` con la que la capa de
 * Responsablees ya lee sus registros (`buildPublicNetworkRecord`).
 */
export interface RegistroDeRedParaElMapa {
  id: string;
  fields: Record<string, string>;
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

/**
 * Las redes y documentación publicados, para el geovisor y para el recuento del Inicio del Ecosistema.
 *
 * <b>LA CAPA YA EXISTÍA Y SE ALIMENTABA DE UNA LISTA VACÍA.</b> El mapa declara «Responsablees» con su
 * color, su recuento por departamento y su ficha desde que el proceso se retiró; lo que no tenía era
 * de dónde leerlos. Este servicio es ese regreso, con la misma ruta pública que el directorio.
 */
@Injectable({ providedIn: 'root' })
export class RedesParaElMapaService {
  private readonly api = inject(ApiClientService);

  consultar(): Observable<{ records: RegistroDeRedParaElMapa[] }> {
    return this.api.get<{ items?: RedPublica[] }>('/api/v1/publico/redes', {
      params: { limit: 500, offset: 0 },
      errorFallback: 'No fue posible cargar las redes y documentación del mapa',
    }).pipe(
      map(respuesta => ({
        records: (Array.isArray(respuesta?.items) ? respuesta.items : []).map(red => ({
          id: String(red?.id ?? ''),
          fields: {
            name: texto(red?.nombre),
            departamento: texto(red?.nombreDepartamento),
            deptCode: texto(red?.codigoDepartamento),
            municipio: texto(red?.nombreMunicipio),
            divipola: texto(red?.codigoMunicipio),
            descripcion: texto(red?.descripcion),
            sitio_web: texto(red?.sitioWebRed),
            centerType: etiquetaDeTipoDeNodo(red?.tipoDeNodo),
            oficio: (red?.formasDeAcceso ?? []).map(s => s.nombre).join(', '),
          },
        })),
      })),
    );
  }
}
