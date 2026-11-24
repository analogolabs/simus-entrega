import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogoDeFormularioComponent } from '../../shared/components/ui/dialogo-de-formulario/dialogo-de-formulario.component';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AnunciarEventoSolicitud,
  EventoDeLaOrganizacion,
  ProcesoQueEnmarca,
  ResultadoDeGuardarEvento,
} from './panel-organizacion.api';
import { AccionDeEvento, MAXIMO_DEL_MOTIVO_DE_EVENTO, accionesDeEvento } from '../../core/acciones/acciones-de-evento';
import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { EventosDeOrganizacionService } from './eventos-de-organizacion.service';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { RUTAS_DE_LA_CUENTA, rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { CatalogService, TerritorioConCodigo } from '../../core/services/catalog.service';
import { EntradaDeHistorialDeEstados, HistorialDeEstadosComponent } from '../../shared/components/ui/historial-de-estados/historial-de-estados.component';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { motivoDeLaAccion } from '../../core/formularios/traductor-de-errores';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
import { BarraDeHerramientasComponent } from '../../shared/components/ui/barra-de-herramientas/barra-de-herramientas.component';
import { OrdenDeListaComponent } from '../../shared/components/ui/orden-de-lista/orden-de-lista.component';
import { ColumnaOrdenable, EstadoDeOrden, alternarOrden, ordenarFilas } from '../../shared/components/ui/orden-de-lista/orden-de-lista';
import { CeldaDeTablaDirective, ColumnaDeGestion, DetalleDeFilaDirective, TablaDeGestionComponent } from '../../shared/components/ui/tabla-de-gestion/tabla-de-gestion.component';
import { AccionDeFila, AccionElegida } from '../../shared/components/ui/tabla-de-gestion/acciones-de-fila.component';
import { opcionesDeTipoDeProceso } from '../../shared/components/ui/barra-de-tipo/opciones-de-tipo';
import { BuscadorDeListaComponent } from '../../shared/components/ui/buscador/buscador-de-lista.component';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { EncabezadoDePantallaComponent } from '../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { OpcionDeFiltro } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';
/**
 * Los eventos que la organización anuncia sobre sus propios procesos.
 *
 * <b>NINGÚN EVENTO SIN PROCESO, Y ESA ES LA PANTALLA ENTERA.</b> Una organización no publica
 * eventos sueltos en la Agenda: publica eventos <b>de sus procesos</b> —su festival,
 * su mercado—. Si no tiene ninguno publicado, esta pantalla <b>no ofrece el formulario</b> y
 * explica por qué, en vez de dejar escribir un evento entero para rechazarlo al guardar por algo
 * que se sabía desde el principio.
 *
 * <b>BORRADOR → EN REVISIÓN → PUBLICADO.</b> Quien lo escribe puede guardarlo como borrador,
 * que solo ve su organización, y enviarlo después. No decide si se publica, y la pantalla lo dice
 * antes de enviar. Cambiar un evento publicado lo devuelve a revisión, y también se dice antes.
 *
 * <b>CINCO TIPOS DE PROCESO (LUT-01).</b> Festival, Mercado, Taller de lutería, Espacio para música en vivo y
 * Red: el desplegable dice el tipo de cada uno, y el identificador del formulario lleva el tipo delante
 * porque dos procesos de tipos distintos pueden tener el mismo número. Los tres últimos no tienen una
 * agenda aparte: se anuncian aquí, como eventos de la Agenda normal.
 *
 * <b>LA MISMA PANTALLA SIRVE A LA PERSONA SIN ORGANIZACIÓN.</b> Montada en `/gestion/cuenta/eventos` (con
 * `data.responsable = 'persona'`), anuncia eventos de SU taller, su espacio o su red con las mismas reglas
 * de errata, retiro y cancelación; solo cambia de quién es el proceso y adónde lleva «Ir a mis procesos».
 */

interface FormularioDeEvento {
  procesoId: string;
  titulo: string;
  descripcion: string;
  descripcionLarga: string;
  fechaInicio: string;
  fechaFin: string;
  conHoraInicio: boolean;
  horaInicio: string;
  conHoraFin: boolean;
  horaFin: string;
  modalidad: string;
  lugar: string;
  codigoDepartamento: string;
  codigoMunicipio: string;
  url: string;
  /** Guardar sin enviar a revisión. Solo se ofrece mientras el evento es un borrador. */
  borrador: boolean;
}

const VACIO: FormularioDeEvento = {
  procesoId: '', titulo: '', descripcion: '', descripcionLarga: '',
  fechaInicio: '', fechaFin: '', conHoraInicio: false, horaInicio: '',
  conHoraFin: false, horaFin: '', modalidad: 'presencial', lugar: '',
  codigoDepartamento: '', codigoMunicipio: '', url: '', borrador: false,
};

/** La clave del proceso en el formulario: `festival:12`, `mercado:7`, `taller:3`, `espacio:5` o `red:2`. */
function claveDeProceso(tipo: string, id: string | number): string {
  return `${tipo}:${id}`;
}

@Component({
  selector: 'app-panel-eventos',
  standalone: true,
  imports: [BarraDeHerramientasComponent, OrdenDeListaComponent, TablaDeGestionComponent, CeldaDeTablaDirective, DetalleDeFilaDirective, BuscadorDeListaComponent, EstadoDeListaComponent, EncabezadoDePantallaComponent, EsqueletoComponent, OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, BotonNativoDirective, FechaPipe, AvisoSoloAdministracionComponent, HistorialDeEstadosComponent, CommonModule, FormsModule, RouterLink, IndicadorDeEstadoComponent, DialogoDeFormularioComponent],
  templateUrl: './panel-eventos.component.html',
})
export class PanelEventosComponent implements OnInit {
  /** El tono y el matiz del indicador, desde el criterio único del proyecto. */
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  private readonly api = inject(EventosDeOrganizacionService);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);
  private readonly ruta = inject(ActivatedRoute);

  /** Anuncia una persona sin organización, desde «Mi espacio», y no una organización (LUT-01). */
  readonly esDePersona = this.ruta.snapshot.data['responsable'] === 'persona';

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  /** Adónde lleva «Ir a mis procesos»: el panel de procesos de la organización, o los de la persona en Mi espacio. */
  get enlaceDeProcesos(): string[] { return this.esDePersona ? [RUTAS_DE_LA_CUENTA.procesos] : this.enPanel('procesos'); }

  /**
   * Anunciar, abrir, editar y enviar un evento es de la administración: el servidor solo
   * deja al editor listarlos. Una persona sin organización no tiene roles: lo suyo es suyo.
   */
  readonly esAdministradora = this.esDePersona ? signal(true).asReadonly() : this.store.esAdministradora;
  private readonly catalogo = inject(CatalogService);

  readonly procesos = signal<ProcesoQueEnmarca[]>([]);
  readonly eventos = signal<EventoDeLaOrganizacion[]>([]);

  /**
   * PESTAÑAS POR TIPO DE PROCESO, ESTADO COMO FILTRO (PANEL, decisión 126): el evento se lee bajo el tipo del proceso
   * que lo enmarca —Festivales, Mercados, Redes, Lutería, Espacios— y su estado (borrador, en revisión, publicado…)
   * afina la lista con conteos, igual que en Procesos y Solicitudes.
   */
  readonly tipoFiltro = signal<string>('todos');
  readonly estadoFiltro = signal<string>('todos');
  private tipoDelEvento(e: EventoDeLaOrganizacion): string { return TIPO_DE_PROCESO_DEL_EVENTO[e.procesoTipo ?? ''] ?? 'otras'; }
  /** El texto del buscador (título, lugar o proceso). */
  readonly busqueda = signal('');
  private readonly coincidentes = computed(() => {
    const q = this.busqueda().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!q) return this.eventos();
    return this.eventos().filter(e => [e.titulo, e.lugar, e.procesoNombre].filter(Boolean).join(' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q));
  });
  readonly eventosDelEstado = computed(() => {
    const estado = this.estadoFiltro();
    return estado === 'todos' ? this.coincidentes() : this.coincidentes().filter(e => this.estadoVisible(e) === estado);
  });
  readonly conteosPorTipo = computed<Record<string, number>>(() => {
    const c: Record<string, number> = {};
    for (const e of this.eventosDelEstado()) { const t = this.tipoDelEvento(e); c[t] = (c[t] ?? 0) + 1; }
    return c;
  });
  readonly eventosVisibles = computed(() => {
    const tipo = this.tipoFiltro();
    const filas = tipo === 'todos' ? this.eventosDelEstado() : this.eventosDelEstado().filter(e => this.tipoDelEvento(e) === tipo);
    return ordenarFilas(filas, this.criteriosDeOrden, this.orden());
  });

  readonly alternarOrden = alternarOrden;
  readonly textoNoVacio = (t: unknown): boolean => typeof t === 'string' && t.trim() !== '';
  /** Las columnas de la tabla. */
  readonly columnas: readonly ColumnaDeGestion[] = [
    { id: 'nombre', etiqueta: 'Nombre' },
    { id: 'estado', etiqueta: 'Estado', ancho: 'estado' },
    { id: 'fecha', etiqueta: 'Fecha', ancho: 'fecha' },
  ];
  /** Qué se puede ordenar. «Estado» va por urgencia: lo devuelto o rechazado primero, lo ya publicado después. */
  readonly criteriosDeOrden: readonly ColumnaOrdenable<EventoDeLaOrganizacion>[] = [
    { id: 'fecha', etiqueta: 'Fecha', tipo: 'cerca', valor: e => e.fechaInicio },
    { id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', valor: e => e.titulo },
    { id: 'estado', etiqueta: 'Estado', tipo: 'rank', valor: e => URGENCIA_DEL_EVENTO[this.estadoVisible(e)] ?? 9 },
  ];
  /** Por omisión, lo más cercano primero (prototipo B4). */
  readonly orden = signal<EstadoDeOrden>({ columna: 'fecha', direccion: 'asc' });
  readonly claveDeEvento = (evento: EventoDeLaOrganizacion): string => evento.id;
  readonly tituloDe = (evento: EventoDeLaOrganizacion): string => evento.titulo;
  readonly opcionesDeTipo = computed(() => opcionesDeTipoDeProceso({ conteos: this.conteosPorTipo(), total: this.eventosDelEstado().length, conOtras: this.tipoFiltro() === 'otras' }));
  readonly hayFiltros = computed(() => !!this.busqueda().trim() || this.estadoFiltro() !== 'todos' || this.tipoFiltro() !== 'todos');
  quitarFiltros(): void { this.busqueda.set(''); this.estadoFiltro.set('todos'); this.tipoFiltro.set('todos'); }
  readonly opcionesDeEstado = computed<readonly OpcionDeFiltro[]>(() => {
    const tipo = this.tipoFiltro();
    const delTipo = this.coincidentes().filter(e => tipo === 'todos' || this.tipoDelEvento(e) === tipo);
    const cuenta = new Map<string, { etiqueta: string; n: number }>();
    for (const e of delTipo) {
      const clave = this.estadoVisible(e);
      cuenta.set(clave, { etiqueta: clave === 'cancelado' ? 'Cancelado' : e.estadoEtiqueta, n: (cuenta.get(clave)?.n ?? 0) + 1 });
    }
    return [{ id: 'todos', etiqueta: 'Todos', conteo: delTipo.length }, ...[...cuenta.entries()].map(([id, v]) => ({ id, etiqueta: v.etiqueta, conteo: v.n }))];
  });
  readonly contador = computed(() => {
    const n = this.eventos().length;
    if (!n) return null;
    const publicados = this.eventos().filter(e => e.estado === 'publicado' && !e.cancelado).length;
    return `${n} ${n === 1 ? 'evento' : 'eventos'} · ${publicados} ${publicados === 1 ? 'publicado' : 'publicados'}`;
  });
  readonly territorios = signal<TerritorioConCodigo[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly formulario = signal<FormularioDeEvento | null>(null);
  /** El evento que se está editando, o `null` si se anuncia uno nuevo. */
  readonly editando = signal<{ id: string; estado: string } | null>(null);
  /** El evento sobre el que hay una acción en vuelo (enviar, cancelar, retirar): las demás esperan. */
  readonly enviando = signal<string | null>(null);

  /**
   * La persona eligió el territorio del evento a mano. Mientras no lo haga, el formulario propone el
   * del proceso y lo acompaña si cambia de proceso (D3-14: se hereda por omisión, y se puede cambiar).
   */
  private readonly territorioElegido = signal(false);

  /** Las acciones que corresponden al estado de un evento, con su motivo si alguna está apagada. */
  accionesDe(evento: EventoDeLaOrganizacion): AccionDeEvento[] {
    return accionesDeEvento({
      titulo: evento.titulo,
      estado: evento.estado,
      cancelado: !!evento.cancelado,
      esAdministradora: this.esAdministradora(),
      ocupado: this.enviando() !== null,
    });
  }

  /**
   * Las acciones del menú de la fila: las del modelo por estado más «Ver historial» (que abre el historial debajo de la
   * fila). Cancelar y retirar van al final, separadas y en rojo; sus confirmaciones piden el motivo, obligatorio.
   */
  readonly accionesDeFila = (evento: EventoDeLaOrganizacion): readonly AccionDeFila[] => {
    const delModelo = this.accionesDe(evento).map<AccionDeFila>(a => ({
      id: a.id, etiqueta: a.etiqueta, tono: a.id === 'cancelar' ? 'peligro' : a.tono,
      deshabilitada: !a.habilitada, motivo: a.motivo,
      confirmacion: a.confirmacion ? { ...a.confirmacion, motivoObligatorio: true, ayudaDelMotivo: `Hasta ${MAXIMO_DEL_MOTIVO_DE_EVENTO} caracteres. Lo leerá quien consulte la agenda y queda en el historial.` } : undefined,
    }));
    const historial: AccionDeFila = { id: 'historial', etiqueta: this.historialAbierto() === evento.id ? 'Ocultar el historial' : 'Ver historial' };
    const peligro = delModelo.filter(a => a.tono === 'peligro');
    return [...delModelo.filter(a => a.tono !== 'peligro'), historial, ...peligro];
  };

  /** Atiende la acción del menú, que ya viene confirmada (con su motivo) si lo pedía. */
  async alElegirAccion(evento: EventoDeLaOrganizacion, elegida: AccionElegida): Promise<void> {
    switch (elegida.id) {
      case 'editar': await this.editar(evento); return;
      case 'enviar': await this.enviarARevision(evento); return;
      case 'historial': await this.alternarHistorial(evento); return;
      case 'cancelar':
      case 'retirar': await this.ejecutarConMotivo(elegida.id, evento, elegida.motivo); return;
    }
  }

  /** El estado que se pinta: un evento cancelado se ve cancelado, aunque el circuito lo tenga «publicado». */
  estadoVisible(evento: EventoDeLaOrganizacion): string { return evento.cancelado ? 'cancelado' : evento.estado; }

  /** Ejecuta la acción elegida; las que quitan algo del público piden su motivo antes. */
  async ejecutar(accion: AccionDeEvento, evento: EventoDeLaOrganizacion): Promise<void> {
    if (!accion.habilitada) { return; }
    switch (accion.id) {
      case 'editar': await this.editar(evento); return;
      case 'enviar': await this.enviarARevision(evento); return;
      case 'cancelar':
      case 'retirar': await this.confirmarYEjecutar(accion, evento); return;
    }
  }

  private async confirmarYEjecutar(accion: AccionDeEvento, evento: EventoDeLaOrganizacion): Promise<void> {
    const organizacion = this.organizacionId();
    if (organizacion === null || !accion.confirmacion) { return; }

    const respuesta = await this.confirmaciones.pedir({
      ...accion.confirmacion,
      motivoObligatorio: true,
      ayudaDelMotivo: `Hasta ${MAXIMO_DEL_MOTIVO_DE_EVENTO} caracteres. Lo leerá quien consulte la agenda y queda en el historial.`,
    });
    if (!respuesta) { return; }
    await this.ejecutarConMotivo(accion.id as 'cancelar' | 'retirar', evento, respuesta.motivo);
  }

  /** Cancela o retira con el motivo ya confirmado. */
  private async ejecutarConMotivo(accion: 'cancelar' | 'retirar', evento: EventoDeLaOrganizacion, motivoEscrito: string): Promise<void> {
    const organizacion = this.organizacionId();
    if (organizacion === null) { return; }
    const motivo = motivoEscrito.trim().slice(0, MAXIMO_DEL_MOTIVO_DE_EVENTO);
    this.enviando.set(evento.id);
    this.error.set(null);
    this.aviso.set(null);
    try {
      if (accion === 'cancelar') {
        await firstValueFrom(this.api.cancelarEvento(organizacion, evento.id, motivo));
        this.aviso.set(`«${evento.titulo}» quedó cancelado. Sigue en la agenda pública, marcado como cancelado y con tu motivo.`);
      } else {
        await firstValueFrom(this.api.retirarEvento(organizacion, evento.id, motivo));
        this.aviso.set(`«${evento.titulo}» salió de la agenda pública.`);
      }
      await this.cargar();
    } catch (fallo: unknown) {
      this.error.set(this.motivoDe(fallo));
    } finally {
      this.enviando.set(null);
    }
  }

  /** El evento cuyo historial está abierto, y sus filas. `null` en las filas: falló. */
  readonly historialAbierto = signal<string | null>(null);
  readonly historial = signal<EntradaDeHistorialDeEstados[] | null | undefined>(undefined);
  readonly cargandoHistorial = signal(false);

  /** Abre o cierra el historial de un evento, debajo de su fila. Se pide al abrirlo. */
  async alternarHistorial(evento: EventoDeLaOrganizacion): Promise<void> {
    if (this.historialAbierto() === evento.id) { this.historialAbierto.set(null); return; }
    const organizacion = this.organizacionId();
    if (organizacion === null) return;
    this.historialAbierto.set(evento.id);
    this.historial.set(undefined);
    this.cargandoHistorial.set(true);
    try {
      this.historial.set(await firstValueFrom(this.api.historial(organizacion, evento.id)) ?? []);
    } catch {
      this.historial.set(null);
    } finally {
      this.cargandoHistorial.set(false);
    }
  }

  /** Solo un borrador (o uno nuevo) puede seguir siendo borrador al guardarlo. */
  readonly puedeSerBorrador = computed(() => {
    const e = this.editando();
    return !e || e.estado === 'borrador';
  });

  readonly tituloDelDialogo = computed(() => this.editando() ? 'Editar evento' : 'Anunciar un evento');

  readonly propositoDelDialogo = computed(() => {
    if (this.editando()?.estado === 'publicado') {
      // LA ERRATA SE CORRIGE AL INSTANTE; EL CAMBIO DE FONDO VUELVE A REVISIÓN (D3-12). Se dice antes
      // de guardar, para que nadie se sorprenda de que su evento salga de la agenda.
      return 'Este evento ya está publicado. Si corriges ortografía o redacción, se aplica al instante y sigue en la agenda. ' +
        'Si cambias la fecha, la hora, el lugar, el territorio, la modalidad, el enlace o el proceso, o reescribes el título o la descripción, ' +
        'volverá a revisión y saldrá de la agenda hasta que el PNMC lo apruebe.';
    }
    return this.formulario()?.borrador
      ? 'Se guardará como borrador: solo lo ve tu organización hasta que lo envíes a revisión.'
      : 'Tu evento quedará en revisión: aparecerá en la agenda pública cuando el PNMC lo apruebe.';
  });

  readonly verboDelDialogo = computed(() => {
    if (this.editando()?.estado === 'publicado') { return 'Guardar cambios'; }
    return this.formulario()?.borrador && this.puedeSerBorrador() ? 'Guardar borrador' : 'Enviar a revisión';
  });

  /** El proceso elegido en el formulario, para proponer su territorio y decir de dónde viene. */
  readonly procesoElegido = computed(() => {
    const clave = this.formulario()?.procesoId;
    return clave ? this.procesos().find(p => claveDeProceso(p.tipo, p.id) === clave) ?? null : null;
  });

  /** El proceso tiene territorio que proponer (un Festival nacional no tiene). */
  readonly procesoConTerritorio = computed(() => !!this.procesoElegido()?.codigoDepartamento);

  /** El territorio del formulario es el del proceso: el formulario lo dice y deja cambiarlo (D3-14). */
  readonly esElTerritorioDelProceso = computed(() => {
    const f = this.formulario();
    const proceso = this.procesoElegido();
    if (!f || !proceso?.codigoDepartamento) { return false; }
    return f.codigoDepartamento === proceso.codigoDepartamento
      && (f.codigoMunicipio || '') === (proceso.codigoMunicipio ?? '');
  });

  /** Vuelve al territorio del proceso, después de haber elegido otro. */
  usarElTerritorioDelProceso(): void {
    const proceso = this.procesoElegido();
    const actual = this.formulario();
    if (!proceso || !actual) { return; }
    this.territorioElegido.set(false);
    this.formulario.set({
      ...actual,
      codigoDepartamento: proceso.codigoDepartamento ?? '',
      codigoMunicipio: proceso.codigoMunicipio ?? '',
    });
  }

  /** Sin procesos publicados no hay nada que enmarcar, y la pantalla lo dice. */
  readonly puedeAnunciar = computed(() => this.procesos().length > 0);

  readonly municipiosDelDepartamento = computed(() => {
    const codigo = this.formulario()?.codigoDepartamento ?? '';
    if (!codigo) { return []; }
    return this.territorios().find(t => t.codigo === codigo)?.municipios ?? [];
  });

  /** Qué le falta al formulario. Se dice mientras se escribe, no al pulsar el botón. */
  readonly loQueFalta = computed(() => {
    const f = this.formulario();
    if (!f) { return []; }
    const faltas: string[] = [];
    if (!f.procesoId) { faltas.push('el proceso en el que se enmarca'); }
    if (!f.titulo.trim()) { faltas.push('el título'); }
    if (!f.descripcion.trim()) { faltas.push('la descripción'); }
    if (!f.fechaInicio) { faltas.push('la fecha de inicio'); }
    if ((f.modalidad === 'presencial' || f.modalidad === 'mixta') && !f.lugar.trim()) { faltas.push('el lugar'); }
    if ((f.modalidad === 'virtual' || f.modalidad === 'mixta') && !f.url.trim()) { faltas.push('el enlace'); }
    return faltas;
  });

  /** Las fechas y horas que no tienen sentido, dichas al lado de los campos. */
  readonly problemasDeFecha = computed(() => {
    const f = this.formulario();
    if (!f) { return []; }
    const problemas: string[] = [];
    if (f.fechaInicio && f.fechaFin && f.fechaFin < f.fechaInicio) {
      problemas.push('El evento no puede terminar antes de empezar.');
    }
    const mismoDia = !f.fechaFin || f.fechaFin === f.fechaInicio;
    if (mismoDia && f.conHoraInicio && f.conHoraFin && f.horaInicio && f.horaFin && f.horaFin < f.horaInicio) {
      problemas.push('La hora de fin no puede ser anterior a la de inicio.');
    }
    return problemas;
  });

  async ngOnInit(): Promise<void> {
    this.catalogo.fetchDivipolaConCodigos().subscribe({
      next: territorios => this.territorios.set(territorios),
      error: () => this.territorios.set([]),
    });
    await this.cargar();
  }

  private organizacionId(): string | null {
    // UNA PERSONA SIN ORGANIZACIÓN NO TIENE IDENTIFICADOR: la cadena vacía le dice al servicio que use la
    // dirección de «Mis eventos» (LUT-01).
    if (this.esDePersona) { return ''; }
    // EL IDENTIFICADOR DE LA ORGANIZACION ACTIVA lo mantiene el armazón del panel: quien tiene
    // varias elige una, y todas las pantallas leen la misma.
    return this.store.organizacionId() || null;
  }

  /** El rótulo de un tipo de proceso («Taller de lutería»), para decir de qué clase es el evento de la lista. */
  etiquetaDelProceso(tipo: string | null | undefined): string {
    return tipo ? ETIQUETAS_DE_PROCESO[tipo] ?? '' : '';
  }

  async cargar(): Promise<void> {
    const organizacion = this.organizacionId();
    if (organizacion === null) { this.cargando.set(false); return; }

    this.cargando.set(true);
    this.error.set(null);
    try {
      const [procesos, eventos] = await Promise.all([
        firstValueFrom(this.api.procesosQueEnmarcan(organizacion)),
        firstValueFrom(this.api.eventosDeLaOrganizacion(organizacion)),
      ]);
      this.procesos.set(procesos ?? []);
      this.eventos.set(eventos ?? []);
    } catch {
      this.error.set('No fue posible consultar tus eventos.');
    } finally {
      this.cargando.set(false);
    }
  }

  nuevo(): void {
    this.aviso.set(null);
    this.error.set(null);
    // SI SOLO HAY UN PROCESO, YA VIENE ELEGIDO: obligar a elegir en una lista de uno es pedir una
    // decisión que no existe.
    const solo = this.procesos().length === 1 ? this.procesos()[0] : null;
    const unico = solo ? claveDeProceso(solo.tipo, solo.id) : '';
    this.editando.set(null);
    this.territorioElegido.set(false);
    // EL EVENTO HEREDA EL TERRITORIO DE SU PROCESO POR OMISIÓN (D3-14): si el proceso ya está elegido,
    // el formulario lo trae puesto; la persona puede cambiarlo.
    this.formulario.set({
      ...VACIO,
      procesoId: unico,
      codigoDepartamento: solo?.codigoDepartamento ?? '',
      codigoMunicipio: solo?.codigoMunicipio ?? '',
      fechaInicio: new Date().toISOString().slice(0, 10),
    });
  }

  claveDe(proceso: ProcesoQueEnmarca): string { return claveDeProceso(proceso.tipo, proceso.id); }

  async editar(evento: EventoDeLaOrganizacion): Promise<void> {
    const organizacion = this.organizacionId();
    if (organizacion === null) { return; }
    this.aviso.set(null);
    this.error.set(null);
    try {
      const d = await firstValueFrom(this.api.evento(organizacion, evento.id));
      const proceso = d.festivalId != null
        ? claveDeProceso('festival', d.festivalId)
        : d.mercadoId != null ? claveDeProceso('mercado', d.mercadoId)
        : d.tallerId != null ? claveDeProceso('taller', d.tallerId)
        : d.espacioId != null ? claveDeProceso('espacio', d.espacioId)
        : d.redId != null ? claveDeProceso('red', d.redId) : '';
      this.editando.set({ id: d.id, estado: d.estado });
      // UN EVENTO QUE YA EXISTE CONSERVA SU TERRITORIO: no se reemplaza por el del proceso al abrirlo.
      this.territorioElegido.set(true);
      this.formulario.set({
        procesoId: proceso,
        titulo: d.titulo,
        descripcion: d.descripcion,
        descripcionLarga: d.descripcionLarga ?? '',
        fechaInicio: d.fechaInicio,
        fechaFin: d.fechaFin ?? '',
        conHoraInicio: !!d.horaInicio,
        horaInicio: (d.horaInicio ?? '').slice(0, 5),
        conHoraFin: !!d.horaFin,
        horaFin: (d.horaFin ?? '').slice(0, 5),
        modalidad: d.modalidad,
        lugar: d.lugar ?? '',
        codigoDepartamento: d.codigoDepartamento ?? '',
        codigoMunicipio: d.codigoMunicipio ?? '',
        url: d.url ?? '',
        borrador: d.estado === 'borrador',
      });
    } catch (fallo: unknown) {
      this.error.set(this.motivoDe(fallo));
    }
  }

  /** Envía a revisión un borrador tal como está. */
  async enviarARevision(evento: EventoDeLaOrganizacion): Promise<void> {
    const organizacion = this.organizacionId();
    if (organizacion === null || evento.estado !== 'borrador') { return; }
    this.enviando.set(evento.id);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await firstValueFrom(this.api.enviarARevision(organizacion, evento.id));
      this.aviso.set('Tu evento quedó enviado. Aparecerá en la agenda cuando el PNMC lo revise.');
      await this.cargar();
    } catch (fallo: unknown) {
      this.error.set(this.motivoDe(fallo));
    } finally {
      this.enviando.set(null);
    }
  }

  cerrar(): void { this.formulario.set(null); this.editando.set(null); }

  campo<K extends keyof FormularioDeEvento>(clave: K, valor: FormularioDeEvento[K]): void {
    const actual = this.formulario();
    if (!actual) { return; }

    // ELEGIR EL PROCESO PROPONE SU TERRITORIO mientras la persona no haya elegido uno propio (D3-14).
    if (clave === 'procesoId' && !this.territorioElegido()) {
      const proceso = this.procesos().find(p => claveDeProceso(p.tipo, p.id) === valor);
      this.formulario.set({
        ...actual,
        procesoId: valor as string,
        codigoDepartamento: proceso?.codigoDepartamento ?? '',
        codigoMunicipio: proceso?.codigoMunicipio ?? '',
      });
      return;
    }

    if (clave === 'codigoMunicipio') { this.territorioElegido.set(true); }
    this.formulario.set({ ...actual, [clave]: valor });
  }

  cambiarDepartamento(codigo: string): void {
    const actual = this.formulario();
    if (!actual) { return; }
    this.territorioElegido.set(true);
    this.formulario.set({ ...actual, codigoDepartamento: codigo, codigoMunicipio: '' });
  }

  /**
   * Marca o desmarca la hora de inicio, y arrastra la de fin.
   *
   * SIN HORA DE INICIO NO HAY HORA DE FIN: un evento que acaba a una hora y no empieza a ninguna es
   * un dato que nadie puede leer. Es la misma regla que la consola.
   */
  cambiarHoraDeInicio(activada: boolean): void {
    const actual = this.formulario();
    if (!actual) { return; }
    this.formulario.set(activada
      ? { ...actual, conHoraInicio: true }
      : { ...actual, conHoraInicio: false, horaInicio: '', conHoraFin: false, horaFin: '' });
  }

  async anunciar(): Promise<void> {
    const f = this.formulario();
    const organizacion = this.organizacionId();
    if (!f || organizacion === null) { return; }

    if (this.problemasDeFecha().length > 0) {
      this.error.set(this.problemasDeFecha().join(' '));
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);

    const solicitud: AnunciarEventoSolicitud = {
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim(),
      descripcionLarga: f.descripcionLarga.trim() || null,
      fechaInicio: f.fechaInicio,
      fechaFin: f.fechaFin || null,
      // SI LA CASILLA ESTA SIN MARCAR, NO HAY HORA, aunque haya quedado un valor de antes.
      horaInicio: f.conHoraInicio ? (f.horaInicio || null) : null,
      horaFin: f.conHoraFin ? (f.horaFin || null) : null,
      modalidad: f.modalidad,
      lugar: f.lugar.trim() || null,
      codigoDepartamento: f.codigoDepartamento || null,
      codigoMunicipio: f.codigoMunicipio || null,
      url: f.url.trim() || null,
      ...procesoDeLaSolicitud(f.procesoId),
      borrador: f.borrador && this.puedeSerBorrador(),
    };

    const editando = this.editando();
    try {
      const resultado: ResultadoDeGuardarEvento = editando
        ? await firstValueFrom(this.api.editarEvento(organizacion, editando.id, solicitud))
        : await firstValueFrom(this.api.anunciarEvento(organizacion, solicitud));
      this.aviso.set(mensajeDeGuardado(resultado, editando?.estado === 'publicado'));
      this.formulario.set(null);
      this.editando.set(null);
      await this.cargar();
    } catch (fallo: unknown) {
      this.error.set(this.motivoDe(fallo));
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * El motivo que devolvió el servidor, y no uno genérico.
   *
   * <b>«REVISA LOS CAMPOS» SOBRE UNOS CAMPOS QUE ESTABAN BIEN.</b> Esto se tragaba la respuesta
   * entera: el servidor decía exactamente qué pasaba —un proceso que no es tuyo, una hora de fin
   * sin hora de inicio, un municipio sin departamento— y la pantalla lo cambiaba por una frase que
   * manda a buscar un error donde no lo hay. se detectó el 15 de septiembre
   * de 2026 sobre un evento que fallaba por una columna que este canal no escribía.
   *
   * El respaldo genérico se queda para lo que de verdad no trae motivo —una red caída—, y dice que
   * no se pudo enviar, no que haya que revisar nada.
   */
  private motivoDe(fallo: unknown): string {
    return motivoDeLaAccion(fallo, 'No fue posible enviar el evento. Inténtalo de nuevo en un momento.');
  }
}

/**
 * Qué le pasó al evento al guardarlo, dicho con claridad (D3-12).
 *
 * <b>UN EVENTO PUBLICADO SE CORRIGE AL INSTANTE O VUELVE A REVISIÓN, Y LA PERSONA TIENE QUE
 * SABERLO.</b> Que el evento salga de la agenda sin explicación es lo peor que puede pasarle a quien
 * solo quería corregir una letra; por eso el servidor dice qué cambió de fondo y aquí se repite.
 */
export function mensajeDeGuardado(resultado: ResultadoDeGuardarEvento, eraPublicado: boolean): string {
  if (eraPublicado && resultado.esErrata) {
    return 'Corregimos el evento. Sigue en la agenda pública, sin esperar revisión.';
  }
  if (eraPublicado && resultado.estado === 'en_revision') {
    const cambios = resultado.cambiosDeFondo ?? [];
    const queCambio = cambios.length > 0 ? ` porque cambió ${enProsa(cambios)}` : '';
    return `Tu evento volvió a revisión${queCambio}. Saldrá de la agenda hasta que el PNMC lo apruebe.`;
  }
  return resultado.estado === 'borrador'
    ? 'Guardamos tu borrador. Solo lo ve tu organización hasta que lo envíes a revisión.'
    : 'Tu evento quedó enviado. Aparecerá en la agenda cuando el PNMC lo revise.';
}

/** «la fecha», «la fecha y el lugar», «la fecha, la hora y el lugar». */
function enProsa(partes: string[]): string {
  if (partes.length <= 1) { return partes[0] ?? ''; }
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** De la clave del servidor al tipo del catálogo común de procesos. */
/** La urgencia del estado de un evento, para ordenar por «Estado»: lo que pide acción primero. */
const URGENCIA_DEL_EVENTO: Record<string, number> = { rechazado: 0, borrador: 1, en_revision: 2, publicado: 3, cancelado: 4, archivado: 5 };

const TIPO_DE_PROCESO_DEL_EVENTO: Record<string, string> = {
  festival: 'festivales', mercado: 'mercados', taller: 'luteria', espacio: 'espacios', red: 'redes',
};

/** Los rótulos de los cinco tipos de proceso que enmarcan un evento (LUT-01). */
const ETIQUETAS_DE_PROCESO: Record<string, string> = {
  festival: 'Festival',
  mercado: 'Mercado',
  taller: 'Taller de lutería',
  espacio: 'Espacio para música en vivo',
  red: 'Red y documentación',
};

/** Traduce la clave del formulario al campo que espera el servidor: exactamente uno de los cinco. */
function procesoDeLaSolicitud(clave: string): Pick<AnunciarEventoSolicitud, 'festivalId' | 'mercadoId' | 'tallerId' | 'espacioId' | 'redId'> {
  const [tipo, id] = clave.split(':');
  const numero = Number(id);
  return {
    festivalId: tipo === 'festival' ? numero : null,
    mercadoId: tipo === 'mercado' ? numero : null,
    tallerId: tipo === 'taller' ? numero : null,
    espacioId: tipo === 'espacio' ? numero : null,
    redId: tipo === 'red' ? numero : null,
  };
}
