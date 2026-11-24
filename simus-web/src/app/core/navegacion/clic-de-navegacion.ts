/**
 * ¿El clic es el de «ir a este enlace aquí»?
 *
 * Un enlace de la barra o de una tarjeta lleva un `href` real, para poder abrirlo en otra pestaña,
 * copiar su dirección y ver adónde lleva. El clic NORMAL se resuelve dentro de la aplicación con la
 * navegación de siempre —que además cierra los menús—; un clic con Ctrl, Cmd, Mayús o Alt, o con
 * otro botón (el central abre en pestaña nueva), es del navegador y NO se intercepta, o dejaría de
 * poder abrirse en otra pestaña.
 */
export function esClicDeNavegacion(evento: MouseEvent): boolean {
  return !evento.defaultPrevented
    && evento.button === 0
    && !evento.ctrlKey && !evento.metaKey && !evento.shiftKey && !evento.altKey;
}
