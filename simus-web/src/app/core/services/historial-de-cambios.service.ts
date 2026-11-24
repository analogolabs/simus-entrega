import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClientService } from '../http/api-client.service';

/**
 * Los cambios de datos de un registro, campo por campo (docs/desarrollo/24-versionamiento-y-gobierno-del-dato.md).
 *
 * <b>ES EL ÚNICO SISTEMA DE HISTORIA DE DATOS.</b> Lo que antes eran «versiones» de un Festival, las
 * correcciones de una edición, los ajustes de una organización y el cuerpo de una noticia se leen
 * por aquí, con la misma forma. Los estados y sus motivos siguen viniendo en la misma línea de
 * tiempo (tipo <code>estado</code>), pero esta pantalla solo pinta los cambios de datos: los estados
 * ya los enseña el apartado «Estados y motivos».
 */

/** Un campo que cambió: qué valía, qué vale y de qué clase de dato es. */
export interface CambioDeCampo {
  readonly campoId: string;
  readonly campo: string;
  /** publico, contacto, identificacion o sensible. La organización solo recibe «publico». */
  readonly clase: string;
  readonly valorAnterior: string | null;
  readonly valorNuevo: string | null;
  /**
   * Si el valor es un código de catálogo (un municipio, una tipología…), el nombre que tenía ese día.
   * El código es interno: la pantalla lee el nombre y, si falta, el valor.
   */
  readonly nombreAnterior?: string | null;
  readonly nombreNuevo?: string | null;
}

/** Una línea de la línea de tiempo: un guardado que cambió campos, o una transición de estado. */
export interface EntradaDeLaLineaDeTiempo {
  readonly tipo: 'cambios' | 'estado';
  readonly fecha: string;
  readonly titulo: string;
  readonly actor: string | null;
  readonly actorRol: string | null;
  /** directo, propuesta, importacion, fusion, sistema o migracion; vacío en un estado. */
  readonly origen: string | null;
  readonly motivo: string | null;
  readonly estadoAnterior: string | null;
  readonly estadoNuevo: string | null;
  readonly cambios: readonly CambioDeCampo[];
}

/** La línea de tiempo de un registro, lo más reciente primero. */
export interface LineaDeTiempoDelRegistro {
  readonly moduloId: string;
  readonly registroId: string;
  /** El día desde el que existe el registro campo por campo (`aaaa-mm-dd`). Lo anterior no se reconstruye. */
  readonly inicioDelRegistro: string;
  /** Filas de datos personales que no se entregan porque la cuenta no tiene el módulo de Auditoría. */
  readonly camposOcultos: number;
  readonly entradas: readonly EntradaDeLaLineaDeTiempo[];
}

/** Lo que devuelve una lectura: la línea y si la consulta llegó a hacerse. */
export interface ResultadoDeCambios {
  readonly linea: LineaDeTiempoDelRegistro | null;
  /** `true` si el servidor no respondió. No es lo mismo que un registro sin cambios. */
  readonly fallo: boolean;
}

@Injectable({ providedIn: 'root' })
export class HistorialDeCambiosService {
  private readonly api = inject(ApiClientService);

  /**
   * La línea de tiempo desde la consola. Hace falta el módulo del registro; los datos personales
   * solo llegan con el módulo de Auditoría, y leerlos queda registrado.
   */
  leerDeLaConsola(moduloId: string, registroId: string | number): Promise<ResultadoDeCambios> {
    return this.leer(`/api/v1/admin/historial/${encodeURIComponent(moduloId)}/${encodeURIComponent(String(registroId))}`);
  }

  /** La línea de tiempo de un registro de la organización: solo cambios de datos públicos. */
  leerDeLaOrganizacion(
    organizacionId: string | number,
    moduloId: string,
    registroId: string | number,
  ): Promise<ResultadoDeCambios> {
    return this.leer(
      `/api/v1/externo/organizaciones/${encodeURIComponent(String(organizacionId))}`
      + `/historial/${encodeURIComponent(moduloId)}/${encodeURIComponent(String(registroId))}`,
    );
  }

  /**
   * <b>DISTINGUE «NO HAY» DE «NO SE PUDO LEER».</b> Un historial que no se puede leer no impide
   * trabajar —por eso no lanza—, pero tampoco puede hacerse pasar por un historial vacío.
   */
  private async leer(ruta: string): Promise<ResultadoDeCambios> {
    try {
      const linea = await firstValueFrom(this.api.get<LineaDeTiempoDelRegistro>(ruta, {}));
      return { linea: linea ?? null, fallo: false };
    } catch {
      return { linea: null, fallo: true };
    }
  }
}
