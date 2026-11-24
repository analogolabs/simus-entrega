import { SedeDelServidor } from '../../core/territorio/sede-principal';
import { CorreccionDeSedeComponent } from './correccion-de-sede.component';
import { enumerarDatosPendientes, informacionPendienteDelMercado } from './informacion-pendiente-del-mercado';
import { AccionDeProceso, accionesDeProceso, comoAccionesDeMenu, siguienteAccion } from '../../core/acciones/acciones-por-estado';
import { TarjetaSiguienteAccionComponent } from '../../shared/components/ui/tarjeta-siguiente-accion/tarjeta-siguiente-accion.component';
import { MenuDeAccionesComponent } from '../../shared/components/ui/menu-de-acciones/menu-de-acciones.component';
import { ServicioDeConfirmacion } from '../../core/confirmacion/servicio-de-confirmacion';
import { CommonModule } from '@angular/common';
import { ConfirmacionComponent } from '../../shared/components/ui/confirmacion/confirmacion.component';
import { DialogoDeFormularioComponent } from '../../shared/components/ui/dialogo-de-formulario/dialogo-de-formulario.component';
import { SelectorMultipleComponent } from '../../shared/components/ui/selector-multiple/selector-multiple.component';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { NombrePropioPipe } from '../../shared/texto/nombre-propio.pipe';
import { IndicadorDeEstadoComponent } from '../../shared/components/ui/indicador-de-estado/indicador-de-estado.component';
import { matizDelEstado, tonoDelEstado } from '../../shared/components/ui/indicador-de-estado/tono-del-estado';
import { ETIQUETAS_ESTADO_MERCADO, ETIQUETAS_VISIBILIDAD_EDICION } from '../../core/services/mercados.service';
import { PropuestaDeCambio } from '../../core/services/propuestas-de-proceso.service';
import {
  CatalogosDeMercadoExternos,
  ContactoPublicoDeMercadoSolicitud,
  EdicionDeMercadoDeLaOrganizacion,
  EntradaHistorialMercado,
  FalloDelServidor,
  FestivalElegibleParaMercado,
  GuardarMercadoSolicitud,
  MercadoDeLaOrganizacion,
  ObservacionDeCampoDeMercado,
  PanelOrganizacionApi,
  UbicacionDivipola,
} from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { EdicionesDeMercadoComponent } from './ediciones-de-mercado.component';
import { PERIODICIDADES, etiquetaDePeriodicidad, pideDetalle } from '../../core/vocabularios/periodicidad';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { motivoDeLaAccion } from '../../core/formularios/traductor-de-errores';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
import { SedeElegida, SelectorDeSedeComponent } from '../../shared/components/ui/selector-de-sede/selector-de-sede.component';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';
/** Una sección de la ficha. LAS MISMAS CUATRO QUE LA DE UN FESTIVAL, y en el mismo orden. */
export interface SeccionDeFichaDeMercado {
  id: string;
  etiqueta: string;
}

export const SECCIONES_DE_LA_FICHA_DE_MERCADO: readonly SeccionDeFichaDeMercado[] = [
  { id: 'resumen', etiqueta: 'Vista general' },
  { id: 'informacion', etiqueta: 'Información' },
  { id: 'ediciones', etiqueta: 'Ediciones' },
  { id: 'historial', etiqueta: 'Historial' },
];

/**
 * La ficha de un mercado musical en el panel de su organización.
 *
 * <b>LEER Y EDITAR EN LA MISMA PANTALLA, como la ficha del Festival.</b> El proyecto ya tomó esa
 * decisión para Festivales —el asistente es solo para el alta— y aquí se respeta: quien abre su
 * mercado ve lo que tiene y corrige lo que haga falta sin cambiar de sitio.
 *
 * <b>LO QUE SE PUEDE HACER DEPENDE DEL ESTADO, y la pantalla solo ofrece lo que aplica.</b> En
 * borrador o con ajustes solicitados se edita y se envía a revisión. En revisión no se toca: está
 * en manos del PNMC, y decirlo es más útil que un botón apagado sin explicación. Publicado se
 * lee; los cambios sobre lo publicado son otra cosa y tendrán su propio recorrido.
 *
 * <b>Y SE RECORRE COMO LA DE UN FESTIVAL.</b> se
 * pidió con esas palabras: «la navegación, edición, publicación, etc. de un mercado debe ser igual
 * en cuanto sea posible a la de un festival, todo está muy diferente». Era cierto: esto era una
 * página plana con un botón «Editar» que la convertía entera en formulario, mientras el festival
 * tenía migas, cuatro secciones, indicador de estado e historial. Ahora tiene las mismas cuatro
 * —Vista general, Información, Ediciones, Historial—, las mismas migas que nombran el proceso
 * concreto, el mismo indicador de estado y la misma línea de tiempo.
 */
@Component({
  selector: 'app-ficha-de-mercado-page',
  standalone: true,
  imports: [EsqueletoComponent, SelectorDeSedeComponent, CorreccionDeSedeComponent, OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, BotonNativoDirective, FechaPipe, TarjetaSiguienteAccionComponent, MenuDeAccionesComponent, AvisoSoloAdministracionComponent, EdicionesDeMercadoComponent, SelectorMultipleComponent, IndicadorDeEstadoComponent, CommonModule, FormsModule, RouterLink, NombrePropioPipe, ConfirmacionComponent, DialogoDeFormularioComponent],
  templateUrl: './ficha-de-mercado-page.component.html',
})
export class FichaDeMercadoPageComponent implements OnInit {
  private readonly api = inject(PanelOrganizacionApi);
  private readonly store = inject(PanelOrganizacionStore);

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }
  /** Enviar, retirar y proponer cambios son de la administración. */
  readonly esAdministradora = this.store.esAdministradora;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmaciones = inject(ServicioDeConfirmacion);
  private readonly destroyRef = inject(DestroyRef);

  readonly secciones = SECCIONES_DE_LA_FICHA_DE_MERCADO;
  readonly seccionActiva = signal('resumen');

  /** El tono y el matiz del indicador de estado, del criterio único del proyecto. */
  readonly tonoDelEstado = tonoDelEstado;
  readonly matizDelEstado = matizDelEstado;

  // ─────────────────────────── El historial, como el del Festival ───────────────────────────
  //
  // SE CONSULTA AL ENTRAR EN SU SECCION y no al abrir la ficha: son cien movimientos que la
  // mayoría de las visitas no mira, y la ficha ya hace cuatro llamadas para pintarse.
  readonly historial = signal<EntradaHistorialMercado[]>([]);
  readonly cargandoHistorial = signal(false);
  readonly errorHistorial = signal('');
  private historialConsultado = false;

  /** La última realización, para que la vista general diga cuál y no solo cuántas. */
  readonly edicionMasReciente = signal<EdicionDeMercadoDeLaOrganizacion | null>(null);

  // ──────────── Lo que la organización puede hacer con lo suyo, según el estado ────────────
  //
  // TRES ACCIONES Y NINGUNA SE PARECE A OTRA, aunque las tres «quiten» el mercado de en medio:
  // deshacer un envío lo devuelve a borrador y conserva el trabajo, abandonar un borrador lo
  // archiva, y sobre lo publicado no se quita nada: se PIDE, y decide el PNMC.

  /** El retiro que se está confirmando: deshacer el envío o abandonar el borrador. */
  readonly retiroEnConfirmacion = signal(false);
  readonly retirando = signal(false);

  /** La solicitud de retiro de un mercado publicado, con la justificación que se escribe. */
  readonly solicitudDeRetiro = signal<{ justificacion: string } | null>(null);
  readonly solicitando = signal(false);
  readonly retiroSolicitado = signal(false);

  /** La corrección del contacto público, lo único editable de un mercado publicado. */
  readonly contactoEnEdicion = signal<ContactoPublicoDeMercadoSolicitud | null>(null);
  readonly guardandoContacto = signal(false);

  // ─────────────── Lo que el PNMC pidió corregir, campo por campo ───────────────
  //
  // ANTES LLEGABA UN PARRAFO. Todo lo que hubiera que decir sobre treinta campos cabía en un aviso
  // suelto, y no había forma de saber a qué campo se refería cada frase ni de ir marcando lo hecho.

  readonly cambiosPedidos = signal<ObservacionDeCampoDeMercado[]>([]);

  // ─────────── La propuesta de cambio sobre lo publicado ───────────
  //
  // LO PUBLICADO NO SE EDITA. Lo que la organización hace sobre un mercado ya publicado es
  // PROPONER, y lo que se propone es la DIFERENCIA entre lo que la ficha dice y lo que la persona
  // escribió: no se le pide elegir campos de una lista, se le deja editar como siempre y el cambio
  // sale de comparar. La pantalla es la misma; lo que cambia es a dónde va lo escrito.

  /** La propuesta viva, o `null` si no hay ninguna. Con `id` en cero el servidor dice que no hay. */
  readonly propuesta = signal<PropuestaDeCambio | null>(null);

  /** Cierto mientras el formulario está abierto para proponer y no para editar. */
  readonly proponiendo = signal(false);

  readonly guardandoLaPropuesta = signal(false);

  /** Lo que se escribe en «Por qué lo propones». Texto plano: lo lee una persona, no el sistema. */
  motivoDeLaPropuesta = '';

  /** Hay algo escrito y todavía sin enviar. */
  readonly tienePropuestaEnBorrador = computed(() => {
    const p = this.propuesta();
    return !!p && p.id > 0 && (p.estado === 'borrador' || p.estado === 'ajustes_solicitados');
  });

  /** Está en manos del PNMC: no se toca ni se abandona. */
  readonly propuestaEnRevision = computed(() => this.propuesta()?.estado === 'en_revision');

  readonly propuestaConAjustes = computed(() => this.propuesta()?.estado === 'ajustes_solicitados');
  readonly marcando = signal<number | null>(null);

  /** Cuántos quedan por atender. Es lo que dice si ya se puede reenviar. */
  readonly cambiosPendientes = computed(() =>
    this.cambiosPedidos().filter(cambio => cambio.estado !== 'atendida').length);

  readonly mercado = signal<MercadoDeLaOrganizacion | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  /** El vocabulario de periodicidad, el mismo que el asistente y que la consola. */
  readonly PERIODICIDADES = PERIODICIDADES;
  readonly pideDetalle = pideDetalle;
  readonly etiquetaDePeriodicidad = etiquetaDePeriodicidad;

  readonly editando = signal(false);

  readonly catalogos = signal<CatalogosDeMercadoExternos>({ alcances: [], modalidades: [], practicasMusicales: [], territoriosSonoros: [] });
  readonly ubicaciones = signal<UbicacionDivipola[]>([]);
  readonly festivales = signal<FestivalElegibleParaMercado[]>([]);

  /** El mismo criterio que el asistente: un fallo no es una respuesta. */
  readonly seConsultaronLosFestivales = signal(false);

  readonly formulario = signal<GuardarMercadoSolicitud | null>(null);

  /** El parser de plantillas no ve los globales: el identificador del mercado viaja como texto. */
  readonly String = String;

  /** En borrador y con ajustes solicitados la organización manda; en el resto, no. */
  readonly sePuedeEditar = computed(() => {
    const estado = this.mercado()?.estadoRegistro ?? '';
    return estado === 'borrador' || estado === 'ajustes_solicitados';
  });

  /** Lo que impide enviar el mercado, dicho antes de pulsar, como en el Festival. */
  readonly faltaParaEnviar = computed(() =>
    enumerarDatosPendientes(informacionPendienteDelMercado(this.mercado()).paraEnviar));

  readonly estaEnRevision = computed(() => this.mercado()?.estadoRegistro === 'en_revision');

  /** Rechazado es terminal: no se edita, no se reenvía y no se publica. */
  readonly estaRechazado = computed(() => this.mercado()?.estadoRegistro === 'rechazado');

  /** El motivo del rechazo, leído del historial: es donde el PNMC lo dejó escrito. */
  readonly motivoDelRechazo = computed(() =>
    this.historial().find(entrada => entrada.accion === 'MercadoRechazado')?.comentario ?? null);

  /**
   * LO QUE EL MODELO DE ACCIONES NECESITA SABER DEL MERCADO.
   *
   * Es el mismo contexto que arma la ficha de un Festival: la tarjeta de «siguiente acción», el menú
   * «Acciones» de la cabecera y los textos de confirmación salen todos de `core/acciones`, con los
   * mismos verbos para los dos procesos. Antes esta ficha pintaba sus propios bloques por estado y
   * los verbos se alinearon a mano; con una sola definición ya no pueden divergir.
   */
  private contextoDeProceso() {
    const m = this.mercado();
    if (!m) return null;
    return {
      tipo: 'mercado' as const,
      nombre: m.nombre,
      estado: m.estadoRegistro,
      estadoPropuesta: this.propuesta()?.estado ?? null,
      retiroSolicitado: this.retiroSolicitado(),
      esAdministradora: this.esAdministradora(),
      ajustesPendientes: this.cambiosPendientes(),
      faltaParaEnviar: this.faltaParaEnviar(),
      ocupado: this.enviando() || this.guardandoLaPropuesta() || this.solicitando() || this.retirando(),
    };
  }

  readonly accionesDelProceso = computed(() => {
    const ctx = this.contextoDeProceso();
    return ctx ? accionesDeProceso(ctx) : [];
  });

  readonly siguiente = computed(() => {
    const ctx = this.contextoDeProceso();
    return ctx ? siguienteAccion(ctx) : null;
  });

  readonly accionesDeMenu = computed(() => comoAccionesDeMenu(this.accionesDelProceso()));

  /** Una acción elegida en el menú de la cabecera (llega solo el identificador). */
  alElegirDelMenu(id: string): void {
    const accion = this.accionesDelProceso().find(a => a.id === id);
    if (accion) this.ejecutar(accion);
  }

  /** Una acción elegida en la tarjeta de «siguiente acción». */
  alElegirUnaAccion(accion: AccionDeProceso): void {
    this.ejecutar(accion);
  }

  /**
   * Lo que hace cada acción del modelo. Cada camino ya pide su propia confirmación con el texto del
   * modelo (enviar, enviar la propuesta, retirar, solicitar el retiro), así que aquí no se repite.
   */
  ejecutar(accion: AccionDeProceso): void {
    if (!accion.habilitada) return;
    switch (accion.id) {
      case 'completar':
      case 'atender-ajustes': this.abrirLaInformacion(); break;
      case 'enviar':
      case 'reenviar': void this.enviarARevision(); break;
      case 'retirar-de-revision':
      case 'eliminar-borrador': this.pedirConfirmacionDelRetiro(); break;
      case 'proponer-cambios':
      case 'continuar-propuesta': this.empezarAProponer(); break;
      case 'enviar-propuesta': void this.enviarLaPropuesta(); break;
      case 'editar-contacto': this.empezarACorregirElContacto(); break;
      case 'ver-ediciones': this.irASeccion('ediciones'); break;
      case 'ver-historial': this.irASeccion('historial'); break;
      case 'solicitar-retiro': this.pedirElRetiroAlPrograma(); break;
    }
  }

  ngOnInit(): void {
    // LA SECCION VIAJA EN LA URL, igual que en la ficha del Festival: compartir el enlace del
    // historial de un mercado tiene que abrir el historial, no la vista general.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(parametros => {
      const seccion = parametros.get('seccion');
      if (seccion && this.secciones.some(s => s.id === seccion)) {
        this.seccionActiva.set(seccion);
        if (seccion === 'historial') this.cargarHistorial();
      }
    });

    const id = this.route.snapshot.paramMap.get('id');
    const organizacionId = this.store.organizacionId();
    if (!id) { this.cargando.set(false); return; }

    forkJoin({
      mercado: this.api.obtenerMercado(id),
      catalogos: this.api.obtenerCatalogosDeMercado().pipe(catchError(() => of({ alcances: [], modalidades: [], practicasMusicales: [], territoriosSonoros: [] }))),
      ubicaciones: this.api.obtenerUbicaciones().pipe(catchError(() => of([] as UbicacionDivipola[]))),
      festivales: organizacionId
        ? this.api.obtenerFestivalesElegibles(organizacionId).pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: ({ mercado, catalogos, ubicaciones, festivales }) => {
        // EL MERCADO ES DE OTRA ORGANIZACIÓN DE LA CUENTA: se abre ESA, con un aviso, en vez
        // de enseñarlo bajo la cabecera de la que no es suya.
        const duena = String(mercado.organizacionId ?? '');
        if (duena && organizacionId && duena !== organizacionId && this.store.esMiembroDe(duena)) {
          const nombre = this.store.organizaciones().find(organizacion => organizacion.id === duena)?.name ?? 'su organización';
          this.store.avisoDeCambio.set(`Este Mercado es de «${nombre}»: cambiamos a esa organización.`);
          void this.router.navigate(rutaDelPanel(duena, 'procesos', 'mercados', String(mercado.id)), { queryParamsHandling: 'preserve', replaceUrl: true });
          return;
        }
        this.mercado.set(mercado);
        this.catalogos.set(catalogos ?? { alcances: [], modalidades: [], practicasMusicales: [], territoriosSonoros: [] });
        this.ubicaciones.set(ubicaciones ?? []);
        // `null` significa «no se pudo preguntar»; una lista vacía, «no tiene ninguno». La ficha
        // solo afirma lo segundo cuando de verdad lo sabe.
        this.festivales.set(festivales ?? []);
        this.seConsultaronLosFestivales.set(festivales !== null);
        this.cargando.set(false);
        this.cargarEdicionMasReciente(String(mercado.id));
        this.cargarLosCambiosPedidos(String(mercado.id));
        this.cargarLaPropuesta(String(mercado.id));
        // SI SE ENTRO DIRECTO AL HISTORIAL, aquí es donde se puede pedir: la sección la fija el
        // parámetro de la URL, que llega ANTES que el mercado, y sin mercado no hay qué consultar.
        // Sin esto, compartir el enlace del historial abría la sección diciendo que no hay
        // movimientos, que es afirmar algo que todavía no se había preguntado.
        // RECHAZADO: el motivo vive en el historial y la vista general lo enseña, así que se pide ya.
        if (this.seccionActiva() === 'historial' || mercado.estadoRegistro === 'rechazado') this.cargarHistorial();
      },
      error: (fallo: FalloDelServidor) => {
        this.error.set(fallo?.message ?? 'No fue posible abrir el mercado.');
        this.cargando.set(false);
      },
    });
  }

  /**
   * La palabra que se enseña para un estado, DE LA MISMA TABLA QUE USA LA CONSOLA.
   *
   * Tenía aquí su propia copia, con las mismas cinco entradas. Dos tablas del mismo vocabulario
   * divergen en cuanto se añada un estado: aparecería nombrado en un sitio y en crudo en el otro.
   */
  etiquetaDeEstado(estado: string | null | undefined): string {
    return ETIQUETAS_ESTADO_MERCADO[(estado ?? '').toLowerCase()] ?? 'Sin estado';
  }

  /** El nombre de la organización que administra el mercado, para la cabecera. */
  nombreOrganizacion(): string {
    return this.store.organizacionElegida()?.name ?? '';
  }

  irASeccion(id: string): void {
    if (!this.secciones.some(seccion => seccion.id === id)) return;
    this.seccionActiva.set(id);
    if (id !== 'informacion') this.cancelarEdicion();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { seccion: id },
      queryParamsHandling: 'merge',
    });
    if (id === 'historial') this.cargarHistorial();
  }

  descripcionDeLaSeccion(): string {
    const descripciones: Record<string, string> = {
      resumen: 'Estado actual, siguiente acción y datos esenciales del registro.',
      informacion: 'Datos permanentes que identifican al mercado y su presencia pública.',
      ediciones: 'Realizaciones concretas del mercado, con sus propias fechas y estados.',
      historial: 'Movimientos y decisiones que permiten seguir la trazabilidad del registro.',
    };
    return descripciones[this.seccionActiva()] ?? '';
  }

  /** Una sola vez por visita: el historial no cambia mientras se mira. */
  cargarHistorial(): void {
    const mercado = this.mercado();
    const organizacionId = this.store.organizacionId();
    if (!mercado || !organizacionId || this.historialConsultado) return;
    this.historialConsultado = true;
    this.cargandoHistorial.set(true);
    this.errorHistorial.set('');
    this.api.obtenerHistorialMercado(organizacionId, String(mercado.id)).subscribe({
      next: entradas => {
        this.historial.set(entradas);
        this.cargandoHistorial.set(false);
      },
      error: (fallo: FalloDelServidor) => {
        this.cargandoHistorial.set(false);
        this.historialConsultado = false;
        this.errorHistorial.set(fallo?.message ?? 'No fue posible consultar el historial del mercado.');
      },
    });
  }

  /**
   * Cómo se lee un movimiento. LOS MISMOS ROTULOS QUE EL HISTORIAL DE UN FESTIVAL donde el
   * movimiento es el mismo, con los nombres que audita el circuito del mercado.
   */
  etiquetaAccionHistorial(accion: string): string {
    const etiquetas: Record<string, string> = {
      MercadoCreado: 'Registro creado',
      MercadoActualizado: 'Actualización registrada',
      MercadoEnviadoARevision: 'Enviado a revisión',
      MercadoRecibidoParaRevision: 'Recibido por el PNMC',
      MercadoConAjustesSolicitados: 'Ajustes solicitados',
      MercadoAprobado: 'Aprobado',
      MercadoPublicado: 'Publicado',
      MercadoArchivado: 'Archivado',
      MercadoRechazado: 'Rechazado',
      EdicionDeMercadoCreada: 'Edición registrada',
      EdicionDeMercadoActualizada: 'Edición actualizada',
      // El PNMC decidió algo que no fue publicar, pedir ajustes ni archivar: raro, pero
      // decirlo es mejor que llamarlo «actualización».
      MercadoDecidido: 'Decisión del PNMC',
    };
    return etiquetas[accion] ?? 'Actualización registrada';
  }

  /** Cómo se lee la edición más reciente en la vista general. */
  edicionMasRecienteEnPalabras(): string {
    const edicion = this.edicionMasReciente();
    if (!edicion) return 'Todavía sin ediciones';
    const nombre = edicion.nombre || `Edición ${edicion.numeroEdicion ?? edicion.anio ?? 'sin identificar'}`;
    // LA VISIBILIDAD DE UNA EDICION TIENE SU PROPIO VOCABULARIO —«Publicada», en femenino—, que
    // no es el del mercado: el sujeto es la edición.
    return `${nombre} · ${ETIQUETAS_VISIBILIDAD_EDICION[edicion.estadoVisibilidad] ?? edicion.estadoVisibilidad}`;
  }

  /**
   * Trae lo que el PNMC pidió corregir.
   *
   * SE PIDE SIEMPRE Y NO SOLO EN «AJUSTES SOLICITADOS»: el servidor devuelve la lista vacía cuando
   * no hay nada enviado, y condicionarlo aquí al estado obligaría a esta pantalla a saber cuándo
   * puede haber notas, que es justo lo que decide el otro lado.
   */
  private cargarLosCambiosPedidos(mercadoId: string): void {
    this.api.cambiosPedidosDeMercado(mercadoId)
      // NO ES UN REQUISITO PARA ABRIR LA FICHA: si falla, la ficha se ve igual.
      .pipe(catchError(() => of([] as ObservacionDeCampoDeMercado[])))
      .subscribe(cambios => this.cambiosPedidos.set(cambios ?? []));
  }

  /**
   * La propuesta de cambio viva, si la hay.
   *
   * SE PIDE SIEMPRE Y NO SOLO CUANDO ESTA PUBLICADO, por lo mismo que los cambios pedidos: cuándo
   * puede haber una lo decide el otro lado, y condicionarlo aquí obligaría a esta pantalla a saberlo.
   */
  private cargarLaPropuesta(mercadoId: string): void {
    this.api.propuestaDeMercado(mercadoId)
      .pipe(catchError(() => of(null)))
      .subscribe(propuesta => this.propuesta.set(propuesta && propuesta.id > 0 ? propuesta : null));
  }

  /**
   * Abre el formulario para PROPONER, no para editar.
   *
   * Si ya hay un borrador, se vuelve a él: los valores propuestos se escriben encima de los
   * actuales, de modo que quien lo retoma ve lo que dejó escrito y no la ficha en limpio.
   */
  empezarAProponer(): void {
    // EL FORMULARIO VIVE EN «INFORMACION», y a proponer se llega desde «Vista general»: sin esto,
    // pulsar el botón no enseñaba nada y parecía que no había pasado.
    this.seccionActiva.set('informacion');
    this.empezarAEditar();
    const guardada = this.propuesta();
    if (guardada) {
      for (const campo of guardada.campos) {
        this.escribirCampoPropuesto(campo.campoId, campo.valorPropuesto);
      }
    }
    this.motivoDeLaPropuesta = guardada?.motivo ?? '';
    this.proponiendo.set(true);
  }

  /** Escribe en el formulario el valor propuesto de un campo, con el nombre que usa el servidor. */
  private escribirCampoPropuesto(campoId: string, valor: string | null): void {
    const numero = (v: string | null) => (v ? Number(v) : null);
    const lista = (v: string | null) => (v ? v.split(',').map(Number).filter(n => n > 0) : []);
    this.formulario.update(actual => {
      if (!actual) return actual;
      switch (campoId) {
        case 'nombre': return { ...actual, nombre: valor ?? '' };
        case 'descripcion': return { ...actual, descripcion: valor };
        case 'alcance': return { ...actual, alcanceId: numero(valor) };
        case 'modalidad': return { ...actual, modalidadId: numero(valor) };
        case 'periodicidad': return { ...actual, periodicidad: valor };
        case 'periodicidadDetalle': return { ...actual, periodicidadDetalle: valor };
        case 'nivelCobertura': return { ...actual, nivelCobertura: valor ?? '' };
        case 'codigoDepartamento': return { ...actual, codigoDepartamento: valor };
        case 'codigoMunicipio': return { ...actual, codigoMunicipio: valor };
        case 'lugarEspecifico': return { ...actual, lugarEspecifico: valor };
        case 'correoMercado': return { ...actual, correoMercado: valor };
        case 'telefonoMercado': return { ...actual, telefonoMercado: valor };
        case 'sitioWebMercado': return { ...actual, sitioWebMercado: valor };
        case 'instagramMercado': return { ...actual, instagramMercado: valor };
        case 'facebookMercado': return { ...actual, facebookMercado: valor };
        case 'otroEnlaceMercado': return { ...actual, otroEnlaceMercado: valor };
        case 'festival': return { ...actual, festivalId: numero(valor), seRealizaEnElMarcoDeUnFestival: !!valor };
        case 'practicasMusicales': return { ...actual, practicasMusicalesIds: lista(valor) };
        case 'territoriosSonoros': return { ...actual, territoriosSonorosIds: lista(valor) };
        default: return actual;
      }
    });
  }

  /**
   * Lo que cambia entre la ficha publicada y lo que hay escrito, con los nombres de campo del
   * servidor.
   *
   * <b>LOS NOMBRES SON LOS DEL CATALOGO DEL SERVIDOR</b> —`CamposProponiblesDeMercado`—, que es la
   * lista cerrada de lo que admite propuesta. Un nombre que no esté ahí lo rechaza el servidor con
   * un 400, que es exactamente lo que tiene que pasar si esta tabla y aquella se separan.
   */
  private diferenciasDeLaPropuesta(): { campoId: string; valorPropuesto: string | null }[] {
    const m = this.mercado();
    const f = this.formulario();
    if (!m || !f) return [];

    const texto = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
    const lista = (ids: number[]) => (ids.length === 0 ? null : [...ids].sort((a, b) => a - b).join(','));

    const pares: { campoId: string; antes: string | null; ahora: string | null }[] = [
      { campoId: 'nombre', antes: texto(m.nombre), ahora: texto(f.nombre) },
      { campoId: 'descripcion', antes: texto(m.descripcion), ahora: texto(f.descripcion) },
      { campoId: 'alcance', antes: texto(m.alcanceId), ahora: texto(f.alcanceId) },
      { campoId: 'modalidad', antes: texto(m.modalidadId), ahora: texto(f.modalidadId) },
      { campoId: 'periodicidad', antes: texto(m.periodicidad), ahora: texto(f.periodicidad) },
      { campoId: 'periodicidadDetalle', antes: texto(m.periodicidadDetalle), ahora: texto(f.periodicidadDetalle) },
      { campoId: 'nivelCobertura', antes: texto(m.nivelCobertura), ahora: texto(f.nivelCobertura) },
      { campoId: 'codigoDepartamento', antes: texto(m.codigoDepartamento), ahora: texto(f.codigoDepartamento) },
      { campoId: 'codigoMunicipio', antes: texto(m.codigoMunicipio), ahora: texto(f.codigoMunicipio) },
      { campoId: 'lugarEspecifico', antes: texto(m.lugarEspecifico), ahora: texto(f.lugarEspecifico) },
      { campoId: 'correoMercado', antes: texto(m.correoMercado), ahora: texto(f.correoMercado) },
      { campoId: 'telefonoMercado', antes: texto(m.telefonoMercado), ahora: texto(f.telefonoMercado) },
      { campoId: 'sitioWebMercado', antes: texto(m.sitioWebMercado), ahora: texto(f.sitioWebMercado) },
      { campoId: 'instagramMercado', antes: texto(m.instagramMercado), ahora: texto(f.instagramMercado) },
      { campoId: 'facebookMercado', antes: texto(m.facebookMercado), ahora: texto(f.facebookMercado) },
      { campoId: 'otroEnlaceMercado', antes: texto(m.otroEnlaceMercado), ahora: texto(f.otroEnlaceMercado) },
      { campoId: 'festival', antes: texto(m.festivalId), ahora: texto(f.seRealizaEnElMarcoDeUnFestival ? f.festivalId : null) },
      { campoId: 'practicasMusicales', antes: lista(m.practicasMusicales.map(x => x.id)), ahora: lista(f.practicasMusicalesIds ?? []) },
      { campoId: 'territoriosSonoros', antes: lista(m.territoriosSonoros.map(x => x.id)), ahora: lista(f.territoriosSonorosIds ?? []) },
    ];

    return pares
      .filter(par => par.antes !== par.ahora)
      .map(par => ({ campoId: par.campoId, valorPropuesto: par.ahora }));
  }

  /** Cuántos campos cambiaría lo que hay escrito ahora mismo. */
  readonly cuantosCamposCambian = computed(() => {
    this.formulario();
    return this.diferenciasDeLaPropuesta().length;
  });

  /** Guarda el borrador de la propuesta. No toca la ficha publicada. */
  guardarLaPropuesta(motivo: string): void {
    const m = this.mercado();
    if (!m) return;
    const campos = this.diferenciasDeLaPropuesta();
    this.error.set('');
    this.guardandoLaPropuesta.set(true);
    this.api.guardarPropuestaDeMercado(String(m.id), motivo.trim() || null, campos).subscribe({
      next: propuesta => {
        this.propuesta.set(propuesta.id > 0 ? propuesta : null);
        this.guardandoLaPropuesta.set(false);
        this.proponiendo.set(false);
        this.editando.set(false);
        this.formulario.set(null);
        // DE VUELTA A «VISTA GENERAL», que es donde vive el estado de la propuesta y el botón de
        // enviarla. Quedarse en el formulario dejaba la propuesta guardada y sin forma visible de
        // mandarla: había que saber que estaba en otra pestaña.
        this.seccionActiva.set('resumen');
        this.aviso.set('Propuesta guardada. Todavía no la ve el PNMC: envíala cuando esté lista.');
      },
      error: (fallo: FalloDelServidor) => {
        this.guardandoLaPropuesta.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  /** Manda la propuesta al PNMC. Desde aquí ya no se toca. */
  async enviarLaPropuesta(): Promise<void> {
    const m = this.mercado();
    if (!m) return;
    const confirmacion = accionesDeProceso({
      tipo: 'mercado', nombre: m.nombre, estado: m.estadoRegistro, estadoPropuesta: 'borrador', esAdministradora: true,
    }).find(a => a.id === 'enviar-propuesta')?.confirmacion;
    if (confirmacion && !await this.confirmaciones.pedir(confirmacion)) return;
    this.error.set('');
    this.guardandoLaPropuesta.set(true);
    this.api.enviarPropuestaDeMercado(String(m.id)).subscribe({
      next: propuesta => {
        this.propuesta.set(propuesta);
        this.guardandoLaPropuesta.set(false);
        this.aviso.set('Tu propuesta está en la bandeja del PNMC.');
      },
      error: (fallo: FalloDelServidor) => {
        this.guardandoLaPropuesta.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  /** Abandona el borrador. Lo ya enviado no se abandona: se espera la decisión. */
  abandonarLaPropuesta(): void {
    const m = this.mercado();
    if (!m) return;
    this.error.set('');
    this.guardandoLaPropuesta.set(true);
    this.api.abandonarPropuestaDeMercado(String(m.id)).subscribe({
      next: () => {
        this.propuesta.set(null);
        this.guardandoLaPropuesta.set(false);
        this.proponiendo.set(false);
        this.editando.set(false);
        this.formulario.set(null);
        this.aviso.set('Se descartó la propuesta. La ficha publicada no cambió.');
      },
      error: (fallo: FalloDelServidor) => {
        this.guardandoLaPropuesta.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  /** Cierra el formulario de propuesta sin guardar nada. */
  cancelarLaPropuesta(): void {
    this.proponiendo.set(false);
    this.editando.set(false);
    this.formulario.set(null);
  }

  /** Las notas de una sección, para pintarlas donde están los campos que las motivaron. */
  cambiosDeLaSeccion(seccionId: string): ObservacionDeCampoDeMercado[] {
    return this.cambiosPedidos().filter(cambio => cambio.seccionId === seccionId);
  }

  /**
   * Marca o desmarca un cambio como atendido.
   *
   * SE PUEDE DESMARCAR: marcar por error es fácil y frecuente, y sin la vuelta atrás la única
   * salida sería pedirle al PNMC que reescriba la nota.
   */
  alternarCambio(cambio: ObservacionDeCampoDeMercado): void {
    this.marcando.set(cambio.id);
    this.error.set('');
    this.api.atenderCambioPedidoDeMercado(cambio.id, cambio.estado !== 'atendida').subscribe({
      next: actualizado => {
        this.marcando.set(null);
        this.cambiosPedidos.update(lista => lista.map(x => (x.id === actualizado.id ? actualizado : x)));
      },
      error: (fallo: FalloDelServidor) => {
        this.marcando.set(null);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  private cargarEdicionMasReciente(mercadoId: string): void {
    this.api.obtenerEdicionesDeMercado(mercadoId).pipe(catchError(() => of([] as EdicionDeMercadoDeLaOrganizacion[])))
      // LA LISTA VIENE DE LA MAS RECIENTE A LA MAS ANTIGUA desde el servidor. Volver a ordenarla
      // aquí duplicaría un criterio que ya está decidido.
      .subscribe(lista => this.edicionMasReciente.set(lista[0] ?? null));
  }

  territorio(): string {
    const m = this.mercado();
    if (!m) return '';
    if (m.nivelCobertura === 'nacional') return 'Todo el país';
    return [m.nombreMunicipio, m.nombreDepartamento].filter(Boolean).join(', ') || 'Territorio por definir';
  }

  departamentos(): { codigo: string; nombre: string }[] {
    const unicos = new Map(this.ubicaciones().map(fila => [fila.departmentCode, fila.departmentName]));
    return Array.from(unicos, ([codigo, nombre]) => ({ codigo, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  municipios(): UbicacionDivipola[] {
    const codigo = this.formulario()?.codigoDepartamento;
    if (!codigo) return [];
    return this.ubicaciones().filter(fila => fila.departmentCode === codigo);
  }

  empezarAEditar(): void {
    const m = this.mercado();
    if (!m) return;
    this.aviso.set('');
    this.error.set('');
    this.formulario.set({
      nombre: m.nombre,
      descripcion: m.descripcion,
      alcanceId: m.alcanceId,
      modalidadId: m.modalidadId,
      periodicidad: m.periodicidad,
      periodicidadDetalle: m.periodicidadDetalle,
      correoMercado: m.correoMercado,
      telefonoMercado: m.telefonoMercado,
      sitioWebMercado: m.sitioWebMercado,
      instagramMercado: m.instagramMercado,
      facebookMercado: m.facebookMercado,
      otroEnlaceMercado: m.otroEnlaceMercado,
      observacionesContacto: m.observacionesContacto,
      nivelCobertura: m.nivelCobertura,
      codigoDepartamento: m.codigoDepartamento,
      codigoMunicipio: m.codigoMunicipio,
      sedeCodigoDepartamento: m.sede?.codigoDepartamento ?? null,
      sedeCodigoMunicipio: m.sede?.codigoMunicipio ?? null,
      lugarEspecifico: m.lugarEspecifico,
      seRealizaEnElMarcoDeUnFestival: m.seRealizaEnElMarcoDeUnFestival,
      festivalId: m.festivalId,
      organizacionId: m.organizacionId,
      // CON LO QUE YA TIENE: abrir las listas vacías haría que guardar un cambio de nombre le
      // borrara las prácticas sin que nadie lo pidiera.
      practicasMusicalesIds: m.practicasMusicales.map(x => x.id),
      territoriosSonorosIds: m.territoriosSonoros.map(x => x.id),
    });
    this.editando.set(true);
  }

  /** En revisión lo que se deshace es el envío; en borrador, lo que se abandona es el registro. */
  readonly estaEnBorrador = computed(() => this.mercado()?.estadoRegistro === 'borrador');

  readonly estaPublicado = computed(() => this.mercado()?.estadoRegistro === 'publicado');

  pedirConfirmacionDelRetiro(): void {
    this.error.set('');
    this.aviso.set('');
    this.retiroEnConfirmacion.set(true);
  }

  cancelarElRetiro(): void { this.retiroEnConfirmacion.set(false); }

  /**
   * Deshace el envío a revisión, o abandona el borrador.
   *
   * <b>LO DECIDE EL SERVIDOR, NO ESTA PANTALLA:</b> en revisión devuelve el mercado a borrador y en
   * borrador lo archiva. Aquí solo se dice cuál de las dos va a pasar, para que quien pulsa lo sepa
   * antes y no después.
   */
  retirarElMercado(): void {
    const m = this.mercado();
    if (!m) return;

    const eraBorrador = this.estaEnBorrador();
    this.retirando.set(true);
    this.error.set('');
    this.api.retirarMercado(String(m.id)).subscribe({
      next: () => {
        this.retirando.set(false);
        this.retiroEnConfirmacion.set(false);
        // SE VUELVE A LA LISTA cuando el registro se archivó: quedarse en la ficha de algo que ya
        // no se administra es enseñar una pantalla sin acciones y sin explicación.
        if (eraBorrador) {
          void this.router.navigate(this.enPanel('procesos/mercados'));
          return;
        }
        this.mercado.set({ ...m, estadoRegistro: 'borrador' });
        this.aviso.set('El envío se deshizo. El mercado volvió a borrador y puedes corregirlo.');
      },
      error: (fallo: FalloDelServidor) => {
        this.retirando.set(false);
        this.retiroEnConfirmacion.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  pedirElRetiroAlPrograma(): void {
    this.error.set('');
    this.aviso.set('');
    this.solicitudDeRetiro.set({ justificacion: '' });
  }

  justificacionDelRetiro(valor: string): void {
    const abierta = this.solicitudDeRetiro();
    if (abierta) this.solicitudDeRetiro.set({ justificacion: valor });
  }

  cancelarLaSolicitud(): void { this.solicitudDeRetiro.set(null); }

  /** Un mercado publicado no lo quita su organización: lo pide, y el PNMC decide. */
  enviarLaSolicitudDeRetiro(justificacion: string): void {
    const m = this.mercado();
    if (!m || !justificacion.trim()) return;

    this.solicitando.set(true);
    this.error.set('');
    this.api.solicitarRetiroDeMercado(String(m.id), justificacion.trim()).subscribe({
      next: () => {
        this.solicitando.set(false);
        this.solicitudDeRetiro.set(null);
        this.retiroSolicitado.set(true);
        this.aviso.set('La solicitud de retiro quedó en la bandeja del PNMC.');
      },
      error: (fallo: FalloDelServidor) => {
        this.solicitando.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  /** Abre la corrección del contacto CON LO QUE YA HAY, no con los campos vacíos. */
  empezarACorregirElContacto(): void {
    const m = this.mercado();
    if (!m) return;
    this.error.set('');
    this.aviso.set('');
    this.contactoEnEdicion.set({
      correoMercado: m.correoMercado,
      telefonoMercado: m.telefonoMercado,
      sitioWebMercado: m.sitioWebMercado,
      instagramMercado: m.instagramMercado,
      facebookMercado: m.facebookMercado,
      otroEnlaceMercado: m.otroEnlaceMercado,
      observacionesContacto: m.observacionesContacto,
    });
  }

  cancelarLaCorreccionDelContacto(): void { this.contactoEnEdicion.set(null); }

  campoDelContacto<K extends keyof ContactoPublicoDeMercadoSolicitud>(
    clave: K, valor: ContactoPublicoDeMercadoSolicitud[K]): void {
    this.contactoEnEdicion.update(actual => (actual ? { ...actual, [clave]: valor } : actual));
  }

  guardarElContacto(): void {
    const m = this.mercado();
    const contacto = this.contactoEnEdicion();
    if (!m || !contacto) return;

    this.guardandoContacto.set(true);
    this.error.set('');
    this.api.actualizarContactoDeMercado(String(m.id), contacto).subscribe({
      next: actualizado => {
        this.guardandoContacto.set(false);
        this.contactoEnEdicion.set(null);
        this.mercado.set(actualizado);
        this.aviso.set('El contacto del mercado quedó actualizado en el portal.');
      },
      error: (fallo: FalloDelServidor) => {
        this.guardandoContacto.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  /** Lleva a «Información» y abre el editor: es lo que hace «Editar el mercado» de la cabecera. */
  abrirLaInformacion(): void {
    this.seccionActiva.set('informacion');
    this.router.navigate([], { relativeTo: this.route, queryParams: { seccion: 'informacion' }, queryParamsHandling: 'merge' });
    if (this.sePuedeEditar()) this.empezarAEditar();
  }

  cancelarEdicion(): void {
    this.editando.set(false);
    this.formulario.set(null);
  }

  /** Marca o desmarca un valor de catálogo; la lista la mantiene el formulario, no el control. */
  alternarDeCatalogo(clave: 'practicasMusicalesIds' | 'territoriosSonorosIds', id: number): void {
    this.formulario.update(actual => {
      if (!actual) return actual;
      const lista = actual[clave].includes(id) ? actual[clave].filter(x => x !== id) : [...actual[clave], id];
      return { ...actual, [clave]: lista };
    });
  }

  /** Los nombres de lo elegido, para la vista de lectura. */
  nombresDeCatalogo(valores: { nombre: string }[]): string {
    return valores.length ? valores.map(x => x.nombre).join(', ') : 'Sin registrar';
  }

  campo<K extends keyof GuardarMercadoSolicitud>(clave: K, valor: GuardarMercadoSolicitud[K]): void {
    this.formulario.update(actual => (actual ? { ...actual, [clave]: valor } : actual));
  }

  cambiarCobertura(nivel: string): void {
    this.formulario.update(actual => {
      if (!actual) return actual;
      if (nivel === 'nacional') return { ...actual, nivelCobertura: nivel, codigoDepartamento: null, codigoMunicipio: null };
      if (nivel === 'departamental') return { ...actual, nivelCobertura: nivel, codigoMunicipio: null };
      return { ...actual, nivelCobertura: nivel };
    });
  }

  /** La sede principal, aparte de la cobertura: la elige el selector común. */
  alCorregirLaSede(sede: SedeDelServidor | null): void {
    this.mercado.update(actual => (actual ? { ...actual, sede } : actual));
  }

  cambiarSede(sede: SedeElegida): void {
    this.formulario.update(actual => (actual
      ? { ...actual, sedeCodigoDepartamento: sede.departamento || null, sedeCodigoMunicipio: sede.municipio || null }
      : actual));
  }

  cambiarDepartamento(codigo: string): void {
    this.formulario.update(actual =>
      actual ? { ...actual, codigoDepartamento: codigo || null, codigoMunicipio: null } : actual);
  }

  cambiarSiEstaEnUnFestival(dentro: boolean): void {
    this.formulario.update(actual =>
      actual ? { ...actual, seRealizaEnElMarcoDeUnFestival: dentro, festivalId: dentro ? actual.festivalId : null } : actual);
  }

  guardar(): void {
    const m = this.mercado();
    const datos = this.formulario();
    if (!m || !datos) return;

    this.guardando.set(true);
    this.error.set('');
    this.api.guardarMercado(String(m.id), datos).subscribe({
      next: actualizado => {
        this.mercado.set(actualizado);
        this.guardando.set(false);
        this.editando.set(false);
        this.formulario.set(null);
        this.aviso.set('Cambios guardados.');
        // LIS-01: el servidor da por atendidos los ajustes de los campos que cambiaron, así que la
        // lista se vuelve a pedir en vez de pedir que se marquen a mano.
        this.cargarLosCambiosPedidos(String(actualizado.id));
      },
      error: (fallo: FalloDelServidor) => {
        this.guardando.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  async enviarARevision(): Promise<void> {
    const m = this.mercado();
    if (!m) return;
    // (L6): enviar a revisión cambia lo que se puede hacer y lo lee otra persona, así que se
    // confirma en el diálogo común, con el texto del modelo de acciones.
    const confirmacion = accionesDeProceso({
      tipo: 'mercado', nombre: m.nombre, estado: m.estadoRegistro, esAdministradora: true,
    }).find(a => a.id === 'enviar' || a.id === 'reenviar')?.confirmacion;
    if (confirmacion && !await this.confirmaciones.pedir(confirmacion)) return;
    this.enviando.set(true);
    this.error.set('');
    this.api.enviarMercadoARevision(String(m.id)).subscribe({
      next: actualizado => {
        this.mercado.set(actualizado);
        this.enviando.set(false);
        this.aviso.set('El mercado quedó en la cola de revisión del PNMC.');
      },
      error: (fallo: FalloDelServidor) => {
        this.enviando.set(false);
        this.error.set(this.motivoDe(fallo));
      },
    });
  }

  /**
   * El motivo que devolvió el servidor, y no uno genérico.
   *
   * Al enviar a revisión el servidor comprueba lo que falta —descripción, alcance, modalidad, una
   * forma de contacto— y responde diciendo exactamente cuál. Taparlo con «no fue posible» obliga a
   * adivinar qué campo llenar.
   */
  private motivoDe(fallo: unknown): string {
    return motivoDeLaAccion(fallo, 'No fue posible completar la acción.');
  }
}
