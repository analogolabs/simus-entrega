import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';

export type TipoDeNodo = 'organizacion' | 'festival' | 'mercado' | 'territorio' | 'practica';
export type TipoDeArista = 'responsable' | 'declara' | 'en_el_marco';

export interface NodoDeRed {
  readonly id: string;
  readonly tipo: TipoDeNodo;
  readonly nombre: string;
  readonly departamento: string;
}

export interface AristaDeRed {
  readonly origen: string;
  readonly destino: string;
  readonly tipo: TipoDeArista;
}

export interface RedDelEcosistema {
  readonly nodos: readonly NodoDeRed[];
  readonly aristas: readonly AristaDeRed[];
  /** Si el servidor recortó la red por tamaño: se dice en pantalla, no se corta en silencio. */
  readonly truncada: boolean;
}

interface RedCruda {
  readonly nodos?: { id?: string; tipo?: string; nombre?: string; departamento?: string | null }[];
  readonly aristas?: { origen?: string; destino?: string; tipo?: string }[];
  readonly truncada?: boolean;
}

const TIPOS_DE_NODO: readonly string[] = ['organizacion', 'festival', 'mercado', 'territorio', 'practica'];
const TIPOS_DE_ARISTA: readonly string[] = ['responsable', 'declara', 'en_el_marco'];

/**
 * La red del ecosistema: organizaciones, festivales, mercados, territorios sonoros y prácticas unidos solo por
 * relaciones REGISTRADAS (el servidor no infiere ninguna) y sin personas.
 *
 * <b>SE DESCARTA LO QUE NO ENCAJA</b>: un nodo de tipo desconocido o una arista cuyos extremos no
 * existen se quitan aquí, para que el gráfico nunca dibuje una relación a medias.
 */
@Injectable({ providedIn: 'root' })
export class RedDelEcosistemaService {
  private readonly api = inject(ApiClientService);

  /** Se pide una vez por visita: volver a la pestaña no repite la consulta, y un fallo no se guarda. */
  private guardada: Observable<RedDelEcosistema> | null = null;

  consultar(): Observable<RedDelEcosistema> {
    this.guardada ??= this.api.get<RedCruda>('/api/v1/publico/analitica/ecosistema/red', {
      errorFallback: 'No fue posible cargar la red del ecosistema',
    }).pipe(
      map((respuesta) => normalizarRed(respuesta)),
      tap({ error: () => { this.guardada = null; } }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.guardada;
  }
}

export function normalizarRed(respuesta: RedCruda | null | undefined): RedDelEcosistema {
  const nodos: NodoDeRed[] = (respuesta?.nodos ?? [])
    .filter((nodo) => !!nodo?.id && TIPOS_DE_NODO.includes(String(nodo.tipo)))
    .map((nodo) => ({
      id: String(nodo.id), tipo: nodo.tipo as TipoDeNodo, nombre: String(nodo.nombre ?? ''), departamento: String(nodo.departamento ?? ''),
    }));
  const ids = new Set(nodos.map((nodo) => nodo.id));
  const aristas: AristaDeRed[] = (respuesta?.aristas ?? [])
    .filter((arista) => ids.has(String(arista?.origen)) && ids.has(String(arista?.destino)) && TIPOS_DE_ARISTA.includes(String(arista?.tipo)))
    .map((arista) => ({ origen: String(arista.origen), destino: String(arista.destino), tipo: arista.tipo as TipoDeArista }));
  return { nodos, aristas, truncada: !!respuesta?.truncada };
}
