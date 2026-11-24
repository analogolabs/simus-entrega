/**
 * El vocabulario de la revisión campo por campo, en un solo sitio.
 *
 * <b>POR QUÉ VIVE EN `core` Y NO EN UNA DE LAS DOS PANTALLAS.</b> Lo usan las dos puntas de la
 * misma conversación: el panel institucional, que escribe las notas, y el panel de la organización,
 * que las atiende. Puesto en cualquiera de los dos, el otro tendría que importar de un `features/`
 * ajeno, que es la dependencia que el proyecto evita desde que `seccion-organizacion` tuvo que
 * mudar `NIVELES_DE_COBERTURA` a `panel-organizacion.api.ts`.
 *
 * <b>LOS NOMBRES SON LOS DEL CABLE.</b> `SIMUS.Contracts/RevisionDeCamposContratos.cs`. Un campo
 * mal escrito aquí no falla al compilar: falla en pantalla como un hueco en blanco.
 */

/** Los tres estados de una revisión. Los mismos que `CK_RevisionesFestival_Estado`. */
export type EstadoDeLaRevision = 'borrador' | 'enviada' | 'cerrada';

/** Los dos estados de una nota. Los mismos que `CK_RevisionesFestivalObservaciones_Estado`. */
export type EstadoDeLaNota = 'pendiente' | 'atendida';

/**
 * Sobre qué se pide el cambio.
 *
 * `principal` es la ficha del registro y `subregistro` una de sus realizaciones. El contrato es el genérico de las
 * revisiones por campo (lo comparte Mercados con sus ediciones), pero un Festival ya no tiene realizaciones que abrir:
 * desde el PR-5b del retiro de `PerfilesPublicosFestival` toda nota de Festival es `principal` y la API rechaza la otra.
 *
 * <b>ANTES SE LLAMABAN `festival` Y `perfil_versionado`.</b> Se renombraron el 17 de septiembre de
 * 2026, al pasar las revisiones de Festival a las tablas genéricas: son los mismos dos conceptos que
 * ya usaba Mercados, y con dos nombres distintos hacía falta traducir en medio para que dos módulos
 * dijeran lo mismo.
 */
export type AmbitoDelCampo = 'principal' | 'subregistro';

/** Un cambio pedido sobre un campo, tal como viaja en las dos direcciones. */
export interface ObservacionDeCampo {
  /** Cero mientras la nota solo existe en la pantalla del funcionario. */
  id: number;
  ambito: AmbitoDelCampo;
  subregistroId: number | null;
  seccionId: string;
  campoId: string;
  campoEtiqueta: string;
  valorObservado: string | null;
  nota: string;
  estado: EstadoDeLaNota;
  fechaAtencion: string | null;
}

/** El borrador entero: la observación general, las dos puntas y las notas. */
export interface RevisionDeCampos {
  id: number;
  /** El módulo del registro: `festivales`, `mercados`… */
  moduloId: string;
  registroId: string;
  registroNombre: string;
  estado: EstadoDeLaRevision;
  observacionGeneral: string | null;
  /** Quién envía. */
  revisorNombre: string | null;
  /** Quién recibe. */
  destinatarioNombre: string | null;
  organizacionNombre: string | null;
  fechaActualizacion: string | null;
  fechaEnvio: string | null;
  observaciones: ObservacionDeCampo[];
}

export interface CambioEntreEnviosFestival {
  campoId: string;
  seccionId: string;
  campoEtiqueta: string;
  valorAnterior: string | null;
  valorRecibido: string | null;
  respondeAjusteSugerido: boolean;
}

export interface ComparacionEnviosFestival {
  numeroEnvio: number;
  fechaEnvio: string;
  numeroEnvioAnterior: number | null;
  fechaEnvioAnterior: string | null;
  esPrimerEnvio: boolean;
  comparacionParcial: boolean;
  totalCampos: number;
  camposModificados: number;
  ajustesSugeridosAtendidos: number;
  otrosCambios: number;
  cambios: CambioEntreEnviosFestival[];
}

/** El cuerpo del PUT y del POST. Reemplaza la lista entera: lo que no venga se borra. */
export interface GuardarRevisionSolicitud {
  observacionGeneral: string | null;
  observaciones: {
    ambito: AmbitoDelCampo;
    subregistroId: number | null;
    seccionId: string;
    campoId: string;
    campoEtiqueta: string;
    valorObservado: string | null;
    nota: string;
  }[];
}

/** La carcasa que devuelve el servidor cuando el registro todavía no tiene revisión abierta. */
export function revisionVacia(registroId: string, registroNombre = '', moduloId = 'festivales'): RevisionDeCampos {
  return {
    id: 0,
    moduloId,
    registroId,
    registroNombre,
    estado: 'borrador',
    observacionGeneral: null,
    revisorNombre: null,
    destinatarioNombre: null,
    organizacionNombre: null,
    fechaActualizacion: null,
    fechaEnvio: null,
    observaciones: [],
  };
}

/**
 * La llave con la que se busca la nota de un campo.
 *
 * <b>UNA NOTA DE FESTIVAL CUELGA SIEMPRE DE LA FICHA.</b> Hasta el PR-5b del retiro de `PerfilesPublicosFestival` los campos
 * `perfilPublico.<campo>` colgaban de una versión del perfil (ámbito `subregistro`) y la llave llevaba el perfil dentro;
 * ya no hay versión que abrir: todo identificador es `festival.<campo>`, ámbito `principal`, y la llave es el campo. Las
 * notas viejas se reescribieron en la base (V20261119_30).
 */
export function llaveDelCampo(campoId: string): string {
  return `festival||${campoId}`;
}
