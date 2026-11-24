import { Injectable, inject, signal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ExternalSessionService } from '../services/external-session.service';
import { organizacionDeLaUrl } from './rutas-de-gestion';

/**
 * Lo que implementa una pantalla del panel que puede tener trabajo a medias.
 *
 * <b>LO ESCRITO NUNCA VIAJA A LA OTRA ORGANIZACIÓN.</b> Al cambiar de organización el armazón se
 * reconstruye (`ReutilizacionDeRutas`) y el asistente empieza de nuevo en la otra; esto solo decide
 * si antes hay que preguntar y qué decir de lo que se queda atrás.
 */
export interface ConCambiosSinGuardar {
  /**
   * El aviso para quien cambia de organización con trabajo a medias, o `null` si no hay nada que
   * perder. Recibe los nombres de la organización actual y de la nueva.
   */
  avisoAlCambiarDeOrganizacion?(actual: string, nueva: string): string | null;
  /** Lo que se hace si la persona confirma, antes de salir: por ejemplo, guardar el borrador. */
  antesDeCambiarDeOrganizacion?(): Promise<void>;
  /**
   * El aviso para quien SALE de la pantalla (a otra sección de la misma organización) con cambios
   * sin guardar, o `null` si no hay nada que perder. Si un autoguardado respalda lo
   * escrito, el aviso lo dice y no asusta; si no, avisa de que se perderá.
   */
  avisoAlSalir?(): string | null;
  /** Lo que se hace si la persona confirma la salida, antes de irse: por ejemplo, mandar el borrador. */
  antesDeSalir?(): Promise<void>;
}

/** La pregunta abierta, con los nombres para los botones. */
export interface PreguntaDeCambioDeOrganizacion {
  mensaje: string;
  organizacionActual: string;
  organizacionNueva: string;
  /**
   * Para la salida con cambios sin guardar, que reutiliza este mismo diálogo: el título y los
   * dos botones propios. Sin ellos, el diálogo habla de cambiar de organización.
   */
  salida?: { titulo: string; seguir: string; confirmar: string };
}

/**
 * La confirmación de cambio de organización, compartida entre la guarda que pregunta y el armazón
 * del panel que dibuja el diálogo.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmacionDeCambioDeOrganizacion {
  readonly pendiente = signal<PreguntaDeCambioDeOrganizacion | null>(null);
  private resolver: ((respuesta: boolean) => void) | null = null;

  preguntar(pregunta: PreguntaDeCambioDeOrganizacion): Promise<boolean> {
    // Una pregunta anterior sin responder se da por rechazada: solo hay un diálogo a la vez.
    this.resolver?.(false);
    this.pendiente.set(pregunta);
    return new Promise<boolean>(resolver => { this.resolver = resolver; });
  }

  responder(respuesta: boolean): void {
    const resolver = this.resolver;
    this.resolver = null;
    this.pendiente.set(null);
    resolver?.(respuesta);
  }
}

/**
 * Pregunta antes de salir de un asistente o formulario con cambios hacia OTRA organización.
 *
 * Solo actúa cuando la organización de la dirección cambia: navegar dentro de la misma
 * organización sigue como estaba (lo que pasa al salir de un asistente sin guardar es).
 */
async function preguntarCambioDeOrganizacion(
  componente: ConCambiosSinGuardar, actual: string, siguiente: string,
): Promise<boolean> {
  if (typeof componente?.avisoAlCambiarDeOrganizacion !== 'function') return true;

  const organizaciones = inject(ExternalSessionService).organizaciones();
  const nombreDe = (id: string) => organizaciones.find(organizacion => organizacion.id === id)?.name ?? 'la otra organización';
  const organizacionActual = nombreDe(actual);
  const organizacionNueva = nombreDe(siguiente);
  const mensaje = componente.avisoAlCambiarDeOrganizacion(organizacionActual, organizacionNueva);
  if (!mensaje) return true;

  const confirmacion = inject(ConfirmacionDeCambioDeOrganizacion);
  const acepta = await confirmacion.preguntar({ mensaje, organizacionActual, organizacionNueva });
  if (!acepta) return false;
  await componente.antesDeCambiarDeOrganizacion?.();
  return true;
}

export const confirmarCambioDeOrganizacion: CanDeactivateFn<ConCambiosSinGuardar> = async (
  componente, _ruta, estadoActual, estadoSiguiente,
) => {
  const actual = organizacionDeLaUrl(estadoActual.url);
  const siguiente = organizacionDeLaUrl(estadoSiguiente?.url ?? '');
  if (!actual || !siguiente || actual === siguiente) return true;
  return preguntarCambioDeOrganizacion(componente, actual, siguiente);
};

/**
 * Pregunta antes de salir de un formulario o asistente con cambios sin guardar, sea
 * hacia otra organización o hacia otra sección de la misma. Reutiliza la confirmación del cambio de
 * organización de L2: es el mismo diálogo del armazón, con otras palabras.
 *
 * Solo pregunta si cambia la RUTA: navegar a la misma pantalla con otros parámetros (el paso del
 * asistente, un filtro) no es salir.
 */
export const confirmarSalida: CanDeactivateFn<ConCambiosSinGuardar> = async (
  componente, _ruta, estadoActual, estadoSiguiente,
) => {
  const actual = organizacionDeLaUrl(estadoActual.url);
  const siguiente = organizacionDeLaUrl(estadoSiguiente?.url ?? '');
  if (actual && siguiente && actual !== siguiente) return preguntarCambioDeOrganizacion(componente, actual, siguiente);
  const rutaDe = (url: string) => url.split(/[?#]/)[0];
  if (rutaDe(estadoActual.url) === rutaDe(estadoSiguiente?.url ?? '')) return true;
  if (typeof componente?.avisoAlSalir !== 'function') return true;

  const mensaje = componente.avisoAlSalir();
  if (!mensaje) return true;

  const confirmacion = inject(ConfirmacionDeCambioDeOrganizacion);
  const acepta = await confirmacion.preguntar({
    mensaje,
    organizacionActual: '',
    organizacionNueva: '',
    salida: { titulo: '¿Salir sin terminar?', seguir: 'Seguir aquí', confirmar: 'Salir' },
  });
  if (!acepta) return false;
  await componente.antesDeSalir?.();
  return true;
};
