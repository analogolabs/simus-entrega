import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { organizacionDeLaUrl, rutaDelPanel } from '../navegacion/rutas-de-gestion';

/**
 * Las listas por tipo de Talleres, Espacios y Redes del panel de la organización llevan a la lista única de procesos
 * (PROP, decisión 122; la lista única es la de LIS, decisión 110).
 *
 * Esas tres listas repetían, con otra cabecera, lo que la lista única ya muestra con todos los tipos y el tipo como
 * filtro. Los enlaces que ya existen —avisos guardados, correos, la miga de una ficha, marcadores— siguen abriendo:
 * esta guarda los lleva a `/gestion/o/{id}/procesos?tipo=…` con el tipo elegido, que viene en `data.tipo` de la ruta.
 * Las fichas (`…/procesos/luteria/{id}`) y el alta (`…/nuevo`) no pasan por aquí.
 */
export const listaPorTipoHaciaLaListaUnica: CanActivateFn = (ruta, estado) => {
  const router = inject(Router);
  const organizacionId = organizacionDeLaUrl(estado.url);
  const tipo = ruta.data['tipo'];
  if (!organizacionId || typeof tipo !== 'string') return true;
  return router.createUrlTree(rutaDelPanel(organizacionId, 'procesos'), { queryParams: { tipo } });
};
