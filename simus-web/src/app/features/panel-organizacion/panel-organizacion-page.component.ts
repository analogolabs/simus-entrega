import { Component, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ArmazonDeGestionComponent } from '../../shared/components/layout/armazon-de-gestion/armazon-de-gestion.component';
import { CabeceraDelPanelComponent } from './cabecera-del-panel.component';
import { GrupoDeGestion } from '../../core/navegacion/grupos-de-gestion';
import { rutaSinAsistente } from '../../core/navegacion/asistente-en-gestion';
import { CajonDeConsultaGuiadaComponent } from '../../shared/components/consulta-guiada/cajon-de-consulta-guiada.component';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { ExternalSessionService } from '../../core/services/external-session.service';
import { ContextoDeOrganizacionService } from '../../core/services/contexto-de-organizacion.service';
import { ConfirmacionDeCambioDeOrganizacion } from '../../core/navegacion/cambio-de-organizacion';
import { RUTAS_DE_LA_CUENTA, rutaDelPanel, seccionDeLaUrl } from '../../core/navegacion/rutas-de-gestion';
import { FalloDelServidor, PanelOrganizacionApi, PerfilOrganizacion } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';
import { ConteoDeSolicitudes, SolicitudesDeLaCuentaService } from './solicitudes/solicitudes-de-la-cuenta.service';
import { ConfirmacionDeCorreoService } from '../../core/services/confirmacion-de-correo.service';
import { nombrePropio } from '../../shared/texto/nombre-propio';
import { DialogoDeCambioPendienteComponent } from '../../shared/components/ui/dialogo-de-cambio-pendiente/dialogo-de-cambio-pendiente.component';
import { BotonNativoDirective } from '../../shared/components/ui/boton/boton.component';
import { CampoDeSeleccionComponent, OpcionDeSeleccion } from '../../shared/components/ui/campo-de-seleccion/campo-de-seleccion.component';
import {
  CLAVE_GRUPOS_PLEGADOS_DEL_PANEL, ENLACES_DEL_PANEL, GRUPOS_DEL_PANEL, GRUPOS_DEL_PANEL_PLEGADOS_POR_OMISION,
} from './secciones-del-panel';

// Las secciones viven en `secciones-del-panel.ts`; se reexportan para quien ya las importaba de aquí.
export { ENLACES_DEL_PANEL } from './secciones-del-panel';
export type { EnlacePanel } from './secciones-del-panel';

/**
 * El armazón del panel de UNA organización, en `/gestion/o/{organizacionId}`.
 *
 * <b>LA ORGANIZACIÓN ES LA DE LA URL Y NINGUNA OTRA.</b> Este componente lee el parámetro de su ruta,
 * comprueba en la sesión que la cuenta es miembro y lo copia en `PanelOrganizacionStore` antes de
 * que nazca ninguna sección. El selector no cambia una señal: navega a la misma sección de la otra
 * organización, y el armazón entero se reconstruye (`ReutilizacionDeRutas`), así que nada de lo
 * escrito en una organización puede acabar guardado en otra. Recargar conserva la organización.
 *
 * <b>REDISEÑO DEL 1 DE SEPTIEMBRE DE 2026.</b> Hasta entonces esta clase tenía casi 800 líneas: la
 * navegación por pestañas, la carga del perfil, la lista de Festivales, las notificaciones, el
 * diálogo de la ficha y el álgebra de sus reglas de bloqueo, todo junto. Aquí queda la cabecera de
 * la organización, el selector, la campana (`CampanaDeAvisosComponent`) y el `<router-outlet>`.
 *
 * <b>Lo de la persona no está aquí.</b> Perfil público, datos personales y seguridad, y registrar
 * otra organización viven en el espacio personal, `/gestion/cuenta`.
 *
 * <b>La sesión.</b> La deniega `sesionExternaGuard` en la ruta padre. La comprobación de aquí no
 * sustituye a esa: evita pintar un panel a medias mientras `refrescar()` está en vuelo.
 */
@Component({
  selector: 'app-panel-organizacion-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, RouterOutlet, CajonDeConsultaGuiadaComponent, ArmazonDeGestionComponent, CabeceraDelPanelComponent,
    DialogoDeCambioPendienteComponent, BotonNativoDirective, CampoDeSeleccionComponent,
  ],
  templateUrl: './panel-organizacion-page.component.html',
  // La estructura es la del armazón compartido (`app-armazon-de-gestion`); aquí solo lo propio del panel.
  styleUrls: ['./panel-organizacion-page.component.css'],
})
export class PanelOrganizacionPageComponent implements OnInit {
  private readonly sesionExterna = inject(ExternalSessionService);
  private readonly api = inject(PanelOrganizacionApi);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly contexto = inject(ContextoDeOrganizacionService);
  readonly store = inject(PanelOrganizacionStore);
  readonly cambio = inject(ConfirmacionDeCambioDeOrganizacion);
  private readonly confirmacion = inject(ConfirmacionDeCorreoService);
  private readonly solicitudesDeLaCuenta = inject(SolicitudesDeLaCuentaService);

  /**
   * LA INSIGNIA DE SOLICITUDES (SOL): lo que espera la acción de la organización. Se pide al servidor, que cuenta
   * con la misma regla que la lista; si no se puede leer, no se enseña nada antes que un número inventado.
   */
  readonly conteoDeSolicitudes = signal<ConteoDeSolicitudes | null>(null);
  readonly pendientesDeSolicitudes = computed(() => this.conteoDeSolicitudes()?.esperanTuAccion ?? 0);
  readonly textoDeLasPendientes = computed(() => {
    const n = this.pendientesDeSolicitudes();
    return n === 1 ? '1 solicitud espera tu acción' : `${n} solicitudes esperan tu acción`;
  });

  readonly enlaces = ENLACES_DEL_PANEL;
  readonly clavePlegados = CLAVE_GRUPOS_PLEGADOS_DEL_PANEL;
  readonly plegadosPorOmision = GRUPOS_DEL_PANEL_PLEGADOS_POR_OMISION;
  /** Los destinos del armazón compartido: los del panel, con sus comandos y la insignia de Solicitudes. */
  readonly grupos = computed<readonly GrupoDeGestion[]>(() => GRUPOS_DEL_PANEL.map(grupo => ({
    id: grupo.id,
    etiqueta: grupo.etiqueta,
    enlaces: grupo.enlaces.map(e => ({
      ruta: e.ruta, comandos: this.enlace(e.ruta), etiqueta: e.etiqueta, icono: e.icono, palabrasClave: e.palabrasClave,
      ...(e.ruta === 'solicitudes' ? { insignia: this.pendientesDeSolicitudes(), textoDeLaInsignia: this.textoDeLasPendientes() } : {}),
    })),
  })));
  readonly rutasDeLaCuenta = RUTAS_DE_LA_CUENTA;

  readonly sesion = this.sesionExterna.actual;
  readonly organizaciones = this.store.organizaciones;
  readonly hayVariasOrganizaciones = this.store.hayVariasOrganizaciones;
  readonly organizacionId = this.store.organizacionId;
  readonly sinAsistente = rutaSinAsistente();

  /**
   * La organización que pide la URL. Este armazón se reconstruye al cambiar de organización
   * (`ReutilizacionDeRutas`), así que se lee una vez.
   */
  readonly organizacionDeLaUrl = this.ruta.snapshot.paramMap.get('organizacionId') ?? '';

  /** Mientras la sesión no ha resuelto no se pinta ni el panel ni el aviso de que no hay sesión. */
  readonly comprobandoSesion = signal(!this.sesionExterna.dentro());

  /**
   * La cuenta abrió una organización de la que no es miembro: un enlace ajeno, una organización
   * que dejó. Se dice con claridad y no se pinta ninguna sección.
   */
  readonly sinAcceso = computed(() => !this.comprobandoSesion() && !this.store.esMiembroDe(this.organizacionDeLaUrl));

  readonly perfil = signal<PerfilOrganizacion | null>(null);
  readonly cargandoPerfil = signal(false);
  readonly errorPerfil = signal('');

  /** «Cambiamos a …»: lo deja la ficha que abrió esta organización porque el registro era suyo. */
  readonly avisoDeCambio = signal(this.store.avisoDeCambio());

  /** Recién registrada desde «Registrar una organización» o desde /registro. */
  readonly recienRegistrada = signal(this.ruta.snapshot.queryParamMap.get('registrada') === '1');

  /**
   * «Te uniste a X como editor»: aceptar una invitación abre esta organización con
   * `?unido=<rol>` y el armazón da la bienvenida con el rol, una vez.
   */
  readonly rolAlUnirse = signal<'administrador' | 'editor' | null>(((rol) => rol === 'administrador' || rol === 'editor' ? rol : null)(this.ruta.snapshot.queryParamMap.get('unido')));

  readonly rutaActual = signal(this.router.url);
  readonly gestionandoFestival = computed(() => /^\/gestion\/o\/[^/]+\/procesos\/festivales\/[^/?#]+/.test(this.rutaActual()));
  constructor() {
    this.router.events.subscribe(evento => {
      if (evento instanceof NavigationEnd) { this.rutaActual.set(evento.urlAfterRedirects); this.actualizarLaInsignia(); }
    });
    // El aviso se enseña una vez: la siguiente organización que se abra no lo hereda.
    this.store.avisoDeCambio.set('');
    // SE FIJA ANTES DE QUE NAZCAN LAS SECCIONES. Las hijas leen la organización en su `ngOnInit`; un
    // `effect` llegaría tarde. Y se vuelve a comprobar si la sesión cambia —la cuenta dejó la
    // organización—: entonces se vacía y se enseña el aviso de acceso, nunca otra organización.
    this.fijarOrganizacion();
    effect(() => this.fijarOrganizacion());
    effect(() => {
      const id = this.organizacionId();
      if (id) { this.cargarPerfil(id); this.actualizarLaInsignia(); }
    });
  }

  private actualizarLaInsignia(): void {
    const id = this.organizacionId();
    if (!id || !this.sesionExterna.dentro()) { this.conteoDeSolicitudes.set(null); return; }
    this.solicitudesDeLaCuenta.conteoDeLaOrganizacion(id).subscribe({
      next: conteo => this.conteoDeSolicitudes.set(conteo),
      error: () => this.conteoDeSolicitudes.set(null),
    });
  }

  ngOnInit(): void {
    // SE PREGUNTA UNA VEZ AL ENTRAR AL PANEL, no en cada pantalla. La confirmación del correo es de
    // la cuenta —quien administra tres organizaciones no tiene tres correos— y decide qué puede
    // hacer en cuatro pantallas distintas.
    void this.confirmacion.asegurar();

    if (this.sesionExterna.dentro()) {
      this.comprobandoSesion.set(false);
      return;
    }

    // SE USA `refrescar()` Y NO `cargarUnaVez()` A PROPÓSITO: `cargarUnaVez()` no dice cuándo
    // terminó, y aquí distinguir «todavía no se ha consultado» de «no hay sesión» es justo lo que
    // decide entre pintar el panel y mandar a la pantalla de ingreso.
    this.sesionExterna.refrescar().subscribe(sesion => {
      this.comprobandoSesion.set(false);
      if (!sesion) {
        this.router.navigate(['/ingresar']);
        return;
      }
      this.fijarOrganizacion();
    });
  }

  /** Los comandos de una sección de ESTA organización, para los enlaces de la plantilla. */
  enlace(...segmentos: string[]): string[] {
    return rutaDelPanel(this.organizacionDeLaUrl, ...segmentos);
  }

  /** Los comandos de la misma sección en otra organización, para la lista de «sin acceso». */
  enlaceA(organizacionId: string): string[] {
    return rutaDelPanel(organizacionId, 'resumen');
  }

  readonly nombreDeLaOrganizacion = computed(() => this.perfil()?.nombre || this.store.organizacionElegida()?.name || 'Organización');

  /** Las organizaciones de la cuenta, como opciones del selector de la barra lateral. */
  readonly opcionesDeOrganizacion = computed<OpcionDeSeleccion[]>(() => this.organizaciones().map(organizacion => ({ valor: organizacion.id, etiqueta: organizacion.name })));

  private readonly selectorDeOrganizacion = viewChild(CampoDeSeleccionComponent);

  ubicacionOrganizacion(): string | null {
    const ficha = this.perfil();
    if (!ficha) return null;
    // La fuente territorial guarda los nombres como los publica el DANE —«LA PLATA», «HUILA»— y
    // aquí se enseñan; se escriben como se escriben. Ver `shared/texto/nombre-propio.ts`.
    const ubicacion = [ficha.nombreMunicipioSede, ficha.nombreDepartamentoSede]
      .filter(Boolean).map(nombre => nombrePropio(nombre)).join(', ');
    return ubicacion || null;
  }

  /**
   * Cambia de organización NAVEGANDO a la misma sección de la otra.
   *
   * El desplegable vuelve a enseñar la organización actual hasta que la navegación termina: si un
   * asistente con cambios pide confirmación y la persona se queda, el selector no puede quedarse
   * diciendo otra cosa que la URL.
   */
  cambiarDeOrganizacion(id: string): void {
    this.selectorDeOrganizacion()?.establecer(this.organizacionDeLaUrl);
    if (!id || id === this.organizacionDeLaUrl) return;
    void this.router.navigate(rutaDelPanel(id, seccionDeLaUrl(this.router.url)));
  }

  cerrarAvisoDeCambio(): void {
    this.avisoDeCambio.set('');
  }

  cerrarBienvenidaDeOrganizacion(): void {
    this.recienRegistrada.set(false);
    void this.router.navigate([], { relativeTo: this.ruta.firstChild ?? this.ruta, queryParams: { registrada: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  cerrarBienvenidaDeInvitacion(): void {
    this.rolAlUnirse.set(null);
    void this.router.navigate([], { relativeTo: this.ruta.firstChild ?? this.ruta, queryParams: { unido: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  cerrarSesion(): void {
    this.sesionExterna.salir().subscribe(() => this.router.navigate(['/']));
  }

  /**
   * Copia al store la organización de la URL si la cuenta es miembro, y la recuerda para la
   * próxima vez que una dirección no diga cuál abrir.
   */
  private fijarOrganizacion(): void {
    const id = this.store.esMiembroDe(this.organizacionDeLaUrl) ? this.organizacionDeLaUrl : '';
    if (this.store.organizacionId() !== id) this.store.organizacionId.set(id);
    if (id) this.contexto.recordar(id);
  }

  private cargarPerfil(organizacionId: string): void {
    this.perfil.set(null);
    this.errorPerfil.set('');
    this.cargandoPerfil.set(true);
    this.api.obtenerPerfil(organizacionId).subscribe({
      next: perfil => {
        this.cargandoPerfil.set(false);
        this.perfil.set(perfil);
      },
      error: (fallo: FalloDelServidor) => {
        this.cargandoPerfil.set(false);
        // 404: el servidor ya no te reconoce como miembro (te quitaron, la dejaste en otra pestaña).
        // La sesión local está desfasada: se vuelve a leer, el armazón pasa a «sin acceso» y la
        // «última organización» guardada se olvida.
        if (fallo?.status === 404) {
          this.contexto.olvidar(organizacionId);
          this.sesionExterna.refrescar().subscribe(() => {
            if (this.store.esMiembroDe(organizacionId)) this.errorPerfil.set('Esta organización ya no está disponible.');
          });
          return;
        }
        this.errorPerfil.set(fallo?.message ?? 'No fue posible consultar los datos de la organización');
      },
    });
  }
}
