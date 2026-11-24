import { sedeParaEnviar } from '../../core/territorio/sede-principal';
import { SedeElegida, SelectorDeSedeComponent } from '../../shared/components/ui/selector-de-sede/selector-de-sede.component';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import {
  CatalogosDelFestival,
  GuardarFestivalSolicitud,
  NIVELES_DE_COBERTURA,
  PanelOrganizacionApi,
  UbicacionDivipola,
} from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { ConCambiosSinGuardar } from '../../core/navegacion/cambio-de-organizacion';
import { BotonComponent } from '../../shared/components/ui/boton/boton.component';
import { DialogoDirective } from '../../shared/directives/dialogo.directive';
import { EstadosDeLosPasos, IndicadorDePasosComponent } from '../../shared/components/ui/indicador-de-pasos/indicador-de-pasos.component';
import { ConfirmacionComponent } from '../../shared/components/ui/confirmacion/confirmacion.component';
import { ErrorDeCampoComponent } from '../../shared/components/ui/error-de-campo/error-de-campo.component';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { AdminService } from '../../core/services/admin.service';
import { esCorreoValido, MENSAJE_DE_CORREO, mensajeDeTelefono } from '../../core/formularios/telefono';
import { mensajeDeRedSocial, mensajeDeUrl, normalizarRedSocial, normalizarUrl } from '../../core/formularios/url';
import { traducirErrorDelServidor } from '../../core/formularios/traductor-de-errores';
import { BorradoresDeProcesoApi } from './borradores-de-proceso.api';
import { ApiClientService } from '../../core/http/api-client.service';
import { AutoguardadoDeBorrador } from '../../core/services/autoguardado-de-borrador';
import { ConfirmacionDeCorreoService } from '../../core/services/confirmacion-de-correo.service';
import { AvisoDeCorreoSinConfirmarComponent } from './aviso-de-correo-sin-confirmar.component';
import { PERIODICIDADES, etiquetaDePeriodicidad, pideDetalle } from '../../core/vocabularios/periodicidad';
import { AvisoSoloAdministracionComponent } from './aviso-solo-administracion.component';
import { SoportesDeSolicitudComponent } from './soportes-de-solicitud.component';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
const CATALOGOS_VACIOS: CatalogosDelFestival = {
  practicasMusicales: [], territoriosSonoros: [], tipologias: [], expresionesArtisticas: [],
  fuentesFinanciacion: [], modalidadesParticipacion: [], naturalezasEntidad: [], tiposIngreso: [],
  tiposOrganizador: [], zonasUrbanoRural: [], titulacionesColectivas: [], regionesOcad: [],
};

/** Los cuatro pasos, en el orden en que se recorren. */
export interface PasoDelAsistente {
  id: number;
  titulo: string;
}

/**
 * Una coincidencia con un Festival que ya existe.
 *
 * <b>`tipoCoincidencia` DECIDE LO QUE LA PANTALLA OFRECE, y por eso viaja.</b> Hasta el 13 de
 * septiembre de 2026 todas las coincidencias se pintaban igual, con su formulario de «Solicitar
 * administración» debajo. Eso solo tiene sentido para un registro HISTÓRICO sin organización
 * administradora; para uno que ya administra alguien, pedir su administración por aquí no es lo que
 * corresponde —ese es otro trámite— y el aviso útil es simplemente que no se registre dos veces.
 */
interface CoincidenciaBasica {
  festivalId: string;
  nombreFestival: string;
  descripcion: string | null;
  evidencias: string[];
  /** `HistoricoReclamable` | `YaRegistradoPorTuOrganizacion` | `YaRegistradoPorOtraOrganizacion`. */
  tipoCoincidencia: string;
  /** Quién lo administra, cuando no es un registro histórico sin dueño. */
  organizadorHistorico: string | null;
  /**: otra organización ya pidió administrarlo; no admite otra solicitud mientras tanto. */
  reclamacionEnCurso?: boolean;
}

interface FichaFestivalPublica {
  nombre: string;
  descripcion: string | null;
  organizacionResponsable: string | null;
  territorioPrincipal: { departamento: string | null; municipio: string | null; nivelCobertura: string };
  periodicidad: string | null;
  practicasMusicales: { nombre: string }[];
  territoriosSonoros: { nombre: string }[];
  instagram: string | null;
  facebook: string | null;
  sitioWeb: string | null;
  otroEnlace: string | null;
}

interface EdicionPublica { id: number; nombre: string; fechaInicio: string | null; fechaFin: string | null; descripcion: string | null; }
interface CoincidenciaHistorica extends CoincidenciaBasica {
  ficha: FichaFestivalPublica | null;
  ediciones: EdicionPublica[];
  /**
   * No tiene ficha pública, y eso NO es un fallo.
   *
   * <b>SE DISTINGUE DEL ERROR DE RED A PROPOSITO.</b> Desde que la búsqueda también avisa de los
   * Festivales que la propia organización ya registró, muchas coincidencias son BORRADORES: no
   * tienen ficha pública porque todavía no se han publicado. Contar eso como «no fue posible
   * cargar» —que es lo que decía— convierte una situación normal en un fallo aparente, y encima en
   * la pantalla donde alguien está decidiendo si su registro está duplicado.
   */
  sinFichaPublica: boolean;
}

export const PASOS_DEL_ASISTENTE: readonly PasoDelAsistente[] = [
  { id: 1, titulo: 'Datos generales' },
  { id: 2, titulo: 'Territorio y contacto' },
  { id: 3, titulo: 'Prácticas y territorios sonoros' },
  { id: 4, titulo: 'Revisar y guardar borrador' },
];

// El vocabulario vive en `core/vocabularios/periodicidad`, no aquí.

interface FormularioDelAsistente {
  nombre: string;
  descripcion: string;
  periodicidad: string;
  periodicidadDetalle: string;
  nivelCobertura: string;
  codigoDepartamento: string;
  codigoMunicipio: string;
  sedeCodigoDepartamento: string;
  sedeCodigoMunicipio: string;
  correoContacto: string;
  telefonoCelular: string;
  instagram: string;
  facebook: string;
  paginaWeb: string;
  otroEnlace: string;
  observacionesContacto: string;
  practicasMusicalesIds: number[];
  territoriosSonorosIds: number[];
}

const CAMPOS_DE_TEXTO_DEL_BORRADOR: readonly (keyof Omit<FormularioDelAsistente, 'practicasMusicalesIds' | 'territoriosSonorosIds'>)[] = [
  'nombre', 'descripcion', 'periodicidad', 'periodicidadDetalle', 'nivelCobertura',
  'codigoDepartamento', 'codigoMunicipio', 'sedeCodigoDepartamento', 'sedeCodigoMunicipio', 'correoContacto', 'telefonoCelular',
  'instagram', 'facebook', 'paginaWeb', 'otroEnlace', 'observacionesContacto',
];

function vacioANulo(valor: string): string | null {
  const limpio = (valor ?? '').trim();
  return limpio.length === 0 ? null : limpio;
}

/**
 * El asistente de alta de Festival, en /gestion/procesos/festivales/nuevo.
 *
 * <b>REVIERTE, SOLO PARA CREAR, LA DECISIÓN DEL 29 DE AGOSTO DE 2026.</b> Ese día se retiró un
 * asistente por pasos de `FichaFestivalComponent` a favor de una vista única para leer, editar y
 * crear -«mantengamos este como base para editar y ver ficha; cuando se crea un festival también
 * mantengamos esta estructura», `secciones-de-la-ficha.ts-35`-. La dirección de producto, consultado
 * de nuevo, confirmó que quiere el asistente de vuelta, pero SOLO para
 * dar de alta un Festival nuevo: `FichaFestivalComponent` sigue exactamente igual para leer y
 * editar -esa mitad de la decisión de agosto no se tocó-.
 *
 * <b>NO ES EL MISMO FORMULARIO QUE LA FICHA, Y NO LO NECESITA.</b> Aquí no se pide ninguna edición:
 * la propuesta original fue explícita -«las ediciones no aparecerían durante la creación
 * inicial... se completa después desde su consola»-. Los tres primeros pasos escriben exactamente
 * los mismos catorce campos de `GuardarFestivalSolicitud` que ya usa
 * `FichaFestivalComponent.construirSolicitudDelFestival()`, con las mismas reglas de
 * `validar()` -mismo `nombre` obligatorio, mismo territorio condicional según `nivelCobertura`-,
 * así que al guardar solo se llama `crearFestival()`, nunca `crearVersion()`.
 *
 * <b>`?paso=` Y NO UN segmento de ruta.</b> Mismo criterio que `?proceso=` en
 * `SeccionEcosistemaComponent` y `?modo=` en el login: es un único formulario que se llena
 * progresivamente, no cuatro destinos distintos que alguien pudiera enlazar por separado.
 */
@Component({
  selector: 'app-asistente-de-festival',
  standalone: true,
  imports: [SelectorDeSedeComponent, OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, BotonNativoDirective, AvisoSoloAdministracionComponent, CommonModule, FormsModule, IndicadorDePasosComponent, AvisoDeCorreoSinConfirmarComponent,
    BotonComponent, DialogoDirective, SoportesDeSolicitudComponent, ConfirmacionComponent, ErrorDeCampoComponent, FechaPipe, RouterLink],
  templateUrl: './asistente-de-festival.component.html',
})
export class AsistenteDeFestivalComponent implements OnInit, OnDestroy, ConCambiosSinGuardar {
  /**
   * La confirmación del correo, que decide si esta pantalla llega a ofrecer el formulario.
   *
   * <b>NO SE ABRE EL FORMULARIO SI FALTA.</b> El servidor lo rechaza igual, pero descubrirlo al
   * final —después de cuatro pasos y catorce campos— es exactamente el fallo que el plan de
   * consolidación mandó cerrar: la puerta se explica al principio, con
   * la salida para resolverla ahí mismo.
   *
   * <b>YA ESTA RESUELTA AL LLEGAR AQUI.</b> La carga la hace el panel al entrar, una vez, porque la
   * confirmación es de la cuenta y no de la pantalla. Si se preguntara aquí, esta pantalla tendría
   * que elegir entre esperar una respuesta de red antes de pintar nada o enseñar los cuatro pasos y
   * retirarlos medio segundo después, con lo que ya se estuviera escribiendo dentro.
   */
  protected readonly confirmacion = inject(ConfirmacionDeCorreoService);
  readonly faltaConfirmarCorreo = this.confirmacion.falta.bind(this.confirmacion);

  private readonly api = inject(PanelOrganizacionApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(PanelOrganizacionStore);
  private readonly borradores = inject(BorradoresDeProcesoApi);
  private readonly adminService = inject(AdminService);

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.organizacionId(), ...segmentos);
  }
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(ApiClientService);
  private borradorId: string | null = null;
  /** Se está saliendo a propósito (descartó): ya no hay nada que avisar. */
  private saliendoSinAviso = false;

  /**
   * El bucle de autoguardado, el mismo que usan los tres módulos de la consola.
   *
   * <b>ESTE ASISTENTE SE HABIA ESCRITO EL SUYO Y LE FALTABA LA PARTE DELICADA.</b> Antes de mandar
   * comprobaba `guardando()`, que es la señal del guardado MANUAL, no la del automático: dos
   * automáticos sí podían solaparse, llegar con la misma versión y hacer que el servidor rechazara
   * el segundo con «El borrador cambió en otra sesión» —falso: había chocado consigo mismo—,
   * dejando el formulario en error y las últimas pulsaciones sin guardar. La clase compartida marca
   * el trabajo pendiente y lo reintenta al terminar, que es justo lo que faltaba.
   */
  private readonly autoguardado = new AutoguardadoDeBorrador<Record<string, unknown>>({
    // NO SE LEE POR AQUI. El borrador se recupera al abrir el asistente, con la ruta de la
    // organización, y de ahí sale el identificador que este transporte necesita para guardar.
    leer: async () => null,
    guardar: (datos, version) => this.guardarBorradorPrivado(datos, version),
    // NO SE DESCARTA. El borrador privado de la organización es uno solo y se reutiliza: al
    // guardar el Festival de verdad, el servidor lo vacía. Borrarlo desde aquí dejaría a la
    // siguiente alta sin la fila que `ObtenerOCrearBorrador` espera encontrar.
    descartar: async () => undefined,
  });

  private temporizadorDeBusqueda: ReturnType<typeof setTimeout> | null = null;
  private overflowOriginalDelDocumento: string | null = null;

  readonly pasos = PASOS_DEL_ASISTENTE;
  readonly niveles = NIVELES_DE_COBERTURA;
  /** La periodicidad se lee por su nombre, no por su código: «otra_regular» no es una palabra. */
  readonly etiquetaDePeriodicidad = etiquetaDePeriodicidad;

  /** Los enlaces públicos que la ficha trae, separados por « · »; vacío si no trae ninguno (D3-07). */
  enlacesPublicos(ficha: { instagram?: string | null; facebook?: string | null; sitioWeb?: string | null; otroEnlace?: string | null }): string {
    return [ficha.instagram, ficha.facebook, ficha.sitioWeb, ficha.otroEnlace].filter(enlace => !!enlace).join(' · ');
  }

  readonly periodicidades = PERIODICIDADES;
  readonly pideDetalle = pideDetalle;
  /**
   * LA ORGANIZACIÓN DEL ASISTENTE SE FIJA AL ABRIRLO. La auditoría cambió el selector a
   * mitad del asistente y el Festival escrito para «Caribe» se guardó en «Pacífico», mientras el
   * autoguardado seguía escribiendo en el borrador de Caribe. Ahora el asistente lee la organización
   * una vez, de la URL por medio del store, y todo lo que guarda —borrador, coincidencias, alta—
   * va a esa. Cambiar de organización reconstruye el panel y abre otro asistente, vacío.
   */
  private readonly organizacionDelAsistente = this.store.organizacionId();
  readonly organizacionId = (): string => this.organizacionDelAsistente;
  /** Solicitar la administración de un Festival existente es de la administración. */
  readonly esAdministradora = this.store.esAdministradora;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  /**
   * Lo que la plantilla enseña sobre el guardado, derivado del bucle compartido.
   *
   * Se traduce en vez de exponer el estado crudo porque esta pantalla ya decía «pendiente» donde el
   * bucle dice «inactivo», y cambiar el rótulo visible no era parte de arreglar la carrera.
   */
  readonly estadoGuardado = computed<'pendiente' | 'guardando' | 'guardado' | 'error'>(() => {
    switch (this.autoguardado.estado()) {
      case 'guardando': return 'guardando';
      case 'guardado': return 'guardado';
      case 'fallido': return 'error';
      default: return 'pendiente';
    }
  });
  readonly buscandoCoincidencias = signal(false);
  readonly coincidencias = signal<CoincidenciaHistorica[]>([]);
  readonly justificacionReclamacion = signal('');
  /** Los soportes elegidos para la solicitud. */
  readonly soportesReclamacion = signal<string[]>([]);
  readonly reclamacionEnviada = signal('');
  readonly modalCoincidenciasAbierto = signal(false);
  readonly coincidenciasRevisadas = signal(false);

  /**
   * Esta coincidencia se puede reclamar.
   *
   * SOLO LOS HISTÓRICOS SIN DUEÑO. Un Festival que ya administra otra organización no se reclama
   * desde el asistente de alta: lo que hace falta ahí es no registrarlo dos veces.
   */
  sePuedeReclamar(coincidencia: CoincidenciaBasica): boolean {
    return coincidencia.tipoCoincidencia === 'HistoricoReclamable';
  }

  /** Cuántas de las encontradas son registros históricos que sí se pueden reclamar. */
  readonly cuantasReclamables = computed(
    () => this.coincidencias().filter(una => this.sePuedeReclamar(una)).length);
  readonly pasoActivo = signal(1);
  /** «Visitado» no es «completo»: solo se pinta completo el paso que se visitó y está bien. */
  readonly estadoDeLosPasos = signal<EstadosDeLosPasos>({});
  private readonly visitados = new Set<number>([1]);
  readonly confirmandoSalida = signal(false);
  /** Se recuperó lo escrito en una visita anterior. */
  readonly borradorRecuperado = signal(false);
  /** Fecha del último guardado, para «Borrador guardado a las HH:MM». */
  readonly ultimoGuardado = this.autoguardado.ultimoGuardado;

  readonly catalogos = signal<CatalogosDelFestival>(CATALOGOS_VACIOS);
  readonly ubicaciones = signal<UbicacionDivipola[]>([]);
  readonly errores = signal<Record<string, string>>({});

  readonly formulario: FormularioDelAsistente = {
    nombre: '', descripcion: '', periodicidad: '', periodicidadDetalle: '', nivelCobertura: 'municipal',
    codigoDepartamento: '', codigoMunicipio: '', sedeCodigoDepartamento: '', sedeCodigoMunicipio: '', correoContacto: '', telefonoCelular: '',
    instagram: '', facebook: '', paginaWeb: '', otroEnlace: '', observacionesContacto: '',
    practicasMusicalesIds: [], territoriosSonorosIds: [],
  };

  nombreOrganizacion(): string {
    return this.store.organizacionElegida()?.name ?? '';
  }

  ngOnInit(): void {
    const pasoPedido = Number(this.route.snapshot.queryParamMap.get('paso'));
    if (this.pasos.some(paso => paso.id === pasoPedido)) this.pasoActivo.set(pasoPedido);

    forkJoin({
      catalogos: this.api.obtenerCatalogosDelFestival().pipe(catchError(() => of(CATALOGOS_VACIOS))),
      ubicaciones: this.api.obtenerUbicaciones().pipe(catchError(() => of([] as UbicacionDivipola[]))),
    }).subscribe(({ catalogos, ubicaciones }) => {
      this.catalogos.set(catalogos ?? CATALOGOS_VACIOS);
      this.ubicaciones.set(ubicaciones ?? []);
      this.cargando.set(false);
      this.cargarBorradorPrivado();
    });
  }

  /** Si hay algo escrito que se perdería o quedaría como borrador al salir. */
  private hayAlgoEscrito(): boolean {
    return CAMPOS_DE_TEXTO_DEL_BORRADOR
      .filter(campo => campo !== 'nivelCobertura')
      .some(campo => this.formulario[campo].trim() !== '')
      || this.formulario.practicasMusicalesIds.length > 0
      || this.formulario.territoriosSonorosIds.length > 0;
  }

  /**
   * Lo que se dice al cambiar de organización con el Festival a medias. Con el borrador
   * privado activo, lo escrito se queda como borrador de ESTA organización; sin él, se pierde. En
   * ningún caso pasa a la otra.
   */
  avisoAlCambiarDeOrganizacion(actual: string, nueva: string): string | null {
    if (this.guardando() || !this.hayAlgoEscrito()) return null;
    if (this.autoguardado.estado() === 'inactivo' && !this.borradorId) {
      return `Lo que escribiste del Festival no está guardado y se perderá. No pasará a «${nueva}».`;
    }
    return `Tu Festival a medias se guarda como borrador de «${actual}» y no pasará a «${nueva}». Lo recuperas al volver a «Registrar Festival» en «${actual}».`;
  }

  /** Lo escrito está respaldado en el servidor (o lo estará en cuanto pase la quietud). */
  private estaRespaldado(): boolean {
    return this.borradorId !== null && this.autoguardado.estado() !== 'fallido';
  }

  /**
   * AVISO DE CAMBIOS SIN GUARDAR. Con el borrador en marcha salir no pierde nada y no
   * se pregunta; solo se avisa cuando lo escrito NO está respaldado.
   */
  avisoAlSalir(): string | null {
    if (this.saliendoSinAviso || this.guardando() || !this.hayAlgoEscrito() || this.estaRespaldado()) return null;
    return 'Lo que escribiste del Festival no se pudo guardar como borrador y se perderá si sales ahora.';
  }

  @HostListener('window:beforeunload', ['$event'])
  avisarAlCerrarLaPestana(evento: BeforeUnloadEvent): void {
    if (this.avisoAlSalir()) evento.preventDefault();
  }

  /** Antes de salir, lo pendiente del autoguardado se manda ya, a la organización de este asistente. */
  async antesDeCambiarDeOrganizacion(): Promise<void> {
    if (this.borradorId) await this.autoguardado.guardarYa();
  }

  ngOnDestroy(): void {
    // Lo que esperaba la quietud se manda antes de irse: salir a media escritura no lo pierde.
    if (this.borradorId) void this.autoguardado.guardarYa().finally(() => this.autoguardado.apagar());
    else this.autoguardado.apagar();
    if (this.temporizadorDeBusqueda) clearTimeout(this.temporizadorDeBusqueda);
    this.desbloquearDesplazamiento();
  }

  programarGuardado(): void {
    // EL BUCLE LO LLEVA `autoguardado`: espera la quietud, no solapa dos envíos y reintenta el que
    // quedó pendiente. Aquí solo se le dice qué hay que guardar.
    this.autoguardado.anotar(this.construirSolicitud() as unknown as Record<string, unknown>);
    this.actualizarEstados();

    if (this.temporizadorDeBusqueda) clearTimeout(this.temporizadorDeBusqueda);
    this.temporizadorDeBusqueda = setTimeout(() => this.buscarCoincidencias(), 850);
  }

  private cargarBorradorPrivado(): void {
    const organizacionId = this.organizacionId();
    if (!organizacionId) return;
    this.http.get<{ id: string; datosJson: string; version: number }>(`/api/v1/externo/organizaciones/${organizacionId}/festivales/borrador`, { errorFallback: 'No fue posible recuperar el borrador privado' }).subscribe({
      next: borrador => {
        this.borradorId = borrador.id;
        let recuperado: boolean;
        try {
          const datos = JSON.parse(borrador.datosJson || '{}') as Record<string, unknown>;
          for (const campo of CAMPOS_DE_TEXTO_DEL_BORRADOR) {
            const valor = datos[campo];
            if (typeof valor === 'string') this.formulario[campo] = valor;
            else if (valor === null) this.formulario[campo] = '';
          }
          this.formulario.nivelCobertura ||= 'municipal';
          this.formulario.practicasMusicalesIds = this.normalizarIds(datos['practicasMusicalesIds']);
          this.formulario.territoriosSonorosIds = this.normalizarIds(datos['territoriosSonorosIds']);
          recuperado = this.hayAlgoEscrito();
        } catch {
          // UN BORRADOR ILEGIBLE NO SE APLICA, pero el asistente sigue: se empieza en blanco en vez
          // de dejar el formulario a medio rellenar con lo que se pudo interpretar.
          this.autoguardado.apagar();
          return;
        }
        // EL ESTADO ARRANCA «INACTIVO» SI NO HABÍA NADA: «Borrador guardado» sin datos es engañoso.
        this.autoguardado.encender(borrador.version, recuperado);
        this.borradorRecuperado.set(recuperado);
        this.actualizarEstados();
      },
      error: () => this.autoguardado.apagar(),
    });
  }

  private normalizarIds(valor: unknown): number[] {
    if (!Array.isArray(valor)) return [];
    return valor
      .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
      .filter((id, indice, todos) => todos.indexOf(id) === indice);
  }

  /**
   * Manda el borrador al servidor. Lo llama el bucle compartido, nunca la plantilla.
   *
   * Devuelve `null` si falla, que es lo que el bucle traduce a «fallido» en pantalla: quien está
   * escribiendo necesita saber que lo que ve ya no está respaldado.
   */
  private async guardarBorradorPrivado(
    datos: Record<string, unknown>, version: number | null,
  ): Promise<{ version: number; fechaActualizacion: string } | null> {
    if (!this.borradorId) return null;

    try {
      const testigo = await firstValueFrom(this.http.get<{ requestToken: string }>(
        '/api/v1/externo/organizaciones/csrf',
        { errorFallback: 'No fue posible preparar el guardado del borrador' }));

      const respuesta = await firstValueFrom(this.http.put<{ version: number }>(
        `/api/v1/externo/borradores-proceso/${this.borradorId}`,
        { datosJson: JSON.stringify(datos), version },
        { headers: { 'X-CSRF-TOKEN': testigo.requestToken }, errorFallback: 'No fue posible guardar el borrador' }));

      return { version: respuesta.version, fechaActualizacion: new Date().toISOString() };
    } catch {
      return null;
    }
  }

  private buscarCoincidencias(abrirAlTerminar = false): void {
    // (REC-06): basta el departamento. Antes se exigía alcance municipal y municipio, y un
    // Festival departamental nunca encontraba su registro histórico.
    if (!this.formulario.nombre.trim() || !this.formulario.codigoDepartamento) {
      this.coincidencias.set([]);
      if (abrirAlTerminar) this.irAlPaso(4);
      return;
    }
    this.buscandoCoincidencias.set(true);
    this.http.get<CoincidenciaBasica[]>(`/api/v1/externo/organizaciones/${this.organizacionId()}/festivales/coincidencias-historicas`, { params: { nombre: this.formulario.nombre, codigoDepartamento: this.formulario.codigoDepartamento, codigoMunicipio: this.formulario.codigoMunicipio }, errorFallback: 'No fue posible buscar coincidencias' }).subscribe({
      next: filas => {
        if (!filas.length) {
          this.coincidencias.set([]);
          this.buscandoCoincidencias.set(false);
          if (abrirAlTerminar) this.irAlPaso(4);
          return;
        }
        forkJoin(filas.map(fila => forkJoin({
          ficha: this.http.get<FichaFestivalPublica>(`/api/v1/publico/festivales/${fila.festivalId}`, { errorFallback: 'No fue posible consultar la ficha pública del Festival.' }),
          ediciones: this.http.get<EdicionPublica[]>(`/api/v1/publico/festivales/${fila.festivalId}/ediciones`, { errorFallback: 'No fue posible consultar las ediciones públicas del Festival.' }),
        }).pipe(catchError((fallo: { status?: number }) => of({
          ficha: null,
          ediciones: [] as EdicionPublica[],
          // 404 ES «no hay ficha pública», no «se cayó la consulta». Un borrador propio da 404.
          sinFichaPublica: fallo?.status === 404,
        })))))
          .subscribe(detalles => {
            this.coincidencias.set(filas.map((fila, indice) => ({
              ...fila,
              ficha: detalles[indice].ficha,
              ediciones: detalles[indice].ediciones,
              sinFichaPublica: 'sinFichaPublica' in detalles[indice] ? detalles[indice].sinFichaPublica : false,
            })));
            this.buscandoCoincidencias.set(false);
            if (abrirAlTerminar && detalles.length) this.abrirModalDeCoincidencias();
          });
      },
      error: () => {
        this.buscandoCoincidencias.set(false);
        this.coincidencias.set([]);
        // Una consulta auxiliar no puede dejar atrapado un registro nuevo.
        if (abrirAlTerminar) this.irAlPaso(4);
      },
    });
  }

  solicitarAdministracion(festivalId: string): void {
    if (!this.borradorId || !this.justificacionReclamacion().trim()) {
      this.error.set('Explica por qué este Festival corresponde a tu organización antes de enviar la solicitud.');
      return;
    }
    this.guardando.set(true);
    this.http.get<{ requestToken: string }>('/api/v1/externo/organizaciones/csrf', { errorFallback: 'No fue posible preparar la solicitud de administración' }).pipe(switchMap(token =>
      this.http.post<{ id: string }>(`/api/v1/externo/organizaciones/${this.organizacionId()}/reclamaciones-administracion`, {
        festivalId, borradorId: this.borradorId, justificacion: this.justificacionReclamacion().trim(),
        soportes: this.soportesReclamacion(),
        senalesJson: JSON.stringify(['Nombre y territorio coincidentes']),
      }, { headers: { 'X-CSRF-TOKEN': token.requestToken }, errorFallback: 'No fue posible enviar la solicitud de administración' })
    )).subscribe({
      // (REC-03): SE SALE DEL ASISTENTE. Quedarse en el paso 4 dejaba «Guardar borrador» como
      // acción principal —un Festival duplicado del histórico— y el borrador ya quedó congelado en
      // la solicitud. Solicitudes la enseña con su estado.
      next: () => {
        this.guardando.set(false);
        this.reclamacionEnviada.set(festivalId);
        this.autoguardado.apagar();
        this.cerrarModalDeCoincidencias();
        this.router.navigate(this.enPanel('solicitudes'), { queryParams: { reclamada: festivalId } });
      },
      error: fallo => { this.guardando.set(false); this.error.set(traducirErrorDelServidor(fallo, { alternativa: 'No fue posible enviar la solicitud.' }).general); },
    });
  }

  // ─────────────────────────── DIVIPOLA y territorio ───────────────────────────
  // Misma lógica que `FichaFestivalComponent` -mismas reglas de `CK_Festivales_NivelCobertura`-,
  // sobre el formulario propio del asistente.

  departamentos(): { codigo: string; nombre: string }[] {
    const unicos = new Map(this.ubicaciones().map(fila => [fila.departmentCode, fila.departmentName]));
    return Array.from(unicos, ([codigo, nombre]) => ({ codigo, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  municipios(): UbicacionDivipola[] {
    if (!this.formulario.codigoDepartamento) return [];
    return this.ubicaciones().filter(fila => fila.departmentCode === this.formulario.codigoDepartamento);
  }

  exigeDepartamento(): boolean {
    const nivel = this.formulario.nivelCobertura;
    return nivel === 'departamental' || nivel === 'municipal';
  }

  exigeMunicipio(): boolean {
    return this.formulario.nivelCobertura === 'municipal';
  }

  alCambiarNivel(): void {
    if (!this.exigeDepartamento()) {
      this.formulario.codigoDepartamento = '';
      this.formulario.codigoMunicipio = '';
      return;
    }
    if (!this.exigeMunicipio()) this.formulario.codigoMunicipio = '';
    this.programarGuardado();
    this.limpiarError('codigoDepartamento'); this.limpiarError('codigoMunicipio');
  }

  /** La sede principal, aparte de la cobertura: la elige el selector común. */
  elegirSede(sede: SedeElegida): void {
    this.formulario.sedeCodigoDepartamento = sede.departamento;
    this.formulario.sedeCodigoMunicipio = sede.municipio;
    this.limpiarError('sedeCodigoDepartamento'); this.limpiarError('sedeCodigoMunicipio');
    this.programarGuardado();
  }

  /** La sede que se guarda: la elegida o, con cobertura municipal, el municipio de la cobertura. */
  private sedeEfectiva() {
    const f = this.formulario;
    return sedeParaEnviar(f, f.nivelCobertura, this.exigeDepartamento() ? f.codigoDepartamento : '', this.exigeMunicipio() ? f.codigoMunicipio : '');
  }

  alCambiarDepartamento(): void {
    this.formulario.codigoMunicipio = '';
    this.limpiarError('codigoDepartamento'); this.limpiarError('codigoMunicipio');
    this.programarGuardado();
  }

  // ─────────────────────────── Catálogos (paso 3) ───────────────────────────

  practicaElegida(id: number): boolean {
    return this.formulario.practicasMusicalesIds.includes(id);
  }

  territorioElegido(id: number): boolean {
    return this.formulario.territoriosSonorosIds.includes(id);
  }

  alternarPractica(id: number): void {
    this.alternarEnLaLista(this.formulario.practicasMusicalesIds, id);
    this.programarGuardado();
  }

  alternarTerritorio(id: number): void {
    this.alternarEnLaLista(this.formulario.territoriosSonorosIds, id);
    this.programarGuardado();
  }

  private alternarEnLaLista(lista: number[], id: number): void {
    const indice = lista.indexOf(id);
    if (indice === -1) lista.push(id);
    else lista.splice(indice, 1);
  }

  // ─────────────────────────── Navegación entre pasos ───────────────────────────

  /**
   * «Atrás»/«Siguiente» siempre disponibles, sin bloqueo progresivo.
   *
   * MISMO CRITERIO QUE `validar()` en `FichaFestivalComponent`: ahí la comprobación es agregada, al
   * guardar, no campo a campo mientras se escribe. Aquí tampoco se impide avanzar por un campo sin
   * llenar -el paso 4 valida todo antes de guardar y, si algo falta, vuelve al paso que lo tiene-.
   */
  irAlPaso(id: number, desplazar = true): void {
    if (!this.pasos.some(paso => paso.id === id)) return;
    this.pasoActivo.set(id);
    this.visitados.add(id);
    this.actualizarEstados();
    // Es un único formulario: la URL no cambia y el desplazamiento se controla hacia el bloque
    // que acaba de aparecer. Así «Siguiente», «Atrás» y el indicador de pasos no llevan al inicio
    // del documento ni dejan el nuevo contenido por encima de la ventana.
    if (desplazar) this.desplazarAlPaso(id);
  }

  pasoAnterior(): void {
    if (this.pasoActivo() > 1) this.irAlPaso(this.pasoActivo() - 1);
  }

  pasoSiguiente(): void {
    if (this.pasoActivo() === 3 && !this.coincidenciasRevisadas()) {
      if (this.coincidencias().length) { this.abrirModalDeCoincidencias(); return; }
      this.buscarCoincidencias(true);
      return;
    }
    if (this.pasoActivo() < this.pasos.length) this.irAlPaso(this.pasoActivo() + 1);
  }

  // ───────────── «Es el mismo»: el camino que faltaba en las coincidencias ─────────────

  /** El Festival de otra organización para el que se está escribiendo el mensaje, si lo hay. */
  readonly invitacionAbierta = signal<string | null>(null);
  readonly mensajeDeInvitacion = signal('');
  readonly invitacionEnviada = signal<string | null>(null);
  readonly enviandoInvitacion = signal(false);
  readonly errorDeInvitacion = signal('');

  abrirInvitacion(festivalId: string): void {
    this.invitacionAbierta.set(festivalId);
    this.errorDeInvitacion.set('');
  }

  /**
   * «Es el mismo: pedir que me inviten». Una solicitud de vinculación al PNMC, que la revisa en
   * su bandeja y avisa a quien administra el Festival. Antes la ventana repetía «Si es el mismo, no
   * lo registres de nuevo» y solo ofrecía «No corresponde; continuar», sin salida para el caso que
   * más importa para evitar duplicados.
   */
  enviarInvitacion(festivalId: string): void {
    const motivo = this.mensajeDeInvitacion().trim();
    if (!motivo) { this.errorDeInvitacion.set('Cuéntanos cómo se relaciona tu organización con este Festival.'); return; }
    this.enviandoInvitacion.set(true);
    this.errorDeInvitacion.set('');
    this.adminService.crearSolicitudDeVinculacion({
      moduleId: 'festivals', recordId: festivalId, requestedScope: 'editor',
      reason: `Es el mismo Festival que ${this.nombreOrganizacion() || 'mi organización'} iba a registrar: ${motivo}`.slice(0, 1200),
      evidenceText: '',
    }).subscribe({
      next: () => { this.enviandoInvitacion.set(false); this.invitacionEnviada.set(festivalId); this.invitacionAbierta.set(null); },
      error: fallo => {
        this.enviandoInvitacion.set(false);
        this.errorDeInvitacion.set(traducirErrorDelServidor(fallo, { alternativa: 'No fue posible enviar la solicitud.' }).general);
      },
    });
  }

  continuarSinReclamar(): void {
    this.cerrarModalDeCoincidencias();
    this.coincidenciasRevisadas.set(true);
    this.irAlPaso(4);
  }

  nombresCatalogo(items: { nombre: string }[]): string {
    return items.map(item => item.nombre).join(', ');
  }

  abrirModalDeCoincidencias(): void {
    if (this.overflowOriginalDelDocumento === null) this.overflowOriginalDelDocumento = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.document.documentElement.style.overflow = 'hidden';
    this.modalCoincidenciasAbierto.set(true);
  }

  private cerrarModalDeCoincidencias(): void {
    this.modalCoincidenciasAbierto.set(false);
    this.desbloquearDesplazamiento();
  }

  private desbloquearDesplazamiento(): void {
    if (this.overflowOriginalDelDocumento === null) return;
    this.document.body.style.overflow = this.overflowOriginalDelDocumento;
    this.document.documentElement.style.overflow = this.overflowOriginalDelDocumento;
    this.overflowOriginalDelDocumento = null;
  }

  // ─────────────────────────── Guardar ───────────────────────────

  /**
   * Las reglas del asistente, campo a campo. Las dos de `FichaFestivalComponent.validar()` —`nombre`
   * siempre obligatorio, territorio según `nivelCobertura`— más las de formato que el servidor
   * también aplica: correo, teléfono y direcciones, con la REGLA ÚNICA de URL.
   */
  mensajeDelCampo(campo: string): string | null {
    const f = this.formulario;
    switch (campo) {
      case 'nombre': return (f.nombre ?? '').trim() ? null : 'Escribe el nombre del festival.';
      case 'codigoDepartamento': return this.exigeDepartamento() && !f.codigoDepartamento ? 'Elige un departamento.' : null;
      case 'codigoMunicipio': return this.exigeMunicipio() && !f.codigoMunicipio ? 'Elige un municipio.' : null;
      // LA SEDE PRINCIPAL (decisión 119): la elegida o el municipio de una cobertura municipal.
      case 'sedeCodigoDepartamento': return this.sedeEfectiva().sedeCodigoDepartamento ? null : 'Elige el departamento de la sede principal.';
      case 'sedeCodigoMunicipio': return this.sedeEfectiva().sedeCodigoDepartamento && !this.sedeEfectiva().sedeCodigoMunicipio ? 'Elige el municipio de la sede principal.' : null;
      case 'periodicidadDetalle':
        return ['otra_regular', 'intermitente'].includes(f.periodicidad) && !(f.periodicidadDetalle ?? '').trim()
          ? 'Explica brevemente la periodicidad seleccionada.' : null;
      case 'correoContacto': return !(f.correoContacto ?? '').trim() || esCorreoValido(f.correoContacto) ? null : MENSAJE_DE_CORREO;
      case 'telefonoCelular': return mensajeDeTelefono(f.telefonoCelular);
      case 'instagram': return mensajeDeRedSocial(f.instagram);
      case 'facebook': return mensajeDeRedSocial(f.facebook);
      case 'paginaWeb': return mensajeDeUrl(f.paginaWeb);
      case 'otroEnlace': return mensajeDeUrl(f.otroEnlace);
      default: return null;
    }
  }

  private validar(): Record<string, string> {
    const errores: Record<string, string> = {};
    for (const campo of Object.keys(this.PASO_DEL_CAMPO)) {
      const mensaje = this.mensajeDelCampo(campo);
      if (mensaje) errores[campo] = mensaje;
    }
    return errores;
  }

  /** Al salir de un campo se valida ese campo, y solo ese. */
  alSalirDelCampo(campo: string): void {
    const mensaje = this.mensajeDelCampo(campo);
    this.errores.update(actual => {
      const siguiente = { ...actual };
      if (mensaje) siguiente[campo] = mensaje; else delete siguiente[campo];
      return siguiente;
    });
    this.actualizarEstados();
  }

  /** Lo que falta, en el orden de los pasos, para la revisión («Falta: …» con enlace a cada campo). */
  faltantes(): { campo: string; paso: number; rotulo: string; mensaje: string }[] {
    return Object.entries(this.validar())
      .map(([campo, mensaje]) => ({ campo, mensaje, paso: this.PASO_DEL_CAMPO[campo] ?? 1, rotulo: this.ROTULO_DEL_CAMPO[campo] ?? campo }))
      .sort((a, b) => a.paso - b.paso);
  }

  /** «Falta: Nombre» lleva al paso y al campo. */
  irAlCampo(campo: string): void {
    const mensaje = this.mensajeDelCampo(campo);
    if (mensaje) this.errores.update(actual => ({ ...actual, [campo]: mensaje }));
    this.irAlPaso(this.PASO_DEL_CAMPO[campo] ?? 1, false);
    this.enfocar(`#${this.ID_DEL_CAMPO[campo] ?? 'asistente-' + campo}`);
  }

  /**
   * «VISITADO» NO ES «COMPLETO». Antes se pintaban «completos» los pasos anteriores al
   * activo aunque se hubiera pasado por ellos con el nombre vacío. Ahora solo es completo el paso
   * visitado que no tiene nada pendiente; el visitado con algo pendiente se pinta incompleto.
   */
  private actualizarEstados(): void {
    const faltas = this.validar();
    const estados: Record<number, 'completo' | 'incompleto'> = {};
    for (const paso of this.visitados) {
      if (paso === this.pasoActivo() || paso === this.pasos.length) continue;
      const conFalta = Object.keys(faltas).some(campo => (this.PASO_DEL_CAMPO[campo] ?? 1) === paso);
      estados[paso] = conFalta ? 'incompleto' : 'completo';
    }
    this.estadoDeLosPasos.set(estados);
  }

  /** En cuál paso vive cada campo que puede fallar, para volver ahí si algo no pasó la validación. */
  private readonly PASO_DEL_CAMPO: Readonly<Record<string, number>> = {
    nombre: 1,
    periodicidadDetalle: 1,
    codigoDepartamento: 2,
    codigoMunicipio: 2,
    sedeCodigoDepartamento: 2,
    sedeCodigoMunicipio: 2,
    correoContacto: 2,
    telefonoCelular: 2,
    instagram: 2,
    facebook: 2,
    paginaWeb: 2,
    otroEnlace: 2,
  };

  private readonly ROTULO_DEL_CAMPO: Readonly<Record<string, string>> = {
    nombre: 'Nombre del festival', periodicidadDetalle: 'Explicación de la periodicidad',
    codigoDepartamento: 'Departamento', codigoMunicipio: 'Municipio', sedeCodigoDepartamento: 'Departamento de la sede', sedeCodigoMunicipio: 'Municipio de la sede', correoContacto: 'Correo de contacto',
    telefonoCelular: 'Celular', instagram: 'Instagram', facebook: 'Facebook', paginaWeb: 'Página web', otroEnlace: 'Otro enlace',
  };

  /** El `id` del control de cada campo, para llevar el foco. */
  private readonly ID_DEL_CAMPO: Readonly<Record<string, string>> = {
    nombre: 'asistente-nombre', periodicidadDetalle: 'asistente-periodicidad-detalle',
    codigoDepartamento: 'asistente-departamento', codigoMunicipio: 'asistente-municipio',
    sedeCodigoDepartamento: 'asistente-sede-departamento', sedeCodigoMunicipio: 'asistente-sede-municipio',
    correoContacto: 'asistente-correo', telefonoCelular: 'asistente-celular', instagram: 'asistente-instagram',
    facebook: 'asistente-facebook', paginaWeb: 'asistente-pagina-web', otroEnlace: 'asistente-otro-enlace',
  };

  alCambiarCampo(campo: string): void { this.limpiarError(campo); this.programarGuardado(); }

  alCambiarPeriodicidad(): void {
    if (!['otra_regular', 'intermitente'].includes(this.formulario.periodicidad)) this.formulario.periodicidadDetalle = '';
    this.alCambiarCampo('periodicidad');
  }

  private limpiarError(campo: string): void {
    this.errores.update(actual => { if (!actual[campo]) return actual; const siguiente = { ...actual }; delete siguiente[campo]; return siguiente; });
  }

  private construirSolicitud(): GuardarFestivalSolicitud {
    const exigeDepartamento = this.exigeDepartamento();
    const exigeMunicipio = this.exigeMunicipio();
    return {
      nombre: this.formulario.nombre.trim(),
      descripcion: vacioANulo(this.formulario.descripcion),
      correoContacto: vacioANulo(this.formulario.correoContacto),
      telefonoCelular: vacioANulo(this.formulario.telefonoCelular),
      instagram: vacioANulo(normalizarRedSocial(this.formulario.instagram)),
      facebook: vacioANulo(normalizarRedSocial(this.formulario.facebook)),
      paginaWeb: vacioANulo(normalizarUrl(this.formulario.paginaWeb)),
      otroEnlace: vacioANulo(normalizarUrl(this.formulario.otroEnlace)),
      observacionesContacto: vacioANulo(this.formulario.observacionesContacto),
      periodicidad: vacioANulo(this.formulario.periodicidad),
      periodicidadDetalle: vacioANulo(this.formulario.periodicidadDetalle),
      nivelCobertura: this.formulario.nivelCobertura,
      codigoDepartamento: exigeDepartamento ? vacioANulo(this.formulario.codigoDepartamento) : null,
      codigoMunicipio: exigeMunicipio ? vacioANulo(this.formulario.codigoMunicipio) : null,
      ...this.sedeEfectiva(),
      practicasMusicalesIds: [...this.formulario.practicasMusicalesIds],
      territoriosSonorosIds: [...this.formulario.territoriosSonorosIds],
    };
  }

  /**
   * Guarda el borrador. Sin ediciones: llama solo a `crearFestival()`, nunca a `crearVersion()` -el
   * asistente nunca pidió ninguno de los treinta y tres campos de una edición-.
   */
  guardarBorrador(): void {
    if (this.guardando()) return;
    const errores = this.validar();
    this.errores.set(errores);
    this.actualizarEstados();
    if (Object.keys(errores).length > 0) {
      const primero = this.faltantes()[0];
      this.error.set('Revisa los campos marcados.');
      // El foco del campo inválido es el único que debe gobernar este desplazamiento. Si también
      // moviéramos el encabezado, dos tareas consecutivas competirían y producirían el salto que
      // se percibía al intentar guardar.
      this.irAlCampo(primero.campo);
      return;
    }
    this.error.set('');

    if (this.coincidencias().length > 0 && !this.coincidenciasRevisadas()) {
      this.abrirModalDeCoincidencias();
      return;
    }
    this.guardando.set(true);
    this.api.crearFestival(this.organizacionId(), {
      ...this.construirSolicitud(),
      borradorProcesoId: this.borradorId,
    }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.error.set('Festival registrado como borrador. Ya puedes completar sus ediciones cuando lo necesites.');
        this.router.navigate(this.enPanel('procesos/festivales'));
      },
      error: fallo => {
        this.guardando.set(false);
        // EL MOTIVO DEL SERVIDOR VUELVE A SU CAMPO, con el nombre que ve la persona.
        const traducido = traducirErrorDelServidor(fallo, {
          camposConLugar: Object.keys(this.PASO_DEL_CAMPO),
          alternativa: 'No fue posible registrar el Festival.',
        });
        this.error.set(traducido.general);
        if (traducido.hayCampos) {
          this.errores.update(actual => ({ ...actual, ...traducido.campos }));
          this.irAlCampo(Object.keys(traducido.campos)[0]);
        }
      },
    });
  }

  /**
   * «Cancelar» PREGUNTA: con algo escrito, ofrece conservar el borrador o descartarlo.
   * Antes salía en silencio y el borrador quedaba invisible, retomándose sin avisar.
   */
  cancelar(): void {
    if (!this.hayAlgoEscrito()) { void this.router.navigate(this.enPanel('procesos/festivales')); return; }
    this.confirmandoSalida.set(true);
  }

  salirConservando(): void {
    this.saliendoSinAviso = true;
    this.confirmandoSalida.set(false);
    void this.router.navigate(this.enPanel('procesos/festivales'));
  }

  descartarYSalir(): void {
    this.saliendoSinAviso = true;
    this.confirmandoSalida.set(false);
    const id = this.borradorId;
    this.borradorId = null;
    this.autoguardado.apagar();
    const salir = () => void this.router.navigate(this.enPanel('procesos/festivales'));
    if (id) this.borradores.descartar(id).subscribe({ next: salir, error: salir }); else salir();
  }

  etiquetaCobertura(codigo: string | null | undefined): string {
    return this.niveles.find(nivel => nivel.codigo === codigo?.trim().toLowerCase())?.etiqueta ?? 'Sin definir';
  }

  private enfocar(selector: string): void {
    setTimeout(() => {
      const destino = this.host.nativeElement.querySelector<HTMLElement>(selector);
      if (!destino) return;
      destino.focus({ preventScroll: true });
      destino.scrollIntoView({ behavior: this.comportamientoDeDesplazamiento(), block: 'center' });
    });
  }

  private desplazarAlPaso(id: number): void {
    setTimeout(() => {
      const destino = this.host.nativeElement.querySelector<HTMLElement>(`#paso${id}-titulo`);
      destino?.scrollIntoView({ behavior: this.comportamientoDeDesplazamiento(), block: 'start' });
    });
  }

  private comportamientoDeDesplazamiento(): ScrollBehavior {
    return this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
  }
}
