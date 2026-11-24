import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';

/** Si el enlace del correo sirve y, si no, por qué. */
export interface EstadoDelEnlaceDeRecuperacion {
  valido: boolean;
  /** `enlace_no_valido`, `enlace_vencido`, `enlace_usado` o `enlace_reemplazado`. */
  motivo: string | null;
  /** El correo de la cuenta, parcialmente oculto, solo con un enlace válido. */
  correoEnmascarado: string | null;
}

/**
 * «¿Olvidaste tu contraseña?» de las cuentas externas (`docs/desarrollo/19-cuentas-y-organizaciones.md` §19.9).
 *
 * <b>EL TESTIGO ANTIFORGERY SE PIDE ANTES DE CADA ESCRITURA</b>, igual que en el resto del espacio
 * externo, pero por una ruta anónima: quien olvidó la clave no tiene sesión. <b>EL TESTIGO DEL
 * ENLACE VIAJA EN EL CUERPO</b>, nunca en una dirección que se pida al servidor.
 */
@Injectable({ providedIn: 'root' })
export class RecuperacionDeContrasenaService {
  private readonly api = inject(ApiClientService);

  /**
   * Pide el enlace. Devuelve el mensaje neutro del servidor, que es el mismo exista o no la cuenta:
   * la pantalla no puede (ni debe) distinguirlo.
   */
  async solicitar(correo: string): Promise<string> {
    const respuesta = await this.escribir<{ message: string }>('/api/v1/externo/auth/olvide-contrasena', { correo },
      'No fue posible enviar la solicitud. Inténtalo de nuevo en un momento.');
    return respuesta?.message ?? '';
  }

  comprobar(testigo: string): Promise<EstadoDelEnlaceDeRecuperacion> {
    return firstValueFrom(this.api.post<EstadoDelEnlaceDeRecuperacion>(
      '/api/v1/externo/auth/restablecer-contrasena/comprobar', { testigo },
      { errorFallback: 'No fue posible comprobar el enlace.' }));
  }

  async restablecer(testigo: string, nueva: string): Promise<void> {
    await this.escribir<void>('/api/v1/externo/auth/restablecer-contrasena', { testigo, nueva },
      'No fue posible restablecer la contraseña. Inténtalo de nuevo.');
  }

  private async escribir<T>(ruta: string, cuerpo: object, errorFallback: string): Promise<T> {
    const testigo = await firstValueFrom(this.api.get<{ requestToken: string }>('/api/v1/externo/auth/csrf', {
      errorFallback: 'No fue posible preparar la solicitud.',
    }));
    return firstValueFrom(this.api.post<T>(ruta, cuerpo, {
      headers: { 'X-CSRF-TOKEN': testigo.requestToken },
      errorFallback,
    }));
  }
}
