import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { EspaciosService, etiquetaDeAmbiente, etiquetaDeEstadoDeEspacio } from './espacios.service';
import { RedesService, etiquetaDeEstadoDeRed, etiquetaDeTipoDeNodo } from './redes.service';
import { TalleresService, etiquetaDeEstadoDeTaller, etiquetaDeModalidad } from './talleres.service';

/** Los procesos que la consola revisa con el mismo circuito (docs/desarrollo/30-consola-y-acceso.md §30.17): Talleres, Espacios y Redes. */
export type TipoDeProceso = 'talleres' | 'espacios' | 'redes';

export type DecisionSobreProceso = 'publicar' | 'ajustes' | 'rechazar';

/** Lo que tienen en común los tres procesos para la bandeja: la misma fila para cualquiera. */
export interface ProcesoEnRevision {
  id: number;
  nombre: string;
  descripcion: string | null;
  nivelCobertura: string;
  nombreDepartamento: string | null;
  nombreMunicipio: string | null;
  lugarEspecifico: string | null;
  organizacionNombre: string | null;
  responsableNombre: string | null;
  fechaEnvioARevision: string | null;
  fotoUrl?: string | null;
}

/** Los filtros que comparten las listas de la consola de los tres procesos. */
export interface FiltrosDeLaListaDeProcesos {
  q?: string;
  estado?: string;
  responsable?: string;
  sedeDepartamento?: string;
  sedeMunicipio?: string;
  sedePendiente?: boolean;
  pagina?: number;
  tamano?: number;
}

/** La fila de la lista única de procesos de la consola: la misma forma para Lutería, Espacios y Redes. */
export interface FilaDeProcesoDeLaConsola {
  tipo: TipoDeProceso;
  id: number;
  nombre: string;
  /** Modalidad, ambiente o tipo de nodo, según el tipo. */
  detalle: string;
  organizacionNombre: string | null;
  responsableNombre: string | null;
  estadoRegistro: string;
  etiquetaDeEstado: string;
  fecha: string | null;
  nivelCobertura: string;
  sede?: { nombreMunicipio?: string | null; nombreDepartamento?: string | null } | null;
  nombreMunicipio: string | null;
  nombreDepartamento: string | null;
}

/** Cómo se llama cada tipo, una sola vez: la bandeja y sus mensajes lo leen de aquí. */
export const PROCESOS_DE_LA_CONSOLA: Readonly<Record<TipoDeProceso, {
  /** Cómo se dice un registro del tipo («Taller de lutería»). */
  rotulo: string;
  /** El módulo de la consola, en plural y como lo rotula la barra. */
  modulo: string;
  /** Con qué verbo se dice que quedó publicado. */
  publicado: string;
}>> = {
  talleres: { rotulo: 'Taller de lutería', modulo: 'Talleres de lutería', publicado: 'Taller publicado.' },
  espacios: { rotulo: 'Espacio para música en vivo', modulo: 'Espacios', publicado: 'Espacio publicado.' },
  redes: { rotulo: 'Red o centro de documentación', modulo: 'Redes y documentación', publicado: 'Red publicada.' },
};

export function esTipoDeProceso(modulo: string | null | undefined): modulo is TipoDeProceso {
  return !!modulo && Object.prototype.hasOwnProperty.call(PROCESOS_DE_LA_CONSOLA, modulo);
}

/**
 * UNA SOLA IMPLEMENTACIÓN PARA LOS TRES PROCESOS (decisión 123). Los tres servicios tienen la misma
 * forma —listar en la consola, decidir con un motivo—; la bandeja de Solicitudes no los distingue más
 * que por su rótulo, y añadir un cuarto proceso es añadirlo aquí.
 */
@Injectable({ providedIn: 'root' })
export class ProcesosDeLaConsolaService {
  private readonly talleres = inject(TalleresService);
  private readonly espacios = inject(EspaciosService);
  private readonly redes = inject(RedesService);

  /** Los registros del tipo que esperan la decisión del Programa. */
  enRevision(tipo: TipoDeProceso): Observable<ProcesoEnRevision[]> {
    const filtros = { estado: 'en_revision', tamano: 100 };
    const pagina$: Observable<{ items: ProcesoEnRevision[] }> =
      tipo === 'talleres' ? this.talleres.listarEnLaConsola(filtros)
      : tipo === 'espacios' ? this.espacios.listarEnLaConsola(filtros)
      : this.redes.listarEnLaConsola(filtros);
    return pagina$.pipe(map(pagina => pagina.items ?? []));
  }

  /** La lista de la consola de un tipo, con los filtros comunes (búsqueda, estado, responsable y sede). Una sola puerta para los tres. */
  listar(tipo: TipoDeProceso, filtros: FiltrosDeLaListaDeProcesos): Observable<{ items: FilaDeProcesoDeLaConsola[]; total: number }> {
    const pagina$: Observable<{ items: unknown[]; total?: number }> =
      tipo === 'talleres' ? this.talleres.listarEnLaConsola(filtros)
      : tipo === 'espacios' ? this.espacios.listarEnLaConsola(filtros)
      : this.redes.listarEnLaConsola(filtros);
    return pagina$.pipe(map(pagina => ({
      items: ((pagina.items ?? []) as unknown as Record<string, unknown>[]).map(f => this.aFila(tipo, f)),
      total: pagina.total ?? 0,
    })));
  }

  /** Los catálogos del dominio de importación del tipo (para la plantilla). */
  catalogos(tipo: TipoDeProceso): Observable<unknown> {
    return tipo === 'talleres' ? this.talleres.catalogos() : tipo === 'espacios' ? this.espacios.catalogos() : this.redes.catalogos();
  }

  private aFila(tipo: TipoDeProceso, f: Record<string, unknown>): FilaDeProcesoDeLaConsola {
    const detalle = tipo === 'talleres' ? etiquetaDeModalidad(f['modalidad'] as never)
      : tipo === 'espacios' ? etiquetaDeAmbiente(f['ambiente'] as never)
      : etiquetaDeTipoDeNodo(f['tipoDeNodo'] as never);
    const estado = f['estadoRegistro'] as string;
    const etiquetaDeEstado = tipo === 'talleres' ? etiquetaDeEstadoDeTaller(estado)
      : tipo === 'espacios' ? etiquetaDeEstadoDeEspacio(estado)
      : etiquetaDeEstadoDeRed(estado);
    return {
      tipo,
      id: f['id'] as number,
      nombre: f['nombre'] as string,
      detalle,
      organizacionNombre: (f['organizacionNombre'] as string | null) ?? null,
      responsableNombre: (f['responsableNombre'] as string | null) ?? null,
      estadoRegistro: estado,
      etiquetaDeEstado,
      fecha: ((f['fechaActualizacion'] ?? f['fechaCreacion']) as string | null) ?? null,
      nivelCobertura: f['nivelCobertura'] as string,
      sede: f['sede'] as FilaDeProcesoDeLaConsola['sede'],
      nombreMunicipio: (f['nombreMunicipio'] as string | null) ?? null,
      nombreDepartamento: (f['nombreDepartamento'] as string | null) ?? null,
    };
  }

  decidir(tipo: TipoDeProceso, id: string | number, decision: DecisionSobreProceso, motivo: string | null): Promise<unknown> {
    return tipo === 'talleres' ? this.talleres.decidir(id, decision, motivo)
      : tipo === 'espacios' ? this.espacios.decidir(id, decision, motivo)
      : this.redes.decidir(id, decision, motivo);
  }
}
