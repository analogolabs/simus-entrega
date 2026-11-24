import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../http/api-client.service';

/**
 * El testigo de seguridad de las escrituras de la consola que lo piden con el filtro común.
 *
 * <b>QUÉ PROTEGE.</b> TODAS las escrituras de la consola exigen el testigo antiforgery (alta de
 * organizaciones y Festivales, publicaciones, cuentas y sus módulos, asistencia a organizaciones, baja
 * del boletín, notificaciones y gobernanza de registros). Solo el ingreso, la salida y las
 * consultas por POST de solo lectura quedan sin él, y está escrito por qué en la prueba de inventario. Se pide justo antes de escribir —no se guarda—, para que nunca
 * se mande uno vencido.
 */
@Injectable({ providedIn: 'root' })
export class TestigoDeLaConsolaService {
  private readonly api = inject(ApiClientService);

  /** Las cabeceras que acompañan a la escritura. */
  async cabeceras(): Promise<Record<string, string>> {
    const testigo = await firstValueFrom(
      this.api.get<{ requestToken: string }>('/api/v1/admin/csrf', {}));
    return { 'X-CSRF-TOKEN': testigo.requestToken };
  }

  /**
   * Lo mismo para quien escribe con observables: el testigo se pide AL SUSCRIBIRSE y se pasa a la
   * escritura, de modo que repetir la suscripción pide uno nuevo y nunca se manda uno vencido.
   */
  conTestigo<T>(escribir: (cabeceras: Record<string, string>) => Observable<T>): Observable<T> {
    return defer(() => from(this.cabeceras())).pipe(switchMap(escribir));
  }
}
