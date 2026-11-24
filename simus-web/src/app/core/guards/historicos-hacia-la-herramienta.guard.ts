import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { organizacionDeLaUrl, rutaDelPanel } from '../navegacion/rutas-de-gestion';

/**
 * Los enlaces de antes a «reclamar un Festival histórico» llevan a la herramienta de procesos históricos.
 *
 * Reclamar vivía debajo de la lista de Festivales —`/procesos/festivales?reclamar=…&buscar=…` y el
 * fragmento `#historicos`— y ahora es una herramienta aparte: `/herramientas/procesos-historicos`
 * (decisión 74, docs/referencia/20-decisiones-y-flujos-por-modulo.md). Los correos ya enviados, los avisos guardados y la ficha pública de un
 * Festival siguen abriendo, y esta guarda los lleva al sitio nuevo conservando el Festival pedido.
 *
 * Solo actúa si la dirección trae `reclamar` o el fragmento `historicos`: la lista de Festivales
 * sigue abriendo con normalidad.
 */
export const historicosHaciaLaHerramienta: CanActivateFn = (_ruta, estado) => {
  const router = inject(Router);
  const arbol = router.parseUrl(estado.url);
  const piden = arbol.queryParams['reclamar'] !== undefined || arbol.fragment === 'historicos';
  const organizacionId = organizacionDeLaUrl(estado.url);
  if (!piden || !organizacionId) return true;
  const parametros: Record<string, string> = {};
  for (const clave of ['reclamar', 'buscar', 'tipo']) {
    const valor = arbol.queryParams[clave];
    if (typeof valor === 'string' && valor) parametros[clave] = valor;
  }
  return router.createUrlTree(rutaDelPanel(organizacionId, 'herramientas', 'procesos-historicos'), { queryParams: parametros });
};
