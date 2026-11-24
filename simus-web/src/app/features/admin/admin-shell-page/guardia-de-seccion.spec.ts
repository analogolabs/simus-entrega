import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminShellPageComponent } from './admin-shell-page.component';

/**
 * Un solo guardia de sección en la consola.
 *
 * Un apartado no concedido se comportaba de tres maneras: /usuarios y /sistema saltaban al Resumen
 * en silencio, /organizaciones se pintaba entera con botones que acababan en 403, y el Resumen decía
 * «sin actividad» cuando lo que recibía era un 403. `puedeAbrir` es ahora la única pregunta, la
 * misma que dibuja la barra.
 */
describe('AdminShellPageComponent · guardia de sección', () => {
  let fixture: ComponentFixture<AdminShellPageComponent>;
  let componente: AdminShellPageComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminShellPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(AdminShellPageComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http.expectOne('/api/v1/admin/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('mientras no se saben los módulos, la barra y el guardia dejan abrir lo que el rol permite', () => {
    expect(componente.puedeAbrir('agenda')).toBeTrue();
    expect(componente.puedeAbrir('monitor')).toBeTrue();
  });

  it('un apartado que la cuenta no tiene concedido no se puede abrir', () => {
    componente.modulosDeMiCuenta.set(['monitor', 'solicitudes', 'catalogo-editorial']);

    expect(componente.puedeAbrir('catalogo-editorial')).toBeTrue();
    expect(componente.puedeAbrir('organizaciones')).toBeFalse();
    expect(componente.puedeAbrir('auditoria')).toBeFalse();
  });

  it('los apartados solo de webmaster no se abren sin ese rol, aunque la cuenta los tuviera', () => {
    // Sin sesión no hay rol: el lado seguro del error.
    componente.modulosDeMiCuenta.set(['monitor', 'solicitudes', 'usuarios', 'sistema']);

    expect(componente.puedeAbrir('usuarios')).toBeFalse();
    expect(componente.puedeAbrir('sistema')).toBeFalse();
  });

  it('la barra lateral usa la misma regla: no ofrece lo que el guardia cerraría', () => {
    componente.modulosDeMiCuenta.set(['monitor', 'solicitudes', 'agenda']);

    const ofrecidas = componente.visibleNavSections.flatMap(grupo => grupo.items.map(item => item.id));
    expect(ofrecidas).toEqual(['monitor', 'solicitudes', 'agenda']);
  });

  it('mientras no llegan los módulos la barra no ofrece ninguna sección (falla cerrada)', () => {
    expect(componente.modulosDeMiCuenta()).toBeNull();
    expect(componente.visibleNavSections).toEqual([]);
    const barra = fixture.nativeElement.querySelector('nav.sidebar-secciones');
    // Sin sesión el armazón muestra el acceso, no la barra; lo que se comprueba es la regla de datos.
    if (barra) { expect(barra.querySelectorAll('button.sidebar-item').length).toBe(0); }
  });

  it('si falla la consulta de módulos la barra sigue sin ofrecer secciones y «Reintentar» vuelve a preguntar', () => {
    componente.reintentarMisModulos();
    http.expectOne('/api/v1/admin/mis-modulos').flush(null, { status: 500, statusText: 'Error' });

    expect(componente.errorDeModulos()).toBeTrue();
    expect(componente.visibleNavSections).toEqual([]);

    componente.reintentarMisModulos();
    expect(componente.errorDeModulos()).toBeFalse();
    http.expectOne('/api/v1/admin/mis-modulos').flush({ modulos: ['monitor', 'agenda'] });
    // Con los módulos, vuelve a ofrecer solo los de la cuenta.
    const ofrecidas = componente.visibleNavSections.flatMap(grupo => grupo.items.map(item => item.id));
    expect(ofrecidas).toEqual(['monitor', 'agenda']);
    // Responde a las consultas que dispara la carga de módulos (bandeja, resumen).
    http.match(() => true).forEach(r => r.flush(null, { status: 401, statusText: 'Unauthorized' }));
  });

  it('una sección que no existe no se toma por «sin acceso»: la corrige la ruta', () => {
    expect(componente.puedeAbrir('no-existe')).toBeFalse();
    componente.activeSection.set('no-existe');
    // Sin sesión el guardia no actúa; con sesión, `seccionSinAcceso` exige que la sección exista.
    expect(componente.seccionSinAcceso()).toBeFalse();
  });
});
