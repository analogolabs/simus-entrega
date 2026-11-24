import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlSegment, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { emparejaLaConsolaAdministrativa } from '../../../app.routes';
import { FichaDeConsola } from '../domain/ficha-de-consola';
import { AdminShellPageComponent } from './admin-shell-page.component';

/**
 * LAS FICHAS DE LA CONSOLA TIENEN DIRECCIÓN PROPIA.
 *
 * Se prueba el enrutador de verdad —el emparejador de `app.routes.ts` con el armazón montado—:
 * abrir una ficha por enlace, recargar, volver con «Atrás» y el enlace antiguo `?revisar=`.
 */
describe('la consola · emparejador de rutas', () => {
  const segmentos = (...rutas: string[]) => rutas.map(ruta => new UrlSegment(ruta, {}));

  it('empareja la consola, su sección, una ficha y la vista de la ficha', () => {
    expect(emparejaLaConsolaAdministrativa(segmentos('administracion'))?.posParams).toBeUndefined();
    expect(emparejaLaConsolaAdministrativa(segmentos('administracion', 'festivales'))?.posParams?.['seccion'].path).toBe('festivales');

    const ficha = emparejaLaConsolaAdministrativa(segmentos('administracion', 'festivales', '173'));
    expect(ficha?.posParams?.['seccion'].path).toBe('festivales');
    expect(ficha?.posParams?.['id'].path).toBe('173');

    const vista = emparejaLaConsolaAdministrativa(segmentos('administracion', 'solicitudes', 'review-festivals-173', 'ficha'));
    expect(vista?.posParams?.['id'].path).toBe('review-festivals-173');
    expect(vista?.posParams?.['vista'].path).toBe('ficha');
  });

  it('no empareja lo que no es la consola ni más de cuatro segmentos', () => {
    expect(emparejaLaConsolaAdministrativa(segmentos('gestion', 'o', '1'))).toBeNull();
    expect(emparejaLaConsolaAdministrativa(segmentos('administracion', 'a', 'b', 'c', 'd'))).toBeNull();
    expect(emparejaLaConsolaAdministrativa([])).toBeNull();
  });
});

describe('la consola · ficha en la dirección', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let ficha: FichaDeConsola;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ matcher: emparejaLaConsolaAdministrativa, component: AdminShellPageComponent }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    ficha = TestBed.inject(FichaDeConsola);
    // Sin esto el enrutador no escucha «Atrás» y «Adelante»: en la aplicación lo hace al arrancar.
    TestBed.inject(Router).setUpLocationChangeListener();
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.match(() => true);
    ficha.fijar(null);
  });

  async function ir(url: string): Promise<AdminShellPageComponent> {
    return harness.navigateByUrl(url, AdminShellPageComponent);
  }

  /** Espera a que se cumpla algo que depende de una navegación del navegador (atrás, adelante). */
  async function esperar(condicion: () => boolean): Promise<void> {
    for (let intento = 0; intento < 40 && !condicion(); intento++) {
      await new Promise(resolver => setTimeout(resolver, 25));
    }
  }

  it('un enlace a un Festival abre su ficha, en la sección de Festivales', async () => {
    const consola = await ir('/administracion/festivales/173');

    expect(consola.activeSection()).toBe('ecosistema');
    expect(consola.fichaDeFestival()).toBe('173');
    expect(ficha.id()).toBe('173');
    expect(consola.fichaDeMercado()).toBeNull();
  });

  it('un enlace a un Mercado y a una organización abren su ficha, cada una en su sección', async () => {
    let consola = await ir('/administracion/mercados/9');
    expect(consola.activeSection()).toBe('mercados');
    expect(consola.fichaDeMercado()).toBe('9');
    expect(consola.fichaDeFestival()).toBeNull();

    consola = await ir('/administracion/organizaciones/55');
    expect(consola.activeSection()).toBe('organizaciones');
    expect(consola.organizacionPedida()).toBe('55');
    expect(consola.fichaDeMercado()).toBeNull();
  });

  it('los perfiles públicos de personas son una pestaña de Organizaciones con dirección propia', async () => {
    let consola = await ir('/administracion/organizaciones');
    expect(consola.enPerfilesDePersonas()).toBeFalse();

    consola = await ir('/administracion/organizaciones?vista=personas');
    expect(consola.activeSection()).toBe('organizaciones');
    expect(consola.enPerfilesDePersonas()).toBeTrue();
    // Es una vista de la LISTA: no abre la ficha de ninguna organización.
    expect(consola.organizacionPedida()).toBeNull();

    consola.elegirVistaDeOrganizaciones('organizaciones');
    await new Promise(resolver => setTimeout(resolver, 25));
    expect(consola.enPerfilesDePersonas()).toBeFalse();
  });

  it('la revisión de una solicitud y su ficha completa se leen de la dirección', async () => {
    const consola = await ir('/administracion/solicitudes/review-festivals-173/ficha');

    expect(consola.activeSection()).toBe('solicitudes');
    expect(ficha.id()).toBe('review-festivals-173');
    expect(ficha.vista()).toBe('ficha');
  });

  it('la lista no tiene ficha: volver de la ficha a la lista la cierra', async () => {
    const consola = await ir('/administracion/festivales/173');
    expect(consola.fichaDeFestival()).toBe('173');

    await ir('/administracion/festivales');

    expect(consola.fichaDeFestival()).toBeNull();
    expect(ficha.id()).toBeNull();
  });

  it('«Atrás» del navegador cierra la ficha y «Adelante» la vuelve a abrir', async () => {
    const consola = await ir('/administracion/festivales');
    await ir('/administracion/festivales/173');
    expect(consola.fichaDeFestival()).toBe('173');

    const lugar = TestBed.inject(Location);
    lugar.back();
    await esperar(() => consola.fichaDeFestival() === null);
    expect(lugar.path()).toBe('/administracion/festivales');
    expect(consola.fichaDeFestival()).toBeNull();

    lugar.forward();
    await esperar(() => consola.fichaDeFestival() === '173');
    expect(consola.fichaDeFestival()).toBe('173');
  });

  it('abrir una ficha desde un panel navega a su dirección y conserva los filtros de la lista', async () => {
    await ir('/administracion/catalogo-editorial?q=cumbia');
    ficha.abrir('catalogo-editorial', 12);
    await new Promise(resolver => setTimeout(resolver, 50));

    expect(TestBed.inject(Location).path()).toBe('/administracion/catalogo-editorial/12?q=cumbia');
    expect(ficha.id()).toBe('12');

    ficha.cerrar('catalogo-editorial');
    await new Promise(resolver => setTimeout(resolver, 50));
    expect(TestBed.inject(Location).path()).toBe('/administracion/catalogo-editorial?q=cumbia');
  });

  it('el enlace antiguo ?revisar={id} redirige a la revisión, sin apilar una entrada', async () => {
    await ir('/administracion/resumen');
    await ir('/administracion/festivales?revisar=173');
    await new Promise(resolver => setTimeout(resolver, 50));

    const lugar = TestBed.inject(Location);
    expect(lugar.path()).toBe('/administracion/solicitudes/review-festivals-173');
    expect(ficha.id()).toBe('review-festivals-173');

    // «Atrás» vuelve al Resumen, no al enlace antiguo.
    lugar.back();
    await esperar(() => lugar.path() === '/administracion/resumen');
    expect(lugar.path()).toBe('/administracion/resumen');
  });

  it('las listas por tipo retiradas (/talleres, /espacios, /redes) redirigen a la lista única con el tipo (decisión 132)', async () => {
    for (const [ruta, tipo] of [['talleres', 'luteria'], ['espacios', 'espacios'], ['redes', 'redes']] as const) {
      await ir(`/administracion/${ruta}`);
      await new Promise(resolver => setTimeout(resolver, 50));
      expect(TestBed.inject(Location).path()).toBe(`/administracion/procesos?tipo=${tipo}`);
    }
  });

  it('la ficha de un taller conserva su dirección y se abre sobre la lista única de procesos', async () => {
    const consola = await ir('/administracion/talleres/7');

    expect(consola.activeSection()).toBe('procesos');
    expect(consola.fichaDeTaller()).toBe('7');
    expect(consola.fichaDeEspacio()).toBeNull();
    expect(TestBed.inject(Location).path()).toBe('/administracion/talleres/7');
  });

  it('una sección que no existe se corrige y no deja ficha', async () => {
    const consola = await ir('/administracion/no-existe/5');
    await new Promise(resolver => setTimeout(resolver, 50));

    expect(TestBed.inject(Location).path()).toBe('/administracion/resumen');
    expect(consola.fichaDeFestival()).toBeNull();
    expect(ficha.id()).toBeNull();
  });

  it('una ficha de un módulo no concedido cae en «Sin acceso a este apartado», no en la ficha', async () => {
    const consola = await ir('/administracion/festivales/173');
    // Una cuenta de gestión con solo Resumen y Solicitudes.
    http.expectOne('/api/v1/admin/auth/me').flush({
      user: {
        id: '2', email: 'gestor@example.org', fullName: 'Gestora', role: 'gestor_interno', roles: ['gestor_interno'],
        debeCambiarContrasena: false, perfilCompletado: true,
      },
    });
    harness.fixture.detectChanges();
    http.match(peticion => peticion.url === '/api/v1/admin/mis-modulos')
      .forEach(peticion => peticion.flush({ modulos: ['monitor', 'solicitudes'] }));
    // Lo demás que pide la consola al abrir no importa aquí: se queda sin responder.
    harness.fixture.detectChanges();

    expect(consola.seccionSinAcceso()).toBeTrue();
    const pantalla = harness.fixture.nativeElement as HTMLElement;
    expect(pantalla.querySelector('[data-sin-acceso]')?.textContent).toContain('Sin acceso a este apartado');
    // La ficha ni se monta: el guardia de la sección va antes que cualquier ficha.
    expect(pantalla.querySelector('app-admin-ficha-festival')).toBeNull();

    // Lo que sí tiene concedido, con ficha, no cae en el guardia.
    await ir('/administracion/solicitudes/review-festivals-173');
    harness.fixture.detectChanges();
    expect(consola.seccionSinAcceso()).toBeFalse();
    expect(pantalla.querySelector('[data-sin-acceso]')).toBeNull();
  });
});
