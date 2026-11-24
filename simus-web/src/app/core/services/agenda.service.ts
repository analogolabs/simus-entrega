import { motivoDeLaAccion } from '../formularios/traductor-de-errores';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { ElementoDeClasificacion } from './clasificacion-de-contenido.service';
import { ProcedenciaDeRegistro } from './procedencia';
import { EntradaDeHistorialDeEstados } from '../../shared/components/ui/historial-de-estados/historial-de-estados.component';
import { etiquetasDeEstados } from '../vocabularios/estados';

/**
 * La Agenda contra el API.
 *
 * <b>Dos superficies, dos rutas.</b> La consola lee `/institucional/agenda` y ve todo; el portal
 * lee `/publico/agenda` y solo ve lo publicado. El filtro NO está aquí: está en el servidor.
 *
 * <b>`situacion` LA CALCULA EL SERVIDOR.</b> Repetir aquí el cálculo de «próximo / en curso /
 * finalizado» daría tantas definiciones de «en curso» como pantallas, y la primera que se olvidara
 * del evento de varios días lo daría por finalizado en su segunda jornada.
 */

export interface EventoAgenda {
  id: number;
  slug: string;
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string | null;
  horaInicio: string | null;
  modalidad: string;
  lugar: string | null;
  codigoDepartamento: string | null;
  nombreDepartamento: string | null;
  codigoMunicipio: string | null;
  nombreMunicipio: string | null;
  url: string | null;
  imagenRuta: string | null;
  imagenAlternativa: string | null;
  /** La categoría temática administrable. Es lo que se guarda. */
  categoriaId: number | null;
  /** Su nombre, resuelto por el servidor. Solo lectura: el diseño aprobado filtra por él. */
  categoria: string | null;
  /** Quién organiza. La tarjeta del diseño aprobado lo enseña. */
  organizador: string | null;
  descripcionLarga: string | null;
  horaFin: string | null;
  /** nacional · departamental · municipal. Lo deduce el servidor de los códigos. */
  nivelCobertura: string;
  ordenVisualizacion: number | null;
  festivalId: number | null;
  /** El archivo del banco vinculado como imagen principal. */
  imagenArchivoId: number | null;
  imagenUrl: string | null;
  imagenAlt: string | null;
  estado: string;
  situacion: string;
  version: number;
  etiquetas: string[];
  /** Clasificación opcional contra los catálogos del sistema. Puede venir vacía. */
  practicasMusicales: ElementoDeClasificacion[];
  territoriosSonoros: ElementoDeClasificacion[];
  /** De dónde vino el registro. Nulo en lo anterior a la tabla de procedencia. */
  procedencia: ProcedenciaDeRegistro | null;
  /** Las iniciativas del Programa a las que pertenece. No es su categoría. */
  proyectosTransversales: ElementoDeClasificacion[];
  fechaActualizacion: string;
  /**
   * El evento publicado ya no se realiza (D3-13). NO es un estado del circuito ni cambia la
   * `situacion` (que es solo de tiempo): sigue «publicado» y visible, con su aviso aparte. Opcional
   * por las respuestas anteriores al cambio.
   */
  cancelado?: boolean;
  /** Por qué se canceló. Lo enseña la ficha junto al aviso. */
  motivoCancelacion?: string | null;
  /** De qué Festival, Mercado, Taller, Espacio o Red es y quién lo organiza (D3-15). Solo en la ficha, no en las listas. */
  proceso?: ProcesoDelEvento | null;
  /**
   * El tipo de proceso que enmarca el evento —`festival`, `mercado`, `taller`, `espacio` o `red`— o nulo (LUT-01).
   * Viaja también en las listas: pinta la etiqueta de la tarjeta y filtra la Agenda.
   */
  procesoTipo?: string | null;
}

/**
 * Cómo se llama cada tipo de proceso ante el público (LUT-01). Los procesos de lutería, redes y espacios para
 * música en vivo no tienen una agenda aparte: sus eventos están en esta, con su tipo y su filtro.
 */
export const ETIQUETAS_DE_PROCESO_DEL_EVENTO: Readonly<Record<string, string>> = {
  festival: 'Festival',
  mercado: 'Mercado',
  taller: 'Taller de lutería',
  espacio: 'Espacio para música en vivo',
  red: 'Red y documentación',
};

/** De qué proceso es un evento y de qué organización pública (D3-15). */
export interface ProcesoDelEvento {
  /** `festival`, `mercado`, `taller`, `espacio` o `red`. */
  tipo: string;
  id: number;
  nombre: string;
  /** Solo si la organización es pública: el enlace a su ficha nunca termina en «no disponible». */
  organizacionId: number | null;
  organizacionNombre: string | null;
}

export interface PaginaEventosAgenda {
  items: EventoAgenda[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

/** Los estados de un evento, con la palabra del vocabulario único. */
export const ETIQUETAS_ESTADO_EVENTO: Readonly<Record<string, string>> =
  etiquetasDeEstados('borrador', 'en_revision', 'publicado', 'rechazado', 'archivado');

export const ETIQUETAS_SITUACION: Record<string, string> = {
  proximo: 'Próximo',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
};

export const ETIQUETAS_MODALIDAD: Record<string, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  mixta: 'Mixta',
};

export interface ResultadoAgenda<T> {
  ok: boolean;
  data?: T | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly api = inject(ApiClientService);

  private static readonly CONSOLA = '/api/v1/institucional/agenda';
  private static readonly PUBLICO = '/api/v1/publico/agenda';

  private async envolver<T>(operacion: () => Promise<T>, respaldo: string): Promise<ResultadoAgenda<T>> {
    try {
      return { ok: true, data: await operacion() };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, respaldo) };
    }
  }

  listarPublicos(filtros: { q?: string; etiqueta?: string; departamento?: string; categoria?: string; proyecto?: string; cuando?: string; pagina?: number; tamano?: number } = {}) {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.etiqueta) params.set('etiqueta', filtros.etiqueta);
    if (filtros.departamento) params.set('departamento', filtros.departamento);
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.proyecto) params.set('proyecto', filtros.proyecto);
    if (filtros.cuando) params.set('cuando', filtros.cuando);
    if (filtros.tamano) params.set('tamano', String(filtros.tamano));
    params.set('pagina', String(filtros.pagina ?? 1));
    return this.envolver(
      () => firstValueFrom(this.api.get<PaginaEventosAgenda>(`${AgendaService.PUBLICO}?${params.toString()}`, {})),
      'No fue posible consultar la agenda.');
  }

  obtenerPublico(slug: string) {
    return this.envolver(
      () => firstValueFrom(this.api.get<EventoAgenda>(`${AgendaService.PUBLICO}/${encodeURIComponent(slug)}`, {})),
      'No fue posible abrir el evento.');
  }

  listarInternos(filtros: { q?: string; estado?: string; categoria?: string; procedencia?: string; incluirArchivados?: boolean; orden?: string; direccion?: string; pagina?: number } = {}) {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.procedencia) params.set('procedencia', filtros.procedencia);
    // SOLO SE MANDA CUANDO SE PIDE OCULTARLOS: el servidor los incluye por omisión, así que
    // mandar `true` sería ruido en la dirección sin cambiar la respuesta.
    if (filtros.incluirArchivados === false) params.set('incluirArchivados', 'false');
    // EL ORDEN LO RESUELVE EL SERVIDOR. Ordenar las doce filas que trae la página no reordena la
    // lista: la baraja dentro de su página, y en la primera nunca aparece lo que vive en la
    // trigésima. Sin columna elegida no se manda nada y responde con el orden de trabajo.
    if (filtros.orden) params.set('orden', filtros.orden);
    if (filtros.direccion) params.set('direccion', filtros.direccion);
    params.set('pagina', String(filtros.pagina ?? 1));
    return this.envolver(
      () => firstValueFrom(this.api.get<PaginaEventosAgenda>(`${AgendaService.CONSOLA}?${params.toString()}`, {})),
      'No fue posible consultar la agenda.');
  }

  /**
   * Un evento por su identificador. Abre su ficha desde la dirección aunque no esté en la página
   * abierta de la lista: la lista pagina en el servidor, y un enlace compartido
   * a un evento que cae en la página 30 no puede decir «no está».
   */
  obtenerInterno(id: number | string) {
    return this.envolver(
      () => firstValueFrom(this.api.get<EventoAgenda>(`${AgendaService.CONSOLA}/${encodeURIComponent(String(id))}`, {})),
      'No fue posible abrir el evento.');
  }

  crear(evento: Partial<EventoAgenda> & { etiquetas?: string[] }) {
    return this.envolver(
      () => firstValueFrom(this.api.post<EventoAgenda>(AgendaService.CONSOLA, evento, {})),
      'No fue posible crear el evento.');
  }

  guardar(id: number, evento: Partial<EventoAgenda> & { etiquetas?: string[]; version: number }) {
    return this.envolver(
      () => firstValueFrom(this.api.put<EventoAgenda>(`${AgendaService.CONSOLA}/${id}`, evento, {})),
      'No fue posible guardar el evento.');
  }

  cambiarEstado(id: number, estado: string, motivo?: string) {
    return this.envolver(
      () => firstValueFrom(this.api.post<EventoAgenda>(`${AgendaService.CONSOLA}/${id}/estado`, motivo ? { estado, motivo } : { estado }, {})),
      'No fue posible cambiar el estado del evento.');
  }

  /** El historial de estados: de qué a qué, cuándo, quién y por qué. */
  historial(id: number) {
    return this.envolver(
      () => firstValueFrom(this.api.get<EntradaDeHistorialDeEstados[]>(`${AgendaService.CONSOLA}/${id}/historial`, {})),
      'No fue posible consultar el historial de el evento.');
  }
}
