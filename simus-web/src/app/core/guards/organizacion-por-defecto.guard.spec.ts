import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ExternalSessionService, SesionExterna } from '../services/external-session.service';
import { ContextoDeOrganizacionService } from '../services/contexto-de-organizacion.service';
import { emparejaSeccionSinOrganizacion, haciaLaOrganizacionPorDefecto } from './organizacion-por-defecto.guard';
import { routes } from '../../app.routes';

@Component({ standalone: true, template: 'Pantalla' })
class PantallaComponent {}

const SESION: SesionExterna = {
  userId: '9', fullName: 'Ana Restrepo', email: 'ana@fmv.org', accountStatus: 'activa',
  organizations: [
    { id: '117', name: 'Fundación Musical del Valle', role: 'administrador' },
    { id: '1117', name: 'Corporación Tambó', role: 'editor' },
  ],
};

/** Las mismas redirecciones que `app.routes.ts`, con pantallas de prueba. */
const RUTAS: Routes = [{
  path: 'gestion',
  children: [
    { path: '', pathMatch: 'full', canActivate: [haciaLaOrganizacionPorDefecto], children: [] },
    { path: 'cuenta', children: [{ path: '**', component: PantallaComponent }] },
    { path: 'o/:organizacionId', children: [{ path: '**', component: PantallaComponent }] },
    { path: 'cuenta-seguridad', redirectTo: 'cuenta/seguridad' },
    { path: 'perfil-publico', redirectTo: 'cuenta/perfil-publico' },
    { path: 'registrar-organizacion', redirectTo: 'cuenta/organizaciones/registrar' },
    { matcher: emparejaSeccionSinOrganizacion, canActivate: [haciaLaOrganizacionPorDefecto], children: [] },
  ],
}];

describe('direcciones de /gestion sin organización', () => {
  const sesion = signal<SesionExterna | null>(SESION);

  beforeEach(() => {
    sesion.set(SESION);
    try { localStorage.removeItem('simus.gestion.ultimaOrganizacion.9'); } catch { /* sin almacenamiento */ }
    TestBed.configureTestingModule({
      providers: [
        provideRouter(RUTAS),
        {
          provide: ExternalSessionService,
          useValue: { actual: sesion.asReadonly(), organizaciones: computed(() => sesion()?.organizations ?? []), dentro: () => sesion() !== null },
        },
      ],
    });
  });

  afterEach(() => {
    try { localStorage.removeItem('simus.gestion.ultimaOrganizacion.9'); } catch { /* sin almacenamiento */ }
  });

  let harness: RouterTestingHarness | null = null;
  beforeEach(() => { harness = null; });

  async function ir(url: string): Promise<string> {
    harness ??= await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url;
  }

  it('/gestion abre el Resumen de la primera organización', async () => {
    expect(await ir('/gestion')).toBe('/gestion/o/117/resumen');
  });

  it('una dirección antigua conserva la sección, los parámetros y el fragmento', async () => {
    expect(await ir('/gestion/procesos/festivales/92?seccion=informacion&ajustes=1'))
      .toBe('/gestion/o/117/procesos/festivales/92?seccion=informacion&ajustes=1');
    // La herramienta de procesos históricos SIN un Festival pedido (decisión 74) es una sección más de la organización por omisión.
    expect(await ir('/gestion/herramientas/procesos-historicos')).toBe('/gestion/o/117/herramientas/procesos-historicos');
    expect(await ir('/gestion/solicitudes?solicitud=4&accion=aclarar')).toBe('/gestion/o/117/solicitudes?solicitud=4&accion=aclarar');
  });

  it('va a la última organización abierta si sigue siendo de la cuenta', async () => {
    TestBed.inject(ContextoDeOrganizacionService).recordar('1117');
    expect(await ir('/gestion/equipo')).toBe('/gestion/o/1117/equipo');
  });

  it('si la cuenta ya no está en la última organización, va a la primera', async () => {
    TestBed.inject(ContextoDeOrganizacionService).recordar('555');
    expect(await ir('/gestion')).toBe('/gestion/o/117/resumen');
  });

  it('sin organizaciones, la persona va a su espacio y no a una pantalla de bloqueo', async () => {
    sesion.set({ ...SESION, organizations: [] });
    expect(await ir('/gestion')).toBe('/gestion/cuenta');
    expect(await ir('/gestion/resumen')).toBe('/gestion/cuenta');
  });

  it('«pedir la administración» con varias organizaciones SE PREGUNTA SIEMPRE con cuál, nunca una por omisión (decisión 90)', async () => {
    // Aunque la última abierta sea la 1117, no se manda a ella: la elección es de la persona.
    try { localStorage.setItem('simus.gestion.ultimaOrganizacion.9', '1117'); } catch { /* sin almacenamiento */ }
    expect(await ir('/gestion/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco'))
      .toBe('/gestion/cuenta/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco');
  });

  it('un enlace de antes con ?reclamar= y sin organización también pregunta con cuál (decisión 90)', async () => {
    expect(await ir('/gestion/procesos/festivales?reclamar=107&buscar=Bambuco'))
      .toBe('/gestion/cuenta/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco');
    // Sin ?reclamar= la lista de Festivales sigue yendo a la organización por omisión.
    expect(await ir('/gestion/procesos/festivales')).toBe('/gestion/o/117/procesos/festivales');
  });

  it('la ruta de antes («festivales-historicos») sigue valiendo y lleva a la de procesos históricos (decisión 129)', async () => {
    expect(await ir('/gestion/herramientas/festivales-historicos?reclamar=107&buscar=Bambuco'))
      .toBe('/gestion/cuenta/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco');
    // Sin ?reclamar= la guarda solo antepone la organización; la ruta de antes redirige después, en el enrutador.
    expect(await ir('/gestion/herramientas/festivales-historicos')).toBe('/gestion/o/117/herramientas/festivales-historicos');
  });

  it('«pedir la administración» con UNA sola organización la usa (decisión 90)', async () => {
    sesion.set({ ...SESION, organizations: [{ id: '117', name: 'Fundación Musical del Valle', role: 'administrador' }] });
    expect(await ir('/gestion/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco'))
      .toBe('/gestion/o/117/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco');
  });

  it('«pedir la administración» de un histórico sin organización lleva a la herramienta de la persona, con el Festival (D3-10, decisión 74)', async () => {
    sesion.set({ ...SESION, organizations: [] });
    expect(await ir('/gestion/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco'))
      .toBe('/gestion/cuenta/herramientas/procesos-historicos?reclamar=107&buscar=Bambuco');
  });

  it('/gestion/responsable lleva al bloque de la persona responsable en Datos de la organización', async () => {
    expect(await ir('/gestion/responsable')).toBe('/gestion/o/117/organizacion#responsable');
  });

  it('lo de la persona va a su espacio', async () => {
    expect(await ir('/gestion/cuenta-seguridad')).toBe('/gestion/cuenta/seguridad');
    expect(await ir('/gestion/perfil-publico')).toBe('/gestion/cuenta/perfil-publico');
    expect(await ir('/gestion/registrar-organizacion')).toBe('/gestion/cuenta/organizaciones/registrar');
  });

  it('la configuración real declara la organización en la URL, el espacio de la persona y las redirecciones', () => {
    const gestion = routes.find(ruta => ruta.path === 'gestion')!;
    const hijas = gestion.children ?? [];
    const por = (camino: string): Route | undefined => hijas.find(ruta => ruta.path === camino);

    expect(por('o/:organizacionId')?.loadComponent).withContext('falta el panel con organización').toBeTruthy();
    expect(por('cuenta')?.loadComponent).withContext('falta el espacio de la persona').toBeTruthy();
    expect(por('')?.canActivate).toContain(haciaLaOrganizacionPorDefecto);
    expect(hijas.some(ruta => ruta.matcher === emparejaSeccionSinOrganizacion && ruta.canActivate?.includes(haciaLaOrganizacionPorDefecto))).toBeTrue();
    expect(por('cuenta-seguridad')?.redirectTo).toBe('cuenta/seguridad');
    expect(por('perfil-publico')?.redirectTo).toBe('cuenta/perfil-publico');
    expect(por('registrar-organizacion')?.redirectTo).toBe('cuenta/organizaciones/registrar');
    // Los asistentes preguntan antes de cambiar de organización con algo escrito.
    const panel = por('o/:organizacionId')!.children ?? [];
    const festivales = panel.find(ruta => ruta.path === 'procesos/festivales')!.children!;
    const mercados = panel.find(ruta => ruta.path === 'procesos/mercados')!.children!;
    expect(festivales.find(ruta => ruta.path === 'nuevo')?.canDeactivate?.length).toBe(1);
    expect(mercados.find(ruta => ruta.path === 'nuevo')?.canDeactivate?.length).toBe(1);
  });
});
