import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';

/** Quién tiene la pelota: la persona, otra parte (el PNMC u otra persona) o ya se resolvió. */
export type EsperaDeSolicitud = 'tu_accion' | 'en_espera' | 'resuelta';

/**
 * Una solicitud o asunto abierto, con la MISMA forma para todos los tipos de proceso (Festival, Mercado,
 * Taller de lutería, Espacio, Red, evento, cita…): el tipo solo cambia el rótulo y la dirección (SOL;
 * modelo común de procesos, docs/desarrollo/30-consola-y-acceso.md).
 */
export interface SolicitudDeLaCuenta {
  clave: string;
  tipo: string;
  tipoEtiqueta: string;
  titulo: string;
  espera: EsperaDeSolicitud;
  estadoEtiqueta: string;
  detalle: string | null;
  organizacionId: number | null;
  organizacionNombre: string | null;
  fecha: string;
  ruta: string;
}

export interface ConteoDeSolicitudes { esperanTuAccion: number; esperanRespuesta: number; resueltas: number }

/** Lectura de «Mi actividad y solicitudes» y de la insignia de Solicitudes. Solo lectura: nada se escribe aquí. */
@Injectable({ providedIn: 'root' })
export class SolicitudesDeLaCuentaService {
  private readonly http = inject(ApiClientService);

  /** Con `archivadas`, solo las resueltas hace más de 90 días (siguen guardadas; la lista normal ya no las trae). */
  deLaCuenta(archivadas = false): Observable<SolicitudDeLaCuenta[]> {
    return this.http.get<SolicitudDeLaCuenta[]>(`/api/v1/externo/cuenta/solicitudes${archivadas ? '?archivadas=true' : ''}`, { errorFallback: 'No fue posible consultar tus solicitudes.' });
  }

  deLaOrganizacion(organizacionId: string, archivadas = false): Observable<SolicitudDeLaCuenta[]> {
    return this.http.get<SolicitudDeLaCuenta[]>(`/api/v1/externo/organizaciones/${organizacionId}/solicitudes${archivadas ? '?archivadas=true' : ''}`, { errorFallback: 'No fue posible consultar las solicitudes.' });
  }

  conteoDeLaOrganizacion(organizacionId: string): Observable<ConteoDeSolicitudes> {
    return this.http.get<ConteoDeSolicitudes>(`/api/v1/externo/organizaciones/${organizacionId}/solicitudes/conteo`, { errorFallback: 'No fue posible consultar las solicitudes.' });
  }
}
