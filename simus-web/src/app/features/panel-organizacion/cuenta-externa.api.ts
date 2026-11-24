import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../../core/http/api-client.service';

/** Datos personales de la cuenta. Privados: no salen en ninguna ficha pública. */
export interface PerfilDeCuenta {
  email: string;
  tipoPerfil: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string | null;
  /** Opcionales y PRIVADOS (docs/desarrollo/19-cuentas-y-organizaciones.md §19.14): nunca salen en el perfil público ni en directorios. */
  residenciaCodigoDepartamento?: string | null;
  residenciaCodigoMunicipio?: string | null;
  /** «correo» o «telefono». */
  canalDeContactoPreferido?: string | null;
}

/** Una invitación que espera a esta cuenta. Se acepta con su enlace. */
export interface InvitacionPendienteDeLaCuenta {
  id: string;
  organizacionId: string;
  organizacion: string;
  rol: string;
  fechaExpiracion: string;
}

export interface InvitacionesDeLaCuenta {
  /** La lista no se entrega mientras el correo de la cuenta no esté confirmado. */
  correoSinConfirmar: boolean;
  pendientes: InvitacionPendienteDeLaCuenta[];
}

export type CambiosDePerfil = Omit<PerfilDeCuenta, 'email' | 'tipoPerfil'>;

/** Los tipos de documento: una sola lista para todo el producto. */
export { TIPOS_DE_DOCUMENTO } from '../../core/formularios/tipos-de-documento';

@Injectable({ providedIn: 'root' })
export class CuentaExternaApi {
  private readonly api = inject(ApiClientService);

  obtenerPerfil(): Observable<PerfilDeCuenta> {
    return this.api.get<PerfilDeCuenta>('/api/v1/externo/cuenta/perfil', { errorFallback: 'No fue posible cargar tus datos' });
  }

  actualizarPerfil(cambios: CambiosDePerfil): Observable<PerfilDeCuenta> {
    return this.conTestigo(token => this.api.put<PerfilDeCuenta>('/api/v1/externo/cuenta/perfil', cambios, {
      headers: { 'X-CSRF-TOKEN': token },
      errorFallback: 'No fue posible guardar tus datos',
    }));
  }

  /** Las invitaciones pendientes dirigidas al correo de la cuenta. */
  invitacionesPendientes(): Observable<InvitacionesDeLaCuenta> {
    return this.api.get<InvitacionesDeLaCuenta>('/api/v1/externo/cuenta/invitaciones', {
      errorFallback: 'No fue posible consultar tus invitaciones',
    });
  }

  /** Cierra las demás sesiones de la cuenta; esta sigue abierta. */
  cambiarContrasena(actual: string, nueva: string): Observable<void> {
    return this.conTestigo(token => this.api.post<void>('/api/v1/externo/cuenta/contrasena', { actual, nueva }, {
      headers: { 'X-CSRF-TOKEN': token },
      errorFallback: 'No fue posible cambiar la contraseña',
    }));
  }

  private conTestigo<T>(enviar: (token: string) => Observable<T>): Observable<T> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la solicitud',
    }).pipe(switchMap(token => enviar(token.requestToken)));
  }
}
