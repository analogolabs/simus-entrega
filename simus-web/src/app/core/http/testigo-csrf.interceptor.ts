import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, of, switchMap } from 'rxjs';

/**
 * Adjunta el testigo antiforgery a toda escritura del API que no lo lleve ya (hallazgo S-06).
 *
 * <b>POR QUÉ UN INTERCEPTOR.</b> El API exige el testigo en TODA escritura con sesión
 * (`TestigoGlobalDeEscrituras`), no solo en las rutas que se acordaron de pedirlo. Las que ya lo
 * pedían lo adjuntan por su cuenta (`TestigoDeLaConsolaService` y compañía) y aquí se respetan: si la
 * petición ya trae `X-CSRF-TOKEN`, no se toca. Para todas las demás, este interceptor lo pide
 * (`GET /api/v1/csrf`, que sirve a la consola y al portal por igual) JUSTO antes de escribir y se lo pone.
 *
 * <b>LO QUE NO TOCA.</b> Lo que no es escritura del API (`POST`, `PUT`, `PATCH`, `DELETE` hacia
 * `/api/v1/`) y las escrituras anónimas (ingreso, alta, recuperación…), donde no hay sesión ni
 * testigo que pedir. Si el testigo no se puede obtener (sin sesión), la petición sale sin él y es el API
 * quien decide: nunca se inventa uno ni se bloquea la escritura desde aquí.
 */
const ESCRITURAS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Escrituras anónimas del API: no hay sesión, así que tampoco testigo. Espejo de la lista del API. */
const ANONIMAS = [
  /\/api\/v1\/(admin|externo)\/auth\/login\/?$/,
  /\/api\/v1\/externo\/auth\/(register|olvide-contrasena|confirmar-correo)\/?$/,
  /\/api\/v1\/externo\/auth\/restablecer-contrasena(\/comprobar)?\/?$/,
  /\/api\/v1\/externo\/(agendas-de-citas\/)?invitaciones\/consultar\/?$/,
  /\/api\/v1\/publico\//,
];

export const RUTA_DEL_TESTIGO = '/api/v1/csrf';

export const testigoCsrfInterceptor: HttpInterceptorFn = (req, next) => {
  const esDelApi = req.url.includes('/api/v1/');
  if (
    !esDelApi ||
    !ESCRITURAS.has(req.method) ||
    req.headers.has('X-CSRF-TOKEN') ||
    ANONIMAS.some(patron => patron.test(req.url))
  ) {
    return next(req);
  }

  const http = inject(HttpClient);
  const prefijo = req.url.slice(0, req.url.indexOf('/api/v1/'));
  return http.get<{ requestToken?: string }>(`${prefijo}${RUTA_DEL_TESTIGO}`).pipe(
    map(respuesta => respuesta.requestToken ?? ''),
    catchError(() => of('')),
    switchMap(testigo =>
      next(testigo ? req.clone({ setHeaders: { 'X-CSRF-TOKEN': testigo } }) : req)),
  );
};
