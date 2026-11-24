import { EncabezadoDePantallaComponent } from '../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { RegistroSinTerminarComponent } from './registro-sin-terminar.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FalloDelServidor, FestivalDeLaOrganizacion, PanelOrganizacionApi } from './panel-organizacion.api';
import { SeccionFestivalesComponent } from './seccion-festivales.component';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { estadoDelFestival, etiquetaDelFestival } from './estados-del-festival';
import { HerramientasDeListaComponent } from '../../shared/components/ui/herramientas-de-lista/herramientas-de-lista.component';
import { BuscadorDeListaComponent } from '../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { accionesDeProceso, estadoDeLaPropuesta } from '../../core/acciones/acciones-por-estado';
import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';

function sinTildes(texto: string): string { return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

/**
 * Lista de Festivales de la organización, dentro de `/gestion/procesos/festivales`.
 *
 * La elección de tipo de proceso vive en `/gestion/procesos`. Esta ruta no vuelve a
 * decidir entre procesos ni conserva parámetros de URL para ello: solo presenta el
 * único flujo externo completo disponible hoy, el de Festivales.
 */
@Component({
  selector: 'app-seccion-ecosistema',
  standalone: true,
  imports: [EncabezadoDePantallaComponent, BotonNativoDirective, EsqueletoComponent, CommonModule, RouterLink, SeccionFestivalesComponent, HerramientasDeListaComponent, BuscadorDeListaComponent, FiltroDesplegableComponent, EstadoDeListaComponent, RegistroSinTerminarComponent],
  templateUrl: './seccion-ecosistema.component.html',
})
export class SeccionEcosistemaComponent implements OnInit {
  private readonly api = inject(PanelOrganizacionApi);
  private readonly router = inject(Router);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  readonly organizacionId = this.store.organizacionId;
  readonly esAdministradora = this.store.esAdministradora;
  readonly festivales = signal<FestivalDeLaOrganizacion[]>([]);
  readonly cargandoFestivales = signal(false);
  readonly errorFestivales = signal('');
  readonly errorAccionFestival = signal('');
  readonly mensajeFestivales = signal('');
  readonly festivalOcupado = signal(false);
  /**
   * LAS CIFRAS DICEN LO QUE CUENTAN. «1 REGISTROS · Festivales administrados» contaba
   * borradores nunca enviados como si fueran administrados, y «En revisión» no contaba las propuestas
   * ni los retiros. Ahora: registrados (todos), publicados, los que esperan una decisión del PNMC
   * (en revisión, con propuesta en revisión o con retiro solicitado) y los borradores aparte.
   */
  readonly publicados = computed(() => this.festivales().filter(festival =>
    estadoDelFestival(festival.estado) === 'Publicado').length);
  readonly esperanAlPnmc = computed(() => this.festivales().filter(festival =>
    estadoDelFestival(festival.estado) === 'EnRevision'
    || estadoDeLaPropuesta(festival.estadoPropuesta) === 'en_revision'
    || festival.estadoSolicitudRetiro === 'pendiente').length);
  readonly borradores = computed(() => this.festivales().filter(festival =>
    estadoDelFestival(festival.estado) === 'Borrador').length);

  /** BUSCADOR Y ESTADO: las mismas herramientas de lista que Procesos, Mercados y las demás pantallas. */
  readonly busqueda = signal('');
  readonly estadoFiltro = signal('todos');
  private readonly coincidentes = computed(() => {
    const q = sinTildes(this.busqueda());
    return q ? this.festivales().filter(f => sinTildes([f.nombre, f.descripcion, f.nombreMunicipio, f.nombreDepartamento].filter(Boolean).join(' ')).includes(q)) : this.festivales();
  });
  readonly festivalesVisibles = computed(() => {
    const estado = this.estadoFiltro();
    return estado === 'todos' ? this.coincidentes() : this.coincidentes().filter(f => estadoDelFestival(f.estado) === estado);
  });
  readonly opcionesDeEstado = computed<readonly OpcionDeFiltro[]>(() => {
    const cuenta = new Map<string, { etiqueta: string; n: number }>();
    for (const f of this.coincidentes()) {
      const clave = estadoDelFestival(f.estado);
      cuenta.set(clave, { etiqueta: etiquetaDelFestival(f.estado), n: (cuenta.get(clave)?.n ?? 0) + 1 });
    }
    return [{ id: 'todos', etiqueta: 'Todos', conteo: this.coincidentes().length }, ...[...cuenta.entries()].map(([id, v]) => ({ id, etiqueta: v.etiqueta, conteo: v.n }))];
  });

  ngOnInit(): void {
    this.cargarFestivales();
  }

  cargarFestivales(organizacionId = this.organizacionId()): void {
    if (!organizacionId) return;
    this.festivales.set([]);
    this.errorFestivales.set('');
    this.cargandoFestivales.set(true);
    this.api.obtenerFestivales(organizacionId).subscribe({
      next: festivales => {
        this.cargandoFestivales.set(false);
        this.festivales.set(festivales);
      },
      error: (fallo: FalloDelServidor) => {
        this.cargandoFestivales.set(false);
        this.errorFestivales.set(fallo?.message ?? 'No fue posible consultar los Festivales de la organización');
      },
    });
  }

  /**
   * LO QUE EL MODELO DE ACCIONES DICE QUE SE CONFIRMA, se confirma en el diálogo común:
   * qué va a pasar y qué consecuencia tiene, con el texto del propio modelo. Devuelve `null` si la
   * persona cancela.
   */
  private async confirmar(festival: FestivalDeLaOrganizacion, id: string): Promise<{ motivo: string } | null> {
    const accion = accionesDeProceso({
      tipo: 'festival',
      nombre: festival.nombre,
      estado: festival.estado,
      estadoPropuesta: festival.estadoPropuesta,
      esAdministradora: true,
      ajustesPendientes: festival.cambiosPedidos ?? 0,
    }).find(a => a.id === id);
    if (!accion?.confirmacion) return { motivo: '' };
    // AL PEDIR EL RETIRO SE DICE CUÁNTOS EVENTOS DE LA AGENDA SE ARCHIVARÍAN (decisión 113).
    return this.confirmaciones.pedir(id === 'solicitar-retiro'
      ? { ...accion.confirmacion, eventosDelProceso: { tipo: 'festival', id: festival.id, ambito: 'externo' } }
      : accion.confirmacion);
  }

  async alEnviarARevision(festival: FestivalDeLaOrganizacion): Promise<void> {
    if (this.festivalOcupado()) return;
    const id = estadoDelFestival(festival.estado) === 'AjustesSolicitados' ? 'reenviar' : 'enviar';
    if (!await this.confirmar(festival, id)) return;
    this.festivalOcupado.set(true);
    this.errorFestivales.set('');
    this.errorAccionFestival.set('');
    this.mensajeFestivales.set('');
    this.api.enviarFestivalARevision(festival.id).subscribe({
      next: () => {
        this.festivalOcupado.set(false);
        this.mensajeFestivales.set(`«${festival.nombre}» quedó en revisión del equipo del PNMC.`);
        this.cargarFestivales();
      },
      error: (fallo: FalloDelServidor) => {
        this.festivalOcupado.set(false);
        this.errorAccionFestival.set(fallo?.message ?? 'No fue posible enviar el Festival a revisión');
      },
    });
  }

  async alEnviarPropuesta(festival: FestivalDeLaOrganizacion): Promise<void> {
    if (this.festivalOcupado()) return;
    if (!await this.confirmar(festival, 'enviar-propuesta')) return;
    this.festivalOcupado.set(true);
    this.errorFestivales.set('');
    this.errorAccionFestival.set('');
    this.mensajeFestivales.set('');
    this.api.enviarPropuestaARevision(festival.id).subscribe({
      next: () => {
        this.festivalOcupado.set(false);
        this.mensajeFestivales.set(`La propuesta de cambios de «${festival.nombre}» quedó en revisión.`);
        this.cargarFestivales();
      },
      error: (fallo: FalloDelServidor) => {
        this.festivalOcupado.set(false);
        this.errorAccionFestival.set(fallo?.message ?? 'No fue posible enviar la propuesta a revisión');
      },
    });
  }

  abrirFichaDelFestival(festival: FestivalDeLaOrganizacion): void {
    this.router.navigate(this.enPanel('procesos/festivales', festival.id));
  }

  editarFichaDelFestival(festival: FestivalDeLaOrganizacion): void {
    if (estadoDelFestival(festival.estado) === 'AjustesSolicitados') {
      this.router.navigate(this.enPanel('procesos/festivales', festival.id), {
        queryParams: { seccion: 'informacion', ajustes: '1' },
      });
      return;
    }
    this.router.navigate(this.enPanel('procesos/festivales', festival.id), {
      queryParams: { seccion: 'informacion', editar: '1' },
    });
  }

  verEdicionesDelFestival(festival: FestivalDeLaOrganizacion): void {
    this.router.navigate(this.enPanel('procesos/festivales', festival.id), {
      queryParams: { seccion: 'ediciones' },
    });
  }

  /**
   * Retirar y pedir el retiro, en el diálogo común. Antes vivían en un diálogo escrito a mano en esta
   * pantalla, con su señal, sus tres textos calculados y su `@if`; ahora el texto sale del modelo de
   * acciones y el diálogo es el mismo de las demás pantallas.
   */
  async retirarFestival(festival: FestivalDeLaOrganizacion): Promise<void> {
    if (this.festivalOcupado()) return;
    const id = estadoDelFestival(festival.estado) === 'EnRevision' ? 'retirar-de-revision' : 'eliminar-borrador';
    if (!await this.confirmar(festival, id)) return;
    this.retirarDeVerdad(festival);
  }

  private retirarDeVerdad(festival: FestivalDeLaOrganizacion): void {
    const enRevision = estadoDelFestival(festival.estado) === 'EnRevision';
    this.festivalOcupado.set(true);
    this.errorAccionFestival.set('');
    this.mensajeFestivales.set('');
    this.api.retirarFestival(festival.id).subscribe({
      next: () => {
        this.festivalOcupado.set(false);
        this.mensajeFestivales.set(enRevision
          ? `«${festival.nombre}» fue retirado de revisión y volvió a borrador.`
          : `El borrador «${festival.nombre}» fue eliminado.`);
        this.cargarFestivales();
      },
      error: (fallo: FalloDelServidor) => {
        this.festivalOcupado.set(false);
        this.errorAccionFestival.set(fallo?.message ?? 'No fue posible retirar el Festival');
      },
    });
  }

  async solicitarRetiroFestival(festival: FestivalDeLaOrganizacion): Promise<void> {
    if (this.festivalOcupado()) return;
    const respuesta = await this.confirmar(festival, 'solicitar-retiro');
    if (!respuesta) return;
    this.solicitarRetiroDeVerdad(festival, respuesta.motivo);
  }

  private solicitarRetiroDeVerdad(festival: FestivalDeLaOrganizacion, justificacion: string): void {
    if (!justificacion) return;
    this.festivalOcupado.set(true);
    this.errorAccionFestival.set('');
    this.mensajeFestivales.set('');
    this.api.solicitarRetiroFestival(festival.id, justificacion).subscribe({
      next: () => {
        this.festivalOcupado.set(false);
        this.mensajeFestivales.set(`La solicitud de retiro de «${festival.nombre}» fue enviada a revisión institucional.`);
        this.cargarFestivales();
      },
      error: (fallo: FalloDelServidor) => {
        this.festivalOcupado.set(false);
        this.errorAccionFestival.set(fallo?.message ?? 'No fue posible enviar la solicitud de retiro');
      },
    });
  }
}
