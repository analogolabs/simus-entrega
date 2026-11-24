import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiClientService } from '../http/api-client.service';
import { TestigoDeLaConsolaService } from './testigo-de-la-consola.service';
import { UbicacionDivipola } from '../territorio/ubicacion-divipola';
import { ProcedenciaDeRegistro } from './procedencia';
import { AutorizacionDeDatos, PoliticaPublica, PreparacionDeRegistro } from './politicas-de-datos';
import { EntradaDeHistorialDeEstados } from '../../shared/components/ui/historial-de-estados/historial-de-estados.component';

export type { UbicacionDivipola } from '../territorio/ubicacion-divipola';

/** Una fila de catalogo del Festival: practica musical o territorio sonoro. */

/** Los conteos que alimentan el panel de registros de la consola. */
export interface IndicadoresDeLaConsola {
  festivals: number;
  divipola: number;
  participation: number;
  users: number;
  statuses: number;
}

export interface CatalogoDeFestival {
  id: number;
  nombre: string;
}

/** Catálogos necesarios para registrar o editar una edición de Festival. */
export interface CatalogosDeFestival {
  practicasMusicales: CatalogoDeFestival[];
  territoriosSonoros: CatalogoDeFestival[];
  tipologias: CatalogoDeFestival[];
  expresionesArtisticas: CatalogoDeFestival[];
  fuentesFinanciacion: CatalogoDeFestival[];
  modalidadesParticipacion: CatalogoDeFestival[];
  naturalezasEntidad: CatalogoDeFestival[];
  tiposIngreso: CatalogoDeFestival[];
  tiposOrganizador: CatalogoDeFestival[];
  zonasUrbanoRural: CatalogoDeFestival[];
  titulacionesColectivas: CatalogoDeFestival[];
  regionesOcad: CatalogoDeFestival[];
  /**
   * A qué Región OCAD pertenece cada departamento. Treinta y dos filas.
   *
   * <b>VIAJA CON LOS CATÁLOGOS PARA QUE LA REGIÓN SE VEA AL ELEGIR EL DEPARTAMENTO.</b> La historia
   * de usuario la pide automática —«campo automático, lo definen los campos seleccionados en
   * Departamento y Municipio»— y de solo lectura; el servidor la deriva igual al leer la Edición,
   * pero eso solo se vería después de guardar. La fuente es `dbo.DepartamentosRegionOcad`, la
   * correspondencia del Sistema General de Regalías.
   */
  regionOcadPorDepartamento?: { codigoDepartamento: string; regionOcadId: number }[];
}

/** Una fila de la bandeja institucional, tal como la sirve `/institucional/festivales/en-revision`. */
export interface FestivalEnRevision {
  id: string;
  nombre: string;
  organizacionPrincipalNombre: string;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  codigoMunicipio: string | null;
  fechaEnvioRevision: string | null;
  numeroEnvio: number;
}
/** Un evento que una organización envió a la agenda y espera decisión del Programa. */
export interface EventoEnRevision {
  id: string;
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string | null;
  modalidad: string;
  lugar: string | null;
  url: string | null;
  nivelCobertura: string;
  festivalId: number | null;
  festivalNombre: string | null;
  organizacionNombre: string | null;
  fechaEnvio: string;
  loQueFaltaParaPublicar: string | null;
  /** El Mercado que lo enmarca, cuando no es un Festival. */
  mercadoId?: number | null;
  mercadoNombre?: string | null;
  /** `festival`, `mercado`, `taller`, `espacio` o `red` (LUT-01), y el nombre del proceso, sea del tipo que sea. */
  procesoTipo?: string | null;
  procesoNombre?: string | null;
  /** La persona que responde cuando el proceso es de una persona sin organización. */
  responsableNombre?: string | null;
}


/** Una linea del historial de revision, con la instantanea de lo que se llamaba entonces. */
export interface EntradaDeHistorialDeRevision {
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  accion: string | null;
  comentario: string | null;
  motivoRechazo: string | null;
  fecha: string;
  organizacionNombre: string | null;
  responsableNombre: string | null;
  actorNombre: string | null;
}

/** Procedencia histórica y trámites de administración realmente asociados al Festival. */
export interface ReferenciaHistoricaDeFestival {
  id: string;
  organizacionId: string;
  organizacionNombre: string;
  fechaRegistro: string;
}

export interface ReclamacionAdministracionDeFestival {
  id: string;
  dominio: string;
  registroCanonicoId: string;
  organizacionSolicitanteId: string;
  estado: string;
  justificacion: string;
  senalesJson: string;
  motivoDecision: string | null;
  fechaCreacion: string;
  fechaEnvio: string | null;
  fechaDecision: string | null;
  registroNombre: string | null;
  organizacionSolicitanteNombre: string | null;
  /** Los soportes que adjuntó la organización. */
  soportes?: SoporteDeReclamacion[] | null;
}

/**
 * Un soporte adjunto a una solicitud de administración.
 *
 * `url` es la lectura del Banco de archivos: la sirve a la organización dueña y a la consola.
 */
export interface SoporteDeReclamacion {
  archivoId: string;
  nombre: string;
  tipo: string;
  bytes: number | null;
  url: string;
  fecha: string;
}

/** Lo que la consola necesita para decidir una reclamación. */
export interface DetalleDeReclamacion {
  reclamacion: ReclamacionAdministracionDeFestival;
  festival: {
    id: string; nombre: string; descripcion: string | null; estado: string; nivelCobertura: string;
    nombreDepartamento: string | null; nombreMunicipio: string | null; periodicidad: string | null;
    sinOrganizacion: boolean; procedencia: string | null; aniosDeEdiciones: number[];
  };
  organizacion: {
    id: string; nombre: string; nombreDepartamentoSede: string | null; nombreMunicipioSede: string | null;
    estado: string; activa: boolean; fechaAlta: string; administradores: number; personaSolicitante: string | null;
  };
  comparacion: { campo: string; etiqueta: string; historico: string | null; propuesto: string | null }[];
  aclaraciones: { pregunta: string; fechaPregunta: string; respuesta: string | null; fechaRespuesta: string | null }[];
  relacionadas: {
    festivalId: string; nombreFestival: string; nombreMunicipio: string | null; relacion: string;
    reclamacionId: string | null; reclamacionEstado: string | null; organizacionNombre: string | null; razonDelParecido?: string | null;
  }[];
}

export interface RespuestaPaginada<T> {
  items: T[];
  limit: number;
  offset: number;
  total: number;
}

/** Solicitud de vinculación o retiro, espejo de `RecordLinkRequestDto`. */
export interface SolicitudDeVinculacion {
  id: string;
  moduleId: string;
  recordId: string;
  requestingUserId: string;
  entidadId: string | null;
  requestedScope: string;
  reason: string;
  evidenceText: string;
  status: string;
  reviewComment: string;
  createdAt: string;
  updatedAt: string;
  recordName: string | null;
  entidadNombre: string | null;
}

/** Posible duplicado, espejo de `RecordDuplicateCandidateDto`. */
export interface CandidatoDuplicado {
  id: string;
  moduleId: string;
  sourceRecordId: string;
  candidateRecordId: string;
  similarityLevel: string;
  similarityScore: number | null;
  evidenceJson: string;
  status: string;
  decision: string;
  decisionComment: string;
  createdAt: string;
  updatedAt: string;
}

/** Hallazgo de calidad, espejo de `RecordQualityFlagDto`. */
export interface AlertaDeCalidad {
  id: string;
  moduleId: string;
  recordId: string;
  flagType: string;
  severity: string;
  status: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
}

/** Todo lo que la organizacion diligencio, que es lo que hay que leer antes de decidir. */
export interface FichaDeFestivalEnRevision {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string;
  organizacionPrincipalId: string | null;
  organizacionPrincipalNombre: string | null;
  nivelCobertura: string;
  nivelCoberturaEtiqueta: string;
  codigoDepartamento: string | null;
  codigoMunicipio: string | null;
  departamentoNombre: string | null;
  municipioNombre: string | null;
  periodicidad: string | null;
  periodicidadDetalle: string | null;
  correoContacto: string | null;
  instagram: string | null;
  facebook: string | null;
  paginaWeb: string | null;
  otroEnlace: string | null;
  telefonoCelular: string | null;
  observacionesContacto: string | null;
  practicasMusicales: CatalogoDeFestival[];
  territoriosSonoros: CatalogoDeFestival[];
  ediciones: EdicionDeFestival[];
  procedencia: {
    referenciasHistoricas: ReferenciaHistoricaDeFestival[];
    reclamacionesAdministracion: ReclamacionAdministracionDeFestival[];
  };
  historial: EntradaDeHistorialDeRevision[];
}

/**
 * Una edición de un Festival, espejo de `EdicionFestivalDto`.
 *
 * NO ES LA FICHA PUBLICADA: la ficha es la cabecera del Festival (`dbo.Festivales`), que cambia por
 * propuesta aprobada; las ediciones viven en su propia tabla.
 */
export interface EdicionDeFestival {
  id: string;
  festivalId: string;
  anio: number | null;
  numeroEdicion: number | null;
  nombre: string | null;
  descripcion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  director: string | null;
  estadoVisibilidad: string;
  estadoVisibilidadEtiqueta: string;
  esEditable: boolean;
  estado: string;
  estadoEtiqueta: string;
  /**
   * Cuántas observaciones institucionales tiene, sin abrirla.
   *
   * DECIDE SI LA ACCION EXISTE. La lista ofrecía «Consultar observaciones» en todas las filas,
   * también en ediciones que nunca pasaron por revisión: pulsarlo abría un recuadro vacío.
   */
  cuantasObservaciones: number;
  /**
   * Esta edición se puede eliminar de verdad.
   *
   * <b>LO DECIDE EL SERVIDOR PORQUE EL CLIENTE NO PUEDE SABERLO.</b> La regla es «un borrador que
   * nunca llegó a publicarse y sin revisión registrada», y la mitad que no se ve es la primera: una
   * edición publicada y después despublicada vuelve a `borrador`, así que mirar `estadoVisibilidad`
   * diría que sí se puede, y el público ya la vio. «Llegó a publicarse alguna vez» solo lo contesta
   * el historial.
   */
  sePuedeEliminar?: boolean;
}

/** El cuerpo del alta y de la edición. El Festival lo dice la ruta, no el cuerpo. */
export interface EdicionDeFestivalSolicitud {
  anio: number | null;
  numeroEdicion?: number | null;
  nombre: string | null;
  descripcion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  director?: string | null;
  estado: string;
  tipologiaFestivalId?: number | null;
  otraTipologia?: string | null;
  fuenteFinanciacionPrimariaId?: number | null;
  otraFuenteFinanciacionPrimaria?: string | null;
  fuenteFinanciacionSecundariaId?: number | null;
  otraFuenteFinanciacionSecundaria?: string | null;
  usaEstampillaProcultura?: boolean | null;
  practicasMusicalesQueCongrega?: string | null;
  otraModalidadParticipacion?: string | null;
  otraExpresionArtistica?: string | null;
  practicasMusicalesIds?: number[];
  territoriosSonorosIds?: number[];
  expresionesArtisticasIds?: number[];
  modalidadesParticipacionIds?: number[];
  tiposIngresoIds?: number[];
  localizaciones?: LocalizacionEdicionSolicitud[];
  entidadesAliadas?: EntidadAliadaEdicionSolicitud[];
  materiales?: MaterialEdicionSolicitud[];
}

export interface LocalizacionEdicionSolicitud { codigoDepartamento: string; codigoMunicipio: string; zonaUrbanoRuralId: number | null; titulacionColectivaId: number | null; }
export interface EntidadAliadaEdicionSolicitud { nombre: string | null; correo: string | null; naturalezaEntidadId: number | null; entidadId: number | null; }
export interface MaterialEdicionSolicitud { url: string | null; descripcionArchivo: string | null; }
/**
 * Lo que el detalle devuelve de cada localización.
 *
 * <b>ES MÁS QUE LA SOLICITUD, y por eso es otro tipo.</b> La solicitud lleva lo que se escribe
 * —los códigos y los dos identificadores—; la lectura trae además los nombres y la <b>Región
 * OCAD</b>, que no se elige: la deriva el servidor del departamento, contra la tabla de
 * correspondencia del Sistema General de Regalías. La historia de usuario la pide automática y de
 * solo lectura.
 */
export interface LocalizacionDeLaEdicion extends LocalizacionEdicionSolicitud {
  id: string;
  nombreDepartamento: string | null;
  nombreMunicipio: string | null;
  zonaUrbanoRural: string | null;
  titulacionColectiva: string | null;
  regionOcadId: number | null;
  regionOcad: string | null;
}

export interface EdicionDeFestivalDetalle {
  edicion: EdicionDeFestival;
  /**
   * El mes o los meses en que ocurre, y cuántos días dura. Los dos los calcula el servidor.
   *
   * NO SE ESCRIBEN NI SE GUARDAN. La historia de usuario los marca obligatorios y autocalculados a
   * partir de las fechas; almacenarlos sería duplicar un dato que puede desincronizarse.
   */
  mesRealizacion: string | null;
  duracionDias: number | null;
  tipologiaFestivalId: number | null; otraTipologia: string | null;
  fuenteFinanciacionPrimariaId: number | null; otraFuenteFinanciacionPrimaria: string | null;
  fuenteFinanciacionSecundariaId: number | null; otraFuenteFinanciacionSecundaria: string | null;
  usaEstampillaProcultura: boolean | null; practicasMusicalesQueCongrega: string | null;
  otraModalidadParticipacion: string | null; otraExpresionArtistica: string | null;
  practicasMusicalesIds: number[]; territoriosSonorosIds: number[]; expresionesArtisticasIds: number[];
  modalidadesParticipacionIds: number[]; tiposIngresoIds: number[];
  localizaciones: LocalizacionDeLaEdicion[]; entidadesAliadas: EntidadAliadaEdicionSolicitud[]; materiales: MaterialEdicionSolicitud[];
}

/** Una fila del catálogo cerrado que impone `CK_EdicionesFestival_Estado`. */
export interface EstadoDeEdicion {
  codigo: string;
  nombre: string;
}

export interface ObservacionDeEdicion {
  id: number; seccionId: string; campoId: string; campoEtiqueta: string;
  valorObservado: string | null; nota: string; estado: string; fechaAtencion: string | null;
}
export interface AjustesDeEdicion {
  id: number; edicionId: string; estado: string; observacionGeneral: string | null;
  fechaEnvio: string | null; observaciones: ObservacionDeEdicion[];
}

export interface CoincidenciaFestivalHistorico {
  festivalId: string;
  nombreFestival: string;
  descripcion: string | null;
  codigoDepartamento: string | null;
  nombreDepartamento: string | null;
  codigoMunicipio: string | null;
  nombreMunicipio: string | null;
  organizadorHistorico: string | null;
  tipoCoincidencia: 'NominalExacta' | 'NominalYTerritorial' | 'EvidenciaHistoricaTerritorial';
  evidencias: string[];
}

export interface UsuarioAdministrativo extends Record<string, unknown> {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string | null;
  roles?: readonly string[] | null;
  /**
   * La cuenta todavía usa la contraseña que le puso quien la creó.
   *
   * <b>VIAJA EN EL LOGIN Y EN LA SONDA DE SESION</b> porque la consola tiene que saber, antes de
   * dibujar nada, si esta persona está en su primer ingreso. Preguntarlo aparte haría que la
   * pantalla parpadeara entre la consola y el formulario de bienvenida.
   */
  debeCambiarContrasena?: boolean;
  /** La persona ya dijo quién es: nombre y documento. */
  perfilCompletado?: boolean;
  primerNombre?: string | null;
  segundoNombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  identificacion?: string | null;
  tipoDocumento?: string | null;
  telefono?: string | null;
}

export interface RespuestaLoginAdministrativo {
  user: UsuarioAdministrativo;
}

export interface RespuestaSesionAdministrativa {
  user: UsuarioAdministrativo | null;
}

/** Quien hizo la actuación. Nulo solo si la fila de bitácora no guardó usuario. */
export interface AutorDeAuditoria {
  id: string;
  nombre: string;
  correo: string;
}

/** Una línea de la bitácora, ya legible: quién, qué hizo, y sobre qué registro con su nombre. */
export interface ActuacionDeAuditoria {
  id: string;
  fecha: string;
  /** El verbo tal como lo guarda la base —«iniciar_sesion»—. Es el que filtra. */
  accion: string;
  /** El mismo verbo en palabras —«Inició sesión»—. Es el que se enseña. */
  accionEtiqueta: string;
  grupo: string;
  grupoEtiqueta: string;
  tabla: string;
  registroId: string;
  nombreRegistro: string | null;
  autor: AutorDeAuditoria | null;
}

/** Lo ya decidido en la bandeja, de los últimos `dias` días. */
export interface ResueltasDeLaBandeja {
  dias: number;
  items: ActuacionDeAuditoria[];
}

/** Una actuación entera: la línea, y lo que la fila guardó de antes y de después, campo a campo. */
export interface DetalleDeAuditoria {
  actuacion: ActuacionDeAuditoria;
  valoresAnteriores: Record<string, string | null>;
  valoresNuevos: Record<string, string | null>;
}

/** Un módulo tal como lo informa el monitor: cuántos registros tiene y cómo se reparten por estado. */
export interface ModuloDelMonitor {
  id: string;
  label: string;
  area: string;
  total: number;
  statuses: { code: string; label: string; total: number }[];
}

/**
 * La lectura del monitor técnico: si la API y la base responden, cuánto hay y qué pasó últimamente.
 *
 * Viajaba como `any` y cada pantalla leía a ciegas lo que creía que traía. Es el contrato de
 * `GET /admin/data/monitor`, escrito una vez.
 */
export interface MonitorDelSistema {
  checkedAt: string;
  environment: string;
  api: { status: string; latencyMs: number; serverTimeUtc: string };
  database: { status: string; provider: string | null; canConnect: boolean };
  web: { status: string; note: string };
  totals: { records: number; modules: number; users: number; territories: number; entities: number };
  modules: ModuloDelMonitor[];
  statuses: { code: string; label: string }[];
  recentAudit: { id: number; table: string; recordId: string; action: string; createdAt: string }[];
}

export interface OrganizacionResponsable {
  nombre: string;
  correo: string | null;
  telefono: string | null;
  tipoDocumento: string | null;
  tieneDocumento: boolean;
  autorizacionDatos: boolean;
  desde: string | null;
  rolEntidad: string | null;
  origen: string;
}

export interface OrganizacionAdministrativa {
  id: string;
  nombre: string;
  nombreLegal: string | null;
  identificacion: string | null;
  correoContacto: string | null;
  telefono: string | null;
  estado: string;
  estadoEtiqueta: string;
  activa: boolean;
  esInstitucional: boolean;
  territorio: string;
  responsable: OrganizacionResponsable | null;
  /**
   * Cuántos procesos administra, y cuántos dependen de ella.
   *
   * UN NUMERO SUELTO NO DICE NADA: «3 procesos» puede ser tres borradores que nadie ha visto o
   * tres festivales publicados. `dependientes` es la cifra que importa al decidir si archivarla.
   */
  procesos: { festivales: number; publicados: number; enCurso: number; dependientes: number; total: number };
  /** De dónde vino: quién la incorporó al sistema, que no es quién responde por ella. */
  procedencia: ProcedenciaDeRegistro | null;
  /**
   * Si alguna de sus cuentas responsables ya comprobó que ese correo es suyo.
   *
   * ES LA MISMA PREGUNTA QUE HACE LA PUERTA del servidor. Sin este dato la consola ve una
   * organización «pendiente de confirmación» y no sabe si eso la está bloqueando de verdad ni qué
   * acción ofrecerle.
   */
  correoConfirmado: boolean;
  /**
   * Las direcciones de las cuentas con las que se entra.
   *
   * NO ES `correoContacto`: aquel es el que la organización declaró en su ficha y puede ser el de
   * la oficina. Estos son los que se confirman, y cuando hay más de uno hay que decir cuál.
   */
  correosDeCuenta: string[];
  fechaCreacion: string;
  fechaActualizacion: string | null;
  /**
   * Cuándo la consola la revisó; `null` mientras no se haya revisado.
   *
   * ES LO QUE LA VUELVE PÚBLICA: sin revisión no tiene ficha en el portal ni se enlaza desde
   * Festivales, Mercados o perfiles (docs/referencia/20-decisiones-y-flujos-por-modulo.md §20.1, decisión 11). Opcional porque una respuesta
   * anterior al cambio no lo trae.
   */
  fechaRevisionConsola?: string | null;
}

export interface RespuestaOrganizaciones {
  total: number;
  pagina: number;
  tamanoPagina: number;
  estados: { id: string; etiqueta: string; total: number }[];
  items: OrganizacionAdministrativa[];
  territorios: { codigo: string; etiqueta: string; total: number }[];
  orden: string;
  direccion: string;
}

export interface FichaOrganizacionAdministrativa {
  organizacion: OrganizacionAdministrativa;
  /** Los procesos que administra, con su estado y si el cierre los dejaría sin quién responda. */
  festivales: { id: string; nombre: string; estado: string; dejaHuerfano: boolean }[];
  solicitudes: {
    id: string;
    recordId: string;
    recordName: string | null;
    status: string;
  }[];
  reclamaciones: {
    id: string;
    registroCanonicoId: string;
    registroNombre: string | null;
    estado: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiClient = inject(ApiClientService);
  private readonly testigo = inject(TestigoDeLaConsolaService);

  // --- Autenticación ---

  iniciarSesionAdministrativa(payload: { email: string; password?: string }): Observable<RespuestaLoginAdministrativo> {
    return this.apiClient.post<RespuestaLoginAdministrativo>('/api/v1/admin/auth/login', payload, {
      errorFallback: 'No fue posible iniciar sesión',
    });
  }

  cargarSesionAdministrativa(): Observable<RespuestaSesionAdministrativa> {
    return this.apiClient.get<RespuestaSesionAdministrativa>('/api/v1/admin/auth/me', {
      errorFallback: 'No hay una sesión administrativa activa',
    });
  }

  cerrarSesionAdministrativa(): Observable<unknown> {
    return this.apiClient.post<unknown>('/api/v1/admin/auth/logout', {}, {
      errorFallback: 'No fue posible cerrar la sesión',
    });
  }

  // --- Usuarios Externos y Registro ---

  /**
   * Lo que manda el alta de una organización. Refleja `ExternalRegisterRequest` en
   * `simus-api/src/SIMUS.Contracts/ApiContracts.cs`. La sede es obligatoria y no declara alcance.
   */
  registrarCuentaExterna(payload: {
    /** «individual» crea solo la cuenta, sin organización. */
    registrationType?: 'individual' | 'organizacion';
    organizationName: string;
    organizationIdentificationNumber: string | null;
    headquartersDepartmentCode: string;
    headquartersMunicipalityCode: string;
    firstName: string;
    secondName: string | null;
    firstSurname: string;
    secondSurname: string | null;
    documentType: string;
    documentNumber: string;
    phone: string;
    email: string;
    password: string;
    /**
     * Las finalidades que la persona autoriza: `tratamiento`, `terminos` y, si lo quiere,
     * `boletin`. Eran dos booleanos fijos que nombraban dos documentos concretos; con eso, quien
     * quisiera registrarse sin recibir el boletín no tenía forma de decirlo, porque el boletín no
     * era una finalidad aparte (Ley 1581 art. 9: autorización para fines determinados).
     */
    politicasAceptadas: string[];
    /** Opcional, solo con «individual»: las categorías con las que quiere que la encuentren (DIR). */
    clasificacion?: { roles: string[]; servicios: string[]; instrumentos: string[]; codigosDeDepartamento: string[] } | null;
  }): Observable<any> {
    return this.apiClient.post<any>('/api/v1/externo/auth/register', payload, {
      errorFallback: 'No fue posible registrar el usuario externo',
    });
  }

  /**
   * Lo que hace falta saber ANTES de que exista la cuenta: los textos que hay que aceptar y si el
   * alta está disponible.
   *
   * <b>LOS TEXTOS VIAJAN ENTEROS, NO COMO ENLACE.</b> Es lo que la pantalla muestra y lo que el
   * servidor copiará dentro de cada autorización como prueba: si la pantalla llevara su propia
   * redacción, lo que la persona lee y lo que queda guardado serían dos cosas distintas que nadie
   * compara nunca.
   */
  cargarPreparacionDeRegistroExterno(): Observable<PreparacionDeRegistro> {
    return this.apiClient.get('/api/v1/externo/auth/register-preparation', {
      errorFallback: 'No fue posible preparar el registro',
    });
  }

  /** El texto vigente de una finalidad, para las páginas públicas de políticas. */
  cargarPolitica(clave: string): Observable<PoliticaPublica> {
    return this.apiClient.get(`/api/v1/publico/politicas/${clave}`, {
      errorFallback: 'No fue posible cargar el texto de la política',
    });
  }

  /** Todas las vigentes, para listarlas. */
  cargarPoliticas(): Observable<PoliticaPublica[]> {
    return this.apiClient.get('/api/v1/publico/politicas', {
      errorFallback: 'No fue posible cargar las políticas',
    });
  }

  /** Lo que la cuenta en sesión ha autorizado, incluido lo que retiró. */
  cargarMisAutorizaciones(): Observable<AutorizacionDeDatos[]> {
    return this.apiClient.get('/api/v1/externo/mis-autorizaciones', {
      errorFallback: 'No fue posible cargar tus autorizaciones',
    });
  }

  /**
   * Retira una autorización. Devuelve la lista ya actualizada.
   *
   * <b>PIDE EL TESTIGO ANTES, COMO TODA ESCRITURA DE LA SESION EXTERNA.</b> El endpoint valida
   * antiforgery —retirar una autorización es una escritura sobre datos de una persona y no puede
   * dispararse desde otro sitio—, y sin la cabecera devuelve 400. Es el mismo par de pasos que usan
   * `cambios-pedidos.api.ts` y el perfil de la organización; escribir el POST a secas fue
   * exactamente el fallo que el navegador enseñó y las pruebas de unidad no podían ver.
   */
  revocarAutorizacion(finalidad: string): Observable<AutorizacionDeDatos[]> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la solicitud',
    }).pipe(
      switchMap(testigo => this.apiClient.post<AutorizacionDeDatos[]>(
        `/api/v1/externo/mis-autorizaciones/${finalidad}/revocar`,
        {},
        {
          headers: { 'X-CSRF-TOKEN': testigo.requestToken },
          errorFallback: 'No fue posible retirar la autorización',
        },
      )),
    );
  }

  /**
   * Otorga una autorización voluntaria después del alta. Hoy solo el boletín. El servidor
   * copia dentro de la autorización el texto vigente, el mismo que la pantalla mostró antes del
   * botón. Devuelve la lista ya actualizada y pide el testigo antes, como `revocarAutorizacion`.
   */
  otorgarAutorizacion(finalidad: string): Observable<AutorizacionDeDatos[]> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la solicitud',
    }).pipe(
      switchMap(testigo => this.apiClient.post<AutorizacionDeDatos[]>(
        `/api/v1/externo/mis-autorizaciones/${finalidad}/otorgar`,
        {},
        {
          headers: { 'X-CSRF-TOKEN': testigo.requestToken },
          errorFallback: 'No fue posible otorgar la autorización',
        },
      )),
    );
  }

  iniciarSesionExterna(payload: { email: string; password: string }): Observable<any> {
    return this.apiClient.post<any>('/api/v1/externo/auth/login', payload, {
      errorFallback: 'No fue posible iniciar sesión',
    });
  }

  /**
   * La bitácora de auditoría, ya legible.
   *
   * PAGINADA Y FILTRADA EN EL SERVIDOR, no aquí. Traerse la bitácora entera para filtrarla en el
   * navegador funciona con 57 filas y deja de funcionar el día que sean 57 000; y el nombre del
   * autor y el del registro solo puede resolverlos quien tiene la base delante.
   */
  cargarAuditoria(opciones: { grupo?: string; accion?: string; vista?: 'actuaciones' | 'accesos'; registroId?: string; q?: string; desde?: string; orden?: string; direccion?: string; pagina?: number; tamano?: number } = {}): Observable<any> {
    const parametros = new URLSearchParams();
    if (opciones.grupo && opciones.grupo !== 'todos') parametros.set('grupo', opciones.grupo);
    if (opciones.accion) parametros.set('accion', opciones.accion);
    // ACTUACIONES O ACCESOS: sin `vista` el servidor devuelve toda la bitácora.
    if (opciones.vista) parametros.set('vista', opciones.vista);
    // QUIEN Y DESDE CUANDO. `q` busca a la persona —nombre o correo— o un identificador de
    // registro; `desde` acota el periodo. Los dos entraron.
    if (opciones.q) parametros.set('q', opciones.q);
    if (opciones.desde) parametros.set('desde', opciones.desde);
    if (opciones.registroId) parametros.set('registroId', opciones.registroId);
    // EL ORDEN LO RESUELVE EL SERVIDOR: la bitácora pagina de veinte en veinte sobre miles de
    // filas, así que ordenar la página cargada no reordena la bitácora.
    if (opciones.orden) parametros.set('orden', opciones.orden);
    if (opciones.direccion) parametros.set('direccion', opciones.direccion);
    if (opciones.pagina) parametros.set('pagina', String(opciones.pagina));
    if (opciones.tamano) parametros.set('tamano', String(opciones.tamano));
    const cadena = parametros.toString();

    return this.apiClient.get<any>('/api/v1/admin/auditoria/' + (cadena ? '?' + cadena : ''), {
      errorFallback: 'No fue posible leer la bitácora de auditoría',
    });
  }

  /**
   * Las organizaciones del ecosistema, con quién responde por cada una.
   *
   * La respuesta se construye desde `EntidadesResponsable`, no desde un administrador genérico:
   * quien responde por la organización es una relación distinta del usuario institucional que la
   * revisa. Esa distinción es necesaria por privacidad y por permisos.
   */
  cargarOrganizaciones(
    opciones: {
      estado?: string;
      q?: string;
      pagina?: number;
      tamano?: number;
      departamento?: string;
      orden?: string;
      direccion?: string;
    } = {},
  ): Observable<RespuestaOrganizaciones> {
    const parametros = new URLSearchParams();
    if (opciones.estado && opciones.estado !== 'todos') parametros.set('estado', opciones.estado);
    if (opciones.q) parametros.set('q', opciones.q);
    if (opciones.pagina) parametros.set('pagina', String(opciones.pagina));
    if (opciones.tamano) parametros.set('tamano', String(opciones.tamano));
    // «todos» no viaja: el servidor ya trata la ausencia del parametro como «sin filtro», y
    // mandarlo obligaria a que las dos partes se pusieran de acuerdo en la misma palabra.
    if (opciones.departamento && opciones.departamento !== 'todos') {
      parametros.set('departamento', opciones.departamento);
    }
    if (opciones.orden) parametros.set('orden', opciones.orden);
    if (opciones.direccion) parametros.set('direccion', opciones.direccion);
    const cadena = parametros.toString();

    return this.apiClient.get<RespuestaOrganizaciones>('/api/v1/admin/organizaciones/' + (cadena ? '?' + cadena : ''), {
      errorFallback: 'No fue posible leer las organizaciones',
    });
  }

  /** La ficha completa de una organización: procesos con nombre, solicitudes, reclamaciones e historial. */
  cargarFichaDeOrganizacion(id: string): Observable<FichaOrganizacionAdministrativa> {
    return this.apiClient.get<FichaOrganizacionAdministrativa>(`/api/v1/admin/organizaciones/${id}`, {
      errorFallback: 'No fue posible abrir la ficha de la organización',
    });
  }

  /**
   * La sesión externa, o `null` si no hay ninguna.
   *
   * PREGUNTA A `/externo/auth/estado` Y NO A `/externo/auth/me` (D-09): el segundo responde 401 a un visitante
   * anónimo y el navegador pinta cada 401 como un error rojo en la consola, en TODA página pública. El primero
   * contesta siempre 200 y dice si hay sesión.
   */
  cargarSesionExterna(): Observable<any> {
    return this.apiClient.get<{ autenticado: boolean; sesion: unknown }>('/api/v1/externo/auth/estado', {
      errorFallback: 'No fue posible consultar la sesión externa',
    }).pipe(map(estado => (estado?.autenticado ? estado.sesion : null)));
  }

  cerrarSesionExterna(): Observable<any> {
    return this.apiClient.post<any>('/api/v1/externo/auth/logout', {}, {
      errorFallback: 'No fue posible cerrar la sesión externa',
    });
  }

  crearOrganizacionExterna(payload: unknown): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el registro de organización',
    }).pipe(
      switchMap(token => this.apiClient.post<any>('/api/v1/externo/organizaciones/', payload, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible registrar la organización',
      }))
    );
  }

  /**
   * El catálogo territorial oficial, reutilizable antes y después de iniciar sesión.
   *
   * `/api/v1/publico/divipola` es el catálogo canónico anónimo. Entrega las ubicaciones completas
   * porque los formularios resuelven con él dos selectores dependientes. No hay una copia privada:
   * DIVIPOLA es nomenclatura geográfica pública, no información de la organización.
   */
  cargarDivipolaPublica(): Observable<UbicacionDivipola[]> {
    return this.apiClient.get<UbicacionDivipola[]>('/api/v1/publico/divipola', {
      errorFallback: 'No fue posible cargar los territorios disponibles',
    });
  }

  cargarOrganizacionesExternas(): Observable<any[]> {
    return this.apiClient.get<any[]>('/api/v1/externo/organizaciones/mis', {
      errorFallback: 'No fue posible consultar tus organizaciones',
    });
  }

  cargarCatalogosDeFestival(): Observable<CatalogosDeFestival> {
    return this.apiClient.get<CatalogosDeFestival>('/api/v1/externo/catalogos/festival', {
      errorFallback: 'No fue posible cargar los catálogos para el Festival',
    });
  }

  cargarCatalogosInstitucionalesDeFestival(): Observable<CatalogosDeFestival> {
    return this.apiClient.get<CatalogosDeFestival>('/api/v1/institucional/catalogos/festival', { errorFallback: 'No fue posible consultar los catálogos de Festival' });
  }

  cargarBorradoresDeFestival(organizacionId: number): Observable<any[]> {
    return this.apiClient.get<any[]>(`/api/v1/externo/organizaciones/${organizacionId}/festivales`, {
      errorFallback: 'No fue posible consultar los Festivales de la organización',
    });
  }

  cargarCoincidenciasHistoricas(organizacionId: number): Observable<CoincidenciaFestivalHistorico[]> {
    return this.apiClient.get<CoincidenciaFestivalHistorico[]>(`/api/v1/externo/organizaciones/${organizacionId}/festivales/coincidencias`, {
      errorFallback: 'No fue posible consultar los registros históricos relacionados con esta organización',
    });
  }

  crearBorradorDeFestival(organizacionId: number, payload: unknown): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el registro del Festival',
    }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/externo/organizaciones/${organizacionId}/festivales`, payload, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar el Festival como borrador',
      }))
    );
  }

  enviarFestivalARevision(festivalId: number): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el envío a revisión',
    }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/externo/festivales/${festivalId}/enviar-a-revision`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible enviar el Festival a revisión',
      }))
    );
  }

  /**
   * Las ediciones de un Festival: 2024, 2025, 2026, cada una con su nombre y sus fechas.
   *
   * NO SON LA FICHA PUBLICADA, que es la cabecera del Festival. El motivo completo está en
   * `simus-database/schema/V20260827_01__ediciones_festival.sql`.
   */
  cargarEdicionesDeFestival(festivalId: number): Observable<EdicionDeFestival[]> {
    return this.apiClient.get<EdicionDeFestival[]>(`/api/v1/externo/festivales/${festivalId}/ediciones`, {
      errorFallback: 'No fue posible consultar las ediciones del Festival',
    });
  }

  cargarEdicionDeFestival(edicionId: string): Observable<EdicionDeFestivalDetalle> {
    return this.apiClient.get<EdicionDeFestivalDetalle>(`/api/v1/externo/ediciones/${edicionId}`, {
      errorFallback: 'No fue posible consultar la ficha de la edición',
    });
  }

  cargarEstadosDeEdicion(): Observable<EstadoDeEdicion[]> {
    return this.apiClient.get<EstadoDeEdicion[]>('/api/v1/externo/catalogos/estados-edicion', {
      errorFallback: 'No fue posible consultar los estados de edición',
    });
  }

  crearEdicionDeFestival(festivalId: number, payload: EdicionDeFestivalSolicitud): Observable<EdicionDeFestival> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el guardado de la edición',
    }).pipe(
      switchMap(token => this.apiClient.post<EdicionDeFestival>(`/api/v1/externo/festivales/${festivalId}/ediciones`, payload, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar la edición',
      }))
    );
  }

  actualizarEdicionDeFestival(edicionId: string, payload: EdicionDeFestivalSolicitud): Observable<EdicionDeFestival> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el guardado de la edición',
    }).pipe(
      switchMap(token => this.apiClient.put<EdicionDeFestival>(`/api/v1/externo/ediciones/${edicionId}`, payload, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar la edición',
      }))
    );
  }

  eliminarEdicionDeFestival(edicionId: string): Observable<unknown> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el borrado de la edición',
    }).pipe(
      switchMap(token => this.apiClient.delete<unknown>(`/api/v1/externo/ediciones/${edicionId}`, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible borrar la edición',
      }))
    );
  }

  publicarEdicion(edicionId: string): Observable<EdicionDeFestival> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el envío de la edición',
    }).pipe(switchMap(token => this.apiClient.post<EdicionDeFestival>(
      `/api/v1/externo/ediciones/${edicionId}/publicar`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible publicar la edición',
      })));
  }

  /**
   * Retira una edición del portal sin cerrar su ciclo.
   *
   * DESPUBLICAR NO ES ARCHIVAR, igual que en Agenda, Noticias y Catálogo editorial: retirar del
   * portal algo que hay que seguir editando devuelve a borrador; archivar cierra el ciclo.
   */
  despublicarEdicion(edicionId: string): Observable<EdicionDeFestival> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el cambio',
    }).pipe(switchMap(token => this.apiClient.post<EdicionDeFestival>(
      `/api/v1/externo/ediciones/${edicionId}/despublicar`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible despublicar la edición',
      })));
  }

  archivarEdicion(edicionId: string): Observable<EdicionDeFestival> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el cambio',
    }).pipe(switchMap(token => this.apiClient.post<EdicionDeFestival>(
      `/api/v1/externo/ediciones/${edicionId}/archivar`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible archivar la edición',
      })));
  }

  cargarAjustesDeEdicion(edicionId: string): Observable<AjustesDeEdicion> {
    return this.apiClient.get<AjustesDeEdicion>(`/api/v1/externo/ediciones/${edicionId}/cambios-pedidos`, {
      errorFallback: 'No fue posible consultar los ajustes de la edición',
    });
  }

  atenderAjusteDeEdicion(observacionId: number, atendida: boolean): Observable<ObservacionDeEdicion> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la actualización del ajuste',
    }).pipe(switchMap(token => this.apiClient.post<ObservacionDeEdicion>(
      `/api/v1/externo/ediciones/cambios-pedidos/${observacionId}/atender`, { atendida }, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible actualizar el ajuste',
      })));
  }

  guardarFestivalExterno(festivalId: number, payload: unknown): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la actualización del Festival',
    }).pipe(
      switchMap(token => this.apiClient.put<any>(`/api/v1/externo/festivales/${festivalId}`, payload, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar los ajustes del Festival',
      }))
    );
  }

  iniciarPropuestaCambioFestival(festivalId: number): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la propuesta de cambios del Festival',
    }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/externo/festivales/${festivalId}/propuestas-cambio`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible crear la propuesta de cambios del Festival',
      }))
    );
  }

  actualizarPropuestaCambioFestival(festivalId: number, payload: unknown): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la actualización de la propuesta',
    }).pipe(
      switchMap(token => this.apiClient.put<any>(`/api/v1/externo/festivales/${festivalId}/propuesta-cambio`, payload, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible guardar la propuesta de cambios del Festival',
      }))
    );
  }

  enviarPropuestaCambioFestivalARevision(festivalId: number): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar el envío de la propuesta',
    }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/externo/festivales/${festivalId}/propuesta-cambio/enviar-a-revision`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible enviar la propuesta a revisión',
      }))
    );
  }

  cargarBandejaDeFestivales(): Observable<FestivalEnRevision[]> {
    return this.apiClient.get<FestivalEnRevision[]>('/api/v1/institucional/festivales/en-revision', {
      errorFallback: 'No fue posible consultar los Festivales en revisión',
    });
  }

  /**
   * Los eventos que esperan decisión del Programa.
   *
   * <b>NO ESTA DETRAS DEL MODULO «AGENDA», y es deliberado:</b> revisar lo que una organización
   * entrega es trabajo de «Solicitudes y revisiones», que toda cuenta de consola tiene. Es el mismo
   * criterio que la cola de ediciones de Festival.
   */
  cargarEventosEnRevision(): Observable<EventoEnRevision[]> {
    return this.apiClient.get<EventoEnRevision[]>('/api/v1/institucional/revision-de-eventos', {
      errorFallback: 'No fue posible consultar los eventos en revisión',
    });
  }

  /** El historial de estados de un evento en revisión: quién lo envió, quién lo devolvió y por qué. */
  cargarHistorialDeEvento(id: string): Observable<EntradaDeHistorialDeEstados[]> {
    return this.apiClient.get<EntradaDeHistorialDeEstados[]>(`/api/v1/institucional/revision-de-eventos/${id}/historial`, {
      errorFallback: 'No fue posible consultar el historial del evento',
    });
  }

  decidirSobreEvento(id: string, decision: 'publicar' | 'devolver', motivo?: string): Observable<{ id: string; estado: string }> {
    return this.apiClient.post<{ id: string; estado: string }>(
      `/api/v1/institucional/revision-de-eventos/${id}/decision`,
      { decision, motivo: motivo ?? null },
      { errorFallback: 'No fue posible registrar la decisión sobre el evento' },
    );
  }

  decidirRevisionDeEdicion(edicionId: number, payload: unknown): Observable<EdicionDeFestival> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/ediciones-festival/csrf', { errorFallback: 'No fue posible preparar la decisión institucional' }).pipe(
      switchMap(token => this.apiClient.post<EdicionDeFestival>(`/api/v1/institucional/ediciones-festival/${edicionId}/supervision`, payload, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible registrar la acción de supervisión' })));
  }

  cargarAjustesInstitucionalesDeEdicion(edicionId: string): Observable<AjustesDeEdicion> {
    return this.apiClient.get<AjustesDeEdicion>(`/api/v1/institucional/ediciones-festival/${edicionId}/revision`, { errorFallback: 'No fue posible abrir los ajustes de la edición' });
  }
  guardarAjustesInstitucionalesDeEdicion(edicionId: string, payload: unknown, enviar = false): Observable<AjustesDeEdicion> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/ediciones-festival/csrf', { errorFallback: 'No fue posible preparar los ajustes' }).pipe(switchMap(token => {
      const options = { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: enviar ? 'No fue posible enviar los ajustes' : 'No fue posible guardar el borrador' };
      return enviar ? this.apiClient.post<AjustesDeEdicion>(`/api/v1/institucional/ediciones-festival/${edicionId}/revision/enviar`, payload, options) : this.apiClient.put<AjustesDeEdicion>(`/api/v1/institucional/ediciones-festival/${edicionId}/revision`, payload, options);
    }));
  }

  /**
   * La ficha completa del Festival que se esta revisando.
   *
   * LA RUTA EXISTIA Y NO LA LLAMABA NADIE. Hasta ningun componente pedia
   * `GET /institucional/festivales/{id}`: la bandeja decidia sobre los cuatro campos de la lista
   * —nombre, organizacion, cobertura y fecha— sin poder ver la descripcion, los catalogos, el
   * territorio ni las ediciones que la organizacion habia diligenciado.
   */
  cargarFichaInstitucionalDeFestival(festivalId: number): Observable<FichaDeFestivalEnRevision> {
    return this.apiClient.get<FichaDeFestivalEnRevision>(`/api/v1/institucional/festivales/${festivalId}`, {
      errorFallback: 'No fue posible abrir la ficha del Festival',
    });
  }

  decidirRevisionDeFestival(festivalId: number, payload: unknown): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/festivales/csrf', {
      errorFallback: 'No fue posible preparar la decisión institucional',
    }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/institucional/festivales/${festivalId}/decisiones`, payload, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible registrar la decisión institucional',
      }))
    );
  }

  /**
   * ELIMINAR UN FESTIVAL PUBLICADO DEL ECOSISTEMA, DIRECTO. El criterio es este: hasta ahora solo existía el retiro que la propia organización solicitaba;
   * esto lo hace la administración sin esperar esa solicitud -piénsese en un Festival duplicado o
   * fraudulento-. Es un archivado, no un borrado real: el registro conserva su historial.
   */
  archivarFestival(festivalId: number, motivo: string): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/festivales/csrf', {
      errorFallback: 'No fue posible preparar la eliminación del registro',
    }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/institucional/festivales/${festivalId}/archivar`, { motivo }, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible eliminar el registro del ecosistema',
      }))
    );
  }

  /** Bandeja institucional de reclamaciones de administración de registros históricos. */
  cargarReclamacionesDeAdministracion(status?: string): Observable<ReclamacionAdministracionDeFestival[]> {
    const suffix = status ? `?estado=${encodeURIComponent(status)}` : '';
    return this.apiClient.get<ReclamacionAdministracionDeFestival[]>(`/api/v1/institucional/reclamaciones-administracion${suffix}`, { errorFallback: 'No fue posible consultar las reclamaciones de administración.' });
  }

  /** Todo lo que hace falta para decidir una reclamación: histórico, organización, cambios y relacionadas. */
  cargarDetalleDeReclamacion(id: string): Observable<DetalleDeReclamacion> {
    return this.apiClient.get<DetalleDeReclamacion>(`/api/v1/institucional/reclamaciones-administracion/${id}`, { errorFallback: 'No fue posible cargar la solicitud de administración.' });
  }

  decidirReclamacionDeAdministracion(id: string, accion: 'aprobar' | 'rechazar', motivo: string): Observable<ReclamacionAdministracionDeFestival> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/festivales/csrf', { errorFallback: 'No fue posible preparar la decisión institucional.' }).pipe(
      switchMap(token => this.apiClient.post<ReclamacionAdministracionDeFestival>(`/api/v1/institucional/reclamaciones-administracion/${id}/decision`, { accion, motivo }, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible registrar la decisión.' }))
    );
  }

  pedirAclaracionDeReclamacion(id: string, respuesta: string): Observable<ReclamacionAdministracionDeFestival> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/festivales/csrf', { errorFallback: 'No fue posible preparar la solicitud de aclaración.' }).pipe(
      switchMap(token => this.apiClient.post<ReclamacionAdministracionDeFestival>(`/api/v1/institucional/reclamaciones-administracion/${id}/aclaraciones`, { respuesta }, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible solicitar la aclaración.' }))
    );
  }

  cargarBandejaDePropuestas(): Observable<any[]> {
    return this.apiClient.get<any[]>('/api/v1/institucional/propuestas-cambio-festival/en-revision', {
      errorFallback: 'No fue posible consultar las propuestas en revisión',
    });
  }

  cargarFichaDePropuesta(propuestaId: number): Observable<any> {
    return this.apiClient.get<any>(`/api/v1/institucional/propuestas-cambio-festival/${propuestaId}`, {
      errorFallback: 'No fue posible consultar el detalle de la propuesta',
    });
  }

  decidirRevisionDePropuesta(propuestaId: number, payload: unknown): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/propuestas-cambio-festival/csrf', {
      errorFallback: 'No fue posible preparar la decisión sobre la propuesta',
    }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/institucional/propuestas-cambio-festival/${propuestaId}/decisiones`, payload, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible registrar la decisión sobre la propuesta',
      }))
    );
  }

  crearBorradorInstitucionalDeFestival(festivalId: number): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/propuestas-cambio-festival/csrf', {
      errorFallback: 'No fue posible preparar el borrador institucional del Festival',
    }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/institucional/propuestas-cambio-festival/festivales/${festivalId}/borrador-institucional`, {}, {
        headers: { 'X-CSRF-TOKEN': token.requestToken },
        errorFallback: 'No fue posible crear el borrador institucional del Festival',
      })),
    );
  }

  guardarBorradorInstitucionalDeFestival(proposalId: number, payload: unknown): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/propuestas-cambio-festival/csrf', { errorFallback: 'No fue posible preparar el guardado del borrador institucional' }).pipe(
      switchMap(token => this.apiClient.put<any>(`/api/v1/institucional/propuestas-cambio-festival/${proposalId}/borrador-institucional`, payload, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible guardar el borrador institucional' })),
    );
  }

  enviarBorradorInstitucionalARevision(proposalId: number): Observable<any> {
    return this.apiClient.get<{ requestToken: string }>('/api/v1/institucional/propuestas-cambio-festival/csrf', { errorFallback: 'No fue posible preparar el envío del borrador institucional' }).pipe(
      switchMap(token => this.apiClient.post<any>(`/api/v1/institucional/propuestas-cambio-festival/${proposalId}/enviar-borrador-institucional`, {}, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible enviar el borrador institucional a revisión' })),
    );
  }

  // --- Esquemas, Estadísticas y Monitoreo ---

  cargarEsquemaDeLaBase(): Observable<any> {
    return this.apiClient.get<any>('/api/v1/admin/data/schema', {
      errorFallback: 'No fue posible consultar el esquema administrativo',
    });
  }

  cargarIndicadoresDeLaConsola(): Observable<IndicadoresDeLaConsola> {
    return this.apiClient.get<IndicadoresDeLaConsola>('/api/v1/admin/data/stats', {
      errorFallback: 'No fue posible consultar las estadísticas administrativas',
    });
  }

  /**
   * Una actuación entera de la bitácora: la línea y lo que guardó de antes y de después.
   *
   * Hasta la bitácora se leía solo como lista: quién, qué y sobre
   * qué. Lo que cambió —que la fila guarda desde el primer día— no se podía ver desde ninguna
   * pantalla.
   */
  cargarDetalleDeAuditoria(id: string): Observable<DetalleDeAuditoria> {
    return this.apiClient.get<DetalleDeAuditoria>(`/api/v1/admin/auditoria/${encodeURIComponent(id)}`, {
      errorFallback: 'No fue posible abrir la actuación',
    });
  }

  /**
   * Lo decidido en la bandeja en los últimos 30 días, solo de los módulos de la cuenta.
   * No es la bitácora: esa exige el módulo «Auditoría», que un gestor no tiene.
   */
  cargarResueltas(): Observable<ResueltasDeLaBandeja> {
    return this.apiClient.get<ResueltasDeLaBandeja>('/api/v1/admin/resueltas/', {
      errorFallback: 'No fue posible consultar lo resuelto',
    });
  }

  cargarMonitorDelSistema(): Observable<MonitorDelSistema> {
    return this.apiClient.get<MonitorDelSistema>('/api/v1/admin/data/monitor', {
      errorFallback: 'No fue posible consultar el monitoreo técnico',
    });
  }

  // --- Gestión de Registros y Control de Estado ---

  cargarRegistrosDeLaConsola(payload: { moduleId: string; [key: string]: unknown }): Observable<any> {
    const { moduleId, ...valores } = payload;
    const params = Object.fromEntries(
      Object.entries(valores).filter((entrada): entrada is [string, string | number | boolean] =>
        ['string', 'number', 'boolean'].includes(typeof entrada[1])),
    );
    return this.apiClient.get<any>(`/api/v1/admin/data/records/${moduleId}`, {
      params,
      errorFallback: 'No fue posible consultar los registros del módulo',
    });
  }

  cambiarEstadoDeRegistro(payload: {
    moduleId: string;
    id: string;
    status: string;
    comment?: string;
    rejectionReason?: string;
    observedFieldsJson?: string;
  }): Observable<any> {
    const { moduleId, id, ...body } = payload;
    return this.testigo.conTestigo(headers => this.apiClient.post<any>(`/api/v1/admin/data/records/${moduleId}/${id}/status`, {
      status: body.status,
      comment: body.comment || '',
      rejectionReason: body.rejectionReason || '',
      observedFieldsJson: body.observedFieldsJson || '',
    }, {
      headers,
      errorFallback: 'No fue posible cambiar el estado del registro',
    }));
  }

  /*
   * AQUI ESTABA `upsertAdminRecord`, y era la unica operacion del servicio que componia su ruta
   * con un dato de configuracion: `payload.endpoint`, que venia de `ADMIN_MODULES[].endpoint`.
   *
   * Ese campo declaraba rutas del estilo `/admin/data/map/festivals`, y las nueve responden 404
   * —comprobado contra el API en marcha el 11 sep 2026—. Es decir, el unico guardado del panel
   * de registros no podia funcionar en ningun modulo. Se retiro entero en una revisión anterior junto con
   * el formulario que lo llamaba.
   *
   * LA LECCION, que fija `capacidades-reales.spec.ts`: una ruta no se compone desde datos de
   * configuracion. Se escribe donde se usa, donde alguien la puede leer al lado de la operacion
   * que la necesita y comprobar que existe.
   */

  // --- Vinculación de Registros Huérfanos ---

  crearSolicitudDeVinculacion(payload: { moduleId: string; recordId: string; requestedScope: string; reason: string; evidenceText: string }): Observable<SolicitudDeVinculacion> {
    return this.apiClient.post<SolicitudDeVinculacion>('/api/v1/solicitudes-de-vinculacion', payload, {
      errorFallback: 'No fue posible solicitar la vinculación del registro',
    });
  }

  cargarSolicitudesDeVinculacion(params: Record<string, string | number | boolean> = {}): Observable<RespuestaPaginada<SolicitudDeVinculacion>> {
    return this.apiClient.get<RespuestaPaginada<SolicitudDeVinculacion>>('/api/v1/admin/solicitudes-de-vinculacion', {
      params,
      errorFallback: 'No fue posible consultar solicitudes de vinculación',
    });
  }

  decidirSolicitudDeVinculacion(payload: { id: string; status: string; comment?: string }): Observable<SolicitudDeVinculacion> {
    return this.testigo.conTestigo(headers => this.apiClient.post<SolicitudDeVinculacion>(`/api/v1/admin/solicitudes-de-vinculacion/${payload.id}/status`, {
      status: payload.status,
      comment: payload.comment || '',
    }, {
      headers,
      errorFallback: 'No fue posible actualizar la solicitud de vinculación',
    }));
  }

  // --- Duplicados ---

  cargarPosiblesDuplicados(params: Record<string, string | number | boolean> = {}): Observable<RespuestaPaginada<CandidatoDuplicado>> {
    return this.apiClient.get<RespuestaPaginada<CandidatoDuplicado>>('/api/v1/admin/duplicates', {
      params,
      errorFallback: 'No fue posible consultar posibles duplicados',
    });
  }

  crearPosibleDuplicado(payload: { moduleId: string; sourceRecordId: string; candidateRecordId: string; similarityLevel: string; similarityScore?: number | null; evidenceJson?: string }): Observable<CandidatoDuplicado> {
    return this.testigo.conTestigo(headers => this.apiClient.post<CandidatoDuplicado>('/api/v1/admin/duplicates', payload, {
      headers,
      errorFallback: 'No fue posible registrar el posible duplicado',
    }));
  }

  decidirPosibleDuplicado(payload: { id: string; decision: string; comment?: string }): Observable<CandidatoDuplicado> {
    return this.testigo.conTestigo(headers => this.apiClient.post<CandidatoDuplicado>(`/api/v1/admin/duplicates/${payload.id}/decision`, {
      decision: payload.decision,
      comment: payload.comment || '',
    }, {
      headers,
      errorFallback: 'No fue posible guardar la decisión sobre el duplicado',
    }));
  }

  // --- Calidad de Datos ---

  cargarAlertasDeCalidad(params: Record<string, string | number | boolean> = {}): Observable<RespuestaPaginada<AlertaDeCalidad>> {
    return this.apiClient.get<RespuestaPaginada<AlertaDeCalidad>>('/api/v1/admin/data-quality/flags', {
      params,
      errorFallback: 'No fue posible consultar alertas de calidad de datos',
    });
  }

  crearAlertaDeCalidad(payload: { moduleId: string; recordId: string; flagType: string; severity: string; detail: string }): Observable<AlertaDeCalidad> {
    return this.testigo.conTestigo(headers => this.apiClient.post<AlertaDeCalidad>('/api/v1/admin/data-quality/flags', payload, {
      headers,
      errorFallback: 'No fue posible registrar la alerta de calidad de datos',
    }));
  }

  decidirAlertaDeCalidad(payload: { id: string; status: string }): Observable<AlertaDeCalidad> {
    return this.testigo.conTestigo(headers => this.apiClient.post<AlertaDeCalidad>(`/api/v1/admin/data-quality/flags/${payload.id}/status`, {
      status: payload.status,
    }, {
      headers,
      errorFallback: 'No fue posible actualizar la alerta de calidad de datos',
    }));
  }

}
