import { CommonModule } from '@angular/common';
import { SelectorMultipleComponent } from '../../shared/components/ui/selector-multiple/selector-multiple.component';
import { Component, HostListener, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmacionComponent } from '../../shared/components/ui/confirmacion/confirmacion.component';
import { ErrorDeCampoComponent } from '../../shared/components/ui/error-de-campo/error-de-campo.component';
import { FechaPipe } from '../../shared/utils/fecha.pipe';
import { AutoguardadoDeBorrador } from '../../core/services/autoguardado-de-borrador';
import { esCorreoValido, MENSAJE_DE_CORREO, mensajeDeTelefono } from '../../core/formularios/telefono';
import { mensajeDeRedSocial, mensajeDeUrl, normalizarRedSocial, normalizarUrl } from '../../core/formularios/url';
import { enfocarCampo } from '../../core/formularios/foco';
import { traducirErrorDelServidor } from '../../core/formularios/traductor-de-errores';
import { BorradoresDeProcesoApi } from './borradores-de-proceso.api';
import { catchError, forkJoin, of } from 'rxjs';

import { AvisoDeCorreoSinConfirmarComponent } from './aviso-de-correo-sin-confirmar.component';
import { ConfirmacionDeCorreoService } from '../../core/services/confirmacion-de-correo.service';
import { EstadosDeLosPasos, IndicadorDePasosComponent, PasoDelIndicador } from '../../shared/components/ui/indicador-de-pasos/indicador-de-pasos.component';
import {
  CatalogosDeMercadoExternos,
  FalloDelServidor,
  FestivalElegibleParaMercado,
  GuardarMercadoSolicitud,
  PanelOrganizacionApi,
  UbicacionDivipola,
} from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { sedeParaEnviar } from '../../core/territorio/sede-principal';
import { SedeElegida, SelectorDeSedeComponent } from '../../shared/components/ui/selector-de-sede/selector-de-sede.component';
import { rutaDelPanel } from '../../core/navegacion/rutas-de-gestion';
import { ConCambiosSinGuardar } from '../../core/navegacion/cambio-de-organizacion';
import { PERIODICIDADES, pideDetalle } from '../../core/vocabularios/periodicidad';

import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
import { rotuloDeEstado } from '../../core/vocabularios/estados';
export const PASOS_DEL_MERCADO: readonly PasoDelIndicador[] = [
  { id: 1, titulo: 'Datos generales' },
  { id: 2, titulo: 'Territorio y contacto' },
  { id: 3, titulo: 'Relación con un festival' },
  { id: 4, titulo: 'Revisar y guardar borrador' },
];

/**
 * Las periodicidades, las mismas que usa el Festival.
 *
 * SE COMPARTE EL VOCABULARIO Y NO SE INVENTA UNO PARALELO: un mercado anual y un festival anual
 * son lo mismo, y dos listas con los mismos valores divergen en cuanto alguien añade uno en una.
 */
// EL VOCABULARIO VIVE EN `core/vocabularios/periodicidad`, no aquí. Esta copia ofrecía
// «Permanente» —que el contrato del servidor no declara— y le faltaban «Trimestral», «Bianual» y
// «Trienal», que sí acepta: una pantalla ofreciendo un noveno valor y escondiendo tres legítimos.

interface FormularioDelMercado {
  nombre: string;
  descripcion: string;
  alcanceId: number | null;
  modalidadId: number | null;
  periodicidad: string;
  periodicidadDetalle: string;
  nivelCobertura: string;
  codigoDepartamento: string;
  codigoMunicipio: string;
  sedeCodigoDepartamento: string;
  sedeCodigoMunicipio: string;
  lugarEspecifico: string;
  correoMercado: string;
  telefonoMercado: string;
  sitioWebMercado: string;
  instagramMercado: string;
  facebookMercado: string;
  otroEnlaceMercado: string;
  observacionesContacto: string;
  seRealizaEnElMarcoDeUnFestival: boolean;
  festivalId: number | null;
  /** Del catálogo del Ecosistema, el mismo que llena un Festival. */
  practicasMusicalesIds: number[];
  territoriosSonorosIds: number[];
}

function vacioANulo(valor: string): string | null {
  const limpio = (valor ?? '').trim();
  return limpio.length === 0 ? null : limpio;
}

/**
 * El asistente de alta de un mercado musical, en /gestion/procesos/mercados/nuevo.
 *
 * <b>ES EL MISMO RECORRIDO QUE EL DE UN FESTIVAL, A PROPOSITO.</b> Una organización que ya registró
 * un festival reconoce esta pantalla: el mismo encabezado, el mismo indicador de pasos, los mismos
 * rótulos y los mismos controles. Lo que cambia es la ficha, no el procedimiento; inventar un
 * segundo estilo de alta obligaría a aprender dos veces lo mismo.
 *
 * <b>LA PUERTA DEL CORREO VA ANTES DEL FORMULARIO.</b> Con el correo sin confirmar el servidor
 * rechaza el registro igual; enseñar los cuatro pasos sería dejar que alguien escriba un mercado
 * entero para encontrarse el muro al guardar.
 *
 * <b>EL TERCER PASO ES LO UNICO QUE ESTE ASISTENTE TIENE Y EL DE FESTIVAL NO.</b> Un mercado puede
 * desarrollarse por su cuenta o dentro de un festival, y cuando ocurre dentro de uno eso es una
 * RELACION entre dos registros del sistema, no un nombre escrito a mano.
 */
@Component({
  selector: 'app-asistente-de-mercado',
  standalone: true,
  imports: [OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, BotonNativoDirective, SelectorMultipleComponent, CommonModule, FormsModule, IndicadorDePasosComponent, AvisoDeCorreoSinConfirmarComponent,
    ErrorDeCampoComponent, ConfirmacionComponent, FechaPipe, SelectorDeSedeComponent],
  templateUrl: './asistente-de-mercado.component.html',
})
export class AsistenteDeMercadoComponent implements OnInit, OnDestroy, ConCambiosSinGuardar {
  constructor() {
    // LA ORGANIZACION ES LA DE LA URL: cambiarla reconstruye el panel y este asistente con
    // él. Se sigue escuchando por si la sesión la retira mientras la pantalla está abierta.
    effect(() => {
      this.store.organizacionId();
      untracked(() => this.cargarLosFestivales());
    });
  }

  private readonly api = inject(PanelOrganizacionApi);
  private readonly store = inject(PanelOrganizacionStore);

  /** Los comandos de una dirección del panel de ESTA organización, la de la URL. */
  enPanel(...segmentos: (string | number)[]): string[] {
    return rutaDelPanel(this.store.organizacionId(), ...segmentos);
  }
  private readonly router = inject(Router);
  private readonly borradores = inject(BorradoresDeProcesoApi);
  protected readonly confirmacion = inject(ConfirmacionDeCorreoService);

  private borradorId: string | null = null;
  /** Se está saliendo a propósito (guardó, o descartó): ya no hay nada que avisar. */
  private saliendoSinAviso = false;

  /**
   * EL MERCADO AUTOGUARDA COMO EL FESTIVAL. Antes escribir el nombre, ir a otra
   * sección y volver dejaba el formulario vacío y sin aviso. El borrador es privado, de esta
   * persona y de esta organización, y el bucle es el mismo que usa el Festival.
   */
  private readonly autoguardado = new AutoguardadoDeBorrador<Record<string, unknown>>({
    leer: async () => null,
    guardar: async (datos, version) => {
      if (!this.borradorId) return null;
      const respuesta = await this.borradores.guardar(this.borradorId, datos, version);
      return respuesta ? { version: respuesta.version, fechaActualizacion: new Date().toISOString() } : null;
    },
    descartar: async () => undefined,
  });

  /** Lo que la pantalla dice del guardado: nada hasta el primer cambio, y después la hora. */
  readonly estadoGuardado = this.autoguardado.estado;
  readonly ultimoGuardado = this.autoguardado.ultimoGuardado;
  /** Se recuperó lo escrito en una visita anterior: se dice una vez, arriba. */
  readonly borradorRecuperado = signal(false);
  readonly confirmandoSalida = signal(false);

  readonly faltaConfirmarCorreo = this.confirmacion.falta.bind(this.confirmacion);

  readonly pasos = PASOS_DEL_MERCADO;
  readonly periodicidades = PERIODICIDADES;
  readonly pideDetalle = pideDetalle;

  readonly pasoActivo = signal(1);
  /** Qué pasos se visitaron y cómo quedaron: «completo» o «incompleto», no «visitado = bien». */
  readonly estadoDeLosPasos = signal<EstadosDeLosPasos>({});
  private readonly visitados = new Set<number>([1]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly errores = signal<Record<string, string>>({});

  readonly catalogos = signal<CatalogosDeMercadoExternos>({ alcances: [], modalidades: [], practicasMusicales: [], territoriosSonoros: [] });
  readonly ubicaciones = signal<UbicacionDivipola[]>([]);
  readonly festivales = signal<FestivalElegibleParaMercado[]>([]);

  /**
   * En qué punto está la consulta de los festivales de la organización.
   *
   * <b>SIN ESTO, TRES SITUACIONES DISTINTAS SE VEIAN IGUAL.</b> «Todavía no has registrado ningún
   * festival» se enseñaba también cuando la consulta había fallado y cuando aún no había terminado,
   * porque el error se convertía en una lista vacía. se detectó el 15 de
   * septiembre de 2026 sobre una organización que SI tenía festivales registrados: la pantalla le
   * afirmaba lo contrario. Una lista vacía por un fallo no es una respuesta, y decirlo como si lo
   * fuera manda a registrar de nuevo algo que ya existe.
   */
  readonly consultaDeFestivales = signal<'sin_preguntar' | 'preguntando' | 'respondida' | 'fallida'>('sin_preguntar');

  readonly nombreOrganizacion = computed(() => this.store.organizacionElegida()?.name ?? '');

  readonly formulario: FormularioDelMercado = {
    nombre: '', descripcion: '', alcanceId: null, modalidadId: null,
    periodicidad: '', periodicidadDetalle: '', nivelCobertura: 'municipal',
    codigoDepartamento: '', codigoMunicipio: '', sedeCodigoDepartamento: '', sedeCodigoMunicipio: '', lugarEspecifico: '',
    correoMercado: '', telefonoMercado: '', sitioWebMercado: '',
    instagramMercado: '', facebookMercado: '', otroEnlaceMercado: '', observacionesContacto: '',
    seRealizaEnElMarcoDeUnFestival: false, festivalId: null,
    practicasMusicalesIds: [], territoriosSonorosIds: [],
  };

  /** Si hay algo escrito en el formulario. */
  private hayAlgoEscrito(): boolean {
    const f = this.formulario;
    const textos = [f.nombre, f.descripcion, f.periodicidad, f.codigoDepartamento, f.lugarEspecifico, f.correoMercado,
      f.telefonoMercado, f.sitioWebMercado, f.instagramMercado, f.facebookMercado, f.otroEnlaceMercado, f.observacionesContacto];
    return textos.some(texto => (texto ?? '').trim() !== '')
      || f.alcanceId !== null || f.modalidadId !== null || f.festivalId !== null
      || f.practicasMusicalesIds.length > 0 || f.territoriosSonorosIds.length > 0;
  }

  /** Lo escrito está respaldado en el servidor (o lo estará en cuanto pase la quietud). */
  private estaRespaldado(): boolean {
    return this.borradorId !== null && this.autoguardado.estado() !== 'fallido';
  }

  /**
   * Lo que se dice al cambiar de organización con el Mercado a medias. Con el borrador
   * activo, lo escrito se queda como borrador de ESTA organización; sin él, se pierde. En ningún
   * caso pasa a la otra.
   */
  avisoAlCambiarDeOrganizacion(actual: string, nueva: string): string | null {
    if (this.guardando() || !this.hayAlgoEscrito()) return null;
    if (!this.estaRespaldado()) return `Lo que escribiste del Mercado no está guardado y se perderá. No pasará a «${nueva}».`;
    return `Tu Mercado a medias se guarda como borrador de «${actual}» y no pasará a «${nueva}». Lo recuperas al volver a «Registrar mercado» en «${actual}».`;
  }

  async antesDeCambiarDeOrganizacion(): Promise<void> {
    if (this.borradorId) await this.autoguardado.guardarYa();
  }

  /**
   * AVISO DE CAMBIOS SIN GUARDAR. Con el borrador en marcha salir no pierde nada y no
   * se pregunta; solo se avisa cuando lo escrito NO está respaldado (el borrador no se pudo abrir o
   * el último guardado falló), que es cuando de verdad se perdería.
   */
  avisoAlSalir(): string | null {
    if (this.saliendoSinAviso || this.guardando() || !this.hayAlgoEscrito() || this.estaRespaldado()) return null;
    return 'Lo que escribiste del Mercado no se pudo guardar como borrador y se perderá si sales ahora.';
  }

  /** Cerrar la pestaña con lo escrito sin respaldar: el navegador pregunta. */
  @HostListener('window:beforeunload', ['$event'])
  avisarAlCerrarLaPestana(evento: BeforeUnloadEvent): void {
    if (this.avisoAlSalir()) evento.preventDefault();
  }

  ngOnDestroy(): void {
    // Lo que esperaba la quietud se manda antes de irse: salir a media escritura no lo pierde.
    if (this.borradorId) void this.autoguardado.guardarYa().finally(() => this.autoguardado.apagar());
    else this.autoguardado.apagar();
  }

  ngOnInit(): void {
    const organizacionId = this.store.organizacionId();
    if (!organizacionId) {
      this.cargando.set(false);
      return;
    }

    forkJoin({
      catalogos: this.api.obtenerCatalogosDeMercado().pipe(catchError(() => of({ alcances: [], modalidades: [], practicasMusicales: [], territoriosSonoros: [] }))),
      ubicaciones: this.api.obtenerUbicaciones().pipe(catchError(() => of([] as UbicacionDivipola[]))),
    }).subscribe(({ catalogos, ubicaciones }) => {
      this.catalogos.set(catalogos ?? { alcances: [], modalidades: [], practicasMusicales: [], territoriosSonoros: [] });
      this.ubicaciones.set(ubicaciones ?? []);
      this.cargando.set(false);
      this.recuperarBorrador(organizacionId);
    });

    this.cargarLosFestivales();
  }

  /**
   * Abre el borrador privado de la organización y rellena el formulario con lo que hubiera. Si no se
   * puede abrir, el asistente sigue sin autoguardado y el aviso de salida lo dice.
   */
  private recuperarBorrador(organizacionId: string): void {
    this.borradores.obtener('mercados', organizacionId).subscribe({
      next: borrador => {
        this.borradorId = borrador.id;
        let recuperado = false;
        try {
          const datos = JSON.parse(borrador.datosJson || '{}') as Record<string, unknown>;
          recuperado = this.aplicarDatos(datos);
        } catch {
          // UN BORRADOR ILEGIBLE NO SE APLICA: se empieza en blanco.
        }
        // EL ESTADO ARRANCA «INACTIVO» SI NO HABÍA NADA: «Borrador guardado» sin datos es engañoso.
        this.autoguardado.encender(borrador.version, recuperado);
        this.borradorRecuperado.set(recuperado);
      },
      error: () => this.autoguardado.apagar(),
    });
  }

  private aplicarDatos(datos: Record<string, unknown>): boolean {
    const f = this.formulario;
    const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '');
    f.nombre = texto(datos['nombre']); f.descripcion = texto(datos['descripcion']);
    f.periodicidad = texto(datos['periodicidad']); f.periodicidadDetalle = texto(datos['periodicidadDetalle']);
    f.nivelCobertura = texto(datos['nivelCobertura']) || 'municipal';
    f.codigoDepartamento = texto(datos['codigoDepartamento']); f.codigoMunicipio = texto(datos['codigoMunicipio']);
    f.sedeCodigoDepartamento = texto(datos['sedeCodigoDepartamento']); f.sedeCodigoMunicipio = texto(datos['sedeCodigoMunicipio']);
    f.lugarEspecifico = texto(datos['lugarEspecifico']); f.correoMercado = texto(datos['correoMercado']);
    f.telefonoMercado = texto(datos['telefonoMercado']); f.sitioWebMercado = texto(datos['sitioWebMercado']);
    f.instagramMercado = texto(datos['instagramMercado']); f.facebookMercado = texto(datos['facebookMercado']);
    f.otroEnlaceMercado = texto(datos['otroEnlaceMercado']); f.observacionesContacto = texto(datos['observacionesContacto']);
    const numero = (valor: unknown) => (typeof valor === 'number' && Number.isInteger(valor) && valor > 0 ? valor : null);
    f.alcanceId = numero(datos['alcanceId']); f.modalidadId = numero(datos['modalidadId']); f.festivalId = numero(datos['festivalId']);
    f.seRealizaEnElMarcoDeUnFestival = datos['seRealizaEnElMarcoDeUnFestival'] === true && f.festivalId !== null;
    const ids = (valor: unknown) => (Array.isArray(valor) ? valor.filter((id): id is number => Number.isInteger(id) && id > 0) : []);
    f.practicasMusicalesIds = ids(datos['practicasMusicalesIds']);
    f.territoriosSonorosIds = ids(datos['territoriosSonorosIds']);
    return this.hayAlgoEscrito();
  }

  /** Cada cambio del formulario pasa por aquí: el bucle espera la quietud y manda el borrador. */
  alCambiarAlgo(): void {
    this.autoguardado.anotar({ ...this.formulario, practicasMusicalesIds: [...this.formulario.practicasMusicalesIds], territoriosSonorosIds: [...this.formulario.territoriosSonorosIds] });
    this.actualizarEstados();
  }

  /**
   * Pide los festivales de la organización elegida.
   *
   * <b>SE PIDEN AL ABRIR Y NO AL LLEGAR AL PASO 3:</b> el paso tiene que poder responder en cuanto
   * se abre, no después de una espera. <b>Y SE VUELVEN A PEDIR SI CAMBIA LA ORGANIZACION</b>, porque
   * los candidatos de una no son los de otra: leer el identificador una sola vez dejaba la lista de
   * la primera organización pegada al formulario de la segunda.
   */
  cargarLosFestivales(): void {
    const organizacionId = this.store.organizacionId();
    if (!organizacionId) {
      this.consultaDeFestivales.set('sin_preguntar');
      return;
    }

    this.consultaDeFestivales.set('preguntando');
    this.api.obtenerFestivalesElegibles(organizacionId).subscribe({
      next: festivales => {
        this.festivales.set(festivales ?? []);
        this.consultaDeFestivales.set('respondida');
      },
      // EL FALLO SE DICE, NO SE CONVIERTE EN UNA LISTA VACIA. Es la diferencia entre «no tienes
      // ninguno» —que es una afirmación sobre tus datos— y «no pudimos preguntarlo».
      error: () => {
        this.festivales.set([]);
        this.consultaDeFestivales.set('fallida');
      },
    });
  }

  departamentos(): { codigo: string; nombre: string }[] {
    const unicos = new Map(this.ubicaciones().map(fila => [fila.departmentCode, fila.departmentName]));
    return Array.from(unicos, ([codigo, nombre]) => ({ codigo, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  municipios(): UbicacionDivipola[] {
    if (!this.formulario.codigoDepartamento) return [];
    return this.ubicaciones().filter(fila => fila.departmentCode === this.formulario.codigoDepartamento);
  }

  irAlPaso(id: number): void {
    if (!this.pasos.some(paso => paso.id === id)) return;
    this.pasoActivo.set(id);
    this.visitados.add(id);
    this.actualizarEstados();
  }

  siguiente(): void { this.irAlPaso(Math.min(this.pasoActivo() + 1, this.pasos.length)); }
  anterior(): void { this.irAlPaso(Math.max(this.pasoActivo() - 1, 1)); }

  /**
   * LA REGLA DE CADA CAMPO, en un solo sitio: la usan la salida del campo, el indicador de pasos, la
   * revisión («Falta: …») y el guardado. Devuelve el mensaje o `null`.
   */
  mensajeDelCampo(campo: string): string | null {
    const f = this.formulario;
    switch (campo) {
      case 'nombre': return f.nombre.trim() ? null : 'Escribe el nombre del mercado.';
      case 'codigoDepartamento': return f.nivelCobertura !== 'nacional' && !f.codigoDepartamento ? 'Elige el departamento que corresponde al nivel de cobertura.' : null;
      case 'codigoMunicipio': return f.nivelCobertura === 'municipal' && !f.codigoMunicipio ? 'Elige el municipio.' : null;
      // LA SEDE PRINCIPAL (decisión 119): la elegida o, con cobertura municipal, el municipio de la cobertura.
      case 'sedeCodigoDepartamento': return this.sedeEfectiva().sedeCodigoDepartamento ? null : 'Elige el departamento de la sede principal.';
      case 'sedeCodigoMunicipio': return this.sedeEfectiva().sedeCodigoDepartamento && !this.sedeEfectiva().sedeCodigoMunicipio ? 'Elige el municipio de la sede principal.' : null;
      case 'correoMercado': return !f.correoMercado.trim() || esCorreoValido(f.correoMercado) ? null : MENSAJE_DE_CORREO;
      case 'telefonoMercado': return mensajeDeTelefono(f.telefonoMercado);
      case 'sitioWebMercado': return mensajeDeUrl(f.sitioWebMercado);
      case 'instagramMercado': return mensajeDeRedSocial(f.instagramMercado);
      case 'festivalId': return f.seRealizaEnElMarcoDeUnFestival && !f.festivalId ? 'Elige el festival en cuyo marco se realiza, o responde que no.' : null;
      default: return null;
    }
  }

  /** En qué paso vive cada campo, el rótulo con que se nombra en «Falta: …» y el `id` al que se enfoca. */
  private readonly DEL_CAMPO: Readonly<Record<string, { paso: number; rotulo: string; id: string }>> = {
    nombre: { paso: 1, rotulo: 'Nombre del mercado', id: 'mercado-nombre' },
    codigoDepartamento: { paso: 2, rotulo: 'Departamento', id: 'mercado-departamento' },
    codigoMunicipio: { paso: 2, rotulo: 'Municipio', id: 'mercado-municipio' },
    sedeCodigoDepartamento: { paso: 2, rotulo: 'Departamento de la sede', id: 'mercado-sede-departamento' },
    sedeCodigoMunicipio: { paso: 2, rotulo: 'Municipio de la sede', id: 'mercado-sede-municipio' },
    correoMercado: { paso: 2, rotulo: 'Correo de contacto', id: 'mercado-correo' },
    telefonoMercado: { paso: 2, rotulo: 'Teléfono', id: 'mercado-telefono' },
    sitioWebMercado: { paso: 2, rotulo: 'Página web', id: 'mercado-web' },
    instagramMercado: { paso: 2, rotulo: 'Instagram', id: 'mercado-instagram' },
    festivalId: { paso: 3, rotulo: 'Festival', id: 'mercado-festival' },
  };

  /** Todo lo que está mal ahora mismo, en el orden de los pasos: alimenta «Falta: …» en la revisión. */
  faltantes(): { campo: string; paso: number; rotulo: string; mensaje: string }[] {
    return Object.entries(this.DEL_CAMPO)
      .sort(([, a], [, b]) => a.paso - b.paso)
      .map(([campo, datos]) => ({ campo, paso: datos.paso, rotulo: datos.rotulo, mensaje: this.mensajeDelCampo(campo) }))
      .filter((falta): falta is { campo: string; paso: number; rotulo: string; mensaje: string } => falta.mensaje !== null);
  }

  /** «Falta: Nombre» en la revisión lleva al paso y al campo. */
  irAlCampo(campo: string): void {
    const datos = this.DEL_CAMPO[campo];
    if (!datos) return;
    this.irAlPaso(datos.paso);
    const mensaje = this.mensajeDelCampo(campo);
    if (mensaje) this.errores.update(actual => ({ ...actual, [campo]: mensaje }));
    enfocarCampo(datos.id);
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

  /**
   * «VISITADO» NO ES «COMPLETO». Solo el paso que se visitó y no tiene nada pendiente se
   * pinta completo; el que se visitó con algo pendiente se pinta incompleto, con su aviso, y el que
   * no se ha visitado queda pendiente. Antes se pintaban «completos» todos los pasos anteriores al
   * activo, aunque se hubiera pasado por ellos sin escribir nada.
   */
  private actualizarEstados(): void {
    const faltas = this.faltantes();
    const estados: Record<number, 'completo' | 'incompleto'> = {};
    for (const paso of this.visitados) {
      if (paso === this.pasoActivo()) continue;
      if (paso === this.pasos.length) continue; // la revisión no pregunta nada
      estados[paso] = faltas.some(falta => falta.paso === paso) ? 'incompleto' : 'completo';
    }
    this.estadoDeLosPasos.set(estados);
  }

  /**
   * Cambiar el nivel de cobertura suelta lo que deja de tener sentido.
   *
   * Sin esto, elegir un municipio y pasar después a cobertura nacional deja el código del municipio
   * en el formulario aunque su campo haya desaparecido, y el servidor rechaza el guardado señalando
   * un campo que ya no está en pantalla.
   */
  cambiarCobertura(nivel: string): void {
    this.formulario.nivelCobertura = nivel;
    if (nivel === 'nacional') { this.formulario.codigoDepartamento = ''; this.formulario.codigoMunicipio = ''; }
    if (nivel === 'departamental') this.formulario.codigoMunicipio = '';
    this.alCambiarAlgo();
  }

  /** La sede que se guarda: la elegida o, si no hay, la del territorio de una cobertura municipal. */
  sedeEfectiva() {
    const f = this.formulario;
    return sedeParaEnviar(f, f.nivelCobertura, f.codigoDepartamento, f.codigoMunicipio);
  }

  /** La sede principal, aparte de la cobertura: la elige el selector común. */
  elegirSede(sede: SedeElegida): void {
    this.formulario.sedeCodigoDepartamento = sede.departamento;
    this.formulario.sedeCodigoMunicipio = sede.municipio;
    this.alCambiarAlgo();
  }

  cambiarDepartamento(codigo: string): void {
    this.formulario.codigoDepartamento = codigo;
    this.formulario.codigoMunicipio = '';
    this.alCambiarAlgo();
  }

  /** Responder que no borra el festival elegido: una relación que la ficha no enseña no debe existir. */
  cambiarSiEstaEnUnFestival(dentro: boolean): void {
    this.formulario.seRealizaEnElMarcoDeUnFestival = dentro;
    if (!dentro) this.formulario.festivalId = null;
    this.alCambiarAlgo();
  }

  etiquetaDeEstado(estado: string): string {
    const etiquetas: Record<string, string> = {
      borrador: 'en borrador', en_revision: 'en revisión',
      ajustes_solicitados: 'con ajustes solicitados', publicado: 'publicado', archivado: 'archivado',
      rechazado: 'rechazado',
    };
    return etiquetas[(estado ?? '').toLowerCase()] ?? rotuloDeEstado(estado).toLowerCase();
  }

  /**
   * Lo mínimo para que el borrador tenga sentido.
   *
   * <b>ES MENOS DE LO QUE PIDE LA REVISION, Y ESA ES LA IDEA.</b> Un borrador se guarda con lo que
   * haya; lo que se entrega al PNMC tiene que poder revisarse, y eso lo exige el servidor al
   * enviar. Pedirlo todo aquí convertiría el primer guardado en un muro.
   */
  validar(): boolean {
    const encontrados: Record<string, string> = {};
    for (const campo of Object.keys(this.DEL_CAMPO)) {
      const mensaje = this.mensajeDelCampo(campo);
      if (mensaje) encontrados[campo] = mensaje;
    }
    this.errores.set(encontrados);
    this.actualizarEstados();
    return Object.keys(encontrados).length === 0;
  }

  guardar(): void {
    const organizacionId = this.store.organizacionId();
    if (!organizacionId) return;
    if (!this.validar()) {
      // SE VUELVE AL PASO QUE TIENE EL FALLO Y SE ENFOCA EL CAMPO: un error anunciado en el paso 4
      // sobre un campo del paso 2 obliga a buscarlo a mano.
      const primero = this.faltantes()[0];
      if (primero) this.irAlCampo(primero.campo);
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    this.api.crearMercado(organizacionId, this.aSolicitud(+organizacionId)).subscribe({
      next: mercado => {
        this.guardando.set(false);
        // El borrador se cerró en el servidor al crear el mercado: ya no hay nada que respaldar.
        this.saliendoSinAviso = true;
        this.borradorId = null;
        this.autoguardado.apagar();
        void this.router.navigate(this.enPanel('procesos/mercados', mercado.id));
      },
      error: (fallo: FalloDelServidor) => {
        this.guardando.set(false);
        // EL MOTIVO DEL SERVIDOR VUELVE A SU CAMPO, con el nombre que ve la persona.
        const traducido = traducirErrorDelServidor(fallo, {
          camposConLugar: Object.keys(this.DEL_CAMPO),
          alternativa: 'No fue posible registrar el mercado.',
        });
        this.error.set(traducido.general);
        if (traducido.hayCampos) {
          this.errores.update(actual => ({ ...actual, ...traducido.campos }));
          this.irAlCampo(Object.keys(traducido.campos)[0]);
        }
      },
    });
  }

  /** «Guardar y registrar el Festival»: el borrador se manda ya y se abre el alta del Festival. */
  async registrarFestivalPrimero(): Promise<void> {
    if (this.borradorId) await this.autoguardado.guardarYa();
    void this.router.navigate(this.enPanel('procesos/festivales/nuevo'));
  }

  /** «Cancelar»: con algo escrito pregunta; sin nada sale. Lo escrito queda como borrador salvo que se descarte. */
  cancelar(): void {
    if (!this.hayAlgoEscrito()) { void this.router.navigate(this.enPanel('procesos/mercados')); return; }
    this.confirmandoSalida.set(true);
  }

  salirConservando(): void {
    this.saliendoSinAviso = true;
    this.confirmandoSalida.set(false);
    void this.router.navigate(this.enPanel('procesos/mercados'));
  }

  descartarYSalir(): void {
    this.saliendoSinAviso = true;
    this.confirmandoSalida.set(false);
    const id = this.borradorId;
    this.borradorId = null;
    this.autoguardado.apagar();
    const salir = () => void this.router.navigate(this.enPanel('procesos/mercados'));
    if (id) this.borradores.descartar(id).subscribe({ next: salir, error: salir }); else salir();
  }

  /** Marca o desmarca un valor de catálogo. La lista la mantiene el formulario, no el control. */
  alternarDeCatalogo(clave: 'practicasMusicalesIds' | 'territoriosSonorosIds', id: number): void {
    const lista = this.formulario[clave];
    const donde = lista.indexOf(id);
    if (donde >= 0) { lista.splice(donde, 1); } else { lista.push(id); }
    this.alCambiarAlgo();
  }

  private aSolicitud(organizacionId: number): GuardarMercadoSolicitud {
    return {
      nombre: this.formulario.nombre.trim(),
      descripcion: vacioANulo(this.formulario.descripcion),
      alcanceId: this.formulario.alcanceId,
      modalidadId: this.formulario.modalidadId,
      periodicidad: vacioANulo(this.formulario.periodicidad),
      periodicidadDetalle: vacioANulo(this.formulario.periodicidadDetalle),
      correoMercado: vacioANulo(this.formulario.correoMercado),
      telefonoMercado: vacioANulo(this.formulario.telefonoMercado),
      sitioWebMercado: vacioANulo(normalizarUrl(this.formulario.sitioWebMercado)),
      instagramMercado: vacioANulo(normalizarRedSocial(this.formulario.instagramMercado)),
      facebookMercado: vacioANulo(normalizarRedSocial(this.formulario.facebookMercado)),
      otroEnlaceMercado: vacioANulo(normalizarUrl(this.formulario.otroEnlaceMercado)),
      observacionesContacto: vacioANulo(this.formulario.observacionesContacto),
      nivelCobertura: this.formulario.nivelCobertura,
      codigoDepartamento: vacioANulo(this.formulario.codigoDepartamento),
      codigoMunicipio: vacioANulo(this.formulario.codigoMunicipio),
      ...this.sedeEfectiva(),
      lugarEspecifico: vacioANulo(this.formulario.lugarEspecifico),
      seRealizaEnElMarcoDeUnFestival: this.formulario.seRealizaEnElMarcoDeUnFestival,
      festivalId: this.formulario.seRealizaEnElMarcoDeUnFestival ? this.formulario.festivalId : null,
      organizacionId,
      borradorProcesoId: this.borradorId,
      practicasMusicalesIds: [...this.formulario.practicasMusicalesIds],
      territoriosSonorosIds: [...this.formulario.territoriosSonorosIds],
    };
  }
}
