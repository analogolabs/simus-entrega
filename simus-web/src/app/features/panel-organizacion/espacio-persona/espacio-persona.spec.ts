import { SolicitudesDeLaCuentaService } from '../solicitudes/solicitudes-de-la-cuenta.service';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ExternalSessionService, SesionExterna } from '../../../core/services/external-session.service';
import { NotificacionesEnVivoService, PaginaDeNotificacionesEnVivo } from '../../../core/services/notificaciones-en-vivo.service';
import { ConfirmacionDeCorreoService } from '../../../core/services/confirmacion-de-correo.service';
import { PanelOrganizacionApi } from '../panel-organizacion.api';
import { CuentaExternaApi, InvitacionesDeLaCuenta, PerfilDeCuenta } from '../cuenta-externa.api';
import { MiPerfilPublico, PerfilPublicoService } from '../../../core/services/perfil-publico.service';
import { EspacioPersonaPageComponent } from './espacio-persona-page.component';
import { MiEspacioComponent } from './mi-espacio.component';
import { MisOrganizacionesComponent } from './mis-organizaciones.component';

const INDIVIDUAL: SesionExterna = {
  userId: '30', fullName: 'Lucía Mosquera', email: 'lucia@example.com', accountStatus: 'activa', organizations: [],
};

const CON_ORGANIZACIONES: SesionExterna = {
  ...INDIVIDUAL,
  organizations: [
    { id: '117', name: 'Fundación Musical del Valle', role: 'administrador' },
    { id: '1117', name: 'Corporación Tambó', role: 'editor' },
  ],
};

const DATOS_COMPLETOS: PerfilDeCuenta = {
  email: 'lucia@example.com', tipoPerfil: 'individual', primerNombre: 'Lucía', segundoNombre: null, primerApellido: 'Mosquera',
  segundoApellido: null, tipoDocumento: 'cc', numeroDocumento: '1020304050', telefono: null,
};

const SIN_PERFIL_PUBLICO: MiPerfilPublico = {
  existe: false, clave: null, nombreVisible: '', idsPracticas: [], codigoMunicipio: null, archivoFotoId: null, fotoUrl: null, enlaces: [],
  autorizacionVigente: false, ocultoPorModeracion: false, motivoModeracion: null, visible: false, organizaciones: [],
};

const RUTAS: Routes = [{
  path: 'gestion/cuenta',
  component: EspacioPersonaPageComponent,
  children: [
    { path: '', pathMatch: 'full', component: MiEspacioComponent },
    { path: 'organizaciones', component: MisOrganizacionesComponent },
  ],
}];

describe('Espacio «Persona»', () => {
  const sesion = signal<SesionExterna | null>(INDIVIDUAL);
  let invitaciones: InvitacionesDeLaCuenta | 'falla';
  let solicitudesFallan = false;
  let datosDeLaCuenta: PerfilDeCuenta;
  let perfilPublico: MiPerfilPublico;
  let harness: RouterTestingHarness | undefined;

  beforeEach(() => {
    harness = undefined;
    solicitudesFallan = false;
    sesion.set(INDIVIDUAL);
    invitaciones = { correoSinConfirmar: false, pendientes: [] };
    datosDeLaCuenta = DATOS_COMPLETOS;
    perfilPublico = SIN_PERFIL_PUBLICO;
    TestBed.configureTestingModule({
      providers: [
        provideRouter(RUTAS),
        {
          provide: ExternalSessionService,
          useValue: {
            actual: sesion.asReadonly(),
            organizaciones: computed(() => sesion()?.organizations ?? []),
            dentro: () => sesion() !== null,
            refrescar: () => of(sesion()),
          },
        },
        { provide: ConfirmacionDeCorreoService, useValue: { asegurar: () => Promise.resolve() } },
        {
          provide: NotificacionesEnVivoService,
          useValue: { observar: () => new BehaviorSubject<PaginaDeNotificacionesEnVivo>({ items: [], limit: 50, offset: 0, total: 0 }) },
        },
        { provide: PanelOrganizacionApi, useValue: {} },
        {
          provide: CuentaExternaApi,
          useValue: {
            invitacionesPendientes: () => (invitaciones === 'falla' ? throwError(() => ({ message: 'Sin red.' })) : of(invitaciones)),
            obtenerPerfil: () => of(datosDeLaCuenta),
          },
        },
        { provide: PerfilPublicoService, useValue: { mio: () => of(perfilPublico) } },
        { provide: SolicitudesDeLaCuentaService, useValue: { deLaCuenta: () => (solicitudesFallan ? throwError(() => ({ status: 500, message: 'Falla del servidor' })) : of([])) } },
      ],
    });
  });

  async function montar(url: string): Promise<HTMLElement> {
    harness ??= await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('una cuenta sin organización ve SU espacio: navegación lateral por grupos, sin «Organización» ni pestañas de organización', async () => {
    const raiz = await montar('/gestion/cuenta');

    expect(raiz.querySelector('[data-testid="nombre-de-la-persona"]')?.textContent).toContain('Lucía Mosquera');
    expect(raiz.textContent).not.toMatch(/ORGANIZACIÓN|Datos de la organización|Registrar otra organización/);
    expect(raiz.querySelector('[aria-label="Secciones del panel de la organización"]')).toBeNull();
    const enlaces = Array.from(raiz.querySelectorAll('[aria-label="Secciones de tu cuenta"] a'));
    expect(enlaces.map(a => a.textContent?.trim())).toEqual([
      'Inicio', 'Mi actividad y solicitudes',
      'Procesos', 'Mis eventos',
      'Perfil público', 'Datos personales', 'Contraseña y seguridad', 'Mis autorizaciones', 'Mis organizaciones', 'Agenda de citas',
    ]);
    expect(enlaces.map(a => a.getAttribute('href'))).toEqual([
      '/gestion/cuenta', '/gestion/cuenta/solicitudes',
      '/gestion/cuenta/procesos', '/gestion/cuenta/eventos',
      '/gestion/cuenta/perfil-publico', '/gestion/cuenta/datos', '/gestion/cuenta/seguridad', '/gestion/cuenta/autorizaciones', '/gestion/cuenta/organizaciones', '/gestion/cuenta/agenda-de-citas',
    ]);
    // Los grupos son los del panel de la organización (PANEL, decisión 126): Trabajo, Mis procesos y lo propio de la cuenta.
    const grupos = Array.from(raiz.querySelectorAll('[aria-label="Secciones de tu cuenta"] .sidebar-grupo-titulo')).map(p => p.textContent?.trim());
    expect(grupos).toEqual(['Trabajo', 'Mis procesos', 'Mi cuenta']);
    // La página activa se anuncia: es el inicio.
    expect(raiz.querySelector('[aria-label="Secciones de tu cuenta"] a[aria-current="page"]')?.textContent?.trim()).toBe('Inicio');
    // La campana también está: el primer aviso es confirmar el correo.
    expect(raiz.querySelector('[data-testid="campana-avisos"]')).not.toBeNull();
  });

  it('con el correo confirmado y los datos completos NO se pinta el estado de la cuenta: no da la sensación de que falta algo', async () => {
    const raiz = await montar('/gestion/cuenta');

    expect(raiz.querySelector('[data-testid="estado-de-la-cuenta"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="avance-de-la-cuenta"]')).toBeNull();
    expect(raiz.textContent).not.toContain('Hecho');
    expect(Array.from(raiz.querySelectorAll('h1')).map(h => h.textContent?.trim())).toEqual(['Inicio']);
  });

  it('lo que falta se marca por hacer y lleva a la pantalla que lo resuelve', async () => {
    invitaciones = { correoSinConfirmar: true, pendientes: [] };
    datosDeLaCuenta = { ...DATOS_COMPLETOS, numeroDocumento: '' };
    const raiz = await montar('/gestion/cuenta');

    expect(raiz.querySelector('[data-testid="avance-de-la-cuenta"]')?.textContent).toContain('0 de 2 pasos de la cuenta');
    const correo = raiz.querySelector('[data-testid="paso-correo"]')!;
    expect(correo.textContent).toContain('Por hacer');
    expect(correo.querySelector('a')?.getAttribute('href')).toBe('/gestion/cuenta/seguridad');
    const datos = raiz.querySelector('[data-testid="paso-datos"]')!;
    expect(datos.textContent).toContain('Faltan datos obligatorios');
    expect(datos.querySelector('a')?.getAttribute('href')).toBe('/gestion/cuenta/datos');
  });

  it('un perfil público publicado se dice en el acceso rápido: «Editar mi perfil público»', async () => {
    perfilPublico = { ...SIN_PERFIL_PUBLICO, existe: true, visible: true, autorizacionVigente: true };
    const raiz = await montar('/gestion/cuenta');

    expect(raiz.querySelector('[data-testid="paso-perfil"]')).toBeNull();
    expect(raiz.textContent).toContain('Editar mi perfil público');
  });

  it('un perfil público ocultado por la consola lo dice', async () => {
    perfilPublico = { ...SIN_PERFIL_PUBLICO, existe: true, ocultoPorModeracion: true, motivoModeracion: 'Foto inapropiada' };
    datosDeLaCuenta = { ...DATOS_COMPLETOS, numeroDocumento: '' };
    const raiz = await montar('/gestion/cuenta');

    expect(raiz.querySelector('[data-testid="paso-perfil"]')?.textContent).toContain('La consola lo ocultó');
  });

  it('un perfil público guardado y sin publicar lo dice', async () => {
    perfilPublico = { ...SIN_PERFIL_PUBLICO, existe: true };
    datosDeLaCuenta = { ...DATOS_COMPLETOS, numeroDocumento: '' };
    const raiz = await montar('/gestion/cuenta');

    expect(raiz.querySelector('[data-testid="paso-perfil"]')?.textContent).toContain('no lo has publicado');
  });

  it('tras registrarse da la bienvenida, sin prometer «trayectoria»', async () => {
    const raiz = await montar('/gestion/cuenta?bienvenida=1');
    const bienvenida = raiz.querySelector('[data-testid="bienvenida-cuenta"]')!;

    expect(bienvenida.textContent).toContain('Tu cuenta está lista');
    expect(raiz.textContent).not.toContain('trayectoria');
  });

  it('sin organización lo explica y ofrece registrarla; con organizaciones, accesos a sus paneles con el rol', async () => {
    let raiz = await montar('/gestion/cuenta');
    expect(raiz.querySelector('[data-testid="sin-organizaciones"]')?.textContent).toContain('Todavía no participas');
    expect(raiz.querySelector('[data-testid="registrar-organizacion-resumen"]')?.getAttribute('href')).toBe('/gestion/cuenta/organizaciones/registrar');
    // Decisión 74: quien aún no tiene organización puede mirar si su Festival ya estaba en SIMUS.
    expect(raiz.querySelector('[data-testid="mi-espacio-procesos-historicos"]')?.getAttribute('href')).toBe('/gestion/cuenta/herramientas/procesos-historicos');

    sesion.set(CON_ORGANIZACIONES);
    raiz = await montar('/gestion/cuenta');
    expect(raiz.querySelector('[data-testid="sin-organizaciones"]')).toBeNull();
    const resumen = raiz.querySelector('[data-testid="resumen-de-organizaciones"]')!;
    expect(Array.from(resumen.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(href => href?.startsWith('/gestion/o/')))
      .toEqual(['/gestion/o/117/resumen', '/gestion/o/1117/resumen']);
    expect(resumen.textContent).toContain('Administrador');
    expect(resumen.textContent).toContain('Editor');
    expect(resumen.textContent).toContain('Participas en 2 organizaciones');
  });

  it('el resumen ofrece lo que se registra con la cuenta, sin organización', async () => {
    const raiz = await montar('/gestion/cuenta');
    const procesos = raiz.querySelector('[data-testid="resumen-de-procesos"]')!;

    expect(Array.from(procesos.querySelectorAll('a')).map(a => a.getAttribute('href')))
      .toEqual(['/gestion/cuenta/talleres', '/gestion/cuenta/espacios', '/gestion/cuenta/redes']);
  });

  it('el resumen avisa de las invitaciones pendientes', async () => {
    invitaciones = { correoSinConfirmar: false, pendientes: [{ id: '4', organizacionId: '205', organizacion: 'Colectivo del Pacífico', rol: 'editor', fechaExpiracion: '2026-11-12T00:00:00Z' }] };
    const raiz = await montar('/gestion/cuenta');

    expect(raiz.querySelector('[data-testid="invitaciones-del-resumen"]')?.textContent).toContain('1 invitación pendiente');
  });

  it('«Mis organizaciones» lista cada una con su rol y su panel, y el camino para registrar otra', async () => {
    sesion.set(CON_ORGANIZACIONES);
    const raiz = await montar('/gestion/cuenta/organizaciones');
    const lista = raiz.querySelector('[data-testid="lista-de-organizaciones"]')!;

    expect(lista.textContent).toContain('Fundación Musical del Valle');
    expect(lista.textContent).toContain('Administras esta organización');
    expect(lista.textContent).toContain('Editas en esta organización');
    expect(Array.from(lista.querySelectorAll('a')).map(a => a.getAttribute('href'))).toEqual(['/gestion/o/117/resumen', '/gestion/o/1117/resumen']);
    expect(raiz.querySelector('[data-testid="registrar-organizacion"]')?.getAttribute('href')).toBe('/gestion/cuenta/organizaciones/registrar');
  });

  it('enseña las invitaciones pendientes y explica cómo aceptarlas', async () => {
    invitaciones = { correoSinConfirmar: false, pendientes: [{ id: '4', organizacionId: '205', organizacion: 'Colectivo del Pacífico', rol: 'editor', fechaExpiracion: '2026-11-12T00:00:00Z' }] };
    const raiz = await montar('/gestion/cuenta/organizaciones');

    expect(raiz.querySelector('[data-testid="sin-organizaciones"]')).not.toBeNull();
    const pendientes = raiz.querySelector('[data-testid="invitaciones-pendientes"]')!;
    expect(pendientes.textContent).toContain('Colectivo del Pacífico');
    expect(pendientes.textContent).toContain('editora o editor');
    expect(raiz.textContent).toContain('lucia@example.com');
    expect(raiz.textContent).toContain('abre el enlace de la invitación');
  });

  it('sin el correo confirmado lo dice, en lugar de decir que no hay invitaciones', async () => {
    invitaciones = { correoSinConfirmar: true, pendientes: [] };
    const raiz = await montar('/gestion/cuenta/organizaciones');

    expect(raiz.textContent).toContain('Confirma tu correo para ver aquí las invitaciones');
    expect(raiz.textContent).not.toContain('No tienes invitaciones pendientes');
  });

  it('un fallo al consultar las invitaciones se dice', async () => {
    invitaciones = 'falla';
    const raiz = await montar('/gestion/cuenta/organizaciones');

    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('Sin red.');
  });

  it('el inicio de Mi espacio no trata una caída del API como «no tienes nada»: muestra el error con su motivo y Reintentar', async () => {
    solicitudesFallan = true;
    const raiz = await montar('/gestion/cuenta');

    const error = raiz.querySelector('[data-testid="mi-espacio-error"]');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('500');
    expect(error?.querySelector('button')?.textContent).toContain('Reintentar');

    solicitudesFallan = false;
    (error?.querySelector('button') as HTMLButtonElement).click();
    harness!.detectChanges();
    expect(raiz.querySelector('[data-testid="mi-espacio-error"]')).toBeNull();
  });

  it('sin fallas el inicio no pinta aviso de error', async () => {
    const raiz = await montar('/gestion/cuenta');
    expect(raiz.querySelector('[data-testid="mi-espacio-error"]')).toBeNull();
  });
});
