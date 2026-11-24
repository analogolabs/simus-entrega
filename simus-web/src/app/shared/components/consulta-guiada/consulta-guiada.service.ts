import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../core/http/api-client.service';

/** Una pregunta que el catálogo sabe resolver. */
export interface ConsultaOfrecida {
  id: string;
  rotulo: string;
  descripcion: string;
}

/** Qué puede responder la Consulta Guiada para quien pregunta. */
export interface EstadoDeConsultaGuiada {
  disponible: boolean;
  modeloLocalDisponible: boolean;
  modo: 'deterministico' | 'modelo_local';
  mensaje: string;
  consultas: ConsultaOfrecida[];
  sugerencias: string[];
}

/** La tabla que prueba de dónde salió una respuesta. */
export interface TablaDeConsulta {
  titulo: string;
  fuente: string;
  alcance: string;
  columnas: string[];
  filas: string[][];
  /** Ruta interna del portal a la que lleva cada fila (alineada con `filas`); solo la consulta pública la trae. */
  destinos?: (string | null)[] | null;
  /** Índice de la celda que se pinta como enlace. */
  columnaDeEnlace?: number;
  /** Los filtros con que se calculó («Departamento: Nariño», «Solo registros publicados»). */
  filtrosAplicados?: string[] | null;
}

export interface RespuestaDeConsultaGuiada {
  respuesta: string;
  consultaElegida: string;
  resueltoPor: 'regla' | 'modelo_local' | 'sin_coincidencia' | 'banco_publico';
  generadoEn: string;
  consulta: TablaDeConsulta | null;
  /** Sobre qué se calculó: «Toda la operación», «el Festival …». Nunca se esconde. */
  contexto: string;
}

/** Desde dónde se pregunta. */
export interface ContextoDeConsulta {
  seccion?: string;
  organizacionId?: number;
  festivalId?: number;
}

/** Un parámetro tipado de una pregunta del banco público. */
export interface ParametroDePregunta {
  nombre: 'departamento' | 'municipio' | 'tipo' | 'practica' | 'territorio' | 'organizacion' | 'mes' | 'anio';
  rotulo: string;
  obligatorio: boolean;
}

/** Una pregunta del banco público; si trae parámetros, se piden antes de ejecutar. */
export interface PreguntaPublica extends ConsultaOfrecida {
  parametros: ParametroDePregunta[];
  /** Siempre «publico» en el portal: lo fija el endpoint. */
  ambito?: string;
  /** Formulaciones de ejemplo (insumo de la capa semántica); la interfaz no las usa. */
  ejemplos?: string[];
}

export interface ValorDeCatalogo { id: string; nombre: string }
export interface TipoDeProcesoPublico { id: string; singular: string; plural: string; pistas: string[] }

/** Los catálogos contra los que el servidor valida los parámetros; el cajón los usa para reconocer lo escrito. */
export interface CatalogosDeConsultaPublica {
  departamentos: ValorDeCatalogo[];
  /** Cada fila es [código, nombre]; el departamento son los dos primeros dígitos del código. */
  municipios: string[][];
  tipos: TipoDeProcesoPublico[];
  practicas: ValorDeCatalogo[];
  territorios: ValorDeCatalogo[];
  organizaciones: ValorDeCatalogo[];
}

/** Lo que ofrece la Consulta Guiada del portal público: un banco cerrado de preguntas con parámetros tipados. */
export interface EstadoDeConsultaGuiadaPublica {
  disponible: boolean;
  modo: 'banco_publico';
  mensaje: string;
  preguntas: PreguntaPublica[];
  catalogos: CatalogosDeConsultaPublica;
}

/**
 * Habla con la Consulta Guiada, sea la del Programa o la de una organización.
 *
 * <b>UNA SOLA CLASE PARA LOS DOS ESPACIOS.</b> Las dos rutas terminan en <code>/estado</code> y
 * <code>/consultar</code> y devuelven exactamente el mismo contrato, porque detrás son el mismo
 * núcleo con distinto ámbito. Un servicio por espacio habría duplicado el manejo de errores y, con
 * el tiempo, las dos formas de leer la respuesta.
 */
@Injectable({ providedIn: 'root' })
export class ConsultaGuiadaService {
  private readonly api = inject(ApiClientService);

  estado(base: string): Observable<EstadoDeConsultaGuiada> {
    return this.api.get<EstadoDeConsultaGuiada>(`${base}/estado`, {
      errorFallback: 'No fue posible consultar qué puede responder el asistente.',
    });
  }

  consultar(base: string, pregunta: string, contexto?: ContextoDeConsulta): Observable<RespuestaDeConsultaGuiada> {
    return this.api.post<RespuestaDeConsultaGuiada>(`${base}/consultar`, { pregunta, contexto }, {
      errorFallback: 'El asistente no pudo responder.',
    });
  }

  /** La Consulta Guiada del portal público: anónima, con un banco cerrado de preguntas publicadas. */
  estadoPublico(): Observable<EstadoDeConsultaGuiadaPublica> {
    return this.api.get<EstadoDeConsultaGuiadaPublica>('/api/v1/publico/consulta-guiada/estado', {
      errorFallback: 'No fue posible consultar qué preguntas frecuentes ofrece el Asistente.',
    });
  }

  /** Consulta abierta (modelo local del proyecto). Si el modelo está apagado, `modeloDisponible` es falso y el cajón no la ofrece. */
  estadoAbierto(): Observable<EstadoDeConsultaAbierta> {
    return this.api.get<EstadoDeConsultaAbierta>('/api/v1/publico/consulta-abierta/estado', {
      errorFallback: 'No fue posible consultar si la consulta abierta está disponible.',
    });
  }

  consultarAbierta(cuerpo: { pregunta?: string; consulta?: ConsultaEstructurada }): Observable<RespuestaDeConsultaAbierta> {
    // El modelo local puede tardar entre 2 y 30 s en la primera respuesta (arranque en frío): el panel ya espera hasta 60 s
    // y lo dice con «Pensando…»; sin este tope el cliente HTTP abortaba a los 20 s con «tardó demasiado».
    return this.api.post<RespuestaDeConsultaAbierta>('/api/v1/publico/consulta-abierta/consultar', cuerpo, {
      timeoutMs: 60_000,
      errorFallback: 'La consulta no pudo responder.',
    });
  }

  consultarPublica(preguntaId: string, parametros?: Record<string, string>): Observable<RespuestaDeConsultaGuiada> {
    return this.api.post<RespuestaDeConsultaGuiada>('/api/v1/publico/consulta-guiada/consultar', { preguntaId, parametros }, {
      errorFallback: 'La consulta no pudo responder.',
    });
  }
}

/** Un filtro de la consulta estructurada de la consulta abierta. */
export interface FiltroDeConsultaAbierta { campo: string; operador: string; valor: string }

/** La consulta estructurada que el modelo produce y el servidor valida; es lo que se edita al quitar un filtro. */
export interface ConsultaEstructurada {
  entidad: string;
  filtros?: FiltroDeConsultaAbierta[] | null;
  agrupar?: string[] | null;
  metrica?: { funcion: string; campo?: string | null } | null;
  orden?: { campo: string; direccion: string } | null;
  limite?: number | null;
}

export interface EstadoDeConsultaAbierta {
  disponible: boolean;
  modeloDisponible: boolean;
  mensaje: string;
  maximoDePregunta: number;
  ejemplos: string[];
}

/** `estado`: ok · sin_modelo · no_entendida · fuera_de_catalogo · ocupado. `via`: plantilla · modelo · consulta_editada. */
export interface RespuestaDeConsultaAbierta {
  estado: 'ok' | 'sin_modelo' | 'no_entendida' | 'fuera_de_catalogo' | 'ocupado';
  mensaje: string;
  via: 'plantilla' | 'modelo' | 'consulta_editada' | null;
  resumen: string | null;
  consultaEntendida: ConsultaEstructurada | null;
  comoEntendi: string[];
  tabla: TablaDeConsulta | null;
  grafico: 'barras' | 'linea' | null;
  sugerencias: string[];
  latenciaMs: number;
  preguntaId?: string | null;
}
