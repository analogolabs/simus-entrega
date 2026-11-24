import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FestivalDeLaOrganizacion } from './panel-organizacion.api';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import {
  EstadoFestival,
  EstadoPropuesta,
  estadoDeLaPropuesta,
  estadoDelFestival,
  etiquetaDeLaPropuesta,
  etiquetaDelFestival,
} from './estados-del-festival';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { AccionDeMenu, accionesDeProceso, comoAccionesDeMenu } from '../../core/acciones/acciones-por-estado';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { MenuDeAccionesComponent } from '../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
/**
 * La lista de Festivales de una organización, con las acciones que admite cada estado.
 *
 * QUÉ RESCATA. La línea 213 de
 * `simus-web/src/app/features/external-access/external-access-page.component.html`:
 * 4.024 caracteres en un solo renglón, con un `@for` cuyo cuerpo son once `@if` anidados.
 * Ahí vivían los seis estados de la máquina (los cinco del Festival más el ciclo propio de
 * la propuesta de cambios) y no había forma de leerlos ni de probarlos por separado.
 *
 * QUÉ NO HACE. No llama a ningún servicio. Recibe la lista por `@Input` y emite la acción
 * por `@Output`, para que cada estado se pueda probar sin red y sin base.
 *
 * DÓNDE VIVEN AHORA LOS ESTADOS. En `estados-del-festival.ts`. Los comparte con la pestaña de
 * Solicitudes, que necesita la misma tabla para saber qué está esperando decisión del equipo del
 * PNMC; dos copias divergirían en cuanto una de las dos pantallas cambiara.
 */
@Component({
  selector: 'app-seccion-festivales',
  standalone: true,
  imports: [EstadoDeListaComponent, BotonNativoDirective, FechaPipe, IndicadorDeEstadoComponent, AvisoSoloAdministracionComponent, MenuDeAccionesComponent],
  templateUrl: './seccion-festivales.component.html',
})
export class SeccionFestivalesComponent implements OnChanges {
  /** El tono y el matiz del indicador, desde el criterio único del proyecto. */
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  /** Lo que devuelve GET /api/v1/externo/organizaciones/{id}/festivales. */
  @Input() festivales: FestivalDeLaOrganizacion[] = [];

  /**
   * Hay una petición en vuelo. Deshabilita los botones, como hacía `loading()` en la
   * página de acceso externo: sin esto, dos pulsaciones seguidas mandan dos veces el
   * mismo Festival a revisión.
   */
  @Input() ocupado = false;

  /**
   * Si la cuenta administra la organización. Con `false` no se ofrecen enviar, retirar,
   * eliminar ni proponer cambios —el servidor los rechaza con 403 al editor— y se explica por qué.
   */
  @Input() esAdministradora = true;

  /** Abrir el formulario con el Festival cargado. Solo Borrador y AjustesSolicitados. */
  @Output() editar = new EventEmitter<FestivalDeLaOrganizacion>();

  /**
   * Abrir la ficha completa de la edición del Festival: los veintiséis campos del modelo, sus
   * cinco catálogos, los municipios, las entidades aliadas y el material.
   *
   * SE EMITE EN CUALQUIER ESTADO. Leer no cambia nada, y quien decide si además se puede editar es
   * el servidor, en `esEditable`: repetir aquí esa regla daría dos verdades sobre lo mismo.
   */
  @Output() abrirFicha = new EventEmitter<FestivalDeLaOrganizacion>();

  /** Remitir el Festival al equipo del PNMC. */
  @Output() enviarARevision = new EventEmitter<FestivalDeLaOrganizacion>();

  /** Abrir (o retomar) una propuesta de cambios sobre un Festival ya publicado. */
  @Output() proponerCambios = new EventEmitter<FestivalDeLaOrganizacion>();

  /** Remitir la propuesta de cambios a revisión institucional. */
  @Output() enviarPropuesta = new EventEmitter<FestivalDeLaOrganizacion>();

  /**
   * Ver el historial de ediciones del Festival, o registrar la primera/otra. Solo existe sobre un
   * Festival Publicado -mientras está en Borrador o AjustesSolicitados no tiene ninguna versión
   * vigente todavía que ediciones puedan acompañar-.
   */
  @Output() verEdiciones = new EventEmitter<FestivalDeLaOrganizacion>();

  /** Retirar un registro que aún no es público. El servidor conserva la auditoría. */
  @Output() retirar = new EventEmitter<FestivalDeLaOrganizacion>();
  @Output() solicitarRetiro = new EventEmitter<FestivalDeLaOrganizacion>();

  /**
   * LAS ACCIONES DE CADA FILA, del modelo de acciones por estado: las mismas, con los
   * mismos verbos, que la tarjeta de «siguiente acción» y el menú de la ficha. Antes esta lista
   * llevaba sus propias reglas y sus propios nombres («Editar Festival», «Solicitar eliminación»).
   * Se calculan al cambiar las entradas y no en cada pasada de detección de cambios.
   */
  menus = new Map<string, AccionDeMenu[]>();

  ngOnChanges(): void {
    this.menus = new Map(this.festivales.map(festival => [festival.id, comoAccionesDeMenu(accionesDeProceso({
      tipo: 'festival',
      nombre: festival.nombre,
      estado: festival.estado,
      estadoPropuesta: festival.estadoPropuesta,
      retiroSolicitado: !!festival.estadoSolicitudRetiro,
      esAdministradora: this.esAdministradora,
      ajustesPendientes: festival.cambiosPedidos ?? 0,
      cuantasEdiciones: festival.cuantasEdiciones ?? 0,
      ocupado: this.ocupado,
    }))]));
  }

  accionesDe(festival: FestivalDeLaOrganizacion): AccionDeMenu[] {
    return this.menus.get(festival.id) ?? [];
  }

  /** Una opción del menú de la fila: se traduce a la salida que la pantalla de arriba ya escucha. */
  elegir(festival: FestivalDeLaOrganizacion, id: string): void {
    switch (id) {
      case 'completar':
      case 'atender-ajustes': this.editar.emit(festival); break;
      case 'enviar':
      case 'reenviar': this.enviarARevision.emit(festival); break;
      case 'proponer-cambios':
      case 'continuar-propuesta': this.proponerCambios.emit(festival); break;
      case 'enviar-propuesta': this.enviarPropuesta.emit(festival); break;
      case 'ver-ediciones': this.verEdiciones.emit(festival); break;
      case 'retirar-de-revision':
      case 'eliminar-borrador': this.retirar.emit(festival); break;
      case 'solicitar-retiro': this.solicitarRetiro.emit(festival); break;
      case 'editar-contacto':
      case 'ver-historial': this.abrirFicha.emit(festival); break;
    }
  }

  estadoDe(festival: FestivalDeLaOrganizacion): EstadoFestival {
    return estadoDelFestival(festival.estado);
  }

  etiquetaEstado(festival: FestivalDeLaOrganizacion): string {
    return etiquetaDelFestival(festival.estado);
  }

  estadoPropuestaDe(festival: FestivalDeLaOrganizacion): EstadoPropuesta | null {
    return estadoDeLaPropuesta(festival.estadoPropuesta);
  }

  etiquetaEstadoPropuesta(festival: FestivalDeLaOrganizacion): string {
    return etiquetaDeLaPropuesta(festival.estadoPropuesta);
  }

  /** «Medellín (Antioquia)», o el que falte, o el aviso de que no hay ninguno todavía. */
  territorioDe(festival: FestivalDeLaOrganizacion): string {
    if (festival.nombreMunicipio && festival.nombreDepartamento) return `${festival.nombreMunicipio} (${festival.nombreDepartamento})`;
    return festival.nombreMunicipio || festival.nombreDepartamento || 'Territorio por definir';
  }

  /**
   * Con varias tarjetas en la lista, un lector de pantalla anuncia «Editar» seis veces sin
   * decir qué se edita. El nombre visible se deja corto y el accesible lleva el Festival.
   */
  nombreAccesible(accion: string, festival: FestivalDeLaOrganizacion): string {
    return `${accion}: ${festival.nombre}`;
  }


  // ─────────────────────────── La ficha desplegable ───────────────────────────






}
