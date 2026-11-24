import { Injectable, signal } from '@angular/core';
import type { ProcesoQueSeRetira } from '../services/eventos-que-se-archivan.service';

/** Lo que una pantalla le pide al diálogo común. Es lo mismo que describe `app-confirmacion`. */
export interface PeticionDeConfirmacion {
  /** El verbo de lo que va a pasar: «Enviar a revisión», no «¿Estás seguro?». */
  titulo: string;
  /** La consecuencia, en prosa. */
  detalle?: string;
  /** El texto del botón que confirma; repite el verbo. */
  accion?: string;
  cancelacion?: string;
  tono?: 'destructiva' | 'confirmar' | 'principal';
  pideMotivo?: boolean;
  rotuloDelMotivo?: string;
  ayudaDelMotivo?: string;
  motivoObligatorio?: boolean;
  /** Al retirar un proceso: el diálogo pregunta al servidor cuántos eventos de la Agenda se archivarán y lo dice. */
  eventosDelProceso?: ProcesoQueSeRetira;
}

/** Lo que devuelve: `null` si se canceló; si se confirmó, el motivo (cadena vacía si no se pedía). */
export type RespuestaDeConfirmacion = { motivo: string } | null;

interface Pendiente {
  peticion: PeticionDeConfirmacion;
  resolver: (respuesta: RespuestaDeConfirmacion) => void;
}

/**
 * EL DIÁLOGO DE CONFIRMACIÓN COMÚN.
 *
 * <b>Qué sustituye.</b> El `confirm()` del navegador de «Salir de la organización» y «Quitar del
 * equipo», las acciones que se ejecutaban sin preguntar («Publicar» una noticia, «Enviar a revisión»
 * una edición) y los diálogos que cada pantalla escribía a mano. Todos hablan ahora el lenguaje de
 * `app-confirmacion` —qué va a pasar, qué consecuencia tiene, por qué si viaja al historial de
 * otra persona—, que ya usaban los rechazos con motivo.
 *
 * <b>Cómo se usa.</b> `await confirmaciones.pedir({ titulo, detalle, accion })`. La pantalla no
 * lleva su `@if` ni su señal: el diálogo vive una sola vez, en la raíz de la aplicación
 * (`app-confirmacion-global`), y el servicio es el canal. Una petición nueva mientras hay otra
 * abierta cancela la anterior: dos diálogos a la vez no tienen sentido.
 *
 * <b>El motivo se pide en el mismo diálogo</b> (`pideMotivo`), no en un segundo `prompt` encadenado.
 */
@Injectable({ providedIn: 'root' })
export class ServicioDeConfirmacion {
  private readonly _pendiente = signal<Pendiente | null>(null);

  /** La petición abierta, o `null`. La lee el anfitrión que pinta el diálogo. */
  readonly peticion = () => this._pendiente()?.peticion ?? null;

  pedir(peticion: PeticionDeConfirmacion): Promise<RespuestaDeConfirmacion> {
    this._pendiente()?.resolver(null);
    return new Promise(resolver => this._pendiente.set({ peticion, resolver }));
  }

  /** La persona confirmó. Lo llama el anfitrión. */
  aceptar(motivo: string): void {
    const pendiente = this._pendiente();
    this._pendiente.set(null);
    pendiente?.resolver({ motivo });
  }

  /** La persona canceló o cerró con Escape. Lo llama el anfitrión. */
  cancelar(): void {
    const pendiente = this._pendiente();
    this._pendiente.set(null);
    pendiente?.resolver(null);
  }
}
