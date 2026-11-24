import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlMatchResult, UrlSegment } from '@angular/router';
import { ContextoDeOrganizacionService } from '../services/contexto-de-organizacion.service';
import { ExternalSessionService } from '../services/external-session.service';
import { RAIZ_DE_LA_CUENTA, RAIZ_DEL_PANEL, SECCIONES_DEL_PANEL } from '../navegacion/rutas-de-gestion';

/**
 * Empareja las direcciones del panel de antes de L2 —`/gestion/resumen`, `/gestion/procesos/…`—,
 * que no dicen de qué organización son.
 *
 * Se declara como hija de `gestion`, así que recibe los segmentos de después de `/gestion`.
 */
export function emparejaSeccionSinOrganizacion(segmentos: UrlSegment[]): UrlMatchResult | null {
  if (!segmentos.length) return null;
  return (SECCIONES_DEL_PANEL as readonly string[]).includes(segmentos[0].path) ? { consumed: segmentos } : null;
}

/**
 * Lleva una dirección del panel sin organización a la misma sección de la organización por
 * omisión: la última que la persona abrió, si sigue siendo suya, o la primera.
 *
 * <b>CONSERVA LA SECCIÓN, LOS PARÁMETROS Y EL FRAGMENTO.</b> Un marcador a
 * `/gestion/procesos/festivales/92?seccion=informacion` sigue abriendo esa ficha; si el Festival
 * es de otra organización de la cuenta, la ficha cambia a ella (ver `FichaDeFestivalPageComponent`).
 *
 * <b>Sin organización</b> se va al espacio personal, que es donde una cuenta individual tiene su
 * sitio, en lugar de a una pantalla de bloqueo.
 *
 * Corre después de `sesionExternaGuard` —las guardas de cada nivel se evalúan de arriba abajo—, así
 * que la sesión ya está cargada.
 */
export const haciaLaOrganizacionPorDefecto: CanActivateFn = (_ruta, estado) => {
  const router = inject(Router);
  const contexto = inject(ContextoDeOrganizacionService);
  const arbol = router.parseUrl(estado.url);
  const segmentos = (arbol.root.children['primary']?.segments ?? []).map(segmento => segmento.path);
  // Fuera `gestion`: lo que queda es la sección pedida.
  const seccion = segmentos.slice(1);

  // «PEDIR LA ADMINISTRACIÓN» DE UN PROCESO HISTÓRICO (decisión 90, docs/referencia/20-decisiones-y-flujos-por-modulo.md): NUNCA UNA ORGANIZACIÓN POR
  // OMISIÓN. La solicitud se hace a nombre de una organización, y mandarla con la «última abierta» o la
  // primera puede dejarla a nombre de la equivocada, el mismo riesgo del. Con una sola
  // organización se usa esa; con varias (o ninguna) se pasa por la elección, en el espacio de la persona.
  // También los enlaces de antes (`/gestion/procesos/festivales?reclamar=…`, de correos y avisos guardados),
  // que no dicen de qué organización son.
  // La herramienta se llamó «festivales-historicos» hasta la decisión 129: la ruta de antes sigue valiendo.
  const esHerramientaDeProcesos = seccion[0] === 'herramientas' && (seccion[1] === 'procesos-historicos' || seccion[1] === 'festivales-historicos');
  const esReclamar = arbol.queryParams['reclamar'] !== undefined
    && (esHerramientaDeProcesos || (seccion[0] === 'procesos' && seccion[1] === 'festivales'));
  if (esReclamar) {
    const organizaciones = inject(ExternalSessionService).organizaciones();
    if (organizaciones.length === 1) {
      return router.createUrlTree([RAIZ_DEL_PANEL, organizaciones[0].id, 'herramientas', 'procesos-historicos'], { queryParams: arbol.queryParams });
    }
    return router.createUrlTree([RAIZ_DE_LA_CUENTA, 'herramientas', 'procesos-historicos'], { queryParams: arbol.queryParams });
  }

  const destino = contexto.porDefecto();
  if (!destino) {
    // «PEDIR LA ADMINISTRACIÓN» DE UN PROCESO HISTÓRICO SIN ORGANIZACIÓN: la herramienta de la persona
    // explica qué falta (registrar una organización o unirse a una) en lugar de aterrizar en «Mi
    // espacio» sin contexto (D3-10).
    if (esHerramientaDeProcesos) {
      return router.createUrlTree([RAIZ_DE_LA_CUENTA, 'herramientas', 'procesos-historicos'], { queryParams: arbol.queryParams });
    }
    return router.createUrlTree([RAIZ_DE_LA_CUENTA], { queryParams: arbol.queryParams });
  }
  // /gestion/responsable REPETÍA el bloque de «Datos de la organización».
  if (seccion[0] === 'responsable') {
    return router.createUrlTree([RAIZ_DEL_PANEL, destino.id, 'organizacion'], { queryParams: arbol.queryParams, fragment: 'responsable' });
  }
  return router.createUrlTree([RAIZ_DEL_PANEL, destino.id, ...(seccion.length ? seccion : ['resumen'])], {
    queryParams: arbol.queryParams,
    fragment: arbol.fragment ?? undefined,
  });
};
