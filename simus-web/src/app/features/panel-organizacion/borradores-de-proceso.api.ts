import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../../core/http/api-client.service';

/** El módulo del proceso al que pertenece un borrador. */
export type ModuloDeBorrador = 'festivales' | 'mercados';

/** Un registro sin terminar de la persona en una organización. */
export interface BorradorPendiente {
  id: string;
  moduloId: ModuloDeBorrador;
  nombre: string | null;
  version: number;
  fechaActualizacion: string;
}

export interface BorradorDeProceso {
  id: string;
  moduloId: string;
  datosJson: string;
  version: number;
}

/**
 * Los borradores privados de los asistentes de alta del panel.
 *
 * El borrador es UNO por persona, organización y proceso: el asistente lo recupera al abrirse, lo
 * guarda mientras se escribe (`AutoguardadoDeBorrador`) y se cierra cuando el proceso se crea. Esta
 * clase es el transporte común a Festival y Mercado, y lo que permite mostrar «Tienes un registro
 * sin terminar» en las listas y en el Resumen, con «Continuar» y «Descartar».
 */
@Injectable({ providedIn: 'root' })
export class BorradoresDeProcesoApi {
  private readonly http = inject(ApiClientService);

  /** El borrador abierto del proceso (lo crea vacío si no existe). */
  obtener(modulo: ModuloDeBorrador, organizacionId: string): Observable<BorradorDeProceso> {
    return this.http.get<BorradorDeProceso>(
      `/api/v1/externo/organizaciones/${organizacionId}/${modulo}/borrador`,
      { errorFallback: 'No fue posible recuperar el borrador privado' });
  }

  /** Guarda el borrador y devuelve la versión nueva, que se cita en el siguiente guardado. */
  async guardar(id: string, datos: unknown, version: number | null): Promise<{ version: number } | null> {
    try {
      const testigo = await firstValueFrom(this.testigo());
      return await firstValueFrom(this.http.put<{ version: number }>(
        `/api/v1/externo/borradores-proceso/${id}`,
        { datosJson: JSON.stringify(datos), version },
        { headers: { 'X-CSRF-TOKEN': testigo.requestToken }, errorFallback: 'No fue posible guardar el borrador' }));
    } catch {
      return null;
    }
  }

  pendientes(organizacionId: string): Observable<BorradorPendiente[]> {
    return this.http.get<BorradorPendiente[]>(
      `/api/v1/externo/organizaciones/${organizacionId}/borradores-pendientes`,
      { errorFallback: 'No fue posible consultar tus registros sin terminar' });
  }

  descartar(id: string): Observable<void> {
    return this.testigo().pipe(switchMap(testigo => this.http.delete<void>(
      `/api/v1/externo/borradores-proceso/${id}`,
      { headers: { 'X-CSRF-TOKEN': testigo.requestToken }, errorFallback: 'No fue posible descartar el registro sin terminar' })));
  }

  private testigo(): Observable<{ requestToken: string }> {
    return this.http.get<{ requestToken: string }>(
      '/api/v1/externo/organizaciones/csrf', { errorFallback: 'No fue posible preparar el guardado del borrador' });
  }
}
