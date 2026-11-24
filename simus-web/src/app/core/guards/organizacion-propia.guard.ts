import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ContextoDeOrganizacionService } from '../services/contexto-de-organizacion.service';
import { ExternalSessionService } from '../services/external-session.service';

/**
 * Guarda de `/gestion/o/:organizacionId`: la cuenta solo ve el panel de una
 * organización de la que es miembro.
 *
 * QUÉ HACE. Deja pasar siempre —el armazón del panel pinta «No formas parte de esta organización»
 * con las organizaciones de la cuenta y no abre ninguna sección ni pide ningún dato— pero, si la
 * organización de la URL no está entre las de la sesión, borra la «última organización» guardada si
 * era esa, para que la próxima entrada a `/gestion` no vuelva a ella. La seguridad de verdad está en
 * el servidor (404 uniforme, `PoliticaDeOrganizacionPropia`); esto evita el parpadeo y el rastro.
 */
export const organizacionPropiaGuard: CanActivateFn = ruta => {
  const sesion = inject(ExternalSessionService);
  const contexto = inject(ContextoDeOrganizacionService);
  const id = ruta.paramMap.get('organizacionId') ?? '';
  if (id && !sesion.organizaciones().some(organizacion => organizacion.id === id)) {
    contexto.olvidar(id);
  }
  return true;
};
