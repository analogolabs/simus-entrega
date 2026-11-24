import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SoportesDeSolicitudComponent } from './soportes-de-solicitud.component';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import {
  FiltrosDeProcesosHistoricos, ProcesoHistoricoReclamable, ProcesosHistoricos, ReclamacionesDeProcesosService, TipoDeProcesoHistorico,
} from './reclamaciones-de-procesos.service';
import { etiquetaDePeriodicidad } from '../../core/vocabularios/periodicidad';
import { nombrePropio } from '../../shared/texto/nombre-propio';
import { BuscadorDeListaComponent } from '../../shared/components/ui/buscador/buscador-de-lista.component';
import { FiltroDesplegableComponent, OpcionDeFiltro } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { FiltroDeSedeComponent } from '../../shared/components/ui/filtro-de-sede/filtro-de-sede.component';
import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';

/** Los tipos que hoy se pueden reclamar, en el orden fijo del catálogo (decisión 118). El servidor es la fuente; esto pinta el filtro antes de la primera respuesta. */
const TIPOS_QUE_SE_RECLAMAN: OpcionDeFiltro[] = [
  { id: '', etiqueta: 'Todos los tipos' },
  { id: 'festivales', etiqueta: 'Festivales' },
  { id: 'mercados', etiqueta: 'Mercados musicales' },
  { id: 'redes', etiqueta: 'Redes y documentación' },
  { id: 'talleres', etiqueta: 'Lutería' },
  { id: 'espacios', etiqueta: 'Espacios para música en vivo' },
];

/**
 * «Buscar un proceso histórico»: los procesos —Festivales, Mercados, Redes, Lutería y Espacios— que ya estaban en SIMUS sin
 * organización, para pedir su administración.
 *
 * <b>POR QUÉ EXISTE (generalizado en la decisión 129).</b> Se cargaron procesos
 * históricos sin organización. Antes una organización solo los veía si escribía el nombre casi
 * exacto en el paso 3 del asistente; después se le enseñaban los de su departamento. Esa lista por
 * defecto era ruido: decenas de procesos ajenos, cada uno insinuando «quizá es tuyo».
 *
 * <b>SIN SUGERENCIAS POR DEFECTO.</b> Al abrir no se lista nada: solo el buscador (nombre u
 * organizador anterior, tipo, departamento y municipio). Los resultados salen cuando la persona
 * busca. La única excepción son las COINCIDENCIAS FUERTES, que decide el servidor
 * (<c>CoincidenciaConLaOrganizacion</c>) y que llegan con su motivo en lenguaje claro: sin ellas,
 * el estado inicial es limpio, con la instrucción de búsqueda.
 *
 * <b>LOS FILTROS VIVEN EN LA URL</b> (`buscar`, `tipo`, `departamento`, `municipio`): se puede
 * compartir, recargar y volver con el botón de atrás.
 */
@Component({
  selector: 'app-procesos-historicos-reclamables',
  standalone: true,
  imports: [
    EsqueletoComponent, BotonNativoDirective, BuscadorDeListaComponent, FiltroDesplegableComponent, FiltroDeSedeComponent,
    RouterLink, AvisoSoloAdministracionComponent, SoportesDeSolicitudComponent, NgTemplateOutlet,
  ],
  templateUrl: './procesos-historicos-reclamables.component.html',
})
export class ProcesosHistoricosReclamablesComponent implements OnInit {
  private readonly store = inject(PanelOrganizacionStore);
  private readonly servicio = inject(ReclamacionesDeProcesosService);
  private readonly router = inject(Router, { optional: true });

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }

  readonly organizacionId = this.store.organizacionId;
  readonly esAdministradora = this.store.esAdministradora;
  readonly etiquetaDePeriodicidad = etiquetaDePeriodicidad;
  readonly opcionesDeTipo = TIPOS_QUE_SE_RECLAMAN;

  // LOS FILTROS (la URL es su fuente).
  readonly busqueda = signal('');
  readonly tipo = signal('');
  readonly departamento = signal('');
  readonly municipio = signal('');

  readonly respuesta = signal<ProcesosHistoricos | null>(null);
  /** «Vacío real solo al terminar» (CAR): hasta la primera respuesta se pinta el esqueleto, no «no hay nada». */
  readonly cargado = signal(false);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly abierto = signal<string | null>(null);
  readonly justificacion = signal('');
  readonly enviando = signal(false);
  readonly aviso = signal('');
  /** Los soportes elegidos para la solicitud abierta. */
  readonly soportes = signal<string[]>([]);

  readonly resultados = computed(() => this.respuesta()?.resultados ?? []);
  readonly sugeridos = computed(() => this.respuesta()?.sugeridos ?? []);
  readonly hayBusqueda = computed(() => this.respuesta()?.hayBusqueda ?? this.hayCriterio());
  readonly tiposQueNoSeReclaman = computed<TipoDeProcesoHistorico[]>(() => (this.respuesta()?.tipos ?? []).filter(t => !t.reclamable));
  /** «Redes y documentación, Lutería y Espacios para música en vivo»: del catálogo del servidor, en su orden. */
  readonly nombresDeLosQueNoSeReclaman = computed(() => {
    const nombres = this.tiposQueNoSeReclaman().map(t => t.etiquetaPlural);
    return nombres.length < 2 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  });
  readonly hayCriterio = computed(() => !!(this.busqueda().trim() || this.tipo() || this.departamento() || this.municipio()));

  private secuencia = 0;
  /**
   * El proceso que llega pedido desde su ficha pública, o `null`.
   *
   * «Es de mi organización: pedir su administración» trae `?reclamar=<id>&buscar=<nombre>&tipo=…`:
   * se busca por ese nombre y se abre la solicitud.
   */
  private reclamarAlCargar: string | null = null;

  /** Avisa a quien aloja la lista que la solicitud ya quedó enviada, para que refresque «Mis solicitudes» sin recargar la página (D-03). */
  readonly solicitudEnviada = output<void>();

  private readonly ruta = inject(ActivatedRoute, { optional: true });

  ngOnInit(): void {
    const q = this.ruta?.snapshot.queryParamMap;
    this.busqueda.set(q?.get('buscar') ?? '');
    this.tipo.set(q?.get('tipo') ?? '');
    this.departamento.set(q?.get('departamento') ?? '');
    this.municipio.set(q?.get('municipio') ?? '');
    this.reclamarAlCargar = q?.get('reclamar') ?? null;
    this.cargar();
  }

  private filtros(): FiltrosDeProcesosHistoricos {
    return { tipo: this.tipo(), buscar: this.busqueda(), codigoDepartamento: this.departamento(), codigoMunicipio: this.municipio() };
  }

  cargar(): void {
    const organizacionId = this.organizacionId();
    if (!organizacionId) return;
    const mia = ++this.secuencia;
    this.cargando.set(true); this.error.set('');
    this.servicio.procesos(organizacionId, this.filtros()).subscribe({
      next: respuesta => {
        if (mia !== this.secuencia) return;
        this.respuesta.set(respuesta);
        this.cargando.set(false); this.cargado.set(true);
        const pedido = this.reclamarAlCargar;
        this.reclamarAlCargar = null;
        const encontrado = pedido ? [...respuesta.resultados, ...respuesta.sugeridos].find(item => item.id === pedido) : undefined;
        if (encontrado && this.esAdministradora() && !encontrado.reclamacionPropiaId && !encontrado.reclamacionEnCurso) this.abrir(encontrado);
      },
      error: () => {
        if (mia !== this.secuencia) return;
        this.error.set('No fue posible consultar los procesos históricos. Inténtalo de nuevo.');
        this.cargando.set(false); this.cargado.set(true);
      },
    });
  }

  /** Cambia un filtro, lo deja en la URL y vuelve a buscar. */
  cambiar(cambios: Partial<{ buscar: string; tipo: string; departamento: string; municipio: string }>): void {
    if (cambios.buscar !== undefined) this.busqueda.set(cambios.buscar);
    if (cambios.tipo !== undefined) this.tipo.set(cambios.tipo);
    if (cambios.departamento !== undefined) { this.departamento.set(cambios.departamento); this.municipio.set(''); }
    if (cambios.municipio !== undefined) this.municipio.set(cambios.municipio);
    this.abierto.set(null);
    this.aviso.set('');
    this.cargar();
    void this.router?.navigate([], {
      queryParams: {
        buscar: this.busqueda().trim() || null, tipo: this.tipo() || null,
        departamento: this.departamento() || null, municipio: this.municipio() || null,
      },
      queryParamsHandling: 'merge', replaceUrl: true,
    });
  }

  limpiar(): void {
    this.cambiar({ buscar: '', tipo: '', departamento: '', municipio: '' });
  }

  lugar(proceso: ProcesoHistoricoReclamable): string {
    return [proceso.nombreMunicipio, proceso.nombreDepartamento].filter(Boolean).map(parte => nombrePropio(parte as string)).join(', ')
      || (proceso.nivelCobertura === 'nacional' ? 'Nacional' : 'Sin territorio registrado');
  }

  /** La ficha pública del proceso, según su tipo. */
  fichaPublica(proceso: ProcesoHistoricoReclamable): string[] {
    const raiz: Record<string, string> = { mercados: '/ecosistema/mercados-musicales', redes: '/ecosistema/redes', talleres: '/ecosistema/luteria', espacios: '/ecosistema/espacios' };
    return [raiz[proceso.modulo] ?? '/ecosistema/festivales', proceso.id];
  }

  abrir(proceso: ProcesoHistoricoReclamable): void {
    this.abierto.set(this.clave(proceso));
    this.justificacion.set('');
    this.soportes.set([]);
    this.error.set('');
  }

  clave(proceso: ProcesoHistoricoReclamable): string { return `${proceso.modulo}-${proceso.id}`; }

  enviar(proceso: ProcesoHistoricoReclamable): void {
    const texto = this.justificacion().trim();
    if (!texto) { this.error.set(`Cuéntanos por qué este ${proceso.tipoEtiqueta.toLowerCase()} es de tu organización.`); return; }
    this.enviando.set(true); this.error.set('');
    this.servicio.reclamar(this.organizacionId(), proceso.id, texto, null, this.soportes(), proceso.modulo).subscribe({
      next: reclamacion => {
        this.enviando.set(false);
        this.abierto.set(null);
        const marcar = (item: ProcesoHistoricoReclamable) => item.modulo === proceso.modulo && item.id === proceso.id
          ? { ...item, reclamacionPropiaId: reclamacion.id, reclamacionPropiaEstado: reclamacion.estado }
          : item;
        this.respuesta.update(actual => actual && ({ ...actual, resultados: actual.resultados.map(marcar), sugeridos: actual.sugeridos.map(marcar) }));
        this.aviso.set(`Enviaste la solicitud para administrar «${proceso.nombre}». La sigues en Solicitudes.`);
        this.solicitudEnviada.emit();
      },
      error: (fallo: { message?: string }) => {
        this.enviando.set(false);
        this.error.set(fallo?.message ?? 'No fue posible enviar la solicitud.');
        this.cargar();
      },
    });
  }
}
