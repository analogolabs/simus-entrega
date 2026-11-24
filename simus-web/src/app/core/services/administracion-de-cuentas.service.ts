import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { TestigoDeLaConsolaService } from './testigo-de-la-consola.service';

/** Catálogo de módulos de la consola y los que siempre permanecen activos. */
export interface CatalogoDeModulos {
  modulos: string[];
  siempreActivados: string[];
}

/** Módulos efectivos de una cuenta administrativa. */
export interface ModulosDeUnaCuenta {
  idUsuario: number;
  modulos: string[];
  siempreActivados: string[];
  todosPorSerWebmaster: boolean;
}

/** Una cuenta de consola con los módulos que puede abrir (apartado «Módulos del gestor»). */
export interface CuentaConModulos {
  id: number;
  nombre: string;
  correo: string;
  activa: boolean;
  esWebmaster: boolean;
  modulos: string[];
}

export interface ResumenDeModulos {
  cuentas: CuentaConModulos[];
  siempreActivados: string[];
  soloWebmaster: string[];
}

/** Cuenta gestionada desde la consola, espejo de `AdminUserDto`. */
export interface UsuarioDelSistema {
  id: string;
  fullName: string;
  email: string;
  role: string;
  roleLabel: string;
  roles: string[] | null;
  isActive: boolean;
  lastLoginAt: string | null;
  telefono: string | null;
  identificacion?: string | null;
  tipoDocumento?: string | null;
  tipoDocumentoEtiqueta?: string | null;
  apartadosActivos?: number;
  apartadosTotales?: number;
  /** La cuenta técnica de las acciones automáticas: solo lectura en la consola. */
  esCuentaDelSistema?: boolean;
}

export interface TipoDeDocumento {
  codigo: string;
  etiqueta: string;
}

export interface FormularioDeCuenta {
  fullName: string;
  email: string;
  roles: string[];
  password: string;
  isActive: boolean;
  identificacion: string;
  tipoDocumento: string;
  telefono: string;
}

export interface GuardarUsuarioDelSistema {
  id?: string;
  fullName: string;
  email: string;
  roles: string[];
  password: string;
  isActive: boolean;
  identificacion?: string;
  tipoDocumento?: string;
  telefono?: string;
}

export interface RespuestaGuardarUsuario {
  user: UsuarioDelSistema;
}

@Injectable({ providedIn: 'root' })
export class AdministracionDeCuentasService {
  private readonly api = inject(ApiClientService);
  private readonly testigo = inject(TestigoDeLaConsolaService);

  cargarCuentasAdministrativas(): Observable<UsuarioDelSistema[]> {
    return this.api.get<UsuarioDelSistema[]>('/api/v1/admin/auth/users', { errorFallback: 'No fue posible consultar usuarios' });
  }

  guardarCuentaAdministrativa(payload: GuardarUsuarioDelSistema): Observable<RespuestaGuardarUsuario> {
    return this.testigo.conTestigo(headers => this.api.post<RespuestaGuardarUsuario>('/api/v1/admin/auth/users', payload, { headers, errorFallback: 'No fue posible guardar el usuario' }));
  }

  cambiarMiContrasena(actual: string, nueva: string): Observable<{ debeCambiarContrasena: boolean; perfilCompletado: boolean }> {
    return this.testigo.conTestigo(headers => this.api.post('/api/v1/admin/auth/mi-contrasena', { actual, nueva }, { headers, errorFallback: 'No fue posible cambiar la contraseña' }));
  }

  completarMiPerfil(perfil: { primerNombre: string; segundoNombre: string; primerApellido: string; segundoApellido: string; tipoDocumento: string; identificacion: string; telefono: string }): Observable<{ perfilCompletado: boolean; nombreCompleto: string }> {
    return this.testigo.conTestigo(headers => this.api.post('/api/v1/admin/auth/mi-perfil', perfil, { headers, errorFallback: 'No fue posible guardar tu perfil' }));
  }

  cargarTiposDeDocumento(): Observable<TipoDeDocumento[]> {
    return this.api.get<TipoDeDocumento[]>('/api/v1/admin/catalogos/tipos-documento', { errorFallback: 'No fue posible consultar los tipos de documento' });
  }

  cargarModulosDisponibles(): Observable<CatalogoDeModulos> {
    return this.api.get<CatalogoDeModulos>('/api/v1/admin/usuarios/modulos-disponibles', { errorFallback: 'No fue posible consultar los módulos de la consola' });
  }

  cargarMisModulos(): Observable<ModulosDeUnaCuenta> {
    return this.api.get<ModulosDeUnaCuenta>('/api/v1/admin/mis-modulos', { errorFallback: 'No fue posible consultar tus módulos' });
  }

  cargarModulosDeCuenta(id: string): Observable<ModulosDeUnaCuenta> {
    return this.api.get<ModulosDeUnaCuenta>(`/api/v1/admin/usuarios/${id}/modulos`, { errorFallback: 'No fue posible consultar los módulos de esa cuenta' });
  }

  guardarModulosDeCuenta(id: string, modulos: readonly string[]): Observable<ModulosDeUnaCuenta> {
    return this.testigo.conTestigo(headers => this.api.put<ModulosDeUnaCuenta>(`/api/v1/admin/usuarios/${id}/modulos`, { modulos }, {
      headers,
      errorFallback: 'No fue posible guardar los módulos de esa cuenta',
    }));
  }

  cargarResumenDeModulos(): Observable<ResumenDeModulos> {
    return this.api.get<ResumenDeModulos>('/api/v1/admin/usuarios/modulos/resumen', { errorFallback: 'No fue posible consultar los módulos de las cuentas' });
  }

  /** Habilita o deshabilita UN módulo; el servidor parte de lo que hay guardado, no de lo que la pantalla creía. */
  cambiarModuloDeCuenta(id: string | number, codigo: string, habilitado: boolean): Observable<ModulosDeUnaCuenta> {
    return this.testigo.conTestigo(headers => this.api.put<ModulosDeUnaCuenta>(`/api/v1/admin/usuarios/${id}/modulos/${codigo}`, { habilitado }, {
      headers,
      errorFallback: 'No fue posible cambiar el módulo de esa cuenta',
    }));
  }

  desactivarCuenta(id: string): Observable<void> {
    return this.testigo.conTestigo(headers => this.api.delete<void>(`/api/v1/admin/auth/users/${id}`, { headers, errorFallback: 'No fue posible desactivar el usuario' }));
  }

  eliminarCuentaDefinitivamente(id: string): Observable<void> {
    return this.testigo.conTestigo(headers => this.api.delete<void>(`/api/v1/admin/auth/users/${id}/definitiva`, { headers, errorFallback: 'No fue posible eliminar la cuenta' }));
  }

  actualizarPerfil(payload: unknown): Observable<unknown> {
    return this.testigo.conTestigo(headers => this.api.put<unknown>('/api/v1/admin/auth/profile', payload, { headers, errorFallback: 'No fue posible actualizar el perfil' }));
  }
}
