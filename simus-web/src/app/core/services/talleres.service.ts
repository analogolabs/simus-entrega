import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, switchMap } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';
import { etiquetasDeEstados } from '../vocabularios/estados';
import { subirFotoDelResponsable } from './foto-del-responsable';
import { TestigoDeLaConsolaService } from './testigo-de-la-consola.service';
import { SedeDelServidor } from '../territorio/sede-principal';

/** Un valor de un vocabulario del taller: un servicio o una familia de instrumentos. */
export interface OpcionDeTaller {
  id: number;
  nombre: string;
  slug: string;
  /** La familia de primer nivel, cuando es un subnivel (cordófonos frotados y pulsados). */
  padreId: number | null;
  /** «propuesto» hasta que el Plan Nacional de Música lo apruebe, o «aprobado». */
  estadoAprobacion: string;
}

export interface CatalogoDeTaller {
  id: number;
  nombre: string;
}

export interface CatalogosDeTaller {
  servicios: OpcionDeTaller[];
  familias: OpcionDeTaller[];
  practicasMusicales: CatalogoDeTaller[];
}

export type ModalidadDeTaller = 'fijo' | 'itinerante' | 'colectivo';

export const MODALIDADES_DE_TALLER: readonly { valor: ModalidadDeTaller; etiqueta: string; ayuda: string }[] = [
  { valor: 'fijo', etiqueta: 'Taller fijo', ayuda: 'Trabaja en un lugar propio o alquilado.' },
  { valor: 'itinerante', etiqueta: 'Taller itinerante', ayuda: 'Se desplaza a comunidades, ferias o eventos.' },
  { valor: 'colectivo', etiqueta: 'Taller colectivo', ayuda: 'Lo comparten varias personas o familias.' },
];

export function etiquetaDeModalidad(valor: string | null | undefined): string {
  return MODALIDADES_DE_TALLER.find(m => m.valor === valor)?.etiqueta ?? 'Sin modalidad';
}

/** Los estados de un taller, con la palabra común del circuito editorial (docs/referencia/20-decisiones-y-flujos-por-modulo.md). */
export const ETIQUETAS_ESTADO_TALLER = etiquetasDeEstados(
  'borrador', 'en_revision', 'ajustes_solicitados', 'publicado', 'rechazado', 'archivado');

export function etiquetaDeEstadoDeTaller(estado: string | null | undefined): string {
  return (ETIQUETAS_ESTADO_TALLER as Record<string, string>)[(estado ?? '').toLowerCase()] ?? 'Sin estado';
}

/** Un taller tal como lo ven quienes lo gestionan (`TallerDto`). */
export interface Taller {
  id: number;
  nombre: string;
  descripcion: string | null;
  modalidad: ModalidadDeTaller;
  recibeAprendices: boolean;
  saberesYTecnicas: string | null;
  correoTaller: string | null;
  telefonoTaller: string | null;
  sitioWebTaller: string | null;
  instagramTaller: string | null;
  facebookTaller: string | null;
  otroEnlaceTaller: string | null;
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
  servicios: OpcionDeTaller[];
  familias: OpcionDeTaller[];
  practicasMusicales: CatalogoDeTaller[];
  fechaCreacion: string;
  fechaActualizacion: string | null;
  fechaEnvioARevision: string | null;
  fechaPublicacion: string | null;
  /** La foto del taller en el Banco de archivos (LUT-02). */
  archivoFotoId?: number | null;
  fotoUrl?: string | null;
  fotoAlt?: string | null;
}

/** Lo que el portal enseña de un taller publicado (`TallerPublicoDto`). */
export interface TallerPublico {
  id: number;
  nombre: string;
  descripcion: string | null;
  modalidad: ModalidadDeTaller;
  recibeAprendices: boolean;
  saberesYTecnicas: string | null;
  correoTaller: string | null;
  telefonoTaller: string | null;
  sitioWebTaller: string | null;
  instagramTaller: string | null;
  facebookTaller: string | null;
  otroEnlaceTaller: string | null;
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
  servicios: OpcionDeTaller[];
  familias: OpcionDeTaller[];
  practicasMusicales: CatalogoDeTaller[];
  fotoUrl?: string | null;
  fotoAlt?: string | null;
}

export interface PaginaDeTalleres<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Lo que se manda para crear o guardar un taller (`TallerUpsertRequest`). */
export interface GuardarTallerSolicitud {
  nombre: string;
  descripcion: string | null;
  modalidad: ModalidadDeTaller;
  recibeAprendices: boolean;
  saberesYTecnicas: string | null;
  correoTaller: string | null;
  telefonoTaller: string | null;
  sitioWebTaller: string | null;
  instagramTaller: string | null;
  facebookTaller: string | null;
  otroEnlaceTaller: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  codigoMunicipio: string | null;
  lugarEspecifico: string | null;
  archivoFotoId?: number | null;
  /** La sede principal, aparte de la cobertura (decisión 119). */
  sedeCodigoDepartamento?: string | null;
  sedeCodigoMunicipio?: string | null;
  serviciosIds: number[];
  familiasIds: number[];
  practicasMusicalesIds: number[];
}

export type DecisionSobreTaller = 'publicar' | 'ajustes' | 'rechazar';

/**
 * Los talleres de lutería: lo público, lo de quien responde por el taller y lo de la consola.
 *
 * <b>UN SOLO SERVICIO Y TRES SUPERFICIES</b>, como los vocabularios: el formulario del panel, el
 * portal y la consola leen los mismos catálogos y el mismo contrato. El responsable puede ser una
 * organización (`/externo/organizaciones/{id}/talleres`) o una persona (`/externo/mis-talleres`).
 */
@Injectable({ providedIn: 'root' })
export class TalleresService {
  private readonly api = inject(ApiClientService);
  private readonly testigoDeLaConsola = inject(TestigoDeLaConsolaService);

  // ─────────────────────────────────── Público ───────────────────────────────────

  consultarPublicos(): Observable<PaginaDeTalleres<TallerPublico>> {
    return this.api.get<PaginaDeTalleres<TallerPublico>>('/api/v1/publico/talleres', {
      params: { limit: 500, offset: 0 },
      errorFallback: 'No fue posible consultar los talleres de lutería.',
    });
  }

  consultarPublico(id: string | number): Observable<TallerPublico> {
    return this.api.get<TallerPublico>(`/api/v1/publico/talleres/${encodeURIComponent(String(id))}`, {
      errorFallback: 'No fue posible consultar este taller.',
    });
  }

  catalogosPublicos(): Observable<CatalogosDeTaller> {
    return this.api.get<CatalogosDeTaller>('/api/v1/publico/talleres/catalogos', {
      errorFallback: 'No fue posible consultar los vocabularios de los talleres.',
    });
  }

  // ─────────────────────── Quien responde por el taller (panel) ───────────────────────

  private testigo(): Observable<{ requestToken: string }> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la acción.',
    });
  }

  catalogos(): Observable<CatalogosDeTaller> {
    return this.api.get<CatalogosDeTaller>('/api/v1/externo/catalogos/taller', {
      errorFallback: 'No fue posible consultar los vocabularios del taller.',
    });
  }

  deLaOrganizacion(organizacionId: string | number): Observable<Taller[]> {
    return this.api.get<Taller[]>(`/api/v1/externo/organizaciones/${organizacionId}/talleres`, {
      errorFallback: 'No fue posible consultar los talleres de la organización.',
    });
  }

  mios(): Observable<Taller[]> {
    return this.api.get<Taller[]>('/api/v1/externo/mis-talleres', {
      errorFallback: 'No fue posible consultar tus talleres.',
    });
  }

  obtener(id: string | number): Observable<Taller> {
    return this.api.get<Taller>(`/api/v1/externo/talleres/${id}`, {
      errorFallback: 'No fue posible consultar el taller.',
    });
  }

  /** Crea el taller de una organización; sin `organizacionId`, el de la propia persona. */
  crear(organizacionId: string | number | null, solicitud: GuardarTallerSolicitud): Observable<Taller> {
    const ruta = organizacionId === null
      ? '/api/v1/externo/mis-talleres'
      : `/api/v1/externo/organizaciones/${organizacionId}/talleres`;
    return this.testigo().pipe(
      switchMap(token => this.api.post<Taller>(ruta, solicitud, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible registrar el taller.',
      })),
    );
  }

  /** La foto de un lutier sin organización entra por su propia puerta (docs/desarrollo/30-consola-y-acceso.md §30.17). */
  subirFotoDelResponsable(archivo: File, alt: string) {
    return subirFotoDelResponsable(this.api, '/api/v1/externo/mis-talleres/foto', archivo, alt);
  }

  guardar(id: string | number, solicitud: GuardarTallerSolicitud): Observable<Taller> {
    return this.testigo().pipe(
      switchMap(token => this.api.put<Taller>(`/api/v1/externo/talleres/${id}`, solicitud, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar el taller.',
      })),
    );
  }

  enviarARevision(id: string | number): Observable<Taller> {
    return this.testigo().pipe(
      switchMap(token => this.api.post<Taller>(`/api/v1/externo/talleres/${id}/enviar-a-revision`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible enviar el taller a revisión.',
      })),
    );
  }

  /** Deshacer un envío (vuelve a borrador) o abandonar un borrador (se archiva). */
  retirarDeRevisionOAbandonar(id: string | number): Observable<void> {
    return this.testigo().pipe(
      switchMap(token => this.api.delete<void>(`/api/v1/externo/talleres/${id}`, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible completar la acción.',
      })),
    );
  }

  /** Retirar del ecosistema un taller publicado, con motivo. */
  retirarPublicado(id: string | number, motivo: string): Observable<Taller> {
    return this.testigo().pipe(
      switchMap(token => this.api.post<Taller>(`/api/v1/externo/talleres/${id}/retirar`, { motivo }, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible retirar el taller.',
      })),
    );
  }

  // ───────────────────────────────── Consola ─────────────────────────────────

  listarEnLaConsola(filtros: { q?: string; estado?: string; responsable?: string; sedeDepartamento?: string; sedeMunicipio?: string; sedePendiente?: boolean; pagina?: number; tamano?: number }): Observable<PaginaDeTalleres<Taller>> {
    const params: Record<string, string | number> = {};
    if (filtros.q) params['q'] = filtros.q;
    if (filtros.estado) params['estado'] = filtros.estado;
    if (filtros.responsable) params['responsable'] = filtros.responsable;
    if (filtros.sedeDepartamento) params['sedeDepartamento'] = filtros.sedeDepartamento;
    if (filtros.sedeMunicipio) params['sedeMunicipio'] = filtros.sedeMunicipio;
    if (filtros.sedePendiente) params['sedePendiente'] = 'true';
    params['pagina'] = filtros.pagina ?? 1;
    params['tamano'] = filtros.tamano ?? 25;
    return this.api.get<PaginaDeTalleres<Taller>>('/api/v1/institucional/talleres', {
      params,
      errorFallback: 'No fue posible consultar los talleres.',
    });
  }

  obtenerEnLaConsola(id: string | number): Observable<Taller> {
    return this.api.get<Taller>(`/api/v1/institucional/talleres/${id}`, {
      errorFallback: 'No fue posible consultar el taller.',
    });
  }

  async decidir(id: string | number, decision: DecisionSobreTaller, motivo: string | null): Promise<Taller> {
    const cabeceras = await this.testigoDeLaConsola.cabeceras();
    return firstValueFrom(this.api.post<Taller>(`/api/v1/institucional/talleres/${id}/decision`, { decision, motivo }, {
      headers: cabeceras,
      errorFallback: 'No fue posible registrar la decisión.',
    }));
  }

  async archivar(id: string | number, motivo: string): Promise<Taller> {
    const cabeceras = await this.testigoDeLaConsola.cabeceras();
    return firstValueFrom(this.api.post<Taller>(`/api/v1/institucional/talleres/${id}/archivar`, { motivo }, {
      headers: cabeceras,
      errorFallback: 'No fue posible retirar el taller.',
    }));
  }
}
