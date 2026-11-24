import { motivoDeLaAccion } from '../formularios/traductor-de-errores';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';
import { PrevisualizacionEnListadoService } from './previsualizacion-en-listado.service';
import { ElementoDeClasificacion } from './clasificacion-de-contenido.service';
import { ProcedenciaDeRegistro } from './procedencia';
import { EntradaDeHistorialDeEstados } from '../../shared/components/ui/historial-de-estados/historial-de-estados.component';
import { etiquetasDeEstados } from '../vocabularios/estados';

/**
 * Noticias contra el API.
 *
 * <b>Dos superficies, dos rutas.</b> La consola lee `/institucional/noticias` y ve todo; el portal
 * lee `/publico/noticias` y solo ve lo publicado con fecha llegada. El filtro NO está aquí: está
 * en el servidor, en un único sitio, porque una condición de visibilidad que viva en el navegador
 * la salta cualquiera con la consola abierta.
 */

export interface Noticia {
  id: number;
  slug: string;
  titulo: string;
  resumen: string;
  cuerpo: string | null;
  fechaPublicacion: string | null;
  imagenRuta: string | null;
  imagenAlternativa: string | null;
  autoriaNombre: string | null;
  /** El archivo del banco con rol «imagen_principal», si lo hay. */
  imagenArchivoId: number | null;
  imagenUrl: string | null;
  imagenAlt: string | null;
  /** La categoría temática administrable. Es lo que se guarda. */
  categoriaId: number | null;
  /** Su nombre, resuelto por el servidor. El diseño aprobado organiza el portal alrededor de él. */
  categoria: string | null;
  /** El estado guardado. Es con el que se decide qué acciones caben. */
  estado: string;
  /**
   * Cómo está HOY, contando su fecha de aparición.
   *
   * COINCIDE CON `estado` SALVO EN UN CASO: publicada con fecha futura, que es «programada». Es lo
   * que hay que ENSEÑAR. Lo calcula el servidor, que es el que conoce la fecha buena.
   */
  estadoEfectivo: string;
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
}

export interface PaginaNoticias {
  items: Noticia[];
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

/** Las etiquetas que ve una persona. El código vive en el servidor; aquí solo se presenta. */
export const ETIQUETAS_ESTADO_NOTICIA: Readonly<Record<string, string>> = {
  // LOS DEL CIRCUITO, CON LA PALABRA DEL VOCABULARIO ÚNICO.
  ...etiquetasDeEstados('borrador', 'en_revision', 'publicado', 'rechazado', 'archivado'),
  /**
   * PUBLICADA, PERO CON FECHA FUTURA.
   *
   * No es un estado que se guarde: lo calcula el servidor con su propia fecha y viaja en
   * `estadoEfectivo`. Una noticia así NO está en el portal todavía, y llamarla «Publicado» hacía
   * creer lo contrario.
   */
  programada: 'Programada',
};

/** El mismo sobre que usa el resto de la consola: éxito con datos, o fallo con un motivo legible. */
export interface ResultadoNoticia<T> {
  ok: boolean;
  data?: T | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class NoticiasService {
  /**
   * La última lista pública de Noticias traída de la red, con el momento en que llegó.
   * La pantalla de Noticias la reutiliza durante un minuto para que volver desde una noticia pinte
   * la lista de inmediato y el navegador pueda restaurar el desplazamiento. Vive aquí, y no en una
   * variable del módulo, para que cada prueba parta de un servicio limpio.
   */
  ultimaListaPublica: { momento: number; items: Noticia[] } | null = null;

  private readonly api = inject(ApiClientService);
  private readonly previsualizacion = inject(PrevisualizacionEnListadoService);

  private static readonly CONSOLA = '/api/v1/institucional/noticias';
  private static readonly PUBLICO = '/api/v1/publico/noticias';

  private async envolver<T>(operacion: () => Promise<T>, respaldo: string): Promise<ResultadoNoticia<T>> {
    try {
      return { ok: true, data: await operacion() };
    } catch (error: unknown) {
      return { ok: false, error: motivoDeLaAccion(error, respaldo) };
    }
  }

  listarPublicas(filtros: { q?: string; etiqueta?: string; categoria?: string; proyecto?: string; pagina?: number; tamano?: number } = {}) {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.etiqueta) params.set('etiqueta', filtros.etiqueta);
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.proyecto) params.set('proyecto', filtros.proyecto);
    if (filtros.tamano) params.set('tamano', String(filtros.tamano));
    params.set('pagina', String(filtros.pagina ?? 1));
    return this.envolver(
      async () => {
        const pagina = await firstValueFrom(
          this.api.get<PaginaNoticias>(`${NoticiasService.PUBLICO}?${params.toString()}`, {}));
        // LA PREVISUALIZACION ENTRA POR DONDE ENTRAN LOS DATOS, no tocando la pantalla: el diseño
        // de Noticias está aprobado tal cual y la tarjeta que se ve tiene que ser la de verdad.
        // Ver `PrevisualizacionEnListadoService`; sin el parámetro no se pide nada.
        const id = this.previsualizacion.idPara('noticias');
        if (id === null) return pagina;
        const previsualizada = await this.previsualizacion.obtener<Noticia>('noticias', id);
        return {
          ...pagina,
          items: this.previsualizacion.anteponer(pagina.items ?? [], previsualizada, (a, b) => a.id === b.id, 'noticias'),
        };
      },
      'No fue posible consultar las noticias.');
  }

  obtenerPublica(slug: string) {
    return this.envolver(
      () => firstValueFrom(this.api.get<Noticia>(`${NoticiasService.PUBLICO}/${encodeURIComponent(slug)}`, {})),
      'No fue posible abrir la noticia.');
  }

  listarInternas(filtros: { q?: string; estado?: string; categoria?: string; orden?: string; direccion?: string; pagina?: number } = {}) {
    const params = new URLSearchParams();
    if (filtros.q) params.set('q', filtros.q);
    if (filtros.estado) params.set('estado', filtros.estado);
    // LA CATEGORIA Y EL ORDEN LOS RESUELVE EL SERVIDOR. La lista pagina: filtrar u ordenar la
    // página cargada respondería sobre doce noticias y callaría sobre el resto.
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.orden) params.set('orden', filtros.orden);
    if (filtros.direccion) params.set('direccion', filtros.direccion);
    params.set('pagina', String(filtros.pagina ?? 1));
    return this.envolver(
      () => firstValueFrom(this.api.get<PaginaNoticias>(`${NoticiasService.CONSOLA}?${params.toString()}`, {})),
      'No fue posible consultar las noticias.');
  }

  /**
   * Una noticia por su identificador. Abre su ficha desde la dirección aunque no esté en la página
   * abierta de la lista: la lista pagina en el servidor.
   */
  obtenerInterna(id: number | string) {
    return this.envolver(
      () => firstValueFrom(this.api.get<Noticia>(`${NoticiasService.CONSOLA}/${encodeURIComponent(String(id))}`, {})),
      'No fue posible abrir la noticia.');
  }

  crear(noticia: Partial<Noticia> & { etiquetas?: string[] }) {
    return this.envolver(
      () => firstValueFrom(this.api.post<Noticia>(NoticiasService.CONSOLA, noticia, {})),
      'No fue posible crear la noticia.');
  }

  guardar(id: number, noticia: Partial<Noticia> & { etiquetas?: string[]; version: number }) {
    return this.envolver(
      () => firstValueFrom(this.api.put<Noticia>(`${NoticiasService.CONSOLA}/${id}`, noticia, {})),
      'No fue posible guardar la noticia.');
  }

  cambiarEstado(id: number, estado: string, motivo?: string) {
    return this.envolver(
      () => firstValueFrom(this.api.post<Noticia>(`${NoticiasService.CONSOLA}/${id}/estado`, motivo ? { estado, motivo } : { estado }, {})),
      'No fue posible cambiar el estado de la noticia.');
  }

  /** El historial de estados: de qué a qué, cuándo, quién y por qué. */
  historial(id: number) {
    return this.envolver(
      () => firstValueFrom(this.api.get<EntradaDeHistorialDeEstados[]>(`${NoticiasService.CONSOLA}/${id}/historial`, {})),
      'No fue posible consultar el historial de la noticia.');
  }
}
