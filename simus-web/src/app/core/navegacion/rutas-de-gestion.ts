/**
 * Las direcciones del panel de organización y del espacio personal.
 *
 * <b>LA ORGANIZACIÓN ACTIVA VIVE EN LA URL, Y SOLO AHÍ.</b> Hasta era una señal en
 * memoria que elegía la primera organización al entrar: recargar, abrir un enlace en otra pestaña
 * o llegar desde un aviso devolvía a la primera, y cambiar el selector a mitad del asistente de
 * Festival guardaba lo escrito en la otra organización. Ahora todo el panel cuelga de
 * `/gestion/o/{organizacionId}/…` y cada enlace interno se construye con estas funciones.
 *
 * El espacio de la persona —sus datos, su perfil público, sus organizaciones— vive aparte, en
 * `/gestion/cuenta/…`, sin pestañas de organización.
 */

/** La raíz del panel de una organización: `/gestion/o/{id}`. */
export const RAIZ_DEL_PANEL = '/gestion/o';

/** La raíz del espacio personal de la cuenta. */
export const RAIZ_DE_LA_CUENTA = '/gestion/cuenta';

/**
 * LA PANTALLA DE ENTRADA, «¿Cómo quieres entrar?» (ACC2): adónde se va tras iniciar sesión
 * cuando no hay un destino pedido (`?volver=`, una invitación). Una cuenta sin organización pasa de
 * largo hacia su espacio personal; una con organizaciones elige entre «Mi espacio» y cada una.
 */
export const RUTA_DE_ENTRADA = '/gestion/entrada';

/** Las direcciones del espacio personal, para no escribirlas a mano en cada plantilla. */
export const RUTAS_DE_LA_CUENTA = {
  miEspacio: RAIZ_DE_LA_CUENTA,
  organizaciones: `${RAIZ_DE_LA_CUENTA}/organizaciones`,
  registrarOrganizacion: `${RAIZ_DE_LA_CUENTA}/organizaciones/registrar`,
  perfilPublico: `${RAIZ_DE_LA_CUENTA}/perfil-publico`,
  /** Datos personales: los privados de la cuenta (nombres, documento, teléfono). */
  datos: `${RAIZ_DE_LA_CUENTA}/datos`,
  /** Contraseña y seguridad: la contraseña y el cierre de sesión. */
  seguridad: `${RAIZ_DE_LA_CUENTA}/seguridad`,
  /** Mis autorizaciones: lo que la persona autorizó sobre sus datos y puede retirar. Es una pantalla aparte de la seguridad. */
  autorizaciones: `${RAIZ_DE_LA_CUENTA}/autorizaciones`,
  /** «Mi actividad y solicitudes»: lo que espera a la persona y lo que espera respuesta, de todos los tipos (SOL). */
  solicitudes: `${RAIZ_DE_LA_CUENTA}/solicitudes`,
  agendaDeCitas: `${RAIZ_DE_LA_CUENTA}/agenda-de-citas`,
  /** La lista única de los procesos que una persona registra con su cuenta (PANEL): pestañas por tipo. */
  procesos: `${RAIZ_DE_LA_CUENTA}/procesos`,
  /** Las fichas de los procesos que una persona registra con su cuenta, sin organización. */
  talleres: `${RAIZ_DE_LA_CUENTA}/talleres`,
  espacios: `${RAIZ_DE_LA_CUENTA}/espacios`,
  redes: `${RAIZ_DE_LA_CUENTA}/redes`,
  /** Los eventos de esos procesos, anunciados en la Agenda del Programa (LUT-01). */
  eventos: `${RAIZ_DE_LA_CUENTA}/eventos`,
  /** La herramienta de procesos históricos para quien aún no tiene organización. */
  procesosHistoricos: `${RAIZ_DE_LA_CUENTA}/herramientas/procesos-historicos`,
} as const;

/**
 * Las secciones del panel que existían antes con `/gestion/<seccion>` y que ahora piden
 * organización. Una dirección vieja con cualquiera de ellas se redirige a la misma sección de la
 * organización por omisión (marcadores, correos ya enviados, avisos guardados).
 */
export const SECCIONES_DEL_PANEL = [
  'resumen', 'procesos', 'eventos', 'herramientas', 'solicitudes', 'organizacion', 'archivos', 'equipo', 'responsable',
] as const;

/**
 * Los comandos de enrutador hacia una dirección del panel de una organización.
 *
 * Acepta segmentos con barras —`'procesos/festivales'`— para que las plantillas sigan leyéndose
 * como la dirección que construyen.
 */
export function rutaDelPanel(organizacionId: string, ...segmentos: readonly (string | number)[]): string[] {
  const resto = segmentos
    .flatMap(segmento => String(segmento).split('/'))
    .filter(segmento => segmento.length > 0);
  return [RAIZ_DEL_PANEL, organizacionId, ...resto];
}

/** El texto de la dirección, para `navigateByUrl` y para las pruebas. */
export function urlDelPanel(organizacionId: string, ...segmentos: readonly (string | number)[]): string {
  return rutaDelPanel(organizacionId, ...segmentos).join('/');
}

/**
 * El destino de `?volver=` tras ingresar, solo si es una dirección de Gestión de este sitio.
 *
 * <b>NO ES UNA REDIRECCIÓN ABIERTA.</b> Empieza por `/gestion`, no por `//` (que el navegador lee
 * como otro dominio) y no lleva barras invertidas ni espacios. Cualquier otra cosa se ignora.
 */
export function destinoSeguroTrasEntrar(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return /^\/gestion(?:[/?#][^\s\\]*)?$/.test(valor) && !valor.startsWith('//') ? valor : null;
}

/** La organización de una dirección del panel, o `null` si la dirección no es del panel. */
export function organizacionDeLaUrl(url: string): string | null {
  return /^\/gestion\/o\/([^/?#;]+)/.exec(url)?.[1] ?? null;
}

/**
 * La sección de una dirección del panel, sin la organización ni lo que es propio de ella.
 *
 * <b>AL CAMBIAR DE ORGANIZACIÓN SE CONSERVA LA SECCIÓN, NO EL REGISTRO.</b> El Festival 92 de una
 * organización no es de la otra, y el asistente a medias tampoco: desde una ficha o un asistente se
 * llega a la lista de esa clase de proceso de la otra organización.
 */
export function seccionDeLaUrl(url: string): string {
  const ruta = url.split(/[?#]/)[0];
  const coincidencia = /^\/gestion\/o\/[^/]+\/?(.*)$/.exec(ruta);
  const segmentos = (coincidencia?.[1] ?? '').split('/').filter(Boolean);
  if (segmentos[0] === 'procesos' && (segmentos[1] === 'festivales' || segmentos[1] === 'mercados' || segmentos[1] === 'luteria' || segmentos[1] === 'espacios' || segmentos[1] === 'redes')) {
    return `procesos/${segmentos[1]}`;
  }
  return segmentos[0] ?? 'resumen';
}
