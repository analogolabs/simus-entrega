import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { ExternalSessionService } from '../services/external-session.service';

/**
 * Deniega el paso a las pantallas que solo existen con sesión externa abierta.
 *
 * <b>POR QUE ESTE GUARD PUEDE DENEGAR Y EL DE LA CONSOLA NO.</b> La consola institucional vive en
 * una sola ruta, `/admin`, y esa ruta ES su propia pantalla de acceso: sin sesión pinta el
 * formulario. Un guard que la denegara tendría que redirigir a `/admin`, es decir, a sí misma.
 * El panel externo es otra cosa: su puerta —`/ecosistema/ingresar`— es una pantalla DISTINTA, así
 * que aquí denegar sí tiene a dónde mandar a quien llega sin sesión.
 *
 * <b>Qué evita.</b> Sin esto, `/gestion` respondía a quien no ha entrado pintando el
 * formulario de acceso dentro del panel: la barra de direcciones decía «gestión» mientras la
 * pantalla pedía credenciales. Es el mismo defecto que se corrigió al entrar —una dirección que
 * no corresponde a lo que se ve— y se arrastraba por el otro extremo del recorrido.
 *
 * <b>Por qué consulta al servidor y no solo a la señal.</b> Al abrir un enlace guardado o al
 * recargar, la señal local nace vacía aunque la cookie siga siendo válida. Comprobar solo la señal
 * echaría fuera a quien sí tiene sesión, que es un fallo peor que el que se corrige.
 *
 * <b>El destino viaja en `?volver=`</b> y la pantalla de ingreso solo lo acepta si es una dirección
 * de `/gestion` (ver `destinoSeguroTrasEntrar`): no es una redirección abierta.
 */
export const sesionExternaGuard: CanActivateFn = (_ruta, estado) => {
  const sesionExterna = inject(ExternalSessionService);
  const router = inject(Router);

  if (sesionExterna.dentro()) {
    return true;
  }

  return sesionExterna.refrescar().pipe(
    // SE VUELVE A LA PÁGINA PEDIDA. Antes se perdía: tras ingresar siempre se
    // llegaba al Resumen y los enlaces de avisos, correos y marcadores no servían. La dirección
    // incluye la organización (`/gestion/o/{id}/…`), así que también se vuelve a ella.
    map(sesion => sesion !== null || router.createUrlTree(['/ingresar'], {
      queryParams: estado?.url && estado.url !== '/gestion' ? { volver: estado.url } : {},
    })),
  );
};
