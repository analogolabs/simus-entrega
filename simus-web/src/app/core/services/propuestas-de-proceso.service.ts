import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';

/** El segmento de ruta de un proceso que admite propuestas de cambio sobre lo publicado (PROP, decisión 122). */
export type RutaDeProcesoConPropuestas = 'mercados' | 'talleres' | 'espacios' | 'redes';

/** El módulo con el que viaja la propuesta, y la ruta del proceso al que corresponde. */
export const RUTA_DE_PROPUESTAS_POR_MODULO: Readonly<Record<string, RutaDeProcesoConPropuestas>> = {
  mercados: 'mercados',
  talleres: 'talleres',
  espacios: 'espacios',
  redes: 'redes',
};

/**
 * Un campo que una propuesta de cambio quiere modificar, con lo que decía y lo que pasaría a decir.
 *
 * <b>`valorAnterior` ES NULO HASTA QUE SE ENVIA.</b> Se copia del registro en el momento del envío, que es cuando el
 * Programa se compromete a mirarlo: leerlo del presente haría que, tras aplicar la propuesta, la comparación dijera
 * que no cambió nada. Los `…Legible` traducen los identificadores de vocabulario y los códigos al nombre.
 */
export interface CampoPropuesto {
  id: number;
  seccionId: string;
  campoId: string;
  campoEtiqueta: string;
  valorAnterior: string | null;
  valorPropuesto: string | null;
  valorAnteriorLegible?: string | null;
  valorPropuestoLegible?: string | null;
}

/**
 * La propuesta de cambio sobre un proceso ya publicado: de Mercado, Taller, Espacio o Red.
 *
 * <b>CON `id` EN CERO NO HAY NINGUNA.</b> El servidor devuelve una carcasa vacía en vez de un 404: la pantalla se
 * pinta igual en los dos casos.
 */
export interface PropuestaDeCambio {
  id: number;
  moduloId: string;
  registroId: string;
  nombreDelRegistro: string;
  /** borrador | en_revision | ajustes_solicitados | aplicada | rechazada. */
  estado: string;
  motivo: string | null;
  organizacionNombre: string | null;
  proponenteNombre: string | null;
  decideNombre: string | null;
  motivoDeLaDecision: string | null;
  fechaEnvio: string | null;
  fechaDecision: string | null;
  campos: CampoPropuesto[];
}

/** Una propuesta esperando decisión, como la enseña la bandeja del Programa. */
export interface PropuestaEnRevision {
  id: number;
  moduloId: string;
  registroId: string;
  nombreDelRegistro: string;
  organizacionNombre: string | null;
  proponenteNombre: string | null;
  motivo: string | null;
  camposQueCambian: number;
  fechaEnvio: string | null;
}

export interface CampoDeLaPropuesta {
  campoId: string;
  valorPropuesto: string | null;
}

export type DecisionSobreLaPropuesta = 'aplicar' | 'pedir_ajustes' | 'rechazar';

/**
 * Las propuestas de cambio de cualquier proceso, desde quien responde por él y desde la consola: UN solo cliente
 * para los cuatro tipos, porque las rutas y las formas son las mismas y solo cambia el segmento.
 *
 * <b>LO PUBLICADO NO SE EDITA EN CALIENTE.</b> Entre la intención de quien responde y la ficha que el público está
 * leyendo hay una decisión del Programa, y eso es todo lo que hace este circuito.
 */
@Injectable({ providedIn: 'root' })
export class PropuestasDeProcesoService {
  private readonly api = inject(ApiClientService);

  private testigoExterno(mensaje: string): Observable<{ requestToken: string }> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', { errorFallback: mensaje });
  }

  // ───────────────────────────── Quien responde por el proceso ─────────────────────────────

  /** La propuesta viva de un proceso, o la carcasa vacía (`id` en cero). */
  deMi(ruta: RutaDeProcesoConPropuestas, id: string | number): Observable<PropuestaDeCambio> {
    return this.api.get<PropuestaDeCambio>(`/api/v1/externo/${ruta}/${id}/propuesta`, {
      errorFallback: 'No fue posible consultar tu propuesta de cambio',
    });
  }

  /** El borrador entero, con semántica de reemplazo. No toca lo publicado. */
  guardar(
    ruta: RutaDeProcesoConPropuestas, id: string | number, motivo: string | null, campos: CampoDeLaPropuesta[],
  ): Observable<PropuestaDeCambio> {
    return this.testigoExterno('No fue posible preparar la propuesta').pipe(
      switchMap(token => this.api.put<PropuestaDeCambio>(`/api/v1/externo/${ruta}/${id}/propuesta`, { motivo, campos }, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar la propuesta de cambio',
      })),
    );
  }

  /** Envía la propuesta al Programa; aquí se congela el «antes». */
  enviar(ruta: RutaDeProcesoConPropuestas, id: string | number): Observable<PropuestaDeCambio> {
    return this.testigoExterno('No fue posible preparar el envío').pipe(
      switchMap(token => this.api.post<PropuestaDeCambio>(`/api/v1/externo/${ruta}/${id}/propuesta/enviar`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible enviar la propuesta de cambio',
      })),
    );
  }

  /** Abandona el borrador; lo ya enviado no se abandona. */
  abandonar(ruta: RutaDeProcesoConPropuestas, id: string | number): Observable<void> {
    return this.testigoExterno('No fue posible preparar la operación').pipe(
      switchMap(token => this.api.delete<void>(`/api/v1/externo/${ruta}/${id}/propuesta`, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible abandonar la propuesta de cambio',
      })),
    );
  }

  // ───────────────────────────────────── La consola ─────────────────────────────────────

  /** Las propuestas de un tipo que esperan una decisión, para la bandeja. */
  enRevision(ruta: RutaDeProcesoConPropuestas): Observable<PropuestaEnRevision[]> {
    return this.api.get<PropuestaEnRevision[]>(`/api/v1/institucional/${ruta}/propuestas/en-revision`, {
      errorFallback: 'No fue posible leer las propuestas de cambio',
    });
  }

  /** La propuesta enviada de un proceso, con la comparación campo por campo. */
  enviadaDe(ruta: RutaDeProcesoConPropuestas, id: string | number): Observable<PropuestaDeCambio> {
    return this.api.get<PropuestaDeCambio>(`/api/v1/institucional/${ruta}/${id}/propuesta`, {
      errorFallback: 'No fue posible leer la propuesta de cambio',
    });
  }

  /**
   * La decisión del Programa. <b>RECHAZAR Y PEDIR AJUSTES EXIGEN MOTIVO</b>, y el servidor lo rechaza si falta;
   * aplicar no. Va con testigo: aplicar cambia lo que el público está leyendo, así que la petición tiene que
   * demostrar que sale de nuestra propia página.
   */
  decidir(
    ruta: RutaDeProcesoConPropuestas, propuestaId: number, decision: DecisionSobreLaPropuesta, motivo?: string,
  ): Observable<PropuestaDeCambio> {
    return this.api.get<{ requestToken: string }>(`/api/v1/institucional/${ruta}/propuestas/csrf`, {
      errorFallback: 'No fue posible preparar la decisión sobre la propuesta',
    }).pipe(
      switchMap(testigo => this.api.post<PropuestaDeCambio>(
        `/api/v1/institucional/${ruta}/propuestas/${propuestaId}/decision`,
        { decision, motivo: motivo ?? null },
        {
          headers: { 'X-CSRF-TOKEN': testigo.requestToken },
          errorFallback: 'No fue posible registrar la decisión sobre la propuesta',
        })),
    );
  }
}
