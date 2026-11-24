/**
 * EL VOCABULARIO ÚNICO DE ESTADOS EDITORIALES.
 *
 * <b>Qué estaba roto.</b> Cada sección tenía su propia tabla de «código → palabra»: Agenda,
 * Noticias, Mercados, el historial de estados, la consola y el panel. Decían casi lo mismo, pero
 * cada una con los estados que se le ocurrieron a quien la escribió, y el mismo estado acababa
 * leyéndose distinto según la pantalla. Aquí vive la palabra de cada estado del circuito editorial,
 * una vez; las tablas de cada módulo se construyen eligiendo de esta.
 *
 * <b>Los seis del circuito</b>, en el orden en que un registro los recorre: Borrador, En revisión,
 * Ajustes solicitados, Publicado, Rechazado, Archivado. «Aprobado» es el paso intermedio que usan
 * los Festivales. Un estado que es de un solo módulo («Programada» en Noticias, los del Catálogo
 * Editorial) se añade en su tabla, no aquí.
 *
 * <b>Dos grafías.</b> La base usa `ajustes_solicitados`; el contrato externo de Festival,
 * `AjustesSolicitados`. `claveDeEstado` lleva las dos a la misma clave.
 */
export const ETIQUETAS_DE_ESTADO_EDITORIAL = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  ajustes_solicitados: 'Ajustes solicitados',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
  rechazado: 'Rechazado',
  archivado: 'Archivado',
} as const satisfies Record<string, string>;

export type EstadoEditorial = keyof typeof ETIQUETAS_DE_ESTADO_EDITORIAL;

/** «AjustesSolicitados», «ajustes-solicitados» o « en_revision » → «ajustes_solicitados». */
export function claveDeEstado(codigo: string | null | undefined): string {
  return (codigo ?? '')
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * EL MAPA ÚNICO DE RÓTULOS DE ESTADO PARA CUALQUIER PANTALLA (gestión externa, punto 34 del mapa de comentarios).
 *
 * Además del circuito editorial, los estados de las demás piezas que una pantalla puede mostrar (movimientos del
 * circuito, invitaciones, solicitudes, citas, etc.). Ninguna pantalla debe enseñar un código de base de datos
 * («enviado_a_revision»): si el estado no está aquí, `rotuloDeEstado` lo vuelve legible igualmente.
 */
export const ETIQUETAS_DE_ESTADO_GENERAL = {
  ...ETIQUETAS_DE_ESTADO_EDITORIAL,
  enviado_a_revision: 'Enviado a revisión',
  enviado: 'Enviado',
  recibido_para_revision: 'Recibido para revisión',
  pendiente_revision: 'Pendiente de revisión',
  pendiente: 'Pendiente',
  atendida: 'Atendida',
  atendido: 'Atendido',
  aceptada: 'Aceptada',
  aceptado: 'Aceptado',
  rechazada: 'Rechazada',
  aprobada: 'Aprobada',
  requiere_aclaracion: 'Requiere aclaración',
  en_proceso: 'En proceso',
  vencida: 'Vencida',
  vencido: 'Vencido',
  cancelada: 'Cancelada',
  cancelado: 'Cancelado',
  confirmada: 'Confirmada',
  confirmado: 'Confirmado',
  programada: 'Programada',
  activo: 'Activo',
  inactivo: 'Inactivo',
  validada: 'Validada',
  observada: 'Observada',
  retirado: 'Retirado',
} as const satisfies Record<string, string>;

/** Las palabras que necesitan tilde al volverse legibles; el resto se escribe tal cual. */
const PALABRAS_CON_TILDE: Readonly<Record<string, string>> = {
  revision: 'revisión', aclaracion: 'aclaración', decision: 'decisión', publicacion: 'publicación', edicion: 'edición',
  atencion: 'atención', invitacion: 'invitación', organizacion: 'organización', cancelacion: 'cancelación',
  verificacion: 'verificación', aprobacion: 'aprobación', habilitacion: 'habilitación',
};

/**
 * Cómo se lee un código que el mapa no conoce: «en_algo_raro» → «En algo raro», con las tildes de las palabras
 * frecuentes. Es la red de seguridad: un estado nuevo se ve legible aunque nadie lo haya dado de alta todavía.
 */
export function humanizarCodigoDeEstado(codigo: string | null | undefined): string {
  const palabras = claveDeEstado(codigo).split('_').filter(Boolean).map(p => PALABRAS_CON_TILDE[p] ?? p);
  if (!palabras.length) return '';
  const texto = palabras.join(' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * El rótulo legible de CUALQUIER estado, en cualquiera de sus grafías (`en_revision`, `EnRevision`,
 * `enviado_a_revision`). Nunca devuelve un código de base de datos.
 */
export function rotuloDeEstado(codigo: string | null | undefined): string {
  const clave = claveDeEstado(codigo);
  return (ETIQUETAS_DE_ESTADO_GENERAL as Record<string, string>)[clave] ?? humanizarCodigoDeEstado(codigo);
}

/**
 * La palabra de un estado del circuito editorial, en cualquiera de sus dos grafías.
 *
 * Un código que no es del circuito devuelve `respaldo` si se da; si no, se vuelve legible (`rotuloDeEstado`):
 * un código de base de datos nunca llega a la pantalla.
 */
export function etiquetaDeEstadoEditorial(codigo: string | null | undefined, respaldo?: string): string {
  const clave = claveDeEstado(codigo) as EstadoEditorial;
  return ETIQUETAS_DE_ESTADO_EDITORIAL[clave] ?? respaldo ?? rotuloDeEstado(codigo);
}

/** Una tabla de módulo con solo los estados que ese módulo admite, con la palabra común. */
export function etiquetasDeEstados<const C extends EstadoEditorial>(...codigos: C[]): Readonly<Record<C, string>> {
  const tabla = {} as Record<C, string>;
  for (const codigo of codigos) tabla[codigo] = ETIQUETAS_DE_ESTADO_EDITORIAL[codigo];
  return tabla;
}
