import { Router } from '@angular/router';

/**
 * CÓMO SE RESERVA EL SITIO DE LA BARRA SUPERIOR FIJA (punto 31 del mapa de comentarios; ya había pasado dos veces).
 *
 * <b>Por omisión, el armazón del portal lo reserva</b> (`.reserva-de-barra` de `styles.css`, alto `--alto-barra-superior`):
 * una pantalla nueva no tiene que acordarse de nada y nunca queda bajo la barra. Solo se libran las pantallas que ya ponen
 * el alto por su cuenta —un encabezado fotográfico que llega hasta arriba o un margen propio—, para no duplicarlo:
 * <ul>
 *   <li>las que están en `PANTALLAS_CON_RESERVA_PROPIA` (la lista de lo que ya estaba resuelto a mano; sacar una de la lista
 *       y quitarle su margen es limpiar, no arreglar), y</li>
 *   <li>las rutas que declaran `data: BARRA_SUPERIOR_PROPIA` (lo nuevo que traiga su propio encabezado).</li>
 * </ul>
 * Lo comprueba `e2e/barra-superior-no-tapa-contenido.spec.ts`, que recorre todas las rutas de la gestión externa y del portal
 * a 1440 y 390 px. Las pantallas con armazón propio (Mi espacio, panel de una organización, consola) llevan su cabecera dentro
 * del flujo y no necesitan esta regla; `/gestion/entrada`, que lleva la barra pública, usa la clase directamente.
 */
export const CLAVE_BARRA_SUPERIOR = 'barraSuperior';

/** Para las rutas cuya pantalla ya deja sitio a la barra: `data: BARRA_SUPERIOR_PROPIA`. */
export const BARRA_SUPERIOR_PROPIA = { [CLAVE_BARRA_SUPERIOR]: 'propia' } as const;

/**
 * Las pantallas que YA dejaban sitio a la barra por su cuenta cuando se hizo la regla (medido a 1440 y a 390 px el
 * 22 de noviembre de 2026: su primer contenido empieza por debajo de la barra sin ayuda del armazón).
 */
export const PANTALLAS_CON_RESERVA_PROPIA: readonly RegExp[] = [
  /^\/$/,
  /^\/(pnmc|ejes|noticias|agenda|editorial|galeria|mapa-ecosistemico|politicas|estrategia)(\/|$)/,
  /^\/ecosistema$/,
  /^\/ecosistema\/(festivales|mercados-musicales|mercados|luteria|espacios|redes|territorios-sonoros|practicas-musicales|personas|organizaciones|invitacion|invitacion-agenda|restablecer-contrasena)(\/|$)/,
];

/** ¿La pantalla activa deja ella misma el sitio de la barra? Mira de la ruta más profunda hacia arriba. */
export function laPantallaReservaSuBarra(router: Router): boolean {
  let hoja = router.routerState.snapshot.root;
  const cadena = [hoja];
  while (hoja.firstChild) { hoja = hoja.firstChild; cadena.push(hoja); }
  for (let i = cadena.length - 1; i >= 0; i--) {
    const valor = cadena[i].data?.[CLAVE_BARRA_SUPERIOR];
    if (valor !== undefined) return valor === 'propia';
  }
  // La 404 (`**`) trae su propio margen.
  if (cadena.some(r => r.routeConfig?.path === '**')) return true;
  const ruta = router.url.split(/[?#]/)[0];
  return PANTALLAS_CON_RESERVA_PROPIA.some(patron => patron.test(ruta));
}
