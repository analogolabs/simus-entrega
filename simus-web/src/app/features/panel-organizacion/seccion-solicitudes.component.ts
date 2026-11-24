import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { ApiClientService } from '../../core/http/api-client.service';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { SolicitudDeLaCuenta, SolicitudesDeLaCuentaService } from './solicitudes/solicitudes-de-la-cuenta.service';
import { ListaDeSolicitudesComponent } from './solicitudes/lista-de-solicitudes.component';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import { RECLAMACION_ABIERTA } from './reclamaciones-de-procesos.service';
import { SoportesDeSolicitudComponent } from './soportes-de-solicitud.component';
import { valorLegibleDeUnCampo } from '../../core/vocabularios/periodicidad';
import { EncabezadoDePantallaComponent } from '../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';

/** Los campos que se concilian, con su rótulo en español. */
const CAMPOS_CONCILIABLES: Record<string, { borrador: string; etiqueta: string }> = {
  Name: { borrador: 'nombre', etiqueta: 'Nombre' },
  Description: { borrador: 'descripcion', etiqueta: 'Descripción' },
  ContactEmail: { borrador: 'correoContacto', etiqueta: 'Correo de contacto' },
  ContactPhone: { borrador: 'telefonoCelular', etiqueta: 'Teléfono' },
  InstagramUrl: { borrador: 'instagram', etiqueta: 'Instagram' },
  FacebookUrl: { borrador: 'facebook', etiqueta: 'Facebook' },
  WebsiteUrl: { borrador: 'paginaWeb', etiqueta: 'Página web' },
  OtherUrl: { borrador: 'otroEnlace', etiqueta: 'Otro enlace' },
  Periodicidad: { borrador: 'periodicidad', etiqueta: 'Periodicidad' },
};

interface ReclamacionAdministracion {
  id: string;
  dominio: string;
  registroCanonicoId: string;
  estado: string;
  justificacion: string;
  motivoDecision?: string | null;
  fechaCreacion: string;
  fechaDecision?: string | null;
  registroNombre?: string | null;
  /** Lo que el PNMC preguntó y falta responder: sin esto la organización no sabe qué contestar (D3-02). */
  aclaracionPendiente?: string | null;
  /** Los soportes adjuntos, con su enlace al Banco de archivos. */
  soportes?: { archivoId: string; nombre: string; url: string }[] | null;
}

interface ConciliacionAdministracion {
  reclamacionId: string;
  valoresHistoricosJson: string;
  valoresBorradorJson: string;
}

/**
 * «Solicitudes» de la organización (SOL; antes «Trámites»).
 *
 * <b>UNA SOLA LISTA PARA TODOS LOS TIPOS.</b> La lista es `app-lista-de-solicitudes`, la misma de «Mi actividad y
 * solicitudes»: lo que espera la acción de la organización, lo que espera respuesta y lo resuelto, de Festivales,
 * Mercados, propuestas, retiros, procesos de lutería, espacios y redes, eventos y solicitudes de acceso. Lo lee del
 * servidor ya unificado.
 *
 * <b>LAS ACCIONES DE UNA SOLICITUD DE ADMINISTRACIÓN VIVEN EN SU FICHA</b> (`?solicitud={id}`): responder una
 * aclaración, elegir los datos que se conservan y cancelar. Los avisos y el Resumen llevan directo a ella
 * (`?solicitud={id}&accion=aclarar|conciliar`). No se perdió ninguna función de.
 */
/** Bandeja de acciones pendientes y trámites administrativos de la organización. */
@Component({
  selector: 'app-seccion-solicitudes',
  standalone: true,
  imports: [EsqueletoComponent, AvisoSoloAdministracionComponent, CommonModule, RouterLink, IndicadorDeEstadoComponent, SoportesDeSolicitudComponent, ListaDeSolicitudesComponent, EncabezadoDePantallaComponent],
  templateUrl: './seccion-solicitudes.component.html',
})
export class SeccionSolicitudesComponent {
  /** El tono del indicador, desde el criterio único del proyecto. */
  readonly tonoDelEstado = tonoDelEstado;

  private readonly http = inject(ApiClientService);
  private readonly store = inject(PanelOrganizacionStore);

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  private readonly servicioDeSolicitudes = inject(SolicitudesDeLaCuentaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  solicitudDirigida = '';
  private accionDirigida = '';
  /** El Festival que se acaba de reclamar desde el asistente, para confirmarlo aquí. */
  readonly reclamadaAhora = signal('');

  readonly organizacionId = this.store.organizacionId;
  /** Los trámites de administración (aclarar, conciliar, cancelar) son de la administración. */
  readonly esAdministradora = this.store.esAdministradora;
  readonly reclamaciones = signal<ReclamacionAdministracion[]>([]);
  readonly solicitudes = signal<SolicitudDeLaCuenta[]>([]);
  /** El contador discreto del encabezado: cuántas hay y cuántas esperan la acción de la persona. */
  readonly contador = computed(() => {
    const todas = this.solicitudes();
    if (!todas.length) return null;
    const aLaEspera = todas.filter(f => f.espera === 'tu_accion').length;
    return `${todas.length} ${todas.length === 1 ? 'solicitud' : 'solicitudes'} · ${aLaEspera === 0 ? 'ninguna espera tu acción' : aLaEspera === 1 ? '1 espera tu acción' : `${aLaEspera} esperan tu acción`}`;
  });
  readonly cargando = signal(false);
  readonly cargandoLista = signal(false);
  readonly error = signal('');
  readonly ocupado = signal(false);
  readonly aclaracionAbierta = signal<string | null>(null);
  readonly respuestaAclaracion = signal('');
  /** Los soportes que acompañan la respuesta a una aclaración. */
  readonly soportesAclaracion = signal<string[]>([]);
  readonly conciliacion = signal<ConciliacionAdministracion | null>(null);
  readonly selecciones = signal<Record<string, string>>({});

  readonly activas = computed(() => this.reclamaciones().filter(reclamacion => this.esActiva(reclamacion)));
  readonly cerradas = computed(() => this.reclamaciones().filter(reclamacion => !this.esActiva(reclamacion)));
  /** La ficha abierta: la solicitud de administración que señala `?solicitud=`, si es de esta organización. */
  readonly fichaAbierta = computed(() => this.reclamaciones().find(r => r.id === this.fichaId()) ?? null);
  private readonly fichaId = signal('');

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(parametros => {
      this.solicitudDirigida = parametros.get('solicitud') ?? '';
      this.fichaId.set(this.solicitudDirigida);
      this.accionDirigida = parametros.get('accion') ?? '';
      this.reclamadaAhora.set(parametros.get('reclamada') ?? '');
      this.aplicarDestinoDelAviso();
    });
    effect(() => {
      const organizacionId = this.organizacionId();
      if (organizacionId) {
        this.cargar(organizacionId);
        this.cargarLista(organizacionId);
      }
    });
  }

  etiquetaEstado(estado: string): string {
    return ({ borrador: 'Borrador', enviada: 'Enviada', en_revision: 'En revisión', requiere_aclaracion: 'Requiere aclaración', aclaracion_enviada: 'Aclaración enviada', aprobada: 'Aprobada: falta elegir datos', rechazada: 'Rechazada', cancelada: 'Cancelada', transferencia_ejecutada: 'Administración transferida', historica: 'Histórica' } as Record<string, string>)[estado] ?? 'Sin estado';
  }

  claseEstado(estado: string): string {
    if (estado === 'requiere_aclaracion') return 'border-amber-200 bg-amber-50 text-amber-900';
    if (estado === 'aprobada') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    if (estado === 'rechazada') return 'border-red-200 bg-red-50 text-red-800';
    if (estado === 'cancelada') return 'border-slate-200 bg-slate-100 text-slate-600';
    return 'border-violet-200 bg-violet-50 text-morado';
  }

  descripcionEstado(reclamacion: ReclamacionAdministracion): string {
    if (reclamacion.estado === 'requiere_aclaracion') return 'El PNMC necesita una aclaración para decidir. Respóndela para continuar.';
    if (reclamacion.estado === 'aprobada') return 'El PNMC aprobó tu solicitud. Elige qué datos conservar y tu organización pasará a administrar el Festival.';
    if (reclamacion.estado === 'transferencia_ejecutada') return 'Tu organización ya administra este Festival, con sus ediciones.';
    if (reclamacion.estado === 'rechazada') return reclamacion.motivoDecision || 'El PNMC cerró esta solicitud sin aprobarla.';
    if (reclamacion.estado === 'cancelada') return 'Tu organización canceló esta solicitud.';
    if (reclamacion.estado === 'aclaracion_enviada') return 'Enviaste la aclaración. El PNMC la está revisando.';
    return 'El PNMC está revisando tu solicitud para administrar este Festival.';
  }

  /** El valor de un dato conciliable como lo dice el resto de la plataforma (D3-04). */
  legible(clave: string, valor: unknown): string { return valorLegibleDeUnCampo(clave, valor); }

  titulo(reclamacion: ReclamacionAdministracion): string { return reclamacion.registroNombre || `Festival #${reclamacion.registroCanonicoId}`; }
  esActiva(reclamacion: ReclamacionAdministracion): boolean { return RECLAMACION_ABIERTA.includes(reclamacion.estado); }
  /** Antes de la transferencia el Festival no es de la organización: su ficha del panel no abre. */
  yaEsNuestro(reclamacion: ReclamacionAdministracion): boolean { return reclamacion.estado === 'transferencia_ejecutada'; }
  puedeCancelar(reclamacion: ReclamacionAdministracion): boolean { return ['borrador', 'enviada', 'en_revision', 'requiere_aclaracion', 'aclaracion_enviada'].includes(reclamacion.estado); }

  abrirAclaracion(reclamacion: ReclamacionAdministracion): void { this.aclaracionAbierta.set(reclamacion.id); this.respuestaAclaracion.set(''); this.soportesAclaracion.set([]); }

  /** Cuántos soportes más admite la solicitud: cinco en total, contando los que ya tiene. */
  soportesDisponibles(reclamacion: ReclamacionAdministracion): number { return Math.max(0, 5 - (reclamacion.soportes?.length ?? 0)); }

  enviarAclaracion(reclamacion: ReclamacionAdministracion): void {
    const respuesta = this.respuestaAclaracion().trim();
    if (!respuesta) { this.error.set('Escribe la aclaración antes de enviarla.'); return; }
    this.ejecutarEscritura(`/api/v1/externo/reclamaciones-administracion/${reclamacion.id}/aclaraciones/responder`, { respuesta, soportes: this.soportesAclaracion() }, () => { this.aclaracionAbierta.set(null); this.respuestaAclaracion.set(''); this.soportesAclaracion.set([]); });
  }

  cancelar(reclamacion: ReclamacionAdministracion): void { this.ejecutarEscritura(`/api/v1/externo/reclamaciones-administracion/${reclamacion.id}/cancelar`, {}, () => undefined); }

  abrirConciliacion(reclamacion: ReclamacionAdministracion): void {
    this.error.set('');
    this.http.get<ConciliacionAdministracion>(`/api/v1/externo/reclamaciones-administracion/${reclamacion.id}/conciliacion`, { errorFallback: 'No fue posible cargar la conciliación.' }).subscribe({
      next: fila => {
        this.conciliacion.set(fila);
        const historico = this.leerJson(fila.valoresHistoricosJson);
        const borrador = this.leerJson(fila.valoresBorradorJson);
        const selecciones: Record<string, string> = {};
        // LO VACÍO NO SE PROPONE: se preseleccionaba el borrador aunque dijera «Sin
        // dato», y elegirlo borraba el dato histórico. Se marca lo que la organización sí escribió.
        // El NOMBRE se preselecciona del histórico: en el asistente se escribe para buscar, y
        // renombrar un Festival con historia tiene que ser una decisión, no la opción por defecto.
        for (const clave of Object.keys(historico)) selecciones[clave] = clave !== 'Name' && this.propone(historico[clave], borrador[this.claveBorrador(clave)]) ? 'borrador' : 'historico';
        this.selecciones.set(selecciones);
      },
      error: () => undefined,
    });
  }

  camposConciliacion(): { clave: string; etiqueta: string; historico: unknown; borrador: unknown }[] {
    const fila = this.conciliacion();
    if (!fila) return [];
    const historico = this.leerJson(fila.valoresHistoricosJson);
    const borrador = this.leerJson(fila.valoresBorradorJson);
    return Object.keys(historico)
      .filter(clave => this.propone(historico[clave], borrador[this.claveBorrador(clave)]))
      .map(clave => ({ clave, etiqueta: CAMPOS_CONCILIABLES[clave]?.etiqueta ?? clave, historico: historico[clave], borrador: borrador[this.claveBorrador(clave)] }));
  }

  private propone(historico: unknown, borrador: unknown): boolean {
    const texto = typeof borrador === 'string' ? borrador.trim() : '';
    return !!texto && texto !== (typeof historico === 'string' ? historico.trim() : historico);
  }

  elegir(clave: string, valor: string): void { this.selecciones.update(actual => ({ ...actual, [clave]: valor })); }
  resolverConciliacion(): void { const fila = this.conciliacion(); if (fila) this.ejecutarEscritura(`/api/v1/externo/reclamaciones-administracion/${fila.reclamacionId}/conciliacion/resolver`, { selecciones: this.selecciones() }, () => this.conciliacion.set(null)); }

  private cargar(organizacionId: string): void {
    this.cargando.set(true); this.error.set('');
    this.http.get<ReclamacionAdministracion[]>(`/api/v1/externo/organizaciones/${organizacionId}/reclamaciones-administracion`, { errorFallback: 'No fue posible consultar las solicitudes administrativas.' }).subscribe({
      next: filas => {
        this.reclamaciones.set(filas ?? []);
        this.cargando.set(false);
        this.aplicarDestinoDelAviso();
      },
      error: () => { this.error.set('No fue posible consultar las solicitudes administrativas. Inténtalo de nuevo.'); this.cargando.set(false); },
    });
  }

  private cargarLista(organizacionId: string): void {
    this.cargandoLista.set(true);
    // Si la lista no se puede leer, la ficha de una solicitud de administración sigue funcionando.
    this.servicioDeSolicitudes.deLaOrganizacion(organizacionId).subscribe({
      next: filas => { this.solicitudes.set(filas ?? []); this.cargandoLista.set(false); },
      error: () => { this.solicitudes.set([]); this.cargandoLista.set(false); },
    });
  }

  private ejecutarEscritura(ruta: string, cuerpo: unknown, alTerminar: () => void): void {
    if (this.ocupado()) return;
    this.ocupado.set(true); this.error.set('');
    this.http.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', { errorFallback: 'No fue posible preparar la solicitud.' }).pipe(switchMap(token => this.http.post(ruta, cuerpo, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible actualizar la solicitud.' }))).subscribe({
      next: () => { this.ocupado.set(false); alTerminar(); this.cargar(this.organizacionId()); this.cargarLista(this.organizacionId()); },
      error: () => { this.error.set('No fue posible actualizar la solicitud. Inténtalo de nuevo.'); this.ocupado.set(false); },
    });
  }

  private leerJson(valor: string): Record<string, unknown> { try { return JSON.parse(valor) as Record<string, unknown>; } catch { return {}; } }
  private claveBorrador(clave: string): string { return CAMPOS_CONCILIABLES[clave]?.borrador ?? clave; }

  private aplicarDestinoDelAviso(): void {
    if (!this.solicitudDirigida || !this.accionDirigida || !this.esAdministradora()) return;
    const reclamacion = this.reclamaciones().find(item => item.id === this.solicitudDirigida);
    if (!reclamacion) return;
    if (this.accionDirigida === 'aclarar' && reclamacion.estado === 'requiere_aclaracion') {
      this.abrirAclaracion(reclamacion);
      return;
    }
    if (this.accionDirigida === 'conciliar' && reclamacion.estado === 'aprobada' && !this.conciliacion()) {
      this.abrirConciliacion(reclamacion);
    }
  }
}
