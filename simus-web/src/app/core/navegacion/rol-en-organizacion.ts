/**
 * El ROL de una persona en una organización, con la palabra que se le dice (ACC2).
 *
 * Una sola función para la cabecera, el menú de cuenta, el panel, «Mis organizaciones» y la pantalla
 * de entrada: antes cada una escribía la suya («Administración», «Edición», «Actuando como · edición»)
 * y no coincidían. Se dice «Administrador» y «Editor», sin «Actuando como».
 */
export function etiquetaDelRolEnOrganizacion(rol: string | null | undefined): string {
  return rol === 'administrador' ? 'Administrador' : 'Editor';
}
