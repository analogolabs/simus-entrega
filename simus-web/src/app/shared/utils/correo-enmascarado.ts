/**
 * El correo enmascarado para enseñarlo a quien quizá no es su dueño: «a•••o@dominio.org».
 *
 * <b>LA MISMA REGLA QUE `CorreoElectronico.Enmascarar` DEL SERVIDOR</b> —primera letra, tres puntos
 * y última letra de la parte local si tiene más de tres; el dominio entero—. La consulta anónima de
 * una invitación devuelve el correo así (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4), y la página enmascara la cuenta de
 * la sesión del mismo modo para saber, antes de pulsar nada, si es la invitada.
 */
export function enmascararCorreo(valor: string | null | undefined): string {
  const correo = (valor ?? '').trim().toLowerCase();
  if (!correo) { return ''; }
  const arroba = correo.lastIndexOf('@');
  if (arroba <= 0) { return '•••'; }
  const local = correo.slice(0, arroba);
  const dominio = correo.slice(arroba);
  const oculto = local.length > 3 ? `${local[0]}•••${local[local.length - 1]}` : `${local[0]}•••`;
  return oculto + dominio;
}
