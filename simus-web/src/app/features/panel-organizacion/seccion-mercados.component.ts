import { EncabezadoDePantallaComponent } from '../../shared/components/ui/encabezado-de-pantalla/encabezado-de-pantalla.component';
import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { RegistroSinTerminarComponent } from './registro-sin-terminar.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { ETIQUETAS_ESTADO_MERCADO } from '../../core/services/mercados.service';
import { NombrePropioPipe } from '../../shared/texto/nombre-propio.pipe';
import { FalloDelServidor, MercadoDeLaOrganizacion, PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { HerramientasDeListaComponent } from '../../shared/components/ui/herramientas-de-lista/herramientas-de-lista.component';
import { BuscadorDeListaComponent } from '../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { EstadoDeListaComponent } from '../../shared/components/ui/estado-de-lista/estado-de-lista.component';
import { MenuDeAccionesComponent } from '../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';
import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { AccionDeMenu, accionesDeProceso, comoAccionesDeMenu } from '../../core/acciones/acciones-por-estado';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';

function sinTildes(texto: string): string { return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

/**
 * Los mercados musicales de la organización, en `/gestion/procesos/mercados`.
 *
 * <b>ES LA HERMANA DE `/gestion/procesos/festivales`, Y NO EXISTÍA.</b> El enrutador registraba
 * `procesos/mercados/nuevo` y `procesos/mercados/:id`, pero no la lista: quien entraba a la
 * dirección del proceso —o pulsaba la miga «Mercados musicales» desde una ficha— no llegaba a
 * ningún sitio. Un proceso del Ecosistema se recorre igual que Festivales, que es la base de
 * funcionamiento, y eso empieza por tener las mismas direcciones.
 *
 * <b>LAS MISMAS TRES CIFRAS QUE FESTIVALES</b> —registros, pendientes y borradores—, porque
 * responden a las mismas tres preguntas: cuántos administro, cuántos esperan al PNMC y cuántos
 * no he enviado todavía.
 */
@Component({
  selector: 'app-seccion-mercados',
  standalone: true,
  imports: [EncabezadoDePantallaComponent, BotonNativoDirective, EsqueletoComponent, IndicadorDeEstadoComponent, HerramientasDeListaComponent, BuscadorDeListaComponent, FiltroDesplegableComponent, EstadoDeListaComponent, MenuDeAccionesComponent, FechaPipe, RouterLink, NombrePropioPipe, RegistroSinTerminarComponent],
  templateUrl: './seccion-mercados.component.html',
})
export class SeccionMercadosComponent implements OnInit {
  private readonly api = inject(PanelOrganizacionApi);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly router = inject(Router);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  readonly organizacionId = this.store.organizacionId;
  readonly mercados = signal<MercadoDeLaOrganizacion[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly pendientes = computed(() => this.mercados().filter(mercado =>
    mercado.estadoRegistro === 'en_revision' || mercado.estadoRegistro === 'ajustes_solicitados').length);
  readonly borradores = computed(() => this.mercados().filter(mercado =>
    mercado.estadoRegistro === 'borrador').length);

  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  /** BUSCADOR Y ESTADO: las mismas herramientas de lista que Festivales, Procesos y las demás pantallas. */
  readonly busqueda = signal('');
  readonly estadoFiltro = signal('todos');
  private readonly coincidentes = computed(() => {
    const q = sinTildes(this.busqueda());
    return q ? this.mercados().filter(m => sinTildes([m.nombre, m.descripcion, this.territorio(m)].filter(Boolean).join(' ')).includes(q)) : this.mercados();
  });
  readonly mercadosVisibles = computed(() => {
    const estado = this.estadoFiltro();
    return estado === 'todos' ? this.coincidentes() : this.coincidentes().filter(m => (m.estadoRegistro ?? '').toLowerCase() === estado);
  });
  readonly opcionesDeEstado = computed<readonly OpcionDeFiltro[]>(() => {
    const cuenta = new Map<string, number>();
    for (const m of this.coincidentes()) { const c = (m.estadoRegistro ?? '').toLowerCase(); cuenta.set(c, (cuenta.get(c) ?? 0) + 1); }
    return [{ id: 'todos', etiqueta: 'Todos', conteo: this.coincidentes().length }, ...[...cuenta.entries()].map(([id, n]) => ({ id, etiqueta: this.etiquetaEstado(id), conteo: n }))];
  });

  /** Una acción de la lista en curso (enviar, retirar, pedir el retiro): las demás esperan, como en Festivales. */
  readonly ocupado = signal(false);
  readonly mensaje = signal('');
  readonly errorDeAccion = signal('');

  /** Si la cuenta administra la organización: sin ello, enviar y retirar se ofrecen apagados con su motivo. */
  readonly esAdministradora = computed(() => this.store.esAdministradora());

  /**
   * LAS ACCIONES DE CADA FILA, del mismo modelo que Festivales y que la ficha: mismos
   * verbos, mismo orden, lo que hoy no se puede aparece apagado con su motivo. La lista no conoce el
   * estado de la propuesta de cambios ni si hay un retiro en trámite (no vienen en la lista), así que
   * esas dos acciones solo se ofrecen para empezar y la ficha, que sí los conoce, decide el resto.
   * «Agenda de citas» es la herramienta propia del Mercado y solo existe con el Mercado publicado.
   */
  private contexto(mercado: MercadoDeLaOrganizacion) {
    return {
      tipo: 'mercado' as const,
      nombre: mercado.nombre,
      estado: mercado.estadoRegistro,
      esAdministradora: this.esAdministradora(),
      cuantasEdiciones: mercado.numeroDeEdiciones,
      ocupado: this.ocupado(),
    };
  }

  readonly menus = computed(() => new Map(this.mercados().map(mercado => {
    const acciones: AccionDeMenu[] = comoAccionesDeMenu(accionesDeProceso(this.contexto(mercado)));
    if ((mercado.estadoRegistro ?? '').toLowerCase() === 'publicado') {
      const primeraDePeligro = acciones.findIndex(a => a.tono === 'peligro');
      acciones.splice(primeraDePeligro < 0 ? acciones.length : primeraDePeligro, 0,
        { id: 'agenda-de-citas', etiqueta: 'Agenda de citas', tono: 'normal' });
    }
    return [mercado.id, acciones] as const;
  })));

  accionesDe(mercado: MercadoDeLaOrganizacion): AccionDeMenu[] {
    return this.menus().get(mercado.id) ?? [];
  }

  /** Una opción del menú de la fila. Lo que es escribir o decidir sobre la ficha se abre en la ficha. */
  elegir(mercado: MercadoDeLaOrganizacion, id: string): void {
    if (this.ocupado()) return;
    const ficha = (consulta?: Record<string, string>) =>
      void this.router.navigate(this.enPanel('procesos/mercados', mercado.id), consulta ? { queryParams: consulta } : {});
    switch (id) {
      case 'completar':
      case 'atender-ajustes':
      case 'proponer-cambios':
      case 'continuar-propuesta':
      case 'editar-contacto': ficha({ seccion: 'informacion' }); break;
      case 'ver-ediciones': ficha({ seccion: 'ediciones' }); break;
      case 'ver-historial': ficha({ seccion: 'historial' }); break;
      case 'agenda-de-citas': void this.router.navigate(this.enPanel('herramientas/agenda-de-citas')); break;
      case 'enviar':
      case 'reenviar': void this.enviarARevision(mercado, id); break;
      case 'retirar-de-revision':
      case 'eliminar-borrador': void this.retirar(mercado, id); break;
      case 'solicitar-retiro': void this.solicitarRetiro(mercado); break;
    }
  }

  /** El diálogo común, con el texto del modelo. `null` si la persona cancela. */
  private confirmar(mercado: MercadoDeLaOrganizacion, id: string, conEventos = false) {
    const accion = accionesDeProceso(this.contexto(mercado)).find(a => a.id === id);
    if (!accion?.confirmacion) return Promise.resolve({ motivo: '' });
    return this.confirmaciones.pedir(conEventos
      ? { ...accion.confirmacion, eventosDelProceso: { tipo: 'mercado', id: mercado.id, ambito: 'externo' } }
      : accion.confirmacion);
  }

  private ejecutar(trabajo: Observable<unknown>, hecho: string, fallo: string): void {
    this.ocupado.set(true);
    this.errorDeAccion.set('');
    this.mensaje.set('');
    trabajo.subscribe({
      next: () => { this.ocupado.set(false); this.mensaje.set(hecho); this.cargar(); },
      error: (e: FalloDelServidor) => { this.ocupado.set(false); this.errorDeAccion.set(e?.message ?? fallo); },
    });
  }

  private async enviarARevision(mercado: MercadoDeLaOrganizacion, id: string): Promise<void> {
    if (!await this.confirmar(mercado, id)) return;
    this.ejecutar(this.api.enviarMercadoARevision(String(mercado.id)),
      `«${mercado.nombre}» quedó en revisión del equipo del PNMC.`, 'No fue posible enviar el mercado a revisión');
  }

  private async retirar(mercado: MercadoDeLaOrganizacion, id: string): Promise<void> {
    if (!await this.confirmar(mercado, id)) return;
    this.ejecutar(this.api.retirarMercado(String(mercado.id)),
      id === 'retirar-de-revision'
        ? `«${mercado.nombre}» fue retirado de revisión y volvió a borrador.`
        : `El borrador «${mercado.nombre}» fue eliminado.`,
      'No fue posible retirar el mercado');
  }

  private async solicitarRetiro(mercado: MercadoDeLaOrganizacion): Promise<void> {
    const respuesta = await this.confirmar(mercado, 'solicitar-retiro', true);
    if (!respuesta?.motivo) return;
    this.ejecutar(this.api.solicitarRetiroDeMercado(String(mercado.id), respuesta.motivo),
      `La solicitud de retiro de «${mercado.nombre}» fue enviada a revisión institucional.`,
      'No fue posible enviar la solicitud de retiro');
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(organizacionId = this.organizacionId()): void {
    if (!organizacionId) return;
    this.mercados.set([]);
    this.error.set('');
    this.cargando.set(true);
    this.api.obtenerMercados(organizacionId).subscribe({
      next: mercados => {
        this.cargando.set(false);
        this.mercados.set(mercados);
      },
      error: (fallo: FalloDelServidor) => {
        this.cargando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible consultar los mercados de la organización');
      },
    });
  }

  etiquetaEstado(estado: string | null | undefined): string {
    return ETIQUETAS_ESTADO_MERCADO[(estado ?? '').toLowerCase()] ?? 'Sin estado';
  }

  /** Dónde se realiza: el mismo criterio que la ficha y que la lista de procesos. */
  territorio(mercado: MercadoDeLaOrganizacion): string {
    if (mercado.nivelCobertura === 'nacional') return 'Todo el país';
    return [mercado.nombreMunicipio, mercado.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }
}
