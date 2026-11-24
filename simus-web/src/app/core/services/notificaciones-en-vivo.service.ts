import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, Subject, fromEvent, merge, timer } from 'rxjs';
import { catchError, distinctUntilChanged, exhaustMap, filter, map } from 'rxjs/operators';
import { ApiClientService } from '../http/api-client.service';

/** Intervalo corto, limitado a pestañas visibles, para recibir avisos sin recargar la página. */
export const INTERVALO_NOTIFICACIONES_MS = 4_000;
export type AmbitoDeNotificaciones = 'externo' | 'institucional';

export interface NotificacionEnVivo {
  id: string;
  recipientUserId: string | null;
  recipientEmail: string;
  eventType: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  moduleId: string;
  recordId: string;
  createdAt: string;
  sentAt: string | null;
  readAt: string | null;
  metadataJson?: string | null;
}

export interface PaginaDeNotificacionesEnVivo {
  items: NotificacionEnVivo[];
  limit: number;
  offset: number;
  total: number;
}

export interface DestinoDeNotificacion {
  ruta: readonly (string | number)[];
  parametros: Record<string, string> | null;
  accion: string;
}

function metadatosDe(notificacion: NotificacionEnVivo): Record<string, unknown> {
  if (!notificacion.metadataJson) return {};
  try {
    return JSON.parse(notificacion.metadataJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * La organización a la que se refiere un aviso, si el servidor la anotó en sus metadatos.
 *
 * Varios eventos de Festival la guardan (`OrganizacionPrincipalId`, `OrganizacionId`); los demás
 * no, y entonces el aviso se abre en la organización desde la que se mira la campana. La ficha del
 * Festival cambia sola a la organización correcta si el registro es de otra de la cuenta.
 */
export function organizacionDelAviso(notificacion: NotificacionEnVivo): string | null {
  const metadatos = metadatosDe(notificacion);
  for (const clave of ['OrganizacionPrincipalId', 'organizacionPrincipalId', 'OrganizacionId', 'organizacionId']) {
    const valor = String(metadatos[clave] ?? '').trim();
    if (/^\d+$/.test(valor)) return valor;
  }
  return null;
}

/**
 * Traduce eventos persistidos a destinos canónicos de Gestión.
 * Los eventos informativos devuelven `null`: leer un aviso no debe fingir que existe una tarea.
 *
 * <b>CON LA ORGANIZACIÓN EN LA DIRECCIÓN.</b> El destino es `/gestion/o/{id}/…`: la
 * del aviso si la trae, o `organizacionPorOmision` —la que tiene abierta quien lo lee—. Sin ninguna
 * de las dos se usa la dirección sin organización, que lleva a la organización por omisión.
 */
export function destinoExternoDe(notificacion: NotificacionEnVivo, organizacionPorOmision = ''): DestinoDeNotificacion | null {
  const evento = notificacion.eventType;
  const organizacion = organizacionDelAviso(notificacion) ?? organizacionPorOmision;
  const delPanel = (...segmentos: string[]): string[] => organizacion
    ? ['/gestion/o', organizacion, ...segmentos]
    : ['/gestion', ...segmentos];

  // EL ENLACE DE CONFIRMACION SE PUEDE PULSAR. Mientras el correo no tenga proveedor,
  // el mensaje solo existe aquí, y su dirección llegaba como texto plano dentro del cuerpo: había
  // que copiarla a mano a la barra. El testigo se toma del propio cuerpo —el servidor no lo guarda
  // en claro en ningún otro sitio— y se abre la misma página que abriría el correo.
  if (evento === 'ConfirmacionDeCorreo') {
    const testigo = /\/ecosistema\/confirmar-correo\?testigo=([A-Za-z0-9_-]+)/.exec(notificacion.body ?? '')?.[1];
    if (!testigo) return null;
    return {
      ruta: ['/ecosistema/confirmar-correo'],
      parametros: { testigo },
      accion: 'Confirmar mi correo',
    };
  }
  if (['FestivalCambiosPedidosPorCampo', 'FestivalAjustesSolicitados'].includes(evento)
      && notificacion.recordId) {
    return {
      ruta: delPanel('procesos', 'festivales', notificacion.recordId),
      parametros: { seccion: 'informacion', ajustes: '1' },
      accion: 'Resolver ajustes',
    };
  }

  if (evento === 'FestivalPropuestaAjustesSolicitados') {
    const festivalId = String(metadatosDe(notificacion)['FestivalOrigenId'] ?? '').trim();
    if (!festivalId) return null;
    return {
      ruta: delPanel('procesos', 'festivales', festivalId),
      parametros: { seccion: 'informacion', editar: '1' },
      accion: 'Revisar propuesta',
    };
  }

  if (evento === 'ReclamacionRequiereAclaracion' && notificacion.recordId) {
    return {
      ruta: delPanel('solicitudes'),
      parametros: { solicitud: notificacion.recordId, accion: 'aclarar' },
      accion: 'Responder aclaración',
    };
  }

  if (evento === 'ReclamacionAprobadaPendienteConciliacion' && notificacion.recordId) {
    return {
      ruta: delPanel('solicitudes'),
      parametros: { solicitud: notificacion.recordId, accion: 'conciliar' },
      accion: 'Conciliar datos',
    };
  }

  // LA AGENDA DE CITAS (docs/referencia/26-agenda-de-citas-y-mercados.md): todos sus avisos abren la agenda de la persona. El registro del aviso es
  // la agenda, no la cita: desde ahí se ve qué cambió. No lleva organización: es del espacio de la persona.
  if (EVENTOS_DE_LA_AGENDA_DE_CITAS.includes(evento) && /^\d+$/.test(String(notificacion.recordId ?? ''))) {
    return {
      ruta: ['/gestion/cuenta/agenda-de-citas', String(notificacion.recordId)],
      parametros: null,
      accion: 'Abrir mi agenda de citas',
    };
  }

  return null;
}

/** Los avisos que genera la agenda de citas de un Mercado. */
const EVENTOS_DE_LA_AGENDA_DE_CITAS: readonly string[] = [
  'InvitacionALaAgendaDeCitas', 'InscripcionEnAgendaConfirmada', 'InscripcionEnListaDeEspera', 'InscripcionPendienteDeAprobacion',
  'InscripcionEnAgendaRechazada', 'RetiradoDeLaAgendaDeCitas', 'CitaSolicitada', 'CitaConfirmada',
  'CitaRechazada', 'CitaCancelada',
];

/**
 * Traduce los avisos del buzón institucional a la dirección de la ficha o la revisión.
 *
 * <b>CADA AVISO ABRE SU REGISTRO.</b> «Revisar solicitud» llevaba a la bandeja sin seleccionar nada
 * y la ruta se leía como texto dentro del mensaje. Ahora el aviso de un Festival recibido abre su
 * revisión (`/administracion/solicitudes/review-festivals-{id}`) y el de un Mercado, su ficha
 * (`/administracion/mercados/{id}`). Un aviso sin registro identificable devuelve `null`.
 */
export function destinoInstitucionalDe(notificacion: NotificacionEnVivo): DestinoDeNotificacion | null {
  const registro = String(notificacion.recordId ?? '').trim();
  if (!/^\d+$/.test(registro)) return null;
  if (notificacion.eventType === 'FestivalRecibidoParaRevision') {
    return { ruta: ['/administracion', 'solicitudes', `review-festivals-${registro}`], parametros: null, accion: 'Revisar solicitud' };
  }
  if (notificacion.eventType === 'MercadoRecibidoParaRevision') {
    return { ruta: ['/administracion', 'mercados', registro], parametros: null, accion: 'Revisar Mercado' };
  }
  if (notificacion.eventType === 'TallerRecibidoParaRevision') {
    return { ruta: ['/administracion', 'talleres', registro], parametros: null, accion: 'Revisar taller' };
  }
  if (notificacion.eventType === 'EspacioRecibidoParaRevision') {
    return { ruta: ['/administracion', 'espacios', registro], parametros: null, accion: 'Revisar espacio' };
  }
  if (notificacion.eventType === 'RedRecibidaParaRevision') {
    return { ruta: ['/administracion', 'redes', registro], parametros: null, accion: 'Revisar red' };
  }
  return null;
}

/** El nombre de la organización que el servidor anotó en los metadatos del aviso, si lo hizo. */
export function organizacionNombreDelAviso(notificacion: NotificacionEnVivo): string | null {
  const nombre = String(metadatosDe(notificacion)['OrganizacionNombre'] ?? '').trim();
  return nombre || null;
}

/**
 * Un solo mecanismo de sondeo para las dos cabeceras autenticadas. Cada consumidor declara el
 * ámbito de su buzón para que dos sesiones simultáneas no mezclen avisos.
 *
 * La consulta es inmediata, se repite únicamente mientras la pestaña está visible y vuelve a
 * ejecutarse al recuperar foco o conexión. `exhaustMap` impide acumular peticiones si una lectura
 * tarda más que el intervalo. Un fallo transitorio no emite una lista vacía y, por tanto, no borra
 * avisos que la persona ya estaba leyendo.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesEnVivoService {
  private readonly api = inject(ApiClientService);
  private readonly documento = inject(DOCUMENT);
  private readonly actualizacionSolicitada = new Subject<void>();

  observar(ambito: AmbitoDeNotificaciones, limite = 50): Observable<PaginaDeNotificacionesEnVivo> {
    const ventana = this.documento.defaultView;
    const activadores: Observable<unknown>[] = [
      timer(0, INTERVALO_NOTIFICACIONES_MS),
      this.actualizacionSolicitada,
      fromEvent(this.documento, 'visibilitychange'),
    ];
    if (ventana) {
      activadores.push(fromEvent(ventana, 'focus'), fromEvent(ventana, 'online'));
    }

    return merge(...activadores).pipe(
      filter(() => !this.documento.hidden),
      exhaustMap(() => this.api.get<PaginaDeNotificacionesEnVivo>('/api/v1/notificaciones', {
        params: { ambito, limite },
        errorFallback: 'No fue posible actualizar las notificaciones',
      }).pipe(catchError(() => EMPTY))),
      map(pagina => ({ ...pagina, items: pagina?.items ?? [] })),
      distinctUntilChanged((anterior, actual) => JSON.stringify(anterior) === JSON.stringify(actual)),
    );
  }

  actualizarAhora(): void {
    this.actualizacionSolicitada.next();
  }

  marcarComoLeida(ambito: AmbitoDeNotificaciones, id: string): Observable<NotificacionEnVivo> {
    return this.api.post<NotificacionEnVivo>(`/api/v1/notificaciones/${id}/lectura?ambito=${ambito}`, {}, {
      errorFallback: 'No fue posible marcar la notificación como leída',
    });
  }

  ocultarLeidas(ambito: AmbitoDeNotificaciones): Observable<{ ocultadas: number }> {
    return this.api.post<{ ocultadas: number }>(`/api/v1/notificaciones/leidas/ocultar?ambito=${ambito}`, {}, {
      errorFallback: 'No fue posible limpiar las notificaciones leídas',
    });
  }
}
