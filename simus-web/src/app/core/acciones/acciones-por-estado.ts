import { claveDeEstado } from '../vocabularios/estados';

/**
 * EL MODELO DE ACCIONES POR ESTADO.
 *
 * <b>Qué estaba roto.</b> Las acciones de un proceso estaban repartidas entre la ficha y la lista,
 * con nombres distintos («Editar Festival» frente a «Proponer cambios», «Solicitar eliminación»
 * frente a «Solicitar retiro»), y la ficha de un Festival publicado no ofrecía ninguna: la propuesta
 * de cambios se guardaba y no se podía enviar desde donde se había escrito. Cada pantalla decidía
 * por su cuenta qué botón pintar y cuál esconder, y lo que se escondía no explicaba por qué.
 *
 * <b>Qué hace.</b> Una sola función, pura, contesta a «¿qué se puede hacer con este proceso, y qué
 * no y por qué?». De ella salen, con los mismos verbos:
 * <list type="bullet">
 *   <item>la tarjeta de «siguiente acción» de la ficha (<see cref="siguienteAccion"/>);</item>
 *   <item>el menú «Acciones» de la lista (<see cref="comoAccionesDeMenu"/>);</item>
 *   <item>el texto del diálogo de confirmación de cada acción que lo pide.</item>
 * </list>
 *
 * <b>Una acción que se podría hacer y ahora no se puede se ofrece apagada y con su motivo</b>
 * («Enviar a revisión — falta el municipio», «Lo hace quien administra la organización»); nunca
 * desaparece sin explicación. Lo que no corresponde al estado (proponer cambios sobre un borrador)
 * simplemente no existe.
 *
 * <b>Es para Festival y Mercado.</b> Los dos recorren el mismo circuito (borrador, en revisión,
 * ajustes solicitados, publicado con propuesta de cambios, rechazado); las diferencias son de
 * datos, no de reglas, y se pasan en el contexto.
 */

/** Los procesos que comparten el circuito. */
export type TipoDeProceso = 'festival' | 'mercado';

/** Qué se puede hacer. El identificador es lo que emite la pantalla al elegirla. */
export type IdDeAccionDeProceso =
  | 'completar'
  | 'enviar'
  | 'reenviar'
  | 'atender-ajustes'
  | 'retirar-de-revision'
  | 'eliminar-borrador'
  | 'proponer-cambios'
  | 'continuar-propuesta'
  | 'enviar-propuesta'
  | 'editar-contacto'
  | 'ver-ediciones'
  | 'solicitar-retiro'
  | 'ver-historial';

/** Cómo se confirma una acción que no se deshace o que otra persona va a leer. */
export interface DescripcionDeConfirmacion {
  /** El verbo de lo que va a pasar: «Enviar a revisión», no «¿Estás seguro?». */
  titulo: string;
  /** La consecuencia, en prosa. */
  detalle: string;
  /** El texto del botón que confirma; repite el verbo. */
  accion: string;
  tono: 'destructiva' | 'confirmar' | 'principal';
  /** Si el motivo viaja al historial de otra persona, el diálogo lo pide y es obligatorio. */
  pideMotivo?: boolean;
  rotuloDelMotivo?: string;
}

export interface AccionDeProceso {
  id: IdDeAccionDeProceso;
  /** El verbo, igual en la tarjeta y en el menú. */
  etiqueta: string;
  /** `principal` es la que se espera; `peligro` es la que no se deshace y va al final del menú. */
  tono: 'principal' | 'normal' | 'peligro';
  habilitada: boolean;
  /** Por qué no se puede ahora. Presente solo si `habilitada` es falso. */
  motivo?: string;
  confirmacion?: DescripcionDeConfirmacion;
}

/** Lo que el modelo necesita saber del proceso. Los datos, no las reglas. */
export interface ContextoDeProceso {
  tipo: TipoDeProceso;
  nombre: string;
  /** El estado del registro, en cualquiera de sus grafías (`en_revision` o `EnRevision`). */
  estado: string | null | undefined;
  /** El estado de la propuesta de cambios sobre lo publicado, si la hay. */
  estadoPropuesta?: string | null;
  /** Hay una solicitud de retiro del Programa en trámite. */
  retiroSolicitado?: boolean;
  esAdministradora: boolean;
  /** Ajustes pedidos por el Programa que nadie ha atendido todavía. */
  ajustesPendientes?: number;
  /** Lo que impide enviar el registro, ya escrito en una frase: «el municipio y el correo». */
  faltaParaEnviar?: string;
  cuantasEdiciones?: number;
  /** Hay una petición en vuelo: las acciones esperan. */
  ocupado?: boolean;
}

/** El estado de la propuesta, normalizado: `null` si no hay ninguna. */
export type EstadoDeLaPropuesta = 'borrador' | 'en_revision' | 'ajustes_solicitados' | 'cerrada' | null;

const SOLO_ADMINISTRACION = 'Lo hace quien administra la organización. Tu rol es editor.';

/** Las palabras de cada acción: UNA vez, para la tarjeta, el menú y los diálogos. */
export const VERBOS_DE_PROCESO = {
  completar: 'Continuar registro',
  enviar: 'Enviar a revisión',
  reenviar: 'Volver a enviar a revisión',
  atenderAjustes: 'Atender ajustes',
  retirarDeRevision: 'Retirar de revisión',
  eliminarBorrador: 'Eliminar borrador',
  proponerCambios: 'Proponer cambios',
  continuarPropuesta: 'Continuar propuesta',
  enviarPropuesta: 'Enviar propuesta a revisión',
  editarContacto: 'Editar contacto',
  registrarEdicion: 'Registrar edición',
  solicitarRetiro: 'Solicitar retiro',
  verHistorial: 'Consultar historial',
} as const;

/** Normaliza el estado de una propuesta (`Rechazada`, `rechazada`, `aplicada`… → `cerrada`). */
export function estadoDeLaPropuesta(valor: string | null | undefined): EstadoDeLaPropuesta {
  switch (claveDeEstado(valor)) {
    case '': return null;
    case 'borrador': return 'borrador';
    case 'en_revision': return 'en_revision';
    case 'ajustes_solicitados': return 'ajustes_solicitados';
    default: return 'cerrada';
  }
}

function sustantivo(tipo: TipoDeProceso): string {
  return tipo === 'festival' ? 'Festival' : 'mercado';
}

function confirmacionDeEnvio(ctx: ContextoDeProceso, reenvio: boolean): DescripcionDeConfirmacion {
  return {
    titulo: reenvio ? 'Volver a enviar a revisión' : 'Enviar a revisión',
    detalle: `«${ctx.nombre}» quedará en revisión del equipo del PNMC y no podrás editarlo mientras decide. ` +
      'Lo decidido quedará en el historial.',
    accion: reenvio ? 'Volver a enviar' : 'Enviar a revisión',
    tono: 'confirmar',
  };
}

/**
 * Todas las acciones del proceso en este momento: las que se pueden hacer, y las que se podrían
 * hacer y hoy no, con su motivo. Ordenadas como se leen: la principal, las normales, las de peligro.
 */
export function accionesDeProceso(ctx: ContextoDeProceso): AccionDeProceso[] {
  const estado = claveDeEstado(ctx.estado);
  const propuesta = estadoDeLaPropuesta(ctx.estadoPropuesta);
  const pendientes = ctx.ajustesPendientes ?? 0;
  const cosa = sustantivo(ctx.tipo);
  const lista: AccionDeProceso[] = [];

  /** Una acción que depende de quien administra la organización. */
  const deAdministracion = (accion: AccionDeProceso, ...otrosMotivos: (string | null)[]): AccionDeProceso => {
    const motivo = !ctx.esAdministradora ? SOLO_ADMINISTRACION : otrosMotivos.find(m => !!m) ?? null;
    return motivo ? { ...accion, habilitada: false, motivo } : accion;
  };
  const habilitada = (id: IdDeAccionDeProceso, etiqueta: string, tono: AccionDeProceso['tono'],
    confirmacion?: DescripcionDeConfirmacion): AccionDeProceso => ({ id, etiqueta, tono, habilitada: true, confirmacion });

  const faltaTexto = ctx.faltaParaEnviar?.trim()
    ? `Para enviarlo falta ${ctx.faltaParaEnviar.trim()}.`
    : null;

  switch (estado) {
    case 'borrador': {
      const listo = !faltaTexto;
      lista.push(habilitada('completar', VERBOS_DE_PROCESO.completar, listo ? 'normal' : 'principal'));
      lista.push(deAdministracion(
        habilitada('enviar', VERBOS_DE_PROCESO.enviar, listo ? 'principal' : 'normal', confirmacionDeEnvio(ctx, false)),
        faltaTexto));
      lista.push(deAdministracion(habilitada('eliminar-borrador', VERBOS_DE_PROCESO.eliminarBorrador, 'peligro', {
        titulo: 'Eliminar el borrador',
        detalle: `«${ctx.nombre}» todavía no está publicado: se retira del panel y conserva su historial de auditoría.`,
        accion: 'Eliminar el borrador',
        tono: 'destructiva',
      })));
      break;
    }
    case 'ajustes_solicitados': {
      const restan = pendientes === 1 ? 'Queda 1 ajuste por atender.' : `Quedan ${pendientes} ajustes por atender.`;
      lista.push(habilitada('atender-ajustes', VERBOS_DE_PROCESO.atenderAjustes, pendientes > 0 ? 'principal' : 'normal'));
      lista.push(deAdministracion(
        habilitada('reenviar', VERBOS_DE_PROCESO.reenviar, pendientes > 0 ? 'normal' : 'principal', confirmacionDeEnvio(ctx, true)),
        pendientes > 0 ? restan : null, faltaTexto));
      lista.push(deAdministracion(habilitada('eliminar-borrador', VERBOS_DE_PROCESO.eliminarBorrador, 'peligro', {
        titulo: 'Eliminar el borrador',
        detalle: `«${ctx.nombre}» todavía no está publicado: se retira del panel y conserva su historial de auditoría.`,
        accion: 'Eliminar el borrador',
        tono: 'destructiva',
      })));
      break;
    }
    case 'en_revision': {
      lista.push({
        id: 'completar', etiqueta: VERBOS_DE_PROCESO.completar, tono: 'normal', habilitada: false,
        motivo: `El equipo del PNMC está revisando este ${cosa}. Podrás cambiarlo si te lo devuelve con observaciones.`,
      });
      lista.push(deAdministracion(habilitada('retirar-de-revision', VERBOS_DE_PROCESO.retirarDeRevision, 'peligro', {
        titulo: 'Retirar de revisión',
        detalle: `«${ctx.nombre}» dejará de estar disponible para la decisión institucional y volverá a borrador. ` +
          'Conserva su historial de auditoría.',
        accion: 'Retirar de revisión',
        tono: 'destructiva',
      })));
      break;
    }
    case 'publicado': {
      if (propuesta === 'borrador' || propuesta === 'ajustes_solicitados') {
        lista.push(deAdministracion(habilitada('continuar-propuesta', VERBOS_DE_PROCESO.continuarPropuesta, 'principal')));
        lista.push(deAdministracion(
          habilitada('enviar-propuesta', VERBOS_DE_PROCESO.enviarPropuesta, 'normal', {
            titulo: 'Enviar la propuesta a revisión',
            detalle: `Los cambios propuestos a «${ctx.nombre}» irán al equipo del PNMC. Lo publicado no cambia ` +
              'hasta que decida, y no podrás modificar la propuesta mientras tanto.',
            accion: 'Enviar la propuesta',
            tono: 'confirmar',
          }),
          propuesta === 'ajustes_solicitados' && pendientes > 0 ? 'Atiende primero los ajustes que pidió el PNMC.' : null));
      } else if (propuesta === 'en_revision') {
        lista.push({
          id: 'proponer-cambios', etiqueta: VERBOS_DE_PROCESO.proponerCambios, tono: 'principal', habilitada: false,
          motivo: 'Tu propuesta de cambios está en revisión. Podrás proponer otra cuando el PNMC decida.',
        });
      } else {
        lista.push(deAdministracion(habilitada('proponer-cambios', VERBOS_DE_PROCESO.proponerCambios, 'principal')));
      }
      // CORREGIR EL CONTACTO LO PUEDE QUIEN EDITA, no solo quien administra: el servidor lo permite
      // (`PuedeEditarOrganizacionAsync` en Festivales, `bastaConEditar` en Mercados) porque un correo
      // que rebota deja al proceso incontactable. Apagarlo para el rol editor era prometer un
      // permiso que la API no exige.
      lista.push(habilitada('editar-contacto', VERBOS_DE_PROCESO.editarContacto, 'normal'));
      lista.push(habilitada('ver-ediciones', (ctx.cuantasEdiciones ?? 0) > 0
        ? `Ver ediciones (${ctx.cuantasEdiciones})` : VERBOS_DE_PROCESO.registrarEdicion, 'normal'));
      const retiro = deAdministracion(habilitada('solicitar-retiro', VERBOS_DE_PROCESO.solicitarRetiro, 'peligro', {
        titulo: 'Solicitar el retiro',
        detalle: `«${ctx.nombre}» seguirá publicado hasta que el equipo del PNMC decida. Tu solicitud y su motivo ` +
          'quedan en el historial.',
        accion: 'Enviar la solicitud',
        tono: 'destructiva',
        pideMotivo: true,
        rotuloDelMotivo: 'Por qué debería retirarse',
      }));
      lista.push(ctx.retiroSolicitado
        ? { ...retiro, habilitada: false, motivo: 'Tu solicitud de retiro está en trámite. El PNMC responderá desde su bandeja.' }
        : retiro);
      break;
    }
    case 'rechazado':
      lista.push(habilitada('ver-historial', VERBOS_DE_PROCESO.verHistorial, 'principal'));
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

/** La tarjeta de «siguiente acción»: qué pasa, qué sigue y con qué botones. */
export interface SiguienteAccion {
  /** El tono visual de la tarjeta. */
  tono: 'neutro' | 'atencion' | 'exito' | 'rechazo';
  titulo: string;
  detalle: string;
  /** La primera es la principal. No incluye las de peligro: esas viven solo en el menú. */
  acciones: AccionDeProceso[];
}

/**
 * Qué le dice la ficha a quien la abre y con qué botones: la misma definición de acciones que el
 * menú de la lista, mirada desde el estado.
 */
export function siguienteAccion(ctx: ContextoDeProceso): SiguienteAccion {
  const estado = claveDeEstado(ctx.estado);
  const propuesta = estadoDeLaPropuesta(ctx.estadoPropuesta);
  const pendientes = ctx.ajustesPendientes ?? 0;
  const cosa = sustantivo(ctx.tipo);
  // LA PRINCIPAL VA PRIMERO en la tarjeta; el resto conserva el orden del modelo (el sort es estable).
  const acciones = accionesDeProceso(ctx)
    .filter(accion => accion.tono !== 'peligro')
    .sort((a, b) => Number(b.tono === 'principal') - Number(a.tono === 'principal'));
  const hayFalta = !!ctx.faltaParaEnviar?.trim();

  switch (estado) {
    case 'borrador':
      return {
        tono: 'neutro',
        titulo: hayFalta ? 'Completa el registro antes de enviarlo.' : 'El registro tiene lo necesario para enviarse a revisión.',
        detalle: hayFalta
          ? `Para enviarlo falta ${ctx.faltaParaEnviar!.trim()}.`
          : `Cuando lo envíes, el equipo del PNMC estudia el ${cosa} y responde con la decisión o con lo que haya que corregir.`,
        acciones,
      };
    case 'ajustes_solicitados':
      return pendientes > 0
        ? {
            tono: 'atencion',
            titulo: `Atiende ${pendientes} ${pendientes === 1 ? 'ajuste sugerido' : 'ajustes sugeridos'}.`,
            detalle: 'El PNMC pidió cambios. Corrígelos y vuelve a enviar el registro cuando estén todos atendidos.',
            acciones,
          }
        : {
            tono: 'exito',
            titulo: 'Los ajustes están resueltos.',
            detalle: 'Puedes volver a enviar el registro a revisión, o seguir ajustando otros datos antes.',
            acciones,
          };
    case 'en_revision':
      return {
        tono: 'neutro',
        titulo: 'La información está siendo revisada.',
        detalle: 'No necesitas hacer nada por ahora. La decisión quedará registrada en el historial.',
        acciones: [...acciones, { id: 'ver-historial', etiqueta: VERBOS_DE_PROCESO.verHistorial, tono: 'normal', habilitada: true }],
      };
    case 'publicado':
      if (propuesta === 'en_revision') {
        return {
          tono: 'neutro',
          titulo: 'Tu propuesta de cambios está en revisión.',
          detalle: `El PNMC la está mirando campo por campo. Lo publicado sigue como está y no se puede modificar la propuesta mientras tanto.`,
          acciones,
        };
      }
      if (propuesta === 'borrador' || propuesta === 'ajustes_solicitados') {
        return {
          tono: 'atencion',
          titulo: propuesta === 'ajustes_solicitados' ? 'El PNMC pidió ajustes en tu propuesta.' : 'Tienes una propuesta de cambios sin enviar.',
          detalle: 'Nadie del PNMC la ve hasta que la envíes. Lo publicado no cambia mientras tanto.',
          acciones,
        };
      }
      return {
        tono: 'exito',
        titulo: `El ${cosa} está publicado en el Ecosistema.`,
        detalle: 'Lo publicado no se edita directamente: los cambios se proponen y el PNMC los revisa. El contacto y las ediciones se gestionan aquí.',
        acciones,
      };
    case 'rechazado':
      return {
        tono: 'rechazo',
        titulo: ctx.tipo === 'festival' ? 'El registro no fue aprobado.' : 'El PNMC rechazó este mercado.',
        detalle: 'No se publicará ni puede reenviarse a revisión. Consulta la decisión en el historial.',
        acciones,
      };
    default:
      return { tono: 'neutro', titulo: '', detalle: '', acciones: [] };
  }
}

/** Una acción del modelo, en la forma que entiende el menú «…» compartido. */
export interface AccionDeMenu {
  id: string;
  etiqueta: string;
  tono?: 'principal' | 'normal' | 'peligro';
  deshabilitada?: boolean;
  motivo?: string;
}

/**
 * Las acciones del modelo para el menú de una fila de lista: las mismas, con los mismos verbos y el
 * mismo orden. Una apagada conserva su motivo, que el menú escribe debajo de la opción.
 */
export function comoAccionesDeMenu(acciones: readonly AccionDeProceso[]): AccionDeMenu[] {
  return acciones.map(accion => ({
    id: accion.id,
    etiqueta: accion.etiqueta,
    tono: accion.tono,
    deshabilitada: !accion.habilitada,
    motivo: accion.motivo,
  }));
}
