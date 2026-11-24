import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouteReuseStrategy, Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { ExternalSessionService, SesionExterna } from '../../core/services/external-session.service';
import { NotificacionesEnVivoService, PaginaDeNotificacionesEnVivo } from '../../core/services/notificaciones-en-vivo.service';
import { ContextoDeOrganizacionService } from '../../core/services/contexto-de-organizacion.service';
import { ConfirmacionDeCambioDeOrganizacion, ConCambiosSinGuardar, confirmarCambioDeOrganizacion } from '../../core/navegacion/cambio-de-organizacion';
import { RECREAR_AL_CAMBIAR_PARAMETROS, ReutilizacionDeRutas } from '../../core/navegacion/reutilizacion-de-rutas';
import { ENLACES_DEL_PANEL, PanelOrganizacionPageComponent } from './panel-organizacion-page.component';
import { NotificacionDelPanel, PanelOrganizacionApi } from './panel-organizacion.api';
import { PanelOrganizacionStore } from './panel-organizacion.store';

@Component({ standalone: true, template: 'Vista de prueba' })
class VistaDePruebaComponent {}

/** Un asistente con algo escrito, como el de Festival a medias. */
@Component({ standalone: true, template: 'Asistente de prueba' })
class AsistenteDePruebaComponent implements ConCambiosSinGuardar {
  static instancias = 0;
  static guardadoAntesDeSalir = 0;
  escrito = true;
  constructor() { AsistenteDePruebaComponent.instancias += 1; }
  avisoAlCambiarDeOrganizacion(actual: string, nueva: string): string | null {
    return this.escrito ? `Tu Festival a medias se guarda como borrador de «${actual}» y no pasará a «${nueva}».` : null;
  }
  async antesDeCambiarDeOrganizacion(): Promise<void> { AsistenteDePruebaComponent.guardadoAntesDeSalir += 1; }
}

const SESION: SesionExterna = {
  userId: '9',
  fullName: 'Ana Restrepo',
  email: 'ana@fmv.org',
  accountStatus: 'activa',
  organizations: [
    { id: '117', name: 'Fundación Musical del Valle', role: 'administrador' },
    { id: '1117', name: 'Corporación Tambó', role: 'editor' },
  ],
};

const NOMBRES: Record<string, string> = { '117': 'Fundación Musical del Valle', '1117': 'Corporación Tambó' };

const RUTAS: Routes = [{
  path: 'gestion',
  providers: [PanelOrganizacionStore],
  children: [
    {
      path: 'o/:organizacionId',
      component: PanelOrganizacionPageComponent,
      data: { [RECREAR_AL_CAMBIAR_PARAMETROS]: true },
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'resumen' },
        ...ENLACES_DEL_PANEL.map(enlace => ({ path: enlace.ruta, component: VistaDePruebaComponent })),
        { path: 'procesos/festivales', component: VistaDePruebaComponent },
        { path: 'procesos/festivales/nuevo', component: AsistenteDePruebaComponent, canDeactivate: [confirmarCambioDeOrganizacion] },
        { path: 'procesos/festivales/:id', component: VistaDePruebaComponent },
      ],
    },
    { path: 'cuenta', children: [{ path: '**', component: VistaDePruebaComponent }] },
  ],
}];

class SesionFalsa {
  readonly interna = signal<SesionExterna | null>(null);
  readonly actual = this.interna.asReadonly();
  readonly organizaciones = computed(() => this.interna()?.organizations ?? []);
  respuesta: SesionExterna | null = null;

  dentro(): boolean { return this.interna() !== null; }
  refrescar() { this.interna.set(this.respuesta); return of(this.respuesta); }
  salir() { this.interna.set(null); return of(null); }
}

class NotificacionesEnVivoFalsas {
  readonly pagina = new BehaviorSubject<PaginaDeNotificacionesEnVivo>({ items: [], limit: 50, offset: 0, total: 0 });
  observar() { return this.pagina.asObservable(); }
  actualizarAhora(): void { return undefined; }
}

// Descriptor nativo de `innerWidth`, capturado al cargar el archivo; borrarlo dejaba `undefined` a las demás pruebas.
const ANCHO_NATIVO = Object.getOwnPropertyDescriptor(window, 'innerWidth');

describe('PanelOrganizacionPageComponent · la organización activa vive en la URL', () => {
  let sesion: SesionFalsa;
  let notificaciones: NotificacionDelPanel[];
  let harness: RouterTestingHarness;
  let notificacionesEnVivo: NotificacionesEnVivoFalsas;

  beforeEach(() => {
    try { localStorage.removeItem('simus.gestion.ultimaOrganizacion.9'); localStorage.removeItem('simus.gestion.menu-lateral'); } catch { /* sin almacenamiento */ }
    // La ventana de Karma es estrecha: el menú se prueba como en escritorio salvo que la prueba diga otra cosa.
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    AsistenteDePruebaComponent.instancias = 0;
    AsistenteDePruebaComponent.guardadoAntesDeSalir = 0;
    sesion = new SesionFalsa();
    notificaciones = [];
    notificacionesEnVivo = new NotificacionesEnVivoFalsas();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(RUTAS),
        { provide: RouteReuseStrategy, useClass: ReutilizacionDeRutas },
        { provide: ExternalSessionService, useValue: sesion },
        { provide: NotificacionesEnVivoService, useValue: notificacionesEnVivo },
        {
          provide: PanelOrganizacionApi,
          useValue: {
            obtenerPerfil: (id: string) => of({
              id,
              nombre: NOMBRES[id] ?? 'Otra',
              nivelCobertura: 'municipal',
              nombreMunicipio: 'Medellín',
              nombreDepartamento: 'Antioquia',
              nombreMunicipioSede: 'Bogotá, D. C.',
              nombreDepartamentoSede: 'Bogotá, D. C.',
              fechaActualizacion: '2026-09-09T00:00:00Z',
            }),
            obtenerNotificaciones: () => of({ items: notificaciones, limit: 50, offset: 0, total: notificaciones.length }),
            marcarNotificacionLeida: (id: string) => of({ ...notificaciones.find(item => item.id === id)!, readAt: '2026-09-09T12:30:00Z' }),
            ocultarNotificacionesLeidas: () => of({ ocultadas: 0 }),
          },
        },
      ],
    });
  });

  afterEach(() => {
    if (ANCHO_NATIVO) Object.defineProperty(window, 'innerWidth', ANCHO_NATIVO);
    try { localStorage.removeItem('simus.gestion.ultimaOrganizacion.9'); } catch { /* sin almacenamiento */ }
  });

  async function montar(url = '/gestion/o/117/resumen'): Promise<HTMLElement> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  const raiz = () => harness.routeNativeElement as HTMLElement;
  const router = () => TestBed.inject(Router);
  const store = () => harness.routeDebugElement!.injector.get(PanelOrganizacionStore);

  async function elegirEnElSelector(id: string): Promise<void> {
    const selector = raiz().querySelector<HTMLSelectElement>('#selector-organizacion')!;
    selector.value = id;
    selector.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('sin sesión dirige al acceso vigente', async () => {
    sesion.respuesta = null;
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    const elemento = await montar();

    expect(navegar).toHaveBeenCalledWith(['/ingresar']);
    expect(elemento.querySelector('[aria-label="Secciones del panel de la organización"]')).toBeNull();
  });

  it('abre la organización que dice la URL, no la primera de la sesión', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar('/gestion/o/1117/procesos');

    expect(store().organizacionId()).toBe('1117');
    expect(elemento.querySelector('[data-testid="nombre-organizacion-activa"]')?.textContent).toContain('Corporación Tambó');
    expect(elemento.querySelector<HTMLSelectElement>('#selector-organizacion')?.value).toBe('1117');
    // Con su rol: en Tambó la cuenta edita.
    expect(store().esAdministradora()).toBeFalse();
    // SOLO EL ROL, sin «Actuando como» (ACC2).
    expect(elemento.querySelector('[data-testid="rol-en-organizacion"]')?.textContent?.trim()).toBe('Editor');
    expect(elemento.textContent).not.toContain('Actuando como');
  });

  it('una organización de la que la cuenta no es miembro se dice con claridad y no pinta secciones', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar('/gestion/o/999/resumen');

    expect(elemento.querySelector('[data-testid="panel-sin-acceso"]')?.textContent).toContain('No formas parte de esta organización');
    expect(elemento.querySelector('router-outlet')).toBeNull();
    expect(store().organizacionId()).toBe('');
    // Ofrece las suyas, cada una en su dirección.
    const enlaces = Array.from(elemento.querySelectorAll<HTMLAnchorElement>('[data-testid="panel-sin-acceso"] li a')).map(a => a.getAttribute('href'));
    expect(enlaces).toEqual(['/gestion/o/117/resumen', '/gestion/o/1117/resumen']);
  });

  it('la barra lateral lleva los destinos de la organización, agrupados, y lo de la persona ya no está aquí (UI-E)', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar();
    const navegacion = elemento.querySelector<HTMLElement>('[aria-label="Secciones del panel de la organización"]')!;
    const enlaces = Array.from(navegacion.querySelectorAll('a'));

    // Una sola lista que se desplaza dentro de la barra, sin pestañas horizontales como segundo menú.
    expect(navegacion.className).toContain('sidebar-secciones');
    expect(elemento.querySelector('.foundation-sidebar')).not.toBeNull();
    expect(enlaces.map(enlace => enlace.textContent?.trim())).toEqual([
      // «TRABAJO»: lo que espera una decisión. «PROCESOS Y HERRAMIENTAS»: «Eventos» va después de «Procesos» (un evento
      // se anuncia siempre dentro de un proceso) y «Herramientas» (decisión 74) es lo que SIMUS ofrece aparte.
      // «LA ORGANIZACIÓN»: sus datos, sus archivos y su equipo.
      'Inicio', 'Solicitudes', 'Procesos', 'Eventos', 'Herramientas', 'Datos de la organización', 'Archivos de la organización', 'Equipo',
    ]);
    expect(Array.from(navegacion.querySelectorAll('.sidebar-grupo-titulo')).map(t => t.textContent?.trim()))
      .toEqual(['Trabajo', 'Mis procesos', 'Mi organización']);
    expect(enlaces.every(enlace => enlace.getAttribute('href')!.startsWith('/gestion/o/117/'))).toBeTrue();
    // El destino que se está viendo lo dice para los lectores de pantalla.
    expect(elemento.querySelector('[data-seccion="resumen"]')?.getAttribute('aria-current')).toBe('page');
    expect(elemento.querySelector('[data-seccion="equipo"]')?.getAttribute('aria-current')).toBeNull();
  });

  it('tiene la estructura de la consola: cabecera con búsqueda y menú de cuenta, la organización arriba de la barra y el contenido a la derecha (UI-E)', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar();

    expect(elemento.querySelector('header[data-testid="cabecera-del-panel"]')).not.toBeNull();
    expect(elemento.querySelector('app-buscador-de-lista input')).not.toBeNull();
    expect(elemento.querySelector('[data-menu-de-cuenta]')?.getAttribute('aria-haspopup')).toBe('menu');
    expect(elemento.querySelector('.foundation-layout > .foundation-main')).not.toBeNull();
    // La organización y el rol van ARRIBA de la barra lateral, fuera de la lista que se desplaza.
    const barra = elemento.querySelector('.foundation-sidebar')!;
    expect(barra.firstElementChild?.querySelector('[data-testid="nombre-organizacion-activa"]')).not.toBeNull();
    expect(barra.querySelector('nav [data-testid="nombre-organizacion-activa"]')).toBeNull();
    // Sin «Actuando como», sin distintivo de color y sin degradados.
    expect(elemento.textContent).not.toContain('Actuando como');
    expect(elemento.querySelector('[data-testid="distintivo-organizacion"]')).toBeNull();
    expect(elemento.innerHTML).not.toContain('bg-gradient');
  });

  it('el menú de cuenta ofrece lo de la persona, sus organizaciones y la salida, y Escape lo cierra (UI-E)', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar();
    const disparador = elemento.querySelector<HTMLButtonElement>('[data-menu-de-cuenta]')!;
    expect(elemento.querySelector('[data-menu-de-cuenta-panel]')).toBeNull();

    disparador.click();
    harness.detectChanges();

    expect(disparador.getAttribute('aria-expanded')).toBe('true');
    const menu = elemento.querySelector('[data-menu-de-cuenta-panel]')!;
    expect(menu.textContent).toContain('ana@fmv.org');
    expect(Array.from(menu.querySelectorAll('a')).map(a => a.getAttribute('href'))).toEqual([
      '/gestion/cuenta', '/gestion/cuenta/perfil-publico', '/gestion/cuenta/seguridad', '/gestion/cuenta/autorizaciones', '/gestion/o/117/resumen', '/gestion/o/1117/resumen',
    ]);
    expect(elemento.querySelector('[data-menu-organizacion="117"]')?.getAttribute('aria-current')).toBe('true');
    expect(menu.querySelector('[data-menu-cerrar-sesion]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(elemento.querySelector('[data-menu-de-cuenta-panel]')).toBeNull();
  });

  it('el buscador de la cabecera encuentra secciones por su nombre y por lo que se hace en ellas, con el teclado', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar();
    const campo = elemento.querySelector<HTMLInputElement>('app-buscador-de-lista input')!;

    campo.value = 'invitar';
    campo.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    harness.detectChanges();

    const resultados = Array.from(elemento.querySelectorAll('#secciones-encontradas [role="option"]'));
    expect(resultados.map(r => r.querySelector('b')?.textContent)).toEqual(['Equipo']);
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router().url).toBe('/gestion/o/117/equipo');
  });

  it('los grupos se pliegan y la elección se recuerda; el grupo de la sección que se ve nunca se esconde (UI-E)', async () => {
    sesion.respuesta = SESION;
    try { localStorage.removeItem('simus.panel.grupos-plegados.9'); } catch { /* sin almacenamiento */ }
    const elemento = await montar('/gestion/o/117/resumen');
    const titulo = (id: string) => elemento.querySelector<HTMLButtonElement>(`#titulo-grupo-panel-${id}`)!;

    // El grupo con la sección activa (Trabajo) no se pliega: el botón está inhabilitado y la lista a la vista.
    expect(titulo('trabajo').disabled).toBeTrue();
    expect(titulo('procesos').getAttribute('aria-expanded')).toBe('true');

    titulo('procesos').click();
    harness.detectChanges();
    expect(titulo('procesos').getAttribute('aria-expanded')).toBe('false');
    expect(elemento.querySelector<HTMLElement>('#grupo-panel-procesos')?.hidden).toBeTrue();
    expect(JSON.parse(localStorage.getItem('simus.panel.grupos-plegados.9') ?? '{}')).toEqual({ procesos: true });

    // Al ir a una sección de ese grupo se despliega aunque se hubiera plegado.
    await harness.navigateByUrl('/gestion/o/117/eventos');
    harness.detectChanges();
    expect(titulo('procesos').getAttribute('aria-expanded')).toBe('true');
    expect(titulo('procesos').disabled).toBeTrue();
    try { localStorage.removeItem('simus.panel.grupos-plegados.9'); } catch { /* sin almacenamiento */ }
  });

  it('en pantalla estrecha la navegación pasa a la barra inferior: cuatro destinos y «Más» con el resto', async () => {
    sesion.respuesta = SESION;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    try {
      const elemento = await montar('/gestion/o/117/equipo');
      const barra = elemento.querySelector<HTMLElement>('nav[aria-label="Secciones principales"]')!;
      expect(Array.from(barra.querySelectorAll('a')).map(a => a.textContent?.trim().split(',')[0])).toEqual(['Inicio', 'Solicitudes', 'Procesos', 'Eventos']);
      expect(elemento.querySelector('.sidebar-disparador')).toBeNull();

      const mas = elemento.querySelector<HTMLButtonElement>('[data-testid="boton-mas"]')!;
      expect(mas.getAttribute('aria-current')).toBe('page');
      expect(mas.getAttribute('aria-expanded')).toBe('false');
      mas.click();
      harness.detectChanges();
      expect(mas.getAttribute('aria-expanded')).toBe('true');
      const hoja = elemento.querySelector<HTMLElement>('[role="dialog"][aria-label="Más secciones"]')!;
      expect(hoja.textContent).toContain('Equipo');
      expect(hoja.textContent).toContain('Ver el portal público');
      expect(hoja.textContent).not.toContain('Solicitudes');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    }
  });

  it('«Registrar otra organización» ya no está en el panel: vive solo en Mi espacio → Mis organizaciones (seguimiento de ACC2)', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar();

    expect(elemento.querySelector('[data-testid="registrar-otra-organizacion"]')).toBeNull();
    expect(elemento.textContent).not.toContain('Registrar otra organización');
    // El selector de organización sigue ahí para quien tiene varias.
    expect(elemento.querySelector('#selector-organizacion')).not.toBeNull();
  });

  it('el selector navega a la MISMA sección de la otra organización y el armazón se reconstruye', async () => {
    sesion.respuesta = SESION;
    await montar('/gestion/o/117/procesos');
    const armazon = harness.routeDebugElement!.componentInstance;

    await elegirEnElSelector('1117');

    expect(router().url).toBe('/gestion/o/1117/procesos');
    expect(store().organizacionId()).toBe('1117');
    expect(harness.routeDebugElement!.componentInstance).not.toBe(armazon);
    expect(raiz().querySelector('[data-testid="nombre-organizacion-activa"]')?.textContent).toContain('Corporación Tambó');
  });

  it('desde la ficha de un Festival, cambiar de organización lleva a la lista de Festivales de la otra', async () => {
    sesion.respuesta = SESION;
    await montar('/gestion/o/117/procesos/festivales/92');

    await elegirEnElSelector('1117');

    // El Festival 92 es de la primera organización: no se abre «el mismo» en la otra.
    expect(router().url).toBe('/gestion/o/1117/procesos/festivales');
  });

  it('con un asistente a medias pregunta antes y, si la persona se queda, nada cambia', async () => {
    sesion.respuesta = SESION;
    await montar('/gestion/o/117/procesos/festivales/nuevo');
    const cambio = TestBed.inject(ConfirmacionDeCambioDeOrganizacion);

    const selector = raiz().querySelector<HTMLSelectElement>('#selector-organizacion')!;
    selector.value = '1117';
    selector.dispatchEvent(new Event('change'));
    // NO SE ESPERA A `whenStable`: la navegación sigue pendiente hasta que la persona responda.
    await new Promise(resolver => setTimeout(resolver));
    harness.detectChanges();

    const dialogo = raiz().querySelector('[data-testid="confirmar-cambio-de-organizacion"]');
    expect(dialogo).withContext('no se preguntó').not.toBeNull();
    expect(dialogo?.textContent).toContain('borrador de «Fundación Musical del Valle»');
    expect(dialogo?.textContent).toContain('no pasará a «Corporación Tambó»');
    // El selector no se queda diciendo otra organización que la de la URL.
    expect(selector.value).toBe('117');

    (raiz().querySelector('[data-testid="seguir-en-la-organizacion"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(cambio.pendiente()).toBeNull();
    expect(router().url).toBe('/gestion/o/117/procesos/festivales/nuevo');
    expect(store().organizacionId()).toBe('117');
    expect(AsistenteDePruebaComponent.instancias).toBe(1);
  });

  it('si la persona confirma, guarda lo pendiente como de ESTA organización y abre la otra sin trasladar nada', async () => {
    sesion.respuesta = SESION;
    await montar('/gestion/o/117/procesos/festivales/nuevo');

    const selector = raiz().querySelector<HTMLSelectElement>('#selector-organizacion')!;
    selector.value = '1117';
    selector.dispatchEvent(new Event('change'));
    await new Promise(resolver => setTimeout(resolver));
    harness.detectChanges();
    (raiz().querySelector('[data-testid="confirmar-cambio"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    await new Promise(resolver => setTimeout(resolver));
    harness.detectChanges();

    expect(AsistenteDePruebaComponent.guardadoAntesDeSalir).toBe(1);
    expect(router().url).toBe('/gestion/o/1117/procesos/festivales');
    expect(store().organizacionId()).toBe('1117');
  });

  it('recuerda la organización abierta para las direcciones que no dicen cuál', async () => {
    sesion.respuesta = SESION;
    await montar('/gestion/o/1117/resumen');

    expect(TestBed.inject(ContextoDeOrganizacionService).porDefecto()?.id).toBe('1117');
  });

  it('muestra identidad, ubicación real y actualización, sin estados o enlaces que no tienen función', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar();

    expect(elemento.textContent).toContain('Fundación Musical del Valle');
    expect(elemento.textContent).toContain('Bogotá, D. C.');
    expect(elemento.textContent).not.toContain('Medellín, Antioquia');
    expect(elemento.textContent).not.toContain('Organización activa');
    // La descripción y la fecha de actualización viven en la pantalla de Datos, no repetidas en el armazón (PANEL).
    expect(elemento.textContent).not.toContain('Última actualización:');
    expect(elemento.textContent).not.toContain('sin_definir');
  });

  it('recién registrada, dice que ahora la administras y cuáles son los siguientes pasos', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar('/gestion/o/117/resumen?registrada=1');
    const bienvenida = elemento.querySelector('[data-testid="bienvenida-organizacion"]');

    expect(bienvenida?.textContent).toContain('Registraste «Fundación Musical del Valle»');
    expect(Array.from(bienvenida!.querySelectorAll('a')).map(a => a.getAttribute('href')))
      .toEqual(['/gestion/o/117/organizacion', '/gestion/o/117/equipo', '/gestion/o/117/procesos']);
  });

  it('tras aceptar una invitación, da la bienvenida con el rol: «Te uniste a X como editor»', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar('/gestion/o/117/resumen?unido=editor');
    const bienvenida = elemento.querySelector('[data-testid="bienvenida-invitacion"]');

    expect(bienvenida?.textContent).toContain('Te uniste a «Fundación Musical del Valle» como editora o editor');
    expect(bienvenida?.textContent).toContain('borradores');
  });

  it('un rol inventado en la dirección no pinta ninguna bienvenida', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar('/gestion/o/117/resumen?unido=dios');

    expect(elemento.querySelector('[data-testid="bienvenida-invitacion"]')).toBeNull();
  });

  it('enseña una vez el aviso de cambio que dejó una ficha de otra organización', async () => {
    sesion.respuesta = SESION;
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/gestion/o/117/resumen');
    store().avisoDeCambio.set('Este Festival es de «Corporación Tambó»: cambiamos a esa organización.');
    await harness.navigateByUrl('/gestion/o/1117/procesos/festivales/92');
    harness.detectChanges();

    expect(raiz().querySelector('[data-testid="aviso-cambio-de-organizacion"]')?.textContent).toContain('cambiamos a esa organización');
    expect(store().avisoDeCambio()).toBe('');
  });

  it('lleva un aviso de ajustes a la ficha EN la organización abierta y conserva los informativos sin enlace', async () => {
    sesion.respuesta = SESION;
    notificaciones = [
      { id: '1', recipientUserId: '9', recipientEmail: 'ana@fmv.org', eventType: 'FestivalCambiosPedidosPorCampo', channel: 'internal', title: 'Festival con ajustes solicitados', body: 'Revisa los ajustes.', status: 'enviada', moduleId: 'festivales', recordId: '92', createdAt: '2026-09-09T12:00:00Z', sentAt: null, readAt: null },
      { id: '2', recipientUserId: '9', recipientEmail: 'ana@fmv.org', eventType: 'FestivalEnviadoARevision', channel: 'internal', title: 'Festival enviado', body: 'La revisión comenzó.', status: 'enviada', moduleId: 'festivales', recordId: '92', createdAt: '2026-09-09T11:00:00Z', sentAt: null, readAt: null },
    ];
    notificacionesEnVivo.pagina.next({ items: notificaciones, limit: 50, offset: 0, total: 2 });
    const elemento = await montar();
    (elemento.querySelector('[data-testid="campana-avisos"]') as HTMLButtonElement).click();
    harness.detectChanges();

    const enlace = elemento.querySelector<HTMLAnchorElement>('a[href^="/gestion/o/117/procesos/festivales/92?"]');
    expect(enlace).not.toBeNull();
    expect(enlace?.textContent).toContain('Resolver ajustes');
    expect(enlace?.href).toContain('seccion=informacion');
    expect(enlace?.href).toContain('ajustes=1');
    expect(elemento.querySelectorAll('[data-testid="panel-avisos"] a').length).toBe(1);
  });

  it('con varias organizaciones, cada aviso que sabe de cuál es lo dice y la abre', async () => {
    sesion.respuesta = SESION;
    notificaciones = [
      { id: '5', recipientUserId: '9', recipientEmail: 'ana@fmv.org', eventType: 'FestivalAjustesSolicitados', channel: 'internal', title: 'Ajustes', body: 'Revisa.', status: 'enviada', moduleId: 'festivales', recordId: '40', createdAt: '2026-09-09T12:00:00Z', sentAt: null, readAt: null, metadataJson: '{"OrganizacionPrincipalId":1117}' },
    ];
    notificacionesEnVivo.pagina.next({ items: notificaciones, limit: 50, offset: 0, total: 1 });
    const elemento = await montar();
    (elemento.querySelector('[data-testid="campana-avisos"]') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(elemento.querySelector('[data-testid="aviso-organizacion"]')?.textContent).toContain('Corporación Tambó');
    expect(elemento.querySelector('a[href^="/gestion/o/1117/procesos/festivales/40?"]')).not.toBeNull();
  });

  it('incorpora un aviso nuevo mientras la página permanece abierta', async () => {
    sesion.respuesta = SESION;
    const elemento = await montar();
    expect(elemento.querySelector('[data-testid="campana-contador"]')).toBeNull();

    notificacionesEnVivo.pagina.next({
      items: [{ id: '3', recipientUserId: '9', recipientEmail: 'ana@fmv.org', eventType: 'FestivalCambiosPedidosPorCampo', channel: 'internal', title: 'Nuevas sugerencias', body: 'Revisa un campo.', status: 'enviada', moduleId: 'festivales', recordId: '92', createdAt: '2026-09-09T13:00:00Z', sentAt: null, readAt: null }],
      limit: 50, offset: 0, total: 1,
    });
    harness.detectChanges();

    expect(elemento.querySelector('[data-testid="campana-contador"]')?.textContent).toContain('1');
  });
});
