import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../http/api-client.service';

/**
 * El perfil público de la persona (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4-§19.5).
 *
 * Lo público nunca trae correo, documento, teléfono ni rol: si no está en `PerfilPublico`, no sale.
 */
/** Un elemento del portafolio: SOLO un enlace https (nunca un archivo), con título, clase, descripción y año (ME). */
export type TipoDePortafolio = 'audio' | 'video' | 'texto' | 'imagen' | 'enlace';

export interface ItemDePortafolio {
  tipo: TipoDePortafolio;
  titulo: string;
  url: string;
  /** Una o dos frases sobre la obra. Opcional. */
  descripcion?: string | null;
  /** El año de la obra. Opcional. */
  anio?: number | null;
}

/** Quién ve el perfil: cualquiera, o solo quien tiene cuenta en SIMUS. «Oculto» es no tener la autorización vigente. */
export type VisibilidadDelPerfil = 'publico' | 'solo_simus';

export interface CambioDePerfilPublico {
  fecha: string;
  campo: string;
  anterior: string | null;
  nuevo: string | null;
}

export interface PerfilPublico {
  clave: string;
  nombreVisible: string;
  practicas: { id: number; nombre: string; slug: string }[];
  municipio: string | null;
  departamento: string | null;
  fotoUrl: string | null;
  fotoTextoAlternativo: string | null;
  enlaces: string[];
  organizaciones: { id: number; nombre: string }[];
  /** Solo si la persona consintió mostrarlo. */
  nombreCivil?: string | null;
  biografiaCorta?: string | null;
  biografiaLarga?: string | null;
  /** Roles y oficios, texto libre. */
  oficios?: string[] | null;
  portafolio?: ItemDePortafolio[] | null;
  /** Un rótulo por enlace, en el mismo orden (nulo: sin rótulo). */
  etiquetasDeEnlaces?: (string | null)[] | null;
}

export interface MiPerfilPublico {
  existe: boolean;
  clave: string | null;
  nombreVisible: string;
  idsPracticas: number[];
  codigoMunicipio: string | null;
  archivoFotoId: number | null;
  fotoUrl: string | null;
  enlaces: string[];
  autorizacionVigente: boolean;
  ocultoPorModeracion: boolean;
  motivoModeracion: string | null;
  visible: boolean;
  /** Las organizaciones en las que participa y que puede elegir mostrar. */
  organizaciones: { id: number; nombre: string }[];
  /** Su nombre civil, para que decida si lo muestra junto al nombre artístico. */
  nombreCivilPropio?: string | null;
  nombreCivilVisible?: boolean;
  biografiaCorta?: string | null;
  biografiaLarga?: string | null;
  oficios?: string[] | null;
  portafolio?: ItemDePortafolio[] | null;
  idsOrganizacionesVisibles?: number[] | null;
  visibilidad?: VisibilidadDelPerfil;
  etiquetasDeEnlaces?: (string | null)[] | null;
}

export interface CambiosDePerfilPublico {
  nombreVisible: string;
  idsPracticas: number[];
  codigoMunicipio: string | null;
  archivoFotoId: number | null;
  enlaces: string[];
  /** Un rótulo por enlace, en el mismo orden que `enlaces`. */
  etiquetasDeEnlaces?: (string | null)[];
  nombreCivilVisible?: boolean;
  biografiaCorta?: string | null;
  biografiaLarga?: string | null;
  oficios?: string[];
  portafolio?: ItemDePortafolio[];
  idsOrganizaciones?: number[];
  visibilidad?: VisibilidadDelPerfil;
}

/** Cuántos caracteres admite el servidor (`PerfilPublicoEndpoints`). */
export const LARGO_BIOGRAFIA_CORTA = 280;
export const LARGO_BIOGRAFIA_LARGA = 4000;
export const MAXIMO_DE_OFICIOS = 8;
export const MAXIMO_DE_PORTAFOLIO = 8;

export interface OrganizacionPublica {
  id: number;
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  municipio: string | null;
  departamento: string | null;
  personas: { clave: string; nombreVisible: string; fotoUrl: string | null }[];
}

export interface PoliticaDePerfilPublico {
  clave: string;
  version: string;
  titulo: string;
  texto: string;
}

export interface PerfilEnModeracion {
  clave: string;
  nombreVisible: string;
  correoCuenta: string;
  autorizacionVigente: boolean;
  ocultoPorModeracion: boolean;
  motivoModeracion: string | null;
  fechaModeracion: string | null;
  visible: boolean;
  fechaActualizacion: string | null;
}

/** Cuántos enlaces admite el servidor (`PerfilPublicoEndpoints.MaximoDeEnlaces`). */
export const MAXIMO_DE_ENLACES = 5;

@Injectable({ providedIn: 'root' })
export class PerfilPublicoService {
  private readonly api = inject(ApiClientService);

  // ── Lo público ──────────────────────────────────────────────────────────────────────────
  consultar(clave: string): Observable<PerfilPublico> {
    return this.api.get<PerfilPublico>(`/api/v1/publico/personas/${encodeURIComponent(clave)}`, {
      errorFallback: 'Este perfil no existe o no es público.',
    });
  }

  consultarOrganizacion(id: string | number): Observable<OrganizacionPublica> {
    return this.api.get<OrganizacionPublica>(`/api/v1/publico/organizaciones/${encodeURIComponent(String(id))}`, {
      errorFallback: 'Esta organización no está disponible.',
    });
  }

  politica(): Observable<PoliticaDePerfilPublico> {
    return this.api.get<PoliticaDePerfilPublico>('/api/v1/publico/politicas/perfil_publico', {
      errorFallback: 'El texto de autorización no está disponible.',
    });
  }

  // ── La cuenta ───────────────────────────────────────────────────────────────────────────
  mio(): Observable<MiPerfilPublico> {
    return this.api.get<MiPerfilPublico>('/api/v1/externo/cuenta/perfil-publico', {
      errorFallback: 'No fue posible cargar tu perfil público',
    });
  }

  guardar(cambios: CambiosDePerfilPublico): Observable<MiPerfilPublico> {
    return this.conTestigoExterno(token => this.api.put<MiPerfilPublico>('/api/v1/externo/cuenta/perfil-publico', cambios, {
      headers: { 'X-CSRF-TOKEN': token }, errorFallback: 'No fue posible guardar tu perfil público',
    }));
  }

  publicar(versionAceptada: string): Observable<MiPerfilPublico> {
    return this.conTestigoExterno(token => this.api.post<MiPerfilPublico>('/api/v1/externo/cuenta/perfil-publico/publicar', { versionAceptada }, {
      headers: { 'X-CSRF-TOKEN': token }, errorFallback: 'No fue posible publicar tu perfil',
    }));
  }

  ocultar(): Observable<MiPerfilPublico> {
    return this.conTestigoExterno(token => this.api.post<MiPerfilPublico>('/api/v1/externo/cuenta/perfil-publico/ocultar', {}, {
      headers: { 'X-CSRF-TOKEN': token }, errorFallback: 'No fue posible ocultar tu perfil',
    }));
  }

  /** Los cambios de su perfil público, del más reciente al más antiguo. */
  historial(): Observable<CambioDePerfilPublico[]> {
    return this.api.get<CambioDePerfilPublico[]>('/api/v1/externo/cuenta/perfil-publico/historial', {
      errorFallback: 'No fue posible cargar el historial de tu perfil',
    });
  }

  subirFoto(archivo: File, alt: string): Observable<{ id: number; url: string }> {
    const cuerpo = new FormData();
    cuerpo.append('file', archivo, archivo.name);
    cuerpo.append('alt', alt);
    // La subida lleva el testigo CSRF, como las del Banco de archivos.
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {}).pipe(
      switchMap(testigo => this.api.postForm<{ id: number; url: string }>(
        '/api/v1/externo/cuenta/perfil-publico/foto', cuerpo, {
          headers: { 'X-CSRF-TOKEN': testigo.requestToken },
          errorFallback: 'No fue posible subir la foto',
        })),
    );
  }

  // ── La consola ──────────────────────────────────────────────────────────────────────────
  listarEnConsola(q = ''): Observable<PerfilEnModeracion[]> {
    const consulta = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return this.api.get<PerfilEnModeracion[]>(`/api/v1/admin/perfiles-publicos${consulta}`, {
      errorFallback: 'No fue posible cargar los perfiles públicos',
    });
  }

  ocultarPorModeracion(clave: string, motivo: string): Observable<void> {
    return this.conTestigoDeConsola(token => this.api.post<void>(`/api/v1/admin/perfiles-publicos/${clave}/ocultar`, { motivo }, {
      headers: { 'X-CSRF-TOKEN': token }, errorFallback: 'No fue posible ocultar el perfil',
    }));
  }

  restablecer(clave: string): Observable<void> {
    return this.conTestigoDeConsola(token => this.api.post<void>(`/api/v1/admin/perfiles-publicos/${clave}/restablecer`, {}, {
      headers: { 'X-CSRF-TOKEN': token }, errorFallback: 'No fue posible restablecer el perfil',
    }));
  }

  private conTestigoExterno<T>(enviar: (token: string) => Observable<T>): Observable<T> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la solicitud',
    }).pipe(switchMap(token => enviar(token.requestToken)));
  }

  private conTestigoDeConsola<T>(enviar: (token: string) => Observable<T>): Observable<T> {
    return this.api.get<{ token: string }>('/api/v1/admin/contenido-web/csrf', {
      errorFallback: 'No fue posible preparar la solicitud',
    }).pipe(switchMap(testigo => enviar(testigo.token)));
  }
}
