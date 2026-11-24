import { claveDeEstado } from '../vocabularios/estados';
import { DescripcionDeConfirmacion } from './acciones-por-estado';

/**
 * LAS ACCIONES DE UN EVENTO DE LA ORGANIZACIÓN POR ESTADO.
 *
 * <b>El mismo criterio que el modelo de Festival y Mercado</b> (`acciones-por-estado.ts`): una sola
 * función, pura, contesta a «¿qué se puede hacer con este evento, y qué no y por qué?». Lo que se
 * podría hacer y ahora no se puede se ofrece apagado y con su motivo; lo que no corresponde al
 * estado no existe. Las palabras de cada acción viven aquí, una vez, para el botón de la fila y el
 * texto del diálogo de confirmación.
 *
 * <b>Un evento publicado se corrige, se cancela o se retira.</b> Corregirlo (erratas) es editarlo: el
 * servidor decide si lo que cambia es una errata o un cambio de fondo. Cancelarlo lo deja en la
 * agenda, marcado, con su motivo. Retirarlo lo saca de la agenda. Las dos acciones piden motivo en
 * el diálogo común, porque lo que se cancela o se retira ya lo vio el público.
 *
 * <b>«Cancelado» no es un estado del circuito.</b> El evento sigue «publicado» (lo aprobó el
 * Programa); la marca `cancelado` dice que no se realiza. Por eso el estado se pasa aparte.
 */
export type IdDeAccionDeEvento = 'editar' | 'enviar' | 'cancelar' | 'retirar';

export interface AccionDeEvento {
  id: IdDeAccionDeEvento;
  /** El verbo, igual en el botón y en el diálogo. */
  etiqueta: string;
  /** `peligro` es la que quita algo del público y no se deshace. */
  tono: 'principal' | 'normal' | 'peligro';
  habilitada: boolean;
  /** Por qué no se puede ahora. Presente solo si `habilitada` es falso. */
  motivo?: string;
  confirmacion?: DescripcionDeConfirmacion;
}

export interface ContextoDeEvento {
  titulo: string;
  /** El estado del circuito, en cualquiera de sus grafías. */
  estado: string | null | undefined;
  /** El evento publicado ya no se realiza. */
  cancelado?: boolean;
  esAdministradora: boolean;
  /** Hay una petición en vuelo: las acciones esperan. */
  ocupado?: boolean;
}

const SOLO_ADMINISTRACION = 'Lo hace quien administra la organización. Tu rol es editor.';

/** Las palabras de cada acción: UNA vez, para el botón y para el diálogo. */
export const VERBOS_DE_EVENTO = {
  editar: 'Editar',
  enviar: 'Enviar a revisión',
  cancelar: 'Cancelar evento',
  retirar: 'Retirar de la agenda',
} as const;

/** El tope del motivo, el mismo que valida el servidor. */
export const MAXIMO_DEL_MOTIVO_DE_EVENTO = 500;

export function accionesDeEvento(ctx: ContextoDeEvento): AccionDeEvento[] {
  const estado = claveDeEstado(ctx.estado);
  const lista: AccionDeEvento[] = [];

  const deAdministracion = (accion: AccionDeEvento): AccionDeEvento =>
    ctx.esAdministradora ? accion : { ...accion, habilitada: false, motivo: SOLO_ADMINISTRACION };
  const apagada = (accion: AccionDeEvento, motivo: string): AccionDeEvento => ({ ...accion, habilitada: false, motivo });

  const editar: AccionDeEvento = { id: 'editar', etiqueta: VERBOS_DE_EVENTO.editar, tono: 'normal', habilitada: true };

  switch (estado) {
    case 'borrador':
      lista.push(deAdministracion(editar));
      lista.push(deAdministracion({ id: 'enviar', etiqueta: VERBOS_DE_EVENTO.enviar, tono: 'principal', habilitada: true }));
      break;

    case 'en_revision':
      lista.push(deAdministracion(editar));
      break;

    case 'publicado': {
      lista.push(ctx.cancelado
        ? apagada(editar, 'Un evento cancelado ya no se edita.')
        : deAdministracion(editar));

      const cancelar: AccionDeEvento = {
        id: 'cancelar',
        etiqueta: VERBOS_DE_EVENTO.cancelar,
        tono: 'normal',
        habilitada: true,
        confirmacion: {
          titulo: VERBOS_DE_EVENTO.cancelar,
          detalle: `«${ctx.titulo}» seguirá en la agenda pública, marcado como cancelado y con el motivo que escribas. ` +
            'No se puede editar después, aunque sí retirar.',
          accion: 'Cancelar el evento',
          tono: 'destructiva',
          pideMotivo: true,
          rotuloDelMotivo: 'Por qué se cancela',
        },
      };
      lista.push(ctx.cancelado ? apagada(cancelar, 'Este evento ya está cancelado.') : deAdministracion(cancelar));

      lista.push(deAdministracion({
        id: 'retirar',
        etiqueta: VERBOS_DE_EVENTO.retirar,
        tono: 'peligro',
        habilitada: true,
        confirmacion: {
          titulo: VERBOS_DE_EVENTO.retirar,
          detalle: `«${ctx.titulo}» dejará de verse en la agenda pública y no se podrá volver a editar. ` +
            'El motivo queda en el historial.',
          accion: 'Retirar el evento',
          tono: 'destructiva',
          pideMotivo: true,
          rotuloDelMotivo: 'Por qué se retira',
        },
      }));
      break;
    }

    case 'rechazado':
    case 'archivado':
      lista.push(apagada(editar, 'Un evento archivado o rechazado ya no se edita.'));
      break;

    default:
      break;
  }

  if (ctx.ocupado) {
    return lista.map(accion => accion.habilitada
      ? { ...accion, habilitada: false, motivo: 'Hay una acción en curso. Espera a que termine.' }
      : accion);
  }
  return lista;
}
