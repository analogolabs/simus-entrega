import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../../core/http/api-client.service';

/** Un tipo del catálogo único de procesos, con si se puede reclamar y, si no, por qué (decisión 129). */
export interface TipoDeProcesoHistorico {
  modulo: string;
  etiqueta: string;
  etiquetaPlural: string;
  reclamable: boolean;
  motivoNoReclamable: string | null;
}

/** Un proceso histórico sin organización que la organización puede reclamar (decisión 129; antes). */
export interface ProcesoHistoricoReclamable {
  modulo: string;
  tipoEtiqueta: string;
  id: string;
  nombre: string;
  descripcion: string | null;
  organizadorAnterior: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  nombreDepartamento: string | null;
  codigoMunicipio: string | null;
  nombreMunicipio: string | null;
  periodicidad: string | null;
  aniosDeEdiciones: number[];
  /** Otra organización ya pidió administrarlo y su solicitud está en revisión. */
  reclamacionEnCurso: boolean;
  reclamacionPropiaId: string | null;
  reclamacionPropiaEstado: string | null;
  /** El servidor reúne varias coincidencias con la organización: se destaca, con su motivo. */
  coincidenciaFuerte: boolean;
  puntajeDeCoincidencia: number | null;
  motivoDeCoincidencia: string | null;
}

/**
 * La búsqueda de procesos históricos. Sin criterio solo llegan `sugeridos` (coincidencia fuerte);
 * con criterio, `resultados`.
 */
export interface ProcesosHistoricos {
  hayBusqueda: boolean;
  tipos: TipoDeProcesoHistorico[];
  resultados: ProcesoHistoricoReclamable[];
  sugeridos: ProcesoHistoricoReclamable[];
  avisoDelTipo: string | null;
}

/** Lo que la persona pide: todo opcional; vacío en todo es «no buscó». */
export interface FiltrosDeProcesosHistoricos {
  tipo?: string;
  buscar?: string;
  codigoDepartamento?: string;
  codigoMunicipio?: string;
}

export interface ReclamacionDeFestival {
  id: string;
  dominio: string;
  registroCanonicoId: string;
  estado: string;
  justificacion: string;
  motivoDecision?: string | null;
  fechaCreacion: string;
  fechaDecision?: string | null;
  registroNombre?: string | null;
  /** Los soportes adjuntos, con su enlace al Banco de archivos. */
  soportes?: { archivoId: string; nombre: string; tipo: string; bytes: number | null; url: string; fecha: string }[] | null;
}

/** El estado de una reclamación en palabras de quien la pide (el mismo rótulo que en Solicitudes). */
export function etiquetaDeReclamacion(estado: string): string {
  return ({
    borrador: 'Borrador', enviada: 'Enviada', en_revision: 'En revisión', requiere_aclaracion: 'Requiere aclaración',
    aclaracion_enviada: 'Aclaración enviada', aprobada: 'Aprobada: falta elegir datos', rechazada: 'Rechazada',
    cancelada: 'Cancelada', transferencia_ejecutada: 'Administración transferida', historica: 'Histórica',
  } as Record<string, string>)[estado] ?? 'Sin estado';
}

/** Los estados en los que la reclamación sigue abierta. */
export const RECLAMACION_ABIERTA = ['borrador', 'enviada', 'en_revision', 'requiere_aclaracion', 'aclaracion_enviada', 'aprobada'];

/**
 * Descubrir y reclamar procesos históricos (Festivales y Mercados) desde el panel.
 *
 * <b>UN SOLO SITIO PARA LAS RUTAS.</b> El asistente, la lista de Festivales, el resumen y
 * Solicitudes hablan del mismo trámite; con las rutas repartidas, cada pantalla acababa con su
 * propia idea de qué es una reclamación «abierta».
 */
@Injectable({ providedIn: 'root' })
export class ReclamacionesDeProcesosService {
  private readonly http = inject(ApiClientService);

  procesos(organizacionId: string, filtros: FiltrosDeProcesosHistoricos = {}): Observable<ProcesosHistoricos> {
    const params: Record<string, string> = {};
    if (filtros.tipo) params['tipo'] = filtros.tipo;
    if (filtros.buscar?.trim()) params['buscar'] = filtros.buscar.trim();
    if (filtros.codigoDepartamento) params['codigoDepartamento'] = filtros.codigoDepartamento;
    if (filtros.codigoMunicipio) params['codigoMunicipio'] = filtros.codigoMunicipio;
    return this.http.get<ProcesosHistoricos>(`/api/v1/externo/organizaciones/${organizacionId}/procesos-historicos`,
      { params, errorFallback: 'No fue posible consultar los procesos históricos.' });
  }

  reclamaciones(organizacionId: string): Observable<ReclamacionDeFestival[]> {
    return this.http.get<ReclamacionDeFestival[]>(`/api/v1/externo/organizaciones/${organizacionId}/reclamaciones-administracion`,
      { errorFallback: 'No fue posible consultar las solicitudes de administración.' });
  }

  reclamar(organizacionId: string, registroId: string, justificacion: string, borradorId: string | null = null, soportes: string[] = [], modulo = 'festivales'): Observable<ReclamacionDeFestival> {
    return this.http.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', { errorFallback: 'No fue posible preparar la solicitud de administración.' }).pipe(
      switchMap(token => this.http.post<ReclamacionDeFestival>(`/api/v1/externo/organizaciones/${organizacionId}/reclamaciones-administracion`, {
        modulo, registroId, festivalId: modulo === 'festivales' ? registroId : null, borradorId, justificacion: justificacion.trim(), soportes,
        senalesJson: JSON.stringify([borradorId ? 'Coincidencia en el alta de Festival' : 'Elegido en la lista de procesos históricos']),
      }, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible enviar la solicitud de administración.' })),
    );
  }
}
