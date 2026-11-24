import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { etiquetasDeEstados } from '../vocabularios/estados';
import { SedeDelServidor } from '../territorio/sede-principal';

/** Un mercado musical, tal como lo lee la consola. */
export interface Mercado {
  id: number;
  nombre: string;
  descripcion: string | null;
  alcanceId: number | null;
  alcance: string | null;
  modalidadId: number | null;
  modalidad: string | null;
  periodicidad: string | null;
  periodicidadDetalle: string | null;
  correoMercado: string | null;
  telefonoMercado: string | null;
  sitioWebMercado: string | null;
  instagramMercado: string | null;
  facebookMercado: string | null;
  otroEnlaceMercado: string | null;
  observacionesContacto: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  nombreDepartamento: string | null;
  codigoMunicipio: string | null;
  nombreMunicipio: string | null;
  lugarEspecifico: string | null;
  /** La sede principal (decisión 119): nula mientras está pendiente de completar. */
  sede?: SedeDelServidor | null;
  seRealizaEnElMarcoDeUnFestival: boolean;
  festivalId: number | null;
  festivalNombre: string | null;
  organizacionId: number;
  organizacionNombre: string | null;
  estadoRegistro: string;
  numeroDeEdiciones: number;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  fechaPublicacion: string | null;
  /** Del mismo catálogo que un Festival: un mercado no tiene vocabulario propio para lo que suena en él. */
  practicasMusicales: CatalogoDeMercado[];
  territoriosSonoros: CatalogoDeMercado[];
}

/** Un valor de los catálogos compartidos del Ecosistema. */
export interface CatalogoDeMercado {
  id: number;
  nombre: string;
}

/** Lo que la consola manda para crear o guardar un mercado. */
export interface MercadoParaGuardar {
  practicasMusicalesIds: number[];
  territoriosSonorosIds: number[];
  nombre: string;
  descripcion: string | null;
  alcanceId: number | null;
  modalidadId: number | null;
  periodicidad: string | null;
  periodicidadDetalle: string | null;
  correoMercado: string | null;
  telefonoMercado: string | null;
  sitioWebMercado: string | null;
  instagramMercado: string | null;
  facebookMercado: string | null;
  otroEnlaceMercado: string | null;
  observacionesContacto: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  codigoMunicipio: string | null;
  lugarEspecifico: string | null;
  /** La sede principal, aparte de la cobertura (decisión 119). */
  sedeCodigoDepartamento?: string | null;
  sedeCodigoMunicipio?: string | null;
  seRealizaEnElMarcoDeUnFestival: boolean;
  festivalId: number | null;
  organizacionId: number;
}

export interface OpcionDeMercado {
  id: number;
  nombre: string;
  slug: string;
}

export interface CatalogosDeMercado {
  alcances: OpcionDeMercado[];
  modalidades: OpcionDeMercado[];
  practicasMusicales: CatalogoDeMercado[];
  territoriosSonoros: CatalogoDeMercado[];
}

/** Un festival que un mercado puede declarar como marco. */
export interface FestivalElegible {
  id: number;
  nombre: string;
  estadoRegistro: string;
}

export interface PaginaDeMercados {
  items: Mercado[];
  total: number;
  limit: number;
  offset: number;
}


/** Una realización concreta de un mercado musical. */
export interface EdicionDeMercado {
  id: number;
  mercadoId: number;
  anio: number;
  numeroEdicion: number | null;
  nombre: string | null;
  descripcion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  codigoDepartamento: string | null;
  nombreDepartamento: string | null;
  codigoMunicipio: string | null;
  nombreMunicipio: string | null;
  lugarEspecifico: string | null;
  estado: string;
  estadoVisibilidad: string;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  fechaPublicacion: string | null;
}

/** Lo que se manda para crear o guardar una edición. */
export interface EdicionDeMercadoParaGuardar {
  anio: number;
  numeroEdicion: number | null;
  nombre: string | null;
  descripcion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  codigoDepartamento: string | null;
  codigoMunicipio: string | null;
  lugarEspecifico: string | null;
  estado: string;
  estadoVisibilidad: string;
}

/**
 * El ciclo real del acontecimiento, con la palabra que se enseña.
 *
 * NO ES LO MISMO QUE LA VISIBILIDAD: un mercado cancelado que sigue publicado es información
 * legítima, y con un solo eje habría que elegir entre decir que se canceló y decir que se ve.
 */
export const ETIQUETAS_ESTADO_EDICION: Readonly<Record<string, string>> = {
  en_preparacion: 'En preparación',
  programada: 'Programada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export const ETIQUETAS_VISIBILIDAD_EDICION: Readonly<Record<string, string>> = {
  borrador: 'Borrador',
  publicado: 'Publicada',
  archivado: 'Archivada',
};

/** Los estados por los que pasa un mercado, con la palabra que se enseña. */
// `rechazado` es TERMINAL: lo que se rechaza sin haberse publicado, igual que un Festival.
export const ETIQUETAS_ESTADO_MERCADO: Readonly<Record<string, string>> =
  etiquetasDeEstados('borrador', 'en_revision', 'ajustes_solicitados', 'publicado', 'archivado', 'rechazado');

/**
 * Un cambio pedido sobre un campo concreto de la ficha de un mercado.
 *
 * ES EL MISMO TIPO EN LOS DOS SENTIDOS: quien pide el cambio y quien lo atiende miran exactamente
 * lo mismo —el campo, su rótulo, lo que decía y la nota—. Con dos formas distintas, la segunda se
 * olvida.
 */
export interface ObservacionDeCampo {
  id: number;
  ambito: string;
  subregistroId: string | null;
  seccionId: string;
  campoId: string;
  campoEtiqueta: string;
  valorObservado: string | null;
  nota: string;
  /** pendiente | atendida. */
  estado: string;
  fechaAtencion: string | null;
}

/** El borrador de revisión de un mercado: la observación general y las notas por campo. */
export interface RevisionDeCamposDeMercado {
  id: number;
  moduloId: string;
  registroId: string;
  registroNombre: string;
  /** borrador | enviada | cerrada. */
  estado: string;
  observacionGeneral: string | null;
  revisorNombre: string | null;
  destinatarioNombre: string | null;
  organizacionNombre: string | null;
  fechaActualizacion: string | null;
  fechaEnvio: string | null;
  observaciones: ObservacionDeCampo[];
}

/** Una nota tal como sale del formulario. Sin `id`: el servidor casa por campo. */
export interface ObservacionParaGuardar {
  ambito: string;
  subregistroId: string | null;
  seccionId: string;
  campoId: string;
  campoEtiqueta: string;
  valorObservado: string | null;
  nota: string;
}

/**
 * Los Mercados Musicales en la consola.
 *
 * <b>ORDENAR Y PAGINAR LOS RESUELVE EL SERVIDOR.</b> No este servicio ni el panel que lo usa: la
 * regla del proyecto es que ordenar una tabla actúa sobre TODOS los registros y no sobre la página
 * cargada, y la única forma de cumplirla con una lista paginada es que el orden viaje en la
 * petición.
 */
@Injectable({ providedIn: 'root' })
export class MercadosService {
  private readonly api = inject(ApiClientService);

  listar(opciones: {
    q?: string;
    estado?: string;
    organizacion?: number;
    orden?: string;
    descendente?: boolean;
    incluirBorradores?: boolean;
    /** La SEDE principal (decisión 124): departamento, municipio o solo las pendientes de completar. */
    sedeDepartamento?: string;
    sedeMunicipio?: string;
    sedePendiente?: boolean;
    pagina?: number;
    tamano?: number;
  } = {}): Observable<PaginaDeMercados> {
    const parametros = new URLSearchParams();
    if (opciones.q) parametros.set('q', opciones.q);
    // «todos» no viaja: el servidor ya trata la ausencia del parámetro como «sin filtro», y
    // mandarlo obligaría a que las dos partes se pusieran de acuerdo en la misma palabra.
    if (opciones.estado && opciones.estado !== 'todos') parametros.set('estado', opciones.estado);
    if (opciones.organizacion) parametros.set('organizacion', String(opciones.organizacion));
    if (opciones.orden) parametros.set('orden', opciones.orden);
    if (opciones.descendente) parametros.set('descendente', 'true');
    // SOLO SE MANDA CUANDO SE PIDE OCULTARLOS: el servidor los incluye por omisión.
    if (opciones.incluirBorradores === false) parametros.set('incluirBorradores', 'false');
    if (opciones.sedeDepartamento) parametros.set('sedeDepartamento', opciones.sedeDepartamento);
    if (opciones.sedeMunicipio) parametros.set('sedeMunicipio', opciones.sedeMunicipio);
    if (opciones.sedePendiente) parametros.set('sedePendiente', 'true');
    if (opciones.pagina) parametros.set('pagina', String(opciones.pagina));
    if (opciones.tamano) parametros.set('tamano', String(opciones.tamano));
    const cadena = parametros.toString();

    return this.api.get<PaginaDeMercados>('/api/v1/institucional/mercados' + (cadena ? '?' + cadena : ''), {
      errorFallback: 'No fue posible leer los mercados musicales',
    });
  }

  catalogos(): Observable<CatalogosDeMercado> {
    return this.api.get<CatalogosDeMercado>('/api/v1/institucional/mercados/catalogos', {
      errorFallback: 'No fue posible leer los catálogos de mercados',
    });
  }

  /**
   * Los festivales que ese mercado puede declarar como marco.
   *
   * <b>SE PIDEN POR ORGANIZACION, y esa es toda la regla.</b> No se filtran por estado: un festival
   * en borrador se puede elegir igual que uno publicado, porque la condición es existir y
   * pertenecer.
   */
  festivalesElegibles(organizacion: number): Observable<FestivalElegible[]> {
    return this.api.get<FestivalElegible[]>(
      `/api/v1/institucional/mercados/festivales-elegibles?organizacion=${organizacion}`,
      { errorFallback: 'No fue posible leer los festivales de esa organización' },
    );
  }

  // ── Ediciones ───────────────────────────────────────────────────────────────────────────────
  //
  // NO PASAN POR REVISION INSTITUCIONAL: el control de calidad está en la puerta de entrada del
  // mercado, no en cada realización.

  ediciones(mercadoId: number): Observable<EdicionDeMercado[]> {
    return this.api.get<EdicionDeMercado[]>(`/api/v1/institucional/mercados/${mercadoId}/ediciones`, {
      errorFallback: 'No fue posible leer las ediciones del mercado',
    });
  }

  crearEdicion(mercadoId: number, edicion: EdicionDeMercadoParaGuardar): Observable<EdicionDeMercado> {
    return this.api.post<EdicionDeMercado>(`/api/v1/institucional/mercados/${mercadoId}/ediciones`, edicion, {
      errorFallback: 'No fue posible crear la edición',
    });
  }

  guardarEdicion(mercadoId: number, edicionId: number, edicion: EdicionDeMercadoParaGuardar): Observable<EdicionDeMercado> {
    return this.api.put<EdicionDeMercado>(`/api/v1/institucional/mercados/${mercadoId}/ediciones/${edicionId}`, edicion, {
      errorFallback: 'No fue posible guardar la edición',
    });
  }

/**
   * Cambia si el portal enseña esta edición: publicarla, retirarla o archivarla.
   *
   * <b>CADA CAMBIO TIENE SU PUERTA, Y NO ES UN GUARDADO.</b> Reenviar la edición entera con otro
   * `estadoVisibilidad` funciona, pero se salta las reglas del servidor —publicar la edición de un
   * mercado que no está publicado, reabrir una archivada— y queda auditado como «guardar», así que
   * el historial no puede decir qué pasó.
   */
  cambiarVisibilidadDeEdicion(
    mercadoId: number, edicionId: number, accion: 'publicar' | 'despublicar' | 'archivar'): Observable<EdicionDeMercado> {
    return this.api.post<EdicionDeMercado>(
      `/api/v1/institucional/mercados/${mercadoId}/ediciones/${edicionId}/${accion}`, {}, {
        errorFallback: 'No fue posible cambiar la edición',
      });
  }

  /** Borra una edición que nunca llegó al portal. Lo publicado se archiva, no se borra. */
  eliminarEdicion(mercadoId: number, edicionId: number): Observable<void> {
    return this.api.delete<void>(`/api/v1/institucional/mercados/${mercadoId}/ediciones/${edicionId}`, {
      errorFallback: 'No fue posible eliminar la edición',
    });
  }

  // ─────────────────── La revisión por campos, como en Festivales ───────────────────
  //
  // ANTES ERA UN PARRAFO. Todo lo que hubiera que decir sobre treinta campos cabía en el motivo de
  // «pedir ajustes», y no había forma de saber a cuál se refería cada frase ni de contar cuántas
  // quedaban. El circuito es el mismo que el de un Festival desde.

  /** El borrador abierto, o una carcasa vacía si el mercado todavía no tiene ninguno. */
  revision(mercadoId: number): Observable<RevisionDeCamposDeMercado> {
    return this.api.get<RevisionDeCamposDeMercado>(`/api/v1/institucional/mercados/${mercadoId}/revision`, {
      errorFallback: 'No fue posible leer la solicitud de cambios',
    });
  }

  /**
   * Guarda el borrador entero.
   *
   * SEMANTICA DE REEMPLAZO: lo que va en `observaciones` es la lista completa, y lo que no vaya se
   * borra. Guardar es una sola llamada idempotente en vez de tres rutas y una cuenta que llevar.
   */
  guardarRevision(
    mercadoId: number, observacionGeneral: string | null, observaciones: ObservacionParaGuardar[]): Observable<RevisionDeCamposDeMercado> {
    return this.api.put<RevisionDeCamposDeMercado>(
      `/api/v1/institucional/mercados/${mercadoId}/revision`, { observacionGeneral, observaciones }, {
        errorFallback: 'No fue posible guardar la solicitud de cambios',
      });
  }

  /** Envía la solicitud: el mercado vuelve a la organización con las notas. */
  enviarRevision(
    mercadoId: number, observacionGeneral: string | null, observaciones: ObservacionParaGuardar[]): Observable<RevisionDeCamposDeMercado> {
    return this.api.post<RevisionDeCamposDeMercado>(
      `/api/v1/institucional/mercados/${mercadoId}/revision/enviar`, { observacionGeneral, observaciones }, {
        errorFallback: 'No fue posible enviar la solicitud de cambios',
      });
  }

  crear(mercado: MercadoParaGuardar): Observable<Mercado> {
    return this.api.post<Mercado>('/api/v1/institucional/mercados', mercado, {
      errorFallback: 'No fue posible crear el mercado',
    });
  }

  /**
   * La decisión del Programa sobre un mercado que llegó a revisión.
   *
   * <b>PEDIR AJUSTES EXIGE MOTIVO, y el servidor lo rechaza si falta.</b> «Ajustes solicitados» sin
   * decir cuáles devuelve el registro a la organización sin nada que corregir, y lo único que
   * consigue es que vuelva igual.
   */
  decidir(id: number, decision: 'publicar' | 'ajustes' | 'rechazar', motivo?: string): Observable<Mercado> {
    return this.api.post<Mercado>(`/api/v1/institucional/mercados/${id}/decision`, { decision, motivo: motivo ?? null }, {
      errorFallback: 'No fue posible registrar la decisión',
    });
  }

  /**
   * Retira del ecosistema un mercado ya publicado.
   *
   * <b>NO BORRA NADA:</b> lo archiva. El registro conserva su historial y su auditoría y deja de
   * verse en el portal. El motivo es obligatorio y el servidor lo rechaza si falta: dentro de un
   * año nadie recordará por qué se retiró.
   */
  archivar(id: number, motivo: string): Observable<Mercado> {
    return this.api.post<Mercado>(`/api/v1/institucional/mercados/${id}/archivar`, { motivo }, {
      errorFallback: 'No fue posible retirar el mercado del ecosistema',
    });
  }

  guardar(id: number, mercado: MercadoParaGuardar): Observable<Mercado> {
    return this.api.put<Mercado>(`/api/v1/institucional/mercados/${id}`, mercado, {
      errorFallback: 'No fue posible guardar el mercado',
    });
  }
}
