import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { CommonModule } from '@angular/common';
import { ConfirmacionComponent } from '../../shared/components/ui/confirmacion/confirmacion.component';
import { Component, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  EdicionDeMercadoDeLaOrganizacion,
  FalloDelServidor,
  GuardarEdicionDeMercadoSolicitud,
  PanelOrganizacionApi,
} from './panel-organizacion.api';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { AccionDeRegistro, MenuDeAccionesComponent } from '../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';
import { ETIQUETAS_ESTADO_EDICION, ETIQUETAS_VISIBILIDAD_EDICION } from '../../core/services/mercados.service';
import { BotonComponent } from '../../shared/components/ui/boton/boton.component';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import { AgendamientoDeCitasService, EdicionConAgenda, etiquetaDeEstadoDeAgenda, tonoDeEstadoDeAgenda } from '../../core/services/agendamiento-de-citas.service';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { formatearRango } from '../../shared/utils/formatos-de-fecha';
import { motivoDeLaAccion } from '../../core/formularios/traductor-de-errores';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { rotuloDeEstado } from '../../core/vocabularios/estados';
/** Los dos ejes de estado de una edición, con la palabra que se enseña. */
const REALIZACION = [
  { id: 'en_preparacion', etiqueta: 'En preparación' },
  { id: 'programada', etiqueta: 'Programada' },
  { id: 'realizada', etiqueta: 'Realizada' },
  { id: 'cancelada', etiqueta: 'Cancelada' },
];

/**
 * Las ediciones de un mercado, desde el panel de su organización.
 *
 * <b>LA RUTA EXISTIA DESDE EL PRIMER CORTE DEL MODULO y solo la usaba la consola</b>: la
 * organización podía registrar su mercado y no podía anunciar ninguna de sus realizaciones sin que
 * el PNMC se la creara. Es la pareja de `app-ediciones-temporales` de Festivales.
 *
 * <b>SOLO SOBRE UN MERCADO PUBLICADO</b>, que es la regla del servidor: una edición de algo que
 * todavía no existe para nadie no tiene dónde aparecer. Se dice en pantalla en vez de dejar un
 * botón que responde 409.
 *
 * <b>DOS EJES DE ESTADO, Y NO SE CONFUNDEN.</b> La realización dice qué pasó con el acontecimiento
 * —en preparación, programada, realizada, cancelada— y la visibilidad dice si el público la ve. Un
 * mercado cancelado que sigue publicado es información legítima.
 */
@Component({
  selector: 'app-ediciones-de-mercado',
  standalone: true,
  imports: [CampoDeSeleccionComponent, BotonNativoDirective, AvisoSoloAdministracionComponent, 
    BotonComponent,
    EstadoDeListaComponent,CommonModule, FormsModule, RouterLink, IndicadorDeEstadoComponent, MenuDeAccionesComponent, ConfirmacionComponent],
  templateUrl: './ediciones-de-mercado.component.html',
})
export class EdicionesDeMercadoComponent implements OnChanges {
  @Input({ required: true }) mercadoId!: string;
  @Input({ required: true }) mercadoPublicado = false;
  /** Publicar, retirar del portal, archivar y eliminar son de la administración. */
  @Input() esAdministradora = true;

  private readonly api = inject(PanelOrganizacionApi);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);
  private readonly agendas = inject(AgendamientoDeCitasService);
  private readonly store = inject(PanelOrganizacionStore);

  /** La agenda de citas de cada edición (herramienta del Mercado, docs/referencia/26-agenda-de-citas-y-mercados.md): estado y a dónde llevar. */
  readonly agendaPorEdicion = signal<ReadonlyMap<number, EdicionConAgenda>>(new Map());

  readonly ediciones = signal<EdicionDeMercadoDeLaOrganizacion[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly formulario = signal<(GuardarEdicionDeMercadoSolicitud & { id: number | null }) | null>(null);

  readonly REALIZACION = REALIZACION;
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  /** El año que se propone para una edición nueva: el actual, que es el caso común. */
  readonly anioPorOmision = computed(() => new Date().getFullYear());

  ngOnChanges(): void { if (this.mercadoId) this.cargar(); }

  agendaDe(edicionId: number): EdicionConAgenda | null { return this.agendaPorEdicion().get(edicionId) ?? null; }
  etiquetaDeLaAgenda(estado: string): string { return etiquetaDeEstadoDeAgenda(estado); }
  tonoDeLaAgenda(estado: string) { return tonoDeEstadoDeAgenda(estado); }
  rutaDeLaAgenda(edicion: EdicionConAgenda): (string | number)[] {
    const org = this.store.organizacionId();
    return edicion.agendaId
      ? rutaDelPanel(org, 'procesos/mercados', edicion.mercadoId, 'agenda-de-citas', edicion.agendaId)
      : rutaDelPanel(org, 'procesos/mercados', edicion.mercadoId, 'agenda-de-citas/nueva', edicion.edicionId);
  }
  rutaDeLaAgendaPorId(edicion: EdicionConAgenda, agendaId: number): (string | number)[] {
    return rutaDelPanel(this.store.organizacionId(), 'procesos/mercados', edicion.mercadoId, 'agenda-de-citas', agendaId);
  }
  rutaParaNuevaAgenda(edicion: EdicionConAgenda): (string | number)[] {
    return rutaDelPanel(this.store.organizacionId(), 'procesos/mercados', edicion.mercadoId, 'agenda-de-citas/nueva', edicion.edicionId);
  }
  puedeHabilitarLaAgenda(edicion: EdicionConAgenda): boolean {
    return edicion.estadoEdicion === 'en_preparacion' || edicion.estadoEdicion === 'programada';
  }

  private cargarAgendas(): void {
    const org = this.store.organizacionId();
    if (!org) return;
    this.agendas.edicionesConAgenda(org).subscribe({
      next: filas => this.agendaPorEdicion.set(new Map(filas.filter(f => String(f.mercadoId) === this.mercadoId).map(f => [f.edicionId, f]))),
      error: () => this.agendaPorEdicion.set(new Map()),
    });
  }

  cargar(): void {
    this.cargarAgendas();
    this.cargando.set(true);
    this.error.set('');
    this.api.obtenerEdicionesDeMercado(this.mercadoId).subscribe({
      next: filas => { this.ediciones.set(filas ?? []); this.cargando.set(false); },
      error: (fallo: FalloDelServidor) => {
        this.cargando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible consultar las ediciones.');
      },
    });
  }

  etiquetaDeRealizacion(estado: string): string { return ETIQUETAS_ESTADO_EDICION[estado] ?? rotuloDeEstado(estado); }
  etiquetaDeVisibilidad(estado: string): string { return ETIQUETAS_VISIBILIDAD_EDICION[estado] ?? rotuloDeEstado(estado); }

  nombreDe(edicion: EdicionDeMercadoDeLaOrganizacion): string {
    return edicion.nombre || (edicion.numeroEdicion ? `Edición ${edicion.numeroEdicion}` : `Edición ${edicion.anio}`);
  }

  fechasDe(edicion: EdicionDeMercadoDeLaOrganizacion): string {
    return formatearRango(edicion.fechaInicio, edicion.fechaFin) || String(edicion.anio);
  }

  /**
   * Lo que se puede hacer con esta edición.
   *
   * PUBLICAR Y RETIRAR SON LA MISMA DECISION EN DOS SENTIDOS, y solo se ofrece la que aplica: una
   * edición ya publicada no se «publica» otra vez.
   */
  /**
   * Lo que se puede hacer con esta edición, según dónde esté de su ciclo.
   *
   * <b>ARCHIVADA NO OFRECE NADA MAS QUE MIRARLA.</b> Se archiva lo que ya no va a volver, y
   * reabrirlo sin dejar constancia de que se reabrió es peor que no poder reabrirlo. Y
   * <b>eliminar solo aparece sobre lo que nunca llegó al portal</b>: lo que se publicó alguna vez
   * se archiva, porque borrarlo dejaría su rastro en la bitácora apuntando a un registro que ya no
   * existe. Las dos reglas las impone el servidor; aquí se dicen antes de pulsar.
   */
  accionesDe(edicion: EdicionDeMercadoDeLaOrganizacion): AccionDeRegistro[] {
    if (edicion.estadoVisibilidad === 'archivado') return [];

    const acciones: AccionDeRegistro[] = [{ id: 'editar', etiqueta: 'Editar', tono: 'principal' }];
    if (!this.esAdministradora) return acciones;
    if (edicion.estadoVisibilidad === 'publicado') {
      acciones.push({ id: 'despublicar', etiqueta: 'Despublicar' });
    } else {
      acciones.push({ id: 'publicar', etiqueta: 'Publicar' });
    }
    acciones.push({ id: 'archivar', etiqueta: 'Archivar' });
    if (edicion.estadoVisibilidad === 'borrador') {
      acciones.push({ id: 'eliminar', etiqueta: 'Eliminar', tono: 'peligro' });
    }
    return acciones;
  }

  async ejecutarAccion(edicion: EdicionDeMercadoDeLaOrganizacion, accion: string): Promise<void> {
    if (accion === 'editar') { this.editar(edicion); return; }
    if (accion === 'eliminar') { this.eliminacionPedida.set(edicion); return; }
    if (accion !== 'publicar' && accion !== 'despublicar' && accion !== 'archivar') return;

    // PUBLICAR Y ARCHIVAR PREGUNTAN ANTES, en el diálogo común: antes se hacían de un clic.
    if (accion === 'publicar' || accion === 'archivar') {
      const nombre = edicion.nombre || `Edición ${edicion.numeroEdicion ?? ''}`.trim();
      const respuesta = await this.confirmaciones.pedir(accion === 'publicar'
        ? {
            titulo: `Publicar «${nombre}»`,
            detalle: 'La edición saldrá en el portal público. La publica la organización directamente; podrás despublicarla cuando quieras.',
            accion: 'Publicar',
            tono: 'confirmar',
          }
        : {
            titulo: `Archivar «${nombre}»`,
            detalle: 'La edición deja de verse en el portal y sale del trabajo diario. Conserva su historial.',
            accion: 'Archivar',
            tono: 'destructiva',
          });
      if (!respuesta) return;
    }

    const avisos: Record<string, string> = {
      publicar: 'La edición quedó publicada en el portal.',
      despublicar: 'La edición se retiró del portal y volvió a borrador.',
      archivar: 'La edición quedó archivada.',
    };

    this.guardando.set(true);
    this.error.set('');
    this.api.cambiarVisibilidadDeEdicionDeMercado(this.mercadoId, edicion.id, accion).subscribe({
      next: () => {
        this.guardando.set(false);
        this.aviso.set(avisos[accion]);
        this.cargar();
      },
      error: (fallo: FalloDelServidor) => {
        this.guardando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible cambiar la edición.');
      },
    });
  }

  /**
   * La edición que se está a punto de borrar.
   *
   * SE CONFIRMA EN UNA VENTANA DE VERDAD y no con un `window.confirm`: es la única acción de esta
   * pantalla que no se deshace, y es justo donde peor está un diálogo del navegador.
   */
  readonly eliminacionPedida = signal<EdicionDeMercadoDeLaOrganizacion | null>(null);

  cancelarLaEliminacion(): void { this.eliminacionPedida.set(null); }

  eliminarLaEdicion(): void {
    const edicion = this.eliminacionPedida();
    if (!edicion) return;

    this.guardando.set(true);
    this.error.set('');
    this.api.eliminarEdicionDeMercado(this.mercadoId, edicion.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.eliminacionPedida.set(null);
        this.aviso.set('La edición se eliminó.');
        this.cargar();
      },
      error: (fallo: FalloDelServidor) => {
        this.guardando.set(false);
        this.eliminacionPedida.set(null);
        this.error.set(fallo?.message ?? 'No fue posible eliminar la edición.');
      },
    });
  }

  nueva(): void {
    this.aviso.set('');
    this.error.set('');
    this.formulario.set({
      id: null,
      anio: this.anioPorOmision(),
      numeroEdicion: null,
      nombre: null,
      descripcion: null,
      fechaInicio: null,
      fechaFin: null,
      // EL TERRITORIO SE HEREDA DEL MERCADO si no se dice otra cosa: lo resuelve el servidor, que
      // es quien conoce la fila. Aquí no se copia para no tener dos verdades.
      codigoDepartamento: null,
      codigoMunicipio: null,
      lugarEspecifico: null,
      estado: 'en_preparacion',
      estadoVisibilidad: 'borrador',
    });
  }

  editar(edicion: EdicionDeMercadoDeLaOrganizacion): void {
    this.aviso.set('');
    this.error.set('');
    this.formulario.set({ id: edicion.id, ...this.aSolicitud(edicion) });
  }

  cerrar(): void { this.formulario.set(null); }

  campo<K extends keyof GuardarEdicionDeMercadoSolicitud>(clave: K, valor: GuardarEdicionDeMercadoSolicitud[K]): void {
    this.formulario.update(actual => (actual ? { ...actual, [clave]: valor } : actual));
  }

  guardar(): void {
    const f = this.formulario();
    if (!f) return;
    const { id, ...solicitud } = f;
    this.guardarEdicion(id, solicitud, id === null ? 'La edición quedó registrada.' : 'Cambios guardados.');
  }

  private guardarEdicion(id: number | null, solicitud: GuardarEdicionDeMercadoSolicitud, exito: string): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    const peticion = id === null
      ? this.api.crearEdicionDeMercado(this.mercadoId, solicitud)
      : this.api.guardarEdicionDeMercado(this.mercadoId, id, solicitud);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.formulario.set(null);
        this.aviso.set(exito);
        this.cargar();
      },
      error: (fallo: FalloDelServidor) => {
        this.guardando.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  private aSolicitud(edicion: EdicionDeMercadoDeLaOrganizacion): GuardarEdicionDeMercadoSolicitud {
    return {
      anio: edicion.anio,
      numeroEdicion: edicion.numeroEdicion,
      nombre: edicion.nombre,
      descripcion: edicion.descripcion,
      fechaInicio: edicion.fechaInicio,
      fechaFin: edicion.fechaFin,
      codigoDepartamento: edicion.codigoDepartamento,
      codigoMunicipio: edicion.codigoMunicipio,
      lugarEspecifico: edicion.lugarEspecifico,
      estado: edicion.estado,
      estadoVisibilidad: edicion.estadoVisibilidad,
    };
  }

  /**
   * El motivo que devolvió el servidor, y no uno genérico.
   *
   * «Este mercado ya tiene una edición de 2026» dice exactamente qué hacer; «no fue posible» manda
   * a adivinar. Es la misma decisión que tomó la ficha del mercado.
   */
  private motivoDe(fallo: unknown): string {
    return motivoDeLaAccion(fallo, 'No fue posible completar la acción.');
  }
}
