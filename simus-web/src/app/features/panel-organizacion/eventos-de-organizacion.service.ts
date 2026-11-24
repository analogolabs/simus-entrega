import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../../core/http/api-client.service';
import {
  AnunciarEventoSolicitud,
  EventoDeLaOrganizacion,
  EventoDeLaOrganizacionDetalle,
  ProcesoQueEnmarca,
  ResultadoDeGuardarEvento,
} from './panel-organizacion.api';
import { EntradaDeHistorialDeEstados } from '../../shared/components/ui/historial-de-estados/historial-de-estados.component';

/**
 * Los eventos que una organización anuncia sobre sus propios procesos.
 *
 * <b>POR QUÉ NO ESTÁ EN `PanelOrganizacionApi`.</b> Esa clase abstracta es el contrato de la ficha
 * de Festival, y la implementan también los dobles de prueba y el adaptador de la consola que
 * revisa fichas —que no anuncia eventos y nunca lo hará—. Meter aquí tres métodos más obligaría a
 * ocho dobles a declarar métodos que no usan, y al adaptador de revisión a negarlos uno por uno.
 * Los eventos son otra preocupación y viven en su propio servicio.
 *
 * <b>EL TESTIGO ANTIFALSIFICACIÓN ES EL DEL CANAL EXTERNO</b>, el mismo que usa el alta de
 * Festival: una sola forma de pedirlo, y no dos que puedan divergir.
 */
@Injectable({ providedIn: 'root' })
export class EventosDeOrganizacionService {
  private readonly api = inject(ApiClientService);

  /**
   * LA DIRECCIÓN DE LOS EVENTOS DE QUIEN ANUNCIA (LUT-01). Con un identificador de organización, la de esa
   * organización; sin él (cadena vacía), la de la persona sin organización desde «Mi espacio»: las mismas
   * operaciones, con las mismas reglas, sobre su taller, su espacio o su red.
   */
  private base(organizacionId: string): string {
    return organizacionId
      ? `/api/v1/externo/organizaciones/${organizacionId}/eventos`
      : '/api/v1/externo/mis-eventos';
  }

  private testigo(fallo: string): Observable<{ requestToken: string }> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', { errorFallback: fallo });
  }

  /**
   * Los procesos de la organización que pueden enmarcar un evento.
   *
   * SI VIENE VACIA, LA PANTALLA NO OFRECE EL FORMULARIO: una organización sin procesos publicados
   * no tiene qué anunciar en la Agenda.
   */
  procesosQueEnmarcan(organizacionId: string): Observable<ProcesoQueEnmarca[]> {
    return this.api.get<ProcesoQueEnmarca[]>(
      organizacionId
        ? `/api/v1/externo/organizaciones/${organizacionId}/procesos-que-enmarcan`
        : '/api/v1/externo/mis-eventos/procesos-que-enmarcan',
      { errorFallback: 'No fue posible consultar tus procesos' });
  }

  eventosDeLaOrganizacion(organizacionId: string): Observable<EventoDeLaOrganizacion[]> {
    return this.api.get<EventoDeLaOrganizacion[]>(
      this.base(organizacionId),
      { errorFallback: 'No fue posible consultar tus eventos' });
  }

  anunciarEvento(organizacionId: string, solicitud: AnunciarEventoSolicitud): Observable<{ id: string; estado: string }> {
    return this.testigo('No fue posible preparar el anuncio del evento').pipe(
      switchMap(token => this.api.post<{ id: string; estado: string }>(
        this.base(organizacionId),
        solicitud,
        {
          headers: { 'X-CSRF-TOKEN': token.requestToken },
          errorFallback: 'No fue posible anunciar el evento',
        },
      )),
    );
  }

  evento(organizacionId: string, eventoId: string): Observable<EventoDeLaOrganizacionDetalle> {
    return this.api.get<EventoDeLaOrganizacionDetalle>(
      `${this.base(organizacionId)}/${eventoId}`,
      { errorFallback: 'No fue posible abrir el evento' });
  }

  /**
   * Cambia un evento. UN EVENTO PUBLICADO ADMITE ERRATAS AL INSTANTE Y UN CAMBIO DE FONDO LO DEVUELVE
   * A REVISIÓN: lo decide el servidor comparando lo que hay con lo que llega, y lo dice en la
   * respuesta (`esErrata`, `cambiosDeFondo`).
   */
  editarEvento(
    organizacionId: string, eventoId: string, solicitud: AnunciarEventoSolicitud,
  ): Observable<ResultadoDeGuardarEvento> {
    return this.testigo('No fue posible preparar el cambio del evento').pipe(
      switchMap(token => this.api.put<ResultadoDeGuardarEvento>(
        `${this.base(organizacionId)}/${eventoId}`,
        solicitud,
        {
          headers: { 'X-CSRF-TOKEN': token.requestToken },
          errorFallback: 'No fue posible guardar el evento',
        },
      )),
    );
  }

  /** Envía a revisión un evento que estaba en borrador. */
  enviarARevision(organizacionId: string, eventoId: string): Observable<{ id: string; estado: string }> {
    return this.testigo('No fue posible preparar el envío del evento').pipe(
      switchMap(token => this.api.post<{ id: string; estado: string }>(
        `${this.base(organizacionId)}/${eventoId}/enviar`,
        {},
        {
          headers: { 'X-CSRF-TOKEN': token.requestToken },
          errorFallback: 'No fue posible enviar el evento a revisión',
        },
      )),
    );
  }

  /**
   * Retira de la agenda un evento publicado (D3-13). El motivo es obligatorio: lo retirado ya lo
   * vio el público.
   */
  retirarEvento(organizacionId: string, eventoId: string, motivo: string): Observable<{ id: string; estado: string }> {
    return this.testigo('No fue posible preparar el retiro del evento').pipe(
      switchMap(token => this.api.post<{ id: string; estado: string }>(
        `${this.base(organizacionId)}/${eventoId}/retirar`,
        { motivo },
        {
          headers: { 'X-CSRF-TOKEN': token.requestToken },
          errorFallback: 'No fue posible retirar el evento',
        },
      )),
    );
  }

  /**
   * Marca como cancelado un evento publicado (D3-13): sigue en la agenda, con su aviso y su motivo.
   */
  cancelarEvento(organizacionId: string, eventoId: string, motivo: string): Observable<{ id: string; estado: string; cancelado: boolean }> {
    return this.testigo('No fue posible preparar la cancelación del evento').pipe(
      switchMap(token => this.api.post<{ id: string; estado: string; cancelado: boolean }>(
        `${this.base(organizacionId)}/${eventoId}/cancelar`,
        { motivo },
        {
          headers: { 'X-CSRF-TOKEN': token.requestToken },
          errorFallback: 'No fue posible cancelar el evento',
        },
      )),
    );
  }

  /**
   * El historial de estados de un evento. Lo que decidió el PNMC llega firmado
   * «Equipo del PNMC», con su motivo y su fecha.
   */
  historial(organizacionId: string, eventoId: string): Observable<EntradaDeHistorialDeEstados[]> {
    return this.api.get<EntradaDeHistorialDeEstados[]>(
      `${this.base(organizacionId)}/${eventoId}/historial`,
      { errorFallback: 'No fue posible consultar el historial del evento' });
  }
}
