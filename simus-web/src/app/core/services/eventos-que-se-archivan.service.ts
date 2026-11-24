import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';

/** De qué proceso se pregunta y por qué ruta: la organización (sesión externa) o la consola. */
export interface ProcesoQueSeRetira {
  tipo: 'festival' | 'mercado' | 'taller' | 'espacio' | 'red';
  id: number | string;
  ambito: 'externo' | 'institucional';
}

export interface EventosQueSeArchivan {
  tipo: string;
  procesoId: number;
  total: number;
  publicados: number;
}

/**
 * Cuántos eventos de la Agenda se archivarán al retirar un proceso (docs/referencia/20-decisiones-y-flujos-por-modulo.md decisión 113).
 *
 * LO CALCULA EL SERVIDOR con la misma consulta que luego archiva, y lo pinta una sola pieza: el
 * diálogo común `app-confirmacion` (entrada `eventosDelProceso`). Ninguna pantalla escribe su propia
 * frase ni cuenta por su lado.
 */
@Injectable({ providedIn: 'root' })
export class EventosQueSeArchivanService {
  private readonly api = inject(ApiClientService);

  contar(proceso: ProcesoQueSeRetira): Observable<EventosQueSeArchivan> {
    return this.api.get<EventosQueSeArchivan>(
      `/api/v1/${proceso.ambito}/procesos/${proceso.tipo}/${proceso.id}/eventos-que-se-archivan`,
      { errorFallback: 'No fue posible comprobar los eventos de la Agenda.' },
    );
  }

  /** La frase que ve quien confirma. Una sola redacción para todos los procesos. */
  static frase(cuenta: EventosQueSeArchivan): string {
    if (cuenta.total === 0) return 'Este proceso no tiene eventos vivos en la Agenda.';
    const eventos = cuenta.total === 1 ? '1 evento de la Agenda' : `${cuenta.total} eventos de la Agenda`;
    const visibles = cuenta.publicados === 0
      ? 'ninguno está publicado todavía'
      : cuenta.publicados === 1 ? '1 está publicado' : `${cuenta.publicados} están publicados`;
    return `Se archivarán ${eventos} de este proceso (${visibles}). Dejan de verse y no se pueden editar; nada se borra.`;
  }
}
