import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, switchMap } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';
import { etiquetasDeEstados } from '../vocabularios/estados';
import { subirFotoDelResponsable } from './foto-del-responsable';
import { TestigoDeLaConsolaService } from './testigo-de-la-consola.service';
import { SedeDelServidor } from '../territorio/sede-principal';

/** Un valor de un vocabulario del espacio: un tipo de espacio o un elemento de equipamiento. */
export interface OpcionDeEspacio {
  id: number;
  nombre: string;
  slug: string;
  /** «propuesto» hasta que el Plan Nacional de Música lo apruebe, o «aprobado». */
  estadoAprobacion: string;
}

export interface CatalogoDeEspacio {
  id: number;
  nombre: string;
}

export interface CatalogosDeEspacio {
  equipamiento: OpcionDeEspacio[];
  tipos: OpcionDeEspacio[];
  practicasMusicales: CatalogoDeEspacio[];
}

export type AmbienteDeEspacio = 'cerrado' | 'abierto' | 'mixto';

export const AMBIENTES_DE_ESPACIO: readonly { valor: AmbienteDeEspacio; etiqueta: string; ayuda: string }[] = [
  { valor: 'cerrado', etiqueta: 'Cerrado', ayuda: 'Un salón, una sala, un bar o un teatro.' },
  { valor: 'abierto', etiqueta: 'Al aire libre', ayuda: 'Una tarima, una plaza o un patio sin techo.' },
  { valor: 'mixto', etiqueta: 'Mixto', ayuda: 'Tiene una parte techada y otra al aire libre.' },
];

export function etiquetaDeAmbiente(valor: string | null | undefined): string {
  return AMBIENTES_DE_ESPACIO.find(m => m.valor === valor)?.etiqueta ?? 'Sin ambiente';
}

/** Los estados de un espacio, con la palabra común del circuito editorial (docs/referencia/20-decisiones-y-flujos-por-modulo.md). */
export const ETIQUETAS_ESTADO_ESPACIO = etiquetasDeEstados(
  'borrador', 'en_revision', 'ajustes_solicitados', 'publicado', 'rechazado', 'archivado');

export function etiquetaDeEstadoDeEspacio(estado: string | null | undefined): string {
  return (ETIQUETAS_ESTADO_ESPACIO as Record<string, string>)[(estado ?? '').toLowerCase()] ?? 'Sin estado';
}

/** Un espacio tal como lo ven quienes lo gestionan (`EspacioDto`). */
export interface Espacio {
  id: number;
  nombre: string;
  descripcion: string | null;
  ambiente: AmbienteDeEspacio;
  aforoMaximo: number | null;
  /** Sí, no o `null` cuando no consta. */
  esAccesible: boolean | null;
  horarioYProgramacion: string | null;
  correoEspacio: string | null;
  telefonoEspacio: string | null;
  sitioWebEspacio: string | null;
  instagramEspacio: string | null;
  facebookEspacio: string | null;
  otroEnlaceEspacio: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  nombreDepartamento: string | null;
  codigoMunicipio: string | null;
  nombreMunicipio: string | null;
  lugarEspecifico: string | null;
  /** La sede principal (decisión 119): nula mientras está pendiente de completar. */
  sede?: SedeDelServidor | null;
  organizacionId: number | null;
  organizacionNombre: string | null;
  usuarioResponsableId: number | null;
  responsableNombre: string | null;
  estadoRegistro: string;
  motivoDeLaDecision: string | null;
  equipamiento: OpcionDeEspacio[];
  tipos: OpcionDeEspacio[];
  practicasMusicales: CatalogoDeEspacio[];
  fechaCreacion: string;
  fechaActualizacion: string | null;
  fechaEnvioARevision: string | null;
  fechaPublicacion: string | null;
  /** La foto del Banco de archivos (LUT-02, decisión 120). */
  archivoFotoId?: number | null;
  fotoUrl?: string | null;
  fotoAlt?: string | null;
}

/** Lo que el portal enseña de un espacio publicado (`EspacioPublicoDto`). */
export interface EspacioPublico {
  id: number;
  nombre: string;
  descripcion: string | null;
  ambiente: AmbienteDeEspacio;
  aforoMaximo: number | null;
  /** Sí, no o `null` cuando no consta. */
  esAccesible: boolean | null;
  horarioYProgramacion: string | null;
  correoEspacio: string | null;
  telefonoEspacio: string | null;
  sitioWebEspacio: string | null;
  instagramEspacio: string | null;
  facebookEspacio: string | null;
  otroEnlaceEspacio: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  nombreDepartamento: string | null;
  codigoMunicipio: string | null;
  nombreMunicipio: string | null;
  lugarEspecifico: string | null;
  /** La sede principal (decisión 119): nula mientras está pendiente de completar. */
  sede?: SedeDelServidor | null;
  esIndependiente: boolean;
  organizacionNombre: string | null;
  /** La organización con ficha pública a la que se enlaza; null si no tiene. */
  organizacionPublicaId: number | null;
  /** Registro histórico sin organización: la ficha ofrece pedir su administración (decisión 131). */
  esRegistroHistorico?: boolean;
  fechaPublicacion: string | null;
  equipamiento: OpcionDeEspacio[];
  tipos: OpcionDeEspacio[];
  practicasMusicales: CatalogoDeEspacio[];
  fotoUrl?: string | null;
  fotoAlt?: string | null;
}

export interface PaginaDeEspacios<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Lo que se manda para crear o guardar un espacio (`EspacioUpsertRequest`). */
export interface GuardarEspacioSolicitud {
  nombre: string;
  descripcion: string | null;
  ambiente: AmbienteDeEspacio;
  aforoMaximo: number | null;
  /** Sí, no o `null` cuando no consta. */
  esAccesible: boolean | null;
  horarioYProgramacion: string | null;
  correoEspacio: string | null;
  telefonoEspacio: string | null;
  sitioWebEspacio: string | null;
  instagramEspacio: string | null;
  facebookEspacio: string | null;
  otroEnlaceEspacio: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  codigoMunicipio: string | null;
  lugarEspecifico: string | null;
  archivoFotoId?: number | null;
  /** La sede principal, aparte de la cobertura (decisión 119). */
  sedeCodigoDepartamento?: string | null;
  sedeCodigoMunicipio?: string | null;
  equipamientoIds: number[];
  tiposIds: number[];
  practicasMusicalesIds: number[];
}

export type DecisionSobreEspacio = 'publicar' | 'ajustes' | 'rechazar';

/**
 * Los espacios para música en vivo: lo público, lo de quien responde por el espacio y lo de la consola.
 *
 * <b>UN SOLO SERVICIO Y TRES SUPERFICIES</b>, como los vocabularios: el formulario del panel, el
 * portal y la consola leen los mismos catálogos y el mismo contrato. El responsable puede ser una
 * organización (`/externo/organizaciones/{id}/espacios`) o una persona (`/externo/mis-espacios`).
 */
@Injectable({ providedIn: 'root' })
export class EspaciosService {
  private readonly api = inject(ApiClientService);
  private readonly testigoDeLaConsola = inject(TestigoDeLaConsolaService);

  // ─────────────────────────────────── Público ───────────────────────────────────

  consultarPublicos(): Observable<PaginaDeEspacios<EspacioPublico>> {
    return this.api.get<PaginaDeEspacios<EspacioPublico>>('/api/v1/publico/espacios', {
      params: { limit: 500, offset: 0 },
      errorFallback: 'No fue posible consultar los espacios para música en vivo.',
    });
  }

  consultarPublico(id: string | number): Observable<EspacioPublico> {
    return this.api.get<EspacioPublico>(`/api/v1/publico/espacios/${encodeURIComponent(String(id))}`, {
      errorFallback: 'No fue posible consultar este espacio.',
    });
  }

  catalogosPublicos(): Observable<CatalogosDeEspacio> {
    return this.api.get<CatalogosDeEspacio>('/api/v1/publico/espacios/catalogos', {
      errorFallback: 'No fue posible consultar los vocabularios de los espacios.',
    });
  }

  // ─────────────────────── Quien responde por el espacio (panel) ───────────────────────

  private testigo(): Observable<{ requestToken: string }> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la acción.',
    });
  }

  catalogos(): Observable<CatalogosDeEspacio> {
    return this.api.get<CatalogosDeEspacio>('/api/v1/externo/catalogos/espacio', {
      errorFallback: 'No fue posible consultar los vocabularios del espacio.',
    });
  }

  deLaOrganizacion(organizacionId: string | number): Observable<Espacio[]> {
    return this.api.get<Espacio[]>(`/api/v1/externo/organizaciones/${organizacionId}/espacios`, {
      errorFallback: 'No fue posible consultar los espacios de la organización.',
    });
  }

  mios(): Observable<Espacio[]> {
    return this.api.get<Espacio[]>('/api/v1/externo/mis-espacios', {
      errorFallback: 'No fue posible consultar tus espacios.',
    });
  }

  obtener(id: string | number): Observable<Espacio> {
    return this.api.get<Espacio>(`/api/v1/externo/espacios/${id}`, {
      errorFallback: 'No fue posible consultar el espacio.',
    });
  }

  /** Crea el espacio de una organización; sin `organizacionId`, el de la propia persona. */
  crear(organizacionId: string | number | null, solicitud: GuardarEspacioSolicitud): Observable<Espacio> {
    const ruta = organizacionId === null
      ? '/api/v1/externo/mis-espacios'
      : `/api/v1/externo/organizaciones/${organizacionId}/espacios`;
    return this.testigo().pipe(
      switchMap(token => this.api.post<Espacio>(ruta, solicitud, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible registrar el espacio.',
      })),
    );
  }

  /** La foto de quien responde sin organización entra por su propia puerta (docs/desarrollo/30-consola-y-acceso.md §30.17). */
  subirFotoDelResponsable(archivo: File, alt: string) {
    return subirFotoDelResponsable(this.api, '/api/v1/externo/mis-espacios/foto', archivo, alt);
  }

  guardar(id: string | number, solicitud: GuardarEspacioSolicitud): Observable<Espacio> {
    return this.testigo().pipe(
      switchMap(token => this.api.put<Espacio>(`/api/v1/externo/espacios/${id}`, solicitud, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar el espacio.',
      })),
    );
  }

  enviarARevision(id: string | number): Observable<Espacio> {
    return this.testigo().pipe(
      switchMap(token => this.api.post<Espacio>(`/api/v1/externo/espacios/${id}/enviar-a-revision`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible enviar el espacio a revisión.',
      })),
    );
  }

  /** Deshacer un envío (vuelve a borrador) o abandonar un borrador (se archiva). */
  retirarDeRevisionOAbandonar(id: string | number): Observable<void> {
    return this.testigo().pipe(
      switchMap(token => this.api.delete<void>(`/api/v1/externo/espacios/${id}`, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible completar la acción.',
      })),
    );
  }

  /** Retirar del ecosistema un espacio publicado, con motivo. */
  retirarPublicado(id: string | number, motivo: string): Observable<Espacio> {
    return this.testigo().pipe(
      switchMap(token => this.api.post<Espacio>(`/api/v1/externo/espacios/${id}/retirar`, { motivo }, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible retirar el espacio.',
      })),
    );
  }

  // ───────────────────────────────── Consola ─────────────────────────────────

  listarEnLaConsola(filtros: { q?: string; estado?: string; responsable?: string; sedeDepartamento?: string; sedeMunicipio?: string; sedePendiente?: boolean; pagina?: number; tamano?: number }): Observable<PaginaDeEspacios<Espacio>> {
    const params: Record<string, string | number> = {};
    if (filtros.q) params['q'] = filtros.q;
    if (filtros.estado) params['estado'] = filtros.estado;
    if (filtros.responsable) params['responsable'] = filtros.responsable;
    if (filtros.sedeDepartamento) params['sedeDepartamento'] = filtros.sedeDepartamento;
    if (filtros.sedeMunicipio) params['sedeMunicipio'] = filtros.sedeMunicipio;
    if (filtros.sedePendiente) params['sedePendiente'] = 'true';
    params['pagina'] = filtros.pagina ?? 1;
    params['tamano'] = filtros.tamano ?? 25;
    return this.api.get<PaginaDeEspacios<Espacio>>('/api/v1/institucional/espacios', {
      params,
      errorFallback: 'No fue posible consultar los espacios.',
    });
  }

  obtenerEnLaConsola(id: string | number): Observable<Espacio> {
    return this.api.get<Espacio>(`/api/v1/institucional/espacios/${id}`, {
      errorFallback: 'No fue posible consultar el espacio.',
    });
  }

  async decidir(id: string | number, decision: DecisionSobreEspacio, motivo: string | null): Promise<Espacio> {
    const cabeceras = await this.testigoDeLaConsola.cabeceras();
    return firstValueFrom(this.api.post<Espacio>(`/api/v1/institucional/espacios/${id}/decision`, { decision, motivo }, {
      headers: cabeceras,
      errorFallback: 'No fue posible registrar la decisión.',
    }));
  }

  async archivar(id: string | number, motivo: string): Promise<Espacio> {
    const cabeceras = await this.testigoDeLaConsola.cabeceras();
    return firstValueFrom(this.api.post<Espacio>(`/api/v1/institucional/espacios/${id}/archivar`, { motivo }, {
      headers: cabeceras,
      errorFallback: 'No fue posible retirar el espacio.',
    }));
  }
}
