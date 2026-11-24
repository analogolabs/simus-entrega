import { Injectable, signal } from '@angular/core';

/**
 * EL INTERRUPTOR DE ASISTENTE en el portal público.
 *
 * Es lo único de la consulta pública que vive en el paquete inicial, y es una señal: quien la pulsa (la burbuja flotante,
 * el enlace de la portada) solo la enciende; el panel, con todo su código, se carga
 * aparte (`import()` tras el primer pintado, en `PortalLayoutComponent`) y se abre cuando ya existe. Si la persona pulsa antes
 * de que el fragmento llegue, la señal queda encendida y el panel nace abierto.
 */
@Injectable({ providedIn: 'root' })
export class PreguntaPublicaService {
  /** ¿El panel está abierto (o pedido, a la espera de su código)? */
  readonly abierta = signal(false);
  /** Una pregunta que llega ya escrita (un ejemplo de la portada): el panel la consume al abrir. */
  readonly semilla = signal('');

  /** Abre el panel (el foco vuelve al control de origen al cerrar: lo hace `appDialogo`). `pregunta` llega ya escrita y se responde. */
  abrir(_evento?: Event, pregunta = ''): void {
    this.semilla.set(pregunta);
    this.abierta.set(true);
  }

  cerrar(): void {
    if (!this.abierta()) return;
    this.abierta.set(false);
  }
}
