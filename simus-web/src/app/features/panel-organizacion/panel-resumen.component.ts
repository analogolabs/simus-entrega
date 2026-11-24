import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideBell, LucideCalendar, LucideMail, LucidePencil, LucideTriangleAlert } from '@lucide/angular';
import { Observable, catchError, forkJoin, of, take } from 'rxjs';
import { EventoDeLaOrganizacion, PanelOrganizacionApi, PerfilOrganizacion } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { TIPOS_DE_PROCESO, TipoDeProceso } from '../../core/navegacion/tipos-de-proceso';
import { AvisoDeCorreoSinConfirmarComponent } from './aviso-de-correo-sin-confirmar.component';
import { InvitacionACompletarComponent } from './invitacion-a-completar.component';
import { RegistroSinTerminarComponent } from './registro-sin-terminar.component';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { ConfirmacionDeCorreoService } from '../../core/services/confirmacion-de-correo.service';
import { TalleresService } from '../../core/services/talleres.service';
import { EspaciosService } from '../../core/services/espacios.service';
import { RedesService } from '../../core/services/redes.service';
import { EventosDeOrganizacionService } from './eventos-de-organizacion.service';
import { SolicitudDeLaCuenta, SolicitudesDeLaCuentaService } from './solicitudes/solicitudes-de-la-cuenta.service';
import { AgendaDelInicioComponent } from './agenda-del-inicio.component';
import { AccionDeRegistro, MenuDeAccionesComponent } from '../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';
import { NotificacionesEnVivoService, organizacionDelAviso } from '../../core/services/notificaciones-en-vivo.service';
import { ApiClientService } from '../../core/http/api-client.service';
import { PanelDeSeccionComponent } from '../../shared/components/ui/panel-de-seccion/panel-de-seccion.component';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { BotonComponent } from '../../shared/components/ui/boton/boton.component';
import { motivoDeLaFalla } from './solicitudes/mi-actividad.component';
import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { nombrePropio } from '../../shared/texto/nombre-propio';
import { FechaPipe } from '../../shared/utils/fecha.pipe';

/** Una fila del estado de los procesos: cuántos hay de un tipo y en qué estado están. */
interface EstadoDeUnTipo {
  clave: TipoDeProceso;
  nombre: string;
  total: number;
  borrador: number;
  enRevision: number;
  ajustes: number;
  publicados: number;
}

const MAXIMO_DE_ACCIONES = 6;
const MAXIMO_EN_CURSO = 4;
const MAXIMO_DE_ACTIVIDAD = 5;

function normalizado(estado: string | null | undefined): string {
  return (estado ?? '').replace(/[_\s-]/g, '').toLowerCase();
}

/**
 * EL INICIO del panel de la organización, en `/gestion/o/{id}/resumen` (P1 de la gestión externa, prototipo B4).
 *
 * <b>UN CENTRO DE TRABAJO, NO TARJETAS APILADAS.</b> Una banda de identidad (nombre, ciudad, rol y estado, con
 * «Editar los datos» y «Crear»), una columna de trabajo y, a la derecha, la agenda y las últimas acciones sobre un
 * fondo sutil. En el móvil todo cae en una sola columna. Responde, en este orden:
 * <ol>
 *   <li><b>Requiere atención</b>: lo que espera a la organización —las solicitudes con ajustes pedidos o borradores sin
 *     enviar (misma fuente que Solicitudes), los avisos sin leer, los eventos en borrador y las invitaciones al equipo
 *     por aceptar—. El archivo sin usar se descartó;</li>
 *   <li><b>Informe de procesos</b>, solo lectura: cuántos hay, en qué estado, por tipo y cuáles esperan al PNMC. Un solo
 *     enlace, «Ver todos los procesos»;</li>
 *   <li><b>Agenda</b>: calendario con los días que tienen eventos y los próximos;</li>
 *   <li><b>Últimas acciones</b>: lo que la organización ya hizo. Los avisos recibidos NO van aquí: viven en la campana.</li>
 * </ol>
 * Todo viene de lecturas que ya existían (procesos, solicitudes, eventos, equipo y avisos); nada se simula. Los avisos
 * de cuenta (correo sin confirmar, datos que faltan, un registro sin terminar) solo aparecen cuando hay algo pendiente.
 */
@Component({
  selector: 'app-panel-resumen',
  standalone: true,
  imports: [
    RouterLink, FechaPipe, AvisoDeCorreoSinConfirmarComponent, InvitacionACompletarComponent, RegistroSinTerminarComponent,
    EsqueletoComponent, BotonNativoDirective, BotonComponent, EstadoDeListaComponent, IndicadorDeEstadoComponent,
    PanelDeSeccionComponent, AgendaDelInicioComponent, MenuDeAccionesComponent,
    LucideBell, LucideCalendar, LucideMail, LucidePencil, LucideTriangleAlert,
  ],
  templateUrl: './panel-resumen.component.html',
  styleUrl: './panel-resumen.component.css',
})
export class PanelResumenComponent {
  private readonly api = inject(PanelOrganizacionApi);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly sesion = inject(ExternalSessionService);
  private readonly confirmacion = inject(ConfirmacionDeCorreoService);
  private readonly talleres = inject(TalleresService);
  private readonly espacios = inject(EspaciosService);
  private readonly redes = inject(RedesService);
  private readonly solicitudesApi = inject(SolicitudesDeLaCuentaService);
  private readonly eventosApi = inject(EventosDeOrganizacionService);
  private readonly avisosEnVivo = inject(NotificacionesEnVivoService);
  private readonly http = inject(ApiClientService);
  private readonly router = inject(Router);

  readonly tonoDelEstado = tonoDelEstado;

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  readonly organizacionId = this.store.organizacionId;
  /** Solo quien administra cambia los datos de la organización. */
  readonly esAdministradora = this.store.esAdministradora;

  readonly perfil = signal<PerfilOrganizacion | null>(null);
  readonly primerIngreso = computed(() => this.sesion.actual()?.esPrimerIngreso === true);
  readonly nombreDeQuienEntro = computed(() => this.sesion.actual()?.fullName ?? '');
  readonly correoConfirmado = computed(() => this.confirmacion.estado()?.correoConfirmado === true);
  readonly confirmacionCorreoObligatoria = computed(() => this.confirmacion.estado()?.confirmacionCorreoObligatoria ?? true);

  readonly cargando = signal(true);
  /** Qué fuentes no se pudieron leer, con el motivo de la primera. Vacío si todo se leyó. */
  readonly falla = signal<{ fuentes: string[]; motivo: string } | null>(null);
  readonly solicitudes = signal<SolicitudDeLaCuenta[]>([]);
  readonly eventos = signal<EventoDeLaOrganizacion[]>([]);
  private readonly filas = signal<{ tipo: TipoDeProceso; estado: string | null | undefined }[]>([]);

  /** Lo que espera la acción de la organización, lo más reciente primero. */
  readonly porAtender = computed(() => this.solicitudes().filter(s => s.espera === 'tu_accion'));
  readonly accionesVisibles = computed(() => this.porAtender().slice(0, MAXIMO_DE_ACCIONES));

  /** Las últimas acciones: lo que ya no espera la acción de nadie, de lo más nuevo a lo más viejo. Sin avisos. */
  readonly actividad = computed(() => [...this.solicitudes()].filter(s => s.espera !== 'tu_accion')
    .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAXIMO_DE_ACTIVIDAD));

  /** Lo que ya se envió y espera respuesta del PNMC: el siguiente paso de cada proceso en curso. */
  readonly enCurso = computed(() => this.solicitudes().filter(s => s.espera === 'en_espera')
    .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAXIMO_EN_CURSO));

  /** Los tipos que la organización tiene, con sus conteos por estado, en el orden fijo del Ecosistema. */
  readonly estadoPorTipo = computed<EstadoDeUnTipo[]>(() => TIPOS_DE_PROCESO.map(tipo => {
    const delTipo = this.filas().filter(f => f.tipo === tipo.clave);
    const cuantos = (estado: string) => delTipo.filter(f => normalizado(f.estado) === estado).length;
    return {
      clave: tipo.clave, nombre: tipo.etiquetaDePestana, total: delTipo.length,
      borrador: cuantos('borrador'), enRevision: cuantos('enrevision'), ajustes: cuantos('ajustessolicitados'), publicados: cuantos('publicado'),
    };
  }));
  readonly totalDeProcesos = computed(() => this.filas().length);

  /** Los estados con algo, en una línea («1 en revisión · 2 publicados»). */
  resumenDeEstados(tipo: EstadoDeUnTipo): string {
    return [
      tipo.ajustes ? `${tipo.ajustes} con ajustes pedidos` : '',
      tipo.enRevision ? `${tipo.enRevision} en revisión` : '',
      tipo.borrador ? `${tipo.borrador} en borrador` : '',
      tipo.publicados ? `${tipo.publicados} ${tipo.publicados === 1 ? 'publicado' : 'publicados'}` : '',
    ].filter(Boolean).join(' · ');
  }

  /** El conteo de la organización por estado, para el informe: el mismo orden de la barra y de la leyenda. */
  readonly conteoGeneral = computed(() => {
    const todos = this.estadoPorTipo();
    const suma = (campo: 'publicados' | 'enRevision' | 'ajustes' | 'borrador') => todos.reduce((n, t) => n + t[campo], 0);
    return [
      { clave: 'publicado', etiqueta: 'Publicado', cantidad: suma('publicados') },
      { clave: 'revision', etiqueta: 'En revisión', cantidad: suma('enRevision') },
      { clave: 'ajustes', etiqueta: 'Ajustes pedidos', cantidad: suma('ajustes') },
      { clave: 'borrador', etiqueta: 'Borrador', cantidad: suma('borrador') },
    ];
  });
  porcentaje(cantidad: number): string {
    const total = this.totalDeProcesos();
    if (!total) return '0 %';
    const v = (cantidad / total) * 100;
    return `${Number.isInteger(v) ? v : v.toFixed(1).replace('.', ',')} %`;
  }
  readonly resumenDelInforme = computed(() => {
    const total = this.totalDeProcesos();
    const c = this.conteoGeneral();
    return `${total} ${total === 1 ? 'proceso' : 'procesos'}: ${c[0].cantidad} ${c[0].cantidad === 1 ? 'publicado' : 'publicados'}, ${c[1].cantidad} en revisión, ${c[2].cantidad} con ajustes pedidos y ${c[3].cantidad} en borrador.`;
  });
  /** Para el lector de pantalla de la barra de un tipo («1 con ajustes · 2 publicados»). */
  trozo(cantidad: number, total: number): number { return total ? (cantidad / total) * 100 : 0; }

  /** Los avisos de la cuenta sin leer que son de ESTA organización (o no dicen de cuál), el más nuevo primero. */
  readonly avisosSinLeer = signal<{ titulo: string; fecha: string }[]>([]);
  /** Las invitaciones al equipo que siguen por aceptar (solo se piden a quien administra). */
  readonly invitacionesPendientes = signal<{ correo: string; vence: string }[]>([]);
  /** Los eventos en borrador sin enviar, el más cercano primero. */
  readonly eventosEnBorrador = computed(() => this.eventos().filter(e => e.estado === 'borrador')
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)));

  /** Cuántas cosas esperan a la organización: el número del encabezado de «Requiere atención». */
  readonly totalDeAtencion = computed(() => this.porAtender().length + (this.avisosSinLeer().length ? 1 : 0)
    + (this.eventosEnBorrador().length ? 1 : 0) + (this.invitacionesPendientes().length ? 1 : 0));

  readonly nombreDeLaOrganizacion = computed(() => this.perfil()?.nombre
    ?? this.sesion.organizaciones().find(o => o.id === this.organizacionId())?.name ?? '');
  /** Las iniciales de la insignia: la primera letra de las dos primeras palabras que no son artículos ni preposiciones. */
  readonly iniciales = computed(() => this.nombreDeLaOrganizacion().split(/\s+/)
    .filter(p => !/^(de|del|la|las|los|el|y|e|para)$/i.test(p)).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '·');
  readonly ubicacion = computed(() => {
    const ficha = this.perfil();
    return ficha ? [ficha.nombreMunicipioSede, ficha.nombreDepartamentoSede].filter(Boolean).map(n => nombrePropio(n)).join(', ') : '';
  });
  readonly rotuloDelRol = computed(() => this.esAdministradora() ? 'Administrador' : 'Editor');

  /** Lo que ofrece «Crear»: lo mismo que antes eran accesos sueltos, ahora en un solo menú. */
  readonly accionesDeCrear = computed<AccionDeRegistro[]>(() => [
    { id: 'proceso', etiqueta: 'Registrar un proceso' },
    { id: 'evento', etiqueta: 'Anunciar un evento' },
    ...(this.esAdministradora() ? [{ id: 'persona', etiqueta: 'Invitar a una persona' }] : []),
  ]);
  crear(id: string): void {
    const destino = id === 'proceso' ? 'procesos' : id === 'evento' ? 'eventos' : 'equipo';
    void this.router.navigate(this.enPanel(destino));
  }

  /** «Abrir avisos» abre la campana de la cabecera, que es la dueña de los avisos (no se duplica su lista aquí). */
  abrirAvisos(): void {
    document.querySelector<HTMLButtonElement>('[data-testid="campana-avisos"]')?.click();
  }

  constructor() {
    effect(() => {
      const id = this.organizacionId();
      if (!id) return;
      this.cargar(id);
    });
  }

  /** Dice qué no se pudo leer. */
  readonly detalleDeLaFalla = computed(() => {
    const f = this.falla();
    return f ? `No se pudo leer: ${f.fuentes.join(', ')}. ${f.motivo}`.trim() : '';
  });

  /** Vuelve a pedir todo; es lo que hace «Reintentar». */
  reintentar(): void {
    const id = this.organizacionId();
    if (id) this.cargar(id);
  }

  rutaDeLaSolicitud(fila: SolicitudDeLaCuenta): string { return fila.ruta.split('?')[0]; }
  consultaDeLaSolicitud(fila: SolicitudDeLaCuenta): Record<string, string> | null {
    const [, texto] = fila.ruta.split('?');
    return texto ? Object.fromEntries(new URLSearchParams(texto)) : null;
  }

  private cargar(id: string): void {
    this.cargando.set(true);
    this.falla.set(null);
    // TODO se pide a la vez y un fallo de un tipo no tapa el inicio, pero TAMPOCO SE ESCONDE: la fuente que falla se
    // anota y la pantalla lo dice con su motivo, en vez de contar cero («no tienes procesos») por una caída del API.
    const fallidas: string[] = [];
    let motivo = '';
    const sinFallar = <T>(nombre: string, fuente: Observable<T[]>): Observable<T[]> =>
      fuente.pipe(catchError((fallo: unknown) => {
        fallidas.push(nombre);
        if (!motivo) { const m = motivoDeLaFalla(fallo); motivo = [m.mensaje, m.detalle].filter(Boolean).join(' '); }
        return of([] as T[]);
      }));
    forkJoin({
      festivales: sinFallar('festivales', this.api.obtenerFestivales(id)),
      mercados: sinFallar('mercados', this.api.obtenerMercados(id)),
      talleres: sinFallar('lutería', this.talleres.deLaOrganizacion(id)),
      espacios: sinFallar('espacios', this.espacios.deLaOrganizacion(id)),
      redes: sinFallar('redes', this.redes.deLaOrganizacion(id)),
      solicitudes: sinFallar('solicitudes', this.solicitudesApi.deLaOrganizacion(id)),
      eventos: sinFallar('eventos', this.eventosApi.eventosDeLaOrganizacion(id)),
    }).subscribe(r => {
      this.filas.set([
        ...r.festivales.map(f => ({ tipo: 'festivales' as const, estado: f.estado })),
        ...r.mercados.map(m => ({ tipo: 'mercados' as const, estado: m.estadoRegistro })),
        ...r.talleres.map(t => ({ tipo: 'luteria' as const, estado: t.estadoRegistro })),
        ...r.espacios.map(e => ({ tipo: 'espacios' as const, estado: e.estadoRegistro })),
        ...r.redes.map(x => ({ tipo: 'redes' as const, estado: x.estadoRegistro })),
      ]);
      this.solicitudes.set(r.solicitudes ?? []);
      this.eventos.set(r.eventos ?? []);
      this.falla.set(fallidas.length ? { fuentes: fallidas, motivo } : null);
      this.cargando.set(false);
    });
    this.api.obtenerPerfil(id).subscribe({ next: perfil => this.perfil.set(perfil), error: () => this.perfil.set(null) });
    // Los avisos y las invitaciones son señales de apoyo de «Requiere atención»: si no se leen, no se muestran
    // (la campana y Equipo siguen siendo la fuente), y no tapan el inicio con un error.
    this.avisosEnVivo.observar('externo', 50).pipe(take(1)).subscribe({
      next: pagina => this.avisosSinLeer.set((pagina?.items ?? [])
        .filter(a => !a.readAt && (!organizacionDelAviso(a) || organizacionDelAviso(a) === id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(a => ({ titulo: a.title, fecha: a.createdAt }))),
      error: () => this.avisosSinLeer.set([]),
    });
    if (this.esAdministradora()) {
      this.http.get<{ invitaciones: { correo: string; estado: string; fechaExpiracion: string }[] }>(
        `/api/v1/externo/organizaciones/${id}/equipo`, { errorFallback: 'No fue posible consultar el equipo.' }).subscribe({
        next: equipo => this.invitacionesPendientes.set((equipo?.invitaciones ?? []).filter(i => i.estado === 'pendiente')
          .map(i => ({ correo: i.correo, vence: i.fechaExpiracion }))),
        error: () => this.invitacionesPendientes.set([]),
      });
    } else this.invitacionesPendientes.set([]);
  }
}
