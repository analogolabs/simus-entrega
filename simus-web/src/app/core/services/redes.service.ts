import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, switchMap } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';
import { etiquetasDeEstados } from '../vocabularios/estados';
import { subirFotoDelResponsable } from './foto-del-responsable';
import { TestigoDeLaConsolaService } from './testigo-de-la-consola.service';
import { SedeDelServidor } from '../territorio/sede-principal';

/** Un valor de un vocabulario de la red: una forma de acceso o un formato de documentación. */
export interface OpcionDeRed {
  id: number;
  nombre: string;
  slug: string;
  /** El formato de primer nivel, cuando es un subnivel (por ejemplo, partituras dentro de impreso). */
  padreId: number | null;
  /** «propuesto» hasta que el Plan Nacional de Música lo apruebe, o «aprobado». */
  estadoAprobacion: string;
}

export interface CatalogoDeRed {
  id: number;
  nombre: string;
}

export interface CatalogosDeRed {
  formasDeAcceso: OpcionDeRed[];
  formatos: OpcionDeRed[];
  practicasMusicales: CatalogoDeRed[];
}

export type TipoDeNodo = 'red' | 'centro_de_documentacion' | 'archivo' | 'coleccion' | 'grupo_de_investigacion';

export const TIPOS_DE_NODO: readonly { valor: TipoDeNodo; etiqueta: string; ayuda: string }[] = [
  { valor: 'red', etiqueta: 'Red', ayuda: 'Reúne a personas y organizaciones que comparten fuentes y conocimiento.' },
  { valor: 'centro_de_documentacion', etiqueta: 'Centro de documentación', ayuda: 'Reúne, conserva y pone a disposición documentos musicales.' },
  { valor: 'archivo', etiqueta: 'Archivo', ayuda: 'Conserva documentos y registros históricos.' },
  { valor: 'coleccion', etiqueta: 'Colección', ayuda: 'Reúne los materiales de una persona o de un grupo.' },
  { valor: 'grupo_de_investigacion', etiqueta: 'Grupo de investigación', ayuda: 'Investiga y produce conocimiento sobre las músicas.' },
];

export function etiquetaDeTipoDeNodo(valor: string | null | undefined): string {
  return TIPOS_DE_NODO.find(m => m.valor === valor)?.etiqueta ?? 'Sin tipo de nodo';
}

/** Los estados de una red, con la palabra común del circuito editorial (docs/referencia/20-decisiones-y-flujos-por-modulo.md). */
export const ETIQUETAS_ESTADO_RED = etiquetasDeEstados(
  'borrador', 'en_revision', 'ajustes_solicitados', 'publicado', 'rechazado', 'archivado');

export function etiquetaDeEstadoDeRed(estado: string | null | undefined): string {
  return (ETIQUETAS_ESTADO_RED as Record<string, string>)[(estado ?? '').toLowerCase()] ?? 'Sin estado';
}

/** Una red tal como la ven quienes la gestionan (`RedDto`). */
export interface Red {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipoDeNodo: TipoDeNodo;
  accesoAbierto: boolean;
  acervosYColecciones: string | null;
  correoRed: string | null;
  telefonoRed: string | null;
  sitioWebRed: string | null;
  instagramRed: string | null;
  facebookRed: string | null;
  otroEnlaceRed: string | null;
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
  formasDeAcceso: OpcionDeRed[];
  formatos: OpcionDeRed[];
  practicasMusicales: CatalogoDeRed[];
  fechaCreacion: string;
  fechaActualizacion: string | null;
  fechaEnvioARevision: string | null;
  fechaPublicacion: string | null;
  /** La foto del Banco de archivos (LUT-02, decisión 120). */
  archivoFotoId?: number | null;
  fotoUrl?: string | null;
  fotoAlt?: string | null;
}

/** Lo que el portal enseña de una red publicada (`RedPublicaDto`). */
export interface RedPublica {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipoDeNodo: TipoDeNodo;
  accesoAbierto: boolean;
  acervosYColecciones: string | null;
  correoRed: string | null;
  telefonoRed: string | null;
  sitioWebRed: string | null;
  instagramRed: string | null;
  facebookRed: string | null;
  otroEnlaceRed: string | null;
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
  formasDeAcceso: OpcionDeRed[];
  formatos: OpcionDeRed[];
  practicasMusicales: CatalogoDeRed[];
  fotoUrl?: string | null;
  fotoAlt?: string | null;
}

export interface PaginaDeRedes<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Lo que se manda para crear o guardar una red (`RedUpsertRequest`). */
export interface GuardarRedSolicitud {
  nombre: string;
  descripcion: string | null;
  tipoDeNodo: TipoDeNodo;
  accesoAbierto: boolean;
  acervosYColecciones: string | null;
  correoRed: string | null;
  telefonoRed: string | null;
  sitioWebRed: string | null;
  instagramRed: string | null;
  facebookRed: string | null;
  otroEnlaceRed: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  codigoMunicipio: string | null;
  lugarEspecifico: string | null;
  archivoFotoId?: number | null;
  /** La sede principal, aparte de la cobertura (decisión 119). */
  sedeCodigoDepartamento?: string | null;
  sedeCodigoMunicipio?: string | null;
  formasDeAccesoIds: number[];
  formatosIds: number[];
  practicasMusicalesIds: number[];
}

export type DecisionSobreRed = 'publicar' | 'ajustes' | 'rechazar';

/**
 * Las redes y documentación: lo público, lo de quien responde por la red y lo de la consola.
 *
 * <b>UN SOLO SERVICIO Y TRES SUPERFICIES</b>, como los vocabularios: el formulario del panel, el
 * portal y la consola leen los mismos catálogos y el mismo contrato. El responsable puede ser una
 * organización (`/externo/organizaciones/{id}/redes`) o una persona (`/externo/mis-redes`).
 */
@Injectable({ providedIn: 'root' })
export class RedesService {
  private readonly api = inject(ApiClientService);
  private readonly testigoDeLaConsola = inject(TestigoDeLaConsolaService);

  // ─────────────────────────────────── Público ───────────────────────────────────

  consultarPublicos(): Observable<PaginaDeRedes<RedPublica>> {
    return this.api.get<PaginaDeRedes<RedPublica>>('/api/v1/publico/redes', {
      params: { limit: 500, offset: 0 },
      errorFallback: 'No fue posible consultar las redes y documentación.',
    });
  }

  consultarPublico(id: string | number): Observable<RedPublica> {
    return this.api.get<RedPublica>(`/api/v1/publico/redes/${encodeURIComponent(String(id))}`, {
      errorFallback: 'No fue posible consultar esta red.',
    });
  }

  catalogosPublicos(): Observable<CatalogosDeRed> {
    return this.api.get<CatalogosDeRed>('/api/v1/publico/redes/catalogos', {
      errorFallback: 'No fue posible consultar los vocabularios de las redes.',
    });
  }

  // ─────────────────────── Quien responde por la red (panel) ───────────────────────

  private testigo(): Observable<{ requestToken: string }> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la acción.',
    });
  }

  catalogos(): Observable<CatalogosDeRed> {
    return this.api.get<CatalogosDeRed>('/api/v1/externo/catalogos/red', {
      errorFallback: 'No fue posible consultar los vocabularios de la red.',
    });
  }

  deLaOrganizacion(organizacionId: string | number): Observable<Red[]> {
    return this.api.get<Red[]>(`/api/v1/externo/organizaciones/${organizacionId}/redes`, {
      errorFallback: 'No fue posible consultar las redes de la organización.',
    });
  }

  mios(): Observable<Red[]> {
    return this.api.get<Red[]>('/api/v1/externo/mis-redes', {
      errorFallback: 'No fue posible consultar tus redes.',
    });
  }

  obtener(id: string | number): Observable<Red> {
    return this.api.get<Red>(`/api/v1/externo/redes/${id}`, {
      errorFallback: 'No fue posible consultar la red.',
    });
  }

  /** Crea la red de una organización; sin `organizacionId`, el de la propia persona. */
  crear(organizacionId: string | number | null, solicitud: GuardarRedSolicitud): Observable<Red> {
    const ruta = organizacionId === null
      ? '/api/v1/externo/mis-redes'
      : `/api/v1/externo/organizaciones/${organizacionId}/redes`;
    return this.testigo().pipe(
      switchMap(token => this.api.post<Red>(ruta, solicitud, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible registrar la red.',
      })),
    );
  }

  /** La foto de quien responde sin organización entra por su propia puerta (docs/desarrollo/30-consola-y-acceso.md §30.17). */
  subirFotoDelResponsable(archivo: File, alt: string) {
    return subirFotoDelResponsable(this.api, '/api/v1/externo/mis-redes/foto', archivo, alt);
  }

  guardar(id: string | number, solicitud: GuardarRedSolicitud): Observable<Red> {
    return this.testigo().pipe(
      switchMap(token => this.api.put<Red>(`/api/v1/externo/redes/${id}`, solicitud, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar la red.',
      })),
    );
  }

  enviarARevision(id: string | number): Observable<Red> {
    return this.testigo().pipe(
      switchMap(token => this.api.post<Red>(`/api/v1/externo/redes/${id}/enviar-a-revision`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible enviar la red a revisión.',
      })),
    );
  }

  /** Deshacer un envío (vuelve a borrador) o abandonar un borrador (se archiva). */
  retirarDeRevisionOAbandonar(id: string | number): Observable<void> {
    return this.testigo().pipe(
      switchMap(token => this.api.delete<void>(`/api/v1/externo/redes/${id}`, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible completar la acción.',
      })),
    );
  }

  /** Retirar del ecosistema una red publicada, con motivo. */
  retirarPublicado(id: string | number, motivo: string): Observable<Red> {
    return this.testigo().pipe(
      switchMap(token => this.api.post<Red>(`/api/v1/externo/redes/${id}/retirar`, { motivo }, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible retirar la red.',
      })),
    );
  }

  // ───────────────────────────────── Consola ─────────────────────────────────

  listarEnLaConsola(filtros: { q?: string; estado?: string; responsable?: string; sedeDepartamento?: string; sedeMunicipio?: string; sedePendiente?: boolean; pagina?: number; tamano?: number }): Observable<PaginaDeRedes<Red>> {
    const params: Record<string, string | number> = {};
    if (filtros.q) params['q'] = filtros.q;
    if (filtros.estado) params['estado'] = filtros.estado;
    if (filtros.responsable) params['responsable'] = filtros.responsable;
    if (filtros.sedeDepartamento) params['sedeDepartamento'] = filtros.sedeDepartamento;
    if (filtros.sedeMunicipio) params['sedeMunicipio'] = filtros.sedeMunicipio;
    if (filtros.sedePendiente) params['sedePendiente'] = 'true';
    params['pagina'] = filtros.pagina ?? 1;
    params['tamano'] = filtros.tamano ?? 25;
    return this.api.get<PaginaDeRedes<Red>>('/api/v1/institucional/redes', {
      params,
      errorFallback: 'No fue posible consultar las redes.',
    });
  }

  obtenerEnLaConsola(id: string | number): Observable<Red> {
    return this.api.get<Red>(`/api/v1/institucional/redes/${id}`, {
      errorFallback: 'No fue posible consultar la red.',
    });
  }

  async decidir(id: string | number, decision: DecisionSobreRed, motivo: string | null): Promise<Red> {
    const cabeceras = await this.testigoDeLaConsola.cabeceras();
    return firstValueFrom(this.api.post<Red>(`/api/v1/institucional/redes/${id}/decision`, { decision, motivo }, {
      headers: cabeceras,
      errorFallback: 'No fue posible registrar la decisión.',
    }));
  }

  async archivar(id: string | number, motivo: string): Promise<Red> {
    const cabeceras = await this.testigoDeLaConsola.cabeceras();
    return firstValueFrom(this.api.post<Red>(`/api/v1/institucional/redes/${id}/archivar`, { motivo }, {
      headers: cabeceras,
      errorFallback: 'No fue posible retirar la red.',
    }));
  }
}
