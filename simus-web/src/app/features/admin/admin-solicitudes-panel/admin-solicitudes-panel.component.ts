import { Component, Input, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideArrowLeft, LucideX } from '@lucide/angular';
import { BotonComponent } from '../../../shared/components/ui/boton/boton.component';
import { SelectorSegmentadoComponent } from '../../../shared/components/ui/selector-segmentado/selector-segmentado.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { NombrePropioPipe } from '../../../shared/texto/nombre-propio.pipe';
import { EntradaDeHistorialDeEstados, HistorialDeEstadosComponent } from '../../../shared/components/ui/historial-de-estados/historial-de-estados.component';
import { ActuacionDeAuditoria, AdminService, DetalleDeReclamacion, FichaDeFestivalEnRevision } from '../../../core/services/admin.service';
import { etiquetaDeEstado } from '../domain/admin-config';
import { FichaEnRevisionComponent } from '../admin-festival-review-panel/ficha-en-revision.component';
import {
  PropuestaDeCambio, PropuestasDeProcesoService, RUTA_DE_PROPUESTAS_POR_MODULO, RutaDeProcesoConPropuestas,
} from '../../../core/services/propuestas-de-proceso.service';
import { PROCESOS_DE_LA_CONSOLA, ProcesosDeLaConsolaService, esTipoDeProceso } from '../../../core/services/procesos-de-la-consola.service';
import { BandejaDeTrabajoService } from './bandeja-de-trabajo.service';
import { CatalogService, TerritorioConCodigo } from '../../../core/services/catalog.service';
import { nombreDelTerritorioConCodigo } from '../domain/nombre-del-territorio-con-codigo';
import { FichaDeConsola } from '../domain/ficha-de-consola';
import { AdminFichaFestivalComponent } from '../admin-ficha-festival/admin-ficha-festival.component';
import { etiquetaDePeriodicidad, valorLegibleDeUnCampo } from '../../../core/vocabularios/periodicidad';
import { FechaPipe } from '../../../shared/utils/fecha.pipe';
import { leerInstante } from '../../../shared/utils/formatos-de-fecha';
import { etiquetaDeCobertura } from '../../../core/vocabularios/cobertura';
import { EsqueletoComponent } from '../../../shared/components/ui/esqueleto/esqueleto.component';

/**
 * Una de las dos caras de una propuesta de cambios: lo publicado hoy, y lo que se propone.
 *
 * LAS DOS TIENEN LA MISMA FORMA a propósito. Comparar campo a campo exige que los dos lados se
 * lean igual; con dos formas distintas, la comparación se escribe dos veces y la segunda se olvida.
 * Portado desde `AdminFestivalReviewPanelComponent`, que dejó de montarse por separado el 2 de
 * septiembre de 2026: la bandeja unificada es ahora el único sitio que decide sobre una propuesta.
 */
interface CaraDeLaPropuesta {
  nombre: string;
  descripcion: string | null;
  nivelCobertura: string;
  codigoDepartamento: string | null;
  codigoMunicipio: string | null;
  periodicidad: string | null;
  correoContacto: string | null;
  telefonoContacto: string | null;
  instagram: string | null;
  facebook: string | null;
  paginaWeb: string | null;
  otroEnlace: string | null;
  observacionesContacto: string | null;
  director: string | null;
  tipoOrganizadorId: number | null;
  practicasMusicales: { id: number; nombre: string }[];
  territoriosSonoros: { id: number; nombre: string }[];
}

interface DetalleDePropuesta {
  propuesta: CaraDeLaPropuesta & { id: number };
  publicado: CaraDeLaPropuesta;
  historial: any[];
}

/** Una línea de la comparación entre lo publicado y lo propuesto. */
interface FilaComparada {
  etiqueta: string;
  vigente: string;
  propuesto: string;
  cambia: boolean;
}

/**
 * SOLICITUDES Y REVISIONES: la bandeja de lo que espera una decisión del Programa.
 *
 * <b>ERA PARTE DEL ARMAZÓN.</b> Hasta esta pantalla vivía dentro de
 * `AdminShellPageComponent`: cuatrocientas líneas de su plantilla y treinta y cinco miembros que no
 * tenían nada que ver con navegar, sondear ni abrir sesión. Era la única sección de la consola sin
 * panel propio, y la que más lógica tenía. Sale aquí con sus pruebas; la cola que lista vive en
 * `BandejaDeTrabajoService`, porque la barra izquierda y el Resumen operativo también la leen.
 *
 * Lo que este panel hace: filtrar y ordenar la cola, elegir un trámite y previsualizarlo al lado,
 * cambiar del resumen a la ficha entera sin abrir otra cosa, y decidir aquí mismo lo que cabe en
 * el panel —propuestas, vinculaciones, retiros, reclamaciones, duplicados, alertas y eventos—.
 */
/**
 * Lo mínimo que la bandeja necesita de un asunto para decidirlo.
 *
 * SE DECLARA UNA VEZ. La misma forma estaba escrita a mano en tres firmas —abrir la confirmación,
 * guardarla y ejecutarla—, y `rawId` viaja sin tipo porque cada circuito lo espera distinto: número
 * en los institucionales, cadena en las reclamaciones y los duplicados.
 */
interface AsuntoDecidible { kind: string; rawId: any; module: string; record?: string }

@Component({
  selector: 'app-admin-solicitudes-panel',
  standalone: true,
  imports: [EsqueletoComponent, FechaPipe,
    CommonModule,
    FormsModule,
    BotonComponent,
    SelectorSegmentadoComponent,
    FiltroDesplegableComponent,
    NombrePropioPipe,
    HistorialDeEstadosComponent,
    FichaEnRevisionComponent,
    AdminFichaFestivalComponent,
    LucideArrowLeft,
    LucideX,
  ],
  templateUrl: './admin-solicitudes-panel.component.html',
  styleUrl: './admin-solicitudes-panel.component.css',
})
export class AdminSolicitudesPanelComponent implements OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly catalogo = inject(CatalogService);
  /** El catálogo DIVIPOLA, para decir «Atlántico (08)» y no «08» en la comparación de una propuesta. Se pide una vez. */
  private readonly territorios = signal<readonly TerritorioConCodigo[]>([]);
  private territoriosPedidos = false;
  /** La periodicidad se lee por su nombre, no por su código: «otra_regular» no es una palabra. */
  readonly etiquetaDePeriodicidad = etiquetaDePeriodicidad;
  readonly etiquetaDeCobertura = etiquetaDeCobertura;

  readonly bandeja = inject(BandejaDeTrabajoService);

  /**
   * «PENDIENTES» Y «RESUELTAS (30 DÍAS)». Al decidir, el trámite salía de la bandeja y no
   * quedaba vista alguna de lo hecho. Es una segunda vista de la misma bandeja, no otra sección.
   */
  readonly vistaDeLaBandeja = signal<'pendientes' | 'resueltas'>('pendientes');
  readonly resueltas = signal<ActuacionDeAuditoria[] | null>(null);
  readonly cargandoResueltas = signal(false);
  readonly errorDeResueltas = signal('');
  readonly diasDeResueltas = signal(30);

  readonly vistasDeLaBandeja = computed<{ id: string; etiqueta: string; conteo?: number }[]>(() => [
    // El conteo de las pestañas describe la lista que se ve (§30.4 de `docs/desarrollo/30-consola-y-acceso.md`): lo que espera decisión.
    { id: 'pendientes', etiqueta: 'Pendientes', conteo: this.bandeja.colaCompleta().length },
    { id: 'resueltas', etiqueta: `Resueltas (${this.diasDeResueltas()} días)`, conteo: this.resueltas()?.length },
  ]);

  cambiarVistaDeLaBandeja(id: string): void {
    const vista = id === 'resueltas' ? 'resueltas' : 'pendientes';
    this.vistaDeLaBandeja.set(vista);
    if (vista === 'resueltas') this.cargarResueltas();
  }

  cargarResueltas(): void {
    this.cargandoResueltas.set(true);
    this.errorDeResueltas.set('');
    this.adminService.cargarResueltas().subscribe({
      next: respuesta => {
        this.resueltas.set(respuesta.items);
        this.diasDeResueltas.set(respuesta.dias);
        this.cargandoResueltas.set(false);
      },
      error: () => {
        this.errorDeResueltas.set('No fue posible consultar lo resuelto. Inténtalo de nuevo.');
        this.cargandoResueltas.set(false);
      },
    });
  }
  private readonly propuestasDeProceso = inject(PropuestasDeProcesoService);
  private readonly fichaUrl = inject(FichaDeConsola);
  private readonly procesos = inject(ProcesosDeLaConsolaService);
  /** Para la plantilla: si el módulo del trámite es uno de los tres procesos con circuito común. */
  readonly esProceso = esTipoDeProceso;

  /** La ficha completa de un Taller, Espacio o Red es la de su módulo: la bandeja lleva a ella. */
  abrirLaFichaDelProceso(item: { module: string; rawId: unknown }): void {
    this.fichaUrl.abrir(item.module, String(item.rawId));
  }

  /** Los dos formatos acordados, expuestos para la plantilla. Ver `shared/utils/formatos-de-fecha.ts`. */
  /** El estado con su nombre, nunca con su código. */
  readonly etiquetaDeEstado = etiquetaDeEstado;

  constructor() {
    // UN TRAMITE PEDIDO DESDE FUERA se abre en cuanto está en la cola: da igual si la cola ya
    // estaba cargada cuando se pidió o si llega después de que este panel se montara.
    effect(() => {
      const pedido = this.bandeja.tramiteDeFestivalPedido();
      if (!pedido) return;
      const tramite = this.bandeja.colaCompleta().find(item => String(item.festivalId) === pedido);
      if (!tramite) return;
      untracked(() => {
        this.elegirTramite(tramite);
        this.bandeja.tramiteDeFestivalPedido.set(null);
      });
    });

    // LA DIRECCION MANDA: `/administracion/solicitudes/{id}[/ficha]` abre ese asunto, y
    // «Atrás» —que quita el id— lo cierra. Se lee tambien la cola y su estado de carga, porque un
    // enlace puede llegar antes que las listas.
    effect(() => {
      const id = this.fichaUrl.id();
      const vista = this.fichaUrl.vista();
      const cola = this.bandeja.colaCompleta();
      const cargada = this.bandeja.colaCargada();
      untracked(() => this.reflejarLaDireccion(id, vista, cola, cargada));
    });
  }

  /** El aviso de un enlace a un asunto que ya no está pendiente. Vacío si no hay nada que decir. */
  readonly avisoDeEnlace = signal('');

  private idVistoEnLaDireccion: string | null = null;
  private vistaVistaEnLaDireccion: string | null = null;

  /**
   * Lleva lo que dice la dirección a la pantalla.
   *
   * <b>SOLO SE CIERRA CUANDO LA DIRECCION CAMBIA.</b> Una fila recién pulsada pone su estado al
   * instante y la dirección lo alcanza un instante después; si cada cambio de la cola cerrara «lo que
   * la dirección no dice», el trámite recién abierto se cerraría solo. Por eso se compara con lo
   * último visto: abrir y cerrar son reacciones a un CAMBIO de dirección.
   */
  private reflejarLaDireccion(
    id: string | null,
    vista: string | null,
    cola: readonly { id: string; kind: string; rawId: unknown; module: string; record?: string; organization?: string }[],
    cargada: boolean,
  ): void {
    const cambioElId = id !== this.idVistoEnLaDireccion;
    const cambioLaVista = vista !== this.vistaVistaEnLaDireccion;
    this.idVistoEnLaDireccion = id;
    this.vistaVistaEnLaDireccion = vista;

    if (!id) {
      if (cambioElId && this.tramiteElegidoId()) { this.cerrarTramiteLocal(); }
      return;
    }
    const item = cola.find(fila => fila.id === id);
    if (!item) {
      // TODAVIA NO SE SABE no es «ya no existe». Solo con la cola entera cargada se puede decir.
      if (!cargada) { return; }
      const estabaAbierto = this.tramiteElegidoId() === id;
      this.cerrarTramiteLocal();
      // Decidido desde aquí: el aviso de la decisión ya se dio. Un enlace a algo ya resuelto sí
      // necesita explicación, o parece que el enlace está roto.
      if (!estabaAbierto) {
        this.avisoDeEnlace.set('Esa solicitud ya no está pendiente: se decidió, se retiró o el enlace es antiguo.');
      }
      this.fichaUrl.cerrar('solicitudes', { reemplazar: true });
      return;
    }
    this.avisoDeEnlace.set('');
    if (this.tramiteElegidoId() !== id) {
      // El filtro de la bandeja no puede esconder el asunto que la dirección pide.
      const filtro = this.bandeja.filtro();
      if (filtro !== 'todos' && filtro !== item.kind) { this.bandeja.cambiarFiltro('todos'); }
      this.abrirTramiteLocal(item);
    }
    if (cambioElId || cambioLaVista) {
      if (vista === 'ficha' && this.tieneFichaCompleta(item)) {
        this.abrirLaFichaCompleta(item);
      } else if (this.vistaDelTramite() === 'ficha') {
        this.vistaDelTramite.set('resumen');
        this.fichaEnRevisionAbierta.set(null);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.temporizadorAvisoTemporal) clearTimeout(this.temporizadorAvisoTemporal);
  }

  /** La ruta de propuestas del proceso de un asunto de la bandeja, o `null` si no es de un proceso con propuestas (Festival). */
  rutaDeLaPropuesta(item: { module?: unknown }): RutaDeProcesoConPropuestas | null {
    return RUTA_DE_PROPUESTAS_POR_MODULO[String(item.module ?? '').toLowerCase()] ?? null;
  }

  etiquetaModulo(modulo: string | null | undefined): string {
    const normalizado = String(modulo ?? '').trim().toLowerCase();
    return normalizado === 'festivals' || normalizado === 'festival' ? 'Festivales'
      : normalizado === 'festivales_retiro' ? 'Festivales'
        : normalizado === 'mercados_retiro' || normalizado === 'mercados' ? 'Mercados musicales'
          : normalizado === 'talleres' ? 'Talleres de lutería'
          : normalizado === 'espacios' ? 'Espacios para música en vivo'
          : normalizado === 'redes' ? 'Redes y documentación'
          : normalizado === 'agenda' ? 'Agenda y eventos'
            : esTipoDeProceso(normalizado) ? PROCESOS_DE_LA_CONSOLA[normalizado].modulo
            // Un módulo sin etiqueta propia se dice con mayúscula inicial, no con el identificador crudo (D3-06).
            : normalizado ? normalizado.charAt(0).toUpperCase() + normalizado.slice(1) : '—';
  }

  /** La modalidad de un evento como se rotula en el formulario de la organización: «Presencial», no «presencial» (D3-06). */
  etiquetaModalidad(modalidad: string | null | undefined): string {
    const texto = String(modalidad ?? '').trim();
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : '—';
  }

  /** El valor de un dato de la comparación como lo dice el resto de la plataforma (D3-04). */
  legible(clave: string, valor: unknown): string { return valorLegibleDeUnCampo(clave, valor); }

  nombresCatalogo(items: { nombre: string }[]): string {
    return items.map(item => item.nombre).filter(Boolean).join(', ');
  }

  /**
   * ¿Este trámite se decide aquí mismo, o hay que abrir la ficha completa?
   *
   * <b>LA BANDEJA MEZCLA DOS COSAS MUY DISTINTAS Y NO LO DECIA.</b> Una solicitud de retiro o una
   * reclamación se resuelven con la información que cabe en el panel: quién la pide, sobre qué y por
   * qué. El registro inicial de un festival, no: hay que mirar la ficha entera —cobertura, sedes,
   * programación, soportes— y eso vive en su propia pantalla.
   *
   * El resultado medido: de las diez filas de la bandeja, <b>nueve no ofrecían ninguna decisión</b>
   * al desplegarse, solo un botón para irse a otro sitio. Y la descripción de la sección prometía
   * «expande una fila para revisarla y decidir sin salir de aquí».
   *
   * Saberlo ANTES de desplegar cambia cómo se trabaja: lo que se decide aquí se puede despachar en
   * una sentada; lo que exige ficha completa se aparta para cuando haya tiempo.
   */
  seDecideAqui(item: { kind?: string }): boolean {
    return item.kind === 'revision' || item.kind === 'propuesta' || item.kind === 'solicitud'
        || item.kind === 'retiro' || item.kind === 'reclamacion'
        || item.kind === 'duplicado' || item.kind === 'alerta'
        // UN EVENTO TAMBIEN SE DECIDE AQUI. No es un registro completo que haya que revisar en su
        // propia ficha: es un anuncio corto —qué, cuándo y dónde— que cabe entero en el panel.
        || item.kind === 'evento';
  }

  /**
   * Cuánto lleva esperando algo, dicho como se dice en voz alta.
   *
   * <b>«12 SEPT 2026, 21:43» NO RESPONDE LA PREGUNTA.</b> Quien revisa no compara fechas: quiere
   * saber si esto lleva esperando desde ayer o desde hace tres semanas, y con la fecha absoluta hay
   * que restar mentalmente en cada fila. La fecha exacta sigue estando, en el atributo `title`.
   */
  haceCuanto(valor: unknown): string {
    const fecha = typeof valor === 'string' ? leerInstante(valor) : null;
    if (!fecha) { return '—'; }

    const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);
    if (minutos < 1) { return 'ahora mismo'; }
    if (minutos < 60) { return `hace ${minutos} min`; }
    const horas = Math.floor(minutos / 60);
    if (horas < 24) { return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`; }
    const dias = Math.floor(horas / 24);
    if (dias < 31) { return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`; }
    const meses = Math.floor(dias / 30);
    return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  }

  /**
   * Si algo lleva demasiado tiempo esperando.
   *
   * UNA SEMANA. No es un umbral cualquiera: por debajo, lo pendiente cabe en el ritmo normal de
   * trabajo; por encima, alguien lo está esperando desde antes de la semana pasada. La bandeja lo
   * señala para que no haya que ir comparando fechas fila a fila.
   */
  llevaDemasiado(valor: unknown): boolean {
    if (typeof valor !== 'string' || valor.length === 0) { return false; }
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) { return false; }
    return Date.now() - fecha.getTime() > 7 * 86400000;
  }


  /**
   * El criterio de orden de la bandeja.
   *
   * <b>HASTA HOY NO HABIA NINGUNO:</b> la cola concatenaba ocho listas en el orden en que llegaban
   * del servidor, y no se podía pedir «lo más viejo primero» ni «por organización». El dueño del
   * proyecto lo señaló: «es necesario en solicitudes y revisiones tener
   * criterios de organización: por fecha, por primera fecha de llegada, última fecha de llegada,
   * alfabéticamente».
   *
   * <b>LO MAS ANTIGUO PRIMERO ES EL ORDEN DE TRABAJO</b>, y por eso es el que viene puesto: una
   * bandeja se atiende por antigüedad, y lo que lleva más tiempo esperando es lo que más urge.
   */
  readonly ordenDeLaBandeja = signal<'antiguos' | 'recientes' | 'registro' | 'organizacion'>('antiguos');

  readonly OPCIONES_DE_ORDEN: readonly OpcionDeFiltro[] = [
    { id: 'antiguos', etiqueta: 'Llegada más antigua primero' },
    { id: 'recientes', etiqueta: 'Llegada más reciente primero' },
    { id: 'registro', etiqueta: 'Por registro, A–Z' },
    { id: 'organizacion', etiqueta: 'Por organización, A–Z' },
  ];

  /**
   * La cola que se ve: filtrada por tipo y ORDENADA ENTERA por el criterio elegido.
   *
   * Actúa sobre todo lo que hay en la bandeja, no sobre una página: la bandeja no pagina, así que
   * ordenar en memoria aquí es ordenar sobre el total, que es lo que la regla pide.
   */
  readonly colaVisible = computed(() => {
    const filter = this.bandeja.filtro();
    const orden = this.ordenDeLaBandeja();
    const cola = this.bandeja.colaCompleta().filter(item => filter === 'todos' || item.kind === filter);
    const marca = (item: { createdAt?: string | null }) => (item.createdAt ? new Date(item.createdAt).getTime() : 0);
    const texto = (valor: unknown) => String(valor ?? '').toLocaleLowerCase('es');
    return [...cola].sort((a, b) => {
      switch (orden) {
        case 'recientes': return marca(b) - marca(a);
        case 'registro': return texto(a.record).localeCompare(texto(b.record), 'es');
        case 'organizacion': return texto(a.organization).localeCompare(texto(b.organization), 'es');
        default: return marca(a) - marca(b);
      }
    });
  });

  /**
   * Lo que contiene la posición elegida, dicho en una línea debajo del filtro.
   *
   * <b>UN FILTRO CUYO NOMBRE HAY QUE ADIVINAR NO ES UN FILTRO.</b> «Propuestas», «Solicitudes» y
   * «Reclamaciones» eran tres palabras que la dirección de producto no pudo distinguir: «no sé qué
   * propuestas, qué es… no sé qué es solicitudes versus reclamaciones». El nombre corto va en la
   * posición y la explicación aquí, donde cabe.
   */
  readonly descripcionDelFiltro = computed(() => {
    // «TODO» NO SE EXPLICA: la cabecera de la sección ya dice qué es todo esto, y repetirlo debajo
    // de las pestañas era decir lo mismo dos veces. Lo señaló la dirección de producto el 15 de
    // septiembre de 2026: «el texto "Todo lo que espera una decisión del Programa" no va».
    const explicaciones: Record<string, string> = {
      revision: 'Festivales que una organización envió por primera vez y el PNMC aún no ha revisado.',
      evento: 'Eventos de agenda que una organización envió para publicar.',
      propuesta: 'Cambios que una organización propone sobre un registro que ya está publicado.',
      solicitud: 'Peticiones de una organización de vincularse a un registro que ya existe en el ecosistema.',
      retiro: 'Peticiones de retirar un registro del ecosistema.',
      reclamacion: 'Una organización pide administrar un Festival del registro histórico, que hoy no tiene organización.',
      duplicado: 'Pares de registros que el sistema cree que son el mismo, para decidir si lo son.',
      alerta: 'Campos que el sistema encontró incompletos o incoherentes en un registro.',
    };
    return explicaciones[this.bandeja.filtro()] ?? '';
  });

  /**
   * LAS POSICIONES DEL FILTRO, CADA UNA CON LO QUE HAY DETRAS.
   *
   * Antes eran dos `<select>` desnudos que no decían nada: había que abrirlos, elegir una opción y
   * esperar a ver si la lista quedaba vacía. Con el recuento al lado, el filtro deja de ser una
   * apuesta y pasa a ser un índice de la cola.
   *
   * <b>SE PINTAN TODAS SIEMPRE, TAMBIEN LAS QUE ESTAN EN CERO.</b> Hasta el 15 de septiembre
   * de 2026 se ocultaba lo vacío, con el argumento de que nueve pestañas en cero son nueve
   * promesas vacías. Ese argumento valía cuando «Calidad y coincidencias» seguía existiendo como
   * sección aparte y enseñaba sus cinco pestañas: había otro sitio donde ver que la capacidad
   * existe. Al unificar la bandeja, ocultarlas dejó SEIS capacidades invisibles —propuestas,
   * vinculaciones, eliminaciones, reclamaciones, duplicados y alertas—, y se
   * reportó como que habían desaparecido. Tenía razón: una capacidad que no se ve no existe.
   *
   * Un cero no es una promesa vacía si se dibuja como lo que es —nada pendiente de ese tipo—, que
   * es información y no un hueco; el desplegable de tipo lo lista con su cero (UI-05: ya no hay una
   fila de pestañas de tipo ni «Más tipos»), y al entrar, el estado vacío lo explica.
   * Es el mismo criterio que ya aplica el Resumen operativo con sus filas al día.
   */
  readonly filtrosDeLaBandeja = computed(() => {
    const cola = this.bandeja.colaCompleta();
    const puesta = this.bandeja.filtro();
    const cuenta = (kind: string) => cola.filter(item => item.kind === kind).length;
    const posiciones = [
      { id: 'todos', etiqueta: 'Todo', conteo: cola.length },
      { id: 'revision', etiqueta: 'Registros nuevos', conteo: cuenta('revision') },
      { id: 'evento', etiqueta: 'Eventos', conteo: cuenta('evento') },
      { id: 'propuesta', etiqueta: 'Cambios a lo publicado', conteo: cuenta('propuesta') },
      { id: 'solicitud', etiqueta: 'Vinculaciones', conteo: cuenta('solicitud') },
      { id: 'retiro', etiqueta: 'Eliminaciones', conteo: cuenta('retiro') },
      { id: 'reclamacion', etiqueta: 'Reclamos de administración', conteo: cuenta('reclamacion') },
      { id: 'duplicado', etiqueta: 'Duplicados', conteo: cuenta('duplicado') },
      { id: 'alerta', etiqueta: 'Alertas de calidad', conteo: cuenta('alerta') },
    ];
    // Ya no se filtra: `puesta` sigue leyéndose para que el cambio de filtro recalcule esta señal.
    void puesta;
    return posiciones;
  });

  /**
   * ELEGIR UN TRAMITE EN EL PANEL. No es lo mismo que `alternarTramite()`, que ALTERNA porque venía
   * de una fila que se expandía sobre sí misma: aquí volver a pulsar el trámite que ya se está
   * previsualizando tendría que dejarlo donde está, no vaciar el panel de al lado.
   */
  elegirTramite(item: { id: string; kind: string; rawId: unknown; module: string }): void {
    if (this.tramiteElegidoId() === item.id) return;
    this.abrirTramiteLocal(item);
    this.avisoDeEnlace.set('');
    // EL TRAMITE TIENE DIRECCION PROPIA: se puede compartir, recargar y volver con «Atrás».
    this.fichaUrl.abrir('solicitudes', item.id);
  }

  private abrirTramiteLocal(item: { id: string; kind: string; rawId: unknown; module: string }): void {
    // La ficha abierta es la del trámite anterior: se vuelve al resumen del nuevo.
    this.vistaDelTramite.set('resumen');
    this.fichaEnRevisionAbierta.set(null);
    this.alternarTramite(item);
  }

  /**
   * QUE SE ESTA MIRANDO DEL TRAMITE ELEGIDO: EL RESUMEN O LA FICHA ENTERA.
   *
   * Es UNA pantalla que cambia de contenido, no dos. El 14 de septiembre de 2026 el dueño del
   * proyecto lo pidió así: «que se sienta como un todo y no como fichas dentro de fichas, que se
   * sienta simplemente y que cambie la pantalla en una misma interfaz, no que se abre otra cosa
   * diferente». Por eso el encabezado del trámite —tipo, registro, cerrar— se queda quieto y solo
   * se sustituye lo de debajo, y por eso se elige con el mismo selector segmentado que filtra la
   * bandeja y no con un botón que «abre» algo.
   */
  readonly vistaDelTramite = signal<'resumen' | 'ficha'>('resumen');

/** Qué trámites tienen algo entero que mirar además del resumen, y cómo se llama. */
  private readonly SEGUNDA_VISTA: Record<string, string> = {
    revision: 'Ver la ficha completa',
    propuesta: 'Ver la comparación completa',
  };

  tieneFichaCompleta(item: { kind?: string } | null): boolean {
    // LOS TRES PROCESOS NUEVOS NO TIENEN UNA SEGUNDA VISTA EN LA BANDEJA: su ficha completa es la de su módulo.
    return !!item?.kind && item.kind in this.SEGUNDA_VISTA && !esTipoDeProceso((item as { module?: string }).module);
  }

  /** Cómo se llama, en este trámite, el botón que lleva a mirarlo entero. */
  readonly etiquetaDeLaFichaCompleta = computed(
    () => this.SEGUNDA_VISTA[this.tramiteElegido()?.kind ?? ''] ?? 'Ver la ficha completa',
  );

  cambiarVistaDelTramite(id: string): void {
    const elegido = this.tramiteElegido();
    if (id === 'ficha' && elegido) {
      this.abrirLaFichaCompleta(elegido);
      // LA FICHA COMPLETA TAMBIEN TIENE DIRECCION: `/administracion/solicitudes/{id}/ficha`.
      this.fichaUrl.abrir('solicitudes', elegido.id, { vista: 'ficha' });
      return;
    }
    this.vistaDelTramite.set('resumen');
    this.fichaEnRevisionAbierta.set(null);
    if (this.fichaUrl.vista() && elegido) { this.fichaUrl.abrir('solicitudes', elegido.id); }
  }

  private abrirLaFichaCompleta(elegido: { id: string; kind: string; rawId: unknown; module: string; record?: string; organization?: string }): void {
    this.vistaDelTramite.set('ficha');
    // `visualizar()` es quien sabe qué ficha corresponde a cada tipo de trámite.
    if (elegido.kind === 'revision' && !this.fichaEnRevisionAbierta()) {
      this.visualizar(elegido);
    }
  }

  /**
   * Qué decir cuando la posición elegida no tiene nada.
   *
   * Nombra el tipo, y explica de dónde vendría: un trámite lo envía alguien y un hallazgo lo
   * detecta el sistema, así que «no hay» significa cosas distintas y la frase tiene que decir cuál.
   */
  readonly nadaQueVerAqui = computed(() => {
    switch (this.bandeja.filtro()) {
      case 'todos': return 'No hay nada esperando una decisión.';
      case 'revision': return 'No hay registros esperando revisión.';
      case 'propuesta': return 'No hay propuestas de cambio sobre registros ya publicados.';
      case 'solicitud': return 'No hay solicitudes de vinculación esperando.';
      case 'retiro': return 'No hay solicitudes de eliminación esperando.';
      case 'reclamacion': return 'No hay reclamaciones de administración esperando.';
      case 'duplicado': return 'El sistema no ha detectado posibles duplicados sin resolver.';
      case 'alerta': return 'El sistema no ha abierto alertas de calidad sin resolver.';
      default: return 'No hay nada esperando en esta bandeja.';
    }
  });

  cambiarFiltroDeBandeja(id: string): void {
    this.bandeja.cambiarFiltro(id);
  }

  /** La fila expandida en la bandeja. Una a la vez: dos resúmenes abiertos invitan a decidir sobre el de al lado. */
  tramiteElegidoId = signal<string | null>(null);
  readonly tramiteElegido = computed(() => this.colaVisible().find(item => item.id === this.tramiteElegidoId()) ?? null);

  /**
   * EL DETALLE QUE SOLO HACE FALTA PEDIR PARA DOS TIPOS DE ASUNTO. Para una solicitud, un retiro o
   * una reclamación, `raw` ya trae el objeto completo tal como llegó -motivo, evidencia,
   * justificación-, así que expandir la fila no pide nada al servidor. Un Festival en revisión y
   * una propuesta de cambio sí necesitan una ficha aparte -doce campos y el historial, o la
   * comparación campo a campo contra lo publicado- que la bandeja no trae de por sí.
   */
  detalleCargando = signal(false);
  detalleError = signal('');
  detalleFestival = signal<FichaDeFestivalEnRevision | null>(null);
  detallePropuesta = signal<DetalleDePropuesta | null>(null);

  /**
   * La propuesta de cambio de un MERCADO, un TALLER, un ESPACIO o una RED, que viene de otra ruta y con otra forma.
   *
   * <b>ES OTRA SEÑAL Y NO LA MISMA.</b> La de Festival trae la versión vigente entera y la propuesta
   * entera; la de Mercado trae solo los campos que cambian, con su valor de antes copiado al
   * enviar. Abajo las dos se leen igual —una lista de filas comparadas—, y eso es lo que comparten.
   */
  detallePropuestaDeProceso = signal<PropuestaDeCambio | null>(null);

  /**
   * La reclamación abierta, con el histórico, la organización, lo que cambiaría y las relacionadas.
   *
   * <b>ANTES SE DECIDÍA SOLO CON LA JUSTIFICACIÓN.</b> No se veía el Festival, ni
   * quién era la organización, ni qué datos de la ficha publicada iba a cambiar, ni que otra
   * organización reclamaba un duplicado del mismo histórico.
   */
  detalleReclamacion = signal<DetalleDeReclamacion | null>(null);

  /**
   * Si quien mira es webmaster: solo él fusiona duplicados del registro histórico.
   *
   * Lo dice el shell, que es quien conoce los roles de la sesión. El servidor lo comprueba igual.
   */
  @Input() esWebmaster = false;

  /** El Festival cuya ficha se abrió aquí para fusionar duplicados, o `null`. */
  readonly fichaParaFusionar = signal<string | null>(null);

  /** Si entre las relacionadas hay otra copia del registro histórico. */
  tieneDuplicadoHistorico(d: DetalleDeReclamacion): boolean {
    return d.festival.sinOrganizacion && d.relacionadas.some(r => r.relacion === 'Posible duplicado en el registro histórico');
  }

  /** Al cerrar la ficha tras una fusión, la bandeja vuelve a leer: la solicitud pudo cambiar de Festival. */
  cerrarFichaDeFusion(): void {
    this.fichaParaFusionar.set(null);
    this.bandeja.recargar();
    const elegida = this.detalleReclamacion();
    if (elegida) {
      this.adminService.cargarDetalleDeReclamacion(elegida.reclamacion.id).subscribe({ next: detalle => this.detalleReclamacion.set(detalle), error: () => undefined });
    }
  }

  /** «1,2 MB», «340 KB»: el peso de un soporte como lo lee una persona. */
  tamanoLegible(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  /** «Neiva, Huila», sin comas sueltas cuando falta una parte. */
  lugarEnPalabras(...partes: (string | null | undefined)[]): string {
    return partes.filter(parte => !!parte).join(', ');
  }

  /** Los estados de una reclamación, como los lee quien decide. */
  etiquetaDeReclamacion(estado: string | null | undefined): string {
    return ({
      enviada: 'Esperando decisión', en_revision: 'Esperando decisión', requiere_aclaracion: 'Esperando la aclaración de la organización',
      aclaracion_enviada: 'La organización respondió', aprobada: 'Aprobada: la organización elige qué datos conservar',
      transferencia_ejecutada: 'Transferida', rechazada: 'Rechazada', cancelada: 'Cancelada por la organización',
    } as Record<string, string>)[String(estado ?? '')] ?? String(estado ?? '');
  }

  /**
   * LA COMPARACIÓN CAMPO A CAMPO DE LA PROPUESTA ABIERTA.
   *
   * SE PINTAN TAMBIÉN LAS FILAS QUE NO CAMBIAN. Un listado que solo mostrara las diferencias
   * dejaría sin respuesta la pregunta de si el resto se revisó o simplemente no estaba: quien
   * aprueba necesita ver que el correo de contacto sigue siendo el mismo, no que no se menciona.
   */
  readonly propuestaComparacion = computed<FilaComparada[]>(() => {
    // LA DE MERCADO YA VIENE COMPARADA. El servidor guardó el valor de antes al enviarse, así que
    // aquí no hay nada que cruzar: cada campo propuesto es ya una fila.
    const deProceso = this.detallePropuestaDeProceso();
    if (deProceso) {
      // POR NOMBRE, NO POR IDENTIFICADOR: los vocabularios y los códigos de territorio llegan ya traducidos.
      return deProceso.campos.map(campo => this.compararCampo(
        campo.campoEtiqueta,
        campo.valorAnteriorLegible ?? campo.valorAnterior,
        campo.valorPropuestoLegible ?? campo.valorPropuesto));
    }

    const detalle = this.detallePropuesta();
    if (!detalle) return [];
    return [
      this.compararCampo('Nombre', detalle.publicado.nombre, detalle.propuesta.nombre),
      this.compararCampo('Descripción', detalle.publicado.descripcion, detalle.propuesta.descripcion),
      this.compararCampo('Alcance territorial', etiquetaDeCobertura(detalle.publicado.nivelCobertura), etiquetaDeCobertura(detalle.propuesta.nivelCobertura)),
      this.compararCampo('Departamento', this.territorioLegible('departamento', detalle.publicado.codigoDepartamento), this.territorioLegible('departamento', detalle.propuesta.codigoDepartamento)),
      this.compararCampo('Municipio', this.territorioLegible('municipio', detalle.publicado.codigoMunicipio), this.territorioLegible('municipio', detalle.propuesta.codigoMunicipio)),
      this.compararCampo('Periodicidad', etiquetaDePeriodicidad(detalle.publicado.periodicidad), etiquetaDePeriodicidad(detalle.propuesta.periodicidad)),
      this.compararCampo('Correo de contacto', detalle.publicado.correoContacto, detalle.propuesta.correoContacto),
      this.compararCampo('Teléfono de contacto', detalle.publicado.telefonoContacto, detalle.propuesta.telefonoContacto),
      this.compararCampo('Instagram', detalle.publicado.instagram, detalle.propuesta.instagram),
      this.compararCampo('Facebook', detalle.publicado.facebook, detalle.propuesta.facebook),
      this.compararCampo('Sitio web', detalle.publicado.paginaWeb, detalle.propuesta.paginaWeb),
      this.compararCampo('Otro enlace', detalle.publicado.otroEnlace, detalle.propuesta.otroEnlace),
      this.compararCampo('Observaciones de contacto', detalle.publicado.observacionesContacto, detalle.propuesta.observacionesContacto),
      this.compararCampo('Director o directora', detalle.publicado.director, detalle.propuesta.director),
      this.compararCampo('Tipo de organización', this.textoDeId(detalle.publicado.tipoOrganizadorId), this.textoDeId(detalle.propuesta.tipoOrganizadorId)),
      this.compararCampo('Prácticas musicales', this.nombresDe(detalle.publicado.practicasMusicales), this.nombresDe(detalle.propuesta.practicasMusicales)),
      this.compararCampo('Territorios sonoros', this.nombresDe(detalle.publicado.territoriosSonoros), this.nombresDe(detalle.propuesta.territoriosSonoros)),
    ];
  });

  readonly propuestaCamposQueCambian = computed(() => this.propuestaComparacion().filter(fila => fila.cambia).length);

  /**
   * Qué decir sobre la comparación abierta.
   *
   * <b>LAS DOS FUENTES NO ENSEÑAN LO MISMO.</b> La de Festival trae la ficha entera y por eso puede
   * decir «X de Y campos»: quien aprueba ve también los que NO cambian, y así sabe que se revisaron.
   * La de Mercado guarda solo lo que cambia, así que decir «1 de 1» sería una cifra sin sentido; lo
   * que hay que decir es que el resto de la ficha no se toca.
   */
  readonly resumenDeLaComparacion = computed(() => {
    const cambian = this.propuestaCamposQueCambian();
    if (this.detallePropuestaDeProceso()) {
      return cambian === 1
        ? 'Cambia un campo de la ficha publicada. El resto no se toca.'
        : `Cambian ${cambian} campos de la ficha publicada. El resto no se toca.`;
    }
    return `Cambia ${cambian} de ${this.propuestaComparacion().length} campos frente a lo publicado.`;
  });

  /**
   * EXPANDIR/CONTRAER LA FILA. Es el ÚNICO control -el chevron al extremo derecho, o el nombre del
   * registro- que abre el resumen de un asunto: no hay un panel aparte al que navegar. Alternar en
   * vez de solo abrir es lo que deja que el mismo control sirva de «cerrar» cuando la fila ya está
   * expandida.
   */
  alternarTramite(item: { id: string; kind: string; rawId: any; module: string }): void {
    if (this.tramiteElegidoId() === item.id) {
      this.cerrarTramite();
      return;
    }

    this.tramiteElegidoId.set(item.id);
    this.accionRapidaMensaje.set('');
    this.accionRapidaError.set('');
    this.detalleError.set('');
    this.detalleFestival.set(null);
    this.detallePropuesta.set(null);
    this.detallePropuestaDeProceso.set(null);
    this.detalleReclamacion.set(null);
    this.historialDelEvento.set(undefined);

    if (item.kind === 'evento') {
      // EL HISTORIAL DEL EVENTO SE PIDE AL ABRIRLO: si ya se devolvió antes, quien revisa ve
      // qué se pidió y cuándo, antes de decidir otra vez.
      this.cargandoHistorialDelEvento.set(true);
      this.adminService.cargarHistorialDeEvento(String(item.rawId)).subscribe({
        next: filas => { this.cargandoHistorialDelEvento.set(false); this.historialDelEvento.set(filas ?? []); },
        error: () => { this.cargandoHistorialDelEvento.set(false); this.historialDelEvento.set(null); },
      });
    } else if (item.kind === 'revision' && String(item.module).toLowerCase() === 'festivals') {
      this.detalleCargando.set(true);
      this.adminService.cargarFichaInstitucionalDeFestival(Number(item.rawId)).subscribe({
        next: detalle => { this.detalleCargando.set(false); this.detalleFestival.set(detalle); },
        error: error => { this.detalleCargando.set(false); this.detalleError.set(error?.message || 'No fue posible cargar la ficha del Festival.'); },
      });
    } else if (item.kind === 'propuesta' && this.rutaDeLaPropuesta(item)) {
      this.detalleCargando.set(true);
      this.propuestasDeProceso.enviadaDe(this.rutaDeLaPropuesta(item)!, Number((item as { raw?: { registroId?: string } }).raw?.registroId ?? 0)).subscribe({
        next: detalle => { this.detalleCargando.set(false); this.detallePropuestaDeProceso.set(detalle); },
        error: error => { this.detalleCargando.set(false); this.detalleError.set(error?.message || 'No fue posible cargar la propuesta de cambio.'); },
      });
    } else if (item.kind === 'reclamacion') {
      this.detalleCargando.set(true);
      this.adminService.cargarDetalleDeReclamacion(String(item.rawId)).subscribe({
        next: detalle => { this.detalleCargando.set(false); this.detalleReclamacion.set(detalle); },
        error: error => { this.detalleCargando.set(false); this.detalleError.set(error?.message || 'No fue posible cargar la solicitud de administración.'); },
      });
    } else if (item.kind === 'propuesta') {
      this.detalleCargando.set(true);
      this.adminService.cargarFichaDePropuesta(Number(item.rawId)).subscribe({
        next: detalle => { this.detalleCargando.set(false); this.detallePropuesta.set(detalle); this.pedirLosTerritorios(); },
        error: error => { this.detalleCargando.set(false); this.detalleError.set(error?.message || 'No fue posible cargar la propuesta de cambio.'); },
      });
    }
  }

  /** El historial de estados del evento abierto. `null` si la consulta falló. */
  readonly historialDelEvento = signal<EntradaDeHistorialDeEstados[] | null | undefined>(undefined);
  readonly cargandoHistorialDelEvento = signal(false);

  cerrarTramite(): void {
    this.cerrarTramiteLocal();
    if (this.fichaUrl.id()) { this.fichaUrl.cerrar('solicitudes'); }
  }

  private cerrarTramiteLocal(): void {
    this.vistaDelTramite.set('resumen');
    this.fichaEnRevisionAbierta.set(null);
    this.tramiteElegidoId.set(null);
    this.accionRapidaMensaje.set('');
    this.accionRapidaError.set('');
    this.detalleError.set('');
    this.detalleFestival.set(null);
    this.detallePropuesta.set(null);
    this.detallePropuestaDeProceso.set(null);
    this.detalleReclamacion.set(null);
  }

  /**
   * «VISUALIZAR»: LA ÚNICA ACCIÓN PARA VER TODO, SIN SALIR DE LA BANDEJA. está definido el 2
   * de septiembre de 2026: eliminar la duplicación entre «Previsualizar» y «Abrir ficha» -que hasta
   * ese día navegaba a otra pantalla- y dejar una sola acción que abre un panel superpuesto y, al
   * cerrarlo, deja exactamente el mismo punto de la lista.
   *
   * UN FESTIVAL EN REVISIÓN NO ABRE EL MODAL GENÉRICO DE ABAJO: monta `<app-ficha-en-revision>`,
   * que YA ES un panel superpuesto -la misma ficha que llenó la organización, con «Pedir cambio»
   * campo por campo-. Repetirlo aquí con datos de solo lectura habría sido la clase exacta de panel
   * paralelo que esta unificación quiere cerrar.
   */
  fichaEnRevisionAbierta = signal<{ festivalId: string; nombreFestival: string; organizacion: string } | null>(null);
  avisoTemporal = signal('');
  private temporizadorAvisoTemporal: ReturnType<typeof setTimeout> | null = null;

  /**
   * MONTAR LO QUE HAGA FALTA PARA MIRAR EL TRAMITE ENTERO.
   *
   * <b>YA NO HAY PANEL SUPERPUESTO GENERICO.</b> Hasta, los trámites
   * que no eran un Festival en revisión ni una Edición abrían un diálogo de solo lectura encima de
   * la bandeja. Al pasar la revisión al propio panel, ese diálogo dejó de tener quien lo abriera y
   * se retiró: lo que enseñaba —la comparación completa de una propuesta y su historial— vive ahora
   * en la columna del trámite, como una posición más del selector de vista.
   */
  visualizar(item: { id: string; kind: string; rawId: unknown; module: string; record?: string; organization?: string }): void {
    if (item.kind === 'revision' && String(item.module).toLowerCase() === 'festivals') {
      this.fichaEnRevisionAbierta.set({ festivalId: String(item.rawId), nombreFestival: item.record || '', organizacion: item.organization || '' });
    }
  }

  /** El Festival salió de la bandeja -se envió un ajuste detallado-: recargar y avisar, igual que una acción rápida. */
  alCerrarFichaEnRevision(): void {
    this.vistaDelTramite.set('resumen');
    this.fichaEnRevisionAbierta.set(null);
    const abierto = this.tramiteElegidoId();
    if (abierto && this.fichaUrl.vista()) { this.fichaUrl.abrir('solicitudes', abierto); }
  }

  alEnviarDesdeFichaEnRevision(): void {
    this.fichaEnRevisionAbierta.set(null);
    this.cerrarTramite();
    this.mostrarAvisoTemporal('Las sugerencias de ajuste se enviaron a la organización.');
    this.bandeja.recargar();
  }
  alDecidirDesdeFichaEnRevision(accion: 'Publicar' | 'Rechazar'): void {
    this.fichaEnRevisionAbierta.set(null);
    this.cerrarTramite();
    this.mostrarAvisoTemporal(accion === 'Publicar'
      ? 'El Festival fue publicado y ya puede aparecer en el portal público.'
      : 'El registro fue rechazado y la organización recibió el motivo.');
    this.bandeja.recargar();
  }
  /** El parser de expresiones de Angular no acepta arrow functions en la plantilla. */
  nombresDe(lista: { nombre: string }[]): string {
    return lista.map(item => item.nombre).join(', ');
  }

  /** El territorio con su nombre y, como detalle, su código DIVIPOLA. Sin catálogo todavía, el código solo (nunca se pierde). */
  private territorioLegible(nivel: 'departamento' | 'municipio', codigo: string | null): string | null {
    return nombreDelTerritorioConCodigo(this.territorios(), nivel, codigo);
  }

  private pedirLosTerritorios(): void {
    if (this.territoriosPedidos) return;
    this.territoriosPedidos = true;
    this.catalogo.fetchDivipolaConCodigos().subscribe({
      next: lista => this.territorios.set(lista),
      error: () => { this.territoriosPedidos = false; },
    });
  }

  textoDeId(valor: number | null): string {
    return valor === null ? '—' : String(valor);
  }

  private compararCampo(etiqueta: string, vigente: string | null, propuesto: string | null): FilaComparada {
    const izquierda = (vigente ?? '').trim() || '—';
    const derecha = (propuesto ?? '').trim() || '—';
    return { etiqueta, vigente: izquierda, propuesto: derecha, cambia: izquierda !== derecha };
  }

  /** Estado de una acción rápida en curso desde el panel de vista previa de Solicitudes. */
  accionRapidaOcupada = signal(false);
  accionRapidaMensaje = signal('');
  accionRapidaError = signal('');

  /**
   * LAS ACCIONES RÁPIDAS DEL RESUMEN EXPANDIDO. El criterio es este: * le gustó que la fila se expanda al cliquearla, y quiso poder aprobar, rechazar o pedir
   * ajustes/aclaración desde ahí mismo, sin tener que abrir el detalle completo para lo que no lo
   * necesita.
   *
   * «VISUALIZAR» NO DESAPARECE: sigue siendo el camino para lo que sí necesita el detalle
   * completo -revisar campo por campo, comparar una propuesta contra lo publicado-. Esto es el
   * atajo para lo más común -aprobar o rechazar sin nada que discutir-, y decide por el MISMO
   * endpoint que ya usa el panel real de ese tipo, así que no inventa una segunda regla de
   * negocio en paralelo.
   */
  accionRapida(
    item: AsuntoDecidible,
    // LOS TRES ULTIMOS VERBOS NO SON DE UN TRAMITE. Un duplicado no se aprueba: se marca para
    // fusión o se descarta. Una alerta no se rechaza: se resuelve. Compartir el mismo despachador
    // -y no escribir un segundo- es lo que garantiza que el aviso, el bloqueo y la recarga de las
    // listas se comporten igual sea cual sea la fila.
    accion: 'aprobar' | 'rechazar' | 'ajustes' | 'aclaracion' | 'fusionar' | 'ignorar' | 'resolver',
  ): void {
    if (this.accionRapidaOcupada()) return;

    // LA CONFIRMACION OCURRE EN EL PANEL, NO EN UNA VENTANA DEL NAVEGADOR. Hasta el 17 de septiembre
    // de 2026 esta pantalla pedía el motivo con un `window.prompt` y confirmaba lo irreversible con
    // dos `window.confirm`: tres ventanas del sistema operativo, sin el estilo del proyecto, sin
    // rótulo accesible, sin límite de texto y sin decir en qué asunto se está. Y es justo la
    // pantalla donde el Programa decide lo que llega a una organización.
    this.confirmacion.set({ item, accion });
    this.motivoDeLaDecision = '';
  }

  /**
   * Qué hay que decidir ahora mismo: el asunto, el verbo y lo que falta antes de ejecutarlo.
   *
   * Vive en una señal y no en un diálogo aparte porque el trabajo de fondo ocurre en el propio
   * panel donde está la lista: quien decide sigue viendo sobre qué decide.
   */
  readonly confirmacion = signal<{
    item: AsuntoDecidible;
    accion: 'aprobar' | 'rechazar' | 'ajustes' | 'aclaracion' | 'fusionar' | 'ignorar' | 'resolver';
  } | null>(null);

  /** Lo que se escribe como motivo. Texto plano: lo lee una persona de la organización. */
  motivoDeLaDecision = '';

  /** Los tres verbos que no se ejecutan sin explicar por qué. */
  private static readonly PIDEN_MOTIVO = ['rechazar', 'ajustes', 'aclaracion'];

  readonly pideMotivo = computed(
    () => AdminSolicitudesPanelComponent.PIDEN_MOTIVO.includes(this.confirmacion()?.accion ?? ''));

  /** Cómo se titula la confirmación: nombra el verbo y el asunto, para no decidir a ciegas. */
  readonly tituloDeLaConfirmacion = computed(() => {
    const pendiente = this.confirmacion();
    if (!pendiente) return '';
    const registro = pendiente.item.record ?? 'este asunto';
    const esDeProceso = this.rutaDeLaPropuesta(pendiente.item) !== null;
    if (pendiente.item.kind === 'evento') {
      return pendiente.accion === 'aprobar' ? `Publicar «${registro}»` : `Devolver «${registro}» para corregir`;
    }
    switch (pendiente.accion) {
      case 'aprobar':
        return pendiente.item.kind === 'propuesta' && esDeProceso
          ? `Aplicar los cambios propuestos sobre «${registro}»`
          : `Aprobar «${registro}»`;
      case 'rechazar': return `Rechazar «${registro}»`;
      case 'ajustes': return `Pedir ajustes sobre «${registro}»`;
      case 'aclaracion': return `Pedir una aclaración sobre «${registro}»`;
      case 'fusionar': return `Marcar «${registro}» para fusión`;
      case 'ignorar': return `Declarar que «${registro}» son registros distintos`;
      default: return `Marcar «${registro}» como resuelto`;
    }
  });

  /** Qué va a pasar, dicho antes de que pase. Vacío cuando no hay consecuencia que advertir. */
  readonly avisoDeLaConfirmacion = computed(() => {
    const pendiente = this.confirmacion();
    // LA FRONTERA DEL CONTRATO DE DUPLICADOS SE DICE ANTES DE PULSAR: registra el juicio y todavía
    // no combina los dos registros. Prometer una fusión que no ocurre sería peor que no ofrecerla.
    if (pendiente?.accion === 'fusionar') {
      return 'Queda registrada la decisión; los registros no se combinan ni se modifican.';
    }
    if (!pendiente || pendiente.accion !== 'aprobar') return '';
    if (pendiente.item.kind === 'evento') {
      return 'Quedará visible en la Agenda pública. Para retirarlo habrá que despublicarlo desde Agenda y eventos.';
    }
    const esDeProceso = this.rutaDeLaPropuesta(pendiente.item) !== null;
    if (pendiente.item.kind === 'propuesta' && esDeProceso) {
      return 'La ficha que ya está publicada cambiará. No se puede revertir desde aquí.';
    }
    if (pendiente.item.kind === 'propuesta' || pendiente.item.kind === 'revision') {
      return 'Quedará visible en el sitio público. No se puede revertir desde aquí.';
    }
    if (pendiente.item.kind === 'reclamacion') {
      //: si la organización no propuso cambios, aprobar transfiere en el acto.
      return this.detalleReclamacion()?.comparacion?.length
        ? 'La organización elegirá cuáles de los cambios de arriba conservar y, al confirmarlo, pasará a administrar el Festival y lo que elija quedará publicado.'
        : this.detalleReclamacion()?.reclamacion.dominio && this.detalleReclamacion()?.reclamacion.dominio !== 'festivales'
          ? 'La organización pasará a administrar el proceso y su historia en este momento. Para devolverlo habrá que liberar su administración desde la ficha.'
          : 'La organización pasará a administrar el Festival y sus ediciones en este momento. Para devolverlo habrá que liberar su administración desde la ficha.';
    }
    return '';
  });

  /** Cierra la confirmación sin hacer nada. */
  cancelarLaConfirmacion(): void {
    this.confirmacion.set(null);
    this.motivoDeLaDecision = '';
  }

  /** Ejecuta lo que se estaba confirmando. */
  confirmarLaAccion(): void {
    const pendiente = this.confirmacion();
    if (!pendiente) return;
    const motivo = this.motivoDeLaDecision.trim();
    if (this.pideMotivo() && !motivo) return;
    this.confirmacion.set(null);
    this.motivoDeLaDecision = '';
    this.ejecutar(pendiente.item, pendiente.accion, motivo);
  }

  private ejecutar(
    item: AsuntoDecidible,
    accion: 'aprobar' | 'rechazar' | 'ajustes' | 'aclaracion' | 'fusionar' | 'ignorar' | 'resolver',
    motivo: string,
  ): void {
    this.accionRapidaOcupada.set(true);
    this.accionRapidaMensaje.set('');
    this.accionRapidaError.set('');

    const alTerminar = (mensaje: string) => {
      // NO SE LLAMA `cerrarTramite()` AQUÍ: esa limpia el propio mensaje que se acaba de poner.
      // El asunto decidido deja de estar pendiente en cuanto se recargan las listas, así que
      // `tramiteElegido()` -que busca por id sobre `colaVisible()`- da `null` por su
      // cuenta y el panel se cierra solo. El mensaje vive fuera de ese `@if`, precisamente para
      // seguir visible cuando eso pasa.
      this.accionRapidaOcupada.set(false);
      this.accionRapidaMensaje.set(mensaje);
      // Y SE VE. Hasta esta señal no se pintaba en ninguna parte: la
      // decisión se registraba, la fila desaparecía de la cola y la pantalla no decía nada. El
      // aviso flotante es el mismo que ya usan las decisiones tomadas desde la ficha completa.
      this.mostrarAvisoTemporal(mensaje);
      this.vistaDelTramite.set('resumen');
      // La cola entera, duplicados y alertas incluidos: el asunto decidido tiene que salir de ella.
      this.bandeja.recargar();
    };
    const alFallar = (error: any) => {
      this.accionRapidaOcupada.set(false);
      this.accionRapidaError.set(error?.message || 'No fue posible registrar la decisión.');
    };

    // LAS PROPUESTAS DE CAMBIO TIENEN SU PROPIO CIRCUITO -mismos verbos que un Festival directo
    // (Publicar/Rechazar/SolicitarAjustes), pero por `propuestaId`, no por `festivalId`: son dos
    // tablas distintas con dos endpoints distintos.
    // LA DE UN MERCADO, TALLER, ESPACIO O RED VA POR SU PROPIA RUTA, con los verbos de su circuito: aplicar no es
    // publicar —el proceso ya está publicado— y por eso el servidor no admite «Publicar» aquí.
    // UN EVENTO SE DECIDE COMO TODO LO DEMAS. Hasta tenía su propio
    // camino: dos botones que ejecutaban en el acto y un campo «Qué hay que corregir» siempre a la
    // vista, incluso para publicar. En la misma fila de acciones convivían dos modelos de decisión
    // —uno que pregunta y otro que no— y el motivo se pedía antes de saber qué se iba a hacer.
    if (item.kind === 'evento') {
      const decision = accion === 'aprobar' ? 'publicar' : 'devolver';
      this.adminService.decidirSobreEvento(String(item.rawId), decision, motivo || undefined).subscribe({
        next: () => alTerminar(decision === 'publicar'
          ? 'El evento quedó publicado en la Agenda.'
          : 'El evento volvió a la organización con lo que hay que corregir.'),
        error: alFallar,
      });
      return;
    }

    if (item.kind === 'propuesta' && this.rutaDeLaPropuesta(item)) {
      const decision = accion === 'aprobar' ? 'aplicar' : accion === 'rechazar' ? 'rechazar' : 'pedir_ajustes';
      this.propuestasDeProceso.decidir(this.rutaDeLaPropuesta(item)!, Number(item.rawId), decision, motivo || undefined).subscribe({
        next: () => alTerminar(accion === 'aprobar'
          ? 'Los cambios propuestos ya están en la ficha publicada.'
          : accion === 'rechazar' ? 'Propuesta rechazada.' : 'Se pidieron ajustes sobre la propuesta.'),
        error: alFallar,
      });
      return;
    }

    if (item.kind === 'propuesta') {
      const accionPropuesta = accion === 'aprobar' ? 'Publicar' : accion === 'rechazar' ? 'Rechazar' : 'SolicitarAjustes';
      this.adminService.decidirRevisionDePropuesta(Number(item.rawId), {
        accion: accionPropuesta,
        observacion: accion === 'ajustes' ? motivo : null,
        motivoRechazo: accion === 'rechazar' ? motivo : null,
      }).subscribe({
        next: () => alTerminar(accion === 'aprobar' ? 'Propuesta publicada.' : accion === 'rechazar' ? 'Propuesta rechazada.' : 'Se pidieron ajustes sobre la propuesta.'),
        error: alFallar,
      });
      return;
    }

    // «FESTIVALS» NO PASA POR EL ENDPOINT GENÉRICO. El servidor lo rechaza a propósito -409, «El
    // estado de un Festival no se modifica desde la administración genérica»- porque un Festival
    // tiene su propio circuito institucional (`/institucional/festivales/{id}/decisiones`), con
    // sus propios verbos (Publicar/Rechazar/SolicitarAjustes) y sus propios campos
    // (`observacion`/`motivoRechazo` en vez de un `status` genérico). Se vio en vivo el 1 de
    // septiembre de 2026: «Aprobar» sobre un Festival respondía ese 409 y el mensaje de error no
    // decía qué hacer distinto.
    if (item.kind === 'revision' && String(item.module).toLowerCase() === 'festivals') {
      const accionFestival = accion === 'aprobar' ? 'Publicar' : accion === 'rechazar' ? 'Rechazar' : 'SolicitarAjustes';
      this.adminService.decidirRevisionDeFestival(Number(item.rawId), {
        accion: accionFestival,
        observacion: accion === 'ajustes' ? motivo : null,
        motivoRechazo: accion === 'rechazar' ? motivo : null,
      }).subscribe({
        next: () => alTerminar(accion === 'aprobar' ? 'Festival publicado.' : accion === 'rechazar' ? 'Festival rechazado.' : 'Se pidieron ajustes.'),
        error: alFallar,
      });
      return;
    }

    // LOS TRES PROCESOS NUEVOS SE DECIDEN CON UN SOLO CAMINO, el de `ProcesosDeLaConsolaService`.
    if (item.kind === 'revision' && esTipoDeProceso(item.module)) {
      const tipo = item.module;
      const decision = accion === 'aprobar' ? 'publicar' : accion === 'rechazar' ? 'rechazar' : 'ajustes';
      this.procesos.decidir(tipo, item.rawId as number, decision, motivo || null).then(
        () => alTerminar(accion === 'aprobar' ? PROCESOS_DE_LA_CONSOLA[tipo].publicado
          : accion === 'rechazar' ? 'Registro rechazado.' : 'Se pidieron ajustes.'),
        alFallar);
      return;
    }

    if (item.kind === 'revision') {
      const status = accion === 'aprobar' ? 'aprobado' : accion === 'rechazar' ? 'rechazado' : 'ajustes_solicitados';
      this.adminService.cambiarEstadoDeRegistro({ moduleId: item.module, id: item.rawId, status, comment: motivo }).subscribe({
        next: () => alTerminar(accion === 'aprobar' ? 'Registro aprobado.' : accion === 'rechazar' ? 'Registro rechazado.' : 'Se pidieron ajustes.'),
        error: alFallar,
      });
      return;
    }

    if (item.kind === 'solicitud' || item.kind === 'retiro') {
      const status = accion === 'aprobar' ? 'aprobada' : accion === 'rechazar' ? 'rechazada' : 'ajustes_solicitados';
      this.adminService.decidirSolicitudDeVinculacion({ id: item.rawId, status, comment: motivo }).subscribe({
        next: () => alTerminar(
          accion === 'aprobar' && item.kind === 'retiro' ? 'Retiro aprobado: el registro fue archivado.'
          : accion === 'aprobar' ? 'Solicitud aprobada.'
          : accion === 'rechazar' ? 'Solicitud rechazada.'
          : 'Se pidió un ajuste.'),
        error: alFallar,
      });
      return;
    }

    if (item.kind === 'reclamacion' && accion === 'aclaracion') {
      this.adminService.pedirAclaracionDeReclamacion(item.rawId, motivo).subscribe({
        next: () => alTerminar('Se pidió una aclaración a la organización.'),
        error: alFallar,
      });
      return;
    }

    if (item.kind === 'duplicado') {
      this.adminService.decidirPosibleDuplicado({ id: item.rawId, decision: accion === 'fusionar' ? 'fusionar' : 'no_duplicado' }).subscribe({
        next: () => alTerminar(accion === 'fusionar'
          ? 'Quedó marcado para fusión.'
          : 'Quedó clasificado como registros distintos.'),
        error: alFallar,
      });
      return;
    }

    if (item.kind === 'alerta') {
      this.adminService.decidirAlertaDeCalidad({ id: item.rawId, status: 'resuelta' }).subscribe({
        next: () => alTerminar('La alerta quedó marcada como resuelta.'),
        error: alFallar,
      });
      return;
    }

    if (item.kind === 'reclamacion') {
      this.adminService.decidirReclamacionDeAdministracion(item.rawId, accion as 'aprobar' | 'rechazar', motivo).subscribe({
        next: () => alTerminar(accion === 'aprobar'
          ? 'Reclamación aprobada: la organización debe conciliar los datos antes de la transferencia.'
          : 'Reclamación rechazada.'),
        error: alFallar,
      });
      return;
    }

    this.accionRapidaOcupada.set(false);
  }

  /**
   * La decisión del Programa sobre un evento, tomada en la propia bandeja.
   *
   * <b>AQUI Y NO EN AGENDA.</b> El trabajo de fondo ocurre en el panel donde está la lista: mandar
   * a otra sección para decidir obliga a perder el sitio en la cola y a volver a buscarlo. Y hay una
   * razón de permisos: la bandeja la tiene toda cuenta de consola, el módulo Agenda no.
   */

  /**
   * El motivo que devolvió el servidor, y no uno genérico.
   *
   * Publicar un evento al que le falta el lugar o el enlace lo rechaza el servidor diciendo cuál;
   * taparlo obligaría a adivinar qué le pasa a ese evento en concreto.
   */
  private motivoDelServidor(fallo: unknown): string {
    const cuerpo = (fallo as { payload?: { errors?: Record<string, string[]>; message?: string } })?.payload;
    const mensajes = cuerpo?.errors ? Object.values(cuerpo.errors).flat().filter(Boolean) : [];
    if (mensajes.length) return mensajes.join(' ');
    return cuerpo?.message ?? 'No fue posible registrar la decisión.';
  }

  private mostrarAvisoTemporal(mensaje: string): void {
    if (this.temporizadorAvisoTemporal) clearTimeout(this.temporizadorAvisoTemporal);
    this.avisoTemporal.set(mensaje);
    this.temporizadorAvisoTemporal = setTimeout(() => this.avisoTemporal.set(''), 5000);
  }
}
