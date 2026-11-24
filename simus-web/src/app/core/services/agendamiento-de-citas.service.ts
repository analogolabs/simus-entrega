import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';

import { ApiClientService } from '../http/api-client.service';
import { TonoDeEstado } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { IDIOMA_DE_FECHAS, ZONA_HORARIA_SIMUS } from '../../shared/utils/formatos-de-fecha';

/**
 * Herramientas · la agenda de citas entre artistas y compradores de un Mercado (docs/referencia/26-agenda-de-citas-y-mercados.md).
 *
 * <b>UN SOLO SERVICIO PARA LOS TRES LADOS</b> —la organización del Mercado, quien participa y el portal
 * público—, porque comparten tipos y rutas. Toda escritura pide primero el testigo de la página
 * (`/externo/organizaciones/csrf`), como el resto del panel.
 */

export type ModoDeAgenda = 'compradores_rotan' | 'compradores_fijos';
export type EstadoDeAgenda = 'borrador' | 'abierta' | 'en_curso' | 'cerrada';
export type EstadoDeCita = 'solicitada' | 'confirmada' | 'rechazada' | 'cancelada' | 'vencida';
export type EstadoDeParticipante = 'pendiente' | 'aprobado' | 'lista_de_espera' | 'rechazado' | 'retirado';
export type AprobacionDeArtistas = 'automatica' | 'aceptacion';
export type RolDeParticipante = 'artista' | 'comprador';

/**
 * Las dos modalidades de una rueda de negocios (docs/referencia/26-agenda-de-citas-y-mercados.md), con el vocabulario del sector: en los mercados de música y
 * de industrias culturales (Circulart, BOGMusic, Mercado de Industrias Culturales del Sur, WOMEX…) las citas se llaman
 * «ruedas de negocios» o «citas de negocios»; quien compra o programa es el «comprador» o «booker» (también
 * «programador»), y quien se presenta es el «artista». Cada quien ocupa o un «stand» o una «mesa fija», o «rota»
 * pasando de uno en uno. El valor guardado no cambia (`compradores_rotan`, `compradores_fijos`): solo el rótulo.
 */
export const MODOS_DE_AGENDA: readonly { valor: ModoDeAgenda; etiqueta: string; ayuda: string; frecuencia: string }[] = [
  {
    valor: 'compradores_fijos',
    frecuencia: 'La más común',
    etiqueta: 'Los artistas rotan; los compradores tienen mesa fija',
    ayuda: 'Cada comprador o booker atiende en su mesa o espacio y los artistas pasan a presentarse, cada uno en su horario. El artista pide la cita y el comprador la confirma.',
  },
  {
    valor: 'compradores_rotan',
    frecuencia: 'Menos frecuente',
    etiqueta: 'Los compradores rotan; los artistas tienen stand fijo',
    ayuda: 'Cada artista recibe en su stand y los compradores o bookers pasan a verlos. El comprador pide la cita y el artista la confirma.',
  },
];

/** Quién rota y quién tiene su sitio fijo según el modo, con las palabras de cada lado (singular y plural). */
export interface VocabularioDeModo {
  /** Quien pasa de una cita a otra (pide las citas). */
  rota: { plural: string; singular: string };
  /** Quien recibe en su stand o mesa fija (confirma las citas). */
  fijo: { plural: string; singular: string };
  /** Dónde recibe quien es fijo: «stand» (artistas) o «mesa» (compradores). */
  sitioFijo: 'stand' | 'mesa';
  /** El rótulo del cupo de citas: cuántas puede tener quien rota. */
  cupoDeCitas: string;
  /** La explicación del cupo de citas. */
  ayudaDelCupo: string;
}

export function vocabularioDeModo(modo: ModoDeAgenda | string | null | undefined): VocabularioDeModo {
  // Sin modo (todavía no se sabe) se habla de la modalidad más común: compradores con mesa fija y artistas que rotan.
  const compradoresRotan = modo === 'compradores_rotan';
  const compradores = { plural: 'compradores o bookers', singular: 'comprador o booker' };
  const artistas = { plural: 'artistas', singular: 'artista' };
  return compradoresRotan
    ? {
      rota: compradores, fijo: artistas, sitioFijo: 'stand',
      cupoDeCitas: 'Cupo de citas por comprador o booker',
      ayudaDelCupo: 'Cuántos artistas alcanza a visitar cada comprador o booker en esta agenda.',
    }
    : {
      rota: artistas, fijo: compradores, sitioFijo: 'mesa',
      cupoDeCitas: 'Cupo de citas por artista',
      ayudaDelCupo: 'A cuántos compradores o bookers puede visitar cada artista en esta agenda.',
    };
}

/** Cómo entran los artistas, según la metodología de cada Mercado (decisión del 12 de noviembre de 2026). */
export const APROBACIONES_DE_ARTISTAS: readonly { valor: AprobacionDeArtistas; etiqueta: string; ayuda: string }[] = [
  {
    valor: 'automatica',
    etiqueta: 'Por orden de inscripción',
    ayuda: 'Cada artista entra al inscribirse hasta completar el cupo; los siguientes quedan en lista de espera.',
  },
  {
    valor: 'aceptacion',
    etiqueta: 'Por aprobación de la organización',
    ayuda: 'Cada inscripción queda pendiente hasta que la organización la apruebe o la rechace. Al aprobar se aplica el cupo.',
  },
];

export const TIPOS_DE_COMPRADOR: readonly { valor: string; etiqueta: string }[] = [
  { valor: 'festival', etiqueta: 'Festival' },
  { valor: 'sala', etiqueta: 'Sala o espacio' },
  { valor: 'agencia', etiqueta: 'Agencia' },
  { valor: 'sello', etiqueta: 'Sello' },
  { valor: 'editorial', etiqueta: 'Editorial' },
  { valor: 'medio', etiqueta: 'Medio' },
  { valor: 'institucion', etiqueta: 'Institución' },
  { valor: 'otro', etiqueta: 'Otro' },
];

const ETIQUETAS_DE_ESTADO_DE_AGENDA: Record<string, string> = {
  borrador: 'En preparación',
  abierta: 'Inscripción abierta',
  en_curso: 'En curso',
  cerrada: 'Cerrada',
};

const ETIQUETAS_DE_ESTADO_DE_CITA: Record<string, string> = {
  solicitada: 'Esperando respuesta',
  confirmada: 'Confirmada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
};

const ETIQUETAS_DE_ESTADO_DE_PARTICIPANTE: Record<string, string> = {
  pendiente: 'Pendiente de aprobación',
  aprobado: 'Inscrito',
  lista_de_espera: 'En lista de espera',
  rechazado: 'No aceptado',
  retirado: 'Retirado',
};

export function etiquetaDeEstadoDeAgenda(estado: string | null | undefined): string {
  return ETIQUETAS_DE_ESTADO_DE_AGENDA[(estado ?? '').toLowerCase()] ?? 'Sin estado';
}

export function etiquetaDeEstadoDeCita(estado: string | null | undefined): string {
  return ETIQUETAS_DE_ESTADO_DE_CITA[(estado ?? '').toLowerCase()] ?? 'Sin estado';
}

export function etiquetaDeEstadoDeParticipante(estado: string | null | undefined): string {
  return ETIQUETAS_DE_ESTADO_DE_PARTICIPANTE[(estado ?? '').toLowerCase()] ?? 'Sin estado';
}

export function etiquetaDeModo(modo: string | null | undefined): string {
  return MODOS_DE_AGENDA.find(m => m.valor === modo)?.etiqueta ?? 'Sin modo';
}

export function etiquetaDeAprobacion(aprobacion: string | null | undefined): string {
  return APROBACIONES_DE_ARTISTAS.find(a => a.valor === aprobacion)?.etiqueta ?? 'Por orden de inscripción';
}

export function etiquetaDeTipoDeComprador(tipo: string | null | undefined): string {
  return TIPOS_DE_COMPRADOR.find(t => t.valor === tipo)?.etiqueta ?? '';
}

/** El tono de un estado de la agenda, de la cita o del participante: un solo criterio para las tres pantallas. */
export function tonoDeEstadoDeAgenda(estado: string | null | undefined): TonoDeEstado {
  switch ((estado ?? '').toLowerCase()) {
    case 'abierta': return 'logrado';
    case 'en_curso': return 'en_curso';
    case 'cerrada': return 'cerrado';
    default: return 'preliminar';
  }
}

export function tonoDeEstadoDeCita(estado: string | null | undefined): TonoDeEstado {
  switch ((estado ?? '').toLowerCase()) {
    case 'confirmada': return 'logrado';
    case 'solicitada': return 'en_curso';
    case 'rechazada': return 'adverso';
    default: return 'cerrado';
  }
}

export function tonoDeEstadoDeParticipante(estado: string | null | undefined): TonoDeEstado {
  switch ((estado ?? '').toLowerCase()) {
    case 'aprobado': return 'logrado';
    case 'pendiente': return 'requiere_accion';
    case 'lista_de_espera': return 'en_curso';
    case 'rechazado': return 'adverso';
    default: return 'cerrado';
  }
}

/** Un día de la agenda con sus franjas, para leerlas por jornada y no como una nube de horas. */
export interface JornadaDeFranjas {
  /** `AAAA-MM-DD` en hora de Bogotá. */
  clave: string;
  /** «lunes 17 de noviembre». */
  rotulo: string;
  franjas: Franja[];
}

const FORMATO_DE_DIA = new Intl.DateTimeFormat(IDIOMA_DE_FECHAS, { timeZone: ZONA_HORARIA_SIMUS, year: 'numeric', month: '2-digit', day: '2-digit' });
const FORMATO_DE_JORNADA = new Intl.DateTimeFormat(IDIOMA_DE_FECHAS, { timeZone: ZONA_HORARIA_SIMUS, weekday: 'long', day: 'numeric', month: 'long' });
const FORMATO_DE_HORA = new Intl.DateTimeFormat(IDIOMA_DE_FECHAS, { timeZone: ZONA_HORARIA_SIMUS, hour: '2-digit', minute: '2-digit', hour12: false });

/** `AAAA-MM-DD` del día de Bogotá al que pertenece un instante. */
export function claveDeDia(utc: string): string {
  const p = Object.fromEntries(FORMATO_DE_DIA.formatToParts(new Date(utc)).map(x => [x.type, x.value]));
  return `${p['year']}-${p['month']}-${p['day']}`;
}

export function rotuloDeJornada(utc: string): string { return FORMATO_DE_JORNADA.format(new Date(utc)); }
export function horaDeLaFranja(utc: string): string { return FORMATO_DE_HORA.format(new Date(utc)); }

/** Las franjas agrupadas por día, en orden. */
export function agruparPorJornada(franjas: readonly Franja[]): JornadaDeFranjas[] {
  const jornadas = new Map<string, JornadaDeFranjas>();
  for (const franja of [...franjas].sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc))) {
    const clave = claveDeDia(franja.inicioUtc);
    if (!jornadas.has(clave)) jornadas.set(clave, { clave, rotulo: rotuloDeJornada(franja.inicioUtc), franjas: [] });
    jornadas.get(clave)!.franjas.push(franja);
  }
  return [...jornadas.values()];
}

// ───────────────────────────── Tipos de la API (AgendamientoContratos.cs) ─────────────────────────────

export interface EdicionConAgenda {
  edicionId: number;
  mercadoId: number;
  mercadoNombre: string;
  anio: number;
  edicionNombre: string | null;
  estadoEdicion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  agendaId: number | null;
  agendaEstado: EstadoDeAgenda | null;
  /** Todas las agendas de la edición, en orden de creación. */
  agendas?: { id: number; nombre: string; estado: EstadoDeAgenda }[] | null;
}

export interface ConfiguracionDeAgenda {
  modo: ModoDeAgenda;
  duracionMinutos: number;
  pausaMinutos: number;
  topeSolicitudesPendientes: number;
  vencimientoSolicitudHoras: number;
  cupoArtistas: number | null;
  aperturaInscripcionUtc: string | null;
  cierreInscripcionUtc: string | null;
  aprobacionDeArtistas: AprobacionDeArtistas;
  /** Cómo se llama la agenda dentro de su edición (una edición puede tener varias). Por omisión, el nombre del Mercado. */
  nombre?: string | null;
  /** Complemento del nombre: la edición o el nombre específico («Ronda de bookers»). */
  subtitulo?: string | null;
  /** Citas vivas que puede tener quien rota (cuántos artistas visita cada comprador o a cuántos compradores visita cada artista); `null` = sin límite. */
  citasMaximasPorVisitante?: number | null;
}

export interface Agenda extends ConfiguracionDeAgenda {
  id: number;
  edicionMercadoId: number;
  mercadoId: number;
  mercadoNombre: string;
  anio: number;
  edicionNombre: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: EstadoDeAgenda;
  franjas: number;
  artistasAprobados: number;
  artistasEnEspera: number;
  artistasPendientes: number;
  compradores: number;
  citasSolicitadas: number;
  citasConfirmadas: number;
}

export interface Franja {
  id: number;
  inicioUtc: string;
  finUtc: string;
}

export interface Participante {
  id: number;
  rol: RolDeParticipante;
  nombre: string;
  entidad: string | null;
  tipoDeComprador: string | null;
  presentacion: string | null;
  enlaces: string | null;
  representaA: string | null;
  espacio: string | null;
  estado: EstadoDeParticipante;
  motivoDeLaDecision: string | null;
  fechaInscripcion: string;
  tieneCuenta: boolean;
  posicionEnLaLista: number | null;
  correoInvitacion: string | null;
  contactoCorreo: string | null;
  contactoTelefono: string | null;
  /** La foto de perfil de la persona, si la tiene (si no, la pantalla pinta sus iniciales). */
  fotoUrl?: string | null;
  /** Un comprador sin cuenta con un enlace de invitación vigente. */
  invitacionPendiente: boolean;
}

export interface Cita {
  id: number;
  franjaId: number;
  inicioUtc: string;
  finUtc: string;
  estado: EstadoDeCita;
  anfitrionId: number;
  anfitrionNombre: string;
  anfitrionEntidad: string | null;
  anfitrionEspacio: string | null;
  visitanteId: number;
  visitanteNombre: string;
  visitanteEntidad: string | null;
  mensajeInicial: string | null;
  motivoDeLaDecision: string | null;
  venceUtc: string | null;
  fechaSolicitud: string;
  contactoCorreo: string | null;
  contactoTelefono: string | null;
  /** La mesa o la sala del comprador, asignada por la organización (nadie más la escribe). */
  espacio?: string | null;
  /** El portafolio de la OTRA parte de la cita: con él decide quien responde, y lo ve quien pide. */
  otraParte?: Portafolio | null;
}

/** El portafolio con el que agenda una persona en una agenda: copia propia, no toca su perfil público. */
export interface Portafolio {
  nombre: string;
  entidad: string | null;
  presentacion: string | null;
  enlaces: string | null;
  /** La misma foto que muestran la parrilla y el calendario; sin ella, iniciales. */
  fotoUrl?: string | null;
}

export interface MiPortafolio {
  presentacion: string | null;
  enlaces: string | null;
  entidad: string | null;
  representaA: string | null;
}

export interface AgendaDelOrganizador {
  agenda: Agenda;
  franjas: Franja[];
  participantes: Participante[];
  citas: Cita[];
}

export interface AgendaDisponible {
  agendaId: number;
  edicionMercadoId: number;
  mercadoNombre: string;
  anio: number;
  edicionNombre: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: EstadoDeAgenda;
  modo: ModoDeAgenda;
  duracionMinutos: number;
  cupoArtistas: number | null;
  artistasAprobados: number;
  inscripcionAbierta: boolean;
  citasMaximasPorVisitante?: number | null;
  agendaNombre?: string;
  agendaSubtitulo?: string;
  miRol: RolDeParticipante | null;
  miEstado: EstadoDeParticipante | null;
  aprobacionDeArtistas: AprobacionDeArtistas;
}

export interface AnfitrionConDisponibilidad {
  anfitrion: Participante;
  franjasLibres: number[];
}

export interface MiAgenda {
  agenda: AgendaDisponible;
  miParticipacion: Participante | null;
  posicionEnLaLista: number | null;
  rotoYPidoCitas: boolean;
  puedoInscribirme: boolean;
  puedoPedirCitas: boolean;
  solicitudesPendientes: number;
  topeSolicitudesPendientes: number;
  vencimientoSolicitudHoras: number;
  franjas: Franja[];
  citas: Cita[];
  anfitriones: AnfitrionConDisponibilidad[];
  /** Las citas vivas (solicitadas o confirmadas) de quien rota, para contarlas contra su cupo. */
  misCitasVivas?: number;
}

export interface AgendaPublica {
  agendaId: number;
  mercadoId: number;
  mercadoNombre: string;
  anio: number;
  edicionNombre: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: EstadoDeAgenda;
  inscripcionAbierta: boolean;
  cupoArtistas: number | null;
  artistasAprobados: number;
  aprobacionDeArtistas: AprobacionDeArtistas;
}

export interface InvitacionDeAgendaEmitida {
  participanteId: number;
  enlace: string;
  fechaExpiracion: string;
}

export interface InvitacionDeAgendaAbierta {
  mercadoNombre: string;
  anio: number;
  edicionNombre: string | null;
  correoEnmascarado: string;
  estado: 'pendiente' | 'aceptada' | 'revocada' | 'vencida';
  fechaExpiracion: string;
}

export interface NuevoComprador {
  nombre: string;
  entidad: string | null;
  tipoDeComprador: string;
  correo: string;
  presentacion: string | null;
  enlaces: string | null;
  espacio: string | null;
}

export interface Inscripcion {
  nombre: string | null;
  entidad: string | null;
  presentacion: string | null;
  enlaces: string | null;
  representaA: string | null;
  contactoCorreo: string | null;
  contactoTelefono: string | null;
}

@Injectable({ providedIn: 'root' })
export class AgendamientoDeCitasService {
  private readonly api = inject(ApiClientService);

  private testigo(): Observable<{ requestToken: string }> {
    return this.api.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', {
      errorFallback: 'No fue posible preparar la acción.',
    });
  }

  private escribir<T>(metodo: 'post' | 'put' | 'delete', ruta: string, cuerpo: unknown, errorFallback: string): Observable<T> {
    return this.testigo().pipe(
      switchMap(token => metodo === 'delete'
        ? this.api.delete<T>(ruta, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback })
        : this.api[metodo]<T>(ruta, cuerpo, {
          headers: { 'X-CSRF-TOKEN': token.requestToken },
          errorFallback,
        })),
    );
  }

  private baseDeLaOrganizacion(organizacionId: string | number): string {
    return `/api/v1/externo/organizaciones/${organizacionId}`;
  }

  // ─────────────────────────────── Portal público ───────────────────────────────

  agendasPublicas(): Observable<AgendaPublica[]> {
    return this.api.get<AgendaPublica[]>('/api/v1/publico/agendas-de-citas', {
      errorFallback: 'No fue posible consultar las agendas de citas.',
    });
  }

  // ───────────────────────── La organización del Mercado ─────────────────────────

  edicionesConAgenda(organizacionId: string | number): Observable<EdicionConAgenda[]> {
    return this.api.get<EdicionConAgenda[]>(`${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas`, {
      errorFallback: 'No fue posible consultar las ediciones de tus Mercados.',
    });
  }

  agendaDelOrganizador(organizacionId: string | number, agendaId: string | number): Observable<AgendaDelOrganizador> {
    return this.api.get<AgendaDelOrganizador>(
      `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}`,
      { errorFallback: 'No fue posible consultar la agenda de citas.' });
  }

  configurar(organizacionId: string | number, edicionId: string | number, cuerpo: ConfiguracionDeAgenda): Observable<Agenda> {
    return this.escribir<Agenda>(
      'put', `${this.baseDeLaOrganizacion(organizacionId)}/ediciones-de-mercado/${edicionId}/agenda`, cuerpo,
      'No fue posible guardar la configuración de la agenda.');
  }

  /** Una agenda NUEVA en la edición (una edición puede tener varias). */
  crearAgenda(organizacionId: string | number, edicionId: string | number, cuerpo: ConfiguracionDeAgenda): Observable<Agenda> {
    return this.escribir<Agenda>(
      'post', `${this.baseDeLaOrganizacion(organizacionId)}/ediciones-de-mercado/${edicionId}/agendas`, cuerpo,
      'No fue posible crear la agenda.');
  }

  /** Guarda la configuración de UNA agenda de la edición, y su nombre. */
  actualizarAgenda(organizacionId: string | number, edicionId: string | number, agendaId: number, cuerpo: ConfiguracionDeAgenda): Observable<Agenda> {
    return this.escribir<Agenda>(
      'put', `${this.baseDeLaOrganizacion(organizacionId)}/ediciones-de-mercado/${edicionId}/agendas/${agendaId}`, cuerpo,
      'No fue posible guardar la configuración de la agenda.');
  }

  retirarFranja(organizacionId: string | number, agendaId: number, franjaId: number): Observable<unknown> {
    return this.escribir('delete', `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/franjas/${franjaId}`, undefined,
      'No fue posible retirar la franja.');
  }

  urlDelCalendarioDeLaOrganizacion(organizacionId: string | number, agendaId: number): string {
    return `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/exportar.ics`;
  }

  cambiarEstado(organizacionId: string | number, agendaId: number, accion: 'abrir' | 'iniciar' | 'cerrar'): Observable<Agenda> {
    return this.escribir<Agenda>(
      'post', `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/estado`, { accion },
      'No fue posible cambiar el estado de la agenda.');
  }

  generarFranjas(
    organizacionId: string | number, agendaId: number, cuerpo: { fecha: string; desde: string; hasta: string },
  ): Observable<{ generadas: number; yaExistian: number; franjas: Franja[] }> {
    return this.escribir(
      'post', `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/franjas`, cuerpo,
      'No fue posible generar las franjas.');
  }

  agregarComprador(organizacionId: string | number, agendaId: number, cuerpo: NuevoComprador): Observable<Participante> {
    return this.escribir<Participante>(
      'post', `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/compradores`, cuerpo,
      'No fue posible invitar al comprador.');
  }

  /** Emite (o reemite) el enlace de invitación de un comprador que todavía no tiene cuenta. */
  emitirInvitacion(organizacionId: string | number, agendaId: number, participanteId: number): Observable<InvitacionDeAgendaEmitida> {
    return this.escribir<InvitacionDeAgendaEmitida>(
      'post', `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/participantes/${participanteId}/invitacion`, {},
      'No fue posible enviar la invitación.');
  }

  asignarEspacio(organizacionId: string | number, agendaId: number, participanteId: number, espacio: string | null): Observable<Participante> {
    return this.escribir<Participante>(
      'put', `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/participantes/${participanteId}/espacio`,
      { espacio }, 'No fue posible asignar la mesa o el espacio.');
  }

  decidirSobreParticipante(
    organizacionId: string | number, agendaId: number, participanteId: number, accion: 'aprobar' | 'rechazar' | 'retirar', motivo: string | null,
  ): Observable<Participante> {
    return this.escribir<Participante>(
      'post', `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/participantes/${participanteId}/decision`,
      { accion, motivo }, 'No fue posible completar la acción.');
  }

  cancelarComoOrganizacion(organizacionId: string | number, agendaId: number, citaId: number, motivo: string): Observable<void> {
    return this.escribir<void>(
      'post', `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/citas/${citaId}/cancelar`, { motivo },
      'No fue posible cancelar la cita.');
  }

  urlDelCsv(organizacionId: string | number, agendaId: number): string {
    return `${this.baseDeLaOrganizacion(organizacionId)}/agendas-de-citas/${agendaId}/exportar.csv`;
  }

  // ─────────────────────────────── Quien participa ───────────────────────────────

  misAgendas(): Observable<AgendaDisponible[]> {
    return this.api.get<AgendaDisponible[]>('/api/v1/externo/agendas-de-citas', {
      errorFallback: 'No fue posible consultar tus agendas de citas.',
    });
  }

  miAgenda(agendaId: string | number): Observable<MiAgenda> {
    return this.api.get<MiAgenda>(`/api/v1/externo/agendas-de-citas/${agendaId}`, {
      errorFallback: 'No fue posible consultar la agenda.',
    });
  }

  /** Vincula (o quita, con `null`) la foto que la persona subió al Banco con la subida personal. */
  guardarMiFoto(agendaId: number, archivoId: number | null): Observable<MiAgenda> {
    return this.escribir<MiAgenda>('put', `/api/v1/externo/agendas-de-citas/${agendaId}/mi-foto`, { archivoId },
      'No fue posible guardar tu foto.');
  }

  /** Ajusta el portafolio con el que la persona agenda en esta agenda (presentación, enlaces, agrupación). */
  guardarMiPortafolio(agendaId: number, cuerpo: MiPortafolio): Observable<MiAgenda> {
    return this.escribir<MiAgenda>('put', `/api/v1/externo/agendas-de-citas/${agendaId}/mi-portafolio`, cuerpo,
      'No fue posible guardar tu portafolio.');
  }

  inscribirme(agendaId: number, cuerpo: Inscripcion): Observable<MiAgenda> {
    return this.escribir<MiAgenda>('post', `/api/v1/externo/agendas-de-citas/${agendaId}/inscripcion`, cuerpo,
      'No fue posible inscribirte.');
  }

  retirarme(agendaId: number, motivo: string | null): Observable<void> {
    return this.escribir<void>('post', `/api/v1/externo/agendas-de-citas/${agendaId}/inscripcion/retirar`, { motivo },
      'No fue posible retirarte de la agenda.');
  }

  pedirCita(agendaId: number, anfitrionId: number, franjaId: number, mensaje: string | null): Observable<MiAgenda> {
    return this.escribir<MiAgenda>('post', `/api/v1/externo/agendas-de-citas/${agendaId}/citas`,
      { anfitrionId, franjaId, mensaje }, 'No fue posible pedir la cita.');
  }

  confirmarCita(agendaId: number, citaId: number): Observable<MiAgenda> {
    return this.escribir<MiAgenda>('post', `/api/v1/externo/agendas-de-citas/${agendaId}/citas/${citaId}/confirmar`, {},
      'No fue posible confirmar la cita.');
  }

  rechazarCita(agendaId: number, citaId: number, motivo: string): Observable<MiAgenda> {
    return this.escribir<MiAgenda>('post', `/api/v1/externo/agendas-de-citas/${agendaId}/citas/${citaId}/rechazar`, { motivo },
      'No fue posible rechazar la cita.');
  }

  cancelarCita(agendaId: number, citaId: number, motivo: string | null): Observable<MiAgenda> {
    return this.escribir<MiAgenda>('post', `/api/v1/externo/agendas-de-citas/${agendaId}/citas/${citaId}/cancelar`, { motivo },
      'No fue posible cancelar la cita.');
  }

  urlDelCalendario(agendaId: number): string {
    return `/api/v1/externo/agendas-de-citas/${agendaId}/mi-agenda.ics`;
  }
}
