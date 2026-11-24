import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowRight, LucideBuilding2, LucideCheck, LucideCircle, LucideChevronDown, LucideExternalLink, LucideUserCircle2 } from '@lucide/angular';
import { AdminService } from '../../core/services/admin.service';
import { ApiClientService } from '../../core/http/api-client.service';
import { RecuperacionDeContrasenaService } from '../../core/services/recuperacion-de-contrasena.service';
import { CLAVE_INVITACION_PENDIENTE, InvitacionAbierta } from '../ecosistema/pages/aceptar-invitacion-page/aceptar-invitacion-page.component';
import { TextosWebService } from '../../core/services/textos-web.service';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { EstadosDeLosPasos, IndicadorDePasosComponent, PasoDelIndicador } from '../../shared/components/ui/indicador-de-pasos/indicador-de-pasos.component';
import { ErrorDeCampoComponent } from '../../shared/components/ui/error-de-campo/error-de-campo.component';
import { TIPOS_DE_DOCUMENTO } from '../../core/formularios/tipos-de-documento';
import { esCorreoValido, MENSAJE_DE_CORREO, mensajeDeTelefono } from '../../core/formularios/telefono';
import { enfocarCampo } from '../../core/formularios/foco';
import { mensajeDeClave, reglasDeClave, ReglaDeClave } from '../../core/formularios/politica-de-clave';
import { EsqueletoComponent } from '../../shared/components/ui/esqueleto/esqueleto.component';
import { traducirErrorDelServidor } from '../../core/formularios/traductor-de-errores';
import { PoliticaParaRegistro } from '../../core/services/politicas-de-datos';
import { RUTA_DE_ENTRADA, destinoSeguroTrasEntrar } from '../../core/navegacion/rutas-de-gestion';
import { firstValueFrom } from 'rxjs';

import { BotonComponent, BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import { FiltroDesplegableComponent } from '../../shared/components/ui/filtro-desplegable/filtro-desplegable.component';
import { CambiosDeClasificacion } from '../../core/services/directorio-de-personas.service';
import { CATEGORIAS_VACIAS, SelectorDeCategoriasComponent } from '../../shared/components/ui/selector-de-categorias/selector-de-categorias.component';
import { OpcionesDesdePipe } from '../../shared/components/ui/filtro-desplegable/opciones-desde.pipe';
type VistaDeAcceso = 'registro' | 'ingreso';
/**
 * Frontera pública de las organizaciones.
 *
 * Aquí solo viven el registro de una organización y el ingreso de una cuenta existente. Festival,
 * ediciones, selección de organización y propuestas pertenecen a Gestión, donde tienen sesión,
 * permisos y rutas propias. Mantenerlos aquí duplicaba un circuito ya reemplazado.
 */
import { CampoDeNitComponent } from '../../shared/components/ui/campo-de-nit/campo-de-nit.component';
import { NIT_DE_EJEMPLO, mensajeDeNit } from '../../core/formularios/nit';

@Component({
  selector: 'app-external-access-page',
  standalone: true,
  imports: [SelectorDeCategoriasComponent, OpcionesDesdePipe, FiltroDesplegableComponent, CampoDeSeleccionComponent, BotonNativoDirective, BotonComponent, CommonModule, FormsModule, IndicadorDePasosComponent, ErrorDeCampoComponent, CampoDeNitComponent, EsqueletoComponent, LucideArrowRight, LucideCheck, LucideCircle, LucideBuilding2, LucideChevronDown, LucideExternalLink, LucideUserCircle2],
  templateUrl: './external-access-page.component.html',
  // La pista de fondo se distingue de lo escrito: más clara (5:1 sobre blanco, AA) que el texto
  // (#0f172a), sin cursiva y con opacidad plena para que no dependa del navegador.
  styles: [`
    .simus-campo::placeholder { color: var(--color-rotulo); opacity: 1; font-style: normal; }
    .simus-campo:disabled::placeholder { color: var(--color-rotulo); }
  `],
})
export class ExternalAccessPageComponent implements OnInit, OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly webTexts = inject(TextosWebService);
  private readonly sesionExterna = inject(ExternalSessionService);
  private readonly recuperacionDeContrasena = inject(RecuperacionDeContrasenaService);
  private readonly api = inject(ApiClientService);

  /** El ejemplo de fondo del NIT, desde la regla única del NIT. */
  protected readonly nitDeEjemplo = NIT_DE_EJEMPLO;
  readonly vista = signal<VistaDeAcceso>('registro');
  /**
   * Primer paso del registro: qué camino se toma. Hay dos —como agente o actor de la música (perfil
   * individual) y como organización— y en ambos se termina con un usuario. `null` es «aún no elige».
   */
  /**
   * «¿Olvidaste tu contraseña?»: el formulario que pide el correo, y después el aviso
   * neutro de «revisa tu correo», que es el mismo exista o no la cuenta.
   */
  readonly recuperacion = signal<'cerrada' | 'formulario' | 'enviado'>('cerrada');
  readonly enviandoRecuperacion = signal(false);
  readonly errorDeRecuperacion = signal('');
  /** Lo que contestó el servidor; no dice si la cuenta existe. */
  readonly avisoDeRecuperacion = signal('');
  correoDeRecuperacion = '';
  /** La invitación con la que se llegó a registrarse: la cuenta se crea para aceptarla. */
  readonly invitacion = signal<InvitacionAbierta | null>(null);
  readonly tipoDeRegistro = signal<'individual' | 'organizacion' | null>(null);
  /** Alias de compatibilidad para las pruebas de la frontera pública. */
  readonly view = computed(() => this.vista() === 'registro' ? 'register' : 'login');
  readonly loading = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly erroresAlta = signal<Record<string, string>>({});
  readonly erroresIngreso = signal<Record<string, string>>({});
  readonly locations = signal<any[]>([]);
  /**
   * Los textos que hay que aceptar, servidos por el servidor.
   *
   * <b>NUNCA SE ESCRIBEN AQUI.</b> La plantilla los muestra tal como llegan porque son exactamente
   * los que el servidor copiará dentro de cada autorización como prueba (Ley 1581 art. 17 lit. f).
   * Antes esta pantalla componía su propia frase —«Acepto los {título} {versión}»— y lo único que
   * viajaba era un enlace a un PDF del Ministerio: la evidencia de lo aceptado vivía en un servidor
   * ajeno que puede cambiar el documento sin dejar rastro aquí.
   */
  readonly politicasDelRegistro = signal<readonly PoliticaParaRegistro[]>([]);

  /** Qué ha marcado la persona, por clave de finalidad. */
  readonly politicasAceptadas = signal<Record<string, boolean>>({});

  /** Cuál está desplegada para leerse entera. Solo una a la vez: son textos largos. */
  readonly politicaDesplegada = signal<string>('');
  readonly registroDisponible = signal(true);
  /** Mientras llegan las políticas y la división político-administrativa, el registro dibuja su forma (esqueleto). */
  readonly preparando = signal(true);
  private pendientesDePreparacion = 2;
  readonly pasoDeRegistro = signal(1);
  /** Las categorías opcionales de la cuenta personal (DIR): se piden en el registro y se completan después. */
  readonly categorias = signal<CambiosDeClasificacion>(CATEGORIAS_VACIAS);
  readonly hayCategoriasElegidas = computed(() => Object.values(this.categorias()).some(lista => lista.length > 0));
  readonly departamentosParaCategorias = computed(() => this.departments().map(d => ({ codigo: d.code, nombre: d.name })));
  readonly mostrarContrasena = signal(false);

  /** Los tipos de documento: la misma lista que «Cuenta y seguridad» y que acepta el servidor. */
  readonly tiposDeDocumento = TIPOS_DE_DOCUMENTO;

  readonly pasosDeRegistro: readonly PasoDelIndicador[] = [
    { id: 1, titulo: 'Datos personales' },
    { id: 2, titulo: 'Organización y territorio' },
    { id: 3, titulo: 'Consentimientos' },
  ];

  /**
   * La cuenta individual no tiene paso de organización: va de los datos personales a los
   * consentimientos. SE NUMERA «1 → 2»: el indicador decía «1 → 3» y parecía que
   * faltaba un paso. El `id` interno sigue siendo 3 para que las dos rutas compartan el paso.
   */
  readonly pasosDelCamino = computed<readonly PasoDelIndicador[]>(() => this.tipoDeRegistro() === 'individual'
    ? [this.pasosDeRegistro[0], { ...this.pasosDeRegistro[2], numero: 2 }]
    : this.pasosDeRegistro);

  /**
   * Qué pasos están bien y cuáles se visitaron con algo pendiente. «Siguiente» ya no marca como
   * completado un paso vacío: solo cuenta el que pasó la validación.
   */
  readonly estadoDeLosPasos = signal<Record<number, 'completo' | 'incompleto'>>({});
  readonly estadosParaElIndicador = computed<EstadosDeLosPasos>(() => this.estadoDeLosPasos());

  /** Los campos de cada paso, en el orden en que aparecen: el primero con error recibe el foco. */
  private readonly camposDelPaso: Readonly<Record<number, readonly string[]>> = {
    1: ['firstName', 'firstSurname', 'documentType', 'documentNumber', 'phone', 'email', 'password', 'confirmPassword'],
    2: ['organizationName', 'organizationIdentificationNumber', 'headquartersDepartmentCode', 'headquartersMunicipalityCode'],
    3: ['politicasAceptadas'],
  };

  readonly departments = computed(() => Array.from(new Map(this.locations().map(item => [item.departmentCode, item.departmentName])).entries())
    .map(([code, name]) => ({ code, name })));

  alta = {
    organizationName: '', organizationIdentificationNumber: '',
    headquartersDepartmentCode: '', headquartersMunicipalityCode: '',
    firstName: '', secondName: '', firstSurname: '', secondSurname: '',
    documentType: '', documentNumber: '', phone: '', email: '', password: '', confirmPassword: '',
  };
  login = { email: '', password: '' };

  texto(clave: string): string { return this.webTexts.getWebText(clave); }
  imagen(clave: string): string { return this.webTexts.getWebImage(clave); }
  imagenAlt(clave: string): string { return this.webTexts.getWebImageAlt(clave); }

  ngOnInit(): void {
    const modo = this.route.snapshot.data['modoAcceso'] as string | undefined;
    this.vista.set(modo === 'ingresar' ? 'ingreso' : 'registro');
    this.cargarPreparacionDelRegistro();
    if (this.vista() === 'ingreso' && this.route.snapshot.queryParamMap.get('recuperar') === '1') this.abrirRecuperacion();
    if (this.vista() === 'registro') void this.recordarLaInvitacion();
    this.sesionExterna.refrescar().subscribe(sesion => {
      if (sesion) void this.router.navigateByUrl(this.destinoTrasEntrar('/gestion'));
    });
  }

  ngOnDestroy(): void {
    for (const temporizador of this.pausas.values()) clearTimeout(temporizador);
    this.pausas.clear();
  }

  municipiosDelAlta(): any[] {
    return this.locations().filter(item => item.departmentCode === this.alta.headquartersDepartmentCode);
  }

  /** Si esa finalidad está marcada. */
  aceptada(clave: string): boolean {
    return this.politicasAceptadas()[clave] === true;
  }

  alternarPolitica(clave: string): void {
    this.politicasAceptadas.update(puestas => ({ ...puestas, [clave]: !puestas[clave] }));
  }

  /** Despliega o pliega el texto completo de una política. */
  alternarTextoDePolitica(clave: string): void {
    this.politicaDesplegada.update(puesta => (puesta === clave ? '' : clave));
  }

  /** El paso al que se llega con el indicador: volver es libre; avanzar exige que lo anterior esté bien. */
  irAlPasoDeRegistro(paso: number): void {
    const pedido = Math.max(1, Math.min(3, paso));
    const destino = this.saltarOrganizacion(pedido, pedido < this.pasoDeRegistro() ? 1 : 3);
    if (destino > this.pasoDeRegistro()) {
      for (let actual = this.pasoDeRegistro(); actual < destino; actual = this.saltarOrganizacion(actual + 1, 3)) {
        if (!this.validarPaso(actual)) return;
      }
    }
    this.pasoDeRegistro.set(destino);
    this.llevarAlInicioDelPaso();
  }

  /** «Siguiente» valida ESTE paso: si falta algo, se queda, lo dice junto a cada campo y enfoca el primero. */
  pasoSiguienteRegistro(): void {
    if (!this.validarPaso(this.pasoDeRegistro())) return;
    this.pasoDeRegistro.update(paso => this.saltarOrganizacion(Math.min(3, paso + 1), 3));
    this.llevarAlInicioDelPaso();
  }
  pasoAnteriorRegistro(): void { this.pasoDeRegistro.update(paso => this.saltarOrganizacion(Math.max(1, paso - 1), 1)); this.llevarAlInicioDelPaso(); }
  private saltarOrganizacion(paso: number, hacia: number): number { return paso === 2 && this.tipoDeRegistro() === 'individual' ? hacia : paso; }

  /**
   * La regla de cada campo, en un solo sitio: la usan «Siguiente», «Crear mi cuenta» y la salida de
   * cada campo. Devuelve el mensaje o `null`. Las reglas que el servidor también aplica se dicen
   * desde el principio, junto al campo: documento de 6 a 15 dígitos y contraseña de 12.
   */
  mensajeDelCampo(campo: string): string | null {
    const alta = this.alta;
    switch (campo) {
      case 'firstName': return alta.firstName.trim() ? null : 'Escribe el primer nombre.';
      case 'firstSurname': return alta.firstSurname.trim() ? null : 'Escribe el primer apellido.';
      case 'documentType': return alta.documentType ? null : 'Elige el tipo de documento.';
      case 'documentNumber': {
        const cifras = alta.documentNumber.replace(/\D/g, '').length;
        return cifras >= 6 && cifras <= 15 ? null : 'Escribe tu número de documento: entre 6 y 15 cifras, sin letras.';
      }
      case 'phone': return mensajeDeTelefono(alta.phone);
      case 'email': return esCorreoValido(alta.email) ? null : MENSAJE_DE_CORREO;
      case 'password': return mensajeDeClave(alta.password, alta.email, this.nombresDeLaPersona());
      case 'confirmPassword': return alta.confirmPassword === alta.password && alta.confirmPassword ? null : 'Las contraseñas no coinciden.';
      case 'organizationName': return alta.organizationName.trim() ? null : 'Escribe el nombre de la organización.';
      case 'organizationIdentificationNumber': return mensajeDeNit(alta.organizationIdentificationNumber);
      case 'headquartersDepartmentCode': return alta.headquartersDepartmentCode ? null : 'Elige el departamento de la sede.';
      case 'headquartersMunicipalityCode': return alta.headquartersMunicipalityCode ? null : 'Elige el municipio de la sede.';
      case 'politicasAceptadas':
        // LAS OBLIGATORIAS LAS DICE EL SERVIDOR. Antes había aquí dos comprobaciones fijas que
        // nombraban dos documentos concretos: el día que apareciera un tercero seguirían diciendo
        // que con esos dos bastaba, y el formulario dejaría pasar un alta incompleta.
        return this.politicasDelRegistro().some(politica => politica.obligatoria && !this.aceptada(politica.clave))
          ? 'Debes aceptar lo que el registro exige para continuar.'
          : null;
      default: return null;
    }
  }

  /** Al salir de un campo se valida ese campo, y solo ese. */
  alSalirDelCampo(campo: string): void {
    const pendiente = this.pausas.get(campo);
    if (pendiente) { clearTimeout(pendiente); this.pausas.delete(campo); }
    this.fijarError(campo, this.mensajeDelCampo(campo));
    // Confirmar la contraseña depende de la contraseña: si ya tiene algo escrito, se revisa de nuevo.
    if (campo === 'password' && this.alta.confirmPassword) this.fijarError('confirmPassword', this.mensajeDelCampo('confirmPassword'));
  }

  private fijarError(campo: string, mensaje: string | null): void {
    this.erroresAlta.update(errores => {
      const siguiente = { ...errores };
      if (mensaje) siguiente[campo] = mensaje; else delete siguiente[campo];
      return siguiente;
    });
  }

  private camposActivosDelPaso(paso: number): readonly string[] {
    return this.camposDelPaso[paso].filter(() => paso !== 2 || this.tipoDeRegistro() !== 'individual');
  }

  /** Marca los errores de un paso y su estado en el indicador. Devuelve los campos que fallan. */
  private marcarPaso(paso: number): string[] {
    const campos = this.camposActivosDelPaso(paso);
    const fallos = campos.filter(campo => this.mensajeDelCampo(campo));
    this.erroresAlta.update(errores => {
      const siguiente = { ...errores };
      for (const campo of campos) {
        const mensaje = this.mensajeDelCampo(campo);
        if (mensaje) siguiente[campo] = mensaje; else delete siguiente[campo];
      }
      return siguiente;
    });
    this.estadoDeLosPasos.update(estados => ({ ...estados, [paso]: fallos.length ? 'incompleto' : 'completo' }));
    return fallos;
  }

  /** Valida un paso: si falta algo lo dice junto a cada campo y enfoca el primero. Devuelve si está bien. */
  private validarPaso(paso: number): boolean {
    const fallos = this.marcarPaso(paso);
    if (fallos.length) this.enfocarError(fallos[0]);
    return fallos.length === 0;
  }

  /** El foco al primer campo con error. El de las autorizaciones es un grupo: va a su bloque. */
  private enfocarError(campo: string): void {
    enfocarCampo(campo === 'politicasAceptadas' ? 'registro-politicas' : `registro-${campo}`);
  }

  /**
   * Al cambiar de paso, la vista arranca donde empieza el paso nuevo: el indicador de pasos.
   *
   * Sin esto cada paso tiene una altura distinta, y al cambiar el navegador recortaba el
   * desplazamiento a donde cabía —un salto corto hacia arriba que no llevaba a ninguna parte—.
   * `scrollIntoView` sirve igual para la columna con scroll propio (escritorio) que para la
   * página (móvil), y respeta «reducir movimiento».
   */
  private llevarAlInicioDelPaso(): void {
    if (typeof document === 'undefined') return;
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Tras el siguiente cuadro, cuando el paso nuevo ya está pintado y la altura es la definitiva.
    requestAnimationFrame(() => document.getElementById('registro-pasos')
      ?.scrollIntoView({ block: 'start', behavior: reducido ? 'auto' : 'smooth' }));
  }
  alternarMostrarContrasena(): void { this.mostrarContrasena.update(valor => !valor); }

  /**
   * Quien llega a registrarse desde una invitación crea una cuenta personal —sin elegir
   * tipo— y se le dice a qué organización lo invitaron y con qué correo debe registrarse: la
   * invitación solo la acepta la cuenta del correo invitado (docs/desarrollo/19-cuentas-y-organizaciones.md §19.4). El correo llega
   * enmascarado, así que no se puede prellenar sin entregarlo completo a quien tenga el enlace.
   */
  private async recordarLaInvitacion(): Promise<void> {
    let pendiente: string | null = null;
    try { pendiente = sessionStorage.getItem(CLAVE_INVITACION_PENDIENTE); } catch { /* sin almacenamiento */ }
    const testigo = pendiente?.startsWith('/ecosistema/invitacion?testigo=') ? pendiente.split('testigo=')[1] : '';
    if (!testigo) return;
    try {
      const abierta = await firstValueFrom(this.api.post<InvitacionAbierta>(
        '/api/v1/externo/invitaciones/consultar', { testigo }, { errorFallback: 'No fue posible consultar la invitación.' }));
      if (abierta.estado !== 'pendiente') return;
      this.invitacion.set(abierta);
      this.tipoDeRegistro.set('individual');
    } catch { /* una invitación que no se puede consultar no cambia el registro */ }
  }

  /** Abre el formulario de recuperación con el correo que ya se había escrito para ingresar. */
  abrirRecuperacion(): void {
    this.limpiarMensajes();
    this.correoDeRecuperacion = this.login.email;
    this.errorDeRecuperacion.set('');
    this.avisoDeRecuperacion.set('');
    this.recuperacion.set('formulario');
    enfocarCampo('recuperacion-correo');
  }

  cerrarRecuperacion(): void {
    this.login = { email: this.correoDeRecuperacion || this.login.email, password: '' };
    this.recuperacion.set('cerrada');
    enfocarCampo('acceso-correo');
  }

  async solicitarRecuperacion(): Promise<void> {
    if (this.enviandoRecuperacion()) return;
    this.errorDeRecuperacion.set('');
    if (!esCorreoValido(this.correoDeRecuperacion)) {
      this.errorDeRecuperacion.set(MENSAJE_DE_CORREO);
      enfocarCampo('recuperacion-correo');
      return;
    }
    this.enviandoRecuperacion.set(true);
    try {
      this.avisoDeRecuperacion.set(await this.recuperacionDeContrasena.solicitar(this.correoDeRecuperacion.trim()));
      this.recuperacion.set('enviado');
      enfocarCampo('recuperacion-titulo');
    } catch (fallo: unknown) {
      const traducido = traducirErrorDelServidor(fallo, {
        camposConLugar: ['correo'],
        alternativa: 'No fue posible enviar la solicitud. Inténtalo de nuevo en un momento.',
      });
      this.errorDeRecuperacion.set(traducido.campos['correo'] ?? traducido.general);
      enfocarCampo('recuperacion-correo');
    } finally {
      this.enviandoRecuperacion.set(false);
    }
  }

  openExternalLogin(): void {
    this.limpiarMensajes();
    this.recuperacion.set('cerrada');
    this.vista.set('ingreso');
    this.router.navigate(['/ingresar']);
  }

  openRegistrationForm(): void {
    this.limpiarMensajes();
    this.vista.set('registro');
    // Quien viene de una invitación no elige tipo: crea una cuenta personal.
    this.tipoDeRegistro.set(this.invitacion() ? 'individual' : null);
    this.pasoDeRegistro.set(1);
    this.router.navigate(['/registro']);
  }

  /** Los nombres que la política de claves no admite dentro de la contraseña (igual que el servidor). */
  private nombresDeLaPersona(): readonly string[] {
    return [this.alta.firstName, this.alta.secondName, this.alta.firstSurname, this.alta.secondSurname];
  }

  /** Las reglas de la clave con su estado, para la lista que se marca mientras se escribe (L-3). */
  reglasDeLaClave(): readonly ReglaDeClave[] {
    return reglasDeClave(this.alta.password, this.alta.email, this.nombresDeLaPersona());
  }

  /** La pausa, en milisegundos, antes de decir que lo escrito está mal: no se regaña a mitad de palabra. */
  static readonly PAUSA_DE_VALIDACION = 400;
  private readonly pausas = new Map<string, ReturnType<typeof setTimeout>>();
  /** Los campos que, ya escritos, cumplen su regla: reciben la marca verde (L-3). */
  readonly camposCorrectos = signal<Record<string, boolean>>({});

  /** Lo escrito en el campo (algunos campos opcionales vacíos son válidos y no se marcan). */
  private valorDelCampo(campo: string): string {
    return String((this.alta as Record<string, string>)[campo] ?? '').trim();
  }

  /**
   * VALIDACIÓN EN VIVO (L-3). Con cada pulsación se desmiente al instante un error que ya no aplica, y
   * una regla cumplida se marca; el error nuevo, en cambio, espera a que la persona haga una pausa
   * (o salga del campo) para no avisar mientras todavía escribe. Todo es local: no consulta al servidor.
   */
  actualizarCampoAlta(campo: string): void {
    if (campo === 'email') this.correoYaRegistrado.set(false);
    this.evaluarEnVivo(campo);
    // La confirmación y la contraseña dependen la una de la otra y del correo y el nombre.
    if (campo === 'password' && this.alta.confirmPassword) this.evaluarEnVivo('confirmPassword');
    if ((campo === 'email' || campo === 'firstName' || campo === 'firstSurname') && this.alta.password) this.evaluarEnVivo('password');
  }

  private evaluarEnVivo(campo: string): void {
    const previa = this.pausas.get(campo);
    if (previa) clearTimeout(previa);
    this.pausas.delete(campo);
    const mensaje = this.mensajeDelCampo(campo);
    const escrito = this.valorDelCampo(campo).length > 0;
    this.camposCorrectos.update(estado => ({ ...estado, [campo]: escrito && mensaje === null }));
    if (mensaje === null || !escrito) { this.fijarError(campo, null); return; }
    // La contraseña se explica con su lista de reglas; el error aparece al salir del campo.
    if (campo === 'password') return;
    this.pausas.set(campo, setTimeout(() => {
      this.pausas.delete(campo);
      this.fijarError(campo, this.mensajeDelCampo(campo));
    }, ExternalAccessPageComponent.PAUSA_DE_VALIDACION));
  }

  /** Lo que se escribe en el ingreso se revisa con la misma pausa. */
  private pausaIngreso: ReturnType<typeof setTimeout> | null = null;
  readonly correoDeIngresoCorrecto = signal(false);
  alEscribirIngreso(campo: 'loginEmail' | 'loginPassword'): void {
    if (this.pausaIngreso) clearTimeout(this.pausaIngreso);
    this.pausaIngreso = null;
    const escrito = campo === 'loginEmail' ? this.login.email.trim() : this.login.password;
    const correcto = campo === 'loginEmail' ? esCorreoValido(this.login.email) : escrito.length > 0;
    if (campo === 'loginEmail') this.correoDeIngresoCorrecto.set(correcto);
    if (correcto || !escrito) { this.quitarErrorDeIngreso(campo); return; }
    this.pausaIngreso = setTimeout(() => {
      this.erroresIngreso.update(errores => ({ ...errores, [campo]: 'Ingresa un correo electrónico válido, por ejemplo nombre@correo.org.' }));
    }, ExternalAccessPageComponent.PAUSA_DE_VALIDACION);
  }
  private quitarErrorDeIngreso(campo: string): void {
    this.erroresIngreso.update(errores => { const siguiente = { ...errores }; delete siguiente[campo]; return siguiente; });
  }
  /** Al salir del correo de ingreso se dice al instante si está mal. */
  alSalirDelIngreso(campo: 'loginEmail' | 'loginPassword'): void {
    if (this.pausaIngreso) clearTimeout(this.pausaIngreso);
    this.pausaIngreso = null;
    const escrito = campo === 'loginEmail' ? this.login.email.trim() : this.login.password;
    if (campo === 'loginEmail' && escrito && !esCorreoValido(escrito)) {
      this.erroresIngreso.update(errores => ({ ...errores, loginEmail: 'Ingresa un correo electrónico válido, por ejemplo nombre@correo.org.' }));
    }
  }

  registrar(): void {
    this.limpiarMensajes();
    const individual = this.tipoDeRegistro() === 'individual';
    // TODOS LOS PASOS, EN ORDEN: el primero que falla recibe el foco y el resto se marcan también,
    // así el indicador dice cuáles están incompletos y no hay que descubrirlos uno a uno.
    const fallosPorPaso = (individual ? [1, 3] : [1, 2, 3]).map(paso => [paso, this.marcarPaso(paso)] as const);
    const primero = fallosPorPaso.find(([, fallos]) => fallos.length);
    if (primero) {
      this.pasoDeRegistro.set(primero[0]);
      this.enfocarError(primero[1][0]);
      return;
    }
    if (!this.registroDisponible()) {
      this.error.set('El registro no está disponible mientras se completa su configuración.');
      return;
    }

    this.loading.set(true);
    this.adminService.registrarCuentaExterna({
      registrationType: individual ? 'individual' : 'organizacion',
      organizationName: this.alta.organizationName,
      organizationIdentificationNumber: this.alta.organizationIdentificationNumber || null,
      headquartersDepartmentCode: this.alta.headquartersDepartmentCode,
      headquartersMunicipalityCode: this.alta.headquartersMunicipalityCode,
      firstName: this.alta.firstName, secondName: this.alta.secondName || null,
      firstSurname: this.alta.firstSurname, secondSurname: this.alta.secondSurname || null,
      documentType: this.alta.documentType, documentNumber: this.alta.documentNumber,
      phone: this.alta.phone, email: this.alta.email, password: this.alta.password,
      politicasAceptadas: this.politicasDelRegistro()
        .filter(politica => this.aceptada(politica.clave))
        .map(politica => politica.clave),
      // OPCIONALES: sin categorías elegidas no se envía nada y no se crea perfil.
      clasificacion: individual && this.hayCategoriasElegidas() ? this.categorias() : null,
    }).subscribe({
      // UNA CUENTA INDIVIDUAL NO TIENE PANEL DE ORGANIZACIÓN: entra a su cuenta.
      next: () => { this.login = { email: this.alta.email, password: this.alta.password }; this.startLogin(individual ? '/gestion/cuenta?bienvenida=1' : '/gestion?registrada=1'); },
      error: fallo => this.fallarRegistro(fallo),
    });
  }

  /** El correo ya tiene cuenta: se ofrece ingresar con él en lugar de un error técnico. */
  readonly correoYaRegistrado = signal(false);

  /**
   * Lo que el servidor rechaza vuelve a SU campo, con su paso marcado y el foco puesto (
   *). Un correo ya registrado no es un fallo técnico: es «ya tienes cuenta», y se ofrece
   * ingresar (antes aparecía «No fue posible registrar el usuario externo…» en el último paso).
   */
  private fallarRegistro(fallo: unknown): void {
    this.loading.set(false);
    const todos = [1, 2, 3].flatMap(paso => this.camposDelPaso[paso]);
    const traducido = traducirErrorDelServidor(fallo, {
      camposConLugar: todos,
      alternativa: 'No fue posible crear tu cuenta. Inténtalo de nuevo en un momento.',
    });
    const estado = (fallo as { status?: number | null } | null)?.status;
    const duplicado = (estado === 409 && /correo/i.test(traducido.general)) || /ya (existe|hay|est[aá])/i.test(traducido.campos['email'] ?? '');
    const campos = { ...traducido.campos };
    if (duplicado) {
      campos['email'] = 'Ya hay una cuenta con este correo. ¿Quieres ingresar?';
      this.correoYaRegistrado.set(true);
    }
    if (!Object.keys(campos).length) { this.error.set(traducido.general); return; }

    this.erroresAlta.update(errores => ({ ...errores, ...campos }));
    const primero = todos.find(campo => campos[campo]);
    if (primero) {
      const paso = [1, 2, 3].find(candidato => this.camposDelPaso[candidato].includes(primero)) ?? 1;
      this.estadoDeLosPasos.update(estados => ({ ...estados, [paso]: 'incompleto' }));
      this.pasoDeRegistro.set(paso);
      this.enfocarError(primero);
    }
    if (!duplicado) this.error.set(traducido.general);
  }

  /** «Ingresar» desde el aviso de correo ya registrado: lleva el correo escrito al ingreso. */
  ingresarConEsteCorreo(): void {
    const correo = this.alta.email;
    this.openExternalLogin();
    this.login = { email: correo, password: '' };
  }

  /**
   * Inicia sesión. Sin destino pedido, va a la pantalla de entrada «¿Cómo quieres entrar?» (ACC2):
   * una cuenta con organizaciones elige entre su espacio y cada una; una sin organización pasa de
   * largo hacia Mi espacio. El `?volver=` y la invitación pendiente siguen mandando sobre esto.
   */
  startLogin(destino: string = RUTA_DE_ENTRADA): void {
    this.limpiarMensajes();
    const errores: Record<string, string> = {};
    if (!esCorreoValido(this.login.email)) errores['loginEmail'] = 'Ingresa un correo electrónico válido.';
    if (!this.login.password) errores['loginPassword'] = 'Escribe tu contraseña.';
    this.erroresIngreso.set(errores);
    if (Object.keys(errores).length) return;
    this.loading.set(true);
    this.adminService.iniciarSesionExterna(this.login).subscribe({
      next: sesion => { this.loading.set(false); this.sesionExterna.establecer(sesion); this.router.navigateByUrl(this.destinoTrasEntrar(destino)); },
      error: fallo => this.fallarInicioSesion(fallo),
    });
  }

  /**
   * Adónde ir al entrar. Si la persona venía de abrir una invitación, vuelve a ella para
   * aceptarla; si la mandó aquí el panel con `?volver=`, vuelve a la página que pidió —con
   * su organización—. Solo se admiten esas direcciones, para no convertir esto en una redirección
   * abierta.
   */
  private destinoTrasEntrar(destino: string): string {
    let pendiente: string | null = null;
    try { pendiente = sessionStorage.getItem('simus.invitacionPendiente'); } catch { /* sin almacenamiento */ }
    // La invitación a una organización y la invitación a una agenda de citas vuelven a su propia página.
    if (pendiente?.startsWith('/ecosistema/invitacion?testigo=') || pendiente?.startsWith('/ecosistema/invitacion-agenda?testigo=')) return pendiente;
    return destinoSeguroTrasEntrar(this.route.snapshot.queryParamMap.get('volver')) ?? destino;
  }

  private cargarPreparacionDelRegistro(): void {
    this.adminService.cargarDivipolaPublica().subscribe({ next: filas => { this.locations.set(filas); this.terminarPreparacion(); }, error: fallo => { this.terminarPreparacion(); this.fallar(fallo); } });
    this.adminService.cargarPreparacionDeRegistroExterno().subscribe({
      next: preparacion => {
        this.politicasDelRegistro.set(preparacion?.politicas ?? []);
        this.registroDisponible.set(preparacion?.registroDisponible !== false);
        if (preparacion?.registroDisponible === false) this.error.set((preparacion.impedimentos ?? []).join(' '));
        this.terminarPreparacion();
      }, error: fallo => { this.terminarPreparacion(); this.fallar(fallo); },
    });
  }

  private terminarPreparacion(): void {
    this.pendientesDePreparacion = Math.max(0, this.pendientesDePreparacion - 1);
    if (this.pendientesDePreparacion === 0) this.preparando.set(false);
  }

  private limpiarMensajes(): void { this.message.set(''); this.error.set(''); }
  /**
   * No diferencia una cuenta inexistente de una contraseña incorrecta. Además de orientar a la
   * persona, evita convertir el formulario en un mecanismo de enumeración de cuentas.
   */
  private fallarInicioSesion(fallo: any): void {
    this.loading.set(false);
    const estado = Number(fallo?.status ?? 0);
    this.error.set([400, 401, 403].includes(estado)
      ? 'El correo electrónico o la contraseña no son correctos.'
      : 'No fue posible iniciar sesión. Inténtalo de nuevo.');
  }
  private fallar(fallo: any): void { this.loading.set(false); this.error.set(fallo?.message || 'No fue posible completar la solicitud. Inténtalo de nuevo.'); }
}
