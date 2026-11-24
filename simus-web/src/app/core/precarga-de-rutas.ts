import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route, Routes } from '@angular/router';
import { Observable, EMPTY, timer, switchMap } from 'rxjs';

/** Los tramos de la aplicación que una persona del portal NO visita: no se descargan por adelantado. */
const SIN_PRECARGA: readonly string[] = ['gestion', 'desarrollo/componentes', 'mapa-ecosistemico', 'mapa-ecosistemico/sobre-el-mapa'];

/**
 * Marca una rama de rutas, y TODAS sus hijas, como «no precargar». El enrutador recorre los hijos de una
 * ruta aunque el padre no se cargue de forma perezosa, así que marcar solo `gestion` no frenaba a
 * `gestion/cuenta`, `gestion/o/:id/…` ni a nada de lo que cuelga de ella: la consola de administración
 * (1,1 MB) y el mapa (1,4 MB) se descargaban para cualquier visitante anónimo dos segundos después de
 * abrir el inicio (medido en la compilación de producción, 20 nov 2026).
 */
export function marcarSinPrecarga(rutas: Routes): Routes {
  for (const ruta of rutas) {
    ruta.data = { ...ruta.data, sinPrecarga: true };
    if (ruta.children) marcarSinPrecarga(ruta.children);
  }
  return rutas;
}

/**
 * Baja en segundo plano las pantallas del portal público, DESPUÉS de que la primera esté pintada
 * (decisión 117). Las 87 rutas son perezosas: sin esto, cada clic a Noticias, Agenda o una ficha
 * esperaba la descarga de su paquete antes de poder siquiera dibujar el esqueleto.
 *
 * <b>SE RESPETA EL AHORRO DE DATOS.</b> Con `saveData` o una conexión 2G no se precarga nada.
 * <b>NO SE PRECARGA LA CONSOLA, NI EL PANEL, NI EL MAPA</b> (`administracion`, `gestion`, `mapa-ecosistemico`): pesan más
 * de un megabyte cada uno y casi nadie del portal entra por ahí; quien lo hace paga la descarga al abrirlos.
 */
@Injectable({ providedIn: 'root' })
export class PrecargaDeRutasPublicas implements PreloadingStrategy {
  /** Cuánto se espera tras arrancar, para no competir con la primera pantalla. */
  static readonly ESPERA_MS = 2000;

  preload(ruta: Route, cargar: () => Observable<unknown>): Observable<unknown> {
    if (this.ahorraDatos() || (ruta.path !== undefined && SIN_PRECARGA.includes(ruta.path))) return EMPTY;
    if (ruta.data?.['sinPrecarga'] === true) return EMPTY;
    return timer(PrecargaDeRutasPublicas.ESPERA_MS).pipe(switchMap(() => cargar()));
  }

  private ahorraDatos(): boolean {
    const conexion = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return !!conexion && (conexion.saveData === true || /(^|-)2g$/.test(conexion.effectiveType ?? ''));
  }
}
