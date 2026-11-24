import { Injectable, Injector, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/** Cómo está el servicio (la API) desde el punto de vista de quien navega. */
export type EstadoDelServicio = 'normal' | 'mantenimiento' | 'sin-conexion';

/** Lo que el 503 de mantenimiento cuenta (ver `ModoMantenimientoMiddleware` en la API). */
export interface DatosDeMantenimiento {
  mensaje?: string | null;
  hastaAprox?: string | null;
}

export const RUTA_DE_MANTENIMIENTO = '/mantenimiento';

/**
 * Estado del servicio: «en mantenimiento» o «sin conexión con el servicio».
 *
 * Sin dependencias de HTTP a propósito (como `SesionExpiradaService`): el interceptor solo levanta la
 * bandera y esta pieza lleva a la persona a la pantalla de mantenimiento, que vive en una ruta perezosa
 * para no engordar el paquete inicial. El `Router` se pide en el momento (no en el constructor) para no
 * crear un ciclo con el interceptor.
 */
@Injectable({ providedIn: 'root' })
export class EstadoDelServicioService {
  private readonly injector = inject(Injector);
  private sondaEnCurso = false;

  readonly estado = signal<EstadoDelServicio>('normal');
  readonly datos = signal<DatosDeMantenimiento>({});
  /** Dónde estaba la persona, para devolverla ahí cuando el servicio vuelva. */
  readonly rutaDeRetorno = signal<string | null>(null);

  marcarMantenimiento(datos: DatosDeMantenimiento | null | undefined): void {
    this.datos.set({ mensaje: datos?.mensaje ?? null, hastaAprox: datos?.hastaAprox ?? null });
    this.fijar('mantenimiento');
  }

  /**
   * Una petición no obtuvo respuesta (o un proxy dijo 502/504). Antes de declarar caído el servicio se
   * sondea `/health/live`: un solo fallo suelto no debe tapar la pantalla en que alguien está trabajando.
   */
  async sospecharCaida(sonda: () => Promise<boolean> = sondearSalud): Promise<void> {
    if (this.estado() !== 'normal' || this.sondaEnCurso) return;
    this.sondaEnCurso = true;
    try {
      if (!(await sonda())) this.fijar('sin-conexion');
    } finally {
      this.sondaEnCurso = false;
    }
  }

  marcarSinConexion(): void {
    this.fijar('sin-conexion');
  }

  restablecer(): void {
    this.estado.set('normal');
    this.datos.set({});
    this.rutaDeRetorno.set(null);
  }

  private fijar(estado: EstadoDelServicio): void {
    this.estado.set(estado);
    const ruta = typeof location !== 'undefined' ? location.pathname + location.search : '/';
    if (ruta.startsWith(RUTA_DE_MANTENIMIENTO)) return;
    this.rutaDeRetorno.set(ruta);
    void this.injector.get(Router).navigateByUrl(RUTA_DE_MANTENIMIENTO);
  }
}

/** `true` si el servicio contesta. Cualquier respuesta que no sea 502/503/504 cuenta como «está». */
export async function sondearSalud(): Promise<boolean> {
  try {
    const respuesta = await fetch('/health/live', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    return ![502, 503, 504].includes(respuesta.status);
  } catch {
    return false;
  }
}
