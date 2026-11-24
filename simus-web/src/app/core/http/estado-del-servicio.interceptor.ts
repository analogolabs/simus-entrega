import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { EstadoDelServicioService } from './estado-del-servicio.service';

/**
 * Lleva a la pantalla de mantenimiento cuando el API lo declara, o a «sin conexión» cuando no contesta.
 *
 * - **503 con `X-Mantenimiento: 1`** (lo pone el middleware de la API): modo mantenimiento. Un 503 sin la
 *   marca es un fallo cualquiera y NO se trata así. En la consola (`/administracion`) no se interrumpe:
 *   quien administra tiene sus rutas exentas.
 * - **Sin respuesta (0) o 502/504** en una ruta del API: se sondea `/health/live` y solo si tampoco
 *   contesta se declara «sin conexión con el servicio».
 */
export const estadoDelServicioInterceptor: HttpInterceptorFn = (req, next) => {
  const estado = inject(EstadoDelServicioService);
  const esDelApi = req.url.includes('/api/');

  return next(req).pipe(
    catchError((error: unknown) => {
      if (esDelApi && error instanceof HttpErrorResponse) {
        const enLaConsola = typeof location !== 'undefined' && location.pathname.startsWith('/administracion');
        if (error.status === 503 && error.headers.get('X-Mantenimiento') === '1') {
          if (!enLaConsola) estado.marcarMantenimiento(error.error as { mensaje?: string; hastaAprox?: string });
        } else if (error.status === 0 || error.status === 502 || error.status === 504) {
          void estado.sospecharCaida();
        }
      }
      return throwError(() => error);
    }),
  );
};
