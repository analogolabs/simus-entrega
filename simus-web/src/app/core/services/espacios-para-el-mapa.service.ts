import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';
import { EspacioPublico, etiquetaDeAmbiente } from './espacios.service';

/**
 * Un espacio tal como lo consume el geovisor: la forma `{ id, fields }` con la que las capas de
 * Redes y Lutería ya leen sus registros (`buildPublicNetworkRecord`).
 */
export interface RegistroDeEspacioParaElMapa {
  id: string;
  fields: Record<string, string>;
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

/**
 * Los espacios para música en vivo publicados, para el geovisor y para el recuento del Inicio del Ecosistema.
 *
 * Los registros salen de la misma ruta pública que el directorio: solo lo publicado llega al mapa.
 * El tipo de espacio viaja como `centerType` y el equipamiento como `oficio`, que son los campos que el
 * geovisor ya muestra en la ficha de cada registro.
 */
@Injectable({ providedIn: 'root' })
export class EspaciosParaElMapaService {
  private readonly api = inject(ApiClientService);

  consultar(): Observable<{ records: RegistroDeEspacioParaElMapa[] }> {
    return this.api.get<{ items?: EspacioPublico[] }>('/api/v1/publico/espacios', {
      params: { limit: 500, offset: 0 },
      errorFallback: 'No fue posible cargar los espacios para música en vivo del mapa',
    }).pipe(
      map(respuesta => ({
        records: (Array.isArray(respuesta?.items) ? respuesta.items : []).map(espacio => ({
          id: String(espacio?.id ?? ''),
          fields: {
            name: texto(espacio?.nombre),
            departamento: texto(espacio?.nombreDepartamento),
            deptCode: texto(espacio?.codigoDepartamento),
            municipio: texto(espacio?.nombreMunicipio),
            divipola: texto(espacio?.codigoMunicipio),
            descripcion: texto(espacio?.descripcion),
            sitio_web: texto(espacio?.sitioWebEspacio),
            centerType: (espacio?.tipos ?? []).map(f => f.nombre).join(', ') || etiquetaDeAmbiente(espacio?.ambiente),
            oficio: (espacio?.equipamiento ?? []).map(s => s.nombre).join(', '),
          },
        })),
      })),
    );
  }
}
