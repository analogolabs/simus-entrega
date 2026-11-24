import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/**
 * La marca de ruta que pide reconstruir la pantalla cuando cambian sus parámetros.
 *
 * Se pone en `data` de la ruta `gestion/o/:organizacionId`.
 */
export const RECREAR_AL_CAMBIAR_PARAMETROS = 'recrearAlCambiarParametros';

/**
 * Reutiliza las pantallas como siempre, salvo las que piden reconstruirse al cambiar de parámetro.
 *
 * <b>POR QUÉ EXISTE.</b> El enrutador reutiliza un componente cuando la entrada de
 * ruta es la misma, aunque cambien sus parámetros. Para el panel eso significaba que pasar de
 * `/gestion/o/1/procesos/festivales/nuevo` a `/gestion/o/2/…` dejaba vivo el asistente con lo
 * escrito para la organización 1 y con su autoguardado apuntando a ella: exactamente el Festival
 * de «Caribe» guardado en «Pacífico» que encontró la auditoría. Reconstruir el armazón de la
 * organización —y con él todo lo que cuelga de él— garantiza que nada escrito en una organización
 * viaja a otra y que cada sección vuelve a pedir sus datos.
 */
@Injectable()
export class ReutilizacionDeRutas extends BaseRouteReuseStrategy {
  override shouldReuseRoute(futura: ActivatedRouteSnapshot, actual: ActivatedRouteSnapshot): boolean {
    if (futura.routeConfig !== actual.routeConfig) return false;
    if (!futura.routeConfig?.data?.[RECREAR_AL_CAMBIAR_PARAMETROS]) return true;
    const claves = new Set([...Object.keys(futura.params), ...Object.keys(actual.params)]);
    return [...claves].every(clave => futura.params[clave] === actual.params[clave]);
  }
}
